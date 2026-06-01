---
synthesizes_review: docs/reviews/24e-frontend-phase-5e-regulatory-compliance-plan-review-1.md
artifact: plans/24e-frontend-phase-5e-regulatory-compliance.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-01
round: 1
---

## Round Recommendation

no

Reason: All five findings agreed; the two Mediums are closed by mechanical test/checkpoint/audit edits that open no new design surface, leaving nothing above Nit for a re-review.

## Agreed Findings

- **[Medium] Hook shape validation is textual only (F1):** Make abort-4 executable. Add field-level assertions to the Task 3 hook test (`expect(Object.keys(result.current.regulatoryData)).toEqual(expect.arrayContaining(['keyUpdates','visualDataCards','regionalData','strategicRecommendations']))` after `isLoading === false`), and add an adapter unit test in `regulatoryHelpers.test.ts` using a regulatory-shaped fixture. This converts the "If `data` cannot supply a field…STOP" prose (line 424) into a test that fails in Task 3 rather than surfacing at Task 11.
  - **Code-verified (5b is merged) — F1 is live and the plan is missing a step.** `ResearchComponentSchema` types `data` as `z.record(z.string(), z.unknown()).passthrough()` (`contracts.ts:9`) — fully opaque, no field guarantee; the contract comment defers field refinement to "per-section as 5d–5h render it," i.e. 5e. The shipped 5b MSW handler (`src/test/msw/handlers.ts:60`) is a generic stub returning `data: { component_name, title, summary }` for every component — it does **not** carry the regulatory fields. So Task 3's `expect(regulatoryData).toBeDefined()` passes while every section silently renders defaults (F1's exact failure), and the recommended field-level/adapter assertions cannot pass against the current handler. **Therefore Task 3 must also extend the MSW handler** (branch on `component_name === "regulatory & compliance highlights"` to return a regulatory-shaped `data`, or register a per-test override) — the plan's "MSW handlers exist from 5b" assumption (line 364) is insufficient for this section.
  - **Adapter is a pass-through, not a reshape.** `useResearchComponent`/`fetchResearchComponent` return the `{ status, data }` envelope verbatim; the section reads its fields directly off `data`, so `regulatoryData = query.data.data as UntypedBackendApiResponse` (the plan's preferred line-416 path). No `mapResearchToRegulatory` reshaping is needed — the risk is field *presence*, not field *position*.
- **[Medium] No intermediate full-suite runs (F2):** Add a full `npx vitest run` (no file filter) checkpoint to the decomposition template after the two densest extractions — Task 5 (`ComplianceVisualCard`) and Task 9 (`RegionalComplianceSection`) — to bound regression accumulation before the Task 12 preflight. (`tsc --noEmit` + `lint` already run project-wide each task, so this only needs to cover runtime/behavioral regressions.)
- **[Low] `useAuth()`/`orgId` availability assumed (F3):** Add `grep -nE 'useAuth|orgId|organizationId' "$F"` to Task 0 Step 4's audit so Task 11's data-source swap (`userIdToUse = useAuth().currentUser?.uid`, `orgIdToUse` "already exists ~line 129") is confirmed importable/present before extraction starts. **Resolved (operator decision):** do not trust the unverified `~line 129` anchor — Task 11 should **thread `orgId` explicitly** down from `MarketIntelligenceSections` as a prop rather than assume it is in the section's scope, consistent with this codebase's params-not-context auth model. Reword Task 11 Step 2/3 to make the prop-threading the primary path; the Task 0 grep only confirms `useAuth` is importable for `userId`.
- **[Low] No per-step rollback instruction (F4):** Add a recovery one-liner to the decomposition template (after the Gate step): "If a gate fails, revert uncommitted changes (`git checkout -- .`) and re-attempt the step; if it cannot be made green after two attempts, STOP and escalate."
- **[Nit] Barrel assumes default export without Task 0 confirmation (F5):** Add `grep -nE 'export (default|function|const) RegulatoryCompliance' "$F"` to Task 0 Step 4 so Task 1 Step 2's barrel form (`export { default as ... }`) is self-verified rather than relying on the prose note.

## Disagreed Findings

N/A — no findings disagreed.

## Deferred Findings

N/A — no findings deferred.

## Severity Disagreements

- **[Medium → Low] No intermediate full-suite runs (F2):** I accept the substance and am incorporating the checkpoint, but I read the residual risk as Low, not Medium. The reviewer's worked example (an import change in a later task breaking an earlier task's test) is largely covered already: `tsc --noEmit -p tsconfig.app.json` and `npm run lint` run project-wide on every task gate, so all type-level and lint-level cross-file regressions surface immediately. Only a runtime/behavioral regression in an unfiltered test could accumulate — a narrower window than the finding implies. The fix is cheap regardless, so this disagreement does not change the action.

## Open Questions

Both prior open questions are now resolved.

- **`orgId` scope (was open) — RESOLVED.** Operator decision: Task 11 threads `orgId` explicitly from `MarketIntelligenceSections` rather than assuming it is in the section's scope. Folded into the F3 agreed entry above.
- **5b response shape (was open) — RESOLVED by reading merged 5b code.** `regulatoryData = query.data.data` with the fields directly under `data`; the adapter is a typed pass-through, not a reshape. The real, code-verified gap is that the 5b MSW handler is a generic stub lacking the regulatory fields and the contract types `data` opaquely — so Task 3 must extend the handler for its assertions to be meaningful. Folded into the F1 agreed entry above.
- **New, surfaced during code verification:** Does the *real* backend (`component_name = "regulatory & compliance highlights"`) actually return `keyUpdates`/`visualDataCards`/`regionalData`/`strategicRecommendations` under `data`? The section historically rendered these from the `regulatoryData` prop, which strongly implies yes — but the opaque contract means abort-4 remains a genuine (if low-probability) escalation path. Worth a single live `curl`/`/docs` confirmation against the running backend before Task 11 drops the prop, per the repo's "verify the response shape with a live call" rule.
