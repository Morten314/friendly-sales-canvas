---
synthesizes_review: docs/reviews/36-signal-lead-mapping-and-source-labeling-design-spec-review-1.md
artifact: specs/36-signal-lead-mapping-and-source-labeling-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-15
round: 1
---

## Round Recommendation

yes

Reason: The Critical finding (LeadStream is a mock-data surface) is agreed and its resolution opens new design surface — a real-lead-table prerequisite with a scope decision the user must make — that should be re-reviewed once the spec is revised.

## Agreed Findings

(Each line is the revision being made.)

- **[Critical] The spec targets the WRONG lead surface — partially agreed, with a correction.** Verified by reading both components in full + the backend:
  - **customers/LeadStream (`LeadStreamPanel`)** — the surface the spec explicitly named (§3, §5.7-A, §6.3) — is **pure mock**: renders `mockLeads`, `hasProspectData = true` hardcoded, props are only `{filterByICP, onClearFilter}` (no `leads` prop), ids are `c1`/`1…12`, the mock rows never set `source`, and the `Lead` interface has no `signals` field. **Confirmed: cannot support either feature's real-data surfacing.**
  - **market-research/LeadsTable** — **NOT mock** (correcting my earlier synthesis claim). `baseLeads = apiHeatmapLeads ?? heatmapLeads`: it renders **real Live-API data** from `POST /leads/market-scores` (sample only as fallback, with a visible "Live API"/"Sample data" badge). Crucially, the real rows carry the **real Neo4j `lead_id`** (`mapMarketScoresRowToHeatmapLead` → `id: String(row.lead_id)`), and the backend scores leads read via `get_leads_for_org` (`market_scoring/orchestrator.py:166`) — **same id space as the mapping, so the join is valid.** However, `source` is **hardcoded `"Prospect List"`** in the FE mapper and is **absent from `LeadMarketScoreRow`** — so the source badge/filter is not real here without a backend+mapper change.
  - **Revision:** re-target Feature #1's per-lead "N relevant signals" surface from customers/LeadStream → **market-research LeadsTable** (real lead_ids already join). Keep the Signals-page "Affects N leads" surface (works regardless). For Feature #2, add a `source` field to `LeadMarketScoreRow` (read from the Neo4j lead) + preserve it in the FE mapper, so the badge/filter is real on LeadsTable. Treat customers/LeadStream as out-of-scope mock (its filter/badge stays cosmetic until it is wired to real leads — own spec). *Pending user confirmation of target surfaces — see Open Questions.*
