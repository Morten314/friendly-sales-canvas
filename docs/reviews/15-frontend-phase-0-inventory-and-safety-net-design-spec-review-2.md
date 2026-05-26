---
artifact: specs/15-frontend-phase-0-inventory-and-safety-net-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 2
---

## Context

This is a round-2 review. Round 1 found 3 High, 7 Medium, 5 Low, and 2 Nit issues. The synthesis accepted all findings and the spec has been revised accordingly. This review evaluates the round-2 spec against the actual codebase state, checks that round-1 findings were properly addressed, and identifies any remaining or new issues.

## Findings

### [Medium] §1.3 falsely claims visual snapshots for journey 04 (market-research-5-components)

**Location:** §1.3 "Playwright config" row (line 27)

The spec says:

> Visual snapshots committed for journeys (login-tenant-mission, csv-upload-leads, signals-feed-action, **market-research-5-components**, icp-create)

Journey 04 (`04-market-research-5-components.spec.ts`) has no `toHaveScreenshot` assertions and no snapshot directory. The file's own comment block states: "Visual-regression assertions intentionally omitted. … This spec is a smoke check: navigate, don't get bounced to login, auto-fetch fires." Only journeys 01, 02, 03, and 05 have committed snapshots. The "5 snapshots" count in the §2.5 investigation trigger (">5 snapshots fail unexpectedly") is also affected — the actual snapshot count is 15 across 4 journeys + 5 stubs = ~20 total PNGs.

**Suggestion:** Remove "market-research-5-components" from the §1.3 Playwright config row's journey list. Adjust to: "Visual snapshots committed for journeys (login-tenant-mission, csv-upload-leads, signals-feed-action, icp-create)." The §2.5 investigation threshold should reference the actual snapshot count, or simply say "if more than 25% of snapshots fail" rather than a fixed number.

---

### [Medium] §3.6 adds `vitest_full_suite_seconds` to NFR re-measurement but §2.4 script spec doesn't include it

**Location:** §2.4 (lines 112–120) vs §3.6 (lines 383–401)

§2.4 defines `measure-baselines.sh`'s behavior with four measurement targets: `tsc --noEmit`, `vite build`, `vite dev start`, and `playwright test`. The output JSON schema (lines 124–140) contains only those four keys. §3.6 then says the re-measurement appends `vitest_full_suite_seconds` — but the script spec in §2.4 doesn't describe how to measure the Vitest suite (what command, what cleanup, how many runs). The 0b plan author would need to add a Vitest measurement step to the script without a spec-level contract for it.

**Suggestion:** Either (a) add a bullet to §2.4 noting that Phase 0b extends the script to include `vitest run` measurements (same 3-run protocol), or (b) make §3.6 explicit about the measurement protocol for the new field (e.g., "same 3-run median protocol as §2.4; `npm run test` with no cache clear since Vitest has no persistent cache").

---

### [Low] §2.7 CI YAML leaves `node-version` as `<TBD by plan>` — spec could anchor it

**Location:** §2.7 (line 201)

The CI YAML snippet has `node-version: '<TBD by plan>'`. While deferring to the plan is acceptable, the spec has enough information to constrain this. The `.nvmrc` or `.node-version` file (if one exists) or the current LTS range would narrow the choice. If neither exists, the spec could at least say "use the Node version tested locally" or pin to an LTS range (e.g., `>=20 <23`). Leaving it fully TBD adds a decision to the plan that the spec could cheaply resolve.

**Suggestion:** Check if `frontend/.nvmrc` or `frontend/.node-version` exists. If so, reference it. If not, anchor to "current LTS (20 or 22)" with a note that the plan confirms.

---

### [Low] §2.1 Tier 1 area list enumerates `components/ (loose)` but no spec for what qualifies

**Location:** §2.1 Tier 1 (line 65)

The areas list includes `components/ (loose)` as a catch-all for files directly under `src/components/` that don't belong to a named subfolder. Given the actual directory structure (9 subdirectories: `common/`, `customers/`, `layout/`, `market-research/`, `mission-control/`, `settings/`, `signals/`, `strategist/`, `ui/`), any `.tsx` files sitting directly in `src/components/` would indeed be "loose." But the spec doesn't say whether loose files should be flagged in the notes column as organizational debt. This is a minor triage signal for Phase 1.

**Suggestion:** Add a note to Tier 1 that "loose" files under `components/` root should be flagged in the notes column for Phase 1 triage (they may belong to an existing subfolder or need a new one).

---

### [Low] §3.3 characterization test exclusions omit `src/lib/firebase.ts` interaction with setup file

**Location:** §3.3 exclusions (line 339) and §3.1 setup file (lines 293–303)

The setup file (`frontend/src/test/setup.ts`) imports `server` from `./msw/server`, which is reasonable. But it also imports `@testing-library/jest-dom/vitest`, which augments `expect`. If any characterization target imports `src/lib/firebase.ts` (even transitively), the Firebase app initialization could fire during test setup. The spec correctly excludes `firebase.ts` from characterization targets, but doesn't call out that `vitest.config.ts` may need `deps.inline` or `deps.optimizer.web.include` configuration to prevent Vitest from trying to process the Firebase SDK in jsdom. This is a plan-level risk, not a spec gap, but worth flagging because the spec promises "the harness is verifiably wired" as a done-when.

**Suggestion:** No spec change needed. Flag for the 0b plan: the Vitest config may need Firebase-related module handling if jsdom encounters it transitively.

---

### [Low] §2.3 bundle baseline JSON `"others": [...]` shape is ambiguous

