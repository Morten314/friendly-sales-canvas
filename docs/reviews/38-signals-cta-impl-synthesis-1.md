---
synthesizes_review: 38-signals-cta-impl-review-1-glm-5.2.md
artifact: 38-signals-cta
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-20
round: 1
---

## Round Recommendation

no

Reason: No Critical/High findings; the two agreed fixes are small and well-scoped (no new design surface), and the remainder are Low/Nit deferred — a re-review round isn't warranted (focused verification of the two fixes suffices).

## Agreed Findings

- **Lock-message staleness after accept (from the Medium "next interaction" finding).** Verified against `SignalCard.tsx:97-124`: after the user clicks Accept, `isAccepted` flips true and the CTA unlocks, but the now-stale *"Accept this signal to unlock matched leads"* line lingers for up to the full 3 s. This is the genuinely valuable slice of spec §2's "dismiss on the next interaction." Fix: clear `showLockMessage` + the lock timer when `isAccepted` becomes true (an effect keyed on `isAccepted`), and pin it with a test (accept while the lock message is showing → message clears immediately). The broader "any click anywhere on the card" reading is split off to Deferred.
- **`leadsForSignal(signal.id)` recomputed twice per card render** (`SignalsPage.tsx:786-787`). Verified: `affectedLeadCount={leadsForSignal(signal.id).length}` and `matchedLeads={leadsForSignal(signal.id)}` both invoke the O(mapping) selector in the same render. Fix: hoist `const leads = leadsForSignal(signal.id)` once at the top of the `.map` callback; pass `leads` to `matchedLeads` and `leads.length` to `affectedLeadCount`. Pure cleanup, no behavior change.

## Disagreed Findings

- None on substance. Every finding is technically accurate. The only partial pushback is on the *scope/severity* of the "next interaction" finding (see Severity Disagreements) and on actioning two Lows now (see Deferred) — not on whether the observations are correct.

## Deferred Findings

- **Lock message dismiss on "any click on the card or its controls"** (the full spec §2 clause beyond the accept-flip case). Low value: the 3 s auto-dismiss already self-heals, and the spec's own acceptance summary (`specs/38-signals-cta-design.md:189`) does not list this clause. Trigger: user feedback that the lingering line is distracting, or a spec-reconciliation pass (see Open Questions).
- **`titleCase` duplicated within the signals feature** (`SignalCard.tsx:134`, `signalBriefing.ts:27`). Marginal: a shared one-line helper adds an import indirection roughly equal to the duplication it removes (YAGNI). Trigger: a third occurrence, or a future `features/signals/lib` consolidation pass.
- **Recompute failure-path test emits an intentional `console.warn`** (`useSignalLeadMap.ts:70`). No gate enforces pristine console output today (the full preflight passed with the line present), and the warn reflects real production behavior. Trigger: introduction of a pristine-console gate → guard the case with `vi.spyOn(console, "warn")`.
- **PDF footer `•` un-escaped** (`artefactPdf.ts` footer literal). Already captured as **TD-FE-78** (deeper generator non-compliance / WinAnsi mojibake) by design — out of this branch's scope. Trigger: TD-FE-78 pull-forward.
- **`escapePdfText`'s `(input ?? "")` dead guard** under the typed `string` contract. Harmless defensive coding; cheap insurance against a future untyped caller. Trigger: drop opportunistically if the function is touched, or widen the param to `string | undefined` if the guard is meant to be real.
- **Minor test-coverage gaps + `resetArtefactQueue` "test-only" JSDoc wording** (multi-item drain ordering; `signalBriefing` `actionDelegated`/`contextRationale`/`agentIcon`; top-level `mapping` `.default([])`). Regression-safety/doc polish only — the implementations are verified correct. Trigger: opportunistic when next editing those files.

## Severity Disagreements

- **"Lock message next-interaction" finding — effectively two issues at different severities.** The *accept-flip staleness* (stale "accept to unlock" lingering after the signal is already accepted) is a legitimate **Medium** and is being fixed. The *general "dismiss on any click"* portion is at most a **Nit**: the spec's own testable acceptance list omits it, the 3 s timer covers it, and there is no observed UX harm. I'm not treating the broad clause as a Medium gap.

## Open Questions

- **Spec internal inconsistency (operator's call).** `specs/38-signals-cta-design.md:49` (prose) says the lock message dismisses "after ~3 s **or** on the next interaction (any click on this card or its controls)," but the acceptance-criteria summary at line 189 lists only "auto-dismisses (timer cleared on collapse/unmount)." After the agreed accept-flip fix, the implemented behavior is: 3 s timer + clear-on-collapse + clear-on-unmount + clear-on-accept. Do you want (a) the accept-flip fix only [recommended — covers the real staleness], (b) the full "any click" dismiss as well, or (c) reconcile the spec prose to the implemented/accepted behavior and leave code as-is? Per CLAUDE.md, specs are a frozen record of intent, so I lean toward (a) + (c).
