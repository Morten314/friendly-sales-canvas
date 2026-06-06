---
artifact: specs/32-frontend-phase-13-loc-reduction-pass-2-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-06
round: 1
---

## Findings

### [High] No LOC reduction target or floor — success bar is unmeasurable

**Location:** §10 (Definition of Done), §3.3 (scorecard format)

Phase 1 had an explicit ≥5% LOC reduction target (measured and exceeded at −12.2%). Phase 13 has none. DoD item 2 says "LOC delta documented"; DoD item 8 defers to the master plan's "no hard target" language. The scorecard format (§3.3) records per-file verdicts and deltas, but nothing defines a minimum bar.

Without any quantitative floor — even an advisory one — the phase could theoretically ship after removing a single unused import and satisfy every DoD item as written. The plan author has no calibration for how much effort to invest in `investigate`-category findings vs cutting the phase short.

**Suggestion:** Add an advisory floor (e.g., "Phase 1 removed −12.2%; Phase 13 is expected to be smaller in percentage terms but should target at least a measurable delta against the post-Phase-12 baseline — the plan author records the expected range from the 13a audit before executing"). Alternatively, define the bar as "all `execute`-tagged findings applied plus all `investigate` findings resolved (applied or explicitly deferred with rationale)," which would at least make the effort ceiling determinate.

---

### [Medium] §5.1 composite ranking signal is underspecified

**Location:** §5.1 ("Selection"), phrase "LOC + measured redundancy (similarity-scan hits) + complexity"

The three-factor composite signal (LOC, redundancy, complexity) is referenced as the ranking methodology but none of its components are defined:

- **LOC** is straightforward.
- **"Measured redundancy (similarity-scan hits)"** — the similarity scan (§3.1) is itself unspecified tooling (`ts-morph` vs `ast-grep`, deferred to §12 Q3). "Hits" could mean duplicate blocks, near-duplicate components, or both.
- **"Complexity"** — no metric is named (cyclomatic? nesting depth? function count? prop count?). This is the most ambiguous term and the plan author must invent it.

The Phase 2a precedent referenced (error-count threshold) was a single metric with a single number. This is a multi-factor composite with undefined weighting and undefined sub-metrics. The plan author inherits significant design work.

**Suggestion:** Either (a) define the sub-metrics and weighting (even loosely — e.g., "primary sort by LOC, secondary by redundancy-hit count; complexity is a qualitative judgment factor"), or (b) reduce to a single primary metric (LOC) with the other two as advisory signals, or (c) explicitly acknowledge that the plan author designs the ranking formula and add it to §12 open questions.

---

### [Medium] §5.3 imprecise agency — "the audit judges"

**Location:** §5.3, sentence "If the audit judges a safe structural split impossible without touching behavior, it is deferred"

Audits don't judge; agents do. Throughout the rest of the spec, agency is clear ("the plan author selects," "13a re-traces," "the plan author picks"). Here "the audit" is the subject of "judges," which conflates the tool output with the decision-maker. This isn't just a wording nit — it creates ambiguity about who makes the defer decision and what evidence supports it.

**Suggestion:** Replace with "If the plan author (during planning) or implementing agent (during execution) judges that a safe structural split is impossible without touching behavior, the file is deferred."

---

### [Medium] Scorecard format missing bundle-size delta

**Location:** §3.3 (scorecard format)

Phase 13 removes code. The user-facing consequence is a smaller bundle. The scorecard format lists: §LOC delta, §per-category execution log, §per-file verdict, §handoff list, §supplementary. It does not include a bundle-size delta section.

The advisory bundle comparator (`check-bundle-budget.ts`) exists and prints deltas. For a LOC-reduction phase, capturing the bundle delta alongside the LOC delta is the obvious completeness check. The Phase 1 scorecard also omitted this (it recorded only file/LOC deltas), but Phase 1 predates the bundle comparator. Phase 13 should use it.

**Suggestion:** Add "§bundle delta (gzip, from `check-bundle-budget.ts`)" to the scorecard format spec.

