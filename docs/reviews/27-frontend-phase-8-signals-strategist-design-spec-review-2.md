---
artifact: specs/27-frontend-phase-8-signals-strategist-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-04
round: 2
---

## Context

Round-2 review of the converged spec (post-synthesis of round-1 findings). Review performed from the spec text alone plus AGENTS.md project context. No live codebase walk was performed to independently verify LOC counts, import graphs, or runtime-reachability claims.

The spec has been substantially revised since round 1 — all four High/Medium findings from round 1 are addressed. This review focuses on residual issues and new concerns introduced or revealed by the convergence edits.

## Findings

### Medium

#### 8a substrate test must be revisited in 8c but this is not stated

**Location:** §7 stage 8a — "Add a substrate unit test (`shared/chat/__tests__`) covering render + the MSW-mocked `signal_Ask`/`signal_action` paths"; §7 stage 8c — "migrate **both** the page and the relocated substrate to the shared signal_* hooks"

In 8a, the substrate test exercises the raw-fetch-based `SignalsContextChat`. In 8c, the substrate is migrated from raw fetch to the new shared TanStack hooks (`useSignalAsk`/`useSignalAction`), which fundamentally changes the substrate's internal call pattern. The 8a test will no longer be testing the same code path — MSW mocking raw `fetch` calls and MSW mocking TanStack hook network calls are different setups. The spec does not mention updating or rewriting the substrate test in 8c. The plan needs to explicitly account for this: either (a) the 8a test is written against the substrate's public surface (rendered output, props) so it survives the internal migration unchanged, or (b) 8c includes a test update step. The current silence means the plan writer will discover this ambiguity mid-execution.

#### signal_Ask/signal_action divergence fallback criterion is underspecified

**Location:** §4, "Caveat: the plan first confirms the page's and the substrate's `signal_Ask`/`signal_action` call shapes actually match before committing to one hook per endpoint; if they diverge … the shared hook is parameterized or split into specialized variants."

The fallback is "parameterized or split" but no criterion is given for which path to take. Parameterization adds conditional branches to the shared hook (more complex, single API surface); splitting doubles the hook count (simpler per-hook, more files in `shared/chat/`). Given the spec's parity-first posture, a concrete tiebreaker would help the plan writer — e.g., "prefer split if the call shapes differ in request body structure; prefer parameterization if they differ only in flags/opts." Without this, the plan writer must make an architectural decision that this spec should own.

#### Smoke sign-off and preflight are dual gates with undefined partial-pass semantics

**Location:** §7 Finalize — "perform the controller's manual smoke sign-off … and — as the strictly-final action — run the full serial `npm run preflight`"; §8 — "fail = no merge, no fix-forward (Spec 14 §5.3)."

The finalize stage sequences two independent gates: (1) manual smoke sign-off, then (2) `npm run preflight`. The "no fix-forward" rule applies to the merge gate as a whole, but what happens when smoke passes and preflight fails? Or smoke fails but preflight would have passed? The spec implies both must pass before merge (the conjunction is clear), but the remediation path is undefined — does a failed preflight after a passed smoke mean `git reset --hard` to the last green checkpoint, losing the smoke result? Or does the developer fix the preflight issue and re-run both gates? Since the spec states "no fixing forward through the gate" (Spec 14 §5.3), a preflight failure after smoke pass would indeed require a reset, re-fix, and re-run of both gates. This should be stated explicitly so the plan writer doesn't treat the two gates as independently retryable.

### Low

#### `verify` checkpoint assumes external definition

**Location:** §7 — every checkpoint includes "verify" as a green criterion; §8 preflight section mentions "`npm run verify`" but does not define its contents.

The distinction between `verify` (inner-loop) and `preflight` (merge gate) is assumed from Spec 14. A reader working primarily from this spec would not know what `verify` includes (typecheck? lint? unit tests? format check?). The §8 note that "verify omits format:check" partially addresses this but inverts the dependency — the reader must already know what verify contains to understand what it omits. A one-line definition or a Spec 14 cross-reference would suffice.

#### Per-component Vitest vs shared `__tests__/` directory is ambiguous

**Location:** §2.1 — "Per-component Vitest"; §3 directory tree — strategist shows a single `components/__tests__/` dir.

"Per-component Vitest" reads as one test file per component, but the directory tree shows a single `__tests__/` under `components/`, not a `__tests__/` per component directory. This is a naming convention question, not a structural one — but it affects how the plan scaffolds test files. The established pattern from Phases 5–7 should be referenced explicitly (e.g., "following the Phase 7 co-located `__tests__/` convention").

#### Dedup handoff documentation is implicit in finalize

**Location:** §5 — "the substrate's public surface … is documented (in `shared/README` / a short `shared/chat` module note) well enough for Phase 9"; §7 Finalize — "finalize all README/index.ts."

The finalize stage says "finalize all README/index.ts" which would cover the `shared/README` or `shared/chat` module note, but the dedup-handoff documentation requirement from §5 is more specific than a generic README pass. It asks for enough documentation for Phase 9 to evaluate dedup without re-reading the implementation. The finalize stage should call this out explicitly (e.g., "including the §5 dedup-handoff substrate documentation") so it isn't lost in the generic README sweep.

#### `shared/chat` naming embeds "Signals" in a supposedly-generic substrate

**Location:** §3 — `src/shared/chat/SignalsContextChat.tsx`; §5 — "genuinely-shared scout/profiler chat plumbing."

The file `SignalsContextChat.tsx` is named after the Signals feature but lives in generic `shared/chat/` and is consumed by customers and market-research. After Phase 9's wrapper dedup, the shared substrate will serve all three chat surfaces — yet it will still carry the "Signals" name. This is a naming debt, not a functional issue, and renaming it (e.g., to `ChatSubstrate.tsx` or `ContextChat.tsx`) is trivially within scope of 8a since the file is being relocated and all importers repointed anyway. If the spec deliberately preserves the name for parity, that should be stated. If not, the plan should rename it during 8a.

#### §3.1 dependency table references §3.3 without disambiguation

**Location:** §3.1 — "(transitional, §3.3 Phases 4b–12)"; §3.1 — "(`shared ↛ features`, §3.3)."

These §3.3 references point to Spec 14's import hierarchy rules, not to any section within this spec (which has no §3.2 or §3.3). The cross-reference is unambiguous to a reader with Spec 14 context, which this spec assumes, but a parenthetical like "(Spec 14 §3.3)" would prevent a reader from searching within this document for a nonexistent section.

### Nit

#### StrategistWorkspace annotation removal is well-justified but touches dead code

**Location:** §6 — "Its now-obsolete `// HANDOFF → strategist` file-header annotation … is **removed**."

The rationale is sound (a stale annotation is actively misleading). This is an improvement over round 1's "update the annotation" which was correctly flagged as churn. Noting only that the spec's "relocate as-is" posture has a carve-out for this one comment removal, which is fine but worth the plan writer knowing.

#### Status header references a synthesis document not in scope for this review

**Location:** Line 3 — "spec-review-1 synthesized 2026-06-04 at `docs/reviews/27-frontend-phase-8-signals-strategist-design-spec-synthesis-1.md`."

This is a procedural note, not a spec defect. The synthesis document path is given for traceability. No issue.

#### "Exact subcomponent seams … finalized during plan-writing" is the right call

**Location:** §3 — "Exact subcomponent seams inside `features/signals/components/` are finalized during plan-writing (8c); the names above are expected seams, not a contract."

Calling this out because it's a good practice — the spec defines the target structure and boundary, the plan owns the internal decomposition. Not a finding, just a positive note.
