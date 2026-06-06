---
artifact: specs/31-frontend-phase-11-shared-utility-extraction-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 2
---

## Findings

### High

#### H1: `lib/rateLimitManager.ts` disposition is fundamentally wrong — it is already a re-export shim, not a relocatable file

**Location:** §1.3 table row `lib/rateLimitManager.ts`; §4 class E; §5.3

The spec says: "consumed by `shared/api/rateLimiter.ts`" and "→ `shared/api/` (pure move — §5.3)". Both claims are incorrect. `lib/rateLimitManager.ts` is an 11-line re-export shim that imports **from** `@/shared/api/rateLimiter` and re-exports `RateLimitManager`, `RATE_LIMIT_RPM`, `executeWithRateLimit`, and `rateLimiter` (aliased as `rateLimitManager`). The dependency direction is `rateLimitManager → rateLimiter`, not the reverse. Moving this shim into `shared/api/` would create `shared/api/rateLimitManager.ts` re-exporting from `./rateLimiter` — a pointless same-directory re-export.

The correct disposition is **delete** the shim and update `lib/__tests__/rateLimitManager.test.ts` (which asserts the identity `rateLimitManager === rateLimiter`). The test itself validates the shim's contract and can be deleted alongside it, since after the shim is gone there is nothing left to test — the canonical `rateLimiter` instance already has its own coverage in `shared/api/__tests__/client.test.ts`.

### Medium

#### M1: §6 `leadData.ts` consumer list falsely includes "customers" — no customers file imports leadData

**Location:** §6 disposition table — `lead-stream/leadData.ts` row: "strategist + src/lib + customers (per TD-FE-63)"

Live grep for `from "@/components/market-research/lead-stream/leadData"` (and equivalent relative paths) shows consumers in:
- `features/strategist/` (2 sites: `StrategistRecommendations.tsx`, `StrategistLeadStream.tsx`)
- `lib/marketScoresHeatmap.ts` (imports types + `getPriority` from leadData)
- `lib/leadStreamHeatmapSession.ts` (imports type `HeatmapLead`)
- `components/market-research/ScoutLeadStream.tsx` (residue internal)
- `components/market-research/lead-stream/LeadsTable.tsx` (residue internal)

No `features/customers/` file imports `leadData`. The "(per TD-FE-63)" reference likely conflates `EditDropdownMenu` (which IS consumed by customers) with `leadData`. The disposition (`→ shared/`) is still correct (strategist + market-research ≥ 2 after relocation), but the consumer trace is wrong and will mislead the plan's import-repointing checklist.

#### M2: §5.1 `use-toast` consumer list is incomplete — omits `ContextChat` and `LeadsTable`

**Location:** §5.1 — "the 5 feature consumers (auth, customers, market-research, mission-control, signals) repoint `@/hooks/use-toast` → `@/components/ui/use-toast`"

Live grep shows 31 `@/hooks/use-toast` import sites. Beyond the 5 features listed, two non-feature consumers also import `useToast` and need repointing:
- `shared/chat/ContextChat.tsx:18`
- `components/market-research/lead-stream/LeadsTable.tsx:48`

The §1.3 table row also omits both: it says "5 features + `components/ui/{toaster,use-toast}`" without mentioning ContextChat or LeadsTable. The plan's repointing checklist must include these.

#### M3: `cn` ui-file count is 30, not 31

**Location:** §5.1 — "31 `ui/` files"; §1.3 table — "31 `ui/` files + 3 non-ui"

Live grep for `from "@/lib/utils"` inside `components/ui/` returns exactly 30 files (accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, card, chart, checkbox, command, dialog, drawer, dropdown-menu, input, label, pagination, popover, progress, scroll-area, select, separator, sheet, sidebar, skeleton, table, tabs, textarea, toast, tooltip). The "31" appears in both §1.3 and §5.1 and should be corrected to 30 so the plan's repointing count is accurate.

#### M4: `lib/__tests__/utils.test.ts` tests both `cn` and `sanitizeAnswerText` — split destination not addressed

