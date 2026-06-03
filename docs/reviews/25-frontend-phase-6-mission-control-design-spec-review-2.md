---
artifact: specs/25-frontend-phase-6-mission-control-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-03
round: 2
---

## Context

This is a re-review of the revised spec after round 1 synthesis (synthesis-1 confirmed the spec author's resolution of all agreed findings). The round 1 High findings (shared util disposition, dead-code count, fetch-site count, tab mapping) have all been incorporated. This pass focuses on residual issues and anything exposed by the revisions.

## Findings

### [Medium] Stage 2 scope is very broad — util promotion + external repointing shares a checkpoint with relocation + dead-code sweep

**Location:** §7 stage 2

Stage 2 combines six distinct operations: (a) scaffold `features/mission-control/`, (b) mechanically relocate three monster files, (c) wrap the route in `<FeatureErrorBoundary>`, (d) delete ~1,500–1,600 lines of ICPManager dead code, (e) promote three profiler-ICP utils to `src/shared/`, and (f) repoint importers including the external `customers/SuggestedICPCards.tsx`. Operations (a)–(d) are intra-feature and low-risk. Operation (e)–(f) modifies code **outside** the feature boundary (the `customers` component that Phase 7 will later extract). If the external repointing breaks (import path mismatch, re-export surface gap), the rollback reverts the entire stage — losing the safe, verified relocation + dead-code work.

Round 1's finding 5 (stage 1 oversized) was partially addressed: stage 1 now explicitly mentions "two separate commits/checkpoints (registry first, lint second)." The same rationale applies here. The util promotion + repointing is independently verifiable and could be its own checkpoint (stage 2b) inside the stage-2 group, preserving the relocation + error boundary + dead code (stage 2a) as a separate revert boundary.

### [Medium] §4.1 endpoint table conflates two reads into one row — data-source list endpoint not explicitly named

**Location:** §4.1 table row 2 ("Data sources + lead-stream status")

The row lists "GET /leads/stream/status (+ source list)" as a single endpoint entry but maps it to **two** hooks (`useDataSources` / `useLeadStreamStatus`). The parenthetical "(+ source list)" suggests a second endpoint exists but doesn't name it. The plan author needs the exact path for the data-source list fetch to (a) confirm the response shape live, (b) write a zod schema, and (c) build an MSW handler. The ICP list and company-profile rows each name a single endpoint clearly; this row should match that precision.

**Recommendation:** Split into two rows — one for the source-list endpoint (with its path) and one for `/leads/stream/status` — or explicitly name both endpoints and their corresponding hooks in the existing row.

### [Medium] §3 architecture target omits test directory — inconsistent with Phase 5 precedent

**Location:** §3 architecture target tree

The tree shows `pages/`, `components/`, `hooks/`, `services/`, `contracts.ts`, `types.ts`, `index.ts`, `README.md` — but no `__tests__/` or equivalent test directory. Phase 5 (market-research) established a `__tests__/` convention per component directory. §8 promises "Vitest + RTL for each decomposed component and each new hook; MSW handlers for the migrated reads" but doesn't specify where these tests live relative to the feature structure. The plan author must either reference Phase 5's convention (which should be stated) or decide anew (which the spec should authorize).

**Recommendation:** Either add `__tests__/` (or a note about co-located test files) to the §3 tree, or add a one-line statement referencing Phase 5's test-location convention.

### [Low] Stage 4 forward-references "subtrees decomposed in stages 6 and 5" — temporal ordering could be clearer

**Location:** §7 stage 4, final sentence

The sentence "the latter two render the subtrees decomposed in stages 6 and 5" describes the *final* architecture, not the state at stage-4 completion. At stage 4, the `customer-profile` and `sources` tabs render the **undecomposed** (but relocated) ICPManager and DataSourcesManager. Stages 5 and 6 then decompose those into sub-component trees. A reader could misread this as a stage-4 dependency on stages 5/6, which would be a sequencing error.

**Recommendation:** Clarify: "at stage-4 completion, the latter two tabs render the undecomposed ICPManager and DataSourcesManager; stages 5 and 6 decompose those into sub-component trees."

### [Low] §2.2 defers write paths to "Phase 7-era / Phase 13" — ambiguous target

**Location:** §2.2 first bullet ("Migrated in a later mutation pass (Phase 7-era / Phase 13)")

The phrase "Phase 7-era / Phase 13" spans 6 phases and leaves the actual target unclear. Is the mutation pass Phase 7? Phase 13? Or a new phase between them? The master plan (Spec 14 §4) does not include a dedicated mutation pass — Phase 13 is "LOC reduction pass #2." A plan author tracking the deferred work needs a clearer disposition.

**Recommendation:** State the target explicitly, e.g. "deferred to the Phase 7 mutation pass (if Phase 7 migrates ICP writes) or Phase 13 (if a later dedicated pass is needed)." Or simply "deferred — TD-FE records the candidate phase."

### [Low] No argument for why VR snapshots "should not move" under structural decomposition

**Location:** §8 "Parity guards every stage"

The spec states "decomposition is structural/byte-parity, so snapshots should not move." This is a claim, not an argument. Component decomposition changes DOM nesting (wrapping children in new parent components, extracting sub-trees into separate render functions). Even with no visual change, added wrapper `<div>`s or `<Fragment>`s can shift bounding boxes. The 2% threshold provides buffer, but the spec should acknowledge that some snapshot drift is possible and acceptable within the threshold, rather than asserting zero drift.

**Recommendation:** Soften to "decomposition is structural and visually neutral; snapshots should remain within the 2% threshold. Minor bounding-box shifts from added wrapper elements are acceptable if visually identical."

### [Nit] §3 `services/` directory not cross-referenced to Phase 5 precedent

**Location:** §3 architecture target, `services/` entry

Round 1 challenged `services/` as unprecedented; the synthesis corrected this by citing Phase 5's `services/marketResearch.ts`. The current spec doesn't reference this precedent. A brief note ("following Phase 5 convention") would make the decision self-documenting for future spec authors.

### [Nit] §7 stage 1 parenthetical blends rationale with instruction

**Location:** §7 stage 1, "(which removes App.tsx's deep page import, so the lint then passes cleanly)"

This parenthetical is a rationale for why registry-then-lint ordering matters, not an instruction. It's useful context but could be separated (e.g., as a footnote or "Ordering rationale:" prefix) so the plan author doesn't mistake it for an action item.

### [Nit] §9 TD-FE numbering assumes TD-FE-32 is current ceiling

**Location:** §9 "TD-FE entries to allocate at finalize (next free numbers after TD-FE-32)"

This is the spec author's intent at time of writing. The plan author must verify the actual highest TD-FE number at finalize time (intervening phases may have allocated entries). Minor bookkeeping hygiene.
