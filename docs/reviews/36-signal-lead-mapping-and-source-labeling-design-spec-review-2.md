---
artifact: specs/36-signal-lead-mapping-and-source-labeling-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.1
date: 2026-06-14
round: 2
---

## Context

Round 1 was grounded against the code and landed one Critical (LeadStream is a
mock-data surface) and one High (`signal_ask_claude` mischaracterized as the
structured-output/cache template). The revised spec addresses both — §1's new
"Surface reality" section explicitly scopes the LeadStream rewire (§5.7 A2,
§6.3), and §3 now correctly attributes JSON extraction to the `search_signals`
path and `_extract_research_json`, with `ask.py` retained only for the
`_claude_budget` call mechanism and the customer-profile helper. The other
round-1 findings (signature, fingerprint-as-novel, API-key pattern, blast radius
to market-research, cost/token bounds, windowing, lossy-empty, hook queryKey,
per-user semantics, concurrency, reserved-value gold-plating, headline echo,
paraphrase quotes, "net-new" framing) are all visibly resolved.

This round re-verified the spec's code claims against the current tree (29
checks; all TRUE or PARTIALLY TRUE, none FALSE). Findings below are new or
residual — concentrated in two algorithm/factual points that survived round 1
(fingerprint step-ordering; the `_claude_budget` "shared mechanism" claim), a FE
typing gap the otherwise-thorough §6.3 misses, and a set of Low/Nit precision
issues.

## Findings

### [Medium] Fingerprint computation is described in step 1 but depends on fetch results from steps 2–3

