---
synthesizes_review: docs/reviews/24-frontend-phase-5-market-research-design-spec-review-5.md
artifact: specs/24-frontend-phase-5-market-research-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-01
round: 5
---

## Round Recommendation

no

Reason: All agreed findings are documentation-integration fixes (mostly of the freshly-added §9 delta 8 hook-first re-cut); the one High is adding an already-decided abstraction to the architecture tree, not new design surface — applying them converges the loop.

## Agreed Findings

- **F2 (High — `useMarketResearchData()` absent from the architecture tree; 5b-hook relationship buried in a delta parenthetical):** Agree, and agree it's High — this hook is the new linchpin from delta 8 (event #2) and a 5c/5d plan-writer needs it as a first-class concept. Adding (a) a named `hooks/useMarketResearchData.ts` entry to the §2.1 tree, and (b) a short paragraph (§5 or §6) stating the transition model: it starts in 5c as a raw-`fetch`/`useState` wrapper (no TanStack), and 5d–5h progressively replace its internals with the 5b TanStack hooks (`useResearchComponent`/`useRegenerateResearch`) until raw `fetch` is gone (24i confirms). This documents an already-decided design — no new surface.

- **F1 (visual-regression body text contradicts §9 delta 6) — agree finding, disagree severity (see below); reviewer partially incorrect on locations:** The "supersedes" mechanism in delta 6 is a real smell — relying on a reader to apply it across a 322-line spec is unreasonable. **But two of the four cited locations are already fixed:** §3 "Done when" (L137) already reads "visual parity via behavioral E2E + Vitest; **no MR pixel VR** — §9 delta 6", and §11 DoD item 5 (L278) already carries the same qualifier. The genuinely-unqualified survivors are **§6 "Done when" (L205, "E2E + visual + preflight green"), §8 (L242, "visual regression stay green"), and §12 R4 (L289, "visual regression at 2%")**. Fix: inline the delta-6 qualifier into those three.

- **F3 (Medium — §5 "Done when" is an unparseable ~200-word monosentence):** Agree. For the most complex sub-phase the "Done when" should be the clearest. Rewrite L188 as a bulleted checklist (one gate per bullet), adopting the reviewer's structure but updated for the hook-first cut (`useMarketResearchData()` holds the data layer, shell holds no fetch-result `useState`).

- **F5 (Medium — §13 route-URL open question resolved but not struck):** Agree, though Low not Medium (see below). Delta 6 resolved the route; the sibling `Scout*` question (L307) is already struck. Strike L302 and annotate "RESOLVED in 5a (§9 delta 6): `/your-ai-team/scout/:tab`, segments `marketintelligence`/`leadstream`/`chatwithscout`, frozen."

- **F6 (Low — "fit in agent context" is unmeasurable):** Agree, minimally. The spec already defers the file breakdown to each per-section plan ("the exact file breakdown per section is a 5d–5h plan decision"), so the reviewer's option (b) is nearly already in place. Add one clause making the real criterion explicit: single-responsibility (not a LOC target), with the per-section plan proposing the breakdown and the plan reviewer assessing fitness.

- **F8 (Low — `knip --strict` gate can't catch the 8 dead files):** Agree — correct gap. §7 already documents knip's dead-file blind spot (entry glob makes every file a production entry), but the §7 "Done when" + §11 DoD item 5 gates say only "knip --strict clean", which passes with dead files present. Qualify both gates: dead-file removal is verified by **absence of `// DEAD CODE` annotations** in the feature, not by knip.

- **F11 (Nit — header omits round 4):** Agree. The date line (L4) acknowledges "rounds 1–4" but the header review-history summary (L3) and §14 (L320) say only "1–3". Real internal inconsistency in my own document. Add round 4 to the header summary (and §14 if a synthesis-4 exists).

- **F13 (Nit — context-placement criteria possibly over-formalized):** Agree with the reviewer's own conclusion: **no action**. The formalization is justified by the precedent-setting goal (Phases 6–12 reference it); revise only if a future phase finds it ambiguous in practice. Recorded for traceability.

## Disagreed Findings

- **F12 (Nit — §14 brace-expansion shorthand `{review,synthesis}-{1,2,3}.md`):** Leave as-is. The audience is developers for whom brace expansion is standard and compact; expanding to six explicit filenames adds noise without removing real ambiguity. The reviewer themselves rated it low-priority "could confuse."

## Deferred Findings

- **F4 (Medium — spec reads as patched changelog; dual retrospective/prospective role):** Defer the wholesale clean-rewrite. The reviewer concedes the content is "all there and internally consistent" — this is a structural smell, not a content error. The cheap integrations agreed above (F1/F3/F5 + the F2 addition) absorb the worst of the smell for the load-bearing 5c text now. A full body-rewrite that relocates all deltas to an appendix is a high-cost, consistency-risking pass against an MVP-velocity posture, and the spec's primary near-term consumer (this orchestrator) holds the context. **Trigger:** a 5d–5h plan-writer demonstrably mis-parses the §5/§6 intent, or the spec outlives the current execution context.

- **F7 (Low — §4.1 line-number anchors invalidated by 5a):** Defer. The table already carries purpose labels ("load latest research", "research operations", "company profile"), and the footnote already declares the line numbers a stale pre-5a anchor that 5b re-identifies by search. Both 5a and 5b have shipped, so the numbers are harmless, clearly-flagged historical residue. Folds into the F4 cosmetic pass. **Trigger:** same as F4.

- **F9 (Low — "5a" overloaded for sub-phase vs plan "24a"):** Defer. The dual identifier is intentional (sub-phase `5x` ↔ plan `24x`) and explicitly mapped in the §1.4 table. The reviewer themselves gates this on "if a clean-rewrite pass happens" (i.e. F4). **Trigger:** same as F4.

- **F10 (Nit — §1.2 `useState` audit trail is review-level detail):** Defer. Agree it reads as provenance, but that provenance has value — it pre-empts a future reader re-deriving the count and re-litigating the round-1 "49" undercount. Trimming is cosmetic; folds into the F4 pass if it happens. **Trigger:** same as F4.

## Severity Disagreements

- **F1: High → Medium.** Agree the finding; disagree the severity. The spec is internally consistent via delta 6, two of the four cited locations are already fixed, and the failure mode of a misread is fast (an attempt to run a non-existent MR pixel-VR fails immediately rather than silently shipping a defect). It is a documentation-consistency issue across the remaining sub-phases, not a design gap — Medium.
- **F5: Medium → Low.** Agree the finding; disagree the severity. A resolved-but-unstruck open question in §13 is housekeeping; the resolution is already authoritative in delta 6. Low.

## Open Questions

- **F1 location accuracy:** the reviewer lists §3 "Done when" and (via the delta-6 enumeration) §11 DoD item 5 as unfixed, but both already carry the delta-6 qualifier in the live spec. The synthesis scopes the fix to the three genuinely-unqualified survivors (§6, §8, R4). If the reviewer intended a stricter standard (e.g. every "visual" token everywhere, including §1.2's safety-net row L27 which describes the *Phase-0* baseline that genuinely existed), that is a separate call — left as-is here since §1.2 is descriptive history, not a 5c–5i gate.
- **F2 transition paragraph placement:** §5 vs §6. Leaning §5 (it's where `useMarketResearchData` is introduced) with a one-line forward-reference from §6's per-section pattern. Final placement is a drafting call at apply time.
