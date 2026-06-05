---
artifact: specs/30-frontend-phase-9-scout-profiler-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 2
---

## Context

This review was performed against the spec at the worktree path `.claude/worktrees/phase-9-scout-profiler/specs/30-frontend-phase-9-scout-profiler-design.md`. LOC counts and importer lists were verified against the actual file contents in that worktree. The round-1 review and synthesis were consulted to avoid re-treading ground.

## Findings

### [Critical] §9 drain table omits 7 of 11 files in `components/market-research/`

**Location:** §9 "Drain the legacy `components/market-research/` directory", drain table (lines 170–178)

The spec's drain table lists 4 files: `ScoutChatPanel.tsx`, `types.ts`, `ChatWithScout.tsx`, `ScoutDeploymentDetails.tsx`. The actual legacy directory contains **11 files** (including the `lead-stream/` subdirectory). The following 7 files (1,995 LOC total) are unaccounted for:

| Unlisted file | LOC | Live consumers |
|---|---|---|
| `EditDropdownMenu.tsx` | 44 | `features/customers/components/icp-intelligence/SuggestedICPCard.tsx`, `CurrentIcpsTable.tsx` |
| `ScoutSettingsForm.tsx` | 137 | `features/market-research/pages/MarketResearchPage.tsx` |
| `ScoutLeadStream.tsx` | 65 | `lead-stream/LeadStreamTab.tsx` (internal) |
| `lead-stream/LeadStreamTab.tsx` | 51 | `features/market-research/pages/MarketResearchPage.tsx` |
| `lead-stream/LeadsTable.tsx` | 773 | `ScoutLeadStream.tsx` (internal) |
| `lead-stream/OpportunityDashboard.tsx` | 246 | `ScoutLeadStream.tsx` (internal) |
| `lead-stream/leadData.ts` | 679 | `lib/marketScoresHeatmap.ts`, `lib/leadStreamHeatmapSession.ts`, `features/strategist/components/StrategistRecommendations.tsx`, `StrategistLeadStream.tsx` |

The spec claims the directory will be "EMPTIED / removed" (§3 line 86, §9 line 170). With 7 files unaddressed, this promise cannot be fulfilled. Furthermore, the file manifest appendix (line 269–273) also lists only the same 4 files.

**Two of the unlisted files create cross-feature coupling problems:**

