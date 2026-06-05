---
synthesizes_review: docs/reviews/30-frontend-phase-9-scout-profiler-plan-review-1.md
artifact: plans/30-frontend-phase-9-scout-profiler.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 1
---

## Round Recommendation

no

Reason: The three High findings are all real but reduce to cheap inline clarifications/structure on a contract that is faithful to the verified code (the reviewer concedes this); none open new design surface or leave a Critical/High open after revision. One Nit (finding 15) surfaced a genuine correctness bug — the worktree merge command — which I verified and fixed. All agreed items are applied inline below; the loop converges.

## Agreed Findings

- **[High→Medium, finding 1] No plan-level abort criterion.** Agree the per-seam three-strikes + per-stage reset don't state when the *whole plan* is abandoned. Added a "Global abort" line to the conventions: if any stage gate or the finalize preflight fails on a genuine parity break (not a mechanical cross-worktree conflict) that can't be fixed without changing behavior, suspend the phase and escalate — the branch is local/unshared so suspension is free. Folded finding 8 (smoke-fail fallback) into the same line.
- **[High→Medium, finding 2] Task 2 is one ~300-LOC commit.** Agree it violates the plan's own one-step-one-commit bias. Split Task 2's commit into two: (9a) shell skeleton + state + handlers + JSX + empty-state (compiles, renders empty), (9b) the LOAD/PERSIST/INGEST effects. Kept the Step-8 `verify` (typecheck) as the gate before each commit. Note: the shell is unused until S2, so neither commit carries parity exposure — the split is for bisectability, which is why I downgrade the severity (see below).
- **[High→Medium, finding 3] Spec §4 field renames uncalled-out.** Agree two renames weren't enumerated. Expanded the contract block's deviation list to name them explicitly: `storageKey` → `storageKeyPrefix` (runtime key `${prefix}_${uid}`), `sidebarClassName` → `sidebarOpenClassName`, `buildInitialSession` → replaced by `hydrateExtraSessions` + `serializeSession` + `onNewChat`, and `onTabChange` dropped from the shared props (stays a Scout-only wrapper prop — also finding 13). Added a one-line tradeoff note that `renderExtras` taking no args narrows the extension point (finding 3.3): a future session-aware overlay is a one-line signature change at that time (YAGNI; no current need). Disagreed on the spec re-review (see Disagreed).
- **[Medium, finding 4] S3/S4 parallelism not stated.** Agree. Added a conventions line: S1→S2 is the only hard ordering; S3 and S4 are independent of S1–S2 and of each other and may be dispatched to parallel subagents, each committing only its own named paths (the surgical-commit rule already isolates them; S3 touches market-research components, S4 touches `features/scout` + `App.tsx`/`routes.tsx`).
- **[Medium→Low, finding 5] FeatureErrorBoundary addition unanalyzed.** Agree the only behavioral addition lacked justification. Rather than drop it (it's the converged feature-route shape every migrated feature uses), added an analysis note to Task 10: `FeatureErrorBoundary` is a transparent happy-path passthrough — it renders `children` unchanged and only swaps to a fallback when a descendant throws — identical to the signals/customers route usage, so happy-path output is unchanged by construction; the finalize manual smoke confirms the integrated render. Severity drops to Low post-justification (it's a documentation gap, not a missing safety net).
- **[Medium, finding 6] ChatWithScout 1-vs-2 consumer — destination justification.** Agree the spec's "2 consumers → recommend `components/` root" premise is corrected to 1 (TrendsTab). Added a Task 7 note justifying `components/` root anyway: `ChatWithScout` is a general scout-chat entry surface (not trends-specific), and the spec (§17) granted the plan destination authority. Disagreed on issuing a spec erratum (see Disagreed).
- **[Medium, finding 7] Importer enumeration doubles as staging list, may go stale.** Agree. Strengthened the grep-driven-repoints convention: the enumerated lists are the authoring-time known set; if the grep-backstop finds an importer not enumerated, edit AND stage it — re-derive the final staging list from `git status`/the grep results, do not copy the plan's list verbatim.
- **[Medium, finding 9] renderChat stale-closure risk.** Agree this is worth stating. Added a note to the contract block + Task 5: `renderChat` must be an **inline arrow** recreated each wrapper render (never `useCallback`-memoized), and the `ChatWithHistory` shell is not `React.memo`-wrapped — so a wrapper-state change re-renders the shell and re-invokes `renderChat` with a fresh closure. Memoizing it would reintroduce the stale-closure bug.
- **[Low, finding 10] Re-run `03` at S2.** Agree as cheap insurance, though the expected signal is ~nil: the signals page renders `ContextChat` directly (not through either wrapper), so the S2 wrapper collapse cannot regress journey `03`. Added `03` to the S2 scout gate as belt-and-suspenders (the finalize suite runs it regardless).
- **[Low, finding 11] Inline the Approach-2 fallback.** Agree. Added a two-sentence inline summary of Approach-2 in the abort section so the abort path is self-contained.
- **[Low, finding 13] `onTabChange` off-shell uncalled-out.** Agree — covered by the expanded deviation list (finding 3).
- **[Nit, finding 14] Mock-key warning lacks matching verification.** Agree `npm run verify` passes either way (both real and mocked substrate render "New chat"). Added a targeted grep verification to Task 1: after renaming, grep the `vi.mock("@/shared/chat", …)` blocks and confirm the object key is `ContextChat` (matches the renamed barrel export) — a stale key silently disables the mock.
- **[Nit→correctness, finding 15] Worktree merge command is wrong.** Verified: the main checkout is on `master`, so `git -C "$WT" checkout master` in the linked worktree fails (`'master' is already checked out`). Fixed Task 14 Step 4: the merge runs in the **main checkout** (`/projects/Brewra/brewra-gtm-intelligence`, already on master), not via `git -C "$WT"`. Also added a conventions note that `WT` must be (re)defined in each task's first git step (subagents start fresh; the variable doesn't persist across tasks).
- **[Low, finding 12] Task 3 is a skeleton.** Agree to acknowledge (not expand). Added a sentence to Task 3 that it is a focused smoke of the shell core (3 scenarios) and the existing wrapper tests + finalize e2e are the real behavior guards — consistent with the behavior-preserving-refactor posture.

