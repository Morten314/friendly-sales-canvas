"""Profiles service — profile CRUD, bulk cleanup, and generic edit dispatch."""
import json
from datetime import datetime, timezone
from typing import Optional

from app.core import clients
from app.core.clients import upsert_node
from app.core.exceptions import (
    CompanyProfileNotFoundError,
    ProfileNotFoundError,
    ProfileValidationError,
)
from app.models.profiles import EditRequest


def upsert_profile(profile_type: str, payload: dict) -> dict:
    """Create or update a profile node in Neo4j."""
    # Check if profile_type is provided in payload (optional, can use path param)
    if "profile_type" in payload:
        profile_type = payload["profile_type"]

    # Extract user_id if present (for multitenancy)
    # user_id is optional for company profiles (shared profile)
    user_id = payload.get("user_id")
    if profile_type != "company" and not user_id:
        raise ProfileValidationError("user_id is required in payload")

    # Extract org_id for company profiles (required for multi-org support)
    org_id = payload.get("org_id")
    if profile_type == "company" and not org_id:
        raise ProfileValidationError("org_id is required for company profiles")

    # Prepare data - convert all values to Neo4j-compatible types
    data = {}
    for key, value in payload.items():
        # Skip profile_type as it's used for node label
        if key == "profile_type":
            continue
        # Skip user_id for company profiles (shared profile, no multitenancy)
        if key == "user_id" and profile_type == "company":
            continue

        # Handle different value types
        if isinstance(value, (dict, list)):
            # Convert complex types to JSON string
            data[key] = json.dumps(value)
        elif isinstance(value, (str, int, float, bool)):
            # Direct assignment for primitive types
            data[key] = value
        elif value is None:
            # Skip None values
            continue
        else:
            # Convert everything else to string
            data[key] = str(value)

    with clients.driver.session() as session:
        # Map profile_type to Neo4j label (handle case differences)
        neo4j_label = profile_type
        if profile_type == "company":
            neo4j_label = "CompanyProfile"

        # Determine unique identifier field based on profile_type
        if profile_type == "company":
            # For company profile, use org_id for multi-org support
            match_field = "org_id"
            match_value = org_id
            # Delete existing company profile for this org_id only
            session.run(
                "MATCH (p:CompanyProfile {org_id: $org_id}) DELETE p",
                org_id=org_id
            )
        elif profile_type == "user":
            match_field = "name"
            match_value = payload.get("name") or payload.get("user_id")
            # Phase D security pass: this query interpolates `profile_type` into Cypher.
            # Move was verbatim during Phase B; parameterization comes later.
            session.run(
                f"MATCH (p:{neo4j_label} {{user_id: $user_id}}) DELETE p",
                user_id=user_id
            )
        elif profile_type == "agent_name":
            match_field = "agentName"
            match_value = payload.get("agentName") or "Scout"
            # Phase D security pass: this query interpolates `profile_type` into Cypher.
            # Move was verbatim during Phase B; parameterization comes later.
            session.run(
                f"MATCH (p:{neo4j_label} {{user_id: $user_id}}) DELETE p",
                user_id=user_id
            )
        else:
            # For any other profile_type, use user_id as match field
            match_field = "user_id"
            match_value = user_id
            # Phase D security pass: this query interpolates `profile_type` into Cypher.
            # Move was verbatim during Phase B; parameterization comes later.
            session.run(
                f"MATCH (p:{neo4j_label} {{user_id: $user_id}}) DELETE p",
                user_id=user_id
            )

        # Insert/update the profile (Neo4j v5+)
        session.execute_write(
            upsert_node,
            neo4j_label,
            match_field,
            match_value,
            data
        )

    return {"message": f"{profile_type} profile processed successfully"}


