from tests.helpers import scrub_dynamic, DEFAULT_SCRUB_KEYS


def test_scrub_dynamic_replaces_default_keys():
    payload = {"lead_id": "abc-123", "name": "Acme", "created_at": "2026-05-08"}
    result = scrub_dynamic(payload)
    assert result == {"lead_id": "<scrubbed>", "name": "Acme", "created_at": "<scrubbed>"}


def test_scrub_dynamic_recurses_into_nested_dicts():
    payload = {"data": {"signal_id": "s-1", "title": "T"}}
    result = scrub_dynamic(payload)
    assert result["data"]["signal_id"] == "<scrubbed>"
    assert result["data"]["title"] == "T"


def test_scrub_dynamic_recurses_into_lists():
    payload = {"leads": [{"lead_id": "1"}, {"lead_id": "2"}]}
    result = scrub_dynamic(payload)
    assert result["leads"][0]["lead_id"] == "<scrubbed>"
    assert result["leads"][1]["lead_id"] == "<scrubbed>"


def test_scrub_dynamic_does_not_mutate_input():
    original = {"lead_id": "xyz", "name": "A"}
    scrub_dynamic(original)
    assert original == {"lead_id": "xyz", "name": "A"}


def test_scrub_dynamic_accepts_custom_keys():
    payload = {"foo": "bar", "name": "Acme"}
    result = scrub_dynamic(payload, keys={"foo"})
    assert result == {"foo": "<scrubbed>", "name": "Acme"}
