# Frontend Phase 5e — Decompose `RegulatoryComplianceSection` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `RegulatoryComplianceSection` (~2,766 LOC, one `React.FC`) into a thin container + single-purpose sub-components (one file each) + a section data hook `useRegulatoryCompliance.ts` + local types, all under `frontend/src/features/market-research/components/intelligence/regulatory-compliance/`. Replace this section's `MarketIntelligenceTabProps` data slice + its own raw `fetch` with the 5b data hook, wrap the section in `<FeatureErrorBoundary>` if warranted, and preserve behavior + visuals (no pixel VR). This is sub-phase **5e** of Spec 24.

**Architecture (from a full read of the live file — verify in Task 0):** The section is **NOT tab-based**. It is a single `<Card>` ("Regulatory & Compliance Highlights") rendering five visual sections, in two layout modes — a compact view and an `isExpanded` view — controlled entirely by the parent (`MarketIntelligenceSections`). The five sections are **Executive Summary**, **Key Regulatory Updates**, **Compliance Analytics** (recharts bar/pie/area "visual data cards"), **Regional Compliance Overview** (regional breakdown table), and **Strategic Recommendations**, plus a header (edit/Scout/export/share/edit-history chrome) and a footer (save/cancel + read-more/show-less). It is **inline-editable**: each section has an edit affordance, with five `local*` editing strings (`localExecutiveSummary`/`localEuAiActDeadline`/`localGdprCompliance`/`localPotentialFines`/`localDataLocalization`) plus `localKeyDataValues`/`localRegionalData`/`localVisualDataCards`/`localStrategicRecommendations`, hydrated from props via ~11 `useEffect`s and pushed up through the `on*Change`/`onSaveChanges` callbacks. It **DOES fetch**: `fetchRegulatoryComplianceData` (line ~581) is a real raw async fetch with a request `payload` + a `Loading...` fallback, and the displayed data comes from a `regulatoryData?: UntypedBackendApiResponse` prop OR that fetch. Pure helpers `getIconByName` + `getBadgeColor` map update icons/badges; `keyDataPoints`/`visualDataCards`/`regionalData` are derived inline from `regulatoryData?.* || defaults`.

Decomposition therefore: (1) introduce `useRegulatoryCompliance.ts` wrapping the 5b hook and **delete the in-component `fetchRegulatoryComplianceData`**; (2) lift the pure helpers + the derivation into a tested `regulatoryHelpers.ts`; (3) lift the recharts renderer (`ComplianceVisualCard`) into one file; (4) lift each of the five visual sections + the header + the footer into their own files; (5) lift local types. **Editing state stays in the container**; sub-components are controlled (value + callback pairs) and presentational, so each is independently testable. Each extraction is its own commit, independently revertible; every commit leaves `tsc --noEmit` + `lint` green.

