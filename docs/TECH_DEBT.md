# Brewra — Technical Debt Register

Running list of debt items the team has consciously accepted. Each entry: what was done, what should be done, why we deferred, and the trigger that should pull it forward.

Numbering is preserved across resolutions — TD-001/002/003 (resolved by Phases E and F) were removed on 2026-05-23; their IDs are not reused so commit/spec references stay traceable. TD-006 (market_scoring callers recomputing len(leads)) was resolved 2026-05-24 by Phase H Task 4. TD-007 (Phase G plan-verbatim cosmetic cruft) was resolved 2026-05-25 by Phase I commit 11/11. TD-008 (backend LOC reduction) and TD-009 (docstring/comment drift) were resolved 2026-05-25 by Phase L (audit + 7 K-tasks + I2 promotion, commit `7f169f9`). TD-010 (prompt management overhaul) was resolved 2026-05-26 by plan-13 (Phase 0 audit + render/registry infrastructure + 6 service migrations, commits `5238fb7..1c94e29`); the resolved entry is retained below with original context preserved. TD-011 (stale Claude Sonnet model pin) was resolved 2026-06-15 — `backend/app/core/config.py` now defaults to `claude-sonnet-4-6` (the Render `CLAUDE_SONNET_MODEL` env matches); the resolved entry is retained below with original context preserved.

---

## Index — TD-FE entries

