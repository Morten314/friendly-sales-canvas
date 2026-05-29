# Frontend Phase 4b — Shell Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the app frame (`Layout`/`Header`/`Sidebar`/`ProfileDialog`) + route guard (`ProtectedRoute`) into `src/features/shell/`, promote `AuthContext`→`src/shared/auth/` and `TenantContext`→`src/shared/tenant/`, rewire `App.tsx`'s imports — with **zero behavior or visual change**.

**Architecture:** A parity-preserving migration. Files move with `git mv` (history preserved); content is unchanged except (1) import-path rewrites and (2) the one deliberate exception — stripping AuthContext's ~186-line commented-out dead block. The `<Routes>` table and provider nesting stay verbatim in `App.tsx` — only its import sources change. The migration is staged **move → rewrite-importers → delete** as a sequence of commits, each kept green by `tsc --noEmit`; the full preflight (incl. pixel-parity visual regression + the login→tenant→mission journey) gates the merge.

**Tech Stack:** React 18 + Vite + TS (strict), `@/` path alias → `src/`, ESLint flat-config (`eslint-plugin-import-x` + the 4a resolver + 4a zone/index-only/`react-refresh` rules), Vitest + RTL, Playwright (VR @ 2% pixel-diff + journeys), knip `--strict`. GNU `sed` (linux).

**Source spec:** `specs/21-frontend-phase-4-scaffolding-shell-design.md` §3 (and §1, §4, §5, §6, §7, §8).

**Prerequisite (hard):** **4a (`plans/21a-frontend-phase-4a-scaffolding.md`) must be merged to `master` before this plan starts.** 4b is the first consumer of 4a's scaffolder, conventions, and lint rules. If `src/features/README.md`, the `scaffold:feature` script, or the `react-refresh` override on `src/shared/**`+`src/features/**` are missing, 4a is not merged — stop.

**Conventions for every task:**
- File ops (`mkdir`, `git mv`, `sed`, `npm`, `eslint --fix`) run from `frontend/`. `git add`/`git commit` run from the monorepo root `/projects/Brewra/brewra-gtm-intelligence` (so cross-cutting `docs/`/`specs/` paths are includable).
- After each rewrite, run `npx eslint --fix src` to settle `import-x/order` (the only auto-fixable rule that the path swaps disturb), then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json` must be green before committing.
- Commit messages: `type(scope):` form; **no `Co-Authored-By` footer**; no `[N/M]`.

**Abort criteria (whole-branch — report to the controller and halt; do NOT force-push, amend already-pushed commits, or revert without sign-off):** the per-task STOP conditions handle "fix this step and continue." Abandon the *branch* and escalate when:
- 4a is not actually merged (Task 0 Step 2 fails) — 4b cannot run on conventions that aren't there.
- The Task 0 baseline preflight is RED before any 4b change.
- The AuthContext dead-block strip can't be reconciled (Task 2 Step 2: the active code can't be cleanly isolated).
- The VR/parity gate fails and the cause can't be found after investigation (Task 6 Step 3).
A half-migrated tree is recoverable from the last green commit; a force-pushed or amended history is not. If a task cannot be resolved after reasonable effort, stop at the last green commit and report.

---

## Task 0: Branch + green baseline + pre-move audit

**Files:** none (verification only).

- [ ] **Step 1: Branch off `master` (with 4a merged)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master
git pull --ff-only       # ensure 4a is present; skip if offline
git checkout -b phase-4b-shell-extraction
```

- [ ] **Step 2: Confirm 4a landed**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
test -f src/features/README.md && echo "OK: features README (4a)"
grep -q "scaffold:feature" package.json && echo "OK: scaffolder script (4a)"
grep -q 'src/features/\*\*' eslint.config.js && echo "OK: react-refresh override extended (4a)"
```
Expected: all three OK. If any fail, STOP — 4a is not merged.

- [ ] **Step 3: Green preflight baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS end-to-end. If RED before any 4b change, STOP and report.

- [ ] **Step 4: Pre-move audit — confirm the move set (spec §3.1)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
ls src/components/layout    # expect EXACTLY: Header.tsx  Layout.tsx  ProfileDialog.tsx  Sidebar.tsx
ls src/contexts             # expect EXACTLY: AuthContext.tsx  SidebarContext.tsx  TenantContext.tsx
test -f src/components/ProtectedRoute.tsx && echo "OK: ProtectedRoute"
test -f src/components/PWAInstallPrompt.tsx && echo "OK: PWAInstallPrompt (STAYS PUT)"
```
Expected: exactly the listed files. If `src/components/layout/` or `src/contexts/` has anything extra (added between spec and execution), reconcile before proceeding (it may need to move too, or be excluded).

