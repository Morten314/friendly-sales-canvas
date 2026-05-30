---
artifact: specs/24-frontend-phase-5-market-research-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 2
---

## Context

Round 2 review after round-1 synthesis (`docs/reviews/24-frontend-phase-5-market-research-design-spec-synthesis-1.md`). All round-1 findings were revisited; resolution quality is assessed below. Codebase measurements in §1.2 and §4.1 were independently verified against the live source and are accurate (7,013 LOC, 49 useState calls, 9 fetch sites, 68 localStorage refs, 33 component files / 21,384 LOC, five section LOC counts all match).

## Findings

### [Medium] Search/filter → URL params is an un-elevated state-architecture decision

**Location:** §5 ("primary search/filter state → URL params (shareable, consistent with `activeTab`)")

The round-2 revision introduces a significant state-management choice — converting search and filter state from `useState` to URL search params — as a 5c action, without elevating it to §1.3 decisions or §13 open questions. This is not a trivial rehoming: it affects UX (URL length limits, browser history pollution from rapid filter changes, encoding of complex filter objects), interacts with the "activeTab is URL-derived" convention, and adds scope to 5c beyond "break page into tab containers." The §1.3 decisions cover sequencing, contracts, cache, and leaving-component model — but not URL-param policy.

The heuristic is reasonable, but the scope of what constitutes "primary search/filter state" vs "ephemeral state" is left to 5c's plan writer without spec-level guidance on the boundary.

**Suggestion:** Either (a) elevate "search/filter → URL params" to §1.3 as a settled decision with one sentence of rationale, or (b) move it to §13 as a deferred question for `24c`, with the current wording preserved as guidance. In either case, add a constraint: "URL params are limited to top-level navigation and primary filters; ephemeral inputs (draft text, open/closed dialogs, interim loading states) remain local state."

---

### [Medium] 5b→5c boundary: lead-stream tab may create cross-boundary hook dependency

**Location:** §4.1 (endpoint inventory), §4.2 (5b actions), §5 (5c lead-stream extraction)

5b migrates all 9 fetch sites in MarketResearch.tsx to TanStack Query hooks. The lead-stream (`analysis`) tab is inline in that page and its data access is among those 9 sites. 5c then extracts the lead-stream tab *out* of the feature into the legacy `src/components/market-research/lead-stream/` unit, where it remains until Phase 7 claims it.

This creates a potential cross-boundary dependency: a legacy component (lead-stream, outside the feature) consuming TanStack Query hooks defined inside `features/market-research/hooks/`. The transitional legacy-import exception (§2.2) permits importing *from* legacy, but doesn't cover legacy importing *from* the feature — that's the reverse direction. The dependency rules (§2.2 / `features/README.md`) restrict cross-feature access to `index.ts` only, but lead-stream is not a feature, it's legacy code importing from a feature.

The spec doesn't acknowledge this direction. If the lead-stream tab's fetches all target endpoints that are genuinely lead-stream-specific (not `market-research`), 5b wouldn't create hooks for them inside the feature and the problem disappears. But §4.1 shows all 9 sites resolve to just 2 endpoints (`market-research` and `profile/company`), so the lead-stream tab's fetches almost certainly hit `market-research` — meaning 5b creates hooks for them inside the feature.

**Suggestion:** Add a 5c action or constraint: "If the lead-stream tab consumes market-research hooks, those hooks stay importable via the transitional exception (legacy→feature direction, feature→feature direction in §2.2 already restricted to `index.ts`), OR the lead-stream tab continues using its own inline data access until Phase 7 (i.e., 5b does not migrate lead-stream-specific fetch sites, deferring them to Phase 7)." The second option is cleaner — 5b skips lead-stream fetch sites, leaving them as raw `fetch` in the extracted legacy unit, and Phase 7 migrates them when it claims the component.

---

### [Low] §2.1 feature tree doesn't show tab containers created by 5c

