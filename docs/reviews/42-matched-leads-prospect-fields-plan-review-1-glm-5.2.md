---
artifact: plans/42-matched-leads-prospect-fields.md
artifact_type: plan
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-25
round: 1
---

## Context

Reviewed against the worktree plan at `.claude/worktrees/matched-leads-prospect-fields/plans/42-matched-leads-prospect-fields.md`, the revised spec, and the round-1 spec synthesis. I spot-verified the plan's load-bearing assumptions against the code rather than trusting them: `backend/tests/unit/test_signal_lead_map.py` defines `_run` (L135) and `_fake_cache_mongo` (L123) as the plan's tests assume; `customers/contracts.ts` has `mapRawLead`/`CustomerLead`/`.passthrough()` as assumed; `customers/.../LeadStream.tsx` is a distinct `Name | Company | Source | Signals` table with `colSpan={4}` (L151) — confirming the synthesis's "separate Customers surface" open question. The plan commendably resolves all four spec-review findings in-spec (shared `resolveLeadFields` fixes name/company CSV blanks; colSpan literals enumerated; `level` alias dropped). The findings below are plan-level.

## Findings

### [High] Task 5 test and implementation contradict each other on the bare-lead format, and silently change the existing PDF relevance delimiter

**Location:** Task 5, Step 1 test vs Step 3 implementation; Step 4 note.

The current format (`signalBriefing.ts:42`, confirmed) is `${company} (Relevance: ${titleCase(relevance)})` — **parenthesized** relevance, e.g. `"Globex (Relevance: Low)"`.

- The Step 1 **test** asserts the bare lead still reads `"Globex (Relevance: Low)"` (parenthesized — i.e. unchanged).
- The Step 3 **implementation** builds `head = \`${subject} — Relevance: ${titleCase(lead.relevance)}\``, which for a bare lead yields `"Globex — Relevance: Low"` — **em-dash, no parens**.

These do not match, so the task's own failing-test→passing-test loop cannot go green as written: a worker following the plan literally hits a contradiction at Step 4. The deeper issue is that the rewrite changes the relevance delimiter from `(Relevance: X)` to ` — Relevance: X` for **every** lead (not just enriched ones), yet the Step 4 note claims "the format for prospect-less leads is unchanged except it still has no identity prefix." That claim is false — the relevance wrapping itself changed. Decide one delimiter and make test + implementation agree; if the intent is to preserve the existing parenthesized relevance, the enriched line should be something like `"Jane Doe — VP Engineering, CXO (Acme) (Relevance: High): fit"`, and the bare case stays `"Globex (Relevance: Low)"`. As written, an existing artefact/PDF format is altered without acknowledgement.

### [Medium] Task 5 edits one of two `keyFindings` builders and is silent on the other

**Location:** Task 5 (Files: `signalBriefing.ts`); cf. `signalBriefing.ts:87-90`.

`signalBriefing.ts` contains **two** `keyFindings = leads.map(...)` builders: `buildSignalBriefingArtefact` (L40, the one Task 5 edits) and `buildRecommendationPlaybookArtefact` (L87, Spec 41's GTM playbook), which renders the same `{company} (Relevance: …)` line. Task 5 rewrites only the first and never mentions the second. If the recommendation playbook is intentionally out of scope, say so explicitly (and accept that two artefacts will render leads differently — company-only vs prospect-enriched); if consistency is wanted, the second builder needs the same treatment. The silence leaves it to the worker to guess.

### [Medium] Tasks 8–9 (Customers LeadStream) fold in a surface the spec scoped out, resolving a synthesis open question without a recorded endorsement

**Location:** Task 8, Task 9, and Architecture line ("both Lead Stream tables").

The spec scoped the Customers `LeadStream` out as an optional follow-up, and the round-1 synthesis raised it as an **open question** explicitly requiring a user decision ("fold the Customers surface into this spec … or leave it as a follow-up?"). The plan unilaterally folds it in (Tasks 8–9) and adds two files + a VR baseline regen to scope. Folding in for consistency is the sensible MVP default, but the spec↔plan scope divergence on an explicitly-unresolved product decision should be confirmed as operator-endorsed before execution — otherwise the plan is implementing scope the spec deliberately deferred.

### [Low] No global abort/kill criteria (calibrated — plan is bound to a report-and-wait skill)

**Location:** Plan header ("REQUIRED SUB-SKILL: subagent-driven-development / executing-plans"); Final verification.

The plan is bound to a failure-stop skill (report-and-wait on failure), so the missing explicit kill criteria is Low by calibration. Note the plan does have one localized abort trigger — "if any [VR] diff shows unrelated drift, stop and investigate — do not blanket-update" (Final verification) — which is good. Consider adding one or two more global abort triggers up front (e.g., BE cache-hit-path enrichment can't be satisfied; `knip --strict` surfaces an unresolvable dead-code conflict from deleting the `pick*` helpers) so a worker knows when to stop rather than improvise.

### [Low] Parallelizability is unannotated despite the plan targeting subagent-driven execution

**Location:** Task ordering (1→9, presented serial).

The plan is a safe linear order, not accidentally serial, but it's all-serial in presentation. The dependency graph admits parallelism: Task 1 (backend) is fully independent of every FE task; after Task 2 lands (shared `resolveLeadFields` + widened `HeatmapLead`), the three FE chains — signals (3→4,5), market-research (2→6→7), customers (2→8→9) — are mutually independent. Since the plan explicitly targets `subagent-driven-development`, annotating these parallel groups would let independent tasks run concurrently. Optional, but it's a cheap win the current serial layout forgoes.

## Observations (no action)

- Sequencing/dependencies are correct: no step consumes an output produced only later. Task 2 precedes its consumers (6, 7, 8); Task 3 precedes 4 and 5; Task 8 precedes 9; BE (Task 1) is decoupled from FE by the backward-compatible optional contract.
- Risk front-loading is sound: the highest-uncertainty item (BE cache-hit-path enrichment) is Task 1 with a dedicated `test_build_map_enriches_on_cache_hit` regression guard, exactly as the spec synthesis flagged for re-confirmation. Verified `leads` is in scope on the hit path (fetched L218-219 before the cache check).
- Decomposition is clean: one concern per task, one commit per task, TDD (write-fail→implement→pass→commit) on every task. No overengineering — the shared `resolveLeadFields` is appropriate DRY across the two FE mappers (FE↔FE, not the FE↔BE boundary the "implement twice" rule governs).
- Per-step verification is strong: each task has a positive signal (new test passes) and most have a regression signal (Task 4 Step 5 runs the existing `SignalCard.cta` tests; Task 6 Step 4 runs existing `marketScoresHeatmap` tests; `knip --strict` in the gate catches the deleted `pick*` helpers). The cache-narrow assertion (`test_enrich_matched_leads_is_pure_does_not_mutate_input` + the cache-miss test inspecting `store["o1:u1"]`) correctly guards the "cache stays narrow" invariant.
- Hidden prerequisites are covered: the Prerequisites section symlinks `.venv` / `node_modules` and the BE tests are unit tests against `_fake_cache_mongo` (no live DB needed).
- The `_run` / `_fake_cache_mongo` helper signatures the Task 1 tests rely on exist as written (L135, L123).
