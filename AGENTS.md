# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Kilo Code, and similar) working in this repository. It mirrors CLAUDE.md, plus the "Tool Usage Pitfalls" section below (which applies to non-Claude IDEs).

## Repository Layout

This is the **brewra-gtm-intelligence monorepo** — a single repo containing the React PWA at `/frontend/` and the FastAPI backend at `/backend/`. Plus design specs, plans, docs, and automation at the root level.

```
brewra-gtm-intelligence/
├── frontend/                # React/Vite/TypeScript PWA (subtree from PWA-multi-tenancy)
├── backend/                 # FastAPI Python service (subtree from backend repo)
├── scripts/
│   ├── sync.sh              # (retired) cutover-era sync tool
│   └── safety_net/          # verification snapshots + verify.sh
├── specs/                   # design intent (output of brainstorming)
├── plans/                   # execution intent (output of plan-writing)
├── docs/
│   ├── analysis/
│   │   ├── detailed-analysis/   # most thorough product/architecture analysis
│   │   └── claude-analysis/     # shorter, CTO-oriented Claude-authored set
│   └── dry-run-merge/       # PWA develop-vs-production canvas drift report (Plan 05 prep)
├── CLAUDE.md, AGENTS.md     # agent context (this file is one of them)
├── BRANCHES.md              # branch model quick-ref
├── README.md
└── .gitignore
```

The two stacks share only an HTTP contract. They live in one repo so cross-cutting changes (API + FE consumer) ship as atomic commits.

