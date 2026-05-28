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

export function baseName(_file: string): string {
  throw new Error("not implemented");
}

export function formatBytes(_bytes: number): string {
  throw new Error("not implemented");
}

export function computeDelta(
  _baseline: number,
  _current: number,
): { absolute: number; percent: number } {
  throw new Error("not implemented");
}

export function formatDelta(_deltaBytes: number, _basePercent: number): string {
  throw new Error("not implemented");
}

export async function walkDist(_distPath: string): Promise<ChunkEntry[]> {
  throw new Error("not implemented");
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
