# Spec 31 — Frontend Phase 11: shared utility extraction

**Status:** Design — round 1 (revised after spec-review-1; synthesis at `docs/reviews/31-frontend-phase-11-shared-utility-extraction-design-spec-synthesis-1.md`)
**Date:** 2026-06-05
**Type:** Phase spec (implements Spec 14 §4 Phase 11)
**Paired plan:** `plans/31-frontend-phase-11-shared-utility-extraction.md` (written after this spec converges)
**Branch:** `phase-11-shared-utility-extraction` (off `master` @ `182cb8e`)
**Predecessor:** Phase 9 (scout + profiler, Spec/plan `30`) merged to `master` 2026-06-05 (`182cb8e`). Phases 5–10 + 12 are all on `master`.
**Concurrency:** **none.** Per Spec 14 §4's dependency table Phase 11 has a **hard barrier** — it promotes utilities *demonstrated* used by ≥2 features, so it requires Phases 5–10 done; and Phase 12 "must precede 11's empty-`pages/` check." All of 5–10 + 12 are merged, so the barrier is satisfied and Phase 11 runs **solo** (no sibling sandboxes in flight). NN `31` is the next free slot (Phase 9 took `30`).

---

## §1 Goal and context

### 1.1 Goal

Close the structural refactor by **draining every remaining legacy directory** so the target layout (Spec 14 §3.1) is fully realized. After this phase: `src/hooks/`, `src/lib/`, `src/utils/` are gone; `src/components/` holds **only** `ui/` (locked shadcn primitives); `src/styles/` (with `index.css`) is relocated under `src/shared/styles/`; `src/contexts/`, `src/services/`, `src/pages/` are confirmed already gone. Every relocation is behavior-, route-, and visually-neutral (Spec 14 §2.3 frozen interfaces) — pure code movement plus import repointing.

Promotions follow the **≥2-feature rule** (Spec 14 §8 Q5, resolved Phase 4a): a hook/util/type graduates to `src/shared/` only once two or more features import it; single-feature files move **into** their owning feature; api/auth infrastructure is shared-by-definition (the documented exception, same basis as `shared/api/`).

**Corollary (shared-consumer forces shared placement).** A file consumed by **any** `src/shared/*` module must live in `src/shared/` even if only one *feature* also uses it — because §3.3 forbids `shared/ → features/`, so it cannot be parked inside that one feature. This overrides the raw feature-count for such files (it applies to `sanitizeAnswerText`, consumed by `shared/chat/` — §5.1).

### 1.2 Resolved scope decisions (brainstorming, 2026-06-05)

This spec records four orchestrator decisions taken before drafting:

