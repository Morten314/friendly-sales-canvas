import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join, relative, resolve, dirname } from "node:path";

import { gzipSize } from "gzip-size";

const FRONTEND_DIR = resolve(import.meta.dirname, "..");
const DIST_DIR = join(FRONTEND_DIR, "dist");
const OUTPUT_FILE = resolve(
  FRONTEND_DIR,
  "..",
  "docs",
  "audits",
  "2026-05-26-frontend-bundle-baseline.json",
);

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && /\.(js|css)$/.test(entry.name)) {
      // Spec §2.3 scopes the bundle baseline to .js and .css. Phase 2c can
      // extend if it wants full shipped-size accounting (html, svg, png).
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const files = await walk(DIST_DIR);
  const chunks = await Promise.all(
    files.map(async (full) => {
      const contents = await readFile(full);
      const sizeBytes = (await stat(full)).size;
      const gz = await gzipSize(contents);
      return {
        file: relative(DIST_DIR, full).split("\\").join("/"),
        size_bytes: sizeBytes,
        gzip_bytes: gz,
      };
    }),
  );
  chunks.sort((a, b) => b.size_bytes - a.size_bytes);

  const totals = chunks.reduce(
    (acc, c) => ({
      total_size_bytes: acc.total_size_bytes + c.size_bytes,
      total_size_gzip_bytes: acc.total_size_gzip_bytes + c.gzip_bytes,
    }),
    { total_size_bytes: 0, total_size_gzip_bytes: 0 },
  );

  const payload = {
    captured_at: new Date().toISOString(),
    build_command: "npm run build",
    ...totals,
    chunks,
  };

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${chunks.length} chunks to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
