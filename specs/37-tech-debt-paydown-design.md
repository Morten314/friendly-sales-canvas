# Spec 37 — Technical-Debt Paydown (Easy/Medium resolvable-now batch)

**Status:** Draft (design intent) — spec-review round 1 synthesized (`docs/reviews/37-tech-debt-paydown-design-spec-synthesis-1.md`)
**Date logged:** 2026-06-15
**Author origin:** Resolvability triage of `docs/TECH_DEBT.md` (`docs/tech-debt-audit-2026-06-15.html`), HEAD `a5c0d94`.
**Pairs with plan:** `plans/37-tech-debt-paydown.md` (to be written next).

---

## 1. Context & motivation

A full pass over the technical-debt register (`docs/TECH_DEBT.md`, 1,681 lines — backend TD-004/005/012 plus TD-FE-8…73) classified every **open** entry by whether it is resolvable against the repo as it stands today, and graded the resolvable ones by difficulty and effort. The audit found **58 open entries**: 42 resolvable-now, 4 blocked, 5 needing a decision, 5 accepted, 2 stale.

This spec covers the **25 resolvable-now entries of Easy or Medium difficulty** as a single coordinated paydown (the audit flagged 26; TD-FE-73 was confirmed **not deployed** during scoping and is excluded — see §2.3). The cut is deliberate: Easy/Medium items are mechanical-to-moderate and low-to-modest risk — appropriate to batch behind one review. The 14 Hard items (plus 2 Medium items coupled to them) are behavior-preserving rewrites, cross-cutting architecture, or test-infra investigations that each deserve their own reviewed spec; they are named and deferred here, not attempted.

The register itself is a frozen record of intent and has gone stale against the code in a few places (verified this pass): TD-FE-40 and TD-FE-16 are resolved here with their register text narrowed in Wave 9, and the audit's two **stale** entries — TD-FE-45 and TD-FE-48 — are closed doc-only in Wave 9. Reconciling the register is folded into the final wave so it reflects reality after the paydown.

### 1.1 Business posture (carried from CLAUDE.md)
Brewra is MVP, pre-launch, 0 live users — optimize for velocity over ceremony. The "what we lose" cost of most of these items is near-zero today; this paydown is a hygiene + correctness pass, **not** an urgent remediation. Two entries are genuine user-visible correctness bugs (TD-FE-64, TD-FE-23); two more — TD-FE-70 (Lead Stream pager) and TD-FE-72 (signal-map refresh control) — are the only items that add net-new product surface (a touch more regression risk than the cleanup batch), and TD-FE-72 is a deliberate keep (2026-06-15) that stays prod-dormant until `/signal-lead-map_claude` deploys. Everything else is behavior-preserving cleanup, typing, small structure, additive tests, or backend-internal. No security/auth hardening is in scope (MVP posture). Gates are advisory-over-hard-fail.

---

## 2. Scope

### 2.1 In scope — 25 code entries + 2 doc-only closes (this spec, one phase branch)

| Group | Entries |
|---|---|
| Correctness bugs | TD-FE-64, TD-FE-23 |
| Dead-code / cheap cleanups | TD-FE-26, TD-FE-12, TD-FE-40, TD-FE-24, TD-FE-16, TD-FE-66 |
| Backend (standalone) | TD-005, TD-012, TD-FE-71 |
| Typing & contracts | TD-FE-61, TD-FE-50, TD-FE-42 |
| Small structural | TD-FE-36, TD-FE-56, TD-FE-11 |
| Signal↔lead-map FE | TD-FE-72 |
| Pagination / routing | TD-FE-67, TD-FE-70, TD-FE-68 (partial) |
| Coherence | TD-FE-25 |
| Test / tooling | TD-FE-20, TD-FE-52, TD-FE-29 |
| Register hygiene (Wave 9) | Narrows TD-FE-40 / TD-FE-16; closes TD-FE-45, TD-FE-48 (doc-only) |

(TD-FE-71 is filed under TD-FE numbering but is a backend prompt change — it sits in the backend wave. The two doc/stale entries TD-FE-45 and TD-FE-48 carry no code change; they are reconciled/closed in Wave 9. With the 25 code entries + these 2, all 27 non-deferred open entries are accounted for here; the remaining 31 are the 16 deferred + 15 untouched in §2.2–§2.3.)

