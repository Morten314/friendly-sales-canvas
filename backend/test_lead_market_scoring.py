"""
Smoke test script for lead market scoring APIs.
"""

import json
import requests

BASE_URL = "https://backend-11kr.onrender.com"
USER_ID = "WbzGPnZh3pNcZDjMF4qkxun1qV83"
ORG_ID = "b06907ac-b9aa-46ae-9535-8f735614b365"


def test_market_scores(refresh: bool = False):
    payload = {
        "user_id": USER_ID,
        "org_id": ORG_ID,
        "refresh": refresh,
    }
    response = requests.post(f"{BASE_URL}/leads/market-scores", json=payload, timeout=120)
    print("POST /leads/market-scores")
    print("Status:", response.status_code)
    print(json.dumps(response.json(), indent=2))
    return response


def test_descriptions(lead_id: str):
    params = {
        "user_id": USER_ID,
        "org_id": ORG_ID,
    }
    response = requests.get(
        f"{BASE_URL}/leads/{lead_id}/market-score-descriptions",
        params=params,
        timeout=60,
    )
    print(f"GET /leads/{lead_id}/market-score-descriptions")
    print("Status:", response.status_code)
    print(json.dumps(response.json(), indent=2))
    return response


if __name__ == "__main__":
    first_response = test_market_scores(refresh=False)
    if first_response.status_code == 200:
        rows = first_response.json().get("rows", [])
        if rows:
            test_descriptions(rows[0].get("lead_id"))
        else:
            print("No rows found. Trigger refresh and rerun later.")
