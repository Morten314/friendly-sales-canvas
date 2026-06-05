---
artifact: plans/30-frontend-phase-9-scout-profiler.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 1
---

## Findings

### [High] No kill criteria or global abort conditions for the plan as a whole

**Location:** Plan preamble ("Abort / escalation" paragraph, line 32) and Finalize (Task 14)

The plan has per-step recovery (`git reset --hard <last-green-checkpoint>`) and a three-strikes escalation for the two parity-critical seams (shell build + scout collapse). But it never states when the **entire plan gets abandoned**. The closest it comes is Task 14 Step 3: "Red = report the failing check, do not merge, fix-on-branch-and-re-run or abort (Spec 14 §5.3)." This defers abort criteria to an external spec without restating the threshold. If preflight fails on a VR regression in an unrelated journey (e.g. Phase 10 concurrently shifted `App.tsx` rendering), the executor has no guidance on whether to keep trying, to escalate, or to discard the branch. A plan running across three concurrent worktrees without a stated abandon threshold can spin indefinitely.

### [High] Task 2 (shell implementation) is a single ~300-LOC monolithic step with no intermediate checkpoints

**Location:** Task 2 (lines 249–396)

The plan's own conventions mandate "one logical step = one commit," but Task 2 is **eight checklist items that land as one commit** (Step 9). Steps 1–6 (write the component with LOAD/PERSIST/INGEST effects, handlers, and JSX) are all bundled. If the INGEST effect (Step 4) or the JSX parameterization (Step 6) introduces a parity break, the executor must discard the entire shell commit and start over — there's no intermediate "handlers done, effects done" checkpoint. For the plan's self-identified "parity-critical seam #1," this is a fragile structure. Suggestion: split into at least two commits: (a) shell skeleton + handlers + JSX, (b) effects (load/persist/ingest), or alternatively gate on `typecheck` after Step 1–6 before committing.

### [High] Spec §4 contract diverges from plan contract, and the plan silently overrides spec fields

**Location:** Plan "The ChatWithHistory shell contract" block (lines 85–153) vs Spec §4 (lines 100–132)

The plan explicitly notes three deviations from the spec contract (lines 89–91): `emptyContext` moves out of the shell into Profiler's `renderChat`, `renderExtras` drops its args, and seven new fields are added (`gateIncomingByAgent`, `outerMaxWidthNone`, `emptyState`, `getSessionDisplayTitle`, `hydrateExtraSessions`, `serializeSession`, `onNewChat`). The plan's self-review note (lines 1105–1106) documents these corrections. However:

