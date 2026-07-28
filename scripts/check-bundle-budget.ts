// frontend/scripts/check-bundle-budget.ts
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { gzipSize } from "gzip-size";

const FRONTEND_DIR = resolve(import.meta.dirname, "..");
const DIST_DIR = join(FRONTEND_DIR, "dist");
const DEFAULT_BASELINE_PATH = resolve(
  FRONTEND_DIR,
  "..",
  "docs",
  "audits",
  "2026-05-26-frontend-bundle-baseline.json",
);
const CHUNK_REPORT_THRESHOLD_BYTES = 10 * 1024;

export interface ChunkEntry {
  file: string;
  size_bytes: number;
  gzip_bytes: number;
}

export interface Baseline {
  captured_at: string;
  build_command?: string;
  total_size_bytes: number;
  total_size_gzip_bytes: number;
  chunks: ChunkEntry[];
}

export type LoadResult = { ok: true; baseline: Baseline } | { ok: false; reason: string };

// Assumption: every hyphenated filename in `dist/` is Vite-hashed (the current
// 5-file baseline satisfies this). A hand-named file like `my-component.js`
// would over-strip to `my-*.js`. Vite's `manualChunks` could break this in
// future; Phase 3+ revisits per spec 19 §6 Risk R1.
export function baseName(file: string): string {
  const name = basename(file);
  const ext = extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  if (!stem.includes("-")) return name;
  // Strip the trailing hash segment: -[A-Za-z0-9_-]+ at end of stem.
  // Vite's default hash is base64url-style (alphanumeric, _, -).
  const stripped = stem.replace(/-[A-Za-z0-9_-]+$/, "");
  if (stripped === stem) return name;
  return `${stripped}-*${ext}`;
}

export function formatBytes(bytes: number): string {
  const abs = Math.abs(bytes);
  if (abs >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (abs >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function computeDelta(
  baseline: number,
  current: number,
): { absolute: number; percent: number } {
  return {
    absolute: current - baseline,
    percent: baseline === 0 ? 0 : ((current - baseline) / baseline) * 100,
  };
}

export function formatDelta(deltaBytes: number, basePercent: number): string {
  const byteSign = deltaBytes >= 0 ? "+" : "";
  const pctSign = basePercent >= 0 ? "+" : "";
  return `${byteSign}${formatBytes(deltaBytes)} (${pctSign}${basePercent.toFixed(2)}%)`;
}

export async function walkDist(distPath: string): Promise<ChunkEntry[]> {
  if (!existsSync(distPath)) return [];
  const out: ChunkEntry[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && /\.(js|css)$/.test(entry.name)) {
        const contents = await readFile(full);
        const sizeBytes = (await stat(full)).size;
        const gz = await gzipSize(contents);
        out.push({
          file: relative(distPath, full).split("\\").join("/"),
          size_bytes: sizeBytes,
          gzip_bytes: gz,
        });
      }
    }
  };
  await walk(distPath);
  out.sort((a, b) => b.size_bytes - a.size_bytes);
  return out;
}

export async function loadBaseline(path: string): Promise<LoadResult> {
  if (!existsSync(path)) {
    return {
      ok: false,
      reason: `baseline not found at ${path}; run npm run bundle:rebaseline to create one`,
    };
  }
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (e) {
    return {
      ok: false,
      reason: `baseline at ${path} could not be read: ${(e as Error).message}`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      reason: `baseline JSON malformed at ${path}; expected shape from capture-bundle-baseline.ts`,
    };
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as Baseline).total_size_bytes !== "number" ||
    typeof (parsed as Baseline).total_size_gzip_bytes !== "number" ||
    !Array.isArray((parsed as Baseline).chunks)
  ) {
    return {
      ok: false,
      reason: `baseline JSON at ${path} missing expected fields (total_size_bytes, total_size_gzip_bytes, chunks)`,
    };
  }
  return { ok: true, baseline: parsed as Baseline };
}

