# Frontend Phase 11 — Shared Utility Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drain every remaining legacy directory (`src/hooks/`, `src/lib/`, `src/utils/`, `src/styles/`, the stray `src/components/*` files) into `src/shared/`, `src/features/`, and `src/components/ui/`, then lock the drain with a blocking lint rule — so the Spec 14 §3.1 target layout is fully realized.

**Architecture:** Pure, behavior-frozen relocation. Every file moves byte-for-byte; only import specifiers change. Five sub-phases (11a–11e) each leave a green tree. The safety net is the existing layered suite (Vitest + Playwright + visual regression), not new tests — relocated tests keep asserting the same behavior at their new paths.

**Tech Stack:** React 18 + Vite + TypeScript, ESLint (`import-x` zone rules), Vitest, Playwright, Tailwind. Implements `specs/31-frontend-phase-11-shared-utility-extraction-design.md`.

**Branch:** `phase-11-shared-utility-extraction` (already checked out, off `master` @ `182cb8e`; spec already committed at `6e5a428`).

**All commands run from `frontend/`** (the repo root holds `backend/`, `docs/`, `plans/`, `specs/`; the app is `frontend/src/`). Paths below are frontend-relative unless prefixed with `docs/` (repo-root).

---

## Plan-stage refinements of Spec 31 (deviations, with reasoning)

The spec (§1.3) flagged its consumer counts as estimates and delegated a full re-grep to this plan. That re-grep (on `master`+spec @ `6e5a428`) confirmed every disposition but surfaced corrections the spec's own §5/§6 prose did not anticipate. Recording them here per the receiving-design-review discipline (honest reasoning over fidelity to a converged-but-imperfect spec):

1. **`rateLimitManager.test.ts` is RELOCATED, not deleted.** Spec §5.3 / synthesis-2 H1 called it "the identity test … nothing left to test … the canonical instance is already covered by `client.test.ts`." That is inaccurate. `src/lib/__tests__/rateLimitManager.test.ts` is a **250-line behavioral characterization** of the canonical `RateLimitManager` class (default-cap, queue-beyond-cap with window slide, non-rate-limit reject, retry-up-to-maxRetries, the 12-phrase `isRateLimitError` fan-out, `clearQueue`, the `executeWithRateLimit` helper). It imports through the shim only as a path; its **subject is `@/shared/api/rateLimiter`**. `client.test.ts` does **not** cover any of that behavior (it tests JWT injection + the shim-identity invariant only). Deleting it would be a real coverage regression and would violate the spec's own §2.3 mandate ("relocated unit tests keep asserting the same behavior at their new paths"). **Correct disposition:** delete only the **shim** (`src/lib/rateLimitManager.ts`, 0 runtime importers) and **relocate** its test to `src/shared/api/__tests__/rateLimiter.test.ts`, repointing imports to the canonical module. (Task 12.)
2. **The shim-identity test in `client.test.ts` is deleted, not repointed.** Synthesis-2 said "repoint `client.test.ts:16` to `@/shared/api/rateLimiter`." But `rateLimiter.ts` exports `rateLimiter`, not `rateLimitManager`; a mechanical repoint yields `expect(rateLimiter).toBe(rateLimiter)` — a tautology. Once the shim is gone there is only one instance, so the "two paths → one instance" invariant (the `describe("… single rate-limiter invariant (R3)")` block, lines 14–19) is moot. **Delete that describe block** and the now-unused `import { rateLimiter } …` (line 7). The spec's intent (sever the dependency on the deleted shim) is satisfied. (Task 12.)
3. **`src/lib/utils.ts` is split across two stages.** Spec class A puts `sanitizeAnswerText` in 11a; class C puts `cn` in 11c. So `utils.ts` loses `sanitizeAnswerText` in 11a (file keeps `cn`, stays green) and is deleted in 11c. The dual-subject `utils.test.ts` is split at each subject's move: the `sanitizeAnswerText` block leaves in 11a, the `cn` block in 11c. (Tasks 3 and 14.)
4. **Dead commented imports cleaned.** `features/shell/components/Sidebar.tsx:15` and `:133` are commented-out `@/lib/utils` lines. They are AST-invisible to lint but would false-positive a naive DoD grep for `@/lib`. They are deleted in Task 14.
5. **`App.tsx` imports `PWAInstallPrompt` via the shell barrel.** `App.tsx` is outside `features/`; importing `@/features/shell/components/PWAInstallPrompt` would violate `import-x/no-internal-modules` (`@/features/*/!(index)`). So Task 6 adds `PWAInstallPrompt` to `features/shell/index.ts` and `App.tsx` imports the barrel.
6. **`shared/auth/index.ts` barrel gains `jwtManager` + `useAuthToken`** (satisfies TD-FE-54's "barrel exporting all three"). Runtime feature consumers import the renamed token hook from the barrel; `jwt` is imported via the deep path `@/shared/auth/jwt` (pure path swap, preserves the existing default-import shape at all 5 sites). (Tasks 9–10.)
7. **Spec §3 summary line is stale for `use-toast`.** The spec's §3 target-tree summary lists `use-toast` under `shared/hooks/`, but the spec's own §5.1 and §1.3 disposition correctly place it in `components/ui/use-toast.ts` (the ui-layer exception). The plan implements the §5.1 placement (Task 15); `usePageTitle` is the only hook that actually lands in `shared/hooks/`. This is a spec-internal inconsistency, not a plan change — it is logged as a Spec 14/Spec 31 erratum delta at merge (Task 23), per the frozen-record convention (no rewrite of the shipped spec).

---

## Final disposition (trace-verified @ `6e5a428`)

| Legacy file | → Destination | Consumers to repoint (verified) |
|---|---|---|
| `hooks/usePageTitle.ts` | `shared/hooks/usePageTitle.ts` | 6 (reports, artifacts, customers, calendar, market-research, strategist pages) |
| `utils/cacheUtils.ts` | `shared/lib/cacheUtils.ts` | 14 sites / 5 features (+2 dynamic `import()`, +1 `vi.mock`) |
| `lib/utils.ts` → `sanitizeAnswerText` | `shared/lib/sanitizeAnswerText.ts` | 2 (`shared/chat/ContextChat`, `signals/SignalCard`) |
| `lib/types/escape-hatches.ts` | `shared/types/escape-hatches.ts` | ~22 type-import sites (settings, customers, mc, mr, signals, `shared/profiler`, residue `LeadStreamTab`) |
| `lib/timestampUtils.ts` (+test) | `features/market-research/lib/` | 1 (`useMarketResearchData`) |
| `utils/apiUtils.ts` | `features/market-research/lib/` | 1 (`useMarketResearchData`) |
| `utils/leadStreamChatContext.ts` | `features/market-research/lib/` | 2 sites / 1 feature (`ScoutChatWithHistory`, `MarketResearchPage`) — TD-FE-62 |
| `components/MiniLineChart.tsx`, `MiniPieChart.tsx` | `features/market-research/components/` | 1 (`ComplianceVisualCard`) |
| `components/PWAInstallPrompt.tsx` | `features/shell/components/` | 1 (`App.tsx`, via barrel) |
| `components/common/ErrorBoundary.tsx` | `features/customers/components/` | 1 (`CustomersPage`) |
| `lib/jwt.ts` (+`jwtAuthEndpoint.test`) | `shared/auth/jwt.ts` | 5 sites (2 features, residue `LeadsTable`, 2 tests) — TD-FE-54 |
| `hooks/useAuth.ts` → **`useAuthToken`** | `shared/auth/useAuthToken.ts` | 5 call sites (mc ×4, residue `LeadsTable`) + 4 `vi.mock` — TD-FE-54 |
| `lib/api.ts` | `shared/api/transport.ts` | 19 sites / 4 features + `shared/api/client` + `shared/auth/AuthContext` + residue + `test/msw` |
| `lib/rateLimitManager.ts` | **DELETE** (shim) | shim deleted; its test relocated; `client.test.ts` R3 block deleted (refinement 1–2) |
| `lib/utils.ts` → `cn` | `components/ui/utils.ts` | 30 `ui/` files (→ `./utils`) + 3 non-ui (Header, Sidebar, IcpWizard → `@/components/ui/utils`) |
| `hooks/use-toast.ts` | `components/ui/use-toast.ts` (replaces shim) | `ui/toaster` (→`./use-toast`) + ~28 others (→`@/components/ui/use-toast`) |
| `hooks/use-mobile.tsx` | `components/ui/use-mobile.tsx` | `ui/sidebar` (→`./use-mobile`) + 3 shell (→`@/components/ui/use-mobile`) |
| `lib/leadStreamHeatmapSession.ts`, `marketScoreDescriptions.ts` (+test), `marketScoresHeatmap.ts` (+test) | `features/market-research/lib/` | fed only by `LeadsTable`; travel with the cluster |
| `components/market-research/lead-stream/leadData.ts` | `shared/lib/leadData.ts` | strategist (2) + score libs (3 lines) + cluster (3) — TD-FE-63 |
| `components/market-research/{ScoutLeadStream, lead-stream/{LeadStreamTab,LeadsTable,OpportunityDashboard}}` | `features/market-research/components/` | cluster-internal + `MarketResearchPage` |
| `components/market-research/EditDropdownMenu.tsx` | `features/customers/components/icp-intelligence/` | customers (2) |
| `src/index.css`, `src/styles/scrollbar-hide.css` | `src/shared/styles/` | `main.tsx` (2 lines). `src/App.css` is dead → delete. |

`src/contexts/`, `src/services/`, `src/pages/` are already gone (verified). `hooks/` has no `__tests__/`.

---

## Conventions for every task

- **Relocate = `git mv`** (preserves history + stages the move). Then rewrite import specifiers, then normalize, then verify.
- **Specifier rewrite** (mechanical, exact-string) uses `sed`:
  `grep -rl '<OLD>' src | xargs sed -i 's#<OLD>#<NEW>#g'` — always confirm with a follow-up `grep -rn '<OLD>' src` returning nothing.
- **Normalize after every edit batch** (handles `import-x/order` reclassification + Prettier):
  `npx prettier --write <touched files>` then `npx eslint --fix <touched files>`.
- **Per-task gate (`G`):** `npm run verify` (typecheck + lint + `test:changed`) **and** `npx prettier --check <touched files>` — `verify` omits `format:check`, so check it explicitly. Both must be clean before commit.
- **Commit surgically by path** (shared working tree; never `git add -A` at the repo root — stage only the paths a task touches). No `Co-Authored-By` footer. Style: `refactor(fe): …` for moves, `test(fe): …`, `docs(fe): …`, `chore(fe): …`. No `[N/M]` suffix.
- **`docs/TECH_DEBT.md` is never Prettier-formatted** — edit it surgically (Task 23).
- **Execute tasks sequentially within a stage — do NOT parallelize.** Many tasks edit the *same* consumer file (e.g. `features/market-research/hooks/useMarketResearchData.ts` is touched by Task 2 *and* Task 5; `MarketResearchPage.tsx` by Task 1 *and* Task 5), so parallel dispatch would collide. The subagent-driven harness runs one task at a time with review between — that is the intended model. (Stages 11a→11e are themselves strictly ordered by the cross-stage dependencies in §6/§9.)
- **Failure protocol.** A gate (`G`) failure is never committed and never skipped. Diagnose the root cause and fix it *within the same task*, then re-run `G`. If it cannot be resolved within the task's scope (e.g. a lint-config form that won't load and the documented fallback also fails, or a preflight regression unrelated to a simple import path), **stop and report to the operator** with the failing output — do not improvise out-of-scope changes, do not proceed to the next task.
- Each sub-phase ends green; commits within a sub-phase are also individually green.

