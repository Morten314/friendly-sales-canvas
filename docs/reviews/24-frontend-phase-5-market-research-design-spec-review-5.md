---
artifact: specs/24-frontend-phase-5-market-research-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-31
round: 5
---

## Context

Round 5 review of a spec that has been through 4 prior review rounds and two mid-execution corrections (5b descope via TD-FE-19, 5c R1 escape hatch ×2). Sub-phases 5a and 5b have shipped; this review covers the spec as a whole in its current reconciled state, with particular attention to the round-5 amendments (§4 amendment, §5 rewrite, §9 deltas 7–8) and their integration into the body text.

## Findings

### [High] Delta-superceded body text not updated — visual-regression references contradict §9 delta 6

**Location:** §12 R4, §6 "Done when" (both instances), §3 "Done when"

§9 delta 6 declares "This supersedes every 'visual' / 'visual regression' parity-guard assertion in this spec" and lists specific sections. But the body text at R4 ("visual regression at 2% between every sub-phase"), §6 "Done when" ("E2E + visual + preflight green"), and §3 "Done when" were never actually edited to match. A plan-writer reading §6 in isolation will see "visual" and assume pixel-VR is a gate. The "supersedes" mechanism relies on the reader having read and internalized delta 6 — an unreasonable expectation for a 322-line spec consumed by multiple agents across months.

**Fix:** Update R4, §3 "Done when", and §6 "Done when" to replace unqualified "visual" with the actual guard ("behavioral E2E `journeys/04` + Vitest; no MR pixel-VR per §9 delta 6"). Alternatively, inline the delta 6 resolution into each location and mark the delta as historical.

### [High] `useMarketResearchData()` — key abstraction not in architecture tree, relationship to 5b hooks unclear

**Location:** §2.1, §5 "Done when", §9 delta 8

Delta 8 introduces `useMarketResearchData()` as a structurally significant hook (the shell calls it once, threads slices to all tabs; it holds all six data states + fetch/cache/cascade/refresh + per-section edit/expand state + cross-tab `editHistory`). This hook is the linchpin connecting 5c's structural relocation to 5d–5h's TanStack conversion. Yet it does not appear in the §2.1 feature tree (which shows only a generic `hooks/` directory), and its relationship to the 5b hooks (`useResearchComponent`/`useRegenerateResearch`) is mentioned only in a parenthetical aside in §9 delta 8 ("`useMarketResearchData` is distinct from 5b's `useMarketResearch`/`useResearchComponent` (the future TanStack target whose hooks 5d–5h adopt inside it)").

A plan-writer for 5c or 5d needs to understand: (a) `useMarketResearchData()` wraps the raw-fetch/`useState` machinery (no TanStack), (b) 5d–5h progressively convert its internals to call the 5b TanStack hooks, (c) at phase close the hook delegates entirely to TanStack and the raw-fetch paths are gone. This transition model is not documented anywhere as a first-class architectural concept.

**Fix:** Add `useMarketResearchData()` to §2.1 (at minimum as a named entry under `hooks/`). Add a short paragraph to §5 or §6 explaining the hook's role as the conversion target: it starts as a raw-fetch/useState wrapper in 5c and 5d–5h progressively replace its internals with the 5b TanStack hooks until raw fetch is eliminated.

### [Medium] §5 "Done when" is an unparseable monosentence — needs checklist form

**Location:** §5, "Done when" paragraph (lines 187–188)

The "Done when" for 5c — the most complex sub-phase — is a single ~200-word sentence with 5 parentheticals, 2 em-dash clauses, and 4 cross-references (§4 amendment, §4.1, TD-FE-19, §7). Compare this to §3 and §4, where "Done when" is a readable paragraph with clear gates. For the sub-phase most likely to produce plan-writer confusion, the "Done when" should be the clearest section, not the densest.

**Fix:** Rewrite as a bulleted checklist, one gate per bullet, no parentheticals longer than a clause. Example:

