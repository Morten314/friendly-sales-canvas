# Spec 19 — Frontend Phase 2c: Preflight Gates + Bundle Comparator

**Status:** Design — round 2 (rounds 1 and 2 reviews synthesized at `docs/reviews/19-frontend-phase-2c-preflight-bundle-design-spec-synthesis-1.md` and `…-synthesis-2.md`)
**Date:** 2026-05-28
**Type:** Phase spec (paired plan: `plans/19-frontend-phase-2c-preflight-bundle.md`, to be written)
**Master plan:** `specs/14-frontend-refactoring-master-plan-design.md` §4 Phase 2c

---

## §1 Goal and context

### 1.1 Goal

Wire a bundle-size comparator script into `npm run preflight` (advisory mode), lock the Playwright visual-regression threshold at the value Brewra wants, finalize the preflight chain order, and amend master Spec 14 to reflect the resolutions reached during this phase's brainstorm. This is the last foundation phase before the API/data-layer work in Phase 3.

### 1.2 Starting state (post-Phase-2b, 2026-05-28)

The preflight chain after Phase 2b's merge runs:

```
typecheck → lint → format:check → build → test:e2e → test → knip --strict --no-progress
```

All checks green. Phase 0's bundle baseline (`docs/audits/2026-05-26-frontend-bundle-baseline.json`) and NFR baseline (`docs/audits/2026-05-26-frontend-nfr-baseline.json`) are committed. Visual-regression snapshots are locked in `frontend/e2e/**-snapshots/` from Phase 0a, captured against a 1% pixel-delta threshold (`frontend/playwright.config.ts:42` — `maxDiffPixelRatio: 0.01`, at the top of master Spec 14's 0.5–1.0% mandated range).

### 1.3 Resolutions reached during brainstorming

Three master-spec items get resolved in this phase rather than punted further:

1. **Bundle-size gate posture: advisory only.** The bundle comparator script prints deltas and always exits 0. It does not block merge. Reasoning: pre-launch MVP, 0 users, no user-perceptible bundle cost yet; the script provides paper-trail data for when the team wants to harden it later.
2. **NFR wall-time budgets: dropped.** No `tsc` / Vitest / preflight-total wall-time gating in Phase 2c. Reasoning: wall-time is noisy and machine-dependent; the "agent velocity" rationale doesn't justify a flaky gate for a pre-launch MVP. Phase 14 may reintroduce.
3. **Visual regression threshold: 2% (max pixel-delta ratio).** Up from Phase 0's 1% (which sits at the top of master Spec 14's mandated 0.5–1.0% range); 2% widens past the range — a 2× loosening. Reasoning: 1% still over-fires on sub-pixel rendering differences (font hinting, anti-aliasing, GPU rendering variation) that aren't real regressions; 2% retains genuine-regression coverage while reducing false-positive friction. A moved button, recolored header, or shifted card grid still blows well past 2%.

All three trigger amendments to master Spec 14 — see §3.4 below.

---

## §2 Scope

### 2.1 In scope

- `frontend/scripts/check-bundle-budget.ts` — new script, advisory mode
- `frontend/scripts/README.md` — new file documenting bundle re-baseline + VR re-baseline conventions
- `frontend/package.json` — `preflight` chain reorder + `bundle:check` and `bundle:rebaseline` scripts
- `frontend/playwright.config.ts` — lock `expect.toHaveScreenshot.maxDiffPixelRatio: 0.02`
- `specs/14-frontend-refactoring-master-plan-design.md` — amendments per §3.4

### 2.2 Out of scope

- **NFR wall-time enforcement.** No script, no measurement, no gate. The Phase 0 NFR baseline JSON stays committed as historical data.
- **Hard-fail bundle gate.** Advisory only. A future toggle is feasible (one-line behavioral change) but is not wired in this phase.
- **Bundle chunking strategy.** The single 1.97 MB JS chunk is a real concern but belongs in Phase 3 (TanStack Query landing) and per-feature extractions, not Phase 2c.
- **CI / external runner.** Confirmed by master Spec 14 §8 Q8.
- **Re-baselining the existing Phase 0 VR snapshots.** Loosening the threshold from 1% to 2% does not invalidate stricter snapshots. The captured PNGs stay as-is.
- **Snapshot-locking `src/components/ui/`, knip ignore overrides, ESLint config changes** — Phase-4-onward territory.

