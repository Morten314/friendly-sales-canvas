---
artifact: plans/24b-frontend-phase-5b-data-layer.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Context

The plan was reviewed against its source spec (`specs/24-frontend-phase-5-market-research-design.md` §4) and the companion Phase 3 infrastructure (`client.ts`, `queryKeys.ts`, `rateLimiter.ts`). The spec exists and was read in full. The existing shared client (`client.ts`) was confirmed to route through the single `rateLimiter` via `apiRequest` (lines 13–23), validating Task 3 Step 1's expectation.

## Findings

### [High] Tasks 3/4/5 are sequenced for deadlock — the circular dependency is acknowledged but unresolved

**Location:** Task 3 Step 5 ("after Task 5's MSW handler exists, the test goes green; if sequencing red, do Task 5 first then return"), Task 5 Step 2 ("Tasks 2–4 tests now green")

Task 3's service test needs MSW handlers (Task 5). Task 4's hook test also needs MSW handlers. Task 5's verification step runs `vitest run src/features/market-research` which expects Tasks 2–4 tests to exist. The plan acknowledges this with a parenthetical escape ("do Task 5 first then return"), but this is the *normal* path, not an edge case: MSW handlers must be authored before any service or hook test can go green, yet the plan places MSW handlers at Task 5 after services (Task 3) and hooks (Task 4).

**Fix:** Promote Task 5 to immediately after Task 2 (contracts). The sequence should be: contracts (Task 2) → MSW handlers (Task 5) → services (Task 3) → hooks (Task 4) → page rewire (Task 6). This makes every red→green cycle achievable within its own task without escape-hatch instructions.

### [High] Task 1 has no success/regression verification signal

**Location:** Task 1, all steps

Task 1 captures live API response shapes. The steps say "Record: top-level shape…", "Record the shared envelope…" — but there is no verification step confirming the captures are complete or correct. An agent could partially execute Task 1 (e.g., capture 3 of 5 component responses), proceed to Task 2, write a contract that covers only those 3, and not surface the gap until 5d–5h attempt to consume the missing shapes.

**Fix:** Add an explicit verification checklist at the end of Task 1: (1) all 5 `component_name` values captured, (2) the load-latest shape captured, (3) a diff of the captured envelope against the MSW mock in `e2e/fixtures/api-mocks.ts` noting any field discrepancies. Make this a hard gate — if any of the 5 are missing and the backend can't be coaxed into returning them, record it as a known gap in the contract (with `z.unknown()` placeholders) and flag for resolution in the affected 5d–5h plan.

### [Medium] No stated recovery if Task 6 rewire breaks the page and the cause isn't obvious

**Location:** Task 6 Step 3, abort criteria (4)

Abort criterion (4) covers `journeys/04` failing after Task 7's full preflight, but Task 6's rewire of the monolithic page is the highest-risk single step — it touches a large number of interleaved fetch + state + cache sites in one file. If the rewire results in a page that type-checks and passes unit tests but renders incorrectly (wrong data, missing sections, stale cache), there is no incremental rollback or diagnostic procedure between "all looks fine" and "full abort."

**Fix:** Add a mid-Task-6 checkpoint: after Step 1 (replace fetches with hooks) but before Step 2 (delete cache machinery), run `npm run preflight` and confirm the page still renders in the dev server (or via `journeys/04` if it can run quickly). If it breaks, the cache machinery is still present to fall back to — the diff is smaller and the cause is easier to isolate. This is essentially a bisection point.

### [Medium] `LatestResearchSchema` union type is dangerously permissive as specified

**Location:** Task 2 Step 3, line `z.array(ResearchComponentSchema).or(z.object({}).passthrough())`

