// frontend/scripts/scaffold-feature.ts
// Scaffolds a new feature folder under src/features/ with the canonical
// always-present files (types.ts, index.ts, README.md). Subfolders
// (pages/components/hooks/services) are created on demand — never here.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  const valid = validateName(name);
  if (!valid.ok) {
    throw new Error(`invalid feature name "${name}": ${valid.error}`);
  }

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

// Only execute the CLI when run directly (`tsx scripts/scaffold-feature.ts`),
// not when imported by the test.
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
