# Signals: natural progressive disclosure (no modes)

## The real problem
Today the Signals card has one door — `Read more` — and *everything* is behind it:
the full description, the citations, the recommendations, the parsed answer, **and**
"Find Matched Leads". So a user who just wants to act on a signal has to walk through
the same heavy door as a user who wants to study it.

That is not a missing "quick mode". It is a badly placed door. Nobody arrives at a
signal and decides "today I am a quick user" — they just follow whatever the signal
makes them curious about. So there is no mode, no toggle, no persisted preference.
There is one card that reveals depth as a consequence of what the user actually does.

## The natural flow
Three layers, each opened only by an action that implies wanting it:

```text
Layer 1  card at rest
         headline · agent · when · snippet
         [ 5 leads · 3 high ]         <- importance, always visible
         Find matched leads           <- primary action
         Why this matters             <- quiet, secondary

Layer 2  clicked "Find matched leads"
         lead rows + relevance
         Suggested action: <one line>
         View as CSV / Save as Artefact

Layer 3  clicked "Why this matters"
         full description + citations
         recommendations -> parsed answer (verdict, tiers, outreach)
```

Nothing is chosen. Layer 2 opens because you asked for leads. Layer 3 opens because
you asked why. A user who wants to act never sees layer 3; a user who wants depth
gets there in one click. Both layers can be open at once — they are not alternatives.

## What changes
The single structural change: **lift "Find matched leads" out from behind `Read more`**
so it sits on the card at rest, next to an importance cue. Then `Read more` becomes
what it should always have been — "Why this matters" — carrying only the explanatory
material, not the actionable material.

1. **Importance cue on the resting card.** A compact chip built from the matched-leads
   relevance spread, e.g. `5 leads · 3 high`. Derived client-side from the leads already
   resolved for the signal; renders nothing when there are none yet. This is how the user
   "knows it's important" without reading a paragraph.

2. **"Find matched leads" on the resting card.** Same handler and the same accept gate as
   today (`handleFindClick`, lock message unchanged) — only its position moves. Opens the
   existing leads section in place.

3. **A one-line suggested action inside the leads section.** Once leads are on screen, a
   single line telling the user what to do with them: the first `NBAs[].nba`, falling back
   to `nextBestMoves[0]`, hidden when neither exists. This is deliberately one line — the
   reasoned version already lives in layer 3 and is not duplicated here.

4. **`Read more` becomes `Why this matters`** and keeps only the description, citations and
   recommendations. `Show less` closes it. The matched-leads section is no longer nested
   inside it, so closing the explanation does not throw away the leads the user opened.

## Implementation
Frontend only, and almost entirely one file:
`src/features/signals/components/SignalCard.tsx`

- Move the `Find Matched Leads` button + `showLockMessage` + `{leadsSection}` out of the
  `isDescriptionExpanded` branch and into the resting card body, directly under the snippet.
- Add the importance chip beside it, computed from the `matchedLeads` prop.
- Add the suggested-action line at the top of `leadsSection`.
- Relabel `Read more` -> `Why this matters`; the expanded branch keeps description,
  citations and the recommendations block only.

No new props: `matchedLeads`, `onFindMatchedLeads`, `isLeadsExpanded`, `signal.NBAs` and
`signal.nextBestMoves` are already passed in. No page-state changes — `expandedDescriptions`
and the leads-expanded state are already independent of each other in `SignalsPage.tsx`,
which is what makes the two layers able to coexist.

## Out of scope
- The recommendation / outreach-plan restructuring (on hold pending approval).
- The accept gate on matched leads — behaviour preserved exactly as-is.
- Any backend, contract or type change.
