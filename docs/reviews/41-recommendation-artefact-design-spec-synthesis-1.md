---
synthesizes_review: docs/reviews/41-recommendation-artefact-design-spec-review-1-glm-5.2.md
artifact: specs/41-recommendation-artefact-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-23
round: 1
---

## Round Recommendation

maybe

Reason: All 11 findings agreed — none disagreed-but-real, deferred-but-load-bearing, or opening new design surface; the revisions are clarifications + a scope-*reduction* (TD-FE-78 partial). But this round surfaced 1 High + 5 Medium, so one confirmation round before plan-writing is advisable per "loop until nit-or-below"; cheap, and the operator may skip it given MVP velocity since nothing is contested.

## Agreed Findings

- **F1 [High] — "closes TD-FE-78" contradicts keeping ASCII-folding.** Verified: TD-FE-78 (`TECH_DEBT.md:1224-1242`) requires three things — correct xref, multi-page, **and Unicode-capable font embedding**. The spec delivers the first two but keeps ASCII-folding instead of embedding a Unicode font. Revision: downgrade all three claims (§8.5, §13, AC#5) to **"partially resolves TD-FE-78 (correct xref + multi-page); Unicode-font-embedding half stays open"**; keep the TD-FE-78 entry open with a partial-progress note; correct its stale "Strategist download path" line to name `ArtifactsPage.tsx:130`.
- **F2 [Medium] — no-regression scope omits the ArtifactsPage download path.** Verified: `generateAndDownloadPDF` is consumed at `SignalsPage.tsx:534` **and** `ArtifactsPage.tsx:130`. Revision: §8.5 shared-surface caution + §12 no-regression now include the ArtifactsPage re-download (incl. a saved `playbook` re-downloading multi-page).
- **F3 [Medium] — `signal.source` shape unresolved (`SourceCitation[]` vs `string[]`).** Verified against `types.ts:18-21,33`. Revision: §7.2/§9 state the flatten rule + undefined-guard: `signal.source?.map(s => s.citation || s.url).filter(Boolean) ?? []`.
- **F4 [Medium] — handler doesn't derive `item` from `(signal, index)`; misses the `nextBestMoves` fallback.** Revision: §8.4 adds an item-resolution step mirroring `SignalCard.tsx:342-348` / `SignalsPage.tsx:255-260` (incl. the `{nba:m, prompt:""}` mapping). (See severity note.)
- **F5 [Medium] — `orgId` null-guard missing; page `orgId` is `string | null`.** Verified (`SignalsPage.tsx:46`; matches the documented dual-store org-id behavior). Revision: §8.1 signature → `orgId: string | null`; §8.4 adds a `!orgId` no-op guard and conditional `org_id` forwarding (mirrors `generateSignalsBatch`, `services/signals.ts:55`).
- **F6 [Medium] — new endpoint lacks the token/run limiter its sibling has.** Verified: `_claude_budget.py` exists; `signal_ask_claude` advertises a "local token/run limiter" (`signals.py:111`). Revision: §7.1/§7.3 require reusing the existing `_claude_budget` token/run guard for parity — framed as reusing the established shared mechanism, **not** new auth/abuse hardening (consistent with the MVP "preserve existing posture" stance).
- **F7 [Low] — zero-matched-leads edge unaddressed.** Revision: §6.2/§10 document the decision — a zero-lead playbook is **valid** output (strategy/channel/template still serve the signal); the prompt must handle empty leads gracefully and the empty `keyFindings`/`systemImpact` must read sensibly. Not gated on leads.
- **F8 [Low] — reused toast says "signal briefing" for a playbook.** Revision: §6.3/§8.4 specify a playbook-appropriate toast description (the verbatim Spec 38 copy at `SignalsPage.tsx:536-544` is wrong for a playbook).
- **F9 [Low] — "prefer structured output" (§7.3) vs "free-text parser" test (§12) tension.** Revision: commit to structured/JSON output (the §7.3 preference, consistent with signals' free-text-parse fragility history) and reframe the §12 backend test to "structured-field extraction + malformed-JSON/fallback handling."
- **F10 [Nit] — D-5 cites a non-existent precedent (`signalBriefing.ts:43`).** Verified: `:43` is the per-lead `why` comment; `buildSignalBriefingArtefact` sets `executiveSummary: signal.description` (`:64`) and never maps `signal.source`. Revision: §9 D-5 reframes the Sources line as a **new** decision and removes the false precedent citation.
- **F11 [Nit] — two identically-labelled "Save as Artefact" buttons.** Revision: §6.1 adds a note that the two buttons (signal-level in the leads section, recommendation-level in the answer row) are intentional and spatially separated. (Relabel option raised under Open Questions.)

## Disagreed Findings

None. Every finding is factually correct against the code; the two I checked directly (F1 Unicode requirement, F2 ArtifactsPage consumer) both held.

## Deferred Findings

None. All agreed findings are in scope and cheap to address now; deferring any would leave the spec ambiguous for plan-writing.

## Severity Disagreements

- **F1: Medium, not High.** Agree the finding fully. It is a claim-accuracy/scope issue (a false "done" signal on a tracked debt), fixed by a wording/scope change — it does not affect the feature's design or block plan-readiness. Real, but Medium.
- **F4: Low, not Medium.** Agree the finding (specify the resolution). But the "Save as Artefact" button lives inside the `hasPrompt` block (`SignalCard.tsx:383`) and the answer-fetch effect itself bails on empty prompts (`SignalsPage.tsx:260`), so the button is only reachable for prompt-bearing NBAs — where `recommendationsList === signal.NBAs` and `signal.NBAs[index]` already resolves correctly. The mis-resolution is essentially unreachable in practice; this is a spec-completeness gap (Low), not a live bug (Medium).

## Open Questions

- **F11 relabel:** Should the recommendation-level button read **"Save Playbook"** (clearer; disambiguates from the signal-level button and conveys the richer output) instead of "Save as Artefact"? The user's feature request named "Save as Artefact" explicitly, so this is theirs to decide — not changed unilaterally; flagged for the operator.
- **D-3 wording (review Observation, no action requested):** §7.1 says the endpoint guards `CLAUDE_API_KEY` "exactly like the sibling `_claude` routes," but `signal_ask_claude` does **not** inline-guard the key (only `generate-signals-batch_claude` and `signal-lead-map_claude` do). The prescribed inline guard is correct regardless; the "exactly like" wording will be lightly tightened.
- **Round 2:** Whether to run a confirmation review of the revised spec before writing `plans/41-…` (see Round Recommendation).
