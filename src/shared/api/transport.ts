// API utility for handling base URL and proxy configuration. Both values are
// env-driven (spec 42) — no literal URLs — so the same build runs against
// production or staging purely by its Vite build-time env vars.

// Single source of truth for the deployed backend host. Consumed by the handful
// of components that make raw direct-backend calls (streaming `/chat/`, `/ask`,
// `/profile/company`).
export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

// Base for the client API stack:
//   - local dev: set to `/api` → the Vite dev proxy forwards to the backend.
//   - deployed (Vercel): set to the full backend URL → the client calls Render
//     directly (spec 42 D3 dropped the `vercel.json` /api rewrite), relying on
//     the backend's env-driven CORS allow-list.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;

  // Use proxy for all endpoints in development to avoid CORS issues
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Extended options type that allows object body (will be JSON stringified)
export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | Record<string, unknown> | null;
}

// Helper function for fetch with common configuration
export const apiFetch = async (endpoint: string, options: ApiFetchOptions = {}) => {
  const url = buildApiUrl(endpoint);

  // Handle body stringification for JSON requests
  let processedBody = options.body;
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    console.log("🔧 API Fetch: Converting object body to JSON string");
    processedBody = JSON.stringify(options.body);
    console.log("🔧 API Fetch: Body type after processing:", typeof processedBody);
  } else {
    console.log("🔧 API Fetch: Body type:", typeof options.body);
  }

  // Get JWT token for authentication
  let authHeader = "";
  try {
    const jwtManager = (await import("@/shared/auth/jwt")).default;
    authHeader = await jwtManager.getAuthHeader();
  } catch (error) {
    console.warn("🔐 No JWT token available for API request:", error);
  }

  const defaultOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...(authHeader && { Authorization: authHeader }),
      ...options.headers,
    },
    ...options,
    body: processedBody as BodyInit | null | undefined,
  };

  console.log(`🌐 API Request: ${defaultOptions.method || "GET"} ${url}`);
  console.log(`🔗 Full URL: ${url}`);

  const response = await fetch(url, defaultOptions);

  console.log(`📨 API Response: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ API Error: ${response.status} - ${errorText}`);
    console.error(`❌ API Error URL: ${url}`);
    console.error(`❌ API Error Method: ${defaultOptions.method || "GET"}`);
    console.error(`❌ API Error Headers:`, defaultOptions.headers);
    if (defaultOptions.body) {
      console.error(`❌ API Error Body:`, defaultOptions.body);
    }
    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }

  return response;
};

// Helper function for JSON responses
export const apiFetchJson = async (endpoint: string, options: ApiFetchOptions = {}) => {
  const response = await apiFetch(endpoint, options);
  return response.json();
};
