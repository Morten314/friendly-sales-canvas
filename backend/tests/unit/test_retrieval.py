# backend/tests/unit/test_retrieval.py
"""Unit tests for app/services/_retrieval.format_supporting_documents."""
import json
from decimal import Decimal

from app.services._retrieval import format_supporting_documents


def test_format_supporting_documents_none_and_empty_return_none():
    assert format_supporting_documents(None) is None
    assert format_supporting_documents([]) is None


def test_format_supporting_documents_emits_content_and_other_metadata():
    rows = [
        {
            "query": "buyer pain points",
            "id": "doc-1",
            "score": 0.91,
            "content": "ACME revenue grew 30% in Q3.",
            "metadata": {"source": "acme.pdf", "page": 2},
        }
    ]
    out = format_supporting_documents(rows)
    assert out is not None
    parsed = json.loads(out)
    assert parsed[0]["content"] == "ACME revenue grew 30% in Q3."
    assert parsed[0]["id"] == "doc-1"
    assert parsed[0]["query"] == "buyer pain points"
    assert parsed[0]["metadata"]["source"] == "acme.pdf"
    assert parsed[0]["metadata"]["page"] == 2


def test_format_supporting_documents_dedupes_redundant_metadata_text():
    """metadata.text / metadata.page_content duplicate `content` — strip them,
    keep `content` and all other metadata, and do not mutate the input."""
    rows = [
        {
            "query": "q",
            "id": "d",
            "score": 0.5,
            "content": "Chunk text about pricing.",
            "metadata": {
                "source": "a.pdf",
                "text": "Chunk text about pricing.",
                "page_content": "Chunk text about pricing.",
                "page": 1,
            },
        }
    ]
    out = format_supporting_documents(rows)
    parsed = json.loads(out)
    # redundant keys stripped from metadata
    assert "text" not in parsed[0]["metadata"]
    assert "page_content" not in parsed[0]["metadata"]
    # content + other metadata survive
    assert parsed[0]["content"] == "Chunk text about pricing."
    assert parsed[0]["metadata"]["source"] == "a.pdf"
    assert parsed[0]["metadata"]["page"] == 1
    # the chunk text appears exactly once (no duplication)
    assert out.count("Chunk text about pricing.") == 1
    # input rows are NOT mutated
    assert rows[0]["metadata"]["text"] == "Chunk text about pricing."
    assert rows[0]["metadata"]["page_content"] == "Chunk text about pricing."


def test_format_supporting_documents_tolerates_non_json_native_score():
    """score may be a numpy float / Decimal depending on the Pinecone client —
    default=str must serialise it without raising."""
    rows = [{"query": "q", "id": "d", "score": Decimal("0.87"), "content": "x", "metadata": {}}]
    out = format_supporting_documents(rows)
    assert isinstance(out, str)
    assert "0.87" in out


def test_format_supporting_documents_tolerates_rows_missing_keys():
    """ask.py passes rows like {"content": ..., "score": ...} with no metadata/id/query."""
    rows = [{"content": "DATA_SOURCE_SENTINEL", "score": 0.8}]
    out = format_supporting_documents(rows)
    assert "DATA_SOURCE_SENTINEL" in out
