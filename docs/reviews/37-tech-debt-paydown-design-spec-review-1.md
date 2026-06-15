---
artifact: specs/37-tech-debt-paydown-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-15
round: 1
---

## Context

Reviewed against the working tree at current HEAD. I spot-verified the spec's most load-bearing citations (the two correctness bugs, the three backend items, and the ICP/chat dedup claims) against actual source rather than trusting the spec's assertions — several discrepancies surfaced and are cited below with file evidence. Verification was sample-based, not exhaustive; un-checked `Now` claims should still be treated as plausible but unconfirmed by this review.

Overall this is a strong, unusually disciplined spec: the Wave 0 → 9 structure, the per-entry `Now → Target → Accept` triad, and the explicit abort-per-item criterion make it highly plan-ready. The findings below are mostly about citation accuracy, internal count consistency, and a few under-specified targets — not about structural soundness.

## Findings

### [High] TD-FE-42 "Now" description is stale and overstates the remaining duplication

**Location:** §5 Wave 3, `TD-FE-42* — two independent /api/icp read paths`; also §4 item 2 vs §5 Wave 3.

Two factual problems in the `Now` block, both confirmed against code:

1. **Wrong endpoint path.** Wave 3 says "both read `/api/icp`," but the read migrated to `GET /api/v2/icp` (Spec 34). The MSW handler is `http.get("/api/v2/icp", …)` (`src/test/msw/handlers.ts:214`), the customers service comment says "Recommended ICPs read — GET /api/v2/icp (Spec 34 Task 4)" (`customers/services/customers.ts:80`), and Wave 0 item 2 itself says to capture `/api/v2/icp`. So Wave 0 and Wave 3 contradict each other on the path. The `/api/icp` string in Wave 3 is pre-Spec-34 drift.

2. **The two consumers already share a fetch function.** Wave 3 claims "separately-defined zod schemas" implying two independent read paths, but both `useICPs` (mission-control, `hooks/useICPs.ts:16`) and the customers service (`services/customers.ts:15,27`) call the **same** `fetchIcpsRowsForOrg` in `shared/profiler/profileIcpsExtract.ts:52`. The deduplication of the *transport* is already done; what remains is that neither path has a real schema (customers uses `z.object({}).passthrough()` at `customers/contracts.ts:8`; mission-control has none — `fetchIcpsRowsForOrg` returns `Promise<unknown[]>`).

The Wave 3 *target* ("one canonical zod schema + service function") is still valid work, but the plan author reading this `Now` will believe they must unify two independent read paths, when the real task is narrower: define one strong schema at the shared fetch site. Recommend rewriting the `Now` to reflect the v2 path and the already-shared transport, and narrowing the target to "add a real zod schema to the existing shared `fetchIcpsRowsForOrg`." As written, a plan task risks re-deduplicating transport that is already shared.

### [Medium] Headline entry counts are inconsistent and don't reconcile cleanly

**Location:** §1 ("25 resolvable-now entries"; "audit flagged 26"); §2.1 heading ("In scope — 26 entries"); §2.1 parenthetical ("27 non-deferred open entries"); §8 ("26-item branch").

The same scope is described as 25, 26, and 27 in different places:

- §1: the audit flagged **26** Easy/Medium resolvable-now, of which **25** remain after excluding TD-FE-73. Internally consistent.
- §2.1 heading and the §2.1 table, however, list exactly **25** code entries (I counted the table: 2+6+3+3+3+1+3+1+3 = 25). So the heading "In scope — 26 entries" is wrong — it is the pre-exclusion-of-TD-FE-73 number and was not updated.
- §8 ("A 26-item branch") repeats the stale **26**.
- §2.1 parenthetical introduces **27** ("25 code entries + these 2" = TD-FE-45/-48 doc-only).

