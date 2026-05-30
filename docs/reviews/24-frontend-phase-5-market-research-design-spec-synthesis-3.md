---
synthesizes_review: docs/reviews/24-frontend-phase-5-market-research-design-spec-review-3.md
artifact: specs/24-frontend-phase-5-market-research-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-30
round: 3
---

## Round Recommendation

no

Reason: Verdict is `clean` (converged). The attached findings are advisory polish — one Medium edge case + Low/Nit, all agreed and applied, none blocking. Spec is ready for plan-writing. (The reviewer marked `clean` yet listed findings, so I processed them rather than emit the command's hollow short-circuit synthesis.)

## Agreed Findings

- **[Medium] Shared GET between `intelligence` and `analysis` tabs.** Correct — this is synthesis-2's open question, now worth a default rather than a dangling note. Added a §5 action: if the `analysis` tab shares the GET `market-research` ("load latest research") fetch, 5c either **(i)** duplicates it as raw `fetch` in the legacy `lead-stream/` unit (default — duplication over coupling for transitional code) or **(ii)** promotes the GET service fn to `src/shared/` so both consume it without a feature→legacy dependency. 5c decides; default (i).
- **[Low] 5a "zero logic change" framing.** Correct — annotation + `<FeatureErrorBoundary>` wrapping + `Scout*` import-tracing are logic-adjacent. Reframed §3 (and the §1.4 5a row) to "no **behavioral** logic change; those steps are additive/non-behavioral."
- **[Low] §4.1 line numbers will drift.** Correct and load-bearing — once 5a moves the file the numbers are wrong. Added: "pre-5a anchor; 5b re-identifies sites by searching `fetch(` + `buildApiUrl` in the relocated file, not by line number."
- **[Low] 27 human checkpoints.** Process-cost observation; the reviewer defers to the operator. Added a light §10 qualifier consistent with the just-made §5.2 change: **approval depth is the orchestrator's judgement** — mechanical sub-phases (5a, 5i) may warrant lighter sign-off than design-heavy ones (5b, 5c). Flagged for the user (it's a process-posture choice, not a defect).
- **[Nit] §5 done-when "no raw fetch" misreadable.** Clarified to "the feature's own modules have no raw `fetch` (the legacy lead-stream unit it renders does)."
- **[Nit] §2.1 tree omits section containers.** Added a representative container file under `market-entry/` to show the pattern.

## Disagreed Findings

None — all six actionable findings hold and were applied.

## Deferred Findings

- **Shared-GET resolution (i vs ii)** is a `24c` (5c) decision; the spec now sets the default (i) and the trigger (the 5b tab-tagging reveals whether the GET is actually shared). Trigger: 5c planning, informed by 5b's site partition.

## Severity Disagreements

None. The Medium is reasonable as Medium (an unhandled edge case in the data-layer boundary); the rest are correctly Low/Nit.

## Open Questions

- The review's verdict is `clean` but it carried findings; I applied them (round 4) rather than short-circuit. If you'd rather treat `clean` as "stop, no further edits," I can revert the round-4 polish.
- The §10 checkpoint-depth qualifier (Low #4) is a process-posture addition I made consistent with your §5.2 change — confirm you want it kept.
