---
artifact: plans/24d-frontend-phase-5d-market-entry.md
artifact_type: plan
verdict: findings
reviewer_model: claude-opus-4-8
date: 2026-06-01
round: 1
---

## Context

This review verified the plan's load-bearing premises against the live tree (worktree off `master`, branch `worktree-session-2026-06-01`), not just against the plan's prose:

- `MarketEntrySection.tsx` is at the post-5a path `frontend/src/features/market-research/components/MarketEntrySection.tsx`, 3,871 raw LOC.
- The dead block is real: 1,946 commented lines, the old copy's own `// const MarketEntrySection: React.FC` at line 54 and `// export default` at 1969; first live line (`import {`) at 1971.
- The live component is single-layer (`const MarketEntrySection: React.FC` at 2044, `export default` at 3871) — exactly as the plan asserts.
- The self-fetch machinery is present (24 matches for `fetchMarketEntryData|apiFetchJson|executeWithRateLimit|getUserLocalStorage`); the `/ask` edit path is present (2 matches).
- 5b's data layer (`contracts.ts`, `hooks/useMarketResearch.ts`, `services/marketResearch.ts`) exists. **`IntelligenceTab.tsx` is absent** — i.e. 5c is not merged to `master` on this branch (the "5c shipped" commit lives on the main repo's local `phase-5c-page-decomposition` branch, not master).

So the plan's structural claims are accurate as of today. The findings below are about verification sequencing, commit scoping, and one prerequisite-interaction risk — not about factual errors in the plan's reading of the file. This is a strong, well-grounded plan; severities are calibrated accordingly (no Critical).

## Findings

### [High] The behavioral regression guard (`journeys/04`) runs only once, at the very end — including past the riskiest commit it explicitly predicts will break it

**Location:** Task 4 Step 3 note ("If removing the research fetch makes `journeys/04` fail because the section no longer auto-hydrates…") vs. Task N+2 Step 2 (the only place `journeys/04` actually runs, via the full preflight).

