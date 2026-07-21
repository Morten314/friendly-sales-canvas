import { execFile } from "node:child_process";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join, relative, resolve, dirname, basename } from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const FRONTEND_DIR = resolve(import.meta.dirname, "..");
const SRC_DIR = join(FRONTEND_DIR, "src");
const KNIP_JSON = resolve(
  FRONTEND_DIR,
  "..",
  "docs",
  "audits",
  "2026-05-26-frontend-deadcode-knip.json",
);
const OUTPUT_FILE = resolve(
  FRONTEND_DIR,
  "..",
  "docs",
  "audits",
  "2026-05-26-frontend-baseline.md",
);

interface FileRow {
  path: string; // relative to frontend/
  area: string; // top-level grouping label
  loc: number;
  staticRefs: number;
  deadExport: boolean;
  deadFile: boolean;
  lovableArtifact: boolean;
  looseComponent: boolean;
  notes: string[];
}

// Lovable-artifact filename patterns (spec §1.5 + CLAUDE.md "Frontend has unused/duplicate cruft").
const LOVABLE_PATTERNS: RegExp[] = [
  /^Safe.*\.(ts|tsx)$/, // Safe* wrapper triplet
  /MarketResearch_clean\.tsx$/, // duplicate of MarketResearch.tsx
  /SafeChatWithScout copy\.tsx$/, // " copy" suffix
];

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function classifyArea(relPath: string): string {
  // relPath is e.g. "src/components/customers/Foo.tsx" or "src/lib/utils.ts"
  const parts = relPath.split("/");
  if (parts[0] !== "src") return "other";
  if (parts.length === 2) return "root"; // src/App.tsx, src/main.tsx
  if (parts[1] === "components") {
    if (parts.length === 3) return "components/ (loose)"; // src/components/Foo.tsx
    return `components/${parts[2]}/`; // src/components/customers/Foo.tsx
  }
  return `${parts[1]}/`; // src/lib/, src/hooks/, etc.
}

async function countLoc(absPath: string): Promise<number> {
  const buf = await readFile(absPath, "utf-8");
  return buf.split("\n").length;
}

