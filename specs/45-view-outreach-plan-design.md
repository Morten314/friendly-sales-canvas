# View Outreach Plan — Design Spec

**NN:** 45
**Date:** 2026-07-02
**Status:** Draft (pre-review)
**Author:** Spec authored from the approved brainstorming design (this session).
**Stack:** Frontend-only (React PWA). **No backend change.**
**Relationship to prior work:**
- **Modifies** the **recommendation-level** "Save as Artifact" shipped by Spec/Plan 41 (`41-recommendation-artefact-design.md`, GTM playbook). This spec turns that button into **"View Outreach Plan"** and surfaces the generated content inline instead of forcing a download/library save.
- **Reuses unchanged:** the endpoint `POST /api/generate-recommendation-artefact_claude` and its `RecommendationArtefactResponse`; the builder `buildRecommendationPlaybookArtefact` (`lib/signalBriefing.ts`); and the artefact delivery surface `generateAndDownloadPDF` / `generateAndDownloadCsv` / `enqueueArtefact` (from Spec 41 & 43).
- **Distinct from / does not touch** the **signal-level** "Save as Artifact" in the matched-leads section (Spec/Plan 38).

---

## 1. Current Behaviour (starting point)

The recommendation-level button (rendered under the **Recommendations** heading in `SignalCard.tsx`, currently labelled "Save as Artifact") is **save-only**: one click silently (a) calls the LLM endpoint, (b) builds an `ArtefactItem`, then (c) **downloads a PDF + CSV and enqueues the playbook to the Artifacts library**, and (d) toasts. There is **no way to read the generated plan in-app**, and a "save" click has the surprising side effect of two immediate file downloads. The generated content is the five-field GTM playbook (`what_to_do`, `strategy`, `how_to_communicate`, `communication_channel`, `communication_template`).

## 2. Problem & Goal

Users want to **read** a recommendation's outreach plan on demand, in-app, without forced downloads or an implicit library write.

**Goal:** Rename the recommendation-level button to **"View Outreach Plan"**. Clicking it expands an **inline panel** under the recommendation showing the full generated plan. Exporting/saving becomes **explicit, user-initiated** actions inside the panel (Save to Library, Download PDF, Download CSV) plus a **Copy** control for the message template. The underlying generation call and artefact machinery are unchanged.

## 3. Scope

**In scope** — the single recommendation-level button under the "Recommendations" heading in `SignalCard.tsx`.

**Untouched:**
- The signal-level "Save as Artifact" in the matched-leads section (Spec 38).
- The backend endpoint, its Pydantic response, and the prompt (reused as-is).
- `buildRecommendationPlaybookArtefact`, the PDF/CSV generators, and the library queue (reused as-is).
- Gating semantics (accepted + answer loaded) — unchanged; only the locked-hint copy is updated to match the new label.

## 4. Non-Goals

- No backend / API / prompt change; the 5-field response shape is unchanged.
- No change to how the playbook is generated (same Claude call, same request payload).
- No new artefact fields, no new export formats.
- No change to the signal-level briefing flow.
- No change to the acceptance/answer gating rules (see §5.2, R-3).
- Not persisting generated plans beyond page-session state (matches existing `recommendationAnswers`).

## 5. UX / Interaction Design

### 5.1 The button

- Label: **"Save as Artifact" → "View Outreach Plan"**.
- Toggles to **"Hide Outreach Plan"** while the panel is open.
- While a generation call is in flight: disabled affordance with a spinner + **"Generating…"** (unchanged from today).
- **Label priority:** generating → "Generating…"; else panel open → "Hide Outreach Plan"; else → "View Outreach Plan".
- Same placement and styling as the current button — in the recommendation answer action row, in the left group beside the Accept/Reject icons; the "Chat with Scout/Profiler" button stays on the right.

### 5.2 Gating (unchanged)

The button is only actionable when the signal is **accepted** AND the recommendation **answer is loaded/cached** (`isAccepted && answerCached`). The answer is a required input to the generation call, so this precondition is functional, not merely product-driven. The existing transient amber-hint mechanism is reused, with copy updated for the new label:

| State | Hint |
|---|---|
| Not accepted | "Accept this signal to view the outreach plan" |
| Accepted, answer not yet loaded | "Load the recommendation answer first." |

### 5.3 Click behaviour — toggle + generate-once + cache

1. **Not generated, panel closed** → open the panel and start generation (loading state).
2. **Click while generating** → ignored (re-entry guard, as today — prevents a duplicate paid Claude call).
3. **Already generated, panel closed** → open **instantly from cache**; **no** second backend call.
4. **Panel open** → collapse it.

### 5.4 Panel states

- **Loading:** spinner + "Generating outreach plan…".
- **Loaded:** the plan sections (§6) followed by the footer actions (§5.5).
- **Error:** the panel shows inline red text "Could not generate outreach plan — please try again." with a **"Try again"** control (`onRetry`) that re-runs generation while keeping the panel open. The header button independently keeps toggling Hide/collapse. Reuses the existing per-key error state; no partial panel is shown. (Note: collapsing then reopening an errored, not-yet-cached plan also re-runs generation — see §5.3 step 1.)