- [ ] **Step 5: Audit — enumerate the importer/rewrite sets**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
echo "=== AuthContext importers ==="; grep -rln 'contexts/AuthContext\|"\./AuthContext"' src --include=*.ts --include=*.tsx
echo "=== TenantContext importers ==="; grep -rln 'contexts/TenantContext' src --include=*.ts --include=*.tsx
echo "=== SidebarContext importers ==="; grep -rln 'contexts/SidebarContext' src --include=*.ts --include=*.tsx
echo "=== Layout importers (form check) ==="; grep -rn 'components/layout/Layout' src --include=*.ts --include=*.tsx
echo "=== Header type-import (DeploymentData) ==="; grep -rn 'components/layout/Header' src --include=*.ts --include=*.tsx
echo "=== Does Header export DeploymentData? ==="; grep -n 'export.*DeploymentData\|DeploymentData' src/components/layout/Header.tsx | head
```
Expected, and record the lists for the rewrite tasks:
- **AuthContext** importers ≈ 22 files, of which 5 move into shell (`layout/{Sidebar,Header,ProfileDialog}`, `ProtectedRoute`, `App.tsx` is the provider site) — the rest stay external (~17).
- **TenantContext** importers ≈ the shell-bound files + ~6 external (incl. `pages/TenantSelection.tsx` which imports both `useTenant` **and** `type { Tenant }`).
- **SidebarContext** importers: `App.tsx`, `layout/Sidebar.tsx`, `layout/Header.tsx` only (all shell-bound).
- **Layout** is imported by 11 pages via `@/components/layout/Layout`; **`MarketResearch.tsx` also imports `type { DeploymentData }` from `@/components/layout/Header`** (line ~14). Confirm `Header.tsx` exports `DeploymentData` — it must (it's surfaced through the shell barrel in Task 4). If the grep shows any **relative** form (`../components/layout/...`), note it so the Task 4 sed covers it.

- [ ] **Step 6: Audit — identify the guard-behavior journey (spec §3.5)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
ls e2e/journeys/01-login-tenant-mission.spec.ts && echo "OK: journey present"
ls e2e/journeys/01-login-tenant-mission.spec.ts-snapshots && echo "OK: VR snapshot dir present"
```
Expected: both present. This journey + its VR snapshots are the parity gate for the shell (it renders only on authenticated screens — Login/TenantSelection do not use `Layout`). The guard-behavior assertion check happens in Task 6.

No commit (audit only).

---

## Task 1: Scaffold `features/shell/` (dogfood the 4a scaffolder)

**Files:**
- Create: `frontend/src/features/shell/{types.ts,index.ts,README.md}` (via the scaffolder)

> Spec §1.4, §3 — `features/shell/` is generated by the 4a scaffolder. `shell` is already on the naming map, so no warning.

- [ ] **Step 1: Run the scaffolder**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run scaffold:feature -- shell
ls src/features/shell    # expect: README.md  index.ts  types.ts
```
Expected: three files, no `components/` subdir, no not-on-map warning.

- [ ] **Step 2: Verify green and commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsc --noEmit -p tsconfig.app.json   # generated index.ts has `export {}` — must typecheck
npm run lint
npx knip --strict --no-progress
```
Expected: all PASS. (`shell/index.ts` is `export {}` and `types.ts` has no exports → knip sees no unused exports; both files are reachable as production entries.)

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/shell
git commit -m "feat(fe): scaffold features/shell"
```

---

## Task 2: Promote `AuthContext` → `src/shared/auth/` (strip dead block, rewire all importers)

**Files:**
- Move: `frontend/src/contexts/AuthContext.tsx` → `frontend/src/shared/auth/AuthContext.tsx`
- Create: `frontend/src/shared/auth/index.ts`
- Modify: every AuthContext importer (path swap only)

> Spec §3.2. The dead-block strip (H3) is the **one** deliberate content change. All importers — including the not-yet-moved shell files and `TenantContext.tsx` — are repointed in this commit so it stays green.

- [ ] **Step 1: Move the file (history preserved)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
mkdir -p src/shared/auth
git mv src/contexts/AuthContext.tsx src/shared/auth/AuthContext.tsx
```

- [ ] **Step 2: Strip the commented-out dead block (lines 1–186)**

