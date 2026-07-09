# Brewra — Technical Debt Register

Running list of debt items the team has consciously accepted. Each entry: what was done, what should be done, why we deferred, and the trigger that should pull it forward.

Numbering is preserved across resolutions — TD-001/002/003 (resolved by Phases E and F) were removed on 2026-05-23; their IDs are not reused so commit/spec references stay traceable. TD-006 (market_scoring callers recomputing len(leads)) was resolved 2026-05-24 by Phase H Task 4. TD-007 (Phase G plan-verbatim cosmetic cruft) was resolved 2026-05-25 by Phase I commit 11/11. TD-008 (backend LOC reduction) and TD-009 (docstring/comment drift) were resolved 2026-05-25 by Phase L (audit + 7 K-tasks + I2 promotion, commit `7f169f9`). TD-010 (prompt management overhaul) was resolved 2026-05-26 by plan-13 (Phase 0 audit + render/registry infrastructure + 6 service migrations, commits `5238fb7..1c94e29`); the resolved entry is retained below with original context preserved. TD-011 (stale Claude Sonnet model pin) was resolved 2026-06-15 — `backend/app/core/config.py` now defaults to `claude-sonnet-4-6` (the Render `CLAUDE_SONNET_MODEL` env matches); the resolved entry is retained below with original context preserved. TD-005 (v1 `count`-as-page-size envelope) and TD-012 (Apollo connector router doing blocking Mongo I/O on the event loop) were both resolved 2026-06-16 by Phase 37 (commits `77c7e9d`, `7fe2818`); their resolved entries are retained below with original context preserved. TD-013 (`connect_user_to_org` reverse-uniqueness TOCTOU) was resolved 2026-07-07 — obviated by ADR-0009, which deliberately dropped reverse-uniqueness (commit `7e7216d8`), so the scan the race depended on no longer exists; its entry was moved to `docs/TECH_DEBT_ARCHIVE.md`.

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
| TD-FE-9 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-9--phase-2a-escape-hatches-threshold-reached-6-entries) |
| TD-FE-10 | open | [below](#td-fe-10--phase-2b-escape-hatches-threshold-reached-5-new-entries) |
| TD-FE-11 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-11--orphaned-settings-company-profile-fetch-after-companyprofile-tanstack-migration) |
| TD-FE-12 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-12--dead-tenantcontextavailabletenantssetavailabletenants-after-tenantselection-migration) |
| TD-FE-13 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-13--repoint-hardcoded-backend-host-backend-11kr--brewra-gtm-intelligence) |
| TD-FE-14 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-14--knip-ignore-on-srcsharedcomponents-until-phase-5-consumes-featureerrorboundary) |
| TD-FE-15 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-15--cross-feature-index-only-lint-enforcement-deferred-zone-boundaries-only) |
| TD-FE-16 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-16--sidebar-export-name-twins--useauth-name-collision) |
| TD-FE-17 | open | [below](#td-fe-17--market-research-has-no-visual-regression-baseline-phase-5-guards-with-behavioral-e2e--vitest) |
| TD-FE-18 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-18--market-research-dead-code-8-files-no-live-importer-awaiting-the-5i-sweep) |
| TD-FE-19 | open | [below](#td-fe-19--market-research-page-still-runs-raw-fetch--localstorage-cache-5b-page-rewire-deferred) |
| TD-FE-20 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-20--market-research-trendsscout-chat-tab-has-no-e2e-behavioral-coverage) |
| TD-FE-21 | open | [below](#td-fe-21--market-entry-edit-write-path-get-apiask-with-json-in-query-params--write-path-localstorage--swot-fake-defaults) |
| TD-FE-22 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-22--marketentrysection-owns-a-data-fetch-but-has-no-featureerrorboundary-wrapping) |
| TD-FE-23 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-23--compliance-analytics-cards-key-on-cardtype-but-backend-emits-charttype) |
| TD-FE-24 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-24--regulatory-default-data-duplicated-across-5-sites) |
| TD-FE-25 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-25--read-only-strategic-recommendations-ignores-localstrategicrecommendations-state-coherence-quirk) |
| TD-FE-26 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-26--dead-non-user-scoped-localstorage-writes-in-regulatorycompliancesection) |
| TD-FE-27 | open | [below](#td-fe-27--competitor-landscape-edit-write-path-raw-apiask--apimarket_intelligence-fetches-survive-read-migration) |
| TD-FE-28 | open | [below](#td-fe-28--industry-trends-page-level-fetchstatecache-slice-retained-in-usemarketresearchdatats) |
| TD-FE-29 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-29--full-preflight-gate-stays-serial-parallel-runner-is-opt-in-flakes-e2e-under-concurrent-session-load) |
| TD-FE-30 | open | [below](#td-fe-30--market-size-page-level-fetchstatecache-slice-the-cascade-root-retained-in-usemarketresearchdatats) |
| TD-FE-31 | open | [below](#td-fe-31--market-size-edit-save-retains-the-legacy-apiask-get-write-path) |
| TD-FE-32 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-32--feature-phase-number-disagreement-master-spec-14-4-vs-featuresreadme-naming-map) |
| TD-FE-33 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-33--icpmanager-read-migrated-to-useicps-legacy-localstorage-fallback--user_id-mismatch-guard-dropped) |
| TD-FE-34 | open | [below](#td-fe-34--mission-control-writemutation-paths-remain-raw-fetch) |
| TD-FE-35 | open | [below](#td-fe-35--mission-control-client-storage-bridges-retained-as-is) |
| TD-FE-36 | open | [below](#td-fe-36--usecompanyprofile-shared-promotion-candidate) |
| TD-FE-37 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-37--datasourcesmanager-upload-helpers-shared-extraction-deferred) |
| TD-FE-38 | open | [below](#td-fe-38--mission-control-escape-hatch-typings-retained) |
| TD-FE-39 | open | [below](#td-fe-39--relocated-connector-cluster-is-dead-code-two-datasource-shapes-not-unified) |
| TD-FE-40 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-40--phase-6-relocated-legacy-cleanup-nits-in-mission-control) |
| TD-FE-41 | open | [below](#td-fe-41--suggestedicpcards-acceptrejectdismiss-optimism-stays-in-localstorage-not-modeled-in-the-tanstack-cache) |
| TD-FE-42 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-42--customers-icp--customer_profile-read-overlaps-mission-control-useicps-two-independent-read-paths-with-nothing-to-catch-a-divergent-apiicp-shape-change) |
| TD-FE-43 | open | [below](#td-fe-43--customers-read-orchestration-retains-imperative-loader-with-localstorage-fetch-cache--sessionstorage-session-cache--multi-tier-fallbacks-rather-than-going-cache-native) |
| TD-FE-44 | open | [below](#td-fe-44--window-event-headerpage-bridge-profilerrefreshprofilercreateicpprofilerexportdatanavigatetoleadstreamicpaccepted-is-untyped-global-coupling) |
| TD-FE-45 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-45--profilerchatwithhistory-imports-the-signalscontextchat-substrate-via-the-legacy-path-phase-8-relocates-the-substrate-phase-9-dedups-profilerchatscoutchat) |
| TD-FE-46 | open | [below](#td-fe-46--phase-7-stage-4-behavioral-test-covers-only-accept--reject-happy-paths-optimistic-edge-case-matrix-and-fake-timer-deadlock-unresolved) |
| TD-FE-47 | open | [below](#td-fe-47--strategistworkspace-relocated-as-is-live-but-large-decomposition--get-chat-deferred) |
| TD-FE-48 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-48--dealsdeals-naming-dealstsx-is-the-strategist-page-not-a-phase-12-small-page) |
| TD-FE-49 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-49--signals-acceptedrejected-localstorage-is-primary-state-not-cache) |
| TD-FE-50 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-50--signalschatcontext-sessionstorage-handoff-is-untyped) |
| TD-FE-51 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-51--componentsmarket-research-retains-scoutchatpaneltsx--typests-legacy-residue) |
| TD-FE-52 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-52--no-strategist-playwrightvr-journey-coverage-is-behavioral-only) |
| TD-FE-53 | open | [below](#td-fe-53--signals-page-data-flow-not-migrated-to-tanstack-phase-8-was-structure-only) |
| TD-FE-54 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-54--libjwtts--hooksuseauthts-still-live-in-legacy-srclibsrchooks-rather-than-sharedauth) |
| TD-FE-55 | resolved | [below](#td-fe-55--featurestenanthooksusetenantsts-serves-a-hardcoded-mock_tenants-list-no-real-list-tenants-backend-endpoint-exists) |
| TD-FE-56 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-56--featuressettingscomponentsagentprofiletsx-and-featuresscoutcomponentsscoutdeploymenttsx-are-near-duplicate-forms) |
| TD-FE-57 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-57--phase-12-features-still-import-legacy-hooksusepagetitle) |
| TD-FE-58 | open | [below](#td-fe-58--artefacts-cross-component-coupling-via-untyped-window-customevents) |
| TD-FE-59 | open | [below](#td-fe-59--small-page-surfaces-are-mockplaceholder-no-backend) |
| TD-FE-60 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-60--no-featuresprofiler-folder-profiler-distributed-across-three-areas) |
| TD-FE-61 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-61--signalschatcontext-type-name-retained-after-component-renamed-to-contextchat) |
| TD-FE-62 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-62--srcutilsleadstreamchatcontextts-remains-in-utils) |
| TD-FE-63 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-63--componentsmarket-research-retains-6-files-after-phase-9s-partial-drain) |
| TD-FE-64 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-64--csv-smart-quote-normalization-is-a-no-op-normalizecsvasciidoublequotes) |
| TD-FE-65 | open | [below](#td-fe-65--usemarketresearchdatats-decomposition-deferred-6034-loc-monster-file) |
| TD-FE-66 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-66--usedocumentsync-cleanup-pre-existing-patterns-relocated-in-phase-13b) |
| TD-FE-67 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-67--single-page-v2-reads-still-cap-items-at-500-total-not-surfaced) |
| TD-FE-68 | open | [below](#td-fe-68--production-routed-back-through-api-cold-start-batch-margin--residual-direct-backend-callsites) |
| TD-FE-69 | open | [below](#td-fe-69--per-icp-lead-count-is-stubbed-to-0-suggestedicpcards-shows-0-leads) |
| TD-FE-70 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-70--customers-lead-stream-is-first-page-only-no-pager) |
| TD-FE-71 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-71--signallead-map-prompt-matches-on-data-the-payload-doesnt-send) |
| TD-FE-72 | resolved | [archive](TECH_DEBT_ARCHIVE.md#td-fe-72--signallead-map-refresh-escape-hatch-is-unreachable-from-the-ui) |
| TD-FE-73 | open | [below](#td-fe-73--signal-lead-map_claude-fe-contract-derived-from-code-not-a-live-response) |
| TD-FE-74 | open | [below](#td-fe-74--usedocumentsync-keeps-a-no-op-setissaving-shim-and-8-dead-datasourcesmanager-call-sites) |
| TD-FE-75 | open | [below](#td-fe-75--settingspage-page-level-loading-gate-dropped-with-the-orphan-company-fetch) |
| TD-FE-76 | open | [below](#td-fe-76--settings-profile-reads-bypass-the-apifetch-transport-and-rate-limiter) |
| TD-FE-77 | open | [below](#td-fe-77--signal-briefings-delivered-to-the-artefacts-library-do-not-survive-navigation) |
| TD-FE-78 | partial | [below](#td-fe-78--shared-pdf-generator-emits-structurally-non-compliant-output-and-mojibakes-non-winansi-glyphs) |
| TD-FE-79 | partial | [below](#td-fe-79--internal-admin-endpoints-firebase-verified-resolved-reused-endpoints-remain-open) |
| TD-FE-80 | open | [below](#td-fe-80--frontend-npm-dependency-vulnerabilities-71-open-dependabot-advisories) |

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

**Status:** ✅ RESOLVED 2026-06-16 (Phase 37) — the deprecated v1 `/user-documents` and `/fetch-signals` routes (the only two carrying the capped-`count` envelope) were deleted; the `count`-lie wire field is gone with them, and consumers read the v2 `PaginatedResponse` `total`. Commit `77c7e9d`. Original context retained below.

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

**Correction (2026-06-27 audit):** the file is now `src/shared/types/escape-hatches.ts` (moved from `src/lib/types/` in the Phase-10 `shared/` reorg) and holds exactly 14 `export type Untyped* = any` aliases today — no growth, no progress since logging. TD-FE-9 (the original 6 Wave-B aliases) is a strict subset of these 14 and was archived as superseded; **this entry is now the single umbrella for all 14 aliases** (removes the prior double-counting). The real fix is still gated on typed backend contracts; the aliases are consumed across ~20 modules.

**Owner:** TBD.

---

## TD-012 — Apollo connector router: async handlers do blocking Mongo I/O on the event loop

**Status:** ✅ RESOLVED 2026-06-16 (Phase 37) — the blocking Apollo handlers (`/connectors/apollo/import`, `/enrich`, `/enrich/status`) were converted from `async def` to sync `def` so FastAPI dispatches them to the threadpool instead of running blocking PyMongo I/O on the event loop; `BackgroundTasks` still works from the sync handlers. Commit `7fe2818`. Original context retained below.

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

**Correction (2026-06-27 audit):** `MarketResearchPage.tsx` was subsequently decomposed in Phase 5; the raw-`fetch` + `CACHE_DURATION` localStorage cache + `save*ToLocalStorage` machinery this entry describes now lives in `hooks/useMarketResearchData.ts` (~6,072 LOC — see TD-FE-65), not in a ~7k-LOC page component. The substance (9 raw `fetch` sites + 5-min localStorage cache + cascade) is unchanged; only its location moved.

**What it should be:**
The page-level raw `fetch` + localStorage-cache removal moves to **5c (page decomposition)** and **5d–5h (section extraction)**. As each section is extracted to consume `useResearchComponent`/`useRegenerateResearch`, its slice of the editable-state/cascade/timestamp logic moves with it (or is intentionally dropped per its section plan), and the corresponding page `fetch` + cache machinery is deleted then. The data layer existing now already satisfies Spec 24 R3 (hooks precede section conversion).

**Pull-forward trigger:**
5c/5d–5h as each section converts; 24i confirms zero raw `fetch` + zero `CACHE_DURATION` remain in the feature at phase close. Earlier only if the legacy page cache causes a parity/regression issue. See ADR-0004 scope note. — **UPDATE 2026-06-03:** Phase 5 closed (24i) with this gate RELAXED to advisory (CTO pre-launch posture); this item was NOT retired and is carried forward — Phase 7 lead-stream-era mutation pass / Phase 13 audit. See Spec 24 §9 delta 11.

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

**Correction (2026-06-27 audit):** the literal `company_profile_${uid}` localStorage key actually lives in `DataSourcesManager.tsx:40` (reading `companyName`/`companyUrl`), not in `CompanyProfileForm`. `CompanyProfileForm` carries a *separate* failover keyed `companyProfile` (via `getUserLocalStorage`, guarded by `localProfile.user_id === userId`). So there are **three** client-storage bridges here, not two: the DataSourcesManager `company_profile_` read, the CompanyProfileForm `companyProfile` failover, and the ConnectorApprovals `slackSourceToConnect` session bridge.

**Owner:** TBD.

---

## TD-FE-36 — `useCompanyProfile` shared-promotion candidate

**Date logged:** 2026-06-04
**Origin:** Phase 6 Task 15 (reused the existing `useCompanyProfile` for the company-profile read in mission-control). A market-research path duplicates equivalent company-profile fetching and lives in a non-shared location.

**Current state:**
`useCompanyProfile` now lives in `@/shared/company-profile` with all consumers (settings, mission-control) repointed onto the shared hook — the shared-promotion + consumer-repoint half is done. The only remaining residue is the market-research duplicate company-profile fetch inside the imperative `smartRefresh` in `useMarketResearchData.ts`, which still fetches equivalent company-profile data independently rather than reusing the shared hook. Removing that duplicate is blocked on the data-layer split (Spec 38 / TD-FE-19/65): the fetch is entangled with the editable-state↔query coupling that pervades `useMarketResearchData.ts`.

**What it should be:**
The market-research `smartRefresh` company-profile duplicate fetch removed, reusing the shared `@/shared/company-profile` hook so all company-profile reads share one caching/error path.

**Why we deferred:**
The hook promotion itself is done; the remaining MR duplicate-fetch removal cannot land without the editable-state↔query decomposition (TD-FE-19/65) that blocks every `useMarketResearchData.ts` slice.

**What we lose by staying as-is:**
The market-research company-profile fetch remains a separate code path, potentially diverging from the canonical shared hook's caching/error behavior.

**Pull-forward trigger:**
With Spec 38 (the data-layer split that resolves TD-FE-19/65) — the MR duplicate-fetch removal lands once the editable-state↔query coupling is decomposed.

**Owner:** TBD.

**Resolved (Phase 37, partial):** the shared-promotion + consumer-repoint half is done (useCompanyProfile is in @/shared/company-profile). The remaining MR duplicate-fetch removal is blocked on the editable-state↔query decomposition (TD-FE-19/65) and is reclassified accordingly. Pull-forward: with Spec 38.

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
`ConnectorApprovals.tsx` is ~801 lines (was 3,060 when this was logged; reduced ~73% by Phase 13's `ConnectorApprovals` decomposition — figure corrected 2026-06-27). The file's own JSDoc documents: "KNOWN DEAD CODE (TD): the catalog/auth/config/delete dialogs have NO live [entry points] in an earlier refactor. They are preserved here AS-IS (closed -> render ... scope, deferred). The Slack OAuth callback effect DOES still run on mount." The only live path is the Slack-OAuth-return mount effect; all other catalog/add/delete/config/auth-modal handlers are unreachable from any UI trigger and have no test. The feature also defines two un-unified `DataSource` shapes: the read-list shape in `types.ts` (`DataSourceType`/`DataSourceStatus`) vs the connector-catalog shape in `connectorTypes.ts` — deliberately not consolidated because connector writes were deferred.

**What it should be:**
Decide delete-vs-wire for the dead cluster; if kept, unify the `DataSource` shapes and add a Slack-OAuth mount-effect test. The connector WRITE paths, when wired, are part of the TD-FE-34 mutation pass.

**Why we deferred:**
Phase 6 was a parity relocation — deleting or wiring connector functionality is a product decision out of scope. The dead code is at least self-documenting (the JSDoc TD comment).

**What we lose by staying as-is:**
a dead connector cluster (now the bulk of the ~801-LOC file, post Phase-13 decomposition); two `DataSource` shapes that will need reconciling when connectors are wired; no test coverage for the live Slack-OAuth effect.

**Pull-forward trigger:**
When connectors become a real feature (wire + unify + test) or a dead-code sweep (delete).

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

**Resolved (2026-07-03):** Spec 46 WS1 (org/tenant reunification) resolved the open product question as option (b) — the app is single-org-per-user (`GET /org` is authoritative via `useOrgId()`). `features/tenant/` (including this hook and the `/tenant-selection` route) was deleted wholesale; `shared/tenant/` (the `TenantProvider`/`useTenant` context it depended on) was deleted alongside it. No mock-data-to-real-users risk remains because the surface no longer exists.

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

## TD-FE-65 — `useMarketResearchData.ts` decomposition deferred (6,034 LOC monster file)

**Date logged:** 2026-06-07
**Origin:** Phase 13 Stage SELECT picked this as decomposition sub-phase 13d; the 13d seam analysis found no behavior-safe structural seam (Spec 32 §5.3 / plan Task J Step 6).

**Current state:**
`frontend/src/features/market-research/hooks/useMarketResearchData.ts` is one ~6,034-LOC `export function useMarketResearchData(activeTabRef)` (~108 hook calls). A full read found that the editable-state↔fetch-cascade coupling (TD-FE-19/21) pervades every cohesive slice (note: the hook itself has **no** `useQuery` — the TanStack queries live in the section components; the coupling is editable-state ↔ imperative fetch-cascade ↔ loading-phase machine): five parallel per-component editable-state clusters, five `fetch*` functions that write those clusters directly, and a loading-phase state machine (`validateAllComponentsHaveFreshData` / `startRenderingPhase`) that **reads the editable data states to decide phase transitions** — that read IS the coupling. Only ~93 LOC of truly pure helpers (`transformReportData`, `formatTimestamp`, `getDefaultRegulatoryData`) are independent of the coupling (~1.5% of the file); the `getInitial*` initializers (~330 LOC) and `saveX` callbacks (~120 LOC) sit on the editable-state initializer/persistence seam and are unsafe to extract.

**Why deferred:**
Phase 13 decomposition is behavior-preserving structural splitting only (Spec 32 §5.2/§5.3). Extracting the entangled clusters requires a data-layer rewrite (separating the server-cache/query layer from the editable draft state) — a logic change, out of scope. Extracting only the ~93 LOC of pure helpers would not move the needle on the monster file and adds import churn for negligible benefit, so the whole file was deferred rather than force a split (this mirrors the Phase 5/8 editable-state-blocks-`useQuery` deferrals).

**Fix (prerequisite then decomposition):**
Resolve TD-FE-19/21 first — move fetch results into a query layer and let editable drafts hydrate FROM it via an explicit reset/merge boundary so the loading-phase computation no longer reads editable data. Once decoupled, the five per-component clusters become independently extractable sub-hooks (`useMarketSizeSection`, `useCompetitorSection`, etc.), and a follow-up decomposition pass can split the file.

**Pull-forward trigger:**
A data-layer pass that resolves TD-FE-19/21, or a renewed effort to reduce this file's size after that decoupling lands.

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

**Correction (2026-06-27 audit):** only **two** residual direct-backend callsites remain, both streaming `/chat/` (`ChatWithScout` + `StrategistWorkspace`). The `/ask` (`AIPromptingInterface`) and `/profile/company` (`RegulatoryComplianceSection`) callsites listed above have since moved onto `buildApiUrl`/`/api` (a grep for ``BACKEND_BASE_URL}/(ask|profile)`` now returns nothing). The two streaming holdouts need an SSE-aware `/api` transport; the cold-start-margin half is unchanged.

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

## TD-FE-73 — `/signal-lead-map_claude` FE contract derived from code, not a live response

**Date logged:** 2026-06-15
**Origin:** Plan 36 (signal↔lead relevance mapping). `POST /signal-lead-map_claude`
was not deployed when the FE contract was written, so `SignalLeadMapResponseSchema`
(`frontend/src/features/signals/contracts.ts`) was derived from the backend's
code-defined response envelope rather than a captured live response. Ref: plan 36
Task 11 step 5.

**Current state:** the zod contract is deliberately tolerant (`.passthrough()` /
nullish / `.catch()` / `.default()`), so a shape drift degrades quietly instead of
throwing — which also means a mismatch between the contract and the real deployed
response could go unnoticed. No live-shape capture has confirmed the envelope.

**What it should be:** confirm the contract against a keyed live backend once
`/signal-lead-map_claude` is deployed — call it with a real `(user_id, org_id)`
that has signals + leads, capture the JSON, and reconcile
`SignalLeadMapResponseSchema` against it (tightening the permissive fields if the
live shape proves stable).

**Why deferred:** the endpoint is newly merged and not yet confirmed live; the
tolerant schema degrades-never-throws in the interim, so there is no functional
blocker at 0 users.

**Pull-forward trigger:** `/signal-lead-map_claude` is confirmed deployed on
Render, or any report that the signal↔lead surfaces render empty/odd in a live
environment (a silent contract-vs-response drift).

**Owner:** TBD.

**Note (Phase 37, 2026-06-16):** `/signal-lead-map_claude` confirmed not deployed (2026-06-15); the contract reconciliation pulls forward when the endpoint ships.

**Note (Plan 38, 2026-06-19):** endpoint confirmed **live** — a real account returns
`200 {status, data:{mapping, generated_at, cached}}`, matching the envelope. The FE
contract was tightened in-branch (`contracts.ts`: modeled `status`/`generated_at`/
`cached`, dropped `.passthrough()` on stable shapes, kept `.default("")`/`.catch("low")`),
grounded on the backend's server-normalized `_parse_mapping` plus the live envelope. A
golden fixture was added to `__tests__/contracts.test.ts`. **TD stays open:** the only
account checked has 3 signals / **0 leads**, so a *populated* `mapping[]` could not be
captured. **Remaining required action narrowed to:** re-capture a populated response
once an org has both signals and leads (leads arrive via Apollo discovery / upload) to
confirm the per-entry/per-lead sub-shapes empirically.

---

## TD-FE-74 — `useDocumentSync` keeps a no-op `setIsSaving` shim and 8 dead `DataSourcesManager` call sites

**Date logged:** 2026-06-16
**Origin:** Phase 37 impl-review-1 (finding L1). Task 8 (TD-FE-66) removed the dead `_isSaving` state from `useDocumentSync`, but the consumer still calls the setter, so the hook exposes `setIsSaving` as a permanent no-op rather than dropping it.

**Current state:** `useDocumentSync.ts` declares `const setIsSaving: DocumentSyncApi["setIsSaving"] = () => {};` and keeps `setIsSaving` on the `DocumentSyncApi` interface. `DataSourcesManager.tsx` calls `setIsSaving(true/false)` at 8 sites around upload/delete; `isSaving` is never read anywhere (grep-confirmed). Behaviour-preserving, but the 8 call sites are silently dead and imply a saving-state that does not exist. The misleading hook comment was corrected in the same review pass, so no active misinformation remains.

**What it should be:** drop the `setIsSaving` field from `DocumentSyncApi`, delete the no-op shim, and remove the 8 `setIsSaving(...)` call sites in `DataSourcesManager`.

**Why deferred:** the removal touches `DataSourcesManager.tsx` (~1k LOC) and sits outside Task 8's scope (which targeted `useDocumentSync`'s `_isSaving`, not the manager's call sites); the plan explicitly sanctioned the no-op branch.

**Pull-forward trigger:** the next change that touches `DataSourcesManager.tsx`, or the mission-control write/mutation-hook pass (see TD-FE-34).

**Correction (2026-06-27 audit):** the count is **7** `setIsSaving(...)` call sites in `DataSourcesManager.tsx` plus 1 destructure of the setter — the title's "8" counted the destructure as a call site. `DataSourcesManager.tsx` is now ~1,623 LOC. Scope is otherwise unchanged (behaviour-preserving dead-code removal).

**Owner:** TBD.

---

## TD-FE-75 — SettingsPage page-level loading gate dropped with the orphan company fetch

**Date logged:** 2026-06-16
**Origin:** Phase 37 impl-review-1 (finding L3). Task 15 (TD-FE-11) gave `UserProfile`/`AgentProfile` their own query hooks and removed the orphan company fetch + `profileData` prop flow — which also removed the page-level `loading` gate that rendered "Loading profile data…" before the profile component.

**Current state:** `SettingsPage.tsx` no longer gates on a `loading` state; on profile selection the form renders immediately seeded empty, then re-populates when `useUserProfile`/`useAgentProfile` resolve (brief empty-form flash).

**What it should be:** a loading affordance at the component level, gating each form on its own hook's `isLoading` (the loading state now lives there), without restoring the page-level fetch coupling that was deliberately removed.

**Why deferred:** acceptable MVP UX at 0 users — a sub-second flash on profile switch, not a functional defect. Restoring it is a component-local change, not a page-level concern.

**Pull-forward trigger:** the flash is reported as annoying, or the next SettingsPage UX pass.

**Owner:** TBD.

---

## TD-FE-76 — settings profile reads bypass the `apiFetch` transport and rate limiter

**Date logged:** 2026-06-16
**Origin:** Phase 37 impl-review-1 (finding L2). Task 15 extracted `fetchOwnProfile` from the original `SettingsPage`, preserving its raw `fetch` rather than routing through the shared transport.

**Current state:** `features/settings/services/profile.ts` `fetchOwnProfile` uses raw `fetch`; the new `useUserProfile`/`useAgentProfile` hooks therefore sit outside `src/shared/api/transport.ts` (`apiFetch`), so they neither attach auth headers (harmless — the backend trusts `user_id` params) nor count against the 30 req/min rate limiter. Not a regression (the extracted code was already raw `fetch`); the sibling `useCompanyProfile` does route through `apiFetch`, so the settings reads are a transport exception.

**What it should be:** route `fetchOwnProfile` through `apiFetch` so the settings reads share the one transport (headers + limiter), consistent with the rest of the data layer.

**Why deferred:** not a regression, and harmless at 0 users; belongs with the broader raw-`fetch`→`apiFetch` migration debt (the TD-FE-19 family) rather than a one-off.

**Pull-forward trigger:** the data-layer transport-consolidation pass (Spec 38 / the TD-FE-19/21 decomposition), or any settings read needing rate-limit/auth coverage.

**Owner:** TBD.

---

## TD-FE-77 — Signal briefings delivered to the Artefacts library do not survive navigation

**Date logged:** 2026-06-19
**Origin:** Plan 38 (Signals CTA). The Save-as-Artefact flow delivers a briefing via a
module-level queue drained on `ArtifactsPage` mount, but the library list is
`useState(mockArtefacts)` with no data layer.

**Current state:** a delivered briefing is visible only until the user **navigates away
from `/artifacts`** (unmount discards the list; the queue has already drained). Same class
as the existing Strategist artefacts. Delivery is reliable; retention is not durable.

**What it should be:** the Artefacts library backed by a real store (server or persistent
client state) so saved briefings survive navigation/reload.

**Why deferred:** lifting the library to a real store is a separate effort; at 0 users the
in-session delivery is sufficient to demo the flow. Same TD class as Strategist's artefacts.

**Pull-forward trigger:** the Artefacts library gets a data layer, or users report that
saved briefings vanish.

**Owner:** TBD.

**Follow-up:** if this shared `enqueueArtefact` queue proves out, Strategist's two broken
dispatch-then-navigate sites (`StrategistWorkspace.tsx`) should adopt it (their saves
currently fire `addArtefact` into the void).

---

## TD-FE-78 — Shared PDF generator emits structurally non-compliant output and mojibakes non-WinAnsi glyphs

**Date logged:** 2026-06-19
**Origin:** Plan 38 (Signals CTA). Hardened the briefing path's free-text (structural
escaping + common-punctuation ASCII fold) but left the generator's deeper issues.

**Partial resolution (Spec/Plan 41, 2026-06-23):** `createSimplePDF` migrated to jsPDF.
The hardcoded `/Length 2000` and placeholder xref offsets are gone — jsPDF emits a
structurally valid xref and a real compressed PDF stream. Multi-page flow and text-wrap
within margins are now handled by `splitTextToSize` + page-break logic, so lead-heavy
or strategy-heavy content no longer clips. Both shared consumers are covered: the Spec 38
briefing save (`SignalsPage.tsx`) and the Artefacts-library re-download (`ArtifactsPage.tsx:130`).

**Current state (remaining open half):** non-ASCII glyphs (accented company names, non-Latin
scripts beyond the common ASCII fold) still mojibake — no Unicode-capable font is embedded;
jsPDF defaults to Helvetica/WinAnsi and the ASCII-fold pre-pass is unchanged.

**What it should be:** Unicode-capable font embedding (e.g. a subset-embedded TTF via
jsPDF's `addFileToVFS`/`addFont`) so accented and non-Latin glyphs render correctly.

**Why deferred:** the in-scope ASCII fold covers typical LLM output at MVP scale; embedding
a font bundle adds meaningful JS weight and is a shared effort better timed with a real
internationalisation pass.

**Pull-forward trigger:** garbled glyphs are reported in practice, or an i18n pass is
prioritized.

**Owner:** TBD.

---

## TD-FE-79 — internal `/admin/*` endpoints: Firebase-verified (resolved); reused endpoints remain open

**Date logged:** 2026-06-30
**Origin:** Spec/Plan 44 (internal ops console). Logged as accepted debt at impl review, then
resolved in the same branch when the operator opted into real enforcement (reversing Spec 44 §7's
"no backend authz" — a deliberate, owner-approved exception to the MVP "ignore security" posture).

**Resolution (this branch):** `GET /admin/orgs` and `GET /admin/health` now require a verified
Firebase ID token from an allowlisted operator. The `/admin` router depends on `require_admin`
(`backend/app/core/auth.py`), which verifies the token against Google's public signing keys +
project `multi-tenant-50161` — using only PUBLIC inputs, so **no service-account secret** — and
returns 403 for non-operators (401 if the token is missing/invalid). The FE attaches the ID token
on those two calls (`features/admin/services/admin.ts`); `AdminGuard` + `adminAllowlist.ts` still
gate the UI. So the `/admin/*` surface is a real server-side boundary, not cosmetic. The two
allowlists (FE `adminAllowlist.ts`, BE `auth.ADMIN_EMAILS`) are kept in sync by hand.

**Residual (NOT admin-specific):** the panel's reused parity/inspection endpoints (`/org`,
`/connect_org`, `/v2/registration`, `/profile/company`, `/v2/leads`, `/v2/user-documents`) remain
unauthenticated, consistent with the global backend posture (CLAUDE.md "Auth reality"; the §2.2
security backlog + CORS `allow_origins=["*"]`). Closing that is the broader backend-authz effort,
out of this entry's scope.

**Pull-forward trigger:** the broader backend-authz pass — at which point the reused endpoints get
the same Firebase-verification treatment.

**Owner:** TBD.

---

## TD-014 — Matched-leads map sends up to `lead_fetch_limit` leads in a single Claude call

**Status:** RESOLVED 2026-07-07. The single call over up to 500 leads was measured at ~180s with a truncated (→ empty) 8192-token output, which surfaced live as a Vercel `502 ROUTER_EXTERNAL_TARGET_ERROR` and a cached empty mapping. `build_signal_lead_map_claude` now splits the leads into bounded batches (`SIGNAL_LEAD_MAP_BATCH_SIZE`, default 40), maps each batch (full signal set × one lead batch) in its own Claude call run concurrently (`SIGNAL_LEAD_MAP_MAX_CONCURRENCY`, default 5), and merges per signal. A batch failure degrades that batch only; only a fully complete map (all batches ok) is cached, else status:"error". If a batch's output is still truncated it is split in half and re-mapped (bounded by `_MAX_SPLIT_DEPTH`) so tail leads are never silently dropped — an unsplittable truncation fails loudly rather than caching a partial map. Defaults tuned from live profiling: wall-clock is floored by total Claude output ÷ an Anthropic-rate-limited ~4.4 effective concurrency, so B/C above ~5 don't speed it up — B=40 shrinks the truncation risk, C=5 saturates the ceiling with less memory/429 pressure. **Latency caveat:** an *uncached* compute for a high-match 500-lead org still runs ~200–230s (verified live: 867 matched pairs), which exceeds the ~30s Vercel proxy window, so the first uncached load still 502s (backend finishes + caches → reload shows leads). No synchronous (L,B,C) clears the proxy; the full latency fix is async background-compute + poll, or a bigger Render instance / higher Anthropic tier. The two env vars let ops tune without a deploy. **Cost follow-up (2026-07-09):** the chunking above re-sent the full newest-50 signal set + ICP context in *every* batch with no caching, and the adaptive-split regenerated discarded output on each truncation — together spiking Anthropic usage ~10× once real orgs carried many signals (this entry's "elevated cost" trigger, now closed). Fixed by (a) **prefix prompt-caching** the stable signal-set+context via `PROMPT_CACHE_SPLIT_MARKER` (`backend/app/services/_llm_helpers.py` + `prompts/signals/signals_lead_map.md.j2`); (b) a **lead-map-specific output cap** `_LEAD_MAP_MAX_TOKENS` (env `SIGNAL_LEAD_MAP_MAX_TOKENS`, default 24000) replacing the shared 8192 `CLAUDE_RESEARCH_MAX_TOKENS`, so most batches parse first-try instead of truncating→splitting; (c) **serialize-first-batch** so the first concurrent wave reads the warm cache instead of all missing it (a cache entry is only readable after the first response is written); (d) per-call `usage` logging (cache read/write/in/out) so the hit-rate is measurable in prod. Verified: `tests/unit/test_signal_lead_map.py` 29 passed on a uv-managed Python 3.13 venv (the sandbox's default 3.14 has no `pandas 2.3.2` wheel). Commit pending.

**Date logged:** 2026-07-03 (Spec 47 — admin-configurable lead-fetch limit).

**What was done:** the hardcoded 100-lead cap became the admin `lead_fetch_limit` setting (default & ceiling 500). `build_signal_lead_map_claude` (`backend/app/services/signals/lead_map.py`) still sends newest-50 signals × ≤`lead_fetch_limit` leads in ONE Claude call, so raising the cap 100→500 is up to 5× the lead payload per call — higher token cost and possible match-quality dilution.

**What should be done:** if cost/quality degrades at higher limits, chunk the leads across multiple Claude calls and merge the returned `mapping[]` (the signal set is constant; only the lead batch varies), keeping each call's payload bounded.

**Why deferred:** MVP, 0 live users; the 500 ceiling bounds the worst-case payload and Sonnet's context window absorbs it. Not worth the chunking complexity until real usage shows a cost or match-quality problem.

**Trigger:** matched-leads Claude calls show elevated cost, truncation, or degraded match quality at high `lead_fetch_limit` values; OR the ceiling is raised beyond 500.

**Owner:** TBD.

---

## TD-015 — Matched-leads *uncached* compute is slow + unreliable on the small Render instance (needs infra and/or async)

**Partial resolution (2026-07-09):** the first-load **502** — this entry's most user-visible failure — is removed by a route not listed in the options below: the FE now calls `/signal-lead-map_claude` **direct to Render** (`frontend/src/shared/api/transport.ts` `direct` flag, bypassing the `vercel.json` rewrite and its ~120 s edge gateway window), so a ~200 s uncached compute is bounded only by Render's own timeout, not the proxy. The prompt-caching + 24K per-batch cap + serialize-first-batch that landed for TD-014 (2026-07-09) also cut total Claude output per compute, shortening wall-clock. **Still open:** raw uncached wall-clock (~200 s), the noisy-neighbor 500s under load, and Render free-tier spin-down / in-process `BackgroundTasks` fragility — options #1 (paid instance) and #2 (async compute + poll) below remain the durable fixes; direct-to-Render removes the 502, not the slowness.

**Date logged:** 2026-07-07.

**Current state:** After TD-014 (chunking + `B=40`/`C=5` defaults + adaptive-split + FE error-surfacing), the matched-leads map is *correct* (real matches, no silent truncation) and *cached reads are fast + reliable* (~5 s). But the **first, uncached compute is slow and unreliable**, and — verified live — **no `(lead_fetch_limit L, batch_size B, concurrency C)` tuning fixes it**. `build_signal_lead_map_claude` runs synchronously inside the request; the fix is infrastructure and/or async, not a knob.

**Numbers (measured live 2026-07-07 — org `4ab92719…`, 500 leads, high match density → 867 matched (signal,lead) pairs, ~342 KB output):**
- Wall-clock ≈ *total Claude output ÷ ~190 output tok/s* ≈ **4.4 effective concurrent streams** (Anthropic-rate-limited — NOT the configured `C`), i.e. **≈ 0.45 × L + ~5 s overhead**.
- **`L` is the only real speed lever**; it trades ~linearly against coverage (leads are fetched newest-first, so lower `L` silently drops the oldest leads, and `L` is a *global* admin setting that also shrinks signal-generation grounding). **`B` and `C` above ~5 do not reduce latency.**
- Uncached `refresh:true` outcomes observed: **229 s (200 OK) · 198 s (Render 502) · >290 s (client timeout) · ~2 s (early 500)** — ~200–290 s and genuinely **unreliable** (variously completes, 502s, 500s, or hangs).
- **Noisy neighbor:** while a heavy compute runs, light cached reads on the same instance began returning 500 — the compute degrades the *whole* backend, not just itself.
- **Vercel proxy window ≈ 30 s:** any uncached compute (≥ ~200 s) 502s at the proxy on the first load *regardless of instance health* (backend finishes + caches → a reload then shows leads).
- Cached read (`refresh:false`): **~5 s, reliable.**
- Render free tier: instance spins down after ~15 min idle; `fastapi.BackgroundTasks` are in-process and lost on restart/spin-down (no queue, no retries).
- No usable sub-30 s synchronous config exists: only `L ≈ 40–55` (8–11 % coverage) even approaches the proxy window, and unreliably.

**What should be done (options with rough cost/time):**
1. **Bigger / paid Render instance** (~$7–25/mo, ~0 eng): most direct reliability win — lets the ~200 s compute complete without buckling and stops the noisy-neighbor degradation, so the "load → 502 → reload → leads" flow becomes *dependable*. **Does not remove the first-load 502 + manual reload** (Vercel proxy unchanged). Also effectively a prerequisite for option 2 (else spin-down kills background tasks).
2. **Async background-compute + poll** (~**3–4 engineer-days**): the only fix that removes the **first-load 502** → "load → *computing…* → leads appear," no error/reload. Endpoint returns `status:"pending"` immediately + enqueues a `BackgroundTasks` compute; FE polls (`refetchInterval`) until cached. Tricky parts: an **atomic in-progress marker** (else every poll re-triggers a full ~200 s compute) + a **stale-reclaim timeout** (Render loses bg tasks on restart). Pair with **low background concurrency** (latency no longer matters → gentle on the instance). Anthropic cost ~neutral-to-**cheaper** (de-dup kills the current FE `retry:2` re-compute storm = up to 3× the bill per slow load). Wants a paid/always-on instance (see #1). A production queue (Celery/RQ/Render cron) is a larger lift — not recommended at MVP.
3. **Higher Anthropic tier** (secondary): raises the ~4.4 effective-concurrency ceiling → shorter compute; complements #1/#2, doesn't replace them.

**Why deferred:** MVP, 0 live users. Working orgs are served from the warm cache; the failure only bites *uncached* first loads (new orgs, cache busts, refreshes). Not worth 3–4 eng-days for the async UX until real users hit uncached loads.

**Trigger:** real users load matched-leads for orgs not already cached; OR the noisy-neighbor 500s begin affecting unrelated endpoints in prod; OR product wants a no-502 first-load experience.

**Recommendation:** do #1 first (cheap; unblocks reliability and lets us re-measure a clean uncached run without noisy-neighbor noise), then decide whether the no-502 UX justifies #2. See TD-014 for the completed chunking/tuning work this builds on.

**Owner:** TBD.

---

## TD-FE-80 — Frontend npm dependency vulnerabilities (71 open Dependabot advisories)

**Date logged:** 2026-07-08
**Origin:** Surfaced by GitHub Dependabot on the `master` push during the Profiler-ICP fix merge (2026-07-08, commit `0e71af8b`). The backlog predates that change — no dependencies were added by it.

**Current state:**
71 open Dependabot advisories, **all `npm`** (frontend `package-lock.json`); the backend (`pip`) has none flagged. Severity: **2 critical, 31 high, 31 moderate, 7 low**. Scope: **30 runtime, 41 development/build-only**. Relationship: **14 direct, 57 transitive**. Every alert has a published `first_patched_version` — all are fixable by upgrade.

- **Critical (runtime):** `protobufjs` — arbitrary code execution (CVE-2026-41242), transitive (via `@grpc/grpc-js` → Firebase), fixed in ≥ 7.5.5.
- **Critical (dev-only):** `vitest` — Vitest UI server arbitrary file read/exec (CVE-2026-47429), direct devDependency, fixed in ≥ 3.2.6. Only reachable when the Vitest UI server is running (never in production).
- **Runtime highs** (all transitive): `@grpc/grpc-js`, `@remix-run/router`, `glob`, `lodash`, `minimatch` (×3), `picomatch`, `protobufjs` (×5) — mostly via Firebase and react-router.
- **Direct deps flagged:** `vitest` (dev, critical), `vite` (dev, moderate), `postcss` (runtime, moderate).

**What it should be:**
Advisories triaged and cleared to ~zero on the default branch. Concretely: `npm audit` in `frontend/`, apply the non-breaking transitive fixes (`npm audit fix`), bump the flagged direct deps (`vitest` ≥ 3.2.6, `vite`, `postcss`), and pin `protobufjs` ≥ 7.5.5 via a lockfile `overrides` (or by bumping the Firebase/@grpc chain) — then re-verify with `npm run preflight` and confirm Firebase auth + gRPC paths still work. Enable Dependabot version-update PRs so the backlog doesn't re-accumulate.

**Why we deferred:**
- MVP, 0 live users. The two criticals are (a) dev-only (`vitest`, never shipped) and (b) a transitive RCE (`protobufjs`) reachable only through protobuf/gRPC input paths the app does not currently expose to untrusted data — no user-facing exploit path today.
- A blanket upgrade risks breaking the Firebase / react-router / build toolchain; it wants its own verify + preflight cycle rather than riding an unrelated fix.

**What we lose by staying as-is:**
- A real runtime RCE (`protobufjs`) sits in the shipped dependency graph; the risk becomes live the moment the app processes attacker-influenced protobuf/gRPC input.
- A growing backlog desensitizes the team to the Dependabot signal (alert fatigue), making a future genuinely-exploitable advisory easier to miss.

**Pull-forward triggers:**
- Pre-launch security pass / first real users; OR any runtime-scoped critical/high that becomes directly reachable from user input; OR the open count climbs materially past ~71.

**Owner:** TBD.

---

## TD-016 — Neo4j driver 500s on the first request after a restart/deploy (defunct pooled connection, no retry)

**Date logged:** 2026-07-09
**Origin:** Surfaced live during TD-014/TD-015 lead-map verification (2026-07-09) — a Render deploy restarted the backend mid-compute and the next `POST /signal-lead-map_claude` returned HTTP 500 from a Neo4j `SessionExpired`.

**Current state:**
The first Neo4j-backed request after a backend restart/redeploy can fail → HTTP 500, in two forms sharing one cause (a connection that went defunct across the restart): `neo4j.exceptions.SessionExpired: Failed to read from defunct connection …` (observed 15:01:04) and `neo4j.exceptions.ServiceUnavailable: Unable to retrieve routing information` when the defunct connection is the *router* and the routing-table refresh fails (observed 15:06:36). Both from `get_leads_for_org` (`backend/app/services/leads/persistence.py:34`) on `s.run(...)`, verified live 2026-07-09 (isolated repro on `/v2/leads`: 500 → 200 → 200 — the first request evicts the stale connection, the next reconnects). Root cause: reads run through a **raw** `driver.session()` + `s.run(...)` rather than a managed transaction function, so they get none of the Neo4j driver's built-in transient-error retry; a pooled connection that went defunct across the restart (Neo4j Aura also drops idle connections) is handed to the first query and fails instead of transparently reconnecting. The driver (`app/core/clients.py:44`) is created without `liveness_check_timeout` / `max_connection_lifetime`, and `verify_connectivity()` runs only once at startup. This is the cold-start 500/502 the `backend/render.yaml` comment already alludes to. **Scope: every Neo4j-backed endpoint** (leads, CRM graph, graph-chat, ICP) — not just lead-map.

**What it should be:**
Neo4j reads/writes go through managed transaction functions (`session.execute_read` / `execute_write`), which acquire a fresh connection and auto-retry transient failures (`SessionExpired`, `ServiceUnavailable`); and/or the driver is configured with `liveness_check_timeout` (ping idle pooled connections before reuse) and a bounded `max_connection_lifetime`. Cheaper stopgap: a single reconnect-and-retry on `SessionExpired`/`ServiceUnavailable` in the persistence helpers.

**Why we deferred:**
- MVP, 0 live users. It only bites the *first* request after a restart/deploy; a reload succeeds once the pool re-establishes.

**What we lose by staying as-is:**
- Every deploy/restart makes the first hit to any Neo4j endpoint 500 — now **more frequent** with `autoDeploy: true` (commit `eeb4a0f4`) restarting prod on each master push. Undermines the "always-on starter instance" reliability goal and compounds TD-015 (a future async lead-map compute depends on dependable Neo4j reads).

**Pull-forward triggers:**
- Real users hit post-deploy 500s; OR TD-015's async/background lead-map work lands; OR restart frequency rises.

**Owner:** TBD.

---

## TD-017 — `starter` instance memory leak → periodic OOM restarts (dominant leaker unconfirmed)

**Date logged:** 2026-07-09
**Origin:** Surfaced while diagnosing repeated `starter`-instance restarts during TD-014/TD-015 lead-map work (2026-07-09). Render Metrics showed memory climbing **monotonically** from ~65% to 100% over ~5h, then a vertical drop — twice (~4:01am → the 4:10am "ran out of memory" event; ~9:46am → the 10:03am event). That sawtooth-up-then-cliff is a leak → OOM signature, distinct from the lead-map compute, which appears as short CPU spikes with immediate release. After the 2026-07-09 lead-map deploys, memory settled ~50% and flat — so the leak is time/traffic-driven, not lead-map.

**Current state:**
The 512 MB `starter` instance OOMs roughly every ~5–6h of steady traffic and restarts prod. Something accumulates monotonically across requests. One identified contributor has been **removed** (see partial resolution below), but it is not the dominant leaker (the graph-chat/Scout-chat features it affected are barely used). The dominant source is **unconfirmed** — confirmation needs in-process profiling (`gc`-object-count vs RSS, or `tracemalloc` top-stats, or per-endpoint bisection against the Metrics graph), deliberately **not** yet added.

**Code sweep (2026-07-09).** A structural sweep for classic leak shapes came back clean everywhere *except* the (now-removed) `ConversationBufferMemory`: no global LLM cache / LangSmith tracing (`set_llm_cache`/`InMemoryCache` absent), no per-render memo in the prompt registry (`app/core/prompts.py` `render()` doesn't cache; `_registry` is built once at startup), no module-level growing lists/dicts, the Claude budget `deque` (`app/services/_claude_budget.py`) is pruned to its 5-min window (bounded), all Neo4j sessions are `with driver.session()` (closed — TD-016 is a *retry* gap, not a leak), `app.state` gets only 3 startup assignments, pandas DataFrames are function-local, and `agent_chain`/`chain`/`llm2`/`llm_transformer` are startup singletons (no per-request agent/chain construction). Conclusion: **no other held-forever reference in our own code** — so the residual climb is most likely *not* a classic reference leak. Ranked suspects, most→least likely:

- **(0) Structural amplifier — no worker recycling.** `render.yaml:18` runs `uvicorn main:app` as a single process with no auto-recycle (uvicorn has no `--max-requests`; only gunicorn does). Whatever accumulates — true leak *or* heap growth — is never reclaimed until OOM; this is why the climb is smooth/monotonic and repeats every ~5–6h. Not the cause, but why the cause reaches OOM.
- **(1) Heap ratcheting / fragmentation from large transient allocations** — best fit for "clean code, no retained objects, yet monotonic climb to OOM on 512 MB." Hot paths allocate big short-lived objects: Claude JSON responses up to 24k output tokens, 100-lead batches, pandas DataFrames on upload, 1024-dim embedding vectors. CPython's allocator doesn't reliably return freed memory to the OS, so RSS ratchets. Confirm: `gc` object count flat while RSS climbs ⇒ fragmentation, not a leak.
- **(2) Per-call `OpenAIEmbeddings` never closed** (`app/services/_retrieval.py:75`, `app/services/data_sources/pipeline.py:141`) — each builds an `openai.OpenAI`→`httpx.Client` (connection pool + SSL context) left to GC and prone to reference cycles (delayed collection). A real slow contributor on the RAG-retrieval and doc-upload paths.
- **(3) Unpinned dependencies** — `requirements.txt` pins **no versions** for `langchain*`/`openai`/`pinecone-client`/`neo4j`; a known-leaky build could be deployed, and it makes the leak non-reproducible / possibly recently introduced by a transitive bump.
- **(4) Third-party pool/callback accumulation** (LangChain `AgentExecutor` + `return_intermediate_steps=True`, pinecone/neo4j pools) — possible but no code-level evidence; only profiling would implicate it.

**Partial resolution (2026-07-09):** the shared process-wide `ConversationBufferMemory(return_messages=True)` in `build_llm_config()` — a single instance passed to both graph-chat chains (`chain`/`chain2`, backing `GET /ask/` and `GET /chat/`) — was removed (commits `1110ffb0` code, `5ca52bff` docs). LangChain saved every Scout-chat turn from every user into that one never-trimmed buffer (unbounded growth + a latent cross-tenant conversation bleed), yet the cypher/QA prompts never read `history`/`chat_history`, so it was write-only dead weight. Removal (the `memory` field on `LLMBundle`, the construction, both `memory=memory` args, the unused `get_memory` dependency, the import) is behavior-neutral for outputs and broke no test. This plugs one unbounded structure and kills the latent bleed, but — given chat is barely used — is not the OOM's dominant cause.

**What it should be:**
Confirm the dominant driver with data (the `gc`-vs-RSS / `tracemalloc` probe, or per-endpoint bisection), then act on it. Cheap wins available now, in leverage order: **(a)** run under gunicorn with a uvicorn worker + `--max-requests N --max-requests-jitter M` (or a scheduled restart) so the process recycles before OOM — mitigates the climb regardless of root cause; **(b)** construct the `OpenAIEmbeddings` client once at startup (like the other singletons) or close it per call; **(c)** pin dependencies from a `pip freeze` of the deployed image and check `langchain*` against known leak advisories. If the probe shows `gc` count flat while RSS climbs, treat it as allocator fragmentation (reduce peak allocation / `MALLOC_TRIM` / worker recycling) rather than hunting a non-existent retained object. A larger instance only *delays* OOM; it does not fix it.

**Why we deferred:**
- MVP, 0 live users; the crash only recycles a single always-on instance every few hours. The profiling step and the real fix are being scheduled deliberately rather than guessed at.

**What we lose by staying as-is:**
- The instance OOMs every ~5–6h, restarting prod and compounding TD-016 (each restart makes the first Neo4j request 500) — now more frequent under `autoDeploy: true`.
- Undermines the "always-on starter instance" reliability goal; will worsen as traffic grows and bite real users at launch.

**Pull-forward triggers:**
- OOM restarts persist after the `ConversationBufferMemory` removal deploys; OR real users hit crashes / post-restart 500s; OR memory-driven latency (GC pressure) becomes observable.

**Owner:** TBD.
