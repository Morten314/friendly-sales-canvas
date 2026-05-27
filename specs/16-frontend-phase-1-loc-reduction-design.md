# Spec 16 — Frontend Phase 1: LOC Reduction Pass #1 (Pre-Foundation)

**Status:** Design — round 3 verdict clean (round 1 review + synthesis at `docs/reviews/16-frontend-phase-1-loc-reduction-design-spec-review-1.md` + `-synthesis-1.md`; round 2 at `…-review-2.md` + `-synthesis-2.md`; round 3 at `…-review-3.md` + `-synthesis-3.md`). Plan-ready per round-3 reviewer's assessment.
**Date:** 2026-05-27 (rounds 1–3 with post-synthesis revisions)
**Type:** Phase spec (single phase, no sub-split)
**Paired plan:** `plans/16-frontend-phase-1-loc-reduction.md` (not yet written)
**Parent:** `specs/14-frontend-refactoring-master-plan-design.md` (§4 Phase 1)

---

## §1 Goal and context

### 1.1 Goal

Shrink the frontend codebase before Phase 2a's strict-TS turn-on by applying backend Phase L's audit-execute methodology to `frontend/src/`. After Phase 1 merges, the tree that Phase 2a inherits has:

- No knip-confirmed dead files, dead exports, dead exported types, dead npm deps
- No Lovable build artifacts (`lovable-tagger`, README boilerplate, `_restore_test.txt`)
- No unresolved imports
- No exact-duplicate components or duplicate default exports
- Byte-identical inline-data-munging blocks (≥3 occurrences) extracted to helpers in `src/lib/`
- A refined `knip.json` with zero configuration hints
- `knip --strict --no-progress` wired into `npm run preflight` as a merge gate

Phase 1's primary contributions are (a) the `knip --strict` wire-in, (b) the verdict table for every dead-code flag, and (c) whatever LOC reduction follows safely from those — without a minimum LOC target, per master spec §6 item 8 ("Final LOC reflects what was safely removable without behavior change — no hard target"). The motivation in §1.2 frames the *direction* of the contribution; the *volume* emerges from the audit.

Near-identical and pattern-extraction work is deferred to Phase 13 (post-modularization LOC audit — see Spec 14 §4 Phase 13) where strict types and feature folders make the refactor safer.

### 1.2 Why now

Master spec §4 places Phase 1 second because Phase 2a's strict-TS error storm scales with surface area. Removing 32 dead files + 62 dead exports + 16 dead types + 20 dead deps before flipping `strict: true` shrinks the error count Phase 2a must resolve. Master spec §5.3 also names Phase 1 as the phase that wires `knip --strict` into preflight — that gate is meaningful only after Phase 1's cleanup pass.

### 1.3 Starting state (Phase 1 anchor)

| Aspect | State as of Phase 0b merge (2026-05-27) |
|---|---|
| Source LOC | 76,052 across 158 `.ts`/`.tsx` files under `frontend/src/` |
| Knip baseline | `docs/audits/2026-05-26-frontend-deadcode-knip.json` / `.txt` |
| Knip findings | 32 dead files · 20 unused deps · 1 unused devDep · 62 unused exports · 16 unused exported types · 1 duplicate export (`SuggestedICPCards|default`) · 2 unresolved imports |
| Unresolved imports | `./pages/AgentHub` in `src/App.tsx:21:23`; `@/components/market-research/MarketRankings` in `src/pages/MarketResearch.tsx:58:33` |
| Knip config hints | 8 (redundant entry patterns for `src/main.tsx`, `vite.config.ts`, `playwright.config.ts`; `dev-dist/**`, `node_modules/**`, `dist/**` to remove from ignore; `scripts/**/*.{ts,sh}` matches nothing; root config needs entry refinement) |
| Lovable artifacts | `lovable-tagger` in `vite.config.ts:4` + `package.json:96`; `src/pages/_restore_test.txt` present; Lovable README boilerplate in `frontend/README.md` |
| Confirmed vestige | `src/components/market-research/LeadStream.tsx` is empty (0 LOC); real implementation at `src/components/customers/LeadStream.tsx` (432 LOC) — Phase 0a annotation |
| Monster dead-file | `src/components/customers/ICPSummaryOpportunity.tsx` (6,925 LOC) flagged by knip as a dead file. Round 2 review verification: zero inbound references from `src/` or `e2e/` (`grep -rn 'ICPSummaryOpportunity' src/ e2e/` returns only self-references). Codebase has zero `React.lazy()` and zero plain `lazy()` calls. ICPSummaryOpportunity is genuinely dead, not a false positive — Step 4's 6-check kit is expected to confirm `remove`. Removal also unblocks the import chain it sits on (see §3 Step 4 topological-ordering note) |
| Safety net | Phase 0b: Vitest+RTL+MSW harness; characterization tests on `cn`, `sanitizeAnswerText`, `rateLimitManager`, `marketScoresHeatmap`, `marketScoreDescriptions`, `timestampUtils`; Playwright behavioral journeys including `/customers` and `/settings` gap tests; visual regression at `maxDiffPixelRatio 0.01` |
| Preflight chain | `npm run preflight` = `typecheck → vite build → test:e2e (Playwright incl. visual regression via toHaveScreenshot) → test (Vitest)`. Order verified from `frontend/package.json`: `"preflight": "npm run typecheck && npm run build && npm run test:e2e && npm run test"`. Lint deferred to Phase 2b. `knip --strict` appended at end of chain in this phase's Step 7. |

