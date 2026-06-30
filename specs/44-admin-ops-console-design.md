# Internal Ops Console — Design Spec

**NN:** 44
**Date:** 2026-06-30
**Status:** Design intent (output of brainstorming). Frozen record — code is authoritative after merge.
**Supersedes:** `docs/temp/2026-05-19-panels-mvp-design.md` (the pre-monorepo, pre-refactor "Panels MVP" spec — obsolete integration model).

---

## Overview

A Brewra-internal **operations console** that replaces the two crude standalone HTML tools (`backend/admin_panel.html`, `backend/registration_admin_panel.html`) with a proper React feature integrated into the PWA. It is an **internal ops tool** — operated by Brewra staff, not by customers.

It is **not** the three-panel product the superseded doc imagined: there is no tenant-admin self-service panel (the existing `features/settings` covers that), no onboarding/Stripe flow, no Firebase custom-claims role system, and no feature-flag or agent-config subsystem. Those were considered and explicitly cut to keep scope bounded at MVP.

### Audience & purpose

| | |
|---|---|
| **Who** | Brewra staff (internal ops). |
| **Why** | Inspect and lightly manage tenant/org data, manage signup registrations, and see system health — without hand-editing Mongo or running the legacy HTML tools. |
| **Posture** | MVP, 0 live users. Optimize for velocity. Security/authz is explicitly out of scope (see §7). |

### Capability scope

| ID | Capability | Backend status |
|---|---|---|
| A | Org & user management — look up org by user, create org, connect user↔org | **Exists** (`/org`, `/connect_org`) |
| B | Tenant data inspection (read-only) — company profile, customer profiles, lead stream, data sources, documents | **Exists** (reuse) |
| C | Registration / waitlist management — list, add, export | **Exists** — list via `GET /api/v2/registration` (paginated envelope), create via `POST /registration` |
| D1 | Tenants overview — table of all orgs with key fields | **New** (`GET /admin/orgs`) |
| D2 | System health panel — Mongo / Neo4j / Pinecone / LLM status | **New** (`GET /admin/health`) |

Out of scope (considered, cut): feature flags, agent config view/edit, tenant-admin self-service, onboarding/billing, any role system. See §9.

---

## Architecture

### Integration model

The frontend is per-feature. A new feature module `src/features/admin/` exports an `adminRoutes` array from its barrel; `src/app/routes.tsx` spreads it (one added line — the append-only registry). All pages are `React.lazy()`-loaded so the ops console is **code-split** and never enters the normal customer bundle.

The console reuses existing shared infrastructure — `shared/auth` (`useAuth`), `shared/api` transport (`apiFetch`), zod contracts, TanStack Query, and `components/ui` (shadcn) — and introduces no parallel auth/transport stack.

### Backend organization (decided: dedicated admin router)

The two new read-only endpoints live in a dedicated `app/routers/admin.py` + `app/services/admin/`, mounted with `prefix="/admin"`:

- `GET /admin/orgs` — list all orgs.
- `GET /admin/health` — aggregate connectivity + LLM probe.

Rationale: keeps the internal-only surface in one place, mirrors the FE feature boundary, and is trivial to find/remove. Parity capabilities (A, B, C) keep calling their existing domain endpoints — **no new backend there**.

### Frontend directory structure

```
src/features/admin/
├── index.ts                 # exports adminRoutes
├── routes.tsx               # /admin/* routes; lazy pages wrapped in <AdminGuard>
├── adminAllowlist.ts        # ADMIN_EMAILS — Brewra staff email set
├── guards/
│   └── AdminGuard.tsx       # email-allowlist gate
├── components/
│   └── AdminLayout.tsx      # sidebar nav + header (shadcn/ui)
├── pages/
│   ├── TenantsOverviewPage.tsx   # D1
│   ├── OrgDetailPage.tsx         # A + B
│   ├── RegistrationsPage.tsx     # C
│   └── SystemHealthPage.tsx      # D2
├── hooks/                   # TanStack Query hooks (one per data source)
├── services/                # apiFetch callsites
├── types.ts                 # zod contracts + inferred types
└── README.md                # feature conventions (per repo pattern)
```

### Routing map

