---
artifact: specs/46-org-tenant-reunification-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-07-03
round: 1
---

## Findings

### [High] Success criterion #2 (`grep selectedTenant → 0`) is self-defeating

**Location:** `## Success criteria` #2; `### WS1` → "Stale-localStorage handling" → "one-time idempotent sweep."

The criterion demands `grep -r "selectedTenant" frontend/src` returns **zero**. But the WS1 init sweep that removes stale `selectedTenant_*` localStorage keys must itself reference the key name `selectedTenant` in source to delete it, so grep cannot be zero. Confirmed against the worktree: the string `selectedTenant` already appears in 6 test files (`LeadStream.test.tsx`, `LeadsTable.*.test.tsx`, `SignalsPage.*.test.tsx`) plus the consumers the spec lists — those tests will be rewritten, but the sweep module will reintroduce the literal.

**Suggestion:** scope the criterion precisely — e.g. "zero resolution/usage sites outside the init-sweep module and no test fixtures", or have the sweep derive the key (`localStorage.removeItem(\`selectedTenant_\${uid}\`)`) so the bare token `selectedTenant` need not appear as a free-standing resolution. As written, the criterion is unfalsifiable-in-the-bad-direction (it can never pass) and would block a green merge.

### [High] WS2 specifies cache correction but not the cache-invalidation cascade

**Location:** `### WS2 — GET /org authoritative`; Goal #2; `## Data flow (after)`.

WS2 says: always call `GET /org`, fresh value wins, overwrite the `org_id_<uid>` cache. That corrects the *cache key*, but Goal #2 ("a backend org re-key propagates to the client instead of being masked forever") requires more: if org-scoped TanStack Query data was already fetched with the stale/cached org *before* `GET /org` resolved (the optimistic-render path the spec explicitly keeps), those queries hold the wrong org's data. The spec never states that a cache≠fresh mismatch triggers invalidation/refetch of already-loaded server-state. Without that cascade, the user can still see the wrong org's data until they reload.

**Suggestion:** specify the invalidation behavior on mismatch (e.g. bump a `useOrgId()` identity token that org-scoped query keys depend on, forcing refetch when the authoritative org changes), and add it to Testing.

### [High] No test for the headline WS2 guarantee (re-key propagation)

**Location:** `## Testing` → "Frontend".

