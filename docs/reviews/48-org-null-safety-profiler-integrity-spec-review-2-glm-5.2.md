---
artifact: specs/48-org-null-safety-profiler-integrity-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-07-09
round: 2
---

## Context

Round-2 pass of a **revised** spec. Between round 1 and this review the spec was edited to address
all eight round-1 findings (resolution timeout added; cold-cache skeleton; (b) broadened from "the
22 `brewra` sites" to a grep-sweep over *all* org-fallback literals including the `?? "org-123"`
family; the transitive lead-upload chain traced in WS1(d); WS3 signature narrowed to
`firmographics.industry + firmographics.segment` with a residual-drift bar + rejected alternatives;
per-user key pinned; pre-deploy resurface accepted; shell-gate vs per-surface guard clarified).
This review therefore (a) re-verified the spec's **new** claims against the code and (b) hunts for
issues the revisions introduced or left open, rather than re-raising resolved items.

Verified-accurate (this round): the org-fallback count is **22 `|| "brewra"` + 3 `?? "org-123"` =
25 production sites** (the 3 `org-123` are `ScoutChatPanel.tsx:259`, `ContextChat.tsx:97,176`;
remaining matches are test files, correctly excluded); the transitive upload chain
(`DataSourcesManager.tsx:242` → `useLeadStream.ts:323,325,350` → `POST`, plus the `:196-208` write)
exists as described; `firmographics.industry`/`segment` are genuinely nested under `firmographics`
(`prompts/icp/icp_generator.md.j2:62-67`); and `clearStaleTenantKeys` (`main.tsx:11`) has **no live
writer** of `selectedTenant_*` — the "retired, not a live vector" claim holds.

Project rubric `docs/review-rubric.md` loaded; its `## all` patch-target item applies (the spec now
self-cites it in its Testing section). No `## spec` section exists.

## Findings

### [Medium] WS3 signature collapses to `segment` in practice — `firmographics.industry` is a per-company constant, and the acceptance bar is one-sided (over-suppression unacknowledged)

