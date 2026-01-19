# API Integration Guide - How REAL_WORLD_API_EXAMPLES.md Connects to Your Project

## Overview

The `REAL_WORLD_API_EXAMPLES.md` file is a **reference guide** containing working examples of real-world APIs that you can use to test and configure the **API Integration feature** in your Mission Control dashboard.

---

## What is the API Integration Feature?

Your project has a **Data Sources** feature in the Mission Control page that allows users to:

1. **Connect to external APIs** - Add custom API endpoints as data sources
2. **Configure authentication** - Set up API keys, Bearer tokens, OAuth2, or no authentication
3. **Test connections** - Verify API endpoints work before adding them
4. **Manage data sources** - View, sync, and delete connected APIs

---

## How REAL_WORLD_API_EXAMPLES.md is Used

### Purpose

The examples file serves as a **quick reference** for:

1. **Testing the API Integration UI** - Use these real APIs to test your form
2. **Demonstrating functionality** - Show clients how the feature works with real endpoints
3. **Learning API configuration** - Understand how to format different API types
4. **No setup required** - Many examples work immediately without API keys

### Where It's Used

The examples from this file are **manually entered** into the API Integration form in your Mission Control dashboard:

**Location**: `Mission Control` → `Data Sources` tab → `Add Source` → `API Integration` mode

---

## How to Use These Examples in Your Project

### Step 1: Navigate to API Integration Form

1. Open your application
2. Go to **Mission Control** page
3. Click on **Data Sources** tab
4. Click **"Add Source"** button
5. Select **"API Integration"** mode

### Step 2: Fill in the Form Using an Example

Let's use **Example 1: JSONPlaceholder** as a demonstration:

#### Form Fields to Fill:

- **Source Name**: `JSONPlaceholder Posts API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://jsonplaceholder.typicode.com/posts`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**: 
  ```json
  {
    "Accept": "application/json"
  }
  ```
- **Request Body**: (leave empty for GET requests)

### Step 3: Test the Connection

1. Click **"Test Connection"** button
2. The system will:
   - Send a request to `/api/data-sources/test` endpoint
   - Your backend will make the actual API call
   - Return success/failure status

### Step 4: Add as Data Source

1. If test succeeds, click **"Add Source"**
2. The system will:
   - Send request to `/api/data-sources` endpoint
   - Backend creates the data source
   - Performs OAuth2 token exchange (if needed)
   - Stores credentials securely
   - Returns data source ID

3. The new source appears in your **Data Sources table**

---

## Technical Flow: How It Connects

### Frontend Flow (MissionControl.tsx)

```typescript
// 1. User fills form with API details from REAL_WORLD_API_EXAMPLES.md
const handleAddApiResource = async () => {
  // 2. Validates form fields
  // 3. Calls ApiService.createDataSource()
  const result = await ApiService.createDataSource({
    name: apiResourceName,
    endpoint: apiEndpoint,  // From examples file
    method: apiMethod,
    authType: authType,
    credentials: {...},
    headers: {...},
    body: {...}
  });
  
  // 4. Adds to dataSources state
  setDataSources(prev => [...prev, newSource]);
}
```

### API Service Flow (api.ts)

```typescript
// ApiService.createDataSource() sends to backend
async createDataSource(data) {
  return this.post('/data-sources', data);
  // POST /api/data-sources
  // Headers: Authorization: Bearer <jwt-token>
  // Body: { name, endpoint, method, authType, credentials, ... }
}
```

### Backend Flow (Expected)

According to `BACKEND_INTEGRATION_REQUIREMENTS.md`, your backend should:

1. **Receive request** at `POST /api/data-sources`
2. **Validate JWT token** from Authorization header
3. **Extract tenant ID** from JWT
4. **For OAuth2**: Exchange client credentials for access token
5. **Encrypt and store** credentials in database
6. **Associate** data source with tenant
7. **Return** data source ID and status

---

## Why These APIs Are Used

### 1. **Testing Without Setup**
Many examples (JSONPlaceholder, HTTPBin, REST Countries) work **immediately** without:
- API keys
- Account registration
- Complex authentication

### 2. **Real-World Scenarios**
Examples cover different use cases:
- **GET requests** - Fetching data (JSONPlaceholder, REST Countries)
- **POST requests** - Creating data (JSONPlaceholder POST)
- **Authentication types** - None, API Key, Bearer, OAuth2
- **Different data formats** - JSON responses

### 3. **Educational Purpose**
Shows developers how to:
- Format API endpoints
- Structure headers (JSON format)
- Configure request bodies
- Handle different HTTP methods

### 4. **Demo-Ready**
Perfect for client demonstrations because:
- They work reliably
- No sensitive credentials needed
- Clear, understandable responses
- Professional appearance

