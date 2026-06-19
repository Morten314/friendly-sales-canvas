---
artifact: specs/38-signals-cta-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-19
round: 1
---

## Context

This review grounded every concrete codebase claim in the spec against the live
source (signals feature, artefacts feature, strategist pattern, route registry,
TECH_DEBT register). The spec is unusually well-grounded overall; the findings
below are mostly inherited-behaviour risks the spec reuses without flagging, plus
a few factual inaccuracies in its citations.

## Findings

### [Critical] The `addArtefact` event is dispatched before `ArtifactsPage` mounts, so the library entry is silently lost

**Location:** §"5. Save as Artefact", steps 3–4 (lines 75–76); causal claim
"so the library page is mounted to receive the event" (line 76). Cross-ref:
`frontend/src/features/artifacts/routes.tsx:8-19`,
`frontend/src/features/artifacts/pages/ArtifactsPage.tsx:37-52`,
`frontend/src/features/strategist/components/StrategistWorkspace.tsx:773-784`.

`ArtifactsPage` is a standard react-router `<Route>` at `/artifacts`
(`routes.tsx:8-19`); it renders **only** when the user is on `/artifacts`. The
`addArtefact` listener is attached in its mount `useEffect`
(`ArtifactsPage.tsx:37-52`). The spec's flow dispatches the event **while still
on `/signals`** (where no listener exists), then navigates 1200 ms **later**. By
the time `ArtifactsPage` mounts, the event has already fired into the void and is
gone — the 1200 ms delay does not help, because the listener is attached only
after navigation, not before dispatch.

The spec's own explanation is inverted: it says the delay exists "so the library
page is mounted to receive the event," but the dispatch precedes the navigation,
so the page is *not* mounted at receive time. This is one of the feature's two
stated outputs ("…have that briefing also land in the Artefacts library", line
19), and it silently does not land.

This pattern is copied verbatim from `StrategistWorkspace` (same dispatch-then-
`setTimeout(navigate)` at lines 773/784 and 827/834), so either Strategist's
pushed emails also silently fail to appear (plausible at 0 users) or some
retention mechanism not present in the code I read is at play. **The plan must
verify whether a Strategist-saved artefact actually appears in the live library
today** before assuming this pattern works. If it does not, this feature needs a
real hand-off (e.g. navigate *first*, then dispatch from the target page; or pass
the item via router state / a module-level buffer the listener drains on mount).