Every intermediate task (Tasks 1–4, 5–N, N+1) gates on `tsc --noEmit` + `npm run lint` + `npx vitest run <touched>` + `knip`. The behavioral E2E — the spec's designated "primary guard that decomposition preserved behavior" (spec §8) — is not run until Task N+2. The plan itself names the auto-hydrate regression as Task 4's signature failure mode ("the hook's `enabled`/auto-fetch is not matching the old mount-fetch"), yet defers detection of exactly that failure to the end of a ~13-commit branch. A regression introduced at Task 4 (fetch→hook swap) or any extraction surfaces late, where pivoting means unwinding multiple commits. Recommend running `journeys/04` (or a scoped subset) at least at the Task 4 checkpoint, and ideally encoding the auto-hydrate behavior as a Vitest/RTL assertion in Task 4 so the mid-stream gate carries a real behavioral signal rather than only structural ones. (Spec §8's "green between every sub-phase" is satisfied by one end-of-phase run, but within this sub-phase the riskiest step has no behavioral verification.)

### [Medium] The baseline gate (Task 0 Step 3) may be weaker than the final gate (Task N+2 Step 1), so pre-existing redness gets misattributed to 5d

**Location:** Task 0 Step 3 — `npm run preflight   # or the lighter typecheck+lint+test subset` — and abort criterion 2 ("the Task 0 baseline preflight (or its lighter subset) is RED before any 5d change").

If the baseline runs only the lighter typecheck+lint+test subset, a pre-existing failure in the parts the subset skips (build, `bundle:check`, Playwright `journeys/04`, visual, `knip --strict`) passes the baseline gate undetected — then first surfaces at the full Task N+2 preflight and is misattributed to 5d's changes (or worse, triggers a fruitless abort-criterion-4 investigation). The baseline should run the **same** gate the final task uses (full `npm run preflight`) so the starting state is provably green against the identical bar. If full preflight at baseline is too slow to justify, at minimum run `journeys/04` and the build at baseline, since those are the gates the lighter subset omits and the ones most likely to be pre-broken by upstream 5b/5c churn.

### [Medium] No explicit re-plan branch for the outcome Task 0 itself anticipates — 5c having already removed/replaced the in-component self-fetch

**Location:** Task 0 Step 4 preamble ("5b/5c may have rewired or partially removed the in-component fetch during the page rewire") and abort criterion 5.

The plan's entire Task 3→4 spine assumes the live section still self-fetches and that 5d "completes the 5b migration this file missed." I confirmed the self-fetch is intact on `master` today — but 5c is **not yet merged**, and 5c is the immediate prerequisite. If the merged 5c is the hook-first variant that extracts a shared research-data hook and wires sections to consume it, MarketEntrySection's in-component fetch may be partly or fully gone by the time 5d runs. The plan handles "confirm it's still there"; it does not give a decision branch for "Task 0 found the self-fetch already removed." In that case Tasks 3–4 collapse or invert (the hook may already be consumed; Task 4's deletions become no-ops or partials), and "reconcile any drift" is too thin a directive for a structural pivot of that size. Add an explicit Task 0 outcome: *if the section already reads through a 5c/5b hook, shrink/skip Task 4, re-derive the read seams from the existing hook, and record the reduced scope* — or escalate per abort criterion 5 if the existing wiring conflicts with `useMarketEntry`. Tying the resolution to abort criterion 5 explicitly would close the gap.

### [Medium] Task 4 bundles an optional, behavior-affecting error-boundary wrap into the single heaviest commit

**Location:** Task 4 Step 4 ("Optionally wrap in a section error boundary … `<FeatureErrorBoundary featureName="Market entry">`"), folded into the Task 4 commit alongside the fetch→hook swap and machinery deletion.

Task 4 is self-described as "the heaviest task" — it already adopts the hook, routes the read seams, deletes `fetchMarketEntryData` + 4 effects + 7 refs + the localStorage cache + dead imports. Adding a new error boundary (which changes runtime failure behavior, not just structure) into the same commit reduces the reviewability of the gnarliest, most error-prone change in the plan, and is beyond the spec's stated per-section pattern (spec §2 places `FeatureErrorBoundary` at the routed-page/feature level; a per-section boundary is additive). Either split it into its own commit (after Task 4 is green) or drop it from 5d and log it as a follow-up. Keeping the heaviest commit to one concern is consistent with the plan's own "one commit per task / per-piece revert" principle.

### [Low] Scope expansion vs. the spec's per-section pattern — defensible and flagged, noted for traceability

**Location:** Architecture paragraph ("so 5d both decomposes **and** completes the 5b migration for this section") and Task 4; vs. spec §6 (per-section pattern = container + sub-components + section-data hook *consuming 5b* + types).

Spec §6 frames 5d as a decomposition whose hook "consumes 5b," implicitly assuming 5b already cleaned the data path. It does not — the section self-fetches — so wiring it to a hook (and removing the raw fetch/cache) is in fact *required* to satisfy the §6 "reading from hooks" Done-when, making this expansion necessary rather than gratuitous. The plan correctly flags it for review (self-review note (b), Task N+2 Step 5). Recorded only so the spec-vs-plan delta is explicit: the spec's per-section template silently assumed a clean 5b data layer that does not exist for this section, and the plan absorbs the missed migration. Consider a one-line amendment to spec §6 (or a `TD`/master-plan delta) noting that 5d–5h each also complete 5b's per-section read migration, since §9 delta wording and memory indicate the page-rewire was descoped from 5b.

### [Low] Prerequisite currently unmet on `master`; plan is correctly gated but not yet executable

**Location:** "Prerequisite (hard)" block + Task 0 Step 2.

`IntelligenceTab.tsx` is absent on `master` (verified) — 5c is not merged — so Task 0 Step 2 would STOP today, exactly as designed. This is the plan working as intended, not a defect; flagged so the orchestrator does not dispatch 5d before 5c lands. Note also that the hard prerequisite is partly conservative: 5d's actual file-level work (relocate, dead-block delete, hook, extractions) does not strictly require `IntelligenceTab` to exist — the plan even hedges Task 1's importer as "`MarketIntelligenceSections.tsx` and/or `IntelligenceTab.tsx`." The real reason to gate on 5c is the data-path-rewire risk in the finding above, not the renderer identity; stating that explicitly would make the prerequisite's purpose clearer than "operates on the section as rendered by the 5c-created IntelligenceTab."

### [Low] Task N+1's "MarketEntry-exclusive vs. shared" field determination is heuristic, but the type checker is an adequate net

**Location:** Task N+1 Step 1 ("A field is **MarketEntry-exclusive** only if no other section reads it … When in doubt, leave the field").

Deciding which `MarketIntelligenceTabProps` fields are safe to remove is genuinely error-prone, and the four sibling sections are undecomposed and not deeply exercised by `journeys/04`. The saving grace (worth stating in the plan) is that `tsc --noEmit` is a hard regression signal here: if a removed field is still referenced by a sibling section, typecheck fails at Task N+1 Step 4. So the "when in doubt, leave it" heuristic plus tsc is sufficient — but the plan should name tsc as the guard so the executor does not over-rely on grep/judgement. Low because the mechanism already catches the failure mode; it's a clarity gap, not a coverage gap.

### [Nit] Heavy embedded line-number specificity risks literal-trust by the executor

**Location:** Throughout Task 0 Step 4 and Tasks 2/4 (~50 anchors: `~2045`, `~2120`, `~2329`, `~3411`, `~2607`, etc.).

The plan embeds ~50 specific line numbers that it correctly flags as pre-5a anchors that will shift, with Task 0 mandated to re-derive them. The risk is purely that an executing agent trusts an anchor literally (e.g. deletes "line 1 through 1970") rather than re-deriving from the grep output. The plan mitigates this well (Task 2 Step 1/2 derive the boundary from `grep -nvE` output, not the literal number). No change strictly required; consider prefixing the densest anchor lists with "(re-derive — do not delete by literal line number)" to harden against literal use. Verified the anchors are in fact accurate against the current file (first live import at 1971, single-layer component at 2044), so the drift risk is latent, not present.
