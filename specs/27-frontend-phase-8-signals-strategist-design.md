# Spec 27 — Frontend Phase 8: signals + strategist feature extraction

**Status:** Design — round 2 (spec-review-1 + -2 synthesized 2026-06-04 at `docs/reviews/27-frontend-phase-8-signals-strategist-design-spec-synthesis-1.md` + `…-synthesis-2.md`; converged — no further round recommended)
**Date:** 2026-06-04
**Type:** Phase spec (implements Spec 14 §4 Phase 8)
**Paired plan:** `plans/27-frontend-phase-8-signals-strategist.md` (written after this spec converges)
**Branch:** `phase-8-signals-strategist`
**Predecessor:** Phase 7 (customers, Spec 26 / plan 26) merged to `master` 2026-06-04 (`4421589`)

---

## §1 Goal and context

### 1.1 Goal

Extract the `signals` and `strategist` product surfaces into `src/features/signals/` and `src/features/strategist/`, following the converged per-feature shape established in Phases 4–7: route registry, `<FeatureErrorBoundary>` wrap, TanStack Query data layer, zod contracts, per-component Vitest, locked public `index.ts`. As the *enabling* move, relocate the shared scout/profiler **chat substrate** (`SignalsContextChat`) out of legacy `src/components/signals/` into `src/shared/`, resolving TD-FE-45. Behavior, routes, and visuals are frozen (Spec 14 §2.3).

Phase 8 depends only on Phase 5 and the already-merged Phase 0–4 foundation (Spec 14 §4 "Parallel execution protocol") and is **off** the critical path (`5→6→7→9→11`). Its master-plan charter is to *record* a chat-dedup handoff for Phase 9, not perform it.

### 1.2 Scope corrections — the master plan's Phase 8 description diverges from live code

Spec 14 §Phase 8 is a frozen record of intent (per the "Spec-driven flow" convention) and is **not** amended here; **this spec is the authority** for what Phase 8 actually does. Corrections logged as master-plan deltas at merge (Spec 14 §5.5). Four divergences:

1. **The `components/signals/*` files are not Signals-page components.** `Signals.tsx` (1,730 LOC) imports neither `ScoutChatWithHistory` nor `SignalsContextChat`. The two files in `components/signals/` are **chat plumbing consumed by other features**: `SignalsContextChat` by customers' `ProfilerChatWithHistory` + signals' `ScoutChatWithHistory`; `ScoutChatWithHistory` only by market-research's `TrendsTab`. The folder name is a coincidence.

