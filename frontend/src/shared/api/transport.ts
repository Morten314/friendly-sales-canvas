// API utility for handling base URL and proxy configuration

// Single source of truth for the deployed backend host. Still consumed by the
// handful of components that make raw direct-backend calls (streaming `/chat/`,
// `/ask`, `/profile/company`) — those bypasses are tracked separately as debt.
export const BACKEND_BASE_URL = "https://brewra-gtm-intelligence.onrender.com";

// Every environment routes the client stack through `/api`:
//   - dev / `vite preview` / localhost e2e → the Vite dev proxy (and Playwright's
//     `**/api/*` route handlers) serve `/api/*`.
//   - Vercel production → the `vercel.json` rewrite proxies `/api/*` → Render.
// Production formerly called Render directly to dodge Vercel's ~120s edge gateway
// timeout, because the Claude signal batch ran ~120s sequentially. The batch now
// runs its calls concurrently (~40–45s, well under the ceiling), so the
// direct-to-Render workaround is retired in favor of `/api` — dev/prod parity and
// no reliance on the CORS wildcard for the main client path. (Cold-start margin
// note: see docs/TECH_DEBT.md.)
const API_BASE_URL = "/api";

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
