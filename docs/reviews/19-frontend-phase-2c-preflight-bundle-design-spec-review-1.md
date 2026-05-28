---
artifact: specs/19-frontend-phase-2c-preflight-bundle-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-28
round: 1
---

## Findings

### [High] Factual error: current VR threshold is 1%, not 0.5%

**Location:** §1.2 ("captured against a 0.5% pixel-delta threshold"), §1.3 resolution 3 ("Up from Phase 0's 0.5%")

`frontend/playwright.config.ts:42` currently reads `maxDiffPixelRatio: 0.01` (1%), with a comment saying it "was maxDiffPixels: 100, an absolute count; now a ratio." The snapshots were not captured against a 0.5% threshold — the configured threshold is 1%. This undermines the justification's framing: the proposed change is a 2× loosening (1% → 2%), not the 4× loosening implied by "0.5% → 2%." The reasoning still holds (sub-pixel noise at 1% is real), but the spec misrepresents the starting state. Fix §1.2 to read "1%" and adjust the §1.3 resolution wording accordingly. The §3.4 amendment to Spec 14 §8 Q2 should also note the correct baseline.

### [Medium] Hash length assumption is wrong for CSS chunks

**Location:** §3.1 ("stripping the 8-char hash segment (`index-*.js`)")

The actual baseline contains `index-CqIc-MII.css`. The Vite content hash `CqIc-MII` is 9 characters and includes a hyphen. The spec asserts 8-char hashes, which is incorrect for at least one chunk. The plan author must implement a regex that matches the actual Vite `[name]-[hash][ext]` pattern without assuming fixed hash length, or use the glob `index-*.{js,css}` pattern the output sketch already uses. The spec should correct the "8-char" claim or defer the exact regex to the plan with a note that hashes are variable-length and may contain hyphens.

### [Medium] Ambiguity: does `bundle:rebaseline` invoke `capture-bundle-baseline.ts` or reimplement it?

**Location:** §3.1 ("overwrites the baseline JSON with the current `dist/` contents using `capture-bundle-baseline.ts`'s output shape")

The phrasing is ambiguous between two implementations: (a) `bundle:rebaseline` runs `vite build && tsx scripts/capture-bundle-baseline.ts`, reusing the existing script directly, or (b) it reimplements the same JSON shape inside `check-bundle-budget.ts` with a `--rebaseline` flag. The frozen-interface claim in §2.3 ("`bundle:rebaseline` produces the same shape") is compatible with either, but the implementation complexity differs. Open question 4 asks about `dist/` consumption vs. running `vite build` itself — that's orthogonal. The spec should explicitly state whether the re-baseline command delegates to `capture-bundle-baseline.ts` or reimplements, to avoid plan-author confusion.

### [Medium] Missing error/edge-case handling for standalone `bundle:check`

**Location:** §3.1 Behavior, §4 DoD item 6 ("`npm run bundle:check` and `npm run bundle:rebaseline` work standalone")

DoD item 6 requires standalone operation, but the behavior spec only covers the happy path (baseline exists, `dist/` populated). Unaddressed edge cases:

1. `dist/` does not exist — the script walks an empty/nonexistent directory. Should it exit 0 with a note, exit non-zero, or auto-build?
2. Baseline JSON does not exist or is malformed — the comparator reads and parses it; JSON parse failure is unhandled.
3. Baseline JSON `chunks` array is empty — degenerate but possible.

None of these affect preflight usage (where `build` precedes `bundle:check` and the baseline is committed), but standalone mode (DoD 6) makes them reachable. Recommend the spec add a brief error-case paragraph or explicitly scope DoD 6 to "assumes a prior `vite build` and committed baseline."

### [Medium] Risk R1 understates chunk count — "single-chunk reality" is imprecise

**Location:** §6 R1 ("the single-chunk reality of the current bundle")

The baseline contains 5 chunks: 1 large JS chunk (1.97 MB), 1 CSS chunk (102 KB), 2 workbox chunks, and `sw.js`. The hash-stripping matcher must handle all `*-[hash].{js,css}` patterns, not just `index-*.js`. The ambiguity risk applies to any base name that could plausibly produce multiple hashed variants after Phase 3 splitting (e.g., multiple CSS files, workbox-related chunks). The spec should say "single large JS chunk" rather than "single-chunk reality," and the matcher should be described as handling all `.js`/`.css` files, not just `index-*.js`.

### [Low] Spec 14 §6 DoD item 6 says "bundle-size budget" — amendment wording should be precise

**Location:** §3.4 ("Remove 'bundle-size budget' from the hard-fail list; reword as 'bundle-size comparator runs advisory'")

Spec 14 §6 item 6 currently reads: "`npm run preflight` runs typecheck + lint + Vitest + Playwright + visual regression + build + **bundle-size budget** + `knip --strict` and is required to pass." The amendment reclassifies the bundle check as advisory. However, the item also says "required to pass" — an advisory check that always exits 0 trivially satisfies "required to pass." The rewording should either (a) remove bundle-size from the "required to pass" enumeration entirely and add it as a separate informational line, or (b) clarify that "required to pass" applies to hard-fail checks only and bundle comparator is a separate advisory output. Otherwise the amended Spec 14 DoD will read ambiguously.

### [Low] `--no-progress` flag omitted from knip reference

**Location:** §1.2 ("knip --strict"), §3.3 proposed chain ("knip --strict")

The actual `package.json` preflight script uses `npx knip --strict --no-progress`. The spec consistently writes `knip --strict` without the `--no-progress` flag. While this doesn't affect functionality, the spec claims to describe the "current" and "proposed" chain exactly; omitting the flag creates a minor discrepancy between spec and `package.json`. The plan author should use the actual invocation.

### [Low] `bundle:check` placement in preflight chain — advisory exit never short-circuits, but ordering still matters

**Location:** §3.3 ("`bundle:check` — placed adjacent to its dependency `build`; advisory exit, so it never short-circuits the rest")

Placing `bundle:check` between `build` and `test:e2e` means the advisory output prints before the expensive Playwright run. This is fine for local development but has a subtle implication: if a future phase wires a hard-fail toggle, the placement between build and e2e means a bundle regression would block e2e (desirable). The spec should note this forward-compatibility benefit, since Phase 14's spec may introduce hard-fail behavior and the chain ordering from 2c will be the starting point.

### [Nit] Output sketch uses "KB" for gzip but baseline is in bytes

**Location:** §3.1 Output sketch ("525.7 KB")

The output sketch shows human-readable sizes (KB, MB). The baseline JSON stores raw bytes. This is clearly the intended behavior (the script formats bytes for display), but it's not explicitly stated. The plan author will naturally implement this; no action needed beyond confirming in the plan.

### [Nit] `frontend/scripts/README.md` scope is thin for a standalone file

**Location:** §3.5 Files touched ("~50 LOC: bundle re-baseline + VR re-baseline conventions")

A 50-line README for two commands and two conventions is appropriate but borderline. The plan author could alternatively document these conventions in the existing `capture-bundle-baseline.ts` file header comments and the Playwright config comments. No strong preference; the spec's choice is fine.

### [Nit] §3.4 amendment commit message example uses parenthetical scope not used elsewhere

**Location:** §3.4 ("`docs(spec-14): amend Phase 2c — bundle advisory, NFR dropped, VR 2%`")

The commit message uses `docs(spec-14):` scope, which differs from the convention established in CLAUDE.md ("`type(scope):` format (`refactor(be):`, `feat(fe):`, `docs(plans):`)"). The `docs(spec-14):` scope is reasonable but novel. The plan author should follow the spec's explicit instruction here since it's an intentional choice for traceability.
