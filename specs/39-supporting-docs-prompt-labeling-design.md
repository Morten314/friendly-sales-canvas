# Spec 39 — Label retrieved supporting documents as their own prompt section

Status: design (intent) · Stack: backend · Author: Claude (RCA-driven)
Revised after spec-review rounds 1–2 (see `docs/reviews/39-…-spec-review-{1,2}*.md` + syntheses); `signal_ask` confirmed in scope by user (2026-06-22). One open decision remains: §1 "M2" content↔`metadata.text` de-duplication (recommended; pending user confirm).

## Context

Two testing reports motivated an RCA into how Pinecone retrieval results reach
the Scout/Profiler LLM prompts:

- **Report 1 (Scout "briefing"):** retrieved Pinecone results land in the prompt
  mixed in alongside the company-profile fields with no labels, so the LLM
  receives the content but can't tell what it is or how to weight it.
- **Report 2 (Profiler):** none of the uploaded Data Sources docs influence
  signal generation.

The RCA found three layered causes. One is already addressed:

- **D2 — frontend never sent `org_id` on batch signals** → backend received
  `org_id=None` → `_fetch_pinecone_supporting_context` short-circuited to `[]`
  and the leads fetch was skipped. Fixed in **WS1** (frontend
  `generateSignalsBatch` now forwards `org_id`; branch
  `fix-signals-batch-org-id`), verified live against the deployed backend.

This spec covers the prompt-side defect:

- **D1 — unlabeled merge:** retrieved docs are dumped into the same JSON blob as
  the company's declared profile, under a generic "company profile" header.
- **D3 — profiler drop:** the profiler *signals* branch discards them entirely.

## Problem (current behaviour, verified against the code)

`_fetch_pinecone_supporting_context` (`app/services/_retrieval.py:58`) returns
rows shaped `{query, id, score, content, metadata}`. The Scout/Profiler surfaces
then handle those rows inconsistently:

| Surface | Merge / label site | Injected as | Defect |
|---|---|---|---|
| Signals — scout | `signals/search.py:70` keeps the keys in `context_json` (exclude list is only `["existing_headlines","leads_data","icp_data"]`) | `{{ context_json }}` under "STEP 1 - COMPANY PROFILE DATA:" | **D1** (unlabeled, in blob) |
| Signals — profiler | `signals/search.py:~109` rebuilds `context_json` from only `{company_profile, icp_data}` | n/a — dropped | **D3** (dropped) |
| Market research | `market_research/orchestrator.py:154-155` sets the keys on `company_profile`; `:65` `json.dumps`; `:77-79` render | `{{ company_profile_json }}` | **D1** |
| ICP research | `icp/orchestrator.py:296-297` sets the keys on `context_data`; `:300` `json.dumps`→`context_json`; passed as `pre_data` | `{{ pre_data }}` | **D1** |
| Signals/Profiler **ask** | `signals/ask.py:87` retrieves; `:141-142, 230-231` label it `DATA SOURCES (uploaded documents):` in a composite context string | template-level context string | **none** — already a separate, labeled section (see §"signal_ask") |

No prompt *template* labels the retrieved content; the only existing labeling is
the bespoke, in-Python one on the `ask` path. (The earlier draft claimed a
`prompts/` grep "returns nothing"; that is imprecise — the grep matches the
WebSearch verbatim-URL instructions in the two signals templates, which are
unrelated. The accurate statement: no template labels the *retrieved Pinecone*
content, and the four generation surfaces bury it in the profile blob or drop
it.)

Signals retrieval is populated at **two entry points** before `search_signals`
runs — `run_signals_research` (in `signals/search.py`) and `signals/batch.py`
(`:124-133` scout, `:184-193` profiler) — both setting
`pre_data["pinecone_supporting_context"]` and delegating to the shared
`search_signals`. The §4 `search_signals` seam therefore covers both; neither
needs a separate edit, but both are exercised in tests.

## Goals

1. Retrieved docs appear in every Scout/Profiler **generation** prompt (signals
   scout+profiler, market-research, ICP) as a **distinct, labeled section**,
   visibly separated from the company's declared profile.
2. The **profiler** signals branch includes the retrieved docs (closes D3).
3. The retrieved docs are **removed from the company-profile/context JSON blob**
   so they no longer masquerade as declared profile fields (closes D1).
