# Frontend Test-Infra Speedup Analysis — fresh pass (2026-06-03)

> Follow-up to yesterday's (2026-06-02) perf round. Goal: find speedups **beyond** the
> four commits already shipped, quantify where gate time goes, and rank by impact / effort
> / risk — flagging anything that would break correctness, the known flake, or VR determinism.
>
> Produced in an isolated worktree (`worktree-fe-test-infra-analysis`) so it does not
> interfere with the parallel spec-14 implementations in other sandboxes.

---

## 0. Method & honesty note

This pass combined: reading the actual config/test inventory, **one** controlled empirical
probe (`vitest --no-isolate`, which failed — see §6), one fresh build measurement, structural
reasoning, and version-checked web research. Every candidate was put through an **adversarial
verification** step whose job was to *kill* recommendations that break the suite, worsen the
flake, lose coverage, or rest on invented numbers. Several did get killed (§12) — including
the most "obvious" wins. Treat that as a feature.

**Read §2 before trusting any number.**

---

## 1. TL;DR

- **The dominant cost is two structural things, not any single gate knob:** (1) the
  **`build → e2e` serial tail** (build is a hard prerequisite for e2e), and (2) **concurrent
  preflights oversubscribing a memory-bound 7.7 GB box.** Yesterday's `maxWorkers:4` cap was
  the right *shape* of fix; the biggest remaining wins are the same idea applied to the
  **build→e2e edge** and to **cross-worktree orchestration**.
- **Build roughly doubled.** Fresh measurement: `vite build` = **71 s / 2761 modules** (vs
  37.5 s in the stale May baseline). Part Phase-5 module growth, part contention. The build is
  **near its config-optimal floor** — minify (esbuild) and sourcemaps (off) are already ideal;
  remaining build wins are *tail-trimming* (gzip report, Workbox precache) and *removing the
  PWA work from the e2e build*, not core-transform speedups.
- **Vitest (~33 s) is per-file-overhead-bound, not test-logic-bound.** The tests themselves are
  ~15–25 s of work; the rest is fork + jsdom + MSW setup paid 74× over 4 workers. The cheap,
  safe vitest cleanups here are **hygiene, not headline wins** — be honest about that.
- **`isolate:false` is a proven dead end** — I ran it; it finishes faster but *fails the suite*
  (the global-MSW / manual-RTL-cleanup / `globals:false` design needs per-file isolation). Off
  the table.
- **A near-free correctness win exists in e2e:** `reuseExistingServer` + `!CI` means a stale
  `:5173` preview from a sibling worktree can make VR pass against the **wrong build**
  (false-green) — the exact hazard logged in memory. Fix the reuse, regardless of speed.
- **Playwright: you're on the CLI test runner, and you should stay there.** Playwright MCP is a
  different category of tool (agent driving a live browser); it *cannot* run your VR gate. Its
  only relevant use here is **authoring/healing** specs (§11).
- **Re-measure on an idle box before investing.** The box hit load 20+ during this pass; live
  wall-timing was not credible.

---

## 2. Measurement caveat (the contention reality)

Live wall-timing was **largely impossible** during this pass. The shared box went from load
~1.6 to **20+** as the parallel sandboxes ran their own preflights. Concretely, during this
analysis:

- A full `vitest run` that was 33 s in May **exceeded a 300 s timeout** (load climbed 2.9 → 6.3 mid-run).
- A **15-file** subset, and then even a **single** test file, **timed out at 160 s / 90 s** as load spiked to 14–17.
- The **only** measurement that completed cleanly was `vite build` (**71 s**, load ~5–8).

So: **the build number is real (if contention-inflated); the vitest/e2e absolute numbers are
the stale May baseline + structural reasoning.** I have flagged which is which throughout. This
contention *is itself the headline finding* (§9) — it is the lived evidence that concurrent
preflights on this box are the real cost.

> **Authoritative re-measurement** needs an **idle** box and the existing harness
> `frontend/scripts/measure-baselines.sh` (3-run medians → `docs/audits/*-nfr-baseline.json`).
> Treat all rankings below as *directional*; confirm magnitudes before M/L-effort work.

---

## 3. Where the time goes (per-gate)

Preflight chain (serial): `typecheck → lint → format:check → test → build → bundle:check → test:e2e → knip`
(`preflight:par` runs the same set on a dependency graph with edges `build→bundle`, `build→e2e`.)