| Entry | Status | Location |
|---|---|---|
| TD-FE-1 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-1--deferred-orphan-route-investigation-tenant-selection) |
| TD-FE-2 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-2--deferred-orphan-route-investigation-scout-deployment) |
| TD-FE-3 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-3--deferred-unused-exports-srclib-firebase-api-leadstreamheatmapsession-missionprofilersessioncache) |
| TD-FE-4 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-4--deferred-unused-export-srchooksuse-toastts) |
| TD-FE-5 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-5--deferred-unused-exports-srcutilsapiutilsts) |
| TD-FE-6 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-6--deferred-unused-exports-srcutilsprofileracceptedicpdisplayts) |
| TD-FE-7 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-7--deferred-unused-exports-srccomponentsui-shadcn-locked-primitives) |
| TD-FE-8 | open | [below](#td-fe-8--knip-ignoredependencies-for-two-untraceable-packages) |
| TD-FE-9 | open | [below](#td-fe-9--phase-2a-escape-hatches-threshold-reached-6-entries) |
| TD-FE-10 | open | [below](#td-fe-10--phase-2b-escape-hatches-threshold-reached-5-new-entries) |
| TD-FE-11 | open | [below](#td-fe-11--orphaned-settings-company-profile-fetch-after-companyprofile-tanstack-migration) |
| TD-FE-12 | open | [below](#td-fe-12--dead-tenantcontextavailabletenantssetavailabletenants-after-tenantselection-migration) |
| TD-FE-13 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-13--repoint-hardcoded-backend-host-backend-11kr--brewra-gtm-intelligence) |
| TD-FE-14 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-14--knip-ignore-on-srcsharedcomponents-until-phase-5-consumes-featureerrorboundary) |
| TD-FE-15 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-15--cross-feature-index-only-lint-enforcement-deferred-zone-boundaries-only) |
| TD-FE-16 | open | [below](#td-fe-16--sidebar-export-name-twins--useauth-name-collision) |
| TD-FE-17 | open | [below](#td-fe-17--market-research-has-no-visual-regression-baseline-phase-5-guards-with-behavioral-e2e--vitest) |
| TD-FE-18 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-18--market-research-dead-code-8-files-no-live-importer-awaiting-the-5i-sweep) |
| TD-FE-19 | open | [below](#td-fe-19--market-research-page-still-runs-raw-fetch--localstorage-cache-5b-page-rewire-deferred) |
| TD-FE-20 | open | [below](#td-fe-20--market-research-trendsscout-chat-tab-has-no-e2e-behavioral-coverage) |
| TD-FE-21 | open | [below](#td-fe-21--market-entry-edit-write-path-get-apiask-with-json-in-query-params--write-path-localstorage--swot-fake-defaults) |
| TD-FE-22 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-22--marketentrysection-owns-a-data-fetch-but-has-no-featureerrorboundary-wrapping) |
| TD-FE-23 | open | [below](#td-fe-23--compliance-analytics-cards-key-on-cardtype-but-backend-emits-charttype) |
| TD-FE-24 | open | [below](#td-fe-24--regulatory-default-data-duplicated-across-5-sites) |
| TD-FE-25 | open | [below](#td-fe-25--read-only-strategic-recommendations-ignores-localstrategicrecommendations-state-coherence-quirk) |
| TD-FE-26 | open | [below](#td-fe-26--dead-non-user-scoped-localstorage-writes-in-regulatorycompliancesection) |
| TD-FE-27 | open | [below](#td-fe-27--competitor-landscape-edit-write-path-raw-apiask--apimarket_intelligence-fetches-survive-read-migration) |
| TD-FE-28 | open | [below](#td-fe-28--industry-trends-page-level-fetchstatecache-slice-retained-in-usemarketresearchdatats) |
| TD-FE-29 | open | [below](#td-fe-29--full-preflight-gate-stays-serial-parallel-runner-is-opt-in-flakes-e2e-under-concurrent-session-load) |
| TD-FE-30 | open | [below](#td-fe-30--market-size-page-level-fetchstatecache-slice-the-cascade-root-retained-in-usemarketresearchdatats) |
| TD-FE-31 | open | [below](#td-fe-31--market-size-edit-save-retains-the-legacy-apiask-get-write-path) |
| TD-FE-32 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-32--feature-phase-number-disagreement-master-spec-14-4-vs-featuresreadme-naming-map) |
| TD-FE-33 | open | [below](#td-fe-33--icpmanager-read-migrated-to-useicps-legacy-localstorage-fallback--user_id-mismatch-guard-dropped) |
| TD-FE-34 | open | [below](#td-fe-34--mission-control-writemutation-paths-remain-raw-fetch) |
| TD-FE-35 | open | [below](#td-fe-35--mission-control-client-storage-bridges-retained-as-is) |
| TD-FE-36 | open | [below](#td-fe-36--usecompanyprofile-shared-promotion-candidate) |
| TD-FE-37 | open | [below](#td-fe-37--datasourcesmanager-upload-helpers-shared-extraction-deferred) |
| TD-FE-38 | open | [below](#td-fe-38--mission-control-escape-hatch-typings-retained) |
| TD-FE-39 | open | [below](#td-fe-39--relocated-connector-cluster-is-dead-code-two-datasource-shapes-not-unified) |
| TD-FE-40 | open | [below](#td-fe-40--phase-6-relocated-legacy-cleanup-nits-in-mission-control) |
| TD-FE-41 | open | [below](#td-fe-41--suggestedicpcards-acceptrejectdismiss-optimism-stays-in-localstorage-not-modeled-in-the-tanstack-cache) |
| TD-FE-42 | open | [below](#td-fe-42--customers-icp--customer_profile-read-overlaps-mission-control-useicps-two-independent-read-paths-with-nothing-to-catch-a-divergent-apiicp-shape-change) |
| TD-FE-43 | open | [below](#td-fe-43--customers-read-orchestration-retains-imperative-loader-with-localstorage-fetch-cache--sessionstorage-session-cache--multi-tier-fallbacks-rather-than-going-cache-native) |
| TD-FE-44 | open | [below](#td-fe-44--window-event-headerpage-bridge-profilerrefreshprofilercreateicpprofilerexportdatanavigatetoleadstreamicpaccepted-is-untyped-global-coupling) |
| TD-FE-45 | open | [below](#td-fe-45--profilerchatwithhistory-imports-the-signalscontextchat-substrate-via-the-legacy-path-phase-8-relocates-the-substrate-phase-9-dedups-profilerchatscoutchat) |
| TD-FE-46 | open | [below](#td-fe-46--phase-7-stage-4-behavioral-test-covers-only-accept--reject-happy-paths-optimistic-edge-case-matrix-and-fake-timer-deadlock-unresolved) |
| TD-FE-47 | open | [below](#td-fe-47--strategistworkspace-relocated-as-is-live-but-large-decomposition--get-chat-deferred) |
| TD-FE-48 | open | [below](#td-fe-48--dealsdeals-naming-dealstsx-is-the-strategist-page-not-a-phase-12-small-page) |
| TD-FE-49 | open | [below](#td-fe-49--signals-acceptedrejected-localstorage-is-primary-state-not-cache) |
| TD-FE-50 | open | [below](#td-fe-50--signalschatcontext-sessionstorage-handoff-is-untyped) |
| TD-FE-51 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-51--componentsmarket-research-retains-scoutchatpaneltsx--typests-legacy-residue) |
| TD-FE-52 | open | [below](#td-fe-52--no-strategist-playwrightvr-journey-coverage-is-behavioral-only) |
| TD-FE-53 | open | [below](#td-fe-53--signals-page-data-flow-not-migrated-to-tanstack-phase-8-was-structure-only) |
| TD-FE-54 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-54--libjwtts--hooksuseauthts-still-live-in-legacy-srclibsrchooks-rather-than-sharedauth) |
| TD-FE-55 | open | [below](#td-fe-55--featurestenanthooksusetenantsts-serves-a-hardcoded-mock_tenants-list-no-real-list-tenants-backend-endpoint-exists) |
| TD-FE-56 | open | [below](#td-fe-56--featuressettingscomponentsagentprofiletsx-and-featuresscoutcomponentsscoutdeploymenttsx-are-near-duplicate-forms) |
| TD-FE-57 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-57--phase-12-features-still-import-legacy-hooksusepagetitle) |
| TD-FE-58 | open | [below](#td-fe-58--artefacts-cross-component-coupling-via-untyped-window-customevents) |
| TD-FE-59 | open | [below](#td-fe-59--small-page-surfaces-are-mockplaceholder-no-backend) |
| TD-FE-60 | open | [below](#td-fe-60--no-featuresprofiler-folder-profiler-distributed-across-three-areas) |
| TD-FE-61 | open | [below](#td-fe-61--signalschatcontext-type-name-retained-after-component-renamed-to-contextchat) |
| TD-FE-62 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-62--srcutilsleadstreamchatcontextts-remains-in-utils) |
| TD-FE-63 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-63--componentsmarket-research-retains-6-files-after-phase-9s-partial-drain) |
| TD-FE-64 | open | [below](#td-fe-64--csv-smart-quote-normalization-is-a-no-op-normalizecsvasciidoublequotes) |
| TD-FE-65 | open | [below](#td-fe-65--usemarketresearchdatats-decomposition-deferred-6034-loc-monster-file) |
| TD-FE-66 | open | [below](#td-fe-66--usedocumentsync-cleanup-pre-existing-patterns-relocated-in-phase-13b) |
| TD-FE-67 | open | [below](#td-fe-67--single-page-v2-reads-still-cap-items-at-500-total-not-surfaced) |
| TD-FE-68 | open | [below](#td-fe-68--production-routed-back-through-api-cold-start-batch-margin--residual-direct-backend-callsites) |
| TD-FE-69 | open | [below](#td-fe-69--per-icp-lead-count-is-stubbed-to-0-suggestedicpcards-shows-0-leads) |
| TD-FE-70 | open | [below](#td-fe-70--customers-lead-stream-is-first-page-only-no-pager) |

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

## TD-010 — Overhaul prompt management system

**Status:** RESOLVED 2026-05-26 via plan-13 ([spec](../specs/13-prompt-management-design.md), [plan](../plans/13-prompt-management.md)).

**Resolution summary:** Every prompt in `backend/` now lives under `backend/prompts/<svc>/` with YAML front-matter, served by `app/core/prompts.py`. Per-LLM-call `prompt_meta` (name, version, content_hash, render_inputs_hash, model, rendered_at) is persisted alongside output in Mongo. Shared partials in `_shared/` compose into callable prompts. See [`docs/PROMPTS.md`](PROMPTS.md) for the system as it exists; see [`docs/prompt-migration-outcome.md`](prompt-migration-outcome.md) for the audit trail of what migrated, what was deferred, and why.

**PR references:** delivered as 13 commits on `master`:
- `5238fb7` — docs(prompts): Phase 0 prompt inventory audit (Task 1)
- `48445f3` — feat(be): scaffold app/core/prompts.py dataclasses + error types (Task 2)
- `226a28d` — feat(be): implement init_registry + source-expansion algorithm (Task 3)
- `2382628` — feat(be): implement prompt render + as_langchain adapter (Task 4)
- `877d7d3` — feat(be): add prompts/_shared/ defaults and partials (Task 5)
- `ddd7cb1` — feat(be): add prompt fixture infra + golden-render test (Task 6)
- `fb722d7` — feat(be): wire call_with_prompt + lifespan init_registry (Task 7)
- `c28fab0` — refactor(be): migrate icp/ prompts to backend/prompts/ + prompt_meta (Task 8)
- `d1edb16` — refactor(be): migrate signals/ prompts with conditionals + prompt_meta (Task 9)
- `51a0dfb` — refactor(be): migrate market_research/ prompts + prompt_meta (Task 10)
- `fedfcfd` — refactor(be): migrate llm_config Cypher+QA prompts via as_langchain (Task 11)
- `799c2c6` — refactor(be): migrate market_scoring inline prompt via call_with_prompt (Task 12)
- `1c94e29` — refactor(be): migrate graph_chat/score_prospect prompts + prompt_meta (Task 13)

**Original entry preserved below as historical context.**

---

**Date logged:** 2026-05-24 (scope expanded 2026-05-25)
**Origin:** Phase H decomposition extracted prompts to per-service `prompts.py` modules but kept them as Python string constants. Phase H spec §6 noted "Option D — prompt externalization" as a future direction not in scope. The expanded scope (versioning, observability binding, per-prompt config metadata, composition) was recognised after Phase L's audit confirmed the `prompts.py` modules remain the largest non-decomposable bodies in `backend/app/` and that the surrounding system (call sites, LLM config, persistence layer) treats prompts as inert strings rather than versioned artefacts.

**Current state:**
Prompts live as triple-quoted Python string constants in `prompts.py` modules:

| File | LOC | Prompts inside |
|---|---:|---|
| `market_research/prompts.py` | 718 | 5 component prompts |
| `icp/prompts.py` | 383 | ICP generator + 4 research-worker prompts |
| `signals/prompts.py` | 328 | Scout + Profiler prompts, leads section, signal-ask (Groq + Claude) |

Adjacent system surfaces today entangled with the prompts:
- Per-prompt model config (model name, temperature, max_tokens, response_format) is wired into call sites or `app/core/llm_config.py`, not co-located with the prompt text — changing the model behind one prompt touches multiple files.
- LLM output records persisted to Mongo carry no prompt-version pointer; observability answers "what was the output?" but not "which prompt produced it?".
- Tests assert on substring fragments inside prompt literals, so prompt edits cascade into noisy test diffs even when LLM behaviour is unchanged.
- No staging/prod prompt divergence — every environment runs the same in-code constant; a prompt change can't be soaked before promotion.

Consequences of the current shape:
- Editing prompts requires touching Python and shipping a code release.
- No prompt versioning — can't trace which prompt revision produced a given LLM output stored in Mongo.
- No way for non-engineers (PMs, marketing, prompt engineers) to iterate prompts independent of the engineering team.
- Shared prompt fragments (response-format instructions, persona headers, JSON-schema hints) get copy-pasted across files instead of composed.
- Prompt unit-testing means string-equality assertions on large literals — brittle and noisy.

**What it should be:**
A purpose-built prompt management subsystem. Scope is intentionally broader than "move strings out of Python":

1. **Externalized prompt content** — prompt bodies live as templated files under `backend/prompts/<service>/<name>/...`, rendered at call time with variables. Format (Jinja, Markdown with front-matter, YAML, etc.) picked in spec.

2. **Versioning model** — each prompt carries a stable identifier (name) and a version (semver or content hash). Call sites pin to a version; the loader resolves `name + version → body`. New prompt versions ship without disturbing in-flight requests. Versioning convention picked in spec.

3. **Per-prompt config bundle** — model, temperature, max_tokens, response_format, timeout, retry policy travel with the prompt (front-matter or sidecar config), not with the call site. Changing a prompt's model becomes a prompt edit, not a code edit.

4. **Observability binding** — every LLM call records `(prompt_name, prompt_version, render_inputs_hash)` alongside the output in Mongo. "Which prompt produced this output?" becomes a Mongo lookup, not a git archaeology task. Cost/latency per prompt version becomes a queryable metric.

5. **Composition** — partials/includes for duplicated fragments (response-format instructions, persona headers, JSON-schema hints), with clear conventions (no deep transitive includes; shared partials live in `backend/prompts/_shared/`).

6. **Testing scaffold** — golden-rendered fixtures (`tests/fixtures/prompts/<name>@<version>.txt`) so prompt-text changes surface as one focused diff per prompt; renderer unit tests cover variable substitution and partial composition; behaviour tests stay decoupled from prompt body text.

7. **Loader / registry module** — `app/services/_prompts.py` (or similar) is the single API: `prompts.render(name, version=…, **vars) -> (text, config)`. Call sites lose direct access to the string constants.

8. **Non-engineer iteration workflow** — externalized files are reviewable in PRs by non-engineers. A runtime-edit pathway (database-backed override layer or admin UI) is explicitly out of scope for the initial overhaul; if needed it lands later.

9. **Optional (decide in spec): runtime variant routing** — name + version + variant for runtime A/B. Only include if there is a near-term need; otherwise defer.

Design questions to resolve during the spec session: (a) template engine choice — Jinja2 (rich: conditionals, loops, filters, includes), Mustache/Chevron (logic-less, portable across languages), `string.Template` (`$var`, stdlib, no logic), `str.format` / f-string-style `{var}` placeholders (no engine, no includes), or plain text with manual substitution; (b) versioning convention (semver vs content hash vs both), (c) where per-prompt config lives (front-matter vs sidecar `.toml` vs registry entry), (d) loader caching strategy (startup vs lazy vs hot-reload), (e) rollout — big-bang migration vs prompt-by-prompt during the transition.

**Why we deferred:**
- Structural decomposition (Phases B-I, then Phase L cleanup) was the higher-leverage move; prompts had to be isolated into their own modules first before externalization was viable.
- The expanded scope (versioning, observability binding, per-prompt config, composition) couples several abstractions (template engine, prompt registry, versioning model, observability schema, test scaffold) that warrant their own spec and design discussion. Framing this as "modularize prompts" understated the work.
- Pre-launch (0 live users), prompt iteration velocity is not currently a bottleneck — eng owns the prompts and can edit them in code.

**What we lose by staying as-is:**
- Marketing/PM/prompt-engineer hires can't iterate prompts without engineering bandwidth.
- Production debugging of an LLM output can't trace back to "which prompt version generated this" — observability gap that compounds at scale.
- Shared prompt fragments stay duplicated; changes to e.g. response-format instructions require touching every prompt file.
- Per-prompt config (model, temperature) is scattered across call sites instead of travelling with the prompt; "use a different model for just this one prompt" is a multi-file change.
- No mechanism to soak a prompt change in staging before promoting — every environment shares the in-code constant.
- Cost/latency analysis "per prompt version" is impossible without the version pointer in observability data.

**Pull-forward triggers:**
- First non-engineer (PM, prompt engineer, marketing) needs to iterate a prompt and bottlenecks on engineering.
- First production incident where "which prompt was active when this LLM output was generated?" is the unanswerable question.
- Regulatory or compliance requirement for prompt-versioning audit trails.
- When prompt iteration cadence exceeds code-release cadence.
- First time a prompt-config change (model, temperature, response_format) needs to land independently of a code release.
- First analysis request requiring "what was the cost/latency of prompt X at version Y?" — currently unanswerable.

**Owner:** TBD.

---

## TD-011 — Backend pins a stale Claude Sonnet model snapshot (`claude-sonnet-4-20250514`)

**Status:** ✅ RESOLVED 2026-06-15 — `backend/app/core/config.py:12` now defaults to `claude-sonnet-4-6` (the Render `CLAUDE_SONNET_MODEL` env matches; confirmed 2026-06-12). The standalone `backend`-repo reconciliation noted below is moot: the monorepo is the source of truth. Original context retained below.

**Date logged:** 2026-05-29
**Origin:** Incidental finding during the Claude Code Opus 4.8 upgrade. A sweep for outdated `claude-opus-*` IDs in config/scripts found none (every `claude-opus-4-7` hit was a historical `docs/reviews/` artifact), but surfaced this Sonnet pin as the only Claude model ID in runtime config.

**Current state:**
The Claude model behind the signals feature is pinned to a dated snapshot:

```python
# backend/app/core/config.py:13
claude_sonnet_model = os.getenv("CLAUDE_SONNET_MODEL") or "claude-sonnet-4-20250514"
```

`claude-sonnet-4-20250514` is the original Claude Sonnet 4 snapshot (2025-05-14); the current Sonnet generation is 4.6 (`claude-sonnet-4-6`). The hardcoded fallback is what runs whenever `CLAUDE_SONNET_MODEL` is unset — it is unset in the committed config; whether the Render env overrides it is unverified. The pin feeds the `claude_signal_*` knobs (`config.py:14-16` — window seconds, 5-minute token limit, max output tokens) and the Anthropic call path (keyed by `ANTHROPIC_API_KEY` in `app/services/_llm_helpers.py` and `app/services/_claude_budget.py`). The same stale fallback string also lives in the upstream standalone `backend` repo (`config.py:13`); reconcile both when fixing.

**What it should be:**
Pin to the current Sonnet generation (`claude-sonnet-4-6`) — or a deliberately chosen explicit snapshot — in both config copies. When bumping, verify the signals call path for model-version-specific behavior (response shape, token accounting against `claude_signal_token_limit_5m` / `claude_signal_max_output_tokens`) and consider adding prompt caching while the call site is open.

**Why we deferred:**
- Out of scope for the trigger: the Opus 4.8 change was a Claude Code (dev-tool) upgrade with zero codebase footprint; this Sonnet pin is a *product runtime* model choice, surfaced only incidentally.
- Bumping a runtime model changes behavior and cost for a customer-facing feature — a deliberate product decision, not a mechanical version bump, even at 0 live users.
- Nothing is broken today: `claude-sonnet-4-20250514` is still a served model.

**What we lose by staying as-is:**
- The signals feature runs on the original Sonnet 4, missing quality/latency/cost improvements in later releases (current 4.6).
- Dated snapshots eventually retire; when Anthropic deprecates `claude-sonnet-4-20250514`, signals calls fail with no in-app warning unless the pin is bumped first.
- Drift risk between the two config copies if one is updated and the other is not.

**Pull-forward triggers:**
- Any deliberate review of the signals feature's model quality / latency / cost.
- Anthropic announces deprecation or retirement of `claude-sonnet-4-20250514`.
- The standalone `backend` repo is folded into the monorepo (reconcile to one config at that point).
- A token-budget tuning pass on the `claude_signal_*` knobs, or a signals output-quality complaint.

**Owner:** TBD.

---

## TD-FE-8 — knip ignoreDependencies for two untraceable packages

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 Task 7.2 (plans/16-frontend-phase-1-loc-reduction.md), knip --strict wire-in.
**Last updated:** 2026-05-27 (root cause identified; scope reduced from 30 → 2 packages).

**Current state:**
`frontend/knip.json` ignores 2 packages: `tailwindcss-animate` (Tailwind plugin consumer in
`tailwind.config.ts` — knip's strict mode doesn't trace through Tailwind config plugins) and
`tsx` (invoked as a CLI tool via `npx tsx scripts/*.ts` — no package.json script reference for
knip's `tsx` plugin to detect).

**Why deferred:**
Both ignores are genuine tool-boundary limitations rather than policy decisions. `tailwindcss-animate`
is correctly traced by knip non-strict (which uses Tailwind plugin trace) but lost under strict;
`tsx` would be detected if a package.json script invoked it directly. Neither is a "real" debt
in the sense of pending work — they document why these two packages bypass the merge gate.

**Original scope (resolved):**
Earlier this entry covered 30 packages including @radix-ui/*, lucide-react, firebase,
react-router-dom, recharts, and @tanstack/react-query. Root cause was identified as knip
`--production` mode not recursively walking imports from entry points (only files matching
entry patterns count as "used"). The 30-package workaround was replaced by using
`"src/**/*.{ts,tsx}!"` as a production-marker entry pattern, so the full app tree is
production-scoped, and `"ignore": ["src/components/ui/**"]` for the Phase 4-locked shadcn
primitives. After that fix, 28 of the original 30 packages traced correctly; only the 2
listed above remained genuinely untraceable.

**Pull-forward trigger:**
- For `tsx`: when a package.json script directly references `tsx <file>`, the knip tsx plugin
  will detect it and the entry can be removed
- For `tailwindcss-animate`: when knip's strict-mode tracing unifies with non-strict plugin
  detection (likely a future major knip version), or when this project migrates away from
  the package

**Owner:** TBD.

---

## TD-FE-9 — Phase 2a escape-hatches threshold reached (6 entries)

**Date logged:** 2026-05-28
**Origin:** Spec 17 Phase 2a (plans/17-frontend-phase-2a-strict-ts.md), Step 3.

**Current state:**
`src/lib/types/escape-hatches.ts` accumulated 6 entries during Wave B's noImplicitAny annotation
pass:
- `UntypedReportState` — setState callback `prev`/`prevData` parameter across MarketResearch.tsx
  and MarketEntrySection.tsx (all set*Data callbacks).
- `UntypedUiComponent` — `uiComponents.find((comp) =>)` callback in MarketResearch.tsx.
- `UntypedRegulatoryUpdate` — `keyDataPoints[]` (derived from `keyUpdates[]`) array items in
  RegulatoryComplianceSection.tsx.
- `UntypedVisualDataCard` — `visualDataCards[]` array items in RegulatoryComplianceSection.tsx.
- `UntypedRegionData` — `regionalData[]` array items in RegulatoryComplianceSection.tsx.
- `UntypedReportSection` — MarketEntry report-section arrays (executiveSummary paragraphs,
  entryBarriers, competitiveDifferentiation, strategicRecommendations, riskAssessment) in
  MarketEntrySection.tsx.

**Pattern:** Backend response shapes consumed by FE before contract types are written. Wave B's
annotation pass routed them through `Untyped*` aliases instead of inlining `any`, keeping the
inline-`any` count from regressing past the 238 baseline (post-fix count: 223).

**Why deferred:**
Spec 17 §2.4 posture rule 3 — proper typing requires backend contracts which are not in Phase 2a
scope.

**Pull-forward trigger:** Phase 13's audit re-evaluates per master spec line 298. Backend contract
typing (Phase ~10+) would unlock replacing these with proper types.

**Owner:** TBD.

## TD-FE-10 — Phase 2b escape-hatches threshold reached (5+ new entries)

**Date logged:** 2026-05-28
**Origin:** Spec 18 Phase 2b (plans/18-frontend-phase-2b-eslint-prettier.md), Step 4 Wave C.

**Current state:**
`src/lib/types/escape-hatches.ts` grew from 6 entries (TD-FE-9 baseline) to 14 entries during
Phase 2b's per-file `no-explicit-any` cleanup. New entries:
- `UntypedProfilerIcpRecord` — customer_profile ICP record consumed by mission-control + customers
  components.
- `UntypedBackendProfile` — UserProfile / AgentProfile / CompanyProfile prop shapes.
- `UntypedBackendDocument` — DataSourcesManager document-list consumer.
- `UntypedBackendApiResponse` — generic untyped backend API envelopes (MarketResearch.tsx state +
  callback params + transform inputs).
- `UntypedCascadeContext` — `previousContext` bag passed between sequential market-research
  component fetchers.
- `UntypedLead` — strategist lead-stream + Chat-with-Scout lead handoff callbacks.
- `UntypedVisualDataCardRaw` — regulatory visualDataCards raw shape pre-UI transform.
- `UntypedBackendSignal` — raw signal objects from /api/generate-signals-batch and /api/signals
  consumed by `buildSignalCardsFromFetchData` and inline console.log mappings on Signals.tsx.

**Pattern:** Same as TD-FE-9 — backend response/payload shapes consumed by FE before contract types
are written. Phase 2b's per-file pass routed remaining inline `any` through named aliases instead
of suppressing the eslint rule.

**Why deferred:**
Spec 18 §4 escape-hatches policy carry-forward from Spec 17 §2.4 posture rule 3. Backend contracts
are still out of scope.

**Pull-forward trigger:** Phase 13's audit re-evaluates per master spec line 298. Backend contract
typing (Phase ~10+) would unlock replacing these with proper types.

**Owner:** TBD.

---

## TD-FE-11 — Orphaned Settings company-profile fetch after CompanyProfile TanStack migration

**Date logged:** 2026-05-29
**Origin:** Plan 20 Phase 3 (plans/20-frontend-phase-3-api-data-layer.md), Task 9.

**Current state:**
`Settings.tsx` fetches profile data generically via `fetchProfileData(profileType)` (`:105`), called on
profile selection (`:193`) and user change (`:181`), and passes the result to the rendered profile
component via `commonProps.profileData` (`:218,:224`). After Phase 3, `CompanyProfile` reads its data from
`useCompanyProfile` (a TanStack query keyed on `org_id`) and ignores the `profileData` prop, so for the
"company" selection `fetchProfileData("company")` (a `GET /api/profile/company?user_id=…`) still runs but
its result is discarded — a redundant network call. The same generic prop still feeds the non-migrated
`UserProfile`/`AgentProfile`, so `Settings.tsx` is left unchanged.

**Why deferred:**
Removing the company branch / lifting it into the shared query requires `UserProfile` and `AgentProfile` to
also migrate off the shared `profileData` prop — out of Phase 3's stated scope (CompanyProfile/tenant/auth/
Login only). Behavior is correct, only wasteful; at MVP scale (0 users) the cost is negligible.

**Pull-forward trigger:**
Settings extraction (Phase 4), or the phase that migrates `UserProfile`/`AgentProfile` — collapse the
duplicate fetch (Settings `user_id` GET vs CompanyProfile `org_id` GET) into the shared query and drop the
orphaned prop flow then.

**Owner:** TBD.

---

## TD-FE-12 — Dead TenantContext.availableTenants/setAvailableTenants after TenantSelection migration

**Date logged:** 2026-05-29
**Origin:** Plan 20 Phase 3 (plans/20-frontend-phase-3-api-data-layer.md), Task 11.

**Current state:**
`TenantContext` (`src/shared/tenant/TenantContext.tsx`, relocated from `src/contexts/` in Phase 10) declares `availableTenants: Tenant[]` state and
`setAvailableTenants`, and exposes both on its context value. After Phase 3, `TenantSelection` (the only
reader/writer) renders from the `useTenants` query instead, so neither is populated or read anymore. They
remain assigned into the context value, so there is no lint/knip break — just permanently dead state.

**Why deferred:**
Removing the field from `TenantContextType` + the provider is a context-API change owned by the shell/auth
phases, not Phase 3 (which only migrates the read pattern). Harmless until then.

**Pull-forward trigger:**
Phase 10 (introduces the real tenant endpoint — it will repopulate `availableTenants` from the API or drop
the field) or Phase 4 (shell extraction). Remove the dead field then.

**Owner:** TBD.

---

## TD-FE-16 — Sidebar export-name twins + `useAuth` name collision

**Date logged:** 2026-05-29
**Origin:** Plan 21b Phase 4b (plans/21b-frontend-phase-4b-shell-extraction.md), Task 5.

**Current state:**
Two name twins remain after the shell extraction:
1. **Sidebar twins.** shadcn's `src/components/ui/sidebar.tsx` exports `SidebarProvider` (line 730) and
   `useSidebar` (line 734) — the same names the app's own sidebar state (`src/features/shell/SidebarContext.tsx`)
   exports. 4b resolves the hazard *at the shell's public surface*: the app hook is re-exported as
   `useAppSidebar` from `@/features/shell`, and the app `SidebarProvider` flows through the shell barrel. The
   **internal** `SidebarContext.tsx` symbol is still named `useSidebar` (internal rename deferred). The
   collision stays *inactive* — nothing imports `useSidebar`/`SidebarProvider` from `@/components/ui/sidebar`.
2. **`useAuth` collision.** `src/shared/auth/AuthContext.tsx` and `src/hooks/useAuth.ts` both export `useAuth`
   with different behavior — the context hook vs. the composed JWT/session hook. `@/shared/auth` exposes the
   *context* `useAuth`; the composed hook stays at `@/hooks/useAuth`. 4b does not worsen this.

**What it should be:**
Rename the internal `SidebarContext.tsx` hook to `useAppSidebar` (and drop the barrel alias) the next time the
shell internals are touched. Rename the composed `hooks/useAuth.ts` to something unambiguous (e.g.
`useSession`) when it finds its final home.

**Pull-forward trigger:**
`useAuth` collision → Phase 10/11, when `hooks/useAuth.ts` is rehomed (Spec 21 §8.2 item 6). Sidebar internal
rename → whenever the shadcn twin becomes active, or the shell internals are next refactored.

**Owner:** TBD.

---

## TD-012 — Apollo connector router: async handlers do blocking Mongo I/O on the event loop

**Date logged:** 2026-05-30
**Origin:** Apollo lead-integration impl review round 1 (`docs/reviews/apollo-lead-integration-backend-impl-review-1.md`, finding E) + the triage synthesis. Deliberately deferred during the post-merge hardening pass on `fix/backend-impl-review-followups` (the other agreed fixes A/B/C/F/H/J landed there).

**Current state:**
In `app/routers/connectors.py`, the Apollo-calling handlers (`POST /connectors/apollo/connect` validation, `GET /connectors/apollo/lists`) are correctly sync `def`, so FastAPI runs them in its threadpool (spec §6 / spec-review F13 — `requests` must not block the event loop). But `POST /connectors/apollo/import`, `POST /connectors/apollo/enrich`, and `GET /connectors/apollo/enrich/status` are `async def` while the work they do before returning is blocking PyMongo I/O (credential read, run-doc create, run-doc read) executed directly on the event loop. `import`/`enrich` also schedule a `BackgroundTask` (the reason they were made async), but the pre-schedule Mongo calls still run inline on the loop; `enrich/status` is a pure blocking Mongo read in an async handler.

**What it should be:**
Either make the blocking handlers sync `def` (FastAPI dispatches them to the threadpool, matching `/connect` and `/lists`; `BackgroundTasks` works fine from a sync handler) or move the connector's Mongo access to an async driver (motor). This is a router-wide concurrency-model decision, not a one-line change, and should be decided once rather than per-handler.

**Why we deferred:**
- 0 live users and single-doc, sub-millisecond Mongo ops — event-loop stall is immaterial at current concurrency.
- The sync/async split was already deliberated in spec-review F13; relitigating the router's concurrency model during a hardening pass would be scope creep on a non-issue.

**What we lose by staying as-is:**
- Under real concurrent load, each `async` handler's inline blocking Mongo call briefly stalls the event loop for all other requests — a latency/throughput ceiling that won't surface until traffic arrives.

**Pull-forward trigger:**
- A pre-launch load/performance pass, or the first measured event-loop contention / p99 latency anomaly traced to blocking I/O in async handlers. Decide sync-handlers-vs-motor for the connector router then, and apply the same lens to any other async handler doing blocking I/O.

**Owner:** TBD.

---

## TD-FE-17 — market-research has no visual-regression baseline (Phase 5 guards with behavioral E2E + Vitest)

**Date logged:** 2026-05-30
**Origin:** Plan 24a Phase 5a (plans/24a-frontend-phase-5a-relocate.md), Task 5.

**Current state:**
The behavioral E2E `e2e/journeys/04-market-research-5-components.spec.ts` deliberately omits pixel screenshots (the 7k-LOC page's rotating loading messages + concurrent independent fetches make full-page snapshots unstable without much heavier mocking). The global 2% `maxDiffPixelRatio` VR config and other journeys' snapshots exist, but **market-research has no VR baseline**. Spec 24 §1.2/§8/R4 assumed 2% VR was the primary parity guard "between every sub-phase"; it is not available for this surface.

**What it should be:**
Phase 5 (5a–5i) guards visual parity with behavioral E2E (`journeys/04`) + Vitest/RTL + `npm run preflight` only — no MR pixel VR. Re-establish a market-research visual-regression baseline **after** Phase 5, once decomposition (5c–5h) has produced stable, individually-mockable components for which screenshot comparison is practical (the `journeys/04` author's "reinstated post-refactor" intent).

**Pull-forward trigger:**
Post-Phase-5, when the decomposed tab/section components are stable enough to snapshot — or earlier if a visual regression slips through behavioral coverage.

**Owner:** TBD.

---

## TD-FE-19 — market-research page still runs raw fetch + localStorage cache (5b page-rewire deferred)

**Date logged:** 2026-05-31
**Origin:** Plan 24b Phase 5b (plans/24b-frontend-phase-5b-data-layer.md), Task 6 — descoped during execution.

**Current state:**
5b built the market-research data layer (feature-local `contracts.ts`, `services/marketResearch.ts`, `hooks/useMarketResearch.ts`, `qk.marketResearchComponent`, MSW handlers) and corrected the E2E mock envelope to `{ status, data }`. But the page itself (`src/features/market-research/pages/MarketResearchPage.tsx`, ~7k LOC) was **not** rewired: it still holds 9 raw `fetch(` sites, the `CACHE_DURATION` 5-min localStorage cache, the `?_cb&_r` cache-busting, and the `save*ToLocalStorage` helpers. The plan's Task 6 Step 1(c) ("delete the server-data `useState`s; the hook now owns that data") was found false during execution: the six data `useState`s are **editable UI state**, not server caches — the per-component fetchers send `data: previousContext` for cascading, responses are reconciled by timestamp-merge (`isTimestampNewer`), and the states carry ~113 `setX` callsites plus full edit-history. The flat hooks model none of this; deleting the states would destroy edit/cascade/timestamp features.

**What it should be:**
The page-level raw `fetch` + localStorage-cache removal moves to **5c (page decomposition)** and **5d–5h (section extraction)**. As each section is extracted to consume `useResearchComponent`/`useRegenerateResearch`, its slice of the editable-state/cascade/timestamp logic moves with it (or is intentionally dropped per its section plan), and the corresponding page `fetch` + cache machinery is deleted then. The data layer existing now already satisfies Spec 24 R3 (hooks precede section conversion).

**Pull-forward trigger:**
5c/5d–5h as each section converts; 24i confirms zero raw `fetch` + zero `CACHE_DURATION` remain in the feature at phase close. Earlier only if the legacy page cache causes a parity/regression issue. See ADR-0004 scope note. — **UPDATE 2026-06-03:** Phase 5 closed (24i) with this gate RELAXED to advisory (CTO pre-launch posture); this item was NOT retired and is carried forward — Phase 7 lead-stream-era mutation pass / Phase 13 audit. See Spec 24 §9 delta 11.

**Owner:** TBD.

---

## TD-FE-20 — market-research trends/scout-chat tab has no e2e behavioral coverage

**Date logged:** 2026-06-01
**Origin:** Plan 24c Phase 5c (plans/24c-frontend-phase-5c-page-decomposition.md), Task 5 — surfaced during the TrendsTab extraction review.

**Current state:**
`frontend/e2e/journeys/04-market-research-5-components.spec.ts` only `page.goto("/your-ai-team/scout/marketintelligence")` and asserts the 5-component market-intelligence load. It never clicks the `trends` (`chatwithscout`) `TabsTrigger` and never lands on the scout-chat surface, nor the `analysis` (`leadstream`) tab. So `journeys/04` is a behavioral parity guard for the **intelligence** tab only — the `trends` and `analysis` branches have no e2e coverage. This gap **pre-dates Phase 5** (the journey never covered those tabs) and was confirmed non-regressive at the 5c TrendsTab extraction (Task 5 verified by tsc + byte-identical lift + the unchanged controlled `TabsTrigger`). Both the spec-compliance and code-quality reviewers judged it LOW / non-blocking for the structural-only move.

**What it should be:**
A small trends-trigger click-through assertion in `journeys/04` (click the `chatwithscout` tab → assert the Scout-chat surface renders) — and ideally an analysis-tab assertion — closing the parity gap on the two legacy-routing tabs. Adding behavioral e2e is out of structural-only 5c scope; the natural home is Phase 7 (customers/scout claim the lead-stream + scout-chat components and migrate their data layer), or sooner if a trends/analysis regression is suspected.

**Pull-forward trigger:**
Phase 7 (scout-chat / lead-stream migration), or earlier if a trends/analysis-tab regression is suspected. Note: this is advisory per the repo's pre-launch gate posture (advisory-over-hard-fail at 0 users) — not a merge blocker for 5c.

**Owner:** TBD.

---

## TD-FE-21 — market-entry edit-write path: GET `/api/ask` with JSON-in-query-params + write-path localStorage + SWOT fake-defaults

**Date logged:** 2026-06-01
**Origin:** Plan 24d Phase 5d impl review round 1 (`docs/reviews/phase-5d-market-entry-impl-review-1.md` findings 2/3/4/6, `docs/reviews/phase-5d-market-entry-impl-synthesis-1.md`). Deferred during the 5d decomposition — 5d converted the market-entry *read* path to `useMarketEntry`; plan Task 4 explicitly scoped the *edit-write* path out ("leave that fetch exactly as-is").

**Current state:**
`MarketEntrySection.tsx`'s `handleMarketEntryFullSaveChanges` (the edit-save handler) retains the legacy `/ask` write pattern, untouched by 5d:
- **GET with JSON in the query string.** It URL-encodes two full JSON objects (`original_json`, `modified_json`) into `URLSearchParams` and sends them as `GET /api/ask?...`. For substantial payloads this risks browser URL-length limits (~2–8 KB), exposes edit data in server access logs / browser history / referrers, and uses GET for a mutation (REST-semantics violation).
- **Write-path `localStorage`.** `localStorage.setItem("market-entry_original_json", ...)` and `"market-entry_modified_json"` write the edit payload to localStorage just before the GET. These are part of the same legacy `/ask` pattern; the read-path localStorage cache was already removed in 5b/5d, but these write-path calls rode along with the preserved fetch. The values are not read anywhere else in the codebase.
- **Hardcoded SWOT fake-defaults.** When `displayData.swotAnalysis` is absent, both `handleModify` and the save handler fall back to `["Strong tech platform"]` / `["Limited local presence"]` / `["Growing market"]` / `["Regulatory changes"]`. If the backend genuinely has no SWOT data, the edit form presents these placeholders as real data and the save handler sends them as the "original" baseline.
- **Container LOC.** The retained edit-write logic (~90 LOC `handleMarketEntryFullSaveChanges` + `displayData` derivation + `handleModify`) is the bulk keeping the `MarketEntrySection.tsx` container at 537 LOC, ~2× the plan's ~150–250 estimate (not a spec violation — spec §6 sets no hard LOC cap).

**What it should be:**
Migrate the market-entry edit-write path to a mutation hook (a `useMutation` POSTing a JSON **body** to the backend, replacing the GET-with-query-params), drop the write-path `localStorage` calls (unused elsewhere), and replace the SWOT fake-defaults with a safe empty-state (`{ strengths: [], weaknesses: [], opportunities: [], threats: [] }`). Extracting the handler into the hook also shrinks the container toward the plan estimate. Backend `/ask` contract should be confirmed against a live call before rewiring (no auto-generated client — per CLAUDE.md polyglot rule).

**Why we deferred:**
- Plan 24d Task 4 explicitly scoped the `/ask` edit-write path out of 5d, which converted only the research read path. Rewiring it during the decomposition would have been a spec deviation and mixed two concerns in one phase.
- A mutation-hook migration is its own coordinated FE (+ backend contract confirmation) change warranting a focused phase, not a drive-by during a structural extraction.

**What we lose by staying as-is:**
- Edit saves can silently fail/truncate for large payloads (URL length), and edit data leaks into logs/history.
- SWOT placeholders can be persisted as a real "original" baseline, corrupting the edit diff sent to `/ask`.
- The container stays larger than the section tree's single-purpose target until the handler is extracted.

**Pull-forward trigger:**
- The market-entry edit-write migration phase (a future 5d+ / Phase 7-era mutation-hook pass), or 24i's phase-close check (zero raw `fetch` + zero `CACHE_DURATION` in the feature — this `/ask` GET is one of the remaining raw fetches; see TD-FE-19). — **UPDATE 2026-06-03:** Phase 5 closed (24i) with this gate RELAXED to advisory (CTO pre-launch posture); this item was NOT retired and is carried forward — Phase 7 lead-stream-era mutation pass / Phase 13 audit. See Spec 24 §9 delta 11.
- Earlier if an edit-save URL-length failure or a SWOT fake-default appearing in saved data is observed.

**Owner:** TBD.

---

## TD-FE-23 — Compliance Analytics cards key on `card.type` but backend emits `chartType`

**Date logged:** 2026-06-02
**Origin:** Plan 24e Phase 5e final holistic impl review — surfaced (not introduced) when `ComplianceVisualCard` was extracted into an isolated, testable unit.

**Current state:**
`ComplianceVisualCard.tsx` (and the original inline code it was lifted from) switches the chart renderer on `card.type` (`"bar-chart"` / `"pie-chart"` / `"line-chart"` / `"timeline"` / `"percentage"`). The live backend (`POST /market-research`, `component_name = "regulatory & compliance highlights"`, confirmed 2026-06-02 against `https://brewra-gtm-intelligence.onrender.com`) returns `visualDataCards[]` whose chart-type field is named **`chartType`**, not `type`. With `card.type === undefined`, every backend card falls through to the `!card.type` icon + the bar-chart-style default render — so the Compliance Analytics section has effectively always rendered its hardcoded default cards rather than the backend's `visualDataCards`. This is **pre-existing** behavior (the container's `visualDataCards = regulatoryData?.visualDataCards || [defaults]` fallback + the `type` switch were byte-identical before 5e); the decomposition only made it visible and unit-testable.

**What it should be:**
Normalize the field in `ComplianceVisualCard` (e.g. `const chartType = card.type ?? card.chartType;` and switch on that), or adapt the shape in `useRegulatoryCompliance` / `regulatoryHelpers` (a `deriveVisualDataCards` mapper). Confirm the exact backend field set first (live `/market-research` call — no auto-generated client per CLAUDE.md). Add a `ComplianceVisualCard` unit test asserting a `chartType`-keyed card renders the right chart once normalized.

**Why we deferred:**
- Out of scope for 5e, whose mandate was a byte-identical structural decomposition (visual parity guarded by behavioral E2E + Vitest, NOT pixel VR) — changing the chart-type resolution would be a behavior change, explicitly disallowed mid-extraction (Plan 24e abort criterion 3).
- It is pre-existing and not a regression; the section renders coherent (default) cards today.

**What we lose by staying as-is:**
- The Compliance Analytics charts show hardcoded defaults instead of the backend's real `visualDataCards`, even when the backend returns populated data.

**Pull-forward trigger:**
- When real `visualDataCards` need to render (pre-launch data-fidelity pass), or the 24i market-research phase-close sweep, or alongside any backend market-research contract typing work.

**Owner:** TBD.

---

## TD-FE-24 — Regulatory default data duplicated across ~5 sites

**Date logged:** 2026-06-02
**Origin:** Plan 24e Phase 5e impl review round 1 (`docs/reviews/phase-5e-regulatory-compliance-impl-review-1.md`, finding #1) + synthesis round 1.

**Current state:**
The hardcoded fallback datasets in the regulatory feature are copy-pasted verbatim across multiple code sites:
- Default **regional data** (EU/US/China/UK rows) and default **visual data cards** (Compliance Adoption Rates / Regulatory Timeline / Risk Indicators) appear in `RegulatoryComplianceSection.tsx` in three places — the render-time `regionalData`/`visualDataCards = regulatoryData?.* || [defaults]` derivations, inside `handleModify`, and inside the init `useEffect`.
- Default **strategic recommendations** lists are hardcoded in `StrategicRecommendationsSection.tsx` non-editing fallbacks (the three `mitigateRegulatoryRisks`/`competitivePositioning`/`goToMarketStrategy` `<li>` blocks).
A default change must be made in 3–5 places simultaneously. This is **pre-existing** (byte-identical to the `master` monolith) and was an explicit Plan 24e Task 2 scope decision (the plan considered lifting `deriveVisualDataCards`/`deriveRegionalData` into `regulatoryHelpers.ts` and declined, to keep the decomposition a pure structural move).

**What it should be:**
A single source for the defaults — a `regulatoryDefaults.ts` constants module (or `deriveVisualDataCards`/`deriveRegionalData`/`deriveStrategicRecommendations` in `regulatoryHelpers.ts`) consumed by every fallback site, with unit tests asserting the default shape.

**Why we deferred:**
- Pre-existing duplication, not introduced by 5e; consolidating it would be a behavior-touching change beyond 5e's byte-identical decomposition mandate (abort criterion 3).
- Plan 24e Task 2 deliberately scoped it out.

**What we lose by staying as-is:**
- A maintenance trap: editing one default and missing the other 2–4 copies yields inconsistent fallbacks across edit/non-edit/init paths.

**Pull-forward trigger:**
- A defaults-consolidation follow-up, or the 24i market-research phase-close sweep, or whenever a regulatory default actually needs to change.

**Owner:** TBD.

---

## TD-FE-25 — Read-only Strategic Recommendations ignores `localStrategicRecommendations` (state-coherence quirk)

**Date logged:** 2026-06-02
**Origin:** Plan 24e Phase 5e impl review round 1 (finding #2) + synthesis round 1.

**Current state:**
`StrategicRecommendationsSection.tsx` renders the three recommendation lists from `regulatoryData?.strategicRecommendations?.{mitigateRegulatoryRisks,competitivePositioning,goToMarketStrategy}` (or hardcoded fallbacks) in **non-editing** mode, and from `localStrategicRecommendations` only in **editing** mode. After a user edits the recommendations and exits edit mode, the read-only view can revert to the API/default data, visually discarding the local edits. This is **pre-existing** and byte-identical to the `master` monolith (verified: read-only read `regulatoryData?.strategicRecommendations?.X` at 3 sites; `localStrategicRecommendations` used only in the edit path). It is also **inconsistent** with `ExecutiveSummarySection`, which correctly falls back through `currentExecutiveSummary = localExecutiveSummary || regulatoryData?.executiveSummary || executiveSummary` in both modes.

**Open question (resolve before fixing):** unlike the five editable string fields (which each have an `on*Change` parent callback), `localStrategicRecommendations` appears to have **no parent-bound change callback**, so strategic edits may never round-trip to the parent/API even via `handleRegulatoryComplianceSaveChanges`. This determines whether the correct fix is "read `localStrategicRecommendations` first in the read-only path" or "wire a persist callback so edits survive a real save+refetch" (or both).

**What it should be:**
Align the read-only fallback chain with `ExecutiveSummarySection` (`local* || regulatoryData?.* || defaults`), and/or wire strategic-recommendation edits to a parent callback so they persist.

**Why we deferred:**
- Pre-existing behavior; changing the read-only data source is a behavior change disallowed mid-decomposition (Plan 24e abort criterion 3 / byte-identical mandate).

**What we lose by staying as-is:**
- Edited strategic recommendations can silently disappear from the read-only view after save; the section behaves inconsistently with the sibling Executive Summary section.

**Pull-forward trigger:**
- Pre-launch data-fidelity pass (alongside TD-FE-23's `visualDataCards`/`chartType` gap — same theme), or the 24i sweep.

**Owner:** TBD.

---

## TD-FE-26 — Dead non-user-scoped `localStorage` writes in RegulatoryComplianceSection

**Date logged:** 2026-06-02
**Origin:** Plan 24e Phase 5e impl review round 1 (finding #4) + synthesis round 1.

**Current state:**
The container runs five effects writing `localStorage.setItem("regulatory_executiveSummary"/"regulatory_euAiActDeadline"/…, value)` — **non-user-scoped** raw keys. But the `useState` initializers read these values via `getUserLocalStorage("regulatory_executiveSummary", currentUser?.uid)` — **user-scoped** keys (a different keyspace). The raw writes can therefore never be read back; they write to dead keys. (The JSON-blob writes for the Scout API at save time correctly use `setUserLocalStorage(..., currentUser?.uid)`.) This is **pre-existing** (5 occurrences on `master`), carried forward byte-identically by 5e.

**What it should be:**
Either route the five write effects through `setUserLocalStorage(key, value, currentUser?.uid)` (so they share the keyspace the initializers read), or delete them if the cache-rehydrate-on-mount behavior isn't wanted. Removing them is behavior-neutral (they're already dead).

**Why we deferred:**
- Pre-existing dead writes, not introduced by 5e; 5e carried the effects forward unchanged as part of the byte-identical decomposition.

**What we lose by staying as-is:**
- Misleading code (five effects that look like they persist editable fields but write to keys nothing reads); minor wasted writes on every edit keystroke.

**Pull-forward trigger:**
- A localStorage/caching cleanup pass or the 24i market-research phase-close sweep.

**Owner:** TBD.

---

## TD-FE-27 — competitor-landscape edit-write path: raw `/api/ask` + `/api/market_intelligence` fetches survive read migration

**Date logged:** 2026-06-02
**Origin:** Plan 24f Phase 5f Task 4. The task converted the competitor-landscape *read* path to `useCompetitorLandscape` (5b TanStack, hook-first with prop + localStorage fallbacks per 5e), and explicitly scoped the *edit-write* path out (mirror 5e/TD-FE-21).

**Current state:**
`CompetitorLandscapeSection.tsx`'s `handleCompetitorLandscapeSaveChanges` (the edit-save handler) retains two raw `fetch` calls, untouched by 5f:
- **`GET /api/ask` (write)** — URL-encodes two full JSON objects (`original_json`, `modified_json`) into `URLSearchParams` and sends them as a GET. Same legacy pattern as TD-FE-21: risks browser URL-length limits, leaks edit data into server access logs / browser history / referrers, and uses GET for a mutation.
- **`GET /api/market_intelligence` (post-save re-read)** — fired only when the `/ask` call succeeds; its response (`competitor_landscape_data`) is written **straight into local component state** (`setLocalExecutiveSummary`/`…TopPlayerShare`/`…EmergingPlayers`), bypassing the TanStack cache the `useCompetitorLandscape` hook now owns.
- These ride alongside write-path `setUserLocalStorage("competitor-landscape_original_json"/"_modified_json", …)` calls.

**Cache-divergence caveat:**
Because the post-save `/market_intelligence` re-read sets local state from a raw fetch (not the query cache), the section's displayed values can **diverge from the TanStack cache** that `useCompetitorLandscape` reads. After a save, local state reflects the raw re-read while `cl.data` still reflects the last `useResearchComponent` POST — until the next regenerate/refetch reconciles them. The section masks this with `justSavedRef`/`savedLocalStateRef` display guards (local state wins immediately after save), but the two sources are not unified.

**What it should be:**
Migrate the edit-write path to a 5b mutation hook (a `useMutation` POSTing a JSON **body**, replacing the GET-with-query-params), and have the post-save reconciliation write through the TanStack cache (e.g. `queryClient.setQueryData` on the competitor component key, mirroring `useRegenerateResearch`) instead of into local component state — so the hook's cache stays the single source of truth. Drop the write-path `localStorage` blobs if unused elsewhere. Confirm the `/ask` + `/market_intelligence` contracts against a live backend first (no auto-generated client — per CLAUDE.md polyglot rule).

**Why we deferred:**
- Plan 24f Task 4 scoped the write path out of the 5f read-migration; rewiring it during the decomposition would mix two concerns and deviate from the 5e-parity mandate.
- A mutation-hook migration + cache-write reconciliation is its own coordinated FE (+ backend contract confirmation) change warranting a focused phase.

**What we lose by staying as-is:**
- Edit saves can silently fail/truncate for large payloads (URL length), and edit data leaks into logs/history.
- Display can diverge from the query cache after a save until the next refetch reconciles.

**Pull-forward trigger:**
- Before 5i's zero-raw-fetch confirmation (spec §11 item 3) — migrate the competitor write path, or 5i's gate explicitly accepts this documented exception (alongside TD-FE-21 for market-entry; see also TD-FE-19). — **UPDATE 2026-06-03:** Phase 5 closed (24i) with this gate RELAXED to advisory (CTO pre-launch posture); this item was NOT retired and is carried forward — Phase 7 lead-stream-era mutation pass / Phase 13 audit. See Spec 24 §9 delta 11.
- Earlier if an edit-save URL-length failure or a visible post-save cache-divergence is observed.

**Owner:** TBD.

---

## TD-FE-28 — Industry-trends page-level fetch/state/cache slice retained in `useMarketResearchData.ts`

**Date logged:** 2026-06-02
**Origin:** Phase 5g Task 8 Step 6b (deferred).

**Current state:**
Industry-trends page-level fetch/state/cache slice retained in `useMarketResearchData.ts` — Phase 5g Task 8 Step 6b deferred. The section now sources its data via `useIndustryTrends` (5b), but the page-level slice is a cascade producer consumed downstream by 5h (market-size) through the `previousContext` chain; removing it before 5h is decomposed would hollow the cascade. The orphaned slice is tsc-safe internal state. Same posture as 5d/5e.

**Why we deferred:**
- The slice is cascade-coupled: it feeds 5h (market-size) via the sequential `previousContext` chain. Removing it before 5h is decomposed would hollow the cascade.

**Pull-forward trigger:**
- When 5h is decomposed (or the cascade is retired), remove the industry-trends slice from `useMarketResearchData.ts`; this also feeds 24i's zero-raw-fetch gate. — **UPDATE 2026-06-03:** Phase 5 closed (24i) with this gate RELAXED to advisory (CTO pre-launch posture); this item was NOT retired and is carried forward — Phase 7 lead-stream-era mutation pass / Phase 13 audit. See Spec 24 §9 delta 11.

**Owner:** TBD.

---

## TD-FE-29 — Full preflight gate stays serial; parallel runner is opt-in (flakes e2e under concurrent-session load)

**Date logged:** 2026-06-02
**Origin:** Preflight perf items 4–5 (follow-on to the merged perf quick-wins). `frontend/scripts/preflight.mjs` parallelizes the gate but is wired as `npm run preflight:par` (opt-in), NOT the default `npm run preflight`.

**Current state:**
Three commands: `npm run preflight` = serial `&&` chain (the merge gate); `npm run verify` = typecheck+lint+test (the fast inner loop); `npm run preflight:par` = full gate parallelized via `scripts/preflight.mjs` (dependency-aware build→bundle/e2e, bounded by `PREFLIGHT_JOBS`, fail-fast). Parallel is opt-in by measurement: it runs build + vitest (4 workers) + e2e + lint concurrently, and stacked on a second worktree's preflight it pushed box load to ~20/23 cores — inflating every task 3–4× and **flaking the e2e visual snapshot** (`02-post-login-state.png`: 86% pixel diff + render timeout), a false failure that would block a merge. In the same back-to-back run the SERIAL gate passed e2e 14/14 at load ~8, isolating the cause to the parallel load-spike, not a regression. Parallel-full only wins on an idle box (~1.5–2×).

**Why we deferred (serial stays the default gate):**
- The team runs concurrent worktree sessions; a gate that's fast solo but flaky-under-concurrency is a net loss — a false e2e failure costs more (a wasted full re-run + investigation) than the serial gate's extra minutes.
- Hardening the VR e2e against contention is its own focused change, separate from the gate-structure work.

**What it should be / pull-forward trigger:**
- Make the VR e2e contention-robust — Playwright retries on the VR specs, a higher `toHaveScreenshot` stabilization timeout, a lower default `PREFLIGHT_JOBS`, or scheduling e2e in its own non-concurrent wave so it never renders under a CPU spike — then flip `preflight` → `preflight:par`. Trigger: the serial merge-gate wall-clock becomes a real bottleneck, or concurrent-worktree development ends (single-session steady state).

**Owner:** TBD.

---

## TD-FE-30 — Market-size page-level fetch/state/cache slice (the cascade ROOT) retained in `useMarketResearchData.ts`

**Date logged:** 2026-06-03
**Origin:** Phase 5h Task 4 Step 2 (deferred — plan `plans/24h-frontend-phase-5h-market-size.md` done-when #5, deferral fallback). Spec §6 assigns each section sub-phase the removal of its page-level raw-`fetch`/cache slice; 5h is the last section, so the plan's default was to remove the market-size slice here.

**Current state:**
`MarketSizeSection` now sources its display data via `useMarketSize` (5b), and the composition layer no longer drills the market-size data slice (the 9 data fields + `MarketIntelligenceTabProps` are gone). But the page-level `marketData` state and its `fetchMarketSizeData` producer in `useMarketResearchData.ts` are **retained** — unlike a leaf slice, this one is the **cascade ROOT**: `fetchMarketSizeData` is the priority-1 producer whose result is threaded as `previousContext` into the four downstream sections (market-entry, regulatory, competitor, industry-trends) that fetch sequentially after it. `marketData` also drives readiness/progress reporting and the `marketIntelligenceData` mirror. Removing it before the cascade itself is retired would hollow the sequential research chain for every other section (abort-criterion-3 cross-section coupling). The retained slice is tsc-safe internal state, no longer drilled to the (now self-fetching) market-size section. Same posture as 5d/5e/5g (TD-FE-19, TD-FE-28), escalated because this slice is the producer the others depend on, not a peer.

**Why we deferred:**
- The slice is the cascade root: its output feeds all four downstream sections via the `previousContext` chain. It cannot be removed section-by-section; it is removed only when the cascade as a whole is retired.

**What it should be:**
- The per-section 5b hooks (or a small orchestration replacement) supply each section's `previousContext` so `useMarketResearchData`'s raw `fetch`/`CACHE_DURATION` cascade can be deleted wholesale, leaving zero raw `fetch`/cache in the feature.

**Pull-forward trigger:**
- 24i's phase-close check (zero raw `fetch` + zero `CACHE_DURATION` in the feature) — this is the last and root remaining slice; 5i/24i must either retire the cascade or explicitly accept it as the documented closing exception (alongside TD-FE-19/28). The market-size slice cannot be removed in isolation before then. — **UPDATE 2026-06-03:** Phase 5 closed (24i) with this gate RELAXED to advisory (CTO pre-launch posture); this item was NOT retired and is carried forward — Phase 7 lead-stream-era mutation pass / Phase 13 audit. See Spec 24 §9 delta 11.

**Owner:** TBD.

---

## TD-FE-31 — Market-size edit-save retains the legacy `/api/ask` GET write path

**Date logged:** 2026-06-03
**Origin:** Phase 5h Task 2 / Task 5 (deferred — plan `plans/24h-frontend-phase-5h-market-size.md` scoped the edit-save path out of 5b: "the `/api/ask` save path is OUT of 5b's scope … kept this phase, flag a TD-FE"). Mirrors TD-FE-21 (the identical market-entry deferral).

**Current state:**
`MarketSizeSection.tsx`'s `handleSave` (the edit-save handler) retains the legacy `/api/ask` write pattern, untouched by 5h:
- **GET with JSON in the query string.** It sends the edit payload to `GET /api/ask?...` (a different endpoint from the 5b `market-research` data layer). For substantial payloads this risks browser URL-length limits, exposes edit data in server access logs / browser history / referrers, and uses GET for a mutation.
- **Write-path `localStorage`.** `setUserLocalStorage("market-size_original_json" / "market-size_modified_json", …)` writes the edit payload to localStorage just before the GET. The read-path cache was retired in 5h; these write-path calls rode along with the preserved `/ask` fetch and are not read anywhere else.

**What it should be:**
Migrate the market-size edit-write path to a mutation hook (a POST with a JSON **body**, replacing the GET-with-query-params), and drop the write-path `localStorage` calls (unused elsewhere). Backend `/ask` contract should be confirmed against a live call before rewiring (no auto-generated client — per CLAUDE.md polyglot rule).

**Why we deferred:**
- The `/api/ask` endpoint is outside 5b's `market-research` data layer; rewiring it during the structural decomposition would have mixed two concerns and changed how edits persist mid-refactor.
- A mutation-hook migration is its own coordinated FE (+ backend contract confirmation) change warranting a focused phase, not a drive-by during a structural extraction.

**Pull-forward trigger:**
- The lead-stream / Phase 7-era mutation-hook pass that migrates the `/ask` edit-write paths, or 24i's phase-close check (this `/ask` GET is one of the remaining raw fetches; see TD-FE-19, TD-FE-21). — **UPDATE 2026-06-03:** Phase 5 closed (24i) with this gate RELAXED to advisory (CTO pre-launch posture); this item was NOT retired and is carried forward — Phase 7 lead-stream-era mutation pass / Phase 13 audit. See Spec 24 §9 delta 11.
- Earlier if an edit-save URL-length failure is observed.

**Owner:** TBD.

---

## TD-FE-33 — ICPManager read migrated to `useICPs`; legacy localStorage-fallback + user_id-mismatch guard dropped

**Date logged:** 2026-06-03
**Origin:** Phase 6 Task 20. The task wired `ICPManager.tsx`'s ICP *read* onto the `useICPs` TanStack Query hook (and swapped its in-file `ICP`/`FitConfidence` types for the canonical `features/mission-control/types` ones). The row→`ICP` mapping + dedup-by-`id` were preserved byte-for-byte; only the source of the rows changed (two raw `fetch` GETs → the query). Writes (CRUD) stay raw `fetch` + optimistic this phase — deferred (mirror TD-FE-19/21/27/31).

**Current state:**
The old imperative loader (`loadCustomerProfileFromBackend`) carried two resilience behaviors that were **consciously dropped** in the migration; the TanStack Query cache is their replacement:
- **Imperative localStorage-fallback-on-backend-error.** On any non-2xx / network failure (and on the "no ICPs in the API response" branch), the loader fell back to reading `customerProfile` from user-scoped localStorage and seeding `icps` from it. It also wrote loaded ICPs back to localStorage for offline access. `useICPs` (via `fetchIcpsRowsForOrg`) returns `[]` on failure with no localStorage fallback, so a backend error now yields the empty state rather than a stale-local-cache view.
- **Cached-profile `user_id`-mismatch guard.** The loader cross-checked the API/localStorage `user_id` against `currentUser.uid` and refused to display another tenant's cached profile. That guard only gated the now-removed localStorage fallback, so it was removed with it.

The cross-component `icpManagerCustomerProfileLoadFinished` dispatch (consumed by `MissionControlPage` to clear its "syncing customer profile" spinner) is **preserved** — re-fired from an effect when the query settles (success or error) or when it is disabled (no authenticated user/org). The load-side `customerProfileSaved` dispatch was **dropped**: no external listener depends on it (the page derives customer-profile completeness from its own backend read, and the `customers` `SuggestedICPCards` sibling does its own `fetchIcpsRowsForOrg` with the localStorage read only as a network-failure fallback). The write-path `customerProfileSaved` dispatches (in `handleSaveICP` / `handleDeleteICP`) are untouched.

**What it should be:**
ICP read sourced purely from the query cache (done). Offline resilience, if reintroduced, belongs in the query layer (e.g. a persisted query client / `placeholderData`) shared by all ICP consumers, not re-implemented imperatively per component. Multi-tenant cache isolation, if it matters pre-scale, belongs in the query-key scoping (already org-scoped via `qk.icps(orgId)`) rather than an ad-hoc `user_id` cross-check.

**Why we deferred:**
- MVP, 0 live users (CLAUDE.md business state) — backend-failure offline resilience and cross-tenant cache-poisoning are low-value pre-launch.
- The parity gate for this task (journey `05-icp-create` + VR `01-mission-control-empty-icp`) exercises the happy read + empty state, not the failure/offline path, so the dropped behaviors are not under test.

**What we lose by staying as-is:**
- A backend outage now shows the empty ICP state instead of the last locally-cached ICPs.
- No per-component `user_id` cross-check on cached ICP data (relies on the org-scoped query key for tenant isolation).

**Pull-forward trigger:**
- When offline resilience becomes a real requirement (a persisted/optimistic query layer for ICPs), or when multi-tenant cache-poisoning becomes a genuine concern (real users sharing a device/browser profile). Also revisit when the ICP *write* path is migrated to a mutation hook (the matching deferral).

**Owner:** TBD.

---

## TD-FE-34 — mission-control write/mutation paths remain raw `fetch`

**Date logged:** 2026-06-04
**Origin:** Phase 6 (Tasks 15, 16, 18, 20, 21). All mission-control WRITES stayed raw `fetch` + optimistic state while only READS migrated to TanStack Query hooks.

**Current state:**
ICP CRUD (`handleSaveICP`/`handleDeleteICP` in `ICPManager`/`IcpWizard` save path), data-source CRUD (`handleSaveSource`/`handleDeleteSource`/`handleUploadLeadCsv` in `DataSourcesManager`), company-profile save (`CompanyProfileForm.handleSave`), and connector approve/deny — all imperative `fetch` with manual `setX` optimism, no mutation hook / cache invalidation discipline. Phase 6 was scoped read-path-only; writes were explicitly deferred to mirror TD-FE-19/21/27/31.

**What it should be:**
`useMutation` (or equivalent) with query-cache invalidation for all write paths, mirroring the read hooks shipped in Phase 6.

**Why we deferred:**
- Phase 6 was explicitly scoped to read-path migration only.
- MVP, 0 live users — stale-cache windows from missing invalidation carry no real cost.

**What we lose by staying as-is:**
- After a write, query cache is not invalidated, so a refetch or navigation may briefly show stale data.
- No centralized error/loading state for mutations; each call site rolls its own.

**Pull-forward trigger:**
Phase 7 ICP-write migration, or Phase 13 (mutation pass), whichever reaches it first.

**Owner:** TBD.

---

## TD-FE-35 — mission-control client-storage bridges retained as-is

**Date logged:** 2026-06-04
**Origin:** Phase 6 (Tasks 15, 16). The `localStorage` company-profile failover and the `sessionStorage` Slack-OAuth-return bridge were relocated unchanged — they are ad-hoc client-storage coupling, not part of the query layer.

**Current state:**
- `localStorage company_profile_{uid}` failover in `CompanyProfileForm`: read/write cache used when the backend call fails; the same pattern Phase 6 dropped from `ICPManager` (TD-FE-33), retained here because the company-profile write path was not migrated this phase.
- `sessionStorage slackSourceToConnect` bridge in `ConnectorApprovals`: the Slack-OAuth-return handoff — the OAuth callback sets this key before redirecting back, and the mount effect reads and clears it.

**What it should be:**
The company-profile failover folded into a persisted query layer (consistent with TD-FE-34's mutation pass); the Slack bridge replaced by proper OAuth-callback routing/state when connectors are wired.

**Why we deferred:**
Parity relocation — works as-is; changing the client-storage coupling belongs with the mutation pass (TD-FE-34) and the connector wiring (TD-FE-39).

**What we lose by staying as-is:**
Continued ad-hoc client-storage coupling; inconsistent resilience model across company-profile vs ICP reads.

**Pull-forward trigger:**
When the company-profile/connector writes migrate to mutations (TD-FE-34) or when offline resilience is reconsidered.

**Owner:** TBD.

---

## TD-FE-36 — `useCompanyProfile` shared-promotion candidate

**Date logged:** 2026-06-04
**Origin:** Phase 6 Task 15 (reused the existing `useCompanyProfile` for the company-profile read in mission-control). A market-research path duplicates equivalent company-profile fetching and lives in a non-shared location.

**Current state:**
`useCompanyProfile` is consumed by both settings and mission-control. A market-research path fetches equivalent company-profile data independently rather than reusing the hook. The hook is not yet in `@/shared/`.

**What it should be:**
`useCompanyProfile` promoted to `@/shared/` once a second+third consumer is confirmed, with the market-research duplicate removed.

**Why we deferred:**
Cross-feature promotion belongs to a later consolidation phase; the two consumers discovered so far don't justify the move yet.

**What we lose by staying as-is:**
The market-research company-profile fetch remains a separate code path, potentially diverging from the canonical hook's caching/error behavior.

**Pull-forward trigger:**
Phase 10/11 (settings/market-research consolidation), or whenever a third consumer confirms the promotion is warranted.

**Owner:** TBD.

---

## TD-FE-37 — `DataSourcesManager` upload helpers shared-extraction deferred

**Date logged:** 2026-06-04
**Origin:** Phase 6 Task 19 (R1 decision: kept the upload pipeline inline in the container rather than extracting it to a shared utility).

**Current state:**
The CSV/lead upload helpers (`uploadCsvBatch`, `validateCsvFormat`, `getLeadImportKind`, `sniffExcelBinarySignature`, drag handlers) live inline in `DataSourcesManager` — tightly coupled to auth/refresh/polling logic. No other consumer exists today.

**What it should be:**
Extracted to a shared upload utility/hook when a second consumer needs CSV ingest.

**Why we deferred:**
No second consumer yet; extraction now would be speculative (R1 from Phase 6 Task 19 design review).

**What we lose by staying as-is:**
If a second upload consumer is added, it will either duplicate the logic or reach into `DataSourcesManager` internals.

**Pull-forward trigger:**
Phase 11, or when a second upload consumer appears.

**Owner:** TBD.

---

## TD-FE-38 — mission-control escape-hatch typings retained

**Date logged:** 2026-06-04
**Origin:** Phase 6 (Tasks 10, 11, 18, 20). The read layer uses loose escape-hatch types because backend response shapes are flexible/unstable and the Render backend was suspended during Phase 6 (confirmed 2026-06-03), preventing live shape verification.

**Current state:**
Loose escape-hatch types in use: `UntypedBackendApiResponse`, `UntypedProfilerIcpRecord`, `UntypedBackendDocument`, plus an `as LeadStreamFileApiRow[]` cast in `services/missionControl.ts` where `.nullish()` zod inference (`string|null|undefined`) doesn't match the interface's `string|undefined`. Carries the TD-FE-9/10 posture.

**What it should be:**
Precise types once backend response shapes are confirmed-live and stabilized.

**Why we deferred:**
Honest given the flexible backend contracts and the suspended service — tightening types against unconfirmed shapes would produce false confidence.

**What we lose by staying as-is:**
TypeScript's guarantees are weakened at the API boundary; runtime shape mismatches surface at render time rather than compile time.

**Pull-forward trigger:**
Phase 13 escape-hatch retyping pass, or when the backend response contracts are frozen and the service is confirmed live.

**Owner:** TBD.

---

## TD-FE-39 — relocated connector cluster is dead code; two `DataSource` shapes not unified

**Date logged:** 2026-06-04
**Origin:** Phase 6 Task 16 (extracted `components/company-profile/ConnectorApprovals.tsx` + `connectorTypes.ts`).

**Current state:**
`ConnectorApprovals.tsx` is 3,060 lines. The file's own JSDoc (line 66) documents: "KNOWN DEAD CODE (TD): the catalog/auth/config/delete dialogs have NO live [entry points] in an earlier refactor. They are preserved here AS-IS (closed -> render ... scope, deferred). The Slack OAuth callback effect DOES still run on mount." The only live path is the Slack-OAuth-return mount effect; all other catalog/add/delete/config/auth-modal handlers are unreachable from any UI trigger and have no test. The feature also defines two un-unified `DataSource` shapes: the read-list shape in `types.ts` (`DataSourceType`/`DataSourceStatus`) vs the connector-catalog shape in `connectorTypes.ts` — deliberately not consolidated because connector writes were deferred.

**What it should be:**
Decide delete-vs-wire for the dead cluster; if kept, unify the `DataSource` shapes and add a Slack-OAuth mount-effect test. The connector WRITE paths, when wired, are part of the TD-FE-34 mutation pass.

**Why we deferred:**
Phase 6 was a parity relocation — deleting or wiring connector functionality is a product decision out of scope. The dead code is at least self-documenting (the JSDoc TD comment).

**What we lose by staying as-is:**
~3,000 lines of dead code in the tree; two `DataSource` shapes that will need reconciling when connectors are wired; no test coverage for the live Slack-OAuth effect.

**Pull-forward trigger:**
When connectors become a real feature (wire + unify + test) or a dead-code sweep (delete).

**Owner:** TBD.

---

## TD-FE-40 — Phase 6 relocated-legacy cleanup nits in mission-control

**Date logged:** 2026-06-04
**Origin:** Phase 6 decompositions (Tasks 19, 20, 21). Known-dead/cosmetic bits that rode along in the parity extraction.

**Current state:**
- `ICPManager._isSaving` — **RESOLVED 2026-06-04** (phase-6 impl-review-1): the unread `useState` + its two `setIsSaving` calls + the now-purposeless `try/finally` wrapper (the `finally` only reset the dead flag) were removed.
- `ICPManager` write handlers carry 21 `console.*` calls — relocated-legacy noise, identical to pre-Phase-6.
- `IcpList.getFitConfidenceBadge` has no `default` branch (returns `undefined` for out-of-union values) — relocated legacy, safe under the `FitConfidence` param type.
- `MissionControlPage.syncingProfilerCustomerProfile` — initialized `false`, only ever set `false` (line 161: `setSyncingProfilerCustomerProfile(false)`; no `true` call anywhere). The Dialog at line 333 is `open={isLoadingProfile || syncingProfilerCustomerProfile}`: the `isLoadingProfile` branch is live; the `syncingProfilerCustomerProfile` branch is a dead overlay — the "Syncing customer profile" text (lines 336–367) can never render.

**What it should be:**
- `_isSaving` state removed — **done** (2026-06-04).
- Console noise cleaned up.
- `getFitConfidenceBadge` given a `default` branch returning `null`.
- `syncingProfilerCustomerProfile` state + all its Dialog branches removed; the Dialog simplified to `open={isLoadingProfile}`.

**Why we deferred:**
Parity refactor doesn't delete relocated legacy; these are below the bar for individual entries.

**What we lose by staying as-is:**
Minor dead state/console noise; the dead Dialog branch is harmless but misleading.

**Pull-forward trigger:**
A mission-control dead-code/console-noise sweep.

**Owner:** TBD.

---

## TD-FE-41 — `SuggestedICPCards` accept/reject/dismiss optimism stays in `localStorage`, not modeled in the TanStack cache

**Date logged:** 2026-06-04
**Origin:** Phase 7 (Task 16). Optimistic UI for accept/reject/dismiss was implemented against `localStorage` (via `suggestedIcpStorage`) rather than as cache-native optimistic updates, because the customers feature introduced TanStack Query usage but the broader cache-native mutation pass is deferred.

**Current state:**
Optimistic accept/reject/dismiss mutations update `localStorage` state directly and rely on a re-read of that state; TanStack Query's `onMutate`/`onError`/`onSettled` optimistic pattern is not used. The cache is invalidated post-mutation rather than speculatively updated.

**What it should be:**
Optimistic updates modeled as cache-native mutations: `onMutate` writes the speculative state into the query cache, `onError` rolls back, `onSettled` invalidates. `localStorage` becomes a persistence layer only, not the source of optimistic truth.

**Why we deferred:**
Parity-first posture for Phase 7; the cache-native optimism pass is a cross-feature concern that belongs in a dedicated phase, not scattered across individual feature extractions.

**What we lose by staying as-is:**
Optimistic UI relies on a `localStorage` read-back rather than a cache write, making the update path harder to trace and test. Rollback on mutation failure is not automatic.

**Pull-forward trigger:**
The cache-native optimism pass / Phase 13.

**Owner:** TBD.

---

## TD-FE-42 — Customers `/icp` + `customer_profile` read overlaps mission-control `useICPs`; two independent read paths with nothing to catch a divergent `/api/icp` shape change

**Date logged:** 2026-06-04
**Origin:** Phase 7 (Tasks 5–7). The customers feature introduced its own `/icp` and `customer_profile` read service + hooks alongside the mission-control `useICPs` hook, which also reads `/api/icp`. No shared contract layer exists to catch a divergent backend shape change.

**Current state:**
`services/customers.ts` + `useCustomerProfile` + `useSuggestedIcps` form one read path for `/icp` and `customer_profile`. `useICPs` in mission-control is a second independent read path for `/api/icp`. Both use the same endpoint but define their own zod schemas independently; a shape change in the backend breaks one without necessarily surfacing in the other's types.

**What it should be:**
A single canonical zod schema + service function for `/api/icp` shared by both consumers, so a shape change is caught at one definition site and propagates to all callers.

**Why we deferred:**
Consolidation would require touching mission-control during a customers-scoped extraction phase — out of scope for Phase 7. Pre-launch velocity posture.

**What we lose by staying as-is:**
Silent divergence risk: a `/api/icp` response shape change may break one consumer but not the other's TypeScript, delaying detection until runtime.

**Pull-forward trigger:**
Phase 9 consolidation / Phase 13.

**Owner:** TBD.

---

## TD-FE-43 — Customers read orchestration retains imperative loader with `localStorage` fetch-cache + `sessionStorage` session-cache + multi-tier fallbacks rather than going cache-native

**Date logged:** 2026-06-04
**Origin:** Phase 7 (Task 11). The `profiler_recommendedICPs` `localStorage` fetch-cache and `missionProfilerSessionCache` session-cache with multi-tier fallback logic were preserved around the service/hook layer in the imperative loader rather than replaced with TanStack Query's native caching.

**Current state:**
The customers read orchestration (wired in Task 11) retains the pre-existing multi-tier cache strategy: `localStorage` as a fetch-cache layer, `sessionStorage` as a session-cache layer, and imperative fallback logic in the loader. TanStack Query is used for surface-level hook wrapping but the underlying fetch-cache strategy is not cache-native.

**What it should be:**
TanStack Query's `staleTime`/`gcTime` configuration replaces the manual `localStorage` + `sessionStorage` cache tiers. The loader becomes a thin hook invocation with no imperative cache management.

**Why we deferred:**
Replacing the multi-tier cache in Phase 7 would be a scope expansion beyond the parity extraction goal. The existing cache strategy is functionally correct even if architecturally layered.

**What we lose by staying as-is:**
Cache invalidation is split across TanStack Query and manual `localStorage`/`sessionStorage` writes, making the read path harder to reason about and test. Cache consistency bugs are harder to diagnose.

**Pull-forward trigger:**
The cache-native read pass / Phase 9.

**Owner:** TBD.

---

## TD-FE-44 — Window-event header→page bridge (`profilerRefresh`/`profilerCreateICP`/`profilerExportData`/`navigateToLeadStream`/`icpAccepted`) is untyped global coupling

**Date logged:** 2026-06-04
**Origin:** Phase 7 (Tasks 2, preserved for parity). The window-event bridge between the header and the customers/mission-control pages was extracted as-is from the legacy code to maintain parity; the events are untyped `CustomEvent` dispatches with no central registry or type-safe listener contract.

**Current state:**
Header actions dispatch `new CustomEvent('profilerRefresh')`, `new CustomEvent('profilerCreateICP')`, `new CustomEvent('profilerExportData')`, `new CustomEvent('navigateToLeadStream')`, and `new CustomEvent('icpAccepted')` on `window`. Pages listen with `window.addEventListener`. Event payload shapes (if any) are not typed; no central registry documents which events exist or which components listen.

**What it should be:**
A typed event-bus or a direct prop/context channel between header actions and page handlers, replacing the untyped `window.CustomEvent` bridge. Event names, payload shapes, and consumer contracts should be statically checkable.

**Why we deferred:**
Parity-first extraction; redesigning the header↔page communication model is a cross-feature architectural change out of scope for Phase 7.

**What we lose by staying as-is:**
Adding, renaming, or removing an event is invisible to TypeScript. A typo in an event name produces a silent no-op. Payload shape mismatches surface only at runtime.

**Pull-forward trigger:**
A typed event-bus / header-action redesign.

**Owner:** TBD.

---

## TD-FE-45 — `ProfilerChatWithHistory` imports the `SignalsContextChat` substrate via the legacy path; Phase 8 relocates the substrate, Phase 9 dedups ProfilerChat↔ScoutChat

**Date logged:** 2026-06-04
**Origin:** Phase 7 (Task 2). `ProfilerChatWithHistory` was relocated into the customers feature but continues to import the `SignalsContextChat` substrate from its pre-Phase-8 location. Phase 8 will move the substrate; Phase 9 will deduplicate `ProfilerChatWithHistory` and `ScoutChatWithHistory`, which are ~90% identical.

**Current state:**
`ProfilerChatWithHistory` imports `SignalsContextChat` from the legacy substrate path. The component is a near-duplicate of `ScoutChatWithHistory` (shared in `docs/TECH_DEBT.md` as a known duplication since pre-Phase-6). No deduplication has been attempted because the substrate relocation and the chat-dedup are sequenced to Phases 8–9.

**What it should be:**
After Phase 8 relocates the `SignalsContextChat` substrate, `ProfilerChatWithHistory` should update its import path. After Phase 9, `ProfilerChatWithHistory` and `ScoutChatWithHistory` should be unified into a single parameterised chat component, eliminating the ~90% duplication.

**Why we deferred:**
Performing the substrate relocation or the chat dedup inside Phase 7 would violate the parity-extraction scope boundary. Both operations are sequenced as dedicated phase work.

**What we lose by staying as-is:**
Divergence risk between the two chat components grows with every fix or feature added to one but not the other. The stale import path will break when Phase 8 moves the substrate if the update is not tracked.

**Pull-forward trigger:**
Phase 8 (import path update) / Phase 9 (deduplication).

**Owner:** TBD.

**Resolved (substrate-relocation part only):** 2026-06-05 (Phase 8). The `SignalsContextChat` substrate was relocated from the legacy `@/components/signals/` path to `src/shared/chat/`, and all importers — including `ProfilerChatWithHistory` (in `src/features/customers/`) — were repointed off the legacy path onto the relocated substrate. The stale-import-path break risk this entry tracked is closed. The `ProfilerChatWithHistory` ↔ `ScoutChatWithHistory` ~90% duplication (the "Phase 9 dedups" half of this entry) remains a separate, still-open concern owned by Phase 9 — see Phase 9's chat-surface dedup scope. Original entry preserved below.

---

## TD-FE-46 — Phase 7 stage-4 behavioral test covers only accept + reject happy paths; optimistic edge-case matrix and fake-timer deadlock unresolved

**Date logged:** 2026-06-04
**Origin:** Phase 7 (Task 16). The `SuggestedICPCards.write.test.tsx` behavioral test was written under a time constraint that required scoping to the two highest-value happy paths; the remaining optimistic edge cases and a fake-timer incompatibility with `apiFetch`'s dynamic JWT import were deferred.

**Current state:**
`SuggestedICPCards.write.test.tsx` covers the accept happy path and the reject happy path only. The following are NOT covered: (1) undo-within-the-5s-window (the dismiss grace-period rollback); (2) the `isRecommendedDeleteNotFound` 404-as-success branch (a 404 on the recommended-ICP delete is treated as success); (3) delete-current optimism (the accept flow that removes the current customer profile); (4) the `customerProfileSaved` window-event listener. Additionally, the reject test uses real timers with a ~6 s wall-clock wait because fake-timers deadlock with `apiFetch`'s dynamic `import("./jwt")` + MSW microtask interplay — adding ~11 s to the suite on every run. This mirrors the trimmed-coverage posture of TD-FE-20.

**What it should be:**
Full optimistic edge-case matrix covered: undo-within-window, 404-as-success branch, delete-current optimism, and the `customerProfileSaved` event listener. The reject test should use fake timers to eliminate the ~11 s wall-clock penalty; this requires resolving the `apiFetch` dynamic-import + MSW microtask deadlock (either by converting the JWT import to static, by hoisting the import outside the fake-timer scope, or by an MSW + fake-timer compatibility shim).

**Why we deferred:**
Pre-launch velocity posture; the two happy paths catch the highest-value regressions. The fake-timer deadlock is a test-infrastructure problem that requires a dedicated investigation, not a quick fix.

**What we lose by staying as-is:**
The undo grace-period, the 404-as-success branch, and the delete-current path are untested — regressions in those flows will not be caught by the suite. The ~11 s real-timer penalty accumulates as the suite grows.

**Pull-forward trigger:**
A behavioral-coverage hardening pass / when the fake-timer + MSW interplay is solved.

---

## TD-FE-55 — `features/tenant/hooks/useTenants.ts` serves a hardcoded `MOCK_TENANTS` list; no real "list tenants" backend endpoint exists

**Date logged:** 2026-06-05
**Origin:** Phase 10 (Task 4). `TenantSelection` was extracted to `features/tenant/` with its `useTenants` hook intact; the hook returns a `MOCK_TENANTS` constant because the backend model is one-org-per-user (`GET /org`) with no multi-tenant listing endpoint.

**Current state:**
`src/features/tenant/hooks/useTenants.ts` exports a hook that returns a hardcoded `MOCK_TENANTS` array. There is no backend endpoint that lists tenants for a user. The product question of whether a tenant-selection page should exist at all (given the one-org-per-user model) is unresolved.

**What it should be:**
Either (a) a real `GET /tenants` (or equivalent) backend endpoint is added and `useTenants` is wired to it, or (b) the `/tenant-selection` route and the `TenantSelection` feature are removed if the product decision is that the app is single-org-per-user. Until that decision is made, the mock data should be clearly labelled as provisional.

**Why we deferred:**
Open product question; implementing or removing the feature requires a product decision on multi-org support that has not been made.

**What we lose by staying as-is:**
The tenant-selection UI shows mock data to real users if the route is ever reached, which would be confusing. The route already exists in `App.tsx` and is reachable post-login.

**Pull-forward trigger:**
Product decision on multi-org support, or a real list-tenants backend endpoint being added.

**Owner:** TBD.

---

## TD-FE-56 — `features/settings/components/AgentProfile.tsx` and `features/scout/components/ScoutDeployment.tsx` are near-duplicate forms

**Date logged:** 2026-06-05
**Origin:** Phase 10 (Task 5). `AgentProfile.tsx` was relocated into `features/settings/components/` during Phase 10; `ScoutDeployment.tsx` remains in the legacy `src/components/settings/` location. Both render agent/deployment configuration forms with substantial structural overlap but no shared base component.

**Current state:**
`src/features/settings/components/AgentProfile.tsx` and `src/features/scout/components/ScoutDeployment.tsx` are near-duplicate form components. They share field layout, save/cancel patterns, and profile-data binding logic but are maintained as independent files with no shared abstraction. (Phase 9 relocated `ScoutDeployment.tsx` from `src/components/settings/` into `features/scout/components/`; the forms are still not unified.)

**What it should be:**
Phase 9 relocated `ScoutDeployment.tsx` into `features/scout/components/` (the relocation half of this item is **done**). The two components should now be evaluated for unification into a single parameterised form component (or a shared form primitive), eliminating the remaining duplication.

**Why we deferred:**
Deduplication requires Phase 9's scout extraction to be complete so the correct home for the unified component is clear. Merging them before Phase 9 would land the result in the wrong directory.

**What we lose by staying as-is:**
Fixes or UI changes to one form must be manually mirrored to the other. Divergence risk grows with every modification.

**Pull-forward trigger:**
Phase 9 relocated the form into `features/scout/` (done); the remaining trigger is a settings/scout form-unification pass.

**Owner:** TBD.

---

## TD-FE-47 — `StrategistWorkspace` relocated as-is; live but large, decomposition + `GET /chat/` deferred

**Date logged:** 2026-06-05
**Origin:** Phase 8 (strategist relocation). `StrategistWorkspace` was moved verbatim into the strategist feature — only the stale handoff annotation was removed — rather than decomposed or rewritten, per the Phase 8 relocation-not-rewrite scope.

**Current state:**
`StrategistWorkspace` now lives at `features/strategist/components/StrategistWorkspace.tsx`, relocated verbatim (the only delta vs. the legacy file is removal of the stale HANDOFF annotation). It is a large live component that makes a raw direct-backend `GET ${BACKEND_BASE_URL}/chat/` fetch, bypassing the `/api` proxy and the `apiFetch` → `enhancedApi` → `authenticatedApi` client stack.

**What it should be:**
Decomposed into smaller components, with the `GET ${BACKEND_BASE_URL}/chat/` fetch moved into a dedicated service/hook routed through the standard client layer rather than a raw inline direct-backend call.

**Why we deferred:**
Phase 8's scope was relocation, not rewrite. The component works as-is; decomposing it or re-routing its fetch is out of the structure-only Phase 8 boundary.

**Pull-forward trigger:**
Phase 13 (monster-file decomposition, Spec 14 §6.2).

**Owner:** TBD.

---

## TD-FE-48 — `deals`/`Deals` naming: `Deals.tsx` is the Strategist page, not a Phase-12 small-page

**Date logged:** 2026-06-05
**Origin:** Phase 8 (strategist relocation). The legacy `Deals.tsx` is in fact the Strategist page; Spec 14 §12 lists it as a Phase-12 small-page, which is stale.

**Current state:**
`Deals.tsx` is the Strategist page and was relocated to `features/strategist/pages/StrategistPage.tsx`. The `/deals` route is retained as a redirect to `/your-ai-team/strategist/workspace`. Spec 14 §12's small-pages-sweep source list still names `Deals.tsx` as Phase-12 territory — stale; it is Phase-8 strategist territory and has already moved.

**What it should be:**
Spec 14 §12 no longer lists `Deals.tsx` among the Phase-12 small pages (it has been claimed by Phase 8). This is a documentation-only correction; the code disposition is already done.

**Why we deferred:**
The §12 phase description is a frozen record of intent (CLAUDE.md spec-driven flow); rather than rewriting it, the divergence is annotated as a Phase 8 delta in Spec 14 and tracked here.

**Pull-forward trigger:**
Spec 14 §12 rescope (doc-only).

**Owner:** TBD.

---

## TD-FE-49 — Signals accepted/rejected `localStorage` is primary state, not cache

**Date logged:** 2026-06-05
**Origin:** Phase 8 (signals relocation). The `signals_<uid>_accepted` / `signals_<uid>_rejected` `localStorage` keys hold the user's accept/reject decisions and are primary state, not a cache layer — so they stay on `localStorage` rather than migrating into the TanStack cache.

**Current state:**
Signal accept/reject decisions persist as `signals_<uid>_accepted` and `signals_<uid>_rejected` in `localStorage`. This is primary, user-owned state (NOT cache), so it is kept on `localStorage`. The read accessor was extracted as `useSignalAcceptance`, but the page's accept/reject write paths remain inline (see TD-FE-53).

**What it should be:**
As-is is correct for the current product scope — `localStorage` is the right home for device-local user decisions. Only a cross-device-sync requirement would change this.

**Why we deferred:**
There is no defect here; the entry exists to record that this `localStorage` usage is intentional primary state and must not be "fixed" into a cache during a data-layer pass.

**Pull-forward trigger:**
A "signal decisions sync across devices" product requirement.

**Owner:** TBD.

---

## TD-FE-50 — `signalsChatContext` sessionStorage handoff is untyped

**Date logged:** 2026-06-05
**Origin:** Phase 8 (signals relocation). The signals → scout/profiler chat handoff writes `sessionStorage.setItem("signalsChatContext", JSON.stringify(...))` with no shared type contract.

**Current state:**
The signals-to-chat handoff serialises an untyped payload via `sessionStorage.setItem("signalsChatContext", JSON.stringify(...))`; the consuming chat surface reads and parses it with no shared TypeScript type describing the shape.

**What it should be:**
A shared, typed contract for the `signalsChatContext` payload (a named interface/type imported by both the producer and consumer), so the handoff shape is statically checkable.

**Why we deferred:**
The untyped handoff works at MVP scale; introducing the shared contract is best done alongside the chat-surface work where both ends are touched.

**Pull-forward trigger:**
When the signals→chat handoff is given a typed contract (deferred beyond Phase 9; Phase 9 chose not to type it to stay behavior-preserving).

**Note:** Phase 9 deliberately did not add the typed contract — the shared-chat dedup was behavior-preserving and typing the handoff is a contract addition beyond that scope.

**Owner:** TBD.

---

## TD-FE-52 — No strategist Playwright/VR journey; coverage is behavioral-only

**Date logged:** 2026-06-05
**Origin:** Phase 8 (strategist relocation). Strategist shipped with Vitest render tests only; no Playwright journey or visual-regression baseline was added (Spec 27 §8 gap).

**Current state:**
Strategist coverage is behavioral-only (Vitest render tests). The workspace is visually rich — a two-panel dashboard plus chat plus a sequence timeline — and has no Playwright end-to-end journey and no pixel/VR baseline.

**What it should be:**
A strategist Playwright journey and a visual-regression baseline covering the two-panel workspace, chat, and sequence timeline, so visual regressions are caught.

**Why we deferred:**
Behavioral-only coverage is the accepted pre-launch advisory-gate default; pixel/VR baselines are added when a surface churns visually or during a dedicated pre-launch VR sweep.

**Pull-forward trigger:**
Strategist visual churn or a pre-launch VR sweep.

**Owner:** TBD.

---

## TD-FE-53 — Signals page data flow NOT migrated to TanStack (Phase 8 was structure-only)

**Date logged:** 2026-06-05
**Origin:** Phase 8 (signals relocation). Phase 8 relocated the signals page structurally but, with user approval, did not migrate its data flow to TanStack Query — the page's optimistic/undo/event-driven flow is the same declarative-migration blocker recorded in TD-FE-19.

**Current state:**
The signals page data flow stays imperative: `loadSignals` is an imperative loader; `signals` is editable `useState` with optimistic add/remove, a 5 s `pendingRejections` undo timer, and an event-driven (`signalsStateChanged`) refetch — all of which resist a declarative `useQuery` (the same blocker as TD-FE-19). The `useFetchSignals` / `useGenerateSignalsBatch` hooks plus `useSignalAcceptance` are pre-positioned but currently UNUSED (advisory knip flags them). Additionally, the `SignalAskResponse` / `FetchSignalsResponse` zod contracts are permissive (`z.object({}).passthrough()`), forcing `as Record<string, unknown>` / `as { signals?: ... }` casts at the consumption sites.

**What it should be:**
A behavior-preserving migration of the signals data flow onto TanStack Query (or a deliberate decision that the optimistic/undo/event-driven flow stays imperative), with the pre-positioned hooks actually wired in and the permissive zod contracts tightened (`answer?` / `response?` / `signals?`) so the consumption-site casts can be removed.

**Why we deferred:**
A behavior-preserving full migration is high-risk on the app's most complex page (optimistic add/remove + undo timer + event-driven refetch); structure-only relocation was chosen with explicit user approval.

**Pull-forward trigger:**
Backend stabilization (TD-FE-13) + a dedicated signals-data-layer migration.

**Owner:** TBD.

---

<!-- TD-FE-60 through TD-FE-63 are Phase 9 entries. They were originally drafted as TD-FE-57–60 in plan 30, but Phase 10 (added 54–56) and Phase 12 (added 57–59) landed on master before Phase 9 merged, so they were renumbered to 60–63 at T13 reconciliation. -->

## TD-FE-60 — No `features/profiler/` folder; Profiler distributed across three areas

**Date logged:** 2026-06-05
**Origin:** Phase 9 (scout + profiler extraction). Spec 30 §1.1 resolved the §3.1 open question: Profiler is **not** extracted into a standalone `features/profiler/` folder.

**Current state:**
Profiler UI is distributed across `features/customers/` (ICP Intelligence, Lead Stream, Profiler Chat), `features/mission-control/` (ICPManager, ICP wizard), and `src/shared/profiler/` (shared merge algorithm). There is intentionally no `src/features/profiler/`.

**What it should be:**
This is an accepted architectural decision, not a defect. A dedicated `features/profiler/` would only be warranted if Profiler grows a standalone, first-class surface that is not naturally co-located with customers or mission-control.

**Why we deferred:**
The asymmetry (Scout has a thin `features/scout/`; Profiler is distributed) is intentional per Spec 30 §1.1. Profiler's UI naturally co-locates with its two host surfaces. Creating a stub `features/profiler/` would add ceremony without co-location benefit.

**Pull-forward trigger:**
Profiler grows a standalone surface that is not naturally customers or mission-control territory.

**Owner:** TBD.

---

## TD-FE-61 — `SignalsChatContext` type name retained after component renamed to `ContextChat`

**Date logged:** 2026-06-05
**Origin:** Phase 9 (Task 1 — rename `SignalsContextChat` → `ContextChat`). The component was renamed but the context-shape type was deliberately left as `SignalsChatContext` to avoid a wide consumer churn.

**Current state:**
`src/shared/chat/ContextChat.tsx` exports the component as `ContextChat` and the context-shape type as `SignalsChatContext`. The type name reflects the old component name and carries a "Signals" prefix that no longer matches the generic shared substrate.

**What it should be:**
The type should be renamed to `ChatContext` (or similar) so the exported type name matches the component name and the generic-substrate framing.

**Why we deferred:**
Renaming the type requires touching all consumers (`SignalsChatContext` is the prop type at every `ContextChat` call site + the `signalsChatContext` sessionStorage key). Phase 9 chose not to widen scope beyond behavior-preserving moves.

**Pull-forward trigger:**
Next time `src/shared/chat` types are touched (e.g. when typing the `signalsChatContext` sessionStorage handoff — TD-FE-50).

**Owner:** TBD.

---

## TD-FE-58 — Artefacts cross-component coupling via untyped `window` CustomEvents

**Current state:**
`features/artifacts/pages/ArtifactsPage.tsx` listens on `window` for `CustomEvent("artifactsSearch")` and `CustomEvent("addArtefact")` (dispatched by the header). The coupling is untyped, global, and hard to test; it should be a typed feature/shared mechanism. Same class of debt as TD-FE-44.

**Why we deferred:**
Out of scope for Phase 12's parity-only relocation (behavior was frozen).

**Pull-forward trigger:**
Artefacts gets real data, or a shared search/event bus lands.

**Owner:** TBD.

## TD-FE-59 — Small-page surfaces are mock/placeholder (no backend)

**Current state:**
`features/{calendar,insights,reports,artifacts}` render hardcoded mock data with no API. They should be wired to real endpoints once those exist.

**Why we deferred:**
These products are not built yet; the pages are placeholder surfaces.

**Pull-forward trigger:**
Each product's backend exists.

**Owner:** TBD.

_Phase 12 note: these entries were authored as provisional TD-FE-47–49 and renumbered to TD-FE-57–59 at the Phase 12 merge, since Phase 8 (47–53) and Phase 10 (54–56) had already landed those integers on master._

---

## TD-FE-64 — CSV smart-quote normalization is a no-op (`normalizeCsvAsciiDoubleQuotes`)

**Date logged:** 2026-06-06
**Origin:** Discovered during the Phase 13b seam-test pass (extraction of `csvHelpers.ts` from `DataSourcesManager`). Pre-existing — the code was moved verbatim; the bug predates Phase 13.

**Current state:**
`frontend/src/features/mission-control/components/data-sources/csvHelpers.ts` (the `normalizeCsvAsciiDoubleQuotes` helper, ~line 11) replaces curly/smart double-quotes with the codepoint U+201D (RIGHT DOUBLE QUOTATION MARK) instead of the ASCII straight double-quote U+0022. The function's own docstring states the intent is to convert curly quotes to ASCII `"` so RFC-4180 quote handling works. Because the replacement target is itself a curly quote, the normalization is effectively a no-op: downstream delimiter detection and quoted-field splitting (which look for U+0022) never see a straight quote, so CSVs containing curly quotes (e.g. Excel/Word exports) can have multiline quoted fields fail to merge and column counts break.

**Why deferred:**
Phase 13b is behavior-preserving structural decomposition only (Spec 32 §5.2). Fixing this is a logic change that alters CSV-parsing behavior and warrants its own deliberate change + validation, not a slip-in during a structural split. The decomposition preserved the (buggy) behavior exactly.

**Fix:**
Change the replacement string in `csvHelpers.ts` from the U+201D character to an ASCII U+0022 `"`; then un-skip the two documenting tests in `__tests__/csvHelpers.test.ts` (added in Phase 13b, commit `0e8ffec`) that already assert the corrected behavior.

**Pull-forward trigger:**
A CSV-import correctness pass, or any report of curly-quoted CSV fields mis-parsing on upload.

**Owner:** TBD.

---

## TD-FE-65 — `useMarketResearchData.ts` decomposition deferred (6,034 LOC monster file)

**Date logged:** 2026-06-07
**Origin:** Phase 13 Stage SELECT picked this as decomposition sub-phase 13d; the 13d seam analysis found no behavior-safe structural seam (Spec 32 §5.3 / plan Task J Step 6).

**Current state:**
`frontend/src/features/market-research/hooks/useMarketResearchData.ts` is one ~6,034-LOC `export function useMarketResearchData(activeTabRef)` (~108 hook calls). A full read found that the editable-state↔`useQuery` coupling (TD-FE-19/21) pervades every cohesive slice: five parallel per-component editable-state clusters, five `fetch*` functions that write those clusters directly, and a loading-phase state machine (`validateAllComponentsHaveFreshData` / `startRenderingPhase`) that **reads the editable data states to decide phase transitions** — that read IS the coupling. Only ~93 LOC of truly pure helpers (`transformReportData`, `formatTimestamp`, `getDefaultRegulatoryData`) are independent of the coupling (~1.5% of the file); the `getInitial*` initializers (~330 LOC) and `saveX` callbacks (~120 LOC) sit on the editable-state initializer/persistence seam and are unsafe to extract.

**Why deferred:**
Phase 13 decomposition is behavior-preserving structural splitting only (Spec 32 §5.2/§5.3). Extracting the entangled clusters requires a data-layer rewrite (separating the server-cache/query layer from the editable draft state) — a logic change, out of scope. Extracting only the ~93 LOC of pure helpers would not move the needle on the monster file and adds import churn for negligible benefit, so the whole file was deferred rather than force a split (this mirrors the Phase 5/8 editable-state-blocks-`useQuery` deferrals).

**Fix (prerequisite then decomposition):**
Resolve TD-FE-19/21 first — move fetch results into a query layer and let editable drafts hydrate FROM it via an explicit reset/merge boundary so the loading-phase computation no longer reads editable data. Once decoupled, the five per-component clusters become independently extractable sub-hooks (`useMarketSizeSection`, `useCompetitorSection`, etc.), and a follow-up decomposition pass can split the file.

**Pull-forward trigger:**
A data-layer pass that resolves TD-FE-19/21, or a renewed effort to reduce this file's size after that decoupling lands.

**Owner:** TBD.

## TD-FE-66 — useDocumentSync cleanup (pre-existing patterns relocated in Phase 13b)

**Date logged:** 2026-06-07
**Origin:** impl-review-2 of Phase 13 (docs/reviews/phase-13-loc-reduction-pass-2-impl-review-2.md + synthesis-2). Pre-existing code relocated verbatim during the 13b DataSourcesManager decomposition; deferred because fixing it is a logic change, out of scope for behavior-preserving decomposition.

**Current state (`frontend/src/features/mission-control/components/data-sources/useDocumentSync.ts`):**
1. `checkProcessingFilesStatus` wraps its body in `setDataSources((cur) => {...})` purely to READ current state, returns `cur` unchanged (forcing an unnecessary re-render), and fires `forEach` + `void (async () => ...)` `checkDocumentStatus` calls with NO concurrency control — N concurrent status checks can race on `setDataSources`. The idiomatic fix is a ref/query-cache read + a concurrency guard.
2. `_isSaving` (~line 48): `const [_isSaving, setIsSaving] = useState(false)` — the value is never read anywhere in the tree (only `setIsSaving` is called by the parent's `handleSaveSource`); the isSaving mechanism is dead state.
3. Debug `console.log` density in this module (~18 calls) — kept verbatim (removing them is a behavior change; thin them in a logging-audit pass).

**Why deferred:** Phase 13 decomposition was behavior-preserving only (Spec 32 §5.2); all three are pre-existing and relocating them verbatim was correct. The hook boundary is now the natural fix site.

**Pull-forward trigger:** the next change that touches `useDocumentSync` (e.g. a data-source processing-status bug, or a render-perf pass), or a TD-FE-19/21 data-layer pass.

## TD-FE-67 — single-page v2 reads still cap items at 500; `total` not surfaced

**Date logged:** 2026-06-08
**Origin:** Spec 34 (frontend v1→v2 API migration). The three migrated reads
(`fetchDataSources`, `fetchSignals`, `fetchSuggestedIcps`) request a single page
(`limit=500`/`10`, `offset=0`) and consume only `items`.

**Current state:** items are still capped at the page `limit`; `total` is present
on the v2 wire but is not extracted, typed, or rendered (no consumer renders a
count). The v1 `count` lie is gone (the FE no longer reads it), but the >500
truncation is exposed-not-eliminated.

**What it should be:** when a count display or a list exceeding 500 rows is
needed, widen the service return types to carry `total` and add either fetch-all
looping or real pagination UX (page controls / infinite scroll), keyed on the
v2 `limit`/`offset`.

**Why deferred:** 0 users; nothing renders a count today; threading an unused
`total` would either break the bare-array consumer or add untyped dead surface
(Spec 34 §2, review synthesis round 1).

**Pull-forward trigger:** a count needs rendering, or an org approaches 500
documents / signals / ICPs.

**Owner:** TBD.

## TD-FE-68 — production routed back through `/api`; cold-start batch margin + residual direct-backend callsites

**Date logged:** 2026-06-13
**Origin:** Scout signal-resilience fix. The Claude signal batch was parallelized
(its four calls now run concurrently, ~40–45s vs the old ~120s sequential),
removing the reason production called Render directly. `transport.ts`
`API_BASE_URL` switched from `BACKEND_BASE_URL` to `/api` for all environments.

**Current state:** the main client stack (`apiFetch`/`buildApiUrl`) now goes
through Vercel's `/api/*` rewrite in production (verified live: `POST
/api/generate-signals-batch_claude` → 200 at ~45s). Two residual gaps:
1. **Cold-start margin.** Vercel's edge gateway times out proxied rewrites at
   ~120s. A warm batch is ~40–45s, but a cold Render free-dyno spin-up (~50s)
   stacked on the batch (~45s) is ~95s — under the ceiling, but only ~25s of
   headroom. A cold start coinciding with a slow Claude/Tavily turn could
   approach a 502.
2. **Residual direct-backend callsites.** Four components still call
   `BACKEND_BASE_URL` directly (streaming `/chat/` in `ChatWithScout` and
   `StrategistWorkspace`, `/ask` in `AIPromptingInterface`, `/profile/company`
   in `RegulatoryComplianceSection`), bypassing `/api` and relying on the
   backend CORS wildcard. Not migrated here.

**What it should be:** keep the whole client surface on `/api`; migrate the four
direct-backend callsites onto the proxy (or an SSE-aware `/api` transport for the
streaming `/chat/` path). If cold-start 502s appear, keep the Render dyno warm
(cron ping / paid plan) or fall an over-ceiling endpoint back to direct-to-Render.

**Why deferred:** 0 users; warm latency is comfortable; the direct callsites are
pre-existing (some streaming, which the current `/api` transport doesn't model)
and out of scope for the batch fix.

**Pull-forward trigger:** a production 502 on a cold-start batch, a paid Render
plan (no spin-down), or migrating the streaming `/chat/` path onto `/api`.

**Owner:** TBD.

---

## TD-FE-69 — per-ICP lead count is stubbed to 0; `SuggestedICPCards` shows "0 leads"

**Date logged:** 2026-06-15
**Origin:** Plan 36 Task 17 (rewrite customers `LeadStream.tsx` to real leads). Task
17 dropped the mock ICP segmentation — real v2 leads carry no `matchedICP` field,
so `getLeadCountForICP` was left as a stub returning `0`. Ref: spec 36 §5.7-A2.

**Current state:** `getLeadCountForICP` in
`frontend/src/features/customers/components/lead-stream/LeadStream.tsx` returns
`0` unconditionally. `SuggestedICPCards.tsx` calls it to populate the "N leads"
badge on each suggested-ICP card — all cards therefore show "0 leads".

**What it should be:** a real per-ICP lead count, derived from a backend endpoint
that can cross-reference leads with ICP criteria and return a count per ICP id.

**Why deferred:** the v2 leads list (`GET /api/v2/leads`) does not carry a
`matchedICP` field; computing a per-ICP count needs a new dedicated endpoint,
which is out of scope for plan 36. A client-side approximation without that
signal would be misleading.

**Pull-forward trigger:** a real per-ICP count endpoint exists on the backend, or
the ICP cards surface is prioritised for accuracy (e.g. a stakeholder demo where
"0 leads" is conspicuous).

**Owner:** TBD.

---

## TD-FE-70 — customers Lead Stream is first-page-only (no pager)

**Date logged:** 2026-06-15
**Origin:** Plan 36 Task 16 (`useLeads` / `fetchLeads`) + spec 36 §5.7-A2.

**Current state:** `useLeads` calls `fetchLeads` which calls `GET /api/v2/leads`
with `firstPageParams(50)` (`limit=50, offset=0`) and renders a flat list in
`LeadStream.tsx`. There is no "load more" button, infinite scroll, or page
controls. Matches the sibling `LeadsTable` single-fetch pattern (market-research).

**What it should be:** paginated / "load more" per spec §5.7-A2. The v2 endpoint
already accepts `limit` and `offset`; the `PaginatedResponse` envelope carries
`total`. A "load more" affordance would fetch the next page and append to the
list.

**Why deferred:** 0 users; no org is near 50 leads; adding pagination UX would be
disproportionate to current scale and out of plan 36 scope.

**Pull-forward trigger:** an org's lead count approaches or exceeds 50, or real
users land and the truncated list is noticed.

**Owner:** TBD.

---

## TD-FE-71 — signal↔lead map prompt matches on data the payload doesn't send

**Date logged:** 2026-06-15
**Origin:** Plan 36 (signal↔lead relevance mapping). Impl-review round 1,
finding 1. Ref: `docs/reviews/phase-36-signal-lead-mapping-impl-synthesis-1.md`.

**Current state:** `_signals_for_prompt` in
`backend/app/services/signals/lead_map.py` serializes only `{signal_id,
headline}` per signal, but the `signals_lead_map.md.j2` MATCHING RULES instruct
the model to match on "an explicit company mention in the signal" — those
mentions live in the signal's `description`/`snippet`/`sourceLabel`, none of
which are sent. The model is therefore restricted to headline-only matching;
prompt and payload disagree. No error and id hygiene is unaffected (invented ids
are still dropped) — a recall-quality gap, not a defect.

**What it should be:** prompt and payload agree — either narrow the MATCHING
RULES to headline-only (a 1-line prompt edit) or extend `_signals_for_prompt` to
include a trimmed `snippet`/`description` slice so company mentions are actually
available to match on.

**Why deferred:** 0 users; the MVP Business State explicitly waives
relevance-quality SLAs; and signal headlines routinely carry the company name,
so headline matching already partially satisfies the rule. Tuning recall before
there is real signal/lead data to measure against is premature.

**Pull-forward trigger:** the first relevance-quality tuning pass against real
signals + leads, or a report that the mapping misses obvious company matches.

**Owner:** TBD.

---

## TD-FE-72 — signal↔lead map `refresh` escape hatch is unreachable from the UI

**Date logged:** 2026-06-15
**Origin:** Plan 36 (signal↔lead relevance mapping). Impl-review round 1, finding
2 (refresh half); spec 36 §5.4. Ref:
`docs/reviews/phase-36-signal-lead-mapping-impl-synthesis-1.md`.

**Current state:** `useSignalLeadMap` calls `fetchSignalLeadMap(userId, orgId)`
with no opts, so the request always sends `refresh: false`, and no UI surfaces a
recompute action. The backend `refresh=true` path (force a recompute past the
per-(org, user) fingerprint cache) is therefore inert end-to-end. A cached
mapping — including a structurally-truncated partial recovered by
`_recover_mapping_entries` — is served on every fingerprint hit and cannot be
busted from the FE until the org's signal/lead id-set changes (edits to lead
fields, with no id change, also do not bust it).

**What it should be:** a recompute/refresh affordance on a surface that shows the
mapping, calling `fetchSignalLeadMap(userId, orgId, { refresh: true })`, per spec
36 §5.4's escape-hatch intent.

**Why deferred:** 0 users; a mapping that is stale until the id-set changes is
low-impact at MVP; a refresh control is a FE feature beyond plan 36's mapping
scope. (Caching the recovered partial is itself intentional degrade-gracefully
behavior — see the synthesis; the gap is the missing FE recompute, not the
cache.)

**Pull-forward trigger:** the first real org reports a stale or low-quality
mapping that will not self-correct, or the mapping surfaces are prioritised for a
demo.

**Owner:** TBD.
