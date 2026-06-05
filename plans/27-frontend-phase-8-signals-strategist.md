# Phase 8 — signals + strategist feature extraction · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the `signals` and `strategist` surfaces into `src/features/signals/` and `src/features/strategist/`; relocate the shared chat substrate (`SignalsContextChat`) into `src/shared/chat/` (resolving TD-FE-45); and relocate the scout-chat wrapper (`ScoutChatWithHistory` + `AddLeadModal` + `SuggestedCompaniesSection`) into `features/market-research/`. Behind the converged per-feature shape (route registry + `<FeatureErrorBoundary>` + TanStack data layer + zod contracts + per-component Vitest + locked `index.ts`). Behavior, routes, and visuals are frozen (Spec 27 §2.3).

**Architecture:** One branch (`phase-8-signals-strategist`, already created off `master`), one plan, a staged commit-series with green checkpoints (Spec 27 §7): **8a** substrate→shared, **8b** scout-chat→market-research, **8c** signals feature (8c-1 relocate, 8c-2 data layer, 8c-3 decompose), **8d** strategist feature, **finalize**. `8b` and `8c` depend on `8a`; `8c`/`8d` are independent. The whole phase merges **once**, `--no-ff`, only after a green serial `npm run preflight`.

**Tech Stack:** React 18 + Vite + TypeScript, TanStack Query (`@tanstack/react-query`), zod contracts (`shared/api/contracts.ts` + per-feature `contracts.ts`), MSW (`src/test/msw/`), Vitest + React Testing Library (RTL), Playwright VR (signals journey `03`, agent-hub stub, customers journey `06`, market-research journey `04`). Substrate hooks live in `src/shared/chat/` because `shared ↛ features` (Spec 27 §4).

---

## Conventions & execution rules (read first — these override habits)

- **Branch & merge.** Work on `phase-8-signals-strategist` (already created, with the spec + reviews committed). The whole phase merges **once**, `--no-ff`, after the finalize serial preflight is green. Do **not** merge per-stage. The branch is local/unshared, so a failed stage may be discarded with `git reset --hard <last-green-checkpoint-commit>` (Spec 27 §7).
- **Worktree git.** If executing in a `.claude/worktrees/` worktree, run every git op as `git -C <worktree-abs-path> …` — a bare `cd <repo-root>` lands in the main checkout (`master`), not the worktree.
- **Surgical commits in a shared tree.** Parallel agents may share the working tree. **Never `git add -A`.** Stage only the explicit paths each task names. One logical step = one commit.
- **Commit messages.** `type(scope):` form (`feat(fe):`, `refactor(fe):`, `chore(fe):`, `test(fe):`, `docs(fe):` / `docs:`). No `[N/M]` suffixes. **No `Co-Authored-By` footer.** Body only when the *why* isn't obvious.
- **Inner loop (per task).** From `frontend/`: `npm run verify` (= `typecheck && lint && test`). Plus, because `verify` omits `format:check`, run `npx prettier --check <touched files>` — **except** never prettier `docs/TECH_DEBT.md` (outside the FE prettier gate; prettier corrupts its unfenced markdown — append entries by hand).
- **Do NOT run `npm run knip` before finalize.** Stage 8c-2 deliberately creates hooks before they're consumed (hook-first). `knip --strict` would flag the transient unused exports; the window closes in 8c-2's swap task. `verify` does not run knip, so per-task gates stay green. `knip` runs only inside the finalize serial `preflight`.
- **Grep-driven repoints.** When a task repoints an import path, after editing the named files run `grep -rn "<old path>" src/` to confirm zero stragglers, then `npm run typecheck`. The enumerated importer lists below are the known set; the grep is the backstop for any not enumerated.
- **Shared test infra.** When a task touches `src/test/msw/handlers.ts` or shared fixtures, first `grep -n` the handler path; if it already exists for another feature, **do not** change the shared default — scope your shape with `server.use()` inside your own test. A shared-default change can VR-regress a *sibling* feature's journey that the per-stage gate won't catch until the finalize full e2e run. Also run the broader `npm run test` (part of `verify`).
- **Vitest flake.** If the full suite flakes on async `waitFor` tests under CPU contention, rerun `npm run test -- --no-file-parallelism` (100% green; not a defect — `project_vitest_parallel_contention_flake`). Do not weaken assertions.
- **Stage gates** (run from `frontend/`, after killing any orphan preview server that would false-green the VR):
  - 8a: `pkill -f "vite preview" || true` then `npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts e2e/journeys/04-market-research-5-components.spec.ts e2e/journeys/03-signals-feed-action.spec.ts` (the substrate underpins customers' chat tab + market-research's Trends tab; signals shares the `signal_*` endpoints).
  - 8b: `… npm run test:e2e -- e2e/journeys/04-market-research-5-components.spec.ts` (ScoutChatWithHistory/TrendsTab live here).
  - 8c (per commit): `… npm run test:e2e -- e2e/journeys/03-signals-feed-action.spec.ts e2e/stubs/agent-hub.spec.ts`.
  - 8d: `… npm run test:e2e -- e2e/journeys/04-market-research-5-components.spec.ts` (no strategist journey exists — Spec 27 §8 gap; rely on the 8d Vitest render tests + the finalize full e2e).
  - VR threshold is 2% (`maxDiffPixelRatio: 0.02`); minor bounding-box shifts from added wrappers are acceptable if visually identical.
- **Final merge gate.** Serial `npm run preflight` (`typecheck && lint && format:check && test && build && bundle:check && test:e2e && knip`). **Serial** runner, never `preflight:par` (VR flakes under concurrent load — `feedback_no_broad_pkill_shared_sandbox`, TD-FE-29).
- **Parity is the contract.** No behavior or pixel change. If a step would change a rendered loading/error state, a URL, a storage key (`signals_<uid>_accepted`/`_rejected`, `scout_chat_sessions_<uid>`, `signalsChatContext`, `strategistContext`), or an event name — stop. That's a parity break, not a refactor.
- **Abort / escalation.** Per-step parity + per-stage `git reset --hard <last-green-checkpoint>` are the recovery primitives. Above them: if a **single task** fails its gate **three** times with no clear fix — most likely T12 (the Signals transport swap, R3) — stop forcing it and escalate to the human controller; suspend the phase and revisit Spec 27 rather than land a partial/behavior-changing cut. The branch is local/unshared, so suspension costs only discarded work.
- **Parallelizable pairs (subagent mode).** Independent within a stage, may run concurrently: **T7 ∥ T8** (query keys / shared signal hooks scaffolding) — but T8 must land before T12; **T9 ∥ T11** (page service vs the localStorage hook); **T15 ∥ (T7…T12)** (8d strategist relocation is independent of 8c). Serial execution is equally valid.

---

## File structure (target — Spec 27 §3)