---

### [Medium] §4.4 "near-identical" and "provably identical" are in tension

**Location:** §4.4 ("Dedup & inline"), bullet "Near-identical components → base + overlay (props/variant), where behavior is provably identical"; also §11 R-13.4 "only provably-identical near-duplicates are merged"

If two components are "provably identical," they're identical — not "near-identical." The dedup category is named for near-identical components (differing by props or a literal), but the bar says "provably identical." These are contradictory: either the components differ (near-identical, which requires judgment about whether the differences are safe to unify) or they don't (identical, which is mechanical).

R-13.4's mitigation helps ("ambiguous cases deferred to TD"), but the §4.4 in-scope description should resolve this tension. The Phase 9 dedup (ScoutChatWithHistory ↔ ProfilerChatWithHistory, ~90% similar) provides a precedent: that dedup required a shared substrate and was not "provably identical" — it required design judgment. The spec should set the bar at what Phase 9 actually demonstrated, not at a tautology.

**Suggestion:** Replace "where behavior is provably identical" with something like "where the behavioral delta is confined to configurable props/literals, and visual regression confirms pixel-neutrality after extraction." This matches the §4.4 description ("differ by props / one literal") and the actual precedent.

---

### [Medium] §1.1 "last LOC pass" claim is fragile given deferral surface

**Location:** §1.1, sentence "This is the last LOC pass. Phase 14 (agent affordances) follows and adds no feature-code reduction."

The phase may defer: the long tail of large files (§2.2), `useMarketResearchData.ts` (§5.3), any near-identical dedup requiring behavior change (§4.4). If significant deferrals land, calling Phase 13 "the last LOC pass" overclaims. Phase 14 won't reduce code, but a hypothetical Phase 15 or post-launch pass might.

**Suggestion:** Soften to "Phase 13 is the final planned LOC pass. Phase 14 adds no reduction. Substantial deferrals that survive Phase 13 would require a future spec." This preserves the intent without making a forward commitment that future facts may contradict.

---

### [Medium] §1.3 table formatting — the 2,000-LOC gap row is ambiguous

**Location:** §1.3, the table row starting "then a ~2,000-LOC gap to the next tier"

The row has empty cells for the File and LOC columns and crams five filenames with parenthesized LOC counts into the Note column. The markdown renders as a three-row table where the third row is misaligned — the reader cannot tell whether those parenthesized numbers (1,078; 1,000; 981; 960; 952) are LOC counts or notes.

**Suggestion:** Split into individual rows with LOC in the LOC column, or convert the gap description to prose between two separate tables.

---

### [Low] §8 middle-tier preflight tier adds no practical distinction

**Location:** §8 (Safety net & preflight cadence), bullet "Behavior-touching sub-phases (decomposition, dedup): run broader `vitest run` + Playwright visual regression locally before the sub-phase's **final** commit."

Every sub-phase in this spec is "behavior-touching" by definition — even dead-code removal changes import graphs and can break things. The spec defines three tiers: inner loop (`npm run verify` every commit), middle tier (broader vitest + Playwright for "behavior-touching" sub-phases), and merge gate (full preflight). Since all sub-phases qualify for the middle tier, the middle tier is effectively mandatory for every sub-phase's final commit — making the distinction meaningless.

**Suggestion:** Either (a) define which sub-phases are *not* behavior-touching (e.g., "scorecard-only commits," "manifest-only commits") so the middle tier is selectively applied, or (b) collapse the middle tier into the merge gate and state: "every sub-phase's merge gate is full `npm run preflight`; inner loop is `npm run verify` per commit."

---

### [Low] §6 codemod deferral to Phase 14 may need master-plan amendment

**Location:** §6, sentence "If no pattern qualifies, Phase 13 ships zero codemods and the framework defers to Phase 14 (whose `codemod-runner.sh` then establishes it)."

