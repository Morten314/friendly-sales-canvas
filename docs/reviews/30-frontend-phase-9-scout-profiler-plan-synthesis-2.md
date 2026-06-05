---
synthesizes_review: docs/reviews/30-frontend-phase-9-scout-profiler-plan-review-2.md
artifact: plans/30-frontend-phase-9-scout-profiler.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 2
---

## Round Recommendation

no

Reason: The four round-1 "Highs" are carried forward as "addressed but stronger-fix-wanted" — each is Low/Medium substance and is now concretely closed (split made default, code-comment enforcement, `createdAt` + "spec §4 superseded" line, catch-all kill clause). Two carried findings rest on misreads I verified against the file (the renames ARE documented at line 93; Approach-2 IS inlined at line 32). The new Mediums are cheap additions (parallelism op-note, pre-merge concurrent-merge check, INGEST unit test) or a reasoned defer (FeatureErrorBoundary). One Low surfaced a real handler-memoization fix. Nothing Critical/High remains and no new design surface opened; the loop converges.

## Agreed Findings

- **[carried "High"→Low, finding 1] Kill criteria don't cover non-parity failure modes.** Agree a catch-all helps. Added one sentence to the Global-abort paragraph: any failure mode (typecheck break from a merge resolution, a flake that won't green after `--no-file-parallelism`, etc.) unresolved within ~3 attempts on the branch escalates to the controller, who decides suspend vs. continue.
- **[carried "High"→Low, finding 2] Make the Task 2 two-commit split the default.** Agree it's free and matches the repo's "bias toward more, smaller commits." Flipped the optional note to the **default/recommended** path (structural shell gated on `typecheck`, then effects gated on `verify`); single-commit is retained as an explicit acceptable alternative. (Severity disagreement below — the shell is unused until S2, so there is no parity exposure at T2 regardless.)
- **[carried "High"→Medium, finding 3] `createdAt` undocumented + state the supersession.** Agree on `createdAt` (it's in the plan's `ChatSession` at line 106, absent from spec §4) — added it to contract-block deviation item 4. Added a line: "the spec §4 contract is fully superseded by this block; do not diff the two." Disagree that the two renames are undocumented (see Disagreed — they're at line 93).
- **[carried "High"→Low, finding 4] Render-prop no-memo convention not enforced in code.** Agree a durable marker beats plan prose. Added an instruction to Task 2 Step 6 to place a code comment at the `renderChat`/`renderExtras` invocation site (`// Deliberately inline + not memoized — stale-closure guard`).
- **[Medium, finding 5] Operationalize S3/S4 parallelism.** Agree. Added: S3 and S4 may run concurrently up to their stage gates, but the gates **serialize on the shared `:5173`** preview port (only one e2e run at a time) — ties into the existing "preflight is a serialized resource" convention.
- **[Medium, finding 7] Task 6 staging command contradicts the re-derive convention.** Agree the 11 hardcoded paths invite verbatim copying. Added a note at Task 6 Step 8: adjust the `git add` paths per the Step-6 grep results if a new importer appeared since authoring.
- **[Medium, finding 8] Distinguish environmental smoke failure from parity break.** Agree. Added a clause to Task 14 Step 2 / Global-abort: environmental failures (dev server won't start, network) are **not** abort triggers — fix the environment and re-run.
- **[Medium, finding 9] Add a pre-merge concurrent-merge check.** Agree — genuinely useful for the parallel-worktree reality. Added a Task 14 step: `git -C "$MAIN" fetch origin && git -C "$MAIN" log --oneline master..origin/master` before merging; if Phase 10/12 merged the S4-touched files (`App.tsx`/`routes.tsx`/`TECH_DEBT.md`), resolve and **re-run the S4 stage gate** (not just typecheck) before the final preflight.
- **[Medium→Low, finding 10] INGEST agent-gate untested at unit level.** Agree it's cheap and precise. Added a Task 3 case: `config.agent: "profiler"` + `initialContext: { agent: "scout", prompt: "" }` asserts no new session is created (and the converse for an un-gated scout config).
- **[Low, finding 12] `handleClearActiveContext` memoization / circular-dep risk.** Agree — and it's a real divergence from the live code, which uses an **inline arrow** (not a `useCallback`). Changed Task 2 Step 5 to define `handleClearActiveContext` as a plain inline arrow recreated each render (matching live semantics + the render-prop no-memo rule), eliminating the dependency-array concern.
- **[Nit, finding 19] README's `TD-FE-57` may renumber (written in S4, before Task 13 reconciles).** Agree. Added a note to Task 10 Step 5 (the number is provisional) and a reconciliation sweep in Task 13: fix the `TD-FE-57` reference in `features/scout/README.md` if the ceiling advanced.

## Disagreed Findings

- **[finding 3, sub-point] "The two field renames remain unmentioned."** Disagree — verified false. Contract-block item 4 (line 93) explicitly documents `config.storageKey` → `config.storageKeyPrefix` and `config.sidebarClassName` → `config.sidebarOpenClassName`. The reviewer appears to have checked the bottom self-review note (lines ~1113) rather than the top contract-block deviation list. (The `createdAt` sub-point is agreed and applied.)
- **[finding 13] "Approach-2 fallback references §17 without inlining."** Disagree — verified false. The abort bullet (line 32) inlines Approach-2: "keep the shared file as a `ChatWithHistoryBase` but give each persona its own named wrapper that owns the divergent render/effects directly (no render-prop boundary), accepting the duplication…". This was the round-1 fix; it stands. The remaining "Spec 30 §X" references are contextual anchors, not load-bearing content.
- **[finding 11] "Run all three journeys after each S2 task."** Disagree. The profiler collapse (T4) modifies only `ProfilerChatWithHistory`; journeys `04` (market-research) and `03` (signals) render neither that wrapper nor — after T2/T3 freeze it — the shell, so they cannot regress from T4. The shell is exercised across S2 by the scout gate (`04`+`03`) and the profiler gate (`06`); the finalize runs the full suite. Running all three per task is over-testing with no shared surface to catch.
- **[finding 15] "Rename `types.ts` to `market-research-types.ts`."** Disagree. Spec §9 explicitly directs `features/market-research/components/types.ts`; a feature-component-level `types.ts` matches the existing convention in this very tree (`intelligence/*/types.ts`). Renaming deviates from a deliberate frozen-spec decision for a style preference. Keep as specified.

## Deferred Findings

- **[Medium, finding 6] No automated regression test for the `FeatureErrorBoundary` addition.** Defer. The wrapper added to the scout route is the **identical component** already wrapping the customers route, which journey `06` renders in a real browser at S1, S2, and finalize — so its happy-path transparency is already covered by an existing automated journey. A scout-specific route test would have to mock `Auth`/`Tenant` to pass `ProtectedRoute requireTenant`, adding setup cost for no new signal; the Task 11 page test deliberately tests the page in isolation. Trigger: any change to `FeatureErrorBoundary`'s implementation.
- **[Low, finding 14] `storageKey = null` (unauthenticated) path untested in Task 3.** Defer. The shell only mounts behind `ProtectedRoute requireTenant`, so `currentUser` is always present; the null branch is defensive and unreachable in practice. Acknowledged in Task 3's "focused smoke, not exhaustive" note. Trigger: the shell is ever rendered outside an auth guard.
- **[Nit, finding 17] Inconsistent comment style (`//` vs `/** */`) in plan code blocks.** Defer. The plan is a specification; each block mirrors the comment style of its target file. Cosmetic, no action.
- **[Nit, finding 18] Mock-key check could assert `data-testid` instead of grep.** Defer. The round-1 grep (Task 1 Step 8) is sufficient awareness per the reviewer's own assessment ("marginal improvement"); the assertion-based alternative tests an empty-state render where no substrate mounts. No change.

## Severity Disagreements

- **Finding 1: High → Low.** The plan already escalates for the primary mode (parity break) and has per-seam 3-strikes + per-stage reset; the gap was a one-sentence catch-all backstop, now added. Not High.
- **Finding 2: High → Low.** The shell is an unused export until S2 — there is **no live surface and thus no parity to break at Task 2**. The "parity-critical seam" is at T5 (when wrappers render through the shell), not T2. The split is a commit-granularity/bisectability improvement (now defaulted), not a parity safeguard.
- **Finding 3: High → Medium.** Documentation completeness on an already-documented, code-faithful deviation set; the fix is adding `createdAt` + one supersession line.
- **Finding 4: High → Low.** The prose convention is the real safeguard; a code comment is a durability nice-to-have, not a correctness gap.
- **Finding 10: Medium → Low.** The gate is covered end-to-end by the wrapper tests + e2e; a direct unit case is cheap precision, not a coverage hole.

## Open Questions

None. Every round-2 finding is resolved by a cheap inline edit, a reasoned defer, or a verified-false disagreement. No Critical/High remains open and no edit opens new design surface — the plan does not need another review round.
