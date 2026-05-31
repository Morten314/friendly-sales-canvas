---
artifact: specs/24-frontend-phase-5-market-research-design.md
artifact_type: spec
verdict: findings
reviewer_model: claude-opus-4-8
date: 2026-05-31
round: 4
---

## Context

This is a focused review (review-file round 4; spec design-round 5) of the R1-reconciliation deltas only (§1.2 counts, §4 amendment/TD-FE-19, §5 structural-only rewrite, §12 R1/R5, §13, §9 delta 7), cross-checked against the committed findings in `docs/reviews/24c-frontend-phase-5c-R1-escape-hatch-findings.md` and the live code inventory those findings rest on. Rounds 1–4 already converged the rest of the spec; I did not re-litigate settled material. The reconciliation is sound in direction (structural-only 5c, rewire distributed to 5d–5h, analysis coupling via shell-owned callbacks). The findings below are residual internal contradictions the amendment introduced by editing some passages but not their cross-referencing neighbors.

## Findings

### [High] §4 now contradicts itself: the Actions bullet still says 5b rewired the page

**Location:** §4.2 Actions, the bullet beginning "Rewire the (still-monolithic) page to consume the hooks for the **market-research-proper** sites; delete those raw `fetch` sites, the `CACHE_DURATION` cache, and the 68 localStorage refs…" — versus the new §4 "Done when (as shipped)" + amendment note immediately below it.

The round-5 amendment correctly records that the page→hooks rewire was **descoped** (page still has 9 raw `fetch` + the cache). But the §4.2 Actions bullet that *mandated* that rewire was left untouched, so §4 now asserts both "rewire the page / delete those fetch sites" (Actions) and "the rewire was NOT done here" (amendment) on the same page. A reader hitting the Actions list first will believe 5b deleted the page fetches. Fix: annotate the Actions bullet as superseded (e.g. "~~Rewire…~~ **descoped — see amendment / TD-FE-19; moved to 5c structural relocation + 5d–5h conversion**") rather than leaving it as a live instruction. Same applies to the parenthetical in §4.1's Implications ("sites belonging to the `analysis` tab are **excluded from migration**") — see next finding.

### [Medium] "analysis-tab fetch sites" framing survives in §4.1/§4.2 but the inventory found the analysis tab does zero fetching

**Location:** §4.1 Implications ("**5b also tags each site by owning tab:** sites belonging to the `analysis` (lead-stream) tab are **excluded from migration**"); §4.2 ("**The `analysis`/lead-stream tab's fetch sites are NOT migrated**"); §5 done-when ("the lead-stream tab is an annotated unit … **carrying its own raw `fetch`**"); §13 ("partition of the 9 fetch sites into market-research-proper vs lead-stream").

These all presuppose some of the page's 9 raw fetches belong to the `analysis` tab. The R1 inventory (and the new §5 "Shared-GET edge case" bullet, which now says the analysis tab "does **no** market-research fetching … data lives inside `ScoutLeadStream`") establish the opposite: **all 9 page fetches are market-research-proper; the analysis tab wrapper fetches nothing.** Any raw fetch the lead-stream surface does lives *inside* `ScoutLeadStream`, which already sits in legacy — it is not page code that 5c relocates. Consequences:
- The §13 "partition … into market-research-proper vs lead-stream" likely resolves to "9 / 0", making the §4.1/§4.2 "exclude the analysis sites" instruction vacuous.
- §5 done-when's "the lead-stream tab … **carrying its own raw `fetch`**" is inaccurate for `LeadStreamTab` itself (it renders `ScoutLeadStream` + filters + callbacks; it carries no fetch). The raw fetch it "carries" is `ScoutLeadStream`'s pre-existing internal fetching, not lifted page code.

Fix: reconcile the §4.1/§4.2 "analysis owns some of the 9" framing with the "9/0, analysis does no fetch" reality, and reword §5 done-when so "carries its own raw `fetch`" refers to `ScoutLeadStream`'s internal data access, not to `LeadStreamTab`.

### [Medium] Decision logic conflict: context-placement criteria mandate context for the scout pair, but the new bullet offers "context OR props"

**Location:** §5 — the "Cross-tab shared state" bullet ("a genuine candidate for `MarketResearchContext` (or shell-`useState` lifted and passed as props…)") and the done-when ("the `MarketResearchContext`-vs-shell-props decision … is recorded") versus the unchanged "Context placement criteria" bullet ("`MarketResearchContext` holds *only* state that is (a) shared across ≥2 … (b) not URL-derivable … (c) not server state. … If nothing meets all three, no context is created.").

