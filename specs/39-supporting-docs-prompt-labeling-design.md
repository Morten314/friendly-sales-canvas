# Spec 39 — Label retrieved supporting documents as their own prompt section

Status: design (intent) · Stack: backend · Author: Claude (RCA-driven)

## Context

Two testing reports motivated an RCA into how Pinecone retrieval results reach
the Scout/Profiler LLM prompts:

- **Report 1 (Scout "briefing"):** retrieved Pinecone results land in the prompt
  mixed in alongside the company-profile fields with no labels, so the LLM
  receives the content but can't tell what it is or how to weight it.
- **Report 2 (Profiler):** none of the uploaded Data Sources docs influence
  signal generation.

The RCA found three layered causes. Two are already addressed:

- **D2 — frontend never sent `org_id` on batch signals** → backend received
  `org_id=None` → `_fetch_pinecone_supporting_context` short-circuited to `[]`
  and the leads fetch was skipped. Fixed in **WS1** (frontend
  `generateSignalsBatch` now forwards `org_id`; branch
  `fix-signals-batch-org-id`). Verified live against the deployed backend.
- **D3 / D1 — prompt-side handling of the retrieved docs.** This spec.

This spec covers the prompt-side defect (D1 + D3): retrieved docs are dumped into
the same JSON blob as the company's declared profile under a generic "company
profile" header (D1), and the profiler signals branch discards them entirely
(D3).

## Problem (current behaviour, verified)

`_fetch_pinecone_supporting_context` (`app/services/_retrieval.py`) returns rows
shaped `{query, id, score, content, metadata}`. Every Scout/Profiler surface then
merges those rows into the company-profile/context dict as two keys
(`pinecone_supporting_context`, `pinecone_context_queries`) and serialises the
whole thing into one JSON blob injected under a generic header:

| Surface | Merge site | Injected as | Header |
|---|---|---|---|
| Signals — scout | `signals/search.py:70` keeps the keys in `context_json` (exclude list is only `["existing_headlines","leads_data","icp_data"]`) | `{{ context_json }}` | `signals_scout_search.md.j2` "STEP 1 - COMPANY PROFILE DATA:" |
| Signals — profiler | `signals/search.py:~109` rebuilds `context_json` from only `{company_profile, icp_data}` — **docs dropped (D3)** | n/a (dropped) | `signals_profiler_search.md.j2` |
| Market research | `market_research/orchestrator.py:154-155` sets them on `company_profile`; `:65` `json.dumps`; `:77-79` render | `{{ company_profile_json }}` | `research_market_1..5.md.j2` |
| ICP research | `icp/orchestrator.py:296-297` sets them on `context_data`; `:300` `json.dumps`→`context_json`; passed as `pre_data` to `icp_research_N` | `{{ pre_data }}` | `icp_research_1..4.md.j2` |

No prompt anywhere labels the retrieved content (grep of `prompts/` for
`supporting|retrieved|knowledge base|document` returns nothing). So the model is
told "this is the company's profile" and handed retrieved evidence as if it were
declared profile fields.

## Goals

1. Retrieved docs appear in every Scout/Profiler prompt as a **distinct,
   labeled section**, visibly separated from the company's declared profile.
2. The **profiler** signals branch includes the retrieved docs (closes D3).
3. The retrieved docs are **removed from the company-profile/context JSON blob**
   so they no longer masquerade as declared profile fields (closes D1).
4. One shared implementation — no per-surface drift.

## Non-goals / out of scope

- WS1 (the `org_id` wire fix) — already done on `fix-signals-batch-org-id`.
- Retrieval, embedding, the document write path (`/upload-document` →
  `process_file_to_embeddings` → Pinecone) — all verified healthy; untouched.
- Prose/summarised rendering of the docs — decision is **raw JSON rows, full
  fidelity** (no field trimming).
- `icp_generator` — it does not fetch retrieval context.
- The `pinecone_context_queries` (retrieval *query strings*) — these were never
  useful model context and are **dropped from the prompt** on every surface.

## Design

### 1. Shared formatting helper (`app/services/_retrieval.py`)

```
format_supporting_documents(rows) -> str | None
```

- Input: the list returned by `_fetch_pinecone_supporting_context` (rows of
  `{query, id, score, content, metadata}`), or `None`/`[]`.
- Output: `json.dumps(rows, indent=2, default=str)` when the list is non-empty;
  `None` when empty/`None`. Rows are passed through **untrimmed** (full
  `{query, id, score, content, metadata}` per the chosen shape).
- Pure, total, never raises (mirrors the best-effort contract of its sibling).

### 2. Shared prompt partial (`prompts/_shared/supporting_documents_section.md.j2`)

A single guarded partial carrying the label + instruction once, e.g.:

```
{% if supporting_documents %}
SUPPORTING DOCUMENTS (retrieved from your organization's uploaded knowledge
base — treat as corroborating evidence and cite where relevant; these are NOT
the company's declared profile fields):
{{ supporting_documents }}
{% endif %}
```

