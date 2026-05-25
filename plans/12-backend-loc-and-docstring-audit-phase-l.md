# Phase L — Backend LOC + Docstring Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the bundled TD-008 (LOC reduction) + TD-009 (docstring/code-comment drift) pass across all 91 Python files in `backend/app/`. Produce a committed audit scorecard, investigate medium-confidence findings to promotion or deferral, then execute every confirmed reduction one commit at a time with byte-equality or pyflakes/grep evidence per task.

**Architecture:** Three-stage execution within one phase. Stage 1 = audit (1 commit producing the scorecard). Stage 2 = investigation (1 commit updating the scorecard with promote/defer verdicts). Stage 3 = execution (one commit per `execute` finding, low-risk first). Each Stage-3 commit ships its behavior-preservation evidence in the diff.

**Tech Stack:** Python 3.12, FastAPI, pytest, pytest-mock, pyflakes. No new dependencies. New test fixtures live in `backend/tests/_baselines/` (K2 prompt baselines) and `backend/tests/fixtures/market_research_prompts/` (K3 prompt fixtures).

**Spec:** `specs/12-backend-loc-and-docstring-audit-phase-l-design.md` (3 review rounds applied; status "design approved").

**Branch:** `refactor-backend-loc-docstring-audit-phase-l` off `master` (current HEAD at plan-writing time: `a07a086 docs(specs): apply round 3 review synthesis to Phase L spec`).

**Baseline (measured at plan-writing time):** 248 behavior tests passing, 19 syrupy snapshots passing, 91 Python files under `backend/app/`, 10,403 LOC. Verified by `cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q` on master `a07a086`.

