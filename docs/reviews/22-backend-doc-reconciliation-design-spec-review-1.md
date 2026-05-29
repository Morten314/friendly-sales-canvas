---
artifact: specs/22-backend-doc-reconciliation-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Context

Review conducted against the live monorepo. The backend refactor is confirmed complete (`backend/app/` exists with full layered structure; old `api.py`/`services.py` are zero-byte shells). All docs referenced in the spec exist. No token or time pressure.

## Findings

### [High] §5.2 Gotchas treatment is incomplete — 3 gotchas have no explicit guidance

**Location:** §5.2 "Gotchas"

The current `AGENTS.md:135–146` lists 10 gotchas. §5.2 gives explicit treatment to 7 (pagination, prompts-inline, CORS, Cypher injection, embeddings provider, Neo4j schema location, OpenAPI client). Three backend-relevant gotchas are silently omitted:

1. **"Smoke-test scripts hit production"** (`AGENTS.md:137`) — still true, but references `backend/test_*.py` which has moved to `backend/tests/test_*.py`. Needs re-anchoring.
2. **"config.py has hardcoded credential fallbacks"** (`AGENTS.md:138`) — the path is now `app/core/config.py`, not `backend/config.py`. The gotcha itself remains valid. Needs re-anchoring.
3. **"Multiple admin tools"** (`AGENTS.md:143`) — `admin_panel.html`, `registration_admin_panel.html`, `cleanup_company_profile.py` all still exist at `backend/` root. The gotcha is still valid but the line-reference format (if any) may be stale.

The spec's "re-validate each gotcha" instruction is a broad catch-all, but the implementer needs to know these three require re-anchoring (new module paths) rather than just verification. Explicitly listing them alongside the others would prevent an incomplete pass.

### [High] §4 Domain enumeration omits `health`

**Location:** §4 required section 4, "Domains"

The spec enumerates: `icp`, `signals`, `leads`, `market_research`, `market_scoring`, `customer_profile`, `data_sources`, `org_auth`, `graph_chat`, `pipeline`, `profiles`.

`backend/app/services/health.py` exists as a service module (confirmed in the codebase). While there may not be a corresponding `health` router (health checks are typically wired into the app lifespan), it is a service domain that the canonical architecture doc should document — even if only to say "liveness/readiness check via lifespan, not a router."

### [Medium] §4 "Concise (~1–2 pages)" vs 10 required sections — tension unresolved

**Location:** §4 opening paragraph vs required sections list

The spec calls for a "concise (~1–2 pages)" document but mandates 10 required sections. Several of these (Entrypoint & boot, Request lifecycle, v1 vs v2 routers, Current posture, Keeping this current) could each be 3–5 lines, but 10 sections with headings, prose, and module references will realistically land closer to 3 pages. The spec should either relax the page target to "~2–3 pages" or merge related sections (e.g., "Entrypoint & boot" + "Request lifecycle" → one section; "Current posture" + "Keeping this current" → one section).

### [Medium] §7.2 API docs reconciliation scope is broad without derivation guidance

**Location:** §7.2

`API_ENDPOINTS_SUMMARY.md` alone is 334 lines. The task is "add new endpoints, correct paths/shapes, remove endpoints that no longer exist" — a full rewrite of the endpoint inventory. The risk section (§10) flags this but the mitigation is vague ("derive from `app/routers/` directly or a running `/openapi.json`").

**Suggestion:** Add to the plan-readiness notes that the implementer should generate the endpoint list programmatically (e.g., `grep -r "router = APIRouter" backend/app/routers/` or a running `/openapi.json` dump) rather than manually reconciling. This would also make a good acceptance criterion: "endpoint list matches `openapi.json` paths."

### [Medium] §6 `<authored-date>` from "first/most-relevant authoring commit" is ambiguous

**Location:** §6, bullet "authored-date"

