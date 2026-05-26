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


# ---------------------------------------------------------------------------
# Boot lifecycle tests — synthetic prompts via tmp_path
# ---------------------------------------------------------------------------

import textwrap
from pathlib import Path

from app.core.prompts import init_registry, render, get_config, list_prompts


def _write_defaults(root: Path) -> None:
    (root / "_shared").mkdir(parents=True, exist_ok=True)
    (root / "_shared" / "defaults.yaml").write_text(textwrap.dedent("""
        temperature: 0.0
        max_tokens: 4000
        timeout_s: 120
    """).lstrip())


def _write_prompt(root: Path, relpath: str, frontmatter: dict, body: str) -> None:
    import yaml
    file = root / relpath
    file.parent.mkdir(parents=True, exist_ok=True)
    fm = "---\n" + yaml.safe_dump(frontmatter, sort_keys=False) + "---\n"
    file.write_text(fm + body)


def test_boot_fails_when_prompts_root_missing(tmp_path):
    nonexistent = tmp_path / "does_not_exist"
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=nonexistent)
    assert "prompts root" in str(exc_info.value) or "not found" in str(exc_info.value)


def test_boot_fails_when_shared_dir_missing(tmp_path):
    (tmp_path / "icp").mkdir()
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert "_shared" in str(exc_info.value)


def test_boot_fails_when_defaults_yaml_missing(tmp_path):
    (tmp_path / "_shared").mkdir()
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert "defaults.yaml" in str(exc_info.value)


def test_boot_succeeds_with_only_shared_dir(tmp_path):
    _write_defaults(tmp_path)
    reg = init_registry(root=tmp_path)
    assert reg is not None
    # Module-level singleton populated.
    from app.core import prompts as prompts_mod
    assert prompts_mod._registry is reg
    # No callable prompts registered yet.
    assert list_prompts() == []


def test_boot_registers_single_valid_prompt(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/generator.md.j2",
        frontmatter={
            "name": "generator",
            "version": "1.0.0",
            "description": "Test prompt",
            "model": "test-model",
            "response_format": "json",
            "inputs": ["pre_data"],
        },
        body="Hello {{ pre_data }}\n",
    )
    init_registry(root=tmp_path)
    listed = list_prompts()
    assert len(listed) == 1
    assert listed[0]["name"] == "generator"
    assert listed[0]["version"] == "1.0.0"
    assert listed[0]["model"] == "test-model"
    assert listed[0]["response_format"] == "json"


