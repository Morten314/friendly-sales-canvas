"""Prompt management — loader/registry, render, observability.

Public API:
  - PromptConfig, RenderedPrompt, FailureDetail (dataclasses)
  - PromptError + subclasses (PromptNotFound, MissingInputs, UnknownInputs,
    BootFailure, RenderError, UnknownModelError)
  - init_registry(root=...) — populate the module-level _registry singleton
  - render(name, **inputs), get_config(name), list_prompts(), as_langchain(name)
  - prompt_meta_from(rendered) — shared observability sub-doc shape

Boot is invoked from app.main.lifespan; module-level wrappers raise if accessed
before init_registry().

See specs/13-prompt-management-design.md for the design contract.
"""
from __future__ import annotations

import hashlib
import json as _json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined, meta


# Module-relative default — resolves to backend/prompts/ regardless of CWD.
_PROMPTS_ROOT = Path(__file__).resolve().parent.parent.parent / "prompts"


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PromptConfig:
    version: str
    model: str
    temperature: float
    max_tokens: int
    response_format: str  # "json" | "text"
    timeout_s: int


@dataclass(frozen=True)
class RenderedPrompt:
    name: str
    version: str
    content_hash: str
    render_inputs_hash: str
    body: str
    rendered_at: datetime
    config: PromptConfig


@dataclass(frozen=True)
class FailureDetail:
    file: str
    error: str


# ---------------------------------------------------------------------------
# Error types
# ---------------------------------------------------------------------------


class PromptError(Exception):
    pass


class PromptNotFound(PromptError):
    def __init__(self, name: str):
        super().__init__(f"Prompt not found: {name}")
        self.name = name


class MissingInputs(PromptError):
    def __init__(self, name: str, missing: set[str]):
        super().__init__(f"Prompt {name!r} missing inputs: {sorted(missing)}")
        self.name = name
        self.missing = missing


class UnknownInputs(PromptError):
    def __init__(self, name: str, unknown: set[str]):
        super().__init__(f"Prompt {name!r} received unknown inputs: {sorted(unknown)}")
        self.name = name
        self.unknown = unknown


class BootFailure(PromptError):
    def __init__(self, failures: list[FailureDetail]):
        msg = "Prompt registry boot failed:\n" + "\n".join(
            f"  - {f.file}: {f.error}" for f in failures
        )
        super().__init__(msg)
        self.failures = failures


class RenderError(PromptError):
    def __init__(self, name: str, cause: Exception):
        super().__init__(f"Render error for prompt {name!r}: {cause}")
        self.name = name
        self.cause = cause


class UnknownModelError(PromptError):
    def __init__(self, model_name: str):
        super().__init__(f"Unknown model: {model_name!r} — register via _llm_helpers.register_llm()")
        self.model_name = model_name


# ---------------------------------------------------------------------------
# Observability helper (used by both call_with_prompt and manual call sites)
# ---------------------------------------------------------------------------


def prompt_meta_from(rendered: RenderedPrompt) -> dict[str, Any]:
    """Single source of truth for the prompt_meta sub-doc shape.

    Reads rendered_at from the RenderedPrompt (captured at render time inside
    render(), not at LLM-completion time — see spec §3.3 render lifecycle step 5).
    """
    return {
        "name": rendered.name,
        "version": rendered.version,
        "content_hash": rendered.content_hash,
        "render_inputs_hash": rendered.render_inputs_hash,
        "model": rendered.config.model,
        "rendered_at": rendered.rendered_at,
    }


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _RegistryEntry:
    config: PromptConfig
    description: str
    template_name: str        # path relative to root, e.g. "icp/generator.md.j2"
    declared_inputs: frozenset[str]
    content_hash: str
    body_source_expanded: str  # for as_langchain() — partials inlined; {% if %} preserved