| Gate | Cost | Nature | Measured? |
|---|---|---|---|
| typecheck (warm) | trivial | `tsc --incremental` + `.tsbuildinfo` | structural |
| lint (warm) | trivial | `eslint --cache` | structural |
| **lint (COLD)** | **heavy** | type-aware `projectService` + `import-x/no-cycle`/`order` rebuilds the type graph on a fresh worktree | structural |
| format:check | trivial | prettier scan | structural |
| **vitest (`test`)** | **~33 s** (May) | **per-file overhead-bound** (transform + jsdom + MSW × 74 / 4 workers); test logic only ~15–25 s | baseline only |
| **build** | **71 s fresh** / 37.5 s May | Vite 5 + react-swc + VitePWA/Workbox; **prerequisite for e2e** | **fresh ✓** |
| bundle:check | trivial | reads `dist` | structural |
| **test:e2e** | **~72 s** (May) | Playwright vs preview-served `dist`; **depends on `build`** → ~110 s+ combined serial tail | baseline only |
| knip | small | dep-graph walk | structural |

**Takeaway:** `build → e2e` (~110 s serial) dominates the critical path; vitest is second and is
mostly fixed startup overhead; the static gates are trivial warm (the only sleeper is **cold**
type-aware lint on a fresh worktree). The relative *shape* (build+e2e ≫ vitest ≫ static-warm) is
robust regardless of the contention noise.

---

## 4. What yesterday already fixed (NOT re-proposed below)

- **6c6d1c9** — `maxWorkers:4` cap → stops worker oversubscription + the jsdom `waitFor` 5 s
  flake under concurrent preflights. *Single most important fix already in place.*
- **a308051** — e2e serves the prebuilt `dist` instead of rebuilding.
- **970f9f7** — caching: `eslint --cache` + `tsc --incremental`/`.tsbuildinfo`.
- **ed95aca** — opt-in parallel `preflight.mjs` + the fast `verify` inner-loop subset.

---

## 5. Recommendations — ranked master table

Only candidates that survived adversarial verification. Grouped detail follows in §6–§10.
Impact is **structural reasoning, not measured seconds** (see §2).

| # | Change | Gate | Impact | Effort | Risk | Status |
|---|---|---|---|---|---|---|
| **R1** | Global memory-aware semaphore on heavy phases across worktrees | orchestration | **high** (kills the contention superlinear slowdown + flake) | M | med | recommend |
| **R2** | `build:e2e` profile that drops VitePWA; run it concurrently with prod `build` | build→e2e | **high** (removes PWA/Workbox from the e2e critical path) | M | med | recommend-with-care |
| **R3** | Fix e2e `reuseExistingServer` false-green (per-worktree port + `reuseExistingServer:false`) | e2e | **correctness** + small boot win | S | low | recommend (do regardless) |
| **R4** | Contention-aware Playwright `workers` (4 solo, 2 when others active) | e2e | flake/memory insurance under load | S | low | recommend |
| **R5** | Cap concurrent *heavy* nodes to 1 inside `preflight.mjs` | orchestration | local memory-cliff insurance | S–M | low | recommend |
| **R6** | Split VR (`@vr`) from functional e2e; VR as required-but-separable lane | e2e | moves flake-prone work off the always-on path | M | low–med | recommend-with-care |
| **R7** | `build.reportCompressedSize:false` | build | small tail trim, zero-risk | S | low | recommend |
| **R8** | Tighten Workbox `globPatterns` + set `maximumFileSizeToCacheInBytes` | build | small tail trim + removes a latent build-failure landmine | S | low–med | recommend |
| **R9** | node-env for DOM-free `.ts` logic tests **via per-file docblock** (exclude `jwtAuthEndpoint`) | vitest | low (low-hundreds-ms) | S | low | recommend-with-care |
| **R10** | `pool:'threads'` (keep `isolate:true`) | vitest | modest, **idle-only** | S | med | needs idle-box A/B |
| **R11** | Opt-in `test:fast` lane (`.ts` logic only, separate config) | inner loop | dev convenience only | S | low | recommend-with-care |
| **R12** | npm → **pnpm** shared content-addressable store (hardlink mode) | cross-worktree setup | high for fresh-worktree setup + concurrent I/O | L | med–high | recommend-with-care |
| **R13** | Shared cross-worktree typecheck/lint cache; setup.ts MSW-import guardrail | static / vitest | low; regression-prevention | S–M | low | recommend-with-care |

---

## 6. Vitest gate (detail)

The bottleneck is **per-file fixed overhead** (vite/swc transform + jsdom construct + `setup.ts`
MSW `server.listen`) paid for all 74 files across only 4 workers — *not* the test logic
(per-file durations observed at 133–1094 ms, mostly <500 ms; ~15–25 s of real work total). So
trimming files saves less than file-count math implies: under `maxWorkers:4` the wall is set by
the slowest ~56 jsdom `.tsx` files.

