---
synthesizes_review: docs/reviews/20-frontend-phase-3-api-data-layer-plan-review-2.md
artifact: plans/20-frontend-phase-3-api-data-layer.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 2
---

## Round Recommendation

no

Reason: Round 2 surfaced **0 High/Critical** (down from round 1's 2 High) — 2 Medium + 2 Low + 2 Nit, all agreed and resolved with documentation / verification additions (a TD-FE entry, an `rg` pre-check, an extension fix, three clarifying notes). None change the design or open new surface; the two Mediums are tech-debt-traceability and pre-deletion-discipline, not design concerns. The plan has converged.

## Agreed Findings

- **F1 [Medium] — TenantContext orphan not recorded.** Verified: Task 11 stops calling `setAvailableTenants` and renders from `useTenants`, and TenantSelection is the only reader, so `TenantContext.availableTenants` + `setAvailableTenants` become dead (defined, never populated, never read — no lint/knip break since they're still assigned into the context value). Added **TD-FE-12** (new Task 11 step writing to `docs/TECH_DEBT.md`) + a §X deferral note; pull-forward trigger = Phase 10 (introduces the real tenant endpoint and removes/repopulates the field).
- **F2 [Low — see severity disagreement] — Task 12 removes `getApiBaseUrl` without an upfront importer check.** Added a verification line to Task 12 Step 3: `rg "getApiBaseUrl" frontend/src` before deletion (expected: only the definition + the two call sites being replaced), mirroring Task 14's discipline.
- **F3 [Low] — `useTenants` test extension mismatch.** Verified: Task 11's local "Files:" manifest (`:1511`) says `useTenants.test.ts` while Step 2 (`:1540`) and the commit (`:1654`) correctly say `.tsx`. Fixed the manifest entry to `.tsx`.
- **F4 [Low] — Task 9 commits the rewire before any component test.** Added a note to Task 9 Step 5: the component test lands in the immediately-following Task 10 commit; under subagent-driven execution the between-task review catches a broken rewire at once, and an executor preferring a single self-verified commit may fold Task 10's test in. Left separate by default (CLAUDE.md small-commit bias).
- **F5 [Nit] — `useCompanyProfile` queryFn silences 5xx to `null`.** The reviewer flagged "no action required" (it is accurate + behavior-preserving — the original bare fetch also returned `null` on any non-2xx incl. 5xx). Added a half-sentence to the hook JSDoc making the 5xx-silencing explicit for future readers.
- **F6 [Nit] — Task 2 Step 1 "copy verbatim" vs the inlined file is ambiguous.** Clarified: the inlined file is the authoritative target; if the live `rateLimitManager.ts` has diverged, reconcile first (abort trigger #2 catches a behavioral mismatch).

## Disagreed Findings

None.

## Deferred Findings

None.

## Severity Disagreements

- **F2 (reviewer: Medium → mine: Low).** Agree with adding the check; disagree it is Medium. `getApiBaseUrl` is a **module-private `const`** in `jwt.ts` (`:3`, no `export`), referenced only at `:40` and `:128` (the two `fetch` calls being replaced). The reviewer's stated risk — "some file outside `jwt.ts` imports `getApiBaseUrl`" — is impossible for a non-exported symbol. The `rg` check is cheap consistency with Task 14, not mitigation of a real cross-file risk; typecheck/lint would catch any stray in-file reference regardless.

## Open Questions

- **F4 commit granularity (combine Tasks 9+10 vs keep separate).** Left to executor judgment with a note; the plan keeps them separate per the repo's small-commit bias, accepting a one-step "blind commit" window that the next task (the component test) or Task 16 preflight closes. Flagged so an operator who wants every commit independently test-verified can instruct a fold.
