"""Hand-crafted signal fixtures."""
from tests.identities import (
    TEST_SIGNAL_ID_1, TEST_SIGNAL_ID_2,
    TEST_USER_ID, TEST_ORG_ID, TEST_TIMESTAMP,
)


def signal(**overrides) -> dict:
    """Signal feed item — shape matches what Signals.tsx renders."""
    base = {
        "signal_id": TEST_SIGNAL_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "agent": "scout",
        "headline": "Acme Corp announces $50M Series B funding",
        "snippet": "Acme Corp closed a $50M Series B led by Sequoia Capital.",
        "source_url": "https://example.test/news/acme-funding",
        "next_best_actions": [
            {"label": "Reach out to CEO", "type": "email"},
            {"label": "Send congrats on LinkedIn", "type": "linkedin"},
        ],
        "status": "new",
        "created_at": TEST_TIMESTAMP,
    }
    return {**base, **overrides}


def signal_list(n: int = 5) -> list[dict]:
    return [
        signal(
            signal_id=f"sig_{i:08d}",
            headline=f"Test signal {i}",
            agent="scout" if i % 2 == 0 else "profiler",
        )
        for i in range(n)
    ]


def signal_action_payload(action: str = "accept", **overrides) -> dict:
    """Payload for POST /api/signal_action."""
    base = {
        "signal_id": TEST_SIGNAL_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "action": action,
    }
    return {**base, **overrides}


def signal_ask_payload(**overrides) -> dict:
    """Payload for POST /api/signal_Ask."""
    base = {
        "signal_id": TEST_SIGNAL_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "question": "What's the best follow-up action here?",
        "conversation_history": [],
    }
    return {**base, **overrides}


def signal_ask_response() -> dict:
    """Canned LLM response shape for signal_Ask. Minimal sketch — TD-001."""
    return {
        "answer": "Based on the funding announcement, recommend reaching out to the CEO within 48 hours.",
        "sources": [{"url": "https://example.test/news/acme-funding"}],
        "conversation_id": "conv_test_001",
    }


def generate_signals_batch_response() -> dict:
    """Canned response for POST /api/generate-signals-batch. Minimal sketch — TD-001."""
    return {
        "status": "completed",
        "scout_signals_generated": 3,
        "profiler_signals_generated": 3,
        "total": 6,
    }
