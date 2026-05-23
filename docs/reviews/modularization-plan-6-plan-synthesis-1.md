---
synthesizes_review: docs/reviews/modularization-plan-6-plan-review-1.md
artifact: plans/modularization-plan-6.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-22
round: 1
---

## Round Recommendation

no

Reason: All three High findings are local corrections (one promotion-to-mandatory-step, one decision resolved by reading code now, one cross-reference note); no new architectural surface; Mediums and below are presentation polish.

## Agreed Findings

- **F1 (High) — Task 10 keyword-promotion fix:** Promote the `signals.py`/`market_scoring.py` keyword-promotion from a sub-step of Task 10 Step 3 + Step 6 to a single mandatory step labeled "Cross-cutting fix: keyword-promote `get_leads_for_org` callers in commits 14/15 files." Add an explicit pre-commit grep invariant: `grep -nE "get_leads_for_org\(org_id=" backend/app/services/signals.py backend/app/services/market_scoring.py` must return 4 hits before committing Task 10. Add a one-line spec-erratum note pointing out that spec §3.7's example caller form (`get_leads_for_org(org_id, limit=…, …)`) is positionally incompatible with the new `driver=None` first parameter — the example needs the keyword form.

- **F2 (High) — Task 13 Step 4 decision:** Resolve the icp-helper signature question now. **Verified from `app/services/icp.py:1101, 1107, 1134`:** the 3 helpers already take a pre-indexed `db` parameter (`_ensure_icp_id_registry_indexes(db)`, `_reserve_unique_icp_id(db, id_type, …)`, `_release_icp_id(db, icp_id)`). They never read `clients.*` themselves. Therefore: (a) **the helpers' signatures do not change in commit 13**; (b) **the §3.7 fallback discussion does not apply to these helpers** (they never read module globals); (c) **customer_profile's 11 call sites do not change** — they already pass `db`. What changes is that customer_profile's *parent functions* (the ones that build `db = mongo["Profiler"]` or similar) need `mongo` injected from the router. That injection is already covered by Task 7. Task 13's commit 13 scope shrinks to: convert icp.py's 7 dotted-access sites (in functions OTHER than the 3 helpers) + update the 3 `_fetch_pinecone_supporting_context` call sites to pass `pc`. Rewrite Task 13 Step 4 accordingly and delete the "Decision: read first" block.

- **F3 (High) — Task 15a fallback note vs spec §3.6:** Add an explicit note to Task 15a Step 2 that the 15a-only fallbacks deviate from spec §3.6's "no §3.7 fallback for market_scoring internals" promise solely because of the 15a/15b split. Note that the §7.1 hard greps (`def \w+\([^)]*\b(driver|mongo|llm2)=None`) are only expected to pass after commit 15b removes the fallbacks and after commit 16 — they are NOT run at the 15a boundary. Cross-reference Task 15b Step 6 (fallback removal) and Task 16 Step 10 (final grep verification).

- **F4 (Med) — Kill criteria:** Add a brief paragraph to the "Risks and rollback notes" section stating an abort condition: "If a service-conversion commit fails the test suite after a reasonable amount of debugging (>1 hour or >3 fix attempts) and the failure is not attributable to spec/code drift documented in pre-flight, pause and escalate." Avoid the "more than 2 failures" framing — refactors fail one at a time, and each failure is independently diagnosable.

- **F5 (Med) — Spec-internal inconsistency (7 vs 11):** Add a one-line note in Task 13's intro: "The spec §4.2 commit-13 row says '7 sites' in `customer_profile.py`; §3.7 table says '11 call sites'. The 11 in §3.7 is correct (verified by grep — `_ensure_icp_id_registry_indexes` × 4 + `_reserve_unique_icp_id` × 6 + `_release_icp_id` × 1). The §4.2 cell is a stale count from earlier spec rounds; spec erratum." This is a documentation-only note in the plan — the spec itself is now frozen but the plan can flag the inconsistency.

- **F6 (Med) — Task 3 git add of unmodified `unit/conftest.py`:** Remove `backend/tests/unit/conftest.py` from the Step 7 `git add` and the Task 3 "Files" header. The unit-conftest changes happen per-task (in each Task 4–15 Step 5 when service-specific unit tests get re-pointed). Task 3 only modifies root `tests/conftest.py` (adding override fixtures and the leak-detector).

- **F7 (Med) — Task 11 re-touches documents.py:** Add a sentence to the Task 11 header: "Also re-touches `backend/app/services/documents.py:38` to pass `driver` to the now-`(driver, query_string, params=None)`-typed `query()` function. This is a cross-commit dependency — commit 9 fully converted documents.py to take its own `driver` parameter, but the `query()` signature change in this commit propagates one more line."

