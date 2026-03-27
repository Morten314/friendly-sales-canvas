import argparse
import json
from typing import Any, Dict, List, Tuple

import requests


TOP_LEVEL_REQUIRED = [
    "id",
    "title",
    "is_new",
    "is_agentic",
    "why_suggested",
    "how_it_differs",
    "key_decision_makers",
    "competitors",
]

FIRMOGRAPHICS_REQUIRED = ["industry", "segment", "company_size", "market_size"]
PAIN_REQUIRED = ["critical", "others"]


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    if isinstance(value, dict) and len(value) == 0:
        return True
    return False


def validate_icp(icp: Dict[str, Any], index: int) -> Tuple[List[str], List[str]]:
    missing: List[str] = []
    empty: List[str] = []

    for key in TOP_LEVEL_REQUIRED:
        if key not in icp:
            missing.append(key)
        elif is_empty(icp.get(key)):
            empty.append(key)

    firmographics = icp.get("firmographics")
    if not isinstance(firmographics, dict):
        missing.append("firmographics")
    else:
        for key in FIRMOGRAPHICS_REQUIRED:
            path = f"firmographics.{key}"
            if key not in firmographics:
                missing.append(path)
            elif is_empty(firmographics.get(key)):
                empty.append(path)

    pain = icp.get("pain_points_and_triggers")
    if not isinstance(pain, dict):
        missing.append("pain_points_and_triggers")
    else:
        for key in PAIN_REQUIRED:
            path = f"pain_points_and_triggers.{key}"
            if key not in pain:
                missing.append(path)
            elif is_empty(pain.get(key)):
                empty.append(path)

    # Legacy keys still expected by some clients.
    for legacy in ["regions", "confidenceScore", "decisionMakers"]:
        if legacy not in icp:
            missing.append(legacy)
        elif is_empty(icp.get(legacy)):
            empty.append(legacy)

    return missing, empty


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate GET /icp response schema and field quality.")
    parser.add_argument("--base-url", required=True, help="API base URL, e.g. https://your-api.onrender.com")
    parser.add_argument("--user-id", required=True, help="user_id query parameter")
    parser.add_argument("--refresh", action="store_true", help="Pass refresh=true to force regeneration")
    parser.add_argument("--timeout", type=int, default=90, help="HTTP timeout seconds")
    args = parser.parse_args()

    url = f"{args.base_url.rstrip('/')}/icp"
    params = {"user_id": args.user_id, "refresh": str(args.refresh).lower()}
    print(f"Calling: {url}")
    print(f"Params: {params}")

    response = requests.get(url, params=params, timeout=args.timeout)
    print(f"Status: {response.status_code}")
    response.raise_for_status()

    payload = response.json()
    suggested_icps = payload.get("suggestedICPs", [])
    if not isinstance(suggested_icps, list):
        raise ValueError("Invalid response: suggestedICPs is not a list")

    print(f"suggestedICPs count: {len(suggested_icps)}")
    if not suggested_icps:
        print("No ICPs returned.")
        return

    total_missing = 0
    total_empty = 0
    for idx, icp in enumerate(suggested_icps):
        if not isinstance(icp, dict):
            print(f"[ICP {idx}] invalid type: {type(icp)}")
            continue
        missing, empty = validate_icp(icp, idx)
        total_missing += len(missing)
        total_empty += len(empty)
        print(f"\n[ICP {idx}] id={icp.get('id')}")
        if missing:
            print(f"  Missing fields ({len(missing)}): {missing}")
        if empty:
            print(f"  Empty fields ({len(empty)}): {empty}")
        if not missing and not empty:
            print("  OK: all checked fields present and non-empty.")

    print("\nSummary")
    print(f"- Total missing field occurrences: {total_missing}")
    print(f"- Total empty field occurrences: {total_empty}")
    print("- Raw response preview:")
    print(json.dumps(payload, indent=2)[:3000])


if __name__ == "__main__":
    main()
