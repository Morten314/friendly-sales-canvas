---
artifact: specs/33-frontend-phase-14-agent-affordances-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-07
round: 1
---

## Context

Review performed against the full spec text (242 lines). The spec is well-structured, precise, and unusually honest about deliverables that became moot. Findings skew toward Medium/Low because the scope is intentionally small and low-risk; the structural and editorial quality is high.

## Findings

### [High] W1 "done when" lacks measurable exit criterion

**Location:** §3 W1, "Done when" (line 107)

The done-condition is qualitative ("the stale forward-promises are all resolved; remaining phase-references in `src/` are either genuine traceability citations or provenance whose phase number could not be dropped without quality loss"). There is no quantified baseline or residual-count target. For the plan to be auditable, the spec should commit to: (a) recording the exact baseline hit count (146 is cited informally at §1.3 but not as a W1 input), (b) classifying every hit into the three buckets with counts, and (c) recording the residual count + bucket breakdown in the plan. Without this, "done" is reviewer-judgment-only and difficult to verify post-hoc.

### [High] W4 archive-split correctness depends on manual classification of ~66 entries

**Location:** §3 W4, lines 132–141

W4 requires classifying every `TD-FE-<n>` as "fully resolved" vs "open / carried-forward." The spec acknowledges edge cases (TD-FE-45 "resolved for the relocation part only") but provides no classification rule for partially-resolved entries. The instruction "only fully-resolved entries move" is clear at the extremes but the boundary (partially resolved, superseded-by, obsoleted-by-different-approach) is where mistakes happen. The spec should either: (a) give an explicit triage rule for ambiguous entries (e.g. "if any sub-clause remains open, keep in main"), or (b) name the plan as the place where each borderline entry gets a disposition. Currently it does neither.

### [Medium] §4 sequencing groups W5 before W1 but W3 "coordinates with" W5

**Location:** §4, lines 189–197; §3 W3, line 126

§4 puts W5 (scaffold-feature hardening) as commit 1, W1 as commit 2, W3 as commit 3. §4 also says "W3's naming-map check coordinates with W5's `NAMING_MAP` sync." W3 line 126 says "Confirm the `src/features/README.md` naming map matches the actual 14 feature folders (coordinates with W5's `NAMING_MAP` sync and TD-FE-32)." This coordination dependency is underspecified — does W3 need W5 to land first to pass, or does W3 independently verify the same truth? If W3 runs before W5, it would find the stale map and fail. The sequencing (W5 then W3) resolves this, but it's implicit. The spec should state the ordering constraint explicitly (W5 must land before W3's naming-map check).

### [Medium] W6 shortlist item 1 references a "§3.1 join-point resolution" that is not in this spec

**Location:** §3 W6, line 156

"Scout/Profiler kept distributed, no `features/profiler/` (the §3.1 join-point resolution; TD-FE-60)." This references a section number from a different document (presumably the master plan or a phase spec), but the citation is ambiguous — it could be read as §3.1 of this spec (which is "Reframe from the master-plan text"). ADR backfill requires correct provenance; the spec should cite the source document and section explicitly.

### [Medium] W7 "exact wording confirmed with the operator at impl time" is plan-material, not spec-material

**Location:** §3 W7, line 168

The spec delegates the actual steady-state branch-model prose to the plan or impl stage. This is acceptable for wording, but the spec should at minimum state the **semantic requirements** of the replacement text (what must be communicated), not just that the old text goes away. Currently §2.1 and W7 describe *what files change* and *what topic changes*, but not what the replacement must convey beyond "master is trunk" and "legacy branches dormant." For example: does the new text need to mention `--no-ff`? The phase-branch naming convention? The preflight gate requirement? These are currently scattered across §4 and W7 without a consolidated "what the branch-model section must contain" checklist.

### [Medium] §6 defers §6-gaps to TD-FE without specifying blocking threshold

**Location:** §6, lines 211–213; §3 W8, lines 172–179

"Any §6 criterion that does not hold is logged as `TD-FE-<n>` rather than blocking (pre-launch posture)." This is internally consistent with the MVP posture, but it means the master plan can be declared "done" while having unmet acceptance criteria. The spec should acknowledge this trade-off explicitly: name the *expected* gaps (if any are already known from the §1.2 reframe table) so that W8 doesn't discover them fresh. The §1.2 table suggests most deliverables are satisfied or moot, but it doesn't explicitly walk the ten §6 criteria — that gap analysis would strengthen W8's done-condition.