| Route | Page | Capability |
|---|---|---|
| `/admin` | redirect → `/admin/tenants` | — |
| `/admin/tenants` | `TenantsOverviewPage` | D1 |
| `/admin/tenants/:orgId` | `OrgDetailPage` (tabs) | A + B |
| `/admin/registrations` | `RegistrationsPage` | C |
| `/admin/health` | `SystemHealthPage` | D2 |

All wrapped by `<AdminGuard>` via the layout.

---

## Access guard

`AdminGuard` is the single gate for `/admin/*`:

| State | Action |
|---|---|
| Auth loading | Spinner |
| Unauthenticated | Redirect to `/` |
| Authenticated, email **not** in `ADMIN_EMAILS` | Redirect to `/` |
| Authenticated, email in `ADMIN_EMAILS` | Render children |

`ADMIN_EMAILS` is a hardcoded set in `adminAllowlist.ts` (Brewra staff). The check reads `useAuth().user?.email`. Changing the roster (add/remove an operator) is therefore a code change + frontend redeploy. A `VITE_*` env var would **not** avoid this — Vite inlines env vars at build time, so it still requires a rebuild/redeploy — so the only true no-redeploy option is the deferred backend-served allowlist noted below.

**This is not a security boundary.** The backend does not validate auth and continues to trust client-supplied `org_id`/`user_id`; the admin data endpoints stay open. The guard only prevents a logged-in customer from *accidentally* landing on the console. This is an accepted MVP trade-off (record as a TECH_DEBT entry — promote to a real backend allowlist when there are live users).

---

## Capabilities & data flow

### D1 — Tenants overview
- `GET /admin/orgs` reads the single Mongo `{_id:"orgs"}` document and returns an array of org records (`org_id`, `org_name`, plus whatever the map carries).
- Searchable/sortable table. Row click → `/admin/tenants/:orgId`.

### A + B — Org Detail
One page, tabbed.
- **Management actions (writes — parity):**
  - Create org → `POST /org`
  - Connect user↔org → `POST /connect_org`
  - Look up org by user → `GET /org?user_id=`
- **Inspection tabs (read-only — reuse existing endpoints):**
  - Company Profile → `GET /profile/company?org_id=`
  - Customer Profiles → `GET /customer_profile?org_id=`
  - Lead Stream → `GET /leads?user_id=`. The org→user(s) mapping (single users doc) resolves the org's user(s); if an org maps to multiple users, the tab issues one `/leads?user_id=` call per user and concatenates client-side. Many-user orgs are an accepted MVP limitation (no server-side org-keyed union); revisit if an org-scoped leads variant is preferred. See §8 quirk #2.
  - Data Sources → existing data-sources endpoint (`?org_id=`)
  - Documents → `GET /user-documents?org_id=`

No new destructive actions (no delete/suspend) — parity writes only.

### C — Registrations
- **List:** `GET /api/v2/registration` — the paginated successor. Returns a `PaginatedResponse[RegistrationResponse]` envelope (`items` / `total` / `limit` / `offset`; `limit` 1–500, default 50), sorted by `timestamp` desc. Do **not** target v1 `GET /registration`: it is marked `Deprecation: true`, takes no `limit`/`offset`, and silently caps at 500 rows. `RegistrationResponse` = `{id, name, email, timestamp}`; the FE zod contract matches these four fields exactly (no `extra` passthrough — unlike `OrgResponse`).
- **Add:** `POST /registration` (`RegistrationRequest` = `{name, email}`).
- **Export:** client-side CSV of the **currently loaded page** (export-current-view). The table pages through the v2 envelope, so the operator can step through all rows; the CSV reflects the visible page. Whole-dataset server-side export is out of scope (§9).

