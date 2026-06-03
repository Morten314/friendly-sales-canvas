---
artifact: phase-5i-finalize
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-03
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Auto-discovered spec: `specs/24-frontend-phase-5-market-research-design.md`. Auto-discovered plan: `plans/24i-frontend-phase-5i-finalize.md`. Both loaded and used for adherence checking.

## Findings

### [Medium] Spec §11 item 3 (zero-raw-fetch gate) is self-declared as only partially met, but the spec amendment records this honestly

**Location:** `specs/24-frontend-phase-5-market-research-design.md` §9 delta 11, §11 item 3 amendment

The plan (Task 4 Step 3) specifies a **hard** zero-raw-`fetch` / zero-`CACHE_DURATION` gate at phase close. The implementation relaxes this to advisory via a CTO decision, documented thoroughly in delta 11 and the TECH_DEBT carry-forward annotations. This is a legitimate scope/record decision for a pre-launch product with 0 users — not a code defect. However, the feature still carries ~10 raw `fetch()` calls and extensive `localStorage` usage across `useMarketResearchData.ts` and multiple section components (`RegulatoryComplianceSection`, `MarketEntrySection`, `MarketSizeSection`, `CompetitorLandscapeSection`, `AIPromptingInterface`). The review file records `verdict: findings` (not `clean`) because a hard gate in the plan was not met, even though the relaxation is consciously documented.

### [Low] Cross-feature deep-path imports still exist inside the feature itself

**Location:** Multiple files under `frontend/src/features/market-research/`

The `index.ts` comment states "Cross-feature consumers import from `@/features/market-research`, never a deep path." This is about *external* consumers, and the feature's internal modules do correctly use deep paths internally (e.g., `IntelligenceTab.tsx` imports `EditHistoryPanel` via `@/features/market-research/components/EditHistoryPanel`). However, `App.tsx:22` imports `MarketResearchPage` via `@/features/market-research/pages/MarketResearchPage` — a deep path from outside the feature. This was likely present before 5i and is acceptable given `index.ts` only exports the *data* surface (type + hook), not the page component. But it does mean the "never a deep path" contract is already violated by the app shell. If the intent is that only `index.ts` exports are the public surface, `App.tsx`'s import is a pre-existing inconsistency worth noting for Phase 6+.

### [Low] `localStorage` usage in section components was not part of the 5i scope but is worth flagging

**Location:** `frontend/src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx` lines 163–187, 488–489, 547

The section components (e.g., `RegulatoryComplianceSection`) contain direct `localStorage.setItem` calls for edit state persistence. These were inherited from pre-5d code and are documented as tech debt (TD-FE-21, TD-FE-31), not introduced by 5i. The 5i branch correctly does not touch them. Flagged only because the TECH_DEBT carry-forward annotations cover the *page-level* cascade (TD-FE-19/30) but the per-section `localStorage` writes are arguably a separate concern that could benefit from their own TD-FE entries if not already tracked.

### [Nit] Four spec-delta commits where one or two would suffice

**Location:** Commits `f099a4c`, `2ef4a5a`, `272535a`, `011d15c` — four consecutive docs-only commits

The four spec-delta commits (`docs(spec-14)`, `docs(spec-24)` ×3) could logically be two (one per spec file). The `2ef4a5a` commit refines the wording of `272535a`'s delta 11, and `f099a4c` amends §11 item 3 to match — suggesting iterative authoring rather than a single pass. Per the repo's commit-granularity convention ("prefer small, frequent commits"), this is acceptable but borderline: two of these are pure re-edits of the immediately prior commit's content.

### [Nit] README handoff table removes the `types.ts` shared-legacy note from the "Dead code" section but correctly preserves it at the end

**Location:** `frontend/src/features/market-research/README.md` — "Pending handoffs" section

The pre-5i README had a separate `## Dead code` section listing the 8 files. The post-5i README correctly removes that section (the files are deleted) and retains the `types.ts` shared-legacy note under "Pending handoffs." The `types.ts` note is important and correctly preserved. Clean editorial work.

### [Nit] `TD-FE-32` pull-forward trigger is vague

**Location:** `docs/TECH_DEBT.md` TD-FE-32 entry, "Pull-forward trigger"

The trigger reads "The next phase that plans against the numbering (Phase 6/7 pre-planning) reconciles it, or whichever phase first hits an ambiguity the by-name convention cannot resolve." This is reasonable but open-ended. A concrete suggestion: if Phase 6 is next, that's the natural owner. Not actionable in this review — just a style note.