- **[High] `signal_ask_claude` mischaracterized as the structured-output + cache template.** Verified: `ask.py` joins Claude content blocks into plain text, has no cache/refresh, and does not call `_extract_research_json`. Revise §3 and §5.2: point JSON extraction at `parsing.py` (`_extract_research_json`, as used by `search_signals`); name the `search_signals`/batch-Claude path as the structured-JSON template; keep `_claude_budget` as the shared Claude-call mechanism (genuinely used by both `ask` and `batch`); stop crediting `ask.py` with a cache.
- **[Medium] Service signature carries an irrelevant `agent_chain`.** Verified: the real Claude sibling `signal_ask_claude(driver, mongo, pc, request)` takes no `agent_chain`. Revise §5.2 to `build_signal_lead_map_claude(driver, mongo, request)` (drop both the unused Qwen `agent_chain` and the unused `pc`); router does not depend on `get_agent_chain`.
- **[Medium] Fingerprint cache presented as mirroring existing patterns.** Verified: `run_signals_research` uses a latest-write lookup (no fingerprint); `signal_track` is headline-dedup. Revise §2/§5.4 to state the `sorted(signal_ids)+sorted(lead_ids)` fingerprint is a **new** design; what is reused is the derived-doc storage idea and the `refresh`-flag concept, not fingerprint invalidation.
- **[Medium] CLAUDE_API_KEY "same as the other `_claude` endpoints" implies a convention that doesn't exist.** Verified: batch checks in the router (`HTTPException(500)`); ask checks in the service (`ServiceError`). Revise §5.1 to pick one explicitly — router-level **presence** check raising `HTTPException(500)` — and clarify this is a config-presence error (deploy-time), distinct from AC #4's runtime model-failure degradation.
- **[Medium] Blast radius: shared lib also feeds market-research `LeadsTable.tsx`.** Verified second consumer. Revise §6.3/§6.4 to acknowledge `LeadsTable.tsx` (and accept the dropdown/filter change there), add it to AC #6 + the test plan, and cover `HeatmapLead.source` ("HubSpot"/"Prospect List") normalizing to `unknown`.
- **[Medium] Feasibility of one Claude call over 50×100 is unanalyzed.** Revise §5.2/§5.6 to add a token-volume-vs-`_claude_budget` note, clarify 50×100 is the **cap** (typical orgs far smaller at MVP), and define truncation degradation (tolerate a structurally-truncated `mapping[]` by using the valid parsed prefix, in addition to dropping invented ids).
- **[Medium] Two independent features bundled.** *Partial* — see Disagreed/Severity. Agreed portion: revise §1/add to §9 that the **plan** will phase Feature #2 (small, low-risk) to land first and independently of Feature #1.
- **[Medium→Low] "Stays live" only true within the newest-50-signals window.** Verified (`fetch_signals(..., limit=50)`). Revise §1/§5.2 to state the windowing as an accepted assumption (signals #51+ unmapped) and justify `limit=50` as a token bound. (Severity Low — see Severity Disagreements.)
- **[Low] Lossy error semantics.** Revise §5.6 to acknowledge that an empty mapping carries no out-of-band failure signal (model-down vs genuinely-empty are byte-identical to the consumer; debugging relies on server logs).
- **[Low] Hook omits `user_id` though cache is per-(org,user).** Revise §5.7 to specify `userId` is resolved from `AuthContext` and included in the TanStack `queryKey` (not just `orgId`).
- **[Low] Per-user signals vs org-wide leads not interrogated.** Revise §5.4 to state explicitly that per-user signal scoping is **intended** (the mapping reflects the signals this user sees in their own feed; it mirrors the user-scoped feed), not an oversight.
- **[Low] No concurrency guard on cache miss.** Acknowledge in §5.6 (two concurrent cold calls double-spend); the fix is deferred (see Deferred).
- **[Nit] Reserved source values are mild gold-plating.** Drop `excel` (no planned split; file upload = `csv`); keep `hubspot`/`salesforce` reserved, tied explicitly to the user's named future sources.
- **[Nit] `headline` echo duplicates feed data.** Revise §5.3 to justify the echo for the per-lead surface (which doesn't hold the full feed) and note the Signals page may instead join on `signal_id`.
- **[Nit] "Key finding" quotes are paraphrases.** Revise §1 to mark them as paraphrase and note the template renders "ICP signal" for the profiler persona.
- **[Nit] §6.2 "make explicit if currently implicit" understates the change.** Verified: `batch_upload_leads` sets no `source` at all; `create_lead` likewise. Reword §6.2 as net-new assignments.

## Disagreed Findings

- **[Medium] Split the two features into separate specs.** Disagree with *splitting the spec*: the user explicitly requested one spec covering both ("lets create a spec for 1… 2…"). The coupling rationale in §1 is admittedly thin, but the remedy that respects the requirement is plan-level phasing, not a spec split. The agreed mitigation (phase the plan so Feature #2 ships first/independently) addresses the reviewer's real concern (review depth, sequencing, interleaved task streams) without overriding the user's explicit framing. Spec stays unified.

## Deferred Findings

- **[Low] Concurrency guard (inflight de-dup / `setnx` lock) on cache miss.** Correct that two concurrent cold-cache calls double-spend a Claude call. Deferred: at 0 users it cannot occur; a lock adds complexity disproportionate to MVP. Spec will *acknowledge* the double-spend-on-miss now; implementing the guard is the deferred item. Trigger: real concurrent users on the same (org,user) cache key, or observed duplicate-spend in logs.

## Severity Disagreements

- **[Medium → Low] "Stays live" newest-50 windowing.** Agree with the finding; severity is Low, not Medium. The reviewer's own note ("Low impact at MVP volume") concedes this; it is a stated-assumption gap with no functional break at current volumes.
- **[Medium → Low] Two features bundled.** Agree there is a coupling-quality concern; severity is Low, not Medium. It is a deliberate, user-requested framing, already mitigated by §9's separate-commit guidance and (now) plan phasing; it introduces no correctness or feasibility risk.

## Open Questions

- **Surface-targeting decision (needs user input):** given customers/LeadStream is mock but market-research LeadsTable already renders real lead_ids, which surfaces does Feature #1's per-lead view + Feature #2's badge/filter target?
  1. **Re-target to market-research LeadsTable (recommended)** — Feature #1 per-lead "N relevant signals" lands on LeadsTable (real lead_ids join the mapping today); Feature #1 "Affects N leads" lands on the Signals page; Feature #2 adds `source` to `LeadMarketScoreRow` + FE mapper so the badge/filter is real on LeadsTable. customers/LeadStream stays mock/out-of-scope. Modest cross-stack lift, no new lead-list endpoint needed (reuses `POST /leads/market-scores`).
  2. **Also wire customers/LeadStream to real leads** — additionally bind `LeadStreamPanel` to real lead data (needs an FE-facing leads-list endpoint/hook). Larger; only worth it if the customers surface specifically must show signals/badges now.
  3. **Mock-free minimum** — ship only the Signals-page "Affects N leads" + Feature #2 backend stamping + `leadSource.ts` plumbing; defer all real-lead-table surfacing. Smallest.
  - Recommendation: option 1. Either way, AC #6/#7 and §3/§5.7/§6.3 must be rewritten to name LeadsTable (not customers/LeadStream) and to include the `LeadMarketScoreRow.source` addition.
- **Confirmed-resolved but recorded:** per-user signal scoping (vs org-scoped) for this feature is intended, not a bug — but if the product intent is org-level enrichment shared across users, that is a separate product decision.
