---
synthesizes_review: docs/reviews/backend-modularization-phase-f-impl-review-1.md
artifact: refactor-backend-modularization-phase-f
artifact_type: impl
reactor_model: claude-opus-4-7
date: 2026-05-23
round: 1
---

## Round Recommendation

no

Reason: All 5 findings agreed; remaining work is mechanical cleanup (delete dead code, fix one docstring) with no new design surface to re-review.

## Agreed Findings

- **[Medium] `vision` at module scope** — Delete `backend/app/core/llm_config.py:349-351`. Verified: `grep -rn "vision\|llm_config\.vision" backend/app/ backend/tests/` returns zero non-self hits, and spec §2.1 item 1 explicitly objects to paying the `llama-3.2-90b-vision-preview` startup cost for an unused field. The "kept at module scope so future references work" comment contradicts the spec's reasoning — if a consumer surfaces, add it to `LLMBundle` then.
- **[Medium] Redundant `_via_override` fixture set** — Delete `backend/tests/conftest.py:181-290` (the section-comment block at 181-192 plus the 7 `_via_override` fixtures at 194-290). Verified: `grep -rn "_via_override" backend/tests/ | grep -v conftest.py` returns no results, so the deletion is safe. The session-end leak detector at lines 293-305 is independent and stays.
- **[Low] Stale docstring in `llm_config.py:1-8`** — Rewrite to describe the final state (factory + dataclass; construction owned by `lifespan`; no module-level state). Will land in the same commit as the `vision` deletion so the rewritten docstring matches the actual final shape of the file.
- **[Low] `_ensure_market_scoring_indexes` guard triggers acceptance grep** — Agree the guard is correct (it handles `BREWRA_SKIP_DB_INIT=1` where `clients.client` is `None`). No code change. The acceptance criterion in spec §7.1 is a historical artifact and over-broad; the runtime guard is legitimately distinct from a §3.7 fallback pattern. Will not amend the spec — it's a frozen design doc — but noting this here closes the loop.
- **[Nit] Inconsistent cleanup patterns** — Auto-resolves when the `_via_override` fixtures are deleted per Finding 2. Only `_install_override` (returns cleanup callable) remains in the primary fixtures. No separate action.

## Disagreed Findings

N/A

## Deferred Findings

N/A

## Severity Disagreements

N/A

## Open Questions

- `backend/app/services/market_scoring.py:38-41` has a parallel stale-docstring issue to Finding 3 — it says `_ensure_market_scoring_indexes` is "Called from both `app.main.lifespan` and the legacy `@app.on_event("startup")` hook (the latter delegates to this function; commit 17 deletes the legacy hook)." The legacy hook has been deleted (verified: `grep -n "on_event" backend/app/main.py` returns nothing). The reviewer didn't flag this, but it's the same class of debris. Worth fixing in the same docstring-cleanup commit, or leave for next pass?
