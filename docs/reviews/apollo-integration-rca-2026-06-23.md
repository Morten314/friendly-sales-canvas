# Apollo Lead Discovery — Root-Cause Analysis

**Org:** `4ab92719-02cf-4fe5-92b7-11a17755349b` · **User:** `test123@brewra.com` (uid `q6RoZwsOZPccMVhkeDd12y8IJHU2`)
**Backend:** https://brewra-gtm-intelligence.onrender.com · **Repo HEAD at investigation:** `c391be8` (all relevant fixes present)
**Date:** 2026-06-23

> Method: live read-only probes of the deployed backend for this org + an end-to-end FE/BE code map + an adversarial verification pass on each symptom. Where the verification corrected an initial hypothesis, the corrected understanding is recorded here.

---

## 0. Update — 2026-06-23 (post-investigation)

Two corrections after confirming infrastructure and shipping fixes:

- **The backend is on an always-on Starter instance ($7/mo, 512 MB / 0.5 CPU) — it does NOT sleep.** So the "Render free-tier cold start" attribution below (S3, S5, cross-cutting #3) is **wrong**. Re-probing the live endpoints showed `/signal-lead-map_claude` **10/10 → `200` @ ~3 s with no cold-start spike**; the `502 "Tunnel connection failed"` errors seen during the investigation were the **sandbox's egress proxy** rejecting the CONNECT (instant ~0.03 s), **not Render**. The user's "Could not load matched leads" was therefore a **rare transient** (deploy/restart/brief network blip), which `retry:false` turned into a hard error — not a recurring cold start. (Render's "Build Pipeline = Starter, $5/1000 build-min" is separate build billing, irrelevant to uptime.)
- **Fixes implemented** on branch `worktree-apollo-ux-fixes` (off `master c391be8`; full unit suite green — 997/997 — not yet merged): #1 Scout Lead Stream → real `/v2/leads` merged with scores, unscored rows shown as "Unscored" (`84e4555`); #2/#3 `useSignalLeadMap` retry+backoff + "Try again" + recompute spinner/toast (`283bc4f`); #4 Apollo tile shows the created count + a "View leads in Customers → Lead Stream" link (`6959055`); #5 `render.yaml` `free → starter` (`72a4da9`) — a **runtime no-op** since the live instance is already Starter, kept only so a future Blueprint deploy can't downgrade the live service.

Everything below is preserved as written at investigation time; treat the S3 / S5 / cross-cutting-#3 cold-start wording as **superseded by this update**. The data-path findings (S2, S4) and the fix recommendations are unaffected.

---

## 1. TL;DR

The backend and the Apollo discovery pipeline are **healthy** for this org. **97 verified Apollo leads exist**, the latest discovery run completed cleanly (created 9 net-new, deduped 64, 0 errors), and the signal↔lead mapping endpoint returns a rich, correct result (110 links across 15 signals) both warm and on recompute. **No data is lost or broken.**

Every reported symptom is a **frontend display-path mismatch, a UX-expectation gap, or a rare transient backend blip** — not a broken pipeline. (See §0: the backend is always-on; the cold-start framing below is superseded.) The two highest-impact issues:

1. **Scout's "Your Lead Stream" reads a different backend surface than where Apollo leads live.** It reads `/leads/market-scores` (which has never produced rows for this org → it shows built-in demo leads). The real Apollo leads are on the **Customers → Lead Stream** screen (`/v2/leads`).
2. **The Signals "Find Matched Leads" call has `retry:false`**, so a single transient non-2xx flips the card to a red "Could not load matched leads" with no automatic retry — even though the endpoint works on a warm call.

**Immediate workaround for the user:** the discovered leads are real and live — view them under **Customers → Lead Stream** (filter by Apollo), not in Mission Control or Scout's Lead Stream. For the Signals matched-leads error, retrying after the backend is warm succeeds.

---

## 2. What is actually working (live evidence)

- **Apollo connected.** `GET /connectors/apollo/status` → `200 {connected:true, last_discovery_at:2026-06-23T11:47, credits_consumed_total:0, low_credit:false, icp_changed_since_last_discovery:false}`.
- **Latest discovery succeeded.** `GET /connectors/apollo/discover/status` → run `278fae42` `status="completed"`, `progress 100%`, counts `{searched:100, qualified:10, selected:10, revealed:10, verified:9, created:9, matched:0, skipped_duplicates:64, errors:[]}`.
- **97 Apollo leads exist and are retrievable.** `GET /v2/leads?org_id=ORG` → `200 {total:97}`; every lead `source="apollo"`, `apollo_origin="discovery"`, `email_status="verified"`. Same 97 via `/leads` and `/connectors/apollo/leads/export`.
- **Org scoping is correct.** `org_id="brewra"` and a bogus UUID both → `200 {total:0}` — no cross-tenant leakage, no false positives.
- **Signal→lead mapping works, warm and on recompute.** `POST /signal-lead-map_claude {refresh:false}` → `200`, 15 signals / 110 links / relevance `{high:49, medium:52, low:9}`, every mapped signal has ≥1 lead. `{refresh:true}` → `200`, fresh 6-signal / 58-link mapping. **The server recompute path works.**
- **Claude is wired.** Live calls returned real Claude mappings → `CLAUDE_API_KEY`/`ANTHROPIC_API_KEY` is set (the "API key unset → 500" theory is **refuted**).
- **Signals exist.** `GET /v2/fetch-signals?user_id=USER` → `200 {total:38}`.

**The one thing that has never run for this org: lead market-scoring.** `GET /leads/market-scores/status` → `404 "No market scoring run found"`. This single gap drives the Scout symptom (S4).

**Infrastructure note (corrected — see §0):** the `502 "Tunnel connection failed"` responses during probing were the **sandbox egress proxy** (instant ~0.03 s rejects), **not** Render — re-probing showed the live endpoints healthy with no cold-start spike, and the service runs on an **always-on Starter instance**. `backend/render.yaml` has `autoDeploy:false`, so Render deploys only on a manual trigger and the live commit can lag `master` — but the service does not sleep.

---

## 3. Symptom-by-symptom

### S1 — "Your ICP hasn't changed" dialog — ✅ working as designed
- **Cause:** This is the rediscovery-guard confirmation. Backend reports `icp_changed_since_last_discovery=false` with a non-null `last_discovery_at`, so the FE asks "you already discovered against this same ICP — proceed anyway?" *"Continue anyway"* → `launch("keep")` → `POST /connectors/apollo/discover {mode:"keep"}`, which proceeds.
- **Evidence:** `discoveryPrompt.ts:7-11` (guard requires `!icpChanged && hasPriorDiscovery`); `ApolloTile.tsx:117-124,245-250`; `DiscoveryDialogs.tsx:33-51`. The flag is taken verbatim from the backend — the FE does no ICP fingerprinting, so it structurally cannot fire on a *changed* ICP (that returns a different dialog). Live run `278fae42` proves "Continue anyway" did proceed.
- **Severity:** Cosmetic. Not a bug. (Minor: actual button label is *"Continue anyway"*.)

### S2 — "Discovery completes (100%) but no new leads appear" — ⚠️ real UX gap (data is fine)
- **Cause:** The Mission Control Apollo tile **never renders a leads list — by design**. For `status="completed"` it shows only `"Discovery complete · <date>"` (`ApolloTile.tsx:167-170`); `counts.created` is never referenced and there is no leads list anywhere in `features/connectors`. The discovery genuinely succeeded (`created:9`; 97 total leads); leads surface on the **Customers → Lead Stream** (`/v2/leads`), which Mission Control does not link to.
- **Why it feels broken:** the tile is a dead-end — it surfaces neither the `created:9` count nor any breadcrumb to where the leads went. And in the live `icp_changed=false` state, the only in-tile "Download existing leads" affordance does **not** appear — it lives inside `KeepReplaceDownloadPrompt` (`DiscoveryDialogs.tsx:84`), which fires only when the ICP changed. So in the observed state there is **zero** in-tile path to the leads.
- **Also:** repeat runs mostly dedupe (`skipped_duplicates:64`), so a *re-run* can legitimately net 0 new leads.
- **Severity:** UX gap / product gap (not lost data).

### S3 — "Loading signals… for a while" — ✅ latency, not a defect
- **Cause:** Render cold-start latency on a single `GET /v2/fetch-signals`. The spinner is gated solely on local `isLoading`, set at `loadSignals` start (`SignalsPage.tsx:122`) and cleared in a `finally` that always runs (`:186-188`). No retry loop, no blocking lead-map dependency (the lead-map query feeds per-card sections only, never the page spinner), no Suspense fallback. On a real backend error it shows sample data + a toast rather than spinning forever.
- **Evidence:** `SignalsPage.tsx:750-754`; `services/signals.ts:21-29`. Live: `GET /v2/fetch-signals` → `200 {total:38}` (FE pages to `limit=10`).
- **Severity:** UX-confusion (latency).

### S4 — Scout "Your Lead Stream": Apollo filter shows nothing — ⚠️ wrong surface + missing market-scoring
- **Cause (headline):** Scout's `LeadsTable` reads **only** `POST /leads/market-scores` (`LeadsTable.tsx:409`) — it never reads `/v2/leads`. Market-scoring has **never produced rows** for this org (live `404`), so the table shows the component's built-in **demo leads** (`baseLeads = apiHeatmapLeads ?? heatmapLeads`, `LeadsTable.tsx:534`), whose sources are `"HubSpot"`/`"Prospect List"` → `normalizeLeadSource` → `"unknown"`. Selecting **Apollo** (exact match on `"apollo"`) therefore matches zero. The repo's own test asserts `filterLeadsBySource(heatmapLeads,"apollo").length === 0`.
- **Refinements from verification (mechanics, not headline):**
  - The FE sends `refresh:true`, which does **not** 404 — the backend *enqueues* a scoring run and returns `200`/empty. The `404` I observed was from a `refresh:false` probe.
  - Demo data shows only when `apiHeatmapLeads` is `null` (default page visit, or a thrown/non-2xx error). On a `200`-with-empty-rows, `apiHeatmapLeads` becomes `[]` and `[] ?? heatmapLeads === []`, so demo is hidden and **every** filter shows "No leads match this filter."
  - Visiting Scout does **not** auto-fetch scores; `fetchMarketScores` fires only from the Header refresh button (`Header.tsx:272/293` → `scoutRefresh` → `scoutLeadStreamHeatmapRefresh`). Clicking refresh *does* enqueue a run, and backend scoring carries `source` through (`orchestrator.py:375`), so a *completed* scoring run on this org's Apollo leads would make the Apollo filter match.
- **Net:** Scout shows demo/placeholder data because market-scoring never produced rows for this org; the real Apollo leads are on **Customers → Lead Stream** (`/v2/leads`, `LeadStream.tsx` via `services/leads.ts`), which would show them and whose Apollo filter would match.
- **Severity:** Real bug / surface inconsistency.

### S5 — "Find Matched Leads → Could not load matched leads" — ⚠️ cold-start + no retry (endpoint is fine)
- **Cause:** The red text renders when `leadsError === query.isError === true` (`SignalCard.tsx:150-156`). `useSignalLeadMap` has `retry:false` (`useSignalLeadMap.ts:22`), so a **single** non-2xx (a Render cold-start `502`/`500`) flips the query to error with no automatic retry. Warm, the endpoint returns a rich 110-link mapping.
- **Refuted alternatives:** (a) `ANTHROPIC_API_KEY` unset — refuted (live Claude mappings). (b) Contract-shape mismatch — **refuted**: the FE zod schema (`contracts.ts:28-36`) and read path (`useSignalLeadMap.ts:25` `query.data?.data.mapping`) both correctly target `data.mapping`, exactly matching the live `{status, data:{mapping}}` envelope.
- **Latent risk (not triggered today):** the transport parses with `schema.parse` (throws) not `safeParse` (`shared/api/client.ts:21`) and `data` is non-optional (`contracts.ts:31`), so a malformed-but-`200` body would deterministically throw → the same red error.
- **Behavioral note:** `isError` is **org-level** (one shared query), so a single cold-start failure shows the error on **all** expanded cards at once; a later successful refetch clears it for all.
- **Severity:** Real bug (transient, but user-facing and not self-healing without a manual retry).

### S6 — "Recompute lead mapping does nothing" — ⚠️ feedback gap (NOT a silent no-op)
- **Initial hypothesis was wrong.** `refresh()` routes through `queryClient.fetchQuery` against the **shared** query key (`useSignalLeadMap.ts:60-71`), so it **does** update the UI: on success the cards re-render with the recomputed leads / "Affects N leads" counts; on failure the open leads section flips to "Could not load matched leads." (driven by the shared `isError`). The "silent no-op" was the *old* `setQueryData` implementation, already replaced — **TD-FE-72, resolved in Phase 37 (commit `00c2021`)**. Backend `refresh:true` works (live: fresh mapping).
- **The real residual gap (why it "feels like nothing happened"):**
  1. **No in-flight indicator.** During a refetch React Query keeps `isLoading` false (it sets `isFetching`), and the card spinner is gated on `isLoading` — so no spinner/toast shows while recompute runs.
  2. **No success toast** — only `console.warn` on failure; no explicit "recomputed" confirmation.
  3. The always-visible **page-level** "Recompute" button (`SignalsPage.tsx:746`) produces no visible card-body change when all leads sections are collapsed; the only signal is the "Affects N leads" count.
- **Severity:** UX gap (feedback), not a functional defect.

---

## 4. Cross-cutting root causes

1. **Two different lead surfaces.** Customers → Lead Stream reads `/v2/leads` (shows the 97 Apollo leads, Apollo filter matches). Scout → "Your Lead Stream" reads `/leads/market-scores` (a scored-leads view). They are not interchangeable, and Apollo leads only appear in Scout after a market-scoring run completes. (S2, S4)
2. **Market-scoring has never run for this org.** Until it does, Scout shows demo placeholders. It is a separate background step, only triggered by the Header refresh button, and there is no evidence the enqueued run completes on the free tier. (S4)
3. **Rare transient backend blips** (deploy/restart/brief network — NOT cold starts; the instance is always-on, see §0) + FE `retry:false` + missing in-flight/retry affordances. One blip produces a user-facing error that doesn't self-heal. (S3, S5, S6)
4. **Mission Control tile shows no leads by design** and gives no count or pointer to where they went. (S2)

---

## 5. Recommended fixes (prioritized)

### P0
1. **Make Scout's "Your Lead Stream" show the Apollo leads.** *(choose one)*
   - **Option A (FE-only, simplest):** point Scout's lead list at `/v2/leads` (same source the Customers Lead Stream already uses), or merge `/v2/leads` rows into the table so discovered leads appear immediately regardless of scoring state.
   - **Option B (needs BE/ops verification):** auto-trigger market-scoring when discovery completes, and **verify the enqueued `refresh:true` run actually finishes** on the current Render tier (it may be timing out). Until confirmed to complete, prefer Option A.
   - Also **suppress the demo `HubSpot`/`Prospect List` leads for a real org** — showing placeholder data to a live tenant is misleading (`LeadsTable.tsx:534`).
2. **Add retry/backoff to `useSignalLeadMap`** (`retry:false` → a couple of retries with backoff) **and a visible "Try again" affordance** on the error state. This alone removes most of S5. *(FE-only)*

### P1
3. **Surface recompute progress + result.** Drive the in-flight indicator off `isFetching` (not `isLoading`) so the spinner shows during recompute, and add a success/failure toast. Fixes S6's "feels inert." *(FE-only)*
4. **Add a post-discovery pointer in the Apollo tile.** In the `complete` state show the `created` count and a link: *"Created N leads — view them in Customers → Lead Stream."* Optionally expose a view/download affordance even in the unchanged-ICP (rediscovery-guard) state. Fixes the S2 dead-end. *(FE-only)*

### P2
5. ~~**Kill cold starts at the source.**~~ **Already satisfied — not needed.** The backend is on an always-on Starter instance (see §0), so there are no cold starts to kill. The committed `render.yaml` `free → starter` change is kept only to keep the blueprint in sync (so a future Blueprint deploy can't downgrade the live service); it changes nothing at runtime. If transient blips recur, check **Render → `brewra` → Logs** for `Out of memory`/restart/timeout (the 512 MB / 0.5 CPU instance is small for the LLM-backed `/signal-lead-map_claude`); a bump to Standard would be the remedy. *(Render/ops — verification only)*
6. **Harden the lead-map parse (latent).** Use `safeParse` (or make `data` optional) in `SignalLeadMapResponseSchema` so a malformed-but-`200` body degrades to empty instead of throwing. Cheap insurance. *(FE-only)*

**Fix-type summary:** P0-1A, P0-2, P1-3, P1-4, P2-6 are FE-only (all implemented on `worktree-apollo-ux-fixes` except P2-6). P0-1B needs BE/ops verification. P2-5 is already satisfied (always-on).

---

## 6. Open questions to confirm

1. **What commits are actually deployed?** `render.yaml autoDeploy:false` and no in-repo pin of the Vercel/Render commits. Confirm the live FE/backend include the recent fixes (`dcc9dc4`, `594d3ab`, `52ef6cb`) before attributing any residual symptom to code. (Backend behavior observed here is correct regardless; the FE deploy state is the open one.) — *Resolved re: infra: the backend instance type is confirmed always-on Starter, so cold starts are off the table; the open part is purely which git commit each surface serves.*
2. **Should market-scoring auto-run after discovery completes?** Today it's a separate, manually-triggered step that has never run for this org.
3. **Does the `refresh:true` scoring run actually complete on the current Render tier**, or does it time out? This decides Option A vs B for P0-1.
4. **Did the user ever run discovery in "replace" mode?** All observed runs were `mode="keep"`. The replace path (and its download prompt) is only reachable when the ICP changed.
5. **Should demo `HubSpot`/`Prospect List` leads ever show for a real org**, or is that a dev-only placeholder that should be suppressed once an org exists?
