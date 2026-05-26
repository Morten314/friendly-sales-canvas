"""Loader/registry/render unit tests.

Patch `app.core.prompts._registry` between test cases — `init_registry()`
sets the module-level singleton, and tests pointing at different tmp_path
roots must not bleed state. See spec §3.3 "Double-call behavior" — silent
replacement is the v1 contract; tests rely on it.
"""
import pytest

from app.core.prompts import (
    PromptConfig,
    RenderedPrompt,
    PromptError,
    PromptNotFound,
    MissingInputs,
    UnknownInputs,
    BootFailure,
    RenderError,
    UnknownModelError,
    FailureDetail,
    prompt_meta_from,
)


def test_promptconfig_is_frozen():
    cfg = PromptConfig(
        version="1.0.0",
        model="some-model",
        temperature=0.0,
        max_tokens=4000,
        response_format="json",
        timeout_s=120,
    )
    with pytest.raises((AttributeError, Exception)):
        cfg.model = "other"  # frozen dataclass


def test_rendered_prompt_carries_meta_fields():
    cfg = PromptConfig(
        version="1.0.0",
        model="m",
        temperature=0.0,
        max_tokens=10,
        response_format="json",
        timeout_s=60,
    )
    from datetime import datetime, timezone
    rp = RenderedPrompt(
        name="x",
        version="1.0.0",
        content_hash="hash",
        render_inputs_hash="ihash",
        body="body",
        rendered_at=datetime.now(timezone.utc),
        config=cfg,
    )
    assert rp.name == "x"
    assert rp.version == "1.0.0"
    assert rp.config is cfg


def test_all_error_types_subclass_prompterror():
    assert issubclass(PromptNotFound, PromptError)
    assert issubclass(MissingInputs, PromptError)
    assert issubclass(UnknownInputs, PromptError)
    assert issubclass(BootFailure, PromptError)
    assert issubclass(RenderError, PromptError)
    assert issubclass(UnknownModelError, PromptError)


def test_bootfailure_aggregates_failures():
    failures = [
        FailureDetail(file="a.md.j2", error="bad yaml"),
        FailureDetail(file="b.md.j2", error="missing model"),
    ]
    err = BootFailure(failures=failures)
    assert err.failures == failures
    assert "a.md.j2" in str(err)
    assert "b.md.j2" in str(err)


def test_prompt_meta_from_extracts_six_fields():  # noqa: plan-13 wrote `testprompt_…`; renamed to satisfy this repo's `python_functions = test_*`
    cfg = PromptConfig(
        version="1.2.3",
        model="qwen",
        temperature=0.0,
        max_tokens=10,
        response_format="json",
        timeout_s=30,
    )
    from datetime import datetime, timezone
    now = datetime(2026, 5, 25, 12, 0, 0, tzinfo=timezone.utc)
    rp = RenderedPrompt(
        name="x",
        version="1.2.3",
        content_hash="ch",
        render_inputs_hash="rih",
        body="body",
        rendered_at=now,
        config=cfg,
    )
    meta = prompt_meta_from(rp)
    assert meta == {
        "name": "x",
        "version": "1.2.3",
        "content_hash": "ch",
        "render_inputs_hash": "rih",
        "model": "qwen",
        "rendered_at": now,
    }
