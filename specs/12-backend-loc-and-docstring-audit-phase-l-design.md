# Phase L — Backend LOC + Docstring Audit

**Date:** 2026-05-25
**Phase:** L (follows Phase K flat-service decomposition, completed 2026-05-25)
**Status:** Design approved, awaiting implementation plan
**Closes:** TD-008 (LOC reduction across `backend/app/`) and TD-009 (docstring/code drift)

---

## §1 Context and motivation

Phases B–K transformed the backend from a 4.4k-LOC monolithic `api.py` into a ~10.4k-LOC layered codebase with 91 Python files across `models/`, `routers/`, `core/`, and `services/`. Phase K closed the last structural-decomposition item by converting the six remaining flat services to packages.

Throughout this work two tech-debt items accumulated:

- **TD-008** — "Reduce-LOC refactoring pass across the entire backend." Each phase fixed structural concerns; none did a systematic LOC pass. Patterns like near-duplicate functions, repeated DB-lookup boilerplate, and inline data-munging blocks accreted across modules without a moment to consolidate them.
- **TD-009** — "Docstring/code drift audit." Multi-phase decomposition shipped intermediate docstrings under time pressure, leaving claims like "extracted from `X` in Phase H commit 16/20" scattered across `__init__.py` and module-top docstrings. Phase I's round-2 implementation review caught 4–5 cases where the docstring's claimed final state didn't match reality.

Both TDs share a property — they require *examining every file once* — so TD-009 lists "bundle with TD-008" as a pull-forward trigger. With structural decomposition complete and the codebase shape stable post-Phase-K, this is the natural moment to do the bundled pass.

*Note on phase numbering:* TD-008's text names "Phase J" as the structural-completion trigger. Phase J was lazy-import cycle removal (completed 2026-05-25 earlier in the day); Phase K (also completed 2026-05-25) was the flat-service decomposition that actually finished the structural pass. The trigger semantics — "after structural decomposition is complete" — are satisfied by Phase K's completion.

**The TD-008 framing line that governs scope:** *"The goal is not to hit a target LOC count but to ensure every file in the backend is as concise as it can be without losing clarity."* This phase produces a per-file scorecard documenting every file's verdict, then executes the high-confidence reductions surfaced by that audit. Estimated savings ~430+ LOC, but that's emergent — the audit is the deliverable, the execution is what naturally follows.

---

## §2 Architecture: audit-discover-execute

**Approach:** three-stage execution within one phase.

1. **Audit (Stage 1).** Read every Python file under `backend/app/`. For each file, categorize findings using §4's opportunity taxonomy. Tag each finding `execute` / `investigate` / `design-discussion`. Commit the scorecard to `docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md`.

2. **Investigation (Stage 2).** Each `investigate` finding gets a focused per-site analysis. Read every call site fully, write a behavior-preservation strategy, conclude:
   - **Promote to `execute`** — the strategy is byte-equivalence-provable or test-coverable. Strategy captured in the scorecard.
   - **Defer to `design-discussion`** — the strategy involves behavior or interface trade-offs. Rationale captured in the scorecard.
   - **Soft cap:** an investigation defers if it requires reading more than 5 files beyond the immediate call sites, or 3 full read-analyze cycles without converging on a behavior-preservation strategy. The phase doesn't stall on one stubborn finding.

   Commit the updated scorecard.

3. **Execution (Stage 3).** One commit per `execute` finding, ordered low-risk first. Each commit ships its behavior-preservation evidence (assertion, test, or pyflakes clean run) as part of the diff.

**Alternative considered: list-and-verify.** Trust a pre-identified list of wins, skip the systematic audit. Rejected because TD-008 explicitly demands the systematic pass; the largest unexplored files (`market_scoring/orchestrator.py` at 428 LOC, `customer_profile/orchestrator.py` at 388, `icp/orchestrator.py` at 384, `signals/{search,batch,ask}.py` totaling 779) haven't been audited and likely contain wins beyond the pre-identified set.

**Alternative considered: per-module audit-execute pairs.** Walk each package; audit and execute its wins in one commit. Rejected because (a) cross-cutting findings (helpers shared between packages, like `fetch_company_profile`) don't fit a single-package commit; (b) review burden is higher when audit notes and code changes are interleaved in the same diff; (c) the "every file examined" evidence is harder to extract from N module-level commits than from one top-level scorecard.

---

## §3 Scope

