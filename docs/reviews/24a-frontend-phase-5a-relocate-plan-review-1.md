---
artifact: plans/24a-frontend-phase-5a-relocate.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Context

Plan reviewed against its source spec `specs/24-frontend-phase-5-market-research-design.md` (Spec 24), particularly §3 (5a scope), §7 (leaving components), §8 (testing), §9 (master deltas), and §13 (open questions deferred to 24a). Review covers sequencing, risk, decomposition, recovery, abort criteria, verification, hidden prerequisites, spec drift, parallelizability, and overengineering.

## Findings

### [High] Spec §3 "Done when" visual requirement not amended — formal completion criteria drift

**Location:** Task 6 Step 2 (spec delta); Task 7 Step 4 item 6 (plan's done-when checklist); Spec 24 §3 "Done when"

Spec 24 §3 "Done when" explicitly requires "E2E (`journeys/04`) + **visual** + Vitest + `npm run preflight` green." The plan correctly discovers that market-research has no pixel VR baseline (Conventions section, line 19; Task 5 logs a TD-FE). Task 6 Step 2 amends Spec 24 §1.2/§8/R4 to record the behavioral-only guard. However, **§3's "Done when" is not amended** — the spec's formal completion criteria still say "visual." Task 7 Step 4 item 6 reads "journeys/04 + Vitest + npm run preflight green," silently dropping "visual." A reviewer or downstream agent checking completion against the spec's literal text will see an unmet criterion. The fix is a one-line amendment to §3's "Done when" in the Task 6 Step 2 delta, removing "visual" or qualifying it as "behavioral E2E only (no MR pixel VR; TD-FE logged)."

### [Medium] sed-based import rewrite operates on non-import string occurrences without a backstop for false positives

**Location:** Task 2 Step 2, lines 182–200

The `sed -i` loop rewrites `@/components/market-research/$f` across all `.ts`/`.tsx` files in `src/`. This catches imports (correct), but also matches the same path string inside comments, string literals, error messages, or log statements. A corrupted string (e.g., a log message `"Fetching from @/components/market-research/MarketDetailDrawer"`) would be silently rewritten to the feature path. `tsc --noEmit` (Step 3) catches broken imports but not corrupted string content. The Step 2 backstop `grep` only checks that no old-path references remain — it doesn't distinguish imports from strings. In practice this is low-risk for the specific filenames involved (they're component-specific enough), but for a plan that emphasizes "zero behavioral change," an explicit post-move string-content audit (or a `grep -rn` restricted to `from ['"]` / `import .* from` patterns) would be more precise.

### [Medium] Task 5 hard-codes date `2026-05-30` in TD-FE entries

**Location:** Task 5 Step 3, lines 426–449

Both the TD-FE-14 resolution line and the new TD-FE entry hard-code `2026-05-30`. If execution happens on any other date, the entries will be inaccurate. The plan goes to the trouble of reading the next free TD-FE number dynamically (line 419) but doesn't apply the same treatment to the date. Recommend using `$(date +%Y-%m-%d)` or equivalent, or instructing the implementer to substitute the execution date.

### [Medium] Lighter baseline subset in Task 0 Step 3 creates ambiguous regression attribution at Task 7

**Location:** Task 0 Step 3 (line 63); Task 7 Step 1

Task 0 Step 3 accepts `npm run typecheck && npm run lint && npm run test` as a lighter baseline, skipping `build`, `bundle:check`, and `test:e2e`. Task 7 requires full `npm run preflight`. The plan acknowledges that "if Task 7 then reds on a skipped step, first check whether the failure pre-existed 5a before treating it as a regression" — but doesn't specify *how* to determine that. For a mechanical move, the plan argues 5a "cannot plausibly break `build`/`bundle:check`" — but if an E2E test in `test:e2e` fails at Task 7, the implementer must manually check out `master` and run preflight there to distinguish pre-existing from introduced. A clearer instruction would be: "if Task 7 reds on a step skipped at Task 0, re-run that step on `master` before investigating; if `master` also reds, it's pre-existing and does not block 5a."

### [Low] Task 0 Step 5 cites "spec §1.5" for genuine/leaving classification — incorrect section

**Location:** Task 0 Step 5 heading, line 80

The heading says "Audit — classify genuine vs leaving (spec §1.5, §7)." Spec §1.5 is "Scope" — it defines what's in/out of Phase 5 broadly but doesn't contain the per-file genuine/leaving classification. The classification derives from §1.3.5 (decision: leaving components stay in place, annotated) and §7 (the leaving-components table with per-component target features). §1.5 is related but not the classification authority. The correct citation is §1.3.5 and §7.

### [Low] Task 6 Step 1 "correct them if they still say 'pending'" may conflict with "frozen prose" boundary

**Location:** Task 6 Step 1, lines 470–471

The step says to verify Phase 3/4 rows read "done" and "correct them if they still say 'pending'" — and also says "Do not touch frozen Phase-narrative prose." The §4 status table sits between narrative prose (frozen) and metadata (mutable). The plan's intent is clear (status = mutable), but the boundary is implicit. An explicit statement like "§4 status-table rows are metadata, not narrative prose" would prevent a cautious implementer from skipping the correction.

### [Low] Task 1 Step 2 knip check on empty scaffolding may flag if entry configuration is narrow

**Location:** Task 1 Step 2, lines 136–141

The scaffolder emits `index.ts` (`export {}`) and empty `types.ts`. The plan asserts knip should pass because "both are reachable production entries." This relies on `knip.json`'s `entry`/`project` globs covering `src/features/**`. If Phase 4's knip config is narrow (e.g., `entry: ["src/App.tsx", "src/main.tsx"]` without reaching into features), the empty `export {}` might be flagged as unreachable. The plan provides no fallback beyond "Expected: PASS." A one-line contingency ("If knip flags, verify the entry config covers `src/features/**` — that was a Phase 4 convention") would cover this.

### [Nit] Task 0 Step 2 naming-map check uses substring match

**Location:** Task 0 Step 2, line 53

`grep -q 'market-research' src/features/README.md` matches any occurrence of the string "market-research" in the naming-map README (comments, prose, etc.), not necessarily a formal naming-map entry. If the README format changes (e.g., the name appears in a "not yet implemented" section), the check would pass incorrectly. A more precise check would match the specific naming-map entry format.

### [Nit] Plan self-review section mixes justification with review input

**Location:** "Self-review notes (plan author)" section, lines 540–545

The self-review is useful reviewer context, but its placement at the end of the plan (after the final task) means an executing agent reads it as procedural content. Not functionally harmful, but worth noting as a convention question — some plans in this repo place author notes before Task 0.
