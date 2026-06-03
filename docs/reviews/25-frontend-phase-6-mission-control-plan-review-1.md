---
artifact: plans/25-frontend-phase-6-mission-control.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-03
round: 1
---

## Findings

### [High] No kill criteria or abort conditions

**Location:** Plan-wide (no section anywhere). The spec §11 identifies four risks (R1–R4) but neither the spec nor the plan states under what circumstances the entire phase gets abandoned versus continued. Task 25 Step 3 says "fix on the branch … do not merge red" but that is a retry instruction, not an abort condition.

A plan this large (~11.6 k LOC of change, 25 tasks, 6 stages) needs explicit stop-the-line criteria. For example: if a stage gate cannot go green after N attempts, or if a live-shape confirmation (Task 9) reveals a backend contract that is fundamentally incompatible with the loose zod schemas, the executor needs guidance on when to escalate vs. abandon. Currently the only recourse is implicit ("try harder"), which can waste an entire session on an unfixable problem.

Suggested fix: add a short "Abort conditions" block to the conventions section, naming the failure modes that should halt execution and report to the operator (e.g., stage gate fails after two fix attempts; live-shape divergence that cannot be absorbed by `.passthrough()`; scaffold script missing or producing unexpected output).

### [High] Recovery strategy is stage-level only; mid-task failure path is silent

**Location:** Conventions & execution rules (lines 15–28), Stage gate blocks (e.g., line 317). The spec §7 states "A failed stage reverts to the last green stage (Spec 14 §5.7) without reverting the whole phase" but the plan never translates this into an actionable instruction. There is no `git revert` or `git reset` guidance, no "which commit corresponds to the last green stage" tracking, and no instruction to the executor on what to do when a task's verify step fails partway through.

The stage gates ("`npm run verify` green; journeys … green") are clear success criteria, but the plan says nothing about what happens when one is red. For a plan this long, the executor needs at minimum: (a) "report to the human and wait," or (b) "revert to the last stage-gate commit and report." Currently it is silence.

### [Medium] Task 9 requires live backend access but does not state it as a prerequisite

**Location:** Stage 3, Task 9 (lines 582–591). The task says "With the app running (or via `curl` through the proxy/devtools Network tab), capture the JSON" and references three GET endpoints with `<org>` and `<uid>` placeholders. This requires: (1) a running backend (or proxy), (2) valid credentials (the backend trusts `user_id`/`org_id` query params per CLAUDE.md, but the endpoints still need a real org/user that has data), and (3) those org/user IDs must return non-empty responses for the shapes to be worth confirming.

The plan's conventions §27 mention the polyglot confirm-live rule but do not flag Task 9 as needing advance setup. An executor starting cold may reach Task 9 and block because the backend is down or the test org has no data.

Suggested fix: add a prerequisite note to Task 9: "Requires the backend reachable and a test org with ≥1 uploaded document, ≥1 lead-stream file, and ≥1 ICP. If unavailable, record this as a blocking finding and continue to Task 10 with the schemas as-is (they are deliberately loose)."

### [Medium] Stages 5 and 6 are independent of each other but serialized without comment

**Location:** Stages 5–6 (lines 1213–1385). Stage 5 decomposes DataSourcesManager; Stage 6 decomposes ICPManager. Both depend on Stage 4 (the MissionControlPage shell) but neither depends on the other. The plan serializes them without acknowledging this — the "Execution stages" description (spec §7 and plan intro) does not mention that 5 and 6 could be parallelized if multiple executors were available.

This is not a defect for single-agent execution (the plan is designed for one agent on one branch), but it is a missed documentation opportunity: noting the independence would help if the phase were ever split across parallel agents or worktrees.

### [Medium] Tasks 15–17 (MissionControl decomposition) provide significantly less inline code than earlier tasks

**Location:** Stage 4, Tasks 15–17 (lines 1108–1207). Tasks 1–14 provide full inline code for every new file (routes, contracts, types, services, hooks, tests). Tasks 15–17 switch to prose instructions ("Move the profile-tab JSX (~1983–2230) and its supporting state/handlers into a default-export component") without providing the actual component code. This is the heaviest decomposition in the plan (MissionControl.tsx is 4,371 LOC, the company-profile form is ~250 lines of inline JSX, the connector-approval cluster is 16 handlers + dialog + modals).

