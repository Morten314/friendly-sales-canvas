---
artifact: worktree-recommendation-artefact
artifact_type: impl
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-23
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

- **Resume target disambiguation.** `worktree-apollo-ux-fixes` already carries a completed round-1 review **and** synthesis (verdict "apply fixes, no further round"), so it is not the resume target. This is the un-reviewed impl: `worktree-recommendation-artefact` — 14 commits (+3877/−243, cross-stack), spec/plan 41 already reviewed+synthesized, no prior impl review. The command's own notes name this worktree with `master` as base. Inferred inputs (no operator re-prompt, since `branch`/`base` are recoverable from context): branch=`worktree-recommendation-artefact`, base=`master`, spec=`specs/41-recommendation-artefact-design.md`, plan=`plans/41-recommendation-artefact.md`. Correct if these match intent.
- **Change-context source:** `git log -p master..worktree-recommendation-artefact` — 14 commits, ~266 KB raw (over the ~200 KB budget). **2 commit diff bodies dropped, oldest-first** (the Spec 41 doc `24d6f4b` and Plan 41 doc `73c6888`); **all 14 commit messages and the full `--stat` retained**, and the dropped docs were reviewed directly via the worktree files instead, so no signal was lost. Orientation: `git diff --stat master...worktree-recommendation-artefact` (35 files, +3877/−243). Final code was read from the checked-out worktree (more useful than raw patches).
- **Config loaded (from the branch):** `frontend/package.json` (engines `node >=21.2.0`; scripts — `verify`, `preflight`, advisory `bundle:check`, `knip --strict`), `frontend/knip.json`, `frontend/tsconfig.json`. Backend has none of the invariant-bearing manifests (`pyproject.toml`/`setup.cfg`/`ruff`/`mypy.ini` all absent); `tsconfig` carried no invariant this review relied on.
- **Static review only — suite not executable here.** No `pytest`/FE toolchain in this environment; the merge-gate `npm run preflight` (FE) + `backend/` pytest are the authoritative green check (AC#7). Findings are from reading the final code + tests, not from executing them.
- **Plan coverage:** Tasks 1–11 each map to a commit (models→`9dc006c`, prompt+fixture→`4222705`, service+parser→`7571806`, route→`d53d85a`, FE contract→`0ae5040`, builder→`81a793b`, jsPDF→`9f75430`, SignalCard→`ce55456`, SignalsPage→`be4873b`, TD-FE-78→`0059869`, README→`7e488c7`). Plan Task 5 ("Live-shape verification") is a deliberate no-commit step.

## Findings

### [Medium] Double-submit is not prevented during playbook generation — the button is `aria-disabled` only, and neither the card click handler nor the page handler guards on the generating state

**Location:** `frontend/src/features/signals/components/SignalCard.tsx:537-562` (button), `:170-183` (`handleSaveArtefactClick`), `frontend/src/features/signals/pages/SignalsPage.tsx:563-624` (`handleSaveRecommendationAsArtefact`), `:622` (`finally`).

Spec §6.2 specifies the generating state as *"spinner + 'Generating…', non-interactive (prevents double-submit)"*. The implementation only **appears** to satisfy this. During generation the button gets `aria-disabled={!canSaveArtefact || isGeneratingArtefact}` (`SignalCard.tsx:541-543`) plus `cursor-not-allowed`, but `aria-disabled` is a cosmetic/accessibility attribute — it does **not** stop `onClick`. The card's `handleSaveArtefactClick` (`:170`) checks only `isAccepted` and the cached-answer gate; it never inspects `isGeneratingArtefact`. The page handler's guard (`SignalsPage.tsx:576`) checks `item/isAccepted/orgId/uid/answer` but **not** `recommendationArtefactGenerating`.

So a second click inside the ~5–10 s window passes every gate and runs the flow a second time, in parallel with the first:
- a **second paid Claude call** — and because the token/run limiter is **shared** with `signal_ask_claude` (spec §7.1, accepted consequence), a double-burn draws 2× on the same 5-min window and can 429 the answer path;
- two PDFs auto-downloaded, two artefacts enqueued into `/artifacts`, two success toasts;
- a spinner flicker: the first invocation's `finally` (`:622`) sets `recommendationArtefactGenerating=null` while the second call is still in flight.

The button looking disabled while remaining fully clickable is the deceptive part. One-line fix: guard re-entry in the page handler — `if (recommendationArtefactGenerating) return;` (key-scoped if parallel different recs is ever desired, but only one recommendation is expandable at a time today, so a simple non-null check suffices), ideally mirrored by an `isGeneratingArtefact` early-return in `handleSaveArtefactClick`. There is currently **no test** for concurrent clicks (the CTA page test covers happy/error/gating only), so this is both unguarded and unverified.

### [Nit] The "justify-between" layout test asserts button presence, not layout — it would pass if the row regressed

**Location:** `frontend/src/features/signals/components/__tests__/SignalCard.cta.test.tsx:241-246`.

The test is named *"renders the answer action row as justify-between with Chat on the right"* (spec §12 required this assertion) but its body only checks that a "Chat with Scout" button and a "Save as Artifact" button exist — it never inspects the row container's `className`. The layout is in fact correct (`SignalCard.tsx:505` `flex items-center justify-between`), so this is a test-quality gap, not a product defect: the test gives false confidence and would still pass if a future edit reverted the row to the old single left-aligned flex (the exact regression spec §6.1 D-1 corrected). Either assert the row's `className` includes `justify-between` (RTL can read it off the wrapping `<div>`) or rename the test to reflect what it actually checks.

## Observations (no action)

- **Spec/plan adherence is complete.** All seven playbook sections source per §5/§9; gating matches §6.2 exactly and correctly checks the **map entry** not the rendered fallback (D-2, `SignalCard.tsx:176`); zero-leads is a valid, un-gated output (D-6); the recommendation-level success toast uses playbook-specific copy distinct from the Spec 38 briefing toast (`SignalsPage.tsx:606` vs `:554`); the signal-level button + toast were relabelled "Artefact"→"Artifact" (copy only); the jsPDF rewrite wraps + paginates and drops the fabricated-xref byte builder; TD-FE-78 is marked partially resolved with the stale "Strategist" consumer note corrected to `ArtifactsPage.tsx:130`. Backend parser is genuinely degrade-never-throw (`artefact.py:39-69`) and the service re-raises rather than swallows (`:147-149`); budget is finalized exactly once on the happy path (asserted by `test_service_returns_parsed_fields`).
- **`status` field is structurally unreachable but harmless.** The service returns `{"status": "success", **fields}` (`artefact.py:145`) while `RecommendationArtefactResponse` (the route's `response_model`) has only the five fields, so FastAPI strips `status` from the wire; the FE schema ignores it too (`contracts.ts:42-52`). Consistent end-to-end; flagging only because the service emits a field no client ever sees.
- **No regression test for the `ArtifactsPage.tsx:130` re-download consumer** (spec §12 asked for no-regression checks on both generator consumers). The generator unit test covers multi-page/pagination/`%PDF`-header in isolation, which is the substantive risk; both consumers call the signature-stable `generateAndDownloadPDF`, so the consumer paths are indirectly covered. Awareness only.
- **Shared `escapePdfText` ASCII-fold** correctly stays as the WinAnsi safety net (em/en-dash, smart quotes, bullet) with structural paren/backslash escaping dropped — matches §8.5; the Unicode-font-embedding half of TD-FE-78 stays open as documented.
