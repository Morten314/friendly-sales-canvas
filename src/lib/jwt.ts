import { User } from 'firebase/auth';

interface JWTPayload {
  userId: string;
  email: string;
  tenantId?: string;
  role?: string;
  exp: number;
  iat: number;
}

class JWTManager {
  private static instance: JWTManager;
  private token: string | null = null;
  private refreshToken: string | null = null;

  static getInstance(): JWTManager {
    if (!JWTManager.instance) {
      JWTManager.instance = new JWTManager();
    }
    return JWTManager.instance;
  }

  // Generate JWT token (this would typically be done by your backend)
  async generateToken(user: User, tenantId?: string): Promise<string> {
    try {
      // Get Firebase ID token
      const firebaseToken = await user.getIdToken();
      
      // In a real implementation, you would send this to your backend
      // which would generate a JWT with tenant context
      const response = await fetch('/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}`
        },
        body: JSON.stringify({ tenantId })
      });

      if (!response.ok) {
        throw new Error('Failed to generate JWT token');
      }

      const data = await response.json();
      this.token = data.token;
      this.refreshToken = data.refreshToken;
      
      // Store in localStorage
      localStorage.setItem('jwt_token', this.token);
      if (this.refreshToken) {
        localStorage.setItem('refresh_token', this.refreshToken);
      }
      
      return this.token;
    } catch (error) {
      console.error('Error generating JWT token:', error);
      throw error;
    }
  }

  // Get current token
  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('jwt_token');
    }
    return this.token;
  }

  // Check if token is expired
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = this.decodeToken(token);
      return payload.exp < Date.now() / 1000;
    } catch {
      return true;
    }
  }

  // Decode JWT token (client-side only for basic info)
  decodeToken(token: string): JWTPayload {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  }

  // Refresh token
  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      this.token = data.token;
      localStorage.setItem('jwt_token', this.token);
      
      return this.token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.clearTokens();
      throw error;
    }
  }

  // Clear all tokens
  clearTokens(): void {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('refresh_token');
  }

  // Get authorization header for API requests
  async getAuthHeader(): Promise<string> {
    let token = this.getToken();
    
    if (!token || this.isTokenExpired()) {
      try {
        token = await this.refreshAccessToken();
      } catch (error) {
        // If refresh fails, user needs to re-authenticate
        this.clearTokens();
        throw new Error('Authentication required');
      }
    }

    return `Bearer ${token}`;
  }
}

export default JWTManager.getInstance();

