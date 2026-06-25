---
synthesizes_review: docs/reviews/42-matched-leads-prospect-fields-design-spec-review-1-glm-5.2.md
artifact: specs/42-matched-leads-prospect-fields-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-25
round: 1
---

## Round Recommendation

maybe

Reason: All four findings agreed and revised in-spec (incl. the High — fixed, not deferred), no disagreements; remaining cost/benefit is the operator's call — the F1 fix changes existing name/company picker behavior (bounded + test-guarded) and one scope question (the separate Customers Lead Stream surface) needs a user decision before the plan.

## Agreed Findings

- **F1 [High] — normalize name/company too, not just the new fields.** Revised the `marketScoresHeatmap.ts` bullet: apply the new `pickNormalized` matcher to the existing `pickCompanyName` / `pickLeadDisplayName` as well, so the RCA's primary CSV org (`Company_Name` / `First_Name` / `Last_Name`) shows Name+Company instead of blank — preserving ordered preference + nested-`lead` fallback, matching by normalized **equality**, and keeping Apollo lowercase resolution (superset → no regression). Added a contract test asserting both CSV TitleCase and Apollo lowercase resolve for name/company.
- **F2 [Medium] — enumerate column-count edit sites + state consumers.** Revised the `LeadsTable.tsx` bullet: name the `REPORT_COLUMNS.length + 5` literals at L786 + L802 (L868 consumes the L802-derived `colSpan`) → `+ 7`; and state that `LeadsTable` is rendered by `ScoutLeadStream.tsx` (L6/L54), so both the market-research and Scout surfaces gain the columns (replacing the "confirm feature-local" TBD).
- **F3 [Low] — name the persistence dimension.** Added a PII note to the `signalBriefing.ts` bullet: the contact **name** now enters the **saved** briefing (downloaded PDF + artefact-library item), not just on-screen display; follows Spec 38's precedent that briefings carry lead data; the no-email/phone field-set + anonymized-fixture guardrails still apply; the library stays non-durable per Spec 38.
- **F4 [Nit] — drop the generic `level` alias.** Removed `level` from the `seniority` alias tuple (kept `senioritylevel`, `seniority`, `joblevel`), eliminating the future false-match risk.

## Disagreed Findings

- None. The review was well-grounded — the reviewer spot-verified the load-bearing grounding claims against the actual files. Each finding held on independent re-verification against the worktree code (confirmed the `+ 5` colSpan literals at L786/L802, and that `ScoutLeadStream.tsx` imports/renders `LeadsTable`).

## Deferred Findings

- None from the review itself. (Self-surfaced, during F2 verification) the separate Customers `LeadStream.tsx` surface — see Open Questions; provisionally scoped in-spec as an optional consistency follow-up, pending a user scope decision rather than deferred-with-a-trigger.

## Severity Disagreements

- None. Agreed with each assigned severity (High / Medium / Low / Nit) on independent assessment. F1 as High is justified — it would make the feature look broken on the exact org that motivated it; the cheap, no-regression fix makes agreeing straightforward.

## Open Questions

- **Customers Lead Stream scope (needs a user decision).** Verifying F2 surfaced that `frontend/src/features/customers/components/lead-stream/LeadStream.tsx` is a **distinct** component — its own `useLeads` hook + a `Name | Company | Source | Signals` table (`colSpan=4`); it does not use `heatmapLeadFromV2Lead` / `LeadsTable`, and it already shows **Name + Company**, so it does not exhibit the "company-only" symptom. Surfacing Title/Seniority there is a separate component + data-path edit. The spec now scopes it OUT as an optional follow-up (default). **Decision:** fold the Customers surface into this spec for full consistency, or leave it as a follow-up?
- **(Implementation, non-blocking)** Confirm `leads` is in scope on the cache-**hit** path of `build_signal_lead_map_claude` before wiring enrichment there (the spec's stated Implementation check). The round-1 reviewer observed it is (held through the cache-hit early return, L228–231); to be re-confirmed at implementation.
