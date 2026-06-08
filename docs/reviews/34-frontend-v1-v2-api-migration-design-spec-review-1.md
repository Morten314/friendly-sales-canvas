---
artifact: specs/34-frontend-v1-v2-api-migration-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-08
round: 1
---

## Findings

### [High] `fetchDataSources` return type contradicts G4 (thread `total` through)

**Location:** §4.2 ("total is carried alongside where the return type allows"), §2 G4, §8 R6

`fetchDataSources` returns `Promise<unknown[]>` — a flat array. There is nowhere to attach `total` without changing the return type to something like `{ items: unknown[]; total: number }`, which would break every consumer (violating G5). The spec handwaves this with "where the return type allows (additive)" but never resolves the contradiction.

R6 asserts "total is available on each service return" — this is falsified for `fetchDataSources` unless the return type changes.

**Suggestion:** Either (a) change `fetchDataSources` to return `{ items: unknown[]; total: number }` and update its single consumer (`useDataSources`) to destructure — this is a minimal, contained consumer change, not a behavioral break; or (b) drop G4/R6 for `fetchDataSources` specifically and note that `total` is only available for the two raw-`fetch` services (where re-wrapping into the passthrough schema can carry it).

### [High] v1 `/icp` was not "unbounded" — it is also capped at 500

**Location:** §3.1 table, row 3 (`limit` rationale): "v1 `/icp` was unbounded"

The v1 `/icp` endpoint docstring (`backend/app/routers/icp.py:29`) says: "Returns the user's ICP list (typically 5-10 items; hard cap of 500)." The v1 service `list_icps` is the same function the v2 endpoint calls — it has the same internal cap. The spec's "unbounded" claim is factually wrong; v1 `/icp` was also capped at 500 (just like `user-documents`). This doesn't change the migration approach (500 ceiling is still correct), but the rationale should be corrected to avoid misleading future readers.

### [High] `total` threading for signals and ICP is structurally invisible

**Location:** §4.2 (adaptation principle for `fetchSignals` and `fetchSuggestedIcps`)

Both services re-wrap v2's `items` into the legacy shape (`{ signals: items }` and `{ suggestedICPs: items }`) and parse through passthrough schemas (`z.object({}).passthrough()`). The passthrough schemas accept arbitrary extra keys, so `total` *can* be present in the returned object — but the schemas don't declare it, and no consumer reads it. The spec says `total` is "available" but the TypeScript type of the return value (`FetchSignalsResponse` / `SuggestedIcpsResponse`) won't include `total` in its type signature. Any consumer accessing `data.total` would get a type error.

**Suggestion:** If the goal is to make `total` genuinely available (not just present at runtime in an untyped bag), the re-wrapped objects should have an explicit `total` field in their type — either by tightening the schemas or by returning a distinct typed object. If "available" means "present in the runtime JS object but not typed," say so explicitly and flag it as TD-FE-XX (type widening needed when pagination UX is added).

### [Medium] `paginatedSchema` generic default uses unsafe double-cast

**Location:** §4.1 (`paginatedSchema` definition)

```ts
export const paginatedSchema = <T extends z.ZodTypeAny>(item: T = z.unknown() as unknown as T) =>
```

The `as unknown as T` double-cast forces TypeScript to accept `z.unknown()` as `T`, but when called without arguments, `T` resolves to `z.ZodTypeAny` (the widest type), making `z.infer<T>` = `any`. This means `items` becomes `any[]` instead of `unknown[]` — strictly less type-safe than the spec's stated intent of loose items.

**Suggestion:** Either require the item schema argument explicitly (all three callers know what they're parsing, even if it's `z.unknown()`), or use an overload/conditional signature. The simplest fix: drop the default entirely and always pass the item schema at each call site.

### [Medium] Signals and ICP reads bypass JWT + rate limiting — migration preserves the gap

**Location:** §4.2 (`fetchSignals`, `fetchSuggestedIcps`), §4.3

Both `fetchSignals` and `fetchSuggestedIcps` use raw `fetch` without JWT injection or rate limiting. `fetchDataSources` uses `apiGet` → `apiFetch` → JWT + rate limiter. The spec preserves this inconsistency (G5: "preserve every consumer's existing behavior"). This is defensible for scope control, but the spec never acknowledges the gap, which means a reader might assume all reads are uniformly handled.

**Suggestion:** Add an explicit note in §2 Non-goals or §4.4 acknowledging the JWT/rate-limit inconsistency and flagging it as accepted TD. A future spec to unify all reads onto `apiGet` would close this gap.

### [Medium] `buildIcpUrl` fold changes the network path — no discussion of auth implications

**Location:** §4.3

Currently `buildIcpUrl` resolves to `${BACKEND_BASE_URL}/icp?...` — a direct cross-origin call to the backend host, bypassing the `/api` proxy entirely. After the fold, the ICP read goes through `buildApiUrl("v2/icp?...")` → `/api/v2/icp?...` → proxied to the backend. In dev, this routes through Vite's proxy; in prod, it resolves identically. But the direct-to-backend call currently has no auth headers (raw `fetch`), while the proxy path *could* have auth headers if `apiFetch` were used. Since the spec keeps it as raw `fetch`, the auth situation is unchanged — but the network path is different (proxy vs direct).