The Testing section covers `useOrgId()`, `LeadsTable`/`LeadStream` regression, and the init sweep — but nothing asserts that `AuthContext` always calls `GET /org` on auth resolution and overwrites a stale cache (i.e. success criterion #3). #3 is the entire point of WS2 and the only thing distinguishing "singular resolver" from "correct resolver." Add an explicit unit/integration test: plant a stale `org_id_<uid>` cache, resolve auth, assert the fresh org is fetched and wins.

### [Medium] Pinecone re-namespacing is hand-wavy and not naturally idempotent

**Location:** `### WS3 — Data reconciliation` → "`--apply`" → Pinecone bullet; `## Risks & rollback` → Pinecone bullet.

"Re-embed or re-namespace as required (surfaced in the report so the operator knows the Pinecone cost)" defers both the mechanism and the cost basis. Pinecone namespaces cannot be renamed — you either delete+re-upsert the source vectors into a new namespace (requires the originals) or re-embed from source docs in S3. The two have very different costs and different idempotency profiles; WS3 claims `--apply` is idempotent, but re-embedding/ copying vectors into a namespace is the least idempotent store in the set (a re-run could double or no-op depending on how dedup is keyed).

**Suggestion:** pick the approach in the spec (re-embed from S3 source vs. copy vectors), state how idempotency is achieved for Pinecone specifically (e.g. delete target namespace before upsert, or upsert-by-id), and have `--report` quantify vector counts by namespace so the cost is concrete, not "surfaced."

### [Medium] Two distinct stranded datasets are conflated (slug `brewra` org vs uid `A5Bfx` org)

**Location:** `### The confirmed bug` (evidence); Goal #3; `### WS3` → "Canonicalization rule."

The bug report's empty-stream symptom is caused by the stale tenant slug `"brewra"` resolving instead of the canonical UUID — WS1 fixes that, no data move needed. But WS3's recoverable data is described as "Ishani's 197 `A5Bfx…` leads" (uid-tagged) plus "the corrupt `…string` org." The spec never reconciles: (a) what data, if any, sits under the `"brewra"` slug org itself, and is *that* also reconciled by WS3 or left orphaned; (b) the relationship between the 396 leads reported under `b75ce29e` and the 197 under `A5Bfx` (subset? different store? different snapshot?). These read as the same incident but are different org-id values with different remediation paths.

**Suggestion:** enumerate the known non-canonical org-ids explicitly (the `"brewra"` slug org, the `A5Bfx…` uid org, the `…string` corrupt org) and state for each whether WS3 reconciles it or WS1 alone resolves the user-facing symptom. This matters because `--report` correctness depends on knowing what the script is even looking for.

### [Medium] `migrate` flag's relationship to WS3 and its HTTP plumbing are unspecified

**Location:** `### WS4` → "No silent re-key"; `### WS3` → "Canonicalization rule."

WS4 adds `migrate: true` to `connect_user_to_org`, described as "records the intent that WS3 acts on." But WS3 repoints `org_id` across every store *itself*. It's unclear whether WS3 invokes `connect_user_to_org(migrate=True)` to flip the user→org mapping, or rewrites `user_mappings` directly (bypassing the very hardened path WS4 builds). Additionally the HTTP layer — `POST /connect_org` (`app/routers/org_auth.py:24`) — currently takes only `user_id` + `org_id`; adding `migrate` requires a router/request-schema change that isn't mentioned. If `migrate` is service-internal-only (WS3 script calls the Python fn directly), say so; if it's an API param, spec the endpoint change.

### [Medium] WS2 relies on a permissive response model without pinning the contract

**Location:** `### WS2`; `## Data flow (after)`.

WS2 treats `GET /org` as returning both `org_id` and `org_name` and re-caches both. But `OrgResponse` is declared `extra="allow"` over varying-shape service dicts (`app/models/org_auth.py:24`), and AGENTS.md explicitly warns loose `response_model`s will mislead. The spec should either verify the live response actually always carries `org_name` (WS1's `useOrgId()` "also exposes `orgName`" depends on it for Header/ProfileDialog display) or tighten the model. As written, the FE `orgName` display contract is asserted but not validated.

### [Low] WS4 scope may exceed MVP posture (three checks at 0 users)

**Location:** `### WS4`; `## Non-goals` → "Auth hardening."

Reverse-uniqueness, no-silent-rekey-with-`migrate`, and UUID-shape validation are three enforcement points for a 0-user system whose posture is "optimize for velocity." The garbage-org fragmentation that caused this incident is directly blocked by the shape-validation check alone; reverse-uniqueness and the `migrate` flow add surface area (and the ambiguous plumbing flagged above). Consider whether shipping shape-validation now and deferring the other two is the leaner MVP cut — or, if all three are cheap enough, state that explicitly so the reader knows it's a deliberate defense-in-depth choice rather than gold-plating.

### [Low] Always-`GET /org` adds a serial request to the auth critical path

**Location:** `### WS2` → "Change."

Mandatory `GET /org` on every auth resolution sits on the first-paint path and shares the 30 req/min client rate limiter. The spec keeps the optimistic cache for rendering, which mitigates blocking — good — but doesn't state that first paint must not await the fresh `GET /org` (otherwise cold-starts/`onrender` spin-ups regress perceived load time). Worth a one-line explicit guarantee: render off the optimistic cache, reconcile in the background.

## Observations (no action)

- The WS1 consumer inventory is accurate against the worktree: `selectedTenant` appears in exactly the files the (a)/(b) tables list (plus their test files). The `grep` completeness intent is sound — only the literal phrasing of criterion #2 is the problem.
- `GET /org` exists with a `response_model` (`app/routers/org_auth.py:13`), confirming WS2's endpoint assumption; the concern is only the model's permissiveness, not the route's existence.
- WS1's gate/route-removal is correctly flagged for plantime confirmation rather than hardcoded line numbers — good defensive spec writing given the file is in flux.
- Sequencing (report → FE fix → apply → enforce) is sound and the WS4-behind-WS3 gate correctly prevents enforcement from wedging mid-migration.
- The `--report`-before-`--apply`, per-user, logged, idempotent design for WS3 (modulo Pinecone) is the right shape for a one-shot prod reconciliation.
