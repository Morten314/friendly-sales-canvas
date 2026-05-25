---
synthesizes_review: docs/reviews/13-prompt-management-design-spec-review-4.md
artifact: specs/13-prompt-management-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-25
round: 4
---

## Round Recommendation

no

Reason: The single High finding is a textual docstring contradiction (one sentence to rewrite). The three Mediums are a small refactor (`rendered_at` capture point), a one-line defaults.yaml safety fix, and adding a test description to the §3.6 scaffold. The three Lows and one Nit are tightening clarifications. No remaining Critical/High after revision, no new design surface opened.

## Agreed Findings

- **[High] F1 — `as_langchain()` docstring contradicts §3.4 on include resolution.** Verified at spec line 202: docstring says "Includes are not resolved — the prompt must be self-contained" but §3.4 lines 358-365 say "Includes ARE allowed in LangChain-consumed prompts" with source expansion at `as_langchain()` call time. Replacing the docstring's final line with: "Source-expanded at call time (see §3.4); shared partials are resolved and the returned `PromptTemplate` is fully self-contained." Also clarifying `<unrendered template body>` to `<source-expanded but not Jinja2-rendered template body>` so the body argument's pre-state is unambiguous.

- **[Medium] F2 — `rendered_at` captured at `_prompt_meta_from()` call time, not render time.** Verified at spec line 506: `datetime.now(timezone.utc)` is inside `_prompt_meta_from()`, which is called after `llm.invoke()` returns (up to 120s post-render for agent-chain). Resolution: capture the timestamp inside `render()` and store it on `RenderedPrompt`; `_prompt_meta_from()` reads it from `rendered.rendered_at`. Specifically:
  - Add `rendered_at: datetime` field to the `RenderedPrompt` dataclass (§3.3 "Public surface").
  - §3.3 render lifecycle gains a step: timestamp is captured immediately after the Jinja2 render succeeds, before returning the `RenderedPrompt`.
  - `_prompt_meta_from()` reads `rendered.rendered_at` instead of calling `datetime.now()`.
  - §3.5 "Note on `rendered_at`" remains accurate (the timestamp now matches its stated semantics — actual render time, ≤2 minutes ahead of LLM completion on agent-chain).

- **[Medium] F3 — `model` in `defaults.yaml` creates silent migration risk.** Verified: line 146 sets `model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput` as a default. A Groq-based prompt that forgets to declare `model` in its front-matter would silently inherit Qwen and switch model. Resolution: **option (a)** — remove `model` from `defaults.yaml`. Boot validation then fails loudly when any prompt omits `model`. Updates:
  - §3.2 defaults.yaml example loses the `model:` line; left with `temperature`, `max_tokens`, `timeout_s` only.
  - §3.2 front-matter table `model` row description tightened: "Required for all callable prompts; no `_shared/defaults.yaml` default. Must be explicitly declared per prompt — a wrong-by-default model would silently change LLM behavior at migration time."
  - The convenience of defaulting `model` is not worth the migration safety cost; the other three defaults (`temperature`, `max_tokens`, `timeout_s`) are universally safe and stay.

- **[Medium] F4 — `as_langchain()` parity test missing from §3.6 scaffold.** Verified: §3.4 line 361 promises golden-fixture parity tests, but §3.6's three layers describe loader, golden, and behavior tests without mentioning `as_langchain()`. Adding to §3.6 Layer 1: "For each LangChain-wrapped prompt (Cypher gen, Cypher gen alt, QA scout, QA scout alt), a parity test asserts that `as_langchain(name).format(**inputs)` produces byte-equal output to `render(name, **inputs).body`, using the canonical fixture inputs from `tests/fixtures/prompts/_inputs/<name>.json`. This guards the source-expansion algorithm and LangChain's Jinja2 environment against drift."

