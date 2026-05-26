---
artifact: specs/15-frontend-phase-0-inventory-and-safety-net-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 1
---

## Findings

### [High] CI `setup` job and `playwright` Docker job can't share cache

**Location:** §2.7 (lines 166–208)

The spec describes a `setup` job that does `npm ci` + caching, then a `playwright` job running in `mcr.microsoft.com/playwright:v1.59.1-jammy`. GitHub Actions `actions/cache` paths differ between container and non-container jobs because the `$HOME` and filesystem layout inside the Docker image differ from the Ubuntu runner. The `setup` job's `node_modules` cache won't be usable inside the Playwright Docker container unless artifact passing (or a shared volume strategy) is explicitly configured.

**Suggestion:** Either (a) run both jobs inside the same Docker image so cache paths align, or (b) move `npm ci` into the `playwright` job itself and eliminate the `setup` indirection until Phase 2c needs parallel jobs. Option (b) is simpler for 0a since there's only one active gate.

---

### [High] Proof-of-pipeline smoke test is referenced but never defined

**Location:** §3.2 handler #1 (line 279) and §3.3/§8 companion documents

The spec says the `GET /api/_health` MSW handler is "Used by a smoke test in 0b that asserts MSW is intercepting in jsdom" but no test file for this smoke test appears in the characterization targets (§3.3), the gap journeys (§3.4), or the companion documents list (§8). Without it, the MSW handler set is installed but never verified, which defeats the "proof-of-pipeline" purpose.

**Suggestion:** Add an explicit smoke test file (e.g., `src/lib/__tests__/msw-pipeline.test.ts`) to §3.3 targets or §8 companion list, with a one-line description of what it asserts.

---

### [High] Playwright Docker image version is decoupled from `package.json` with no sync mechanism

**Location:** §2.7 (line 168)

The CI hardcodes `mcr.microsoft.com/playwright:v1.59.1-jammy` while `package.json` has `"@playwright/test": "^1.59.1"`. A caret-range bump (e.g., to 1.60.0) in `package.json` would silently desynchronize the Chromium version in CI from the one used to generate local snapshots. This would cause flaky or failing visual regression with no obvious root cause.

**Suggestion:** Either (a) pin the Playwright version exactly (remove caret) so both `package.json` and the Docker image tag move in lockstep, or (b) extract the version to a single source of truth (e.g., an env var or `.env` file) that both `package.json` and `ci.yml` reference, or (c) add a preflight check in CI that asserts the Docker image Playwright version matches `package.json`. At minimum, call out the coupling in §6 Risks.

---

### [Medium] Three dead-code tools for a one-time baseline snapshot is overspecified

**Location:** §2.2 (lines 70–80)

`knip` is the acknowledged primary source; `ts-prune` and `depcheck` are cross-checks. For a one-time baseline snapshot whose output feeds Phase 1's triage, installing and maintaining three tools — and producing three separate raw output files that Phase 1 must reconcile — adds complexity with diminishing returns. `knip` already covers unused exports, unused files, and unused dependencies. `ts-prune` is largely unmaintained and frequently reports false positives on barrel exports. `depcheck` is also lightly maintained.

**Suggestion:** Run `knip` only for the baseline. If Phase 1 discovers knip-specific blind spots, add `ts-prune` or `depcheck` ad hoc at that point. The Tier-2 annex already has two separate dead-export columns that will mostly agree — reconciliation noise for no actionable gain.

---

### [Medium] Re-baseline workflow is heavy for a single-author repo with zero users

**Location:** §2.6 (lines 147–162) and §2.9 done-when item 6

A full GitHub Actions workflow (`visual-rebaseline.yml`) + a documentation file (`REBASELINE.md`) + a PR-label-driven automation, for a repo with one author and zero users, is ceremony that won't see enough use to justify its maintenance surface. The same outcome is achieved with `npm run test:e2e:update-snapshots` locally + commit, which is what the spec already describes in §2.5 for the initial re-baseline.

**Suggestion:** Drop `visual-rebaseline.yml` and `REBASELINE.md` from Phase 0a. Instead, add a two-line comment in `playwright.config.ts` documenting the re-baseline command. If the team grows or the workflow sees regular use, introduce the automation in Phase 2c alongside the other CI maturation.

---

### [Medium] `rateLimitManager.ts` is not a "pure-function survivor"

**Location:** §3.3 table header (line 289) and `rateLimitManager.ts` row

The table header says "pure-function survivors guaranteed to migrate into `src/shared/lib/` unchanged." But `rateLimitManager.ts` is a stateful singleton that manages a rolling window of request timestamps and a queue. Its characterization tests require `vi.useFakeTimers()` (which the spec correctly prescribes) — exactly because it is *not* a pure function. The categorization is misleading even though the test plan is sound.

**Suggestion:** Rename the table header to "stable utility survivors" or split into "pure-function survivors" (the other 4 files) and "stateful utility survivors" (`rateLimitManager.ts`).