The numbers *can* be reconciled (25 code + 2 doc-only = 27 non-deferred; the "26" is simply stale), but only if the reader realizes (a) the "26" in the heading/§8 is wrong, and (b) the "2 stale" bucket from §1 (see next finding) is the same pair as the Wave-9 doc-only closes. Neither is stated. A plan/execution reader tracking "how many items are in this phase" will hit three different answers. Recommend: set the §2.1 heading to "25 code entries + 2 doc-only (Wave 9)" and drop every bare "26."

### [Medium] The "2 stale" bucket is never named, and the §1 totals require inferring it equals TD-FE-45/-48

**Location:** §1 ("58 open entries: 42 resolvable-now, 4 blocked, 5 needing a decision, 5 accepted, 2 stale"); §2.3 (no "stale" category listed); §6.2 (TD-FE-45/-48 closed as doc-only).

§1 partitions 58 into 42 + 4 + 5 + 5 + **2 stale**. §2.3 enumerates blocked (4) + blocked-on-deployment (1, TD-FE-73) + needs-decision (5) + accepted (5) = 15, and §2.2 defers 16; in-scope code is 25; Wave-9 doc-only is 2. That sums to 15 + 16 + 25 + 2 = **58** — but only if the §1 "2 stale" == the Wave-9 "TD-FE-45 + TD-FE-48." The spec never says so. A reader cross-checking §1 against §2.2/§2.3 cannot find a "stale" category and will assume 2 entries are unaccounted for. Recommend explicitly mapping: "the 2 stale entries (TD-FE-45, TD-FE-48) are closed doc-only in Wave 9."

### [Medium] TD-012 scopes only 3 of 7 async handlers that share the identical blocking-I/O pattern; `:133` citation is invalid

**Location:** §5 Wave 2, `TD-012 — Apollo async handlers do blocking Mongo I/O`.

Two issues against `backend/app/routers/connectors.py`:

1. **Under-scoped relative to its own rationale.** The `Now` block names `apollo/import`, `apollo/enrich`, `apollo/enrich/status` (lines 58–87) and the `Target` calls the fix "a router-wide decision made once." But the same file has **four more** `async def` handlers that delegate to synchronous (blocking) service calls the same way: `apollo_discover` (`:91`), `apollo_discover_status` (`:103`), `apollo_warmup` (`:113`), `apollo_leads_export` (`:123`). If the rationale is "async handler that does blocking Mongo/Neo4j I/O should be sync so FastAPI thread-pools it," all seven qualify, not three. The spec's line range `connectors.py:58-87` conveniently stops before the identical handlers. Either justify why only three are in scope (e.g., the other four postdate TD-012 and are tracked elsewhere) or flip all seven — otherwise TD-012 is only partially resolved and the "router-wide decision" claim is inaccurate.

2. **Invalid line citation.** The `Now` block says the blocking PyMongo read happens "inline before returning (`:133`)," but `connectors.py` is 130 lines long — there is no line 133, and the blocking reads actually live in `app/services/connectors/*` (the handlers just `return connectors_service.…(...)`). The citation points nowhere and mis-attributes service-layer behavior to a router line. Recommend citing the service function instead.

### [Medium] Register-hygiene action counts ("3 drift corrections" vs "2 doc/stale closes") don't map cleanly to the §6.2 bullets

**Location:** §1 ("three places" of drift); §2.1 table ("the 3 drift corrections"); §6.2 (four bullets); §9.3 ("the 3 drift corrections + 2 doc/stale closes (TD-FE-45, -48)").

§1 asserts the register "has drifted from the code in **three** places." §6.2 lists **four** bullets: TD-FE-40 sub-item close, TD-FE-16 useAuth record, TD-FE-45 ChatWithHistory reconciliation, TD-FE-48 Deals.tsx close. §9.3 then says "3 drift corrections + 2 doc/stale closes (TD-FE-45, -48)." A reader cannot determine which of the four §6.2 bullets are the "3 drift corrections" and which are the "2 doc/stale closes," because TD-FE-45/-48 appear in both the §6.2 list and the §9.3 "doc/stale closes." The "3 drift" figure seems to want to be the register-vs-code drift (TD-FE-40, TD-FE-16, and one more), but it is never enumerated. Recommend an explicit one-line ledger in §6: "Drift (3): …; Doc/stale close (2): TD-FE-45, TD-FE-48."

