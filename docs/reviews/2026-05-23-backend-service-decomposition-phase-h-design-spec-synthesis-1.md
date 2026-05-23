---
synthesizes_review: docs/reviews/2026-05-23-backend-service-decomposition-phase-h-design-spec-review-1.md
artifact: specs/2026-05-23-backend-service-decomposition-phase-h-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-23
round: 1
---

## Round Recommendation

**no**

Reason: All Critical and High findings are agreed and will be revised. Remaining disagreements are defended on substantive grounds (redundancy with existing verification, deviation from prior phase convention). Revisions are clarifications and contradiction-removals — they don't open new design surface that would warrant another full review round.

## Agreed Findings

- **§4.4 unedited prose ("wait, this creates an ambiguity") — Critical.** Rewrite §4.4 so the resolution is reached without exposing the false start. Delete the truncated `"...falls through to…"` bullet.

- **§2.1 item 4 contradicts §5.5 on `_`-prefixed re-exports — Critical.** Rewrite §2.1 item 4 to permit `_`-prefixed re-exports when imported by code outside the package (routers, lifespan hooks, `BackgroundTasks.add_task`). Add an explicit exception list — see next item.

- **Lifespan-callable re-exports not enumerated — High.** Add a new §3.7 ("Exception list: `_`-prefixed symbols re-exported from `__init__.py`") enumerating `_ensure_market_scoring_indexes`, `_ensure_icp_indexes`, `_run_market_scoring_for_org`, plus any others surfaced during pre-flight. This single section becomes the authoritative reference instead of scattering exceptions across §5.5 and §3 tables.

- **§4.2 and §4.4 contradict on per-service commit template — High.** Delete §4.2's commit-template block. Keep only §4.4's (which is correctly marked "Updated"). Restructure §4 so there's exactly one canonical template.

- **`__init__.py` example contradicts §3.2 on `record_signal_action` location — High.** Fix by clarifying the convention: public functions live in whichever submodule does the actual work — `orchestrator.py` is for multi-step compositions, not all public functions. Simple persistence-only operations like `record_signal_action` stay in `persistence.py` and are re-exported from there. Update the §3.1 example to import from both submodules accordingly.

- **"Python doesn't allow both `signals.py` and `signals/` to coexist" is technically wrong — Medium.** Rewrite §4.4 to acknowledge Python allows it (the package shadows the module) but readability and review hygiene demand the move-in-one-commit approach.

- **§3 tables mix specific function names with schematic prose — Medium.** Tighten the prose rows in §3.2 (`parsing.py` "Response normalization + signal extraction") and §3.4 (`parsing.py` "JSON extraction shared across...") to either name the specific helpers or explicitly say "new helper to be extracted during implementation; name TBD by implementor." Accept that exhaustive enumeration in §3 is the implementor's job; spec captures intent.

- **`llm → prompts` dependency claim unmotivated — Medium.** Drop the `llm → prompts` edge from §3.1. State that all four leaves are independent and orchestrator composes them by passing prompt strings into LLM wrappers as arguments (matching the existing `_signals_agent_output(agent_chain, prompt, ...)` signature). Update §5.2 accordingly.

- **LOC budget right at the cap and non-falsifiable — Medium.** Drop the "no service file exceeds ~400 LOC" claim from §1 and the matching acceptance criterion from §6. Keep the LOC tables in §3 as estimates only. The meaningful test ("no submodule mixes concerns") is judged by review, not by line count.

- **`_*_agent_output` consolidation opportunity not addressed — Medium.** Add an explicit deferral to §2.2: consolidation of the three `_*_agent_output` helpers into `_llm_helpers.py` is a behavioral change and out of Phase H's purely-structural scope. Implementor moves each unchanged into its per-service `llm.py`. Consolidation can be a follow-up if desired.

- **§5.4 grep pattern incomplete — Medium.** Replace the suggested grep with a broader pattern: `grep -rEn "(from |import )(app\.services\.documents|app\.routers\.documents|app\.routers\.v2\.documents)|\"documents\"|test_documents|mocker\.patch\(['\"]app\.services\.documents" backend/ tests/`. Verify Mongo collection name (`user_documents`, not `documents`) explicitly in the pre-flight.

- **Git rename detection defeated by Step 1 mass move — Medium.** Add to §4.4 Step 1: "Use `git mv services/<domain>.py services/<domain>/orchestrator.py` explicitly. Create `__init__.py` after the move in the same commit. This preserves `git log --follow` and `git blame` continuity."

