"""Byte-equality regression test for K2 (llm_config prompt dedup).

After K2 refactors llm_config.py to a base+overlay structure, the four
public string constants (Cypher_gen_prompt, Cypher_gen_prompt2,
qa_prompt_template, qa_prompt_template2) must still be byte-identical
to the pre-refactor values. This test asserts that contract by comparing
against the hardcoded baselines in tests/_baselines/llm_config_prompt_strings.py.
"""
from app.core.llm_config import (
    Cypher_gen_prompt,
    Cypher_gen_prompt2,
    qa_prompt_template,
    qa_prompt_template2,
)
from tests._baselines.llm_config_prompt_strings import (
    CYPHER_GEN_PROMPT_BASELINE,
    CYPHER_GEN_PROMPT2_BASELINE,
    QA_PROMPT_TEMPLATE_BASELINE,
    QA_PROMPT_TEMPLATE2_BASELINE,
)


def test_cypher_gen_prompt_matches_baseline():
    assert Cypher_gen_prompt == CYPHER_GEN_PROMPT_BASELINE


def test_cypher_gen_prompt2_matches_baseline():
    assert Cypher_gen_prompt2 == CYPHER_GEN_PROMPT2_BASELINE


def test_qa_prompt_template_matches_baseline():
    assert qa_prompt_template == QA_PROMPT_TEMPLATE_BASELINE


def test_qa_prompt_template2_matches_baseline():
    assert qa_prompt_template2 == QA_PROMPT_TEMPLATE2_BASELINE
