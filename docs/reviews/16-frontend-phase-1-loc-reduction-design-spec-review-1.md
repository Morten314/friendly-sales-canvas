---
artifact: specs/16-frontend-phase-1-loc-reduction-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 1
---

## Findings

### [High] Preflight chain order and composition is factually wrong in two places

**Location:** §1.3 table row "Preflight chain" (line 44) and §6 Safety net (line 231, line 246–247)

§1.3 states: `npm run preflight` = typecheck + Vitest + Playwright + visual regression + vite build. §6 repeats this ordering.

Actual `package.json`:
```
"preflight": "npm run typecheck && npm run build && npm run test:e2e && npm run test"
```

Two problems: (1) the order is wrong (build runs before e2e/tests, not after), and (2) "visual regression" is not a separate step — it's embedded in Playwright via `toHaveScreenshot`. The spec implies five distinct stages; there are four, with visual regression being a sub-feature of the Playwright stage.

Done-when §5 item 5 repeats the wrong sequence. This is not cosmetic: if a plan author interprets "vite build traps dep removals" as "build runs last," they may add knip before build and produce a preflight script where knip gates on a stale build output.

**Suggestion:** Reconcile with actual `package.json`. Either (a) update the spec to match reality (typecheck → build → Playwright[+visual regression] → Vitest) or (b) if the intended order differs from current, call it out as a Step 7 change to the preflight script.

### [High] `ast-grep` is not a declared dependency and may not be available in CI

**Location:** §3 Step 6a (lines 173–174), §9 decision 11 (line 298)

The spec mandates `ast-grep` for the Step 6a scan. It is not in `package.json` (confirmed via `npx ast-grep --version` resolving at 0.1.0 through npx cache, not a local install). Running it in CI or in a fresh clone will either fail or download an unversioned binary.

