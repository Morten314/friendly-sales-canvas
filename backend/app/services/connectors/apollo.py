"""Concrete Apollo.io connector — the only Apollo-aware code in the backend.

All HTTP funnels through the module-level `_http_request` seam (thin requests
wrapper) so tests patch one site. 429s are retried with exponential backoff via
the patchable `_sleep`. The API key is passed in (from credentials.py), never
read from config.
"""
import logging
import random
import time
from typing import Any, Dict, Iterator, List, Optional

import requests

from app.core.exceptions import (
    ApolloAPIError,
    ApolloCreditsExhaustedError,
    ConnectorCredentialsInvalidError,
)

logger = logging.getLogger(__name__)

APOLLO_BASE_URL = "https://api.apollo.io/api/v1"
CONTACTS_PAGE_SIZE = 100
BULK_MATCH_CHUNK = 10

# 429 backoff (spec §8): base 1s, factor 2, max 30s, jitter, <=5 retries.
_BACKOFF_BASE_SECONDS = 1.0
_BACKOFF_FACTOR = 2.0
_BACKOFF_MAX_SECONDS = 30.0
_MAX_RETRIES = 5

_DEFAULT_TIMEOUT = 30

# Patchable seams (tests override these two names on this module).
_sleep = time.sleep


def _http_request(method: str, url: str, **kwargs) -> requests.Response:
    """Thin wrapper over requests.request — the single network seam."""
    return requests.request(method, url, **kwargs)


class ApolloConnector:
    """Concrete connector. Documented method surface (spec §4): validate_credentials,
    fetch_contacts, bulk_match, list_collections. No ABC in v1."""

    def __init__(self, api_key: str, *, timeout: int = _DEFAULT_TIMEOUT):
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self._api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Issue one Apollo call with 429 backoff; raise typed exceptions on error."""
        url = f"{APOLLO_BASE_URL}{path}"
        delay = _BACKOFF_BASE_SECONDS
        last_status = None
        for attempt in range(_MAX_RETRIES + 1):
            resp = _http_request(
                method,
                url,
                headers=self._headers(),
                params=params,
                json=json,
                timeout=self._timeout,
            )
            last_status = resp.status_code
            if resp.status_code == 429:
                if attempt >= _MAX_RETRIES:
                    break
                sleep_for = min(delay, _BACKOFF_MAX_SECONDS) + random.uniform(0, 0.5)
                logger.warning("Apollo 429 on %s; backing off %.2fs (attempt %d)", path, sleep_for, attempt + 1)
                _sleep(sleep_for)
                delay *= _BACKOFF_FACTOR
                continue
            if resp.status_code in (401, 403):
                raise ConnectorCredentialsInvalidError(
                    f"Apollo rejected the API key ({resp.status_code})."
                )
            if resp.status_code == 402 or (
                resp.status_code == 422 and "credit" in (resp.text or "").lower()
            ):
                raise ApolloCreditsExhaustedError(
                    f"Apollo credits exhausted ({resp.status_code})."
                )
            if resp.status_code >= 400:
                raise ApolloAPIError(
                    f"Apollo API error ({resp.status_code}) on {path}: {(resp.text or '')[:300]}"
                )
            try:
                return resp.json() or {}
            except ValueError:
                raise ApolloAPIError(
                    f"Apollo returned a non-JSON body (status {resp.status_code}): {(resp.text or '')[:200]}"
                )
        raise ApolloAPIError(
            f"Apollo API still rate-limited after {_MAX_RETRIES} retries on {path} (last status {last_status})."
        )

    # ─── Public surface ───

    def validate_credentials(self) -> None:
        """Credit-free auth check (GET /labels). Raises on a bad key."""
        self._request("GET", "/labels")

    def list_collections(self) -> List[Dict[str, str]]:
        """Return the customer's Apollo lists/labels as [{id, name}], paginated internally."""
        out: List[Dict[str, str]] = []
        page = 1
        while True:
            body = self._request("GET", "/labels", params={"page": page, "per_page": 100})
            labels = body.get("labels") or body.get("data") or []
            for lab in labels:
                if isinstance(lab, dict) and lab.get("id") is not None:
                    out.append({"id": str(lab["id"]), "name": str(lab.get("name") or lab["id"])})
            pagination = body.get("pagination") or {}
            total_pages = int(pagination.get("total_pages") or 1)
            if page >= total_pages or not labels:
                break
            page += 1
        return out

    def fetch_contacts(self, list_id: Optional[str] = None) -> Iterator[List[Dict[str, Any]]]:
        """Yield pages (lists) of raw Apollo contact dicts from /contacts/search.

        list_id filters by Apollo label; omit to pull all of the org's contacts.
        """
        page = 1
        while True:
            payload: Dict[str, Any] = {"page": page, "per_page": CONTACTS_PAGE_SIZE}
            if list_id:
                payload["label_ids"] = [list_id]
            body = self._request("POST", "/contacts/search", json=payload)
            contacts = body.get("contacts") or []
            if contacts:
                yield contacts
            pagination = body.get("pagination") or {}
            total_pages = int(pagination.get("total_pages") or 1)
            if page >= total_pages or not contacts:
                break
            page += 1

    def bulk_match(
        self,
        entries: List[Dict[str, Any]],
        *,
        reveal_personal_emails: bool,
        reveal_phone_number: bool,
    ) -> List[Dict[str, Any]]:
        """Match up to 10 person-detail dicts via /people/bulk_match.

        Returns the `matches` list, index-aligned with `entries` (Apollo returns a
        slot per input; a no-match slot is null/empty).
        """
        if len(entries) > BULK_MATCH_CHUNK:
            raise ValueError(f"bulk_match accepts at most {BULK_MATCH_CHUNK} entries per call")
        body = self._request(
            "POST",
            "/people/bulk_match",
            json={
                "details": entries,
                "reveal_personal_emails": reveal_personal_emails,
                "reveal_phone_number": reveal_phone_number,
            },
        )
        return body.get("matches") or []
