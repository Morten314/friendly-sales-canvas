---
synthesizes_review: docs/reviews/40-apollo-connection-management-plan-review-1-glm-5.2.md
artifact: plans/40-apollo-connection-management.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-23
round: 1
---

## Round Recommendation

no

Reason: The lone Medium is disagreed (verified: the consequence is already documented in spec §9/§13 and the no-TD decision is explicit in §14, all accurately cited by the plan); the five agreed findings are Low/Nit, revised in-place, and open no new design surface.

## Agreed Findings

- **[Low] Disconnect failure path (`onError`) untested.** Added a Task 5 test mirroring the success test but with a rejecting `mutate` that invokes `onError`, asserting the destructive "Couldn't disconnect Apollo…" toast fires, the "Apollo disconnected." success toast does **not**, and the tile stays connected (gear still present). Documented in the Self-Review.
- **[Low] No explicit per-task / global abort criteria.** Added an "Execution notes" stanza: a per-task "red `verify`/`prettier --check` halts that task; never commit a red task" line, and the `DELETE /connectors/apollo/connect` contract named as the one external assumption — verified against backend code (`response_model=DisconnectResponse`), not live-probed (spec §3.3 left a live check optional) — with an explicit stop-and-report if an executor probes live and the shape/idempotency diverges.
- **[Low] Tasks 1–4 parallelizable but presented serially.** The same "Execution notes" stanza now records the dependency graph (1–4 touch disjoint files and may run in parallel; Task 5 joins; Task 6 tails) and cautions that concurrent runs should serialize their `npm run verify` invocations (known connectors-suite parallel-contention flake under sandbox load).
- **[Nit] Task 1 implementation-first, not red-green.** Reordered Task 1 to strict TDD — Step 1 writes the failing test, Step 2 runs it expecting `FAIL "Cannot find module '../useDisconnectApollo'"`, Steps 3–5 add contract/service/hook, Step 6 runs expecting PASS, Step 7 gates+commits — matching Tasks 2–4 and the writing-plans template.
- **[Nit] Task 5 Step 1 mock-block ambiguous between "replace" and "add".** Reworded the instruction from "Add … Extend the top of the file" to "**Replace** the existing hoisted-mocks block and `vi.mock(...)` group (real lines 5–25) with the version below", naming the only three additions (`disconnect` value, `useDisconnectApollo` mock, `ApolloConnectModal` mock) and warning that pasting below the existing block redeclares `const mocks`.

## Disagreed Findings

- **[Medium] "Disconnect-during-running credit-spend consequence is declined but never recorded anywhere."** Disagree on substance, verified against the current spec on disk:
  - **§9 (lines 235–241)** states the consequence plainly — the in-flight `_run_discover` holds the key in memory, so disconnect "keeps revealing/ingesting leads and **keeps spending Apollo credits until it completes**" — and records that "adding an in-progress-credit-spend sentence was considered and **declined** (review round 1); the consequence is documented here, not surfaced in the UI."
  - **§13 (314–315)** repeats the resolved decision and points to §9: "the optional in-progress-credit-spend sentence was declined. The credit-spend consequence is documented in §9."
  - **§14 (320–322)** makes the TD decision explicit: "**No new `docs/TECH_DEBT.md` entry required by this work.** If [...] the best-effort disconnect-during-running (in-flight run keeps spending credits, §9) ever needs hardening (e.g. run-cancellation), file a TD-FE entry then."

  So the finding's three load-bearing claims don't hold: (a) the consequence **is** recorded (spec §9) and the plan cites it; (b) §14 does **not** "reserve a TD-FE slot to fill now" — it deliberately declines a TD entry at MVP with a named future trigger; (c) the plan's `(declined, spec §9/§13)` attribution **is** accurate — both sections explicitly record the declined dialog sentence, not merely "best-effort runs." The plan correctly defers to its spec rather than duplicating it (the writing-plans norm). Acting on this finding would either contradict the §14 decision (adding a TD entry) or duplicate §9 in the plan body and invite drift. The user also explicitly declined the dialog sentence. Leaving the plan as-is.

## Severity Disagreements

- **[Medium]** Moot given the disagreement above, but for the record: even if the finding held, the residue would be a one-clause plan-wording nicety (the consequence is already documented; behavior is unaffected), i.e. Nit-level, not Medium.

## Open Questions

- **Procedural (not a finding).** The reviewer's Context flagged that the plan was authored while the spec stood at round-1 recommendation `no`. That recommendation means "no further spec round is warranted," so plan authoring was in-sequence, not premature — no action.
- **Provenance (carried from the spec synthesis).** The product-design doc that motivated the gear / Update-key / Disconnect affordances remains uncommitted and deleted; the spec cites it for lineage only and stands on the verified backend contract. Open for the user only if they want a durable copy committed somewhere under `specs/` or `docs/`.
