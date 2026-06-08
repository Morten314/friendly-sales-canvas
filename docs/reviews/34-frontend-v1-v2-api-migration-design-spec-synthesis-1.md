---
synthesizes_review: docs/reviews/34-frontend-v1-v2-api-migration-design-spec-review-1.md
artifact: specs/34-frontend-v1-v2-api-migration-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-08
round: 1
---

## Round Recommendation

no

Reason: All three High findings are agreed and resolved by contained, scope-*narrowing* spec amendments (no new design surface); the reviewer's own summary says none require re-thinking the approach. Remaining items are Low/Nit or correctly declined.

## Agreed Findings

- **#1 [High] `fetchDataSources` return type vs. `total` threading.** Real inconsistency: G4 ("thread `total` through each service return") + R6 conflict with G5 for the bare-array `fetchDataSources` (no slot for `total` without a return-type/consumer change). Revision: **narrow G4/R6** — this spec does *not* surface or type `total` for any service; the FE simply stops consuming the v1 `count` (the lie) and reads `items`. Exposing/typing `total` (+ any count UI / pagination) is deferred to TD-FE-67.
- **#3 [High] `total` is structurally invisible in the passthrough returns.** Verified: `FetchSignalsResponse`/`SuggestedIcpsResponse` are `z.object({}).passthrough()`, so `total` would ride untyped at runtime only. Same root as #1; resolved by the same amendment (drop the "available `total`" claim; promise no `total` field).
- **#2 [High] v1 `/icp` is not "unbounded."** Verified: `backend/app/routers/icp.py:28` docstring "hard cap of 500"; the v1 route calls the same `icp_service.list_icps` the v2 route does. Revision: correct §3.1 rationale to "v1 `/icp` hard-capped at 500 (same service cap as `user-documents`)"; the 500 ceiling is unchanged. (Severity downgraded — see below.)
- **#4 [Medium] `paginatedSchema` double-cast widens items to `any[]`.** Verified: `z.infer<z.ZodTypeAny>` is `any`, so the no-arg default yields `any[]`, not `unknown[]`. Revision: §4.1 requires the item arg (callers pass `z.unknown()`), extracts `items` + `.passthrough()`, drops the no-arg default.
- **#5 [Medium] (clarity half) per-service transport inconsistency is undocumented.** Revision: add a neutral non-goal noting transport is preserved per service (signals/icp raw `fetch`, user-documents `apiGet`); unifying transport is out of scope. (The security framing is declined — see Disagreed.)
- **#6 [Medium] `buildIcpUrl` fold changes the network path.** Verified the path is handled: Vite `"/api"` prefix → `rewrite ^/api`, and `vercel.json` `"/api/(.*)"` → backend — both prefix-match `/api/v2/icp` (dev, preview, prod). Revision: add a one-line "confirmed safe" note to §4.3/§6. (Severity downgraded — see below.)
- **#7 [Medium] (valid half) done-when grep imprecision.** Verified: `customers.ts` has `icp/recommended`, `customer_profile/icp`, `from_suggested_icp` — a bare `grep /icp` would false-positive on these out-of-scope mutations. Revision: §9.2 enumerates the exact GET-read strings/anchors to be absent rather than bare substrings. (The `fetch-signals` example is incorrect — see Disagreed.)
- **#8 [Medium] `useFetchSignals` repointing is misleading.** Verified: the hook delegates to `fetchSignals(userId)` and holds no URL. Revision: §4.4 — hook code is unchanged; update its test's MSW handler `/api/fetch-signals` → `/api/v2/fetch-signals`. (Severity downgraded — see below.)
- **#10 [Low] component comment updates.** Revision: §9.2/plan updates stale `// from /user-documents` comments (`DataSourcesManager.tsx:150,215`) and the read-absence grep excludes comments.
- **#11 [Low] v1 `user-documents` wire shape.** Revision: §3.1 parenthetical — actual v1 wire is `{status,count,files}`; the FE's `?? .files ?? .data` chain is defensive (the table accurately showed the FE *code*).
- **#12 [Nit] §10 missing proxy-path risk.** Revision: add the icp direct→proxied path-change risk, mitigated/verified per #6.
- **#13 [Nit] schema defaults mask missing BE-required fields.** Resolved by #4's amendment: dropping `total/limit/offset` from the FE schema (extract `items` + `.passthrough()`) removes the masking `.default(0)`s entirely.
- **#14 [Nit] confirm TD-FE-67 free.** Confirmed: `docs/TECH_DEBT.md`'s current max is TD-FE-66; TD-FE-67 is the correct next id.

## Disagreed Findings

- **#5 [Medium] (security framing).** Decline framing the raw-`fetch`-vs-`apiGet` difference as a JWT/rate-limit *security gap* or creating a security TD. The project has an explicit standing decision to ignore security at MVP (0 users): don't propose auth/authz/hardening; preserve the existing posture as-is. A security TD here would contradict that decision. The reader-clarity concern is met by the neutral transport non-goal (agreed above) without the security framing. The migration is auth-neutral regardless — raw `fetch` stays raw `fetch`.
- **#7 [Medium] (the `fetch-signals` example).** Incorrect. `generateSignalsBatch` POSTs to `/api/generate-signals-batch` (`signals.ts:31`), which does **not** contain the substring `fetch-signals` — so `grep fetch-signals` has no false positive there. Only the `/icp` substring concern is real (handled by the §9.2 amendment).
- **#9 [Low] inline `firstPageParams`.** Leave as-is. It's one line either way; the helper names the single-page seam (`limit=N&offset=0`) that the deferred pagination work (TD-FE-67) will touch, so it documents the offset decision rather than obscuring it. The reviewer concedes it is "not harmful."

## Deferred Findings

- **Surface + type `total` (and any count UI / pagination).** This is the #1/#3 resolution's deferral, recorded as **TD-FE-67**. Trigger: a count needs rendering, or an org approaches the 500-row cap (at which point the return types are deliberately widened and pagination/fetch-all is designed). Not done now: nothing renders a count today, and threading an unused `total` would either break the bare-array consumer (G5) or add untyped dead surface.

## Severity Disagreements

- **#2 — High → Low.** Agree with the finding; it is a rationale-accuracy correction with no design/approach impact (the reviewer themselves notes the 500 ceiling is unchanged).
- **#6 — Medium → Low.** Agree with the finding; verification passed (prefix-match proxies in all environments), so the action is a confirming note, not a design change.
- **#8 — Medium → Low.** Agree with the finding; it is a phrasing-accuracy fix. The substantive change (service URL) and the test-handler update are already in scope; no design impact.

## Open Questions

- None blocking. Minor: whether to keep the `PaginatedResponse<T>` interface now that the FE consumes only `.items`. Decision: keep it as accurate wire-shape documentation of the v2 envelope; it costs nothing and aids the future TD-FE-67 work. Not a blocker.
