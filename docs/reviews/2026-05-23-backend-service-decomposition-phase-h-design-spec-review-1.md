---
artifact: specs/2026-05-23-backend-service-decomposition-phase-h-design.md
artifact_type: spec
verdict: findings
reviewer_model: claude-opus-4-7
date: 2026-05-23
round: 1
---

## Findings

### [Critical] §4.4 contains unedited stream-of-consciousness prose

**Location:** §4.4, line 211 — `"... which is empty, which falls through to... wait, this creates an ambiguity."`

The phrase `"wait, this creates an ambiguity"` is unedited reasoning-in-progress that should not be in a spec. It signals to a reviewer that the section was written, the author hit a problem mid-sentence, and the unfinished thought was left in place rather than rewritten. A reviewer encountering this loses confidence in the rest of the document. Rewrite the section so the conclusion is reached without exposing the false start, and remove the bullet that contains the trailing `…`.

### [Critical] §2.1 item 4 contradicts §5.5 on `_`-prefixed re-exports

**Location:** §2.1 item 4 vs §5.5

- §2.1 item 4: *"Internal-only helpers (prefixed with `_`) are not re-exported."*
- §5.5: *"re-export underscored helpers used by routers from `__init__.py` even though `_`-prefixed names are normally internal. This is a known exception."*

This is a direct contradiction in the load-bearing API-stability rule. The implementor will hit it on commit 1 of the first service. Fix by rewriting §2.1 item 4: `"_`-prefixed helpers are not re-exported **unless they are imported by code outside the package** (e.g., routers, lifespan hooks, or the FastAPI `BackgroundTasks.add_task` callable list). The exception list for this phase is enumerated in §3.X."` Then add the exception list — see next finding.

### [High] Lifespan-callable re-exports are not enumerated, and they will break if forgotten

**Location:** §3.3 (`icp/`), §3.6 (`market_scoring/`), §5.5

After Phase H, `app/main.py` lifespan calls:
- `_ensure_market_scoring_indexes` — moves to `services/market_scoring/persistence.py`
- `_ensure_icp_indexes` — moves to `services/icp/persistence.py`
- `_ensure_leads_indexes` (from Phase G, in `services/leads.py` — out of scope this phase, but verify the convention generalizes)

Plus `routers/market_scoring.py` calls `_run_market_scoring_for_org` via `BackgroundTasks.add_task`.

All four `_`-prefixed callables must be re-exported from their package `__init__.py`. The spec should enumerate this exhaustively in a single subsection (e.g., new §3.7 "Exception list: `_`-prefixed symbols re-exported from `__init__.py`") so the implementor has one place to consult. Currently the exception is implied across §5.5 and §3.3/§3.6 tables without a checklist.

### [High] §4.2 and §4.4 contain two contradictory per-service commit templates

**Location:** §4.2 (lines 187-197) and §4.4 (lines 215-225)

§4.2 shows a 5-step template (scaffold-skeleton / persistence / prompts / llm+parsing / orchestrator-delete). §4.4 then says *"Updated per-service commit template:"* and shows a different 5-step template (scaffold-move-into-orchestrator / persistence / prompts / llm+parsing / closeout). The §4.2 template is now obsolete but it's left intact above the "updated" one. A reviewer or implementor reading top-to-bottom will be confused. Delete §4.2's commit template and keep only §4.4's, or restructure §4.4 to be the only commit-template section.

### [High] The `__init__.py` example contradicts the §3.2 table

**Location:** §3.1 example code (lines 86-105) vs §3.2 table row for `persistence.py`

The example imports all symbols `from app.services.signals.orchestrator`, including `record_signal_action`. But §3.2 places `record_signal_action` in `persistence.py`, not `orchestrator.py`. Either:
- `record_signal_action` is in `persistence.py` and the example should import from both submodules, or
- `record_signal_action` is in `orchestrator.py` and the §3.2 table is wrong.

Fix consistently across the example, the §3.2 table, and the dependency-direction text. This same class of mistake will recur in the other LLM-services if the rule isn't pinned down.

### [Medium] The "Python doesn't allow both `signals.py` and `signals/` to coexist" claim is technically wrong

**Location:** §4.4 line 213 — *"Python doesn't allow both `services/signals.py` and `services/signals/` to coexist."*

