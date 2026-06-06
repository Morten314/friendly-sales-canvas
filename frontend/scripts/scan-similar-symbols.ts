/**
 * Phase 13 §3.1 — near-duplicate exported component/hook scan.
 *
 * Uses ts-morph to walk src/**\/*.{ts,tsx}, identifies exported components and
 * hooks, computes a normalised structural fingerprint via 5-token shingles, and
 * groups any pair whose Jaccard similarity is ≥ SIMILARITY_THRESHOLD into
 * candidate groups via connected-components / transitive closure.
 *
 * Exclusions:
 *   - src/components/ui/**  (shadcn primitives — intentionally similar)
 *   - *.test.* / *.spec.*  test files
 *   - anything under __tests__/
 *   - source files with < MIN_LOC lines
 *
 * Output: JSON to STDOUT only — pipe-safe.
 *   { "groups": [{ "members": [{ file, symbol, loc }], "similarity": number, "kind": "component"|"hook" }] }
 *
 * Usage:
 *   npx tsx scripts/scan-similar-symbols.ts
 *   npx tsx scripts/scan-similar-symbols.ts > report.json
 */
import { basename, relative, resolve } from "node:path";

import { Project, SyntaxKind, type Node, type SourceFile } from "ts-morph";

// ─── tunables ────────────────────────────────────────────────────────────────
const SIMILARITY_THRESHOLD = 0.85;
const SHINGLE_SIZE = 5;
const MIN_LOC = 40;
// ─────────────────────────────────────────────────────────────────────────────

const FRONTEND_DIR = resolve(import.meta.dirname, "..");

// ─── types ───────────────────────────────────────────────────────────────────
type Kind = "component" | "hook";

interface Member {
  file: string;
  symbol: string;
  loc: number;
}

interface Group {
  members: Member[];
  similarity: number;
  kind: Kind;
}

interface Output {
  groups: Group[];
}

// ─── fingerprinting ──────────────────────────────────────────────────────────

/**
 * Walk a ts-morph node, emitting a token stream where identifiers are replaced
 * by "ID" and string/numeric/template literals by "LIT", but JSX tag names are
 * preserved as-is (so <Button> ≠ <Card>).
 */
function tokenStream(node: Node): string[] {
  const tokens: string[] = [];

  node.forEachDescendant((n) => {
    const kind = n.getKind();

    // JSX opening / closing / self-closing: emit the tag name as-is
    if (
      kind === SyntaxKind.JsxOpeningElement ||
      kind === SyntaxKind.JsxClosingElement ||
      kind === SyntaxKind.JsxSelfClosingElement
    ) {
      const tagName = (n as Node).getFirstChildByKind(SyntaxKind.Identifier);
      if (tagName) {
        tokens.push("JSX_" + tagName.getText());
      } else {
        // qualified name or member expression — emit the full text as tag
        tokens.push("JSX_" + (n.getFirstChild()?.getText() ?? "unknown"));
      }
      tokens.push(SyntaxKind[kind]);
      return;
    }

    // Leaf node — classify
    if (n.getChildCount() === 0) {
      if (kind === SyntaxKind.Identifier) {
        tokens.push("ID");
      } else if (
        kind === SyntaxKind.StringLiteral ||
        kind === SyntaxKind.NumericLiteral ||
        kind === SyntaxKind.NoSubstitutionTemplateLiteral ||
        kind === SyntaxKind.TemplateHead ||
        kind === SyntaxKind.TemplateMiddle ||
        kind === SyntaxKind.TemplateTail ||
        kind === SyntaxKind.BigIntLiteral
      ) {
        tokens.push("LIT");
      } else {
        tokens.push(SyntaxKind[kind]);
      }
    }
  });

  return tokens;
}

/** Build the multiset of k-shingles as a plain Set (standard Jaccard). */
function shingles(tokens: string[], k: number): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i <= tokens.length - k; i++) {
    result.add(tokens.slice(i, i + k).join("|"));
  }
  return result;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersect = 0;
  for (const s of a) {
    if (b.has(s)) intersect++;
  }
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

// ─── symbol extraction ───────────────────────────────────────────────────────

interface ExtractedSymbol {
  name: string;
  kind: Kind;
  loc: number;
  node: Node;
  file: string; // relative path
  startLine: number; // for dedup by source location
}

function isJsxReturning(node: Node): boolean {
  let found = false;
  node.forEachDescendant((n) => {
    if (
      n.getKind() === SyntaxKind.JsxElement ||
      n.getKind() === SyntaxKind.JsxSelfClosingElement ||
      n.getKind() === SyntaxKind.JsxFragment
    ) {
      found = true;
    }
  });
  return found;
}

/**
 * Derive an effective symbol name for a default-export node.
 * Tries node.getName() (FunctionDeclaration / ClassDeclaration).
 * Falls back to a PascalCase file basename.
 */
