---
artifact: specs/25-frontend-phase-6-mission-control-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-03
round: 1
---

## Findings

### [High] `profileIcpsExtract.ts` is not mission-control-only — §6 disposition and §12 open question both wrong

**Location:** §6 table row 2 ("`profileIcpsExtract.ts`"); §12 open question 1

The spec asks "Whether `profileIcpsExtract.ts` is genuinely mission-control-only" and §6 proposes "mission-control-local (or stays legacy, imported transitionally)." This is immediately resolvable: `customers/SuggestedICPCards.tsx` imports `fetchIcpsRowsForOrg` from it (line 60). It also imports `extractIcpsDataFromFlexibleApiResponse` at two call sites (ICPManager lines 1958/1973, MissionControl lines 644/653/662). The util has at least three consumer sites across two feature domains (mission-control, customers).

If it moves into `features/mission-control/` as "mission-control-local," Phase 7 (customers) must either deep-import (violating the index.ts-only lint introduced in stage 1) or duplicate the function. The "stays legacy, imported transitionally" option avoids the lint issue but contradicts the goal of consolidating mission-control code into the feature boundary.

**Recommendation:** Resolve the open question now: promote `profileIcpsExtract.ts` to `src/shared/` alongside `profilerAcceptedIcpDisplay.ts` in stage 2, same rationale (≥2 feature-domain consumers). Update the §6 disposition table and §5 to reflect this.

### [High] `missionProfilerSessionCache.ts` also shared with customers — §6 disposition is wrong

**Location:** §6 table row 3 ("`missionProfilerSessionCache.ts`")

The §6 disposition assigns it "mission-control-local," but `customers/SuggestedICPCards.tsx` imports from it (line 56). Same boundary violation as above: if it lands inside `features/mission-control/`, Phase 7 needs it and must deep-import or duplicate.

**Recommendation:** Either promote to `src/shared/` in stage 2 (same pattern as the other shared utils) or keep it in the legacy `@/lib/` dir transitionally (as the spec proposes for `profileIcpsExtract`). Update the §6 table to reflect the correct home and the rationale.

### [Medium] Dead code volume significantly understated (~1,569 lines, not ~1,000+)

**Location:** §1.2 "Dead code" bullet; §9 "ICPManager dead code"

ICPManager contains 1,569 lines beginning with `//` (grep count). The contiguous commented-out legacy component shadow spans lines 1–~1633 (with interspersed active code starting around line 1634). The spec's "~1,000+ LOC" understates by ~55%. This matters because stage 2's scope ("delete ICPManager's ~1k LOC") may lead an implementer to stop early, and stage 6's "confirm zero `// DEAD CODE`" gate would then catch the residual as a surprise rather than an expected artifact.

**Recommendation:** Update to "~1,500+ LOC" (or "~1,600 lines of commented-out code") for accuracy.

### [Medium] Fetch-site count is 19 (not 21) — commented-out code inflates the figure

**Location:** §1.2 "Data layer" bullet ("21 raw `fetch()` sites")

Actual active `fetch()` calls: MissionControl.tsx (4) + DataSourcesManager.tsx (12) + ICPManager.tsx (3, lines 1861/1945/1965) = **19**. The two additional hits (ICPManager lines 239/317) are inside commented-out code blocks. Counting commented-out fetches as "sites" mischaracterizes the migration surface.

**Recommendation:** State "19 active fetch sites" or "21 fetch calls (2 in commented-out dead code, deleted stage 2)" for precision.

### [Medium] Stage 1 is oversized — route registry + lint + market-research conversion + spec update + README is one checkpoint

**Location:** §7 stage 1

Stage 1 does five conceptually distinct things: (a) design and implement the per-feature route registry convention, (b) convert the market-research route as the worked example, (c) finalize the `index.ts`-only lint with its 4a probe verification, (d) update Spec 14 §8 Q16, and (e) write `src/features/README.md`. Items (a)–(c) are each non-trivial and independently verifiable. If (c) reveals lint friction (the "~95 legitimate relative/external deep imports" need manual audit), rolling back the entire stage to retry loses the route registry work.

