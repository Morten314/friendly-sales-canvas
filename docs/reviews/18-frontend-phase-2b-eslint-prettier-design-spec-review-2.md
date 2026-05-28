---
artifact: specs/18-frontend-phase-2b-eslint-prettier-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-28
round: 2
---

## Context

Round 2 review of spec 18 after round 1 synthesis (`docs/reviews/18-frontend-phase-2b-eslint-prettier-design-spec-synthesis-1.md`) was incorporated. Verified against live codebase at commit `c7dc5d8` (round 2 spec revision) on branch `phase-2b-eslint-prettier`.

Cross-checked: `eslint .` output (392 problems: 336 errors, 56 warnings), per-rule breakdown, `eslint.config.js`, `tsconfig.app.json`, `package.json` scripts and deps, `src/lib/types/escape-hatches.ts` (6 entries), `@ts-*` suppression count (5), absence of `.prettierrc`/`.prettierignore`/`.git-blame-ignore-revs`, `e2e/` file extensions, `src/styles/` contents, Node.js version (v22.13.0).

## Verified correct (no findings)

- §1.3 per-rule breakdown matches live `eslint .` output exactly: 233 `no-explicit-any`, 46 `no-empty`, 35 `exhaustive-deps`, 16 `no-useless-escape`, 13 unused directives, 11 `ban-types`, 9 `no-unsafe-assignment`, 8 `only-export-components`, 6 `no-unsafe-return`, 3 `no-unsafe-member-access`, 3 `no-empty-object-type`, 2 `no-unused-expressions`, 2 `no-control-regex`, 2 `ban-ts-comment`, 1 `rules-of-hooks`, 1 `no-case-declarations`, 1 `no-require-imports`.
- §1.3 totals: 392 problems (336 errors, 56 warnings) — confirmed.
- §1.3 `@ts-*` suppression count = 5 — confirmed.
- §1.3 escape-hatches file present with 6 entries — confirmed.
- §1.3 Prettier not installed — confirmed.
- §1.3 `eslint-plugin-import-x` not installed — confirmed.
- §1.3 `tsconfig.app.json` strict config — confirmed (`strict`, `noUnusedLocals`, `noUnusedParameters` all `true`).
- §1.3 `lint` script = `eslint .` (no `--max-warnings`) — confirmed.
- Round 1 synthesis correctly incorporated (C1, C2, C3, H1–H3, M2–M6, L1–L3, N1–N3 all addressed).

## Findings

### Medium

#### M1 — `import.meta.dirname` Node version dependency undocumented

**Location:** §3.2 ESLint type-aware parser config

The config excerpt uses `tsconfigRootDir: import.meta.dirname`. This API requires Node.js ≥21.2.0. The project runs Node v22.13.0 (verified), so it works today. However, `typescript-eslint@^8.0.1` and ESLint v9 only require Node ≥18. A contributor using Node 20.x (current LTS) would get a runtime error at config load time.

The spec makes no mention of this version dependency. The plan stage or a one-line note in §3.2 would prevent a confusing failure mode.

**Recommendation:** Add a note in §3.2 that `import.meta.dirname` requires Node ≥21.2, or have the plan stage use `fileURLToPath` + `dirname` from `node:url` for broader compat.

### Low

#### L1 — `react-hooks/rules-of-hooks` (1) fix categorized as "manual mechanical residue" in Wave B but may need semantic restructuring

**Location:** §4 Step 3 Wave B — Manual mechanical residue

The spec describes the single `rules-of-hooks` violation as "bug fix; restructure the hook call to satisfy ordering rules" and bundles it with `no-useless-escape`, `no-case-declarations`, etc. under "manual mechanical residue." While a hooks-ordering fix is often small, it can require significant restructuring (e.g., moving a hook call out of a conditional, splitting a component). The spec does include a behavior-verification guard ("Verify behavior unchanged — run Vitest + visual regression"), which mitigates the risk.

With only 1 violation, the practical impact is negligible. The finding is about categorization accuracy: this fix belongs with Wave D's "per-site semantic fixes" rather than Wave B's "mechanical" bucket. The existing verification guard makes this a Low-severity concern.

#### L2 — §5 done-when item 6 verification includes `npm run preflight` which requires a running dev server for Playwright

**Location:** §5 item 6, §4 Step 6 verification checklist

Step 6's verification runs `npm run preflight` end-to-end. The preflight chain includes `test:e2e` (Playwright), which requires a dev server. This dependency is inherited from Phase 1's preflight definition and is not a Phase 2b concern. Noting for completeness only — no spec change needed.

### Nit

#### N1 — Bold formatting in data table cell

**Location:** §1.3 table row "Current `eslint .` baseline"

The cell uses `**392 problems (336 errors, 56 warnings)**` with Markdown bold. Renders correctly but is inconsistent with other numeric cells in the same table.

## Round recommendation

**Yes.** The spec is ready for plan writing. Round 1's three Critical findings were correctly resolved. The two Medium/Low findings (M1: Node version note, L1: rules-of-hooks categorization) are minor enough to address in the plan stage or with one-line spec revisions. Neither blocks plan authoring. The methodology is sound, posture rules prevent scope creep, and all verified numbers match reality.
