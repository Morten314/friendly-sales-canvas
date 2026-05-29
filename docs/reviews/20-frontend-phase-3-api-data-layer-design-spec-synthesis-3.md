---
synthesizes_review: docs/reviews/20-frontend-phase-3-api-data-layer-design-spec-review-3.md
artifact: specs/20-frontend-phase-3-api-data-layer-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 3
---

## Round Recommendation

no

Reason: Round 3 was substantially lighter (1 Medium + Low/Nit polish; no High/Critical) and re-verified every prior fix and §1.2 claim against the code. The one Medium (CompanyProfile GET non-2xx→empty-form tolerance) is the same class as the already-designed auth 404-tolerance and is addressed by a §3.6 instruction plus a generalized §3.3 caveat. All other findings are Low/Nit and fixed. Severity has dropped each round (Critical → High → Medium); residual behavior specifics are plan/impl-review territory. (An operator wanting belt-and-suspenders could run round 4, but the spec has converged.)

## Agreed Findings

- **F1 [Medium] — CompanyProfile GET non-2xx → null tolerance.** Verified: `CompanyProfile.tsx:64-67` returns `null` (→ empty form) on `!response.ok`, and `:71-74` on a caught error — the "no saved profile yet" path for new users. `apiFetch` throws on non-2xx, so the naive migration would surface an error state instead of an empty form. §3.6 now requires preserving this (map not-found/error → empty form; confirm the backend's "no profile" status during the §3.5 live-capture). §3.3 generalizes it: any bare-`fetch()`→`apiFetch` conversion must audit and preserve the site's existing non-2xx/error tolerance (same root issue as the auth 404-tolerance, R7).
- **F2 [Low] — auth/Login tests absent from DoD.** §4 item 4 extended to require passing unit tests for the `authEndpoint` path (at minimum the two R7 assertions: refresh does not invoke `getAuthHeader`; a 404 to `generateToken` yields `null`, not a throw).
- **F3 [Low] — §7 diluted by settled defaults.** §7 trimmed to genuine plan decisions; settled defaults (parse-location, `.parse` vs `.safeParse`, `useTenants` inline) collapsed into a one-line "defaults" note; the resolved Q2 dropped from the list; the new CompanyProfile-GET-mapping decision added.
- **F4 [Low] — §3.3 `authEndpoint` paragraph too dense.** Replaced the paragraph with the reviewer's Normal-vs-`authEndpoint` comparison table + rationale prose. No design change; easier to verify.
- **F5 [Nit] — localStorage key names imprecise.** Corrected to the keys CompanyProfile actually references — `companyProfile` and `companyProfileForRefresh` (`companyProfileHash` only appears in `cacheUtils`'s clear-all). Added that `companyProfileUpdated` is a cross-component *event signal*, not cache — the plan decides whether query invalidation replaces it.
- **F6 [Nit] — DoD-6 baseline mechanism.** Simplified item 6 to "preflight `lint` clean," which already enforces no-new-`any`.

## Disagreed Findings

None.

## Deferred Findings

None — all resolved this round.

## Severity Disagreements

None — the reviewer's severities are accepted this round (the Medium is a genuine behavior-preservation gap; the rest are correctly Low/Nit).

## Open Questions

- **F7 [Nit]** (§3.6 slice-ordering note already defers to plan) — the reviewer marked it "no action needed"; left as-is.
- **Carry-forward for the plan:** the non-2xx/error tolerance class (auth 404 in round 2, CompanyProfile GET in round 3) is now a standing concern. The plan should treat "audit each migrated site's current non-2xx/error tolerance and preserve it" as a checklist item during the §3.5 live-capture, not a per-finding patch — it is the single most likely source of silent behavior drift in this phase.
