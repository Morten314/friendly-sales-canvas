---
artifact: plans/32-frontend-phase-13-loc-reduction-pass-2.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-06
round: 1
---

## Context

Spec 32 exists and was read alongside this review. The plan's self-review (lines 413–419) was cross-checked for spec-section-to-task mapping accuracy; the mapping is correct. No token or model limitations affected this review.

## Findings

### [High] No phase-wide abort or cost ceiling — only per-commit 3-attempt rule

**Location:** "Abort criterion" (line 33), whole-plan scope

The plan's sole abort mechanism is per-commit: 3 failed fix attempts on a single gate → halt and surface. This is good for individual steps but provides no cumulative escape hatch. The dedup loop (13a-iv) and the dead-code loop (13a-i) are open-ended in cardinality. If the audit surfaces 80 findings and the agent is grinding through them slowly (each requiring manual investigation, revert cycles, TD deferrals), there is no stated criterion for "this phase is too expensive relative to its value — pause and re-scope." Contrast with the decomposition escape hatch ("defer rather than force"), which does exist. A sentence like "if >50% of 13a-i findings require investigation rather than mechanical removal, pause for operator re-scope" would bound the worst case.

### [High] Similarity-scan tool (Task A2) is a non-trivial build with unbounded fallback

**Location:** Task A2, "Step 1: Implement the scan using the `typescript` compiler API" (lines 162–166) and "Step 2" fallback (line 173)

Task A2 asks the agent to implement a shingle-based Jaccard similarity scanner over the TypeScript AST from scratch using the raw compiler API. The algorithm (AST walk → token stream → placeholder normalization → 5-token shingle multisets → pairwise Jaccard ≥ 0.85) is a meaningful coding project in itself, with edge cases around JSX syntax, generics, and decorator handling. If the raw API proves insufficient, the fallback is "add `ts-morph` and reimplement" — but this fallback is unbounded: the reimplemention effort is not scoped, and the plan doesn't state whether the 3-attempt abort criterion applies to tooling tasks or only to source-removal commits.

**Recommendation:** Either (a) start with `ts-morph` (it's already the spec's first suggestion at §3.1 and §12 Q3) and skip the raw-API experiment, or (b) bound the raw-API attempt explicitly (e.g., "if the scan produces >30% false positives on manual spot-check, switch to ts-morph within one additional commit").

### [Medium] No explicit candidate source for single-use trivial wrapper components

**Location:** Task E, "Step loop (inline triplets / trivial wrappers)" (line 306)

Spec §3.1 bullet 5 calls for "targeted rg/ast-grep queries for trivial single-use wrapper components and the inline-triplet pattern" as a distinct audit input. The plan handles inline triplets via the `--enumerate` scan (Task A1) and near-identical dedup via the similarity scan (Task A2), but neither scan surfaces *single-use* wrappers (a component exported and imported exactly once that is a trivial one-line passthrough). The similarity scan groups *near-identical pairs*, so a structurally unique single-use wrapper would not appear. Knip's dead-export scan (Task B) would keep it (one inbound). The execution step exists ("inline it unless it adds semantic clarity"), but the candidate-identification step is missing. The agent would need to improvise a query (e.g., `rg` for files that export exactly one component and are imported exactly once), and this is not in the plan.

### [Medium] Dead-export removal lacks explicit recovery step

**Location:** Task B, "Step loop (dead exports)" (lines 254)

Dead-file removal has an explicit recovery: `git checkout -- frontend/<PATH_REL>` on verify failure, switch verdict to keep. Dead-export removal says "delete the export keyword (or the whole declaration if otherwise unused), Gate G, commit" — but if G fails (e.g., the export was consumed via a re-export chain that the C1–C4 check missed), there is no stated revert instruction. The implicit assumption is `git checkout`, but the dead-export edit is an in-file mutation, not a `git rm`, so the correct recovery is more nuanced (revert the specific deletion or `git checkout -- <file>`). A sentence matching the dead-file recovery pattern would close this gap.

### [Medium] The 6-check kit basename extraction can produce false positives for generically-named files

**Location:** Task B, "Step loop (dead files)" (lines 228–235)

The check uses `BASE=$(basename "$PATH_REL" | sed 's/\.tsx\?$//')` and then `rg -n "\b${BASE}\b"` (C4 plain). For generically-named files like `index.tsx`, `utils.ts`, `types.ts`, `constants.ts`, `helpers.ts`, this will match many unrelated references, producing false-positive "keep" verdicts. The plan acknowledges this implicitly by having a two-tier posture (conservative for infra, aggressive for features), but doesn't flag that the check kit itself needs path-scoped refinement for generic names. For feature-scoped files (`features/*/components/*.tsx`), the basename is usually specific enough, but for shared/utility files, the agent should constrain the `rg` to the import-graph neighborhood rather than the whole tree.

### [Medium] No cardinality estimate or bound for the dedup loop (13a-iv)