### 5.5 Actions (loaded state, inside the panel)

**Footer button row** — a horizontal group at the bottom of the panel. All explicit and user-initiated; each builds the `ArtefactItem` on demand from the **cached** plan via the existing `buildRecommendationPlaybookArtefact(signal, recommendation, index, answer, leads, plan)` and delegates to the existing delivery function:

- **Save to Library** → `enqueueArtefact(item)`; success toast "Saved to Artifacts…" with a "View library" action (reuses the current toast).
- **Download PDF** → `generateAndDownloadPDF(item)`.
- **Download CSV** → `generateAndDownloadCsv(item)`. **Shown only when the signal has ≥ 1 matched lead** (the CSV is lead rows; consistent with the library hiding the CSV control when `leadRows` is empty — see `artifacts/types.ts`).

**Template Copy** — *not* part of the footer row: a small **Copy** control rendered with the message-template block itself (§6 row 5). Copies `communication_template` via `navigator.clipboard.writeText` with a brief "Copied" confirmation; present only when `communication_template` is non-empty.

### 5.6 What is removed

Clicking the button **no longer** auto-downloads a PDF/CSV or auto-enqueues to the Artifacts library. Those become the explicit footer buttons above — no capability is lost, only the surprise side effects.

## 6. Panel Content

Rendered **directly from the five fields** of `RecommendationArtefactResponse` (not the reshuffled `ArtefactItem.fullReport`). Each section renders **only when its field is non-empty** (degrade-gracefully; the zod schema defaults every field to `""`). Panel header: **"Outreach Plan"** (the recommendation text is already the row title above the panel; the answer and matched leads are already shown elsewhere on the card, so they are intentionally not repeated here).

| Order | Label | Field | Render |
|---|---|---|---|
| 1 | What to do | `what_to_do` | paragraph |
| 2 | Strategy | `strategy` | paragraph |
| 3 | How to communicate | `how_to_communicate` | paragraph |
| 4 | Channel | `communication_channel` | inline label / badge |
| 5 | Message template | `communication_template` | bordered `whitespace-pre-wrap` block + Copy control (§5.5) |

## 7. Component Design

### 7.1 New — `OutreachPlanPanel` (`components/OutreachPlanPanel.tsx`)

Presentational, no data fetching. Extracted (rather than inlined) to keep the already-large `SignalCard.tsx` (698 LOC) from growing and to unit-test the panel in isolation.

**Props:**
- `plan: RecommendationArtefactResponse | null`
- `isGenerating: boolean`
- `isError: boolean`
- `hasLeads: boolean` — controls Download-CSV visibility
- `onRetry: () => void`
- `onSaveToLibrary: () => void`
- `onDownloadPdf: () => void`
- `onDownloadCsv: () => void`

Renders the states in §5.4, the sections in §6, and the footer in §5.5. The template Copy-to-clipboard is handled internally (local "copied" state; guards `navigator.clipboard`).

### 7.2 `SignalCard` (`components/SignalCard.tsx`)

