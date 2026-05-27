---
artifact: specs/16-frontend-phase-1-loc-reduction-design.md
artifact_type: spec
verdict: clean
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 3
---

## Context

Round 3 review of the post-round-2-synthesis spec. Rounds 1 and 2 produced 15 and 10 findings respectively; syntheses accepted nearly all and revised the spec substantially. This round focuses on (a) verifying round-2 revisions landed correctly, (b) identifying residual issues, and (c) assessing plan-readiness. Verified against live codebase state (`master`, 2026-05-27) and the parent master spec (`specs/14-frontend-refactoring-master-plan-design.md`).

## Plan-readiness assessment

The spec is plan-ready. All prior High and Medium findings have been addressed. The seven-step decomposition is ordered, testable (preflight green between every commit), and reviewable (per-file commits with structured check-kit evidence). The scorecard requirements are assertion-based, leaving format to the plan. Step 6's likely-zero yield is acknowledged and handled. No blockers remain for plan writing.

## Findings

### [Low] Step 4 topological-ordering example uses "leaves" with conflicting meanings

**Location:** §3 Step 4 (line 172)

The instruction says "topological-order the removals (leaves first)" where "leaves" correctly means files nothing depends on (standard graph-theory leaves). The parenthetical immediately after then says "removal order is ICPSummaryOpportunity and RateLimitStatus (top of graph, no inbound dead deps) → … → enhancedApi (leaves last because most depended on)." Here "leaves" is used as a verb ("leave for last") applied to the most-depended-on node (enhancedApi), which is the opposite of the graph-theory "leaf." The ordering described is correct — remove importers before imports — but a plan executor reading both sentences encounters "leaves first" and "leaves last" referring to opposite categories of nodes.

**Suggestion:** Replace "(leaves last because most depended on)" with something like "(last because it carries the most inbound dead-file dependencies)" to avoid the dual-meaning of "leaves."

### [Low] Orphan route detection sub-pass only checks sidebar nav reachability

**Location:** §3 Step 4 "Orphan route detection (Step 4 sub-pass)" (line 174)

The sub-pass walks `<Route>` definitions in `App.tsx` and checks reachability from `Sidebar.tsx`. This misses routes reachable only through in-page navigation (`useNavigate()`, `<Link>` components, programmatic redirects from other routes). A route that's not in the sidebar but is navigated to from within a page (e.g., a detail view reached from a list) would be flagged as orphaned and potentially removed.

**Suggestion:** Broaden the nav-surface check to include `useNavigate` and `<Link>` target paths in addition to sidebar entries. Or add a note that routes flagged by the sidebar-only walk get the standard `keep`/`defer` verdict treatment — which they do per §2.3 posture rules, making this a conservative false-positive rather than a correctness bug.

### [Nit] §5 done-when item 6 references stale "§C" section notation

**Location:** §5 item 6 (line 261)

"scorecard §C with evidence" references the pre-round-1-synthesis rigid section-letter format. §4.1 was rewritten to use assertions 1–5 without section letters. The cross-reference should read "scorecard assertion 3" or similar.

### [Nit] Step 4 check 4 plain-text search will over-match generic basenames

**Location:** §3 Step 4 check 4 (line 154)

`rg "<basename>"` plain-text produces false positives for files named `utils`, `types`, `helpers`, `index`, `constants`, etc. The spec's "any non-zero → keep" posture handles this correctly (conservative), but a plan executor may spend time investigating false positives for generically-named files. The other 5 checks provide the actual signal; check 4 is a safety net. No spec change needed — flagging for plan-author awareness.

### [Nit] Step 5 commit count (~30 individual export-trim commits) is high review surface

**Location:** §3 Step 5 (line 180)

"Concentrated across ~30 source files → ~30 commits." This was flagged as a plan-stage concern in round 1 (finding 12). The per-file convention is well-motivated, but reaffirming: the plan should consider whether exports within a single feature area (e.g., all `components/market-research/` trims) can batch into one commit where blast radius is equivalent. The spec's per-file rule allows this since all trims are in service of the same logical step within a feature boundary.

### [Nit] Step 1 item 6 knip-entry expansion for Vitest may not trace dynamic `import()`

**Location:** §3 Step 1 item 6 (line 125)

The spec adds Vitest test files as knip entry points to prevent test-only exports from being flagged as unused. It notes that "Phase 0b characterization tests import `rateLimitManager` etc. via dynamic `import()`." Knip's ability to trace dynamic `import()` from entry files depends on its version and configuration. If knip doesn't resolve dynamic imports from the newly-added test entries, some test-only exports will still appear in knip output. This is mitigated by the §2.3 "test-only import" verdict fallback, so no correctness risk — just a possible no-op on the config change.
