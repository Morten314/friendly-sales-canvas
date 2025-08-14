// API utility for handling base URL and proxy configuration
const isDevelopment = import.meta.env.DEV;

// Use proxy in development, direct URL in production
export const API_BASE_URL = isDevelopment 
  ? '/api' 
  : 'https://backend-11kr.onrender.com';

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Helper function for fetch with common configuration
export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = buildApiUrl(endpoint);
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  console.log(`🌐 API Request: ${defaultOptions.method || 'GET'} ${url}`);
  
  const response = await fetch(url, defaultOptions);
  
  console.log(`📨 API Response: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ API Error: ${response.status} - ${errorText}`);
    console.error(`❌ API Error URL: ${url}`);
    console.error(`❌ API Error Method: ${defaultOptions.method || 'GET'}`);
    console.error(`❌ API Error Headers:`, defaultOptions.headers);
    if (defaultOptions.body) {
      console.error(`❌ API Error Body:`, defaultOptions.body);
    }
    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }
  
  return response;
};

// Helper function for JSON responses
export const apiFetchJson = async (endpoint: string, options: RequestInit = {}) => {
  const response = await apiFetch(endpoint, options);
  return response.json();
};

