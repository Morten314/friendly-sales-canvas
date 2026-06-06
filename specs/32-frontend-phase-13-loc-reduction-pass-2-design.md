# Spec 32 — Frontend Phase 13: LOC reduction pass #2 (post-modularization audit)

**Status:** Design — round 1 (pre-review)
**Date:** 2026-06-06
**Type:** Phase spec (implements Spec 14 §4 Phase 13)
**Paired plan:** `plans/32-frontend-phase-13-loc-reduction-pass-2.md` (written after this spec converges)
**Branch:** `phase-13-loc-reduction-pass-2` (off `master` @ `d2017bc`)
**Predecessor:** Phase 11 (shared utility extraction, Spec/plan `31`) merged to `master` 2026-06-06 (`2e22bce` + follow-up `d2017bc`). Phases 0–12 are all on `master`.
**Concurrency:** **none (solo).** Phase 13 is a whole-tree audit with a hard barrier on all of Phases 5–12 (it audits the extracted feature code) and on Phase 11's legacy-dir drain (it relies on the target layout being realized). No sibling sandboxes in flight. NN `32` is the next free slot (Phase 11 took `31`).

---

## §1 Goal and context

### 1.1 Goal

The Phase-L-proper analog for the frontend. With strict TS, the test harness, and the per-feature structure all in place (Phases 0–12), do the systematic post-modularization LOC reduction that Phase 1 (pre-foundation) could only do coarsely. Two distinct workstreams:

1. **Tree-wide dedup + dead-code pass (13a)** — the "LOC reduction" proper: remove remaining dead code, re-evaluate Phase 1's conservative defers now that strict types + tests exist, prune unused shadcn primitives, dedup near-identical components/hooks, extract repeated UI patterns, and inline trivial wrappers.
2. **Monster-file decomposition (13b–13N)** — behavior-preserving structural splitting of the worst remaining files (the feature phases deferred these), advancing Spec 14 §6 DoD #2 ("every monster file is decomposed").

This is the last LOC pass. Phase 14 (agent affordances) follows and adds no feature-code reduction.

### 1.2 Resolved scope decisions (brainstorming, 2026-06-06)

This spec records five orchestrator decisions taken before drafting:

1. **Hybrid scope** (not dedup-only, not full decomposition). Phase 13 runs the dedup/dead-code audit across the whole tree **and** decomposes the worst monster files. The long tail of large-but-not-worst files stays as TD-FE for a future pass.
2. **Decomposition cut line is audit-driven, not fixed in this spec.** The spec defines the ranking methodology and selection signals (§5.1); the **plan author picks the actual file set during planning** against the 13a scorecard, mirroring Phase 2a's error-count-threshold pattern. This spec names candidate files only as illustration, never as a mandate.
3. **Codemods are lazy/conditional.** Default to manual fixes. Stand up `frontend/scripts/codemods/` + its test harness **only when a codemod is earned** (a pattern that is both likely-to-recur and mechanically-transformable). If none qualifies, Phase 13 ships zero codemods and Phase 14 establishes the framework (§6).
4. **Prune unused shadcn primitives** (TD-FE-7), after re-verifying each is genuinely unimported — a deliberate sweep because `knip` ignores `src/components/ui/**` (§4.3). The folder stays locked; pruning dead inventory is not "modifying" it, and primitives are trivially re-addable via `npx shadcn add <name>`.
5. **Orphan routes (TD-FE-1, TD-FE-2): investigate-and-confirm during 13a, default keep.** The spec does not pre-decide removal. 13a re-confirms reachability; a route is removed only if confirmed dead with the orchestrator, otherwise kept and the TD entry closed as "intentional" (§4.6).

### 1.3 Actual starting state (`master` @ `d2017bc`)

The structural refactor is complete: `src/pages/`, `src/hooks/`, `src/lib/`, `src/services/`, `src/utils/`, `src/contexts/` are gone; `src/components/` holds only `ui/` (locked shadcn). Code lives under `src/{features,shared,app,components/ui}/`. The largest survivors (audit anchors, **not** a decomposition mandate — §5.1):

