# Brewra — Technical Debt Register

Running list of debt items the team has consciously accepted. Each entry: what was done, what should be done, why we deferred, and the trigger that should pull it forward.

Numbering is preserved across resolutions — TD-001/002/003 (resolved by Phases E and F) were removed on 2026-05-23; their IDs are not reused so commit/spec references stay traceable. TD-006 (market_scoring callers recomputing len(leads)) was resolved 2026-05-24 by Phase H Task 4. TD-007 (Phase G plan-verbatim cosmetic cruft) was resolved 2026-05-25 by Phase I commit 11/11.

---

## TD-004 — Captured LLM fixtures are stubs, not real responses

**Date logged:** 2026-05-22
**Origin:** Phase E implementation review (`docs/reviews/2026-05-22-phase-e-implementation-review.md` §H1).

**Current state:**
`backend/tests/fixtures/captured/*.json` (24 files) are placeholder stubs with `"_stub": true` and a 4–6 key minimal shape. They were produced by hand during Phase E because `ANTHROPIC_API_KEY`, `TOGETHER_API_KEY`, and `TAVILY_API_KEY` were not available in the implementation environment. Unit and integration tests assert against this stub shape rather than real LLM output.

**What it should be:**
Run `cd backend && python tests/capture_fixtures.py` on a machine with all three API keys set. The script overwrites each stub with a real LLM response (10–30+ keys typical). Verify the suite still passes against the real shapes; update assertions or models if drift is exposed.

**Why we deferred:**
- The Phase E refactor was structured so that the capture script, the test harness, and the assertion sites are all in place — only the JSON content is stubbed. Switching to real captures is a content swap, not a code change.
- Running the script requires live API credentials with budget; doing it inside the test-writing phase would gate test-writing on key procurement.

**What we lose by staying as-is:**
- Tests don't assert against actual response shape. A service parsing change that produces a different real output can pass tests silently ("the fixtures lied"). This is the exact risk the now-retired TD-001 was meant to retire.
- The `test_icp.ambr` snapshot encodes stub shape, not real shape — it will need re-baselining after the first real capture.

**Pull-forward triggers:**
- First time someone with API keys runs the suite locally and observes a mismatch between stub assertions and real service behavior.
- Before any production release that depends on the captured-fixture acceptance criterion.
- When the capture pipeline (`tests/capture_fixtures.py`) is modified — re-run to validate the change end-to-end.

**Owner:** CTO (has API key access).

---

## TD-005 — v1 list endpoints expose `count` as page size, not DB total

**Date logged:** 2026-05-23
**Origin:** Phase G code review on Task 3 (`feat(be): add /v2/user-documents paginated endpoint + deprecate v1 [phase G, commit 3/8]`).

