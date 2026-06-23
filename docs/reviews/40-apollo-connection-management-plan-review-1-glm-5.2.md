---
artifact: plans/40-apollo-connection-management.md
artifact_type: plan
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-22
round: 1
---

## Context

Procedural caveat: the plan header (line 5) states it pairs with a spec that was
"reviewed round 1, recommendation `no`" — i.e. the plan was written before the spec's
review was synthesized clean, which is outside the documented `/review-spec` →
`/synthesize-spec-review` (loop to clean) → plan-write flow. I therefore specifically
checked whether the spec review's actionable findings were carried into the plan:
three of four were (the `runId`/`prompt` clear on disconnect, the mode-aware toast on
the shared `onConnected`, and the `apiRequest`-over-raw-fetch transport choice are all
implemented here — good). The one carry-forward gap is filed as the Medium finding
below. Grounding for the plan's test-file edits and hidden prerequisites was verified
against `master` (see Observations); no factual mismatches were found in the wiring.

## Findings

### [Medium] Disconnect-during-running credit-spend consequence is declined but never recorded anywhere

**Location:** Global Constraints line 26 ("The disconnect dialog carries **no**
credit-spend sentence (declined, spec §9/§13)"); Task 4 implementation comment (lines
527-528); absence of any TD entry or plan note.

This responds to the spec review's Medium finding (the in-flight `_run_discover` holds
the old key in memory and **keeps spending the user's Apollo credits + ingesting leads
after disconnect**; `set_low_credit`/`set_status` are then silent no-ops on the deleted
credential doc). The plan's decision — no credit-spend copy in the dialog — is a
defensible MVP call, but it is *incomplete as a deferral*: the consequence is neither
surfaced to the user, recorded in `docs/TECH_DEBT.md` (the spec §14 explicitly reserved
a TD-FE slot for "best-effort disconnect-during-running" hardening), nor noted in the
plan body. A future reader sees "declined" with no trace of *what* was declined or why
it's acceptable. Note also the "(declined, spec §9/§13)" attribution is slightly off:
§9/§13 discuss best-effort runs but never *propose* a dialog sentence — that suggestion
came from the spec review, not the spec text.

Recommendation: add a one-line plan note (or a TD-FE entry per the spec §14 reservation)
recording the accepted consequence — "disconnect does not stop an in-flight discovery
run; it continues to consume Apollo credits and ingest leads until it completes" — so
the decision is traceable rather than silent.

### [Low] Disconnect failure path (`onError`) is implemented but untested

**Location:** Task 5 `onConfirmDisconnect` (lines 808-814, the `onError` toast
"Couldn't disconnect Apollo — please try again." with `variant: "destructive"`); Task 5
tests (lines 729-740 cover the success path only).

The destructive action's failure branch — toast fires, dialog closes, tile stays
connected — has no test. The success path is covered (the mock `mutate` invokes
`onSuccess`). Given this is the one genuinely fallible network call in the feature and
the failure UX is user-visible, add a single test mirroring the success test but with a
rejecting `mutate` invoking `onError`, asserting the destructive failure toast (and that
no "Apollo disconnected." toast fires).

### [Low] No explicit per-task / global kill-or-abort criteria; relies on the executing skill's report-and-wait

**Location:** Header line 3 (REQUIRED SUB-SKILL `executing-plans` /
`subagent-driven-development`); per-task gates (e.g. lines 179-191); Task 6 Step 5 merge
gate (line 974).

Under the default assumption (execution bound to a failure-stop skill), a missing
abort/kill/rollback spec is Low by calibration, and Task 6 Step 5 does state the merge
gate abort ("If preflight is red, report which check failed; do not merge"). What's
absent is any per-task "on a red gate, stop and report" line and any global abort
condition — e.g. the most plausible one for this plan: "if a live probe of
`DELETE /connectors/apollo/connect` shows the response shape or idempotency differs from
the assumed `{status, message}` / 200-on-0-match, stop." The DELETE contract is
currently asserted only via MSW mocks and is never probed live (the spec §3.3 caveat
deferred a live probe as "if a live check is wanted"). Stating that abort condition
upfront would make the one unverified assumption explicit. (The contract is in fact
correct and `response_model`-annotated — see Observations — so this is about making the
reliance explicit, not about a latent defect.)

### [Low] Tasks 1-4 are independent (disjoint files) and parallelizable, but the plan presents them strictly serially

**Location:** Task dependency structure — Task 1 (contracts.ts/services/apollo.ts +
hook), Task 2 (ApolloConnectModal.tsx), Task 3 (new ApolloManageMenu.tsx), Task 4 (new
DisconnectApolloDialog.tsx) touch no shared files; only Task 5 consumes all four.

