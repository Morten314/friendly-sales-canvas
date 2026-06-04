---
artifact: specs/26-frontend-phase-7-customers-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-04
round: 1
---

## Findings

### [High] "Log-and-degrade" for permissive zod is under-specified

**Location:** §4, the sentence "unknown shapes log-and-degrade rather than throw, matching current behavior"

The spec introduces a permissive zod contract (`.passthrough()`, optional fields) and says unknown shapes "log-and-degrade" but never defines what degradation looks like. Does the UI show nothing? Stale `localStorage` data? A partial card with missing fields? An error state? The existing `SuggestedICPCards` presumably has implicit fallback behavior scattered through its 2,494 LOC; the spec should state what the user-visible degradation is so the plan can verify it's preserved. Without this, "parity" for the zod migration is untestable — the implementer will have to reverse-engineer the degradation behavior from the monolith during decomposition, which is exactly the kind of surprise that breaks stages.

**Suggestion:** Add a short paragraph to §4 defining the user-visible fallback: e.g., "if the response fails `.parse`, the component falls back to the raw JSON and renders with best-effort field extraction (matching the current `mapApiICPToSuggested` return-or-empty pattern)." Or explicitly state that `.passthrough()` means no fields are ever rejected (all optional), so degradation is "missing fields render as empty/defaults."

### [High] Stage 2 hook consumption path is ambiguous

**Location:** §7, stage 2 — "Components not yet decomposed"

Stage 2 creates `useCustomerProfile` and `useSuggestedIcps` but stage 3 decomposes `SuggestedICPCards`. How are the new hooks consumed in stage 2? Are they wired into the undecomposed monolith alongside the existing raw fetches? Are they created but unused until stage 3? The phrase "Components not yet decomposed" implies the hooks exist but aren't consumed, which would mean stage 2 adds dead code — an odd checkpoint. If they replace the raw fetches inside the monolith immediately, the spec should say so explicitly, and §8's "no behavior change" parity claim needs to account for the loading/error-state differences between raw `fetch` and TanStack `useQuery`.

**Suggestion:** Clarify in stage 2 whether the hooks replace the raw fetches in the monolith immediately (and if so, note the loading-state parity concern) or are created as a standalone service+contract layer with consumption deferred to stage 3.

### [High] Parity gap: TanStack Query loading/error/refetch behavior differs from raw fetch

**Location:** §4 (TanStack migration), §8 (parity discipline — "No behavior or pixel change"), §2.3 (frozen interfaces)

The spec mandates "no behavior or pixel change" (§8) while replacing raw `fetch` calls with TanStack Query. TanStack Query introduces different defaults: automatic refetch on window focus, stale-while-revalidate loading states, retry behavior, and different error propagation. The current raw `fetch` calls likely show a loading spinner on mount and error on network failure — TanStack's `status === 'loading'` / `status === 'error'` lifecycle may produce different UI timing. The spec acknowledges the risk abstractly (R1) but doesn't identify this concrete parity surface.

**Suggestion:** Add to §4 or §8 an explicit note that TanStack Query options must be set to match current behavior: e.g., `refetchOnWindowFocus: false`, `retry: false`, and that loading/error states in the consuming components must be audited to produce the same render output as the raw-fetch equivalent. Alternatively, acknowledge this as an accepted minor behavioral change and drop the absolute "no behavior change" claim.

### [Medium] SuggestedICPCards decomposition seams are under-analyzed for the riskiest stage

**Location:** §7, stage 3; §9, R1

Stage 3 is the riskiest work (decomposing a 2,494-LOC component with "flexible parsing, optimistic `localStorage`") yet gets the same level of specification as the other stages. The spec names the target files (`icpMapping.ts`, `suggestedIcpStorage.ts`, `SuggestedICPCard.tsx`, `types.ts`) but doesn't map the dependency graph: which functions call which, which state variables are shared, which effects chain together. The §3 disclaimer ("the names above are the expected seams, not a contract") and §7 ("the plan enumerates it") defer this to the plan, but seam identification is a design decision, not an execution detail — the plan needs enough structure to decompose safely.

**Suggestion:** Add a brief dependency note to §3 or §7: e.g., "`icpMapping.ts` is pure (no React, no state); `suggestedIcpStorage.ts` is pure localStorage I/O (no React); the card subcomponents consume both + the read hooks. Shared `useState` / `useEffect` chains between the container and the cards are [describe briefly]." Even a coarse DAG would give the plan enough to stage extractions safely.

### [Medium] Dual ICP read paths with no divergence detection

**Location:** §4 ("Keep own read"), §2.2 ("No consumption of mission-control's useICPs"), §6 table row 2, §10 TD-FE-42

Customers keeps its own `/icp` + `customer_profile` read path while mission-control has `useICPs`. The overlap is deferred to Phase 9/13 (TD-FE-42). The spec doesn't acknowledge that between Phase 7 and Phase 9, any backend shape change to `/icp` must be updated in two independent zod contracts + mappers with no coupling to detect the miss. This is an accepted risk (pre-launch, zero users), but it should be explicit.

