---
artifact: fix-signals-company-profile
artifact_type: impl
verdict: clean
reviewer_model: glm-5.2
date: 2026-06-19
round: 1
base_ref: master
spec_loaded: false
plan_loaded: false
---

## Context

Single-commit FE bugfix: `47ec78d fix(fe): generate signals against the org's real
company profile`. `generateSignalsBatch` previously sent a hardcoded firmographics block
(SaaS / 50-200 employees / example.com / North America, Europe) for every org, so signals
were generated against fake placeholders while the org's real `CompanyProfile` (Settings)
sat unused. The fix sources the `data` block from the org's saved profile; a missing or
unresolved profile yields empty fields (never the dummy values). `SignalsPage` mirrors the
profile into a ref so the header-driven refresh — a window-event listener whose
`handleRefresh` closure is captured at mount — reads the resolved value instead of the
stale initial state.

**Change-context source:** `git log -p master..fix-signals-company-profile` (1 commit,
well under the 200 KB budget — no commit bodies dropped). Three-dot stat: 6 files,
+103/-25, all under `frontend/src/features/signals/`.

**Config loaded (from branch ref, repo root + touched `frontend/` subproject):**
`frontend/package.json` (Node `engines >=21.2.0`; `preflight`/`verify`/`knip --strict` gates),
`frontend/knip.json` (every `src/**/*.{ts,tsx}` is a knip entry point, so unused-export
flags don't fire), `frontend/tsconfig.json`, `frontend/tsconfig.app.json` (`strict`,
`noUnusedLocals`, `noUnusedParameters`, `noImplicitAny`). No `.eslintrc*` found.

**Spec/plan auto-discovery:** no `specs/fix-signals-company-profile.md` or
`plans/fix-signals-company-profile.md` by slug. The documented fallback to the
most-recently-modified artifact pointed at `specs/38-signals-cta-design.md` /
`plans/38-signals-cta.md` (signals *CTA* design) — a topically unrelated feature, so
loading it for adherence would manufacture false premises. Treated as a standalone
`fix(fe):` bugfix with no originating spec/plan; adherence checking skipped. Pass paths
explicitly when invoking if one exists.

## Findings

None. The change is correct, minimal, and well-tested:

- **Single runtime caller, updated:** `generateSignalsBatch` is invoked only at
  `frontend/src/features/signals/pages/SignalsPage.tsx:288` (now passing
  `companyProfileRef.current`); the `useGenerateSignalsBatch` hook and all tests were
  updated in lockstep. No stragglers.
- **Type-safe alias fallbacks:** the `companyUrl ?? website` and `primaryGTMModel ??
  gtmModel` chains at `signals.ts` resolve against `CompanyProfileSchema`
  (`contracts/company-profile.ts:14-30`), which declares *both* field names (documented
  dual-naming taken from what `CompanyProfile.tsx` reads/writes). Not defensive guesswork.
- **Stale-closure fix is idiomatic and complete:** the `signalsRefresh` listener
  (`SignalsPage.tsx:211-237`) registers once per `[currentUser?.uid, orgId]` with
  `react-hooks/exhaustive-deps` disabled, so it permanently captures the mount-time
  `handleRefresh`. Reading `companyProfileRef.current` (kept fresh by the
  `[companyProfile]` effect at `SignalsPage.tsx:51-53`) is the correct React pattern for
  "latest value inside a stale event callback." `companyProfileRef` is a stable object
  whose `.current` is read at click time, so the captured-closure problem is fully
  addressed.
- **Body contract unchanged:** only `data` *values* changed; all keys (`industry`,
  `companySize`, `companyUrl`, `strategicGoals`, `primaryGTMModel`, `revenueStage`,
  `keyBuyerPersona`, `targetMarkets`) match the previous hardcoded shape, so the backend
  receives no new field names. Type-only imports (`import type`) — no runtime/bundle
  impact.
- **Tests are behavior-focused:** `signals.test.ts` asserts the request body for the real
  profile, the null→empty-fields fallback (with the full expected empty shape), and the
  `website`/`gtmModel` alias fallback, plus the preserved HTTP-500 rejection. These would
  survive an internal refactor as long as the body contract holds.
- **Diff hygiene:** one atomic commit, all hunks serve the single fix; no scope creep, no
  unrelated changes, no mixed FE/BE manifests.

## Observations (no action)

- `component_name: "test"` (`signals.ts`) remains a hardcoded probe label. Pre-existing,
  unchanged by this fix, and explicitly called out by the author as a separate concern.
  Flagged for awareness only.
- `useGenerateSignalsBatch` has no production caller (`SignalsPage` calls
  `generateSignalsBatch` directly); the hook is "pre-positioned" per `frontend/src/features/
  signals/README.md` / TD-FE-53, so the signature update simply keeps it consistent with the
  service. knip doesn't flag it (entry-point config). No change needed.
- On a missing/unresolved profile the backend now receives empty-string / empty-array
  firmographics rather than placeholders. This is the intended product tradeoff (don't
  fabricate data) and is documented in the commit. `useCompanyProfile` also returns `null`
  on any non-Zod failure (HTTP 5xx / network / CORS), so a transient backend blip during a
  *first* load yields empty firmographics — acceptable and self-correcting once the cached
  profile resolves.
- Org-switch race (narrow): the listener re-registers on `orgId` change and the ref is the
  same stable object, but while the new org's profile query is in flight TanStack serves the
  *previous* org's cached `data`, so a refresh clicked in that brief window would generate
  against the prior org's firmographics for the user's uid. The window is short, uncommon,
  and self-corrects on the next refresh; not worth a code change here.
- `CompanyProfileSchema` carries known duplicate fields (`companyUrl`/`website`,
  `primaryGTMModel`/`gtmModel`) — the schema comment references a deferred reconciliation
  (spec 20 §3.5, R1). The local `??` fallbacks handle both cleanly; normalizing at the
  shared type is a separate, tracked concern.
