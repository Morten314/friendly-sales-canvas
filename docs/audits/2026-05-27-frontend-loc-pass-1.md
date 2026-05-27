# Phase 1 — Frontend LOC Reduction (Pass #1) — Final Scorecard

**Date:** 2026-05-27
**Spec:** specs/16-frontend-phase-1-loc-reduction-design.md
**Plan:** plans/16-frontend-phase-1-loc-reduction.md
**Branch:** phase-1-loc-reduction
**Merge commit:** `<SHA — filled at merge>`

---

## 1. LOC delta

### Overall

| | Phase 0b end (spec baseline) | Phase 1 execution-start | Phase 1 end | Delta vs start |
|---|---:|---:|---:|---:|
| Files (.ts/.tsx under src/) | 158 | 167 | 156 | −11 |
| LOC (under src/) | 76,052 | 76,820 | 67,469 | −9,351 |

**Delta vs spec baseline:** +9 files / +768 LOC drift between spec-write (2026-05-27) and execution-start (same day, but after Phase 0b test landings). The drift is small and acceptable per the plan's Task 0b Step 2 tolerance.

**Net LOC reduction:** −9,351 LOC vs execution-start baseline (−12.2%). This substantially exceeds the Spec 16 §4.1 target of ≥5% reduction.

### Per-area

| Area | Files (after) | LOC (after) | LOC delta (Phase 1) |
|---|---:|---:|---:|
| src/ (root) | 3 | 184 | — |
| components/ (loose) | 4 | 529 | — |
| components/common/ | 1 | 120 | −192 (RateLimitStatus.tsx removed) |
| components/customers/ | 3 | 2,765 | −8,114 (ICPSummaryOpportunity + SuggestedICPsGallery + ProfilerChatPanel removed) |
| components/layout/ | 4 | 1,517 | — |
| components/market-research/ | 33 | 19,433 | −166 (marketData.ts removed) |
| components/mission-control/ | 2 | 7,018 | — |
| components/settings/ | 4 | 1,340 | — |
| components/signals/ | 3 | 1,165 | — |
| components/strategist/ | 2 | 432 | — |
| components/ui/ | 51 | 4,943 | — |
| contexts/ | 3 | 503 | — |
| hooks/ | 4 | 291 | −113 (useAuthenticatedApi.ts removed) |
| lib/ | 15 | 1,812 | −786 (authenticatedApi + enhancedApi + testFirebase removed) |
| pages/ | 14 | 24,443 | — |
| services/ | 1 | 149 | — |
| test/ | 4 | 120 | — |
| utils/ | 5 | 861 | −85 (pwaDiagnostics.ts removed) |

Note: "before" column omitted because Phase 0a baseline's Tier 1 table doesn't directly map to the per-area aggregation produced here. The delta-vs-start above (overall) captures the net change; per-area LOC delta reflects dead-file removals attributed to each area (from commit body line counts); areas with no dead-file removal show "—".

---

## 2. Per-category execution log

### Deps (Spec 16 §3 Step 2 item 5)

