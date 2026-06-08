# Phase 14 — Agent Affordances + Documentation Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize the agent-readiness layer and close the frontend-refactor master plan — clean stale phase-references, reconcile the root docs, archive resolved tech-debt, harden the feature scaffolder, consolidate ADRs, and flip Spec 14 to done.

**Architecture:** Eight workstreams (W1–W8 from Spec 33) executed as logically-grouped, independently-revertible commits on one branch `phase-14-agent-affordances`. No new preflight gate; the only executable code is the scaffolder hardening (W5, TDD). Everything else is surgical doc/comment edits verified by `git diff` + grep + the existing `npm run preflight`.

**Tech Stack:** TypeScript + tsx (scripts), Vitest (the scaffolder test), Markdown (docs). All FE commands run from `frontend/`.

**Authority:** `specs/33-frontend-phase-14-agent-affordances-design.md` (round 2). Master plan: `specs/14-frontend-refactoring-master-plan-design.md` §4 (Phase 14) + §6 (definition of done).

**⚠️ Scope note for the operator (confirm before Task 4b):** Reading the actual `CLAUDE.md` during planning surfaced that its **Frontend topology + several FE gotchas describe the pre-refactor frontend**. Spec 33 W2 scoped only dedup; **Task 4b extends it** under the master-plan "amend root docs where the new structure makes existing guidance stale" mandate (§2.1) + your doc-org directive. If you'd rather keep Phase 14 to literal-spec scope and defer the FE-topology refresh, drop Task 4b (and log it as a new TD-FE). Otherwise it proceeds as written.

---

## File map

**Created:**
- `frontend/scripts/scaffold-feature.test.ts` — Vitest test for the hardened scaffolder (W5)
- `docs/adr/0006-scout-profiler-kept-distributed.md` (W6)
- `docs/adr/0007-advisory-over-hard-fail-gate-posture.md` (W6)
- `docs/adr/0008-editable-state-features-defer-tanstack-migration.md` (W6)
- `docs/adr/README.md` — ADR index (W6)
- `docs/TECH_DEBT_ARCHIVE.md` — resolved TD-FE entries (W4)

**Modified:**
- `frontend/scripts/scaffold-feature.ts` — exportable functions, synced NAMING_MAP, `--help`/`--dry-run` (W5)
- `frontend/src/shared/types/escape-hatches.ts` — 16 `TODO(phase-13)` → `TODO` (W1)
- `frontend/src/shared/api/contracts/signals.ts`, `.../tenant.ts` — forward-promise rephrase (W1)
- `frontend/src/shared/api/README.md`, `frontend/src/test/msw/handlers.ts`, `frontend/src/features/shell/README.md`, `.../strategist/README.md`, `.../customers/types.ts`, `.../auth/hooks/useLogin.ts`, `.../mission-control/README.md` — forward-promise rephrase (W1)
- `frontend/src/features/{auth,settings,tenant,calendar,insights,reports}/README.md` — stub → full (W3)
- `CLAUDE.md`, `AGENTS.md` — reconcile dedup + branch model + FE-topology refresh (W2/W7/W2b)
- `README.md`, `BRANCHES.md` — branch-model rewrite (W7)
- `docs/TECH_DEBT.md` — numeric index + remove archived entries (W4)
- `specs/14-frontend-refactoring-master-plan-design.md` — status flip + Phase 14 delta (W8)

---

## Task 1: W5 — Harden `scaffold-feature.ts` + add test

**Files:**
- Modify: `frontend/scripts/scaffold-feature.ts`
- Create: `frontend/scripts/scaffold-feature.test.ts`

The current script does all work inside `main()` with `process.argv` side-effects — untestable. Refactor to export pure functions (mirroring `check-bundle-budget.ts`, which exports `baseName`/`computeDelta`/… and is tested by `check-bundle-budget.test.ts`), then test them.

- [ ] **Step 1: Write the failing test**

Create `frontend/scripts/scaffold-feature.test.ts`:

```typescript
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NAMING_MAP, validateName, scaffoldFeature } from "./scaffold-feature";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "scaffold-test-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("validateName", () => {
  it("accepts kebab-case", () => {
    expect(validateName("market-research").ok).toBe(true);
  });
  it("rejects non-kebab", () => {
    const r = validateName("MarketResearch");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("kebab-case");
  });
  it("rejects empty", () => {
    expect(validateName("").ok).toBe(false);
  });
});

describe("NAMING_MAP", () => {
  it("contains all 14 current features", () => {
    for (const f of [
      "artifacts", "auth", "calendar", "customers", "insights",
      "market-research", "mission-control", "reports", "scout",
      "settings", "shell", "signals", "strategist", "tenant",
    ]) {
      expect(NAMING_MAP).toContain(f);
    }
  });
});

describe("scaffoldFeature", () => {
  it("creates the three canonical files and no subfolders", async () => {
    const res = await scaffoldFeature("demo-feature", { featuresDir: dir, dryRun: false });
    expect(res.created).toEqual(
      expect.arrayContaining(["types.ts", "index.ts", "README.md"]),
    );
    expect(existsSync(join(dir, "demo-feature", "types.ts"))).toBe(true);
    expect(existsSync(join(dir, "demo-feature", "index.ts"))).toBe(true);
    expect(existsSync(join(dir, "demo-feature", "README.md"))).toBe(true);
    expect(existsSync(join(dir, "demo-feature", "pages"))).toBe(false);
    const readme = await readFile(join(dir, "demo-feature", "README.md"), "utf8");
    expect(readme).toContain("# `demo-feature` feature");
  });

  it("dry-run writes nothing", async () => {
    const res = await scaffoldFeature("demo-feature", { featuresDir: dir, dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(existsSync(join(dir, "demo-feature"))).toBe(false);
  });

  it("refuses to overwrite an existing feature", async () => {
    await mkdir(join(dir, "demo-feature"), { recursive: true });
    await expect(
      scaffoldFeature("demo-feature", { featuresDir: dir, dryRun: false }),
    ).rejects.toThrow(/already exists/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run scripts/scaffold-feature.test.ts`
