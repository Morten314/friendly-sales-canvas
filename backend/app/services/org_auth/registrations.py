"""Registration entries — cross-tenant admin view + per-user registration creation."""
from datetime import datetime, timezone
from typing import List

from app.models.org_auth import RegistrationRequest, RegistrationResponse


def list_registrations(
    mongo,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[RegistrationResponse], int]:
    """Cross-tenant admin view of registrations, paginated.

    No org_id filter — see spec §2.1 #2. Uses separate database
    'Registration_DB' and collection 'registrations'.
    """
    db = mongo["Registration_DB"]
    collection = db["registrations"]
    flt: dict = {}

    total = collection.count_documents(flt)
    cursor = collection.find(flt).sort("timestamp", -1).skip(offset).limit(limit)

    result: List[RegistrationResponse] = []
    for reg in cursor:
        result.append(RegistrationResponse(
            id=str(reg["_id"]),
            name=reg["name"],
            email=reg["email"],
            timestamp=reg["timestamp"].isoformat() if isinstance(reg["timestamp"], datetime) else reg["timestamp"],
        ))

    return result, total


def create_registration(mongo, registration: RegistrationRequest) -> RegistrationResponse:
    """
    Creates a new registration entry in MongoDB.
    Uses separate database 'Registration_DB' and collection 'registrations'.
    """
    # Connect to separate registration database
    db = mongo["Registration_DB"]
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
