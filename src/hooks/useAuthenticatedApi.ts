import { useState, useCallback, useEffect } from 'react';
import { authenticatedApi, AuthenticatedApiOptions } from '../lib/authenticatedApi';
import { useAuth } from './useAuth';

interface UseAuthenticatedApiReturn {
  // API methods
  get: <T = any>(endpoint: string, options?: AuthenticatedApiOptions) => Promise<T>;
  post: <T = any>(endpoint: string, data: any, options?: AuthenticatedApiOptions) => Promise<T>;
  put: <T = any>(endpoint: string, data: any, options?: AuthenticatedApiOptions) => Promise<T>;
  delete: <T = any>(endpoint: string, options?: AuthenticatedApiOptions) => Promise<T>;
  call: <T = any>(endpoint: string, payload: any, options?: AuthenticatedApiOptions) => Promise<any>;
  callICPresearch: (componentName: string, selectedICP: any, options?: AuthenticatedApiOptions) => Promise<any>;
  
  // State
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  userInfo: any;
  
  // Utilities
  clearError: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthenticatedApi = (): UseAuthenticatedApiReturn => {
  const { currentUser, jwtToken, isGeneratingToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      if (currentUser && jwtToken) {
        const authStatus = await authenticatedApi.isAuthenticated();
        setIsAuthenticated(authStatus);
        
        if (authStatus) {
          const info = authenticatedApi.getUserInfo();
          setUserInfo(info);
        }
      } else {
        setIsAuthenticated(false);
        setUserInfo(null);
      }
    };

    checkAuth();
  }, [currentUser, jwtToken]);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refresh token function
  const refreshToken = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // The JWT manager will handle the refresh automatically
      const authStatus = await authenticatedApi.isAuthenticated();
      setIsAuthenticated(authStatus);
    } catch (err) {
      setError('Failed to refresh authentication token');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Wrapper functions that handle loading and error states
  const createApiWrapper = <T extends any[]>(
    apiFunction: (...args: T) => Promise<any>
  ) => {
    return async (...args: T) => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await apiFunction(...args);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    };
  };

  return {
    // API methods with loading/error handling
    get: createApiWrapper(authenticatedApi.get.bind(authenticatedApi)),
    post: createApiWrapper(authenticatedApi.post.bind(authenticatedApi)),
    put: createApiWrapper(authenticatedApi.put.bind(authenticatedApi)),
    delete: createApiWrapper(authenticatedApi.delete.bind(authenticatedApi)),
    call: createApiWrapper(authenticatedApi.call.bind(authenticatedApi)),
    callICPresearch: createApiWrapper(authenticatedApi.callICPresearch.bind(authenticatedApi)),
    
    // State
    isLoading: isLoading || isGeneratingToken,
    error,
    isAuthenticated,
    userInfo,
    
    // Utilities
    clearError,
    refreshToken
  };
};

