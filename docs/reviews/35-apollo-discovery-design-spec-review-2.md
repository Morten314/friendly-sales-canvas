---
artifact: specs/35-apollo-discovery-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-12
round: 2
---

## Context

Round 1 raised 21 findings (4 High, 8 Medium, 7 Low, 2 Nit). All High and most Medium findings have been substantively addressed: acceptance criteria added (§2), `replace` redesigned as a no-loss swap (§5.7), single-flight guard added (§5.9), warmup failure-isolation specified (§5.4), ICP-completeness gate added (§5.2 step 1, §5.5), stale-run threshold made proportional to `max_leads` (§5.3), LLM re-rank given an explicit rationale and deterministic fallback (§5.2 step 4), pipeline integration test added (§10), app-wide toast mechanism specified (§6.3), and `partial`/`completed_empty` FE behaviors documented (§6.4). This round focuses on gaps remaining after those revisions and new issues introduced by the changes.

## Findings

### [Medium] Apollo `organization_industry_tag_ids` requires a name→ID mapping that does not exist

**Location:** Section 5.2 step 1 — "`organization_industry_tag_ids` / `q_organization_keywords` ← `industry[]`"

The ICP stores free-text industry names (e.g., `"Healthcare"`, `"SaaS"`). Apollo's `organization_industry_tag_ids` filter accepts **numeric tag IDs** (e.g., `"87"` for Healthcare), not strings. The spec maps ICP `industry[]` to both filter keys and defers "exact Apollo filter keys" to the plan, but does not acknowledge that using `organization_industry_tag_ids` requires a name→ID lookup table that the system does not have. If the plan naively passes string names as tag IDs, Apollo silently ignores the filter and returns unfiltered results — burning credits on irrelevant candidates. **Suggestion:** either (a) explicitly scope MVP to `q_organization_keywords` only (keyword search, no ID mapping needed) and note `organization_industry_tag_ids` as a future optimisation, or (b) add "build/maintain an Apollo industry tag ID lookup" as a plan task with a defined source (Apollo's `/api/v1/industries` endpoint, if it exists, or a static mapping table).

### [Medium] `replace` mode hides all discovery leads from agent views before new leads arrive — user-visible count drop during swap window

**Location:** Section 5.7 — "while tagged, superseded leads are excluded from … agent views"

The no-loss swap correctly preserves data integrity, but the UX consequence is unaddressed: the moment the user confirms "Replace," all existing discovery leads vanish from Scout/Profiler (tagged `superseded`, excluded from views). New leads don't appear until the full pipeline completes (~1 min at 50 leads, ~3 min at 200). During this window the user sees zero Apollo leads in their agents. The spec's rationale ("so the user never briefly sees doubled leads") is valid, but the alternative problem (zero leads visible) deserves acknowledgment and a UX decision. **Suggestion:** either (a) keep `superseded` leads visible in agent views until the new leads commit (simpler — users see both briefly during the swap, which is the lesser evil for a ~1 min window), or (b) add a brief note to Section 6.4 or Section 8 acknowledging the visibility gap and stating it is acceptable at MVP.

### [Medium] `superseded`-tag orphan cleanup mechanism not designed

**Location:** Section 8 item 8 — "a startup / stale-run sweep clears orphaned `superseded` tags"

The risk section mentions a sweep to clean up orphaned `superseded` tags (left behind if the process is killed between tag and swap), but no design exists for when or how this sweep runs. It is not in Section 5 (backend design), Section 5.9 (endpoint surface), or Section 5.3 (run model). Without it, a killed replace run leaves discovery leads permanently hidden from agent views. **Suggestion:** add a brief design paragraph to Section 5 — e.g., "On application startup and on each `POST /discover`, query for runs with status `processing` past the stale threshold that have leads tagged `superseded`; clear the tags and set the run to `failed`." This can be plan-detailed but the trigger and scope belong in the spec.

### [Medium] `counts.matched` field in run doc is undefined

**Location:** Section 5.3 — run doc `counts` object