---

## Stage 0 — before you start (baseline)

Establishes that the gates are meaningful before any move, so a later failure can be attributed to Phase 11 and not to inherited breakage. No commit; record the output.

- [ ] **Step 1: Confirm the branch is green.** From `frontend/`: `npm run verify`. Expected: typecheck + lint + `test:changed` all clean. If it fails on the untouched branch, **stop and report** — the gates cannot validate the phase until the baseline is green.
- [ ] **Step 2: Record the `knip` baseline.** `npm run knip` and save the output (e.g. paste into the operator log). Any dead-code findings here are *pre-existing*; Task 24's `knip` must not introduce *new* ones beyond this baseline. (A relocation should net-reduce dead code, never add it.)
- [ ] **Step 3: Confirm the scripts exist** — `npm run` lists `verify`, `preflight`, `knip`, `build`, `test:e2e`. (They do at `6e5a428`; this guards against executing from an unexpected base.)

---

## Stage 11a — clean promotes + single-consumer moves + styles

Creates `shared/hooks/`, `shared/lib/`, `shared/types/`, `shared/styles/`. No barrels for these new shared subdirs (consumers use deep paths like `@/shared/lib/cacheUtils`, consistent with the barrel-less `shared/api/`).

### Task 1: Promote `usePageTitle` → `shared/hooks/`

**Files:**
- Move: `src/hooks/usePageTitle.ts` → `src/shared/hooks/usePageTitle.ts`
- Modify: 6 consumer pages (specifier swap)

- [ ] **Step 1: Move the file**
```bash
mkdir -p src/shared/hooks
git mv src/hooks/usePageTitle.ts src/shared/hooks/usePageTitle.ts
```

- [ ] **Step 2: Repoint all consumers**
```bash
grep -rl '@/hooks/usePageTitle' src | xargs sed -i 's#@/hooks/usePageTitle#@/shared/hooks/usePageTitle#g'
grep -rn '@/hooks/usePageTitle' src   # expect: no output
```
Touches: `features/{reports,artifacts,customers,calendar,market-research,strategist}/pages/*.tsx`.

- [ ] **Step 3: Normalize** — `npx prettier --write` + `npx eslint --fix` on the moved file + the 6 pages.

- [ ] **Step 4: Gate `G`.** Expected: green.

- [ ] **Step 5: Commit**
```bash
git add src/shared/hooks/usePageTitle.ts src/features/reports/pages src/features/artifacts/pages src/features/customers/pages src/features/calendar/pages src/features/market-research/pages src/features/strategist/pages
git commit -m "refactor(fe): promote usePageTitle to shared/hooks (Phase 11a; TD-FE-57)"
```

### Task 2: Promote `cacheUtils` → `shared/lib/`

**Files:**
- Move: `src/utils/cacheUtils.ts` → `src/shared/lib/cacheUtils.ts`
- Modify: 13 consumer files (incl. dynamic `import()` + 1 `vi.mock`)

- [ ] **Step 1: Move**
```bash
mkdir -p src/shared/lib
git mv src/utils/cacheUtils.ts src/shared/lib/cacheUtils.ts
```

- [ ] **Step 2: Repoint** (static imports, dynamic `import("@/utils/cacheUtils")`, and `vi.mock("@/utils/cacheUtils")` all match the same string)
```bash
grep -rl '@/utils/cacheUtils' src | xargs sed -i 's#@/utils/cacheUtils#@/shared/lib/cacheUtils#g'
grep -rn '@/utils/cacheUtils' src   # expect: no output
```

- [ ] **Step 3: Normalize** the moved file + the 13 consumers (see disposition table for the list).

- [ ] **Step 4: Gate `G`.**

- [ ] **Step 5: Commit**
```bash
git add src/shared/lib/cacheUtils.ts src/features
git commit -m "refactor(fe): promote cacheUtils to shared/lib (Phase 11a)"
```

### Task 3: Split `sanitizeAnswerText` out of `lib/utils.ts` → `shared/lib/`

`lib/utils.ts` exports `cn` (stays for 11c) and `sanitizeAnswerText` (leaves now). After this task `lib/utils.ts` contains only `cn`.

**Files:**
- Create: `src/shared/lib/sanitizeAnswerText.ts`
- Create: `src/shared/lib/__tests__/sanitizeAnswerText.test.ts`
- Modify: `src/lib/utils.ts` (remove `sanitizeAnswerText`), `src/lib/__tests__/utils.test.ts` (remove its block)
- Modify: `src/shared/chat/ContextChat.tsx:19`, `src/features/signals/components/SignalCard.tsx:18`

- [ ] **Step 1: Create `src/shared/lib/sanitizeAnswerText.ts`** with the function verbatim from `lib/utils.ts` (no imports needed):
```ts
/** Strip markdown and special characters from recommendation/agent answers for plain display */
export function sanitizeAnswerText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\*\*\*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\*$/gm, "")
    .replace(/^#+\s*/gm, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))
    .replace(/^---+$/gm, "")
    .replace(/\|/g, " ")
    .replace(/—/g, " - ")
    .replace(/[–—―]/g, " - ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[…]/g, "...")
    .replace(/[✅✓✔❌❎]/g, "") // checkmarks, X
    .replace(/[☀-➿]/g, "") // misc symbols (stars, arrows, etc.)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "") // emoji surrogate pairs (📌, ✅ in some fonts, etc.)
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
```

- [ ] **Step 2: Create the test** `src/shared/lib/__tests__/sanitizeAnswerText.test.ts` — move the `describe("sanitizeAnswerText", …)` block verbatim from `src/lib/__tests__/utils.test.ts` (lines 43–129), with this header:
```ts
import { describe, expect, it } from "vitest";

import { sanitizeAnswerText } from "@/shared/lib/sanitizeAnswerText";
```
(Paste the entire `describe("sanitizeAnswerText", () => { … })` block unchanged.)

- [ ] **Step 3: Trim `src/lib/utils.ts`** to contain only `cn`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Trim `src/lib/__tests__/utils.test.ts`** — delete the `sanitizeAnswerText` describe block; change the import on line 6 to `import { cn } from "@/lib/utils";` (drop `sanitizeAnswerText`). Update the header comment to mention only `cn`.

- [ ] **Step 5: Repoint the 2 `sanitizeAnswerText` consumers**
```bash
sed -i 's#import { sanitizeAnswerText } from "@/lib/utils";#import { sanitizeAnswerText } from "@/shared/lib/sanitizeAnswerText";#' \
  src/shared/chat/ContextChat.tsx src/features/signals/components/SignalCard.tsx
grep -rn 'sanitizeAnswerText.*@/lib/utils' src   # expect: no output
```