| File | LOC | Note |
|---|---|---|
| `features/market-research/hooks/useMarketResearchData.ts` | ~6,040 | the deferred data layer (editable-state ↔ `useQuery` coupling, TD-FE-19/21/…) — most delicate decomposition target |
| `features/mission-control/components/data-sources/DataSourcesManager.tsx` | ~3,497 | |
| `features/mission-control/components/company-profile/ConnectorApprovals.tsx` | ~3,060 | |
| then a ~2,000-LOC gap to the next tier | | `SuggestedICPCards` (~1,078), `RegulatoryComplianceSection` (~1,000), `CompetitorLandscapeSection` (~981), `StrategistWorkspace` (~960), `IcpWizard` (~952) |

LOC figures are spec-write-time estimates; 13a re-measures and the scorecard is authoritative.

### 1.4 Inherited tooling (no setup work here)

- `frontend/knip.json` (`knip --strict --no-progress` in preflight). Ignores `src/components/ui/**` — relevant to §4.3.
- `frontend/scripts/scan-inline-blocks.ts` (Phase 1). Phase 1 noted it **filters** outer-scope-referencing near-identical blocks at the gate; enumerating those for dedup needs a **scan variant** (Phase 1 handoff, §3.1).
- `frontend/scripts/{build-audit-scorecard,check-bundle-budget,capture-bundle-baseline}.ts`, `preflight.mjs`/`.sh`, `with-slot.mjs` (cross-worktree semaphore).
- `npm run verify` (typecheck + lint + `vitest run --changed`) = inner loop; `npm run preflight` (full, serial, with e2e + visual regression) = merge gate.
- ESLint zone rules (`import-x/no-restricted-paths`, `no-cycle`, `no-internal-modules` `@/features/*/!(index)`), strict `tsconfig`, Vitest + RTL + MSW, Playwright + 2% visual-regression threshold.
- `frontend/scripts/codemods/` and `src/shared/ui-patterns/` do **not** exist yet (created conditionally — §6, §4.5).

---

## §2 Scope

### 2.1 In scope

- All code under `frontend/src/` — feature folders, `shared/`, and a deliberate one-off sweep of `components/ui/` (§4.3).
- Dead imports / exports / files / deps / routes anywhere they remain.
- Re-evaluation of Phase 1's conservative defers **TD-FE-3, 4, 5, 6** at their **current (post-Phase-11) locations** (§4.2).
- Unused shadcn-primitive removal **TD-FE-7** (§4.3).
- Near-identical components and near-duplicate hooks (§4.4).
- Repeated UI patterns → `src/shared/ui-patterns/` **if surfaced** (§4.5).
- Inline `useState`+`useEffect` triplets (≥3×) → hooks; single-use trivial wrapper components → inlined (§4.4).
- Behavior-preserving decomposition of audit-selected monster files (§5).
- Codemods in `frontend/scripts/codemods/` **only where earned** (§6).
- The audit scorecard at `docs/audits/<run-date>-frontend-loc-pass-2.md`.

### 2.2 Out of scope (→ logged `TD-FE-<n>`, §9)

- **Behavior changes.** Every reduction and every split must be behaviorally and pixel-identical (Spec 14 §2.2). No "improvements."
- **Type-signature redesign** beyond removing now-unneeded `any` / escape-hatches the audit confirms dead.
- **The long tail of large files** not selected by the audit (§5.1) — explicitly deferred.
- **New cross-feature shared abstractions** beyond `ui-patterns/` and a genuinely-demonstrated ≥2-feature dedup target. Phase 11 already did the shared-utility drain; Phase 13 does not re-litigate placement.
- **Data-layer / TanStack migration** of the deferred feature slices (carried as TD across Phases 5–12). Decomposing `useMarketResearchData.ts` is a **structural split, not a fetch-logic rewrite** (§5.3).
- **Security/auth hardening** (pre-launch posture, unchanged).

### 2.3 Frozen interfaces

Inherits Spec 14 §2.3 verbatim: HTTP API contract, route URLs, auth flow, the 30 req/min rate-limit value, existing E2E behavior, bundle output format. Decomposition moves modules **behind** frozen route URLs; the URLs do not change.

