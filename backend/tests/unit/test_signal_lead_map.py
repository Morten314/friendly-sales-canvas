"""Unit tests for SignalLeadMapRequest model and signals_lead_map prompt."""


def test_signal_lead_map_request_defaults_refresh_false():
    from app.models.signals import SignalLeadMapRequest
    req = SignalLeadMapRequest(user_id="u1", org_id="o1")
    assert req.refresh is False


def test_signals_lead_map_prompt_renders():
    # unit conftest autouse fixture has already called init_registry()
    from app.core import prompts
    rendered = prompts.render(
        "signals_lead_map",
        signals_json="[]",
        leads_json="[]",
        context_json="{}",
    )
    assert rendered.body
    body = rendered.body.lower()
    assert "relevance" in body
    assert "headline" in body
    # The payload carries only signal_id + headline (TD-FE-71): rules must not
    # instruct matching on fields that are never sent.
    assert "company mention in the signal" not in body


def test_compute_fingerprint_is_order_independent():
    from app.services.signals.lead_map import _compute_fingerprint
    assert _compute_fingerprint(["s1", "s2"], ["l1", "l2"]) == _compute_fingerprint(
        ["s2", "s1"], ["l2", "l1"]
    )


def test_compute_fingerprint_changes_with_set():
    from app.services.signals.lead_map import _compute_fingerprint
    assert _compute_fingerprint(["s1"], ["l1"]) != _compute_fingerprint(["s1", "s2"], ["l1"])


def test_signal_and_lead_id_extraction():
    from app.services.signals.lead_map import _signal_ids, _lead_ids
    assert _signal_ids([{"signal_id": "s1"}, {"id": "s2"}, {"headline": "x"}]) == ["s1", "s2"]
    assert _lead_ids([{"lead_id": "l1"}, {"company": "x"}]) == ["l1"]


def test_leads_for_prompt_resolves_csv_column_headings():
    """CSV-uploaded leads keep verbatim column headings as Lead-node keys
    (e.g. "Company Name", "Industry", "Country"). The matching prompt reasons
    over company/industry/region, so these must resolve regardless of the
    user's exact header casing/spacing. Regression: previously they stayed
    blank, so Claude received empty context and matched nothing → the
    "Find Matched Leads" feature returned no leads for CSV uploads.
    """
    import json
    from app.services.signals.lead_map import _leads_for_prompt
    leads = [{
        "lead_id": "l1",
        "Company Name": "Acme Corp",
        "Industry": "Manufacturing",
        "Country": "Germany",
    }]
    rows = json.loads(_leads_for_prompt(leads))
    assert rows[0]["company"] == "Acme Corp"
    assert rows[0]["industry"] == "Manufacturing"
    assert rows[0]["region"] == "Germany"


def test_leads_for_prompt_resolves_common_header_aliases():
    """Common alternate CSV headers (Organization / Sector / Location) resolve."""
    import json
    from app.services.signals.lead_map import _leads_for_prompt
    rows = json.loads(_leads_for_prompt([{
        "lead_id": "l1",
        "Organization": "Globex",
        "Sector": "Fintech",
        "Location": "Singapore",
    }]))
    assert rows[0]["company"] == "Globex"
    assert rows[0]["industry"] == "Fintech"
    assert rows[0]["region"] == "Singapore"


def test_leads_for_prompt_preserves_canonical_keys():
    """Apollo/manual leads already use canonical keys — behavior unchanged."""
    import json
    from app.services.signals.lead_map import _leads_for_prompt
    rows = json.loads(_leads_for_prompt([{
        "lead_id": "l1",
        "company_name": "Acme",
        "industry": "SaaS",
        "region": "NA",
    }]))
    assert rows[0] == {"lead_id": "l1", "company": "Acme", "industry": "SaaS", "region": "NA"}


def test_save_and_get_cached_lead_map_roundtrip():
    from unittest.mock import MagicMock
    from app.services.signals import lead_map
    store = {}
    coll = MagicMock()
    coll.find_one.side_effect = lambda flt: store.get(flt["_id"])
    coll.update_one.side_effect = lambda flt, upd, upsert=False: store.update(
        {flt["_id"]: {"_id": flt["_id"], **upd["$set"]}}
    )
    mongo = MagicMock()
    mongo.__getitem__.return_value.__getitem__.return_value = coll

    lead_map._save_lead_map(mongo, "o1", "u1", [{"signal_id": "s1", "leads": []}], "fp", "t0")
    doc = lead_map._get_cached_lead_map(mongo, "o1", "u1")
    assert doc["fingerprint"] == "fp"
    assert doc["mapping"] == [{"signal_id": "s1", "leads": []}]