The active implementation starts at line 187 (`import type { User } from "firebase/auth";`); lines 1–185 are a `//`-commented legacy implementation and line 186 is blank.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# Delete every line BEFORE the first active line (`import type { User } …`) — i.e. the
# whole leading `//`-commented block — by pattern, so it is resilient to the block's
# exact length changing upstream of this plan. (Literal `sed '1,186d'` would silently
# mis-strip if AuthContext gained/lost comment lines since spec time.)
sed -i '/^import type { User }/,$!d' src/shared/auth/AuthContext.tsx
head -1 src/shared/auth/AuthContext.tsx   # expect: import type { User } from "firebase/auth";
```
Expected: the first line is now the `firebase/auth` type import. If `head -1` shows anything else (including an empty file — meaning the `import type { User }` anchor wasn't found), the active code's first line is not what this plan assumed (AuthContext changed upstream) — STOP, re-read the file, and strip exactly the leading comment block by hand, keeping the active implementation onward.

- [ ] **Step 3: Fix the moved file's own relative imports (`../lib/*` → `@/lib/*`)**

From `src/shared/auth/`, the old `../lib/...` paths no longer resolve to `src/lib/`. Repoint to the alias:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
sed -i 's|from "\.\./lib/api"|from "@/lib/api"|; s|from "\.\./lib/firebase"|from "@/lib/firebase"|' src/shared/auth/AuthContext.tsx
```

- [ ] **Step 4: Create the public barrel**

Create `frontend/src/shared/auth/index.ts`:

```ts
export { AuthProvider, useAuth } from "./AuthContext";
```

(`AuthContext.tsx` exports only `AuthProvider` and `useAuth`; its `AuthContextType`/`AuthProviderProps` interfaces are not exported, so nothing else is surfaced — spec §3.2.)

- [ ] **Step 5: Rewire every AuthContext importer to `@/shared/auth`**

This is a pure import-source swap — every consumer imports `AuthProvider` or `useAuth`, both of which the barrel re-exports, so only the `from "…"` string changes. Covers the four path forms in the tree:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rl 'contexts/AuthContext' src --include=*.ts --include=*.tsx | while read -r f; do
  sed -i \
    -e 's|from "@/contexts/AuthContext"|from "@/shared/auth"|g' \
    -e 's|from "\.\./contexts/AuthContext"|from "@/shared/auth"|g' \
    -e 's|from "\./contexts/AuthContext"|from "@/shared/auth"|g' \
    "$f"
done
# TenantContext.tsx (still in src/contexts) imports useAuth via the intra-dir "./AuthContext":
sed -i 's|from "\./AuthContext"|from "@/shared/auth"|g' src/contexts/TenantContext.tsx
```

- [ ] **Step 6: Confirm no stale references, settle order, typecheck**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn 'contexts/AuthContext\|"\./AuthContext"' src --include=*.ts --include=*.tsx   # expect: NO output
npx eslint --fix src        # re-sort imports the swap disturbed (e.g. App.tsx @/ grouping)
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```
Expected: the grep prints nothing; `lint` and `tsc` PASS. The `react-refresh` exemption on `src/shared/**` (from 4a) keeps `AuthContext.tsx`'s provider+hook co-export from warning under `--max-warnings 0`.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): promote AuthContext to shared/auth (strip dead block, rewire importers)"
```

---

## Task 3: Promote `TenantContext` → `src/shared/tenant/` (rewire all importers)

**Files:**
- Move: `frontend/src/contexts/TenantContext.tsx` → `frontend/src/shared/tenant/TenantContext.tsx`
- Create: `frontend/src/shared/tenant/index.ts`
- Modify: every TenantContext importer (path swap only)

> Spec §3.2. No dead-block strip (TenantContext is clean; the known-dead `availableTenants`/`setAvailableTenants` per TD-FE-12 are **not** touched here — 4b is parity-preserving). Its internal `useAuth` import already points to `@/shared/auth` after Task 2.

- [ ] **Step 1: Move the file**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
mkdir -p src/shared/tenant
git mv src/contexts/TenantContext.tsx src/shared/tenant/TenantContext.tsx
grep -n 'from "@/shared/auth"' src/shared/tenant/TenantContext.tsx   # expect: the useAuth import (already repointed in Task 2)
```
Expected: the `@/shared/auth` import is present (shared→shared, allowed). Task 2 Step 5 should already have rewritten it, so this branch ideally never fires. If it still says `./AuthContext`, fix it here — then re-run Task 2 Step 6's stale-reference grep across `src` to confirm the miss was **isolated**, not a systemic sed gap (if other files also still point at the old path, Task 2's verification was incomplete — re-apply the Step 5 rewrite to them).

- [ ] **Step 2: Create the public barrel**

Create `frontend/src/shared/tenant/index.ts`:

```ts
export { TenantProvider, useTenant } from "./TenantContext";
export type { Tenant } from "./TenantContext";
```

(`Tenant` is an `export interface`; re-export it with `export type` so `isolatedModules` is satisfied. Spec §3.2 — the barrel surfaces `TenantProvider`, `useTenant`, plus the `Tenant` type the file already exports.)

- [ ] **Step 3: Rewire every TenantContext importer to `@/shared/tenant`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rl 'contexts/TenantContext' src --include=*.ts --include=*.tsx | while read -r f; do
  sed -i \
    -e 's|from "@/contexts/TenantContext"|from "@/shared/tenant"|g' \
    -e 's|from "\.\./contexts/TenantContext"|from "@/shared/tenant"|g' \
    -e 's|from "\./contexts/TenantContext"|from "@/shared/tenant"|g' \
    "$f"
done
```
(`pages/TenantSelection.tsx`'s `import type { Tenant } from "…/TenantContext"` is covered by the same swap — the `type` import resolves against the barrel's `export type { Tenant }`.)

- [ ] **Step 4: Confirm, settle order, typecheck**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn 'contexts/TenantContext' src --include=*.ts --include=*.tsx   # expect: NO output
npx eslint --fix src
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```
Expected: grep empty; `lint` + `tsc` PASS.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): promote TenantContext to shared/tenant (rewire importers)"
```

After this task `src/contexts/` contains only `SidebarContext.tsx`.

---

## Task 4: Extract the shell frame + guard + sidebar state; rewire `App.tsx` + external Layout sites

**Files:**
- Move into `frontend/src/features/shell/`: the 4 layout components, `ProtectedRoute.tsx`, `SidebarContext.tsx`
- Create/populate: `frontend/src/features/shell/index.ts` (the public barrel)
- Modify: `frontend/src/App.tsx` (imports only), 11 page Layout-importers, `MarketResearch.tsx` (DeploymentData)
- Delete: `frontend/src/components/layout/` (emptied), `frontend/src/components/ProtectedRoute.tsx` (moved), `frontend/src/contexts/` (emptied)

> Spec §3.1, §3.3, §3.4. This is the atomic shell-extraction commit. The `<Routes>` table and provider nesting in `App.tsx` are **unchanged** — only import sources move.

- [ ] **Step 1: Move the six files**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
mkdir -p src/features/shell/components
git mv src/components/layout/Sidebar.tsx      src/features/shell/components/Sidebar.tsx
git mv src/components/layout/Header.tsx       src/features/shell/components/Header.tsx
git mv src/components/layout/Layout.tsx       src/features/shell/components/Layout.tsx
git mv src/components/layout/ProfileDialog.tsx src/features/shell/components/ProfileDialog.tsx
git mv src/components/ProtectedRoute.tsx      src/features/shell/ProtectedRoute.tsx
git mv src/contexts/SidebarContext.tsx        src/features/shell/SidebarContext.tsx
```

- [ ] **Step 2: Fix the moved files' internal imports**

The auth/tenant imports inside `Header`/`Sidebar`/`ProfileDialog`/`ProtectedRoute` already point to `@/shared/*` (Tasks 2–3). The only remaining in-file fix is the `SidebarContext` reference in `Header` and `Sidebar` — `SidebarContext.tsx` now sits one level up from `components/`:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
sed -i 's|from "@/contexts/SidebarContext"|from "../SidebarContext"|g' \
  src/features/shell/components/Header.tsx \
  src/features/shell/components/Sidebar.tsx
# Layout.tsx imports "./Header"/"./Sidebar" (siblings, moved together) and "@/components/ui/toaster" — no change needed.
grep -rn 'contexts/SidebarContext\|components/layout/\|components/ProtectedRoute' src/features/shell   # expect: NO output
```
Expected: the grep prints nothing (no stale internal paths). Note `Header`/`Sidebar` keep importing the hook as `useSidebar` (the internal name) — the `useAppSidebar` rename happens only at the barrel (Step 3).

- [ ] **Step 3: Populate the shell public barrel**

Overwrite `frontend/src/features/shell/index.ts` (the scaffolder stub) with:

```ts
export { Layout } from "./components/Layout";
export { default as ProtectedRoute } from "./ProtectedRoute";
export { SidebarProvider, useSidebar as useAppSidebar } from "./SidebarContext";
export type { DeploymentData } from "./components/Header";
```

Notes:
- `ProtectedRoute` is a **default** export → re-exported as the named `ProtectedRoute`.
- `useSidebar` is re-exported as **`useAppSidebar`** — resolves the shadcn name-twin at the public surface (spec §3.6). The internal symbol stays `useSidebar` (rename deferred — TD-FE in Task 5).
- `DeploymentData` (a type exported by `Header`) is surfaced because `pages/MarketResearch.tsx` imports it. **This is an addition to the spec §3.4 surface list, discovered during 4b's source enumeration (which §3.2 mandates).** It keeps MarketResearch consuming the shell only via the barrel — never a deep internal path. `Header`/`Sidebar`/`ProfileDialog` components themselves remain internal (not re-exported). `AppRoutes` is **not** exported — the route table stays in `App.tsx`.

- [ ] **Step 4: Rewire external `Layout` + `DeploymentData` importers to `@/features/shell`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rl 'components/layout/' src --include=*.ts --include=*.tsx | while read -r f; do
  sed -i \
    -e 's|from "@/components/layout/Layout"|from "@/features/shell"|g' \
    -e 's|from "\.\./components/layout/Layout"|from "@/features/shell"|g' \
    -e 's|from "@/components/layout/Header"|from "@/features/shell"|g' \
    -e 's|from "\.\./components/layout/Header"|from "@/features/shell"|g' \
    "$f"
done
grep -rn 'components/layout/' src --include=*.ts --include=*.tsx   # expect: NO output
```
Expected: grep empty. The four `-e` clauses cover the import forms observed at spec time (`@/…` and `../…`, for both `Layout` and `Header`) — they are **audit-derived, not a fixed set**. If Task 0 Step 5 surfaced any other depth (e.g. `../../components/layout/…` from a nested page), add the matching `-e` clause before running. The trailing `grep` (expect empty) is the backstop that proves none was missed; `tsc` in Step 7 catches any import that slipped through.

- [ ] **Step 5: Rewire `App.tsx` (imports only — the only structural import edit)**

`App.tsx`'s `AuthProvider`/`TenantProvider` imports already point to `@/shared/*` (Tasks 2–3). Two imports remain: the **default** `ProtectedRoute` and the `SidebarProvider`. Edit `frontend/src/App.tsx`:

Remove these two lines:
```tsx
import ProtectedRoute from "./components/ProtectedRoute";
```
```tsx
import { SidebarProvider } from "./contexts/SidebarContext";
```

Add this single line (anywhere in the `@/` import group — `eslint --fix` will sort it):
```tsx
import { ProtectedRoute, SidebarProvider } from "@/features/shell";
```

Leave `import PWAInstallPrompt from "./components/PWAInstallPrompt";` **unchanged** (PWAInstallPrompt stays put, spec §1.5). Leave the entire `<App>` body (provider nesting `QueryClientProvider > AuthProvider > TenantProvider > SidebarProvider > TooltipProvider`, the `<BrowserRouter><Routes>…</Routes>`, and the trailing `Toaster`/`Sonner`/`PWAInstallPrompt`) **byte-for-byte unchanged** — only the import block changes.

This is the one hand-edit (no `sed`), so sanity-check it before moving on:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -c 'from "@/features/shell"' src/App.tsx                 # expect: 1  (ProtectedRoute + SidebarProvider, one line)
grep -c './components/ProtectedRoute\|./contexts/' src/App.tsx # expect: 0  (no stale shell/context import sources)
git diff src/App.tsx                                          # eyeball: ONLY the import block changed; the <App> body is untouched
```

- [ ] **Step 6: Delete the emptied legacy dirs**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
rmdir src/components/layout   # must be empty after the 4 git mv; if rmdir errors, `ls` it — something didn't move
rmdir src/contexts            # must be empty after Auth/Tenant/Sidebar moved
test ! -d src/components/layout && test ! -d src/contexts && echo "OK: legacy dirs gone"
```
Expected: both removed. If `rmdir` errors on non-empty, list the dir and reconcile (a file was missed in Steps 1–2 or Tasks 2–3).

- [ ] **Step 7: Settle order, typecheck, lint**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```
Expected: PASS. The 4a `import-x/no-restricted-paths` and (if shipped) index-only rules see no violations: shell imports only `@/shared/*`, `@/components/ui/*`, intra-feature, and npm; pages/App import the shell **index** (`@/features/shell`), never a deep path. The `react-refresh` exemption on `src/features/**` covers `shell/index.ts` and `SidebarContext.tsx` co-exports.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): extract app shell into features/shell; rewire App.tsx imports"
```

---

## Task 5: Populate `shell/README.md` + log TD-FE for the name twins

**Files:**
- Modify: `frontend/src/features/shell/README.md` (overwrite the scaffolder stub)
- Modify: `docs/TECH_DEBT.md`

> Spec §3.6.

- [ ] **Step 1: Write `src/features/shell/README.md`**

````markdown
# `shell` feature

## Purpose

The application frame that authenticated features render inside: the sidebar, header, page layout, and profile dialog, plus the route guard. The shell renders only on authenticated screens — Login and TenantSelection do not use `Layout`.

## Public surface

Re-exported from `index.ts`; consume only these, only via `@/features/shell`:

- `Layout` — the page frame (header + sidebar + content slot). Composed per-page by feature pages.
- `ProtectedRoute` — route guard; redirects unauthenticated users to `/login` and auto-selects a tenant when `requireTenant` is set but none is chosen.
- `SidebarProvider` — provides the app sidebar (mobile-open) state. Nested in `App.tsx`.
- `useAppSidebar` — the app sidebar hook (renamed from the internal `useSidebar` to avoid the shadcn `ui/sidebar` name-twin — see TECH_DEBT TD-FE).
- `DeploymentData` (type) — surfaced for `MarketResearch` until that page migrates (Phase 5).

Internals (`components/Header`, `components/Sidebar`, `components/ProfileDialog`, `SidebarContext`) are **not** re-exported. The `<Routes>` table is **not** here — it stays in `App.tsx` (it must know every feature's page; putting it in the shell would invert the dependency rule).

## Key files

- `index.ts` — public re-exports (the cross-feature surface above)
- `components/Layout.tsx`, `components/Header.tsx`, `components/Sidebar.tsx`, `components/ProfileDialog.tsx` — the frame
- `ProtectedRoute.tsx` — route guard
- `SidebarContext.tsx` — sidebar (mobile-open) state
- `types.ts` — feature-local types

## Dependency notes

- Consumes `@/shared/auth` (`useAuth`), `@/shared/tenant` (`useTenant`, `Tenant`), `@/components/ui/*`, and npm packages.
- Does **not** import from other features. App-wide state lives in `@/shared`, not here (ADR-0002).
````

- [ ] **Step 2: Log the name-twin TD-FE in `docs/TECH_DEBT.md`**

Use the **next free** `TD-FE` number after 4a's entries — `TD-FE-15` if 4a did not log the index-only fallback (Plan 21a Task 6), otherwise `TD-FE-16`. Check first:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -t- -k3 -n | tail -1   # highest existing number
```

Append (substituting the correct number; shown here as `TD-FE-15`):

```markdown

---

## TD-FE-15 — Sidebar export-name twins + `useAuth` name collision

**Date logged:** 2026-05-29
**Origin:** Plan 21b Phase 4b (plans/21b-frontend-phase-4b-shell-extraction.md), Task 5.

**Current state:**
Two name twins remain after the shell extraction:
1. **Sidebar twins.** shadcn's `src/components/ui/sidebar.tsx` exports `SidebarProvider` (line 730) and
   `useSidebar` (line 734) — the same names the app's own sidebar state (`src/features/shell/SidebarContext.tsx`)
   exports. 4b resolves the hazard *at the shell's public surface*: the app hook is re-exported as
   `useAppSidebar` from `@/features/shell`, and the app `SidebarProvider` flows through the shell barrel. The
   **internal** `SidebarContext.tsx` symbol is still named `useSidebar` (internal rename deferred). The
   collision stays *inactive* — nothing imports `useSidebar`/`SidebarProvider` from `@/components/ui/sidebar`.
2. **`useAuth` collision.** `src/shared/auth/AuthContext.tsx` and `src/hooks/useAuth.ts` both export `useAuth`
   with different behavior — the context hook vs. the composed JWT/session hook. `@/shared/auth` exposes the
   *context* `useAuth`; the composed hook stays at `@/hooks/useAuth`. 4b does not worsen this.

**What it should be:**
Rename the internal `SidebarContext.tsx` hook to `useAppSidebar` (and drop the barrel alias) the next time the
shell internals are touched. Rename the composed `hooks/useAuth.ts` to something unambiguous (e.g.
`useSession`) when it finds its final home.

**Pull-forward trigger:**
`useAuth` collision → Phase 10/11, when `hooks/useAuth.ts` is rehomed (Spec 21 §8.2 item 6). Sidebar internal
rename → whenever the shadcn twin becomes active, or the shell internals are next refactored.

**Owner:** TBD.
```

- [ ] **Step 3: Verify and commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run format:check    # (or `npx prettier --check src/features/shell/README.md`)
```
Expected: PASS (fix with `npm run format` if flagged).

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/shell/README.md docs/TECH_DEBT.md
git commit -m "docs(fe): document shell public surface; log TD-FE for sidebar/useAuth name twins"
```

---

## Task 6: Parity verification — guard journey, visual regression, full preflight

**Files:**
- Possibly modify: `frontend/e2e/journeys/01-login-tenant-mission.spec.ts` (only if the redirect assertion is missing)
- Possibly modify: `frontend/src/features/shell/index.ts` (only on the knip contingency)

> Spec §3.5, §3.8 item 7. Guard *behavior* parity is a journey concern (a wrong `requireTenant` redirect won't show in pixels); shell *rendering* parity is VR (pixel-identical @ 2% threshold).

- [ ] **Step 1: Confirm the guard-behavior journey asserts the redirect (spec §3.5)**

Read `frontend/e2e/journeys/01-login-tenant-mission.spec.ts` (and `e2e/helpers/login.ts`, `e2e/fixtures/auth.ts`). Confirm the journey exercises the auth/tenant guard path: an unauthenticated visit to a protected route redirects to `/login`, and the login → tenant → `/mission-control` flow lands authenticated. If the **redirect** behavior (unauth → `/login`; `requireTenant` auto-select) is asserted, no change is needed. If it is **not** covered, add a minimal assertion (e.g. `await page.goto('/mission-control')` while logged out → expect URL `/login`). Keep additions tiny and behavior-only — do not change routes or UI.

- [ ] **Step 2: Run the unit + knip + build gates**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run test
npm run build
npx knip --strict --no-progress
```
Expected: all PASS.

**knip contingency — `useAppSidebar`:** knip resolves re-exports to their origin, and the origin `useSidebar` is consumed internally by `Header`/`Sidebar`, so the `useAppSidebar` barrel alias is **expected to pass**. **If knip nonetheless flags `useAppSidebar` (or any shell barrel export) as an unused export** — confirm it is the only flag, then resolve as follows (do **not** change `knip.json`; §3.7 forbids it in 4b):
- **Preferred:** defer just the `useAppSidebar` alias to its first consumer (Phase 5) — drop the `useSidebar as useAppSidebar` line from the barrel for now. The consumed `SidebarProvider` still flows through the barrel and TD-FE-15 still records the name-twin intent, so the substantive §3.6 work stands. This is guaranteed to clear knip and needs no tooling tricks. It **is** a deviation from §3.4 / §3.8 item 5 (which list `useAppSidebar` on the surface), so note it in the commit body and get reviewer sign-off in the impl-review handoff (Task 8 Step 4 already flags this item).
- **Not preferred:** a JSDoc `@public` tag on the export. knip's tag filtering generally needs a `tags` entry in `knip.json` — which §3.7 forbids in 4b — so `@public` alone will likely not suppress the flag. Only take this path if you *verify* it clears knip without editing `knip.json`.

Record which path you took. (This contingency only fires if the expected-pass reasoning above is wrong.)

- [ ] **Step 3: Run the Playwright VR + journeys (the parity gate)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test:e2e
```
Expected: PASS, including pixel-parity VR on `01-login-tenant-mission` (the authenticated shell screen) at the 2% threshold. **A VR failure is a regression, not a re-baseline trigger** (Spec 14 §2.2) — investigate the shell move (a stray style/markup change, or an `eslint --fix` import-order side effect), fix it, and re-run. Do **not** run `test:e2e:update-snapshots` to "make it pass." **If the cause is unclear after investigating, STOP and report to the controller with the failing screenshot diff** (the `*-diff.png` Playwright writes under the snapshot dir / `playwright-report/`) — for a parity-preserving migration an unexplained VR diff means something genuinely changed; do not merge past it.

- [ ] **Step 4: Full preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS end-to-end (§3.8 item 7).

- [ ] **Step 5: Commit any journey/knip changes**

If Step 1 added a journey assertion and/or Step 2's contingency edited the barrel:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend
git commit -m "test(fe): assert guard-redirect behavior in login-tenant-mission journey"
```
(If nothing changed in this task, skip the commit.)

---

## Task 7: Spec 14 amendments (4b branch)

**Files:**
- Modify: `specs/14-frontend-refactoring-master-plan-design.md`

> Spec §4 "On the 4b branch". Dedicated `docs(spec-14):` commit. These are **dated forward-annotations** on the frozen Phase 10/11 narrative blocks — append, do not rewrite the original prose.

- [ ] **Step 1: Annotate the §4 Phase 10 block**

Append, at the end of the Phase 10 block:
> *Amended by Spec 21 (2026-05-29): `AuthContext`/`TenantContext` relocated to `src/shared/` in Phase 4b; this block's original Phase-10 context move is superseded — see ADR-0002. Phase 10 builds the Login/TenantSelection UIs that consume the shared primitives.*

- [ ] **Step 2: Annotate the §4 Phase 11 block**

Append, at the end of the Phase 11 block:
> *Amended by Spec 21 (2026-05-29): `shared/{auth,tenant,components}` already exist from Phase 4; Phase 11 promotes the remaining hooks/lib/types and verifies that `features/` hold no legacy-dir imports (see Spec 21 §2.2).*

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add specs/14-frontend-refactoring-master-plan-design.md
git commit -m "docs(spec-14): annotate Phase 10/11 for the 4b shared-layer relocation"
```

---

## Task 8: Done-when verification + handoff

**Files:** none (verification only).

- [ ] **Step 1: Walk the spec §3.8 done-when**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
ls src/features/shell src/features/shell/components   # populated; README present
ls src/shared/auth src/shared/tenant                  # each has *.tsx + index.ts
test ! -d src/components/layout && echo "OK: components/layout deleted"
test ! -d src/contexts && echo "OK: contexts deleted"
test -f src/hooks/useAuth.ts && grep -q '@/shared/auth' src/hooks/useAuth.ts && grep -q '@/shared/tenant' src/hooks/useAuth.ts && echo "OK: useAuth stays, repointed to @/shared/*"
grep -q 'useAppSidebar' src/features/shell/index.ts && echo "OK: shell barrel exports useAppSidebar"
grep -q 'DeploymentData' src/features/shell/index.ts && echo "OK: shell barrel surfaces DeploymentData (MarketResearch consumer)"
```
(If the Task 6 knip contingency deferred the `useAppSidebar` alias, the first grep will fail — that is the documented §3.4/§3.8-item-5 deviation, not a defect; confirm it was signed off rather than treating it as a gap.)
Confirm each against §3.8:
1. `features/shell/` populated with README; `components/layout/` deleted.
2. `AuthContext` in `shared/auth/`, `TenantContext` in `shared/tenant/`, each with `index.ts`; old `contexts/*` and the `contexts/` dir deleted; `useAuth.ts` stays in `src/hooks/`, repointed.
3. All imports resolve; `tsc --noEmit` green (Task 6).
4. `App.tsx` rewired (imports only); `<Routes>` + provider nesting unchanged; routes unchanged.
5. `shell/index.ts` exports `useAppSidebar`; cross-feature lint rules enforce against `shell/` with no violations.
6. TD-FE logged for the sidebar twins + `useAuth` collision (Task 5).
7. `npm run preflight` green incl. VR + guard journey (Task 6).

- [ ] **Step 2: Confirm `useAuth.ts` is unmoved and repointed (spec §3.2)**

`src/hooks/useAuth.ts` must still exist (composes both contexts + `jwtManager`; its final home is Phase 10/11) with its two context imports now `@/shared/auth` + `@/shared/tenant` (handled by Tasks 2–3's sed). The Step 1 grep covers this.

- [ ] **Step 3: Sanity-check the diff shape**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git diff --stat master...phase-4b-shell-extraction
```
Expected: renames under `frontend/src/{features/shell,shared/auth,shared/tenant}` (history-preserving `R` entries), deletions of `frontend/src/components/layout/*`, `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/contexts/*`, small import-line edits across ~25 consumer files + `App.tsx`, new `index.ts` barrels, the shell README, `docs/TECH_DEBT.md`, and `specs/14-…`. No new product code; no route/UI changes.

- [ ] **Step 4: Hand off for review + merge**

Per Spec 21 §5: `/review-impl` → `/synthesize-impl-review` (loop until nit-or-below), then the controller runs `npm run preflight` once more and, on green, merges `phase-4b-shell-extraction` → `master`. Flag for the reviewer: (a) the `DeploymentData` addition to the shell surface (§3.4 deviation, Task 4 Step 3); (b) the knip `useAppSidebar` outcome/contingency (Task 6 Step 2). Phase 4 is **done** once both 4a and 4b are merged (spec §6).

---

## Self-review notes (plan author)

- **Spec coverage:** §3.1 shell sources (Task 4), §3.2 state primitives + useAuth-stays + dead-strip (Tasks 2–4), §3.3 App.tsx rewire / route table stays (Task 4 Step 5), §3.4 public surface (Task 4 Step 3), §3.5 parity/VR/journey (Task 6), §3.6 README + name-twin TD (Task 5), §3.7 files-touched (all), §3.8 done-when (Task 8), §4 4b-branch amendments (Task 7).
- **Staging keeps every commit green:** Auth and Tenant promotions repoint *all* importers (including not-yet-moved shell files + `App.tsx`) in the same commit as the move+delete, so `tsc --noEmit` passes at each boundary; the shell extraction is the one atomic move-rewrite-delete commit. `git mv` preserves history per the "preserve content" intent.
- **Two items flagged for plan/impl review:** (1) `DeploymentData` is surfaced through the shell barrel — a discovered addition to §3.4 (MarketResearch imports the type from a shell internal); (2) the `useAppSidebar` barrel alias has no 4b consumer, so `knip --strict` *may* flag it — Task 6 gives the expected-green rationale + a no-`knip.json`-change contingency. Both are consequences of real code the converged spec did not enumerate; surfaced rather than silently resolved.
- **TD-FE numbering:** depends on whether Plan 21a Task 6 logged the index-only fallback — Task 5 Step 2 reads `TECH_DEBT.md` to pick the next free number (15 or 16).
