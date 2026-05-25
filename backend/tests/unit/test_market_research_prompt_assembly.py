"""Behavior-preservation test for K3: collapse of Research_Market_1..5 into a dispatch.

Each fixture is the formatted prompt string that the pre-refactor
Research_Market_<N> function would have passed to the LLM. After K3
replaces those 5 functions with _run_research_component(component_n, ...),
the helper must produce a byte-identical formatted prompt for each
component name. This test asserts that contract.
"""
import json
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures" / "market_research_prompts"


@pytest.fixture(scope="module")
def sample_profile_json() -> str:
    return json.dumps(json.loads((FIXTURES_DIR / "sample_profile.json").read_text()), indent=2)


@pytest.mark.parametrize("component_n", [1, 2, 3, 4, 5])
def test_research_market_prompt_byte_equals_fixture(component_n: int, sample_profile_json: str):
    """K3: the dispatch's formatted prompt for component N must equal the captured fixture."""
    from app.services.market_research.orchestrator import _build_research_prompt
    expected = (FIXTURES_DIR / f"component_{component_n}.txt").read_text()
    actual = _build_research_prompt(component_n, sample_profile_json)
    assert actual == expected, (
        f"Component {component_n} prompt drift detected — fixture and dispatch output differ. "
        f"This indicates K3's refactor changed the LLM input."
    )
