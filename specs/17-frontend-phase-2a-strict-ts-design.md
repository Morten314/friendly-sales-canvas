# Spec 17 — Frontend Phase 2a: Strict TS Turn-On

**Status:** Design — round 1
**Date:** 2026-05-27
**Type:** Phase spec (descendant of `specs/14-frontend-refactoring-master-plan-design.md` §4 Phase 2a)
**Paired plan:** `plans/17-frontend-phase-2a-strict-ts.md` (written next)

---

## §1 Goal and context

### 1.1 Goal

Turn strict TypeScript on across the frontend in one short-lived branch. By end of phase:

- `frontend/tsconfig.app.json` has all five linting flags it explicitly carries set to `true`: `strict`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. (`strict: true` implies `strictNullChecks: true` — see §3 Step 1b for the textual change.)
- `frontend/tsconfig.json` (composite root) has its four relaxing overrides removed (`noImplicitAny`, `noUnusedParameters`, `noUnusedLocals`, `strictNullChecks` — each currently set to `false`). The composite root no longer relaxes what the app config tightens.
- `tsc --noEmit` (via `npm run typecheck`) returns zero errors against the full `src/` tree.
- The 15 dead shadcn primitive files whose npm dependencies Phase 1 removed are deleted (they fail to compile under strict and have zero inbound references).
- If escape hatches were needed, `src/lib/types/escape-hatches.ts` holds them with documented justification and call-site references. Single soft cap of 5: the 5th entry triggers a TD-FE registration capturing the pattern. Beyond 5, each additional batch of 5 entries triggers another TD-FE. No hard cap, no phase halt — Phase 13's audit re-evaluates every entry per master spec line 298 (see §3 Step 3).
- The 238 existing inline `any` types remain — they're a Phase 2b lint-rule concern, not a Phase 2a typecheck concern.
- `npm run preflight` is green on the final commit before merge.

The phase is the second of three sub-phases (2a, 2b, 2c) that together implement master spec §4 Phase 2 "Foundation." 2a owns the typecheck flip; 2b owns lint + Prettier; 2c owns the preflight gates + bundle budget. Each ships on its own branch.

### 1.2 Why now

Master spec §4 places Phase 2a immediately after Phase 1's LOC reduction so the strict-error surface hits a smaller tree. Phase 1 merged 2026-05-27, leaving 67,469 LOC across 156 files (per the Phase 1 scorecard). The strict probe surfaces 461 errors — well under the master plan's 1,500 sub-decomposition threshold. With Phase 1's preflight chain (typecheck + build + Playwright + visual regression + Vitest + `knip --strict`) already in place, the safety net for type changes is sufficient.

### 1.3 Starting state (Phase 2a anchor)

| Aspect | State as of Phase 1 merge (2026-05-27) |
|---|---|
| Source LOC | 67,469 across 156 `.ts`/`.tsx` files under `frontend/src/` (per Phase 1 scorecard `docs/audits/2026-05-27-frontend-loc-pass-1.md`) |
| Strict probe baseline | 461 errors total (probe run 2026-05-27 against post-Phase-1 `master`) |
| Error code histogram | 315× TS6133 (unused locals/params) · 83× TS7006 (implicit any) · 15× TS2307 (cannot find module — all in dead-shadcn files) · 12× TS6192 (all imports unused) · 8× TS2345 · 8× TS18046 · 7× TS2322 · 5× TS18047 · 4× TS2339 · 2× TS6196 · 2× TS18048 |
| Concentration | `pages/MarketResearch.tsx` 144 · `pages/MissionControl.tsx` 80 · `market-research/RegulatoryComplianceSection.tsx` 25 · `market-research/MarketEntrySection.tsx` 22 · `market-research/CompetitorLandscapeSection.tsx` 18 · `customers/SuggestedICPCards.tsx` 18 · `mission-control/ICPManager.tsx` 17 · `layout/Sidebar.tsx` 16. Top 8 files = 340/461 ≈ 74% of errors. |
| Per-area roll-up | `pages/` 249 · `components/market-research/` 115 · `components/layout/` 24 · `components/mission-control/` 23 · `components/ui/` 18 · `components/customers/` 18 · `lib/` 5 · `components/settings/` 4 · `contexts/` 1 · `components/strategist/` 1 · `components/signals/` 1 · `components/` (loose) 2 |
| Existing inline `any` count | 238 (`rg -nE ':\s*any\b\|as\s+any\b\|<any>'` across `src/`). Out of scope for 2a per master spec — Phase 2b's lint rule decides per call site. |
| `@ts-*` suppressions | 5 (`@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`). Leave for Phase 2b decision. |
| Current `tsconfig.app.json` (5 explicit flags) | `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false`, `noFallthroughCasesInSwitch: false`. |
| `strictNullChecks` in `tsconfig.app.json` | Not explicitly listed. Effective value derives from `strict: false` (which implies `strictNullChecks: false`) and the composite root's explicit override below. |
| Current `tsconfig.json` (composite root, 4 overrides) | `noImplicitAny: false`, `noUnusedParameters: false`, `noUnusedLocals: false`, `strictNullChecks: false` — each re-softens what the app config might otherwise tighten. |
| Preflight chain | `npm run preflight` = `typecheck → vite build → test:e2e (Playwright incl. visual regression) → test (Vitest) → knip --strict --no-progress`. 2a tightens what `typecheck` enforces; no chain additions in this phase. |
| Safety net inherited from Phase 0b | Vitest + RTL + MSW harness; characterization tests on `cn`, `sanitizeAnswerText`, `rateLimitManager`, `marketScoresHeatmap`, `marketScoreDescriptions`, `timestampUtils`; Playwright behavioral journeys incl. `/customers` and `/settings`; visual regression at `maxDiffPixelRatio 0.01`. |
| Existing TD-FE entries | TD-FE-1 through TD-FE-7 from Phase 1 (orphan routes + conservative-deferral exports). Phase 2a may add entries; numbering continues from TD-FE-8. |