The risk is that an executor will misidentify the boundary (the plan references line numbers from the pre-move file, which have shifted after the `git mv` + rename in Task 5). A more robust approach would be to specify the boundary by marker strings (e.g., "the `<TabsContent value="profile">` block ending at the closing `</TabsContent>` that precedes `<TabsContent value="customer-profile">`") rather than line ranges.

### [Medium] Task 16 (connector-approval cluster) lacks precise boundary specification

**Location:** Stage 4, Task 16 (lines 1153–1181). The task references "16 per-platform approve/deny handlers (`handleSalesforceApprove`…`handleMixpanelDeny`, MissionControl ~`:1055–1636`)" and "the connector catalog dialog (gated by `isConnectorDialogOpen`, rendered ~`:2248`)." These line numbers are from the original `MissionControl.tsx`, but by the time Task 16 executes, the file has been renamed to `MissionControlPage.tsx`, relocated, and partially hollowed by Task 15 (CompanyProfileForm extraction). The actual line numbers will have shifted unpredictably.

The task does not provide functional markers or function names as anchors for finding the code to extract. An executor must infer the boundary from the prose description and the already-mutated file, which is error-prone for a ~1,600-line extraction.

Suggested fix: reference the handlers by their function names (which are stable) rather than line numbers, and list the state variables the cluster owns (e.g., `isConnectorDialogOpen`, the per-platform modal state flags).

### [Medium] The `scaffold:feature` npm script is assumed to exist without verification

**Location:** Stage 2, Task 5 Step 1 (line 335). The step runs `npm run scaffold:feature -- mission-control` and expects specific output ("scaffolded src/features/mission-control/ (types.ts, index.ts, README.md)"). This script was presumably created in Phase 4 (scaffolding), but the plan does not verify its existence as a preflight check or include a fallback if it is missing. If the script was removed or renamed between phases, the task blocks.

This is a low-probability event (the script is in `package.json` per the Phase 4 convention) but the plan is otherwise meticulous about prerequisites, so the gap is notable.

### [Low] Tasks 2 and 3 (stage 1) are independent but serialized

**Location:** Stage 1, Tasks 2–3 (lines 180–251). Task 2 documents conventions in `src/features/README.md`. Task 3 converts market-research alias self-imports to relative paths. Neither depends on the other. The plan serializes them, which is fine for a single agent but worth noting as a minor parallelization opportunity.

### [Low] Hardcoded line numbers will drift as earlier tasks modify the same files

**Location:** Throughout. Task 1 references "App.tsx:22" and "App.tsx:124–141" (line 83). Task 6 references "App.tsx:11" and "App.tsx:52–59" (line 385). Task 15 references "~lines 1983–2230", "~lines 251–268", etc. (line 1115). After Task 1 modifies App.tsx, the line numbers cited in Task 6 are wrong. After Task 5 relocates MissionControl.tsx, the line numbers cited in Tasks 15–16 are from the pre-move file.

This is a known tradeoff of line-number references in long plans and the plan partially mitigates it by using contextual markers (e.g., "the deep page import at line 22" combined with the import text). But Tasks 15–16 rely more heavily on line numbers than on text markers, which increases the risk of misidentification.

### [Low] Task 8 Step 2 grep pattern may miss co-located tests in nested directories

**Location:** Stage 2, Task 8 Step 2 (line 507). The grep `grep -rln -e 'profileIcpsExtract' … src/**/__tests__` uses a shell glob that may not expand deeply enough to catch tests in subdirectories (e.g., `src/utils/__tests__/nested/deep.test.ts`). This is minor since the three utils are unlikely to have deeply nested test suites, but the broader glob `src/**/__tests__/**/*.test.ts` would be more robust.

### [Nit] The self-review section (lines 1389–1400) adds value but inflates the plan

**Location:** End of file, "Self-review" section. The self-review is useful for plan review (and I used it during this review) but adds 12 lines to a 1,400-line plan. It could live as a separate review checklist document referenced from the plan, keeping the plan itself focused on execution instructions. Not actionable — purely structural preference.
