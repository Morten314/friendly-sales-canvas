---
synthesizes_review: docs/reviews/24b-frontend-phase-5b-data-layer-plan-review-1.md
artifact: plans/24b-frontend-phase-5b-data-layer.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-05-30
round: 1
---

## Round Recommendation

yes

Reason: Post-synthesis investigation (see Resolved Questions) found the plan's core response contract is wrong against the authoritative backend — the envelope is `{status, data}`, not `{component_name, status, result, cached}`; the load path is POST-only per-component (no GET / array / keyed-object load); and the request body omits backend-required `user_id`/`data`. Correcting Tasks 1–6 reopens significant design surface and warrants a fresh review round. (This supersedes the round-1 Finding 4 and Finding 9 edits.)

## Agreed Findings

- **[High] MSW/service/hook sequencing** — Reorder so MSW handlers run right after contracts: new order is Task 2 contracts → Task 3 MSW → Task 4 services → Task 5 hooks → Task 6 rewire. The cross-task "do Task 5 first then return" escape hatch is deleted so every task is a self-contained red→green. (Applied: MSW relocated and renumbered; service Step 2/Step 5 dependency notes corrected.)
- **[High] Task 1 has no completion gate** — Added Task 1 Step 3 "Verify the capture is complete (hard gate)": all 5 `component_name` captures present, load-latest shape captured, captured envelope diffed against `e2e/fixtures/api-mocks.ts`; any unobtainable shape is recorded as an explicit `z.unknown()` contract gap for the affected 5d–5h plan rather than skipped silently.
- **[Medium] Task 6 rewire recovery** — Added an end-of-Task-6 dev-server render spot-check and named the pre-Task-6 commit as the rollback anchor. (Fix reshaped — see Open Questions: the literal "between Step 1 and Step 2" preflight isn't reliably implementable because those steps touch interleaved fetch/state/cache sites.)
- **[Medium] Permissive `LatestResearchSchema`** — Removed the `z.object({}).passthrough()` catch-all in Task 2 Step 3; the real top-level shape is captured in Task 1, so the contract now encodes it (array, or the concrete keyed object) with a hard "do not ship the placeholder" comment.
- **[Medium] Section-fetch regression signal** — Added a Task 7 Step 4 spot-check that all five section components still render post-rewire, plus a directive to record a coverage gap in the §9 delta if `journeys/04` only asserts page-level orchestration.
- **[Medium] Spec §4.2 scope narrowing** — Extended the already-planned §9 delta (Task 7 Step 6) to also void §4.2's "Done when: the only raw `fetch` left is the analysis tab's" clause, stating 5b's done-when is stricter (zero raw `fetch` in the page).
- **[Low] ADR number collision** — Changed the Task 7 instruction from "Numbers 0003/0004 follow 0002" to "pick the next two available after `ls docs/adr/`", with a note to keep the in-code ADR reference in `services/marketResearch.ts` in sync with the chosen cache-ADR number.
- **[Low] Empty load-latest test** — Replaced the commented-out assertion in Task 2 Step 1 with an active `LatestResearchSchema.parse` test over a Task-1-captured load payload (mirrors the per-component test); the shape is known by Task 2, so no skip is needed.
- **[Nit] Stale "Task 8" references** — Changed "Task 8" → "Task 7" in Task 1 Step 2b and the Task 2 Step 3 preamble.

## Disagreed Findings

- **[Low] Rate-limiter carry-forward assertion** — The proposed service-test assertion checks implementation wiring (which client fn is invoked), not behavior; the MSW-backed test already proves the request is issued, and the shared `rateLimiter` is Phase-3 infrastructure whose regression coverage belongs to Phase 3, not 5b. The one-time Task 3/Step 1 grep (Task 4 after reorder) is adequate. The reviewer marked it non-blocking. No change.
- **[Nit] Self-review notes reference "Task 8"** — No actionable issue: the self-review note correctly cites ADR-0004 and contains no "Task 8" string; the finding's own body concludes "no action needed." The two real stale "Task 8" strings are in the body and are fixed under the Task-numbering finding.
- **[Nit] Verbose spec cross-references** — The reviewer classifies these as a positive ("not overengineering… No action needed"). Agreed they are not a defect; no change.

## Severity Disagreements

- **[High] MSW sequencing → Medium.** The plan supplies a working escape path ("do Task 5 first then return"), so this is a TDD-clarity issue, not a true deadlock that blocks progress. Agreed and fixed regardless.
- **[High] Task 1 completion gate → Medium.** The five canonical `component_name` values are enumerated in both "Endpoint reality" and Task 1 Step 2, so partial-capture risk is mitigated; the gate hardens an existing instruction rather than filling a vacuum.
- **[Medium] Section-fetch regression → Low.** 5b does not touch section-component code; the shared surface is narrow (test-only MSW handlers, the already-shared limiter), making the check defensive insurance.
- **[Medium] Spec §4.2 narrowing → Low.** The plan already flags the analysis-tab divergence in Task 7 Step 6, so the "silently… without flagging" premise is partly inaccurate; this is a precision tweak to an existing note.

## Resolved Questions (post-synthesis investigation, 2026-05-30)

All three were investigated against the repo — `e2e/journeys/04-market-research-5-components.spec.ts`, `MarketResearchPage.tsx`, the section components, and (authoritatively) the backend `MarketResponse`/`MarketRequest` models + `app/routers/market_research.py`.

- **journeys/04 coverage → page-level only.** The spec is an explicit smoke check: it asserts no `/login` redirect and `marketResearchRequestCount > 0` (≥1 fetch fired), nothing about per-section data. The section-fetch regression gap (Finding 5) is real; the Task 7 spot-check is the only signal, and per-section E2E assertions belong with 5d–5h. Do not cite journeys/04 as section-parity evidence.

- **Load-latest shape → no load-all exists, and the plan's envelope is wrong.** Backend `/market-research` is **POST-only** (`app/routers/market_research.py:17`, no GET); each call carries one `component_name` and returns `MarketResponse = {status: str, data: Dict[str, Any]}` (`app/models/market_research.py:15-25`). There is no array/keyed "load all" — the page hydrates with 5 per-component POSTs. Consequences: (a) the plan's `ResearchComponentSchema` (`{component_name, status, result, cached}`, copied from the 5a E2E mock) does not match `{status, data}` and would `.parse`-throw on every real response; (b) `loadLatestResearch` (a GET) + `LatestResearchSchema` (array/object) model a non-existent endpoint and must be removed/reconceived — note 24c–24h's locked contract consumes `useLatestResearch`; (c) `fetchResearchComponent`'s body omits backend-required `user_id` and `data` (`MarketRequest`, `app/models/market_research.py:7-12`); (d) the inner `data` doc is genuinely opaque (`Dict[str, Any]`, varies per component), so per-component internals still need live/service capture for 5d–5h. Also: this route HAS `response_model=MarketResponse`, contradicting the plan's "endpoints lack response_model" premise, and Task 1 Step 2b's fallback to `e2e/fixtures/api-mocks.ts` is unsafe — those fixtures carry the wrong envelope. Supersedes the round-1 Finding 4 and Finding 9 edits.

- **Task 6 checkpoint → not at the reviewer's boundary, but a better one exists.** The on-mount cache *read* calls the same `setX` setters the rewire removes, so "after replace-fetches, before delete-cache" will not compile. Compile-safe boundary instead: (1) atomically wire hooks + remove the per-component fetchers + remove the on-mount cache-read + remove the server-data `useState`s (mutually coupled) → page compiles and renders from hooks, with dead save-helpers/`CACHE_DURATION`/cache-bust still present but harmless; **checkpoint here** (preflight + dev render spot-check); (2) sweep the dead helpers/constants/imports. Refines Finding 3.
