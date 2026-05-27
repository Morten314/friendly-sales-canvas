---
artifact: plans/16-frontend-phase-1-loc-reduction.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 1
---

## Context

Plan is 2,132 lines. Companion spec (`specs/16-frontend-phase-1-loc-reduction-design.md`, 337 lines, round 3 clean) was read in full for drift analysis. No token-pressure concerns.

## Findings

### [Medium] No documented escape hatch for `knip --strict` vs shadcn/ui findings at the final gate

**Location:** Task 7.2 Step 2, lines 2039–2053

Task 7.2 wires `knip --strict --no-progress` into preflight. If knip flags unused files/exports inside `src/components/ui/` (shadcn primitives), the spec §2.2 explicitly excludes these from Phase 1 scope, but the plan provides only two recovery paths: (a) resolve the finding in a follow-on commit, or (b) revert the `--strict` switch and log as `TD-FE-<n>`. Neither path mentions that the executor can add `src/components/ui/**/*.tsx` to knip.json's `ignore` array to suppress findings that are out-of-scope by design. There is no tension with the "zero config hints" done-when item — knip's `ignore` entries don't generate configuration hints — but the executor would need to discover this independently. A brief note like "If findings are confined to `src/components/ui/`, add the path to knip `ignore` rather than reverting" would save a decision cycle.

### [Medium] Per-area LOC baseline for scorecard §2 assumed available from Phase 0a but not verified

**Location:** Task 7.1 Step 2, lines 1813–1843

The scorecard template (lines 1870–1873) requires a per-area before/after LOC delta table. Task 7.1 Step 2 computes current per-area counts and says "Cross-reference against Phase 0a's baseline (`docs/audits/2026-05-26-frontend-baseline.md` Tier 1 table)." If Phase 0a's baseline file has a Tier 1 per-area breakdown, this works. If it only recorded totals (as the Task 0b Step 2 baseline recording suggests — it captures only `find | wc -l` totals), the executor would need to check out the baseline commit and re-run the per-area script to produce the "before" column. The plan doesn't document this fallback or verify the Phase 0a file's structure during the pre-flight phase. Adding a verification step to Task 0b (checking that Phase 0a's baseline has per-area data, or recording it proactively) would close this gap.

### [Low] Topological sort script uses Python 3.10+ `str | None` syntax without `from __future__ import annotations`

**Location:** Task 4, Step 4-prep, lines 947 (function `resolve_import` return type `str | None`)

The inline Python script at Step 4-prep uses the `str | None` union type hint in a function signature, which requires Python 3.10+. On systems where `python3` resolves to 3.9 (still common on older distros), this raises `TypeError` at import time. Adding `from __future__ import annotations` at the top of the script (or using `Optional[str]`) would add zero cost and broaden compatibility. The crash would be immediate and obvious if it occurs, so the blast radius is small.

### [Low] Inline-block scan script's `builtins` set is incomplete for a web-app codebase

**Location:** Task 6.1 Step 2, lines 1518–1526 (`scan-inline-blocks.ts`, `builtins` set)

The self-containment check whitelists identifiers like `console`, `window`, `document`, `fetch`, `localStorage`, etc. Missing from the set are common web API globals that a PWA codebase would use frequently: `Request`, `Response`, `Headers`, `URL`, `URLSearchParams`, `AbortController`, `TextEncoder`, `TextDecoder`, `Blob`, `File`, `FormData`, `WebSocket`, `Event`, `CustomEvent`, `navigator`, `performance`, `queueMicrotask`, `structuredClone`, `crypto` (browser global), `HTMLElement`, `Element`, `Node`, `Document`, `MutationObserver`, `IntersectionObserver`, `ResizeObserver`, `alert`, `confirm`, `prompt`. A block using any of these would be incorrectly rejected as having outer-scope references, excluding it from extraction. The effect is under-extraction (safe direction — no incorrect extractions), so severity is Low. But in a web-app codebase, the missed extraction count could be non-trivial.

### [Low] README replacement template describes `knip --strict` in preflight before it is wired in

**Location:** Task 2.1 Step 5, lines 360–371

The README replacement text includes `npm run preflight    # typecheck → build → test:e2e → test → knip --strict` but `knip --strict` is not added to preflight until Task 7.2 (~35 commits later). Anyone reading the README between Task 2.1 and Task 7.2 (including the executor during later verification steps) would see a claim that doesn't hold yet. This is cosmetic — the README describes the post-merge end state — but it's a documentation inaccuracy for most of the phase's commit history.

### [Nit] Orphan-route extraction assumes `path="..."` attribute syntax, not JSX expressions

**Location:** Task 4, Step 4-orphan-routes, lines 1189–1191

The grep `grep -oE 'path="[^"]+"'` extracts route paths assuming the `path` attribute uses a string literal. React Router also supports `path={'/some-route'}` (JSX expression syntax). If App.tsx uses JSX expressions for any routes, the grep would miss them. The plan does include a multi-line `<Route>` check, but not a JSX-expression check. In practice, most routes use string literals, and any missed routes would be caught by the broader 6-check kit's plain-text ripgrep. Effect is near-zero.

### [Nit] Spec companion file still reads "(not yet written)" for the plan

**Location:** Spec line 6

The spec says "Paired plan: `plans/16-frontend-phase-1-loc-reduction.md` (not yet written)." The plan now exists. Per AGENTS.md's frozen-intent policy, the spec stays as-is — this is expected behavior, not a defect. Noted for completeness only.
