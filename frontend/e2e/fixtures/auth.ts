import { TEST_USER_ID, TEST_ORG_ID } from './identities';

export const mockAuthState = {
  auth_token: 'mock_jwt_token',
  user_id: TEST_USER_ID,
  org_id: TEST_ORG_ID,
  selected_tenant: { id: TEST_ORG_ID, name: 'Test Org' },
};

export const firebaseSignInResponse = {
  idToken: 'mock_firebase_token',
  email: 'test@brewra.test',
  localId: TEST_USER_ID,
  registered: true,
  refreshToken: 'mock_refresh_token',
  expiresIn: '3600',
};
