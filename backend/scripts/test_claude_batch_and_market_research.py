"""
HTTP smoke tests for Claude-backed endpoints:
  POST /market-research_claude
  POST /generate-signals-batch_claude

Uses the same default user/org as scripts/debug_lead_stream_scoring.py.
Requires a running API (see BASE_URL) and ANTHROPIC_API_KEY on the server.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict

import requests

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Match scripts/debug_lead_stream_scoring.py
DEFAULT_USER_ID = "WbzGPnZh3pNcZDjMF4qkxun1qV83"
DEFAULT_ORG_ID = "b06907ac-b9aa-46ae-9535-8f735614b365"

# Same default API host as test_lead_market_scoring.py / test_upload_embedding.py
BASE_URL = "https://backend-11kr.onrender.com"

from app.services.market_scoring import get_company_profile_for_org  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-url",
        default=os.getenv("BREWRA_API_BASE", BASE_URL).rstrip("/"),
        help=f"API base URL (default: env BREWRA_API_BASE or {BASE_URL})",
    )
    parser.add_argument("--user-id", default=DEFAULT_USER_ID)
    parser.add_argument("--org-id", default=DEFAULT_ORG_ID)
    parser.add_argument(
        "--component",
        default="market size & opportunity",
        help="Scout component_name for market-research_claude",
    )
    parser.add_argument(
        "--skip-batch",
        action="store_true",
        help="Only call market-research_claude (batch is slower / costlier)",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Force refresh for market research (ignores cached latest report)",
    )
    args = parser.parse_args()

    profile = get_company_profile_for_org(args.org_id)
    if not profile:
        print(f"No company profile in Neo4j for org_id={args.org_id}", file=sys.stderr)
        return 2

    session = requests.Session()
    base = args.base_url

    # --- market-research_claude ---
    mr_payload: Dict[str, Any] = {
        "user_id": args.user_id,
        "org_id": args.org_id,
        "component_name": args.component,
        "data": {},
        "refresh": bool(args.refresh),
    }
    mr_url = f"{base}/market-research_claude"
    print(f"POST {mr_url}")
    r = session.post(mr_url, json=mr_payload, timeout=600)
    print(f"  status: {r.status_code}")
    try:
        body = r.json()
    except Exception:
        print(r.text[:2000])
        return 1
    print("  keys:", list(body.keys()))
    if body.get("status") == "success" and isinstance(body.get("data"), dict):
        d = body["data"]
        print("  data keys (sample):", list(d.keys())[:20])
    else:
        print(json.dumps(body, indent=2, default=str)[:3000])
    if r.status_code >= 400:
        return 1

    if args.skip_batch:
        return 0

    # --- generate-signals-batch_claude ---
    batch_payload: Dict[str, Any] = {
        "user_id": args.user_id,
        "org_id": args.org_id,
        "component_name": args.component,
        "data": profile,
        "refresh": False,
    }
    batch_url = f"{base}/generate-signals-batch_claude"
    print(f"POST {batch_url}")
    r2 = session.post(batch_url, json=batch_payload, timeout=900)
    print(f"  status: {r2.status_code}")
    try:
        b2 = r2.json()
    except Exception:
        print(r2.text[:2000])
        return 1
    print("  keys:", list(b2.keys()))
    if b2.get("status") == "success" and isinstance(b2.get("data"), list):
        print(f"  signals returned: {len(b2['data'])}")
        for i, sig in enumerate(b2["data"][:4]):
            h = (sig or {}).get("headline", "")
            print(f"  [{i}] headline: {str(h)[:120]}...")
    else:
        print(json.dumps(b2, indent=2, default=str)[:3000])
    if r2.status_code >= 400:
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
