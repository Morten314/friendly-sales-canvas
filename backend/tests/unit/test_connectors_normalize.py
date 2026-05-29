"""Pure normalization: Apollo raw record -> canonical lead dict."""
import json

from app.services.connectors.normalize import (
    CANONICAL_FIELDS,
    normalize_apollo_record,
    normalize_domain,
    normalize_email,
)


def test_normalize_email_lowers_and_trims():
    assert normalize_email("  John.Doe@Example.COM ") == "john.doe@example.com"
    assert normalize_email("") is None
    assert normalize_email(None) is None


def test_normalize_domain_strips_scheme_path_www():
    assert normalize_domain("https://www.Example.com/about") == "example.com"
    assert normalize_domain("Example.com") == "example.com"
    assert normalize_domain("") is None
    assert normalize_domain(None) is None


def test_normalize_record_maps_core_fields():
    raw = {
        "id": "apollo-123",
        "first_name": "Jane",
        "last_name": "Roe",
        "title": "VP Sales",
        "seniority": "vp",
        "email": "Jane.Roe@ACME.com",
        "linkedin_url": "https://linkedin.com/in/janeroe",
        "city": "Berlin",
        "state": "BE",
        "country": "Germany",
        "organization": {"name": "Acme GmbH", "primary_domain": "acme.com"},
        "phone_numbers": [{"sanitized_number": "+49123"}],
    }
    rec = normalize_apollo_record(raw)
    assert rec["apollo_contact_id"] == "apollo-123"
    assert rec["first_name"] == "Jane"
    assert rec["last_name"] == "Roe"
    assert rec["name"] == "Jane Roe"
    assert rec["title"] == "VP Sales"
    assert rec["email"] == "Jane.Roe@ACME.com"          # raw value preserved
    assert rec["email_norm"] == "jane.roe@acme.com"      # derived dedup key
    assert rec["company_name"] == "Acme GmbH"
    assert rec["company_domain"] == "acme.com"
    assert rec["company_domain_norm"] == "acme.com"
    assert rec["phone"] == "+49123"
    assert rec["location"] == "Berlin, BE, Germany"
    # every canonical field is present (None when absent)
    for f in CANONICAL_FIELDS:
        assert f in rec
    # raw is preserved as a JSON STRING (Neo4j-storable)
    assert isinstance(rec["apollo_raw"], str)
    assert json.loads(rec["apollo_raw"])["id"] == "apollo-123"


def test_company_domain_falls_back_to_email_domain():
    raw = {"id": "x", "email": "sam@beta.io", "organization": {"name": "Beta"}}
    rec = normalize_apollo_record(raw)
    assert rec["company_domain_norm"] == "beta.io"


def test_missing_fields_are_none_not_keyerror():
    rec = normalize_apollo_record({"id": "y"})
    assert rec["apollo_contact_id"] == "y"
    assert rec["email"] is None
    assert rec["email_norm"] is None
    assert rec["company_domain_norm"] is None
    assert rec["name"] is None


def test_non_dict_input_is_tolerated():
    # A malformed Apollo row (None / list) must not crash the background task.
    rec = normalize_apollo_record(None)
    assert rec["apollo_contact_id"] is None
    assert rec["email"] is None
    assert normalize_apollo_record(["x"])["name"] is None