2. **`ScoutChatWithHistory` cannot move into `features/signals/`.** It imports `ScoutChatPanel` (681 LOC) — which is **load-bearing inside `features/market-research/`** (`MarketIntelligenceSections` uses it 5×, and it depends on market-research's internal `types.ts`) and so cannot leave market-research — plus `AddLeadModal` + `SuggestedCompaniesSection`; and its only consumer is market-research's `TrendsTab`. Placing it in `features/signals/` would create a forbidden feature import **cycle** (`signals → market-research` via ScoutChatPanel, `market-research → signals` via TrendsTab; `import-x/no-cycle` is live since Phase 4a). **Resolution:** the scout-chat wrapper + its two movable deps relocate into `features/market-research/` (their true home — see §5); `features/signals/` holds the Signals page only.

3. **`StrategistWorkspace` (963 LOC) is runtime-unreachable.** Nothing in `src/` writes `sessionStorage.strategistContext` (verified by textual grep of `strategistContext` across `src/` — only the two reads in `Deals.tsx` exist — plus a separate grep of navigate-to-strategist call sites, none of which set it). Because `Deals.tsx` reads a **static literal** key, any writer would have to round-trip that same literal, so a dynamically-keyed writer is implausible — though not formally excluded; Phase 13 re-verifies before any removal. Every navigation into the strategist route (`LeadsTable`, `Sidebar`, `MarketResearchPage`, `StrategistRecommendations`) arrives *without* setting it, so Deals' `context.leads ? <StrategistWorkspace/> : <StrategistRecommendations/>` always takes the Recommendations branch. Phase 1's dead-code pass missed it because knip/ts-prune see the static import, not the dead runtime branch. **Resolution:** relocate as-is + flag (§6); do **not** revive or delete (parity; dead-code removal is Phase 13's charter).

4. **`Deals.tsx` is the strategist page, not a Phase 12 small-page.** It backs `/your-ai-team/strategist/:tab` (the only thing rendered there) with `/deals` and `/your-ai-team/strategist` as redirects to it; there is no standalone deals page. The master-plan §12 `Deals.tsx` listing and the `features/README` `deals` naming-map entry are both stale. **Resolution:** Phase 8 (strategist) claims `Deals.tsx`, renames it `StrategistPage.tsx`; reconciliation logged (§6, TD-FE).

LOC drift from Spec 14's figures (point-in-time anchors per §1.3 note): `Signals.tsx` 1,544→**1,730**; `ScoutChatWithHistory` 439→**473**; `SignalsContextChat` 411→**494**. Used as measured — and re-measured by the plan at execution; these are point-in-time anchors, not trusted figures.

### 1.3 Actual starting state

**Signals surface** (route `/signals` + alias `/agent-hub`; *legacy deep import* in `App.tsx` — a direct `import Signals from "@/pages/Signals"` wired into `App.tsx`'s `<Routes>`, the pattern the per-feature route registry replaces):

| File | LOC | Role |
|---|---|---|
| `src/pages/Signals.tsx` | 1,730 | Route page (`const Index` → default export). 9 top-level helpers + one large component. 4 raw-`fetch` endpoints; heavy `localStorage` accept/reject state; writes `sessionStorage.signalsChatContext`. Imports only `@/features/shell` (Layout), `@/shared/auth`, `@/hooks/use-toast` (legacy), `@/lib/types/escape-hatches` (`UntypedBackendSignal`). |

**Chat plumbing** (in `src/components/signals/`, but consumed cross-feature — not by the Signals page):

| File | LOC | Role / consumers |
|---|---|---|
| `src/components/signals/SignalsContextChat.tsx` | 494 | Shared scout/profiler chat **substrate**. Exports `SignalsContextChat` + types `SignalsChatContext`, `ChatMessage`. Raw `fetch` to `/api/signal_Ask` + `/api/signal_action`; `localStorage` accepted/rejected; hard-navigates `navigate("/signals")`. **No feature imports.** Consumed by `ScoutChatWithHistory`, customers' `ProfilerChatWithHistory` (component, via legacy path — TD-FE-45), and as a *type* by `TrendsTab` + `CustomersPage`. |
| `src/components/signals/ScoutChatWithHistory.tsx` | 473 | Scout chat wrapper. `localStorage` session history. Imports `SignalsContextChat` (sibling) + `AddLeadModal`, `ScoutChatPanel`, `SuggestedCompaniesSection` from `components/market-research/`. **Only consumer: `features/market-research/.../trends/TrendsTab.tsx`.** |

**Scout-chat deps in `src/components/market-research/`** (legacy; Phase-5 residue):

| File | LOC | Consumers |
|---|---|---|
| `AddLeadModal.tsx` | 201 | `ScoutChatWithHistory` only. Imports only UI + `@/lib/api` + `@/shared/auth` + `@/hooks/use-toast` + `@/lib/jwt`. Cleanly movable. |
| `SuggestedCompaniesSection.tsx` | 56 | `ScoutChatWithHistory` only. UI-only imports. Cleanly movable. |
| `ScoutChatPanel.tsx` | 681 | `ScoutChatWithHistory` **and** `features/market-research/.../MarketIntelligenceSections.tsx` (5×). Imports `./types` (market-research `types.ts`). **Stays in market-research.** |

**Strategist surface** (route `/your-ai-team/strategist/:tab` + `/deals` & `/your-ai-team/strategist` redirects; legacy deep import in `App.tsx`):

| File | LOC | Role |
|---|---|---|
| `src/pages/Deals.tsx` | 91 | Strategist route page. Reads (+ clears) `sessionStorage.strategistContext`; tabs `workspace`/`leadstream`; `workspace` → `context.leads ? <StrategistWorkspace/> : <StrategistRecommendations/>`. **Only consumer** of all three strategist components. |
| `src/components/market-research/StrategistWorkspace.tsx` | 963 | **Runtime-unreachable** (§1.2.3). Raw `fetch` `GET /chat/?question=` (its only network call). File-header `// HANDOFF → strategist` annotation. |
| `src/components/strategist/StrategistLeadStream.tsx` | 309 | Reached (`leadstream` tab). No fetch, no storage. |
| `src/components/strategist/StrategistRecommendations.tsx` | 210 | Reached (`workspace` tab, always — see §1.2.3). No fetch, no storage. |

Reachable strategist surface ≈ 610 LOC (Deals + Recommendations + LeadStream); the lone strategist backend call lives in the dead `StrategistWorkspace`, so the **reachable** strategist surface has no live backend calls.

### 1.4 What is already done / inherited (no work here)

- **Route registry** (`src/app/routes.tsx`) exists from Phase 6 and composes market-research + mission-control + customers; Phase 8 appends signals + strategist (append-only — Spec 14 §4).
- **`<FeatureErrorBoundary>`** (`@/shared/components`) live since Phase 4a; consumed by Phases 5–7.
- **`index.ts`-only lint** (`import-x/no-internal-modules`, forbid-form `@/features/*/!(index)` + `/**`) live since Phase 6 stage 1b (Spec 14 §8 Q16); cross-zone rules + `import-x/no-cycle` live since 4a.
- **Naming map** (`src/features/README.md`) already reserves `signals` = 8, `strategist` = 8.
- **TanStack `QueryClient`** configured at app root in Phase 3 (`shared/api/queryClient.ts`); zod-at-the-boundary contract pattern established (Spec 14 §8 Q4).

---

## §2 Scope

### 2.1 In scope

- **`features/signals/`** = the Signals page only: relocate `Signals.tsx` → `pages/SignalsPage.tsx`; **full 5a-style decomposition** (page shell + section components); page data layer; route registry; `<FeatureErrorBoundary featureName="Signals">`; README; locked `index.ts`.
- **`src/shared/chat/`** (new): relocate `SignalsContextChat` (substrate) here; repoint `ProfilerChatWithHistory` (customers) + `ScoutChatWithHistory` import lines **and the `ProfilerChatWithHistory` test `vi.mock` path** + the `SignalsChatContext` *type* imports in `TrendsTab` + `CustomersPage`. **Resolves TD-FE-45.**
- **`features/market-research/`** (scope reach, user-approved — §5): relocate `ScoutChatWithHistory` + `AddLeadModal` + `SuggestedCompaniesSection` from legacy `components/` into the feature; switch `TrendsTab` to relative imports.
- **`features/strategist/`**: relocate `Deals.tsx` → `pages/StrategistPage.tsx` + `StrategistRecommendations` + `StrategistLeadStream`; relocate `StrategistWorkspace` **as-is** (§6); route registry (incl. redirects); `<FeatureErrorBoundary featureName="Strategist">`; README; locked `index.ts`.
- **Data layer (signals)**: TanStack Query for the Signals page's fetch sites with zod contracts + MSW (depth §4). The `signal_Ask` + `signal_action` endpoints (shared with the substrate) land in `src/shared/` — zod contracts in `shared/api`, hooks in `shared/chat`; `generate-signals-batch` + `fetch-signals` (page-only) land in `features/signals/`.
- Per-component Vitest (following the Phase 5–7 co-located `__tests__/` convention — one test file per component in the nearest `__tests__/`; the §3 tree shows directories, not a one-dir-per-component mandate); amend the master-plan delta + naming-map reconciliation at merge.

### 2.2 Out of scope (logged to `docs/TECH_DEBT.md` as `TD-FE-<n>`, provisional from TD-FE-47)

- **No ScoutChat↔ProfilerChat dedup.** Phase 9's charter. After §5, both wrappers point at the *same* shared substrate, so the dedup is trivially set up — but it requires authority over scout + customers/market-research surfaces Phase 8 lacks. Handoff recorded (§5).
- **No `StrategistWorkspace` revival or removal.** Relocated as-is; its dead `sessionStorage.strategistContext` reader path and raw `/chat/` fetch are preserved for parity (TD-FE-47); Phase 13 evaluates removal.
- **No `ScoutChatPanel` / market-research `types.ts` relocation.** They stay in legacy `components/market-research/` (market-research residue, not signals/strategist scope); imported transitionally. Phase 9 (scout) or a market-research cleanup owns them (TD-FE-51).
- **No retyping of `UntypedBackendSignal`** (escape-hatch, TD-FE-10 posture); Phase 13.
- **No re-modeling of the `localStorage`/`sessionStorage` primary-state stores** (signals accept/reject; `signalsChatContext`; `strategistContext`) into the TanStack cache — extracted into hooks but kept on their storage primitive, parity-first (TD-FE-49/50; mirrors TD-FE-19/41/44).
- **No window-event / sessionStorage-handoff redesign.** The `signalsChatContext` handoff (Signals page → scout chat) is preserved as-is (TD-FE-50).

### 2.3 Frozen interfaces (per Spec 14 §2.3)

- Route URLs unchanged: `/signals`, `/agent-hub`, `/your-ai-team/strategist/:tab`, `/your-ai-team/strategist`, `/deals` (redirects included).
- `/api/generate-signals-batch`, `/api/signal_Ask`, `/api/fetch-signals`, `/api/signal_action`, and `GET /chat/` request/response shapes unchanged; the `localStorage` accept/reject keys, `sessionStorage.signalsChatContext`, and `sessionStorage.strategistContext` keys/shapes unchanged.
- Visual output unchanged (guarded by the Signals VR journey at the 2% threshold; see §8 for the strategist VR-coverage gap).

---

## §3 Target structure

```
src/shared/
├── chat/                                # NEW — cross-feature chat substrate (≥2-feature rule: signals + customers)
│   ├── SignalsContextChat.tsx           # from components/signals/; exports SignalsContextChat + types
│   ├── useSignalAsk.ts                  # signal_Ask hook (consumed by substrate + signals page) — built 8c
│   ├── useSignalAction.ts               # signal_action hook (consumed by substrate + signals page) — built 8c
│   └── __tests__/
└── api/
    └── contracts.ts                     # + zod schemas for signal_Ask / signal_action (shared boundary)

src/features/signals/                    # NEW — the Signals page only
├── pages/SignalsPage.tsx                # from pages/Signals.tsx (Index → SignalsPage), decomposed (8c)
├── components/                          # 5a-style section components (signal cards, action bar, chat-context setup)
│   └── __tests__/
├── hooks/
│   ├── useGenerateSignalsBatch.ts       # useMutation (page-only)
│   ├── useFetchSignals.ts               # useQuery (page-only)
│   └── useSignalAcceptance.ts           # localStorage accept/reject (primary store; not TanStack — TD-FE-49)
├── services/signals.ts                  # page-only API layer (batch + fetch-signals)
├── contracts.ts · types.ts · routes.tsx · index.ts · README.md · __tests__/

src/features/strategist/                 # NEW
├── pages/StrategistPage.tsx             # from pages/Deals.tsx (renamed); keeps strategistContext read (parity)
├── components/
│   ├── StrategistRecommendations.tsx    # from components/strategist/
│   ├── StrategistLeadStream.tsx         # from components/strategist/
│   └── StrategistWorkspace.tsx          # from components/market-research/, AS-IS (TD-FE-47); raw fetch intact
│   └── __tests__/
├── types.ts (StrategistContext) · routes.tsx · index.ts · README.md

src/features/market-research/            # EXISTING — receives the scout-chat wrapper + its movable deps (§5)
└── components/.../                       # ScoutChatWithHistory.tsx + AddLeadModal.tsx + SuggestedCompaniesSection.tsx
```

After this phase: **`src/components/signals/` is emptied** (substrate → shared, wrapper → market-research); `src/components/strategist/` is emptied (→ strategist feature); `src/components/market-research/` retains `ScoutChatPanel.tsx` + `types.ts` (out of scope — TD-FE-51) and loses `StrategistWorkspace` + `AddLeadModal` + `SuggestedCompaniesSection`.

Exact subcomponent seams inside `features/signals/components/` are finalized during plan-writing (8c); the names above are expected seams, not a contract.

### 3.1 Dependency posture — cycle proof

The cycle the master plan's literal instruction would create (§1.2.2) is avoided by routing the substrate through `shared/` and keeping the scout-chat wrapper inside market-research. Feature-level edges **after** all stages:

| Edge | Via | Permitted? |
|---|---|---|
| `features/signals` (page) → `features/shell` (Layout) | `shell/index.ts` | ✓ cross-feature via index; shell ↛ signals (no cycle) |
| `features/signals` → `shared/*` (auth, chat hooks, api) | direct | ✓ feature → shared |
| `features/market-research` → `shared/chat` (substrate + types) | direct | ✓ feature → shared |
| `features/customers` → `shared/chat` (substrate + types) | direct | ✓ feature → shared (was the TD-FE-45 legacy path) |
| `features/market-research` internal: `TrendsTab` → `ScoutChatWithHistory` → `AddLeadModal`/`SuggestedCompaniesSection` | relative | ✓ same-feature relative (no cross-feature edge) |
| `ScoutChatWithHistory` (now in market-research) → `ScoutChatPanel` (legacy `components/market-research/`) | `@/`-alias path (e.g. `@/components/market-research/ScoutChatPanel`) | ✓ feature → legacy (transitional, Spec 14 §3.3, Phases 4b–12) |
| `features/strategist` (page + components) → `shared/*`, `components/ui`, `@/features/shell` Layout | index / direct | ✓ |

- **No cross-feature cycle.** `shared/chat` imports **no** feature (verified: `SignalsContextChat` has no `@/features/*` imports), so the substrate move is `shared`-safe (`shared ↛ features`, Spec 14 §3.3). Customers and market-research both depend on `shared/chat` (one direction); neither is depended on *by* shared.
- **Same-feature alias self-imports** created by the moves (e.g. `ScoutChatWithHistory` ↔ its now-co-located deps; the relocated strategist components) are converted to **relative** imports during relocation so the forbid-form `import-x/no-internal-modules` stays green (as in Phases 6–7).
- **`index.ts` surfaces.** `signals/index.ts` exposes `signalsRoutes` only; `strategist/index.ts` exposes `strategistRoutes` only. Nothing cross-feature consumes either today (the chat consumers depend on `shared/chat`, not on `signals`). `market-research/index.ts` is **unchanged** — the scout-chat relocation is internal to that feature and adds no public export.

---

## §4 Data layer (signals page: relocate + decompose + TanStack; substrate hooks shared)

The Signals page's four raw-`fetch` endpoints, split by the ≥2-consumer rule (Spec 14 §8 Q5):

| Call | Verb | Endpoint | Other consumer? | Destination |
|---|---|---|---|---|
| generate signals batch | POST | `/api/generate-signals-batch` | page-only | `features/signals/` — `useGenerateSignalsBatch` (useMutation) |
| fetch signals | GET | `/api/fetch-signals?user_id=&limit=` | page-only | `features/signals/` — `useFetchSignals` (useQuery) |
| signal ask | POST | `/api/signal_Ask` | **also `SignalsContextChat` (→ shared)** | `src/shared/` — `useSignalAsk` (contract in `shared/api`, hook in `shared/chat`) |
| signal action | POST | `/api/signal_action` | **also `SignalsContextChat` (→ shared)** | `src/shared/` — `useSignalAction` |

**Shared-boundary rule.** Because `shared ↛ features` (§3.3), the two endpoints used by *both* the shared substrate and the signals page cannot have their hooks in `features/signals/` — the substrate could not import them. They live in `src/shared/` (contract in `shared/api/contracts.ts`, hook co-located with the substrate in `shared/chat/`), and the signals page imports them from there. This single implementation replaces both the substrate's and the page's duplicate raw fetches (the substrate's migration is the small re-touch noted in §7 stage 8c). **Caveat:** the plan first confirms the page's and the substrate's `signal_Ask`/`signal_action` call shapes actually match before committing to one hook per endpoint; if they diverge (e.g. the chat's multi-turn use vs a page one-shot), the shared hook is parameterized or split into specialized variants — **tiebreaker:** default to one parameterized hook when the shapes differ only in flags/options, and split into specialized hooks only when the request/response *bodies* differ structurally.

**Permissive zod.** Backend is suspended/variable (memory: `backend-11kr` 503; FE host repointed to `brewra-gtm-intelligence.onrender.com`, TD-FE-13). Contracts follow the Phase 7 posture — `.passthrough()`, optional fields, `.parse` at the service boundary with no effective throw path; missing fields fall back to today's defaults. `UntypedBackendSignal` (escape-hatch) is preserved (TD-FE-10), not retyped. **Tightening trigger:** the loose posture is the prevailing pre-launch stance, not indefinite-by-neglect — it tightens when the backend stabilizes (TD-FE-13 resolution lets us confirm real response shapes) and at Phase 13's contract audit, which re-evaluates every loose schema.

**TanStack parity.** Read hooks inherit Phase 3 `QueryClient` defaults (`refetchOnWindowFocus: false`, `staleTime: 5m`, `gcTime: 10m`); set `retry: false` where strict parity vs single-attempt raw fetch matters. Each migrated site's loading/error/data render states are **asserted by** the new per-hook/per-component React Testing Library (RTL) + MSW (Vitest) tests and backstopped by VR journey `03` — the "parity audit" is encoded in those tests, not a separate manual pass; the per-site assertions are enumerated in the plan. "No behavior change" (§8) is read with the standard transport-moves-but-rendered-states-held qualification (Spec 26 §4).

**Primary stores stay put.** The Signals page's `localStorage` accepted/rejected state is extracted into `useSignalAcceptance` but **remains `localStorage`** (not TanStack — it is primary state, not cache; TD-FE-49). The `sessionStorage.signalsChatContext` write (handoff to the scout chat) is preserved verbatim (TD-FE-50).

**Strategist has no live data layer to migrate.** The only strategist network call is in the dead `StrategistWorkspace` (relocated as-is, raw fetch intact — TD-FE-47). `Recommendations`/`LeadStream`/`StrategistPage` have no fetch. No TanStack work in 8d.

---

## §5 Chat substrate relocation & scout-chat handoff

**Substrate → shared (8a).** `SignalsContextChat` (494 LOC) is the genuinely-shared scout/profiler chat plumbing: consumed (as a component) by `ScoutChatWithHistory` and customers' `ProfilerChatWithHistory`, and (as types) by `TrendsTab` + `CustomersPage` — ≥2 features, so it graduates to `src/shared/chat/` per the promotion rule (Spec 14 §8 Q5). It has no feature imports (shared-safe). 8a is a structural move (raw fetches intact; their migration to shared hooks is 8c) plus repointing every importer to `@/shared/chat`:
- `features/customers/.../chat/ProfilerChatWithHistory.tsx` — component + type import (was the TD-FE-45 legacy path).
- `features/customers/.../chat/__tests__/ProfilerChatWithHistory.test.tsx` — the `vi.mock` path.
- `features/customers/.../CustomersPage.tsx` — `type SignalsChatContext`.
- `features/market-research/.../trends/TrendsTab.tsx` — `type SignalsChatContext`.
- `ScoutChatWithHistory` — its `./SignalsContextChat` relative import becomes `@/shared/chat`.

This **resolves TD-FE-45** (the substrate is relocated; the stale legacy import is gone).

**Scout-chat wrapper → market-research (8b).** `ScoutChatWithHistory` is functionally a market-research component (its only consumer is market-research's `TrendsTab`; its deps `ScoutChatPanel`/`AddLeadModal`/`SuggestedCompaniesSection` are market-research's) that Phase 5 left in legacy `components/signals/`. It relocates into `features/market-research/` alongside `AddLeadModal` + `SuggestedCompaniesSection` (each consumed only by it). `ScoutChatPanel` + market-research `types.ts` **stay** in legacy `components/market-research/` (load-bearing in market-research; out of Phase 8 scope — TD-FE-51), imported transitionally. `TrendsTab` switches to a relative import. No cross-feature edge, no cycle (§3.1).

This is a deliberate, user-approved **scope reach** into the already-merged market-research feature — completing the relocation of files Phase 5 misfiled into `components/signals/`/left in `components/market-research/`. It adds no public `market-research/index.ts` export. Logged as a master-plan §5.5 delta at merge.

**Dedup handoff for Phase 9.** `ScoutChatWithHistory` (473, now in market-research) and `ProfilerChatWithHistory` (337, in customers) now render the **same** `@/shared/chat` substrate. Phase 9 (scout + profiler) owns the wrapper dedup, with authority over scout + coordination via customers'/market-research's `index.ts`. The shared deduped primitive's natural home is `src/shared/chat/` (already established here). Phase 8 records this; performs no dedup. To keep Phase 9 unblocked, the substrate's public surface — its props, the `SignalsChatContext`/`ChatMessage` types, and the `signal_*` hooks — is documented (in `shared/README` / a short `shared/chat` module note) well enough for Phase 9 to evaluate the dedup without re-reading the implementation. The substrate keeps its `SignalsContextChat` name (and the `SignalsChatContext` type) through Phase 8 for move-traceability; renaming the now-generic substrate is **deferred to Phase 9**, which owns the deduped shared-chat primitive's final shape — renaming in Phase 8 would pre-empt that and risk a double rename.

---

## §6 Strategist disposition

- **`Deals.tsx` → `features/strategist/pages/StrategistPage.tsx`** (rename; the file name `Deals` is vestigial — §1.2.4). Its `sessionStorage.strategistContext` read/clear and the `context.leads ? <Workspace/> : <Recommendations/>` branch are preserved **verbatim** for parity, even though the branch is dead (§1.2.3). The `StrategistContext` interface moves to `features/strategist/types.ts`.
- **`StrategistRecommendations` + `StrategistLeadStream` → `features/strategist/components/`** (clean relocation; no fetch, no storage; relative imports).
- **`StrategistWorkspace` → `features/strategist/components/` AS-IS** (relocate as-is + flag, per the chosen disposition). Raw `GET /chat/` fetch left unmigrated; runtime-unreachable. Its now-obsolete `// HANDOFF → strategist` file-header annotation (which says the file "stays here until the strategist feature phase relocates" it) is **removed** — leaving it would be actively false post-relocation; removal, not a prose rewrite, avoids needless churn in an otherwise minimally-touched file. Flagged **TD-FE-47** for Phase 13 (dead-code removal + raw-fetch debt). It is **not** decomposed (the "Full" decomposition choice applies to *live* code; decomposing dead code is wasted work) and **not** TanStack-migrated.
- **Routes → `features/strategist/routes.tsx`**: `/your-ai-team/strategist/:tab` + the `/deals` and `/your-ai-team/strategist` → `…/workspace` redirects (all strategist-owned), appended to `src/app/routes.tsx`; legacy `App.tsx` strategist/Deals imports + routes removed. URLs frozen.
- **Naming reconciliation (TD-FE-48):** Phase 8 claims `Deals.tsx` as the strategist page; the master-plan §12 `Deals.tsx` small-page listing and the `features/README` `deals` naming-map entry are stale. No `deals` feature is created. Recorded as a master-plan delta + a `features/README` naming-map note at merge.

---

## §7 Execution stages (single spec, single plan, single branch; staged green checkpoints)

One branch (`phase-8-signals-strategist`), one plan (`plans/27-…`), staged commit-series, **one merge**. Per the user's direction, the relevant verification runs **after each stage** (8a→8d) as an internal checkpoint; the full **serial** `npm run preflight` runs once, immediately before the single merge. Each stage leaves the tree green; a failed stage `git reset --hard` to the last green checkpoint (branch is local/unshared during the phase — Spec 14 §5.7, Phase 6/7 model).

- **8a — Substrate → shared (enabling).** Move `SignalsContextChat` → `src/shared/chat/` (raw fetch intact); repoint all five importers + the test `vi.mock` (§5). Add a substrate unit test (`shared/chat/__tests__`) written against the **public surface** (render/props/behavior via MSW-mocked `signal_Ask`/`signal_action` endpoints + chat-message state + the error fallback) so it survives 8c's raw-fetch→TanStack migration — MSW intercepts at the network boundary, so the handlers are unchanged; 8c only adds the `QueryClientProvider` harness and adjusts the loading/error assertions (an explicit 8c task). **Resolves TD-FE-45.** Checkpoint: `verify` (= typecheck + lint + change-scoped Vitest per root CLAUDE.md / Spec 14; the full Vitest suite runs only in `preflight`) + customers journey + market-research journey + VR green (the substrate underpins customers' chat tab + market-research's Trends tab).
- **8b — Scout-chat → market-research.** Move `ScoutChatWithHistory` + `AddLeadModal` + `SuggestedCompaniesSection` into `features/market-research/`; relativize same-feature imports; `TrendsTab` relative import; keep transitional `ScoutChatPanel`/`types.ts` legacy imports. Checkpoint: `verify` + market-research journey + VR green.
- **8c — Signals feature (the big stage).** This stage is itself a sub-staged commit-series the plan enumerates — **8c-1** scaffold + relocate + route registry, **8c-2** data layer, **8c-3** 5a-style decomposition — each sub-commit green; the "8c checkpoint" is the aggregate of those sub-commits. Scaffold `features/signals/`; route registry (`/signals`, `/agent-hub`, `<FeatureErrorBoundary featureName="Signals">`) + remove the legacy `App.tsx` import; relocate `Signals.tsx` → `pages/SignalsPage.tsx`; build the data layer (shared `useSignalAsk`/`useSignalAction` + `shared/api` contracts; page-only `useFetchSignals`/`useGenerateSignalsBatch` + `features/signals` contracts; MSW handlers; migrate **both** the page and the relocated substrate to the shared signal_* hooks, updating the 8a substrate test's harness — `QueryClientProvider` wrap + TanStack loading/error assertions); extract `useSignalAcceptance` (localStorage); **5a-style decompose** the page into a shell + section components (one extraction per commit, green between each, loading/error-parity audit per §4); README; lock `index.ts`. Checkpoint: `verify` + Signals journey + VR green per commit.
- **8d — Strategist feature.** Scaffold `features/strategist/`; relocate `Deals.tsx` → `StrategistPage.tsx` + `Recommendations` + `LeadStream` + `Workspace` (as-is); `StrategistContext` → `types.ts`; route registry (incl. redirects) + remove legacy `App.tsx` imports/routes; `<FeatureErrorBoundary featureName="Strategist">`; README; lock `index.ts`; allocate TD-FE-47/48. Checkpoint: `verify` + strategist journey/VR (coverage gap per §8) green.
- **Finalize (pre-gate).** Reconcile TD-FE numbering against the then-current register; finalize all README/`index.ts` (including the §5 dedup-handoff substrate documentation for Phase 9); write the master-plan deltas (chat→market-research scope reach, naming reconciliation) and `features/README` naming-map note; then perform the controller's manual smoke sign-off (§8) on `/signals` + `/your-ai-team/strategist/{workspace,leadstream}`, and — as the strictly-final action — run the full serial `npm run preflight` for the single merge. **Both gates must be green in the same pre-merge pass;** a failure in either (smoke or preflight) sends the branch back to fix-and-re-run **both**, or abort, per Spec 14 §5.3. No fixing forward through the gate. (This merge-gate fix-and-re-run path is distinct from the intra-phase `git reset` to the last green checkpoint used for a failed 8a–8d stage — the merge gate is not a `git reset`.)

8b and 8c both depend on 8a (they consume the substrate's new `shared/chat` location); 8c and 8d are mutually independent and may be reordered in the plan.

---

## §8 Error handling, testing & parity

- **Safety net.** A Signals VR journey + snapshot guard the page across 8c (Phase 0 captured a signals top-screen baseline). The customers journey `06` + market-research journey guard 8a/8b (they exercise the substrate + scout chat). New per-component **Vitest + RTL + MSW** added as each piece is extracted: substrate test (8a), signals read/mutation hooks + `useSignalAcceptance` + section components (8c), strategist component render tests + the dead-branch parity (8d).
- **Strategist VR-coverage gap.** Unlike signals/customers, the strategist screens may lack a Phase-0 VR baseline. If so, 8d adds a behavioral/render test for the reachable surface (Recommendations + LeadStream + tab switching) and logs the VR-baseline gap as TD-FE rather than blocking (mirrors TD-FE-17, market-research's missing VR baseline). The plan's 8d task confirms baseline presence first. **Fallback:** if behavioral coverage is judged insufficient for the surface's visual complexity, 8d creates the strategist VR baseline rather than deferring — behavioral-only is the expected default under the pre-launch advisory-gate posture.
- **Parity discipline.** No behavior or pixel change. The dead `StrategistWorkspace` branch, the `localStorage`/`sessionStorage` keys, the `signalsChatContext` handoff, and the redirect routes are preserved byte-for-behavior. Manual smoke sign-off (the Spec 14 §5.6 / R2 controller ceremony, wired into the §7 finalize stage and §11) on `/signals` and `/your-ai-team/strategist/{workspace,leadstream}` before merge: pass = the frozen routes/behaviors/visuals (§2.3) render correctly; fail = no merge, no fix-forward (Spec 14 §5.3).
- **Preflight.** Inner loop `npm run verify` per task; per-task `prettier --check` on touched files (verify omits format:check — esp. after the 8a/8b import rewrites); broader vitest when shared test infra (MSW handlers, fixtures) is touched (the substrate move touches customers + market-research test surfaces). Merge gate is the controller's serial `npm run preflight`.

---

## §9 Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Substrate move (8a) breaks customers' chat tab or market-research's Trends tab (three consuming surfaces). | 8a is structural-only (no logic change); repoint + test-mock fix in one commit; customers + market-research journeys + VR green at the checkpoint; substrate unit test added. |
| R2 | Relocating scout-chat into market-research (8b) re-introduces a cycle or trips the index-only lint. | Cycle proof in §3.1 (substrate in shared kills the back-edge; wrapper + consumer co-located in one feature → relative imports). `ScoutChatPanel` stays legacy (feature→legacy permitted). No `market-research/index.ts` change. |
| R3 | `Signals.tsx` (1,730 LOC, 4 endpoints, heavy localStorage) loses parity during 5a-style decomposition. | Staged one-extraction-per-commit; VR journey + new RTL/MSW tests green between each; loading/error-parity audit per §4; localStorage optimism kept on its primitive (TD-FE-49). |
| R4 | `signal_Ask`/`signal_action` shared-hook migration drifts the substrate's behavior vs the page's. | Single shared implementation consumed by both; 8c migrates both in the same stage with the substrate's own test + the customers/Trends journeys as guards. |
| R5 | Dead `StrategistWorkspace` is actually reachable via an un-grepped writer. | Verified zero `sessionStorage.setItem("strategistContext")` in `src/`; relocate-as-is preserves whatever behavior exists either way; not deleted, so a false-negative on "dead" causes no regression. |
| R6 | Strategist lacks a VR baseline → silent visual regression in 8d. | §8: confirm baseline first; add behavioral/render coverage + log a VR-gap TD-FE if absent (TD-FE-17 precedent). |
| R7 | Scope reach into market-research/customers violates §5.5 phase-scope discipline. | User-approved; bounded (relocation of Phase-5 residue + an import repoint, no public-surface or logic change); recorded as a master-plan §5.5 delta at merge. |

---

## §10 Provisional TD-FE allocations (numbers finalized at finalize-stage reconciliation)

Provisional from **TD-FE-47** (register unchanged from Phase 7's close at TD-FE-46); reconciled/renumbered at the finalize stage if an intervening allocation advanced the counter.

- **Resolve TD-FE-45** — substrate relocated to `src/shared/chat/`; `ProfilerChatWithHistory` + `ScoutChatWithHistory` + the test mock repointed off the legacy path.
- **TD-FE-47** — `StrategistWorkspace` (963 LOC) relocated as-is: runtime-unreachable (no `strategistContext` producer) and carries a raw `GET /chat/` fetch. Phase 13 evaluates dead-code removal + the raw-fetch debt.
- **TD-FE-48** — Naming reconciliation: `Deals.tsx` is the strategist page (claimed by Phase 8), not a Phase 12 small-page; master-plan §12 `Deals.tsx` listing + `features/README` `deals` naming-map entry are stale.
- **TD-FE-49** — Signals page `localStorage` accepted/rejected primary state kept on `localStorage` (extracted to `useSignalAcceptance`), not modeled in the TanStack cache (parity-safe; mirrors TD-FE-19/41).
- **TD-FE-50** — `sessionStorage.signalsChatContext` handoff (Signals page → scout chat) is untyped cross-surface coupling; preserved for parity (mirrors TD-FE-44).
- **TD-FE-51** — `ScoutChatPanel` (681) + `components/market-research/types.ts` remain in legacy `components/market-research/` after Phase 8 (market-research residue, out of signals/strategist scope); Phase 9 (scout) or a market-research cleanup relocates.
- **TD-FE-52** (conditional) — Strategist VR baseline absent; behavioral coverage added in lieu, full VR baseline deferred (only if §8 confirms the gap); if behavioral coverage proves insufficient, 8d creates the baseline instead of deferring.

Entry wording finalized at the finalize stage alongside numbering reconciliation.

---

## §11 Done when

- `src/features/signals/` populated per §3 (Signals page decomposed); `src/pages/Signals.tsx` gone; `/signals` + `/agent-hub` resolve via the route registry with no legacy `App.tsx` import; `<FeatureErrorBoundary>` wrap; TanStack data layer + zod contracts + MSW in place (primary-store caveats per §4/§10); per-component Vitest green; README written; `index.ts` locked.
- `src/features/strategist/` populated (`StrategistPage` + Recommendations + LeadStream + Workspace-as-is); `src/pages/Deals.tsx` + `src/components/strategist/*` gone; strategist routes + redirects resolve via the registry with no legacy `App.tsx` import; `<FeatureErrorBoundary>` wrap; README; `index.ts` locked.
- `SignalsContextChat` relocated to `src/shared/chat/`; all importers + the test mock repointed (**TD-FE-45 resolved**); `src/components/signals/` empty.
- `ScoutChatWithHistory` + `AddLeadModal` + `SuggestedCompaniesSection` relocated into `features/market-research/`; `TrendsTab` on relative imports; no cross-feature cycle; `market-research/index.ts` unchanged.
- TD-FE-47+ allocated; master-plan deltas (chat→market-research scope reach, `Deals`/`deals` naming reconciliation) + `features/README` naming-map note written.
- Manual smoke sign-off (Spec 14 §5.6) passed on the frozen routes (§8); full serial `npm run preflight` green immediately before merge (Signals VR + customers/market-research journeys included; strategist coverage per §8).
