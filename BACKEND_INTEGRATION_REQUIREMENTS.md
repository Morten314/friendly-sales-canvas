# Backend Integration Requirements

## For Backend Developer

### Required JWT Endpoints

Your backend needs to implement these two critical endpoints:

#### 1. POST `/api/auth/token` - Generate JWT Token

**Purpose**: Convert Firebase ID token to your custom JWT token with tenant context

**Request Headers**:
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "tenantId": "tenant-123"
}
```

**Response (Success - 200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "userId": "firebase-user-id",
    "email": "user@example.com",
    "tenantId": "tenant-123"
  }
}
```

**Response (Error - 401)**:
```json
{
  "error": "Invalid Firebase token"
}
```

#### 2. POST `/api/auth/refresh` - Refresh JWT Token

**Purpose**: Generate new JWT token using refresh token

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Success - 200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

**Response (Error - 401)**:
```json
{
  "error": "Invalid refresh token"
}
```

### JWT Token Structure

Your JWT tokens must contain this exact structure:

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

### Required Backend Dependencies

```bash
npm install jsonwebtoken firebase-admin express
```

### Environment Variables for Backend

```env
# JWT Secrets (generate strong random strings)
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Optional
JWT_EXPIRES_IN=3600
JWT_REFRESH_EXPIRES_IN=604800
```

### Backend Implementation Example

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

const router = express.Router();

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// POST /api/auth/token
router.post('/auth/token', async (req, res) => {
  try {
    const { tenantId } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No Firebase token provided' });
    }
    
    const firebaseToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    
    const jwtPayload = {
      userId: decodedToken.uid,
      email: decodedToken.email,
      tenantId: tenantId,
      role: decodedToken.role || 'user',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    };
    
    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET);
    const refreshToken = jwt.sign(
      { userId: decodedToken.uid, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      refreshToken,
      expiresIn: 3600,
      user: {
        userId: decodedToken.uid,
        email: decodedToken.email,
        tenantId: tenantId
      }
    });
    
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(401).json({ error: 'Invalid Firebase token' });
  }
});

// POST /api/auth/refresh
router.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const userRecord = await admin.auth().getUser(decoded.userId);
    
    const jwtPayload = {
      userId: userRecord.uid,
      email: userRecord.email,
      tenantId: decoded.tenantId,
      role: userRecord.customClaims?.role || 'user',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    };
    
    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET);
    
    res.json({
      token,
      expiresIn: 3600
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

module.exports = router;
```

### JWT Middleware for Protected Routes

```javascript
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Use on all protected routes
router.post('/market-research', verifyJWT, (req, res) => {
  const { userId, tenantId } = req.user;
  // Your logic here - use userId and tenantId for data isolation
});
```

### Security Requirements

1. **Use HTTPS** in production
2. **Store JWT secrets securely** (environment variables, not in code)
3. **Set appropriate CORS** headers
4. **Validate tenant access** - ensure users can only access their tenant's data
5. **Log authentication events** for security monitoring
6. **Rate limit** authentication endpoints

### Testing Endpoints

Use these curl commands to test:

```bash
# Test token generation
curl -X POST https://your-backend.com/api/auth/token \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "test-tenant"}'

# Test token refresh
curl -X POST https://your-backend.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refresh-token>"}'

# Test protected endpoint
curl -X POST https://your-backend.com/api/market-research \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"component_name": "test", "data": {}}'
```

## For Frontend Developer (You)

### 1. Update Environment Variables

Create `.env.local` file:
```env
VITE_BACKEND_URL=https://your-backend-url.com
VITE_JWT_DEBUG=true
```

### 2. Test JWT Integration

1. **Start your frontend**: `npm run dev`
2. **Log in** to your application
3. **Select a tenant**
4. **Navigate to API Test component**
5. **Verify** authentication status shows as "Authenticated"
6. **Test API calls** - they should now include JWT tokens

### 3. Monitor JWT Flow

Check browser console for:
- JWT token generation logs
- API request headers (should include Authorization)
- Token refresh attempts
- Authentication errors

### 4. Update API Endpoints

Once backend is ready, update your API base URL in:
- `src/lib/api.ts`
- `src/lib/enhancedApi.ts`

## Timeline & Priority

### Phase 1 (Immediate - 1-2 days)
1. ✅ Frontend JWT integration (COMPLETED)
2. 🔄 Backend JWT endpoints implementation
3. 🔄 Basic testing

### Phase 2 (Next - 3-5 days)
1. 🔄 Update all components to use authenticated API
2. 🔄 Add tenant-based data isolation
3. 🔄 Error handling and user feedback

### Phase 3 (Future - 1 week)
1. 🔄 Role-based access control
2. 🔄 Security hardening
3. 🔄 Performance optimization

## Questions for Backend Developer

1. **What's your preferred JWT library?** (jsonwebtoken is recommended)
2. **How do you want to handle tenant data isolation?** (database level, application level)
3. **What's your current authentication system?** (if any)
4. **Do you need role-based permissions?** (admin, user, etc.)
5. **What's your preferred error response format?**
6. **Do you have existing rate limiting?**
7. **What's your CORS policy?**
8. **How do you want to handle token blacklisting?** (for logout)

## Success Criteria

✅ **Backend endpoints return JWT tokens**  
✅ **Frontend can make authenticated API calls**  
✅ **Token refresh works automatically**  
✅ **Tenant isolation is enforced**  
✅ **Error handling works properly**  
✅ **All existing API calls work with JWT**  

## Support

If you need help with:
- Frontend JWT integration: Check `JWT_INTEGRATION_GUIDE.md`
- Backend implementation: Use the provided code examples
- Testing: Use the `ApiTest` component
- Debugging: Check browser console and network tabs



