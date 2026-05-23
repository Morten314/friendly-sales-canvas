# Review: Backend Modularization Phase D Plan (`plans/modularization-plan-4.md`)

**Reviewed:** `plans/modularization-plan-4.md` (1312 lines, 17 tasks, ~15 commits)
**Referenced spec:** `specs/2026-05-22-backend-modularization-phase-d-design.md`
**Reviewer:** Kilo (automated)
**Date:** 2026-05-22
**Verdict:** Well-structured plan that faithfully implements the spec. Several edge cases and clarity gaps worth addressing before execution. No blocking issues.

---

## 1. Spec Fidelity

The plan correctly implements every item from the spec:

| Spec §4.2 commit | Plan task | Status |
|---|---|---|
| 1: Add hierarchy classes | Task 2 | Matched |
| 2: Register handlers | Task 3 | Matched |
| 3-11: Per-service migration | Tasks 4-12 | Matched (same file order) |
| 12: Delete router catches | Task 13 | Matched |
| 13: Remove `raise_on_error` | Task 14 | Matched |
| 14: Background tasks | Task 15 | Matched |
| 15: Final sweep | Task 16 | Matched |

The plan adds a pre-flight section (branch creation + baseline tests) and a Task 1 discovery pass that the spec mentions but doesn't structure as a discrete task. This is an improvement — the spec's §4.1 discovery was underspecified, and the plan makes it concrete.

**One deviation:** The spec says "~34 wrap-and-rethrow sites" (§2.1 item 5). The plan's Task 1 Step 3 says "Expected count: ~34." Verification against the current codebase shows the `except Exception as e:` → `raise HTTPException(500)` pattern count is consistent with this. The plan should note that the count is approximate and the discovery pass will produce the exact number.

---

## 2. Structural Strengths

### 2.1 Task 1 discovery pass is well-designed

The six-step discovery (enumerate raises → extract metadata → find wrap-and-rethrow sites → find re-raise sites → consolidate leaves → write artifact) is thorough. The output artifact format (Task 1 Step 6) is concrete and immediately consumable by Task 2. This is better than the spec's vaguer description.

### 2.2 Per-service shared pattern section

The "Per-service migration shared pattern" section (lines 368-403) is excellent. Showing the before/after transformation explicitly saves the implementer from re-deriving the pattern for each of the 9 service files. The section also correctly handles the two variants of wrap-and-rethrow deletion (full deletion vs. logging preservation).

### 2.3 Per-task special notes

Tasks 7 (documents.py), 8 (signals.py), 10 (icp.py), 11 (leads.py), and 12 (market_scoring.py) all include "Special note" sections highlighting file-specific concerns (BackgroundTasks import, `raise_on_error` call sites, ICPIdRegistryError preservation, etc.). This is good defensive planning.

### 2.4 Commit messages are high-quality

Each commit message explains the *why*, not just the *what*. The messages include context about what was removed, what's preserved, and test counts. This follows the project's commit-message conventions well.

---

## 3. Issues and Corrections

### 3.1 Test count assertion needs pre-flight verification (medium)

The plan says "93 passed" at every validation step. The spec review (`docs/reviews/2026-05-22-backend-modularization-phase-d-review.md` §1) noted a potential discrepancy between "89 test functions" and "93 tests" (parameterized tests). The pre-flight Step 2 should capture the **exact** output and use it as the baseline, rather than asserting a hardcoded number. The plan does say "If the count differs, note the actual baseline and confirm with the user before proceeding" — this is correct, but the hard-coded "93 passed" throughout the rest of the plan will confuse an agent that sees a different number.

**Recommendation:** Change every `Expected: 93 passed` to `Expected: <baseline> passed (captured in Pre-flight Step 2)`. This makes the plan self-adjusting.

### 3.2 Task 1 discovery output persistence is fragile (medium)

