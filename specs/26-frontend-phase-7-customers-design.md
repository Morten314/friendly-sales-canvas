# Spec 26 — Frontend Phase 7: customers feature extraction

**Status:** Design — round 1
**Date:** 2026-06-04
**Type:** Phase spec (implements Spec 14 §4 Phase 7)
**Paired plan:** `plans/26-frontend-phase-7-customers.md` (written after this spec converges)
**Branch:** `phase-7-customers`
**Predecessor:** Phase 6 (mission-control, Spec 25 / plan 25) merged to `master` 2026-06-04 (`f4d262d`)

---

## §1 Goal and context

### 1.1 Goal

Extract the `customers` product surface into `src/features/customers/`, following the converged per-feature shape established in Phases 4–6: route registry, `<FeatureErrorBoundary>` wrap, TanStack Query data layer, zod contracts, per-component Vitest, and a public `index.ts` surface. Behavior, routes, and visuals are frozen (Spec 14 §2.3).

### 1.2 Scope correction — the master plan's Phase 7 source list is stale

Spec 14 §Phase 7 lists `ICPSummaryOpportunity` (6,925 LOC — nominally the second-largest file in the frontend) and `SuggestedICPsGallery` (1,037) as the primary sources moving in. **Both were deleted as dead files during Phase 1's LOC pass** — no live importers (both commits on `master`):

- `010c131 chore(fe): remove dead file src/components/customers/ICPSummaryOpportunity.tsx`
- `5a91848 chore(fe): remove dead file src/components/customers/SuggestedICPsGallery.tsx`

Spec 14's Phase 7 description is a frozen record of intent (per the "Spec-driven flow" convention) and is **not** amended here; **this spec is the authority** for what Phase 7 actually moves. The correction is logged as a master-plan delta at merge (Spec 14 §5.5).

### 1.3 Actual starting state

`/customers` is the **Profiler agent** UI (page title `👤 Profiler - Brewra`). The live surface:

| File | LOC | Role |
|---|---|---|
| `src/pages/Customers.tsx` | 143 | Route shell; 3 tabs (`icp-intelligence` / `lead-stream` / `chat-profiler`); window-event header bridge |
| `src/components/customers/SuggestedICPCards.tsx` | 2,494 | The only hard file: raw `fetch` reads/writes, flexible `/icp` parsing, heavy profiler `localStorage` (accept/reject/dismiss) |
| `src/components/customers/LeadStream.tsx` | 681 | **Pure mock data**; exports `LeadStreamPanel` + `getLeadCountForICP` (no fetch) |
| `src/components/customers/ICPIntelligence.tsx` | 62 | Thin wrapper over `SuggestedICPCards`; `profilerRefresh` header-event handler |
| `src/components/signals/ProfilerChatWithHistory.tsx` | 337 | Profiler chat shell; **relocated into customers** this phase (see §5). No fetch — `localStorage` chat-session history + `sessionStorage.signalsChatContext` only |

Total = 3,717 LOC (143 + 2,494 + 681 + 62 + 337) — smaller than Phase 6, and dominated by one component. The route is still a **legacy deep import** in `App.tsx` (`import Customers from "./pages/Customers"`); the per-feature route registry (`src/app/routes.tsx`) established in Phase 6 already composes market-research + mission-control.

### 1.4 What is already done (no work here)

- **`@/shared/profiler` cluster** (`profileIcpsExtract`, `profilerAcceptedIcpDisplay`, `missionProfilerSessionCache`) was promoted to `src/shared/` in Phase 6 (T8); `SuggestedICPCards` already imports from it. **No change** — it stays shared.
- **Customers has a visual-regression baseline**: `frontend/e2e/journeys/06-customers-page-load.spec.ts` + its snapshot. (Unlike market-research — TD-FE-17.)

---

## §2 Scope

### 2.1 In scope