```
src/shared/chat/                         # NEW (8a)
├── SignalsContextChat.tsx               # moved from components/signals/ (8a); migrated to shared hooks (8c-2)
├── index.ts                             # barrel: SignalsContextChat + SignalsChatContext + ChatMessage (+ hooks)
├── useSignalAsk.ts                      # POST /api/signal_Ask (8c-2; consumed by substrate + signals page)
├── useSignalAction.ts                   # POST /api/signal_action (8c-2)
└── __tests__/

src/features/signals/                    # NEW (8c)
├── pages/SignalsPage.tsx                # from pages/Signals.tsx (Index → SignalsPage); decomposed (8c-3)
├── components/                          # 8c-3 section components + __tests__/
├── hooks/
│   ├── useFetchSignals.ts               # useQuery GET /api/fetch-signals (8c-2)
│   ├── useGenerateSignalsBatch.ts       # useMutation POST /api/generate-signals-batch (8c-2)
│   ├── useSignalAcceptance.ts           # localStorage accept/reject (8c-2; TD-FE-49)
│   └── __tests__/
├── services/signals.ts                  # page-only API layer (8c-2)
├── contracts.ts · types.ts · routes.tsx · index.ts · README.md · __tests__/

src/features/strategist/                 # NEW (8d)
├── pages/StrategistPage.tsx             # from pages/Deals.tsx (renamed)
├── components/
│   ├── StrategistWorkspace.tsx          # from components/market-research/ (AS-IS; TD-FE-47)
│   ├── StrategistRecommendations.tsx    # from components/strategist/
│   ├── StrategistLeadStream.tsx         # from components/strategist/
│   └── __tests__/
├── types.ts (StrategistContext) · routes.tsx · index.ts · README.md

src/features/market-research/components/scout-chat/   # NEW subfolder (8b)
├── ScoutChatWithHistory.tsx             # from components/signals/
├── AddLeadModal.tsx                     # from components/market-research/
└── SuggestedCompaniesSection.tsx        # from components/market-research/
```

`src/components/market-research/` retains `ScoutChatPanel.tsx` + `types.ts` (legacy; TD-FE-51). The 8c-3 section-component seams are finalized by the executing agent reading `SignalsPage.tsx` — see Stage 8c-3.

---

# Stage 8a — Substrate → shared (enabling)

Spec 27 §5, §7. Move `SignalsContextChat` to `src/shared/chat/` and repoint every importer. Structural only (raw fetches intact — migrated in 8c-2). Resolves TD-FE-45.

## Task 1: Move `SignalsContextChat` → `src/shared/chat/` + repoint all importers

**Files:**
- Move → Create: `frontend/src/shared/chat/SignalsContextChat.tsx` (from `src/components/signals/SignalsContextChat.tsx`)
- Create: `frontend/src/shared/chat/index.ts`
- Modify: `frontend/src/components/signals/ScoutChatWithHistory.tsx`
- Modify: `frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx`
- Modify: `frontend/src/features/customers/components/chat/__tests__/ProfilerChatWithHistory.test.tsx`
- Modify: `frontend/src/features/customers/pages/CustomersPage.tsx`
- Modify: `frontend/src/features/market-research/components/trends/TrendsTab.tsx`
- Modify (if it imports the type): `frontend/src/pages/Signals.tsx`

Context: `SignalsContextChat`'s own imports are all `@/…` absolute (ui, hooks, lib, `@/shared/auth`, react-router) — moving the file does **not** break them. Interconnected move → one commit (no compiling intermediate). If imports go wrong mid-task, `git checkout -- <paths>` and redo as one pass.

- [ ] **Step 1: `git mv` the substrate.**

```bash
git mv frontend/src/components/signals/SignalsContextChat.tsx frontend/src/shared/chat/SignalsContextChat.tsx
```

- [ ] **Step 2: Create the `shared/chat` barrel** (`src/shared/chat/index.ts`) — matches the `@/shared/auth` barrel convention so importers use `@/shared/chat`.

```ts
// Cross-feature scout/profiler chat substrate (Spec 27 §5). Consumed by
// market-research (ScoutChatWithHistory) + customers (ProfilerChatWithHistory).
// Phase 9 owns the ScoutChat↔ProfilerChat wrapper dedup; the substrate keeps
// its `SignalsContextChat` name through Phase 8 for move-traceability.
export { SignalsContextChat } from "./SignalsContextChat";
export type { SignalsChatContext, ChatMessage } from "./SignalsContextChat";
```

- [ ] **Step 3: Repoint the known importers** from `@/components/signals/SignalsContextChat` (or the relative `./SignalsContextChat` inside ScoutChatWithHistory) to `@/shared/chat`:
  - `ScoutChatWithHistory.tsx`: change `import type { SignalsChatContext, ChatMessage } from "./SignalsContextChat";` and `import { SignalsContextChat } from "./SignalsContextChat";` → both from `@/shared/chat`.
  - `ProfilerChatWithHistory.tsx`: change the two lines (`import type { SignalsChatContext, ChatMessage } from "@/components/signals/SignalsContextChat";` + `import { SignalsContextChat } from "@/components/signals/SignalsContextChat";`) → `@/shared/chat`.
  - `ProfilerChatWithHistory.test.tsx`: change `vi.mock("@/components/signals/SignalsContextChat", …)` → `vi.mock("@/shared/chat", …)`.
  - `CustomersPage.tsx`: change `import type { SignalsChatContext } from "@/components/signals/SignalsContextChat";` → `@/shared/chat`.
  - `TrendsTab.tsx`: change `import type { SignalsChatContext } from "@/components/signals/SignalsContextChat";` → `@/shared/chat`. (Its `ScoutChatWithHistory` import is untouched here — that moves in 8b.)

- [ ] **Step 4: Grep-backstop for any importer not enumerated** (e.g. `Signals.tsx`, which builds a `const context: SignalsChatContext`):

```bash
grep -rn "components/signals/SignalsContextChat" frontend/src/
grep -rn 'from "./SignalsContextChat"' frontend/src/
```
Repoint every hit to `@/shared/chat`. Both greps must return nothing after fixing.

- [ ] **Step 5: Verify + prettier.** From `frontend/`:

```
npm run verify
npx prettier --check src/shared/chat/SignalsContextChat.tsx src/shared/chat/index.ts
```
Expected: PASS. Typecheck confirms every repointed import resolves.

- [ ] **Step 6: Stage gate (substrate consumers).**

