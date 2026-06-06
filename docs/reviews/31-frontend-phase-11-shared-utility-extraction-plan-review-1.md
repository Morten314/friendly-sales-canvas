---
artifact: plans/31-frontend-phase-11-shared-utility-extraction.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 1
---

## Context

This review covers the full 999-line implementation plan for Frontend Phase 11 (shared utility extraction). The paired spec (`specs/31-frontend-phase-11-shared-utility-extraction-design.md`) was read alongside the plan. The plan targets agentic workers and recommends the `subagent-driven-development` skill. The review was conducted on the complete plan text; no live codebase verification was performed (the plan's own re-grep at commit `6e5a428` is the authoritative consumer trace).

## Findings

### [High] No abort conditions or kill criteria stated

**Location:** Plan-wide (no section; absent)

The plan has no stated circumstances under which execution should be abandoned entirely. Every stage has a per-task gate (G), but there is no guidance on what happens if a gate fails in a way that isn't fixable by a simple import-path correction — e.g., if the `import-x/no-restricted-paths` zones in Task 21 can't be made to work with array targets *and* the 14-zone fallback also fails, or if the full preflight (Task 24) surfaces a non-trivial regression. For a plan explicitly targeting agentic workers, an explicit abort protocol ("report to human and wait" would suffice) is a significant gap. Without it, an agent could loop on a broken gate or silently skip past it.

### [High] No recovery strategy when per-task gates fail

**Location:** "Conventions for every task" section (lines 61–71)

The convention section states gates "must be clean before commit" but does not specify what to do when they aren't. The implicit assumption is "debug, fix, re-run," which is reasonable for a human but underspecified for the stated audience of agentic workers. A single line — e.g., "If gate G fails, diagnose the failure, fix the root cause within the same task, and re-run G before committing; if the failure cannot be resolved within the task, report to the operator and halt" — would close this gap.

### [Medium] Task 19 is a large atomic unit — hard to review incrementally

**Location:** Task 19 (lines 778–841)

Task 19 moves 10+ files (3 score libs, 2 score-lib tests, 4 lead-stream components, 1 EditDropdownMenu), repoints 8+ distinct import surfaces, and deletes `components/market-research/` — all in a single commit with 11 steps. While the cluster is tightly coupled and must move together, the commit touches three distinct features (market-research, customers, strategist) and the `shared/` layer. A split into two tasks — (a) score libs + lead-stream cluster, (b) EditDropdownMenu — would improve reviewability without creating intermediate broken states (EditDropdownMenu has no dependency on the cluster).

### [Medium] No parallelism annotations despite recommending subagent-driven development

**Location:** Line 3 (recommendation), Stages 11a–11c task structure

The plan's header recommends the `subagent-driven-development` skill, but provides no parallelism hints. Within stages, several task groups are independent:
- **11a:** Tasks 1–4 (clean promotes) and Tasks 5–7 (single-consumer moves) are mutually independent. Task 8 (styles) is independent of all.
- **11b:** Tasks 9–10 are sequential, but Task 11 and Task 12 are independent of each other and of 9–10 (until Task 13 depends on all three).
- **11c:** Tasks 14–16 are independent.

A brief "parallelizable" / "sequential" annotation per stage (or a DAG note) would make the plan significantly more actionable for subagent dispatch without changing any task content.

### [Medium] Task 21 red-green proof has an unstated ordering dependency on Task 20

**Location:** Task 21 Steps 2–3 (lines 890–904)

Task 20 deletes the empty `src/lib/` directory. Task 21 Step 2 then creates `src/lib/_scratch.ts` to prove the lint rule fires. Step 3 deletes it again and re-removes the directory. This recreate-delete cycle is functional but the dependency on Task 20's cleanup is not called out. If Tasks 20 and 21 were run in parallel (which the plan's lack of parallelism annotations would not prevent), Task 21's scratch file could interfere with Task 20's emptiness verification. A note like "Task 21 depends on Task 20 being complete" would clarify.

### [Low] Spec §3 target structure contradicts plan's correct placement of `use-toast`

**Location:** Spec §3 (line 107 of the spec: `hooks/ # use-toast, usePageTitle`), Plan Task 15