**Location:** §2.1 (target feature tree), §5 (5c creates IntelligenceTab, TrendsTab, analysis branch)

The target tree shows `pages/MarketResearchPage.tsx` and `components/intelligence/` + `components/trends/`, but doesn't show the tab-container components that §5 introduces (IntelligenceTab, TrendsTab). These are the primary structural output of 5c. Without them, the tree under-represents the post-5c architecture.

This is a minor readability issue — a plan writer reading §2.1 alone won't see the tab containers and may mis-structure 5c.

**Suggestion:** Add tab containers to the tree, e.g.:
```
pages/
├── MarketResearchPage.tsx        # thin shell + tab router
├── IntelligenceTab.tsx           # §5
└── TrendsTab.tsx                 # §5
```
Or note that tab containers are created by 5c and live under `components/` or `pages/` per the 5c plan's discretion.

---

### [Low] MarketIntelligenceTabProps.ts deletion timing unspecified

**Location:** §2.3 mapping ("prop-drilled MarketIntelligenceTabProps → hook consumption"), §6 ("Replace the section's slice of the MarketIntelligenceTabProps prop surface")

§6 says each section replaces its prop surface with hooks during 5d–5h. §2.3 maps the old `MarketIntelligenceTabProps` to "hook consumption." But the spec never says when the file is deleted. It's progressively emptied by 5d–5h — is it deleted when the last section converts (5h)? During the 5i dead-code sweep? §11 DoD doesn't mention it.

**Suggestion:** Add to §6 or §11.2: "MarketIntelligenceTabProps.ts is deleted in 5i (or when the last consuming section is converted, whichever comes first)."

---

### [Low] §2.2 "keep result types exportable" is an unenforceable soft constraint

**Location:** §2.2 ("5c–5h keep those exportable (don't bury result types in deeply-private modules)")

This guidance is reasonable but has no enforcement mechanism. It's not in §11 DoD, not in any sub-phase's acceptance criteria, and not testable by lint or automated tooling. A plan writer for 5d could legitimately bury a result type in a private module and still pass all stated criteria.

**Suggestion:** Either (a) add a DoD item: "Result/report types and the results-read hook are exported from a non-deeply-nested module (accessible from `index.ts` without restructuring in 5i)", or (b) downgrade to pure guidance with an explicit acknowledgment that 5i may need a restructure pass (which is already implied by "validated in 5i").

---

### [Low] §9.3 sub-split mapping to master's 5a/5b/5c is implicit

**Location:** §9.3 ("Master §4 Phase 5 sketched 5a/5b/5c; this spec uses 5a–5i because full decomposition was chosen. Record the finer split.")

The deviation is recorded, but the mapping between master's 5a/5b/5c and this spec's 5a–5i isn't explicit. Reading the spec, one can infer:
- Master 5a (relocate) → this 5a
- Master 5b (data) → this 5b
- Master 5c (decompose) → this 5c + 5d–5h + 5i

This mapping matters for master-plan status tracking. Making it explicit costs one line and removes ambiguity.

**Suggestion:** Add a one-line mapping to §9.3: "Master 5a → 5a, master 5b → 5b, master 5c → 5c + 5d–5h + 5i."

---

### [Nit] §9.2 Phase 3/4 status verification is a prerequisite action, not a master-plan amendment

**Location:** §9.2 ("Verify Phase 3 and Phase 4 rows read 'done'")

This reads as a 5a pre-flight action (check and correct stale status in the master plan), not a structural amendment to the master spec. It's functionally correct but slightly misplaced in the "Master Spec 14 amendments" section.

---

### [Nit] Round-1 resolution quality is high

All 14 round-1 findings were addressed or explicitly disagreed with reasoned justification. The §1.3 "leaving components" definition and the §5 context placement criteria are particularly well-crafted additions. The §4.1 endpoint inventory (verified accurate: 9 fetches → 2 endpoints) materially sharpens 5b's scope. No round-1 finding was dropped or silently ignored.