Task 1 Step 6 says "Save the leaf-class list as a comment block intended for the top of `app/core/exceptions.py` and a long-form inventory intended for Task 2's commit message." But the task doesn't actually write the inventory to a file — it just describes the format. An agent implementing this could lose the inventory between tasks (context windows, session resets).

**Recommendation:** Add an explicit step: "Write the full inventory to `/tmp/phase-d-leaf-inventory.txt` for reference by subsequent tasks." This gives the agent a durable artifact to read back.

### 3.3 Task 2 has placeholder code in the template (low)

Task 2 Step 2 shows the new `exceptions.py` with placeholder comments like:
```python
# [Add one class per leaf identified in Task 1. Each is one line: ...]
```

The task then says "**Important:** This template is a skeleton. The placeholder comments ... must be replaced." This is fine for a human but could confuse an agent that tries to commit the template verbatim.

**Recommendation:** Remove the placeholder comments entirely. Instead, add a note: "Populate all leaf classes from the Task 1 inventory before writing the file. The committed file must contain zero placeholder comments."

### 3.4 Task 3 handler placement description is imprecise (low)

Task 3 Step 3 says to place handlers "after the CORS middleware block (around line 33), before the first `from app.routers import ...` import." Imports are typically at the top of the file, while handler registrations are in the module body after `app = FastAPI()`. This placement instruction conflates import lines with executable code.

**Recommendation:** Say "Place after the CORS middleware configuration block and before the first `app.include_router(...)` call." This is unambiguous.

### 3.5 Task 11 leads.py `raise_on_error` handling is subtly complex (medium)

The plan shows a three-state progression:
1. Phase C end-state: `if raise_on_error: raise HTTPException(500, ...)`
2. After Task 11: `if raise_on_error: logger.error(...); raise`
3. After Task 14: the entire `if/else` block is gone

State 2 uses bare `raise` to re-raise whatever `e` is. If `e` is a Neo4j driver exception (not a `BrewraError`), it propagates to FastAPI's default handler, which returns 500. This is correct behavior — but the plan should explicitly note that bare `raise` in the `if raise_on_error:` branch intentionally lets non-domain exceptions propagate to FastAPI's default 500. An agent might try to wrap it in a `BrewraError`.

**Recommendation:** Add a clarifying note in Task 11 Step 2: "Bare `raise` is correct here — Neo4j driver errors are not domain exceptions and should propagate to FastAPI's default handler. Do not wrap in a BrewraError subclass."

### 3.6 Task 14 Step 2 removes the outer try/except entirely (medium)

The replacement `get_leads_for_org` function has no try/except at all. The plan says "Neo4j driver exceptions propagate to the registered handler (catch-all 500)." This is misleading — there is no registered "catch-all 500" handler. FastAPI's *default* handler catches unhandled exceptions and returns 500, which is the correct behavior, but the phrasing suggests a registered handler exists.

**Recommendation:** Change "Neo4j driver exceptions propagate to the registered handler (catch-all 500)" to "Neo4j driver exceptions propagate unhandled; FastAPI's default error handler returns HTTP 500."

### 3.7 Cross-service exception type transitions during migration (low, worth documenting)

During the migration window (Tasks 4-12), already-migrated services will call yet-to-be-migrated services. For example:
- `signals.py` (Task 8) calls `leads.py`'s `get_leads_for_org` (Task 11). When signals is migrated, leads still raises `HTTPException`. The `raise_on_error=False` flag suppresses it. When leads is later migrated, the exception type changes to domain exceptions, but `raise_on_error=False` still suppresses.
- `customer_profile.py` (Task 6) may call `leads.py` or `icp.py` functions. The exception type changes between commits.

This works correctly because:
1. The hierarchy and handlers are in place (Tasks 2-3) before any per-service migration.
2. Each service migration only changes what it *raises*, not what it *catches* from others.
3. `HTTPException` raised by unmigrated services is still caught by FastAPI's built-in handler.
4. Domain exceptions raised by migrated services are caught by the registered handlers.

