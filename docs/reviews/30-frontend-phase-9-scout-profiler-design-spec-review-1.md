---
artifact: specs/30-frontend-phase-9-scout-profiler-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 1
---

## Findings

### [Critical] Cruft sweep targets are not dead — both have live importers

**Location:** §9 "Cruft sweep," lines 150-156; Appendix file manifest line 242

§9 proposes deleting `src/components/market-research/ChatWithScout.tsx` and `src/components/market-research/ScoutChatPanel.tsx` as "superseded Lovable leftovers," contingent on confirming zero live importers. **Both files have active, non-test consumers:**

- `ChatWithScout.tsx` is imported by `features/market-research/components/trends/TrendsTab.tsx` (line 6, rendered at line 53).
- `ScoutChatPanel.tsx` (681 LOC) is imported by `features/market-research/components/scout-chat/ScoutChatWithHistory.tsx` (line 14) AND by `features/market-research/components/MarketIntelligenceSections.tsx` (line 9, rendered 5 times at lines 235/249/263/277/292 for each intelligence section).

Neither file is deletable in this phase. The spec's own contingency — "if either turns out to have a live importer, it is not deleted; logged as TD" — applies to both. This finding is Critical because the spec frames cruft deletion as Deliverable 4 and lists it in the Appendix manifest; it will instead produce two TD entries and zero deletions, which materially changes the phase's output.

Additionally, `ScoutChatPanel` at 681 LOC is not "cruft" — it is a substantial, actively-used component with 6+ render sites. Labeling it a "superseded Lovable leftover" is inaccurate. TD-FE-51 in `docs/TECH_DEBT.md` already notes `ScoutChatPanel.tsx` remains in legacy `components/market-research/` as Phase 9 residue.

**Suggestion:** Rewrite §9 to acknowledge both files have live importers, record them as TD entries per the spec's own fallback, and remove the deletion rows from the Appendix manifest. Consider whether `ScoutChatPanel` relocation to `features/market-research/` should be scoped in or explicitly deferred.

---

### [High] ~90% duplication claim is overstated

**Location:** §1, line 16: "two ~90%-identical chat-history wrappers"; §4, line 88: "the genuinely-invariant ~90%"

The raw LOC difference is 473 vs 336 (137-line gap). Scout's lead-stream integration (`leadContext`, `SuggestedCompaniesSection`, `AddLeadModal`, `ScoutChatPanel` rendering, `suggestionPrefill`, `addLeadModalOpen`, "Back to Lead Stream" button) accounts for ~130-140 LOC of Scout-only code. The structural core (session management, sidebar, persistence, handlers) is genuinely shared and ~85-90% identical **within that subset**. But including the lead-stream surface, the raw line-overlap duplication is closer to **70-75%**.

This matters because the spec's interface design (§4) and the "ultra-thin wrapper" size estimates (§6: "50-80 LOC" for Scout, "20-40 LOC" for Profiler) assume the shared component absorbs nearly everything. If the shared component must also handle a divergent render path (ScoutChatPanel vs ContextChat), the wrapper sizes will be larger than estimated, or the shared component itself will need more complexity.

**Suggestion:** Recharacterize the duplication as "~70-75% by raw line overlap, ~85-90% on the shared session/sidebar/persistence core." Revise wrapper size estimates upward for Scout, acknowledging the render-path divergence.

---

### [High] Scout's render path is structurally divergent from Profiler's — not addressed in the dedup design

**Location:** §4 "The unified chat component contract," lines 86-116

The spec's `ChatWithHistoryConfig` and `ChatWithHistoryProps` interfaces don't account for a fundamental structural difference: **Scout conditionally renders `<ScoutChatPanel>` (a 681-LOC component with its own lead-stream context props), while Profiler unconditionally renders `<SignalsContextChat>` (soon `ContextChat`) with a static `EMPTY_PROFILER_CONTEXT` fallback.**

The `renderExtras` prop in `ChatWithHistoryProps` appears designed to slot in `AddLeadModal` and `SuggestedCompaniesSection`, but these aren't extras appended alongside the chat — `ScoutChatPanel` *replaces* `SignalsContextChat` as the main chat rendering surface when lead-stream context is active. The spec doesn't specify whether `ChatWithHistory` owns the conditional rendering logic (if `leadContext` → render `ScoutChatPanel`, else render `ContextChat`) or whether the wrapper supplies the entire chat-area render via a prop.