class Registry:
    def __init__(self, entries: dict[str, _RegistryEntry], env: Environment, root: Path):
        self._entries = entries
        self._env = env
        self._root = root

    def get(self, name: str) -> _RegistryEntry:
        if name not in self._entries:
            raise PromptNotFound(name)
        return self._entries[name]

    def list(self) -> list[dict[str, Any]]:
        return [
            {
                "name": name,
                "version": entry.config.version,
                "description": entry.description,
                "model": entry.config.model,
                "response_format": entry.config.response_format,
            }
            for name, entry in sorted(self._entries.items())
        ]

    @property
    def env(self) -> Environment:
        return self._env

    @property
    def root(self) -> Path:
        return self._root


# ---------------------------------------------------------------------------
# Front-matter parsing
# ---------------------------------------------------------------------------

_FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n(.*)\Z", re.DOTALL)


def _strip_bom(text: str) -> str:
    return text[1:] if text.startswith("﻿") else text


def _parse_file(path: Path) -> tuple[dict, str]:
    """Return (front_matter_dict, body_text). Raises ValueError on malformed input."""
    try:
        raw = _strip_bom(path.read_text(encoding="utf-8"))
    except UnicodeDecodeError as e:
        raise ValueError(f"UTF-8 decode failed: {e}") from e
    m = _FRONTMATTER_RE.match(raw)
    if not m:
        raise ValueError("malformed front-matter (must be `---`-fenced YAML at file head)")
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:
        raise ValueError(f"YAML parse error: {e}") from e
    if not isinstance(fm, dict):
        raise ValueError("front-matter must be a YAML mapping")
    return fm, m.group(2)


# ---------------------------------------------------------------------------
# Front-matter validation
# ---------------------------------------------------------------------------

_REQUIRED_FIELDS_CALLABLE = {"name", "version", "description", "model", "response_format", "inputs"}
_REQUIRED_FIELDS_PARTIAL = {"name", "version", "description"}
_RESPONSE_FORMATS = {"json", "text"}
_SEMVER_RE = re.compile(r"\A\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.\-]+)?\Z")


def _validate_callable_frontmatter(fm: dict, defaults: dict, file_relpath: str, expected_stem: str) -> PromptConfig:
    merged = {**defaults, **fm}
    missing = _REQUIRED_FIELDS_CALLABLE - merged.keys()
    if missing:
        raise ValueError(f"missing required fields: {sorted(missing)}")
    if not _SEMVER_RE.match(str(merged["version"])):
        raise ValueError(f"version not semver: {merged['version']!r}")
    if merged["response_format"] not in _RESPONSE_FORMATS:
        raise ValueError(f"response_format must be 'json' or 'text', got {merged['response_format']!r}")
    if merged["name"] != expected_stem:
        raise ValueError(f"front-matter name {merged['name']!r} != filename stem {expected_stem!r}")
    if not isinstance(merged.get("inputs"), list):
        raise ValueError("inputs must be a list")
    return PromptConfig(
        version=str(merged["version"]),
        model=str(merged["model"]),
        temperature=float(merged["temperature"]),
        max_tokens=int(merged["max_tokens"]),
        response_format=str(merged["response_format"]),
        timeout_s=int(merged["timeout_s"]),
    )


# ---------------------------------------------------------------------------
# Source-expansion algorithm (shared by content_hash + as_langchain)
# ---------------------------------------------------------------------------

_INCLUDE_LINE_RE = re.compile(r"^[ \t]*\{%\s*include\s+['\"]([^'\"]+)['\"]\s*%\}[ \t]*\n?", re.MULTILINE)


def _expand_includes(body: str, root: Path, depth: int = 0, max_depth: int = 1) -> str:
    """Textually substitute every {% include 'PATH' %} line with the partial's body.

    Bounded by max_depth (default 1 per spec §3.4). Partial bodies are NOT
    Jinja2-rendered — `{% if %}` / `{{ var }}` markers pass through verbatim
    for the caller's Jinja2 env to evaluate.
    """
    if depth > max_depth:
        raise ValueError(f"include depth {depth} exceeds max ({max_depth})")

    def _sub(m):
        partial_path = root / m.group(1)
        if not partial_path.exists():
            raise ValueError(f"partial not found: {m.group(1)}")
        _, partial_body = _parse_file(partial_path)
        return _expand_includes(partial_body, root, depth=depth + 1, max_depth=max_depth)

    return _INCLUDE_LINE_RE.sub(_sub, body)