def get_profile(profile_type: str, user_id: Optional[str], org_id: Optional[str]) -> dict:
    """Fetch a profile node from Neo4j (and MongoDB for company profiles)."""
    with clients.driver.session() as session:
        # For company profiles, filter by org_id (required for multi-org support)
        if profile_type == "company":
            if not org_id:
                raise ProfileValidationError("org_id is required for company profiles")
            neo4j_label = "CompanyProfile"
            # Phase D security pass: this query interpolates `profile_type` into Cypher.
            # Move was verbatim during Phase B; parameterization comes later.
            query_string = f"MATCH (p:{neo4j_label} {{org_id: $org_id}}) RETURN p LIMIT 1"
            result = session.run(query_string, org_id=org_id)
        else:
            # For other profiles, user_id is required
            if not user_id:
                raise ProfileValidationError("user_id is required for non-company profiles")
            # Query by profile_type and user_id (multitenancy)
            # Phase D security pass: this query interpolates `profile_type` into Cypher.
            # Move was verbatim during Phase B; parameterization comes later.
            query_string = f"MATCH (p:{profile_type} {{user_id: $user_id}}) RETURN p LIMIT 1"
            result = session.run(query_string, user_id=user_id)

        record = result.single()

        if not record:
            if profile_type == "company":
                raise CompanyProfileNotFoundError("No company profile found")
            else:
                raise ProfileNotFoundError(
                    f"No {profile_type} profile found for user_id: {user_id}"
                )

        profile_data = dict(record.values()[0])

        # Try to parse JSON strings back to objects (flexible handling)
        for key, value in profile_data.items():
            if isinstance(value, str):
                # Try to parse as JSON if it looks like JSON
                if value.strip().startswith(('{', '[')):
                    try:
                        profile_data[key] = json.loads(value)
                    except json.JSONDecodeError:
                        pass  # Keep as string if not valid JSON

        # For company profiles, also fetch customer profiles from MongoDB
        if profile_type == "company":
            try:
                db = clients.client["Profiler"]
                collection = db["Company_Profile"]

                # Find the company profile document with customer profiles (filter by org_id)
                filter_query = {"profile_type": "company", "org_id": org_id}
                document = collection.find_one(filter_query)

                if document:
                    customer_profiles = document.get("customer_profiles", {})
                    icps = customer_profiles.get("icps", [])
                    # Remove MongoDB _id if present in ICPs
                    for icp in icps:
                        if "_id" in icp:
                            del icp["_id"]
                    profile_data["customer_profiles"] = {"icps": icps}
                else:
                    profile_data["customer_profiles"] = {"icps": []}
            except Exception:
                # If MongoDB fetch fails, just add empty customer profiles
                profile_data["customer_profiles"] = {"icps": []}

        return profile_data


def cleanup_company_profiles(org_id: Optional[str] = None) -> dict:
    """Ensure only one CompanyProfile exists in Neo4j. Keeps the first (oldest by node ID)."""
    with clients.driver.session() as session:
        # Get all company profiles
        result = session.run("MATCH (c:CompanyProfile) RETURN c, id(c) as node_id ORDER BY id(c)")
        records = list(result)

        if len(records) == 0:
            return {"message": "No company profiles found", "deleted": 0, "remaining": 0}

        if len(records) == 1:
            return {"message": "Only one company profile exists", "deleted": 0, "remaining": 1}

        # Keep the first one (oldest by node ID)
        first_node_id = records[0]["node_id"]

        # Delete all others
        delete_result = session.run(
            "MATCH (c:CompanyProfile) WHERE id(c) <> $keep_id DELETE c RETURN count(c) as deleted",
            keep_id=first_node_id
        )
        deleted_count = delete_result.single()["deleted"]

        return {
            "message": f"Cleanup completed. Kept 1 profile, deleted {deleted_count} duplicate(s).",
            "deleted": deleted_count,
            "remaining": 1
        }


def edit_profile_field(request: EditRequest) -> dict:
    """Generic edit dispatcher: routes by edit_type to appropriate handler."""
    db = clients.client["Scout_Agent"]
    collection = db["Market_Intelligence"]

    if request.edit_type == "modification":
        # Ensure user_id is in the modified_json before inserting (multitenancy)
        modified_doc = request.modified_json.copy()
        modified_doc["user_id"] = request.user_id
        # Add timestamp to ensure edited components are fetched as most recent
        modified_doc["timestamp"] = datetime.now(timezone.utc)

        # Insert modified JSON into MongoDB
        insert_result = collection.insert_one(modified_doc)
        return {
            "status": "success",
            "inserted_id": str(insert_result.inserted_id)
        }
    elif request.edit_type == "comment":
        # Placeholder for comment feature
        return {"status": "feature coming soon"}
    else:
        return {"error": "Invalid edit_type. Must be 'comment' or 'modification'."}