This is the "highest-uncertainty part" acknowledged in §17 (lead-stream genericization), but the interface contract in §4 doesn't reflect that uncertainty. The current interface looks like it assumes both personas always render `ContextChat` with optional extras — which isn't how Scout works today.

**Suggestion:** Add a `renderChat` or `chatComponent` prop to the interface that allows the wrapper to supply the main chat-area renderer, not just extras. Alternatively, document explicitly that `ScoutChatPanel` will be refactored to wrap `ContextChat` rather than replace it. The plan-time escape hatch (§17) is noted but the contract should reflect the known divergence now.

---

### [High] ICP-merge extraction is smaller than implied — and contradicts a prior design decision

**Location:** §8 "ICP-merge resolution," lines 143-148

The spec frames this as "extracting the ICP-merge logic" from `ICPManager.tsx` into `shared/profiler/profilerIcpMerge.ts`. In reality:

1. **The merge algorithm already lives in `shared/profiler/`** via `mergeProfilerAcceptedIcpDisplay` (exported from `shared/profiler/index.ts`). ICPManager already imports and calls it.
2. What remains "inline" is ~58 lines of **view-model mapping** (snake_case → camelCase field normalization, dedup-by-id) at ICPManager lines 179-237.
3. ICPManager itself documents at lines 173-178: *"The profiler-merge (`mergeProfilerAcceptedIcpDisplay`) lives here by design. Plan-25 T21 named a `ProfilerMergeView` component for this; it was intentionally NOT created."*

