---
synthesizes_review: docs/reviews/24i-frontend-phase-5i-finalize-plan-review-1.md
artifact: plans/24i-frontend-phase-5i-finalize.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-02
round: 1
---

> Note: the review file `docs/reviews/24i-frontend-phase-5i-finalize-plan-review-1.md` has no YAML frontmatter (no `verdict` field). Proceeded without frontmatter type-checking, per the synthesize command's malformed-frontmatter fallback. Findings 1–3 make concrete claims about live repo state, so they were verified against the working tree before categorizing.

## Round Recommendation

no

Reason: The only Critical (finding 1) is an accurate informational execution-blocker (5h unmerged), not a plan defect; findings 2–5 are agreed factual/clarity fixes that open no new design surface. Apply the revisions and exit the loop.

## Agreed Findings

- **[Critical] Finding 1 — prerequisite not met (5h unmerged).** Agree it is accurate — **no plan revision.** Verified against the working tree: `components/intelligence/market-size/` is missing, `MarketSizeSection.tsx` is still a 1,660-LOC monolith at the feature root, and `MarketIntelligenceTabProps.ts` still exists with live importers (`IntelligenceTab.tsx`, `MarketIntelligenceSections.tsx`, `sanitizeIntelligenceProps.ts`, plus `industry-trends/types.ts`). This is exactly the state the plan's Task 0 Step 2 + abort criteria 1/3 are written to catch and STOP on — the plan is already correct. The finding is a gate on *when 5i may start*, not a defect to fix. Recorded as the live blocker in Open Questions.
- **[High] Finding 2 — example handoff table is incomplete + lists a dead file as a leaver.** Agree. Verified against the live `README.md` handoff table and importer traces: the authoritative set is six leaver rows — `StrategistWorkspace`→strategist; `lead-stream/*`→customers(7); `EditDropdownMenu`→customers(7) (sole importer `customers/SuggestedICPCards`); `ScoutChatPanel`+`ChatWithScout`→scout; the `Scout*` config cluster (`ScoutSettingsForm`,`ScoutDeploymentDetails`,`ScoutLeadStream`)→scout; `AddLeadModal`+`SuggestedCompaniesSection`→scout (both sole-imported by `signals/ScoutChatWithHistory`). `ScoutCapabilities` is DEAD-annotated (confirmed) and must not appear as a leaver. **Revision to make (Task 2 Step 2):** replace the 4-row example with these 6 rows; remove `ScoutCapabilities`; keep the "Write the table to match the live dir" instruction as the backstop.
- **[Medium] Finding 3 — Task 3 sweep never deletes the 8 dead legacy files.** Agree — real gap. Verified: `src/components/market-research/` carries exactly the 8 `// DEAD CODE → delete in 5i` files named in the finding. Task 3's three triage bullets cover in-feature leftovers, leaving components (do-not-delete), and `index.ts` exports — none deletes the annotated legacy dead files, yet spec §7 done-when requires "zero `// DEAD CODE` annotations remain." A literal reading of bullet 2 ("leaving component in legacy dir → do not delete") could even cause an implementer to spare them. **Revision to make (Task 3 Step 2):** add a fourth triage bullet — files in `src/components/market-research/` carrying `// DEAD CODE` (zero live importers, no target feature per §7) → delete; re-run knip.
- **[Low] Finding 4 — `index.ts` draft comment has an ambiguous completion signal.** Agree. The "Add the report/result type signals actually consumes once Phase 8's need is known" comment can read as "index.ts intentionally incomplete," which rubs against the §7 / Task 4 DoD-item-1 "index.ts complete" claim. **Revision to make (Task 1 Step 3):** make the disposition explicit — `index.ts` exports only what exists now; if a genuinely-anticipated-but-unconsumed export must stay, it is the TD-FE path of Step 4, not an open TODO left in the file. State which is committed.
- **[Low] Finding 5 — Task 0 `fetch(` STOP grep is mis-placed / false-positive-prone.** Agree on the placement defect. Spec §11 puts the zero-raw-`fetch` confirmation at *phase close* (Task 4 Step 3 DoD item 3), not the Task 0 completeness audit. **Revision to make:** relocate the hard zero-raw-`fetch` STOP gate to Task 4 Step 3; if a Task 0 mention is kept, make it informational, not a STOP. Prefer relocation over the review's alternative of blanket-excluding `useMarketResearchData.ts` from the grep — a blanket exclusion would mask a genuinely-remaining raw-`fetch` slice (see Open Questions on the 5h deferral path).

## Disagreed Findings

(None. All five findings hold against the artifact and the verified repo state.)

## Deferred Findings

(None.)

## Severity Disagreements

- **Finding 2 (High).** Agree with the finding; severity is arguably **Medium**, not High. Task 2 Step 2 already instructs "Write the table to match the live dir" and provides the `ls -R src/components/market-research` + `grep -rL 'HANDOFF →'` discovery commands as a backstop, so a careful implementer self-corrects the example. The defect is a misleading *template*, not an unrecoverable instruction. The fix is identical either way, so this does not change the action — recording the severity view per discipline rather than silently downgrading.

## Open Questions

- **Execution is blocked on 5h merging (finding 1).** 5i cannot begin until 5h lands on `master`. This is the live state, handled by the plan's own abort criteria — it is not resolved by any plan revision and not a reason to re-review the plan.
- **5h-deferral interaction with finding 5.** 5h's plan permits a *documented deferral* of its `useMarketResearchData()` market-size slice removal to 5i (the abort-criterion-3 fallback in 24h Task 4). If 5h exercises that, a raw-`fetch`/cache slice survives into 5i and plan 24i currently has **no task** to remove it — the relocated Task 4 zero-`fetch` gate would then correctly fail with no remediation step. The orchestrator should confirm 5h removed (not deferred) its slice; if deferred, 24i needs an added removal step before the phase-close gate. Out of scope for these five findings but adjacent to finding 5's fix.
- **Systemic 5d–5g slice removals (carried from 24h R1 synthesis).** Whether 5d–5g actually removed their `useMarketResearchData()` slices remains a master-plan-level open item; if any did not, 24i's zero-`fetch` gate inherits multiple un-removed slices. Still a live orchestrator question, unchanged this round.
