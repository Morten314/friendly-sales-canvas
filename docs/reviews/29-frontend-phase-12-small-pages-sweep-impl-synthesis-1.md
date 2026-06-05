---
synthesizes_review: docs/reviews/29-frontend-phase-12-small-pages-sweep-impl-review-1.md
artifact: worktree-phase-12-small-pages-sweep
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 1
---

## Round Recommendation

no

Reason: No Critical/High. Both Mediums reduce to Low — F1 is a behavior-preserving, documented deviation formally waived in this synthesis; F2 is a no-op perf pattern deferred under the pre-launch velocity posture. Every other finding is pre-existing behavior moved verbatim and frozen by Spec 29 §2.3 — changing it would violate Phase 12's parity contract.

## Agreed Findings

- **F1 (Medium) — `FolderGrid` takes an `artefacts` prop beyond Plan Task 11 / Spec §4's three props.** Agree it is a real interface deviation. Verified: the count expression `artefacts.filter((a) => a.folder === folder).length` was inline in the monolith (original `Artifacts.tsx:663`); lifting it into the component needs the array, so the 4th prop preserves behavior with no added complexity. No code change. The reviewer asked that material interface changes be "explicitly waived in a synthesis before merge" — **this synthesis is that waiver.** It is already documented in `features/artifacts/README.md:16` and the FolderGrid commit body. Note: amending Spec 29 itself is explicitly disallowed (CLAUDE.md — specs are a frozen record of intent, not post-merge truth), so the waiver-in-synthesis + README note is the correct mechanism. (Severity: Low — see below.)
- **F3 (Low) — `InsightsPage` has no `usePageTitle`.** Agree; accurate. No action — pre-existing omission preserved verbatim (Spec §3.1 calls it out; §2.3 freezes it). The render test correctly avoids asserting `document.title`.
- **F4 (Low) — `ReportsPage` effect closes over `isChatOpen` with `[isChatOpen]` dep.** Agree; accurate. Verified the relocation commit (`0f246e8`) is export-rename-only — the effect is pre-existing verbatim. No action (frozen §2.3); same untyped-`window`-event class as TD-FE-48.
- **F5 (Low) — `artefactPdf.ts` emits structurally invalid PDF (fake xref offsets, fixed `/Length 2000`).** Agree; accurate. No action — moved verbatim; the unit test validates the real contract (`%PDF` prefix + length). Falls under TD-FE-49 (mock/placeholder surfaces); real PDF generation is a when-backend-exists concern.
- **F6 (Low) — `phase12-routes.test.ts` reads React element internals (`.props.path`).** Agree; brittle but the accepted pattern for missing-spread detection. No action — Plan Task 14 Step 2 explicitly acknowledged the tradeoff and gave a fallback.
- **F8 (Nit) — `mockArtefacts.ts` "Mock data for demonstration" comment.** Agree; pre-existing comment moved verbatim. No action (frozen).
- **F9 (Nit) — `getTypeIcon` `default` case suppresses exhaustiveness.** Agree; pre-existing verbatim. No action — removing it would be a behavior/structure change outside the parity mandate.
- **F10 (Nit) — `ReportsPage` `console.log` debug statements.** Agree; pre-existing verbatim (confirmed in `0f246e8`). No action — §2.3 frozen; codebase-wide debug-noise cleanup is out of Phase 12's scope.
- **F7 (Nit) — `types.ts` comment "moved verbatim" vs plan's "cut verbatim".** Agree it is a wording mismatch; no action — "moved verbatim" accurately describes what the commit did and has zero functional impact; not worth a commit.

## Disagreed Findings

None. Every finding is factually accurate against the code.

## Deferred Findings

- **F2 (Medium) — `ArtefactStats` runs four `.filter()` passes per render.** Agree the pattern exists; defer. The count expressions were moved **verbatim** per Plan Task 10 ("move the expressions verbatim"); introducing `useMemo`/precomputed counts would add an optimization not present in the original — a parity deviation — for zero practical gain at 3 mock items, 0 users (pre-launch velocity posture, YAGNI). **Trigger:** when Artefacts gets real data (same trigger as TD-FE-49's "wire to real endpoints"), compute counts once at that point. No code change this round.

## Severity Disagreements

- **F1 — agree finding, Low not Medium.** The substantive change is a single behavior-preserving prop, fully documented in the README and commit body. The only "Medium" aspect is process (no formal amendment), which this synthesis resolves. No functional or correctness risk.
- **F2 — agree finding, Low not Medium.** Four `.filter()` calls over a 3-item mock array is a no-op in practice and is faithful to the plan's verbatim mandate. It only becomes relevant under the TD-FE-49 trigger.

## Open Questions

- **F1 process note for the integrator.** The FolderGrid `artefacts`-prop deviation is waived here (synthesis) + recorded in the feature README, **not** by editing Spec 29 (which CLAUDE.md treats as a frozen record of intent). If the team's convention instead expects a post-merge Spec 14 / Spec 29 amendment for interface deviations, flag it at merge; otherwise the README + this synthesis are the durable record.