**Location:** `## Architecture → WS3` — "Signature" ("Signature = canonicalized `firmographics.industry`
+ canonicalized `firmographics.segment` … the two most identity-bearing, lowest-variance fields")
and "Residual-drift acceptance bar" ("same industry + same segment ⇒ suppressed").

The signature is presented as a two-field discriminator, but verification of the prompt shows
`firmographics.industry` is instructed to be **the company's ACTUAL industry for every ICP**
(`prompts/icp/icp_generator.md.j2:13,16,63,89` — "All ICPs must be based on the company profile's
actual industry"; ICP 2's `industry` is literally `"[industry]"`). For a single company all
suggested ICPs therefore share the same `industry`, so `industry + segment` ≈ **`segment` alone**.
`industry` contributes ~zero discrimination; the entire durability mechanism rests on one
free-text, LLM-authored field. Two consequences, only one of which the spec weighs:

- **False-negative (acknowledged):** segment rephrasing on regeneration lets a dismissed ICP
  resurface — the spec accepts this ("materially relabels the segment can still slip past").
- **False-positive (NOT acknowledged):** two genuinely *distinct* suggested ICPs that happen to
  share a canonicalized segment phrasing collapse to one signature — dismissing one suppresses the
  other on every future refresh. The spec's stated success criterion ("same industry + same segment
  ⇒ suppressed") *literally describes this over-suppression as the desired behavior*, because with
  constant industry it reads "same segment ⇒ suppressed." Over-suppression of a legitimate distinct
  ICP is a behavior arguably worse than today's status quo and is nowhere mentioned.

This also puts Goal #4 ("stays dismissed … durably") in mild tension with the acceptance bar
("may resurface"). Recommend: (a) state explicitly that `industry` is ~constant per company so the
real discriminator is `segment`; (b) acknowledge the over-suppression tradeoff; (c) either accept
segment-only granularity with both tradeoffs written down, or raise resolution with a still-low-
variance composite (e.g. fold in a bucketed `company_size` band or a canonicalized leading
`title` token) so distinct ICPs don't collide.

### [Medium] Resolution timeout can false-positive a mapped user on a slow / cold `GET /org`, routing them to the terminal "contact your admin" state

**Location:** `## Architecture → WS1(a)` (timeout "~8–10s … MUST still flip `orgResolved`") and
`WS1(f)` (no-org terminal state on `orgResolved && !orgId`, "incl. the timeout case," with copy
"Your workspace isn't set up yet — contact your admin").

The timeout is a necessary fix for the infinite-spinner case, but it conflates two different
outcomes. A *hung* `GET /org` (the intended target) and a merely *slow* one are indistinguishable
under a wall-clock timeout — and the backend runs on Render, where a cold free-tier instance can
take well over 8–10s to answer the first request. A mapped user hitting a cold instance would
therefore time out, land in the `orgResolved && !orgId` branch, and see "Your workspace isn't set
up yet — contact your admin" — wrong and alarming messaging for a user who *is* mapped and just
needs the response to arrive. Recommend: separate a **timeout** (transient → a "reconnecting /
retrying" state, ideally with one auto-retry/backoff) from an **authoritative 404** (genuine
no-org → "contact your admin"), and consider an adaptive/longer ceiling or a single retry before
falling through, so a slow-but-valid resolution isn't reported as "no workspace."

### [Low] WS1(d) enumerates the lead-CSV transitive chain but omits the sibling document-upload writes inside DataSourcesManager itself

**Location:** `## Architecture → WS1(d)` ("Enumerate this chain … `useLeadStream.ts:325,350` …
file-scoped write at `:196–208`").

WS1(d) explicitly traces the lead-CSV upload chain (correctly — it's the #2 vector and hides behind
a prop, so the (b) grep sweep can't see it). But DataSourcesManager has two **other** direct
`formData.append("org_id", orgIdToUse)` org-scoped writes at `DataSourcesManager.tsx:111` and
`:177` (verified) — the document/PDF upload consumers of the `:103`/`:168` coalesces, a parallel
write path not named. They are covered by removing those coalesces + the general "guard every
mutation," but since the spec went to the trouble of explicitly enumerating the transitive chain,
it should note these sibling writes (or confirm they defer/guard) so the plan doesn't silently
treat the CSV chain as the only org-scoped upload write.

### [Low] WS3 signature must define behavior when `firmographics.industry`/`segment` is missing or empty

**Location:** `## Architecture → WS3` — "Signature" / "Reject path" / "Regeneration path."

The signature computation and matching are specified only for the well-formed case. Persisted docs
from older runs, or an LLM omission, can yield a missing/empty `firmographics` (or
`industry`/`segment`). Unspecified handling has two failure modes: every such ICP collapses onto a
degenerate (empty) signature, and a dismissed degenerate-signature ICP would thereafter suppress
*every* future ICP whose firmographics is missing. Recommend an explicit rule — e.g. never record
and never match on an empty/undefined signature (treat it as "no signature ⇒ no suppression") — so
missing data can't poison the dismissed-set.

## Observations (no action)

- All eight round-1 findings are substantively addressed in this revision; the new claims I
  re-verified (25-site count, transitive upload chain, `firmographics` nesting, stale-key
  retirement) are accurate. The spec is now markedly more plan-ready.
- WS3's "Rejected alternatives" section resolves the round-1 decision-quality gap — the three
  rejections (non-destructive id-preserving refresh; stable-id + content-match; prompt-level
  exclusion) are fair and each is rejected for a real shared limitation. No change needed.
- The spec self-cites the project rubric's patch-target rule in its Testing section
  (`patch-where-used … `app.services.customer_profile.orchestrator._reserve_unique_icp_id`, not
  `app.services.icp.persistence`) — correct and good awareness; flagged only to confirm.
- `WS1(b)`'s shift from a hand-list to a plan-time grep sweep (with the hand-list retained as
  illustration) is the right call and is self-aware about grep's blind spot for prop-threaded
  coalesces (hence WS1(d)). No change needed.
- MVP rollout posture (no flags/shims, WS3 as one cross-stack atomic commit, no backfill) remains
  appropriate to the repo's 0-users state and the monorepo atomicity rule. No change needed.
