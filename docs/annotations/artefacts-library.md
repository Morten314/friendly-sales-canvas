# Annotation — Artefacts: the signal case file

> Scope: `src/features/artifacts/*` (route `/artifacts`).
> Artefacts is the **work surface**. Signals is where the user decides;
> Artefacts is where the saved output is kept, enriched, edited and dispatched.
> Everything here is persisted locally (`localStorage`, key `brewra_artefacts_v2`)
> and survives reloads until the user deletes it.

---

## 1. The governing rule: one signal = one artefact

Every save from the Signals page — the lead table, a cohort's outreach
sequence, a recommendation deep-dive — lands in the **same** artefact record,
filed in a folder named after the signal headline.

- A save never creates a sibling file. `saveArtefact` looks for an existing
  case file with the same `id` or the same `folder` and folds the incoming
  payload into it (`sheet`, `sequence`, `deepDives` merged; deep dives
  de-duplicated by question, latest answer wins).
- Legacy saves that were filed separately (`outreach-cohort-…`) are merged on
  load by `mergeSignalCaseFiles`, so an older library heals itself.
- Consequence for developers: **do not** key new saves by content type. Key
  them by signal, and add a new payload field on `ArtefactItem`.

## 2. Browsing model (`ArtifactsPage`)

Three states, one page — no nested routes.

1. **Root** — folder rows (`FolderList`, one per signal, with an item count)
   plus a flat list of every artefact newest-first, so nothing is ever "lost"
   inside a folder.
2. **Inside a folder** — only that signal's files.
3. **Open file** — the list is replaced by the full-width `ArtefactDetail`.

Search (the local box *and* the global header search, delivered as a
`window` `CustomEvent("artifactsSearch")`) **flattens the tree**: results are
matched across name, task number, folder and agent, and shown regardless of
which folder they live in.

Artefacts saved while the page was not mounted arrive two ways: a live
`CustomEvent("addArtefact")` listener, and a once-only drain of the hand-off
queue (`drainArtefactQueue`) on mount. In both cases the page auto-navigates
into the incoming artefact's folder so the user sees where it landed.

Per-row actions (`ArtefactRow`, overflow "…" menu): Open, Rename, Download
CSV, Download source CSV, Delete. Deletion is the only way an artefact leaves
the library.

## 3. The file view (`ArtefactDetail`) — chips, not pages

Opening a file shows the signal header (folder breadcrumb back-link, title,
task number, timestamp, row count) and a **chip bar**. Chips render only for
payloads that exist, so a case file grows chips as the user saves more:

| Chip | Present when | Contents |
| --- | --- | --- |
| **Lead sheet** | a lead table was saved | Signal + blurb + the enrichable table |
| **Sequence** | a cohort outreach plan was saved | Signal + blurb + editable, cohort-grouped touches |
| **Deeper analysis** | a recommendation was saved | Signal + each recommendation and its full answer |

Every chip repeats the **Signal + blurb** block at the top. That repetition is
deliberate: each view must read as a standalone record of *which signal this
work belongs to*.

### 3a. Lead sheet chip

Columns are deliberately narrow at save time — **Name, Title, Company,
Relevance, Why**. Contact data (email, phone, LinkedIn, seniority) is *not*
carried over from Signals; it is pruned on load (`pruneSheet`) and must be
earned through enrichment. Toolbar: **Edit** (toggles cell editing, becomes
"Done"), **Download CSV** (reflects current edits), **Send** (Gmail / Outlook —
downloads the CSV and opens a pre-filled draft naming the file, since browsers
cannot attach local files to webmail).

### 3b. Enrichment (`EnrichableLeadSheet`) — agentic columns, not fixed ones

The central idea: the sheet has no predetermined enrichment schema. The user
adds the attribute they need and the agent fills it for every row.

- **Add column** opens a picker with suggestions (Email, Phone number,
  LinkedIn, Seniority, Buying role, Company context, Talking point, Objection
  to expect) plus a free-text "Or ask for anything…" input.
- Suggestions flagged `needsConnector` (Email, Phone, LinkedIn) warn inline
  when Apollo is not connected: the value will be AI-inferred and marked low
  confidence rather than verified.
- Filling calls the `enrich-lead` edge function once for the column, with the
  whole lead list plus the signal as context.
- Each enriched cell stores a **confidence** (`high` / `medium` / `low`), shown
  as a marker; low-confidence cells carry a "verify before using" hint. Cells
  can be re-run individually, and the whole column can be removed.
- Enriched columns are tracked separately (`sheet.enriched`) so they are always
  distinguishable from the original matched-leads export.

### 3c. Sequence chip — full editorial control

Sequences arrive as `"<Cohort> · <action>"` strings and are regrouped by cohort
for display. Per cohort: a **Personalise** button rewrites that cohort's copy
via the `generate-outreach-copy` function, preserving days and channels, and
failing soft ("the existing copy is unchanged"). Per step: day, channel,
action, subject and body are all editable inputs; steps can be moved up/down,
removed, or added; **Edit** opens `OutreachCopyChat` for agentic rewriting of
that one message.

This is where personalisation and message editing live — both were
intentionally removed from the Signals page. Signals decides; Artefacts edits.

### 3d. Deeper analysis chip

Saved recommendations render through the **same** `RecommendationAnswerView`
component used on the Signals page, so the stored answer reads identically to
the one the user approved.

## 4. Persistence notes for developers

- `agentIcon` is a React component and is not serialisable: it is stripped on
  write and rehydrated from `agentName` on read.
- Accepted signals are **not** artefacts. They are a Signals triage collection
  with their own store, and are filtered out (and purged) on every load.
- A one-time clean-slate flag (`brewra_artefacts_clean_slate_v2`) reset the
  library for the v2 experience; saves after that point persist normally.
- Coupling to the rest of the app is via untyped `window` CustomEvents
  (`addArtefact`, `artifactsSearch`) — tracked as tech debt (TD-FE-58).
