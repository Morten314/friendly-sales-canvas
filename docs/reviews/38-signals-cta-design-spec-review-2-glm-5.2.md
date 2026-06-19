---
artifact: specs/38-signals-cta-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-19
round: 2
---

## Context

Round 2. The spec was revised after round-1 review + synthesis (status line 6).
All 11 round-1 findings were addressed in the revision — verified against current
source, not assumed. This pass therefore focuses on (a) whether the revisions
hold up under scrutiny and (b) new issues the revisions introduce (chiefly the
artefact-delivery queue and the in-scope TD-FE-73 contract tightening). Every
finding below is new or materially extended relative to round 1.

## Findings

### [High] Queue "drain on mount (prepending)" is under-specified — a delivered, foldered briefing is filtered out and invisible on arrival

**Location:** §"5. Save as Artefact" step 3 (line 83); "Component Changes →
`features/artifacts`" (lines 163–165). Cross-ref:
`frontend/src/features/artifacts/pages/ArtifactsPage.tsx:37-67` (listener +
filter), `:54-67` (`filteredArtefacts`).

The existing live `addArtefact` listener does three things on receipt
(`ArtifactsPage.tsx:38-46`): prepend the item, **`setActiveFolder(folder)`** if it
has a folder, and **`setExpandedArtefact(id)`**. The folder step is load-bearing:
`filteredArtefacts` (`:57-67`) returns items where `!artefact.folder` when
`activeFolder` is null (root view) — i.e. a *foldered* item is **filtered out**
unless its folder is active. Signal briefings carry `folder: "Signal Briefings"`
(line 102).

The revision's drain path is specified only as "drains the queue on mount
(prepending queued items)" (line 165). A bare prepend leaves `activeFolder=null`,
so a delivered briefing lands in state but is **filtered out of the rendered
view** — the user navigates to `/artifacts` (or clicks the toast link) and sees
nothing new. This silently re-breaks the very regression the queue was added to
fix. Specify the drain to mirror the listener: prepend **and** open the last
queued item's folder **and** expand it (or change the folder/filter model).
Also pin drain semantics the spec leaves open: does drain *clear* the queue
(once-only) or re-deliver on every mount (needs dedup)?

