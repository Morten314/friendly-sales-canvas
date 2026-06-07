---
artifact: master (495b800..86c2c8d)
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-07
round: 2
base_ref: 495b80064edb1c833b0728950aee4f4c4bbaccd8
spec_loaded: true
plan_loaded: true
---

## Context

Round 1 (`docs/reviews/phase-13-loc-reduction-pass-2-impl-review-1.md`) covered the **13a** sub-phase (tree-wide dedup + dead-code pass). This round covers the **13b** (DataSourcesManager decomposition), **13c** (ConnectorApprovals decomposition), and **Stage Z** (phase close) commits that followed: `2956510..86c2c8d` (20 commits). The 13a findings from round 1 (momentary-red commit, prop-heavy IntelligenceSectionHeader, un-memoized configs, duplicated test fixtures) are not re-reviewed here — they are either resolved or remain at their recorded severities.

## Findings

### [Medium] checkProcessingFilesStatus abuses setDataSources as a state reader, fires uncontrolled async side effects inside a state updater

**Location:** `frontend/src/features/mission-control/components/data-sources/useDocumentSync.ts:84–106`

`checkProcessingFilesStatus` wraps its entire body in `setDataSources((currentSources) => { … })` to read current state, then fires `void (async () => { … })` per processing file inside the callback, and returns `currentSources` unchanged. This pattern:

1. Triggers an unnecessary re-render (the updater returns the same reference, but React still schedules it).
2. Uses the state setter as a state reader — the idiomatic pattern is `useRef` + a regular read, or reading from the TanStack query cache.
3. The `forEach` + `void async` fires N concurrent `checkDocumentStatus` calls with no concurrency control — if a file is re-checked before a prior check resolves, two status updates race on `setDataSources`.

This is pre-existing code relocated verbatim (behavior-preserving, per Spec 32 §5.2). The decomposition was an opportunity to clean it up, but the spec constrains changes to structural-only. Flagging because the hook boundary is the natural place to fix this — the next agent touching `useDocumentSync` should address it.

### [Low] useCredentialAuthModal accepts `platformName` but never uses it

**Location:** `frontend/src/features/mission-control/components/company-profile/useCredentialAuthModal.ts:61`

The parameter is destructured as `platformName: _platformName` and never referenced. The interface declares it as required (`platformName: string`), and callers (ConnectorApprovals) pass it. The hook's error toast says "Missing credentials" generically — including the platform name would improve UX. Either the hook should use the parameter or the interface should drop it (with callers updated). The underscore prefix signals intent, but a required-but-unused parameter in a public interface is a maintenance trap.

### [Low] _isSaving state written but never read by the owning hook

**Location:** `frontend/src/features/mission-control/components/data-sources/useDocumentSync.ts:48`

`const [_isSaving, setIsSaving] = useState(false)` — the value is never read inside `useDocumentSync`. `setIsSaving` is returned via the `DocumentSyncApi` interface so the parent (DataSourcesManager) can set it, but the parent also never reads it through this API. If the parent needs isSaving state, the parent should own it directly rather than paying for a forwarded setState dispatch. Pre-existing pattern relocated verbatim.

### [Nit] Pre-existing console.log density carried into extracted modules

**Location:** `useDocumentSync.ts` (18 calls), `dataSourceHelpers.ts` (8 calls), `csvHelpers.ts` (5 calls)

The behavior-preserving mandate correctly kept these verbatim. Flagging because 31 console.log/warn/error calls across three extracted modules is high density, and the decomposition was a natural cleanup point (the spec allows removing dead code but not changing behavior — these are debug logging, not behavior). A future logging-audit pass could thin these.

### [Nit] Nested convertToUtf8 function inside uploadCsvBatch

**Location:** `frontend/src/features/mission-control/components/data-sources/useLeadStream.ts:254–303`

A ~50-line `convertToUtf8` closure is defined inside `uploadCsvBatch` every time the function runs. It captures no mutable state from the outer scope (reads `file` from its own parameter), so it could be a module-level pure function. Pre-existing, relocated verbatim. No runtime impact (the function is only created when uploadCsvBatch is called), but extracting it would improve readability and testability.
