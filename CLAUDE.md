# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is the **brewra-gtm-intelligence monorepo** — a single repo containing the React PWA at `/frontend/` and the FastAPI backend at `/backend/`. Plus design specs, plans, docs, and automation at the root level.

```
brewra-gtm-intelligence/
├── frontend/                # React/Vite/TypeScript PWA (subtree from PWA-multi-tenancy)
├── backend/                 # FastAPI Python service (subtree from backend repo)
├── scripts/
│   ├── sync.sh              # pull Brewra-dev work from old repos (temp week only)
│   └── safety_net/          # verification snapshots + verify.sh
├── specs/                   # design intent (output of brainstorming)
├── plans/                   # execution intent (output of plan-writing)
├── docs/
│   ├── analysis/
│   │   ├── detailed-analysis/   # most thorough product/architecture analysis
│   │   └── claude-analysis/     # shorter, CTO-oriented Claude-authored set
│   └── dry-run-merge/       # PWA develop-vs-production canvas drift report (Plan 05 prep)
├── CLAUDE.md, AGENTS.md     # agent context (this file is one of them)
├── BRANCHES.md              # branch model + sync workflow quick-ref
├── README.md
└── .gitignore
```

The two stacks share only an HTTP contract. They live in one repo so cross-cutting changes (API + FE consumer) ship as atomic commits.

