# Signals CTA: Find Matched Leads → Save Briefing — Design Spec

**Date:** 2026-06-19
**Spec:** 38 (pairs with `plans/38-signals-cta.md`)
**Branch:** `38-signals-cta`
**Status:** Reviewed (rounds 1–3) — revised per `docs/reviews/38-signals-cta-design-spec-synthesis-{1,2,3}.md`; round-3 recommendation `no` (ready). Open questions resolved (toast UX; TD-FE-73 tightened in-branch but left `open` for a populated re-capture). Live grounding 2026-06-19: endpoint envelope confirmed (`200`); populated `mapping[]` capture pending an org with leads (tested org has 3 signals, 0 leads → valid empty map).
**Scope:** Frontend only (`frontend/src/features/signals`, with a write into `frontend/src/features/artifacts`)

> Supersedes the standalone `specs/Signal_DesignSpec.md` ("Signals CTA — Design Spec", 2026-06-18), which is removed once this spec lands. This version reconciles that approved design with the current codebase and live backend.

---

## Problem

After expanding a Signal card ("Read more"), there is no actionable path forward. The user can read the description, sources, and recommendations, but has no clear next step — especially if they don't want to open an agentic chat.

## Goal

Give users a direct, guided path from **signal discovery → matched-lead identification → exportable briefing**, without leaving the Signals page, and reliably *deliver* that briefing into the Artefacts library. (Delivery is reliable; **retention is not durable** — see §5 and Out of Scope: a delivered briefing is visible until the user navigates away from `/artifacts`, because the library has no data layer.)

---

## Context: what grounding against the codebase changed

The original `Signal_DesignSpec.md` was written before several facts were verified. They are settled here.

1. **The signal→lead map backend is LIVE — and this satisfies TD-FE-73's trigger.** `/signal-lead-map_claude` is registered in production's OpenAPI (`brewra-gtm-intelligence.onrender.com/openapi.json`, 60 routes) and a `POST` probe returns `200`. The data this feature consumes is real and available with **no backend work**.
   - `docs/TECH_DEBT.md` **TD-FE-73** (open) is "FE contract derived from code, not a live response"; its required action is to call the live endpoint with a real keyed `(user_id, org_id)` that has signals + leads, capture the JSON, and reconcile `SignalLeadMapResponseSchema`. Its pull-forward trigger is *"endpoint confirmed deployed on Render"* — which is now true. This spec therefore **pulls TD-FE-73 forward** as adjacent in-scope work (see Dependencies). **TD-FE-72 is already `resolved`/archived — do not touch it.**
   - The code comment at `useSignalLeadMap.ts:59-63` is stale: it claims a "dormant control [that] 404s," but `SignalsPage.tsx:691-692` already renders a visible **"Recompute lead mapping"** button wired to `refreshLeadMap()`, which swallows errors to a `console.warn` no-op. Reword the comment (control is live and visible, endpoint deployed); this is hygiene, not a blocker.

