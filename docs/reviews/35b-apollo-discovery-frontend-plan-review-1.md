---
artifact: plans/35b-apollo-discovery-frontend.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-13
round: 1
---

## Context

Reviewed against spec `specs/35-apollo-discovery-design.md` (§6 FE design, §9 divergences, §10 testing). The plan is 35b (frontend-only), building against the 35a backend already merged. No spec 35b exists — the parent spec 35 covers both stacks, so the plan derives its FE scope from §6 + §9. This is acceptable but noted below.

## Findings

### [Medium] No abort / kill criteria stated anywhere in the plan

**Location:** Entire plan — no section on abort conditions.

The plan has 15 tasks, each with a commit step, but never states when the implementer should stop. If Task 6 (tile-state logic) reveals a fundamental mismatch with the backend contract, or Task 11 (mounting) discovers that `DataSourcesManager` is architecturally incompatible with the tile approach, there is no guidance on whether to pivot, report, or continue. AGENTS.md recommends "report to human and wait" as an acceptable minimum. Its absence is a gap for a 15-task plan.

**Recommendation:** Add a brief "Abort criteria" section (or a note under Execution Handoff): e.g., "If any task's backend-contract assumption is invalidated by a live `/docs` check, stop and report to the operator before continuing."

### [Medium] `index.ts` barrel has a forward reference that breaks builds mid-sequence

**Location:** Task 1, Step 4 — `index.ts` exports `LEAD_SOURCE_OPTIONS` from `./lib/leadSource` (created in Task 13) and `useApolloUnlockToast` from `./hooks/useApolloUnlockToast` (created in Task 12).

The plan acknowledges this in a parenthetical ("If executing strictly in order, add this export line in Task 14 instead") and in the Self-Review (line ~2141). However, the code block at line 275–278 is presented as the *Task 1 implementation* — if copy-pasted verbatim, it will fail typecheck. The workaround (commenting out the line) is mentioned in Step 5's note, but not in Step 4 where the code is given.

**Recommendation:** Either (a) present Task 1's `index.ts` with only the exports that resolve at that point (`ApolloTile` resolves at Task 10, `useApolloUnlockToast` at Task 12, `LEAD_SOURCE_OPTIONS` at Task 13 — none resolve at Task 1), or (b) state explicitly that `index.ts` starts as an empty barrel and accumulates exports in each task that creates a module. The current form invites a broken intermediate commit.

### [Medium] `ApolloTile` barrel export references a component not yet created

**Location:** Task 1 `index.ts` line 275 — `export { ApolloTile } from "./components/ApolloTile"`.

`ApolloTile.tsx` is created in Task 10. This is the same forward-reference class as the `LEAD_SOURCE_OPTIONS` issue, but affects a core component. If the implementer commits Task 1 as-is, the barrel is unresolvable for 9 tasks.

### [Medium] No recovery strategy when individual steps fail

**Location:** All tasks — Steps 2/4 say "expect FAIL" / "expect PASS" but there is no guidance on what to do if a step that should pass fails.

The TDD rhythm is solid (write test → verify fail → implement → verify pass → commit), but if Step 5 of Task 2 passes in isolation but breaks Task 1's tests (because `index.ts` now references `services/` which pulls in `contracts` that doesn't exist yet), there's no stated recovery path. A single sentence ("if a previously-green test breaks, fix before committing" or "run the full feature suite before each commit") would suffice.

### [Low] Typo: `redisccovery_guard` vs `re_discovery_guard`

**Location:** `types.ts` line 267 — `DiscoveryPromptKind` includes `"redisccovery_guard"` (double-c, extra-c). This value is used consistently throughout the plan (`discoveryPrompt.ts` line 986, `ApolloTile.tsx` line 1600), so it's internally consistent — but it's a typo that will propagate into the codebase and be hard to fix later.

**Recommendation:** Fix to `"rediscovery_guard"` before implementation.

### [Low] Typo: `AppolloConnectError` in types.ts comment

**Location:** `types.ts` line 264 — the file structure comment says `AppolloConnectError` (double-p). The actual interface is `ApolloConnectErrorShape`. Minor but could confuse a reader.

### [Low] `buildApiUrl` export assumed but not verified