4. One shared implementation — no per-surface drift — including reconciling the
   `ask` path's bespoke label to the shared wording.

## Non-goals / out of scope

- WS1 (the `org_id` wire fix) — already done on `fix-signals-batch-org-id`.
- Retrieval, embedding, the document write path (`/upload-document` →
  `process_file_to_embeddings` → Pinecone) — verified healthy; untouched.
- Prose/summarised rendering of the docs — decision is **raw JSON rows** (no
  trimming of the distinct `query/id/score/content`+metadata fields; see §1 "M2"
  for the content↔`metadata.text` de-duplication decision).
- `icp_generator` — does not fetch retrieval context.
- The `pinecone_context_queries` (retrieval *query strings*) — never useful model
  context; **dropped from the prompt** on every generation surface. Confirmed no
  `app/` reader and not persisted to Mongo (the inserted result doc is the parsed
  LLM output, not the `company_profile`/`context_data` dict); the ephemeral
  `/debug/signal-trace` route is not deployed.

## Design

### 1. Shared formatting helper (`app/services/_retrieval.py`)

```
format_supporting_documents(rows) -> str | None
```

- Input: the list returned by `_fetch_pinecone_supporting_context`, or `None`/`[]`.
- Output: `json.dumps(<rows>, indent=2, default=str)` when the list is
  non-empty; `None` when empty/`None`. Rows keep their distinct fields
  (`query/id/score/content` + metadata) — no trimming of those.
