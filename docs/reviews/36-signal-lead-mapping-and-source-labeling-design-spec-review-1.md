---
artifact: specs/36-signal-lead-mapping-and-source-labeling-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.1
date: 2026-06-14
round: 1
---

## Context

Review was grounded by reading the actual code the spec cites (backend `app/services/signals/*`, `app/services/leads/*`, `app/routers/signals.py`, `prompts/signals/*`; frontend `features/strategist/types.ts`, `features/connectors/lib/leadSource.ts`, `features/customers/components/lead-stream/LeadStream.tsx`, `features/signals/*`, `shared/api/*`). Findings below distinguish "spec claim vs. verified code reality" where it matters.

Overall: this is a well-structured, appropriately MVP-scoped spec. Its acceptance criteria are concrete and testable, its non-goals are crisp, the per-(org,user) cache-keying insight is correct, and the overengineering risk is low (the reserved source values are the only mild gold-plating, and they're explicitly deferred). The problems below are concentrated in (a) one false assumption about a target frontend surface, and (b) several mischaracterizations of which existing backend code provides which capability.

## Findings

### [Critical] Feature #1 LeadStream surface (AC #7) and Feature #2 LeadStream badges (AC #6) target a mock-data surface with no API wiring

**Location:** §3 "Frontend" (lines 136-138, *"features/customers/components/lead-stream/LeadStream.tsx renders the lead table"*); §2 AC #6 (lines 86-88) and AC #7 (lines 89-91); §5.7 Surface A (lines 293-295); §6.3 (lines 335-346).

`features/customers/components/lead-stream/LeadStream.tsx` does not fetch leads from the backend. It renders a hardcoded `mockLeads` array (file lines ~69-252), with `const hasProspectData = true` hardcoded (~line 493) so the empty state never shows. There is no TanStack Query call, no `get_leads_for_org`, and the local `Lead` interface (lines 49-60) has a `source?: string | null` but **no `signals` field**, and the mock objects don't even set `source`. This breaks the spec's stated deliverables in two ways:

- **AC #7 ("customers/LeadStream shows per-lead 'N relevant signals', expandable")** cannot be met against mock data: the mapping returns real Neo4j `lead_id`s, but mock rows carry mock ids that will never match, so `signalsForLead(leadId)` returns nothing for every row.
- **AC #6 ("each lead row shows a source badge", filtering across live values)** also presupposes real lead data carrying the stamped `source`; mock rows have none.

The spec treats LeadStream as a live-data surface throughout (§3, §5.7, §6.3) and never mentions that wiring real lead data — with stable ids that join to the mapping — is a prerequisite. This is either a hidden, unscoped chunk of work (wire LeadStream to `get_leads_for_org`) or the feature is unshippable as written. The spec must explicitly state the prerequisite (and decide whether it's in or out of scope), or move the surfaces to a surface that already consumes real leads.

### [High] `signal_ask_claude` is mischaracterized as the structured-output + cache reference template

**Location:** §3 line 121-122 (*"signal_ask_claude is the closest existing template: read org signals + customer profile + a question → one Claude call → structured answer."*); §5.2 line 188 (*"modeled on ask.py (signal_ask_claude) + search.py::run_signals_research"*), step 5 (lines 205-206), step 6 (lines 207-209).

Verified code reality (`app/services/signals/ask.py`):

- `signal_ask_claude` returns **plain text** (it joins Claude `content` text blocks at `ask.py:285-288`), **not structured JSON**. It is therefore not a template for "one Claude call → structured `mapping[]` JSON." The closest structured-JSON-from-Claude template is `search_signals`/`run_signals_research` (which is the path that actually uses `_extract_research_json`).
- `signal_ask_claude` has **no refresh flag and no cache**. Its `_reserve/_finalize_claude_signal_budget` pair is a token/rate budget mechanism, not a cache-or-compute pattern.

§5.2 step 6 instructs reusing "`_extract_research_json` (the same mechanism `signal_ask_claude` uses)" — but `signal_ask_claude` does not use it; `search_signals` does. The spec repeatedly anchors an implementer on `ask.py` for capabilities that live in `search.py`. A plan-writer following this guidance literally would look in the wrong file for JSON parsing and caching. Fix the citations: point JSON extraction at `search.py`/`parsing.py`, and stop crediting `ask.py` with a cache it lacks.

### [Medium] Proposed service signature carries an irrelevant Qwen `agent_chain` and mirrors neither sibling

**Location:** §5.2 line 192-194 (*"`build_signal_lead_map_claude(driver, mongo, agent_chain, request)` steps (signature mirrors the other signals services)"*).

Verified signatures:
- `run_signals_research(driver, mongo, pc, agent_chain, request)` — has both `pc` and `agent_chain` (the Qwen LangChain agent).
- `signal_ask_claude(driver, mongo, pc, request)` — **no `agent_chain`**, has `pc`.
- Proposed: `(driver, mongo, agent_chain, request)` — has `agent_chain`, **no `pc`**.

The proposed signature mirrors neither. It correctly drops `pc` ("Pinecone not used") but keeps `agent_chain`, which is the Qwen agent chain — dead weight in a Claude-only path (the spec itself says §5.1 "Claude-backed only … no Qwen sibling"). The real Claude sibling (`signal_ask_claude`) takes no `agent_chain`, so the router would have to inject `get_agent_chain` for an unused dependency. Drop `agent_chain` to match `signal_ask_claude`.

### [Medium] The fingerprint cache is presented as mirroring existing patterns that have no fingerprint

**Location:** §2 Goals line 65-66 (*"reuse … the cache-or-compute `refresh` pattern of `run_signals_research`"*); §5.2 step 1 (lines 195-197); §5.4 line 259-260 (*"Cache-or-compute mirrors `run_signals_research`'s `refresh` flag; the derived-doc pattern mirrors `signal_track`."*).

Verified reality:
- `run_signals_research`'s cache is `_get_latest_signal_for_user_agent` — a `find_one({"user_id", "agent"}, sort=[("timestamp",-1)])` latest-write lookup (`persistence.py:45`). There is **no content/input fingerprint**; it returns the newest signal regardless of input change.
- `signal_track` is a headline-dedup doc (`_id=track_key`, `$addToSet headlines`) — also not a fingerprint cache.

So the `sorted(signal_ids)+sorted(lead_ids)` fingerprint in §5.4 is a **new** design, not a reuse. Labeling it "mirrors run_signals_research / signal_track" is misleading and could make an implementer think fingerprint invalidation is an established repo pattern (it isn't). State plainly that the fingerprint is novel, and that unlike `run_signals_research` it invalidates on input-set change.

### [Medium] CLAUDE_API_KEY check "lives in the router (same as the other `_claude` endpoints)" — there is no single pattern to mirror

**Location:** §5.1 lines 183-184.

Verified (`app/routers/signals.py`): the two existing `_claude` endpoints use **different** patterns. `generate_signals_batch_claude` checks `CLAUDE_API_KEY` in the **router** and raises `HTTPException(500)` (`signals.py:58-60`). `signal_ask_claude` checks it in the **service** and raises `ServiceError` (`ask.py:179-180`), and notably does **not** depend on `get_agent_chain`. The spec's "same as the other `_claude` endpoints" implies a uniform convention that doesn't exist. Pick one explicitly (router-level `HTTPException` is the more consistent choice and matches AC #4's "never 500" intent only if the check is *presence*, not *call* failure — see the resilience finding below).

### [Medium] Blast radius: `filterLeadsBySource` / `LEAD_SOURCE_OPTIONS` are also consumed by market-research `LeadsTable.tsx`

**Location:** §6.3 (lines 335-346); §6.4 (lines 349-353, which only calls out the LeadStream behavior change).

Verified: `filterLeadsBySource` and `LEAD_SOURCE_OPTIONS` (in `features/connectors/lib/leadSource.ts`) have a **second** consumer beyond LeadStream — market-research `LeadsTable.tsx` imports both and applies the same source filter + `Select` (its lines ~53-58, ~530, ~605-611). Changing `LEAD_SOURCE_OPTIONS` to add `manual`/`unknown` and switching `filterLeadsBySource` from catch-all to exact match will alter that surface's dropdown and filtering too. The spec scopes the FE change to "customers/LeadStream" and its behavior-change note (§6.4) mentions only LeadStream. Either acknowledge and accept the market-research change (and add it to AC #6 / the test plan), or scope the lib change so it doesn't leak. Also note: `shared/lib/leadData.ts`'s `HeatmapLead.source` is typed as a **required** `"HubSpot" | "Prospect List"` union — those legacy mock values now normalize to `unknown`, which the test plan should cover.

### [Medium] Feasibility/cost of "one Claude call over the whole org" at the stated input bounds is unanalyzed

**Location:** §5.2 step 2 (limit=50 signals), step 3 (limit=100 leads), step 5 ("one Claude call"); AC #1 (lines 72-75); §1 line 16 (*"one computation"*).

The design pillar is a single Claude call mapping up to **50 signals × 100 leads** = up to ~5,000 (signal, lead) relevance judgments in one response. The spec cites `_claude_budget` as the call path but never validates that the prompt + expected JSON output fits the budget at those bounds, nor what happens to output quality/completeness when Claude must emit a `mapping[]` with up to 50 entries each carrying a `leads[]` list. At MVP/0 users a partial/lossy mapping is tolerable, but the spec asserts "one call over the whole org" as if it's obviously feasible. Add at least a sentence on expected token volume vs. the budget, and a defined degradation behavior if Claude truncates the JSON (currently only "parse → drop invented ids" is specified, which doesn't cover a structurally-truncated mapping).

### [Medium] Two independent features bundled in one spec/plan; they share no code path

**Location:** §1 lines 22-24 (*"Both features enrich the same entity (Lead) and are small enough to share one spec and one implementation plan."*); §9 (lines 396-400).

Feature #1 (read-time LLM mapping + disposable cache + two FE surfaces) and Feature #2 (source taxonomy stamping + filter/badge) share no code path, no data model, and no risk profile. The coupling rationale ("both enrich Lead") is weak — it would justify bundling most lead-touching features. Feature #2 is small/low-risk and could ship independently; Feature #1 is the substantive, riskier piece. Bundling them muddies review depth and sequencing, and forces one plan to interleave two unrelated task streams. The spec's own commit guidance (§9: "separate commits otherwise") partially mitigates this at commit granularity, but the spec/plan split is still one-for-one. Consider at minimum phasing the plan so Feature #2 lands first and independently.

### [Medium] "Stays live as leads and signals change" is only true within the newest-50-signals window

**Location:** §1 lines 45-46 (*"recovers that linkage at read time … so it stays live as leads and signals change"*); §5.2 step 2 (line 198-200, `limit=50`).

`fetch_signals(..., limit=50, offset=0)` maps only the **50 most recent** signals for a user. An org/user with >50 signals will never have signals #51+ mapped, so the "Affects N leads" counts are silently incomplete for older signals, and the LeadStream "N relevant signals" can miss relevance carried by older signals. The spec frames read-time compute as a completeness win over generation-time linkage but doesn't note this cap. Either state the windowing as an accepted limitation (with the limit choice justified), or paginate/iterate. Low impact at MVP volume, but it should be a stated assumption, not an unstated one.

### [Low] Lossy error semantics: Claude failure is indistinguishable from a genuine empty mapping

**Location:** §5.6 (lines 273-278); §2 AC #4 (lines 81-83).

AC #4 / §5.6 mandate that a Claude failure (after retries) returns `{status:"success", data:{mapping:[]}}` — never 500. This is a defensible degraded-mode choice (don't break the leads list / signals feed), but it overloads `status:"success"`: a real "no relevant signals" and a "the model is down" are byte-identical to the consumer, and no `cached`/error flag distinguishes them. Acceptable at 0 users; worth a one-line acknowledgment that the mapping has no out-of-band failure signal, so debugging "why is everything empty?" requires server logs.

### [Low] FE hook `useSignalLeadMap(orgId)` omits `user_id` though the cache is keyed per-(org,user)

**Location:** §5.7 line 289-290 (`useSignalLeadMap(orgId)`); §5.4 line 244-250 (cache keyed `<org_id>:<user_id>`).

The service call is `fetchSignalLeadMap(userId, orgId, {refresh})`, and the Mongo doc is keyed `<org_id>:<user_id>`, but the hook signature only takes `orgId`. The hook presumably resolves `userId` from `AuthContext`, but the TanStack Query `queryKey` should then include `userId` (not just `orgId`) or two users sharing a machine/session would collide on query cache. Specify where `userId` comes from and that it's part of the queryKey.

### [Low] Per-user mapping against org-wide leads is assumed-correct but not interrogated

**Location:** §5.4 (lines 244-251).

The spec correctly notes that keying by org alone would let two users overwrite each other's cache, and resolves it by keying per-(org,user). But the deeper semantic question is unasked: because signals are **user-scoped** (verified: `fetch_signals` filters `{"user_id": user_id}`) while leads are **org-scoped**, two users in the same org get *different* signal sets mapped against the *same* leads — so "which of my leads does this signal affect?" yields different answers depending on who asks. That may be intended (signals are personal), but it's a real modeling quirk for a feature pitched as org-level lead enrichment. State whether per-user signal scoping is the intended semantics for this feature, or whether signals should be read org-scoped here.

### [Low] No concurrency guard on a cache miss

**Location:** §5.2 step 1 + step 7.

Two concurrent `refresh=false` calls on a cold/invalid cache will both pass the fingerprint check and both fire a Claude call (no lock/`setnx`/inflight de-dup). Fine at 0 users, but the spec's resilience section is otherwise thorough; a one-liner acknowledging the double-spend-on-miss would make the cache design complete.

### [Nit] Reserved source values (`hubspot`/`salesforce`/`excel`) are mild gold-plating

**Location:** §6.1 table (lines 314-316); §6.1 lines 318-321.

Spelling out reserved-but-unproduced values is cheap and defensible, but `excel` in particular is reserved for a "future, if Excel is split from generic file upload" — a split that isn't planned. This is the only place the spec drifts toward speculating about futures. Harmless; flagged only for the overengineering checklist.

### [Nit] `headline` echo in the response duplicates data already in the signals feed

**Location:** §5.3 lines 225-226 (*"headline": "…", // convenience echo for the signal view"*).

The mapping response echoes each signal's `headline` "for the signal view," but the Signals page already holds the full signal objects (incl. headline) from `fetchSignals`. The LeadStream surface is the only consumer that genuinely benefits (it shows signal headlines without re-fetching the feed). Minor redundancy; either justify it per-surface or drop it and let the FE join on `signal_id`.

### [Nit] Prompt quotes in "Key finding" are paraphrases, not verbatim

**Location:** §1 lines 38-43.

The quoted instructions ("Prioritize signals that relate to companies/industries/regions in your leads pipeline", "If a signal mentions a company or organization, check if it matches any entity in your leads data") are close paraphrases of the `{{signal_label}}`-templated text in `prompts/signals/signals_leads_section.md.j2` (actual: "…or any other attributes found in your leads pipeline"). Substantively correct; just not verbatim, and the template renders "ICP signal" for the profiler persona, not always "signal."

### [Nit] §6.2 "make explicit if currently implicit" — batch source is absent, not implicit

**Location:** §6.2 line 326-327.

The CSV/batch path (`batch_upload_leads` in `app/services/leads/orchestrator.py`) doesn't set `source` *implicitly* — it doesn't set it at all (verified). Phrasing it as "make explicit if currently implicit" understates the change (it's a new assignment, not a refactor of an implicit one). Similarly, `create_lead` (manual) sets no source today, so §6.2's "set `source = "manual"`" is also a net-new assignment.