---

### [Medium] No mechanism to handle `knip` false positives in the baseline

**Location:** §2.2 (line 78: "No suppressions — the goal here is to maximize signal")

Running `knip` with zero suppressions against a 75K LOC non-strict-TS codebase with dynamic imports, React lazy loading, barrel exports, and Vite-specific plugin transforms will produce a substantial false-positive rate. The spec's intent ("maximize signal") is correct for the audit, but the Tier-2 annex's simple Y/N dead-export/dead-file flags will present false positives with the same confidence as true positives, making Phase 1's triage harder than necessary.

**Suggestion:** Add a column or mechanism for "knip false-positive confidence" — even a simple triage tag the agent fills in the notes column would help. Alternatively, document the expected false-positive categories (barrel exports, dynamic imports, route configs, HMR entry points) so Phase 1 knows what to expect.

---

### [Medium] §1.3 ESLint config description is slightly inaccurate

**Location:** §1.3 line 29

The spec says "ESLint flat-config v9 with `react-hooks` + `react-refresh` only." The actual `eslint.config.js` extends both `js.configs.recommended` and `tseslint.configs.recommended`, with `@typescript-eslint/no-unused-vars` explicitly turned off. This is more than "react-hooks + react-refresh only" — it includes `@typescript-eslint` recommended rules (minus the disabled one). The spec's characterization understates the existing lint surface.

**Suggestion:** Update to "ESLint flat-config v9 with `js.configs.recommended` + `tseslint.configs.recommended` (most TS rules effectively inert under non-strict config) + `react-hooks` + `react-refresh`." This is more accurate without changing the conclusion (the lint surface is still minimal).

---

### [Medium] §1.5 out-of-scope `src/services/api.ts` vs `src/lib/api.ts` confusion

**Location:** §1.5 line 51

The spec says `src/services/api.ts` disposition is Phase 3. But the three-layer API client that Phase 3 collapses lives at `src/lib/api.ts`, `src/lib/authenticatedApi.ts`, and `src/lib/enhancedApi.ts` — a different path. `src/services/api.ts` is a separate file that the spec doesn't otherwise mention. A reader could conflate the two locations and mis-attribute the Phase 3 scope.

**Suggestion:** Either (a) clarify that `src/services/api.ts` and the `src/lib/api*.ts` trio are separate files, both deferred to Phase 3, or (b) if they're the same concern, list all four paths explicitly.

---

### [Medium] NFR baseline script expected runtime is unstated

**Location:** §2.4 (lines 103–127)

The script runs 3 cold builds + 3 cold `tsc --noEmit` + 3 dev-server starts + 3 Playwright runs, with `rm -rf dist node_modules/.vite` between each build. For a 75K LOC frontend, this is likely 10–20 minutes of wall time. The spec doesn't state the expected runtime, which could surprise the executor.

**Suggestion:** Add a note like "Expected runtime: 10–20 minutes on typical dev hardware. Not a CI step; runs once locally."

---

### [Low] §2.3 Bundle baseline doesn't specify how to extract per-chunk gzip sizes

**Location:** §2.3 (lines 83–99)

The JSON schema includes `gzip_bytes` per chunk, but `vite build` doesn't emit per-chunk gzip sizes by default. Extracting them requires either `rollup-plugin-visualizer`, a post-build script using `gzip-size`, or manual `gzip` calls. The spec doesn't specify the extraction method.

**Suggestion:** Add a one-liner specifying the extraction tool (e.g., "Use `gzip-size` npm package in a post-build script" or "Use Vite's `reportCompressedSize` config + parse the build output"). This is a plan-level detail but it affects the audit file's schema contract.

---

### [Low] Tier-2 annex inbound-ref count via ripgrep will miss dynamic/re-exports

**Location:** §2.1 Tier 2 columns (line 66)

The spec says inbound-ref count is "computed via ripgrep." A ripgrep count for import references will undercount files imported via dynamic `import()`, re-exported through barrel files, referenced in route configs that use lazy loading, or imported via string interpolation. The `dead-file flag` column mitigates this by using `knip` (which handles these cases), but the raw inbound-ref count will be misleading for Phase 1 consumers who might trust it.

**Suggestion:** Rename the column to "static inbound-ref count (rg)" and add a note in the Tier-2 description that this count is a lower bound, not authoritative. The `knip` dead-file flag is the authoritative signal.

---

### [Low] Gap journey coverage rationale is thin

**Location:** §3.4 (lines 312–320)

The spec adds `/customers` and `/settings` gap journeys but doesn't explain why these two routes and not others. The master plan §4 Phase 0 calls for "behavioral E2E coverage of the user-visible journeys the monster files participate in." `/customers` and `/settings` are not monster-file routes (the monsters are MarketResearch, ICPSummaryOpportunity, MissionControl, DataSourcesManager, ICPManager). Existing journeys already cover login/tenant/mission and market-research. The spec should explicitly state the gap analysis: which routes are already covered, which are new, and why these two are the remaining gaps.