### In scope

- All 91 Python files under `backend/app/` (10,403 LOC baseline).
- **TD-008 LOC reductions** across the opportunity categories in §4: dead imports, near-duplicate functions, repeated DB-lookup patterns, repeated CRUD patterns, near-identical prompt strings, redundant fallback branches, single-use trivial wrapper functions, dead code, inline data-munging blocks worth extracting.
- **TD-009 docstring drift cleanup:** removing stale `Phase X`, `commit N/M`, `extracted from … in Phase`, `final form`, and "Renamed … in Phase Y" references. Replaced with structural-only docstrings or removed entirely.
- **The audit scorecard** at `docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md` covering all 91 files with a verdict each.

### Explicit out-of-scope deferrals

- **Decorative `# ---` separator removal.** A previous proposal suggested mechanical removal of ~18 such blocks for ~36 LOC. Rejected: separators are intentional readability aids in long files. TD-008's framing is "concise without losing clarity"; removing separators may hurt clarity. Stylistic decision out of scope here.
- **Prompt externalization (TD-010).** Moving prompts from Python constants to Jinja templates / YAML / registry is a separate spec. K2's base+overlay structure (see §6) is forward-compatible with future TD-010 work.
- **Structural decomposition of remaining flat code.** Phase K just finished; structure is stable.
- **`backend/tests/` and root-level files.** Only `backend/app/`.
- **Type-hint or signature changes** unless they're a direct consequence of an extracted helper.
- **Low-confidence opportunities** (cat 11, 12 in §4). These involve behavior or interface trade-offs and need their own design discussion.

---

## §4 Audit methodology

### Opportunity categories

Each finding falls into one of 12 categories, tagged with a default confidence level. The audit may upgrade or downgrade confidence based on per-file evidence.

| # | Category | Default | Mechanism |
|---|---|---|---|
| 1 | Unused imports | execute | Symbol appears only on the import line in its declaring file. Confirmed by pyflakes after edit. |
| 2 | Stale Phase/commit refs in docstrings | execute | Grep matches `Phase [A-Z]`, `commit N/M`, `extracted from … in Phase`, `final form`, `Renamed … in Phase`. Prose-only edits. |
| 3 | Near-identical string literals (incl. prompts) | execute | Two strings differ by a bounded section. Refactor to base + overlay; assert `assembled == original` byte-for-byte. |
| 4 | Near-duplicate functions | execute | Bodies byte-identical after normalizing one identifier (e.g., a template constant). Confirmed by AST normalize + hash. |
| 5 | Repeated DB-lookup boilerplate | execute | `db = mongo[X]; coll = db[Y]` (or similar) appears ≥3 times. Extract to a helper; helper returns the exact same object reference shape. |
| 6 | Repeated CRUD wrapper patterns | execute | `coll.update_one({k: v}, {"$set": fields})` pattern appears ≥3 times. Extract to a helper preserving the filter and `$set` shape. |
| 7 | Cross-file duplicate helpers | execute | Same Cypher query / Mongo query / function body appears in ≥2 files. Extract to the appropriate shared module. |
| 8 | Single-use trivial wrapper functions | investigate | Function whose body is a one-line call to another. Inlining may change exception types, evaluation order, or callsite arity. |
| 9 | Dead code (functions/constants never imported) | investigate | Whole-repo grep finds zero references. Must also confirm no dynamic access (`getattr`, `*`-imports, `__all__` re-exports). |
| 10 | Inline data-munging blocks worth extracting | investigate | Same multi-line transform appears across files but call sites may have subtle differences in input shape or error handling. |
| 11 | Redundant fallback branches | design-discussion | "Fetch with org_id; if empty fetch without" — defensive code that may or may not be reachable. Removing it is a behavior decision, not a refactor. |
| 12 | Long string literals worth hoisting | design-discussion | Cross-file string deduplication that overlaps with TD-010 (prompt externalization). Out of scope here. |

### Confidence labels and gates

- **`execute`** — Byte-equivalence is mechanically provable or coverable by a test that the commit ships. No investigation gate. The commit's behavior-preservation evidence is in the diff (assertion script, parametrized test, pyflakes output).
- **`investigate`** — The change appears safe but the behavior surface isn't byte-equivalent. Each finding requires a per-site investigation in Stage 2. The investigation produces a behavior-preservation strategy (which observable surfaces are unchanged: return value, exception types, side effects, evaluation order) and a verdict: promote-to-`execute` or defer-to-`design-discussion`.
- **`design-discussion`** — The change involves a behavior or interface trade-off. Deferred from this phase. Documented in the scorecard with rationale.

