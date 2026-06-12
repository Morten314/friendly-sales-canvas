---
synthesizes_review: docs/reviews/35-apollo-discovery-design-spec-review-1.md
artifact: specs/35-apollo-discovery-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-12
round: 1
---

## Round Recommendation

yes

Reason: All four High findings are agreed and revised, but the fix for the `replace` data-loss High introduces a new `superseded`-lead lifecycle (tag → swap → orphan-sweep) that interacts with pre-reveal dedup and agent-view read paths — significant new design surface that warrants one re-review round.

## Agreed Findings

- **[High] No acceptance criteria** — Added six functional, verifiable acceptance criteria to §2 (lead lands or `completed_empty` with explanatory counts; no credit spent on `has_email=false`/dupes/unselected; spend recorded; replace is no-loss; gate honored; source filter + unverified marking). MVP-appropriate; deliberately no arbitrary latency/quality SLAs. *(Severity downgraded — see below.)*
- **[High] `replace` deletes before confirm (data loss)** — §5.7 rewritten to a **no-loss `superseded`-swap**: prior discovery leads are tagged `superseded`, discovery runs, and the old set is deleted **only after new leads commit**; a failed run clears the tag and restores them. Added the `superseded` field (§5.8), the residual orphan-tag sweep (§8.8), and the swap test (§10).
- **[High] Concurrent runs not guarded** — §5.9 `/discover` is now **single-flight** (`409 {code:"discovery_in_progress"}` when a `queued`/`processing` run exists for the org; stale-run failover retires old ones first). Test added in §10.
- **[High] Warmup fan-out has no failure strategy** — §5.4 now states the four checks run via the **single shared Mongo client** (one failure domain, not four) and each is wrapped so a query error yields `false` (degraded, never `500`). *(Severity downgraded; per-check 2s timeouts declined — see below.)*
- **[Medium] ICP-fit scoring undefined** — §5.2 step 3 now defines the **drop contract** (drop only on zero-overlap against a hard ICP dimension) and the scoring inputs for ranking; exact weights/thresholds explicitly left to plan-time within that contract.
- **[Medium] `icp_fingerprint` normalization unspecified** — §5.7 specifies **SHA-1 of canonical JSON** over named semantic fields (arrays lowercased/trimmed/sorted; volatile fields excluded) via a single shared `icp_fingerprint()` helper used for both write and read, so it can't drift.
- **[Medium] `profiler_analyzed` user-vs-org asymmetry** — §5.4 resolves semantics: warmup is evaluated for the requesting `(org_id, user_id)`; the profiler milestone reflects the querying user because `ICP_config` is user-keyed; true org-level readiness flagged as tech debt with trigger (multi-member orgs).
- **[Medium] Empty/sparse ICP → unbounded search** — §5.2 step 1 + §5.9 now reject an underspecified selected ICP with `422 {code:"icp_underspecified"}` before any costly search.
- **[Medium] Stale-run threshold insufficient at hard cap** — §5.3 threshold is now **proportional** (`max_leads*8 + 120s`). *(Severity downgraded — see below.)*
- **[Medium] No end-to-end integration test** — §10 adds a **transport-level mocked-Apollo pipeline integration test** (canned multi-page `api_search` + sequential `people/match`). *(Severity downgraded — see below.)*
- **[Medium] App-wide unlock toast has no mechanism** — §6.3 specifies an **app-shell low-frequency warmup poll** (active only while connected-but-locked, route-independent) that fires once per unlock via a persisted `apollo_unlock_notified` flag; polling-only at MVP.
- **[Low] §5.2 mixes flow with constants** — Constants moved to a **Configuration table**; inline constant names removed from the steps (also resolves Nit 21).
- **[Low] `normalize_apollo_record` dual-shape coverage** — Made explicit in §10 (separate test cases per shape) and §8.6 (which fields each shape carries).
- **[Low] `completed_empty` ambiguity** — §5.3 defines it as **`created == 0`** regardless of stage, with FE messaging derived from the run counts (`searched==0` → widen ICP; `searched>0, created==0` → none contactable).
- **[Low] `partial` FE behavior unspecified** — §6.4 adds a **Complete·partial** sub-state: landed leads shown normally + a non-blocking warning banner, button restored.
- **[Low] Master keys cleartext not in risk section** — §8.7 one-liner added (documentation only; hardening stays deferred per MVP posture).
- **[Nit] "five states" vs six** — §1 and §6.4 reconciled: **5 lifecycle states**; zero-results and partial are Complete sub-states.
- **[Nit] §12 title "Open decisions (resolved)"** — Renamed to **"Resolved decisions."**
- **[Nit] Constants not collected** — Folded into the §5.2 Configuration table.

