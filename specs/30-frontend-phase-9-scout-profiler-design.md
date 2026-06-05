# Spec 30 — Frontend Phase 9: scout + profiler (design)

- **Phase:** 9 (frontend feature-folder refactor; master plan = spec 14)
- **NN:** 30 (master ceiling at authoring time = 27; 28/29 reserved by Phase 10/12 on sibling worktree branches)
- **Depends on:** Phases 6, 7, 8 — all merged to `master`. The master plan calls Phase 9 "the join point": it reads the Phase 6/7 Profiler-disposition sections and Phase 8's chat-history handoff before planning. No dependency on the in-flight Phase 10 (settings/tenant/auth) or Phase 12 (small-pages) worktrees.
- **Status:** design intent (frozen record once merged; the code is authoritative thereafter).

---

## 1. Context & goals

The frontend is being refactored phase-by-phase into a feature-folder architecture (`frontend/src/features/<domain>/` and `frontend/src/shared/<domain>/`). Phases 5 (market-research = Scout's research surface), 6 (mission-control), 7 (customers = Profiler's surface), and 8 (signals + strategist) are merged. Phase 8 relocated the chat substrate into `shared/chat/` and **explicitly deferred two items to Phase 9**: deduplicating the two ~90%-identical chat-history wrappers, and renaming the substrate from its legacy `SignalsContextChat` name.

Phase 9 has five deliverables:

1. **Dedup the chat-history wrappers** — `ScoutChatWithHistory` (~473 LOC, in market-research) and `ProfilerChatWithHistory` (~336 LOC, in customers) collapse onto a single shared component.
2. **Rename the substrate** — `SignalsContextChat` → `ContextChat`, landing with the dedup.
3. **Create `features/scout/`** — Scout's deployment surface gets a feature folder.
4. **Sweep dead scout cruft** — remove the superseded Lovable leftovers.
5. **Complete the Phase 6 Profiler-ICP disposition** — extract the inline ICP-merge logic to `shared/profiler/`.

This is a **behavior-preserving refactor**. No user-visible behavior, route path, persistence key, API call, or persona prompt changes. At MVP stage (0 live users) the velocity bias applies, but this phase is structural cleanup, not feature work — correctness and the existing test guard rails are the priority.

### 1.1 The scout/profiler asymmetry (why this isn't symmetric extraction)

Scout and Profiler are **not** symmetric on disk today, so the master plan's "(and a sibling `profiler/` if distinct enough)" resolves to **no standalone `features/profiler/`**:

- **Scout's research surface already *is* market-research** (Phase 5). Scout's only genuinely-distinct surface is the **ScoutDeployment** page — that is what `features/scout/` holds.
- **Profiler's surface already *is* customers** (Phase 7); its shared utilities were already moved to `shared/profiler/` by Phase 6, and its ICP-merge logic lives in mission-control. Re-extracting a `features/profiler/` would gut Phase 7's feature for no architectural gain.

Phase 9 therefore creates **one** feature folder (`features/scout/`), leaves Profiler distributed where Phases 6/7 already homed it, and unifies the duplicated chat into **`shared/chat`** so a single component serves both personas.

## 2. Scope

### In scope
- Unified `shared/chat/ChatWithHistory.tsx` component; both wrappers collapse onto it.
- Substrate component rename `SignalsContextChat` → `ContextChat`.
- New `features/scout/` (ScoutDeployment page + component, `routes.tsx`, `index.ts`, `README.md`).
- `App.tsx` / `app/routes.tsx` rewire for the moved ScoutDeployment route.
- Extract profiler ICP-merge logic into `shared/profiler/profilerIcpMerge.ts`; rewire mission-control + customers consumers.
- Delete the two verified-dead scout files (after confirming zero live importers).

