"""Unit tests for the env-driven config contract (spec 42).

Importing app.core.config requires every _require()d var to be set; the unit
conftest sets dummy values for all of them, so the import here succeeds and we
can exercise the helper and the parsed CORS list directly.
"""
import pytest


def test_require_raises_on_missing_var(monkeypatch):
    from app.core.config import _require

    monkeypatch.delenv("BREWRA_NONEXISTENT_VAR", raising=False)
    with pytest.raises(RuntimeError, match="BREWRA_NONEXISTENT_VAR"):
        _require("BREWRA_NONEXISTENT_VAR")


def test_require_raises_on_empty_var(monkeypatch):
    from app.core.config import _require

    monkeypatch.setenv("BREWRA_EMPTY_VAR", "")
    with pytest.raises(RuntimeError, match="BREWRA_EMPTY_VAR"):
        _require("BREWRA_EMPTY_VAR")


def test_require_returns_value(monkeypatch):
    from app.core.config import _require

    monkeypatch.setenv("BREWRA_PRESENT_VAR", "hello")
    assert _require("BREWRA_PRESENT_VAR") == "hello"


def test_cors_origins_parsed_from_env():
    # conftest sets CORS_ALLOWED_ORIGINS="http://localhost:3000,https://test.example"
    from app.core import config

    assert "http://localhost:3000" in config.origins
    assert "https://test.example" in config.origins
    assert "" not in config.origins
