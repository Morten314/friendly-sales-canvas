---
synthesizes_review: phase-5i-finalize-impl-review-1.md
artifact: phase-5i-finalize
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-03
round: 1
---

## Round Recommendation

no

Reason: No Critical/High findings; the lone Medium is a CTO-sanctioned, fully-documented scope decision with no remaining action, and all other findings are Low/Nit, already-tracked, or correctly disagreed.

## Agreed Findings

(none requiring a change — see Disagreed / Deferred / Severity Disagreements below)

## Disagreed Findings

- **[Low] Per-section `localStorage` writes lack their own TD-FE entries (Finding 3).** They are already tracked: TD-FE-26 explicitly covers the dead non-user-scoped `localStorage.setItem` writes in `RegulatoryComplianceSection` (`docs/TECH_DEBT.md` TD-FE-26, "five effects writing `localStorage.setItem("regulatory_…")`"); TD-FE-21 covers market-entry's `/api/ask` write-path + localStorage; TD-FE-31 covers market-size edit-save. No new entries are warranted, and 5i correctly did not touch this inherited code.

- **[Nit] Four spec-delta commits where one or two would suffice (Finding 4).** The repo convention explicitly biases toward "more, smaller commits" (`CLAUDE.md` AI-Native Development). The two refinement commits (`2ef4a5a`, `f099a4c`) are the review-loop's precision improvements to the load-bearing delta 11 / §11-item-3 amendment — each is a distinct logical step (initial record → cascade-root wording → §11 cross-reference), and keeping them traceable has value over a squash. Squashing would rewrite history for no functional benefit. Keeping as-is.

- **[Nit] `TD-FE-32` pull-forward trigger is vague; name Phase 6 (Finding 6).** The entry's subject is that the feature phase-numbering is itself disputed (master §4 signals8/scout9/settings10 vs `features/README` signals6/scout8/settings11). Hard-coding "Phase 6" into the trigger would contradict the very ambiguity the entry tracks; the "next phase that plans against the numbering / first ambiguity the by-name convention can't resolve" phrasing is deliberate and robust. No change.

## Deferred Findings

- **[Low] `App.tsx:22` imports `MarketResearchPage` via a deep path from outside the feature (Finding 2).** Verified pre-existing — `App.tsx` is untouched by this branch (`git diff master...HEAD` shows 0 changes to it). The "never a deep path" contract in `index.ts` targets cross-*feature* peer consumers (e.g. `signals`), not the app shell's route wiring; `index.ts` deliberately exports only the cross-feature *data* surface (type + hook), not the routed page component, so the shell must import the page entry directly to wire the route. There is a real kernel for the future: whether the features-dependency lint treats the shell's route-wire as "external." **Trigger:** the Phase 6+ features-dependency lint / public-surface policy decision (when the `index.ts`-only `import-x/no-internal-modules` rule, deferred as TD-FE-15, is finalized). Out of 5i's finalize scope.

## Severity Disagreements

- **[Medium → informational/Low] Spec §11 item 3 zero-raw-fetch gate only partially met (Finding 1).** Agree with the substance: the feature still carries ~10 raw `fetch()` calls and the `useMarketResearchData.ts` cascade + per-section `localStorage`, so the plan's hard gate is not literally met. But this is not a Medium-severity actionable defect — it is the CTO-sanctioned advisory-gate relaxation, recorded honestly and consistently across four artifacts (Spec 24 §9 delta 11, the §11-item-3 amendment marking it "PARTIALLY met," and the TD-FE-19/21/27/28/30/31 carry-forward annotations + TD-FE-32). The reviewer themselves note it is "not a code defect" and "a legitimate scope/record decision." It is correctly the reason `verdict: findings` rather than `clean`, but it carries no remaining action and does not block the close. Effective severity: informational.

## Open Questions

- None. The phase-number reconciliation (TD-FE-32) and the shell-vs-feature deep-path lint policy (deferred above) are both already logged as forward-looking debt for Phase 6+; neither is open against 5i.
