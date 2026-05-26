---
artifact: 13-prompt-management (Task 8, migrate icp/ prompts to backend/prompts/ + prompt_meta)
artifact_type: impl
verdict: findings
reviewer_model: claude-opus-4-7[1m]
date: 2026-05-26
round: 5
base_ref: fb722d7
spec_loaded: true
plan_loaded: true
---

## Context

Review covers the single-commit range `fb722d7..05e42d5` ("refactor(be): migrate icp/ prompts to backend/prompts/ + prompt_meta") for Task 8 of plan-13. Spec: `specs/13-prompt-management-design.md`. Plan: `plans/13-prompt-management.md` (Step 1–9 of the ICP migration section).

Diff stat: 24 files, +906/-474 (net +432). Files: 5 new `.md.j2` prompts, 5 input fixtures + 5 rendered fixtures, `orchestrator.py` / `persistence.py` / `__init__.py` modified, `prompts.py` deleted, `final_answer_directive.md.j2` partial modified, `test_icp.py` / `unit/test_icp.py` updated with `prompt_meta` assertions, `tests/helpers.py` adds `prompt_meta` to `DEFAULT_SCRUB_KEYS`, snapshot file updated.

Verification performed in-sandbox:

- **Byte-parity check**: extracted `prompts.py` at `fb722d7` to `/tmp/icp_prompts_legacy.py` and compared `ICP_*_TEMPLATE.format(pre_data="__SENTINEL_DATA__")` against `prompts.render(name, pre_data="__SENTINEL_DATA__").body` for all five prompts. **All five OK** (zero diff).
- **`list_prompts()` returns 5 ICP entries**, every entry `version=1.0.0`, `model=Qwen/Qwen3-235B-A22B-Instruct-2507-tput`, `response_format=json`. No other prompts visible (partials filtered correctly).
- **`backend/app/services/icp/prompts.py` is gone**; `rg 'from app.services.icp.prompts|from \.prompts'` over `backend/app/` and `backend/tests/` returns empty; `rg 'ICP_GENERATOR_TEMPLATE|ICP_RESEARCH_._TEMPLATE'` over `backend/` returns empty. Remaining references live only in `docs/prompt-inventory.md` and `plans/13-prompt-management.md` (audit + plan documents, not imports).
- **Fixtures present**: 5 `_inputs/icp_*.json` + 5 `rendered/icp_*.txt`. Inputs use the canonical Acme Corp shape; rendered outputs are 47–108 lines, consistent with the source template sizes.
- **Targeted test run** (`pytest tests/unit/test_icp.py tests/test_icp.py tests/test_icp_v2.py tests/unit/test_prompts_golden.py -q`): **44 passed, 1 skipped, 10 snapshots passed**.
- **Full suite** (`pytest --no-header -q`): **297 passed, 1 skipped, 19 snapshots passed** — exactly matches implementer's claim (+5 vs prior 292/2 baseline). Net snapshot count went from 17 to 19 → 2 new snapshots from the `prompt_meta` additions.
- **Orchestrator unpack**: every one of `ICP_generator` and `icp_research_1..4` ends with `return parsed_json, prompt_meta`. `_run_icp_research_impl` unpacks via `research_result, prompt_meta = await asyncio.to_thread(...)` and writes `"prompt_meta": prompt_meta` into the document passed to `insert_one` (verified in the `research_result.update({...})` block at the end of the function).
- **`list_icps` unpack**: `icp_result, prompt_meta = ICP_generator(agent_chain, company_profile)`, then `collection.update_one({"user_id": user_id}, {"$set": {..., "prompt_meta": prompt_meta}}, upsert=True)`. Production code path persists `prompt_meta` — not just test mocks.
- **Snapshot scrub**: `tests/helpers.py` adds `"prompt_meta"` to `DEFAULT_SCRUB_KEYS` with a comment explaining the non-deterministic fields (`rendered_at`, hashes). Snapshot diff shows `prompt_meta: '<scrubbed>'` appearing in 4 places in `test_icp.ambr` — correct scrub, no content_hash leakage.
- **Shared-partial trailing-newline**: I confirmed via legacy import that `ICP_GENERATOR_TEMPLATE.format(...)` does not end in `\n`. Without stripping the partial's trailing newline, the new render would have introduced one and broken byte-parity. So the strip is *necessary* given the byte-parity contract (spec §1).
- **Commit hygiene**: subject is `refactor(be): migrate icp/ prompts to backend/prompts/ + prompt_meta`; no `Co-Authored-By` / `Claude` footer; body cleanly explains the change and explicitly flags the `DEFAULT_SCRUB_KEYS` decision and the no-shim deletion of `prompts.py`. Diff is scoped tightly — no unrelated edits.