Python's default file finder actually allows both on disk; the package (`signals/__init__.py`) silently shadows the module (`signals.py`). The behavior is package-takes-precedence. The conclusion (do the move + delete as a single commit) is still correct, but for cleanliness/readability reasons rather than the asserted impossibility. Rewrite as: *"While Python's import machinery allows both `signals.py` and `signals/__init__.py` on disk (the package shadows the module), leaving the original file alongside the new package is confusing and easy to miss in review. Therefore Step 1 = create package + move all code into `orchestrator.py` + delete `<domain>.py`, as one commit."*

### [Medium] §3 mixes specific function names with schematic descriptions; verification cost varies row-by-row

**Location:** §3.2-§3.6 tables, `Contains` columns

Some rows enumerate function names (`search_signals`, `_run_icp_research_impl`), others use prose ("JSON extraction shared across the five `Research_Market_N` workers"). A reviewer has to verify the specific lists by `grep`, and verify the prose rows by reading code. Make the rows uniformly specific: enumerate the actual function names in every row. This also flushes out cases like §3.2 `persistence.py: "signal CRUD reads called from fetch_signals"` — what is the actual helper name? Does it exist today, or does this row require *extracting* a new helper out of `fetch_signals`'s body? The current wording hides this question.

### [Medium] `llm → prompts` dependency claim doesn't match the actual `_signals_agent_output` signature

**Location:** §3.1 dependency-direction paragraph (line 82), §3.2 `llm.py` row

`_signals_agent_output` takes `prompt: str` as a parameter — the prompt is passed in by the caller (orchestrator), not imported from `prompts.py`. So `llm.py` has no reason to import from `prompts.py`; orchestrator imports from both and threads the prompt through. The architecture claim *"the only leaf-to-leaf dependency permitted is `llm → prompts`"* is therefore unmotivated. Two fixes possible:
1. Refactor `llm.py` to import prompt builders directly so the architecture claim is true (extra work).
2. Drop the `llm → prompts` edge from the dependency claim — all four leaves are independent; orchestrator composes them.

Option 2 is simpler and matches the existing code shape.

### [Medium] LOC budget ("no service file exceeds ~400 LOC") is right at the cap and non-falsifiable

**Location:** §1 summary, §6 acceptance criteria, §3.4 `prompts.py ~400`, §3.5 `pipeline.py ~400`

Two submodules are budgeted at exactly the cap. A 50-LOC overrun on either is a 12% miss but stays within the "~" hedge. Either:
- Lower the cap to a clear number (e.g., `≤500 LOC`, no hedge) and check actuals against it.
- Drop the cap from acceptance criteria entirely — the meaningful test is "no submodule mixes concerns," which a reviewer can judge directly. LOC count is a proxy.

Recommend dropping the LOC criterion from §6 and keeping the LOC tables in §3 as estimates only.

### [Medium] `_*_agent_output` consolidation opportunity not addressed

**Location:** §3.2 `llm.py` (`_signals_agent_output`), §3.3 `llm.py` (`_icp_research_agent_output`), §3.4 `llm.py` (`_market_research_agent_output`)

Three near-identical wrapper functions (~20-35 LOC each) end up in three separate `llm.py` files. The current `services/_llm_helpers.py` was promoted in Phase B for cross-service helpers. Should these three converge into `_llm_helpers.py` as a single `_agent_output_with_fallback(...)` helper parameterized by domain? The spec doesn't address this — either say *"deferred; per-service llm.py keeps current shape"* or *"in scope; consolidate to `_llm_helpers.py`"*. Silence forces the implementor to make the call mid-implementation.

### [Medium] §5.4 grep pattern for `data_sources/` rename is incomplete

**Location:** §5.4 mitigation

The grep `from app.services.documents\|app.routers.documents\|app.routers.v2.documents\|test_documents` misses:
- `from app.routers import documents` (module-not-name form).
- `mocker.patch("app.services.documents.X")` (string-based patches).
- `tags=["documents"]` and any string literal references in router setup.
- The router prefix attribute on `routers/documents.py` itself.
- Any test fixtures or conftest references.
- The Mongo collection name (verify whether it's "documents" — it isn't, the collection is `user_documents`, but this should be confirmed before the rename rather than assumed).

Broaden the pre-flight grep to a single `grep -rEn "documents?|app\.services\.documents|app\.routers\.documents" backend/ tests/` and verify the diff covers everything intentional.

### [Medium] Git rename detection will be defeated by Step 1's mass move

**Location:** §4.4 Step 1 sequence

