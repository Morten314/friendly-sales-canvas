// API utility functions for improved error handling and retry logic

interface ApiCallOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  showLoading?: boolean;
  componentName?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * Simple API call function - NO RETRIES, just single attempt
 */
export const simpleApiCall = async <T = any>(
  endpoint: string,
  payload: any,
  options: ApiCallOptions = {}
): Promise<ApiResponse<T>> => {
  const {
    timeout = 30000,
    componentName = 'Unknown'
  } = options;

  try {
    console.log(`🔄 ${componentName} - Making single API call`);

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
    });

    // Create fetch promise
    const fetchPromise = fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    console.log(`📨 ${componentName} - API response status:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ ${componentName} - API call successful`);

    return {
      success: true,
      data: result,
      statusCode: response.status
    };

  } catch (error) {
    console.error(`❌ ${componentName} - API call failed:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      statusCode: 500
    };
  }
};

/**
 * Market research specific API call wrapper - NO RETRIES
 */
export const marketResearchApiCall = async (
  componentName: string,
  payload: any,
  options: ApiCallOptions = {}
): Promise<ApiResponse> => {
  return simpleApiCall('market-research', payload, {
    ...options,
    componentName
  });
};

/**
 * Market research specific API call wrapper with cache busting
 */
export const marketResearchApiCallWithCacheBust = async (
  componentName: string,
  payload: any,
  options: ApiCallOptions = {}
): Promise<ApiResponse> => {
  // Add cache busting parameters to payload
  const cacheBustedPayload = {
    ...payload,
    _timestamp: Date.now(),
    _cache_bust: Math.random().toString(36).substring(7)
  };
  
  return simpleApiCall('market-research', cacheBustedPayload, {
    ...options,
    componentName
  });
};

/**
 * Check if we should fall back to cached data
 */
export const shouldUseCachedData = (apiResponse: ApiResponse, refresh: boolean): boolean => {
  // If refresh is forced and API failed, we might still want to use cached data
  if (refresh && !apiResponse.success) {
    console.log('⚠️ API failed during refresh, considering cached data fallback');
    return true;
  }
  
  return !apiResponse.success;
};

/**
 * Log API call results for debugging
 */
export const logApiCallResult = (componentName: string, result: ApiResponse, refresh: boolean) => {
  if (result.success) {
    console.log(`✅ ${componentName} - API call successful, data received`);
    if (result.data?.status === 'success' && result.data?.data) {
      console.log(`📊 ${componentName} - Valid data structure received`);
    } else {
      console.warn(`⚠️ ${componentName} - Unexpected data structure:`, result.data);
    }
  } else {
    console.error(`❌ ${componentName} - API call failed:`, result.error);
    if (refresh) {
      console.log(`🔄 ${componentName} - Will fall back to cached data`);
    }
  }
};

/**
 * Rate limiting utility to space out API calls
 */
export const rateLimitedApiCall = async <T>(
  apiCall: () => Promise<T>,
  componentName: string,
  delayMs: number = 3000
): Promise<T> => {
  console.log(`⏳ ${componentName} - Waiting ${delayMs}ms before API call to avoid rate limiting...`);
  await new Promise(resolve => setTimeout(resolve, delayMs));
  return apiCall();
};

/**
 * Validate if data is fresh (less than 5 minutes old)
 */
export const isDataFresh = (timestamp: string | number | Date | null | undefined): boolean => {
  if (!timestamp) return false;
  
  try {
    const dataTime = new Date(timestamp).getTime();
    const currentTime = Date.now();
    const fiveMinutesInMs = 5 * 60 * 1000; // 5 minutes
    
    return (currentTime - dataTime) < fiveMinutesInMs;
  } catch (error) {
    console.warn('Error validating data freshness:', error);
    return false;
  }
};

/**
 * Force fresh data by clearing cache and making new API call
 */
export const forceFreshData = async (
  componentName: string,
  apiCall: () => Promise<any>,
  localStorageKey?: string
): Promise<any> => {
  console.log(`🔄 ${componentName} - Forcing fresh data...`);
  
  // Clear localStorage cache if key provided
  if (localStorageKey) {
    localStorage.removeItem(localStorageKey);
    console.log(`🧹 ${componentName} - Cleared localStorage cache: ${localStorageKey}`);
  }
  
  // Make fresh API call
  return apiCall();
};