**Recommendation:** Add a brief note to the "Per-service migration shared pattern" section explaining why the ordering doesn't create cross-service breakage. This prevents the implementer from worrying about it.

### 3.8 `pytest` may not be available in the environment (low)

The current environment shows `ModuleNotFoundError: No module named 'pytest'` when running `pytest`. This could be a virtualenv issue. The plan should note that tests must be run from within the backend's virtual environment.

**Recommendation:** Add to the Pre-flight section: "Ensure the backend virtual environment is active before running pytest. If pytest is not found, activate the venv or install dependencies."

---

## 4. Missing Considerations

### 4.1 No pre-flight verification of Phase C completion

Phase D depends on Phase C being complete. The current `exceptions.py` (16 lines, `BudgetExhaustedError` + `ICPIdRegistryError` inheriting from `Exception`) matches the post-Phase-C state. But the plan doesn't verify this — if Phase C was only partially applied, the starting state would be wrong.

**Recommendation:** Add a pre-flight Step 3: "Verify `app/core/exceptions.py` contains exactly 2 classes (`BudgetExhaustedError`, `ICPIdRegistryError`), both inheriting from `Exception`. If the file differs, Phase C may not be complete — stop and verify."

### 4.2 No mention of `routers/market_scoring.py` line ~126 caller

The plan correctly updates `services/market_scoring.py` callers of `get_leads_for_org` in Task 14, but `routers/market_scoring.py` line ~126 also called `fetch_leads_for_org` (now `get_leads_for_org`) per Phase C Task 4 Step 7. Task 14 Step 3 lists 4 callers but only names `services/market_scoring.py` (2 sites) and `services/signals.py` (2 sites). If the router also calls it with `raise_on_error=False`, it should be listed.

**Recommendation:** Verify whether `routers/market_scoring.py` still calls `get_leads_for_org`. If it does, add it to Task 14's caller-update scope.

### 4.3 Discovery pass doesn't audit for `try/except Exception as e` blocks that do meaningful work

The plan identifies two deletion targets: `except HTTPException: raise` (re-raise) and `except Exception as e: raise HTTPException(500, ...)` (wrap-and-rethrow). But some `except Exception as e:` blocks do more than just rethrow — they perform cleanup (closing connections, updating status, etc.). Blindly deleting these would lose the cleanup logic.

**Recommendation:** Add a step to Task 1: "For each `except Exception as e:` block found, check whether it performs side effects beyond logging and rethrowing (e.g., status updates, connection cleanup). Flag any that do — these need careful transformation, not deletion."

### 4.4 `BudgetExhaustedError` handler response shape differs from other handlers

In Task 3, the `BudgetExhaustedError` handler returns `content={"detail": exc.args[0]}` where `args[0]` is a dict. Other handlers return `content={"detail": str(exc)}`. The response shape is:
- Most errors: `{"detail": "some string"}`
- Budget exhausted: `{"detail": {"error": "...", "token_limit_5m": ..., ...}}`

This inconsistency exists today (the router catches already produce this shape). The plan preserves it, which is correct. But it should note this explicitly so the implementer doesn't try to "fix" it.

**Recommendation:** Add a note to Task 3: "The BudgetExhaustedError handler produces `{"detail": <dict>}`, while all other handlers produce `{"detail": <string>}`. This is intentional and matches the current router-catch behavior. The frontend already handles both shapes."

### 4.5 No plan for handling 500-status raises that AREN'T in wrap-and-rethrow blocks

33 of the 77 raises are `status_code=500`. The plan says 32 of these are inside `except Exception as e:` blocks (wrap-and-rethrow → deleted). That leaves 1 standalone 500 raise. The plan doesn't identify which file/line this is or what happens to it.

**Recommendation:** Task 1's discovery should explicitly identify the standalone 500 raise(s). The plan should state whether it gets mapped to a domain exception (unlikely — 500 is a catch-all) or deleted as part of removing its surrounding try/except wrapper.

