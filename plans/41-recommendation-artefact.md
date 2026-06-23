# Recommendation Artefact: per-recommendation "Save as Artifact" → GTM playbook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user has accepted a signal, expanded one of its recommendations, and read the answer, a prominent **"Save as Artifact"** button in the answer action row generates a complete, self-contained **GTM playbook** (what-to-do · strategy · how-to-communicate · channel · ready-to-use template) via a new Claude endpoint, then downloads it as a multi-page PDF **and** enqueues it into the in-app Artefacts library — identical delivery path to the Spec 38 signal briefing.

**Architecture:** Cross-stack, **backend first** (repo rule: add the endpoint, verify the live JSON shape, then build the FE consumer — there is no generated client). A new `POST /api/generate-recommendation-artefact_claude` mirrors `signal_ask_claude`'s Claude-call mechanics (token/run budget via `_claude_budget`, direct `requests.post` to Anthropic) but is **self-contained from the request body** — the FE supplies the signal context, matched leads, recommendation, and the cached answer, so the service does **no** Neo4j/Mongo/Pinecone fetch. Output is **structured JSON** (five string fields), parsed degrade-never-throw to empty strings. On the FE, a new service binding + zod contract + pure builder map the response into an `ArtefactItem` (`type: "playbook"`, already in the union), reusing the Spec 38 `enqueueArtefact` queue and `generateAndDownloadPDF`. The shared PDF generator is **upgraded to jsPDF** (wrapping + pagination) so long playbook prose doesn't clip — partially resolving `TD-FE-78`.

**Tech Stack:** Python 3.12 / FastAPI, Jinja2 prompt loader (`app.core.prompts`), pytest + pytest-mock (backend). React 18 / TypeScript / Vite, TanStack Query, zod, Vitest + Testing Library + MSW, shadcn-ui, lucide-react, **jsPDF ^4** (frontend).

## Global Constraints

- **Spec is the contract.** Implements `specs/41-recommendation-artefact-design.md` (twice-reviewed: syntheses 1 + 2). Decisions D-1…D-7 and the §9 mapping are binding. Where this plan refines the spec, it is flagged inline.
- **Spelling convention (D-7).** **User-facing copy uses "Artifact"/"Artifacts"** — both button labels, the disabled hints, the error message, and the success toast; this feature also **relabels** the existing Spec 38 signal-level button (`SignalCard.tsx:184`) + its toast (`SignalsPage.tsx:537-538`) from "Artefact" to "Artifact" (copy only, no behavior change). **Code identifiers keep "Artefact"** (`RecommendationArtefactRequest/Response`, `generateRecommendationArtefact`, `buildRecommendationPlaybookArtefact`, `onSaveRecommendationAsArtefact`, the `generate-recommendation-artefact_claude` route, `app/services/signals/artefact.py`). The `features/artifacts/` dir + `/artifacts` route are already American.
- **Backend-first ordering.** Tasks 1-4 (backend) ship before the FE consumer; Task 5 verifies the live JSON shape. Do not start Task 6 until Task 5 confirms the contract (or its documented fallback).
- **No auth/tenancy hardening** (§3). `user_id`/`org_id` are body params used for logging/scoping only — consistent with every existing signals endpoint. The endpoint reuses the **existing** `_claude_budget` token/run limiter (parity with `signal_ask_claude`); this is reuse of an established shared guard, **not** new abuse hardening.
- **Degrade-never-throw.** Backend parse → empty strings on any malformed/partial JSON (never raises). FE zod schema uses `.optional().default("")`. The builder must produce a valid `ArtefactItem` even when all five LLM fields are empty.
- **Branch + commits.** Implement on the existing worktree branch `worktree-recommendation-artefact` (which already carries the Spec 41 + this plan). `export WT=/projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/recommendation-artefact` once; all git below uses `git -C "$WT"` with repo-root-relative paths. **One commit per task**, `type(scope):` subjects (`feat(be):`, `feat(fe):`, `chore(be):`, `docs:`), **no `Co-Authored-By` footer**, commit by explicit path (never `git add -A` — the worktree tree is shared with other sessions).
- **Backend tests** run via the worktree venv, from `backend/`: `.venv/bin/python -m pytest <path> -q`. If `backend/.venv` is absent in this worktree, symlink it to the main checkout's venv first (`ln -s ../../../backend/.venv "$WT/backend/.venv"` — adjust depth as needed) before running. The `asyncio_mode` config warning is pre-existing noise. There is no backend preflight runner; the backend gate is the pytest suite + review. Root-level `backend/test_*.py` are **live production probes**, not unit tests — do not run them as part of the gate.
- **Frontend per-task verification** (from `frontend/`): `npm run typecheck` (the npm script — never bare `npx tsc`; the root tsconfig is a no-op stub), `npx vitest run <file>` for the task's tests, and `npx prettier --write <touched files>` (the per-task `npm run verify` omits `format:check`). The full **serial** `npm run preflight` is the merge gate (prefer serial over `preflight:par` during shared-worktree development; the e2e/VR step is flake-sensitive under CPU contention).
- **Feature boundaries via barrels only.** Cross-feature imports go through `index.ts` (enforced by `import-x`). The signals feature imports `enqueueArtefact`, `generateAndDownloadPDF`, and the `ArtefactItem` type **only** from `@/features/artifacts`.
- **Bundle.** jsPDF adds to the FE bundle; `preflight`'s `bundle:check` is **advisory** (sanctioned by TD-FE-78). Import jsPDF only inside `features/artifacts/lib/artefactPdf.ts`.
- **Failure handling.** Execution is delegated to a report-and-wait failure-stop sub-skill. If a step's test does not reach its stated expected result, **stop and report** rather than improvising or skipping. No step performs a destructive/irreversible operation — commits are additive, by path, on a short-lived branch.

---

## File Structure

**Created — backend:**
- `backend/prompts/signals/signals_recommendation_artefact_claude.md.j2` — structured-JSON GTM-playbook prompt (Task 2).
- `backend/tests/fixtures/prompts/_inputs/signals_recommendation_artefact_claude.json` + `rendered/signals_recommendation_artefact_claude.txt` — golden fixtures (Task 2).
- `backend/app/services/signals/artefact.py` — `generate_recommendation_artefact_claude` + `_parse_recommendation_artefact_response` (Task 3).
- `backend/tests/unit/test_recommendation_artefact.py` — parse + through-service tests (Task 3).

**Modified — backend:**
- `backend/app/models/signals.py` — `MatchedLead`, `RecommendationArtefactRequest`, `RecommendationArtefactResponse` (Task 1).
- `backend/app/services/signals/__init__.py` — export the new service (Task 3).
- `backend/app/routers/signals.py` — new `POST /generate-recommendation-artefact_claude` route (Task 4).

**Created — frontend:**
- `frontend/src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx` — page-level save flow (Task 10).

**Modified — frontend:**
- `frontend/src/features/signals/contracts.ts` — `RecommendationArtefactResponseSchema` + type (Task 6).
- `frontend/src/features/signals/services/signals.ts` — `generateRecommendationArtefact` (Task 6).
- `frontend/src/features/signals/lib/signalBriefing.ts` — `buildRecommendationPlaybookArtefact` (Task 7).
- `frontend/src/features/artifacts/lib/artefactPdf.ts` — **rewrite** with jsPDF (Task 8).
- `frontend/package.json` — add `jspdf` (^4) (Task 8).
- `frontend/src/features/artifacts/lib/__tests__/artefactPdf.test.ts` — migrate raw-byte → jsPDF assertions (Task 8).
- `frontend/src/features/signals/components/SignalCard.tsx` — new props/state + Save button + row restructure; relabel existing button `:184` (Task 9).
- `frontend/src/features/signals/components/__tests__/{SignalCard.cta,SignalCard,SignalCard.affects}.test.tsx` — new cases + required-prop defaults (Task 9).
- `frontend/src/features/signals/pages/SignalsPage.tsx` — new state + handler + prop wiring; relabel existing toast (Task 10).
- `frontend/src/features/signals/__tests__/contracts.test.ts` — schema cases (Task 6).
- `docs/TECH_DEBT.md` — TD-FE-78 → partially resolved + stale-note fix (Task 11).

---

## Task 1: Backend request/response models

Add the Pydantic models the route and service use. `relevance` is kept a plain `str` (degrade-tolerant — it only feeds the prompt; the backend trusts client data per §3, so an off-enum value must not 422). `org_id` is Optional because the FE forwards it only when present (§8.1).

**Files:**
- Modify: `backend/app/models/signals.py`

**Interfaces:**
- Produces: `MatchedLead`, `RecommendationArtefactRequest`, `RecommendationArtefactResponse` (imported by the router in Task 4 and the service in Task 3).

- [ ] **Step 1: Add the models**

In `backend/app/models/signals.py`, add to the **Request models** section (after `SignalLeadMapRequest`, ~line 27):

```python
class MatchedLead(BaseModel):
    company: str = ""
    relevance: str = ""  # high|medium|low — kept str (degrade-tolerant; only feeds the prompt)
    why: str = ""


class RecommendationArtefactRequest(BaseModel):
    """POST /generate-recommendation-artefact_claude — all inputs the LLM needs
    are supplied by the FE (no server-side profile/leads fetch). user_id/org_id
    are for logging/scoping only; no auth is enforced (§3)."""
    signal_headline: str
    signal_description: str = ""
    signal_sources: List[str] = []
    matched_leads: List[MatchedLead] = []
    recommendation: str
    recommendation_answer: str
    user_id: str
    org_id: Optional[str] = None
```

In the **Response models** section (after `SignalAskResponse`, end of file), add:

```python
class RecommendationArtefactResponse(BaseModel):
    """Response for POST /generate-recommendation-artefact_claude — the five
    LLM-generated playbook sections. All default "" so a malformed/partial LLM
    response still yields a valid body (degrade-never-throw, §7.3)."""
    what_to_do: str = ""
    strategy: str = ""
    how_to_communicate: str = ""
    communication_channel: str = ""
    communication_template: str = ""
```

(`List`, `Optional`, `BaseModel` are already imported at the top of the file.)

- [ ] **Step 2: Smoke-import to verify they parse**