## Disagreed Findings

- **[Medium] LLM re-rank — "consider deferring."** Disagree with deferral. Choosing *which* ~50 of ~500 free candidates to reveal is the single lever that controls credit waste, because reveal is the only credited step; a purely linear local score over the obfuscated free fields ranks that selection less well. This was a deliberate product decision in brainstorming ("free funnel + LLM re-rank") that the reviewer lacked context for. The non-determinism concern is already bounded — §5.2 step 4 specifies a deterministic fallback to the step-3 ICP-fit ranking on LLM failure. Incorporated the reviewer's *secondary* suggestion: added an explicit rationale sentence to §5.2 step 4. Step retained.
- **[Low] Export endpoint — "consider deferring."** Disagree. "Download existing leads before replacing" is an explicit **UC5** product requirement, and the no-loss swap (replace fix) doesn't remove a user's legitimate desire to export their leads. The surface-area concern is addressed by *simplifying, not removing*: §5.7 now states the export is a bounded, non-streaming JSON/CSV dump (no pagination/streaming at MVP scale).

## Deferred Findings

- None deferred at the spec level — every agreed finding was actionable in this round and revised. One sub-point (org-level profiler readiness, from the §5.4 asymmetry finding) is recorded as tech debt inline; trigger: multi-member orgs needing org-wide warmup, requiring an `org_id` backfill on `Profiler.ICP_config`.

## Severity Disagreements

- **No acceptance criteria — agree finding, Medium not High.** The spec was already detailed enough to author a plan; absent criteria is a quality gap, not a plan blocker, especially at 0 users. Added anyway (cheap, improves plan-readiness).
- **Warmup fan-out — agree finding, Medium not High.** It is one Mongo deployment (a single failure domain shared with the rest of the app), not four independent services; graceful per-check degradation suffices. Declined the suggested per-check 2s timeouts + `timed_out` flags as over-engineering at MVP.
- **Stale-run threshold — agree finding, Low not Medium.** Only manifests if `max_leads` is raised toward the hard cap; the default (50) sits comfortably inside the prior 600s. Fixed regardless (proportional threshold).
- **No e2e integration test — agree finding, Low not Medium.** Unit tests plus a transport-level Apollo mock cover the stage interactions; a standalone mock-server harness isn't warranted at MVP. Added the transport-level integration test.

## Open Questions

- The decision to **exclude `superseded` leads from agent views** (§5.7) implies every lead-read path (Scout / Profiler / Signals queries) must filter on it. Whether that read surface is small and enumerable is a plan-time concern; round 2 / plan-write should confirm the cascade is bounded before committing to the `superseded` approach (vs. an alternative such as writing new leads under the new `discovery_run_id` and deleting the prior run's leads on success without a visibility flag).
- The `build_search_filters` ICP→Apollo filter-key mapping (§5.2 step 1) and the exact ICP-fit weights (§5.2 step 3) remain plan-time decisions *within* the contracts now specified — not spec gaps, but the largest remaining unknowns for plan-readiness, both dependent on confirming live Apollo filter parameter names.