Step 1 deletes `signals.py` and creates `signals/orchestrator.py` containing the same code, all in one commit. Git's similarity detection (`-M50`) may or may not connect the two, depending on how much the diff looks like a copy. For history traceability (`git log --follow`, blame), the implementor should use `git mv services/signals.py services/signals/orchestrator.py` explicitly, then create the `__init__.py` in a follow-up step. The spec should state this explicitly under §4.4 Step 1: *"Use `git mv` to maximize rename detection. Create `__init__.py` after the move, in the same commit."* Without this, six months from now `git blame` on signals code becomes a forensic exercise.

### [Medium] §3.2 lists Claude-variant functions but doesn't address whether they're still alive

**Location:** §3.2 `orchestrator.py` row — `generate_signals_batch_claude`, `signal_ask_claude`

Phase B's collapse commit (`55ce284`, `f4fb287`) consolidated several Groq/Claude pairs into single workers parameterized by backend. The spec lists `_claude` suffixed variants in `signals/orchestrator.py` without saying whether they're still callable, only routed-to from removed-but-deprecated endpoints, or dead code. If they're dead, this phase is the opportunity to delete them (one-line addition to scope). If they're live, the spec should explain why they didn't get collapsed.

### [Medium] Test count baseline is asserted as ~240 but post-merge actual is 236

**Location:** §1, §4.3, §6

I observed 236 passing tests post-Phase-G merge. The spec rounds to ~240. The acceptance criterion "Test count ≥ Phase G baseline (~240)" gates on a number that's wrong by 4. A no-op refactor that holds at 236 would technically violate the criterion. Fix by either pinning the exact number (236) or rewording: *"No test removed unless explicitly justified in the commit message; no test count regression beyond ±1 per commit."*

### [Medium] §3.5 `data_sources/` doesn't name the public-API surface

**Location:** §3.5 — no `Re-exports` row beyond the table totals

Other §3 sub-sections list re-exports in `__init__.py` as a separate line. §3.5 doesn't enumerate which symbols leave the package. Since this section also handles the rename, the exact symbol surface matters: are `upload_document_file`, `process_file_to_embeddings`, `list_user_documents`, `delete_data_source`, `update_data_source`, `get_document_status` all public? Are any of the loader functions public? Without an enumeration, the rename commit could miss a re-export and break the router. Add an explicit enumeration row.

### [Medium] §4.4 Step 5 wording leaks ambiguity about commit count

**Location:** §4.4 lines 223-225 — *"(no-op for most; data_sources adds the router/test rename; market_scoring adds TD-006 fix; signals adds final cleanup)"*

If Step 5 is a no-op for 3 of 5 services, then those services have a 4-step template and others have a 5-step template. The "5-6 commits per service × 5 services = 25-30" calculation in line 227 then doesn't hold. Either restructure as *"Steps 1-4 are the per-service core; some services have additional Step 5 commits (data_sources rename, market_scoring TD-006 close, signals cleanup)"* and recompute the total, or fold the special-case work into existing steps and drop Step 5 from the template entirely.

### [Low] §1 summary claim "no service file exceeds ~400 LOC" is undefined

**Location:** §1, §6 acceptance criteria

"Service file" is undefined. Does it mean any file under `services/`? Any file containing workflow logic? Any `orchestrator.py`? The LOC tables show several submodules at the 400 cap. Define the metric so it's verifiable, or drop it (see Medium finding above).

### [Low] §4.4 commit estimate (25-30) doesn't match the templates

**Location:** §4.4 line 227

Walking the templates: `market_scoring/` 4 commits (scaffold, normalization, persistence/scoring split, orchestrator+TD006); `data_sources/` 4 commits + rename; `market_research/` 5 commits; `icp/` 5 commits; `signals/` 5-6 commits. Total ≈ 23-25, not 25-30. Round the estimate down or recompute against the actual per-service template.

### [Low] §5.7 references commit `5cc6aa3` as the assumption verifier but provides no actionable pre-flight

**Location:** §5.7

The mitigation is *"Phase F's commit `5cc6aa3` was the final cleanup; the assumption is sound."* That's an assertion, not a verification. A real pre-flight: *"Before Phase H starts, run `grep -rn 'globals()' backend/app/services/ && grep -rEn 'from app.clients import|^client\\s*=|^mongo\\s*=|^driver\\s*=' backend/app/services/` — expect zero matches."* Without this, the assumption is unfalsifiable from the spec.

### [Low] `graph_chat.py` exclusion criterion not stated

**Location:** §1, §2.1