**Location:** §5.2 step 1 (lines 225-227); §5.4 (lines 296-300, *"Fingerprint =
stable hash of `sorted(signal_ids) + sorted(lead_ids)` from steps 2–3"*).

The numbered service steps list **cache check + "compute current fingerprint"
as step 1**, before **fetch signals (step 2)** and **fetch leads (step 3)**. But
the fingerprint is defined as a hash of the signal ids and lead ids produced by
those very fetches — so step 1 cannot compute the current fingerprint until
steps 2–3 have run. As written the sequence is self-contradictory. The actual
feasible flow is: fetch signals/leads → compute fingerprint → compare to cached
→ on match+`!refresh` return cached mapping (skip the Claude call) → else
recompute.

This also carries an unstated cost the spec implies away: even a **cache hit**
must perform both fetches (50 signals + 100 leads) to compute the fingerprint it
then matches against the cache. The spec presents step 1 as a cheap pre-fetch
gate ("return cached mapping with `cached: true`") without acknowledging that a
hit is never read-free — it skips only the Claude call, not the DB reads. Fix
the step order, and state that the cache optimizes out the LLM call, not the
input fetches.

### [Medium] `_claude_budget` is *not* "the call mechanism the batch Claude path uses"

**Location:** §5.2 step 5 (lines 236-238, *"make **one** Claude call via the
`_claude_budget` path (the call mechanism `signal_ask_claude` and the batch
Claude path both use)"*).

Verified against code: the budget functions
(`_reserve/_finalize_claude_signal_budget`, `_estimate_token_count` in
`app/services/_claude_budget.py`) are used **only** by `signal_ask_claude`
(`ask.py:253-334`). The batch `_claude` path
(`generate_signals_batch_claude` → `search_signals` →
`signals.llm._signals_agent_output` → `_llm_helpers._research_agent_output` →
`_llm_helpers._claude_messages_text`) does its own raw `messages` HTTP POST via
`os.getenv("ANTHROPIC_API_KEY")` and never calls the budget
reserve/finalize pair. So the parenthetical "the batch Claude path both use" is
false.

The design intent is still sound and feasible — combine `_claude_budget` (from
`ask.py`) for the call with `_extract_research_json` (from the search/batch
path) for parsing; that's a novel but coherent composition. But the spec should
not claim these are a shared mechanism. A plan-writer told the batch path uses
`_claude_budget` would look in `batch.py`/`search.py` for a budget call that
isn't there. State plainly that the new endpoint composes two functions that
live on **different** existing paths (call mechanism from `ask.py`, JSON
extraction from `search.py`/`parsing.py`).

### [Medium] `HeatmapLead.source` type change (and the `LeadSource` vs `LeadSourceFilter` type split) is unspecified

**Location:** §6.3 (lines 393-407); `shared/lib/leadData.ts:12`.

`HeatmapLead.source` is a **required** `"HubSpot" | "Prospect List"` union
(`shared/lib/leadData.ts:12`), and the 40 sample rows hardcode those two values
(lines 58-359). §6.3 instructs the market-research mapper to stop hardcoding
`"Prospect List"` and instead assign `normalizeLeadSource(...)` output — but
`normalizeLeadSource` returns `"apollo" | "csv" | "manual" | "unknown"`, none of
which are members of `HeatmapLead.source`. Assigning it will not typecheck, so
the `HeatmapLead.source` type **must** be widened/retyped, and that edit is not
listed in §6.3. (Preflight `tsc` would force the fix, but the spec prides itself
on code-grounding and should name the change.)

Related under-specification: §6.3 introduces `normalizeLeadSource(raw):
LeadSource` without defining `LeadSource` or its relationship to
`LeadSourceFilter`. Define the split explicitly — e.g. `LeadSource = "apollo" |
"csv" | "manual" | "unknown"` (a lead's actual normalized source) and
`LeadSourceFilter = "all" | LeadSource` (the dropdown) — so the FE typing is
unambiguous.

### [Low] LeadStream rewire (§5.7 A2) is silent on the existing `filterByICP` behavior and on pagination

**Location:** §5.7 Surface A2 (lines 345-349).

`LeadStreamPanel` currently filters `mockLeads` by `filterByICP` against a
`matchedICP` field (`LeadStream.tsx:498-506`) and gates its empty state behind
hardcoded `hasProspectData = true` (line 493). §5.7 A2 says "replace `mockLeads`
… add `id` … restore the real empty state" but does not address (a) whether the
`filterByICP`/`matchedICP` capability survives the rewire — real leads from
`GET /api/v2/leads` do not carry `matchedICP`, so the prop's current behavior
silently disappears; and (b) how the surface paginates real leads (page size,
load-more) given the feed is now a paginated endpoint, not a flat array. Today
both are mock-only, so this is a scoping question rather than a live regression,
but the rewire will silently drop/alter the ICP filter unless the spec says
whether to preserve, rework, or remove it.

### [Low] "Share no code path" is overstated — both features touch the customers/LeadStream surface

**Location:** §1 (lines 22-25, *"They share no code path"*); §9 (lines 470-471,
*"Feature #2 … lands first and independently; Feature #1 … second"*); §6.3
(line 406-407) vs §5.7 A2.

The two features do share one component surface: customers/LeadStream's source
badge/filter is a Feature #2 deliverable (§6.3) that only becomes *real* once
Feature #1 rewires LeadStream to real leads (§5.7 A2, which lands second). So
if Feature #2 ships first, LeadStream carries badge/filter logic against mock
rows with no source — everything renders "unknown" until Feature #1 lands. The
phasing still works (market-research LeadsTable already has real data, so
Feature #2 is genuinely independent there), but the blanket "share no code path"
should be qualified: they are independent on the data/contract layer but share
the LeadStream component, whose Feature #2 changes are inert pending Feature #1.

### [Low] §3 enumerates `"csv"` as a stored `Lead.source` value, contradicting §6.2's "net-new assignment"

**Location:** §3 line 149 (*"`Lead.source` ∈ `{"apollo", "csv", null}`"*); §3
lines 152-154 and §6.2 (lines 377-382).

Verified: the only `source` ever written to a `Lead` node today is `"apollo"`
(the connector ingestion `coalesce` default); `batch_upload_leads` and
`create_lead` set none (claims 7-9 verified TRUE). So the real stored set is
`{"apollo", null}` — `"csv"` is a **frontend filter bucket**, never persisted.
§6.2 correctly frames `source = "csv"` as a net-new assignment, but §3 line 149
still lists it as a current stored value, an internal inconsistency left after
round 1's framing fix. Correct §3 to `{"apollo", null}` (stored) and note
`"csv"` is a FE-only bucket today.

### [Low] "Degrade silently on empty/loading" does not cover the missing-key 500 (error state)

**Location:** §5.7 (line 353, *"All surfaces degrade silently on empty/loading
mapping"*); §5.1 (lines 212-216); AC #4 (lines 98-100).

A missing `ANTHROPIC_API_KEY` returns HTTP 500 (§5.1), which TanStack Query
surfaces as an **error**, not "empty/loading." The degradation note covers the
`mapping: []` success path and the loading state but is silent on the 500/error
path the surfaces must also absorb. Implicitly handled (error → `data`
undefined → selectors return nothing → quiet), but the spec should say surfaces
degrade on empty/loading/**error** to be complete, since §5.1 explicitly carves
out a 500 that the success-degradation note omits.

### [Low] `_extract_research_json` is defined in `_llm_helpers.py`, not `parsing.py`

**Location:** §5.2 step 6 (lines 239-240, *"extract JSON via `parsing.py`'s
`_extract_research_json`"*); §3 (lines 138-139).

`_extract_research_json` is **defined** in `app/services/_llm_helpers.py` and
**imported** by `parsing.py` (which calls it inside `_parse_search_signals_response`).
Describing it as "parsing.py's" helper overstates ownership — it's a shared
LLM-helper living in `_llm_helpers`. Minor, but an implementer looking to extend
it (e.g., for the truncated-prefix tolerance in step 6) should edit
`_llm_helpers.py`, not `parsing.py`. Cite the true owner.

### [Low] The 50-signal window interacts with the Signals page "Affects N leads" but the link isn't made explicit

**Location:** §5.7 Surface B (lines 350-352); §5.2 step 2 (lines 228-231,
windowing).

The Signals feed (`GET /fetch-signals`) is paginated and can hold >50 signals;
the mapping only ever covers the newest 50. Signals beyond the window have no
`mapping[]` entry, so Surface B renders "Affects N leads" = 0 (quiet) for them —
even if they genuinely touch leads. The windowing limitation is acknowledged in
§5.2/§5.6, but the cross-reference to Surface B (and to the per-lead "N relevant
signals" surfaces, which conversely can only ever show the newest-50 signals'
relevance) is not drawn. State that all four mapping-driven surfaces are bounded
by the 50-signal window so the "quiet when zero" behavior isn't mistaken for "no
relevance."

### [Low] Market-scoring scoring loop lives in `scoring.py`, not `orchestrator.py`

**Location:** §3 line 158 (*"scores leads read via `get_leads_for_org`
(`market_scoring/orchestrator.py`)"*); §6.2 (lines 384-387).

The actual per-lead scoring loop is `_run_market_scoring_for_org` in
`market_scoring/scoring.py` (`get_leads_for_org` at `scoring.py:63`);
`orchestrator.py` calls `get_leads_for_org` only inside `get_market_scores_status`
for the progress counter (`orchestrator.py:166`). For the `source` passthrough
this is moot (the row builder `_lead_to_score_row` is correctly placed in
`normalization.py`, §6.2), but §3's attribution of scoring to `orchestrator.py`
should point at `scoring.py`.

### [Low] `create_lead` "respect an explicit value if given" may assume API surface that doesn't exist

**Location:** §6.2 (lines 379-381, *"set `source = "manual"` when the caller did
not supply one (respect an explicit value if given …)"*).

`create_lead` (`persistence.py:54-91`) sets no `source` today and the spec
proposes defaulting to `"manual"`. "Respect an explicit value if given" presumes
a caller can pass a `source`, but it's unclear whether the manual-create request
model already exposes an optional `source`. If it doesn't, the
"respect-explicit" clause is inert and adding the optional param is itself
net-new API surface the spec should name (or drop the clause and just always
stamp `"manual"` on the manual path).

### [Nit] No explicit acceptance criterion for the LeadStream rewire-to-real-data or for the windowing behavior

**Location:** §2 AC (lines 87-109).

AC #6/#7 cover LeadStream's source filter + per-lead signals, but not the
prerequisite deliverable that LeadStream now renders real leads from
`GET /api/v2/leads` with a restored empty state (the core of §5.7 A2). Likewise
the >50-signal window is acknowledged narratively but has no AC stating signals
beyond the newest 50 are not mapped. Both are testable; adding them would close
the gap between the stated surfaces and the acceptance list.

### [Nit] AC #1's entry shape omits the `headline` echo field

**Location:** §2 AC #1 (lines 89-92); §5.3 (lines 256-268, includes `headline`).

AC #1 enumerates the mapping entry fields as `signal_id` + `leads[]{lead_id,
company, relevance, why}` but not the `headline` convenience echo that §5.3
includes and §5.3 (lines 275-277) justifies for the per-lead surfaces.
Harmless — the AC lists essential fields — but a strict reader could read the AC
as the authoritative shape and omit `headline` from the zod contract. Either add
`headline` to AC #1 or note it as optional.