**Location:** Stage 13a-iv, Task E (lines 293–308)

13a-iv is a loop sub-procedure over similarity-scan candidate groups and inline-block groups. The plan provides no estimate of how many groups the scan might surface (the spec is similarly silent). If the scan produces 40+ candidate groups, each requiring manual behavioral-delta assessment, visual-regression runs, and potential ADR authoring, the time cost is substantial. A rough upper bound (e.g., "if >15 candidate groups, surface to operator for prioritization") would prevent the phase from stalling on low-value dedup.

### [Medium] Advisory-test failure has no explicit handling beyond the merge gate

**Location:** Task E, "every commit here gets the §8 advisory (`npm run test` + `npm run test:e2e`) before it lands" (line 297); gate G vs advisory distinction (lines 25–31)

The plan distinguishes gate G (hard, every commit) from the advisory (soft, dedup/decomposition commits before final commit). If the advisory fails (visual regression shows >2% drift or a test breaks) but gate G passes, the plan doesn't state what happens. The merge gate (full preflight) would eventually catch it, but the advisory is supposed to surface issues *before* the final commit. The abort criterion (3 attempts) is defined only for gate G, not for advisory failures. An explicit statement like "advisory failure is treated identically to gate failure for abort-criterion counting" or "advisory failure → revert the commit, defer the finding" would close this ambiguity.

### [Low] "Pixel-neutral" vs 2% visual-regression threshold not reconciled

**Location:** Task E, "visual regression must stay green at 2%" (line 302); Task J Step 5, "pixel-neutral" (line 394); Task F Step 2, "pixel-neutral" (line 317)

The plan uses both "pixel-neutral" and "green at 2%" in different places. Spec §4.4 says "visual regression confirms pixel-neutrality after extraction," which implies 0% drift, but the Playwright threshold is 2%. For decomposition (structural splitting), the expectation should be truly pixel-identical (0% drift in the specific component screenshots), not "under the 2% global threshold." A dedup that passes at 1.5% visual drift but is perceptibly different would be a behavior change. The plan should clarify that the advisory visual-regression run is a *component-level* check (expect 0% on the affected component screenshots), not just the global threshold pass.

### [Low] TD-FE numbering relies on runtime grep without atomicity guarantee

**Location:** "TD-FE numbering" (line 35)

The plan says to read the live max via `grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -t- -k3 -n | tail -1` before each deferral. If two agents or sub-phases are writing deferrals concurrently (the plan says decomposition sub-phases are separate branches, so this is unlikely within a single sub-phase, but could happen if multiple sub-phases are parallelized), the numbering could collide. Low risk given the stated serial-within-sub-phase execution model, but worth noting since Stage SELECT explicitly mentions that sub-phases could be parallelized.

### [Low] Spec §3.1 "dead-export re-scan" is split across two tasks without cross-reference

**Location:** Task B (dead exports from knip, line 254) and Task C (TD-FE-3..6 re-eval, line 264)

Spec §3.1 bullet 2 describes a "dead-export re-scan at the current locations of the TD-FE-3..6 symbols" as a single audit activity. The plan splits it: general dead exports go through Task B (knip-driven), TD-FE-3..6 go through Task C (manual re-trace). This is correct functionally (knip covers general dead exports; Task C covers the specific symbols), but there's no cross-reference between the two tasks to ensure that TD-FE-3..6 symbols that knip also surfaces aren't processed twice (once in B, once in C). A note in Task C like "skip any symbol already removed/closed in Task B" would prevent double-processing.

### [Low] Stage 0 Step 6 hardcodes a specific baseline filename

**Location:** Stage 0 Step 6 (line 115)

`ls docs/audits/2026-05-26-frontend-bundle-baseline.json` — if the baseline file was renamed or regenerated by a later phase, this check would fail despite the baseline existing under a different date. A glob (`ls docs/audits/*-frontend-bundle-baseline.json`) would be more robust. The Task H scorecard step references `bundle:check` which presumably knows its own baseline, so this step is just a sanity check — but a glob would make it resilient.

### [Nit] Topo-sort reference points to a commit hash

**Location:** Task B, "Step prep" (line 224)

`git show 5099110:plans/16-frontend-phase-1-loc-reduction.md` references a specific commit SHA. If the plan-16 file is on `master` (which it should be), the reference could just be `plans/16-frontend-phase-1-loc-reduction.md` with no SHA fragility. The SHA is arguably more precise (immune to later edits to plan 16) but is also opaque to a human reader.

### [Nit] Phase-close task (Task K) has a "short close branch" ambiguity

**Location:** Task K, Step 1 (line 405)

"On the final decomposition sub-phase's branch (or a short close branch off `master`)" — the parenthetical offers two options without guidance on which to prefer or when. Since the close task only edits spec/docs files, either works, but the agent shouldn't have to guess. "Use the final sub-phase's branch if it hasn't been merged yet; otherwise create a `phase-13-close` branch" would be clearer.