### Investigation methodology (Stage 2)

For each `investigate` finding:

1. **Enumerate every call site** of the affected symbol across `backend/app/` and `backend/tests/`.
2. **Read each call site in full** — the surrounding 10-20 lines, the function signature it lives in, what's passed as arguments, what's done with the return value.
3. **Identify observable surfaces** — return value shape, exception types raised, side effects (DB writes, log lines, metric increments), evaluation order if relevant.
4. **Write a behavior-preservation strategy** stating: under the proposed refactor, surface S behaves as follows; this matches the pre-refactor behavior because [reason]. Repeat per surface.
5. **Decide:** if every observable surface is preserved with high confidence (and that preservation is provable via assertion or test), promote to `execute`. Otherwise defer.

The strategy and verdict are recorded in the scorecard. If a promoted finding's test fails during Stage 3, the finding is reverted; its scorecard entry is updated to `deferred` with the failure as the documented rationale.

---

## §5 Scorecard format

File: `docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md`. Committed audit record, written at the end of Stage 1 and updated at the end of Stage 2. Each stage's commit is a frozen snapshot of the file at that point.

Structure:

```markdown
# Backend LOC + Docstring Audit — Phase L

**Date:** 2026-05-25
**Scope:** backend/app/ (91 files, 10,403 LOC baseline)
**Method:** Per-file review using the 12 opportunity categories from spec §4.

## Summary

| Status | Count | LOC est. |
|---|---:|---:|
| Audited, clean | <N> | — |
| Execute (Stage 3) | <N> | ~<X> |
| Investigated → promoted to execute | <N> | ~<Y> |
| Investigated → deferred | <N> | — |
| Design-discussion (future work) | <N> | — |

## Per-file findings

### backend/app/services/market_research/orchestrator.py (288 LOC)

- **Cat 4 (near-duplicate functions) — execute.**
  Research_Market_1..5 byte-identical after template-name normalization (AST + hash check).
  Collapse to `_run_research_component(template)` with a `COMPONENT_TEMPLATES` dispatch dict.
  Behavior-preservation: parametrized test asserting `template.format(...)` byte-equals a per-component fixture.
  Est. -100 LOC.

- **Cat 1 (unused imports) — execute.**
  `CLAUDE_RESEARCH_MAX_TOKENS`, `_tavily_context_and_urls`, `_claude_messages_text` only on import line.
  Est. -3 LOC.

### backend/app/main.py (187 LOC)

_audited; clean_

[... 91 entries total ...]

## Cross-cutting findings

### Cat 7: fetch_company_profile duplication — execute

Sites:
- customer_profile/orchestrator.py: 3 inline copies (lines 31, 153, 319)
- market_scoring/persistence.py: 1 inline copy (line 109)
- market_research/orchestrator.py: nested def at line 228
- icp/orchestrator.py: nested def at line 286
- signals/ask.py: 2 variant-alias copies (lines 44, 133) — same query with `p:` alias

Extract `fetch_company_profile(driver, org_id: str | None) -> dict | None` to `services/_neo4j_helpers.py`.
Behavior-preservation: existing tests for each consuming service continue to pass.
Est. -50 LOC.

[... additional cross-cutting findings ...]
```

**Key properties:**
- Every one of the 91 files appears at least once. That's the evidence that the systematic pass actually happened.
- Each finding tags its category, confidence label, behavior-preservation strategy (where applicable), and LOC estimate.
- Cross-cutting findings (touching multiple files) get their own section so the plan can sequence them with awareness of shared call sites.
- Each stage commit is a frozen snapshot — same convention as specs/plans (per CLAUDE.md "Specs and plans are a frozen record of intent, not current truth"). Future audits start a new scorecard with a new date rather than updating this one.

---

## §6 Known wins (Stage 3 minimum scope)

The following wins have been verified against the current codebase. They constitute the minimum scope of Stage 3 execution. The audit may surface additional wins; they get added as further tasks.

**LOC estimates** below are initial sizing from the verification pass that produced this spec. Exact savings are measured during Stage 1 audit and Stage 3 execution; the audit may surface additional wins and execution may differ from these estimates within the stated ranges.

