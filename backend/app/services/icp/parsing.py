"""Response parsing for icp/ — JSON extraction shared across ICP_generator
and icp_research_1..4 workers.

The functions in this module are pure helpers (no I/O, no LLM); they
consolidate the JSON-cleanup patterns that were duplicated across each
worker body in the monolithic icp.py.
"""
import json
import re
from typing import Iterable, List


def _extract_icp_json(
    response: str,
    escape_keys: Iterable[str] = ("description",),
    trim_braces: bool = False,
    strip_final_answer: bool = False,
) -> dict:
    """Strip markdown code fences and parse JSON from an LLM response.

    Steps applied in order:
      1. (Optional) Split on 'Final Answer:' marker and keep the tail.
      2. Strip ``` and ```json code fences.
      3. (Optional) Trim text before the first '{' and after the last '}'.
      4. For each key in `escape_keys`, replace literal newlines/CRs inside
         that key's string value with the escaped \\n / \\r sequences.
      5. `json.loads` the result.

    Defaults mirror the simplest pattern (ICP_generator, icp_research_1):
    just strip fences + escape 'description' newlines.

    Parameters
    ----------
    response:
        The raw LLM output (typically `raw_response["output"]`).
    escape_keys:
        Keys whose string values may contain literal newlines that must be
        JSON-escaped before parsing. ICP_generator/icp_research_1 use
        ('description',); icp_research_2/4 use ('description', 'blurb');
        icp_research_3 uses ('description', 'blurb', 'headline').
    trim_braces:
        If True, trim any text before the first '{' and after the last '}'.
        Used by icp_research_2/3/4 where the LLM sometimes wraps the JSON
        with stray prose.
    strip_final_answer:
        If True, when the response contains 'Final Answer:', keep only the
        text after the last occurrence. Used by icp_research_2/3/4.
    """
    if strip_final_answer and "Final Answer:" in response:
        response = response.split("Final Answer:")[-1].strip()

    cleaned_str = (
        response.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )

    if trim_braces:
        if "{" in cleaned_str:
            cleaned_str = cleaned_str[cleaned_str.index("{"):]
        if "}" in cleaned_str:
            cleaned_str = cleaned_str[:cleaned_str.rindex("}") + 1]

    for key in escape_keys:
        # Match `"<key>": "<value>"` with non-greedy value capture, DOTALL so
        # newlines in <value> are part of the match — we escape them inline.
        pattern = r'\"' + re.escape(key) + r'\": \"(.*?)\"'

        def _make_replacer(k):
            def _repl(m):
                inner = m.group(1).replace("\n", "\\n").replace("\r", "\\r")
                return '"' + k + '": "' + inner + '"'
            return _repl

        cleaned_str = re.sub(pattern, _make_replacer(key), cleaned_str, flags=re.DOTALL)

    return json.loads(cleaned_str)