- [ ] **Step 6: Normalize** all touched files.

- [ ] **Step 7: Gate `G`.** (Run the two new/changed test files explicitly too: `npx vitest run src/shared/lib/__tests__/sanitizeAnswerText.test.ts src/lib/__tests__/utils.test.ts`.)

- [ ] **Step 8: Commit**
```bash
git add src/shared/lib/sanitizeAnswerText.ts src/shared/lib/__tests__/sanitizeAnswerText.test.ts src/lib/utils.ts src/lib/__tests__/utils.test.ts src/shared/chat/ContextChat.tsx src/features/signals/components/SignalCard.tsx
git commit -m "refactor(fe): split sanitizeAnswerText into shared/lib (Phase 11a)"
```

### Task 4: Promote `escape-hatches` → `shared/types/`

**Files:**
- Move: `src/lib/types/escape-hatches.ts` → `src/shared/types/escape-hatches.ts`
- Modify: ~22 type-import sites + `shared/profiler/profilerAcceptedIcpDisplay.ts`

- [ ] **Step 1: Move**
```bash
mkdir -p src/shared/types
git mv src/lib/types/escape-hatches.ts src/shared/types/escape-hatches.ts
rmdir src/lib/types 2>/dev/null || true
```

- [ ] **Step 2: Repoint** (matches the multi-line `} from "@/lib/types/escape-hatches"` cases and the descriptive comment in `customers/types.ts`, which becomes correct)
```bash
grep -rl '@/lib/types/escape-hatches' src | xargs sed -i 's#@/lib/types/escape-hatches#@/shared/types/escape-hatches#g'
grep -rn '@/lib/types/escape-hatches' src   # expect: no output
```

- [ ] **Step 3: Normalize** moved file + all touched consumers.

- [ ] **Step 4: Gate `G`.**

- [ ] **Step 5: Commit**
```bash
git add src/shared/types/escape-hatches.ts src/shared src/features
git commit -m "refactor(fe): promote escape-hatches to shared/types (Phase 11a)"
```

### Task 5: Single-consumer moves → `features/market-research/`

`timestampUtils`, `apiUtils`, `leadStreamChatContext` → `features/market-research/lib/`; `MiniLineChart`, `MiniPieChart` → `features/market-research/components/`. All consumers are inside `market-research`, so repoint to **relative** paths (same-feature convention).

**Files:**
- Move: `src/lib/timestampUtils.ts` → `src/features/market-research/lib/timestampUtils.ts` (+ `src/lib/__tests__/timestampUtils.test.ts` → `src/features/market-research/lib/__tests__/timestampUtils.test.ts`)
- Move: `src/utils/apiUtils.ts`, `src/utils/leadStreamChatContext.ts` → `src/features/market-research/lib/`
- Move: `src/components/MiniLineChart.tsx`, `src/components/MiniPieChart.tsx` → `src/features/market-research/components/`
- Modify: `useMarketResearchData.ts`, `ScoutChatWithHistory.tsx`, `MarketResearchPage.tsx`, `ComplianceVisualCard.tsx`

- [ ] **Step 1: Move files**
```bash
mkdir -p src/features/market-research/lib/__tests__
git mv src/lib/timestampUtils.ts src/features/market-research/lib/timestampUtils.ts
git mv src/lib/__tests__/timestampUtils.test.ts src/features/market-research/lib/__tests__/timestampUtils.test.ts
git mv src/utils/apiUtils.ts src/features/market-research/lib/apiUtils.ts
git mv src/utils/leadStreamChatContext.ts src/features/market-research/lib/leadStreamChatContext.ts
git mv src/components/MiniLineChart.tsx src/features/market-research/components/MiniLineChart.tsx
git mv src/components/MiniPieChart.tsx src/features/market-research/components/MiniPieChart.tsx
```

- [ ] **Step 2: Repoint the relocated test** — in `features/market-research/lib/__tests__/timestampUtils.test.ts`, change `@/lib/timestampUtils` → `../timestampUtils`.

- [ ] **Step 3: Repoint consumers (relative within the feature):**
  - `features/market-research/hooks/useMarketResearchData.ts`: `@/lib/timestampUtils` → `../lib/timestampUtils`; `@/utils/apiUtils` → `../lib/apiUtils`.
  - `features/market-research/components/scout-chat/ScoutChatWithHistory.tsx:16`: `@/utils/leadStreamChatContext` → `../../lib/leadStreamChatContext`.
  - `features/market-research/pages/MarketResearchPage.tsx:35`: `@/utils/leadStreamChatContext` → `../lib/leadStreamChatContext`.
  - `features/market-research/components/intelligence/regulatory-compliance/ComplianceVisualCard.tsx:5-6`: `@/components/MiniLineChart` → `../../MiniLineChart`; `@/components/MiniPieChart` → `../../MiniPieChart`.

```bash
grep -rn '@/lib/timestampUtils\|@/utils/apiUtils\|@/utils/leadStreamChatContext\|@/components/Mini' src   # expect: no output
```

- [ ] **Step 4: Normalize** all moved + touched files.

- [ ] **Step 5: Gate `G`.**

- [ ] **Step 6: Commit**
```bash
git add src/features/market-research
git commit -m "refactor(fe): move single-consumer utils into features/market-research (Phase 11a; TD-FE-62)"
```

### Task 6: `PWAInstallPrompt` → `features/shell/` (via barrel)

**Files:**
- Move: `src/components/PWAInstallPrompt.tsx` → `src/features/shell/components/PWAInstallPrompt.tsx`
- Modify: `src/features/shell/index.ts`, `src/App.tsx:4`

- [ ] **Step 1: Move**
```bash
git mv src/components/PWAInstallPrompt.tsx src/features/shell/components/PWAInstallPrompt.tsx
```

- [ ] **Step 2: Read `src/features/shell/index.ts`** and add (alphabetically within existing exports):
```ts
export { default as PWAInstallPrompt } from "./components/PWAInstallPrompt";
```

- [ ] **Step 3: Repoint `App.tsx`** — change line 4 `import PWAInstallPrompt from "./components/PWAInstallPrompt";` to a barrel import: `import { PWAInstallPrompt } from "@/features/shell";`. (If `App.tsx` already imports from `@/features/shell`, merge into that statement instead.) Leave `<PWAInstallPrompt variant="fixed" />` unchanged.

- [ ] **Step 4:** Confirm `PWAInstallPrompt`'s own import of `@/hooks/use-mobile` (line 5) is left as-is — it **will be repointed** to `@/components/ui/use-mobile` in Task 16 (after `use-mobile` co-locates into `components/ui/`).

- [ ] **Step 5: Normalize** the moved file + `index.ts` + `App.tsx`.

- [ ] **Step 6: Gate `G`.**

- [ ] **Step 7: Commit**
```bash
git add src/features/shell/components/PWAInstallPrompt.tsx src/features/shell/index.ts src/App.tsx
git commit -m "refactor(fe): move PWAInstallPrompt into features/shell (Phase 11a)"
```

### Task 7: `common/ErrorBoundary` → `features/customers/`

**Files:**
- Move: `src/components/common/ErrorBoundary.tsx` → `src/features/customers/components/ErrorBoundary.tsx`
- Modify: `src/features/customers/pages/CustomersPage.tsx:9`

- [ ] **Step 1: Move + drop the empty legacy dir**
```bash
git mv src/components/common/ErrorBoundary.tsx src/features/customers/components/ErrorBoundary.tsx
rmdir src/components/common 2>/dev/null || true
```

- [ ] **Step 2: Repoint** `CustomersPage.tsx:9`: `@/components/common/ErrorBoundary` → `../components/ErrorBoundary` (same-feature relative; keep the `{ ErrorBoundary }` named import).
```bash
grep -rn '@/components/common' src   # expect: no output
```

- [ ] **Step 3: Normalize** both files.

- [ ] **Step 4: Gate `G`.**

- [ ] **Step 5: Commit**
```bash
git add src/features/customers/components/ErrorBoundary.tsx src/features/customers/pages/CustomersPage.tsx
git commit -m "refactor(fe): move ErrorBoundary into features/customers (Phase 11a)"
```

### Task 8: Styles → `shared/styles/`

**Files:**
- Move: `src/index.css` → `src/shared/styles/index.css`; `src/styles/scrollbar-hide.css` → `src/shared/styles/scrollbar-hide.css`
- Delete: `src/App.css` (dead — imported by nothing, verified)
- Modify: `src/main.tsx:5-6`

- [ ] **Step 1: Move + delete dead file**
```bash
mkdir -p src/shared/styles
git mv src/index.css src/shared/styles/index.css
git mv src/styles/scrollbar-hide.css src/shared/styles/scrollbar-hide.css
rmdir src/styles 2>/dev/null || true
git rm src/App.css
```