| ID | Title | Files | Cat | LOC | Verified |
|---|---|---|---|---:|---|
| K1 | Remove 16 verified unused imports | `models/__init__.py`, `routers/data_sources.py`, `services/market_scoring/orchestrator.py`, `services/market_research/orchestrator.py`, `services/icp/persistence.py` | 1 | -16 | ✓ Each symbol confirmed to appear only on its import line in its declaring file. |
| K2 | Dedup `Cypher_gen_prompt`/`Cypher_gen_prompt2` and `qa_prompt_template`/`qa_prompt_template2` via base + overlay in `core/llm_config.py` | `core/llm_config.py` | 3 | -102 | ✓ Cypher pair: 88 vs 84 lines (4-line diff). QA pair: 34 vs 28 lines (6-line diff). Confirmed via AST. |
| K3 | Collapse `Research_Market_1..5` into `_run_research_component(template)` + `COMPONENT_TEMPLATES` dispatch | `services/market_research/orchestrator.py` | 4 | -100 | ✓ All 5 function bodies byte-identical after template-name normalization (same hash `ce5d84bd`). |
| K4 | Append `fetch_company_profile` to existing `services/_neo4j_helpers.py` (71 LOC, currently exports `query`, `results_to_string`, `escape_property_name`, `upsert_node`); replace 8 call sites across 5 files | `services/_neo4j_helpers.py`, `services/customer_profile/orchestrator.py` (3 sites), `services/market_scoring/persistence.py`, `services/market_research/orchestrator.py`, `services/icp/orchestrator.py`, `services/signals/ask.py` (2 sites) | 7 | ~35–50 | ✓ Same Cypher query `MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1` (alias variant in `signals/ask.py` uses `p:`/`RETURN p`, semantically equivalent for the fetch use case). |
| K5 | Extract `_update_run(run_coll, run_id, **fields)` helper; replace 10 call sites | `services/market_scoring/scoring.py` | 6 | ~40–50 | ✓ 10 `run_coll.update_one(...)` calls at lines 48, 55, 69, 83, 97, 112, 162, 173, 192, 208; each is 5–8 lines including the multi-line `$set` dict. |
| K6 | Extract `_get_file_collection(mongo)` helper; replace the two-line `db = mongo["File_Processing"]; collection = db["file_status"]` pattern across ~10–11 sites | `services/data_sources/persistence.py`, `services/data_sources/pipeline.py` | 5 | ~18–22 | ✓ ~10–11 two-line pattern instances across the two files; exact count and per-site verification confirmed during Stage 1 audit. |
| K7 | TD-009 docstring drift sweep — per-match evaluation of Phase/commit/extracted-from/final-form/renamed references | ~12 files across `services/`, package `__init__.py` files | 2 | ~60–100 | ✓ 25 grep matches across `backend/app/` for the targeted patterns; per-match LOC impact (entire docstring removed vs. single-line edit) resolved during Stage 1. |

**Known-wins subtotal:** ~370–460 LOC reduction (range reflects the per-task estimate ranges above). Plus any audit-surfaced additions and promoted investigation findings.

### Behavior-preservation strategy per known win

