---
synthesizes_review: docs/reviews/38-signals-cta-design-spec-review-1-glm-5.2.md
artifact: specs/38-signals-cta-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-19
round: 1
---

## Round Recommendation

yes

Reason: One Critical (artefact delivery silently fails) and one High (PDF generator is structurally fragile) are both agreed; the Critical fix introduces new design surface (a reliable artefact hand-off + a revisited navigation/UX decision) that should be re-reviewed.

## Agreed Findings

Every finding below was verified against current source before agreeing — no finding was accepted on the reviewer's assertion alone.

- **[Critical] `addArtefact` dispatched before `ArtifactsPage` mounts → library entry lost.** Verified: `addArtefact` has exactly one listener, in `ArtifactsPage.tsx:48` (mount `useEffect`); `StrategistWorkspace` dispatches at `:739/:793` then `setTimeout(() => navigate("/artifacts"), 1200)` at `:784/:834`. The dispatch fires while the *signals* (or strategist) page is mounted — where no listener exists — and the target page mounts 1200 ms later, after the event is gone. No global listener, no buffer. The pattern is genuinely broken (Strategist's save is broken too, masked at 0 users). **Revision:** rewrite §5 to require a delivery mechanism that works when dispatcher and listener are not co-mounted — recommended: a module-level pending-artefact queue exported from `features/artifacts` (`enqueueArtefact(item)`) that `ArtifactsPage` drains on mount *and* keeps the live `addArtefact` listener for same-page dispatches; `SignalsPage` enqueues then navigates. Delete the inverted "so the library page is mounted to receive the event" causal claim. Add a test that mounts `ArtifactsPage` and asserts the enqueued item appears in its list (not merely that an event was dispatched).

- **[High] PDF deliverable routed through a structurally fragile generator, unacknowledged.** Verified against `artefactPdf.ts`: raw interpolation into `( … ) Tj` with no escaping (`:55,58,64,70,76,82`), hardcoded `/Length 2000` (`:49`), placeholder xref offsets / `startxref 3000` (`:113-121`), single fixed `MediaBox` with no pagination. The briefing's `title`/`description`/`why` are LLM free-text that routinely contains parens, backslashes, and smileys. **Revision (in scope):** add minimal PDF-string escaping (`\` → `\\`, `(` → `\(`, `)` → `\)`) to the generator path used by the briefing, since the briefing is the feature's reason for existing. **Defer (TD):** unbounded `/Length`, real xref offsets, and pagination/overflow — inherited limitation shared with Strategist (see Deferred).

- **[Medium] TD-FE-72/73 hygiene instruction mischaracterized the register.** Verified: `TECH_DEBT.md:84` shows TD-FE-72 `resolved` (archived); TD-FE-73 (`:1098`) is "FE contract derived from code, not a live response," its action is to call the live endpoint with a real keyed `(user_id, org_id)`, capture the JSON, and reconcile `SignalLeadMapResponseSchema`, and its pull-forward trigger is "endpoint confirmed deployed on Render." **Revision:** rewrite Context point 1 + Dependencies — (a) do **not** touch the already-resolved TD-FE-72; (b) state that this spec satisfies TD-FE-73's trigger and pull the live-shape contract reconciliation forward as in-scope/adjacent work; (c) reword the stale `useSignalLeadMap.ts:59-63` comment — the control is **live and visible** (`SignalsPage.tsx:691-692` "Recompute lead mapping" wired to `refreshLeadMap`), not a "dormant control [that] 404s."

- **[Medium] "Disabled" button that must still fire `onClick` is a contradiction.** Verified: a native `<button disabled>` does not fire `onClick`, so "greyed out and disabled" + "clicking while disabled shows a message" cannot both hold under the obvious implementation. **Revision:** §2 — specify a button that is **visually styled as disabled but functionally enabled**, with `aria-disabled={!isAccepted}` and an `onClick` guard that shows the lock message when not accepted (so the explanatory click works and the a11y state is honest).

- **[Medium] Empty-state conflates loading/error with true-zero.** Verified: `useSignalLeadMap` is "quiet (empty) while loading, disabled, or on error," so `leadsForSignal()` returns `[]` in all three cases. **Revision:** §4 — pass the hook's `isLoading`/`isError` down; show a loading affordance during fetch and an error state (offering the existing "Recompute lead mapping" action) on error; show "No matched leads found for this signal yet." **only** on a genuine empty result.

- **[Medium] Forced navigation to `/artifacts` after every save disrupts the feed.** Agreed the concern is real for a feed where a user may save several briefings per session (Strategist's save is terminal; Signals' is not). This finding is entangled with the Critical fix: once delivery no longer depends on navigation (queue mechanism above), the navigation becomes a free UX choice. **Revision:** replace forced navigation with an immediate PDF download + a toast "Saved to Artefacts →" linking to `/artifacts`; the library entry is delivered reliably via the queue regardless of navigation. **Note:** this supersedes the operator's earlier "match Strategist (navigate)" decision — flagged in Open Questions for confirmation.

- **[Low] Agent→icon/color citation wrongly includes `StrategistWorkspace`.** Verified: `StrategistWorkspace` hardcodes `agentIcon: Compass` / `agentColor: "bg-indigo-500"` for its own "Strategist" agent (`:743-744,797-798`); it carries no scout/profiler map. **Revision:** cite `mockArtefacts.ts` only; drop the "duplicated … between `mockArtefacts.ts` and `StrategistWorkspace.tsx`" claim. (Feature-local resolver decision stays.)

- **[Low] Optional lead fields produce degraded rows / PDF entries.** Verified `contracts.ts:9-15`: `company` and `why` are `.optional().default("")`; `relevance` is `.catch("low")` (always present). **Revision:** specify fallbacks — `company || "Unknown company"`; omit the `: ${why}` suffix in `keyFindings` when `why` is empty. Also tighten the spec to name the real exported type `SignalLeadMapLead` (currently hedged as "the lead element type").

- **[Low] Lock-message dismissal trigger + timer lifecycle under-specified.** **Revision:** §2 — auto-dismiss after ~3 s via a timer cleared on unmount and on card collapse; define "next interaction" as any click on the card or its controls.

- **[Nit] Download filename collides across repeated saves.** Verified `artefactPdf.ts:138` slugifies title only. **Revision:** include a short timestamp/suffix in the briefing's download filename so a re-save doesn't silently overwrite.

- **[Nit] Placement of `[Find Matched Leads]` + leads section not pinned.** **Revision:** add a one-line ordering note — within the expanded block: description → sources/citations → `[Find Matched Leads]` button → (leads section when open) → recommendations.

## Disagreed Findings

None. Each finding was cross-checked against the cited source (signals/artifacts/strategist code, `TECH_DEBT.md`, route registry, `contracts.ts`) and holds.

## Deferred Findings

- **PDF generator structural correctness beyond escaping** (hardcoded `/Length`, placeholder xref offsets, single-page `MediaBox` with no pagination/overflow handling). Deferred as an inherited limitation shared with the existing Strategist artefact path; fixing the generator wholesale is out of scope for this feature. **Record as a new TD** (PDF generator emits structurally non-compliant output; lead-heavy briefings clip past one page). **Trigger:** a briefing overflows one page in practice, or a strict PDF reader rejects the output, or the artefacts PDF path is prioritized.
- **Fixing Strategist's identical broken dispatch.** Deferred — out of scope for this spec. **Trigger:** if the recommended shared queue mechanism lands in `features/artifacts`, Strategist's two call sites should adopt it in a follow-up (one-line change each); note it in the new TD.

## Severity Disagreements

None. All severities as assigned are appropriate.

## Open Questions

- **Navigation vs toast (operator decision).** The recommended revision drops the forced `navigate("/artifacts")` in favor of download + a "Saved to Artefacts →" toast, with reliable library delivery via the queue. This reverses the earlier "match Strategist (navigate)" decision — made before the Critical finding revealed that pattern doesn't actually deliver. Confirm the toast approach, or keep navigation (now purely UX, since delivery is decoupled).
- **Scope of the live-shape contract reconciliation (TD-FE-73).** Whether to fully tighten `SignalLeadMapResponseSchema` against a captured live response within this feature's branch, or capture-and-record-only and tighten in a dedicated follow-up. The feature only needs the current tolerant contract to function; the reconciliation is now *unblocked* but its depth is a scoping call.
