---
artifact: specs/35-apollo-discovery-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-12
round: 1
---

## Findings

### [High] No acceptance criteria — no measurable definition of done

**Location:** Section 2 (Goals / Non-goals) — goals are qualitative statements; no quantitative success conditions anywhere in the spec.

The goals ("turn an org's active ICP into a vetted set of net-new, contactable leads with minimal wasted Apollo credits") are aspirational, not testable. There are no latency targets (e.g., "discovery of 50 leads completes in under 3 minutes"), no quality thresholds (e.g., "≥80% of discovery leads pass the quality gate on a well-formed ICP"), no credit-efficiency budget (e.g., "≤1 credit per qualified lead"). Plan-readiness suffers because there's no objective bar for "done." **Suggestion:** add 3–5 measurable acceptance criteria to Section 2.

### [High] `replace` mode deletes leads before new ones are confirmed — unrecoverable data loss risk

**Location:** Section 5.7 — "`replace` deletes the org's prior discovery leads (`source:"apollo"` AND `apollo_origin:"discovery"`) before discovering"

If the discovery pipeline fails (credit exhaustion, API error, Render restart) after the delete but before new leads land, the old leads are gone permanently. This is not mentioned in Section 8 (Known seams & risks) and there is no suggested mitigation (e.g., soft-delete with a grace window, or the delete-only-after-successful-ingest pattern). Section 6.4 mentions "download before replacing" as a UI prompt but does not enforce it — a user could skip download and click Replace. **Suggestion:** either (a) delete-after-ingest (mark old leads for deletion, swap on completion), or (b) at minimum add this to Section 8 as a known risk and make the FE download prompt mandatory (block Replace until export completes or user explicitly confirms).

### [High] Concurrent discovery runs not guarded

**Location:** Section 5.2 (discovery pipeline) and Section 5.9 (`POST /discover`)

The spec does not address what happens if a user triggers a second discovery run while one is already `processing`. With in-process `BackgroundTasks`, two concurrent runs on the same org would race on Neo4j writes, double-count credits, and potentially corrupt the run doc. `POST /discover` should reject or enqueue when an active run exists for the org. **Suggestion:** add a guard — e.g., `POST /discover` returns `409` if `status` is `queued` or `processing` for that `org_id`; document in Section 5.9.

### [High] Warmup endpoint fans across four databases with no failure/timeout strategy

**Location:** Section 5.4 — "New code fanning across four Mongo databases"

The warmup readiness check queries `Profiler.Company_Profile`, `Signals.signals`, `Scout_Agent.Market_Intelligence`, and `Profiler.ICP_config` — four separate collections across at least three databases. If any one is slow or down, the entire endpoint hangs or errors. No per-query timeout, no partial-result semantics, no fallback. This is an operational fragility point. **Suggestion:** add per-check timeouts (e.g., 2s each) and return partial results (checks that timed out count as `false` with a `timed_out` flag in `missing[]`).

### [Medium] ICP-fit scoring algorithm undefined

**Location:** Section 5.2 step 3 — "Local ICP-fit score from free fields (title/seniority/org size/industry/geo); drop clear non-fits"

"Clear non-fit" is subjective. The spec does not define the scoring function, weights, or threshold. Without this, the plan author must design the algorithm from scratch, which is a product decision masquerading as an implementation detail. Different scoring schemes produce materially different discovery results. **Suggestion:** either specify the scoring approach (even at the level of "weighted exact-match on title, range-match on company_size, set-intersection on industry") or explicitly label it as a plan-time design decision with constraints.

### [Medium] `icp_fingerprint` normalization scheme unspecified

**Location:** Section 5.7 — "`icp_fingerprint` = stable hash of the active ICP's normalized fields"

Two different normalization implementations (e.g., one lowercases, one doesn't; one sorts arrays, one doesn't) produce different fingerprints for the same ICP, causing false `icp_changed` signals and spurious re-discovery prompts. The spec should define which fields are included and the normalization rules, or at minimum constrain the plan to use a canonical serialization (e.g., `json.dumps(sorted_fields)` → SHA-1). **Suggestion:** specify the fingerprint contract or cite a shared utility the plan must use.

### [Medium] `profiler_analyzed` is user-scoped while other warmup checks are org-scoped — asymmetry unresolved

