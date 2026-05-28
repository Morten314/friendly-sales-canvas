---
artifact: phase-2b-eslint-prettier
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-28
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Spec and plan auto-discovered from `specs/18-frontend-phase-2b-eslint-prettier-design.md` and `plans/18-frontend-phase-2b-eslint-prettier.md`. Branch `phase-2b-eslint-prettier` contains 75 commits diverging from `master` (16 Wave A style, 41 Wave B/C/D refactor/fix, remainder docs/chore/config). Aggregate diff: 233 files changed, +32,772 / −25,518 lines (dominated by Wave A Prettier mass-format and the MarketResearch.tsx monolith).

Verified at HEAD: `npm run lint` → 0 errors / 0 warnings; `npm run typecheck` → clean; `npx vitest run` → 83/83 pass. `npm run format:check` could not be verified directly (binary permission issue in the execution environment); scorecard §10 item 4 reports it green.

The Step 0 re-baseline measured 1,087 problems (vs spec's design-time 392 anchor) — the gap is from `import-x/order` (503 newly-wired errors), type-aware rules (`no-floating-promises` / `no-misused-promises`), and `consistent-type-imports` surfacing under the new `--max-warnings 0` posture. The spec anticipated this via §1.5 threshold gates; the plan and execution accommodated it correctly.

## Findings

### [Medium] 33 `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions across production code

**Location:** Production files under `frontend/src/` (33 unique disable lines per scorecard §5 `exhaustive-deps` row).

The spec's §2.4 posture rule 10 explicitly allows per-site `eslint-disable-next-line react-hooks/exhaustive-deps` with one-line justification. The 33 suppressions are spec-compliant in that they carry justification comments (required by the spec). However, 33 intentional dependency omissions in effects across the codebase is a meaningful code-health signal. Common patterns include effects that deliberately read a value without subscribing to its changes (single-shot fetches on mount, reading a ref, stale-closure-by-design). Each is defensible in isolation, but the aggregate volume suggests many components have effect dependencies that are intentionally incomplete — a pattern that makes future refactoring risky (changing a "stable" dependency silently breaks the effect's assumptions).

This is not a spec violation and no action is required for merge. Flagging so it's on the radar for future Phase 3/4 refactoring when `useCallback` / `useMemo` discipline or TanStack Query adoption may reduce the count.

### [Low] Scorecard §10 item 1 claims "3 override zones" but `eslint.config.js` contains 4

**Location:** `frontend/eslint.config.js:64-76` (contexts override zone) and `docs/audits/2026-05-28-frontend-phase-2b-eslint-prettier.md` §10 table row 1.

The spec's §3.3 defines 3 override zones (shadcn ui, root configs, test files). The implementation added a 4th zone during Step 6 residual fixes:

```js
{
  files: ["src/contexts/**", "src/components/customers/LeadStream.tsx"],
  rules: {
    "react-refresh/only-export-components": "off",
  },
},
```

This is a reasonable execution-time decision (contexts co-export hooks + providers by design; splitting them is gratuitous). The scorecard's verification table row 1 says "3 override zones" which is factually inaccurate — it should say 4 (or enumerate them). The spec's done-when item 1 lists "3 override zones" as well, so the implementation technically deviates from the spec's frozen count. The deviation is benign but should be documented explicitly in the scorecard as a plan-stage decision rather than passing the verification item as-is.

### [Low] `tsconfig.node.json` `include` scope extended beyond declared scope

**Location:** `frontend/tsconfig.node.json` (modified in residual fix `35d4d3c`).

The spec §2.2 explicitly defers `tsconfig.node.json` flag changes. The Step 6 residual fix extended `include` to cover `vitest.config.ts`, `playwright.config.ts`, `tailwind.config.ts`, `scripts/**/*.ts`, and `e2e/**/*.ts` to resolve 26 parser errors that blocked `--max-warnings 0`. The change is necessary and correct (the previous config only included `vite.config.ts`), but it's technically scope creep beyond the spec's declared in-scope / out-of-scope boundaries. The scorecard documents it under "Additional Deviations and Notes" (§7), which is the right place for it. Noting for traceability.

### [Nit] `services/api.ts` method returns narrowed from `any` to `unknown`

**Location:** `frontend/src/services/api.ts:31-46` (`get`, `post`, `put`, `delete`, `getTenantData`, `postTenantData`, etc.).

All CRUD methods now return `Promise<unknown>` instead of `Promise<any>`. This forces every caller to add a type assertion (`as ExpectedType`) at each use site. The file is the secondary API client (per AGENTS.md, `lib/api.ts`'s `apiFetch` is the primary), so blast radius is limited. The tightening is correct per the spec's posture. A future phase could add generic type parameters (`get<T>(endpoint: string): Promise<T>`) to avoid the assertion tax, but that's Phase 3+ territory.

### [Nit] `profilerAcceptedIcpDisplay.ts` helper functions are well-extracted but slightly over-engineered for current call volume

**Location:** `frontend/src/utils/profilerAcceptedIcpDisplay.ts:18-28` (`asString`, `firstString`, `asArray`).

Three utility functions (`asString`, `firstString`, `asArray`) were introduced to replace inline `any` access patterns with `unknown`-safe narrowing. Each is used only within this single file (2–4 call sites each). The extraction is clean and well-named, but for a file that's unlikely to see further callers, inline narrowing (`typeof x === "string" ? x : ""`) at each site would have been equally clear with less indirection. The spec's §2.4 posture rule 1 says "add the proper type or apply the canonical lint-fix" — the helpers go slightly beyond the minimum needed to satisfy the lint rule. Not a problem, just noting for the record.

### [Nit] `LeadStream.tsx` mock data expanded from compact to verbose object format

**Location:** `frontend/src/components/customers/LeadStream.tsx:53-187`.

Wave A's Prettier formatting expanded the `mockLeads` array from single-line object literals to multi-line (one property per line). This is purely Prettier's `printWidth` enforcement and is the expected Wave A behavior. The 6 mock objects went from ~6 lines each to ~10 lines each, adding ~24 lines. Expected and benign — the `.git-blame-ignore-revs` correctly shields these from blame.
