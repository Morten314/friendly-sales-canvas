---
artifact: specs/24-frontend-phase-5-market-research-design.md
artifact_type: spec
verdict: clean
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-30
round: 3
---

## Context

Round 3 review. Rounds 1–2 produced 21 findings total; the syntheses applied all actionable ones. This pass re-examines the spec end-to-end for residual gaps, new issues introduced by round-2 revisions, and anything the prior rounds missed. The spec is mature — two full adversarial cycles have sharpened it considerably.

## Findings

### [Medium] Shared GET fetch between intelligence and analysis tabs is an unhandled 5c edge case

**Location:** §4.1 (endpoint inventory — line 2115 GET `market-research`), §4.2 ("sites belonging to the `analysis` (lead-stream) tab are excluded from migration"), §5 (lead-stream extraction)

Synthesis-2's open questions flag this exact scenario, but the spec still doesn't address it. The GET at line 2115 fetches "latest research" — likely consumed by both the `intelligence` and `analysis` tabs (they share the same page and the same data). Under the current design:

- 5b migrates this GET into a TanStack Query hook inside the feature.
- 5c extracts the analysis/lead-stream tab out of the feature into the legacy `src/components/market-research/lead-stream/` unit.
- The extracted lead-stream unit must then either (a) import the feature's hook (legacy→feature dependency, which §4.2's revision explicitly prevents), or (b) re-fetch independently via raw `fetch`, duplicating the request and potentially producing stale data relative to the feature's TanStack cache.

If the GET is genuinely shared, neither option is clean. Option (b) means two concurrent requests for the same data with no cache coherence. Option (a) violates the stated boundary rule.

**Suggestion:** Add a §5 action or §4.2 note: "If the analysis tab shares the GET `market-research` fetch with the intelligence tab, 5c either (i) extracts the shared GET into the legacy `lead-stream/` unit (as raw fetch, duplicated — acceptable for a transitional unit), or (ii) promotes the GET service fn to `src/shared/` so both the feature and the legacy unit consume it without a feature→legacy dependency. 5c decides; the default is (i) (duplication over coupling for transitional code)."

---

### [Low] 5a includes non-mechanical work that contradicts its framing

**Location:** §3 ("mechanical, parity-preserving, zero logic change"), §7 ("5a confirms the Scout* config cluster's stay/leave per-file by tracing imports")

§3 frames 5a as purely mechanical relocation. But §7 assigns 5a a code-analysis task (trace imports on the `Scout*` config cluster to determine stay/leave) and §3 itself includes adding handoff annotations (`// HANDOFF → <feature>`) and wrapping the page in `<FeatureErrorBoundary>`. These are reasonable steps, but "zero logic change" is misleading — annotation + ErrorBoundary wrapping + import tracing are logic-adjacent.

**Suggestion:** Reframe §3's mission to "mechanical, parity-preserving, minimal logic change" or qualify: "Zero behavioral logic change; annotation and ErrorBoundary wrapping are additive, non-behavioral changes."

---

### [Low] §4.1 line-number references will drift; no drift-handling note

**Location:** §4.1 (call-site line numbers: 2115, 2483, 2820, 2948, 2981, 3252, 3480, 3759, 4088)

§1.2 has a general LOC point-in-time disclaimer, but §4.1 uses specific line numbers as structural references (which fetch site maps to which endpoint). These will shift the moment 5a moves the file (even whitespace changes renumber). A 5b plan writer relying on these numbers against the post-5a file will be misled.

**Suggestion:** Add a note to §4.1: "Line numbers are a pre-5a anchor; 5b re-identifies sites in the relocated file (search for `fetch(` + `buildApiUrl` rather than by line number)."

---

### [Low] 27 human checkpoints across the phase is high for a pre-launch MVP with 0 users

**Location:** §10 ("Human checkpoints: approve spec→plan, plan→impl, impl→merge for each sub-phase")

3 checkpoints × 9 sub-phases = 27 human gates. The spec doesn't distinguish critical checkpoints (e.g., 5b data-layer design) from mechanical ones (e.g., 5a relocation diff review). The master spec's workflow requires the full cycle per sub-phase, so this isn't a deviation — but it's worth flagging as process cost. The batching escape-hatch (§1.4) reduces this only if the plan author chooses it.

**Suggestion:** Consider noting which sub-phases warrant full review (5b, 5c) vs. which can use a lighter approval (5a mechanical, 5i finalization). This is a process suggestion, not a spec defect — defer to the operator.

---

### [Nit] §5 done-when "the feature itself has no raw fetch left" is precise but easily misread

**Location:** §5 ("Done when: … the feature itself has no raw fetch left")

The wording is technically correct — the feature's own code has no raw fetch. But the feature's `MarketResearchPage.tsx` renders the legacy lead-stream component (which carries raw fetch) via the transitional import. A reader skimming the done-when might interpret "no raw fetch" as "no raw fetch anywhere in the rendered tree."

**Suggestion:** Add "in the feature's own code" or "the feature's own modules" for emphasis.

---

### [Nit] §2.1 feature tree doesn't show section-container components

**Location:** §2.1 (tree shows `components/intelligence/market-entry/` etc. as directories)

Each section directory will contain a container component (e.g., `MarketEntrySection.tsx`) plus sub-components. The tree shows the directory but not the container. A plan writer reading §2.1 alone must infer the container exists. The §2.3 mapping table partially compensates by showing `<Section>Section.tsx → components/intelligence/<section>/`, but the tree itself is incomplete.

---

### [Nit] Round-2 resolution quality remains high

All seven round-2 findings were applied. The lead-stream data-layer exclusion (5b skips analysis-tab sites, Phase 7 migrates) is the most consequential revision — it cleanly resolves the cross-boundary hook dependency that round 1's leave-in-place flip created. The search/filter deferral to §13 with the §5 URL-vs-local constraint is well-scoped. No round-2 finding was dropped.
