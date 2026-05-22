"""Test fixture loaders.

- captured/ — LLM outputs frozen by `tests/capture_fixtures.py` (TD-001)
- seed/     — payloads the capture script feeds into the helpers
- *.py      — hand-crafted builders (existing, unchanged)
"""
import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent
CAPTURED_DIR = FIXTURES_DIR / "captured"
SEED_DIR = FIXTURES_DIR / "seed"


def load_captured(name: str) -> dict:
    """Load a captured LLM fixture by stem name.

    Example: load_captured("market_research_market_size_groq")
    """
    stem = name[:-5] if name.endswith(".json") else name
    return json.loads((CAPTURED_DIR / f"{stem}.json").read_text())


def load_seed(name: str) -> dict:
    """Load a seed payload by stem name.

    Example: load_seed("company_profile")
    """
    stem = name[:-5] if name.endswith(".json") else name
    return json.loads((SEED_DIR / f"{stem}.json").read_text())