`graph_chat.py` is 209 LOC and stays single-file. So is `org_auth.py` (210), `profiles.py` (236), `customer_profile.py` (388), `pipeline.py` (74). The inclusion threshold (≥800 LOC implied by the five candidates) is not stated. Add one sentence to §1 or §2.1: *"Services below ~800 LOC are not decomposed in this phase — they fit on a screen and the package overhead would exceed the readability benefit."*

### [Low] `_ensure_*_indexes` co-location with lifespan callers is asymmetric

**Location:** §3.3 `persistence.py` (`_ensure_icp_indexes`), §3.6 `persistence.py` (`_ensure_market_scoring_indexes`)

Both index-ensure helpers land in `persistence.py` but are called from `app/main.py` lifespan, not from sibling submodules. The spec should clarify the convention: persistence-layer setup helpers (indexes, schema refresh) are public-via-`__init__.py`-re-export, not internal. This is the same pattern as the Background-task callable (§5.5) — both are exceptions to the *"`_`-prefix means internal"* rule. Generalize the rule rather than handling each case ad-hoc.

### [Low] Test-file location for non-renamed services is unstated

**Location:** §2.1 item 2 (rename ripple), §2.2 (out-of-scope)

§2.1 explicitly handles test-file renames for `data_sources/`. For the other four services, the implicit assumption is that `tests/test_<domain>.py` and `tests/unit/test_<domain>.py` stay at their current locations and unchanged. State this explicitly to forestall any "should we move tests into `tests/<domain>/` packages too?" question during implementation.

### [Low] §5.6 misclassifies a scope decision as a risk

**Location:** §5.6

The section says TD-005 and TD-007 are "out of scope" because touching them widens the diff. That's a scope statement, not a risk. The actual risk (if any) would be: *"Future work on TD-005/TD-007 will conflict with Phase H if not sequenced after — schedule them downstream."* If there's no real risk, demote to a one-line note in §2.2.

### [Low] §6 acceptance criterion "A code-review pass (separate commit) confirms..." is a process, not a property

**Location:** §6 final bullet

A code-review pass is something that happens to the work, not something the work *is*. Rephrase as a verifiable property: *"Each `__init__.py` has only `from ... import` statements, an `__all__` list, and (optionally) a docstring — no logic. No `_`-prefixed symbol appears in `__all__` outside the exception list in §3.X."*

### [Low] No smoke-import verification in §4.3

**Location:** §4.3

Pytest collection failure surfaces most import errors, but a `python -c "from app.main import app"` smoke step is faster and gives clearer diagnostics. Add to per-commit verification: *"`BREWRA_SKIP_DB_INIT=1 python -c 'from app.main import app'` succeeds, then pytest."* The two-second smoke catches package-skeleton issues before pytest's collection phase.

### [Low] §7's "one-file change" claim about background-task swap is optimistic

**Location:** §7, final paragraph

Swapping `BackgroundTasks` for a real queue involves: serializing task arguments, worker process boot, worker deployment, result/status storage, retry semantics, deadletter handling. "One-file change" misleads about the actual scope of that future work. Soften: *"...isolates the task body, making a future swap to a real queue easier to scope and review."*

### [Low] Status header is internally contradictory

**Location:** Header — *"**Status:** Approved for plan-writing (pending user spec review)"*

"Approved" and "pending review" can't both be true. Use one: either *"Draft — awaiting spec review"* or *"Approved for plan-writing"*.

### [Nit] §3.6 names the scoring task as "the background scoring task body" instead of `_run_market_scoring_for_org`

**Location:** §3.6 `scoring.py` row

§5.5 uses the actual name `_run_market_scoring_for_org`; §3.6 uses the prose form. Use the function name everywhere for grep-ability.

### [Nit] No mention of `__pycache__` cleanup during the rename

**Location:** §4.4, §5.4

After deleting `services/signals.py` and creating `services/signals/`, `__pycache__/signals.cpython-313.pyc` lingers and can shadow the package in some dev workflows (notably watch-mode reloaders). Add a one-line operational note: *"Implementors should `rm -rf backend/app/services/__pycache__` after any rename commit if they see stale-import errors."*

### [Nit] No effort/timeline estimate

**Location:** Spec as a whole

Phase A was ~1 week. Phase B was ~1 week with 25 commits. Phase H is estimated at 23-25 commits with sequential dependencies (later services build on patterns proved by earlier ones). An estimate (e.g., *"Estimated 3-5 working days"*) would help the user schedule against other phases.
