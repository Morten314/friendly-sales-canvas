---
artifact: artefact-csv-export
artifact_type: impl
verdict: clean
reviewer_model: glm-5.2
date: 2026-06-26
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

- **Change-context source:** `git log -p master..artefact-csv-export` (14 commits; 7 are impl, the rest spec/plan/review/synthesis artifacts and the `/apollo/enrich` backend-only doc note the spec depends on). Patch was well under the ~200 KB budget — no commit bodies dropped.
- **Impl commits:** `5cf8434` (BE projection) → `dec9215` (ArtefactLeadRow type) → `955a3f9` (artefactCsv module) → `f952cd7` (builders + contract) → `e9c9782` (save handlers) → `b518f06` (library re-download) → `64bddff` (test cast fix + prettier).
- **Spec/plan loaded:** `specs/43-artefact-csv-export-design.md`, `plans/43-artefact-csv-export.md`. Adherence checked.
- **Config loaded (branch state):** `frontend/package.json` (engines `node>=21.2.0`; `typecheck`=tsc `-p tsconfig.app.json`, `preflight` includes lint+format:check+vitest+build+bundle:check+e2e+knip, lint via flat `eslint.config` with `--max-warnings 0`), `frontend/tsconfig.app.json`. No root `package.json`/`pyproject.toml` (polyglot repo per AGENTS.md); backend has no linter wired. These confirm: knip will not flag the new exports (all consumed), and the new code targets a Node floor that is fine for the `Blob`/`URL`/anchor APIs used.

## Findings

*(none above Nit)*

## Observations (no action)

- **Spec/plan adherence is complete.** All six acceptance criteria are implemented and map to the planned tasks: BE pure projection of `email/email_status/phone/linkedin_url` (`lead_map.py` alias tuples + `_enrich_matched_leads`), `ArtefactLeadRow`/`leadRows` type, `artefactCsv.ts` (RFC-4180 + formula guard + UTF-8 BOM), both builders attach `leadRows` via `leadToRow`, both save handlers call `generateAndDownloadCsv`, and the library card re-download control. No scope creep beyond the spec.
- **The plan-review-r1 finding is proactively resolved in impl.** The Low finding (formula-guard apostrophe visibly prefixes `+E.164` phones, untested) was addressed: `artefactCsv.ts` carries an explicit tradeoff comment and the suite adds `guards a +E.164 phone too … (plan review r1)` pinning the behavior on a `+1-555-0100` phone. Nothing further to do.
- **Cache stays narrow (the real integrity concern) is correctly handled and tested.** `_enrich_matched_leads` is PURE (`{**lead, …}` builds new dicts, never mutates the cached mapping), and `test_build_map_enriches_on_cache_miss` asserts `email/email_status/phone/linkedin_url` are absent from the persisted Mongo doc — so the wide shape cannot leak into the cache on either the cache-hit or cache-miss path.
- **Formula-injection (CWE-1236) mitigation is correctly ordered:** `guardFormula` (leading `'`) runs *before* RFC-4180 quoting in `escapeCsvCell`, so a dangerous cell that also needs quoting (e.g. `=a,b`) becomes `"'=a,b"` rather than re-introducing formula evaluation.
- **Zero-cost / no-LLM invariant (AC5) holds by construction:** the BE change is an in-memory dict projection over `leads_by_id` (already joined), with no new import or call into the connectors/LLM paths.
- **Two save-time downloads (PDF then CSV) is the accepted MVP risk** with a graceful fallback: if the browser blocks the second programmatic download, `leadRows` is still enqueued and the CSV re-downloads from the Artifacts library (AC3), so there is no data loss.
- **Diff hygiene is good:** one concern per commit, tests co-located with their feature, cross-feature imports go through the `@/features/artifacts` barrel only (satisfies the `import-x` boundary). The only non-feature-43 change is the `/apollo/enrich` backend-only note (`backend/API_ENDPOINTS_SUMMARY.md`, `frontend/src/features/connectors/README.md`), which is the zero-credit evidence the spec explicitly depends on — appropriately on the branch.
- **`handleDownloadCsv` page-level status-flip is untested** (only the `LibraryCard` surface is tested), but it is a near-verbatim copy of the already-untested `handleDownloadClick` — an accepted pre-existing pattern, not a new gap.
