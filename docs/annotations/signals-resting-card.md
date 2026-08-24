# Annotation — Signals: resting card (Layer 1)

> Scope: `src/features/signals/components/SignalCard.tsx`, the card as it renders
> on first landing (no expansion, no leads open). This is the "at rest" state —
> the entry point every user sees before any action.

## What the user sees on landing

A single white card (`bg-white rounded-xl shadow-sm border`). Top-to-bottom:

```
┌──────────────────────────────────────────────────────────────┐
│ [Agent badge] • <timestamp>            [👍] [👎] [🤖]        │  ← header row
│                                                              │
│ <Headline>                                                   │  ← h3, lg, semibold
│ <Snippet> — one-line small description                       │  ← sm, gray-600
│                                                              │
│ [Find matched leads]   [Affects N leads]   [Go deeper ▾]    │  ← action row
└──────────────────────────────────────────────────────────────┘
```

### 1. Header row (`flex items-center justify-between`)

Left cluster:
- **Agent badge** — `getAgentBadge(signal.agent)`. Renders a "Scout" or
  "Profiler" chip identifying which agent produced this signal.
- **Separator** — a literal `•` between badge and time.
- **Timestamp** — `signal.timestamp` in muted gray (`text-sm text-gray-500`).
  This is the signal's "when".
- **"Accepted" badge** (conditional) — a green `Badge` appears here only when
  `isAccepted` is true. It is the visible confirmation that this signal lives in
  the Accepted collection. It does **not** remove the card from the feed
  (Gmail-star semantics — see §Accept/Reject below).

Right cluster — three icon-only `ghost` buttons, 8×8 (`h-8 w-8 p-0`):
- 👍 **Accept** (`ThumbsUp`) — toggles acceptance. Turns green
  (`text-green-600 bg-green-50`) once accepted; clicking again unaccepts.
  `aria-label` flips between "Accept signal" / "Unaccept signal".
- 👎 **Reject** (`ThumbsDown`) — marks the signal rejected. Turns red on hover.
- 🤖 **Chat with agent** (`Bot`) — opens the in-page signal chat panel with the
  producing agent. `title` is "Chat with Scout" / "Chat with Profiler".

> Note for developers: Accept and Reject are **icon buttons**, not labelled
> text buttons, and they sit in the header (not the body). There is a third
> header action — the Bot chat — which is easy to miss in a wireframe that
> only shows "Accept / Reject".

### 2. Body

- **Headline** — `<h3 className="text-lg font-semibold text-gray-900">`.
  The signal title; the single most prominent text on the card.
- **Snippet** — `signal.snippet`, `text-sm text-gray-600`. The short,
  one-line description. This is the "small description" the user reads to
  decide whether to act or go deeper.

### 3. Action row (`flex flex-wrap items-center gap-2`)

Three controls, left-to-right, all in the body under the snippet:

- **Find matched leads** — primary action. A `Button variant="outline"` whose
  label toggles to "Hide matched leads" once open. It is **gated by acceptance**:
  - When **not accepted**: rendered with `cursor-not-allowed` gray styling and
    `aria-disabled`. Clicking does **not** open leads — it shows the amber
    lock message "Accept this signal to unlock matched leads" for 3s
    (`showLockMessage`, `handleFindClick`). Functionally enabled (not native
    `disabled`) precisely so it can explain itself.
  - When **accepted**: green-bordered, click opens the leads section in place
    (delegates to `onFindMatchedLeads`).
- **"Affects N leads" badge** (conditional) — a small `Badge` shown **only when
  the signal is not yet accepted** and there are affected leads
  (`(affectedLeadCount || matchedLeads.length) > 0`). This is the importance cue
  that tells a not-yet-accepted user "this is worth your attention" without
  forcing them to open anything. Once accepted, the cue moves into the leads
  table header instead (see Layer 2).
- **Go deeper** (conditional) — a `ghost` button shown only when the signal has
  recommendations (`hasRecommendations`). Label toggles to "Hide the reasoning"
  with a `ChevronUp`/`ChevronDown`. Opens the deep-dive superset view: the
  "What this means" blurb + citations, then the reasoning (recommendation list
  with per-recommendation answers). "Go deeper" is the **second user path** —
  for users who want depth, not just immediate action.

> The action row is the fork in the road: **Find matched leads** is the fast
> path (act now); **Go deeper** is the deep path (understand first). Both can
> coexist — opening one does not close the other.

## Accept / Reject — Gmail-star semantics

- **Accept** does **not** remove the card from the live feed. It adds the
  signal to the Accepted collection (the "Accepted" tab) while the card stays
  in place, exactly like Gmail's star or Slack's "Save for later". The card
  merely gains the green "Accepted" badge and the accept button turns green.
- **Reject** marks the signal rejected (optimistic removal with an undo
  window handled at the page level in `SignalsPage.tsx`).
- Acceptance is the gate for **Find matched leads** and for **Save as
  Artefact** on recommendations. A user cannot act on leads they have not
  accepted — the lock message explains this in place rather than hiding the
  button.

## State at rest — what is NOT shown

To keep the resting card scannable, none of the following render until the
user acts:
- The matched-leads table (behind **Find matched leads**).
- The "Next steps" / aggregated outreach plan (renders under the table once
  leads are open).
- The block-level Share / Download actions (render only when leads are open).
- The "What this means" blurb, citations, and the recommendation reasoning
  (behind **Go deeper**).
- The per-recommendation answer view and its "Save as Artefact" (behind
  **Go deeper** → click a recommendation).

## Props that drive the resting card

| Prop | Role on the resting card |
| --- | --- |
| `signal.headline` / `signal.snippet` / `signal.timestamp` | Header + body text |
| `signal.agent` → `getAgentBadge` | Agent chip in header |
| `isAccepted` | Drives "Accepted" badge, accept-button style, and the accept-gate styling on Find matched leads |
| `matchedLeads` / `affectedLeadCount` | The "Affects N leads" cue (only when not accepted) |
| `hasRecommendations` (from `signal.NBAs` / `signal.nextBestMoves`) | Whether "Go deeper" renders at all |
| `isLeadsExpanded` / `isDescriptionExpanded` | Both `false` at rest — these are the toggles the user flips |
| `onAccept` / `onReject` / `onBotIconClick` | The three header actions |
| `onFindMatchedLeads` / `onExpandDescription` / `onCollapseDescription` | The two action-row paths |

## Developer notes

- **No code change in this annotation** — it documents the as-built resting
  card so designers/PMs and future developers share one mental model.
- The resting card is intentionally **two-clicks-max to action**: a user can
  accept (header 👍) then immediately click "Find matched leads" — no
  expansion, no scroll, no mode switch.
- The two paths (fast / deep) are **independent toggles**, not a mode. They
  share the leads block when both are open ("Go deeper" reuses the same
  `leadsBody` rather than duplicating it).
