---
artifact: specs/48-org-null-safety-profiler-integrity-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-07-09
round: 1
---

## Context

Methodology note: I spot-checked the spec's load-bearing empirical claims against `master`
rather than taking them on faith. Verified-accurate: the `"brewra"` coalesce count is **exactly
22** and matches the inventory one-for-one (including one site per file for the five
market-research sections); the ICP generator prompt marks `id` optional
(`prompts/icp/icp_generator.md.j2:50`); `_reserve_unique_icp_id` and the whole-doc `update_one`
exist at the cited lines (`app/services/icp/persistence.py:71,195,239,260,288`). I did **not**
re-verify every file:line (e.g. the `AuthContext` fire-and-forget claim in WS1(a)) — those are
taken at face value. Findings below arise where verification *contradicted* the spec, or where a
design choice is under-specified.

Project rubric: `docs/review-rubric.md` was loaded; its `## all` checklist (Python patch-target
semantics) applies and its `## spec` section is absent, so only the `## all` item was appended.
This spec embeds no worked test code, so the patch-target rule has no concrete patch strings to
vet here — it is a forward-looking caution for the plan (see Observations).

## Findings

### [High] WS3's content-signature durability rests on a stability assumption that is likely false (LLM phrasing drift)

**Location:** `## Architecture → WS3` — "Signature" ("normalized content signature … stable across
regenerations because it derives from content, not the LLM-omitted id") and "Regeneration path."

The entire point of WS3 is that ids are unreliable across regeneration, so the spec keys the
dismissed-set on content. But the *reason* ids drift — the LLM regenerates with variation — applies
just as much to the content fields. The signature as sketched (`lowercased/trimmed industry +
segment + company_size + title`) is built from LLM-authored strings: a regenerated ICP with a
rephrased `title` ("Mid-market logistics operators modernizing dispatch" → "Mid-market logistics
firms upgrading dispatch systems") or a relabeled `segment` will **not** match the dismissed
signature, and the dismissed ICP reappears — the exact bug #1 this is meant to fix. The spec
asserts stability without engaging this failure mode.

Two compounding under-specifications, verified against the actual schema:
- The field set is given as "e.g." — not fixed. The ICP generator prompt's emitted fields are
  `title`, `industry`, `segment`, `firmographics.{industry,segment,market_size}`,
  `confidenceScore`, pain points/triggers, competitors, regions (`prompts/icp/icp_generator.md.j2`).
  `company_size` is not clearly in the emitted schema, so the proposed signature may reference a
  field that doesn't exist or is nested under `firmographics`.
- No canonicalization/normalization rule is given beyond "lowercased/trimmed." Free-text fields
  like `title`/`segment` need far more than trimming to be regeneration-stable.

No alternatives are weighed (e.g. persist a stable id on first generation and re-attach it on
content-match during regeneration; make `refresh=true` *non-destructive* so ids survive; suppress
regeneration of content-equivalent ICPs). Recommend: (a) pick a signature from schema fields that
actually exist and are *enum-like*/low-variance (e.g. `industry` + a canonicalized `segment`),
explicitly excluding free-text like `title`; (b) state the canonicalization rule; (c) acknowledge
the residual drift risk and decide an acceptance bar; (d) record at least one rejected alternative
with rationale.

### [High] RCA #2's stated write mechanism contradicts the code; the lead-upload write path is not explicitly in the fix scope

**Location:** `### Confirmed root causes` → "**#2 — Lead Stream shows no leads**" — parenthetical
"written by the `|| 'brewra'` coalesce at upload time"; and `## Architecture → WS1(b)/(d)`.

The RCA attributes Ishani's leads-under-`brewra` to "the `|| 'brewra'` coalesce at upload time."
Verification contradicts this: the lead read/entry path resolves org from `useOrgId()`, not the
coalesce (`LeadsTable.tsx:375`, `AddLeadModal.tsx:70` `org_id: orgId`), and **none of the 22**
`|| "brewra"` sites is in the lead path — all 22 live in the market-research intelligence sections,
`useMarketResearchData.ts`, ICP/customer-profile/data-sources components, and Settings. The 214
leads under `brewra` were therefore not written by that coalesce; they were written when the
*resolved* orgId was `brewra` during the resolution race / login default (consistent with the
existing test comment `LeadsTable.orgResolution.test.tsx:3` "the default 'brewra' slug written at
login").

Two consequences: (1) the spec's stated causal mechanism for its headline bug is factually wrong;
(2) the fix's explicit enumeration (WS1(b), the 22 sites) covers only the coalesce-bearing reads,
and the **lead-upload write** — the actual data-split vector — is covered only by the vague WS1(d)
"guard every mutation" catch-all, never named or verified. A plan author following the spec's
stated mechanism could faithfully remove the 22 coalesces and harden the *read* path while never
tracing the upload write. Recommend: correct the #2 mechanism to "resolved org was `brewra` during
the race," and explicitly enumerate the lead/CSV upload write site(s) + confirm they sit behind the
`orgResolved` gate (and/or a `!!orgId` write guard).

### [Medium] Scope is scoped to the `"brewra"` literal, leaving a sibling placeholder-tenant fallback in place — Goal #1 is not fully met

**Location:** `## Goals` #1 ("never reads or writes a placeholder tenant"), #2 ("divergence cannot
recur through this path"); `## Architecture → WS1(b)`.

Goal #1 is absolute ("never … a placeholder tenant"), yet verification found another org-fallback
literal of the same defect class that is **not** among the 22 and **not** in scope:
`market-research/components/scout-chat/ScoutChatPanel.tsx:259` — `org_id: orgId ?? "org-123"`.
During the login race `orgId` is null, so Scout chat writes under the placeholder tenant `org-123`.
(`ProfileDialog.tsx:18` `orgId ? \`${orgId}.com\` : "brewra.com"` is a display-only fallback — lower
severity.) Because WS1 frames the completeness target as "all 22 `brewra` coalesces," this sibling
literal survives and Goal #1's "never" is violated in practice. Recommend broadening WS1 from
"remove the 22 `brewra` coalesces" to "eliminate all org-fallback literals," enforced by a
grep-based sweep (e.g. `orgId \|\| "..."` / `orgId ?? "..."`) at plan time, with `org-123`
explicitly listed.

### [Medium] No-org failure mode: an unresponsive `GET /org` yields an indefinite shell block, never the terminal state

**Location:** `## Architecture → WS1(a)` ("`orgResolved` … false until `fetchOrgId` has settled —
success, 404, or error") and `(f)` (no-org terminal state on `orgResolved && !orgId`).

`orgResolved` flips true on success, 404, or *error* — but a hung `GET /org` (no response:
network stall, cold Render instance that never answers within the request window) is none of those.
In that case `orgResolved` stays false forever: the app shell never renders org-scoped routes and
the no-org terminal state (which *requires* `orgResolved`) never triggers — the user gets an
infinite spinner with no escape. The app depends on a remote backend, so this is a realistic, not
theoretical, failure. Recommend a bounded resolution timeout that forces `orgResolved` (and routes
to the no-org state or a retry affordance) so the UI always converges.

### [Medium] Cold-cache login latency regression is acknowledged but unbounded

**Location:** `## Architecture → WS1(a)` ("a cold-cache or unmapped user waits on resolution").

Gating all org-scoped rendering on `orgResolved` means a cold-cache (or unmapped) user now blocks
on a `GET /org` round-trip before any org-scoped UI paints — a regression in perceived login speed
versus today's (broken-but-instant) coalesce behavior. The spec notes this wait exists but specifies
no mitigation (shell-level skeleton, optimistic render of non-org chrome, perceived-latency NFR) and
no budget. Recommend stating an acceptable cold-cache wait and at least a loading affordance at the
shell level (WS1(e) covers per-surface affordances, but the *pre-route* shell wait has none).

### [Medium] WS3 deploy gap: pre-existing id-keyed dismissals are not migrated to the new signature set

**Location:** `## Architecture → WS3` ("Store"/"Regeneration path"); `## Rollout` / `## Non-goals`.

The new durable dismissed-set is signature-keyed and starts empty at deploy. Recommended ICPs
dismissed *before* deploy were dismissed only by the FE id-`Set` and/or the backend id-delete
(`persistence.py:260-302`) — they carry no signature — so the first post-deploy `refresh=true`
regeneration has no signature to suppress them and can re-surface previously-dismissed ICPs. The
spec's non-goals exclude *data reconciliation* (Ishani's split), but dismissal-state backfill is a
distinct, fix-internal correctness gap. Impact is low (0 users; Ishani's account is reset
out-of-band), but the gap should be acknowledged. Recommend either a one-time backfill that
computes signatures for currently-dismissed recommended ICPs, or an explicit "pre-deploy dismissals
may resurface once" acceptance note.

### [Medium] WS3 store key is ambiguous (per-user vs per-org); gating semantics undefined if the invariant ever loosens

**Location:** `## Architecture → WS3` — "Store" ("a per-user dismissed-signature set (on the
`ICP_config` doc or a sibling field keyed by user/org …)").

"Per-user … keyed by user/org" is ambiguous: the `ICP_config` doc is org-scoped, but dismissal is a
user action. Under the current 1:1 user↔org invariant (spec 46) it's moot, but the spec relies on
that invariant staying permanent to leave this unresolved, and existing suggested-ICP storage is
per-user. Recommend pinning the key explicitly (per-user, to match existing suggested-ICP storage)
and stating the assumption, so the durability guarantee is unambiguous.

### [Medium] WS1 shell-gate vs. per-surface-guard relationship is unclear — are the per-surface guards redundant or load-bearing?

**Location:** `## Architecture → WS1(a)` ("the app shell must not render org-scoped routes until
`orgResolved` is true") vs `(e)` ("each org-scoped surface renders a loading affordance while
`!orgResolved`").

If the shell gate in (a) is authoritative at the router level, org-scoped surfaces can never mount
before `orgResolved`, making the per-surface `!orgResolved` handling in (e) pure defense-in-depth
(redundant). If, however, any org-scoped route can mount pre-resolution (lazy-loaded route shells,
nested layouts, code-split chunks that resolve after the shell), then (a)'s gate is insufficient
and (e)'s guards are *mandatory*. The spec labels the combo "defense-in-depth" but doesn't say
where the gate lives or whether pre-resolution mounting is possible, so a plan author can't tell
whether (e) is belt-and-suspenders or a real gap-filler. Recommend clarifying that the gate is at
the protected-route boundary (so (e) is explicitly defense-in-depth) or enumerating the surfaces
that can mount pre-resolution.

## Observations (no action)

- The 22-site inventory's accuracy is confirmed by grep (count and per-file distribution both
  match). The ellipsized feature paths (`customers/.../`, `mission-control/.../`) are fine for a
  spec; the plan should expand them to full feature-relative paths, but no spec change is required.
- The patch-target rubric item (`docs/review-rubric.md` → `## all`) is a plan-level caution, not a
  spec defect: WS3's persistence edits will be tested with `patch-where-used`, and the known
  `customer_profile`↔`icp` import indirection (`_reserve_unique_icp_id` is imported by
  `customer_profile.orchestrator`, which tests patch as
  `app.services.customer_profile.orchestrator._reserve_unique_icp_id`) means the plan must patch at
  the caller, not `app.services.icp.persistence`. Flagged for the plan author.
- WS4's removal of the per-user guard on the org-owned profile (`companyProfileMapping.ts:39`,
  `CompanyProfileForm.tsx:95`) is a reasonable, cheap cleanup while in the file, and the spec is
  honest that it's latent (live payloads carry no `user_id`) rather than Ishani's actual cause.
  No change needed.
- WS4 correctly scopes itself to the FE amplifier of #5 and explicitly states Ishani's reported
  symptom was a migration artifact resolved out-of-band by account deletion — consistent with the
  non-goals. No change needed.
- The spec's decision to make WS3 a single cross-stack atomic commit and WS1/WS2/WS4 frontend-only,
  with MVP "no flags / no shims" rollout, is appropriate to the repo's 0-users posture and the
  monorepo's cross-stack atomicity rule. No change needed.