### [Medium] TD-FE-70 and TD-FE-72 add net-new user-facing functionality, blurring the "paydown" framing

**Location:** §5 Wave 6 `TD-FE-70` ("a 'load more' affordance … appending the next page"); §5 Wave 5 `TD-FE-72` ("add a recompute/refresh affordance").

Both ship new UI controls/behavior rather than behavior-preserving cleanup: a Lead Stream pager (new UX) and a signal-lead-map refresh button (new control). That is not wrong — the underlying debt entries are real ("first-page-only," "refresh escape hatch unreachable") — but the spec's §1.1 posture says this is "a hygiene + correctness pass, not urgent remediation," and these two are the only items that grow the product surface. Worth flagging because (a) they carry the highest regression risk in a "low-risk paydown" batch, and (b) TD-FE-72 is explicitly **prod-dormant** (its target endpoint `/signal-lead-map_claude` is confirmed not deployed), so the phase may merge a control that does nothing in production. The spec's own dependency note (Wave 5) already offers deferring TD-FE-72; recommend the §1.1 posture paragraph acknowledge that two items are additive, and make the TD-FE-72 keep-vs-defer call explicitly rather than leaving it as a note.

### [Low] TD-FE-56 and TD-FE-66 leave the core design decision open with no Wave-0 gate

**Location:** §5 Wave 4 `TD-FE-56` ("one parameterised form component (or a shared form primitive)"); §5 Wave 4/§8 `TD-FE-66` ("replace the read-via-setter with a ref/cache read and add a concurrency guard").

Both are tagged Medium but present two genuinely different solutions in the `Target` without a gate to choose between them:

- TD-FE-56: "parameterised form component" vs "shared form primitive" are architecturally different (one unified component vs extracted sub-pieces). For 2 call sites at MVP this also risks over-abstraction (gold-plating a shared-form framework). The Wave-0 confirmation (item 3) only locates `ScoutDeployment.tsx` and quantifies overlap — it does **not** pick the consolidation strategy. The plan inherits an unresolved design fork.
- TD-FE-66: the concurrency-guard mechanism is unspecified (in-flight ref? AbortController? mutex flag?). The acceptance ("no duplicate concurrent status fetch") describes the symptom, not the mechanism, so the test shape is ambiguous.

These are acceptable to leave to the plan, but unlike TD-FE-23/-42/-56(gate)/-25, they have no Wave-0 step that resolves the fork first. Recommend either a Wave-0 design note for each, or narrowing the `Target` to one approach.

### [Low] Backend changes have no unified merge gate; §9 merge criterion is frontend-only

**Location:** §3 ("Merge gate: one green serial `npm run preflight`"); §9.4 ("One green serial `npm run preflight` (hard steps)").

The phase touches backend (TD-005 route deletion, TD-012 handler flips, TD-FE-71 prompt edit), but the only merge gate is the FE `preflight`. §7 says backend tests run per-wave via `pytest`, and §8 lists no backend gate. For TD-005 in particular — **deleting two live v1 routes** — there is no backend correctness gate at merge; correctness rests on the per-item grep guard and ad-hoc pytest. Given the MVP posture this is tolerable, but §9 should at least list "backend `pytest` green" as a merge criterion alongside preflight, and the TD-005 `Guard` (fall back to passthrough if a caller exists) should be a hard gate, not prose.

### [Low] TD-005's "FE migrated in Spec 34" premise is load-bearing but uncited

**Location:** §5 Wave 2 `TD-005` ("v2 is ready, the FE reads migrated in Spec 34").

