# CRM Platform API Integration Guide

## Overview

Yes! You can connect CRM platforms like **HubSpot**, **Salesforce**, **Pipedrive**, and **Zoho CRM** through the **API Integration** feature. This guide shows you exactly how to do it.

---

## Two Ways to Connect CRM Platforms

### Option 1: Pre-Built Connectors (Current Implementation)
- **Location**: Mission Control → Data Sources → "Add Source" → Quick Add
- **Method**: Email/Password authentication (simplified UI)
- **Platforms**: Salesforce, HubSpot, Pipedrive, Zoho (already in your app)
- **Status**: Uses custom auth modals

### Option 2: API Integration (Recommended for Production)
- **Location**: Mission Control → Data Sources → "Add Source" → "API Integration" mode
- **Method**: OAuth2 or API Key authentication (direct API access)
- **Platforms**: Any CRM with REST API
- **Status**: More flexible, uses actual API endpoints

---

## Why Use API Integration for CRM?

✅ **More Control**: Direct access to API endpoints  
✅ **OAuth2 Support**: Secure token-based authentication  
✅ **Custom Endpoints**: Use specific API endpoints for your needs  
✅ **Production Ready**: Uses actual CRM APIs, not simplified flows  
✅ **Flexible**: Works with any CRM that has a REST API  

---

## HubSpot API Integration

### Step 1: Get HubSpot API Credentials

1. Go to **HubSpot** → **Settings** → **Integrations** → **Private Apps**
2. Create a new **Private App**
3. Select scopes:
   - `contacts.read`
   - `contacts.write`
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
4. Copy your **API Key** (starts with `pat-`)

### Step 2: Configure in Your App

**In Mission Control → Data Sources → Add Source → API Integration:**

#### For HubSpot Contacts API:
```
Source Name: HubSpot Contacts API
Source Type: CRM
API Endpoint URL: https://api.hubapi.com/crm/v3/objects/contacts
HTTP Method: GET
Authentication Type: Bearer Token
Bearer Token: pat-your-hubspot-api-key-here
Custom Headers:
{
  "Content-Type": "application/json"
}
Request Body: (leave empty for GET)
```

#### For HubSpot Companies API:
```
Source Name: HubSpot Companies API
API Endpoint URL: https://api.hubapi.com/crm/v3/objects/companies
HTTP Method: GET
Authentication Type: Bearer Token
Bearer Token: pat-your-hubspot-api-key-here
```

#### For HubSpot Deals API:
```
Source Name: HubSpot Deals API
API Endpoint URL: https://api.hubapi.com/crm/v3/objects/deals
HTTP Method: GET
Authentication Type: Bearer Token
Bearer Token: pat-your-hubspot-api-key-here
```

### Step 3: Test and Add

1. Click **"Test Connection"** to verify
2. If successful, click **"Add Source"**
3. HubSpot will appear in your Data Sources table

---

## Salesforce API Integration

### Step 1: Get Salesforce API Credentials

1. Go to **Salesforce Setup** → **App Manager** → **New Connected App**
2. Enable **OAuth Settings**
3. Set **Callback URL**: `https://your-app.com/oauth/callback`
4. Select **OAuth Scopes**:
   - `Full access (full)`
   - `Perform requests on your behalf at any time (refresh_token, offline_access)`
5. Save and copy:
   - **Consumer Key** (Client ID)
   - **Consumer Secret** (Client Secret)

### Step 2: Configure in Your App

**In Mission Control → Data Sources → Add Source → API Integration:**

#### For Salesforce REST API (OAuth2):
```
Source Name: Salesforce REST API
Source Type: CRM
API Endpoint URL: https://your-instance.salesforce.com/services/data/v58.0/sobjects/Contact
HTTP Method: GET
Authentication Type: OAuth2
Client ID: your-consumer-key
Client Secret: your-consumer-secret
OAuth Scopes: 
  - full
  - refresh_token
  - offline_access
Custom Headers:
{
  "Content-Type": "application/json"
}
Request Body: (leave empty for GET)
```

**Note**: For OAuth2, your backend will handle the token exchange automatically.

#### For Salesforce with Access Token (Bearer):
If you already have an access token:

