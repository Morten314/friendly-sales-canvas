"""
Quick verification script for lead market score identity fields.

Checks whether `company_name` and `lead_name` are present in
`POST /leads/market-scores` response rows.
"""

import json
import requests

BASE_URL = "https://backend-11kr.onrender.com"
USER_ID = "WbzGPnZh3pNcZDjMF4qkxun1qV83"
ORG_ID = "b06907ac-b9aa-46ae-9535-8f735614b365"


def fetch_market_scores(refresh: bool = False) -> dict:
    payload = {
        "user_id": USER_ID,
        "org_id": ORG_ID,
        "refresh": refresh,
    }
    response = requests.post(f"{BASE_URL}/leads/market-scores", json=payload, timeout=180)
    response.raise_for_status()
    return response.json()


def main() -> None:
    data = fetch_market_scores(refresh=False)
    rows = data.get("rows", [])

    print("processing_status:", data.get("processing_status"))
    print("total_rows:", len(rows))

    missing_company = 0
    missing_lead = 0
    for row in rows:
        if not row.get("company_name"):
            missing_company += 1
        if not row.get("lead_name"):
            missing_lead += 1

    print("rows_missing_company_name:", missing_company)
    print("rows_missing_lead_name:", missing_lead)

    preview = rows[:5]
    print("\nPreview (first 5 rows):")
    print(json.dumps(preview, indent=2))


if __name__ == "__main__":
    main()
