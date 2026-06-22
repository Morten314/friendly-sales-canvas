---
artifact: specs/39-supporting-docs-prompt-labeling-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-22
round: 2
---

## Context

Round-2 fresh-eyes review. The spec lives on the `fix-supporting-docs-labeling`
branch/worktree (not `master`); every code claim was re-verified against
`.claude/worktrees/fix-supporting-docs-labeling/backend/`. Round-1 findings
(H1–N2) were all incorporated into this revision — the partial frontmatter, the
`signal_ask` 4th surface, the fixture-regen task, the ICP keyword-arg fix, and
the single-shared-render call are all now correctly stated. This round therefore
focuses on residual and newly-surfaced gaps; the core mechanic (shared
`supporting_documents` kwarg → boot-inlined `{% if %}`-gated partial, pinecone
keys not persisted) remains sound. 4 Medium + 3 Low block a clean verdict.

## Findings

### [Medium] M1 — Market-research threading omits the keyword-arg fix it explicitly gives ICP (identical `llm_backend` positional hazard)
**Location:** §4 bullet 2 (market_research, lines 140-146) vs §4 bullet 3 (ICP, lines 147-153); code `market_research/orchestrator.py:49, 100-106, 162`.

The ICP bullet explicitly threads `supporting_documents` as a **keyword** and warns that inserting it positionally before `llm_backend` would break the `_CLAUDE` dispatch lambdas (which pass `"claude"` positionally at `icp/orchestrator.py:213-216`). The market-research bullet names the same three edit sites — the `COMPONENT_FUNCTIONS`/`COMPONENT_FUNCTIONS_CLAUDE` lambdas (`:92-106`), the `research_function(agent_chain, company_profile)` call site (`:162`), and `_run_research_component`'s signature (`:49`) — but does **not** specify keyword. The hazard is identical and live: `COMPONENT_FUNCTIONS_CLAUDE` calls `_run_research_component(1, agent_chain, d, "claude")` (`:101-105`), so a positional `supporting_documents` inserted as the 4th parameter would bind `"claude"`→docs and silently revert the Claude market-research path to the Qwen default. Mirror the ICP resolution verbatim: state "keyword argument, not a positional before `llm_backend`" for `_run_research_component` as well.

### [Medium] M2 — "Full fidelity" serialization emits each chunk's text twice (`content` is re-embedded in `metadata`)
**Location:** §1 helper spec (lines 80-92) + Non-goals "raw JSON rows, full fidelity (no field trimming)" (lines 69-70); code `_retrieval.py:100-106`.

Each retrieved row is `{query, id, score, content, metadata}` where `content = metadata.get("text") or metadata.get("page_content")` (`_retrieval.py:104`). So `metadata` already contains the same chunk text as `content`, and `json.dumps(rows)` under "full fidelity" therefore emits each chunk's text **twice** per row. At top_k=3 × 2 queries that is up to 6 chunks, doubled — a material, avoidable prompt-size/cost increase on every generation surface, and net-new payload on the profiler path (which currently drops docs entirely, per D3). The "no field trimming" decision reads as if made without noting this redundancy. Decide explicitly and record it: accept the doubling, or have the helper de-dupe (e.g. emit `{query,id,score,content}` plus a `metadata` with the redundant `text`/`page_content` stripped). Either way, state the token implication.

### [Medium] M3 — Test plan covers the partial but not the call-site threading (the riskiest part per round-1 M1/M2)
**Location:** Testing § (lines 197-218, esp. 200-213) + AC1 (lines 222-223); existing tests `tests/unit/test_signals.py`, `tests/unit/test_market_research.py`, `tests/unit/test_icp.py`.

The plan "samples one template per surface family" and asserts the assembled prompt contains/omits the labeled section. For market_research and ICP this reads as exercising the leaf render (`_run_research_component` / `icp_research_N`) directly — which validates the partial inclusion but **not** the call-site threading (dispatch lambdas + `research_function(...)` call site), i.e. exactly the plumbing that was the subject of round-1 M1/M2 and the proposed §4 edits. A threading bug (e.g. a lambda that drops `supporting_documents`) would pass these leaf-level tests and fail only in production. Clarify the test entry point per surface: for market/icp run through the async orchestrator with collaborators patched (the existing `test_market_research.py` / `test_icp.py` already patch `_fetch_pinecone_supporting_context` and `_fetch_company_profile` and are the natural extension point), or add an explicit "`prompts.render` was called with `supporting_documents=…`" assertion at the orchestrator level.

### [Medium] M4 — Surface map omits `signals/batch.py`, a second retrieval entry point the spec's own Context references
**Location:** Problem table (lines 37-43), §4 bullet 1 (lines 131-139), Testing surface families (lines 200-202); code `signals/batch.py:124-133, 183-193, 65`; Context/WS1 (lines 19-23).

