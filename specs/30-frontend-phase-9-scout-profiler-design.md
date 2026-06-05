# Spec 30 — Frontend Phase 9: scout + profiler (design)

- **Phase:** 9 (frontend feature-folder refactor; master plan = spec 14)
- **NN:** 30 (master ceiling at authoring time = 27; 28/29 reserved by Phase 10/12 on sibling worktree branches)
- **Depends on:** Phases 6, 7, 8 — all merged to `master`. The master plan calls Phase 9 "the join point": it reads the Phase 6/7 Profiler-disposition sections and Phase 8's chat-history handoff before planning. No dependency on the in-flight Phase 10 (settings/tenant/auth) or Phase 12 (small-pages) worktrees.
- **Status:** design intent (frozen record once merged; the code is authoritative thereafter).
- **Revision:** round-1 spec review incorporated (see `docs/reviews/30-…-spec-synthesis-1.md`). Material changes from round 0: the unified chat component owns only the history *shell* and takes a `renderChat` prop (Scout swaps render surfaces, not just appends extras); §8 ICP work is confirm-and-document, not extraction (the disposition is already satisfied); §9 is a legacy-directory *relocation* drain, not a deletion sweep.

---

## 1. Context & goals

The frontend is being refactored phase-by-phase into a feature-folder architecture (`frontend/src/features/<domain>/` and `frontend/src/shared/<domain>/`). Phases 5 (market-research = Scout's research surface), 6 (mission-control), 7 (customers = Profiler's surface), and 8 (signals + strategist) are merged. Phase 8 relocated the chat substrate into `shared/chat/` and **explicitly deferred two items to Phase 9**: deduplicating the two chat-history wrappers, and renaming the substrate from its legacy `SignalsContextChat` name.

Phase 9 has five deliverables:

