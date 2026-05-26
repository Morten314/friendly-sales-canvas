---
artifact: plans/13-prompt-management.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 2
---

## Context

Round 2 re-review after plan revisions addressing round 1 findings. The plan is 3,561 lines, 15 tasks across 4 phases. Paired spec `specs/13-prompt-management-design.md` (734 lines, frozen) read in full. All "Modify" targets verified present on disk. Round 1 raised 3 High, 4 Medium, 5 Low, 2 Nit. The plan was revised to address most round 1 findings; this round assesses residual issues and identifies new ones.

Round 1 disposition summary:
- **Fixed:** Abort criteria section added (lines 17-28). Recovery strategy (`git revert`) stated (line 28). Task 1 Step 0 baseline check added (lines 89-97). Task 8 step numbering gap resolved. Task 11 Step 6 verification script corrected (now uses name set, line 2929). Phase 1 commit-count departure from spec acknowledged with rationale (lines 196-197).
- **Partially addressed:** `test_prompts_golden.py` import-time `init_registry` — autouse fixture added (lines 1697-1707) mitigating state bleed, but import-time call remains.
- **Unchanged:** `signals_leads_section` callable despite include-only intent. No parallelization guidance for Phase 2. Mixed path conventions. `response_format_json.md.j2` static partial. Private-symbol testing in Task 7.

## Findings

### High — Task 11 Step 10 deletes the baseline file that Step 8's one-shot test imports

**Location:** Task 11 Step 8 (lines 2957-3022) creates `test_llm_config_migration_equivalence.py` importing from `tests/_baselines/llm_config_prompt_strings.py`. Step 10 (lines 3061-3073) deletes that same baseline file. Line 3067-3074 says "The one-shot equivalence test from Step 8 stays for one release cycle."

The one-shot test at line 2975-2980:
```python
from tests._baselines.llm_config_prompt_strings import (
    CYPHER_GEN_PROMPT_BASELINE,
    CYPHER_GEN_PROMPT2_BASELINE,
    QA_PROMPT_TEMPLATE_BASELINE,
    QA_PROMPT_TEMPLATE2_BASELINE,
)
```

Step 10 deletes `tests/_baselines/llm_config_prompt_strings.py` (line 3071). After Step 10 lands, `pytest tests/unit/test_llm_config_migration_equivalence.py` raises `ImportError`. The stated intent ("stays for one release cycle") contradicts the execution (deleted in same task).

Fix: either (a) don't delete the baselines in Step 10 — keep them for the one-shot test's lifetime and delete both files together later, or (b) inline the four baseline strings into the one-shot test file itself so it's self-contained, then delete the baselines freely.

### High — No automated byte-equality guard for non-llm_config service migrations

**Location:** Phase 2 Tasks 8-10, 12 (ICP, signals, market_research, market_scoring). Acknowledged at line 3559: "signals/icp/market_research/market_scoring don't have legacy baselines, so spot-check with the golden fixture against a known-good output."

The llm_config migration (Task 11) gets a one-shot equivalence test comparing new `.md.j2` rendered output against legacy Python-string baselines (Step 8). The other four services get no equivalent. Golden fixtures are generated *from the new templates*, so they protect against *subsequent* drift but not against *incorrect initial extraction*.

The verbatim-extraction protocol (Task 8 Step 1, lines 2129-2136) involves six manual steps: substitute placeholders, un-double JSON braces, strip trailing directive, add include, add front-matter. Each step is error-prone. A systematic error (e.g., always missing one un-doubled brace pair) would produce wrong-but-consistent golden fixtures that pass all tests.

The ICP migration (Task 8) is the proving ground — if the extraction protocol has a systematic error, it should surface during ICP's manual verification (Step 3: confirm registry boot; Step 5: golden test). But "should surface" is not the same as "is caught by an assertion."

Fix: for each service migration, before generating golden fixtures, add a one-shot assertion that `prompts.render("new_name", **legacy_inputs).body` equals the output of the legacy `TEMPLATE.format(**legacy_inputs)` (or `f-string` construction). This requires snapshotting one legacy call's output, but only for one representative prompt per service — not all. Delete after the migration lands.

### Medium — `signals_leads_section` / `signals_existing_headlines_section` / `signals_leads_section_fallback` are callable but intended as include-only

**Location:** Task 9 Steps 1-3 (lines 2390-2461); round 1 flagged this as Medium, unchanged.

These three prompts live under `signals/` (not `_shared/`), making them callable via `prompts.render("signals_leads_section", ...)`. They appear in `list_prompts()` output alongside genuine top-level prompts. The spec §3.1 says only `_shared/` files are non-callable — it doesn't address service-directory sub-templates.

Risk: `list_prompts()` returns 7 signals entries instead of the expected 2 (scout_search, profiler_search) plus 2 ask prompts. Anyone using `list_prompts()` to enumerate "what prompts does the system have" gets misleading output.

Options: (a) move to `_shared/` and accept broader scope, (b) add a loader rule (e.g., `is_sub_template` front-matter flag), or (c) document the convention in `PROMPTS.md` (Task 14) with a naming pattern (e.g., `*_section` suffix = include-only). The plan already drafts `PROMPTS.md` content at Task 14 Step 1 item 4 but doesn't call out this convention.

### Medium — `test_prompts_golden.py` still calls `init_registry` at module import time

