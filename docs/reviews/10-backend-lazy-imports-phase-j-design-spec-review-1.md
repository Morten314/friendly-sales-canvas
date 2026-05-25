---
artifact: specs/10-backend-lazy-imports-phase-j-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 1
---

## Findings

### [Medium] Missing `__init__.py` docstring update for commit 4 — lazy-import reference becomes stale

**Location:** §4, commit 4; `app/services/market_scoring/__init__.py:21-23`

Commit 4 hoists the lazy `from app.services.market_scoring import orchestrator` import out of `_run_market_scoring_for_org` and updates `scoring.py`'s own module docstring (lines 7-11). But `market_scoring/__init__.py` lines 21-23 describe the current architecture:

> scoring.py accesses them via a lazy `from app.services.market_scoring import orchestrator` import; tests import them from the submodule directly.

After commit 4, this statement is false. Commit 5 mentions updating `__init__.py:14` (the submodule listing line), but nothing touches lines 21-23. The stale architectural description will mislead future readers into believing a lazy-import pattern still exists when it doesn't.

**Suggestion:** Add lines 21-23 to commit 4's scope (alongside the `scoring.py` docstring update), or fold it into commit 5's `__init__.py` edits. Either way, the lazy-import description should be rewritten to reflect the new module-level import.

### [Low] Line number inaccuracies in §3.3 cycle anatomy

**Location:** §3.3, paragraph 4

The spec states:

1. "`scoring.py` module body contains `from app.services.market_scoring import persistence` **at line 19**" — actual location is line 20 (line 19 is `from app.services.leads import get_leads_for_org`).
2. "`_lead_to_score_row` is defined at **line 30** of `scoring.py`" — actual location is line 27.

The cycle analysis itself is correct regardless of line numbers, but an implementor cross-referencing the spec against the file would find the citations wrong. If the spec was written against a slightly different tree state, that should be noted; if these are transcription errors, they should be corrected.

### [Low] Multi-line import edge case not discussed for `# defensive:` annotation

**Location:** §3.4, implementation sketch; §3.5, defensive-annotation policy

The AST linter checks `src_lines[child.lineno - 1]` for `# defensive:` — this is the **first line** of the import statement (`lineno` always points to the `from` keyword). If a future defensive import spans multiple lines:

```python
from app.services.foo import (
    bar,
    baz,
)  # defensive: reason here
```

The comment on the closing paren line would not be detected by the linter (it checks the `from` line), and the test would flag a false positive. The spec does not discuss this. Since the implementation sketch is non-normative, this is informational, but §3.5's policy description should clarify that the annotation must appear on the `from` line specifically.

**Suggestion:** Add a note to §3.5: "The `# defensive:` comment must appear on the same line as the `from` keyword (the first physical line of the import statement), not on a closing paren line."

### [Nit] Thoroughness proportional to change size

**Location:** entire spec (241 lines)

241 lines of spec for what amounts to: hoist 7 imports, relocate 1 small function, add 1 small test. This is consistent with the project's spec-driven convention (§CLAUDE.md "Spec-driven flow") and produces excellent traceability. No change suggested — just flagged for awareness that the documentation-to-delta ratio is high.
