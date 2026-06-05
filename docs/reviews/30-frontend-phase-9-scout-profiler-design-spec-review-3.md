---
artifact: specs/30-frontend-phase-9-scout-profiler-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 3
---

## Context

Round 3 review of the post-synthesis spec. Rounds 1–2 (and their syntheses) addressed the major structural issues: the render-surface plumbing now uses `renderChat` (round 1), the ICP disposition is correctly "confirm and document, no extraction" (round 1), the partial drain is explicit with per-file dispositions for all 11 files (round 2), `types.ts` moves to feature-level not scout-chat/ (round 2), and imperative ref forwarding is explicitly scoped out (round 2). Codebase verification confirms all LOC counts, importer lists, and structural claims in the current spec text are accurate against the phase-9 worktree.

## Findings

### [Low] `emptyContext` vs `initialContext` semantic boundary is implicit

**Location:** §4 `ChatWithHistoryConfig` interface, lines 100–106

`ChatWithHistoryConfig.emptyContext` is described as "profiler's EMPTY_PROFILER_CONTEXT fallback," while `ChatWithHistoryProps.initialContext` is "the context passed from the parent" (e.g., the signals→chat handoff). Both are `SignalsChatContext`-typed. The spec doesn't explain when `emptyContext` is consulted vs `initialContext`. From the current codebase, the distinction is: `emptyContext` seeds a *new session's* context when `initialContext` is null, while `initialContext` is the live handoff from the parent component. A brief comment or note clarifying this relationship would prevent the plan author from discovering the semantics during implementation.

### [Low] `ChatWithScout.tsx` destination defaults to `components/` root but the spec won't commit

**Location:** §9 table row for `ChatWithScout.tsx` (line 188), §17 open question (line 277)

The spec records the destination as "plan picks `components/` vs `trends/`" and §17 flags it as an open question. `ChatWithScout.tsx` has two consumers: `TrendsTab` (in `trends/`) and `MarketResearchPage` (page level). Neither subfolder is clearly dominant. The spec could recommend a default (e.g., `components/` root as the neutral choice for a file consumed by two sub-features) while preserving the plan's authority to override. As-is, the plan author has no guidance on the spec's preference, which is fine — just a missed opportunity for a non-binding recommendation.

### [Low] §12 doesn't explicitly confirm that the render-surface swap test coverage survives the dedup

**Location:** §12 Testing, line 224

The spec says the existing `ScoutChatWithHistory.test.tsx` "must pass through the now-thin wrappers" and "exercises persona behavior, the render-surface swap, and scout's lead-stream end-to-end." After the dedup, the swap logic (`activeSession.context ? <ContextChat/> : <ScoutChatPanel/>`) moves into the wrapper's `renderChat` callback. The existing test should still exercise this because it tests the wrapper's external behavior (render output), not its internal structure. The spec doesn't explicitly state this reasoning — it just says the test "must pass." Adding a brief note (e.g., "the swap assertion path is unchanged because the test queries the wrapper's render output, which includes the renderChat result") would strengthen the testing section's confidence.

### [Nit] `onClearContext` optionality in `ChatWithHistoryRenderState` is unexplained

**Location:** §4 `ChatWithHistoryRenderState.onClearContext?`, line 119

Both `ChatWithHistoryRenderState.onClearContext` and `ChatWithHistoryProps.onClearContext` are optional (`?`). The spec doesn't explain when a caller would omit this. If both Scout and Profiler always provide it (because both wrappers expose a context-clear action), the optionality is forward-compat noise. If one persona genuinely doesn't need it, the spec should say which. Trivial — the plan will discover this — but the optionality currently communicates "maybe needed, maybe not" without guidance.

### [Nit] TD-FE-50 (untyped `signalsChatContext` sessionStorage handoff) has pull-forward trigger "Phase 9" but Phase 9 doesn't type it

**Location:** §2 out-of-scope (not listed), TECH_DEBT.md TD-FE-50

TD-FE-50's pull-forward trigger is "Phase 9 chat-surface dedup." Phase 9's spec doesn't type the handoff (it's a behavior-preserving refactor, and typing the sessionStorage payload would be a contract addition). The TD entry's trigger should be updated to reflect that Phase 9 explicitly chose not to type it, pushing the trigger to a later phase. This is a TD housekeeping item, not a spec defect — the spec's scope boundary is correct.

### [Nit] §14 "commit surgically by path, never `git add -A`" is process guidance, not design intent

**Location:** §14, line 247

The spec's header says "design intent (frozen record once merged)." The surgical-commit guidance in §14 is procedural (how to work in a shared worktree), not design intent. It belongs in the plan, not the frozen spec. The spec already correctly labels §14 as "parallel-worktree coordination" so the content isn't surprising — just noting the frozen-record tension.
