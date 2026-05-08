// Example backend JWT endpoints for your application
// This is a reference implementation - adapt to your actual backend

const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

const router = express.Router();

// Initialize Firebase Admin (you'll need to set up service account)
// const serviceAccount = require('./path-to-your-service-account-key.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// JWT secret (store this securely in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';

// POST /api/auth/token - Generate JWT token from Firebase ID token
router.post('/auth/token', async (req, res) => {
  try {
    const { tenantId } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No Firebase token provided' });
    }
    
    const firebaseToken = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    
    // Create JWT payload with tenant context
    const jwtPayload = {
      userId: decodedToken.uid,
      email: decodedToken.email,
      tenantId: tenantId,
      role: decodedToken.role || 'user', // You can set roles in Firebase custom claims
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      iat: Math.floor(Date.now() / 1000)
    };
    
    // Generate JWT token
    const token = jwt.sign(jwtPayload, JWT_SECRET);
    
    // Generate refresh token (longer expiry)
    const refreshToken = jwt.sign(
      { userId: decodedToken.uid, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
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

// POST /api/auth/refresh - Refresh JWT token
router.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Get user info from database or Firebase
    const userRecord = await admin.auth().getUser(decoded.userId);
    
    // Generate new JWT token
    const jwtPayload = {
      userId: userRecord.uid,
      email: userRecord.email,
      tenantId: decoded.tenantId, // You might want to store this in your database
      role: userRecord.customClaims?.role || 'user',
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      iat: Math.floor(Date.now() / 1000)
    };
    
    const token = jwt.sign(jwtPayload, JWT_SECRET);
    
    res.json({
      token,
      expiresIn: 3600
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Middleware to verify JWT token
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Example protected route
router.get('/protected-data', verifyJWT, (req, res) => {
  res.json({
    message: 'This is protected data',
    user: req.user,
    data: 'Your sensitive data here'
  });
});

// Example market research endpoint with JWT authentication
router.post('/market-research', verifyJWT, async (req, res) => {
  try {
    const { component_name, data, additionalPrompt } = req.body;
    const { userId, tenantId, email } = req.user;
    
    console.log(`Market research request from user ${userId} in tenant ${tenantId}`);
    
    // Your existing market research logic here
    // Make sure to use userId and tenantId for data isolation
    
    const result = {
      success: true,
      data: {
        // Your market research data
        component_name,
        generated_at: new Date().toISOString(),
        user_id: userId,
        tenant_id: tenantId
      }
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('Market research error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;



