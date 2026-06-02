---
synthesizes_review: docs/reviews/24f-frontend-phase-5f-competitor-landscape-plan-review-3.md
artifact: plans/24f-frontend-phase-5f-competitor-landscape.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-02
round: 3
---

> **Note on review provenance:** review-3 (`Jun 1 23:52`) was authored against the *original* plan, before this session's round-1/round-2 edits landed (commits `18dcfcd`, `bad6725`). Several findings (F2, F8, and parts of F1/F5/F9) were therefore already resolved in rounds 1–2; they are categorized as Disagreed/no-action with the resolving round cited. Each finding below is evaluated against the **current** plan, not the version review-3 saw.

## Round Recommendation

no

Reason: Round 3 surfaced no Critical/High; its two Mediums are either already resolved in round 1 (the Task-4 `journeys/04` run) or closed by a cheap traceability revision (TD-FE bound to the 5i zero-fetch gate), and everything else is Low/Nit or already handled in rounds 1–2 — the loop has converged.

## Agreed Findings

- **[Medium] F1 — surviving raw fetches vs spec §6/§11 "zero raw fetch per section" gate.** The *new* substance (beyond round-2's keep-both decision) is the spec-compliance tension: two raw fetches survive 5f, but spec §6 "Done when" and §11 item 3 (5i's zero-raw-fetch confirmation) demand none. Revision (Task 4): log the `TD-FE` for the two surviving fetches **at execution time** (not only at the Task N+2 handoff), and sharpen its trigger from "next touch of the write path" to **"must be resolved before 5i's zero-raw-fetch gate (spec §11 item 3) — migrate, or have 5i explicitly accept this documented exception."** Makes the deferred work traceable and binds it to the gate it must satisfy.
- **[Low] F3 — hook test thin.** Round 2 added a data-shape assertion; error/refresh coverage is still missing. Revision (Task 4 Step 1): add an error-state test (`useResearchComponent` errors → `isError` propagates) and a `refresh()` → `regenerate.mutate(RESEARCH_COMPONENTS.competitor)` assertion (plus `isRefreshing`); note coverage expands under TDD during implementation.
- **[Low] F4 — `forceUpdate` fate unstated.** Correct: Task 4 Step 3's deletion list omits the `forceUpdate` `useReducer`. Revision: state its expected fate explicitly — delete if it only forced a re-render after the now-removed fetch/cache writes; keep if it serves edit-state re-renders (determine in the Task 0 audit / Task 4).
- **[Low] F6 (parity half) — verify the real `orgId` source.** Correct and useful: the plan asserts `orgId` "default is `"brewra"` — keep behavior" without confirming whether the live code actually reads from `useTenant()`/TenantContext. Revision (Task 4 Step 3): verify the live source and preserve whatever it actually is, rather than assuming a literal hardcode. (The TD-FE half is declined — see Disagreed.)
- **[Nit] F9 — heading reads as current truth.** Round 1 added the "pre-5a anchor; do not use literal line numbers" caveat, but the heading still leads with "Confirmed live structure." Revision: rename the Task 0 Step 4 heading to "**Pre-5a anchored structure (re-confirm against the merged tree)**" so the temporal qualifier leads instead of trailing.

## Disagreed Findings

- **[Medium] F2 — "no `journeys/04` after Task 4."** Already resolved in round 1: Task 4 Step 5 already runs `npx playwright test e2e/journeys/04-...` at the checkpoint (with an orphan-`:5173`-preview kill first), which is exactly the reviewer's primary recommendation — review-3 predates that edit. The secondary ask (add an *unscoped full* `vitest run` at Task 4) is declined: full-suite vitest flakes under sandbox CPU contention (a known, recorded issue), and the scoped section vitest + the Task-4 `journeys/04` run + the Task N+2 full `preflight` already cover the regression surface.
- **[Low] F6 (TD-FE half) — log the hardcoded `orgId` as TD-FE.** Declining, same grounds as round-2 F5: MVP posture (0 users; the team explicitly does not track auth/multi-tenancy hardening as debt; preserve existing behavior as-is). The actionable parity-verification half is captured under Agreed. Trigger to revisit the tenancy model as a whole: external/multi-tenant users.
- **[Nit] F8 — conditional error-boundary embedded in Task 4 Step 4.** Already resolved in round 1: Task 4 Step 4 is now "Boundary — confirm only (no wrap added)" because 5c wraps the whole tab and 5d added no section boundary, so there is no longer an "(if warranted) wrap" conditional split across tasks. Review-3 predates that edit.

## Deferred Findings

- **F1 underlying — the actual write-path mutation migration** (the `/api/ask` write + `/api/market_intelligence` post-save re-read) stays out of 5f, mirroring 5d and exercising the spec §4 amendment's per-section deferral authority. Trigger (sharpened by this round): **before 5i's zero-raw-fetch confirmation** — either migrate the write path off raw fetch, or 5i's gate explicitly accepts the documented TD-FE exception. This is the one item 5g–5i pre-planning should carry forward.

## Severity Disagreements

None material. (F2's substance is "already implemented," not a severity dispute; F1/F3/F4/F6/F9 severities are accepted as assigned.)

## Open Questions

- **5i gate acceptance (from F1):** will 5i's zero-raw-fetch confirmation (spec §11 item 3) accept a documented TD-FE exception for this section's two surviving write-path fetches, or must a mutation migration be scheduled before 5i? This is a cross-phase dependency for 5g–5i planning, not resolvable within 5f.

## Non-findings acknowledged (no action)

- **F5 [Low] (`unknown[]` no downstream safety)** — reviewer states "No action required"; round 2 already added the explanatory comment marking the extractors (Task 3) as the typed boundary. Confirmed.
- **F7 [Nit] (N+1/N+2 naming indirection)** — reviewer states "No action required"; round 1 added the renumber note to the reconcile item. Confirmed.