### 2.3 Frozen interfaces

- Phase 0 baseline JSONs stay at their current paths. The comparator reads `docs/audits/2026-05-26-frontend-bundle-baseline.json` directly.
- Existing preflight scripts (`typecheck`, `lint`, `format:check`, `build`, `test`, `test:e2e`) keep their current `package.json` definitions. The composite `preflight` script is reordered and extended with `bundle:check`; individual sub-script definitions are unchanged.
- Existing Playwright snapshots in `frontend/e2e/**-snapshots/` are not regenerated.
- The `capture-bundle-baseline.ts` script's output JSON shape is the canonical bundle-baseline format; `bundle:rebaseline` produces the same shape.

---

## §3 Design

### 3.1 Bundle comparator

**Script:** `frontend/scripts/check-bundle-budget.ts`. Runtime: `tsx` (already in deps).

**Inputs:**
- Baseline JSON: `docs/audits/2026-05-26-frontend-bundle-baseline.json` (path overridable via `BUNDLE_BASELINE_PATH` env var for future-phase use)
- Current build: `frontend/dist/**`

**Behavior:**
1. Walk `frontend/dist/` and sum `.js` + `.css` raw bytes and gzipped bytes (mirroring `capture-bundle-baseline.ts`'s aggregation).
2. Compare against baseline:
   - `total_size_bytes` delta (absolute + percentage)
   - `total_size_gzip_bytes` delta (absolute + percentage)
   - Per-chunk deltas for files >10KB raw present in both baseline and current
   - List of files added to or removed from the chunk set
3. Print a compact two-column table to stdout (see sketch below).
4. **Always exit 0.** Mode is advisory.

**Hash-stable file matching:** Vite emits hashed chunk filenames (`index-DoZK05uc.js`, `index-CqIc-MII.css`). Hashes are variable-length and may contain hyphens (Vite's default base64-style hash). The comparator matches files across baseline and current using Vite's `[name]-[hash][ext]` shape — glob-based (`<name>-*.{js,css}`), not assuming a fixed hash length. Exact regex/glob form is the plan author's call per §7 Q2. If matching is ambiguous (multiple chunks share the same base name on either side), the comparator falls back to aggregate totals only and prints a note. The current bundle has 5 files (1 large JS chunk, 1 CSS chunk, 2 workbox files, `sw.js`) and no two share a base name — ambiguity is a non-issue today; when Phase 3+ introduces chunk splitting, the matcher gets revisited.

**Output sketch:**

```
$ npm run bundle:check
Bundle vs baseline (docs/audits/2026-05-26-frontend-bundle-baseline.json)

                  Baseline       Current        Delta
Total (raw)       2.09 MB        2.11 MB       +20.0 KB  (+0.95%)
Total (gzip)      525.7 KB       528.9 KB      +3.2 KB   (+0.61%)

Chunks > 10KB:
  index-*.js      1.97 MB        1.99 MB       +20.0 KB  (+1.01%)
  index-*.css    102.5 KB       102.5 KB       +0.0 KB   (+0.00%)

(advisory — exit 0)
```

**Re-baseline command:** `npm run bundle:rebaseline`. Delegates to the existing `capture-bundle-baseline.ts` — implemented as `vite build && tsx scripts/capture-bundle-baseline.ts`. No reimplementation of the JSON shape inside `check-bundle-budget.ts`. The developer commits the regenerated baseline as part of whatever PR legitimately grew the bundle; commit message convention `chore(fe): re-baseline bundle for <reason>`.

**Error handling (standalone mode):** the DoD requires `bundle:check` to work standalone, which exposes infrastructure error paths. Handling:
- Missing `frontend/dist/`: print `no dist/ found; run npm run build first` and exit non-zero. (Unreachable inside the preflight chain because `build` runs first.)
- Missing baseline JSON: print `baseline not found at <path>; run npm run bundle:rebaseline to create one` and exit non-zero.
- Malformed baseline JSON (parse error): print `baseline JSON malformed at <path>; expected shape from capture-bundle-baseline.ts` and exit non-zero.
- Empty `chunks` array: handled gracefully — totals print normally, per-chunk table suppressed.

Advisory exit-0 applies to the *comparator-success* path (build present, baseline present, comparison produced). Infrastructure errors are not advisory.

### 3.2 Visual regression threshold

**Location:** `frontend/playwright.config.ts`. Set globally so every screenshot assertion inherits it. Only `maxDiffPixelRatio` changes; the existing `threshold` and `animations` properties (which affect screenshot stability) are preserved:

```ts
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.02, // changed: was 0.01 (1%); now 2%
    threshold: 0.2,          // unchanged: per-pixel color tolerance
    animations: "disabled",  // unchanged
  },
},
```

**Re-baseline workflow:** documented in `frontend/scripts/README.md`. Command: `npm run test:e2e:update-snapshots` (already exists from Phase 0). Convention:
- Run only when an intentional visual change is being introduced.
- Commit the regenerated PNGs in the same commit as the code change.
- Commit message: `chore(fe): re-baseline VR for <reason>`, or include a body line explaining the visual change.
- Reviewer confirms the visual change was intentional by inspecting the new PNG files.

**During the refactor (Phases 0–14):** master Spec 14 §2.2 forbids visual redesign during refactor phases. A VR failure is presumed to be a regression bug and investigated. Re-baselining is only justified when the structural extraction surfaces an unavoidable sub-pixel difference (e.g., a deliberate font-weight fix); in such cases the commit message explains why. Post-refactor (or for an explicit redesign phase later), re-baselining becomes routine.

### 3.3 Preflight chain reorder

**Current** (post-Phase-2b):
```
typecheck && lint && format:check && build && test:e2e && test && knip --strict --no-progress
```

**Proposed:**
```
typecheck && lint && format:check && test && build && bundle:check && test:e2e && knip --strict --no-progress
```

**Rationale (fail-fast):**
- `typecheck`, `lint`, `format:check` — already in lead; sub-2s; catch easy bugs first.
- `test` (Vitest, ~33s) — moved ahead of `build` because unit tests catch component-level breakage without needing a full bundle.
- `build` — required before `bundle:check` (which consumes `dist/`). Note that Playwright's `webServer.command` (`playwright.config.ts:29`) is `npm run build && npm run preview`, so Playwright rebuilds `dist/` itself regardless of the chain's prior `build` step; the chain's explicit `build` exists for `bundle:check`, not `test:e2e`. The resulting double-build is a pre-existing inefficiency, out of scope for Phase 2c.
- `bundle:check` — placed adjacent to its dependency `build`; advisory exit, so it never short-circuits the rest.
- `test:e2e` (Playwright, ~51s) — the slowest gate; runs after the cheaper ones have a chance to red-flag.
- `knip --strict` — last; dead-code analysis isn't load-bearing for fail-fast.

Net effect on a red preflight: a Vitest failure surfaces ~50s earlier on average (today the runner sits through `build` and `test:e2e` first). Net effect on a green preflight: trivial — same checks all run; total wall-time within noise.

**Forward-compatibility note:** placing `bundle:check` between `build` and `test:e2e` means a future hard-fail toggle (e.g., introduced by Phase 14's bundle watcher) would block Playwright on a bundle regression. That's the right gate ordering — a bundle regression is cheaper to investigate before a long Playwright run than after. Phase 2c's advisory placement is the precursor; the chain order won't need to change when that toggle flips.

### 3.4 Master Spec 14 amendments

In a single commit on the Phase 2c branch (before merge), amend `specs/14-frontend-refactoring-master-plan-design.md`:

- **§4 Phase 2c block** rewritten:
  - Drop the NFR threshold deliverable and the round-2 ballparks (typecheck ≤30s, Vitest ≤60s, preflight ≤8min)
  - Bundle-size deliverable reclassified as advisory (no hard-fail threshold)
  - Visual regression threshold codified at **2%** (Phase 0 settled at 1%, the top of the 0.5–1.0% mandated range; 2% widens past it — the deviation is recorded here as a resolution)
  - Preflight chain order updated to match §3.3 above
- **§6 Definition of done item 6** updated:
  - Remove "bundle-size budget" from the "required to pass" enumeration in item 6 (currently lists `typecheck + lint + Vitest + Playwright + visual regression + build + bundle-size budget + knip --strict`)
  - Add a separate sentence stating the bundle comparator runs advisory in `npm run preflight` and does not gate merge. The "required to pass" wording stays unambiguous because the bundle check is explicitly outside that set
  - Remove the implied NFR wall-time gate language
- **§8 Open questions:**
  - Q2 (visual regression threshold) — mark RESOLVED at 2%; note the deviation from the 0.5–1.0% range
  - Q3 (NFR budget values) — mark RESOLVED: dropped from Phase 2c; Phase 14 reconsiders
- **§4 Phase 14 block:** bundle-size watcher (warn +5% / fail +10%) entry stays as-is — Phase 14 owns its own scope decision. Phase 2c's advisory comparator is the precursor; the watcher entry's "Phase 14's spec finalizes" wording remains accurate.

The amendment commit is its own commit (`docs(spec-14): amend Phase 2c — bundle advisory, NFR dropped, VR 2%`) rather than mixed with the code change, so the spec evolution is reviewable as one unit.

### 3.5 Files touched

| File | Change |
|---|---|
| `frontend/scripts/check-bundle-budget.ts` | New (~150 LOC: comparator logic, hash-stripping matcher, table formatter) |
| `frontend/scripts/README.md` | New (~50 LOC: bundle re-baseline + VR re-baseline conventions) |
| `frontend/playwright.config.ts` | ~1 LOC changed (single value edit `maxDiffPixelRatio: 0.01 → 0.02`); existing `threshold` and `animations` preserved |
| `frontend/package.json` | `preflight` order changed; `bundle:check` + `bundle:rebaseline` added to `scripts` |
| `specs/14-frontend-refactoring-master-plan-design.md` | Amendments per §3.4 |

---

## §4 Definition of done

1. `frontend/scripts/check-bundle-budget.ts` exists; runs against Phase 0 baseline; prints comparator table; exits 0.
2. `frontend/scripts/README.md` documents bundle re-baseline command + VR re-baseline command + conventions.
3. `frontend/playwright.config.ts` has `maxDiffPixelRatio: 0.02` set globally; existing snapshots still match.
4. `frontend/package.json` `preflight` runs in the order from §3.3, ending with `knip --strict`.
5. `npm run preflight` green on the phase branch immediately before merge.
6. `npm run bundle:check` and `npm run bundle:rebaseline` work standalone.
7. Master Spec 14 amendments per §3.4 merged in the same phase branch as a dedicated `docs(spec-14): …` commit.

---

## §5 Per-phase workflow

Standard master Spec 14 §5 cycle:

1. Brainstorm → this spec
2. `/review-spec` → `docs/reviews/19-frontend-phase-2c-preflight-bundle-design-spec-review-N.md`
3. `/synthesize-spec-review` → `docs/reviews/19-frontend-phase-2c-preflight-bundle-design-spec-synthesis-N.md`
4. Loop until findings are nit-or-below
5. `/writing-plans` → `plans/19-frontend-phase-2c-preflight-bundle.md`
6. `/review-plan` → `/synthesize-plan-review` → loop until clean
7. `/executing-plans` (or subagent-driven-development)
8. `/review-impl` → `/synthesize-impl-review` → loop until clean
9. Human approves merge → controller runs `npm run preflight` locally → merge to `master`

Branch name: `phase-2c-preflight-bundle`.

---

## §6 Risks

### R1 — Bundle comparator's hash-stripping matcher misclassifies chunks

Vite chunk filenames like `index-DoZK05uc.js` need their hash stripped to match across builds. If Vite ever emits multiple chunks sharing the same base name (`index-A.js`, `index-B.js`), the simple matcher fails. The matcher must handle all `*-[hash].{js,css}` patterns (5 files in the current baseline: 1 large JS chunk, 1 CSS chunk, 2 workbox files, `sw.js`), not just `index-*.js`.

**Mitigation:** when matching is ambiguous, the comparator falls back to aggregate totals only and prints a note ("per-chunk matching unavailable; only totals shown"). The current baseline is a single large JS chunk plus small ancillaries and no two files share a base name, so ambiguity is a non-issue today; the matcher gets revisited when Phase 3+ introduces chunk splitting.

### R2 — VR threshold widening to 2% lets a real regression slip through

**Mitigation:** 2% is well below what an actual UI change produces (a moved button, a recolored header, a shifted card grid all blow past 2%). The threshold is for noise tolerance, not change tolerance. Sub-2% drift that turns out to be a real bug surfaces in later phases as a visible defect; that's a known tradeoff of loosening sub-pixel sensitivity.

### R3 — NFR drop means slow-growth defects go unnoticed

A heavy dep slowly bloating `tsc`, a test suite drifting from 33s to 90s, a preflight chain creeping past 8 minutes — none of these get caught by an automated gate after Phase 2c.

**Mitigation:** the bundle-size comparator catches dep-driven size growth (the most common slow-growth defect, since most bloating deps grow both bundle and `tsc` together). True wall-time slow-growth — pathological types, slow tests — surfaces during dev work and gets addressed when the team notices. Phase 14 reconsiders whether to reintroduce wall-time gates with post-launch usage data.

### R4 — Master spec amendment scope creep

The amendment commit could end up touching more of Spec 14 than §3.4 enumerates.

**Mitigation:** §3.4 lists the exact sections changed. The Phase 2c branch's spec-amendment commit makes only those changes. Anything else surfaced during the phase (e.g., a Phase 14 reconsideration prompted by Phase 2c findings) gets logged as a TODO or routed through a separate amendment commit, not folded in.

---

## §7 Open questions deferred to plan

1. **Bundle comparator's exact output format.** Markdown-style table only, JSON-on-`--json` flag, or both? → plan author chooses; default is plain table only.
2. **Where the hash-stripping regex lives.** Inline in `check-bundle-budget.ts` vs a small helper. → plan author chooses; trivial either way.
3. **Empty-chunk-list handling — RESOLVED (plan round 1).** Threshold-based suppression: the "Chunks > 10KB" section is shown only when one or more matched chunks (≥10KB raw in either baseline or current, present in both) exist. With today's single large JS chunk, the section displays one row; if chunk splitting lands in Phase 3+ and produces small ancillaries below 10KB, those are omitted from the per-chunk list but still counted in totals. Plan `plans/19-frontend-phase-2c-preflight-bundle.md` Task 6 implements this.
4. **Should `bundle:check` consume `dist/` in place or run `vite build` itself?** → RESOLVED in-spec: consume `dist/` (per §3.1's behavior description and §3.3's chain ordering, which places `bundle:check` immediately after the explicit `build` step). Listed here only for traceability; the plan author does not need to choose.

---

## §8 Companion documents

- `specs/14-frontend-refactoring-master-plan-design.md` — master plan; this phase amends §4 Phase 2c block, §6 item 6, and §8 (Q2, Q3)
- `specs/18-frontend-phase-2b-eslint-prettier-design.md` — predecessor phase; left the preflight chain in the state §1.2 describes
- `docs/audits/2026-05-26-frontend-bundle-baseline.json` — comparator's reference baseline
- `docs/audits/2026-05-26-frontend-nfr-baseline.json` — NFR baseline preserved as historical data; not consumed by Phase 2c
- `frontend/scripts/capture-bundle-baseline.ts` — Phase 0's baseline-capture script; `bundle:rebaseline` reuses its output shape