- Relabel the recommendation-level button; toggle "View / Hide"; keep the "Generating…" state.
- `onClick` → `onViewOutreachPlan(index)` (renamed from `onSaveRecommendationAsArtefact`), keeping the gated-hint wrapper (renamed `handleViewPlanClick`) with the updated hint copy (§5.2).
- Render `<OutreachPlanPanel>` in the recommendation block — in the place currently occupied by the inline `artefactHint` / error paragraphs — when `planExpandedKeys.has(key)`.
- **New/changed props** (supplied by the page): the plan for the current key (from `recommendationPlans`), `planExpandedKeys: Set<string>`, `hasLeads` (`matchedLeads.length > 0`), and the action callbacks — `onViewOutreachPlan(index)` (header toggle), `onRetryOutreachPlan(index)` (panel "Try again"; wired to the panel's `onRetry`), `onSaveToLibrary(index)`, `onDownloadPdf(index)`, `onDownloadCsv(index)`. **Removed:** `onSaveRecommendationAsArtefact`. `recommendationArtefactGeneratingKey` / `recommendationArtefactErrorKey` are retained.

### 7.3 `SignalsPage` (`pages/SignalsPage.tsx`)

- **New state:**
  - `recommendationPlans: Record<string, RecommendationArtefactResponse>` — generated-plan cache keyed `${signalId}-${index}`.
  - `planExpandedKeys: Set<string>` — which panels are open.
  - Keep `recommendationArtefactGenerating` (`string | null`) and `recommendationArtefactError` (`string | null`).
- **Shared generation helper** `generatePlan(signal, index)` — the single call path used by both entry points below: re-entry guard (no-op if `recommendationArtefactGenerating` is already this key) → clear the error key → set generating → `generateRecommendationArtefact(uid, orgId, { …same payload as today })` → on success cache the plan (`recommendationPlans`) + clear generating; on error set the error key + clear generating.
- **Toggle handler** `handleViewOutreachPlan(signal, index)`:
  - Panel open → collapse (remove key) and return.
  - Otherwise open (add key). If a plan is already cached → done (no call). Else → `generatePlan(signal, index)`.
- **Retry handler** `handleRetryOutreachPlan(signal, index)` → `generatePlan(signal, index)` (panel stays open). Wired to the panel's `onRetry`.
- **New delivery handlers** (build the item from the cached plan, then delegate): `handleSavePlanToLibrary`, `handleDownloadPlanPdf`, `handleDownloadPlanCsv`.
- Pass the new props to `SignalCard`.
- Extend the existing "reset on recommendation collapse" effect to also clear `planExpandedKeys` / the error key for the collapsed recommendation.

## 8. Backend

**No change.** `POST /api/generate-recommendation-artefact_claude` and `RecommendationArtefactResponse` (`what_to_do`, `strategy`, `how_to_communicate`, `communication_channel`, `communication_template`) are reused verbatim. This is a frontend-only feature.

## 9. Affected Files

| File | Change |
|---|---|
| `frontend/src/features/signals/components/OutreachPlanPanel.tsx` | **NEW** presentational panel |
| `frontend/src/features/signals/components/SignalCard.tsx` | relabel + toggle + render panel + prop changes |
| `frontend/src/features/signals/pages/SignalsPage.tsx` | cache/expanded state, handler rework, delivery handlers, props |
| `frontend/src/features/signals/components/__tests__/SignalCard.*.test.tsx` | update label + interaction expectations |
| `frontend/src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx` | update flow to inline view + explicit save buttons |
| `frontend/src/features/signals/components/__tests__/OutreachPlanPanel.test.tsx` | **NEW** |

**No change:** `services/signals.ts`, `contracts.ts`, `lib/signalBriefing.ts`, `features/artifacts/*`, and all backend files.

## 10. Error Handling

| Scenario | Behaviour |
|---|---|
| Generation call fails | inline error (§5.4) + button retry; no partial panel; per-key error state |
| Empty / partial response | schema defaults each field to `""`; empty sections omitted; if **all** fields empty, panel shows a minimal "No plan content returned." note (degrade-never-throw) |
| Clipboard unavailable | Copy guards `navigator.clipboard` and silently no-ops |
| Re-click while generating | ignored (re-entry guard) |
| Download/library on a 0-lead signal | PDF & Save-to-Library work; CSV button is hidden (§5.5) |

## 11. Testing Strategy

Frontend only — **vitest + React Testing Library**, using **`fireEvent`** (not `user-event`, which is undeclared in this repo). Mock the signals service (`generateRecommendationArtefact`) as the existing recommendation tests do.

- **`OutreachPlanPanel`:** loading spinner; loaded renders each non-empty section; an empty field is omitted; error state renders + retry fires `onRetry`; CSV button hidden when `hasLeads=false`; Copy writes the template to a mocked `navigator.clipboard`.
- **`SignalCard`:** button text is "View Outreach Plan"; the two locked-hint messages; toggling shows then hides the panel; "Generating…" shown while `recommendationArtefactGeneratingKey` matches.
- **`SignalsPage.recommendation`:** click → service called exactly once → plan cached → collapse + reopen calls the service **no** further times; "Save to Library" enqueues + toasts; error path sets the inline error.

## 12. Risks & Open Decisions

- **R-1 (resolved, in scope):** Losing one-click save. Mitigated by the explicit Save-to-Library / Download-PDF / Download-CSV buttons in the panel — full capability retained, only the surprise auto-downloads removed.
- **R-2 (accepted):** Cache lifetime. Plans live in page-session state and are discarded on navigation, exactly like `recommendationAnswers`. Re-generation on a later visit is acceptable; no persistence added.
- **R-3 (deliberate):** Gating unchanged. If product later wants "View" available before acceptance, that is a follow-up (it would still require the answer to be loadable) and is out of scope here.

## 13. Acceptance Criteria

1. The recommendation-level button reads **"View Outreach Plan"** (was "Save as Artifact"); the signal-level briefing button is unchanged.
2. With the signal accepted and the answer loaded, clicking "View Outreach Plan" expands an inline panel under the recommendation and triggers **exactly one** backend generation call.
3. The panel shows the plan's non-empty sections — What to do, Strategy, How to communicate, Channel, and a Message template block — and omits any empty field.
4. Clicking the button again **collapses** the panel; reopening shows the **cached** plan with **no** additional backend call.
5. Clicking "View Outreach Plan" does **not** auto-download any file and does **not** auto-add to the Artifacts library.
6. Inside the panel: "Save to Library" adds the playbook to the Artifacts library (with a confirmation toast); "Download PDF" and "Download CSV" produce the same artefacts as before; "Download CSV" is hidden when the signal has no matched leads.
7. A "Copy" control copies the message template to the clipboard.
8. When the signal is not accepted or the answer is not loaded, the button shows the updated locked hint and does nothing else.
9. On generation failure an inline error appears with a "Try again" control that re-runs generation (keeping the panel open); empty/partial responses never crash the panel.
10. No backend files change; `npm run preflight` (typecheck, lint, format:check, vitest, build) is green.
