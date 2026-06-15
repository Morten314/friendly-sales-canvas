# Frontend Configuration Setup

## 1. Environment Variables

Create a `.env.local` file in your project root with:

```env
# Backend Configuration
VITE_BACKEND_URL=https://your-backend-url.com
VITE_API_BASE_URL=/api

# Debug JWT (set to false in production)
VITE_JWT_DEBUG=true
```

## 2. Update API Base URL

Once your backend is ready, update these files:

### In `src/lib/api.ts`:

```typescript
export const API_BASE_URL =
  isDevelopment || isVercel ? "/api" : "https://your-actual-backend-url.com"; // Update this
```

### In `src/lib/enhancedApi.ts`:

```typescript
this.baseUrl = import.meta.env.DEV ? "/api" : "https://your-actual-backend-url.com"; // Update this
```

## 3. Test Your Setup

1. **Start your development server**:

   ```bash
   npm run dev
   ```

2. **Open browser console** and look for:
   - JWT token generation logs
   - API request headers
   - Authentication status

3. **Test the flow**:
   - Log in to your app
   - Select a tenant
   - Go to API Test component
   - Verify authentication status
   - Test API calls

## 4. Monitor JWT Flow

Check these in browser DevTools:

### Network Tab:

- Look for requests to `/api/auth/token`
- Verify `Authorization` headers in API calls
- Check for 401/403 responses

### Console Tab:

- JWT generation logs
- Token refresh attempts
- Authentication errors

### Application Tab:

- Check `localStorage` for `jwt_token` and `refresh_token`
- Verify tokens are being stored/cleared properly

## 5. Common Issues & Solutions

### Issue: "Authentication required" error

**Solution**: Check if user is logged in and tenant is selected

### Issue: "Invalid token" error

**Solution**: Backend JWT endpoints not implemented yet

### Issue: CORS errors

**Solution**: Backend needs proper CORS configuration

### Issue: 404 on auth endpoints

**Solution**: Backend endpoints not deployed yet

## 6. Next Steps After Backend is Ready

1. **Update API URLs** in the configuration files
2. **Test all API calls** with JWT authentication
3. **Update components** to use authenticated API
4. **Add error handling** for authentication failures
5. **Test token refresh** functionality