1. `config.storageKey` in the spec becomes `config.storageKeyPrefix` in the plan (line 111), with a different runtime behavior (`storageKeyPrefix` + `_${uid}` vs the spec's single `storageKey`). The plan never calls out this rename.
2. `config.sidebarClassName` in the spec becomes `config.sidebarOpenClassName` in the plan (line 115). Also uncalled-out.
3. `renderExtras` in the spec takes `(state: ChatWithHistoryRenderState) => ReactNode`; the plan makes it `() => ReactNode` (line 152). The plan notes this (line 90), but the downstream implication — that Scout's `AddLeadModal` can no longer read from `state.session` — is not analyzed. If Scout's modal ever needs session data (it doesn't today, but the spec anticipated it might), the plan has foreclosed the extension point without noting it as a tradeoff.
4. `buildInitialSession` from the spec is replaced by `hydrateExtraSessions` + `serializeSession` + `onNewChat`. This is a substantially different mechanism. The plan's self-review covers it, but the plan-to-spec delta is large enough that a re-review of the spec against the plan contract would be warranted.

These are all behavior-preserving choices faithful to the actual code, but the number of silent field renames reduces the spec's value as a coordination artifact.

### [Medium] S3 (relocate residue) and S4 (features/scout) are serialized but could run in parallel

**Location:** Architecture paragraph (line 7): "S3/S4 are independent of S1–S2 and of each other."

The plan correctly identifies that S3 and S4 are independent of each other and of S1/S2, but does not exploit this. They run sequentially (Tasks 6–9, then Tasks 10–11). Given that the plan is designed for subagent-driven execution (line 3), the plan should explicitly state whether S3 and S4 can be dispatched to parallel subagents, and if not, why not (e.g., shared `App.tsx`/`routes.tsx` contention with other worktrees, or the executor model being single-agent). Without this, a parallelizing executor must guess.

### [Medium] No regression signal for the `features/scout` route rewire

**Location:** Task 10 (lines 862–978) and Task 11 (lines 981–1017)

Task 10 adds `FeatureErrorBoundary` wrapping to the scout deployment route (lines 900–901). The plan states this is "additive and does not change happy-path behavior" (line 873), but provides no verification that the error boundary doesn't alter the rendered output. The S4 stage gate (line 28) says "no scout-deployment Playwright journey exists — rely on the S4 Vitest render test + the finalize manual smoke." The Vitest test (Task 11) mocks `Layout` and the form component, so it won't detect whether `FeatureErrorBoundary` wraps differently than the original `<Route>` in `App.tsx`. The manual smoke (Task 14 Step 2) is human-dependent and not automated. This is a gap in regression coverage for the only behavioral addition in an otherwise pure-refactor plan.

### [Medium] `ChatWithScout.tsx` destination ambiguity: spec says "2 consumers" but plan found 1

**Location:** Spec §9 (line 190): "consumers TrendsTab + MarketResearchPage"; Plan Task 7 (line 742): "Sole component consumer is TrendsTab.tsx:6"

The spec claims `ChatWithScout.tsx` has two consumers (`TrendsTab` and `MarketResearchPage`), but the plan found only one (`TrendsTab`). The plan explains the discrepancy: "`MarketResearchPage.tsx`'s `ChatWithScout` references are an unrelated local handler/prop, not this import" (line 742). This is a spec fact correction. But the spec's §17 open question ("§9 fixes the destination feature and recommends the `components/` root (neutral for its two consumers)") was premised on two consumers. With one consumer, `components/trends/` might be equally valid. The plan chose `components/` root, which is fine, but the spec-to-plan consumer-count mismatch should have triggered a spec erratum, not just a plan footnote.

### [Medium] Task 6 (coupled ScoutChatPanel + types relocation) has a fragile importer enumeration

**Location:** Task 6 Step 3 (lines 693–701)

The plan enumerates 8 importers of `types.ts` and 2 importers of `ScoutChatPanel.tsx`. The grep-backstop (Step 6) catches stragglers, which is good. But the enumeration is used as the **commit staging list** (Step 8, line 732), which is explicitly listed as a surgical staging requirement. If a new file imports `types.ts` between plan-authoring and execution (e.g. from the concurrent Phase 10 worktree), the enumeration will be stale, the grep-backstop will catch it, but the executor will have to re-derive the staging list. The plan should note that the staging list must be re-derived from the grep results, not copied verbatim from the plan.

### [Medium] No stated fallback if the manual smoke test (Task 14 Step 2) fails

**Location:** Task 14 Step 2 (line 1083): "Pass = frozen routes/behaviors/visuals render; fail = no merge."

The manual smoke is the only behavioral gate for `/scout-deployment` (which gained `FeatureErrorBoundary`) and for the chat-session persistence round-trip (the wrapper tests mock localStorage, so they don't verify actual persistence). If it fails, the plan says "no merge" but doesn't say what happens next — fix-on-branch and re-smoke? Escalate? This is a single point of failure with no automation fallback.

### [Medium] `renderChat` closure captures wrapper-internal state that the shell doesn't know about — stale closure risk

**Location:** Task 5 Steps 1–4 (lines 574–667)

Scout's `renderChat` (Task 5 Step 2) closes over `suggestionPrefill`, `editHistory`, `onTabChange`, `handleAddToLeadStream`, etc. — all wrapper-local state. The shell re-renders the active session's `renderChat` output on every `sessions`/`activeSessionId` state change. If the wrapper's persona state (`suggestionPrefill`, `addLeadModalOpen`) changes without a shell state change, the render may serve a stale closure. React's render cycle should re-invoke `renderChat` when the wrapper re-renders (since `renderChat` is an inline arrow), but the plan does not analyze this dependency. A `useCallback`-wrapped `renderChat` (which the plan doesn't recommend) would actually cause the stale-closure bug. The plan should explicitly state that `renderChat` must be an **inline arrow** (recreated every render), not memoized.

### [Low] S1 stage gate runs 3 e2e journeys; S2 runs only 1 per persona — asymmetric coverage

**Location:** S1 gate (line 25): 3 journeys; S2 gate (line 26): "profiler → 06; scout → 04"

After the S1 rename, three journeys (`06`, `04`, `03`) run to confirm the substrate is intact. After S2 (the riskier step — actually collapsing wrappers onto the shell), only one journey per persona runs. The `03-signals-feed-action` journey is dropped from the S2 gate even though it exercises the substrate that both wrappers render through. If the S2 collapse changed how the substrate is invoked (e.g. passing different props), the signals journey would catch it — but it's not run. The full suite only runs at finalize. The plan should re-run `03` at the S2 gate.

### [Low] The "Approach-2 fallback" in the abort section references Spec 30 §17 but doesn't inline the fallback

**Location:** Lines 32 (abort/escalation paragraph)

The plan's abort strategy says "fall back to Approach-2 — a `ChatWithHistoryBase` + named per-feature wrappers, suspend and revisit Spec 30." This requires the executor to read Spec 30 §17 at abort time. In a high-pressure failure scenario, cross-referencing an external doc is an unnecessary cognitive load. A two-sentence summary of Approach-2 inline would make the abort path self-contained.

### [Low] Task 3 (shell unit test) only tests 3 scenarios; the shell contract has ~15 behaviors

**Location:** Task 3 (lines 398–482)

The test covers: (1) empty state renders, (2) new-chat creates a session and persists, (3) `hydrateExtraSessions` prepends and selects active. Missing from the test: sidebar toggle, session delete, context ingest (the INGEST effect), `serializeSession` strip, `onNewChat` callback, `gateIncomingByAgent` filtering, `getSessionDisplayTitle`, and `renderExtras`. The plan says "test the shell's own behavior" but the provided test skeleton is a minimal smoke. The existing wrapper tests pick up some of this, but only through mocked paths. This is acceptable for a behavior-preserving refactor (the wrapper tests are the real guards), but the plan should acknowledge that the shell test is a skeleton, not comprehensive.

### [Low] Spec's `onTabChange` appears on `ChatWithHistoryProps` (spec line 127) but plan moves it off the shell entirely

**Location:** Spec §4 line 127 vs plan contract (lines 135–153)

The spec includes `onTabChange?: (tab: string) => void` on the shared `ChatWithHistoryProps` interface. The plan removes it from the shell entirely — it stays as a wrapper-only prop on `ScoutChatWithHistory`. This is correct (the shell doesn't use `onTabChange`; only Scout's `renderChat` closure references it), but it's another uncalled-out spec divergence.

### [Nit] Task 1 Step 5 warns about "Silent-failure point" for mock key rename but doesn't provide a verification step

**Location:** Task 1 Step 5 (lines 210–213): bold warning about mock key mismatch

The plan correctly flags that if the mock key isn't renamed from `SignalsContextChat` to `ContextChat`, the test will silently mount the real substrate. But the only verification is `npm run verify` (Step 8), which will pass either way (the test renders something, the assertion checks for "New chat" text which the real substrate also renders). A more targeted verification — e.g. asserting the mock's `data-testid` is present — would actually catch this. The bold warning is good awareness-raising but the verification doesn't match the risk.

### [Nit] Inconsistent use of `$WT` variable vs inline worktree path

**Location:** Throughout — e.g. Step 1 (line 183) defines `WT=/projects/Brewra/…`, Step 10 (line 244) uses `git -C "$WT"`, but Task 10 Step 1 (line 877) uses `git -C "$WT"` while Task 14 Step 4 (line 1094) uses `git -C "$WT" checkout master` — which would check out master in the worktree, not the main checkout.

The `$WT` variable is defined per-task (e.g. Task 1 Step 1, line 183) but isn't guaranteed to persist across task boundaries if the executor runs tasks independently. Task 14 Step 4's `git -C "$WT" checkout master && git -C "$WT" merge` is correct for a worktree (you can check out master in a worktree), but it's an unusual git pattern that could confuse. Not a defect, but worth noting.

### [Nit] README for `features/scout/` is written in the plan as a template to copy verbatim

**Location:** Task 10 Step 5 (lines 920–938)

The README content is provided as a complete markdown block. This is fine for execution but means any typo or inaccuracy in the plan text propagates directly. A lighter instruction ("create a README per the established feature-README convention covering X, Y, Z") would be more resilient to plan-external changes.