### D2 — System health
- `GET /admin/health` aggregates: Mongo ping, Neo4j ping, Pinecone reachability, and `probe_llm` (reused from `app/services/health.py`). Returns per-dependency `{name, status, detail/latency}`.
- `probe_llm(llm2)` requires an LLM model object — inject it via `Depends(get_llm2)` (the same dependency `pipeline.py`'s `test_llm` uses), so the probe reflects the LLM the product actually runs (currently `Qwen/Qwen3-235B-A22B-Instruct-2507-tput`), not an arbitrary one.
- Each probe runs under a per-probe timeout (e.g. `asyncio.wait_for`) so an up-but-slow dependency surfaces as a red/degraded badge rather than hanging the aggregate request — try/except alone guards raised errors, not latency.
- Panel of status badges. A failed or timed-out probe renders red — it never throws the page.

---

## Backend additions (the only new backend work)

1. **`GET /admin/orgs`** — `admin` router + `admin` service. Reads the single `{_id:"orgs"}` document and returns its org entries as a list. The document is a map whose value shape is not formally typed in the codebase, so: (a) confirm the actual value fields live (`curl`/`/docs`) before fixing the contract — per the sequencing rule below; (b) the `response_model` is tolerant — model the known fields (`org_id`, `org_name`) and allow extras, mirroring `OrgResponse`'s `extra="allow"`; (c) the endpoint returns **all** orgs in one unpaginated single-doc read — acceptable at MVP scale, stated here as an explicit assumption to revisit if the org count grows large.
2. **`GET /admin/health`** — aggregate probe. Reuses `probe_llm` (inject the model via `Depends(get_llm2)`); adds lightweight Mongo/Neo4j/Pinecone connectivity checks. Each check is independently guarded **and** wrapped in a per-probe timeout (`asyncio.wait_for`), so a dependency that is down *or* up-but-slow surfaces as a red/degraded badge without failing or hanging the whole response.

Sequencing (per repo rule): build the endpoint, verify the JSON shape with a live `curl`/`/docs` call, then write the FE hook + zod contract against the confirmed shape.

---

## Error handling

- `apiFetch` + zod parse failures → inline error state + `sonner` toast.
- Empty states for orgs with no data in a given inspection tab.
- Health probe failures render as red status badges, not page crashes.
- `AdminGuard` owns the loading and unauthorized paths.

---

## Testing

- **Frontend (vitest):**
  - `AdminGuard` — allow / deny / loading / unauthenticated.
  - Hooks — zod contract parses the real response shape.
  - Tenants table — search/filter behavior.
  - Optional Playwright smoke: `/admin` guard redirect for a non-allowlisted user.
- **Backend (pytest, patch-where-used per `backend/TESTING.md`):**
  - `GET /admin/orgs` — list shape from the single-document store.
  - `GET /admin/health` — aggregate shape; one-dependency-down does not 500.
- Merge gate: standard `npm run preflight` (frontend) green.

---

## Cleanup

After parity is verified live, **delete** `backend/admin_panel.html` and `backend/registration_admin_panel.html`. A grep found no FastAPI code serving them (no `FileResponse`/`StaticFiles`); confirm during implementation, then remove the files.

---

## Notable quirks (recorded so implementers aren't surprised)

1. **Single-document storage.** Orgs and users are each one Mongo document holding a map (`{_id:"orgs"}`, `{_id:"users"}`), not per-row collections. `GET /admin/orgs` reads that one doc; it does not query a collection of org documents.
2. **`/leads` is keyed by `user_id`**, while inspection is org-centric. Org Detail resolves the org's user(s) from the orgs/users mapping before calling `/leads`.
3. **No authz.** The allowlist is cosmetic; data endpoints remain open. Tracked as accepted debt.
4. **`OrgResponse` is loosely typed** (`extra="allow"`, all-optional fields). The FE zod contract should be tolerant (parse known fields, passthrough/ignore extras).

---

## Out of scope (considered & cut)

| Cut | Why |
|---|---|
| Tenant-admin self-service panel | `features/settings` already covers org-admin self-service. |
| Onboarding / Stripe plan-selection | Premature pre-launch; no billing need at 0 users. |
| Firebase custom-claims role system (`super_admin`/`tenant_admin`) | Never built; not needed for a cosmetic internal gate. |
| Feature flags (global + per-tenant) | Whole new subsystem; repo guidance says skip flags absent a real kill-switch/A-B need. |
| Agent config view/edit | Net-new write surface; low MVP value. |
| New destructive actions (delete/suspend org/user) | Beyond parity; not requested. |
| Whole-dataset (server-side) registration export | Export is current-view only; a full-export endpoint is net-new and unneeded at current registration volume. Trigger: registrations exceed what paging comfortably covers. |

---

## Success criteria

- Brewra staff can, from `/admin`: see all orgs, open one and inspect its company profile / customer profiles / leads / data sources / documents, create an org, connect a user to an org, manage registrations (list/add/export), and view system health.
- A non-allowlisted logged-in user hitting `/admin/*` is redirected away.
- The two legacy HTML tools are removed with no loss of capability.
- `npm run preflight` is green; the two new backend endpoints return verified shapes live.
