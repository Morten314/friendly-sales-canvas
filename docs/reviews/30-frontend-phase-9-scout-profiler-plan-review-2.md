---
artifact: plans/30-frontend-phase-9-scout-profiler.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 2
---

## Context

Round 1 (this file, same date) found 4 High / 5 Medium / 4 Low / 3 Nit items. The plan has not been revised since round 1, so this round re-evaluates the same plan text against the full 12-axis checklist. Round-1 findings that remain unfixed are carried forward with updated citations; new findings from the broader checklist coverage are added.

## Findings

### [High] No global kill criteria — plan can fail without a graceful abandon path

**Location:** "Global abort (whole-plan kill criterion)" paragraph (line 33)

Round 1 identified this. The plan now contains a global abort paragraph (line 33): "The phase is suspended … when a stage gate **or** the finalize preflight fails on a *genuine parity break* — a rendered behavior/visual change, or a changed storage key / route / session-id prefix — that cannot be fixed without changing behavior." This is a well-defined kill criterion. However, it only covers *parity breaks*. It does not cover:

- An unfixable typecheck failure introduced by concurrent Phase 10/12 merges to master (the plan says "mechanical union-resolve" but doesn't define what happens if the resolution itself breaks parity).
- A persistent e2e VR flake that never greens even after `--no-file-parallelism` reruns (the plan says "rerun" but doesn't set a strike limit for flake-induced failures, unlike the 3-strike rule for parity-critical seams).

The kill criterion covers the primary risk (parity break) but leaves secondary failure modes underspecified. A single sentence like "Any failure mode that cannot be resolved within 3 attempts on the branch triggers escalation to the human controller, who decides suspend vs. continue" would close this gap.

### [High] Task 2 (shell implementation) remains a single-commit monolith for the parity-critical seam

**Location:** Task 2 Steps 1–9 (lines 264–404)

Round 1 identified this. The plan includes an "Optional finer-grained split" note (line 406) that suggests two commits instead of one. This is good — but it remains optional, and the primary instruction is one commit. For the self-identified "parity-critical seam #1," the split should be the **default**, not an optional refinement. The risk: if the INGEST effect (Step 4) has a parity break, the executor discards the handlers+JSX work (Steps 1, 2, 5, 6) along with it. The optional note mitigates this but doesn't prevent an executor from following the primary instruction.

### [High] Spec-to-plan contract divergence is large and partially undocumented

**Location:** Plan contract block (lines 86–157) vs Spec §4 (spec lines 100–131)

Round 1 identified this. The plan's self-review note (lines 1113–1116) documents the main divergences, but three field renames remain unmentioned in the divergence section:

1. `config.storageKey` → `config.storageKeyPrefix` (plan line 114 vs spec line 103)
2. `config.sidebarClassName` → `config.sidebarOpenClassName` (plan line 118 vs spec line 106)
3. `ChatSession.createdAt` — present in the plan contract (line 107) but absent from the spec's `ChatSession` (spec line 109–115)

Each is behavior-preserving and correct, but the sheer number of undocumented divergences (3 renames + 7 additions + 1 structural replacement = 11 changes from a ~30-line interface) means the spec is no longer a reliable reference for the shell contract. The plan is the authoritative source, which is fine — but the plan should explicitly state "the spec §4 contract is fully superseded by the plan contract block above" rather than leaving the reader to diff them.

### [High] Render-prop stale-closure risk is addressed by convention but not by enforcement

**Location:** "Render-prop semantics" paragraph (lines 159–160)

The plan explicitly states that `renderChat`/`renderExtras` must be inline arrows, never `useCallback`-memoized, and that the shell must not be `React.memo`-wrapped. This is the correct fix for the stale-closure risk round 1 raised. However, the enforcement mechanism is "convention stated in the plan" — there is no lint rule, no code comment in the shell, and no test that would catch a future developer adding `useCallback` to the render prop. For a parity-critical seam, a brief code comment at the shell's render-prop invocation site (e.g. `// Deliberately not memoized — see plan §render-prop-semantics`) would be a more durable safeguard than plan prose alone.

### [Medium] S3 and S4 parallelizability is stated but not operationalized

**Location:** Architecture paragraph (line 7): "S3/S4 are independent … they may be dispatched to **parallel subagents**"

Round 1 identified this. The plan correctly identifies independence and says they "may be dispatched to parallel subagents," but does not provide operational guidance: which tasks can share a worktree (they already do — same branch), what happens if one fails while the other is in-flight, and whether the stage gates must be serialized (only one can bind `:5173` at a time). The practical bottleneck is the e2e gate (shared `:5173` port), not git. A note like "S3 and S4 may run concurrently up to their stage gates, which must be serialized due to the shared preview port" would operationalize the parallelism.

### [Medium] No regression signal for the `FeatureErrorBoundary` addition in S4

**Location:** Task 10 Step 3 (lines 896–918), Task 11 (lines 991–1027)

Round 1 identified this. The plan's justification (line 883) argues that `FeatureErrorBoundary` is "provably output-neutral on the happy path" because it "renders its children unchanged and only swaps to a fallback when a descendant throws." The argument is sound, but it relies on the executor verifying that `FeatureErrorBoundary`'s implementation matches this contract. The plan never asks the executor to verify this — it assumes it. A single assertion in the Task 11 test that the page renders its heading without an error boundary wrapper (e.g. checking that no `[data-testid="feature-error-boundary"]` appears in the DOM) would close the gap.

### [Medium] Task 6's importer enumeration is stale-prone; plan acknowledges but the staging instruction contradicts

**Location:** Task 6 Steps 3–4 and Step 8 (lines 703–743)

The plan's conventions (line 21) state: "re-derive each task's final `git add` set from the actually-edited files, not by copying the plan's enumerated staging list verbatim." This is good. But Task 6 Step 8 (line 742) lists an explicit `git add` command with 11 hardcoded paths. An executor following the plan linearly would naturally copy that command. The convention is in the preamble, but each task's explicit staging command creates a contradictory instruction. A brief note in each task's commit step like "adjust paths per grep results if new importers found" would resolve the tension.

### [Medium] Recovery strategy for Task 14 Step 2 (manual smoke) failure is underspecified

**Location:** Task 14 Step 2 (line 1093)

Round 1 identified this. The plan says "Pass = frozen routes/behaviors/visuals render; fail = no merge." The global abort paragraph (line 33) partially addresses this: "The same rule covers a failed manual smoke: fix-on-branch and re-run smoke + preflight; if the failure is an unfixable parity break, suspend and escalate." This is adequate for parity breaks. But if the smoke fails for an environmental reason (e.g. the dev server won't start, a network issue), the plan doesn't distinguish "environmental failure" from "parity break." A brief note: "environmental smoke failures (server won't start, etc.) are not abort triggers — fix and re-run" would clarify.

### [Medium] Hidden prerequisite: the plan assumes Phase 10 and Phase 12 haven't merged to master yet

**Location:** Task 14 Step 4 (lines 1101–1107)

The merge step (Task 14 Step 4) merges into master. The plan assumes `App.tsx`/`routes.tsx`/`TECH_DEBT.md` conflicts with Phase 10/12 are "mechanical union resolutions." But if Phase 10 or 12 have already merged to master between branch creation and finalize, the conflict resolution may not be mechanical — it could require re-running the S4 stage gate (which touches the same files). The plan doesn't state this prerequisite explicitly or provide a pre-merge check step like `git -C "$MAIN" log --oneline master..origin/master` to detect concurrent merges.

### [Medium] Verification gap: the INGEST effect's agent-gate is only tested end-to-end

**Location:** Task 2 Step 4 (lines 343–350), Task 3 (lines 408–492)

The INGEST effect with `gateIncomingByAgent` is the mechanism that prevents Profiler from ingesting Scout contexts and vice versa. The shell unit test (Task 3) does not test this gate at all — it uses `config.agent: "profiler"` but never sends a mismatched `initialContext`. The wrapper tests cover this end-to-end (ProfilerChatWithHistory.test.tsx exercises the gate through the mocked shell), but if the gate logic is wrong, it would only surface during manual smoke (Task 14 Step 2) or the S2 e2e gate. A single test case in Task 3 that sends `initialContext: { agent: "scout" }` with `config.agent: "profiler"` and asserts no new session is created would close this.

### [Low] S2 stage gate should re-run `03-signals-feed-action` but doesn't

**Location:** Stage gates, S2 (line 26): "profiler → 06; scout → 04 + 03"

Round 1 identified this. The S2 gate actually *does* include `03` for scout ("scout → 04 + 03" on line 26). This was a round-1 misread. However, the Profiler gate only runs `06` (line 26). Since both wrappers render through the same shell, a regression in the shell could manifest in either persona's e2e journey. Running all three journeys after each S2 task (not just after Task 5) would be more thorough.

### [Low] The `handleClearActiveContext` callback has `handleNewChat` in its dependency array — potential circular dependency

**Location:** Task 2 Step 5 (lines 353–362)

```ts
const handleClearActiveContext = useCallback(() => {
  sessionStorage.removeItem("signalsChatContext");
  onClearContext?.();
  handleNewChat();
}, [onClearContext, handleNewChat]);
```

If `handleNewChat` is also a `useCallback` that depends on state set inside `handleClearActiveContext`, there's a potential circular dependency. The plan's pseudocode doesn't show `handleNewChat`'s definition, but the structural risk is that `handleClearActiveContext` calls `handleNewChat`, which may read stale state if the useCallback memoization doesn't capture the latest values. This is a Low finding because the plan says to lift the handlers "verbatim" from the live code, which presumably works today — but the memoization pattern should be verified against the live implementation.

### [Low] Plan references spec section numbers without inlining the relevant content

**Location:** Throughout — e.g. "Spec 30 §5" (line 169), "Spec 30 §13" (line 169), "Spec 30 §17" (line 32)

The plan relies heavily on cross-references to the spec ("Spec 30 §X"). For a 1100-line plan executing in a subagent context, this requires the executor to have the spec loaded. Most references are contextual anchors, not critical content. But the abort/escalation paragraph (line 32) references "Spec 30 §17" for the Approach-2 fallback without inlining the fallback description. Round 1 flagged this; the plan hasn't changed.

### [Low] Task 3 shell test mocks `@/shared/auth` but doesn't test the `storageKey = null` path

**Location:** Task 3 Step 1 (lines 414–480)

The shell sets `storageKey = currentUser?.uid ? \`${config.storageKeyPrefix}_${currentUser.uid}\` : null` (Task 2 Step 1, line 309). When `storageKey` is null, the LOAD and PERSIST effects short-circuit. The test always provides `currentUser: { uid: "u1" }`, so it never tests the null-storage-key path (no authenticated user). This is a minor gap — the shell is only used behind auth guards — but worth noting as a known untested branch.

### [Low] `components/market-research/types.ts` moved to `components/types.ts` — flat name in a feature directory

**Location:** Task 6 (line 692), File structure (line 68)

`types.ts` is a very generic filename. After relocation, `features/market-research/components/types.ts` will shadow any other `types.ts` in the component tree and may confuse import autocomplete. The plan follows spec §9's directive ("NOT under scout-chat/"), but a slightly more specific name like `market-research-types.ts` or `shared-types.ts` would reduce ambiguity. This is a style preference, not a defect.

### [Nit] The plan's self-review section (lines 1112–1118) is excellent

**Location:** "Self-review note" (lines 1112–1118)

Not a finding — noting that the self-review section is unusually thorough and useful. It maps spec sections to tasks, documents contract finalizations vs spec §4, and explains type-consistency. This is a model practice for plan quality.

### [Nit] Inconsistent use of comment style in plan code blocks

**Location:** Task 2 Step 1 (lines 267–317) uses `// …` comments in the pseudocode; Task 10 Step 3 (lines 896–918) uses `/** … */` JSDoc style.

Both styles appear in the plan's code blocks. Not a defect — the plan is a specification, not source code — but worth noting for consistency.

### [Nit] Task 1 Step 5 silent-failure warning for mock keys could be a hardening step

**Location:** Task 1 Step 5 (lines 216–218)

Round 1 identified this. The plan flags the silent-failure risk of unmatched mock keys. The verification grep (Task 1 Step 8, line 235) does check for this, but only as a text grep. An alternative would be to change the test assertion to check for `data-testid="signals-context-chat"` (or `data-testid="substrate"`) — if the mock doesn't intercept, this testid won't be in the DOM. The plan's bold warning is sufficient awareness-raising; this is a marginal improvement.

### [Nit] Task 10 Step 5 `README.md` content is verbatim but references "TD-FE-57" which may renumber

**Location:** Task 10 Step 5 (line 939): references `TD-FE-57`

The README template references "TD-FE-57" as a deferred item. Task 13 Step 3 assigns TD numbers based on the ceiling at execution time. If the ceiling has advanced, TD-FE-57 may become TD-FE-61 (or similar). The README should be written after the TD reconciliation (Task 13), not before — but the plan orders Task 10 (S4) before Task 13 (finalize). This is a minor ordering nit: the TD number in the README may need to be corrected after Task 13 runs.
