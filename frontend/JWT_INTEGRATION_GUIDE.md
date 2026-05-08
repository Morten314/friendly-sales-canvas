# JWT Token Integration Guide

This guide explains how to work with JWT tokens in your multi-tenant application.

## Overview

Your application now has a complete JWT authentication system that:
- ✅ Generates JWT tokens from Firebase authentication
- ✅ Automatically includes JWT tokens in API requests
- ✅ Handles token refresh automatically
- ✅ Provides tenant-aware authentication
- ✅ Includes error handling for authentication failures

## Key Components

### 1. JWT Manager (`src/lib/jwt.ts`)
- Handles JWT token generation, storage, and refresh
- Integrates with Firebase authentication
- Provides tenant context in tokens

### 2. Authenticated API Client (`src/lib/authenticatedApi.ts`)
- Wrapper around your existing API clients
- Automatically includes JWT tokens in requests
- Handles token refresh on authentication failures
- Provides convenient methods for GET, POST, PUT, DELETE

### 3. React Hook (`src/hooks/useAuthenticatedApi.ts`)
- Easy-to-use React hook for components
- Provides loading states and error handling
- Automatically manages authentication status

## How to Use JWT Tokens

### Basic Usage in Components

```tsx
import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';

const MyComponent = () => {
  const { post, get, isLoading, error, isAuthenticated, userInfo } = useAuthenticatedApi();

  const fetchData = async () => {
    try {
      const response = await post('market-research', {
        user_id: userInfo?.userId,
        component_name: 'my-component',
        data: { /* your data */ }
      });
      console.log('Response:', response);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <button onClick={fetchData} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Fetch Data'}
        </button>
      ) : (
        <p>Please log in to continue</p>
      )}
    </div>
  );
};
```

### Direct API Usage

```tsx
import { authenticatedApi } from '@/lib/authenticatedApi';

// Make authenticated requests
const data = await authenticatedApi.post('endpoint', payload);
const userInfo = authenticatedApi.getUserInfo();
const isAuth = await authenticatedApi.isAuthenticated();
```

### Manual JWT Management

```tsx
import jwtManager from '@/lib/jwt';

// Get current token
const token = jwtManager.getToken();

// Check if token is expired
const isExpired = jwtManager.isTokenExpired();

// Get authorization header for manual requests
const authHeader = await jwtManager.getAuthHeader();

// Decode token to get user info
const tokenInfo = jwtManager.decodeToken(token);
```

## Backend Integration

### Required Backend Endpoints

Your backend needs these endpoints:

1. **POST /api/auth/token** - Generate JWT from Firebase token
2. **POST /api/auth/refresh** - Refresh expired JWT tokens

See `backend-jwt-example.js` for reference implementation.

### JWT Token Structure

Your JWT tokens contain:
```json
{
  "userId": "firebase-user-id",
  "email": "user@example.com",
  "tenantId": "tenant-123",
  "role": "user",
  "exp": 1234567890,
  "iat": 1234567890
}
```

### Backend Middleware

Use JWT verification middleware on protected routes:

```javascript
const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  const decoded = jwt.verify(token, JWT_SECRET);
  req.user = decoded;
  next();
};

// Apply to protected routes
router.post('/market-research', verifyJWT, (req, res) => {
  const { userId, tenantId } = req.user;
  // Your logic here
});
```

## Migration Guide

### Updating Existing Components

1. **Replace direct API calls:**
   ```tsx
   // Before
   import { apiFetchJson } from '@/lib/api';
   const response = await apiFetchJson('endpoint', { method: 'POST', body: data });

   // After
   import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';
   const { post } = useAuthenticatedApi();
   const response = await post('endpoint', data);
   ```

2. **Add authentication checks:**
   ```tsx
   const { isAuthenticated, userInfo } = useAuthenticatedApi();
   
   if (!isAuthenticated) {
     return <div>Please log in</div>;
   }
   ```

3. **Use user context in API calls:**
   ```tsx
   const payload = {
     user_id: userInfo?.userId,
     tenant_id: userInfo?.tenantId,
     // ... rest of your data
   };
   ```

## Error Handling

The system automatically handles:
- ✅ Token expiration and refresh
- ✅ Authentication failures
- ✅ Network errors
- ✅ Invalid tokens

Common error scenarios:
- **401 Unauthorized**: Token expired or invalid
- **Authentication required**: User not logged in
- **Token refresh failed**: User needs to re-authenticate

## Security Considerations

1. **Store JWT secrets securely** in environment variables
2. **Use HTTPS** in production
3. **Set appropriate token expiration** times
4. **Implement proper CORS** settings
5. **Validate tenant access** on the backend
6. **Log authentication events** for security monitoring

## Testing

Use the updated `ApiTest` component to test JWT integration:
1. Log in to your application
2. Select a tenant
3. Navigate to the API Test component
4. Verify authentication status
5. Test API calls with JWT tokens

## Troubleshooting

### Common Issues

1. **"Authentication required" error**
   - Check if user is logged in
   - Verify tenant is selected
   - Check JWT token generation

2. **"Invalid token" error**
   - Token may be expired
   - Check JWT secret configuration
   - Verify token format

3. **API calls failing**
   - Check if backend endpoints are implemented
   - Verify CORS settings
   - Check network connectivity

### Debug Information

Enable debug logging:
```tsx
// In your component
console.log('User info:', userInfo);
console.log('Is authenticated:', isAuthenticated);
console.log('JWT token:', jwtManager.getToken());
```

## Next Steps

1. **Implement backend JWT endpoints** using the provided example
2. **Update all components** to use authenticated API calls
3. **Add tenant-based data isolation** in your backend
4. **Implement role-based access control** if needed
5. **Add comprehensive error handling** for production use

## Files Modified/Created

- ✅ `src/lib/api.ts` - Added JWT authentication headers
- ✅ `src/lib/enhancedApi.ts` - Added JWT authentication headers
- ✅ `src/lib/authenticatedApi.ts` - New authenticated API client
- ✅ `src/hooks/useAuthenticatedApi.ts` - New React hook
- ✅ `src/components/ApiTest.tsx` - Updated to use JWT authentication
- ✅ `backend-jwt-example.js` - Backend implementation example
- ✅ `JWT_INTEGRATION_GUIDE.md` - This guide

Your JWT integration is now complete and ready to use! 🎉



