---
artifact: specs/31-frontend-phase-11-shared-utility-extraction-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 1
---

## Context

Review verified all consumer counts against live import greps on `master` @ `182cb8e`. Three files have zone-level conflicts with `components/ui/` that the spec does not address — these are the same structural catch-22 as the `cn` split (§5.1) but were not recognized.

## Findings

### Critical

#### C1: `use-mobile` has undiscovered `components/ui/sidebar.tsx` consumer — proposed destination violates zone rules

**Location:** §1.3 table row `hooks/use-mobile.tsx` → "1 (shell) → `features/shell/`"; §4 class B

`components/ui/sidebar.tsx:13` imports `useIsMobile` from `@/hooks/use-mobile`. Moving `use-mobile` to `features/shell/` would make `ui/sidebar.tsx` import from `features/`, violating the existing `import-x/no-restricted-paths` zone (eslint.config.js:80-83, `ui → features` blocked). Moving to `shared/hooks/` would similarly violate `ui → shared` (eslint.config.js:84-88). This is structurally identical to the `cn` catch-22 (§5.1) — `use-mobile` is consumed by a locked ui primitive — but the spec does not recognize it at all.

`use-mobile`'s full consumer surface is: shell (Sidebar, Header, PWAInstallPrompt) + `components/ui/sidebar.tsx`. The `PWAInstallPrompt` consumer is also moving to `features/shell/`, but the `ui/sidebar.tsx` consumer cannot follow.

Resolution options parallel §5.1: (a) co-locate `use-mobile` inside `components/ui/` alongside the primitives that consume it (like `cn`), or (b) introduce a `components/ui/use-mobile.tsx` re-export shim (like the existing `components/ui/use-toast.ts` pattern). Either way, the §1.3 disposition and §4 class B entry are incorrect as written.

#### C2: `use-toast` has undiscovered `components/ui/` consumers — proposed destination violates zone rules

**Location:** §1.3 table row `hooks/use-toast.ts` → "5 (…) → `shared/hooks/`"; §4 class A

`components/ui/use-toast.ts:1` re-exports from `@/hooks/use-toast`. `components/ui/toaster.tsx:9` directly imports `useToast` from `@/hooks/use-toast`. Moving `use-toast` to `shared/hooks/` would cause both ui files to import from `shared/`, violating the existing `ui → shared` lint zone. Same structural issue as C1 and §5.1's `cn`, but unrecognized.

The existing `components/ui/use-toast.ts` is already a re-export shim (3 lines), suggesting the codebase has been working around this zone tension. The spec must either: (a) keep `use-toast` co-located with its ui consumers (in `components/ui/`), or (b) formally relax the `ui → shared` zone for specific shared primitives, or (c) restructure the toast system so the ui wrappers don't depend on the hook. Option (a) is the most consistent with how `cn` is handled.

### High

#### H1: `useAuth` consumer count materially wrong — may affect disposition rationale

**Location:** §1.3 table row `hooks/useAuth.ts` → "1 (mission-control)"

Actual import sites: 5 across 2 feature zones:
- `features/mission-control/` (4 sites: MissionControlPage, CompanyProfileForm, ICPManager, DataSourcesManager)
- `components/market-research/lead-stream/LeadsTable.tsx` (1 site — the §6 residue)

That is ≥2 feature-level consumers, which by the raw ≥2-rule would send it to `shared/hooks/` rather than `shared/auth/`. The auth-infra exception (§1.1) still justifies `shared/auth/` placement, but the spec argues it partly on the "single consumer" basis ("Its single current consumer (mission-control) updates one import" — §5.2). That claim is wrong; the plan will need to repoint at least 5 import sites across mission-control plus the residue consumer.

#### H2: `lib/api.ts` consumer count "7" is unverifiable

**Location:** §1.3 table row `lib/api.ts` → "7 + `shared/api/client.ts` imports it"

Live grep shows 19 `from "@/lib/api"` import sites. Unique feature folders: strategist (2 sites), market-research (5 sites), customers (4 sites), mission-control (2 sites) = 4 features. Plus shared/auth (1), shared/api/client.ts (1), test/msw (1), lead-stream residue (1) = 4 non-feature. No reasonable counting method yields "7 features." If "7" means total import sites excluding shared/api/client.ts: 18, not 7. The number should be corrected or the counting method made explicit — the plan needs accurate counts to size the repointing work.

### Medium

#### M1: `lib/jwt.ts` consumer count undercounted

**Location:** §1.3 table row `lib/jwt.ts` → "2 (market-research, mission-control)"

