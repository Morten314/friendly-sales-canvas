# Admin-Configurable Lead-Fetch Limit — Design Spec

**NN:** 47
**Date:** 2026-07-03
**Status:** Design intent (output of brainstorming). Frozen record — code is authoritative after merge.
**Related:** `44-admin-ops-console-design.md` (the `/admin` console this extends), `36-signal-lead-mapping-and-source-labeling-design.md` (the matched-leads map this feature uncaps).

---

## Overview

Three code paths cap how many of an org's leads are fetched and fed into LLM work at **100**, as hardcoded literals. This spec raises that cap to a new default of **500** and, more importantly, converts it from a compile-time constant into a **single global, admin-editable setting** exposed in the internal `/admin` ops console.

The setting is one value applied to every org (not per-org). It governs **all three** lead-fetch sites:

| Site | File:line (pre-change) | What it feeds |
|---|---|---|
| Matched-leads map | `app/services/signals/lead_map.py:65` (`_MAX_LEADS = 100`), applied `:273` | The single Claude call that maps newest-50 signals → matched leads (spec 36). |
| Signal generation | `app/services/signals/search.py:221` (`limit=100`) | Leads passed into `run_signals_research` pre-data. |
| Batch signal generation | `app/services/signals/batch.py:139` (`limit=100`) | Leads passed into `_generate_signals_batch_impl` pre-data. |

All three enclosing functions already receive a `mongo` handle (`build_signal_lead_map_claude(driver, mongo, request)`, `run_signals_research(driver, mongo, pc, …)`, `_generate_signals_batch_impl(driver, mongo, pc, …)`), so wiring the setting in requires **no mongo plumbing**.

### Why now

There is no settings/config storage anywhere in the backend today (confirmed: no settings collection, no config endpoint, no `*Settings` model). "Make it an admin setting" is therefore net-new infrastructure — a store, a read/write service, an admin read/write endpoint pair, and a UI control — not the flip of an existing toggle. This spec keeps that infrastructure minimal (one field) while structuring it to grow.

### Posture

MVP, 0 live users (per repo business state). Optimize for velocity. Reuse the existing `/admin` auth gate and singleton-document storage convention rather than introducing new mechanisms.

---

## Architecture

### 1. Storage — single settings singleton

Reuse the established singleton-document pattern in the `Org_Management` Mongo database, which already stores orgs and users as single map-documents (`{_id:"orgs"}`, `{_id:"users"}` — see `app/services/admin/orgs.py`). Add one more:

```json
{ "_id": "settings", "lead_fetch_limit": 500 }
```

- No migration (MVP, 0 users). If the document is absent, the read path returns the default (500).
- **Rejected alternatives:** a dedicated `app_settings` collection (heavier than a single global value needs) and per-org fields on the orgs doc (per-org scope was explicitly declined — one global value).

### 2. Model — `app/models/settings.py` (new)

```python
from pydantic import BaseModel, Field

class AppSettings(BaseModel):
    lead_fetch_limit: int = Field(500, ge=1, le=500)
```

- `500` is **both the default and the hard ceiling.** The ceiling matches the existing `PaginatedResponse` cap (`app/models/pagination.py:11`, `le=500`) and bounds the size of the single Claude call in the matched-leads map (see §Risks).
- A **new module** (not `app/models/admin.py`) so the signals services can import `AppSettings` without coupling to admin-only models. The field name is `lead_fetch_limit` (not `matched_leads_limit`) because it now governs signal-generation fetches as well as the matched-leads map — the broader name reads honestly.

### 3. Read/write service — `app/services/settings/` (new, neutral module)

A neutral module consumed by **both** the admin router and the signals services (signals must not import from `app/services/admin/`):

- `get_app_settings(mongo) -> AppSettings` — reads `{_id:"settings"}` from `Org_Management`; returns `AppSettings(**doc)` on hit, and the **default `AppSettings()`** when the document is missing or the read errors (safe fallback to 500 — a settings-store failure must never break signal generation).
- `update_app_settings(mongo, settings: AppSettings) -> AppSettings` — upserts the document (`{_id:"settings"}`), returns the stored value.

**Read strategy: read-on-request.** Each of the three call sites resolves the setting via one `_id` lookup per operation. This is negligible at MVP volume, and it means an admin edit takes effect on the very next request with **no cache to invalidate**. No in-memory cache (YAGNI); if these paths ever get hot enough to matter, a short-TTL cache is a localized follow-up.

### 4. Wiring the three call sites

At each site, resolve the limit from settings and pass it to `get_leads_for_org`:

- `lead_map.py` — remove the `_MAX_LEADS = 100` constant; in `build_signal_lead_map_claude`, `limit = (await get_app_settings(mongo)).lead_fetch_limit` and pass it where `_MAX_LEADS` was used (`:273`). Update the module docstring (currently says "≤100 leads").
- `search.py:221` and `batch.py:139` — replace the literal `limit=100` with the resolved `lead_fetch_limit` (both functions already have `mongo` in scope).

### 5. Admin API — extend `app/routers/admin.py`

Two endpoints added to the existing admin router, inheriting its router-level `Depends(require_admin)` gate (Firebase ID-token + `ADMIN_EMAILS` allowlist — see `app/core/auth.py`):