function effectiveNameForDefault(node: Node, relPath: string): string {
  const named = node as Node & { getName?: () => string | undefined };
  const nodeName = named.getName?.();
  if (nodeName) return nodeName;
  // Strip extension(s) from basename and PascalCase-ify as a best-effort label
  const base = basename(relPath)
    .replace(/\.[^.]+$/, "")
    .replace(/\.[^.]+$/, "");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function extractSymbols(sf: SourceFile, relPath: string): ExtractedSymbol[] {
  const syms: ExtractedSymbol[] = [];

  for (const decl of sf.getExportedDeclarations()) {
    const [exportKey, nodes] = decl as [string, Node[]];

    for (const node of nodes) {
      const start = node.getStartLineNumber();
      const end = node.getEndLineNumber();
      const loc = end - start + 1;

      // Resolve the effective name — default exports use the real function/class name or filename
      const name = exportKey === "default" ? effectiveNameForDefault(node, relPath) : exportKey;

      // Hook: exported function/const named use[A-Z]...
      if (/^use[A-Z]/.test(name)) {
        const kind = node.getKind();
        if (
          kind === SyntaxKind.FunctionDeclaration ||
          kind === SyntaxKind.ArrowFunction ||
          kind === SyntaxKind.FunctionExpression ||
          kind === SyntaxKind.VariableDeclaration
        ) {
          syms.push({ name, kind: "hook", loc, node, file: relPath, startLine: start });
        }
        continue;
      }

      // Component: PascalCase, in a .tsx file, body has JSX
      if (/^[A-Z]/.test(name) && relPath.endsWith(".tsx")) {
        const kind = node.getKind();
        if (
          kind === SyntaxKind.FunctionDeclaration ||
          kind === SyntaxKind.ArrowFunction ||
          kind === SyntaxKind.FunctionExpression ||
          kind === SyntaxKind.VariableDeclaration
        ) {
          if (isJsxReturning(node)) {
            syms.push({ name, kind: "component", loc, node, file: relPath, startLine: start });
          }
        }
      }
    }
  }

  return syms;
}

// ─── connected-components grouping ──────────────────────────────────────────

function buildGroups(symbols: ExtractedSymbol[], threshold: number, shingleSize: number): Group[] {
  // Pre-compute shingles for each symbol
  const shingleSets = symbols.map((s) => shingles(tokenStream(s.node), shingleSize));

  // Build adjacency list of similar pairs (same kind only)
  const adjacent: Map<number, Set<number>> = new Map();
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      if (symbols[i].kind !== symbols[j].kind) continue;
      if (shingleSets[i].size === 0 || shingleSets[j].size === 0) continue;
      const sim = jaccard(shingleSets[i], shingleSets[j]);
      if (sim >= threshold) {
        if (!adjacent.has(i)) adjacent.set(i, new Set());
        if (!adjacent.has(j)) adjacent.set(j, new Set());
        adjacent.get(i)!.add(j);
        adjacent.get(j)!.add(i);
      }
    }
  }

  // BFS connected components
  const visited = new Set<number>();
  const components: number[][] = [];

  for (const start of adjacent.keys()) {
    if (visited.has(start)) continue;
    const component: number[] = [];
    const queue: number[] = [start];
    visited.add(start);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      component.push(cur);
      for (const nb of adjacent.get(cur) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    components.push(component);
  }

  // Convert components to groups, computing min pairwise similarity
  const groups: Group[] = [];
  for (const comp of components) {
    if (comp.length < 2) continue;

    let minSim = 1;
    for (let i = 0; i < comp.length; i++) {
      for (let j = i + 1; j < comp.length; j++) {
        const sim = jaccard(shingleSets[comp[i]], shingleSets[comp[j]]);
        if (sim < minSim) minSim = sim;
      }
    }

    const members: Member[] = comp.map((idx) => ({
      file: symbols[idx].file,
      symbol: symbols[idx].name,
      loc: symbols[idx].loc,
    }));

    groups.push({
      members,
      similarity: minSim,
      kind: symbols[comp[0]].kind,
    });
  }

  return groups.sort((a, b) => b.members.length - a.members.length || b.similarity - a.similarity);
}

// ─── main ────────────────────────────────────────────────────────────────────

function shouldExclude(filePath: string): boolean {
  // Exclude src/components/ui/**
  if (/[/\\]src[/\\]components[/\\]ui[/\\]/.test(filePath)) return true;
  // Exclude test / spec files
  if (/\.(test|spec)\.[^.]+$/.test(filePath)) return true;
  // Exclude __tests__ directories
  if (/[/\\]__tests__[/\\]/.test(filePath)) return true;
  return false;
}

function main(): void {
  const project = new Project({
    tsConfigFilePath: resolve(FRONTEND_DIR, "tsconfig.app.json"),
    skipAddingFilesFromTsConfig: false,
  });

  const allSymbols: ExtractedSymbol[] = [];

  for (const sf of project.getSourceFiles()) {
    const absPath = sf.getFilePath();
    if (shouldExclude(absPath)) continue;

    const lines = sf.getEndLineNumber();
    if (lines < MIN_LOC) continue;

    const relPath = relative(FRONTEND_DIR, absPath);
    const syms = extractSymbols(sf, relPath);
    allSymbols.push(...syms);
  }

  // Fix 2b: dedup symbols by source location — a node exported under both
  // "default" and a named key would otherwise appear twice with identical
  // fingerprints and form a bogus self-group at similarity 1.0.
  const seen = new Set<string>();
  const dedupedSymbols = allSymbols.filter((s) => {
    const key = `${s.file}:${s.startLine}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const groups = buildGroups(dedupedSymbols, SIMILARITY_THRESHOLD, SHINGLE_SIZE);

  const output: Output = { groups };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
