"""Admin auth — Firebase ID-token verification + operator allowlist.

The `/admin` router is the ONE place the backend enforces caller identity.
Everywhere else the backend trusts client-supplied IDs (see CLAUDE.md "Auth
reality"); this is a deliberate, scoped exception for the internal ops console
(spec 44 / TD-FE-79). Verification uses only PUBLIC inputs — the Firebase
project id and Google's public signing keys — so no service-account secret is
required. Reused parity/inspection endpoints stay open (global posture).
"""
import os
from typing import Any, Dict

import jwt
from fastapi import Header
from jwt import PyJWKClient

from app.core.exceptions import AuthenticationError, AuthorizationError

# Public Firebase project (matches frontend/src/shared/auth/firebase.ts). Not a
# secret; overridable via env for other environments.
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "multi-tenant-50161")
_ISSUER = f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}"
# Google's public JWKS for Firebase Secure Token service.
_JWKS_URI = (
    "https://www.googleapis.com/service_accounts/v1/jwk/"
    "securetoken@system.gserviceaccount.com"
)

# Brewra operators allowed to use the internal ops console. Lowercased; compared
# case-insensitively. Mirrors frontend/src/features/admin/adminAllowlist.ts
# (the two lists are kept in sync by hand — the FE/BE boundary forbids sharing).
ADMIN_EMAILS = {
    "gaurav@brewra.com",
    "shilpa@brewra.com",
    "ishani@brewra.com",
    "mortenevensen@brewra.com",
    "sunnyghosh@brewra.com",
}

# PyJWKClient caches the fetched signing keys (Google rotates them ~daily).
# Construction is lazy — no network call until the first verification.
_jwk_client = PyJWKClient(_JWKS_URI)


def verify_firebase_id_token(token: str) -> Dict[str, Any]:
    """Verify a Firebase ID token's signature, audience, issuer and expiry, and
    return its decoded claims. Raises AuthenticationError on any failure."""
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=_ISSUER,
        )
    except Exception as exc:  # noqa: BLE001 — any verify failure is an auth failure
        raise AuthenticationError(f"invalid Firebase ID token: {exc}") from exc


def require_admin(authorization: str = Header(default="")) -> Dict[str, Any]:
    """FastAPI dependency for the /admin router. Verifies the bearer token and
    requires an allowlisted operator email.

    → 401 if the token is missing or invalid; → 403 if verified but not an
    operator. Returns the decoded claims on success.
    """
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise AuthenticationError("missing bearer token")
    claims = verify_firebase_id_token(authorization[len(prefix):])
    email = (claims.get("email") or "").lower()
    if email not in ADMIN_EMAILS:
        raise AuthorizationError(f"{email or 'caller'} is not an authorized operator")
    return claims
