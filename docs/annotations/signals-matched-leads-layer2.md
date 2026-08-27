# Annotation — Signals: matched leads & next steps (Layer 2)

> Scope: `src/features/signals/components/SignalCard.tsx`, the card state after
> the user clicks **Find matched leads** (accepted signal, leads expanded).
> This is the "fast path" — act on the leads now, without going deep.

## What the user sees after opening leads

The resting card (Layer 1) stays intact; a leads block expands below the
action row, inside the same card:

```
┌──────────────────────────────────────────────────────────────┐
│ [Layer 1 header + body + action row — unchanged]            │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Matched leads  [N leads · M high]   [Save as Artefact] [Hide table] │
│ │                                                          │ │
│ │ <MatchedLeadsTable — interactive lead rows>              │ │
│ │   Name | Title | Company | Source | Relevance | Why     │ │
│ │                                                          │ │
│ │ Next steps                                               │ │
│ │  ┌─ Cohort A ─────────────────── [Preview outreach plan] │ │
│ │  └─ Cohort B ─────────────────── [Preview outreach plan] │ │
│ │                                                          │ │
│ │ [Share ▾]  [Download]                                    │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 1. Leads toolbar (`leadsToolbar`)

A header row above the table, shown whenever leads are open. Left side
carries the section identity; right side carries table-level actions.

- **"Matched leads" label** — `text-[11px]` uppercase semibold section header.
  This is where the lead-count cue moves once the signal is accepted: a
  `Badge` showing `N leads · M high` (the same cue that lived on the resting
  card's action row, now relocated here so it frames the table, not the
  triage decision).
- **Save as Artefact** (`variant="outline"`, `h-7`) — persists the lead
  table to the Artefacts page under a folder named after the signal. One
  signal → one artefact file (the lead sheet). Only renders when
  `matchedLeads.length > 0`.
- **Hide table / Show table** (`variant="ghost"`) — collapses only the
  table rows while keeping "Next steps" visible. Uses a `ChevronUp`/
  `ChevronDown` icon. This is the "collapse the table" affordance — it
  does **not** close the leads section; it tucks the rows away so the
  user can focus on the outreach plan below.

### 2. Matched leads table (`MatchedLeadsTable`)

The interactive lead surface — the smartest part of Layer 2. Columns:
`Name | Title | Company | Source | Relevance | Why`.

- **Inline editing** — clicking a lead name opens row-edit mode. The user
  can correct any field (name, title, company, relevance, why). Changes
  are committed via a tick-mark (✓) button — **not** on blur — so the user
  must explicitly save. This lets a user upgrade a medium-relevance lead
  to high, or fix a wrong title, right where they see it.
- **Source column** — shows where the lead came from: `CSV/XLSX` (uploaded
  prospect list) or `Apollo` (enrichment integration). Makes the lead's
  provenance visible without leaving the page.
- **Why column** — a short inline rationale for why this lead matches the
  signal. The full rationale lives in a `Popover` on hover; the inline text
  is the one-line summary.
- **Dismiss / restore** — leads can be marked "not a fit" and restored via
  chips. Dismissed leads are restorable, not deleted.

### 3. Next steps (aggregated outreach plan)

A section below the table (`border-t`), shown when `matchedLeads.length > 0`.
This is the "what to do with these leads" answer for the fast-path user who
does not want to go deep.

- **One step per cohort** — `buildAggregateOutreachPlan` groups leads by
  relevance tier and produces a labelled step per cohort. Each step shows a
  short `move` (one-line guidance).
- **Preview outreach plan** — each cohort step has a button that expands a
  `CohortOutreachPreview` in place: the email/LinkedIn sequence for that
  cohort, with a "To:" recipients field (lead names + emails, collapsible
  when long). The cohort's **Save as Artefact** is a sticky footer inside
  the preview, so the user saves while reading the copy — no scroll-back.
- **Not a mode** — "Preview outreach plan" expands one cohort at a time;
  opening one does not force-close others. It is a per-cohort toggle, not a
  global mode switch.

### 4. Block actions — Share & Download

The bottom action bar of the leads block (`border-t`, shown when
`matchedLeads.length > 0`). These are the **collective dispatch** actions —
they act on the whole signal's leads, not a single row or cohort.

- **Share** (`Share2` icon, `variant="outline"`) — a `DropdownMenu` offering
  **Outlook** and **Gmail**. Selecting one downloads the matched-leads CSV
  **and** the signal summary PDF to the device, then opens a pre-filled
  compose window in the chosen mail provider with subject + body pre-
  populated and the filenames named in the body (browsers cannot attach
  local files to a webmail compose window, so the bundle is downloaded
  first and the email tells the user which files to attach). Backed by
  `shareSignalByEmail` in `signalShare.ts`.
- **Download** (`Download` icon, `variant="outline"`) — downloads both
  deliverables directly (CSV + PDF) via `downloadSignalBundle`, with no
  mail window. This is the "just give me the files" path.

> Why Share and Download sit at the block level (not per-row): they export
> the **entire matched-leads set** for the signal — all cohorts, all rows.
> They are the "get this out of the app" exit ramps, distinct from the
> per-cohort "Save as Artefact" (which persists the cohort's sequence into
> the Artefacts library for further editing).

## Four-state leads section

The table area is not binary (open/closed); it handles four fetch states:

| State | What renders |
| --- | --- |
| **Loading** (`leadsLoading` / `leadsFetching`) | A spinner with "Finding matched leads…" — never "no leads". |
| **Error** (`leadsError`) | "Could not load matched leads." + **Try again** (re-fetch) and **Recompute lead mapping** (server recompute). |
| **Empty** (`matchedLeads.length === 0`) | "No matched leads found for this signal yet." — Save as Artefact is hidden (nothing to save). |
| **Populated** | The full table + Next steps + block actions. |

The in-flight spinner (`leadsFetching`) takes priority over a stale error,
so a recompute shows progress, not the old error.

## What Layer 2 does NOT include

- The signal's deep analysis, citations, and recommendation reasoning —
  those live in Layer 3 ("Go deeper"). A fast-path user never has to open
  them.
- Per-cohort personalisation / agentic editing — moved to the Artefacts
  page. On Signals, the cohort preview is read-only copy with Save.
- Email / phone / email-status columns — enrichment happens on Artefacts,
  not on the inline Signals table (keeps the triage surface clean).

## Props that drive Layer 2

| Prop | Role |
| --- | --- |
| `isLeadsExpanded` | Whether the leads block is open at all. |
| `matchedLeads` | The rows rendered in the table. |
| `leadsLoading` / `leadsFetching` / `leadsError` | The four-state machine. |
| `onSaveAsArtefact` | Table-level Save (lead sheet → Artefacts). |
| `onDownloadCsv` | Block-level Download (CSV + PDF bundle). |
| `onShare` | Block-level Share (dropdown → Outlook/Gmail). |
| `onEditLead` / `leadEdits` | Inline row editing + persistence. |
| `onDismissLead` / `onRestoreLead` / `onRestoreAllLeads` | Lead dismiss/restore. |
| `onRecomputeLeadMap` / `onRetryLeadMap` | Error-state escapes. |

## Developer notes

- **Two exits, one surface** — the table is both a viewing surface and an
  editing surface. Editing is opt-in (click name → edit → ✓ commit); the
  default is read.
- **Save appears in three places**, each with a different scope:
  1. Table-level **Save as Artefact** — persists the lead sheet (this layer).
  2. Cohort-level **Save as Artefact** (sticky footer in the preview) —
     persists that cohort's outreach sequence.
  3. Recommendation-level **Save as Artefact** (Layer 3) — persists a deep
     analysis.
  All three land in the same signal-named folder on Artefacts, as separate
  chips (Lead sheet / Sequence / Deeper analysis).
- **Share and Download are the only block-level CTAs** — they are the
  collective dispatch for the whole signal's leads. There is no per-row or
  per-cohort Share/Download; those would fragment the export.