---

## §3 Methodology — audit → investigate → execute

Mirrors Phase 1 (and backend Phase L). The tooling produces the candidate list; the agent reads in full **only** the `investigate` items.

### 3.1 Stage 1 — Audit (tooling-driven candidate list)

Run against the full post-Phase-11 `src/` tree and combine outputs:

- `knip --strict --no-progress` — dead files / exports / deps. Plus a **one-off variant with the `components/ui/**` ignore removed** to surface unused shadcn primitives (§4.3).
- A **dead-export re-scan** at the current locations of the TD-FE-3..6 symbols (Phase 11 relocated several — e.g. `lib/api` → `shared/api/transport`, `lib/jwt` → `shared/auth`, `apiUtils` → `features/market-research`) so the re-eval traces real paths (§4.2).
- A **near-identical-block scan variant** of `scan-inline-blocks.ts` that *enumerates* (rather than filters) the outer-scope-referencing near-duplicate blocks Phase 1 left un-enumerated (Phase 1 handoff).
- A **component/hook similarity scan** (`ts-morph` AST walk or `ast-grep`) for near-identical components (differ by props / one literal) and near-duplicate hooks (same TanStack pattern, one parameter differs).
- Targeted `rg`/`ast-grep` queries for trivial single-use wrapper components and the inline-triplet pattern.

Each candidate is tagged `execute` (mechanical, high tool confidence) / `investigate` (needs per-site analysis) / `defer` (→ `TD-FE-<n>`).

### 3.2 Stage 2 — Investigation

For each `investigate` finding, enumerate call sites and read each in full before deciding. Conservative defers from Phase 1 are upgraded to `execute` only when strict TS + the test suite confirm safety.

### 3.3 Stage 3 — Execute & scorecard

Apply `execute` + confirmed-safe `investigate` reductions. The scorecard (`docs/audits/<run-date>-frontend-loc-pass-2.md`) follows the Phase 1 format: §LOC delta (overall + per-area), §per-category execution log, §per-file verdict (`remove <SHA>` | `keep — <reason>` | `defer-TD-FE-<n>`), §handoff list, §supplementary (preflight result, codemod inventory). **The scorecard's monster-file ranking is the input to the §5 decomposition selection** — so the dedup pass lands first and the file set is chosen against post-dedup sizes (§7).

---

## §4 Reduction categories (13a)

### 4.1 Residual dead code
Dead imports, dead exports, dead files, dead deps — wherever `knip`/the scans surface them in feature and shared code.

### 4.2 Re-evaluate Phase 1's conservative defers (TD-FE-3, 4, 5, 6)
Phase 1 kept ~22 symbols on a conservative posture (no strict types/tests then to prove safety). 13a re-traces each at its **current** location; symbols confirmed unreferenced under strict TS + green tests are removed, the rest kept with a recorded reason. Each TD entry is closed (resolved or re-deferred with rationale).

