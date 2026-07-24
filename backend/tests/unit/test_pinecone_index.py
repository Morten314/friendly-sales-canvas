"""Guard test: the Pinecone index name must come from config, never a literal.

Spec 42 §4.2 replaces every hardcoded "brewra-documents" in the app package
with config.pinecone_index so staging and prod can target different indexes via
env. This test fails if anyone reintroduces the literal under app/.
"""
from pathlib import Path

_APP_DIR = Path(__file__).resolve().parents[2] / "app"


def test_no_hardcoded_pinecone_index_in_app():
    offenders = [
        str(p)
        for p in _APP_DIR.rglob("*.py")
        if "brewra-documents" in p.read_text(encoding="utf-8")
    ]
    assert not offenders, f"Hardcoded Pinecone index name found in: {offenders}"