2. **Pushing to the Artefacts library requires a real hand-off — the obvious pattern is broken.** `ArtifactsPage` attaches its `addArtefact` listener in a mount `useEffect` (`ArtifactsPage.tsx:48`); it is the **only** listener for that event. `StrategistWorkspace` dispatches `addArtefact` (`:739/:793`) and *then* `setTimeout(() => navigate("/artifacts"), 1200)` (`:784/:834`). Because the dispatch happens while a *different* page is mounted (no listener) and `ArtifactsPage` mounts 1200 ms **later**, the event fires into the void — the artefact never lands (Strategist's save is silently broken too, masked at 0 users). **This feature must not copy that pattern.** It uses a delivery mechanism that works when dispatcher and listener are not co-mounted (see §5).

3. **An "Affects N leads" affordance already exists.** `SignalCard` accepts an `affectedLeadCount?` prop and renders a count badge. That count and this feature's leads section both derive from `leadsForSignal(signal.id)` — two views of the same data.

---

## UX Flow

### 1. Collapsed card — unchanged
Headline + snippet + thumbs up/down + bot icon. No change.

### 2. Expanded card (after "Read more") — unchanged content + one new control
Existing content: description, sources/citations, recommendations.

**New:** a `[Find Matched Leads]` button. It is **styled as disabled** (greyed) when the signal is not accepted, but is **functionally enabled** so it can explain itself:

- Implementation: render it visually-disabled with `aria-disabled={!isAccepted}` and an `onClick` guard — **not** a native `<button disabled>` (which would not fire `onClick`, making the explanatory click impossible).
- Clicking while not accepted → inline message *"Accept this signal to unlock matched leads"*. No navigation, no toast.
- The message auto-dismisses after ~3 s, and clears immediately when the signal is accepted (the CTA unlocks). The 3 s timer is cleared on card collapse and on unmount.

**Placement (within the expanded block):** description → sources/citations → `[Find Matched Leads]` button → (leads section, when open) → recommendations → "Show less".

### 3. Accept signal (thumbs up) — existing behavior + one side effect
Accept/reject remain independent signal-quality judgements; their existing behavior (API call via `actionMutation`, content-hash–keyed `acceptedSignals` set, localStorage persistence, "Accepted" header badge) is unchanged.

Side effects layered on top:
- **On accept:** `[Find Matched Leads]` becomes green and active.
- **On un-accept** (toggle thumbs up off): button reverts to the styled-disabled state; if that signal's leads section is open, it collapses.

### 4. Find Matched Leads (active state clicked)
An inline **leads section** expands **above the recommendations**, below the description/sources block. Only **one** signal's leads section is open at a time (page-held state).

The map is fetched once per `(org, user)` by `useSignalLeadMap`, which is "quiet (empty) while loading, disabled, or on error." The section must therefore distinguish three states (do not collapse them into one "no leads" message):

- **Loading** (`isLoading`): a loading affordance (spinner/skeleton), not "no leads."
- **Error** (`isError`): a short error line offering the existing **"Recompute lead mapping"** action. Recompute must give user feedback (a loading state and/or toast) and must actually **refetch/invalidate** the map query so the section transitions out of the error state on success — the current `refreshLeadMap` only `setQueryData`s on success and swallows failures to `console.warn`, so the section would otherwise stay stuck in the error UI silently. Wire recompute to trigger a real refetch (e.g. `queryClient.invalidateQueries` / `query.refetch`) rather than a fire-and-forget `setQueryData`.
- **Loaded, zero leads:** *"No matched leads found for this signal yet."* and **no** `[Save as Artefact]` button (nothing to export). The endpoint is live, but a given signal can genuinely map to zero leads. **This is the dominant case today:** an org with **no leads at all** (leads arrive via Apollo discovery / upload) yields an empty mapping for *every* signal — verified live 2026-06-19 (a real account: 3 signals, 0 leads → empty map). The feature delivers visible value only once the org has ingested leads; the empty-state must read as a calm "not yet," never as an error.
- **Loaded, ≥1 lead:** one row per lead + `[Save as Artefact]` at the bottom of the section.

Each lead row:
- **Company name** — `company || "Unknown company"` (the field is `.optional().default("")`).
- **Relevance badge**: `High` (green) / `Medium` (amber) / `Low` (grey). The map returns lowercase `high|medium|low` (`relevance` is `.catch("low")`, so always present); the badge label is normalized to title-case at render.

The per-lead `why` is **intentionally not shown in the UI** — it is reserved for the export, so the downloaded briefing is more valuable than what's on screen.

### 5. Save as Artefact
A single action that produces **one `ArtefactItem`** used for **two outputs**: a PDF download and a library entry. It does **not** use the broken Strategist dispatch-then-navigate pattern (see Context point 2).

On click, `handleSaveAsArtefact(signal, leads)` (in `SignalsPage`):

1. **Builds an `ArtefactItem`** (`features/artifacts/types.ts`) from the signal + matched leads — see "ArtefactItem mapping" below.
2. **Downloads a PDF** via `generateAndDownloadPDF(item)` (re-exported from `features/artifacts/index.ts`). Filename derives from the headline, slugified, with a short uniquifying suffix (e.g. a timestamp) so a re-save of the same signal does not silently overwrite the prior file. *(See "PDF escaping" — the generator needs minimal hardening to survive LLM free-text.)*
3. **Delivers to the library**, via a small **module-level pending-artefact queue** exported from `features/artifacts` (e.g. `enqueueArtefact(item)`). `SignalsPage` calls `enqueueArtefact(item)` — it does **not** dispatch a `window` event from `/signals`, because no listener is mounted there. **`ArtifactsPage` drains the queue on mount mirroring its existing live `addArtefact` listener exactly:** for each queued item, prepend it, `setActiveFolder(item.folder)`, and `setExpandedArtefact(item.id)` — the folder step is load-bearing, because `filteredArtefacts` hides foldered items (`folder: "Signal Briefings"`) at the root view, so a bare prepend would land the briefing in state but filter it out of the rendered list. The drain **clears the queue (once-only)** — no re-delivery on subsequent mounts, so no dedup is needed. `ArtifactsPage` also retains the live `addArtefact` listener for any same-page dispatch. This keeps the `features/artifacts` boundary clean (signals imports the exported `enqueueArtefact`, not artefacts internals).
4. **Confirms to the user** with a toast: *"Saved to Artefacts →"* linking to `/artifacts`. The user is **not** force-navigated off the signals feed (they may save several briefings in a session; the queue delivers regardless of when they next open the library).
   - **Decided (review round 1):** the toast replaces the original "navigate to `/artifacts` after save." The earlier "match Strategist (navigate)" choice predated the discovery that that pattern doesn't deliver; delivery is now decoupled via the queue, and the non-disruptive toast is the chosen UX.

#### PDF escaping (in scope)
`createSimplePDF` interpolates content raw into `( … ) Tj` string literals with no escaping, and writes into a Helvetica (WinAnsi) font with no encoding handling. The briefing's `title`, `description`, and per-lead `why` are LLM free-text. Two classes of breakage, both in scope to harden on the briefing's path:
- **Structural:** an unbalanced `(`/`)` or a `\` corrupts the PDF. Escape `\` → `\\`, `(` → `\(`, `)` → `\)`.
- **Encoding:** em/en-dashes, smart quotes, and bullets mojibake under Helvetica/WinAnsi even after structural escaping. Fold the common offenders to ASCII (em/en-dash → `-`, smart quotes → `'`/`"`, bullet → `-`).

Deeper structural issues in the generator (and residual non-ASCII such as accented names beyond the common fold) are deferred — see Out of Scope / TD.

#### ArtefactItem mapping

| `ArtefactItem` field | Value for a signal briefing |
|---|---|
| `id` | `signal-briefing-${signal.id}-${Date.now()}` |
| `agentName` | `signal.agent === "scout" ? "Scout" : "Profiler"` |
| `agentIcon` | `scout → Satellite`, `profiler → Target` (lucide; same map as `mockArtefacts.ts`) |
| `agentColor` | `scout → "bg-blue-500"`, `profiler → "bg-purple-500"` (per `mockArtefacts.ts`) |
| `taskNumber` | `"Signal Briefing"` |
| `timestamp` | `signal.timestamp` |
| `status` | `"new"` |
| `type` | `"report"` |
| `folder` | `"Signal Briefings"` (groups all such briefings under one folder) |
| `actionDelegated` | `Find matched leads for "${signal.headline}"` |
| `contextRationale` | `signal.snippet` |
| `systemImpact` | `${leads.length} matched lead(s) identified` |
| `actionPerformed` | `"Mapped accepted signal to matched leads"` |
| `outputSummary` | `${leads.length} matched leads with relevance and rationale` |
| `fullReport.title` | `signal.headline` |
| `fullReport.executiveSummary` | `signal.description` |
| `fullReport.keyFindings` | one entry per lead: ``${company || "Unknown company"} (Relevance: ${TitleCase(relevance)})`` + ``: ${why}`` **only when `why` is non-empty** — this is where the per-lead `why` rides into the PDF |
| `fullReport.analysis` | short standard line, e.g. `These ${leads.length} leads were matched to the signal based on ICP fit and the signal's context.` |
| `fullReport.recommendations` | `signal.NBAs?.map(n => n.nba)` (fallback `signal.nextBestMoves`) |
| `fullReport.charts` | omitted |

The agent→icon/color map lives in `mockArtefacts.ts` (`StrategistWorkspace` hardcodes `Compass`/`bg-indigo-500` for its own agent and is **not** a source for this map). Reuse the values via a small **feature-local** resolver in the signals feature — do not cross-feature-import artefacts internals (the `index.ts`-only boundary stands).

### 6. Reject (thumbs down) — unchanged
Dismisses the card; existing undo-toast behavior unchanged.

---

## Data Sources

All data is already available at interaction time — no new fetches triggered by the CTA.

| Data | Source |
|------|--------|
| Signal headline, description, snippet, timestamp, agent | `SignalCard` type (`features/signals/types.ts`) |
| Recommendations (NBAs) | `signal.NBAs` (fallback `signal.nextBestMoves`) |
| Matched leads (`lead_id`, `company`, `relevance`, `why`) | `useSignalLeadMap(orgId).leadsForSignal(signal.id)` |
| Map fetch state | `useSignalLeadMap(orgId).isLoading` / `.isError` (org-level; one fetch) |
| Accept state | `acceptedSignals` set (content-hash keyed) in `SignalsPage` → passed to each card as the boolean `isAccepted` |

The lead element type is `SignalLeadMapLead` (exported from `features/signals/contracts.ts`): `{ lead_id: string; company: string; relevance: "high" | "medium" | "low"; why: string }`, where `company`/`why` default to `""` and `relevance` falls back to `"low"`.

---

## Component Changes

### `SignalCard` (`features/signals/components/SignalCard.tsx`)
New props:
- `matchedLeads: SignalLeadMapLead[]` — from the page via `leadsForSignal(signal.id)`
- `leadsLoading: boolean`, `leadsError: boolean` — from the hook's `isLoading`/`isError`, to drive the three-state section
- `isLeadsExpanded: boolean` — page-held
- `onFindMatchedLeads: () => void` — toggles the leads section, or shows the lock message when not accepted
- `onSaveAsArtefact: () => void` — triggers the save flow
- `onRecomputeLeadMap?: () => void` — offered in the error state (wraps `refreshLeadMap`)

New UI (inside the existing expanded block, at the placement above):
- `[Find Matched Leads]` button — visually-disabled (`aria-disabled`) + `onClick` guard when `!isAccepted`; green/active when `isAccepted`
- inline lock message (with the timer lifecycle from §2)
- leads section with the four render states from §4 (loading / error+recompute / zero / rows)
- `[Save as Artefact]` at the bottom of the leads section (only when `matchedLeads.length > 0`)

`isAccepted`, `affectedLeadCount`, and the accept/reject/bot controls already exist and are unchanged.

### `SignalsPage` (`features/signals/pages/SignalsPage.tsx`)
- For each `SignalCard`, pass `matchedLeads={leadsForSignal(signal.id)}` plus `leadsLoading`/`leadsError` from the already-wired hook (`const { leadsForSignal, isLoading, isError, refresh: refreshLeadMap } = useSignalLeadMap(orgId)`).
- Add `expandedLeadsSignalId: string | null` — only one signal's leads section open at a time. Pass `isLeadsExpanded={expandedLeadsSignalId === signal.id}`; `onFindMatchedLeads` toggles it (and shows the lock message when the signal isn't accepted).
- Implement `handleSaveAsArtefact(signal, leads)` — builds the `ArtefactItem`, calls `generateAndDownloadPDF(item)`, calls `enqueueArtefact(item)`, and shows the "Saved to Artefacts →" toast (no forced navigation).
- On un-accept of a signal whose leads section is open, set `expandedLeadsSignalId` back to `null` (collapse).

