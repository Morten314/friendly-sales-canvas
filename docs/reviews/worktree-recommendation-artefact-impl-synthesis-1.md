---
synthesizes_review: worktree-recommendation-artefact-impl-review-1-glm-5.2.md
artifact: worktree-recommendation-artefact
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-23
round: 1
---

## Round Recommendation

no

Reason: Both findings verified correct against the shipped code and agreed; the fixes are small and localized (a re-entry guard + a test assertion), no Critical/High remains, no new design surface — apply, then the branch is merge-ready without a further review round.

## Agreed Findings

- **[Medium] Double-submit during playbook generation is unguarded — fix by adding a re-entry guard.** Verified against the shipped code: the Save button's `onClick` (`SignalCard.tsx:549-551`) was shipped *without* the plan-mandated `if (isGeneratingArtefact) return;` (Plan Task 9 Step 6 specified that line — it was dropped in implementation and the Task 9 task-review missed it); `handleSaveArtefactClick` (`:170-184`) checks only accepted + cached-answer; and the page handler `handleSaveRecommendationAsArtefact` (`SignalsPage.tsx:576`) guards on `item/isAccepted/orgId/uid/answer` but **not** `recommendationArtefactGenerating`. `aria-disabled` is non-blocking, so a second click in the ~5–10 s window runs the flow twice in parallel (a second paid Claude call drawing 2× on the limiter shared with `signal_ask_claude` → 429 risk; two PDFs/enqueues/toasts; a spinner-flicker as the first `finally` at `:622` clears the key mid-second-call). Violates spec §6.2 "non-interactive (prevents double-submit)". **Fix to be made:** add `if (recommendationArtefactGenerating) return;` at the top of `handleSaveRecommendationAsArtefact`, restore `if (isGeneratingArtefact) return;` in the card `onClick`, and add a concurrent-click test (the CTA test currently covers happy/error/gating only).

- **[Nit] The "justify-between" layout test asserts button presence, not layout — fix the assertion.** Verified: `SignalCard.cta.test.tsx:241-246` only checks the Chat + Save buttons exist; it never inspects the row container's `className`, so it would still pass if the row regressed to the pre-D-1 single left-aligned flex. The layout itself is correct (`SignalCard.tsx:505` `flex items-center justify-between`). **Fix to be made:** assert the row `<div>`'s `className` includes `justify-between` (RTL can read it off the wrapper), or rename the test to what it checks. (My own Task 9 task-review independently flagged this RTL DOM-order coverage gap.)

## Disagreed Findings

None — both findings were checked against the actual branch code and hold.

## Deferred Findings

None. Both fixes are cheap and the branch is unmerged, so there is no reason to defer either.

## Severity Disagreements

None. Medium and Nit are both apt. The Medium is correctly *not* Critical/High — it needs a fast double-click inside a narrow window, the product is MVP/0-users, and there is no data-loss/security exposure — but it is a genuine spec violation with a paid-API and duplicate-artefact consequence, so it is correctly Medium rather than lower.

## Open Questions

- **Robustness of the guard.** The suggested page-handler guard (`if (recommendationArtefactGenerating) return;`) reads React state captured in the handler's closure, so a same-React-tick double-fire is not 100% bulletproof; in practice React flushes the re-render between sequential browser click events, so it catches realistic double-clicks, and pairing it with the restored `onClick` guard covers the practical case. A fully race-proof latch would use a `useRef`. For MVP the state + onClick guard pair is proportionate — flagging only in case a hardened latch is preferred.
- **Review-artifact location.** This round's review file currently lives in the **main checkout** (`/projects/Brewra/brewra-gtm-intelligence/docs/reviews/`, untracked), whereas the 41 spec/plan review docs are committed on the branch. At merge, the impl review + this synthesis should be committed onto master alongside them.
- The reviewer's three no-action observations (the wire-stripped `status` field; the indirectly-covered `ArtifactsPage.tsx:130` re-download consumer; the retained `escapePdfText` ASCII-fold) were each checked and concurred with — no action.