def _content_hash(expanded_body: str) -> str:
    return hashlib.sha256(expanded_body.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# init_registry()
# ---------------------------------------------------------------------------


_registry: "Registry | None" = None


def init_registry(root: Path = _PROMPTS_ROOT) -> Registry:
    """Walk root/, parse every .md.j2, validate, build env, populate registry.

    Raises BootFailure aggregating every per-file failure (not first-hit).
    Sets module-level _registry to the new Registry on success.
    Production code calls this exactly once via app.main.lifespan; tests may
    call it repeatedly with different roots — silent replacement is the v1
    contract (spec §3.3 "Double-call behavior").
    """
    global _registry
    failures: list[FailureDetail] = []

    # Step 0 — pre-flight
    if not root.is_dir():
        raise BootFailure([FailureDetail(file=str(root), error="prompts root not found")])
    if not (root / "_shared").is_dir():
        raise BootFailure([FailureDetail(file=str(root / "_shared"), error="_shared/ not found")])

    # Step 3 — defaults
    defaults_path = root / "_shared" / "defaults.yaml"
    if not defaults_path.is_file():
        raise BootFailure([FailureDetail(file="_shared/defaults.yaml", error="missing required file")])
    try:
        defaults = yaml.safe_load(defaults_path.read_text(encoding="utf-8")) or {}
        if not isinstance(defaults, dict):
            raise ValueError("defaults.yaml must be a YAML mapping")
    except (yaml.YAMLError, ValueError) as e:
        raise BootFailure([FailureDetail(file="_shared/defaults.yaml", error=f"{e}")])

    # Step 1 — walk
    all_files = sorted(root.rglob("*.md.j2"))

    # Step 6 — Jinja env
    # keep_trailing_newline=True: preserve author's final newline in rendered
    # output (default Jinja2 behavior strips it, surprising for prompt files).
    env = Environment(
        loader=FileSystemLoader(str(root)),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )

    entries: dict[str, _RegistryEntry] = {}
    seen_names: dict[str, str] = {}  # name -> file relpath (for collision messages)

    for path in all_files:
        relpath = str(path.relative_to(root))
        is_partial = relpath.startswith("_shared/") or relpath.startswith("_shared" + "/")

        try:
            fm, body = _parse_file(path)
        except ValueError as e:
            failures.append(FailureDetail(file=relpath, error=str(e)))
            continue

        if is_partial:
            # Validate minimal partial front-matter; never register as callable.
            for f in _REQUIRED_FIELDS_PARTIAL:
                if f not in fm:
                    failures.append(FailureDetail(file=relpath, error=f"partial missing required field: {f}"))
            continue

        expected_stem = path.stem.removesuffix(".md")  # ".md.j2" → stem is "*.md"
        try:
            config = _validate_callable_frontmatter(fm, defaults, relpath, expected_stem)
        except ValueError as e:
            failures.append(FailureDetail(file=relpath, error=str(e)))
            continue

        name = fm["name"]
        if name in seen_names:
            failures.append(FailureDetail(
                file=relpath,
                error=f"name collision: {name!r} already registered by {seen_names[name]}",
            ))
            continue

        # Step 7 — AST input validation against the source-expanded body
        try:
            expanded_body = _expand_includes(body, root)
        except ValueError as e:
            failures.append(FailureDetail(file=relpath, error=f"include resolution failed: {e}"))
            continue

        try:
            ast = env.parse(expanded_body)
        except Exception as e:
            failures.append(FailureDetail(file=relpath, error=f"Jinja2 parse failed: {e}"))
            continue

        referenced = set(meta.find_undeclared_variables(ast))
        declared = set(fm.get("inputs") or [])
        extra_refs = referenced - declared
        if extra_refs:
            failures.append(FailureDetail(
                file=relpath,
                error=f"undeclared inputs referenced in template: {sorted(extra_refs)}",
            ))
            continue

        # Step 8 — content hash over source-expanded body
        h = _content_hash(expanded_body)

        entries[name] = _RegistryEntry(
            config=config,
            description=str(fm["description"]),
            template_name=relpath,
            declared_inputs=frozenset(declared),
            content_hash=h,
            body_source_expanded=expanded_body,
        )
        seen_names[name] = relpath

    if failures:
        raise BootFailure(failures)

    registry = Registry(entries=entries, env=env, root=root)
    _registry = registry
    return registry


# ---------------------------------------------------------------------------
# Module-level wrappers — pure functions over the _registry singleton.
# All raise RuntimeError("init_registry not called") if accessed pre-boot.
# ---------------------------------------------------------------------------


def _require_registry() -> Registry:
    """Return the populated registry or raise RuntimeError.

    Internal helper — unifies the pre-boot None-check across every public
    wrapper. Called by render / get_config / list_prompts / as_langchain.
    """
    if _registry is None:
        raise RuntimeError("init_registry not called")
    return _registry


def render(name: str, **inputs: Any) -> RenderedPrompt:
    """Render a prompt against the registry's Jinja2 env.

    Pure computation (no I/O). Validates inputs against the boot-time declared
    set: extras raise UnknownInputs, missing raise MissingInputs. Template
    render failures are wrapped in RenderError. Records render_inputs_hash
    (sha256 of canonical JSON dump) and rendered_at (utc now) on the result —
    NOT at LLM completion (see spec §3.3 lifecycle step 5).
    """
    registry = _require_registry()
    entry = registry.get(name)

    provided = set(inputs.keys())
    declared = entry.declared_inputs
    unknown = provided - declared
    if unknown:
        raise UnknownInputs(name, unknown)
    missing = declared - provided
    if missing:
        raise MissingInputs(name, missing)

    # Render the source-expanded body (frontmatter stripped, partials inlined
    # at boot). Going through env.from_string keeps render output identical to
    # `as_langchain(name).format(...)` — both consume body_source_expanded.
    #
    # The _json.dumps hash phase is inside the try/except so a caller passing
    # an input whose __str__ raises (and that input is declared-but-unused, so
    # Jinja never touches it) still surfaces as RenderError — preserves the
    # PromptError-uniformity contract from spec §3.3.
    try:
        template = registry.env.from_string(entry.body_source_expanded)
        body = template.render(**inputs)
        canonical = _json.dumps(inputs, sort_keys=True, default=str)
    except Exception as e:
        raise RenderError(name, e) from e

    render_inputs_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    return RenderedPrompt(
        name=name,
        version=entry.config.version,
        content_hash=entry.content_hash,
        render_inputs_hash=render_inputs_hash,
        body=body,
        rendered_at=datetime.now(timezone.utc),
        config=entry.config,
    )


def get_config(name: str) -> PromptConfig:
    return _require_registry().get(name).config


def list_prompts() -> list[dict[str, Any]]:
    return _require_registry().list()


def as_langchain(name: str):
    """Return a LangChain PromptTemplate over the source-expanded body.

    LangChain consumers (CYPHER_GENERATION_PROMPT, CYPHER_QA_PROMPT) accept a
    PromptTemplate; this adapter hands them the boot-time partial-expanded
    body so the chain's runtime substitution sees the full text. The body
    retains `{% if %}` / `{{ var }}` markers — LangChain's Jinja2 env evaluates
    them at chain invocation. Boot-time AST validation already proved every
    `{{ var }}` reference is in the parent's declared inputs.

    Newline note: LangChain instantiates its own Jinja2 env (no override hook)
    with default `keep_trailing_newline=False`, which strips exactly one
    trailing newline. Our render() uses `keep_trailing_newline=True` to
    preserve the author's final newline. To keep the two renderers byte-equal
    we append a sentinel "\\n" here that LangChain will strip back off.
    """
    from langchain_core.prompts import PromptTemplate
    entry = _require_registry().get(name)
    return PromptTemplate.from_template(
        entry.body_source_expanded + "\n",
        template_format="jinja2",
    )
