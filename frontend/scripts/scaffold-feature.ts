// frontend/scripts/scaffold-feature.ts
// Scaffolds a new feature folder under src/features/ with the canonical
// always-present files (types.ts, index.ts, README.md). Subfolders
// (pages/components/hooks/services) are created on demand — never here.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const FRONTEND_DIR = resolve(import.meta.dirname, "..");
const FEATURES_DIR = join(FRONTEND_DIR, "src", "features");

// Living naming map — keep in sync with src/features/README.md.
// `profiler` is reserved (Phase 9). Phase 12 appends its small-page names.
const NAMING_MAP = [
  "auth",
  "customers",
  "market-research",
  "mission-control",
  "scout",
  "settings",
  "shell",
  "signals",
  "strategist",
  "tenant",
];

const KEBAB_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

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
- Transitional (Phases 4b–12): may import not-yet-migrated legacy dirs (\`@/contexts\`, \`@/hooks\`, \`@/lib\`, \`@/utils\`, \`@/pages\`).
`;
}

async function main(): Promise<void> {
  const name = process.argv[2];

  if (!name) {
    console.error("usage: npm run scaffold:feature -- <kebab-name>");
    process.exit(1);
  }

  if (!KEBAB_RE.test(name)) {
    console.error(`invalid feature name "${name}": must be kebab-case, e.g. market-research`);
    process.exit(1);
  }

  const featureDir = join(FEATURES_DIR, name);
  if (existsSync(featureDir)) {
    console.error(`feature "${name}" already exists at ${featureDir}; refusing to overwrite`);
    process.exit(1);
  }

  if (!NAMING_MAP.includes(name)) {
    console.warn(
      `warning: "${name}" is not on the naming map in src/features/README.md. ` +
        `Add it there before scaffolding a planned feature (continuing anyway).`,
    );
  }

  await mkdir(featureDir, { recursive: true });
  await writeFile(join(featureDir, "types.ts"), typesStub(name), "utf8");
  await writeFile(join(featureDir, "index.ts"), indexStub(name), "utf8");
  await writeFile(join(featureDir, "README.md"), readmeStub(name), "utf8");

  console.log(`scaffolded src/features/${name}/ (types.ts, index.ts, README.md)`);
  console.log("next: add pages/components/hooks/services/ on demand — no empty dirs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