The `.or(z.object({}).passthrough())` branch accepts *any* non-null object — an empty `{}`, a string masquerading as an object (no, it won't — but `{ error: "something" }` will). This is the "load latest" response; if the backend returns an error envelope instead of an empty array, the contract silently passes it through and downstream code gets an unexpected shape. The comment says "Adjust to the real top-level shape from Task 1" but the plan provides no enforcement mechanism.

**Fix:** Either (a) remove the `.or(z.object({}).passthrough())` fallback entirely and require the agent to write the correct shape from Task 1's capture, or (b) if the load-latest shape is genuinely uncertain at plan time, keep the union but add a comment that the fallback branch *must* be refined before commit, and add a negative test case in the contract test that demonstrates what the fallback rejects.

### [Medium] Section-internal fetches are cataloged but no integration test prevents regressions between 5b and 5d–5h

**Location:** Task 0 Step 3, Task 6 Step 2 ("Section components still self-fetch the same endpoint")

Between 5b merge and each of 5d–5h, the five section components continue to self-fetch the `market-research` endpoint with raw `fetch` + localStorage cache. This is by design. But if any change in 5b (e.g., MSW handler intercepting the endpoint, a queryClient config change, a rate-limiter interaction) subtly breaks those raw fetches, the plan has no regression signal for the section components. Task 6 Step 2's grep (`grep -c 'fetch(' "$P"`) only checks the page file, and Task 7's `journeys/04` may or may not exercise all five sections' in-component fetch paths.

**Fix:** In Task 7 Step 4, after `npm run preflight`, explicitly verify that all five section components still render their data (either via `journeys/04` assertions — check if it validates all five components — or by adding a quick manual dev-server smoke test instruction). If `journeys/04` only validates the page-level orchestration and not per-section data, flag this as a gap to address in the §9 delta (Task 7 Step 6).

### [Medium] The plan silently narrows spec §4.2's scope without flagging the divergence

**Location:** Plan §"Architecture" paragraph and Task 6

Spec §4.2 says: "Rewire the (still-monolithic) page to consume the hooks for the **market-research-proper** sites; delete those raw `fetch` sites…" and "**The `analysis`/lead-stream tab's fetch sites are NOT migrated**." The plan correctly notes (in §"Endpoint reality") that the analysis tab has *no fetches at all*, making the exclusion moot. But the spec's §4.2 "Done when" says: "the only raw `fetch` left in the page is the `analysis`/lead-stream tab's (relocated to legacy in 5c)." The plan's Task 7 Step 5 Done-when doesn't repeat this clause, and Task 6 Step 2 expects `fetch(` count = 0 in the page — which is correct given the finding but contradicts the spec's literal text.

**Fix:** In the §9 delta (Task 7 Step 6), explicitly note that spec §4.2's "Done when" item "the only raw `fetch` left in the page is the `analysis`/lead-stream tab's" is void because the analysis tab has no fetches — 5b's done-when is stricter than the spec's (zero raw `fetch` in the page, not "only lead-stream's"). This prevents a later reviewer from flagging the discrepancy as an oversight.

### [Low] Task 3 Step 1 verification is manual and one-time with no carry-forward

**Location:** Task 3 Step 1

Step 1 asks the agent to `grep` for rate-limiter usage in the shared client and "confirm" it. This is fine as a one-time check, but the result isn't recorded anywhere. If a future change to `client.ts` accidentally removes the limiter, there's no test that catches it. This isn't strictly 5b's responsibility, but the plan is creating service fns that depend on the shared limiter.

**Fix:** Consider adding a small assertion in the service test (Task 3 Step 2) that verifies the service fn routes through `apiPost`/`apiGet` (which are known to use the limiter) rather than directly calling `fetch`. This is already implicit in the test design (it tests via MSW, not raw fetch), so this is a minor hardening suggestion — not blocking.

### [Low] ADR numbering 0003/0004 may collide if parallel work lands first

**Location:** Task 7 Steps 1–3

The plan states "Numbers `0003`/`0004` follow the existing `0002` — confirm with `ls docs/adr/`." The instruction to confirm is present, which is good. But if backend modularization or another frontend phase merges ADRs between plan-authoring and execution, the numbers could collide. This is a minor race condition.

**Fix:** The `ls docs/adr/` confirmation in Step 3 is sufficient, but the agent instruction should say "pick the next two available numbers after `ls docs/adr/`" rather than hardcoding 0003/0004. This is a nit-level hardening.

### [Low] Task 2 Step 1 test skeleton has a commented-out assertion

**Location:** Task 2 Step 1, line `// expect(() => LatestResearchSchema.parse(realLoadPayload)).not.toThrow();`

The load-latest assertion is commented out. An agent executing the plan might leave it commented, shipping a contract test that doesn't actually test the load-latest schema path. The comment in the schema code ("Adjust to the real top-level shape from Task 1") makes it clear the shape is provisional, but the test should at minimum have an active assertion.

**Fix:** Replace the comment with `it.skip("parses a real load-latest response (activate after Task 1 capture)")` so the intent is preserved as a skip rather than a silent omission.

### [Nit] Task numbering references "Task 8" in two places but no Task 8 exists

**Location:** Task 1 Step 2b ("note in the Task 8 ADR"), Task 2 Step 3 preamble ("this is the precedent ADR (Task 8)")

The ADRs are written in Task 7, not Task 8. The "Task 8" references appear to be a carry-over from an earlier draft. This is cosmetic but could confuse an agent executing the plan.

**Fix:** Change "Task 8" to "Task 7" in both locations.

### [Nit] Self-review notes reference "Task 8" for ADRs

**Location:** Self-review notes, first bullet ("R7 memory-only + reload re-fetch (ADR-0004)")

This is fine — it correctly references ADR-0004. But the earlier finding about "Task 8" applies to the self-review context too; no action needed beyond fixing the Task 8 references in the body.

### [Nit] Overly verbose spec cross-references in task headers

**Location:** Multiple task headers (e.g., Task 1: "spec §4.1, R2 — polyglot rule", Task 2: "Spec 24 §1.3.3, §4.2")

These are thorough and useful for traceability. They are not overengineering — they serve the plan's role as an execution document for an agent that needs to cross-reference the spec. No action needed; noted as a positive quality of the plan.