---

## Example Use Cases

### Use Case 1: Testing the Form

**Goal**: Verify the API integration form works correctly

**Example to Use**: JSONPlaceholder Posts API (Example 1)

**Steps**:
1. Copy endpoint: `https://jsonplaceholder.typicode.com/posts`
2. Paste into form
3. Select `GET` method
4. Select `None` authentication
5. Click "Test Connection"
6. Should return success

### Use Case 2: Demonstrating OAuth2

**Goal**: Show OAuth2 authentication flow

**Example to Use**: GitHub API with Personal Access Token (Example 13)

**Steps**:
1. Get GitHub token from GitHub settings
2. Enter endpoint: `https://api.github.com/user`
3. Select `Bearer Token` authentication
4. Enter token
5. Test connection

### Use Case 3: Real Business Data

**Goal**: Connect to actual business API

**Example to Use**: Your own company API

**Steps**:
1. Use your real API endpoint
2. Configure authentication (API key, OAuth2, etc.)
3. Add custom headers if needed
4. Test and add as data source

---

## Data Source Lifecycle

Once added, a data source from the examples:

1. **Appears in Data Sources table**
   - Shows name, type, status
   - Displays connection status (Connected/Disconnected)

2. **Can be synced**
   - Manual sync via "Sync Now"
   - Automatic sync based on frequency (daily, hourly, etc.)

3. **Data is fetched**
   - Backend makes API calls using stored credentials
   - Data is stored in your database
   - Associated with tenant ID

4. **Used in components**
   - Market research components can use this data
   - Analytics dashboards can display it
   - Reports can include it

---

## Current Status

### ✅ What's Working

- **Frontend form** - API integration UI is implemented
- **Form validation** - Validates URLs, JSON headers, etc.
- **Test connection** - Can test API endpoints
- **Add data source** - Creates data source entries

### ⚠️ What Needs Backend

According to your terminal logs, you're seeing:
```
Received Response from the Target: 404 /auth/token
```

This means:

1. **Backend endpoints not implemented yet**:
   - `POST /api/data-sources` - Create data source
   - `POST /api/data-sources/test` - Test connection
   - `GET /api/data-sources` - List data sources
   - `DELETE /api/data-sources/:id` - Delete data source

2. **JWT token endpoint missing**:
   - `POST /api/auth/token` - Returns 404

### 🔧 Next Steps

1. **Implement backend endpoints** (see `BACKEND_INTEGRATION_REQUIREMENTS.md`)
2. **Test with examples** from `REAL_WORLD_API_EXAMPLES.md`
3. **Verify OAuth2 token exchange** works
4. **Test data fetching** from connected sources

---

## Quick Reference: Copy-Paste Examples

### Simplest Test (No Auth)
```
Source Name: JSONPlaceholder Test
Endpoint: https://jsonplaceholder.typicode.com/posts
Method: GET
Auth: None
```

### With Headers
```
Source Name: HTTPBin Test
Endpoint: https://httpbin.org/get
Method: GET
Auth: None
Headers: {"X-Test-Header": "Brewra-Integration", "Accept": "application/json"}
```

### POST Request
```
Source Name: JSONPlaceholder Create
Endpoint: https://jsonplaceholder.typicode.com/posts
Method: POST
Auth: None
Headers: {"Content-Type": "application/json"}
Body: {"title": "Test Post", "body": "Test content", "userId": 1}
```

---

## Summary

**REAL_WORLD_API_EXAMPLES.md** is a **reference document** that provides:

1. ✅ **Working API examples** you can test immediately
2. ✅ **Configuration templates** for different API types
3. ✅ **Step-by-step instructions** for each example
4. ✅ **No setup required** for most examples

**How to use it**:
1. Open Mission Control → Data Sources
2. Click "Add Source" → "API Integration"
3. Copy values from an example
4. Paste into the form
5. Test and add as data source

**Why it's useful**:
- Tests your API integration feature
- Demonstrates functionality to clients
- Provides real-world API patterns
- No complex setup needed

---

## Related Files

- `REAL_WORLD_API_EXAMPLES.md` - This reference guide
- `CRM_API_INTEGRATION_GUIDE.md` - **How to connect HubSpot, Salesforce, and other CRMs via API**
- `BACKEND_INTEGRATION_REQUIREMENTS.md` - Backend implementation specs
- `src/pages/MissionControl.tsx` - Frontend implementation
- `src/services/api.ts` - API service layer

---

## Questions?

If you need help:
1. Check `BACKEND_INTEGRATION_REQUIREMENTS.md` for backend specs
2. Review `MissionControl.tsx` for frontend implementation
3. Test with simple examples first (JSONPlaceholder)
4. Check browser console for error messages

