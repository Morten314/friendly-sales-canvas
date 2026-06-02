---
artifact: phase-5e-regulatory-compliance
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-02
round: 1
base_ref: master
spec_loaded: false
plan_loaded: true
---

## Context

No spec file was found at `specs/phase-5e-regulatory-compliance.md` or similar. The spec at `specs/24-frontend-phase-5-market-research-design.md` exists but was not loaded by auto-discovery (branch name `phase-5e-regulatory-compliance` does not match the spec naming pattern). Adherence checking is done against the loaded plan (`plans/24e-frontend-phase-5e-regulatory-compliance.md`) only.

The branch contains 14 commits. The diff deletes the original 2,764-line monolithic `RegulatoryComplianceSection.tsx` and replaces it with a thin 1,000-line container plus 8 extracted sub-components, 3 logic modules (helpers, types, hook), and 10 test files. Also includes a backend-host repoint from `backend-11kr` to `brewra-gtm-intelligence` and TECH_DEBT updates documenting decisions.

## Findings

### [High] Hardcoded default data duplicated in 5+ locations

**Location:** `RegulatoryComplianceSection.tsx:729-793` (derived `visualDataCards` and `regionalData` defaults), `RegulatoryComplianceSection.tsx:332-441` (same defaults inside `handleModify`), `RegulatoryComplianceSection.tsx:636-701` (same defaults inside the `useEffect` initializer), and `StrategicRecommendationsSection.tsx:89-93,175-180,262-267` (hardcoded recommendation lists in non-editing fallback).

The default regional data (EU/US/China/UK rows), default visual data cards (Compliance Adoption Rates/Regulatory Timeline/Risk Indicators), and default strategic recommendations are copy-pasted verbatim across multiple code sites. If a default ever needs changing, it must be updated in 3-5 places simultaneously. The plan's Task 2 explicitly considered lifting default-merge logic into `regulatoryHelpers.ts` (`deriveVisualDataCards` / `deriveRegionalData`) but decided against it — that was a reasonable scope call for decomposition, but the resulting duplication is a maintenance trap. Recommend a dedicated `regulatoryDefaults.ts` constants file or lifting the defaults into `regulatoryHelpers.ts` as a follow-up.

### [High] Non-editing mode in `StrategicRecommendationsSection` ignores `localStrategicRecommendations` state

**Location:** `StrategicRecommendationsSection.tsx:87-93` and `StrategicRecommendationsSection.tsx:260-418`.

When `isEditing=false`, the section renders from `regulatoryData?.strategicRecommendations?.mitigateRegulatoryRisks` (the API data) or hardcoded fallbacks — it never reads `localStrategicRecommendations`. This means after the user edits strategic recommendations and saves (exits edit mode), the non-editing view immediately reverts to the API data, discarding the local edits visually. The editing mode *does* read from `localStrategicRecommendations` (line 87). This is a state-coherence bug: the compact/expanded non-editing render path should fall back to `localStrategicRecommendations` when populated, then to `regulatoryData`, then to hardcoded defaults — matching the pattern used in `ExecutiveSummarySection` (which correctly reads `currentExecutiveSummary` in both modes).

### [Medium] Container still has ~80 lines of commented-out code

**Location:** `RegulatoryComplianceSection.tsx:233-240` and `RegulatoryComplianceSection.tsx:446-453`.

Two `useEffect` blocks are commented out with explanations about why ("overwrote local state with original values"). The plan states: "Two `useEffect` are commented out — leave them commented, do not revive" (plan §Task 0 anchor). This was preserved as-directed from the original file, and the plan explicitly chose to carry them forward. However, commented-out code is dead code — it should either be deleted (the intent is documented in the plan) or converted to a brief comment explaining the design decision. The 14 lines of commented-out code add noise to an already-complex container.

### [Medium] Dual `localStorage` write pattern: user-specific and non-user-specific keys

**Location:** `RegulatoryComplianceSection.tsx:161-189` vs `RegulatoryComplianceSection.tsx:488-489`.

Lines 161-189 use the raw `localStorage.setItem("regulatory_executiveSummary", ...)` (non-user-scoped), while lines 488-489 and 548-557 use `setUserLocalStorage("regulatory-compliance_original_json", ..., currentUser?.uid)` (user-scoped). The `useState` initializers (lines 80-118) read via `getUserLocalStorage(..., currentUser?.uid)` (user-scoped), meaning the raw `localStorage.setItem` writes can never be read back — they write to a different key than what `getUserLocalStorage` reads. This is a pre-existing bug carried forward from the monolith, but it's now spread across the container. The five effects on lines 161-189 are writing to dead keys.

### [Medium] `KeyRegulatoryUpdatesSection` has unused `hoveredCard` state in non-editing mode with no tooltip on editing path

**Location:** `KeyRegulatoryUpdatesSection.tsx:58`.

`hoveredCard` state (line 58) is declared and used for custom tooltip rendering in the non-editing path (lines 166-190), which is fine. However, the editing path (lines 91-153) does not use `hoveredCard` at all. The state is harmless but adds unnecessary re-renders on mouse events in edit mode. More importantly, the `useState` import on line 2 and the `Dispatch<SetStateAction>` on line 3 are imported but only `useState` is used — the `Dispatch` import appears unused in this file. (Correction: `Dispatch<SetStateAction>` is used for `setLocalKeyDataValues` prop type on line 33.)

### [Medium] Container declares `isRefreshing` from hook but destructures it away