```
Source Name: Salesforce Contacts
API Endpoint URL: https://your-instance.salesforce.com/services/data/v58.0/query?q=SELECT+Id,Name,Email+FROM+Contact
HTTP Method: GET
Authentication Type: Bearer Token
Bearer Token: your-salesforce-access-token
```

### Step 3: Test and Add

1. Click **"Test Connection"**
2. Backend will exchange OAuth2 credentials for access token
3. If successful, click **"Add Source"**

---

## Pipedrive API Integration

### Step 1: Get Pipedrive API Token

1. Go to **Pipedrive** → **Settings** → **Personal** → **API**
2. Copy your **API Token**

### Step 2: Configure in Your App

```
Source Name: Pipedrive Deals API
Source Type: CRM
API Endpoint URL: https://api.pipedrive.com/v1/deals?api_token=YOUR_API_TOKEN
HTTP Method: GET
Authentication Type: None (token in URL)
Custom Headers:
{
  "Accept": "application/json"
}
Request Body: (leave empty)
```

**Alternative (Token in Header):**
```
Source Name: Pipedrive Contacts API
API Endpoint URL: https://api.pipedrive.com/v1/persons
HTTP Method: GET
Authentication Type: API Key
API Key: your-pipedrive-api-token
Custom Headers:
{
  "Accept": "application/json"
}
```

---

## Zoho CRM API Integration

### Step 1: Get Zoho API Credentials

1. Go to **Zoho API Console**: https://api-console.zoho.com/
2. Create a new **Client** (Server-based application)
3. Set **Redirect URI**: `https://your-app.com/oauth/callback`
4. Copy:
   - **Client ID**
   - **Client Secret**
5. Select **Scopes**: `ZohoCRM.modules.ALL`, `ZohoCRM.settings.ALL`

### Step 2: Configure in Your App

```
Source Name: Zoho CRM Contacts
Source Type: CRM
API Endpoint URL: https://www.zohoapis.com/crm/v2/Contacts
HTTP Method: GET
Authentication Type: OAuth2
Client ID: your-zoho-client-id
Client Secret: your-zoho-client-secret
OAuth Scopes:
  - ZohoCRM.modules.ALL
  - ZohoCRM.settings.ALL
Custom Headers:
{
  "Content-Type": "application/json"
}
Request Body: (leave empty for GET)
```

---

## Quick Reference: Common CRM API Endpoints

### HubSpot
- **Contacts**: `https://api.hubapi.com/crm/v3/objects/contacts`
- **Companies**: `https://api.hubapi.com/crm/v3/objects/companies`
- **Deals**: `https://api.hubapi.com/crm/v3/objects/deals`
- **Auth**: Bearer Token (Private App API Key)

### Salesforce
- **Query**: `https://your-instance.salesforce.com/services/data/v58.0/query?q=SELECT+Id,Name+FROM+Contact`
- **Contacts**: `https://your-instance.salesforce.com/services/data/v58.0/sobjects/Contact`
- **Accounts**: `https://your-instance.salesforce.com/services/data/v58.0/sobjects/Account`
- **Auth**: OAuth2 (Client Credentials or Bearer Token)

### Pipedrive
- **Deals**: `https://api.pipedrive.com/v1/deals`
- **Persons**: `https://api.pipedrive.com/v1/persons`
- **Organizations**: `https://api.pipedrive.com/v1/organizations`
- **Auth**: API Token (in URL or header)

### Zoho CRM
- **Contacts**: `https://www.zohoapis.com/crm/v2/Contacts`
- **Accounts**: `https://www.zohoapis.com/crm/v2/Accounts`
- **Deals**: `https://www.zohoapis.com/crm/v2/Deals`
- **Auth**: OAuth2

---

## Authentication Types Explained

### 1. **None** (No Authentication)
- Use for: Public APIs, APIs with token in URL
- Example: Pipedrive with token in URL

### 2. **API Key**
- Use for: Simple API key authentication
- Example: Some HubSpot endpoints

### 3. **Bearer Token**
- Use for: Token-based authentication
- Example: HubSpot Private Apps, Salesforce with access token
- Format: Token goes in `Authorization: Bearer <token>` header

### 4. **OAuth2** (Recommended for CRM)
- Use for: Secure, token-based authentication with refresh
- Example: Salesforce, Zoho CRM
- Your backend handles token exchange automatically
- Requires: Client ID, Client Secret, Scopes