The spec's §3 summary lists `use-toast` under `shared/hooks/`, but both the spec's own §5.1 and the plan correctly place it in `components/ui/use-toast.ts`. The plan implements the correct placement from §5.1, so there is no execution error — but someone cross-referencing the spec's §3 summary against the plan could be confused. The plan's "Plan-stage refinements" section does not call out this spec-level inconsistency (it was likely an oversight in the spec's §3, not a plan-level change).

### [Low] Task 13 creates a transient state that could confuse debugging

**Location:** Task 13 (lines 547–572)

Task 13 repoints `LeadsTable.tsx`'s imports in-place: `@/hooks/useAuth` → `@/shared/auth`, `@/lib/jwt` → `@/shared/auth/jwt`, `@/lib/api` → `@/shared/api/transport`. After this task, `LeadsTable.tsx` lives in `components/market-research/lead-stream/` but imports exclusively from `shared/` paths. This is correctly sequenced (the file physically moves in Task 19), but the intermediate state — a file in a legacy directory importing from the new layout — is not called out as intentional. A one-line note ("This is the expected intermediate state per spec §6 cross-stage note") would prevent confusion during code review.

### [Low] Hidden prerequisite: `npm run verify` and `npm run preflight` must exist and pass on the starting branch

**Location:** "Conventions for every task" section (line 68), Task 24 (line 960)

The plan gates every task on `npm run verify` and the final merge gate on `npm run preflight`. Neither script's existence is verified before starting. If `verify` or `preflight` are broken on the starting branch (e.g., from a prior phase merge issue), every task gate will fail for an unrelated reason. A pre-flight check ("Step 0: run `npm run verify` on the clean branch; confirm green before starting Task 1") would prevent this class of failure.

### [Nit] Task 6 step 4 uses future-tense for a cross-reference

**Location:** Task 6, Step 4 (line 301)

> "Confirm `PWAInstallPrompt`'s own import of `@/hooks/use-mobile` (line 5) is left as-is — it co-locates in Task 16."

"It co-locates in Task 16" is slightly ambiguous. "It *will be* repointed in Task 16" would be clearer for a reader scanning task-by-task.

### [Nit] Task 20 uses scoped `git add -A` contrary to convention section's "never `git add -A`"

**Location:** Task 20 Step 2 (line 862), Conventions section (line 69)

The convention says "never `git add -A`" but Task 20 uses `git add -A src/hooks src/lib src/utils`. This is a scoped use (only the empty legacy dirs) and is functionally correct, but the contradiction with the stated convention is slightly jarring. Rewording the convention to "never `git add -A` at the repo root" would be more precise.

### [Nit] Plan references specific commit SHA that could become stale

**Location:** Lines 11, 19, 30

The plan references `182cb8e` and `6e5a428` as fixed points. If the branch is rebased or amended, these become misleading. Not a functional issue (the plan is a frozen record of intent per AGENTS.md), but worth noting for anyone executing from a forked state.

### [Medium] Task 14 step 4 bulk sed on `components/ui/` will also match the newly-created `utils.ts` file

**Location:** Task 14 Step 4 (line 613)

```bash
grep -rl '@/lib/utils' src/components/ui | xargs sed -i 's#@/lib/utils#./utils#g'
```

The newly-created `src/components/ui/utils.ts` (Step 1) does not contain `@/lib/utils`, so the `grep -rl` will not match it. This is correct — but the `grep -rl` is run *after* the file is created, and if the creation template were to accidentally include a `@/lib/utils` reference (which it doesn't in the current plan), it would be silently rewritten. The current plan is safe; this is a latent fragility in the step ordering rather than a bug.

### [Medium] Task 21 fallback to 14 single-string zones could bloat ESLint config significantly

**Location:** Task 21 Step 1 (lines 888–889)

The fallback ("14 single-string zones") would add 14 entries to the `zones` array, tripling the existing config. The plan documents this as a fallback but doesn't estimate the config impact or suggest trying the array form first in a separate throwaway commit to avoid a failed-and-reverted attempt polluting the history. A simpler fallback path: try the array form, if it fails at config-load time, the agent sees the error immediately and switches to single-string pairs — no commit is made until the working form is confirmed.

### [Low] Spec's `use-toast` entry in §1.3 table lists `shared/chat/ContextChat` as a consumer

**Location:** Spec §1.3 (line 38), Plan Task 15

The spec §1.3 says `use-toast` has consumers including `shared/chat/ContextChat`. Task 15 Step 4's `grep -rl '@/hooks/use-toast'` will match ContextChat.tsx and rewrite its import. This is correct. However, ContextChat also imports `sanitizeAnswerText` (moved in Task 3) and was already modified in Task 3. By Task 15, ContextChat has been modified once; Task 15 modifies it again. This double-touch is correct but not called out as a multi-touch file. No issue — just noting it for completeness.

### [Low] Plan does not verify `knip` baseline before starting

**Location:** Task 24 Step 3 (line 965)

Task 24 expects `knip` to report no dead code. But if `knip` reports dead code that existed *before* Phase 11 started (from prior phases), Task 24 Step 3 says "investigate" with no guidance on distinguishing pre-existing dead code from dead code introduced by Phase 11. Running `knip` once on the starting branch (before Task 1) and recording the output would provide a baseline for comparison.