Mirrors existing `_shared/` partials (`final_answer_json_directive.md.j2`,
`signals/signals_leads_section.md.j2`). Included via the prompt loader's
relative path `_shared/supporting_documents_section.md.j2`. When
`supporting_documents` is falsy (no docs retrieved), the section is omitted
entirely — no dangling header.

### 3. Render variable

A single render variable named `supporting_documents` (the formatted string or
`None`) is passed to `prompts.render(...)` at every surface and consumed by the
included partial. Each consuming template declares `supporting_documents` in its
`inputs:` frontmatter, matching the repo's prompt-frontmatter convention.

### 4. Call-site changes

- **`signals/search.py`** — compute
  `supporting_documents = format_supporting_documents(pre_data.get("pinecone_supporting_context"))`
  once in `search_signals` (persona-independent). Scout branch: add
  `pinecone_supporting_context` and `pinecone_context_queries` to the
  `context_json` exclude list (`:70`) so they leave the profile blob. Profiler
  branch: already excludes them (the `{company_profile, icp_data}` rebuild) — no
  change needed there beyond passing the new var. Both branches' `prompts.render`
  call gains `supporting_documents=supporting_documents`.
- **`market_research/orchestrator.py`** — stop setting
  `company_profile["pinecone_supporting_context"]` / `["pinecone_context_queries"]`
  (`:154-155`); compute `supporting_documents` in the run function and thread it
  into the per-component renderer (`_run_market_research_component`'s
  `prompts.render(..., company_profile_json=..., supporting_documents=...)`).
- **`icp/orchestrator.py`** — stop putting pinecone into `context_data`
  (`:296-297`) so `context_json` (= `pre_data`) is profile + `icp_card` only;
  compute `supporting_documents` in the run function and thread it through the
  `icp_research_1..4(agent_chain, pre_data, supporting_documents, llm_backend)`
  functions into their `prompts.render(...)` calls.

### 5. Templates that include the partial (11)

`signals_scout_search`, `signals_profiler_search`; `research_market_1`–`5`;
`icp_research_1`–`4`. In each, `{% include '_shared/supporting_documents_section.md.j2' %}`
is placed immediately after the existing profile/context block (before the
"research requirements" step), and `supporting_documents` is added to `inputs:`.

## Data flow

```
_fetch_pinecone_supporting_context(org_id)  →  rows (best-effort, [] on miss)
        │
        ▼
format_supporting_documents(rows)  →  supporting_documents (str | None)
        │                                   company profile/context blob
        ▼                                   (pinecone keys REMOVED)
prompts.render(template, context_json=..., supporting_documents=...)
        │
        ▼
{{ context_json }}                          ← declared profile only
{% include _shared/supporting_documents_section %}  ← retrieved docs, labeled
```

`org_id` gating is unchanged: empty `org_id` → `[]` rows → `supporting_documents`
is `None` → section omitted (no regression for orgs without docs).

## Error / empty handling

- Empty or missing retrieval → `None` → section omitted.
- Helper tolerates malformed/partial rows (best-effort, never raises), preserving
  the existing "continue without context" contract.
- No new failure modes; retrieval/embedding paths untouched.

## Testing (pytest, `backend/tests/`, patch-where-used)

Deterministic prompt-assembly assertions — no prod seeding (verification decision:
unit-level only).

- **Helper:** non-empty rows → JSON string containing the row content; `[]`/`None`
  → `None`; full fields retained (no trimming).
- **Per surface (signals scout, signals profiler, market_research, icp), with
  retrieval patched to return fixed rows:**
  - assembled prompt **contains** the labeled SUPPORTING DOCUMENTS section with
    the row content;
  - the company-profile/context JSON in the prompt **does not contain**
    `pinecone_supporting_context` / `pinecone_context_queries` (D1 regression);
  - with retrieval patched to `[]`, the section is **absent** (no empty header).
- **Profiler regression (D3):** profiler prompt includes the retrieved docs
  (previously dropped).

## Acceptance criteria

1. All 11 templates render the labeled section when docs are present and omit it
   when absent.
2. No surface leaves `pinecone_*` keys inside the profile/context JSON blob.
3. Profiler signals include retrieved docs.
4. `format_supporting_documents` + the partial are the single source of
   formatting/label wording (no per-surface duplication).
5. New pytest coverage green; existing backend suite unaffected.

## Interactions & sequencing

- **WS1** makes scout *signals* actually retrieve docs (by sending `org_id`);
  WS2 makes them labeled. WS2 is independent and can merge on its own; together
  they fully close Report 2. Market-research and ICP already send `org_id`, so
  WS2 alone closes Report 1 on those surfaces.
- Merge gate: the controller-run `npm run preflight` is **frontend-only**, so it
  does not apply to this backend change. The relevant gate is the backend pytest
  suite (`backend/tests/`) plus review — there is no backend preflight runner.

## Open questions

None — scope (all 3 surfaces), shape (separate labeled section, raw JSON rows,
untrimmed), and verification (unit-level pytest) are settled.
