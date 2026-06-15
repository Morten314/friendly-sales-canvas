# Technical-Debt Paydown (Easy/Medium batch) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pay down the 24 resolvable-now Easy/Medium tech-debt entries (2 correctness bugs, dead-code/typing/structural cleanup, 3 backend items, 2 additive test journeys, VR hardening) as one reviewed phase branch, then reconcile `docs/TECH_DEBT.md` to reality.

**Architecture:** One phase branch `phase-37-tech-debt-paydown` off `master`, developed in a dedicated worktree, landed as small per-entry commits grouped into sequenced waves. Most items are behavior-preserving FE cleanup; three are backend-internal (delete dead v1 routes, flip Apollo handlers to sync `def`, narrow a prompt); two are genuine user-visible bug fixes (CSV smart-quote, Compliance `chartType`); two add net-new product surface (signal-map refresh control, Lead Stream pager). No security/auth changes (MVP posture). Gates are advisory-over-hard-fail.

**Tech Stack:** Frontend — React 18, Vite, TypeScript, TanStack Query, zod, shadcn-ui, Vitest + MSW + Testing Library, Playwright (+ visual regression). Backend — FastAPI, Pydantic, Jinja2 prompt registry, pytest.

**Spec:** `specs/37-tech-debt-paydown-design.md` (spec-review round 1 synthesized).

---

## Discrepancy ledger (code reality vs. spec/register — read first)

This plan was authored after verifying every cited location against HEAD. The spec is design intent; **code is authoritative** (CLAUDE.md). Material corrections folded into the tasks below:

1. **Path drift — regulatory-compliance.** TD-FE-23, -24, -26, and the `/profile/company` half of -68 live under **`frontend/src/features/market-research/components/intelligence/regulatory-compliance/`**, NOT `features/mission-control/` as the spec/register state. `csvHelpers.ts` (TD-FE-64) genuinely is in `features/mission-control/components/data-sources/`.
2. **TD-FE-24 — three copies, not two.** The regulatory defaults are duplicated at lines 332-365/374-403, 637-670/672-701, **and a third inline copy at 729-758 (cards) / 760-793 (regional)**. The shared module must replace all three. They flow to `ComplianceAnalyticsSection` + `RegionalComplianceSection` (not `StrategicRecommendationsSection`).
3. **TD-FE-23 — two switches.** `ComplianceVisualCard.tsx` keys on `card.type` in an expanded branch (42-166) **and** a non-expanded branch (168-477) — 9 reads. Normalize once at the top (`const chartType = card.type ?? card.chartType`) and replace all reads.
4. **TD-FE-26 — writes round-trip via the base-key fallback (so deletion is NOT behavior-neutral).** The raw `setItem("regulatory_X", …)` writes the *base* key; `getUserLocalStorage` reads the *user-scoped* key then falls back to base — so the writes ARE read back. The correct fix is to **route the 5 `regulatory_*` writes through `setUserLocalStorage(key, value, uid)`** (behavior-preserving; shares the read keyspace). The `regulatory-compliance_*_json` keys are written in **two** places — unscoped at 488-489 and scoped (via `setUserLocalStorage`) at 547-557 — and read **nowhere** in `src` (grep-verified). Both pairs are dead and get deleted, along with the object literals that feed only those writes (see Task 3 Step 2).
5. **TD-005 — zero app callers, but 3 pytest files exercise v1.** No FE/v2 caller hits the v1 routes; deleting them breaks `backend/tests/test_data_sources.py` (v1 cases), `test_signals.py` (v1 cases), and `test_smoke.py` (line 30-31). Those tests are migrated/removed in the same commit. Two prod-probe artifacts (`backend/test_upload_embedding.py:209`, `backend/admin_panel.html:790,886`) hit v1 against a hardcoded prod URL — out of the test gate (and likely already dead post-`backend-11kr` suspension); flagged, not blocking. No service wrappers go dead (v1/v2 share services); only the v1-only models `ListUserDocumentsResponse` / `FetchSignalsResponse` become unused.
6. **TD-012 — seven handlers, three use `BackgroundTasks`.** `add_task` is in the service layer, so flipping the handlers to sync `def` keeps it working. The module docstring already states the convention.
7. **TD-FE-71 — no golden coverage.** `signals_lead_map` has no golden fixture; the only existing test (`test_signals_lead_map.py::test_signals_lead_map_prompt_renders`) asserts `"relevance"` is present but not the MATCHING RULES — so it won't catch the narrowing. Add an explicit assertion.
8. **TD-FE-40 — off-by-one + register drift.** `getFitConfidenceBadge` is lines 18-48 (switch on `FitConfidence = "high"|"medium"|"low"`); 19 `console.*` calls confirmed; `IcpList` has a test file. The register's `_isSaving` sub-item is already marked resolved; `syncingProfilerCustomerProfile` may still be a dead overlay in `MissionControlPage.tsx` — verified and handled in Wave 9.
9. **TD-FE-66 — `setIsSaving` is public API.** `_isSaving` is dead but `setIsSaving` is exposed on the `DocumentSyncApi` interface (line 31) and returned. Removing the state requires removing `setIsSaving` from the interface + its consumers (grep first). `checkProcessingFilesStatus` also has a self-referencing `useCallback` dep array (line 117) to fix. **No test file exists** — create one (MSW, not fetch stubs).
10. **TD-FE-42 — path + schema-target drift.** `useICPs` is at `features/mission-control/hooks/useICPs.ts` (not `hooks/useICPs.ts`). `customers/contracts.ts:8` is `suggestedIcpItemSchema` (a different read); the `fetchIcpsRowsForOrg` path has **no** schema. The schema is net-new, authored from the consumer field reads (snake+camel alias pairs). Row type today is `UntypedProfilerIcpRecord = any`.
11. **TD-FE-36 — mostly already resolved → reclassified to a Wave-9 narrow (no Wave-4 code task).** `useCompanyProfile` already lives in `@/shared/company-profile` and all consumers already import the shared barrel. The only residue — the market-research duplicate fetch — lives inside the imperative `smartRefresh` in the 6072-LOC `useMarketResearchData` editable-state hook and is blocked by the same coupling the spec defers (TD-FE-19/65). Per the spec's abort criterion (§8), it is **not** widened here; Wave 9 narrows the register (hook-move resolved; MR-fetch-removal reclassified blocked-on-Spec-38).
12. **TD-FE-56 — ScoutDeployment relocated.** Now `features/scout/components/ScoutDeployment.tsx` (173 LOC); AgentProfile is `features/settings/components/AgentProfile.tsx` (290 LOC). Neither form has a unit test today.
13. **TD-FE-67 — bare-array vs object consumers.** `fetchDataSources` returns a bare array (`unknown[]`, consumed by `useDataSources`→`useDocumentSync`); `fetchSignals`→`{signals}`, `fetchSuggestedIcps`→`{suggestedICPs}`. `fetchLeads` (for TD-FE-70) is a 4th read of the same shape. `paginatedSchema` strips `total` via `.passthrough()`.
14. **TD-FE-25 — purely ephemeral; in-scope fix is read-only alignment only.** `localStrategicRecommendations` has no persist callback, no localStorage, and is never saved on exit. The Accept ("survive exiting edit mode") is met by aligning the read-only branch to read local-first (the `ExecutiveSummarySection` pattern: parent computes `current… = local || data || default`, passes to both branches). Cross-refresh persistence (localStorage/API) **ripples beyond scope and is explicitly NOT added** (spec §8 abort criterion).
15. **TD-FE-20 — tab labels ≠ values.** MR `TabsTrigger`s: `value="intelligence"`→"Market Intelligence", `value="analysis"`→"Your Lead Stream", `value="trends"`→"Chat with Scout" (the Scout-chat surface). No `data-testid`; select by `getByRole("tab", { name })`.
16. **Test infra:** `@testing-library/user-event` is **not a dependency** — use `fireEvent` (and the Radix `pointerDown→mouseDown→click` helper for Radix triggers). MSW runs with `onUnhandledRequest: "error"`, so any **new** endpoint a mounted component hits needs a default handler in `src/test/msw/handlers.ts` (or a per-test `server.use`). `vitest.config.ts` sets `maxWorkers: 4` and no explicit `isolate` (default `true` is load-bearing — never set `isolate:false`); the green fallback under contention is the CLI flag `--no-file-parallelism`.

---

## Conventions for every task

- **Worktree + branch.** Create one worktree off `master`, branch `phase-37-tech-debt-paydown`. Per the worktree cwd gotcha, `cd <repo-root>` from inside a `.claude/worktrees/` worktree lands in the MAIN checkout — always use `git -C <worktree>` for git ops, and run tooling with the worktree path. Symlink `backend/.venv` into the worktree before running pytest. All command paths below assume the repo root `/projects/Brewra/brewra-gtm-intelligence`; substitute your worktree path.
- **Commits.** One logical step = one commit. `type(scope):` subjects (`fix(fe):`, `refactor(fe):`, `feat(fe):`, `chore(fe):`, `refactor(be):`, `fix(be):`, `chore(be):`, `test(fe):`, `docs(debt):`). No `[N/M]` suffix. **No `Co-Authored-By` footer.** Stage only the files the task names — `git add <explicit paths>`, never `git add -A` (shared working tree).
- **Frontend checks (run from `frontend/`):**
  - typecheck: `npm run typecheck` (NOT bare `tsc` — the root tsconfig is a no-op stub that false-greens).
  - one test file: `npx vitest run <path> --no-file-parallelism`.
  - lint a path: `npx eslint <paths>`.
  - prettier on touched files: `npx prettier --check <paths>` (`npm run verify` omits `format:check`). **Never** run prettier over `docs/TECH_DEBT.md`.
- **Backend tests (run from repo root, no `PYTHONPATH`):** `backend/.venv/bin/python -m pytest <path> -q`. The autouse `tests/unit/conftest.py` fixture inits the prompt registry. Follow patch-where-used (`backend/TESTING.md`). The root-level `backend/test_*.py` files are **live prod probes**, never the suite.
- **Cross-stack rule.** Confirm any backend response shape against a live call (`/docs` / curl) before writing FE against it — no generated client. Applies to Wave 0 (TD-FE-23, -42).
- **Merge gate.** One green serial `npm run preflight` (from `frontend/`) **and** `backend/.venv/bin/python -m pytest backend/tests/ -q` green → `git checkout master && git merge --no-ff phase-37-tech-debt-paydown && git push origin master`, then delete the branch. Preflight hard steps (typecheck, vitest, build, Playwright e2e, knip) must pass; advisory steps (lint, format:check, bundle:check) are reported, non-blocking. If `master` advances mid-effort, merge it into the branch and re-preflight.
- **Line numbers are authoring-time anchors, not guarantees.** Every cited line is from HEAD at authoring — always re-grep the quoted code string rather than trusting the number. This matters most for files edited by more than one wave: **`RegulatoryComplianceSection.tsx`** (Tasks 3 and 6 in Wave 1 shrink it, then Task 19 in Wave 6) and **`pagination.ts`** (Task 17 then Task 18). By the later task those files have shifted, so a later-wave task's line cite is pre-edit; re-grep there without exception.

## Abort / escalation triggers

