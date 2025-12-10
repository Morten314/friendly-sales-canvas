# Authentication & Multi-Tenancy Setup Guide

## Overview

This implementation provides a complete authentication flow with Firebase and JWT tokens for multi-tenant support:

1. **Login Page** → Firebase Authentication
2. **Tenant Selection** → Choose organization
3. **Mission Control** → Protected dashboard with tenant context

## Architecture

```
User → Login (Firebase) → JWT Token → Tenant Selection → Protected Routes
```

### Components Created

- `src/contexts/AuthContext.tsx` - Firebase authentication management
- `src/contexts/TenantContext.tsx` - Multi-tenant state management
- `src/pages/Login.tsx` - Login/signup page
- `src/pages/TenantSelection.tsx` - Tenant selection interface
- `src/components/ProtectedRoute.tsx` - Route protection wrapper
- `src/lib/firebase.ts` - Firebase configuration
- `src/lib/jwt.ts` - JWT token management
- `src/hooks/useAuth.ts` - Custom authentication hook
- `src/services/api.ts` - API service with JWT integration

## Setup Instructions

### 1. Install Dependencies

```bash
cd friendly-sales-canvas
npm install firebase jsonwebtoken @types/jsonwebtoken
```

### 2. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing
3. Enable Authentication → Sign-in method → Email/Password
4. Copy your Firebase config
5. Update `src/lib/firebase.ts` with your config:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 3. Backend Integration (Required)

Your backend developer needs to implement these endpoints:

#### `/api/auth/token` (POST)
- Accepts Firebase ID token
- Generates JWT with tenant context
- Returns: `{ token: string, refreshToken: string }`

#### `/api/auth/refresh` (POST)
- Accepts refresh token
- Returns new JWT token

#### JWT Payload Structure
```typescript
{
  userId: string,
  email: string,
  tenantId?: string,
  role?: string,
  exp: number,
  iat: number
}
```

### 4. Environment Variables

Create `.env.local`:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
```

Update `src/lib/firebase.ts` to use environment variables:
```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

## How It Works

### Authentication Flow

1. **User visits app** → Redirected to `/login`
2. **Login successful** → Redirected to `/tenant-selection`
3. **Tenant selected** → JWT token generated with tenant context
4. **Access protected routes** → All routes require authentication + tenant

### JWT Token Usage

- **Firebase handles**: User authentication, password management, session management
- **JWT tokens handle**: API authorization, tenant context, role-based access
- **Backend validates**: JWT tokens for all API requests

### Multi-Tenancy

- Each user can belong to multiple tenants
- Tenant selection determines data context
- JWT token includes `tenantId` for backend filtering
- All API calls automatically include tenant context

## Security Features

- ✅ Firebase authentication with email/password
- ✅ JWT tokens for API authorization
- ✅ Automatic token refresh
- ✅ Protected routes with authentication checks
- ✅ Tenant-based data isolation
- ✅ Secure token storage and management

## Testing

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. You should be redirected to the login page
4. Create an account or sign in
5. Select a tenant
6. Access the mission control dashboard

## Next Steps

1. Install the required dependencies
2. Set up Firebase project and update configuration
3. Coordinate with backend developer for JWT endpoints
4. Test the complete authentication flow
5. Customize tenant data and UI as needed

## Troubleshooting

- **Firebase errors**: Check your Firebase configuration
- **JWT errors**: Ensure backend endpoints are implemented
- **Routing issues**: Verify all routes are properly protected
- **Token refresh**: Check network requests in browser dev tools