### 1.4 Numbering and branch

- Spec: `specs/16-frontend-phase-1-loc-reduction-design.md` (this file)
- Plan: `plans/16-frontend-phase-1-loc-reduction.md` (written after spec review converges)
- Branch: `phase-1-loc-reduction` off `master`

### 1.5 Why single phase (no sub-split)

Master spec §4 Phase 1 does not document a sub-split trigger. The chosen Approach C sequencing (§3) front-loads mechanical wins and ships them in early commits, so the shape of "1a-style fast wins + 1b-style heavier investigation" lives *inside* a single branch as commit clusters rather than as separate phases. This preserves bisect granularity (per-file commits per §3) while avoiding the ceremony of two spec-review and two impl-review cycles for what is one cohesive audit-execute pass.

---

## §2 Scope

### 2.1 In scope

From master spec §4 Phase 1 (lines 268–277), with the brainstorm refinements:

- Dead imports (pure unused symbols)
- Dead exports (62 flagged) and dead exported types (16 flagged)
- Dead files (32 flagged) — **all 32 receive manual investigation per Step 4 regardless of size**
- Dead npm deps (20 + 1 devDep flagged)
- Dead routes (not reachable from React Router config or nav)
- Exact-duplicate components (byte-identical or trivially-different), including the `SuggestedICPCards|default` duplicate export
- Lovable artifacts: `lovable-tagger` removal from `vite.config.ts` + `package.json`; Lovable README boilerplate
- `src/pages/_restore_test.txt`
- Unresolved imports (`./pages/AgentHub`, `@/components/market-research/MarketRankings`)
- **Byte-identical** inline-data-munging blocks appearing ≥3 times (near-identical defers to Phase 13)
- Knip configuration cleanup (8 hints → 0) and `knip --strict --no-progress` wiring into preflight

### 2.2 Out of scope (deferred)

- **Behavior changes** — every commit must be pixel-identical and behaviorally identical (Playwright + visual regression enforced)
- **Type signature changes** — Phase 2a's domain
- **Near-identical components / hooks / patterns** — Phase 13
- **Cross-feature dedup requiring code to move into `src/shared/`** — Phase 11
- **`src/components/ui/` shadcn primitive consolidation** — locked from Phase 4 onward; any unused shadcn primitives flagged by knip log as `TD-FE-<n>` and stay in place
- **File reorganization** — loose `src/components/*` files (MiniLineChart, MiniPieChart, PWAInstallPrompt, ProtectedRoute) stay put until their owning feature's extraction phase

### 2.3 Posture rules

**Investigate posture is hybrid:**

- **Aggressive removal** for items bound to a single feature area (`components/market-research/`, `components/customers/`, `components/mission-control/`, `components/signals/`, `components/strategist/`, `components/settings/`, `components/layout/`, `pages/`)
- **Conservative defer (TD-FE-<n>)** for items under `src/lib/`, `src/hooks/`, `src/utils/`, `src/contexts/` where blast radius is broader and Phase 0b characterization coverage is narrower (6 utilities covered, not the full surface)