### 2.2 Out of scope — deferred to 4 named follow-on specs (16 entries)

- **Spec 38 — Market-research data-layer split:** TD-FE-19 (the keystone: separate a server-cache/query layer from editable draft state). Resolving it also unblocks the 4 currently-*blocked* entries TD-FE-28, -30, -53, -65.
- **Spec 39 — Mutation-hook pass:** TD-FE-21, -27, -31, -34, -41 (and -35, coupled — the client-storage failover folds into the persisted query layer here).
- **Spec 40 — Escape-hatch retyping:** TD-FE-9, -10, -38 (now unblocked — the backend is live, so shapes are confirmable).
- **Spec 41 — Structural / decomposition:** TD-FE-47 (StrategistWorkspace), -43 (customers cache-native), -44 + -58 (typed event-bus, coupled), -17 (MR VR baseline), -46 (test fake-timer/MSW deadlock).

(Follow-on spec numbers are indicative; each takes the next free NN at creation time.)

### 2.3 Out of scope — not actionable now (untouched, remain in register)

- **Blocked (4):** TD-FE-28, -30, -53, -65 — gated on Spec 38's data-layer split.
- **Blocked on deployment (1):** TD-FE-73 — `/signal-lead-map_claude` confirmed **not deployed** (2026-06-15); the entry stays open, the contract reconciliation pulls forward when the endpoint ships.
- **Needs decision (5):** TD-FE-39 (connector dead-code delete-vs-wire), -55 (multi-org product call), -59 (small-page products unbuilt), -69 (needs new per-ICP-count backend endpoint), TD-004 (needs live API keys — owner CTO).
- **Accepted / not-a-defect (5):** TD-FE-8, -33, -37, -49, -60.

---

## 3. Execution model

- **One phase branch** `phase-37-tech-debt-paydown`, cut off `master`, developed in a dedicated worktree. Use `git -C <worktree>` for git ops (worktree cwd gotcha). Commit **only the files each step touches, by path** — never `git add -A` (shared working tree).
- **Sequenced waves** (§5–§9) are ordered commit groups on the one branch, not separate branches. Commit granularity stays small: one logical step = one commit; a coordinated FE+BE change lands as one atomic commit; `type(scope):` subjects, no `[N/M]` suffixes, no Co-Authored-By footer.
- **Cross-stack ordering:** backend-first where a FE item consumes a BE shape. Here coupling is light — most FE items only need a *confirmed* shape (Wave 0), not a changed one.
- **Merge gate:** one green serial `npm run preflight` (run from `frontend/`) **plus `backend/.venv/bin/python -m pytest backend/tests/ -q` green** (this phase touches the backend — TD-005/-012/-71) → `git checkout master && git merge --no-ff phase-37-tech-debt-paydown && git push origin master`. If `master` advances mid-effort, merge it into the branch and re-preflight.
- **Feasibility:** ~25–32 commits (≈ one per entry, a few split per the wave notes), checkpointed by wave. The single phase branch is a deliberate decision (Phase-6 precedent — 25 tasks on one branch), not a per-wave branch split.
- **Advisory posture:** the 8-step preflight's advisory steps (lint, format:check, bundle:check) are reported but do not block the merge per the pre-launch gate posture; the hard steps (typecheck, vitest, build, e2e, knip) must pass. Run `prettier --check` on touched files per wave (the fast `verify` loop omits `format:check`). Do **not** run prettier over `docs/TECH_DEBT.md`.

---

## 4. Wave 0 — Confirmations (gates; no production code)