- **F8 (Med) — Dual-construction window vs merge timing:** Reconcile the contradiction. Brewra's CTO solo-write workflow on `master` (per CLAUDE.md) actually permits per-commit merges. Update the plan to: (a) recommend the CTO merge each completed task to `master` immediately after it lands green on the feature branch (or even commit directly to `master`); (b) acknowledge that if all 17 commits sit on the branch through to end-of-execution, the dual-construction window is the full branch duration. Soften the "Merge to master" post-execution step to "Final merge if not already merged per-commit" with the per-commit option as preferred.

- **F9 (Low) — Task 1 Step 5 `hasattr` guard:** Make Task 1 Step 3 (the collapse) mandatory and remove the `hasattr(_clients, "_bundle")` branch from Step 5. The collapse removes the dual-construction risk entirely (spec §6 Risk 1) and keeping the conditional just adds a path that diverges from the spec's single-construction intent.

- **F11 (Low) — Bisectability `shuf` non-determinism:** Replace `shuf -n 3 | awk '{print $1}'` with three concrete commit indices. Suggested: commits 5 (`org_auth`), 10 (`leads` — first §3.7 fallback commit), and 14 (`signals` — last LLM-heavy commit before 15a/b). These cover the easy/early, fallback-introduction, and pre-market_scoring boundaries.

- **F12 (Nit) — "16-or-17" in commit messages:** Update commit-message templates to use `/17` throughout (since the spec's recommendation is to plan the split upfront), with a one-line note at the top of the plan stating that 15a/15b can be re-merged into a single commit 15 (renumbering all later messages to `/16`) if 15a's diff lands below ~200 LOC.

- **F13 (Nit) — Task 2 lifespan inline code becomes stale at Task 15a:** Add a brief cross-reference note at the bottom of Task 2 Step 2: "The four `create_index` calls in this lifespan body are temporary — Task 15a Step 4 replaces them with a single `_ensure_market_scoring_indexes(app.state.clients.client)` call. A reviewer checking out commit 2 in isolation sees the inline version; this is intentional sequencing, not stale code."

- **F14 (Nit) — Router structure verification in pre-flight:** Add a grep to the Pre-flight section: `ls backend/app/routers/` and `for f in backend/app/routers/*.py; do echo "$f"; grep -E "from app\.services" "$f" | head -3; done`. Document the expected 1:1 service↔router mapping. **Verified now:** the mapping IS 1:1 (every `app/routers/<service>.py` imports its corresponding `app/services/<service>.py` as `*_service`). Add this as a verified-baseline statement in pre-flight.

## Disagreed Findings

- **F10 (Low) — Leak-detection fixture scope (session vs function):** Keep the session-scope autouse fixture as specified. Spec §5.4 explicitly mandates session-scope, and the plan follows the spec. Function-scope detection would catch leaks immediately but adds a teardown hook to every test (cheap individually, but ~200 tests means a noticeable constant factor). More importantly, a leak in a fixture's cleanup *is* an inter-test pollution bug — its effect (subsequent tests pass/fail for the wrong reasons) is observable through test failures. The session-scope detector serves as a "did this happen?" signal, not a real-time alert. The reviewer's argument is technically correct but the spec's chosen approach is defensible. Declining to deviate from the spec on this one.

## Deferred Findings

(none — all findings are agreed or disagreed)

## Severity Disagreements

- **F1 (High → Medium):** The plan already catches the positional-binding bug in Task 10 Step 3's caveat block and has Step 6 to fix it. The risk is documentation clarity, not correctness. Promoting it to a mandatory step is good, but the current plan already prevents the bug from landing in committed code. Downgrading from High to Medium.

- **F8 (Medium → Low):** The "dual-construction window" risk is bounded — boot resources for an MVP-stage app with 0 live users (per CLAUDE.md Business State). The spec accepts this risk explicitly. The plan-vs-spec contradiction on merge timing is a documentation inconsistency, not a real risk. Downgrading from Medium to Low.

## Open Questions

- **Task 13's exact diff size after the F2 simplification.** With the 3 icp helpers excluded from signature changes, Task 13's scope is now: icp.py's 7 dotted-access sites + 3 `_fetch_pinecone_supporting_context` updates. That should land well under the spec's hypothetical "complex commit" threshold. Worth confirming during execution that no surprise customer_profile changes are needed beyond what Task 7 already did.

- **`backend/scripts/*.py` reference audit timing.** Spec §7.4 open question 1 says to grep on commit 1. The plan's pre-flight doesn't include this grep — it lives implicitly in commit 16's "if anything in `backend/scripts/` reaches into globals, refactor it alongside commit 16." Should this grep be added to pre-flight or kept at commit 16? Defaulting to commit 16 is fine (any scripts found are caught by the final test sweep), but adding to pre-flight gives earlier visibility. Operator's call.