The frontend was subtree-imported from `PWA-multi-tenancy/develop` (which is a `git subtree split` of PWA's `development/friendly-sales-canvas/` folder). The backend was imported from `backend@main`. Full git history is preserved (no `--squash`).

## Branch Model

The monorepo cutover is **complete**. `master` is the single integration trunk; all work happens on short-lived branches that merge back.

| Branch | Role | Policy |
|---|---|---|
| `master` | Stable trunk / single integration branch. | No direct feature commits — branch off `master`, review when warranted, merge back with `--no-ff`. Direct commits reserved for trivial doc/typo fixes. |
| legacy (`develop`, `production`, `refactor`, `pwa-*`, `pwa-master-history`) | Dormant pre-cutover history. | **Read-only — do not commit.** Retained a few months for issue triage / rollback and business reasons, then pruned. Not active development targets. |

**Discipline rules:**
- Feature/phase work happens on a short-lived branch named `phase-N-*` (or feature-named), cut off `master`, merged back via `--no-ff` after a green local `npm run preflight` (see "AI-Native Development"). Review depth is judgment: plan execution, multi-commit refactors, and non-trivial logic warrant it; trivial fixes don't. Delete branches after merge.
- The legacy branches are a frozen safety net from the fork/cutover, not sync or commit targets.

**Recovery anchors:**
- Tag `pre-monorepo-fork-2026-05-08` (PWA + backend origins at fork moment).
- Tag `fork-point-2026-05-08` (monorepo `master` initial post-import state).
- `pwa-master-history` (full PWA pre-fork history with original SHAs).

## Polyglot Repo Practices

This is a polyglot setup: a Python/FastAPI service in `/backend/` and a TypeScript/React PWA in `/frontend/`. The two stacks share only an HTTP contract. Treat them as separate codebases that happen to coexist in this repo.

- **Never share utility files between frontend and backend.** No symlinks, no copy-pasted helpers, no relative imports across the boundary. The languages, runtimes, and dependency graphs are different. If the same logic is genuinely needed on both sides, implement it twice — duplication is the lesser evil.
- **When adding a feature, update the backend first, verify the response shape with a live call, then implement the frontend.** There is **no auto-generated OpenAPI client** wired up — and a handful of endpoints across `app/routers/` and `app/routers/v2/` still lack `response_model` annotations — so static schema inference will mislead you. Use FastAPI's `/docs` or `curl` against a running backend to confirm the actual JSON shape before writing FE code against it.
- **Run tooling from the correct subdir.** `npm` / `vite` / `eslint` only inside `/frontend/`; `pip` / `uvicorn` / `python` only inside `/backend/`. There is no root-level `package.json` or `pyproject.toml` — running package commands at the monorepo root will fail or silently no-op.
- **Types do not cross the boundary.** Backend has per-domain Pydantic models in `app/models/`; frontend types live in `frontend/src/features/*/types.ts` + `src/shared/types/`. When an API shape changes, update both sides explicitly — don't try to generate one from the other.
- **The frontend API base is the contract surface.** Path changes in the backend routers (`app/routers/` + `app/routers/v2/`) require matching FE updates at `src/shared/api` callsites. The base is env-driven (spec 42): local dev sets `VITE_API_BASE_URL=/api` and uses the Vite dev proxy (target `VITE_BACKEND_BASE_URL`, defaulting to `http://localhost:8000`); deployed builds set `VITE_API_BASE_URL` to the full backend URL and call it directly (there is no `vercel.json` `/api` rewrite).
- **Don't mix dependency manifests in one commit *unless the change is genuinely coordinated*.** `backend/requirements.txt` and `frontend/package.json` changes belong in separate commits unless paired by intent (e.g., a new endpoint plus its FE consumer). For coordinated cross-stack work, a single atomic commit is preferred — that's the monorepo benefit. The rule is: don't mix them *accidentally*.
- **Environment config doesn't cross.** Backend config is fully env-driven via `app/core/config.py` (spec 42): every required var fails hard at startup if missing — no hardcoded fallbacks. See `backend/.env.example` for the contract. Frontend env vars are Vite-scoped (`VITE_*`); see `frontend/.env.example`. There is no shared `.env` and there shouldn't be one.
- **Lint/test commands differ — pick a side before running them.** FE: `npm run lint` (eslint), no test framework. BE: no linter wired up, and `test_*.py` files are **live integration probes against production** (see Gotchas). "Run the tests" is not a meaningful instruction here without first picking a side.
- **When debugging a cross-stack bug, isolate the side before speculating.** Browser Network tab shows what the FE sent and received; backend logs show what the server saw. Confirm with one tool before claiming the bug is "on the other side" — the FE has three caching layers and the BE trusts client-supplied IDs, so symptoms can be misleading from either direction.
- **Cross-stack atomic commits are encouraged for coordinated changes.** A FE rename (e.g., `org_id` → `orgId`) does not propagate to BE handlers — those edits must be explicit. But when you intentionally change both sides for one feature, ship them together so the diff is reviewable as one unit.

## Business State (MVP, pre-launch)

Brewra is at MVP stage with **0 live users**. The cost of brief breakage is near zero, so optimize for velocity over deployment ceremony. Aggressive refactors, breaking API changes, schema rewrites, and structural overhauls are acceptable — no zero-downtime requirement, no deprecation periods, no backwards-compat shims, no two-step migrations. Skip feature flags unless there's a genuine reason (A/B test, kill switch for known risk); they are not needed for "rollout safety". When weighing tradeoffs in design discussions, treat "shipping disruption" as a near-zero constraint. This is **not** a license to skip code quality, tests, or careful thinking — it's a license to skip the ceremony that exists to protect users you don't have yet.

## Architecture: Big Picture

### What the product is
Brewra is a B2B GTM/sales-intelligence PWA. Three customer-facing "agents" — **Scout** (research), **Profiler** (ICP/personas), **Strategist** (orchestration) — plus a unified `/signals` feed. **Scout and Profiler share most of their backend logic** in `app/services/signals/` (search/LLM/parsing — the unified `search_signals` core in `app/services/signals/search.py`), differentiated by prompt persona resolved through the prompt loader (`app/core/prompts.py` + `prompts/signals/`, e.g. `signals_scout_search` vs `signals_profiler_search`). **Strategist has no backend at all** — it's a frontend sequence builder in `frontend/src/features/strategist/` (StrategistWorkspace renders on the Strategist page; hydrates from `sessionStorage.strategistContext`).

### Backend topology
- Single FastAPI process, now **layered** (not the old flat `api.py`/`services.py` monolith): `app/core/` (cross-cutting infra — `clients`, `config`, `dependencies`, `exceptions`, `llm_config`, `logging`, `prompts`), `app/models/` (per-domain Pydantic models + `pagination.py`), `app/routers/` (per-domain routers, with versioned successors in `app/routers/v2/`), and `app/services/<domain>/` (business logic, split into per-domain sub-modules). `backend/main.py` is a thin shim (`from app.main import app`); `app/main.py` is the application factory and owns the `lifespan` startup (build_clients → init_registry → build_llm_config → guarded Neo4j `refresh_schema()` → guarded Mongo index creation). **Full map: `docs/architecture/BACKEND.md`.**
- Polyglot persistence:
  - **Neo4j** — CRM graph (Company, Lead, Contact, Activity, ICP, Campaign, GTM_Strategy). Schema is hard-coded in the Cypher-generation prompt (`prompts/llm_config/cypher_gen.md.j2`, composing `prompts/_shared/cypher_base.md.j2`).
  - **MongoDB** — Market Intelligence reports, Lead Market Scores, Signals, File Processing Status, Customer Profiles. Multiple databases: `Scout_Agent`, `Profiler`.
  - **Pinecone** — document embeddings, namespaced by `org_id`.
  - **S3 (`eu-north-1`)** — uploaded PDFs/text.
- LLMs (`app/core/llm_config`):
  - **Together.ai `Qwen/Qwen3-235B-A22B-Instruct-2507-tput`** — the single non-Claude chat model. Drives the LangChain `ZERO_SHOT_REACT_DESCRIPTION` `agent_chain` with Tavily WebSearch (`max_iterations=20`, `max_execution_time=120`) for the research/signals/ICP/market-research paths (the `llm_backend="qwen"` variants), and also the `LLMGraphTransformer` (uploaded doc → Neo4j extraction), the Apollo discovery re-rank, and prospect scoring. **Groq `llama-3.3-70b-versatile` was retired 2026-06-14** — every path it drove moved to Qwen (validated live before the swap).
  - **Anthropic Claude (`claude-sonnet-4-6`)** — the `_claude` endpoint variants the frontend actually calls for Scout/Profiler signal generation/ask and ICP/market research.
  - **Embeddings: `intfloat/multilingual-e5-large-instruct`, 1024-dim**, served by TogetherAI through `langchain_openai.OpenAIEmbeddings` (`app/services/_retrieval.py`). Despite the class name, this is **not OpenAI**.
- Async: only `fastapi.BackgroundTasks` — used for document embedding and lead market scoring. **In-process; tasks are lost on Render restart.** No queue, no retries.

### Frontend topology
- React 18 + Vite + Tailwind + shadcn-ui (Radix). Firebase email/password auth. PWA via `vite-plugin-pwa` (Workbox).
- **Per-feature structure** (post-refactor): product surfaces live under `src/features/<feature>/` (pages/components/hooks/services/types.ts/index.ts/README.md). Cross-cutting code lives in `src/shared/` (`api/`, `auth/`, `tenant/`, `chat/`, `company-profile/`, `profiler/`, `components/`, `hooks/`, `lib/`, `types/`, `styles/`). shadcn primitives are locked in `src/components/ui/`. Cross-feature imports go through a feature's `index.ts` only (enforced by `import-x` lint). Full conventions: `frontend/src/features/README.md`.
- **Data layer:** TanStack Query is the server-state layer, configured in `src/shared/api/` with hand-authored zod contracts and a single rate limiter (**30 req/min**). Transport is `src/shared/api/transport.ts` (`apiFetch`). Some editable-state features still retain `localStorage`/`sessionStorage` by deliberate deferral — see `docs/TECH_DEBT.md` (TD-FE-19 family).
- **App-wide state:** `AuthContext` + `TenantContext` live in `src/shared/auth/` and `src/shared/tenant/`.
- Routing: `/` → login → `/tenant-selection` → protected. Scout at `/your-ai-team/scout/:tab`, Strategist at `/your-ai-team/strategist/:tab` (Deals.tsx is the Strategist page); Profiler is distributed across `/mission-control` and `/customers` (no separate `features/profiler/` — see ADR-0006 / TD-FE-60).
- Tooling/quality gates: `npm run preflight` (typecheck, lint, format:check, vitest, build, advisory bundle:check, Playwright + visual regression, knip --strict). See "AI-Native Development".
- Originally Lovable-generated; the `lovable-tagger` build plugin has since been removed. The Lovable URL in `frontend/README.md` reflects that lineage; the markdown integration guides that used to sit at the frontend root were removed in the 2026-06-15 doc-staleness cleanup (recoverable from git history).

### Auth reality check
The frontend looks like it does JWT auth: `JWTManager` posts to `/api/auth/token` and `/api/auth/refresh`, attaches `Authorization: Bearer …` to every call, gracefully handles 404. **The backend does not validate this token.** Every endpoint reads `user_id` / `org_id` from query/body params and trusts them. Multi-tenancy is enforced by `WHERE l.org_id = $org_id` in Cypher and `{"org_id": ...}` in Mongo, nothing more. When you add an endpoint, do not assume an auth context exists.

## AI-Native Development

This repo is structured for AI-native development: cross-cutting tasks (changes spanning both stacks) land as **atomic commits**, and work flows through a **spec → plan → implementation** pipeline.

- **Cross-stack atomicity.** A feature touching both `/frontend/` and `/backend/` ships as one commit (or one PR), reviewable as one diff. Don't split FE/BE changes across separate commits "because the codebases are different" — that's the polyrepo habit, not the monorepo rule.
- **Commit granularity: prefer small, frequent commits.** Within a multi-step task (a plan with N tasks, a refactor with several discrete pieces, a feature built in stages), ship one commit per logical step rather than batching. A single plan task = a single commit. A single fixture file or test module = its own commit. A bug fix and the test that catches it = one commit (they're one logical step), but if the same bug fix touches three unrelated call sites, those can be three commits. The bias is toward more, smaller commits — easier to review, easier to bisect, easier to revert. This rule sits beside cross-stack atomicity, not against it: a coordinated FE+BE change for one feature is still one commit, because that *is* the logical step.
- **Commit message style.** Subjects use `type(scope):` format (`refactor(be):`, `feat(fe):`, `docs(plans):`, `chore(be):`) and describe the code change itself — not the plan slot, not the meta-activity. Skip `[N/M]` numbering suffixes. Plan-reference trailers (`Refs: plan-9`) are author's judgment; default off, use only when a commit would otherwise be hard to trace back to its context. Body is optional and author's judgment — include one when the *why* isn't obvious from the diff.
- **Spec-driven flow.** Each artifact transition runs an adversarial review cycle (fresh-eyes reviewer + same-agent synthesis), looped until findings are nit-or-below before moving on.
  1. Idea → brainstorm → `/specs/NN-feature-X-design.md` (design intent)
     - `/review-spec` → `/synthesize-spec-review` (loop until clean)
  2. Spec → plan-write → `/plans/NN-feature-X.md` (execution intent, ordered steps)
     - `/review-plan` → `/synthesize-plan-review` (loop until clean)
  3. Plan → atomic commits on a feature branch (impl)
     - `/review-impl` → `/synthesize-impl-review` (loop until clean)
  4. Human-approved merge:
     - Controller runs `npm run preflight` in `frontend/` (typecheck + lint + build + Playwright; later phases extend with vitest, knip --strict, bundle-budget — see spec 14 §5.3)
     - Green → `git checkout master && git merge <branch> && git push origin master`. Red → report which check failed; user decides fix vs abort.
- **No CI; preflight is local.** There is no `.github/workflows/` or external runner. The `npm run preflight` chain in `frontend/package.json` is the only pre-merge gate, and it runs on the controller's machine before the merge commit. Each later phase appends one more check to the chain. Two companions exist for iteration speed: `npm run verify` runs the fast inner-loop subset (typecheck + lint + change-scoped tests via `vitest run --changed` — only the tests whose dependency graph touches your uncommitted changes; the full Vitest suite, ~10 min at 89 files, is skipped here and runs **only** in the `preflight` merge gate) and `npm run preflight:par` runs the full gate in parallel via `scripts/preflight.mjs` (faster on an idle box, but it spikes CPU load and can flake the e2e visual tests when another session shares the machine — prefer the serial `npm run preflight` for the actual merge gate, especially during concurrent worktree development).
- **NN numbering.** New specs and plans take the next NN after the highest existing N in `/plans/`, counting both prefix and suffix forms (e.g., `modularization-plan-9.md` counts as N=9, so the next slot is `10-`). The spec and plan for the same feature share the NN — `/specs/10-feature-X-design.md` pairs with `/plans/10-feature-X.md`.
- **Specs and plans are a frozen record of intent, not current truth.** Once a plan merges, treat its contents as a historical snapshot of what was intended at that moment — not a representation of what the code does now. Don't update specs/plans to reflect post-merge drift; the code is authoritative for current behavior.
- **CLAUDE.md ↔ AGENTS.md are kept in sync.** They share an identical base; AGENTS.md additionally carries the "Tool Usage Pitfalls" section for non-Claude IDEs. **Any edit to a shared section must be applied to both files.**

## Testing

Backend test conventions live in `backend/TESTING.md` — patch-where-used is the most-bitten rule.

## Gotchas (things you can't infer from the code)

- **Smoke-test scripts hit production.** The root-level `backend/test_*.py` probes use `https://backend-11kr.onrender.com` and hardcoded IDs — treat them as live integration probes, not unit tests. They are **distinct** from the real pytest suite under `backend/tests/` (see `backend/TESTING.md`).
- **`app/core/config.py` has hardcoded credential fallbacks** (Neo4j, Mongo, Together, Tavily, RapidAPI) for when env vars aren't set. Do not paste `app/core/config.py` into a PR description, screenshot, or chat.
- **Cypher injection risk in the graph-chat paths** (`app/routers/graph_chat.py` → `app/services/graph_chat/neo4j.py`, including the raw-Cypher `/query` path). These exist; don't extend the same f-string pattern.
- **Pagination is a convention now.** The shared `PaginatedResponse[T]` model lives in `app/models/pagination.py` (`items` / `total` / `limit` / `offset`, `limit` capped at 500) and is used by the v2 list endpoints. Note the v1 `count` caveat: on capped v1 list routes, `count` reflects page size, not the true DB total — see `TD-005` in `docs/TECH_DEBT.md`.
- **CORS is `allow_origins=["*"]` with `credentials=True`** (`app/main.py`). Don't rely on origin checks.
- **Prompts live in `backend/prompts/<svc>/`** (Jinja2 bodies) served by `app/core/prompts.py`; regional-bias examples (APAC, NA/DACH, healthcare) are in the prompt bodies themselves. When research output looks biased, the prompt is the cause — see `docs/PROMPTS.md` and `docs/legacy/ANALYSIS_MARKET_ICP_RESEARCH_ISSUES.md` (archived pre-modularization analysis).
- **Embeddings are TogetherAI, not OpenAI.** `langchain_openai.OpenAIEmbeddings` in `app/services/_retrieval.py` is pointed at TogetherAI (`intfloat/multilingual-e5-large-instruct`, 1024-dim) — the class name is misleading.
- **Neo4j CRM-graph schema is hard-coded in the Cypher-generation prompt** (`prompts/llm_config/cypher_gen.md.j2`, composing `prompts/_shared/cypher_base.md.j2`), not in code. Edit the prompt, not a constant, to change the schema the LLM reasons over.
- **Multiple admin tools live in the backend** (`backend/admin_panel.html`, `backend/registration_admin_panel.html`, `backend/cleanup_company_profile.py`, still at the `backend/` root). They are served by FastAPI but not part of the API surface.
- **Scout/Profiler chat share a `ChatWithHistory` shell** in `src/shared/chat/`; both wrappers delegate to it (deduped in the refactor).

## Tool Usage Pitfalls

### Glob patterns are NOT regex

The `Glob` tool uses **glob syntax**, not regex. This has caused real bugs in this repo (overwriting `docs/reviews/…-review-1.md` because a glob pattern returned zero matches and N was computed as 1 instead of 3).

**Wrong (regex syntax — silently matches nothing or wrong files):**
- `docs/reviews/some-slug-review-[0-9]+.md` — the `+` is a literal character in glob, not a quantifier
- `docs/reviews/some-slug-review-\d+.md` — `\d` is not a glob character class

**Correct (glob syntax):**
- `docs/reviews/some-slug-review-*.md` — matches any suffix (then inspect results to find max N)
- `docs/reviews/some-slug-review-[0-9].md` — matches a single digit (fine for N < 10)
- `docs/reviews/*review*.md` — broad match, filter in post

**When determining N for numbered file series (reviews, syntheses, etc.):** use a broad glob like `docs/reviews/<slug>*` to list all matching files, then compute max+1 from the results. Never assume "no matches" means N=1 without double-checking with a wider pattern.

## Pre-existing Analyses

If asked to reason about architecture, product scope, or design system, **read these first** — but note the two `docs/analysis/` sets are **frozen pre-refactor snapshots** that describe the old flat `api.py`/`services.py` backend monolith. For the **current** backend structure, `docs/architecture/BACKEND.md` is the canonical reference; the analysis sets remain useful for product scope, design system, and frontend debt.

- `/docs/analysis/detailed-analysis/{PRODUCT_SPECIFICATION,ARCHITECTURE_DOCUMENT,DESIGN_SYSTEM,FUNCTIONALITY_INVENTORY,README}.md` — the most thorough set, with code snippets and quantified debt (1,566 console.logs, 989 hooks, 227KB MarketResearch.tsx). **Backend-structure claims here are a pre-refactor snapshot — defer to `docs/architecture/BACKEND.md`.**
- `/docs/analysis/claude-analysis/` — Claude's reverse-engineered set, shorter and CTO-oriented; emphasizes the Scout/Profiler near-duplication and the Strategist-has-no-backend reality. **Also a frozen pre-refactor snapshot for backend structure.**
- `/docs/dry-run-merge/` — develop-vs-production canvas drift, file-level (`dev-only.txt`, `prod-only.txt`, `differ-with-sizes.txt`, `identical.txt`). Input for Plan 05 reconciliation. For the conceptual summary of the divergence (which feature groups live where), see the "Dev/prod codebase unification" row in either `FUNCTIONALITY_INVENTORY.md` under `/docs/analysis/`.
- `/frontend/analysis/` (subtree-imported from PWA) — earlier per-repo passes; mostly superseded by `/docs/analysis/`.
- The backend area also contains self-authored markdown guides at its root — `backend/API_DOCUMENTATION.md` and `backend/API_ENDPOINTS_SUMMARY.md` (primary sources for the API surface; the Apollo `/connectors` routes are documented there too). The pre-modularization `ANALYSIS_MARKET_ICP_RESEARCH_ISSUES.md` was archived to `docs/legacy/`.
- The pre-cutover PWA frontend guides (`JWT_INTEGRATION_GUIDE.md`, `SCOUT_API_REQUEST_SCHEMAS.md`, `PWA_SETUP.md`, etc.) were **removed** in the 2026-06-15 doc-staleness cleanup — they described the old `src/lib`/`src/pages` layout, not current behavior (recoverable from git history / the `PWA-multi-tenancy` repo). For current frontend conventions see `frontend/src/features/README.md` and the per-feature `README.md` files.

## Technical Debt Register

`/docs/TECH_DEBT.md` is the living register of debt the team has consciously accepted. Each entry names the current state, what it should be, why deferred, and the trigger that should pull it forward. Consult before starting work that might be affected by a tracked item; add a new entry whenever you accept a quality compromise future agents/devs need to know about. Architecture decisions are recorded as ADRs in `docs/adr/` (index: `docs/adr/README.md`). The register/archive lifecycle (logging, resolving, archiving, auditing entries) is codified in the `tech-debt` skill (`.claude/skills/tech-debt/SKILL.md`).

## Plans / Specs Reference

- `/plans/01-pwa-folder-to-branch.md` — folder→branch refactor of PWA (executed 2026-05-05).
- `/plans/02-monorepo-fork-plan.md` — this monorepo's creation (executed 2026-05-08).
- `/specs/02-monorepo-fork-spec.md` — design spec for the monorepo fork.
- `/specs/22-backend-doc-reconciliation-design.md` + `/plans/22-backend-doc-reconciliation.md` — sync project/agent docs to the refactored backend.