The proposed delivery test ("render `ArtifactsPage` after `enqueueArtefact` and
assert the item appears in its list", line 186) will **not** catch this if it
asserts membership in the `artefacts` array rather than *rendered visibility
through the folder filter* — tighten it to assert the item is visible in the DOM.

### [Medium] Delivered briefings vanish on `ArtifactsPage` unmount — "land reliably" / "lost on reload" mis-state the retention boundary

**Location:** Goal "land reliably in the Artefacts library" (line 19); Out of
Scope "ephemeral (lost on reload)" (line 200); new TD (a) (line 211). Cross-ref:
`ArtifactsPage.tsx:17` (`useState(mockArtefacts)`).

`ArtifactsPage` holds its list in `useState(mockArtefacts)`; that state is
discarded whenever the page unmounts (any navigation away from `/artifacts`),
and the queue is drained once. So a delivered briefing is visible only for the
**first continuous mount** after the save — leave `/artifacts` and come back
(same session, no reload) and it is gone, because the drained queue is empty and
state re-seeds from `mockArtefacts`. The spec states the limit as "lost on
reload," which understates it: it is lost on **unmount**. Against the Goal's new
"reliably" wording (line 19), this is misleading — delivery is reliable, but
retention is one-navigation-away. Either soften "reliably" to scope only
delivery, or state the sharper retention boundary explicitly so the toast-link
UX ("Saved to Artefacts →") doesn't imply a durable entry.

### [Medium] Boundary inconsistency: strict about `enqueueArtefact`'s barrel export, silent on `generateAndDownloadPDF` and `ArtefactItem` (also imported by signals)

**Location:** §5 step 2 (line 82) and step 3 (line 83); "Component Changes →
`features/artifacts`" (line 164); the "index.ts-only boundary stands" note
(line 115). Cross-ref: `frontend/src/features/artifacts/index.ts:1-2`.

`SignalsPage.handleSaveAsArtefact` consumes **three** artefacts-side symbols: it
calls `generateAndDownloadPDF(item)` (`lib/artefactPdf.ts`), builds an
`ArtefactItem` (`types.ts`), and now calls `enqueueArtefact(item)`. The artefacts
barrel (`index.ts`) currently exports **only** `artifactsRoutes`. The spec is
explicit that `enqueueArtefact` must be added to the barrel (line 164) and that
signals must not import artefacts internals (line 83) — yet it is silent on
`generateAndDownloadPDF` and `ArtefactItem`, which live under `lib/` and
`types.ts` (internals). Under the spec as written, signals would deep-import
`@/features/artifacts/lib/artefactPdf` and `@/features/artifacts/types`,
violating the very index.ts-only rule the spec champions (and the repo's `import-x`
lint). Specify that **all three** symbols are re-exported through
`features/artifacts/index.ts`, or pick one boundary story and apply it uniformly.

### [Medium] PDF escaping scopes structural breakers but not non-ASCII — common LLM punctuation mojibakes

**Location:** "PDF escaping (in scope)" (line 88). Cross-ref:
`artefactPdf.ts:90-104` (Helvetica / Helvetica-Bold), `:55,64,76`.

The in-scope escaping (`\` → `\\`, `(` → `\(`, `)` → `\)`) makes the content
stream parse-valid, but `createSimplePDF` writes text into a Helvetica
(StandardEncoding/WinAnsi) literal string with no encoding handling. LLM
free-text routinely contains em-dashes (—), smart quotes (" "), en-dashes, and
bullets (•) — high bytes that render as mojibake or wrong glyphs under that
font/encoding even after the structural escaping. The stated goal is to "survive
LLM free-text" (line 88); non-ASCII is a free-text survival issue the escaping
doesn't cover. Either fold ASCII-sanitization (strip/fold non-WinAnsi chars)
into the escaping scope, or explicitly record non-ASCII mojibake as an accepted
limitation alongside the deferred structural issues (line 201).

### [Medium] In-scope TD-FE-73 tightening couples to the feature's own fallback logic, and the live capture has an external data dependency

**Location:** Context point 1 (line 28); "Dependencies & Follow-ups" TD-FE-73
paragraph (line 209). Cross-ref: `contracts.ts:9-15`, spec mapping lines 71/110/134.

Two concerns with pulling TD-FE-73's "fully tighten `SignalLeadMapResponseSchema`"
into this branch:

1. **Coupling to the feature's fallbacks.** The feature deliberately depends on
   the tolerant guards it now proposes to remove: `company`/`why` are
   `.optional().default("")` (the mapping's `company || "Unknown company"` and
   "omit `: why` when empty" logic at lines 71/110 assume a present string), and
   `relevance` is `.catch("low")` (line 134). "Fully tighten" by dropping those
   guards changes `company`/`why` to `string | undefined` and makes a missing
   `relevance` throw at parse — which would break the per-row fallback logic *and*
   turn a single odd lead into an org-wide query error (every card's leads
   section errors). Specify: keep tolerance where the feature depends on a stable
   default; only strip genuinely-permissive extras (e.g. `.passthrough()` on
   shapes that aren't variable).
2. **External dependency.** "Capture a live keyed `(user_id, org_id)` response
   that has signals + leads" (line 209) presupposes such an account exists in
   production. At 0 users that capture source may not exist, which would block
   the whole branch. Confirm a capture source is available, or make TD-FE-73 a
   separable task that can slip without gating the CTA (the feature functions on
   the current tolerant contract).

### [Low] Error-state "Recompute" can no-op with no feedback

**Location:** §4 error state (line 66); "Component Changes" `onRecomputeLeadMap`
(line 147). Cross-ref: `useSignalLeadMap.ts:53-65` (`refresh`).

The error state offers "Recompute lead mapping" via `refreshLeadMap`, but the
hook's `refresh()` catches failures to a `console.warn` and — on success — calls
`queryClient.setQueryData` without invalidating the `query` whose `isError`
drove the error state. So a failed recompute leaves the error UI unchanged and
silent, and even a successful one may not flip `isError` off depending on what
`setQueryData` accepts. Specify user feedback (loading/toast) on recompute and
ensure the query actually refetches/invalidates so the section transitions out
of error on success.

### [Low] Module-level queue is not reset between tests

**Location:** "Component Changes → `features/artifacts`" (lines 163-165);
delivery test (line 186).

The pending-artefact queue is a module singleton that persists across test files
unless explicitly cleared. Delivery/ordering tests will leak state into one
another (and into unrelated `ArtifactsPage` tests) without a reset. Specify a
`resetArtefactQueue()` (or equivalent) used in `beforeEach` for the queue
tests so they're isolated.

## Observations (no action)

- All 11 round-1 findings were addressed in the revision (event-loss → queue
  hand-off; PDF → in-scope escaping + deferred-structural TD; TD mischaracterization
  → corrected; disabled-button → `aria-disabled` + guard; loading/error/zero →
  four-state section; forced navigation → toast; icon citation, optional fields,
  auto-dismiss, filename, placement → all resolved). Verified against current
  source.
- The queue is a justified consequence of the chosen toast/no-navigate UX —
  router-state delivery would only work if the user navigated, whereas the queue
  survives until the next `/artifacts` visit. Not over-engineered.
- Scope grew (CTA + delivery queue + PDF hardening + TD-FE-73 contract work) but
  each addition traces to a round-1 finding or an unblocked TD, and the work
  decomposes into separable, independently-testable tasks — plan-readiness
  remains high.
- The four-state section correctly uses the org-level `isLoading`/`isError` flags
  to decouple "empty" from "loading" (round-1 gap), and acknowledges the single
  org-wide fetch — good fix.
- The delivery regression test (line 186) is the right idea; it just needs to
  assert rendered visibility, not enqueue/state membership (see the High above).