**Tech Stack:** React 18 + Vite + TS (strict), `@/` → `src/`, `@tanstack/react-query` (5b hooks), `zod` (5b contracts), `recharts` (charts — already a dep), shared `@/shared/api/*`, `<FeatureErrorBoundary>` from `@/shared/components`, ESLint flat-config (`eslint-plugin-import-x` + 4a resolver + zone/no-cycle + transitional legacy-import exception), Vitest + RTL + **MSW** (`src/test/msw/handlers.ts`), Playwright (behavioral `journeys/04` — **no MR pixel VR**), knip `--strict`.

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §6 (and §2.1, §8, §12 R3/R6). Companion plans whose contract this consumes: `plans/24a-frontend-phase-5a-relocate.md` (relocation + paths), `plans/24b-frontend-phase-5b-data-layer.md` (the locked hook/service/contract identifiers), `plans/24d-frontend-phase-5d-market-entry.md` (the prior section's decomposition template — `MarketEntrySection` shares this exact prop/edit/fetch shape).

**Prerequisite (hard):** **5c (`plans/24c-frontend-phase-5c-page-decomposition.md`) merged to `master`.** This plan operates on the **relocated** section file. Post-5a the file lives at `frontend/src/features/market-research/components/RegulatoryComplianceSection.tsx`; Task 0 confirms the exact path against the live tree (5a does the physical `git mv`). Branch off the latest `master`. This plan re-identifies the section's seams **by reading the moved file**, not by the line numbers below (an anchor from the pre-5a `src/components/market-research/RegulatoryComplianceSection.tsx`, 2,766 LOC).

**Locked data-layer contract (from 5b — use these EXACT identifiers):**
- Hook: `useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.regulatory)` and `useRegenerateResearch(userId, orgId)` from `@/features/market-research/hooks/useMarketResearch`.
- `RESEARCH_COMPONENTS.regulatory` resolves to component_name `"regulatory & compliance highlights"`; helpers in `@/features/market-research/services/marketResearch`.
- Schema `ResearchComponentSchema` / type `ResearchComponentResponse` in `@/features/market-research/contracts`.
- Company profile (the section reads a `companyProfile` prop + listens for `companyProfileUpdated`) reuses Phase 3's `useCompanyProfile` — do **not** add a new profile hook.

**Conventions for every task:** as 24a/24b/24d. File ops (`mkdir`, `git mv`, `sed`, `grep`, `npm`, `eslint --fix`) run from `frontend/`; `git add`/`git commit` from the monorepo root `/projects/Brewra/brewra-gtm-intelligence`. There is no root-level `package.json`. After each rewrite run `npx eslint --fix src` (settles `import-x/order`), then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json` must be green before committing. Commit messages: `type(scope):` form, scope `fe`; **no `Co-Authored-By` footer**; **no `[N/M]`**. **One commit per extracted sub-component** (file + its test). **Visual-parity guard for all of Phase 5 is behavioral E2E `journeys/04` + Vitest/RTL + `npm run preflight` — NO market-research pixel VR; do NOT add `toHaveScreenshot` for market-research.** Transitional import exception applies: `features/market-research` may import legacy dirs.

**Abort criteria (whole-branch — report to the controller and halt; do NOT force-push, amend pushed commits, or revert without sign-off):** the per-task STOP conditions handle "fix this step and continue." Abandon the *branch* and escalate when:
1. **5c is not actually merged** (Task 0 fails its check).
2. The Task 0 baseline preflight (or its lighter subset) is RED **before any 5e change**.
3. The seam audit (Task 0) contradicts this plan's sub-component list in a way that changes the **number** of sections, or reveals a seam this plan didn't anticipate — the audit wins; update the task list, record the delta in the PR, and continue **only if** the change is mechanical. If it implies a behavior change not covered by a test, STOP.
4. `useResearchComponent` does not surface a field the section renders (the `ResearchComponentResponse.data` cannot supply the `executiveSummary` / `keyUpdates` / `visualDataCards` / `regionalData` / `strategicRecommendations` shapes the sections read) — escalate to revisit 5b rather than re-introducing a direct `fetch` or keeping the data prop permanently. (See Task 3's reconcile step.)
5. Behavioral `journeys/04` cannot be made green after the swap and the cause is unfound after investigation (Task 12).

A half-decomposed tree is recoverable from the last green commit; a force-pushed/amended history is not.

---

## Decomposition template (applies to every sub-component task)

Each sub-component extraction follows the same TDD loop:

1. **Red:** write the sub-component test (RTL render from fixture props) — or a unit test for a pure helper — and run it red.
2. **Green:** extract the JSX + any local logic into the new file under `…/regulatory-compliance/`; wire it into the container with typed props from `./types`.
3. **Refactor:** delete the now-dead inlined code from the container; keep imports tidy.
4. **Gate:** `npx eslint --fix src`; `npm run lint`; `npx tsc --noEmit -p tsconfig.app.json`; `npx vitest run <the new file's test>`; `npx knip --strict --no-progress` where the change adds/removes exports.
5. **Commit:** one commit, `refactor(fe): extract <Name> from RegulatoryComplianceSection`.

Each sub-component **receives typed props** (from `types.ts`); it does **not** call the section hook or fetch. The five `local*` editing strings + `localRegionalData`/`localVisualDataCards`/`localStrategicRecommendations`/`localKeyDataValues` editing **state stays in the container** and is passed down as value + setter/callback pairs, so every section is controlled and unit-testable in isolation. **The section is rendered twice** (compact vs `isExpanded`); a section component takes the data it renders + an `isExpanded`/`isEditing` flag and the parent decides which to mount — preserve both code paths exactly when lifting (the compact and expanded markup differ; do not collapse them into one unless the audit shows they are identical).

---

## Task 0: Branch + green baseline + seam audit (read the real file)

**Files:** none (verification only).

- [ ] **Step 1: Branch off the latest `master` (5c merged)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only        # ensure 5a/5b/5c are present; skip if it errors offline
git log --oneline master | grep -iE 'phase-5c|24c' | head -1 && echo "OK: 5c merged" || echo "STOP: 5c not merged (abort 1)"
git checkout -b phase-5e-regulatory-compliance
```

- [ ] **Step 2: Confirm the relocated section file + the 5b data layer landed**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
F=$(find src/features/market-research -name 'RegulatoryComplianceSection.tsx'); echo "section: $F"
test -n "$F" && echo "OK: section relocated (5a)" || echo "STOP: section not under features/ (5a not merged)"
test -f src/features/market-research/hooks/useMarketResearch.ts && echo "OK: 5b hooks"
test -f src/features/market-research/services/marketResearch.ts && echo "OK: 5b services"
test -f src/features/market-research/contracts.ts && echo "OK: 5b contracts"
grep -q "regulatory" src/features/market-research/services/marketResearch.ts && echo "OK: RESEARCH_COMPONENTS.regulatory present"
grep -q "market-research" src/test/msw/handlers.ts && echo "OK: MSW market-research handlers (5b)"
```
Expected: all OK. The expected target is `src/features/market-research/components/RegulatoryComplianceSection.tsx`; if `find` reports a different path, use it throughout. If any STOP fires, abort (criterion 1).

- [ ] **Step 3: Green preflight baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight   # or the lighter typecheck+lint+test subset; Task 12 is the real gate
```
Expected: PASS. RED before any change → STOP (abort 2).

- [ ] **Step 4: Seam audit — read the moved file end-to-end and reconcile against this plan**

Read the relocated `RegulatoryComplianceSection.tsx` fully. Confirm or correct, **against the live file**, each item below (line numbers are the pre-5a anchor — re-find them):

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
F=src/features/market-research/components/RegulatoryComplianceSection.tsx   # adjust to Step 2's path
echo "=== confirm NOT tab-based (expect 0) ==="; grep -cE '<TabsContent|<TabsTrigger' "$F"
echo "=== props interface ==="; grep -nE 'interface RegulatoryComplianceSectionProps' "$F"
echo "=== the five visual section headings ==="; grep -nE '<h[23][^>]*>(Executive Summary|Key Regulatory Updates|Compliance Analytics|Regional Compliance Overview|Strategic Recommendations)|Regional Compliance Overview|Strategic Recommendations' "$F"
echo "=== state (expect ~12 useState) ==="; grep -nE 'useState' "$F"
echo "=== effects (expect ~11 useEffect) ==="; grep -nE '^\s*useEffect\(' "$F"
echo "=== handlers + helpers + the raw fetch ==="; grep -nE '\bconst (handleModify|handleRegulatoryComplianceSaveChanges|fetchRegulatoryComplianceData|getIconByName|getBadgeColor)\b' "$F"
echo "=== the raw fetch site (this is what the hook replaces) ==="; grep -nE 'fetch\(|buildApiUrl|apiFetch|executeWithRateLimit' "$F"
echo "=== derived data from regulatoryData prop ==="; grep -nE 'regulatoryData\?\.(keyUpdates|visualDataCards|regionalData|strategicRecommendations)' "$F"
echo "=== compact vs expanded markup (isExpanded branches) ==="; grep -nE 'isExpanded' "$F" | head
echo "=== importers of the section ==="; grep -rln 'RegulatoryComplianceSection' src --include=*.ts --include=*.tsx
```

**Anchor (verified by a full read of the pre-5a file; the audit wins on any conflict):**
- **Props interface `RegulatoryComplianceSectionProps` (lines 58–95)** — the `MarketIntelligenceTabProps` slice this section consumes, all passed by `MarketIntelligenceSections.tsx`:
  - layout/edit flags: `isEditing`, `isSplitView`, `isExpanded`, `hasEdits`, `deletedSections: Set<string>`, `editHistory: EditRecord[]`.
  - five editable string fields: `executiveSummary`, `euAiActDeadline`, `gdprCompliance`, `potentialFines`, `dataLocalization`.
  - ~15 callbacks: `onToggleEdit`, `onScoutIconClick(context?, hasEdits?, customMessage?)`, `onEditHistoryOpen`, `onDeleteSection(sectionId)`, `onSaveChanges`, `onCancelEdit`, `onExpandToggle(expanded)`, `onExecutiveSummaryChange`, `onEuAiActDeadlineChange`, `onGdprComplianceChange`, `onPotentialFinesChange`, `onDataLocalizationChange`, `onExportPDF`, `onSaveToWorkspace`, `onGenerateShareableLink`.
  - data: `isRefreshing?`, `companyProfile?: UntypedBackendProfile`, **`regulatoryData?: UntypedBackendApiResponse`** (the centralized data prop, aliased `propRegulatoryData`).
  - (The interface is **declared locally** in the section file — it is the slice it consumes, not an import of `MarketIntelligenceTabProps`. Confirm.)
- **Local state (~12 `useState`):** `hoveredCard`, `_isLoading`, `_error`, `localExecutiveSummary`, `localEuAiActDeadline`, `localGdprCompliance`, `localPotentialFines`, `localDataLocalization`, `localKeyDataValues: Record<string,string>`, `localRegionalData: UntypedRegionData[]`, `localVisualDataCards: UntypedVisualDataCard[]`, and a `localStrategicRecommendations` object (`useState<UntypedBackendApiResponse>({…})` at ~232).
- **Effects (~11 `useEffect`):** hydrate each `local*` from its prop; reconcile `deletedSections`; init `localKeyDataValues` after `keyDataPoints`; company-profile listener (`companyProfileUpdated` event + a `companyProfile`-only effect that intentionally skips when `isRefreshing`). **Two `useEffect` are commented out** (they "overwrote local state with original values") — leave them commented, do not revive.
- **Handlers / helpers:** `handleModify` (→ `onToggleEdit`), `handleRegulatoryComplianceSaveChanges` (async; builds `originalData`/`modifiedData`, persists), **`fetchRegulatoryComplianceData(refresh=false)` (async raw fetch — `payload`, `setIsLoading`, `Loading...` fallback at ~666)**, `getIconByName(iconName)` (→ lucide icon: Sun/BarChart3/Building/Factory/TrendingUp/Users/Scale), `getBadgeColor(tag)` (→ Tailwind class). Inline-derived: `keyDataPoints` (maps `regulatoryData.keyUpdates` → `{id,icon,title,value,badge,badgeColor,tooltip}` via the helpers, with a hardcoded default set), `visualDataCards` (`regulatoryData?.visualDataCards || [defaults]` at ~1000), `regionalData` (`regulatoryData?.regionalData || [defaults]` at ~1031).
- **Five visual sections** (rendered in BOTH a compact block, ~1132–2236, and an expanded block, ~2341–2740):
  1. **Executive Summary** (h3 ~1163/2343) — textarea when editing, `<p>` otherwise; drives `executiveSummary`/`onExecutiveSummaryChange`.
  2. **Key Regulatory Updates** (h3 ~1207/2352) — `keyDataPoints.map(...)` cards with icon/badge/tooltip + a "Read More" affordance.
  3. **Compliance Analytics** (h3 ~1302/2410) — `visualDataCards.map(...)` → recharts bar/pie/area (the chart renderer is the biggest single block; `hoveredCard` drives hover state).
  4. **Regional Compliance Overview / Regional Breakdown** (h3 ~1754/2566) — `regionalData.map(...)` table (`region.deadline`, `region.requirements`), editable rows.
  5. **Strategic Recommendations** (h3 ~1969/2623) — the `localStrategicRecommendations` object's lists (`mitigateRegulatoryRisks`, `competitivePositioning`, `goToMarketStrategy`).
- **Header chrome** (~1078–1131): title "Regulatory & Compliance Highlights", the always-visible **Edit** button, the **Scout chat** icon (`onScoutIconClick`), and (in expanded/footer) **Export Options** (~2710), **Edit History** button (~2325).
- **Footer chrome:** Save/Cancel (~2237, `onSaveChanges`/`onCancelEdit`), **Read More** (compact, ~2391) / **Show Less** (~2744, `onExpandToggle`).
- **Importers:** `src/components/market-research/MarketIntelligenceSections.tsx` (the composition layer that spreads the prop slice) and `src/lib/types/escape-hatches.ts` (the `Untyped*` types the section uses). Record exact importers from the grep.

Reconcile: if the live file differs (a sixth section, a tab structure after all, the fetch already removed by 5b, a missing handler), **the audit wins** — update the sub-component inventory below and note the delta in the PR. If the difference implies a behavior change not coverable by a test, STOP (abort 3).

No commit (audit only). Record the finalized inventory for Tasks 2–11.

### Sub-component inventory (expected — verify in Step 4)

| Sub-component / module | Source seam | Responsibility | Logic-bearing? | Task |
|---|---|---|---|---|
| `types.ts` | `RegulatoryComplianceSectionProps` + `Untyped*` re-exports | Local types (prop slice + row shapes) | n/a | 2 |
| `regulatoryHelpers.ts` | `getIconByName`, `getBadgeColor`, the `keyDataPoints` derive | Icon/badge mapping + update→card derivation | Yes | 2 |
| `useRegulatoryCompliance.ts` | replaces `fetchRegulatoryComplianceData` + the `regulatoryData` prop | Wraps `useResearchComponent` + `useRegenerateResearch` | Yes | 3 |
| `RegulatoryHeader.tsx` | header block (~1078–1131) | Title + Edit + Scout-icon + (export/history) chrome | No | 4 |
| `ComplianceVisualCard.tsx` | one card of the Compliance Analytics block | recharts bar/pie/area renderer (`hoveredCard`) | Yes (chart-type switch) | 5 |
| `ExecutiveSummarySection.tsx` | Executive Summary (compact+expanded) | Editable summary text | No | 6 |
| `KeyRegulatoryUpdatesSection.tsx` | Key Regulatory Updates | `keyDataPoints` cards + read-more | No | 7 |
| `ComplianceAnalyticsSection.tsx` | Compliance Analytics | maps `visualDataCards` → `<ComplianceVisualCard>` grid | No | 8 |
| `RegionalComplianceSection.tsx` | Regional Compliance Overview/Breakdown | editable regional table | No (mostly) | 9 |
| `StrategicRecommendationsSection.tsx` | Strategic Recommendations | the three recommendation lists | No | 10 |
| `RegulatoryFooter.tsx` | footer (save/cancel + read-more/show-less + export) | Save/Cancel + expand toggle + export controls | No | 11 |

The five visual sections + header + footer + the chart card are the eight visual files; `regulatoryHelpers` + `types` + `useRegulatoryCompliance` are the three logic/type modules. **Editing state stays in the container.** Adjust counts to whatever the live read shows.

---

## Task 1: Relocate the file into `regulatory-compliance/` + rewrite importers

**Files:**
- Move: the section → `frontend/src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx`
- Create: `…/regulatory-compliance/index.ts` (barrel)
- Modify: every importer (path swap only)

> Spec 24 §2.1, §6. `git mv` preserves history. No content edits beyond the import-path move in this task. After this, the section is the container Tasks 2–11 carve into.

- [ ] **Step 1: Create the dir and `git mv` the file**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
mkdir -p src/features/market-research/components/intelligence/regulatory-compliance
git mv \
  src/features/market-research/components/RegulatoryComplianceSection.tsx \
  src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx
```
If the source path differs (Task 0 Step 2), use the real one. `git status` must show a rename, not delete+add.

- [ ] **Step 2: Add the barrel `index.ts`**

Create `src/features/market-research/components/intelligence/regulatory-compliance/index.ts`:
```ts
export { default as RegulatoryComplianceSection } from "./RegulatoryComplianceSection";
```
The live file ends `export default RegulatoryComplianceSection;` — mirror that. (If the audit shows a named export, mirror that instead.)

- [ ] **Step 3: Repoint every importer to the new path**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
OLD="@/features/market-research/components/RegulatoryComplianceSection"
NEW="@/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection"
grep -rl "$OLD" src --include=*.ts --include=*.tsx | while read -r f; do
  sed -i "s|$OLD|$NEW|g" "$f"
done
# Backstop: nothing left on the old path (and no relative form slipped through):
grep -rn "components/RegulatoryComplianceSection['\"]" src --include=*.ts --include=*.tsx
```
Expected backstop: empty. If `MarketIntelligenceSections.tsx` imports it via a relative path (it currently lives in `src/components/market-research/`, importing the section from `@/features/market-research/components/...` after 5a) update that import too. If a consumer imports via a `…/components/intelligence/index.ts` barrel, re-point that barrel at `./regulatory-compliance` instead. The Step 4 `tsc` is the final backstop.

- [ ] **Step 4: Settle, typecheck, lint, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
```
Expected: PASS.
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): relocate RegulatoryComplianceSection into intelligence/regulatory-compliance"
```

---

## Task 2: Extract `regulatoryHelpers.ts` + `types.ts` (TDD)

**Files:**
- Create: `…/regulatory-compliance/regulatoryHelpers.ts`
- Create: `…/regulatory-compliance/types.ts`
- Test: `…/regulatory-compliance/__tests__/regulatoryHelpers.test.ts`

> Spec 24 §6, §8. Lift the pure helpers (`getIconByName`, `getBadgeColor`) and the `keyUpdates → keyDataPoints` derivation into their own module so every section imports the same mappers + typed data from one place. Logic-bearing → test first.

- [ ] **Step 1: Write `types.ts`** — lift the local type surface; re-export the `Untyped*` types the section uses from the existing escape-hatch module so panels share them:
```ts
import type {
  UntypedBackendApiResponse,
  UntypedBackendProfile,
  UntypedRegionData,
  UntypedVisualDataCard,
  UntypedRegulatoryUpdate,
} from "@/lib/types/escape-hatches";
import type { EditRecord } from "@/...";   // confirm EditRecord's source from the section imports

export type {
  UntypedBackendApiResponse,
  UntypedBackendProfile,
  UntypedRegionData,
  UntypedVisualDataCard,
  UntypedRegulatoryUpdate,
  EditRecord,
};

/** Derived "key data point" card shape (output of deriveKeyDataPoints). */
export interface RegulatoryKeyDataPoint {
  id: string;
  icon: unknown; // lucide component
  title: string;
  value: string;
  badge: string;
  badgeColor: string;
  tooltip: string;
}

/** The section's prop slice — the MarketIntelligenceTabProps fields it consumes.
 *  Kept local so removing the data slice in Task 11 is contained. */
export interface RegulatoryComplianceSectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  euAiActDeadline: string;
  gdprCompliance: string;
  potentialFines: string;
  dataLocalization: string;
  onToggleEdit: () => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape" | "regulatory-compliance",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onEuAiActDeadlineChange: (value: string) => void;
  onGdprComplianceChange: (value: string) => void;
  onPotentialFinesChange: (value: string) => void;
  onDataLocalizationChange: (value: string) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  isRefreshing?: boolean;
  companyProfile?: UntypedBackendProfile;
  regulatoryData?: UntypedBackendApiResponse;
}
```
(Lift the real field names/types verbatim from the Task 0 read — do not guess `Untyped*` names; they are exactly the ones the section imports.)

- [ ] **Step 2: Write the failing helper test** `__tests__/regulatoryHelpers.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  getIconByName,
  getBadgeColor,
  deriveKeyDataPoints,
} from "@/features/market-research/components/intelligence/regulatory-compliance/regulatoryHelpers";

describe("regulatoryHelpers", () => {
  it("maps a known icon name to a component and falls back for unknown", () => {
    expect(getIconByName("scale")).toBeTruthy();
    expect(getIconByName("nonsense")).toBeTruthy(); // falls back (Scale)
  });
  it("maps known tags to distinct badge colours", () => {
    expect(getBadgeColor("New")).not.toEqual(getBadgeColor("Update"));
  });
  it("derives key data points from a keyUpdates array", () => {
    const pts = deriveKeyDataPoints(
      [{ title: "EU AI Act", description: "starts Q1 2026", tag: "New" }],
      { euAiActDeadline: "Q1 2026" },
    );
    expect(pts[0].title).toBe("EU AI Act");
    expect(pts[0].badge).toBe("New");
  });
  it("returns the hardcoded default set when keyUpdates is absent", () => {
    const pts = deriveKeyDataPoints(undefined, { euAiActDeadline: "Q1 2026" });
    expect(pts.length).toBeGreaterThan(0);
  });
});
```
Run red:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/components/intelligence/regulatory-compliance/__tests__/regulatoryHelpers.test.ts
```
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `regulatoryHelpers.ts`** — move `getIconByName` + `getBadgeColor` verbatim (their `switch` returns lucide components / Tailwind class strings — keep byte-identical to preserve visuals), and extract the inline `keyDataPoints` mapping into `deriveKeyDataPoints(keyUpdates, fields)`:
```ts
import { Sun, BarChart3, Building, Factory, TrendingUp, Users, Scale } from "lucide-react";
import type { RegulatoryKeyDataPoint, UntypedRegulatoryUpdate } from "./types";

export function getIconByName(iconName: string): unknown {
  /* lifted verbatim — switch(iconName){case 'sun':return Sun; … default:return Scale} */
}
export function getBadgeColor(tag: string): string {
  /* lifted verbatim — switch(tag){…} → "bg-…-100 text-…-800" */
}
export function deriveKeyDataPoints(
  keyUpdates: UntypedRegulatoryUpdate[] | undefined,
  fields: { euAiActDeadline: string },
): RegulatoryKeyDataPoint[] {
  /* lifted from the inline `keyDataPoints = Array.isArray(...) ? ...map(...) : [defaults]`
     — uses getIconByName/getBadgeColor; preserve the default set exactly */
}
```
If the audit shows `visualDataCards`/`regionalData` also have non-trivial default-merge logic worth testing, lift those into `deriveVisualDataCards(regulatoryData)` / `deriveRegionalData(regulatoryData)` here too with their own assertions; otherwise leave them inline in their section components.

- [ ] **Step 4: In the section, import the helpers/types** from `./regulatoryHelpers` and `./types`; delete the inline declarations and replace the inline `keyDataPoints` with `deriveKeyDataPoints(...)`. Run green + gates + commit:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/components/intelligence/regulatory-compliance/__tests__/regulatoryHelpers.test.ts
npm run lint && npx tsc --noEmit -p tsconfig.app.json
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): extract regulatoryHelpers + types from RegulatoryComplianceSection"
```

---

## Task 3: Section hook `useRegulatoryCompliance.ts` (TDD) — replace the raw fetch

**Files:**
- Create: `…/regulatory-compliance/useRegulatoryCompliance.ts`
- Test: `…/regulatory-compliance/__tests__/useRegulatoryCompliance.test.tsx`

> Spec 24 §6, R3. Add the hook that wraps the 5b data layer so the container can **delete `fetchRegulatoryComplianceData`** and stop consuming the `regulatoryData` / `isRefreshing` props as its data source. MSW handlers exist from 5b. (5b's page-rewire removed the *page's* fetches; this section still carries its own — that is what 5e removes.)

- [ ] **Step 1: Write the failing hook test** (RTL `renderHook` + `QueryClientProvider` + MSW):
```tsx
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRegulatoryCompliance } from "@/features/market-research/components/intelligence/regulatory-compliance/useRegulatoryCompliance";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useRegulatoryCompliance", () => {
  it("returns regulatory data from the 5b hook", async () => {
    const { result } = renderHook(() => useRegulatoryCompliance("user-1", "org-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.regulatoryData).toBeDefined();
  });
  it("exposes refresh() and isRefreshing", () => {
    const { result } = renderHook(() => useRegulatoryCompliance("user-1", "org-1"), { wrapper });
    expect(typeof result.current.refresh).toBe("function");
    expect(typeof result.current.isRefreshing).toBe("boolean");
  });
});
```
Run red (module missing).

- [ ] **Step 2: Implement `useRegulatoryCompliance.ts`:**
```ts
import {
  useRegenerateResearch,
  useResearchComponent,
} from "@/features/market-research/hooks/useMarketResearch";
import { RESEARCH_COMPONENTS } from "@/features/market-research/services/marketResearch";
import type { UntypedBackendApiResponse } from "./types";

export interface UseRegulatoryComplianceResult {
  regulatoryData: UntypedBackendApiResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
  isRefreshing: boolean;
}

export function useRegulatoryCompliance(userId: string, orgId: string): UseRegulatoryComplianceResult {
  const query = useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.regulatory);
  const regenerate = useRegenerateResearch(userId, orgId);
  return {
    // the section reads regulatoryData?.keyUpdates / .visualDataCards / .regionalData /
    // .strategicRecommendations — surface data in that shape (adapter below if needed)
    regulatoryData: query.data?.data as UntypedBackendApiResponse | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    refresh: () => regenerate.mutate(RESEARCH_COMPONENTS.regulatory),
    isRefreshing: regenerate.isPending,
  };
}
```
> **Reconcile (abort 4 backstop):** the section renders `regulatoryData?.{keyUpdates, visualDataCards, regionalData, strategicRecommendations, executiveSummary, euAiActDeadline, …}` (an `UntypedBackendApiResponse`), while the 5b hook returns `ResearchComponentResponse` (`{ status, data }`). Map `query.data?.data` to that shape — by typing the return here (preferred) or with a small `mapResearchToRegulatory(data)` adapter in `regulatoryHelpers.ts` (add a unit test if non-trivial). If `data` cannot supply a field a section renders, STOP and escalate to 5b (abort 4) — do not re-add a permanent prop or a raw `fetch`.

- [ ] **Step 3: Green + gates + commit:**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/components/intelligence/regulatory-compliance/__tests__/useRegulatoryCompliance.test.tsx
npm run lint && npx tsc --noEmit -p tsconfig.app.json
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "feat(fe): add useRegulatoryCompliance section hook wrapping useResearchComponent"
```

---

## Task 4: Extract `RegulatoryHeader.tsx`

**Files:**
- Create: `…/regulatory-compliance/RegulatoryHeader.tsx`
- Test: `…/regulatory-compliance/__tests__/RegulatoryHeader.test.tsx`

> Spec 24 §6. The header block (~1078–1131): the "Regulatory & Compliance Highlights" title, the always-visible **Edit** button (`handleModify` → `onToggleEdit`), and the **Scout chat** icon (`onScoutIconClick("regulatory-compliance", hasEdits)`). Fully controlled.

- [ ] **Step 1: Failing RTL test** — render and assert: clicking Edit calls `onToggleEdit`; clicking the Scout icon calls `onScoutIconClick` with the `"regulatory-compliance"` context.
- [ ] **Step 2: Implement** (lift the header JSX):
```tsx
export interface RegulatoryHeaderProps {
  isEditing: boolean;
  hasEdits: boolean;
  onToggleEdit: () => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape" | "regulatory-compliance",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
}
export function RegulatoryHeader(props: RegulatoryHeaderProps) { /* lifted header JSX */ }
```
- [ ] **Step 3:** Render `<RegulatoryHeader … />` at the top of the card; delete the inlined header. Gates + commit `refactor(fe): extract RegulatoryHeader from RegulatoryComplianceSection`.

---

## Task 5: Extract `ComplianceVisualCard.tsx` (TDD — chart renderer)

**Files:**
- Create: `…/regulatory-compliance/ComplianceVisualCard.tsx`
- Test: `…/regulatory-compliance/__tests__/ComplianceVisualCard.test.tsx`

> Spec 24 §6, §8. One card of the Compliance Analytics block — the recharts renderer that switches on chart type (`bar-chart` / `pie-chart` / `area-chart`), driven by `hoveredCard`. This is the densest single block; extracting it first makes the Analytics section (Task 8) thin. Logic-bearing (chart-type switch) → test first.

- [ ] **Step 1: Failing RTL test** — render with a fixture `bar-chart` card and assert the title renders; render with a `pie-chart` card and assert it does not throw. (recharts uses `ResponsiveContainer`; wrap in a fixed-size div or mock `ResponsiveContainer` per the repo's existing chart-test pattern — check how other chart tests handle it.)
- [ ] **Step 2: Implement** — lift one `visualDataCards.map(...)` card body (~1302–1723 compact / ~2410–2563 expanded) into `ComplianceVisualCard`. Props:
```tsx
import type { UntypedVisualDataCard } from "./types";
export interface ComplianceVisualCardProps {
  card: UntypedVisualDataCard;
  cardIndex: number;
  isEditing: boolean;
  isHovered: boolean;
  onHover: (cardId: string | null) => void;
  onCardChange?: (index: number, next: UntypedVisualDataCard) => void; // edit path
}
export function ComplianceVisualCard(props: ComplianceVisualCardProps) {
  /* lifted bar/pie/area recharts switch */
}
```
Keep the chart markup byte-identical. The `hoveredCard` state stays in the container; pass `isHovered`/`onHover`.
- [ ] **Step 3:** Use it in the container's Analytics map for now (Task 8 lifts the map itself). Gates + commit `refactor(fe): extract ComplianceVisualCard from RegulatoryComplianceSection`.

---

## Task 6: Extract `ExecutiveSummarySection.tsx`

**Files:**
- Create: `…/regulatory-compliance/ExecutiveSummarySection.tsx`
- Test: `…/regulatory-compliance/__tests__/ExecutiveSummarySection.test.tsx`

> Spec 24 §6. The Executive Summary section (h3 ~1163 compact / ~2343 expanded): a `<textarea>` bound to `executiveSummary`/`onExecutiveSummaryChange` when `isEditing`, a `<p>` otherwise. Controlled.

- [ ] **Step 1: Failing RTL test** — render not-editing → assert summary text shows as static; render editing → typing in the textarea calls `onChange`.
- [ ] **Step 2: Implement** — lift both the compact and expanded summary markup (preserve both):
```tsx
export interface ExecutiveSummarySectionProps {
  value: string;
  localValue: string;
  isEditing: boolean;
  isExpanded: boolean;
  onChange: (v: string) => void;
}
export function ExecutiveSummarySection(props: ExecutiveSummarySectionProps) { /* … */ }
```
- [ ] **Step 3:** Render in the container (both layout branches); delete inlined markup. Gates + commit `refactor(fe): extract ExecutiveSummarySection from RegulatoryComplianceSection`.

---

## Task 7: Extract `KeyRegulatoryUpdatesSection.tsx`

**Files:**
- Create: `…/regulatory-compliance/KeyRegulatoryUpdatesSection.tsx`
- Test: `…/regulatory-compliance/__tests__/KeyRegulatoryUpdatesSection.test.tsx`

> Spec 24 §6. The Key Regulatory Updates section (h3 ~1207/2352): renders `keyDataPoints.map(...)` cards (icon/title/value/badge/tooltip) and the compact "Read More" affordance. Presentational; `keyDataPoints` is derived by `deriveKeyDataPoints` (Task 2) and passed in.

- [ ] **Step 1: Failing RTL test** — render with fixture `keyDataPoints`; assert one card per point and the badge text shows.
- [ ] **Step 2: Implement** — lift the updates grid:
```tsx
import type { RegulatoryKeyDataPoint } from "./types";
export interface KeyRegulatoryUpdatesSectionProps {
  keyDataPoints: RegulatoryKeyDataPoint[];
  isEditing: boolean;
  isExpanded: boolean;
  localKeyDataValues: Record<string, string>;
  onKeyDataValueChange: (id: string, value: string) => void;
}
export function KeyRegulatoryUpdatesSection(props: KeyRegulatoryUpdatesSectionProps) { /* … */ }
```
- [ ] **Step 3:** Wire into the container (both layout branches); delete inlined markup. Gates + commit `refactor(fe): extract KeyRegulatoryUpdatesSection from RegulatoryComplianceSection`.

---

## Task 8: Extract `ComplianceAnalyticsSection.tsx`

**Files:**
- Create: `…/regulatory-compliance/ComplianceAnalyticsSection.tsx`
- Test: `…/regulatory-compliance/__tests__/ComplianceAnalyticsSection.test.tsx`

> Spec 24 §6. The Compliance Analytics section (h3 ~1302/2410): the `visualDataCards.map(...)` grid of `<ComplianceVisualCard>` (Task 5). Presentational wrapper over the card; owns the grid layout only.

- [ ] **Step 1: Failing RTL test** — render with two fixture cards; assert two card titles render.
- [ ] **Step 2: Implement** — lift the grid map (it now renders `<ComplianceVisualCard>` per card):
```tsx
import type { UntypedVisualDataCard } from "./types";
export interface ComplianceAnalyticsSectionProps {
  visualDataCards: UntypedVisualDataCard[];
  isEditing: boolean;
  isExpanded: boolean;
  hoveredCard: string | null;
  onHover: (cardId: string | null) => void;
  onCardChange?: (index: number, next: UntypedVisualDataCard) => void;
}
export function ComplianceAnalyticsSection(props: ComplianceAnalyticsSectionProps) { /* maps → ComplianceVisualCard */ }
```
- [ ] **Step 3:** Wire into the container (both branches); delete inlined grid. Gates + commit `refactor(fe): extract ComplianceAnalyticsSection from RegulatoryComplianceSection`.

---

## Task 9: Extract `RegionalComplianceSection.tsx`

**Files:**
- Create: `…/regulatory-compliance/RegionalComplianceSection.tsx`
- Test: `…/regulatory-compliance/__tests__/RegionalComplianceSection.test.tsx`

> Spec 24 §6. The Regional Compliance Overview / Regional Breakdown (h3 ~1754/2566): `regionalData.map(...)` table with `region.deadline` / `region.requirements`, editable rows in edit mode. Mostly presentational; row edits go up via callback.

- [ ] **Step 1: Failing RTL test** — render with fixture `regionalData`; assert one row per region and the deadline/requirements cells show; in edit mode, editing a cell calls the row-change callback.
- [ ] **Step 2: Implement** — lift the regional table:
```tsx
import type { UntypedRegionData } from "./types";
export interface RegionalComplianceSectionProps {
  regionalData: UntypedRegionData[];
  isEditing: boolean;
  isExpanded: boolean;
  onRegionalDataChange: (next: UntypedRegionData[]) => void;
}
export function RegionalComplianceSection(props: RegionalComplianceSectionProps) { /* … */ }
```
- [ ] **Step 3:** Wire into the container (both branches); delete inlined table. Gates + commit `refactor(fe): extract RegionalComplianceSection from RegulatoryComplianceSection`.

---

## Task 10: Extract `StrategicRecommendationsSection.tsx`

**Files:**
- Create: `…/regulatory-compliance/StrategicRecommendationsSection.tsx`
- Test: `…/regulatory-compliance/__tests__/StrategicRecommendationsSection.test.tsx`

> Spec 24 §6. The Strategic Recommendations section (h3 ~1969/2623): the three lists from the `localStrategicRecommendations` object — `mitigateRegulatoryRisks`, `competitivePositioning`, `goToMarketStrategy` — each editable (add/remove items in edit mode). Presentational; edits go up via callback.

- [ ] **Step 1: Failing RTL test** — render with a fixture recommendations object; assert items from each of the three lists render; in edit mode, removing an item calls the change callback.
- [ ] **Step 2: Implement** — lift the recommendations block:
```tsx
import type { UntypedBackendApiResponse } from "./types";
export interface StrategicRecommendationsSectionProps {
  recommendations: UntypedBackendApiResponse; // { mitigateRegulatoryRisks, competitivePositioning, goToMarketStrategy }
  isEditing: boolean;
  isExpanded: boolean;
  onChange: (next: UntypedBackendApiResponse) => void;
}
export function StrategicRecommendationsSection(props: StrategicRecommendationsSectionProps) { /* … */ }
```
- [ ] **Step 3:** Wire into the container (both branches); delete inlined block. Gates + commit `refactor(fe): extract StrategicRecommendationsSection from RegulatoryComplianceSection`.

---

## Task 11: Extract `RegulatoryFooter.tsx` + remove this section's `MarketIntelligenceTabProps` data slice

**Files:**
- Create: `…/regulatory-compliance/RegulatoryFooter.tsx` (+ test)
- Modify: `…/regulatory-compliance/RegulatoryComplianceSection.tsx` (container: footer wiring + hook-source the data; drop the data slice)
- Modify: the composition layer that renders the section (`MarketIntelligenceSections.tsx` — confirm from Task 0)
- **Do NOT delete** `MarketIntelligenceTabProps.ts` (or its relocated path if 5a moved it)

> Spec 24 §6, R3. Lift the footer chrome, then switch the container's data source from the `regulatoryData` prop to `useRegulatoryCompliance` (Task 3), removing the section's data slice of `MarketIntelligenceTabProps`. **The interface is retained** — other sections still consume it; 5h (MarketSize, the last consumer) deletes it and 5i confirms.

- [ ] **Step 1: Extract `RegulatoryFooter.tsx`** — the footer block: Save/Cancel (~2237, `onSaveChanges`/`onCancelEdit`), **Edit History** (~2325, `onEditHistoryOpen`), **Export Options** (~2710, `onExportPDF`/`onSaveToWorkspace`/`onGenerateShareableLink`), **Read More**/**Show Less** (~2391/2744, `onExpandToggle`). Controlled:
```tsx
export interface RegulatoryFooterProps {
  isEditing: boolean;
  isExpanded: boolean;
  isSplitView: boolean;
  hasEdits: boolean;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onEditHistoryOpen: () => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  onExpandToggle: (expanded: boolean) => void;
}
export function RegulatoryFooter(props: RegulatoryFooterProps) { /* lifted footer JSX */ }
```
RTL test: clicking Save/Cancel/Export/Read-More fires the right callback. Wire in; delete inlined footer. Commit `refactor(fe): extract RegulatoryFooter from RegulatoryComplianceSection`.

- [ ] **Step 2: Hook-source the data; delete `fetchRegulatoryComplianceData` and the data slice.** In the container, derive `regulatoryData` from the hook and drop the `regulatoryData`/`isRefreshing` props as the data source (the section needs a `userId` + `organizationId` to call the hook — add them to the prop slice if not already threaded; confirm `MarketIntelligenceSections` passes an org id, e.g. via `useAuth()` → `{ currentUser, orgId }` so `userId = currentUser?.uid`, and pass them through):
```tsx
import { useRegulatoryCompliance } from "./useRegulatoryCompliance";

// inside the component:
const { regulatoryData, isLoading: _isLoading, refresh, isRefreshing } =
  useRegulatoryCompliance(userIdToUse, orgIdToUse);   // orgIdToUse already exists (line ~129); userIdToUse = useAuth().currentUser?.uid
// DELETE fetchRegulatoryComplianceData and the `propRegulatoryData` prop usage.
// Refresh affordances call refresh(); loading uses isLoading/isRefreshing.
```
Remove `regulatoryData?: UntypedBackendApiResponse` and (as a data source) `isRefreshing` from the prop slice. **Keep the edit-persistence props** (`onSaveChanges`, the five `on*Change`, `onDeleteSection`, `editHistory`, `deletedSections`, etc.) — those are not data-layer; they remain parent-owned unless the audit shows the edit path is dead. Record the decision.

- [ ] **Step 3: Update the caller.** In `MarketIntelligenceSections.tsx`, stop passing `regulatoryData` (and `isRefreshing` as data) to `<RegulatoryComplianceSection>`; pass the `userId`/`organizationId`/`orgId` the hook needs (if the layer doesn't already — `userId` from `useAuth().currentUser?.uid`). **Leave the `regulatory*`/`regulatoryData` fields on `MarketIntelligenceTabProps` and any data still flowing for other sections** — only stop threading them into *this* section.

- [ ] **Step 4: Confirm the interface is retained + note remaining consumers + gates + commit:**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rln 'MarketIntelligenceTabProps' src --include=*.ts --include=*.tsx   # expect: interface file + other sections still
test -f src/components/market-research/MarketIntelligenceTabProps.ts || find src -name MarketIntelligenceTabProps.ts
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx knip --strict --no-progress   # interface still referenced elsewhere → must NOT be flagged; if it is, a consumer was missed
npm run test
```
Record the remaining consumers (e.g. MarketSize / IndustryTrends / Competitor / MarketEntry slices, per the live grep) for the PR. If knip flags `MarketIntelligenceTabProps` unused, a consumer was missed — investigate; do **not** delete the interface.
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): source RegulatoryCompliance via hook; drop its MarketIntelligenceTabProps data slice"
```

---

## Task 12: Section error boundary + final preflight + done-when + handoff

**Files:**
- Modify: the caller (or the section's barrel consumer) to wrap the section in `<FeatureErrorBoundary>` (if 5c didn't already wrap at this granularity)

> Spec 24 §6, §8, R6. A parse/render fault in one section (the recharts cards especially) should not blank the surrounding intelligence surface. Warranted here because the regulatory `result` is free-form AI content and five sections + the chart renderer render derived slices.

- [ ] **Step 1: Wrap the section** consistently with how 5c/5d wrap sibling sections (verify the established convention in Task 0 — at the call site in `MarketIntelligenceSections.tsx` vs inside the section file; match it):
```tsx
import { FeatureErrorBoundary } from "@/shared/components";

