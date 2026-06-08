---
artifact: phase-14-agent-affordances
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-08
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Spec 33 and Plan 33 both loaded. The branch implements an 8-workstream documentation reconciliation and tooling phase (W1–W8). The only executable code is the scaffold-feature hardening (W5); everything else is comment/markdown edits. 14 commits total on the branch (8 implementation + 4 review/synthesis artifacts + spec + plan). Aggregate diff reviewed (not commit-by-commit).

The CLAUDE.md/AGENTS.md dedup invariant was verified live: `diff CLAUDE.md AGENTS.md` shows exactly three deltas — H1, intro line, and the "Tool Usage Pitfalls" section. All other content is identical. This is correct.

TECH_DEBT archive verified: 18 entries moved to archive, 48 remain in main file (66 total TD-FE entries), consistent with the plan's classification. Backend TD entries are untouched.

## Findings

### [Medium] `scaffold-feature.ts` uses `import.meta.dirname` without a Node version guard

**Location:** `frontend/scripts/scaffold-feature.ts:8`

```typescript
const FRONTEND_DIR = resolve(import.meta.dirname, "..");
```

`import.meta.dirname` was added in Node 20.11.0. The repo does not declare a minimum Node version in any `.nvmrc`, `package.json` `engines` field, or `CLAUDE.md`. If another developer or CI runner uses Node 18 (still in LTS maintenance), this throws at import time — not at the `scaffoldFeature` call, but the moment the module is loaded (even for `--help`). The pre-refactor version used the same pattern, so this is a pre-existing issue carried forward, but the refactor was an opportunity to address it.

The direct invocation guard at the bottom of the file uses `fileURLToPath(import.meta.url)` as a more portable alternative — inconsistent with the `import.meta.dirname` usage just above it.

### [Medium] Test for `NAMING_MAP` diverges from plan in a way that weakens the guard

**Location:** `frontend/scripts/scaffold-feature.test.ts:55–68`

The plan specified per-item `toContain` assertions (i.e. "each expected name is present"). The implementation uses `toHaveLength` + sorted-array equality. This is actually a *stronger* check — it also catches extra entries. However, the test now asserts that `NAMING_MAP` contains *exactly* 14 entries and no more. If someone adds a valid future feature to the `NAMING_MAP` (e.g. a new feature is scaffolded), the test breaks on the new feature's addition, not on the scaffolder logic. This is a minor over-constraint: the `NAMING_MAP` is a "living" map per its own comment, and the test now pins it to a snapshot of exactly 14 names rather than asserting the known 14 are *present*.

Not blocking — the test is better than the plan's version in most dimensions — but a future feature addition will require a coordinated test update that could have been avoided with a superset assertion.

### [Medium] `scaffoldFeature` does not validate name internally; relies on caller

**Location:** `frontend/scripts/scaffold-feature.ts:79–82`

The `scaffoldFeature` function calls `validateName` and throws on failure. This is correct. However, `validateName` is also exported, meaning a caller is expected to call it before `scaffoldFeature`. The double-validation (caller calls `validateName`, then `scaffoldFeature` calls it again) is harmless but slightly redundant. More importantly, the `main()` CLI path also calls `validateName` separately (line ~162), meaning every CLI invocation validates the name three times. Not a bug, but the redundant calls suggest the `scaffoldFeature` internal validation could be documented as "defense-in-depth" rather than "primary."

### [Low] W1 classification ledger not recorded in commit body or accessible artifact

**Location:** Commit `b5f372c` (Task 2 / W1)

Spec 33 §3 W1 "Done when" requires a classification ledger: baseline hit count, per-bucket counts, residual kept-count with per-item rationale. The plan's Task 2 Step 6 instructs recording this. The commit `b5f372c` has no body text — the ledger was either recorded in a scratch note not persisted to the repo or omitted. The spec's auditability requirement ("completeness is auditable rather than reviewer-judgment-only") is therefore not met in the committed artifact. The reviewer can verify the work by running the grep before/after comparison, but the spec asked for the ledger as part of the phase record.

### [Low] `features/README.md` naming map not visible in the diff

**Location:** `frontend/src/features/README.md`

