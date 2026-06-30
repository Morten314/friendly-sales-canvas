"""Admin ops — list all orgs from the single Org_Management documents."""
from typing import Any, Dict, List


def list_all_orgs(mongo) -> List[Dict[str, Any]]:
    """Read the single `{_id:"orgs"}` and `{_id:"users"}` documents and return
    one summary per org. Unpaginated single-doc read (spec §6 item 1)."""
    db = mongo["Org_Management"]
    orgs_doc = db["orgs"].find_one({"_id": "orgs"}) or {}
    users_doc = db["users"].find_one({"_id": "users"}) or {}

    org_list: List[str] = orgs_doc.get("org_list", [])
    org_names: Dict[str, str] = orgs_doc.get("org_names", {})
    user_mappings: Dict[str, str] = users_doc.get("user_mappings", {})

    users_by_org: Dict[str, List[str]] = {}
    for user_id, org_id in user_mappings.items():
        users_by_org.setdefault(org_id, []).append(user_id)

    result: List[Dict[str, Any]] = []
    for org_id in org_list:
        uids = users_by_org.get(org_id, [])
        result.append({
            "org_id": org_id,
            "org_name": org_names.get(org_id),
            "user_count": len(uids),
            "user_ids": uids,
        })
    return result
