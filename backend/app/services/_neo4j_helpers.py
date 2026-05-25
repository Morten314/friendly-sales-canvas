"""Neo4j query utilities. `query()` takes `driver` explicitly because
callers pass the injected driver in (no module-level closure).
"""
import json
from typing import Optional


def query(driver, query_string: str, params: Optional[dict] = None):
    """Execute a Cypher query and return the readable string of results."""
    with driver.session() as session:
        results = session.run(query_string, params or {}).data()
        return results_to_string(results)


def results_to_string(results):
    """Convert Neo4j query results into a readable string."""
    result_strings = [
        ", ".join(f"{key}: {value}" for key, value in result.items())
        for result in results
    ]
    return "\n".join(result_strings)


def escape_property_name(key: str) -> str:
    """Escape Neo4j property names that contain spaces or special characters."""
    if any(char in key for char in [' ', '.', '-', ':', '/', '\\', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '[', ']', '{', '}', '|', ';', "'", '"', '<', '>', ',', '?', '!']):
        return f"`{key}`"
    return key


def upsert_node(tx, label, match_field, match_value, data: dict):
    """Upsert a node with flexible data types.

    Converts complex types to JSON strings for Neo4j compatibility.
    Escapes property names with spaces or special characters.
    """
    neo4j_data = {}
    for key, value in data.items():
        if isinstance(value, (dict, list)):
            neo4j_data[key] = json.dumps(value)
        elif isinstance(value, (str, int, float, bool)):
            neo4j_data[key] = value
        elif value is None:
            continue
        else:
            neo4j_data[key] = str(value)

    set_clauses = []
    params = {"match_value": match_value}

    for key, value in neo4j_data.items():
        escaped_key = escape_property_name(key)
        safe_key = key.replace(' ', '_').replace('.', '_').replace('-', '_').replace(':', '_').replace('/', '_').replace('\\', '_').replace('@', '_').replace('#', '_').replace('$', '_').replace('%', '_').replace('^', '_').replace('&', '_').replace('*', '_').replace('(', '_').replace(')', '_').replace('+', '_').replace('=', '_').replace('[', '_').replace(']', '_').replace('{', '_').replace('}', '_').replace('|', '_').replace(';', '_').replace("'", '_').replace('"', '_').replace('<', '_').replace('>', '_').replace(',', '_').replace('?', '_').replace('!', '_')
        param_name = f"param_{safe_key}"
        set_clauses.append(f"n.{escaped_key} = ${param_name}")
        params[param_name] = value

    if set_clauses:
        set_clause = ", ".join(set_clauses)
        escaped_match_field = escape_property_name(match_field)
        query_str = f"""
        MERGE (n:{label} {{ {escaped_match_field}: $match_value }})
        SET {set_clause}
        """
        tx.run(query_str, **params)
    else:
        escaped_match_field = escape_property_name(match_field)
        query_str = f"""
        MERGE (n:{label} {{ {escaped_match_field}: $match_value }})
        """
        tx.run(query_str, match_value=match_value)


def fetch_company_profile(driver, org_id: Optional[str] = None) -> Optional[dict]:
    """Fetch the first CompanyProfile node, optionally filtered by org_id.

    If org_id is truthy: ``MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1``.
    If org_id is falsy (None or ""): ``MATCH (c:CompanyProfile) RETURN c LIMIT 1`` (fetch any).

    The truthy check (``if org_id:``) preserves the pre-refactor sites' behavior
    exactly — the fallback-pattern sites in market_research and icp used
    ``if request.org_id:``, treating empty string as falsy → fallback-to-any.
    Using ``if org_id is not None`` would change behavior at the empty-string
    boundary (routing "" to the filtered query, which returns None).

    Returns the c node's properties as a plain dict, or None if no match.
    """
    with driver.session() as session:
        if org_id:
            result = session.run(
                "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                org_id=org_id,
            )
        else:
            result = session.run("MATCH (c:CompanyProfile) RETURN c LIMIT 1")
        record = result.single()
        if record is None:
            return None
        return dict(record.values()[0])