**Location:** §2.3 (line 108)

The spec says "the long tail is collapsed to a `"others": [...]` array" but the JSON schema at lines 95–106 shows only a `"chunks"` array with no `"others"` key. The script implementer must infer whether `"others"` is a sibling key to `"chunks"` or whether all chunks go into `"chunks"` with the top-10 being implicitly the largest by size. The schema should show the `"others"` field.

**Suggestion:** Update the JSON example to show both fields: `"top_chunks": [...]` and `"others": [...]`, or clarify in prose that `"chunks"` contains all entries sorted by size with the top 10 having a `"top": true` flag, or simply remove the top-10/other distinction and list all chunks — Phase 2c can compute the ordering itself.

---

### [Nit] §4 branch naming uses hyphens but master §1.4 doesn't establish a convention

**Location:** §4 (line 419)

Branch names `phase-0a-inventory` and `phase-0b-test-harness` are reasonable, but the master spec and AGENTS.md say "Branch naming is author's judgment; delete after merge." The names are fine, this is just noting they're consistent with that guidance.

---

### [Nit] §2.9 done-when item ordering doesn't match execution order

**Location:** §2.9 (lines 252–259)

The done-when checklist lists items in a different order than the execution sequence implied by the section numbering. For example, the bun lockfile delete (§2.8) should happen before knip runs (§2.2 says "Run against the post-0a-cleanup tree (i.e., after the bun lockfile delete commit)"), but the done-when list puts knip output (item 2) before the lockfile delete (item 7). This is cosmetic — the done-when is a checklist, not an execution sequence — but it could confuse a reader trying to infer order.

**Suggestion:** Either reorder to match execution order, or add a note: "Order is logical grouping, not execution sequence. The plan specifies execution order."

---

### [Nit] §6 R0a-5 mitigation text references Dependabot/Renovate that aren't installed

**Location:** §6 R0a-5 (line 452)

The mitigation says "Dependabot/Renovate (if introduced later) must be configured to update both in the same PR." No such tool exists in the repo and the spec doesn't propose introducing one. This is a forward-looking note that's fine for awareness but reads as if it's prescribing a current obligation. Minor wording issue.

**Suggestion:** Qualify with "If Dependabot or Renovate is ever introduced" or drop the sentence — the first two sentences of the mitigation already cover the actual constraint.

---

### Round-1 synthesis verification

All 17 round-1 findings (3H, 7M, 5L, 2N) are properly addressed in the round-2 spec:

- **H1 (CI cache):** §2.7 now uses a single job inside the Docker container. Resolved.
- **H2 (proof-of-pipeline test):** §3.3 now includes `msw-pipeline.test.ts` as a target row; §8 companion list includes it. Resolved.
- **H3 (Playwright version):** §1.3 notes the caret; §2.7 pins exact version; §6 R0a-5 documents the coupling. Resolved.
- **M1 (three tools → knip only):** §2.2 reduced to knip-only with rationale; Tier-2 schema removed ts-prune columns. Resolved.
- **M2 (re-baseline):** §2.6 simplified to local-only; workflow and docs dropped; §6 R0-2 notes Phase 2c as reintroduction point. Resolved.
- **M3 (rateLimitManager):** §3.3 table header changed to "stable utility survivors"; categorization note added. Resolved.
- **M4 (knip false positives):** §2.2 now documents 5 false-positive categories. Resolved.
- **M5 (ESLint description):** §1.3 updated with full config detail. Resolved.
- **M6 (api.ts paths):** §1.5 now enumerates all four files. Resolved.
- **M7 (NFR runtime):** §2.4 includes expected runtime. Resolved.
- **L1 (gzip extraction):** §2.3 specifies `gzip-size` package and script. Resolved.
- **L2 (ripgrep column):** §2.1 renamed to "static inbound-ref count (rg)" with lower-bound note. Resolved.
- **L3 (coverage map):** §3.4 now has explicit coverage map table. Resolved.
- **L4 (globals: false):** §3.1 config uses `globals: false` with rationale. Resolved.
- **L5 (hardware metadata):** §2.4 JSON uses structured `hardware` block. Resolved.
- **N1 (maxDiffPixels wording):** §2.5 comment clarifies the unit change. Resolved.
- **N2 (companion list):** §8 now lists all 5 characterization test files. Resolved.

### Plan-readiness assessment

After round-2 revisions, the spec is **plan-ready**. The remaining findings are Medium and below:

- The §1.3 snapshot inaccuracy is a factual correction, not a structural gap — the plan can proceed with the correct understanding.
- The §3.6 Vitest measurement gap is a minor spec incompleteness that the plan can fill.
- The node-version TBD is a plan-level decision, not a spec blocker.

Both sub-phases decompose into ordered, testable, reviewable tasks with clear done-when checklists and explicit deliverable lists in §8.

### Overengineering assessment

The round-1 overengineering items (three dead-code tools, re-baseline automation, dual dead-export columns) have all been removed. The round-2 spec is lean. The remaining design surface (NFR script, bundle baseline script, CI TODO scaffolding, MSW handler set, characterization test targets) is proportionate to the spec's purpose. No new overengineering concerns.

### Decision quality assessment

All master-spec open questions assigned to Phase 0 (§8 Q1, Q2, Q8) are resolved with documented rationale. The knip-only choice (M1) and local-only re-baseline choice (M2) both cite CLAUDE.md's MVP/velocity guidance as the deciding factor — this is appropriate. The alternatives-considered reasoning is sound and the spec doesn't rely on non-falsifiable success criteria.
