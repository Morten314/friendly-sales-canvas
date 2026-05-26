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

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


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
# Boot / render — implemented in Task 3 + Task 4
# ---------------------------------------------------------------------------


_registry: "Registry | None" = None


class Registry:
    """Populated by init_registry(). Implementation lands in Task 3."""
    pass


def init_registry(root: Path = _PROMPTS_ROOT) -> Registry:
    """Stub — full implementation in Task 3."""
    raise NotImplementedError("init_registry implementation lands in Task 3")


def render(name: str, **inputs: Any) -> RenderedPrompt:
    """Stub — full implementation in Task 4."""
    raise NotImplementedError("render implementation lands in Task 4")


def get_config(name: str) -> PromptConfig:
    """Stub — full implementation in Task 4."""
    raise NotImplementedError("get_config implementation lands in Task 4")


def list_prompts() -> list[dict[str, Any]]:
    """Stub — full implementation in Task 4."""
    raise NotImplementedError("list_prompts implementation lands in Task 4")


def as_langchain(name: str):
    """Stub — full implementation in Task 4."""
    raise NotImplementedError("as_langchain implementation lands in Task 4")
