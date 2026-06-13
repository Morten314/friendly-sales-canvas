---
synthesizes_review: docs/reviews/spec35a-apollo-discovery-impl-review-1.md
artifact: worktree-spec35a-apollo-discovery
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-13
round: 1
---

## Round Recommendation

no

Reason: No Critical/High findings; all four Mediums resolve to comment-only, MVP-sanctioned deferral, or are factually stale against current code (HEAD `03d70b0`) — no actionable defect warrants another review round.

## Agreed Findings

- **#4 `completed_empty` semantics (orchestrator.py:422)** — No behavior change (the reviewer agrees `completed` is correct when `matched > 0, created == 0`). Add an inline comment documenting that an enrich-only run — candidates that all matched existing leads — is `completed`, not `completed_empty`, because leads did land. *To be made* (comment only).
- **#5 `DiscoveryCounts.errors` contract hardening (orchestrator.py:481 ↔ `ingestion.upsert_imported_leads`)** — Current code is correct: the bare-string→`{stage,message}` wrap lives at the single write site (line 481) and is guarded by `test_discover_status_response_validates_with_ingest_errors`. Optional low-priority hardening: centralize the coercion in the run-doc writer (`runs.complete_discovery_run` / `update_discovery_progress`) so a future append site cannot reintroduce the route-500. *To be made (optional)*; otherwise the existing regression test already locks the model invariant.

## Disagreed Findings

- **#3 `connect_apollo` calls `_icps_for_org` twice on the reject path (Medium)** — Stale. Current code (orchestrator.py:53–56) calls `warmup._icps_for_org` exactly once, stores it in `icps`, and reuses it for both the `any(...)` completeness check (line 54) and the missing-section lookup (line 55). The single-fetch-and-reuse the reviewer recommends is *already implemented*. The second call the reviewer saw is `warmup.icp_is_complete(icps[-1] ...)` on line 55 — a pure in-memory function, not the Mongo read. No change.
- **#6 Replace `sys.modules`/`getattr` dispatch with a static `_CHECK_FNS` dict (Low)** — Incorrect for this codebase. The call-time `getattr(_this_module, "_" + key)` at warmup.py:108 is load-bearing: `test_warmup_check_error_degrades_to_false` (test_connectors_warmup.py:66) does `monkeypatch.setattr(warmup, "_signals_generated", boom)` and asserts the degrade path runs. A static `_CHECK_FNS` dict built at import time captures the *original* function objects, so the monkeypatch would be invisible and that test would fail. The dynamic lookup is deliberate, not incidental. Concession to the readability point: add a one-line comment at warmup.py:105 noting the call-time lookup exists for test patchability.
- **#7 No space before `DETACH DELETE` — reads as `trueDETACH` (Low)** — Factually incorrect. ingestion.py:313 is a single string literal `"WHERE l.superseded = true DETACH DELETE l RETURN count(l) AS n"`; there is a space between `true` and `DETACH`. It does not render as `trueDETACH`. No change. (If the intent was a line break for visual grouping, that is a pure cosmetic nit — see Deferred.)

## Deferred Findings

- **#2 Substring title matching false positives in `passes_hard_dimensions` (Medium)** — Deferred, spec-sanctioned. Spec §5.2 explicitly leaves weights/thresholds to plan-time, and the funnel is intentionally lenient: the LLM re-rank and the reveal-time quality gate tighten downstream, so a generous hard-drop only widens the pre-rank pool, it does not produce wrong final leads. Track as tech debt. **Trigger:** observed credit waste at scale → replace the bidirectional substring with tokenized/word-boundary matching (apply to `score_icp_fit` in lockstep, since it shares the pattern).
- **#10 Prompt renders `{{ icp.buyer_role }}` as Python list repr (Nit)** — Deferred. Cosmetic; `| join(', ')` is cleaner but changing the template forces a golden-fixture regen for negligible LLM-quality gain. **Trigger:** next functional edit to `apollo_discovery_rerank.md.j2` — bundle the `| join` + `python tests/regen_prompt_fixtures.py apollo_discovery_rerank` then.
- **#11 `_CreditWall` defined twice in orchestrator test (Nit)** — Deferred; reviewer agrees it is acceptable at this scale. **Trigger:** a third usage → hoist to a module-level helper/fixture.

## Severity Disagreements

- **#1 `_existing_contact_ids_tx` returns `.data()` while siblings return raw records — Medium → Low.** The observation is factually true (it is the only tx fn calling `.data()`; siblings use `_records_to_dicts` or raw records), but it is a style/consistency point, not a Medium. `.data()` here is a valid *eager* materialization at the tx boundary: `get_existing_apollo_contact_ids` (ingestion.py:289–290) consumes `rows` *after* the `with driver.session()` block closes, and the caller treats them as dicts consistently (`r["cid"]` / `r.get("cid")`). The reviewer's "double-`.data()` risk" is speculative. If pursued, the cheapest resolution is a one-line comment noting the eager conversion is intentional (or return the cid set directly from the tx to mirror the line-290 caller); either is Low-priority polish, not a defect.

## Open Questions

- **Spec §5.3 wording vs. implementation (from #4).** The spec states `completed_empty` fires when `created == 0`; the implementation returns `completed` whenever `created or matched` (so `matched > 0, created == 0` → `completed`). The implementation's semantics are the more correct ones — an enrich-only run *did* land leads. The spec text is narrower than intended. Per CLAUDE.md, specs are a frozen record of intent and should not be retro-edited, so this is flagged rather than changed; if the team wants the spec to match reality, the reword is `completed_empty` ⇔ `created == 0 AND matched == 0`.
- **Applying the agreed touch-ups vs. keep-as-is.** The branch is in keep-as-is state (no merge/push). The two Agreed items (#4 comment, #5 optional coercion) plus the two optional clarifying comments (#1, #6) are comment-/few-line-level and need no re-review — but applying them reopens the kept branch. Operator decision: apply now as one small commit, or record as TD and leave the branch untouched.
