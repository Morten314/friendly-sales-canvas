import type { User } from "firebase/auth";

import { authEndpointRequest } from "@/shared/api/client";
import { AuthRefreshResponseSchema, AuthTokenResponseSchema } from "@/shared/api/contracts";

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
  async generateToken(user: User, tenantId?: string): Promise<string | null> {
    try {
      // Get Firebase ID token
      const firebaseToken = await user.getIdToken();

      // In a real implementation, you would send this to your backend
      // which would generate a JWT with tenant context
      const result = await authEndpointRequest("auth/token", AuthTokenResponseSchema, {
        method: "POST",
        headers: { Authorization: `Bearer ${firebaseToken}` },
        body: { tenantId },
      });

      if (!result.ok) {
        // If endpoint doesn't exist (404), JWT is optional - don't fail
        if (result.status === 404) {
          console.warn(
            "⚠️ JWT token endpoint not found (404). JWT authentication is optional - continuing without JWT token.",
          );
          return null;
        }
        throw new Error(`Failed to generate JWT token: ${result.status}`);
      }

      this.token = result.data?.token ?? null;
      this.refreshToken = result.data?.refreshToken ?? null;

      // Store in localStorage
      if (this.token) {
        localStorage.setItem("jwt_token", this.token);
      }
      if (this.refreshToken) {
        localStorage.setItem("refresh_token", this.refreshToken);
      }

      return this.token;
    } catch (error) {
      // If it's a network error, JWT is optional - don't fail the app.
      // (A 404 no longer reaches here — authEndpointRequest returns {ok:false} and
      // the result.status === 404 branch above handles it without throwing.)
      if (error instanceof TypeError) {
        console.warn(
          "⚠️ JWT token generation failed (endpoint may not exist). JWT authentication is optional - continuing without JWT token.",
        );
        return null;
      }
      console.error("Error generating JWT token:", error);
      // Don't throw - JWT is optional for most endpoints
      return null;
    }
  }

  // Get current token
  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem("jwt_token");
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
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  }

  // Refresh token
  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const result = await authEndpointRequest("auth/refresh", AuthRefreshResponseSchema, {
        method: "POST",
        body: { refreshToken: this.refreshToken },
      });

      if (!result.ok) {
        throw new Error("Failed to refresh token");
      }

      this.token = result.data?.token ?? null;
      if (this.token) {
        localStorage.setItem("jwt_token", this.token);
      }

      if (!this.token) {
        throw new Error("Refresh response missing token");
      }
      return this.token;
    } catch (error) {
      console.error("Error refreshing token:", error);
      this.clearTokens();
      throw error;
    }
  }

  // Clear all tokens
  clearTokens(): void {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("refresh_token");
  }

  // Get authorization header for API requests
  async getAuthHeader(): Promise<string> {
    let token = this.getToken();

    if (!token || this.isTokenExpired()) {
      try {
        token = await this.refreshAccessToken();
      } catch (_error) {
        // If refresh fails, JWT is optional - return empty string
        console.warn(
          "⚠️ JWT token refresh failed. Continuing without JWT (optional for most endpoints).",
        );
        this.clearTokens();
        return ""; // Return empty string instead of throwing
      }
    }

    return token ? `Bearer ${token}` : "";
  }
}

export default JWTManager.getInstance();