**Suggestion:** Confirm that the Vite proxy config and prod `vercel.json` already handle `/api/v2/icp` (they should by prefix match). A brief sentence noting the path change is verified would strengthen confidence.

### [Medium] §9 done-when grep will match the POST mutation URL

**Location:** §9.2: "grep shows zero FE references to v1 `/user-documents`, `/fetch-signals`, `/icp` reads"

`generateSignalsBatch` POSTs to `/api/generate-signals-batch` which contains the substring `fetch-signals`. A naive `grep fetch-signals` would match this POST even though it's explicitly out of scope (N4). Similarly, `rejectRecommendedIcp` hits `icp/recommended/{id}` and `deleteCurrentIcp` hits `customer_profile/icp/{id}` — both contain `/icp`.

**Suggestion:** Refine the grep criterion to specify matching only GET reads (e.g., `fetch.*fetch-signals` or `"/api/fetch-signals?` with the query param marker), or list the exact strings that must be absent.

### [Medium] `useFetchSignals` repointing description is misleading

**Location:** §4.4: "Repoint the pre-positioned-but-unused `useFetchSignals` hook to the v2 path"

`useFetchSignals` doesn't know about URLs — it delegates to `fetchSignals(userId)` which is the service function. The actual URL change happens in `services/signals.ts`. The hook's test (`useFetchSignals.test.tsx`) does intercept `/api/fetch-signals` via inline MSW, so the test's handler path needs updating — but the hook code itself doesn't change.

**Suggestion:** Rephrase to: "Update the `useFetchSignals` test's MSW handler from `/api/fetch-signals` to `/api/v2/fetch-signals`." The hook code itself is unchanged.

### [Low] `firstPageParams` is a trivial helper for a two-segment string

**Location:** §4.1 (`firstPageParams`)

```ts
export const firstPageParams = (limit: number) => `limit=${limit}&offset=0`;
```

This produces `limit=500&offset=0` — a string used at most 3 times (2× with `limit=500`, 1× with `limit=10`). Inline string interpolation would be equally clear and avoid the indirection. The function also silently drops `offset=0` as a constant, which is correct for single-page reads but obscures the fact that the offset parameter exists.

**Suggestion:** Keep it if you anticipate pagination UX adding variable offsets later. If not, inline it. The current helper is not harmful, just slightly over-specified for the scope.

### [Low] Spec doesn't mention comment updates in components

**Location:** `DataSourcesManager.tsx:150,215` (comments referencing "from /user-documents")

The grep criterion in §9.2 would catch these comment references. The spec says nothing about updating comments. This is a minor gap — the comments should be updated to reflect the v2 path, but it's cosmetic.

### [Low] v1 `user-documents` returns `{ status, count, files }` — not `{ documents, files, data }`

**Location:** §3.1 table, row 1: `.documents ?? .files ?? .data ?? []`

The actual v1 backend response is `{"status": "success", "count": len(items), "files": items}` — keyed under `files`, not `documents`. The FE's `DataSourceListSchema` union handles both shapes (bare array + `{documents|files|data}` envelope), and the code falls through to `.files` correctly. The spec's description isn't wrong about what the FE code does, but it slightly misrepresents the actual v1 response shape. Worth clarifying for the implementer.

### [Nit] §10 risks section doesn't mention proxy path regression

**Location:** §10 (Risks / abort criteria)

The `buildIcpUrl` fold changes the ICP call from direct-backend to proxied. If the proxy config is misconfigured (or if a future change breaks the `/api/v2/*` proxy rules), the ICP read would silently fail in dev. The spec mentions `apiGet` schema coupling as a risk but not the proxy-path change for the ICP endpoint specifically.

### [Nit] `paginatedSchema` defaults mask missing required fields from backend

**Location:** §4.1

The backend `PaginatedResponse` marks `total`, `limit`, `offset` as required (`Field(ge=0)` etc.). The frontend `paginatedSchema` applies `.default(0)` to all three, so a malformed backend response with missing fields would silently pass validation with `0` values. This is a reasonable defensive choice (spec acknowledges it: "missing scalar fields default"), but it means the FE contract is strictly looser than the BE contract. Not a bug, just worth noting.

### [Nit] TD-FE-67 numbering should be confirmed

**Location:** §7: "New TD-FE-67 (residual)"

The spec introduces TD-FE-67 without verifying that TD-FE-66 isn't already taken. Should be confirmed against `docs/TECH_DEBT.md` before the plan phase.

## Summary

The spec is well-structured, tightly scoped, and demonstrates strong understanding of the codebase. The three read migrations are correctly identified and the adaptation strategy (v2 envelope → legacy shape re-wrap) is sound. The main issues are:

1. The `total` threading claim (G4/R6) is in direct tension with G5 for `fetchDataSources` — the return type must change or the goal must be narrowed.
2. The v1 `/icp` "unbounded" claim is factually incorrect.
3. `total` is "available" only in untyped passthrough objects — not in any TypeScript-visible type.
4. Several medium-severity gaps around the raw-`fetch` vs `apiGet` inconsistency, misleading `useFetchSignals` phrasing, and grep criterion imprecision.

None of these require re-thinking the approach — they're fixable with spec amendments before plan writing.
