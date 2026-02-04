// API utility for handling base URL and proxy configuration
const isDevelopment = import.meta.env.DEV;
const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1'
);
const isVercel = import.meta.env.VITE_VERCEL || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'));

// IMPORTANT: Vite proxy only works on localhost. 
// In Lovable preview (lovable.app) or other non-localhost environments, use direct backend URL
const shouldUseProxy = isDevelopment && isLocalhost;

// Use proxy only in local development, direct URL everywhere else
export const API_BASE_URL = shouldUseProxy
  ? '/api' 
  : 'https://backend-11kr.onrender.com';

console.log('🔧 API Config:', { 
  isDevelopment, 
  isLocalhost, 
  isVercel, 
  shouldUseProxy, 
  API_BASE_URL,
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown'
});

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // Use proxy for local dev only, direct URL for all other environments
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Extended options type that allows object body (will be JSON stringified)
export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, any> | null;
}

// Helper function for fetch with common configuration and retry logic
export const apiFetch = async (endpoint: string, options: ApiFetchOptions = {}, retries = 2): Promise<Response> => {
  const url = buildApiUrl(endpoint);
  
  // Handle body stringification for JSON requests
  let processedBody = options.body;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    console.log('🔧 API Fetch: Converting object body to JSON string');
    processedBody = JSON.stringify(options.body);
    console.log('🔧 API Fetch: Body type after processing:', typeof processedBody);
  } else {
    console.log('🔧 API Fetch: Body type:', typeof options.body);
  }
  
  // Get JWT token for authentication
  let authHeader = '';
  try {
    const jwtManager = (await import('./jwt')).default;
    authHeader = await jwtManager.getAuthHeader();
  } catch (error) {
    console.warn('🔐 No JWT token available for API request:', error);
  }
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader && { 'Authorization': authHeader }),
      ...options.headers,
    },
    ...options,
    body: processedBody as BodyInit | null | undefined,
  };

  console.log(`🌐 API Request: ${defaultOptions.method || 'GET'} ${url}`);
  console.log(`🔗 Full URL: ${url}`);
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt}/${retries} for ${url}`);
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
      }
      
      const response = await fetch(url, defaultOptions);
      
      console.log(`📨 API Response: ${response.status} ${response.statusText}`);
      
      // Check if response is HTML instead of JSON (indicates server error page)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html') && !response.ok) {
        const htmlContent = await response.text();
        console.error(`❌ API returned HTML error page (status ${response.status})`);
        
        // If server is waking up (503), retry
        if (response.status === 503 && attempt < retries) {
          console.log('⏳ Server may be cold starting, will retry...');
          lastError = new Error(`Server unavailable (503). The backend may be starting up.`);
          continue;
        }
        
        throw new Error(`Server returned HTML error page (status ${response.status}). The backend may be unavailable.`);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status} - ${errorText}`);
        console.error(`❌ API Error URL: ${url}`);
        console.error(`❌ API Error Method: ${defaultOptions.method || 'GET'}`);
        console.error(`❌ API Error Headers:`, defaultOptions.headers);
        if (defaultOptions.body) {
          console.error(`❌ API Error Body:`, defaultOptions.body);
        }
        
        // Retry on server errors
        if (response.status >= 500 && attempt < retries) {
          lastError = new Error(`HTTP error! status: ${response.status} - ${errorText}`);
          continue;
        }
        
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      return response;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Network errors - retry
      if (error instanceof TypeError && error.message.includes('fetch') && attempt < retries) {
        console.warn(`⚠️ Network error, will retry: ${error.message}`);
        continue;
      }
      
      // If this was the last attempt, throw
      if (attempt >= retries) {
        throw lastError;
      }
    }
  }
  
  throw lastError || new Error('Unknown API error');
};

// Helper function for JSON responses
export const apiFetchJson = async (endpoint: string, options: ApiFetchOptions = {}) => {
  const response = await apiFetch(endpoint, options);
  return response.json();
};