**Suggestion:** Add a sentence to §4 or §9 noting that the dual read path means `/icp` contract changes require manual update in both `features/customers/contracts.ts` and `features/mission-control/contracts.ts` (or wherever mission-control's ICP schema lives) until Phase 9 consolidates them.

### [Medium] TD-FE allocations are both finalized and speculative

**Location:** §10 heading ("Expected TD-FE allocations (finalized in stage 5, from TD-FE-41)") vs. the body text

The section heading says "finalized in stage 5" and the closing line says "Exact numbers/wording are set at finalize against the then-current register," but the body already assigns specific numbers (TD-FE-41 through TD-FE-45) and specific descriptions. If these are placeholders that may change, labeling them with concrete numbers is misleading. If they're the actual intended allocations, the disclaimer is confusing.

**Suggestion:** Either remove the "exact numbers set at finalize" disclaimer and treat the listed entries as the allocation intent (with the caveat that the register counter may shift), or use placeholder labels (TD-FE-α through TD-FE-ε) and assign numbers only in the plan.

### [Medium] Stage 5 mixes code finalization with cross-artifact amendments

**Location:** §7, stage 5

Stage 5 bundles: lock `index.ts`, finalize `README.md`, amend Spec 25 §6, amend the mission-control README, allocate TD-FE-41+, and run the full serial `npm run preflight`. Amending two external specs/READMEs is a different concern than code finalization, and if the amendments reveal issues (e.g., Spec 25 §6 contradicts a Phase 7 decision), there's no room to iterate — the stage just runs the full preflight and declares done.

**Suggestion:** Split stage 5 into 5a (code finalization + preflight) and 5b (cross-artifact amendments + TD-FE allocation). This keeps the merge gate clean and isolates documentation work.

### [Medium] Rollback mechanism for failed stages is unspecified

**Location:** §7, "a failed stage reverts to the last green stage (Spec 14 §5.7) without reverting the whole phase"

The spec references Spec 14 §5.7 for the rollback mechanism but doesn't state the concrete git operation. Since this is a single-branch approach (`phase-7-customers`), a failed stage would need `git reset --hard` to the last green commit, or `git revert` of the failing commits. The choice matters: `reset --hard` loses the attempt (fine for local branches), while `revert` preserves history but creates noise. The implementer needs to know which.

**Suggestion:** Add a one-liner to §7 specifying the rollback mechanism (likely `git reset --hard` to the last green commit on the local branch, since the branch is not shared).

### [Low] e2e journey path omits `frontend/` prefix

**Location:** §1.4 ("`e2e/journeys/06-customers-page-load.spec.ts` + its snapshot"), §8 (same reference)

The actual path is `frontend/e2e/journeys/06-customers-page-load.spec.ts`. The spec's path is missing the `frontend/` prefix. Not a semantic problem (the spec is clearly frontend-scoped) but a factual inaccuracy that could confuse someone searching for the file from the monorepo root.

### [Low] No analysis of internal state complexity in SuggestedICPCards

**Location:** §1.3 (file table), §7 stage 3 (decomposition)

The spec notes `SuggestedICPCards` is 2,494 LOC with raw fetch, flexible parsing, and optimistic localStorage. It does not analyze the component's internal state footprint: how many `useState`/`useEffect` hooks, whether effects chain or interleave, how state flows to the card subcomponents. This is relevant for stage 3 decomposition because shared state between the container and extracted cards needs explicit lifting or prop-drilling design. The §9 R1 mitigation ("one extraction per commit, MSW + VR green") addresses regression risk but not design risk.

**Suggestion:** Add a brief state analysis to §1.3 or §3: e.g., "SuggestedICPCards manages [N] useState hooks and [M] useEffects; the main state seam is [describe], which will become props on the extracted card subcomponent."

### [Low] `LeadStream` relocation provides unclear value

**Location:** §1.3 (notes it's "pure mock data; no fetch"), §2.1 (in scope to move), §3 (target structure includes `lead-stream/LeadStream.tsx`)

`LeadStream` is 681 LOC of pure mock data with no API calls. It exports `LeadStreamPanel` (a render-only component) and `getLeadCountForICP` (a pure function). Moving it into the feature structure follows the established pattern but adds no data-layer benefit (no hooks, no contracts, no MSW). The spec should either acknowledge this as pattern-consistency work (valid but should be explicit) or consider leaving it in place until it gets real data.

**Suggestion:** Add a brief rationale to §2.1 or §3 noting that `LeadStream` is moved for structural consistency (all customers-owned files in one feature) despite having no data layer to migrate.

### [Nit] "LOC" table in §1.3 sums correctly but uses approximate total

**Location:** §1.3 — "Total ≈ 3,717 LOC"

143 + 2,494 + 681 + 62 + 337 = 3,717 exactly. The `≈` is unnecessary but harmless.

### [Nit] §1.2 commit SHAs are given without `phase-7-customers` branch context

**Location:** §1.2 — `010c131` and `5a91848`

These SHAs are on `master` (from Phase 1's dead-file cleanup), not on the `phase-7-customers` branch. A reader unfamiliar with the history might search for them on the wrong branch. Not a real problem — just a precision note.

### [Nit] §5 uses "raw-fetches" as a verb for SignalsContextChat

**Location:** §5 — "a stateful, Signals-domain component that raw-fetches `/api/signal_Ask` + `/api/signal_action`"

"raw-fetches" is used as a verb here. The meaning is clear from context but slightly jarring.

### [Nit] §3 tree shows `__tests__/` inside `icp-intelligence/` but not inside `lead-stream/` or `chat/`

**Location:** §3 target structure tree

`icp-intelligence/` has an explicit `__tests__/` entry; `lead-stream/` and `chat/` do not. §8 says `LeadStream` gets a unit test, so it presumably also needs a `__tests__/` dir. Minor inconsistency in the tree diagram.
