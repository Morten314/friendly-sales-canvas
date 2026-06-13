---
synthesizes_review: docs/reviews/35b-apollo-discovery-frontend-plan-review-1.md
artifact: plans/35b-apollo-discovery-frontend.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-13
round: 1
---

> Note: the prescribed `receiving-design-review` skill is not installed in this session; processed under the equivalent `superpowers:receiving-code-review` review-reception discipline (verify before agreeing; push back with technical reasoning; no performative agreement).

## Round Recommendation

no

Reason: No Critical/High findings; the four Mediums are mechanical plan-text fixes (an abort/recovery section + an empty-and-accumulate barrel) that open no new design surface, and the two disagreed nits are spec-aligned copy. Applying the agreed revisions makes the plan implementation-ready without another review round.

## Agreed Findings

- **[Medium] Add abort criteria** — Added an "Abort & recovery protocol" section: if a task's backend-contract assumption is invalidated by a live `/docs` check, stop and report to the operator before continuing.
- **[Medium] Add step-failure recovery** — Same section: run the full feature vitest before each commit; if a previously-green test breaks, fix it before committing (never commit a red feature suite).
- **[Medium] Barrel forward-reference (`LEAD_SOURCE_OPTIONS`, `useApolloUnlockToast`)** + **[Medium] Barrel forward-reference (`ApolloTile`)** — Same root cause, one fix: Task 1's `index.ts` now starts as an **empty barrel** (comment only); each task that creates a public module appends its own export (`ApolloTile`→T10, `useApolloUnlockToast`→T12, `leadSource`→T13, `UnverifiedBadge`→T14). Removes the broken intermediate commit. The misleading Task 1 code block + parenthetical are replaced.
- **[Low] Typo `redisccovery_guard`** — Fixed to `rediscovery_guard` everywhere it appears (types.ts enum, `discoveryPrompt.ts` + its test, `ApolloTile` branch).
- **[Low] Typo `AppolloConnectError`** — File Structure comment corrected to `ApolloConnectErrorShape`.
- **[Low] `buildApiUrl` assumed-but-unverified** — **Verified:** it is already exported at `frontend/src/shared/api/transport.ts:19`. Plan updated to state this as fact (the "export it if private" conditional dropped).
- **[Low] `useAuth` shape assumed** — **Verified:** `useAuth()` (AuthContext.tsx) returns `{ currentUser: User \| null, orgId: string \| null, ... }`; `currentUser?.uid` is the correct user id. Plan updated to state the confirmed shape (the "adjust if differs" hedge dropped).
- **[Low] No parallelizability guidance** — Added a "Parallelizable groups" note (T2+T3 after T1; T4+T5 after T3; T7+T8+T9 after T6; T13+T14 after the lead tables are located) to the Execution Handoff.
- **[Low] Task 11 mock placeholder** — Named the specific hooks to mock (`useDataSources`, `useDocumentSync`, `useLeadStreamStatus`) so the mount test is fully specified.
- **[Low] `connectApollo` success body untyped** — Success path now parses through a minimal `z.object({ connected: z.boolean(), status: z.string() }).passthrough()` for consistency with the other services (the raw fetch is still required for the error-body parse — G1 — but the success body no longer relies on a bare `as` assertion).
- **[Nit] Self-review lacks an AC trace** — Added an explicit AC1–AC6 → task trace to the Self-Review.

## Disagreed Findings

- **[Nit] "X of 4 agents ready" copy** — Keep. This is the spec's exact wording (§6.3: "`ready_count` of 4 agents ready") and the product FE design's (§4.1: "X of 4 agents ready"). Matching the approved product copy is intentional; "agents" is the product's chosen term for the four warmup milestones. No change.
- **[Nit] "REQUIRED SUB-SKILL" framing vs. two-option handoff** — No inconsistency. The header reads "Use superpowers:subagent-driven-development (recommended) **or** superpowers:executing-plans" — it already lists both options, matching the Execution Handoff. This header is the `writing-plans` skill's mandated template verbatim; the `REQUIRED SUB-SKILL` label means "you must use one of these to execute," not "only subagent-driven." No change.

## Deferred Findings

- **[Low] G5 `[N]` discovery-lead count UX** — The reviewer agrees this is "not a plan defect — a conscious deferral." No action: `/status` carries no count field; the prompt is gated on `last_discovery_at` and renders without a hard N (documented FE-only seam). **Trigger to revisit:** when a lead-count source lands (the lead-stream data layer wiring, tracked alongside TD-FE-63), surface the exact N in the keep/replace prompt.

## Severity Disagreements

None — the assigned severities are fair. The four Mediums are genuine plan-quality gaps (especially the barrel forward-reference, which would produce a broken intermediate commit); they are being fixed rather than contested.

## Open Questions

- The agreed revisions are mechanical and have been applied to the (uncommitted) plan draft in this same pass — no second review round is needed (Round Recommendation: no).
- The plan remains **uncommitted** on master's working tree. Commit target — a `spec-35-apollo-discovery`-style docs branch vs. a direct doc commit to master — is an operator decision (the prior 35a spec/plan/docs lived on the now-merged docs branch).
