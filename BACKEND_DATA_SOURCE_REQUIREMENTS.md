# Backend Data Source Integration Requirements

## Overview

This document outlines the backend endpoints and requirements needed to integrate the Data Source API functionality. Currently, the frontend works in **demo mode** (local storage only). When ready for production, implement these backend endpoints.

---

## Required Backend Endpoints

### 1. POST `/api/data-sources` - Create Data Source with Token Exchange

**Purpose**: Create a new data source, perform OAuth2 token exchange (if needed), and store credentials securely.

**Authentication**: Requires JWT token in Authorization header

**Request Headers**:
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "My API Source",
  "endpoint": "https://api.example.com/v1/data",
  "method": "GET",
  "authType": "oauth2",
  "credentials": {
    "clientId": "client-123",
    "clientSecret": "secret-456"
  },
  "headers": {
    "X-API-Version": "1.0",
    "Accept": "application/json"
  },
  "body": null,
  "scopes": ["read:data", "write:data"],
  "permissions": ["approved"],
  "type": "crm"
}
```

**Request Body Fields**:
- `name` (string, required): Name of the data source
- `endpoint` (string, required): API endpoint URL
- `method` (string, required): HTTP method (GET, POST, PUT, PATCH)
- `authType` (string, required): Authentication type - one of: `none`, `api_key`, `bearer`, `oauth2`, `basic`
- `credentials` (object, optional): Authentication credentials
  - For `api_key`/`bearer`: `{ "apiKey": "..." }`
  - For `oauth2`: `{ "clientId": "...", "clientSecret": "..." }`
  - For `basic`: `{ "username": "...", "password": "..." }`
- `headers` (object, optional): Custom HTTP headers as key-value pairs
- `body` (any, optional): Request body (for POST, PUT, PATCH)
- `scopes` (array, optional): OAuth2 scopes requested
- `permissions` (array, optional): User-approved permissions
- `type` (string, required): Data source type - one of: `crm`, `marketing`, `social`, `analytics`, `communication`, `custom`

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Data source created successfully. Token exchange completed.",
  "dataSource": {
    "id": "ds-123456",
    "name": "My API Source",
    "endpoint": "https://api.example.com/v1/data",
    "type": "crm",
    "status": "connected",
    "tokenExpiresAt": "2024-12-31T23:59:59Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

**Response (Error - 400)**:
```json
{
  "success": false,
  "message": "Failed to exchange token: Invalid client credentials",
  "error": "INVALID_CREDENTIALS"
}
```

**Response (Error - 401)**:
```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "UNAUTHORIZED"
}
```

**Response (Error - 500)**:
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "INTERNAL_ERROR"
}
```

---

### 2. POST `/api/data-sources/test` - Test Data Source Connection

**Purpose**: Test connection to an API endpoint without creating a data source.

**Authentication**: Requires JWT token in Authorization header