### R9 — node-env for DOM-free logic tests (recommend-with-care)
Under `isolate:true`, every file gets a fresh jsdom DOM, including the ~17 `.ts` logic tests that
never render. jsdom construction is a real per-file constant.
- **Do NOT** use the blanket `environmentMatchGlobs:[['src/**/*.test.ts','node']]`: it captures
  `src/lib/__tests__/jwtAuthEndpoint.test.ts`, which **does** touch `localStorage` → under
  `environment:'node'` that's `ReferenceError` → red suite. And `environmentMatchGlobs` is
  **deprecated in Vitest 3.x** (still works in 3.2.4, emits a warning).
- **Safe form:** add `// @vitest-environment node` docblocks to the *verified* DOM-free `.ts`
  files (contracts ×2, sanitize/competitor/industry/marketSize/regulatory helpers, the
  marketResearch service test, rateLimitManager [fake timers, node-safe], timestampUtils, utils,
  msw-pipeline [msw/node + native fetch, Node 21+]), **excluding `jwtAuthEndpoint.test.ts`**.
- **Honest impact:** removes jsdom on ~15–16 of 74 files → realistically **low-hundreds-of-ms**,
  *not* the "~24%" file-count would suggest. Real on idle *and* contended boxes; does **not**
  touch the `waitFor` flake (that lives in the `.tsx` tests, which stay jsdom).
