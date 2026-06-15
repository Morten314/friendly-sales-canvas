---
synthesizes_review: docs/reviews/37-tech-debt-paydown-plan-review-1.md
artifact: plans/37-tech-debt-paydown.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-15
round: 1
---

## Round Recommendation

no

Reason: All 10 findings (1 Medium→downgraded Low, 4 Low, 1 Low/Nit, 4 Nit) were verified, agreed, and applied to the plan in this turn; nothing Critical/High, and the revisions add no new design surface — the plan is execution-ready.

## Agreed Findings

Each entry below was verified against the artifact (and, where the finding made a code-reality claim, against the live tree) before agreeing; the revision was applied to `plans/37-tech-debt-paydown.md` this turn.

1. **[Medium] Batch-level kill criterion** — Added an "Abort / escalation triggers" bullet: if **≥3 entries** re-scope / split to a follow-on spec / defer, halt and escalate the **whole phase** to the human rather than trimming entry-by-entry, and treat the *first* escalation as the human's explicit continue-vs-trim-vs-abort decision point. (Severity disagreement noted below.)
2. **[Low] Cross-wave stale line numbers** — Added a Conventions bullet ("line numbers are authoring-time anchors; re-grep the quoted string") naming the multi-wave files (`RegulatoryComplianceSection.tsx` across Tasks 3/6/19; `pagination.ts` across Tasks 17/18), plus a targeted "Stale line numbers (cross-wave)" caveat in Task 19 noting `line 585` (`profileUrl`) has shifted up while `line 15` (the import) is stable.
3. **[Low] TD-FE-72 dormant control with no UX** — Added an explicit note to Task 16 Step 5 that no `disabled`/loading/error UX is added **by deliberate choice** (endpoint undeployed per TD-FE-73, 0 users, graceful-degradation chrome on a dormant control is YAGNI), with the hardening recorded as the TD-FE-73 pull-forward trigger.
4. **[Low] Task 12 bundles two register entries** — Added a "Deliberate tradeoff" clause making explicit that TD-FE-61 (rename) + TD-FE-50 (handoff-typing) ship as one reviewable commit because splitting would leave a red intermediate (a half-applied rename breaks typecheck); per-entry reviewability is traded for green-at-every-commit, accepted not incidental.
5. **[Low] Branch-dependent (non-deterministic) test authoring** — Pinned Task 17's data-sources decision to `fetchDataSources → { items, total }` + `useDataSources` `select: (env) => env.items`, and rewrote the Task 17 Step 1 assertion unconditionally (`Array.isArray(res.items)` + `typeof res.total === "number"`, fails today) with a one-line existing-assertion migration note; reframed Task 5 Step 2 from "verify it fails" to an explicit **regression guard** (green expected, not a TDD violation — the behavioral lock is the Step 3 typecheck change to `JSX.Element | null`).
6. **[Nit] Broken identifier in Task 8** — Fixed `const dataSources Ref` → `const dataSourcesRef` and removed the self-flagging "(write as one identifier — no space)" parenthetical; the snippet is now copy-paste-safe.
7. **[Nit] Deliberately-unused import in Task 13** — Removed the `import { renderHook }` line from the test snippet and dropped the "drop this line" parenthetical; the snippet as written is now lint-clean.
8. **[Nit] Commit-SHA placeholders in Task 24** — Added a one-line note that `<sha>`/`<DATE>` are execution-time fills (resolving commit's short SHA + phase merge date), so an executor doesn't stall on the placeholders.
9. **[Low/Nit] Inconsistent `_json` dead-code triage** — Verified against the live file: both `regulatory-compliance_*_json` write pairs (unscoped `:488-489`, scoped `:547-557`) are readerless. Expanded Task 3 Step 2 to delete **both** pairs **and** their now-dead feeder objects (`originalData`/`modifiedData`, `originalJson`/`modifiedJson`) — which also fixes a latent unused-var/typecheck failure that the original "delete only 487-489" would have introduced. Updated ledger #4, the Task 3 intro, the Step 3 grep (now also matches `_json`), and the commit subject to match.
10. **[Nit] Backend-wave independence unnoted** — Added a note under the Wave 2 heading that it shares zero files with the FE waves and can be authored/verified independently (e.g. a backend-focused subagent in parallel), gated only by `backend/tests/` pytest; ordering is free under the single branch.

## Disagreed Findings

None. Every finding held on verification. Finding 9 (the only one making a code-reality claim — "the scoped `_json` writes are equally readerless and left in place") was cross-checked against `RegulatoryComplianceSection.tsx` and the `src`-wide grep: the second write pair (`:547-557`) and the zero-reader claim are both correct, and acting on it surfaced a latent defect in the original task. Agreeing with all 10 reflects a disciplined plan receiving disciplined, accurate feedback — not capitulation.

## Deferred Findings

None. All findings were in scope and cheap to address now; none were premature, blocked on upstream questions, or better handled at a later stage.

## Severity Disagreements

- **Finding 1 (batch-level kill criterion): agree with the finding, disagree with severity — Low, not Medium.** The per-item triggers already instruct "escalate to the human (don't push through)," so the batch-abort decision was effectively delegated to the human at the first escalation; the real gap was that it was *implicit*, not that the human was out of the loop. That makes it a robustness/clarity improvement rather than a Medium-impact hole. Applied regardless, so the distinction is operationally moot.
- **Finding 9 (`_json` triage): agree with the finding, lean Low over the "Low/Nit" tag.** Acting on it removed not just a consistency wart but a latent unused-var (typecheck/lint) failure the original Step 2 would have produced — slightly more than cosmetic. Not worth re-litigating; flagged for completeness.

## Open Questions

None that block execution or stem from review gaps. The plan's pre-existing verify-first items remain (unchanged by this round): Wave-0 Probe 1 (Compliance `chartType` live shape) and Probe 2 (ICP row keys); the TD-005 execution-time re-grep; the TD-FE-40 syncing-overlay presence check; and the exact e2e assertion text in Tasks 21/22. One item was made more concrete this round: Task 17's `fetchDataSources(<existing args>)` call and any existing array-assertion in `missionControl.test.ts` must be read off the file at execution (now pinned to the `{ items, total }` shape).