- **Claude-variant deadcode question not addressed — Medium.** Add to §3.2 (`signals/`) a one-line implementor note: "Pre-flight check: confirm `generate_signals_batch_claude` and `signal_ask_claude` are still reachable from routers. If dead code, delete in the same commit as their extraction. If live wrappers around the unified path, keep in `orchestrator.py`."

- **Test count baseline ~240 vs actual 236 — Medium.** Replace "~240" with "236" everywhere (§1, §4.3, §6). Reword the acceptance criterion: "No test removed unless the commit message explicitly justifies it; total count holds at ≥236 throughout the phase."

- **§3.5 doesn't enumerate public-API surface — Medium (revised scope).** Finding's framing was wrong — no §3 subsection enumerates re-exports; §3.5 isn't uniquely deficient. But the spirit holds: enumeration in `__init__.py` should be explicit. Fix by adding a "Public symbols (re-exported from `__init__.py`)" sub-bullet under each of §3.2-§3.6, naming the exact symbol surface per service.

- **§1 "service file" undefined — Low.** Resolved by dropping the LOC claim per finding #9. No separate revision needed.

- **25-30 commit estimate off — Low.** Recompute per the actual per-service template walk: 4 + 4 + 5 + 5 + 5 = 23 base commits, plus 1-2 closeout commits. Revise §4.4 to "approximately 23-25 commits total."

- **§5.7 has no actionable pre-flight — Low.** Replace the assertion with a concrete grep: `grep -rEn "^(client|mongo|driver|pc|agent_chain)\\s*=" backend/app/services/` — expect zero matches. If any match, surface the offender before starting the phase.

- **graph_chat.py exclusion criterion not stated — Low.** Add one sentence to §2.1: "Services below ~800 LOC (`graph_chat.py`, `org_auth.py`, `profiles.py`, `customer_profile.py`, `pipeline.py`, `leads.py`) are not decomposed in this phase — they fit on one screen and the package overhead would exceed the readability benefit."

- **`_ensure_*_indexes` rule generalization — Low.** Resolved by the new §3.7 exception-list section per finding #3. No separate revision needed.

- **Test-file location for non-renamed services unstated — Low.** Add to §2.1 item 1: "Test files (`tests/test_<domain>.py`, `tests/unit/test_<domain>.py`) stay at their current locations for the four non-renamed services; only `data_sources/`'s tests get renamed."

- **§5.6 misclassifies scope decision as risk — Low.** Demote §5.6 to a one-line note in §2.2: "TD-005 and TD-007 sit in files this phase touches but are out of scope; downstream phases can address them without conflict."

- **§6 "code-review pass" criterion is process not property — Low.** Rephrase: "Each `__init__.py` contains only `from ... import` statements, an `__all__` list, and optionally a docstring — no executable logic. No `_`-prefixed symbol appears in `__all__` outside the §3.7 exception list."

- **§7 "one-file change" claim about background-task swap is optimistic — Low.** Soften to: "...isolates the background-task body, making a future swap to a real queue easier to scope and review."

- **Status header internally contradictory — Low.** Change to: "**Status:** Draft — awaiting spec review."

- **§3.6 names scoring task as prose instead of `_run_market_scoring_for_org` — Nit.** Use the function name in the §3.6 `scoring.py` row.

## Disagreed Findings

- **No smoke-import verification in §4.3 — Low.** Pytest collection imports `app.main` transitively via `conftest.py` and the test fixtures. Any import error fails at the pytest collection phase (before any test runs) with a clear traceback. The proposed `python -c "from app.main import app"` adds nothing pytest doesn't already cover. Leaving §4.3 as-is.

- **No `__pycache__` cleanup mention — Nit.** Phase A executed the same kind of module→package shift (root `api.py`/`services.py` → `app/` package) without any spec-level `__pycache__` guidance. Implementors handled the operational hygiene implicitly. Adding it to this spec creates noise without solving a real problem.

- **No effort/timeline estimate — Nit.** Phase A, B, F, and G specs all lacked timeline estimates — this is established project convention. The user does the scheduling against other work themselves; the spec captures intent, not calendar. Adding an estimate would deviate from precedent for no clear benefit.

## Deferred Findings

(none)

## Severity Disagreements

(none — all severities accepted as assigned)

## Open Questions

(none — all findings resolved into agree/disagree)
