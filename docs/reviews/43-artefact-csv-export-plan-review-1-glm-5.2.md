---
artifact: plans/43-artefact-csv-export.md
artifact_type: plan
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-26
round: 1
---

## Findings

### [Low] Formula-guard apostrophe visibly prefixes `+`/`-`-leading values (notably Phone), unacknowledged and untested

**Location:** Task 3, `guardFormula` / `escapeCsvCell` (plan lines ~447-454); Task 3 formula-guard test (plan lines ~299-310); Global Constraints "CSV correctness" (line 22).

`guardFormula` prefixes a leading `'` to any cell starting with `= + - @`. For a plain `.csv` import (as opposed to Excel's own cell format), spreadsheet apps treat that `'` as a literal character — it is *not* consumed as Excel's text-prefix marker on CSV import — so the value renders with a visible leading apostrophe. The column most likely to trigger this in real data is **Phone**: international numbers are commonly `+E.164` (e.g. `+1-555-…`), so most Apollo-revealed phone values would export as `'+1-555-…`. A dash-leading value would be similarly affected.

The plan neither acknowledges this data-fidelity artifact nor covers it in tests: the happy-path `phone: "555-0100"` was chosen *specifically* because it doesn't trigger the guard (plan line 271 comment), and the formula-guard test only exercises `name/title/seniority/company` (plan lines 301-302) — never the Phone column or a `+`-prefixed number. So the most realistic trigger case is both untested and undiscussed.

Recommend: decide explicitly on the tradeoff (leading `'` is the standard OWASP mitigation, so keeping it is defensible — but then acknowledge the visible apostrophe on `+`-phones, or neutralize via a less-visible method such as a leading TAB/zero-width approach), and add a test case asserting the behavior on a `+`-prefixed phone so the artifact is at least pinned and intentional rather than incidental.

## Observations (no action)

- **Kill/recovery & abort criteria:** the plan declares a report-and-wait sub-skill (`subagent-driven-development` / `executing-plans`, line 3) and a green-only `--no-ff` merge gate after `npm run preflight`. Under the default assumption that execution is bound to one of those skills, the missing explicit kill/rollback statement is adequately covered by the report-and-wait safety net — no change needed.
- **Parallelizability:** Task 3 (`artefactCsv.ts`) and Task 4 (`contracts.ts` + `signalBriefing.ts`) both depend only on Task 2 and touch disjoint files (and `index.ts` is already settled by Task 2), so they could run in parallel; serializing them is safe and keeps the TDD-per-task flow simple — acceptable as written.
- **Spec drift (intentional):** the contract widening uses bare `.optional()` (output `string | undefined`) rather than the spec's literal `.default("")`, and resolves the round-1 spec-review contract-style inconsistency via `leadToRow` coercion (`?? ""`). This divergence is explicitly documented in Global Constraints (line 23, citing synthesis §Agreed) — confirmed correct, no action.
- **Verification per step is strong overall:** every task follows write-failing-test → observe failure → implement → observe pass → run full suite for regression → commit. The formula-injection guard, RFC-4180 quoting, BOM, blank-cell, and no-op-on-empty behaviors are all unit-tested.
- **Verified load-bearing assumptions hold** against the current tree: `signalBriefing.test.ts` defines the `signal`/`leads`/`generated` fixtures Task 4's tests reference; `ArtifactsPage.tsx` has `handleDownloadClick` (closing line 131) and `setArtefacts` for Task 6's `handleDownloadCsv`; `LibraryCard` has exactly one caller (`ArtifactsPage.tsx:169`), so the new required `onDownloadCsv` prop can't break other call sites; the three signals-page test files are the complete set mocking `@/features/artifacts`.
- **Spec coverage** (plan's self-review table, lines 1057-1064) maps every AC1–AC6 to tasks; AC6's live response-shape check is correctly marked post-deploy/non-gating (consistent with the spec's redeploy caveat).
- **`handleDownloadCsv` (Task 6) page-level behavior is untested** — only the `LibraryCard` component surface is tested; the new→viewed status flip is not asserted at the page level. This mirrors the existing untested `handleDownloadClick`, so it is an accepted pre-existing pattern rather than a new gap; flagging for awareness only.