For the 9 frozen analysis files, "first/most-relevant" is subjective. Some files may have been created in one commit and substantially revised in another. The implementer needs a clear rule. Suggest: "use the earliest commit that created the file (`git log --diff-filter=A --format=%cs -- <file>`)." This is unambiguous and machine-derivable.

### [Medium] §4 Testing layout claim "unit + integration + golden-prompt" may not match actual structure

**Location:** §4, required section 8; also §1 "New shape" bullet on `tests/`

The actual `backend/tests/` contains a flat layout: `test_*.py` files, `conftest.py`, `helpers.py`, `fixtures/`, `__snapshots__/`, `_baselines/`, `identities.py`, `capture_fixtures.py`, `regen_prompt_fixtures.py`. There is no `unit/` / `integration/` / `golden-prompt/` subdirectory split. The spec's description in §1 ("unit + integration + golden-prompt suite") is an organizational claim that may not match the directory structure. The BACKEND.md author should describe what actually exists, not an aspirational split.

### [Medium] §3.3 `prompt-migration-outcome.md` has dual classification that could confuse

**Location:** §3.3

It is listed under "Verify-only" (fix confirmed drift only) but the spec also says it "is a frozen audit trail by design — it may reference the old shape and must **not** be 'corrected.'" This means: verify it exists and is structurally intact, but don't change its content even if it references `api.py`. The tier name "verify-only" and the body's "don't correct old references" instruction are in tension. Consider renaming the treatment to "Audit-only (verify existence; no content changes)" or adding a clarifying sentence: "This file is explicitly exempt from the old-shape grep in §8.2."

### [Low] §1 "Old shape" main.py was 6 lines, not 16

**Location:** §1, "a 16-line `main.py` with an import-order contract"

The current `backend/main.py` shim is 6 lines. The AGENTS.md description said 16 lines for the pre-refactor `main.py`. If the spec is describing the pre-refactor state for contrast, "16-line" may be correct historically — but the implementer should verify this against `git log` rather than trust the agent file, since the agent file is one of the docs being corrected.

### [Low] §4 Section 10 "Keeping this current" is meta-content that may not age well

**Location:** §4 required section 10

A "how to maintain this doc" section inside the doc itself is a reasonable convention, but it's fragile: the next refactor may not follow the advice. Consider whether this is better as a comment in the doc's frontmatter or a note in the agent files instead. This is a stylistic choice, not a defect.

### [Low] §5 Does not address the maintenance cost of the CLAUDE.md / AGENTS.md duplication

**Location:** §5 opening paragraph

The spec acknowledges the near-duplication and mandates mirrored edits. This is correct for the current scope. However, the spec does not flag this duplication as a known maintenance burden (even in risks/open questions). A brief note — "this spec perpetuates the dual-maintenance pattern; reducing to a single source with tool-specific wrappers is a future cleanup" — would be honest and useful for a future agent.

### [Low] §7.3 Backend README "replace" expands scope beyond reconciliation

**Location:** §7.3

"Replace with a short, real backend README" is new-content authoring, not reconciliation of existing content. The current README is described as "a Render-template stub" — so the spec is effectively asking for a new doc. This is a reasonable inclusion but differs in kind from the other tasks (which are edits/reconciliations of existing docs). Flag it in the plan as an authoring task so it gets appropriate review attention.

### [Nit] §7.1 Deployment doc filename has spaces

**Location:** §7.1, `docs/Deployment Infrastructure and Notes.md`

Not a spec defect, but the implementer should note the spaces in the filename for shell quoting and grep patterns.

### [Nit] Internal cross-reference style is inconsistent

**Location:** Throughout

The spec uses both `§5.2` and `Section 4` styles, and sometimes references by heading name without a section number. A consistent style (e.g., always `§N`) would improve readability for the implementer.

### [Nit] §10 "Banner link depth" risk is trivially solvable

**Location:** §10, "Banner link depth"

There are exactly 9 files needing banners, all at one of two directory depths. Computing the correct relative link is mechanical (two link variants). This is listed as a "risk" but is better described as a plan step.
