# Manual Smoke Checklist

Run this against a **deploy preview** (Vercel preview / Render preview), not against `npm run dev` locally — local dev hides deploy-config regressions, which are the main risk this checklist exists to catch.

Hashes (`./verify.sh all`) prove the deployed artifact is byte-identical to the baseline. This checklist proves the artifact still actually runs end-to-end after the refactor moves things around.

Mark each item: **✅ pass** / **❌ fail** / **➖ skipped (why)**. If anything fails, do not promote the refactor to production — investigate first.

## Pre-flight

- [ ] **Backend `/openapi.json` returns 200** with 44 paths and 27 schemas
  ```bash
  curl -sS https://<backend-host>/openapi.json | python3 -c 'import json,sys; d=json.load(sys.stdin); print("paths:", len(d["paths"])); print("schemas:", len(d["components"]["schemas"]))'
  ```
- [ ] **Frontend preview URL loads** without console errors on the network tab
- [ ] **`/api/*` proxy reaches the backend** (Network tab shows requests to `https://backend-11kr.onrender.com/...` not 404 from the preview origin)
- [ ] **Service worker registers** (DevTools → Application → Service Workers shows the new sw.js as activated)

## Auth + tenant

- [ ] **Login page renders** at `/`
- [ ] **Email/password login** with a known test account succeeds and redirects
- [ ] **Tenant selection** at `/tenant-selection` shows the user's organizations
- [ ] **Tenant pick** routes to `/your-ai-team/...` or `/mission-control` and persists across reload
- [ ] **JWT request to `/api/auth/token`** returns 200 (or expected 404 — JWTManager handles both per CLAUDE.md)
- [ ] **`Authorization: Bearer …` header is attached** to subsequent `/api/*` calls (verify in Network tab)

## Scout (research agent)

- [ ] **`/your-ai-team/scout/chat`** loads
- [ ] **Submit a research query** — response streams back (use a known test prompt)
- [ ] **Chat history persists** across reload (localStorage)
- [ ] **Scout signals appear** in the unified `/signals` feed
- [ ] **`/your-ai-team/scout/lead-stream`** renders without 500s (dev-only feature)
- [ ] **`/your-ai-team/scout/deployment`** renders the `ScoutDeploymentDetails` view (dev-only)

## Profiler (ICP / personas)

- [ ] **`/mission-control`** loads
- [ ] **Run an ICP query** — response is shaped like the dev-side schema (see `SCOUT_API_REQUEST_SCHEMAS.md` in the frontend repo)
- [ ] **`/customers`** ICP / persona screens render
- [ ] **ICPManager component** loads (note: ~150 lines of commented-out code per CLAUDE.md — should still render)
- [ ] **Customer profile detail page** loads for a known org

## Strategist (frontend-only orchestrator)

- [ ] **`/your-ai-team/strategist/sequence`** loads
- [ ] **Strategist hydrates from `sessionStorage.strategistContext`** (set the key manually if needed and reload — the workspace should reflect it)
- [ ] **No backend calls fail** — Strategist has no backend per CLAUDE.md, so any `/api/strategist/*` call would be a regression
- [ ] **Sequence builder UI is interactive** (drag/drop, add step, delete step)

## Signals + Market Intelligence

- [ ] **`/signals`** unified feed loads
- [ ] **Signal items have a source agent** (Scout or Profiler) attribution
- [ ] **MarketResearch tab loads** (the 227KB component per CLAUDE.md — heavy, but should render)
- [ ] **Prod-only components** if testing on prod branch: `MarketRankings*`, `SwotAnalysis*`, `TechnologyDrivers*` render

## Lead browse + upload

- [ ] **`GET /leads`** returns rows (no `LIMIT` clause per CLAUDE.md — capped at whatever the data has)
- [ ] **Lead detail page** loads for a known lead ID
- [ ] **Upload a small test PDF** — `POST /upload-document` succeeds, polling shows processing status
- [ ] **Background embedding task** completes (FastAPI BackgroundTasks; tasks are lost on Render restart per CLAUDE.md, so don't expect retry)

## Cross-stack contracts

- [ ] **Vite proxy in `vite.config.ts`** — confirm the deployed FE talks to the right backend URL (production: `backend-11kr.onrender.com`; preview: whatever the preview env points at)
- [ ] **CORS works** — backend has `allow_origins=["*"]` per CLAUDE.md, so any preview origin should be accepted; confirm no CORS errors in browser console
- [ ] **Cypher endpoints respond** — `voice_graph`, `text_graph`, raw `GET /query/` (note: these have injection risk per CLAUDE.md; we're testing they still work, not that they should exist)

## Caching layers

- [ ] **`enhancedApi` 5-min in-memory cache** — make the same request twice, second is faster (no second network hit in DevTools)
- [ ] **`localStorage` cache** survives reload
- [ ] **Service worker precache** — go offline (DevTools → Network → Offline) and reload — basic shell still loads from sw cache

## Final cutover gate

Do not flip production until:

- [ ] `./verify.sh all` exits 0 against the new layout
- [ ] Every checked item above is ✅ on the preview
- [ ] At least one teammate (not the person who did the refactor) has loaded the preview and exercised the golden path
- [ ] `git tag pre-refactor-2026-05-05` exists and is pushed (so rollback is one `git reset` away)

If the cutover happens and something breaks in production, the rollback is:
1. `git reset --hard pre-refactor-2026-05-05` (or whatever the tag is) **only on a recovery branch — do not force-push main**
2. Revert the Render and Vercel deploys to their previous build via dashboard (not via re-deploy from the recovery branch — dashboard rollback is faster and reversible)
3. Investigate from the preview, not from production
