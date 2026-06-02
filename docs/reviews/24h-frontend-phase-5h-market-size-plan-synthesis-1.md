---
synthesizes_review: docs/reviews/24h-frontend-phase-5h-market-size-plan-review-1.md
artifact: plans/24h-frontend-phase-5h-market-size.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-02
round: 1
---

## Round Recommendation

yes

Reason: The [High] `useMarketResearchData()` slice-removal gap is real and load-bearing; the fix reopens the cascade/timestamp/edit-history surface that twice tripped the 5c R1 hatch, so the revised plan warrants a re-review.

## Agreed Findings

- **[High] Plan omits removing the market-size slice from `useMarketResearchData()`.** Agree — this is a genuine spec-§6 gap. Task 2 deletes only the section's *own* `fetchMarketSizeData` load path (the `_marketSizeData` holder the plan itself flags as "currently unused for display"). The data the section actually renders is drilled in from the page-level `useMarketResearchData()` hook (5c created it — §5/§9 delta 8 to hold the verbatim raw-`fetch`/cache/cascade/timestamp machinery). Task 4 stops the composition layer from passing that slice, but the hook keeps fetching + caching it → a live raw `fetch` + `CACHE_DURATION` slice with no consumer. Spec §6 (line 212) is explicit: "the actual removal of each section's raw `fetch` site + its slice of the `CACHE_DURATION`/localStorage cache + cascade/timestamp/edit-history handling happens **here**"; §11 item 3 confirms this completes across 5d–5h and 24i only *re-confirms* zero raw `fetch`. Since 5h is the last section, this is the last per-section cleanup before the gate. **Revision to make:** (1) add to Task 0 an inventory grep of `useMarketResearchData()` to identify the market-size slice (likely `marketData`; verify at execution time) and its cascade/timestamp/edit-history surface; (2) add a step (Task 2 or Task 4) that either removes that slice — display data now sourced from `useMarketSize`, edit/cascade behavior migrated or consciously dropped per spec §6 — or explicitly defers it to 5i with a documented rationale plus a Task 5 §9-delta handoff note so 5i expects it. This mirrors the reviewer's recommendation (a)/(b).
- **[Low] `useMarketSize` reference code may diverge from 5b's actual API.** Agree (severity Low). The grep instruction (line 260) and the Step-1 not-enabled test already provide a safety net, but the trap (verbatim copy) is cheap to close. **Revision to make:** label the Task 2 Step 3 code block as illustrative ("verify exports + `enabled` gating against the Step-1 red test before use; do not copy verbatim"), and make explicit that if 5b's `useResearchComponent` does not internally gate on empty `orgId`, the implementer adds `enabled: !!orgId` to make the Step-1 disabled-query test pass.
- **[Low] Task 3 Steps D–J lack test skeletons for the non-trivial transforms.** Agree in part (severity Low). Prose assertions are adequate for the simple list-edit leaves (F/G), but the `Record<string,string>`→rows/series transforms (H/I) and the display-formatting in E are non-obvious. **Revision to make:** add a brief input→expected-output example (not a full RTL skeleton) to Steps H and I — and a one-line empty-map expectation — so the data-shaping contract is unambiguous; leave F/G as prose.

## Disagreed Findings

- **[Low] Task 3 narrow vitest scope delays sibling-section regression detection.** Disagree on necessity. The finding's realistic failure mode — a broken shared type/import/re-export — is already caught per-carve: every Task 3 step runs `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json`, both project-wide, before its commit (Task 3 "After each step" block, lines 333–337). The only residual the per-carve run misses is a *behavioral* change in a shared utility — but a verbatim-markup carve that extracts section-local logic into new `market-size/` files does not modify shared utilities, so that path is near-zero, not merely low. Task 4 (`npx vitest run src/features/market-research`) and Task 5 (full preflight) close the window. A midpoint broader run is harmless if the executor wants it, but it is not worth mandating given the pre-launch velocity posture. Leaving as is.
- **[Nit] Self-review section duplicates Architecture + spec-coverage content.** Disagree (declining to revise). The redundancy is deliberate reviewer-facing scaffolding — the self-review notes exist precisely so a reviewer can check claims without reconstructing them from the body. Trimming to "see Architecture paragraph" trades a small scannability gain for a verification cost on the reviewer. Negligible value; not acting (Nit).

## Deferred Findings

(None. The High finding's "defer to 5i" path is captured as an explicit *option within* the agreed revision — the plan must either remove the slice or document the deferral; the choice is left to the plan author, not deferred wholesale here.)

## Severity Disagreements

(None. High for the `useMarketResearchData()` gap is correct — it is a spec-compliance gap that leaves a live raw `fetch` + cache slice after the *last* section converts and directly threatens the 24i zero-raw-`fetch`/zero-`CACHE_DURATION` gate. Low/Nit on the remaining findings are accurate.)

## Open Questions

- **Systemic across 5d–5g?** The finding notes that if the sibling section plans also never touched `useMarketResearchData()`, 24i would inherit five un-removed slices, contradicting spec §6/§11. Before finalizing the 5h revision, the orchestrator should confirm whether 5d–5g actually removed their slices from the page hook. If they did not, 5h's §9-delta should call out the systemic pattern (and 24i's scope expands from "confirm gone" to "remove all five"), which is a master-plan signal beyond 5h.
- **Slice name + boundary.** The exact `useMarketResearchData()` state backing market-size (`marketData` vs `marketIntelligenceData`) and how much cascade/timestamp/edit-history it carries must be measured at execution time (Task 0). Whether that behavior is *migrated* into `useMarketSize`/the section or *consciously dropped* (spec §6 permits either) is a per-section decision the revised plan must state, not leave implicit — this is the same cascade/timestamp territory that fired the 5c R1 escape hatch twice.