Spec 14 §4 Phase 14 block says Phase 13 produces codemods and Phase 14 runs them via `codemod-runner.sh`. If Phase 13 produces none, Phase 14 must both establish the framework *and* find codemod-worthy patterns — or ship no codemods at all. The Phase 14 block in Spec 14 doesn't account for this path. Not a blocker (Spec 14 §5.5 scope discipline covers amendments), but worth noting.

**Suggestion:** Add a remark: "If Phase 13 ships zero codemods, the Phase 14 spec should account for potentially establishing the framework from scratch."

---

### [Low] §4.6 orphan-route re-check may yield no new information

**Location:** §4.6 ("Orphan routes")

TD-FE-1 and TD-FE-2 already contain exhaustive 6-check kits showing these routes are unreachable from nav but reachable via direct URL / programmatic redirect. The Phase 1 investigation was thorough. 13a's re-check (§4.6) will likely reproduce the same result. The default disposition is "keep," which aligns with TD-FE-1's existing "intentionally absent from Sidebar nav" reasoning.

The re-check is not harmful — it closes the TD entries formally. But the spec should be explicit that this is a formal close action, not a new investigation.

**Suggestion:** Add "13a re-confirms reachability (expected: same result as Phase 1's 6-check kit) and formally closes the TD entries with the recorded decision."

---

### [Low] §3.1 tooling setup scope is unclear

**Location:** §3.1, bullets describing scan variants and the similarity scan

The spec prescribes: (a) a variant of `scan-inline-blocks.ts` that enumerates instead of filters, (b) a dead-export re-scan at relocated paths, (c) a component/hook similarity scan using `ts-morph` or `ast-grep`, (d) targeted `rg`/`ast-grep` queries.

Items (c) and (d) require tooling that may not be installed (`ts-morph` is a dev dep; `ast-grep` is not in the repo). Item (a) requires modifying an existing script. The effort to stand up these tools is unaccounted-for in the phase structure — 13a is a single sub-phase that produces the scorecard, and the audit tooling *is* 13a.

**Suggestion:** Either note that tooling setup is part of 13a's first commit(s) and should be budgeted in the plan, or defer the similarity scan to §12 as an open question alongside Q3 (which already covers tool choice).

---

### [Low] §7 13a internal sub-phasing not discussed

**Location:** §7 ("Sub-phase structure & sequencing")

13b…13N each get one file per sub-phase. But 13a is the entire dedup + dead-code audit and execution across the full tree. The spec doesn't discuss whether 13a has internal sub-phasing (e.g., 13a-i dead code, 13a-ii dedup, 13a-iii shadcn prune) or runs as a monolithic sub-phase. Phase 1 was executed as a single commit series; the precedent exists. But Phase 1 was also smaller (the tree was less structured, there were fewer categories).

**Suggestion:** Add a note that 13a may sub-split internally at the plan author's discretion, mirroring Phase 1's approach.

---

### [Low] §5.2 "green" sub-phase not defined against preflight tiers

**Location:** §5.2, "each sub-phase is a discrete commit series leaving the tree green"; also §8

§5.2 says a failed sub-phase reverts to the "last green sub-phase" (Spec 14 §5.7). §8 defines three tiers. "Green" in the revert context could mean `npm run verify` pass (inner loop) or full `npm run preflight` pass (merge gate). The spec should specify, because the revert point determines how much work is at risk.

**Suggestion:** Clarify that "green sub-phase" means `npm run verify` passes (the inner loop), since full preflight is the merge gate and is only run once per sub-phase at merge time.

---

### [Nit] §13 companion docs cross-references are accurate

**Location:** §13

All cross-references verified: Spec 14 exists at the named path, Phase 1 scorecard exists at `docs/audits/2026-05-27-frontend-loc-pass-1.md`, ADR directory has entries 0001–0005 (next is 0006), TD-FE ceiling is 63. No stale references.

---

### [Nit] §1.4 inherited tooling inventory is useful and complete

**Location:** §1.4

The tooling list correctly notes what exists, what doesn't exist yet (`codemods/`, `ui-patterns/`), and what limitations apply (`knip` ignoring `components/ui/**`). Good handoff.