The `counts` object lists `matched` alongside `searched`, `qualified`, `selected`, `revealed`, `verified`, `unverified`, `created`, `skipped_duplicates`. Every other field maps clearly to a pipeline stage, but `matched` is never explained. Is it the number of `match_person` calls that returned a person (i.e., same as `revealed`)? Is it leads that matched an existing pool entry (i.e., duplicates found at the quality-gate stage)? The plan author cannot implement the counter without this definition. **Suggestion:** either define `matched` (e.g., "candidates for which `match_person` returned a non-null response") or remove it if redundant with `revealed`.

### [Low] `low_credit` clearing semantics on empty runs are ambiguous

**Location:** Section 5.6 — "cleared on the next run that reveals without a credit error"

If a run completes as `completed_empty` (0 leads revealed, 0 credit errors), does `low_credit` clear? The literal reading says yes (no credit error occurred), but an empty run reveals nothing and thus provides no signal about credit health. A user who hit credit exhaustion, then runs discovery with an overly narrow ICP that returns 0 search results, would see `low_credit` clear without ever confirming credits are available again. **Suggestion:** clarify — e.g., "cleared on the next run that successfully reveals ≥ 1 lead without a credit error," or note that an empty-run clear is acceptable because the only way to get 0 results with 0 errors is if no reveals were attempted (no credits spent), which is consistent with credit health.

### [Low] Cross-source dedup limitation not documented

**Location:** Section 5.2 step 3 — "Dedup vs. existing pool by Apollo person id ↔ stored `apollo_contact_id`"

Dedup keys exclusively on `apollo_contact_id`. CSV-imported leads have no Apollo ID, so a discovery lead who was previously imported via CSV will not be deduplicated — the user sees the same person twice. Acceptance criterion 2 says "on duplicates already in the pool" which over-promises. This is a reasonable MVP limitation (name/email dedup is its own complexity), but it should be acknowledged. **Suggestion:** add a one-liner to Section 5.2 step 3 or Section 8 noting that dedup is Apollo-ID-based only and CSV-sourced duplicates are not detected, or scope AC2 to "Apollo-ID-identifiable duplicates."

### [Low] Export endpoint's CSV format adds implementation surface for MVP

**Location:** Section 5.7 — "JSON; CSV via `format=csv`"; Section 5.9 — `GET /leads/export`

The export endpoint supports both JSON and CSV. CSV generation from nested lead data (company, title, email, email_status) requires field selection, header mapping, escaping, and testing — non-trivial for a defensive MVP feature whose primary purpose is download-before-replace. The spec already notes the set is small enough that pagination/streaming is unnecessary, which simplifies the JSON path. **Suggestion:** consider shipping JSON-only for MVP and adding CSV in a follow-up. The replace flow's safety guarantee (no-loss swap) makes the export less critical as a data-safety net.

### [Nit] AC4 wording is confusing

**Location:** Section 2, acceptance criterion 4 — "A `replace` run never leaves the pool with fewer leads than it created"

"Fewer leads than it created" reads as if the invariant is about the count relative to the new leads. The actual no-loss swap invariant is: the pool never has fewer leads than it had before the replace started. **Suggestion:** rephrase to "A `replace` run never reduces the pool below its pre-run lead count: prior discovery leads are removed only after new leads commit (no-loss swap, §5.7)."

### [Nit] `counts.errors` element type unspecified

**Location:** Section 5.3 — run doc `counts: { … "errors": [] }`

Every other field in `counts` is a numeric counter. `errors` is an array but its element type is not defined. Structured error objects (stage + message)? Plain strings? The plan author needs to know. **Suggestion:** add a brief note, e.g., "`errors: [{stage, message}]` — pipeline errors for debugging."

### [Nit] ICP fingerprint uses SHA-1 where a simpler comparison would suffice

**Location:** Section 5.7 — "`icp_fingerprint` = SHA-1 of a canonical JSON serialization"

SHA-1 is used for change detection between two ICPs the system already has in memory. A `json.dumps` comparison of the normalized fields would produce the same result without introducing a crypto dependency. SHA-1 is not wrong here (it's just a hash, not a security use), but it adds an unnecessary conceptual layer. **Suggestion:** either justify SHA-1 (e.g., "stored in the run doc for logging/audit, so a stable short key is preferable to storing the full normalized JSON") or simplify to direct comparison. This is purely a readability/maintenance nit.