async function collectAllImports(): Promise<Map<string, number>> {
  // Single ripgrep pass to extract every `from '<path>'` import string across
  // src/ and e2e/. Returns a Map of import path → occurrence count. The
  // per-file countRefs lookup then aggregates from this map in O(map size)
  // rather than spawning ripgrep per source file (which was O(files) process
  // spawns at hundreds of files).
  const { stdout } = await execFileP(
    "rg",
    [
      "--no-heading",
      "--no-filename",
      "--only-matching",
      "--glob",
      "*.ts",
      "--glob",
      "*.tsx",
      `from ['"][^'"]+['"]`,
      join(FRONTEND_DIR, "src"),
      join(FRONTEND_DIR, "e2e"),
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const counts = new Map<string, number>();
  for (const line of stdout.split("\n")) {
    const m = line.match(/from ['"]([^'"]+)['"]/);
    if (!m) continue;
    const importPath = m[1];
    counts.set(importPath, (counts.get(importPath) ?? 0) + 1);
  }
  return counts;
}

function countRefsFor(allImports: Map<string, number>, relPathNoExt: string): number {
  // Match imports whose path ends with the file's src-relative path (sans ext).
  // Preserves the original countStaticRefs semantics: `@/lib/utils`, `../lib/utils`,
  // `../../lib/utils` all count for `src/lib/utils.ts`; bare `./utils` does not
  // (matches the documented lower-bound limitation in spec §2.1).
  const suffix = relPathNoExt.replace(/^src\//, ""); // "lib/utils" or "components/customers/Foo"
  let total = 0;
  for (const [importPath, count] of allImports) {
    if (importPath === suffix || importPath.endsWith("/" + suffix)) {
      total += count;
    }
  }
  return total;
}

async function loadKnip(): Promise<{ deadFiles: Set<string>; deadExports: Set<string> }> {
  const raw = await readFile(KNIP_JSON, "utf-8");
  const parsed = JSON.parse(raw);
  const deadFiles = new Set<string>();
  const deadExports = new Set<string>();

  // knip 5.x JSON: { files: [...], issues: [{file, exports, types, ...}, ...] }
  // Be defensive — accept both array and object shapes.
  const filesField = parsed.files;
  if (Array.isArray(filesField)) {
    for (const f of filesField) deadFiles.add(normalize(f));
  }
  const issuesField = parsed.issues;
  if (Array.isArray(issuesField)) {
    for (const issue of issuesField) {
      const file = normalize(issue.file ?? "");
      if (!file) continue;
      const hasExports =
        (Array.isArray(issue.exports) && issue.exports.length > 0) ||
        (Array.isArray(issue.types) && issue.types.length > 0);
      if (hasExports) deadExports.add(file);
    }
  } else if (issuesField && typeof issuesField === "object") {
    for (const [file, payload] of Object.entries(
      issuesField as Record<string, { exports?: unknown[]; types?: unknown[] }>,
    )) {
      const f = normalize(file);
      const hasExports =
        (Array.isArray(payload.exports) && payload.exports.length > 0) ||
        (Array.isArray(payload.types) && payload.types.length > 0);
      if (hasExports) deadExports.add(f);
    }
  }
  return { deadFiles, deadExports };

  function normalize(p: string): string {
    // knip emits paths relative to frontend/. Normalize separators.
    return p.replace(/\\/g, "/").replace(/^\.\//, "");
  }
}

function isLovableArtifact(relPath: string): boolean {
  const base = basename(relPath);
  return LOVABLE_PATTERNS.some((re) => re.test(base));
}

function isLooseComponent(relPath: string): boolean {
  // src/components/<file>.tsx (depth-2 under src/)
  const parts = relPath.split("/");
  return parts[0] === "src" && parts[1] === "components" && parts.length === 3;
}

function fmtYN(b: boolean): string {
  return b ? "Y" : "N";
}

function buildTier1(rows: FileRow[]): string {
  // Aggregate by area.
  const byArea = new Map<string, FileRow[]>();
  for (const r of rows) {
    if (!byArea.has(r.area)) byArea.set(r.area, []);
    byArea.get(r.area)!.push(r);
  }
  const areas = Array.from(byArea.keys()).sort();

  const lines: string[] = [];
  lines.push(
    "| Area | Files | Total LOC | Monster files (>1500) | Dead exports | Dead files | Lovable | Notes |",
  );
  lines.push("|---|---:|---:|---:|---:|---:|:---:|---|");
  for (const area of areas) {
    const files = byArea.get(area)!;
    const fileCount = files.length;
    const totalLoc = files.reduce((s, r) => s + r.loc, 0);
    const monster = files.filter((r) => r.loc > 1500).length;
    const deadExp = files.filter((r) => r.deadExport).length;
    const deadFile = files.filter((r) => r.deadFile).length;
    const lovable = files.some((r) => r.lovableArtifact) ? "Y" : "N";
    const notes: string[] = [];
    if (area === "components/ (loose)") {
      notes.push(
        `loose under components/ — relocate in Phase 1 or with owning feature's extraction phase`,
      );
    }
    lines.push(
      `| \`${area}\` | ${fileCount} | ${totalLoc} | ${monster} | ${deadExp} | ${deadFile} | ${lovable} | ${notes.join("; ")} |`,
    );
  }
  return lines.join("\n");
}

function buildTier2(rows: FileRow[]): string {
  rows.sort((a, b) => a.path.localeCompare(b.path));
  const lines: string[] = [];
  lines.push(
    "| Path | LOC | Static refs (rg, lower bound) | Dead export | Dead file | Lovable | Notes |",
  );
  lines.push("|---|---:|---:|:---:|:---:|:---:|---|");
  for (const r of rows) {
    const notes: string[] = [...r.notes];
    if (r.looseComponent)
      notes.push("loose under components/ — relocate in Phase 1 or with owning feature");
    if (r.loc > 1500) notes.push(`monster file (>1500 LOC)`);
    if (r.lovableArtifact) notes.push("Lovable artifact — Phase 1 deletes");
    lines.push(
      `| \`${r.path}\` | ${r.loc} | ${r.staticRefs} | ${fmtYN(r.deadExport)} | ${fmtYN(r.deadFile)} | ${fmtYN(r.lovableArtifact)} | ${notes.join("; ")} |`,
    );
  }
  return lines.join("\n");
}

async function main() {
  const { deadFiles, deadExports } = await loadKnip();
  const allImports = await collectAllImports(); // one rg pass, before the file loop
  const absFiles = await walk(SRC_DIR);

  const rows: FileRow[] = [];
  for (const abs of absFiles) {
    const rel = relative(FRONTEND_DIR, abs).split("\\").join("/");
    const relNoExt = rel.replace(/\.(ts|tsx)$/, "");
    const loc = await countLoc(abs);
    const staticRefs = countRefsFor(allImports, relNoExt);
    rows.push({
      path: rel,
      area: classifyArea(rel),
      loc,
      staticRefs,
      deadExport: deadExports.has(rel),
      deadFile: deadFiles.has(rel),
      lovableArtifact: isLovableArtifact(rel),
      looseComponent: isLooseComponent(rel),
      notes: [],
    });
  }

  const totalFiles = rows.length;
  const totalLoc = rows.reduce((s, r) => s + r.loc, 0);

  const md = `# Frontend Baseline Audit — 2026-05-26

> Source: Spec 15 §2.1. Generated by \`frontend/scripts/build-audit-scorecard.ts\`. The notes
> columns below are agent-augmented after generation — see "Notes column augmentation" at the end.

**Captured at:** ${new Date().toISOString()}
**Total files:** ${totalFiles}
**Total LOC:** ${totalLoc}
**Source of dead-code flags:** \`docs/audits/2026-05-26-frontend-deadcode-knip.json\`
**Static-ref column note:** lower bound — ripgrep matches \`from '…/<path>'\` only. Misses
dynamic \`import()\`, barrel re-exports, lazy route configs, string-interpolated paths.
The knip dead-file flag is the authoritative dead-file signal.

---

## Tier 1 — Feature-area summary

${buildTier1(rows)}

---

## Tier 2 — Per-file annex

${buildTier2(rows)}

---

## Notes column augmentation

The notes column above is the agent's value-add over raw tool output. Phase 1's triage reads
this column when deciding \`execute\` vs \`investigate\` for each dead-code candidate.

**Categories applied automatically by the generator:**
- \`loose under components/\` — \`.tsx\` files directly under \`src/components/\` (not in a named subfolder)
- \`monster file (>1500 LOC)\`
- \`Lovable artifact — Phase 1 deletes\` — files matching the patterns in \`LOVABLE_PATTERNS\` in the script

**Categories to add manually (one pass over the Tier 2 annex before merging):**
- \`likely false positive — verify call sites\` for knip findings in any of these categories (spec §2.2):
  - Barrel/re-export files (e.g., \`src/components/ui/index.ts\` if present)
  - Dynamic-import targets (e.g., \`lazy(() => import('…'))\` in router config; check \`src/App.tsx\`)
  - React Router lazy route entries
  - Vite plugin transforms (\`?raw\`, \`?url\`, \`?worker\`, PWA-injected entry points)
  - HMR-only entry points (anything wired to \`@vite/client\` or \`vite-plugin-pwa\` lifecycle)
- \`duplicate of <name>\` — for the known FE duplicates per CLAUDE.md:
  - \`SafeChatWithScout copy.tsx\` → duplicate of \`SafeChatWithScout.tsx\`
  - \`MarketResearch_clean.tsx\` → duplicate of \`MarketResearch.tsx\`
  - \`ScoutChatWithHistory\` vs \`ProfilerChatWithHistory\` — flag both as "90% duplicate of each other"
  - \`LeadStream\` if duplicated under market-research/ — flag the duplicate
- \`~150 lines of commented code\` for \`src/components/ICPManager.tsx\` per CLAUDE.md
- \`Safe* wrapper — only SafeMarketIntelligenceTab imported in active paths\` for the Safe* triplet

After applying these augmentations, the scorecard is ready to merge.
`;

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, md);
  console.log(`Wrote ${totalFiles} files into ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