The proposed test ("dispatches one `addArtefact` event with that item as
`detail`", line 170) would **not** catch this — it asserts the dispatch, not that
`ArtifactsPage` received and prepended it. Add a test that mounts `ArtifactsPage`
and asserts the dispatched item appears in its list.

### [High] The feature's primary deliverable (PDF) routes LLM free-text through a structurally fragile generator, unacknowledged

**Location:** §"5. Save as Artefact", step 2 (line 74) and "Format decision"
(line 78). Cross-ref:
`frontend/src/features/artifacts/lib/artefactPdf.ts:3-125` (`createSimplePDF`),
`:127-145` (`generateAndDownloadPDF`).

The reused `createSimplePDF` has three concrete failure modes that bear directly
on this feature's headline output:

1. **No PDF-string escaping.** Content is interpolated raw into `( … ) Tj`
   string literals (`artefactPdf.ts:55,58,64,70,76,82`). PDF string literals
   permit *balanced* parens unescaped, but **unbalanced** `(`/`)` and any
   backslash break parsing. The briefing is built from `signal.headline`,
   `signal.description`, and per-lead `why` — all LLM-generated free-text that
   routinely contains smileys (`:)`), stray parens, and backslashes. One
   unbalanced paren truncates or corrupts the rendered PDF.
2. **Hardcoded `/Length 2000`** (line 49) regardless of actual stream length.
3. **Placeholder xref offsets** (`0000002000` / `0000002500` / `startxref 3000`,
   lines 113-121) that are not real byte positions, plus a single fixed
   `MediaBox` page with no pagination — a signal with many leads overflows past
   the page's fixed y-positions and is clipped.

The spec's "Accepted limitation" (line 80) covers only library *persistence*;
the fragility of the PDF itself — the thing the user actually downloads — is not
mentioned, and the "Format decision" (line 78) frames PDF as the clean choice
without noting the generator is broken. The spec should either (a) acknowledge
this as an accepted, inherited limitation shared with Strategist and record a TD
(at minimum: missing PDF-string escaping), or (b) scope in minimal escaping
(`(`,`)`,`\` → `\(`,`\)`,`\\`) as part of this work since the briefing is the
feature's reason for existing.

### [Medium] TD-FE-72/73 hygiene instruction mischaracterizes the register entries

**Location:** §"Context" point 1 (line 28) and "Dependencies & Follow-ups"
(line 190). Cross-ref: `docs/TECH_DEBT.md:84-85` (index),
`:1098-1128` (TD-FE-73 body);
`frontend/src/features/signals/hooks/useSignalLeadMap.ts:59-63`.

Two inaccuracies that could mislead the implementer:

- **TD-FE-72 is already `resolved`** (`TECH_DEBT.md:84`, archived). The spec
  lumps it into "reconcile … the TD-FE-72/73 entries" as if both are open.
- **TD-FE-73 is not about "dormant-control rationale."** Its actual subject
  (`TECH_DEBT.md:1098`) is that the FE zod contract was *derived from backend
  code, not a captured live response*, and its required action is to call the
  endpoint with a real `(user_id, org_id)`, capture the JSON, and reconcile
  `SignalLeadMapResponseSchema` against it. Its pull-forward trigger
  (`:1122-1124`) is literally "endpoint confirmed deployed" — which the spec
  itself now asserts (line 27). So this spec *satisfies* TD-FE-73's trigger and
  should be calling for the live-shape contract reconciliation, not a stale-
  comment cleanup.

Also note the code comment at `useSignalLeadMap.ts:59-63` is stale in a way the
spec doesn't quite capture: it claims "a click on the dormant control 404s," but
`SignalsPage.tsx:691-693` renders a visible "Recompute lead mapping" button wired
to `refresh()`, which swallows the error to a `console.warn` no-op. The control
is live and visible, not dormant. Reword the hygiene to: update the stale comment
*and* perform the TD-FE-73 contract reconciliation now that the endpoint is live;
do not touch the already-resolved TD-FE-72.

### [Medium] "Disabled" button that must still be clicked to show a message is a contradiction

**Location:** §"2. Expanded card", "greyed out and disabled by default" +
"Clicking while disabled → inline message" (lines 44–46); reiterated in
"Component Changes" (lines 139–140).

A native `<button disabled>` does not fire `onClick`, so the two requirements are
mutually exclusive under the obvious implementation. The plan must resolve this
explicitly: either a styled-as-disabled but enabled button with an `onClick`
guard (clickable, but an a11y smell — screen readers/users see "disabled" yet it
responds), or `aria-disabled` + a wrapper that intercepts the click. The spec
should state which, since it affects both behaviour and accessibility. Also
define what "on next interaction" (line 46) auto-dismisses on — a click anywhere?
another button? — and specify timer cleanup on unmount.

### [Medium] Forced navigation to `/artifacts` after every save disrupts the signals feed

**Location:** §"5. Save as Artefact", step 4 (line 76); "Component Changes"
`SignalsPage` bullet (line 149).

Clicking `[Save as Artefact]` downloads the PDF immediately, then hard-navigates
the user away from Signals after 1200 ms. For Strategist this is a terminal
action; for Signals a user may reasonably want to save several briefings in a
session, and each save yanks them off the page and loses their scroll/expand
state. The spec presents the forced navigation as a fixed requirement without
weighing the cost or considering a lighter alternative (e.g. a toast
"Saved to Artefacts →" with a link, no navigation; or navigate only on explicit
"Open library"). At minimum, justify why the leave-the-page behaviour is
desirable here, or downgrade it.

### [Medium] Leads empty-state conflates loading/error with "zero leads"

**Location:** §"4. Find Matched Leads", "Empty-state" (lines 64). Cross-ref:
`useSignalLeadMap.ts:10-13,25,28-31`.

`leadsForSignal(signal.id)` returns `[]` while the map is loading, while
disabled, and on error — the hook is "quiet (empty) while loading, disabled, or
on error" by design (`useSignalLeadMap.ts:11-13`). The spec's empty-state copy
"No matched leads found for this signal yet." (line 64) renders in all three
cases, so during the initial fetch (or after a fetch error) the user is told
there are no matched leads when the truth is "still loading" or "request failed."
Distinguish a loading affordance from a true-zero state. The page already has a
"Recompute lead mapping" action (`SignalsPage.tsx:691-693`); the empty-state is a
natural place to offer it rather than a dead-end message.

### [Low] Agent→icon/color citation incorrectly includes StrategistWorkspace

**Location:** ArtefactItem mapping, `agentIcon`/`agentColor` rows (lines 88–89);
follow-up note (line 107). Cross-ref: `mockArtefacts.ts:1,10-11,46-47`,
`StrategistWorkspace.tsx:743-744,797-798`.

The map `scout → Satellite / bg-blue-500`, `profiler → Target / bg-purple-500`
matches `mockArtefacts.ts` exactly. But the spec calls this "the same map as
`mockArtefacts`/`StrategistWorkspace`" (lines 88, 107) — `StrategistWorkspace`
does **not** carry a scout/profiler map; it hardcodes `agentIcon: Compass` /
`agentColor: "bg-indigo-500"` for its own "Strategist" agent. So the
"duplicated today between `mockArtefacts.ts` and `StrategistWorkspace.tsx`"
claim (line 107) is inaccurate, and an implementer looking at Strategist for the
map will find the wrong icons. Cite `mockArtefacts.ts` only. (The decision to
make a feature-local resolver rather than cross-feature-import artefacts
internals is correct — keep it.)

### [Low] Optional lead fields (`company`, `why`) produce degraded rows/PDF entries with no fallback

**Location:** §"4. Find Matched Leads" lead row (lines 58–60); ArtefactItem
mapping `fullReport.keyFindings` (line 102). Cross-ref:
`contracts.ts:12-15` (`company` and `why` both `.optional().default("")`).

Both `company` and `why` default to `""`. A lead with an empty `company` renders
a blank row whose only content is the relevance badge, and an empty `why`
produces a `keyFindings` entry like `" (Relevance: High): "` with a dangling
separator in the PDF. Specify a fallback (e.g. `company || "Unknown company"`,
omit the `: ${why}` suffix when `why` is empty).

### [Low] Lock-message dismissal trigger and timer lifecycle are under-specified

**Location:** §"2. Expanded card" (line 46).

"auto-dismisses after ~3s or on next interaction" leaves "next interaction"
undefined (click outside? focus change? any keydown?), and there is no statement
that the 3 s timer is cleared on unmount or when the card collapses. Cheap to
nail down now; a source of racy tests later if left vague.

### [Nit] Filename collides across repeated saves of the same signal

**Location:** §"5. Save as Artefact", step 2 (line 74). Cross-ref:
`artefactPdf.ts:138` slug is `${title}.toLowerCase()` only — `Date.now()` lives
in the artefact `id`, not the filename.

Saving the same signal twice yields an identical download filename, so the
browser overwrites / prompts. Not blocking, but if the user exports the same
briefing twice (e.g. after a recompute changes leads) the earlier file is lost
silently.

### [Nit] Exact placement of `[Find Matched Leads]` and the leads section within the expanded block is not pinned

**Location:** §"2" / §"4" (lines 44, 56) vs. the existing expanded block
(`SignalCard.tsx:159-401`, which renders description → sources → recommendations
→ "Show less").

The leads section is specified "above the recommendations, below the
description/sources block," and the button is "always visible in the expanded
section," but where the button sits relative to that ordering (header? above
recommendations? attached to the leads section?) is implied, not stated. A
one-line placement note would remove guesswork for the implementer and the VR
tests.

## Observations (no action)

- **Plan-readiness is high.** The spec decomposes cleanly into two component
  changes with explicit prop additions, a complete `ArtefactItem` field mapping,
  testable acceptance criteria, and a clear out-of-scope list. It will translate
  to ordered, reviewable tasks with little ambiguity (aside from the findings
  above).
- **The format decision (PDF-over-Markdown; one `ArtefactItem` driving both the
  download and the library re-download) is well-justified** and reduces
  surface area — good call.
- **Scope discipline is good — no overengineering.** Persistence is correctly
  deferred with a TD to record, no AI-at-click-time, no per-lead actions. The
  spec does not gold-plate.
- **The "hide `why` from the UI, reserve it for the PDF" design** is a sound
  product choice that makes the export more valuable than the screen — nice.
- **The `index.ts`-only boundary is respected** (local resolver, no cross-feature
  import of artefacts internals) — correct per the feature conventions.
- The "only one leads section open at a time" page-held state composes fine with
  the existing `expandedDescriptions` (Set) and `expandedRecommendation`
  (single) axes — three independent expansion states, no conflict.
