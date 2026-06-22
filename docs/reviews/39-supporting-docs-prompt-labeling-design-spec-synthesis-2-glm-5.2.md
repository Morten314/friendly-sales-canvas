---
synthesizes_review: docs/reviews/39-supporting-docs-prompt-labeling-design-spec-review-2-glm-5.2.md
artifact: specs/39-supporting-docs-prompt-labeling-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-22
round: 2
---

## Round Recommendation

no

Reason: All 7 findings (4 Medium, 3 Low) are agreed and incorporated; none are High/Critical, the reviewer confirms the core mechanic is sound with no overengineering, and the one residual decision (M2 accept-vs-dedupe) is a user call, not something another adversarial round resolves.

## Agreed Findings

- **M1 (market-research keyword-arg):** Confirmed identical hazard — `COMPONENT_FUNCTIONS_CLAUDE` calls `_run_research_component(1, agent_chain, d, "claude")` (`:101-105`), so a positional 4th param would bind `"claude"`→docs and silently revert Claude→Qwen. Revising §4 bullet 2 to specify `supporting_documents` as a **keyword** argument (mirroring the ICP bullet), not a positional before `llm_backend`.
- **M2 (full-fidelity emits chunk text twice):** Confirmed — `_retrieval.py` sets `content = metadata.get("text") or metadata.get("page_content")` and also carries the full `metadata`, so `json.dumps(rows)` repeats each chunk's text. Real, avoidable prompt-size/cost increase on every generation surface. **Agreed the spec must address it explicitly** (it was unstated when the "no trimming" call was made). Resolution is a user decision (see Open Questions) — recommending: strip the redundant `text`/`page_content` keys from each row's `metadata` before serialising (keep `query/id/score/content` + all *other* metadata), which removes pure duplication without losing distinct fields. Revising §1 + Non-goals to record the duplication + token implication and flag the pending decision.
- **M3 (tests cover the partial, not the threading):** Agreed — leaf-render tests would pass a dropped-`supporting_documents` lambda. Revising Testing to exercise market/ICP **through the async orchestrator** with collaborators patched (extending existing `test_market_research.py`/`test_icp.py` that already patch `_fetch_pinecone_supporting_context`), and to assert `prompts.render` receives `supporting_documents`; signals via the `batch`/`run_signals_research` entry points.
- **M4 (surface map omits `signals/batch.py`):** Confirmed — `batch.py:124-133/184-193` retrieves and sets `pre_data["pinecone_supporting_context"]`, then calls `search.search_signals` (`:65`); `run_signals_research` in `search.py` does the same before its `search_signals` call. The `search_signals` seam covers both transitively. Revising the Problem table + §4 to name both signals entry points, state the transitive coverage, and add the batch path to the test-surface map.
- **L1 (`pre_data.get` on the str branch):** Agreed — `search_signals` has `isinstance(pre_data, str)` branches where `.get` would `AttributeError`. Revising §4 bullet 1 to compute `supporting_documents` inside the `isinstance(pre_data, dict)` handling (both real callers dict-ify first; noting the str path as defensive).
- **L2 (bump template `version:`):** Agreed — a material content change should bump each edited template's semver `version` so persisted `prompt_meta.version`/`content_hash` aren't stale. Adding a §5 note to bump the 11 templates' `version` alongside the `inputs:`/include edits (new partial stays `1.0.0`).
- **L3 (ask-path captured fixtures):** Agreed — `captured/signal_ask_{qwen,claude}.json` embed the runtime context string carrying the old `DATA SOURCES (uploaded documents):` label, so the wording change makes them stale (no assertion breaks — no test asserts the old string — only capture staleness). Revising the fixtures bullet to include regenerating the ask captures (runtime captures, not template renders).

## Disagreed Findings

None. Every finding was verified accurate against the code.

## Deferred Findings

None. All are cheap to incorporate at spec stage.

## Severity Disagreements

None. The Medium/Low assignments are reasonable; M2 is the most consequential (per-call token cost) and M1 the most bug-prone (silent backend revert), both correctly Medium.

## Open Questions

- **M2 resolution (for the user):** keep full rows verbatim (accept each chunk's text appearing twice — `content` + `metadata.text`/`page_content` — an avoidable token/cost increase on every Scout/Profiler generation call), **or** strip only the redundant `text`/`page_content` keys from each row's `metadata` before serialising (recommended — preserves `query/id/score/content` + all other metadata, just removes the literal duplication). This refines the earlier "don't trim rows (id/query)" decision along a dimension (content↔metadata duplication) that wasn't visible at the time.