### Out of scope (explicit non-goals)
- No `features/profiler/` folder (Profiler stays distributed — see §1.1).
- No change to scout/profiler **backend** behavior, endpoints, or persona prompts.
- No relocation of `src/utils/leadStreamChatContext.ts` (it is scout lead-stream plumbing, not part of the dedup, and may also be referenced by Strategist; left untouched to avoid the Phase 8 surface). Recorded as TD.
- No rename of the `SignalsChatContext` **type** (only the component renames). Recorded as TD.
- No resolution of the `UntypedProfilerIcpRecord` escape-hatch typing (remains a Phase 13 item).

## 3. Target structure

```
shared/chat/
  ContextChat.tsx          ← renamed from SignalsContextChat.tsx
  ChatWithHistory.tsx      ← NEW unified component
  useSignalAsk.ts          ← unchanged
  useSignalAction.ts       ← unchanged
  index.ts  README.md      ← updated
  __tests__/               ← repointed to ContextChat; + ChatWithHistory.test.tsx (new)

features/scout/            ← NEW feature folder
  pages/ScoutDeploymentPage.tsx
  components/ScoutDeployment.tsx
  routes.tsx  index.ts  README.md

features/market-research/  (scout chat wrapper shrinks, stays put)
  components/scout-chat/ScoutChatWithHistory.tsx   ← ~473 → ~50-80 LOC thin wrapper
  components/scout-chat/AddLeadModal.tsx           ← stays (scout lead-stream slot)
  components/scout-chat/SuggestedCompaniesSection.tsx ← stays (scout lead-stream slot)
  components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx ← stays (behavior guard)

features/customers/        (profiler chat wrapper shrinks, stays put)
  components/chat/ProfilerChatWithHistory.tsx      ← ~336 → ~20-40 LOC thin wrapper
  components/chat/__tests__/ProfilerChatWithHistory.test.tsx ← stays (behavior guard)
  components/icp-intelligence/*                    ← repoint merge import to shared/profiler

shared/profiler/
  profilerIcpMerge.ts      ← NEW (extracted from mission-control ICPManager)
  index.ts                 ← + profilerIcpMerge export
  __tests__/profilerIcpMerge.test.ts ← NEW

features/mission-control/
  components/icp/ICPManager.tsx  ← drops inline merge logic, imports shared/profiler
```

## 4. The unified chat component contract

`shared/chat/ChatWithHistory.tsx` owns the genuinely-invariant ~90%: session-list state, sidebar toggle, `localStorage` persistence, title/id generation, message-handling callbacks, and rendering the `ContextChat` substrate. Persona differences arrive via a config object. Scout's lead-stream-only behavior (which Profiler has no equivalent for) plugs in through a generic slot and a generic per-session `meta` payload — so **`shared/` never imports from `features/`** (the hard architectural boundary, satisfying the Approach-1 guarantee of zero `feature → feature` coupling).

```ts
interface ChatWithHistoryConfig {
  agent: "scout" | "profiler";       // forwarded into the ContextChat context
  storageKey: string;                // "scout_chat_sessions" | "profiler_chat_sessions"
  sessionIdPrefix: string;           // "scout_" | "profiler_"
  emptyContext?: SignalsChatContext; // profiler's EMPTY_PROFILER_CONTEXT fallback
}

interface ChatSession<TMeta = unknown> {        // session type generic over a meta payload
  id: string;
  title: string;
  messages: ChatMessage[];
  context: SignalsChatContext;
  meta?: TMeta;                                  // scout stores { leadContext }; profiler omits
}

interface ChatWithHistoryProps<TMeta = unknown> {
  config: ChatWithHistoryConfig;
  initialContext: SignalsChatContext | null;
  onClearContext?: () => void;
  onTabChange?: (tab: string) => void;
  buildInitialSession?: (ctx: SignalsChatContext | null) => Partial<ChatSession<TMeta>>; // scout hydrates leadContext
  renderExtras?: (state: ChatWithHistoryRenderState) => React.ReactNode;                 // scout renders SuggestedCompanies + AddLeadModal
}
```