**Request Headers**:
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "endpoint": "https://api.example.com/v1/data",
  "method": "GET",
  "authType": "oauth2",
  "credentials": {
    "clientId": "client-123",
    "clientSecret": "secret-456"
  },
  "headers": {
    "X-API-Version": "1.0"
  },
  "body": null
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Connection successful",
  "statusCode": 200,
  "data": {}
}
```

**Response (Error - 400)**:
```json
{
  "success": false,
  "message": "Failed to connect: Invalid credentials",
  "error": "CONNECTION_FAILED"
}
```

---

### 3. GET `/api/data-sources` - List Data Sources

**Purpose**: Retrieve all data sources for the authenticated tenant.

**Authentication**: Requires JWT token in Authorization header

**Request Headers**:
```
Authorization: Bearer <jwt-token>
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "dataSources": [
    {
      "id": "ds-123456",
      "name": "My API Source",
      "endpoint": "https://api.example.com/v1/data",
      "method": "GET",
      "type": "crm",
      "status": "connected",
      "authType": "oauth2",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastSyncedAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

---

### 4. GET `/api/data-sources/:id` - Get Single Data Source

**Purpose**: Retrieve details of a specific data source.

**Authentication**: Requires JWT token in Authorization header

**Request Headers**:
```
Authorization: Bearer <jwt-token>
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "dataSource": {
    "id": "ds-123456",
    "name": "My API Source",
    "endpoint": "https://api.example.com/v1/data",
    "method": "GET",
    "type": "crm",
    "status": "connected",
    "authType": "oauth2",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastSyncedAt": "2024-01-01T12:00:00Z"
  }
}
```

**Response (Error - 404)**:
```json
{
  "success": false,
  "message": "Data source not found",
  "error": "NOT_FOUND"
}
```

---

### 5. PUT `/api/data-sources/:id` - Update Data Source

**Purpose**: Update an existing data source configuration.

**Authentication**: Requires JWT token in Authorization header

**Request Headers**:
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body**: (Same structure as POST `/api/data-sources`, all fields optional)

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Data source updated successfully",
  "dataSource": {
    "id": "ds-123456",
    "name": "Updated API Source",
    ...
  }
}
```

---

### 6. DELETE `/api/data-sources/:id` - Delete Data Source

**Purpose**: Delete a data source and revoke associated tokens.

**Authentication**: Requires JWT token in Authorization header

**Request Headers**:
```
Authorization: Bearer <jwt-token>
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Data source deleted successfully"
}
```

**Response (Error - 404)**:
```json
{
  "success": false,
  "message": "Data source not found",
  "error": "NOT_FOUND"
}
```

---

### 7. POST `/api/data-sources/:id/refresh-token` - Refresh OAuth2 Token

**Purpose**: Manually refresh an expired OAuth2 access token.

**Authentication**: Requires JWT token in Authorization header

**Request Headers**:
```
Authorization: Bearer <jwt-token>
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "tokenExpiresAt": "2024-12-31T23:59:59Z"
}
```

---

## OAuth2 Token Exchange Implementation

### Flow for OAuth2 Authentication

When `authType` is `oauth2`, the backend must:

1. **Extract OAuth2 credentials** from the request
2. **Determine token endpoint** from the API endpoint (may need configuration)
3. **Exchange credentials for access token**:
   ```javascript
   // Example: Client Credentials Grant Flow
   const tokenEndpoint = getTokenEndpoint(endpoint); // e.g., https://api.example.com/oauth/token
   
   const response = await fetch(tokenEndpoint, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/x-www-form-urlencoded',
     },
     body: new URLSearchParams({
       grant_type: 'client_credentials',
       client_id: clientId,
       client_secret: clientSecret,
       scope: scopes.join(' ')
     })
   });
   
   const tokenData = await response.json();
   ```

4. **Store encrypted tokens** in database:
   ```javascript
   const encryptedToken = encrypt(tokenData.access_token);
   const encryptedRefreshToken = encrypt(tokenData.refresh_token);
   
   await db.dataSources.create({
     tenantId: currentTenantId,
     userId: currentUserId,
     name: name,
     endpoint: endpoint,
     method: method,
     authType: 'oauth2',
     accessToken: encryptedToken,
     refreshToken: encryptedRefreshToken,
     expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
     scopes: scopes,
     // ... other fields
   });
   ```

5. **Return success response** with data source ID

### Token Refresh Logic

Implement automatic token refresh:
- Check token expiration before making API calls
- Refresh token if expires within 5 minutes
- Store new tokens encrypted
- Handle refresh failures gracefully

---

## Security Requirements

### 1. Credential Encryption
- **Encrypt all credentials** before storing in database
- Use AES-256 encryption or similar
- Store encryption keys securely (environment variables, key management service)
- Never log credentials or tokens

### 2. Token Storage
- Store access tokens encrypted
- Store refresh tokens encrypted
- Track token expiration dates
- Implement token rotation

### 3. Tenant Isolation
- Associate all data sources with tenant ID from JWT
- Verify tenant access on all operations
- Users can only access/modify their tenant's data sources

### 4. Input Validation
- Validate all endpoint URLs (must be HTTPS in production)
- Sanitize all user inputs
- Validate JSON structures (headers, body)
- Validate authentication type enum values

### 5. Rate Limiting
- Limit token exchange requests per tenant
- Limit test connection requests
- Implement exponential backoff for failures

### 6. Error Handling
- Never expose sensitive error details to frontend
- Log errors securely on backend
- Return user-friendly error messages

---

## Database Schema Recommendations

### Data Sources Table

```sql
CREATE TABLE data_sources (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  endpoint TEXT NOT NULL,
  method VARCHAR(10) NOT NULL,
  auth_type VARCHAR(50) NOT NULL,
  encrypted_credentials TEXT, -- Encrypted JSON of credentials
  encrypted_access_token TEXT, -- For OAuth2
  encrypted_refresh_token TEXT, -- For OAuth2
  token_expires_at TIMESTAMP,
  headers JSON,
  scopes JSON,
  type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'disconnected',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_user_id (user_id)
);
```

---

## Environment Variables

```env
# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here