---

## 5. Design Suggestions

### 5.1 Consider consolidating Tasks 4-12 into a sub-agent pattern

9 nearly-identical tasks (read → replace → delete → update imports → test → commit) are repetitive. A sub-agent pattern (one Task 4 template, then invoke per-file) would reduce plan length by ~400 lines and make updates easier.

**Not a blocker** — the current format is more self-contained and friendlier to sequential execution. But if the plan is revised, consider this refactor.

### 5.2 Task 15 should verify the background-task error path with a targeted test

The plan runs `pytest tests/test_market_scoring.py tests/test_leads.py` in Task 15 Step 7, but existing tests mock storage and never exercise the error-propagation path. Consider adding a note: "If no existing test exercises the BrewraError catch path in `_run_market_scoring_for_org`, the validation is structural only. A future Phase E test pass should add a unit test for this path."

### 5.3 Task 17 should include a diffstat check

Task 17 checks grep-based hard criteria and test counts. Adding `git diff master..HEAD --stat -- backend/app/services/` to confirm net-negative LOC per migrated file would strengthen the acceptance check (matching spec §6 soft criterion 10).

---

## 6. Minor Nits

1. **Line number drift disclaimer is present** but brief. The plan should note that Phase C changed line numbers, so all line references in Tasks 4-12 are approximate and should be re-located by function name, not by number.

2. **Task 4 Step 5** runs `pytest tests/test_org_auth.py`. If this test file doesn't exist (some service domains lack dedicated test files), the command will fail. The plan should say "If no test file exists for this service, skip to Step 6."

3. **Task 3 Step 3** shows 7 handler functions with 2 blank lines between each (PEP 8 top-level function spacing). This is correct but verbose. The plan could note "handlers follow PEP 8: 2 blank lines between top-level functions" to prevent an agent from wondering about spacing.

4. **Task 16 Step 6** bash loop is correct but uses `for f in backend/app/services/*.py`. The plan earlier says "Git commands run from monorepo root" and "pytest commands run from `backend/`". This loop runs from the monorepo root — should be explicit about the working directory.

5. **Commit count accounting:** The plan header says "15 commits across 17 tasks (Tasks 1 and 17 don't commit)." But Task 16's commit is conditional (only if dead imports are found). So the actual range is 14-15 commits. The plan acknowledges this in Task 16 Step 8 and Task 17's checklist. This is fine — just noting the range is 14-15, not always 15.

---

## 7. Summary of Recommendations

**Should address before execution:**
- Make test-count baseline self-adjusting (§3.1)
- Persist discovery output to a file (§3.2)
- Verify Phase C completion in pre-flight (§4.1)
- Check for `routers/market_scoring.py` caller of `get_leads_for_org` (§4.2)
- Audit for side-effect-bearing `except` blocks during discovery (§4.3)
- Identify standalone (non-wrap-and-rethrow) 500 raises (§4.5)

**Nice-to-have (clarity improvements):**
- Remove placeholder comments from Task 2 template (§3.3)
- Clarify handler placement in Task 3 (§3.4)
- Add note about bare `raise` semantics in Task 11 (§3.5)
- Fix "registered handler" misnomer in Task 14 (§3.6)
- Document cross-service exception transition safety (§3.7)
- Note pytest virtualenv requirement (§3.8)
- Note BudgetExhaustedError response shape inconsistency (§3.4)
- Add diffstat check to Task 17 (§5.3)

**Overall assessment:** The plan is well-structured and faithful to the spec. The per-service migration pattern is clear and repeatable. The main gaps are around pre-flight validation rigor and edge-case documentation. None of the issues are blocking — an experienced implementer could execute the plan as-is with minor in-flight adjustments. Addressing the §3.1 and §4.1-§4.3 items would significantly reduce the risk of mid-execution surprises.
