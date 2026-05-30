---
artifact: specs/24-frontend-phase-5-market-research-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Findings

### [High] Leaving-component strategy contradicts master spec's explicit instruction

**Location:** §1.3.5 ("Components that belong to other features ride into `features/market-research/` during 5a with handoff annotations"), §3 5a actions ("Leaving components (§7) move in as-is"), §7 table

The master spec (line 396) explicitly directs: "Components identified as not belonging in market-research … **stay in their current pre-extraction location** (under `src/components/<area>/`)." This spec does the opposite — moving them into `features/market-research/components/` with annotations.

The contradiction has a root cause: the leaving components (StrategistWorkspace, ScoutChatPanel, lead-stream/*, etc.) currently live *inside* `src/components/market-research/` — the very directory being vacated. The master spec's instruction assumed leaving components lived outside the extraction boundary. The child spec's approach (move-in-with-annotations) is arguably the only practical option, but the spec doesn't acknowledge the deviation or explain the reasoning. A master-plan delta (§9) should record this as an intentional override with rationale, not just a sub-split deviation.

**Recommendation:** Add an explicit §9 amendment noting the contradiction, the root cause (components are co-located inside the extraction boundary), and why the override is safe (annotations make the target explicit; claiming phases read this table before planning).

---

### [High] 9 sub-phases creates heavy process overhead; batch opportunity unexplored

**Location:** §1.4 (5a–5i table), §10 ("each `24a`…`24i` is its own plan + review + impl + merge")

The master spec sketched 3 sub-phases (5a/5b/5c); this spec expands to 9. Each triggers a full adversarial cycle (spec→plan→impl→review→merge) with a human checkpoint at every gate (§10). That's 9 human approvals, 9 plan documents, 9 review rounds minimum.

The five section-decomposition sub-phases (5d–5h) are structurally identical tasks: break a large section component into single-purpose files, convert props to hooks, add Vitest tests. Batching at least some of these (e.g., 5d = largest two, 5e = remaining three) would halve the process overhead while preserving per-section revert granularity (you revert the batch, not individual sections — but revert is cheap when the batch is small).

**Recommendation:** The spec should either (a) justify why per-section sub-phases are necessary despite the overhead (e.g., agent-context pressure on the 3,872-LOC MarketEntry makes it qualitatively different from the 1,661-LOC MarketSize), or (b) propose a batching strategy with a per-section revert escape hatch. The current presentation treats the decision as already made without analysis.

---

### [Medium] `MarketResearchContext` introduced without architectural guidance

**Location:** §5 ("transient cross-section coordination → a small `MarketResearchContext` (feature-local)")

This is the first React Context in the feature-extraction pattern. It sets precedent for Phases 6–12. The spec provides no guidance beyond "small" and "feature-local":

- What categories of state belong here vs URL params vs local `useState`?
- What's the anticipated consumer surface (all 5 sections? tab containers only?)?
- Is there a "context vs colocation" decision framework, or is it per-feature judgment?

The deferral to the 5c plan (§13) is appropriate for the exact shape, but the *design principle* should be in the spec — it's a cross-phase convention, not a 5c-internal detail.

**Recommendation:** Add a one-paragraph "Context placement criteria" decision (e.g., "Context holds state that (a) must be shared across ≥2 sections, (b) is not derivable from URL params, and (c) is not server state [which belongs in TanStack]. Everything else stays local."). This is the kind of precedent that compounds across 7 remaining feature phases.

---

### [Medium] No enumeration of the 9 fetch endpoints or mapping to service functions

**Location:** §1.2 ("9 raw `fetch()` calls"), §4 ("services/ — one fetch fn per endpoint"), §13 ("deferred to sub-phase plans")

The spec highlights the data layer as the "gnarliest in the app" and 5b as the critical enabler for all subsequent decomposition. Yet it provides no preliminary endpoint list — not even endpoint names, HTTP methods, or which page sections consume them. The §13 deferral to the 5b plan means the plan writer must discover this from scratch by reading all 7,013 LOC of the page plus the 33 component files.

Even a rough mapping (e.g., "3 fetches for market-intelligence data, 2 for competitor analysis, 1 for trends, 3 for lead-stream operations") would dramatically accelerate 5b planning and let reviewers sanity-check the service-layer design.

**Recommendation:** Add a preliminary endpoint inventory table (endpoint path, method, consuming section, approximate response shape source) as an appendix or §4 subsection. Mark it as "to be verified live per the polyglot rule" — the verification is a 5b action, but the *inventory* is a spec-level concern.

---

### [Medium] No performance baseline or regression budget for the data-layer swap

**Location:** §4, §8, §12

5b replaces a hand-rolled localStorage cache (persistent across reloads, zero network cost on re-visit) with TanStack Query memory-only cache (re-fetch on mount/reload, subject to the 30/min rate limiter). §12 R7 acknowledges the reload re-fetch risk but treats it as "accepted." The spec doesn't establish:

- Current average time-to-interactive for the market-research page
- Acceptable regression threshold for initial render after the data-layer swap
- Expected additional API calls per session (hard number, not just "more")
- Whether the 30/min limiter is sufficient for typical usage patterns with memory-only cache

The `bundle:check advisory` in preflight is bundle-level, not feature-level, so it won't catch per-feature regressions.

**Recommendation:** Add a "Performance budget" subsection under §4 or §12 with at least: (a) baseline measurements (or a measurement step in 5b), (b) acceptable regression bounds, and (c) a trigger for revisiting the memory-only decision.

---

### [Medium] Phase 13 boundary assertion is premature and overreaching

**Location:** §9.4 ("Phase 13's market-research pass therefore narrows to verification + cross-feature dedup + codemod extraction, not first-time decomposition")

Phase 13 is 8 phases away. The quality of 5d–5h decomposition is unknown — section components may emerge with internal patterns that Phase 13's codemod extraction can't handle without re-decomposing. Asserting Phase 13's scope from Phase 5 is a forward commitment that isn't warranted.

**Recommendation:** Soften to a recommendation: "Phase 13 *should expect* to narrow its market-research pass to verification + cross-feature dedup, assuming 5d–5h decomposition quality meets Phase 13's standards. Phase 13 spec re-evaluates."

---

### [Medium] `index.ts` public surface is entirely unspecified

**Location:** §2.2 ("The feature's `index.ts` exposes nothing until 5i decides the genuine public surface"), §7

The spec states that signals (Phase 8) consumes market-research output, making the public surface "real." But there's no draft surface, no candidate list, and no constraints. The entire decision is deferred to 5i (the *last* sub-phase), which means the feature will have been built (5a–5h) without any public-surface design intent.

This is the opposite of API-first design. The risk is that 5i discovers the public surface requires internal reorganization that should have been planned earlier.

**Recommendation:** Add a §2.2.1 "Draft public surface" with candidate exports (types, hooks, components) marked as "draft — validated in 5i." This gives 5a–5h a structural target without committing to it.

---

### [Low] No verification that `MarketResearch_clean.tsx` duplicate is gone

**Location:** §1.2, §1.5

The master spec (line 406) explicitly directs: "Phase 5 spec should verify [MarketResearch_clean.tsx removal] before extraction." This spec doesn't mention it. I verified the file is absent, but the spec should have explicitly confirmed this rather than leaving it to chance.

**Recommendation:** Add a one-line note in §1.2 or §1.5: "Verified: `MarketResearch_clean.tsx` duplicate removed (was a Phase 1 target)."

---

### [Low] `contracts.ts` vs `contracts/` directory convention departure unnoted

**Location:** §2.1 (tree shows `contracts.ts`), §1.3.3

Phase 3 (Spec 20) established per-domain `contracts/` directories under `src/shared/api/contracts/`. This spec uses a single `contracts.ts` file at the feature root. The difference is reasonable for a feature-local contract (fewer schemas, no need for a directory), but the departure from the Phase 3 convention isn't noted. Future plan writers might wonder which pattern to follow.

**Recommendation:** Add a brief note in §1.3.3 or §2.1 explaining why a single file suffices (feature-local scope, fewer schemas than the shared contracts directory).

---

### [Low] MSW mock coverage for market-research endpoints not confirmed

**Location:** §8 ("MSW backs hook tests"), §1.2

The Phase 0b test harness is mentioned as existing infrastructure. The spec says `e2e/fixtures/api-mocks.ts` + helpers exist. But it doesn't confirm whether the existing mocks cover the 9 market-research fetch endpoints. If they don't, 5b needs to create them — and that's non-trivial work that isn't budgeted.

**Recommendation:** Add a 5b prerequisite: "Confirm/extend MSW handlers for the 9 market-research endpoints in the Phase 0b harness."

---

### [Low] Branch strategy doesn't address long-lived feature branch conflicts

**Location:** §10 ("Branch: `phase-5-market-research` off `master`, in the main repo")

A 9-sub-phase feature branch may live for days to weeks. During that time, `sync.sh` merges and other work may land on `master`. The spec doesn't discuss rebase/merge strategy for keeping `phase-5-market-research` current with `master`, or conflict resolution expectations.

**Recommendation:** Add a one-liner: "Rebase onto `master` before each sub-phase merge to minimize drift; resolve conflicts in the sub-phase branch."

---

### [Low] Date 2026-05-30 is one day ahead of today

**Location:** Header ("Date: 2026-05-30"), §1.2 ("measured 2026-05-30")

Today is 2026-05-29. The spec's date and measurement date are tomorrow. This is likely a forward-dating convention (the spec is "current as of May 30") but could confuse readers checking file mtimes against the "measured" claim.

**Recommendation:** Either use today's date or add a clarifying note that the measurement date is aspirational/next-working-day.

---

### [Nit] "Leaving components" term not formally defined on first use

**Location:** §1.3.5 (first use), then used throughout

The term is clear from context but a one-line parenthetical on first use ("components that will leave market-research for other features in later phases") would help standalone readability.

---

### [Nit] §7 handoff table LOC counts lack the §1.2 point-in-time disclaimer

**Location:** §7 table, §1.2 ("LOC are a point-in-time anchor (2026-05-30). Sub-phase plans re-measure from their own start point.")

§1.2 has the disclaimer but the §7 table doesn't reference it. Minor consistency issue.
