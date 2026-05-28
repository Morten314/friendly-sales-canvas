---
artifact: phase-2a-strict-ts
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Spec 17 and Plan 17 were both loaded and used for adherence checking. The Step 0 probe undercounted TS7006 errors (see Findings). Scorecard is thorough and honest about mid-phase incidents (the MarketResearch.tsx over-deletion and reset).

## Findings

### [Low] Probe undercounted TS7006 — throwaway config doesn't override base's explicit `noImplicitAny: false`

**Location:** `frontend/scripts/build-strict-probe.ts:352-360` (probe config), scorecard §1

The probe config sets `strict: true` to enable all strict sub-flags, but `tsconfig.app.json` has `noImplicitAny: false` explicitly. In TypeScript's config merge, an explicit flag in the base wins over the umbrella flag in the extension — so the probe's `strict: true` did not override the base's `noImplicitAny: false`. Result: Step 0 baseline reported 417 errors (zero TS7006) while the actual post-Step-1b surface was 443 (83 TS7006). The fix would be to explicitly set `"noImplicitAny": true` in the throwaway probe config alongside the other explicit flags. No impact on the phase outcome — Wave B handled all 83 TS7006 errors regardless, and the scorecard documents the delta accurately. The helper script is kept as permanent tooling per the plan; this fix should land before Phase 2b uses it for re-baselining.

### [Low] ~1,100 lines of dead integration logic deleted from MissionControl.tsx

**Location:** `frontend/src/pages/MissionControl.tsx` — the Wave A commit `3786934` and Wave C commit `10d8ce2`

The deleted symbols include `saveDataSourcesToBackend`, `uploadFileToBackend`, `checkDocumentStatus`, `loadDataSourcesFromBackend`, `handleSyncNow`, `handleAddCustomResource`, `handleAddCustomFileUpload`, `handleTestApiConnection`, `handleAddApiResource`, mock data generators, and supporting UI helpers (total ~1,100 lines removed from a ~2,700-line delta). All were flagged TS6133 ("declared but never read"), and the full preflight (Playwright + visual regression + Vitest + knip) passes on the final commit. The DataSourcesManager component already owns the live integration logic — these MissionControl handlers appear to be pre-extraction remnants. The deletion is mechanically correct per Spec 17 §2.4 posture rule 2 ("unused local: delete the declaration"), but the volume and nature of the removed code (API integration patterns that *look* like active business logic) warrant extra scrutiny during merge review. If any are referenced indirectly (string-based event dispatch, `eval`), TS6133 wouldn't catch it — though Playwright + visual regression at `maxDiffPixelRatio 0.01` provides strong coverage.

### [Medium] Escape-hatch entries use `= any` but are not counted in the inline-any non-regression gate

**Location:** `frontend/src/lib/types/escape-hatches.ts:30-48`, Spec 17 §4 item 6

The escape-hatches file defines `export type UntypedX = any;` — the `= any` syntax. The scorecard reports inline-any count as 224 (down from baseline 238). The regex `rg -n ':\s*any\b|as\s+any\b|<any>'` does not match `= any;` (the equals-sign prefix is excluded by the alternation: it matches `:` before `any`, `as` before `any`, or `<` before `any`). The spec is aware of this: §4 item 6 explicitly says "Escape-hatch entries in `src/lib/types/escape-hatches.ts` use `= any` syntax not matched by this regex and are tracked separately under item 5." So this is *by design*, not a bug. The finding is that the non-regression gate's regex does not cover the `type X = any` position at all — anywhere in the codebase, not just in escape-hatches.ts. Any developer could add `type Foo = any` in any file and it would not be caught by the §4 item 6 gate. Phase 2b's `@typescript-eslint/no-explicit-any` lint rule is the authoritative backstop, and the spec acknowledges this. Flagging because the gate's coverage gap is broader than just the escape-hatch file.

### [Nit] Scorecard commit-log snapshot is one commit behind HEAD

**Location:** `docs/audits/2026-05-28-frontend-phase-2a-strict-ts.md` §5

The embedded `git log --oneline master..HEAD` in the scorecard ends at `31935b3` but the scorecard itself is commit `2afd93b`. The log was captured during scorecard generation (before the scorecard commit), so the scorecard's own commit is missing from the list. Harmless — the actual `git log` on the branch is correct — but slightly inconsistent with the scorecard's stated intent to attach the log "verbatim."

### [Nit] `allowJs: true` retained in composite root `tsconfig.json`

**Location:** `frontend/tsconfig.json:13`

The spec §2.1 lists exactly four overrides for removal (`noImplicitAny`, `noUnusedParameters`, `noUnusedLocals`, `strictNullChecks`) — `allowJs` is not among them, so retaining it is correct. However, `allowJs: true` in a composite root that references two strict app configs is mildly confusing (it suggests JS files might be in scope, but `"files": []` means none are). No functional impact. Consider removing in a future cleanup.

### [Nit] Redundant `noImplicitAny: true` alongside `strict: true` in `tsconfig.app.json`

**Location:** `frontend/tsconfig.app.json:19`

`strict: true` transitively enables `noImplicitAny`, making the explicit `noImplicitAny: true` redundant. The spec §3 Step 1b explicitly notes this: "keeping it explicit is defensive and harmless; the spec doesn't strip it." Correct per spec, but worth noting for future readers who might wonder about the duplication.
