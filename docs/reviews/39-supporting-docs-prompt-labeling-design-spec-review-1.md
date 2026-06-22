---
artifact: specs/39-supporting-docs-prompt-labeling-design.md
artifact_type: spec
verdict: findings
reviewer_model: claude-opus-4-8 (fresh-eyes subagent)
date: 2026-06-22
round: 1
---

## Context

Fresh-eyes adversarial review; every code claim verified against the worktree
at `.claude/worktrees/fix-supporting-docs-labeling/backend/`. Core mechanic is
sound (shared `supporting_documents` kwarg reaches a boot-inlined partial, gated
by `{% if %}`, validated by the loader's AST check; pinecone keys are NOT
persisted to Mongo, so removing them from the blob is downstream-safe). Two High
scope/correctness gaps + four Medium under-specifications block plan-readiness.

## Findings

### [High] H1 — Missed 4th Scout/Profiler surface: `signal_ask` already labels the same docs with divergent wording
**Location:** Problem table (§Problem, lines 38-43), Goal 4 (line 57), Non-goals (lines 60-68); code `app/services/signals/ask.py:87, 141-142, 230-231`.
`signals/ask.py` (`signal_ask` / `signal_ask_claude`, templates `signals_signal_ask_qwen` / `signals_signal_ask_claude`) retrieves the same Pinecone supporting docs via `_fetch_pinecone_supporting_context` (`:87`) and already injects them labeled as `DATA SOURCES (uploaded documents):` (`:142`, `:231`) — a separate code path with different wording, folded into a composite `context` string. This directly contradicts Goal 4 ("one shared implementation — no per-surface drift"): after this spec ships, `signal_ask` keeps a hand-rolled, differently-worded label while the other templates share the partial. Resolve: bring `signal_ask` into scope (use the shared helper + partial, reconcile wording) OR list it in Non-goals with rationale. Do not silently omit it.

### [High] H2 — Acceptance criterion 5 ("existing suite unaffected") is false; golden prompt-fixture regeneration is unaddressed
**Location:** Acceptance criterion 5 (line 190); Testing (lines 165-181); code `tests/regen_prompt_fixtures.py`, `tests/fixtures/prompts/_inputs/`, `tests/fixtures/prompts/rendered/`, `tests/fixtures/captured/`.
The repo has a golden-rendered prompt-fixture system. (1) Adding `supporting_documents` to each template's `inputs:` makes `render()` raise `MissingInputs` unless the matching `_inputs/<name>.json` skeleton gains the key. (2) The rendered golden `.txt` bodies for all edited templates (plus `captured/*.json`: `search_signals_scout_*`, `market_research_*`, `icp_research_*`) change when the body changes, failing any snapshot/golden assertion until regenerated. Add an explicit task: update `_inputs` skeletons + regenerate golden/captured fixtures; reword criterion 5 to "existing suite green *after* fixture regeneration."

### [Medium] M1 — Market-research threading under-specified (dispatch lambdas + component-runner signature)
**Location:** §4 bullet 2 (lines 121-125); code `market_research/orchestrator.py:49-54, 92-106, 119, 162`.
Threading `supporting_documents` requires widening: the 10 `COMPONENT_FUNCTIONS` / `COMPONENT_FUNCTIONS_CLAUDE` lambdas, the `research_function(agent_chain, company_profile)` call site (`:162`), and `_run_research_component`'s signature. The spec mentions none of this indirection; "thread it into the renderer" under-scopes the change.

### [Medium] M2 — ICP threading: proposed 3rd-positional arg breaks the existing dispatch lambdas
**Location:** §4 bullet 3 (lines 126-130); code `icp/orchestrator.py:205-216, 238-240, 308`.
`ICP_FUNCTIONS_CLAUDE` lambdas call `icp_research_N(agent_chain, d, "claude")` — inserting `supporting_documents` as the 3rd positional arg (before `llm_backend`) would shove `"claude"` into the docs slot. Spec names neither `ICP_FUNCTIONS` nor `ICP_FUNCTIONS_CLAUDE`. Specify the full dispatch-dict rewrite, or thread `supporting_documents` as a keyword arg and update all lambdas.

### [Medium] M3 — Shared partial requires `name`/`version`/`description` frontmatter; §2 example omits it (would fail boot)
**Location:** §2 (lines 85-96); code `prompts.py:219, 342-347`.
The loader requires `_REQUIRED_FIELDS_PARTIAL = {name, version, description}` on every `_shared/*.md.j2`; the §2 example (body only) would crash `init_registry`. Show the required frontmatter in the spec.

### [Medium] M4 — Signals has ONE shared render call; both signal templates must declare `supporting_documents` in lockstep
**Location:** §4 bullet 1 (lines 113-120); code `signals/search.py:129-139`.
There is a single `prompts.render` call (`:130`) with `prompt_name` selected by persona — adding `supporting_documents` once is correct (simpler than "both branches' render call" implies). Hidden constraint to state: since the same kwarg set goes to both `signals_scout_search` and `signals_profiler_search`, and `render` raises `UnknownInputs` on extras, BOTH templates must declare `supporting_documents` in `inputs:` (kept in lockstep).

### [Low] L1 — Naming error: `_run_market_research_component` does not exist
**Location:** §4 bullet 2 (line 124). Actual symbol is `_run_research_component` (`market_research/orchestrator.py:49`).

### [Low] L2 — "grep ... returns nothing" is literally false
**Location:** §Problem (lines 45-48). The grep returns 4 matches in the two signals templates (verbatim-URL instructions: "...you retrieved"). The conclusion (no prompt labels the Pinecone content) holds; tighten the wording.

### [Low] L3 — `default=str` may be load-bearing for numpy/Decimal scores; untested type edge
**Location:** §1 (line 81). Pinecone `score` can be a numpy float depending on the client → `default=str` is load-bearing, not decorative. Add an acceptance note that the helper must not raise on numpy/Decimal scores; the "tolerates malformed rows" test doesn't cover the type edge.

### [Low] L4 — Criterion 1 says "all 11" but the test plan samples one template per surface family
**Location:** Acceptance criterion 1 (lines 184-185) vs Testing (lines 172-178). Sampling is defensible for 11 templates sharing one partial, but state it explicitly so "all 11" is falsifiable against the plan.

### [Nit] N1 — Confirm no observability reader of `pinecone_context_queries`
**Location:** Non-goals (lines 67-68). Verified no `app/` reader and not persisted to Mongo; 10-second confirm at plan time that the (ephemeral) `/debug/signal-trace` path doesn't surface these query strings.

### [Nit] N2 — ICP partials use `final_answer_directive.md.j2`, not the `_json` variant cited
**Location:** §2 (line 98). Both exist; immaterial to the design, noted for precision.
