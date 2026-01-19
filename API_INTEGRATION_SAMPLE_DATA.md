# API Integration Sample Data

This document provides sample data for testing the API Integration feature. Use these examples to fill in the form fields.

---

## Example 1: Public API (No Authentication) - JSONPlaceholder

**Use Case**: Testing basic API connection without authentication

### Form Fields:
- **Source Name**: `JSONPlaceholder API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://jsonplaceholder.typicode.com/posts`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**: (leave empty or use):
  ```json
  {
    "Accept": "application/json"
  }
  ```
- **Request Body**: (leave empty for GET)

---

## Example 2: API Key Authentication - Example API

**Use Case**: Testing API with API key authentication

### Form Fields:
- **Source Name**: `Example API with Key`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://api.example.com/v1/data`
- **HTTP Method**: `GET`
- **Authentication Type**: `API Key`
- **API Key**: `sk_live_1234567890abcdefghijklmnopqrstuvwxyz`
- **Custom Headers**: (optional)
  ```json
  {
    "X-API-Version": "1.0",
    "Accept": "application/json"
  }
  ```
- **Request Body**: (leave empty for GET)

---

## Example 3: Bearer Token Authentication

**Use Case**: Testing API with Bearer token authentication

### Form Fields:
- **Source Name**: `Bearer Token API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://api.example.com/v1/users`
- **HTTP Method**: `GET`
- **Authentication Type**: `Bearer Token`
- **Bearer Token**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`
- **Custom Headers**: (optional)
  ```json
  {
    "Accept": "application/json",
    "Content-Type": "application/json"
  }
  ```
- **Request Body**: (leave empty for GET)

---

## Example 4: OAuth2 Authentication - Full Example

**Use Case**: Testing OAuth2 token exchange flow

### Form Fields:
- **Source Name**: `OAuth2 API Integration`
- **Source Type**: `CRM`
- **API Endpoint URL**: `https://api.example.com/v1/contacts`
- **HTTP Method**: `GET`
- **Authentication Type**: `OAuth2`
- **Client ID**: `your-client-id-12345`
- **Client Secret**: `your-client-secret-abcdefghijklmnop`
- **Requested Permissions (Scopes)**: 
  - ✅ `read`
  - ✅ `read:data`
  - ✅ `write:data`
- **Permissions Approval**: ✅ Check the approval checkbox
- **Custom Headers**: (optional)
  ```json
  {
    "Accept": "application/json",
    "X-API-Version": "2.0"
  }
  ```
- **Request Body**: (leave empty for GET)

---

## Example 5: POST Request with Body

**Use Case**: Testing POST request with JSON body

### Form Fields:
- **Source Name**: `Create User API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://api.example.com/v1/users`
- **HTTP Method**: `POST`
- **Authentication Type**: `Bearer Token`
- **Bearer Token**: `your-bearer-token-here`
- **Custom Headers**: 
  ```json
  {
    "Content-Type": "application/json",
    "Accept": "application/json"
  }
  ```
- **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "user",
    "active": true
  }
  ```

---

## Example 6: OAuth2 with Multiple Scopes

**Use Case**: OAuth2 with comprehensive permissions

### Form Fields:
- **Source Name**: `Full Access OAuth2 API`
- **Source Type**: `Marketing`
- **API Endpoint URL**: `https://api.marketing-platform.com/v1/campaigns`
- **HTTP Method**: `GET`
- **Authentication Type**: `OAuth2`
- **Client ID**: `marketing_client_abc123`
- **Client Secret**: `marketing_secret_xyz789`
- **Requested Permissions (Scopes)**: 
  - ✅ `read`
  - ✅ `write`
  - ✅ `read:data`
  - ✅ `write:data`
  - ✅ `admin`
- **Permissions Approval**: ✅ Check the approval checkbox
- **Custom Headers**: 
  ```json
  {
    "Accept": "application/json",
    "X-Request-ID": "req-12345"
  }
  ```
- **Request Body**: (leave empty for GET)

---

## Example 7: PUT Request for Update

**Use Case**: Testing PUT request to update data

### Form Fields:
- **Source Name**: `Update Contact API`
- **Source Type**: `CRM`
- **API Endpoint URL**: `https://api.crm.com/v1/contacts/12345`
- **HTTP Method**: `PUT`
- **Authentication Type**: `API Key`
- **API Key**: `crm_api_key_abcdef123456`
- **Custom Headers**: 
  ```json
  {
    "Content-Type": "application/json",
    "X-API-Key": "crm_api_key_abcdef123456"
  }
  ```
