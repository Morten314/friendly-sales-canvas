import type { ZodType } from "zod";

import { rateLimiter } from "./rateLimiter";
import { apiFetchJson, buildApiUrl, type ApiFetchOptions } from "./transport";

// ── Normal path ────────────────────────────────────────────────────────────
// Routes through apiFetchJson, so JWT is injected by apiFetch and a non-2xx
// throws. The shared limiter wraps the call; the response is zod-parsed at the
// boundary (.parse — loud failure is the point). A ZodError, an HTTP error, or a
// rate-limit rejection propagates to the caller (TanStack Query's `error` state)
// distinctly — client.ts does not normalize them (spec 20 §3.3 error taxonomy).
export async function apiRequest<T>(
  endpoint: string,
  schema: ZodType<T>,
  options: ApiFetchOptions = {},
): Promise<T> {
  const json = await rateLimiter.executeWithRateLimit(
    () => apiFetchJson(endpoint, options),
    endpoint,
  );
  return schema.parse(json);
}

export function apiGet<T>(endpoint: string, schema: ZodType<T>): Promise<T> {
  return apiRequest(endpoint, schema, { method: "GET" });
}

export function apiPost<T>(
  endpoint: string,
  body: Record<string, unknown>,
  schema: ZodType<T>,
): Promise<T> {
  return apiRequest(endpoint, schema, { method: "POST", body });
}

// ── Auth-endpoint path ───────────────────────────────────────────────────────
// For /api/auth/token and /api/auth/refresh ONLY. Uses a bare, non-throwing
// fetch (NOT apiFetch): no JWT injection — getAuthHeader refreshes-if-expired via
// refreshAccessToken, so a JWT-injecting auth call would recurse (spec 20 R7).
// Still draws from the shared limiter. zod runs only on a 2xx body; the caller
// branches on `ok`/`status` to preserve each method's status semantics.
export interface AuthEndpointResult<T> {
  ok: boolean;
  status: number;
  data: T | null; // parsed only when ok (2xx)
}

export async function authEndpointRequest<T>(
  endpoint: string,
  schema: ZodType<T>,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<AuthEndpointResult<T>> {
  const url = buildApiUrl(endpoint);
  const response = await rateLimiter.executeWithRateLimit(
    () =>
      fetch(url, {
        method: options.method ?? "POST",
        headers: { "Content-Type": "application/json", ...options.headers },
        body: options.body != null ? JSON.stringify(options.body) : undefined,
      }),
    endpoint,
  );

  if (!response.ok) {
    return { ok: false, status: response.status, data: null };
  }
  const json = await response.json();
  return { ok: true, status: response.status, data: schema.parse(json) };
}