Findings are below. None are Critical or High. The one Medium concerns the shared-partial change documentation; the Lows are minor robustness/wash-up items.

## Findings

### [Medium] Shared partial's no-trailing-newline contract is not self-documented

**Location:** `backend/prompts/_shared/final_answer_directive.md.j2` (entire file, post-edit)

```yaml
---
name: final_answer_directive
version: 1.0.0
description: Shared trailer — stop after Final Answer
---
When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
```

The file now intentionally lacks a final `\n` (`git diff` confirms: `\ No newline at end of file`). This is load-bearing — the byte-parity contract for any service whose legacy template did not terminate with `\n` (ICP confirmed, signals/market_research are statistically very likely to be the same since `prompts.py` constants are triple-quoted without trailing newlines) depends on this partial's lack of a trailing newline.

Three concrete future-failure modes:

1. **Re-formatter / editor auto-fix**: many editors (VS Code's `files.insertFinalNewline`, `prettier`, `eslint --fix`, `pre-commit end-of-file-fixer`) will silently re-add the newline on next save. The byte-parity tests for ICP would catch the regression because they snapshot the *new* render — but the failure mode is "all 5 ICP rendered fixtures now have a tail `\n` and the suite is still green; only re-running the legacy byte-parity check (which no longer exists in the tree) catches it." There's no in-tree guard.

2. **Task 9 (signals) / Task 10 (market_research)**: the next migration author opens the file, sees `description: Shared trailer — stop after Final Answer`, has no signal that the trailing-newline absence is intentional, and may "fix" it during their session. If their service's legacy template *does* end with `\n` (statistically unlikely but possible), they'd then have to revert this change and handle the newline service-side, but they won't realise that's why their byte-parity check failed.

3. **The version bump won't fire**. If someone "fixes" the partial by re-adding the newline, `version: 1.0.0` in the front-matter doesn't bump — spec §3.2 requires manual version bumps, but a trivial whitespace change doesn't feel version-worthy to a future author, so it'll slip.

The deviation is reasonable; the *documentation* of it is missing. Two cheap mitigations: (a) update the partial's `description` to something like `Shared trailer — stop after Final Answer (no trailing newline, byte-parity contract)`, or (b) add a hidden Jinja comment `{# byte-parity: do not add trailing newline #}` (will be expanded out at render time and won't affect output). Either makes the contract greppable by Task 9/10's author. The current commit body explains it, but commit bodies are not visible to someone editing the file two months later.