### 5. **Basic Auth**
- Use for: Username/password authentication
- Example: Some legacy APIs

---

## Step-by-Step: Connect HubSpot via API

### Complete Example

1. **Get HubSpot API Key**
   - HubSpot → Settings → Integrations → Private Apps
   - Create app, copy API key (starts with `pat-`)

2. **Open API Integration Form**
   - Mission Control → Data Sources → "Add Source"
   - Select **"API Integration"** mode

3. **Fill Form**:
   ```
   Source Name: HubSpot Contacts
   Source Type: CRM
   API Endpoint URL: https://api.hubapi.com/crm/v3/objects/contacts
   HTTP Method: GET
   Authentication Type: Bearer Token
   Bearer Token: pat-na1-xxxx-xxxx-xxxx-xxxx
   Custom Headers: {"Content-Type": "application/json"}
   ```

4. **Test Connection**
   - Click "Test Connection"
   - Should return success with contact data

5. **Add Source**
   - Click "Add Source"
   - HubSpot appears in Data Sources table
   - Status: "Connected"

6. **Sync Data**
   - Click "Sync Now" to fetch contacts
   - Data syncs to your database

---

## Comparison: Pre-Built vs API Integration

| Feature | Pre-Built Connectors | API Integration |
|---------|---------------------|-----------------|
| **Setup** | Simple (email/password) | Requires API credentials |
| **Flexibility** | Limited to pre-configured | Full control over endpoints |
| **Authentication** | Custom modals | OAuth2, Bearer, API Key |
| **Production Ready** | Demo mode | Real API calls |
| **Customization** | Limited | Full endpoint control |
| **Best For** | Quick demos | Production use |

---

## Troubleshooting

### Issue: "401 Unauthorized"
**Solution**: 
- Check API key/token is correct
- Verify token hasn't expired
- Ensure correct authentication type selected

### Issue: "404 Not Found"
**Solution**:
- Verify endpoint URL is correct
- Check API version in URL (v3, v58.0, etc.)
- Ensure instance URL is correct (for Salesforce)

### Issue: "403 Forbidden"
**Solution**:
- Check API key has required permissions/scopes
- Verify OAuth scopes are correct
- Ensure Private App has necessary access

### Issue: OAuth2 Not Working
**Solution**:
- Verify Client ID and Secret are correct
- Check Redirect URI matches in CRM settings
- Ensure backend OAuth2 endpoint is implemented
- Check scopes are properly formatted

---

## Best Practices

1. **Use OAuth2 for Production**
   - More secure than API keys
   - Automatic token refresh
   - Better for long-term use

2. **Store Credentials Securely**
   - Backend encrypts and stores credentials
   - Never expose in frontend code
   - Use environment variables

3. **Test Before Adding**
   - Always use "Test Connection" first
   - Verify response format
   - Check data structure

4. **Use Specific Endpoints**
   - Don't use generic endpoints
   - Use endpoints for specific data (contacts, deals, etc.)
   - Better performance and clarity

5. **Monitor Sync Status**
   - Check "Last Sync" in Data Sources table
   - Set appropriate sync frequency
   - Monitor for errors

---

## Next Steps

1. **Choose a CRM** to connect (HubSpot is easiest to start)
2. **Get API credentials** from CRM platform
3. **Use API Integration form** to configure
4. **Test connection** before adding
5. **Add as data source** and start syncing

---

## Related Documentation

- `REAL_WORLD_API_EXAMPLES.md` - General API examples
- `API_INTEGRATION_GUIDE.md` - How API integration works
- `BACKEND_INTEGRATION_REQUIREMENTS.md` - Backend implementation

---

## Summary

✅ **Yes, you can connect CRM platforms via API Integration!**

**Recommended Approach**:
1. Use **API Integration** mode (not pre-built connectors)
2. Get **API credentials** from CRM platform
3. Configure with **OAuth2** or **Bearer Token**
4. Test and add as data source

**Easiest to Start**: HubSpot (Private App API Key)  
**Most Secure**: OAuth2 (Salesforce, Zoho)  
**Quick Test**: Pipedrive (API Token in URL)

Your backend will handle token exchange, storage, and data syncing automatically once the endpoints are implemented!
















