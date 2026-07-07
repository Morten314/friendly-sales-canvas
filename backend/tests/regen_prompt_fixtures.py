"""Regenerate golden-rendered prompt fixtures.

Usage:
    python tests/regen_prompt_fixtures.py [name | --all]

Reads canonical inputs from tests/fixtures/prompts/_inputs/<name>.json,
calls prompts.render(name, **inputs), writes the rendered body to
tests/fixtures/prompts/rendered/<name>.txt.

If a prompt has no _inputs/<name>.json, scaffolds one with placeholders
(REPLACE_ME values) for the declared inputs — author edits before running again.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROMPTS_ROOT = REPO_ROOT / "prompts"
INPUTS_DIR = REPO_ROOT / "tests" / "fixtures" / "prompts" / "_inputs"
RENDERED_DIR = REPO_ROOT / "tests" / "fixtures" / "prompts" / "rendered"


def _ensure_input_skeleton(name: str, declared_inputs: list[str]) -> None:
    p = INPUTS_DIR / f"{name}.json"
    if p.exists():
        return
    skeleton = {key: "REPLACE_ME" for key in declared_inputs}
    p.write_text(json.dumps(skeleton, indent=2) + "\n", encoding="utf-8")
    print(f"[regen] scaffolded {p} — fill in REPLACE_ME values before next run", file=sys.stderr)


def _regen_one(name: str) -> bool:
    """Returns True if regenerated; False if skipped (skeleton just created or REPLACE_ME present)."""
    from app.core.prompts import render, get_config, _require_registry  # noqa
    registry = _require_registry()
    entry = registry.get(name)
    _ensure_input_skeleton(name, sorted(entry.declared_inputs))

    inputs_path = INPUTS_DIR / f"{name}.json"
    inputs = json.loads(inputs_path.read_text(encoding="utf-8"))
    if any(v == "REPLACE_ME" for v in inputs.values()):
        print(f"[regen] {name}: skipped (REPLACE_ME values in {inputs_path})", file=sys.stderr)
        return False

    rp = render(name, **inputs)
    out_path = RENDERED_DIR / f"{name}.txt"
    out_path.write_text(rp.body, encoding="utf-8")
    print(f"[regen] wrote {out_path}", file=sys.stderr)
    return True


def main(argv: list[str]) -> int:
    sys.path.insert(0, str(REPO_ROOT))
    from app.core.prompts import init_registry, list_prompts
    init_registry(root=PROMPTS_ROOT)

    if not argv or argv[0] in {"--all", "-a"}:
        names = [p["name"] for p in list_prompts()]
    else:
        names = argv

    if not names:
        print("[regen] no callable prompts registered yet — nothing to do", file=sys.stderr)
        return 0

    regenerated = 0
    for name in names:
        if _regen_one(name):
            regenerated += 1
    print(f"[regen] {regenerated}/{len(names)} fixtures regenerated", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