**Location:** Task 3, Step 3 — the connect service imports `buildApiUrl` from `@/shared/api/transport`. The note at line 605 says "If it is currently private, export it (one-line change)." This is a hidden prerequisite — the plan should verify this export exists (or doesn't) and state the outcome, rather than leaving it as a conditional to resolve at task time. For a plan review, this is a minor ambiguity.

### [Low] `useAuth` shape assumed but may differ

**Location:** Multiple locations — G10 states "Get `orgId` and `userId` (currentUser) from `useAuth()`." Task 10's `ApolloTile` (line 1556–1557) destructures `{ orgId, currentUser }`. The test mocks at line 1470 return `{ orgId: "o1", currentUser: { uid: "u1" } }`. If the actual `useAuth` returns a different shape (e.g., `user` instead of `currentUser`, or `uid` isn't the field name), all auth-consuming components break. The plan notes this in Task 10 Step 4 ("Adjust `useAuth` import shape if the real one differs"), but it's a runtime discovery that could be a pre-step verification.

### [Low] No parallelizability guidance — all 15 tasks are serial by default

**Location:** Task ordering throughout.

Several task groups are independent and could run in parallel:
- Tasks 2 + 3 (services) could run after Task 1 in parallel
- Tasks 4 + 5 (hooks) could run after Task 3 in parallel
- Tasks 7 + 8 + 9 (components) could run after Task 6 in parallel
- Tasks 13 + 14 (source filter + badge) could run in parallel

The plan's subagent-driven-development recommendation suggests dispatching per-task, but without parallelizability annotations, an executor would serialize everything. Given that the plan is 15 tasks, noting which can overlap would meaningfully reduce wall-clock time.

### [Low] G5 seam (missing `[N]` count) is well-documented but may cause UX confusion

**Location:** G5 (line 47–48) and Task 9 `KeepReplaceDownloadPrompt` (line 1400).

The prompt says "You have Apollo-sourced leads from a previous discovery" without a count. The spec (§6.4 UC5) originally implied a count. The plan explicitly documents this as a seam. This is not a plan defect — it's a conscious deferral — but worth flagging as the UX feels slightly incomplete.

### [Low] Task 11's mount test has a vague comment placeholder

**Location:** Task 11, Step 1 — lines 1735–1736: `// Mock any heavy mission-control data hooks the manager needs so it renders in isolation. // (Add minimal mocks for the manager's own data hooks here as needed.)`

This is effectively a TODO in the test code. The plan doesn't specify what those mocks are, so the implementer must discover the DataSourcesManager's dependencies at task time. For a plan this detailed, this stands out as the one place where the code is genuinely incomplete rather than fully specified.

### [Low] `connectApollo` success response is untyped

**Location:** Task 3, Step 3 — line 595: `return (await res.json()) as { connected: boolean; status: string }`. The success path uses a raw type assertion instead of a zod parse, while every other service function validates through zod. The plan explains this (G1 — can't use `apiPost`+zod because it swallows error bodies), but the success response is also unprotected. A malformed success response would pass through silently.

**Recommendation:** Consider parsing the success body with a minimal zod schema (e.g., `z.object({ connected: z.boolean(), status: z.string() }).passthrough()`) for consistency, even though the error path requires raw fetch.

### [Nit] Plan header says "REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development" but lists two options

**Location:** Line 3 vs. Execution Handoff (lines 2147–2152). The header mandates subagent-driven, but the handoff offers both subagent-driven and inline execution as equals. Minor inconsistency in framing.

### [Nit] `WarmupProgress` says "X of 4 agents ready" but the 4 items are not agents

**Location:** Task 8, line 1258. The warmup milestones are ICP configured, signals generated, scout completed, profiler analyzed — these are prerequisites, not agents. The copy is fine UX-wise (matches the spec's warmup language), but technically imprecise.

### [Nit] Self-Review section references spec sections but doesn't cross-reference AC numbers

**Location:** Self-Review, lines 2126–2135. The AC coverage check is useful but maps to spec §6 sub-sections rather than the numbered acceptance criteria in spec §2. AC1–AC6 are the binding acceptance criteria; the self-review would be stronger with an explicit AC-by-AC trace.

### [Nit] Commit messages use `feat(fe):` prefix consistently — good

**Location:** All task commits. Follows the repo's `type(scope):` convention from AGENTS.md. No issues.

---

## Summary of spec-drift check

The plan faithfully implements spec 35 §6 (frontend design) with the divergences explicitly called out in the plan's "Key decisions & divergences" section (lines 30–38), all of which trace back to spec §9. No scope creep detected. The only out-of-scope items (G5 `[N]` seam, G6 data-dependency) are documented seams with clear rationale, not feature additions.

The plan is thorough, well-structured with a solid TDD rhythm, and covers the spec's FE requirements comprehensively. The findings above are predominantly Medium/Low — the plan is implementable as-is with the caveat that the barrel forward-references need a cleaner strategy and an explicit abort/recovery protocol should be added.
