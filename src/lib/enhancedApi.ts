import { executeWithRateLimit, rateLimitManager } from './rateLimitManager';

interface ApiCallOptions {
  timeout?: number;
  retries?: number;
  useCache?: boolean;
  cacheKey?: string;
  componentName?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  fromCache?: boolean;
  rateLimitInfo?: {
    queueLength: number;
    requestsThisMinute: number;
    maxRequestsPerMinute: number;
  };
}

// Simple in-memory cache
const apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

class EnhancedApiClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultRetries: number;

  constructor() {
    // Try local dev server first, fallback to production if it fails
    this.baseUrl = import.meta.env.DEV ? '/api' : 'https://backend-11kr.onrender.com';
    this.defaultTimeout = 120000; // 2 minutes - increased to prevent premature timeouts
    this.defaultRetries = 2;
  }

  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseUrl}/${cleanEndpoint}`;
  }

  private getCacheKey(endpoint: string, payload: any): string {
    return `${endpoint}-${JSON.stringify(payload)}`;
  }

  private getFromCache(cacheKey: string): any | null {
    const cached = apiCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      apiCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  private setCache(cacheKey: string, data: any, ttl: number = 300000): void {
    apiCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private async makeRequest<T>(
    endpoint: string,
    payload: any,
    options: ApiCallOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = this.defaultTimeout,
      componentName = 'Unknown'
    } = options;

    try {
      const url = this.buildUrl(endpoint);
      
      console.log(`🚀 ${componentName} - Making API request to: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ ${componentName} - Request timeout after ${timeout}ms, aborting...`);
        controller.abort();
      }, timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        
        // If local dev server fails with 500 error, try production backend
        if (import.meta.env.DEV && response.status === 500 && this.baseUrl === '/api') {
          console.log(`🏥 Local dev server failed with 500 error, trying production backend...`);
          
          // Switch to production backend
          const originalBaseUrl = this.baseUrl;
          this.baseUrl = 'https://backend-11kr.onrender.com';
          
          try {
            const productionUrl = this.buildUrl(endpoint);
            console.log(`🔄 Retrying with production backend: ${productionUrl}`);
            
            const productionResponse = await fetch(productionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              },
              body: JSON.stringify(payload),
              signal: controller.signal
            });
            
            if (!productionResponse.ok) {
              const productionErrorText = await productionResponse.text();
              throw new Error(`Production backend also failed: HTTP ${productionResponse.status}: ${productionErrorText}`);
            }
            
            const productionData = await productionResponse.json();
            console.log(`✅ Production backend request successful`);
            
            // Restore original base URL
            this.baseUrl = originalBaseUrl;
            
            return {
              success: true,
              data: productionData,
              statusCode: productionResponse.status,
              rateLimitInfo: rateLimitManager.getQueueStatus()
            };
            
          } catch (productionError) {
            // Restore original base URL
            this.baseUrl = originalBaseUrl;
            throw productionError;
          }
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        data,
        statusCode: response.status,
        rateLimitInfo: rateLimitManager.getQueueStatus()
      };

    } catch (error) {
      console.error(`❌ ${componentName} - API request failed:`, error);
      
      // Handle abort signal errors specifically
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out - please try again',
          statusCode: 408,
          rateLimitInfo: rateLimitManager.getQueueStatus()
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500,
        rateLimitInfo: rateLimitManager.getQueueStatus()
      };
    }
  }

  async call<T>(
    endpoint: string,
    payload: any,
    options: ApiCallOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      useCache = false,
      cacheKey,
      componentName = 'Unknown'
    } = options;

    // Check cache first if enabled
    if (useCache) {
      const key = cacheKey || this.getCacheKey(endpoint, payload);
      const cachedData = this.getFromCache(key);
      
      if (cachedData) {
        console.log(`📦 ${componentName} - Returning cached data`);
        return {
          success: true,
          data: cachedData,
          fromCache: true,
          rateLimitInfo: rateLimitManager.getQueueStatus()
        };
      }
    }

    // Execute with rate limiting and retry logic
    let lastError: any;
    for (let attempt = 1; attempt <= this.defaultRetries; attempt++) {
      try {
        console.log(`🔄 ${componentName} - Attempt ${attempt}/${this.defaultRetries}`);
        
        const result = await executeWithRateLimit(
          () => this.makeRequest<T>(endpoint, payload, options),
          componentName
        );

        // Cache successful responses if enabled
        if (useCache && result.success && result.data) {
          const key = cacheKey || this.getCacheKey(endpoint, payload);
          this.setCache(key, result.data);
        }

        return result;

      } catch (error) {
        lastError = error;
        console.warn(`⚠️ ${componentName} - Attempt ${attempt} failed:`, error);
        
        // Don't retry on certain error types
        if (error instanceof Error && 
            (error.name === 'AbortError' || error.message.includes('timeout'))) {
          break;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < this.defaultRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ ${componentName} - Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`❌ ${componentName} - All ${this.defaultRetries} attempts failed. Last error:`, lastError);
    
    return {
      success: false,
      error: lastError instanceof Error ? lastError.message : 'All retry attempts failed',
      statusCode: 500,
      rateLimitInfo: rateLimitManager.getQueueStatus()
    };
  }

  // Specialized method for ICP research calls
  async callICPresearch(
    componentName: string,
    selectedICP: any,
    options: ApiCallOptions = {}
  ): Promise<ApiResponse<any>> {
    const timestamp = Date.now();
    const randomParam = Math.random().toString(36).substring(7);
    const endpoint = `icp-research?t=${timestamp}&cache_bust=${randomParam}`;

    const payload = {
      user_id: "user_123",
      component_name: componentName,
      refresh: true,
      data: selectedICP
    };

    return this.call(endpoint, payload, {
      ...options,
      componentName: `ICP Research - ${componentName}`
    });
  }

  // Utility method to clear cache
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of apiCache.keys()) {
        if (key.includes(pattern)) {
          apiCache.delete(key);
        }
      }
    } else {
      apiCache.clear();
    }
  }

  // Utility method to get cache stats
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: apiCache.size,
      keys: Array.from(apiCache.keys())
    };
  }

  // Utility method to get rate limit status
  getRateLimitStatus() {
    return rateLimitManager.getQueueStatus();
  }
}

// Create singleton instance
export const enhancedApi = new EnhancedApiClient();

// Export convenience functions
export const callApi = <T>(
  endpoint: string,
  payload: any,
  options: ApiCallOptions = {}
): Promise<ApiResponse<T>> => {
  return enhancedApi.call<T>(endpoint, payload, options);
};

export const callICPresearch = (
  componentName: string,
  selectedICP: any,
  options: ApiCallOptions = {}
): Promise<ApiResponse<any>> => {
  return enhancedApi.callICPresearch(componentName, selectedICP, options);
};

// Export the class for testing
export { EnhancedApiClient };
