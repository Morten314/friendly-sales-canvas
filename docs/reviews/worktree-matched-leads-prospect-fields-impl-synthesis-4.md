---
synthesizes_review: docs/reviews/worktree-matched-leads-prospect-fields-impl-review-4-glm-5.2.md
artifact: worktree-matched-leads-prospect-fields
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-25
round: 4
---

## Round Recommendation

no

Reason: The sole finding (the R3 test is "false-green") is empirically refuted — reverting the merge to the wholesale overwrite makes the test FAIL at `getByText("CXO")`; the production code is correct and the test reliably guards the regression. Only an optional Low test-hardening remains.

## Agreed Findings

- **Optional hardening (the finding's proposed fix, not its premise):** apply the reviewer's assertion reorder — `await findByText("Tier 1")` (merge-completion signal) first, then synchronously `getByText("VP Engineering")` / `getByText("CXO")`. The test already reliably catches the regression, but the reorder removes the dependency on microtask-flush timing and makes the guard deterministic by construction. Cheap, zero-risk, test-only; worth adopting even though the premise below does not hold.

## Disagreed Findings

- **The finding's core claim — "the test is false-green / passes under the regression it claims to guard" — is empirically false.** I reverted `mergeScoredOverReal` to the wholesale overwrite (`for (const lead of scored) byId.set(lead.id, lead);`) and ran the R3 test: it **FAILS** at `LeadsTable.realLeads.test.tsx:205` — `getByText("CXO")` → "Unable to find an element with the text: CXO" (reproduced twice, ~63ms). Mechanism: after `window.dispatchEvent(...)`, the instant-resolve `fetch` mock's promise chain (`fetch` → `res.json()` → `setApiHeatmapLeads`) flushes on the microtask queue **during the `await screen.findByText("VP Engineering")` at line 204**. So by the time the synchronous `getByText("CXO")` at line 205 runs, the merge has completed and the DOM is **post-merge**; under the regression the seniority cell is "—" and `getByText` throws. The reviewer's premise that assertion (B) "is a synchronous `getByText` that runs before the async `fetch → setState` merge completes" is incorrect for this mock — (B) runs *after* the flush, which is exactly why it catches the regression. The reviewer is right that (A) `findByText("VP Engineering")` resolves on the pre-merge render, but (B) — not (A) — is the assertion that empirically guards, and it does so against the post-merge DOM.

## Deferred Findings

(none)

## Severity Disagreements

- The reviewer rated the finding **Low** with the label "false-green." I agree the *residual* concern is Low/Nit, but I disagree with the **"false-green"** characterization: the test is **not** false-green — it reliably fails under the regression (verified). The accurate framing is "the guard is correct-by-mock-timing rather than deterministic-by-construction," which is a Nit-level hardening opportunity, not a defect. The production code itself is correct and complete — which the reviewer also affirms.

## Open Questions

- The guard's determinism currently rests on the `fetch` mock resolving synchronously (so the merge flushes during line 204's await before line 205 runs). If that mock were ever changed to resolve asynchronously (e.g. a `setTimeout`/delayed response), line 205 could run pre-merge and the test could then false-pass. The reorder under Agreed removes this latent dependency. Decision for the operator: apply the reorder (recommended — cheap, deterministic) and re-gate before merge, or merge as-is since the test already guards the regression with the current mock.