**Recommendation:** Split into two checkpoints: 1a (route registry + market-research conversion) and 1b (lint finalization + probe verification). Both remain in the enabling-infra stage group but provide a finer rollback boundary.

### [Medium] Tab-to-component mapping is implicit — decomposition stages will need to discover it

**Location:** §7 stage 4 ("The `customer-profile` and `sources` tabs render the (to-be-decomposed) ICP and data-source subtrees")

The spec names three tabs in §1.2 (`profile` / `customer-profile` / `sources`) but never explicitly maps which tab renders which component subtree. The reader must infer: `profile` → company-profile form, `customer-profile` → ICPManager, `sources` → DataSourcesManager. This mapping is essential for stages 4–6 (each stage decomposes one subtree) and should be stated once, not left implicit.

**Recommendation:** Add a one-line mapping table in §7 stage 4 or §3, e.g. `profile → company-profile/ | customer-profile → icp/ | sources → data-sources/`.

### [Medium] `services/` directory in architecture target is unexplained and unprecedented

**Location:** §3 architecture target (`services/` — "API call layer (read endpoints)")

The Phase 5 extraction (market-research, Spec 24) does not have a `services/` layer — its hooks contain their own query functions inline. Introducing `services/` here is a structural departure that the spec does not justify. For 3 read hooks backed by straightforward fetches, an extra indirection layer may be premature.

**Recommendation:** Either (a) justify why `services/` is needed (e.g., shared request construction, future mutation reuse) or (b) follow the Phase 5 convention of inline query functions in hooks, deferring the services extraction to the mutation pass.

### [Low] `npm run verify` referenced but not defined in the spec or known project scripts

**Location:** §8 "Run `npm run verify` as the inner loop between stages"

The spec references `npm run verify` as a faster inner-loop alternative to the full `npm run preflight`, but does not confirm this script exists or define what it runs. If it doesn't exist yet, stage 1 should create it; if it does, a brief note of its composition would help the plan author.

**Recommendation:** Confirm `verify` exists in `package.json` and state its composition, or add "create `npm run verify` script" to stage 1 scope.

### [Low] `README.md` is both scaffolded (stage 2) and written (stage 6) — ambiguity about when it's real

**Location:** §7 stage 2 ("Scaffold `features/mission-control/` (`types.ts`/`index.ts`/`README.md`)") vs. stage 6 ("write `README.md`")

Stage 2 scaffolds `README.md` and stage 6 "writes" it. Is the stage-2 version a placeholder? If so, the plan should say so. If not, stage 6 should say "update `README.md`" to indicate it's incremental.

**Recommendation:** Clarify: stage 2 creates a minimal placeholder (`# mission-control`); stage 6 finalizes it with the full public-surface + architecture documentation.

### [Low] DoD item 6's "zero stray `// DEAD CODE`/annotation markers" may be too broad

**Location:** §10 item 6

The dead-code sweep targets ICPManager, but DoD item 6 says "zero stray `// DEAD CODE`/annotation markers" without scoping to ICPManager. MissionControl.tsx and DataSourcesManager.tsx may contain unrelated `// DEAD CODE` annotations from earlier cleanup passes. This could be an impossible bar or require a scope expansion not accounted for in any stage.

**Recommendation:** Scope to "ICPManager has zero commented-out legacy blocks" or, if the broader sweep is intended, add it to stage 2 scope explicitly.

### [Nit] Endpoint paths inconsistent in §4.1 table

**Location:** §4.1 table ("Endpoint" column)

The three endpoints use inconsistent prefix conventions: `/api/customer_profile`, `/leads/stream/status`, `/api/profile/company`. The `/leads/` path lacks the `/api/` prefix present in the other two. This is likely accurate (Vite proxy strips/rewrites paths), but a brief note confirming these are the paths as they appear in the frontend `fetch()` calls would prevent confusion during plan execution.

### [Nit] "Phase 4a probe" referenced without definition

**Location:** §7 stage 1 ("verify the 4a probe")

The term "4a probe" is not defined in this spec. It presumably refers to a lint-verification test case from Phase 4a or Spec 14 §8, but a plan author unfamiliar with that history would need to cross-reference. A one-sentence inline definition would improve self-containedness.
