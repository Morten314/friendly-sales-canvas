/**
 * Phase 1 §3 Step 6a — byte-identical inline-block scan.
 *
 * Walks src/**\/*.{ts,tsx}, identifies candidate blocks per the spec definition,
 * normalizes whitespace, hashes with SHA-256, groups occurrences, and emits
 * a JSON report to STDOUT as `JSON.stringify(out, null, 2)`.
 *
 * Usage:
 *   npx tsx scripts/scan-inline-blocks.ts                  # default mode
 *   npx tsx scripts/scan-inline-blocks.ts --enumerate      # enumerate mode
 *
 * Default mode: groups contain only self-contained blocks (no outer-scope refs).
 * Enumerate mode (--enumerate): also includes blocks that reference outer-scope
 *   identifiers; those groups gain an `outerScopeRefs` field listing the
 *   referenced identifiers so a reviewer can judge unifiability.
 *
 * Block definition (Spec 16 §3 Step 6a):
 *   - Contiguous sequence of ≥3 JavaScript statements
 *   - All at the same AST nesting level relative to the immediate function/component scope
 *   - Not interrupted by a control-flow boundary (if/for/while/switch/try/catch/finally)
 *     or a JSX return statement
 *   - Self-contained: no references to identifiers declared outside the block
 *     (relaxed in --enumerate mode)
 */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import * as ts from "typescript";

const FRONTEND_DIR = resolve(import.meta.dirname, "..");
const SRC_DIR = join(FRONTEND_DIR, "src");

const ENUMERATE = process.argv.includes("--enumerate");

const MIN_BLOCK_STATEMENTS = 3;
const MIN_GROUP_OCCURRENCES = 3;

interface Occurrence {
  file: string;
  line: number;
  end_line: number;
}

interface Group {
  hash: string;
  block: string;
  occurrences: Occurrence[];
  outerScopeRefs?: string[];
}

const groups = new Map<
  string,
  { block: string; raw: string; occurrences: Occurrence[]; outerScopeRefs?: string[] }
>();

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

function normalize(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function isControlFlow(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isTryStatement(node)
  );
}

function isReturnWithJsx(node: ts.Node): boolean {
  if (!ts.isReturnStatement(node)) return false;
  if (!node.expression) return false;
  let foundJsx = false;
  const visit = (n: ts.Node) => {
    if (foundJsx) return;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      foundJsx = true;
      return;
    }
    n.forEachChild(visit);
  };
  visit(node.expression);
  return foundJsx;
}

function collectDeclaredIdentifiers(node: ts.Node, declared: Set<string>): void {
  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      collectBindingNames(decl.name, declared);
    }
  } else if (ts.isFunctionDeclaration(node) && node.name) {
    declared.add(node.name.text);
  } else if (ts.isClassDeclaration(node) && node.name) {
    declared.add(node.name.text);
  }
}

function collectBindingNames(name: ts.BindingName, declared: Set<string>): void {
  if (ts.isIdentifier(name)) {
    declared.add(name.text);
  } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) {
        collectBindingNames(element.name, declared);
      }
    }
  }
}

function collectReferencedIdentifiers(statements: readonly ts.Statement[]): Set<string> {
  const refs = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n)) {
      const parent = n.parent;
      if (parent && ts.isPropertyAccessExpression(parent) && parent.name === n) return;
      if (parent && ts.isPropertyAssignment(parent) && parent.name === n) return;
      refs.add(n.text);
    } else {
      n.forEachChild(visit);
    }
  };
  for (const s of statements) visit(s);
  return refs;
}

