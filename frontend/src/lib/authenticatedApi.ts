import { apiFetch, apiFetchJson } from './api';
import { callApi, callICPresearch } from './enhancedApi';
import jwtManager from './jwt';

export interface AuthenticatedApiOptions {
  requireAuth?: boolean;
  retryOnAuthFailure?: boolean;
  componentName?: string;
}

/**
 * Authenticated API wrapper that automatically handles JWT tokens
 */
export class AuthenticatedApiClient {
  private static instance: AuthenticatedApiClient;
  
  static getInstance(): AuthenticatedApiClient {
    if (!AuthenticatedApiClient.instance) {
      AuthenticatedApiClient.instance = new AuthenticatedApiClient();
    }
    return AuthenticatedApiClient.instance;
  }

  /**
   * Make an authenticated GET request
   */
  async get<T = any>(
    endpoint: string, 
    options: AuthenticatedApiOptions = {}
  ): Promise<T> {
    const { requireAuth = true, retryOnAuthFailure = true } = options;
    
    if (requireAuth && !await this.hasValidToken()) {
      throw new Error('Authentication required');
    }

    try {
      const response = await apiFetch(endpoint, { method: 'GET' });
      return await response.json();
    } catch (error) {
      if (retryOnAuthFailure && this.isAuthError(error)) {
        return await this.retryWithRefresh(() => this.get<T>(endpoint, { ...options, retryOnAuthFailure: false }));
      }
      throw error;
    }
  }

  /**
   * Make an authenticated POST request
   */
  async post<T = any>(
    endpoint: string, 
    data: any, 
    options: AuthenticatedApiOptions = {}
  ): Promise<T> {
    const { requireAuth = true, retryOnAuthFailure = true } = options;
    
    if (requireAuth && !await this.hasValidToken()) {
      throw new Error('Authentication required');
    }

    try {
      const response = await apiFetch(endpoint, {
        method: 'POST',
        body: data
      });
      return await response.json();
    } catch (error) {
      if (retryOnAuthFailure && this.isAuthError(error)) {
        return await this.retryWithRefresh(() => this.post<T>(endpoint, data, { ...options, retryOnAuthFailure: false }));
      }
      throw error;
    }
  }

  /**
   * Make an authenticated PUT request
   */
  async put<T = any>(
    endpoint: string, 
    data: any, 
    options: AuthenticatedApiOptions = {}
  ): Promise<T> {
    const { requireAuth = true, retryOnAuthFailure = true } = options;
    
    if (requireAuth && !await this.hasValidToken()) {
      throw new Error('Authentication required');
    }

    try {
      const response = await apiFetch(endpoint, {
        method: 'PUT',
        body: data
      });
      return await response.json();
    } catch (error) {
      if (retryOnAuthFailure && this.isAuthError(error)) {
        return await this.retryWithRefresh(() => this.put<T>(endpoint, data, { ...options, retryOnAuthFailure: false }));
      }
      throw error;
    }
  }

  /**
   * Make an authenticated DELETE request
   */
  async delete<T = any>(
    endpoint: string, 
    options: AuthenticatedApiOptions = {}
  ): Promise<T> {
    const { requireAuth = true, retryOnAuthFailure = true } = options;
    
    if (requireAuth && !await this.hasValidToken()) {
      throw new Error('Authentication required');
    }

    try {
      const response = await apiFetch(endpoint, { method: 'DELETE' });
      return await response.json();
    } catch (error) {
      if (retryOnAuthFailure && this.isAuthError(error)) {
        return await this.retryWithRefresh(() => this.delete<T>(endpoint, { ...options, retryOnAuthFailure: false }));
      }
      throw error;
    }
  }

  /**
   * Make an authenticated API call using the enhanced API client
   */
  async call<T = any>(
    endpoint: string,
    payload: any,
    options: AuthenticatedApiOptions = {}
  ) {
    const { componentName = 'AuthenticatedApi' } = options;
    
    return await callApi<T>(endpoint, payload, {
      componentName,
      ...options
    });
  }

  /**
   * Make an authenticated ICP research call
   */
  async callICPresearch(
    componentName: string,
    selectedICP: any,
    options: AuthenticatedApiOptions = {}
  ) {
    return await callICPresearch(componentName, selectedICP, options);
  }

  /**
   * Check if user has a valid JWT token
   */
  private async hasValidToken(): Promise<boolean> {
    try {
      const token = jwtManager.getToken();
      if (!token) return false;
      
      if (jwtManager.isTokenExpired()) {
        // Try to refresh the token
        try {
          await jwtManager.refreshAccessToken();
          return true;
        } catch {
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if an error is authentication-related
   */
  private isAuthError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('401') || 
             message.includes('unauthorized') || 
             message.includes('authentication') ||
             message.includes('token');
    }
    return false;
  }

  /**
   * Retry a request after refreshing the token
   */
  private async retryWithRefresh<T>(requestFn: () => Promise<T>): Promise<T> {
    try {
      await jwtManager.refreshAccessToken();
      return await requestFn();
    } catch (error) {
      // If refresh fails, clear tokens and throw auth error
      jwtManager.clearTokens();
      throw new Error('Authentication failed - please log in again');
    }
  }

  /**
   * Get current JWT token info
   */
  getTokenInfo() {
    const token = jwtManager.getToken();
    if (!token) return null;
    
    try {
      return jwtManager.decodeToken(token);
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await this.hasValidToken();
  }

  /**
   * Get user info from JWT token
   */
  getUserInfo() {
    const tokenInfo = this.getTokenInfo();
    if (!tokenInfo) return null;
    
    return {
      userId: tokenInfo.userId,
      email: tokenInfo.email,
      tenantId: tokenInfo.tenantId,
      role: tokenInfo.role
    };
  }
}

// Export singleton instance
export const authenticatedApi = AuthenticatedApiClient.getInstance();

// Export convenience functions
export const authGet = <T = any>(endpoint: string, options?: AuthenticatedApiOptions) => 
  authenticatedApi.get<T>(endpoint, options);

export const authPost = <T = any>(endpoint: string, data: any, options?: AuthenticatedApiOptions) => 
  authenticatedApi.post<T>(endpoint, data, options);

export const authPut = <T = any>(endpoint: string, data: any, options?: AuthenticatedApiOptions) => 
  authenticatedApi.put<T>(endpoint, data, options);

export const authDelete = <T = any>(endpoint: string, options?: AuthenticatedApiOptions) => 
  authenticatedApi.delete<T>(endpoint, options);

export const authCall = <T = any>(endpoint: string, payload: any, options?: AuthenticatedApiOptions) => 
  authenticatedApi.call<T>(endpoint, payload, options);

export const authICPresearch = (componentName: string, selectedICP: any, options?: AuthenticatedApiOptions) => 
  authenticatedApi.callICPresearch(componentName, selectedICP, options);