```
pkill -f "vite preview" || true
npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts e2e/journeys/04-market-research-5-components.spec.ts e2e/journeys/03-signals-feed-action.spec.ts
```
Expected: PASS, VR within 2%.

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/shared/chat frontend/src/components/signals/ScoutChatWithHistory.tsx frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx frontend/src/features/customers/components/chat/__tests__/ProfilerChatWithHistory.test.tsx frontend/src/features/customers/pages/CustomersPage.tsx frontend/src/features/market-research/components/trends/TrendsTab.tsx frontend/src/pages/Signals.tsx
git commit -m "refactor(fe): relocate SignalsContextChat substrate to shared/chat (resolves TD-FE-45)"
```
(Drop `Signals.tsx` from the `git add` if Step 4 found it doesn't reference the substrate.)

## Task 2: Substrate public-surface unit test

**Files:** Create `frontend/src/shared/chat/__tests__/SignalsContextChat.test.tsx`

Context: written against the **public surface** (render + props + MSW-mocked endpoints + error fallback) so it survives the 8c-2 raw-fetch→TanStack migration — MSW intercepts at the network boundary, so handlers are unchanged; 8c-2 only adds the `QueryClientProvider` harness (T12). Keep assertions behavioral, not implementation-coupled.

- [ ] **Step 1: Write the test.** Render `SignalsContextChat` with a minimal `context`, assert the prompt/heading renders and the input is present; MSW-mock `/api/signal_Ask` + `/api/signal_action` defaults.

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignalsContextChat, type SignalsChatContext } from "@/shared/chat";

const ctx: SignalsChatContext = { agent: "scout", prompt: "Why this signal?" };

describe("SignalsContextChat (substrate)", () => {
  it("renders the context prompt and a message input", () => {
    render(<SignalsContextChat context={ctx} />);
    expect(screen.getByText(/Why this signal\?/i)).toBeInTheDocument();
    // input present (placeholder text varies — assert a textbox exists)
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
```
If `SignalsContextChat` requires an auth context to render, wrap with the existing test auth provider used by `ProfilerChatWithHistory.test.tsx` (copy that file's wrapper). Read `ProfilerChatWithHistory.test.tsx` first for the established render harness.

- [ ] **Step 2: Verify + prettier.**

```
npm run verify
npx prettier --check src/shared/chat/__tests__/SignalsContextChat.test.tsx
```
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/shared/chat/__tests__/SignalsContextChat.test.tsx
git commit -m "test(fe): add SignalsContextChat substrate public-surface test"
```

---

# Stage 8b — Scout-chat → market-research

Spec 27 §5. Relocate `ScoutChatWithHistory` + `AddLeadModal` + `SuggestedCompaniesSection` (each consumed only by ScoutChatWithHistory/TrendsTab) into `features/market-research/components/scout-chat/`. `ScoutChatPanel` + `types.ts` stay legacy (TD-FE-51).

## Task 3: Relocate scout-chat trio into market-research

**Files:**
- Move → Create: `frontend/src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx` (from `src/components/signals/ScoutChatWithHistory.tsx`)
- Move → Create: `frontend/src/features/market-research/components/scout-chat/AddLeadModal.tsx` (from `src/components/market-research/AddLeadModal.tsx`)
- Move → Create: `frontend/src/features/market-research/components/scout-chat/SuggestedCompaniesSection.tsx` (from `src/components/market-research/SuggestedCompaniesSection.tsx`)
- Modify: `frontend/src/features/market-research/components/trends/TrendsTab.tsx`

Context: interconnected move → one commit. `AddLeadModal` + `SuggestedCompaniesSection` import only `@/…` absolute (ui/lib/shared/hooks) — no change on move. `ScoutChatWithHistory` imports the trio + the still-legacy `ScoutChatPanel`/`types`.

- [ ] **Step 1: `git mv` the three files.**

```bash
git mv frontend/src/components/signals/ScoutChatWithHistory.tsx        frontend/src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx
git mv frontend/src/components/market-research/AddLeadModal.tsx          frontend/src/features/market-research/components/scout-chat/AddLeadModal.tsx
git mv frontend/src/components/market-research/SuggestedCompaniesSection.tsx frontend/src/features/market-research/components/scout-chat/SuggestedCompaniesSection.tsx
```

- [ ] **Step 2: Fix `ScoutChatWithHistory.tsx` imports.** The two co-located deps become relative; `ScoutChatPanel` + `types` **stay** legacy `@/components/market-research/…` (transitional, Spec 27 §3.1); `SignalsContextChat` already points at `@/shared/chat` (8a).

```ts
// REPLACE:
//   import { AddLeadModal } from "@/components/market-research/AddLeadModal";
//   import { SuggestedCompaniesSection } from "@/components/market-research/SuggestedCompaniesSection";
// WITH relative (same scout-chat/ folder):
import { AddLeadModal } from "./AddLeadModal";
import { SuggestedCompaniesSection } from "./SuggestedCompaniesSection";
// KEEP (legacy, transitional — ScoutChatPanel stays in market-research, TD-FE-51):
import ScoutChatPanel from "@/components/market-research/ScoutChatPanel";
import type { EditRecord } from "@/components/market-research/types";
```

- [ ] **Step 3: `AddLeadModal.tsx` + `SuggestedCompaniesSection.tsx` — no import change** (all `@/…` absolute). Confirm with typecheck.

- [ ] **Step 4: Fix `TrendsTab.tsx`** — repoint `ScoutChatWithHistory` to the relative same-feature path.

```ts
// REPLACE:
//   import { ScoutChatWithHistory } from "@/components/signals/ScoutChatWithHistory";
// WITH relative (sibling folder under market-research/components/):
import { ScoutChatWithHistory } from "../scout-chat/ScoutChatWithHistory";
```

- [ ] **Step 5: Grep-backstop + verify.**

```bash
grep -rn "components/signals/ScoutChatWithHistory" frontend/src/   # expect: none
grep -rn "components/market-research/AddLeadModal" frontend/src/    # expect: none
grep -rn "components/market-research/SuggestedCompaniesSection" frontend/src/  # expect: none
```
```
npm run verify
npx prettier --check "src/features/market-research/components/scout-chat/*.tsx" src/features/market-research/components/trends/TrendsTab.tsx
```
Expected: PASS. Lint confirms no `@/features/*` deep-import was introduced; `import-x/no-cycle` confirms no cycle. Note: `src/components/signals/` is now **empty** — confirm `ls frontend/src/components/signals/` shows nothing (its two files went to `shared/chat` (8a) and here).

- [ ] **Step 6: Stage gate (market-research).**

```
pkill -f "vite preview" || true
npm run test:e2e -- e2e/journeys/04-market-research-5-components.spec.ts
```
Expected: PASS, VR within 2%.

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/features/market-research/components/scout-chat frontend/src/features/market-research/components/trends/TrendsTab.tsx
git commit -m "refactor(fe): relocate scout-chat (ScoutChatWithHistory + deps) into features/market-research"
```

## Task 4: Smoke test for relocated `ScoutChatWithHistory`

**Files:** Create `frontend/src/features/market-research/components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx`

Context: light render smoke (it's relocated untested code). Mock the `@/shared/chat` substrate + the heavy market-research deps so the test stays a mount check, mirroring `ProfilerChatWithHistory.test.tsx`'s mock style.

- [ ] **Step 1: Write the test.**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScoutChatWithHistory } from "../ScoutChatWithHistory";

vi.mock("@/shared/chat", () => ({ SignalsContextChat: () => <div data-testid="substrate" /> }));
vi.mock("@/components/market-research/ScoutChatPanel", () => ({ default: () => <div /> }));
vi.mock("../AddLeadModal", () => ({ AddLeadModal: () => <div /> }));
vi.mock("../SuggestedCompaniesSection", () => ({ SuggestedCompaniesSection: () => <div /> }));

describe("ScoutChatWithHistory (relocated)", () => {
  it("mounts with a null initial context", () => {
    const { container } = render(<ScoutChatWithHistory initialContext={null} />);
    expect(container).toBeTruthy();
  });
});
```
If it needs an auth provider, reuse the `ProfilerChatWithHistory.test.tsx` wrapper. Read that file first.

- [ ] **Step 2: Verify + prettier + commit.**

```
npm run verify
npx prettier --check "src/features/market-research/components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx"
```
```bash
git add frontend/src/features/market-research/components/scout-chat/__tests__/ScoutChatWithHistory.test.tsx
git commit -m "test(fe): add ScoutChatWithHistory render smoke test"
```

---

# Stage 8c — Signals feature

Spec 27 §7. Sub-staged: **8c-1** scaffold + relocate + route registry; **8c-2** data layer (shared signal hooks + page hooks + swap); **8c-3** 5a-style decomposition. Each commit green. Do not run `knip` until finalize.

## 8c-1 — Scaffold + relocate

## Task 5: Scaffold the `signals` feature skeleton

**Files:** Create `frontend/src/features/signals/{types.ts,index.ts,README.md}`

- [ ] **Step 1: `types.ts` placeholder.**

```ts
// Feature-local types for `signals`. Populated during 8c-3 if the decomposition
// surfaces shared types. Placeholder kept green until then.
export {};
```

- [ ] **Step 2: `index.ts` placeholder.**

```ts
// Public surface for the `signals` feature. Finalized in T6 (routes) and locked
// at finalize. Exposes `signalsRoutes` only.
export {};
```

- [ ] **Step 3: `README.md` placeholder.**

```markdown
# `signals` feature

Placeholder — finalized at the Phase 8 finalize stage (Spec 27 §3).
```

- [ ] **Step 4: Verify + commit.**

```
npm run verify
```
```bash
git add frontend/src/features/signals/types.ts frontend/src/features/signals/index.ts frontend/src/features/signals/README.md
git commit -m "chore(fe): scaffold signals feature skeleton"
```

## Task 6: Relocate `Signals.tsx` → `SignalsPage.tsx` + wire route registry

**Files:**
- Move → Create: `frontend/src/features/signals/pages/SignalsPage.tsx` (from `src/pages/Signals.tsx`)
- Create: `frontend/src/features/signals/routes.tsx`
- Modify: `frontend/src/features/signals/index.ts`
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/App.tsx` (remove the `Signals` import + `/signals` and `/agent-hub` `<Route>` blocks)
- Delete: `src/pages/Signals.tsx`

Context: `Signals.tsx`'s imports are all `@/…` absolute (`@/features/shell` Layout, `@/shared/auth`, `@/hooks/use-toast`, `@/lib/…`, `@/shared/chat` after 8a) — moving it does **not** break them. Only rename the component + default export. One commit.

- [ ] **Step 1: `git mv` + rename.**

```bash
git mv frontend/src/pages/Signals.tsx frontend/src/features/signals/pages/SignalsPage.tsx
```
Then in `SignalsPage.tsx`: rename `const Index = () => {` → `const SignalsPage = () => {` and `export default Index;` → `export default SignalsPage;`.

- [ ] **Step 2: Create `routes.tsx`** (mirrors `customers/routes.tsx`; both `/signals` and `/agent-hub` resolve to the page).

```tsx
import { Route } from "react-router-dom";

import SignalsPage from "./pages/SignalsPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Signals route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const signalsRoutes = [
  <Route
    key="signals"
    path="/signals"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Signals">
          <SignalsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
  <Route
    key="agent-hub"
    path="/agent-hub"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Signals">
          <SignalsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
```

- [ ] **Step 3: Finalize `index.ts`.**

```ts
// Public surface for the `signals` feature.
export { signalsRoutes } from "./routes";
```

- [ ] **Step 4: Register in `src/app/routes.tsx`** (append-only).

```ts
import { Route } from "react-router-dom";

import { customersRoutes } from "@/features/customers/routes";
import { marketResearchRoutes } from "@/features/market-research/routes";
import { signalsRoutes } from "@/features/signals/routes";

/** Feature routes composed here and spread into App.tsx <Routes>. */
export const featureRoutes = [...marketResearchRoutes, ...customersRoutes, ...signalsRoutes];
```
(If `src/app/routes.tsx` already imports `missionControlRoutes`, keep it — append `...signalsRoutes` to the existing array; do not drop siblings.)

- [ ] **Step 5: Remove legacy wiring from `src/App.tsx`.** Delete `import Signals from "./pages/Signals";` (line ~14) and the two `<Route path="/signals">` and `<Route path="/agent-hub">` blocks. `{featureRoutes}` now serves both URLs.

- [ ] **Step 6: Grep-backstop + verify.**

```bash
grep -rn 'pages/Signals"' frontend/src/   # expect: none
```
```
npm run verify
npx prettier --check "src/features/signals/**/*.{ts,tsx}" src/app/routes.tsx src/App.tsx
```
Expected: PASS.

- [ ] **Step 7: Stage gate.**

```
pkill -f "vite preview" || true
npm run test:e2e -- e2e/journeys/03-signals-feed-action.spec.ts e2e/stubs/agent-hub.spec.ts
```
Expected: PASS, VR within 2% (confirms `/signals` + `/agent-hub` render identically via the registry).

- [ ] **Step 8: Commit.**

```bash
git add frontend/src/features/signals frontend/src/app/routes.tsx frontend/src/App.tsx
git commit -m "refactor(fe): relocate Signals page into features/signals + route registry"
```

## 8c-2 — Data layer

Per-call-site shapes (verified verbatim): the page's and the substrate's `signal_Ask` body are **identical** (`{ org_id, user_id, question, history }`) and `signal_action` body identical (`{ org_id, signal_id, action }`). So the §4 tiebreaker resolves to **one shared hook per endpoint** (no split). `generate-signals-batch` + `fetch-signals` are page-only.

## Task 7: Add signals query keys

**Files:** Modify `frontend/src/shared/api/queryKeys.ts`

- [ ] **Step 1: Append to the `qk` object** (after `customersSuggestedIcps`):

```ts
  signalsFeed: (userId: string) => ["signals", "feed", userId] as const,
```

- [ ] **Step 2: Verify + prettier + commit.**

```
npm run verify
npx prettier --check src/shared/api/queryKeys.ts
```
```bash
git add frontend/src/shared/api/queryKeys.ts
git commit -m "feat(fe): add signals query key"
```

## Task 8: Shared `signal_Ask`/`signal_action` contracts + hooks + MSW

**Files:**
- Modify: `frontend/src/shared/api/contracts.ts` (add permissive signal schemas)
- Create: `frontend/src/shared/chat/useSignalAsk.ts`
- Create: `frontend/src/shared/chat/useSignalAction.ts`
- Modify: `frontend/src/shared/chat/index.ts` (export the hooks)
- Modify: `frontend/src/test/msw/handlers.ts` (baseline `/api/signal_Ask` + `/api/signal_action`)
- Create: `frontend/src/shared/chat/__tests__/useSignalAsk.test.tsx`, `useSignalAction.test.tsx`

Context: permissive zod (`.passthrough()`, optional) per Spec 27 §4 (backend suspended). `useSignalAsk` is a `useMutation` (POST a question); `useSignalAction` a `useMutation` (accept/reject). Built here, consumed by the substrate + page in T12 (hook-first; transient unused-export window closes at T12, before the finalize `knip`).

- [ ] **Step 1: Add contracts** to `src/shared/api/contracts.ts`.

```ts
import { z } from "zod";

/** POST /api/signal_Ask — permissive (backend suspended/variable; Spec 27 §4). */
export const SignalAskResponseSchema = z.object({}).passthrough();
export type SignalAskResponse = z.infer<typeof SignalAskResponseSchema>;

/** POST /api/signal_action. */
export const SignalActionResponseSchema = z.object({}).passthrough();
export type SignalActionResponse = z.infer<typeof SignalActionResponseSchema>;
```
(If `contracts.ts` uses a different export style — e.g. a single namespace — match it; read the file first.)

- [ ] **Step 2: `useSignalAsk.ts`.**

```ts
import { useMutation } from "@tanstack/react-query";

import { SignalAskResponseSchema, type SignalAskResponse } from "@/shared/api/contracts";

export interface SignalAskBody {
  org_id: string;
  user_id: string;
  question: string;
  history: { user: string; assistant: string }[];
}

/** POST /api/signal_Ask. Shared by the signals page + the SignalsContextChat substrate. */
export function useSignalAsk() {
  return useMutation<SignalAskResponse, Error, SignalAskBody>({
    mutationFn: async (body) => {
      const res = await fetch("/api/signal_Ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`signal_Ask failed: ${res.status} ${text}`);
      }
      return SignalAskResponseSchema.parse(await res.json());
    },
  });
}
```

- [ ] **Step 3: `useSignalAction.ts`.**

```ts
import { useMutation } from "@tanstack/react-query";

import { SignalActionResponseSchema, type SignalActionResponse } from "@/shared/api/contracts";

export interface SignalActionVars {
  orgId: string;
  signalId: string;
  action: "accept" | "reject";
}

/** POST /api/signal_action. Shared by the signals page + the substrate. */
export function useSignalAction() {
  return useMutation<SignalActionResponse, Error, SignalActionVars>({
    mutationFn: async ({ orgId, signalId, action }) => {
      const res = await fetch("/api/signal_action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, signal_id: signalId, action }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`signal_action failed: ${res.status} ${text}`);
      }
      return SignalActionResponseSchema.parse(await res.json());
    },
  });
}
```

- [ ] **Step 4: Export hooks from `shared/chat/index.ts`** (append):

```ts
export { useSignalAsk, type SignalAskBody } from "./useSignalAsk";
export { useSignalAction, type SignalActionVars } from "./useSignalAction";
```

- [ ] **Step 5: MSW baseline handlers** — `grep -n "signal_Ask\|signal_action" src/test/msw/handlers.ts` first. If absent, append inside the `handlers` array:

```ts
http.post("/api/signal_Ask", () => HttpResponse.json({ answer: "ok" })),
http.post("/api/signal_action", () => HttpResponse.json({ success: true })),
```

- [ ] **Step 6: Hook tests** (`QueryClientProvider` + MSW wrapper; mirror `useCustomerProfile.test.tsx`). Assert success path + non-ok throw for each. Keep concise.

- [ ] **Step 7: Verify + prettier + commit.**

```
npm run verify
npx prettier --check "src/shared/chat/useSignal*.ts" "src/shared/chat/__tests__/useSignal*.test.tsx" src/shared/api/contracts.ts src/test/msw/handlers.ts
```
```bash
git add frontend/src/shared/chat/useSignalAsk.ts frontend/src/shared/chat/useSignalAction.ts frontend/src/shared/chat/index.ts frontend/src/shared/chat/__tests__/useSignalAsk.test.tsx frontend/src/shared/chat/__tests__/useSignalAction.test.tsx frontend/src/shared/api/contracts.ts frontend/src/test/msw/handlers.ts
git commit -m "feat(fe): add shared signal_Ask/signal_action TanStack hooks + contracts"
```

## Task 9: Page-only service layer + contracts + MSW

**Files:**
- Create: `frontend/src/features/signals/services/signals.ts`
- Modify: `frontend/src/features/signals/contracts.ts` (create)
- Modify: `frontend/src/test/msw/handlers.ts`
- Create: `frontend/src/features/signals/services/__tests__/signals.test.ts`

Context: two page-only endpoints. `generateSignalsBatch` (POST /api/generate-signals-batch) + `fetchSignals` (GET /api/fetch-signals?user_id=&limit=10). Permissive parse at the boundary; the page normalizes (`buildSignalCardsFromFetchData`, kept in the page).

- [ ] **Step 1: `contracts.ts`** (permissive, mirrors customers).

```ts
import { z } from "zod";

export const FetchSignalsResponseSchema = z.object({}).passthrough();
export type FetchSignalsResponse = z.infer<typeof FetchSignalsResponseSchema>;

export const GenerateSignalsBatchResponseSchema = z.object({}).passthrough();
export type GenerateSignalsBatchResponse = z.infer<typeof GenerateSignalsBatchResponseSchema>;
```

- [ ] **Step 2: `services/signals.ts`** — lift the two fetchers from `SignalsPage.tsx` verbatim (preserve the exact URL/body/headers), parse at the boundary.

```ts
import {
  FetchSignalsResponseSchema,
  GenerateSignalsBatchResponseSchema,
  type FetchSignalsResponse,
  type GenerateSignalsBatchResponse,
} from "../contracts";

/** GET /api/fetch-signals?user_id=&limit=10 — page-only read. */
export async function fetchSignals(userId: string): Promise<FetchSignalsResponse> {
  const res = await fetch(`/api/fetch-signals?user_id=${userId}&limit=10`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch signals: ${res.status} ${res.statusText} ${text}`);
  }
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Server returned non-JSON response");
  }
  return FetchSignalsResponseSchema.parse(await res.json());
}

/** POST /api/generate-signals-batch — page-only. Preserve the exact body shape. */
export async function generateSignalsBatch(userId: string): Promise<GenerateSignalsBatchResponse> {
  const res = await fetch("/api/generate-signals-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      component_name: "test",
      data: { industry: "SaaS", companySize: "50-200 employees" },
    }),
  });
  if (!res.ok) throw new Error(`generate-signals-batch failed: ${res.status}`);
  return GenerateSignalsBatchResponseSchema.parse(await res.json());
}
```
**Before finalizing the body shape, re-read the live `generateSignalsBatch` in `SignalsPage.tsx`** and copy its body exactly (the `data` object above is from the fact sheet — confirm it matches at execution; parity-critical).

- [ ] **Step 3: MSW handlers** (`grep` first; append if absent):

```ts
http.get("/api/fetch-signals", () => HttpResponse.json({ signals: [] })),
http.post("/api/generate-signals-batch", () => HttpResponse.json({ signals: [] })),
```

- [ ] **Step 4: Service test** — success + non-ok throw + the non-JSON guard for `fetchSignals`. Mirror `customers.test.ts`.

- [ ] **Step 5: Verify + prettier + commit.**

```
npm run verify
npx prettier --check src/features/signals/services/signals.ts src/features/signals/contracts.ts "src/features/signals/services/__tests__/signals.test.ts" src/test/msw/handlers.ts
```
```bash
git add frontend/src/features/signals/services frontend/src/features/signals/contracts.ts frontend/src/test/msw/handlers.ts
git commit -m "feat(fe): add signals page service layer + zod contracts + MSW"
```

## Task 10: Page read/mutation hooks

**Files:** Create `frontend/src/features/signals/hooks/{useFetchSignals.ts,useGenerateSignalsBatch.ts}` + `__tests__/`

- [ ] **Step 1: `useFetchSignals.ts`** (useQuery; `retry: false` for raw-fetch parity).

```ts
import { useQuery } from "@tanstack/react-query";

import { fetchSignals } from "../services/signals";

import { qk } from "@/shared/api/queryKeys";

export function useFetchSignals(userId: string, enabled = true) {
  return useQuery({
    queryKey: qk.signalsFeed(userId),
    enabled: enabled && !!userId,
    queryFn: () => fetchSignals(userId),
    retry: false,
  });
}
```

- [ ] **Step 2: `useGenerateSignalsBatch.ts`** (useMutation).

```ts
import { useMutation } from "@tanstack/react-query";

import { generateSignalsBatch } from "../services/signals";

export function useGenerateSignalsBatch() {
  return useMutation({ mutationFn: (userId: string) => generateSignalsBatch(userId) });
}
```

- [ ] **Step 3: Hook tests** (QueryClientProvider + MSW; mirror `useCustomerProfile.test.tsx` / `useSuggestedIcps.test.tsx`). Success + disabled-without-userId for the query.

- [ ] **Step 4: Verify + prettier + commit.**

```
npm run verify
npx prettier --check "src/features/signals/hooks/*.ts" "src/features/signals/hooks/__tests__/*.test.tsx"
```
```bash
git add frontend/src/features/signals/hooks
git commit -m "feat(fe): add signals page read + generate hooks"
```

## Task 11: Extract `useSignalAcceptance` (localStorage; primary store)

**Files:** Create `frontend/src/features/signals/hooks/useSignalAcceptance.ts` + `__tests__/useSignalAcceptance.test.ts`

Context: the accepted/rejected `localStorage` state (`signals_<uid>_accepted` / `_rejected`) is **primary state, not cache** — stays on `localStorage` (TD-FE-49), extracted into a hook for the decomposition. Keys frozen (Spec 27 §2.3). Read the live read/write sites in `SignalsPage.tsx` and move them verbatim.

- [ ] **Step 1: Write the hook** exposing `{ accepted, rejected, markAccepted, markRejected }` backed by the exact `signals_<uid>_accepted`/`_rejected` keys + `JSON` array round-trip (copy the live logic). No behavior change.

- [ ] **Step 2: Unit test** with jsdom `localStorage` (cleared per test): markAccepted persists + reads back; key format is `signals_<uid>_accepted`.

- [ ] **Step 3: Verify + prettier + commit.**

```
npm run verify
npx prettier --check src/features/signals/hooks/useSignalAcceptance.ts "src/features/signals/hooks/__tests__/useSignalAcceptance.test.ts"
```
```bash
git add frontend/src/features/signals/hooks/useSignalAcceptance.ts frontend/src/features/signals/hooks/__tests__/useSignalAcceptance.test.ts
git commit -m "feat(fe): extract useSignalAcceptance localStorage hook"
```

## Task 12: Swap `SignalsPage` + substrate onto the new hooks (transport swap)

**Files:**
- Modify: `frontend/src/features/signals/pages/SignalsPage.tsx`
- Modify: `frontend/src/shared/chat/SignalsContextChat.tsx`
- Modify: `frontend/src/shared/chat/__tests__/SignalsContextChat.test.tsx` (QueryClientProvider harness)

Context: **R3 — the parity-critical step.** Replace the page's four inline fetchers with the hooks (`useFetchSignals`, `useGenerateSignalsBatch`, `useSignalAsk`, `useSignalAction`) and its accept/reject localStorage with `useSignalAcceptance`; migrate the substrate's `signalAsk`/`signalAction` to `useSignalAsk`/`useSignalAction`. Parity audit (Spec 27 §4): the rendered loading/error/data states must match the raw-fetch behavior — assert via the new/updated component tests + the VR journey. One commit per coherent swap if the page is large; keep each green.

- [ ] **Step 1: Page — swap reads/mutations.** Replace `fetchSignals(...)`/`generateSignalsBatch(...)`/`signalAsk(...)`/`signalAction(...)` call sites with the hooks. Preserve the exact loading/empty/error UI and the `sessionStorage.setItem("signalsChatContext", …)` handoff. Keep `buildSignalCardsFromFetchData` + the other pure helpers in the page (moved in 8c-3). Remove the now-dead inline fetcher functions.

- [ ] **Step 2: Page — swap accept/reject onto `useSignalAcceptance`.** Replace the inline `localStorage` accept/reject reads/writes; keys unchanged.

- [ ] **Step 3: Substrate — swap onto shared hooks.** In `SignalsContextChat.tsx`, replace the module-local `signalAsk`/`signalAction` with `useSignalAsk()`/`useSignalAction()` (call `.mutateAsync(...)` where the raw fetch was awaited). Preserve the chat message-state behavior + the `localStorage` accepted/rejected logic the substrate keeps.

- [ ] **Step 4: Substrate test — add the harness.** Wrap the render in `QueryClientProvider` (mirror `useCustomerProfile.test.tsx`'s wrapper) and keep the public-surface assertions. The MSW handlers from T8 already cover `/api/signal_Ask` + `/api/signal_action`.

- [ ] **Step 5: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/signals/pages/SignalsPage.tsx src/shared/chat/SignalsContextChat.tsx "src/shared/chat/__tests__/SignalsContextChat.test.tsx"
```
Expected: PASS.

- [ ] **Step 6: Stage gate (parity).**

```
pkill -f "vite preview" || true
npm run test:e2e -- e2e/journeys/03-signals-feed-action.spec.ts e2e/stubs/agent-hub.spec.ts e2e/journeys/06-customers-page-load.spec.ts e2e/journeys/04-market-research-5-components.spec.ts
```
Expected: PASS, VR within 2% (03 = signals page; 06/04 = the substrate consumers, since the substrate changed).

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/features/signals/pages/SignalsPage.tsx frontend/src/shared/chat/SignalsContextChat.tsx frontend/src/shared/chat/__tests__/SignalsContextChat.test.tsx
git commit -m "refactor(fe): migrate signals page + chat substrate to TanStack signal hooks"
```

## 8c-3 — Decompose `SignalsPage`

Spec 27 §2.1 (Full 5a-style). The 1,730-LOC page is one large `SignalsPage` component plus 9 top-level helpers. Extract section components from the JSX, **one extraction per commit, green between each**. The exact seams are identified by reading `SignalsPage.tsx` at execution; the expected seams below are a guide, not a contract.

## Task 13: Extract pure helpers + feature types

**Files:** Create `frontend/src/features/signals/components/signalCards.ts` (or `lib.ts`) + `__tests__/`; populate `frontend/src/features/signals/types.ts`; modify `SignalsPage.tsx`.

Context: move the **pure** top-level helpers (`getSignalContentHash`, `parseTimestamp`, `applyRejectedFilterAndSort`, `buildSignalCardsFromFetchData`, `getFallbackSampleSignals`) out of the page into a pure module (no React). Move the local signal/card type(s) into `types.ts`. Unit-test the pure functions (timestamp parse, rejected-filter sort, card-building from a sample fetch payload).

- [ ] **Step 1:** Read `SignalsPage.tsx`; cut the listed pure helpers verbatim into the new module; export those consumed by the page. Move the card/signal interface(s) into `types.ts`.
- [ ] **Step 2:** Import them back into `SignalsPage.tsx`.
- [ ] **Step 3:** Unit-test the pure helpers (sample-payload → expected cards; rejected filter; timestamp).
- [ ] **Step 4:** Verify + prettier + commit (`refactor(fe): extract pure signals helpers + types`).

## Task 14: Extract section components (one per commit)

**Files:** Create under `frontend/src/features/signals/components/` (+ co-located `__tests__/`); modify `SignalsPage.tsx`.

Context: from the `SignalsPage` JSX, extract these seams (confirm against the file): **(a)** `SignalCard` (single signal: headline/snippet/description/source + action buttons accept/reject/save/ask + recommendations) — the highest-value extraction; **(b)** `SignalsEmptyState` / loading spinner; **(c)** the chat drawer wiring (the `SignalsContextChat` integration + the `signalsChatContext` setup) as `SignalChatPanel`. Each extraction: lift the JSX + its props, pass container-held state down, **no behavior change**, render test for the new component, green between each.

- [ ] **Step 1: Extract `SignalCard`** + render test (renders headline + fires the accept/reject callbacks). Commit (`refactor(fe): extract SignalCard from SignalsPage`).
- [ ] **Step 2: Extract `SignalsEmptyState` + loading** + render test. Commit.
- [ ] **Step 3: Extract `SignalChatPanel`** (chat-context setup) + render test. Commit.
- [ ] **After each:** `npm run verify` + `npx prettier --check` the touched files + the stage gate (`03` + `agent-hub`). VR within 2%.

> If a seam proves entangled (state can't cleanly lift without behavior change), stop at the last green commit and leave the remainder in the page — partial decomposition is acceptable; full monster-file splitting is also Phase 13's charter (Spec 14 §6.2). Do not force a parity-risking extraction.

---

# Stage 8d — Strategist feature

Spec 27 §6. Relocate the 3 components + the page; `StrategistWorkspace` moves **as-is** (live but large — decomposition + `GET /chat/` migration deferred to Phase 13, TD-FE-47). Independent of 8c.

## Task 15: Scaffold + relocate the strategist components

**Files:**
- Create: `frontend/src/features/strategist/{types.ts,index.ts,README.md}`
- Move → Create: `frontend/src/features/strategist/components/StrategistWorkspace.tsx` (from `src/components/market-research/StrategistWorkspace.tsx`)
- Move → Create: `frontend/src/features/strategist/components/StrategistLeadStream.tsx` (from `src/components/strategist/StrategistLeadStream.tsx`)
- Move → Create: `frontend/src/features/strategist/components/StrategistRecommendations.tsx` (from `src/components/strategist/StrategistRecommendations.tsx`)

Context: the three components are consumed **only** by the page (T16) and don't cross-import each other; their imports are `@/…` absolute → no import fix on move. `StrategistWorkspace` keeps its raw `GET ${BACKEND_BASE_URL}/chat/` fetch (TD-FE-47) and loses only its header annotation.

- [ ] **Step 1: Scaffold skeleton.** `types.ts` (will hold `StrategistContext`, populated in T16 — placeholder `export {};` for now), `index.ts` (`export {};` placeholder), `README.md` placeholder.
- [ ] **Step 2: `git mv` the three components** to `features/strategist/components/`.
- [ ] **Step 3: `StrategistWorkspace.tsx` — remove the obsolete header annotation** (the two `// HANDOFF → strategist (Spec 24 §7)…` lines). No other change (imports are absolute; raw fetch stays).
- [ ] **Step 4: `StrategistLeadStream.tsx` / `StrategistRecommendations.tsx` — no import change** (absolute). Confirm via typecheck.
- [ ] **Step 5: Grep-backstop + verify.**

```bash
grep -rn "components/market-research/StrategistWorkspace" frontend/src/   # only Deals.tsx (fixed in T16)
grep -rn "components/strategist/" frontend/src/                            # only Deals.tsx (fixed in T16)
```
```
npm run verify
```
Expected: typecheck may still reference the old paths from `Deals.tsx` until T16 — **so commit T15 + T16 together if the tree won't compile between them.** Preferred: do T15 + T16 as one commit (the page and its components move together, like Phase 7's interconnected relocate). If splitting, ensure T15 leaves a compiling tree (it won't, because `Deals.tsx` still imports the old paths) — therefore **merge T15 into T16's single commit.**

> **Execution note:** T15 has no compiling intermediate on its own (Deals still imports the old paths). Treat T15+T16 as **one task / one commit**.

## Task 16: Relocate `Deals.tsx` → `StrategistPage.tsx` + route registry (single commit with T15)

**Files:**
- Move → Create: `frontend/src/features/strategist/pages/StrategistPage.tsx` (from `src/pages/Deals.tsx`)
- Modify: `frontend/src/features/strategist/types.ts` (add `StrategistContext`)
- Create: `frontend/src/features/strategist/routes.tsx`
- Modify: `frontend/src/features/strategist/index.ts`
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/App.tsx` (remove `Deals` import + the strategist/`/deals` route blocks)
- Delete: `src/pages/Deals.tsx`

- [ ] **Step 1: `git mv` + rename.**

```bash
git mv frontend/src/pages/Deals.tsx frontend/src/features/strategist/pages/StrategistPage.tsx
```
Rename `const Deals` → `const StrategistPage`, `export default Deals` → `export default StrategistPage`.

- [ ] **Step 2: Move `StrategistContext` to `types.ts`** (cut the interface from the page verbatim; export it) and import it back: `import type { StrategistContext } from "../types";`.

- [ ] **Step 3: Repoint the three component imports** to relative:

```ts
// REPLACE:
//   import StrategistWorkspace from "@/components/market-research/StrategistWorkspace";
//   import StrategistLeadStream from "@/components/strategist/StrategistLeadStream";
//   import StrategistRecommendations from "@/components/strategist/StrategistRecommendations";
// WITH:
import StrategistWorkspace from "../components/StrategistWorkspace";
import StrategistLeadStream from "../components/StrategistLeadStream";
import StrategistRecommendations from "../components/StrategistRecommendations";
```
Keep `Layout` (`@/features/shell`), `usePageTitle`, ui/tabs imports. Preserve the **three-tab** body verbatim (workspace/recommendations/leadstream) and the `sessionStorage.strategistContext` read/clear. (Note: the page uses `Compass` + `Lightbulb` icons in TabsTriggers — ensure they're in the `lucide-react` import; the live `Deals.tsx` imports `MessageSquare, Users` but uses `Compass`/`Lightbulb` — **read the file and include whatever icons the JSX references** so typecheck passes.)

- [ ] **Step 4: Create `routes.tsx`** — the `:tab` route + both redirects (strategist-owned), frozen URLs.

```tsx
import { Navigate, Route } from "react-router-dom";

import StrategistPage from "./pages/StrategistPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Strategist route surface (incl. redirects). Composed append-only by app/routes.tsx. */
export const strategistRoutes = [
  <Route
    key="strategist-tab"
    path="/your-ai-team/strategist/:tab"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Strategist">
          <StrategistPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
  <Route
    key="strategist-root"
    path="/your-ai-team/strategist"
    element={<Navigate to="/your-ai-team/strategist/workspace" replace />}
  />,
  <Route key="deals-redirect" path="/deals" element={<Navigate to="/your-ai-team/strategist/workspace" replace />} />,
];
```

- [ ] **Step 5: Finalize `index.ts`.** `export { strategistRoutes } from "./routes";`

- [ ] **Step 6: Register in `src/app/routes.tsx`** — append `...strategistRoutes`.

- [ ] **Step 7: Remove legacy wiring from `App.tsx`** — the `import Deals from "./pages/Deals";` line and the `/deals`, `/your-ai-team/strategist/:tab`, `/your-ai-team/strategist` `<Route>` blocks.

- [ ] **Step 8: Grep-backstop + verify.**

```bash
grep -rn 'pages/Deals"' frontend/src/                                  # expect: none
grep -rn "components/market-research/StrategistWorkspace" frontend/src/ # expect: none
grep -rn "components/strategist/" frontend/src/                         # expect: none
```
```
npm run verify
npx prettier --check "src/features/strategist/**/*.{ts,tsx}" src/app/routes.tsx src/App.tsx
```
Expected: PASS. `src/components/strategist/` is now empty; confirm `ls`.

- [ ] **Step 9: Commit (T15 + T16 together).**

```bash
git add frontend/src/features/strategist frontend/src/app/routes.tsx frontend/src/App.tsx
git commit -m "refactor(fe): relocate strategist (Deals→StrategistPage + components) into features/strategist"
```

## Task 17: Strategist render tests (no journey exists — Spec 27 §8)

**Files:** Create `frontend/src/features/strategist/components/__tests__/` + `pages/__tests__/StrategistPage.test.tsx`

Context: no strategist Playwright journey exists (Spec 27 §8 gap). Add Vitest render coverage of the reachable surface: `StrategistPage` mounts each tab; `StrategistWorkspace` renders its empty-leads state (mock its `GET /chat/` via MSW or a fetch stub); `StrategistRecommendations` + `StrategistLeadStream` render. If the surface proves visually complex, log the VR-baseline gap as TD-FE-52 (or create a baseline — §8 fallback).

- [ ] **Step 1:** `StrategistPage.test.tsx` — render at `/your-ai-team/strategist/workspace` (MemoryRouter), assert the three TabsTriggers exist and the workspace renders. Mock the three child components to keep it a structural test.
- [ ] **Step 2:** `StrategistWorkspace` empty-state render test (MSW-mock `${BACKEND_BASE_URL}/chat/`). Light.
- [ ] **Step 3:** `StrategistRecommendations` + `StrategistLeadStream` mount tests.
- [ ] **Step 4: Verify + prettier + commit** (`test(fe): add strategist render coverage`).
- [ ] **Step 5: Stage gate.** `npm run test:e2e -- e2e/journeys/04-market-research-5-components.spec.ts` (no strategist journey; the 04 journey confirms StrategistWorkspace's removal from `components/market-research/` didn't break market-research). Confirm `StrategistWorkspace` is gone from `src/components/market-research/` and `MarketIntelligenceSections`/`ScoutChatPanel` are unaffected (Workspace had no market-research consumers besides Deals).

---

# Finalize

Spec 27 §7 finalize. READMEs, naming reconciliation, TECH_DEBT, master-plan deltas, smoke sign-off, serial preflight, merge.

## Task 18: READMEs, index locks, naming-map note, TECH_DEBT, master-plan deltas

**Files:**
- `frontend/src/features/signals/README.md`, `frontend/src/features/strategist/README.md`
- `frontend/src/shared/chat/` — add a short module note (in `index.ts` header or a `README.md`) documenting the substrate's public surface for Phase 9 (Spec 27 §5).
- `frontend/src/features/README.md` (naming-map note: `deals` is not a feature — TD-FE-48)
- `docs/TECH_DEBT.md` (append by hand — never prettier it)
- `specs/14-frontend-refactoring-master-plan-design.md` (master-plan deltas)

- [ ] **Step 1: Feature READMEs** — purpose, public surface (`signalsRoutes` / `strategistRoutes`), key files, dependency notes. For `signals`, note the data layer + that `useSignalAcceptance` stays on localStorage (TD-FE-49). For `strategist`, note `StrategistWorkspace` is relocated as-is with its `GET /chat/` deferred (TD-FE-47).
- [ ] **Step 2: `shared/chat` module note** — props of `SignalsContextChat`, the `SignalsChatContext`/`ChatMessage` types, and `useSignalAsk`/`useSignalAction`; state Phase 9 owns the wrapper dedup + final rename.
- [ ] **Step 3: TECH_DEBT** — reconcile numbering against the current register (start TD-FE-47; renumber if advanced). Mark **TD-FE-45 resolved**; add **TD-FE-47** (StrategistWorkspace live-but-deferred), **TD-FE-48** (Deals/`deals` naming), **TD-FE-49** (signals localStorage primary store), **TD-FE-50** (`signalsChatContext` handoff untyped), **TD-FE-51** (`ScoutChatPanel`/`types.ts` legacy residue), and **TD-FE-52** only if §8's VR gap was confirmed. Append by hand.
- [ ] **Step 4: `features/README.md`** — naming-map note that `deals` is the strategist page, not a Phase 12 small-page (TD-FE-48).
- [ ] **Step 5: Master-plan deltas** in Spec 14 — record (a) scout-chat relocated to market-research (not signals) per the ScoutChatPanel cycle; (b) substrate → shared; (c) StrategistWorkspace is live (master plan's "Strategist has no backend" is wrong); (d) `Deals.tsx` is the strategist page, §12 listing stale. Frozen-record convention: annotate, don't rewrite intent.
- [ ] **Step 6: Verify + prettier** (touched `.md` in `src/` only; **not** TECH_DEBT) + commit. Split into logical commits: `docs(fe): write signals + strategist + shared/chat READMEs`, `docs: reconcile TD-FE (resolve 45; add 47–52) + Spec 14 Phase 8 deltas`.

## Task 19: Merge gate — serial preflight + smoke sign-off

- [ ] **Step 1: Confirm legacy dirs emptied.** `ls frontend/src/components/signals` (empty), `ls frontend/src/components/strategist` (empty); `src/components/market-research/` retains only `ScoutChatPanel.tsx` + `types.ts` (+ any pre-existing market-research files — do not touch).
- [ ] **Step 2: Manual smoke sign-off** (controller; Spec 14 §5.6) — `/signals`, `/agent-hub`, `/your-ai-team/strategist/{workspace,recommendations,leadstream}` render correctly; customers chat tab + market-research Trends tab still work (substrate consumers). Pass = frozen routes/behaviors/visuals render; fail = no merge.
- [ ] **Step 3: Serial preflight** (kill orphan preview first):

```
pkill -f "vite preview" || true
npm run preflight
```
Expected: all green (typecheck, lint, format:check, test, build, bundle:check advisory, test:e2e incl. all VR journeys, knip --strict). Red = report the failing check, do not merge, fix-on-branch-and-re-run-both (smoke + preflight) or abort (Spec 14 §5.3). No fix-forward.
- [ ] **Step 4: Human-approved merge** (controller).

```bash
git checkout master
git merge --no-ff phase-8-signals-strategist -m "Merge phase-8-signals-strategist: signals + strategist feature extraction (Spec/plan 27)"
git push origin master
git branch -d phase-8-signals-strategist
```

---

## Self-review note

Spec-coverage map (Spec 27 §→ task): §5 substrate→shared = T1–T2; §5 scout-chat→market-research = T3–T4; §2.1/§4 signals page + data layer = T5–T14; §6 strategist = T15–T17; §7 finalize / §10 TD-FE / §11 done-when = T18–T19. The §4 single-hook decision (T8) is grounded in the verified-identical call shapes. Decomposition depth (8c-3) is bounded by the per-commit parity rule with an explicit partial-decomposition escape (Phase 13 backstop).