**Location:** Section 5.4 — `profiler_analyzed` check notes "user-scoped — why `user_id` is required"

Three of four warmup milestones are org-scoped; `profiler_analyzed` is user-scoped. If User A has profiler analysis but User B doesn't, the warmup endpoint returns different readiness for the same org. The tile in Mission Control is org-level. This asymmetry is acknowledged but not resolved. **Suggestion:** clarify the intended semantics — is Apollo readiness per-user or per-org? If per-org, what is the correct check? If per-user, the tile state must be per-user too.

### [Medium] LLM re-rank adds non-determinism and complexity for marginal MVP benefit

**Location:** Section 5.2 step 4

The LLM re-rank step introduces: a new prompt to author, token cost per discovery run, non-deterministic output, a failure-fallback path, and test complexity (mocked LLM). For MVP with 0 users, the local ICP-fit score (step 3) already filters candidates. The spec does not discuss alternatives (e.g., a deterministic weighted scoring function) or justify why LLM re-rank is necessary at this stage. **Suggestion:** consider deferring LLM re-rank to a later phase and using the local ICP-fit ranking directly. If kept, add a brief rationale for why deterministic scoring is insufficient.

### [Medium] Edge case: empty or sparse ICP produces unbounded or empty search queries

**Location:** Section 5.2 step 1 — `build_search_filters(icp)`

If the active ICP has empty `buyer_role[]`, empty `company_size[]`, empty `industry[]`, etc., `build_search_filters` would produce a query with no filters — returning a random slice of Apollo's database and burning reveal credits on irrelevant leads. Conversely, an extremely narrow ICP might match zero results even with 500 scanned candidates. No guard is specified. **Suggestion:** add a minimum-filter check — if `build_search_filters` produces fewer than N filter parameters, return an error (e.g., `422 "ICP too broad for discovery"`) rather than executing a costly unbounded search.

### [Medium] Stale-run threshold (600s) may be insufficient at hard cap with rate-limit backoff

**Location:** Section 5.3 — "stale-run failover bumped to 600s to cover sequential reveals at `max_leads=50`"

The 600s threshold is calculated for `max_leads=50` at ~1s/lead. But `MAX_LEADS_HARD_CAP = 200` is also defined (Section 5.2). At 200 leads with 429 backoff delays, wall time could exceed 600s, causing a still-running task to be marked stale. **Suggestion:** make the stale threshold proportional to `max_leads` (e.g., `max_leads * 5 + 60` seconds) or document that the hard cap should not be used until the threshold is tuned.

### [Medium] No end-to-end integration test strategy

**Location:** Section 10 (Testing)

The testing section covers unit tests (fixtures, mocked LLM, Mongo seeds) well. However, there is no mention of how to test the full pipeline end-to-end without hitting Apollo's live API. For a multi-stage pipeline with sequential reveals and credit tracking, integration testing with a mock Apollo server would catch issues (e.g., race conditions between pipeline stages, count mismatches) that unit tests miss. **Suggestion:** add an integration test strategy — e.g., a `pytest` fixture that mocks the Apollo HTTP client at the transport level and feeds canned responses for multi-page search + sequential match.

### [Medium] Frontend "app-wide" unlock toast has no delivery mechanism specified

**Location:** Section 6.3 — "App-wide toast fires on the Locked→Unlocked edge"

The warmup poll (`useApolloWarmup`) only runs while the tile is visible (Locked state). If the user navigates away from Mission Control before warmup completes, they miss the transition. The spec does not describe a global subscription or polling mechanism that would fire an app-wide toast from outside the tile's component tree. **Suggestion:** specify the mechanism — e.g., a global polling interval in `TenantContext` or a WebSocket/SSE push. If polling-only, acknowledge that the toast is best-effort and fires only when the user returns to Mission Control.

### [Low] Section 5.2 mixes high-level flow with implementation constants

**Location:** Section 5.2 (Discovery pipeline)

The pipeline description alternates between high-level steps ("Build query", "Search + paginate") and inline implementation details (`SEARCH_SCAN_CAP = 500`, `MAX_LEADS_DEFAULT = 50`, `REVEAL_RATE_DELAY`). Constants are repeated in a summary block at the end of the section, but the inline mentions create a readability split. **Suggestion:** keep the pipeline steps at a consistent abstraction level and consolidate all constants in a single "Configuration" subsection (the summary block at line 135 is already close to this — just remove the inline constant names from the step descriptions).

