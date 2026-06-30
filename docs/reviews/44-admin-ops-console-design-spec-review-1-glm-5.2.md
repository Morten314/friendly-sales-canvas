---
artifact: specs/44-admin-ops-console-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-29
round: 1
---

## Context

Review performed against the live codebase (claims spot-checked against `backend/app/routers/org_auth.py`, `app/routers/v2/org_auth.py`, `app/services/org_auth/orgs.py`, `app/services/health.py`, `app/models/org_auth.py`, and a grep for `FileResponse`/`StaticModels` serving the legacy HTML tools). Most factual claims hold; the registration-endpoint claim does not (see findings). The spec is notably well-bounded — no overengineering detected; scope is cut aggressively and explicitly (§9). Findings below are about correctness/under-specification against actual code, not scope creep.

## Findings

### [High] Registration pagination cites the wrong endpoint — v1 `/registration` is deprecated and silently capped, not skip/limit paginated

**Location:** §"Capabilities & data flow" → "C — Registrations", line 130: *"`GET /registration` (already paginated server-side: `count_document` + `skip`/`limit`, sorted by `timestamp` desc)"*; also §"Notable quirks" and the capability table line 30 ("Exists (`GET`/`POST /registration`)").

The described `count_document + skip/limit` pagination does not exist on the endpoint cited. `GET /registration` (v1, `app/routers/org_auth.py:40`) is explicitly marked **deprecated** (`Deprecation: true` header, `Link` to its successor), reads from the separate `Registration_DB`, and silently caps at 500 with **no** `skip`/`limit` surface. The skip/limit + total pagination the spec describes is the **v2** endpoint `GET /api/v2/registration` (`app/routers/v2/org_auth.py:12`, calls `list_registrations(mongo, limit=, offset=)`), which the spec never mentions.

