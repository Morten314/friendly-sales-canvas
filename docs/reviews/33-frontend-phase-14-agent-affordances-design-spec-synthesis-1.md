---
synthesizes_review: docs/reviews/33-frontend-phase-14-agent-affordances-design-spec-review-1.md
artifact: specs/33-frontend-phase-14-agent-affordances-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-08
round: 1
---

## Round Recommendation

no

Reason: Both High findings are agreed and resolved by mechanical spec-tightenings that open no new design surface; remaining items are Low/Nit, one disagreed (explicitly non-actionable), one deferred to plan-writing. No Critical/High remains.

## Agreed Findings

- **[High] W1 done-when not measurable** — Revised §3 W1 "Done when" to require a **classification ledger** (baseline hit count, per-bucket counts for forward-promise-fixed / provenance-rephrased / kept, and residual kept-count with per-item rationale), and added a `(§2.1 blast-radius paths)` pointer to the enumeration step. "Done" is now auditable, not reviewer-judgment-only.
- **[High] W4 archive-split has no rule for partially-resolved entries** — Added an explicit **triage rule** to §3 W4: an entry moves only if its *entire* scope is resolved with no open sub-clause/follow-on/pull-forward trigger; superseded-by-different-approach entries stay in the main file; the plan records a per-entry disposition for every borderline case.
- **[Medium] §4 W3↔W5 coordination underspecified** — Reframed §4 "Dependencies": W3 (README naming map) and W5 (scaffolder `NAMING_MAP`) both reconcile to the **same ground truth — the 14 actual feature folders** — so neither hard-blocks the other; the requirement is only that both maps end consistent. (Also corrects the reviewer's "W3 fails if it runs before W5" framing — W3 verifies against the folders, not the scaffolder.)
- **[Medium] W6 item 1 cites a "§3.1" not in this spec** — Changed to **"Spec 14 §3.1 join-point resolution, recorded in the Phase 9 outcome annotation"** to disambiguate the source document.
- **[Medium] W7 wording is plan-material; spec should state semantic requirements** — Converted W7 to an explicit 5-item **"the replacement text must convey" checklist** (master is trunk; `phase-N-*` branch naming; `--no-ff` + green `preflight` merge; cutover complete; dormant-legacy retention + horizon). Exact prose still drafted in the plan.
- **[Medium] §6 defers gaps to TD-FE without naming expected gaps** — Added a **"known likely gaps" list** to W8: §6.9 (data layer partial — TD-FE-19/21/41/43/49/53/65) and §6.3 (surviving escape-hatches — TD-FE-9/10/38). W8 now confirms these rather than discovering them fresh.
- **[Medium] No rollback/contingency for W4** — Added a **rollback note** to R2: W4 is its own isolated commit (§4 group 6), independently revertible without disturbing other workstreams.
- **[Medium] W3 enrichment scope underspecified** — Added a **discovery method** to W3: Public surface from `index.ts` exports, Key files from the folder, Purpose from the routed page; reviewer is the quality gate where the surface is non-obvious (e.g. `auth`).
- **[Low] §1.2 uses W#-labels before §3 defines them** — Added "Workstream labels (W1 through W8) are defined in §3" before the table.
- **[Low] W2 lacks a drift-prevention mechanism** — Added a **drift-prevention bullet** to W2: the shared base carries a one-line "edits to shared sections must be applied to both files" convention so the duplication does not recur.
- **[Low] §5 "by construction" is intent, not guarantee** — Softened §5: the workstreams *should* not affect the build, but the `preflight` run is the actual guarantee.
- **[Nit] W1 grep omits the doc-set paths** — Addressed by the same `(§2.1 blast-radius paths)` pointer added for the W1-done-when finding.
- **[Nit] §4 "no sub-split" vs commit grouping is jarring** — Added a clause to §4: "these commit groups are not sub-phases — one branch, one preflight, one merge; the grouping only orders the commits."

## Disagreed Findings

- **[Nit] §1.4 CLAUDE/AGENTS LOC counts are stale by definition** — No change. §1.4 is explicitly titled "Current-state anchor (verified 2026-06-07)" — a dated snapshot by design, not a maintained value. The reviewer themselves marked it "not actionable." Editing it to remove the counts would weaken the anchor without benefit.

## Deferred Findings

- **[Low] §8 open questions should have owners and deadlines** — Deferred to plan-writing. Each §8 item already names "the plan" as the owner; the requested "resolved in plan §N" back-reference cannot exist before the plan does. **Trigger:** when `plans/33-…` is written, it back-references each §8 item at the section that resolves it.

## Severity Disagreements

- **W1 done-when: agree finding, severity Medium not High.** W1 is the lowest-risk workstream (comments/markdown, fully revertible). A missing count-ledger weakens post-hoc auditability but cannot produce a wrong or unsafe outcome — the quality bar plus the now-required plan ledger is workable. Revised regardless (the fix is cheap).
- **W4 archive classification: agree finding, severity Medium not High.** Misclassification is recoverable — W4 is an isolated, independently-revertible commit, and the numeric index plus the new triage rule bound the blast radius. No irreversible risk; the debt register's status is preserved by the index regardless of which file an entry's body lives in.

## Open Questions

- **W6 ADR shortlist breadth** (carried from spec §8 Q3, not raised by the reviewer): whether the kebab-case naming canonicalization warrants its own ADR or is adequately captured in `features/README.md` remains a plan-stage decision. Not blocking; recorded in spec §8 Q3.
