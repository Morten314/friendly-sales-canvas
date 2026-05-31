---
artifact: plans/24c-frontend-phase-5c-page-decomposition.md
artifact_type: plan
verdict: findings
reviewer_model: claude-opus-4-8
date: 2026-05-31
round: 3
---

## Context

Round 3 reviews the **structural-only rewrite** of plan 24c (the round-1/-2 reviews critiqued the pre-R1 plan and are stale). Reviewed against the reconciled Spec 24 §5 (round 5), `docs/reviews/24c-frontend-phase-5c-R1-escape-hatch-findings.md`, the live `MarketResearchPage.tsx`/`SafeMarketIntelligenceTab.tsx`, and the repo's known E2E gotcha (TD/memory: orphan preview server → false-green). The plan is well-structured, correctly serializes the page-editing chain, and re-arms the R1 hatch. Findings concentrate on the Task 1↔Task 2 boundary (sequencing) and a few faithfulness/hidden-prereq gaps.

## Findings

### [High] Task 1↔Task 2 boundary drops the Safe sanitization for one commit and contradicts itself on knip

**Location:** Task 1 Step 2 ("render `MarketIntelligenceSections` directly (not via the deleted Safe/MarketIntelligenceTab wrappers — see Task 2)") vs Task 1 Step 4 note ("knip is deferred … the page still imports the to-be-removed wrappers until Task 2") vs Task 2 (which adds `sanitizeIntelligenceProps` + deletes Safe).

Two problems compound here:

1. **Sanitization regression for the Task 1 commit.** If Task 1 makes `IntelligenceTab` render `MarketIntelligenceSections` *directly* (no Safe), then the recursive prop-sanitization (`targetMarkets` coercion, render-unsafe-object stringification, Set round-trip) is **absent** in the committed, "green" Task 1 state — it isn't restored until Task 2. That's a one-commit behavior regression in a plan whose whole premise is "structural-only, behavior identical," and it puts the regression *inside* Task 1's full-suite run: if any fixture exercises an object that Safe currently stringifies, Task 1 reds for a reason Task 1 didn't cause.

2. **The knip-deferral rationale is factually wrong.** Step 4 says knip is deferred because "the page still imports the to-be-removed wrappers until Task 2" — but if Task 1 renders Sections directly, the page does **not** still import Safe after Task 1 (Safe becomes orphaned at Task 1, not Task 2). And separately, per Spec 24 §7 / `knip.json` (`entry` makes every `src/**` a production entry), **knip never reports unused *files*** in this repo — so an orphaned Safe file wouldn't trip knip regardless. The stated reason doesn't hold either way.

**Fix (cleaner sequencing):** make Task 1 a *pure* move — `IntelligenceTab` keeps rendering via `SafeMarketIntelligenceTab` (import it from its current location and lift the existing `<SafeMarketIntelligenceTab .../>` call verbatim into the container). Behavior is then provably identical at the Task 1 commit (sanitization intact, same wrapper). Task 2 then does the *single concern* it's named for: extract `sanitizeIntelligenceProps`, swap Safe→`FeatureErrorBoundary`, delete Safe + `MarketIntelligenceTab`. This also makes Task 2's "delete Safe, confirm no importer" grep meaningful (the importer is `IntelligenceTab`, which Task 2 just rewired) and removes the need for the bogus knip-deferral note. Each task stays one concern; sanitization is never dropped.

### [Medium] Task 4 contains a literal placeholder in a code block (`/* the page's scoutResearchContext type */ ...`)

**Location:** Task 4 Step 1, the `TrendsTabProps` interface — `scoutResearchContext: /* the page's scoutResearchContext type */ ...;`.

This is a "No Placeholders" violation: the prop type is left as a comment + `...`. The page declares `scoutResearchContext` via an inline `useState<{…}>` literal (page L392), so there is no named type to import yet. The plan should instruct: extract that inline object type to a named type (e.g. `ScoutResearchContext` in the feature's `types.ts`) and import it in both the page and `TrendsTab`, *or* define the shape explicitly in `TrendsTabProps`. As written, an implementer can't type the prop without re-deriving the shape from the page. Name it.

### [Medium] Task 1 omits the window-global refresh helpers from the "move the data layer" inventory

**Location:** Task 1 Step 2's data-layer bullet (lists fetches, the six data states, cascade/timestamp logic, cache helpers, per-section state) — but not the `declare global { interface Window { refreshStartTime?, getAllScoutComponentResponses?, getScoutResponses? } }` block (page L59–65) and the code that assigns/reads `window.*` for refresh coordination.

The page's data/refresh layer writes and reads these `window`-attached helpers (the module comment at L55–58 says they're "written in this file and read elsewhere within it"). If the refresh logic moves into `IntelligenceTab` but the `declare global` augmentation and the `window.*` assignments are left behind (or vice versa), you get a TypeScript error (missing augmentation) or a runtime no-op (helpers never attached) — neither caught by "looks structural." Add an explicit line: move the `declare global` augmentation + all `window.refreshStartTime`/`getAllScoutComponentResponses`/`getScoutResponses` assignments together with the refresh logic into `IntelligenceTab`, and confirm no other module reads them (grep first).