### [Low] `normalize_apollo_record` must handle two different Apollo response shapes — test coverage gap

**Location:** Section 8 item 6 and Section 5.2 step 7

The spec notes that `normalize_apollo_record` must tolerate both `api_search` and `people/match` shapes. Section 10 mentions fixtures for both, but does not explicitly call out that the normalization function itself needs separate test cases for each shape. This is a likely source of bugs since the two responses have different field sets (e.g., `api_search` has `has_email` but not `email`; `people/match` has `email` and `email_status` but not `has_email`). **Suggestion:** make the dual-shape requirement explicit in Section 10's test list for `normalize_apollo_record`.

### [Low] Export endpoint adds surface area for MVP — consider deferring

**Location:** Section 5.7 — `GET /connectors/apollo/leads/export` and Section 5.9

The export endpoint supports both JSON and CSV formats, with filtering on `source:"apollo"` AND `apollo_origin:"discovery"`. For MVP with 0 users, this adds non-trivial backend surface (CSV generation, streaming/pagination for large lead sets) for a defensive feature (download-before-replace). The replace-without-download scenario is already a risk (see finding on `replace` mode). **Suggestion:** consider deferring export to a later phase and using a simpler "Replace will permanently remove N leads — confirm?" FE prompt for MVP.

### [Low] `completed_empty` status ambiguity

**Location:** Section 5.3 — "`completed_empty` ⇒ UC8 (zero results)"

The status `completed_empty` is defined but its triggering condition is ambiguous. Does it fire when (a) `api_search` returns 0 results, (b) the free funnel drops all candidates, (c) LLM re-rank produces 0 selections, or (d) the quality gate drops all revealed leads? Each has a different user-action implication (widen ICP vs. the ICP matches nobody vs. Apollo has nobody vs. credits wasted on bad matches). **Suggestion:** clarify which stage produces `completed_empty` — or add sub-states/messages to distinguish the stages where zero occurred.

### [Low] `partial` run status — FE behavior unspecified

**Location:** Section 5.3 — "`partial` ⇒ a credit/rate error mid-run (some leads landed)"

The spec defines `partial` and maps it to the Error tile state in Section 6.4, but does not specify what the FE shows. Does it display the leads that did land? Show a "partial success" message? Treat them as normal results with a warning banner? **Suggestion:** add a sentence to Section 6.4 clarifying FE behavior for `partial` (e.g., "partial runs display landed leads normally + a non-blocking warning that the run was incomplete").

### [Low] Security: master API keys stored unencrypted — not in risk section

**Location:** Section 11 (out of scope) — "Security hardening (encrypt keys, authz) — Out of scope at MVP per repo `CLAUDE.md`"

The spec defers security per repo conventions, which is documented. However, Apollo master keys control access to a paid credit pool — losing or leaking one has direct financial impact. While encryption may be deferred, the risk deserves a mention in Section 8 (Known seams & risks) so future implementers are aware. **Suggestion:** add a one-liner to Section 8: "Master API keys are stored in cleartext in Mongo — a leak exposes the org's Apollo credit pool."

### [Nit] Minor inconsistency: "five states" vs six tile states listed

**Location:** Section 1 ("Apollo tile (5 states)") vs Section 6.4 (six tile rows: Locked, Unlocked, Running, Complete, Error, Zero results)

Section 1's summary says "5 states" but Section 6.4's table lists six distinct tile states. **Suggestion:** update Section 1 to say "6 states" or clarify that Zero results is a sub-state of Complete.

### [Nit] Section 12 title says "Open decisions (resolved)" — slightly confusing

**Location:** Section 12 heading

"Open decisions (resolved)" is self-contradictory on first read. **Suggestion:** rename to "Resolved decisions" or "Decisions log" for clarity.

### [Nit] Constant names are inline but not collected in a single reference

**Location:** Section 5.2 — constants listed at line 135

`SEARCH_SCAN_CAP`, `MAX_LEADS_DEFAULT`, `MAX_LEADS_HARD_CAP`, `REVEAL_RATE_DELAY` are listed once at the end of Section 5.2 but referenced nowhere else. For the plan author, having them in a dedicated "Constants / Configuration" subsection (perhaps as a table with name, value, and rationale) would be easier to reference. This is a minor readability concern.
