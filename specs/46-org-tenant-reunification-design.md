# Org / Tenant Reunification — Design Spec

**NN:** 46
**Date:** 2026-07-03
**Status:** Design intent (output of brainstorming). Frozen record — code is authoritative after merge.
**Origin:** RCA of the "Find Matched Leads / Lead Stream show no uploaded-CSV leads" report (tester Ishani, Firebase uid `A5BfxZtDTNau2mtgXhUwEXJyBQD3`, org "Brewra AI" `b75ce29e-…`). The Lead Stream half of that report was root-caused to a stale frontend `tenant` id diverging from the authoritative auth `org_id`.

---

## Overview

The frontend carries **two representations of one identity**: the authoritative backend **org** (`org_id`, returned by `GET /org`, the key every store partitions on) and a frontend **tenant** (`selectedTenant`, a `{id,name,domain}` object persisted in `localStorage`). They are *meant* to be equal (`tenant.id === org_id`), but nothing keeps them in sync, so they drift. When they drift, any surface that resolves org tenant-first queries the wrong (empty) org.

This spec **collapses the two into a single authoritative org**, sourced only from `GET /org`; **cleans up the data already stranded** by past divergence; and **enforces the true 1:1 user↔org model** at the backend so the divergence cannot recur.

The `tenant` abstraction has no real backend behind it — `GET /tenants` does not exist and the tenant-selection screen renders a hardcoded `MOCK_TENANTS` list (TD-FE-55). The backend model is, and always was, **one org per user** (`Org_Management.users.user_mappings`).

### The confirmed bug (evidence)

Ishani's browser held:
```
selectedTenant_A5BfxZtDTNau2mtgXhUwEXJyBQD3 = {"id":"brewra","name":"Brewra","domain":"brewra.com"}
```
`tenant.id` is the slug `"brewra"`, while her authoritative org is the UUID `b75ce29e-…`. The `domain:"brewra.com"` exactly matches the `${orgId}.com` template in `TenantContext.tsx:90`, proving the tenant was auto-built from her auth `orgId` *at a time when that org was the slug `"brewra"`* — then the backend re-keyed her org to the UUID and the frozen tenant never caught up.

Failure chain:
1. `TenantContext.tsx:67-84` loads the stored tenant. The reconcile check at line 72 (`orgName && parsedTenant.id === orgId`) is **false** (`"brewra" !== b75ce29e-…`), so line 78 keeps the stale value **uncorrected** — a stale tenant is stickier than no tenant (the self-heal branch at line 85 only runs when nothing is stored).
2. `LeadsTable.tsx:400` resolves `orgId = selectedTenant?.id ?? authOrgId ?? ""`. `"brewra"` is truthy, so `??` **short-circuits** and the correct `authOrgId` is never consulted.
3. Scout Lead Stream queries `org_id="brewra"` → her leads live under `b75ce29e-…` → **empty stream**. Profiler/Customers is auth-first, resolves the UUID, and shows all 396 — the exact asymmetry in the report.

Confirmed against live production: `GET /v2/leads?org_id=b75ce29e-…` returns her 396 market-scored leads. Backend healthy; the defect is FE org resolution + stranded historical data.

## Goals