**Suggestion:** Add a brief coverage map: "Existing: login, tenant-selection, mission-control, market-research, csv-upload, signals, icp-create. Gap: `/customers`, `/settings`. Routes like `/your-ai-team/scout/:tab` and `/your-ai-team/strategist/:tab` are excluded because [reason]."

---

### [Low] `vitest.config.ts` uses `globals: true` — stylistic concern

**Location:** §3.1 (line 247)

`globals: true` makes `describe`, `it`, `expect` available without imports. Vitest's own documentation recommends explicit imports for TypeScript projects. This is a style choice with no functional impact, but it can cause friction with some editor extensions (e.g., ESLint `no-undef` rule, IDE autocomplete) and diverges from the explicit-import discipline the project targets for agent readability.

**Suggestion:** Consider `globals: false` with explicit imports from `vitest` in each test file. This is consistent with the "agents-as-authors" principle of explicit, machine-readable code. Defer to the plan author's judgment.

---

### [Low] §2.4 `captured_on` and `hardware_note` are free-text placeholders

**Location:** §2.4 (lines 116–117)

The NFR baseline JSON has `"captured_on": "local-dev-machine"` and `"hardware_note": "Author records CPU/RAM/OS..."` as free-text. Without a structured schema (e.g., `"os": "...", "cpu": "...", "ram_gb": ...`), the Phase 2c consumer can't programmatically compare hardware profiles.

**Suggestion:** Define a minimal structured schema for hardware metadata (e.g., `{"os": "Linux 6.x", "cpu": "model string", "ram_gb": 32}`). The current prose hint is sufficient for a plan, but the JSON example should model the actual shape.

---

### [Low] §2.6 Re-baseline workflow step 6 (commit back to PR) needs write permissions

**Location:** §2.6 step 6 (line 159)

Committing refreshed PNGs back to the PR branch requires the workflow's `GITHUB_TOKEN` to have write permissions on the repository. The default `GITHUB_TOKEN` in GitHub Actions has write access for repos in the same org, but this behavior depends on the repo's Actions permissions settings. The spec doesn't mention configuring `permissions: contents: write` in the workflow.

**Suggestion:** Add `permissions: contents: write` to the workflow definition (if retained), or note the permission requirement in the workflow spec.

---

### [Nit] §1.3 Playwright config description conflates `maxDiffPixels` and `maxDiffPixelRatio`

**Location:** §1.3 line 27

The existing config uses `maxDiffPixels: 100` (absolute pixel count). The spec describes the change as moving to `maxDiffPixelRatio: 0.01` (1% of total pixels). These are different units. The spec correctly shows both the old and new configs, but the parenthetical "(was maxDiffPixels: 100)" at line 136 could confuse readers who expect a unit-preserving change. This is cosmetic.

---

### [Nit] Companion documents section (§8) lists `src/lib/__tests__/timestampUtils.test.ts` as a specific file but the characterization table describes 5 target files

**Location:** §8 (line 442)

The companion documents list says "`src/lib/__tests__/timestampUtils.test.ts` and the other characterization test files per §3.3." Using only `timestampUtils` as the example is fine for illustration, but a reader scanning §8 alone won't see the full list without cross-referencing §3.3.

---

### [Nit] Review artifact naming convention in §4 is verbose

**Location:** §4 (lines 367–371)

The review artifact naming uses the full spec filename as a prefix, producing names like `15-frontend-phase-0-inventory-and-safety-net-design-spec-review-<round>.md`. This matches the convention established in earlier reviews and is consistent, but it produces long filenames.

---

### Plan-readiness assessment

The spec decomposes cleanly into two ordered sub-phases (0a then 0b) with explicit done-when checklists. Each sub-phase has a clear deliverable set that maps to testable, reviewable tasks. The main plan-readiness gaps are:

1. **The CI Docker/setup job architecture issue** (High) needs resolution before the 0a plan can specify the correct workflow structure.
2. **The proof-of-pipeline smoke test** (High) needs a defined home before the 0b plan can scope the test files.
3. **The dead-code tooling count** (Medium) should be settled before the 0a plan so the install list is clear.

With those three resolved, the spec is plan-ready.

### Overengineering assessment

Three areas are over-specified for the current project state (single author, zero users, pre-launch MVP):

1. **Three dead-code tools** — `knip` alone suffices for the baseline.
2. **The re-baseline PR-label workflow** — local `--update-snapshots` is sufficient now.
3. **The Tier-2 annex's dual dead-export columns** — one source (`knip`) is authoritative.

The NFR baseline script (3× runs with cold builds) is proportionate to its purpose (Phase 2c budgets). The CI TODO-block scaffolding is well-judged (comments, not executable code). The characterization test target list is well-scoped (5 files, all genuinely stable utilities).