The Context discusses the batch frontend (`generateSignalsBatch`, WS1) and the Problem table enumerates the signals merge site as `signals/search.py` only, but never names `signals/batch.py` — a second entry point that itself retrieves Pinecone context (`batch.py:124-130` scout, `:184-190` profiler), injects `pinecone_supporting_context` into `pre_data` (`:133`, `:193`), and then calls `search.search_signals` (`batch.py:65`). The good news: because batch delegates to the shared `search_signals`, the §4-bullet-1 fix covers it transitively (no separate edit needed). But the spec should (a) state that explicitly so an implementer neither duplicates the work nor misses it, and (b) add the batch path to the test-surface map — the existing `tests/unit/test_signals.py` already patches `batch._fetch_pinecone_supporting_context` (lines 456-703) and is the natural place to assert the labeled section reaches a batch-generated signal. As written, a reader auditing "where do Pinecone docs enter signals prompts" finds `batch.py` via grep and gets no guidance.

### [Low] L1 — `search_signals` has `str`-`pre_data` branches; `pre_data.get(...)` would `AttributeError` on them
**Location:** §4 bullet 1 (lines 132-133, "Compute `supporting_documents = format_supporting_documents(pre_data.get("pinecone_supporting_context"))`"); code `signals/search.py:72-82, 96-108`.

`search_signals` defensively handles `pre_data` as a `str` (the `elif isinstance(pre_data, str)` branches). The spec's `pre_data.get("pinecone_supporting_context")` assumes a dict and would raise `AttributeError` (→ 500) on the str path. Both real callers (`run_signals_research`, `batch._generate_signals_batch_impl`) dict-ify `pre_data` before calling, so the str path is likely dead/defensive — but the function still contains it. Specify a dict-guard (e.g. compute `supporting_documents` inside the existing `isinstance(pre_data, dict)` handling, or guard the `.get`), or confirm the str branches are dead and note it.

### [Low] L2 — Silent on bumping the 11 templates' `version:` despite a material content change
**Location:** §5 (lines 164-170); code `prompts.py:218-244` (semver `version` required, `_validate_callable_frontmatter`).

Adding the partial + a new labeled section is a material content change to all 11 templates, but the spec doesn't mention bumping each template's `version:` frontmatter. The observability system (`prompt_meta.version` / `content_hash`, persisted per result doc) exists to track exactly this; leaving versions unchanged means post-deploy result docs report a stale version for a changed prompt. Add a note to bump the 11 templates' `version` (patch or minor) alongside the `inputs:`/include edits. (The new partial's `1.0.0` is fine.)

### [Low] L3 — Fixture-regen scope ambiguous for the ask path (`captured/signal_ask_*.json` may embed the old label)
**Location:** Testing "regenerate the golden `rendered/` + `captured/` fixtures" (lines 216-218) + §4 ask bullet (lines 154-162); fixtures `tests/fixtures/captured/signal_ask_{qwen,claude}.json`.

The regen bullet scopes regeneration to "the edited templates," and the ask *templates* aren't edited (only `ask.py`). But if `captured/signal_ask_*.json` embed the runtime-assembled context string (which carries the old `DATA SOURCES (uploaded documents):` label built at `ask.py:142,231`), the label-wording change makes those captures stale. Clarify whether `captured/signal_ask_*` are regenerated (and how — they are runtime captures, not template renders) or confirm they're out of scope. (Verified separately: no test asserts the old label string, so there is no assertion breakage — only possible capture-file staleness.)

## Observations (no action)

- Loader mechanics re-verified against `prompts.py`: `_REQUIRED_FIELDS_PARTIAL = {name, version, description}` (partials need no `inputs:`); `_INCLUDE_LINE_RE` matches the spec's `{% include '_shared/supporting_documents_section.md.j2' %}` syntax; `_expand_includes` `max_depth=1` is satisfied (the new partial contains no nested include); the AST check (`meta.find_undeclared_variables`) forces `supporting_documents` into each parent's `inputs:` — all consistent with §2/§3. The §2 partial example is now complete (round-1 M3 resolved).
- All 11 target templates already include a `_shared/` partial today (signals/market → `final_answer_json_directive.md.j2`; icp → `final_answer_directive.md.j2`), so adding a second sibling include is precedented and boot-safe.
- The ask JSON-body swap is byte-identical: `ask.py:141` already does `json.dumps(data_source_context, indent=2, default=str)`, identical to the proposed helper — so the ask change is behavior-preserving apart from the label wording. Confirmed the old label string appears only in `ask.py` (no test asserts it).
- The ask path keeps a second copy of the label wording in Python (not the partial) — consciously accepted by the spec (§4 acknowledges single-source across the Jinja/Python boundary isn't practical; AC4 scopes "single source" to template surfaces). Confirming as accepted.
- D2/WS1 sequencing re-verified sound: WS2 degrades gracefully (empty retrieval → `supporting_documents=None` → section omitted); market/icp already send `org_id`, so WS2 alone closes Report 1 there.
- Non-persistence of `pinecone_*` keys re-verified — persisted result docs are parsed LLM output + metadata (`prompt_meta`), not the ephemeral `pre_data` / `company_profile` / `context_data` dict, so removing the keys from the blob is downstream-safe.
- No overengineering detected: shared helper + partial is appropriate DRY across 11 templates; ask alignment is light and user-confirmed (2026-06-22); the never-raise / `default=str` helper contract is justified by numpy/Decimal scores.
