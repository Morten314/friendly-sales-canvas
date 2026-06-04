---
synthesizes_review: phase-6-mission-control-impl-review-1.md
artifact: worktree-phase-6-mission-control
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-04
round: 1
---

## Round Recommendation

no

Reason: No Critical/High survives synthesis — the lone High is a severity disagreement (deliberate, plan-sanctioned R1 deferral; stage-5 gate met; residual tracked as TD-FE-34/37). Every other finding is already-tracked deferred debt, disagreed (two are technically incorrect or convention-contrary), or awareness-only. A re-review round would surface nothing actionable inside Phase 6 scope.

## Agreed Findings

None fixed this round. The implementation is complete and gate-green (full serial `npm run preflight` passed); all real findings are deferred to tracked TD-FE items (see Deferred / Severity Disagreements). The one genuinely-new, not-yet-tracked finding (duplicate `mapApiData*` transforms) is recorded under Deferred with a concrete tracking action.

## Disagreed Findings

- **[Low] `LeadStreamTable` — collapse `deletingFileId` + `showLeadUpload` into one `canDelete`.** Technically incorrect — the collapse is lossy. `deletingFileId` is consumed in two places: the button-disable at `LeadStreamTable.tsx:109` (`disabled={!!deletingFileId || showLeadUpload}`) **and** a delete-in-flight loading overlay at `LeadStreamTable.tsx:45-62` (`{deletingFileId && (<overlay/>)}`). The overlay must show during an in-flight delete and must **not** show when the upload panel is merely open. A single `canDelete` boolean (`!deleting && !uploadOpen`) cannot distinguish "delete in flight → show overlay" from "upload open → no overlay". The two props encode distinct states; they are not redundant. (The reviewer also called `deletingFileId` "per-row"; it is actually used as a global in-flight flag here, but the conclusion is unchanged.)

- **[Medium] `ProfilerMergeView` not created without a spec amendment.** The implied action — amend Spec 25 §3/§7 — is contrary to the repo's frozen-record convention (CLAUDE.md: "Specs and plans are a frozen record of intent… don't update specs/plans to reflect post-merge drift; the code is authoritative"). The reviewer acknowledges this convention. The decision is already recorded in the authoritative forward location: the feature `README.md` "Decisions" section **and** the README "Profiler disposition" table, which Plan 25 §6/§23 designates as the authoritative handoff record for Phases 7 & 9. So the Phase-9 concern the reviewer raises is already addressed. No action; severity is a Nit at most and it is handled.

- **[Low] `IcpWizard` at 952 LOC.** The reviewer explicitly states "Not a decomposition miss — noted for awareness." Concur: 952 LOC is justified by the self-contained wizard design (owns the full add/edit flow — validation, region/industry/company-size/buyer-role multi-selects, and the save assembly). No action.

- **[Nit] `connectorTypes.ts` imports `type { Database }` from `lucide-react` as an icon field type.** The reviewer notes this "matches the original code… not a Phase 6 regression." A parity relocation preserves the pre-existing pattern by design. No action this phase.

## Deferred Findings

- **[Medium] Duplicate `mapApiData*` transforms** (`MissionControlPage.tsx:68` `mapApiDataForBackup` ↔ `CompanyProfileForm.tsx:50` `mapApiDataToFormState`). Verified real — the two perform the same snake/camel → 16-field mapping over `UntypedBackendApiResponse`, and the code comments themselves acknowledge it (`MissionControlPage.tsx:67` "Mirrors the old mapApiDataToFormState transform"; `CompanyProfileForm.tsx:47` "extracted from the page's mapApiDataToFormState"). This is the one genuinely-new, currently-untracked finding. Deferral: it is coupled to the deferred read-driven backup-write path (TD-FE-35) and the `UntypedBackendApiResponse` escape hatch (TD-FE-38) — the natural moment to unify into one shared mapper is when that contract is typed/migrated, so a premature standalone extraction would touch deferred write code for marginal benefit. **Action: track it** — fold into TD-FE-38 (escape-hatch typing) or append a new TD-FE entry; the synthesis records it so it isn't lost. Trigger: the company-profile read/backup typing or mutation pass (Phase 7 ICP-write or Phase 13).