- **[Low] F5 — Source-expansion textual scan claim overpromises on Jinja2 comments.** Verified at §3.4 step 2 line 303. Resolution: **option (a)** — amend the claim. The literal-token scan would falsely match `{# {% include 'x' %} #}` and the resulting expanded body would be malformed Jinja2 (caught at boot AST parsing as a parse error, not a silent corruption). Updating the parenthetical to: "literal-token match — Jinja2 disallows `{% %}` inside string literals, so a textual scan over non-commented source is unambiguous. Commented-out includes (`{# {% include 'x' %} #}`) are not expected in production prompts; if they do appear, the textual scan expands them and boot-time AST parsing catches the resulting malformed template as a `BootFailure` entry (loud failure, not silent corruption)."

- **[Low] F6 — `init_registry()` double-call behavior unspecified.** Agree with the finding (spec is silent), disagree with the proposed resolution (RuntimeError guard adds test-fixture ceremony for marginal MVP-pre-launch benefit). Adopting a documentation-only resolution: adding to §3.3 init_registry definition: "Double-call behavior: a second `init_registry()` call (whether from a buggy production lifespan, a script importing the module twice, or a test) silently replaces the module-level `_registry` with the new build. This matches the documented test-override pattern. Production code should call it exactly once; the silent-replace behavior is the test contract and is preserved in v1. A `RuntimeError` guard on production re-init can be added in v2 if a real incident demonstrates value; pull-forward trigger = first production bug masked by silent replacement."

- **[Low] F7 — `market_scoring` mis-categorized in Phase 2 step 5.** Verified: §2.1 line 25 lists `market_scoring/orchestrator.py:282-325` in the known baseline; §3.1 line 85 includes `market_scoring/score_lead.md.j2` in the file tree; but §4 Phase 2 step 5 lumps it with "Other services discovered in Phase 0." Resolution: split into its own step.
  - New §4 Phase 2 step 5: "`market_scoring/` — single inline prompt (`score_single_lead_against_market`, 34 LOC in `market_scoring/orchestrator.py:282-325`). Currently uses simple-invoke pattern (`llm2.invoke([HumanMessage(content=prompt)])` at line 326), so `call_with_prompt` applies directly. One commit; small surface."
  - Renumber the catch-all to step 6 and reword: "Other services discovered in Phase 0 — `customer_profile`, `leads`, `pipeline`, and anything else inline that the audit surfaces. Order determined by audit output."

- **[Nit] F8 — Source-expansion algorithm assumes `{% include %}` on its own line.** Verified at §3.4 step 3 (line 303-304). Adding to §3.2 "Prompt file format" as an authoring rule near the partials description: "**Include placement rule.** `{% include %}` directives must appear on their own line. Inline includes (on a line with surrounding text) produce undefined expansion behavior — the source-expansion algorithm replaces the entire line containing the directive, dropping the surrounding text. All examples in this spec follow this convention."

## Disagreed Findings

None on substance. On Finding 6, disagree with the *proposed resolution* (RuntimeError guard) but agree with the underlying gap; capturing the disagreement in the Agreed Findings entry above so the resolution is explicit.

## Deferred Findings

None.

## Severity Disagreements

None. Severities accepted as labeled by the reviewer across all eight findings.

## Open Questions

- **F2 follow-on — `rendered_at` field on `RenderedPrompt`.** Adding the field is straightforward, but the dataclass currently uses `@dataclass(frozen=True)`. The `datetime` value is captured once at render time and never mutated, so frozen remains correct. No further design decision needed; flagging only so the implementation pass doesn't accidentally drop `frozen=True` when adding the field.
- **F3 follow-on — Phase 0 audit cross-check.** With `model` no longer defaultable, every migrated prompt must explicitly declare its model in front-matter. The audit (`docs/prompt-inventory.md`) should record the *current* LLM client backing each prompt — this becomes the input to the front-matter `model` declaration during Phase 2 migration. Flag for the audit author.
- **F4 follow-on — LangChain parity test runtime cost.** `PromptTemplate.from_template(..., template_format='jinja2').format(**inputs)` constructs a fresh Jinja2 environment per call inside LangChain's internals. For four prompts × canonical inputs the runtime is trivially fast (<1s total), but if more LangChain-wrapped prompts are added later, the parity test's runtime grows linearly. Not a v1 concern; flag for future scaling.