- Move the five files above into `src/features/customers/` (relocating `ProfilerChatWithHistory` from legacy `src/components/signals/`).
- Route registry: `customers/routes.tsx` → `index.ts` → appended to `src/app/routes.tsx`; remove the legacy `App.tsx` import.
- Wrap the route in `<FeatureErrorBoundary featureName="Customers">`.
- TanStack Query data layer for `SuggestedICPCards`' fetch sites, with zod contracts and MSW handlers (per-phase deliverable; depth defined in §4).
- Decompose `SuggestedICPCards` (2,494 LOC) into mapping / storage / types / card subcomponents.
- Per-component Vitest; per-feature `README.md`; lock `index.ts` public surface.
- Amend the Spec 25 §6 Profiler-disposition coordination artifact with customers-side decisions (§6).

### 2.2 Out of scope (logged to `docs/TECH_DEBT.md` as `TD-FE-<n>`, starting at TD-FE-41)

- **No ProfilerChat↔ScoutChat dedup.** `ProfilerChatWithHistory` and `ScoutChatWithHistory` differ by 244 lines and are Phase 9's dedup charter. Phase 7 relocates ProfilerChat unchanged.
- **No chat-substrate promotion.** `SignalsContextChat` (the shared scout/profiler chat substrate) and `ScoutChatWithHistory` stay in legacy `src/components/signals/`; Phase 8 (signals) owns their relocation, Phase 9 the dedup. Customers imports the substrate via the transitional legacy path (§5). Rationale: promotion is cosmetic (the legacy import is already permitted) but inverts Phase 8/9 ownership and exposes a stateful, route-navigating, raw-fetch component to parity risk across three surfaces for zero user gain.
- **No consumption of mission-control's `useICPs`.** Customers keeps its own `/icp` + `customer_profile` read path (§4); the overlap and final profiler-merge ownership are Phase 9's call.
- **No window-event-bridge redesign.** The `profilerRefresh` / `profilerCreateICP` / `profilerExportData` / `navigateToLeadStream` / `icpAccepted` `window` events between the shell Header and the page are preserved as-is for parity.
- **No `UntypedProfilerIcpRecord` retyping** — carries the TD-FE-9/10 escape-hatch posture; Phase 13.

### 2.3 Frozen interfaces (per Spec 14 §2.3)

- Route URL `/customers` unchanged.
- The `/api/icp`, `/api/customer_profile`, `/api/customer_profile/from_suggested_icp` request/response shapes and the profiler `localStorage`/`sessionStorage` keys unchanged.
- Visual output unchanged (guarded by journey `06` VR baseline at the 2% threshold).

---

## §3 Target structure

```
src/features/customers/
├── pages/
│   └── CustomersPage.tsx              # from Customers.tsx; route shell; tabs; window-event bridge
├── components/
│   ├── icp-intelligence/
│   │   ├── ICPIntelligence.tsx        # thin wrapper (from components/customers/)
│   │   ├── SuggestedICPCards.tsx      # decomposed container (§7 stage 3)
│   │   ├── SuggestedICPCard.tsx       # extracted card (stage 3)
│   │   ├── icpMapping.ts              # extracted pure mappers (stage 3)
│   │   ├── suggestedIcpStorage.ts     # extracted optimistic-localStorage helpers (stage 3)
│   │   └── __tests__/
│   ├── lead-stream/
│   │   └── LeadStream.tsx             # mock panel; exports LeadStreamPanel + getLeadCountForICP
│   └── chat/
│       └── ProfilerChatWithHistory.tsx  # relocated; imports SignalsContextChat via legacy path
├── hooks/
│   ├── useCustomerProfile.ts          # useQuery (customer_profile read)
│   ├── useSuggestedIcps.ts            # useQuery (/icp recommendations read)
│   ├── useSaveCustomerProfile.ts      # useMutation
│   ├── useAcceptSuggestedIcp.ts       # useMutation (from_suggested_icp)
│   └── useRejectSuggestedIcp.ts       # useMutation (DELETE reject/dismiss)
├── services/
│   └── customers.ts                   # read/write API call layer
├── contracts.ts                       # zod schemas for /icp + customer_profile
├── types.ts                           # ExistingICP, SuggestedICP, ICPCardStatus, ICPAnalysis
├── routes.tsx                         # customersRoutes (/customers, wrapped in FeatureErrorBoundary)
├── index.ts                           # public surface (customersRoutes)
└── README.md
```