- **Request Body**:
  ```json
  {
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com",
    "phone": "+1234567890",
    "status": "active"
  }
  ```

---

## Example 8: PATCH Request

**Use Case**: Testing PATCH request for partial updates

### Form Fields:
- **Source Name**: `Patch User API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://api.example.com/v1/users/789`
- **HTTP Method**: `PATCH`
- **Authentication Type**: `Bearer Token`
- **Bearer Token**: `your-bearer-token-here`
- **Custom Headers**: 
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- **Request Body**:
  ```json
  {
    "status": "inactive",
    "lastLogin": "2024-01-15T10:30:00Z"
  }
  ```

---

## Example 9: Real-World API - GitHub (Bearer Token)

**Use Case**: Connecting to GitHub API (requires personal access token)

### Form Fields:
- **Source Name**: `GitHub API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://api.github.com/user`
- **HTTP Method**: `GET`
- **Authentication Type**: `Bearer Token`
- **Bearer Token**: `ghp_your_github_personal_access_token_here`
- **Custom Headers**: 
  ```json
  {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Brewra-Integration/1.0"
  }
  ```
- **Request Body**: (leave empty for GET)

**Note**: Replace `ghp_your_github_personal_access_token_here` with your actual GitHub personal access token.

---

## Example 10: OAuth2 - Salesforce Style

**Use Case**: OAuth2 integration similar to Salesforce

### Form Fields:
- **Source Name**: `Salesforce API Integration`
- **Source Type**: `CRM`
- **API Endpoint URL**: `https://yourinstance.salesforce.com/services/data/v58.0/sobjects/Account/`
- **HTTP Method**: `GET`
- **Authentication Type**: `OAuth2`
- **Client ID**: `3MVG9fMtCkV6eLheIEZplMqWfnGlf3Y.BcWdOf1qytXo9zxgbsrUbS.ExHTgUPJeb3jZeT8NYhc.h7zn7XX7n`
- **Client Secret**: `1234567890123456789`
- **Requested Permissions (Scopes)**: 
  - ✅ `read`
  - ✅ `read:data`
  - ✅ `write:data`
- **Permissions Approval**: ✅ Check the approval checkbox
- **Custom Headers**: 
  ```json
  {
    "Accept": "application/json",
    "Content-Type": "application/json"
  }
  ```
- **Request Body**: (leave empty for GET)

---

## Quick Reference: Common Field Values

### Source Types:
- `Custom`
- `CRM`
- `Marketing`
- `Social`
- `Analytics`
- `Communication`

### HTTP Methods:
- `GET` - Retrieve data
- `POST` - Create new resource
- `PUT` - Update entire resource
- `PATCH` - Partial update

### Authentication Types:
- `None` - No authentication required
- `API Key` - Simple API key authentication
- `Bearer Token` - Bearer token in Authorization header
- `OAuth2` - OAuth2 with client credentials flow
- `Basic Auth` - Username/password (not yet implemented in UI)

### Common Headers:
```json
{
  "Accept": "application/json",
  "Content-Type": "application/json",
  "User-Agent": "Brewra-Integration/1.0",
  "X-API-Version": "1.0",
  "X-Request-ID": "unique-request-id"
}
```

### Common Request Body Examples:

**Create User**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user"
}
```

**Update Contact**:
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "+1234567890"
}
```

**Search/Filter**:
```json
{
  "filters": {
    "status": "active",
    "createdAfter": "2024-01-01"
  },
  "limit": 100,
  "offset": 0
}
```

---

## Testing Tips

1. **Start Simple**: Use Example 1 (no authentication) to test basic functionality
2. **Test Each Auth Type**: Try different authentication types to see how the form adapts
3. **Validate JSON**: Make sure custom headers and request body are valid JSON
4. **Use Test Endpoints**: For demo, you can use public test APIs like:
   - `https://jsonplaceholder.typicode.com/posts`
   - `https://httpbin.org/get`
   - `https://api.github.com/zen` (no auth needed)

5. **OAuth2 Demo**: For OAuth2, the form will simulate token exchange. In production, real credentials would be needed.

---

## Notes

- All sample credentials are **examples only** - replace with real credentials for actual API connections
- In **demo mode**, the system simulates token exchange and connection testing
- When backend is integrated, real API calls will be made
- Always use HTTPS endpoints in production
- Never commit real API keys or secrets to version control
















