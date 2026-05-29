---
artifact: specs/20-frontend-phase-3-api-data-layer-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Findings

### [Critical] `executeWithRateLimit` call-site count is off by ~10x

**Location:** §1.2 table row "Rate limiter" ("~44 call sites"), §2.2 ("~44 legacy `executeWithRateLimit` feature sites"), §3.2 ("~44 legacy … sites"), §3.2 design paragraph, §4 DoD item 2 ("~44 legacy `executeWithRateLimit` sites")

The spec claims "~44 call sites" for `executeWithRateLimit` across multiple sections. Actual count: **4 active consumer call sites** (IndustryTrendsSection, MarketEntrySection, RegulatoryComplianceSection, MarketSizeSection — all under `src/components/market-research/`). The `~44` figure likely counts something else (perhaps all `rateLimitManager.ts`-related references including tests, exports, and comments), but as a measure of "sites that need the shim", it is wrong by an order of magnitude.

This inflates the perceived complexity and risk of the shared-limiter shim (§3.2). The entire invariant — "one budget, one instance, ~44 untouched sites depending on it" — is architecturally sound regardless, but the urgency and blast-radius framing are overstated. The plan should use the real count.

### [Critical] `ApiService` has zero call sites, not two

**Location:** §1.2 table row "Alt client" ("2 call sites"), §3.9 ("2 call sites"), §3.11 files-touched table

No file in `src/` imports from `services/api` or references `ApiService`. `src/services/api.ts` exports a default `new ApiService()` instance, but nothing consumes it. The spec's plan to "migrate its 2 call sites; delete the file" cannot execute as written — there are no call sites to migrate. This changes §3.9 from a migration task to a simple deletion (verify unused, delete, confirm `knip --strict` passes).

**Suggestion:** Update §3.9 and §3.11 to reflect the actual state: `ApiService` is dead code. The plan task becomes "verify zero consumers, delete the file, confirm `knip` clean" — no migration needed.

### [High] `apiFetch`/`apiFetchJson` direct-call-site count overstated

**Location:** §1.2 table row "Base transport" ("~19 direct call sites")

Actual count: **8 calls across 6 consumer files** (SuggestedICPCards: 3, ICPManager: 1, IndustryTrendsSection: 1, MarketEntrySection: 1, RegulatoryComplianceSection: 1, MarketSizeSection: 1). The "~19" figure may be conflating with raw `fetch()` calls (there are many more of those via bare `fetch()` across pages and components). The distinction matters because `client.ts` wraps `apiFetchJson`, not bare `fetch()` — the spec should accurately separate the two populations.

**Suggestion:** Audit and report both counts separately: (a) files calling `apiFetch`/`apiFetchJson` directly (6 files, 8 calls), and (b) files using bare `fetch()` (much larger). The latter don't go through the rate limiter at all today and have a different migration profile.

### [High] No bare-`fetch()` migration strategy stated

**Location:** §2.1, §2.2, §3.6

CompanyProfile.tsx, MissionControl.tsx, MarketResearch.tsx, Signals.tsx, Settings.tsx, UserProfile.tsx, AgentProfile.tsx — all use bare `fetch()` rather than `apiFetch`. CompanyProfile (the flagship slice, §3.6) is one of these. The spec says `client.ts` "wraps `apiFetchJson` transport" (§3.3), but CompanyProfile's current `fetch()` call doesn't go through `apiFetch`. The migration must either: (a) rewrite CompanyProfile's fetch to go through `apiFetch` → `client.ts`, or (b) have `client.ts` accept a raw-fetch path too. The spec doesn't acknowledge this distinction.

**Suggestion:** §3.6 should explicitly state that CompanyProfile's bare `fetch()` is being replaced with `apiFetchJson` (to get JWT injection) before being wrapped by `client.ts`. If any of the other bare-`fetch()` sites have different error handling or headers, call that out.

### [Medium] `useTenants` over a mock is architectural dead weight

**Location:** §3.7

`useTenants(userId)` wraps a `useQuery` around a hardcoded mock (no backend endpoint exists). The spec says "Phase 10 swaps in a real endpoint by editing only the `queryFn`." This is technically true but introduces a zod contract (`contracts/tenant.ts`) validated against... a mock. The contract doesn't protect against backend drift because there is no backend. The value of the zod layer here is purely structural (proving the pattern), not contractual.