The exact subcomponent split inside `icp-intelligence/` is finalized during stage 3 (the plan enumerates it); the names above are the expected seams, not a contract. Each component folder (`icp-intelligence/`, `lead-stream/`, `chat/`) carries a co-located `__tests__/` — only `icp-intelligence/` is shown above, for brevity.

**Decomposition purity (coarse seam frame; full DAG deferred to the plan).** `icpMapping.ts` is pure (no React, no state — `mapApiICPToSuggested`, `mapCustomerProfileICPToExisting`, `normalizeIcpResponse`, `analyzeICP`); `suggestedIcpStorage.ts` is pure `localStorage` I/O (no React — the `profiler_*` pending/dismissed/recommended helpers); the card subcomponents consume the read hooks and receive container-held state via props. The exhaustive `useState`/`useEffect` footprint and how it flows into the cards is mapped during plan-writing (stage 3), not here.

**`LeadStream` rationale.** `LeadStream` has no data layer to migrate (pure mock, no fetch); it moves for **structural consistency** — it is customers-owned and consumed intra-feature by `SuggestedICPCards` (`getLeadCountForICP`), so it must co-locate (and §11's "`src/components/customers/*` gone" requires it). Leaving it in legacy is not an option.

### 3.1 Dependency posture

- Customers may import `@/shared/*`, `@/components/ui/*`, npm — and, transitionally (Spec 14 §3.3, Phases 4b–12), legacy dirs not yet migrated: `@/lib/api`, `@/hooks/usePageTitle`, `@/components/common/ErrorBoundary`, and `@/components/signals/SignalsContextChat` (the chat substrate). These legacy paths are **not** flagged by the `index.ts`-only lint (it forbids `@/features/*` deep paths only).
- Same-feature **alias** deep imports (e.g. `SuggestedICPCards` importing `getLeadCountForICP` from `@/components/customers/LeadStream`) become `@/features/customers/...` after the move and **would** trip the forbid-form `import-x/no-internal-modules`. As in Phase 6 (market-research alias self-imports), these are converted to **relative** imports during the stage-1 relocation so the lint stays green.
- `index.ts` exposes `customersRoutes` only — nothing cross-feature consumes customers today. Add exports lazily if Phase 9 needs them.

---

## §4 Data layer (Q1: relocate + decompose + TanStack, keep own read)

`SuggestedICPCards`' fetch surface (verified line refs):

| Call | Verb | Endpoint | Migration |
|---|---|---|---|
| read customer profile | GET | `customer_profile?org_id=` | `useCustomerProfile` (useQuery) |
| recommended ICPs | GET | `fetchIcpsRowsForOrg` (`@/shared/profiler`) + `buildIcpUrl` `/icp` | `useSuggestedIcps` (useQuery) |
| save profile | POST | `customer_profile` | `useSaveCustomerProfile` (useMutation) |
| accept suggested ICP | POST | `customer_profile/from_suggested_icp` | `useAcceptSuggestedIcp` (useMutation) |
| reject / dismiss ICP | DELETE | `apiFetch(..., {method:"DELETE"})` ×2 | `useRejectSuggestedIcp` (useMutation) |
| verify-after-save | GET | `customer_profile?org_id=` | folded into `useCustomerProfile` invalidation |

**Keep own read.** Customers does **not** route through mission-control's `useICPs`. Its flexible `/icp` response normalization (`mapApiICPToSuggested`, the multi-shape `normalizeIcpResponse`) is preserved verbatim and validated by a **permissive** zod contract (`.passthrough()`, optional fields) — the backend is suspended/variable (memory: `backend-11kr` 503) and the parser tolerates many shapes; a strict schema would over-constrain. `.parse` runs at the service boundary. Because every field is optional under `.passthrough()`, `.parse` does **not** reject real backend responses — there is effectively no throw path; the user-visible "degradation" is exactly today's behavior: missing fields fall back to the defaults already produced by `mapApiICPToSuggested` (best-effort extraction, empty/placeholder values), preserved verbatim. (The earlier "log-and-degrade rather than throw" framing overstated a throw path that an all-optional schema won't exercise.)

**TanStack parity (loading/error/refetch).** Customers' read hooks inherit Phase 3's `QueryClient` defaults (`shared/api/queryClient.ts`): `refetchOnWindowFocus: false` (already matches raw fetch — no focus refetch), `staleTime: 5 * 60_000` (preserves the prior ~5-min cache intent), `gcTime: 10 * 60_000`. The one default that diverges from raw fetch is the global `retry: 1` (raw fetch makes a single attempt); customers' read queries set `retry: false` where strict parity matters. Each consuming component's loading/error render output is audited against the raw-fetch equivalent during stage 3. §8's "no behavior change" is read with this qualification: the data *transport* moves to TanStack, but the rendered loading/error/data states are held to parity.

**Parity-safe optimism.** The accept/reject/dismiss flows use `localStorage` (`profiler_pendingRecommendedRejects`, `profiler_dismissedRecommendedIcpIds`, `profiler_recommendedICPs`, `PROFILER_ICP_DISPLAY_KEY(id)`) for optimistic UI. Phase 7 wraps the **network** calls in `useMutation` and triggers query invalidation, but **preserves the existing `localStorage` optimistic semantics** (extracted into `suggestedIcpStorage.ts`) rather than re-modeling optimism in the TanStack cache. Fully cache-native optimism is **deferred to TD-FE** — the same parity-first posture market-research took (TD-FE-19/21) under the advisory-gate, pre-launch CTO stance. The `profiler_recommendedICPs` `localStorage` fetch-cache is likewise left in place (TD-FE) rather than collapsed into the query cache in this phase.

---

## §5 Cross-feature coupling & chat handling (Q2: pull profiler chat into customers)

`ProfilerChatWithHistory` is used **only** by the customers page and has **no fetch** (chat-session `localStorage` + `sessionStorage.signalsChatContext` only). It moves into `features/customers/components/chat/` as a clean relocation. This matches Spec 14 §Phase 8, which assumes ProfilerChat "is already inside a feature from Phases 6/7" and reserves only the dedup for Phase 9.

**The substrate stays legacy.** `ProfilerChatWithHistory` imports `{ SignalsContextChat }` (component) + `{ SignalsChatContext, ChatMessage }` (types) from `SignalsContextChat` (494 LOC) — a stateful, Signals-domain component that issues raw `fetch` calls to `/api/signal_Ask` + `/api/signal_action` and hard-navigates via `navigate("/signals")`. It is also imported by `ScoutChatWithHistory` (legacy, Phase 8 target) and, as a type, by the already-merged `market-research/.../TrendsTab.tsx`. Promoting it would invert Phase 8/9 ownership and risk parity across three surfaces. **Phase 7 imports it via the transitional legacy path** `@/components/signals/SignalsContextChat`; relative `./SignalsContextChat` imports inside the relocated `ProfilerChatWithHistory` become that alias path. `CustomersPage` keeps its legacy `type SignalsChatContext` import likewise.

**Error boundary.** The route is wrapped in `<FeatureErrorBoundary featureName="Customers">` (Phase 6 convention). The existing inner `<ErrorBoundary>` (legacy `@/components/common/ErrorBoundary`) around the chat tab is preserved for parity (transitional import).

**Window-event bridge.** The shell Header dispatches `window` events the page listens for (`profilerRefresh`, `profilerCreateICP`, `profilerExportData`, `navigateToLeadStream`) and the page/`ICPIntelligence` dispatch `icpAccepted`. These are global-event coupling, not imports; preserved as-is. Replacing them with a typed mechanism is logged as TD-FE.

---

## §6 Profiler disposition amendment (coordination artifact for Phase 9)

Phase 7 amends Spec 25 §6 (and the mission-control README's "Profiler disposition") with these customers-side resolutions:

| Item | Phase-7 resolution | Final owner |
|---|---|---|
| `@/shared/profiler` util cluster | Unchanged — stays shared; customers consumes it. | settled |
| Customers ICP read path | **Keeps its own** `/icp` + `customer_profile` read (TanStack); does **not** adopt mission-control `useICPs`. | Phase 9 may consolidate |
| `ProfilerChatWithHistory` | **Relocated to `features/customers/components/chat/`** (unchanged logic). | Phase 9 dedups vs `ScoutChatWithHistory` |
| `SignalsContextChat` substrate | Stays legacy `src/components/signals/`; imported transitionally. | Phase 8 relocates; Phase 9 finalizes shared chat surface |
| ICP profiler-merge logic (`mergeProfilerAcceptedIcpDisplay`, in mission-control `components/icp/`) | Unchanged; customers reads merged display via `@/shared/profiler`. | Phase 9 |
| `UntypedProfilerIcpRecord` escape-hatch | Unchanged. | Phase 13 |

---

## §7 Execution stages (single branch, staged checkpoints)

One branch (`phase-7-customers`), one plan (`plans/26-...`), staged commit-series — Phase 6's model, not Phase 5's separately-merged sub-phases (it is smaller than Phase 6). Each stage is a green checkpoint (serial-relevant preflight subset + journey `06` + VR green); a failed stage reverts to the last green stage (Spec 14 §5.7) without reverting the whole phase — concretely, `git reset --hard` to the last green checkpoint commit (the branch is local/unshared during the phase, so discarding the failed attempt is acceptable and avoids `revert` noise).

1. **Scaffold + relocate (parity).** Scaffold `features/customers/` (`types.ts` / `index.ts` / placeholder `README.md`). Create `routes.tsx` (`/customers`, `<FeatureErrorBoundary featureName="Customers">`), re-export via `index.ts`, append to `src/app/routes.tsx`, delete the legacy `App.tsx` import. Mechanically move the five files into `pages/` + `components/{icp-intelligence,lead-stream,chat}/`; convert same-feature alias self-imports to relative; keep legacy `@/lib`, `@/hooks`, `@/shared/profiler`, `@/components/signals/SignalsContextChat`, `@/components/common/ErrorBoundary` imports. No logic change. Green.
2. **Read-path data layer (hook-first).** Build `contracts.ts` (permissive zod) + `services/customers.ts` + `useCustomerProfile` / `useSuggestedIcps` + MSW handlers, each with its own unit tests. The hooks are **created and unit-tested here but consumed into the components in stage 3** (hook-first, matching Phase 6's read-path→decomposition ordering); the monolith still runs its raw fetches at the stage-2 checkpoint. The transient unused-export window closes in stage 3, before the stage-5 full `knip --strict` merge gate — no dead code reaches `master`. Green.
3. **`SuggestedICPCards` decomposition.** Extract `types.ts`, the pure `icpMapping.ts` and pure-`localStorage` `suggestedIcpStorage.ts` (see §3 purity frame), and the card/modal subcomponents; swap the monolith's raw fetches for the stage-2 read hooks here (the loading/error-parity audit per §4 lands in this stage). One extraction per commit, green between each.
4. **Write-path mutations.** `useSaveCustomerProfile` / `useAcceptSuggestedIcp` / `useRejectSuggestedIcp` + MSW; preserve `localStorage` optimism (TD-FE for cache-native optimism). Green.
5. **Finalize.** All finalization and cross-artifact work happens **before** the gate: lock `index.ts` (`customersRoutes`); finalize `README.md` (purpose, public surface, key files, dependency notes, §6 disposition input); amend Spec 25 §6 + mission-control README; allocate the TD-FE entries. Only then, as the strictly-final action, run the full **serial** `npm run preflight` for the single merge. If a cross-artifact amendment surfaces a contradiction with a Phase-7 decision, it is resolved before the gate runs — never fixed forward through it.

---

## §8 Error handling, testing & parity

- **Safety net.** Journey `06-customers-page-load.spec.ts` + its VR snapshot guard the page across every stage. New per-component **Vitest + RTL + MSW** tests are added as each piece is extracted (read hooks in stage 2, mappers/storage/cards in stage 3, mutations in stage 4). `LeadStream` (mock) gets a render + `getLeadCountForICP` unit test.
- **Behavioral coverage to add.** The accept/reject/dismiss optimistic flow has no behavioral test today; stage 4 adds RTL+MSW coverage of accept → invalidation → card-status transition, and reject/dismiss → `localStorage` marker. If full behavioral coverage of the optimistic edge cases proves out-of-budget, the gap is logged as TD-FE (mirrors TD-FE-20).
- **Parity discipline.** No behavior or pixel change. The flexible `/icp` parser, the `localStorage`/`sessionStorage` keys, and the window-event names are preserved byte-for-behavior. Manual smoke sign-off on `/customers` (all three tabs) before merge.
- **Preflight.** Inner loop `npm run verify` per task; per-task `prettier --check` on touched files (verify omits format:check) and broader vitest when shared test infra (MSW handlers, fixtures) is touched. Merge gate is the controller's serial `npm run preflight`.

---

## §9 Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | `SuggestedICPCards` (2,494 LOC, flexible parsing, optimistic `localStorage`) breaks parity during decomposition. | Staged one-extraction-per-commit; MSW + VR baseline + new RTL tests green between each; gnarly optimism deferred to TD-FE rather than re-modeled. |
| R2 | Relocated `ProfilerChatWithHistory` drags a legacy substrate dependency. | Substrate stays legacy via the §3.3-permitted transitional import; lint-clean (not a `@/features/*` path); handoff recorded for Phase 8/9. |
| R3 | Customers' `/icp` + `customer_profile` read overlaps mission-control's `useICPs` — and the two read paths have **no coupling to detect divergence**: until Phase 9 consolidates, an `/api/icp` shape change must be updated independently in `features/customers/contracts.ts` and mission-control's ICP schema, with nothing to catch a missed update. | Accepted under the pre-launch, zero-user posture ("keep own read"); consolidation deferred to Phase 9 / Phase 13 (TD-FE-42). |
| R4 | Window-event header→page bridge is fragile/untyped. | Preserved for parity; redesign logged as TD-FE. |
| R5 | Backend suspended (503) → can't confirm live response shapes. | Permissive zod (`.passthrough`, log-and-degrade); MSW fixtures drive tests; loose schema per the prevailing posture. |

---

## §10 Provisional TD-FE allocations (numbers finalized in stage 5)

The numbers below are **provisional** — assigned from TD-FE-41 on the assumption that the register is unchanged from Phase 6's close at TD-FE-40. They are reconciled against the then-current register at stage-5 finalize (and renumbered if any intervening allocation has advanced the counter).

- **TD-FE-41** — `SuggestedICPCards` accept/reject/dismiss optimism stays in `localStorage`, not modeled in the TanStack cache (parity-safe deferral).
- **TD-FE-42** — Customers `/icp` + `customer_profile` read overlaps mission-control `useICPs`; consolidation deferred to Phase 9/13.
- **TD-FE-43** — `profiler_recommendedICPs` `localStorage` fetch-cache not collapsed into the query cache.
- **TD-FE-44** — Window-event header→page bridge (`profilerRefresh`/`profilerCreateICP`/`profilerExportData`/`navigateToLeadStream`/`icpAccepted`) is untyped global coupling; replace with a typed mechanism.
- **TD-FE-45** — `ProfilerChatWithHistory` imports the `SignalsContextChat` substrate via the legacy path; Phase 8 relocates the substrate, Phase 9 dedups ProfilerChat↔ScoutChat.

Entry wording is finalized in stage 5 alongside the numbering reconciliation above.

---

## §11 Done when

- `src/features/customers/` populated per §3; `src/pages/Customers.tsx` and `src/components/customers/*` gone; `ProfilerChatWithHistory` moved out of `src/components/signals/`.
- `/customers` resolves via the route registry; no legacy `App.tsx` customers import.
- Route wrapped in `<FeatureErrorBoundary>`; TanStack read+write hooks + zod contracts + MSW in place (optimism caveats per §4/§10).
- `SuggestedICPCards` decomposed; per-component Vitest green; `README.md` written; `index.ts` locked.
- Spec 25 §6 + mission-control README disposition amended; TD-FE-41+ allocated.
- Full serial `npm run preflight` green immediately before merge (journey `06` + VR included).
```