Exact generic signatures and the shape of `ChatWithHistoryRenderState` are finalized in the plan (`plans/30-…`). This section fixes the **boundary**: the shared component is persona-agnostic; everything persona-specific is supplied by the caller via `config`, `buildInitialSession`, and `renderExtras`.

## 5. Substrate rename

`shared/chat/SignalsContextChat.tsx` → `shared/chat/ContextChat.tsx`. All importers repoint (the wrappers, the shared barrel, and any signals/strategist consumers from Phase 8). The `SignalsChatContext` **type** name is retained for this phase to limit churn — renaming it to a generic name (e.g. `ChatContext`) is recorded as TD. `index.ts` and `README.md` in `shared/chat/` update to reflect the new component name and the new `ChatWithHistory` export.

## 6. Wrapper disposition

Both wrappers **shrink to ultra-thin config holders and remain in their current features** — so call sites and existing tests stay stable, and no `feature → feature` import is introduced:

- `features/market-research/components/scout-chat/ScoutChatWithHistory.tsx`: holds the scout `ChatWithHistoryConfig`, the lead-stream `buildInitialSession` (hydrating `leadContext` from `sessionStorage`), and the `renderExtras` slot that renders `AddLeadModal` + `SuggestedCompaniesSection` (both kept local in `scout-chat/`). `TrendsTab.tsx`'s import path is **unchanged**.
- `features/customers/components/chat/ProfilerChatWithHistory.tsx`: holds the profiler `ChatWithHistoryConfig` (including `emptyContext: EMPTY_PROFILER_CONTEXT`) and forwards props. `CustomersPage.tsx`'s import path is **unchanged**.

The ~90% duplicated session/sidebar/persistence/message machinery that previously lived in both files now lives once, in `shared/chat/ChatWithHistory.tsx`.

## 7. `features/scout/`

Contains only Scout's genuinely-distinct surface:

- `pages/ScoutDeploymentPage.tsx` — from `src/pages/ScoutDeployment.tsx` (exported symbol renamed `ScoutDeployment` → `ScoutDeploymentPage`, matching the per-phase page-naming convention).
- `components/ScoutDeployment.tsx` — from `src/components/settings/ScoutDeployment.tsx` (the component the page renders; Phase 10 deliberately left this file in `components/settings/` for Phase 9 while it moved the other settings components — no same-file conflict, file-granular moves).
- `routes.tsx` — exports `scoutRoutes`, preserving the existing `/scout-deployment` path and route guards verbatim.
- `index.ts` — exports `{ scoutRoutes }` only (no external component consumers).
- `README.md` — feature overview, per phase convention.

`App.tsx` removes the `ScoutDeployment` import and its inline `<Route path="/scout-deployment">` block; `app/routes.tsx` adds the `scoutRoutes` spread to `featureRoutes` (append-only).

## 8. ICP-merge resolution (completes Phase 6 disposition)

The Phase 6 disposition (spec 25 §6) moved the profiler extract/display/cache utilities to `shared/profiler/` but left the ICP-**merge** logic inline in `features/mission-control/components/icp/ICPManager.tsx`, with customers reading it indirectly — flagged "Phase 9 resolves."

Phase 9 extracts that merge logic into `shared/profiler/profilerIcpMerge.ts`. Both `ICPManager` (mission-control) and customers' `icp-intelligence/*` consume it from `shared/profiler`, **eliminating the current `customers → mission-control` cross-feature read** and completing the established `shared/profiler` pattern. A new `shared/profiler/__tests__/profilerIcpMerge.test.ts` covers the extracted logic.

## 9. Cruft sweep

Delete the superseded Lovable leftovers, **only after the plan confirms zero live importers** via `git grep`:

- `src/components/market-research/ChatWithScout.tsx`
- `src/components/market-research/ScoutChatPanel.tsx`

If either turns out to have a live importer, it is **not** deleted in this phase; it is logged as TD instead.

## 10. Public surfaces (boundaries)

