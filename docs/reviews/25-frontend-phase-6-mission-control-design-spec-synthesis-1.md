---
synthesizes_review: 25-frontend-phase-6-mission-control-design-spec-review-1.md
artifact: specs/25-frontend-phase-6-mission-control-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-03
round: 1
---

## Round Recommendation

yes

Reason: Two High findings are confirmed correct and load-bearing — §6's Profiler-disposition table (a Phase 7/9 handoff artifact) is factually wrong on two shared utils, and correcting it reopens the shared-util promotion scope, which warrants a targeted re-review of the revised §6.

## Agreed Findings

- **[High] Finding 1 — `profileIcpsExtract.ts` is shared, not mission-control-only.** Verified: `customers/SuggestedICPCards.tsx:60` imports `fetchIcpsRowsForOrg` from it (used L665/L1033); also consumed by `MissionControl.tsx` + `ICPManager.tsx`. §6 ("mission-control-local") and §12 open-question 1 are wrong. Revision: mark it shared (mission-control + customers) in §6, resolve §12 Q1, and fold it into the shared profiler-util cluster decision (see Open Questions).
- **[High] Finding 2 — `missionProfilerSessionCache.ts` is shared.** Verified: `SuggestedICPCards.tsx:56` imports from it; also `MissionControl.tsx`. §6 ("mission-control-local") is wrong. Revision: mark shared in §6; same cluster decision.
- **[Medium] Finding 3 — dead-code volume understated.** Verified: `grep -c '^[[:space:]]*//'` = 1,569 commented lines in ICPManager (of 3,320). Revision: §1.2/§9 → "~1,500–1,600 commented lines (bulk = a legacy component shadow)"; keep the stage-6 zero-residual gate.
- **[Medium] Finding 6 — tab→component mapping is implicit.** Verified in `MissionControl.tsx`: `profile`→company-profile form (L1983), `customer-profile`→`<ICPManager/>` (L2233–2236), `sources`→`<DataSourcesManager/>` (L2242–2243). Revision: add the explicit mapping to §3/§7 stage 4 (`profile → company-profile/`, `customer-profile → icp/`, `sources → data-sources/`).
- **[Low] Finding 9 — README scaffolded (stage 2) and written (stage 6).** Revision: state §7 stage 2 creates a minimal placeholder README; stage 6 finalizes it with public-surface + architecture docs.
- **[Low] Finding 10 — DoD item 6 too broad.** Revision: scope §10 item 6 to "ICPManager's commented legacy blocks removed" (the actual stage-2 target). The feature carries no `// DEAD CODE` annotation markers (the dead code is commented blocks, not annotations; the map confirmed no `// HANDOFF`/`// DEAD CODE` markers).
- **[Nit] Finding 11 — endpoint `/api/` prefix inconsistency in §4.1.** Revision: add a note that paths are as they appear in the FE `fetch()` calls (the `/api` proxy prefix per `vite.config.ts`); exact prefixes confirmed live (already in §12).
- **[Nit] Finding 12 — "4a probe" provenance.** The probe's content is already glossed inline in §7 stage 1 (deep import flagged / index import allowed / ~95 legit deep imports not flagged). Revision: add a one-clause provenance pointer (Phase 4a spike / TD-FE-15).

## Disagreed Findings

- **[Medium] Finding 7 — `services/` is unprecedented.** Factually incorrect. Verified: market-research (Phase 5) has `src/features/market-research/services/marketResearch.ts` (added in 5b) — its subdirs are `__tests__/ components/ hooks/ pages/ services/`. §3's `services/` follows the established Phase 5 convention, not a departure. The reviewer's premise ("Phase 5 hooks contain query functions inline, no services/ layer") is wrong. No change.
- **[Low] Finding 8 — `npm run verify` undefined.** Resolved by fact: it exists at `package.json:18` (`typecheck && lint && test`), an existing project script alongside `preflight` (L16) and `preflight:par` (L17). No spec change required; a parenthetical gloss is an optional nicety, not a fix.

## Deferred Findings

- **Finding 5 (detailed 1a/1b task split) → the plan.** The conceptual point — the route registry and the lint are independently verifiable, so a finer rollback boundary has value — is sound and earns a light spec note (stage 1's registry and lint land as separate commits/checkpoints, registry first). The actual task-level 1a/1b breakdown is checkpoint granularity, which is the plan artifact's domain (§7 already frames stages as commit-series). Trigger: `writing-plans` for `plans/25`.

## Severity Disagreements

- **[Medium → Low] Finding 4 — 19 vs 21 fetch sites.** Agree the substance and will revise §1.2 ("19 active fetch sites; 2 more in ICPManager's commented code, deleted in stage 2"). Verified: ICPManager L239/L317 are commented-out fetches, L1861/L1945/L1965 active (3) → 4 + 12 + 3 = 19 active. But Low, not Medium: a precision fix with no scope consequence — the two commented fetches are removed in stage 2 regardless, so the migration surface is unchanged.
- **[Medium → Low] Finding 5 — stage 1 oversized.** Agree the value; Low, not Medium — a checkpoint-granularity refinement, and §7 already frames stages as commit-series. Light spec note added; the detailed split is deferred to the plan (above).

## Open Questions

- **Shared profiler-util cluster — promote all three vs keep legacy (reopens the earlier narrow-promotion decision).** Findings 1 & 2 establish that all three profiler-ICP utils — `profilerAcceptedIcpDisplay.ts`, `profileIcpsExtract.ts`, `missionProfilerSessionCache.ts` — are shared by the same two domains (mission-control + customers). The earlier decision to "promote only `profilerAcceptedIcpDisplay`" was premised on the other two being mission-control-only, which is now false, making the current split arbitrary. Consistent options: **(a)** promote all three to `src/shared/` in stage 2 (treat them as one cluster; pre-clears the Phase 7 handoff — the reviewer's lean), or **(b)** keep all three in legacy `src/utils/`+`src/lib/`, imported transitionally, and defer promotion to Phase 11 (strict §8 Q5 "no speculative promotion"). Recommend **(a)** for consistency and to keep Phase 7 clean, but it widens the originally-narrow promotion and is the user's call. This is the load-bearing reason for Round Recommendation: yes — §6 must be corrected and this decision settled before the spec is final.
