---
synthesizes_review: docs/reviews/31-frontend-phase-11-shared-utility-extraction-plan-review-1.md
artifact: plans/31-frontend-phase-11-shared-utility-extraction.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 1
---

## Round Recommendation

no

Reason: The two High findings are execution-discipline gaps (abort/recovery protocol) — real, but cheap and applied this round, and bounded by the subagent-driven harness (so Medium, not High). Everything else is sequencing notes, a task split, and wording. The substantive disagreements (the parallelization DAG, the stale-SHA nit, the self-admittedly-safe sed) are declined with verified reasoning. No Critical/High remains and the revisions open no new design surface.

## Agreed Findings

- **High F1 (no abort/kill criteria) + High F2 (no gate-failure recovery).** Added a **Failure protocol** bullet to the Conventions: a gate failure is never committed and never skipped; fix within the task and re-run, else stop and report to the operator with the failing output — no out-of-scope improvisation, no proceeding. (Severity downgrade noted below.)
- **Medium F3 (Task 19 too large to review).** Split into **Task 19a** (score libs + the 4 lead-stream components, atomic) and **Task 19b** (`EditDropdownMenu` → customers + residue-dir removal). Verified by grep that `EditDropdownMenu` imports only `lucide-react`/`react`/`@/components/ui/*` — zero cluster dependency — so the split creates no intermediate broken state.
- **Medium F4 (no execution-ordering guidance) — agreed in part.** Added a Conventions bullet: tasks within a stage run **sequentially**, with the empirical reason (shared consumer files) and a note that the subagent-driven harness already serializes one-task-at-a-time with review between. (The reviewer's specific "these groups are parallelizable" claim is rejected — see Disagreed.)
- **Medium F5 (Task 21 → Task 20 ordering).** Added a "**Runs after Task 20**" note to Task 21 explaining the scratch-file recreate/delete depends on Task 20's prior `src/lib/` removal and must not overlap its emptiness check.
- **Low F6 (spec §3 lists `use-toast` under `shared/hooks/`).** Added refinement #7 documenting the spec-internal inconsistency (§5.1 is authoritative; the plan follows it) and a Task 23 step to log it as a Spec erratum delta at merge (frozen-record convention — no spec rewrite).
- **Low F7 (Task 13 transient state).** Added an explicit "**intentional intermediate state** (per spec §6)" note to Task 13 — a legacy-dir file importing only from `shared/` is expected until Task 19a relocates it.
- **Low F8 (verify/preflight prerequisite) + Low F15 (knip baseline).** Added **Stage 0 — before you start**: confirm `npm run verify` is green on the untouched branch (else stop and report), record the `npm run knip` baseline, and confirm the scripts exist. Task 24 Step 3 now compares against the Stage 0 baseline to distinguish pre-existing from new dead code.
- **Nit F9 (Task 6 Step 4 future tense).** Reworded to "**will be repointed** to `@/components/ui/use-mobile` in Task 16."
- **Nit F10 (Task 20 scoped `git add -A`).** Removed entirely — the legacy *file* deletions were already committed by their relocating tasks and git does not track empty dirs, so Task 20 Step 2 is now a clean-`git status` confirmation with no `git add`. The Conventions wording tightened to "never `git add -A` at the repo root."
- **Medium F13 (Task 21 fallback config bloat).** Added the reviewer's suggested clarification: **no commit until the working zone form passes lint** — a failed array form is reverted in place and the single-string-pair fallback tried *before* any commit, so a failed attempt never pollutes history. (Severity downgrade noted below.)
- **Low F14 (ContextChat double-touch).** Accurate observation, no revision: `ContextChat.tsx` is correctly modified in Task 3 (`sanitizeAnswerText`) and again in Task 15 (`use-toast`); sequential execution (now explicit per F4) handles it with no conflict.

## Disagreed Findings

- **Medium F4 — the parallelization DAG is unsafe and factually wrong.** The review states "11a Tasks 1–4 and 5–7 are mutually independent" and "11c Tasks 14–16 are independent." Live grep disproves the premise: `features/market-research/hooks/useMarketResearchData.ts` is edited by **Task 2** (cacheUtils) *and* **Task 5** (timestampUtils/apiUtils); `features/market-research/pages/MarketResearchPage.tsx` by **Task 1** (usePageTitle) *and* **Task 5** (leadStreamChatContext). Parallel dispatch of those "independent" groups would produce concurrent edits to the same file. The actionable half of the finding (add ordering guidance) is agreed and applied; the parallel-dispatch recommendation itself is rejected as incorrect for this plan.
- **Nit F11 (commit SHAs could go stale).** Declined. `182cb8e` (base) and `6e5a428` (spec) are intentional provenance anchors: they record the exact tree state the authoritative consumer trace was run against, which is what makes §1.3's counts auditable. The plan is a frozen record of intent (AGENTS.md); if the branch is rebased the SHAs remain a correct historical reference. Removing them would lose audit value for no gain.
- **Medium F12 (Task 14 sed could match `utils.ts`).** Declined on action. The reviewer concedes "the current plan is safe" — the newly-created `components/ui/utils.ts` contains only `clsx`/`tailwind-merge` imports, never `@/lib/utils`, so `grep -rl '@/lib/utils'` cannot match it. Adding a guard against a hypothetical future template error is YAGNI; the step is correct as written. Severity belongs at Nit, not Medium (see below).

## Deferred Findings

None. Every finding was in-scope and low-cost; each was applied or declined this round.

## Severity Disagreements

- **F1 / F2 — agree finding, lean Medium (reviewer: High).** The recommended execution skill (`subagent-driven-development`) already serializes tasks with a two-stage human review between each, which bounds the "loop on a broken gate / silently skip" failure mode the High rating is premised on. The gap is real for the inline-execution path, so it was fixed — but it is not High-severity given the supervised harness.
- **F5 — agree finding, lean Low (reviewer: Medium).** The recreate/delete collision only materializes under *parallel* execution of Tasks 20 and 21, which the plan now explicitly forbids. Under the mandated sequential model the ordering is automatic; the added note is belt-and-suspenders.
- **F12 — agree (latent) observation, severity Nit (reviewer: Medium).** Self-admittedly safe as written; no behavior change.
- **F13 — agree finding, lean Low (reviewer: Medium).** A clarity/history-hygiene improvement, not a correctness defect — the rule still ends up correct either way.

## Open Questions

- **`import-x/no-restricted-paths` array `target`/`from` support is unverified at plan-write time.** The rule cannot be exercised without editing `eslint.config.js`, so the plan asserts array support with a documented in-place single-string-pair fallback and a no-commit-until-green guard (Task 21). The execution agent confirms which form loads at the Task 21 gate. This is the one place the plan relies on a config behavior it could not pre-run; the fallback makes either outcome safe.
