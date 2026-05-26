---
synthesizes_review: docs/reviews/13-prompt-management-impl-review-9.md
artifact: master
artifact_type: impl
reactor_model: claude-opus-4-7
date: 2026-05-26
round: 9
---

> **Note:** Originally named `master-synthesis-1.md`. Renamed to continue the
> `13-prompt-management-impl-synthesis-N` series as round 9 — pairs with
> `13-prompt-management-impl-review-9.md`. All 3 agreed fixes shipped as commits
> `4162428`, `b18886b`, `49396b9`.

## Round Recommendation

no

Reason: After fixes, no Critical/High remains; residual items are explicitly known v1 limitations or Low/Nit informational.

## Agreed Findings

- **[Medium] `prompt_meta` lost on error path in market_scoring** (`market_scoring/scoring.py:135-154`): will fix by capturing `prompt_meta` from `score_single_lead_against_market` even when post-processing fails, and threading it into the `fallback_payload` persistence call. Requires splitting the render-vs-post-processing boundary inside `score_single_lead_against_market` so prompt_meta survives a `_clean_and_parse_json` failure. Verified: prompt_meta IS computed pre-failure (line 296), discarded after.
- **[Low] Unused `llm2` parameter in `score_single_lead_against_market`** (`market_scoring/orchestrator.py:283`): will fix by removing the parameter and updating the single production caller (`scoring.py:117`) plus tests (`tests/unit/test_market_scoring.py:320`). CLAUDE.md is explicit: "no backwards-compat shims" — the `# kept for backward compat` comment is exactly the pattern the rule forbids.
- **[Nit] Typo `signal_Ask` in error log** (`signals/ask.py:107`): will fix to `signal_ask` (lowercase).

## Disagreed Findings

(none — all findings are technically correct on substance)

## Deferred Findings

- **[Low] No `prompt_meta` observability for Cypher/QA graph chains** (`llm_config.py:61-69`): explicitly documented as a v1 limitation in `docs/PROMPTS.md` §11.2 (agent-chain/custom-dispatch/LangChain paths are observability-only or absent). Reviewer acknowledges this. Trigger to revisit: when graph chat becomes a production debugging target requiring prompt-level traceability. v2 design surface.
- **[Low] `_registry` singleton silently replaced — no production guard**: explicit v1 contract per spec §3.3 "double-call behavior" — silent replacement is documented and load-bearing for test isolation (`tmp_path` re-inits, autouse fixtures in `tests/conftest.py`). Reviewer marks this informational. Trigger to revisit: documented in spec §11 — first production bug masked by silent replacement.
- **[Nit] `_expand_includes` `max_depth` parameter is a latent escape hatch**: reviewer explicitly tags as "not a bug today — just noting." All production callers (`init_registry`) use the default `max_depth=1`; no test or production code passes a higher value. Leaving the parameter exposed is fine; the cost of adding a runtime guard outweighs the speculative benefit.

## Severity Disagreements

- **`_prompt_meta` discarded for prospect scoring** (`data_sources/loaders.py:90`): reviewer rated Medium; I rate **Low**. Substance is correct — prompt_meta is computed and discarded. But the score never reaches Mongo (it's baked into a Cypher CREATE and returned inline in HTTP response). The spec §6 item 5 ("every service's persistence calls write a `prompt_meta` sub-doc") was scoped to Mongo writes; the Neo4j prospect-scoring path is genuinely outside that frame. Fixing requires either adding `prompt_meta` as Neo4j node properties (awkward) or surfacing in HTTP response (low-value without consumer). Defer until a real observability consumer asks for prospect-scoring traceability.

## Open Questions

- Finding 2's correct disposition depends on whether the prospect score Cypher-write counts as "persistence" for spec §6 item 5 purposes. The migration outcome doc and PROMPTS.md frame prompt_meta as a Mongo sub-doc shape; extending to Neo4j node properties is a design decision worth flagging for the next prompt-system iteration rather than retrofitting now.
