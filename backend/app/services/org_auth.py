"""Org / auth / registration service. HTTP-free business logic."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List

from app.core import clients
from app.core.exceptions import OrgNotFoundError, UsersDocumentNotFoundError
from app.models.org_auth import RegistrationRequest, RegistrationResponse


def list_orgs(user_id: str) -> Dict:
    """
    Get org_id and org_name for a given user_id.
    Fetches from MongoDB users collection (single document) and orgs collection for org_name.
    """
    db = clients.client["Org_Management"]
    users_collection = db["users"]
    orgs_collection = db["orgs"]

    # Get the single users document
    users_doc = users_collection.find_one({"_id": "users"})

    if not users_doc:
        raise UsersDocumentNotFoundError("Users document not found")

    # Get user_id to org_id mapping
    user_mappings = users_doc.get("user_mappings", {})
    org_id = user_mappings.get(user_id)

    if not org_id:
        raise OrgNotFoundError(f"No org_id found for user_id: {user_id}")

    # Get org_name from orgs collection
    org_name = None
    orgs_doc = orgs_collection.find_one({"_id": "orgs"})
    if orgs_doc:
        org_names = orgs_doc.get("org_names", {})
        org_name = org_names.get(org_id)

    response = {
        "status": "success",
        "user_id": user_id,
        "org_id": org_id
    }
    if org_name:
        response["org_name"] = org_name

    return response


def create_org(request: dict) -> Dict:
    """
    Generate a new org_id and save it to MongoDB orgs collection (single document).
    Optionally accepts org_name to link with the org_id.
    Returns the newly created org_id and org_name (if provided).
    """
    # Extract org_name from request body (optional)
    org_name = None
    if request and "org_name" in request:
        org_name = request.get("org_name")

    # Generate new org_id
    new_org_id = str(uuid.uuid4())

    db = clients.client["Org_Management"]
    collection = db["orgs"]

    # Get or create the single orgs document
    orgs_doc = collection.find_one({"_id": "orgs"})

    if orgs_doc:
        # Add new org_id to existing list
        org_list = orgs_doc.get("org_list", [])
        if new_org_id not in org_list:
            org_list.append(new_org_id)

        # Update org_names mapping if org_name is provided
        org_names = orgs_doc.get("org_names", {})
        if org_name:
            org_names[new_org_id] = org_name

        collection.update_one(
            {"_id": "orgs"},
            {
                "$set": {
                    "org_list": org_list,
                    "org_names": org_names,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
    else:
        # Create new document with the org_id
        org_data = {
            "_id": "orgs",
            "org_list": [new_org_id],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        if org_name:
            org_data["org_names"] = {new_org_id: org_name}
        collection.insert_one(org_data)

    response = {
        "status": "success",
        "message": "Org created successfully",
        "org_id": new_org_id
    }
    if org_name:
        response["org_name"] = org_name

    return response


def connect_user_to_org(user_id: str, org_id: str) -> Dict:
    """
    Connect a user_id to an org_id.
    Saves the mapping in MongoDB users collection (single document).
    """
    db = clients.client["Org_Management"]
    collection = db["users"]

    # Get or create the single users document
    users_doc = collection.find_one({"_id": "users"})

    if users_doc:
        # Update existing user_mappings
        user_mappings = users_doc.get("user_mappings", {})
        user_mappings[user_id] = org_id

        collection.update_one(
            {"_id": "users"},
            {
                "$set": {
                    "user_mappings": user_mappings,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
    else:
        # Create new document with the mapping
        collection.insert_one({
            "_id": "users",
            "user_mappings": {user_id: org_id},
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        })

    return {
        "status": "success",
        "message": f"User {user_id} connected to org {org_id}",
        "user_id": user_id,
        "org_id": org_id
    }


def list_registrations() -> List[RegistrationResponse]:
    """
    Fetches all registration entries ordered by recency (most recent first).
    Uses separate database 'Registration_DB' and collection 'registrations'.
    """
    # Connect to separate registration database
    db = clients.client["Registration_DB"]
    collection = db["registrations"]

    # Fetch all registrations ordered by timestamp (descending - most recent first)
    registrations = collection.find().sort("timestamp", -1)

    # Convert to response format
    result = []
    for reg in registrations:
        result.append(RegistrationResponse(
            id=str(reg["_id"]),
            name=reg["name"],
            email=reg["email"],
            timestamp=reg["timestamp"].isoformat() if isinstance(reg["timestamp"], datetime) else reg["timestamp"]
        ))

    return result


def create_registration(registration: RegistrationRequest) -> RegistrationResponse:
    """
    Creates a new registration entry in MongoDB.
    Uses separate database 'Registration_DB' and collection 'registrations'.
    """
    # Connect to separate registration database
    db = clients.client["Registration_DB"]
    collection = db["registrations"]

    # Create registration document with timestamp
    registration_doc = {
        "name": registration.name,
        "email": registration.email,
        "timestamp": datetime.now(timezone.utc)
    }

    # Insert the document
    result = collection.insert_one(registration_doc)

    # Return the created registration
    return RegistrationResponse(
        id=str(result.inserted_id),
        name=registration.name,
        email=registration.email,
        timestamp=registration_doc["timestamp"].isoformat()
    )