- `GET /admin/settings` → `AppSettings` — returns current settings (default when unset).
- `PUT /admin/settings` (body: `AppSettings`) → `AppSettings` — validates (Pydantic bounds enforce 1–500; out-of-range → 422), upserts, returns the stored value.

These endpoints serve **only** the admin UI. The signals services read the store directly via `get_app_settings`, not over HTTP.

### 6. Frontend — new admin Settings page

Follows the `src/features/admin/` conventions from spec 44 (barrel-exported `adminRoutes`, `<AdminGuard>`, shared `apiFetch` transport, zod contracts, TanStack Query, `components/ui`):

- **Page:** `src/features/admin/pages/SettingsPage.tsx` — loads the current value, renders a numeric input labeled "Lead fetch limit" (with a one-line helper: "Max leads fed into signal matching & generation per run") bounded 1–500, and a Save button. Client-side validation mirrors the server bound (1–500) with an inline error; disable Save while pending / unchanged / invalid.
- **Route:** `/admin/settings`, added to the admin `routes.tsx`, wrapped by the existing layout/guard.
- **Nav:** entry in `AdminLayout` alongside Tenants / Registrations / System Health.
- **Data layer:** `useAppSettings` (query) + `useUpdateAppSettings` (mutation, invalidates the query on success) hooks; `apiFetch` callsites in `services/admin.ts`; `AppSettings` zod contract (`z.object({ lead_fetch_limit: z.number().int().min(1).max(500) })`) in the feature `types.ts`.
- Success/failure surfaced via `sonner` toast, matching the feature's existing error handling.

---

## Sequencing (per repo rule)

Backend first: implement the store, model, endpoints, and call-site wiring; verify `GET`/`PUT /admin/settings` JSON shapes with a live `curl`/`/docs` call; then write the FE hooks + zod contract against the confirmed shape.

---

## Error handling

- `get_app_settings` never raises on a missing/malformed document or a Mongo read error — it falls back to the default so signal generation and the matched-leads map keep working.
- `PUT /admin/settings` rejects out-of-range values with 422 (Pydantic bounds); the FE mirrors the bound and shows an inline error before submit.
- FE `apiFetch` + zod parse failures → inline error + toast, per the admin feature's existing pattern.

---

## Testing

- **Backend (pytest in `backend/tests/`, patch-where-used per `backend/TESTING.md`):**
  - Settings store: returns the default `AppSettings()` when the doc is missing; upsert→read round-trip returns the stored value.
  - `GET /admin/settings`: 401 without token, 403 for a non-allowlisted email, 200 happy path (default when unset).
  - `PUT /admin/settings`: 200 on a valid value; 422 on out-of-range (`0`, `501`).
  - Call sites: with `get_app_settings` patched to a known value, assert `lead_map` / `search` / `batch` pass that value as the `limit` to `get_leads_for_org` (mock the fetch, assert the arg).
- **Frontend (vitest):** `SettingsPage` / hooks — load current value, save flow (mutation → query invalidation), and client-side validation (reject `0` / `501`, accept `500`).
- **Merge gate:** standard `npm run preflight` (frontend) green.

---

## Risks & known considerations (documented, not solved now)

1. **Bigger single Claude call in the matched-leads map.** `build_signal_lead_map_claude` sends newest-50 signals × ≤N leads in **one** Claude call. Going 100→500 is 5× the lead payload — higher token cost per call and possible dilution of match quality. Bounded by the 500 ceiling; **record a `docs/TECH_DEBT.md` entry** to monitor cost/quality and revisit with chunking (batch the leads across calls, merge the mapping) if it degrades. Not solving now (YAGNI at MVP).
2. **Signal-generation cost/latency.** `search.py` / `batch.py` fetching up to 500 leads increases downstream signal-generation work (larger pre-data payload). Acceptable at MVP volume; noted so implementers/operators aren't surprised.
3. **Allowlist reuse, no new authz.** The endpoints reuse the existing `require_admin` gate — no new auth surface. That gate's posture (Firebase token + hand-synced email allowlist) is unchanged and out of scope here.

---

## Out of scope (considered & cut)

| Cut | Why |
|---|---|
| Per-org limits | One global value was chosen; per-org adds a field-per-org + default-resolution and a per-org UI. Trigger: a customer needs a different cap. |
| Other tunables / a general settings framework | Ship one field. The store and `AppSettings` model can grow, but no speculative fields. |
| In-memory caching of settings | Read-on-request is correct and simple at MVP volume; add a TTL cache only if these paths get hot. |
| Chunking the matched-leads Claude call | Deferred to the TECH_DEBT trigger in Risks #1; not needed to ship the higher cap. |
| Raising the 500 ceiling further | 500 aligns with the `PaginatedResponse` cap and bounds the Claude call; a higher ceiling is a separate decision. |

---

## Success criteria

- The three hardcoded `100` lead-fetch caps are gone; all three sites resolve their limit from the shared setting, defaulting to 500.
- A Brewra staff member can, from `/admin/settings`, view and change the lead-fetch limit (1–500); the change takes effect on the next signal-generation / matched-leads request with no redeploy.
- Out-of-range values are rejected (422 server-side, inline error client-side); a settings-store failure falls back to the default without breaking signal work.
- `npm run preflight` is green; `GET`/`PUT /admin/settings` return verified shapes live.
