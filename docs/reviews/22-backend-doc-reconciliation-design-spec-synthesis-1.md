---
synthesizes_review: docs/reviews/22-backend-doc-reconciliation-design-spec-review-1.md
artifact: specs/22-backend-doc-reconciliation-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 1
---

## Round Recommendation

no

Reason: All High/Medium findings agreed and applied this round; remaining items are Low/Nit or a premise verified false against the code — no design surface reopened.

## Agreed Findings

- **[High] §5.2 — three omitted gotchas.** Verified against code: root `backend/test_*.py` probes still exist (4 files), `config.py` is now `app/core/config.py`, and the three admin tools remain at `backend/` root. Added explicit re-anchor bullets to §5.2 for: smoke-test probes (and the distinction from the new `tests/` suite), `config.py` → `app/core/config.py`, and the `backend/`-root admin tools.
- **[High] §4 — omits `health`.** Verified: `app/services/health.py` exists with no dedicated router. Added `health` to the §4 domain enumeration with a "note its wiring / verify against `app/services/`" instruction.
- **[Medium] §4 — concise vs 10 sections tension.** Relaxed the target to "~2–3 pages" and reframed the section list as a content checklist (sections mergeable, e.g. entrypoint+lifecycle, posture+maintenance), not a mandated heading count.
- **[Medium] §7.2 — derivation guidance.** Verified feasible (58 `@router.*` decorators across v1+v2). Added a "derive programmatically, don't hand-reconcile" instruction (decorator grep as primary; `/openapi.json` as optional cross-check) and a matching acceptance criterion in §8 item 5.
- **[Medium] §6 — `<authored-date>` ambiguity.** Replaced with the unambiguous creation-date rule `git log --diff-filter=A --format=%cs -- <file>`.
- **[Medium] §3.3 — dual classification.** Split the tier into "verify-and-fix-drift" (`TECH_DEBT.md`, `PROMPTS.md`) and "audit-only / no content changes" (`prompt-migration-outcome.md`), with the latter explicitly exempt from the §8 grep.
- **[Low] §1 — `main.py` "16-line".** Dropped the unverifiable line count; now "a thin `main.py` with a strict import-order contract."
- **[Low] §5 — duplication maintenance cost.** Added a §10 open-question noting the spec perpetuates `CLAUDE.md`/`AGENTS.md` dual maintenance and that single-source-with-wrappers is a future cleanup.
- **[Low] §7.3 — README is authoring, not reconciliation.** §9 step 6 now flags the README as new-content authoring needing review attention.
- **[Nit] §7.1 — spaced filename.** Added a §10 note to quote `docs/Deployment Infrastructure and Notes.md` in shell/grep.
- **[Nit] §10 — banner link depth framed as a risk.** Moved to §9 step 3 as a mechanical plan step (two depth variants).
- **[Nit] cross-reference style.** Standardized on `§N` in the edited passages.

## Disagreed Findings

- **[Medium] §4 — "testing layout claim may not match actual structure."** Verified false against the live tree: `backend/tests/unit/` exists (18 files, including `test_prompts_golden.py` and `test_prompts_loader.py`), the top-level `tests/` holds API/integration tests (`*_v2`, `test_lifespan`, `test_smoke`), and `__snapshots__`/`_baselines` are present. The spec's "unit + integration + golden-prompt" description is accurate; the reviewer appears to have observed a flat layout (possibly the legacy standalone `/projects/Brewra/backend/`). Premise not adopted. I did, however, make a precision edit to §1 and §4 item 8 to state the exact layout and to warn against asserting a clean three-way *directory* split (golden-prompt tests live inside `tests/unit/`, not their own dir).
- **[Low] §4 section 10 — "Keeping this current" meta-content.** Keeping it. The reviewer concedes this is "stylistic, not a defect." A one-line maintenance note encodes the reference-modules-not-line-numbers principle in the doc most at risk of rot — that is load-bearing for this spec's anti-staleness goal and cheaper to honor in-place than to relocate to frontmatter or the agent files.

## Deferred Findings

None.

## Severity Disagreements

- **§5.2 (three gotchas): Medium, not High.** Agree with the finding; the spec already mandates "re-validate each gotcha," so total omission was mitigated — the value is precision (these need re-anchoring, not just verification).
- **§4 (`health`): Low, not High.** Agree with the finding; it is a single missing list item in a doc authored from the code (the author will see `health.py`), trivially fixed, with no cascade and no block on the spec.

## Open Questions

- **`health` wiring.** The BACKEND.md author should confirm how liveness/readiness is actually exposed — `app/services/health.py` exists but there is no `health` router file (an incidental grep match landed in `pipeline.py`). Not a blocker; flagged for authoring.
- **Stale `documents` router artifact.** `__pycache__` shows `documents.cpython-*.pyc` under both `routers/` and `routers/v2/` with no current `documents.py` source — a removed/renamed router. The §7.2 endpoint reconciliation should enumerate live decorators only and ignore the stale `.pyc`, so it isn't mistaken for a live endpoint.
