---
synthesizes_review: docs/reviews/38-signals-cta-design-spec-review-2-glm-5.2.md
artifact: specs/38-signals-cta-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-19
round: 2
---

## Round Recommendation

maybe

Reason: All 7 round-2 findings agreed and revised, but one High landed in the round-1-introduced queue mechanism (now refined) and one Medium carries an unresolved operator-judgment item (TD-FE-73 live-capture source) — the operator should weigh a quick round 3 vs. proceeding.

## Agreed Findings

All findings verified against source (the `ArtifactsPage` listener/`filteredArtefacts` folder filter, `index.ts` barrel, `useSignalLeadMap.refresh`) before agreeing — none accepted on assertion.

- **[High] Queue drain-on-mount filters out a foldered briefing → invisible on arrival.** Verified: the live `addArtefact` listener prepends **and** `setActiveFolder(folder)` **and** `setExpandedArtefact(id)`; `filteredArtefacts` returns only `!artefact.folder` items at root, so the `folder: "Signal Briefings"` briefing is hidden unless its folder is active. A bare "prepend on drain" re-breaks the regression. **Revision:** §5 step 3 — the drain mirrors the listener exactly (prepend + open the queued item's folder + expand it), and drains **once** (clears the queue; no re-delivery, so no dedup needed). The delivery test asserts **rendered DOM visibility through the folder filter**, not array membership.

- **[Medium] "Land reliably" / "lost on reload" mis-state the retention boundary.** Verified: `ArtifactsPage` holds its list in `useState(mockArtefacts)`, discarded on unmount; the queue drains once. A delivered briefing is visible only on the first continuous mount after the save — navigate away and back (same session, no reload) and it is gone. **Revision:** scope "reliably" to *delivery* only in the Goal; restate the retention limit as "lost on navigating away from `/artifacts` (unmount), not merely on reload" in Out of Scope and TD (a); ensure the toast copy doesn't imply a durable entry.

- **[Medium] Boundary inconsistency — barrel-strict on `enqueueArtefact`, silent on `generateAndDownloadPDF` + `ArtefactItem`.** Verified: `index.ts` exports only `artifactsRoutes`; `SignalsPage` consumes all three artefacts-side symbols, and the spec only routes one through the barrel — the other two would be deep-imports that violate the `import-x` no-internal-modules rule the spec champions. **Revision:** §5 + Component Changes — re-export **all three** (`enqueueArtefact`, `generateAndDownloadPDF`, the `ArtefactItem` type) through `features/artifacts/index.ts`; signals imports only from the barrel.

- **[Medium] PDF escaping covers structural breakers but not non-ASCII mojibake.** Verified: `createSimplePDF` writes into Helvetica (WinAnsi) literals with no encoding handling; LLM free-text routinely contains em/en-dashes, smart quotes, and bullets that mojibake even after `()\\` escaping. **Revision:** fold the common typographic offenders to ASCII (em/en-dash → `-`, smart quotes → `'`/`"`, bullet → `-`) as part of the in-scope escaping; record residual non-ASCII (e.g. accented company names) as an accepted limitation in the deferred PDF-generator TD.

- **[Medium] In-scope TD-FE-73 tightening couples to the feature's own fallbacks + has an external data dependency.** Verified against `contracts.ts:9-15` and the mapping logic: the feature *relies* on `company`/`why` `.default("")` and `relevance` `.catch("low")`; naively "dropping the guards" would change `company`/`why` to `string | undefined` (breaking `company || "Unknown company"` / the omit-empty-`why` logic) and make one odd lead throw an **org-wide** parse error (every card's leads section errors). **Revision (clarify the operator's "fully tighten" decision):** "fully tighten" = reconcile the schema to the *captured live shape* — drop `.passthrough()` on shapes that prove stable, add fields the live response actually returns, tighten always-present fields — **while keeping** the `.default("")`/`.catch("low")` resilience the feature depends on (a degrade-never-throw surface). The external-capture dependency is raised as an Open Question (below).

- **[Low] Error-state "Recompute" can no-op silently.** Verified: `refresh()` catches failures to `console.warn` and, on success, calls `setQueryData` without invalidating the errored query. **Revision:** §4 + Component Changes — the recompute action shows user feedback (loading state / toast) and triggers an actual refetch/invalidate so the section transitions out of the error state on success.

- **[Low] Module-level queue not reset between tests.** **Revision:** export a `resetArtefactQueue()` (or equivalent) and use it in `beforeEach` for the queue/delivery tests so the singleton doesn't leak across files.

## Disagreed Findings

None. Every finding holds against the cited source.

## Deferred Findings

- **Residual non-ASCII in the PDF beyond the common-punctuation fold** (accented letters, non-Latin scripts in company names). Deferred into the existing PDF-generator TD as an accepted limitation; full font/encoding handling is out of scope. **Trigger:** the PDF path is prioritized, or garbled names are reported in practice.

## Severity Disagreements

None. High for finding 1 is correct (it silently defeats one of the feature's two outputs); the rest are appropriately Medium/Low.

## Open Questions

- **TD-FE-73 live-capture source (operator).** Fully tightening the contract in-branch requires capturing a real `/signal-lead-map_claude` response from a prod `(user_id, org_id)` that has signals + leads. At 0 users such an account may not exist. **Question:** is a capture source available (or can you provide a keyed account), or should the contract-tightening be a **separable task within the branch** that can slip without gating the CTA merge (the feature works on the current tolerant contract)? This is the one item that could block the branch; it is logistics, not a spec-design defect.