A complementary option, slightly more work: add a small in-tree byte-parity guard against a checked-in "golden tail" string for the partial, so editor re-formatting trips a CI test (not just a runtime byte-parity check that depends on the legacy template still being importable, which it isn't anymore).

### [Low] No structural test asserts ICP loader registers exactly 5 names with the expected names/version/model

**Location:** `backend/tests/unit/test_prompts_golden.py` (covers golden render) and `backend/tests/unit/test_icp.py` (covers prompt_meta in Mongo writes), but no test asserts the registry roster itself.

`list_prompts()` currently returns 5 ICP dicts in my manual verification — but there's no automated guard. A future migration (say Task 9 signals) that accidentally overshadows a name (`icp_research_1` colliding with something) would surface as a boot failure, but a different failure mode — e.g. a file accidentally placed under `_shared/` because of an editor save-as fumble — would silently drop a prompt from the callable set and the only catch would be a runtime `UnknownPromptError` the first time the service runs.

A trivial roster test (`assert sorted(p["name"] for p in list_prompts() if p["name"].startswith("icp_")) == ["icp_generator", "icp_research_1", ..., "icp_research_4"]`) costs ~3 lines and catches both directions (missing + accidentally-added). The spec's §3.6 layer-1 renderer tests would be the natural home. Not implemented in this commit; not strictly required by the spec either, but a low-cost safety net.

### [Low] `prompt_meta: dict = {}` initialiser in `_run_icp_research_impl` masks an unreachable failure mode

**Location:** `backend/app/services/icp/orchestrator.py:_run_icp_research_impl` retry loop

```python
research_result: Any = None
prompt_meta: dict = {}
for attempt in range(1, max_retries + 1):
    try:
        research_result, prompt_meta = await asyncio.to_thread(research_function, agent_chain, context_json)
        break
    except Exception:
        if attempt == max_retries:
            raise
        await asyncio.sleep(1)
```

Static analysis: if the `try` block raises on every attempt, the loop re-raises and `prompt_meta` is never read — fine. If it succeeds at least once, the unpack overrides the initialiser — fine. So the `= {}` is dead-on-success and unreachable-on-failure. Inert. But it means a future maintainer who breaks `research_function`'s return contract (returns a single value instead of a tuple) will get a `TypeError: cannot unpack non-iterable dict object` instead of a more legible error, and the `= {}` initialiser hides the fact that `prompt_meta` is supposed to be required, not optional. Replacing with a bare type annotation `prompt_meta: dict` (no assignment) makes the requirement explicit and behaves identically. Stylistic; not a bug.

### [Low] Empty `suggestedICPs` retry in `ICP_generator` mutates `rendered.body` outside the prompt registry

**Location:** `backend/app/services/icp/orchestrator.py:ICP_generator` (the post-render retry block)

```python
# First attempt
parsed_json = _invoke_generator(rendered.body)

# If empty, retry with stricter requirement
if not parsed_json.get("suggestedICPs"):
    retry_body = rendered.body + "\n\nYou must return at least 3 ICP entries in suggestedICPs. Do not return an empty list."
    parsed_json = _invoke_generator(retry_body)
```

The retry body is constructed inline by string concatenation. The behaviour is preserved verbatim from the legacy code (the legacy `ICP_generator` did the same), so this is **not a Task-8 regression**. But it's a wart for the spec's stated goal — "answer 'which prompt produced this LLM output?' via observability binding" (spec §1). The retry call invokes the LLM with a body that is `icp_generator` + an inline-coded suffix that lives nowhere in `backend/prompts/`. `prompt_meta` recorded against this call would claim the result came from `icp_generator v1.0.0`, but actually the LLM saw a longer body. Low-frequency edge case (retry path only) and the same bug existed pre-migration — flagging for Task 14 (`docs/PROMPTS.md`) or a follow-up. Not a Task-8 blocker.

### [Nit] Snapshot scrub key choice scrubs the whole `prompt_meta` sub-doc instead of just non-deterministic fields

**Location:** `backend/tests/helpers.py:DEFAULT_SCRUB_KEYS` addition

```python
# prompt_meta carries non-deterministic fields (rendered_at, hashes that
# vary with input shape) — scrub the whole sub-doc for snapshot stability.
"prompt_meta",
```

Comment is accurate, but the entire sub-doc gets replaced with `'<scrubbed>'` in snapshots, which means the snapshot no longer enforces that `prompt_meta` even has the right *shape* (the keys `name`, `version`, `model`, `content_hash`, `render_inputs_hash`, `rendered_at`). The unit tests in `tests/unit/test_icp.py` do assert `prompt_meta["name"]`, `["version"]`, `["model"]` on the `insert_one` call, so the shape is guarded — just not in snapshots.

Two alternatives, both better for "snapshot tests describe the document shape":
- Scrub only the non-deterministic fields (`prompt_meta.rendered_at`, `prompt_meta.content_hash`, `prompt_meta.render_inputs_hash`), leaving `name`, `version`, `model` literal in the snapshot.
- Replace the whole sub-doc with a structured stub like `{name: '<scrubbed>', version: '<scrubbed>', ...}` so the snapshot encodes shape.

Pragmatically, the current choice ships; the shape is asserted elsewhere; not a blocker. Worth a 5-minute follow-up if the team wants snapshots to remain documentation of the document shape.

### [Nit] Comment in `_run_icp_research_impl` retry loop still references `max_retries = 2` but the per-worker retry loops in `icp_research_2/3/4` use `max_retries = 3`

**Location:** `backend/app/services/icp/orchestrator.py` (cross-function consistency)

`_run_icp_research_impl` uses `max_retries = 2` for the outer dispatch retry; `icp_research_2`, `icp_research_3`, `icp_research_4` each use `max_retries = 3` for their inner JSON-decode retry. Worst case = 2 outer × 3 inner = 6 LLM calls per request, vs the comment-implied 2 calls. Pre-existing behaviour, preserved verbatim — not a Task-8 issue. Flagging because the implementer touched these functions in this commit and the retry-count semantics aren't documented anywhere; a future debugger trying to understand a runaway agent invocation will need this number.