def test_boot_aggregates_multiple_failures(tmp_path):
    _write_defaults(tmp_path)
    # Missing model
    _write_prompt(
        tmp_path, "icp/bad1.md.j2",
        frontmatter={
            "name": "bad1", "version": "1.0.0", "description": "x",
            "response_format": "json", "inputs": [],
        },
        body="x",
    )
    # Filename stem != name
    _write_prompt(
        tmp_path, "icp/bad2.md.j2",
        frontmatter={
            "name": "wrong_stem", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="x",
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    failures = exc_info.value.failures
    assert len(failures) == 2
    assert any("bad1" in f.file for f in failures)
    assert any("bad2" in f.file for f in failures)


def test_boot_rejects_name_collision(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/dup.md.j2",
        frontmatter={
            "name": "dup", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="x",
    )
    _write_prompt(
        tmp_path, "signals/dup.md.j2",
        frontmatter={
            "name": "dup", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="x",
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert any("dup" in f.error or "collision" in f.error.lower() for f in exc_info.value.failures)


def test_boot_rejects_undeclared_input_reference(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": ["a"],
        },
        body="{{ a }} {{ b }}",  # b is not declared
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert any("b" in f.error for f in exc_info.value.failures)


def test_boot_rejects_partial_in_shared_as_callable(tmp_path):
    _write_defaults(tmp_path)
    # Partial in _shared/ — must NOT be callable via render().
    (tmp_path / "_shared" / "x.md.j2").write_text(
        "---\nname: x\nversion: 1.0.0\ndescription: partial\n---\nhi\n"
    )
    init_registry(root=tmp_path)
    assert list_prompts() == []  # partial NOT registered as callable


def test_boot_rejects_filename_stem_mismatch(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/actual_filename.md.j2",
        frontmatter={
            "name": "different_name", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="x",
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert any("filename" in f.error.lower() or "stem" in f.error.lower() for f in exc_info.value.failures)


def test_boot_merges_defaults(tmp_path):
    _write_defaults(tmp_path)  # temperature=0.0, max_tokens=4000, timeout_s=120
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
            "temperature": 0.7,  # overrides default
        },
        body="hi",
    )
    init_registry(root=tmp_path)
    cfg = get_config("x")
    assert cfg.temperature == 0.7    # overridden
    assert cfg.max_tokens == 4000    # inherited
    assert cfg.timeout_s == 120      # inherited


def test_partial_include_resolves_at_boot(tmp_path):
    _write_defaults(tmp_path)
    (tmp_path / "_shared" / "footer.md.j2").write_text(
        "---\nname: footer\nversion: 1.0.0\ndescription: footer partial\n---\nFOOTER {{ x }}\n"
    )
    _write_prompt(
        tmp_path, "icp/main.md.j2",
        frontmatter={
            "name": "main", "version": "1.0.0", "description": "main",
            "model": "m", "response_format": "json", "inputs": ["x"],
        },
        body="MAIN {{ x }}\n{% include '_shared/footer.md.j2' %}\n",
    )
    init_registry(root=tmp_path)
    # Boot succeeds — the partial referenced {{ x }} and parent declared it.


def test_partial_include_rejected_when_parent_does_not_declare_partial_var(tmp_path):
    _write_defaults(tmp_path)
    (tmp_path / "_shared" / "footer.md.j2").write_text(
        "---\nname: footer\nversion: 1.0.0\ndescription: footer partial\n---\nFOOTER {{ x }}\n"
    )
    _write_prompt(
        tmp_path, "icp/main.md.j2",
        frontmatter={
            "name": "main", "version": "1.0.0", "description": "main",
            "model": "m", "response_format": "json", "inputs": [],   # no `x`
        },
        body="MAIN\n{% include '_shared/footer.md.j2' %}\n",
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert any("x" in f.error for f in exc_info.value.failures)


def test_include_depth_greater_than_one_rejected(tmp_path):
    _write_defaults(tmp_path)
    (tmp_path / "_shared" / "inner.md.j2").write_text(
        "---\nname: inner\nversion: 1.0.0\ndescription: inner partial\n---\nINNER\n"
    )
    (tmp_path / "_shared" / "outer.md.j2").write_text(
        "---\nname: outer\nversion: 1.0.0\ndescription: outer partial\n---\nOUTER\n{% include '_shared/inner.md.j2' %}\n"
    )
    _write_prompt(
        tmp_path, "icp/main.md.j2",
        frontmatter={
            "name": "main", "version": "1.0.0", "description": "main",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="{% include '_shared/outer.md.j2' %}\n",
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert any("depth" in f.error.lower() for f in exc_info.value.failures)


def test_content_hash_is_stable_across_calls(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="STATIC BODY\n",
    )
    init_registry(root=tmp_path)
    from app.core import prompts as prompts_mod
    h1 = prompts_mod._registry.get("x").content_hash
    init_registry(root=tmp_path)
    h2 = prompts_mod._registry.get("x").content_hash
    assert h1 == h2


def test_content_hash_changes_when_partial_body_edits(tmp_path):
    _write_defaults(tmp_path)
    (tmp_path / "_shared" / "p.md.j2").write_text(
        "---\nname: p\nversion: 1.0.0\ndescription: p\n---\nORIGINAL\n"
    )
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="HEAD\n{% include '_shared/p.md.j2' %}\nTAIL\n",
    )
    init_registry(root=tmp_path)
    from app.core import prompts as prompts_mod
    h_before = prompts_mod._registry.get("x").content_hash

    (tmp_path / "_shared" / "p.md.j2").write_text(
        "---\nname: p\nversion: 1.0.0\ndescription: p\n---\nEDITED\n"
    )
    init_registry(root=tmp_path)
    h_after = prompts_mod._registry.get("x").content_hash

    assert h_before != h_after
