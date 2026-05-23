from typing import Any, Dict

import pytest
from pydantic import ValidationError

from app.models import PaginatedResponse


def test_paginated_response_with_dict_items():
    resp = PaginatedResponse[Dict[str, Any]](
        items=[{"id": 1}, {"id": 2}],
        total=100,
        limit=50,
        offset=0,
    )
    assert resp.items[0]["id"] == 1
    assert resp.total == 100
    assert resp.limit == 50
    assert resp.offset == 0


def test_paginated_response_limit_above_cap_rejected():
    with pytest.raises(ValidationError):
        PaginatedResponse[Dict[str, Any]](
            items=[],
            total=0,
            limit=501,
            offset=0,
        )


def test_paginated_response_json_round_trip():
    original = PaginatedResponse[Dict[str, Any]](
        items=[{"x": 1}],
        total=1,
        limit=50,
        offset=0,
    )
    restored = PaginatedResponse[Dict[str, Any]].model_validate_json(
        original.model_dump_json()
    )
    assert restored == original
