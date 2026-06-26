---
synthesizes_review: docs/reviews/43-artefact-csv-export-plan-review-1-glm-5.2.md
artifact: plans/43-artefact-csv-export.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-26
round: 1
---

## Round Recommendation

no

Reason: The single finding is Low and addressed in place (acknowledged as an MVP tradeoff + pinned by a test); no Critical/High remains and no new design surface opened.

## Agreed Findings

- **[Low] Formula-guard apostrophe visibly prefixes `+`/`-`-leading values (notably E.164 Phone), unacknowledged and untested** — Verified against the plan and reality: `guardFormula` prefixes `'` on any cell starting `=`/`+`/`-`/`@`, and on **plain-CSV import** that `'` renders literally (it is *not* Excel's manual-entry text qualifier); E.164 phones (`+1-555-…`) are the common real trigger, the happy-path test deliberately used a guard-free phone (`555-0100`), and the formula-guard test only exercised Name/Title/Seniority/Company — so the realistic Phone case was both untested and undiscussed. Resolved by (a) keeping the **uniform** guard (OWASP-standard; it is the spec's settled §F1 decision, not re-opened in a plan round; per-column exemption would require fuzzy phone-vs-formula detection), (b) explicitly acknowledging the visible-`'` artifact on `+`/`-`-leading values as an accepted MVP cosmetic tradeoff in Global Constraints + the `guardFormula` comment, with a revisit trigger (column-scoped policy / TAB-prefix if a user reports it), and (c) adding a Task-3 test pinning the `+`-prefixed Phone behavior (`expect(cells[7]).toBe("'+1-555-0100")`) so it is intentional, not incidental.

## Disagreed Findings

None.

## Deferred Findings

None.

## Severity Disagreements

None. Low is correct: a visible leading `'` on some international phone numbers is a cosmetic/data-fidelity artifact (the number remains readable, not lost), at MVP with 0 users, on self-/vendor-sourced data. It does not gate the merge.

## Open Questions

None. The reviewer's other items are explicit confirmations and need no action: kill/recovery is covered by the report-and-wait sub-skill + green-only `--no-ff` gate; Task 3 / Task 4 are safely serialized (disjoint files, both depend only on Task 2); the bare-`.optional()` contract drift is intentional and documented (synthesis §Agreed); per-step verification is strong (write-fail → observe → implement → observe → regression → commit); the load-bearing fixtures/callers (`signalBriefing.test.ts` fixtures, `ArtifactsPage` `handleDownloadClick`/`setArtefacts`, `LibraryCard`'s single caller, the complete set of three signals-page test files) all hold against the current tree; and the page-level `handleDownloadCsv` status-flip being untested mirrors the accepted pre-existing `handleDownloadClick` pattern (component surface is tested).
