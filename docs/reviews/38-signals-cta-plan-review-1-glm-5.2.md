---
artifact: plans/38-signals-cta.md
artifact_type: plan
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-19
round: 1
---

## Context

Round 1 plan review. The plan is unusually thorough — 9 single-concern tasks,
red-green TDD per task, explicit regression runs, and a self-review that
reconciles it against the (revised) spec section-by-section. I grounded its
concrete claims against current source: the three "Replace … with:" test edits,
the Task 6 appended-test harness, the TD-FE number ceiling, and the pre-existing
SignalCard tests. All check out. The findings below are a lean set of residual
items; the bulk of the checklist passes cleanly (see Observations).

## Findings

### [Low] Plan keeps TD-FE-73 open while the spec says "mark resolved" — the two disagree

**Location:** Plan Task 8 ("TD-FE-73 stays **open**", line 1291) and Task 9
(narrow + keep open, lines 1420/1437) vs the spec's Dependencies line
(`specs/38-signals-cta-design.md:214`, "mark TD-FE-73 `resolved` … once
reconciled").

The plan deliberately keeps TD-FE-73 **open** and narrows its remaining action
(re-capture a populated response when an org has leads) — which is the correct
call (it matches the round-3 spec-review recommendation; marking it resolved on
an empty-map capture + code-grounding would be premature). But the spec's
Dependencies paragraph still instructs "mark `resolved`," so the plan and its
spec disagree on the TD's end state. The plan's Self-Review (line 1544) records
the plan's choice without flagging the contradiction. Reconcile by updating the
spec's line 214 to "keep TD-FE-73 open; narrow remaining action to a populated
re-capture" so the two artifacts agree (the plan's behaviour is the one to keep).

### [Low] Task 7 un-accept test clicks a positional button — fragile and can false-green

**Location:** Task 7 Step 1 test, line 1183
(`fireEvent.click(within(card).getAllByRole("button")[0])`) and the
acknowledgement comment at lines 1122–1124. Cross-ref: `SignalCard.tsx:90-128`
— the header accept/reject/bot buttons are icon-only (`ThumbsUp`/`ThumbsDown`/
`Bot`) with no `aria-label`, so there is no accessible-name selector.

The un-accept test drives the accept toggle positionally (first button), relying
on the header invariant `[accept, reject, bot]`. That invariant is undocumented,
and the test can false-green if the order shifts: clicking the reject button
instead would call `handleRejectSignal`, which *removes the card* — `Acme` then
disappears, so the `queryByText("Acme")` assertion passes for the wrong reason
(rejection, not un-accept collapse). Prefer adding `aria-label`s to the three
icon-only header buttons (a small change that also closes a pre-existing a11y
gap) and selecting by name, or otherwise pin the assumption explicitly.

### [Nit] `contracts.test.ts` replacement drops the "entry without `leads` → `[]`" assertion

**Location:** Task 8 Step 1 replacement (lines 1303–1360) vs the existing
`contracts.test.ts:6-22`, whose "parses a representative payload and defaults
missing fields" case asserts `parsed.data.mapping[1].leads` (an entry with no
`leads` key) defaults to `[]`.

The replacement's three cases cover the golden shape, the empty envelope, and
the per-lead degrade-never-throw guards — but none re-asserts the entry-level
`leads: z.array(...).default([])` path. The `.default([])` is still in the
tightened schema (Task 8 Step 3, line 1388), so behaviour is preserved; only the
regression assertion is lost. Consider keeping that one assertion in the
rewritten file.

## Observations (no action)

- **Sequencing is correct.** No backward dependencies: the queue/barrel (Task 1)
  precedes the drain (Task 2, needs `drainArtefactQueue`) and the builder
  (Task 4, needs the barrel-re-exported `ArtefactItem`); Task 7 (integration)
  correctly consumes the outputs of Tasks 1/3/4/5/6; Task 8 (contract) and
  Task 9 (TDs) are leaf work.
- **Risk is front-loaded.** The delivery queue + drain (Tasks 1–2) — the
  round-1 spec Critical — is built and regression-tested first; the lower-risk
  contract tightening (Task 8) sits later but is guarded by a downstream
  consumer-test run (Step 4).
- **The three "Replace … with:" test edits are non-destructive** (verified
  against current files): `ArtifactsPage.test.tsx` (17 lines, single "mounts +
  sets title" test) and `artefactPdf.test.ts` (12 lines, single "non-trivial
  PDF" test) are reproduced verbatim in the plan's replacements;
  `contracts.test.ts` coverage is equivalently reorganised (the only dropped
  assertion is the Nit above).
- **Task 6's appended test harness exists** in the current
  `useSignalLeadMap.test.tsx` (`server`, `http`/`HttpResponse`, `RESPONSE`,
  `wrapper`, `act`/`waitFor`/`renderHook` all present), and the `fetchQuery`
  rewrite correctly drives the shared query's error state (loading → resolved)
  rather than the old silent `setQueryData`.
- **TD-FE number ceiling is accurate.** `grep` confirms max `TD-FE-76`, so the
  plan's "use 77 and 78" is correct, and Task 9 instructs the executor to
  re-confirm the ceiling before writing — good hygiene.
- **Per-task regression discipline is strong.** Task 5 Step 7 explicitly runs
  the pre-existing `SignalCard.test.tsx`/`SignalCard.affects.test.tsx` and fixes
  the new-required-prop breakage; Task 8 Step 4 runs the hook + service tests.
- **Report-and-wait safety net is present** (header line 3 mandates
  `executing-plans`/`subagent-driven-development`), and the merge gate has an
  explicit "report which check failed; user decides fix vs. abort" path — so the
  absence of bespoke per-task kill criteria is acceptable under the default.
- **The plan correctly incorporates the round-3 spec-review resolutions**
  (keeps TD-FE-73 open, models the top-level `status`, adds the once-only-drain
  and recompute-exits-error tests) — it is better than a naive reading of the
  spec in those spots.
- **No overengineering.** Nine tasks, each a single spec-mapped concern with its
  own red-green cycle and commit; serial ordering is deliberate for the
  single-agent TDD flow (Tasks 3/5/6/8 are independent and *could* parallelise,
  but serial is appropriate, not accidental).
