"""Golden-fixture parity tests — one parametrized case per registered prompt.

If a prompt's rendered body differs from the on-disk fixture, the test fails
with a hint pointing at the regen script. Run:

    python tests/regen_prompt_fixtures.py <name>
    # or
    python tests/regen_prompt_fixtures.py --all

then commit the resulting fixture diff alongside the prompt edit.
"""
import json
from pathlib import Path

import pytest

from app.core.prompts import init_registry, render, list_prompts, as_langchain

REPO_ROOT = Path(__file__).resolve().parent.parent.parent  # backend/
PROMPTS_ROOT = REPO_ROOT / "prompts"
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "prompts"


# Initialize the production registry once at module import time so the
# @parametrize decorator below can read names at COLLECTION time. The
# autouse fixture re-initializes per test to guard against state bleed
# from other test modules (test_prompts_loader.py uses tmp_path roots).
#
# Wrap in try/except so a malformed prompt mid-migration produces a clean
# pytest skip rather than poisoning test discovery for the whole suite.
try:
    init_registry(root=PROMPTS_ROOT)
    _REGISTERED = [p["name"] for p in list_prompts()]
    _COLLECTION_ERROR: str | None = None
except Exception as e:
    _REGISTERED = []
    _COLLECTION_ERROR = f"Prompt registry boot failed during collection: {e!r}"
# LangChain-wrapped prompts (consumed by GraphCypherQAChain in llm_config.py).
# Hardcoded because the four prompts are known and stable. Update if the
# Phase 0 audit surfaces additional GraphCypherQAChain consumers.
_LANGCHAIN_PROMPT_NAMES = [name for name in _REGISTERED if name in {
    "cypher_gen", "cypher_gen_alt", "qa_scout", "qa_scout_alt",
}]


@pytest.fixture(autouse=True)
def _reinit_production_registry():
    """Re-point the module-level _registry at the production prompts root.

    test_prompts_loader.py runs init_registry(root=tmp_path) in its tests
    and doesn't restore. Without this fixture, golden tests that run after
    those would render against the wrong registry. Silent replacement is
    the documented v1 contract (spec §3.3 "Double-call behavior").

    Skip the re-init if collection already failed — the always-run test
    below surfaces that error with a clear message instead.
    """
    if _COLLECTION_ERROR is None:
        init_registry(root=PROMPTS_ROOT)
    yield


def test_prompt_registry_boots():
    """Always-present test (no parametrization). Surfaces collection-time
    boot failures with the loader's aggregated error message — otherwise a
    mid-migration malformed .md.j2 would produce zero parametrized cases
    that silently 'pass' rather than red-failing.
    """
    if _COLLECTION_ERROR is not None:
        pytest.fail(_COLLECTION_ERROR)


@pytest.mark.parametrize("name", _REGISTERED)
def test_golden_render(name):
    inputs_path = FIXTURE_DIR / "_inputs" / f"{name}.json"
    rendered_path = FIXTURE_DIR / "rendered" / f"{name}.txt"
    assert inputs_path.exists(), (
        f"Missing canonical inputs for prompt {name!r}. "
        f"Run: python tests/regen_prompt_fixtures.py {name}"
    )
    assert rendered_path.exists(), (
        f"Missing golden render for prompt {name!r}. "
        f"Run: python tests/regen_prompt_fixtures.py {name}"
    )
    inputs = json.loads(inputs_path.read_text(encoding="utf-8"))
    rp = render(name, **inputs)
    expected = rendered_path.read_text(encoding="utf-8")
    assert rp.body == expected, (
        f"Prompt {name!r} rendered body differs from golden fixture.\n"
        f"If intentional, regenerate with:\n"
        f"    python tests/regen_prompt_fixtures.py {name}"
    )


@pytest.mark.parametrize("name", _LANGCHAIN_PROMPT_NAMES)
def test_as_langchain_byte_equal_to_render(name):
    """LangChain parity — as_langchain(name).format(**inputs) must equal render(name, **inputs).body.

    Guards the source-expansion algorithm against LangChain Jinja2 env drift.
    """
    inputs_path = FIXTURE_DIR / "_inputs" / f"{name}.json"
    if not inputs_path.exists():
        pytest.skip(f"no canonical inputs for {name}")
    inputs = json.loads(inputs_path.read_text(encoding="utf-8"))
    rp = render(name, **inputs)
    lc = as_langchain(name).format(**inputs)
    assert rp.body == lc, f"LangChain parity drift for prompt {name!r}"
