---
artifact: worktree-apollo-ux-fixes
artifact_type: impl
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-23
round: 1
base_ref: master
spec_loaded: false
plan_loaded: false
---

## Context

- **Change-context source:** `git log -p master..worktree-apollo-ux-fixes` — full per-commit patches (4 commits, ~39 KB), no commit bodies dropped; commit messages are the primary rationale signal. Net change: `git diff --stat master...worktree-apollo-ux-fixes` (16 files, +420/−26).
- **Adherence reference:** No spec/plan exists for this branch (auto-discovery under `specs/`/`plans/` finds no `worktree-apollo-ux-fixes.*`, and the most-recent spec is unrelated). Operator confirmed using **`docs/reviews/apollo-integration-rca-2026-06-23.md` §5 (Recommended fixes)** as the adherence target — its symptom→fix list maps 1:1 onto the four commits (S4→`84e4555`, S5/S6→`283bc4f`, S2→`6959055`, P2-5→`72a4da9`). `spec_loaded`/`plan_loaded` are therefore false; adherence is checked against the RCA's fix list.
- **Config loaded (from the branch):** `frontend/package.json` (engines `node >=21.2.0`; scripts — `verify`, `preflight`, `knip --strict`), `frontend/knip.json` (entry/project/ignore rules — confirms the touched files are production entries, not dead code that knip would flag). `tsconfig*.json` and `backend/requirements.txt` exist but carry no invariant this review relied on; no root `package.json`/`pyproject.toml`/`ruff`/`mypy`/`eslintrc` present.
- **Path note:** `LeadsTable.tsx` lives at `frontend/src/features/market-research/components/lead-stream/` on **both** master and the branch. The `…/features/scout/…` shown in the three-dot `--stat` was a rename/abbreviation artifact, not a real path or a rename — there is exactly one such file (`git ls-tree` confirms).
- **Branch execution model:** RCA-driven bugfix branch (no formal plan), small and trivially revertible; the "missing abort/rollback" calibration is not applicable here and is not filed.

## Findings

### [Medium] LeadsTable re-fetches `/v2/leads` with a raw `fetch` that bypasses the data layer and duplicates `customers/services/leads.ts`

**Location:** `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx:535-568` (new real-leads `useEffect`) + `frontend/src/features/market-research/lib/marketScoresHeatmap.ts` (`heatmapLeadFromV2Lead`).

The new loader hand-rolls `fetch(buildApiUrl("v2/leads?…"))`, manually attaches the JWT header, parses an untyped `Record<string, unknown>`, and hardcodes `limit: "500"`. This sidesteps the app's established server-state layer (`src/shared/api/transport.ts` `apiFetch` + zod contracts + the shared 30-req/min rate limiter — the data layer AGENTS.md makes central) and re-derives field-picking (`pickCompanyName`/`pickLeadDisplayName`) into a second parser for an endpoint that already has one. `frontend/src/features/customers/services/leads.ts:11-20` reads the **exact same** `GET /v2/leads` route via `apiFetch` with a validated `RawLeadSchema` + `mapRawLead` and real pagination.

Two consequences: (1) two parsers for one endpoint — the precise "no auto-generated OpenAPI client → shapes drift silently" hazard AGENTS.md warns about; (2) the hand fetch caps at `limit:500` (the endpoint's max page), so orgs with >500 leads render an incomplete list in Scout while the Customers Lead Stream paginates fully. Recommend reusing the existing reader (expose a paginated `fetchLeads` through `customers/index.ts` per the cross-feature import rule, mapping `CustomerLead`→`HeatmapLead` at the call site) or at minimum routing through `apiFetch` + `RawLeadSchema` and dropping the bespoke field-picking.

### [Low] Tier filter silently hides the new unscored Apollo leads

**Location:** `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx:605` (`tierFiltered`), empty state at `:802`.

`tierFiltered` drops every lead with `scored === false` whenever a named tier is selected (`baseLeads.filter((l) => l.scored !== false && l.priority === tierFilter)`). The newly-surfaced Apollo leads are all unscored until a market-scoring run completes, so they appear **only** under "All" and vanish the instant a user picks any tier — including "Tier 3", the placeholder priority unscored leads carry (`heatmapLeadFromV2Lead` sets `priority: "Tier 3"`). Given this branch's entire purpose is "make Apollo leads visible in Scout," a user who filters to locate them hits a confusing dead-end. Recommend either keeping unscored leads visible under their placeholder tier, or making the filtered empty-state say "N unscored leads are hidden by this filter — show All."

### [Nit] Numeric `retry: 2` retries deterministic failures (parse throws / 4xx), adding up to ~3s of needless backoff

**Location:** `frontend/src/features/signals/hooks/useSignalLeadMap.ts:29-30` (and the backoff base at `:12`).

A numeric `retry` retries *every* rejection. The lead-map transport still uses `schema.parse` (throws on a malformed-but-`200` body — the latent issue the RCA flagged as P2-6), and a genuine 4xx would also retry, so a deterministic failure now burns 3 attempts with 1s/2s backoff before surfacing. Low impact today (endpoint is warm-200), but a `retry` predicate that skips 4xx / non-transient throws would avoid the pointless delay. The paired fix is the RCA's P2-6 `safeParse` hardening, which removes the throw path entirely.

### [Nit] New `/v2/leads` fetch fails completely silently (no log)

**Location:** `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx:563-564`.

The `catch {}` swallows every failure with no `console.warn`, so a contract drift or parse bug would manifest only as an empty / "No leads yet…" table with zero diagnostic signal — the same class of silent failure the RCA spent S5/S6 untangling. A one-line `console.warn` (matching `refresh()`'s pattern in `useSignalLeadMap.ts:78`) would preserve debuggability while staying best-effort.

## Observations (no action)

- `run.counts.created` (`ApolloTile.tsx:171-172`) is safe: `fetchApolloDiscoverStatus` parses through `ApolloDiscoverStatusSchema`, which defaults `counts:{}` and `created:0`, so `.counts` is guaranteed present. The neighboring `run?.counts.searched ?? 0` (`:186`) is just more defensive style — a harmless inconsistency, no change needed.
- **RCA adherence is complete.** P0-1A (Scout real leads), P0-2 (retry + "Try again"), P1-3 (`isFetching` spinner + recompute toast), P1-4 (Apollo tile created-count + deep-link), and P2-5 (Render `starter` tier) are all implemented. P0-1B (auto-trigger market-scoring) is correctly omitted in favor of Option A per the RCA; P2-6 (`safeParse` hardening) is intentionally deferred — flag as a follow-up.
- Good behavior-focused test coverage added per change: `ApolloTile` S2 count+link, `SignalCard` S5/S6 (Try again, in-flight spinner), `useSignalLeadMap` auto-retry recovery, `LeadsTable.realLeads` (real-not-demo, Live API badge, Unscored badge), and the `heatmapLeadFromV2Lead`/`scored:true` mapper unit tests. The updated `recompute-exits-error-state` test correctly accounts for the new 3-attempt retry budget.
