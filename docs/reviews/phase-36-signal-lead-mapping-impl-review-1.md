---
artifact: phase-36-signal-lead-mapping
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-15
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Branch-slug auto-discovery (`specs/phase-36-signal-lead-mapping.md`) does not match the actual filenames; both the spec (`specs/36-signal-lead-mapping-and-source-labeling-design.md`) and plan (`plans/36-signal-lead-mapping-and-source-labeling.md`) were located via the branch diff and read in full. Adherence was checked against both. Diff reviewed as aggregate (`git diff master...phase-36-signal-lead-mapping`, 53 files, +4890/-721), not commit-by-commit.

Spot-verified against the codebase (not inferred): `fetch_signals` is `async` returning `(items, total)`; `get_leads_for_org` and `_get_signal_ask_customer_profile` are sync (so their `asyncio.to_thread` wrapping is correct, not coroutine-returning); `_extract_research_json`/`_claude_messages_text` signatures match the call site; `apiPost(endpoint, body, schema)` arg order matches; the `_shared/final_answer_json_directive.md.j2` include resolves.

## Findings

### Low — Only the signal `headline` reaches the LLM, yet the prompt matches on "company mention in the signal"

**Location:** `backend/app/services/signals/lead_map.py` (`_signals_for_prompt`) + `backend/prompts/signals/signals_lead_map.md.j2` (MATCHING RULES)

`_signals_for_prompt` serializes only `{signal_id, headline}` per signal. The prompt's MATCHING RULES, however, instruct the model to match on "an explicit company mention in the signal" — those mentions live in `description` / `snippet` / `sourceLabel`, none of which are supplied. The model is therefore restricted to headline-only matching, which lowers the relevance quality of the feature's core output. No error results and id hygiene is unaffected (invented ids are still dropped), so this is a quality gap, not a defect. MVP waives quality SLAs, but the prompt references data it isn't given — consider either sending a trimmed `headline`+`snippet`/`description` slice, or narrowing the rules to headline-only matching so the prompt and payload agree.

### Low — Truncated/partial mapping is cached and served on hits; the `refresh` escape hatch is unreachable from the UI

**Location:** `backend/app/services/signals/lead_map.py` (cache write following `_recover_mapping_entries`) + `frontend/src/features/signals/hooks/useSignalLeadMap.ts` (always `refresh=false`)

On a structurally-truncated Claude response, `_recover_mapping_entries` yields a partial `mapping[]` that is written to the `signal_lead_map` cache and then served unchanged on subsequent fingerprint hits. The only documented recovery is `refresh=true` (spec §5.4), but no FE surface ever passes it — the hook always fetches with the default `refresh=false`, and no UI exposes a recompute action. A single truncated or low-quality response is therefore locked in until the org's signal or lead *id set* changes; edits to lead fields (no id change) also cannot bust it. At 0 users this is acceptable, but it is flagged because the spec leans on `refresh` as the escape hatch and it is currently inert end-to-end.

### Low — `getLeadCountForICP` stub makes every Suggested ICP card show "0 leads"

**Location:** `frontend/src/features/customers/components/lead-stream/LeadStream.tsx` (`getLeadCountForICP` returns `0`) → consumed by `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx:1001,1028`

The Task-17 rewrite dropped the mock ICP segmentation; `getLeadCountForICP` is retained for call-site compatibility but now returns `0` unconditionally, so `SuggestedICPCards` renders "0 leads" for every ICP. The pre-existing counts were derived from mock data (not real), so this is a deliberate, documented deferral (TD-FE-69) with a pull-forward trigger (a real per-ICP count endpoint). Recorded here so the visible regression is understood as intentional and tracked, not mistaken for a bug. No test asserts the stub returns `0` (the old `getLeadCountForICP` test was removed in the rewrite).

### Nit — Type-unsafe zod cast in `fetchSignalLeadMap`

**Location:** `frontend/src/features/signals/services/signals.ts` (`SignalLeadMapResponseSchema as ZodType<SignalLeadMapResponse>`)

The schema uses `.default()`/`.catch()`, which diverge zod's input/output types from the `ZodType<T>` contract that `apiPost<T>` expects; the cast papers over the mismatch (introduced by the preflight type-fix commit). It works at runtime, but silences the type checker — if the schema's inferred output drifts from `SignalLeadMapResponse`, the cast will hide it. Acceptable workaround for a known zod papercut; noted for visibility.

### Nit — `useSignalLeadMap` has no `staleTime`, so it re-POSTs on every mount/focus

**Location:** `frontend/src/features/signals/hooks/useSignalLeadMap.ts`

With the default `staleTime: 0`, navigating to (or refocusing) the Signals page, the market-research LeadsTable, or the customers LeadStream each fires a `POST /signal-lead-map_claude`. Backend fingerprint caching absorbs the Claude cost (only a cold or changed input set recomputes), but the spec explicitly notes that a cache hit still pays the two DB reads + Mongo cache read that the cache does not optimize out — so every remount incurs that round-trip. A short `staleTime` (e.g. 60–120s) would trim redundant backend reads. Minor at MVP scale.