**Location:** §4 class A — "Co-located tests move alongside"; §2.1 item 7 — "Relocate co-located `__tests__/` with their subjects"

`lib/__tests__/utils.test.ts:6` imports both `{ cn, sanitizeAnswerText }` from `@/lib/utils`. After the split, `cn` goes to `components/ui/utils.ts` and `sanitizeAnswerText` goes to `shared/lib/`. The test file cannot follow one subject without losing the other. The spec should explicitly state whether this test file is split into two, duplicated at both destinations, or kept whole at one location with a cross-import.

### Low

#### L1: §7 styles move does not acknowledge the import-style change in `main.tsx`

**Location:** §7 — "`import "./index.css"` → `import "@/shared/styles/index.css"`"

`main.tsx:5` currently uses a relative import (`"./index.css"`). The spec's proposed replacement uses a path alias (`"@/shared/styles/index.css"`). The change in import convention (relative → alias) is fine but not called out. A minor inconsistency: the `scrollbar-hide.css` import on line 6 also changes from relative to alias. If there's a project convention about when to use relative vs alias imports, this should be noted so the plan follows it consistently.

#### L2: §6 does not enumerate `leadData.ts`'s downstream `lib/` consumers

**Location:** §6 — "the 3 zero-consumer score libs feed only `lead-stream/LeadsTable.tsx`"

This is true for the data-flow direction (score libs → LeadsTable consumes them). But `marketScoresHeatmap.ts:1-2` and `leadStreamHeatmapSession.ts:1` both **import from** `leadData.ts`. If `leadData` moves to `shared/` (as the spec proposes), these score libs' imports need updating — but they're also relocating (to market-research with LeadsTable). The spec should note this bidirectional dependency so the plan handles the import update correctly during 11d.

#### L3: `lib/__tests__/rateLimitManager.test.ts` disposition not addressed for the shim-deletion case

**Location:** §2.1 item 7 — "Relocate co-located `__tests__/` with their subjects"; §1.3 (rateLimitManager row)

The spec's general rule is "co-located tests move alongside." But if the correct disposition for `rateLimitManager.ts` is deletion (per H1), then `lib/__tests__/rateLimitManager.test.ts` should also be deleted rather than relocated. The spec does not address this.

#### L4: §3 target-structure tree diagram omits `use-toast.ts` and `use-mobile.tsx` from `components/ui/`

**Location:** §3 — target structure tree

The tree shows `components/ui/utils.ts` (for `cn`) but not `components/ui/use-toast.ts` or `components/ui/use-mobile.tsx`, which are the other two co-located utilities from §5.1. The diagram should list all three for completeness.

### Nit

#### N1: §1.3 `use-toast` row mixes consumer categories

**Location:** §1.3 table — `hooks/use-toast.ts` → "5 features + **`components/ui/{toaster,use-toast}`**"

The row format uses bold for ui-layer consumers but doesn't mention shared (`ContextChat`) or residue (`LeadsTable`) consumers. A consistent format would list all categories: feature consumers, shared consumers, residue consumers, ui-layer consumers. (The §1.3 preamble says "counts are from an import grep at spec-write time" and "the plan re-runs a full trace" — but the trace should start from complete data.)

#### N2: §6 residue table uses parenthetical TD reference that may be stale

**Location:** §6 table — `leadData.ts` row: "(per TD-FE-63)"

TD-FE-63 tracks the `components/market-research/` residue drain, but the specific "customers" attribution for `leadData` is incorrect (see M1). The TD reference should not be used to justify a consumer that live grep disproves.

#### N3: §5.3 says `rateLimitManager` "becomes a relative import" — direction unclear

**Location:** §5.3 — "`rateLimitManager.ts` → `shared/api/` (consumed by `shared/api/rateLimiter.ts`; becomes a relative import)"

Even if the disposition were correct (it isn't — see H1), the phrase "becomes a relative import" is ambiguous: relative from whose perspective? If `rateLimitManager` moved to `shared/api/`, it would already be co-located with `rateLimiter.ts` and the import would indeed be relative — but the existing shim already uses `@/shared/api/rateLimiter`, so the "becomes" framing suggests a change that isn't needed.