# ---------------------------------------------------------------------------
# Task-10: build_signal_lead_map_claude orchestration tests
# ---------------------------------------------------------------------------
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.signals import SignalLeadMapRequest


def _fake_cache_mongo(initial=None):
    store = dict(initial or {})
    coll = MagicMock()
    coll.find_one.side_effect = lambda flt: store.get(flt["_id"])
    coll.update_one.side_effect = lambda flt, upd, upsert=False: store.update(
        {flt["_id"]: {"_id": flt["_id"], **upd["$set"]}}
    )
    mongo = MagicMock()
    mongo.__getitem__.return_value.__getitem__.return_value = coll
    return mongo, store


def _run(signals, leads, claude_return, *, mongo=None, refresh=False):
    from app.services.signals import lead_map
    mongo = mongo or _fake_cache_mongo()[0]
    driver = MagicMock()
    req = SignalLeadMapRequest(user_id="u1", org_id="o1", refresh=refresh)
    with patch("app.services.signals.persistence.fetch_signals",
               new=AsyncMock(return_value=(signals, len(signals)))), \
         patch("app.services.leads.persistence.get_leads_for_org",
               return_value=(leads, len(leads))), \
         patch("app.services.signals.persistence._get_signal_ask_customer_profile",
               return_value={"icps": []}), \
         patch("asyncio.sleep", new=AsyncMock()), \
         patch("app.services._llm_helpers._claude_messages_text") as claude:
        if isinstance(claude_return, Exception) or callable(claude_return) or isinstance(claude_return, list):
            # Exception -> every call raises; callable -> per-input response
            # (deterministic under concurrency); list -> per-call in order.
            claude.side_effect = claude_return
        else:
            claude.return_value = claude_return
        result = asyncio.run(lead_map.build_signal_lead_map_claude(driver, mongo, req))
        return result, claude


def test_build_map_empty_signals_short_circuits():
    result, claude = _run([], [{"lead_id": "l1"}], "")
    assert result["data"]["mapping"] == []
    claude.assert_not_called()


def test_build_map_empty_leads_short_circuits():
    result, claude = _run([{"signal_id": "s1"}], [], "")
    assert result["data"]["mapping"] == []
    claude.assert_not_called()


def test_build_map_cache_miss_computes_and_writes():
    signals = [{"signal_id": "s1", "headline": "Hiring surge"}]
    leads = [{"lead_id": "l1", "company_name": "Acme"}]
    claude_json = (
        '{"mapping":[{"signal_id":"s1","leads":'
        '[{"lead_id":"l1","company":"Acme","relevance":"high","why":"match"}]}]}'
    )
    mongo, store = _fake_cache_mongo()
    result, claude = _run(signals, leads, claude_json, mongo=mongo)
    entry = result["data"]["mapping"][0]
    assert result["data"]["cached"] is False
    assert entry["signal_id"] == "s1"
    assert entry["headline"] == "Hiring surge"          # echoed from fetched signals
    assert entry["leads"][0]["lead_id"] == "l1"
    assert entry["leads"][0]["relevance"] == "high"
    assert "o1:u1" in store                              # cache written
    claude.assert_called_once()


def test_build_map_cache_hit_skips_claude():
    from app.services.signals import lead_map
    signals = [{"signal_id": "s1", "headline": "h"}]
    leads = [{"lead_id": "l1"}]
    fp = lead_map._compute_fingerprint(["s1"], ["l1"])
    mongo, _ = _fake_cache_mongo({
        "o1:u1": {"_id": "o1:u1", "fingerprint": fp, "generated_at": "t0",
                  "mapping": [{"signal_id": "s1", "headline": "cached", "leads": []}]}
    })
    result, claude = _run(signals, leads, "SHOULD-NOT-RUN", mongo=mongo)
    assert result["data"]["cached"] is True
    assert result["data"]["mapping"][0]["headline"] == "cached"
    claude.assert_not_called()


def test_build_map_refresh_forces_recompute():
    from app.services.signals import lead_map
    signals = [{"signal_id": "s1", "headline": "h"}]
    leads = [{"lead_id": "l1"}]
    fp = lead_map._compute_fingerprint(["s1"], ["l1"])
    mongo, _ = _fake_cache_mongo({
        "o1:u1": {"_id": "o1:u1", "fingerprint": fp, "generated_at": "t0",
                  "mapping": [{"signal_id": "s1", "headline": "cached", "leads": []}]}
    })
    fresh = '{"mapping":[{"signal_id":"s1","leads":[]}]}'
    result, claude = _run(signals, leads, fresh, mongo=mongo, refresh=True)
    assert result["data"]["cached"] is False
    claude.assert_called_once()


