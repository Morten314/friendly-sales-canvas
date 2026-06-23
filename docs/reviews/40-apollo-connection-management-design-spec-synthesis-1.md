---
synthesizes_review: docs/reviews/40-apollo-connection-management-design-spec-review-1-glm-5.2.md
artifact: specs/40-apollo-connection-management-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-23
round: 1
---

## Round Recommendation

no

Reason: All six findings agreed and revised in-place; the technical core was independently verified sound, no Critical/High remains, and the edits added no new design surface.

## Agreed Findings

- **[High] Broken/unsourceable reference citation.** Verified: `docs/temp/apollo-integration-design-spec.md` is gone from disk (it existed in the working tree when first supplied — and was read — but was never committed and has since been deleted), and `specs/2026-06-04-apollo-integration-design.md` does **not** contain the §4 gear/`••••••••3a9f`/Update-key/Disconnect content (grep returns nothing). So the citation is dead and the "same design Spec 35 cited" equivalence is false. Revised: reframed the opening blockquote and §12 (retitled *"Relationship to the product design"*) to drop the dead `docs/temp/...` path and the false equivalence, label the product design as an **uncommitted working-tree reference (lineage only)**, and ground the no-masked-prefill rationale on the verified "`GET /status` returns no key material" fact (§3.3). §13 Q1 left as-is (already self-contained).
- **[Medium] Disconnect-during-running consequence omitted.** Verified: `_run_discover` reads the key once at start (`credentials.get_api_key`, `orchestrator.py:344`) and holds it in memory, so deleting the credential doc does not stop an in-flight run — it keeps spending credits/ingesting. Revised §9 to state this plainly, updated the §14 trigger note, and left an optional disconnect-dialog sentence about in-progress credit spend (default off, to preserve the product copy).
- **[Low] Tile-local state coordination under-specified.** Verified `useDiscoverStatus.ts:19,30-34` polls every 2.5s while `runId` is set and invalidates `apolloStatus` on terminal. Revised §5.3 + §6 to require clearing `runId`/`prompt` on disconnect success (mirroring `ApolloTile.tsx:61`).
- **[Low] Update-success toast wiring implied, not stated.** Revised §6 + §7 to state the tile's shared `onConnected` reads the current `modal` mode and toasts only on `"update"` (tile-side, not modal-side; the modal fires one `onConnected()` for both modes — `ApolloConnectModal.tsx:54`).
- **[Low] Transport recommendation imprecise/mis-motivated.** Verified `apiRequest(endpoint, schema, options)` is the shared primitive (`client.ts:12-22`; `apiGet`/`apiPost` build on it) and **no `apiDelete` exists**. Revised §7 to name `apiRequest(..., { method: "DELETE" })`, remove `apiDelete`, and drop the raw-fetch-precedent motivation (that precedent exists only for typed error-body parsing, which disconnect doesn't need).
- **[Low] No consolidated acceptance criteria.** Revised §10 (now *"Acceptance criteria & testing"*) with a 6-item definition-of-done block preceding the test list, so the plan/impl have a 1:1 behavior→test mapping and an exit gate.

## Disagreed Findings

None — every checkable claim was verified accurate against the code/repo. One factual nuance on the [High], which does **not** change the verdict: the review states the temp doc "does not exist in the repo at all"; it did exist in the working tree when the user first supplied it (it was read at session start, with the §4 content), but it was uncommitted and has since been deleted. The reviewer's conclusion (citation unlocatable, references broken) is therefore correct as it stands.

## Deferred Findings

None unactioned. The **underlying** run-cancellation hardening for disconnect-during-running remains out of scope (§11, unchanged) — trigger: a need to halt Apollo credit spend on disconnect. The [Medium] finding itself (document the consequence) was agreed and actioned now, not deferred.

## Severity Disagreements

None. Severities accepted as assigned (one High, one Medium, four Low).

## Open Questions

- **Provenance durability (for the user):** the product design doc that motivates the gear/Update-key/Disconnect affordances is uncommitted and now deleted. Should it be committed (e.g. into `specs/` or `docs/`) so future readers can locate it? The spec currently cites it for lineage only and stands on the verified contract regardless.
- **Disconnect dialog copy (impl-time):** whether to append "an in-progress run will finish and may consume credits" to the product design's verbatim disconnect copy — left optional in §9; resolve in the plan/impl.