- [ ] **Step 2: Repoint `main.tsx`** lines 5–6:
```ts
import "@/shared/styles/index.css";
import "@/shared/styles/scrollbar-hide.css";
```

- [ ] **Step 3:** Confirm no Tailwind/Vite config change needed — `tailwind.config` content globs are `./src/**/*.{ts,tsx}` (no CSS path); PostCSS/Vite resolve the moved entry by import path.

- [ ] **Step 4: Build-parity check** — `npm run build` succeeds; spot-check the emitted CSS is present. (Full visual-regression runs at the merge gate, Task 27.)

- [ ] **Step 5: Gate `G`** (`prettier --check` on `main.tsx`).

- [ ] **Step 6: Commit**
```bash
git add src/shared/styles/index.css src/shared/styles/scrollbar-hide.css src/main.tsx
git rm --cached src/App.css 2>/dev/null || true
git commit -m "refactor(fe): relocate styles to shared/styles, drop dead App.css (Phase 11a; Spec14 Q12)"
```

**Stage 11a complete.** `src/utils/` is now empty; `src/styles/` gone; `src/components/` holds `ui/`, `market-research/`, `MiniLineChart`/`MiniPieChart` already moved, plus `PWAInstallPrompt` moved.

---

## Stage 11b — auth + api infrastructure

Touches the widest import surface. Consolidates `jwt` + the renamed `useAuthToken` into `shared/auth/`, moves the base transport into `shared/api/`, deletes the rate-limiter shim, and repoints the lead-stream residue's auth/api import **lines in place** (the residue files relocate in 11d).

### Task 9: `jwt.ts` → `shared/auth/jwt.ts`

`jwt.ts` imports only `@/shared/api/client` + `@/shared/api/contracts` (both stay valid — `shared/auth → shared/api` is allowed). Consumers import the default `jwtManager`; repoint is a pure path swap to the deep path `@/shared/auth/jwt`.

**Files:**
- Move: `src/lib/jwt.ts` → `src/shared/auth/jwt.ts` (+ `src/lib/__tests__/jwtAuthEndpoint.test.ts` → `src/shared/auth/__tests__/jwtAuthEndpoint.test.ts`)
- Modify: `src/shared/auth/index.ts`; 5 consumer files

- [ ] **Step 1: Move**
```bash
mkdir -p src/shared/auth/__tests__
git mv src/lib/jwt.ts src/shared/auth/jwt.ts
git mv src/lib/__tests__/jwtAuthEndpoint.test.ts src/shared/auth/__tests__/jwtAuthEndpoint.test.ts
```