def test_build_map_drops_invented_ids():
    signals = [{"signal_id": "s1"}]
    leads = [{"lead_id": "l1"}]
    claude_json = (
        '{"mapping":[{"signal_id":"sX","leads":[]},'
        '{"signal_id":"s1","leads":[{"lead_id":"lX","relevance":"high","why":"x"},'
        '{"lead_id":"l1","relevance":"low","why":"y"}]}]}'
    )
    result, _ = _run(signals, leads, claude_json)
    mapping = result["data"]["mapping"]
    assert [e["signal_id"] for e in mapping] == ["s1"]          # sX dropped
    assert [l["lead_id"] for l in mapping[0]["leads"]] == ["l1"]  # lX dropped


def test_build_map_tolerates_truncated_json():
    signals = [{"signal_id": "s1"}, {"signal_id": "s2"}]
    leads = [{"lead_id": "l1"}, {"lead_id": "l2"}]
    truncated = (
        '{"mapping":[{"signal_id":"s1","leads":'
        '[{"lead_id":"l1","company":"A","relevance":"high","why":"x"}]},'
        '{"signal_id":"s2","leads":[{"lead_id":"l2","compa'  # cut off mid-token
    )
    result, _ = _run(signals, leads, truncated)
    assert [e["signal_id"] for e in result["data"]["mapping"]] == ["s1"]  # valid prefix kept


def test_build_map_surfaces_error_status_on_claude_failure():
    # Total failure (single batch, Claude errors after retries) → status:"error"
    # so the FE shows its error state instead of masking it as an empty map.
    result, _ = _run([{"signal_id": "s1"}], [{"lead_id": "l1"}], RuntimeError("boom"))
    assert result["status"] == "error"
    assert result["data"]["mapping"] == []


# ---------------------------------------------------------------------------
# TD-014: chunk leads across bounded batches, run concurrently, merge
# ---------------------------------------------------------------------------

def test_build_map_batches_by_configured_size(monkeypatch):
    """N leads / batch_size → one Claude call per batch."""
    from app.services.signals import lead_map
    monkeypatch.setattr(lead_map, "_LEAD_BATCH_SIZE", 2)
    signals = [{"signal_id": "s1", "headline": "h"}]
    leads = [{"lead_id": f"l{i}"} for i in range(1, 6)]  # 5 leads / 2 -> 3 batches
    _, claude = _run(signals, leads, '{"mapping":[]}')
    assert claude.call_count == 3


def test_build_map_merges_leads_across_batches(monkeypatch):
    """Each lead is mapped in its own batch; the per-signal leads are unioned.
    The mock keys off the prompt body so responses match batches regardless of
    concurrent call order."""
    from app.services.signals import lead_map
    monkeypatch.setattr(lead_map, "_LEAD_BATCH_SIZE", 1)  # one lead per batch
    signals = [{"signal_id": "s1", "headline": "Hiring surge"}]
    leads = [{"lead_id": "l1", "company_name": "Acme"}, {"lead_id": "l2", "company_name": "Globex"}]

    def fake(body, _tokens):
        if "l1" in body:
            return '{"mapping":[{"signal_id":"s1","leads":[{"lead_id":"l1","company":"Acme","relevance":"high","why":"x"}]}]}'
        return '{"mapping":[{"signal_id":"s1","leads":[{"lead_id":"l2","company":"Globex","relevance":"low","why":"y"}]}]}'

    mongo, store = _fake_cache_mongo()
    result, claude = _run(signals, leads, fake, mongo=mongo)
    assert claude.call_count == 2
    ids = sorted(l["lead_id"] for l in result["data"]["mapping"][0]["leads"])
    assert ids == ["l1", "l2"]           # both batches merged into one signal entry
    assert "o1:u1" in store              # complete map → cached