### `features/artifacts` (delivery mechanism + barrel)
- Add a module-level pending-artefact queue with `enqueueArtefact(item)` and a `resetArtefactQueue()` (test-only reset).
- **Re-export through `features/artifacts/index.ts` (which currently exports only `artifactsRoutes`) every symbol `SignalsPage` consumes:** `enqueueArtefact`, `resetArtefactQueue`, `generateAndDownloadPDF`, and the `ArtefactItem` type. Signals imports all of these from the barrel — never deep-imports `lib/artefactPdf` or `types.ts` (the `import-x` no-internal-modules rule forbids it).
- `ArtifactsPage` drains the queue on mount mirroring its live `addArtefact` listener (prepend + `setActiveFolder` + `setExpandedArtefact`, once-only), and keeps the live listener.

---

## Accept / Reject Conditions (preserved)

| Action | Condition | Result |
|--------|-----------|--------|
| Accept (👍) | Any state | Marks signal accepted; unlocks Find Matched Leads |
| Un-accept (👍 again) | Already accepted | Removes accepted state; locks Find Matched Leads; collapses leads section if open |
| Reject (👎) | Any state | Dismisses card; existing undo-toast behavior unchanged |

Accept and reject remain independent signal-quality judgements. The CTA layer sits **on top of**, not inside, this judgement.

