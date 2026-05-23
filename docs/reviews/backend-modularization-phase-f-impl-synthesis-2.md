---
synthesizes_review: docs/reviews/backend-modularization-phase-f-impl-review-2.md
artifact: refactor-backend-modularization-phase-f
artifact_type: impl
reactor_model: claude-opus-4-7
date: 2026-05-23
round: 2
---

## Round Recommendation

no

Reason: All findings Medium/Low/Nit; one mechanical doc-hygiene pass plus one import hoist closes everything actionable. No new design surface.

## Agreed Findings

- **[Medium] Stale Phase/Task/commit references** — Do a single cleanup pass enumerating call sites via `git grep -nE 'Phase [A-G]|commit [0-9]+/[0-9]+|Task [0-9]+(-[0-9]+)?' backend/app/ backend/tests/`, deleting historical narrative and rewriting present-tense where context matters. Genuine TODOs (`graph_chat.py:194,205` pointing at deferred Phase G work) move to `# TODO(td-XXX):` form or migrate into `docs/TECH_DEBT.md`. Findings 2, 3, and 5 are sub-cases of this pass — fold them in.
- **[Low] `app/main.py` module docstring describes intermediate state** — Rewrite docstring at lines 1-14 to describe the final ownership (FastAPI instance, CORS, lifespan, router registrations, exception handlers). Fold into the Medium cleanup pass.
- **[Low] `tests/unit/conftest.py` module docstring describes pre-Phase-F mocking** — Rewrite docstring at lines 1-15 to: "Unit tests call service functions directly with positional client/LLM mocks (no FastAPI, no dependency injection)." Fold into the Medium cleanup pass.
- **[Low] Lazy import of `_ensure_market_scoring_indexes` in `lifespan`** — Hoist `from app.services.market_scoring import _ensure_market_scoring_indexes` from `app/main.py:54` to the module-level imports. Verified no circular dependency exists.
- **[Nit] CORS comment claims Phase B tightens it** — Replace the `app/main.py:63-64` comment with a present-tense note that CORS hardening is tracked under spec §2.2 / Phase G. Fold into the Medium cleanup pass.

## Disagreed Findings

N/A

## Deferred Findings

- **[Nit] Prompt templates as module-level state in `llm_config.py:239-274`** — Defer. Already tracked in spec §2.2 backlog ("Inline prompts → `app/prompts/`"). Trigger to revisit: when prompt versioning, A/B testing, or non-Python access (e.g., from a frontend prompt editor) becomes a requirement. Until then, the templates are cheap string constants and the misleading "no module-level state" reading is a documentation problem, not a structural one.

## Severity Disagreements

N/A

## Open Questions

- Should the Medium cleanup pass be one commit (`chore(be): scrub stale phase/task references`) or split per file/area for easier review? Volume is ~15 unique files; a single commit keeps the change unified but is large to diff. Operator preference.
