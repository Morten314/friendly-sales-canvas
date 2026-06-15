---
artifact: plans/36-signal-lead-mapping-and-source-labeling.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-14
round: 1
---

## Context

Procedural note: the plan's load-bearing code assumptions were spot-checked against the
codebase before critiquing, and they hold. Specifically verified: backend signatures
(`fetch_signals`, `get_leads_for_org`, `_get_signal_ask_customer_profile`,
`_persist_market_score_for_lead`, `_extract_research_json` kwargs), the `args[4]` `lead_data`
index in both `create_lead` and `batch_upload_leads` `execute_write` calls, the `mock_session`
fixture's `__enter__` wiring, the `signals` router's `from app.services import signals as
signals_service` import style (so patching `app.services.signals.build_signal_lead_map_claude`
*is* intercepted — the patch-where-used target is correct), the FE `apiGet`/`apiPost` and
`paginatedSchema`/`firstPageParams` exports, and the barrel/queryKey current contents. These
are not flagged below; findings are structural and spec-level.

## Findings

### [Medium] customers/LeadStream ships first-page-only, dropping the spec's required pager (§5.7-A2)

**Location:** Task 16 (`fetchLeads` → `firstPageParams(50)`) + Task 17 (flat `leads = leadsQuery.data ?? []`
render); spec §5.7-A2 "Pagination"; Self-Review line 2169 ("pagination first-page").

The spec directive is explicit: "use the v2 `limit`/`offset` (first page on load **+ a 'load
more' / paged control**); **do not assume a flat in-memory array**." Task 16 fetches only page 1
and Task 17 renders a flat array with no pager — violating both the directive and its explicit
prohibition. AC #8 (real leads + empty state) is met, but the pagination design directive is
silently dropped. The Self-Review claims "pagination first-page" coverage without flagging the
gap. (Mitigating context: the repo's other lead table, market-research LeadsTable, also
single-fetches, so this is consistent with existing patterns — but this spec explicitly asked
for more here.) Either implement the pager or explicitly defer it the way the cache-miss guard
is deferred.

### [Medium] LeadStream "N relevant signals" is a count only — no expandable headlines/why (AC #7)

**Location:** Task 18 Step 3 (count cell `${n} signals` / `—`) + its test (`getByText(/1 signal/)`); spec
§5.7-A2 + AC #7 "(expandable)"; Self-Review line 2169.

AC #7 requires per-lead "N relevant signals **(expandable)**"; §5.7-A2 says LeadStream gets
"the same per-row 'N relevant signals' affordance" as LeadsTable, which (Task 15) renders
headlines + one-line `why` inside the expanded `LeadIntelligencePanel`. Task 18 renders only a
bare count, no expandable detail. Undocumented under-delivery on one of the two AC #7 surfaces.

### [Medium] No plan-level kill criteria / abort conditions

**Location:** "Final verification (before merge)" (line 2152) + per-task steps; "Conventions for every
task" (line 15).

Per-task failures have narrow mitigations (re-run flaky vitest with `--no-file-parallelism`,
resolve `knip` exports), but there is no stated circumstance under which the whole plan is
abandoned — e.g., if the live Claude shape (Task 11 Step 5) cannot be zod-contracted, or if
Task 10's truncated-JSON prefix recovery proves unreliable against real model output. The
report-to-human recovery path is externalized to the referenced
`subagent-driven-development`/`executing-plans` skills (line 3) rather than stated in the plan.
For an 18-task cross-stack LLM plan, explicit abort triggers are warranted.

### [Low] orgId resolved inconsistently between the two lead tables

**Location:** Task 15 Step 1 (`const leadMapOrgId = selectedTenant?.id ?? authOrgId ?? ""`, tenant-aware via
`useTenant`/`useAuthToken`) vs Task 17 Step 3 (`const { orgId: authOrgId } = useAuth()`, ignoring tenant).

The mapping is keyed per (org, user) (§5.4) and leads are org-scoped, so the two lead tables feed
the same `useSignalLeadMap` hook different org sources: LeadsTable honors a selected tenant
(`selectedTenant?.id`), LeadStreamPanel uses auth-only `useAuth().orgId`. Under an active tenant
selection the two surfaces can fetch different leads and different mappings for what is one
feature. Low likelihood (needs an active tenant override) but an unacknowledged design smell;
reconcile the source or document the divergence.