The criteria bullet is written as a deterministic rule: state meeting all three → context. The round-5 bullet itself argues `scoutResearchContext`/`scoutMode` **meet all three**. By the rule as written, that mandates a context — yet the new bullet and done-when frame it as an open context-vs-props choice. Both can't be the governing logic. For a 2-consumer pair, prop-passing is the reasonable call, but then the criteria need a relief valve (e.g. "…meeting all three AND where prop-drilling spans >N levels or >2 consumers → context; otherwise lift to the nearest common owner as props"). As written, a plan author can cite the criteria to *require* a context the spec elsewhere says is optional. Pick one and make the rule self-consistent.

### [Medium] 5d–5h ownership of page raw-`fetch`/cache deletion is asserted in §4 but not assigned in §6

**Location:** §4 amendment ("As each section is extracted … the corresponding page `fetch` + cache machinery is deleted then") versus §6 "Per-section pattern" / "Done when (each)" (which describe section decomposition + hook consumption but never say the section sub-phase also deletes the page's corresponding raw-`fetch` site and its slice of the `CACHE_DURATION`/localStorage machinery).

The amendment relocates a real deliverable (removal of 9 raw fetches + the cache) into 5d–5h, but §6 — the section that actually governs those sub-phases — doesn't pick it up. As written, a 5d–5h plan author reading only §6 will decompose the section and wire its hook without knowing they also own deleting the page's now-orphaned fetch/cache code for that section. Add an explicit item to §6's per-section "Done when": "the page's raw `fetch`/cache machinery for this section is removed as the section converts to its hook," and note that 24i's zero-`fetch`/zero-`CACHE_DURATION` gate depends on it.

### [Low] §1.2 useState count is stated three loosely-reconciled ways

**Location:** §1.2 Page row — "**~70 `useState`** — 88 `useState(` tokens, ~70 distinct hooks — `24c` Task-0 count".

The Task-0 data: 88 `useState(` textual occurrences (incl. the `import { useState }` line and setter-only forms like `const [, setX] = useState`), and the name-extraction regex captured 76 destructured `[name, setX]` pairs. "~70 distinct hooks" is therefore a soft round-down that doesn't match either hard number (88 tokens, 76 named pairs). Not load-bearing, but since the round-5 edit's stated purpose is to correct the stale "49," it's worth landing on a defensible figure: e.g. "≈76 distinct `useState` hooks (88 `useState(` tokens incl. the import + setter-only forms)."

### [Low] Spec drifts into plan/implementation detail in §5

**Location:** §5 — the "(R1 finding)" bullets naming exact handlers (`handleChatWithScout`/`handleChatAboutCoverage`/`handleSendToStrategist`), the `ErrorBoundary` import path, and "`TabsContent value="trends"` is an empty `hidden` placeholder."

This is implementation-level specificity that normally belongs in the 24c plan, not the phase spec. It's defensible here because it documents *why* R1 fired and constrains the plan rewrite — but it does mix abstraction levels (a phase spec citing component-internal render structure). Consider compressing to the design-level invariant ("the real `trends` chat renders outside `TabsContent`; `TrendsTab` must lift the out-of-band block") and letting the 24c plan carry the symbol-level detail, to keep the spec re-usable as the frozen design record.

### [Nit] Status line omits round 4

**Location:** Header — "**Status:** Design — round 5 (rounds 1–3 reviews … synthesized at …-spec-synthesis-{1,2,3})".

A `…-spec-review-4.md` exists in `docs/reviews/`, so the lineage skips from round 3 to round 5 with no mention of round 4. Either fold round 4 into the cited range ("rounds 1–4") or note why round 4 isn't part of the synthesized lineage, so the provenance trail is complete.

### [Nit] `activeTab` reads `location.pathname` despite the route providing a `:tab` param — worth a one-line note

**Location:** §5 ("`activeTab` → stays URL-derived (`getActiveTabFromPath` reads `location.pathname`; **not** `useParams`)") cross-referenced with §9 delta 6 (route is `/your-ai-team/scout/:tab`).

Accurate as stated, but it documents a mild oddity (the code re-parses `location.pathname` instead of consuming the `:tab` param the router already supplies) without flagging whether 5c should leave it as-is (structural-only → yes) or normalize to `useParams`. A one-clause "5c preserves the existing `location.pathname` parsing (structural-only; `useParams` normalization is out of scope)" would pre-empt a plan-author's ambiguity.