The decision to **delete** the v1 `/user-documents` and `/fetch-signals` routes depends entirely on no FE caller remaining. The spec asserts the FE migrated in Spec 34 but does not cite the migrated callsite or confirm Spec 34 is merged. The `Target`'s grep guard mitigates this (fall back to passthrough if a caller surfaces), which is good — but the grep is described as a step, not a gate whose failure changes the decision. Recommend making "grep finds zero FE/admin/probe callers" an explicit pre-condition before the delete, with the passthrough fallback as the defined branch.

### [Low] TD-FE-29 acceptance is non-falsifiable ("passes under an induced load spike")

**Location:** §5 Wave 8 `TD-FE-29`.

The `Target` and `Accept` hinge on "VR e2e passes under an induced load spike," but the spec never defines how the load spike is induced or measured (concurrent sessions? CPU burn? how many?), nor a quantitative stability bar. Combined with the explicitly conditional outcome ("Flip … only if the hardening holds … otherwise leave the flip as a documented follow-up"), this item is closer to a spike than a debt fix, and its done-state is subjective. Recommend specifying the load profile and a repeat-count stability bar (e.g., "VR spec passes 3/3 runs with N concurrent preflight jobs"), or moving the flip to its own follow-on and scoping this entry to just the hardening.

### [Low] TD-FE-61 rename doesn't address the sessionStorage *key string*, a data-migration edge case

**Location:** §5 Wave 3 `TD-FE-61 + TD-FE-50`.

The rename targets the `SignalsChatContext` **type** and the manual casts on the sessionStorage payload. But the producer/consumers read/write under the literal key `"signalsChatContext"` (`CustomersPage.tsx`, `TrendsTab.tsx`). If the rename also touches the storage key string, in-flight `sessionStorage` entries from a prior build orphan (minor — sessionStorage is ephemeral); if it does not, the type name and the key string diverge, which is itself a small smell. The spec should state which it intends. (Ephemeral storage makes this genuinely Low, but the choice should be explicit.)

### [Low] No aggregate effort/feasibility estimate for a 25-item single-branch phase

**Location:** §1, §3, §8.

The audit graded each entry by difficulty/effort, but the spec carries no phase-level roll-up (e.g., "~N commits, ~M hours, one worktree session vs several"). A 25-item branch on one phase is ambitious regardless of MVP posture, and §8's only mitigation for long-lived-branch drift is "merge master in and re-preflight if it advances." Recommend a one-line feasibility note: expected commit count range and whether the phase is intended to land in a single pass or be checkpointed. This also helps a reviewer judge whether the single-branch/single-review batching is appropriate vs. splitting into 2–3 smaller phase branches.

### [Nit] `csvHelpers.ts:11` cited by basename only

**Location:** §5 Wave 1 `TD-FE-64` ("`csvHelpers.ts:11`").

The bug description is accurate (verified: `csvHelpers.ts:10-11` replaces the smart-quote class with `"` (U+201D) instead of ASCII `"`, exactly as described — the comment at `:7-8` even states the intent is ASCII, confirming the no-op). But the file lives at `features/mission-control/components/data-sources/csvHelpers.ts`; a bare basename is harder to navigate to. Other entries (e.g., TD-FE-12) cite full paths — be consistent.

### [Nit] TD-FE-73 treated as an absolute blocker though the route exists in-repo

**Location:** §4 item 4; §5 Wave 5.

The spec excludes TD-FE-73 because `/signal-lead-map_claude` "hard-requires a live response, so it cannot run." The route is, however, defined in code (`signals.py:108`), so the contract could be reconciled against the source (with a "not live-confirmed" caveat) rather than blocked entirely. Preferring live confirmation is consistent with the CLAUDE.md cross-stack rule, so this is a defensible choice — just note it is a choice, not a hard constraint.

### [Nit] Wave 5 dependency note is well-handled (positive)

**Location:** §5 Wave 5 dependency note.

The explicit "TD-FE-72 is dormant until the endpoint deploys; defer it alongside TD-FE-73 if you'd rather not build a prod-dormant control" note is exactly the kind of pre-stated decision branch a plan needs. No change required; flagged as a model for the under-specified items above.