Expected: FAIL — `NAMING_MAP`, `validateName`, `scaffoldFeature` are not exported (import error).

- [ ] **Step 3: Refactor `scaffold-feature.ts` to export testable functions**

Replace the body of `frontend/scripts/scaffold-feature.ts` with (keeping the three stub generators verbatim, adding exports + the synced map + flags):

```typescript
// frontend/scripts/scaffold-feature.ts
// Scaffolds a new feature folder under src/features/ with the canonical
// always-present files (types.ts, index.ts, README.md). Subfolders
// (pages/components/hooks/services) are created on demand — never here.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const FRONTEND_DIR = resolve(import.meta.dirname, "..");
const FEATURES_DIR = join(FRONTEND_DIR, "src", "features");

// Living naming map — keep in sync with src/features/README.md and the
// actual src/features/ folders.
export const NAMING_MAP = [
  "artifacts",
  "auth",
  "calendar",
  "customers",
  "insights",
  "market-research",
  "mission-control",
  "reports",
  "scout",
  "settings",
  "shell",
  "signals",
  "strategist",
  "tenant",
];

const KEBAB_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function validateName(name: string): { ok: boolean; error?: string } {
  if (!name) return { ok: false, error: "missing feature name" };
  if (!KEBAB_RE.test(name)) {
    return { ok: false, error: `must be kebab-case, e.g. market-research` };
  }
  return { ok: true };
}

function typesStub(name: string): string {
  return (
    `// Types for the \`${name}\` feature.\n` +
    `// Feature-local types live here; promote to src/shared/types/ only when a\n` +
    `// second feature imports them (the >=2-feature rule — see src/shared/README.md).\n`
  );
}

function indexStub(name: string): string {
  return (
    `// Public surface for the \`${name}\` feature.\n` +
    `// Re-export ONLY what other features may consume; internals stay unexported.\n` +
    `// Cross-feature consumers import from "@/features/${name}", never a deep path.\n` +
    `export {};\n`
  );
}

function readmeStub(name: string): string {
  return `# \`${name}\` feature

## Purpose

_TODO: one paragraph — what this feature does and the user-facing surface it owns._

## Public surface

_The cross-feature API, re-exported from \`index.ts\`. Other features import only these, only via \`@/features/${name}\`._

- _TODO_

## Key files

- \`index.ts\` — public re-exports (the cross-feature surface)
- \`types.ts\` — feature-local types
- _TODO: pages/, components/, hooks/, services/ as they are added_

## Dependency notes

- May import from: \`@/features/${name}/*\` (self), \`@/shared/*\`, \`@/components/ui/*\`, npm packages.
- May import another feature **only** via its \`index.ts\` (\`@/features/<other>\`), never a deep path.
`;
}

export interface ScaffoldOptions {
  featuresDir?: string;
  dryRun?: boolean;
}

export async function scaffoldFeature(
  name: string,
  opts: ScaffoldOptions = {},
): Promise<{ created: string[]; dryRun: boolean; dir: string }> {
  const featuresDir = opts.featuresDir ?? FEATURES_DIR;
  const dryRun = opts.dryRun ?? false;
  const featureDir = join(featuresDir, name);

  if (existsSync(featureDir)) {
    throw new Error(`feature "${name}" already exists at ${featureDir}; refusing to overwrite`);
  }

  const files: Array<[string, string]> = [
    ["types.ts", typesStub(name)],
    ["index.ts", indexStub(name)],
    ["README.md", readmeStub(name)],
  ];

  if (!dryRun) {
    await mkdir(featureDir, { recursive: true });
    for (const [file, content] of files) {
      await writeFile(join(featureDir, file), content, "utf8");
    }
  }

  return { created: files.map(([f]) => f), dryRun, dir: featureDir };
}

const HELP = `usage: npm run scaffold:feature -- <kebab-name> [--dry-run]

Scaffolds src/features/<kebab-name>/ with types.ts, index.ts, README.md.
Subfolders (pages/components/hooks/services) are created on demand — never here.

  --dry-run   print what would be created, write nothing
  --help      show this message
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.length === 0) {
    console.log(HELP);
    process.exit(args.length === 0 ? 1 : 0);
  }
  const dryRun = args.includes("--dry-run");
  const name = args.find((a) => !a.startsWith("--")) ?? "";

  const valid = validateName(name);
  if (!valid.ok) {
    console.error(`invalid feature name "${name}": ${valid.error}`);
    process.exit(1);
  }

  if (!NAMING_MAP.includes(name)) {
    console.warn(
      `warning: "${name}" is not on the naming map in src/features/README.md. ` +
        `Add it there before scaffolding a planned feature (continuing anyway).`,
    );
  }

  const res = await scaffoldFeature(name, { dryRun });
  if (dryRun) {
    console.log(`[dry-run] would scaffold src/features/${name}/ (${res.created.join(", ")})`);
    return;
  }
  console.log(`scaffolded src/features/${name}/ (${res.created.join(", ")})`);
  console.log("next: add pages/components/hooks/services/ on demand — no empty dirs.");
}

// Only run the CLI when invoked directly, not when imported by the test.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run scripts/scaffold-feature.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Verify the CLI still works (dry-run, no write)**

Run: `cd frontend && npx tsx scripts/scaffold-feature.ts demo-x --dry-run`
Expected: prints `[dry-run] would scaffold src/features/demo-x/ (types.ts, index.ts, README.md)` and creates nothing (`ls src/features/demo-x` → not found).
Run: `cd frontend && npx tsx scripts/scaffold-feature.ts --help` → prints usage.

- [ ] **Step 6: Confirm lint/typecheck clean for the changed scripts**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/scripts/scaffold-feature.ts frontend/scripts/scaffold-feature.test.ts
git commit -m "test(fe): harden scaffold-feature (sync NAMING_MAP, --help/--dry-run, exportable + tested)"
```

This resolves **TD-FE-32** (the naming-map disagreement) — recorded in the TECH_DEBT pass (Task 6).