**Removal threshold for both postures:** zero references anywhere in `src/` after the §3 Step 4 check kit completes. Any non-zero hit → **keep** with the inbound documented. Any uncertainty about the search exhausting the surface (string-built import paths, conditional require) → **TD-FE-<n>** under conservative posture, **investigate further** under aggressive posture.

**TD-FE numbering convention.** `TD-FE-<n>` numbers are sequential, starting from `max(existing TD-FE-* in docs/TECH_DEBT.md) + 1`. As of 2026-05-27, no `TD-FE-*` entries exist in `docs/TECH_DEBT.md`, so Phase 1's first deferral will be `TD-FE-1`. The plan executor reads the current max before each deferral commit.

**Test-only-import verdict.** Exports referenced only from Vitest test files (`src/**/__tests__/**` and `src/**/*.{test,spec}.{ts,tsx}`) are `keep — test-only import` in the scorecard, not `defer TD-FE`. Step 1 item 6 adds Vitest tests to knip's `entry` array so this pattern should rarely appear in Step 5's input post-config-refinement; if it does (e.g., a test imports an internal helper not yet covered by the entry expansion), the scorecard records the test-side inbound and the export stays.

### 2.4 Frozen interfaces

These do not change as a result of Phase 1:

- HTTP API contract with the backend
- Routes (URL paths frozen per master spec §2.3)
- Auth flow
- Existing Playwright suite behavior (suite may be augmented if a removal exposes a behavioral gap, but existing tests must remain green)
- Visual snapshots — no re-baselining allowed during Phase 1; if a snapshot fails, the change is reverted

---

## §3 Methodology — Approach C (mechanical-first, investigation-heavy)

Seven concrete steps inside a single phase. Per-file commits within each step (backend Phase L style). Preflight green between every commit.

### Step 1 — Knip config refinement (one commit cluster)

Resolve the 8 configuration hints in `frontend/knip.json`:

1. Remove `dev-dist/**`, `node_modules/**`, `dist/**` from ignore (already in `.gitignore`)
2. Drop redundant entry patterns for `src/main.tsx`, `vite.config.ts`, `playwright.config.ts` (knip auto-detects)
3. Resolve the `scripts/**/*.{ts,sh}` — no matches hint per knip docs. Plan picks the fix: (a) move TS scripts to `entry` to trace from them, (b) restrict the `project` glob to `frontend/scripts/*.ts` and drop `.sh` since knip doesn't analyze shell, or (c) drop the pattern entirely if no scripts need analysis. Spec states intent; plan picks the path.
4. **Verify** whether `React.lazy()` / `lazy()` route loaders exist in `frontend/src/`. Round 2 review verified zero matches as of 2026-05-27, so this item is a verification step, not a config addition. If verification confirms zero matches, document in scorecard ("no lazy route loaders present") and skip. If new matches appear since Phase 0b (unlikely), add corresponding entry patterns.
5. Verify `e2e/**/*.spec.ts` entry pattern still covers Playwright spec discovery
6. **Add Vitest test files as entry points** — append `src/**/__tests__/**/*.test.{ts,tsx}` and `src/**/*.{test,spec}.{ts,tsx}` to the knip `entry` array. Phase 0b characterization tests import `rateLimitManager` etc. via dynamic `import()`; without these entries, knip flags test-only exports as unused. Re-run knip after this change and compare against the baseline before this commit; any newly-revealed unused exports get the standard Step 5 treatment.

Then re-run `knip` and commit the new baseline to `docs/audits/<merge-date>-frontend-deadcode-knip-refined.json` + `.txt`. **This becomes the authoritative dead-code list for Steps 2–6.** Step 1 ships as 1–2 commits: one for the config edit, optionally one for the re-baseline artifact.

### Step 2 — Mechanical wins (per-file commits, fast batch)

Each its own commit, in order:

1. `chore(fe): remove lovable-tagger from vite.config.ts and package.json` — also remove Lovable README boilerplate from `frontend/README.md` in the same commit (single conceptual change spanning 2–3 files)
2. `chore(fe): delete src/pages/_restore_test.txt`
3. `fix(fe): remove unresolved import ./pages/AgentHub from App.tsx`
4. `fix(fe): remove unresolved import @/components/market-research/MarketRankings from MarketResearch.tsx`
5. **One commit removing all 20 unused deps + 1 unused devDep.** Per-file granularity means one file (`package.json` + lockfile) = one commit. Subject: `chore(fe): remove 21 unused npm dependencies`. Body lists each dep with its name and the line it was removed from. If a transitive resolution failure surfaces, `git revert` operates on the single commit and the diff identifies the culprit line. (Backend Phase L's per-file rule applied to source deletions, not to manifest edits — see §9 decision 5.)
6. `chore(fe): delete src/components/market-research/LeadStream.tsx (empty vestige)`
7. `refactor(fe): remove unused default export from SuggestedICPCards.tsx` — file has `export const SuggestedICPCards` (line 915, consumed by `ICPIntelligence.tsx`) and `export default SuggestedICPCards` (line 2280, unused). Delete the default-export line; the named export stays.

Preflight green between every commit. `vite build` traps any transitive-resolution failure on dep removals.

### Step 3 — Mid-phase knip re-run (one commit)

Re-run `knip` against the post-Step-2 tree. (Per Spec 15 §2.2, knip is the only dead-code tool installed; ts-prune is explicitly excluded.) Output replaces Step 1's baseline at `docs/audits/<date>-frontend-deadcode-knip-mid-phase.json` + `.txt`. The mechanical batch removes ~half the original noise (Lovable, duplicates, broken imports), so the remaining dead-file flags are higher-signal candidates for manual investigation. Step 4 works against this refined list.

### Step 4 — Manual investigation of every remaining dead-file flag (per-file commits)

For each dead-file flag from Step 3's re-baseline, the agent runs the **6-check kit**:

1. `rg "from ['\"].*<basename>['\"]"` — static imports
2. `rg "import\\(.*<basename>"` — dynamic imports
3. `rg "export.*from.*['\"].*<basename>['\"]"` — re-exports (catches both `export { X } from './file'` and `export * from './file'`)
4. `rg "<basename>"` plain-text — string-interpolated routes, fixture references, conditional registration
5. Walk `frontend/src/App.tsx` route table → is the file behind any route, lazy or eager?
6. Check `frontend/e2e/**` AND `frontend/src/**/__tests__/**` AND `frontend/src/**/*.{test,spec}.{ts,tsx}` for imports of the target

Each removal commit has its **6-line structured check-kit block** in the body (plus the `Checks:` header):

```
Checks:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none
```

Values are either integers (counts of matches found) or `none`/path (route-walk, test-imports). Non-zero / non-`none` on any check → either **keep** (annotate the scorecard with the inbound) or **defer** to `TD-FE-<n>` (conservative posture; uncertainty remains). Commit subject: `chore(fe): remove dead file <path>`.

**Removal order (topological).** When Step 3's re-baseline contains dead files that import other dead files, remove **importers before imports** (reverse-dependency order). The plan executor builds a dependency graph from the dead-file list — nodes with no inbound dead-file dependencies (no dead file imports them) go first; nodes that many dead files import go last. Verified example as of 2026-05-27: the import chain `ICPSummaryOpportunity → enhancedApi`, `RateLimitStatus → enhancedApi`, `authenticatedApi → enhancedApi`, `useAuthenticatedApi → authenticatedApi` exists among knip-flagged dead files. Removal order: `ICPSummaryOpportunity` and `RateLimitStatus` first (no dead-file imports point to them) → `useAuthenticatedApi` → `authenticatedApi` → `enhancedApi` last (the most depended-on node in the dead-file subgraph). This avoids transient typecheck failures between commits where a still-present file imports an already-removed dependency.

**Orphan route detection (Step 4 sub-pass).** After investigating each dead-file flag, walk every `<Route>` definition in `frontend/src/App.tsx` and check reachability from sidebar nav (`frontend/src/components/layout/Sidebar.tsx`). Any `<Route>` path with no nav element pointing to it is a candidate for removal — same §2.3 posture rules apply (aggressive for feature-bound paths, conservative for auth/tenant/settings/protected-route wrappers). Each orphan removal is its own commit with subject `chore(fe): remove orphan route <path>` and a body explaining which nav surface was checked and found empty.

**For `src/components/customers/ICPSummaryOpportunity.tsx` specifically:** Round 2 review verified zero inbound references from `src/` or `e2e/` and zero `lazy()` calls in the codebase. The 6-check kit is expected to return all-zero, leading to a straightforward `remove` verdict. The file's 6,925 LOC removal is one of the larger single-commit wins of Step 4. No special handling — apply the standard kit. (If the kit unexpectedly finds an inbound — e.g., from a string match somewhere outside `src/` and `e2e/` — apply the standard `keep` path and document.)

### Step 5 — Dead exports and dead exported types (per-file commits)

For each file containing knip-flagged unused exports/types from Step 3's re-baseline, one commit removes the unused symbols. Subject: `chore(fe): remove unused exports from <file>`. Concentrated across ~30 source files → ~30 commits. Each commit's body lists the symbol names removed.

Conservative-path files (under `lib/`, `hooks/`, `utils/`, `contexts/`) follow the §2.3 posture: zero refs across the 6 checks from §3 Step 4 (applied per-symbol against the symbol name rather than the file basename) → remove; otherwise → TD-FE.

### Step 6 — Byte-identical inline-data-munging extractions (per-helper commits)

**Step 6a-prep — Install a code-duplication detector.** Round 2 review verified that `ast-grep` (a structural AST pattern matcher) cannot natively produce content-hash groups of byte-identical blocks across files. The spec is **tool-agnostic at this layer** — it states what the scan must produce, the plan picks the tool. Reasonable choices: (a) `jscpd` — purpose-built code-duplication detector, npm-available, configurable minimum tokens/lines; (b) a custom Node script using the `typescript` compiler API to walk the AST, extract candidate blocks per the §3 Step 6a block definition, and group by hash; (c) `ts-morph` for typed AST traversal in a hand-written script. First commit of Step 6: `chore(fe): add <chosen-tool> as devDep for inline-block scan`, pinned to a specific version.

**Step 6a — Scan.** Run the chosen detector against `frontend/src/**/*.{ts,tsx}`. **Block definition:** a contiguous sequence of ≥3 JavaScript statements at the same AST nesting level relative to the immediate function or component scope (different functions at depth 1 do not match each other), not interrupted by a control-flow boundary (`if`/`for`/`while`/`switch`/`try`/`catch`/`finally`) or a JSX return statement. **Self-containment requirement:** a block qualifies for Step 6a only if it contains **no references to variables declared outside the block** — i.e., the block is mechanically extractable into a parameterless helper without parameterization. Blocks that reference outer-scope variables fall outside Step 6 entirely and are flagged as Phase 13 candidates (where strict types and feature folders make parameterization analysis tractable). **Comparison rule:** content is compared whitespace-normalized (collapse runs of whitespace to a single space; drop trailing whitespace before line terminators). **Extraction canonicalization:** when a group of ≥3 byte-identical-after-normalization blocks is extracted in Step 6b, the helper adopts the *first occurrence's* whitespace style as the canonical form. **Output schema:**

```json
{
  "groups": [
    {
      "hash": "<sha256 of normalized content>",
      "block": "<normalized content (first occurrence)>",
      "occurrences": [
        { "file": "src/...", "line": N, "end_line": M }
      ]
    }
  ]
}
```

(Hash algorithm: SHA-256 — deterministic; plan may swap if needed.) Commit the scan output to `docs/audits/<date>-frontend-inline-block-scan.json`. The self-containment restriction is strict enough that Step 6a may return an empty `groups` array — acceptable per §7 R3.

**Step 6b — Extract.** For each pattern that passes byte-identical check, one commit:

1. Create or extend a helper module under `src/lib/<helper>.ts` (Phase 4 will move these to `src/shared/lib/` per its promotion criteria — see §8)
2. Export a function or constant containing the extracted block
3. Replace all ≥3 call sites with the helper invocation
4. Commit subject: `refactor(fe): extract <helper-name> from N call sites`

Near-identical patterns (1+ literal differs across occurrences) are recorded in the Step 6a scan output as Phase 13 candidates and not extracted. If Step 6a finds zero byte-identical triplicates, Step 6 produces zero extraction commits — that's acceptable.

### Step 7 — Final scorecard, LOC delta, `knip --strict` wire-in (final commits)

1. **Scorecard.** Generate `docs/audits/<merge-date>-frontend-loc-pass-1.md` with §4's format
2. **Preflight wire-in.** Append `npx knip --strict --no-progress` to the `preflight` script in `frontend/package.json` only. `frontend/scripts/preflight.sh` is a wrapper that calls `npm run preflight` (verified at its line containing `npm run preflight`), so editing both files would duplicate the knip run. Verify `npm run preflight` green end-to-end after the package.json edit
3. **Master-spec status update.** The merge commit to `master` updates Spec 14's §4 status table (Phase 1 row: `pending` → `done`, merge date filled in)

**Note on TD-FE entries:** `TD-FE-<n>` entries in `docs/TECH_DEBT.md` are written *incrementally during* Steps 4 and 5 — in the same commit as the discovery that produced them — so commit messages can reference the entry by its real number without a forward reference. Step 7 does not batch-write TD-FE entries.

---

## §4 Deliverables

- **`docs/audits/<merge-date>-frontend-loc-pass-1.md`** — Phase-1-specific delta-and-verdict scorecard, format detailed in §4.1
- **`docs/audits/<merge-date>-frontend-deadcode-knip-refined.json`** + `.txt` — Step 1 re-baseline (authoritative dead-code source for Steps 2–6)
- **`docs/audits/<merge-date>-frontend-deadcode-knip-mid-phase.json`** + `.txt` — Step 3 re-baseline (authoritative input for Step 4)
- **`docs/audits/<merge-date>-frontend-inline-block-scan.json`** — Step 6a scan output, even if empty
- **`frontend/knip.json`** — refined config, 0 hints
- **`frontend/package.json`** — `knip --strict --no-progress` appended to the `preflight` script (the only file needing this change; `preflight.sh` delegates via `npm run preflight` and needs no edit)
- **`docs/TECH_DEBT.md`** — `TD-FE-<n>` entries for every deferral
- **`frontend/src/lib/<helper>.ts`** — zero or more new helper modules from Step 6b
- **Source-tree edits** — files deleted, exports trimmed, deps uninstalled, Lovable artifacts gone, unresolved imports fixed
- **`specs/14-frontend-refactoring-master-plan-design.md`** — Phase 1 row in §4 status table updated to `done` at merge

### 4.1 Scorecard content requirements

Phase-1-specific delta-and-verdict shape (chosen over reusing Phase 0a's Tier-1/Tier-2 baseline because Phase 1 records *what was done*, not *what exists*). The scorecard must substantiate the following assertions; the exact table layout and section ordering are plan-stage detail:

1. **LOC delta** — by feature area and overall total. Reader can answer "how much did Phase 1 remove, and from where?"
2. **Per-category execution log** — for each in-scope category (deps, Lovable artifacts, unresolved imports, dead files, dead exports, dead types, duplicates, orphan routes, byte-identical extractions): what was removed, what was kept (with reason), what was deferred (with TD-FE-<n>). Each entry links to the commit SHA that executed it.
3. **Per-file verdict for every originally-flagged dead file** — covers all 32 from Step 1's baseline plus any new flags from Step 3's re-baseline. Each row: path, original LOC, verdict (`remove` / `keep` / `defer-TD-FE-<n>`), evidence (commit SHA for remove, inbound reference for keep, TD-FE link for defer).
4. **Phase 13 handoff list** — near-identical patterns from Step 6a's scan that did not pass byte-identical extraction, plus any `keep with reason` rows whose reason was "uncertain without strict TS / feature folders".
5. **Knip config delta** — before/after hint count and a short description per hint resolved.

The plan author may add additional sections or restructure as long as all five assertions are visibly substantiated.

---

## §5 Done-when

Phase 1 is complete and ready to merge when **all** hold on `phase-1-loc-reduction`:

1. Final scorecard `docs/audits/<merge-date>-frontend-loc-pass-1.md` committed and covers every category from §4.1
2. Every `execute` finding from Step 1's baseline and Step 3's re-baseline is either applied (`remove`) or documented (`keep` with inbound / `defer` to TD-FE)
3. Knip config has zero hints (verifiable by running `knip` and observing zero "Configuration hints" section output)
4. `knip --strict --no-progress` appended to the `preflight` script in `frontend/package.json` (only — `preflight.sh` delegates)
5. `npm run preflight` green end-to-end in the actual order: `typecheck → vite build → test:e2e (Playwright, incl. visual regression) → test (Vitest) → knip --strict --no-progress`
6. All 32 originally-flagged dead-file flags have a documented verdict in scorecard assertion 3 (per-file verdict table) with evidence
7. `TD-FE-<n>` entries written to `docs/TECH_DEBT.md` for every deferral, each linking back to the scorecard row
8. Spec 14 §4 status table row for Phase 1 updated to `done` with merge date in the merge commit message

---

## §6 Safety net

The Phase 0b safety net carries unchanged into Phase 1 and acts as the per-commit gate. `npm run preflight` runs the checks in the order they appear in `frontend/package.json`:

1. **`tsc --noEmit`** under the current non-strict config — green at every commit
2. **`vite build`** — succeeds at every commit (key gate for dep removals in Step 2; runs before Playwright so e2e tests against the built artifact stay consistent)
3. **Playwright** (`npm run test:e2e`) behavioral journeys including `/customers` and `/settings` gap tests, with **visual regression assertions via `toHaveScreenshot` at `maxDiffPixelRatio 0.01`** baked into the same stage — green at every commit. No re-baselining permitted during Phase 1
4. **Vitest** (`npm run test`) characterization tests on `cn`, `sanitizeAnswerText`, `rateLimitManager`, `marketScoresHeatmap`, `marketScoreDescriptions`, `timestampUtils` — green at every commit
5. **Knip in non-strict mode (informational only)** runs as commits land; `--strict` only turns on in Step 7's final commit and becomes the merge gate

If a commit during Steps 2/4/5/6 turns preflight red, the master spec §5.7 abort-and-revert protocol applies: revert the commit, log the discovery as `TD-FE-<n>`, replan if the failure points to deeper design issues.

---

## §7 Risks and mitigations

**R1 — Knip false positive on a monster file (e.g., `ICPSummaryOpportunity.tsx`).** *Mitigation:* §3 Step 4's 6-check kit catches static/dynamic imports, re-exports, string-interpolated refs, route registration, and test-side imports. Round 2 verification narrowed the false-positive surface for this codebase to **string-interpolated paths only** (no `React.lazy()` / `lazy()` exists), so the 6-check kit's static + dynamic + plain-text scans cover all known indirection patterns. Per-file commit granularity makes a wrong removal a surgical revert. Safety net's Playwright behavioral journeys cover route-bound monsters.

**R2 — Step 1 knip refinement reveals hidden entry points, dead-file count drops sharply.** *Mitigation:* this is a feature. Scorecard documents the before/after counts; Phase 1's LOC delta is whatever was safely removable. Smaller delta is acceptable as long as it's correct.

**R3 — Step 6a finds no byte-identical triplicates.** *Mitigation:* acceptable per §3 Step 6 — zero extraction commits, scorecard records "no byte-identical patterns above threshold; N near-identical patterns logged for Phase 13."

**R4 — Removing a "dead" dep breaks Vite build via transitive resolution.** *Mitigation:* per-file dep removal commits + `vite build` in preflight = surgical bisect target. Revert; log dep as `keep with reason` in scorecard.

**R5 — `knip --strict` fails on Step 7's final commit.** *Mitigation:* Steps 2–6 already work toward a `--strict`-green state (knip runs non-strict between commits as a leading indicator). Step 7's switch is the gate, not a discovery moment. If it does fail, resolve in a follow-on commit on the same branch or revert the switch and log the residual as `TD-FE-<n>`.

**R6 — Investigation cost runs over.** *Mitigation:* no time budget; master spec §5.7 covers ≥2× scope overrun. The scorecard records bottleneck categories explicitly so Phase 13 can pick them up.

**R7 — `App.tsx` route walk misses a lazy registration pattern.** *Mitigation:* §3 Step 4 includes plain-text ripgrep on the basename across all of `src/` plus an `e2e/**` fixture scan. The route walk is one of five checks, not the only check. Any non-zero hit on any of the five → `keep` or `defer`.

---

## §8 Deferrals and handoffs

- **Phase 2a (strict TS)** — receives the post-Phase-1 simplified tree as its working surface. No direct artifacts handed off; the LOC delta is the contribution
- **Phase 4 (feature scaffolding)** — `src/lib/<helper>.ts` modules created in Step 6b will move to `src/shared/lib/` once Phase 11's promotion criteria are documented (Phase 4 spec) and Phase 11 applies them. Phase 1 leaves them at `src/lib/` as a deliberate temporary home
- **Phase 11 (shared utility extraction)** — receives the Step 6b helper list as Phase 11 candidates
- **Phase 13 (LOC reduction pass #2)** — receives:
  - Near-identical inline-data-munging patterns from Step 6a's scan output
  - `keep with reason` scorecard rows where the reason was "uncertain without strict TS context"
  - Any `TD-FE-<n>` entries originating in Phase 1's conservative-defer paths
- **`src/components/ui/` shadcn primitives** — unused primitives flagged by knip remain in place (Phase 4 locks the directory). Logged as `TD-FE-<n>` if worth tracking; otherwise scorecard records the count and moves on

---

## §9 Resolved decisions (from brainstorm 2026-05-27)

These were ambiguous in master spec §4 Phase 1 and resolved during the spec's brainstorm cycle:

1. **Phase shape:** single Phase 1 (no sub-split). Approach C sequencing puts the "1a-style" mechanical wins as early commits inside one branch
2. **Knip config cleanup:** inside Phase 1 (Step 1), not deferred to Phase 2c. Phase 1's primary input is knip output, so trust matters
3. **Investigate posture:** hybrid — aggressive for feature-bound code, conservative (TD-FE) for `lib/`/`hooks/`/`utils/`/`contexts/`
4. **Inline-data-munging dedup scope:** byte-identical only (Step 6); near-identical defers to Phase 13
5. **Commit granularity:** per-file (backend Phase L style) — applied to source-file deletions and export trims. Manifest changes (`package.json` + lockfile) batch into a single commit per category since the file count is one (see §3 Step 2 item 5 for the dep-removal application of this rule).
6. **Knip false-positive rigor:** manual investigation for every dead-file flag regardless of size (all 32 + any new flags from Step 3 re-baseline)
7. **Sequencing approach:** Approach C — mechanical-first then investigation-heavy. Two knip runs (Step 1 + Step 3) so manual investigation works against the cleaner re-baseline
8. **Removal threshold under conservative posture:** zero references anywhere in `src/` after the 6-check kit. Non-zero hit → `keep`; uncertainty → `TD-FE-<n>`. TD-FE numbering: sequential from `max(existing) + 1` (see §2.3).
9. **Commit message format for Step 4:** structured 6-line check-kit block (`Checks:` header followed by indented `rg-basename`, `rg-dynamic-import`, `rg-reexport`, `rg-plain-text`, `route-walk`, `test-imports` lines — exact format in §3 Step 4)
10. **Knip flags in preflight:** `knip --strict --no-progress` (no `--strict-production` — avoids false negatives on MSW/Vitest devDeps)
11. **Step 6a tool — tool-agnostic at the spec level.** Round 2 review verified ast-grep is a structural pattern-matcher, not a code-duplication detector. Spec states what the scan must produce (content-hash groups of byte-identical-after-normalization blocks, JSON schema in §3 Step 6a); plan picks the implementation. Reasonable choices: `jscpd` (purpose-built), a custom Node script using the TypeScript compiler API, or `ts-morph` for typed AST traversal
12. **Scorecard format:** Phase-1-specific delta-and-verdict layout (§4.1), not a reused Phase 0 baseline snapshot

---

## §10 Companion documents

- **Parent:** `specs/14-frontend-refactoring-master-plan-design.md` — §4 Phase 1 is the upstream definition
- **Preceding phase:** `specs/15-frontend-phase-0-inventory-and-safety-net-design.md` + `plans/15a-frontend-phase-0a-inventory.md` + `plans/15b-frontend-phase-0b-test-harness.md` — produced the safety net Phase 1 relies on
- **Backend precedent:** `specs/12-backend-loc-and-docstring-audit-phase-l-design.md` + `plans/12-backend-loc-and-docstring-audit-phase-l.md` — the audit-execute pattern adapted here
- **Cross-cutting:** `docs/TECH_DEBT.md` — receives `TD-FE-<n>` entries
- **CLAUDE.md / AGENTS.md** — frontend topology and gotchas referenced throughout (both files at repo root; e.g., `MarketResearch_clean.tsx`, `Safe*` wrappers, `sessionStorage.strategistContext`)
