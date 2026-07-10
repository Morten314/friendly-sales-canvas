---
synthesizes_review:
  - docs/reviews/48-org-null-safety-profiler-integrity-spec-review-2-glm-5.2.md
artifact: specs/48-org-null-safety-profiler-integrity-design.md
artifact_type: spec
reactor_model: opus-4-8-1m
date: 2026-07-09
round: 2
unresolved_high_or_critical: no
re_review_recommended: maybe
single_model_round: yes
---

## Round Recommendation

unresolved_high_or_critical: no
re_review_recommended: maybe
single_model_round: yes

Reason (unresolved): All four round-2 findings are Medium/Low; each was agreed and applied — none disagreed, deferred, or left unapplied.
Reason (re-review): Two consecutive glm-5.2 rounds have now converged (round 2 raised only Medium/Low, all resolved), but a second *distinct* model has still not looked (single-model floor) — a cross-model pass would add the most assurance if wanted, though nothing blocks proceeding to the plan.

## Agreed Findings

Round 2 reviewed the round-1-revised spec; the reviewer re-verified my new claims (25-site count, transitive upload chain, `firmographics` nesting, stale-key retirement) as accurate and confirmed all eight round-1 findings addressed. I re-verified the two load-bearing round-2 claims (F1 industry-constant, F3 sibling writes) against the prompt/code before agreeing.

- **[Medium] WS3 signature collapses to `segment`; over-suppression unacknowledged (agreed, applied).** Verified: `icp_generator.md.j2:13,16,63` instruct every ICP to use the company's *actual* industry, so `firmographics.industry` is ~constant across a company's ICP set and the effective discriminator is `segment` alone. Revised WS3 §Signature to say so explicitly; expanded the acceptance bar to state **both** error directions — the already-noted false-negative (segment rephrase → re-surface) **and** the previously-unacknowledged false-positive / over-suppression (two distinct ICPs sharing a canonicalized segment collapse to one signature → dismissing one hides the other, unrecoverable with no un-dismiss affordance) — both accepted at MVP with a revisit trigger (add a bucketed `company_size` band or a canonicalized `title` token before reaching for fuzzy matching). Softened Goal #4 to "durable, per-user, **best-effort**" to resolve the tension the reviewer flagged.
- **[Medium] Resolution timeout mislabels a mapped user on a cold/slow `GET /org` (agreed, applied).** My round-1 fix collapsed timeout into the no-org terminal state, so a mapped user on a cold Render instance (which can exceed 8–10s) would be told "contact your admin." Reworked WS1(a) into a **three-outcome model** — (1) resolved-with-org → app; (2) *authoritative* 404/empty → no-org "contact admin"; (3) timeout/5xx/network → a distinct "reconnecting, retrying" state (with auto-retry/backoff) that is the convergence guarantee but never the no-org copy. Restricted WS1(f) to the authoritative-no-org case and updated the Testing line accordingly.
- **[Low] WS1(d) omits the sibling document-upload writes (agreed, applied).** Verified `DataSourcesManager.tsx:111,177` (`formData.append("org_id", orgIdToUse)`, the doc/PDF uploads consuming the `:103`/`:168` coalesces). Added them to WS1(d) alongside the CSV chain so the plan doesn't treat the transitive chain as the only org-scoped upload write.
- **[Low] WS3 must define empty/missing-signature behavior (agreed, applied).** Added an explicit rule to WS3 §Signature: an empty/blank `firmographics.industry`/`segment` signature is **neither recorded nor matched** (no-signature ⇒ no suppression), so missing data can't collapse to a degenerate signature that suppresses every firmographics-less ICP. Added the corresponding Testing case.

## Disagreed Findings

(none)

## Deferred Findings

(none)

## Severity Disagreements

(none — Medium for the two signature/timeout findings and Low for the two enumeration/robustness findings are all reasonable as assigned.)

## Open Questions

- **Granularity is a judgment call the operator/plan may override.** The reviewer offered "accept segment-only granularity (both tradeoffs written down)" *or* "raise resolution with a low-variance discriminator." I chose **accept** (YAGNI at 0 users) with a documented revisit trigger. If the operator would rather not ship any over-suppression risk, the alternative — folding in a bucketed `company_size` band or a canonicalized leading `title` token — is pre-authorized by the acceptance-bar note and can be pulled into WS3 now instead of on trigger.
- **Carried forward from round 1 (still open, plan-level):** the exact persisted `firmographics` accessor shape (WS3 assumes `firmographics.industry`/`.segment` reachable on the stored doc); whether any org-scoped surface can mount before the protected-route gate (determines whether WS1(e) guards are load-bearing); and the adjacent latent bug `scout-chat/AddLeadModal.tsx:66` `const orgId = userId` (manual lead adds tagged with the uid, not the org) — flagged for plan-time triage under WS1(d)'s manual-add enumeration, deliberately out of this spec's null/placeholder-org scope.
