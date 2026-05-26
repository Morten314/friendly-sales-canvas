"""One-shot equivalence test — guards against any byte-drift introduced
when the legacy in-code prompts (_CYPHER_BASE etc.) were translated into
.md.j2 files. Compares LangChain-RENDERED output (variables substituted)
against the legacy baselines rendered with the same variables. Delete
this file after the next release cuts; the goal is to fail loudly during
migration review if the translation isn't byte-equal at render time.
"""
from pathlib import Path

from app.core.prompts import as_langchain, init_registry
from tests._baselines.llm_config_prompt_strings import (
    CYPHER_GEN_PROMPT_BASELINE,
    CYPHER_GEN_PROMPT2_BASELINE,
    QA_PROMPT_TEMPLATE_BASELINE,
    QA_PROMPT_TEMPLATE2_BASELINE,
)

# Distinctive sentinels so any placeholder-handling mismatch is obvious in diffs.
_SCHEMA = "__SCHEMA_SENTINEL__"
_QUESTION = "__QUESTION_SENTINEL__"
_CONTEXT = "__CONTEXT_SENTINEL__"


def setup_module(module):
    init_registry(root=Path(__file__).resolve().parent.parent.parent / "prompts")


def test_cypher_gen_byte_equal_to_baseline():
    new = as_langchain("cypher_gen").format(schema=_SCHEMA, question=_QUESTION)
    baseline = CYPHER_GEN_PROMPT_BASELINE.format(schema=_SCHEMA, question=_QUESTION)
    assert new == baseline


def test_cypher_gen_alt_byte_equal_to_baseline():
    new = as_langchain("cypher_gen_alt").format(schema=_SCHEMA, question=_QUESTION)
    baseline = CYPHER_GEN_PROMPT2_BASELINE.format(schema=_SCHEMA, question=_QUESTION)
    assert new == baseline


def test_qa_scout_byte_equal_to_baseline():
    new = as_langchain("qa_scout").format(context=_CONTEXT, question=_QUESTION)
    baseline = QA_PROMPT_TEMPLATE_BASELINE.format(context=_CONTEXT, question=_QUESTION)
    assert new == baseline


def test_qa_scout_alt_byte_equal_to_baseline():
    new = as_langchain("qa_scout_alt").format(context=_CONTEXT, question=_QUESTION)
    baseline = QA_PROMPT_TEMPLATE2_BASELINE.format(context=_CONTEXT, question=_QUESTION)
    assert new == baseline