### 4.3 Prune unused shadcn primitives (TD-FE-7)
`knip` ignores `components/ui/**`, so this is a **deliberate one-off sweep**: run the no-ignore knip variant, then re-verify each flagged primitive has zero imports (the gate won't catch a mistake here). Remove confirmed-unused primitives. The folder stays locked; this prunes dead inventory only. Record removed files in the scorecard (re-addable via `npx shadcn add`).

### 4.4 Dedup & inline
- **Near-identical components** → base + overlay (props/variant), where behavior is provably identical.
- **Near-duplicate hooks** → extract the shared core, parameterize the difference.
- **Inline state triplets** (same `useState`+`useEffect` ≥3×) → a shared hook.
- **Single-use trivial wrapper components** (one-line return) → inlined, unless the wrapper adds genuine semantic clarity (kept, with a note).

### 4.5 Repeated UI patterns → `src/shared/ui-patterns/` (conditional)
Created **only if** the audit surfaces UI patterns (form-row, dialog-shell, table-wrapper) that are (a) not shadcn primitives and (b) demonstrably used by ≥2 features (the established `shared/` promotion rule). If nothing qualifies, the folder is **not** created (Spec 14 §3.1's explicit "omitted otherwise"). Any extraction here is behavior-/pixel-neutral and gets an ADR if non-trivial (next ADR is `0006`).

### 4.6 Orphan routes (TD-FE-1, TD-FE-2) — investigate-and-confirm, default keep
13a re-checks `/tenant-selection` (TD-FE-1) and `/scout-deployment` (TD-FE-2) against the router + nav. **Default disposition: keep.** A route is removed only if confirmed dead with the orchestrator (direct-URL-only reachability is a valid reason to keep). Either way the TD entry is closed with the recorded decision.

---

## §5 Monster-file decomposition (13b–13N)

### 5.1 Selection (audit-driven, decided at plan stage)
This spec fixes **no file list**. The 13a scorecard ranks every file by a composite signal — **LOC + measured redundancy (similarity-scan hits) + complexity** — and the **plan author selects the decomposition set during planning**, justifying the cut against the natural LOC cliff (the ~2,000-LOC gap below the top three at spec-write time) and the post-dedup sizes. The threshold and the resulting sub-phase count are a **plan decision**, recorded in the plan with its rationale (Phase 2a precedent). Files above the cliff are the expected core; the plan may extend or contract the set based on what the audit measures.

### 5.2 Decomposition discipline (behavior-preserving)
- **Structural splitting only:** move cohesive chunks into sibling sub-modules / sub-components / sub-hooks; **no logic changes, no fetch rewrites.** Public surface (`index.ts`, route entry) is unchanged.
- One file per sub-phase; each sub-phase is a discrete commit series leaving the tree green (Spec 14 §5.7 sub-phase granularity — a failed sub-phase reverts to the last green sub-phase, not the whole phase).
- Behavioral E2E + visual regression + the feature's unit tests are the safety net (Spec 14 §R6: the structural decomposition is the agent's path through the file, not a single-shot read). Where a split would otherwise be untested at the seams, add focused unit tests for the extracted unit before finalizing the sub-phase.

### 5.3 The 6,040-LOC hook (`useMarketResearchData.ts`)
Flagged as the most delicate target: its size is entangled with the deferred editable-state ↔ `useQuery` coupling (TD-FE-19/21/…). Phase 13 may split it into cohesive sub-hooks/modules **without** resolving that coupling — the data-layer semantics stay as-is (out of scope, §2.2). If the audit judges a safe structural split impossible without touching behavior, it is **deferred** (logged TD-FE) rather than forced. Sequenced **last** among the decomposition sub-phases so the lower-risk splits validate the discipline first.

---

## §6 Codemods (lazy / conditional)

Default: **manual fixes.** A pattern earns a codemod only when it is both (a) likely to recur in future work and (b) mechanically transformable. On the first earned codemod, stand up `frontend/scripts/codemods/` with `ts-morph` + a filesystem-fixture test harness (`__tests__/<name>/{input,expected}.ts`, read-apply-compare in Vitest), one codemod per file, one codemod per commit (Spec 14 §R8). If no pattern qualifies, Phase 13 ships **zero** codemods and the framework defers to Phase 14 (whose `codemod-runner.sh` then establishes it). The scorecard records the codemod inventory (including "none — manual" with reasoning).

---

## §7 Sub-phase structure & sequencing

- **13a — tree-wide dedup + dead-code audit & execute.** All of §4. Produces the scorecard, which ranks decomposition candidates. **Runs first** so monster-file selection (§5.1) is made against post-dedup sizes (dedup may shrink or eliminate a candidate).
- **13b … 13N — monster-file decomposition.** One audit-selected file per sub-phase; count and set decided at plan stage (§5.1); the `useMarketResearchData.ts` split (if taken) is last (§5.3).

Each sub-phase merges to `master` independently behind the §8 gate. The full phase is "done" when 13a + all selected decomposition sub-phases are merged.

## §8 Safety net & preflight cadence

Resolves the Phase 1 handoff note (per-commit preflight was not enforced then) by documenting the cadence explicitly rather than mandating per-commit full preflight:

- **Inner loop (every commit):** `npm run verify`.
- **Behavior-touching sub-phases (decomposition, dedup):** run broader `vitest run` + Playwright visual regression locally before the sub-phase's **final** commit.
- **Merge gate (per sub-phase):** full serial `npm run preflight` (with e2e + visual regression), controller-run, immediately before the user-approved merge. Red blocks the merge; no fix-forward (Spec 14 §5.3).
- Manifest changes (if a scan tool needs a dep restored) land in their **own** commit, separate from script additions (Phase 1 handoff note).

## §9 TD-FE disposition

- **Resolved or closed this phase:** TD-FE-1, TD-FE-2 (orphan routes — §4.6), TD-FE-3, TD-FE-4, TD-FE-5, TD-FE-6 (conservative-defer re-eval — §4.2), TD-FE-7 (shadcn prune — §4.3). Each is closed in `docs/TECH_DEBT.md` with the recorded decision (removed / kept-intentional / re-deferred).
- **New deferrals** (long-tail large files not selected, any monster file judged unsafe to split, any near-identical dedup needing behavior change) are logged from **TD-FE-64** onward (current ceiling is 63).

## §10 Definition of done

1. 13a scorecard at `docs/audits/<run-date>-frontend-loc-pass-2.md` covers **every** file (per-file verdict), with overall + per-area LOC delta.
2. All `execute` + confirmed-safe `investigate` findings applied; LOC delta documented.
3. Unused shadcn primitives pruned (or each retained one justified); TD-FE-7 closed.
4. Conservative defers TD-FE-3..6 re-evaluated and closed; orphan-route TD-FE-1/2 resolved (default keep) and closed.
5. Audit-selected monster files decomposed (behavior-preserving) **or** explicitly deferred with rationale; DoD §6.2 advanced as far as the selected set.
6. `src/shared/ui-patterns/` created **iff** a ≥2-feature pattern was surfaced; otherwise confirmed absent.
7. Codemods (if any) committed with input/expected tests; inventory in the scorecard.
8. `npm run preflight` green at each sub-phase merge; visual regression + behavioral E2E green throughout.
9. New deferrals logged TD-FE-64+.

## §11 Risks

- **R-13.1 — Decomposition introduces behavior drift.** Mitigation: structural-only discipline (§5.2), behavioral E2E + visual regression + per-unit tests at the seams; one file per green sub-phase with §5.7 revert granularity.
- **R-13.2 — The 6,040-LOC hook resists a safe split.** Mitigation: explicit "defer rather than force" escape hatch (§5.3); sequenced last.
- **R-13.3 — shadcn prune removes a primitive used via dynamic/indirect import the gate misses.** Mitigation: manual per-file re-verification (§4.3); knip ignores the folder so the gate is not a backstop here — re-add is one CLI command.
- **R-13.4 — Over-aggressive dedup creates a wrong abstraction.** Mitigation: only provably-identical near-duplicates are merged; ≥2-feature rule for any shared extraction; ambiguous cases deferred to TD, not forced.
- **R-13.5 — Scope creep into data-layer rewrites.** Mitigation: §2.2 hard out-of-scope; decomposition is structural movement only.

## §12 Open questions deferred to the plan

1. The decomposition file set, threshold, and sub-phase count (§5.1) — plan decision from the 13a scorecard.
2. Whether `useMarketResearchData.ts` is split or deferred (§5.3) — plan decision after the 13a audit reads it.
3. Exact similarity-scan tooling (`ts-morph` similarity walk vs `ast-grep`) — plan picks based on the 13a candidate quality.
4. Whether any `ui-patterns/` extraction or hook-dedup warrants an ADR (`0006+`) — decided as the decision arises.

---

## §13 Companion documents

- Spec 14 (`14-frontend-refactoring-master-plan-design.md`) — master plan; §4 Phase 13 block + §6 DoD #2/#8 are the authority this implements.
- `docs/audits/2026-05-27-frontend-loc-pass-1.md` — Phase 1 scorecard; the format and handoff list this phase inherits.
- `docs/TECH_DEBT.md` — TD-FE register (TD-FE-1..7 resolved here; new entries 64+).
- `docs/adr/` — ADR set (next number `0006` if a non-trivial decision is surfaced).