## Disagreed Findings

- **[finding 3, sub-point 4] "A re-review of the spec against the plan contract would be warranted."** Disagree. Spec §4 explicitly states "Exact generic signatures are finalized in the plan," and §16 names `writing-plans` → plan review (not a spec re-review) as the next pipeline step. Specs are a frozen record of intent (CLAUDE.md); the plan is current truth. Every divergence is behavior-preserving and faithful to the code — the reviewer concedes this. The deviation list + self-review note document the delta. No spec re-review.
- **[finding 6, sub-point] "Should have triggered a spec erratum, not a plan footnote."** Disagree. Specs are frozen intent; incidental fact-corrections belong in the current-truth artifact (the plan), which is exactly where Task 7 records it. The destination choice is unaffected by 1-vs-2 consumers. No spec edit.
- **[finding 16] README should be a lighter "covering X, Y, Z" instruction.** Disagree. The `writing-plans` skill forbids exactly that form ("create X covering Y" is the placeholder anti-pattern); complete, copy-ready content is mandated. The verbatim README is correct. Typo-propagation risk is negligible for a README the executor reads.
- **[finding 12, sub-point] Expand the shell test to ~15 behaviors.** Disagree on expansion (agree on acknowledgment above). Over-testing a behavior-preserving extraction whose real guards are the two existing wrapper tests + the finalize e2e is disproportionate; the shell test's job is to smoke the persona-agnostic core.

## Severity Disagreements

- **Finding 1: High → Medium.** The recovery primitives (per-step parity, per-stage `git reset`, per-seam three-strikes, Task 14's abort reference) already exist; the gap is a single *consolidated* plan-level threshold, now added. A documented-but-uncentralized abort path is Medium, not High.
- **Finding 2: High → Medium.** The shell is an unused export until S2, so neither half of Task 2 carries parity exposure — the worst case is discarding a new-file commit and redoing it, which is bounded. The split improves bisectability (Medium-value), not safety against a parity break (which would be High).
- **Finding 3: High → Medium.** Documentation-completeness on an already-documented, code-faithful deviation set, for a spec that explicitly deferred signatures to the plan. The fix is enumerating two renames — Medium, not High.
- **Finding 5: Medium → Low** (post-justification — `FeatureErrorBoundary` is transparent by construction; the gap was analysis, now provided).

## Open Questions

None. Finding 15's correctness fix (merge in the main checkout) is localized and verified; no item is blocked. All agreed revisions are mechanical/clarifying and applied inline — the plan does not need another review round.