def test_build_map_partial_batch_failure_keeps_good_leads_and_skips_cache(monkeypatch):
    """One batch fails after retries; the surviving batch's leads are still
    returned, and a partial map is NOT cached as if it were complete."""
    from app.services.signals import lead_map
    monkeypatch.setattr(lead_map, "_LEAD_BATCH_SIZE", 1)
    signals = [{"signal_id": "s1", "headline": "h"}]
    leads = [{"lead_id": "l1"}, {"lead_id": "l2"}]

    def fake(body, _tokens):
        if "l2" in body:
            raise RuntimeError("boom")
        return '{"mapping":[{"signal_id":"s1","leads":[{"lead_id":"l1","company":"A","relevance":"high","why":"x"}]}]}'

    mongo, store = _fake_cache_mongo()
    result, _ = _run(signals, leads, fake, mongo=mongo)
    ids = [l["lead_id"] for l in result["data"]["mapping"][0]["leads"]]
    assert ids == ["l1"]                 # good batch survived the sibling's failure
    assert "o1:u1" not in store          # partial result not cached


def test_build_map_all_batches_fail_surfaces_error_status(monkeypatch):
    from app.services.signals import lead_map
    monkeypatch.setattr(lead_map, "_LEAD_BATCH_SIZE", 1)
    result, _ = _run([{"signal_id": "s1"}], [{"lead_id": "l1"}, {"lead_id": "l2"}], RuntimeError("boom"))
    assert result["status"] == "error"      # every batch failed → surfaced, not masked
    assert result["data"]["mapping"] == []


def test_build_map_genuine_zero_matches_stays_success(monkeypatch):
    # All batches succeed but Claude found no matches → a TRUE empty, not a failure:
    # status stays "success" so the FE shows "No matched leads found", not an error.
    from app.services.signals import lead_map
    monkeypatch.setattr(lead_map, "_LEAD_BATCH_SIZE", 1)
    mongo, store = _fake_cache_mongo()
    result, _ = _run([{"signal_id": "s1"}], [{"lead_id": "l1"}, {"lead_id": "l2"}],
                     '{"mapping":[]}', mongo=mongo)
    assert result["status"] == "success"
    assert result["data"]["mapping"] == []
    assert "o1:u1" in store                  # a complete (if empty) map is still cached


# ---------------------------------------------------------------------------
# Task 1: enrich matched leads with name / title / seniority
# ---------------------------------------------------------------------------

def test_resolve_contact_name_single_and_composed():
    from app.services.signals.lead_map import _resolve_contact_name, _normalize_lead_keys
    assert _resolve_contact_name(_normalize_lead_keys({"name": "Sam Lee"})) == "Sam Lee"
    assert _resolve_contact_name(
        _normalize_lead_keys({"First_Name": "Jane", "Last_Name": "Doe"})
    ) == "Jane Doe"
    assert _resolve_contact_name(_normalize_lead_keys({"company_name": "Acme"})) == ""


def test_enrich_matched_leads_csv_and_apollo_and_missing():
    from app.services.signals.lead_map import _enrich_matched_leads
    leads_by_id = {
        "l1": {"lead_id": "l1", "First_Name": "Jane", "Last_Name": "Doe",
               "Job_Title": "VP Engineering", "Seniority_Level": "CXO"},
        "l2": {"lead_id": "l2", "name": "Sam Lee", "title": "Owner", "seniority": "Owner"},
        "l3": {"lead_id": "l3"},  # no prospect fields
    }
    mapping = [{"signal_id": "s1", "headline": "h", "leads": [
        {"lead_id": "l1", "company": "Acme", "relevance": "high", "why": "x"},
        {"lead_id": "l2", "company": "Globex", "relevance": "low", "why": "y"},
        {"lead_id": "l3", "company": "Z", "relevance": "low", "why": "z"},
    ]}]
    leads = _enrich_matched_leads(mapping, leads_by_id)[0]["leads"]
    assert (leads[0]["name"], leads[0]["title"], leads[0]["seniority"]) == ("Jane Doe", "VP Engineering", "CXO")
    assert (leads[1]["name"], leads[1]["title"], leads[1]["seniority"]) == ("Sam Lee", "Owner", "Owner")
    assert (leads[2]["name"], leads[2]["title"], leads[2]["seniority"]) == ("", "", "")
    # existing fields preserved
    assert leads[0]["company"] == "Acme" and leads[0]["relevance"] == "high" and leads[0]["why"] == "x"


def test_enrich_matched_leads_is_pure_does_not_mutate_input():
    from app.services.signals.lead_map import _enrich_matched_leads
    mapping = [{"signal_id": "s1", "headline": "h",
                "leads": [{"lead_id": "l1", "company": "Acme", "relevance": "high", "why": "x"}]}]
    leads_by_id = {"l1": {"lead_id": "l1", "name": "Sam Lee", "title": "CEO", "seniority": "CXO"}}
    original_lead_keys = set(mapping[0]["leads"][0].keys())
    _enrich_matched_leads(mapping, leads_by_id)
    assert set(mapping[0]["leads"][0].keys()) == original_lead_keys  # input not mutated


