---
artifact: plans/37-tech-debt-paydown.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-15
round: 1
---

## Context

This is a 2,089-line, 25-entry tech-debt paydown plan authored against a verified
spec (`specs/37-tech-debt-paydown-design.md`, spec-review round 1 synthesized). The
plan carries a thorough "Discrepancy ledger" that re-checks every cited location
against HEAD, and a self-review section. Before grading, I spot-verified the plan's
empirical claims against the live tree:

- The five API surfaces the code snippets depend on all exist at the cited lines:
  `buildApiUrl` (`shared/api/transport.ts:21`), `setDataSources` +
  `checkProcessingFilesStatus` on `DocumentSyncApi` (`useDocumentSync.ts:29,32`),
  `qk.signalLeadMap(orgId, userId)` (`queryKeys.ts:21`), `maskDynamic`
  (`e2e/helpers/mask-dynamic.ts`), and `retries: 0` (`playwright.config.ts:30`).
- The Task 3 claim that the `regulatory-compliance_*_json` writes "have no reader
  anywhere" is **correct**: a full `src`-wide grep finds only the two unscoped
  writes (`:488,489`) and the two scoped writes (`:549,554`) — zero
  `getItem`/`getUserLocalStorage` reads of those keys exist.

Accordingly, the findings below are structural/planning gaps, not factual/code-reality
errors. The plan is unusually disciplined for its size; severity reflects that
nothing here blocks execution, only areas worth tightening.

## Findings

### [Medium] No batch-level kill criterion — only per-item escapes

**Location:** "Abort / escalation triggers" (lines 51-58); "Acceptance criteria"
(lines 2068-2075).