- **K1**: removed symbols proven unused by per-symbol grep. Zero behavior surface. pyflakes after edit confirms.
- **K2**: before the refactor, snapshot the current values of the 4 string constants to a baseline file (e.g., `backend/tests/_baselines/llm_config_prompt_strings.py`) containing module-level constants `CYPHER_GEN_PROMPT_BASELINE`, `CYPHER_GEN_PROMPT2_BASELINE`, `QA_PROMPT_TEMPLATE_BASELINE`, `QA_PROMPT_TEMPLATE2_BASELINE`. A pytest in `backend/tests/unit/test_llm_config_prompts.py` then imports both the baseline file and the post-refactor `app.core.llm_config` module and asserts byte-equality for all 4 strings. Baseline file and test are committed alongside the K2 refactor and stay as permanent regression guards. No git operations needed.
- **K3**: before the refactor, capture per-component prompt fixtures by running `RESEARCH_MARKET_<N>_TEMPLATE.format(company_profile_json=<fixed_sample>)` against a checked-in sample input. Each fixture is the formatted prompt string (the value that would be sent to the LLM) and lives at `backend/tests/fixtures/market_research_prompts/<component_name>.txt`. The K3 refactor exposes the formatted prompt at a testable seam — either by extracting a `_build_research_prompt(component_name, profile_json)` helper that the new `_run_research_component` calls, or by making `_run_research_component` accept a `return_prompt: bool` switch for testing. A parametrized pytest calls the seam with each component name and the `<fixed_sample>`, asserts byte-equality against the corresponding fixture. Fixtures, sample input, and test are committed alongside K3.
- **K4**: helper appended to existing `services/_neo4j_helpers.py`. Signature `fetch_company_profile(driver, org_id: str | None) -> dict | None`. Returns either a `dict` (the first record's values) or `None`. The 8 call sites already follow this pattern; the helper centralizes the Cypher + alias-handling. Existing tests for the 5 consuming services continue to pass. During the audit step, each of the 8 sites is inspected line-by-line for subtle deviations (alias differences, additional filtering, return-value handling) before extraction; sites with non-trivial deviations stay inline.
- **K5**: helper `_update_run(run_coll, run_id, **fields)` performs `run_coll.update_one({"run_id": run_id}, {"$set": fields})`. Filter and `$set` shape preserved exactly.
- **K6**: helper `_get_file_collection(mongo)` returns `mongo["File_Processing"]["file_status"]`. The 11 sites use the returned collection in the same way (`find`, `find_one`, `update_one`, `insert_one`) — no behavior change.
- **K7**: prose-only edits inside docstrings. Each of the 25 grep matches is evaluated per-match: **stale origin claim** (e.g., "extracted from X in Phase Y", "Phase H commit 16/20", "Renamed from documents/ in Phase H") → remove the offending sentence; **current-state structural reference** (e.g., "Phase H scope" used to mean "the scope of Phase H" rather than as origin attribution) → keep or rephrase without the phase reference. Replacement text is structural-only — what the module exports, what its public API is. No version/commit/phase references in the new text. If a structural-only replacement isn't possible, the docstring becomes minimal or is removed.

---

## §7 Verification framework

### Per-task verification

Each Stage-3 commit must pass before merging:

1. **Import smoke test:** `cd backend && .venv/bin/python -c "from app.main import app; print('imports OK')"` exits 0.
2. **Module-scoped pytest:** `cd backend && .venv/bin/python -m pytest tests/services/<affected_module>` for the package the task touches. Cross-cutting tasks (K1, K4, K7) run the full suite.
3. **Behavior-preservation evidence** specific to the task (baseline-snapshot equality test for K2; parametrized prompt-string test for K3; existing-tests-pass for K4; pyflakes for K1; trivial-helper-equivalence for K5/K6; prose-only for K7).

**TD-004 note:** captured-LLM fixtures (`backend/tests/fixtures/captured/*.json`) are stubs, not real LLM responses, per TD-004. For Phase L this is acceptable: pytest functions as a *structural-preservation* gate — confirming code paths and shapes are unchanged. The primary behavior-preservation evidence is byte-equality assertions (K2 baseline snapshot, K3 prompt fixtures), not LLM-output shape. K1, K4, K5, K6, K7 don't touch LLM call paths, so the stub-fixture limitation doesn't apply to them.

### Final verification

The last Stage-3 commit captures:

- **Full pytest passes:** `cd backend && .venv/bin/python -m pytest`.
- **LOC baseline vs final:** `find backend/app -name '*.py' -exec cat {} + | wc -l`. Recorded in the impl review.
- **TD-009 closure check:** `grep -rnE 'Phase [A-Z]|commit [0-9]+/[0-9]+|extracted from .* in Phase|final form|Renamed.*in Phase' backend/app/` returns 0 matches.
- **Pyflakes:** `python -m pyflakes backend/app/` shows no new unused-import warnings beyond a documented baseline.

---

## §8 Risk register

| # | Risk | Mitigation |
|---|---|---|
| R1 | K2 base-prompt assembly produces a different string than the original (changes the LLM prompt that hits the API) | Mandatory byte-equality assertion against pre-refactor constants before commit. Failure rejects the refactor. |
| R2 | K3 dispatch returns the wrong template for a `component_name` | Parametrized test asserting `template.format(...)` byte-equals a per-component checked-in fixture. |
| R3 | K4 helper diverges from one of the 7 inline sites (subtle deviation we missed) | Audit step inspects each site line-by-line before extraction. Sites with non-trivial deviations stay inline. |
| R4 | K7 docstring sweep deletes useful context along with stale refs | Conservative grep targets specific patterns only. Replacement content is structural-only. |
| R5 | Investigation of a medium finding misses a subtle behavior risk → executed change introduces regression | Investigation produces a written behavior-preservation strategy naming every observable surface (return value, exception types, side effects, evaluation order). Strategy captured in scorecard. If pytest fails on the change, it's reverted; scorecard entry updated to `deferred` with the failure as the rationale. |
| R6 | Cross-cutting tasks hit unrelated callers we didn't audit | Per-task verification runs full pytest. For K1: pyflakes confirms no usage anywhere in `backend/app/` post-edit. |
| R7 | Investigation phase extends the round significantly | Accepted, with soft cap: an investigation defers if it requires reading more than 5 files beyond the immediate call sites, or 3 full read-analyze cycles without converging. The phase doesn't stall on one stubborn finding. |
| R8 | A finding conflicts with TD-010 (prompt externalization) — e.g., dedup-and-then-externalize cycle | K2's base+overlay structure is forward-compatible with future TD-010 work. Out-of-scope deferral keeps prompts as Python constants this round. |
| R9 | TD-009 cleanup creates new drift in replacement docstrings | Replacement content is structural-only — no version/commit/phase references in new text. If a structural-only replacement isn't possible, docstring becomes minimal or is removed. |
| R10 | Audit + investigation surface more work than fits the round | Accepted. Phase L scope is "every file examined, every executable finding executed." If an investigated finding is large enough to warrant its own spec (e.g., a structural change to a 400-LOC service), it gets deferred with rationale captured in the scorecard. |

---

## §9 Commit sequence

On branch `refactor-backend-loc-docstring-audit-phase-l`:

1. **Stage 1:** `chore(audit): Phase L backend LOC + docstring audit scorecard` — committed scorecard with all 91 files audited, findings tagged.
2. **Stage 2:** `chore(audit): Phase L investigation outcomes` — scorecard updated with per-investigation verdicts.
3. **Stage 3, low-risk first:**
   - `refactor(be): remove verified unused imports [phase L]` (K1)
   - `refactor(be): extract _update_run helper in market_scoring/scoring [phase L]` (K5)
   - `refactor(be): extract _get_file_collection helper in data_sources [phase L]` (K6)
   - `refactor(be): collapse Research_Market_1..5 into _run_research_component [phase L]` (K3)
   - `refactor(be): dedup llm_config prompt constants via base+overlay [phase L]` (K2)
   - `refactor(be): extract fetch_company_profile to _neo4j_helpers [phase L]` (K4)
   - `docs(be): close TD-009 stale Phase/commit references [phase L]` (K7)
   - Additional commits for investigated-and-promoted findings and audit-surfaced additions.
4. **Final:** `docs(reviews): add Phase L impl review + synthesis (round 1, …)` — matching the Phase J/K pattern.

**Merge strategy:** fast-forward into master after impl review verdict is clean, then push (matching the Phase K cutover we just did).

**Commit message style:** `type(scope):` per CLAUDE.md. No `[N/M]` numbering (Phase L commits are bounded by the scorecard, not by a fixed task count). No Co-Authored-By footer.

---

## §10 Success criteria

1. **Audit scorecard committed** at `docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md` with all 91 files of `backend/app/` represented, each with a verdict.
2. **Investigation outcomes committed** — every `investigate` finding has either a promote-to-execute strategy or a defer-with-rationale entry in the scorecard.
3. **All `execute` findings executed**, one commit per task, each shipping its behavior-preservation evidence.
4. **Known wins K1–K7 are accounted for:** each is either (a) executed with a passing verification, (b) attempted-and-deferred with a documented failure rationale in the scorecard, or (c) deferred up-front with a rationale (e.g., audit revealed a subtle behavior risk). No silent skips.
5. **TD-009 closure:** `grep -rnE 'Phase [A-Z]|commit [0-9]+/[0-9]+|extracted from .* in Phase|final form|Renamed.*in Phase' backend/app/` returns 0 matches.
6. **Full pytest suite passes** on the final commit.
7. **No new pyflakes warnings** introduced by Phase L.
8. **Impl review verdict: clean** (or, if any actionable findings, fix-then-clean).
9. **Branch fast-forward-merged into master and pushed.**

TD-008 and TD-009 are marked **resolved** in `docs/TECH_DEBT.md` with the resolution commit reference (same convention used for TD-001/002/003/006/007).