**Suggestion:** Add `ast-grep` to `devDependencies` as a Step 2 prerequisite or Step 6a prerequisite, or switch to a tool already available (ripgrep + manual grouping, or a small Node script using the existing `ts-morph` if it's in deps). The spec should state the version pin.

### [High] No acceptance criterion for "how many LOC must actually be removed"

**Location:** §1.1 Goal (lines 17–23), §5 Done-when (lines 225–234)

§1.1 lists qualitative outcomes ("no dead files," "no dead exports," etc.) and §5 checks that each knip finding has a verdict. But there is no quantitative LOC reduction target or minimum. The master spec (§4 Phase 1, line 268–276) also lacks one. The 76,052 starting LOC is stated, but if Step 1's knip refinement causes dead-file count to drop from 32 to 5 (per Risk R2), and the 5 are all `keep`, then Phase 1 could ship with near-zero LOC reduction and still satisfy every done-when criterion.

This is arguably fine — correctness over volume — but it means the spec's stated motivation ("shrinking the codebase before Phase 2a's strict-TS turn-on") could be unsubstantiated in practice. Phase 2a's error-count gate of 1,500 is the downstream victim.

**Suggestion:** Add a minimum LOC delta gate (e.g., "at least X LOC removed or a documented explanation of why the knip baseline was overstated"), or explicitly acknowledge that Phase 1 may be a no-op on LOC and that the real contribution is the knip wiring + dead-code verdict table.

### [Medium] Step 6a's byte-identical detection spec is underspecified

**Location:** §3 Step 6a (lines 173–182)

"Run `ast-grep` with a pattern that matches multi-statement blocks (≥3 statements) and groups by byte-identical content (whitespace-normalized)" is ambiguous:

1. What constitutes a "multi-statement block"? A function body? A JSX expression? A sequence of assignments? Without a structural definition, two different plan executors will scan for different things.
2. "Whitespace-normalized" contradicts "byte-identical." If whitespace is normalized for grouping but the originals differ in whitespace, the extraction in Step 6b must decide which whitespace style wins. This is a minor source of inconsistency.
3. No threshold on block size. A 3-line block duplicated 3 times is trivially extracted; a 50-line block duplicated 3 times is a significant refactor that may deserve its own review. The spec treats both the same.

**Suggestion:** Define "block" concretely (e.g., "contiguous sequence of ≥3 JavaScript statements not interrupted by a control-flow boundary — if/for/while/switch/try — or a JSX return"). Consider a minimum LOC threshold (e.g., ≥5 LOC per block). Clarify whether whitespace normalization is for grouping only (with extraction using one canonical form) or if all occurrences must be literally byte-identical including whitespace.

### [Medium] Step 4's 5-check kit may miss re-exports and barrel-file indirection

**Location:** §3 Step 4 (lines 142–161)

The 5-check kit searches for basename references in imports and plain text. It does not account for:

1. **Barrel-file re-exports** (`index.ts` files that re-export from a dead file). `rg "from '.*<basename>'"` won't match `export { Foo } from './dead-file'` unless the regex also catches `from '.*` in re-export position.
2. **Re-exports via `export * from './dead-file'`** — the basename appears in a position the regex doesn't target.
3. **Dynamic `require()` calls** — the kit checks dynamic `import()` but not CommonJS `require()` (unlikely in a Vite project, but worth noting as an exclusion).
4. **Test files importing from the dead file** — the check only covers `frontend/e2e/**` for fixture references, but Vitest unit tests in `src/**/*.test.{ts,tsx}` or `src/**/*.spec.{ts,tsx}` are not scanned.

Given that the spec mandates per-file commit granularity and reversion is cheap, this is moderate risk. But the check kit should be more rigorous for a spec that calls itself "manual investigation of every remaining dead-file flag."

**Suggestion:** Add check 6: `rg "export.*from.*<basename>"` for re-export detection. Add check 7: scan `src/**/*.test.{ts,tsx}` and `src/**/*.spec.{ts,tsx}` for imports of the target. Or broaden check 1 to use a regex that covers both `import` and `export ... from` forms.

### [Medium] Per-file commit for each npm dep removal (up to 21 commits) is excessive ceremony

**Location:** §3 Step 2 item 5 (lines 130–131)

The spec mandates one commit per unused npm dep (up to 21 commits), justified as "each dep is a discrete bisect target if a transitive resolution surfaces later." But `package.json` + `package-lock.json` changes are trivially bisectable even when batched — `git log -p package.json` shows each dep's line. If a transitive resolution breaks, the culprit is identifiable from the diff without per-commit granularity. The 21 commits also mean 21 preflight runs, each including a full Playwright + visual regression suite.

The backend Phase L precedent was per-file for source deletions, not for manifest edits. Applying the same granularity to a manifest that changes by one line per commit is over-application of a pattern that was designed for a different use case.

**Suggestion:** Batch dep removals into one commit ("remove 21 unused npm dependencies") with the full list in the body. If a transitive issue surfaces, `git bisect` on a single-commit manifest change is equally diagnostic. Alternatively, batch into small groups (e.g., 5 per commit) if per-dep bisection is truly needed.

### [Medium] Scorecard format §4.1 is over-specified for a one-time artifact

**Location:** §4.1 (lines 207–219)

Five subsections (§A–§E) with per-column schemas for a document that will be written once and never updated. §C mandates "row per originally-flagged dead file (all 32 from Step 1's baseline plus any new flags from Step 3's re-baseline)" — this level of prescription is plan-level detail, not spec-level intent. The spec should state *what the scorecard proves* (every finding has a verdict with evidence), not prescribe its exact table layout.

**Suggestion:** Replace the prescriptive subsection schema with a list of required assertions the scorecard must substantiate (e.g., "every knip-flagged file has a remove/keep/defer verdict with evidence"). Leave the exact format to the plan or implementation.

### [Medium] `ts-prune` is mentioned in Step 3 and Step 4 but not in Step 1's tooling setup

**Location:** §3 Step 3 (line 138), Step 4 check 5 (line 149), §2.3 (line 91)

The spec references `ts-prune` output as an input to the investigation process (Step 3: "Re-run knip + ts-prune," Step 4 check 5: "cross-reference ts-prune output"). But `ts-prune` is not in `package.json`, and no step installs or configures it. The master spec §4 Phase 1 (line 263) also mentions `ts-prune` as part of the audit tooling but provides no setup instructions.

If `ts-prune` is informational only (not a gate), the spec should say so. If it's a required input, Step 1 or Step 2 should include its installation and configuration.

**Suggestion:** Either (a) add `ts-prune` installation as a Step 1/Step 2 prerequisite, (b) replace `ts-prune` references with `knip` alone (which already reports unused exports and types), or (c) explicitly mark `ts-prune` as optional cross-reference that produces no gate.

### [Medium] Conservative-posture TD-FE numbering scheme is undefined

**Location:** §2.3 (lines 87–92), §3 Steps 4–5 (lines 161, 169), §8 (lines 276–279)

The spec references `TD-FE-<n>` throughout but never defines the numbering scheme. Is `<n>` a global sequential counter across all phases? A per-phase counter? Does it start from 1 or from the next number after existing `TD-FE-*` entries in `docs/TECH_DEBT.md`? The claim in §3 Step 7 (line 190) that "TD-FE entries are written incrementally during Steps 4 and 5 — in the same commit as the discovery" implies that the number is assigned at write time, but the plan executor needs to know how to pick `<n>`.

**Suggestion:** Add one sentence to §2.3 or §8: "`TD-FE-<n>` numbers are sequential starting from the highest existing `TD-FE-*` entry in `docs/TECH_DEBT.md` plus 1."

### [Low] Dead routes are in scope but have no dedicated step

**Location:** §2.1 (line 68), §3 Steps 1–7 (no explicit dead-route step)

"Dead routes (not reachable from React Router config or nav)" is listed as in scope, but none of the 7 steps explicitly handle route removal. Step 4's route walk (check 4) detects dead files that are route targets, but a dead *route definition* in `App.tsx` that points to an existing file is a different category. If a route is defined but no nav element links to it, is it dead? The spec doesn't say how to detect or handle this case.

**Suggestion:** Either (a) add a sub-step in Step 4 for dead-route detection (walk all React Router `<Route>` definitions and check nav reachability), or (b) explicitly scope dead routes out with a deferral note.

### [Low] Step 1 item 3 ("Fix `scripts/**/*.{ts,sh}`") may be incorrect about knip behavior

**Location:** §3 Step 1 item 3 (line 115)

The spec says to "Fix `scripts/**/*.{ts,sh}` to actually match `frontend/scripts/*.ts` and `*.sh`". But `scripts/**/*.{ts,sh}` is in the `project` array, not `entry`. The `project` array defines which files knip *analyzes for usage*, not which files are entry points. If the intent is to make knip trace imports from scripts, these should be in `entry`. If the intent is to make knip *ignore* or *include* script files in its analysis, the `project` glob is correct but the complaint about "matches nothing" may be wrong — it would match `frontend/scripts/foo.ts` from the `frontend/` working directory.

**Suggestion:** Verify what knip actually reports for this hint. If knip says the `project` pattern matches zero files, the fix path is different from what's described. Clarify whether scripts should be entry points (traced from) or just project files (analyzed for unused exports).

### [Low] §9 decision 1 — single-phase justification is well-argued but creates a very long branch

**Location:** §1.5 (lines 53–54), §3 Steps 1–7 (lines 110–190)

A single branch carrying up to 21 dep-removal commits + ~32 dead-file investigation commits + ~30 export-removal commits + N extraction commits + housekeeping = potentially 90+ commits on `phase-1-loc-reduction` before merge. Even with per-file granularity being the stated convention, this is a large merge to review in one pass. The spec argues against sub-splitting to avoid "two spec-review and two impl-review cycles," but a single 90-commit PR is its own review burden.

**Suggestion:** Not a spec change — just flagging that the plan should define review checkpoints within the single branch (e.g., "after Step 3, before Step 4" as a natural review point where mechanical work is done and investigation begins). The spec need not mandate this, but the plan should consider it.

### [Nit] Spec 13 reference is ambiguous

**Location:** §1.1 (line 25), §2.2 (line 80), §3 Step 6 (line 182), §8 (lines 276–278)

Multiple references to "Phase 13" for near-identical dedup work. Phase 13 is not described in this spec and presumably lives in the master spec (Spec 14). For a reader who starts with this spec, the Phase 13 references are opaque. A brief parenthetical ("Phase 13: post-modularization LOC audit, see master spec §4") on first reference would help.

### [Nit] §1.3 table says "Suspect monster flag" for ICPSummaryOpportunity.tsx at 6,925 LOC

**Location:** §1.3 table row "Suspect monster flag" (line 42)

Confirmed the file is indeed 6,925 LOC. Not a finding — just noting the claim is verified correct.

### [Nit] §10 references CLAUDE.md and AGENTS.md interchangeably

**Location:** §10 last bullet (line 309)

"CLAUDE.md — frontend topology and gotchas referenced throughout." The project's primary agent context file is `AGENTS.md` (per env info). `CLAUDE.md` is the legacy name. Not functionally important but could confuse a reader looking for a file named `CLAUDE.md`.
