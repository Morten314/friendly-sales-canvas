// API utility for handling base URL and proxy configuration. Both values are
// env-driven (spec 42) — with safe defaults so Lovable/GitHub sync never yields
// `undefined/...` URLs when .env is momentarily missing during workspace boot.

/** Deployed Brewra backend — also the vite.config.ts proxy fallback. */
const DEFAULT_BACKEND_BASE_URL = "https://brewra-gtm-intelligence-1.onrender.com";

/** `/api` only works behind the local Vite dev proxy; static/Lovable hosts need absolute URLs. */
function isLocalViteDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function resolveBackendBaseUrl(): string {
  const configured = stripEnvQuotes(import.meta.env.VITE_BACKEND_BASE_URL || "");
  if (!configured) return DEFAULT_BACKEND_BASE_URL;
  if (configured.startsWith("/") && !isLocalViteDevHost()) return DEFAULT_BACKEND_BASE_URL;
  return configured.replace(/\/$/, "");
}

function resolveApiBaseUrl(): string {
  const configured = stripEnvQuotes(import.meta.env.VITE_API_BASE_URL || "");
  if (!configured) return DEFAULT_BACKEND_BASE_URL;
  if (configured.startsWith("/") && !isLocalViteDevHost()) return DEFAULT_BACKEND_BASE_URL;
  return configured.replace(/\/$/, "");
}

/** Runtime-resolved backend host for raw direct-backend calls (`/chat/`, `/ask/`, …). */
export function getBackendBaseUrl(): string {
  return resolveBackendBaseUrl();
}

/** @deprecated Prefer `getBackendBaseUrl()` — build-time only; wrong on stale Lovable builds. */
export const BACKEND_BASE_URL = DEFAULT_BACKEND_BASE_URL;

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return `${resolveApiBaseUrl()}/${cleanEndpoint}`;
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