function processBlock(file: string, src: string, statements: ts.Statement[]): void {
  if (statements.length < MIN_BLOCK_STATEMENTS) return;

  const declared = new Set<string>();
  for (const s of statements) collectDeclaredIdentifiers(s, declared);
  const referenced = collectReferencedIdentifiers(statements);

  const builtins = new Set([
    "undefined",
    "null",
    "true",
    "false",
    "NaN",
    "Infinity",
    "console",
    "window",
    "document",
    "globalThis",
    "self",
    "process",
    "navigator",
    "performance",
    "location",
    "history",
    "screen",
    "Object",
    "Array",
    "String",
    "Number",
    "Boolean",
    "Date",
    "Math",
    "JSON",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "Promise",
    "Symbol",
    "Error",
    "RegExp",
    "TypeError",
    "RangeError",
    "SyntaxError",
    "ReferenceError",
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "queueMicrotask",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "fetch",
    "localStorage",
    "sessionStorage",
    "caches",
    "indexedDB",
    "Request",
    "Response",
    "Headers",
    "URL",
    "URLSearchParams",
    "AbortController",
    "AbortSignal",
    "TextEncoder",
    "TextDecoder",
    "Blob",
    "File",
    "FormData",
    "FileReader",
    "WebSocket",
    "EventSource",
    "crypto",
    "structuredClone",
    "Event",
    "CustomEvent",
    "MessageEvent",
    "ErrorEvent",
    "HTMLElement",
    "Element",
    "Node",
    "Document",
    "Window",
    "MutationObserver",
    "IntersectionObserver",
    "ResizeObserver",
    "PerformanceObserver",
    "alert",
    "confirm",
    "prompt",
    "React",
  ]);

  // Collect identifiers that reference outer scope (neither declared in this block nor builtins)
  const outerRefs: string[] = [];
  for (const r of referenced) {
    if (declared.has(r)) continue;
    if (builtins.has(r)) continue;
    if (ENUMERATE) {
      outerRefs.push(r);
    } else {
      // Default mode: drop blocks with outer-scope references
      return;
    }
  }

  const start = statements[0].getStart(undefined, false);
  const end = statements[statements.length - 1].getEnd();
  const raw = src.slice(start, end);
  const normalized = normalize(raw);
  if (normalized.length < 20) return;
  const hash = createHash("sha256").update(normalized).digest("hex");

  const sourceFile = statements[0].getSourceFile();
  const lineStart = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
  const lineEnd = sourceFile.getLineAndCharacterOfPosition(end).line + 1;

  const existing = groups.get(hash);
  const occurrence: Occurrence = {
    file: relative(FRONTEND_DIR, file).split("\\").join("/"),
    line: lineStart,
    end_line: lineEnd,
  };
  if (existing) {
    existing.occurrences.push(occurrence);
  } else {
    const entry: {
      block: string;
      raw: string;
      occurrences: Occurrence[];
      outerScopeRefs?: string[];
    } = { block: normalized, raw, occurrences: [occurrence] };
    if (ENUMERATE) {
      entry.outerScopeRefs = outerRefs;
    }
    groups.set(hash, entry);
  }
}

function visitContainer(file: string, src: string, node: ts.Node): void {
  let bodyStatements: readonly ts.Statement[] | null = null;
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  ) {
    if (node.body && ts.isBlock(node.body)) {
      bodyStatements = node.body.statements;
    }
  } else if (ts.isArrowFunction(node)) {
    if (node.body && ts.isBlock(node.body)) {
      bodyStatements = node.body.statements;
    }
  }

  if (bodyStatements) {
    let run: ts.Statement[] = [];
    const flush = () => {
      if (run.length >= MIN_BLOCK_STATEMENTS) {
        processBlock(file, src, run);
      }
      run = [];
    };
    for (const stmt of bodyStatements) {
      if (isControlFlow(stmt) || isReturnWithJsx(stmt)) {
        flush();
        stmt.forEachChild((c) => visitContainer(file, src, c));
      } else {
        run.push(stmt);
      }
    }
    flush();
  }

  node.forEachChild((c) => visitContainer(file, src, c));
}

async function main() {
  const files = await walk(SRC_DIR);
  for (const file of files) {
    const src = await readFile(file, "utf-8");
    const sourceFile = ts.createSourceFile(
      file,
      src,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    visitContainer(file, src, sourceFile);
  }

  const out: { groups: Group[] } = { groups: [] };
  for (const [hash, g] of groups) {
    if (g.occurrences.length >= MIN_GROUP_OCCURRENCES) {
      const group: Group = { hash, block: g.block, occurrences: g.occurrences };
      if (ENUMERATE && g.outerScopeRefs !== undefined) {
        group.outerScopeRefs = g.outerScopeRefs;
      }
      out.groups.push(group);
    }
  }
  out.groups.sort((a, b) => b.occurrences.length - a.occurrences.length);

  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