- **Verify:** `npm run test` → 74 files pass, no `ReferenceError`, no deprecation warning.
- Sources: [vitest environment](https://vitest.dev/guide/environment), [improving performance](https://vitest.dev/guide/improving-performance).

### R10 — `pool:'threads'`, keep `isolate:true` (needs idle-box measurement)
Config leaves `pool` unset → forks (one child process/file). `worker_threads` have cheaper
spawn + IPC; this is pure JS/DOM testing with **no** native addons and **no `process.chdir`**
(grep-confirmed) — the profile threads favor. **`isolate:true` is preserved** (this is *not* the
off-the-table `isolate:false`).
- **Why measure, not flip blind:** threads share **one** process heap across all 4 workers
  (forks give 4 heaps). The documented flake is the jsdom `waitFor` 5 s timeout under a *second*
  worktree's concurrent preflight; shared-heap GC pauses under that same contention **could make
  the flake worse** — i.e. the upside is on the *idle* axis, the risk on the *contended* axis the
  team actually hurts on.
- **Gating protocol — adopt only if BOTH hold on an idle box:** (a) `vitest run` ×3 forks vs
  threads, threads ≥ ~5 % faster median; (b) two concurrent `npm run test` (simulate a second
  worktree) ×5+, threads' `waitFor`-timeout rate **not worse** than forks. Never set
  `isolate:false`; don't smuggle a `testTimeout` bump in here.
- Sources: [vitest pool](https://vitest.dev/config/#pool), [improving performance](https://vitest.dev/guide/improving-performance).

### R11 — opt-in `test:fast` lane (recommend-with-care)
For tight lib/services edit loops, run only the cheap `.ts` logic tests.
- **Do NOT** wire `vitest run 'src/**/*.test.ts'` into `verify`: the positional arg is a
  *substring filter, not a glob* — it matches nothing and exits 1 (would hard-fail every inner
  loop). And `.test.ts` as a substring also matches `.test.tsx`.
- **Safe form:** a separate `vitest.fast.config.ts` (`test.include:['src/**/*.test.ts']`) +
  `"test:fast":"vitest run --config vitest.fast.config.ts"`. **Keep `verify`'s `test` step the
  full suite** — replacing it is a coverage regression (a `.tsx` edit gets false-green).
- **Honest impact:** inner-loop convenience only; **zero** effect on the merge gate. The subset
  still pays full transform + jsdom + MSW startup. Bonus: those 17 `.ts` files have **0**
  `waitFor` calls → the lane is flake-immune.

### R13a — `setup.ts` MSW-import guardrail (recommend-with-care)
`setupFiles` runs before every file. Today `handlers.ts` imports **only** `msw` (no app graph),
so the cost is bounded — but that's fragile. **Keep the MSW lifecycle exactly as-is** (do NOT
move `listen`/`close` to `globalSetup` — it runs in the main thread and breaks worker-side
interception under `onUnhandledRequest:'error'`; do NOT drop `resetHandlers`). The deliverable is
a **review/CI guard** asserting `handlers.ts` + `msw/server` never import app modules — pure
regression-prevention, zero runtime risk. Sources: [MSW](https://mswjs.io/docs/), [vitest setupFiles](https://vitest.dev/config/#setupfiles).

---

## 7. Build gate (detail)

Fresh measurement: **71 s, 2761 modules transformed**. The build sits on the critical path
**twice** (`build→bundle:check`, `build→e2e`).

### R2 — `build:e2e` profile that skips VitePWA (recommend-with-care) — highest build leverage
The e2e gate serves `dist` only to drive Playwright through `page.route`-mocked, masked, VR
journeys. The **service worker / manifest / precache are never asserted by any spec** (Playwright
tests the `preview` of `dist`; `devOptions.enabled:true` only affects the dev server). Yet every
e2e build pays the full Workbox `generateSW` glob+hash pass.
- **Change:** gate the plugin on mode —
  ```ts
  export default defineConfig(({ mode }) => ({
    plugins: [react(), ...(mode === 'e2e' ? [] : [VitePWA({ /* …existing… */ })])],
  }));
  ```
  add `"build:e2e": "vite build --mode e2e"`, point e2e's preview at it. **Run `build` (for
  bundle:check) and `build:e2e` (for e2e) as independent nodes in `preflight.mjs`** so they
  execute *concurrently* rather than serially (they have no edge between them) — otherwise you've
  just added a second build.
- **Honest impact:** removes the entire PWA/Workbox tail from the e2e critical path.
- **VR risk (load-bearing):** the e2e build must be visually identical to what VR baselines were
  captured against, or all 22 snapshots rebaseline. VitePWA doesn't change app chunk content, but
  `registerType:'autoUpdate'` injects a virtual `registerSW` import that *could* shift hashing.
  **Mitigation:** deliberately rebaseline once against `build:e2e` and keep it the canonical VR
  target. Verify by diffing `dist` vs `dist-e2e` excluding `sw.js`/`manifest`/`registerSW` — app
  chunks should be content-identical. Source: [vite-plugin-pwa / Workbox](https://vite-pwa-org.netlify.app/workbox/).

### R7 — `build.reportCompressedSize:false` (recommend, free)
Vite gzips every output chunk to print the size report; the docs note disabling it speeds the
build. Nobody in the gate consumes that stdout stat (`bundle:check` reads `dist`). Output bytes
are identical. Source: [vite build options](https://vite.dev/config/build-options).

### R8 — tighten Workbox precache (recommend)
`generateSW` globs `dist/` and **hashes every matched file** to build the precache manifest, on
the critical path after Rollup. Drop images from precache (`globPatterns:['**/*.{js,css,html}']`,
serve images via runtime caching) and set `maximumFileSizeToCacheInBytes` explicitly — the latter
also defuses a latent **hard build error** on oversized precache entries in newer plugin
versions. SW is not exercised by VR, so this is VR-safe. Source: [vite-plugin-pwa generateSW](https://vite-pwa-org.netlify.app/workbox/generate-sw).

### Calibration (not a change)
**The build is near its config-optimal floor.** Minify is already the fast esbuild default;
sourcemaps are already off (`build.sourcemap` defaults to `false` in prod). There is **no
minify/sourcemap dividend left**. The irreducible 71 s core is Rollup transforming 2761 modules
with react-swc (SWC is already the fast transformer). Further build wins require **reducing module
count** (a knip-assisted barrel-file audit) or the serialization removal in R2 — *not* vite flags.
Vite has **no persistent prod-build cache** (Rollup re-walks the graph every run —
[vite#12943](https://github.com/vitejs/vite/discussions/12943)); only the esbuild dep-prebundle in
`node_modules/.vite` persists, which is a fresh-worktree concern folded into R12.

---

## 8. E2E gate (detail)

12 specs (7 functional+VR "journeys", 5 tiny "stubs"), 22 `toHaveScreenshot` VR snapshots,
4 workers, `fullyParallel`, `trace:retain-on-failure`, preview-served `dist`.

### R3 — fix the `reuseExistingServer` false-green (recommend — do regardless of speed)
`webServer` uses `npm run preview` with `reuseExistingServer:!CI`; with no CI, `!CI` is **always
true**, so reuse is always on. A stale `:5173` preview from a sibling worktree gets reused →
VR passes against the **wrong build** (the exact hazard logged in
`feedback_fe_e2e_orphan_preview_server`). **A false-green is the most expensive failure mode for a
gate whose whole value is VR determinism.**
- **Change:** bind preview to a **per-worktree port** (hash of worktree path) and set
  `reuseExistingServer:false` in preflight; or add an explicit "kill orphan `:5173`" step in
  `preflight.mjs` before e2e. Source: [playwright webServer](https://playwright.dev/docs/test-webserver).

### R4 — contention-aware Playwright `workers` (recommend)
`workers:4` spawns 4 isolated Chromium processes. Worst case under the 3-concurrent-worktree
protocol = 3 × 4 = **12 headless Chromium** + 3 preview servers + 3 builds on **7.7 GB** → swap →
the `waitFor`/timeout flake class. Make it `workers: Number(process.env.PW_WORKERS) || 2` and have
`preflight.mjs` set `PW_WORKERS` (4 when alone, 2 when others active). This is the e2e mirror of
the shipped vitest `maxWorkers:4` cap. Worker count doesn't affect VR pixels. Source:
[currents.dev: sharding vs workers](https://currents.dev/posts/optimizing-test-runtime-playwright-sharding-vs-workers).

### R6 — split VR from functional, VR as a separable lane (recommend-with-care)
The 22 VR assertions are the contention-sensitive part; functional (DOM/role/text) assertions are
far more tolerant. Tag VR `@vr` and split scripts: `"test:e2e":"playwright test --grep-invert @vr"`
(always) + `"test:e2e:vr":"playwright test --grep @vr"` (separable lane). **Coverage is retained
and baselines unchanged** — only the *gating cadence* of the flake-prone pixel work changes, in
line with the team's established "advisory over hard-fail for flaky gates" posture
(`feedback_pre_launch_gate_posture`). Keep VR a *required* check that simply runs in its own lane,
not deleted.

---

## 9. Orchestration / cross-worktree contention (detail) — co-dominant cost

This is co-equal with the build→e2e tail: the only live regression evidence (71 s vs 37.5 s) is
substantially contention-driven, and the known flake class is *defined* by concurrent preflights.

### R1 — global memory-aware semaphore on heavy phases (recommend) — highest overall leverage
The box is **memory-bound (7.7 GB), not core-bound (23 cores)**. The team protocol caps
concurrency by *worktree count* (3) — but doesn't see that 3 worktrees can all be in their
`build` or `test:e2e` phase at the same instant, which is what drives load 1.6 → 20 and tips into
swap/flake.
- **Change:** a filesystem-lock global semaphore (shared `/projects/.preflight-locks`, **1–2
  slots** tuned to RAM) that `build`, `test:e2e`, and `test` **acquire before running and release
  after**; light phases (typecheck/lint/format/knip) need no slot. Blocks (not fails) when no slot
  is free → serializes heavy phases *across* worktrees. Must include stale-lock reaping
  (PID/mtime) to avoid a crashed preflight wedging others.
- **Impact:** doesn't speed any single phase — it **prevents the superlinear slowdown** (N heavy
  phases each ~N× slower) and the swap cliff. The orchestration analog of the shipped per-process
  `maxWorkers` caps, but *global*. Biggest determinism win in the whole analysis (serializing e2e
  across worktrees removes the cross-worktree CPU contention behind the VR/timeout flake).

### R5 — cap concurrent *heavy* nodes to 1 inside `preflight.mjs` (recommend)
The intra-runner complement to R1. With `JOBS=cores/4` up to 4 on a 23-core box, the parallel
runner can place `build` + `test` (vitest) + e2e-preview together and spike memory within a single
worktree. Annotate `{build, test, test:e2e}` as `heavy` and cap concurrent heavy nodes to 1, while
light nodes fill remaining JOBS freely. Cheap insurance; helps even solo.

### R12 — npm → pnpm shared store (recommend-with-care) — big setup-time win, real migration
Each fresh worktree runs `npm ci`, which **wipes and re-materializes ~632 MB** of `node_modules`;
with 3 concurrent worktrees that's also concurrent disk-I/O + network, compounding R1's memory
pressure.
- **pnpm**'s content-addressable store (default hardlink mode) keeps one copy of each package's
  content on disk, hardlinked into each worktree — subsequent worktree installs are near-instant
  against a warm store. Use `store-dir=/projects/.pnpm-store`, `pnpm install --frozen-lockfile`.
- **Do NOT** use pnpm's experimental `enableGlobalVirtualStore` — symlinked `node_modules` breaks
  Vite/Vitest resolution (documented + reported). Stay on **hardlink** mode.
- **Rejected alternative:** `cp --reflink=auto` from a warm `node_modules` — **`/projects` is
  overlayfs** (confirmed), where reflink silently falls back to a full copy. Zero benefit.
- **Honest caveat:** npm→pnpm is an **L-effort** migration (lockfile regen; stricter hoisting can
  surface latent peer-dep issues). Validate with a full **0-diff VR + functional** run before
  adoption. Sources: [pnpm motivation](https://pnpm.io/motivation), [pnpm git worktrees](https://pnpm.io/next/git-worktrees), [cp/reflink](https://www.gnu.org/software/coreutils/manual/html_node/cp-invocation.html).

### R13b — shared cross-worktree typecheck/lint cache (recommend-with-care, low magnitude)
Yesterday's caching is *per-worktree*; a fresh worktree starts cold. Point `tsBuildInfoFile` and
ESLint `--cache-location` at a content-hash-keyed `/projects/.preflight-cache/<lockfile+tsconfig-hash>/`
so a new worktree inherits a warm cache for unchanged files. Key carefully (include tsconfig + dep
lockfile hash) or you risk masking stale type/lint errors. Only the *light* gates → modest, mostly
setup-time smoothing. Do after R1/R12.

---

## 10. Static gates (typecheck / lint / format / knip / bundle)

All trivial **warm** (caching shipped yesterday). The only sleeper is **cold** type-aware lint on
a fresh worktree (`projectService:true` + `import-x/no-cycle`/`order` with the TS resolver rebuild
the whole type graph) — addressed by the shared cross-worktree cache (R13b), not by changing the
rules (the boundary rules are load-bearing architecture, keep them). `bundle:check` and `knip` are
dep-graph walks measured in the small. **Lower priority than build/e2e/orchestration** — don't
spend effort here until the dominant costs are addressed.

---

## 11. Playwright: CLI vs MCP (answering the follow-up question)

**What you use today:** the **Playwright CLI / `@playwright/test` runner** (v1.59.1). Confirmed:
`@playwright/test` is the only Playwright dep; scripts are `playwright test`/`--update-snapshots`/
`--ui`; specs are standard `import { test, expect } from "@playwright/test"` with `page.route`
mocking + `toHaveScreenshot`. **No `@playwright/mcp` dependency and no MCP config references
Playwright anywhere** (checked `.mcp.json` + root/worktree `.claude/settings*.json`).

**They are different categories of tool — not interchangeable:**

| | **Playwright MCP** (`@playwright/mcp`) | **Playwright runner** (`@playwright/test`) — *what you have* |
|---|---|---|
| What it is | MCP server exposing browser actions as **tools an AI agent calls live** | Deterministic **test framework + CLI** running `.spec.ts` |
| Mode | Interactive, stateful, agent-in-the-loop | Batch, headless, parallel, fire-and-forget |
| Runs your `.spec.ts` suite? | **No** | Yes |
| Parallel workers / `fullyParallel` | No | Yes (your 4 workers) |
| `toHaveScreenshot` VR baselines/diffs | **None** | Yes (your 22 snapshots) |
| Retries / sharding / HTML report | No | Yes |
| Determinism | LLM decides actions → reruns diverge | Identical pass/fail every run |
| Cost | Token-heavy (streams a11y snapshot/step), serial | Cheap, fast, parallel |

**Can MCP replace the CLI for the preflight gate? No.** Your gate needs deterministic, headless,
parallel, reproducible `toHaveScreenshot` VR over a prebuilt `dist`. That is exactly what the
runner exists for and exactly what MCP fundamentally cannot do — swapping it in would make the
gate slower, non-reproducible, and lose VR/retries/reporting. Microsoft itself now steers coding
agents *away* from the MCP server toward a token-efficient CLI+Skills surface
([playwright-mcp](https://github.com/microsoft/playwright-mcp),
[CLI/coding-agents docs](https://github.com/microsoft/playwright/blob/main/docs/src/getting-started-cli.md)).

**Where MCP *could* add value (orthogonal to the gate, and to *speed*):** authoring/debugging. The
2025–26 development is **Playwright Test Agents** (planner → generator → healer), which are
MCP-powered but **feed the same runner** (`npx playwright init-agents --loop=claude`):
- *planner* explores the live app → Markdown plan; *generator* writes `.spec.ts` with **locators
  verified against the running app** (cuts hallucinated selectors — a real win when agents author
  tests); *healer* repairs a failing spec from live snapshot/console/network.
- Source: [test-agents docs](https://github.com/microsoft/playwright/blob/main/docs/src/test-agents-js.md).

**Recommendation for this repo:** keep `@playwright/test` as the gate, unchanged. Consider Test
Agents (or `playwright-cli`+Skills, which Microsoft recommends over the MCP server for Claude-style
agents) as a **developer-productivity** tool for spec authoring/healing **if** agent-authored e2e
maintenance is a pain point. One caution that fits your known failure mode: any agent-authored
spec must be validated against the **same** preview-serves-prebuilt-`dist` harness the gate uses,
or you re-introduce the wrong-build false-green (R3). **MCP is not a test-infra *speedup*** — if
anything it's slower; it's a different workflow.

*Caveats from research:* the "Test Agents shipped in 1.56 / Oct 2025" version is secondhand
(`playwright.dev/docs/release-notes` was network-blocked; cited from the authoritative GitHub docs
*source* markdown, which confirms the feature but is undated). You're on 1.59.1, so it's available
— confirm behavior on `playwright.dev/docs/test-agents`.

---

## 12. Rejected / what NOT to try

| Candidate | Verdict | Reason |
|---|---|---|
| `isolate:false` | reject | **Proven** to break the suite (ran it: `× ErrorState` failures + "Terminating worker thread"); global-MSW + manual RTL cleanup + `globals:false` need per-file isolation. |
| Persist/seed `node_modules/.vite` deps cache for the build | reject | Vitest 3.2.4 disables the esbuild dep optimizer by default; there's no `.vite/deps` prebundle to warm in `test`/`build`; a shared cacheDir adds cross-worktree race risk. ([vitest#6733](https://github.com/vitest-dev/vitest/issues/6733)) |
| Blanket `environmentMatchGlobs` glob | reject as written | Captures `jwtAuthEndpoint.test.ts` → `ReferenceError` on `localStorage` → red; also deprecated in 3.x. Use per-file docblocks (R9). |
| `vitest run 'src/**/*.test.ts'` as the fast lane | reject as written | Positional arg is a substring filter, not a glob → exits 1 / pulls full suite; hard-fails `verify`. Use a separate config (R11). |
| Playwright `--shard` on this box | reject | Sharding splits across *machines*; on one memory-bound box it multiplies Chromium memory pressure. Use `workers` (R4). |
| `cp --reflink=auto` to clone `node_modules` | reject | `/projects` is **overlayfs** → reflink silently full-copies. Zero benefit. Use pnpm (R12). |
| pnpm `enableGlobalVirtualStore` | reject | Symlinked `node_modules` breaks Vite/Vitest resolution. Use hardlink mode. |
| `build.minify:'terser'` / tune minify | reject | Already esbuild default (20–40× faster); terser would *slow* the build. |
| Disable sourcemaps "for speed" | reject | Already off by default in prod. No dividend. |
| `rollupOptions.cache` / "incremental prod build" | reject | Vite has no persistent prod-build cache; Rollup re-walks the graph each run. |
| `--only-changed` as the merge gate | reject (dev-loop only) | Silently drops VR coverage for unchanged pages + known "runs everything on dep change" footgun ([playwright#32561](https://github.com/microsoft/playwright/issues/32561)). |
| Delete VR snapshots to speed e2e | reject | VR determinism is the gate's entire value; only advisory/opt-in *splitting* (R6) is acceptable. |
| Raise Playwright `workers` > 4 | reject | Memory-bound box → swap + flake. Wrong direction. |
| Replace CLI runner with Playwright MCP | reject | Different tool category; can't run a deterministic VR suite (§11). |

---

## 13. Suggested sequencing

**Do now — cheap, safe, no measurement needed:**
1. **R3** — e2e `reuseExistingServer:false` + per-worktree port (correctness; closes false-green VR).
2. **R7 / R8** — `reportCompressedSize:false` + tighten Workbox precache (free/cheap build-tail trims).
3. **R5** — cap concurrent heavy nodes to 1 in `preflight.mjs` (memory-cliff insurance).
4. **R4** — contention-aware Playwright `workers`.
5. **R9 / R11 / R13a** — vitest docblock node-env, opt-in `test:fast` lane, MSW-import guardrail (hygiene + dev convenience; frame honestly as *not* a headline gate speedup).

**Highest-leverage structural projects (where the wall-clock actually lives):**
6. **R1** — global memory-aware semaphore across worktrees (kills the contention superlinear slowdown + flake).
7. **R2** — `build:e2e` profile dropping VitePWA, run concurrently with prod `build` (removes the PWA tail from the e2e critical path). Requires a deliberate one-time VR rebaseline.
8. **R6** — split VR from functional e2e into a separable lane.

**Measure first on an idle box, then decide:**
9. **R10** — `pool:'threads'`: run the §6 A/B protocol; adopt only if idle ≥5% faster **and** contended flake non-worse.

**Bigger migration, schedule deliberately:**
10. **R12** — npm → pnpm shared store (big fresh-worktree/setup + concurrent-I/O win; L-effort; validate with 0-diff VR). Then **R13b** shared caches.

**Re-measurement gate for everything:** none of the magnitudes here (except build = 71 s) are
fresh measurements — the box was at load 20+. Confirm on an **idle** box via
`frontend/scripts/measure-baselines.sh` before claiming any speedup or investing M/L effort.

---

## Appendix — empirical observations from this pass

- Suite inventory: **74 vitest files** (56 RTL render-based, 8 touch MSW), **12 e2e specs**, **22
  VR snapshots**, **287** src ts/tsx, **63 K** LOC.
- Per-file vitest durations observed (partial run before contention killed it): 133–1094 ms,
  most < 500 ms → tests are fast; overhead dominates.
- `vitest --no-isolate` (15-file subset): completed ~88 s vs 160 s-timeout for isolate:true, but
  **EXIT=1 with real assertion failures** → isolate:false breaks the suite.
- `vite build`: **71 s, 2761 modules** (load ~5–8). Stale May baseline 37.5 s.
- Box: 23 cores, **7.7 GB RAM** (memory-bound), `/projects` on **overlayfs**, load 1.6 → 20+
  during the pass (parallel sandboxes).

*Generated 2026-06-03 in worktree `worktree-fe-test-infra-analysis`.*

---

## Implementation status (2026-06-03, same worktree)

R1, R3–R8 were implemented and verified to the extent the shared box allowed (a brief idle
window opened, so the build + functional e2e were actually run). R2 was deliberately **not**
implemented — see below.

| ID | Status | Files | Verification |
|---|---|---|---|
| **R1** | ✅ implemented | `scripts/with-slot.mjs` (new); `package.json` (`build`/`test`/`test:e2e`/`test:e2e:fn` wrapped) | Unit-tested: SLOTS=1 serialized two 3 s jobs → 6.1 s; waiter got `PREFLIGHT_CONTENDED=1`; clean lock release; default lock dir resolves into shared `.git/preflight-locks`. Wrapper exercised by the real build + e2e runs below. |
| **R3** | ✅ implemented | `playwright.config.ts` | per-worktree port + `reuseExistingServer:false` default. Functional e2e booted its own preview and 14/14 tests navigated/passed. |
| **R4** | ✅ implemented | `playwright.config.ts` | `workers` = `PW_WORKERS` → else 2 if `PREFLIGHT_CONTENDED` → else 4. Observed 4 workers solo (correct default). |
| **R5** | ✅ implemented | `scripts/preflight.mjs` | heavy-cap (`MAX_HEAVY`, default 1) on build/test/e2e. Syntax-checked + logic-traced (no deadlock; light tasks still fill JOBS). Not run under a full preflight (heavy + contention). |
| **R6** | ✅ implemented | `package.json` (`test:e2e:fn`) | `playwright test --ignore-snapshots`; ran green (14 passed, 51.8 s). `test:e2e` (full VR) unchanged as the merge-gate default. |
| **R7** | ✅ implemented | `vite.config.ts` | `build.reportCompressedSize:false`. Real build: "gzip" gone from output; vite build-time 71 s → 62 s (partly this, partly lower load). |
| **R8** | ⚠️ implemented, ~no-op for *this* app | `vite.config.ts` (workbox) | `maximumFileSizeToCacheInBytes` guard added (real value). But narrowing `globPatterns` did **not** shrink the precache: this app's only images are the PWA icons (favicon/pwa-192/512/logo), force-included via `includeAssets` + manifest, and the precache (11 entries, 2087 KiB) is dominated by the 2 MB app JS bundle. So R8's build-time benefit here is ≈0 — kept as hygiene + the size guard. |
| **R2** | ❌ not implemented (by design) | — | Conflicts with R5 (heavy-cap=1 → the two builds serialize) and risks OOM on the 7.7 GB box; its only realistic upside (lighter Workbox tail) is itself ≈0 here (see R8). The build is Rollup-transform-bound (2761 modules, ~62 s), confirming the §7 calibration: it is near its config floor. An opt-in `build:e2e --mode e2e` script could be added if PWA-free e2e builds are ever wanted, but it should not be wired into the gate. |

**Honest bottom line on the build:** R7 trims a few seconds; R8/R2 don't move it. The 62 s build is
the irreducible Rollup transform of 2761 modules. Real build wins require reducing module count or
splitting the 2 MB main chunk — out of scope for a config pass. **The high-leverage changes are the
orchestration ones (R1 + R5 + R3/R4)**, which attack the actual dominant cost: concurrent-preflight
contention on the memory-bound box.

**Not yet verified (needs an idle box):** full `npm run preflight` / `preflight:par` end-to-end
under the new heavy-cap + semaphore; the full VR run (`npm run test:e2e`) on the new port; and
authoritative before/after timings via `scripts/measure-baselines.sh`.