### [Medium] No rollback / contingency for W4 (TECH_DEBT.md split)

**Location:** §3 W4; §7 Risks

R2 mentions corruption risk but the mitigation is "no-prettier" + "review diff." There is no stated contingency if the split goes wrong (e.g. a cross-reference is broken, or a carried-forward entry is accidentally moved). Given that `TECH_DEBT.md` is 1,935 LOC and the spec warns about prettier corruption, a rollback strategy (even just "W4 is its own commit, revertible independently") would be prudent. §4 does group W4 as its own commit (commit 6), which helps, but the risk section doesn't note this.

### [Medium] W3 enrichment scope for "stub" vs "substantive" READMEs is underspecified

**Location:** §3 W3, lines 122–130

W3 splits READMEs into "6 stubs needing enrichment" and "substantive ones needing verification." The enrichment target is the template from `src/features/README.md` (Purpose / Public surface / Key files / Dependency notes). But "enrich" is still open-ended — who determines what the "Purpose" and "Public surface" of `auth`, `settings`, `tenant` are? The spec assumes this can be derived from reading the code, but features like `auth` may have non-obvious public surfaces. The spec should either name the discovery method (e.g. "grep exports from `index.ts`") or acknowledge that some judgment is required and the reviewer is the quality gate.

### [Low] §1.2 reframe table uses "W3", "W5", etc. before workstreams are defined

**Location:** §1.2, lines 22–31

The table in §1.2 references W1–W8 workstream IDs, but §3 (Workstreams) hasn't been introduced yet. A reader encountering §1.2 for the first time must skip ahead to understand what W3, W5, etc. are. This is a readability issue, not a correctness issue — a parenthetical like "(see §3)" on first use would help.

### [Low] W2 "shared base" model assumes no future divergence mechanism

**Location:** §3 W2, lines 109–120

W2 establishes a shared-base + per-tool-delta model for `CLAUDE.md`/`AGENTS.md` but doesn't address ongoing maintenance: when someone updates `CLAUDE.md`, how do they know to also update `AGENTS.md`? The cross-reference note helps discovery but doesn't prevent drift recurrence. A one-line convention in the "AI-Native Development" section of the shared base (e.g. "changes to shared sections must be applied to both files") would close this loop. This is a process concern, not a spec defect.

### [Low] §5 "W1/W2/W3/W4/W6/W7/W8 are comments/markdown and do not affect typecheck/lint/build/test/e2e"

**Location:** §5, line 205

This claim is mostly true but W1 edits comments in `frontend/src/` files. While comments don't affect typecheck/lint/build, a malformed edit could theoretically introduce a syntax error in a TypeScript file if a comment is adjacent to code and the edit is sloppy (e.g. accidentally deleting a line boundary). The risk is negligible and the spec's "by construction" qualifier covers it, but it's worth noting that the claim is a *design intent*, not a *guarantee* — the preflight run is the actual guarantee.

### [Low] §8 open questions should have owners and deadlines

**Location:** §8, lines 227–233

Four open questions are listed "for the plan stage" but none has a responsible party or a resolution trigger. This is standard for specs (plan resolves them), but given that this spec is unusually specific in other areas, adding "resolved in plan §N" cross-references would tighten the handoff.

### [Nit] §1.4 bullet on `CLAUDE.md` vs `AGENTS.md` LOC counts are stale by definition

**Location:** §1.4, line 51

"CLAUDE.md (177 LOC) vs AGENTS.md (187 LOC)" — these counts will drift as soon as any edit lands. The counts are useful for the current-state snapshot but will be wrong by the time the plan or impl runs. Not actionable, just noting the snapshot nature.

### [Nit] §3 W1 grep command uses `frontend/src/` but the in-scope doc set is not specified in the command

**Location:** §3 W1, line 98

The enumeration step runs `grep -rInE "\b[Pp]hase[- ]?[0-9]" frontend/src/` plus "the in-scope doc set" — the latter is not a single command and the spec doesn't give an equivalent grep for the doc files. The plan will need to enumerate these paths. This is fine for spec-level but worth flagging for completeness.

### [Nit] Minor inconsistency: §4 says "no sub-split" but the commit grouping is effectively a sub-split by another name

**Location:** §4, line 185

"Single phase… No sub-split — the work is low-risk doc/tooling/cleanup and does not warrant 14a/14b ceremony." Yet the very next paragraph gives 7 ordered commit groups with dependency ordering. This isn't a real contradiction (sub-phases vs. ordered commits are different things), but the juxtaposition is slightly jarring.
