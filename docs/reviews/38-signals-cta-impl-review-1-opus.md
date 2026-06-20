---
artifact: 38-signals-cta
artifact_type: impl
verdict: findings
reviewer_model: claude-opus-4-8
date: 2026-06-20
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

- **Repo layout:** this monorepo keeps specs/plans at root (`specs/38-signals-cta-design.md`, `plans/38-signals-cta.md`), not under `docs/`. Both were loaded for adherence checking.
- **Reviewed diff:** the implementation range `ba44d01..3c5753a` (12 commits — the 10 task commits + 2 `import-x/order` fix commits). The three baseline commits (`spec`, `plan`, `reviews` markdown) at `edcf069..ba44d01` are excluded from critique as already-reviewed intent artifacts; `base_ref` is recorded as `master` (= `edcf069`) per the command.
- **Reviewer attribution:** the filename carries a `-glm-5.2` suffix (the operator's chosen path), but this review was actually produced by **Claude Opus 4.8** — an independent fresh-eyes pass (a subagent with no implementation-orchestration context, over the full diff + spec + plan) plus controller verification of the headline finding against the spec text. `reviewer_model` reflects the true reviewer. Re-run under GLM-5.2 if a second model's perspective is wanted.
- **Overall:** solid branch. The queue hand-off, once-only drain, four-state leads section, degrade-never-throw contract, PDF free-text escaping (correct backslash-first order), the barrel-only cross-feature boundary, and the `why`-never-on-screen rule are all implemented correctly and backed by genuinely behavioral tests. Nothing Critical or High. Findings below are real but minor.

## Findings

### [Medium] Lock message does not dismiss "on the next interaction" — only half of Spec §2 is implemented
**Location:** `frontend/src/features/signals/components/SignalCard.tsx:97-124` (`showLockMessage` / `handleFindClick`); spec `specs/38-signals-cta-design.md:49`

Spec §2 (line 49) requires the lock message to auto-dismiss "after ~3 s **or** on the next interaction (any click on this card or its controls)." The implementation covers the 3 s timer (`setTimeout(..., 3000)`), clears on collapse (the `isDescriptionExpanded` effect) and on unmount, and re-hides when the now-accepted `Find Matched Leads` button is clicked. But no path dismisses the message when the user clicks anything *else* on the card — accept, reject, the bot icon, a recommendation. A user who clicks the locked CTA and then interacts elsewhere sees the amber lock line linger for the full 3 s rather than clearing on that next interaction. No test covers this clause (the CTA tests assert only the 3 s timeout and the not-accepted no-op).

Note the spec is internally inconsistent here: its own acceptance-criteria summary (line 189) lists only "lock message auto-dismisses (timer cleared on collapse/unmount)" and omits the "next interaction" clause — so the spec's testable acceptance list *is* satisfied, while its prose §2 is not. Low user impact. Fix options: (a) clear `showLockMessage` + the timer from a card-level `onClick`, or (b) accept the deviation explicitly and reconcile the spec prose to its acceptance list. This is a plan/spec-text decision for the synthesis step, not an unambiguous defect.

### [Medium] `leadsForSignal(signal.id)` recomputed multiple times per card render
**Location:** `frontend/src/features/signals/pages/SignalsPage.tsx:786-787`

Each rendered card calls the selector twice in the same render — `affectedLeadCount={leadsForSignal(signal.id).length}` and `matchedLeads={leadsForSignal(signal.id)}` — and the selector does `mapping.find(...)` (O(mapping)). Across a feed of N signals that is 2·N linear scans per render (≈O(N²) overall), plus a fresh array instance handed to `matchedLeads` every render. Negligible at today's small feeds, but it is exactly the "map-data lookup called multiple times per card" anti-pattern, and trivially avoidable: hoist `const leads = leadsForSignal(signal.id)` once at the top of the `.map` callback and pass `leads` to both props (`affectedLeadCount={leads.length}`). The save handler's separate call at `SignalsPage.tsx:509` is on click, so that one is fine.

### [Low] `titleCase` duplicated verbatim within the signals feature
**Location:** `frontend/src/features/signals/components/SignalCard.tsx:134` and `frontend/src/features/signals/lib/signalBriefing.ts:27`

The identical `const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)` appears in both files. Both live inside `features/signals`, so there is no cross-feature-barrel obstacle to sharing — a single helper in `features/signals/lib` consumed by both removes the duplication without violating the import boundary. (Contrast `resolveSignalAgentPresentation`, which is correctly duplicated-by-design to avoid deep-importing artefacts internals.) Fold into one helper.

### [Low] Recompute failure-path test emits an intentional `console.warn` — confirm pristine output
**Location:** `frontend/src/features/signals/hooks/useSignalLeadMap.ts:70` and `hooks/__tests__/useSignalLeadMap.test.tsx` ("recompute surfaces the error state when the refetch fails")

The `refresh` catch logs `console.warn("signal-lead-map recompute failed", err)`. The discriminating failure-path test deliberately drives a 500 through `fetchQuery` on recompute and asserts `isError` becomes true — so that test path executes the `console.warn`, and the full Vitest run shows the line. This is benign (the warn is real production behavior, and `fetchQuery` correctly propagates into query state — the actual fix being verified), but the suite's output is not strictly pristine. If a future gate enforces pristine console output, guard the case with `vi.spyOn(console, "warn")`. Harmless today.

### [Nit] PDF footer bullet is the one un-escaped mojibake offender
**Location:** `frontend/src/features/artifacts/lib/artefactPdf.ts` — the `(Generated by Brewra AI • ${date}) Tj` footer literal

`escapePdfText` folds `•` → `-` for all interpolated free-text, but the hardcoded footer still contains a literal `•` (U+2022), exactly the WinAnsi mojibake the fold was added to eliminate. It is a constant (not LLM input), so it is cosmetic and pre-existing — and it is already captured under TD-FE-78 (deeper generator non-compliance). One-character fix if touched (`-`, or run the constant through `escapePdfText`). Tracked, not blocking.

### [Nit] `escapePdfText`'s `(input ?? "")` guard is dead under the current typed call sites
**Location:** `frontend/src/features/artifacts/lib/artefactPdf.ts` — `escapePdfText = (input: string) => (input ?? "")...`

The parameter is typed `string` and every caller passes a non-nullable `string` (the `ArtefactItem` fields are required `string`/`string[]`). The `?? ""` defends against a `null`/`undefined` the type system already forbids. Harmless defensive coding; either drop it or widen the parameter to `string | undefined` if the guard is meant to be real.

### [Nit] Minor test-coverage gaps (carried from per-task reviews)
**Location:** multiple test files

A handful of small assertions are unpinned — none are correctness defects (the implementations are verified correct), only regression-safety gaps: (1) the queue drain's multi-item reverse-ordering path is untested (`artifacts/pages/__tests__/ArtifactsPage.test.tsx` — only the single-item, identity case is exercised); (2) `signalBriefing.test.ts` does not assert `actionDelegated`/`contextRationale` or the `agentIcon` identity (`toMatchObject` checks only name + color); (3) `contracts.test.ts` does not regression-pin the top-level `mapping` `.default([])` guard (the hook's `?? []` backstops it). (4) `escapePdfText` has no unit-level adversarial backslash+paren combined case, though the `createSimplePDF` integration test exercises that invariant. Add assertions opportunistically.

### [Nit] `resetArtefactQueue` JSDoc says "test-only" but it is part of the public barrel
**Location:** `frontend/src/features/artifacts/lib/artefactQueue.ts` (`resetArtefactQueue` JSDoc) + `index.ts` barrel re-export

The doc comment frames `resetArtefactQueue` as "test-only," yet it is re-exported through `@/features/artifacts` (consumed by `ArtifactsPage.test.tsx` via the barrel). The dual framing is harmless but mildly contradictory; soften the wording to "test-support / teardown reset" or keep it intra-feature if it is genuinely not meant for cross-feature use.