### 1.4 Numbering and branch

- Spec NN = 17 (Phase 1 used NN=16; next slot per CLAUDE.md numbering rule).
- Branch name: `phase-2a-strict-ts`, branched off `master` at the post-Phase-1 commit.
- Branch lifecycle: short-lived; deleted after merge per Spec 14 §5.1.

### 1.5 Why single phase (no sub-split)

461 errors is well under master spec §4 Phase 2a's 1,500 sub-decomposition trigger. The internal structure of category waves (§3 Steps 2–4) provides commit cohesion without requiring formal sub-phases. If Step 0 re-baseline finds >1,500 errors, the plan author re-enters the sub-decomposition decision per master spec §4 and R1 below.

---

## §2 Scope

### 2.1 In scope

- Flip the five linting flags currently set to `false` in `frontend/tsconfig.app.json` (one config edit — `strict`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`); `strict: true` implies `strictNullChecks: true` so the sixth strict-effective flag lands transitively. Remove the four relaxing overrides in `frontend/tsconfig.json` (one config edit — `noImplicitAny`, `noUnusedParameters`, `noUnusedLocals`, `strictNullChecks`).
- Drive `tsc --noEmit` to zero strict errors across `frontend/src/` (the tree that `tsconfig.app.json`'s `"include": ["src"]` covers — test files included).
- Delete the 15 dead shadcn primitives whose npm dependencies Phase 1 removed: `aspect-ratio.tsx`, `calendar.tsx`, `carousel.tsx`, `context-menu.tsx`, `form.tsx`, `hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `radio-group.tsx`, `resizable.tsx`, `slider.tsx`, `switch.tsx`, `toggle.tsx`, `toggle-group.tsx`. Each delete applies Phase 1's 6-check kit (basename rg, dynamic-import rg, re-export rg, plain-text rg, App.tsx route walk, e2e/tests import scan). Treated as Phase-1-followup cleanup, not a Spec 16 §2.2 ui/-lock violation — the lock was about not refactoring shadcn primitives, not about preserving syntactically-broken files.
- Create `src/lib/types/escape-hatches.ts` **only if needed**. Single soft cap of 5: the 5th entry triggers a `TD-FE-<n>` registration capturing the pattern (per master spec line 298's "Phase 13's audit re-evaluates every entry"). Each additional batch of 5 (entries 10, 15, 20…) triggers another TD-FE. No hard cap, no phase halt, no user checkpoint. Each entry requires (a) a `// TODO(phase-13):` comment, (b) a call-site reference, and (c) a one-line justification for why proper typing is unreasonable at this phase. **The interim location `src/lib/types/escape-hatches.ts` deviates from Spec 14 §4 Phase 2a's `src/shared/types/escape-hatches.ts` only because `src/shared/` doesn't exist until Phase 4** — Phase 4 relocates the file to the master-plan-specified path when it creates `src/shared/`.
- Final scorecard merged at `docs/audits/<date>-frontend-phase-2a-strict-ts.md` per §3 Step 5.

### 2.2 Out of scope (deferred)

- **The 238 existing explicit `any` types.** Phase 2a's done-when is `tsc --noEmit` green; explicit `any` is legal under `strict: true`. Phase 2b adds `@typescript-eslint/no-explicit-any` and decides per call site whether each becomes a proper type, an escape-hatches entry, or an inline `eslint-disable` with justification.
- **The 5 existing `@ts-*` suppressions.** Same logic — Phase 2b lint rule decides per call site.
- **ESLint type-aware rules, `import/order`, Prettier check.** Phase 2b's domain.
- **Bundle budget, preflight-chain extensions, NFR thresholds.** Phase 2c's domain.
- **Feature folder restructuring (`src/features/`, `src/shared/`).** Phases 4–10.
- **TanStack Query adoption, three-cache collapse, rate-limit centralization.** Phase 3.
- **shadcn primitive consolidation beyond the 15 dead-import deletions** in §2.1. Phase 4 owns `src/components/ui/` formally.
- **Behavior changes, opportunistic refactoring beyond what a strict-error fix mechanically requires.** Posture rules in §2.4 pin this.
- **`tsconfig.node.json` flag changes.** Governs `vite.config.ts` and tooling scripts. `vite build` transpiles via esbuild without typechecking, so the non-strict state of `tsconfig.node.json` does not affect the preflight chain. Phase 2c or Phase 4 may revisit if a build-time issue surfaces.

Out-of-scope discoveries are logged to `docs/TECH_DEBT.md` as `TD-FE-<n>` entries (numbering continues from TD-FE-8).

### 2.3 Frozen interfaces

These do not change as a result of Phase 2a (covered by Phase 0b's characterization tests and Phase 0a's visual regression):

- HTTP API contract with the backend.
- Routes.
- Visible UI — visual regression at `maxDiffPixelRatio 0.01` stays green.
- Auth flow, rate-limit boundary value (4 req/min), bundle output format.
- Existing Playwright behavioral journeys stay green.
- Existing Vitest characterization suite stays green.
- **Public exports of `src/lib/`, `src/hooks/`, `src/utils/`, `src/contexts/`.** Signatures may *tighten* (adding parameter types, narrowing return types) but no rename, no removal, no semantic change. Test imports and e2e fixture imports must continue resolving. When a TS6133 / TS6192 deletion would remove a public export, use the `_` prefix convention (§2.4 posture rules) instead.
- **Type-level cascades from Wave B narrowing are in scope, not a frozen-interface violation.** Wave B's annotations narrow function return types from inferred `any` to concrete types. This changes type inference at downstream call sites — including in files this phase doesn't otherwise touch. The cascading strict errors that surface in unmodified files are expected and get fixed under the same Wave B / Wave C rules; the file-by-file commit grain in §3 Step 3 absorbs them. Runtime behavior is unchanged (the runtime value was always the same concrete type; only the compile-time view tightened). R4 covers the operational handling.

### 2.4 Posture rules

When fixing a strict-mode error, the grain is "what the type system needs to be satisfied," not "what would make the file better." Specifically:

1. **Default fix:** add the proper type. Read call sites if needed; infer from usage. For React event handlers, use the corresponding `React.*Event<HTMLXXX>` type. For array callbacks, propagate the source array's element type. For object destructuring on weakly-typed data, type the parameter.
2. **Acceptable narrowing refactor:** if the fix needs a type guard, a `typeof` narrow, a user-defined predicate, a non-null assertion on a value with a known initial (`useRef(initialValue).current!` where `initialValue` is non-null), or extracting a typed local, that's in scope. **For the common `useRef<T>(null)` pattern where the ref is assigned post-mount:** guard with `if (ref.current != null)` before access; use `.current!` only when the component lifecycle guarantees non-null at the access site (e.g., a ref used inside an `onClick` that's only attached after the render that set the ref). When in doubt, guard rather than assert.
3. **Out-of-scope refactor encountered:** if a strict error reveals a deeper design problem (e.g., a function whose union type would need restructuring across 10 call sites), one of:
   - escape-hatch the immediate site within the cap (§3 Step 3 policy), OR
   - log a `TD-FE-<n>` entry capturing the deferral, OR
   - abort the phase per Spec 14 §5.7 if the discovery invalidates the spec.
   Do not refactor opportunistically.
4. **Behavior unchanged.** Type-only edits. If you find yourself rewriting logic to satisfy a type, stop — that's option 3 territory.
5. **Underscore convention.** Unused parameters required for interface compliance (callback signatures mandated by an external API or by an internal callee that does pass the arg) get the `_argName` form — named underscore, never bare `_`. Bare `_` collides when multiple unused parameters appear in one signature; named `_argName` preserves the documentation of what the parameter would have been called. Applies to free functions and class methods uniformly. **Note:** TypeScript honors bare `_` as "intentionally unused" for `noUnusedParameters`, so pre-existing bare `_` parameters in the codebase do **not** surface as TS6133 errors and are not retroactively renamed by this phase. The `_argName` convention applies only to new fixes added during Wave A.

---

## §3 Methodology — category-by-category, all-flags-on

Six deterministic steps. Build is red between Step 1b and end of Step 4 — acceptable because `master` stays green; only the phase branch is in flight. Vitest and Playwright continue to run mid-phase (esbuild transpiles without typechecking).

### Step 0 — Re-baseline at execution start (one commit)

Run the strict probe against the current `master` state immediately on branch creation. Capture two artifacts:

- `docs/audits/<date>-frontend-phase-2a-strict-probe.json` — machine-readable per-file error list, error-code histogram, per-area roll-up. Generated by a `frontend/scripts/build-strict-probe.ts` helper that the plan stage writes (modelled on Phase 0a's `build-audit-scorecard.ts`).
- `docs/audits/<date>-frontend-phase-2a-strict-probe.txt` — raw `tsc --noEmit` output for the strict tsconfig probe.

The probe config is a throwaway:

```json
// frontend/tsconfig.strict-probe.json (not committed; built and removed in Step 0)
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Re-baseline output is the spec's official "before" anchor.** Phase 1 merged today, but any merge between this spec's drafting (2026-05-27) and execution start may shift the count. If the re-baseline error count exceeds 1,500, the plan author halts and re-enters master spec §4's sub-decomposition decision (file-folder split or category sub-phases) before continuing.

Commit subject: `chore(audits): phase 2a strict ts re-baseline`.

### Step 1 — Flag flip + dead-shadcn deletion (commit cluster, ~4 commits)

Order matters: deletions first while the tsconfig is still non-strict; flag flip last. Rationale: each dead-shadcn delete is a Phase-1-followup whose 6-check kit reads "before" against a known-clean compile.

**Step 1a — Delete 15 dead shadcn primitives in 3 batched commits (5 files per commit, alphabetically grouped):**

Phase 1 already verified these files have zero inbound — they're second-order dead (npm deps removed in Phase 1 leave the .tsx files syntactically broken). Per-file commits would be 15 commits of mechanically identical operations; batching by alphabet reduces noise while preserving revert granularity.

Three batches:
- **Commit 1a-i:** `aspect-ratio.tsx`, `calendar.tsx`, `carousel.tsx`, `context-menu.tsx`, `form.tsx`
- **Commit 1a-ii:** `hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `radio-group.tsx`
- **Commit 1a-iii:** `resizable.tsx`, `slider.tsx`, `switch.tsx`, `toggle.tsx`, `toggle-group.tsx`

Each batch commit applies Phase 1's 6-check kit to all 5 files; the commit body contains a per-file block:

```
aspect-ratio.tsx:
  rg-basename: <count>
  rg-dynamic-import: <count>
  rg-reexport: <count>
  rg-plain-text: <count>
  route-walk: <none|path>
  test-imports: <none|paths>

calendar.tsx:
  ...
```

Zero / `none` on every check is required for every file in the batch. Commit subject: `chore(fe): remove dead shadcn primitives (batch i)` (or `ii` / `iii`). After Step 1a, the TS2307 count falls from 15 to 0.

**Surprise-inbound procedure:** if any file in a batch shows a non-zero hit (unexpected — Phase 1's dead-deps verdict implies no inbound), exclude that file from the batch (don't delete it), commit the remaining 4 deletions, and handle the surviving file via one of: (a) restoring the dep in `package.json` (rolls back part of Phase 1, requires user checkpoint), (b) refactoring the inbound to remove the dependency, or (c) deferring this delete with a `TD-FE-<n>` entry. The default is (c) for any surprise; (a) and (b) require user input.

**Step 1b — Flip strict flags (one commit):**

- Update `frontend/tsconfig.app.json` so its five explicit linting flags are all `true`: `strict`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. (`strictNullChecks` is not explicitly listed in the app config; `strict: true` implies it.)
- Update `frontend/tsconfig.json` (composite root): remove the four overrides that re-soften flags — `noImplicitAny: false`, `noUnusedParameters: false`, `noUnusedLocals: false`, `strictNullChecks: false`. The composite root no longer relaxes what the app config tightens. After this edit, the effective configuration has all six strict-mode behaviors active (`strict`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`).
- `tsconfig.node.json` untouched (out of scope per §2.2).

Commit subject: `chore(fe): enable strict typescript flags`.

After Step 1b, `tsc --noEmit` is red. Vitest and Playwright continue to pass.

### Step 2 — Wave A: noUnused* sweep (~327 errors, ~10–12 commits)

Targets TS6133 (unused locals/params, 315) + TS6192 (all-imports-unused, 12).

**Fix rules:**

- **Unused import:** delete the named import; delete the whole line if no remaining names.
- **Unused local:** delete the declaration. For destructuring patterns where only some names are unused, drop just those names from the pattern.
- **Unused function/method parameter required for interface compliance:** apply the `_argName` convention from §2.4 posture rule 5. Bare `_` is never used; the underscore-prefixed name preserves what the parameter would have been called.
- **Unused destructured prop:** delete from destructuring; if all become unused, simplify the component signature.
- **Public-export protection (§2.3):** if removing an "unused" symbol would remove a public export of `src/lib/`, `src/hooks/`, `src/utils/`, or `src/contexts/`, do not delete. Apply `_` prefix to the parameter, or restructure locally if the symbol is a const/function. Test and e2e files must continue resolving.

**Commit grain:** by area, leaves before monsters. Suggested order:

1. `src/lib/`, `src/hooks/`, `src/utils/`, `src/services/`, `src/contexts/` (light counts, broad blast radius — fix cleanly first).
2. `src/components/ui/` shadcn (light counts after 15 deletes in Step 1a).
3. `src/components/layout/`, `src/components/signals/`, `src/components/strategist/`, `src/components/settings/`, `src/components/customers/` (mid).
4. `src/components/market-research/` (excluding any pages routed from `src/pages/`, which are in step 6).
5. `src/components/mission-control/`.
6. `src/pages/` — MissionControl before MarketResearch, both last after smaller pages.

**Split threshold:** if an area's diff exceeds **60 line-deletions**, split into sub-area commits (e.g., split `src/components/market-research/` by sub-folder or by file). The threshold catches outlier areas without forcing splits inside cohesive areas. One commit per area is the default; splitting is the exception.

Commit subject: `refactor(fe): remove unused symbols in <area>` (or `<area>/<sub-area>` when split).

**Wave-end checkpoint:** before starting Step 3, run `node_modules/.bin/tsc -p tsconfig.app.json --noEmit 2>&1 | grep -c 'error TS'` and confirm the count dropped by approximately 327 (the Wave A target). The post-A count should be close to (Step 0 baseline − 327). If the drop is materially short (e.g., off by >30), pause to investigate before Wave B — the gap suggests either missed errors or unexpected cascading. Not a full preflight; just a count verification.

### Step 3 — Wave B: noImplicitAny annotations (~83 errors, file-by-file commits)

Targets TS7006 (parameter implicitly has 'any' type).

**Fix rules (per §2.4 posture):**

- **React event handlers:** use the built-in event types — `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent<HTMLButtonElement>`, `React.FormEvent<HTMLFormElement>`, `React.KeyboardEvent<HTMLDivElement>`, etc.
- **Array callbacks (`.map`, `.filter`, `.reduce`):** usually inferable once the source is properly typed. If the source is `any`-typed, fix the source first (one Wave-B commit can fix both).
- **Object destructuring on weakly-typed data:** type the parameter; create a local `interface` or `type` when the shape is non-trivial.
- **Async/await return types:** annotate the surrounding function's return type when the inferred collapse to `any` is the root cause.
- **Type imports from other modules:** when satisfying an implicit-any fix requires importing a type, use `import type { ... } from '...'`. The `import type` form is erased at compile time and does not contribute to runtime circular-dependency cycles, which matters because adding type imports during this wave can otherwise surface circular-import issues that didn't exist before. If a type import is still circular even with `import type`, inline the type locally instead.
- **Genuinely polymorphic helpers:** consider a generic (`<T>`). Escape-hatch only as last resort.

**Escape-hatches policy (single soft cap, no hard cap):**

The 5-entry threshold is calibrated for pattern detection — small enough that hitting it signals a recurring problem worth capturing as TD-FE; large enough to absorb a few genuinely hard edge cases without ceremony. There is no hard cap and no phase-halt mechanism — master spec line 298 explicitly states "Phase 13's audit re-evaluates every entry and removes the no-longer-needed ones," so accumulation is acceptable and audit is the cleanup mechanism.

- **Default state.** `src/lib/types/escape-hatches.ts` is empty or absent. Each entry is added only when proper typing is genuinely unreasonable for this phase. Format:

  ```ts
  // TODO(phase-13): replace with proper type once SuggestedICPCards's data contract is defined.
  // src/components/customers/SuggestedICPCards.tsx:142 — leadFilter parameter is shaped by a
  // backend response whose contract types haven't been written yet (Phase 3 owns those).
  export type UntypedLeadFilter = any;
  ```

  The `// TODO(phase-13):` comment is mandatory on every entry — it gives Phase 13's audit a greppable marker. The `Untyped*` type prefix is also mandatory — visible at import sites (where the comment is not), it signals temporariness without requiring callers to scroll to the definition.
- **Soft cap of 5 reached (5th entry added):** the 5th entry's commit body includes a `TD-FE-<n>` registration line (numbering continues from TD-FE-8 or wherever the register stands). The TD-FE entry captures which 5 sites used escape hatches, the pattern they share (if any), and the trigger (typed-data missing? generic refactor needed?). The phase continues without halting.
- **Beyond 5 — additional batches of 5.** Entries 10, 15, 20… each trigger another `TD-FE-<n>` registration capturing the pattern evolution since the previous batch. This keeps the audit trail current as accumulation continues. The phase still does not halt.
- **No hard cap, no user checkpoint, no auto-abort.** Accumulation is acceptable per master spec; Phase 13's audit re-evaluates every entry. If during execution the count grows materially beyond what the spec author expected (e.g., 30+ entries), the implementer applies judgment — that pattern is itself a structural signal worth raising to the user, but the spec does not encode an automatic trigger.

**Commit grain:** file-by-file, leaves before monsters. Suggested order:

1. `src/lib/`, `src/hooks/`, `src/utils/`, `src/services/`, `src/contexts/`.
2. `src/components/` — small areas first (signals, strategist, settings, layout), then larger (customers, market-research sections, mission-control sub-components).
3. `src/pages/` — small pages first (Settings, TenantSelection, Login, Calendar, Reports, Artifacts, Signals, Deals, Insights, NotFound), then `MissionControl.tsx` (80 errors), then `MarketResearch.tsx` (144 errors) last.

Commit subject: `refactor(fe): type <file>` (or `refactor(fe): type <area>` when a batch of small files in one area is bundled).

**Wave-end checkpoint:** before starting Step 4, re-run the error-count probe and confirm a further drop of approximately 83 (the Wave B target). Cascade-related errors landing in Wave B's commits may push the actual count higher mid-wave, but the *net* between post-A and post-B should still be ~83. If the gap is materially short, pause before Wave C.

### Step 4 — Wave C: semantic stragglers (~36 errors, file-by-file commits)

Targets TS2345 (8), TS2322 (7), TS18046 (8), TS18047 (5), TS18048 (2), TS2339 (4), TS6196 (2) — summing to 36. **Plus a re-verification** on the first Step-4 commit that TS2307 residue is 0 (Step 1a's deletes should have eliminated all 15). The 15 TS2307s are not part of Wave C's fix workload; they're a Step 1a deliverable, re-checked here.

**Fix rules:**

- **`possibly null` / `possibly undefined` (TS18047, TS18048):** prefer a guard (`if (x != null)`) over a non-null assertion. Use `!` only on demonstrably-non-null values (e.g., `useRef(initialValue).current` where `initialValue` is set, or a post-effect-mount access).
- **`unknown` type access (TS18046):** narrow with `typeof`, `in`, or a user-defined type guard. Do not cast to `any`.
- **Property does not exist (TS2339):** the underlying type is wrong; broaden, narrow, or add the property to the type definition. Casting to `any` is not the fix.
- **Argument / type assignment mismatches (TS2345, TS2322):** fix the type on the assigning side first; only adjust the callee signature if the callee is genuinely too narrow.
- **`Class declared but never used` (TS6196):** treat as Wave A residue — delete or `_` prefix if it's a class declaration that was missed. If it's a type-import alias, prune.

**Escape-hatches policy:** same single soft cap as Wave B (5 entries; TD-FE registration on the 5th and every additional batch of 5). The count is global to Phase 2a — entries added in Wave B count toward the 5-entry threshold during Wave C.

**Commit grain:** file-by-file. Each file with semantic errors gets at least one commit. Commit subject: `refactor(fe): tighten types in <file>`.

**Wave-end checkpoint:** before starting Step 5, re-run the error-count probe and confirm the count is 0 (the Wave C target). If non-zero, fix residuals in Wave C's grain before proceeding to verification.

### Step 5 — Verify done-when and write scorecard (one commit; two if residual fixes are needed)

**Verification checklist** (run before writing the scorecard; if any fails, a residual-fix commit lands first):

- `npm run typecheck` → 0 errors.
- `src/lib/types/escape-hatches.ts` is absent OR contains entries each with the required `// TODO(phase-13):` comment, `Untyped*` type-name prefix, and call-site reference. For every batch of 5 entries (entries 5, 10, 15…), a `TD-FE-<n>` registration exists capturing the pattern.
- `rg -nE ':\s*any\b\|as\s+any\b\|<any>' --include='*.ts' --include='*.tsx' src/ | wc -l` returns ≤238 (no inline-any regression vs design-time baseline).
- `rg -nE '@ts-(ignore|expect-error|nocheck)' --include='*.ts' --include='*.tsx' src/ | wc -l` returns ≤5 (no new suppression regression).
- `npm run preflight` green: `typecheck → vite build → playwright test → vitest run → knip --strict --no-progress`.

**Residual-fix commit (only if checklist fails):** small fixes to address whatever check went red. Commit subject: `fix(fe): residual phase 2a verification fixes`. Re-run the checklist after.

**Scorecard commit** (always written, even if verification passed clean on first try): `docs/audits/<date>-frontend-phase-2a-strict-ts.md` with:

1. **Error count:** Step 0 re-baseline number → 0.
2. **Per-area delta table** comparing Step 0 JSON to post-phase state.
3. **Files deleted:** 15 dead-shadcn primitives with their LOC deltas (or fewer if any 6-check kit blocked a deletion).
4. **Escape-hatches:** count, location (`src/lib/types/escape-hatches.ts` if present), list of entries with justifications and call-site references, OR `none created`. For each batch-of-5 boundary crossed during the phase, the corresponding `TD-FE-<n>` registration is cited.
5. **TD-FE entries created during the phase:** IDs (e.g., `TD-FE-8`) and one-line summaries.
6. **Commit-by-commit summary** from `git log master..HEAD` annotated with which wave/step produced each commit.
7. **Diff size:** total additions / deletions from `git diff --stat master..HEAD` reported verbatim. The 15 dead-shadcn deletions are called out separately so the reviewable-code surface is visible without arithmetic. No target, no gate — just reporting for impl-review's context.

Scorecard commit subject: `docs(audits): phase 2a strict ts scorecard`.

---

## §4 Definition of done

The phase is "done" when **all** of these hold on `phase-2a-strict-ts` immediately before merge:

1. `frontend/tsconfig.app.json` has its five explicit linting flags (`strict`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`) all set to `true`. (`strictNullChecks: true` is implied by `strict: true`.)
2. `frontend/tsconfig.json` (composite root) no longer overrides any of those flags back to `false`.
3. `tsc --noEmit` (via `npm run typecheck`) returns **zero** errors.
4. The 15 dead shadcn primitives listed in §2.1 are deleted (or any deferral has a documented `TD-FE-<n>` entry and a 6-check-kit reason).
5. `src/lib/types/escape-hatches.ts` is absent OR contains entries each with the mandatory `// TODO(phase-13):` comment, `Untyped*` type-name prefix, a call-site reference, and a one-line justification. For every batch of 5 entries (5, 10, 15…), a `TD-FE-<n>` registration exists capturing the pattern.
6. Inline `any` count ≤238 (`rg -nE ':\s*any\b\|as\s+any\b\|<any>' --include='*.ts' --include='*.tsx' src/ | wc -l`).
7. `@ts-*` suppression count ≤5.
8. `npm run preflight` green: typecheck + vite build + Playwright (incl. visual regression) + Vitest + `knip --strict --no-progress`.
9. Scorecard merged at `docs/audits/<date>-frontend-phase-2a-strict-ts.md` per §3 Step 5.

The master plan's row for Phase 2a (Spec 14 §4) updates to `done` with the merge date — handled by `synthesize-impl-review` per Spec 14 §5.5.

---

## §5 Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Step 0 re-baseline finds >1,500 errors (Phase 1 drift, or strict-mode flag interaction the design-time probe missed). | Master spec §4's sub-decomposition trigger fires — plan author proposes a sub-split (`2a-i` mechanical / `2a-ii` implicit-any / `2a-iii` semantic, or by feature folder) before Step 1b. Spec does not need rewriting; plan absorbs the structure. |
| R2 | A Wave C semantic error reveals a structural problem requiring out-of-scope refactor (e.g., a type-narrowing fix that cascades across 10 files). | Escape-hatches soft cap (§3 Step 3): the 5th entry triggers a TD-FE capturing the pattern; every additional batch of 5 triggers another. No hard cap (master spec line 298 puts post-hoc audit responsibility on Phase 13). If accumulation grows materially beyond expectations, the implementer raises the pattern to the user — judgment call, no automatic trigger. The TD-FE entries preserve the structural signal that the spec under-scoped semantic work; Phase 13's audit re-evaluates each entry. |
| R3 | Wave A's `noUnused*` deletions break a test-only or e2e import. | §2.3 freezes the public exports of `src/lib/`, `src/hooks/`, `src/utils/`, `src/contexts/`. Step 2 rule mandates `_` prefix over deletion when an exported symbol is "unused-in-src" but referenced from tests or e2e. Preflight's Vitest + Playwright catches any missed reference. |
| R4 | Wave B implicit-any fixes cascade — typing one parameter surfaces more TS7006 errors downstream. | Same-commit fix is the default; the file-grain commits absorb cascades within a file. Cross-file cascades that genuinely change a contract get their own commit. Unbounded cascade across many files is R2 territory (escape-hatch + TD-FE, or abort). |
| R5 | Phase branch has red typecheck for most of the phase (Step 1b through end of Step 4). | Acceptable: `master` stays green; the controller agent never merges a red branch. Vitest + Playwright continue mid-phase because esbuild transpiles without typechecking. The final pre-merge preflight (Step 5) is the binding gate. |
| R6 | A dead-shadcn deletion in Step 1a breaks something the 6-check kit missed (dynamic import, string-interpolated path, lazy route). | Same kit Phase 1 used to delete 10 source files without incident. Preflight (Vitest + Playwright + visual regression + `knip --strict`) backstops. If preflight goes red after a Step 1a commit, revert that one commit; do not proceed until the inbound is identified. |
| R7 | The 238 existing inline `any`s hide strict-mode errors that would otherwise surface. | Acknowledged out-of-scope per §2.2. Phase 2b's `@typescript-eslint/no-explicit-any` forces each into either (a) proper type, (b) escape-hatches entry, or (c) inline `eslint-disable` with justification. Phase 13's audit re-evaluates per Spec 14 §6 item 3. |
| R8 | Test files (`__tests__/`, `*.test.{ts,tsx}`) surface strict errors. | They are in scope — `tsconfig.app.json`'s `"include": ["src"]` covers them. Fix using the same Wave rules. If a test mocks with `any` for legitimate reasons, that's a candidate for the escape-hatches cap or for `_` prefix. |
| R9 | Step 0 re-baseline differs materially from the design-time 461 count due to merges landing between this spec and execution. | The re-baseline numbers are the spec's official anchor. Plan stage notes any delta in its preface; if delta is small the methodology holds; if delta is large enough to cross the 1,500 threshold, R1's mitigation applies. |
| R10 | Third-party type declaration gaps (TS7016 "could not find declaration file") surface during execution against a transitive dependency the design-time probe didn't reach, or against a package whose `@types/*` is missing. | Acknowledged: 0 TS7016 in the design-time baseline. Step 0 re-baseline re-verifies. Per-case fix during Wave C: install the corresponding `@types/*` package (counts as a Phase-2a-scope dep change because it's required to make typecheck pass), or add a minimal local `.d.ts` shim under `src/types/` (or wherever the existing project convention places shims). If neither is reasonable, the call site goes to the escape-hatches budget. |

---

## §6 Open questions deferred to the plan stage

These do not block the spec — each becomes a plan-stage decision documented in `plans/17-frontend-phase-2a-strict-ts.md`:

1. **Step 0 re-baseline numbers.** Will not be known until execution start. Plan records the exact post-Phase-1 figures and notes any delta from the design-time 461.
2. **Wave A within-area file ordering.** Inside an area (e.g., within `src/lib/`), which file first? Plan picks based on Step 0 per-file counts.
3. **Wave B within-pages-group ordering for small pages.** §3 Step 3 lists "small pages first" before MissionControl/MarketResearch; the plan picks the exact small-page order from Step 0 (likely error-count ascending).
4. **Wave C clustering.** Some semantic errors cluster by symbol (e.g., a single type definition error producing multiple TS2322 callsite errors). Plan decides whether to batch them in one commit or split by file. Default: by file.
5. **Diff size reporting depth.** §3 Step 5 mandates `git diff --stat` output in the scorecard. Plan decides whether to also break down diff size by wave (Wave A vs B vs C) for impl-review's reading convenience, or leave it as one aggregate number.
6. **`build-strict-probe.ts` script location and reuse.** Step 0 needs a generator for the probe artifacts; the plan decides whether to extend `frontend/scripts/build-audit-scorecard.ts` (Phase 0a) or write a sibling script. Either lives under `frontend/scripts/` and is committed at Step 0.

---

## §7 Companion documents

- `specs/14-frontend-refactoring-master-plan-design.md` — master plan (§4 Phase 2a row updates to `done` at merge; §6 done-when items 3 and applies)
- `specs/15-frontend-phase-0-inventory-and-safety-net-design.md` — Phase 0 spec (the safety net Phase 2a relies on)
- `specs/16-frontend-phase-1-loc-reduction-design.md` — Phase 1 spec (the §2.2 ui/-lock referenced in §2.1; the 6-check-kit template; the TD-FE numbering convention)
- `docs/audits/2026-05-26-frontend-baseline.md` — Phase 0a baseline (LOC and dead-code source)
- `docs/audits/2026-05-27-frontend-loc-pass-1.md` — Phase 1 scorecard (the kept-21 / removed-10 shadcn decision; the 15 broken-import primitives identified)
- `docs/TECH_DEBT.md` — TD-FE register (gains any entries created during Phase 2a; next entry is TD-FE-8)
- Backend Spec 5 / Spec 12 — adjacent precedent for category-wave methodology in foundation phases
