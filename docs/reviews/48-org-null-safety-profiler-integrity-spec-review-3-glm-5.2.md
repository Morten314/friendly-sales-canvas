---
artifact: specs/48-org-null-safety-profiler-integrity-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-07-09
round: 3
---

## Context

Round-3 pass. The spec was re-revised after the round-2 synthesis (mtime 15:35 > review-2 15:23),
and the synthesis records all four round-2 findings as agreed-and-applied — confirmed in the current
text: WS1(a) is now a **three-outcome resolution model** (resolved-with-org / authoritative-no-org /
transient-reconnecting); WS3's acceptance bar now states **both** error directions with a revisit
trigger and Goal #4 is softened to "best-effort"; the sibling `DataSourcesManager.tsx:111,177`
writes are named in WS1(d); and the empty/missing-signature "no-suppression" rule + test case are
in. I re-verified the deferred `AddLeadModal.tsx:66` open-question — it is real
(`const orgId = userId` → manual leads tagged with the uid as `org_id`) and remains deliberately out
of scope per the synthesis.

Procedural caveat: this is a **third consecutive `glm-5.2` pass**. Synthesis-2 explicitly notes the
single-model floor is not yet lifted and that a *distinct* model would add the most marginal
assurance (nothing blocks proceeding to plan). My findings this round are therefore deliberately
narrow — residual gaps in the newly-added three-outcome model, not re-litigation of settled items.

Project rubric `docs/review-rubric.md` loaded; `## all` (patch-target semantics) applies, `## spec`
absent. The spec self-cites the patch-target rule in its Testing section.

## Findings

### [Medium] Optimistic-cache vs. transient-failure interaction is unspecified — a warm cached org should survive a transient `GET /org` blip

**Location:** `## Architecture → WS1(a)` — "Keep the optimistic-cache read (so a returning mapped
user with a warm cache paints instantly)"; "GET /org still wins over cache"; and outcome (3)
"transiently unresolved (timeout, 5xx, network) → a distinct 'reconnecting' retry state."

The three statements are in tension for the primary happy path. "GET /org wins over cache" plus
"transient → reconnecting state" implies that a returning mapped user whose instant-paint came
from a warm cache, but whose confirming `GET /org` transiently fails (a 5xx blip, a brief network
stall — common on Render), would be torn down from the painted app into the "reconnecting" state.
That negates the stated benefit of the optimistic cache for exactly the most common user, and
flickers the UI on any transient blip. The spec doesn't say whether a usable cached org persists
through outcome (3). Recommend: specify that a warm cached org is retained (app stays mounted) on a
*transient* failure, with resolution retried in the background; outcome (3)'s reconnecting state
applies only when there is **no** usable cached org. ("GET /org wins over cache" should then be read
as applying to a *successful* resolution that disagrees with the cache, not to a transient
non-resolution.) Add a test case for warm-cache + transient-failure → no teardown.

### [Low] Retry/backoff multiplies in-flight `GET /org` requests; reset-on-user-change must also cancel/ignore stale resolutions

**Location:** `## Architecture → WS1(a)` — "at least one auto-retry / backoff converts a hang into
outcome (3)"; "reset all of it on user change / logout."

Adding retry/backoff to outcome (3) increases the number of concurrently in-flight `GET /org`
requests, which raises the probability that a late-arriving resolution lands *after* a user change
/ logout and mutates state for the wrong user (the classic stale-async hazard — and the existing
fire-and-forget race this spec is partly fixing). "Reset on user change" resets the *stored* state
but doesn't address an in-flight request resolving post-reset. Recommend the plan guard resolutions
against the current user (uid/generation check) or cancel the in-flight request on user change.
Related: the reconnecting state has no stated upper bound — a genuinely prolonged outage yields a
perpetual "reconnecting… retrying" with no give-up path. Acceptable at MVP/0 users, but worth a
one-line note (e.g., a max-retry ceiling before offering a manual "try again / sign in again").

### [Low] `orgResolved` naming footgun: it is true for *both* the has-org and authoritative-no-org outcomes

**Location:** `## Architecture → WS1(a)` — "`orgResolved` is true only for the definitive outcomes
(1) and (2)"; gating "render org-scoped routes only on outcome (1)."

`orgResolved` is `true` for outcome (1) (resolved-with-org) **and** outcome (2) (authoritatively
resolved with *no* org). A route-gate implementer who keys on `orgResolved` alone (a natural
reading of the name) would mount org-scoped routes for the no-org outcome and render against a null
org — precisely the failure WS1 exists to prevent. The prose is correct (the gate is outcome-(1)
specific, i.e. `orgResolved && orgId`), but the boolean name conflates "definitively resolved" with
"has org." Recommend either renaming to reflect three states (e.g. expose
`orgStatus: "resolved" | "no-org" | "transient"`) or stating the gate predicate explicitly
(`orgResolved && orgId`) to remove the footgun.

## Observations (no action)

- All four round-2 findings are applied in the current text (three-outcome model; both-directions
  signature bar + revisit trigger + "best-effort" Goal #4; sibling `:111/177` writes; no-signature
  ⇒ no-suppression rule + test). The revisions are substantive and accurate.
- `AddLeadModal.tsx:66` (`const orgId = userId` → manual lead adds tagged with the uid as `org_id`)
  is confirmed real and remains deliberately out of scope per synthesis-2's open questions; the
  plan's WS1(d) "manual-add" enumeration should at least triage it. Tracked — no spec change needed.
- WS3's over-suppression note ("effectively lost, no un-dismiss affordance in scope") is now
  acknowledged with a documented revisit trigger; acceptable at MVP/0 users, no change needed now.
- The plan-level open questions from synthesis-2 (exact persisted `firmographics` accessor shape;
  whether any org-scoped surface can mount before the protected-route gate) remain explicitly
  deferred to the plan and are acknowledged in-spec ("the plan pins the exact accessor"; WS1(e)'s
  load-bearing caveat). No spec change needed.
- The spec self-cites the project rubric's patch-target rule in its Testing section (patch
  `app.services.customer_profile.orchestrator._reserve_unique_icp_id`, not `…icp.persistence`) —
  correct; confirming only.
- Round-2 verification still stands: 25 org-fallback production sites (22 `brewra` + 3 `org-123`),
  transitive upload chain, `firmographics` nesting, and stale-key retirement all accurate.
