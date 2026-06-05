# Phase 9 — scout + profiler · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dedup the two chat-history wrappers (`ScoutChatWithHistory` ~473 LOC + `ProfilerChatWithHistory` ~336 LOC) onto a single shared **history shell** in `src/shared/chat/` that takes a `renderChat` render prop; rename the substrate `SignalsContextChat` → `ContextChat`; relocate 5 scout/chat-adjacent residue files out of the legacy `src/components/market-research/` into `features/market-research/` (resolving TD-FE-51); create `features/scout/` for the ScoutDeployment surface; and close the Phase 6 Profiler-ICP open item by confirm-and-document (no code). Behavior, routes, storage keys, persona prompts, and visuals are frozen (Spec 30 §11).

**Architecture:** One branch (`worktree-phase-9-scout-profiler`, already created off `master` `9b2438d`), one plan, a staged commit-series with green checkpoints (Spec 30 §13): **S1** shared/chat rename + history-shell, **S2** collapse both wrappers onto the shell, **S3** relocate the 5 residue files, **S4** create `features/scout/` + route rewire, **finalize** (§8 doc, READMEs, TECH_DEBT, master-plan delta, serial preflight, merge). S2 depends on S1; S3/S4 are independent of S1–S2 and of each other — they may be dispatched to **parallel subagents** (each commits only its own named paths: S3 = market-research components, S4 = `features/scout` + `App.tsx`/`routes.tsx` — no file overlap; the surgical-commit rule keeps them isolated). The whole phase merges **once**, `--no-ff`, only after a green serial `npm run preflight`.

**Tech Stack:** React 18 + Vite + TypeScript, MSW (`src/test/msw/`), Vitest + React Testing Library (RTL), Playwright e2e/VR (signals journey `03`, market-research journey `04`, customers journey `06`). The shell lives in `src/shared/chat/` because `shared ↛ features` (Spec 30 §4) — it is persona-agnostic; everything persona-specific is supplied by the caller.

---

## Conventions & execution rules (read first — these override habits)

