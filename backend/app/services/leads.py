"""Leads service: org-scoped lead retrieval.

Extracted from services.py during phase A modularization.
"""
import json
from typing import List, Dict, Any

from app.core import clients


def fetch_leads_for_org(org_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch leads from Neo4j filtered by org_id"""
    try:
        query_string = """
        MATCH (l:Lead)
        WHERE l.org_id = $org_id
        RETURN l
        ORDER BY l.created_at DESC
        LIMIT $limit
        """
        with clients.driver.session() as session:
            results = session.run(query_string, org_id=org_id, limit=limit)
            leads = []
            for record in results:
                lead_node = record["l"]
                lead_dict = dict(lead_node.items())
                # Convert JSON strings back to objects if needed
                processed_lead = {}
                for key, value in lead_dict.items():
                    if isinstance(value, str) and value.strip().startswith(('{', '[')):
                        try:
                            processed_lead[key] = json.loads(value)
                        except json.JSONDecodeError:
                            processed_lead[key] = value
                    else:
                        processed_lead[key] = value
                leads.append(processed_lead)
        return leads
    except Exception as e:
        print(f"Warning: Could not fetch leads: {e}")
        return []
