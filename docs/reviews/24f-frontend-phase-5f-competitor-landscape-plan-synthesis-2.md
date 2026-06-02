---
synthesizes_review: docs/reviews/24f-frontend-phase-5f-competitor-landscape-plan-review-2.md
artifact: plans/24f-frontend-phase-5f-competitor-landscape.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-02
round: 2
---

## Round Recommendation

maybe

Reason: Both Highs are agreed and resolvable with contained revisions, but Finding 1's post-save re-read resolution (defer-and-document vs route-through-invalidation now) is a behavioral judgment in the riskiest task that the operator should confirm; everything else is Low/Nit or disagreed-with-reason.

## Agreed Findings

- **[High] F1 — post-save `/api/market_intelligence` re-read (L727) unaccounted for in Task 4's keep/delete analysis.** Correct: the plan keeps the re-read by lumping it into the "write path" (L374), but it is functionally a *read-refresh* that, once the hook owns the read path, coexists with — and can diverge from — the TanStack cache (raw fetch sets local state, bypassing the hook). Revision (Task 4 Step 3): make the decision explicit — keep it this phase (it rides with the deferred `/ask` write path), add `fetch(` to the Step-3 verification grep so the surviving fetches are explicit/intentional, fold the re-read into the *same* TD-FE as the `/ask` write, and state the preferred end-state is post-save `cl.refresh()`/query-invalidation so the hook cache stays authoritative; flag the cache-divergence caveat for the reviewer.
- **[Medium] F4 — hook test only asserts `toBeDefined`.** Correct, and it is the one place the 5b→section read contract is exercised (abort-4 risk). Revision (Task 4 Step 1): strengthen the hook test to assert the resolved `CompetitorLandscapeView` exposes the four scalars (`executiveSummary`/`topPlayerShare`/`emergingPlayers`/`fundingNews`) + `uiComponents`, matching the MSW payload. Complements round-1's container auto-hydrate assertion (component-level) with a hook-level shape check.
- **[High→Med] F2 — Task N+1 candidate list conflates data fields with view-state fields.** Correct that `competitorExpanded/HasEdits/DeletedSections/EditHistory/LastEditedField/CustomMessage` are per-section editing state whose local-vs-forwarded ownership is undetermined on paper. Revision (Task N+1 Step 1): split the list into genuine **data** fields (removable — the hook owns them) vs **view-state** fields (confirm container-local ownership via the Task 0 audit; default to keeping). (Severity downgraded — see below.)
- **[Med→Low] F6 — Task 2 has no knip gate.** Correct, and it contradicts the plan's own Conventions rule ("run knip where reachability changed" — a type move changes reachability). Revision: add `npx knip --strict --no-progress` to Task 2's gate to catch an orphaned old inline type. (Severity downgraded — see below.)
- **[Low] F7 — Task 0 checks 5c but not the sibling-section pattern 5f is told to mirror.** Correct. Revision (Task 0 Step 2): add a check that at least one sibling dir exists (`intelligence/market-entry/` or `regulatory-compliance/`) as evidence the per-section decomposition pattern landed — the hook/unwrap guidance explicitly says "match the siblings."
- **[Low] F8 — `uiComponents?: unknown[]` is an unenforced trust boundary.** Agree as a documentation nit (reviewer themselves call it non-blocking). Revision: add a one-line comment in `types.ts` that `unknown[]` is intentional (mirrors 5b's tolerant `.passthrough()`); the Task-3 extractors are the typed/tested boundary. No zod guard — that would contradict the deliberate "no per-component schema" decision (L16, L199).
- **[Nit] F11 — Section-copy note risks being read as non-normative.** Agree to a minimal fix: add a one-line pointer to the Section-copy note from the Conventions block (L21). Not consolidating the note itself (it carries the "if 5c did migrate the copy, read from `../../sectionCopy`" branch worth keeping under its own heading).

## Disagreed Findings

- **[Medium] F3 — "reconcile scope not bounded; abort 3 may fire on a mechanical block-count difference."** Misreads abort 3 (L34): it already says a changed block count → "the audit wins; update the task list… continue **only if** mechanical" and STOPs *only* "if it implies a behavior change not covered by a test." The reviewer's recommendation ("abort only on behavior-changing divergence, not a mechanically-decomposable count change") is already the text. Round 1 additionally added the renumber note to the Tasks 5–N reconcile item (L414). The residual "the threshold is subjective" sub-point doesn't warrant a revision: for a byte-for-byte-preserving refactor, "behavior change not covered by a test" is the natural bar, and these are controller-escalation criteria, not automated gates.
- **[Medium] F5 — flag the hardcoded `"brewra"` orgId default as a TD-FE.** Declining, grounded in a standing project decision the reviewer lacked: at MVP / 0 users the team explicitly does **not** track auth/multi-tenancy hardening as debt and preserves existing posture as-is (neither harden nor rip out); CLAUDE.md documents that multi-tenancy already trusts client-supplied IDs by design at this stage. The plan's "keep behavior" (L367) is exactly correct; adding a tenancy-hardening TD-FE would be posture-drift noise. Trigger to revisit: external/multi-tenant users — at which point the whole tenancy model (not just this default) gets a debt entry.

## Deferred Findings

- **F1 preferred end-state — routing post-save refresh through `cl.refresh()`/query-invalidation** (instead of the raw `/api/market_intelligence` re-read) is deferred to the existing `/ask` write-path TD-FE rather than done in 5f, keeping this phase's scope to the *read* path. Trigger: migrating the `/ask` write path off raw fetch (the same trigger already recorded for the write-path TD-FE in Task N+2 Step 7).

## Severity Disagreements

- **F2: agree finding, High → Medium.** Both failure modes the reviewer names are largely compile-caught: a missed-but-still-forwarded field and an over-removed field both surface at the Step-4 `tsc --noEmit` backstop (named explicitly in Step 1 since round 1), and the "when in doubt, leave the field" rule already biases toward safe under-removal. Real ambiguity remains (hence agreeing), but it is not High.
- **F6: agree finding, Medium → Low.** A pure type move is fully compile-checked by the existing `tsc`+`lint` gate; adding knip catches an *orphaned* old type — a cleanliness gap, not a behavioral regression signal.

## Open Questions

- **F1 (drives the `maybe`):** does the controller want the post-save refresh routed through the hook (`cl.refresh()`/invalidation) **now** — cleaner, keeps the TanStack cache the single source of truth — or deferred with the rest of the `/ask` write path? Doing it now slightly enlarges the heaviest commit; deferring keeps a raw read-refresh alongside a hook-owned read path until the write-path TD is paid down.
- **F2:** the local-vs-forwarded ownership of the view-state fields is only determinable from the merged 5c tree at Task 0 — the plan can prescribe "confirm + default-keep" but cannot resolve it on paper.

## Non-findings acknowledged (no action)

- **F9 (parallelizability)** — the reviewer's own conclusion is "no finding; Task 4→Task 3 dependency is real." Confirmed.
- **F10 (pre-5a line-number anchoring)** — reviewer states "no action needed"; round 1 already added the "re-derive from Task 0 grep — do not use literal line numbers" caveat at Task 0 Step 4.