- Page shell is a thin route-wire + tab router
- `useMarketResearchData()` holds the raw-fetch/`useState` machinery; shell holds no fetch-result/server `useState` directly
- Lead-stream tab extracted to `src/components/market-research/lead-stream/`, imports no feature hook
- Cross-tab coordination injected as shell-owned callback props
- `SafeMarketIntelligenceTab` replaced by `<FeatureErrorBoundary>` with prop-sanitization preserved (or removal documented)
- Props-vs-context decision for `scoutResearchContext`/`scoutMode` pair recorded
- `journeys/04` + preflight green

### [Medium] Spec reads as patched changelog, not integrated document — dual retrospective/prospective role

**Location:** Structural — §4 amendment, §5 rewrite, §9 deltas 7–8

The spec has been through 5 review rounds with significant mid-execution corrections. The round-5 amendments are integrated via inline strikeouts, parenthetical asides ("DESCOPED during 5b execution"), block-quote amendments, and delta entries in §9. This creates two problems: (1) a reader encounters forward-looking instructions peppered with retrospective corrections ("the round-1 '49' was an undercount"), requiring them to reconstruct the current intent from multiple temporal layers; (2) the spec is both a historical record and a forward-looking plan, and these two roles create tension in sections that should be purely prospective (§3, §4, §5 are partially retrospective since 5a and 5b already shipped).

This is a **structural smell**, not a content error. The information is all there and internally consistent. But a plan-writer approaching 5c for the first time must parse §5's "Done when" while mentally applying §9 deltas 7 and 8, the §4 amendment, and the R1 findings — all of which modify the §5 text in place without actually editing it.

**Fix:** For the sections governing unshipped sub-phases (5c–5i), consider a clean-rewrite pass that integrates all deltas directly into the body text, moving the historical record to §9 or an appendix. This is a one-time cost that pays forward across 7 remaining sub-phases.

### [Medium] §13 open question about route URLs is resolved but not struck through

**Location:** §13, "The exact route URL(s) + `:tab` segments as currently configured in `App.tsx` (`24a`/`24c` confirm; they stay frozen)."

§9 delta 6 already confirmed the route structure (`/your-ai-team/scout/:tab` with segments `marketintelligence`/`leadstream`/`chatwithscout`). Other resolved questions in §13 are struck through (the `Scout*` cluster question). This one should be too, or the resolved answer should be inlined.

**Fix:** Strike through and annotate "RESOLVED in 5a (§9 delta 6): `/your-ai-team/scout/:tab` with segments `marketintelligence`/`leadstream`/`chatwithscout`."

### [Medium] "Agent context" as decomposition target is undefined and unmeasurable

**Location:** §6, "No hard LOC cap (master §6) — target single-purpose files that fit in agent context."

"Agent context" is an unbounded, implementation-dependent concept. An LLM agent's context window varies by model (128k tokens for some, 200k for others) and is consumed by the system prompt, conversation history, and other open files. A plan-writer has no concrete guidance on whether a 200-LOC file or a 500-LOC file is "too big." The master spec's §6 may provide more detail, but the instruction here should be self-contained enough to be actionable.

**Fix:** Either (a) add a concrete heuristic ("target files under 300 LOC; if a section naturally exceeds this, split by responsibility, not line count") or (b) explicitly defer the cap to the per-section plan ("each 5d–5h plan proposes a file breakdown and justifies it by single-responsibility; the plan reviewer assesses fitness"). Option (b) is more honest.

### [Low] §4.1 line-number anchors are prominently displayed but immediately invalidated by 5a

**Location:** §4.1, "Call sites (`MarketResearch.tsx`)" table with line numbers 2115, 2820, etc.

The footnote says "Line/site numbers are a pre-5a anchor — once 5a relocates the file they shift, so 5b re-identifies sites by searching `fetch(` + `buildApiUrl`." But 5a has already shipped, making these line numbers dead information that takes up prominent table real estate. A plan-writer for 5b (which already shipped) no longer needs them, and the table's primary value — the endpoint/purpose mapping — is obscured by the line-number focus.