- **Redundancy decision (M2 — pending user confirm):** `_retrieval.py` sets
  `content = metadata.get("text") or metadata.get("page_content")` *and* carries
  the full `metadata`, so dumping rows verbatim repeats each chunk's text twice
  (`content` + `metadata.text`/`page_content`) — up to ~6 chunks × 2 per call, an
  avoidable per-call token/cost increase on every Scout/Profiler generation
  surface (and net-new payload on the profiler path, which currently drops docs).
  **Recommended (and the behaviour specified here pending the user's call):**
  strip only the redundant `text`/`page_content` keys from each row's `metadata`
  before serialising — keeps `query/id/score/content` + all other metadata,
  removing the literal duplication. Alternative: accept the doubling.
- Pure, total, never raises. `default=str` is load-bearing: the Pinecone `score`
  can be a non-JSON-native type (e.g. a numpy float) depending on the client, and
  `metadata` is arbitrary — the helper must serialise these without raising.

### 2. Shared prompt partial (`prompts/_shared/supporting_documents_section.md.j2`)

A single guarded partial carrying the label + instruction once. The loader
requires partials to declare `name`/`version`/`description` frontmatter
(`prompts.py:219, 344`), so the file is:

```
---
name: supporting_documents_section
version: 1.0.0
description: Labeled section for Pinecone-retrieved org documents; included by Scout/Profiler generation prompts. Omitted when no documents retrieved.
---
{% if supporting_documents %}
SUPPORTING DOCUMENTS (retrieved from your organization's uploaded knowledge
base — treat as corroborating evidence and cite where relevant; these are NOT
the company's declared profile fields):
{{ supporting_documents }}
{% endif %}
```

Mirrors existing `_shared/` partials. Included via the loader's relative path
`_shared/supporting_documents_section.md.j2`. `{% include %}` is expanded into
the parent body at boot and rendered with the parent's kwargs, so a top-level
`supporting_documents` kwarg reaches it; the loader's AST check requires every
referenced var to be a declared parent `input`. When `supporting_documents` is
falsy, the section is omitted entirely.

### 3. Render variable

A single render variable `supporting_documents` (the formatted string or `None`)
is passed to `prompts.render(...)` at every generation surface and consumed by
the included partial. Each consuming template **declares `supporting_documents`
in its `inputs:` frontmatter** (the loader raises `UnknownInputs` on an
undeclared kwarg and `MissingInputs` on a declared-but-absent input — see §6).

### 4. Call-site changes

- **`signals/search.py`** — there is a **single** shared `prompts.render` call
  (`:130`) with `prompt_name` chosen by persona. Compute
  `supporting_documents = format_supporting_documents(pre_data.get("pinecone_supporting_context"))`
  **inside the existing `isinstance(pre_data, dict)` handling** (the function also
  has defensive `str`-`pre_data` branches where a bare `.get` would
  `AttributeError`; both real callers dict-ify first, so the str path is
  defensive) and pass it to that one call. Scout branch: add
  `pinecone_supporting_context` and `pinecone_context_queries` to the
  `context_json` exclude list (`:70`). Profiler branch: already excludes them.
  Because the same kwargs go to both `signals_scout_search` and
  `signals_profiler_search`, **both** templates must declare
  `supporting_documents` in `inputs:` (kept in lockstep). Both signals entry
  points populate `pre_data["pinecone_supporting_context"]` *before* calling
  `search_signals` — `run_signals_research` (in `search.py`) and
  `signals/batch.py:124-133/184-193` (scout/profiler) — so this single seam covers
  both transitively; no separate edit in `batch.py`.
- **`market_research/orchestrator.py`** — stop setting
  `company_profile["pinecone_*"]` (`:154-155`). Thread `supporting_documents`
  through the dispatch indirection: the `COMPONENT_FUNCTIONS` /
  `COMPONENT_FUNCTIONS_CLAUDE` lambdas (`:92-106`), the
  `research_function(agent_chain, company_profile)` call site (`:162`), and
  `_run_research_component`'s signature (`:49`, **not** `_run_market_research_component`).
  Thread `supporting_documents` as a **keyword** argument — *not* a positional
  before `llm_backend`: `COMPONENT_FUNCTIONS_CLAUDE` calls
  `_run_research_component(N, agent_chain, d, "claude")` (`:101-105`), so a
  positional 4th param would bind `"claude"`→docs and silently revert the Claude
  path to the Qwen default (identical hazard to the ICP fix below). Render with
  `company_profile_json=..., supporting_documents=...`.
- **`icp/orchestrator.py`** — stop putting pinecone into `context_data`
  (`:296-297`) so `context_json` (= `pre_data`) is profile + `icp_card` only.
  Thread `supporting_documents` as a **keyword** argument (not a new positional
  before `llm_backend` — the `ICP_FUNCTIONS_CLAUDE` lambdas at `:213-216` pass
  `"claude"` positionally and would break). Update the `ICP_FUNCTIONS` /
  `ICP_FUNCTIONS_CLAUDE` lambdas (`:205-216`), the `research_function(...)` call
  (`:308`), and the `icp_research_1..4` signatures/render calls.
- **`signals/ask.py` (consistency alignment, not a bug-fix)** — the `ask` path
  already injects a separate labeled section (`:142, 231`
  `DATA SOURCES (uploaded documents):`), so it has **no D1 defect**. For Goal 4,
  replace its bespoke `data_source_json` construction with the shared
  `format_supporting_documents` helper and align its label wording to the
  partial's. Its `signals_signal_ask_*` templates consume a pre-built composite
  context string, so they do **not** include the partial — the label lives in
  `ask.py`. (Perfect single-source across the Jinja/Python boundary isn't
  practical; "aligned wording + shared helper" is the achievable consistency.)

### 5. Templates that include the partial (11)

`signals_scout_search`, `signals_profiler_search`; `research_market_1`–`5`;
`icp_research_1`–`4`. In each, `{% include '_shared/supporting_documents_section.md.j2' %}`
after the existing profile/context block (before the "research requirements"
step), and `supporting_documents` added to `inputs:`. **Bump each of the 11
templates' `version:` frontmatter** (patch/minor) so persisted
`prompt_meta.version` / `content_hash` reflect the changed body; the new partial
stays `1.0.0`. The `ask` templates are handled in code (§4) and are **not** in
this list.

## Data flow

```
_fetch_pinecone_supporting_context(org_id)  →  rows (best-effort, [] on miss)
        │
        ▼
format_supporting_documents(rows)  →  supporting_documents (str | None)
        │                                  company profile/context blob
        ▼                                  (pinecone keys REMOVED)
prompts.render(template, <profile_var>=..., supporting_documents=...)
        │
        ▼
{{ <profile_var> }}                        ← declared profile only
{% include _shared/supporting_documents_section %}  ← retrieved docs, labeled
```

`org_id` gating unchanged: empty `org_id` → `[]` rows → `supporting_documents`
is `None` → section omitted (no regression for orgs without docs).

## Error / empty handling

- Empty or missing retrieval → `None` → section omitted.
- Helper never raises (incl. numpy/Decimal `score`, arbitrary `metadata`).
- No new failure modes; retrieval/embedding paths untouched.

## Testing (pytest, `backend/tests/`, patch-where-used)

Deterministic prompt-assembly assertions — no prod seeding (verification
decision: unit-level only). Coverage **samples one template per surface family**
(scout, profiler, market_research, icp) to exercise the shared partial; we do not
assert all five `research_market_*` or all four `icp_research_*` individually.
Crucially, the market/ICP cases run **through the async orchestrator** with
collaborators patched (extending the existing `test_market_research.py` /
`test_icp.py`, which already patch `_fetch_pinecone_supporting_context` /
`_fetch_company_profile`) so the **call-site threading** (dispatch lambdas +
`research_function(...)`) is exercised — not just the leaf render; assert
`prompts.render` is called with `supporting_documents=…`. Signals run via the
`batch._generate_signals_batch_impl` and `run_signals_research` entry points
(existing `test_signals.py` already patches `batch._fetch_pinecone_supporting_context`),
not by calling `search_signals` with a hand-built dict.

- **Helper:** non-empty rows → JSON string containing the row content; `[]`/`None`
  → `None`; distinct fields retained; per the M2 decision, the redundant
  `metadata.text`/`page_content` is absent when de-dupe is confirmed; a row whose
  `score` is a non-JSON-native type (numpy float / `Decimal`) serialises without
  raising.
- **Per generation surface (retrieval patched to fixed rows, via the orchestrator
  / entry point):**
  - assembled prompt **contains** the labeled SUPPORTING DOCUMENTS section with
    the row content;
  - the profile/context JSON in the prompt **does not contain**
    `pinecone_supporting_context` / `pinecone_context_queries` (D1 regression);
  - retrieval patched to `[]` → section **absent** (no empty header).
- **Profiler regression (D3):** profiler prompt includes the retrieved docs.
- **`ask` alignment:** the `ask` context still contains the (shared-helper)
  documents under the aligned label.
- **Fixtures:** add a `supporting_documents` key to the edited templates'
  `tests/fixtures/prompts/_inputs/<name>.json` skeletons and regenerate the golden
  `rendered/` fixtures (`tests/regen_prompt_fixtures.py`); also regenerate the
  runtime `captured/*.json` (incl. `captured/signal_ask_{qwen,claude}.json`, whose
  embedded context string carries the now-changed `ask` label — no test asserts
  the old string, so this is staleness, not breakage).

## Acceptance criteria

1. Each surface family renders the labeled section when docs are present and
   omits it when absent (verified via one-template-per-family sampling).
2. No generation surface leaves `pinecone_*` keys inside the profile/context JSON.
3. Profiler signals include retrieved docs; the `ask` path uses the shared helper
   and aligned label wording.
4. `format_supporting_documents` + the partial are the single source of
   formatting/label wording for the template surfaces.
5. New pytest coverage green; the existing backend suite is green **after**
   `_inputs`-skeleton + golden/captured fixture regeneration.

## Interactions & sequencing

- **WS1** makes scout *signals* actually retrieve docs (by sending `org_id`); WS2
  makes them labeled. WS2 is independent and can merge on its own; together they
  fully close Report 2. Market-research and ICP already send `org_id`, so WS2
  alone closes Report 1 on those surfaces.
- Merge gate: the controller-run `npm run preflight` is **frontend-only**, so it
  does not apply to this backend change. The relevant gate is the backend pytest
  suite (`backend/tests/`, incl. regenerated fixtures) plus review — there is no
  backend preflight runner.

## Decisions (settled)

- **Scope:** all four Scout/Profiler retrieval surfaces — signals scout+profiler,
  market-research, ICP, and `signal_ask` (user-confirmed in scope, 2026-06-22).
  The first three are *generation* surfaces with the D1/D3 defects, fixed via the
  shared helper + the Jinja partial (§5). `signal_ask` is **not** implicated by
  either report (it already labels its docs); it is included for Goal-4
  consistency — a light change (shared helper + aligned label wording in
  `ask.py`, no partial), per §4.
- **Doc shape:** raw JSON rows; distinct fields untrimmed. Open: content↔
  `metadata.text` de-duplication (M2) — recommended de-dupe, pending user confirm
  (see §1).
- **Verification:** unit-level pytest (deterministic prompt assembly); no prod
  seeding.