Actual consumers include the lead-stream residue (`LeadsTable.tsx:51`), making it ≥3 feature-level consumers (market-research, mission-control, residue-to-be-resolved). The disposition (`→ shared/auth/`) is still correct, but the count should be accurate for the plan's import-repointing checklist.

#### M2: §5.1 falsely claims `shared/chat/ContextChat` imports `cn`

**Location:** §5.1 — "Non-ui consumers (features + `shared/chat/ContextChat`) repoint to `@/components/ui/utils`"

`ContextChat.tsx:19` imports only `sanitizeAnswerText` from `@/lib/utils`, not `cn`. After the split, ContextChat will import from `@/shared/lib/`, not `@/components/ui/utils`. This is a factual error that could mislead the plan into creating an unnecessary import path.

#### M3: No ADR or decision recorded for `use-mobile` and `use-toast` zone conflicts

**Location:** §5.1 (ADR-0005 proposed for `cn`); §4 classes A and B (no ADR for the other two)

The spec correctly identifies that `cn`'s placement is non-obvious and proposes ADR-0005. The structurally identical `use-mobile` and `use-toast` placements have no proposed ADR and, worse, no acknowledged zone conflict (see C1, C2). Once the conflicts are recognized, placement decisions for these hooks should also be recorded as ADRs since they establish precedent for "ui-layer dependency" files.

#### M4: §3 dependency posture describes an aspirational state, not acknowledged as such

**Location:** §3 — "After this phase… `components/ui/` may import **only** npm + itself"

Currently `ui/sidebar.tsx` imports `@/hooks/use-mobile` and `@/lib/utils`; `ui/use-toast.ts` and `ui/toaster.tsx` import `@/hooks/use-toast`. The spec handles `cn` (the `@/lib/utils` import) in §5.1 but doesn't acknowledge the other violations or how the target state is achieved for `use-mobile` and `use-toast`. As written, §3's claim will be false after this phase unless C1 and C2 are resolved.

### Low

#### L1: `use-toast` feature count "5" is directionally correct but imprecise

**Location:** §1.3 table — `hooks/use-toast.ts` → "5 (auth, customers, market-research, mission-control, signals)"

Actual distinct feature consumers: auth, customers, market-research, mission-control, signals = 5 features, plus `shared/chat/ContextChat` (a shared consumer that triggers the shared-consumer corollary from §1.1). The spec's "5" is correct for feature count but omits the shared consumer and the 2 ui consumers. Not material to disposition (shared placement is correct either way), but the plan's repointing checklist needs the full list.

#### L2: §5.2 auth relocation and §6 lead-stream residue have a hidden ordering dependency

**Location:** §5.2; §6

LeadsTable.tsx (lead-stream residue, §6) imports both `useAuth` (§5.2) and `jwtManager` (§5.2). If the auth cluster moves before the residue is resolved, the residue's imports temporarily point to moved files. The execution stages (§9) place auth in 11b and residue in 11c — this is correct ordering, but the dependency is not called out explicitly. A note in §6 or §9 would help the plan.

#### L3: §10 mentions `knip` transient findings but doesn't specify clean-gate requirement

**Location:** §10 — "expect transient dead-code findings immediately after a move… confirm expected, not a blocker"

It's unclear whether `knip` must be clean at each stage gate or only at the final preflight. Given that stage gates use `npm run verify` (typecheck + lint + test:changed), and `knip` is only in preflight, this is probably fine — but a single clarifying sentence would prevent confusion during execution.

### Nit

#### N1: §9 stage 11c combines `cn` split + lead-stream residue — different risk profiles

**Location:** §9 — "11c — `cn` split + lead-stream residue"

The `cn` split (§5.1) is a well-bounded, high-consumer repointing with a clear resolution. The lead-stream residue (§6) requires a full consumer trace with potentially ambiguous ownership outcomes. Combining them in one stage conflates risk levels; the `cn` split could ship independently while the trace is still being validated.

#### N2: §5.1 non-ui consumer list should be separated by destination

**Location:** §5.1 — "Non-ui consumers (features + `shared/chat/ContextChat`) repoint to `@/components/ui/utils`"

As noted in M2, ContextChat doesn't import `cn`. But even for the actual `cn` consumers, the non-ui import sites should be listed by destination: feature consumers → `@/components/ui/utils`, since `features → ui` is allowed. A cleaner phrasing would be "Feature consumers of `cn` repoint to `@/components/ui/utils`" with ContextChat omitted from this sentence entirely.

#### N3: §4 class B parenthetical is editorially unnecessary

**Location:** §4 class B — "(Moving a single-consumer file into its feature is relocation, not 'feature extraction' — consistent with Phase 11's lighter deliverables.)"

This defensive framing adds noise; the disposition speaks for itself.