### [Low] Hidden prerequisite: live backend + ANTHROPIC_API_KEY surfaces only at Task 11 Step 5

**Location:** Task 11 Step 5 ("Confirm the live shape"); "Conventions" (line 15-29).

Confirming the cross-stack contract (the cross-stack rule, line 28) requires a running backend
with a real Anthropic key — and `_claude_budget.CLAUDE_API_KEY` has **no** config fallback
(`os.getenv("ANTHROPIC_API_KEY") or ""`, verified). With no key the endpoint returns the
designed 500 (AC #4), so Step 5 cannot capture the mapping shape at all. This is the first and
only step needing it, buried late in Phase C after all BE work. The up-front Conventions list
venv/branch/commit mechanics but not this credential/env requirement. (Likely already
provisioned for the existing `_claude` endpoints, which is why this is Low — but it should be
stated up front, since it gates all FE contract work.)

### [Low] Per-step verification is success-only; regression deferred to the final gate

**Location:** Each task's "Run to verify" uses scoped filters (`-k source`, `-k build_map`, single file) —
e.g. Task 1 Step 4 (line 116-119); full module run only at Final verification (line 2154).

Every step confirms the *new* test passes but never re-runs the full touched module, so a
regression in an adjacent existing test (e.g., an existing `test_create_lead_*` asserting exact
`lead_data` contents after Task 1 injects `source`) surfaces only at the end. Additive changes
keep this low-risk, but the review bar asks for both a success **and** a regression signal per
step; running the whole module file per task would close the gap cheaply.

### [Low] Independent tasks forced serial by the single-branch convention

**Location:** Conventions line 17 ("Do all work on a single branch"); Tasks 1-3 (disjoint ingest paths),
Tasks 14-15 (independent surfaces, both gated only on Task 13).

Tasks 1-3 touch disjoint files/functions and could run concurrently; Tasks 14 and 15 are
independent surfaces (SignalCard vs LeadsTable) both depending only on Task 13. The single-branch
rule serializes them. Defensible for a single-agent TDD flow, but the plan never notes which task
groups are parallelizable for an executor who wants to fan out.

### [Low] Task 12 presents an already-existing import as a new line

**Location:** Task 12 Step 3b (line 1322-1332), `import { apiGet, apiPost } from "@/shared/api/client";`.

`signals.ts` already imports `apiGet, apiPost` from `@/shared/api/client` (current line 9) and
`firstPageParams, paginatedSchema` (line 10). Shown without an "(already imported)" note, so a
literal add yields a duplicate import (lint/typecheck risk). Only the contract-import extension is
actually new here.

### [Low] queryKey-includes-userId+orgId is not tested

**Location:** Task 13 test (line 1422-1437) vs spec §8 ("queryKey includes userId+orgId").

Spec §8 explicitly lists "queryKey includes userId+orgId" as a test requirement. Task 13's test
validates the selectors and the disabled (no-orgId) state but never asserts the queryKey content;
the implementation includes both (`qk.signalLeadMap(orgId, userId)`) but has no regression guard
for it.

### [Nit] Task 11 re-implements dependency-override boilerplate instead of reusing the existing helper

**Location:** Task 11 Step 1 (manual `app.dependency_overrides[get_mongo]`/`[get_neo4j_driver]` try/finally)
vs the existing `_override_mongo` context-manager helper in `tests/test_signals.py` (lines 25-32).

The suite already has a helper for the mongo override; the new tests manually override both mongo
and driver inline in a try/finally. Functional, but a style inconsistency with the file they are
appended to.

### [Nit] Stale task-number header comments left in connectors/index.ts

**Location:** Task 5 Step 4 (line 443-457) edits the export lines; current `connectors/index.ts` header
(lines 4-7) references "Task 10/12/13/14" from a prior plan.

The barrel header maps exports to stale task numbers. Task 5's instruction ("replace the
`leadSource` re-export line and add the badge") is line-scoped, so the stale header survives (or,
if treated as whole-file replace, is silently dropped). Either update the comment to spec 36's
task map or state that the edit is line-scoped.
