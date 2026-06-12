---
synthesizes_review: docs/reviews/35-apollo-discovery-design-spec-review-2.md
artifact: specs/35-apollo-discovery-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-12
round: 2
---

## Round Recommendation

no

Reason: No High remains; all four round-2 Medium findings are resolved by revision (industry-filter scope, replace-visibility flip, orphan-tag cleanup design, `matched` definition), and the single disagreement is a Low judgment call (CSV export kept, surface bounded). The spec is plan-ready.

## Agreed Findings

- **[Medium] `organization_industry_tag_ids` needs a name→ID map that doesn't exist** — §5.2 step 1 now scopes MVP to **`q_organization_keywords` ← `industry[]`** (keyword match on names, no ID table); `organization_industry_tag_ids` noted as a future optimization needing a name→tag-ID lookup. Added that the step-3 funnel drops keyword-filter industry mismatches for free.
- **[Medium] `replace` hides all discovery leads during the swap window** — flipped the design: §5.7/§5.8 now keep `superseded` leads **visible in agent views** (excluded from dedup only), so there's no empty-Apollo window; the accepted trade is a brief old+new overlap at the commit instant. §8 item 8 updated.
- **[Medium] `superseded` orphan-cleanup undesigned** — §5.7 adds the trigger + scope: the stale-run failover (also run on app startup and at the top of each `POST /discover`) marks a hung `processing` replace-run `failed` and un-tags its leads.
- **[Medium] `counts.matched` undefined** — §5.3 now defines `matched` = revealed candidates that *updated* an existing lead at ingest (e.g. an `email_norm` overlap with a CSV lead) rather than creating one.
- **[Low] `low_credit` clearing on empty runs ambiguous** — §5.6 now clears only on a run that **successfully reveals ≥ 1 lead** without a credit error; an empty run leaves it unchanged.
- **[Low] Cross-source dedup limitation undocumented** — §5.2 step 3 now states dedup is Apollo-ID-based only; CSV duplicates aren't caught pre-reveal (may cost one reveal credit) but are merged by `email_norm` at ingest (counted as `matched`). AC2 scoped to "Apollo-ID-identifiable" duplicates.
- **[Nit] AC4 wording** — reworded to "never reduces the pool below its pre-run lead count."
- **[Nit] `counts.errors` element type** — §5.3 now specifies `errors: [{stage, message}]`.
- **[Nit] SHA-1 for fingerprint** — §5.7 adds the justification (persisted in the run doc + surfaced in `/status`, so a compact stable key beats re-serializing the full JSON each comparison). Kept SHA-1.

## Disagreed Findings

- **[Low] Export endpoint — "ship JSON-only for MVP, defer CSV."** Disagree. CSV is the format users actually expect for a "download my leads" action; JSON-only would be a poor fit for that purpose, and the feature is the user-facing half of UC5's keep/replace/**download**. The reviewer's real concern is implementation surface — addressed by *constraining*, not deferring: §5.7 now states the CSV is a flat fixed-column projection via Python's stdlib `csv` writer (no nested fields, minimal surface). Net surface is a handful of lines, not worth a follow-up round-trip. Export kept.

## Deferred Findings

- None. Every agreed finding was actionable now and revised this round. (The previously-recorded org-level-profiler-readiness tech-debt item from round 1 remains deferred unchanged; not re-raised this round.)

## Severity Disagreements

- None. Round-2 severities (4 Medium, 3 Low, 3 Nit) are accepted as assigned; the only disagreement is on the *substance* of the export finding (above), not its severity.

## Open Questions

- The replace-visibility flip resolves the empty-window problem but trades in a brief, bounded old+new overlap at the commit instant. This is now an explicit, accepted MVP decision (§5.7) rather than an open question — flagged here only so plan-write keeps the agent-view query filter (`exclude superseded from dedup, include in views`) straight, since it is subtle.
- Plan-time unknowns remain the same two named in round 1 — the exact live Apollo filter-key names (now narrowed to `q_organization_keywords` + the size/title/location keys) and the ICP-fit weights within the §5.2 step-3 drop contract. Both are confirmable against live Apollo `/docs` during plan-write; neither is a spec gap.
