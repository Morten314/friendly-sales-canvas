# Spec 31 — Frontend Phase 11: shared utility extraction

**Status:** Design — round 1
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
| `hooks/use-toast.ts` | 5 (auth, customers, market-research, mission-control, signals) | → `shared/hooks/` |
| `hooks/usePageTitle.ts` | 6 (artifacts, calendar, customers, market-research, reports, strategist) | → `shared/hooks/` (resolves **TD-FE-57**) |
| `hooks/use-mobile.tsx` | 1 (shell) | → `features/shell/` |
| `hooks/useAuth.ts` | 1 (mission-control) | → `shared/auth/` **renamed** (auth-infra; name collision — §5.2) |
| `lib/utils.ts` → `cn` | 31 `ui/` files + ~6 non-ui | → `components/ui/utils.ts` (zone-rule — §5.1) |
| `lib/utils.ts` → `sanitizeAnswerText` | (with above) | → `shared/lib/` |
| `lib/types/escape-hatches.ts` | 7 | → `shared/types/escape-hatches.ts` |
| `lib/jwt.ts` | 2 (market-research, mission-control) | → `shared/auth/` (resolves **TD-FE-54**) |
| `lib/api.ts` | 7 + `shared/api/client.ts` imports it | → `shared/api/transport.ts` (pure move — §5.3) |
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
- `components/ui/` may import **only** npm + itself — **not** `shared/` or `features/`. This is the binding constraint on `cn` (§5.1).
- `features/<X>/` may import `shared/*`, `components/ui/*`, npm, and own-feature files; cross-feature only via `features/<Y>/index.ts`.
- After the drain, **no `features/*` or `shared/*` file imports any legacy path** (`@/hooks`, `@/lib`, `@/utils`, `@/contexts`, `@/services`, `@/pages`, or non-`ui` `@/components/*`) — enforced by the §8 lint zones.

---

## §4 Disposition map

The relocations group into five mechanical classes plus the trace-resolved residue (§6).

**A — Clean promotes → `shared/` (low risk; ≥2 features, or shared-consumer-forced per the §1.1 corollary):**
`use-toast` (5 features), `usePageTitle` (6) → `shared/hooks/`; `cacheUtils` (5) and `sanitizeAnswerText` (1 feature + `shared/chat` consumer ⇒ corollary) → `shared/lib/`; `escape-hatches.ts` (7) → `shared/types/`. Repoint each consumer's import from `@/hooks|@/lib|@/utils` to `@/shared/...`. Co-located tests move alongside.

**B — Single-consumer → into owning feature:**
`use-mobile`, `PWAInstallPrompt` → `features/shell/`; `timestampUtils`, `apiUtils`, `leadStreamChatContext`, `MiniLineChart`, `MiniPieChart` → `features/market-research/` (placed under that feature's `hooks/`/`lib/`/`components/` per shape); `components/common/` → `features/customers/`. (Moving a single-consumer file into its feature is relocation, not "feature extraction" — consistent with Phase 11's lighter deliverables.)

**C — `cn` (zone-rule exception):** → `components/ui/utils.ts` (§5.1).

**D — Auth-infra cluster → `shared/auth/`:** `jwt.ts` + renamed `useAuth` hook (§5.2).

**E — api-transport (pure move) → `shared/api/`:** `lib/api.ts` → `shared/api/transport.ts`; `rateLimitManager.ts` → `shared/api/` (§5.3).

**F — Lead-stream residue + the 3 zero-consumer score libs:** resolved per-file by trace (§6).

---

## §5 The three load-bearing relocations

### 5.1 `cn` must co-locate with the primitives, not move to `shared/lib`

`lib/utils.ts` exports two symbols: `cn` (consumed by **31** `components/ui/*` files plus ~6 non-ui sites) and `sanitizeAnswerText`. The naive "move `lib/utils` → `shared/lib`" is **wrong**: §3.3 forbids `components/ui/` from importing `shared/`, so it would make every locked shadcn primitive illegally import upward.

Resolution: **split the file.**
- `cn` → `components/ui/utils.ts` (the only layer `ui/` may legally depend on is npm + itself). The 31 `ui/` files repoint to the **relative** `./utils`. Non-ui consumers (features + `shared/chat/ContextChat`) repoint to `@/components/ui/utils` — a legal **downward** import (`features → ui` is allowed; `shared → ui` is downward and not forbidden by §3.3).
- `sanitizeAnswerText` → `shared/lib/`. Its only *feature* consumer is `signals`, but `shared/chat/ContextChat.tsx` also consumes it — so the §1.1 shared-consumer corollary forces `shared/` placement (it cannot live in `features/signals/` without `shared/chat` illegally importing a feature). `signals` repoints to `@/shared/lib`.