- `EditDropdownMenu.tsx` is imported by `features/customers/`. Moving it to `features/market-research/` (the spec's stated destination constraint) would create a `customers → market-research` cross-feature import — violating §10's "No new `feature → feature` import" guarantee (line 186).
- `lead-stream/leadData.ts` is imported by `features/strategist/` and `src/lib/`. Moving it to `features/market-research/` would create `strategist → market-research` cross-feature imports.

**Recommendation:** The spec must either (a) enumerate all 11 files with explicit dispositions for each, or (b) acknowledge that the drain is partial, update the "EMPTIED" claim to a scoped subset, leave TD-FE-51 open (or split it), and record the unaddressed files as a new TD entry for a future phase. For `EditDropdownMenu.tsx` and `leadData.ts`, relocation destinations must respect the no-cross-feature-import constraint — candidates include `shared/` or keeping them in place with a TD entry.

### [High] `types.ts` drain destination places shared type under scout-chat subfolder

**Location:** §9 drain table (line 175), §3 target structure (line 73)

The spec moves `types.ts` to `features/market-research/components/scout-chat/`. However, `EditRecord` (its primary export) is imported by **7+ files** across multiple market-research sub-features: `intelligence/market-size/MarketSizeSection.tsx`, `intelligence/market-entry/MarketEntrySection.tsx`, `intelligence/industry-trends/types.ts`, `intelligence/competitor-landscape/types.ts`, `intelligence/IntelligenceTab.tsx`, `components/MarketIntelligenceSections.tsx`, and `components/trends/TrendsTab.tsx`. Only two consumers are in `scout-chat/`.

Placing this shared type definition inside `components/scout-chat/` misrepresents its scope and creates a confusing import path for the 5+ non-scout-chat consumers.

**Recommendation:** Move `types.ts` to `features/market-research/types.ts` (top-level within the feature) or `features/market-research/components/types.ts`, not under `scout-chat/`.

### [High] `leadData.ts` cross-boundary consumers not addressed by any disposition

**Location:** §9, §10 (line 186), and unaddressed by §2 out-of-scope list

`leadData.ts` (679 LOC — the second-largest file in the legacy directory) exports `HeatmapLead`, `Rating`, `getPriority`, `heatmapLeads`. Its consumers span three organizational boundaries:

1. `src/lib/marketScoresHeatmap.ts` — shared utility
2. `src/lib/leadStreamHeatmapSession.ts` — shared utility
3. `features/strategist/components/StrategistRecommendations.tsx` — different feature
4. `features/strategist/components/StrategistLeadStream.tsx` — different feature

Neither the §9 drain table nor the §2 out-of-scope list mentions these imports or the file. If Phase 9 drains `components/market-research/` without moving `leadData.ts`, the directory isn't emptied. If it moves `leadData.ts` into `features/market-research/`, it creates two `strategist → market-research` cross-feature imports. The spec needs an explicit disposition: either relocate to `shared/`, keep in place as TD, or document the tradeoff.

### [Medium] `features/scout/` contains only 2 source files — value is marginal

**Location:** §7 (lines 146–156), §3 target structure (lines 63–66)

The new `features/scout/` folder holds only `ScoutDeploymentPage.tsx` (page) and `ScoutDeployment.tsx` (component), plus boilerplate (`routes.tsx`, `index.ts`, `README.md`). The page is a thin wrapper around the component, which is a read-only settings/deployment detail view. The spec justifies this as "Scout's genuinely-distinct surface" (§1.1 line 29), but a 2-file feature folder with no hooks, services, or state is architecturally lightweight to the point of ceremony.

This isn't wrong — it follows the per-phase convention — but it's worth noting that the value of `features/scout/` is primarily naming/organizational rather than architectural. If future Scout-specific code doesn't materialize, this folder could be consolidated back into `features/market-research/` without loss.

### [Medium] `renderChat` prop pattern has no mechanism for imperative ref forwarding

**Location:** §4 (lines 112–127)

The `ChatWithHistoryProps` interface uses `renderChat: (state) => React.ReactNode`. If the history shell ever needs to call imperative methods on the rendered chat surface (e.g., `scrollToBottom`, `focusInput`, `triggerSubmit`), the current prop signature provides no way to obtain a ref to the rendered surface. The existing wrappers likely handle this internally today via direct refs within the same component.

This is not necessarily needed now — the spec correctly identifies that the shell owns session/sidebar/persistence while the caller owns the surface — but the interface should either (a) state that no imperative calls from shell to surface are needed (with justification), or (b) provide a `ref` mechanism in the interface.

**Recommendation:** Add a brief note to §4 or §17 explicitly scoping out imperative ref forwarding from shell to surface, so the plan doesn't need to discover this during implementation.

### [Medium] §13 Stage 3 "no active worktree contends" claim understates the blast radius

**Location:** §13 (line 216), §14 (line 227)

Stage 3 says it "churns `features/market-research` + `components/market-research/`, which are Phase 5 territory (merged); no in-flight worktree touches them, so collision risk there is low." However, the drain repoints imports in files like `IntelligenceTab.tsx`, `MarketIntelligenceSections.tsx`, and potentially `MarketResearchPage.tsx` (for `ScoutSettingsForm`, `LeadStreamTab`). These are active feature surfaces, not frozen Phase 5 artifacts. The claim isn't wrong (no *other worktree* touches them), but it could mislead a plan-author into thinking the changes are low-risk within the current worktree.

### [Medium] `EditDropdownMenu.tsx` consumers span features/customers — neither drain nor TD entry accounts for this

**Location:** §9 (missing), §10 (line 186 "No new `feature → feature` import")

`EditDropdownMenu.tsx` (44 LOC, generic edit dropdown) is imported by `features/customers/components/icp-intelligence/SuggestedICPCard.tsx` and `CurrentIcpsTable.tsx`. The spec's HANDOFF annotations in the file itself say "→ customers (Spec 24 §7)", but the spec doesn't mention this file or its customers consumers at all. If the drain empties `components/market-research/`, this file must go somewhere — and if it goes to `features/market-research/`, the existing `customers → components/market-research` import becomes `customers → features/market-research`, which is a `feature → feature` import. Moving it to `features/customers/` would be more correct but is also a cross-feature source. The right home is probably `shared/`.

### [Low] `TMeta` generic is Scout-only; Profiler always passes `unknown`

**Location:** §4 `ChatSession<TMeta>` and `ChatWithHistoryProps<TMeta>` (lines 104–127)

The generic `TMeta` parameter exists solely for Scout's `leadContext` payload. Profiler always uses `unknown`. This isn't a problem — the design is sound and forward-compatible — but the spec doesn't explicitly call out that the generic is Scout-motivated, which could confuse a plan-author who sees two `unknown`-parameterized callsites and wonders if the generic is premature.

### [Low] §3 target structure parenthetical for `ChatWithScout.tsx` is ambiguous

**Location:** §3 line 74: `components/ChatWithScout.tsx (or trends/)`

The parenthetical `(or trends/)` doesn't commit to a destination subfolder. Given that `ChatWithScout.tsx`'s only consumer is `features/market-research/components/trends/TrendsTab.tsx`, moving it to `components/trends/` seems more correct than `components/` root. The plan should make this explicit; the spec should either commit or state it as a plan-time decision.

### [Low] ScoutDeploymentDetails HANDOFF annotation is stale

**Location:** §7 (line 154)

The spec correctly notes that the `// HANDOFF → scout (Spec 24 §7)` annotation in `ScoutDeploymentDetails.tsx` is superseded by the Approach-1 decision, and the file instead relocates to `features/market-research`. The spec should specify whether the file's comment is updated during relocation to reflect the corrected destination, or left as-is.

### [Nit] §3 `shared/chat/README.md ← updated` notation

**Location:** §3 line 60

The target structure lists `index.ts  README.md  ← updated`. The README already exists and is already correct for the current `SignalsContextChat` export. The "updated" note is fine — just clarifying that this is a content edit, not a new file.

### [Nit] §14 parallel-worktree coordination is temporally unstable

**Location:** §14 (lines 223–231)

The statement "both currently at spec/plan stage with ~no code committed" is a point-in-time observation that will be stale by the time Phase 9 implementation starts. This is procedural context, not a design concern — it belongs in the plan, not the spec. Not blocking, since the spec header already says "design intent (frozen record)."

### [Nit] LOC counts for wrapper shrinkage are estimates

**Location:** §3 lines 69, 79; §6 lines 139, 140

The spec estimates Scout wrapper shrinks to "~100-150 LOC" and Profiler to "~20-40 LOC". These are reasonable estimates, but they're inherently speculative until the shell is built. No action needed — the estimates serve their purpose of communicating the intended thinness.
