---
synthesizes_review: docs/reviews/20-frontend-phase-3-api-data-layer-design-spec-review-1.md
artifact: specs/20-frontend-phase-3-api-data-layer-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 1
---

## Round Recommendation

maybe

Reason: All Critical/High findings were factual call-site-count errors — verified against the code and corrected this round (no design decision changed). Remaining additions (error taxonomy, skipAuth narrowing, Q2 resolution) are low-risk gap-closures. A confirmatory round-2 review adds marginal value; given the verified-by-grep corrections and the MVP velocity posture, proceeding to `/writing-plans` is a reasonable default. Operator's call.

## Agreed Findings

- **F1 [Critical] — `executeWithRateLimit` count.** Verified by grep: **4** active consumer call sites (MarketSize, IndustryTrends, MarketEntry, RegulatoryCompliance — all `src/components/market-research/`), not ~44 (the inflated figure counted the def + 13 test occurrences + imports). Corrected §1.2, §2.2, §3.2 (×2), §4 DoD-2. Since all 4 are market-research, §2.2 now says they convert in **Phase 5**, not "5–10".
- **F2 [Critical] — `ApiService` consumers.** Verified: **0** consumers (`rg` for `services/api`/`ApiService` outside the def file returns nothing). It is dead code. §2.1, §3.9, §3.11, §4 DoD-5 changed from "absorb + migrate 2 call sites" to "verify-unused, delete, `knip` clean." Nothing to absorb (the `get/post/put/delete` + 401-retry never run).
- **F3 [High] — `apiFetch`/`apiFetchJson` count.** Verified: **8 calls across 6 files**, not ~19. Corrected §1.2; added an explicit note that a much larger bare-`fetch()` population bypasses this transport (and JWT) entirely.
- **F4 [High] — bare-`fetch()` migration strategy.** Verified: `CompanyProfile.tsx` uses bare `fetch()` (`:57` GET, `:387` save) and does **not** import `apiFetch`. §3.3 and §3.6 now state explicitly that CompanyProfile's bare `fetch()` is converted to `apiFetchJson` (gaining JWT injection) before `client.ts` wraps it.
- **F5 [Medium] — `useTenants` zod over a mock.** §3.7 now labels `contracts/tenant.ts` **mock-derived** (structural, not a drift guard) and notes Phase 10 re-validates it against the real endpoint. §3.5's live-capture list already excluded tenant, so no false "capture a live response" instruction existed.
- **F6 [Medium] — "(verified 2026-05-29)" tag.** Resolved by F1–F3: the counts are now grep-verified true, so the tag is accurate. Retained.
- **F7 [Medium] — `skipAuth` under-specified.** Narrowed to a single approach in §3.3/§3.8/R7: a **`skipAuth` option flag** on `client.ts`. §7 Q8 reduced to "param name + default" only.
- **F8 [Medium] — error-propagation taxonomy.** Added a §3.3 paragraph: three distinct catchable types reach TanStack's `error` state — rate-limit timeout/rejection, HTTP non-2xx (from `apiFetch`), and `ZodError`. `client.ts` does not swallow/normalize; whether to add a unifying `ApiError` wrapper is a new §7 plan question (default: raw propagation).
- **F9 [Low] — DoD preflight chain.** §4-7 now references the Phase 2c canonical chain (Spec 19 §3.3) instead of re-enumerating it, removing the drift risk.
- **F10 [Low] — R5 zod size source.** Softened to "~12–14 kB gz (zod v3 min+gzip); advisory `bundle:check` reports the actual delta at impl."
- **F11 [Nit] — query-key convention.** §7 Q2 marked **RESOLVED**: array-tuple (TanStack ecosystem standard, `["company-profile", orgId]`); §3.5 states the tuple form.
- **F12 [Nit] — §3.10 commit message.** Softened from a prescribed exact string to an illustrative example with "exact message per plan."

## Disagreed Findings

- **F13 [Nit] — §5 workflow enumeration redundant.** Partial disagree. The numbered list is not verbatim-redundant with master Spec 14 §5: it specializes the generic cycle with this phase's artifact paths (the `20-…` filenames), the branch name (`phase-3-api-data-layer`), and the vertical-slice execution order (step 6). The one-liner alone would drop that phase-specific information. Left as-is.

## Deferred Findings

N/A — every finding was resolved this round (agreed-and-revised or disagreed-with-reasoning); none deferred.

## Severity Disagreements

- **F1 & F2 (reviewer: Critical → mine: High).** Agree with both findings; disagree on severity. Both are spec-accuracy defects, not design-breaking ones: the shared-limiter invariant (F1) and the §3.9 end-state (file deleted, `knip` clean) (F2) are unchanged — F2's correction makes the task *simpler* (delete vs migrate), not blocked. "Critical" implies a defect that invalidates a design decision; these correct magnitudes and a task framing. Corrected regardless of severity; noted rather than silently downgraded.

## Open Questions

- The error-taxonomy addition (§3.3, F8) is the only genuinely new design content this round and the main input to the "maybe" recommendation. If proceeding to plan without round 2, the plan author should confirm the rate-limiter's timeout/rejection surfaces as a catchable error (not a silent hang) so it lands in TanStack's `error` state alongside HTTP and `ZodError`.
- New §7 question recorded: unifying `ApiError` wrapper vs raw propagation of the three error types — left for the plan (default: raw).
