---
artifact: specs/43-artefact-csv-export-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-26
round: 1
---

## Findings

### [Medium] CSV formula-injection cells are not addressed

**Location:** §F1 `artefactCsv.ts` ("RFC 4180 quoting"); §Error handling / degradation / edge cases ("Commas / quotes / newlines … handled by RFC-4180 quoting"); AC4.

The spec carefully specifies RFC-4180 quoting for `,` / `"` / newline, but RFC-4180 quoting does **not** protect against spreadsheet formula injection: cells beginning with `=`, `+`, `-`, or `@` are evaluated as formulas when the CSV is opened in Excel / LibreOffice / Google Sheets (some apps even evaluate them inside double-quotes). Two of the columns are high-risk: `Why` is free-text emitted by an LLM (can begin with any character), and `Name` / `Email` / `Company` originate from external sources (Apollo, CSV upload) rather than trusted input. A `why` that starts with `=HYPERLINK(...)` or a name starting with `+` would execute on open.

Mitigation is cheap and standard: for any cell whose first character is in `=+-@`, prefix a single quote `'` or a TAB before RFC-4180 quoting (or sanitize the leading char). Add it to the quoting rule in F1, the edge-cases list, AC4, and the `artefactCsv` test cases. (MVP/0-users lowers the urgency, but since the spec is already investing in quoting correctness, the omission is the more notable; the data is partly external, not purely internal.)

### [Low] `email_status` source attribution is inaccurate

**Location:** Decision §4 ("Apollo `verified` / `unverified`"); §Alias map "email_status … populated only for Apollo-discovered leads".

`email_status` is populated for **any Apollo-sourced** lead, not only discovery-sourced ones. The import path (`_run_import`, `orchestrator.py:166`) runs every fetched list-contact through `normalize_apollo_record`, which maps `email_status` verbatim (`normalize.py:112`), so imported Apollo leads carry it too. It is blank only for CSV-uploaded and manually-added leads (which never pass through the Apollo normalizer). Reword to "populated for Apollo-sourced leads (discovery + import); blank for CSV-upload/manual leads." This matters because the Testing-strategy bullet "email_status blank for CSV leads" is correct but the design-prose framing could mislead a reader into thinking import leads lack it (affecting expected data population in a live response-shape check).

### [Low] Contract widening is inconsistent with the Spec-42 sibling fields

**Location:** §Contract change (`SignalLeadMapLeadSchema` widening) vs. the existing `name/title/seniority` in `contracts.ts:22-24`.

The four new fields use `.default("")` (output type `string`), while the already-present Spec-42 prospect fields (`name`, `title`, `seniority`) use bare `.optional()` with no default (output type `string | undefined`). Since `ArtefactLeadRow` is all-required-`string` (F2) and F3 introduces a `leadToRow` mapper, the mapper must coerce the *existing* `name`/`title`/`seniority` `undefined`s to `""` as well — which F3 doesn't mention. Either align both styles (give the Spec-42 fields `.default("")` too, a one-line cleanup) or explicitly note that `leadToRow` coerces `undefined → ""` for every column so an implementer doesn't write `lead.name` straight through and produce `undefined` cells.

## Observations (no action)

- The "zero Apollo credits" premise is verified against the code: discovery already reveals email/email_status (and carries linkedin_url) via `match_person` at scan time (`orchestrator.py:382-413`) and stores them flat on the Lead node through the canonical-fields set (`normalize.py:12-25`); the CSV reads the already-stored dict. No new call is introduced. Confirmed correct.
- The matched-leads cap (`_MAX_LEADS = 100` in `lead_map.py`) bounds a per-signal CSV to roughly ≤100 rows; no performance/size concern worth speccing.
- Plan-readiness is good: the spec decomposes into ordered, testable, reviewable steps and correctly orders backend-first (per the polyglot rule), with a live response-shape check before FE work.
- The "two automatic downloads from one click" pop-up/multi-download caveat is flagged and explicitly accepted for MVP.
- The backend-redeploy caveat for the Signals path (CSV shows blanks until the projection ships) is correctly noted — consistent with Spec 42.
- The library CSV control being hidden when `leadRows?.length` is falsy correctly covers older/mock artifacts that pre-date the field.