This matters for an *ops* console whose registration list can grow without bound: a capped v1 list silently truncates the admin view past 500 rows, the export (line 132, "client-side CSV download of the loaded rows") would silently export a truncated page, and the spec builds an expectation (server pagination) the cited endpoint does not honor. Recommend: target `GET /api/v2/registration` for the Registrations list + export, and reconcile the capability-table/backend-status cell and the §"Notable quirks" pagination note accordingly. (Also note `RegistrationResponse` lacks the `extra="allow"` leniency OrgResponse has — fine for export since the fields are fixed, but the FE zod contract should match `{id, name, email, timestamp}` exactly, not copy OrgResponse's passthrough pattern.)

### [Medium] `probe_llm` reuse leaves the LLM-model dependency wiring unspecified

**Location:** §"Capabilities & data flow" → "D2 — System health", line 135; §"Backend additions" item 2, line 143.

`probe_llm` (`app/services/health.py:5`) takes an `llm2` LangChain model object as a required argument — it does not construct one. The existing caller (`app/routers/pipeline.py:25`) injects it via a `Depends(...)`. The spec says "reuses `probe_llm`" but never states how `/admin/health` obtains that model dependency, nor which model. Given the recent Groq→Qwen retirement (every path moved to `Qwen/Qwen3-235B-A22B-Instruct-2507-tput`), the implementer needs to know which LLM to probe and how to inject it. Specify the dependency source (and consider that the health probe should reflect the LLM the product actually uses, not an arbitrary one).

### [Medium] Health "each check independently guarded" guards against errors, not timeouts

**Location:** §"Backend additions" item 2, line 143 ("Each check is independently guarded so one dependency being down doesn't fail the whole response"); §"Capabilities & data flow" → "D2", line 136; §"Error handling", line 153.

A hanging Neo4j/Mongo/Pinecone TCP connect or an unresponsive LLM invoke will stall the aggregate `/admin/health` request regardless of try/except guarding, because the guard is against raised errors, not latency. For a *system-health* panel this is the most likely real failure mode (a dependency that is up-but-slow rather than down). Specify a per-probe timeout (e.g. asyncio `wait_for`) so a degraded dependency surfaces as a red badge rather than a hung page. As written, the non-functional requirement "a failed probe renders red — it never throws the page" is satisfied for exceptions but not for hangs.

### [Medium] `/admin/orgs` response shape is under-specified — the orgs document's internal structure is never documented

**Location:** §"Capabilities & data flow" → "D1 — Tenants overview", line 111 ("returns an array of org records (`org_id`, `org_name`, plus whatever the map carries)"); §"Backend additions" item 1, line 142 ("Annotate with a `response_model`").

`GET /admin/orgs` reads the single `{_id:"orgs"}` document (`app/services/org_auth/orgs.py:33`) — but that document is a map whose value shape is never described in the spec, and the response is deliberately left open ("plus whatever the map carries"). The implementer is expected to reverse-engineer the document structure to define both the backend `response_model` and the FE zod contract. The spec elsewhere (line 183, quirk #4) correctly calls out that `OrgResponse` is loosely typed and tells the FE contract to be tolerant — apply the same explicit guidance here: document the map value's known fields, state the `response_model` policy (tight vs `extra="allow"`), and note whether the list is expected to be unbounded (single-doc fetch returns all orgs — acceptable at MVP, but state the assumption).

### [Low] Org Detail `/leads` multi-user fan-out is unaddressed

**Location:** §"Capabilities & data flow" → "A + B — Org Detail", line 123 ("Lead Stream → `GET /leads?user_id=` (resolves user(s) from the orgs/users mapping...)"); §"Notable quirks" #2, line 181.

The `/leads` endpoint is keyed by `user_id` and an org can map to multiple users. The spec acknowledges the user(s)-resolution indirection but does not address the fan-out: does the Lead Stream tab make one `/leads` call per user and merge, paginate across users, or union server-side? For an org with several users this is a real data-shape and pagination question (and the v1-list `count`-reflects-page-size caveat from TD-005 applies if v1 `/leads` is used). Specify the merge strategy and which `/leads` variant is used.

### [Low] Export scope vs. fetched-page scope is ambiguous (interacts with the registration finding)

**Location:** §"Capabilities & data flow" → "C — Registrations", line 132 ("Export: client-side CSV download of the loaded rows").

"Client-side CSV of the loaded rows" only exports what is currently fetched. Combined with the High registration finding (v1 silent 500-cap, or v2 page size), an admin exporting "all registrations" would get a page, not the dataset. State the export intent explicitly: is it "export current view" (acceptable, say so) or "export all"? If the latter, a server-side export path is needed and that's net-new backend work not currently in scope.

### [Nit] `ADMIN_EMAILS` as a source-controlled hardcoded set is a minor operational smell

**Location:** §"Access guard", line 102; §"Frontend directory structure" `adminAllowlist.ts`, line 62.

Hardcoding the staff allowlist in `adminAllowlist.ts` (committed to the repo) means adding/removing an operator is a code change + redeploy. The spec is aware this is cosmetic MVP debt (line 104), but it's worth a one-line note that staff turnover requires a commit — or an explicit nod that it could be a Vite env var instead (still not a security boundary, but avoids redeploy-for-roster-change). Either resolution is fine; flagging only.

## Observations (no action)

- Scope discipline is strong: §9 explicitly cuts self-service, billing, Firebase custom-claims roles, feature flags, agent config, and destructive actions. No overengineering detected — the only new surface is two read endpoints + a thin FE feature. This is the right size for the stated posture (MVP, 0 users, velocity-over-ceremony).
- The no-authz posture is honestly disclosed (§"Access guard", line 104; quirk #3, line 182) and is consistent with the codebase reality (AGENTS.md "Auth reality check"). The TECH_DEBT-entry instruction is appropriate.
- The "build backend → verify shape live with curl/`/docs` → write FE contract" sequencing (line 145) correctly follows the repo's polyglot rule and the no-auto-OpenAPI-client reality.
- Cleanup plan (delete the two legacy HTML tools, line 174) is sound: a grep confirms no `FileResponse`/`StaticFiles` serves them (only unrelated `admin_panel` substring matches in `leads.py`/docs).
- All other endpoint references verified present: `/org`, `/connect_org`, `/registration`, single-doc `{_id:"orgs"}` storage, `probe_llm` existence, `features/settings`-replaces-self-service claim path is reasonable.