Per-task failures have local fixes; escalate to the human (don't push through) if:

- A Wave-0 live probe shows a shape materially different from what a task assumes (e.g. the Compliance card field is neither `chartType` nor `card.type`; the ICP row shape diverges from §F) and the divergence is more than a trivial field rename — re-scope that task before writing FE against it.
- A Wave-0 finding shows an item is a behavior change beyond its stated scope and the change *ripples* (new persist path, new endpoint, cross-feature cascade) — split it to a follow-on spec rather than widen this phase. (TD-FE-25 and TD-FE-36 were already triaged this way; see the ledger.)
- TD-005's execution-time re-grep finds a **real** (non-test, non-prod-probe) caller of a v1 route that can't be cheaply moved to v2 — fall back to passing `total` through for that one route instead of deleting it.
- A touched backend pytest module or `npm run typecheck` goes red after a task and the cause isn't an obvious local fix — do not stack further tasks on a red base.
- **Batch-level (stop the phase, don't keep trimming).** This is one branch carrying ~25 entries, so the failure mode to watch is silent scope-erosion. If **3 or more entries** end up re-scoped, split to a follow-on spec, or deferred (i.e. any hit the per-item triggers above), **halt and escalate the whole phase to the human** instead of trimming entry-by-entry — the remaining batch likely needs re-planning. Operationally: treat the *first* escalation as the human's decision point on continue-vs-trim-vs-abort the batch; never push the phase through repeated silent trims.

---

## File Structure

**Wave 1 (FE correctness + dead-code):**
- Modify `frontend/src/features/mission-control/components/data-sources/csvHelpers.ts` + un-skip its test.
- Modify `frontend/src/features/market-research/components/intelligence/regulatory-compliance/ComplianceVisualCard.tsx` + add a test.
- Modify `…/regulatory-compliance/RegulatoryComplianceSection.tsx` (localStorage writes; consume new defaults module).
- Create `…/regulatory-compliance/regulatoryDefaults.ts` + a shape test.
- Modify `frontend/src/shared/tenant/TenantContext.tsx`.
- Modify `frontend/src/features/mission-control/components/icp/ICPManager.tsx` + `…/icp/IcpList.tsx` + add an IcpList badge test.
- Modify `frontend/src/features/shell/SidebarContext.tsx`, `…/shell/index.ts`, `…/shell/components/Sidebar.tsx`, `…/shell/components/Header.tsx`.
- Modify `frontend/src/features/mission-control/components/data-sources/useDocumentSync.ts` + create its test.

**Wave 2 (backend):**
- Modify `backend/app/routers/data_sources.py`, `backend/app/routers/signals.py` (delete v1 routes), `backend/app/models/data_sources.py`, `backend/app/models/signals.py` (drop v1-only models); update `backend/tests/test_data_sources.py`, `test_signals.py`, `test_smoke.py`.
- Modify `backend/app/routers/connectors.py` (7 handlers → sync `def`).
- Modify `backend/prompts/signals/signals_lead_map.md.j2` (MATCHING RULES) + assert in `backend/tests/unit/test_signal_lead_map.py`.

**Wave 3 (FE typing):**
- Modify `frontend/src/shared/chat/ContextChat.tsx` (rename type, add payload interface), `…/chat/index.ts`, `…/chat/ChatWithHistory.tsx`, `…/chat/README.md`, `frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx`, `frontend/src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx`, `frontend/src/features/customers/pages/CustomersPage.tsx`, `frontend/src/features/market-research/components/trends/TrendsTab.tsx`, `frontend/src/features/signals/pages/SignalsPage.tsx`, + the chat tests.
- Modify `frontend/src/shared/profiler/profileIcpsExtract.ts` (add `IcpRowSchema`), `frontend/src/shared/profiler/index.ts`, + `useICPs`/customers-service tests.

**Wave 4 (FE structural):**
- Create `frontend/src/shared/agent-config/AgentConfigForm.tsx` + `index.ts` + a test; rewrite `frontend/src/features/settings/components/AgentProfile.tsx` and `frontend/src/features/scout/components/ScoutDeployment.tsx` to render it.
- Create `frontend/src/features/settings/hooks/useUserProfile.ts` + `useAgentProfile.ts`; modify `frontend/src/features/settings/pages/SettingsPage.tsx`, `…/components/UserProfile.tsx`, `…/components/AgentProfile.tsx` + tests.

**Wave 5 (FE signal-map):**
- Modify `frontend/src/features/signals/hooks/useSignalLeadMap.ts`, `frontend/src/features/signals/pages/SignalsPage.tsx`, + the hook test.

**Wave 6 (FE pagination/routing):**
- Modify `frontend/src/shared/api/pagination.ts` (type `total`/`limit`/`offset` + a `pageParams` helper), `frontend/src/features/mission-control/services/missionControl.ts`, `frontend/src/features/mission-control/hooks/useDataSources.ts`, `frontend/src/features/signals/services/signals.ts`, `frontend/src/features/customers/services/customers.ts`, `frontend/src/features/customers/services/leads.ts`, `frontend/src/features/customers/hooks/useLeads.ts`, `frontend/src/features/customers/components/lead-stream/LeadStream.tsx`, `frontend/src/features/market-research/components/AIPromptingInterface.tsx`, `…/regulatory-compliance/RegulatoryComplianceSection.tsx` + service/component tests.

**Wave 7 (FE coherence):**
- Modify `…/regulatory-compliance/RegulatoryComplianceSection.tsx` (compute `currentStrategicRecommendations`), `…/regulatory-compliance/StrategicRecommendationsSection.tsx` (read it in read-only) + a test.

**Wave 8 (FE test/tooling):**
- Modify `frontend/e2e/journeys/04-market-research-5-components.spec.ts`.
- Create `frontend/e2e/journeys/08-strategist-workspace.spec.ts` (+ its `-snapshots/`).
- Modify `frontend/playwright.config.ts` (+ optionally `frontend/scripts/with-slot.mjs`).

**Wave 9 (register hygiene):**
- Modify `docs/TECH_DEBT.md` + `docs/TECH_DEBT_ARCHIVE.md` (surgical, no prettier).

---

## Wave 0 — Confirmations (gates; no production code)

Resolve the verify-first unknowns before the code waves and capture findings in a short note `docs/reviews/37-wave0-confirmations.md`. The backend is live (`https://brewra-gtm-intelligence.onrender.com`, `/docs`→200). Use a throwaway probe `(user_id, org_id)` and clean up any writes (Scout-500 probe discipline). **Code-side unknowns are already resolved below** from the authoring pass; only the two live-shape probes remain to run.

- [ ] **Probe 1 — TD-FE-23 chart field name (LIVE).** `POST /market-research_claude` (or `/market-research`) for the regulatory component; in the response, inspect `visualDataCards[]` items and record whether the chart-type discriminator is `chartType` (expected) and capture one full card object (`title`, the discriminator, `data[]`). Recorded confirmed 2026-06-02 — re-confirm. → feeds Task 2. If the field is some third name, adjust Task 2's normalization to `card.type ?? card.<actualField>` and escalate if the whole shape differs.
- [ ] **Probe 2 — TD-FE-42 ICP read (LIVE, optional confirm).** `GET /api/profile/company?user_id=<probe>&org_id=<probe>` then (if empty) `GET /api/customer_profile?org_id=<probe>`; capture the actual `icps[]` row keys present, to cross-check the schema authored in Task 13 from the consumer field reads. The call chain is already pinned by code (`profileIcpsExtract.ts:52` → `/api/profile/company` then `/api/customer_profile`); this only validates the field set.
- [x] **Confirmed (code) — TD-FE-56 ScoutDeployment home.** `frontend/src/features/scout/components/ScoutDeployment.tsx` (173 LOC; rendered by `features/scout/pages/ScoutDeploymentPage.tsx`). Shared home chosen: `frontend/src/shared/agent-config/`. → feeds Task 14.
- [x] **Confirmed (code) — TD-FE-25 persist question.** `localStrategicRecommendations` is purely ephemeral (no parent callback, no localStorage, never saved on exit). In-scope fix = read-only fallback alignment only (Task 20). → see ledger #14.
- [x] **Settled — TD-FE-73.** `/signal-lead-map_claude` confirmed **not deployed** (2026-06-15); excluded; carried forward in Wave 9. TD-FE-72 stays in scope as a fully MSW-testable FE change, dormant in prod until the endpoint ships.

---

# Wave 1 — Correctness bugs + dead-code (frontend, low risk)

### Task 1: TD-FE-64 — fix CSV smart-quote normalization + un-skip its tests

**Files:**
- Modify: `frontend/src/features/mission-control/components/data-sources/csvHelpers.ts` (line 11)
- Modify: `frontend/src/features/mission-control/components/data-sources/__tests__/csvHelpers.test.ts` (lines 141, 146)

- [ ] **Step 1: Un-skip the two ready tests.** In `csvHelpers.test.ts`, change line 141 from `it.skip("replaces U+201C / U+201D curly double-quotes with ASCII quote -- SKIPPED: bug in impl (replaces with U+201D not U+0022)", () => {` to:

```typescript
  it("replaces U+201C / U+201D curly double-quotes with ASCII quote", () => {
```

And line 146 from `it.skip("replaces U+201E / U+201F low-9 double-quotes with ASCII quote -- SKIPPED: same bug", () => {` to:

```typescript
  it("replaces U+201E / U+201F low-9 double-quotes with ASCII quote", () => {
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/mission-control/components/data-sources/__tests__/csvHelpers.test.ts --no-file-parallelism`
Expected: the two un-skipped tests FAIL — the normalized output still contains U+201D, not `"`.

- [ ] **Step 3: Fix the replacement target.** In `csvHelpers.ts`, change line 11 from `  text.replace(/[“”„‟＂]/g, "”");` to (keep the char class, swap the replacement to ASCII `"`):

```typescript
export const normalizeCsvAsciiDoubleQuotes = (text: string): string =>
  text.replace(/[“”„‟＂]/g, '"');
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/mission-control/components/data-sources/__tests__/csvHelpers.test.ts --no-file-parallelism`
Expected: PASS (all of `csvHelpers.test.ts`, including the two formerly-skipped cases and the two ASCII-passthrough cases).

- [ ] **Step 5: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/mission-control/components/data-sources/csvHelpers.ts src/features/mission-control/components/data-sources/__tests__/csvHelpers.test.ts
git add frontend/src/features/mission-control/components/data-sources/csvHelpers.ts frontend/src/features/mission-control/components/data-sources/__tests__/csvHelpers.test.ts
git commit -m "fix(fe): normalize curly CSV quotes to ASCII so quoted fields parse"
```

---

### Task 2: TD-FE-23 — normalize Compliance card on `chartType` so backend cards render

**Files:**
- Modify: `frontend/src/features/market-research/components/intelligence/regulatory-compliance/ComplianceVisualCard.tsx`
- Modify: `frontend/src/features/market-research/components/intelligence/regulatory-compliance/__tests__/ComplianceVisualCard.test.tsx`

- [ ] **Step 1: Write the failing test.** Append to `ComplianceVisualCard.test.tsx` (it already mocks recharts and imports `UntypedVisualDataCard`, `ComplianceVisualCard`, `render`, `screen`, `vi`):

```typescript
  it("renders a backend card keyed on chartType (not card.type)", () => {
    const card: UntypedVisualDataCard = {
      chartType: "bar-chart",
      title: "Backend Adoption Rates",
      data: [{ name: "GDPR", value: 80 }],
    };
    render(
      <ComplianceVisualCard
        card={card}
        cardIndex={0}
        isEditing={false}
        isExpanded={false}
        localVisualDataCards={[card]}
        onVisualDataCardsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Backend Adoption Rates")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/market-research/components/intelligence/regulatory-compliance/__tests__/ComplianceVisualCard.test.tsx --no-file-parallelism`
Expected: FAIL — the non-expanded branch keys on `card.type` (undefined here), so the component falls through to `return null` and the title never renders.

- [ ] **Step 3: Normalize once at the top, then replace every `card.type` read.** In `ComplianceVisualCard.tsx`, immediately inside the component body (before `if (isExpanded)`), add:

```typescript
  // Backend emits `chartType`; older/local cards use `type`. Read one normalized
  // discriminator so both render (TD-FE-23).
  const chartType = card.type ?? card.chartType;
```

Then replace **all 9** `card.type` reads with `chartType`: in the expanded branch the icon checks (`card.type === "pie-chart"`, `"line-chart"`, `"bar-chart"`, and `!card.type` → `!chartType`) and the render ternary (`card.type === "pie-chart" ? … : card.type === "line-chart" ? … : card.type === "bar-chart" ? … : card.type === "timeline" ? … : card.type === "percentage" ? …`); and in the non-expanded branch the dispatch (`if (card.type === "bar-chart")`, `else if (card.type === "timeline")`, `else if (card.type === "percentage")`). Leave the `data`/`title` reads unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/market-research/components/intelligence/regulatory-compliance/__tests__/ComplianceVisualCard.test.tsx --no-file-parallelism`
Expected: PASS (the new `chartType` test plus the existing `type`-keyed tests — the `??` keeps `card.type` working).

- [ ] **Step 5: Typecheck, format, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx prettier --check src/features/market-research/components/intelligence/regulatory-compliance/ComplianceVisualCard.tsx src/features/market-research/components/intelligence/regulatory-compliance/__tests__/ComplianceVisualCard.test.tsx
git add frontend/src/features/market-research/components/intelligence/regulatory-compliance/ComplianceVisualCard.tsx frontend/src/features/market-research/components/intelligence/regulatory-compliance/__tests__/ComplianceVisualCard.test.tsx
git commit -m "fix(fe): render compliance visual cards keyed on backend chartType"
```

---

### Task 3: TD-FE-26 — route regulatory localStorage writes through the user-scoped helper

The 5 `regulatory_*` writes currently hit the *base* key while reads are user-scoped (caught only by the base-key fallback). Route them through `setUserLocalStorage(...)` so they share the read keyspace (behavior-preserving). The `regulatory-compliance_*_json` writes — **both** pairs (unscoped at 488-489 and scoped at 547-557) — have no reader anywhere in `src`; delete them with their dead feeder objects.

**Files:**
- Modify: `frontend/src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx`

- [ ] **Step 1: Route the 5 scoped writes.** `setUserLocalStorage` is already imported (line 17) and `currentUser` is in scope (line 54). Replace each raw write in the five `useEffect`s (lines 163, 169, 175, 181, 187):

```typescript
  useEffect(() => {
    if (localExecutiveSummary) {
      setUserLocalStorage("regulatory_executiveSummary", localExecutiveSummary, currentUser?.uid);
    }
  }, [localExecutiveSummary, currentUser?.uid]);

  useEffect(() => {
    if (localEuAiActDeadline) {
      setUserLocalStorage("regulatory_euAiActDeadline", localEuAiActDeadline, currentUser?.uid);
    }
  }, [localEuAiActDeadline, currentUser?.uid]);

  useEffect(() => {
    if (localGdprCompliance) {
      setUserLocalStorage("regulatory_gdprCompliance", localGdprCompliance, currentUser?.uid);
    }
  }, [localGdprCompliance, currentUser?.uid]);

  useEffect(() => {
    if (localPotentialFines) {
      setUserLocalStorage("regulatory_potentialFines", localPotentialFines, currentUser?.uid);
    }
  }, [localPotentialFines, currentUser?.uid]);

  useEffect(() => {
    if (localDataLocalization) {
      setUserLocalStorage("regulatory_dataLocalization", localDataLocalization, currentUser?.uid);
    }
  }, [localDataLocalization, currentUser?.uid]);
```

- [ ] **Step 2: Delete both readerless `_json` write blocks — and their now-dead feeder objects.** Both `regulatory-compliance_*_json` keys are written twice and read **nowhere** in `src` (verified: zero `getItem`/`getUserLocalStorage` of these keys). Deleting only the writes would orphan the objects that feed them (unused-var → typecheck/lint failure), so remove each write *with* its sole-purpose feeder:
  - In `handleRegulatoryComplianceSaveChanges` (≈ lines 465-489): delete the `const originalData = { … }` and `const modifiedData = { … }` literals, the `// Prepare data for API …` / `// Store data for /ask API` comments, and the two `localStorage.setItem("regulatory-compliance_original_json"/"…_modified_json", …)` writes. **Keep** the five `onXChange(local…)` calls, the `onSaveChanges()` call, and the surrounding `try/catch`.
  - In `handleSaveChangesClick` (≈ lines 503-557): delete the `const originalJson = { … }` and `const modifiedJson = { … }` literals (with their `// Log original and modified JSON …` / `// Store JSON data …` comments) and the two `setUserLocalStorage("regulatory-compliance_original_json"/"…_modified_json", …, currentUser?.uid)` writes. **Keep** the `onXChange(local…)` calls that follow at line 559+.

  `setUserLocalStorage` and `currentUser` stay in use via Step 1, so no import goes dead.

- [ ] **Step 3: Confirm no raw `regulatory_*` writes and no `_json` writes remain**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && rg -n 'localStorage\.setItem\("regulatory|regulatory-compliance_(original|modified)_json' src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx`
Expected: no matches (the five `regulatory_*` writes now route through `setUserLocalStorage`; both `_json` pairs and their feeders are deleted).

- [ ] **Step 4: Typecheck + existing regulatory tests**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx vitest run src/features/market-research/components/intelligence/regulatory-compliance --no-file-parallelism`
Expected: PASS (no behavior regression; the writes now scope-match the reads).

- [ ] **Step 5: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx
git add frontend/src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx
git commit -m "refactor(fe): scope regulatory localStorage writes and drop dead _json writes"
```

---

### Task 4: TD-FE-12 — remove dead `availableTenants` / `setAvailableTenants` from TenantContext

Grep confirmed 0 external readers (TenantSelection uses the `useTenants` query, not the context fields).

**Files:**
- Modify: `frontend/src/shared/tenant/TenantContext.tsx`

- [ ] **Step 1: Remove from the type.** Delete lines 15 (`availableTenants: Tenant[];`) and 18 (`setAvailableTenants: (tenants: Tenant[]) => void;`) from `TenantContextType` (lines 13-20).

- [ ] **Step 2: Remove the state.** Delete line 39 (`const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);`).

- [ ] **Step 3: Remove from the provider value.** Delete lines 111 (`availableTenants,`) and 114 (`setAvailableTenants,`) from the `value` object (lines 109-116).

- [ ] **Step 4: Verify no references remain + typecheck**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && rg -n 'availableTenants|setAvailableTenants' src/shared/tenant/ && npm run typecheck`
Expected: `rg` returns nothing under `src/shared/tenant/`; typecheck PASSES (the `TenantSelectionPage` `availableTenants` is a local `useTenants` var, unaffected).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/tenant/TenantContext.tsx
git commit -m "chore(fe): drop dead availableTenants fields from TenantContext"
```

---

### Task 5: TD-FE-40 — strip ICPManager console noise + total `getFitConfidenceBadge`

**Files:**
- Modify: `frontend/src/features/mission-control/components/icp/ICPManager.tsx` (19 `console.*` calls)
- Modify: `frontend/src/features/mission-control/components/icp/IcpList.tsx` (lines 18-48)
- Modify: `frontend/src/features/mission-control/components/icp/__tests__/IcpList.test.tsx`

- [ ] **Step 1: Write the failing badge test.** Append to `IcpList.test.tsx` (it has `makeIcp`, `renderList`, `screen`, `within`):

```typescript
  it("renders no badge for an out-of-union fit confidence", () => {
    renderList({ icps: [makeIcp({ fitConfidence: "unknown" as ICP["fitConfidence"] })] });
    expect(screen.queryByText("High")).not.toBeInTheDocument();
    expect(screen.queryByText("Medium")).not.toBeInTheDocument();
    expect(screen.queryByText("Low")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the guard (a green here is expected — this is not a TDD red→green driver)**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/mission-control/components/icp/__tests__/IcpList.test.tsx --no-file-parallelism`
This test is a **regression guard, not a red→green step**: today `getFitConfidenceBadge` returns `undefined` for an out-of-union value and React renders nothing, so the three `not.toBeInTheDocument()` assertions pass *vacuously* — expect GREEN, and do not treat it as a TDD violation. The behavioral lock is Step 3, which adds an explicit `default: return null` so the function is total and typed `JSX.Element | null` (a typecheck-visible change). (Only if recharts/`Badge` throws on `undefined` does this go red today — in which case Step 3 fixes it.)

- [ ] **Step 3a: Make `getFitConfidenceBadge` total.** In `IcpList.tsx`, add a default case before the closing brace of the `switch` (after the `case "low"` block, line 46):

```typescript
    default:
      return null;
  }
};
```

- [ ] **Step 3b: Strip the 19 `console.*` calls from `ICPManager.tsx`.** Remove every `console.log` / `console.warn` / `console.error` listed at lines 80, 85, 92-96, 102, 111-112, 118, 127, 131 (`saveCustomerProfileToBackend`), 217 (dedup effect), 255 (`handleWizardSaved`), 296, 312, 314-319, 334 (`handleDeleteICP`). Keep the surrounding control flow intact — e.g. the `catch (e) { console.warn(...) }` blocks become `catch { /* ignore */ }`, and the retry `if (isServerError && retryCount < 2) { console.log(...); await …; return … }` keeps everything but the `console.log` line. Do not remove the `setUserLocalStorage`/`apiFetch`/`refreshIcpsFromServer` logic.

- [ ] **Step 4: Run to verify + no console left**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && rg -n 'console\.' src/features/mission-control/components/icp/ICPManager.tsx ; npx vitest run src/features/mission-control/components/icp --no-file-parallelism && npm run typecheck`
Expected: `rg` returns nothing; ICP tests PASS; typecheck green (`getFitConfidenceBadge` now `JSX.Element | null`).

- [ ] **Step 5: Lint, format, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx eslint src/features/mission-control/components/icp/ICPManager.tsx src/features/mission-control/components/icp/IcpList.tsx && npx prettier --check src/features/mission-control/components/icp/ICPManager.tsx src/features/mission-control/components/icp/IcpList.tsx src/features/mission-control/components/icp/__tests__/IcpList.test.tsx
git add frontend/src/features/mission-control/components/icp/ICPManager.tsx frontend/src/features/mission-control/components/icp/IcpList.tsx frontend/src/features/mission-control/components/icp/__tests__/IcpList.test.tsx
git commit -m "chore(fe): strip ICPManager console noise and make fit-confidence badge total"
```

---

### Task 6: TD-FE-24 — extract regulatory defaults to one module (replaces all 3 copies)

**Files:**
- Create: `frontend/src/features/market-research/components/intelligence/regulatory-compliance/regulatoryDefaults.ts`
- Create: `frontend/src/features/market-research/components/intelligence/regulatory-compliance/__tests__/regulatoryDefaults.test.ts`
- Modify: `frontend/src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx` (3 copies → imports)

- [ ] **Step 1: Write the shape test.** Create `__tests__/regulatoryDefaults.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { DEFAULT_REGIONAL_DATA, DEFAULT_VISUAL_DATA_CARDS } from "../regulatoryDefaults";

describe("regulatoryDefaults", () => {
  it("exposes the 4 canonical regions in order", () => {
    expect(DEFAULT_REGIONAL_DATA.map((r) => r.region)).toEqual([
      "European Union",
      "United States",
      "China",
      "United Kingdom",
    ]);
  });
  it("exposes the 3 canonical visual cards with their chart types", () => {
    expect(DEFAULT_VISUAL_DATA_CARDS.map((c) => [c.title, c.type])).toEqual([
      ["Compliance Adoption Rates", "bar-chart"],
      ["Regulatory Timeline", "timeline"],
      ["Risk Indicators", "percentage"],
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/market-research/components/intelligence/regulatory-compliance/__tests__/regulatoryDefaults.test.ts --no-file-parallelism`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `regulatoryDefaults.ts`** with the canonical data (copied verbatim from the current copy 1 at `RegulatoryComplianceSection.tsx:332-365` / `:374-403`):

```typescript
// Single source of truth for the regulatory-compliance fallback datasets.
// Previously inlined three times in RegulatoryComplianceSection.tsx (TD-FE-24).

export const DEFAULT_REGIONAL_DATA = [
  {
    region: "European Union",
    framework: "GDPR + AI Act",
    deadline: "Q1 2026",
    impact: "High",
    status: "Active",
    requirements: "Data protection, AI governance",
  },
  {
    region: "United States",
    framework: "CCPA + State Laws",
    deadline: "Ongoing",
    impact: "Medium",
    status: "Evolving",
    requirements: "Privacy rights, data handling",
  },
  {
    region: "China",
    framework: "PIPL + Cybersecurity Law",
    deadline: "Active",
    impact: "High",
    status: "Mandatory",
    requirements: "Data localization, security",
  },
  {
    region: "United Kingdom",
    framework: "UK GDPR + DPA",
    deadline: "Active",
    impact: "Medium",
    status: "Active",
    requirements: "Data protection, transfers",
  },
];

export const DEFAULT_VISUAL_DATA_CARDS = [
  {
    title: "Compliance Adoption Rates",
    type: "bar-chart",
    data: [
      { name: "GDPR", value: 68, color: "#10b981" },
      { name: "CCPA", value: 45, color: "#3b82f6" },
      { name: "SOC 2", value: 72, color: "#8b5cf6" },
      { name: "ISO 27001", value: 38, color: "#f59e0b" },
    ],
  },
  {
    title: "Regulatory Timeline",
    type: "timeline",
    data: [
      { date: "Q1 2025", event: "EU AI Act Phase 1", status: "upcoming" },
      { date: "Q3 2025", event: "GDPR Updates", status: "upcoming" },
      { date: "Q1 2026", event: "EU AI Act Full Enforcement", status: "critical" },
    ],
  },
  {
    title: "Risk Indicators",
    type: "percentage",
    data: [
      { metric: "Data Breach Risk", value: 23, trend: "down" },
      { metric: "Non-compliance Penalties", value: 15, trend: "up" },
      { metric: "Audit Readiness", value: 67, trend: "up" },
    ],
  },
];
```

- [ ] **Step 4: Replace all 3 copies in `RegulatoryComplianceSection.tsx`.** Add the import near the other local imports:

```typescript
import { DEFAULT_REGIONAL_DATA, DEFAULT_VISUAL_DATA_CARDS } from "./regulatoryDefaults";
```

Then: in the first init `useEffect`, replace `const defaultRegionalData = [ … ];` (332-365) with `const defaultRegionalData = DEFAULT_REGIONAL_DATA;` and `const defaultVisualDataCards = [ … ];` (374-403) with `const defaultVisualDataCards = DEFAULT_VISUAL_DATA_CARDS;`. In the second init `useEffect`, do the same for the copies at 637-670 and 672-701. For the third (top-level) copy, replace `const visualDataCards = regulatoryData?.visualDataCards || [ … ];` (729-758) with `const visualDataCards = regulatoryData?.visualDataCards || DEFAULT_VISUAL_DATA_CARDS;` and `const regionalData = regulatoryData?.regionalData || [ … ];` (760-793) with `const regionalData = regulatoryData?.regionalData || DEFAULT_REGIONAL_DATA;`.

- [ ] **Step 5: Run tests + typecheck**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/market-research/components/intelligence/regulatory-compliance --no-file-parallelism && npm run typecheck`
Expected: PASS (regulatoryDefaults shape test + existing regulatory tests; one definition now feeds all sites).

- [ ] **Step 6: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/market-research/components/intelligence/regulatory-compliance/regulatoryDefaults.ts src/features/market-research/components/intelligence/regulatory-compliance/__tests__/regulatoryDefaults.test.ts src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx
git add frontend/src/features/market-research/components/intelligence/regulatory-compliance/regulatoryDefaults.ts frontend/src/features/market-research/components/intelligence/regulatory-compliance/__tests__/regulatoryDefaults.test.ts frontend/src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx
git commit -m "refactor(fe): dedupe regulatory default datasets into one module"
```

---

### Task 7: TD-FE-16 — rename internal `useSidebar` to `useAppSidebar`, drop the barrel alias

Self-contained to `features/shell/` (2 relative importers; the shadcn primitive `useSidebar` in `components/ui/sidebar.tsx` is a different hook — do not touch it).

**Files:**
- Modify: `frontend/src/features/shell/SidebarContext.tsx` (line 21)
- Modify: `frontend/src/features/shell/index.ts` (line 3)
- Modify: `frontend/src/features/shell/components/Sidebar.tsx` (lines 328, 362)
- Modify: `frontend/src/features/shell/components/Header.tsx` (lines 15, 53)

- [ ] **Step 1: Rename the hook.** In `SidebarContext.tsx`, change line 21 `export function useSidebar() {` to `export function useAppSidebar() {` and update its error string (line 24) to `throw new Error("useAppSidebar must be used within a SidebarProvider");`.

- [ ] **Step 2: Drop the barrel alias.** In `shell/index.ts`, change line 3 from `export { SidebarProvider, useSidebar as useAppSidebar } from "./SidebarContext";` to:

```typescript
export { SidebarProvider, useAppSidebar } from "./SidebarContext";
```

- [ ] **Step 3: Update the two relative importers.** In `Sidebar.tsx` line 328, change `import { useSidebar } from "../SidebarContext";` → `import { useAppSidebar } from "../SidebarContext";`, and line 362 `const { mobileOpen, setMobileOpen } = useSidebar();` → `… = useAppSidebar();`. In `Header.tsx` line 15, `import { useSidebar } from "../SidebarContext";` → `import { useAppSidebar } from "../SidebarContext";`, and line 53 `const { setMobileOpen } = useSidebar();` → `… = useAppSidebar();`.

- [ ] **Step 4: Verify the internal symbol is gone + typecheck**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && rg -n 'useSidebar' src/features/shell/ ; npm run typecheck`
Expected: `rg` returns nothing under `src/features/shell/` (the shadcn `useSidebar` is under `src/components/ui/`, untouched); typecheck green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/shell/SidebarContext.tsx frontend/src/features/shell/index.ts frontend/src/features/shell/components/Sidebar.tsx frontend/src/features/shell/components/Header.tsx
git commit -m "refactor(fe): rename shell internal useSidebar to useAppSidebar"
```

---

### Task 8: TD-FE-66 — clean up `useDocumentSync` (dead state + logs, then ref-read + in-flight guard)

Two commits. **Commit A** removes the dead `_isSaving` and thins logs (behavior-neutral). **Commit B** replaces the read-via-setter with a ref read, adds an in-flight guard, fixes the self-referencing dep array, and adds the first test for this hook.

**Files:**
- Modify: `frontend/src/features/mission-control/components/data-sources/useDocumentSync.ts`
- Create: `frontend/src/features/mission-control/components/data-sources/__tests__/useDocumentSync.test.ts`

- [ ] **Step 1 (Commit A): Decide `setIsSaving`'s fate.** `_isSaving` (line 57 value) is dead, but `setIsSaving` is exposed on `DocumentSyncApi` (line 31) and returned. Grep consumers:

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && rg -n 'setIsSaving' src/features/mission-control`
- If **no consumer calls it** (only the declaration + the return), remove `const [_isSaving, setIsSaving] = useState(false);` (line 57), the `setIsSaving` field from the `DocumentSyncApi` interface (line 31), and the `setIsSaving` entry in the returned object.
- If a consumer **does** call it, keep `setIsSaving` as a no-op (`const setIsSaving = (_v: boolean) => {};`) and remove only the unused `_isSaving` value. (Pick the branch the grep dictates; record which in the commit body.)

- [ ] **Step 2 (Commit A): Thin the logs.** Remove the ~17 verbose `console.log`/`console.warn` debug calls inside `applyBackendDocuments` (lines 127-522 — the 📋/✅/🔗 noise). **Keep** the functional `console.error` at line 110 (it reports a real status-check failure). Leave all parsing/merge logic intact.

- [ ] **Step 3 (Commit A): Verify + commit**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx vitest run src/features/mission-control/components/data-sources --no-file-parallelism`
Expected: PASS (DataSourcesManager indirect coverage still green; no behavior change).

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/mission-control/components/data-sources/useDocumentSync.ts
git add frontend/src/features/mission-control/components/data-sources/useDocumentSync.ts
git commit -m "chore(fe): remove dead _isSaving state and debug logs from useDocumentSync"
```

- [ ] **Step 4 (Commit B): Write the failing in-flight-guard test.** Create `__tests__/useDocumentSync.test.ts`. The hook reads documents via `useDataSources` (MSW: `/api/v2/user-documents`) and checks per-file status via `document-status/:fileKey` (MSW: `/api/document-status/...`). Assert that two rapid `checkProcessingFilesStatus()` calls fetch each processing file's status **once** (the guard skips re-entry):

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDocumentSync } from "../useDocumentSync";

import { server } from "@/test/msw/server";

vi.mock("@/shared/auth", () => ({
  useAuthToken: () => ({ currentUser: { uid: "u1" }, orgId: "brewra", getAuthHeader: async () => "" }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.restoreAllMocks());

describe("useDocumentSync in-flight guard", () => {
  it("does not re-fetch a file whose status check is already in flight", async () => {
    let statusCalls = 0;
    let resolveStatus: (() => void) | null = null;
    server.use(
      http.get("/api/v2/user-documents", () =>
        HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 }),
      ),
      http.get("/api/document-status/:fileKey", async () => {
        statusCalls += 1;
        await new Promise<void>((r) => (resolveStatus = r)); // hang until released
        return HttpResponse.json({ status: "completed" });
      }),
    );

    const { result } = renderHook(() => useDocumentSync("brewra"), { wrapper });

    // Seed one processing file into the hook's state.
    act(() => {
      result.current.setDataSources([
        { id: "f1", type: "file", status: "processing", name: "a.pdf" } as never,
      ]);
    });

    await act(async () => {
      result.current.checkProcessingFilesStatus();
      result.current.checkProcessingFilesStatus(); // second call while first is in flight
    });

    await waitFor(() => expect(statusCalls).toBe(1)); // guard prevented the duplicate
    resolveStatus?.();
  });
});
```

(Adjust the destructured API names — `setDataSources`, `checkProcessingFilesStatus` — to the hook's actual returned surface; both are in `DocumentSyncApi`.)

- [ ] **Step 5 (Commit B): Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/mission-control/components/data-sources/__tests__/useDocumentSync.test.ts --no-file-parallelism`
Expected: FAIL — `statusCalls` reaches 2 (no guard yet), or the read-via-setter path double-fires.

- [ ] **Step 6 (Commit B): Implement ref-read + in-flight guard.** Add `useRef` to the React import. Below the `dataSources` state (line 56), add a synced ref + an in-flight set:

```typescript
  const dataSourcesRef = useRef<DataSource[]>([]);
  useEffect(() => {
    dataSourcesRef.current = dataSources;
  }, [dataSources]);
  const inFlightStatusIds = useRef<Set<string>>(new Set());
```

Then rewrite `checkProcessingFilesStatus` (lines 94-117) to read from the ref instead of abusing `setDataSources`, guard re-entry per file id, and fix the dep array:

```typescript
  const checkProcessingFilesStatus = useCallback(async () => {
    const processingFiles = dataSourcesRef.current.filter(
      (s) => s.status === "processing" && s.type === "file",
    );
    processingFiles.forEach((file) => {
      if (inFlightStatusIds.current.has(file.id)) return; // already checking this file
      inFlightStatusIds.current.add(file.id);
      void (async () => {
        try {
          const statusPayload = await checkDocumentStatus(resolveDocumentStatusFileKey(file));
          setDataSources((prev) =>
            prev.map((s) =>
              isSameDataSourceRow(s, file) ? { ...s, status: statusPayload.status } : s,
            ),
          );
        } catch (err) {
          console.error(`Error checking status for file ${file.id}:`, err);
        } finally {
          inFlightStatusIds.current.delete(file.id);
        }
      })();
    });
  }, [checkDocumentStatus]);
```

- [ ] **Step 7 (Commit B): Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/mission-control/components/data-sources --no-file-parallelism && npm run typecheck`
Expected: PASS (guard holds `statusCalls` at 1; happy-path status update unchanged; DataSourcesManager tests green).

- [ ] **Step 8 (Commit B): Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/mission-control/components/data-sources/useDocumentSync.ts src/features/mission-control/components/data-sources/__tests__/useDocumentSync.test.ts
git add frontend/src/features/mission-control/components/data-sources/useDocumentSync.ts frontend/src/features/mission-control/components/data-sources/__tests__/useDocumentSync.test.ts
git commit -m "fix(fe): guard concurrent document-status checks with a ref-held in-flight set"
```

---

# Wave 2 — Backend (standalone)

> **Independent of the FE waves.** Wave 2 shares **zero files** with Waves 1 and 3–8 (it is entirely under `backend/`), so it can be authored and verified on its own — e.g. handed to a backend-focused subagent in parallel — gated only by `backend/.venv/bin/python -m pytest backend/tests/ -q`. Ordering relative to the FE waves is free under the single branch; only the final merge gate joins the two.

### Task 9: TD-005 — delete the deprecated v1 `/user-documents` and `/fetch-signals` routes

The grep gate (authoring pass) found **no app/v2/FE caller** of either v1 route. Deleting them breaks only v1 pytest cases (migrated below) and two out-of-gate prod-probe artifacts (flagged). v1 and v2 share services, so no service code goes dead; only the v1-only response models become unused.

**Files:**
- Modify: `backend/app/routers/data_sources.py` (remove `get_user_documents`, lines 95-108)
- Modify: `backend/app/routers/signals.py` (remove `fetch_signals`, lines 65-80)
- Modify: `backend/app/models/data_sources.py` (remove `ListUserDocumentsResponse`)
- Modify: `backend/app/models/signals.py` (remove `FetchSignalsResponse`)
- Modify: `backend/tests/test_data_sources.py`, `backend/tests/test_signals.py`, `backend/tests/test_smoke.py`

- [ ] **Step 1: Re-confirm the gate at execution time.** `master` may have advanced:

Run: `cd /projects/Brewra/brewra-gtm-intelligence && rg -n --glob '!docs/**' '/user-documents|/fetch-signals' frontend/src backend/app backend/tests backend/*.py`
Expected: every hit is (a) the v1 route def itself, (b) a v2 path containing the substring (`/v2/...`), or (c) a v1 pytest case / prod-probe artifact. **If a new real caller appears that can't move to v2, STOP** and fall back to passing `total` through for that one route (see Abort triggers).

- [ ] **Step 2: Delete the v1 routes.** In `data_sources.py` remove the whole `get_user_documents` function (the `@router.get("/user-documents", …)` decorator through `return {"status": "success", "count": len(items), "files": items}`). In `signals.py` remove the whole `fetch_signals` function (`@router.get("/fetch-signals", …)` through its `return …`). Then remove now-unused imports in each file (`ListUserDocumentsResponse` / `FetchSignalsResponse`, and `Response` if no other route in the file uses it — the v2 routers live in `app/routers/v2/`, so the v1 files may no longer need `Response`).

- [ ] **Step 3: Delete the v1-only models.** In `app/models/data_sources.py` remove `ListUserDocumentsResponse`; in `app/models/signals.py` remove `FetchSignalsResponse`. (Grep first to be safe: `rg -n 'ListUserDocumentsResponse|FetchSignalsResponse' backend/` should show only the defs after Step 2.)

- [ ] **Step 4: Migrate the tests.** In `backend/tests/test_data_sources.py`, delete the v1 characterization cases (the ones doing `client.get("/user-documents…")` and asserting `body["count"]`/`body["files"]`, ~lines 112-139) — the v2 envelope is already covered by `test_data_sources_v2.py`. In `backend/tests/test_signals.py`, delete the v1 cases (`client.get("/fetch-signals…")` asserting `count`/`signals`, ~lines 89-122) — `test_signals_v2.py` covers v2. In `backend/tests/test_smoke.py` (lines 30-31), repoint the smoke from v1 to v2 and assert the envelope:

```python
    response = client.get(f"/v2/fetch-signals?user_id={TEST_USER_ID}")
    assert response.status_code == 200
    assert set(response.json().keys()) == {"items", "total", "limit", "offset"}
```

(Use whatever user-id constant `test_smoke.py` already imports.)

- [ ] **Step 5: Run the touched backend tests**

Run: `cd /projects/Brewra/brewra-gtm-intelligence && backend/.venv/bin/python -m pytest backend/tests/test_data_sources.py backend/tests/test_data_sources_v2.py backend/tests/test_signals.py backend/tests/test_signals_v2.py backend/tests/test_smoke.py -q`
Expected: PASS (no v1 references; v2 envelopes green). If a collection error names a deleted symbol, an import in a test file still references the removed model — remove it.

- [ ] **Step 6: Commit** (note the prod-probe artifacts in the body)

```bash
git add backend/app/routers/data_sources.py backend/app/routers/signals.py backend/app/models/data_sources.py backend/app/models/signals.py backend/tests/test_data_sources.py backend/tests/test_signals.py backend/tests/test_smoke.py
git commit -m "chore(be): delete deprecated v1 user-documents and fetch-signals routes

v2 successors carry items/total/limit/offset. No app/FE caller remained; the v1
pytest cases are removed and the smoke migrated to v2. Out-of-gate prod probes
(backend/test_upload_embedding.py, backend/admin_panel.html) still reference the
old v1 paths against a hardcoded prod URL — flagged, not part of the suite."
```

---

### Task 10: TD-012 — flip the seven Apollo handlers from `async def` to sync `def`

All seven just `return connectors_service.…` with no `await`; FastAPI thread-pools sync handlers and `BackgroundTasks` works from them (the `add_task` calls are in the service layer). The module docstring already states this convention.

**Files:**
- Modify: `backend/app/routers/connectors.py` (lines 59, 70, 81, 91, 103, 113, 123)
- Modify: `backend/tests/test_connectors_routes.py` (add a sync-ness assertion)

- [ ] **Step 1: Write the failing test.** Append to `backend/tests/test_connectors_routes.py`:

```python
def test_apollo_handlers_are_sync_def():
    import inspect
    from app.routers import connectors as r
    for name in (
        "apollo_import", "apollo_enrich", "apollo_enrich_status",
        "apollo_discover", "apollo_discover_status", "apollo_warmup",
        "apollo_leads_export",
    ):
        fn = getattr(r, name)
        assert not inspect.iscoroutinefunction(fn), f"{name} should be sync def (TD-012)"
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence && backend/.venv/bin/python -m pytest backend/tests/test_connectors_routes.py::test_apollo_handlers_are_sync_def -q`
Expected: FAIL (all seven are still `async def`).

- [ ] **Step 3: Flip the seven signatures.** In `connectors.py`, change `async def` → `def` for: `apollo_import` (line 59), `apollo_enrich` (70), `apollo_enrich_status` (81), `apollo_discover` (91), `apollo_discover_status` (103), `apollo_warmup` (113), `apollo_leads_export` (123). Leave the bodies, params (incl. `background_tasks: BackgroundTasks`), decorators, and `return` statements unchanged. (Match the already-sync `connect_apollo` / `apollo_status` / `disconnect_apollo` / `apollo_lists` style.)

- [ ] **Step 4: Run to verify + regression**

Run: `cd /projects/Brewra/brewra-gtm-intelligence && backend/.venv/bin/python -m pytest backend/tests/test_connectors_routes.py backend/tests/test_connectors_wiring.py backend/tests/test_connectors.py -q`
Expected: PASS (new sync-ness assertion + the existing route tests — `TestClient` drives sync and async identically; import/enrich/discover still queue their BackgroundTask, status/export still return).

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/connectors.py backend/tests/test_connectors_routes.py
git commit -m "refactor(be): run blocking Apollo handlers as sync def (FastAPI threadpool)"
```

---

### Task 11: TD-FE-71 — narrow the signal↔lead-map MATCHING RULES to headline-only

The payload sends only `{signal_id, headline}`, but the rules tell the model to match on fields never sent. Narrow the one rule line; add an assertion (the prompt has no golden fixture, and the existing render test doesn't check the rules).

**Files:**
- Modify: `backend/prompts/signals/signals_lead_map.md.j2` (line 24)
- Modify: `backend/tests/unit/test_signal_lead_map.py` (extend `test_signals_lead_map_prompt_renders`)

- [ ] **Step 1: Strengthen the render test.** In `backend/tests/unit/test_signal_lead_map.py`, extend `test_signals_lead_map_prompt_renders` (the autouse fixture has inited the registry) so it asserts the rules are headline-scoped and no longer point at unsent fields:

```python
def test_signals_lead_map_prompt_renders():
    from app.core import prompts
    rendered = prompts.render(
        "signals_lead_map", signals_json="[]", leads_json="[]", context_json="{}"
    )
    assert rendered.body
    body = rendered.body.lower()
    assert "relevance" in body
    assert "headline" in body
    # The payload carries only signal_id + headline (TD-FE-71): rules must not
    # instruct matching on fields that are never sent.
    assert "company mention in the signal" not in body
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence && backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py::test_signals_lead_map_prompt_renders -q`
Expected: FAIL — the current line 24 contains "an explicit company mention in the signal".

- [ ] **Step 3: Narrow the rule.** In `signals_lead_map.md.j2`, replace line 24:

```jinja
- A signal is relevant to a lead when its HEADLINE plausibly affects that lead's company — match the headline text against the lead's company, industry, or region.
```

(Leave the other MATCHING RULES lines and the `SIGNALS (… signal_id + headline)` header unchanged.)

- [ ] **Step 4: Run to verify it passes + the rest of the module**

Run: `cd /projects/Brewra/brewra-gtm-intelligence && backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py -q`
Expected: PASS (prompt + the existing fingerprint/cache/orchestration tests; the `build_signal_lead_map_claude` parse path is unaffected — prompt wording only).

- [ ] **Step 5: Commit**

```bash
git add backend/prompts/signals/signals_lead_map.md.j2 backend/tests/unit/test_signal_lead_map.py
git commit -m "fix(be): narrow signal-lead-map matching rules to the headline actually sent"
```

---

# Wave 3 — Typing & contracts (frontend)

### Task 12: TD-FE-61 + TD-FE-50 — rename `SignalsChatContext`→`ChatContext`, type the sessionStorage handoff

Done together. Rename the **type** everywhere (leave the lowercase `signalsChatContext` state vars and the `"signalsChatContext"` key string alone), and centralize the sessionStorage read/write in two shared helpers so the inline `as` casts disappear. One atomic commit (a rename must keep typecheck green). **Deliberate tradeoff:** this bundles two register entries (TD-FE-61 rename + TD-FE-50 handoff-typing) into a single reviewable unit because they touch the same files and splitting would leave a red intermediate (a half-applied rename breaks typecheck) — per-entry reviewability is traded for green-at-every-commit; accepted, not incidental.

**Files:**
- Modify: `frontend/src/shared/chat/ContextChat.tsx` (rename type; add session helpers)
- Modify: `frontend/src/shared/chat/index.ts`
- Modify: `frontend/src/shared/chat/ChatWithHistory.tsx`
- Modify: `frontend/src/shared/chat/README.md` (surgical)
- Modify: `frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx`
- Modify: `frontend/src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx`
- Modify: `frontend/src/features/customers/pages/CustomersPage.tsx`
- Modify: `frontend/src/features/market-research/components/trends/TrendsTab.tsx`
- Modify: `frontend/src/features/signals/pages/SignalsPage.tsx`
- Modify: `frontend/src/shared/chat/__tests__/ContextChat.test.tsx`

- [ ] **Step 1: Rename the type + add session helpers in `ContextChat.tsx`.** Change `export interface SignalsChatContext {` (line 24) to `export interface ChatContext {`, and the prop `context: SignalsChatContext;` (line 38) to `context: ChatContext;`. After the `ChatMessage` type, add the centralized handoff (key string unchanged):

```typescript
/** sessionStorage key for the cross-tab chat handoff. Kept stable — renaming it
 *  would orphan in-flight entries (TD-FE-50). */
export const CHAT_CONTEXT_SESSION_KEY = "signalsChatContext";

/** Read the chat-context handoff (typed; replaces inline `as` casts). */
export function readSessionChatContext(): ChatContext | null {
  try {
    const stored = sessionStorage.getItem(CHAT_CONTEXT_SESSION_KEY);
    return stored ? (JSON.parse(stored) as ChatContext) : null;
  } catch {
    return null;
  }
}

/** Write the chat-context handoff. */
export function writeSessionChatContext(context: ChatContext): void {
  sessionStorage.setItem(CHAT_CONTEXT_SESSION_KEY, JSON.stringify(context));
}
```

- [ ] **Step 2: Update the barrel `index.ts`.** Change line 5 to export the renamed type + the helpers, and fix the comment on line 3:

```typescript
// history shell. The substrate type is `ChatContext` (renamed from SignalsChatContext, TD-FE-61).
export { ContextChat, CHAT_CONTEXT_SESSION_KEY, readSessionChatContext, writeSessionChatContext } from "./ContextChat";
export type { ChatContext, ChatMessage } from "./ContextChat";
```

- [ ] **Step 3: Rename the type at every TYPE usage.** Replace `SignalsChatContext` → `ChatContext` (TitleCase only) in: `ChatWithHistory.tsx` (import line 4; lines 13, 50, 66), `ProfilerChatWithHistory.tsx` (lines 2, 6, 11), `ScoutChatWithHistory.tsx` (grep it: `rg -n SignalsChatContext src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx` — update the import + usage, mirrors ProfilerChatWithHistory), `CustomersPage.tsx` (import line 13; `useState<…>` line 21; the cast line 38), `TrendsTab.tsx` (import line 8; `useState<…>` line 25; the cast line 35), and `ContextChat.test.tsx` (lines 7, 23, 52). **Do NOT** touch the lowercase `signalsChatContext`/`setSignalsChatContext` identifiers or the `"signalsChatContext"` string literal.

- [ ] **Step 4: Centralize the producer/consumer handoff (removes inline casts).** In `SignalsPage.tsx` (lines 322-332), import `writeSessionChatContext, type ChatContext` from `@/shared/chat`, type the built object, and replace the raw `sessionStorage.setItem("signalsChatContext", JSON.stringify(context))` with `writeSessionChatContext(context)`:

```typescript
    const context: ChatContext = {
      agent: signal.agent,
      signalId: signal.id,
      contentHash,
      signalHeading: signal.headline,
      recommendation,
      prompt,
      answer: answer ?? undefined,
    };
    writeSessionChatContext(context);
```

In `CustomersPage.tsx` (lines 35-38) and `TrendsTab.tsx` (lines 33-35), replace the `sessionStorage.getItem(...)` + `JSON.parse(stored) as ChatContext` with the shared reader (import `readSessionChatContext` from `@/shared/chat`), e.g.:

```typescript
      const parsed = readSessionChatContext();
      if (parsed?.agent === "profiler") {   // TrendsTab uses "scout"
        setSignalsChatContext(parsed);
      } else {
        setSignalsChatContext(null);
      }
```

(Keep each file's existing `if (stored)` / try-catch structure as the reader now owns the parse + guard; simplify to the above.)

- [ ] **Step 5: Add a round-trip helper test.** Append to `ContextChat.test.tsx`:

```typescript
  it("round-trips a chat context through sessionStorage", () => {
    const ctx = { agent: "scout", prompt: "hi" } as const;
    writeSessionChatContext(ctx);
    expect(readSessionChatContext()).toEqual(ctx);
  });
```

(Import `readSessionChatContext, writeSessionChatContext` from `@/shared/chat` at the top.)

- [ ] **Step 6: Update `README.md` surgically** — change the line(s) naming `SignalsChatContext` to `ChatContext` (lines ~17, 18, 34); no reformat.

- [ ] **Step 7: Verify the symbol is gone, typecheck, test**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && rg -n 'SignalsChatContext' src && npm run typecheck && npx vitest run src/shared/chat --no-file-parallelism`
Expected: `rg` returns nothing (type fully renamed); typecheck green; chat tests PASS.

- [ ] **Step 8: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/shared/chat/ContextChat.tsx src/shared/chat/index.ts src/shared/chat/ChatWithHistory.tsx src/shared/chat/__tests__/ContextChat.test.tsx src/features/customers/components/chat/ProfilerChatWithHistory.tsx src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx src/features/customers/pages/CustomersPage.tsx src/features/market-research/components/trends/TrendsTab.tsx src/features/signals/pages/SignalsPage.tsx
git add frontend/src/shared/chat/ContextChat.tsx frontend/src/shared/chat/index.ts frontend/src/shared/chat/ChatWithHistory.tsx frontend/src/shared/chat/README.md frontend/src/shared/chat/__tests__/ContextChat.test.tsx frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx frontend/src/features/market-research/components/scout-chat/ScoutChatWithHistory.tsx frontend/src/features/customers/pages/CustomersPage.tsx frontend/src/features/market-research/components/trends/TrendsTab.tsx frontend/src/features/signals/pages/SignalsPage.tsx
git commit -m "refactor(fe): rename SignalsChatContext to ChatContext and type the session handoff"
```

---

### Task 13: TD-FE-42 — add one real zod schema at the shared `fetchIcpsRowsForOrg` return

The transport is already shared (both `useICPs` and the customers service call `fetchIcpsRowsForOrg`, typed `Promise<unknown[]>`). Add a permissive-but-real row schema at that single return so a shape change is caught once and both consumers inherit the type. Authored from the consumer field reads (snake + camel alias pairs); `.passthrough()` keeps extras the `any` downstream still reads.

**Files:**
- Modify: `frontend/src/shared/profiler/profileIcpsExtract.ts`
- Modify: `frontend/src/shared/profiler/index.ts`
- Create: `frontend/src/shared/profiler/__tests__/profileIcpsExtract.test.ts`

- [ ] **Step 1: Write the failing schema test.** Create `__tests__/profileIcpsExtract.test.ts` (MSW two-endpoint pattern — `/api/profile/company` empty forces the `/api/customer_profile` fallback where rows are served):

```typescript
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { fetchIcpsRowsForOrg, IcpRowSchema } from "../profileIcpsExtract";

import { server } from "@/test/msw/server";

describe("fetchIcpsRowsForOrg schema", () => {
  it("returns schema-validated rows preserving snake+camel fields", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () =>
        HttpResponse.json({
          icps: [
            { id: "i1", icp_name: "FinTech", company_size: ["50-200"], fit_confidence: "high" },
            { icpId: "i2", name: "Health", buyerRole: ["CFO"], extra: "kept" },
          ],
        }),
      ),
    );
    const rows = await fetchIcpsRowsForOrg("u1", "org1");
    expect(rows).toHaveLength(2);
    expect(IcpRowSchema.array().safeParse(rows).success).toBe(true);
    expect(rows[1]).toMatchObject({ icpId: "i2", extra: "kept" }); // passthrough kept
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/shared/profiler/__tests__/profileIcpsExtract.test.ts --no-file-parallelism`
Expected: FAIL (`IcpRowSchema` is not exported).

- [ ] **Step 3: Add the schema + retype the return.** In `profileIcpsExtract.ts`, add `import { z } from "zod";` at the top, then before `fetchIcpsRowsForOrg`:

```typescript
const stringList = z.union([z.array(z.string()), z.string()]).optional();

/** Real (but tolerant) contract for a Current-ICP row. Every field optional and
 *  aliased snake↔camel because the backend emits both; `.passthrough()` keeps
 *  report-block extras the downstream `any` consumers still read (TD-FE-42). */
export const IcpRowSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    icp_id: z.union([z.string(), z.number()]).optional(),
    icpId: z.union([z.string(), z.number()]).optional(),
    customer_profile_icp_id: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    icp_name: z.string().optional(),
    icpName: z.string().optional(),
    title: z.string().optional(),
    industry: stringList,
    company_size: stringList,
    companySize: stringList,
    buyer_role: stringList,
    buyerRole: stringList,
    location: stringList,
    primary_region: z.string().optional(),
    primaryRegion: z.string().optional(),
    fit_confidence: z.string().optional(),
    fitConfidence: z.string().optional(),
    status: z.string().optional(),
    additional_context: z.string().optional(),
    additionalContext: z.string().optional(),
    accounts_on_watchlist: z.array(z.unknown()).optional(),
    accounts_to_avoid: z.array(z.unknown()).optional(),
    created_at: z.union([z.string(), z.number()]).optional(),
    createdAt: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export type IcpRow = z.infer<typeof IcpRowSchema>;
```

Then change the function signature `export async function fetchIcpsRowsForOrg(uid: string, orgId: string): Promise<unknown[]>` to `Promise<IcpRow[]>`, and parse the rows at each return of real rows — wrap `extractIcpsDataFromFlexibleApiResponse(json)` results:

```typescript
      const rows = IcpRowSchema.array().parse(extractIcpsDataFromFlexibleApiResponse(json));
      if (rows.length > 0) return rows;
```

and the legacy branch `return IcpRowSchema.array().parse(extractIcpsDataFromFlexibleApiResponse(json));`, and the final fallback `return [];` (already `IcpRow[]`-compatible).

- [ ] **Step 4: Export the schema from the barrel.** In `shared/profiler/index.ts`, add `IcpRowSchema`, `fetchIcpsRowsForOrg`, and `type IcpRow` to the exports (extend the existing `export { … } from "./profileIcpsExtract";`).

- [ ] **Step 5: Run tests + typecheck (both consumers inherit the type)**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/shared/profiler/__tests__/profileIcpsExtract.test.ts src/features/mission-control/hooks/__tests__/useICPs.test.tsx src/features/customers/services/__tests__/customers.test.ts --no-file-parallelism && npm run typecheck`
Expected: PASS — `useICPs` data is now `IcpRow[]`, customers service inherits it; downstream `any` consumers still compile.

- [ ] **Step 6: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/shared/profiler/profileIcpsExtract.ts src/shared/profiler/index.ts src/shared/profiler/__tests__/profileIcpsExtract.test.ts
git add frontend/src/shared/profiler/profileIcpsExtract.ts frontend/src/shared/profiler/index.ts frontend/src/shared/profiler/__tests__/profileIcpsExtract.test.ts
git commit -m "feat(fe): add a real zod schema at the shared ICP read boundary"
```

---

# Wave 4 — Small structural (frontend)

> **TD-FE-36 has no code task here.** The hook-promotion + consumer-repoint it asked for is already done (`useCompanyProfile` lives in `@/shared/company-profile`; all consumers import the barrel). Its only residue — the market-research duplicate fetch inside the imperative `smartRefresh` (`useMarketResearchData.ts:2289`) — is blocked by the editable-state↔query coupling the spec defers (TD-FE-19/65) and is **not** widened here (spec §8). It is narrowed in Wave 9 (Task 25).

> **Coupling:** `AgentProfile.tsx` is touched by Task 14 (unify form) and Task 15 (own hook). Do them in order so the form is rewritten once, then its data source changed once.

### Task 14: TD-FE-56 — unify AgentProfile + ScoutDeployment onto one parameterised form

Extract the shared (controlled, presentational) form into `@/shared/agent-config`; both surfaces keep their own state/handlers/submit and render it. **Not** a form framework — one parameterised component for two call sites. Lift the field JSX verbatim from the current `AgentProfile.tsx` (the richer form), parameterising only the divergent bits: the optional `agentName` Select, `readOnly` (drives `disabled` + whether the submit button shows), the accent/title/description copy, and the submit label/handler. Preserve the exact option lists and copy from the current files.

**Files:**
- Create: `frontend/src/shared/agent-config/AgentConfigForm.tsx`
- Create: `frontend/src/shared/agent-config/index.ts`
- Create: `frontend/src/shared/agent-config/__tests__/AgentConfigForm.test.tsx`
- Rewrite: `frontend/src/features/settings/components/AgentProfile.tsx`
- Rewrite: `frontend/src/features/scout/components/ScoutDeployment.tsx`
- Create: `frontend/src/features/settings/components/__tests__/AgentProfile.test.tsx`

- [ ] **Step 1: Write the failing AgentConfigForm test.**

```typescript
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentConfigForm, type AgentConfigValues, type AgentConfigChecks } from "../AgentConfigForm";

const values: AgentConfigValues = {
  agentName: "", assignedTasks: "", domain: "", generalInstructions: "",
  tone: "", autonomyLevel: "", frequency: "",
};
const checks: AgentConfigChecks = {
  leadGeneration: false, customerSupport: false, contentCreation: false,
  dataAnalysis: false, reporting: false,
};

function renderForm(overrides = {}) {
  const props = {
    title: "Agent Profile Settings",
    accent: "purple" as const,
    submitLabel: "Save Agent Profile",
    values, checks,
    onFieldChange: vi.fn(),
    onCheckChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<AgentConfigForm {...props} />) };
}

describe("AgentConfigForm", () => {
  it("renders the heading and the submit button when editable", () => {
    renderForm({ readOnly: false });
    expect(screen.getByText("Agent Profile Settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Agent Profile" })).toBeInTheDocument();
  });
  it("hides the submit button in read-only mode", () => {
    renderForm({ readOnly: true });
    expect(screen.queryByRole("button", { name: "Save Agent Profile" })).not.toBeInTheDocument();
  });
  it("shows the agent-name select only when requested", () => {
    const { rerender } = render(
      <AgentConfigForm title="t" accent="blue" submitLabel="Deploy" values={values} checks={checks}
        onFieldChange={vi.fn()} onCheckChange={vi.fn()} onSubmit={vi.fn()} showAgentNameSelect={false} />,
    );
    expect(screen.queryByText("Agent")).not.toBeInTheDocument();
    rerender(
      <AgentConfigForm title="t" accent="purple" submitLabel="Save" values={values} checks={checks}
        onFieldChange={vi.fn()} onCheckChange={vi.fn()} onSubmit={vi.fn()} showAgentNameSelect />,
    );
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });
  it("fires onFieldChange when the domain input changes", () => {
    const { props } = renderForm({ readOnly: false });
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "fintech" } });
    expect(props.onFieldChange).toHaveBeenCalledWith("domain", "fintech");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/shared/agent-config/__tests__/AgentConfigForm.test.tsx --no-file-parallelism`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `AgentConfigForm.tsx`.** Controlled component. Lift the verbatim field JSX from the current `AgentProfile.tsx` into the body below, replacing `disabled={!isEditMode}` → `disabled={readOnly}`, gating the agentName Select behind `showAgentNameSelect`, and the submit button behind `!readOnly`. Use the exact option lists/labels from the source file. Skeleton to fill:

```typescript
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface AgentConfigValues {
  agentName?: string;
  assignedTasks: string;
  domain: string;
  generalInstructions: string;
  tone: string;
  autonomyLevel: string;
  frequency: string;
}
export interface AgentConfigChecks {
  leadGeneration: boolean;
  customerSupport: boolean;
  contentCreation: boolean;
  dataAnalysis: boolean;
  reporting: boolean;
}
export interface AgentConfigFormProps {
  title: string;
  description?: string;
  accent: "purple" | "blue";
  showAgentNameSelect?: boolean;
  readOnly?: boolean;
  submitLabel: string;
  values: AgentConfigValues;
  checks: AgentConfigChecks;
  onFieldChange: (field: keyof AgentConfigValues, value: string) => void;
  onCheckChange: (item: keyof AgentConfigChecks, checked: boolean) => void;
  onSubmit?: () => void;
}

const TASK_CATEGORIES: { key: keyof AgentConfigChecks; label: string }[] = [
  { key: "leadGeneration", label: "Lead Generation" },
  { key: "customerSupport", label: "Customer Support" },
  { key: "contentCreation", label: "Content Creation" },
  { key: "dataAnalysis", label: "Data Analysis" },
  { key: "reporting", label: "Reporting" },
];

export function AgentConfigForm({
  title, description, accent, showAgentNameSelect = false, readOnly = false,
  submitLabel, values, checks, onFieldChange, onCheckChange, onSubmit,
}: AgentConfigFormProps) {
  const ring = accent === "purple" ? "border-purple-200" : "border-blue-200";
  return (
    <div className={`rounded-lg border ${ring} p-6`}>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground mb-4">{description}</p> : null}

      {showAgentNameSelect ? (
        <div className="mb-4">
          <Label htmlFor="agentName">Agent</Label>
          <Select value={values.agentName} onValueChange={(v) => onFieldChange("agentName", v)} disabled={readOnly}>
            <SelectTrigger id="agentName"><SelectValue placeholder="Select agent" /></SelectTrigger>
            <SelectContent>
              {/* lift the exact <SelectItem>s from AgentProfile.tsx (Scout/Profiler/Strategist/Activator/Presenter) */}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="mb-4">
        <Label htmlFor="domain">Domain</Label>
        <Input id="domain" value={values.domain} onChange={(e) => onFieldChange("domain", e.target.value)} disabled={readOnly} />
      </div>

      {/* tone / autonomyLevel / frequency Selects — lift verbatim from AgentProfile.tsx, each:
          value={values.X} onValueChange={(v) => onFieldChange("X", v)} disabled={readOnly} */}

      <div className="mb-4">
        <Label htmlFor="assignedTasks">Assigned Tasks</Label>
        <Textarea id="assignedTasks" rows={3} value={values.assignedTasks}
          onChange={(e) => onFieldChange("assignedTasks", e.target.value)} disabled={readOnly} />
      </div>

      <div className="mb-4">
        <Label>Task Categories</Label>
        <div className="grid grid-cols-2 gap-2">
          {TASK_CATEGORIES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2">
              <Checkbox checked={checks[key]} disabled={readOnly}
                onCheckedChange={(c) => onCheckChange(key, c === true)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <Label htmlFor="generalInstructions">General Instructions</Label>
        <Textarea id="generalInstructions" rows={4} value={values.generalInstructions}
          onChange={(e) => onFieldChange("generalInstructions", e.target.value)} disabled={readOnly} />
      </div>

      {!readOnly ? (
        <Button onClick={onSubmit}>{submitLabel}</Button>
      ) : null}
    </div>
  );
}
```

Create the barrel `index.ts`:

```typescript
export {
  AgentConfigForm,
  type AgentConfigValues,
  type AgentConfigChecks,
  type AgentConfigFormProps,
} from "./AgentConfigForm";
```

- [ ] **Step 4: Run the AgentConfigForm test to green**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/shared/agent-config/__tests__/AgentConfigForm.test.tsx --no-file-parallelism`
Expected: PASS. (If `getByLabelText("Domain")` fails, ensure the `<Label htmlFor>` matches the `<Input id>`.)

- [ ] **Step 5: Rewrite `AgentProfile.tsx` to render the shared form.** Keep its props (`onProfileUpdate`, `isEditMode`, `profileData`), its `formData`/`checkedItems` state, the `profileData`-seeding `useEffect`, `handleInputChange`/`handleCheckboxChange`, and `handleSave` (the `POST /api/profile/agent_name` + reset + `onProfileUpdate?.()`). Replace the entire render JSX with:

```tsx
  return (
    <AgentConfigForm
      title="Agent Profile Settings"
      accent="purple"
      showAgentNameSelect
      readOnly={!isEditMode}
      submitLabel="Save Agent Profile"
      values={formData}
      checks={checkedItems}
      onFieldChange={(field, value) => handleInputChange(field as keyof typeof formData, value)}
      onCheckChange={(item, checked) => handleCheckboxChange(item as keyof typeof checkedItems, checked)}
      onSubmit={handleSave}
    />
  );
```

(Import `AgentConfigForm`, `type AgentConfigValues`, `type AgentConfigChecks` from `@/shared/agent-config`; type `formData` as `AgentConfigValues` and `checkedItems` as `AgentConfigChecks`.)

- [ ] **Step 6: Rewrite `ScoutDeployment.tsx` similarly** (no props; keep `formData`/`checkedItems`/handlers/`handleDeploy` stub):

```tsx
  return (
    <AgentConfigForm
      title="Deploy Scout Agent"
      accent="blue"
      submitLabel="Deploy Scout"
      values={formData}
      checks={checkedItems}
      onFieldChange={(field, value) => handleInputChange(field as keyof typeof formData, value)}
      onCheckChange={(item, checked) => handleCheckboxChange(item as keyof typeof checkedItems, checked)}
      onSubmit={handleDeploy}
    />
  );
```

- [ ] **Step 7: Add an AgentProfile render test.** Create `settings/components/__tests__/AgentProfile.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentProfile } from "../AgentProfile";

describe("AgentProfile", () => {
  it("renders the agent profile form heading", () => {
    render(<AgentProfile isEditMode={false} onProfileUpdate={vi.fn()} />);
    expect(screen.getByText("Agent Profile Settings")).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Verify both surfaces, typecheck, lint**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/shared/agent-config src/features/settings/components/__tests__/AgentProfile.test.tsx src/features/scout/pages/__tests__/ScoutDeploymentPage.test.tsx --no-file-parallelism && npm run typecheck && npx eslint src/shared/agent-config src/features/settings/components/AgentProfile.tsx src/features/scout/components/ScoutDeployment.tsx`
Expected: PASS (shared form + both surfaces render; ScoutDeploymentPage smoke still green).

- [ ] **Step 9: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/shared/agent-config/AgentConfigForm.tsx src/shared/agent-config/index.ts src/shared/agent-config/__tests__/AgentConfigForm.test.tsx src/features/settings/components/AgentProfile.tsx src/features/scout/components/ScoutDeployment.tsx src/features/settings/components/__tests__/AgentProfile.test.tsx
git add frontend/src/shared/agent-config/ frontend/src/features/settings/components/AgentProfile.tsx frontend/src/features/scout/components/ScoutDeployment.tsx frontend/src/features/settings/components/__tests__/AgentProfile.test.tsx
git commit -m "refactor(fe): unify AgentProfile and ScoutDeployment onto a shared AgentConfigForm"
```

---

### Task 15: TD-FE-11 — give UserProfile + AgentProfile their own query hooks; drop the orphan company fetch

`CompanyProfile` already self-fetches via `useCompanyProfile`, so `fetchProfileData("company")` in SettingsPage is a wasted GET. Migrate `UserProfile` and `AgentProfile` onto their own user-id-scoped query hooks, then delete the `fetchProfileData` orphan + the shared `profileData` prop flow.

**Files:**
- Create: `frontend/src/features/settings/services/profile.ts` (shared `fetchOwnProfile`)
- Create: `frontend/src/features/settings/hooks/useUserProfile.ts`
- Create: `frontend/src/features/settings/hooks/useAgentProfile.ts`
- Modify: `frontend/src/shared/api/queryKeys.ts` (add `userProfile`, `agentProfile`)
- Modify: `frontend/src/features/settings/components/UserProfile.tsx`
- Modify: `frontend/src/features/settings/components/AgentProfile.tsx`
- Modify: `frontend/src/features/settings/pages/SettingsPage.tsx`
- Create: `frontend/src/features/settings/hooks/__tests__/useUserProfile.test.tsx`

- [ ] **Step 1: Write the failing hook test.** Create `hooks/__tests__/useUserProfile.test.tsx` (MSW; the hook reads `/api/profile/user?user_id=`):

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useUserProfile } from "../useUserProfile";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useUserProfile", () => {
  it("returns the profile when it belongs to the user", async () => {
    server.use(
      http.get("/api/profile/user", () => HttpResponse.json({ user_id: "u1", name: "Ada" })),
    );
    const { result } = renderHook(() => useUserProfile("u1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("Ada");
  });

  it("is disabled without a userId", () => {
    const { result } = renderHook(() => useUserProfile(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/settings/hooks/__tests__/useUserProfile.test.tsx --no-file-parallelism`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the shared read + the two hooks.** `services/profile.ts` encapsulates the existing `fetchProfileData` ownership logic (preserves behavior):

```typescript
import type { UntypedBackendProfile } from "@/shared/types/escape-hatches";

/** GET /api/profile/{type}?user_id= with the SettingsPage ownership check.
 *  Returns null when the profile belongs to another user (TD-FE-11). */
export async function fetchOwnProfile(
  profileType: "user" | "agent_name",
  userId: string,
): Promise<UntypedBackendProfile | null> {
  const res = await fetch(`/api/profile/${profileType}?user_id=${encodeURIComponent(userId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as UntypedBackendProfile;
  if (data?.user_id && data.user_id !== userId) return null;
  if (!data?.user_id) return { ...data, user_id: userId };
  return data;
}
```

`hooks/useUserProfile.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";

import { qk } from "@/shared/api/queryKeys";

import { fetchOwnProfile } from "../services/profile";

export function useUserProfile(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.userProfile(userId ?? ""),
    enabled: enabled && !!userId,
    queryFn: () => fetchOwnProfile("user", userId as string),
  });
}
```

`hooks/useAgentProfile.ts` (identical shape, `"agent_name"` + `qk.agentProfile`). Add `userProfile` / `agentProfile` key factories to `qk` in `queryKeys.ts` (mirror the existing factory style, e.g. `userProfile: (userId: string) => ["userProfile", userId] as const`).

- [ ] **Step 4: Migrate UserProfile + AgentProfile onto their hooks.** In `UserProfile.tsx`, replace the `profileData` prop dependence: call `const { data: profileData } = useUserProfile(currentUser?.uid)` (get `currentUser` via `useAuth`), keep the existing `useEffect([profileData])` that seeds `formData`. Remove `profileData` from the destructured props (keep `onProfileUpdate`, `isEditMode`). In `AgentProfile.tsx`, do the same with `useAgentProfile(currentUser?.uid)` (its `useEffect` already seeds `formData`/`checkedItems` from `profileData`; just source `profileData` from the hook instead of the prop). Remove `profileData` from both prop interfaces.

- [ ] **Step 5: Drop the orphan fetch + prop flow in SettingsPage.** Remove `fetchProfileData` (lines 37-85), its call sites (`handleProfileChange`, the user-change `useEffect`), the `profileData`/`loading` state if now unused, and drop `profileData` from `commonProps` (lines 148-152) so the three components render with only `isEditMode` + `onProfileUpdate`. `CompanyProfile` already ignores `profileData`.

- [ ] **Step 6: Run to verify + no stray company GET**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/settings --no-file-parallelism && npm run typecheck`
Expected: PASS. (Because MSW is `onUnhandledRequest:"error"`, if SettingsPage still fired `GET /api/profile/company` a mounted-SettingsPage test would error — confirming the orphan is gone. If no SettingsPage test mounts it, rely on the grep: `rg -n 'fetchProfileData|profile/company' src/features/settings/pages/SettingsPage.tsx` → no matches.)

- [ ] **Step 7: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/settings/services/profile.ts src/features/settings/hooks/useUserProfile.ts src/features/settings/hooks/useAgentProfile.ts src/features/settings/hooks/__tests__/useUserProfile.test.tsx src/shared/api/queryKeys.ts src/features/settings/components/UserProfile.tsx src/features/settings/components/AgentProfile.tsx src/features/settings/pages/SettingsPage.tsx
git add frontend/src/features/settings/services/profile.ts frontend/src/features/settings/hooks/useUserProfile.ts frontend/src/features/settings/hooks/useAgentProfile.ts frontend/src/features/settings/hooks/__tests__/useUserProfile.test.tsx frontend/src/shared/api/queryKeys.ts frontend/src/features/settings/components/UserProfile.tsx frontend/src/features/settings/components/AgentProfile.tsx frontend/src/features/settings/pages/SettingsPage.tsx
git commit -m "refactor(fe): self-fetch user/agent profiles and drop the orphan settings company GET"
```

---

# Wave 5 — Signal↔lead-map (frontend)

### Task 16: TD-FE-72 — surface a recompute control that sends `refresh:true`

`fetchSignalLeadMap` already accepts `{ refresh }`; the hook always sends `false` and exposes no refetch handle. Widen the hook with a `refresh()` callback and wire a button on the SignalsPage. MSW-testable now; dormant in prod until `/signal-lead-map_claude` deploys (same gate as TD-FE-73).

**Files:**
- Modify: `frontend/src/features/signals/hooks/useSignalLeadMap.ts`
- Modify: `frontend/src/features/signals/pages/SignalsPage.tsx`
- Modify: `frontend/src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx`

- [ ] **Step 1: Write the failing refresh test.** Append to `useSignalLeadMap.test.tsx` (it already wraps in a QueryClient + mocks auth):

```typescript
  it("sends refresh:true when refresh() is invoked", async () => {
    let lastBody: unknown;
    server.use(
      http.post("/api/signal-lead-map_claude", async ({ request }) => {
        lastBody = await request.json();
        return HttpResponse.json({ mapping: [], generated_at: "t", cached: false });
      }),
    );
    const { result } = renderHook(() => useSignalLeadMap("org1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.refresh();
    });
    expect(lastBody).toMatchObject({ refresh: true });
  });
```

(Import `act` from `@testing-library/react` and `http`/`HttpResponse` from `msw` if not already imported; match the response shape to `SignalLeadMapResponseSchema`.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx --no-file-parallelism`
Expected: FAIL (`result.current.refresh` is not a function).

- [ ] **Step 3: Add the `refresh` callback to the hook.** In `useSignalLeadMap.ts`, import `useQueryClient` + `useCallback`, and after the `useQuery` add:

```typescript
  const queryClient = useQueryClient();
  const refresh = useCallback(async () => {
    if (!orgId || !userId) return;
    const data = await fetchSignalLeadMap(userId, orgId, { refresh: true });
    queryClient.setQueryData(qk.signalLeadMap(orgId, userId), data);
  }, [orgId, userId, queryClient]);
```

Add `refresh` to the returned object (alongside `signalsForLead`, `leadsForSignal`, `isLoading`, `isError`). The derived `signalsForLead`/`leadsForSignal` recompute from the updated query data.

- [ ] **Step 4: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx --no-file-parallelism && npm run typecheck`
Expected: PASS (the POST body carried `refresh:true`).

- [ ] **Step 5: Wire the button on SignalsPage.** In `SignalsPage.tsx`, change `const { leadsForSignal } = useSignalLeadMap(orgId);` to also destructure `refresh`, and add a small control near the existing header refresh (e.g. a `<Button variant="outline" size="sm" onClick={() => refresh()}>Recompute lead mapping</Button>`). Keep it unobtrusive; it's dormant until the endpoint deploys. **Deliberately no `disabled`/loading/error UX:** `/signal-lead-map_claude` is not deployed (TD-FE-73), so a click is a no-op/error today; at 0 users that is harmless, and adding graceful-degradation chrome to a dormant control is YAGNI. The hardening trigger is recorded, not done here — when the endpoint ships (TD-FE-73 pull-forward), add `disabled`/`isFetching`/error states then.

- [ ] **Step 6: Typecheck + build + format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npm run build && npx prettier --check src/features/signals/hooks/useSignalLeadMap.ts src/features/signals/pages/SignalsPage.tsx src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx
git add frontend/src/features/signals/hooks/useSignalLeadMap.ts frontend/src/features/signals/pages/SignalsPage.tsx frontend/src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx
git commit -m "feat(fe): add a recompute control that busts the signal-lead-map cache"
```

---

# Wave 6 — Pagination / routing (frontend)

### Task 17: TD-FE-67 — type `total` and surface it from the v2 reads

Type `total`/`limit`/`offset` on `paginatedSchema` (they're on the wire but stripped by `.passthrough()`), then carry `total` out of the three reads. The object-returning reads (`fetchSignals`, `fetchSuggestedIcps`) get a `total` field; `fetchDataSources` keeps its bare-array consumer unaffected via a `select` in `useDataSources`.

**Files:**
- Modify: `frontend/src/shared/api/pagination.ts`
- Modify: `frontend/src/features/signals/services/signals.ts`
- Modify: `frontend/src/features/customers/services/customers.ts`
- Modify: `frontend/src/features/mission-control/services/missionControl.ts`
- Modify: `frontend/src/features/mission-control/hooks/useDataSources.ts`
- Modify: the three service test files

- [ ] **Step 1: Write the failing service tests.** In `signals/services/__tests__/signals.test.ts` (the `fetchSignals` fixture already carries `total: 2`), add:

```typescript
  it("surfaces total from the v2 envelope", async () => {
    const res = await fetchSignals("u1");
    expect(res.total).toBe(2);
  });
```

In `customers/services/__tests__/customers.test.ts` (fixture has `total`), add the analogous `expect((await fetchSuggestedIcps("u1")).total).toBe(<fixtureTotal>)`. In `mission-control/services/__tests__/missionControl.test.ts`, assert the pinned object shape unconditionally: `const res = await fetchDataSources(<existing args>); expect(Array.isArray(res.items)).toBe(true); expect(typeof res.total).toBe("number");` — this fails today because `fetchDataSources` returns a bare array (so `res.items`/`res.total` are `undefined`). Migrate any existing assertion that treats `fetchDataSources`'s result as an array to read `res.items`.

- [ ] **Step 2: Run to verify the new assertions fail**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/signals/services/__tests__/signals.test.ts src/features/customers/services/__tests__/customers.test.ts --no-file-parallelism`
Expected: FAIL (`res.total` is `undefined`).

- [ ] **Step 3: Type `total` + surface it.** In `pagination.ts`, widen the schema:

```typescript
export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      items: z.array(item).default([]),
      total: z.number().default(0),
      limit: z.number().optional(),
      offset: z.number().optional(),
    })
    .passthrough();
```

In `signals.ts`, change `fetchSignals` to return `{ signals: env.items, total: env.total }` and widen its return type (e.g. `Promise<{ signals: unknown[]; total: number }>`). In `customers.ts`, change `fetchSuggestedIcps`'s return to include `total`: `return { ...SuggestedIcpsResponseSchema.parse({ suggestedICPs: env.items }), total: env.total };` and widen the declared return type with `& { total: number }`. For `fetchDataSources` in `missionControl.ts`, **pinned decision: return `{ items, total }`** (uniform with the other two reads) and add **`select: (env) => env.items`** to `useDataSources` so the hook's `.data` stays an array — `useDocumentSync` (Task 8) and the hook's other consumers are unaffected, and since `useDataSources` is the service's only direct caller the shape change is contained. Update any existing `missionControl.test.ts` assertion that treated the result as an array to read `res.items`.

- [ ] **Step 4: Run to verify + typecheck**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/signals/services src/features/customers/services src/features/mission-control/services src/features/mission-control/hooks --no-file-parallelism && npm run typecheck`
Expected: PASS (total surfaced; existing `.signals`/`.suggestedICPs`/array consumers unaffected).

- [ ] **Step 5: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/shared/api/pagination.ts src/features/signals/services/signals.ts src/features/customers/services/customers.ts src/features/mission-control/services/missionControl.ts src/features/mission-control/hooks/useDataSources.ts
git add frontend/src/shared/api/pagination.ts frontend/src/features/signals/services/signals.ts frontend/src/features/customers/services/customers.ts frontend/src/features/mission-control/services/missionControl.ts frontend/src/features/mission-control/hooks/useDataSources.ts frontend/src/features/signals/services/__tests__/signals.test.ts frontend/src/features/customers/services/__tests__/customers.test.ts frontend/src/features/mission-control/services/__tests__/missionControl.test.ts
git commit -m "feat(fe): type and surface paginated total from the v2 reads"
```

---

### Task 18: TD-FE-70 — add a Lead Stream pager (load more)

Apply the TD-FE-67 pattern to `fetchLeads` (carry `total`), switch `useLeads` to `useInfiniteQuery`, and add a "Load more" button to `LeadStream` that appends the next page via v2 `limit`/`offset`. First-page behavior is unchanged when there are ≤50 leads.

**Files:**
- Modify: `frontend/src/shared/api/pagination.ts` (add `pageParams`)
- Modify: `frontend/src/features/customers/services/leads.ts`
- Modify: `frontend/src/features/customers/hooks/useLeads.ts`
- Modify: `frontend/src/features/customers/components/lead-stream/LeadStream.tsx`
- Modify: `frontend/src/features/customers/services/__tests__/leads.test.ts`

- [ ] **Step 1: Write the failing service test.** In `leads.test.ts`, add an offset-paging assertion (capture the request URL, as `signals.test.ts` does):

```typescript
  it("requests the given page offset and surfaces total", async () => {
    let seenUrl = "";
    server.use(
      http.get("/api/v2/leads", ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({ items: [{ lead_id: "l9" }], total: 120, limit: 50, offset: 50 });
      }),
    );
    const page = await fetchLeads("org1", 50);
    expect(seenUrl).toContain("offset=50");
    expect(page.total).toBe(120);
    expect(page.items).toHaveLength(1);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/customers/services/__tests__/leads.test.ts --no-file-parallelism`
Expected: FAIL (`fetchLeads` takes no offset; returns a bare array with no `.total`).

- [ ] **Step 3: Add `pageParams` + page `fetchLeads`.** In `pagination.ts`:

```typescript
export const pageParams = (limit: number, offset: number) => `limit=${limit}&offset=${offset}`;
```

Rewrite `fetchLeads` to take an offset and return a page:

```typescript
export async function fetchLeads(
  orgId: string,
  offset = 0,
  limit = 50,
): Promise<{ items: CustomerLead[]; total: number }> {
  const env = await apiGet(
    `v2/leads?org_id=${encodeURIComponent(orgId)}&${pageParams(limit, offset)}`,
    paginatedSchema(RawLeadSchema),
  );
  return { items: (env.items ?? []).map(mapRawLead), total: env.total };
}
```

(Import `pageParams` from `@/shared/api/pagination`.)

- [ ] **Step 4: Switch `useLeads` to infinite.** First grep consumers (`rg -n 'useLeads' src` — confirm `LeadStream` is the only one). Then:

```typescript
import { useInfiniteQuery } from "@tanstack/react-query";

import { qk } from "@/shared/api/queryKeys";

import { fetchLeads } from "../services/leads";

const PAGE = 50;

export function useLeads(orgId?: string | null) {
  return useInfiniteQuery({
    queryKey: qk.leads(orgId ?? ""),
    enabled: !!orgId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchLeads(orgId as string, pageParam as number, PAGE),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    retry: false,
  });
}
```

- [ ] **Step 5: Render the pager in `LeadStream.tsx`.** Flatten pages and add the button. Replace `const leads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);` with:

```tsx
  const leads = useMemo(
    () => leadsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [leadsQuery.data],
  );
  const total = leadsQuery.data?.pages[0]?.total ?? leads.length;
```

Update the header badge `{leads.length} leads` → `{leads.length} of {total} leads`. After the `</Table>` (before `</CardContent>`), add:

```tsx
          {leadsQuery.hasNextPage ? (
            <div className="flex justify-center p-2">
              <Button variant="outline" size="sm" disabled={leadsQuery.isFetchingNextPage}
                onClick={() => leadsQuery.fetchNextPage()}>
                {leadsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
```

(Import `Button` from `@/components/ui/button` if not already.)

- [ ] **Step 6: Run to verify + existing LeadStream tests**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/customers/services/__tests__/leads.test.ts src/features/customers/components/lead-stream --no-file-parallelism && npm run typecheck`
Expected: PASS — the existing `LeadStream.test.tsx` / `LeadStream.sourceFilter.test.tsx` still green (one page → `hasNextPage` false → no button; first-page behavior unchanged). Add a pager-append test if the existing handler returns `total > items.length`.

- [ ] **Step 7: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/shared/api/pagination.ts src/features/customers/services/leads.ts src/features/customers/hooks/useLeads.ts src/features/customers/components/lead-stream/LeadStream.tsx src/features/customers/services/__tests__/leads.test.ts
git add frontend/src/shared/api/pagination.ts frontend/src/features/customers/services/leads.ts frontend/src/features/customers/hooks/useLeads.ts frontend/src/features/customers/components/lead-stream/LeadStream.tsx frontend/src/features/customers/services/__tests__/leads.test.ts
git commit -m "feat(fe): paginate the Lead Stream with a load-more affordance"
```

---

### Task 19: TD-FE-68 (partial) — route the two non-streaming callsites through `/api`

Migrate `/ask` (AIPromptingInterface) and `/profile/company` (RegulatoryComplianceSection) off the direct `BACKEND_BASE_URL` onto the `/api` proxy. The two streaming `/chat/` callsites (`ChatWithScout.tsx:92`, `StrategistWorkspace.tsx:856`) stay deferred (need an SSE-aware `/api` transport — Spec 41).

**Files:**
- Modify: `frontend/src/features/market-research/components/AIPromptingInterface.tsx` (line 6 import, line 216 URL)
- Modify: `frontend/src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx` (line 15 import, line 585 URL)

> **Stale line numbers (cross-wave):** `RegulatoryComplianceSection.tsx` was already edited by Tasks 3 and 6 (Wave 1), which delete/inline ~100 lines *above* `line 585` — so the `profileUrl` cite has moved up; `line 15` (the import) precedes those edits and is stable. Re-grep `profileUrl` and `BACKEND_BASE_URL` here rather than trusting the numbers. (`AIPromptingInterface.tsx` is touched only by this task, so its line cites are current.)

- [ ] **Step 1: Migrate `/ask`.** In `AIPromptingInterface.tsx`, replace the import `import { BACKEND_BASE_URL } from "@/shared/api/transport";` (line 6) with `import { buildApiUrl } from "@/shared/api/transport";`, and the URL (line 216) `const url = \`${BACKEND_BASE_URL}/ask?${params.toString()}\`;` with:

```typescript
      const url = buildApiUrl(`ask?${params.toString()}`);
```

(Keep the `console.log`/`fetch`/headers/error-handling below unchanged — minimal behavior-preserving swap.)

- [ ] **Step 2: Migrate `/profile/company`.** In `RegulatoryComplianceSection.tsx`, change line 585 `const profileUrl = \`${BACKEND_BASE_URL}/profile/company?org_id=${orgIdToUse}\`;` to:

```typescript
          const profileUrl = `/api/profile/company?org_id=${orgIdToUse}`;
```

Then remove the now-unused `import { BACKEND_BASE_URL } from "@/shared/api/transport";` (line 15) **only if** no other `BACKEND_BASE_URL` use remains in the file (`rg -n BACKEND_BASE_URL src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx`).

- [ ] **Step 3: Typecheck + build + lint + regulatory tests**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx eslint src/features/market-research/components/AIPromptingInterface.tsx src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx && npx vitest run src/features/market-research/components/intelligence/regulatory-compliance --no-file-parallelism && npm run build`
Expected: PASS. (If a test mounts `AIPromptingInterface` and now hits `/api/ask`, add `http.get("/api/ask", () => HttpResponse.json({}))` to `src/test/msw/handlers.ts`.)

- [ ] **Step 4: Live smoke (optional, recommended).** With the dev proxy running, confirm the migrated `/ask` and `/profile/company` calls return 200 through `/api` (the proxy targets the Render URL). Record in the Wave-0 note.

- [ ] **Step 5: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/market-research/components/AIPromptingInterface.tsx src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx
git add frontend/src/features/market-research/components/AIPromptingInterface.tsx frontend/src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx
git commit -m "refactor(fe): route /ask and /profile/company through the /api proxy"
```

---

# Wave 7 — Coherence (frontend)

### Task 20: TD-FE-25 — make read-only Strategic Recommendations honor local edits

Wave-0 finding: `localStrategicRecommendations` is purely ephemeral (no persist callback/localStorage). In-scope fix = read-only fallback alignment only (the `ExecutiveSummarySection` `local || data || default` pattern). `localStrategicRecommendations` is parent state seeded on entering edit and NOT reset on exit, so reading it local-first in the read-only branch makes edits survive edit→exit. **Cross-refresh persistence is explicitly out of scope** (would ripple — spec §8).

**Files:**
- Modify: `frontend/src/features/market-research/components/intelligence/regulatory-compliance/StrategicRecommendationsSection.tsx`
- Modify: `frontend/src/features/market-research/components/intelligence/regulatory-compliance/__tests__/StrategicRecommendationsSection.test.tsx`

- [ ] **Step 1: Write the failing test.** Append to `StrategicRecommendationsSection.test.tsx` (uses `buildProps()`, `fireEvent`, `render`, `screen`):

```typescript
  it("shows local edits in read-only mode (survives exiting edit)", () => {
    render(
      <StrategicRecommendationsSection
        {...buildProps({
          isEditing: false,
          localStrategicRecommendations: {
            mitigateRegulatoryRisks: ["Edited mitigation step"],
            competitivePositioning: [],
            goToMarketStrategy: [],
          },
          regulatoryData: {
            strategicRecommendations: { mitigateRegulatoryRisks: ["API value, should be overridden"] },
          },
        })}
      />,
    );
    expect(screen.getByText(/Edited mitigation step/)).toBeInTheDocument();
    expect(screen.queryByText(/API value, should be overridden/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/market-research/components/intelligence/regulatory-compliance/__tests__/StrategicRecommendationsSection.test.tsx --no-file-parallelism`
Expected: FAIL — the read-only branch reads `regulatoryData?.strategicRecommendations` and ignores `localStrategicRecommendations`, so the API value renders.

- [ ] **Step 3: Align the read-only branch.** In `StrategicRecommendationsSection.tsx`, add a helper at the top of the component body:

```typescript
  // Read-only: prefer in-session edits, then API, then defaults — matching the
  // ExecutiveSummarySection `local || data || default` chain (TD-FE-25).
  const readField = (key: "mitigateRegulatoryRisks" | "competitivePositioning" | "goToMarketStrategy"):
    string[] | undefined => {
    const local = localStrategicRecommendations?.[key];
    if (Array.isArray(local) && local.length > 0) return local;
    return regulatoryData?.strategicRecommendations?.[key];
  };
```

Then in the read-only return (lines ~346-413), replace each `regulatoryData?.strategicRecommendations?.X ? regulatoryData.strategicRecommendations.X.map(...) : <hardcoded>` block with a `readField("X")`-driven one, keeping the same hardcoded default when `readField` is empty, e.g.:

```tsx
                {readField("mitigateRegulatoryRisks")?.length ? (
                  readField("mitigateRegulatoryRisks")!.map(
                    (item: string, index: number) => <li key={index}>• {item}</li>,
                  )
                ) : (
                  <>
                    <li>• Implement privacy by design principles</li>
                    <li>• Establish automated compliance monitoring</li>
                    <li>• Regular risk assessments and audits</li>
                    <li>• Cross-functional compliance team</li>
                  </>
                )}
```

Apply the same to `competitivePositioning` (~373-386) and `goToMarketStrategy` (~400-413), keeping each block's existing hardcoded defaults.

- [ ] **Step 4: Run to verify it passes + the rest of the file's tests**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/market-research/components/intelligence/regulatory-compliance/__tests__/StrategicRecommendationsSection.test.tsx --no-file-parallelism && npm run typecheck`
Expected: PASS (local edits win in read-only; the editing-mode behavior and defaults are unchanged).

- [ ] **Step 5: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/market-research/components/intelligence/regulatory-compliance/StrategicRecommendationsSection.tsx src/features/market-research/components/intelligence/regulatory-compliance/__tests__/StrategicRecommendationsSection.test.tsx
git add frontend/src/features/market-research/components/intelligence/regulatory-compliance/StrategicRecommendationsSection.tsx frontend/src/features/market-research/components/intelligence/regulatory-compliance/__tests__/StrategicRecommendationsSection.test.tsx
git commit -m "fix(fe): show local strategic-recommendation edits in read-only mode"
```

---

# Wave 8 — Test / tooling (frontend; additive, advisory)

### Task 21: TD-FE-20 — extend the MR journey to the trends + analysis tabs

The journey is a smoke test on the intelligence tab only. Add tab clicks (Radix `role="tab"`, selected by label) and assert each surface appears. No VR (the author deliberately omitted it for this 14k-LOC page — keep DOM/role assertions).

**Files:**
- Modify: `frontend/e2e/journeys/04-market-research-5-components.spec.ts`

- [ ] **Step 1: Add the two tab steps.** After the existing intelligence smoke assertion, append (inside the same `test(...)`):

```typescript
  await test.step("Chat with Scout (trends) tab renders the scout-chat surface", async () => {
    await page.getByRole("tab", { name: "Chat with Scout" }).click();
    await expect(page.getByRole("tab", { name: "Chat with Scout" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Pin a stable element rendered by TrendsTab (the scout-chat surface). Confirm the
    // exact text/role against the running app and replace if needed.
    await expect(page.getByText(/scout/i).first()).toBeVisible();
  });

  await test.step("Your Lead Stream (analysis) tab renders the lead stream", async () => {
    await page.getByRole("tab", { name: "Your Lead Stream" }).click();
    await expect(page.getByRole("tab", { name: "Your Lead Stream" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText(/lead/i).first()).toBeVisible();
  });
```

- [ ] **Step 2: Run the journey**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx playwright test e2e/journeys/04-market-research-5-components.spec.ts`
Expected: PASS — both tabs click, become `aria-selected`, and their surfaces are visible. If a `getByText` matcher is too broad/narrow, pin it to a stable element from the running TrendsTab / lead-stream and re-run.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/journeys/04-market-research-5-components.spec.ts
git commit -m "test(fe): cover the market-research trends and analysis tabs in e2e"
```

---

### Task 22: TD-FE-52 — add a strategist Playwright journey + VR baseline

Strategist has only Vitest render tests. Add a journey at `/your-ai-team/strategist/workspace`. `StrategistWorkspace` only renders when `context.leads` is non-empty (hydrated from `sessionStorage.strategistContext` on mount), so **seed it via `addInitScript` before navigating**. VR the two-panel workspace, masking dynamic timestamps/animations.

**Files:**
- Create: `frontend/e2e/journeys/08-strategist-workspace.spec.ts`
- Create: `frontend/e2e/journeys/08-strategist-workspace.spec.ts-snapshots/` (generated baselines)

- [ ] **Step 1: Write the journey spec.** Model `e2e/journeys/05-icp-create.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

import { installApiMocks, installCatchAllApiMock } from "../fixtures/api-mocks";
import { maskDynamic } from "../helpers/mask-dynamic";
import { loginAsTestUser } from "../helpers/login";

test("strategist workspace renders with a seeded lead context", async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  // StrategistWorkspace only mounts when context.leads is non-empty (hydrated from
  // sessionStorage.strategistContext on mount, then removed). Seed before navigation.
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "strategistContext",
      JSON.stringify({
        leads: [{ id: "l1", name: "Acme Co", company: "Acme", industry: "SaaS" }],
        source: "e2e",
      }),
    );
  });

  await test.step("navigate to the strategist workspace", async () => {
    await page.goto("/your-ai-team/strategist/workspace");
    await expect(page).not.toHaveURL(/\/login/);
  });

  await test.step("two-panel workspace + chat render", async () => {
    await expect(page.getByText("Chat with Strategist")).toBeVisible();
    await expect(page).toHaveScreenshot("08-strategist-workspace.png", {
      mask: maskDynamic(page),
    });
  });
});
```

(Confirm the seeded `StrategistContext`/`LeadContext` shape against `frontend/src/features/strategist/types.ts` + `StrategistWorkspace.tsx:33-49`. If the chat panel's relative timestamps/`Math.random()` task numbers still cause diff churn, screenshot the static left dashboard region instead of the full page, or extend `maskDynamic`.)

- [ ] **Step 2: Generate the VR baseline** (pixel-stable only in the Playwright Docker image):

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run test:e2e:update-snapshots -- e2e/journeys/08-strategist-workspace.spec.ts`
Expected: creates `e2e/journeys/08-strategist-workspace.spec.ts-snapshots/08-strategist-workspace-chromium-linux-linux.png`.

- [ ] **Step 3: Run the journey against the committed baseline**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx playwright test e2e/journeys/08-strategist-workspace.spec.ts`
Expected: PASS (functional assertions + a stable VR match). Re-run twice to confirm non-flaky before committing.

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/journeys/08-strategist-workspace.spec.ts frontend/e2e/journeys/08-strategist-workspace.spec.ts-snapshots/
git commit -m "test(fe): add a strategist workspace Playwright journey and VR baseline"
```

---

### Task 23: TD-FE-29 — harden the VR e2e against cross-worktree contention

Config-only hardening (the `preflight`→`preflight:par` flip stays a documented follow-up, NOT made here). Add Playwright retries under contention + a screenshot-stabilization timeout; optionally lower the global heavy-phase slot count.

**Files:**
- Modify: `frontend/playwright.config.ts`
- Optionally modify: `frontend/scripts/with-slot.mjs`

- [ ] **Step 1: Add contention-aware retries.** In `playwright.config.ts`, change `retries: 0` (line 30) to:

```typescript
  retries: process.env.PREFLIGHT_CONTENDED ? 2 : 0,
```

(`with-slot.mjs` already exports `PREFLIGHT_CONTENDED=1` when a heavy phase had to wait for a slot — and the config already drops to 2 workers in that case. Retries stay 0 on an idle box to keep clean runs fast and honest.)

- [ ] **Step 2: Add a screenshot stabilization timeout.** In the `expect.toHaveScreenshot` block (lines ~75-79), add a `timeout`:

```typescript
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: "disabled",
      timeout: 15_000,
    },
```

- [ ] **Step 3 (optional): Serialize heavy phases box-wide.** If the repro below still flakes, lower the global slot default in `with-slot.mjs` (line 54) from `|| 2` to `|| 1` (forces build/vitest/playwright fully serial across worktrees). Prefer leaving it at 2 unless the repro proves it necessary.

- [ ] **Step 4: Verify against a defined contention reproduction (Accept: 3/3).** With a second worktree's `npm run preflight` running concurrently, run the VR specs under the parallel runner at box core-count three times:

Run (3×): `cd /projects/Brewra/brewra-gtm-intelligence/frontend && PREFLIGHT_JOBS=$(nproc) PREFLIGHT_CONTENDED=1 npx playwright test e2e/journeys e2e/stubs`
Expected: the VR specs PASS **3/3 consecutive runs**. If any run flakes, apply Step 3 and re-verify 3/3.

- [ ] **Step 5: Commit** (note the deferred flip in the body)

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check playwright.config.ts
git add frontend/playwright.config.ts
# include scripts/with-slot.mjs only if Step 3 was applied
git commit -m "test(fe): harden VR e2e against contention with retries and stabilization timeout

The preflight->preflight:par default flip remains a documented follow-up, not made here."
```

---

# Wave 9 — Register hygiene (`docs/TECH_DEBT.md`; surgical, NO prettier)

### Task 24: Mark the resolved entries, move fully-closed ones to the archive

Convention (confirmed from current state): a **fully-closed** entry is MOVED out of `docs/TECH_DEBT.md` into `docs/TECH_DEBT_ARCHIVE.md` (body verbatim + a bottom-appended resolved line), and its index row flips to `resolved` / `[archive]`. **Partially-resolved** entries stay in the register as `open` with an in-place annotation.

**Files:**
- Modify: `docs/TECH_DEBT.md` (Index table + remove closed bodies)
- Modify: `docs/TECH_DEBT_ARCHIVE.md` (append closed bodies + resolved lines)

- [ ] **Step 1: For each fully-closed entry, append its body to the archive with a resolved line.** Move the verbatim entry body from `TECH_DEBT.md` into `TECH_DEBT_ARCHIVE.md` (preserve the heading so its anchor matches) and bottom-append (TD-FE-1 style):

```
**Resolved (Phase 37, <DATE>):** <one line — what changed>. Commit <sha>.
```

(`<DATE>` and `<sha>` are **execution-time fills** — use the resolving commit's short SHA for that entry and the phase merge date; they don't exist at authoring time, so don't stall on the placeholders.)

Fully-closed code entries (move to archive): **TD-FE-64, TD-FE-23, TD-FE-26, TD-FE-24, TD-FE-12, TD-FE-66, TD-FE-61, TD-FE-50, TD-FE-42, TD-FE-56, TD-FE-11, TD-FE-67, TD-FE-70, TD-FE-25, TD-FE-20, TD-FE-52, TD-FE-29** and backend **TD-005, TD-012, TD-FE-71**. For **TD-FE-72**, also append the operational caveat: `code-complete but dormant in prod until /signal-lead-map_claude deploys (same gate as TD-FE-73)`.

- [ ] **Step 2: Flip each moved entry's index row.** In the `Index — TD-FE entries` table, change each from `| TD-FE-NN | open | [below](#…) |` to `| TD-FE-NN | resolved | [archive](TECH_DEBT_ARCHIVE.md#<anchor>) |`. The anchor = the heading auto-slug (em-dash→`--`, punctuation dropped, spaces→`-`); copy the existing slug from the moved heading. (Backend `TD-005`/`TD-012` are not in the TD-FE index table — flip their `**Status:**` line in place in `TECH_DEBT.md` per the TD-010/TD-011 in-register pattern, since the archive is TD-FE-only.)

- [ ] **Step 3: Verify links + commit**

Run: `cd /projects/Brewra/brewra-gtm-intelligence && rg -n 'TD-FE-(64|23|26|24|12|66|61|50|42|56|11|67|70|25|20|52|29|72)' docs/TECH_DEBT.md`
Expected: each remaining hit is the index row (now `resolved`/`[archive]`), not a leftover body. Spot-check two archive anchors resolve against their index links. **Do not run prettier on these files.**

```bash
git add docs/TECH_DEBT.md docs/TECH_DEBT_ARCHIVE.md
git commit -m "docs(debt): mark Phase 37 resolved entries and move them to the archive"
```

### Task 25: Narrow the drifted entries, close the two doc/stale entries, record the carry-forward

**Files:**
- Modify: `docs/TECH_DEBT.md`
- Possibly modify: `frontend/src/features/mission-control/pages/MissionControlPage.tsx` (only if the dead overlay is still present)
- Modify: `docs/TECH_DEBT_ARCHIVE.md` (for TD-FE-16/-45/-48 if fully closed)

- [ ] **Step 1: TD-FE-40 — resolve the syncing sub-item, then close.** Verify the dead overlay:

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && rg -n 'syncingProfilerCustomerProfile' src/features/mission-control/pages/MissionControlPage.tsx`
- If **absent**: the register text is stale — TD-FE-40's `_isSaving` (a) and `syncingProfilerCustomerProfile` (d) are already gone; (a) console + (b) badge default were done in Task 5. Mark TD-FE-40 resolved and move to archive (resolved line notes c/d were already-resolved, a/b done Phase 37).
- If **present** (dead overlay): make the trivial removal the register describes — delete the `syncingProfilerCustomerProfile` state + its `setSyncingProfilerCustomerProfile(false)` call + the "Syncing customer profile" Dialog branch, simplifying the Dialog to `open={isLoadingProfile}`. Commit it (`chore(fe): remove dead syncing-profile overlay in MissionControlPage`), then mark TD-FE-40 resolved + archive.

- [ ] **Step 2: TD-FE-16 — narrow then close.** The `useAuth` collision (bullet 2) was resolved in Phase 11 (TD-FE-54: composed hook → `shared/auth/useAuthToken.ts`), and the sidebar internal rename (bullet 1) was done in Task 7. Both halves done → move TD-FE-16 to the archive; the resolved line records "useAuth collision resolved earlier by TD-FE-54; sidebar internal `useSidebar`→`useAppSidebar` done Phase 37 (Task 7)."

- [ ] **Step 3: TD-FE-36 — narrow, keep open (partial).** Edit the body in place (stays `open`): update **Current state** to record that `useCompanyProfile` now lives in `@/shared/company-profile` with all consumers repointed (hook-move resolved), and that the only residue is the market-research duplicate fetch inside the imperative `smartRefresh` (`useMarketResearchData.ts:2289`), which is **blocked on the data-layer split (Spec 38 / TD-FE-19/65)**. Append:

```
**Resolved (Phase 37, partial):** the shared-promotion + consumer-repoint half is done (useCompanyProfile is in @/shared/company-profile). The remaining MR duplicate-fetch removal is blocked on the editable-state↔query decomposition (TD-FE-19/65) and is reclassified accordingly. Pull-forward: with Spec 38.
```

- [ ] **Step 4: TD-FE-45 — close (both halves done).** Verify the shell exists:

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && ls src/shared/chat/ChatWithHistory.tsx`
Expected: present (Phase 8 relocated the substrate; Phase 9 made both wrappers thin delegates — confirmed by CLAUDE.md). Move TD-FE-45 to the archive; resolved line notes both halves closed (substrate relocation Phase 8, ProfilerChat↔ScoutChat dedup Phase 9). The "leave open for Spec 41" branch does not apply.

- [ ] **Step 5: TD-FE-48 — doc-only close.** Code disposition is done (`Deals.tsx` → `features/strategist/pages/StrategistPage.tsx` with the `/deals` redirect). Move TD-FE-48 to the archive annotated as a Phase-8 delta. **Do NOT rewrite the frozen Spec 14 §12** (specs are a frozen record of intent).

- [ ] **Step 6: TD-FE-73 — record the carry-forward.** Leave TD-FE-73 `open`; append a note: `/signal-lead-map_claude confirmed not deployed (2026-06-15); the contract reconciliation pulls forward when the endpoint ships.` (TD-FE-72's resolved entry already carries the dormancy caveat from Task 24 Step 1.)

- [ ] **Step 7: Update the index rows + verify + commit.** Flip TD-FE-16/-40/-45/-48 index rows to `resolved`/`[archive]`; TD-FE-36 and TD-FE-73 stay `open`/`[below]`.

Run: `cd /projects/Brewra/brewra-gtm-intelligence && rg -n 'TD-FE-(16|36|40|45|48|73)' docs/TECH_DEBT.md docs/TECH_DEBT_ARCHIVE.md`
Expected: 36 + 73 still in the register (open, annotated); 16/40/45/48 bodies in the archive with matching `resolved` index rows. **No prettier on these files.**

```bash
git add docs/TECH_DEBT.md docs/TECH_DEBT_ARCHIVE.md
git commit -m "docs(debt): narrow TD-FE-36/40/16, close TD-FE-45/48, record TD-FE-73 carry-forward"
```

---

## Testing strategy & gates

- **Behavior-changing items get tests:** TD-FE-64 (un-skip 2), -23 (chartType render), -66 (in-flight guard), -42 (schema), -72 (refresh:true MSW), -67 (total surfaced), -70 (pager offset), -25 (read-only-shows-local), -56 (AgentConfigForm + AgentProfile render), -11 (useUserProfile); backend -71 (prompt assertion), -012 (sync-ness), -005 (v2 envelope migration); -20/-52 are themselves tests.
- **Behavior-neutral changes** (TD-FE-26, -12, -40 console, -16, -24 dedup, -61/-50 rename, -68 proxy swap, -36 narrow): covered by `npm run typecheck`, the existing vitest suite, and `knip --strict` (no new dead refs). Use `npm run typecheck`, never bare `tsc`.
- **Vitest:** full suite runs only in the merge `preflight`; use `npx vitest run <path> --no-file-parallelism` in the inner loop. Never set `isolate:false`. New endpoints (none here add a *new* backend route, but `/api/ask` becomes proxied) get a default MSW handler if a mounted-component test would otherwise hit `onUnhandledRequest:"error"`.
- **Backend:** `backend/.venv/bin/python -m pytest backend/tests/ -q` (patch-where-used). Root `backend/test_*.py` are live prod probes, used here only for the optional Wave-0/-68 smokes, never as the suite.
- **Merge gate:** one green serial `npm run preflight` (hard steps: typecheck, vitest, build, Playwright e2e, knip) **and** `backend/tests/` pytest green; advisory steps (lint, format:check, bundle:check) reported, non-blocking. Run `prettier --check` on touched FE files per task.

## Acceptance criteria (phase-level)

1. All in-scope entries resolved (with a test where behavior changed). TD-FE-73 excluded up front (endpoint not deployed), recorded carried-forward. TD-FE-36 reclassified to a Wave-9 narrow (hook-move done; MR-fetch blocked-on-Spec-38) — recorded, not counted as an unmet code item.
2. The two correctness bugs (TD-FE-64, TD-FE-23) fixed and covered by passing tests.
3. `docs/TECH_DEBT.md` reflects reality: resolved entries marked/archived, index updated, register reconciled per Wave 9 (narrow TD-FE-40/-16/-36; close TD-FE-45/-48; TD-FE-73 carry-forward).
4. One green serial `npm run preflight` (hard steps) + `backend/tests/` pytest green on the branch; advisory-step status reported.
5. Merged to `master` via `--no-ff` and pushed; branch deleted.
6. The 4 follow-on specs (38–41) and the untouched blocked/decision/accepted entries remain clearly tracked in the register.

## Self-review (author pass against the spec)

- **Spec coverage:** Every in-scope entry from spec §2.1 maps to a task — Wave 1: 64→T1, 23→T2, 26→T3, 12→T4, 40→T5, 24→T6, 16→T7, 66→T8; Wave 2: TD-005→T9, TD-012→T10, TD-FE-71→T11; Wave 3: 61+50→T12, 42→T13; Wave 4: 56→T14, 11→T15 (36→Wave-9 narrow, per ledger #11); Wave 5: 72→T16; Wave 6: 67→T17, 70→T18, 68→T19; Wave 7: 25→T20; Wave 8: 20→T21, 52→T22, 29→T23; Wave 9: marks/narrows/closes→T24/T25. No spec requirement is unmapped.
- **Deviations from spec (all code-verified, justified inline):** path corrections (regulatory-compliance not mission-control); TD-FE-24 three copies; TD-FE-23 two switches; TD-FE-26 route-not-delete (writes round-trip); TD-005 also migrates 3 pytest files; TD-FE-36 reclassified to a narrow; TD-FE-25 read-only-alignment only (no new persistence). These are in the Discrepancy ledger.
- **Type consistency:** `ChatContext` / `readSessionChatContext` / `writeSessionChatContext` / `CHAT_CONTEXT_SESSION_KEY` (T12); `IcpRowSchema` / `IcpRow` (T13); `AgentConfigForm` / `AgentConfigValues` / `AgentConfigChecks` (T14); `fetchOwnProfile` / `useUserProfile` / `useAgentProfile` / `qk.userProfile` / `qk.agentProfile` (T15); `refresh` on `useSignalLeadMap` (T16); `pageParams` + `{ items, total }` page shape (T17/T18) — names are used consistently across the tasks that reference them.
- **Open execution-time confirmations:** Wave-0 Probe 1 (chartType) and Probe 2 (ICP row keys); TD-005 re-grep; TD-FE-40 syncing-overlay presence; exact e2e assertion text in T21/T22; the verbatim field JSX lift in T14. Each task names how to resolve these against the running code.

## Execution handoff

Plan complete and saved to `plans/37-tech-debt-paydown.md`. Recommended execution: **subagent-driven** — a fresh subagent per task with a two-stage review between tasks (matches the repo's spec→plan→impl pipeline and surgical-commit discipline). Sequence the waves in order; checkpoint at each wave boundary; run the merge gate (serial `npm run preflight` + `backend/tests/`) once at the end. Alternatively, inline execution in this session via superpowers:executing-plans with checkpoints at wave boundaries.