- **[Medium] `ConnectorApprovals` at 3,060 LOC.** Verified (3,060). Already tracked comprehensively in **TD-FE-39** (the reviewer acknowledges this): a dead cluster (no live UI triggers except the Slack-OAuth mount effect), relocated as-is per the plan's "heaviest single carve" deferral, awaiting a product decision (delete-vs-wire). No action this phase. Trigger: connectors become a real feature, or a dead-code sweep.

- **[Nit] Two `DataSource` interfaces** (`types.ts:27` lean read-list ↔ `connectorTypes.ts:9` rich connector). Verified, and deliberate — documented in Spec 25 §3 and the README "Decisions"; unification tracked in **TD-FE-39**. Phase 7 consumers disambiguate by import path (noted in the README handoff). No action.

- **[Low] `MissionControlPage` read-driven side effects overlap `CompanyProfileForm`'s hydration** (`MissionControlPage.tsx:160-257`). The page/form split is intentional and documented (page owns cross-tab concerns — data-sources state, completeness, localStorage backup, profiler-cache; form owns editable field state). Both derive from one shared TanStack cache entry, so there is no double-fetch (the reviewer confirms). The "fragile boundary" is the intended architecture; the localStorage-backup effect overlap is the kind of thing the deferred write/backup migration (TD-FE-35) naturally consolidates. Deferred/awareness; trigger: the write-path migration.

## Severity Disagreements

- **[High → tracked deferred debt] `DataSourcesManager` still 3,497 LOC.** Verified (3,497). Agree on the fact; disagree it is a High-severity gate miss. The reviewer themselves notes the spec's R1 risk ("DataSourcesManager upload entanglement") and that the plan's R1 mitigation ("keep upload helpers inline if extraction over-runs") was "applied correctly." The stage-5 gate is "data-sources tab decomposed; reads on hooks; writes deferred; journey 02 + VR green" — all met: the three presentational children were extracted, reads moved to `useDataSources`/`useLeadStreamStatus`, and e2e journey 02 + VR are green. The residual bulk is the **write/upload pipeline deliberately deferred**, already tracked as TD-FE-34 (writes → mutations) and TD-FE-37 (upload-helper extraction, Phase 11). The 406 (ICPManager) vs 3,497 (DataSourcesManager) asymmetry the reviewer flags is precisely the coupling difference the plan anticipated: ICPManager's writes were small and separable (→ self-contained wizard), whereas DataSourcesManager's upload pipeline is tightly coupled to auth/refresh/polling (→ R1 deferral). Effective severity: Low (deferred, tracked) — not an unaddressed defect.

- **[Medium → Nit] `_isSaving` prefixed-dead variable** (`ICPManager.tsx:26`). Verified dead (only `setIsSaving` is called; the value is never read; lint-passing via `varsIgnorePattern: "^_"`). Already captured in **TD-FE-40**. It is a cosmetic dead-var, not a Medium concern. Consistent with the parity posture (TD-FE-40 defers relocated-legacy cleanup); trigger: the dead-code sweep. (Operator may opt to remove it now — it is a ~2-line deletion — but it is not merge-blocking.)

## Open Questions

- The branch (`worktree-phase-6-mission-control`, 31 commits ahead of `master`) is complete and gate-green but **not yet merged** — the user chose "keep as-is." If the operator wants the single low-risk cleanup before merge, the cheapest real win is unifying the duplicated `mapApiData*` transform (and optionally deleting `_isSaving`); say the word and it lands as a small follow-up commit. Otherwise both remain tracked TD-FE debt and the branch is ready to merge as reviewed.
