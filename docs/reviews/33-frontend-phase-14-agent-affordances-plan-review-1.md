---
artifact: plans/33-frontend-phase-14-agent-affordances.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-07
round: 1
---

## Findings

### [High] Task 1 inlines the full implementation — the "plan" is the code, leaving the plan-vs-code boundary porous

**Location:** Task 1, Steps 1–3 (lines 48–298)

Task 1 contains ~200 lines of verbatim TypeScript for both the test file and the refactored `scaffold-feature.ts`. The plan should specify *what* the code must do (contracts, signatures, behavior), not *be* the code. An implementing agent will paste this verbatim rather than reason about it — meaning bugs in the plan text become bugs in the code with no independent verification layer. This is the only task with full code inlining; the doc-only tasks (2–7) are appropriately abstract. If the author's intent is that the code was already reviewed in the spec round, that should be stated explicitly. Otherwise, consider collapsing Steps 1–3 into a single "implement + test" step with contracts only (exported signatures, test cases by name, behavioral assertions).

### [High] No abort condition or kill criterion stated for the plan as a whole

**Location:** Plan header + Task 8

The plan has no section answering: "Under what conditions does this plan get abandoned rather than completed?" The spec (§7 Risks) identifies five risks with mitigations but no explicit abort threshold. Task 8 Step 1 says "If red: report the failing check; do not merge" — which is a per-step recovery, not a plan-level kill criterion. Suggested addition: if `npm run preflight` cannot be made green within a reasonable effort window, or if the W1 cleanup or W4 archive split produces an unexpectedly large diff that suggests scope creep, the plan halts and reports to the operator.

### [Medium] Task 2 Step 5 (provenance pass) is under-specified for its subjective scope

**Location:** Task 2, Step 5 (lines 375–383)

The provenance pass covers ~91 provenance references with the instruction "drop the bare phase number when the sentence keeps its meaning." This is inherently judgment-based work. The plan gives one example (`shared/lib/leadData.ts`) and quality-bar principles, but no classification checklist or examples of *kept* provenance beyond the three exclusion rules (TD-FE citations, mock-data domain content, test filename refs). An implementer has to make ~91 individual judgment calls with limited guidance. Consider: (a) a short exemplar table (5–6 representative "drop" vs "keep" decisions with rationale), or (b) scoping the provenance pass to only the files already named in Steps 2–4 plus the feature READMEs (handled in Task 3), deferring the deeper sweep to a follow-up.

### [Medium] Task 4a Step 2 syncs AI-Native Development sections by reference to CLAUDE.md but the plan was written against a version that may drift by execution time

**Location:** Task 4a, Step 2 (lines 603–604)

The step says "Replace AGENTS.md's 'Spec-driven flow' + 'NN numbering' region with CLAUDE.md's fuller 'Spec-driven flow' (the 4-step cycle with `/review-spec`…`/synthesize-impl-review`, the human-approved-merge step) + 'No CI; preflight is local' paragraph + 'NN numbering' + 'Specs and plans are a frozen record' bullets, verbatim." This instruction references CLAUDE.md's *current* content at plan-writing time. If Task 4b (which also edits CLAUDE.md) runs first, or if CLAUDE.md changes between plan writing and execution, the "verbatim" copy may target stale content. The task ordering puts 4a before 4b, which is correct — but the dependency should be explicit: Task 4a must complete before 4b begins, and 4a must use the CLAUDE.md on disk at execution time, not the plan text.

### [Medium] Task 4b is operator-gated but has no explicit gate-check step

**Location:** Task 4b header (line 675)

The task header says "⚠️ Operator-gated (see plan header)" and the plan header's scope note (line 13) confirms the operator approved it. But the task itself has no step that says "confirm operator approval before proceeding" — the gate exists only in the header narrative. If the plan is executed by a different agent in a different session, that context may be lost. Add a Step 0 to Task 4b: "Verify operator approval for FE-topology refresh (see plan header scope note). If not confirmed, skip Task 4b."

