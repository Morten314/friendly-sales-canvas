// frontend/scripts/check-bundle-budget.ts
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

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

export type LoadResult =
  | { ok: true; baseline: Baseline }
  | { ok: false; reason: string };

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

export async function loadBaseline(_path: string): Promise<LoadResult> {
  throw new Error("not implemented");
}

export function compareAndPrint(
  _baseline: Baseline,
  _current: ChunkEntry[],
): void {
  throw new Error("not implemented");
}