The plan has strong per-item escape hatches (Wave-0 shape divergence → re-scope;
scope-rippling behavior change → split to a follow-on spec; TD-005 real caller →
fall back to passthrough; red base → don't stack tasks) and the acceptable
"escalate to the human (don't push through)" recovery pattern. What it lacks is any
condition under which the **entire 25-item phase** is abandoned versus trimmed. With
25 items on one long-lived branch, a plausible failure mode is N items cascading out
of scope; the plan should state a threshold (e.g., "if ≥3 items ripple beyond scope,
stop and re-plan rather than continue trimming"), or explicitly delegate the
batch-abort decision to the human at first escalation. As written, the only signal
that the whole effort should stop is implicit in repeated human escalation.

### [Low] Cross-wave edits to the same file invalidate later tasks' line-number citations

**Location:** File Structure (lines 62-103); Task 3 (lines 224-283), Task 6
(lines 363-493), Task 19 (lines 1698-1735).

`RegulatoryComplianceSection.tsx` is edited by Task 3 (deletes ~3 lines at 487-489)
and Task 6 (replaces ~60 lines of inlined default arrays with module imports) in
Wave 1, then again by Task 19 in Wave 6, which cites "line 585" (`profileUrl`) and
"line 15" (the `BACKEND_BASE_URL` import). After Wave 1 the file has shrunk
substantially, so Task 19's line 585 is badly stale (line 15 survives since it
precedes the edits). The same applies to `pagination.ts`, touched by both Task 17
(schema widening) and Task 18 (adds `pageParams`). This is mitigated — every task
also gives code-pattern anchors and the conventions repeatedly say to `rg`/grep
rather than trust line numbers — but an executor (especially a subagent) keying on
line numbers will misfire on the later tasks. A one-line note that Wave-1 line
numbers in Wave-6 tasks are pre-edit and must be re-grepped would close this.

### [Low] TD-FE-72 ships a dormant control with no prod error/loading UX

**Location:** Task 16 Step 5 (lines 1501-1509); dormancy caveats in the Discrepancy
ledger (line 114) and spec §8.

The "Recompute lead mapping" button calls `/signal-lead-map_claude`, confirmed
**not deployed** (2026-06-15). The MSW test (Step 1) verifies `refresh:true` is
sent, but the plan adds no `disabled`/loading/error state for the prod-dormant case,
so a real click fails silently (or surfaces an unhandled error). This is spec-accepted
("dormant in prod until the endpoint deploys") and harmless at 0 users, but the plan
chooses to ship a live, clickable dead control rather than gating it; a note that no
graceful degradation is added (and why that's acceptable) would make the choice
explicit.

### [Low] Task 12 bundles two register entries (TD-FE-61 + TD-FE-50) into one commit

**Location:** Task 12 heading (line 826); single commit (lines 922-928).

TD-FE-61 (rename `SignalsChatContext`→`ChatContext`) and TD-FE-50 (type the
sessionStorage handoff) ship as one atomic commit across ~10 files. The
justification — "a rename must keep typecheck green," and the handoff centralization
is in the same files — is sound and splitting would risk a red intermediate. But it
does merge two distinct register entries' concerns into a single reviewable unit,
which is the tradeoff the "decomposition for reviewability" axis asks about. Worth
acknowledging as a deliberate tradeoff rather than incidental.

### [Low] Branch-dependent test authoring makes the "verify it fails" gate non-deterministic

**Location:** Task 17 Step 1 (lines 1527-1536, esp. "If `fetchDataSources` is changed
to an object in Step 3, assert `.total` instead"); Task 5 Step 2 (lines 332-335,
"If it already passes, proceed").

A few tasks defer the exact test assertion to an execution-time decision (which
return shape was chosen; whether the guard already exists). The TDD loop's "Run to
verify it fails" step is therefore not always a clean binary gate — the expected
failure depends on a branch the executor picks later. Not wrong, but it weakens the
"red→green" discipline those steps are meant to enforce; pinning the decision
upstream of the test (or writing the assertion against the chosen branch
unconditionally) would make the gate deterministic.

### [Nit] Broken identifier embedded in a Task 8 code block

**Location:** Task 8 Step 6 (lines 626-632): `const dataSources Ref = useRef<...>`
with a space, immediately flagged "(Write `dataSourcesRef` as one identifier — no
space.)".

Even when self-flagged, embedding syntactically-invalid code an executor may
copy-paste is fragile; ship the correct identifier and drop the parenthetical.

### [Nit] Deliberately-unused import in a Task 13 test

**Location:** Task 13 Step 1 (lines 944, 973): `import { renderHook } ...` noted as
"included only to mark this as an MSW test," then "Drop the unused `renderHook`
import line."

Including a line only to instruct its deletion is confusing and risks a lint failure
if the executor misses the instruction. Provide the clean (lint-passing) version
directly.

### [Nit] Commit-SHA placeholders not explained as execution-time fills

**Location:** Task 24 Step 1 (line 2001): `**Resolved (Phase 37, <DATE>):** ...
Commit <sha>.`

The archive "resolved" lines reference the resolving commit SHA, which does not
exist at authoring time. A one-line note that `<sha>`/`<DATE>` are filled from the
actual per-entry commits at execution would prevent an executor from stalling on the
placeholder.

### [Low/Nit] Inconsistent dead-code triage for the `_json` localStorage writes

**Location:** Task 3 Step 2 (lines 265-266) vs. `RegulatoryComplianceSection.tsx`
lines 547-557.

Task 3 deletes the unscoped `regulatory-compliance_original_json` /
`_modified_json` writes (`:488-489`) as "truly dead (no reader anywhere)." Verified
correct — but the scoped writes of the *same* keys (`:548-557`, via
`setUserLocalStorage`) are equally readerless (no `getItem` of these keys anywhere in
`src`) and are left in place. Either both pairs are dead (delete both) or the task
should state why only the unscoped pair is removed. Behavior-preserving either way,
so this is a triage-consistency nit rather than a risk.

### [Nit] Backend wave's independence from the frontend waves is unnoted

**Location:** Wave 2 (lines 677-820) vs. Wave 1 (lines 118-674).

Wave 2 (backend) shares zero files with Wave 1 (frontend) and could be
developed/verified fully independently — useful under the worktree/subagent model.
Under the single-branch commit model this is moot for ordering, but noting the
independence would help an executor parallelize verification (or sequence backend
work without blocking on FE state).