export function compareAndPrint(baseline: Baseline, current: ChunkEntry[]): void {
  const currentTotalRaw = current.reduce((acc, c) => acc + c.size_bytes, 0);
  const currentTotalGzip = current.reduce((acc, c) => acc + c.gzip_bytes, 0);

  const rawDelta = computeDelta(baseline.total_size_bytes, currentTotalRaw);
  const gzipDelta = computeDelta(baseline.total_size_gzip_bytes, currentTotalGzip);

  console.log("");
  console.log("                  Baseline       Current        Delta");
  console.log(
    `Total (raw)       ${formatBytes(baseline.total_size_bytes).padEnd(14)} ${formatBytes(currentTotalRaw).padEnd(14)} ${formatDelta(rawDelta.absolute, rawDelta.percent)}`,
  );
  console.log(
    `Total (gzip)      ${formatBytes(baseline.total_size_gzip_bytes).padEnd(14)} ${formatBytes(currentTotalGzip).padEnd(14)} ${formatDelta(gzipDelta.absolute, gzipDelta.percent)}`,
  );

  // Bucket by hash-stripped base name. Bail to totals-only on collisions.
  const baselineByKey = new Map<string, ChunkEntry>();
  for (const chunk of baseline.chunks) {
    const key = baseName(chunk.file);
    if (baselineByKey.has(key)) {
      console.log("");
      console.log(
        "(per-chunk matching unavailable: duplicate base name in baseline; only totals shown)",
      );
      console.log("");
      console.log("(advisory — exit 0)");
      return;
    }
    baselineByKey.set(key, chunk);
  }
  const currentByKey = new Map<string, ChunkEntry>();
  for (const chunk of current) {
    const key = baseName(chunk.file);
    if (currentByKey.has(key)) {
      console.log("");
      console.log(
        "(per-chunk matching unavailable: duplicate base name in current; only totals shown)",
      );
      console.log("");
      console.log("(advisory — exit 0)");
      return;
    }
    currentByKey.set(key, chunk);
  }

  const largeMatched: Array<[string, ChunkEntry, ChunkEntry]> = [];
  for (const [key, baseChunk] of baselineByKey) {
    const cur = currentByKey.get(key);
    if (!cur) continue;
    if (
      baseChunk.size_bytes >= CHUNK_REPORT_THRESHOLD_BYTES ||
      cur.size_bytes >= CHUNK_REPORT_THRESHOLD_BYTES
    ) {
      largeMatched.push([key, baseChunk, cur]);
    }
  }

  if (largeMatched.length > 0) {
    console.log("");
    console.log("Chunks > 10KB:");
    for (const [key, baseChunk, cur] of largeMatched) {
      const delta = computeDelta(baseChunk.size_bytes, cur.size_bytes);
      console.log(
        `  ${key.padEnd(14)} ${formatBytes(baseChunk.size_bytes).padEnd(13)} ${formatBytes(cur.size_bytes).padEnd(14)} ${formatDelta(delta.absolute, delta.percent)}`,
      );
    }
  }

  const added = current.filter((c) => !baselineByKey.has(baseName(c.file)));
  const removed = baseline.chunks.filter((c) => !currentByKey.has(baseName(c.file)));
  if (added.length || removed.length) {
    console.log("");
    if (added.length) {
      console.log(`Added: ${added.map((c) => c.file).join(", ")}`);
    }
    if (removed.length) {
      console.log(`Removed: ${removed.map((c) => c.file).join(", ")}`);
    }
  }

  console.log("");
  console.log("(advisory — exit 0)");
}

async function main(): Promise<void> {
  const baselinePath = process.env.BUNDLE_BASELINE_PATH || DEFAULT_BASELINE_PATH;

  if (!existsSync(DIST_DIR)) {
    console.error("no dist/ found; run npm run build first");
    process.exit(1);
  }

  const loadResult = await loadBaseline(baselinePath);
  if (!loadResult.ok) {
    console.error(loadResult.reason);
    process.exit(1);
  }

  const current = await walkDist(DIST_DIR);
  const displayPath = relative(FRONTEND_DIR, baselinePath);
  console.log(`Bundle vs baseline (${displayPath})`);
  compareAndPrint(loadResult.baseline, current);
}

// Only execute the CLI when run directly (`tsx scripts/check-bundle-budget.ts`),
// not when imported. check-bundle-budget.test.ts imports this module for its pure
// helpers; importing used to run main() as a side effect, and main() calls
// process.exit(1) when dist/ is absent. During preflight, `npm run test` (vitest)
// runs before `npm run build`, so on a clean tree there is no dist/ yet at test
// time — the stray process.exit made `vitest run` exit 1 (caught as an unhandled
// rejection) even though every test passed, failing the gate spuriously.
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