- `features/scout/index.ts` → `{ scoutRoutes }`.
- `shared/chat/index.ts` → `ContextChat`, `ChatWithHistory`, `ChatMessage`, `SignalsChatContext`, `useSignalAsk`, `useSignalAction`.
- `shared/profiler/index.ts` → existing exports **+** `profilerIcpMerge`.
- **No new `feature → feature` import** is introduced. The scout/profiler wrappers consume only `@/shared/chat`; customers' icp consumers consume only `@/shared/profiler`.

## 11. Behavior preservation

This is a pure refactor. The following are invariant:

- **`localStorage` keys** — `scout_chat_sessions`, `profiler_chat_sessions` unchanged; existing user sessions still hydrate.
- **`sessionStorage` `LEAD_STREAM_CHAT_CONTEXT_KEY`** unchanged; scout lead-stream flow intact.
- **Route path `/scout-deployment`** and its guards unchanged.
- **No API/endpoint/persona-prompt changes** — the substrate is renamed and recomposed, not rewired.
- Session id prefixes (`scout_`, `profiler_`) preserved via config.

## 12. Testing

- **Behavior guard (no regression):** the existing `ScoutChatWithHistory.test.tsx` (market-research) and `ProfilerChatWithHistory.test.tsx` (customers) stay and must pass through the now-thin wrappers — they exercise persona behavior plus scout's lead-stream end-to-end. Green = behavior preserved.
- **New `shared/chat/__tests__/ChatWithHistory.test.tsx`** — generic core: session create/select/delete, `localStorage` persistence keyed by `config.storageKey`, sidebar toggle, message handling, the `meta` payload path.
- **New `shared/profiler/__tests__/profilerIcpMerge.test.ts`** — the extracted merge logic.
- **Repoint** the existing `shared/chat` tests to the `ContextChat` rename.
- **MSW:** the chat uses `useSignalAsk`/`useSignalAction` → signal endpoints already mocked in `src/test/msw/handlers.ts`. Expect **no new handlers** (the plan confirms; avoids touching the contended shared handler file). If new handlers prove necessary, they are append-only.
- **Gate:** serial `npm run preflight`; vitest run with `--no-file-parallelism` under sandbox CPU contention (known parallel-contention flake).

## 13. Staged execution

Ordered to shrink the window in which shared/contended files are touched:

1. **`shared/chat` dedup** — rename substrate → `ContextChat`; build `ChatWithHistory`; repoint shared importers + tests. *(self-contained)*
2. **Collapse wrappers** — shrink the scout + profiler wrappers onto `ChatWithHistory`; existing tests guard behavior.
3. **ICP-merge extraction** — `shared/profiler/profilerIcpMerge.ts`; rewire `ICPManager` + customers icp consumers; new test. *(independent)*
4. **Create `features/scout/`** — move ScoutDeployment page + component; add `routes.tsx`/`index.ts`/`README`; edit `App.tsx` + `app/routes.tsx`.
5. **Cruft sweep + finalize** — verify-then-delete the two dead files; README/TD updates.

Routing edits (`App.tsx`, `app/routes.tsx`) — the only files the in-flight Phase 10/12 worktrees also touch — are concentrated in **Stage 4**, a single tight window. Each stage maps to a small set of commits per the repo's commit-granularity rule (one logical step = one commit).

## 14. Parallel-worktree coordination

Phase 9 runs as a **third concurrent worktree** alongside Phase 10 and Phase 12 (both currently at spec/plan stage with ~no code committed). Coordination rules:

