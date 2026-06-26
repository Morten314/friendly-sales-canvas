---
synthesizes_review: docs/reviews/43-artefact-csv-export-design-spec-review-1-glm-5.2.md
artifact: specs/43-artefact-csv-export-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-26
round: 1
---

## Round Recommendation

no

Reason: All three findings are Low (the formula-injection item downgraded from Medium) and agreed — revisions applied in place; no Critical/High remains and no new design surface opened.

## Agreed Findings

- **[Medium→Low] CSV formula injection** — Real and verified: RFC-4180 quoting does not stop cells beginning `=`/`+`/`-`/`@` from being evaluated as spreadsheet formulas, and `Why` is LLM-generated while `Name`/`Email`/`Company` are externally sourced (Apollo / CSV upload). Revising §F1, the edge-cases list, AC4, and the `artefactCsv` test list to add a formula-injection guard — prefix a single quote `'` to any cell whose first character is `=`/`+`/`-`/`@`, before RFC-4180 quoting. Incorporated despite the MVP "ignore security" posture because the fix is ~2 lines and is consistent with the spec's existing investment in CSV correctness.
- **[Low] `email_status` source attribution** — Verified against the code: the Apollo list-import path runs contacts through the same `normalize_apollo_record`, which maps `email_status` (`normalize.py:12-25`), so imported Apollo leads carry it too. Rewording the alias-map note from "populated only for Apollo-discovered leads" to "Apollo-sourced (discovery + import); blank only for CSV-upload/manual."
- **[Low] Contract widening inconsistency + `leadToRow` coercion gap** — Verified: `contracts.ts:22-24` keeps the Spec-42 prospect fields `name`/`title`/`seniority` as bare `.optional()` (output `string | undefined`), with a documented rationale, while the new fields used `.default("")`. Resolving by (a) switching the four new fields to bare `.optional()` to match the siblings, and (b) making the §F3 `leadToRow` mapper explicitly coerce every column with `?? ""` so no `undefined` cell is emitted; adding a test for a lead with undefined prospect fields → empty cells.

## Disagreed Findings

None.

## Deferred Findings

None.

## Severity Disagreements

- **CSV formula injection — Low, not Medium.** Agree the finding is real; disagree on severity for this context. At MVP with 0 users, the lead data is predominantly the user's own CSV uploads or a reputable vendor (Apollo) plus the product's own LLM `Why` text, so the "attacker controls the cell data" precondition for CSV injection is weak. The mitigation is incorporated regardless (it is trivial), so the severity delta does not change the action — but it should not be tracked as a Medium-risk gap.

## Open Questions

- None blocking. The reviewer independently confirmed the zero-Apollo-credit premise against the code (discovery reveals + stores `email`/`email_status`/`linkedin_url`; the CSV reads the already-stored dict; no new call) — this reinforces AC5/AC6 and needs no change.