**Suggestion:** Consider whether Slice 2 warrants zod validation or should be deferred until there's a real endpoint. If kept, explicitly label `contracts/tenant.ts` as "mock-derived, to be re-validated against a live endpoint when one exists." Otherwise the plan author may waste time capturing a "live response" (§3.5) that doesn't exist.

### [Medium] §1.2 starting-state table mixes verified and unverified claims

**Location:** §1.2 subtitle "(verified 2026-05-29)"

The "(verified 2026-05-29)" tag asserts the entire table is ground-truth, but at least three rows contain wrong call-site counts (as documented above). The verification tag creates false confidence. The table's structure and most of its claims are accurate and valuable, but the specific numbers are not.

**Suggestion:** Either remove the global verification tag and annotate each row individually, or re-verify the counts and correct them before the plan phase.

### [Medium] `skipAuth` mode is under-specified for plan-readiness

**Location:** §3.3 ("client.ts exposes a `skipAuth` mode (or a no-auth transport variant; plan decides)"), §3.8, R7, §7 Q8

The auth-endpoint recursion risk (R7) is well-identified, but the solution is deferred to the plan with two qualitatively different options on the table: (a) an option flag on `client.ts` (`skipAuth: true`), or (b) a separate no-auth transport function. These have different implications for the type signature, test surface, and how future endpoints opt in/out. This isn't a trivial "exact value" question — it's a design decision that shapes `client.ts`'s public API.

**Suggestion:** Narrow to one approach in the spec (the simpler one — a `skipAuth` option flag seems likely given `apiFetch` already handles JWT internally), and let the plan decide only the implementation details (parameter name, default value). This reduces plan-author discretion to a safe level.

### [Medium] No error-propagation strategy from `client.ts` to callers

**Location:** §3.3

The spec says `schema.parse(json)` throws on drift and "lands in the query's `error` state." But what about rate-limit queue timeouts or `apiFetch` non-2xx throws? Those are different error types (network vs. contract vs. rate-limit) and the spec doesn't address whether `client.ts` normalizes them, lets them propagate raw, or wraps them in a custom error type. TanStack Query's `error` state is just `Error | null` — callers need to know what they're catching.

**Suggestion:** Add a brief paragraph to §3.3 describing the error taxonomy: rate-limit timeout, HTTP non-2xx (from `apiFetch`), zod parse failure. State whether they're distinguished (custom classes / error properties) or treated uniformly. This affects every hook author.

### [Low] §4 DoD item 7 references `npm run preflight` — confirm this is the right command for Phase 3

**Location:** §4 item 7, §1.2 line 32

The spec states the preflight chain includes `typecheck → lint → format:check → test → build → bundle:check (advisory) → test:e2e → knip --strict`. This was established by Phase 2c. The question is whether the Phase 3 spec should re-list the full chain or just say "the preflight chain established in Phase 2c." Re-listing risks drift if Phase 2c's chain changes; deferring to Phase 2c's definition is more maintainable.

**Suggestion:** Replace the inline chain enumeration with a reference to Phase 2c's canonical definition.

### [Low] Risk R5 (zod bundle cost) cites ~14 kB gz without source

**Location:** R5

The "~14 kB gz" figure for zod is plausible but unsourced. If the Phase 2c `bundle:check` is advisory and prints the delta, the exact number doesn't need to be precise in the spec — but if it's being used to justify the cost, a source (bundlephobia, actual measurement) would strengthen the claim.

### [Nit] `queryKeys.ts` described as "typed query-key factory" without example

**Location:** §3.1, §3.5

The spec references `qk.companyProfile(orgId)` as an example (§3.5) but the §3.1 tree listing calls it a "typed query-key factory" without showing the type. This is fine for a spec (the plan will elaborate), but the §7 Q2 deferral ("array-tuple convention vs string builder") could be resolved here — the TanStack ecosystem convention is strongly array-tuple, and deviating would need explicit justification.

### [Nit] §3.10 amendment commit message is unusually prescriptive

**Location:** §3.10

The spec prescribes the exact commit message: `docs(spec-14): amend Phase 3 — real data layer, zod, 30/min, QueryClient mounted`. This level of detail is unusual for a spec and belongs in the plan. Not harmful, but slightly over-specified.

### [Nit] §5 per-phase workflow repeats the master plan's workflow verbatim

**Location:** §5

The 8-step workflow is identical to master Spec 14 §5. A one-line reference ("Standard master Spec 14 §5 cycle") would suffice; the full enumeration adds length without information. (The spec does include the one-liner — the numbered list that follows is the redundant part.)