<FeatureErrorBoundary featureName="Regulatory & Compliance">
  <RegulatoryComplianceSection … />
</FeatureErrorBoundary>
```
If 5c/5d already wrap each section (or the whole intelligence surface) and the team's convention is one boundary at that level, **do not add a redundant one** — note it in the PR. Gates; commit `refactor(fe): wrap RegulatoryComplianceSection in FeatureErrorBoundary` (only if a boundary was added).

- [ ] **Step 2: Full preflight on the branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS end-to-end (typecheck → lint → format:check → test → build → bundle:check → test:e2e → knip --strict).

- [ ] **Step 3: Behavioral parity — `journeys/04` green; NO MR pixel VR**

The Playwright run inside Step 2 includes `e2e/journeys/04-market-research-5-components.spec.ts`. Confirm it passed and that **no `toHaveScreenshot` / pixel-VR assertion was added for market-research** (R6 — the 5a TD-FE defers MR VR). If `journeys/04` reds, the swap changed behavior (a section not rendering, the refresh wiring, the hook not firing, a chart crash) — investigate, fix, re-run; if unfound, STOP (abort 5).

- [ ] **Step 4: Done-when (spec §6 "Done when (each)")**

Confirm each, fixing any gap before declaring done:
1. The section renders from `components/intelligence/regulatory-compliance/` as a tree of single-purpose files (container + header + footer + five section components + `ComplianceVisualCard` + `regulatoryHelpers` + `types` + `useRegulatoryCompliance`).
2. Each section/sub-component is its own file; logic-bearing ones (`regulatoryHelpers`, `useRegulatoryCompliance`, `ComplianceVisualCard`) have Vitest/RTL tests.
3. The section's data comes from `useRegulatoryCompliance` (5b hooks); it holds **no raw `fetch`** (the in-component `fetchRegulatoryComplianceData` is gone).
4. This section's `MarketIntelligenceTabProps` **data** slice is removed; the interface is **retained**; remaining consumers noted.
5. `<FeatureErrorBoundary>` covers the section (or the convention 5c/5d set is honoured).
6. `journeys/04` + Vitest + `npm run preflight` green; **no `toHaveScreenshot` added for market-research**.

- [ ] **Step 5: Hand off for review + merge**

Per Spec 24 §10: `/review-impl` → `/synthesize-impl-review` (loop until nit-or-below; depth is the orchestrator's call). Then the controller runs `npm run preflight` once more and, on green, merges `phase-5e-regulatory-compliance` → `master`. Flag for the reviewer: the seam-audit deltas (if any), the remaining `MarketIntelligenceTabProps` consumers, the `ResearchComponentResponse.data` → regulatory-shape adapter decision (Task 3), whether the compact/expanded code paths were kept separate or unified, and whether the edit-persistence props were kept or dropped (Task 11). **5f (CompetitorLandscape) must not begin until 5e is merged.**

---

## Self-review notes (plan author)

- **Matched to the live file, not assumed.** I read the real `RegulatoryComplianceSection.tsx` end-to-end. It is **NOT tab-based** (0 `<TabsContent>`): it is a single `<Card>` rendering five visual sections — **Executive Summary, Key Regulatory Updates, Compliance Analytics (recharts), Regional Compliance Overview, Strategic Recommendations** — in two layout modes (compact vs `isExpanded`), with a header (edit/Scout) and footer (save/cancel + export + read-more). It has ~12 `useState` (incl. five `local*` editing strings + `localRegionalData`/`localVisualDataCards`/`localStrategicRecommendations`/`localKeyDataValues`), ~11 `useEffect`, and **a real raw `fetch`** (`fetchRegulatoryComplianceData`) plus a `regulatoryData?: UntypedBackendApiResponse` prop. The inventory mirrors that; Task 0's read of the moved file is authoritative and wins on any conflict (abort 3).
- **The fetch is real → the hook genuinely earns its place.** Unlike a props-only section, this one fetches, so Task 3's `useRegulatoryCompliance` both removes `fetchRegulatoryComplianceData` and replaces the `regulatoryData` prop. The one real risk is the `ResearchComponentResponse.data` → `UntypedBackendApiResponse` (`keyUpdates`/`visualDataCards`/`regionalData`/`strategicRecommendations`) mapping; Task 3 makes the adapter explicit and escalates to 5b rather than re-adding a prop or a `fetch` (abort 4).
- **Decomposition mirrors 5d** (`MarketEntrySection` has the identical prop/edit/fetch/`local*` shape): thin container + section hook + one file per visual section + a chart-card file + tested helpers/types. Eight visual files (header, footer, five sections, chart card) + three logic/type modules.
- **Both layout paths preserved.** The section is rendered compact and expanded with differing markup; the template warns to lift both and not collapse them unless proven identical — this is the most likely place a careless extraction would change visuals (guarded by `journeys/04`, not pixel VR).
- **Props discipline:** the **data** slice (`regulatoryData`, `isRefreshing`-as-data) is removed (Task 11); the **edit-persistence** props (the five `on*Change`, `onSaveChanges`, `onDeleteSection`, `editHistory`, `deletedSections`, export/share callbacks) are kept unless shown dead, because they are parent-owned edit wiring, not data-layer. `MarketIntelligenceTabProps.ts` is **retained** — 5h deletes it (last consumer), 5i confirms; remaining consumers noted; knip guards against an accidental orphan.
- **Editing state stays in the container; sub-components are controlled** (value + setter/callback pairs), so every section/card is independently RTL-testable.
- **Visual guard is behavioral E2E `journeys/04` + Vitest/RTL + preflight — no market-research pixel VR**, and no `toHaveScreenshot` assertions are added (Spec 24 R6 / 5a TD-FE). Every sub-component is one commit and independently revertible; the transitional `features/`→legacy exception applies (the section imports `@/lib/types/escape-hatches` and the legacy composition layer renders it).