**Target:**
- Test count: 248 + N where N = number of new behavior-preservation tests added by Phase L (K2 baseline test, K3 parametrized prompt test, and any audit-surfaced additions). Each task that adds a test increments N by a known amount; the final count is the sum.
- Snapshot count: 19 (unchanged — Phase L doesn't touch snapshot-tested surfaces).
- LOC: estimated -370 to -460 from known wins K1–K7, plus any audit-surfaced reductions and investigation-promoted findings.

**Commit-message convention:** `type(scope): <description> [phase L]` per CLAUDE.md. **No `[N/M]` numbering** — Phase L commits are bounded by the scorecard, not a fixed task count. **No `Co-Authored-By` footer** (recorded user preference). For Stage 3 known wins, the description names the win (e.g., `refactor(be): extract _update_run helper in market_scoring/scoring [phase L]`).

**Greenness invariant:** Every commit ends with `cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q` clean. No "fix in next commit" exceptions. Any test failure during a task: do not commit. Either fix forward, or `git reset --hard HEAD` (working-tree changes are uncommitted; safe to discard) and re-read the step. Never commit a red state.

**Post-commit rollback:** If a latent issue surfaces *after* a commit (e.g., a subsequent task's pytest gate reveals a regression introduced earlier), use `git reset --hard HEAD~N` to revert the last N commits, or `git reset --hard master` to scrap the entire Phase L branch. Diagnose the root cause before re-attempting — do not edit the working tree to "fix forward" past a committed failure.

**Abort criterion:** If any commit drops the test count below the 248 + (tests-added-so-far) baseline, halt and surface to operator. Phase L should only ever ADD tests (never lose them); a regression indicates a behavior change disguised as a refactor.

**Per-task isolation:** The Stage 3 known wins K1–K7 are independent — each operates on a different surface (imports, scoring helper, file_status helper, market_research dispatch, llm_config prompts, _neo4j_helpers, prose). Failure of one does not automatically abort subsequent tasks. If a task fails, halt and surface; the operator decides whether to defer that task to the scorecard with a documented rationale (per spec §10 criterion 4) and proceed with the rest.

---

## Pre-flight (one-time setup, no commit)

### Task 0a: Verify master state and create branch

- [ ] **Step 1: Confirm clean tree on master**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status                                # expected: nothing to commit, working tree clean
git rev-parse --abbrev-ref HEAD           # expected: master
git log --oneline -1                      # expected: a07a086 docs(specs): apply round 3 review synthesis to Phase L spec
```

If status is not clean or HEAD is not master with the Phase L spec round-3 synthesis commit at the top, surface to operator. Do not proceed.

- [ ] **Step 2: Push the unpushed spec commits to origin/master**

```bash
git status -sb                            # expected first line: ## master...origin/master [ahead 4]
git push origin master                    # publishes 30d8792 + 55a7880 + e3d5458 + a07a086
git status -sb                            # expected first line: ## master...origin/master (no "ahead")
```

The Phase L spec and its 3 synthesis docs were committed locally but never pushed. Publishing them now ensures the Phase L branch's base is shared with origin before any new work lands.

- [ ] **Step 3: Create the Phase L branch**

```bash
git checkout -b refactor-backend-loc-docstring-audit-phase-l
git branch --show-current                 # expected: refactor-backend-loc-docstring-audit-phase-l
```

### Task 0b: Record the test and LOC baseline

- [ ] **Step 1: Run the full pytest suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected output (last 2 lines):
```
19 snapshots passed.
============== 248 passed, <N> warnings in <X>s ==============
```

If the line does not say `248 passed` and `19 snapshots passed`, halt and surface to operator — the baseline has drifted from what was measured at plan-writing time (`master @ a07a086`), and the abort criterion may need recalibration before proceeding.

- [ ] **Step 2: Record the LOC and file-count baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
find backend/app -name '*.py' | wc -l     # expected: 91
find backend/app -name '*.py' -exec cat {} + | wc -l   # expected: 10403
```

If the file count or LOC differs from 91 / 10403, the audit scope has drifted from the spec. Halt and surface — the spec's "every one of the 91 files" claim needs reconciling against the new count.

- [ ] **Step 3: Confirm pyflakes baseline is clean**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
.venv/bin/python -m pyflakes app/ 2>&1
```

Expected: no output (pyflakes runs clean). K1's success criterion is post-edit pyflakes still clean — we need to know the baseline is clean.

If pyflakes reports warnings on master, document them — they're the "documented baseline" referenced in spec §7's pyflakes check, and Phase L's success criterion is "no NEW warnings beyond this baseline."

### Task 0c: Confirm scaffolding directories exist (or create them)

- [ ] **Step 1: Ensure the audits directory exists**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
mkdir -p docs/audits
ls docs/audits/                          # may be empty; that's fine
```

The scorecard at `docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md` will be the first file committed to this directory in this repo.

---

## Stage 1 — Audit (commit 1)

### Task 1: Audit every file under `backend/app/` and produce the scorecard

This is a read-heavy stage. The deliverable is a single markdown file: `docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md`. No production code changes.

**Files:**
- Create: `docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md`

- [ ] **Step 1: Enumerate every Python file under `backend/app/`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
find backend/app -name '*.py' | sort > /tmp/phase-l-files.txt
wc -l /tmp/phase-l-files.txt              # expected: 91
cat /tmp/phase-l-files.txt | head -20
```

This list is the authoritative scope. Every file in it must receive a verdict in the scorecard.

- [ ] **Step 2: Run the per-category discovery greps to seed the audit**

For each opportunity category from spec §4, run a targeted discovery scan so the audit doesn't miss known-pattern occurrences. Categories 1, 2, 5, 6, 7 have mechanical grep signatures; categories 3, 4, 8, 9, 10, 11, 12 require per-file inspection (the next step).

```bash
cd /projects/Brewra/brewra-gtm-intelligence

# Cat 2: Stale Phase/commit refs (TD-009 — drives K7)
echo "=== Cat 2: TD-009 grep matches ==="
grep -rnE "Phase [A-Z]|commit [0-9]+/[0-9]+|extracted from .* in Phase|final form|Renamed.*in Phase" backend/app/

# Cat 5: Repeated DB-lookup boilerplate (drives K6)
echo "=== Cat 5: db = mongo[X] pattern occurrences ==="
grep -rnE 'db\s*=\s*mongo\[' backend/app/

# Cat 6: Repeated update_one CRUD pattern (drives K5)
echo "=== Cat 6: update_one occurrences in market_scoring ==="
grep -rnE '\.update_one\(' backend/app/services/market_scoring/

# Cat 7: Cross-file duplicate helpers — fetch_company_profile (drives K4)
echo "=== Cat 7: CompanyProfile MATCH pattern occurrences ==="
grep -rnE 'MATCH \([cp]:CompanyProfile' backend/app/
```

Save the output of each grep to the audit workspace for reference while writing the scorecard. The expected matches per category (from the spec's verified known wins):
- Cat 2: 25 matches across ~12 files (spec K7 verified)
- Cat 5: 11 matches in `data_sources/{persistence,pipeline}.py` (spec K6 verified)
- Cat 6: 10 matches in `market_scoring/scoring.py` at lines 48, 55, 69, 83, 97, 112, 162, 173, 192, 208 (spec K5 verified)
- Cat 7: 8 matches across customer_profile/orchestrator (3 sites), market_scoring/persistence, market_research/orchestrator, icp/orchestrator, signals/ask (2 sites) (spec K4 verified)

If your grep counts differ from these, that's significant — flag it in the scorecard's per-cross-cutting-finding section. The known-win counts may have drifted since spec writing if code landed between spec approval and Phase L execution.

- [ ] **Step 3: For each file, perform a per-file audit pass**

Read each file in `/tmp/phase-l-files.txt`. For each one, apply the 12 categories from spec §4 and record findings using this template:

```markdown
### backend/app/<path-to-file>.py (<N> LOC)

- **Cat <N> (<category-name>) — <execute|investigate|design-discussion>.**
  <one-line description of the finding>
  <behavior-preservation strategy, if applicable>
  Est. -<N> LOC.

  [...additional findings, one block per finding...]
```

If a file has no findings, record it as `_audited; clean_` (or, if combining clean files into a table per spec §5's optional grouping, add it as a row in the `## Clean files` table).

**Per-file inspection checklist:**

For each file, look for:

| Category | What to look for | How to verify |
|---|---|---|
| Cat 1: Unused imports | Each `from X import a, b, c` or `import X`: is each name used in the file body? | Grep the symbol name in the file (excluding the import line itself). If only the import line matches, it's unused. Confirm with pyflakes if ambiguous. |
| Cat 2: Stale phase/commit refs | Match the pattern from Step 2's Cat-2 grep against the file | Already enumerated; record each per-file occurrence as a finding. |
| Cat 3: Near-identical string literals | Two multi-line strings (≥3 lines each) that differ only in a bounded section | Visual inspection. Strong candidates: prompt-style strings, repeated Cypher queries. |
| Cat 4: Near-duplicate functions | Functions with similar bodies (similar control flow, same identifiers except for a small variant) | Visual inspection. Strong candidate: `Research_Market_1..5` in `market_research/orchestrator.py` (already known per K3). |
| Cat 5: Repeated DB-lookup boilerplate | `db = mongo[...]; coll = db[...]` (or similar) ≥3 times in the file or package | Step 2 already enumerated for `data_sources`. Check other packages too. |
| Cat 6: Repeated CRUD wrapper patterns | `coll.<crud>(...)` with same filter shape ≥3 times in one file | Step 2 already enumerated for `market_scoring/scoring.py`. Check other files for similar patterns. |
| Cat 7: Cross-file duplicate helpers | A function body or query appearing identically in ≥2 files | Step 2 already enumerated CompanyProfile MATCH. Inspect other repeated patterns. |
| Cat 8: Single-use trivial wrappers | Functions that are just a one-line call to another, called from only one site | Use `grep -rn "function_name"` to check call-site count. |
| Cat 9: Dead code | Module-level functions/constants with zero callers anywhere | Grep the name across `backend/` (including tests). If only the declaration matches, it's dead — but verify no `getattr` / `*`-imports / `__all__` re-exports. |
| Cat 10: Inline data-munging blocks | Multi-line transforms (e.g., dict normalization, list filtering) that appear in multiple sites | Visual inspection. Tag as `investigate` if the sites' inputs look similar but might have subtle differences. |
| Cat 11: Redundant fallback branches | `if X: fetch_with_X() else: fetch_without_X()` patterns where the "without" branch may be unreachable | Tag as `design-discussion` — removal is a behavior decision. |
| Cat 12: Long string literals worth hoisting | Multi-line strings (prompts, Cypher, etc.) that could move to a registry | Tag as `design-discussion` — overlaps with TD-010 prompt externalization, deferred. |

**Confidence tagging:**
- `execute`: byte-equivalence is mechanically provable, or a test ships as part of the commit
- `investigate`: appears safe but needs per-site behavior-surface analysis (Stage 2)
- `design-discussion`: involves a behavior or interface trade-off (deferred from Stage 3, recorded for future work)

- [ ] **Step 4: Verify the 7 known wins (K1–K7) are surfaced by the audit**

The spec's §6 lists 7 known wins. After completing Step 3, confirm each is present in the scorecard:

- **K1**: Cat 1 findings across `models/__init__.py`, `routers/data_sources.py`, `services/market_scoring/orchestrator.py`, `services/market_research/orchestrator.py`, `services/icp/persistence.py` — totaling ~16 symbols
- **K2**: Cat 3 finding on `core/llm_config.py` — `Cypher_gen_prompt`/`Cypher_gen_prompt2` (88 vs 84 lines, 4-line diff) and `qa_prompt_template`/`qa_prompt_template2` (34 vs 28 lines, 6-line diff)
- **K3**: Cat 4 finding on `services/market_research/orchestrator.py` — `Research_Market_1..5` byte-identical after template-name normalization
- **K4**: Cross-cutting Cat 7 finding — `fetch_company_profile` duplication across 8 sites in 5 files
- **K5**: Cat 6 finding on `services/market_scoring/scoring.py` — 10 `update_one` sites
- **K6**: Cross-cutting Cat 5 finding — `db = mongo["File_Processing"]; collection = db["file_status"]` across 11 sites in `services/data_sources/{persistence,pipeline}.py`
- **K7**: Cat 2 finding — 25 grep matches enumerated by Step 2's Cat-2 grep

If any K-known-win is absent from the scorecard at this stage, the audit has missed something — re-inspect those files. If a K-known-win is present with a different count than the spec's, document the drift in the scorecard's note line for that finding.

- [ ] **Step 5: Identify cross-cutting findings**

A finding is "cross-cutting" if it touches multiple files (e.g., K4 fetch_company_profile, K6 file_status pattern, K7 docstring drift). Group these in a separate `## Cross-cutting findings` section in the scorecard. Each cross-cutting finding lists every site and the proposed centralization target.

- [ ] **Step 6: Write the scorecard file**

Write `docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md` using the format from spec §5:

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
| Investigated → promoted to execute | TBD (Stage 2) | TBD |
| Investigated → deferred | TBD (Stage 2) | — |
| Design-discussion (future work) | <N> | — |

## Per-file findings

<one ### subsection per file with findings, or a single ## Clean files table for verdict-only entries>

## Cross-cutting findings

### Cat 7: fetch_company_profile duplication — execute (K4)
<sites + strategy + LOC est>

### Cat 5: db = mongo["File_Processing"]; collection = db["file_status"] pattern — execute (K6)
<sites + strategy + LOC est>

### Cat 2: TD-009 stale Phase/commit references — execute (K7)
<per-match table or grouped list + LOC est>

<other cross-cutting findings as needed>

## Future work (design-discussion)

<one entry per design-discussion finding with rationale>
```

The Stage-1 commit captures the scorecard with `Investigated → promoted` and `Investigated → deferred` set to `TBD (Stage 2)`. Stage 2 updates these in a subsequent commit.

- [ ] **Step 7: Verify every one of the 91 files is represented**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Extract every file path mentioned in the scorecard and compare against /tmp/phase-l-files.txt
grep -oE 'backend/app/[^ )]*\.py' docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md | sort -u > /tmp/scorecard-files.txt
diff /tmp/phase-l-files.txt /tmp/scorecard-files.txt
```

Expected: no diff output (every file in `find` output appears in the scorecard). If files are missing from the scorecard, return to Step 3 and audit them.

- [ ] **Step 8: Commit the Stage 1 scorecard**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md
git commit -m "chore(audit): Phase L scorecard for backend LOC + docstring sweep [phase L]"
```

Per spec §5, the scorecard is a "frozen snapshot at this point" — Stage 2 will update it, and that update is a separate commit (so this stage's content is preserved in history).

---

## Stage 2 — Investigation (commit 2)

### Task 2: Investigate every `investigate` finding and update the scorecard

For each finding tagged `investigate` in the Stage-1 scorecard, apply the spec's §4 investigation methodology. The output is an updated scorecard with each `investigate` entry resolved to either promote-to-`execute` (with a written behavior-preservation strategy) or defer-to-`design-discussion` (with a written rationale).

**Files:**
- Modify: `docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md`

- [ ] **Step 1: Enumerate every `investigate` finding from the scorecard**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE '— investigate\.|— investigate$|tag.*investigate' docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md
```

Make a list of each finding to investigate. The list defines the scope of Stage 2's work.

- [ ] **Step 2: For each investigate finding, apply the 5-step investigation**

Per spec §4 "Investigation methodology (Stage 2)", for each finding:

1. **Enumerate every call site** of the affected symbol across `backend/app/` and `backend/tests/`. Use `grep -rn <symbol> backend/app/ backend/tests/`.
2. **Read each call site in full** — the surrounding 10–20 lines, the function signature it lives in, what's passed as arguments, what's done with the return value.
3. **Identify observable surfaces** — return value shape, exception types raised, side effects (DB writes, log lines, metric increments), evaluation order if relevant.
4. **Write a behavior-preservation strategy** stating: under the proposed refactor, surface S behaves as follows; this matches the pre-refactor behavior because [reason]. Repeat per observable surface.
5. **Decide**: if every observable surface is preserved with high confidence (and provable via assertion or test), **promote to `execute`** with the strategy captured. Otherwise **defer to `design-discussion`** with the rationale captured.

**Soft cap (spec §2, §4):** an investigation defers if it requires reading more than 5 files beyond the direct callers of the affected symbol, or 3 full read-analyze cycles without converging on a behavior-preservation strategy. Document the cap-trigger in the finding's deferral rationale.

- [ ] **Step 3: Update the scorecard with verdicts**

For each `investigate` finding, replace its `— investigate.` tag with either:
- `— execute (promoted from investigate).` followed by the behavior-preservation strategy
- `— design-discussion (deferred from investigate).` followed by the rationale

Update the summary table:
- `Investigated → promoted to execute`: count and LOC estimate
- `Investigated → deferred`: count

- [ ] **Step 4: Commit the Stage 2 update**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md
git commit -m "chore(audit): Phase L investigation outcomes [phase L]"
```

Stage 2 produces no production-code changes — only the scorecard update. pytest doesn't need to run here (no code touched), but if you've used the `.venv` for any inspection scripts, run it as a sanity check before commit.

---

## Stage 3 — Execution

Each task below is one Stage-3 commit. Tasks are sequenced low-risk first per spec §9. Every task ends with:
- `cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3` showing `>= 248 passed, 19 snapshots passed`
- A commit message in the form `<type>(be): <description> [phase L]` (no `[N/M]` numbering, no `Co-Authored-By` footer)

After all K1–K7 tasks complete, the "Audit-surfaced additions" task block (described at the end of Stage 3) processes any additional `execute` findings from Stage 1 and any promoted findings from Stage 2.

---

### Task K1: Remove verified unused imports (commit 3)

The Stage-1 scorecard enumerates the specific unused-import findings. Apply each as a per-symbol removal with a per-symbol verification.

**Files (per scorecard K1 findings):**
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/routers/data_sources.py`
- Modify: `backend/app/services/market_scoring/orchestrator.py`
- Modify: `backend/app/services/market_research/orchestrator.py`
- Modify: `backend/app/services/icp/persistence.py`
- (Plus any additional files surfaced as Cat 1 findings during Stage 1.)

- [ ] **Step 1: Re-confirm each candidate symbol is unused**

For each unused-import candidate from the scorecard, run a per-symbol grep across the entire `backend/app/` tree:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# For each symbol, replace <SYM> with the symbol name and <FILE> with the declaring file
grep -rn "<SYM>" backend/app/ | grep -v "<FILE>:"
```

Expected: no output for a truly unused symbol — `grep -v <FILE>` excludes the import line and the declaring file's other uses. If output is non-empty, the symbol IS used elsewhere; remove it from the candidate list.

**Special case: re-exports.** If `backend/app/models/__init__.py` has `from app.models.pagination import PaginatedResponse  # noqa: F401`, the `# noqa: F401` annotation means the import is intentionally a public re-export (other modules may import via `from app.models import PaginatedResponse`). Run the grep against the full tree (including outside the declaring package):

```bash
grep -rn "PaginatedResponse" backend/                          # all locations
grep -rn "from app.models import.*PaginatedResponse" backend/  # callers via the re-export
```

If callers use the re-export, **keep** the import (it's a public API), regardless of pyflakes silence via `# noqa`. If no callers exist, the re-export is dead and can go (but only with strong confidence — re-exports can be picked up by external consumers).

- [ ] **Step 2: Remove each confirmed-unused import**

For each confirmed-unused symbol, edit its declaring file to remove the symbol from its import statement (or remove the entire import line if it was a sole-symbol import).

Example edits:
```python
# Before
from app.core.config import groq_api_key, together_api_key, CLAUDE_RESEARCH_MAX_TOKENS

# After (if CLAUDE_RESEARCH_MAX_TOKENS was the unused one)
from app.core.config import groq_api_key, together_api_key
```

```python
# Before
import shutil
from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Form, HTTPException, Query, Response, UploadFile

# After (if `shutil` was unused and so was `Response`)
from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Form, HTTPException, Query, UploadFile
```

Make one edit per symbol. Do NOT bundle removals across multiple files into one giant diff — each file's edits stay self-contained within the same commit, but the diff should be reviewable per file.

- [ ] **Step 3: Run pyflakes to confirm no new warnings**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
.venv/bin/python -m pyflakes app/ 2>&1
```

Expected: same as baseline (Task 0b Step 3) — no new warnings introduced. Pyflakes may surface unrelated warnings; if any line now says "X imported but unused" that didn't say so on master, that's a bug in this task's edit (e.g., you removed the symbol from a multi-name import but accidentally left the import line empty or mis-formed).

- [ ] **Step 4: Run the full pytest suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. K1 adds no tests; the count is unchanged from baseline.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/
git commit -m "refactor(be): remove verified unused imports [phase L]"
```

---

### Task K5: Extract `_update_run` helper in market_scoring/scoring (commit 4)

K5 extracts a private `_update_run(run_coll, run_id, **fields)` helper that performs `run_coll.update_one({"run_id": run_id}, {"$set": fields})`. Each of the 10 call sites in `backend/app/services/market_scoring/scoring.py` is rewritten as a one-line call to the helper.

**Files:**
- Modify: `backend/app/services/market_scoring/scoring.py`

The 10 call sites are at lines 48, 55, 69, 83, 97, 112, 162, 173, 192, 208 (verified by the spec and re-verified during Stage 1's audit).

- [ ] **Step 1: Inspect each call site and confirm the filter/$set shape**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nB1 -A6 "\.update_one(" backend/app/services/market_scoring/scoring.py
```

Verify each `update_one` call uses the form:
```python
run_coll.update_one(
    {"run_id": run_id},
    {"$set": {
        <key>: <value>,
        <key>: <value>,
        ...
    }}
)
```

If any site uses a different filter (e.g., `{"_id": ...}`) or a different update operator (`$push`, `$inc`), it doesn't fit the helper — leave it inline and document in the scorecard. Most or all 10 should fit the shape.

- [ ] **Step 2: Define the helper near the top of `scoring.py`**

Add the helper definition immediately after the import block (before the first existing function). The helper is private (leading underscore):

```python
def _update_run(run_coll, run_id: str, **fields) -> None:
    """Set ``fields`` on the run document identified by ``run_id``.

    Trivial wrapper around ``run_coll.update_one({"run_id": run_id}, {"$set": fields})``.
    Preserved exactly: the filter shape, the $set operator, and the lack of
    upsert/return-value handling at every call site.
    """
    run_coll.update_one({"run_id": run_id}, {"$set": fields})
```

- [ ] **Step 3: Replace each of the 10 call sites with a `_update_run(...)` call**

For each site, replace the multi-line `update_one` call with a single-line `_update_run` call.

Example transformation:
```python
# Before (lines 48-53 in scoring.py, illustrative — verify exact content)
run_coll.update_one(
    {"run_id": run_id},
    {"$set": {
        "status": "running",
        "started_at": datetime.now(timezone.utc),
    }}
)

# After
_update_run(run_coll, run_id, status="running", started_at=datetime.now(timezone.utc))
```

Do all 10 sites. The filter `{"run_id": run_id}` and the `$set` operator move inside the helper; the only thing that varies is the **fields** payload, which becomes keyword arguments.

If any field name is not a valid Python identifier (e.g., contains a `.` or `-`), it can't be passed as a `**kwargs` keyword. In that case, leave the site inline and document in the commit message (this is unlikely for run-document fields, which are typically plain identifiers).

- [ ] **Step 4: Verify zero remaining direct `update_one` calls on `run_coll`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -n "run_coll.update_one" backend/app/services/market_scoring/scoring.py
```

Expected: no matches if all 10 sites were converted. If any remain, they're either intentional (different filter/operator — see Step 1) or missed; investigate and either convert or document.

- [ ] **Step 5: Run module-scoped pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/ -k market_scoring 2>&1 | tail -5
```

Expected: all tests in `tests/test_market_scoring.py` and `tests/unit/test_market_scoring.py` pass.

- [ ] **Step 6: Run the full pytest suite**

```bash
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. K5 adds no tests.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/market_scoring/scoring.py
git commit -m "refactor(be): extract _update_run helper in market_scoring/scoring [phase L]"
```

---

### Task K6: Extract `_get_file_collection` helper in data_sources (commit 5)

K6 extracts a private `_get_file_collection(mongo)` helper that returns `mongo["File_Processing"]["file_status"]`. Each of the 11 call sites across `persistence.py` (4 sites) and `pipeline.py` (7 sites) is rewritten.

**Files:**
- Modify: `backend/app/services/data_sources/persistence.py`
- Modify: `backend/app/services/data_sources/pipeline.py`

The 11 verified sites:
- `persistence.py`: lines 23–24, 49–50, 98–99, 340–341 (4 sites, 2 lines each)
- `pipeline.py`: lines 44–45, 169–170, 194–195, 211–212, 288–289, 376–377, 407–408 (7 sites, 2 lines each)

- [ ] **Step 1: Inspect each call site**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nB1 -A3 'mongo\["File_Processing"\]' backend/app/services/data_sources/persistence.py backend/app/services/data_sources/pipeline.py
```

Confirm each site uses the exact pattern:
```python
db = mongo["File_Processing"]
collection = db["file_status"]
```

If any site uses different DB or collection names (e.g., different file-status collection), it doesn't fit the helper — leave inline.

- [ ] **Step 2: Define the helper in `persistence.py` near the top**

Add the helper immediately after the import block in `backend/app/services/data_sources/persistence.py`:

```python
def _get_file_collection(mongo):
    """Return the ``File_Processing.file_status`` collection from the given mongo client.

    Centralizes the two-line lookup used at every file-status read/write site.
    The returned collection object behaves identically to the prior inline
    pattern: ``mongo["File_Processing"]["file_status"]``.
    """
    return mongo["File_Processing"]["file_status"]
```

- [ ] **Step 3: Replace each call site in `persistence.py`**

For each of the 4 sites (lines 23–24, 49–50, 98–99, 340–341), replace the two-line pattern with a one-line helper call:

```python
# Before
db = mongo["File_Processing"]
collection = db["file_status"]

# After
collection = _get_file_collection(mongo)
```

The variable name `collection` is preserved so downstream lines (which use `collection.find(...)`, `collection.update_one(...)`, etc.) don't need to change.

If a site uses different names (e.g., `db = mongo[...]; coll = db[...]`), use the helper but assign to whatever the original local name was: `coll = _get_file_collection(mongo)`.

- [ ] **Step 4: Import the helper in `pipeline.py` and replace each call site**

`pipeline.py` is a sibling module in the same package, so import the helper via:

```python
from app.services.data_sources.persistence import _get_file_collection
```

Add this import to `pipeline.py`'s import block (alongside any existing `from app.services.data_sources.persistence import ...` line, or as a new line if there isn't one).

Then replace each of the 7 sites (lines 44–45, 169–170, 194–195, 211–212, 288–289, 376–377, 407–408) with the same one-line helper call (preserving local variable names as in Step 3).

- [ ] **Step 5: Verify zero remaining inline `db = mongo["File_Processing"]` patterns**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -n 'mongo\["File_Processing"\]' backend/app/services/data_sources/persistence.py backend/app/services/data_sources/pipeline.py
```

Expected: only the helper definition's line in `persistence.py` (1 match). All 11 inline occurrences should be gone.

- [ ] **Step 6: Run module-scoped pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/ -k data_sources 2>&1 | tail -5
```

Expected: all data_sources tests pass.

- [ ] **Step 7: Run the full pytest suite**

```bash
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. K6 adds no tests.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/data_sources/persistence.py backend/app/services/data_sources/pipeline.py
git commit -m "refactor(be): extract _get_file_collection helper in data_sources [phase L]"
```

---

### Task K3: Collapse `Research_Market_1..5` into `_run_research_component` (commit 6)

K3 collapses the 5 byte-identical functions `Research_Market_1..5` in `services/market_research/orchestrator.py` into a single `_run_research_component(template, ...)` helper, dispatched via a `COMPONENT_TEMPLATES` dict. Behavior preservation: a parametrized test asserts the formatted prompt for each component byte-equals a checked-in fixture captured pre-refactor.

**Files:**
- Modify: `backend/app/services/market_research/orchestrator.py`
- Create: `backend/tests/fixtures/market_research_prompts/component_1.txt`
- Create: `backend/tests/fixtures/market_research_prompts/component_2.txt`
- Create: `backend/tests/fixtures/market_research_prompts/component_3.txt`
- Create: `backend/tests/fixtures/market_research_prompts/component_4.txt`
- Create: `backend/tests/fixtures/market_research_prompts/component_5.txt`
- Create: `backend/tests/fixtures/market_research_prompts/sample_profile.json`
- Create: `backend/tests/unit/test_market_research_prompt_assembly.py`

The 5 functions are at lines 43–69, 71–97, 99–125, 127–153, 155–181 in `orchestrator.py` (verified by Stage 1). The 5 templates are in `services/market_research/prompts.py` as `RESEARCH_MARKET_<N>_TEMPLATE` (lines 13, 102, 208, 405, 589).

- [ ] **Step 1: Confirm the 5 function bodies are byte-identical after template-name normalization**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
.venv/bin/python <<'PY'
import ast, hashlib
src = open("backend/app/services/market_research/orchestrator.py").read()
tree = ast.parse(src)
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name.startswith("Research_Market_"):
        # Normalize: strip template-name references from the body's source
        body_src = ast.unparse(node).replace(f"RESEARCH_MARKET_{node.name[-1]}_TEMPLATE", "<TEMPLATE>")
        h = hashlib.sha256(body_src.encode()).hexdigest()[:8]
        print(f"{node.name}: hash={h}")
PY
```

Expected: all 5 hashes equal (the spec verified `ce5d84bd` at writing time; current hash may differ but must be uniform across the 5).

If any function has a different hash, that's a bug in K3's premise — the function is not byte-identical to the others. Investigate and either (a) align the variant function to match the others (if the difference is incidental — e.g., a stale comment) or (b) defer that one function from K3 (leave it inline) and proceed with collapsing the remaining 4.

- [ ] **Step 2: Capture a stable sample input for fixture generation**

Create `backend/tests/fixtures/market_research_prompts/sample_profile.json` with a representative `pre_data` payload — the input that `Research_Market_<N>` consumes. The sample needs to be a valid JSON-serializable dict that matches the shape the functions expect.

Inspect any existing `Research_Market_N` body to see the variable name and shape:

```bash
grep -nB1 -A5 "company_profile_json\|pre_data\|profile_json" backend/app/services/market_research/orchestrator.py | head -40
```

Use a minimal-but-realistic profile. Example (adjust based on what the functions actually use):

```json
{
  "company_name": "Sample Company",
  "industry": "B2B SaaS",
  "size": "11-50",
  "region": "EMEA",
  "products": ["Product A", "Product B"]
}
```

Save this file at `backend/tests/fixtures/market_research_prompts/sample_profile.json`.

- [ ] **Step 3: Capture the 5 formatted prompts as fixtures (pre-refactor)**

Generate one fixture per component by formatting each `RESEARCH_MARKET_<N>_TEMPLATE` against the sample profile:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
.venv/bin/python <<'PY'
import json
from pathlib import Path
from app.services.market_research.prompts import (
    RESEARCH_MARKET_1_TEMPLATE,
    RESEARCH_MARKET_2_TEMPLATE,
    RESEARCH_MARKET_3_TEMPLATE,
    RESEARCH_MARKET_4_TEMPLATE,
    RESEARCH_MARKET_5_TEMPLATE,
)

sample = json.loads(Path("tests/fixtures/market_research_prompts/sample_profile.json").read_text())
profile_json = json.dumps(sample)

templates = {
    "component_1": RESEARCH_MARKET_1_TEMPLATE,
    "component_2": RESEARCH_MARKET_2_TEMPLATE,
    "component_3": RESEARCH_MARKET_3_TEMPLATE,
    "component_4": RESEARCH_MARKET_4_TEMPLATE,
    "component_5": RESEARCH_MARKET_5_TEMPLATE,
}

# Determine the .format() variable used by the templates by inspecting one
# Then format all 5 the same way
for name, tmpl in templates.items():
    # If the template uses {company_profile_json}, this works:
    formatted = tmpl.format(company_profile_json=profile_json)
    Path(f"tests/fixtures/market_research_prompts/{name}.txt").write_text(formatted)
    print(f"{name}: {len(formatted)} chars")
PY
```

If `.format(company_profile_json=profile_json)` raises KeyError (a different variable name is used), inspect the actual template body for `{<var>}` placeholders and adjust the script.

After running, verify the 5 fixture files exist and contain the formatted prompts:

```bash
ls -la backend/tests/fixtures/market_research_prompts/
wc -l backend/tests/fixtures/market_research_prompts/*.txt
```

- [ ] **Step 4: Write the parametrized prompt-equality test (pre-refactor)**

Create `backend/tests/unit/test_market_research_prompt_assembly.py`:

```python
"""Behavior-preservation test for K3: collapse of Research_Market_1..5 into a dispatch.

Each fixture is the formatted prompt string that the pre-refactor
Research_Market_<N> function would have passed to the LLM. After K3
replaces those 5 functions with _run_research_component(template, ...),
the helper must produce a byte-identical formatted prompt for each
component name. This test asserts that contract.
"""
import json
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures" / "market_research_prompts"


@pytest.fixture(scope="module")
def sample_profile_json() -> str:
    return json.dumps(json.loads((FIXTURES_DIR / "sample_profile.json").read_text()))


@pytest.mark.parametrize("component_n", [1, 2, 3, 4, 5])
def test_research_market_prompt_byte_equals_fixture(component_n: int, sample_profile_json: str):
    """K3: the dispatch's formatted prompt for component N must equal the captured fixture."""
    from app.services.market_research.orchestrator import _build_research_prompt
    expected = (FIXTURES_DIR / f"component_{component_n}.txt").read_text()
    actual = _build_research_prompt(component_n, sample_profile_json)
    assert actual == expected, (
        f"Component {component_n} prompt drift detected — fixture and dispatch output differ. "
        f"This indicates K3's refactor changed the LLM input."
    )
```

The test references `_build_research_prompt` which doesn't exist yet — this is intentional. The test will fail until Step 5 introduces the helper.

- [ ] **Step 5: Run the test to verify it fails for the right reason**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/unit/test_market_research_prompt_assembly.py -v 2>&1 | tail -10
```

Expected: 5 tests fail with `ImportError: cannot import name '_build_research_prompt'` (or `AttributeError` depending on Python's error path). This confirms the test is wired to the right contract — once we add `_build_research_prompt`, the test will start exercising the dispatch.

- [ ] **Step 6: Refactor `orchestrator.py` — add the dispatch and helper**

Edit `backend/app/services/market_research/orchestrator.py`:

1. **Replace the 5 import lines** for `RESEARCH_MARKET_<N>_TEMPLATE` with a single import:

```python
# Before (lines ~23–30 of the original)
from app.services.market_research.prompts import (
    RESEARCH_MARKET_1_TEMPLATE,
    RESEARCH_MARKET_2_TEMPLATE,
    RESEARCH_MARKET_3_TEMPLATE,
    RESEARCH_MARKET_4_TEMPLATE,
    RESEARCH_MARKET_5_TEMPLATE,
)

# After
from app.services.market_research.prompts import (
    RESEARCH_MARKET_1_TEMPLATE,
    RESEARCH_MARKET_2_TEMPLATE,
    RESEARCH_MARKET_3_TEMPLATE,
    RESEARCH_MARKET_4_TEMPLATE,
    RESEARCH_MARKET_5_TEMPLATE,
)

COMPONENT_TEMPLATES = {
    1: RESEARCH_MARKET_1_TEMPLATE,
    2: RESEARCH_MARKET_2_TEMPLATE,
    3: RESEARCH_MARKET_3_TEMPLATE,
    4: RESEARCH_MARKET_4_TEMPLATE,
    5: RESEARCH_MARKET_5_TEMPLATE,
}


def _build_research_prompt(component_n: int, company_profile_json: str) -> str:
    """Format the research-market template for ``component_n`` against the given profile JSON.

    Extracted as a testable seam so the K3 dispatch's output can be asserted
    byte-equal to a pre-refactor fixture. The dispatch (_run_research_component)
    calls through this helper.
    """
    return COMPONENT_TEMPLATES[component_n].format(company_profile_json=company_profile_json)
```

(Adjust the `.format(...)` keyword if Step 3 used a different variable name.)

2. **Replace the 5 `Research_Market_<N>` functions** with a single `_run_research_component` that takes the component number. The body comes verbatim from `Research_Market_1` (lines 43–69, verified byte-identical to the other 4 after template-name normalization), with the template-name reference replaced by the dispatch:

```python
# Delete the 5 functions Research_Market_1, Research_Market_2,
# Research_Market_3, Research_Market_4, Research_Market_5
# (lines 43-181 of the pre-refactor orchestrator.py)
# and replace with:

def _run_research_component(
    component_n: int,
    agent_chain,
    pre_data,
    llm_backend: str = "default",
) -> dict:
    """Run one of the 5 market-research components via prompted LLM agent.

    Replaces the pre-refactor Research_Market_1..5 functions, which were
    byte-identical except for the template constant. The template now comes
    from COMPONENT_TEMPLATES via _build_research_prompt.
    """
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except Exception:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)

    # Construct prompt via dispatch (replaces the inline `template = RESEARCH_MARKET_N_TEMPLATE`)
    prompt = _build_research_prompt(component_n, company_profile_json)

    # Step 3: Get LLM response
    response = _market_research_agent_output(agent_chain, prompt, company_profile_json, llm_backend)

    # Strip code fences, escape embedded newlines in description fields, parse JSON.
    parsed_json = _extract_research_json(response)

    # ✅ Return the Python dict
    return parsed_json
```

3. **Update every caller of `Research_Market_<N>`** to call `_run_research_component(N, ...)` instead. Find callers:

```bash
grep -rn "Research_Market_[1-5]" backend/app/
```

Expected callers: any code that orchestrates the 5 components (likely in `orchestrator.py` itself or in a higher-level caller). Update each call site:

```python
# Before
results_1 = Research_Market_1(agent_chain, pre_data, llm_backend=llm)
results_2 = Research_Market_2(agent_chain, pre_data, llm_backend=llm)
# ...etc

# After
results_1 = _run_research_component(1, agent_chain, pre_data, llm_backend=llm)
results_2 = _run_research_component(2, agent_chain, pre_data, llm_backend=llm)
# ...etc
```

- [ ] **Step 7: Run the K3 test to verify byte-equality**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/unit/test_market_research_prompt_assembly.py -v 2>&1 | tail -10
```

Expected: all 5 parametrized cases pass.

If any case fails with a diff, the dispatch's output does NOT match the captured fixture — the refactor changed the prompt that hits the LLM. Investigate the diff (likely culprit: wrong `.format()` keyword, or a function-body deviation between the 5 originals that wasn't caught by the AST hash check). Fix and re-run.

- [ ] **Step 8: Run module-scoped pytest**

```bash
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/ -k market_research 2>&1 | tail -5
```

Expected: all market_research tests pass (existing tests + the 5 new K3 tests).

- [ ] **Step 9: Run the full pytest suite**

```bash
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `253 passed, 19 snapshots passed` (248 baseline + 5 new K3 tests).

- [ ] **Step 10: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/market_research/orchestrator.py \
        backend/tests/fixtures/market_research_prompts/ \
        backend/tests/unit/test_market_research_prompt_assembly.py
git commit -m "refactor(be): collapse Research_Market_1..5 into _run_research_component [phase L]"
```

---

### Task K2: Dedup llm_config prompts via base + overlay (commit 7)

K2 deduplicates the two pairs of near-identical prompt constants in `backend/app/core/llm_config.py`:
- `Cypher_gen_prompt` (lines 22–109, 88 lines) and `Cypher_gen_prompt2` (lines 152–235, 84 lines)
- `qa_prompt_template` (lines 113–146, 34 lines) and `qa_prompt_template2` (lines 239–266, 28 lines)

The strategy: capture pre-refactor values as hardcoded baseline literals in a separate file, write a byte-equality pytest, then refactor `llm_config.py` to a base+overlay form. The test passes both pre and post refactor.

**Files:**
- Create: `backend/tests/_baselines/__init__.py`
- Create: `backend/tests/_baselines/llm_config_prompt_strings.py`
- Create: `backend/tests/unit/test_llm_config_prompts.py`
- Modify: `backend/app/core/llm_config.py`

- [ ] **Step 1: Create the baseline file with hardcoded copies of the 4 constants**

Create `backend/tests/_baselines/__init__.py` as an empty file (so the directory is a Python package):

```python
"""Baseline string snapshots — pre-refactor literal copies used as regression guards."""
```

Create `backend/tests/_baselines/llm_config_prompt_strings.py` by reading the current `backend/app/core/llm_config.py` and copying the 4 string constants VERBATIM. The constants must be **independent hardcoded string literal copies**, NOT imports from `app.core.llm_config` (per spec §6 K2 strategy — imports would make the byte-equality assertion tautological).

The file structure (the `<...verbatim...>` placeholders are filled by copying from `llm_config.py`):

```python
"""Baseline copies of llm_config prompt strings, snapshotted pre-K2-refactor.

These constants are independent hardcoded literal copies of the values
that lived in app/core/llm_config.py before Phase L K2 deduplicated them.
They are intentionally NOT imports from llm_config — the byte-equality
test in test_llm_config_prompts.py asserts that the post-refactor
llm_config.py still produces strings byte-equal to these baselines, so
the baselines must NOT change with the refactor.

If you find yourself needing to update these baselines, stop — that
means the K2 refactor changed the prompt that hits the LLM. Revert the
llm_config edit instead.
"""

CYPHER_GEN_PROMPT_BASELINE = """<...VERBATIM copy of Cypher_gen_prompt from llm_config.py lines 22-109, including the leading and trailing newlines inside the triple-quoted string...>"""

CYPHER_GEN_PROMPT2_BASELINE = """<...VERBATIM copy of Cypher_gen_prompt2 from llm_config.py lines 152-235...>"""

QA_PROMPT_TEMPLATE_BASELINE = """<...VERBATIM copy of qa_prompt_template from llm_config.py lines 113-146...>"""

QA_PROMPT_TEMPLATE2_BASELINE = """<...VERBATIM copy of qa_prompt_template2 from llm_config.py lines 239-266...>"""
```

To do this without manual error-prone copy/paste, use Python to dump the current values to a file:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
.venv/bin/python <<'PY'
from pathlib import Path
from app.core.llm_config import (
    Cypher_gen_prompt,
    Cypher_gen_prompt2,
    qa_prompt_template,
    qa_prompt_template2,
)

# Write the four constants as repr()-encoded literals into a Python module
out = Path("tests/_baselines/llm_config_prompt_strings.py")
out.write_text(
    '"""Baseline copies of llm_config prompt strings, snapshotted pre-K2-refactor.\n'
    '\n'
    'These constants are independent hardcoded literal copies of the values\n'
    'that lived in app/core/llm_config.py before Phase L K2 deduplicated them.\n'
    'They are intentionally NOT imports from llm_config — the byte-equality\n'
    'test in test_llm_config_prompts.py asserts that the post-refactor\n'
    'llm_config.py still produces strings byte-equal to these baselines, so\n'
    'the baselines must NOT change with the refactor.\n'
    '\n'
    'If you find yourself needing to update these baselines, stop — that\n'
    'means the K2 refactor changed the prompt that hits the LLM. Revert the\n'
    'llm_config edit instead.\n'
    '"""\n\n'
    f"CYPHER_GEN_PROMPT_BASELINE = {Cypher_gen_prompt!r}\n\n"
    f"CYPHER_GEN_PROMPT2_BASELINE = {Cypher_gen_prompt2!r}\n\n"
    f"QA_PROMPT_TEMPLATE_BASELINE = {qa_prompt_template!r}\n\n"
    f"QA_PROMPT_TEMPLATE2_BASELINE = {qa_prompt_template2!r}\n"
)
print(f"Wrote {out} with 4 baselines")
PY
```

Verify the file:
```bash
head -20 backend/tests/_baselines/llm_config_prompt_strings.py
wc -l backend/tests/_baselines/llm_config_prompt_strings.py
```

The file should contain 4 baseline assignments. `repr()` encoding ensures the strings are exact copies including all whitespace, escape characters, and trailing newlines.

- [ ] **Step 2: Write the byte-equality test**

Create `backend/tests/unit/test_llm_config_prompts.py`:

```python
"""Byte-equality regression test for K2 (llm_config prompt dedup).

After K2 refactors llm_config.py to a base+overlay structure, the four
public string constants (Cypher_gen_prompt, Cypher_gen_prompt2,
qa_prompt_template, qa_prompt_template2) must still be byte-identical
to the pre-refactor values. This test asserts that contract by comparing
against the hardcoded baselines in tests/_baselines/llm_config_prompt_strings.py.
"""
from app.core.llm_config import (
    Cypher_gen_prompt,
    Cypher_gen_prompt2,
    qa_prompt_template,
    qa_prompt_template2,
)
from tests._baselines.llm_config_prompt_strings import (
    CYPHER_GEN_PROMPT_BASELINE,
    CYPHER_GEN_PROMPT2_BASELINE,
    QA_PROMPT_TEMPLATE_BASELINE,
    QA_PROMPT_TEMPLATE2_BASELINE,
)


def test_cypher_gen_prompt_matches_baseline():
    assert Cypher_gen_prompt == CYPHER_GEN_PROMPT_BASELINE


def test_cypher_gen_prompt2_matches_baseline():
    assert Cypher_gen_prompt2 == CYPHER_GEN_PROMPT2_BASELINE


def test_qa_prompt_template_matches_baseline():
    assert qa_prompt_template == QA_PROMPT_TEMPLATE_BASELINE


def test_qa_prompt_template2_matches_baseline():
    assert qa_prompt_template2 == QA_PROMPT_TEMPLATE2_BASELINE
```

- [ ] **Step 3: Run the test pre-refactor to confirm it passes**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/unit/test_llm_config_prompts.py -v 2>&1 | tail -10
```

Expected: 4 tests pass. The baselines and the live values are currently the same string — they should match exactly.

If any test fails here, the baseline file's contents do NOT match the live `llm_config.py`. Re-run Step 1's dump script and inspect the diff.

- [ ] **Step 4: Refactor `llm_config.py` to base + overlay**

The two pairs differ in small bounded sections. Examining `Cypher_gen_prompt` (lines 22–109) vs `Cypher_gen_prompt2` (lines 152–235):
- The schema sections (NODE TYPES + RELATIONSHIPS) are identical
- The QUERY RULES sections are nearly identical
- The trailing section differs: `Cypher_gen_prompt` ends with extra paragraphs about original_json/modified_json and a more verbose closing; `Cypher_gen_prompt2` ends with a simpler `Schema: {schema}\nQuestion: {question}` block

Examining `qa_prompt_template` (lines 113–146) vs `qa_prompt_template2` (lines 239–266):
- The Scout-persona description is identical
- `qa_prompt_template` has 5 duplicate "Give me the response as valid JSON in a single line..." lines + a paragraph about the JSON response_message/response_json keys
- `qa_prompt_template2` does NOT have those lines

**Refactor approach: base prompt + overlay constants**

Pick the longer prompt as the "base + extra" form and the shorter as the "base only" form. Define a base + overlay structure:

```python
# Add to llm_config.py, replacing the four constant definitions

# --- Shared base content ---

_CYPHER_BASE_SCHEMA_AND_RULES = """<...the common content from both Cypher_gen_prompts, lines 23-101 inclusive, with the variable {question}/{schema} placeholder usage preserved...>"""

_QA_SCOUT_PERSONA_BASE = """<...the common content from both qa_prompt_templates, lines 114-131 inclusive...>"""

# --- Overlays that differentiate prompt 1 from prompt 2 ---

_CYPHER_GEN_PROMPT_EXTRA = """<...the extra content unique to Cypher_gen_prompt (the original_json/modified_json paragraphs and any other trailing content unique to prompt 1)...>"""

_QA_PROMPT_TEMPLATE_EXTRA = """<...the 5 duplicate "valid JSON" lines and the response_message/response_json paragraph unique to qa_prompt_template (prompt 1)...>"""

# --- Reconstructed public constants ---

Cypher_gen_prompt = _CYPHER_BASE_SCHEMA_AND_RULES + _CYPHER_GEN_PROMPT_EXTRA + """<...trailing schema/question section for prompt 1...>"""
Cypher_gen_prompt2 = _CYPHER_BASE_SCHEMA_AND_RULES + """<...simpler trailing schema/question section for prompt 2...>"""

qa_prompt_template = _QA_SCOUT_PERSONA_BASE + _QA_PROMPT_TEMPLATE_EXTRA + """<...trailing context/question section for qa prompt 1...>"""
qa_prompt_template2 = _QA_SCOUT_PERSONA_BASE + """<...trailing context/question section for qa prompt 2...>"""
```

**The exact split between base, overlay, and trailing is determined by careful diff of the 4 constants.** Use this command to see the diffs:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
.venv/bin/python <<'PY'
import difflib
from app.core.llm_config import (
    Cypher_gen_prompt,
    Cypher_gen_prompt2,
    qa_prompt_template,
    qa_prompt_template2,
)

print("=== Cypher_gen_prompt vs Cypher_gen_prompt2 ===")
for line in difflib.unified_diff(
    Cypher_gen_prompt.splitlines(keepends=True),
    Cypher_gen_prompt2.splitlines(keepends=True),
    lineterm="",
    n=2,
):
    print(line, end="")

print("\n=== qa_prompt_template vs qa_prompt_template2 ===")
for line in difflib.unified_diff(
    qa_prompt_template.splitlines(keepends=True),
    qa_prompt_template2.splitlines(keepends=True),
    lineterm="",
    n=2,
):
    print(line, end="")
PY
```

The diff output identifies the bounded sections that differ. Structure the base+overlay so that **the reconstructed strings concatenate to the exact original values** — every character, every newline.

After writing the refactored `llm_config.py`, the rest of the file (the `Cypher_Prompt` / `Cypher_Prompt2` / `qa_prompt` / `qa_prompt2` PromptTemplate constructions, the `LLMBundle` dataclass, the `build_llm_config()` function) stays unchanged.

- [ ] **Step 5: Run the K2 test to verify byte-equality post-refactor**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/unit/test_llm_config_prompts.py -v 2>&1 | tail -10
```

Expected: 4 tests pass. If any fail, the refactored constants don't equal the baseline — the base+overlay assembly produced a different string. Common causes:
- Missed a newline at the split boundary
- Wrong order of base vs. overlay vs. trailing
- Whitespace difference inside a section

Use the diff in the assertion error to identify exactly where the mismatch starts. Fix the split and re-run.

- [ ] **Step 6: Run module-scoped pytest**

```bash
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/ -k "llm_config or graph_chat" 2>&1 | tail -5
```

Expected: existing tests + the 4 new K2 tests all pass.

- [ ] **Step 7: Run the full pytest suite**

```bash
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `257 passed, 19 snapshots passed` (248 baseline + 5 K3 + 4 K2 = 257).

- [ ] **Step 8: Verify LOC reduction in `llm_config.py`**

```bash
wc -l backend/app/core/llm_config.py
```

Expected: ~240 lines (down from 343, a reduction of ~100 LOC matching the spec K2 estimate of -102).

- [ ] **Step 9: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/core/llm_config.py \
        backend/tests/_baselines/ \
        backend/tests/unit/test_llm_config_prompts.py
git commit -m "refactor(be): dedup llm_config prompt constants via base+overlay [phase L]"
```

---

### Task K4: Extract `fetch_company_profile` to `_neo4j_helpers.py` (commit 8)

K4 appends a `fetch_company_profile(driver, org_id: str | None) -> dict | None` helper to the existing `backend/app/services/_neo4j_helpers.py`, then replaces the 8 inline `MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1` sites across 5 files. The Stage 1 audit must have verified per-site equivalence (especially the `signals/ask.py` `p:`-alias variant).

**Files:**
- Modify: `backend/app/services/_neo4j_helpers.py`
- Modify: `backend/app/services/customer_profile/orchestrator.py` (3 sites at lines 31, 153, 319)
- Modify: `backend/app/services/market_scoring/persistence.py` (1 site at line 109)
- Modify: `backend/app/services/market_research/orchestrator.py` (1 site at line 232, with fallback at line 236)
- Modify: `backend/app/services/icp/orchestrator.py` (1 site at line 291, with fallback at line 297)
- Modify: `backend/app/services/signals/ask.py` (2 sites at lines 44, 133 — alias variant `p:`/`RETURN p`)

- [ ] **Step 1: Confirm Stage 1's per-site verification**

Open the Stage 1 scorecard at `docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md` and find the K4 cross-cutting finding. Confirm:
- Sites with non-trivial deviations (alias differences, additional filtering, unusual return-value handling) are flagged
- The `signals/ask.py` alias variant is verified equivalent OR flagged for inline retention
- The `market_research/orchestrator.py` and `icp/orchestrator.py` fallback-to-any-CompanyProfile cases are addressed (either via the helper's `org_id=None` branch or by staying inline)

If Stage 1's K4 entry says any site stays inline, exclude that site from K4's edits. The helper's site count is 8 minus any inline-retained sites.

- [ ] **Step 2: Append the helper to `_neo4j_helpers.py`**

Edit `backend/app/services/_neo4j_helpers.py` to append a new function after the existing `upsert_node`:

```python
def fetch_company_profile(driver, org_id: Optional[str] = None) -> Optional[dict]:
    """Fetch the first CompanyProfile node, optionally filtered by org_id.

    If org_id is provided: ``MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1``.
    If org_id is None: ``MATCH (c:CompanyProfile) RETURN c LIMIT 1`` (fetch any).

    Returns the c node's properties as a plain dict, or None if no match.
    """
    with driver.session() as session:
        if org_id is not None:
            result = session.run(
                "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                org_id=org_id,
            )
        else:
            result = session.run("MATCH (c:CompanyProfile) RETURN c LIMIT 1")
        record = result.single()
        if record is None:
            return None
        return dict(record.values()[0])
```

The `Optional` import is already at the top of the file (line 5: `from typing import Any, Optional`). The function uses `driver.session()` matching the existing `query()` function's pattern.

The return shape `dict(record.values()[0])` matches what the 6 `c:`-alias sites do. For the 2 `p:`-alias sites in `signals/ask.py`, the equivalent is `dict(record["p"].items())` — but `record.values()[0]` is the same dict regardless of the alias key, so the helper's output is byte-equivalent.

- [ ] **Step 3: Replace each simple-site call site (the 4 sites without fallback)**

The 4 simple sites are at:
- `customer_profile/orchestrator.py:31` (in `upsert_customer_profile`)
- `customer_profile/orchestrator.py:153` (in `get_customer_profile`)
- `customer_profile/orchestrator.py:319` (in `delete_icp_from_customer_profile`)
- `market_scoring/persistence.py:109` (in `_fetch_company_profile_dict` — a small private helper)

For each, replace the inline `with driver.session() as session: result = session.run(...)` block with a call to `fetch_company_profile(driver, org_id)`.

Add the import to each file:
```python
from app.services._neo4j_helpers import fetch_company_profile
```

(Each of these files already has imports from `app.services._neo4j_helpers` — append `fetch_company_profile` to the existing import.)

Example transformation for `customer_profile/orchestrator.py:31`:

```python
# Before
def upsert_customer_profile(driver, mongo, request: CustomerProfileRequest):
    with driver.session() as session:
        result = session.run(
            "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
            org_id=request.org_id
        )
        record = result.single()
        if record:
            company_profile_data = dict(record.values()[0])
            # ...subsequent logic...
        else:
            company_profile_data = None

# After
def upsert_customer_profile(driver, mongo, request: CustomerProfileRequest):
    company_profile_data = fetch_company_profile(driver, request.org_id)
    if company_profile_data is not None:
        # ...subsequent logic...
```

Each site's "subsequent logic" stays unchanged. Only the fetch is centralized.

- [ ] **Step 4: Handle the 2 sites with fallback (market_research, icp)**

`market_research/orchestrator.py:232–236` and `icp/orchestrator.py:291–297` use an `if org_id: <specific> else: <fallback>` pattern. With the helper, this becomes:

```python
# Before (illustrative — market_research/orchestrator.py:225-240 region)
def fetch_company_profile():
    with driver.session() as session:
        if request.org_id:
            result = session.run(
                "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                org_id=request.org_id,
            )
        else:
            result = session.run("MATCH (c:CompanyProfile) RETURN c LIMIT 1")
        return result.single()

record = await asyncio.to_thread(fetch_company_profile)
if not record:
    org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
    raise CompanyProfileNotFoundError(f"No company profile found in Neo4j{org_msg}")

# After
from app.services._neo4j_helpers import fetch_company_profile as _fetch_company_profile

# ...inside the function body...
profile_dict = await asyncio.to_thread(_fetch_company_profile, driver, request.org_id)
if profile_dict is None:
    org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
    raise CompanyProfileNotFoundError(f"No company profile found in Neo4j{org_msg}")
```

The inline `fetch_company_profile` function (the local definition that was being passed to `asyncio.to_thread`) gets deleted. The helper from `_neo4j_helpers` is imported and called directly. The import-as-alias `_fetch_company_profile` (with a leading underscore) is used to avoid shadowing the local-function name if any other code in the file references it — verify no other references exist with `grep -n fetch_company_profile <file>`.

If the local function name `fetch_company_profile` (no underscore) is unused elsewhere in the file, you can drop the alias and just import as `fetch_company_profile`.

Apply the same pattern to `icp/orchestrator.py:285-303`.

- [ ] **Step 5: Handle the 2 sites in `signals/ask.py` (alias variant)**

For the `p:` alias sites at lines 44 and 133:

```python
# Before (signals/ask.py:43-49)
result = session.run(
    "MATCH (p:CompanyProfile {org_id: $org_id}) RETURN p LIMIT 1",
    org_id=request.org_id
)
record = result.single()
if record:
    company_profile = dict(record["p"].items())

# After
company_profile = fetch_company_profile(driver, request.org_id) or {}
```

The replacement uses `... or {}` because the original code only sets `company_profile` if `record` is truthy — falsy case leaves it whatever it was before (likely `None` or `{}` depending on context). Inspect the surrounding code to confirm the original falsy behavior: if `company_profile` is declared as `{}` before the `with driver.session()` block, the `or {}` preserves that. If it's left undefined and used later guarded by `if company_profile:`, the same guard still works against `None`.

Add the import to `signals/ask.py`:
```python
from app.services._neo4j_helpers import fetch_company_profile
```

- [ ] **Step 6: Verify zero remaining inline CompanyProfile MATCH queries**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rnE 'MATCH \([cp]:CompanyProfile' backend/app/services/
```

Expected: only the helper definition's line in `_neo4j_helpers.py` (1 match), and 0 matches in any other file. If any inline queries remain in the 5 modified files, they were either intentionally left (per Stage 1's deviation flag — confirm in scorecard) or missed in this task.

- [ ] **Step 7: Run module-scoped pytest for each affected module**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/ -k "customer_profile or market_scoring or market_research or icp or signals" 2>&1 | tail -10
```

Expected: all tests pass. This is the cross-cutting verification — K4 touches 5 services so the test run must cover them all.

- [ ] **Step 8: Run the full pytest suite**

```bash
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: same as the previous task's count (257 if all prior tasks passed). K4 adds no tests — the existing stub-fixtured tests (per TD-004) cover structural preservation, and Stage 1's line-by-line verification is the primary behavior-preservation evidence.

- [ ] **Step 9: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/_neo4j_helpers.py \
        backend/app/services/customer_profile/orchestrator.py \
        backend/app/services/market_scoring/persistence.py \
        backend/app/services/market_research/orchestrator.py \
        backend/app/services/icp/orchestrator.py \
        backend/app/services/signals/ask.py
git commit -m "refactor(be): extract fetch_company_profile to _neo4j_helpers [phase L]"
```

---

### Task K7: TD-009 docstring/comment drift sweep (commit 9)

K7 closes TD-009 by removing stale `Phase X`, `commit N/M`, `extracted from … in Phase`, `final form`, and `Renamed … in Phase` references from docstrings AND inline `#` comments. Each of the 25 grep matches (verified by Stage 1) is evaluated individually — stale origin claims are removed, current-state structural references are kept or rephrased.

**Files (per Stage 1 K7 enumeration):**
- ~12 files across `services/` and package `__init__.py` files. Exact list comes from the Stage 1 grep output:

```
app/routers/leads.py:28
app/routers/signals.py:74
app/services/_llm_helpers.py:202
app/services/pipeline/__init__.py:5
app/services/market_scoring/__init__.py:1
app/services/market_research/__init__.py:1
app/services/market_research/persistence.py:14
app/services/market_research/prompts.py:8
app/services/data_sources/__init__.py:1 (and lines 3, 9)
app/services/icp/prompts.py:3
app/services/signals/ask.py:1
app/services/signals/parsing.py:7 (and lines 11, 16, 28)
app/services/signals/batch.py:1
app/services/signals/persistence.py:5
app/services/signals/search.py:1 (and line 158)
app/services/signals/prompts.py:3 (and line 17)
app/services/signals/__init__.py:1 (and line 23)
```

- [ ] **Step 1: Re-run the TD-009 grep to confirm current matches**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rnE 'Phase [A-Z]|commit [0-9]+/[0-9]+|extracted from .* in Phase|final form|Renamed.*in Phase' backend/app/
```

The match count should equal the spec's verified count of 25 (modulo any changes since spec writing). Save the output to `/tmp/td-009-matches.txt` for reference while editing.

- [ ] **Step 2: For each match, classify and edit**

Per spec §6 K7 strategy, each match is one of two types:

**Type A — stale origin claim** (remove or replace):
- "extracted from X in Phase Y"
- "Phase H commit 16/20"
- "Renamed from X in Phase Y"
- "(extracted to X during Phase H commit N/M)" (inline comment variant)
- "(Phase X final form)"

→ **Action**: remove the offending sentence or comment. If the entire docstring is just origin-claim, replace with a minimal structural-only docstring (or delete entirely and rely on the file's content speaking for itself).

**Type B — current-state structural reference** (keep or rephrase):
- "Phase H scope" used to mean "the scope of Phase H decomposition" rather than as a stale origin attribution
- A reference to Phase L itself (cross-reference in new content, if any)

→ **Action**: if the phase reference is structural and still accurate, keep it. If it's awkward, rephrase to remove the phase mention but preserve the structural information.

**Example edits:**

`app/services/signals/ask.py:1`:
```python
# Before
"""Signal Q&A — extracted from orchestrator.py in Phase I commit 7/11."""

# After
"""Signal Q&A — interactive query against signal/lead data."""
```

`app/services/signals/search.py:158`:
```python
# Before (inline comment)
#    (extracted to signals.parsing during Phase H commit 19/20)

# After (delete the line entirely; the import that follows is self-explanatory)
```

`app/services/market_scoring/__init__.py:1`:
```python
# Before
"""market_scoring service — public API (Phase H Sequence A final form)."""

# After
"""market_scoring service — public API."""
```

`app/services/data_sources/__init__.py` (3 lines: 1, 3, 9):
```python
# Before
"""data_sources service — public API (Phase H commit 7/20 final form).

Renamed from documents/ in Phase H to disambiguate from project documentation.
...
orchestrator.py was deleted in commit 7/20 — there is no multi-step
"""

# After
"""data_sources service — public API.

Service for ingesting and processing user-uploaded data files (PDFs, text).
...
There is no orchestrator submodule — all logic lives in persistence and pipeline.
"""
```

(The exact replacement text depends on what structural content the docstring should convey. Aim for: what the module exports, what its public API is, what it does. No version/commit/phase references in new text.)

**Edge cases:**

- `app/routers/leads.py:28`: "Returns up to 500 leads (silent cap). The cap is new — prior to Phase G ..." — this is a comment explaining a behavior, not a stale origin claim. Keep but rephrase to drop the "Phase G" reference: "...The 500 cap is a silent recent addition; older clients may not expect it."
- `app/routers/signals.py:74`: "deferred to Phase H alongside v1 route deletion" — stale, the deferred work is done. Remove.
- `app/services/_llm_helpers.py:202`: "historical quote-escaping was dropped during Phase I" — historical context. Either remove or rephrase: "Historical quote-escaping was dropped to unify all three..."
- `app/services/signals/parsing.py:7,11,16,28`: Multiple Phase references. Each individually evaluated. Lines 11/16 ("Unchanged from previous Phase H implementation") — remove ("unchanged from X" is meaningless context once the phase is forgotten). Line 7 ("Phase I. All 3 research services now use the simpler \n/\r-only escape") — keep the technical fact, drop the phase: "All 3 research services now use the simpler \n/\r-only escape."
- `app/services/signals/__init__.py:1` ("(Phase I final form)") and `:23` ("Phase I commit 8/11") — remove both phase mentions.

- [ ] **Step 3: Verify zero remaining TD-009 grep matches**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rnE 'Phase [A-Z]|commit [0-9]+/[0-9]+|extracted from .* in Phase|final form|Renamed.*in Phase' backend/app/
```

Expected: 0 matches. Per spec §10 criterion 5, this is the TD-009 closure check.

**Carve-out for legitimate prose false-positives:** Per spec §10 criterion 5's carve-out, if a remaining match is legitimate prose unrelated to phase origin (e.g., "the final form of the data structure" in a non-origin context), document it as an accepted exception in the impl review. Do NOT modify legitimate prose just to pass the grep — the grep is a closure check on stale references, not a mechanical text scrub.

If a match remains and is borderline, judgment call: prefer removing the phase reference (cheap) over keeping it (creates a future-drift risk).

- [ ] **Step 4: Run the full pytest suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: same count as before K7 (257 if K3 + K2 added 9 tests). K7 is prose-only — no code paths change.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/
git commit -m "docs(be): close TD-009 stale Phase/commit references [phase L]"
```

(The `docs(be):` prefix is intentional — K7 is documentation drift, not a refactor. Matches spec §9's commit sequence.)

---

### Audit-surfaced additions and promoted investigations (commits 10+)

After K1–K7 complete, additional commits process:
- **Audit-surfaced `execute` findings** from Stage 1 that aren't covered by K1–K7 (e.g., new unused-import discoveries beyond the spec's 16, new near-duplicate functions found by audit, new CRUD wrapper patterns).
- **Promoted-to-`execute` findings** from Stage 2's investigation outcomes.

Each additional finding becomes one commit, following the same template as the K-tasks above:

- [ ] **Per-finding template (apply once per additional `execute` finding)**

For each additional finding from the scorecard:

1. **Read the finding's behavior-preservation strategy** from the scorecard. The strategy is one of:
   - Byte-equality assertion (write a baseline + test)
   - Parametrized test against fixtures
   - pyflakes/grep evidence (mechanical)
   - Per-site line-by-line audit (no test, but Stage 1's verification is the evidence)

2. **Write the test or assertion FIRST**, following the appropriate K-task as a template:
   - For byte-equality: use K2's baseline-file + byte-equality-test pattern
   - For parametrized prompt/fixture: use K3's fixture-capture + parametrized-test pattern
   - For helper extraction with trivial preservation: use K5/K6's mechanical-grep-verification pattern
   - For cross-file helper extraction: use K4's per-site-inspection pattern
   - For prose-only edits: use K7's per-match-classification pattern

3. **Verify the test fails** (for new tests) or **fails appropriately** (for pyflakes/grep checks).

4. **Apply the refactor** as described in the scorecard finding.

5. **Run module-scoped pytest** for the affected module.

6. **Run the full pytest suite** — must be `>= (current count) passed, 19 snapshots passed`.

7. **Commit** with message `<type>(be): <description> [phase L]` (no `[N/M]` numbering).

Each additional commit follows the same greenness invariant and abort criterion as K1–K7.

**Sequencing tip:** order audit-surfaced findings low-risk first (mechanical changes before semantic ones, single-file before cross-cutting).

**Skip rule:** if an audit-surfaced finding requires more than ~30 minutes of additional reasoning to verify behavior preservation, defer it to `design-discussion` (update the scorecard with the deferral rationale) and move on. The phase's value is in the systematic audit + the executable wins, not in pushing every finding to completion at any cost.

---

## Final verification (no commit until impl review)

### Task F1: Run spec §10 success criteria

- [ ] **Step 1: Criterion 1 — Scorecard committed**

```bash
ls docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md
git log --oneline --follow docs/audits/2026-05-25-backend-loc-docstring-audit-phase-l.md
```

Expected: file exists; git log shows at least 2 commits (Stage 1 + Stage 2).

- [ ] **Step 2: Criterion 2 — Investigation outcomes committed**

Open the scorecard. Confirm:
- Summary table shows non-zero `Investigated → promoted to execute` and `Investigated → deferred` counts (assuming Stage 1 surfaced any `investigate` findings — if none, the Stage 2 commit is still required as a "no investigate findings" record).
- Every `investigate` finding from Stage 1's commit has a resolution (promoted or deferred with rationale).

- [ ] **Step 3: Criterion 3 — All `execute` findings executed**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline master..HEAD | grep -E 'refactor\(be\)|docs\(be\):' | wc -l
```

Expected: ≥ 7 (K1, K5, K6, K3, K2, K4, K7) plus any audit-surfaced commits. If any K1–K7 task is missing from the log, return to that task or document its deferral in the scorecard.

- [ ] **Step 4: Criterion 4 — Known wins K1–K7 accounted for**

For each of K1–K7, confirm in the scorecard one of:
- (a) executed with a passing verification — commit exists, test/grep evidence in the diff
- (b) attempted-and-deferred with a documented failure rationale
- (c) deferred up-front with a rationale (audit revealed a subtle behavior risk)

No silent skips.

- [ ] **Step 5: Criterion 5 — TD-009 closure check**

```bash
grep -rnE 'Phase [A-Z]|commit [0-9]+/[0-9]+|extracted from .* in Phase|final form|Renamed.*in Phase' backend/app/
```

Expected: 0 matches, OR any remaining matches are documented as accepted exceptions per the criterion's carve-out (legitimate prose false-positives).

- [ ] **Step 6: Criterion 6 — Full pytest suite passes**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `<final count> passed, 19 snapshots passed`. Final count = 248 + (tests added by K2: 4, K3: 5, and any audit-surfaced additions).

- [ ] **Step 7: Criterion 7 — No new pyflakes warnings**

```bash
.venv/bin/python -m pyflakes app/ 2>&1
```

Expected: same as the baseline recorded in Task 0b Step 3. No new "X imported but unused" lines beyond what existed pre-phase.

- [ ] **Step 8: Confirm the LOC reduction matches estimate**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
find backend/app -name '*.py' -exec cat {} + | wc -l
```

Expected: ~9,950 to ~10,033 (10,403 baseline − 370 to 460 estimated savings from K1–K7, modulo any audit-surfaced additions). If the count is far higher than expected, some intended reductions didn't land.

Record the actual final LOC in the impl review.

### Task F2: Write impl review and synthesis

Following the Phase J/K pattern (exemplar: `docs/reviews/refactor-backend-flat-service-decomposition-phase-k-impl-review-1.md` and `…-synthesis-1.md`, commit `6de4afd`).

**Files:**
- Create: `docs/reviews/refactor-backend-loc-docstring-audit-phase-l-impl-review-1.md`
- Create: `docs/reviews/refactor-backend-loc-docstring-audit-phase-l-impl-synthesis-1.md`

- [ ] **Step 1: Run the impl review**

Use the `request-design-review` (or equivalent project-review) skill to produce the round-1 impl review. The review should cover:
- Did every K1–K7 task execute as specified?
- Are the behavior-preservation tests sound (no tautological assertions)?
- Are there code-quality issues introduced by the refactor (worse naming, wrong abstraction level)?
- Does the LOC reduction match the estimate? If not, why?
- Are any commits problematic (oversize diffs, missing test evidence)?

Verdict: `clean` if no actionable findings; `findings` if any.

- [ ] **Step 2: If verdict is `findings`, synthesize and fix**

For each finding, decide agree/disagree/defer per the receiving-design-review skill. Apply agreed fixes as additional commits. Re-run the impl review until verdict is `clean`.

- [ ] **Step 3: Commit the final review + synthesis**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/reviews/refactor-backend-loc-docstring-audit-phase-l-impl-review-1.md \
        docs/reviews/refactor-backend-loc-docstring-audit-phase-l-impl-synthesis-1.md
# (and any subsequent rounds: -review-2, -synthesis-2, etc.)
git commit -m "docs(reviews): add Phase L impl review + synthesis (round 1, clean) [phase L]"
```

### Task F3: Merge to master, push, mark TDs resolved

- [ ] **Step 1: Verify the branch is clean and ready**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status                                    # expected: clean
git log --oneline master..HEAD                # expected: 9+ commits (audit + investigation + K1-K7 + extras + impl review)
git rev-parse --abbrev-ref HEAD               # expected: refactor-backend-loc-docstring-audit-phase-l
```

- [ ] **Step 2: Fast-forward merge into master**

Matches the Phase K cutover pattern (commit `6de4afd`):

```bash
git checkout master
git merge --ff-only refactor-backend-loc-docstring-audit-phase-l
git log --oneline -5                          # confirm the merge brought all Phase L commits forward
```

If `--ff-only` fails (master has commits the branch doesn't), surface to operator — Phase L's branch base has drifted from current master and either (a) the branch needs a rebase or (b) something landed on master mid-phase that needs investigation. Do NOT force-push or hard-reset without explicit instruction.

- [ ] **Step 3: Push to origin**

```bash
git push origin master
git status -sb                                # expected: up to date with origin/master
```

- [ ] **Step 4: Delete the local Phase L branch**

```bash
git branch -d refactor-backend-loc-docstring-audit-phase-l
git branch                                    # expected: no Phase L branch
```

- [ ] **Step 5: Mark TD-008 and TD-009 as resolved in TECH_DEBT.md**

Edit `docs/TECH_DEBT.md`:
- Locate the TD-008 entry. Update status from "Open" (or whatever the current state) to "Resolved by Phase L (commit `<sha>`)".
- Locate the TD-009 entry. Update same way.

Match the convention used for TD-001/002/003/006/007 — find a previously-resolved entry and mirror its format.

- [ ] **Step 6: Commit the TECH_DEBT.md update**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/TECH_DEBT.md
git commit -m "docs(td): mark TD-008 and TD-009 resolved by Phase L"
git push origin master
```

Phase L is complete.

---

## Plan summary

| Stage | Tasks | Commits |
|---|---|---|
| Pre-flight | 0a, 0b, 0c | 0 |
| Stage 1 (Audit) | 1 | 1 |
| Stage 2 (Investigation) | 2 | 1 |
| Stage 3 (Execution) | K1, K5, K6, K3, K2, K4, K7 + audit-surfaced | 7 + N |
| Final | F1, F2, F3 | 1 (review) + 1 (TD-update) |

Total commits: 10 + N (where N is the count of audit-surfaced and investigation-promoted additions).
