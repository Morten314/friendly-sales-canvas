---
artifact: plans/41-recommendation-artefact.md
artifact_type: plan
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-23
round: 1
---

## Context

- Reviewed against the worktree HEAD `52ef6cb` (`worktree-recommendation-artefact`), which carries two merged fix branches on top of the plan/spec. ~35 code anchors the plan cites were spot-checked against the actual source — imports, Pydantic symbols, the `_claude_budget` exports, the `signal_ask_claude` mechanics the Task 3 service mirrors, the zod/`ArtefactItem`/`SignalLeadMapLead` contracts, every SignalCard/SignalsPage line ref, the hook/service/barrel paths, and the referenced test files. **All verified accurate** as of this HEAD (the merged fix branches did not drift the cited lines).
- The plan is unusually disciplined for this repo: backend-first ordering with a live-verify gate (Task 5) before the FE consumer, report-and-wait failure-stop explicitly invoked, one-commit-per-task on the feature branch, and a no-regression step for the shared PDF generator. Most of the checklist (sequencing, decomposition, recovery, kill-criteria under the failure-stop net, prerequisites) is satisfied — see Observations. The findings below are the residual gaps.

## Findings

### [Medium] Error path is toast-only; spec §6.3/§8.4/§10 and the plan's own acceptance criterion #6 require an inline-below-row error message

**Location:** Task 10, Step 4 handler `catch` block (~plan lines 1611–1617); conflicts with spec §6.3 step 5, §8.4 step 8, §10 (row 1), and plan §1696 acceptance criterion #6.

The handler's `catch` only fires a destructive toast (`console.error` + `toast({ variant: "destructive", … "Could not generate artifact — please try again." })`). The spec requires **both** an inline-below-row message **and** a toast on backend failure ("inline below row: '…' + error toast; button reverts to active", §10), and the plan restates this as acceptance criterion #6 ("yields the inline error + a re-enabled button"). The "re-enabled button" half **is** satisfied (`finally` clears `recommendationArtefactGenerating`), and "no hollow artefact from a missing answer" **is** satisfied (D-2 gate + handler re-check). The missing piece is narrowly the **inline-below-row error message**.

Root cause is architectural: Task 9 makes the card's `onSaveRecommendationAsArtefact(index)` a fire-and-forget `void` callback and keeps loading state page-owned (D-4). The card's existing `artefactHint`/`showArtefactHint` mechanism (Task 9 Step 4) already renders inline messages below the row — but it is card-local and the page has no channel to set it on failure. So on a backend error the card reverts to active (key cleared) with no indication that the generation failed; only the toast tells the user. The plan neither implements the inline error nor flags the divergence.

Mitigations that keep this out of High: the toast **does** notify the user and `finally` **does** revert the button, so it is not a silent failure — it is a spec-fidelity gap with a working (if non-spec) substitute, and at MVP/0-users the real-world cost is low.

**Recommendation — pick one and reconcile:**
- Implement the inline error by adding a page-owned `recommendationArtefactErrorKey: string | null` prop mirroring `recommendationArtefactGeneratingKey`; the card shows the inline message (reusing `artefactHint`) when the key matches, and clears it on the next interaction/expand. This fits the existing D-4 pattern with no new awaitable contract. Add a Task 9/10 test case for it (the §10 error row is otherwise untested).
- Or explicitly relax spec §6.3 step 5 / §10 / acceptance criterion #6 to "error toast" and drop the inline requirement, recording why. The plan must not leave criterion #6 claiming an inline error the code does not deliver.

### [Nit] Task 7 Step 3 creates a duplicate import from `../contracts`

**Location:** Task 7, Step 3 — the shown `import type { RecommendationArtefactResponse } from "../contracts";`.

`signalBriefing.ts:4` already imports `SignalLeadMapLead` from `"../contracts"`. The plan's instruction to add a second `import type { RecommendationArtefactResponse } from "../contracts";` line produces a duplicate import from the same module. This is valid TypeScript and is **not** lint-gated here (`eslint.config.js` has no `no-duplicate-imports` rule — verified), so it will not fail preflight; it is purely cosmetic. The executor should extend the existing line-4 import (`import type { RecommendationArtefactResponse, SignalLeadMapLead } from "../contracts";`) rather than add a sibling line. (The companion instruction to extend the `../types` import on line 5 is correct as written.)

## Observations (no action)

- **Two same-named "Save as Artifact" buttons** (spec §6.1): confirmed safe in the plan's tests — Task 9's `withRec` config does not expand leads (`isLeadsExpanded: false`, `matchedLeads: []`), so only the recommendation button renders; the existing leads-section tests use `expandedRecommendationIndex: null` + `NBAs: []`, so only the signal-level button renders. No `getByRole` ambiguity in any single render. Latent rot only: `SignalCard.cta.test.tsx:162` (`queryByRole({ name: /Save as Artefact/i })`) will pass vacuously post-relabel (no such British-spelled button exists); Task 9 Step 8 correctly calls out updating the `:173` `getByRole` assertion, and `:162` will keep passing for the wrong reason — harmless.
- **Task 5 live-verify fallback** (no local boot / no Claude key) correctly grounds the Task 6 FE contract: Step 1 verifies the OpenAPI property keys (the contract the zod schema is written against) when the app boots, and falls back to source-confirming `RecommendationArtefactResponse` only if the lifespan can't boot. The populated five-field *values* are deferred to post-deploy, which is fine — the FE consumer depends on the keys/casing, not the values.
- **Risk front-loading** is reasonable: the genuinely uncertain step (Task 5 live verify) precedes the FE consumer, and the PDF rewrite (Task 8, the highest regression risk to *shipped* features) carries an explicit no-regression step (Step 5) running both live consumers. jsPDF is asserted to run under jsdom; if it doesn't, the failure surfaces in Task 8 Step 3 (report-and-wait), before any playbook code depends on it.
- **Parallelizability:** serial by design (single report-and-wait agent, one feature branch, one `--no-ff` merge). Tasks 8 (PDF) and 11 (tech-debt) are off the dependency spine (1→2→3→4→5→6→7→9→10) and could run concurrently with the backend under a multi-agent model, but the single-branch/atomic-merge pattern makes serial appropriate here.
- **Recovery / kill-criteria:** the report-and-wait failure-stop net is explicitly invoked (Global Constraints, "Failure handling"), and the merge gate states "Report any red check to the user; they decide fix-vs-abort." Per the bound-to-`subagent-driven-development`/`executing-plans` calibration, the absence of a standalone abort section is acceptable — the net is present and not removed.
- **Regression coverage** is strong where it matters: Task 8 runs both PDF consumers, Task 9 runs the sibling SignalCard suites (after adding the new required-prop defaults), Task 10 runs the existing `SignalsPage.cta` suite. Minor: Task 4's per-task run is the new test + loader only (no broader signals suite), but the import-smoke catches router breakage and the merge gate runs the full `tests/unit`.
- **No scope creep / overengineering:** jsPDF rewrite is explicitly spec'd (§8.5, R-1 RESOLVED→in scope); Unicode-font embedding and auth hardening are correctly deferred (partial TD-FE-78). Reuse of `_claude_budget`, `enqueueArtefact`, `generateAndDownloadPDF`, `resolveSignalAgentPresentation`, and the prompt loader is maximal — no duplication of existing infrastructure. Spec §9 `whatToDo`→`what_to_do` casing correction (Task 7) and the prompt-name convention change (Task 2) are correctly flagged inline refinements.
