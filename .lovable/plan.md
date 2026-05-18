## Strategy Execution Package (SEP) — Build Plan

We keep the existing Strategist board (cohort table, sync breadcrumbs, what's-new, immediate directives) and add the SEP layer on top of it. SEPs are the bridge between AI recommendations and downstream executors.  
  
Note: Do not keep existing Strategist and start with blank canvas. This specification document is your context to build Strategist.

---

### 1. Data layer

**New file: `src/components/strategist/sepData.ts**`

- Types: `SEP`, `SEPCohort`, `SEPManifest`, `SEPImmediateAction`, `ChannelId` (`meta | tiktok | linkedin | email | crm | figma | personalized`), `Treatment` (`DIRECT | CHANNEL | NURTURE | EXCLUDE`), `Priority` (`HIGH | MEDIUM | LOW`).
- `channelFileMap`: which file names each channel produces (e.g. meta → `meta-campaign-brief.json`, `meta-ad-copy.md`).
- `generateSEP(cohorts, opts)` — pure function that builds a SEP object from existing `strategyCohorts`, returning manifest + per-cohort folders + files (with mock template contents). Status `draft` or `approved`. Auto-increments version.
- `sortImmediateActions()` — applies priority → treatment urgency → review-state ordering from spec.

**Storage:** In-memory + `localStorage` key `strategistSEPs` (immutable append-only array). No backend yet.

---

### 2. Board additions (`StrategistCohortTable.tsx`)

- New header buttons next to title: **Generate Package** (opens channel-selector modal, board-wide) and **Approve Board** (triggers auto-generation of `vN` with status `approved`).
- **Next Actions panel** (new component `NextActionsPanel.tsx`) above cohorts — replaces `ImmediateActionDirectives` to render top 3–5 from latest approved SEP. Each row links to the package detail anchored at that cohort.
- **Packages panel** (`PackagesPanel.tsx`) below cohort table — table with columns: Version · Status · Generated · Approver · Actions (View / Download ZIP).

---

### 3. Channel selector modal

**New component: `ChannelSelectorModal.tsx**`

- Used by both board-level and cohort-level generation.
- Checkbox list of 7 channels with descriptions.
- "Per cohort" mode shows one tab per cohort; "single cohort" mode shows just one.
- Submit calls `generateSEP()` and routes to `/your-ai-team/strategist/package/:id`.

---

### 4. Package detail page

**New route: `/your-ai-team/strategist/package/:id` (in `App.tsx` + `Deals.tsx` flow)**

**New component: `PackageDetail.tsx**`

- Header: version, status badge, approver, generated timestamp, Download ZIP button (uses `jszip`).
- **Action Queue** section: full sorted list from `manifest.immediateActions`, each linking to the cohort anchor below.
- **Cohort cards**: collapsible per-cohort cards showing treatment + priority badges, account count, file list. Each file row has an inline preview (JSON pretty-printed or markdown rendered) and a download button. "Hand off cohort" button on each card downloads that folder as ZIP or copies manifest+files JSON to clipboard.

---

### 5. Cohort-level generate

In `CohortExpandedRow.tsx`, add **Generate Package** button next to the existing primary action. Opens `ChannelSelectorModal` in single-cohort mode → creates a single-cohort SEP → navigates to its package page.

---

### Technical notes

- **ZIP**: use `jszip` (already in dep tree if not, install). Files are written into nested folders matching the spec structure.
- **File previews**: render `.json` with `<pre>` and syntax-light styling; render `.md` with a tiny markdown-to-html helper (headings, lists, bold) — no new lib.
- **Versioning**: `nextVersion = max(existing) + 1`. Status flips to `approved` only on the board-approve path; on-demand from a non-approved board produces `draft`.
- **Mock content generation**: templates parameterised by cohort name, treatment, channel, and the existing `cohortData` leads. No AI calls.

---

### Files to be created

- `src/components/strategist/sepData.ts`
- `src/components/strategist/sep/PackagesPanel.tsx`
- `src/components/strategist/sep/NextActionsPanel.tsx`
- `src/components/strategist/sep/ChannelSelectorModal.tsx`
- `src/components/strategist/sep/PackageDetail.tsx`
- `src/components/strategist/sep/FilePreview.tsx`
- `src/components/strategist/sep/templates.ts` (mock generators for brief.md, accounts.json, channel files)

### Files to be modified

- `src/components/strategist/StrategistCohortTable.tsx` (header buttons, swap directives for NextActionsPanel, add PackagesPanel)
- `src/components/strategist/CohortExpandedRow.tsx` (Generate Package button)
- `src/App.tsx` (new route)
- `src/pages/Deals.tsx` (handle package detail view)

### Out of scope (per spec)

- Real AI generation of file content
- External delivery / webhooks
- Auth on artifact files
- Per-channel adapters