- **Removed:** 24 packages (20 from `dependencies`, 4 from `devDependencies`) — commit dd8b060
  - dependencies: @hookform/resolvers, @radix-ui/react-aspect-ratio, @radix-ui/react-context-menu, @radix-ui/react-hover-card, @radix-ui/react-menubar, @radix-ui/react-navigation-menu, @radix-ui/react-radio-group, @radix-ui/react-slider, @radix-ui/react-switch, @radix-ui/react-toggle, @radix-ui/react-toggle-group, @types/jsonwebtoken, date-fns, embla-carousel-react, input-otp, jsonwebtoken, react-day-picker, react-hook-form, react-resizable-panels, zod
  - devDependencies: @tailwindcss/typography, @testing-library/react, @testing-library/user-event, tsx (tsx later restored in Task 6.1)
  - (devDeps count expanded from Spec 16 §1.3 baseline of 1 to 4 after Task 1's Vitest entry expansion exposed @tailwindcss/typography, @testing-library/react, and @testing-library/user-event as no longer transitively required.)
- **Kept (false positive):** none — all 24 verified clean on vite build
- **Deferred:** none
- **Lockfile impact:** 51 transitive packages removed, 1,286 lockfile lines deleted

### Lovable artifacts (Step 2 items 1–2)

- `lovable-tagger` removed from vite.config.ts + package.json, README rewritten — commit ae23caa
- `src/pages/_restore_test.txt` deleted — commit db4f49c

### Unresolved imports (Step 2 items 3–4)

- `./pages/AgentHub` removed from src/App.tsx:21 — commit f5b69fd (no JSX usage; `/agent-hub` route already correctly renders Signals fallback)
- `@/components/market-research/MarketRankings` removed from src/pages/MarketResearch.tsx:58 — commit cf96e8d (no JSX usage; stale comment at line 8545 left in place as harmless)

### Empty vestige (Step 2 item 6)

- `src/components/market-research/LeadStream.tsx` (0 LOC) deleted — commit 3942956

### Duplicate default export (Step 2 item 7)

- `export default SuggestedICPCards` (line 2280) removed from src/components/customers/SuggestedICPCards.tsx — commit ce48530. Named export `export const SuggestedICPCards` (line 915) retained.

### Dead files (Step 4)

- **Originally flagged (Step 1 re-baseline 2026-05-27):** 32
- **Mid-phase re-baseline (Step 3):** 31 (LeadStream empty vestige removed in Step 2)
- **Removed:** 10 source files (commits 010c131..c877b32)
  - src/components/customers/ICPSummaryOpportunity.tsx — commit 010c131
  - src/components/customers/SuggestedICPsGallery.tsx — commit 5a91848
  - src/components/market-research/data/marketData.ts — commit dd7792e
  - src/hooks/useAuthenticatedApi.ts — commit 430151d
  - src/lib/testFirebase.ts — commit ec9ae5d
  - src/utils/pwaDiagnostics.ts — commit e21fd74
  - src/components/common/RateLimitStatus.tsx — commit 8139f14
  - src/components/customers/ProfilerChatPanel.tsx — commit efc2d19
  - src/lib/authenticatedApi.ts — commit c36cd2e
  - src/lib/enhancedApi.ts — commit c877b32
- **Kept:** 21 (all src/components/ui/* shadcn primitives — Phase 4 locked per Spec 16 §2.2; plus src/hooks/use-toast.ts export `toast` re-exported via src/components/ui/use-toast.ts)
- **Deferred to TD-FE:** 0 source files (no conservative-path defers needed; all clean removes)
- **Orphan routes detected and resolved:**
  - Removed: 1 (/your-lead-stream — legacy Navigate redirect) — commit d2fc232
  - Deferred: 2 (TD-FE-1: /tenant-selection; TD-FE-2: /scout-deployment) — commits b6e9ca5
  - Not real orphans: 2 (`/your-ai-team/scout/:tab`, `/your-ai-team/strategist/:tab` — parameterized sub-routes of Sidebar-linked parents)

### Dead exports and dead exported types (Step 5)

- **Originally flagged (Step 1 re-baseline):** 57 exports + 15 types
- **Mid-phase re-baseline (Step 3):** 56 exports + 15 types (post-Step-2)
- **Removed:** 17 symbols across 7 files (commits 484100d..6772b4f)
  - e2e/fixtures/api-mocks.ts — commit 484100d
  - e2e/fixtures/identities.ts — commit 0893701
  - e2e/fixtures/seed-data.ts — commit 390ad68
  - src/components/market-research/lead-stream/leadData.ts — commit 60eb53a
  - src/components/signals/ProfilerChatWithHistory.tsx — commit f47b204
  - src/components/signals/ScoutChatWithHistory.tsx — commit 2e086f7
  - src/components/market-research/AddLeadModal.tsx — commit 6772b4f
- **Kept:** 1 (toast in src/hooks/use-toast.ts — re-exported via src/components/ui/use-toast.ts)
- **Deferred to TD-FE:** 5 batched entries (TD-FE-3..7) covering ~22 symbols across ~22 files — commit d302d1e
  - TD-FE-3: 4 lib/ files (firebase.ts, api.ts, leadStreamHeatmapSession.ts, missionProfilerSessionCache.ts) — conservative posture
  - TD-FE-4: use-toast.ts reducer — conservative posture
  - TD-FE-5: apiUtils.ts 5 symbols — conservative posture
  - TD-FE-6: profilerAcceptedIcpDisplay.ts 3 symbols — conservative posture
  - TD-FE-7: 14 src/components/ui/ shadcn primitives (Phase 4 locked)

### Byte-identical inline-block extractions (Step 6)

- **Step 6a groups found (≥3 occurrences, self-contained):** 0
- **Step 6b extractions committed:** 0 (no-op per Spec 16 §3 Step 6 / §7 R3)
- **Phase 13 handoff (near-identical, outer-scope-referencing patterns logged):** not enumerated — scan-inline-blocks.ts filters outer-scope-referencing blocks at the gate per Spec 16 §3 Step 6a definition (line 174 of the script). Future Phase 13 enumeration requires a separate scan variant.

---

## 3. Per-file verdict for every originally-flagged dead file

Covers all 32 dead files from the Step 1 re-baseline plus orphan routes.
Verdict values: `remove <SHA>` | `keep — <reason>` | `defer-TD-FE-<n>`

| Path | Verdict | Evidence |
|---|---|---|
| src/components/common/RateLimitStatus.tsx | remove 8139f14 | Dead file — 0 inbound imports; no JSX usage anywhere |
| src/components/customers/ICPSummaryOpportunity.tsx | remove 010c131 | Dead file — 0 inbound imports; no JSX usage anywhere |
| src/components/customers/ProfilerChatPanel.tsx | remove efc2d19 | Dead file — 0 inbound imports; no JSX usage anywhere |
| src/components/customers/SuggestedICPsGallery.tsx | remove 5a91848 | Dead file — 0 inbound imports; no JSX usage anywhere |
| src/components/market-research/LeadStream.tsx | remove 3942956 | Step 2.6 — empty vestige (0 LOC); deleted before Step 4 dead-file sweep |
| src/components/market-research/data/marketData.ts | remove dd7792e | Dead file — 0 inbound imports |
| src/components/ui/aspect-ratio.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/breadcrumb.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/calendar.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/carousel.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/chart.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/context-menu.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/form.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/hover-card.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/input-otp.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/menubar.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/navigation-menu.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/pagination.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/radio-group.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/resizable.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/sidebar.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/skeleton.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/slider.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/switch.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/toggle-group.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/toggle.tsx | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; flagged as TD-FE-7 |
| src/components/ui/use-toast.ts | keep — shadcn primitive (Phase 4 locked) | Spec 16 §2.2 Phase 4 lock; `toast` export re-exported downstream; flagged as TD-FE-7 |
| src/hooks/useAuthenticatedApi.ts | remove 430151d | Dead file — 0 inbound imports |
| src/lib/authenticatedApi.ts | remove c36cd2e | Dead file — 0 inbound imports |
| src/lib/enhancedApi.ts | remove c877b32 | Dead file — 0 inbound imports |
| src/lib/testFirebase.ts | remove ec9ae5d | Dead file — 0 inbound imports |
| src/utils/pwaDiagnostics.ts | remove e21fd74 | Dead file — 0 inbound imports |

**Orphan routes (not files — listed for completeness):**

| Route | Verdict | Evidence |
|---|---|---|
| /your-lead-stream | remove d2fc232 | Legacy Navigate redirect — Step 2 clean-up; no Sidebar link |
| /tenant-selection | defer-TD-FE-1 | Auth/onboarding flow — possible intentional Sidebar absence; needs Brewra-dev confirmation |
| /scout-deployment | defer-TD-FE-2 | Live ScoutDeploymentPage — may be admin direct-URL; needs Brewra-dev confirmation |
| /your-ai-team/scout/:tab | keep — not orphan | Parameterized sub-route of Sidebar-linked /your-ai-team/scout parent |
| /your-ai-team/strategist/:tab | keep — not orphan | Parameterized sub-route of Sidebar-linked /your-ai-team/strategist parent |

---

## 4. Phase 13 handoff list

| Origin | Item | Why Phase 13 |
|---|---|---|
| TD-FE-1 | /tenant-selection orphan route | Auth/onboarding flow route — needs Brewra-dev confirmation of intentional Sidebar absence |
| TD-FE-2 | /scout-deployment orphan route | Live ScoutDeploymentPage — may be intentional admin direct-URL; needs Brewra-dev confirmation |
| TD-FE-3 | src/lib/* unused exports (firebase.ts, api.ts, leadStreamHeatmapSession.ts, missionProfilerSessionCache.ts) | Conservative posture in lib/ — strict TS context may relax |
| TD-FE-4 | src/hooks/use-toast.ts reducer | Conservative posture in hooks/ |
| TD-FE-5 | src/utils/apiUtils.ts (5 symbols) | Conservative posture in utils/ |
| TD-FE-6 | src/utils/profilerAcceptedIcpDisplay.ts (3 symbols) | Conservative posture in utils/ |
| TD-FE-7 | src/components/ui/* (14 shadcn primitives) | Phase 4 lock per Spec 16 §2.2 — pull-forward at Phase 4 shadcn consolidation |

---

## 5. Knip config delta

| Hint (before) | Resolution | After |
|---|---|---|
| `dev-dist/**`, `node_modules/**`, `dist/**` in `ignore` (redundant) | Removed from `ignore` (already in .gitignore) | 0 |
| `src/main.tsx`, `vite.config.ts`, `playwright.config.ts` in `entry` (redundant) | Removed from `entry` (knip auto-detects) | 0 |
| `scripts/**/*.{ts,sh}` matches nothing | Replaced with `scripts/*.ts` in `entry` | 0 |
| No lazy-loader entry pattern | Verified zero React.lazy() / lazy() — no pattern needed | 0 |
| Vitest test files not in `entry` | Added `src/**/__tests__/**/*.test.{ts,tsx}` and `src/**/*.{test,spec}.{ts,tsx}` to `entry` | 0 |
| Generic "Add entry and/or refine project files (N unused files)" | Resolves naturally as Steps 2–6 clear unused files | 0 (after Step 6 cleanup) |

**Before:** 8 configuration hints
**Mid-phase (post-Step 1 refinement):** 1 hint (the generic "N unused files" — expected, decays with dead-file removal)
**After Phase 1 end:** 0 configuration hints (plus any generic "N unused files" advisory from remaining shadcn defers, which is downstream of intentional TD-FE-7 deferral rather than a config gap)

**Note:** The generic "N unused files" hint is downstream of having dead files. As Steps 2–6 cleared 10 source files + 17 unused exports, this hint's count drops. Any remaining unused files (deferred to TD-FE-* per conservative posture, plus shadcn) will still trigger this hint until either resolved or knip --strict is configured to suppress them. The Step 7.2 `knip --strict` wire-in (Task 7.2) is the final merge gate.

---

## 6. shadcn-ui (src/components/ui/) unused-primitive count

Per Spec 16 §2.2 + §8 — directory locked from Phase 4 onward. Unused primitives flagged by knip stay in place; logged here for tracking.

**Count of src/components/ui/*.tsx files flagged unused by Step 3 re-baseline:** 14 files (deferred as TD-FE-7 via commit d302d1e)

Files:
- src/components/ui/aspect-ratio.tsx
- src/components/ui/breadcrumb.tsx
- src/components/ui/calendar.tsx
- src/components/ui/carousel.tsx
- src/components/ui/chart.tsx
- src/components/ui/context-menu.tsx
- src/components/ui/form.tsx
- src/components/ui/hover-card.tsx
- src/components/ui/input-otp.tsx
- src/components/ui/menubar.tsx
- src/components/ui/navigation-menu.tsx
- src/components/ui/pagination.tsx
- src/components/ui/radio-group.tsx
- src/components/ui/resizable.tsx

Note: sidebar.tsx, slider.tsx, skeleton.tsx, switch.tsx, toggle.tsx, toggle-group.tsx, and use-toast.ts appear in the knip-refined JSON but are treated as shadcn-locked; the "14 files" count matches those in the TD-FE-7 commit batch.

Pull-forward trigger: Phase 4 shadcn primitive consolidation.

---

## 7. Preflight chain (after Task 7.2 wire-in)

```
npm run preflight
= npm run typecheck
  → npm run build
  → npm run test:e2e
  → npm run test
  → npx knip --strict --no-progress     (added by Task 7.2)
```

frontend/scripts/preflight.sh unchanged — delegates via npm run preflight.

### Done-when checklist (Spec 16 §5)

1. ✅ Final scorecard committed (THIS FILE)
2. ✅ Every execute finding from Step 1 + Step 3 baselines applied or documented (10 removed, 21 shadcn kept, 7 TD-FE entries)
3. ⚠️ Knip config has zero fixable hints (8 resolved; 1 generic "N unused files" advisory remains, downstream of TD-FE-7 shadcn deferrals — not a config gap) — controller-accepted pragmatic interpretation: "0 hints" means 0 configuration hints, not 0 advisory notices
4. ⏳ Pending: `knip --strict --no-progress` appended to preflight (Task 7.2)
5. ✅ npm run preflight green end-to-end (verified post-Step 6.1; pending re-verify after Task 7.2)
6. ✅ All 32 originally-flagged dead-file flags have verdict (10 remove + 21 keep + 1 deleted via Step 2.6)
7. ✅ TD-FE entries written to docs/TECH_DEBT.md (TD-FE-1..7)
8. ⏳ Pending: Spec 14 §4 row update at merge (Task 7.3, controller-driven on master post-merge)

---

## 8. Process debt observed during Phase 1

**Tasks 4 + 5 preflight cadence:** Tasks 4 (dead-file removal) and 5 (dead-export removal) ran `npm run preflight` at end-of-loop rather than per-commit. HEAD preflight is green; per-commit greenness was not verified by re-running preflight at each intermediate commit. The topological removal ordering (dependency-graph-first) and per-commit ripgrep 6-check kit provide a structural correctness argument, but intermediate commits were not individually tested. Recommendation forwarded to Phase 13: enforce per-commit preflight or explicitly waive in spec with a documented justification (e.g., topological-ordering guarantees no new imports are introduced).

**tsx restore bundled with scan-inline-blocks.ts addition (Task 6.1):** The manifest restore for `tsx` (removed in Task 2.5, later needed by scan-inline-blocks.ts) landed inside commit 8792669 which also added the script. The commit body explicitly documents the restoration, but a cleaner audit trail would have had a separate restore commit. Forward to Phase 13/future LOC phases: when a manifest restore is needed mid-phase, commit the restore independently before the script addition.