Resolve the four remaining verify-first unknowns (item 4 below, TD-FE-73, is already settled — not deployed) before the code waves and capture the findings in a short working note (`docs/reviews/` or the plan's scratch). The backend is live (`https://brewra-gtm-intelligence.onrender.com`, `/docs` → 200), so live-shape calls are possible. Use a throwaway probe `(user_id, org_id)` and clean up any writes (per the Scout-500 probe discipline).

1. **TD-FE-23 — chartType field.** Call `POST /market-research` for the regulatory component and confirm the chart-type field in `visualDataCards[]` is named `chartType` (recorded confirmed 2026-06-02 — re-confirm and capture the full card shape). → feeds the Wave-1 normalization + its unit test.
2. **TD-FE-42 — ICP read shape + call chain.** Capture the actual shape `fetchIcpsRowsForOrg` returns and the call chain it makes — the `useICPs` tests say it hits `/api/profile/company` + `/api/customer_profile`; the customers service comment says `GET /api/v2/icp` (Spec 34). Pin the real chain. → feeds the Wave-3 schema (which lands at the `fetchIcpsRowsForOrg` return regardless of the chain).
3. **TD-FE-56 — ScoutDeployment location.** Locate the current home of `ScoutDeployment.tsx` (Phase 9 relocated it; not found at the register's stated path this pass) and diff against `features/settings/components/AgentProfile.tsx` to quantify overlap and pick the shared home. → feeds the Wave-4 form unification.
4. **TD-FE-73 — endpoint deployment: settled at scoping.** `POST /signal-lead-map_claude` was confirmed **not deployed** (2026-06-15), so TD-FE-73 is **excluded** from this spec — no probe needed. Its register entry stays open and is carried forward (Wave 9); pull the contract reconciliation in when the endpoint ships. (Deliberate choice, not a hard constraint: the route is defined in-repo at `signals.py:108`, but re-deriving the contract from that source is exactly what TD-FE-73 already is — only a live deployed response confirms the real shape, per the CLAUDE.md cross-stack rule.)
5. **TD-FE-25 — open question (code, not live).** Determine whether `localStrategicRecommendations` in `StrategicRecommendationsSection.tsx` has a parent-bound change callback. → decides the Wave-7 fix shape: read-only fallback alignment, a persist callback, or both.

---

## 5. Waves 1–8 — Per-entry scope

Each entry below states **Now → Target → Accept**, with verified file references. `*` marks a Wave-0-gated item.

### Wave 1 — Correctness bugs + dead-code (frontend, low risk)

**TD-FE-64 — CSV smart-quote no-op** · Easy/Small
- Now: `normalizeCsvAsciiDoubleQuotes` replaces smart quotes with U+201D (a curly quote) instead of ASCII U+0022, so the normalization is a no-op and curly-quoted CSVs (Excel/Word) mis-parse. `frontend/src/features/mission-control/components/data-sources/csvHelpers.ts:10-11`.
- Target: change the replacement target to ASCII `"`; un-skip the two ready tests in `__tests__/csvHelpers.test.ts:141,146`.
- Accept: the two previously-skipped tests pass; no other csvHelpers test regresses.

**TD-FE-23\* — Compliance Analytics keys on `card.type`, backend emits `chartType`** · Medium/Small
- Now: `ComplianceVisualCard.tsx:46-126` switches on `card.type`; the field is typed `UntypedVisualDataCard` (any) so the backend's `chartType` silently falls through to the hardcoded default → backend `visualDataCards` never render.
- Target: normalize at the read site (`const chartType = card.type ?? card.chartType`) per the Wave-0 shape; add a `ComplianceVisualCard` unit test asserting a `chartType`-keyed card renders the right chart.
- Accept: new unit test passes; a populated backend card renders its real chart, not the default.

**TD-FE-26 — dead non-user-scoped localStorage writes** · Easy/Small
- Now: 7 raw `localStorage.setItem("regulatory_…")` write sites (`RegulatoryComplianceSection.tsx:163,169,175,181,187,488,489`) write to an unscoped keyspace, while the `useState` initializers read user-scoped keys via `getUserLocalStorage(...)` (`:84,92,100,108,116`) — the writes can never be read back.
- Target: route the writes through `setUserLocalStorage(key,value,uid)` so they share the read keyspace, or delete them (behavior-neutral — they are already dead).
- Accept: no unscoped `regulatory_*` `setItem` remains; existing regulatory tests green.

**TD-FE-12 — dead TenantContext fields** · Easy/Small
- Now: `shared/tenant/TenantContext.tsx:15,18,39,111,114` declares and exposes `availableTenants` / `setAvailableTenants`; 0 readers (TenantSelection renders from the `useTenants` query).
- Target: remove both from `TenantContextType` + the provider value.
- Accept: typecheck green; grep confirms 0 references; no behavior change.

**TD-FE-40 — mission-control cleanup nits** · Easy/Small
- Now: `ICPManager` write handlers carry 19 `console.*` calls; `IcpList.getFitConfidenceBadge` (`IcpList.tsx:18-47`) has no `default` branch (returns `undefined` for out-of-union). (Sub-items `_isSaving` and `syncingProfilerCustomerProfile` are already gone — see Wave 9.)
- Target: strip the console noise; add `default: return null` to `getFitConfidenceBadge`.
- Accept: console calls removed; the badge fn is total; tests green.

**TD-FE-24 — regulatory default datasets duplicated** · Easy/Small
- Now: default regional rows + visual cards are hardcoded twice in one file (`RegulatoryComplianceSection.tsx:332-365 & 637-670` regional; `:374-403 & 672-701` cards). (Register said 3–5 sites; verified = 2 sites in 1 file — `StrategicRecommendationsSection` receives them as props.)
- Target: a single `regulatoryDefaults.ts` constants module (or `derive*` helpers) consumed by both sites, with a shape unit test.
- Accept: one definition; both fallback sites reference it; shape test passes.

**TD-FE-16 — sidebar internal hook twin** · Easy/Small
- Now: the `useAuth` collision is already resolved (`src/hooks/useAuth.ts` deleted; single `useAuth` in `shared/auth/AuthContext.tsx:28-34`). Remaining: `features/shell/SidebarContext.tsx:21-27` still names its internal hook `useSidebar` (re-exported as `useAppSidebar`) — an inactive twin of the shadcn primitive.
- Target: rename the internal hook to `useAppSidebar`; drop the barrel alias; update its 2–3 call sites.
- Accept: no internal `useSidebar` symbol remains; typecheck green. (Narrow the register entry in Wave 9.)

**TD-FE-66 — useDocumentSync cleanup** · Medium/Small
- Now: `useDocumentSync.ts` has a dead `_isSaving` useState (`:57`); ~18 `console.log` calls; and `checkProcessingFilesStatus` (`:94-117`) abuses `setDataSources((cur)=>…return cur)` purely to read state and fires uncontrolled concurrent async status checks that race on `setDataSources`.
- Target: (commit a) remove dead `_isSaving`, thin the logs — behavior-neutral; (commit b) replace the read-via-setter with a ref read and add an **in-flight ref guard** (a ref-held set of file-ids currently being checked, skipped on re-entry), with a test asserting a file already in-flight is not re-fetched.
- Accept: dead state + log noise gone; in-flight-guard test passes; processing-status behavior unchanged in the happy path.

### Wave 2 — Backend (standalone)

**TD-005 — v1 `count` is page size, not DB total** · Easy/Small
- Now: v1 `/user-documents` (`data_sources.py:107-108`) and `/fetch-signals` (`signals.py:79-80`) return `count = len(items)` after the service caps at 500, discarding the real `total` as `_`. v2 successors already carry `items/total/limit/offset` correctly.
- Decision: **delete the two v1 routes** (not passthrough). v2 is ready and the FE reads migrated in Spec 34 (`customers/services/customers.ts:80` — "GET /api/v2/icp (Spec 34 Task 4)"; the document/signal reads moved the same way), and the MVP posture takes breaking changes with no deprecation ceremony — deleting removes the debt outright rather than making a slated-for-removal endpoint honest.
- Target / hard gate: **pre-condition — grep the repo (FE callsites, `backend/` admin tools, root probe scripts, tests) and confirm zero remaining callers** of the two v1 routes. Zero → delete the routes + any now-dead service wrapper. A caller that can't be cheaply moved to v2 → fall back to passing `total` through (`items, total = …; count: total`) **for that one route only**, documented. The grep result selects the branch — it is a gate, not advisory.
- Accept: the two v1 routes are deleted (nothing imports them) — or, for a documented stubborn caller, that route returns the true `total`; v2 confirmed registered; `backend/tests/` green.

**TD-012 — Apollo async handlers do blocking I/O** · Medium/Small
- Now: `connectors.py` has **7** `async def` handlers that delegate to synchronous (blocking) service calls — `apollo_import` (`:59`), `apollo_enrich` (`:70`), `apollo_enrich_status` (`:81`), `apollo_discover` (`:91`), `apollo_discover_status` (`:103`), `apollo_warmup` (`:113`), `apollo_leads_export` (`:123`). The blocking I/O lives in `app/services/connectors/*` (the handlers just `return connectors_service.…`); `/connect`, `/status`, `/lists`, disconnect are already sync `def`. (TD-012-as-logged named only the first three; the other four were added by Spec 35 after the entry was written.)
- Target: flip **all seven** async handlers to sync `def` (FastAPI thread-pools them; `BackgroundTasks` schedule fine from a sync handler) — the "router-wide decision made once" the entry intends, applied consistently rather than to three of seven.
- Accept: all seven handlers are sync `def`; a live smoke (or test) confirms import/enrich/discover still queue their BackgroundTask and the status/export reads still return; responses unchanged; `backend/tests/` green.

**TD-FE-71 — signal↔lead-map prompt matches data the payload doesn't send** · Easy/Small
- Now: `signals/lead_map.py` `_signals_for_prompt` serializes only `{signal_id, headline}`, but `signals_lead_map.md.j2` MATCHING RULES instruct matching on company mentions in `description`/`snippet` — never sent.
- Target: narrow the MATCHING RULES to headline-only (a 1-line prompt edit) — the cheap honest fix; recall-tuning via payload extension stays deferred (TD entry notes this).
- Accept: prompt and payload agree (headline-only); golden-render prompt test (if present) updated; no behavior regression in the mapping path.

### Wave 3 — Typing & contracts (frontend)

**TD-FE-61 + TD-FE-50 — chat context type name + untyped sessionStorage handoff** · Medium/Medium (done together)
- Now: `shared/chat/ContextChat.tsx:24-33` exports the type as `SignalsChatContext` while the component is `ContextChat`; ~32 references across ~6 files. The `signalsChatContext` sessionStorage handoff is untyped — producer `SignalsPage.tsx:332`, consumers `CustomersPage.tsx:36` + `TrendsTab.tsx:33` each cast manually.
- Target: rename the **type** to `ChatContext` across all consumers; define one shared, named interface for the sessionStorage payload imported by the producer and both consumers; remove the manual casts. Keep the sessionStorage **key string** `"signalsChatContext"` unchanged (ephemeral storage — a key rename would orphan in-flight entries for no benefit).
- Accept: no `SignalsChatContext` symbol remains; producer + consumers share one typed contract; typecheck green; chat behavior unchanged.

**TD-FE-42\* — ICP read has a shared transport but no real schema** · Medium/Medium
- Now: the *transport* is already shared — both `useICPs` (`hooks/useICPs.ts:16`) and the customers service (`services/customers.ts:27`) call the same `fetchIcpsRowsForOrg` (`shared/profiler/profileIcpsExtract.ts:52`, typed `Promise<unknown[]>`). What's missing is a real contract: customers wraps it in `z.object({}).passthrough()` (`customers/contracts.ts:8`) and mission-control has none, so a divergent ICP shape is caught by neither. The read is the v2 path (Spec 34), not the pre-Spec-34 `/api/icp`.
- Target: add one real zod schema at the shared `fetchIcpsRowsForOrg` return (replacing `unknown[]`/passthrough), so a shape change is caught at a single site and both consumers inherit it — NOT a transport re-dedup (already shared). Use the Wave-0 captured shape/chain.
- Accept: `fetchIcpsRowsForOrg` returns a schema-validated type; both `useICPs` and the customers service consume it; typecheck green; both ICP reads behave as before.

### Wave 4 — Small structural (frontend)

**TD-FE-36 — promote `useCompanyProfile` to shared** · Medium/Small
- Now: `useCompanyProfile` is consumed by settings + mission-control; a market-research path fetches equivalent company-profile data independently; the hook is not in `@/shared/`.
- Target: move `useCompanyProfile` to `@/shared/company-profile`; repoint consumers; remove the market-research duplicate fetch. (Cross-feature imports go through the feature index / shared barrel — `import-x` enforced.)
- Accept: one hook in `@/shared/`; MR uses it; the duplicate fetch is gone; typecheck + lint green.

**TD-FE-56\* — AgentProfile / ScoutDeployment near-duplicate forms** · Medium/Medium
- Now: `features/settings/components/AgentProfile.tsx` (~290 LOC) and `ScoutDeployment.tsx` (Wave-0-located) are near-duplicate config forms with no shared base.
- Target: unify into **one parameterised form component** in the Wave-0-chosen home (NOT a new shared-form framework/primitive — over-abstraction for 2 call sites at MVP); both surfaces render through it.
- Accept: a single shared form; both Agent and Scout surfaces render correctly (render tests); no visual/behavioral regression.

**TD-FE-11 — orphaned Settings company-profile fetch** · Medium/Medium
- Now: `SettingsPage.tsx:37-85` calls `fetchProfileData(profileType)` and passes `profileData` to all three profile components; `CompanyProfile.tsx:31` ignores it (reads `useCompanyProfile`), so `fetchProfileData("company")` is a wasted GET. `UserProfile`/`AgentProfile` (`:47`) still consume the shared prop.
- Target: migrate `UserProfile` + `AgentProfile` onto their own query hooks; then drop the orphan company fetch and the shared `profileData` prop flow.
- Accept: no redundant company GET; the three profile forms read from their own hooks; Settings renders unchanged.
- **Coupling:** `AgentProfile` is touched by both TD-FE-56 and TD-FE-11 — sequence them adjacently so `AgentProfile` is rewritten once (unify form, then wire its hook).

### Wave 5 — Signal↔lead-map (frontend)

**TD-FE-72 — refresh escape hatch unreachable** · Medium/Small
- Now: `useSignalLeadMap` always sends `refresh:false`; no UI surfaces a recompute, so the backend `refresh=true` fingerprint-cache-bust path is inert end-to-end.
- Target: add a recompute/refresh affordance on a mapping surface calling `fetchSignalLeadMap(userId, orgId, { refresh:true })`.
- Accept: the control triggers a `refresh:true` request (verified by network/handler in an MSW test); cached mapping is bustable from the UI.

**TD-FE-73 — EXCLUDED** (`/signal-lead-map_claude` confirmed not deployed 2026-06-15). The contract-vs-live reconciliation hard-requires a live response, so it cannot run; entry stays open and carries forward (§2.3, Wave 9). See §4 item 4 for why source-reconciliation is not a substitute.

> **Dependency note:** TD-FE-72's button calls `fetchSignalLeadMap` → the same not-deployed `/signal-lead-map_claude`. It is **confirmed kept in scope** (decision 2026-06-15) as a self-contained, fully MSW-testable FE change that closes the "no UI affordance" entry — with the understanding that it is **dormant in production until the endpoint deploys** (same gate as TD-FE-73). Verify it end-to-end via MSW now; it becomes live-functional when the endpoint ships.

### Wave 6 — Pagination / routing (frontend)

**TD-FE-67 — v2 reads cap at 500; `total` not surfaced** · Medium/Small
- Now: `fetchDataSources`/`fetchSignals`/`fetchSuggestedIcps` request one page and consume only `items`; `total` is on the wire but unread/untyped.
- Target: widen the three service return types to carry a typed `total` (ready for consumption), without breaking the bare-array consumers.
- Accept: `total` is typed and available from the three reads; existing consumers unaffected; typecheck green.

**TD-FE-70 — Lead Stream first-page-only** · Medium/Medium
- Now: `useLeads`/`fetchLeads` calls `GET /api/v2/leads` with `firstPageParams(50)` and renders a flat list; no pager.
- Target: a "load more" affordance using v2 `limit`/`offset`, appending the next page; uses the `total` from TD-FE-67.
- Accept: "load more" fetches and appends the next page; first-page behavior unchanged when ≤50 leads; a pager test passes. (Do TD-FE-67 then TD-FE-70.)

**TD-FE-68 (partial) — residual direct-backend callsites** · Medium/Medium
- Now: four components call `BACKEND_BASE_URL` directly. In scope: the two **non-streaming** callsites — `/ask` in `AIPromptingInterface` and `/profile/company` in `RegulatoryComplianceSection`. The two streaming `/chat/` callsites (ChatWithScout, StrategistWorkspace) stay deferred (need an SSE-aware `/api` transport — Spec 41 territory).
- Target: migrate the two non-streaming callsites onto the `/api` proxy.
- Accept: those two callsites route through `/api`; a live smoke confirms 200s; streaming callsites untouched (documented as remaining).

### Wave 7 — Coherence (frontend)

**TD-FE-25\* — read-only Strategic Recommendations ignores local edits** · Medium/Small
- Now: `StrategicRecommendationsSection.tsx` reads from API/defaults in non-editing mode and from `localStrategicRecommendations` only while editing, so edits can vanish on exiting edit mode — inconsistent with `ExecutiveSummarySection`'s `local || data || default` chain.
- Target (per Wave-0 finding): align the read-only fallback chain, and/or wire a parent persist callback if the open question shows edits never round-trip.
- Accept: edited strategic recommendations survive exiting edit mode; behavior consistent with `ExecutiveSummarySection`; an RTL test covers edit→exit→still-shown.

### Wave 8 — Test / tooling (frontend; additive, advisory)

**TD-FE-20 — MR trends/analysis tabs have no e2e** · Medium/Small
- Now: `e2e/journeys/04-market-research-5-components.spec.ts` is a smoke test on the intelligence tab only — no `trends`/`analysis` tab clicks.
- Target: extend the spec with a trends-trigger click → assert the Scout-chat surface renders, plus an analysis-tab assertion.
- Accept: journey clicks both tabs and asserts their surfaces; e2e green.

**TD-FE-52 — no strategist Playwright/VR journey** · Medium/Medium
- Now: strategist has Vitest render tests only; no Playwright journey, no VR baseline.
- Target: a strategist Playwright journey + a VR baseline for the two-panel workspace + chat + sequence timeline.
- Accept: a new strategist journey spec passes; a VR baseline is committed and stable.

**TD-FE-29 — preflight serial; parallel runner flakes e2e** · Medium/Medium
- Now: `preflight:par` (opt-in) spikes box load and flaked the VR e2e snapshot under concurrent-session load; serial stays the default gate.
- Target: harden the VR e2e against contention (Playwright retries on VR specs, a higher `toHaveScreenshot` stabilization timeout, a lower default `PREFLIGHT_JOBS`, or an isolated e2e wave). The `preflight`→`preflight:par` flip is **out of this entry's scope** — an explicit follow-up once the hardening is proven.
- Accept: a defined contention reproduction (e.g. `preflight:par` with `PREFLIGHT_JOBS` at the box core-count while a second worktree preflight runs) passes the VR spec **3/3 consecutive runs**; the `preflight:par` flip remains a documented follow-up, not made here.

---

## 6. Wave 9 — Register hygiene

After the code waves land, reconcile `docs/TECH_DEBT.md` (surgical edits only — **no prettier** over this file):

1. **Mark resolved** every entry resolved in Waves 1–8: set its status to RESOLVED with the date and the resolving commit, update the **Index — TD-FE entries** table, and move fully-closed entries into `TECH_DEBT_ARCHIVE.md` per the existing archive convention (keep the ID; do not reuse numbers).
2. **Reconcile the register text (explicit ledger — 2 narrow + 2 close):**
   - **Narrow (code moved ahead of the register, resolved this phase):**
     - **TD-FE-40** — close sub-items (c) `syncingProfilerCustomerProfile` and (d) `_isSaving` as already-resolved (verified absent in current code); narrow to the (a)/(b) work done this phase.
     - **TD-FE-16** — record the `useAuth` collision as already-resolved (`src/hooks/useAuth.ts` deleted); narrow to the cosmetic sidebar rename done this phase.
   - **Close (the audit's "2 stale" doc/stale entries, no Wave 1–8 code change):**
     - **TD-FE-45** — reconcile: confirm the Phase-9 shared `ChatWithHistory` shell made `ProfilerChatWithHistory`/`ScoutChatWithHistory` thin delegates; close the remaining dedup half if so, else leave it open for Spec 41.
     - **TD-FE-48** — doc-only close: `Deals.tsx` already moved to `features/strategist/pages/StrategistPage.tsx` (with the `/deals` redirect); close the TD entry annotated as a Phase-8 delta. Do **not** rewrite the frozen Spec 14 §12 (specs are a frozen record of intent per CLAUDE.md).
3. **Record the TD-FE-73 carry-forward:** `/signal-lead-map_claude` confirmed not deployed (2026-06-15) — note TD-FE-73 stays open, pulled in when the endpoint ships. (TD-FE-72 was kept in scope and resolved this phase, but is dormant in prod until the endpoint deploys — note that operational caveat on the closed entry.)
4. The HTML audit (`docs/tech-debt-audit-2026-06-15.html`) is point-in-time and is **not** regenerated.

---

## 7. Testing strategy & gates

- **Behavior-changing items get tests:** TD-FE-64 (un-skip 2), -23 (new unit test), -66 in-flight-guard (no-double-fetch test), -42 (schema test), -25 (edit-survival RTL), -70 (pager test); backend -71 (golden-render prompt test if present), -005/-012 (`backend/tests/` unit/smoke). -20/-52 are themselves tests.
- **Behavior-neutral removals** (TD-FE-26, -12, -40 console, -16, -66 dead state, -36 dedup): covered by `npm run typecheck`, the existing vitest suite, and `knip --strict` (no new dead refs). Use `npm run typecheck` (not bare `tsc` — the root tsconfig is a no-op stub).
- **Frontend vitest:** full suite runs only in the merge `preflight`; use `npm run verify` (change-scoped) in the inner loop. If full-suite flake appears under sandbox CPU contention, `--no-file-parallelism` is the known-green fallback; `isolate:true` is load-bearing — do not disable it.
- **Backend tests:** `backend/.venv/bin/python -m pytest <path> -q` (patch-where-used). The root `backend/test_*.py` files are **live production probes**, not unit tests — used here only for Wave-0/-012/-68 smoke, never as the suite.
- **Merge gate:** one green serial `npm run preflight` **and `backend/tests/` pytest green**. Preflight hard steps (typecheck, vitest, build, Playwright e2e, knip) must pass; advisory steps (lint, format:check, bundle:check) are reported, non-blocking. Run `prettier --check` on touched FE files per wave.

---

## 8. Risks, couplings, abort criteria

- **Verify-first findings.** TD-FE-73 already dropped (endpoint not deployed, settled at scoping). The remaining four (TD-FE-23/-42/-56/-25) adjust their fix to the Wave-0 finding rather than dropping.
- **Shared-file churn.** TD-FE-24/-26/-40 touch regulatory + mission-control files; TD-FE-56/-11 both touch `AgentProfile`. Sequence within each wave so each file is rewritten once; run the broader vitest + `prettier --check` when touching shared test infra/fixtures (sibling collisions).
- **Long-lived branch drift.** A 25-item branch may lag `master`; merge `master` in and re-preflight if it advances.
- **Abort criterion (per item):** if a Wave-0 finding shows an item is actually a behavior change beyond its stated scope (e.g., TD-FE-25 needs a new persist path that ripples), split it out to a follow-on spec rather than widen this phase.
- **Cross-stack confirmation rule.** Per CLAUDE.md, confirm any backend response shape against a live call before writing FE against it (no auto-generated client). Applies to TD-FE-23, -42 (and -73 if/when its endpoint ships).

---

## 9. Acceptance criteria (phase-level)

1. All in-scope entries are resolved (with a test where behavior changed). TD-FE-73 is excluded up front (endpoint not deployed) and recorded carried-forward, not counted against this criterion.
2. The two correctness bugs (TD-FE-64, TD-FE-23) are fixed and covered by passing tests.
3. `docs/TECH_DEBT.md` reflects reality: resolved entries marked/archived, index updated, and the register reconciled per the Wave-9 ledger (narrow TD-FE-40/-16; close TD-FE-45/-48).
4. One green serial `npm run preflight` (hard steps) + `backend/tests/` pytest green on the phase branch; advisory-step status reported.
5. Merged to `master` via `--no-ff` and pushed; branch deleted.
6. The 4 follow-on specs (38–41) and the untouched blocked/decision/accepted entries remain clearly tracked in the register.

---

## 10. References

- Register: `docs/TECH_DEBT.md` (backend TD-004/005/012; TD-FE-8…73) and `docs/TECH_DEBT_ARCHIVE.md`.
- Audit: `docs/tech-debt-audit-2026-06-15.html` (resolvability triage, difficulty/effort grading, file:line evidence).
- Spec review round 1: `docs/reviews/37-tech-debt-paydown-design-spec-review-1.md` + synthesis `…-spec-synthesis-1.md`.
- Conventions: `CLAUDE.md` (branch model, commit granularity, polyglot rules, business state, preflight), `frontend/src/features/README.md`, `backend/TESTING.md`, ADR index `docs/adr/README.md`.
- Backend map: `docs/architecture/BACKEND.md`.
