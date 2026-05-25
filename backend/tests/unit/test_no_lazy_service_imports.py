"""Linter: no unannotated lazy `from app.services` imports inside services/.

A lazy import is an `ImportFrom` node nested inside a `FunctionDef` or
`AsyncFunctionDef` body whose module starts with `app.services`. Lazy
imports are allowed only when annotated with `# defensive: <reason>` on
the same line as the `from` keyword (the linter checks the lineno of the
ImportFrom node, which Python sets to the `from`-keyword line).

For multi-line imports, the annotation must therefore appear on the
`from` line, not on the closing-paren line. In practice this means
defensive imports should be single-line, importing one symbol at a time.

This test runs alongside the rest of the suite via `pytest -q` and adds
no new dependencies beyond stdlib `ast`.
"""
import ast
from pathlib import Path


SERVICES_DIR = Path(__file__).resolve().parents[2] / "app" / "services"


def _find_violations(source: str, src_lines: list[str]) -> list[tuple[int, str]]:
    """Return (lineno, source-line) for every unannotated lazy from-app-services import.

    Walks each ImportFrom once and checks its ancestor chain for a function-def
    parent. This avoids the duplicate-flagging issue that arises from a nested
    `ast.walk(FunctionDef)` loop when functions contain inner functions (the
    inner function's ImportFroms would otherwise be visited by both the outer
    walk and the inner walk).
    """
    tree = ast.parse(source)
    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent

    def _inside_function(node: ast.AST) -> bool:
        current: ast.AST = node
        while current in parents:
            current = parents[current]
            if isinstance(current, (ast.FunctionDef, ast.AsyncFunctionDef)):
                return True
        return False

    violations: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom):
            continue
        if not (node.module and node.module.startswith("app.services")):
            continue
        if not _inside_function(node):
            continue
        line = src_lines[node.lineno - 1]
        if "# defensive:" in line:
            continue
        violations.append((node.lineno, line.strip()))
    return violations


def test_no_unannotated_lazy_service_imports() -> None:
    """All lazy `from app.services` imports inside services/ must be annotated."""
    all_violations: dict[str, list[tuple[int, str]]] = {}
    for py_file in SERVICES_DIR.rglob("*.py"):
        source = py_file.read_text()
        violations = _find_violations(source, source.splitlines())
        if violations:
            rel = py_file.relative_to(SERVICES_DIR.parent.parent)
            all_violations[str(rel)] = violations

    assert not all_violations, (
        "Unannotated lazy 'from app.services' imports inside services/. "
        "Hoist to module top, or annotate with `# defensive: <reason>` "
        "on the same line as the `from` keyword.\n"
        + "\n".join(
            f"  {fp}:\n" + "\n".join(f"    L{ln}: {code}" for ln, code in vs)
            for fp, vs in all_violations.items()
        )
    )
