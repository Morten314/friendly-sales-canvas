"""ApolloConnector against fake HTTP responses (no live API).
The single network seam is app.services.connectors.apollo._http_request."""
import pytest

from app.core.exceptions import (
    ApolloAPIError,
    ApolloCreditsExhaustedError,
    ConnectorCredentialsInvalidError,
)
from app.services.connectors import apollo as apollo_mod
from app.services.connectors.apollo import ApolloConnector


class FakeResp:
    def __init__(self, status_code=200, json_body=None, text=""):
        self.status_code = status_code
        self._json = json_body if json_body is not None else {}
        self.text = text

    def json(self):
        return self._json


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    """Never actually sleep during backoff tests."""
    monkeypatch.setattr(apollo_mod, "_sleep", lambda _s: None)


def test_validate_credentials_uses_labels_get_not_a_match_call(monkeypatch):
    calls = []

    def fake_http(method, url, **kwargs):
        calls.append((method, url))
        return FakeResp(200, {"labels": []})

    monkeypatch.setattr(apollo_mod, "_http_request", fake_http)
    ApolloConnector("key").validate_credentials()

    assert len(calls) == 1
    method, url = calls[0]
    assert method == "GET"
    assert url.endswith("/labels")  # credit-free; not /people/bulk_match


def test_validate_credentials_401_raises_invalid(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: FakeResp(401, text="unauthorized"))
    with pytest.raises(ConnectorCredentialsInvalidError):
        ApolloConnector("bad").validate_credentials()


def test_429_retries_then_succeeds(monkeypatch):
    seq = [FakeResp(429, text="slow down"), FakeResp(429), FakeResp(200, {"labels": [{"id": "1", "name": "A"}]})]
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: seq.pop(0))
    lists = ApolloConnector("key").list_collections()
    assert lists == [{"id": "1", "name": "A"}]
    assert seq == []  # all three consumed


def test_429_exhausts_retries_raises(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: FakeResp(429, text="rate limited"))
    with pytest.raises(ApolloAPIError):
        ApolloConnector("key").list_collections()


def test_402_raises_credits_exhausted(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: FakeResp(402, text="insufficient credits"))
    with pytest.raises(ApolloCreditsExhaustedError):
        ApolloConnector("key").bulk_match([{"email": "a@b.com"}], reveal_personal_emails=True, reveal_phone_number=False)


def test_fetch_contacts_paginates_and_yields_pages(monkeypatch):
    pages = {
        1: {"contacts": [{"id": "1"}, {"id": "2"}], "pagination": {"page": 1, "total_pages": 2}},
        2: {"contacts": [{"id": "3"}], "pagination": {"page": 2, "total_pages": 2}},
    }

    def fake_http(method, url, **kwargs):
        page = kwargs["json"]["page"]
        return FakeResp(200, pages[page])

    monkeypatch.setattr(apollo_mod, "_http_request", fake_http)
    collected = list(ApolloConnector("key").fetch_contacts(list_id="L1"))
    assert [len(p) for p in collected] == [2, 1]
    assert collected[0][0]["id"] == "1"


def test_bulk_match_rejects_oversized_chunk(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: FakeResp(200, {"matches": []}))
    with pytest.raises(ValueError):
        ApolloConnector("key").bulk_match(
            [{"email": f"{i}@x.com"} for i in range(11)],
            reveal_personal_emails=True,
            reveal_phone_number=False,
        )


def test_422_credit_body_raises_credits_exhausted(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request",
        lambda *a, **k: FakeResp(422, text="insufficient credit balance"))
    with pytest.raises(ApolloCreditsExhaustedError):
        ApolloConnector("key").validate_credentials()


def test_429_exhausts_makes_max_plus_one_calls(monkeypatch):
    from app.services.connectors.apollo import _MAX_RETRIES
    calls = []

    def fake_http(*a, **k):
        calls.append(1)
        return FakeResp(429)

    monkeypatch.setattr(apollo_mod, "_http_request", fake_http)
    with pytest.raises(ApolloAPIError):
        ApolloConnector("key").list_collections()
    assert len(calls) == _MAX_RETRIES + 1


def test_bulk_match_sends_reveal_flags_and_details(monkeypatch):
    captured = {}

    def fake_http(method, url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs["json"]
        return FakeResp(200, {"matches": [{"id": "m1"}]})

    monkeypatch.setattr(apollo_mod, "_http_request", fake_http)
    out = ApolloConnector("key").bulk_match(
        [{"email": "a@b.com"}], reveal_personal_emails=True, reveal_phone_number=False
    )
    assert out == [{"id": "m1"}]
    assert captured["url"].endswith("/people/bulk_match")
    assert captured["json"]["reveal_personal_emails"] is True
    assert captured["json"]["reveal_phone_number"] is False
    assert captured["json"]["details"] == [{"email": "a@b.com"}]


def test_403_raises_api_error_not_invalid_credentials(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: FakeResp(403, text="forbidden"))
    with pytest.raises(ApolloAPIError) as exc_info:
        ApolloConnector("key").validate_credentials()
    assert type(exc_info.value) is ApolloAPIError  # NOT ConnectorCredentialsInvalidError
    assert "403" in str(exc_info.value)