- [ ] **Step 2: Repoint all `@/lib/jwt` importers** (default-import shape preserved):
```bash
grep -rl '@/lib/jwt"' src | xargs sed -i 's#@/lib/jwt"#@/shared/auth/jwt"#g'
grep -rn '@/lib/jwt' src   # expect: no output
```
Touches: `shared/auth/__tests__/jwtAuthEndpoint.test.ts`, `shared/api/__tests__/client.test.ts:5`, `features/mission-control/components/data-sources/DataSourcesManager.tsx:54`, `features/market-research/components/scout-chat/AddLeadModal.tsx:13`, and (later, in Task 13) `LeadsTable`. (`useAuthToken.ts`'s relative `../lib/jwt` is handled in Task 10.)

- [ ] **Step 3: Add barrel export** to `src/shared/auth/index.ts` (discoverability; TD-FE-54):
```ts
export { default as jwtManager } from "./jwt";
```

- [ ] **Step 4: Normalize** the moved file, the test, the barrel, and the consumers.

- [ ] **Step 5: Gate `G`.**

- [ ] **Step 6: Commit**
```bash
git add src/shared/auth/jwt.ts src/shared/auth/__tests__/jwtAuthEndpoint.test.ts src/shared/auth/index.ts src/shared/api/__tests__/client.test.ts src/features/mission-control/components/data-sources/DataSourcesManager.tsx src/features/market-research/components/scout-chat/AddLeadModal.tsx
git commit -m "refactor(fe): move jwt into shared/auth (Phase 11b; TD-FE-54)"
```

### Task 10: `useAuth` → `shared/auth/useAuthToken.ts` (rename)

The composition hook (Firebase auth + tenant + jwt token lifecycle) collides by name with `shared/auth`'s Firebase `useAuth`. Move + rename to `useAuthToken`; export from the barrel; repoint 5 call sites + 4 `vi.mock`s.

**Files:**
- Move: `src/hooks/useAuth.ts` → `src/shared/auth/useAuthToken.ts`
- Modify: `src/shared/auth/index.ts`; 4 mission-control SUTs + 4 test mocks; (LeadsTable in Task 13)

- [ ] **Step 1: Move + rewrite internals**
```bash
git mv src/hooks/useAuth.ts src/shared/auth/useAuthToken.ts
```
Edit `src/shared/auth/useAuthToken.ts`:
  - line 3: `import jwtManager from "../lib/jwt";` → `import jwtManager from "./jwt";`
  - line 5: `import { useAuth as useFirebaseAuth } from "@/shared/auth";` → `import { useAuth as useFirebaseAuth } from "./AuthContext";` (avoid a barrel self-cycle)
  - line 6: `import { useTenant } from "@/shared/tenant";` — unchanged
  - line 8: `export const useAuth = () => {` → `export const useAuthToken = () => {`

- [ ] **Step 2: Add barrel export** to `src/shared/auth/index.ts`:
```ts
export { useAuthToken } from "./useAuthToken";
```

- [ ] **Step 3: Repoint the 4 mission-control SUTs** — in each, change the import and every call site:
  - `import { useAuth } from "@/hooks/useAuth";` → `import { useAuthToken } from "@/shared/auth";`
  - every `useAuth(` → `useAuthToken(`
  Files: `data-sources/DataSourcesManager.tsx:52`, `icp/ICPManager.tsx:12`, `company-profile/CompanyProfileForm.tsx:25`, `pages/MissionControlPage.tsx:16`.

- [ ] **Step 4: Repoint the 4 `vi.mock`s** (preserve real barrel exports via `importOriginal`, rename the key). In each test, replace the `vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }) }));` block with:
```ts
vi.mock("@/shared/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/auth")>()),
  useAuthToken: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));
```
Files: `data-sources/__tests__/DataSourcesManager.test.tsx:9`, `icp/__tests__/ICPManager.test.tsx:8`, `company-profile/__tests__/CompanyProfileForm.test.tsx:14`, `pages/__tests__/MissionControlPage.test.tsx:38`.

- [ ] **Step 5: Confirm no stragglers**
```bash
grep -rn '@/hooks/useAuth' src   # expect: no output
```

- [ ] **Step 6: Normalize** all touched files.

- [ ] **Step 7: Gate `G`** — run the 4 mission-control tests explicitly: `npx vitest run src/features/mission-control`.

- [ ] **Step 8: Commit**
```bash
git add src/shared/auth/useAuthToken.ts src/shared/auth/index.ts src/features/mission-control
git commit -m "refactor(fe): move+rename useAuth to shared/auth/useAuthToken (Phase 11b; TD-FE-54)"
```

### Task 11: `lib/api.ts` → `shared/api/transport.ts`

Verbatim move of the base transport. `shared/api/client.ts` already imports it; its import becomes relative.

**Files:**
- Move: `src/lib/api.ts` → `src/shared/api/transport.ts`
- Modify: `src/shared/api/client.ts:5`; 18 other consumers

- [ ] **Step 1: Move**
```bash
git mv src/lib/api.ts src/shared/api/transport.ts
```

- [ ] **Step 2: Repoint `shared/api/client.ts:5`** to relative: `@/lib/api` → `./transport`.

- [ ] **Step 3: Repoint the remaining 18 `@/lib/api` sites**
```bash
grep -rl '@/lib/api"' src | xargs sed -i 's#@/lib/api"#@/shared/api/transport"#g'
grep -rn '@/lib/api"' src   # expect: no output
```
Touches 4 features (customers, market-research, mission-control, strategist), `shared/auth/AuthContext.tsx:13`, `test/msw/handlers.ts:17`, several `__tests__`, and (later, Task 13) `LeadsTable`.

- [ ] **Step 4: Normalize** the moved file + `client.ts` + all consumers.

- [ ] **Step 5: Gate `G`** — the `/icp` proxy-bypass + rate-limit behavior is covered by `shared/api/__tests__`; confirm those pass.

- [ ] **Step 6: Commit**
```bash
git add src/shared/api/transport.ts src/shared/api/client.ts src/shared/auth/AuthContext.tsx src/features src/test/msw/handlers.ts
git commit -m "refactor(fe): move base transport lib/api to shared/api/transport (Phase 11b)"
```

### Task 12: Delete the `rateLimitManager` shim; relocate its behavioral test

(Refinements 1–2.) The shim has **0 runtime importers**. Its test is a behavioral characterization of the canonical `RateLimitManager` and is **relocated**, not deleted.

**Files:**
- Delete: `src/lib/rateLimitManager.ts`
- Move: `src/lib/__tests__/rateLimitManager.test.ts` → `src/shared/api/__tests__/rateLimiter.test.ts`
- Modify: `src/shared/api/__tests__/client.test.ts` (delete R3 block + unused import)

- [ ] **Step 1: Delete the shim**
```bash
git rm src/lib/rateLimitManager.ts
```

- [ ] **Step 2: Relocate the test**
```bash
git mv src/lib/__tests__/rateLimitManager.test.ts src/shared/api/__tests__/rateLimiter.test.ts
```

- [ ] **Step 3: Repoint the relocated test's 3 dynamic imports** to the canonical module. `rateLimiter.ts` exports `rateLimiter` (the instance), `RateLimitManager`, `executeWithRateLimit`. Use an alias so the existing local `rateLimitManager` bindings + assertions stay verbatim:
  - line 26 & 32: `const { rateLimitManager } = await import("@/lib/rateLimitManager");` → `const { rateLimiter: rateLimitManager } = await import("@/shared/api/rateLimiter");`
  - lines 43, 71, 116, 140, 167, 213: `await import("@/lib/rateLimitManager")` → `await import("@/shared/api/rateLimiter")` (the `{ RateLimitManager }` destructure is unchanged — the class export exists).
  - line 239: `const { executeWithRateLimit, rateLimitManager } = await import("@/lib/rateLimitManager");` → `const { executeWithRateLimit, rateLimiter: rateLimitManager } = await import("@/shared/api/rateLimiter");`
  - Update the file's header comment to reference `@/shared/api/rateLimiter` directly (no shim).
```bash
grep -rn '@/lib/rateLimitManager' src   # expect: no output
```

- [ ] **Step 4: Fix `src/shared/api/__tests__/client.test.ts`** — delete the now-moot shim-identity test:
  - Delete the `describe("client.ts — single rate-limiter invariant (R3)", …)` block (lines 14–19).
  - Delete the now-unused `import { rateLimiter } from "@/shared/api/rateLimiter";` (line 7). (Verify `rateLimiter` is referenced nowhere else in the file before removing.)

- [ ] **Step 5: Normalize** the relocated test + `client.test.ts`.

- [ ] **Step 6: Gate `G`** — run both explicitly: `npx vitest run src/shared/api/__tests__/rateLimiter.test.ts src/shared/api/__tests__/client.test.ts`. Both green.

- [ ] **Step 7: Commit**
```bash
git add src/shared/api/__tests__/rateLimiter.test.ts src/shared/api/__tests__/client.test.ts
git rm --cached src/lib/rateLimitManager.ts 2>/dev/null || true
git commit -m "refactor(fe): delete rateLimitManager shim, relocate its behavioral test to shared/api (Phase 11b)"
```

### Task 13: In-place repoint of the lead-stream residue's auth/api imports

`LeadsTable.tsx` stays at `components/market-research/lead-stream/` until 11d, but its `useAuth`/`jwt`/`api` imports point to files that moved in 11b. Repoint the **lines in place** (the file does not move yet). These are absolute `@/` imports, so they remain valid after the file relocates in Task 19a. **This is an intentional intermediate state** (per spec §6 cross-stage note): a file in a legacy directory importing exclusively from the new `shared/` layout — expected, not a smell, until Task 19a relocates the file itself.

**Files:** `src/components/market-research/lead-stream/LeadsTable.tsx`

- [ ] **Step 1: Repoint LeadsTable**
  - line 49: `import { useAuth } from "@/hooks/useAuth";` → `import { useAuthToken } from "@/shared/auth";`, and rename every `useAuth(` call → `useAuthToken(`.
  - line 51: `import jwtManager from "@/lib/jwt";` → `import jwtManager from "@/shared/auth/jwt";`
  - line 50: `import { buildApiUrl } from "@/lib/api";` → `import { buildApiUrl } from "@/shared/api/transport";`
  - (line 48 `use-toast` is repointed in Task 15.)

- [ ] **Step 2: Confirm**
```bash
grep -n '@/hooks/useAuth\|@/lib/jwt\|@/lib/api' src/components/market-research/lead-stream/LeadsTable.tsx   # expect: no output
```

- [ ] **Step 3: Normalize** `LeadsTable.tsx`.

- [ ] **Step 4: Gate `G`.**

- [ ] **Step 5: Commit**
```bash
git add src/components/market-research/lead-stream/LeadsTable.tsx
git commit -m "refactor(fe): repoint lead-stream residue auth/api imports in place (Phase 11b)"
```

**Stage 11b complete.** `src/lib/` now holds only `utils.ts` (cn), the score libs (`leadStreamHeatmapSession`, `marketScoreDescriptions`, `marketScoresHeatmap`), and their `__tests__`.

---

## Stage 11c — ui-layer co-locations + ADR-0005

`cn`, `use-toast`, `use-mobile` are the **complete** set of legacy symbols imported by locked `components/ui/` files. They cannot move to `shared/` (would break `ui ↛ shared`); they co-locate into `components/ui/`. Within `ui/`, consumers use relative imports; non-ui consumers use `@/components/ui/*` (`features → ui` is allowed).

### Task 14: `cn` → `components/ui/utils.ts`; delete `lib/utils.ts`

**Files:**
- Create: `src/components/ui/utils.ts`, `src/components/ui/__tests__/utils.test.ts`
- Delete: `src/lib/utils.ts`, `src/lib/__tests__/utils.test.ts`
- Modify: 30 `ui/` files + 3 non-ui (Header, Sidebar, IcpWizard)

- [ ] **Step 1: Create `src/components/ui/utils.ts`**:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create the `cn` test** `src/components/ui/__tests__/utils.test.ts` — move the `describe("cn", …)` block (lines 8–41 of `lib/__tests__/utils.test.ts`) verbatim, with header:
```ts
import { describe, expect, it } from "vitest";

import { cn } from "../utils";
```

- [ ] **Step 3: Delete the legacy files**
```bash
git rm src/lib/utils.ts src/lib/__tests__/utils.test.ts
```

- [ ] **Step 4: Repoint the 30 `ui/` files** to relative `./utils`:
```bash
grep -rl '@/lib/utils' src/components/ui | xargs sed -i 's#@/lib/utils#./utils#g'
```

- [ ] **Step 5: Repoint the 3 non-ui consumers** to `@/components/ui/utils`:
  - `features/shell/components/Header.tsx:34`, `features/shell/components/Sidebar.tsx:338`, `features/mission-control/components/icp/IcpWizard.tsx:27`: `@/lib/utils` → `@/components/ui/utils`.

- [ ] **Step 6: Delete the dead commented lines** in `features/shell/components/Sidebar.tsx` (lines 15 and 133 — the `// … import { cn } from "@/lib/utils";` comments).

- [ ] **Step 7: Confirm**
```bash
grep -rn '@/lib/utils' src   # expect: no output
```

- [ ] **Step 8: Normalize** all touched files — `eslint --fix` is required here (relative `./utils` reclassifies from the `internal` group to `sibling`, so `import-x/order` reorders).

- [ ] **Step 9: Gate `G`** — run `npx vitest run src/components/ui/__tests__/utils.test.ts`.

- [ ] **Step 10: Commit**
```bash
git add src/components/ui/utils.ts src/components/ui/__tests__/utils.test.ts src/components/ui src/features/shell/components/Header.tsx src/features/shell/components/Sidebar.tsx src/features/mission-control/components/icp/IcpWizard.tsx
git rm --cached src/lib/utils.ts src/lib/__tests__/utils.test.ts 2>/dev/null || true
git commit -m "refactor(fe): co-locate cn into components/ui/utils (Phase 11c)"
```

### Task 15: `use-toast` → `components/ui/use-toast.ts` (replace the shim)

The real hook moves into `components/ui/use-toast.ts`, replacing the 3-line re-export shim. Its `@/components/ui/toast` type import becomes relative.

**Files:**
- Overwrite: `src/components/ui/use-toast.ts` (shim → real impl)
- Delete: `src/hooks/use-toast.ts`
- Modify: `ui/toaster.tsx` + ~28 other consumers (features, `shared/chat/ContextChat`, residue `LeadsTable`, `vi.mock`s)

- [ ] **Step 1: Overwrite `src/components/ui/use-toast.ts`** with the full implementation from `src/hooks/use-toast.ts`, changing only the type-import line:
  - `import type { ToastActionElement, ToastProps } from "@/components/ui/toast";` → `import type { ToastActionElement, ToastProps } from "./toast";`
  - (Paste the rest of the 187-line implementation verbatim, ending with `export { useToast, toast };`.)

- [ ] **Step 2: Delete the old hook**
```bash
git rm src/hooks/use-toast.ts
```

- [ ] **Step 3: Repoint `ui/toaster.tsx`** (line 9) to relative: `@/hooks/use-toast` → `./use-toast`.

- [ ] **Step 4: Repoint every other consumer** to `@/components/ui/use-toast` (excludes `toaster.tsx`, already relative, and `use-toast.ts` itself which is the new impl):
```bash
grep -rl '@/hooks/use-toast' src | xargs sed -i 's#@/hooks/use-toast#@/components/ui/use-toast#g'
grep -rn '@/hooks/use-toast' src   # expect: no output
```
This rewrites the 5 features, `shared/chat/ContextChat.tsx:18`, the residue `LeadsTable.tsx:48`, and the `vi.mock("@/hooks/use-toast", …)` strings in the mr + mc tests. (These mocks are simple total-replaces — the module exports only `useToast`/`toast` — so the path swap is sufficient.)

- [ ] **Step 5: Normalize** all touched files (`eslint --fix` reorders the `@/components/ui/use-toast` vs other internal imports alphabetically).

- [ ] **Step 6: Gate `G`** — run the toast-consuming suites: `npx vitest run src/features/mission-control src/features/market-research src/shared/chat`.

- [ ] **Step 7: Commit**
```bash
git add src/components/ui/use-toast.ts src/components/ui/toaster.tsx src/features src/shared/chat/ContextChat.tsx src/components/market-research/lead-stream/LeadsTable.tsx
git rm --cached src/hooks/use-toast.ts 2>/dev/null || true
git commit -m "refactor(fe): co-locate use-toast into components/ui (replaces shim) (Phase 11c)"
```

### Task 16: `use-mobile` → `components/ui/use-mobile.tsx`

Imports only React — a clean move.

**Files:**
- Move: `src/hooks/use-mobile.tsx` → `src/components/ui/use-mobile.tsx`
- Modify: `ui/sidebar.tsx:13` + 3 shell consumers

- [ ] **Step 1: Move**
```bash
git mv src/hooks/use-mobile.tsx src/components/ui/use-mobile.tsx
```

- [ ] **Step 2: Repoint `ui/sidebar.tsx:13`** to relative: `@/hooks/use-mobile` → `./use-mobile`.

- [ ] **Step 3: Repoint the 3 shell consumers** to `@/components/ui/use-mobile`:
  - `features/shell/components/Header.tsx:33`, `features/shell/components/Sidebar.tsx:337`, `features/shell/components/PWAInstallPrompt.tsx:5` (moved here in Task 6).
```bash
grep -rn '@/hooks/use-mobile' src   # expect: no output
```

- [ ] **Step 4: Normalize** all touched files (`eslint --fix`).

- [ ] **Step 5: Gate `G`.**

- [ ] **Step 6: Commit**
```bash
git add src/components/ui/use-mobile.tsx src/components/ui/sidebar.tsx src/features/shell/components/Header.tsx src/features/shell/components/Sidebar.tsx src/features/shell/components/PWAInstallPrompt.tsx
git commit -m "refactor(fe): co-locate use-mobile into components/ui (Phase 11c)"
```

### Task 17: Record ADR-0005

**Files:** Create `docs/adr/0005-ui-layer-consumed-utilities-live-in-components-ui.md` (repo-root).

- [ ] **Step 1: Write the ADR** (slim 3-part Brewra form):
```markdown
# ADR-0005 — UI-layer-consumed utilities live in `components/ui/`

**Status:** Accepted
**Date:** 2026-06-05

## Context

The dependency zones (Spec 14 §3.3, enforced by `import-x/no-restricted-paths`) say `components/ui/` (the locked shadcn primitives) may import only npm and itself — never `shared/` or `features/`. Phase 11 drains the legacy `src/hooks/` and `src/lib/` directories by promoting shared utilities to `src/shared/`. But three legacy utilities are imported by locked `ui/` primitives: `cn` (`@/lib/utils`, 30 `ui/` files), `useToast` (`@/hooks/use-toast`, `ui/toaster.tsx` + the prior re-export shim), and `useIsMobile` (`@/hooks/use-mobile`, `ui/sidebar.tsx`). Promoting any of them to `shared/` would force locked primitives to import upward, violating `ui ↛ shared`. Grepping every `ui/` import confirms these three are the complete set.

## Decision

We will co-locate ui-layer-consumed utilities **inside `components/ui/`**, not in `shared/`: `cn` → `components/ui/utils.ts`, `useToast` → `components/ui/use-toast.ts`, `useIsMobile` → `components/ui/use-mobile.tsx`. `ui/` files import them relatively (`./utils`, `./use-toast`, `./use-mobile`); non-ui consumers import `@/components/ui/*` (`features → ui` is allowed). This mirrors shadcn's own convention of shipping `cn` and the toast hook alongside its components.

## Consequences

The `components/ui/` zone rule ("npm + itself only") becomes true and is locked by the Phase 11e lint tightening. Future work that adds a shadcn component shipping its own hook/util follows this precedent: the hook lives in `components/ui/`, not `shared/`. A utility that is genuinely cross-feature **and not** consumed by a `ui/` primitive still goes to `shared/` under the ≥2-feature rule — this ADR is the narrow exception for the ui-primitive layer, not a general escape hatch. Reversing it (e.g. relaxing `ui → shared`) requires a superseding ADR.
```

- [ ] **Step 2: Commit** (ADRs are outside the frontend Prettier scope; no `--check` needed)
```bash
git add docs/adr/0005-ui-layer-consumed-utilities-live-in-components-ui.md
git commit -m "docs(fe): ADR-0005 — ui-layer-consumed utilities live in components/ui (Phase 11c)"
```

**Stage 11c complete.** `src/hooks/` is now empty; `components/ui/` imports no `@/hooks|@/lib|@/utils` path.

---

## Stage 11d — lead-stream residue

Resolved by the verified trace: `leadData` → `shared/lib/` (strategist + market-research ≥ 2); the cluster (`LeadsTable`, `OpportunityDashboard`, `LeadStreamTab`, `ScoutLeadStream`, + the 3 score libs that feed only `LeadsTable`) → `features/market-research/`; `EditDropdownMenu` → `features/customers/` (sole consumer). Two green commits: promote `leadData` first (leaf), then relocate the cluster (so the moved files use relative same-feature imports and never trip `import-x/no-internal-modules`).

### Task 18: Promote `leadData` → `shared/lib/leadData.ts`

`leadData.ts` has no imports (self-contained data + helpers). Repoint **all** consumers in place — including the score libs (still in `lib/`) and the residue files (still in `components/market-research/`) — to `@/shared/lib/leadData`.

**Files:**
- Move: `src/components/market-research/lead-stream/leadData.ts` → `src/shared/lib/leadData.ts`
- Modify: 8 consumer import sites

- [ ] **Step 1: Move**
```bash
git mv src/components/market-research/lead-stream/leadData.ts src/shared/lib/leadData.ts
```

- [ ] **Step 2: Repoint every consumer** (alias + relative forms) to `@/shared/lib/leadData`:
```bash
# alias importers (score libs in lib/, strategist features)
grep -rl '@/components/market-research/lead-stream/leadData' src | xargs sed -i 's#@/components/market-research/lead-stream/leadData#@/shared/lib/leadData#g'
# relative importers inside the still-residue cluster
sed -i 's#"./lead-stream/leadData"#"@/shared/lib/leadData"#' src/components/market-research/ScoutLeadStream.tsx
sed -i 's#"./leadData"#"@/shared/lib/leadData"#' src/components/market-research/lead-stream/OpportunityDashboard.tsx src/components/market-research/lead-stream/LeadsTable.tsx
grep -rn 'lead-stream/leadData\|"./leadData"\|"\.\./lead-stream/leadData"' src   # expect: no output
```
Touches: `lib/leadStreamHeatmapSession.ts:1`, `lib/marketScoresHeatmap.ts:1-2`, `features/strategist/components/StrategistLeadStream.tsx:14`, `features/strategist/components/StrategistRecommendations.tsx:16`, `components/market-research/ScoutLeadStream.tsx:6`, `components/market-research/lead-stream/OpportunityDashboard.tsx:19`, `components/market-research/lead-stream/LeadsTable.tsx:27`.

- [ ] **Step 3: Normalize** the moved file + all 7 touched files.

- [ ] **Step 4: Gate `G`** (`lib → shared`, `features → shared`, and residue `→ shared` are all allowed; tree stays green).

- [ ] **Step 5: Commit**
```bash
git add src/shared/lib/leadData.ts src/lib/leadStreamHeatmapSession.ts src/lib/marketScoresHeatmap.ts src/features/strategist/components src/components/market-research
git commit -m "refactor(fe): promote leadData to shared/lib (Phase 11d; TD-FE-63)"
```

### Task 19a: Relocate the lead-stream cluster (atomic)

One commit. Move the score libs + their tests → `features/market-research/lib/` and the cluster components → `features/market-research/components/`; fix all internal relative imports + the `MarketResearchPage` consumer. `EditDropdownMenu` is **independent of the cluster** (verified: it imports only `lucide-react`, `react`, and `@/components/ui/*` — no `leadData`/`LeadsTable`/heatmap dependency) and moves separately in Task 19b, which also removes the now-empty `components/market-research/` directory.

**Files:**
- Move (score libs + tests): `src/lib/{leadStreamHeatmapSession,marketScoreDescriptions,marketScoresHeatmap}.ts` → `src/features/market-research/lib/`; `src/lib/__tests__/{marketScoreDescriptions,marketScoresHeatmap}.test.ts` → `src/features/market-research/lib/__tests__/`
- Move (components): `src/components/market-research/ScoutLeadStream.tsx` → `src/features/market-research/components/`; `src/components/market-research/lead-stream/{LeadStreamTab,LeadsTable,OpportunityDashboard}.tsx` → `src/features/market-research/components/lead-stream/`
- Modify: external consumer `MarketResearchPage`

- [ ] **Step 1: Move the score libs + tests**
```bash
git mv src/lib/leadStreamHeatmapSession.ts src/features/market-research/lib/leadStreamHeatmapSession.ts
git mv src/lib/marketScoreDescriptions.ts src/features/market-research/lib/marketScoreDescriptions.ts
git mv src/lib/marketScoresHeatmap.ts src/features/market-research/lib/marketScoresHeatmap.ts
git mv src/lib/__tests__/marketScoreDescriptions.test.ts src/features/market-research/lib/__tests__/marketScoreDescriptions.test.ts
git mv src/lib/__tests__/marketScoresHeatmap.test.ts src/features/market-research/lib/__tests__/marketScoresHeatmap.test.ts
```

- [ ] **Step 2: Move the cluster components** (leave `EditDropdownMenu` and the `components/market-research/` dir in place for Task 19b)
```bash
mkdir -p src/features/market-research/components/lead-stream
git mv src/components/market-research/ScoutLeadStream.tsx src/features/market-research/components/ScoutLeadStream.tsx
git mv src/components/market-research/lead-stream/LeadStreamTab.tsx src/features/market-research/components/lead-stream/LeadStreamTab.tsx
git mv src/components/market-research/lead-stream/LeadsTable.tsx src/features/market-research/components/lead-stream/LeadsTable.tsx
git mv src/components/market-research/lead-stream/OpportunityDashboard.tsx src/features/market-research/components/lead-stream/OpportunityDashboard.tsx
rmdir src/components/market-research/lead-stream 2>/dev/null || true
```

- [ ] **Step 3: Repoint the relocated score-lib tests** — `@/lib/marketScoreDescriptions` → `../marketScoreDescriptions`; `@/lib/marketScoresHeatmap` → `../marketScoresHeatmap`.

- [ ] **Step 4: Repoint `LeadsTable.tsx`'s score-lib imports** (now relative within the feature; from `components/lead-stream/` up to `lib/` is `../../lib/`):
  - line 55: `@/lib/leadStreamHeatmapSession` → `../../lib/leadStreamHeatmapSession`
  - line 59: `@/lib/marketScoreDescriptions` → `../../lib/marketScoreDescriptions`
  - line 63: `@/lib/marketScoresHeatmap` → `../../lib/marketScoresHeatmap`
  (Its `@/shared/lib/leadData`, `@/shared/auth`, `@/shared/auth/jwt`, `@/shared/api/transport`, `@/components/ui/use-toast`, `@/shared/types/escape-hatches` imports are absolute — already valid, no change.)

- [ ] **Step 5: Repoint the moved components' relative cross-references**
  - `ScoutLeadStream.tsx`: `./lead-stream/LeadsTable` and `./lead-stream/OpportunityDashboard` remain valid (the `lead-stream/` subdir moved with it). No change unless the import strings differ — verify with typecheck.
  - `LeadStreamTab.tsx:7`: `@/components/market-research/ScoutLeadStream` → `../ScoutLeadStream` (now a sibling-dir relative within the feature).

- [ ] **Step 6: Repoint `MarketResearchPage.tsx:21`** — `@/components/market-research/lead-stream/LeadStreamTab` → `../components/lead-stream/LeadStreamTab` (same-feature relative).

- [ ] **Step 7: Confirm only `EditDropdownMenu` remains in the residue**
```bash
ls src/components/market-research   # expect: EditDropdownMenu.tsx only
grep -rn '@/components/market-research/lead-stream\|@/components/market-research/ScoutLeadStream' src   # expect: no output
```

- [ ] **Step 8: Normalize** every moved + touched file (`eslint --fix` for ordering).

- [ ] **Step 9: Gate `G`** — run `npx vitest run src/features/market-research src/features/strategist`. (Tree is green: `EditDropdownMenu` still at its legacy path, its two customers consumers still resolve it.)

- [ ] **Step 10: Commit**
```bash
git add src/features/market-research
git commit -m "refactor(fe): drain lead-stream cluster into features/market-research (Phase 11d; TD-FE-63)"
```

### Task 19b: Move `EditDropdownMenu` → `features/customers/`; remove the empty residue dir

**Files:**
- Move: `src/components/market-research/EditDropdownMenu.tsx` → `src/features/customers/components/icp-intelligence/EditDropdownMenu.tsx`
- Modify: `CurrentIcpsTable.tsx:19`, `SuggestedICPCard.tsx:21`

- [ ] **Step 1: Move + remove the now-empty residue dir**
```bash
git mv src/components/market-research/EditDropdownMenu.tsx src/features/customers/components/icp-intelligence/EditDropdownMenu.tsx
rmdir src/components/market-research 2>/dev/null || true
```

- [ ] **Step 2: Repoint the 2 consumers** (co-located now → relative `./EditDropdownMenu`):
  - `features/customers/components/icp-intelligence/CurrentIcpsTable.tsx:19`: `@/components/market-research/EditDropdownMenu` → `./EditDropdownMenu`
  - `features/customers/components/icp-intelligence/SuggestedICPCard.tsx:21`: same → `./EditDropdownMenu`
  - `EditDropdownMenu.tsx`'s own imports are `@/components/ui/*` (absolute, valid after the move) — no internal repoint needed; confirm with typecheck.

- [ ] **Step 3: Confirm the residue is gone**
```bash
grep -rn '@/components/market-research' src   # expect: no output
ls src/components/market-research 2>&1   # expect: No such file or directory
```

- [ ] **Step 4: Normalize** the moved file + 2 consumers (`eslint --fix`).

- [ ] **Step 5: Gate `G`** — run `npx vitest run src/features/customers`.

- [ ] **Step 6: Commit**
```bash
git add src/features/customers
git commit -m "refactor(fe): move EditDropdownMenu into features/customers (Phase 11d; TD-FE-63)"
```

**Stage 11d complete.** `src/lib/`, `src/hooks/`, `src/utils/`, `src/components/market-research/` are all empty/gone; `src/components/` holds only `ui/`.

---

## Stage 11e — capstone: lock the drain (DoD §6.1)

### Task 20: Delete the empty legacy directories

- [ ] **Step 1: Confirm empty, then remove**
```bash
for d in src/hooks src/lib src/utils; do echo "$d:"; ls -A "$d" 2>/dev/null || echo "  gone"; done
rmdir src/lib/__tests__ src/lib src/hooks src/utils 2>/dev/null || true
for d in src/hooks src/lib src/utils src/contexts src/services src/pages; do test -e "$d" && echo "STILL PRESENT: $d" || echo "absent: $d"; done
ls -1 src/components   # expect: only "ui"
```
Expected: all six legacy dirs absent; `src/components/` lists only `ui`.

- [ ] **Step 2: No commit needed.** Every legacy *file* deletion was already committed by its relocating task (`git mv`/`git rm`); git does not track empty directories, so the `rmdir` in Step 1 only tidies the working tree and stages nothing. Confirm `git status` is clean (no staged or unstaged changes) and proceed to Task 21. (Do **not** `git add -A` — there is nothing to add, and the convention forbids it.)

### Task 21: Tighten lint — blocking zones forbidding legacy-path imports (red-green)

Extend the existing `import-x/no-restricted-paths` (in `eslint.config.js`) so `features/**` and `shared/**` can never import a legacy path again.

**Runs after Task 20** (sequential — see the Conventions failure/sequencing note). Step 2's red proof creates and then deletes `src/lib/_scratch.ts`; this only works cleanly once Task 20 has already removed the real `src/lib/`, and it must not overlap Task 20's emptiness check. **No commit is made until the working zone form passes lint** — if the array form errors at config load, the agent reverts it in place and switches to the single-string-pair fallback *before* any commit, so a failed attempt never pollutes history.

**Files:** `frontend/eslint.config.js`

- [ ] **Step 1: Add the zones.** In `eslint.config.js`, inside the existing `"import-x/no-restricted-paths"` rule's `zones` array (after the 3 existing zones), append:
```js
{
  target: ["./src/features", "./src/shared"],
  from: ["./src/hooks", "./src/lib", "./src/utils", "./src/contexts", "./src/services", "./src/pages"],
  message:
    "features/ and shared/ must not import legacy directories — Phase 11 drained these into shared/ and components/ui/. Import from @/shared/* or @/components/ui/* instead.",
},
{
  target: ["./src/features", "./src/shared"],
  from: "./src/components",
  except: ["./ui"],
  message:
    "features/ and shared/ may only import @/components/ui/* — all other components were relocated into features/ or shared/ in Phase 11.",
},
```
(`target`/`from` accept arrays in `import-x`. If `npm run lint` errors at config load, fall back to one zone per `(target, from-dir)` pair — 14 single-string zones — and re-run.)

- [ ] **Step 2: Prove the rule fires (red).** A zone matches by *resolved filesystem path*, so the red proof needs a legacy-dir file that actually resolves. Create a throwaway `src/lib/_scratch.ts`:
```ts
export const x = 1;
```
and import it from a feature file — add to the top of `src/features/shell/components/Header.tsx`:
```ts
import { x as _scratch } from "@/lib/_scratch";
```
Run `npm run lint`. Expected: **error** citing the Phase-11 zone message ("features/ and shared/ must not import legacy directories …"), proving the `from: ./src/lib` zone is active.

- [ ] **Step 3: Revert the scratch (green).** Remove the import line from `Header.tsx` and delete the dummy:
```bash
rm -f src/lib/_scratch.ts
rmdir src/lib 2>/dev/null || true
```
Run `npm run lint`. Expected: **green** (0 warnings).

- [ ] **Step 4: Gate** — `npm run typecheck && npm run lint` green; `npx prettier --check eslint.config.js`.

- [ ] **Step 5: Commit**
```bash
git add eslint.config.js
git commit -m "chore(fe): block features/shared imports of legacy paths (Phase 11e capstone)"
```

### Task 22: DoD §6.1 verification

- [ ] **Step 1: Run the mechanical checks** (all must pass):
```bash
# legacy dirs gone; components is ui-only
for d in src/hooks src/lib src/utils src/contexts src/services src/pages; do test -e "$d" && echo "FAIL: $d present" || true; done
test "$(ls -1 src/components)" = "ui" && echo "OK: components = ui only" || echo "FAIL: components has non-ui entries"
# no legacy import specifier under features/ or shared/ (AST-immune grep on import lines)
grep -rnE 'from "@/(hooks|lib|utils|contexts|services|pages)(/|")' src/features src/shared && echo "FAIL: legacy import found" || echo "OK: no legacy imports in features/shared"
# components/ui imports no @/hooks|@/lib|@/utils
grep -rnE 'from "@/(hooks|lib|utils)(/|")' src/components/ui && echo "FAIL: ui imports legacy" || echo "OK: ui clean"
# no non-ui @/components import under features/shared (grep -v filters the allowed ui path; ERE has no lookahead)
grep -rnE 'from "@/components/' src/features src/shared | grep -v '@/components/ui' && echo "FAIL: non-ui component import" || echo "OK: only @/components/ui used"
```
Expected: every line prints `OK` (or nothing for the negative greps).

- [ ] **Step 2: Route resolution** — confirm `App.tsx`'s route imports all resolve to `@/features/*` barrels (no legacy paths). Visual check of `App.tsx` imports.

No commit (verification only).

### Task 23: Resolve TD-FE entries, log Spec 14 deltas, update READMEs

**Files (repo-root):** `docs/TECH_DEBT.md` (surgical, **no Prettier**), `specs/14-frontend-refactoring-master-plan-design.md`; per-feature/`shared/*` `README.md`s.

- [ ] **Step 1: Mark TD-FE entries Resolved** — append a `**Resolved (Phase 11):**` line to each, surgically (do not reformat):
  - **TD-FE-54** → `**Resolved (Phase 11):** 2026-06-05. jwt → src/shared/auth/jwt.ts; useAuth → src/shared/auth/useAuthToken.ts (renamed to resolve the name collision with the Firebase useAuth); both re-exported from shared/auth/index.ts.`
  - **TD-FE-57** → `**Resolved (Phase 11):** 2026-06-05. usePageTitle → src/shared/hooks/usePageTitle.ts; all 6 feature pages repointed.`
  - **TD-FE-62** → `**Resolved (Phase 11):** 2026-06-05. leadStreamChatContext → src/features/market-research/lib/leadStreamChatContext.ts (sole-consumer feature; not shared).`
  - **TD-FE-63** → `**Resolved (Phase 11):** 2026-06-05. components/market-research/ fully drained: leadData → shared/lib; ScoutLeadStream + lead-stream/{LeadStreamTab,LeadsTable,OpportunityDashboard} + the 3 score libs → features/market-research; EditDropdownMenu → features/customers.`

- [ ] **Step 2: Log Spec deltas** — (a) in `specs/14-frontend-refactoring-master-plan-design.md` §8, annotate **Q12** (styles → `src/shared/styles/`) and **Q14** (Phase 11 standalone) as **RESOLVED (Phase 11)** per the spec's §13; (b) append a one-line erratum noting Spec 31 §3's summary tree lists `use-toast` under `shared/hooks/` whereas §5.1 (authoritative) places it in `components/ui/` — the implementation followed §5.1. Follow the master plan's existing delta convention (append, don't rewrite shipped text).

- [ ] **Step 3: README touch-ups** — update `shared/README.md` (or add the new `shared/{hooks,lib,types,styles}` subtrees to its inventory) and any per-feature `README.md` whose key-files list changed (market-research gained the lead-stream cluster + score libs + the single-consumer utils; customers gained ErrorBoundary + EditDropdownMenu; shell gained PWAInstallPrompt). Keep edits factual and minimal.

- [ ] **Step 4: Commit** (TECH_DEBT excluded from Prettier; the rest are Markdown)
```bash
git add docs/TECH_DEBT.md specs/14-frontend-refactoring-master-plan-design.md frontend/src/shared/README.md frontend/src/features
git commit -m "docs(fe): resolve TD-FE-54/57/62/63, log Spec14 Q12/Q14 deltas, README touch-ups (Phase 11e)"
```

### Task 24: Full merge-gate preflight

- [ ] **Step 1: Kill any orphan preview/dev server on :5173** by specific PID (never broad `pkill -f`) so e2e/VR test the freshly-built app, not a stale server.

- [ ] **Step 2: Run the full preflight on an idle box** (no sibling sandboxes in flight this phase):
```bash
npm run preflight
```
This runs typecheck + lint + `format:check` + full Vitest + `build` + `bundle:check` + Playwright e2e + `knip`. Expected: all green. `knip` should report no dead code (every moved file has live consumers; the deleted shim + dead `App.css` are removed).

- [ ] **Step 3:** Compare `knip` output against the **Stage 0 Step 2 baseline**. Any finding present in the baseline is pre-existing (not this phase's concern); any *new* finding is a Phase 11 orphan and must be resolved before declaring the phase done — a relocation should net-reduce dead code (the deleted shim + dead `App.css`), never add it.

- [ ] **Step 4: Final commit** (only if preflight produced incidental fixes; otherwise the phase is already committed)
```bash
git status   # confirm clean
```

---

## Self-Review

**Spec coverage** (each Spec 31 section → task):
- §2.1.1 relocate every §1.3 file + repoint all sites → Tasks 1–19 ✓
- §2.1.2 split `lib/utils.ts` → Tasks 3 (sanitizeAnswerText) + 14 (cn) ✓
- §2.1.3 auth-infra cluster → Tasks 9–10 ✓
- §2.1.4 api-transport move + **delete** rateLimitManager shim + repoint its tests → Tasks 11–12 (refined: relocate the behavioral test) ✓
- §2.1.5 lead-stream residue per-file trace → Tasks 18, 19a, 19b ✓
- §2.1.6 styles → Task 8 ✓
- §2.1.7 co-located tests follow subjects; `utils.test.ts` split; `rateLimitManager.test.ts` handled → Tasks 3, 5, 9, 12, 14, 19 ✓
- §2.1.8 capstone (delete dirs, lint, DoD) → Tasks 20–22 ✓
- §2.1.9 README touch-ups → Task 23 ✓
- §5.1 three ui-layer co-locations + ADR-0005 → Tasks 14–17 ✓
- §5.2 useAuth rename → Task 10 ✓
- §5.3 transport + shim delete → Tasks 11–12 ✓
- §6 residue (incl. cross-stage in-place repoint, bidirectional leadData dep) → Tasks 13, 18, 19a, 19b ✓
- §7 styles (incl. App.css liveness, relative→alias) → Task 8 ✓
- §8 capstone → Tasks 20–22 ✓
- §9 5-way sub-split (11a–11e) → stage structure ✓
- §12 TD-FE-54/57/62/63 + §13 Q12/Q14 deltas → Task 23 ✓

**Placeholder scan:** No "TBD"/"handle appropriately". Every code-changing step shows exact code or exact `sed`/`grep`. The two non-derivable file contents (`use-toast.ts` impl, the test-block moves) reference the verbatim source by exact line range and instruct a verbatim paste. ✓

**Type/name consistency:** The renamed hook is `useAuthToken` everywhere (Tasks 10, 13, disposition table, ADR, TD-FE-54 note). The transport is `@/shared/api/transport` everywhere (Tasks 11, 13). `jwtManager` default import preserved at the deep path `@/shared/auth/jwt` (Tasks 9, 13). The rate limiter canonical module is `@/shared/api/rateLimiter` (Task 12). ✓

**Known residual risk:** Task 21's array `target`/`from` for `import-x/no-restricted-paths` — fallback to per-pair single-string zones is documented inline if the array form errors at config load. Task 19a's relative-depth recomputations (`../../lib/…`) are verified by typecheck at the gate. No silent caps.
