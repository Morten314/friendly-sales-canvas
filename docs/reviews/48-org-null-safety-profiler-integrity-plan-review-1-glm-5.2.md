---
artifact: plans/48-org-null-safety-profiler-integrity.md
artifact_type: plan
verdict: findings
reviewer_model: glm-5.2
date: 2026-07-09
round: 1
---

## Context

Round-1 plan review. I verified the plan's load-bearing claims against the code rather than taking
them on faith, because the rubric's `## all` patch-target item and the plan's heavy embedded test
code make vacuous-double / wrong-anchor the highest-value checks. Project rubric
`docs/review-rubric.md` loaded — `## all` (Python patch-target semantics) applies; there is **no**
`## plan` section, so only `## all` was appended.

Verified-accurate (this review):
- **All BE patch targets in Task 10 are correct (patch-where-used):** `fetch_company_profile`
  (`persistence.py:23` import, `:208` use), `ICP_generator` (`:24` import, `:226` use), and
  `_ensure_icp_indexes`/`_reserve_unique_icp_id`/`_release_icp_id` (defined and used in-module) all
  resolve in `app.services.icp.persistence`; `existing_icp` is read at `:178` as the plan cites; the
  `list_icps` call signature in the test matches the existing `test_list_icps_returns_cached…`
  pattern; `TEST_USER_ID`/`TEST_ICP_ID_1/2`/`mock_session`/`mock_mongo_client` exist.
- **The generate-branch write is a *partial* `$set` (`persistence.py:239-243`, fields
  `user_id`/`icps`/`prompt_meta`), not a full-doc overwrite** — so a sibling `DISMISSED_FIELD`
  *does* survive refresh, and the plan's WS3 durability design is sound. (The spec's "overwrites the
  whole ICP_config doc" was loose; the `icps` field is replaced but siblings are kept.)
- **Task 10's "Expected: PASS" is accurate:** the existing `test_delete_recommended_icp_happy_path`
  asserts only `result["success"]` / `remaining_count` / `_release_icp_id` called — it does **not**
  assert exact `$set` keys, so adding `DISMISSED_FIELD` won't break it.
- **Task 1's new cache-survives-transient contract is already encoded** in the existing
  `AuthContext.orgAuthoritative.test.tsx` (`it("keeps the cached org when GET /org fails")`,
  503 → `org:cached-org`), so Task 1 Step 4's "PASS" holds.

Procedural caveat: this is a first round on the plan; the underlying spec cleared three single-model
(`glm-5.2`) rounds, so the same single-model-floor note applies — a distinct model would add marginal
assurance, though nothing here blocks execution.

## Findings

### [Medium] Hard line-number citations drift across same-file block reworks (SuggestedICPCards T3→T7→T11, and within T7's own step sequence)

**Location:** Task 3 (`SuggestedICPCards.tsx:301,310,311,313,705`), Task 7
(`loadProfilerPagePayload` `:109-138`, `refetchCustomerProfileIcps` `:353-356`, snapshot `:465-472`),
Task 11 (`finalizeRecommendedReject` `:688-741`, mount effect `:754-756`).