**Location:** `RegulatoryComplianceSection.tsx:57`.

`const { regulatoryData, refresh } = useRegulatoryCompliance(...)` destructures only `regulatoryData` and `refresh`, dropping `isLoading`, `isError`, and `isRefreshing`. The hook exposes these fields, and `isLoading` was historically used to show a "Loading..." state. The current container has no loading indicator — the section silently renders defaults until data arrives. This is a UX regression vs. the original monolith which had `_isLoading` state and a loading fallback. Not a bug per the plan (the plan's goal was byte-identical decomposition, not behavior improvement), but worth noting for the follow-up.

### [Medium] `ComplianceVisualCard` has inconsistent expanded/compact rendering paths

**Location:** `ComplianceVisualCard.tsx:27-151` (expanded) vs `ComplianceVisualCard.tsx:153-508` (compact by type).

The expanded path (lines 27-151) renders all chart types inline in a single branch — it does NOT get the editing affordance (no `isEditing` check for input fields). The compact paths (lines 153-508 for `bar-chart`, `timeline`, `percentage`) DO include editing affordances. This means: when `isEditing=true` + `isExpanded=true`, the Compliance Analytics cards render in expanded mode (from `ComplianceAnalyticsSection.tsx:94-106` where `isExpanded=true` is hardcoded for non-editing), which has no editing UI. The editing path is only reached when `isExpanded=false`. The container does pass `isEditing={true}` + `isExpanded={false}` for the editing case (line 846), so this works by accident — the editing mode always uses `isExpanded=false` for analytics cards. But the component's internal logic is confusing: expanded mode ignores `isEditing` entirely.

### [Medium] Backend host repoint bundled with structural decomposition

**Location:** `frontend/src/lib/api.ts`, `frontend/vite.config.ts`, `frontend/vercel.json`, `frontend/src/features/market-research/hooks/useMarketResearchData.ts`.

The plan's Task scope is purely the regulatory compliance decomposition. The backend host repoint (`backend-11kr` → `brewra-gtm-intelligence`) is a separate infra change that affects the global API config. It was bundled into this branch as a convenience commit. While it's documented in TECH_DEBT (TD-FE-13 resolved), this mixes concerns — if the branch needs partial revert, the host repoint would be swept up with it. The change itself is correct (consolidated to `BACKEND_BASE_URL` single source of truth, mirrored in `vite.config.ts` and `vercel.json` where imports aren't possible).

### [Low] `RegulatoryHeader` drops `isEditing` prop vs plan spec

**Location:** `RegulatoryHeader.tsx:7-15`.

The plan's Task 4 specifies `RegulatoryHeaderProps` should include `isEditing: boolean`. The implementation omits it — the header shows the Edit button unconditionally regardless of editing state. This is likely intentional (the original header showed Edit at all times), but it deviates from the plan's prop interface specification.

### [Low] `useRegulatoryCompliance` uses double cast `as unknown as`

**Location:** `useRegulatoryCompliance.ts:27`.

`query.data?.data as unknown as UntypedBackendApiResponse | undefined` uses a double cast. The plan specified `as UntypedBackendApiResponse | undefined` (single cast). The double cast is needed because `query.data?.data` is `Record<string, unknown>` (from `ResearchComponentSchema`) and the single cast might not satisfy TS strict. This is fine technically but hints at the type-safety gap — the regulatory data shape is asserted, not validated.

### [Low] `StrategicRecommendationsSection` has dead conditional branches

**Location:** `StrategicRecommendationsSection.tsx:342-344`, `StrategicRecommendationsSection.tsx:369-371`, `StrategicRecommendationsSection.tsx:396-398`.

Three ternary expressions like `regulatoryData?.strategicRecommendations ? "Mitigate Regulatory Risks" : "Mitigate Regulatory Risks"` have identical truthy and falsy branches. These are no-ops — the heading text is always the same regardless of condition.

### [Low] `RegulatoryFooter` imports `isSplitView` but only uses it to gate "Show Less" button

**Location:** `RegulatoryFooter.tsx:112`.

`isSplitView` is a required prop but only used to conditionally hide the "Show Less" button. This is a correct carry-forward from the original code, but the prop name suggests broader usage.

### [Nit] `ComplianceAnalyticsSection` passes `isExpanded={false}` when editing and `isExpanded={true}` when not editing

**Location:** `ComplianceAnalyticsSection.tsx:77` and `ComplianceAnalyticsSection.tsx:101`.

The `isExpanded` flag passed to `ComplianceVisualCard` is not the parent's `isExpanded` — it's hardcoded based on editing state. This works but is semantically misleading.

### [Nit] `KeyRegulatoryUpdatesSection` renders `<li>` outside `<ul>`

**Location:** `KeyRegulatoryUpdatesSection.tsx:131,218,303`.

In non-editing mode, individual items use `<li className="...">• {item}</li>` but are not wrapped in a `<ul>` parent. The `•` is also manually added as text content rather than using CSS `list-style`.

### [Nit] `BACKEND_BASE_URL` exported but `ICP_BACKEND_URL` is a template-literal alias

**Location:** `frontend/src/lib/api.ts:28`.

`export const ICP_BACKEND_URL = \`${BACKEND_BASE_URL}\`;` uses a template literal to produce an identical string. The comment explains this is to prevent `knip --strict` from flagging it as a duplicate export, which is a valid concern, but the pattern is slightly surprising.
