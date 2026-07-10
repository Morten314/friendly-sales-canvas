---
synthesizes_review:
  - docs/reviews/48-org-null-safety-profiler-integrity-spec-review-3-glm-5.2.md
artifact: specs/48-org-null-safety-profiler-integrity-design.md
artifact_type: spec
reactor_model: opus-4-8-1m
date: 2026-07-09
round: 3
unresolved_high_or_critical: no
re_review_recommended: maybe
single_model_round: yes
---

## Round Recommendation

unresolved_high_or_critical: no
re_review_recommended: maybe
single_model_round: yes

Reason (unresolved): All three round-3 findings are Medium/Low; each was agreed and applied — none disagreed, deferred, or left unapplied.
Reason (re-review): Third consecutive glm-5.2 round, now converged to one Medium + two Low — all refinements of the round-2 three-outcome model, all applied, no new High and no new workstream — but a *distinct* model has still not looked (single-model floor). A cross-model pass is the highest-value next step if any re-review is done; nothing blocks proceeding to the plan.

## Agreed Findings

Round 3 reviewed the round-2-revised spec. The reviewer re-verified that all four round-2 findings are applied in the current text (three-outcome model; both-directions signature bar + revisit trigger + "best-effort" Goal #4; sibling `DataSourcesManager.tsx:111,177` writes; no-signature ⇒ no-suppression rule + test) and confirmed the round-2 verification still holds (25 fallback sites, transitive upload chain, `firmographics` nesting, stale-key retirement). All three new findings target gaps the round-2 three-outcome model itself introduced — verified against WS1(a) before agreeing.

- **[Medium] Warm cached org must survive a transient confirm-failure (agreed, applied).** WS1(a) said a warm-cache user "paints instantly," gated on "outcome (1) only," and "GET /org wins over cache" — but never stated whether a usable cached org persists through a *transient* `GET /org` failure. The naive reading tears a returning mapped user (the most common user) out of the painted app into the (3) reconnecting state on any 5xx/network blip (common on Render), flickering the UI and negating the optimistic cache. Revised WS1(a): a warm cached org **counts as outcome (1)** and survives a transient confirm-failure (app stays mounted, retries in background); outcome (3) is reached only when there is **no usable cached org**. Reframed the spec-46 authority line so "GET /org wins over cache" means a *successful* resolution that disagrees with the cache — not a transient non-resolution discarding good data. Added the warm-cache + transient-failure → no-teardown test case.
- **[Low] Stale-async guard on retries + bounded reconnecting state (agreed, applied).** Adding auto-retry/backoff to outcome (3) multiplies in-flight `GET /org` requests, raising the chance a late resolution lands *after* a user change / logout and mutates state for the wrong user — the stale-async variant of the very fire-and-forget race this spec fixes ("reset on user change" clears stored state but not an in-flight request). Added to WS1(a): a late-arriving resolution or retry MUST be discarded if the user changed/logged out while in flight (uid/generation check, or cancel-in-flight). Second sub-point: the spec said "at least one auto-retry / backoff" with no upper bound; added that the reconnecting state is bounded by a max-retry ceiling, after which auto-retry stops and a manual *try again / sign in again* affordance is offered rather than reconnecting forever. Added the corresponding test assertions.
- **[Low] `orgResolved` naming footgun → three-state `orgStatus` + explicit has-org gate predicate (agreed, applied).** `orgResolved` is `true` for both outcome (1) (has-org) **and** outcome (2) (authoritative-no-org); an implementer keying the route gate on `orgResolved` alone — a natural reading of the name — would mount org-scoped UI for the no-org outcome and render against a null org, the exact failure WS1 exists to prevent. The prose was correct (gate is outcome-(1)-specific) but the predicate was never written out. Reworked WS1(a) to recommend a **three-state `orgStatus`** (`resolved` / `no-org` / `transient`) rather than a boolean-plus-flag, and — if a derived `orgResolved` convenience is retained — mandated the render gate be the **has-org** predicate `orgResolved && orgId` (equivalently `orgStatus === "resolved"`), never `orgResolved` alone. Propagated the explicit predicate to WS1(a)'s gate line, WS1(e)'s loading affordance, and the WS1 testing bullet (org-scoped routes mount only on has-org; the no-org outcome renders the no-org state, not org-scoped UI).

## Disagreed Findings

(none)

## Deferred Findings

(none)

## Severity Disagreements

(none — Medium for the cache/transient interaction (it degrades the primary happy path, though with a correct cached org, not a wrong-tenant read) and Low for the two plan-level robustness guards are all reasonable as assigned.)

## Open Questions

- **The round-3 fixes are guardrails whose *mechanics* the plan must specify.** The spec now mandates (a) a uid/generation check or in-flight cancellation on user change, and (b) a max-retry ceiling with a manual give-up affordance. These are correctly design-level here, but the plan must pin the concrete mechanism (how the generation token is threaded through the async resolver; the exact retry count / backoff schedule / give-up copy). Agreed and applied at spec level; flagged so the plan doesn't treat the prose as sufficient.
- **Carried forward, still open (plan-level).** The exact persisted `firmographics` accessor shape (WS3 assumes `firmographics.industry`/`.segment` reachable on the stored doc); whether any org-scoped surface can mount before the protected-route gate (determines whether WS1(e)'s guards are load-bearing vs. belt-and-suspenders — now sharpened by the F3 predicate, since a route gate keyed on the wrong boolean *is* such a mount vector); and the adjacent latent bug `scout-chat/AddLeadModal.tsx:66` `const orgId = userId` (manual lead adds tagged with the uid, not the org) — re-confirmed real this round, deliberately out of this spec's null/placeholder-org scope, flagged for plan-time triage under WS1(d)'s manual-add enumeration.