The frontend was subtree-imported from `PWA-multi-tenancy/develop` (which is a `git subtree split` of PWA's `development/friendly-sales-canvas/` folder). The backend was imported from `backend@main`. Full git history is preserved (no `--squash`).

## Monorepo Branch Model (during temp week ending ~2026-05-22)

This repo is in a temporary parallel-branch state during the fork transition. After Plan 05 reconciliation and Brewra-dev migration, this section gets rewritten for the future `master`/`dev`(/`stage`) model.

| Branch | Role | Policy |
|---|---|---|
| `master` | Stable trunk. Feature work merges in from short-lived branches. | No direct feature commits — branch off `master`, get review when warranted, merge back. Direct commits reserved for `sync.sh` merges and trivial doc/typo fixes. |
| `develop` | Tracker mirror of PWA `master`'s `development/` folder + backend's `main`. | **Only `sync.sh`'s commits land here.** No hand-typed commits. |
| `production` | Tracker mirror of PWA `master`'s `production/` folder + backend's `main`. | Same: only `sync.sh` writes. |
| `pwa-master-history` | Read-only archive of PWA's `master` at fork moment (canvas-nested layout preserved). | Never write. |

**Discipline rules:**
- **Feature work happens on a branch off `master`** and merges back after review. Use judgment for when a change warrants review — plan execution, multi-commit refactors, and non-trivial logic generally do; trivial fixes don't. Direct commits to `master` are reserved for `sync.sh`/`git merge develop` and trivial doc/typo fixes. Branch naming is author's judgment; delete after merge.
- `sync.sh` updates `develop`/`production` automatically; manual commits to tracker branches will conflict with the next sync.

**Brewra-dev workflow during temp week:** the old repos (`/projects/Brewra/PWA-multi-tenancy/`, `/projects/Brewra/backend/`) remain the Brewra devs' workspaces and the deploy sources. They push to `PWA master` and `backend main` as usual. The CTO syncs into the monorepo via `sync.sh`.

**Sync workflow (Brewra devs → CTO):**
```bash
bash scripts/sync.sh                         # pulls latest from old PWA + backend repos
git checkout master && git merge develop     # absorb FE updates into master (manual, when ready)
```

`sync.sh` is robust (preflight checks, dry-run mode, restores caller's branch, reports per-pull diffs). Read its head comment for usage.

**Backend changes during temp week:**
- Originating in old `backend` repo (Brewra dev pushes to `main`): `sync.sh` propagates to all three monorepo branches automatically.
- Originating on monorepo's `master` (CTO's branch work merged in): do NOT propagate to tracker branches. They ship via cutover. Per spec, this is intentional.

**Recovery anchors:**
- Tag `pre-monorepo-fork-2026-05-08` on PWA origin and backend origin (state at fork moment).
- Tag `fork-point-2026-05-08` on monorepo `master` (initial post-import state).
- `pwa-master-history` branch (full PWA pre-fork history with original SHAs).

**Future state (post-cutover):** `master` + `dev` (+ optional `stage`). Tracker branches deleted. `pwa-master-history` retained as long-term archive.

## Polyglot Repo Practices

This is a polyglot setup: a Python/FastAPI service in `/backend/` and a TypeScript/React PWA in `/frontend/`. The two stacks share only an HTTP contract. Treat them as separate codebases that happen to coexist in this repo.

- **Never share utility files between frontend and backend.** No symlinks, no copy-pasted helpers, no relative imports across the boundary. The languages, runtimes, and dependency graphs are different. If the same logic is genuinely needed on both sides, implement it twice — duplication is the lesser evil.
- **When adding a feature, update the backend first, verify the response shape with a live call, then implement the frontend.** There is **no auto-generated OpenAPI client** wired up, and most endpoints in `backend/api.py` lack `response_model` annotations — so static schema inference will mislead you. Use FastAPI's `/docs` or `curl` against a running backend to confirm the actual JSON shape before writing FE code against it.
- **Run tooling from the correct subdir.** `npm` / `vite` / `eslint` only inside `/frontend/`; `pip` / `uvicorn` / `python` only inside `/backend/`. There is no root-level `package.json` or `pyproject.toml` — running package commands at the monorepo root will fail or silently no-op.
- **Types do not cross the boundary.** Backend has Pydantic `models.py`; frontend types live in `frontend/src/types/`. When an API shape changes, update both sides explicitly — don't try to generate one from the other.
- **The `/api/*` proxy in `frontend/vite.config.ts` is the contract surface.** Path changes in `backend/api.py` require matching FE updates at `enhancedApi` / `apiFetch` callsites. The proxy target is hardcoded to the Render URL (`backend-11kr.onrender.com`); local-backend dev requires editing `frontend/vite.config.ts`.
- **Don't mix dependency manifests in one commit *unless the change is genuinely coordinated*.** `backend/requirements.txt` and `frontend/package.json` changes belong in separate commits unless paired by intent (e.g., a new endpoint plus its FE consumer). For coordinated cross-stack work, a single atomic commit is preferred — that's the monorepo benefit. The rule is: don't mix them *accidentally*.
- **Environment config doesn't cross.** Backend secrets live in `backend/config.py` (with hardcoded fallbacks — see Gotchas). Frontend env vars are Vite-scoped (`VITE_*`), but the API base is currently hardcoded in `frontend/vite.config.ts` and `frontend/vercel.json`. There is no shared `.env` and there shouldn't be one.
- **Lint/test commands differ — pick a side before running them.** FE: `npm run lint` (eslint), no test framework. BE: no linter wired up, and `test_*.py` files are **live integration probes against production** (see Gotchas). "Run the tests" is not a meaningful instruction here without first picking a side.
- **When debugging a cross-stack bug, isolate the side before speculating.** Browser Network tab shows what the FE sent and received; backend logs show what the server saw. Confirm with one tool before claiming the bug is "on the other side" — the FE has three caching layers and the BE trusts client-supplied IDs, so symptoms can be misleading from either direction.
- **Cross-stack atomic commits are encouraged for coordinated changes.** A FE rename (e.g., `org_id` → `orgId`) does not propagate to BE handlers — those edits must be explicit. But when you intentionally change both sides for one feature, ship them together so the diff is reviewable as one unit.

## Business State (MVP, pre-launch)

Brewra is at MVP stage with **0 live users**. The cost of brief breakage is near zero, so optimize for velocity over deployment ceremony. Aggressive refactors, breaking API changes, schema rewrites, and structural overhauls are acceptable — no zero-downtime requirement, no deprecation periods, no backwards-compat shims, no two-step migrations. Skip feature flags unless there's a genuine reason (A/B test, kill switch for known risk); they are not needed for "rollout safety". When weighing tradeoffs in design discussions, treat "shipping disruption" as a near-zero constraint. This is **not** a license to skip code quality, tests, or careful thinking — it's a license to skip the ceremony that exists to protect users you don't have yet.

## Architecture: Big Picture

### What the product is
Brewra is a B2B GTM/sales-intelligence PWA. Three customer-facing "agents" — **Scout** (research), **Profiler** (ICP/personas), **Strategist** (orchestration) — plus a unified `/signals` feed. **Scout and Profiler share ~80% of the same backend code**, differentiated only by prompt persona (`backend/services.py: search_signals_scout` vs `search_signals_profiler`). **Strategist has no backend at all** — it's a frontend sequence builder (`frontend/src/components/strategist/StrategistWorkspace.tsx`) that hydrates from `sessionStorage.strategistContext`.

### Backend topology
- Single FastAPI process. **`backend/api.py` is ~4.4k LOC, `backend/services.py` ~2.5k LOC**, no routers — all endpoints inline. `backend/main.py` is a 16-line entrypoint whose import order matters (`config → models → database → llm_config → services → api`).
- Polyglot persistence:
  - **Neo4j** — CRM graph (Company, Lead, Contact, Activity, ICP, Campaign, GTM_Strategy). Schema is hard-coded in the Cypher-generation prompt at `backend/llm_config.py:29-96`.
  - **MongoDB** — Market Intelligence reports, Lead Market Scores, Signals, File Processing Status, Customer Profiles. Multiple databases: `Scout_Agent`, `Profiler`.
  - **Pinecone** — document embeddings, namespaced by `org_id`.
  - **S3 (`eu-north-1`)** — uploaded PDFs/text.
- LLMs:
  - **Groq `llama-3.3-70b-versatile`** — primary chat/research.
  - **Together.ai `Qwen/Qwen3-235B-A22B-Instruct-2507`** — driver for the LangChain `ZERO_SHOT_REACT_DESCRIPTION` `agent_chain` with Tavily WebSearch (`max_iterations=20`, `max_execution_time=120`).
  - **Embeddings: `intfloat/multilingual-e5-large-instruct`, 1024-dim**, served by TogetherAI through `langchain_openai.OpenAIEmbeddings` (`backend/api.py:111-114, 3722-3734`). Despite the class name, this is **not OpenAI**.
- Async: only `fastapi.BackgroundTasks` — used for document embedding and lead market scoring. **In-process; tasks are lost on Render restart.** No queue, no retries.

### Frontend topology
- React 18 + Vite + Tailwind + shadcn-ui (Radix). Firebase email/password auth. PWA via `vite-plugin-pwa` (Workbox).
- State: `AuthContext`, `TenantContext`, plus three caching layers (`localStorage`, `enhancedApi` 5-min in-memory map, `sessionStorage`). **TanStack Query is in `package.json` but unused** — don't assume `useQuery` is available; the existing pattern is manual `fetch` via the clients in `frontend/src/lib/`.
- API clients are layered: `apiFetch` (`frontend/src/lib/api.ts`) → `enhancedApi` (rate-limit + cache) → `authenticatedApi` (JWT injection). The `rateLimitManager` enforces 4 req/min on the FE to stay under provider limits.
- Routing milestones: `/` → login → `/tenant-selection` → protected. Scout lives at `/your-ai-team/scout/:tab`, Strategist at `/your-ai-team/strategist/:tab`, Profiler is split between `/mission-control` and `/customers`.
- This project was originally generated by **Lovable** (`lovable-tagger` in `frontend/vite.config.ts`). The Lovable URL in `frontend/README.md` and the markdown integration guides at the frontend root reflect that lineage.

### Auth reality check
The frontend looks like it does JWT auth: `JWTManager` posts to `/api/auth/token` and `/api/auth/refresh`, attaches `Authorization: Bearer …` to every call, gracefully handles 404. **The backend does not validate this token.** Every endpoint reads `user_id` / `org_id` from query/body params and trusts them. Multi-tenancy is enforced by `WHERE l.org_id = $org_id` in Cypher and `{"org_id": ...}` in Mongo, nothing more. When you add an endpoint, do not assume an auth context exists.

## AI-Native Development

This repo is structured for AI-native development: cross-cutting tasks (changes spanning both stacks) land as **atomic commits**, and work flows through a **spec → plan → implementation** pipeline.

- **Cross-stack atomicity.** A feature touching both `/frontend/` and `/backend/` ships as one commit (or one PR), reviewable as one diff. Don't split FE/BE changes across separate commits "because the codebases are different" — that's the polyrepo habit, not the monorepo rule.
- **Commit granularity: prefer small, frequent commits.** Within a multi-step task (a plan with N tasks, a refactor with several discrete pieces, a feature built in stages), ship one commit per logical step rather than batching. A single plan task = a single commit. A single fixture file or test module = its own commit. A bug fix and the test that catches it = one commit (they're one logical step), but if the same bug fix touches three unrelated call sites, those can be three commits. The bias is toward more, smaller commits — easier to review, easier to bisect, easier to revert. This rule sits beside cross-stack atomicity, not against it: a coordinated FE+BE change for one feature is still one commit, because that *is* the logical step.
- **Commit message style.** Subjects use `type(scope):` format (`refactor(be):`, `feat(fe):`, `docs(plans):`, `chore(be):`) and describe the code change itself — not the plan slot, not the meta-activity. Skip `[N/M]` numbering suffixes. Plan-reference trailers (`Refs: plan-9`) are author's judgment; default off, use only when a commit would otherwise be hard to trace back to its context. Body is optional and author's judgment — include one when the *why* isn't obvious from the diff.
- **Spec-driven flow.**
  1. Idea → brainstorm → `/specs/NN-feature-X-design.md` (design intent)
  2. Spec → plan-write → `/plans/NN-feature-X.md` (execution intent, ordered steps)
  3. Plan → atomic commits on a feature branch → review → merge to `master`
- **NN numbering.** New specs and plans take the next NN after the highest existing N in `/plans/`, counting both prefix and suffix forms (e.g., `modularization-plan-9.md` counts as N=9, so the next slot is `10-`). The spec and plan for the same feature share the NN — `/specs/10-feature-X-design.md` pairs with `/plans/10-feature-X.md`.
- **Specs and plans are a frozen record of intent, not current truth.** Once a plan merges, treat its contents as a historical snapshot of what was intended at that moment — not a representation of what the code does now. Don't update specs/plans to reflect post-merge drift; the code is authoritative for current behavior.
- **Sync workflow** (during temp week only): `bash scripts/sync.sh` pulls Brewra-dev changes from old repos. `git merge develop` on master absorbs FE updates. After cutover (Plan 05 + Plan 06), this section is removed.

## Testing

Backend test conventions live in `backend/TESTING.md` — patch-where-used is the most-bitten rule.

## Gotchas (things you can't infer from the code)

- **Smoke-test scripts hit production.** `backend/test_*.py` use `https://backend-11kr.onrender.com` and hardcoded IDs. Treat them as live integration probes, not unit tests.
- **`backend/config.py` has hardcoded credential fallbacks** (Groq, Neo4j, Mongo, Together, Tavily, RapidAPI) for when env vars aren't set. Do not paste `backend/config.py` into a PR description, screenshot, or chat.
- **Cypher injection risk in `voice_graph` / `text_graph`** (`backend/api.py:682-694, 714-727`) and the `GET /query/` raw-Cypher endpoint (`backend/api.py:654`). These exist; don't extend the same f-string pattern.
- **`GET /leads` has no `LIMIT`** (`backend/api.py:740`). The market-scoring background task caps at 5000 (`backend/api.py:439, 1325`) — silently. Pagination is not a project convention yet.
- **CORS is `allow_origins=["*"]` with `credentials=True`** (`backend/api.py:155-161`). Don't rely on origin checks.
- **Prompts are inline in `backend/services.py`** with hardcoded regional examples (APAC, NA/DACH, healthcare). When research output looks biased, the prompt is the cause — see `backend/ANALYSIS_MARKET_ICP_RESEARCH_ISSUES.md`.
- **Multiple admin tools live in the backend** (`backend/admin_panel.html`, `backend/registration_admin_panel.html`, `backend/cleanup_company_profile.py`). They are served by FastAPI but not part of the API surface.
- **Frontend has unused/duplicate cruft**: `frontend/src/components/SafeChatWithScout copy.tsx`, `frontend/src/pages/MarketResearch_clean.tsx`, `_restore_test.txt`, ~150 lines of commented-out code in `frontend/src/components/ICPManager.tsx`. Three `Safe*` wrappers exist; only `SafeMarketIntelligenceTab` is imported in active paths.
- **Frontend duplicates the Scout/Profiler split**: `ScoutChatWithHistory` and `ProfilerChatWithHistory` are 90% the same component.
- **Tracker branch hygiene.** `develop` and `production` are sync targets, not commit targets. If `git status` ever shows you on one of those with staged changes, you're on the wrong branch — `git stash`, switch to your feature branch (creating one off `master` if needed), then re-apply.

## Pre-existing Analyses

If asked to reason about architecture, product scope, or design system, **read these first** — they're more current than any inference from the code:

- `/docs/analysis/detailed-analysis/{PRODUCT_SPECIFICATION,ARCHITECTURE_DOCUMENT,DESIGN_SYSTEM,FUNCTIONALITY_INVENTORY,README}.md` — the most thorough set, with code snippets and quantified debt (1,566 console.logs, 989 hooks, 227KB MarketResearch.tsx).
- `/docs/analysis/claude-analysis/` — Claude's reverse-engineered set, shorter and CTO-oriented; emphasizes the Scout/Profiler near-duplication and the Strategist-has-no-backend reality.
- `/docs/dry-run-merge/` — develop-vs-production canvas drift, file-level (`dev-only.txt`, `prod-only.txt`, `differ-with-sizes.txt`, `identical.txt`). Input for Plan 05 reconciliation. For the conceptual summary of the divergence (which feature groups live where), see the "Dev/prod codebase unification" row in either `FUNCTIONALITY_INVENTORY.md` under `/docs/analysis/`.
- `/frontend/analysis/` (subtree-imported from PWA) — earlier per-repo passes; mostly superseded by `/docs/analysis/`.
- The backend area also contains many self-authored markdown guides at its root (`backend/API_DOCUMENTATION.md`, `backend/API_ENDPOINTS_SUMMARY.md`, `backend/ANALYSIS_MARKET_ICP_RESEARCH_ISSUES.md`). Use them as primary sources.
- The frontend root contains integration/setup guides (`frontend/API_INTEGRATION_GUIDE.md`, `frontend/JWT_INTEGRATION_GUIDE.md`, `frontend/SCOUT_API_REQUEST_SCHEMAS.md`, `frontend/PWA_SETUP.md`, etc.) — also primary sources.

## Technical Debt Register

`/docs/TECH_DEBT.md` is the living register of debt the team has consciously accepted. Each entry names the current state, what it should be, why deferred, and the trigger that should pull it forward. Consult before starting work that might be affected by a tracked item; add a new entry whenever you accept a quality compromise future agents/devs need to know about.

## Plans / Specs Reference

- `/plans/01-pwa-folder-to-branch.md` — folder→branch refactor of PWA (executed 2026-05-05).
- `/plans/02-monorepo-fork-plan.md` — this monorepo's creation (executed 2026-05-08).
- `/specs/02-monorepo-fork-spec.md` — design spec for the monorepo fork.
