# Project Review Rubric

Checklist extensions for the adversarial-review commands (`/review-spec`,
`/review-plan`, `/review-impl`). Each command appends the items under
`## all` and under its own `## spec` / `## plan` / `## impl` section to its
built-in Identify checklist. Items here are additive — they never replace or
relax the built-in checks — and findings from them use the standard severity
scale (Critical / High / Medium / Low / Nit).

## all

- **Python patch-target semantics ("patch where used, not where defined").**
  For every `mocker.patch("m.sym")` / `monkeypatch.setattr("m.sym", …)` in the
  artifact — specs and plans in this repo embed worked test code — verify `m`
  is the namespace where `sym` is resolved **at call time**, not merely where
  it is defined or re-exported:
  - `from X import Y` gives the caller its own binding: patch the **caller's**
    module, not `X`. (Established Phase E: `customer_profile` imports
    `_reserve_unique_icp_id` from `icp` at 4 sites; tests patch
    `app.services.customer_profile._reserve_unique_icp_id`.)
  - Dispatch dicts (`COMPONENT_FUNCTIONS`, `ICP_FUNCTIONS`) capture function
    references at import time: patch the **dict entry**
    (`mocker.patch.dict`), not the module attribute — rebinding the name
    leaves the dict slot pointing at the original. (Phase E, plan-5 review.)
  - `app/main.py` holds `from`-imports of lifespan helpers: lifespan tests
    patch `app.main.<helper>`, **not** `app.services.<svc>.<helper>`. Do not
    "fix" the target back to the natural-looking service path — the
    natural-looking version silently verifies nothing. (Phase G spec round 4;
    plan-7 §5.5.)
  - A structural move or package re-export must rewrite affected patch strings
    **in the same commit**: a patch landing on a re-exported `__init__`
    attribute installs cleanly but intercepts nothing, so tests hit real
    dependencies (e.g. live Mongo in CI). (Phase H execution halt at Task 1,
    spec §3.8 *patch-where-it's-used*; re-caught at Phase K spec review
    round 1.)

  Flag any patch target you cannot verify by grepping the named module for a
  **use** of the symbol; a target that merely *defines* or *re-exports* the
  symbol is the bug.