This empties `lib/utils.ts` while keeping all four zone rules intact. Captured as a short ADR (`docs/adr/0005-cn-lives-with-ui-primitives.md`) since it's a non-obvious placement that future feature work will hit.

### 5.2 `useAuth` is a composition hook — rename, don't delete

`hooks/useAuth.ts` is **not** a shim: it composes `shared/auth`'s Firebase `useAuth` + `shared/tenant`'s `useTenant` + `jwt.ts` to manage the JWT-token lifecycle (generate-on-auth, clear-on-logout). It collides by name with `shared/auth`'s exported `useAuth` (flagged in TECH_DEBT). Resolution:
- Move it to `shared/auth/` and **rename** to a non-colliding, intent-revealing name (proposed `useAuthToken`; plan finalizes). Export it from `shared/auth/index.ts` alongside the Firebase `useAuth`.
- It belongs in `shared/auth/` (auth-infra exception to the ≥2-rule) because it sits on `jwt.ts` (also moving to `shared/auth/`) and composes the two shared context primitives — keeping the whole auth+JWT story in one place and resolving the collision. Its single current consumer (`mission-control`) updates one import + the call name.

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
3. **DoD §6.1 verification** (mechanical, run in preflight + asserted in the spec's done-when): `src/pages/` empty; `src/components/` = `ui/` only; legacy dirs gone; **no** `@/hooks|@/lib|@/utils|@/contexts|@/services|@/pages` import resolves anywhere under `features/` or `shared/`; all route imports resolve to feature folders.

---

## §9 Execution stages (likely 4-way sub-split; plan finalizes)

Each sub-phase is an independently green commit series (`npm run verify` + `prettier --check` on touched files), leaving the tree green per Spec 14 §5.7 sub-phase granularity:

- **11a — clean promotes + single-consumer moves + styles.** Class A + B + §7. Lowest risk; broad-but-shallow import repointing.
- **11b — infra clusters.** Auth (§5.2) + api-transport (§5.3). Isolated because they touch the widest import surface (7-feature api + 2-feature jwt) and a public-barrel rename.
- **11c — `cn` split + lead-stream residue.** §5.1 (the 31 `ui/` repoints + ADR-0005) and §6 (trace-resolved relocations). The two non-trivial structural pieces.
- **11d — capstone.** §8: delete empty dirs, add lint zones, DoD verification, README/ADR finalize.

Commit style `type(fe): …`, no `[N/M]` suffix, no Co-Authored-By footer.

## §10 Testing, parity & safety net

- **Pure relocations ⇒ behavior frozen.** The safety net is the existing layered suite: relocated unit tests (moved with their subjects) + full Vitest + Playwright + visual regression, all of which must stay green. No new VR baselines (no visual surface changes).
- **Per-stage gate:** `npm run verify` (typecheck + lint + `test:changed`) + `prettier --check` on touched files; the **full** suite + e2e + `knip` + bundle run only at the merge-gate `npm run preflight`, run on an idle box (no sibling sandboxes in flight this phase, so contention is not a concern).
- **`knip` after relocation:** expect transient dead-code findings immediately after a move (old path briefly unreferenced before consumers repoint within the same stage) — confirm expected, not a blocker.
- **Import-cycle watch:** consolidating auth (`jwt` + `useAuthToken` next to `AuthContext`) and the lead-stream `leadData → shared` promote could introduce a cycle; `import-x/no-cycle` (live) catches it. If a genuine cycle appears, the shared surface moves to `shared/types/` per §3.3.

## §11 Risks

1. **`cn` zone-rule mishandled** (moved to `shared/lib`, breaking the `ui ↛ shared` rule). *Mitigated:* §5.1 mandates `components/ui/utils.ts`; ADR-0005 records the rationale; lint + typecheck catch a regression. **Medium → Low.**
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
- Every §1.3 file lives at its §4 destination; `cn` is at `components/ui/utils.ts`; the auth cluster (`jwt` + renamed `useAuthToken`) and api-transport (`transport.ts` + `rateLimitManager`) live under `shared/`; styles under `shared/styles/`.
- **No** `@/hooks|@/lib|@/utils|@/contexts|@/services|@/pages` or non-`ui` `@/components/*` import resolves anywhere under `features/` or `shared/`; the new `import-x/no-restricted-paths` zones are **blocking** and green.
- Lead-stream residue disposition table (§6) completed from a full trace; each file landed or logged.
- Relocated tests pass at their new paths; `npm run verify` + `prettier --check` green per stage; full `npm run preflight` (incl. visual regression + e2e) green at the gate.
- Affected per-feature `README.md`s and `shared/*/README.md`s updated; ADR-0005 (`cn` placement) written.
- TD-FE-54/57/62/63 marked Resolved (Phase 11); §8 Q12/Q14 resolutions logged as Spec 14 deltas.