Given the repo's `dispatching-parallel-agents` / `subagent-driven-development` usage,
Tasks 1-4 are safe to fan out concurrently (no shared state, no overlapping files), with
Task 5 as the join and Task 6 the tail. The plan gives no parallelization hint, so a
subagent driver will run all six serially by default. A one-line note ("Tasks 1-4 are
independent and may be parallelized; Task 5 depends on 1-4; Task 6 on 5") would let an
executor capture the speedup without re-deriving the dependency graph.

### [Nit] Task 1 is implementation-first, not red-green, unlike Tasks 2-4

**Location:** Task 1 Steps 1-5 (implement contract/service/hook in Steps 1-3, write the
test in Step 4, run in Step 5 "Expected: PASS (steps 1-3 already implement it)").

Tasks 2, 3, 4 follow strict TDD (write failing test → run expecting FAIL → implement →
run expecting PASS). Task 1 inverts this: implementation first, test expected to pass
immediately. It's a minor discipline inconsistency (and the data-layer wiring is trivial
enough that it's low-risk), but for consistency the test in Task 1 Step 4 could be moved
before Steps 1-3 and run expecting FAIL first, matching the other tasks.

### [Nit] Task 5 Step 1 mock-block edit is ambiguous between "replace" and "add"

**Location:** Task 5 Step 1 (lines 586-632) — "Add `disconnect` to the hoisted mocks and
mock the new hook + the modal. Extend the top of the file:" followed by a full
`const mocks = vi.hoisted(() => ({...}))` + full `vi.mock(...)` group including the two
new lines.

The existing `ApolloTile.test.tsx` already declares that `const mocks` block and those
`vi.mock` lines (verified: real file lines 5-25). The instruction text says "Add …
Extend" (additive) but the code block is the complete target state (replace-shaped). An
executor that pastes the block wholesale would duplicate the `const mocks` declaration
(redeclaration error) and re-register the `vi.mock` calls. State explicitly whether the
block is the replacement target ("replace the existing hoisted block and `vi.mock` group
with the following, adding only the `disconnect` mock value, the `useDisconnectApollo`
mock, and the `ApolloConnectModal` mock") so the edit is unambiguous for autonomous
execution.

## Observations (no action)

- **Test-file assumptions verified accurate.** The real
  `ApolloTile.test.tsx` hoisted-mocks block (lines 5-25) matches the plan's Task 5 edits
  (the only delta is the added `disconnect` key + two `vi.mock` lines), `renderTile()`
  wraps in `MemoryRouter`, and the two existing error tests coexist correctly with the
  planned branch: the credential-error test (real lines 146-158, `status.status==="error"`)
  is the one repointed to "Update API key", while the discovery-failure Retry test (real
  lines 201-223, `status.status==="connected"` + run `failed`) keeps its "Retry" button
  because the planned `status?.status === "error"` branch is false there.
- **Hidden prerequisites all present.** Verified: `@/test/msw/server.ts`,
  `@/test/setup.ts`, `@/components/ui/dropdown-menu.tsx`, `@/components/ui/alert-dialog.tsx`,
  `@/components/ui/use-toast` (already mocked in the existing tile test), `lucide-react`
  (^0.462.0, `Settings` icon), and the `verify` (`typecheck && lint && test:changed`),
  `typecheck`, and `preflight` scripts in `frontend/package.json`; `qk.apolloStatus`
  exists.
- **DELETE contract is sound.** The `{status, message}` shape and idempotent 200-on-0-match
  the MSW mocks encode match the backend (`DisconnectResponse{status:str,message:str}`,
  `disconnect_apollo` → `delete_credentials` returns `bool(deleted_count)` with no raise;
  `DELETE /connectors/apollo/connect` carries `response_model=DisconnectResponse`, unlike
  the un-annotated endpoints AGENTS.md warns about). No change needed — flagged only as
  reliance to make explicit (Low finding above).
- **Sequencing is correct.** Task 5 (the integration) consumes Tasks 1-4 and is correctly
  last; no step depends on a later step's output. Risk front-loading is reasonable
  (data layer + low-risk presentational components first, the largest/riskiest tile change
  last).
- **Decomposition is clean.** One concern + one commit per task; no scope creep vs. the
  spec. The mode-aware toast (Task 5 `onConnected` reads `modal==="update"`) and the
  `runId`/`prompt` clear (Task 5 `onConfirmDisconnect`) correctly resolve the spec
  review's two Low wiring findings.
- **Self-Review (line 980) maps spec coverage**, though the AC1-AC6 labels it claims
  coverage of are defined inline in the Self-Review rather than stated upfront — minor,
  acceptable.
