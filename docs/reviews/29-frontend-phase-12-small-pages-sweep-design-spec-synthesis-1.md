---
synthesizes_review: docs/reviews/29-frontend-phase-12-small-pages-sweep-design-spec-review-1.md
artifact: specs/29-frontend-phase-12-small-pages-sweep-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 1
---

## Round Recommendation

no

Reason: All findings were verified and agreed; each is resolved by an in-place clarification. No Critical/High remains, and no revision opened new design surface — another round would find nothing actionable.

## Agreed Findings

- **F1 (High, §4) — `folders` is not seed data.** Verified against source (`Artifacts.tsx:209`): `folders` is derived at runtime, `mockArtefacts` (`:58`) is the only seed. Revised the §4 table so `data/mockArtefacts.ts` holds `mockArtefacts` **only**, and the `ArtifactsPage.tsx` row now lists `folders` as derived state (`[...new Set(...)]`) kept in the page.
- **F2 (High, §3.1) — `usePageTitle` over-broad.** Verified: `Insights.tsx` has no `usePageTitle`. Qualified §3.1 to "calendar/reports/artifacts only (not insights)."
- **F3 (Medium, §1.3) — non-page residents omitted.** Added `useLogin.ts` (53), `useTenants.ts` (19), and their `__tests__` to §1.3 as Phase-10-owned residents, and noted Phase 11's empty-`pages/` check therefore depends on Phase 10, not Phase 12.
- **F4 (Medium, §7/§8) — `verify` vs full suite.** §8 now states `verify` = `typecheck`+`lint`+`test:changed` (incremental, not the full suite; full suite/e2e/knip/bundle run only at `preflight`); §7 cross-references it.
- **F5 (Medium, §4) — inline-JSX extractions vs named components.** Marked `ArtefactStats`/`FolderGrid` as **new** components lifted from inline JSX (props drilled), `LibraryCard` as a relocation; softened the page LOC to "loosely targeted ~200, validated after extraction."
- **F6 (Low, §3) — route template missing imports.** Added the `react-router-dom` / page / `@/features/shell` / `@/shared/components` import lines to the template.
- **F7 (Low, §1.1) — "empty `src/pages/`" misleading.** Softened to "clear `src/pages/` of its Phase-12 leaf pages … Phase 11's eventual empty-`pages/` verification."
- **F8 (Low, §7) — knip after relocation.** Added a stage-7 note that `preflight`/`knip` may surface transitional dead-code findings post-relocation; confirm-expected, not a blocker.
- **F10 (Nit, §2.2) — fragile line reference.** Replaced "Spec 14 §4 line 541" with "Spec 14 §4's Phase-11 staging rule."

## Disagreed Findings

None. Every finding held up against the source and the artifact.

## Deferred Findings

None. All agreed findings were cheap, in-scope clarifications applied this round.

## Severity Disagreements

- **F1 — Medium, not High.** Agree with the finding and fixed it. But the `folders` derivation is self-evident in the source an implementer would be reading; the worst realistic outcome is brief confusion or a redundant `folders` export, not a design flaw.
- **F2 — Low, not High.** Agree and fixed. It is an over-broad sentence with low blast radius, and TD-FE-47 already scopes correctly to calendar/reports/artifacts — a built-in corrective. Not load-bearing.
- **F3 — Low, not Medium.** Agree and added it. It has zero impact on Phase 12 execution; it is completeness context for the downstream Phase 11 gate.
- F4, F5 severities (Medium) accepted as stated. F6/F7/F8 (Low) and F10 (Nit) accepted.

## Open Questions

- **F9 (Nit, spelling) — no action.** The review confirms the `Artefacts` (component/product copy) vs `Artifacts` (filename/feature folder) split is handled correctly and intentionally (§2.3). Recorded for completeness; nothing to change.