# OAuth2 Configuration (if needed)
OAUTH2_DEFAULT_TOKEN_ENDPOINT=https://api.example.com/oauth/token

# Rate Limiting
RATE_LIMIT_TOKEN_EXCHANGE=10  # requests per hour per tenant
RATE_LIMIT_TEST_CONNECTION=20  # requests per hour per tenant
```

---

## Testing Endpoints

### Test Create Data Source (OAuth2)
```bash
curl -X POST https://your-backend.com/api/data-sources \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test API Source",
    "endpoint": "https://api.example.com/v1/data",
    "method": "GET",
    "authType": "oauth2",
    "credentials": {
      "clientId": "test-client-id",
      "clientSecret": "test-client-secret"
    },
    "scopes": ["read:data"],
    "permissions": ["approved"],
    "type": "custom"
  }'
```

### Test Connection
```bash
curl -X POST https://your-backend.com/api/data-sources/test \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://api.example.com/v1/data",
    "method": "GET",
    "authType": "api_key",
    "credentials": {
      "apiKey": "test-api-key"
    }
  }'
```

### List Data Sources
```bash
curl -X GET https://your-backend.com/api/data-sources \
  -H "Authorization: Bearer <jwt-token>"
```

---

## Frontend Integration Notes

### Current Implementation (Demo Mode)

The frontend currently:
- ✅ Validates all inputs locally
- ✅ Stores data sources in React state (temporary)
- ✅ Simulates token exchange with delays
- ✅ Shows success/error messages

### When Backend is Ready

Update these functions in `MissionControl.tsx`:

1. **`handleTestApiConnection`**: Replace simulation with:
   ```typescript
   const result = await ApiService.testDataSourceConnection({...});
   ```

2. **`handleAddApiResource`**: Replace simulation with:
   ```typescript
   const result = await ApiService.createDataSource({...});
   ```

3. **Load data sources on mount**: Add:
   ```typescript
   useEffect(() => {
     const loadDataSources = async () => {
       const result = await ApiService.getDataSources();
       if (result.success) {
         setDataSources(result.dataSources);
       }
     };
     loadDataSources();
   }, []);
   ```

---

## Priority Implementation Order

1. **Phase 1 (Critical)**:
   - POST `/api/data-sources` - Create with token exchange
   - POST `/api/data-sources/test` - Test connection
   - GET `/api/data-sources` - List sources

2. **Phase 2 (Important)**:
   - GET `/api/data-sources/:id` - Get single source
   - PUT `/api/data-sources/:id` - Update source
   - DELETE `/api/data-sources/:id` - Delete source

3. **Phase 3 (Enhancement)**:
   - POST `/api/data-sources/:id/refresh-token` - Manual refresh
   - Automatic token refresh background job
   - Data source sync scheduling

---

## Support

For questions or clarifications:
- Check frontend code in `production/friendly-sales-canvas/src/pages/MissionControl.tsx`
- Review API service in `production/friendly-sales-canvas/src/services/api.ts`
- See existing JWT integration in `BACKEND_INTEGRATION_REQUIREMENTS.md`
