- **Branch `worktree-phase-9-scout-profiler` off `master` (`9b2438d`)**; commit **surgically by path**, never `git add -A` in the shared working tree.
- **`App.tsx` / `app/routes.tsx`:** Phase 9's add/remove sites are at distinct line ranges from Phase 10 (auth/tenant/settings) and Phase 12 (calendar/insights/reports/artifacts/notfound). Conflicts at the merge gate are mechanical union resolutions.
- **`docs/TECH_DEBT.md`:** claim **TD-FE-57+** (master ceiling = 53; Phase 10 takes 54–56). Append-only.
- **`src/test/msw/handlers.ts`:** avoid touching (see §12); if unavoidable, append-only.
- **Preflight is a serialized resource** across worktrees — only one worktree can bind `:5173` for the Playwright e2e/VR step. Kill orphan vite preview servers by **specific PID** (no broad `pkill`) before running the gate.

## 15. Tech-debt entries (new, TD-FE-57+)

- **TD-FE-57 (proposed):** Profiler kept distributed across customers + mission-control; no `features/profiler/` folder. *Accepted decision* (see §1.1), recorded so future agents don't re-litigate. Trigger: if Profiler grows a standalone surface.
- **TD-FE-58 (proposed):** `SignalsChatContext` **type** name retained though the component renamed to `ContextChat`. Rename the type to a generic name when next touching `shared/chat` types.
- **TD-FE-59 (proposed):** `src/utils/leadStreamChatContext.ts` left in `utils/` rather than relocated to a feature/shared home; possibly shared between scout and strategist. Relocate when the lead-stream ownership is settled.

(Final numbers assigned at write time against the then-current `TECH_DEBT.md` ceiling.)

## 16. Allocations & pipeline

- **Spec/plan NN = 30.** This spec: `specs/30-frontend-phase-9-scout-profiler-design.md`. Plan: `plans/30-frontend-phase-9-scout-profiler.md`.
- **Pipeline:** this spec → `/review-spec` → `/synthesize-spec-review` (loop until findings are nit-or-below) → `writing-plans` → plan review loop → implementation on `worktree-phase-9-scout-profiler`.

## 17. Risks & open questions

- **Lead-stream genericization:** the scout `meta`/`buildInitialSession`/`renderExtras` plumbing is the highest-uncertainty part of the dedup. If genericizing it cleanly proves to balloon the shared component, the fallback is a `shared/chat/ChatWithHistoryBase` + named feature wrappers (the Approach-2 shape) — a plan-time escape hatch, not a spec change.
- **Cruft deletion:** contingent on the `git grep` importer check (§9); a live importer downgrades deletion to a TD entry.
- **`ContextChat` rename blast radius:** Phase 8 consumers (signals/strategist) import the substrate; the plan enumerates every importer before the rename so none are missed.

## Appendix: file manifest

| Action | From → To |
|---|---|
| Rename | `shared/chat/SignalsContextChat.tsx` → `shared/chat/ContextChat.tsx` |
| New | `shared/chat/ChatWithHistory.tsx` |
| New | `shared/chat/__tests__/ChatWithHistory.test.tsx` |
| Move | `src/pages/ScoutDeployment.tsx` → `features/scout/pages/ScoutDeploymentPage.tsx` |
| Move | `src/components/settings/ScoutDeployment.tsx` → `features/scout/components/ScoutDeployment.tsx` |
| New | `features/scout/{routes.tsx,index.ts,README.md}` |
| Shrink (in place) | `features/market-research/components/scout-chat/ScoutChatWithHistory.tsx` |
| Shrink (in place) | `features/customers/components/chat/ProfilerChatWithHistory.tsx` |
| New | `shared/profiler/profilerIcpMerge.ts` + `__tests__/profilerIcpMerge.test.ts` |
| Edit | `features/mission-control/components/icp/ICPManager.tsx` (drop inline merge) |
| Edit | `features/customers/components/icp-intelligence/*` (repoint merge import) |
| Edit | `shared/chat/index.ts`, `shared/profiler/index.ts` |
| Edit | `App.tsx` (remove ScoutDeployment import + route), `app/routes.tsx` (add `scoutRoutes`) |
| Delete (verified-dead) | `src/components/market-research/ChatWithScout.tsx`, `src/components/market-research/ScoutChatPanel.tsx` |
