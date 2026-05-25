"""Lead-record normalization helpers (private)."""
import json
from typing import Any, Dict, List


def _process_neo4j_lead_records(results) -> List[Dict[str, Any]]:
    """Deserialize Neo4j Lead records into plain dicts."""
    leads = []
    for record in results:
        lead_node = record["l"]
        lead_dict = dict(lead_node.items())
        processed_lead: Dict[str, Any] = {}
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