---

## Testing

Frontend (Vitest + Testing Library; no new e2e required):
- **`SignalCard`**: button is styled-disabled (`aria-disabled`) yet clickable when `!isAccepted` and shows the lock message; lock message auto-dismisses (timer cleared on collapse/unmount); button is green/active when accepted. Leads section renders the correct one of the four states (loading / error+recompute / zero / rows); rows show title-cased relevance and `company || "Unknown company"`; `[Save as Artefact]` is absent in the loading/error/zero states; the per-lead `why` is **not** present in the rendered DOM.
- **`SignalsPage`**: `handleSaveAsArtefact` builds an `ArtefactItem` with the mapping above (assert `fullReport.keyFindings` contains each lead's `why`, and omits the `: ` suffix when `why` is empty); calls the download path; calls `enqueueArtefact` with that item. Un-accepting an open signal collapses its leads section; only one leads section open at a time.
- **Library delivery (the regression guard)**: render `ArtifactsPage` *after* `enqueueArtefact(item)` and assert the briefing is **visible in the rendered DOM** — not merely present in the `artefacts` array — since a foldered item is filtered out of the root view unless the drain opens its folder. A membership-only assertion would pass while the user still sees nothing. Call `resetArtefactQueue()` in `beforeEach` so the module-singleton queue doesn't leak across tests.
- **Drain is once-only**: enqueue an item, mount `ArtifactsPage`, unmount, then remount — assert the item is **not re-prepended/duplicated** (the drain clears the queue; a second mount sees an empty queue).
- **Recompute exits the error state**: from the leads-section error state, invoking recompute triggers a real refetch/invalidate and the section transitions loading → resolved (guards against the prior silent `setQueryData`-only no-op that left the error UI stuck).
- **PDF escaping**: `createSimplePDF` output keeps balanced/escaped strings for inputs containing `(`, `)`, `\`, and `:)`.
- **Contract reconciliation (TD-FE-73)**: `contracts.test.ts` validates `SignalLeadMapResponseSchema` against a golden fixture captured from the live `/signal-lead-map_claude` response, with the tightened (non-permissive) field types.

`npm run preflight` is the merge gate (typecheck, lint, format:check, vitest, build, bundle, Playwright/VR, knip).

---

## Out of Scope

- Generating new AI explanations per lead at click time (the `why` is pre-computed in the map).
- File System Access API / folder picker.
- Per-lead action buttons within the leads section.
- Agentic chat from the expanded card.
- **Persisting the Artefacts library** — it stays in-memory/mock (`useState(mockArtefacts)`); a delivered briefing is visible only until the user **navigates away from `/artifacts`** (unmount discards the list and the queue has already drained), not merely until reload. Lifting it to a real store is a separate effort.
- **A correct PDF generator.** Minimal string-escaping and common-punctuation ASCII folding are in scope (§5); the generator's structural issues — hardcoded `/Length`, placeholder xref offsets, single-page `MediaBox` with no pagination/overflow — and **residual non-ASCII** (accented names, non-Latin scripts beyond the common fold) are **not** fixed here. Record as a new TD (PDF generator emits structurally non-compliant output; lead-heavy briefings clip past one page; non-WinAnsi glyphs mojibake). Shared with the existing Strategist artefact path.
- Any backend change — `/signal-lead-map_claude` is already live.

---

## Dependencies & Follow-ups

- **Live:** `/signal-lead-map_claude` (production). No deploy needed.
- **In scope (this branch):** **TD-FE-73** is now unblocked (endpoint deployed). **Tighten `SignalLeadMapResponseSchema`** (`features/signals/contracts.ts`) against the live shape. "Tighten" here means **reconcile to reality, not make brittle**:
  - Drop `.passthrough()` on shapes that prove stable and explicitly model the always-present fields the backend sends — including the top-level **`status`** (always `"success"` from `_build_result`) and `data.generated_at` / `data.cached`. The FE doesn't consume these, so either model them or let a plain `z.object` strip them — but **do not** apply `.strict()` to a shape where the backend sends FE-ignored extras (a plain object strips unknowns; `.strict()` would throw on them).
  - **Keep the `.default("")` on `company`/`why` and the `.catch("low")` on `relevance`.** This feature *depends* on those guards (the `company || "Unknown company"` / omit-empty-`why` mapping, and avoiding a single odd lead throwing an org-wide parse error that would error every card's leads section). The contract surface stays degrade-never-throw.
  - Update the contract test (`features/signals/contracts.test.ts`) with an anonymized golden fixture.
  - **Do not close TD-FE-73 in this branch.** Record the progress in `docs/TECH_DEBT.md` (envelope confirmed live + contract reconciled against the server-normalized `_parse_mapping` shape) and **narrow its remaining required-action to a populated empirical re-capture** — i.e. keep it `open` until a `(user_id, org_id)` with both signals *and* leads confirms the entry/lead sub-shapes against a non-empty `mapping[]`.
  - **Live capture status (2026-06-19):** the **envelope is confirmed live** — a real account returns `200 {status, data:{mapping, generated_at, cached}}`, matching `SignalLeadMapResponseSchema`'s top level. A **populated** `mapping[]` could not be captured because the only account checked so far has signals (3) but **0 leads**, so the service correctly short-circuits to an empty mapping. The per-entry / per-lead sub-shape is therefore reconciled against the backend's **server-normalized** construction in `lead_map.py::_parse_mapping` (it rebuilds each lead as `{lead_id, company, relevance∈{high,medium,low}, why}` and each entry as `{signal_id, headline, leads[]}` — deterministic, not LLM passthrough), which is a reliable source of truth for tightening. **Re-capture a populated response** when an org with both signals and leads exists (leads arrive via Apollo discovery / upload), to confirm the sub-shapes empirically.
  - **Capture method:** the registration DB carries no Firebase `uid`/`org_id` (the `uid`↔email map is Firebase-only), so capture from a logged-in browser session: on the live Signals page, DevTools → Network → the `signal-lead-map_claude` request — its **payload** yields `{user_id, org_id}` and its **response** is the live shape. (A browser `500` here is typically a Render cold-start/proxy timeout, not an endpoint failure — a direct retry returns `200`.) **PII guardrail:** committed golden fixtures in `contracts.test.ts` must use the captured *shape* with anonymized values, not raw prod customer identities.
- **Hygiene (in this work):** reword the stale `useSignalLeadMap.ts:59-63` comment (control is live/visible; endpoint deployed). **Do not** touch the already-resolved TD-FE-72.
- **New TD to record:** (a) signal briefings delivered to the Artefacts library do not survive navigating away from `/artifacts` (unmount discards the list; no data layer) — same class as existing Strategist artefacts; (b) the shared PDF generator emits structurally non-compliant output and mojibakes non-WinAnsi glyphs (beyond the in-scope escaping/fold). If the shared `enqueueArtefact` queue lands, Strategist's two broken dispatch sites should adopt it in a follow-up.