**Fix:** Replace line numbers with descriptive call-site labels ("load latest research", "generate research", "refresh competitor data", etc.) and demote the historical line numbers to a footnote or remove them. Since 5b already shipped, this table is historical; consider marking it as such.

### [Low] §7 `knip --strict` clean gate doesn't account for knip's dead-file blind spot

**Location:** §7 "Done when", §11 DoD item 5

The spec correctly identifies that `knip --strict` won't catch the 8 dead files because `knip.json`'s `entry` glob makes every `src/**` file a production entry (§7 dead-code note). Yet §7's "Done when" and §11 DoD item 5 both say "`knip --strict` clean" as a gate. The gate will pass even if dead files remain (because knip can't see them). The real dead-file sweep is the manual "5i sweep removes them" instruction in §7.

**Fix:** Either (a) add a separate "zero `// DEAD CODE` annotations remain in the feature" gate to §7 "Done when" and §11 DoD, or (b) qualify the knip gate: "`knip --strict` clean (note: does not flag dead files per §7 knip limitation; dead-file removal is verified by absence of `// DEAD CODE` annotations)."

### [Low] Sub-phase numbering overloaded — "5a" means both the sub-phase and its plan number "24a"

**Location:** §1.4, throughout

The spec uses "5a" to mean both the sub-phase (Phase 5, step a) and the plan number (24a). This is unambiguous in context but creates friction when the spec says "5c" and the plan is "24c" — two different identifiers for the same unit of work. The mapping is explicit in §1.4, but it could bite a plan-writer who searches for "5c" in a document that uses "24c".

**Fix:** Low priority. If a clean-rewrite pass happens (see Medium finding above), standardize on one identifier per sub-phase (either 5a–5i or 24a–24i, not both).

### [Nit] §1.2 `useState` audit trail is review-level detail in spec body

**Location:** §1.2, "≈76 distinct `useState` hooks — 88 `useState(` tokens incl. the import line + setter-only `const [, setX]` forms; `24c` Task-0 count; the round-1 '49' was an undercount"

The parenthetical explaining the exact count methodology (76 vs 88, undercount history) belongs in a review document, not the spec. The spec only needs "≈76 distinct `useState` hooks" as a starting-state anchor.

**Fix:** Trim to "≈76 distinct `useState` hooks" and move the counting methodology to a review or the synthesis document.

### [Nit] Header mentions rounds 1–3 but not round 4

**Location:** Line 3, "rounds 1–3 reviews … synthesized at …-spec-synthesis-{1,2,3}.md; round 5 reconciles …"

Round 4 exists (confirmed by glob) but is not mentioned in the header's review-history summary. Either round 4 was a silent revision or the header should acknowledge it.

**Fix:** Add "; round 4 [description]" to the header or explain the gap.

### [Nit] §14 companion-documents entry uses brace-expansion shorthand for filenames

**Location:** §14, "`24-frontend-phase-5-market-research-design-spec-{review,synthesis}-{1,2,3}.md`"

This is a shell brace-expansion notation, not a standard filename. It's technically correct and compact, but could confuse a reader unfamiliar with the convention (they might literally search for a file named with curly braces).

**Fix:** Low priority. Could expand to explicit filenames or add a parenthetical "(6 files: review-1 through review-3 and synthesis-1 through synthesis-3)".

### [Nit] Context placement criteria may be over-formalized for the problem

**Location:** §5, "Context placement criteria" block

The three criteria (shared across ≥2 sections, not URL-derivable, not server state) plus the hoist-vs-context decision tree effectively formalize React's standard "lift state up" pattern. The formalization is justified by the precedent-setting goal (Phases 6–12 will reference it), but the criteria are not falsifiable in a useful way — "shared across ≥2 sections" is trivially checkable, but "not server state" requires knowing what TanStack will own, which may not be clear at 5c planning time.

**Fix:** Acceptable as-is for a precedent-setting spec. If future phases find the criteria ambiguous in practice, revise then.