1. **Full structural drain** (not the narrowed "utility-only" reading of Spec 14 §4). Phase 11 absorbs both hard areas — the api-transport files and the cross-coupled lead-stream component residue (TD-FE-63) — so DoD §6.1 (`src/components/` = `ui/` only; legacy dirs gone) is **fully met this phase**. The only deferral is the *semantic* TanStack data-layer migration (already carried as TD across Phases 5–10); the file moves here are **pure relocations, no fetch-logic rewrite**.
2. **`src/styles/` → `src/shared/styles/`** (resolves Spec 14 §8 Q12; deviates from §3.1's "no-move" default by explicit choice, for full-drain consistency).
3. **Lead-stream residue resolved per-file by a full consumer trace** (not pre-committed to "own feature" vs "distribute"): the spec/plan enumerate every consumer of every residue file and assign owners mechanically via the ≥2-rule (§6). No `features/lead-stream/` feature is created up front.
4. **Phase 11 is standalone** (resolves Spec 14 §8 Q14 — not folded into the Phase 13 LOC audit). The surface is modest (~24 files) but real, and it carries the capstone lint-tightening that locks the drain.

### 1.3 Actual starting state (`master` @ `182cb8e`)

`src/contexts/`, `src/services/`, `src/pages/` are **already empty/gone** (Phases 4b/10/12). Remaining legacy surface, with **feature-consumer counts** (the ≥2-rule input):

| File | Feature consumers | Disposition (§4) |
|---|---|---|
| `hooks/use-toast.ts` | 5 features + **`components/ui/{toaster,use-toast}`** | → `components/ui/use-toast.ts` (ui-consumed — §5.1) |
| `hooks/usePageTitle.ts` | 6 (artifacts, calendar, customers, market-research, reports, strategist) | → `shared/hooks/` (resolves **TD-FE-57**) |
| `hooks/use-mobile.tsx` | shell (Header, Sidebar, PWAInstallPrompt) + **`components/ui/sidebar.tsx`** | → `components/ui/use-mobile.tsx` (ui-consumed — §5.1) |
| `hooks/useAuth.ts` | mission-control (4 sites) + residue (`LeadsTable`) + test mocks | → `shared/auth/` **renamed** (auth-infra; name collision — §5.2) |
| `lib/utils.ts` → `cn` | 31 `ui/` files + 3 non-ui (shell Header/Sidebar, mission-control IcpWizard) | → `components/ui/utils.ts` (zone-rule — §5.1) |
| `lib/utils.ts` → `sanitizeAnswerText` | signals (`SignalCard`) + `shared/chat/ContextChat` | → `shared/lib/` (shared-consumer corollary §1.1) |
| `lib/types/escape-hatches.ts` | 7 | → `shared/types/escape-hatches.ts` |
| `lib/jwt.ts` | 2 features (market-research, mission-control) + residue (`LeadsTable`) + the `useAuth` hook + tests | → `shared/auth/` (resolves **TD-FE-54**) |
| `lib/api.ts` | 4 features (customers, market-research, mission-control, strategist; 19 sites) + `shared/api/client`, `shared/auth/AuthContext`, residue, `test/msw` | → `shared/api/transport.ts` (pure move — §5.3) |
| `lib/rateLimitManager.ts` | 0 features; consumed by `shared/api/rateLimiter.ts` | → `shared/api/` (pure move — §5.3) |
| `lib/timestampUtils.ts` | 1 (market-research) | → `features/market-research/` |
| `lib/leadStreamHeatmapSession.ts`, `lib/marketScoreDescriptions.ts`, `lib/marketScoresHeatmap.ts` | 0 features; consumed only by `components/market-research/lead-stream/LeadsTable.tsx` | travel with `LeadsTable` (§6) |
| `utils/cacheUtils.ts` | 5 | → `shared/lib/` |
| `utils/apiUtils.ts` | 1 (market-research) | → `features/market-research/` |
| `utils/leadStreamChatContext.ts` | 1 (market-research) | → `features/market-research/` (resolves **TD-FE-62**) |
| `components/MiniLineChart.tsx`, `components/MiniPieChart.tsx` | 1 (market-research) | → `features/market-research/` |
| `components/PWAInstallPrompt.tsx` | `App.tsx` only | → `features/shell/` |
| `components/common/` | 1 (customers) | → `features/customers/` |
| `components/market-research/` (6 files: `ScoutLeadStream`, `EditDropdownMenu`, `lead-stream/{LeadStreamTab,LeadsTable,OpportunityDashboard,leadData}`) | 4 (customers, market-research, shell, strategist) | resolve per-file by trace (§6) (resolves **TD-FE-63**) |
| `styles/scrollbar-hide.css` + `index.css` | global (main.tsx) | → `shared/styles/` (§7) |

Counts are from an import grep at spec-write time and are a **starting estimate**; the plan re-runs a full trace (including non-feature consumers in `App.tsx`, `shared/`, `components/ui/`, tests) before moving each file, and the disposition is re-validated against that trace.

### 1.4 Already done (no work here)

- `src/shared/{api,auth,tenant,chat,components,company-profile,profiler}` exist (Phases 3, 4, 8, 9). This phase adds `shared/{hooks,lib,types,styles}`.
- `src/shared/README.md` documents the ≥2-feature promotion criteria (Phase 4a) — the rule this phase applies.
- `import-x/no-restricted-paths` (cross-zone) + `import-x/no-cycle` + `import-x/no-internal-modules` (`@/features/*/!(index)`) are live (Phases 4a / 6 stage 1b). This phase **adds legacy-dir zones** to `no-restricted-paths` (§8).
- shadcn primitives at `@/components/ui/*` stay (locked); this phase only **adds** `components/ui/utils.ts` (the `cn` home) and repoints `ui/`'s relative import.

---

## §2 Scope

### 2.1 In scope

1. Relocate every file in §1.3 to its §4 destination; repoint **all** import sites (features, `shared/`, `components/ui/`, `App.tsx`, tests).
2. Split `lib/utils.ts`: `cn` → `components/ui/utils.ts` (§5.1); `sanitizeAnswerText` → `shared/lib/`.
3. Consolidate the auth-infra cluster (`lib/jwt.ts` + the `useAuth` composition hook, renamed) into `shared/auth/` (§5.2).
4. Relocate api-transport (`lib/api.ts` → `shared/api/transport.ts`; `lib/rateLimitManager.ts` → `shared/api/`) as **pure moves** (§5.3).
5. Resolve the lead-stream residue per-file via full consumer trace (§6).
6. Move `src/styles/` + `src/index.css` under `src/shared/styles/`; update `main.tsx` import lines (§7).
7. Relocate co-located `__tests__/` with their subjects (e.g. `lib/__tests__/*` follow their files).
8. **Capstone:** delete the now-empty legacy dirs; extend `import-x/no-restricted-paths` to forbid `features/`/`shared/` importing legacy paths; run the DoD §6.1 verification (§8).
9. Per-feature `README.md` touch-ups where a moved file changes a feature's public surface or key-files list.

### 2.2 Out of scope (logged to `docs/TECH_DEBT.md`)

- **Semantic TanStack data-layer migration** — converting the relocated `apiFetch`/`apiFetchJson` call sites to `useQuery`/`useMutation`. The transport **moves** here; its callers' fetch semantics are unchanged. Stays as the existing per-feature data-layer TD.
- **Behavioral or visual change** of any kind (frozen, §2.3). No "improving" a utility while moving it.
- **shadcn primitive consolidation** inside `components/ui/` (locked; out since Phase 4).
- **Router / Firebase / PWA / design-system** changes (Spec 14 §2.2).
- Further LOC reduction beyond what relocation incidentally removes (dead-on-arrival files surfaced by the trace) — that is **Phase 13**.

### 2.3 Frozen interfaces (Spec 14 §2.3)

- **HTTP API contract** unchanged — `lib/api.ts`'s `apiFetch`/`apiFetchJson`/`buildApiUrl`/`buildIcpUrl` move byte-for-byte; the `/icp` proxy-bypass behavior (`buildIcpUrl`) and the 30 req/min rate-limit boundary are preserved exactly.
- **Routes, auth flow, visuals** unchanged — these are pure relocations behind stable module specifiers.
- **`escape-hatches.ts` contents** carried verbatim (its re-evaluation is Phase 13).
- **Existing Vitest/Playwright/visual-regression suites** stay green; relocated unit tests keep asserting the same behavior at their new paths.

---

## §3 Target structure & dependency posture

After this phase, the only top-level dirs under `src/` are: `features/`, `shared/`, `components/ui/`, `app/`, `test/`, plus `App.tsx`/`main.tsx`/`vite-env.d.ts`. New `shared/` subtrees:

```
src/shared/
  hooks/        # use-toast, usePageTitle (+ co-located tests)
  lib/          # sanitizeAnswerText, cacheUtils (+ tests)
  types/        # escape-hatches.ts
  styles/       # index.css, scrollbar-hide.css
  auth/         # + jwt.ts, + useAuthToken (renamed useAuth hook)
  api/          # + transport.ts (was lib/api.ts), + rateLimitManager
components/ui/
  utils.ts      # cn() — co-located with the primitives that consume it
```

**Dependency rules honored (Spec 14 §3.3):**
- `shared/*` may import `shared/*`, `components/ui/*`, npm — **not** `features/*`. (Every promote lands in a position that respects this; the auth/api clusters import only sibling `shared/` + ui + npm.)
- `components/ui/` may import **only** npm + itself — **not** `shared/` or `features/`. **Today three legacy utilities violate this** (`cn` from `@/lib/utils`; `useToast` from `@/hooks/use-toast` in `toaster.tsx` + `use-toast.ts`; `useIsMobile` from `@/hooks/use-mobile` in `sidebar.tsx`) — enumerated by grepping `ui/`'s imports, and the **complete** set. The target state is **reached** by co-locating all three into `components/ui/` (§5.1); this is the binding constraint that fixes their destinations.
- `features/<X>/` may import `shared/*`, `components/ui/*`, npm, and own-feature files; cross-feature only via `features/<Y>/index.ts`.
- After the drain, **no `features/*` or `shared/*` file imports any legacy path** (`@/hooks`, `@/lib`, `@/utils`, `@/contexts`, `@/services`, `@/pages`, or non-`ui` `@/components/*`) — enforced by the §8 lint zones.

---

## §4 Disposition map

The relocations group into five mechanical classes plus the trace-resolved residue (§6).

**A — Clean promotes → `shared/` (low risk; ≥2 features, or shared-consumer-forced per the §1.1 corollary):**
`usePageTitle` (6) → `shared/hooks/`; `cacheUtils` (5) and `sanitizeAnswerText` (signals + `shared/chat` ⇒ corollary) → `shared/lib/`; `escape-hatches.ts` (7) → `shared/types/`. (`use-toast` is **not** here — locked `ui/` files consume it, so it co-locates into `components/ui/` per class C.) Repoint each consumer's import from `@/hooks|@/lib|@/utils` to `@/shared/...`. Co-located tests move alongside.

**B — Single-consumer → into owning feature:**
`PWAInstallPrompt` → `features/shell/`; `timestampUtils`, `apiUtils`, `leadStreamChatContext`, `MiniLineChart`, `MiniPieChart` → `features/market-research/` (placed under that feature's `hooks/`/`lib/`/`components/` per shape); `components/common/` → `features/customers/`. (`use-mobile` is **not** here — `components/ui/sidebar.tsx` consumes it, so it co-locates into `components/ui/` per class C.)

**C — ui-layer-consumed utilities → `components/ui/` (zone-rule; the complete verified set):** `cn` → `components/ui/utils.ts`; `use-toast` → `components/ui/use-toast.ts`; `use-mobile` → `components/ui/use-mobile.tsx` (§5.1). These are the **only** three legacy symbols imported by locked `ui/` files, so they cannot move to `shared/`/`features/` without breaking `ui ↛ shared/features`.

**D — Auth-infra cluster → `shared/auth/`:** `jwt.ts` + renamed `useAuth` hook (§5.2).

**E — api-transport (pure move) → `shared/api/`:** `lib/api.ts` → `shared/api/transport.ts`; `rateLimitManager.ts` → `shared/api/` (§5.3).

**F — Lead-stream residue + the 3 zero-consumer score libs:** resolved per-file by trace (§6).

---

## §5 The three load-bearing relocations

### 5.1 The three ui-layer-consumed utilities co-locate into `components/ui/`

Enumerating every legacy import from `components/ui/` yields **exactly three** symbols that locked primitives depend on: `cn` (`@/lib/utils`, 31 ui files), `useToast` (`@/hooks/use-toast` — `ui/toaster.tsx` + the existing 3-line `ui/use-toast.ts` re-export shim), and `useIsMobile` (`@/hooks/use-mobile` — `ui/sidebar.tsx`). For all three the naive promote-to-`shared/` is **wrong**: §3.3 forbids `components/ui/ → shared/`, so it would make locked shadcn primitives import upward. The fix is the same for each — co-locate with the primitives that consume it (these are shadcn primitive-layer utilities; shadcn itself ships `cn` and `use-toast` alongside its components):

- **`cn`** → `components/ui/utils.ts`. The 31 `ui/` files repoint to relative `./utils`. Its non-ui consumers are **3 feature files** — `features/shell/components/{Header,Sidebar}.tsx` and `features/mission-control/.../IcpWizard.tsx` — which repoint to `@/components/ui/utils` (`features → ui` allowed). **`shared/chat/ContextChat` and `signals/SignalCard` are not `cn` consumers** — they import `sanitizeAnswerText` (corrected from the round-1 draft, which wrongly listed ContextChat here).
- **`use-toast`** → `components/ui/use-toast.ts` (the real hook implementation replaces today's re-export shim at that path). `ui/toaster.tsx` repoints to relative `./use-toast`; the 5 feature consumers (auth, customers, market-research, mission-control, signals) repoint `@/hooks/use-toast` → `@/components/ui/use-toast`.
- **`use-mobile`** → `components/ui/use-mobile.tsx`. `ui/sidebar.tsx` repoints to relative `./use-mobile`; the shell consumers (`Header`, `Sidebar`, `PWAInstallPrompt`) repoint to `@/components/ui/use-mobile`.

Separately, **`sanitizeAnswerText`** (the other `lib/utils.ts` export) → `shared/lib/` per the §1.1 shared-consumer corollary (consumed by `shared/chat/ContextChat` + `signals/SignalCard`; it cannot live in `features/signals/` without `shared/chat` illegally importing a feature). `signals` + `shared/chat` repoint to `@/shared/lib`. This empties `lib/utils.ts`.

All three placements keep the four zone rules intact and are recorded together in **ADR-0005 — "ui-layer-consumed utilities live in `components/ui/`"** (generalized from the round-1 cn-only framing; it is the precedent future feature work will hit, e.g. adding a shadcn component that ships its own hook).

### 5.2 `useAuth` is a composition hook — rename, don't delete

`hooks/useAuth.ts` is **not** a shim: it composes `shared/auth`'s Firebase `useAuth` + `shared/tenant`'s `useTenant` + `jwt.ts` to manage the JWT-token lifecycle (generate-on-auth, clear-on-logout). It collides by name with `shared/auth`'s exported `useAuth` (flagged in TECH_DEBT). Resolution:
- Move it to `shared/auth/` and **rename** to a non-colliding, intent-revealing name (proposed `useAuthToken`; plan finalizes). Export it from `shared/auth/index.ts` alongside the Firebase `useAuth`.
- It belongs in `shared/auth/` (auth-infra exception to the ≥2-rule) because it sits on `jwt.ts` (also moving to `shared/auth/`) and composes the two shared context primitives — keeping the whole auth+JWT story in one place and resolving the collision. **Repointing surface (corrected from the round-1 draft's "single consumer"):** 4 import sites in `mission-control` (`MissionControlPage`, `CompanyProfileForm`, `ICPManager`, `DataSourcesManager`), 1 in the lead-stream residue (`LeadsTable`, §6), plus the `vi.mock("@/hooks/useAuth", …)` calls in mission-control's tests — all update to the new `@/shared/auth` path and the new hook name. (Feature-count is still effectively 1 — `mission-control` — so the auth-infra exception, not the raw ≥2-rule, is what places it.)

### 5.3 api-transport — pure relocation, semantics frozen

`shared/api/client.ts` already **imports** `lib/api.ts` (`apiFetchJson`, `buildApiUrl`, `ApiFetchOptions`) — `lib/api.ts` is the base transport Phase 3 layered `shared/api/` on top of, never relocated. This phase finishes that move:
- `lib/api.ts` → `shared/api/transport.ts` (verbatim; `API_BASE_URL`/`ICP_BACKEND_URL`/`BACKEND_BASE_URL`/`buildApiUrl`/`buildIcpUrl`/`apiFetch`/`apiFetchJson` unchanged). `shared/api/client.ts`'s import becomes relative (`./transport`); the 7 feature import sites repoint `@/lib/api` → `@/shared/api/transport` (or a barrel re-export from `shared/api/index.ts` if one is introduced — plan decides).
- `lib/rateLimitManager.ts` → `shared/api/` (consumed by `shared/api/rateLimiter.ts`; becomes a relative import). One 30 req/min budget, unchanged.
- **No fetch logic, header injection, rate-limit value, or URL construction changes.** The transport's behavior is a §2.3 frozen interface; the per-call-site TanStack migration remains out of scope (§2.2).

---

## §6 Lead-stream residue — resolved per-file by full consumer trace

`components/market-research/` retains 6 files (TD-FE-63), and 3 zero-feature-consumer `lib/` score files feed only `lead-stream/LeadsTable.tsx`. Ownership across market-research / customers / strategist is genuinely mixed and **mock/presentational** in large part (Phase 7/12 deltas). Rather than pre-commit, the plan completes this **disposition table** from a full consumer trace (every importer of every file, including non-feature sites), then assigns owners by the ≥2-rule:

| File | Known consumers (spec-write estimate) | Provisional owner (plan validates) |
|---|---|---|
| `lead-stream/leadData.ts` | strategist + `src/lib` + customers (per TD-FE-63) | likely `shared/` (≥2 features) |
| `lead-stream/LeadsTable.tsx` (+ `leadStreamHeatmapSession`, `marketScoreDescriptions`, `marketScoresHeatmap` which feed only it) | lead-stream cluster | likely `features/market-research/` (cluster home); the 3 score libs travel with it |
| `lead-stream/LeadStreamTab.tsx`, `lead-stream/OpportunityDashboard.tsx` | lead-stream cluster | with the cluster |
| `ScoutLeadStream.tsx` | market-research | likely `features/market-research/` |
| `EditDropdownMenu.tsx` | customers (per TD-FE-63) | likely `features/customers/` (sole consumer) |

Rule applied per file: **≥2 features → `shared/`; exactly 1 → that feature; 0 (only fed by a sibling residue file) → travels with that sibling.** If the trace surfaces a file whose ownership is genuinely unresolvable without a product decision, it is logged as a fresh `TD-FE` with a recommended owner rather than force-moved — but the working assumption is that all 6 + 3 resolve mechanically. No `features/lead-stream/` feature is created.

**Cross-stage import dependency (the residue depends on earlier-moved clusters).** `LeadsTable.tsx` imports `useAuth` + `jwtManager` (the §5.2 auth cluster) and `@/lib/api` (§5.3) — all of which relocate in **11b**, before the residue file itself relocates in **11d**. So 11b must **repoint LeadsTable's `@/hooks/useAuth` / `@/lib/jwt` / `@/lib/api` import lines in place** (the file stays put; only its import specifiers update) — otherwise those legacy paths break at the end of 11b. The §9 stage order (clusters in 11b, residue in 11d) is correct; this note makes the in-place repoint explicit so the plan accounts for it.

---

## §7 Styles → `src/shared/styles/`

- Move `src/styles/scrollbar-hide.css` and `src/index.css` (the Tailwind entry) into `src/shared/styles/`.
- Update `main.tsx`: `import "./index.css"` → `import "@/shared/styles/index.css"`; `import "./styles/scrollbar-hide.css"` → `import "@/shared/styles/scrollbar-hide.css"`.
- `tailwind.config` content globs are `./src/**/*.{ts,tsx}` only (no CSS-path reference) — **no Tailwind config change** needed.
- `src/App.css` liveness is checked in the trace: it is not imported by `main.tsx`/`App.tsx`; if confirmed dead it is deleted (logged), otherwise it moves to `shared/styles/` too. PostCSS/Vite resolve the moved entry by its new import path; no build-config edit expected (plan verifies the `vite build` output is byte-stable).

---

## §8 Capstone — lock the drain (DoD §6.1)

After all relocations:

1. **Delete** the now-empty `src/hooks/`, `src/lib/`, `src/utils/`. Confirm `src/contexts/`, `src/services/`, `src/pages/` are absent. `src/components/` contains **only** `ui/`.
2. **Tighten lint** — extend `import-x/no-restricted-paths` (the existing Phase-4a infra) with zones forbidding **both** `features/**` and `shared/**` from importing: `@/hooks/*`, `@/lib/*`, `@/utils/*`, `@/contexts/*`, `@/services/*`, `@/pages/*`, and non-`ui` `@/components/*` (i.e. `@/components/!(ui)/**`). **Blocking, not advisory** — it is a deterministic structural guard (no flakiness/machine-dependence), so it fits the pre-launch gate posture of dropping *noisy* gates while keeping cheap deterministic ones; it prevents regression of exactly what this phase achieves. (`components/ui/` keeps its existing `no-restricted-paths` ban on importing `features/`/`shared/`; the new `cn` co-location does not change that.)
3. **DoD §6.1 verification** (mechanical, run in preflight + asserted in the spec's done-when): `src/pages/` empty; `src/components/` = `ui/` only; legacy dirs gone; **no** `@/hooks|@/lib|@/utils|@/contexts|@/services|@/pages` import resolves anywhere under `features/` or `shared/`; **`components/ui/` imports no `@/hooks|@/lib|@/utils` path** (the three co-located utilities now resolve within `ui/`); all route imports resolve to feature folders.

---

## §9 Execution stages (likely 5-way sub-split; plan finalizes)

Each sub-phase is an independently green commit series (`npm run verify` + `prettier --check` on touched files), leaving the tree green per Spec 14 §5.7 sub-phase granularity. The two non-trivial pieces (ui-layer co-location vs lead-stream trace) are split into separate stages because their risk profiles differ — the ui-layer moves are well-bounded with a known resolution, the residue trace has potentially ambiguous ownership:

- **11a — clean promotes + single-consumer moves + styles.** Class A + B + §7. Lowest risk; broad-but-shallow import repointing.
- **11b — infra clusters.** Auth (§5.2) + api-transport (§5.3). Touches the widest import surface (4-feature api + 2-feature jwt + a public-barrel rename); also **repoints the lead-stream residue's `useAuth`/`jwt`/`api` import lines in place** (residue files relocate in 11d — see §6 cross-stage note).
- **11c — ui-layer co-locations.** `cn` + `use-toast` + `use-mobile` into `components/ui/` (§5.1) + ADR-0005. Well-bounded, high-consumer repointing with a known resolution; can ship independently of the residue trace.
- **11d — lead-stream residue.** Full consumer trace + per-file relocation (§6). The one stage with potentially ambiguous ownership.
- **11e — capstone.** §8: delete empty dirs, add lint zones, DoD verification, README/ADR finalize.

Commit style `type(fe): …`, no `[N/M]` suffix, no Co-Authored-By footer.

## §10 Testing, parity & safety net

- **Pure relocations ⇒ behavior frozen.** The safety net is the existing layered suite: relocated unit tests (moved with their subjects) + full Vitest + Playwright + visual regression, all of which must stay green. No new VR baselines (no visual surface changes).
- **Per-stage gate:** `npm run verify` (typecheck + lint + `test:changed`) + `prettier --check` on touched files; the **full** suite + e2e + `knip` + bundle run only at the merge-gate `npm run preflight`, run on an idle box (no sibling sandboxes in flight this phase, so contention is not a concern).
- **`knip` after relocation:** expect transient dead-code findings immediately after a move (old path briefly unreferenced before consumers repoint within the same stage). `knip` gates **only at the final `npm run preflight`** (merge gate), not per-stage — per-stage `verify` does not run it — so between-stage findings never block a stage; only the end-of-phase tree must be `knip`-clean.
- **Import-cycle watch:** consolidating auth (`jwt` + `useAuthToken` next to `AuthContext`) and the lead-stream `leadData → shared` promote could introduce a cycle; `import-x/no-cycle` (live) catches it. If a genuine cycle appears, the shared surface moves to `shared/types/` per §3.3.

## §11 Risks

1. **A ui-layer-consumed utility mishandled** (`cn`, `use-toast`, or `use-mobile` promoted to `shared/`, breaking `ui ↛ shared`). *Mitigated:* §5.1 enumerates the **complete** set (3, from grepping `ui/`'s imports) and mandates `components/ui/`; ADR-0005 records the rationale; the §8 lint + typecheck catch any regression. (Round 1 of spec review caught two of these — `use-mobile`, `use-toast` — that the first draft missed; the set is now verified exhaustive.) **Medium → Low.**
2. **api-transport repoint breaks a call site** (7 features + `shared/api`). *Mitigated:* pure move, byte-identical exports, typecheck proves every import resolves; the `/icp` bypass + rate-limit value are covered by existing `shared/api` tests. **Medium → Low.**
3. **`useAuth` rename misses a call site or changes token behavior.** *Mitigated:* single consumer (mission-control); rename is mechanical; the JWT-lifecycle effect body is moved verbatim. **Low.**
4. **Lead-stream trace surfaces an ambiguous owner.** *Mitigated:* §6 fallback — log a fresh TD-FE with a recommended owner rather than force-move; does not block the rest of the drain. **Low.**
5. **Styles move changes computed CSS / build output.** *Mitigated:* §7 keeps Tailwind config untouched; plan verifies `vite build` output and visual regression are stable. **Low.**
6. **New blocking lint zone over-fires on a legitimate import.** *Mitigated:* zones target only the drained legacy paths + non-`ui` components; `components/ui/*` and all `@/shared/*`/`@/features/*` imports are unaffected; validated against a green tree before the rule is set to error. **Low.**

## §12 TD-FE impact

**Resolves:** TD-FE-54 (`jwt`/`useAuth` → `shared/auth`), TD-FE-57 (`usePageTitle` → `shared/hooks`), TD-FE-62 (`leadStreamChatContext` ownership), TD-FE-63 (`components/market-research/` residue drained). Update each entry to **Resolved (Phase 11)** at merge, with the actual landing path.

**May add (only if the trace forces it):** a fresh `TD-FE-<n>` for any single residue file whose ownership needs a product decision (§6 fallback), or for `App.css` disposition if it turns out live-but-orphaned. Numbers claimed-by-creation; finalized at merge (master high-water is **63** post-Phase-9). No siblings in flight, so collision risk is nil.

## §13 Open questions resolved

- **Spec 14 §8 Q12 (`src/styles/` disposition):** RESOLVED — **move to `src/shared/styles/`** (§7).
- **Spec 14 §8 Q14 (Phase 11 standalone vs absorbed into Phase 13):** RESOLVED — **standalone** (§1.2.4); it carries the capstone lint-tightening that locks the drain, which Phase 13 (a content audit) is not the place for.
- Both resolutions are logged as master-plan deltas at merge (Spec 14 §5.5), and §8 Q12/Q14 annotated RESOLVED.

## §14 Done when

- `src/hooks/`, `src/lib/`, `src/utils/` are **deleted**; `src/contexts/`, `src/services/`, `src/pages/` confirmed gone; `src/components/` contains **only** `ui/`.
- Every §1.3 file lives at its §4 destination; the three ui-consumed utilities are co-located in `components/ui/` (`utils.ts`, `use-toast.ts`, `use-mobile.tsx`); the auth cluster (`jwt` + renamed `useAuthToken`) and api-transport (`transport.ts` + `rateLimitManager`) live under `shared/`; styles under `shared/styles/`.
- **No** `@/hooks|@/lib|@/utils|@/contexts|@/services|@/pages` or non-`ui` `@/components/*` import resolves anywhere under `features/` or `shared/`; the new `import-x/no-restricted-paths` zones are **blocking** and green.
- Lead-stream residue disposition table (§6) completed from a full trace; each file landed or logged.
- Relocated tests pass at their new paths; `npm run verify` + `prettier --check` green per stage; full `npm run preflight` (incl. visual regression + e2e) green at the gate.
- Affected per-feature `README.md`s and `shared/*/README.md`s updated; ADR-0005 (ui-layer-consumed utilities live in `components/ui/` — `cn`/`use-toast`/`use-mobile`) written.
- TD-FE-54/57/62/63 marked Resolved (Phase 11); §8 Q12/Q14 resolutions logged as Spec 14 deltas.
