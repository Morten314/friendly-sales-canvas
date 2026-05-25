"""Health/diagnostic probes — small smoke functions for /test-* endpoints."""
from typing import Dict


def probe_llm(llm2) -> Dict[str, str]:
    """LLM-availability smoke probe. Returns a small dict."""
    try:
        from langchain_core.messages import HumanMessage

        test_prompt = "Generate a simple JSON: {\"test\": \"hello\"}"
        messages = [HumanMessage(content=test_prompt)]
        response = llm2.invoke(messages)
        return {"status": "success", "response": str(response.content)}
    except Exception as e:
        return {"status": "error", "error": str(e)}
