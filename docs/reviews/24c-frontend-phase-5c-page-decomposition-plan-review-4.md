---
artifact: plans/24c-frontend-phase-5c-page-decomposition.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-31
round: 4
---

## Context

Round 4 reviews the post-R3-rewrite plan. All seven findings from round 3 were addressed: Task 1 is now a pure move (Safe kept intact), Task 4 Step 1a names the `ScoutResearchContext` type, the window-global refresh helpers are in Task 1 Step 3's move inventory, the orphan-server guard is present in Tasks 4 and 6, the "moved, not modified" review expectation is stated, the shell-handler independence verification is in Task 1 Step 2, `signalsChatContext` is pre-decided in Task 4 Step 1c, and the stale-review flagging is in the header. This round concentrates on newly surfaced issues in the rewritten text. Reviewed against Spec 24 §5 (round 5), the R1 findings document, and live source verification of import paths and type shapes.

## Findings

### [Medium] Duplicate type: Task 4 Step 1a creates `ScoutResearchContext` without acknowledging the existing identical `ChatWithScoutResearchContext`

**Location:** Task 4 Step 1a — "add `export interface ScoutResearchContext { … }` to `frontend/src/features/market-research/types.ts`" + the page's inline `useState<{…}>` at L392.

The page declares `scoutResearchContext` with an inline type at L392 whose fields are `leads`, `opportunity?`, `icp?`, `reportTraits?`. `ChatWithScout.tsx` (L16–21) already defines `ChatWithScoutResearchContext` with the **exact same shape**. The plan instructs extracting the inline type to a new feature-local `ScoutResearchContext` without noting this existing definition. The implementer then has an unacknowledged choice: import `ChatWithScoutResearchContext` from a leaving legacy component (violating the intended feature→legacy dependency direction for type imports), or create a feature-local duplicate (acceptable per §2.2 / the polyglot-repo "types do not cross the boundary" principle, but should be stated). Either way, a future maintainer seeing two identical types will question the duplication. The plan should: (1) acknowledge `ChatWithScoutResearchContext` exists and is identical, (2) state the intended choice (likely: feature-local type, duplication accepted — the feature owns its types, and `ChatWithScout` leaves in Phase 8/9), and (3) note that structural typing means `TrendsTab` can pass `ScoutResearchContext` to `ChatWithScout`'s `researchContext` prop without a cast.

### [Medium] Task 1 Step 1 TDD is overengineered for a pure-move extraction

**Location:** Task 1 Step 1 — "Write the failing render test … Use MSW for any fetch the moved data layer fires on mount."

Task 1 is a **pure move** — the plan's own Task 1 blockquote says "the reviewer of Task 1 audits a 'moved, not modified' diff." Writing a failing render test before the component exists requires advance knowledge of `IntelligenceTab`'s prop surface and mount requirements, which is only determined during Step 3's extraction. The instruction to "Use MSW for any fetch the moved data layer fires on mount" means provisioning handlers for up to 9 fetch sites to 2 endpoints — significant setup that duplicates coverage the existing page-level Vitest suite and `journeys/04` already provide. For a task whose entire guarantee is "byte-identical modulo import paths," TDD adds ceremony without its usual design-feedback benefit. The characterization-test effort is better spent on Task 2's sanitizer (where it is concrete and valuable). Consider making the render test a post-extraction smoke (run after Step 3 to confirm the extracted component mounts) or dropping it entirely and relying on the full-suite run in Step 5.

### [Low] Task 4 should verify trends `TabsTrigger` still fires navigation after removing its matching `TabsContent`

**Location:** Task 4 Step 2 — "remove the empty `TabsContent value='trends'` placeholder (L6930–6933)."

Removing the empty placeholder means the Radix `Tabs` component has no content panel for the `"trends"` value. While Radix triggers typically function independently of matching content (the trigger fires `onValueChange` regardless), this plan's entire safety claim is behavioral parity via `journeys/04`. The trends tab's ONLY navigation path is the `TabsTrigger` → `handleTabChange` chain. If removing the matching `TabsContent` causes the trigger to stop firing (e.g., a shadcn wrapper that hides triggers with no matching content, or a Radix version-specific behavior), the trends tab becomes unreachable with no compile-time or test failure to surface it — only the E2E journey would catch it, and even then only if `journeys/04` exercises the trends trigger click. Add a brief manual verification or an explicit assertion in the Task 4 Step 3 test run that the trends trigger is clickable and navigates correctly.

### [Low] Task 5 Step 2 is underspecified on what to remove vs. what stays

**Location:** Task 5 Step 2 — "Reduce the page to a thin shell."

The paragraph describes what the shell *does* (tab routing, Layout, render tab containers, hold cross-tab state + handlers) but doesn't enumerate what should be **removed** at this step. After Tasks 1/3/4, the page may still hold residual imports, helper functions, or dead code from the pre-extraction monolith that none of the prior tasks explicitly cleaned up (e.g., imports for the moved data-layer symbols that Task 1 moved but whose `import` statements were only removed "if they have zero remaining page references" — a grep that could miss re-exported or destructured forms). Task 5 Step 2 would benefit from a brief removal checklist: "remove any remaining imports/helpers that were only used by the moved code; confirm the shell's import block contains only [router, Layout, tab containers, types, the 3 handler dependencies]." This makes the "thin shell" claim directly auditable in the commit diff.

### [Nit] Task 4 Step 1c mount/unmount verification is resolvable at plan-writing time

**Location:** Task 4 Step 1c — "Precondition to verify in Step 2: the out-of-band branch must mount/unmount `TrendsTab` on tab change (not hide it with CSS) … Confirm which, then implement accordingly."

The current code at page ~L6494 renders the trends block inside a conditional `{activeTab === "trends" && …}` — this IS conditional rendering (mount/unmount), not CSS hiding. The answer is knowable by inspection now. The "verify and decide" instruction can be replaced with a direct statement: "The out-of-band branch conditionally renders (mount/unmount), so `TrendsTab` mounts only when trends is active, making the `activeTab === 'trends'` guard implicit — no `isActive` prop needed."

### [Nit] Legacy component import paths in Tasks 3 and 4 are verified correct against live source

**Location:** Task 3 Step 2 (`@/components/market-research/ScoutLeadStream`), Task 4 Step 1b (`@/components/signals/ScoutChatWithHistory`, `@/components/market-research/ChatWithScout`).

Confirmed via source grep: `ScoutLeadStream` is at `@/components/market-research/ScoutLeadStream` (page L16), `ScoutChatWithHistory` at `@/components/signals/ScoutChatWithHistory` (page L19), `ChatWithScout` at `@/components/market-research/ChatWithScout`. `SignalsChatContext` type is at `@/components/signals/SignalsContextChat`. All paths match live imports. No issue — noted for traceability.