**Current state:**
v1 paginated routes that still return a wrapped envelope (`{status, count, files}` for `/user-documents`, `{status, count, signals}` for `/fetch-signals`) compute `count` as `len(items)` after the service silently caps at 500. Pre–Phase G, the service was unbounded and `count` reflected the true DB count. Post–Phase G, for orgs with >500 documents/signals, `count` is silently truncated to 500 while the underlying service knows the real total (it's the discarded `_` in `items, _ = await service.list_*(...)`).

```python
# v1 /user-documents
items, _ = await documents_service.list_user_documents(mongo, org_id)
return {"status": "success", "count": len(items), "files": items}  # count maxes at 500
```

The deprecation docstring tells clients to migrate to v2, but does not say `count` semantics changed.

**What it should be:**
Either:
1. Pass `total` through: `items, total = ...; return {…, "count": total, …}` — keeps the wire field honest at the cost of `count != len(files)` when capped.
2. Add explicit docstring note: `count` is page size, not DB total — migrate to v2 for the true count.

Option 1 is one character of code; option 2 is two lines of prose. v1 is being deleted in Phase H regardless.

**Why we deferred:**
- The plan (`plans/modularization-plan-7.md`) specifies the `len(items)` form verbatim. Changing it during execution would have been a spec deviation.
- The plan's reasoning (preserving `count == len(files)` invariant) is defensible: v1 callers iterating `files` see exactly `count` items with no surprise — the deprecation header tells them to migrate to v2 for the true total.
- Affected endpoints: `/user-documents` and `/fetch-signals` only. The other v1 routes either return bare lists (`/registration`, `/leads`, `/leads/by-file`) or wrappers without `count` (`/icp` returns `{suggestedICPs: items}`).

**What we lose by staying as-is:**
- v1 clients with org-size >500 see a `count` that lies about reality. The deprecation header is the only signal pointing them at the fix.
- If Phase H v1-deletion slips, the gap widens — orgs grow past 500 over time and silent truncation becomes silent data loss to consumers that don't read the full page.

**Pull-forward triggers:**
- First v1 client reports a missing-document/missing-signal incident traceable to the 500-cap.
- Phase H planning — fold the docstring/return change into the v1-removal commit if both endpoints aren't fully migrated by then.
- Any FE bug ticket mentioning "we have N documents in S3 but the dashboard says 500."

**Owner:** TBD (likely whoever wires the FE to v2 first).

---

## TD-008 — Reduce-LOC refactoring pass across residual large files

**Date logged:** 2026-05-24
**Origin:** Proactive observation during Phase I brainstorming. Phase H impl review round 2 highlighted `signals/orchestrator.py` at 744 LOC (2× spec estimate); Phase I addresses that one file but several others remain.

**Current state:**
Files >350 LOC in `backend/app/services/` (post-Phase-I projection):

| File | LOC | Notes |
|---|---:|---|
| `market_research/prompts.py` | 718 | Single-file prompt constants for 5 components |
| `leads.py` | 465 | Flat service, not yet decomposed |
| `data_sources/pipeline.py` | 446 | Coordinated S3 + Pinecone + Mongo upload |
| `market_scoring/orchestrator.py` | 428 | Trigger/status/persistence orchestration |
| `customer_profile.py` | 388 | Flat service, not yet decomposed |
| `icp/orchestrator.py` | 385 | ICP_generator + 4 research workers + dispatch |
| `icp/prompts.py` | 383 | Prompt constants |

These weren't the structural targets of any single phase — past phases optimized for clean module boundaries (decomposition) rather than LOC per file. Several contain inline data-munging blocks, long string literals, or dead-branch handling that could compress without losing clarity.

**What it should be:**
A focused review pass per file — not a refactor, an audit — answering for each: which functions are doing more than one thing, which inline patterns could be extracted to helpers, which dead branches can be removed, which long string literals could be hoisted. Output: a per-file punch list of high-confidence LOC reductions. Execute only the high-confidence items.

**Why we deferred:**
- Structural decomposition (Phases B-I) was higher-leverage; LOC reduction was a side effect of that work, not the goal.
- LOC count is a weak proxy for complexity. The audit needs human judgment per file, not a mechanical pass — premature without that.
- Phase I addresses the largest offender (`signals/orchestrator.py`); the remaining files are smaller and the marginal value drops off.

**What we lose by staying as-is:**
- Each file >400 LOC takes longer to read end-to-end; AI agents working in these files burn more context per task.
- Long-tail readability cost compounds — future contributors hit the same "this file is doing a lot" friction repeatedly.

**Pull-forward triggers:**
- After Phase J (decomposing remaining flat services) completes — natural moment to do a width-then-depth pass.
- When a feature task is gated by needing to understand one of these files end-to-end and the cost of that understanding becomes visible.
- When AI-agent context-budget complaints surface during work on one of the listed files.

**Owner:** TBD.

---

## TD-009 — Docstring/code drift audit

**Date logged:** 2026-05-24
**Origin:** Phase H round-2 implementation review caught stale `signals/__init__.py` docstring (claimed "commit 16/20 final form" while actually at 20/20). Pattern repeated across all 5 Phase H package `__init__.py` docstrings, which had been rewritten for "final form" but drifted across the execution sequence. Phase I Risk R3 explicitly calls out the recurrence risk.

**Current state:**
Docstrings across the codebase make claims that were true when written but may have drifted since. Highest-risk classes:

1. **Package `__init__.py` docstrings** that enumerate submodules and re-exported symbols — drift when submodules are added/removed or symbols change visibility.
2. **Module-top docstrings** that describe origin ("extracted from <file> in commit N/M") — drift as commit/plan numbering shifts.
3. **Function docstrings** that describe call patterns ("called by X, Y") — drift when callers move or disappear.
4. **Spec/plan references** inside docstrings — drift when specs are revised across review rounds.

No systematic check enforces docstring accuracy. Linters catch syntax, not truth.

**What it should be:**
A one-pass audit: for each module under `backend/app/`, read the top-level docstring and verify each factual claim against current code. Output: a list of corrections, applied in a single commit. Not a permanent enforcement mechanism — a periodic sweep.

**Why we deferred:**
- Structural refactors (Phases B-I) ship intermediate docstrings under time pressure; final cleanup is naturally retrospective.
- A "docstring linter" that enforces accuracy would require either parsing prose (fragile) or restricting docstrings to a structured format (overengineering for current scale).

**What we lose by staying as-is:**
- Stale docstrings actively mislead readers (including AI agents), worse than no docstring at all.
- The Phase H impl review found 4-5 cases where the docstring's claimed final state didn't match reality. Patterns of drift accumulate — each drift makes future readers trust the docstrings less.
- AI agents that use docstrings as context-window summaries inherit stale claims.

**Pull-forward triggers:**
- At the end of any multi-phase sequence (e.g., post-Phase-J) — natural cleanup moment.
- When a reader (human or agent) explicitly raises a docstring-vs-reality mismatch.
- Bundled into the same pass as TD-008 (LOC reduction) — both are "look at every file once" audits.

**Owner:** TBD.

---

## TD-010 — Modularize prompts libraries

**Date logged:** 2026-05-24
**Origin:** Phase H decomposition extracted prompts to per-service `prompts.py` modules but kept them as Python string constants. Phase H spec §6 noted "Option D — prompt externalization" as a future direction not in scope.

**Current state:**
Prompts live as triple-quoted Python string constants in `prompts.py` modules:

| File | LOC | Prompts inside |
|---|---:|---|
| `market_research/prompts.py` | 718 | 5 component prompts |
| `icp/prompts.py` | 383 | ICP generator + 4 research-worker prompts |
| `signals/prompts.py` | 328 | Scout + Profiler prompts, leads section, signal-ask (Groq + Claude) |

Consequences of the current shape:
- Editing prompts requires touching Python and shipping a code release.
- No prompt versioning — can't trace which prompt revision produced a given LLM output stored in Mongo.
- No way for non-engineers (PMs, marketing, prompt engineers) to iterate prompts independent of the engineering team.
- Shared prompt fragments (response-format instructions, persona headers, JSON-schema hints) get copy-pasted across files instead of composed.
- Prompt unit-testing means string-equality assertions on large literals — brittle and noisy.

**What it should be:**
Externalize prompts to a structured format. Three plausible designs (pick during a future design session):

1. **Jinja templates in `backend/prompts/<service>/<name>.j2`** — Python loads at startup, render with variables. Enables shared partials, conditional sections, versioning via git.
2. **YAML or JSON prompt registry** with versioned entries — Python looks up by name + version. Enables runtime A/B testing and audit trails.
3. **Per-prompt `.md` files** — simplest; one file per prompt, no template engine, no version metadata.

Each requires:
- A prompt loader/registry module (`app/services/_prompts.py` or similar).
- Migration of existing constants to the chosen format.
- A versioning convention (file hash, semantic version, or both).
- Possibly: a per-prompt fixture in `tests/fixtures/prompts/` so prompt changes are reviewable in PRs.

**Why we deferred:**
- Structural decomposition (Phases B-I) was the higher-leverage move; prompts had to be isolated into their own modules first before externalization was viable.
- Externalization introduces new abstractions (template engine, prompt registry, versioning) that warrant their own spec and design discussion.
- Pre-launch (0 live users), prompt iteration velocity is not currently a bottleneck — eng owns the prompts and can edit them in code.

**What we lose by staying as-is:**
- Marketing/PM/prompt-engineer hires can't iterate prompts without engineering bandwidth.
- Production debugging of an LLM output can't trace back to "which prompt version generated this" — observability gap that compounds at scale.
- Shared prompt fragments stay duplicated; changes to e.g. response-format instructions require touching every prompt file.

**Pull-forward triggers:**
- First non-engineer (PM, prompt engineer, marketing) needs to iterate a prompt and bottlenecks on engineering.
- First production incident where "which prompt was active when this LLM output was generated?" is the unanswerable question.
- Regulatory or compliance requirement for prompt-versioning audit trails.
- When prompt iteration cadence exceeds code-release cadence.

**Owner:** TBD.