1. **Dedup the chat-history wrappers** — `ScoutChatWithHistory` (~473 LOC, market-research) and `ProfilerChatWithHistory` (~336 LOC, customers) collapse onto a single shared **history-shell** component. The two wrappers share ~85-90% on their session/sidebar/persistence/handler core (~70-75% by raw line overlap once Scout's lead-stream surface is included).
2. **Rename the substrate** — `SignalsContextChat` → `ContextChat`, landing with the dedup.
3. **Create `features/scout/`** — Scout's deployment surface gets a feature folder.
4. **Drain the legacy `components/market-research/` directory** — relocate its live residue (`ScoutChatPanel.tsx`, `types.ts`, `ChatWithScout.tsx`, `ScoutDeploymentDetails.tsx`) into `features/market-research`, resolving `TD-FE-51`.
5. **Close the Phase 6 Profiler-ICP disposition** — confirm it is already satisfied and record the upheld no-extract decision (no code extraction).

This is a **behavior-preserving refactor**. No user-visible behavior, route path, persistence key, API call, or persona prompt changes. At MVP stage (0 live users) the velocity bias applies, but this phase is structural cleanup, not feature work — correctness and the existing test guard rails are the priority.

### 1.1 The scout/profiler asymmetry (why this isn't symmetric extraction)

Scout and Profiler are **not** symmetric on disk today, so the master plan's "(and a sibling `profiler/` if distinct enough)" resolves to **no standalone `features/profiler/`**:

- **Scout's research surface already *is* market-research** (Phase 5). Scout's only genuinely-distinct surface is the **ScoutDeployment** page — that is what `features/scout/` holds.
- **Profiler's surface already *is* customers** (Phase 7); its shared utilities were already moved to `shared/profiler/` by Phase 6, and the ICP-merge algorithm already lives there too. Re-extracting a `features/profiler/` would gut Phase 7's feature for no architectural gain.

Phase 9 therefore creates **one** feature folder (`features/scout/`), leaves Profiler distributed where Phases 6/7 already homed it, and unifies the duplicated chat into **`shared/chat`** so a single shell serves both personas.

## 2. Scope

### In scope
- Unified `shared/chat/ChatWithHistory.tsx` **history-shell** component; both wrappers collapse onto it (§4).
- Substrate component rename `SignalsContextChat` → `ContextChat`.
- New `features/scout/` (ScoutDeployment page + component, `routes.tsx`, `index.ts`, `README.md`).
- `App.tsx` / `app/routes.tsx` rewire for the moved ScoutDeployment route.
- **Drain `frontend/src/components/market-research/`** by relocating its four live residue files into `features/market-research` and repointing importers (§9).
- **Confirm + document** the Phase 6 Profiler-ICP disposition is satisfied; record the upheld Plan-25 T21 no-extract decision (§8).

### Out of scope (explicit non-goals)
- No `features/profiler/` folder (Profiler stays distributed — see §1.1).
- No change to scout/profiler **backend** behavior, endpoints, or persona prompts.
- **No extraction of mission-control's inline ICP view-model mapper** (`ICPManager.tsx:179-237`). Plan-25 T21 deliberately left it as a container data-transform with no extractable render region; Phase 9 upholds that (§8).
- No relocation of `src/utils/leadStreamChatContext.ts` (scout lead-stream plumbing, not part of the dedup, possibly also referenced by Strategist; left untouched). Recorded as TD.
- No rename of the `SignalsChatContext` **type** (only the component renames). Recorded as TD.
- No resolution of the `UntypedProfilerIcpRecord` escape-hatch typing (remains a Phase 13 item).

## 3. Target structure

```
shared/chat/
  ContextChat.tsx          ← renamed from SignalsContextChat.tsx
  ChatWithHistory.tsx      ← NEW history-shell component (renderChat prop supplies the chat surface)
  useSignalAsk.ts          ← unchanged
  useSignalAction.ts       ← unchanged
  index.ts  README.md      ← updated
  __tests__/               ← repointed to ContextChat; + ChatWithHistory.test.tsx (new, shell behavior)

features/scout/            ← NEW feature folder (Scout's distinct surface only)
  pages/ScoutDeploymentPage.tsx     ← src/pages/ScoutDeployment.tsx
  components/ScoutDeployment.tsx     ← src/components/settings/ScoutDeployment.tsx
  routes.tsx  index.ts  README.md

features/market-research/  (scout chat wrapper shrinks; absorbs the drained legacy residue)
  components/scout-chat/ScoutChatWithHistory.tsx   ← ~473 → ~100-150 LOC thin wrapper (supplies renderChat)
  components/scout-chat/AddLeadModal.tsx           ← stays (scout lead-stream slot)
  components/scout-chat/SuggestedCompaniesSection.tsx ← stays (scout lead-stream slot)
  components/scout-chat/ScoutChatPanel.tsx         ← RELOCATED from components/market-research/ (681 LOC)
  components/scout-chat/types.ts                   ← RELOCATED from components/market-research/
  components/ChatWithScout.tsx (or trends/)        ← RELOCATED from components/market-research/
  components/intelligence/ScoutDeploymentDetails.tsx ← RELOCATED from components/market-research/ (70 LOC)
  components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx ← stays (behavior guard)

features/customers/        (profiler chat wrapper shrinks, stays put)
  components/chat/ProfilerChatWithHistory.tsx      ← ~336 → ~20-40 LOC thin wrapper
  components/chat/__tests__/ProfilerChatWithHistory.test.tsx ← stays (behavior guard)

shared/profiler/           ← UNCHANGED (merge util already here; no new files)
features/mission-control/
  components/icp/ICPManager.tsx  ← UNCHANGED (inline view-model mapper stays, per Plan-25 T21)

src/components/market-research/   ← EMPTIED / removed (legacy dir drained)
```

## 4. The unified chat component contract

The two wrappers share their session/sidebar/persistence/handler machinery but **diverge on the main chat render surface**: Profiler always renders the substrate (`ContextChat`); Scout *swaps* surfaces — `activeSession.context ? <ContextChat/> : <ScoutChatPanel/>` (`ScoutChatWithHistory.tsx:375-403`). `ScoutChatPanel` (681 LOC) replaces the substrate as the surface, it is not appended alongside it.

Therefore `shared/chat/ChatWithHistory.tsx` owns only the **history shell** — session-list state, sidebar toggle/width, `localStorage` persistence, title/id generation, and the message-handling callbacks — and the caller supplies the chat surface via a `renderChat` render prop. Persona-specific UI overlays (Scout's `AddLeadModal` / `SuggestedCompaniesSection`) come through `renderExtras`. The shell remains persona-agnostic, so **`shared/` never imports from `features/`** (the Approach-1 guarantee of zero `feature → feature` coupling).

```ts
interface ChatWithHistoryConfig {
  agent: "scout" | "profiler";       // forwarded into the ContextChat context
  storageKey: string;                // "scout_chat_sessions" | "profiler_chat_sessions"
  sessionIdPrefix: string;           // "scout_" | "profiler_"
  emptyContext?: SignalsChatContext; // profiler's EMPTY_PROFILER_CONTEXT fallback
  sidebarClassName?: string;         // each persona keeps its current responsive widths verbatim
}

interface ChatSession<TMeta = unknown> {        // session type generic over a meta payload
  id: string;
  title: string;
  messages: ChatMessage[];
  context: SignalsChatContext | null;
  meta?: TMeta;                                  // scout stores { leadContext }; profiler omits
}

interface ChatWithHistoryRenderState<TMeta = unknown> {
  session: ChatSession<TMeta>;
  onMessagesChange: (messages: ChatMessage[]) => void;
  onClearContext?: () => void;
}

interface ChatWithHistoryProps<TMeta = unknown> {
  config: ChatWithHistoryConfig;
  initialContext: SignalsChatContext | null;
  onClearContext?: () => void;
  onTabChange?: (tab: string) => void;
  buildInitialSession?: (ctx: SignalsChatContext | null) => Partial<ChatSession<TMeta>>; // scout hydrates leadContext
  renderChat: (state: ChatWithHistoryRenderState<TMeta>) => React.ReactNode;             // MAIN chat surface (persona-supplied)
  renderExtras?: (state: ChatWithHistoryRenderState<TMeta>) => React.ReactNode;          // scout: AddLeadModal + SuggestedCompaniesSection overlays
}
```

Scout-only props such as `editHistory` are **not** part of the shared interface; the Scout wrapper holds them and threads them into the `renderChat` closure it supplies. Exact generic signatures are finalized in the plan; this section fixes the boundary: the shell is persona-agnostic, everything persona-specific is supplied by the caller via `config`, `buildInitialSession`, `renderChat`, and `renderExtras`.

## 5. Substrate rename

`shared/chat/SignalsContextChat.tsx` → `shared/chat/ContextChat.tsx`. All importers repoint (the wrappers, the shared barrel, and the Phase-8 signals/strategist consumers). The `SignalsChatContext` **type** name is retained for this phase to limit churn — renaming it to a generic name (e.g. `ChatContext`) is recorded as TD. `index.ts` and `README.md` in `shared/chat/` update to reflect the new component name and the new `ChatWithHistory` export. The plan enumerates every substrate importer before the rename so none are missed (see §17).

## 6. Wrapper disposition

Both wrappers **shrink to thin config holders and remain in their current features** — so call sites and existing tests stay stable, and no `feature → feature` import is introduced:

- `features/market-research/components/scout-chat/ScoutChatWithHistory.tsx` (~100-150 LOC): holds the scout `ChatWithHistoryConfig` (incl. `sidebarClassName: "w-64 sm:w-72 min-w-[14rem] max-w-[min(18rem,42vw)] shrink-0"`), the lead-stream `buildInitialSession` (hydrating `leadContext` from `sessionStorage`), the scout-only `editHistory`/`onTabChange`/`suggestionPrefill` state, a `renderChat` that does the `ContextChat`↔`ScoutChatPanel` swap, and a `renderExtras` rendering `AddLeadModal` + `SuggestedCompaniesSection`. `TrendsTab.tsx`'s import path is **unchanged**.
- `features/customers/components/chat/ProfilerChatWithHistory.tsx` (~20-40 LOC): holds the profiler `ChatWithHistoryConfig` (incl. `emptyContext: EMPTY_PROFILER_CONTEXT`, `sidebarClassName: "w-[28rem] min-w-[24rem] max-w-[90vw] shrink-0"`) and a `renderChat` that always renders `ContextChat`. `CustomersPage.tsx`'s import path is **unchanged**.

The session/sidebar/persistence/message machinery that previously lived in both files now lives once, in the `ChatWithHistory` shell.

## 7. `features/scout/`

Contains only Scout's genuinely-distinct surface:

- `pages/ScoutDeploymentPage.tsx` — from `src/pages/ScoutDeployment.tsx` (exported symbol renamed `ScoutDeployment` → `ScoutDeploymentPage`, matching the per-phase page-naming convention).
- `components/ScoutDeployment.tsx` — from `src/components/settings/ScoutDeployment.tsx` (the component the page renders; Phase 10 deliberately left this file in `components/settings/` for Phase 9 while it moved the other settings components — file-granular moves, no same-file conflict).
- `routes.tsx` — exports `scoutRoutes`, preserving the existing `/scout-deployment` path and route guards verbatim.
- `index.ts` — exports `{ scoutRoutes }` only (no external component consumers).
- `README.md` — feature overview, per phase convention.

**Disposition note — `ScoutDeploymentDetails.tsx`:** despite its `// HANDOFF → scout (Spec 24 §7)` annotation, this 70-LOC read-only card relocates to **`features/market-research`** (its sole consumer is `IntelligenceTab.tsx`), not `features/scout`. Routing it into `features/scout` would force a `market-research → scout` cross-feature import, violating the Approach-1 guarantee; the annotation predates that decision and is superseded. It is part of the §9 drain.

`App.tsx` removes the `ScoutDeployment` import and its inline `<Route path="/scout-deployment">` block; `app/routes.tsx` adds the `scoutRoutes` spread to `featureRoutes` (append-only).

## 8. Profiler-ICP disposition (close the Phase 6 open item)

The Phase 6 disposition (spec 25 §6) flagged the profiler ICP-merge logic "Phase 9 resolves." Verification shows it is **already satisfied**:

- The merge algorithm (`mergeProfilerAcceptedIcpDisplay`) already lives in `shared/profiler/profilerAcceptedIcpDisplay.ts` and is exported from the barrel.
- Both consumers read it from `@/shared/profiler`: mission-control (`ICPManager.tsx:16,187`) and customers (`icp-intelligence/icpMapping.ts`, `services/customers.ts`). There is **no `customers → mission-control` import** (verified: zero matches).
- What remains inline in `ICPManager.tsx:179-237` (~58 LOC) is a mission-control-**local** view-model mapper (snake/camel normalization + dedup-by-id). `ICPManager.tsx:174-178` records that `ProfilerMergeView` was **intentionally not created** (Plan-25 T21): it is a container data-transform with no extractable render region.

Phase 9 therefore makes **no code change here**. It closes the open item by documenting that the shared-merge disposition is complete and that the inline mapper stays in mission-control per Plan-25 T21 (recorded in §15 / mission-control README). This corrects the round-0 spec, which wrongly framed an "extraction" eliminating a non-existent cross-feature read.

## 9. Drain the legacy `components/market-research/` directory

`frontend/src/components/market-research/` is legacy residue from earlier phases (`TD-FE-51` assigns the drain to Phase 9). Its files are **live, not dead** — they relocate into their consuming feature (`features/market-research`) with importers repointed; **nothing is deleted**:

| File (LOC) | Live consumers | New home |
|---|---|---|
| `ScoutChatPanel.tsx` (681) | `scout-chat/ScoutChatWithHistory.tsx`, `MarketIntelligenceSections.tsx` (×5) | `features/market-research/components/scout-chat/` |
| `types.ts` | `ScoutChatPanel` + scout-chat | `features/market-research/components/scout-chat/` |
| `ChatWithScout.tsx` | `trends/TrendsTab.tsx`, `pages/MarketResearchPage.tsx` | `features/market-research/components/` |
| `ScoutDeploymentDetails.tsx` (70) | `intelligence/IntelligenceTab.tsx` | `features/market-research/components/intelligence/` |

This resolves `TD-FE-51` and empties the legacy directory. The moves are file-relocation + import-path updates only — no logic change. Exact destination sub-paths are the plan's call; the constraint is "into `features/market-research`, no new cross-feature imports."

## 10. Public surfaces (boundaries)

- `features/scout/index.ts` → `{ scoutRoutes }`.
- `shared/chat/index.ts` → `ContextChat`, `ChatWithHistory`, `ChatMessage`, `SignalsChatContext`, `useSignalAsk`, `useSignalAction`.
- `shared/profiler/index.ts` → **unchanged** (merge util already exported; no new exports).
- **No new `feature → feature` import** is introduced. The scout/profiler wrappers consume only `@/shared/chat`; the drained residue stays within `features/market-research`; customers' icp consumers continue to read `@/shared/profiler`.

## 11. Behavior preservation

This is a pure refactor. The following are invariant:

- **`localStorage` keys** — `scout_chat_sessions`, `profiler_chat_sessions` unchanged; existing user sessions still hydrate.
- **`sessionStorage` `LEAD_STREAM_CHAT_CONTEXT_KEY`** unchanged; scout lead-stream flow intact.
- **Sidebar responsive widths** preserved verbatim per persona (via `sidebarClassName`): Scout `w-64 sm:w-72 min-w-[14rem] max-w-[min(18rem,42vw)]`; Profiler `w-[28rem] min-w-[24rem] max-w-[90vw]`.
- **Route path `/scout-deployment`** and its guards unchanged.
- **No API/endpoint/persona-prompt changes** — the substrate is renamed and recomposed, not rewired.
- Session id prefixes (`scout_`, `profiler_`) preserved via config.
- The Scout `ContextChat`↔`ScoutChatPanel` render swap is preserved exactly via the wrapper's `renderChat`.

## 12. Testing

- **Behavior guard (no regression):** the existing `ScoutChatWithHistory.test.tsx` (market-research) and `ProfilerChatWithHistory.test.tsx` (customers) stay and must pass through the now-thin wrappers — they exercise persona behavior, the render-surface swap, and scout's lead-stream end-to-end. Green = behavior preserved.
- **New `shared/chat/__tests__/ChatWithHistory.test.tsx`** — shell behavior: session create/select/delete, `localStorage` persistence keyed by `config.storageKey`, sidebar toggle, message handling, and that `renderChat`/`renderExtras` receive the right `ChatWithHistoryRenderState` (using lightweight test doubles for the surface).
- **Repoint** the existing `shared/chat` tests to the `ContextChat` rename.
- **Drained-residue tests:** the existing `ScoutChatPanel` mock in `ScoutChatWithHistory.test.tsx:16` and any tests touching the relocated files repoint to the new paths; relocation is move-only, so no new behavioral tests are added for them.
- **No new `profilerIcpMerge` test** (§8 makes no code change).
- **MSW:** the chat uses `useSignalAsk`/`useSignalAction` → signal endpoints already mocked in `src/test/msw/handlers.ts`. Expect **no new handlers** (the plan confirms; avoids touching the contended shared handler file). If new handlers prove necessary, they are append-only.
- **Gate:** serial `npm run preflight`; vitest run with `--no-file-parallelism` under sandbox CPU contention (known parallel-contention flake).

## 13. Staged execution

Ordered to shrink the window in which shared/contended files are touched:

1. **`shared/chat` shell + rename** — rename substrate → `ContextChat`; build the `ChatWithHistory` history-shell with `renderChat`/`renderExtras`; repoint shared importers + tests. *(self-contained)*
2. **Collapse wrappers** — shrink the scout + profiler wrappers onto the shell (scout supplies the swap `renderChat`); existing tests guard behavior.
3. **Drain legacy `components/market-research/`** — relocate the four residue files into `features/market-research`, repoint importers, empty the legacy dir (resolves TD-FE-51). *(market-research-internal; Phase 5 territory, already merged — no active worktree contends)*
4. **Create `features/scout/`** — move ScoutDeployment page + component; add `routes.tsx`/`index.ts`/`README`; edit `App.tsx` + `app/routes.tsx`.
5. **Close ICP disposition + finalize** — document §8 (no code); README/TD updates.

Routing edits (`App.tsx`, `app/routes.tsx`) — the only files the in-flight Phase 10/12 worktrees also touch — are concentrated in **Stage 4**, a single tight window. Each stage maps to a small set of commits per the repo's commit-granularity rule (one logical step = one commit).

## 14. Parallel-worktree coordination

Phase 9 runs as a **third concurrent worktree** alongside Phase 10 and Phase 12 (both currently at spec/plan stage with ~no code committed). Coordination rules:

- **Branch `worktree-phase-9-scout-profiler` off `master` (`9b2438d`)**; commit **surgically by path**, never `git add -A` in the shared working tree.
- The Stage-3 legacy drain churns `features/market-research` + `components/market-research/`, which are Phase 5 territory (merged); no in-flight worktree touches them, so collision risk there is low.
- **`App.tsx` / `app/routes.tsx`:** Phase 9's add/remove sites are at distinct line ranges from Phase 10 (auth/tenant/settings) and Phase 12 (calendar/insights/reports/artifacts/notfound). Conflicts at the merge gate are mechanical union resolutions.
- **`docs/TECH_DEBT.md`:** claim **TD-FE-57+** (master ceiling = 53; Phase 10 takes 54–56). Append-only. Also flips `TD-FE-51` to resolved.
- **`src/test/msw/handlers.ts`:** avoid touching (see §12); if unavoidable, append-only.
- **Preflight is a serialized resource** across worktrees — only one worktree can bind `:5173` for the Playwright e2e/VR step. Kill orphan vite preview servers by **specific PID** (no broad `pkill`) before running the gate.

## 15. Tech-debt entries

- **`TD-FE-51` → resolved** by §9 (legacy `components/market-research/` drained into `features/market-research`).
- **TD-FE-57 (proposed):** Profiler kept distributed across customers + mission-control; no `features/profiler/` folder. *Accepted decision* (see §1.1), recorded so future agents don't re-litigate. Trigger: if Profiler grows a standalone surface.
- **TD-FE-58 (proposed):** `SignalsChatContext` **type** name retained though the component renamed to `ContextChat`. Rename the type to a generic name when next touching `shared/chat` types.
- **TD-FE-59 (proposed):** `src/utils/leadStreamChatContext.ts` left in `utils/` rather than relocated to a feature/shared home; possibly shared between scout and strategist. Relocate when the lead-stream ownership is settled.
- **Documented (not TD):** mission-control's inline ICP view-model mapper (`ICPManager.tsx:179-237`) stays per Plan-25 T21; recorded in the mission-control README and §8 so it isn't re-litigated.

(Final numbers assigned at write time against the then-current `TECH_DEBT.md` ceiling.)

## 16. Allocations & pipeline

- **Spec/plan NN = 30.** This spec: `specs/30-frontend-phase-9-scout-profiler-design.md`. Plan: `plans/30-frontend-phase-9-scout-profiler.md`.
- **Pipeline:** this spec → `/review-spec` → `/synthesize-spec-review` (loop until findings are nit-or-below) → `writing-plans` → plan review loop → implementation on `worktree-phase-9-scout-profiler`.

## 17. Risks & open questions

- **Render-surface plumbing (the dedup's crux).** The Scout wrapper must reproduce `activeSession.context ? <ContextChat/> : <ScoutChatPanel/>` through `renderChat`. Plan-time decision framework, in preference order:
  1. **`renderChat` prop (recommended, this spec's contract):** the shell calls `renderChat(state)`; the Scout wrapper closes over `editHistory`/lead-stream state and returns the swap; Profiler returns `<ContextChat/>`.
  2. **Refactor `ScoutChatPanel` to wrap `ContextChat`:** collapses the swap into one surface — larger, riskier change to a 681-LOC component; only if (1) proves insufficient.
  3. **Approach-2 fallback:** `ChatWithHistoryBase` + named per-feature wrappers, if the shell+`renderChat` boundary turns out to leak.
- **`ContextChat` rename blast radius:** Phase 8 consumers (signals/strategist) import the substrate; the plan enumerates every importer before the rename so none are missed.
- **Legacy-drain destination sub-paths:** §9 fixes the destination *feature* (`features/market-research`) and the no-cross-feature-import constraint; exact sub-folders are the plan's call.

## Appendix: file manifest

| Action | From → To |
|---|---|
| Rename | `shared/chat/SignalsContextChat.tsx` → `shared/chat/ContextChat.tsx` |
| New | `shared/chat/ChatWithHistory.tsx` (history shell, `renderChat` prop) |
| New | `shared/chat/__tests__/ChatWithHistory.test.tsx` |
| Move | `src/pages/ScoutDeployment.tsx` → `features/scout/pages/ScoutDeploymentPage.tsx` |
| Move | `src/components/settings/ScoutDeployment.tsx` → `features/scout/components/ScoutDeployment.tsx` |
| New | `features/scout/{routes.tsx,index.ts,README.md}` |
| Shrink (in place) | `features/market-research/components/scout-chat/ScoutChatWithHistory.tsx` (supplies `renderChat`) |
| Shrink (in place) | `features/customers/components/chat/ProfilerChatWithHistory.tsx` |
| Relocate (drain) | `components/market-research/ScoutChatPanel.tsx` → `features/market-research/components/scout-chat/` |
| Relocate (drain) | `components/market-research/types.ts` → `features/market-research/components/scout-chat/` |
| Relocate (drain) | `components/market-research/ChatWithScout.tsx` → `features/market-research/components/` |
| Relocate (drain) | `components/market-research/ScoutDeploymentDetails.tsx` → `features/market-research/components/intelligence/` |
| Repoint | importers of the four relocated files (`TrendsTab`, `MarketResearchPage`, `MarketIntelligenceSections`, `IntelligenceTab`, `ScoutChatWithHistory`) |
| Edit | `shared/chat/index.ts` (rename + new export) |
| Edit | `App.tsx` (remove ScoutDeployment import @11 + route @87-94), `app/routes.tsx` (add `scoutRoutes`) |
| Unchanged | `shared/profiler/*`, `features/mission-control/components/icp/ICPManager.tsx` (§8 no-extract) |
| Doc only | mission-control README + §8: record Plan-25 T21 no-extract upheld; flip TD-FE-51 to resolved |
