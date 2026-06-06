---
artifact: phase-11-shared-utility-extraction
artifact_type: impl
verdict: clean
reviewer_model: glm-5.1
date: 2026-06-06
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

No procedural caveats. Spec 31 and plan 31 were both loaded; adherence checking is fully applied.

## Findings

### [Nit] `use-toast.ts` carries a pre-existing stale `useEffect` dependency

**Location:** `frontend/src/components/ui/use-toast.ts:169-177`

The `useToast` hook's `useEffect` has `state` in its dependency array (`}, [state]);`). This causes the effect to re-register its listener on every state change (subscribe → unsubscribe → re-subscribe), rather than once on mount. This is a pre-existing shadcn boilerplate issue carried forward verbatim — the spec mandates byte-for-byte relocation, so fixing it would be out of scope. Noted for awareness only; no action required.

### [Nit] `_actionTypes` is declared but its value is only used as a type

**Location:** `frontend/src/components/ui/use-toast.ts:19-24`

The `_actionTypes` object is used only via `typeof _actionTypes` (line 29) to derive the `ActionType` type. The runtime value is never read. This is shadcn boilerplate carried forward verbatim; not introduced by this phase. Noted for completeness.

### [Nit] `EditDropdownMenu.tsx` retains stale HANDOFF comment

**Location:** `frontend/src/features/customers/components/icp-intelligence/EditDropdownMenu.tsx:1-2`

The file carries a "HANDOFF → customers" comment from its original location in `components/market-research/`, but the file now *lives in* `features/customers/`. The comment is stale — it has already been handed off. Minor; the comment dates from the original authorship and is arguably a historical artifact, but a reader encountering it today would be confused about whether the file is temporary.

### [Nit] `leadData.ts` retains stale HANDOFF comment

**Location:** `frontend/src/shared/lib/leadData.ts:1-2`

Similarly, the "HANDOFF → customers (Spec 24 §7)" comment says "This module is NOT part of market-research; it stays here until the customers feature phase relocates + decomposes it." The module is now at `shared/lib/leadData.ts` (promoted because ≥2 features consume it). The comment's placement directive is stale — the file is correctly placed in `shared/` per the ≥2-feature rule. Should say "Promoted to shared/lib because ≥2 features consume it (strategist + market-research)."

### [Nit] `OpportunityDashboard.tsx` retains stale HANDOFF comment

**Location:** `frontend/src/features/market-research/components/lead-stream/OpportunityDashboard.tsx:1-2`

Same pattern — says "NOT part of market-research" but the file now lives in `features/market-research/`. The comment is confusing in the new location.