1. **One org identity on the frontend.** Every surface resolves the org through a single `useOrgId()` hook backed by the authoritative auth org. No `selectedTenant?.id ?? authOrgId` chains anywhere.
2. **Authoritative, non-stale resolution.** A backend org re-key propagates to the client instead of being masked forever by a cached value.
3. **Recover stranded data.** Re-point leads/data tagged with a non-canonical `org_id` (e.g. Ishani's 197 `A5Bfx…` leads) onto the user's canonical org.
4. **Enforce 1:1 user↔org.** The backend guarantees each user has exactly one org and each org has exactly one user, and refuses the silent re-keying that strands data.

## Non-goals (explicitly out of scope)

- **Find-Matched-Leads 100→500 cap + admin Settings page.** Its own separate spec (NN 47+). It needs settings-store infrastructure + a new admin console page and is unrelated to org identity. *(This spec does not touch `lead_map.py`.)*
- **Multi-tenant / multi-org support.** Ruled out — the backend is one-org-per-user and there are 0 live users.
- **Broad `org_id` schema redesign.** The corrupt `…string` org is handled as targeted data cleanup only, not a schema migration.
- **Auth hardening.** The backend trusts client-supplied ids everywhere; consistent with MVP posture (0 users). We add *shape validation on the mapping write path* as defense-in-depth, nothing more.
- **100-cap product copy** ("shows signal-matched leads, not the full list") — noted as a follow-up, not built here.

## Architecture

Four workstreams. WS1+WS2 are the forward-fix (ship together, one FE change). WS3 is historical cleanup. WS4 locks the invariant.

### WS1 — Frontend collapse to a single `useOrgId()` (the core)

**New hook** `src/shared/auth/useOrgId.ts`, exported from `@/shared/auth`:
- Returns the org id resolved by `AuthContext` (authoritative per WS2). No tenant fallback, no `??` chain. Also exposes `orgName` where callers need it. Returns `null` until auth resolves.
- **`orgName` is not guaranteed.** `GET /org` returns `org_name` only when the `orgs.org_names` map has an entry (`OrgResponse.org_name` is `Optional`, model is `extra="allow"`). Display consumers (Header, ProfileDialog) must render `orgName ?? orgId` (or a neutral label) — never assume a name is present, and never block on it. Tightening `OrgResponse` itself is out of scope (deferred to the response-model debt pass).

There are **two classes** of `useTenant` consumer, and both must be handled for `shared/tenant` to be deletable. The complete consumer inventory (verified by grep on 2026-07-03):

**(a) Org-resolution sites** — repoint to `useOrgId()`:

| File | Line(s) | Today | After |
|---|---|---|---|
| `features/market-research/components/lead-stream/LeadsTable.tsx` | 376, 377, 400, 411, 582 | `selectedTenant?.id ?? authOrgId ?? ""` (tenant-first — the bug) | `useOrgId()` |
| `features/customers/components/lead-stream/LeadStream.tsx` | 32, 44, 47 | `orgIdProp ?? selectedTenant?.id ?? authOrgId ?? null` | `orgIdProp ?? useOrgId()` |
| `features/signals/pages/SignalsPage.tsx` | 43, 50, 58 | `authOrgId ?? selectedTenant?.id ?? null` (already auth-first) | `useOrgId()` (consistency) |
| `shared/auth/useAuthToken.ts` | 6, 10, 20 | `generateToken(user, selectedTenant.id)` | pass the resolved org id (token is not backend-validated; cosmetic, but keep consistent) |

**(b) Tenant lifecycle / display consumers** — these carry *behavior*, not just resolution, and are the ones easy to miss:

| File | Line(s) | Uses | After |
|---|---|---|---|
| `features/shell/components/Header.tsx` | 35, 54 | `selectedTenant` (displays org name/domain) | display `orgName` from auth / `useOrgId()` |
| `features/shell/components/ProfileDialog.tsx` | 3, 14 | `selectedTenant` (displays org) | display `orgName` from auth |
| `features/shell/components/Sidebar.tsx` | 339, 360 | `clearTenant()` on logout | remove — logout already clears auth/org state |
| `features/auth/hooks/useLogin.ts` | 5, 12 | `selectTenant()` after login | remove — org now resolved from `GET /org`, not set at login |
| `features/shell/ProtectedRoute.tsx` | 5, 14 | `selectedTenant`, `loading`, `selectTenant` (the post-login gate) | remove the gate (login → app directly) |
| `App.tsx` | 12, 22, 38 | `<TenantProvider>` wrapper | remove from the tree |
| `features/tenant/pages/TenantSelectionPage.tsx` | 10, 11, 14 | `selectTenant`, `clearTenant`, `Tenant` | file deleted (below) |

> `features/admin` was verified to have **no** dependency on `shared/tenant` (its "Tenants" UI label is unrelated), so it is untouched. Success criterion #2's `grep selectedTenant → 0` is the completeness check for this inventory.

**Delete the tenant abstraction:**
- `src/shared/tenant/TenantContext.tsx` and `src/shared/tenant/index.ts`
- `<TenantProvider>` wrapper from the app tree (its mount site)
- `src/features/tenant/*` — `TenantSelectionPage`, `useTenants`/`MOCK_TENANTS`, `routes.tsx`, tests
- The `/tenant-selection` route registration in `App.tsx`
- The post-login tenant gate in `features/shell/ProtectedRoute.tsx` (login → app directly). *Confirm the exact gate condition at plan time and repoint any redirect that targeted `/tenant-selection`.*

**Stale-localStorage handling:**
- The new resolver ignores `selectedTenant_*` entirely, so Ishani (and everyone) is fixed on next load with **no cleanup required**.
- Add a **one-time idempotent sweep** on app init that enumerates `localStorage` keys and removes any matching the `selectedTenant_` prefix, so no dead state lingers. This module is the *only* place the `selectedTenant` literal survives (see success criterion #2). (The `org_id_*` / `org_name_*` auth-cache keys are retained — they belong to WS2.)

**Admin console note:** `features/admin` labels orgs as "Tenants" in the UI (`TenantsOverviewPage`, `OrgDetailPage`). That is an internal-ops display label, not the `shared/tenant` abstraction — it is **out of scope** for renaming here (avoid scope creep); leave it.

### WS2 — `GET /org` authoritative on the frontend (anti-stale)

`AuthContext.fetchOrgId` (`shared/auth/AuthContext.tsx:65-113`) currently **returns the cached `org_id_<uid>` without calling the backend** when a cache exists (lines 71-75), and the `onAuthStateChanged` path also prefers the cache (lines 121-126). A re-keyed org therefore never refreshes.

**Change:** on auth-state resolution, **always call `GET /org`** and treat its response as authoritative:
- Overwrite `org_id_<uid>` / `org_name_<uid>` cache with the fresh values.
- Use the cached value only as an *optimistic* value while the request is in flight, and as a *fallback* if the request fails (offline / backend cold-start).
- On a genuine mismatch (cache ≠ fresh), the fresh value wins and the cache is corrected.

**First paint must not block on `GET /org`.** Render off the optimistic cached org immediately; the authoritative fetch reconciles in the background. The mandatory `GET /org` sits on the auth path and shares the 30 req/min client limiter, so a Render cold-start must never gate initial render.

**Invalidation cascade (already load-bearing, made explicit):** org-scoped TanStack Query keys already embed the resolved org (`qk.leads(orgId)`, `qk.marketResearchComponent(orgId, componentName)`, `qk.signalLeadMap(orgId, userId)`, `qk.icps(orgId)`, …). Because `useOrgId()` feeds those keys, when a stale→fresh org flip occurs the `queryKey` changes and React Query refetches under the new key automatically; the stale-key entry becomes unsubscribed (not rendered). No separate invalidation call is required — the org-in-key design *is* the cascade. The only visible artifact is a brief transient render off the optimistic cache before the fresh org resolves.

This is the mechanism that guarantees WS1's single resolver is also *correct*, not just *singular*.

### WS3 — Data reconciliation (dry-run-first Render script)

The sandbox cannot reach the production Neo4j/Mongo (HTTP-only egress; `mongodb+srv` unresolvable). Reconciliation therefore ships as a **script the operator runs in the Render shell**, in two modes:

**`--report` (default, read-only):**
- Load `Org_Management.users.user_mappings` (authoritative user→org) and `orgs.org_list` / `org_names`.
- Canonical org for a user = their mapped org.
- For each user, scan the data stores for records tagged with an `org_id` that is **not** their canonical org, and emit a per-user migration plan (counts per store).
- **Classify ambiguous cases for manual decision, do not guess:** (a) a user whose *mapping itself* points to a uid-shaped / non-UUID / `…string` org; (b) an `org_id` holding data but mapped to no user; (c) the corrupt `…string` org.
- Writes nothing.

**`--apply` (explicit flag):**
- For the reviewed/approved users, re-point `org_id` across every store that partitions on it:
  - **Neo4j** — `:Lead`, `:Company`, `:Contact`, `:Activity`, `:ICP`, `:Campaign`, `:GTM_Strategy` (any node carrying `org_id`).
  - **MongoDB** — Market Intelligence reports, Lead Market Scores, Signals, File Processing Status, Customer Profiles (across `Scout_Agent` / `Profiler`).
  - **Pinecone** — vectors are namespaced by `org_id`, and Pinecone namespaces **cannot be renamed**. Reconcile by **copy-by-id**: fetch each vector from the source (non-canonical) namespace and `upsert` it into the canonical namespace under the *same id*, then delete the source namespace. Upsert-by-id is idempotent (a re-run overwrites in place, no duplication), which is how WS3's idempotency claim holds for this store. Re-embedding from the S3 source docs is the **fallback only** when source vectors aren't fetchable (it costs embedding-API calls). `--report` must **quantify vector counts per source namespace** so the Pinecone cost is concrete before `--apply`, not "surfaced."
- **Idempotent** (re-running does nothing once a user is canonical), **per-user**, and **logged** (before/after counts).

**Canonicalization rule:** prefer the user's mapped UUID org. Where the mapping itself is non-canonical, the report surfaces it and the operator decides per-case (re-map to a real UUID org, minting one via `create_org` if none exists) — never auto-guessed in code.

**What `--report` looks for (discovery, not a fixed list):** it flags *any* record whose `org_id` ≠ the user's canonical org — it does not hunt for specific known ids. That matters because the seed incident alone involves **three distinct non-canonical org-ids**, and the empty-stream symptom and the data-stranding have *different* remediations:

| Non-canonical org-id | What it is | Remediation |
|---|---|---|
| `"brewra"` (slug) | The stale `tenant.id` Ishani's browser resolved; may or may not have data written under it during the window her auth org was the slug. | **WS1** fixes the user-facing empty-stream symptom (resolution no longer reads it). WS3 `--report` still scans for any data tagged `org_id="brewra"` and re-points it if present. |
| `A5BfxZtDTNau2mtgXhUwEXJyBQD3` (uid) | Legacy uid-as-org; **197 `:Lead` nodes** stranded here. | **WS3** re-points → `b75ce29e-…`. |
| `…string` (corrupt) | Malformed org value from an unvalidated write. | **WS3** manual per-case; **WS4** shape-validation blocks recurrence. |

The **396 leads under `b75ce29e-…`** are her canonical org (already correct, no move) and the **197 under `A5Bfx…`** are the stranded set (a different org-id tag, not a subset) — WS3 leaves the 396 untouched and migrates the 197.

The script lives under `backend/scripts/` (read-only-by-default, same convention as the removed diagnostics) and is **removed from the repo after the migration is applied and verified** (like the RCA diagnostics), or retained if we want it as a recurring maintenance tool — decided at merge.

### WS4 — Bijective 1:1 user↔org + `connect_user_to_org` hardening (backend)

`connect_user_to_org` (`app/services/org_auth/orgs.py:113`) has two holes: it never checks **reverse-uniqueness** (two users could map to one org) and it **silently overwrites** a user's existing org (the re-key that strands data). Harden it to enforce the invariant:

- **Reverse-uniqueness:** reject connecting a user to an org already owned by a *different* user (→ "an org has exactly one user"). Since `user_mappings` is a single doc, this is an in-memory scan of its values — fine at this scale.
- **No silent re-key:** if the user is already mapped to a *different* org, reject unless an explicit `migrate=True` flag is passed. **`migrate` is a service-function parameter, not an API field** — it is invoked only by the WS3 reconciliation script running in-process on Render (which calls the hardened Python fn directly). The public `POST /connect_org` (`app/routers/org_auth.py:24`) keeps its `user_id` + `org_id`-only body and always takes the strict default (reject re-key); no router/schema change, no client-reachable silent-rekey path. When WS3 must change a user→org mapping, it goes **through this hardened fn with `migrate=True`**, never a raw `user_mappings` write — so every mapping mutation honors the invariant.
- **Org-id shape validation:** require the `org_id` to be a UUID present in `orgs.org_list`; reject uid-shaped / garbage (`…string`) values at the mapping-write layer. Defense-in-depth against the very inputs that created the fragmentation.
- **Registration unaffected:** new-user signup (`create_org` → fresh UUID, then `connect_user_to_org` for a brand-new uid) satisfies all three checks by construction.

All three checks are **deliberate**, not defense-in-depth gold-plating: reverse-uniqueness and no-silent-rekey directly implement the explicit bijective-1:1 requirement ("a user has exactly one org, an org has exactly one user"), and no-silent-rekey is the specific guard against the re-key stranding this spec exists to fix. Shape-validation alone would satisfy neither half of the invariant. They are cheap (in-memory checks on a single Mongo doc) and ship together.

Enforcement is turned on **after** WS3 cleanup (see Sequencing) so existing violations don't wedge legitimate operations mid-migration.

## Data flow (after)

```
Firebase auth  ──▶ AuthContext (onAuthStateChanged)
                     │  always GET /org?user_id=<uid>   (WS2: authoritative)
                     ▼
               orgId / orgName  (cache = optimistic/fallback only)
                     │
                     ▼
                useOrgId()   ◀── single resolver (WS1)
                     │
      ┌──────────────┼───────────────┐
      ▼              ▼                ▼
  LeadsTable    LeadStream        SignalsPage      … every org-scoped read
  (Scout)       (Customers)       (Signals)
      │              │                │
      ▼              ▼                ▼
  /v2/leads?org_id=<canonical org>   ← always the authoritative org
```

## Sequencing & dependencies

1. **WS3 `--report`** — see the real fragmentation before changing anything.
2. **WS1 + WS2** — ship together as one FE change. This is the forward-fix: stops *new* stranding immediately and unblocks Ishani (and anyone with a stale tenant) on next load.
3. **WS3 `--apply`** — clean up historical strands after the report is reviewed and approved.
4. **WS4 enforcement** — lock the invariant once data is clean.

WS4 depends on WS3 (can't enforce reverse-uniqueness while duplicates exist). WS1 depends on WS2 for correctness but they merge as one unit. WS3 is independent of the FE change and can begin as soon as the report is trusted.

## Testing

**Frontend (`npm run preflight` must be green):**
- `useOrgId()` unit tests: returns auth org when resolved; returns `null` before resolution; never falls back to a tenant value.
- **WS2 re-key propagation (the headline guarantee, SC#3):** plant a stale `org_id_<uid>` cache, resolve auth, and assert `AuthContext` calls `GET /org` and the fresh org **overwrites** the stale cache. Pair it with an assertion that org-scoped query keys re-key on the stale→fresh flip (so downstream queries refetch under the new org) — this is the distinction between a *singular* and a *correct* resolver.
- `LeadsTable` / `LeadStream` regression: assert the query uses the auth org and that a planted stale `selectedTenant_*` key has **no** effect on the resolved org.
- Init sweep test: `selectedTenant_`-prefixed keys are removed; `org_id_*` / `org_name_*` retained.
- Remove/replace tenant-selection + `useTenants` tests; ensure routing tests reflect the removed `/tenant-selection` step.

**Backend (pytest under `backend/tests/`, patch-where-used per `backend/TESTING.md`):**
- `connect_user_to_org`: reject reverse-uniqueness violation; reject re-key without `migrate`; allow re-key with `migrate`; reject non-UUID / `…string` org; happy-path new user.
- Reconciliation script: dry-run `--report` against a seeded fixture (stranded uid-org + one canonical UUID org) produces the correct plan and writes nothing; `--apply` re-points and is idempotent on re-run.

## Error handling

- **WS2:** if `GET /org` fails (offline, cold-start, 404), fall back to the cached org and surface no hard error — the app must not brick when the org lookup is briefly unavailable. Never overwrite a good cache with an empty/failed response.
- **WS4:** rejections return a clear, structured error (which invariant failed) so the caller/admin understands why; they are 4xx (client/data error), not 5xx.
- **WS3:** `--apply` is transactional per user where the store allows; on partial failure it logs exactly which store/user was left mid-migration so a re-run (idempotent) completes it.

## Risks & rollback

- **WS3 `--apply` is the only destructive step.** Mitigated by report-first review, idempotent per-user application, and full before/after logging. A mis-repoint is itself re-pointable (org_id is just a property/namespace).
- **WS1 provider removal** touches routing and the app tree — regressions caught by `preflight` (typecheck + Playwright e2e). Fully reversible via git.
- **WS4 enforcement** sits behind the WS3 cleanup gate, so it cannot reject legitimate live users.
- **Pinecone re-namespacing** may carry an embedding cost / latency; the report quantifies affected vectors before `--apply` so there are no surprises.

## Cleanup / TECH_DEBT

- **Retire TD-FE-55** (mock `useTenants`) on WS1 merge — the tenant-selection feature and its mock are deleted, resolving the open product question in favor of single-org.
- Note the **TD-FE-1 / TD-FE-12** lineage (tenant-selection orphan-route / dead `availableTenants`) — this collapse removes the surface those debts described.
- If the reconciliation script is not retained as a maintenance tool, remove it post-verification (same hygiene as the removed RCA diagnostics).

## Success criteria

1. A stale/mismatched `selectedTenant_*` value in a user's browser has **no effect** on any org-scoped query; every surface resolves the authoritative org. (Ishani's Scout Lead Stream shows her CSV leads without any manual localStorage edit.)
2. No `useTenant` / `selectedTenant?.id` **resolution or usage sites** remain in `frontend/src` outside the one-time init-sweep module (and its test); `shared/tenant` and `features/tenant` are deleted; `/tenant-selection` no longer exists. (The sweep iterates `localStorage` keys by the `selectedTenant_` prefix, so the literal token appears only there — not in any product resolution path. A bare `grep selectedTenant` is therefore expected to match only the sweep module + tests, not zero.)
3. A backend org re-key is reflected in the client on next load (WS2 verified: cache no longer masks a changed `GET /org`).
4. The reconciliation `--report` produces an accurate, reviewable plan; after `--apply`, every user's data is under their canonical org (Ishani: 0 leads left under `A5Bfx…`).
5. `connect_user_to_org` rejects reverse-uniqueness violations, silent re-keys, and non-UUID orgs; new-user registration is unaffected.
6. `npm run preflight` green; backend pytest green.

## Open questions

None outstanding — resolved during brainstorming:
- Target model → **collapse to single org** (Approach A).
- `/tenant-selection` → **removed**, login goes straight into the app.
- Scope → FE resolution + collapse, anti-stale, data reconciliation, bijective 1:1 (all four); **100-cap + admin Settings page split to a separate spec**.
- "admin panel" (in the split-out spec) → the **FE admin console** (`features/admin`, Plan 44), not the legacy static HTML.
