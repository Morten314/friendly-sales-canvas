# `admin` feature — internal ops console

## Purpose

Brewra-internal operations console (spec 44). Replaces the legacy
`backend/admin_panel.html` + `registration_admin_panel.html`. Operated by
Brewra staff, not customers.

## Public surface

Re-exported from `index.ts`:

- `adminRoutes` — `/admin/*` routes (lazy/code-split, gated by `AdminGuard`).

## Access

`AdminGuard` (`guards/AdminGuard.tsx`) checks `useAuth().currentUser.email`
against `adminAllowlist.ts` and controls UI access (redirect). The two new
`/admin/*` endpoints are **also enforced server-side**: the FE attaches the
caller's Firebase ID token on those calls, and the backend verifies it
(`backend/app/core/auth.py`, `require_admin`) and returns 403 unless the
verified email is on the backend operator allowlist — so for those endpoints the
guard is a real boundary, not cosmetic. The reused parity/inspection endpoints
(`/org`, `/v2/leads`, …) remain open per the global backend posture. Roster
changes touch **both** allowlists (FE `adminAllowlist.ts` + BE `auth.ADMIN_EMAILS`); a push to `master` auto-deploys both (Vercel + Render).

## Key files

- `pages/` — TenantsOverview, OrgDetail (inspection tabs), Registrations, SystemHealth
- `services/admin.ts`, `hooks/`, `types.ts` (zod contracts)
- `components/AdminLayout.tsx`, `routes.tsx`

## Backend

- `GET /admin/orgs`, `GET /admin/health` (new, `app/routers/admin.py`).
- Reuses `/org`, `/connect_org`, `GET /api/v2/registration`, `POST /registration`,
  `/profile/company`, `/customer_profile`, `GET /api/v2/leads`, `GET /api/v2/user-documents`.

## Scope notes

- Org/user **write** actions (create org, connect user→org, lookup) live on
  the Tenants overview toolbar.
- Inspection tabs: Company Profile, Customer Profiles, Leads, Documents. A
  separate Data Sources tab is omitted — the org's uploaded documents (its data
  sources) are already listed in the Documents tab via
  `GET /api/v2/user-documents?org_id=`; `data_sources.py` otherwise exposes only
  upload/status/delete, no further org-scoped _list_.
