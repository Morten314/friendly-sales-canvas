// API utility functions for improved error handling and retry logic

interface ApiCallOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  showLoading?: boolean;
  componentName?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * Simple API call function - NO RETRIES, just single attempt
 */
const simpleApiCall = async <T = unknown>(
  endpoint: string,
  payload: unknown,
  options: ApiCallOptions = {},
): Promise<ApiResponse<T>> => {
  const { timeout = 30000, componentName = "Unknown" } = options;

  try {
    console.log(`🔄 ${componentName} - Making single API call`);

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
    });

    // Create fetch promise
    const fetchPromise = fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    console.log(`📨 ${componentName} - API response status:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as T;
    console.log(`✅ ${componentName} - API call successful`);

    return {
      success: true,
      data: result,
      statusCode: response.status,
    };
  } catch (error) {
    console.error(`❌ ${componentName} - API call failed:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      statusCode: 500,
    };
  }
};

/**
 * Market research specific API call wrapper - NO RETRIES
 */
export const marketResearchApiCall = async (
  componentName: string,
  payload: unknown,
  options: ApiCallOptions = {},
): Promise<ApiResponse> => {
  return simpleApiCall("market-research_claude", payload, {
    ...options,
    componentName,
  });
};

/**
 * Check if we should fall back to cached data
 */
export const shouldUseCachedData = (apiResponse: ApiResponse, refresh: boolean): boolean => {
  // If refresh is forced and API failed, we might still want to use cached data
  if (refresh && !apiResponse.success) {
    console.log("⚠️ API failed during refresh, considering cached data fallback");
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
    const data = result.data;
    const hasValidShape =
      typeof data === "object" &&
      data !== null &&
      "status" in data &&
      (data as { status: unknown }).status === "success" &&
      "data" in data &&
      Boolean((data as { data: unknown }).data);
    if (hasValidShape) {
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