### [Medium] Task 4's `journeys/04` run has no guard against the repo's known orphan-preview-server false-green

**Location:** Task 4 Step 3 (`npx playwright test journeys/04`) and Task 6 Step 1 (`npm run preflight`).

This repo has a documented failure mode: Playwright `reuseExistingServer` + a stale `:5173` vite preview → the E2E/VR run silently tests the *old* build and reports false-green (logged as repo memory/feedback). A 5c plan whose central safety claim is "`journeys/04` proves behavior parity" is exactly where a false-green is most dangerous — it would let a real extraction regression merge. Add a pre-run guard to Task 4 Step 3 (and Task 6 Step 1): kill any orphan preview/dev server on the E2E port before invoking Playwright, so the journey tests the build under change. Without it, the plan's load-bearing parity signal is defeatable by environment state.

### [Low] Task 1 is a very large single-concern commit; reviewability is inherently strained

**Location:** Task 1 as a whole ("absorbs the intelligence-tab JSX **plus** the page's market-research data layer … `IntelligenceTab` will be large").

This is acknowledged and is largely *inherent* to a structural extraction (you can't half-move the data layer and keep the page green). Not a defect to fix by splitting — splitting would leave intermediate red states. But flag it explicitly as a reviewer expectation: Task 1's diff will be ~3–4k lines moved, and the review of it should focus on *move-faithfulness* (nothing renamed/rewired, no behavior edited in transit) rather than line-by-line logic. Consider stating that the Task 1 review is a "moved, not modified" diff audit (e.g. confirm the moved blocks are identical modulo import paths) so the reviewer knows what to verify.

### [Low] Shell-retained handlers' independence from the moved data layer is asserted but not verified in-plan

**Location:** Task 3 (keeps `handleChatWithScout`/`handleChatAboutCoverage`/`handleSendToStrategist` shell-owned) + Task 1 (moves the six data states into `IntelligenceTab`).

The plan assumes the three shell-retained handlers don't read any state that Task 1 moves into `IntelligenceTab` (Task 0 said they touch `scoutResearchContext`/`scoutMode`/nav/`localStorage`). That's probably true, but it's load-bearing: if `handleChatWithScout(leads, reportFilter)` reads `marketData` or a section's data to build the scout context, moving that data into `IntelligenceTab` breaks the shell handler at Task 1. Add a one-line verification to Task 1 (or Task 3): grep the three handlers' bodies for references to the six moved data states / fetch results; if any exist, that data is *shared* (not intelligence-local) and the move plan needs adjustment. Cheap insurance against a coupling Task 0 didn't explicitly rule out.

### [Low] Task 4 `signalsChatContext` placement is left as an in-flight decision rather than decided

**Location:** Task 4 Step 1 ("decide in Step 2 whether that effect lives in `TrendsTab` … or stays in the shell") and Step 2.

Leaving a structural decision to implementation time is acceptable for genuinely either-fine choices, but here it has a correctness wrinkle worth pre-resolving: the `signalsChatContext` effect is gated on `activeTab === "trends"`; if `TrendsTab` only mounts when trends is active (it's rendered in the conditional out-of-band branch), moving the effect into `TrendsTab` changes *when* it runs (mount vs activeTab-change) — equivalent only if `TrendsTab` truly mounts/unmounts on tab change. State the expected default (move it into `TrendsTab`, which mounts only when trends is active → the `activeTab === "trends"` guard becomes implicit) and the one thing to verify (that the out-of-band branch mounts/unmounts `TrendsTab` rather than hiding it with CSS).

### [Nit] Plan header doesn't flag the stale round-1/-2 reviews

**Location:** Header / "REWRITTEN" note.

`docs/reviews/24c-…-plan-review-{1,2}.md` + their syntheses exist and critiqued the *pre-rewrite* plan; they no longer correspond to this document. The rewrite note explains the change but doesn't tell a future reader that reviews 1–2 are superseded. One line ("plan-review-1/-2 critiqued the pre-R1 plan and are superseded; review resumes at round 3") prevents someone applying stale findings.