Run (from `backend/`):
```bash
.venv/bin/python -c "from app.models.signals import MatchedLead, RecommendationArtefactRequest, RecommendationArtefactResponse; print(RecommendationArtefactRequest(signal_headline='h', recommendation='r', recommendation_answer='a', user_id='u').model_dump())"
```
Expected: prints a dict with `signal_sources: []`, `matched_leads: []`, `org_id: None`, no error.

- [ ] **Step 3: Commit**

```bash
git -C "$WT" add backend/app/models/signals.py
git -C "$WT" commit -m "feat(be): add recommendation-artefact request/response models"
```

---

## Task 2: GTM-playbook prompt template + golden fixture

A new Jinja prompt that lays out the signal context + leads + recommendation + answer and instructs Claude to return **only** a JSON object with the five fields. The loader auto-discovers `backend/prompts/<svc>/*.md.j2`; the registry name is the filename stem. Named `signals_recommendation_artefact_claude` to match the `signals_*` convention and the `_claude` sibling `signals_signal_ask_claude` (the spec's bare `recommendation_artefact.md.j2` is renamed for convention-consistency).

**Files:**
- Create: `backend/prompts/signals/signals_recommendation_artefact_claude.md.j2`
- Create: `backend/tests/fixtures/prompts/_inputs/signals_recommendation_artefact_claude.json`
- Create (regenerated): `backend/tests/fixtures/prompts/rendered/signals_recommendation_artefact_claude.txt`

**Interfaces:**
- Produces: a prompt rendered by Task 3 via `prompts.render("signals_recommendation_artefact_claude", **inputs)`. `inputs:` must list **exactly** the six render kwargs (the loader validates the set; a missing/extra key raises `MissingInputs`).

- [ ] **Step 1: Create the prompt template**

`backend/prompts/signals/signals_recommendation_artefact_claude.md.j2`:

```
---
name: signals_recommendation_artefact_claude
version: 1.0.0
description: Recommendation-level GTM playbook (Claude). Produces what-to-do / strategy / how-to-communicate / channel / template as structured JSON for one accepted-signal recommendation.
model: claude-sonnet
response_format: json
inputs:
  - signal_headline
  - signal_description
  - signal_sources
  - matched_leads
  - recommendation
  - recommendation_answer
---
You are a B2B go-to-market strategist. Produce a concrete, immediately-usable GTM playbook for ONE recommendation a user has accepted on a market signal. A teammate with no app access must be able to execute it from your output alone.

SIGNAL
Headline: {{ signal_headline }}
Description: {{ signal_description }}
Sources:
{{ signal_sources }}

RECOMMENDATION (the play to execute)
{{ recommendation }}

WHY THIS FITS (analyst answer already shown to the user)
{{ recommendation_answer }}

MATCHED LEADS (JSON array of {company, relevance, why}; may be empty)
{{ matched_leads }}

TASK
1. Determine the GTM motion implied by the signal + recommendation.
2. Choose the single most effective outreach channel: one of "email", "linkedin", "email+linkedin", or "call".
3. Write a specific, sequenced action plan for the matched leads. If the list is empty, write the plan for the signal+recommendation motion in general.
4. Write a ready-to-use communication template in the chosen channel, using placeholders such as [First Name], [Company], [specific trigger]. For multi-touch sequences, label each step (Day 1, Day 3, ...).

OUTPUT
Return ONLY a single JSON object — no prose, no markdown fences — with EXACTLY these five string keys:
{
  "what_to_do": "...",
  "strategy": "...",
  "how_to_communicate": "...",
  "communication_channel": "email | linkedin | email+linkedin | call",
  "communication_template": "..."
}
```

- [ ] **Step 2: Verify the loader boots the new template**

Run (from `backend/`):
```bash
.venv/bin/python -m pytest tests/unit/test_prompts_loader.py -q
```
Expected: PASS — the loader's AST check confirms `inputs:` exactly matches the `{{ vars }}` used (six). If it reports a missing/extra input, reconcile the frontmatter list with the body.

- [ ] **Step 3: Add the `_inputs` skeleton and regenerate the golden fixture**

Create `backend/tests/fixtures/prompts/_inputs/signals_recommendation_artefact_claude.json` (representative values for all six inputs):

```json
{
  "signal_headline": "ACME Corp announces DACH expansion",
  "signal_description": "ACME Corp announced 30% revenue growth and a DACH expansion in Q3, signalling new buying centres in Germany and Austria.",
  "signal_sources": "ACME Q3 press release\nhttps://example.com/acme-q3",
  "matched_leads": "[\n  {\n    \"company\": \"Beispiel GmbH\",\n    \"relevance\": \"high\",\n    \"why\": \"DACH mid-market, matches ICP\"\n  }\n]",
  "recommendation": "Reach out to DACH mid-market accounts referencing the expansion.",
  "recommendation_answer": "The expansion creates a timely wedge for outreach to German-speaking mid-market buyers."
}
```

Then regenerate the rendered golden fixture (from `backend/`):
```bash
.venv/bin/python tests/regen_prompt_fixtures.py signals_recommendation_artefact_claude
```
Expected stderr: `[regen] wrote .../rendered/signals_recommendation_artefact_claude.txt` and `[regen] 1/1 fixtures regenerated`. If it reports `skipped (REPLACE_ME ...)`, a placeholder remains in the `_inputs` file — fix and re-run.

> If `tests/regen_prompt_fixtures.py` is not present or named differently in this checkout, generate the fixture inline: `.venv/bin/python -c "from app.core import prompts; import json,io; ip=json.load(open('tests/fixtures/prompts/_inputs/signals_recommendation_artefact_claude.json')); open('tests/fixtures/prompts/rendered/signals_recommendation_artefact_claude.txt','w').write(prompts.render('signals_recommendation_artefact_claude', **ip).body)"` — then confirm the golden test (next step) passes. STOP and report if the rendering raises.

- [ ] **Step 4: Verify the golden + loader tests pass**

Run (from `backend/`):
```bash
.venv/bin/python -m pytest tests/unit/test_prompts_golden.py tests/unit/test_prompts_loader.py -q
```
Expected: PASS — golden matches the regenerated `rendered/` fixture; loader boots all templates incl. the new one.

- [ ] **Step 5: Commit**

```bash
git -C "$WT" add \
  backend/prompts/signals/signals_recommendation_artefact_claude.md.j2 \
  backend/tests/fixtures/prompts/_inputs/signals_recommendation_artefact_claude.json \
  backend/tests/fixtures/prompts/rendered/signals_recommendation_artefact_claude.txt
git -C "$WT" commit -m "feat(be): add GTM-playbook recommendation-artefact prompt + golden fixture"
```

---

## Task 3: Backend service + structured-JSON parser

A new self-contained service mirroring `signal_ask_claude`'s Claude mechanics (budget reserve/finalize, `requests.post`, content-block extraction) but rendering the Task 2 prompt and parsing structured JSON degrade-never-throw.

**Files:**
- Create: `backend/app/services/signals/artefact.py`
- Modify: `backend/app/services/signals/__init__.py`
- Test: `backend/tests/unit/test_recommendation_artefact.py`

**Interfaces:**
- Consumes: `_claude_budget` (`CLAUDE_API_KEY`, `CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS`, `_estimate_token_count`, `_reserve_claude_signal_budget`, `_finalize_claude_signal_budget`); `prompts.render`; `RecommendationArtefactRequest`.
- Produces: `generate_recommendation_artefact_claude(request) -> dict` (the five fields + `status`); `_parse_recommendation_artefact_response(text) -> Dict[str, str]` (pure, total). Both exported via `app.services.signals`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/test_recommendation_artefact.py`:

```python
"""Unit tests for app/services/signals/artefact.py."""
import asyncio
import json

import pytest

from app.core.exceptions import ServiceError
from app.models.signals import MatchedLead, RecommendationArtefactRequest
from app.services.signals.artefact import (
    _parse_recommendation_artefact_response,
    generate_recommendation_artefact_claude,
)

_FIELDS = (
    "what_to_do",
    "strategy",
    "how_to_communicate",
    "communication_channel",
    "communication_template",
)


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


def _claude_text(text):
    """Mimic Anthropic /v1/messages: a content list with one text block."""
    return _FakeResponse({"content": [{"type": "text", "text": text}]})


def _req():
    return RecommendationArtefactRequest(
        signal_headline="Hiring surge",
        signal_description="ICP context.",
        signal_sources=["src-a"],
        matched_leads=[MatchedLead(company="Acme", relevance="high", why="ICP match")],
        recommendation="Reach out now",
        recommendation_answer="Because timing.",
        user_id="u1",
        org_id="org1",
    )


# ---- parser (pure) ----

def test_parse_extracts_all_five_fields():
    out = _parse_recommendation_artefact_response(
        json.dumps(
            {
                "what_to_do": "step 1",
                "strategy": "the play",
                "how_to_communicate": "warm email",
                "communication_channel": "email",
                "communication_template": "Hi [First Name]",
            }
        )
    )
    assert out["what_to_do"] == "step 1"
    assert out["communication_channel"] == "email"
    assert out["communication_template"] == "Hi [First Name]"


def test_parse_strips_markdown_fence():
    text = "```json\n{\"strategy\": \"x\"}\n```"
    assert _parse_recommendation_artefact_response(text)["strategy"] == "x"


def test_parse_degrades_to_empty_on_malformed_json():
    out = _parse_recommendation_artefact_response("not json at all")
    assert out == {k: "" for k in _FIELDS}


def test_parse_degrades_on_partial_and_non_string_values():
    out = _parse_recommendation_artefact_response(json.dumps({"strategy": 123}))
    assert out["strategy"] == "123"  # coerced
    assert out["what_to_do"] == ""   # missing -> ""


def test_parse_empty_input_returns_all_empty():
    assert _parse_recommendation_artefact_response("") == {k: "" for k in _FIELDS}


# ---- service (through, with Claude mocked) ----

def test_service_returns_parsed_fields(mocker):
    mocker.patch("app.services.signals.artefact.CLAUDE_API_KEY", "valid-key")
    mocker.patch("app.services.signals.artefact._estimate_token_count", return_value=10)
    mocker.patch(
        "app.services.signals.artefact._reserve_claude_signal_budget",
        return_value={"run_id": "rid"},
    )
    fin = mocker.patch(
        "app.services.signals.artefact._finalize_claude_signal_budget",
        return_value={"window_tokens_5m": 10, "run_count_5m": 1, "run_count_total": 1},
    )
    captured = {}

    def _post(*args, **kwargs):
        captured["prompt"] = kwargs["json"]["messages"][0]["content"]
        return _claude_text(json.dumps({"what_to_do": "do x", "communication_channel": "linkedin"}))

    mocker.patch("app.services.signals.artefact.requests.post", side_effect=_post)

    result = asyncio.run(generate_recommendation_artefact_claude(_req()))

    assert result["status"] == "success"
    assert result["what_to_do"] == "do x"
    assert result["communication_channel"] == "linkedin"
    assert result["strategy"] == ""  # missing -> degraded
    # the rendered prompt carries the signal + a matched lead
    assert "Hiring surge" in captured["prompt"]
    assert "Acme" in captured["prompt"]
    fin.assert_called_once()  # budget finalized exactly once on the happy path


def test_service_degrades_on_malformed_llm_output(mocker):
    mocker.patch("app.services.signals.artefact.CLAUDE_API_KEY", "valid-key")
    mocker.patch("app.services.signals.artefact._estimate_token_count", return_value=10)
    mocker.patch(
        "app.services.signals.artefact._reserve_claude_signal_budget",
        return_value={"run_id": "rid"},
    )
    mocker.patch(
        "app.services.signals.artefact._finalize_claude_signal_budget",
        return_value={"window_tokens_5m": 10, "run_count_5m": 1, "run_count_total": 1},
    )
    mocker.patch(
        "app.services.signals.artefact.requests.post",
        return_value=_claude_text("the model rambled without JSON"),
    )
    result = asyncio.run(generate_recommendation_artefact_claude(_req()))
    assert result["status"] == "success"
    assert all(result[k] == "" for k in _FIELDS)  # never throws; all empty


def test_service_raises_without_api_key(mocker):
    mocker.patch("app.services.signals.artefact.CLAUDE_API_KEY", "")
    with pytest.raises(ServiceError):
        asyncio.run(generate_recommendation_artefact_claude(_req()))
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/unit/test_recommendation_artefact.py -q`
Expected: FAIL — `ModuleNotFoundError: app.services.signals.artefact`.

- [ ] **Step 3: Create the service module**

`backend/app/services/signals/artefact.py`:

```python
"""Recommendation artefact — Claude-backed GTM playbook generation.

Generates the five LLM sections (what-to-do / strategy / how-to-communicate /
channel / template) for one accepted-signal recommendation, returned as
structured JSON. Mirrors signal_ask_claude's Claude-call mechanics (token/run
budget via _claude_budget, direct requests.post to Anthropic) but is
self-contained from the request body — the FE supplies the signal context,
matched leads, recommendation, and cached answer, so there is no Neo4j/Mongo/
Pinecone fetch here.
"""
import asyncio
import json
from typing import Any, Dict, Optional

import requests

from app.core import prompts
from app.core.config import claude_sonnet_model
from app.core.exceptions import ServiceError
from app.core.logging import logger
from app.models.signals import RecommendationArtefactRequest
from app.services._claude_budget import (
    CLAUDE_API_KEY,
    CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
    _estimate_token_count,
    _finalize_claude_signal_budget,
    _reserve_claude_signal_budget,
)

_ARTEFACT_FIELDS = (
    "what_to_do",
    "strategy",
    "how_to_communicate",
    "communication_channel",
    "communication_template",
)


def _parse_recommendation_artefact_response(text: str) -> Dict[str, str]:
    """Extract the five playbook fields from the model's JSON output.

    Total + degrade-never-throw: strips a ```json fence, takes the outermost
    {...}, json.loads, and reads each field as a string (coercing non-strings,
    treating None/missing as ""). ANY failure yields all-empty — never raises.
    """
    empty = {k: "" for k in _ARTEFACT_FIELDS}
    if not text:
        return empty
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # drop the opening fence line (``` or ```json) and a trailing fence
        cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else ""
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        return empty
    try:
        parsed = json.loads(cleaned[start : end + 1])
    except Exception:
        return empty
    if not isinstance(parsed, dict):
        return empty
    result: Dict[str, str] = {}
    for k in _ARTEFACT_FIELDS:
        v = parsed.get(k, "")
        result[k] = v if isinstance(v, str) else ("" if v is None else str(v))
    return result


async def generate_recommendation_artefact_claude(
    request: RecommendationArtefactRequest,
) -> dict:
    """Claude-powered GTM-playbook generator with the shared token/run limiter."""
    if not CLAUDE_API_KEY:
        raise ServiceError("ANTHROPIC_API_KEY is not configured")

    reservation: Optional[Dict[str, Any]] = None
    input_tokens_estimate = 0
    output_tokens_estimate = 0

    try:
        matched_leads_json = json.dumps(
            [lead.model_dump() for lead in request.matched_leads], indent=2, default=str
        )
        signal_sources = "\n".join(s for s in request.signal_sources if s) or "(none provided)"

        rendered = prompts.render(
            "signals_recommendation_artefact_claude",
            signal_headline=request.signal_headline,
            signal_description=request.signal_description,
            signal_sources=signal_sources,
            matched_leads=matched_leads_json,
            recommendation=request.recommendation,
            recommendation_answer=request.recommendation_answer,
        )
        prompt = rendered.body

        input_tokens_estimate = _estimate_token_count(prompt)
        reservation = _reserve_claude_signal_budget(
            input_tokens_estimate=input_tokens_estimate,
            max_output_tokens=CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
        )

        response = await asyncio.to_thread(
            requests.post,
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": claude_sonnet_model,
                "max_tokens": CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
                "temperature": 0.3,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=120,
        )

        if response.status_code >= 400:
            raise ServiceError(
                f"Claude API call failed ({response.status_code}): {response.text[:1000]}"
            )

        payload = response.json()
        answer_parts = [
            block.get("text", "")
            for block in payload.get("content", [])
            if isinstance(block, dict) and block.get("type") == "text"
        ]
        answer = "\n".join(x for x in answer_parts if x).strip()

        fields = _parse_recommendation_artefact_response(answer)

        output_tokens_estimate = _estimate_token_count(answer)
        _finalize_claude_signal_budget(
            run_id=reservation["run_id"],
            actual_total_tokens=input_tokens_estimate + output_tokens_estimate,
        )
        reservation = None

        return {"status": "success", **fields}

    except Exception as e:
        logger.error(f"Error in generate_recommendation_artefact_claude: {str(e)}")
        raise
    finally:
        if reservation and reservation.get("run_id"):
            _finalize_claude_signal_budget(
                run_id=reservation["run_id"],
                actual_total_tokens=input_tokens_estimate + output_tokens_estimate,
            )
```

- [ ] **Step 4: Export via the package barrel**

In `backend/app/services/signals/__init__.py`, add the import (after the `lead_map` import, ~line 44) and the `__all__` entry:

```python
from app.services.signals.artefact import generate_recommendation_artefact_claude
```
and add `"generate_recommendation_artefact_claude",` to `__all__`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/unit/test_recommendation_artefact.py -q`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git -C "$WT" add \
  backend/app/services/signals/artefact.py \
  backend/app/services/signals/__init__.py \
  backend/tests/unit/test_recommendation_artefact.py
git -C "$WT" commit -m "feat(be): add Claude recommendation-artefact service + JSON parser"
```

---

## Task 4: Route `POST /generate-recommendation-artefact_claude`

A thin router shim mirroring `generate_signals_batch_claude` (inline `CLAUDE_API_KEY` guard → 500) and `signal_ask_claude` (delegates to the service, which also guards + runs the limiter). No DB dependencies — the service is self-contained from the body.

> **No separate route unit test.** The repo has no route-unit-test convention (booting `app.main:app` in a unit context triggers the full lifespan — clients/registry/Neo4j — which is unavailable in the sandbox). The route is a 4-line shim identical in shape to its siblings; its logic is covered by the Task 3 service tests and the Task 5 live check. This task's gate is an import-smoke + the unchanged unit suite.

**Files:**
- Modify: `backend/app/routers/signals.py`

**Interfaces:**
- Consumes: `RecommendationArtefactRequest`, `RecommendationArtefactResponse` (Task 1); `signals_service.generate_recommendation_artefact_claude` (Task 3).

- [ ] **Step 1: Add the model imports**

In `backend/app/routers/signals.py`, extend the `app.models.signals` import (lines 11-19) with the two new names (keep alphabetical grouping):

```python
from app.models.signals import (
    GenerateSignalsBatchResponse,
    RecommendationArtefactRequest,
    RecommendationArtefactResponse,
    SignalActionRequest,
    SignalActionResponse,
    SignalAskRequest,
    SignalAskResponse,
    SignalLeadMapRequest,
    SignalsResearchResponse,
)
```

- [ ] **Step 2: Add the route**

Append at the end of `backend/app/routers/signals.py` (after the `signal_ask_claude` route):

```python


@router.post("/generate-recommendation-artefact_claude", response_model=RecommendationArtefactResponse)
async def generate_recommendation_artefact_claude(request: RecommendationArtefactRequest):
    """Generate a GTM playbook (what-to-do / strategy / channel / template) for one
    accepted-signal recommendation, via Claude. Self-contained from the body; reuses
    the shared _claude_budget token/run limiter (parity with signal_ask_claude)."""
    from app.services._claude_budget import CLAUDE_API_KEY
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return await signals_service.generate_recommendation_artefact_claude(request)
```

- [ ] **Step 3: Import-smoke + unchanged unit suite**

Run (from `backend/`):
```bash
.venv/bin/python -c "import app.routers.signals; print('route module imports OK')"
.venv/bin/python -m pytest tests/unit/test_recommendation_artefact.py tests/unit/test_prompts_loader.py -q
```
Expected: import prints OK (the new route resolves the response model + service); tests PASS.

- [ ] **Step 4: Commit**

```bash
git -C "$WT" add backend/app/routers/signals.py
git -C "$WT" commit -m "feat(be): expose POST /generate-recommendation-artefact_claude route"
```

---

## Task 5: Live-shape verification (no commit)

Per the repo rule, confirm the real JSON shape before building the FE consumer. The FE service/contract (Task 6) is written against the **response** shape; verify it.

**Files:** none (verification only).

- [ ] **Step 1: Boot the backend locally and confirm the route + schema**

From `backend/`, start the app (background) and read the OpenAPI:
```bash
.venv/bin/python -m uvicorn app.main:app --port 8099 &
sleep 5
curl -s http://localhost:8099/openapi.json | .venv/bin/python -c "import sys,json; d=json.load(sys.stdin); p=d['paths']['/generate-recommendation-artefact_claude']['post']; print('request:', list(d['components']['schemas']['RecommendationArtefactRequest']['properties'].keys())); print('response:', list(d['components']['schemas']['RecommendationArtefactResponse']['properties'].keys()))"
```
Expected: request props include `signal_headline, signal_description, signal_sources, matched_leads, recommendation, recommendation_answer, user_id, org_id`; response props are exactly `what_to_do, strategy, how_to_communicate, communication_channel, communication_template`. (If the lifespan fails to boot in the sandbox — missing DB creds — skip the live curl and confirm the contract from the route/model source instead; note it in the report.)

- [ ] **Step 2: Exercise the endpoint if a Claude key is present**

```bash
curl -s -X POST http://localhost:8099/generate-recommendation-artefact_claude \
  -H 'content-type: application/json' \
  -d '{"signal_headline":"Hiring surge","signal_description":"ctx","signal_sources":["s"],"matched_leads":[{"company":"Acme","relevance":"high","why":"fit"}],"recommendation":"Reach out","recommendation_answer":"timing","user_id":"probe-user","org_id":"probe-org"}'
```
- If `ANTHROPIC_API_KEY` is configured locally: expect `200` with the five string fields populated — **record the exact key casing** (snake_case) to confirm the Task 6 zod schema.
- If not configured: expect `500 {"detail":"ANTHROPIC_API_KEY is not configured"}` — this confirms route wiring + the guard; defer the populated-shape check to post-deploy against `brewra-gtm-intelligence.onrender.com` (the live shape is otherwise fully determined by `RecommendationArtefactResponse`).

Stop the server: `kill %1` (or the specific PID — do **not** broad-`pkill`; the worktree shares the sandbox).

- [ ] **Step 3: Record the outcome**

Note in the task report which branch fired (200 vs guard-500) and confirm the response keys match `RecommendationArtefactResponse`. Proceed to Task 6.

---

## Task 6: Frontend contract + service binding

A zod contract for the five-field response (degrade-never-throw) and the `apiPost` binding, mirroring `generateSignalsBatch` (conditional `org_id`).

**Files:**
- Modify: `frontend/src/features/signals/contracts.ts`
- Modify: `frontend/src/features/signals/services/signals.ts`
- Test: `frontend/src/features/signals/__tests__/contracts.test.ts`

**Interfaces:**
- Produces: `RecommendationArtefactResponseSchema` + `RecommendationArtefactResponse` (contracts); `generateRecommendationArtefact(userId, orgId, body)` (service).

- [ ] **Step 1: Write the failing contract test**

Add to `frontend/src/features/signals/__tests__/contracts.test.ts` (import the new schema at the top alongside existing imports):

```ts
import { RecommendationArtefactResponseSchema } from "../contracts";

describe("RecommendationArtefactResponseSchema", () => {
  it("parses the full five-field shape", () => {
    const out = RecommendationArtefactResponseSchema.parse({
      what_to_do: "do",
      strategy: "play",
      how_to_communicate: "warm",
      communication_channel: "email",
      communication_template: "Hi [First Name]",
    });
    expect(out.communication_channel).toBe("email");
    expect(out.communication_template).toContain("[First Name]");
  });

  it("defaults missing fields to empty strings (degrade-never-throw)", () => {
    const out = RecommendationArtefactResponseSchema.parse({ strategy: "only this" });
    expect(out.strategy).toBe("only this");
    expect(out.what_to_do).toBe("");
    expect(out.communication_channel).toBe("");
  });

  it("tolerates extra keys (plain object strips them, no throw)", () => {
    const out = RecommendationArtefactResponseSchema.parse({ status: "success", what_to_do: "x" });
    expect(out.what_to_do).toBe("x");
    expect("status" in out).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/signals/__tests__/contracts.test.ts`
Expected: FAIL — `RecommendationArtefactResponseSchema` is not exported.

- [ ] **Step 3: Add the schema**

In `frontend/src/features/signals/contracts.ts`, append:

```ts
// POST /api/generate-recommendation-artefact_claude — five LLM playbook sections.
// All optional + .default("") so a malformed/partial backend response still parses
// (degrade-never-throw, consistent with the lead-map schemas). No .strict(): the
// backend may add status/usage extras a plain object harmlessly strips.
export const RecommendationArtefactResponseSchema = z.object({
  what_to_do: z.string().optional().default(""),
  strategy: z.string().optional().default(""),
  how_to_communicate: z.string().optional().default(""),
  communication_channel: z.string().optional().default(""),
  communication_template: z.string().optional().default(""),
});
export type RecommendationArtefactResponse = z.infer<typeof RecommendationArtefactResponseSchema>;
```

- [ ] **Step 4: Add the service binding**

In `frontend/src/features/signals/services/signals.ts`, extend the `../contracts` import to add `RecommendationArtefactResponseSchema` and the `RecommendationArtefactResponse` type, then append the function:

```ts
/**
 * POST /api/generate-recommendation-artefact_claude — generate a GTM playbook
 * for one accepted-signal recommendation. `org_id` is forwarded only when
 * present (mirrors generateSignalsBatch); the backend treats absent and null
 * identically. The five-field response degrades to "" per field.
 */
export async function generateRecommendationArtefact(
  userId: string,
  orgId: string | null,
  body: {
    signal_headline: string;
    signal_description: string;
    signal_sources: string[];
    matched_leads: { company: string; relevance: "high" | "medium" | "low"; why: string }[];
    recommendation: string;
    recommendation_answer: string;
  },
): Promise<RecommendationArtefactResponse> {
  return apiPost(
    "generate-recommendation-artefact_claude",
    { user_id: userId, ...(orgId ? { org_id: orgId } : {}), ...body },
    RecommendationArtefactResponseSchema,
  );
}
```

- [ ] **Step 5: Add a service test (MSW)**

Create or extend `frontend/src/features/signals/services/__tests__/signals.test.ts` with a focused case (use the project's MSW server; follow the pattern in `hooks/__tests__/useSignalLeadMap.test.tsx` for server setup if no service test exists yet):

```ts
it("generateRecommendationArtefact posts the body and forwards org_id only when present", async () => {
  const seen: Array<Record<string, unknown>> = [];
  server.use(
    http.post("/api/generate-recommendation-artefact_claude", async ({ request }) => {
      seen.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ what_to_do: "do", communication_channel: "email" });
    }),
  );
  const body = {
    signal_headline: "h", signal_description: "d", signal_sources: ["s"],
    matched_leads: [{ company: "Acme", relevance: "high" as const, why: "fit" }],
    recommendation: "r", recommendation_answer: "a",
  };
  const withOrg = await generateRecommendationArtefact("u1", "org1", body);
  expect(withOrg.what_to_do).toBe("do");
  expect(withOrg.strategy).toBe(""); // degraded
  expect(seen[0].org_id).toBe("org1");

  await generateRecommendationArtefact("u1", null, body);
  expect("org_id" in seen[1]).toBe(false); // omitted when null
});
```

- [ ] **Step 6: Run the tests, typecheck, format, commit**

```bash
npx vitest run src/features/signals/__tests__/contracts.test.ts src/features/signals/services/__tests__/signals.test.ts
npm run typecheck
npx prettier --write src/features/signals/contracts.ts src/features/signals/services/signals.ts src/features/signals/__tests__/contracts.test.ts src/features/signals/services/__tests__/signals.test.ts
git -C "$WT" add frontend/src/features/signals/contracts.ts frontend/src/features/signals/services/signals.ts frontend/src/features/signals/__tests__/contracts.test.ts frontend/src/features/signals/services/__tests__/signals.test.ts
git -C "$WT" commit -m "feat(fe): add recommendation-artefact contract + service binding"
```

---

## Task 7: Frontend playbook builder

A pure function alongside `buildSignalBriefingArtefact` that maps a signal + recommendation + answer + leads + the LLM response onto an `ArtefactItem` per the §9 mapping. Reuses `resolveSignalAgentPresentation` and the existing `titleCase`.

> **Spec §9 correction:** the response is snake_case (matching the API + the lead-map contract), so the builder reads `generated.what_to_do` (not the spec's `generated.whatToDo`). All other §9 field names match.

**Files:**
- Modify: `frontend/src/features/signals/lib/signalBriefing.ts`
- Test: `frontend/src/features/signals/lib/__tests__/signalBriefing.test.ts`

**Interfaces:**
- Consumes: `NBAItem` from `../types`; `RecommendationArtefactResponse` from `../contracts`; `SignalLeadMapLead`; `ArtefactItem`.
- Produces: `buildRecommendationPlaybookArtefact(signal, recommendation, recommendationIndex, answer, leads, generated): ArtefactItem`.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/features/signals/lib/__tests__/signalBriefing.test.ts`:

```ts
import { buildRecommendationPlaybookArtefact } from "../signalBriefing";
import type { RecommendationArtefactResponse } from "../../contracts";

const generated: RecommendationArtefactResponse = {
  what_to_do: "Sequence the outreach.",
  strategy: "Win the DACH wedge.",
  how_to_communicate: "Warm, concise.",
  communication_channel: "email+linkedin",
  communication_template: "Hi [First Name], ...",
};

describe("buildRecommendationPlaybookArtefact", () => {
  const signalWithSource = {
    ...signal, // the existing `signal` fixture in this file
    source: [{ citation: "ACME Q3", url: "https://example.com/q3" }],
  };

  it("maps the playbook onto ArtefactItem fields (§9)", () => {
    const item = buildRecommendationPlaybookArtefact(
      signalWithSource,
      { nba: "Reach out now", prompt: "p" },
      2,
      "the cached answer",
      leads, // the existing `leads` fixture
      generated,
    );
    expect(item.id).toMatch(/^recommendation-playbook-s1-2-\d+$/);
    expect(item.type).toBe("playbook");
    expect(item.folder).toBe("GTM Playbooks");
    expect(item.taskNumber).toBe("GTM Playbook");
    expect(item.actionDelegated).toBe("Reach out now");
    expect(item.systemImpact).toBe("2 matched lead(s) targeted");
    expect(item.fullReport.title).toBe(signalWithSource.headline);
    // executive summary carries description + recommendation + a Sources line (D-5)
    expect(item.fullReport.executiveSummary).toContain("Reach out now");
    expect(item.fullReport.executiveSummary).toContain("Sources:");
    expect(item.fullReport.executiveSummary).toContain("ACME Q3");
    // analysis = strategy + what_to_do; recommendations carry the three labeled lines
    expect(item.fullReport.analysis).toContain("Win the DACH wedge.");
    expect(item.fullReport.analysis).toContain("Sequence the outreach.");
    expect(item.fullReport.recommendations[0]).toBe("Explanation: the cached answer");
    expect(item.fullReport.recommendations[1]).toContain("How to Communicate (email+linkedin)");
    expect(item.fullReport.recommendations[2]).toContain("Communication Template:");
  });

  it("omits the Sources line when the signal has no source, and degrades on empty LLM fields", () => {
    const item = buildRecommendationPlaybookArtefact(
      signal,
      { nba: "X", prompt: "" },
      0,
      "",
      [],
      { what_to_do: "", strategy: "", how_to_communicate: "", communication_channel: "", communication_template: "" },
    );
    expect(item.fullReport.executiveSummary).not.toContain("Sources:");
    expect(item.systemImpact).toBe("0 matched lead(s) targeted");
    expect(item.fullReport.keyFindings).toEqual([]);
    expect(item.type).toBe("playbook"); // still a valid item
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/signals/lib/__tests__/signalBriefing.test.ts`
Expected: FAIL — `buildRecommendationPlaybookArtefact` is not exported.

- [ ] **Step 3: Add the builder**

In `frontend/src/features/signals/lib/signalBriefing.ts`, **extend the existing imports** — add `RecommendationArtefactResponse` to the existing `../contracts` import (line 4, which already imports `SignalLeadMapLead`) and `NBAItem` to the `../types` import (line 5). Do **not** add a second `../contracts` line:

```ts
import type { RecommendationArtefactResponse, SignalLeadMapLead } from "../contracts";
import type { NBAItem, SignalCard } from "../types";
```

```ts
/** One playbook ArtefactItem from a recommendation + its LLM-generated sections (Spec 41 §9). */
export function buildRecommendationPlaybookArtefact(
  signal: SignalCard,
  recommendation: NBAItem,
  recommendationIndex: number,
  answer: string,
  leads: SignalLeadMapLead[],
  generated: RecommendationArtefactResponse,
): ArtefactItem {
  const { agentName, agentIcon, agentColor } = resolveSignalAgentPresentation(signal.agent);

  // D-5: flatten SourceCitation[] (citation, falling back to url) into a Sources line.
  const sources = (signal.source ?? []).map((s) => s.citation || s.url).filter(Boolean);
  const sourcesLine = sources.length ? `\n\nSources: ${sources.join("; ")}` : "";

  const keyFindings = leads.map((lead) => {
    const company = lead.company || "Unknown company";
    const head = `${company} (Relevance: ${titleCase(lead.relevance)})`;
    return lead.why ? `${head}: ${lead.why}` : head;
  });

  return {
    id: `recommendation-playbook-${signal.id}-${recommendationIndex}-${Date.now()}`,
    agentName,
    agentIcon,
    agentColor,
    taskNumber: "GTM Playbook",
    timestamp: signal.timestamp,
    status: "new",
    type: "playbook",
    folder: "GTM Playbooks",
    actionDelegated: recommendation.nba,
    contextRationale: signal.description.slice(0, 200),
    systemImpact: `${leads.length} matched lead(s) targeted`,
    actionPerformed: "Generated GTM playbook for recommendation",
    outputSummary: generated.strategy.slice(0, 150),
    fullReport: {
      title: signal.headline,
      executiveSummary: `${signal.description}\n\nRecommendation: ${recommendation.nba}${sourcesLine}`,
      keyFindings,
      analysis: `${generated.strategy}\n\n${generated.what_to_do}`,
      recommendations: [
        `Explanation: ${answer}`,
        `How to Communicate (${generated.communication_channel}): ${generated.how_to_communicate}`,
        `Communication Template:\n${generated.communication_template}`,
      ],
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes; typecheck, format, commit**

```bash
npx vitest run src/features/signals/lib/__tests__/signalBriefing.test.ts
npm run typecheck
npx prettier --write src/features/signals/lib/signalBriefing.ts src/features/signals/lib/__tests__/signalBriefing.test.ts
git -C "$WT" add frontend/src/features/signals/lib/signalBriefing.ts frontend/src/features/signals/lib/__tests__/signalBriefing.test.ts
git -C "$WT" commit -m "feat(fe): add recommendation playbook ArtefactItem builder"
```

---

## Task 8: PDF generator upgrade — adopt jsPDF (partially resolves TD-FE-78)

Replace the hand-rolled byte-string `createSimplePDF` (fabricated xref, hardcoded `/Length 2000`, single `MediaBox`, no wrap/pagination) with a jsPDF document builder that wraps (`splitTextToSize`) and paginates (`addPage` + Y-cursor). Keep `generateAndDownloadPDF`'s public signature; drop the now-unneeded structural paren/backslash escaping (jsPDF owns string encoding) but **keep the ASCII-folding** as the WinAnsi safety net. **Two live consumers must not regress:** the Spec 38 briefing (`SignalsPage.tsx`) and the Artefacts re-download (`ArtifactsPage.tsx:130`).

**Files:**
- Modify: `frontend/package.json` (add `jspdf` ^4)
- Modify: `frontend/src/features/artifacts/lib/artefactPdf.ts`
- Test: `frontend/src/features/artifacts/lib/__tests__/artefactPdf.test.ts`

**Interfaces:**
- Produces: `escapePdfText` (ASCII-fold only now), `buildArtefactPdfDoc(artefact): jsPDF`, `buildArtefactPdfBlob(artefact): Blob`; `generateAndDownloadPDF(artefact): void` unchanged. `createSimplePDF` is **removed**.

- [ ] **Step 1: Add the dependency**

From `frontend/`:
```bash
npm install jspdf@^4
```
Confirm `jspdf` resolves to a 4.x version in `package.json` + `package-lock.json` (4.x carries the CVE-2025-68428 fix; `^4.0.0` resolves to the secure line).

- [ ] **Step 2: Write the failing tests**

Replace `frontend/src/features/artifacts/lib/__tests__/artefactPdf.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { mockArtefacts } from "../../data/mockArtefacts";
import type { ArtefactItem } from "../../types";
import {
  buildArtefactPdfBlob,
  buildArtefactPdfDoc,
  escapePdfText,
} from "../artefactPdf";

describe("escapePdfText (ASCII-fold only after jsPDF migration)", () => {
  it("folds typographic offenders to ASCII", () => {
    expect(escapePdfText("A—B")).toBe("A-B");
    expect(escapePdfText("A–B")).toBe("A-B");
    expect(escapePdfText("“q”")).toBe('"q"');
    expect(escapePdfText("it’s")).toBe("it's");
    expect(escapePdfText("• item")).toBe("- item");
  });

  it("no longer escapes structural ( ) \\ — jsPDF owns encoding now", () => {
    expect(escapePdfText("a (b) c")).toBe("a (b) c");
    expect(escapePdfText("back\\slash")).toBe("back\\slash");
  });
});

const longArtefact = (): ArtefactItem => ({
  ...mockArtefacts[0],
  fullReport: {
    ...mockArtefacts[0].fullReport,
    title: "Acme (Pilot) — rollout",
    executiveSummary: "Para. ".repeat(400), // long enough to overflow one page
    keyFindings: Array.from({ length: 30 }, (_, i) => `Lead ${i} (Relevance: High): long rationale ${"x".repeat(80)}`),
    analysis: "Analysis. ".repeat(400),
    recommendations: ["Communication Template:\n" + "line\n".repeat(60)],
  },
});

describe("buildArtefactPdf*", () => {
  it("returns a %PDF-headed Blob and does not throw on long, multi-section, paren/dash content", async () => {
    const blob = buildArtefactPdfBlob(longArtefact());
    expect(blob).toBeInstanceOf(Blob);
    const head = (await blob.text()).slice(0, 5);
    expect(head.startsWith("%PDF")).toBe(true);
  });

  it("paginates long input to more than one page", () => {
    const doc = buildArtefactPdfDoc(longArtefact());
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it("produces a single page for short input", () => {
    const doc = buildArtefactPdfDoc(mockArtefacts[0]);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
```

> Note: jsPDF emits a compressed content stream, so the old substring assertions on rendered body text are dropped in favour of structural checks (valid `%PDF` header, real page count via `getNumberOfPages()`, and no-throw on adversarial content). This is the honest replacement for raw-byte assertions.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/features/artifacts/lib/__tests__/artefactPdf.test.ts`
Expected: FAIL — `buildArtefactPdfDoc`/`buildArtefactPdfBlob` not exported; `escapePdfText` still escapes parens.

- [ ] **Step 4: Rewrite `artefactPdf.ts`**

Replace the whole file with:

```ts
import { jsPDF } from "jspdf";

import type { ArtefactItem } from "../types";

// jsPDF owns PDF string encoding, so structural ( ) \ escaping is no longer
// needed. We keep ASCII-folding as a WinAnsi safety net: jsPDF's default
// Helvetica still mojibakes em/en dashes, smart quotes and bullets. (Residual
// non-ASCII such as accented names remains an accepted limitation — the
// Unicode-font-embedding half of TD-FE-78 stays open; no font is embedded here.)
export const escapePdfText = (input: string): string =>
  (input ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, "-");

const MARGIN = 50;

/** Build a structurally valid, wrapped + paginated PDF for an ArtefactItem. */
export const buildArtefactPdfDoc = (artefact: ArtefactItem): jsPDF => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  const lineHeight = () => doc.getLineHeight() / doc.internal.scaleFactor;
  const ensureSpace = () => {
    if (y + lineHeight() > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const writeBlock = (text: string, fontSize: number, bold: boolean) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(escapePdfText(text || ""), maxWidth) as string[];
    for (const line of lines) {
      ensureSpace();
      doc.text(line, MARGIN, y);
      y += lineHeight();
    }
  };
  const gap = (pts: number) => {
    y += pts;
  };

  const { fullReport } = artefact;
  writeBlock(fullReport.title, 18, true);
  gap(4);
  writeBlock(
    `Generated by: ${artefact.agentName} | ${artefact.timestamp} | Task ID: ${artefact.taskNumber}`,
    9,
    false,
  );
  gap(12);

  writeBlock("EXECUTIVE SUMMARY", 13, true);
  writeBlock(fullReport.executiveSummary, 10, false);
  gap(10);

  writeBlock("KEY FINDINGS", 13, true);
  fullReport.keyFindings.forEach((f, i) => writeBlock(`${i + 1}. ${f}`, 10, false));
  gap(10);

  writeBlock("ANALYSIS", 13, true);
  writeBlock(fullReport.analysis, 10, false);
  gap(10);

  writeBlock("RECOMMENDATIONS", 13, true);
  fullReport.recommendations.forEach((r, i) => writeBlock(`${i + 1}. ${r}`, 10, false));
  gap(16);

  writeBlock(`Generated by Brewra AI • ${new Date().toLocaleDateString()}`, 8, false);

  return doc;
};

export const buildArtefactPdfBlob = (artefact: ArtefactItem): Blob =>
  buildArtefactPdfDoc(artefact).output("blob");

export const generateAndDownloadPDF = (artefact: ArtefactItem): void => {
  const blob = buildArtefactPdfBlob(artefact);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const slug = artefact.fullReport.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  // Short uniquifier so re-saving the same artefact doesn't overwrite the prior file.
  link.download = `${slug}-${Date.now()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 5: No-regression — both shared consumers**

Run the tests for the two live `generateAndDownloadPDF` consumers (the briefing save + the Artefacts re-download), so neither regresses:
```bash
npx vitest run \
  src/features/artifacts/lib/__tests__/artefactPdf.test.ts \
  src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx \
  src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx
```
Expected: PASS. (The ArtifactsPage test re-downloads a saved artefact via the same generator; the SignalsPage cta test covers the Spec 38 briefing save. If either asserted raw-PDF bytes, update those assertions to the structural form from Step 2.)

- [ ] **Step 6: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/artifacts/lib/artefactPdf.ts src/features/artifacts/lib/__tests__/artefactPdf.test.ts
git -C "$WT" add frontend/package.json frontend/package-lock.json frontend/src/features/artifacts/lib/artefactPdf.ts frontend/src/features/artifacts/lib/__tests__/artefactPdf.test.ts
git -C "$WT" commit -m "feat(fe): rewrite PDF generator with jsPDF (wrap + paginate); partially resolves TD-FE-78"
```

---

## Task 9: SignalCard — recommendation "Save as Artifact" button + row restructure

Add the two new props, card-local hint state, the gated Save button in the recommendation answer action row (`:448`), restructure that row to `justify-between`, and relabel the existing signal-level button (`:184`). Only one recommendation expands at a time (`expandedRecommendationIndex` is a single index), so a single card-level `artefactHint: string | null` carries either gating message (refines the spec's `Record<number, boolean>`, which can't carry the two distinct hint texts).

**Files:**
- Modify: `frontend/src/features/signals/components/SignalCard.tsx`
- Test: `frontend/src/features/signals/components/__tests__/SignalCard.cta.test.tsx` (extend)
- Fix: `frontend/src/features/signals/components/__tests__/{SignalCard,SignalCard.affects}.test.tsx` (required-prop defaults)

**Interfaces:**
- Produces (new `SignalCardProps`): `onSaveRecommendationAsArtefact: (index: number) => void`; `recommendationArtefactGeneratingKey: string | null`.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/features/signals/components/__tests__/SignalCard.cta.test.tsx`. First add the two new props to the existing `renderCard` defaults:

```tsx
    onSaveRecommendationAsArtefact: vi.fn(),
    recommendationArtefactGeneratingKey: null,
    recommendationArtefactErrorKey: null,
```

Then add a describe block (the button lives in the expanded recommendation answer block, so render with a prompt-bearing NBA expanded):

```tsx
describe("SignalCard — recommendation Save as Artifact", () => {
  const withRec = {
    signal: { ...signal, NBAs: [{ nba: "Reach out", prompt: "p1" }] },
    isDescriptionExpanded: true,
    expandedRecommendationIndex: 0,
  };

  it("is greyed and shows the accept hint when not accepted", () => {
    const props = renderCard({ ...withRec, isAccepted: false, recommendationAnswers: { "sig-1-0": "ans" } });
    const btn = screen.getByRole("button", { name: /Save as Artifact/i });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    expect(screen.getByText(/Accept this signal to save as artifact/i)).toBeInTheDocument();
    expect(props.onSaveRecommendationAsArtefact).not.toHaveBeenCalled();
  });

  it("is greyed and shows the load-answer hint when accepted but no cached answer", () => {
    const props = renderCard({ ...withRec, isAccepted: true, recommendationAnswers: {} });
    fireEvent.click(screen.getByRole("button", { name: /Save as Artifact/i }));
    expect(screen.getByText(/Load the recommendation answer first/i)).toBeInTheDocument();
    expect(props.onSaveRecommendationAsArtefact).not.toHaveBeenCalled();
  });

  it("is active and calls onSaveRecommendationAsArtefact(index) when accepted + cached", () => {
    const props = renderCard({ ...withRec, isAccepted: true, recommendationAnswers: { "sig-1-0": "ans" } });
    fireEvent.click(screen.getByRole("button", { name: /Save as Artifact/i }));
    expect(props.onSaveRecommendationAsArtefact).toHaveBeenCalledWith(0);
  });

  it("shows a generating spinner when the key matches", () => {
    renderCard({
      ...withRec,
      isAccepted: true,
      recommendationAnswers: { "sig-1-0": "ans" },
      recommendationArtefactGeneratingKey: "sig-1-0",
    });
    expect(screen.getByText(/Generating/i)).toBeInTheDocument();
  });

  it("shows the inline error when the page-owned error key matches", () => {
    renderCard({
      ...withRec,
      isAccepted: true,
      recommendationAnswers: { "sig-1-0": "ans" },
      recommendationArtefactErrorKey: "sig-1-0",
    });
    expect(screen.getByText(/Could not generate artifact/i)).toBeInTheDocument();
  });

  it("renders the answer action row as justify-between with Chat on the right", () => {
    renderCard({ ...withRec, isAccepted: true, recommendationAnswers: { "sig-1-0": "ans" } });
    expect(screen.getByRole("button", { name: /Chat with Scout/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save as Artifact/i })).toBeInTheDocument();
  });
});
```

(Confirm the `signal` fixture id in this file is `sig-1`; adjust the `sig-1-0` keys if it differs.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/signals/components/__tests__/SignalCard.cta.test.tsx`
Expected: FAIL — no "Save as Artifact" button in the answer row; typecheck-fail on the new props.

- [ ] **Step 3: Add the two props**

In `SignalCard.tsx`, add to `SignalCardProps` (after `onRecomputeLeadMap?`):

```tsx
  /** Build + generate + deliver the recommendation playbook for `index`. */
  onSaveRecommendationAsArtefact: (index: number) => void;
  /** Page-held `${signalId}-${index}` currently generating a playbook, or null. */
  recommendationArtefactGeneratingKey: string | null;
  /** Page-held `${signalId}-${index}` whose last generation failed (drives the inline error). */
  recommendationArtefactErrorKey: string | null;
```

Destructure them in the component signature (alongside `onRecomputeLeadMap`):

```tsx
  onSaveRecommendationAsArtefact,
  recommendationArtefactGeneratingKey,
  recommendationArtefactErrorKey,
```

- [ ] **Step 4: Add the hint state + click handler**

After the existing `handleFindClick` (~line 134), add:

```tsx
  const [artefactHint, setArtefactHint] = useState<string | null>(null);
  const artefactHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearArtefactHintTimer = () => {
    if (artefactHintTimerRef.current) {
      clearTimeout(artefactHintTimerRef.current);
      artefactHintTimerRef.current = null;
    }
  };
  const showArtefactHint = (msg: string) => {
    clearArtefactHintTimer();
    setArtefactHint(msg);
    artefactHintTimerRef.current = setTimeout(() => setArtefactHint(null), 3000);
  };

  // Gated click: explain when locked, otherwise delegate to the page (D-2/D-6).
  const handleSaveArtefactClick = (index: number) => {
    const key = `${signal.id}-${index}`;
    if (!isAccepted) {
      showArtefactHint("Accept this signal to save as artifact");
      return;
    }
    if ((recommendationAnswers[key] ?? "").trim() === "") {
      showArtefactHint("Load the recommendation answer first.");
      return;
    }
    clearArtefactHintTimer();
    setArtefactHint(null);
    onSaveRecommendationAsArtefact(index);
  };
```

Extend the existing collapse + unmount effects to also clear the hint: in the `if (!isDescriptionExpanded)` effect body add `clearArtefactHintTimer(); setArtefactHint(null);`, and change the unmount effect to `useEffect(() => () => { clearLockTimer(); clearArtefactHintTimer(); }, []);`.

- [ ] **Step 5: Compute per-recommendation flags in the map callback**

In the recommendations `.map((item, index) => {...})` (after `const hasPrompt = ...`, ~line 356), add:

```tsx
                                const artefactKey = `${signal.id}-${index}`;
                                const answerCached =
                                  (recommendationAnswers[artefactKey] ?? "").trim() !== "";
                                const isGeneratingArtefact =
                                  recommendationArtefactGeneratingKey === artefactKey;
                                const showArtefactError =
                                  recommendationArtefactErrorKey === artefactKey;
                                const canSaveArtefact = isAccepted && answerCached;
```

- [ ] **Step 6: Restructure the answer action row + add the Save button**

In the action row at line 448, change the container className and wrap the existing accept+reject buttons (plus the new Save button) in a left group, keeping Chat as the right child. Specifically:

(a) Change the container `className` (old → new):
```
old: <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
new: <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200">
```

(b) Immediately after that opening `<div ...>`, open a left group `<div className="flex items-center gap-2">`; close it (`</div>`) **after** the reject `</Button>` and **before** the Chat `<Button ...>`. Inside the left group, after the reject button, add the Save button:

```tsx
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        role="button"
                                                        aria-disabled={!canSaveArtefact || isGeneratingArtefact}
                                                        className={
                                                          canSaveArtefact
                                                            ? "text-xs font-medium h-8 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"
                                                            : "text-xs font-medium h-8 border-gray-300 text-gray-400 cursor-not-allowed"
                                                        }
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (isGeneratingArtefact) return;
                                                          handleSaveArtefactClick(index);
                                                        }}
                                                      >
                                                        {isGeneratingArtefact ? (
                                                          <>
                                                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                                            Generating…
                                                          </>
                                                        ) : (
                                                          "Save as Artifact"
                                                        )}
                                                      </Button>
```

(c) After the action row's closing `</div>` (still inside the `<>` of the not-loading branch, before the closing `)}` of `hasPrompt`), add the hint line:

```tsx
                                                  {artefactHint && (
                                                    <p role="status" className="mt-2 text-xs text-amber-700">
                                                      {artefactHint}
                                                    </p>
                                                  )}
                                                  {showArtefactError && !artefactHint && (
                                                    <p role="alert" className="mt-2 text-xs text-red-600">
                                                      Could not generate artifact — please try again.
                                                    </p>
                                                  )}
```

> **Inline error (plan-review F1).** Spec §6.3/§10 + acceptance criterion #6 require the failure to surface **inline below the row** (not toast-only). Since the card's `artefactHint` is card-local and the page can't set it after an async failure, the page owns a `recommendationArtefactErrorKey` (Task 10) the card renders here when it matches `artefactKey`. The page clears it on retry (handler start) and on collapse, and the per-key match means a stale error only ever shows on the recommendation that actually failed.

- [ ] **Step 7: Relabel the existing signal-level button (D-7)**

Change the leads-section Save button label (line 184):
```
old: Save as Artefact
new: Save as Artifact
```

- [ ] **Step 8: Run the new tests + fix the sibling SignalCard tests**

Run: `npx vitest run src/features/signals/components/__tests__/SignalCard.cta.test.tsx`
Expected: PASS (existing CTA cases + 6 new). Note the existing test that asserts the old leads-section label `/Save as Artefact/i` must be updated to `/Save as Artifact/i`.

Then the two sibling files render `SignalCard` without the new required props — add the defaults to each `props`/`renderCard` object:
```tsx
    onSaveRecommendationAsArtefact: vi.fn(),
    recommendationArtefactGeneratingKey: null,
    recommendationArtefactErrorKey: null,
```
Run: `npx vitest run src/features/signals/components/__tests__/SignalCard.test.tsx src/features/signals/components/__tests__/SignalCard.affects.test.tsx`
Expected: PASS.

- [ ] **Step 9: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write \
  src/features/signals/components/SignalCard.tsx \
  src/features/signals/components/__tests__/SignalCard.cta.test.tsx \
  src/features/signals/components/__tests__/SignalCard.test.tsx \
  src/features/signals/components/__tests__/SignalCard.affects.test.tsx
git -C "$WT" add \
  frontend/src/features/signals/components/SignalCard.tsx \
  frontend/src/features/signals/components/__tests__/SignalCard.cta.test.tsx \
  frontend/src/features/signals/components/__tests__/SignalCard.test.tsx \
  frontend/src/features/signals/components/__tests__/SignalCard.affects.test.tsx
git -C "$WT" commit -m "feat(fe): add recommendation Save as Artifact button + relabel signal-level button"
```

---

## Task 10: SignalsPage — state, handler, wiring, toast relabel

Own the page-level generating-state, implement `handleSaveRecommendationAsArtefact` (resolve item exactly as the answer-fetch effect does; guard accepted + non-null org + cached answer; call the service; build → download → enqueue → playbook toast; clear state in `finally`), wire the two new props, and relabel the existing briefing toast (D-7).

**Files:**
- Modify: `frontend/src/features/signals/pages/SignalsPage.tsx`
- Test: `frontend/src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx` (new)

**Interfaces:**
- Consumes: `generateRecommendationArtefact` (Task 6); `buildRecommendationPlaybookArtefact` (Task 7); `enqueueArtefact`, `generateAndDownloadPDF`; the new `SignalCard` props (Task 9).
- Produces: page state `recommendationArtefactGenerating: string | null`; handler `handleSaveRecommendationAsArtefact(signal, index)`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx` (model the mocks on the existing `SignalsPage.cta.test.tsx`; the key additions are mocking the recommendation answer + the new service):

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignalsPage from "../SignalsPage";

import { enqueueArtefact, generateAndDownloadPDF } from "@/features/artifacts";

const SIGNAL = {
  id: "sig-1", agent: "scout", timestamp: "1h ago", headline: "Hiring surge",
  snippet: "s", description: "Detailed ICP context.", sourceUrl: "#", sourceLabel: "Press",
  source: [], nextBestMoves: [], NBAs: [{ nba: "Reach out", prompt: "why-prompt" }],
  contextualSuggestions: [],
};
const LEADS = [{ lead_id: "l1", company: "Acme", relevance: "high", why: "fit" }];

vi.mock("@/shared/auth", () => ({ useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }) }));
vi.mock("../hooks/useSignalLeadMap", () => ({
  useSignalLeadMap: () => ({
    leadsForSignal: (id: string) => (id === "sig-1" ? LEADS : []),
    isLoading: false, isError: false, refresh: vi.fn(),
  }),
}));
vi.mock("../services/signals", () => ({
  fetchSignals: vi.fn().mockResolvedValue({}),
  generateSignalsBatch: vi.fn().mockResolvedValue({}),
  generateRecommendationArtefact: vi.fn().mockResolvedValue({
    what_to_do: "do", strategy: "play", how_to_communicate: "warm",
    communication_channel: "email", communication_template: "Hi [First Name]",
  }),
}));
vi.mock("../components/signalCards", () => ({
  buildSignalCardsFromFetchData: () => [SIGNAL],
  applyRejectedFilterAndSort: (s: unknown[]) => s,
  getFallbackSampleSignals: () => [SIGNAL],
  getSignalContentHash: (s: { id: string }) => `hash-${s.id}`,
  sanitizeSourceUrl: (u: string) => u,
}));
vi.mock("@/shared/chat", () => ({ writeSessionChatContext: vi.fn() }));
vi.mock("@/shared/chat/useSignalAction", () => ({ useSignalAction: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }) }));
vi.mock("@/shared/chat/useSignalAsk", () => ({
  useSignalAsk: () => ({ mutateAsync: vi.fn().mockResolvedValue({ answer: "the answer" }) }),
}));
vi.mock("@/features/artifacts", () => ({ enqueueArtefact: vi.fn(), generateAndDownloadPDF: vi.fn() }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{(<SignalsPage />) as ReactNode}</MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => localStorage.clear());

describe("SignalsPage — Save recommendation as Artifact", () => {
  it("builds, downloads, and enqueues a playbook on Save", async () => {
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());
    const card = screen.getByText("Hiring surge").closest(".bg-white") as HTMLElement;

    fireEvent.click(within(card).getByText("Read more")); // expand description
    fireEvent.click(within(card).getByText("Reach out")); // expand recommendation → fetches answer
    await waitFor(() =>
      expect(within(card).getByRole("button", { name: /Save as Artifact/i }).getAttribute("aria-disabled")).toBe("false"),
    );
    fireEvent.click(within(card).getByRole("button", { name: /Save as Artifact/i }));

    await waitFor(() => expect(generateAndDownloadPDF).toHaveBeenCalledTimes(1));
    expect(enqueueArtefact).toHaveBeenCalledTimes(1);
    const item = vi.mocked(enqueueArtefact).mock.calls[0][0];
    expect(item.type).toBe("playbook");
    expect(item.id).toMatch(/^recommendation-playbook-sig-1-0-\d+$/);
  });

  it("shows the inline error and skips delivery when the backend rejects", async () => {
    const { generateRecommendationArtefact } = await import("../services/signals");
    vi.mocked(generateRecommendationArtefact).mockRejectedValueOnce(new Error("boom"));
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());
    const card = screen.getByText("Hiring surge").closest(".bg-white") as HTMLElement;
    fireEvent.click(within(card).getByText("Read more"));
    fireEvent.click(within(card).getByText("Reach out"));
    await waitFor(() =>
      expect(
        within(card).getByRole("button", { name: /Save as Artifact/i }).getAttribute("aria-disabled"),
      ).toBe("false"),
    );
    fireEvent.click(within(card).getByRole("button", { name: /Save as Artifact/i }));
    // The destructive toast also carries this copy; within(card) scopes to the inline-below-row <p>.
    await waitFor(() =>
      expect(within(card).getByText(/Could not generate artifact/i)).toBeInTheDocument(),
    );
    expect(generateAndDownloadPDF).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx`
Expected: FAIL — no `Save as Artifact` button wired / handler absent.

- [ ] **Step 3: Imports + page state**

In `SignalsPage.tsx`:
- Line 15: `import { buildRecommendationPlaybookArtefact, buildSignalBriefingArtefact } from "../lib/signalBriefing";`
- Line 16: `import { fetchSignals, generateRecommendationArtefact, generateSignalsBatch } from "../services/signals";`
- After `recommendationAnswerLoading` state (~line 83), add:
```tsx
  /** Key `${signalId}-${index}` of the recommendation currently generating a playbook. */
  const [recommendationArtefactGenerating, setRecommendationArtefactGenerating] = useState<
    string | null
  >(null);
  /** Key `${signalId}-${index}` whose last playbook generation failed (drives the card's inline error). */
  const [recommendationArtefactError, setRecommendationArtefactError] = useState<string | null>(
    null,
  );
```
- Clear a stale error on collapse: in the existing `expandedRecommendation` reset effect (`SignalsPage.tsx:88-92`, the `if (!expandedRecommendation) { setAnswerExpandedKeys(new Set()); }` block), add `setRecommendationArtefactError(null);` in the same block.

- [ ] **Step 4: Add the handler**

After `handleSaveAsArtefact` (~line 545), add:

```tsx
  const handleSaveRecommendationAsArtefact = async (signal: SignalCardType, index: number) => {
    // Resolve the item exactly as the card/effect do, so `index` maps to the same
    // list the card indexed (NBAs, falling back to nextBestMoves).
    const list: NBAItem[] =
      signal.NBAs && signal.NBAs.length > 0
        ? signal.NBAs
        : (signal.nextBestMoves ?? []).map((m) => ({ nba: m, prompt: "" }));
    const item = list[index];
    const key = `${signal.id}-${index}`;
    const answer = recommendationAnswers[key];
    const isAccepted = acceptedSignals.has(getSignalContentHash(signal));
    // Re-check the gate (the button already blocks the click): accepted + non-null
    // org + a non-empty cached answer. orgId is string | null here.
    if (!item || !isAccepted || !orgId || !currentUser?.uid || !(answer ?? "").trim()) return;

    setRecommendationArtefactError(null); // clear any prior failure on retry
    setRecommendationArtefactGenerating(key);
    try {
      const leads = leadsForSignal(signal.id);
      const generated = await generateRecommendationArtefact(currentUser.uid, orgId, {
        signal_headline: signal.headline,
        signal_description: signal.description,
        signal_sources: (signal.source ?? []).map((s) => s.citation || s.url).filter(Boolean),
        matched_leads: leads.map((l) => ({ company: l.company, relevance: l.relevance, why: l.why })),
        recommendation: item.nba,
        recommendation_answer: answer,
      });
      const artefact = buildRecommendationPlaybookArtefact(signal, item, index, answer, leads, generated);
      generateAndDownloadPDF(artefact);
      enqueueArtefact(artefact);
      toast({
        title: "Saved to Artifacts",
        description: "Your GTM playbook was downloaded and added to the Artifacts library.",
        action: (
          <Button variant="outline" size="sm" onClick={() => navigate("/artifacts")}>
            View →
          </Button>
        ),
      });
    } catch (error) {
      console.error("Error generating recommendation artefact:", error);
      setRecommendationArtefactError(key); // inline-below-row error (spec §6.3/§10/AC#6), in addition to the toast
      toast({
        title: "Error",
        description: "Could not generate artifact — please try again.",
        variant: "destructive",
      });
    } finally {
      setRecommendationArtefactGenerating(null);
    }
  };
```

(`getSignalContentHash` is already imported, line 10; `NBAItem` is already imported, line 17.)

- [ ] **Step 5: Relabel the existing briefing toast (D-7)**

In `handleSaveAsArtefact` (lines 537-538):
```
old: title: "Saved to Artefacts",
new: title: "Saved to Artifacts",
old: description: "Your signal briefing was downloaded and added to the Artefacts library.",
new: description: "Your signal briefing was downloaded and added to the Artifacts library.",
```

- [ ] **Step 6: Wire the two new props**

In the `<SignalCard>` render, after `onRecomputeLeadMap={...}` (line 817), add:

```tsx
                    onSaveRecommendationAsArtefact={(index) =>
                      void handleSaveRecommendationAsArtefact(signal, index)
                    }
                    recommendationArtefactGeneratingKey={recommendationArtefactGenerating}
                    recommendationArtefactErrorKey={recommendationArtefactError}
```

- [ ] **Step 7: Run the test; typecheck, format, commit**

```bash
npx vitest run src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx
npm run typecheck
npx prettier --write src/features/signals/pages/SignalsPage.tsx src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx
git -C "$WT" add frontend/src/features/signals/pages/SignalsPage.tsx frontend/src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx
git -C "$WT" commit -m "feat(fe): wire recommendation Save-as-Artifact flow in SignalsPage"
```

---

## Task 11: TECH_DEBT — TD-FE-78 partial + stale-note fix

Record the jsPDF upgrade as a **partial** resolution of TD-FE-78 (xref + pagination done; Unicode-font embedding still open) and correct its stale "Strategist download path" note.

**Files:**
- Modify: `docs/TECH_DEBT.md`

> **Do not run prettier on `docs/TECH_DEBT.md`** — it's outside the FE prettier gate and prettier corrupts its unfenced markdown. Edit the TD-FE-78 entry surgically.

- [ ] **Step 1: Update the TD-FE-78 entry**

In the TD-FE-78 block: change its status/headline to mark it **partially resolved** — note that the shared PDF generator now emits a structurally valid xref and multi-page/wrapped output via jsPDF (Spec/Plan 41), and that the **remaining open** half is Unicode-capable font embedding (accented/non-Latin glyphs still ASCII-fold). Correct the stale "Shared with the Strategist artefact download path" line to name the real second consumer, `ArtifactsPage.tsx:130` (the Artefacts-library re-download), alongside the Spec 38 briefing save in `SignalsPage.tsx`.

- [ ] **Step 2: Commit**

```bash
git -C "$WT" add docs/TECH_DEBT.md
git -C "$WT" commit -m "docs: mark TD-FE-78 partially resolved (jsPDF xref + pagination)"
```

---

## Merge gate (controller, after all tasks)

- [ ] **Backend:** from `backend/`, run the unit suite — `.venv/bin/python -m pytest tests/unit -q` — all green (incl. `test_recommendation_artefact`, `test_prompts_loader`, `test_prompts_golden`).
- [ ] **Frontend:** from `frontend/`, run the full **serial** `npm run preflight` — typecheck, lint, format:check, vitest, build, advisory bundle:check (expect a jsPDF size bump — accepted), Playwright + VR, knip --strict. Green is the gate. (If the Insights VR step diffs ~7% under 4-worker contention, that's the known flake — re-run isolated; do not regenerate baselines.)
- [ ] Report any red check to the user; they decide fix-vs-abort. On green, the human-approved merge is `git checkout master && git merge --no-ff worktree-recommendation-artefact && git push origin master`.

---

## Acceptance Criteria (from Spec 41 §14)

1. With a signal **accepted** and a recommendation **answer loaded**, a "Save as Artifact" button in the recommendation answer row is active; clicking shows "Generating…", then downloads a PDF **and** the artefact appears in `/artifacts` under a "GTM Playbooks" folder, typed `playbook`. — Tasks 9 (button/gating), 10 (flow), 7 (`folder`/`type`).
2. The PDF/artefact contains all seven logical sections (signal context incl. sources, matched leads, explanation, what-to-do, strategy, how-to-communicate w/ an LLM-chosen channel, placeholder-bearing template), compressed into the five `fullReport` sections with label prefixes. — Tasks 2 (prompt), 7 (mapping), 8 (rendering).
3. When **not accepted**, the button is greyed and clicking shows the accept hint (3s); accepted-but-answer-not-cached shows the load-answer hint. — Task 9.
4. The signal-level "Save as Artifact" (Spec 38; relabelled from "Artefact" — copy only) behaves identically, and the upgraded renderer regresses **neither** its PDF **nor** the Artefacts-library re-download (`ArtifactsPage.tsx:130`). — Tasks 8 (Step 5 no-regression), 9/10 (relabel).
5. **PDF fidelity:** long strategy/template content produces a **multi-page** PDF where all text wraps within margins and nothing clips; valid `%PDF` header + real xref via jsPDF. **TD-FE-78 marked partially resolved** (xref + pagination; Unicode-font half open). — Tasks 8, 11.
6. Backend error/timeout yields the inline error + a re-enabled button; no hollow artefact is ever produced from a missing answer (D-2 gate + handler re-check). — Tasks 9, 10.
7. `npm run preflight` (incl. the migrated `artefactPdf` test) and the backend unit tests are green. — Merge gate.

## Self-review notes (resolved before finalizing)

- **Backend-first + live-verify (repo rule):** Tasks 1-4 land the endpoint; Task 5 confirms the JSON shape before the FE consumer (Task 6) is written. Task 5 has an explicit fallback (guard-500 + source-confirmed contract) for when the sandbox can't boot the lifespan or lacks a Claude key — defers the populated-shape check to post-deploy, recorded honestly.
- **Self-contained service:** unlike `signal_ask_claude`, the new service needs no driver/mongo/pc — all LLM inputs arrive in the body — so the route has no DB `Depends` and the service signature is `(request)` only. Verified against `ask.py` (which fetches profiles the FE here already supplies).
- **`_claude_budget` reuse is mechanically sound** and shares the 5-min token window with `signal_ask_claude` (accepted at MVP); the budget-exhaustion 429 carries an inherited `signal_ask_claude` label (cosmetic, never user-surfaced) — per Spec §7.1 D-3 / §10.
- **Loading state is page-owned (D-4):** the card receives `recommendationArtefactGeneratingKey` and reports clicks via the `void` callback `onSaveRecommendationAsArtefact(index)`; the page sets/clears the key around the await (mirrors `recommendationAnswerLoading`).
- **Inline error (plan-review F1, Medium):** the toast-only error path was a spec-fidelity gap vs §6.3/§10 + AC#6 (which require an inline-below-row message). Resolved within D-4 by a second page-owned key `recommendationArtefactErrorKey` the card renders below the row (red, `role="alert"`) — no awaitable callback. Cleared on retry + collapse; per-key match scopes it to the failed recommendation. Covered by a Task 9 card-render test + a Task 10 backend-reject wiring test.
- **Item resolution mirrors the card/effect** (`SignalCard.tsx:342-348` / `SignalsPage.tsx:255-260`), incl. the `nextBestMoves` → `{nba, prompt:""}` fallback, so `index` resolves to the same list the card indexed.
- **Spelling (D-7):** user-facing → "Artifact" (new + relabelled existing button/toast, Tasks 9/10); code identifiers stay "Artefact". The §13 relabel enumeration is honoured (SignalCard `:184`, SignalsPage `:537-538`).
- **jsPDF migration is the §8.5 scope:** wrap + paginate + valid xref; ASCII-fold kept, structural escaping dropped; no Unicode font embedded → TD-FE-78 stays partially open. Byte-level text assertions replaced by structural/page-count/no-throw checks (jsPDF emits a compressed stream).
- **No-regression for both shared consumers** is an explicit step (Task 8 Step 5): Spec 38 briefing save + ArtifactsPage re-download.
- **Spec §9 `whatToDo` casing corrected** to `what_to_do` (snake_case, matching the API + lead-map contract) in the builder.