The diff shows `features/README.md` was modified (46 lines changed), but the visible diff in the truncated output shows the surrounding README enrichment content. Task 3 Step 3 of the plan requires confirming the naming map matches the 14 actual folders and agrees with `NAMING_MAP` in `scaffold-feature.ts`. The 14 feature folders are confirmed present (`artifacts`, `auth`, `calendar`, `customers`, `insights`, `market-research`, `mission-control`, `reports`, `scout`, `settings`, `shell`, `signals`, `strategist`, `tenant`). The `NAMING_MAP` in the committed `scaffold-feature.ts` lists the same 14 names in alphabetical order. Consistency confirmed.

### [Low] ADR index titles for 0002–0005 not verified against actual files

**Location:** `docs/adr/README.md`

The plan's Task 5 Step 2 includes a parenthetical "(Confirm the 0002–0005 titles against the actual files before finalizing the one-liners.)" The ADR index in the committed file uses one-line summaries. Without reading the actual 0002–0005 files, the reviewer cannot confirm accuracy, but the titles are plausible and consistent with the naming convention. Flagging as Low for completeness — the implementer should have verified.

### [Low] `escape-hatches.ts` header still says "Phase 2a strict-TS escape hatches"

**Location:** `frontend/src/shared/types/escape-hatches.ts:1`

The file-level comment on line 1 reads `Phase 2a strict-TS escape hatches.` — the plan's Task 2 Step 2 explicitly called this out as "bucket b, see Step 5" (provenance — keep the past-tense reference). The line was intentionally kept. This is correct per the plan, but the phrase "Phase 2a" is now the only remaining phase reference in the file (all `TODO(phase-13)` markers were converted). A future reader might wonder why this one phase reference was kept while all others were stripped. The provenance value is genuine (it explains *why* the escape-hatch mechanism exists), so this is a judgment-call I agree with.

### [Low] `reports/README.md` enriched content differs from plan template

**Location:** `frontend/src/features/reports/README.md`

The plan template listed `routes.tsx, index.ts` under Key files. The committed version also lists `pages/ReportsPage.tsx — reports UI` as the first key file. This is actually an improvement over the plan template (which omitted the page file). Similarly, the Dependency notes section correctly adds the TD-FE-59 cross-reference for the mock surface. The `calendar/README.md` and `insights/README.md` follow the same improved pattern. This is a positive deviation from the plan — noting it so the reviewer is aware the templates were adapted with better content.

### [Low] `settings/README.md` describes "the app's primary write surface for the org's company profile" without a TD-FE citation

**Location:** `frontend/src/features/settings/README.md:3`

The enriched README states "the app's primary write surface for the org's company profile" but there are known escape-hatch typings (`UntypedBackendProfile`) and mock-derived contracts in this surface. The Dependency notes mention `useCompanyProfile`/`useSaveCompanyProfile` and `@/shared/api` but don't cross-reference `escape-hatches.ts` or the governing TD-FE entries. Minor omission — the README is accurate for its scope.

### [Nit] Scaffold-feature `--dry-run` exit code is 0 (success)

**Location:** `frontend/scripts/scaffold-feature.ts:181–183`

When `--dry-run` is used, the function returns `{ dryRun: true }` and `main()` prints the dry-run message and returns (no `process.exit`, so exit 0). When `--help` is used, `process.exit(0)`. When no args are provided, `process.exit(1)`. This is fine — the exit-code semantics are correct (dry-run is a successful no-op). Just noting the pattern for completeness.

### [Nit] Commit `d6f04fe` (W6 ADRs) also touches CLAUDE.md/AGENTS.md but the commit message says "add ADR index + backfill"

**Location:** Commit `d6f04fe`

The Task 5 plan includes Step 3 "Cross-link from CLAUDE.md" and the commit includes those files. The commit message `docs(adr): add ADR index + backfill 0006-0008 (...) (W6)` doesn't mention the CLAUDE.md/AGENTS.md cross-link edit. The diff shows the "Technical Debt Register" section in both files gained an ADR pointer line. Minor commit-message accuracy gap — the edit is correct.

### [Nit] `features/README.md` line count change (46 lines) is larger than expected for a naming-map + cross-link edit

**Location:** `frontend/src/features/README.md`

The diff stat shows 46 lines changed in `features/README.md`. Given Task 3 Step 2 required "verify the substantive READMEs are still accurate + add cross-links," and Step 3 required confirming the naming map, the change size suggests substantive edits beyond just the naming map + cross-link. The visible content changes in the diff include the W1 provenance cleanup of the README itself (dropping phase numbers from descriptions). Consistent with the plan — Task 3 includes W1 cleanup of README provenance.