---

## Task 2: W1 — Phase-reference cleanup in `src/`

Fix the 25 stale forward-promises (verified during planning) and rephrase provenance where the phase number drops cleanly. Keep traceability citations (`TD-FE-…`, ADR names). Build the classification ledger as you go.

**Files (forward-promises):** `src/shared/types/escape-hatches.ts`, `src/shared/api/contracts/{signals,tenant}.ts`, `src/shared/api/README.md`, `src/test/msw/handlers.ts`, `src/features/shell/README.md`, `src/features/strategist/README.md`, `src/features/customers/types.ts`, `src/features/auth/hooks/useLogin.ts`, `src/features/mission-control/README.md`.

- [ ] **Step 1: Capture the baseline**

Run: `cd frontend && grep -rInE "\b[Pp]hase[- ]?[0-9]" src/ | tee /tmp/phase-refs-before.txt | wc -l`
Expected: ~146. Keep `/tmp/phase-refs-before.txt` as the ledger baseline.

- [ ] **Step 2: Fix the 16 `escape-hatches.ts` markers + docstring**

In `frontend/src/shared/types/escape-hatches.ts`, replace every `// TODO(phase-13):` with `// TODO:` (14 markers at lines 20, 29, 34, 39, 44, 49, 55, 65, 73, 81, 89, 96, 103, 110 — keep the rest of each line verbatim). Then the two docstring references:
- Line 5: `// TODO(phase-13):` comment (greppable marker for the phase-13 audit). → `// TODO:` comment (greppable marker for the escape-hatch audit).
- Line 16: `the TODO(phase-13) marker, not the rule fire.` → `the TODO marker, not the rule fire.`

