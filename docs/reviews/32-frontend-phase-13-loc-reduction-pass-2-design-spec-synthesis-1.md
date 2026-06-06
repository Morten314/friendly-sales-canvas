---
synthesizes_review: docs/reviews/32-frontend-phase-13-loc-reduction-pass-2-design-spec-review-1.md
artifact: specs/32-frontend-phase-13-loc-reduction-pass-2-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-06
round: 1
---

## Round Recommendation

no

Reason: The single High finding is resolved in-place by stating the audit-completeness bar explicitly (only its percentage-floor sub-suggestion is rejected, with reasoning); the remaining findings are Medium/Low clarity and completeness fixes, all applied this round without opening new design surface.

## Agreed Findings

- **[High] No measurable success bar (§10, §3.3).** Finding valid — the bar was implied by DoD #1/#2 but not *stated as the bar*. Revised §10 to make the determinate ceiling explicit: scorecard triages every file, all `execute` applied, every `investigate` resolved (applied or deferred-with-rationale). Rejected the *percentage-floor* remedy (see Disagreed); adopted the completeness-bar remedy. Also added bundle delta to DoD #1.
- **[Medium] §5.1 composite ranking underspecified.** Revised: LOC is the primary signal, similarity-scan hit count a secondary tie-breaker, complexity a *qualitative advisory* factor (no computed metric, no weighted formula).
- **[Medium] §5.3 "the audit judges" imprecise agency.** Revised to "the plan author (during planning) or implementing agent (during execution) judges … the file is deferred."
- **[Medium] Scorecard missing bundle delta (§3.3).** Revised: added "§bundle delta (raw + gzip, from `check-bundle-budget.ts` against the post-Phase-12 baseline)" to the scorecard format and DoD #1.
- **[Medium] §4.4 "near-identical" vs "provably identical" tension.** Revised §4.4 and R-13.4: a near-duplicate is merged only when its delta is confined to props/literals **and** visual regression confirms pixel-neutrality; cited the Phase 9 `ScoutChatWithHistory`↔`ProfilerChatWithHistory` substrate dedup as the real precedent (not a tautology).
- **[Medium] §1.1 "last LOC pass" overclaims.** Revised to "final *planned* LOC pass … substantial deferrals (§2.2/§4.4/§5.3) would require a future spec."
- **[Medium] §1.3 malformed gap-row.** Revised: the next-tier files moved out of the broken table row into prose, labelled "candidates, not commitments."
- **[Low] §8 middle tier adds no distinction.** Revised: dropped the middle tier (every code-touching sub-phase qualified); two formal tiers now (`verify` inner loop / full `preflight` merge gate) plus an explicit *advisory* (vitest + visual regression before declaring decomposition/dedup sub-phases ready; scorecard/manifest-only commits skip it).
- **[Low] §6 codemod-zero path may need a Phase 14 amendment.** Revised: added a Phase 14 handoff note that the framework may need establishing from scratch (Spec 14 §5.5 amendment path).
- **[Low] §4.6 orphan re-check yields no new info.** Revised: reframed as a *formal close* (expected same result as Phase 1's 6-check kit), default keep, citing TD-FE-1's existing reasoning.
- **[Low] §3.1 tooling setup unaccounted-for.** Revised: noted audit-tooling setup is part of 13a's first commit(s) and budgeted in the plan; flagged `ts-morph` (dev dep) vs `ast-grep` (not in repo) availability; manifest add in its own commit (§8).
- **[Low] §7 13a internal sub-phasing undiscussed.** Revised: noted 13a may sub-split internally (e.g. 13a-i dead code / 13a-ii dedup / 13a-iii shadcn prune) at the plan author's discretion.
- **[Low] §5.2 "green" undefined vs preflight tiers.** Revised: "green" = `npm run verify` passes (§8), consistent with the now-two-tier §8.

## Disagreed Findings

- **[High] §10 — the *percentage-floor* remedy (suggestion a) only.** The finding holds and is fixed via the completeness bar, but I reject adding an advisory LOC-percentage floor. Two reasons: (1) Phase 13's §5 decomposition workstream is **LOC-neutral** — splitting a file into modules keeps (or slightly increases) total LOC, so a percentage target would mismeasure the phase and pressure unsafe over-cutting; (2) Phase 13 operates on a tree already swept by Phases 1 + 5–12, so the dead-code surface (and thus any meaningful percentage) is small and unpredictable. Note: the reviewer's premise that Phase 1 had a ≥5% target is **correct** (Spec 16 §4.1; scorecard line 22 confirms), so the rejection rests on Phase-13-specific reasoning, not on master-plan §6 #8 alone — though that "no hard target" trajectory language reinforces it.

## Deferred Findings

None. All findings were addressed in this round (the two Nits, §13 and §1.4, were affirming — no action).

## Severity Disagreements

- **§10 (no measurable bar): reviewer High → I assess Medium.** DoD #1 ("covers every file, per-file verdict") + #2 ("all `execute` + confirmed-safe `investigate` applied") already substantially bounded the effort ceiling before revision; the defect was that the completeness bar wasn't *named as the bar*, not that the phase could ship trivially. Resolved regardless of severity, so this does not affect the round recommendation.
- **§5.3 (imprecise agency): reviewer Medium → I assess Low.** Pure wording precision about decision-ownership; the defer mechanism and its triggers were already specified. No design gap.
- **§1.1 ("last LOC pass"): reviewer Medium → I assess Low.** A forward-claim softening with no design consequence.

## Open Questions

- **Visual-regression sensitivity for dedup (surfaced from §4.4 revision).** The near-identical-merge bar now leans on visual regression confirming pixel-neutrality, but the suite runs at a 2% `maxDiffPixelRatio` threshold (Phase 2c). A dedup that introduces a sub-threshold visual drift could pass. Low risk for the planned scope, but the Phase 13 plan should note that a dedup with any visual ambiguity may warrant a tighter per-case check or be deferred to TD. Not blocking; flagged for the plan.
- The spec's §12 already carries the substantive deferred-to-plan questions (decomposition set/threshold/count, hook split-or-defer, similarity-scan tool choice, ADR triggers); none are left unresolved by this round.