def test_build_map_enriches_on_cache_hit():
    from app.services.signals import lead_map
    signals = [{"signal_id": "s1", "headline": "h"}]
    leads = [{"lead_id": "l1", "First_Name": "Jane", "Last_Name": "Doe",
              "Job_Title": "VP Engineering", "Seniority_Level": "CXO"}]
    fp = lead_map._compute_fingerprint(["s1"], ["l1"])
    mongo, _ = _fake_cache_mongo({
        "o1:u1": {"_id": "o1:u1", "fingerprint": fp, "generated_at": "t0",
                  "mapping": [{"signal_id": "s1", "headline": "cached", "leads": [
                      {"lead_id": "l1", "company": "Acme", "relevance": "high", "why": "x"}]}]}
    })
    result, claude = _run(signals, leads, "SHOULD-NOT-RUN", mongo=mongo)
    assert result["data"]["cached"] is True
    lead = result["data"]["mapping"][0]["leads"][0]
    assert (lead["name"], lead["title"], lead["seniority"]) == ("Jane Doe", "VP Engineering", "CXO")
    claude.assert_not_called()


def test_build_map_enriches_on_cache_miss():
    from app.services.signals import lead_map
    signals = [{"signal_id": "s1", "headline": "Hiring surge"}]
    leads = [{"lead_id": "l1", "company_name": "Acme", "name": "Sam Lee",
              "title": "Founder", "seniority": "CXO"}]
    claude_json = (
        '{"mapping":[{"signal_id":"s1","leads":'
        '[{"lead_id":"l1","company":"Acme","relevance":"high","why":"match"}]}]}'
    )
    mongo, store = _fake_cache_mongo()
    result, claude = _run(signals, leads, claude_json, mongo=mongo)
    assert result["data"]["cached"] is False
    lead = result["data"]["mapping"][0]["leads"][0]
    assert (lead["name"], lead["title"], lead["seniority"]) == ("Sam Lee", "Founder", "CXO")
    # cache must store the NARROW shape (no name/title/seniority)
    cached_lead = store["o1:u1"]["mapping"][0]["leads"][0]
    assert "name" not in cached_lead
    assert "title" not in cached_lead
    assert "seniority" not in cached_lead
    assert "email" not in cached_lead
    assert "email_status" not in cached_lead
    assert "phone" not in cached_lead
    assert "linkedin_url" not in cached_lead
    claude.assert_called_once()


def test_enrich_matched_leads_projects_contact_fields():
    """email / email_status / phone / linkedin_url project from the joined full
    lead dict (Apollo canonical keys + CSV TitleCase_underscore aliases); missing
    -> ''; and email_status is blank for CSV-upload leads (no canonical key)."""
    from app.services.signals.lead_map import _enrich_matched_leads
    leads_by_id = {
        # Apollo canonical keys
        "l1": {"lead_id": "l1", "email": "a@x.com", "email_status": "verified",
               "phone": "+1-555", "linkedin_url": "https://li/a"},
        # CSV-upload TitleCase_underscore headers (no email_status equivalent)
        "l2": {"lead_id": "l2", "Email_Id": "b@y.com", "Contact_Number": "555-2",
               "LinkedIn_URL": "https://li/b"},
        # nothing on file
        "l3": {"lead_id": "l3"},
    }
    mapping = [{"signal_id": "s1", "headline": "h", "leads": [
        {"lead_id": "l1", "company": "Acme", "relevance": "high", "why": "x"},
        {"lead_id": "l2", "company": "Globex", "relevance": "low", "why": "y"},
        {"lead_id": "l3", "company": "Z", "relevance": "low", "why": "z"},
    ]}]
    out = _enrich_matched_leads(mapping, leads_by_id)[0]["leads"]
    assert (out[0]["email"], out[0]["email_status"], out[0]["phone"], out[0]["linkedin_url"]) == \
        ("a@x.com", "verified", "+1-555", "https://li/a")
    assert (out[1]["email"], out[1]["phone"], out[1]["linkedin_url"]) == \
        ("b@y.com", "555-2", "https://li/b")
    assert out[1]["email_status"] == ""        # CSV upload -> no canonical email_status
    assert (out[2]["email"], out[2]["email_status"], out[2]["phone"], out[2]["linkedin_url"]) == \
        ("", "", "", "")
    # existing prospect/identity fields still project unchanged
    assert out[0]["company"] == "Acme" and out[0]["relevance"] == "high"