### [Medium] Task 6 (TECH_DEBT archive) has no verification that cross-references to archived entries still resolve

**Location:** Task 6, Step 4 (lines 844–853)

Step 4 verifies entry counts and no-prettier reflow, but doesn't explicitly check that intra-register cross-references (e.g. "mirror TD-FE-19/21", "TD-FE-51↔63") still resolve after the move. The plan mentions this concern at line 842 ("all those referenced entries are OPEN-KEEP except 51/63 which move, so their archive anchors must resolve") but the verification step doesn't include a grep for broken `#td-fe-*` anchors. Add: `grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md docs/TECH_DEBT_ARCHIVE.md | sort | uniq -c` to spot orphaned references.

### [Medium] Recovery strategy is implicit and inconsistent across tasks

**Location:** Plan-wide

Some tasks have explicit failure handling (Task 1 Steps 2/4: test fails → fix; Task 8 Step 1: preflight red → report, don't merge). Others have none (Task 2 Step 5: what if the provenance sweep produces unexpected diff size? Task 6: what if the archive split reveals that a "fully resolved" entry has an open sub-clause missed during planning?). The spec (§7 R2) explicitly calls out that W4 is an isolated commit for independent revert — this is good and should be extended as a general principle. Suggested: add a brief "Recovery" section to the plan header stating the default: "If any task step fails unexpectedly, stop and report to the operator. Each task is its own commit for independent revert."

### [Low] Task 3 Step 1 pre-writes all 6 READMEs but Step 2 may invalidate them

**Location:** Task 3, Steps 1–2 (lines 411–565)

Step 1 writes the 6 enriched READMEs with specific content (public surface, key files). Step 2 says "confirm the public-surface/key-files claims match the current folder; correct any drift." If any feature's `index.ts` exports differ from what Step 1 assumes (e.g., `settings` actually exports more than `settingsRoutes`), the README written in Step 1 is immediately corrected in Step 2. This is a minor sequencing issue — the instructions in Step 1 could note "verify these claims against the current index.ts before writing" rather than relying on Step 2 as a correction pass.

### [Low] Parallelizability is undersold — Tasks 1, 2, 3, 5, and 6 can partially overlap

**Location:** Plan header "Architecture" (line 7); Task ordering

The plan states "logically-grouped, independently-revertible commits" but presents everything as strictly serial. Per the spec's own dependency analysis (§4): W5 (Task 1) and W1 (Task 2) are independent; W3 (Task 3) and W5 share only the naming-map ground truth, which the spec notes is "convenience, not a hard gate." W6 (Task 5) is fully independent of W1/W3/W5. An execution note on which tasks can be parallelized (even if the plan chooses serial for simplicity) would help an agentic worker using subagent-driven-development.

### [Low] NAMING_MAP test asserts exact membership but the list may drift between plan writing and execution

**Location:** Task 1, Step 1, test line 86–93

The test hardcodes the 14 feature names. This is appropriate for a regression guard, but the plan should note: if features are added or removed between plan writing and execution, the test must be updated to match reality. The existing `ls src/features/` verification in Task 3 Step 3 covers this, but the dependency is implicit.

### [Nit] Task 4a Step 6 mentions editing README.md line numbers that may shift

**Location:** Task 4a, Step 6 (line 643)

"`README.md` '## Branches' (lines 16–18)" — line numbers are fragile. This is fine for human context but an automated executor should find the section by heading, not line number. (Not actionable — just noting the pattern.)

### [Nit] Scope note date is 2026-06-08 but the plan was presumably written before that

**Location:** Plan header, line 13

"Scope note (operator-confirmed 2026-06-08)" — if this is a forward-dated confirmation that hasn't happened yet at plan-writing time, it's confusing. If it has happened, this is fine.

### [Nit] Self-review notes section is a nice touch

**Location:** Lines 923–928

The self-review notes (spec coverage mapping, type consistency, no-prettier guard, operator open-item) are helpful reviewer context. No issue — acknowledging as good practice.