**Location:** Task 6 Step 3, line 1689. Round 1 flagged this; the autouse fixture (lines 1697-1707) was added in response.

The autouse fixture re-initializes the registry before each test, mitigating state bleed from `test_prompts_loader.py`. However, the import-time call remains: if `backend/prompts/` is in an intermediate state (e.g., mid-Task-8 with a malformed `.md.j2` that hasn't been debugged yet), `pytest --collect-only` or any IDE test discovery will trigger `BootFailure` at import time, making the entire test suite undiscoverable until the malformed file is fixed.

Fix: move the `_REGISTERED` list computation into a `session`-scoped fixture. The `@pytest.mark.parametrize` can use indirect parametrization or `pytest.importorskip` to defer evaluation. Alternatively, wrap the module-level `init_registry` call in a try/except that sets `_REGISTERED = []` on failure, with a clear skip message.

### Medium — Task 5 (shared partials) skips full-suite regression check

**Location:** Task 5 (lines 1447-1553). Steps 1-6 include creating files and a manual `init_registry` verification (Step 5), but no `pytest` full-suite run.

Tasks 2, 3, 4, and 7 each include a full-suite step. Task 5 modifies `backend/prompts/_shared/` (a new directory that the loader scans) but doesn't verify that the existing test suite still passes after the directory exists. The risk is low (the directory contains only partials, no call sites changed), but the omission breaks the plan's own convention of running the full suite after each infrastructure task.

### Medium — Task 7 combines factory infrastructure with lifespan wiring in one task

**Location:** Task 7 (lines 1765-2042). Two distinct concerns: (a) `_llm_helpers.py` factory + `call_with_prompt` helper, and (b) `app/main.py` lifespan wiring + `build_llm_config` factory registrations.

The task modifies 5 files across both concerns. Per the plan's own commit convention ("one commit per task"), these land as one commit. But the concerns are independently reviewable: the factory/helper has no dependency on lifespan wiring (the factory is usable without lifespan; tests prove this via `isolated_llm_factory`). Splitting into Task 7a (factory + helper) and Task 7b (lifespan + registrations) would give each commit a single review scope. Not a blocker — just a decomposition improvement.

### Low — `_prompt_meta_from` is public API with a private naming convention

**Location:** Plan-wide. Every agent-chain and custom-dispatch call site calls `prompts._prompt_meta_from(rendered)` (e.g., Task 8 Step 6 lines 2218, 2243). The underscore prefix conventionally means "internal," but this function is the documented way for call sites to extract the `prompt_meta` dict (spec §3.5).

Options: rename to `prompt_meta_from` (public), or document that the underscore is intentional (co-located with `RenderedPrompt`, not part of the loader/render API). The plan doesn't address this naming choice.

### Low — No automated guard against wrong brace un-doubling during extraction

**Location:** Task 8 Step 1 "Verbatim source extraction protocol" (lines 2129-2136), applied to all service migrations.

Step 3 of the protocol: "Un-double JSON braces: `{{ "key": ` → `{ "key": `. (Caution: only un-double pairs that were escaping JSON; leave Jinja2 expressions intact.)" This is the highest-risk manual step. An automated regex-based transformation (e.g., `sed` or a Python script) that replaces `{{`/`}}` only when followed/preceded by typical JSON characters would reduce error rate. The plan provides no tooling for this.

The risk is partially mitigated by `init_registry`'s AST validation (undeclared `{{ }}` expressions produce `BootFailure`) — but a *correct-looking* Jinja2 expression that shouldn't be one (e.g., `{{ "key": "value" }}` left un-doubled where `key` happens to be a declared input name) would pass validation and produce wrong output.

### Low — Task 8 Step 6 doesn't show complete rewrites for `icp_research_3` and `icp_research_4`

**Location:** Task 8 Step 6 (lines 2207-2277). The plan shows full code for `ICP_generator`, `icp_research_1`, and `icp_research_2`, then says "Repeat the same shape for `icp_research_3` and `icp_research_4`."

`icp_research_2` has unique retry logic (3 attempts, specific error handling) that doesn't apply to `icp_research_3`/`icp_research_4`. An executor following the "repeat" instruction might copy the `icp_research_2` pattern including the retry logic, which may not match the original functions' behavior. The plan should either show the full rewrites or explicitly state what differs (likely nothing — `icp_research_3`/`icp_research_4` may be simple like `icp_research_1`).

### Nit — `_LANGCHAIN_PROMPT_NAMES` in golden test is hardcoded

**Location:** Task 6 Step 3, lines 1692-1694.

```python
_LANGCHAIN_PROMPT_NAMES = [name for name in _REGISTERED if name in {
    "cypher_gen", "cypher_gen_alt", "qa_scout", "qa_scout_alt",
}]
```

If the Phase 0 audit surfaces additional LangChain-wrapped prompts, this set must be updated manually. The dependency isn't noted. In practice this is unlikely (the four LangChain prompts are known), but a comment noting the source would help.

### Nit — Plan doesn't state what happens if `pip install -r requirements.txt` fails (Task 2 Step 2)

**Location:** Task 2 Step 2 (lines 215-221).

The step says "Expected: `jinja2` either already installed (transitive) or freshly pulled. Exit 0." No fallback stated. If the install fails (network issue, version conflict), the executor has no guidance. This is the only `pip install` step in the plan, and it's a trivial concern given jinja2's ubiquity.
