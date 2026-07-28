import { TEST_USER_ID, TEST_ORG_ID } from "./identities";

/**
 * UID-keyed localStorage entries that AuthContext.tsx and TenantContext.tsx
 * actually read. Seeded by `loginAsTestUser` BEFORE Firebase fires
 * `onAuthStateChanged` so the contexts find the org/tenant immediately
 * (avoiding a fetch to /api/org during the login flow).
 *
 * Real keys (verified against frontend/src/contexts/AuthContext.tsx and
 * TenantContext.tsx as of 2026-05-08):
 *   org_id_${uid}, org_name_${uid}, selectedTenant_${uid}, jwt_token
 */
export const seededAuthEntries = {
  [`org_id_${TEST_USER_ID}`]: TEST_ORG_ID,
  [`org_name_${TEST_USER_ID}`]: "Test Org",
  [`selectedTenant_${TEST_USER_ID}`]: JSON.stringify({
    id: TEST_ORG_ID,
    name: "Test Org",
  }),
  jwt_token: "mock_jwt_token",
};

export const firebaseSignInResponse = {
  idToken: "mock_firebase_token",
  email: "test@brewra.test",
  localId: TEST_USER_ID,
  registered: true,
  refreshToken: "mock_refresh_token",
  expiresIn: "3600",
};
