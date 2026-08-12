# Two-mode Signals card: Lean default + expand-for-depth

## Context
Signals currently force every user through the in-depth experience: the collapsed card
shows only headline + snippet + "Read more", and *everything* actionable (matched leads,
recommendations, the parsed answer) is buried behind that expand. We're introducing a
**lean default** that serves the immediate-action user, while the existing in-depth view
becomes the "expand" depth. Same card, same data, two presentation densities.

## Two use cases
1. **Immediate action** — see signal, gauge importance, find matched leads, get a short
   "what to do" nudge. Minimal reading, minimal scrolling.
2. **In-depth** — full parsed recommendation answer, verdict, tiers, outreach sequences
   (the current experience, unchanged).

Decisions (from clarifying questions):
- Mode-1 "what to do" = a **short prescriptive CTA** (1–2 line generated nudge, no deep prose).
- Default = **lean**, expand per-card for depth. No global toggle.

## What the lean default shows
1. **Headline + agent/timestamp** (existing) — unchanged.
2. **Importance indicator** (new) — a compact chip derived from the matched-leads
   relevance distribution, e.g. `5 leads · 3 high`. This doubles as the importance signal
   *and* the one-click entry to matched leads (so "know it's important" and "find the
   matched leads" collapse into one element). Derived client-side from
   `resolveLeads(signal.id)`; falls back to `—` when leads aren't loaded yet.
3. **Snippet** (existing) — unchanged.
4. **Short prescriptive CTA** (new) — a single line: the first NBA's `nba` text (or
   `nextBestMoves[0]` when no NBAs), prefixed "Suggested action:". Not the full parsed
   answer — that lives in the expand. If neither exists, the line is hidden.
5. **Accept / reject** (existing, Gmail-star semantics) — unchanged.
6. **View details** (existing "Read more", relabeled) — expands into the in-depth view.

The accept gate on the matched-leads *list* is preserved, but the importance chip is
visible in lean mode regardless (it's a summary, not the lead list), so an unaccepted
user still sees *that* there are 5 leads / 3 high without seeing who they are.

## What the in-depth (expand) view shows
The current expanded card, unchanged:
- Full `description` + citations
- "Find Matched Leads" → leads section + CSV preview + Save as Artefact
- Recommendations list → parsed `RecommendationAnswerView` (verdict, tiers, outreach)
- "Show less" to collapse back to lean

No changes to the recommendation/outreach machinery (on hold for manager approval).

## Implementation (frontend / presentation only)
File: `src/features/signals/components/SignalCard.tsx`

1. **Lean block** (rendered when `!isDescriptionExpanded`), replacing the bare
   "Read more" button:
   - Importance chip: compute from `matchedLeads` (count + high/medium split). Clickable →
     opens leads section (calls `onFindMatchedLeads`, which already handles the accept
     gate + lock message). Reuse `handleFindClick` so the gate behaviour is identical.
   - Prescriptive CTA line: `Suggested action: {firstNBA.nba ?? nextBestMoves[0]}`.
   - "View details" button → `onExpandDescription()`.

2. **In-depth block** (`isDescriptionExpanded`) — leave as-is.

3. No new props needed: `matchedLeads`, `onFindMatchedLeads`, `signal.NBAs`,
   `signal.nextBestMoves`, `onExpandDescription` are all already passed in.

No backend changes. No new types. No changes to `SignalsPage.tsx` state wiring —
`expandedDescriptions` already drives the lean/in-depth split per card.

## Out of scope
- Recommendation / outreach-plan restructuring (on hold).
- New signal priority field from the backend (we derive importance from existing leads).
- Global quick/detailed toggle (chose per-card expand).
