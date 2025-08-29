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
 * Enhanced API call function with retry logic and better error handling
 */
export const enhancedApiCall = async <T = any>(
  endpoint: string,
  payload: any,
  options: ApiCallOptions = {}
): Promise<ApiResponse<T>> => {
  const {
    maxRetries = 3,
    retryDelay = 2000,
    timeout = 30000,
    componentName = 'Unknown'
  } = options;

  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount <= maxRetries) {
    try {
      console.log(`🔄 ${componentName} - Attempting API call (attempt ${retryCount + 1}/${maxRetries + 1})`);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
      });

      // Create fetch promise
      const fetchPromise = fetch(`https://backend-11kr.onrender.com/${endpoint}`, {
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
        
        // Check for rate limit error (429)
        if (response.status === 429) {
          console.warn(`⚠️ ${componentName} - Rate limit hit, will retry with longer delay`);
          // Wait longer for rate limit errors
          await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
        }
        
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
      retryCount++;
      lastError = error as Error;
      
      console.error(`❌ ${componentName} - API call failed (attempt ${retryCount}/${maxRetries + 1}):`, error);
      
      if (retryCount > maxRetries) {
        console.error(`❌ ${componentName} - All retries exhausted`);
        break;
      }
      
      // Calculate delay based on error type
      let delay = retryDelay;
      if (lastError.message.includes('429') || lastError.message.includes('rate limit')) {
        delay = Math.min(retryDelay * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
        console.log(`⏳ ${componentName} - Rate limit detected, waiting ${delay}ms before retry...`);
      } else {
        console.log(`⏳ ${componentName} - Waiting ${delay}ms before retry...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error occurred',
    statusCode: 500
  };
};

/**
 * Market research specific API call wrapper
 */
export const marketResearchApiCall = async (
  componentName: string,
  payload: any,
  options: ApiCallOptions = {}
): Promise<ApiResponse> => {
  return enhancedApiCall('market-research', payload, {
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