(Leave line 1 "Phase 2a strict-TS escape hatches" — that's past-tense provenance; bucket b, see Step 5.)

Run to confirm: `cd frontend && grep -c "TODO(phase" src/shared/types/escape-hatches.ts` → `0`.

- [ ] **Step 3: Fix the two contract forward-promises (verified still permissive/mock)**

`src/shared/api/contracts/signals.ts` line ~7-8:
- FROM: `...without rejecting real responses or extra fields. Phase 10 tightens` / `these against a live capture.`
- TO: `...without rejecting real responses or extra fields. Tighten these against a live capture once the backend stabilizes (TD-FE-53).`

`src/shared/api/contracts/tenant.ts` line ~5:
- FROM: `// guard. Phase 10 re-validates against the real endpoint it introduces.`
- TO: `// guard. Re-validate against the real endpoint once one exists (TD-FE-55).`

(Verified during planning: signals schema is still `z.object({}).passthrough()`; tenant schema is still the mock-derived shape. The rephrases state reality + cite the governing TD-FE.)

- [ ] **Step 4: Fix the remaining 7 scattered forward-promises**

| File:approx-line | FROM | TO |
|---|---|---|
| `src/shared/api/README.md:5` | `dependency-rule lint that will enforce shared/ boundaries arrives in Phase 4; placement here is by convention until then.` | `dependency-rule lint that enforces shared/ boundaries is in place; placement here follows that boundary.` |
| `src/shared/api/README.md:45` | `Extend per endpoint as feature phases (5–10) migrate.` | `Extend per endpoint as feature surfaces migrate.` |
| `src/test/msw/handlers.ts:13` | `...are NOT shipped here. They grow per feature in Phases 5–10` | `...are NOT shipped here. They grow per feature as each surface adds handlers.` |
| `src/features/shell/README.md:15` | `surfaced for MarketResearch until that page migrates (Phase 5).` | `surfaced for MarketResearch (retained for that surface).` |
| `src/features/strategist/README.md:38` | `service/hook are **deferred to Phase 13** (TD-FE-47) — Phase 8's scope was relocation, not rewrite.` | `service/hook **remain deferred** (TD-FE-47) — the relocation kept scope to moving, not rewriting.` |
| `src/features/customers/types.ts:3` | `retype stays deferred (TD-FE-9/10 posture; Phase 13) — import it from` | `retype stays deferred (TD-FE-9/10 posture) — import it from` |
| `src/features/auth/hooks/useLogin.ts:8` | `// restructured (Phase 4/10 owns that); this just gives the component isPending /` | `// restructured (tracked separately); this just gives the component isPending /` |
| `src/features/mission-control/README.md:65` | `...both unchanged — Phase 9 and Phase 13 remain their resolution phases.` | `...both unchanged — tracked under TD-FE-42 and the escape-hatch backlog.` |

(`mission-control/README.md:65` is also internally contradictory — line ~69 says Phase 9 already closed the profiler-merge — so dropping the future-phase framing also removes the contradiction.)

- [ ] **Step 5: Provenance pass (bucket b) — rephrase where the number drops cleanly, keep otherwise**

Sweep the remaining `grep -rInE "\b[Pp]hase[- ]?[0-9]" src/` hits (the ~91 provenance + ~30 citations). Apply the §W1 quality bar:
- Drop the bare phase number when the sentence keeps its meaning, e.g. `shared/lib/leadData.ts`: "Promoted in Phase 11 (TD-FE-63)" → "Shared by strategist + market-research (TD-FE-63)" (keep the TD-FE citation).
- **Keep** `(TD-FE-…)`, `Spec N`, `plan N`, `ADR-…` citations as-is (bucket c).
- **Keep** mock-data domain content like `RegulatoryComplianceSection.tsx` "EU AI Act Phase 1" (real-world regulatory phase, not a refactor marker).
- **Keep** test filename/subject refs like `src/app/__tests__/phase12-routes.test.ts` (the number is the test's subject).
- If dropping a number would make a README provenance line vaguer, leave it — completeness is secondary to quality.

The bulk of bucket b lives in `src/shared/README.md`, `src/test/msw/handlers.ts` (handler-section labels), and the feature READMEs (handled per-file in Task 3 where overlapping).

- [ ] **Step 6: Record the classification ledger**

Run: `cd frontend && grep -rInE "\b[Pp]hase[- ]?[0-9]" src/ | tee /tmp/phase-refs-after.txt | wc -l`
Write a short ledger block (baseline 146; forward-promises-fixed 25; provenance-rephrased N; kept K with one-line reason per kept bucket) into the commit body or a scratch note for the impl-review. Spec 33 §W1 "Done when" requires this ledger.

- [ ] **Step 7: Verify nothing broke**

Run: `cd frontend && npm run typecheck && npm run lint && npm run format:check`
Expected: PASS. (Comments/markdown only; if `format:check` flags a touched `src/` file, run `npm run format` on it — note: NOT on `docs/TECH_DEBT.md`, see Task 6.)

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "refactor(fe): clear stale phase-references from src/ (W1 — fix forward-promises, drop transient provenance numbers)"
```

---

## Task 3: W3 — Enrich the 6 stub feature READMEs + verify the rest

**Files:** `src/features/{auth,settings,tenant,calendar,insights,reports}/README.md`

Each stub gets the full template: `## Purpose` / `## Public surface` / `## Key files` / `## Dependency notes`. Content below was derived during planning from each feature's `index.ts` exports, folder, and route.

- [ ] **Step 1: Write the 6 READMEs**

Each feature's public surface is its `<feature>Routes` export. Use this content (adjust Key files to the actual folder listing you see):

**`auth/README.md`:**
```markdown
# `auth` feature

## Purpose

User login and the authentication entry surface (Firebase email/password → JWT). The unauthenticated entry point of the app.

## Public surface

Re-exported from `index.ts`:
- `authRoutes` — the feature's routes, composed append-only into `src/app/routes.tsx`.

## Key files

- `pages/LoginPage.tsx` — login page component
- `hooks/useLogin.ts` — login mutation hook
- `routes.tsx` — route registry (`/`, `/login`)
- `index.ts` — public re-exports

## Dependency notes

- Consumes app-wide auth/tenant primitives from `@/shared/auth` and `@/shared/tenant`.
- May import another feature only via its `index.ts`.
```

**`settings/README.md`:**
```markdown
# `settings` feature

## Purpose

User, company, and agent profile configuration UI.

## Public surface

Re-exported from `index.ts`:
- `settingsRoutes` — feature routes (`/settings`, protected).

## Key files

- `pages/SettingsPage.tsx` — settings container
- `components/UserProfile.tsx`, `components/CompanyProfile.tsx`, `components/AgentProfile.tsx`
- `routes.tsx`, `index.ts`

## Dependency notes

- Company-profile API contract types live in `@/shared/api`.
- May import another feature only via its `index.ts`.
```

**`tenant/README.md`:**
```markdown
# `tenant` feature

## Purpose

Lets an authenticated user select their active tenant before entering the protected app.

## Public surface

Re-exported from `index.ts`:
- `tenantRoutes` — feature routes (`/tenant-selection`, protected, no tenant requirement).

## Key files

- `pages/TenantSelectionPage.tsx` — tenant picker
- `hooks/useTenants.ts` — tenant-list hook (currently a mock list — see TECH_DEBT TD-FE-55)
- `routes.tsx`, `index.ts`

## Dependency notes

- App-wide tenant context primitive lives in `@/shared/tenant`.
- May import another feature only via its `index.ts`.
```

**`calendar/README.md`:**
```markdown
# `calendar` feature

## Purpose

Task calendar and activator-chat interface for campaign scheduling.

## Public surface

Re-exported from `index.ts`:
- `calendarRoutes` — feature routes (`/calendar`, protected).

## Key files

- `pages/CalendarPage.tsx` — calendar UI
- `routes.tsx`, `index.ts`

## Dependency notes

- Presentational/mock surface (no backend yet — see TECH_DEBT TD-FE-59).
- May import another feature only via its `index.ts`.
```

**`insights/README.md`:**
```markdown
# `insights` feature

## Purpose

Analytics / business-intelligence insights dashboard.

## Public surface

Re-exported from `index.ts`:
- `insightsRoutes` — feature routes (`/insights`, protected).

## Key files

- `pages/InsightsPage.tsx` — insights dashboard
- `routes.tsx`, `index.ts`

## Dependency notes

- Presentational/mock surface (no backend yet — see TECH_DEBT TD-FE-59).
- May import another feature only via its `index.ts`.
```

**`reports/README.md`:**
```markdown
# `reports` feature

## Purpose

Reporting and data-export surface.

## Public surface

Re-exported from `index.ts`:
- `reportsRoutes` — feature routes (`/reports`, protected).

## Key files

- `pages/ReportsPage.tsx` — reports UI
- `routes.tsx`, `index.ts`

## Dependency notes

- Presentational/mock surface (no backend yet — see TECH_DEBT TD-FE-59).
- May import another feature only via its `index.ts`.
```

- [ ] **Step 2: Verify the substantive READMEs are still accurate + add cross-links**

Open `src/features/README.md`, `src/shared/README.md`, and the substantive feature READMEs (`mission-control`, `customers`, `market-research`, `signals`, `strategist`, `scout`, `shell`, `artifacts`). For each: confirm the public-surface/key-files claims match the current folder; correct any drift; apply the W1 provenance pass (drop transient phase numbers, keep TD-FE citations). Add a cross-link line to `src/features/README.md` and `src/shared/README.md` pointing to the ADR index (`docs/adr/README.md`, created in Task 5).

- [ ] **Step 3: Confirm the naming map matches reality**

Confirm `src/features/README.md`'s naming map lists exactly the 14 folders and agrees with `NAMING_MAP` in `scaffold-feature.ts` (Task 1). They must match (ground truth = the 14 actual folders).

Run: `cd frontend && ls -d src/features/*/ | xargs -n1 basename` and compare.

- [ ] **Step 4: Verify no stub remains**

Run: `cd frontend && for f in auth settings tenant calendar insights reports; do echo "$f: $(wc -l < src/features/$f/README.md) lines"; done`
Expected: each well above the 5/15-line stub size, with a real `## Purpose`.
Run: `cd frontend && npm run format:check` (or `npm run format` on touched READMEs).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features frontend/src/shared/README.md
git commit -m "docs(fe): enrich stub feature READMEs + verify/cross-link the rest (W3)"
```

---

## Task 4a: W2 + W7 — Reconcile CLAUDE.md/AGENTS.md dedup + branch model

**Files:** `CLAUDE.md`, `AGENTS.md`, `README.md`, `BRANCHES.md`

Approach: bring both agent docs to a **byte-identical shared base** plus each file's tool-specific delta. Edit `CLAUDE.md` to final form, then rebuild `AGENTS.md` from it with exactly its known deltas.

- [ ] **Step 1: Fix the AGENTS.md H1 + intro (the dedup defect)**

In `AGENTS.md`:
- Line 1: `# CLAUDE.md` → `# AGENTS.md`
- Line 3: `This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.` → `This file provides guidance to AI coding agents (Claude Code, Kilo Code, and similar) working in this repository. It mirrors CLAUDE.md, plus the "Tool Usage Pitfalls" section below (which applies to non-Claude IDEs).`

In `CLAUDE.md` line 3, add the reciprocal cross-ref: append ` AGENTS.md mirrors this file for other agentic IDEs and adds a "Tool Usage Pitfalls" section.`

- [ ] **Step 2: Sync the AI-Native Development section into AGENTS.md**

`AGENTS.md`'s "## AI-Native Development" (the abbreviated 3-bullet Spec-driven-flow at lines ~123–129) is stale relative to `CLAUDE.md`'s full version. Per the operator's decision, the slash-command flow belongs in **both** files. Replace `AGENTS.md`'s "Spec-driven flow" + "NN numbering" region with `CLAUDE.md`'s fuller "Spec-driven flow" (the 4-step cycle with `/review-spec`…`/synthesize-impl-review`, the human-approved-merge step) + "No CI; preflight is local" paragraph + "NN numbering" + "Specs and plans are a frozen record" bullets, verbatim, so the two files' AI-Native sections are identical.

- [ ] **Step 3: Add the drift-prevention convention to BOTH files**

At the end of the "## AI-Native Development" section in both `CLAUDE.md` and `AGENTS.md`, add:
```markdown
- **CLAUDE.md ↔ AGENTS.md are kept in sync.** They share an identical base; AGENTS.md additionally carries the "Tool Usage Pitfalls" section for non-Claude IDEs. **Any edit to a shared section must be applied to both files.**
```

- [ ] **Step 4: Rewrite the branch-model section (W7) in BOTH files**

Replace the "## Monorepo Branch Model (during temp week ending ~2026-05-22)" section (CLAUDE.md/AGENTS.md lines ~33–67) with this steady-state version (identical in both):

```markdown
## Branch Model

The monorepo cutover is **complete**. `master` is the single integration trunk; all work happens on short-lived branches that merge back.

| Branch | Role | Policy |
|---|---|---|
| `master` | Stable trunk / single integration branch. | No direct feature commits — branch off `master`, review when warranted, merge back with `--no-ff`. Direct commits reserved for trivial doc/typo fixes. |
| legacy (`develop`, `production`, `refactor`, `pwa-*`, `pwa-master-history`) | Dormant pre-cutover history. | **Read-only — do not commit.** Retained a few months for issue triage / rollback and business reasons, then pruned. Not active development targets. |

**Discipline rules:**
- Feature/phase work happens on a short-lived branch named `phase-N-*` (or feature-named), cut off `master`, merged back via `--no-ff` after a green local `npm run preflight` (see "AI-Native Development"). Review depth is judgment: plan execution, multi-commit refactors, and non-trivial logic warrant it; trivial fixes don't. Delete branches after merge.
- The legacy branches are a frozen safety net from the fork/cutover, not sync or commit targets.

**Recovery anchors:**
- Tag `pre-monorepo-fork-2026-05-08` (PWA + backend origins at fork moment).
- Tag `fork-point-2026-05-08` (monorepo `master` initial post-import state).
- `pwa-master-history` (full PWA pre-fork history with original SHAs).
```

- [ ] **Step 5: Remove the remaining temp-week scaffolding in BOTH files**

- In "## Repository Layout", change the `scripts/` annotation line `│   ├── sync.sh              # pull Brewra-dev work from old repos (temp week only)` → `│   ├── sync.sh              # (retired) cutover-era sync tool` (or drop the line if `sync.sh` no longer exists — verify with `ls scripts/sync.sh`).
- In "## AI-Native Development", delete the `- **Sync workflow** (during temp week only): …` bullet (the cutover is done).
- In "## Gotchas", delete the `- **Tracker branch hygiene.** develop and production are sync targets…` bullet (superseded by the Branch Model table).

- [ ] **Step 6: Rewrite `README.md` and `BRANCHES.md` branch sections**

`README.md` "## Branches" (lines 16–18) → replace the "temporary parallel-branch state" prose with:
```markdown
## Branches

Monorepo cutover is complete. `master` is the trunk; work happens on short-lived `phase-N-*`/feature branches merged back via `--no-ff`. Legacy branches (`develop`/`production`/`refactor`/`pwa-*`) are retained dormant for a few months for rollback/triage, then pruned. See `BRANCHES.md`.
```
Also in `README.md` "## Common commands", delete the `# sync Brewra-dev work from old repos (temp week only)` block (lines 29–30).

`BRANCHES.md` → replace the whole "temp week" framing with the steady-state model: the same table + discipline rules + recovery anchors from Step 4, and a "## Legacy branches (retained dormant)" section explaining the few-months retention. Remove the "## Workflows" sync section and "## Future state (post-cutover)" (it's now the present state).

- [ ] **Step 7: Verify the dedup invariant + no temp-week residue**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Shared base identical except the known deltas (H1, intro line, Tool Usage Pitfalls):
diff CLAUDE.md AGENTS.md
# Expected diff: line 1 (H1), line 3 (intro), and the "## Tool Usage Pitfalls" block only.
grep -rin "temp week\|sync.sh\|tracker branch\|during the fork transition" CLAUDE.md AGENTS.md README.md BRANCHES.md
# Expected: no live references presenting these as current (only the retired/historical mentions you intentionally kept).
```

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md AGENTS.md README.md BRANCHES.md
git commit -m "docs: reconcile CLAUDE.md/AGENTS.md dedup + rewrite branch model to steady state (W2/W7)"
```

---

## Task 4b: W2b — Refresh stale frontend topology in CLAUDE.md/AGENTS.md

**⚠️ Operator-gated (see plan header).** Extends Spec 33 W2 under the master-plan "amend root docs where the new structure makes guidance stale" mandate. The FE sections describe the pre-refactor frontend.

**Files:** `CLAUDE.md`, `AGENTS.md` (apply identical edits to both — they share this base).

- [ ] **Step 1: Rewrite "### Frontend topology"**

Replace the current bullets (TanStack-unused, `apiFetch → enhancedApi → authenticatedApi`, 4 req/min, three caching layers) with the current structure:

```markdown
### Frontend topology
- React 18 + Vite + Tailwind + shadcn-ui (Radix). Firebase email/password auth. PWA via `vite-plugin-pwa` (Workbox).
- **Per-feature structure** (post-refactor): product surfaces live under `src/features/<feature>/` (pages/components/hooks/services/types.ts/index.ts/README.md). Cross-cutting code lives in `src/shared/` (`api/`, `auth/`, `tenant/`, `components/`, `hooks/`, `lib/`, `types/`, `styles/`). shadcn primitives are locked in `src/components/ui/`. Cross-feature imports go through a feature's `index.ts` only (enforced by `import-x` lint). Full conventions: `frontend/src/features/README.md`.
- **Data layer:** TanStack Query is the server-state layer, configured in `src/shared/api/` with hand-authored zod contracts and a single rate limiter (**30 req/min**). Transport is `src/shared/api/transport.ts` (`apiFetch`). Some editable-state features still retain `localStorage`/`sessionStorage` by deliberate deferral — see `docs/TECH_DEBT.md` (TD-FE-19 family).
- **App-wide state:** `AuthContext` + `TenantContext` live in `src/shared/auth/` and `src/shared/tenant/`.
- Routing: `/` → login → `/tenant-selection` → protected. Scout at `/your-ai-team/scout/:tab`, Strategist at `/your-ai-team/strategist/:tab` (Deals.tsx is the Strategist page); Profiler is distributed across `/mission-control` and `/customers` (no separate `features/profiler/` — see ADR-0006 / TD-FE-60).
- Tooling/quality gates: `npm run preflight` (typecheck, lint, format:check, vitest, build, advisory bundle:check, Playwright + visual regression, knip --strict). See "AI-Native Development".
```

- [ ] **Step 2: Fix the "What the product is" Strategist path**

In "### What the product is", change `frontend/src/components/strategist/StrategistWorkspace.tsx` → `frontend/src/features/strategist/` (StrategistWorkspace renders on the Strategist page; hydrates from `sessionStorage.strategistContext`).

- [ ] **Step 3: Fix stale FE gotchas + polyglot FE references**

- "### Frontend topology" / Polyglot: `frontend/src/types/` → `frontend/src/features/*/types.ts` + `src/shared/types/`.
- Polyglot "/api/* proxy": the proxy target `backend-11kr.onrender.com` → `brewra-gtm-intelligence.onrender.com` (TD-FE-13 repoint); `enhancedApi / apiFetch callsites` → `src/shared/api` callsites.
- Gotchas: **delete** the "Frontend has unused/duplicate cruft: SafeChatWithScout copy.tsx, MarketResearch_clean.tsx, _restore_test.txt, ICPManager.tsx commented-out, three Safe* wrappers" bullet — Phase 1 deleted these (verify: `ls frontend/src/pages/MarketResearch_clean.tsx` → not found).
- Gotchas: the "Frontend duplicates the Scout/Profiler split: ScoutChatWithHistory and ProfilerChatWithHistory are 90% the same" bullet → update: "Scout/Profiler chat share a `ChatWithHistory` shell in `src/shared/chat/`; both wrappers delegate to it (deduped in the refactor)."
- The Lovable line ("originally generated by Lovable, lovable-tagger in vite.config.ts"): verify whether `lovable-tagger` still appears in `frontend/vite.config.ts` (`grep lovable frontend/vite.config.ts`). If gone, soften to "originally Lovable-generated (tagger since removed)"; if present, leave.

- [ ] **Step 4: Re-apply the dedup invariant**

Run the `diff CLAUDE.md AGENTS.md` check again (Step 7 of Task 4a) — the only diff must still be H1, intro line, and the Tool Usage Pitfalls block. (Both files received identical W2b edits.)

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: refresh stale frontend-topology + gotchas in CLAUDE.md/AGENTS.md (W2b — amend-where-stale)"
```

---

## Task 5: W6 — ADR index + 3 targeted backfills

**Files:** Create `docs/adr/README.md`, `docs/adr/0006-…`, `0007-…`, `0008-…`. The existing ADRs follow the slim 3-part form (Context / Decision / Consequences) from `0001-adr-template.md`.

- [ ] **Step 1: Write the three backfill ADRs (slim form)**

`docs/adr/0006-scout-profiler-kept-distributed.md`:
```markdown
# ADR-0006: Scout/Profiler kept distributed; no `features/profiler/`

## Context
Scout and Profiler share ~80% of backend logic (prompt-persona split). The refactor's §3.1 left open whether the frontend should be one feature with two personas or two sibling features. Phase 9 extracted Scout into a thin `features/scout/`; Profiler functionality was already distributed across `features/customers/`, `features/mission-control/`, and `src/shared/profiler/`.

## Decision
No `features/profiler/` folder. Profiler stays distributed across customers + mission-control + `shared/profiler/`. The shared chat substrate (`ChatWithHistory` in `src/shared/chat/`) backs both Scout and Profiler chat.

## Consequences
Profiler has no single home — a reader looks in three places. Accepted as intentional asymmetry; revisit if Profiler grows a standalone routed surface. Tracked as TD-FE-60.
```

`docs/adr/0007-advisory-over-hard-fail-gate-posture.md`:
```markdown
# ADR-0007: Advisory-over-hard-fail gate posture (pre-launch)

## Context
At MVP / 0 live users, flaky or machine-dependent hard-fail gates erode trust faster than they catch regressions. Several candidate gates arose during the refactor: bundle-size budget, NFR wall-time thresholds, a stale-doc grep gate, and a zero-raw-fetch feature gate.

## Decision
Default to advisory (warn, never block) for noisy/machine-dependent checks while pre-launch. `bundle:check` is advisory; NFR wall-time gating was dropped (Phase 2c); the stale-doc gate was not built (replaced by a one-time cleanup); the zero-raw-fetch gate was relaxed to advisory. Deterministic gates (typecheck, lint, vitest, build, knip, visual regression) stay hard-fail in `preflight`.

## Consequences
Fewer false-merge-blocks; some regressions (bundle growth) caught by eye, not enforcement. Reconsider hard thresholds post-launch with real data.
```

`docs/adr/0008-editable-state-features-defer-tanstack-migration.md`:
```markdown
# ADR-0008: Editable-state features defer full TanStack migration

## Context
Phase 3 adopted TanStack Query as the server-state layer and proved the pattern on auth/tenant/settings. Several feature surfaces (market-research, signals, customers read-orchestration) couple editable draft state to their fetch logic — a loading-phase state machine that reads editable data to decide transitions — which resists a declarative `useQuery` migration.

## Decision
Those features keep imperative `fetch` + `localStorage`/`sessionStorage` for now rather than force an unsafe migration. The decoupling (move fetch results into a query layer; hydrate editable drafts from it via an explicit reset/merge boundary) is deferred.

## Consequences
The "single source of server-state truth" (master-plan §6.9) is partially met. Tracked as TD-FE-19/21/41/43/49/53/65; `useMarketResearchData.ts` decomposition (TD-FE-65) is blocked on this decoupling.
```

- [ ] **Step 2: Write the ADR index `docs/adr/README.md`**

```markdown
# Architecture Decision Records

Slim 3-part form (Context / Decision / Consequences) — template at `0001-adr-template.md`. Numbering is sequential and never reused.

| ADR | Title | Status |
|---|---|---|
| 0001 | ADR template | template |
| 0002 | Cross-cutting client state + components live in `shared/` | accepted |
| 0003 | market-research contracts are feature-local | accepted |
| 0004 | market-research cache is memory-only | accepted |
| 0005 | UI-layer-consumed utilities live in `components/ui/` | accepted |
| 0006 | Scout/Profiler kept distributed; no `features/profiler/` | accepted |
| 0007 | Advisory-over-hard-fail gate posture (pre-launch) | accepted |
| 0008 | Editable-state features defer full TanStack migration | accepted |
```

(Confirm the 0002–0005 titles against the actual files before finalizing the one-liners.)

- [ ] **Step 3: Cross-link from CLAUDE.md**

In `CLAUDE.md`/`AGENTS.md` (both), add to the "## Technical Debt Register" section (or a new adjacent line) a pointer: `Architecture decisions are recorded as ADRs in `docs/adr/` (index: `docs/adr/README.md`).` Re-run the `diff CLAUDE.md AGENTS.md` invariant check.

- [ ] **Step 4: Verify**

Run: `ls docs/adr/ && cat docs/adr/README.md` — index lists all 8 rows; the 3 new files exist.
Run: `cd frontend && npm run format:check` (ADRs are under `docs/`, outside the frontend prettier root — but if your editor reformatted any `frontend/` file, catch it here).

- [ ] **Step 5: Commit**

```bash
git add docs/adr CLAUDE.md AGENTS.md
git commit -m "docs(adr): add ADR index + backfill 0006-0008 (scout/profiler, gate posture, data-layer deferral) (W6)"
```

---

## Task 6: W4 — TECH_DEBT archive split + numeric index

**Files:** Create `docs/TECH_DEBT_ARCHIVE.md`; Modify `docs/TECH_DEBT.md`. **No prettier on either file — surgical edits only** (prettier corrupts the unfenced `*`/`_` markdown).

Classification (done during planning, conservative triage — partials/superseded stay): **18 RESOLVED-ARCHIVE** = TD-FE-1, 2, 3, 4, 5, 6, 7, 13, 14, 15, 18, 22, 32, 51, 54, 57, 62, 63. **46 OPEN-KEEP + 2 design-intent guards (49, 60) stay.** TD-FE-32 becomes resolved by Task 1 — include it in the archive set and write its resolution note.

- [ ] **Step 1: Create the archive file with a preamble**

`docs/TECH_DEBT_ARCHIVE.md`:
```markdown
# Brewra — Resolved Technical Debt (Archive)

Fully-resolved frontend tech-debt entries, moved here from `docs/TECH_DEBT.md` to keep the active register focused. Entry text and numbering are preserved verbatim — IDs are never reused. Open and carried-forward entries (including partially-resolved ones) remain in the main register. Index: see the table at the top of `docs/TECH_DEBT.md`.

---
```

- [ ] **Step 2: Move the 18 resolved entries verbatim**

For each of TD-FE-1, 2, 3, 4, 5, 6, 7, 13, 14, 15, 18, 22, 32, 51, 54, 57, 62, 63: cut the entry's full section (from its `## TD-FE-<n> —` header to the line before the next `## ` header) out of `docs/TECH_DEBT.md` and paste it verbatim into `docs/TECH_DEBT_ARCHIVE.md`. Preserve original wording; do not reflow. For TD-FE-32, first add its resolution note (resolved by Phase 14 W5: NAMING_MAP synced + tested) before moving it.

Keep the file's existing preamble (the "Numbering is preserved…" paragraph) in `docs/TECH_DEBT.md`.

- [ ] **Step 3: Add the numeric index table at the top of `docs/TECH_DEBT.md`**

Immediately after the existing preamble + `---`, insert an index covering every `TD-FE-<n>` (1–66). Format:
```markdown
## Index — TD-FE entries

| Entry | Status | Location |
|---|---|---|
| TD-FE-1 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-1--…) |
| TD-FE-8 | open | [below](#td-fe-8--…) |
| … | … | … |
```
Mark the 18 as `resolved → archive`, the rest as `open → below`. This preserves the cross-references between entries (e.g. "mirror TD-FE-19/21") — the index is the single lookup point. (Cross-ref map from planning: TD-FE-19 is referenced by 21/27/28/30/31/53/65/66; TD-FE-51↔63; etc. — all those referenced entries are OPEN-KEEP except 51/63 which move, so their archive anchors must resolve.)

- [ ] **Step 4: Verify no prettier reflow + index integrity**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git diff --stat docs/TECH_DEBT.md docs/TECH_DEBT_ARCHIVE.md
# Confirm the main file shows deletions (moved entries) + the index addition, NOT a whole-file reflow.
grep -cE "^## TD-FE-" docs/TECH_DEBT.md        # expect 48 (66 - 18 moved)
grep -cE "^## TD-FE-" docs/TECH_DEBT_ARCHIVE.md # expect 18
```
Spot-check that every `resolved → archive` index link's anchor exists in the archive, and that backend `TD-NNN` entries are untouched.

- [ ] **Step 5: Commit**

```bash
git add docs/TECH_DEBT.md docs/TECH_DEBT_ARCHIVE.md
git commit -m "docs: archive 18 resolved TD-FE entries + add numeric index (W4 — surgical, no prettier)"
```

---

## Task 7: W8 — Master-plan close

**Files:** `specs/14-frontend-refactoring-master-plan-design.md`

- [ ] **Step 1: Walk the §6 ten done-criteria against `master`**

For each of Spec 14 §6's 10 criteria, confirm it holds or note the gap. Use the known-likely-gaps from Spec 33 W8 as the starting checklist:
- §6.1 Structure: confirm `src/pages`, `src/hooks`, `src/lib`, `src/services`, `src/utils`, `src/contexts` are gone (`ls frontend/src` — expect `features/ shared/ components/ app/ test/ styles?` etc.). Log any survivor.
- §6.9 Data layer: **partial** — TanStack adopted, but editable-state features retain localStorage/sessionStorage (TD-FE-19/21/41/43/49/53/65). Record as accepted gap (now covered by ADR-0008).
- §6.3 Escape hatches: surviving entries (TD-FE-9/10/38) — record.
- §6.2/6.4/6.5/6.6/6.7/6.8/6.10: confirm (tests/lints/preflight/per-feature docs after W3/W6/this phase/LOC passes/agent affordances). Note any gap as TD-FE.

Write the walk result into the Phase 14 delta (Step 3).

- [ ] **Step 2: Flip the Spec 14 status row**

In Spec 14 §4 "Status" table, change the `14 — Agent affordances | pending | —` row to `14 — Agent affordances | done | 2026-06-08` (use the actual merge date at merge time).

- [ ] **Step 3: Append the Phase 14 frozen-record delta**

Under the Phase 14 §4 block, append a `> **Phase 14 deltas (recorded 2026-06-08, frozen-record convention…)**` note capturing: the §1.2 reframe (moot/done/deferred deliverables), the W1 no-gate decision (cleanup instead), the W2b FE-topology refresh, ADR-0006/0007/0008 added, the TECH_DEBT archive, and the §6 walk result (which criteria are accepted-gaps). Update §8 Q3 to note bundle/NFR reconsideration remains deferred (still pre-launch).

- [ ] **Step 4: Verify**

Run: `grep -n "14 — Agent affordances" specs/14-frontend-refactoring-master-plan-design.md` → shows `done`.
(Spec 14 is under `docs/`-adjacent `specs/` — not in the frontend prettier root; no prettier.)

- [ ] **Step 5: Commit**

```bash
git add specs/14-frontend-refactoring-master-plan-design.md
git commit -m "docs(fe): close master plan — flip Phase 14 to done, record §6 walk + Phase 14 delta (W8)"
```

---

## Task 8: Final preflight + merge prep

- [ ] **Step 1: Run the full serial preflight**

Run: `cd frontend && npm run preflight`
Expected: GREEN (typecheck, lint, format:check, vitest incl. the new scaffold test, build, advisory bundle:check, Playwright + VR, knip --strict). If a `frontend/` file shows a prettier diff, run `npm run format` on it and re-run — **never** prettier `docs/TECH_DEBT*`.

If red: report the failing check; do not merge (Spec 14 §5.3 — no fix-forward).

- [ ] **Step 2: Confirm the working tree + branch state**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status --short        # clean
git log --oneline master..phase-14-agent-affordances   # 7 task commits + spec/synthesis commits
```

- [ ] **Step 3: Hand off for impl review**

Stop here for the §5 adversarial impl-review cycle (`review-impl` → `synthesize-impl-review`) before the user-approved `--no-ff` merge to `master`. The merge + `git push origin master` is the operator-approved final step (Spec 14 §5.6); merging closes the master plan.

---

## Self-review notes (author)

- **Spec coverage:** W1→Task 2; W2→Task 4a; W2b (FE-topology, plan-added)→Task 4b; W3→Task 3; W4→Task 6; W5→Task 1; W6→Task 5; W7→Tasks 4a (CLAUDE/AGENTS) + 4a Step 6 (README/BRANCHES); W8→Task 7. All eight workstreams covered.
- **Type consistency:** the W5 exports (`NAMING_MAP`, `validateName`, `scaffoldFeature`, `ScaffoldOptions`) match between `scaffold-feature.ts` and `scaffold-feature.test.ts`.
- **No-prettier guard** repeated at every `docs/TECH_DEBT*` touchpoint (Tasks 6, 8).
- **Open for operator:** Task 4b scope (FE-topology refresh) — confirm or drop per the header note.