Token replacements in Task 3 are line-stable, but Task 7 Step 3 rewrites the `:109-138` loader block
to a different-length body, which shifts every later line in the file — so Task 7's *own* Step 4
(`:353`) and Step 5 (`:465`) citations are stale by the time those steps run, and Task 11's `:688-741`
/ `:754-756` references (run after Task 7) are guaranteed off. This repo has a documented history of
line/glob-navigation mistakes (see AGENTS.md "Tool Usage Pitfalls"), and this plan is executed
task-by-task by subagents that can be literal. The plan already mitigates this with symbol anchors
(`finalizeRecommendedReject`, `loadProfilerPagePayload`, `refetchCustomerProfileIcps`, "the snapshot
short-circuit") and "when you read the file" notes — recommend making that explicit and primary:
state once (Global Constraints) that all line numbers are hints to be re-located by the named
symbol/content anchor after any prior edit, and especially that Task 7's loader rework invalidates
its later-step and Task 11 line refs.

### [Low] Task 11 test hardcodes the `"profiler_pendingRecommendedRejects"` localStorage key — risk of a vacuous assertion

**Location:** Task 11, Step 1 test (`localStorage.getItem("profiler_pendingRecommendedRejects")` at
the two pending-record assertions), vs. the imported `PROFILER_DISMISSED_RECOMMENDED_IDS_KEY`.

The dismissed-ids key is imported from `../suggestedIcpStorage` (so it's correct), but the
pending-reject key is hardcoded as a string literal. If the real pending-reject key constant differs
(or is renamed later), `getItem(...)` returns `null`/`""`, and `?? "").toContain("rec-1")` /
`.not.toContain("rec-1")` then **passes vacuously** — the test would green without actually
exercising the retention behavior it claims to verify. Recommend importing the pending-reject key
constant from `suggestedIcpStorage` (alongside `PROFILER_DISMISSED_RECOMMENDED_IDS_KEY`) so a
mismatch is a compile/import error, not a silent vacuous pass.

### [Low] Task 10 refresh test never asserts that `DISMISSED_FIELD` survives the generate write

**Location:** Task 10, Step 1 `test_list_icps_refresh_filters_dismissed_signatures`.

The test asserts only on the *returned* `items` (that the dismissed signature is filtered out). The
load-bearing durability property — that the next refresh still sees the prior `DISMISSED_FIELD`
(i.e., the generate-branch `update_one` does not wipe it) — is asserted by reasoning only. I
verified the write is a partial `$set` (`persistence.py:239-243`) so the property holds today, but
nothing in the test would catch a future change to that write (e.g., someone widening the `$set` or
switching to `replace_one`) that silently drops dismissals on every refresh. Recommend adding an
assertion on the generate-branch `update_one` `$set` keys (that it does not include/remove
`DISMISSED_FIELD`), so the "sibling preserved" guarantee is pinned.

### [Low] No explicit kill / abort / rollback criteria

**Location:** "Final verification (merge gate)" and Global Constraints.

The plan is bound to `subagent-driven-development` / `executing-plans` (declared at the top), which
report-and-wait on failure, so the missing whole-plan abort criteria is acceptable by the rubric's
Low calibration — and the per-task TDD FAIL→PASS gates plus the human merge gate provide real
stop-points. Filing at Low only to note it's worth one explicit line ("on any unrecoverable task
failure, stop, leave the branch as-is, and report to the human — do not attempt a partial merge or
force a re-run") so the stop/escalate behavior isn't left to the executor's judgment.

### [Low] Task 11 reject test uses real timers with a ~6s wait / 15s timeout

**Location:** Task 11, Step 1 test (`await new Promise((r) => setTimeout(r, 6000))`, `}, 15000)`).

The 5s reject-window plus a 6s real wait (per the sibling `write.test` real-timers constraint around
`apiFetch`'s dynamic `import("./jwt")`) makes this a slow, wall-clock-dependent test in an already
~10-minute suite. If the MSW/`apiFetch` interplay permits it, prefer fake timers (or inject the
window duration) to avoid a >6s real wait; otherwise flag it as intentionally slow so it isn't
mistaken for a hang in CI/local runs.

## Observations (no action)

- The plan faithfully implements spec 48 with no scope creep: the three-outcome resolution model,
  `?? ""` placeholder policy (spec-sanctioned — spec WS1(b) "`?? ""` is fine"), transitive
  lead-upload guard, both-directions signature acceptance bar, and the round-3 refinements
  (cache-survives-transient, stale-async generation guard, `orgStatus` footgun) are all present; the
  spec→task coverage table is accurate and complete.
- BE patch-where-used is correct throughout Task 10 (verified each target resolves at the call site
  in `persistence.py`) — no vacuous doubles in the WS3 backend tests.
- FE tests lean on MSW `onUnhandledRequest: "error"`, which is a strong vacuous-double guard (a
  wrong endpoint or escaped call fails the test rather than passing silently); the per-task
  implementer notes to adjust import paths / endpoints / selectors are appropriate.
- Sequencing is sound: Task 2 depends on Task 1 (`orgStatus`); Task 5 depends on Task 3
  (`orgIdToUse` becomes `?? ""`); WS2/WS3/WS4 are independent of WS1. Serial presentation is
  intentional (shared-file edits prevent parallelizing T3/T7/T11), not accidental.
- Risk is reasonably front-loaded: Task 1 (the central `AuthContext` rewrite touching all org-scoped
  routes) is first; WS3 (the one cross-stack, most-complex change) is self-contained and gated by its
  own TDD steps.
