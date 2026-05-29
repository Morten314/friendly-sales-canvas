// Compatibility shim. The rate limiter moved to src/shared/api/rateLimiter.ts
// (spec 20 §3.2). The 4 market-research consumers import `executeWithRateLimit`
// from here and keep working; `rateLimitManager` is the SAME single shared
// instance (aliased from `rateLimiter`), so legacy + TanStack paths share one
// 30/min budget. These sites migrate to the shared import in Phase 5.
export {
  RateLimitManager,
  RATE_LIMIT_RPM,
  executeWithRateLimit,
  rateLimiter as rateLimitManager,
} from "@/shared/api/rateLimiter";