- **Branch & merge.** Work on `worktree-phase-9-scout-profiler` (already created off `master` `9b2438d`, with the spec + reviews committed). The whole phase merges **once**, `--no-ff`, after the finalize serial preflight is green. Do **not** merge per-stage. The branch is local/unshared, so a failed stage may be discarded with `git reset --hard <last-green-checkpoint-commit>` (Spec 30 §13).
- **Worktree git.** This executes in the `.claude/worktrees/phase-9-scout-profiler/` worktree. Run every git op as `git -C "$WT" …` where `WT=/projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/phase-9-scout-profiler` — a bare `cd <repo-root>` lands in the **main checkout (`master`)**, not the worktree (`feedback_worktree_cwd_gotcha`). **Define `WT` in the first git step of each task** (subagents start fresh; the variable does not persist across task boundaries). All `npm`/`vite`/`eslint` commands run from the worktree's `frontend/` subdir. **Exception: the merge (Task 14 Step 4) runs against the MAIN checkout, not the worktree** — `master` is checked out in the main checkout, so `git -C "$WT" checkout master` fails (`'master' is already checked out`).
- **Surgical commits in a shared tree.** Three worktrees (Phase 9/10/12) share the working tree. **Never `git add -A`.** Stage only the explicit paths each task names. One logical step = one commit (`feedback_surgical_commit_shared_tree`).
- **Commit messages.** `type(scope):` form (`feat(fe):`, `refactor(fe):`, `chore(fe):`, `test(fe):`, `docs(fe):` / `docs:`). No `[N/M]` suffixes. **No `Co-Authored-By` footer** (`feedback_no_co_authored_by`). Body only when the *why* isn't obvious.
- **Inner loop (per task).** From `frontend/`: `npm run verify` (= `typecheck && lint && test`). Plus, because `verify` omits `format:check`, run `npx prettier --check <touched files>` (`feedback_verify_omits_format_check`) — **except** never prettier `docs/TECH_DEBT.md` (outside the FE prettier gate; prettier corrupts its unfenced markdown — append entries by hand — `feedback_no_prettier_on_tech_debt`).
- **Do NOT run `npm run knip` before finalize.** S1 creates the `ChatWithHistory` shell + its barrel export before S2 consumes it (the shell is briefly an unused export). `knip --strict` would flag the transient unused export; the window closes in S2. `verify` does not run knip, so per-task gates stay green. `knip` runs only inside the finalize serial `preflight`.
- **Grep-driven repoints.** When a task repoints an import path, after editing the named files run `grep -rn "<old path>" frontend/src/` to confirm zero stragglers, then `npm run typecheck`. The enumerated importer lists below are the verified known set (extracted file-by-file); the grep is the backstop for anything not enumerated. If the grep finds an importer **not** in the list (e.g. a concurrent worktree added one since authoring), edit **and** stage it — **re-derive each task's final `git add` set from the actually-edited files (`git -C "$WT" status`), not by copying the plan's enumerated staging list verbatim.**
- **Shared test infra.** MSW handlers for `/api/signal_Ask` + `/api/signal_action` already exist (Phase 8, `handlers.ts:230-231`). Expect **no new handlers**. If a test needs a different shape, scope it with `server.use()` inside that test — do **not** change the shared default (a shared-default change can VR-regress a sibling feature's journey — `feedback_subphase_verification_shared_test_infra`).
- **Vitest flake.** If the full suite flakes on async `waitFor` tests under CPU contention, rerun `npm run test -- --no-file-parallelism` (100% green; not a defect — `project_vitest_parallel_contention_flake`). Do not weaken assertions.
- **Stage gates** (run from `frontend/`, after killing any orphan preview server by **specific PID** — never broad `pkill` in the shared sandbox, `feedback_no_broad_pkill_shared_sandbox`; find it with `lsof -ti :5173` and kill that PID if and only if it's a stale `vite preview`, `feedback_fe_e2e_orphan_preview_server`):
  - **S1 (rename + shell):** `npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts e2e/journeys/04-market-research-5-components.spec.ts e2e/journeys/03-signals-feed-action.spec.ts` (the substrate underpins customers' chat tab + market-research's Trends tab; signals shares the `signal_*` endpoints + the substrate type).
  - **S2 (collapse wrappers):** profiler → `06`; scout → `04` + `03`. Both wrappers render through the new shell; `03` (signals) is cheap belt-and-suspenders — the signals page renders `ContextChat` directly (not through either wrapper), so the collapse cannot regress it, but the substrate is shared, so run it anyway.
  - **S3 (relocate residue):** `04` (the 5 files are consumed by live market-research surfaces: Trends, Intelligence, MarketIntelligenceSections, MarketResearchPage).
  - **S4 (features/scout):** no scout-deployment Playwright journey exists — rely on the S4 Vitest render test + the finalize manual smoke of `/scout-deployment`.
  - VR threshold is 2% (`maxDiffPixelRatio: 0.02`); minor bounding-box shifts from added wrappers are acceptable if visually identical.
- **Final merge gate.** Serial `npm run preflight` (`typecheck && lint && format:check && test && build && bundle:check && test:e2e && knip`). **Serial** runner, never `preflight:par` (VR flakes under concurrent load; three worktrees share the box — `project_fe_test_infra_state`, TD-FE-29).
- **Parity is the contract.** No behavior or pixel change. If a step would change a rendered loading/error/empty state, a URL, a storage key (`scout_chat_sessions_<uid>`, `profiler_chat_sessions_<uid>`, `signalsChatContext`, `LEAD_STREAM_CHAT_CONTEXT_KEY`), a session id prefix (`scout_`/`profiler_`), or the substrate persona styling — stop. That's a parity break, not a refactor.
- **Abort / escalation.** Per-step parity + per-stage `git reset --hard <last-green-checkpoint>` are the recovery primitives. Above them: the **shell build (Task 2)** and the **scout-wrapper collapse (Task 5)** are the parity-critical seams. If either fails its gate **three** times with no clear fix, stop forcing the shell+`renderChat` boundary and escalate to the human controller. Fallback (Spec 30 §17, in order): (1) refactor the divergent piece into an optional shell hook (the contract already provides `hydrateExtraSessions`/`serializeSession`/`onNewChat`/`getSessionDisplayTitle`); (2) if the boundary still leaks, fall back to **Approach-2** — keep the shared file as a `ChatWithHistoryBase` but give each persona its **own named wrapper that owns the divergent render/effects directly** (no render-prop boundary), accepting the duplication the dedup was meant to remove; suspend and revisit Spec 30 before landing a partial cut.
- **Global abort (whole-plan kill criterion).** The phase is suspended (branch left in place for a later revisit, no merge) when a stage gate **or** the finalize preflight fails on a *genuine parity break* — a rendered behavior/visual change, or a changed storage key / route / session-id prefix — that cannot be fixed without changing behavior. This is distinct from (a) a mechanical cross-worktree conflict in `App.tsx`/`routes.tsx`/`TECH_DEBT.md` (union-resolve, see §S4/Task 14) and (b) a known vitest flake (rerun `--no-file-parallelism`), neither of which is an abort trigger. The same rule covers a failed **manual smoke (Task 14 Step 2)**: fix-on-branch and re-run smoke + preflight; if the failure is an unfixable parity break, suspend and escalate. The branch is local/unshared, so suspension costs only discarded work — **never land a partial or behavior-changing cut to clear a gate.**

---

## File structure (target — Spec 30 §3)

```
src/shared/chat/
├── ContextChat.tsx              # RENAMED from SignalsContextChat.tsx (component SignalsContextChat → ContextChat)
├── ChatWithHistory.tsx          # NEW history shell (renderChat prop supplies the chat surface)
├── index.ts                     # barrel: ContextChat + ChatWithHistory + types + hooks
├── useSignalAsk.ts              # unchanged
├── useSignalAction.ts           # unchanged
├── README.md                    # content-updated (rename done; dedup done)
└── __tests__/
    ├── ContextChat.test.tsx     # RENAMED from SignalsContextChat.test.tsx
    ├── ChatWithHistory.test.tsx # NEW (shell behavior)
    ├── useSignalAsk.test.tsx    # unchanged
    └── useSignalAction.test.tsx # unchanged

src/features/scout/              # NEW feature (Scout's distinct surface only)
├── pages/ScoutDeploymentPage.tsx   # from src/pages/ScoutDeployment.tsx (already exports ScoutDeploymentPage; filename change)
├── components/ScoutDeployment.tsx  # from src/components/settings/ScoutDeployment.tsx
├── routes.tsx                   # exports scoutRoutes ("/scout-deployment")
├── index.ts                     # exports { scoutRoutes }
└── README.md

src/features/market-research/components/
├── scout-chat/
│   ├── ScoutChatWithHistory.tsx     # ~473 → thin wrapper (supplies renderChat swap + renderExtras AddLeadModal)
│   ├── ScoutChatPanel.tsx           # RELOCATED from components/market-research/ (681 LOC)
│   ├── AddLeadModal.tsx             # stays (Phase-8 scout lead-stream slot)
│   ├── SuggestedCompaniesSection.tsx # stays
│   └── __tests__/ScoutChatWithHistory.test.tsx   # stays (behavior guard); mock paths repointed
├── types.ts                     # RELOCATED from components/market-research/types.ts (EditRecord/TrendSnapshot/IndustryTrendsRecommendations; 8 importers)
├── ChatWithScout.tsx            # RELOCATED (sole consumer TrendsTab)
├── ScoutSettingsForm.tsx        # RELOCATED (sole consumer MarketResearchPage)
└── intelligence/ScoutDeploymentDetails.tsx  # RELOCATED (sole consumer IntelligenceTab; HANDOFF comment rewritten)

src/features/customers/components/chat/
├── ProfilerChatWithHistory.tsx  # ~336 → thin wrapper (renderChat always ContextChat + EMPTY_PROFILER_CONTEXT fallback)
└── __tests__/ProfilerChatWithHistory.test.tsx   # stays (behavior guard); mock key repointed

src/components/market-research/   # PARTIALLY DRAINED — 6 files remain (TD-FE-60, deferred)
├── ScoutLeadStream.tsx · EditDropdownMenu.tsx
└── lead-stream/{LeadStreamTab,LeadsTable,OpportunityDashboard}.tsx · lead-stream/leadData.ts

UNCHANGED: src/shared/profiler/* (merge util already here);
           src/features/mission-control/components/icp/ICPManager.tsx (inline mapper stays, Plan-25 T21, §8 doc-only)
```

---

## The `ChatWithHistory` shell contract (target — finalizes Spec 30 §4)

This block is the **reference contract** for Tasks 2/4/5. It finalizes the signatures Spec 30 §4 left to the plan. Where it refines §4, the refinement is faithful to the **actual current behavior** (verified file-by-file) — a behavior-preserving refactor must match the code, not the §4 prose:

1. **`emptyContext` is NOT a shell config field.** Verified: new sessions are created with `context: null` in **both** personas; Profiler applies `EMPTY_PROFILER_CONTEXT` at *render time* (`context={session.context ?? EMPTY_PROFILER_CONTEXT}`), not at session creation. So the fallback lives in **Profiler's `renderChat`**, and the shell stays free of it. (Spec 30 §4's "shell consults emptyContext on new-session creation" note described a mechanism the code doesn't use.)
2. **`renderExtras` takes no args** (`() => ReactNode`) — Scout's only root-level overlay is `AddLeadModal`, driven by wrapper-internal state, not session state. Scout's `SuggestedCompaniesSection` + "Back to Lead Stream" button live *inside* the null-context branch, so they ride along in Scout's `renderChat`, not `renderExtras`. *Tradeoff:* this narrows the extension point §4 left open (`(state) => ReactNode`) — a future session-aware root overlay would need a one-line signature widening at that time. No current overlay reads session data, so YAGNI applies.
3. **Added beyond §4** (each maps to a real, verified divergence; all default to a no-op/identity so Profiler stays trivial): `gateIncomingByAgent`, `outerMaxWidthNone`, `emptyState`, `getSessionDisplayTitle`, `hydrateExtraSessions`, `serializeSession`, `onNewChat`.
4. **Renamed §4 fields** (same intent, clearer names, verified runtime): `config.storageKey` → `config.storageKeyPrefix` (the shell appends `_${uid}`, reproducing today's `${prefix}_${uid}` key exactly); `config.sidebarClassName` → `config.sidebarOpenClassName` (it sets only the *open-state* width — collapsed is always `w-0 overflow-hidden`).
5. **Replaced / dropped §4 fields.** Spec's `buildInitialSession` is replaced by three composable hooks — `hydrateExtraSessions` (Scout's lead-stream load injection) + `serializeSession` (Scout's persist strip) + `onNewChat` (Scout's new-chat side-effects) — because they are distinct concerns, not one. Spec's `onTabChange?` is **dropped from the shared props**: the shell never used it; only Scout's `renderChat` closure references it, so it stays a Scout-only wrapper prop, and Profiler's vestigial (declared-but-unused) `onTabChange` is deleted.

```ts
import type { ReactNode } from "react";
import type { ChatMessage, SignalsChatContext } from "@/shared/chat"; // co-located in ContextChat.tsx

/** A single chat session. `meta` carries persona-only per-session data (scout: { leadContext }). */
export interface ChatSession<TMeta = unknown> {
  id: string;
  title: string;
  context: SignalsChatContext | null;
  messages: ChatMessage[];
  createdAt: number;
  meta?: TMeta;
}

export interface ChatWithHistoryConfig {
  /** Persona. Forwarded into ingest gating; the substrate derives its blue/purple styling from context.agent internally. */
  agent: "scout" | "profiler";
  /** localStorage key prefix; runtime key = `${storageKeyPrefix}_${uid}`. */
  storageKeyPrefix: string; // "scout_chat_sessions" | "profiler_chat_sessions"
  /** Session id prefix used by the shell's generateId. */
  sessionIdPrefix: string; // "scout_" | "profiler_"
  /** Sidebar OPEN-state width classes (collapsed is always "w-0 overflow-hidden"). */
  sidebarOpenClassName: string;
  /** Scout's outer flex container adds `max-w-none`; profiler omits it. */
  outerMaxWidthNone?: boolean;
  /** When true (profiler), the incoming-context ingest effect ignores contexts whose agent !== config.agent. Scout: false/omit. */
  gateIncomingByAgent?: boolean;
  /** Empty-state (no active session) copy + whether to show the inline "New chat" button. Profiler: button shown; scout: not. */
  emptyState: { heading: string; body: string; showNewChatButton: boolean };
}

/** Passed by the shell into renderChat for the active session. */
export interface ChatWithHistoryRenderState<TMeta = unknown> {
  session: ChatSession<TMeta>;
  /** Patch the active session's messages (curried handler, pre-bound to session.id). */
  onMessagesChange: (messages: ChatMessage[]) => void;
  /** Shared closure: removeItem("signalsChatContext") → props.onClearContext?.() → new chat. */
  onClearContext: () => void;
  /** Delete the active session, select a neighbor (handleCloseChat). */
  onCloseChat: () => void;
}

export interface ChatWithHistoryProps<TMeta = unknown> {
  config: ChatWithHistoryConfig;
  /** Live parent handoff (e.g. signals → chat). Distinct from any per-session context. */
  initialContext: SignalsChatContext | null;
  onClearContext?: () => void;
  /** Session-list title for null-context sessions. Default: () => session.title. Scout: meta.leadContext?.sessionTitle ?? session.title. */
  getSessionDisplayTitle?: (session: ChatSession<TMeta>) => string;
  /** Synthetic sessions to PREPEND on load (scout reads sessionStorage[LEAD_STREAM_CHAT_CONTEXT_KEY]). Default: () => []. */
  hydrateExtraSessions?: () => ChatSession<TMeta>[];
  /** Transform a session before JSON.stringify on persist. Default: identity. Scout strips meta.leadContext. */
  serializeSession?: (session: ChatSession<TMeta>) => unknown;
  /** Extra side-effects appended to the shared new-chat logic (scout: clear prefill + remove LEAD_STREAM key). */
  onNewChat?: () => void;
  /** MAIN chat surface (persona-supplied). Profiler: <ContextChat context={session.context ?? EMPTY_PROFILER_CONTEXT} …/>;
   *  Scout: session.context ? <ContextChat/> : <ScoutChatPanel + lead-stream chrome/>. */
  renderChat: (state: ChatWithHistoryRenderState<TMeta>) => ReactNode;
  /** Root-level overlays rendered as a sibling of the two-column layout (scout: <AddLeadModal/>). */
  renderExtras?: () => ReactNode;
}
```

**Render-prop semantics (parity-critical).** `renderChat`/`renderExtras` MUST be **inline arrows** in the wrappers, recreated on every wrapper render — **never `useCallback`-memoized** — and the `ChatWithHistory` shell is **not** `React.memo`-wrapped. So when a wrapper's persona state changes (e.g. Scout's `suggestionPrefill`, `addLeadModalOpen`), the wrapper re-renders, passes fresh `renderChat`/`renderExtras` identities to the shell, the shell re-renders, and the surface is re-invoked with an up-to-date closure. Memoizing them (or memoizing the shell) would reintroduce a stale-closure bug where, e.g., a suggested-question prefill never reaches `ScoutChatPanel`.

**Shell ownership (what `ChatWithHistory.tsx` implements):** `sessions`/`activeSessionId`/`sidebarOpen` state; the localStorage **load** effect (parse → title-migrate → prepend `hydrateExtraSessions()` → set active to combined[0] when none set) and **persist** effect (remove-if-empty else `JSON.stringify(sessions.map(serializeSession))`); `getSessionTitle`; `generateId` (`${sessionIdPrefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`); the incoming-context ingest effect (gated by `gateIncomingByAgent`); `handleNewChat` (+ `onNewChat?.()`), `handleSelectSession`, `handleCloseChat`, `handleDeleteSession`, `handleMessagesChange`; the **entire sidebar JSX** (header + "New chat" button + session-list rows + collapsed-toggle button) parameterized by `sidebarOpenClassName` + `getSessionDisplayTitle`; the main-area wrapper; the **empty-state** (parameterized by `config.emptyState`); and the `renderExtras()` root slot.

**These pieces are byte-identical between the two wrappers — lift verbatim** (from `ProfilerChatWithHistory.tsx`, the simpler base): `getSessionTitle`, `handleSelectSession`, `handleCloseChat`, `handleDeleteSession`, `handleMessagesChange`, the sidebar header + "New chat" button markup, every session-row's markup/classNames, the collapsed-toggle button, the main-area wrapper div. **Only these diverge** → driven by config/hooks: sidebar width string, outer `max-w-none`, storage key prefix, id prefix, ingest agent-gate, empty-state copy + button, `getSessionDisplayTitle` null-context branch, the load-time lead-stream injection, the `leadContext` strip-on-persist, and `handleNewChat`'s extra side-effects.

---

# Stage S1 — `shared/chat` rename + history shell

Spec 30 §5, §13. Rename the substrate, then build the `ChatWithHistory` shell. Self-contained.

## Task 1: Rename `SignalsContextChat` → `ContextChat` (file + component + barrel + importers + tests + README)

**Files:**
- Rename: `frontend/src/shared/chat/SignalsContextChat.tsx` → `ContextChat.tsx`
- Rename: `frontend/src/shared/chat/__tests__/SignalsContextChat.test.tsx` → `ContextChat.test.tsx`
- Modify: `frontend/src/shared/chat/index.ts`
- Modify: `frontend/src/shared/chat/README.md`
- Modify: `frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx`
- Modify: `frontend/src/features/customers/components/chat/__tests__/ProfilerChatWithHistory.test.tsx`
- Modify: `frontend/src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx`
- Modify: `frontend/src/features/market-research/components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx`

Context: the **component** `SignalsContextChat` renames to `ContextChat`. The **types** `SignalsChatContext` + `ChatMessage` are **kept** (renaming the type is TD-FE-58). So type-only importers (`CustomersPage.tsx:13`, `TrendsTab.tsx:8`) and hook importers (`SignalsPage.tsx:24-25`) need **no edit** — only the barrel path and the component-name references change. Interconnected → one commit.

- [ ] **Step 1: `git mv` the component + its test.**

```bash
WT=/projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/phase-9-scout-profiler
git -C "$WT" mv frontend/src/shared/chat/SignalsContextChat.tsx frontend/src/shared/chat/ContextChat.tsx
git -C "$WT" mv frontend/src/shared/chat/__tests__/SignalsContextChat.test.tsx frontend/src/shared/chat/__tests__/ContextChat.test.tsx
```

- [ ] **Step 2: Rename the symbol inside `ContextChat.tsx`.** Change `export const SignalsContextChat` → `export const ContextChat`, and the props interface `interface SignalsContextChatProps` → `interface ContextChatProps` (plus its use in the component signature). Leave the exported types `SignalsChatContext` + `ChatMessage` and the internal `useSignalAsk`/`useSignalAction` imports (lines 21-22) untouched.

- [ ] **Step 3: Update the barrel `index.ts`.** Replace the component re-export + type-source path and the header comment:

```ts
// Cross-feature scout/profiler chat substrate. Consumed by market-research
// (ScoutChatWithHistory) + customers (ProfilerChatWithHistory) via the shared
// history shell. The substrate keeps the `SignalsChatContext` TYPE name (TD-FE-58).
export { ContextChat } from "./ContextChat";
export type { SignalsChatContext, ChatMessage } from "./ContextChat";

// Shared signal_Ask/signal_action TanStack hooks (Phase 8). Consumed by the
// signals page + the substrate; live in shared/ because `shared ↛ features`.
export { useSignalAsk, type SignalAskBody } from "./useSignalAsk";
export { useSignalAction, type SignalActionVars } from "./useSignalAction";
```
(The `ChatWithHistory` export is added by Task 2 — do not add it here yet.)

- [ ] **Step 4: Repoint the two wrapper value-imports + their JSX.**
  - `ProfilerChatWithHistory.tsx`: line 7 `import { SignalsContextChat } from "@/shared/chat";` → `import { ContextChat } from "@/shared/chat";`; JSX (~line 305) `<SignalsContextChat` → `<ContextChat`. (Line 6 type import is unchanged.)
  - `ScoutChatWithHistory.tsx`: line 19 `import { SignalsContextChat } from "@/shared/chat";` → `import { ContextChat } from "@/shared/chat";`; JSX (~line 377) `<SignalsContextChat` → `<ContextChat`. (Line 18 type import is unchanged.)

- [ ] **Step 5: Repoint the test mock keys + the renamed test's internals.**
  - `ContextChat.test.tsx` (the renamed file): line 7 `import { SignalsContextChat, type SignalsChatContext } from "@/shared/chat";` → `import { ContextChat, type SignalsChatContext } from "@/shared/chat";`; JSX (~line 28) `<SignalsContextChat context={context} />` → `<ContextChat context={context} />`; `describe("SignalsContextChat (substrate)", …)` → `describe("ContextChat (substrate)", …)`.
  - `ProfilerChatWithHistory.test.tsx`: the `vi.mock("@/shared/chat", () => ({ SignalsContextChat: () => <div data-testid="signals-context-chat" /> }))` mock KEY `SignalsContextChat` → `ContextChat`. **(Silent-failure point: if the mock key doesn't match the renamed export, the mock stops intercepting and the test mounts the real substrate.)** Keep the `data-testid` string as-is.
  - `ScoutChatWithHistory.test.tsx`: the `vi.mock("@/shared/chat", () => ({ SignalsContextChat: () => <div data-testid="substrate" /> }))` mock KEY → `ContextChat`. Keep `data-testid="substrate"`.

- [ ] **Step 6: Update `README.md`.** In `frontend/src/shared/chat/README.md`: rename the `SignalsContextChat` row in the public-surface table to `ContextChat`; in the "Phase 9 ownership (deferred)" section, change the "Final rename … deferred to Phase 9" bullet to past tense ("Renamed `SignalsContextChat` → `ContextChat` in Phase 9; the `SignalsChatContext` type name is retained — TD-FE-58"); note the wrapper dedup is now done via the `ChatWithHistory` shell (Task 2 lands the shell — wording can say "see `ChatWithHistory`").

- [ ] **Step 7: Grep-sweep for stragglers (incl. doc comments).**

```bash
grep -rn "SignalsContextChat" frontend/src/
```
Remaining hits should be **doc comments only** — update each for accuracy (non-blocking): `shared/chat/useSignalAsk.ts:12`, `shared/chat/useSignalAction.ts:11`, `shared/api/contracts/signals.ts:5`, `src/test/msw/handlers.ts:229`, `features/customers/README.md`, `features/strategist/components/__tests__/StrategistWorkspace.test.tsx:30` (a cross-reference comment). No code references must remain.

- [ ] **Step 8: Verify + prettier.** From `frontend/`:

```
npm run verify
npx prettier --check src/shared/chat/ContextChat.tsx src/shared/chat/index.ts "src/shared/chat/__tests__/ContextChat.test.tsx" src/features/customers/components/chat/ProfilerChatWithHistory.tsx "src/features/customers/components/chat/__tests__/ProfilerChatWithHistory.test.tsx" src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx "src/features/market-research/components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx"
# targeted mock-key check (verify won't catch a stale key — both real + mocked substrate render "New chat"):
grep -A2 'vi.mock("@/shared/chat"' "src/features/customers/components/chat/__tests__/ProfilerChatWithHistory.test.tsx" "src/features/market-research/components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx"
```
Expected: PASS. Typecheck confirms the barrel + every repoint resolves; the two wrapper smoke tests still mount. **The grep's two mock blocks must each read `ContextChat:` as the object key — a leftover `SignalsContextChat:` key silently disables the mock and the test would mount the real substrate (which hits `useSignalAsk` → MSW).**

- [ ] **Step 9: Stage gate (substrate consumers).**

```
# kill stale :5173 preview by specific PID only if present
lsof -ti :5173 | xargs -r -I{} sh -c 'ps -p {} -o args= | grep -q "vite preview" && kill {}'
npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts e2e/journeys/04-market-research-5-components.spec.ts e2e/journeys/03-signals-feed-action.spec.ts
```
Expected: PASS, VR within 2%.

- [ ] **Step 10: Commit.**

```bash
git -C "$WT" add frontend/src/shared/chat/ContextChat.tsx frontend/src/shared/chat/__tests__/ContextChat.test.tsx frontend/src/shared/chat/index.ts frontend/src/shared/chat/README.md frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx frontend/src/features/customers/components/chat/__tests__/ProfilerChatWithHistory.test.tsx frontend/src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx frontend/src/features/market-research/components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx
# add any doc-comment files touched in Step 7, by path
git -C "$WT" commit -m "refactor(fe): rename SignalsContextChat substrate to ContextChat"
```

## Task 2: Build the `ChatWithHistory` history shell

**Files:**
- Create: `frontend/src/shared/chat/ChatWithHistory.tsx`
- Modify: `frontend/src/shared/chat/index.ts` (export the shell + its public types)

Context: **parity-critical seam #1** (see Abort/escalation). This lifts the shared session/sidebar/persistence machinery into one persona-agnostic component. Use `ProfilerChatWithHistory.tsx` as the structural base (its on-disk session shape is identical to Scout's once `leadContext` is stripped, and it has no persona side-effects). Read **both** wrapper files in full before writing — the shell must reproduce the byte-identical pieces exactly. The shell **must not import from `@/features/*`** (lint `import-x/no-internal-modules` + the `shared ↛ features` rule enforce this; the shell only imports `@/components/ui/*`, `@/shared/auth`, lucide, react, and its own `./ContextChat` types).

- [ ] **Step 1: Write `ChatWithHistory.tsx`** implementing the contract block above. Structure:

```tsx
import {
  MessageCircle,
  MessageSquarePlus,
  PanelLeft,
  PanelLeftClose,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { ChatMessage, SignalsChatContext } from "./ContextChat";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/shared/auth";

export interface ChatSession<TMeta = unknown> { /* …per contract block… */ }
export interface ChatWithHistoryConfig { /* …per contract block… */ }
export interface ChatWithHistoryRenderState<TMeta = unknown> { /* …per contract block… */ }
export interface ChatWithHistoryProps<TMeta = unknown> { /* …per contract block… */ }

function getSessionTitle(context: SignalsChatContext | null): string {
  if (!context) return "New chat";
  const heading = context.signalHeading ?? context.recommendation ?? context.recommendations?.[0];
  if (heading && typeof heading === "string") return heading;
  return "Signal chat";
}

export function ChatWithHistory<TMeta = unknown>(props: ChatWithHistoryProps<TMeta>) {
  const {
    config,
    initialContext,
    onClearContext,
    getSessionDisplayTitle,
    hydrateExtraSessions,
    serializeSession,
    onNewChat,
    renderChat,
    renderExtras,
  } = props;
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<ChatSession<TMeta>[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const storageKey = currentUser?.uid ? `${config.storageKeyPrefix}_${currentUser.uid}` : null;
  const processedContextRef = useRef<string | null>(null);

  const generateId = () =>
    `${config.sessionIdPrefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // …LOAD effect, PERSIST effect, INGEST effect, handlers, JSX… (steps 2–6)
}
```

- [ ] **Step 2: LOAD effect** (`useEffect`, dep `[storageKey]`). Lift Profiler's load (parse `JSON.parse(localStorage[storageKey])`, run the **title-migration** block verbatim — `if (context && (title.endsWith("…") || title.length < 50)) title = getSessionTitle(context)`). Then prepend the wrapper's synthetic sessions and pick the active id:

```ts
const loaded = /* parsed + title-migrated array, or [] */;
const injected = hydrateExtraSessions?.() ?? [];
const combined = [...injected, ...loaded];
setSessions(combined);
if (!activeSessionId && combined.length > 0) setActiveSessionId(combined[0].id);
```
This reproduces both behaviors: Profiler (no injection → active = stored[0]) and Scout (injected lead session first → active = injected[0]). **Parity note:** Scout's original sets the active id on every load; the shell's `!activeSessionId` guard matches on first mount (activeSessionId starts null) and is the safer behavior on user-switch. If the S2 scout gate (Task 5) shows a lead-stream-entry regression tied to active-selection, add a `config.resetActiveOnLoad?: boolean` and set it for scout — but try without it first.

- [ ] **Step 3: PERSIST effect** (`useEffect`, dep `[storageKey, sessions]`). Lift Profiler's persist; apply `serializeSession`:

```ts
if (!storageKey) return;
if (sessions.length === 0) {
  localStorage.removeItem(storageKey);
  return;
}
const serialize = serializeSession ?? ((s: ChatSession<TMeta>) => s);
localStorage.setItem(storageKey, JSON.stringify(sessions.map(serialize)));
```
Default identity = Profiler's verbatim save; Scout passes a `serializeSession` that strips `meta.leadContext` (Task 5). The on-disk shape stays identical to today.

- [ ] **Step 4: INGEST effect** (`useEffect`, deps include the `initialContext.*` fields + `config.agent`). Lift Profiler's ingest verbatim **except** generalize the agent gate:

```ts
if (!initialContext) return;
if (config.gateIncomingByAgent && initialContext.agent !== config.agent) return;
// …then the byte-identical contextKey build + processedContextRef dedupe +
//    existing-session merge + new-session create (lift verbatim from either wrapper)…
```
Profiler sets `gateIncomingByAgent: true`; Scout omits it (no gate), matching today.

- [ ] **Step 5: Handlers.** Lift `handleSelectSession`, `handleCloseChat`, `handleDeleteSession`, `handleMessagesChange` **verbatim** (byte-identical across both wrappers). For `handleNewChat`, lift the shared core (create empty `context: null` session, prepend, set active, `removeItem("signalsChatContext")`, `onClearContext?.()`) and append `onNewChat?.()` at the end for persona side-effects. Build the shared `onClearContext` closure the render state exposes:

```ts
const handleClearActiveContext = useCallback(() => {
  sessionStorage.removeItem("signalsChatContext");
  onClearContext?.();
  handleNewChat();
}, [onClearContext, handleNewChat]);
const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
```

- [ ] **Step 6: JSX.** Lift Profiler's two-column layout verbatim, parameterizing only the divergent tokens:
  - Outer container: `` `flex h-full min-h-0 w-full overflow-hidden${config.outerMaxWidthNone ? " max-w-none" : ""}` ``.
  - Sidebar width: `` sidebarOpen ? config.sidebarOpenClassName : "w-0 overflow-hidden" `` (base classes `flex flex-col border-r border-border bg-muted/30 transition-all duration-200` verbatim).
  - Sidebar header + "New chat" button + collapsed-toggle button: verbatim.
  - Session-list rows: verbatim, except `displayTitle`:

```ts
const displayTitle = session.context
  ? getSessionTitle(session.context)
  : (getSessionDisplayTitle?.(session) ?? session.title);
```
  - Main area: `{activeSession ? renderChat({ session: activeSession, onMessagesChange: handleMessagesChange(activeSession.id), onClearContext: handleClearActiveContext, onCloseChat: handleCloseChat }) : <EmptyState/>}` where `<EmptyState/>` renders the shared icon + `config.emptyState.heading` / `.body`, and — when `config.emptyState.showNewChatButton` — the `<Button onClick={handleNewChat}>` ("New chat", `MessageSquarePlus` icon) with `mb-4` on the body paragraph (matching Profiler); when false, no button + `max-w-sm` on the body (matching Scout).
  - After the two-column `</div>`, render `{renderExtras?.()}` (wrap the whole return in a fragment).

- [ ] **Step 7: Export from the barrel.** Append to `src/shared/chat/index.ts`:

```ts
export { ChatWithHistory } from "./ChatWithHistory";
export type {
  ChatSession,
  ChatWithHistoryConfig,
  ChatWithHistoryProps,
  ChatWithHistoryRenderState,
} from "./ChatWithHistory";
```

- [ ] **Step 8: Verify + prettier.**

```
npm run verify
npx prettier --check src/shared/chat/ChatWithHistory.tsx src/shared/chat/index.ts
```
Expected: PASS. (Do **not** run knip — the shell is an unused export until S2.)

- [ ] **Step 9: Commit.**

```bash
WT=/projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/phase-9-scout-profiler
git -C "$WT" add frontend/src/shared/chat/ChatWithHistory.tsx frontend/src/shared/chat/index.ts
git -C "$WT" commit -m "feat(fe): add ChatWithHistory shared history shell"
```

> **Optional finer-grained split (recommended for bisectability):** land two commits instead — (1) the structural shell (state + `generateId` + the four handlers + sidebar/main-area/empty-state JSX, with the three effects stubbed), gated on `npm run typecheck`; (2) the LOAD/PERSIST/INGEST effects, gated on `npm run verify`. The shell is **unused until S2**, so neither a whole-component commit nor the split carries any parity exposure — this is purely commit granularity, not safety.

## Task 3: Shell unit test

**Files:** Create `frontend/src/shared/chat/__tests__/ChatWithHistory.test.tsx`

Context: test the shell's **own** behavior (the persona-agnostic core), independent of either wrapper. Mock `@/shared/auth` for `currentUser.uid` (mirror `ContextChat.test.tsx` / the wrapper tests). Use a trivial `renderChat` test double; assert the shell's contract. This is a **focused smoke** of the core (3 scenarios — empty state, create+persist, hydrate+select), **not** exhaustive: sidebar toggle, delete, the INGEST effect, `serializeSession` strip, `gateIncomingByAgent`, and `getSessionDisplayTitle` are exercised end-to-end through the existing wrapper tests + the finalize e2e, which are the real behavior guards for this behavior-preserving refactor. Add more shell-level cases only if a real gap surfaces.

- [ ] **Step 1: Write the test.**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

import { ChatWithHistory, type ChatWithHistoryConfig } from "@/shared/chat";

const config: ChatWithHistoryConfig = {
  agent: "profiler",
  storageKeyPrefix: "test_chat_sessions",
  sessionIdPrefix: "test_",
  sidebarOpenClassName: "w-64",
  emptyState: { heading: "Chat with Test", body: "Start a chat.", showNewChatButton: true },
};

describe("ChatWithHistory (shell)", () => {
  beforeEach(() => localStorage.clear());

  it("renders the empty state with a New chat button when configured", () => {
    render(
      <ChatWithHistory
        config={config}
        initialContext={null}
        renderChat={({ session }) => <div data-testid="chat">{session.id}</div>}
      />,
    );
    expect(screen.getByText("Chat with Test")).toBeInTheDocument();
    expect(screen.getAllByText("New chat").length).toBeGreaterThan(0);
  });

  it("creates a session via New chat, calls renderChat, and persists to the configured key", () => {
    render(
      <ChatWithHistory
        config={config}
        initialContext={null}
        renderChat={({ session }) => <div data-testid="chat">{session.id}</div>}
      />,
    );
    // the sidebar "New chat" button (empty-state + sidebar both render one; pick the first)
    fireEvent.click(screen.getAllByText("New chat")[0]);
    expect(screen.getByTestId("chat")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("test_chat_sessions_u1") ?? "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].id).toMatch(/^test_/);
  });

  it("prepends hydrateExtraSessions output and selects it active", () => {
    render(
      <ChatWithHistory
        config={config}
        initialContext={null}
        hydrateExtraSessions={() => [
          { id: "test_injected", title: "Injected", context: null, messages: [], createdAt: 1 },
        ]}
        getSessionDisplayTitle={(s) => s.title}
        renderChat={({ session }) => <div data-testid="chat">{session.id}</div>}
      />,
    );
    expect(screen.getByTestId("chat")).toHaveTextContent("test_injected");
  });
});
```
(If `ChatWithHistory` needs a router or other provider to mount, add the minimal wrapper used by `ContextChat.test.tsx`; read that file first.)

- [ ] **Step 2: Verify + prettier + commit.**

```
npm run verify
npx prettier --check "src/shared/chat/__tests__/ChatWithHistory.test.tsx"
```
```bash
git -C "$WT" add frontend/src/shared/chat/__tests__/ChatWithHistory.test.tsx
git -C "$WT" commit -m "test(fe): add ChatWithHistory shell unit test"
```

---

# Stage S2 — Collapse the wrappers onto the shell

Spec 30 §6. Shrink both wrappers to thin config holders. The existing `ProfilerChatWithHistory.test.tsx` + `ScoutChatWithHistory.test.tsx` are the behavior guards — they assert on the wrappers' render **output** (the empty-state "New chat" mount signal + the mocked substrate), so they survive the dedup unchanged. Do Profiler first (simplest), then Scout (the swap).

## Task 4: Collapse `ProfilerChatWithHistory` onto the shell

**Files:** Modify `frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx`

Context: Profiler always renders `ContextChat`, applying `EMPTY_PROFILER_CONTEXT` when the session context is null. After the dedup the wrapper holds only: the props, `EMPTY_PROFILER_CONTEXT`, the config, and a `renderChat` returning `ContextChat`. The `ProfilerChatSession` interface, the load/persist/ingest/handlers, the sidebar JSX, and `getSessionTitle` all move to the shell. Drop the dead `onTabChange` prop (declared but unused — verified).

- [ ] **Step 1: Rewrite the wrapper.**

```tsx
import { ChatWithHistory, type ChatWithHistoryConfig } from "@/shared/chat";
import type { SignalsChatContext } from "@/shared/chat";

interface ProfilerChatWithHistoryProps {
  /** Incoming context from the Signals page (e.g. "Chat with Profiler" from a signal). */
  initialContext: SignalsChatContext | null;
  onClearContext?: () => void;
}

/** Minimal context for general Profiler chat (no signal). */
const EMPTY_PROFILER_CONTEXT: SignalsChatContext = { agent: "profiler", prompt: "" };

const PROFILER_CHAT_CONFIG: ChatWithHistoryConfig = {
  agent: "profiler",
  storageKeyPrefix: "profiler_chat_sessions",
  sessionIdPrefix: "profiler_",
  sidebarOpenClassName: "w-[28rem] min-w-[24rem] max-w-[90vw] shrink-0",
  gateIncomingByAgent: true,
  emptyState: {
    heading: "Chat with Profiler",
    body: "Start a new conversation or select a signal from the Signals page to discuss it with Profiler.",
    showNewChatButton: true,
  },
};

export function ProfilerChatWithHistory({
  initialContext,
  onClearContext,
}: ProfilerChatWithHistoryProps) {
  return (
    <ChatWithHistory
      config={PROFILER_CHAT_CONFIG}
      initialContext={initialContext}
      onClearContext={onClearContext}
      renderChat={({ session, onMessagesChange, onClearContext: onClear, onCloseChat }) => (
        <ContextChat
          key={session.id}
          context={session.context ?? EMPTY_PROFILER_CONTEXT}
          initialMessages={session.messages}
          onMessagesChange={onMessagesChange}
          onClose={onCloseChat}
          onClearContext={onClear}
        />
      )}
    />
  );
}
```
Add `import { ContextChat } from "@/shared/chat";` to the value imports (collapse with the `ChatWithHistory` import line). Confirm the live `EMPTY_PROFILER_CONTEXT` literal matches (it does: `{ agent: "profiler", prompt: "" }`) and the `sidebarOpenClassName` string matches the live `w-[28rem] min-w-[24rem] max-w-[90vw] shrink-0` verbatim.

- [ ] **Step 2: Confirm no callers passed `onTabChange`.** `grep -rn "ProfilerChatWithHistory" frontend/src/` — the only consumer is `CustomersPage.tsx`. Verify it does not rely on `onTabChange` (it was a dead prop). If a caller (or the test) passes `onTabChange`, that's fine — an extra unknown prop on a typed component is a type error, so check: `ProfilerChatWithHistory.test.tsx` renders with `onTabChange={() => {}}`. **Remove that prop from the test render** in this same commit (it no longer exists on the interface).

- [ ] **Step 3: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/customers/components/chat/ProfilerChatWithHistory.tsx "src/features/customers/components/chat/__tests__/ProfilerChatWithHistory.test.tsx"
```
Expected: PASS. The existing smoke test (asserts ≥1 "New chat") still passes through the shell.

- [ ] **Step 4: Stage gate (customers).**

```
lsof -ti :5173 | xargs -r -I{} sh -c 'ps -p {} -o args= | grep -q "vite preview" && kill {}'
npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts
```
Expected: PASS, VR within 2%.

- [ ] **Step 5: Commit.**

```bash
git -C "$WT" add frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx frontend/src/features/customers/components/chat/__tests__/ProfilerChatWithHistory.test.tsx
git -C "$WT" commit -m "refactor(fe): collapse ProfilerChatWithHistory onto the ChatWithHistory shell"
```

## Task 5: Collapse `ScoutChatWithHistory` onto the shell

**Files:** Modify `frontend/src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx`

Context: **parity-critical seam #2.** Scout's `renderChat` reproduces the `activeSession.context ? <ContextChat/> : <ScoutChatPanel + lead-stream chrome/>` swap verbatim; Scout supplies `hydrateExtraSessions` (the `LEAD_STREAM_CHAT_CONTEXT_KEY` injection), `serializeSession` (strip `meta.leadContext`), `onNewChat` (clear prefill + remove the LEAD_STREAM key), `getSessionDisplayTitle` (null-context → `meta.leadContext?.sessionTitle ?? session.title`), and `renderExtras` (`AddLeadModal`). The wrapper keeps its persona-only state: `editHistory` (prop), `suggestionPrefill`, `addLeadModalOpen`, `addLeadInitialData`, and the `handleAddToLeadStream`/`handleLeadAdded`/`clearSuggestionPrefill` callbacks. **Read the live `ScoutChatWithHistory.tsx` in full before editing** — the `ScoutChatPanel` invocation (~30 props) and the lead-context-derived props must be copied verbatim into the new `renderChat`.

The wrapper's `meta` carries Scout's `leadContext`: parameterize `ChatWithHistory<LeadStreamChatContextMeta>` where `interface LeadStreamChatContextMeta { leadContext?: LeadStreamChatContext }` (so `session.meta?.leadContext` replaces the old `session.leadContext`).

- [ ] **Step 1: Define the meta type + the persona hooks.** At the top of the wrapper:

```ts
interface ScoutSessionMeta {
  leadContext?: LeadStreamChatContext;
}
```
  - `hydrateExtraSessions`: lift Scout's live load-time lead-stream injection (the block that reads `sessionStorage.getItem(LEAD_STREAM_CHAT_CONTEXT_KEY)`, builds the synthetic `Research: ${personName}` session with `meta: { leadContext }`, and returns it). Return `[]` when no lead context is present. **It must build the session id with the same `scout_` prefix** (use the shell's generated ids by returning a session whose `id` is created the same way the live code does — copy the live id-generation for the injected session verbatim).
  - `serializeSession`: `(s) => { const { meta, ...rest } = s; return rest; }` — strips `meta` (which holds `leadContext`) before persist, matching the live `leadContext` strip. (On-disk shape stays `{id,title,context,messages,createdAt}`.)
  - `onNewChat`: `() => { setSuggestionPrefill(null); sessionStorage.removeItem(LEAD_STREAM_CHAT_CONTEXT_KEY); }` — the two extra side-effects the live `handleNewChat` had beyond the shared core.
  - `getSessionDisplayTitle`: `(s) => s.meta?.leadContext?.sessionTitle ?? s.title`.

- [ ] **Step 2: Build `renderChat`** reproducing the live swap (lines ~375-449), reading `session.context` / `session.meta?.leadContext` from the render state. Profiler-shared substrate branch:

```tsx
renderChat={({ session, onMessagesChange, onClearContext: onClear, onCloseChat }) =>
  session.context ? (
    <ContextChat
      key={session.id}
      context={session.context}
      initialMessages={session.messages}
      onMessagesChange={onMessagesChange}
      onClose={onCloseChat}
      onClearContext={onClear}
    />
  ) : (
    <div className="flex flex-1 min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="flex flex-col gap-3 flex-1 min-h-0 min-w-0 overflow-hidden">
        {onTabChange && session.meta?.leadContext && (
          <Button /* "Back to Lead Stream" — verbatim from live, onClick={() => onTabChange("analysis")} */ />
        )}
        <ScoutChatPanel
          key={session.id}
          /* …copy ALL ~30 props verbatim from the live invocation, replacing
             activeSession.leadContext → session.meta?.leadContext,
             editHistory={editHistory}, prefillQuestion={suggestionPrefill},
             onPrefillConsumed={clearSuggestionPrefill}, onPickSuggestedQuestion={setSuggestionPrefill},
             onClose={onCloseChat}… */
        />
        {session.meta?.leadContext && (
          <SuggestedCompaniesSection onAddToLeadStream={handleAddToLeadStream} />
        )}
      </div>
    </div>
  )
}
```
**Do not paraphrase the `ScoutChatPanel` props** — copy the live block exactly, only rewriting `activeSession.leadContext` → `session.meta?.leadContext` and `handleCloseChat` → `onCloseChat`. Keep `onTabChange` as a wrapper prop (Scout uses it; it's real here).

- [ ] **Step 3: Build `renderExtras`** = the root-level `AddLeadModal`:

```tsx
renderExtras={() => (
  <AddLeadModal
    open={addLeadModalOpen}
    onOpenChange={setAddLeadModalOpen}
    initialData={addLeadInitialData}
    onSuccess={handleLeadAdded}
  />
)}
```

- [ ] **Step 4: Assemble the wrapper.** Props interface keeps `initialContext`, `onClearContext`, `editHistory?: EditRecord[]`, `onTabChange?: (tab: string) => void`. The body: the persona state (`suggestionPrefill`, `addLeadModalOpen`, `addLeadInitialData`) + the three callbacks (`handleAddToLeadStream`, `handleLeadAdded`, `clearSuggestionPrefill` — lift verbatim), the `SCOUT_CHAT_CONFIG` (`agent: "scout"`, `storageKeyPrefix: "scout_chat_sessions"`, `sessionIdPrefix: "scout_"`, `sidebarOpenClassName: "w-64 sm:w-72 min-w-[14rem] max-w-[min(18rem,42vw)] shrink-0"`, `outerMaxWidthNone: true`, `gateIncomingByAgent` omitted, `emptyState: { heading: "Chat with Scout", body: "Start a new conversation or select a signal from the Signals page to discuss it with Scout.", showNewChatButton: false }`), and the `<ChatWithHistory<ScoutSessionMeta> … />` element wiring all the hooks/render props above. Remove the now-unused imports (`useState`/`useEffect`/`useCallback`/`useRef` may still be needed for the persona state — keep what's used; drop `MessageCircle`, `PanelLeftClose`, `PanelLeft`, `Trash2`, `MessageSquarePlus` if they only appeared in the lifted sidebar/empty-state). Run lint to catch unused imports.

- [ ] **Step 5: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx
```
Expected: PASS. The existing `ScoutChatWithHistory.test.tsx` (asserts ≥1 "New chat"; substrate + ScoutChatPanel + AddLeadModal + SuggestedCompaniesSection all mocked) still passes.

- [ ] **Step 6: Stage gate (market-research).**

```
lsof -ti :5173 | xargs -r -I{} sh -c 'ps -p {} -o args= | grep -q "vite preview" && kill {}'
npm run test:e2e -- e2e/journeys/04-market-research-5-components.spec.ts e2e/journeys/03-signals-feed-action.spec.ts
```
Expected: PASS, VR within 2% (`03` is cheap insurance per the S2 gate convention — the signals page uses the substrate directly). If a lead-stream-entry regression appears tied to active-session selection, apply the `config.resetActiveOnLoad` fallback from Task 2 Step 2 (add the flag to the shell + set it in `SCOUT_CHAT_CONFIG`), re-run. Three failures with no clear fix → escalate (see Abort/escalation).

- [ ] **Step 7: Commit.**

```bash
git -C "$WT" add frontend/src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx
git -C "$WT" commit -m "refactor(fe): collapse ScoutChatWithHistory onto the ChatWithHistory shell"
```

---

# Stage S3 — Relocate the scout/chat-adjacent legacy residue

Spec 30 §9. Move 5 files out of `src/components/market-research/` into `features/market-research/`, repoint importers. Move-only — no logic change. The lead-stream subsystem + `EditDropdownMenu` stay (TD-FE-60). Independent of S1/S2.

## Task 6: Relocate `ScoutChatPanel.tsx` + `types.ts` (coupled)

**Files:**
- Move: `src/components/market-research/ScoutChatPanel.tsx` → `src/features/market-research/components/scout-chat/ScoutChatPanel.tsx`
- Move: `src/components/market-research/types.ts` → `src/features/market-research/components/types.ts`
- Modify importers (see below)

Context: coupled because `ScoutChatPanel.tsx:7` imports `./types` relatively; after the move they're no longer siblings (`ScoutChatPanel` → `scout-chat/`, `types` → `components/` root), so that import becomes `../types`. `types.ts` exports **three** interfaces (`EditRecord`, `TrendSnapshot`, `IndustryTrendsRecommendations`) with **8** `@/`-path importers. Interconnected → one commit.

- [ ] **Step 1: `git mv` both files.**

```bash
git -C "$WT" mv frontend/src/components/market-research/ScoutChatPanel.tsx frontend/src/features/market-research/components/scout-chat/ScoutChatPanel.tsx
git -C "$WT" mv frontend/src/components/market-research/types.ts frontend/src/features/market-research/components/types.ts
```

- [ ] **Step 2: Fix `ScoutChatPanel.tsx`'s self-import.** Line 7 `import type { EditRecord } from "./types";` → `import type { EditRecord } from "../types";`. (Its other imports are `@/…` absolute — unchanged.)

- [ ] **Step 3: Repoint the 8 `types.ts` importers** from `@/components/market-research/types` → `@/features/market-research/components/types`:
  - `src/features/market-research/components/trends/TrendsTab.tsx:7`
  - `src/features/market-research/components/intelligence/regulatory-compliance/types.ts:3`
  - `src/features/market-research/components/intelligence/market-entry/MarketEntrySection.tsx:22`
  - `src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx:16`
  - `src/features/market-research/components/intelligence/industry-trends/types.ts` (the multi-line import ending `} from "@/components/market-research/types";`)
  - `src/features/market-research/components/intelligence/competitor-landscape/types.ts:1`
  - `src/features/market-research/components/MarketIntelligenceSections.tsx:10` (imports `EditRecord, TrendSnapshot`)
  - `src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx:15` (if still importing `EditRecord` after the S2 collapse — verify; the collapsed wrapper still types `editHistory?: EditRecord[]`, so it does)

- [ ] **Step 4: Repoint the 2 `ScoutChatPanel` importers** from `@/components/market-research/ScoutChatPanel` → `@/features/market-research/components/scout-chat/ScoutChatPanel`:
  - `src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx:14` → relative `./ScoutChatPanel` (same folder).
  - `src/features/market-research/components/MarketIntelligenceSections.tsx:9` → `@/features/market-research/components/scout-chat/ScoutChatPanel`.

- [ ] **Step 5: Repoint the test mock** in `src/features/market-research/components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx:16`: `vi.mock("@/components/market-research/ScoutChatPanel", …)` → `vi.mock("./ScoutChatPanel", …)` (relative, matching the wrapper's new relative import) **or** the new absolute path — match whatever the wrapper imports so the mock intercepts. **Silent-failure point.**

- [ ] **Step 6: Grep-backstop + verify.**

```bash
grep -rn "components/market-research/ScoutChatPanel" frontend/src/   # expect: none
grep -rn "components/market-research/types" frontend/src/            # expect: none
```
```
npm run verify
npx prettier --check src/features/market-research/components/scout-chat/ScoutChatPanel.tsx src/features/market-research/components/types.ts
```
Expected: PASS. Lint confirms no `@/features/*` deep-import violation and no cycle.

- [ ] **Step 7: Stage gate.**

```
lsof -ti :5173 | xargs -r -I{} sh -c 'ps -p {} -o args= | grep -q "vite preview" && kill {}'
npm run test:e2e -- e2e/journeys/04-market-research-5-components.spec.ts
```
Expected: PASS, VR within 2%.

- [ ] **Step 8: Commit.**

```bash
git -C "$WT" add frontend/src/features/market-research/components/scout-chat/ScoutChatPanel.tsx frontend/src/features/market-research/components/types.ts frontend/src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx frontend/src/features/market-research/components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx frontend/src/features/market-research/components/MarketIntelligenceSections.tsx frontend/src/features/market-research/components/trends/TrendsTab.tsx frontend/src/features/market-research/components/intelligence/regulatory-compliance/types.ts frontend/src/features/market-research/components/intelligence/market-entry/MarketEntrySection.tsx frontend/src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx frontend/src/features/market-research/components/intelligence/industry-trends/types.ts frontend/src/features/market-research/components/intelligence/competitor-landscape/types.ts
git -C "$WT" commit -m "refactor(fe): relocate ScoutChatPanel + types into features/market-research (resolves TD-FE-51)"
```

## Task 7: Relocate `ChatWithScout.tsx`

**Files:**
- Move: `src/components/market-research/ChatWithScout.tsx` → `src/features/market-research/components/ChatWithScout.tsx`
- Modify: `src/features/market-research/components/trends/TrendsTab.tsx`

Context: `ChatWithScout`'s own imports are all `@/…` absolute (`@/lib/api` `BACKEND_BASE_URL`, ui) — nothing breaks on move. **Sole component consumer is `TrendsTab.tsx:6`** (verified — `MarketResearchPage.tsx`'s `ChatWithScout` references are an unrelated local handler/prop, not this import). This **corrects Spec 30 §9's two-consumer premise** ("TrendsTab + MarketResearchPage") to one. `components/` root is still the destination: `ChatWithScout` is a general scout-chat entry surface, not trends-specific, so the neutral root is preferred over co-locating in `trends/` with its lone current consumer (and Spec 30 §17 grants the plan this destination authority). The 1-vs-2 correction is recorded here in the plan (current truth), not as a spec erratum — the spec is a frozen intent record.

- [ ] **Step 1: `git mv`.**

```bash
git -C "$WT" mv frontend/src/components/market-research/ChatWithScout.tsx frontend/src/features/market-research/components/ChatWithScout.tsx
```

- [ ] **Step 2: Repoint `TrendsTab.tsx:6`** `import { ChatWithScout } from "@/components/market-research/ChatWithScout";` → `import { ChatWithScout } from "../ChatWithScout";` (TrendsTab is in `components/trends/`, target is `components/`).

- [ ] **Step 3: Grep-backstop + verify.**

```bash
grep -rn "components/market-research/ChatWithScout" frontend/src/   # expect: none
```
```
npm run verify
npx prettier --check src/features/market-research/components/ChatWithScout.tsx src/features/market-research/components/trends/TrendsTab.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git -C "$WT" add frontend/src/features/market-research/components/ChatWithScout.tsx frontend/src/features/market-research/components/trends/TrendsTab.tsx
git -C "$WT" commit -m "refactor(fe): relocate ChatWithScout into features/market-research"
```

## Task 8: Relocate `ScoutSettingsForm.tsx`

**Files:**
- Move: `src/components/market-research/ScoutSettingsForm.tsx` → `src/features/market-research/components/ScoutSettingsForm.tsx`
- Modify: `src/features/market-research/pages/MarketResearchPage.tsx`

Context: all `@/…` absolute imports — nothing breaks on move. Sole consumer `MarketResearchPage.tsx:21`.

- [ ] **Step 1: `git mv`.**

```bash
git -C "$WT" mv frontend/src/components/market-research/ScoutSettingsForm.tsx frontend/src/features/market-research/components/ScoutSettingsForm.tsx
```

- [ ] **Step 2: Repoint `MarketResearchPage.tsx:21`** `import { ScoutSettingsForm } from "@/components/market-research/ScoutSettingsForm";` → `import { ScoutSettingsForm } from "../components/ScoutSettingsForm";` (page is in `pages/`, target is `components/`).

- [ ] **Step 3: Grep-backstop + verify.**

```bash
grep -rn "components/market-research/ScoutSettingsForm" frontend/src/   # expect: none
```
```
npm run verify
npx prettier --check src/features/market-research/components/ScoutSettingsForm.tsx src/features/market-research/pages/MarketResearchPage.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git -C "$WT" add frontend/src/features/market-research/components/ScoutSettingsForm.tsx frontend/src/features/market-research/pages/MarketResearchPage.tsx
git -C "$WT" commit -m "refactor(fe): relocate ScoutSettingsForm into features/market-research"
```

## Task 9: Relocate `ScoutDeploymentDetails.tsx`

**Files:**
- Move: `src/components/market-research/ScoutDeploymentDetails.tsx` → `src/features/market-research/components/intelligence/ScoutDeploymentDetails.tsx`
- Modify: `src/features/market-research/components/intelligence/IntelligenceTab.tsx`

Context: all `@/…` absolute imports — nothing breaks on move. Sole consumer `IntelligenceTab.tsx:11`, which lives in the **same** target folder → its import becomes relative. The file's top HANDOFF comment (`// HANDOFF → scout (Spec 24 §7) …`) is stale — rewrite it to its corrected market-research home (Spec 30 §9 fixed the destination to market-research because its only consumer, `IntelligenceTab`, is a market-research surface).

- [ ] **Step 1: `git mv`.**

```bash
git -C "$WT" mv frontend/src/components/market-research/ScoutDeploymentDetails.tsx frontend/src/features/market-research/components/intelligence/ScoutDeploymentDetails.tsx
```

- [ ] **Step 2: Rewrite the HANDOFF comment** at the top of the moved file (lines 1-2) to a single accurate line, e.g.:

```ts
// Scout deployment summary card rendered inside market-research's Intelligence tab.
```

- [ ] **Step 3: Repoint `IntelligenceTab.tsx:11`** `import { ScoutDeploymentDetails } from "@/components/market-research/ScoutDeploymentDetails";` → `import { ScoutDeploymentDetails } from "./ScoutDeploymentDetails";` (same folder).

- [ ] **Step 4: Grep-backstop + verify.**

```bash
grep -rn "components/market-research/ScoutDeploymentDetails" frontend/src/   # expect: none
```
```
npm run verify
npx prettier --check src/features/market-research/components/intelligence/ScoutDeploymentDetails.tsx src/features/market-research/components/intelligence/IntelligenceTab.tsx
```
Expected: PASS.

- [ ] **Step 5: Stage gate (end of S3 — confirm the partial drain).**

```bash
ls frontend/src/components/market-research/        # expect: EditDropdownMenu.tsx ScoutLeadStream.tsx lead-stream/
ls frontend/src/components/market-research/lead-stream/   # expect: LeadStreamTab.tsx LeadsTable.tsx OpportunityDashboard.tsx leadData.ts
```
```
lsof -ti :5173 | xargs -r -I{} sh -c 'ps -p {} -o args= | grep -q "vite preview" && kill {}'
npm run test:e2e -- e2e/journeys/04-market-research-5-components.spec.ts
```
Expected: PASS, VR within 2%. The 6-file deferred residue (TD-FE-60) remains in place, imports untouched.

- [ ] **Step 6: Commit.**

```bash
git -C "$WT" add frontend/src/features/market-research/components/intelligence/ScoutDeploymentDetails.tsx frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx
git -C "$WT" commit -m "refactor(fe): relocate ScoutDeploymentDetails into features/market-research/intelligence"
```

---

# Stage S4 — Create `features/scout/`

Spec 30 §7. Move ScoutDeployment page + component into a new feature folder, add the route registry, rewire `App.tsx` + `app/routes.tsx`. The page+component+App.tsx changes are interconnected (App.tsx imports the page; removing the import + moving the file must land together, or the tree won't compile) → one commit.

## Task 10: Move ScoutDeployment into `features/scout/` + wire routes

**Files:**
- Move: `src/pages/ScoutDeployment.tsx` → `src/features/scout/pages/ScoutDeploymentPage.tsx`
- Move: `src/components/settings/ScoutDeployment.tsx` → `src/features/scout/components/ScoutDeployment.tsx`
- Create: `src/features/scout/routes.tsx`
- Create: `src/features/scout/index.ts`
- Create: `src/features/scout/README.md`
- Modify: `src/app/routes.tsx`
- Modify: `src/App.tsx`

Context: the page already exports `ScoutDeploymentPage` (default) — only the **filename** changes (`ScoutDeployment.tsx` → `ScoutDeploymentPage.tsx`), no symbol rename. The page imports the settings component (`@/components/settings/ScoutDeployment`) — after both move, that becomes a same-feature import. The settings component has **no other importer** than the page. The route currently lives in `App.tsx` (import line 11 + `<Route path="/scout-deployment">` block lines 87-96) wrapped only in `<ProtectedRoute requireTenant>` (no `FeatureErrorBoundary` — the page applies `Layout` internally). We migrate it to `scoutRoutes` and **add `FeatureErrorBoundary`** to match the converged feature pattern (signals/customers both wrap). This is additive and does not change happy-path behavior or the `/scout-deployment` path/guard **by construction**: `FeatureErrorBoundary` renders its `children` unchanged and only swaps to a fallback when a descendant *throws* — the same transparent wrapper every migrated feature route already uses. The only behavioral addition in an otherwise pure-refactor plan is therefore provably output-neutral on the happy path; the finalize manual smoke (Task 14 Step 2) confirms the integrated render, and no automated route-level test is added for a wrapper already proven transparent across signals/customers.

- [ ] **Step 1: `git mv` both files.**

```bash
git -C "$WT" mv frontend/src/pages/ScoutDeployment.tsx frontend/src/features/scout/pages/ScoutDeploymentPage.tsx
git -C "$WT" mv frontend/src/components/settings/ScoutDeployment.tsx frontend/src/features/scout/components/ScoutDeployment.tsx
```

- [ ] **Step 2: Fix the page's settings-component import.** In `ScoutDeploymentPage.tsx` line 1: `import { ScoutDeployment } from "@/components/settings/ScoutDeployment";` → `import { ScoutDeployment } from "../components/ScoutDeployment";`. (The `@/features/shell` `Layout` import is unchanged. The default export is already `ScoutDeploymentPage`.)

- [ ] **Step 3: Create `routes.tsx`** (mirrors `customers/routes.tsx`; preserves the `/scout-deployment` path + `ProtectedRoute requireTenant`, adds `FeatureErrorBoundary`).

```tsx
import { Route } from "react-router-dom";

import ScoutDeploymentPage from "./pages/ScoutDeploymentPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Scout route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const scoutRoutes = [
  <Route
    key="scout-deployment"
    path="/scout-deployment"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Scout Deployment">
          <ScoutDeploymentPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
```

- [ ] **Step 4: Create `index.ts`.**

```ts
// Public surface for the `scout` feature.
// Cross-feature consumers import from "@/features/scout", never a deep path.
export { scoutRoutes } from "./routes";
```

- [ ] **Step 5: Create `README.md`.**

```markdown
# `scout` feature

Scout's single distinct surface: the **ScoutDeployment** page (`/scout-deployment`).

Scout's research surface is **market-research** (Phase 5) and its chat lives in
`features/market-research/components/scout-chat/` (the `ChatWithHistory` shell +
`ScoutChatWithHistory` wrapper, Phase 9). This folder therefore holds only the
deployment page + the form component it renders — intentionally thin (Spec 30 §1.1,
§7). No standalone `features/profiler/` exists: Profiler is distributed across
`customers` + `mission-control` + `shared/profiler` (TD-FE-57).

## Public surface
- `scoutRoutes` — registered (append-only) in `src/app/routes.tsx`.

## Key files
- `pages/ScoutDeploymentPage.tsx` — the page (wraps the form in `Layout`).
- `components/ScoutDeployment.tsx` — the deployment form.
```

- [ ] **Step 6: Register in `src/app/routes.tsx`** (append-only). Add `import { scoutRoutes } from "@/features/scout";` to the import block (alphabetical — between `mission-control` and `signals`) and `...scoutRoutes,` to the `featureRoutes` array:

```ts
import { customersRoutes } from "@/features/customers";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";
import { scoutRoutes } from "@/features/scout";
import { signalsRoutes } from "@/features/signals";
import { strategistRoutes } from "@/features/strategist";

export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
  ...scoutRoutes,
  ...signalsRoutes,
  ...strategistRoutes,
];
```

- [ ] **Step 7: Remove legacy wiring from `src/App.tsx`.** Delete the import (line 11) `import ScoutDeploymentPage from "./pages/ScoutDeployment";` and the inline `<Route path="/scout-deployment" …>` block (lines 87-96). `{featureRoutes}` (line 97) now serves the route.

- [ ] **Step 8: Grep-backstop + verify.**

```bash
grep -rn "pages/ScoutDeployment" frontend/src/        # expect: none
grep -rn "settings/ScoutDeployment" frontend/src/     # expect: none
```
```
npm run verify
npx prettier --check "src/features/scout/**/*.{ts,tsx}" src/app/routes.tsx src/App.tsx
```
Expected: PASS. Lint confirms the `App.tsx` route block is gone and the registry resolves.

- [ ] **Step 9: Commit.**

```bash
git -C "$WT" add frontend/src/features/scout frontend/src/app/routes.tsx frontend/src/App.tsx
git -C "$WT" commit -m "refactor(fe): relocate ScoutDeployment into features/scout + route registry"
```

## Task 11: Scout deployment render test

**Files:** Create `frontend/src/features/scout/pages/__tests__/ScoutDeploymentPage.test.tsx`

Context: no scout-deployment Playwright journey exists; add a Vitest render smoke for the relocated surface. Mock `Layout` + the form component to keep it a structural mount check (mirror the established feature page-test style).

- [ ] **Step 1: Write the test.**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/shell", () => ({ Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../components/ScoutDeployment", () => ({ ScoutDeployment: () => <div data-testid="scout-deployment-form" /> }));

import ScoutDeploymentPage from "../ScoutDeploymentPage";

describe("ScoutDeploymentPage", () => {
  it("renders the deploy heading and the form", () => {
    render(<ScoutDeploymentPage />);
    expect(screen.getByText("Deploy Scout Agent")).toBeInTheDocument();
    expect(screen.getByTestId("scout-deployment-form")).toBeInTheDocument();
  });
});
```
(Confirm the heading string against the moved page — the live page renders `<h1 …>Deploy Scout Agent</h1>`.)

- [ ] **Step 2: Verify + prettier + commit.**

```
npm run verify
npx prettier --check "src/features/scout/pages/__tests__/ScoutDeploymentPage.test.tsx"
```
```bash
git -C "$WT" add frontend/src/features/scout/pages/__tests__/ScoutDeploymentPage.test.tsx
git -C "$WT" commit -m "test(fe): add ScoutDeploymentPage render smoke test"
```

---

# Finalize

Spec 30 §8, §15, §16. Close the ICP open item (doc-only), reconcile TECH_DEBT, master-plan delta, serial preflight, merge.

## Task 12: Close the Profiler-ICP disposition (doc-only) + features naming note

**Files:**
- Modify: `frontend/src/features/mission-control/README.md`
- Modify: `frontend/src/features/README.md` (if present; else skip)

Context: Spec 30 §8 — verification confirmed the profiler ICP-merge logic is **already** satisfied: `mergeProfilerAcceptedIcpDisplay` lives in `shared/profiler/profilerAcceptedIcpDisplay.ts`, both consumers read it from `@/shared/profiler`, there is **no `customers → mission-control` import**, and the inline `ICPManager.tsx:179-237` mapper is a deliberate Plan-25 T21 decision (a container data-transform with no extractable render region). **No code change** — record the upheld decision so it isn't re-litigated.

- [ ] **Step 1: Mission-control README note.** Add a short subsection recording: the ICP-merge algorithm is shared (`shared/profiler`); the inline view-model mapper in `ICPManager.tsx` stays per Plan-25 T21 (container data-transform, no extractable render region); Phase 9 closed the Spec 25 §6 "Phase 9 resolves" open item by confirm-and-document, no extraction. Keep it factual and brief.

- [ ] **Step 2: Features naming note** (only if `src/features/README.md` exists). Note that there is intentionally **no `features/profiler/`** — Profiler is distributed across `customers` + `mission-control` + `shared/profiler` (TD-FE-57), and `features/scout/` is intentionally thin (Spec 30 §1.1).

- [ ] **Step 3: Verify (no test impact) + prettier + commit.**

```
npx prettier --check src/features/mission-control/README.md
```
```bash
git -C "$WT" add frontend/src/features/mission-control/README.md
# add frontend/src/features/README.md only if it was edited in Step 2
git -C "$WT" commit -m "docs(fe): record Phase 9 Profiler-ICP disposition (Plan-25 T21 upheld, no extraction)"
```

## Task 13: TECH_DEBT reconcile + master-plan delta

**Files:**
- Modify: `docs/TECH_DEBT.md` (append/edit **by hand** — never prettier it)
- Modify: `specs/14-frontend-refactoring-master-plan-design.md`

Context: master ceiling at branch time = **TD-FE-53**; Phase 9 claims **57+** (Spec 30 §14 reserves 54-56 for Phase 10's parallel branch). **Reconcile against the then-current register at execution** — if the merged ceiling has advanced past 56, renumber the new entries to start one past the live ceiling, and note the renumber. Frozen-record convention for Spec 14: annotate, don't rewrite prior intent.

- [ ] **Step 1: Resolve `TD-FE-51`.** Edit the TD-FE-51 entry (`ScoutChatPanel.tsx` + `types.ts` legacy residue) to **Resolved** — both files relocated into `features/market-research` (Task 6).

- [ ] **Step 2: Update `TD-FE-50`'s trigger.** TD-FE-50 (`signalsChatContext` sessionStorage handoff untyped) currently triggers on "Phase 9 chat-surface dedup." Phase 9 is behavior-preserving and deliberately did **not** type the handoff (typing it is a contract addition). Change the trigger to a later phase that introduces the typed contract; add a one-line note that Phase 9 chose not to type it.

- [ ] **Step 3: Append the new entries** (hand-formatted to match the file's existing style; numbers reconciled per the context note):
  - **TD-FE-57** — No `features/profiler/`: Profiler kept distributed across `customers` + `mission-control` + `shared/profiler`. Accepted decision (Spec 30 §1.1). Trigger: Profiler grows a standalone surface.
  - **TD-FE-58** — `SignalsChatContext` **type** name retained though the component renamed to `ContextChat`. Trigger: next time `shared/chat` types are touched.
  - **TD-FE-59** — `src/utils/leadStreamChatContext.ts` left in `utils/` (scout lead-stream plumbing, possibly shared with strategist). Trigger: lead-stream ownership settled.
  - **TD-FE-60** — `components/market-research/` retains 6 files after Phase 9's partial drain (`ScoutLeadStream.tsx`, `EditDropdownMenu.tsx`, `lead-stream/{LeadStreamTab,LeadsTable,OpportunityDashboard,leadData}`). Cross-feature-coupled (`leadData` → strategist + `src/lib`; `EditDropdownMenu` → customers); candidate homes lead-stream UI → `features/customers`, `leadData.ts`/`EditDropdownMenu.tsx` → `shared/`. Trigger: a customers/lead-stream phase.

- [ ] **Step 4: Master-plan delta in Spec 14.** Annotate (don't rewrite): Phase 9 resolved the scout/profiler "join point" as one `features/scout/` (thin) + a shared `ChatWithHistory` shell in `shared/chat/` + substrate rename `SignalsContextChat`→`ContextChat`; **no `features/profiler/`** (asymmetry, §1.1); the legacy `components/market-research/` is partially drained (5 moved, 6 deferred as TD-FE-60).

- [ ] **Step 5: Prettier the Spec 14 edit only** (NOT TECH_DEBT.md) + commit (split into two logical commits).

```
npx prettier --check specs/14-frontend-refactoring-master-plan-design.md
```
```bash
git -C "$WT" add docs/TECH_DEBT.md
git -C "$WT" commit -m "docs: reconcile TD-FE (resolve 51, retrigger 50, add 57-60)"
git -C "$WT" add specs/14-frontend-refactoring-master-plan-design.md
git -C "$WT" commit -m "docs: record Phase 9 deltas in the frontend master plan"
```

## Task 14: Merge gate — serial preflight + smoke sign-off

- [ ] **Step 1: Confirm the partial drain + new structure.** `ls frontend/src/components/market-research/` (only `EditDropdownMenu.tsx`, `ScoutLeadStream.tsx`, `lead-stream/`); `ls frontend/src/components/settings/ScoutDeployment.tsx` (gone); `ls frontend/src/pages/ScoutDeployment.tsx` (gone); `ls frontend/src/features/scout/` (pages/ components/ routes.tsx index.ts README.md); `ls frontend/src/shared/chat/` (ContextChat.tsx, ChatWithHistory.tsx — no SignalsContextChat.tsx).
- [ ] **Step 2: Manual smoke sign-off** (controller; Spec 14 §5.6): `/scout-deployment` renders; Scout chat (market-research Trends tab) opens, swaps between signal-context chat and the ScoutChatPanel lead-stream surface, persists sessions to `scout_chat_sessions_<uid>`; Profiler chat (customers chat tab) opens, persists to `profiler_chat_sessions_<uid>`; signals page chat still works (substrate). Pass = frozen routes/behaviors/visuals render; fail = no merge.
- [ ] **Step 3: Serial preflight** (kill orphan preview by specific PID first):

```
lsof -ti :5173 | xargs -r -I{} sh -c 'ps -p {} -o args= | grep -q "vite preview" && kill {}'
npm run preflight
```
Expected: all green (typecheck, lint, format:check, test, build, bundle:check advisory, test:e2e incl. all VR journeys, knip --strict). The `ChatWithHistory` shell is now consumed by both wrappers, so knip passes. Red = report the failing check, do not merge, fix-on-branch-and-re-run (smoke + preflight) or abort (Spec 14 §5.3). No fix-forward.
- [ ] **Step 4: Human-approved merge** (controller; coordinate with the in-flight Phase 10/12 worktrees — `App.tsx`/`app/routes.tsx`/`TECH_DEBT.md` conflicts are mechanical union resolutions per Spec 30 §14; reconcile TD-FE numbers if Phase 10 merged 54-56 first). **Run the merge against the MAIN checkout, NOT the worktree** — `master` is checked out in the main checkout, so `git -C "$WT" checkout master` fails (`fatal: 'master' is already checked out at '/projects/Brewra/brewra-gtm-intelligence'`). The main checkout is already on `master`, so no checkout is needed; target it with `-C`:

```bash
MAIN=/projects/Brewra/brewra-gtm-intelligence
git -C "$MAIN" merge --no-ff worktree-phase-9-scout-profiler -m "Merge phase-9-scout-profiler: scout+profiler chat dedup + features/scout (Spec/plan 30)"
git -C "$MAIN" push origin master
```
(If the main checkout is somehow not on `master`, `git -C "$MAIN" checkout master` first — that succeeds in the main checkout; only the worktree is blocked from checking out `master`.)

---

## Self-review note

Spec-coverage map (Spec 30 §→ task): §5 substrate rename = T1; §4 unified shell contract + impl = T2–T3; §6 wrapper collapse = T4 (profiler) + T5 (scout); §9 partial drain (5 files) = T6 (ScoutChatPanel+types, resolves TD-FE-51) + T7 (ChatWithScout) + T8 (ScoutSettingsForm) + T9 (ScoutDeploymentDetails); §7 `features/scout/` = T10–T11; §8 ICP confirm-and-document = T12; §15 TD-FE (resolve 51, retrigger 50, add 57-60) + §16 master-plan delta = T13; §12 testing is woven through (existing wrapper tests guard T4/T5; new shell test T3; scout page test T11; no new MSW/no new profilerIcp test as §12 specifies); §13 staged order = the S1→S4→finalize stage structure; §14 parallel-worktree coordination = the conventions preamble + T14 Step 4.

Contract finalization vs Spec 30 §4 (faithful to verified behavior): `emptyContext` moved out of shell config into Profiler's `renderChat` (new sessions are `context: null` in both personas; the fallback is render-time, not creation-time); `renderExtras` takes no args (Scout's only root overlay is `AddLeadModal`); added `gateIncomingByAgent`/`outerMaxWidthNone`/`emptyState`/`getSessionDisplayTitle`/`hydrateExtraSessions`/`serializeSession`/`onNewChat`, each mapping to a verified divergence with a no-op/identity default so Profiler stays trivial. The shell + scout-collapse are flagged parity-critical with the §17 escalation ladder (hook → Approach-2 fallback). Two spec facts corrected from code: `ChatWithScout` has one consumer (TrendsTab), not two; the scout-deployment page already exports `ScoutDeploymentPage` (filename-only change).

Type-consistency: `ChatSession<TMeta>`/`ChatWithHistoryConfig`/`ChatWithHistoryProps`/`ChatWithHistoryRenderState` names are used identically in the contract block (T2), the shell impl (T2), the shell test (T3), and both wrappers (T4/T5). `ScoutSessionMeta { leadContext? }` (T5) is the `TMeta` for Scout; Profiler omits `TMeta`. `scoutRoutes` (T10 routes.tsx) matches the `app/routes.tsx` spread and the `index.ts` export.