The spec is extracting a data-transform from a container component that was previously and deliberately left in place. The prior reasoning (it's a container data-transform with no extractable render region) may still be valid — the extracted function will be a ~40-50 line mapper that takes `mergeProfilerAcceptedIcpDisplay` output and normalizes it. The architectural gain is eliminating a `customers → mission-control` cross-feature import, which is real but modest.

**Suggestion:** Clarify that the extraction targets the view-model mapping (~58 LOC), not the merge algorithm (already shared). Acknowledge the prior design decision and explain why it's being revisited (the cross-feature import elimination). This sets correct expectations for the plan.

---

### [High] ScoutDeploymentDetails.tsx not mentioned in the file manifest or scope

**Location:** §7 "features/scout/," lines 133-141; Appendix file manifest, lines 228-242

A third ScoutDeployment-related file exists: `src/components/market-research/ScoutDeploymentDetails.tsx` (70 LOC), imported by `features/market-research/components/intelligence/IntelligenceTab.tsx`. It's annotated `// HANDOFF → scout (Spec 24 §7)`. The spec's §7 and Appendix manifest list two ScoutDeployment files (page + component) but omit this one.

This file is a read-only deployment details card used within the market-research feature's intelligence tab. It should either be:
- Moved to `features/scout/components/` (if it's genuinely Scout's domain), or
- Left in place with a TD entry (if it's more closely tied to the intelligence-tab surface), or
- Moved to `features/market-research/` (if it's consumed only there)

The spec should acknowledge it and make an explicit disposition call.

**Suggestion:** Add a disposition for `ScoutDeploymentDetails.tsx` — either scope it into §7 or record it as an explicit out-of-scope with a TD entry.

---

### [Medium] Wrapper size estimates are optimistic

**Location:** §6, lines 126-127: "50-80 LOC thin wrapper" for Scout, "20-40 LOC" for Profiler

Given the render-path divergence (ScoutChatPanel vs ContextChat), the scout-specific `editHistory`/`onTabChange` props, the `suggestionPrefill` state and its handlers, and the conditional render logic for lead-stream vs standard chat, the Scout wrapper is likely **100-150 LOC**, not 50-80. The Profiler estimate is more plausible but depends on how the `EMPTY_PROFILER_CONTEXT` fallback is handled.

**Suggestion:** Widen the estimates or add a hedging note. The exact LOC doesn't matter for the spec, but underestimating sets up the plan for a mismatch between expected and actual effort.

---

### [Medium] `editHistory` and `onTabChange` scout-specific props missing from the unified interface

**Location:** §4, `ChatWithHistoryProps` interface, lines 106-113

The existing `ScoutChatWithHistory` accepts `editHistory` and `onTabChange` props that have no Profiler equivalent. The unified `ChatWithHistoryProps` interface shows `onTabChange` but not `editHistory`. The spec should account for all props that differ between the two wrappers, either by including them in the interface (with optional typing) or by documenting that they're handled by the wrapper.

**Suggestion:** Audit both wrappers' full prop surfaces and ensure the unified interface covers every prop, either as part of the core interface or explicitly delegated to the wrapper's `renderExtras`/slot mechanism.

---

### [Medium] Sidebar width/styling differences between Scout and Profiler not addressed

**Location:** §4, §6

Scout's sidebar uses `w-64 sm:w-72 min-w-[14rem] max-w-[min(18rem,42vw)]`; Profiler uses `w-[28rem] min-w-[24rem] max-w-[90vw]`. These are significantly different responsive breakpoints and widths. The unified component must either accept these as config or leave them to the wrapper. The spec doesn't specify which.

**Suggestion:** Add a `sidebarClassName` or `sidebarStyle` config field, or explicitly state that sidebar styling is the wrapper's responsibility.

---

### [Medium] `features/customers/` cross-feature import not fully eliminated by ICP extraction alone

**Location:** §8, lines 147: "eliminating the current `customers → mission-control` cross-feature read"

The spec claims the ICP-merge extraction eliminates a `customers → mission-control` cross-feature import. This should be verified: if customers' `icp-intelligence/*` components import anything else from `features/mission-control/` beyond the merge function, the extraction only partially resolves the coupling. The spec should either confirm the merge function is the sole cross-feature import or note that full decoupling requires additional work.

**Suggestion:** Enumerate the actual imports from `features/customers/` → `features/mission-control/` and confirm this is the only one. If others exist, note them as out-of-scope with TD entries.

---

### [Low] TD-FE numbering coordination is fragile

**Location:** §15, line 202: "claim TD-FE-57+ (master ceiling = 53; Phase 10 takes 54–56)"

This is a coordination concern, not a spec defect. The ceiling is currently TD-FE-53. If Phase 10 or Phase 12 worktrees claim different numbers before this phase merges, there will be conflicts. The spec correctly notes that "final numbers assigned at write time" (line 212), which is the right approach.

**Suggestion:** None needed — the current handling is adequate.

---

### [Low] Plan-readiness is strong but the render-path divergence is a plan-level blocker

**Location:** §13 "Staged execution," overall

The spec decomposes cleanly into 5 ordered stages with clear boundaries and commit granularity. The parallel-worktree coordination section (§14) is thorough. The main plan-readiness gap is the render-path divergence (see High finding above) — the plan author will need to resolve the ScoutChatPanel vs ContextChat question before Stage 1 can be implemented. The spec acknowledges this as an uncertainty (§17) but doesn't give the plan author enough interface guidance.

**Suggestion:** Expand the §17 lead-stream open question to include a concrete decision tree: (a) ScoutChatPanel wraps ContextChat internally, (b) ChatWithHistory accepts a `renderChat` prop, or (c) fall back to Approach-2 (base + named wrappers). Give the plan author a clear framework for resolving this.

---

### [Nit] Spec references "Spec 24 §7" annotation but ScoutDeploymentDetails was not in Spec 24's scope

**Location:** Not directly in this spec, but the `ScoutDeploymentDetails.tsx` annotation references Spec 24.

The `// HANDOFF → scout (Spec 24 §7)` comment on `ScoutDeploymentDetails.tsx` suggests it was identified as a Phase 9 candidate during Phase 5. Its omission from this spec may be intentional (out-of-scope) or an oversight. Noting for the author's awareness only.

---

### [Nit] Appendix manifest row for "Edit `App.tsx`" could be more specific

**Location:** Appendix file manifest, line 241: "Edit `App.tsx` (remove ScoutDeployment import + route), `app/routes.tsx` (add `scoutRoutes`)"

The edit to `App.tsx` is at lines 87-94 (route block) and line 11 (import). The edit to `app/routes.tsx` is at the `featureRoutes` array (line ~13). Not a defect — just noting for the plan author that these are small, surgical edits at known line ranges.
