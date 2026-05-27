---
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 6
---

## Context

Round 6. All five prior-round findings are resolved in the current text. This round re-examined the full spec (395 lines) against the live codebase where relevant, looking for new issues.

## Findings

### [Low] `<any>` regex alternative catches ~25 generic-position `any` matches the spec says are excluded

**Location:** §1.3 "Existing inline `any` count" row (line 40), §3 Step 5 verification item 3 (line 320), §4 item 6 (line 348)

The spec states:

> "Coverage scope: counts `any` in type-annotation (`: any`), assertion (`as any`), and cast (`<any>`) positions only. It does not count `any` in generic type-argument positions (e.g., `Record<string, any>`, `Promise<any>`, `Array<any>`, `Partial<any>`)."

The third regex alternative `<any>` matches the literal string `<any>` regardless of surrounding context. Verified against the live codebase: the `<any>` alternative produces **~25 matches**, all of which are generic type arguments (`Promise<any>`, `useState<any>(null)`, `ComponentType<any>`, `FormEvent<any>`, etc.) — **zero** are angle-bracket type casts. The total combined-regex count is 238 (confirmed with `grep -E ':\s*any\b|as\s+any\b|<any>'` against the current tree), matching the spec's baseline.

The breakdown: `Record<string, any>` is genuinely excluded (no `<any>` substring), but `Promise<any>`, `Array<any>`, and `Partial<any>` — all cited as excluded — **are** caught by the `<any>` alternative because they contain the literal `<any>`. The spec's characterization is factually incorrect for single-argument generics.

**Impact on the gate:** none. The §4 item 6 non-regression gate (≤238) uses the same regex as the baseline measurement, so the delta property holds. No net-new `any` of any measured form can slip through. But the characterization misleads a reader about what the 238 count actually contains, and the claim "Actual prevalence is higher" is slightly overstated — single-arg generics like `Promise<any>` are already included.

**Fix:** either (a) correct the characterization to "does not count `any` in multi-argument generic positions (e.g., `Record<string, any>`, `Map<string, any>`) — single-argument generics like `Promise<any>` are caught by the `<any>` alternative," or (b) accept the inaccuracy as harmless and add a brief note: "the `<any>` alternative incidentally matches single-argument generic positions; the 238 count includes these." Option (a) is more precise.

### [Nit] §1.1 parenthetical misattributes dead-shadcn compilation failure to strict mode

**Location:** §1.1 bullet 5 (line 20)

> "The 15 dead shadcn primitive files whose npm dependencies Phase 1 removed are deleted (they fail to compile under strict and have zero inbound references)."

These files fail to compile because Phase 1 removed their npm dependencies — the TS2307 errors ("cannot find module") are module-resolution failures, not strict-mode enforcement. They would fail identically under the current non-strict settings. The parenthetical "under strict" implies causation that isn't there.

**Fix:** s/they fail to compile under strict/they fail to compile (TS2307 missing-module errors from Phase 1's npm-dep removal)/.

### [Nit] Step 1b co-commit justification slightly overstated

**Location:** §3 Step 1b (line 201)

> "the spec keeps them in one commit because reverting any one of the three without the others would leave the repo in an inconsistent state"

Reverting the root-config override removal alone (edit 3) while keeping the flag flip (edit 1) and script fix (edit 2) would have zero functional impact — `tsconfig.app.json` is standalone and the root config's `"files": []` puts nothing under its compilerOptions. Only the script-fix/flag-flip pair creates meaningful inconsistency if split. The co-commit decision is still correct (atomic related changes); the justification just conflates the housekeeping edit with the functional ones.

**Fix:** narrow the claim to the two functional edits — "reverting the flag flip without the script fix (or vice versa) would leave the repo in an inconsistent state" — and note the root-config cleanup rides along for atomicity, not because it creates inconsistency.
