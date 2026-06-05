# Brewra — Technical Debt Register

Running list of debt items the team has consciously accepted. Each entry: what was done, what should be done, why we deferred, and the trigger that should pull it forward.

Numbering is preserved across resolutions — TD-001/002/003 (resolved by Phases E and F) were removed on 2026-05-23; their IDs are not reused so commit/spec references stay traceable. TD-006 (market_scoring callers recomputing len(leads)) was resolved 2026-05-24 by Phase H Task 4. TD-007 (Phase G plan-verbatim cosmetic cruft) was resolved 2026-05-25 by Phase I commit 11/11. TD-008 (backend LOC reduction) and TD-009 (docstring/comment drift) were resolved 2026-05-25 by Phase L (audit + 7 K-tasks + I2 promotion, commit `7f169f9`). TD-010 (prompt management overhaul) was resolved 2026-05-26 by plan-13 (Phase 0 audit + render/registry infrastructure + 6 service migrations, commits `5238fb7..1c94e29`); the resolved entry is retained below with original context preserved.

---

## TD-FE-1 — Deferred orphan-route investigation: /tenant-selection

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 4 (orphan-route sub-pass).

**Current state:**
`App.tsx` defines `<Route path="/tenant-selection" element={<ProtectedRoute><TenantSelection /></ProtectedRoute>}`.
The route is not linked from `src/components/layout/Sidebar.tsx`. The 6-check kit (orphan variant):
  rg-basename: 0 (no Sidebar.tsx reference to /tenant-selection)
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0 (no references outside App.tsx itself)
  route-walk: none
  test-imports: none

**Why deferred:**
`/tenant-selection` is an auth/onboarding flow route — the app is expected to redirect here programmatically
post-login when the user has no tenant selected. It is intentionally absent from the Sidebar nav.
Conservative posture for auth/tenant/protected-route wrappers per Spec 16 §2.3.

**Pull-forward trigger:**
Phase 13 (post-modularization LOC pass) re-evaluates with strict TS context and richer test coverage;
verify the redirect chain (login → /tenant-selection → mission-control) is covered by e2e before
considering removal.

**Owner:** TBD.

---

## TD-FE-2 — Deferred orphan-route investigation: /scout-deployment

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 4 (orphan-route sub-pass).

**Current state:**
`App.tsx` defines `<Route path="/scout-deployment" element={<ProtectedRoute requireTenant><ScoutDeploymentPage /></ProtectedRoute>}`.
The route is not linked from `src/components/layout/Sidebar.tsx`. The 6-check kit (orphan variant):
  rg-basename: 0 (no Sidebar.tsx reference to /scout-deployment)
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0 (no references outside App.tsx itself)
  route-walk: none
  test-imports: none

**Why deferred:**
`ScoutDeploymentPage` (`src/pages/ScoutDeployment.tsx`) is a live component wrapping
`src/components/settings/ScoutDeployment.tsx`. The `ScoutDeploymentDetails` sub-component is also
actively rendered inside `MarketResearch.tsx`. The page may be intentionally accessible via direct URL
only (admin/configuration path, not a regular user nav destination). Removing the route while the
component is live warrants Brewra-dev confirmation.

**Pull-forward trigger:**
Confirm with Brewra devs whether `/scout-deployment` is intentionally unlisted from the Sidebar
(admin-URL pattern) or is dead product surface. If dead: remove the Route element and run 6-check
kit on `src/pages/ScoutDeployment.tsx` for full dead-file removal.

**Owner:** TBD.

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

## TD-FE-3 — Deferred unused exports: src/lib/ (firebase, api, leadStreamHeatmapSession, missionProfilerSessionCache)

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 5.

**Current state:**
Knip flags these symbols in `src/lib/` files as unused exports:
  - `src/lib/firebase.ts` — `default` (default export of the Firebase `app` instance; named `auth` export is live)
  - `src/lib/api.ts` — `API_BASE_URL`, `ApiFetchOptions`, `ICP_BACKEND_URL`
  - `src/lib/leadStreamHeatmapSession.ts` — `leadStreamHeatmapCacheKey`
  - `src/lib/missionProfilerSessionCache.ts` — `ProfilerSessionSnapshot`

Per-symbol rg + test-import check returned no live inbound references (API_BASE_URL appears only in
commented-out code in DataHistoryDialog.tsx).

**Why deferred:**
All files are under `src/lib/` — conservative posture per Spec 16 §2.3. The lib/ area is the
utility/abstraction layer; removing exports here before Phase 13 modularization could silently break
import patterns not yet visible to knip (dynamic import, late binding, or re-export chains).
Note: the export-keyword-only operation applied aggressively in Step 5 for `components/signals/` (commits 2e086f7, f47b204) was held conservative here per the Spec 16 §2.3 lib/ boundary, not the per-symbol risk. Phase 13 can revisit by applying the same drop-export-keyword op if the conservative posture relaxes.

**Pull-forward trigger:**
Phase 13 (post-modularization LOC pass) with strict TS context may relax the conservative-posture
barrier. Confirm no dynamic consumers before removal.

**Owner:** TBD.

---

## TD-FE-4 — Deferred unused export: src/hooks/use-toast.ts

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 5.

**Current state:**
Knip flags these symbols in `src/hooks/use-toast.ts` as unused exports:
  - `reducer` — internal state reducer exported at line 74; only used internally at line 134

Note: `toast` was also flagged by knip but is retained — it IS re-exported via
`src/components/ui/use-toast.ts` (`export { useToast, toast }`) and consumed downstream.

Per-symbol rg + test-import check: `reducer` has zero inbound references outside the file.

**Why deferred:**
File is under `src/hooks/` — conservative posture per Spec 16 §2.3.

**Pull-forward trigger:**
Phase 13 (post-modularization LOC pass) with strict TS context.

**Owner:** TBD.

---

## TD-FE-5 — Deferred unused exports: src/utils/apiUtils.ts

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 5.

**Current state:**
Knip flags these symbols in `src/utils/apiUtils.ts` as unused exports:
  - `forceFreshData`
  - `isDataFresh`
  - `marketResearchApiCallWithCacheBust`
  - `rateLimitedApiCall`
  - `simpleApiCall`

Per-symbol rg: `isDataFresh` appears in `MarketResearch.tsx` but only as a locally-defined shadow
variable (not imported from apiUtils.ts). The other four have zero inbound references.

**Why deferred:**
File is under `src/utils/` — conservative posture per Spec 16 §2.3.

**Pull-forward trigger:**
Phase 13 (post-modularization LOC pass) with strict TS context may relax the conservative-posture
barrier. Verify no remaining call sites that use a version-shadowing import pattern.

**Owner:** TBD.

---

## TD-FE-6 — Deferred unused exports: src/utils/profilerAcceptedIcpDisplay.ts

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 5.

**Current state:**
Knip flags these symbols in `src/utils/profilerAcceptedIcpDisplay.ts` as unused exports:
  - `ProfilerAcceptedIcpDisplayMeta`
  - `isProfilerPlaceholderIcp`
  - `mergeProfilerAcceptedIcpDisplayIfPlaceholder`

Per-symbol rg + test-import check returned zero inbound references outside the file.

**Why deferred:**
File is under `src/utils/` — conservative posture per Spec 16 §2.3.

**Pull-forward trigger:**
Phase 13 (post-modularization LOC pass) with strict TS context.

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

## TD-FE-7 — Deferred unused exports: src/components/ui/ (shadcn-locked primitives)

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 5.
Spec 16 §2.2 and §8 explicitly lock `src/components/ui/` from Phase 4 onward.

**Current state:**
Knip flags unused exports in 14 shadcn-ui primitive files:
  - `sonner.tsx` — `toast`
  - `avatar.tsx` — `AvatarImage`
  - `badge.tsx` — `BadgeProps`, `badgeVariants`
  - `alert.tsx` — `AlertTitle`
  - `select.tsx` — `SelectGroup`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator`
  - `dialog.tsx` — `DialogClose`, `DialogOverlay`, `DialogPortal`
  - `table.tsx` — `TableCaption`, `TableFooter`
  - `dropdown-menu.tsx` — `DropdownMenuCheckboxItem`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuShortcut`
  - `alert-dialog.tsx` — `AlertDialogOverlay`, `AlertDialogPortal`, `AlertDialogTrigger`
  - `drawer.tsx` — `DrawerOverlay`, `DrawerPortal`, `DrawerTrigger`
  - `command.tsx` — `CommandDialog`, `CommandSeparator`, `CommandShortcut`
  - `sheet.tsx` — `SheetClose`, `SheetDescription`, `SheetFooter`, `SheetOverlay`, `SheetPortal`, `SheetTrigger`
  - `button.tsx` — `ButtonProps`
  - `textarea.tsx` — `TextareaProps`

These are shadcn-ui generated primitives. The extra sub-components are exported by the shadcn
scaffolding convention even when not yet consumed by this project. Removing them would diverge
the files from the upstream shadcn source and complicate future shadcn upgrades.

**Why deferred:**
`src/components/ui/` is shadcn-locked per Spec 16 §2.2 — any unused primitives flagged by knip
stay in place. Removing upstream-scaffold exports here provides minimal LOC savings while creating
maintenance drag on future shadcn version bumps.
Note: per-file comparison against upstream shadcn-ui source was not performed in Phase 1. Phase 4's shadcn consolidation should verify each primitive against upstream before deciding what to consolidate vs prune.

**Pull-forward trigger:**
If Brewra forks shadcn components (copies them out of the upstream pattern into fully local files),
these exports can be pruned. Or if the unused sub-components remain untouched past Phase 4 and a
deliberate audit confirms they will never be used.

**Owner:** TBD.

**2026-05-27 update — remediation mechanism:**
The Phase 4 lock is now expressed as `"ignore": ["src/components/ui/**"]` in `frontend/knip.json`
rather than per-file `defer-export` annotations. Behavioral semantics are unchanged (files
remain in the codebase, locked from Phase 1 cleanup, deferred to Phase 4 shadcn consolidation),
but knip now reports zero findings against the directory in either mode, simplifying the
merge-gate config.

Pull-forward trigger is unchanged: Phase 4 shadcn primitive consolidation.

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
`TenantContext` (`src/contexts/TenantContext.tsx`) declares `availableTenants: Tenant[]` state and
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

## TD-FE-13 — Repoint hardcoded backend host `backend-11kr` → `brewra-gtm-intelligence`

**Resolved:** 2026-06-02 — repointed all active references to `https://brewra-gtm-intelligence.onrender.com` and collapsed the runtime app code to a single `BACKEND_BASE_URL` source of truth in `frontend/src/lib/api.ts` (consumed by `API_BASE_URL`, `ICP_BACKEND_URL`, and the 5 former direct-fetch call sites). `vite.config.ts` (one local `backendUrl` const, both proxies) and `vercel.json` (literal) cannot import the TS const and retain the host literal as the two unavoidable mirror points. The 2 dead commented-out occurrences in `DataHistoryDialog.tsx` were deleted. Backend `backend/test_*.py` probes and the doc references (CLAUDE.md/AGENTS.md gotchas, frontend/CORS_FIX_README.md, scripts/safety_net/*) were left for a separate docs/backend pass — they don't affect the running app. Note: confirmed live 2026-06-02 (POST /market-research → 200, `data` carries executiveSummary/keyUpdates/visualDataCards/regionalData/strategicRecommendations). The user provided the host as `http://`; HTTPS is used (the PWA is https → http backend would be mixed-content-blocked).

**Date logged:** 2026-05-29
**Origin:** Plan 20 Phase 3 manual smoke (plans/20-frontend-phase-3-api-data-layer.md, Task 16 Step 2). The
live capture confirmed `https://brewra-gtm-intelligence.onrender.com` is the working backend
(`GET /profile/company?org_id=brewra` → 200, body validates against `CompanyProfileSchema`), while the
hardcoded `https://backend-11kr.onrender.com` is **suspended** (HTTP 503). The frontend still points every
backend reference at the suspended old host.

**Current state:**
`backend-11kr.onrender.com` is hardcoded in **12 live spots** (frontend-scoped grep, excludes
`node_modules`/`dist`/tests), in three tiers:

- **Config / proxy** (routes the whole app) — 5:
  - `frontend/vercel.json:5` — production Vercel rewrite `/api/$1 → <host>/$1`
  - `frontend/vite.config.ts:27` — dev-server `/api` proxy target
  - `frontend/vite.config.ts:52` — `vite preview` `/api` proxy target
  - `frontend/src/lib/api.ts:13` — `API_BASE_URL` production direct fallback
  - `frontend/src/lib/api.ts:25` — `ICP_BACKEND_URL` (feeds `buildIcpUrl`)
- **Hardcoded direct fetches** (bypass the Phase 3 shared data layer) — 5:
  - `frontend/src/components/market-research/ChatWithScout.tsx:89` — `GET /chat/`
  - `frontend/src/components/market-research/StrategistWorkspace.tsx:855` — `GET /chat/`
  - `frontend/src/components/market-research/AIPromptingInterface.tsx:215` — `GET /ask`
  - `frontend/src/components/market-research/DataHistoryDialog.tsx:950` — local `API_BASE_URL` const
  - `frontend/src/components/market-research/RegulatoryComplianceSection.tsx:729` — direct
    `GET /profile/company` (duplicates `useCompanyProfile`)
- **Cosmetic** — 1: `frontend/src/pages/MarketResearch.tsx:4002` (error-message string).
- Plus 2 commented-out occurrences in `DataHistoryDialog.tsx:29,616` (dead, deletable).

Smoke evidence (2026-05-29): the new host serves `/profile/company` (200, contract-valid). `/auth/token`
and `/auth/refresh` return 404 on the new host (and did on the old) — the JWT endpoints never existed, so
the "JWT optional" path already absorbs this; **repointing introduces no auth regression**.

**What it should be:**
Replace all 12 active references with `https://brewra-gtm-intelligence.onrender.com`. Prefer collapsing the
host to a **single source of truth** (one env var, e.g. `VITE_API_BACKEND_URL`, or one exported const)
rather than re-duplicating a literal across `vercel.json`, `vite.config.ts` (×2), `lib/api.ts` (×2), and the
5 call sites — so the next host move is a one-line change. Verify after: dev proxy, `vite preview` proxy,
Vercel rewrite, `/icp`, `/chat/`, `/ask`, and the direct `RegulatoryComplianceSection` profile fetch all
resolve to the new host. Then remove the now-obsolete `sbx` sandbox allow rule for `backend-11kr` (sandbox
hygiene only — it never affected production).

Deeper debt surfaced alongside: the 5 direct fetches bypass `src/shared/api/`; repointing them is a stopgap.
They should eventually route through the shared client (the `RegulatoryComplianceSection` `/profile/company`
fetch in particular duplicates `useCompanyProfile`). Fold into the Phase 5–7 market-research migrations
rather than this repoint.

**Why we deferred:**
- Out of scope for Plan 20 Phase 3, which consolidated only the CompanyProfile/tenant/auth/Login data layer
  and explicitly left `lib/api.ts`'s hardcoded host unchanged.
- The repoint is a cross-cutting infra change (production Vercel rewrite + two proxy configs + 5 call sites)
  that warrants its own focused commit and a decision on whether `brewra-gtm-intelligence.onrender.com` is
  the permanent home or an interim before a `brewra.com`-backed custom domain.

**What we lose by staying as-is:**
- The deployed frontend (Vercel) and local `npm run dev`/`preview` all proxy to a **suspended** backend, so
  every API call currently fails end-to-end. Pre-launch (0 live users) this is not a user-facing outage, but
  the deployed app is non-functional against its API until either the old host is un-suspended or this lands.

**Pull-forward trigger:**
- Before any real use of the deployed app, and **before launch** — the current host is suspended.
- When `brewra-gtm-intelligence.onrender.com` is confirmed the permanent backend home (vs a custom domain).
- Bundle with removal of the `sbx policy allow network backend-11kr.onrender.com` sandbox rule.

**Owner:** TBD (deploy owner).

---

## TD-FE-14 — knip-ignore on `src/shared/components/**` until Phase 5 consumes `FeatureErrorBoundary`

**Date logged:** 2026-05-29
**Origin:** Plan 21a Phase 4a (plans/21a-frontend-phase-4a-scaffolding.md), Task 3.

**Current state:**
`src/shared/components/**` is in `knip.json`'s `ignore` array. `FeatureErrorBoundary` and its `index.ts`
re-export have **no production consumer** until Phase 5 wraps the first feature route in it. Under
`knip --strict` (production mode, `src/**/*.{ts,tsx}!` entries), an exported-but-unconsumed symbol fails the
gate. Vitest tests exercise the boundary, but test files are knip-excluded, so they do not satisfy knip's
"used" check. The ignore suppresses the false positive until a real consumer exists.

**What it should be:**
Remove `"src/shared/components/**"` from `knip.json`'s `ignore` once Phase 5 imports `FeatureErrorBoundary`
to wrap a feature's top-level routed component. The export then has a production consumer and knip passes
without the ignore.

**Pull-forward trigger:**
Phase 5 (first feature extraction) — its plan's done-when removes this ignore and confirms `knip --strict`
stays green.

**Owner:** TBD.

**Resolved:** 2026-05-30 (Plan 24a Phase 5a, Task 5). Phase 5a wraps the market-research route in
`FeatureErrorBoundary` (`App.tsx`); `"src/shared/components/**"` removed from `knip.json` `ignore` and
`knip --strict` stays green.

---

## TD-FE-15 — Cross-feature index-only lint enforcement deferred (zone boundaries only)

**Date logged:** 2026-05-29
**Origin:** Plan 21a Phase 4a (plans/21a-frontend-phase-4a-scaffolding.md), Task 6.

**Current state:**
`eslint.config.js` enforces the cross-zone boundaries (`shared ↛ features`, `ui ↛ features|shared`) but **not**
the "import feature B only via `B/index.ts`" rule. The Task 6 spike tried `import-x/no-internal-modules` with an
allow-list: the **positive probe passed** (it flagged a deep `@/features/<x>/internal` import while allowing the
`@/features/<x>` index import), but the **no-regression check failed** — the rule forbids _all_ deep imports by
default, so it flagged 95 pre-existing, legitimate imports: ~85 relative deep paths (`./pages/Login`,
`../helpers/login`, `../fixtures/*`, …) plus external package subpaths (`firebase/auth`, `react-dom/client`,
`vitest/config`, `msw/node`, `@testing-library/jest-dom/vitest`). The allow-list cannot enumerate those cleanly
— external subpaths are unbounded. Per Spec 21 §2.6 item 2, 4a ships zone boundaries only rather than blocking
on an uncertain mechanism. (The positive probe did confirm the import-x engine + resolver evaluate
`src/features/**` — the rule fired there — so the zone rules are vacuous only for lack of real features, not
silently disabled.)

**What it should be:**
Express "cross-feature imports go only through `index.ts`". Re-attempt once real features exist (Phases 5–6),
gating on the same positive probe. Angles surfaced by this spike:

- Invert `import-x/no-internal-modules` to its **`forbid`** form (e.g. `forbid: ["@/features/*/*",
  "@/features/*/**"]`), which forbids only deep-feature paths and leaves other deep imports (relative, external
  subpaths) alone — sidestepping the unbounded allow-list. Confirm it does not also catch the `@/features/<x>`
  index.
- Or adopt `dependency-cruiser` for this one constraint (Spec 14 §3.3 fallback).

**Pull-forward trigger:**
Phase 5 or 6 (second real feature exists, so a genuine cross-feature import can be tested) — whichever first
adds a feature that imports another feature.

**Owner:** TBD.

**Resolved:** Phase 6 (stage 1b) — `import-x/no-internal-modules` (forbid `@/features/*/!(index)`, `@/features/*/!(index)/**`) added to `frontend/eslint.config.js`; same-feature imports converted to relative; cross-feature import is index-only.

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

## TD-FE-18 — market-research dead code (8 files, no live importer) awaiting the 5i sweep

**Resolved:** 2026-06-03 (Plan 24i Phase 5i dead-code sweep). All 8 files deleted in commit `31c6ef7` — `CompetitorAnalysis`, `CompetitorAnalysisDrawer`, `ComponentStatusLoadingScreen`, `DataHistoryDialog`, `EmergingTrends`, `EmergingTrendsDrawer`, `RecentMarketResearch`, `ScoutCapabilities` — with `tsc` + `knip --strict` confirmed green on the phase branch and on merged `master` (`d88b813`). Original entry preserved below.

**Date logged:** 2026-05-30
**Origin:** Plan 24a Phase 5a (plans/24a-frontend-phase-5a-relocate.md), Task 0 import trace.

**Current state:**
The 5a whole-dir import trace found 8 files in `src/components/market-research/` with **zero live importers** (knip does not flag them because `knip.json` `entry` makes every `src/**` file a production entry): `CompetitorAnalysis.tsx`, `CompetitorAnalysisDrawer.tsx` (only importer is dead `CompetitorAnalysis`), `ComponentStatusLoadingScreen.tsx`, `DataHistoryDialog.tsx`, `EmergingTrends.tsx`, `EmergingTrendsDrawer.tsx` (only importer is dead `EmergingTrends`), `RecentMarketResearch.tsx`, `ScoutCapabilities.tsx`. They are annotated `// DEAD CODE → delete in 5i` in place (5a Task 4).

**What it should be:**
5a is mechanical/parity, so it does **not** delete them (deletion is Spec 24 §7's 5i dead-code-sweep scope). 5i deletes all 8 and confirms `knip --strict` + `tsc` stay green. (`CompetitorAnalysisDrawer` and `EmergingTrendsDrawer` were repointed in 5a Task 2 to import the moved `AIPromptingInterface` via `@/features/...` so `tsc` stays green while they await deletion.)

**Pull-forward trigger:**
Spec 24 §7 (sub-phase 5i). Earlier only if one of these files becomes a build/parity liability before 5i.

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

## TD-FE-22 — MarketEntrySection owns a data fetch but has no `<FeatureErrorBoundary>` wrapping

**Resolved:** 2026-06-03 (Plan 24i Phase 5i close). Decision finalized per the 2026-06-02 update below: **no section-level boundary**. The intelligence surface is already wrapped one level up (`IntelligenceTab.tsx` → `<FeatureErrorBoundary featureName="Market Intelligence">`) plus the `App.tsx` route-level boundary; per-section boundaries would be redundant and inconsistent across the five sibling sections (5d–5h all inherited the same choice). No code change. Original entry preserved below.

**Date logged:** 2026-06-01
**Origin:** Plan 24d Phase 5d impl review round 1 (`docs/reviews/phase-5d-market-entry-impl-review-1.md` Nit "No `<FeatureErrorBoundary>` wrapping"). Plan Task 4 Step 5 marked the boundary **optional**.

**Current state:**
`MarketEntrySection` now owns its own data fetch via `useMarketEntry` (5d moved the read path into the section), but the section itself is not wrapped in `<FeatureErrorBoundary>`. A render/parse crash inside market-entry would propagate up to the intelligence tab rather than being contained to the section. A page-level boundary already exists (the market-research route is wrapped — see Spec 24 §2 / TD-FE-14 resolution), so a crash is caught at the page, not the whole app — but not isolated to the one section.

**What it should be:**
Optionally wrap `MarketEntrySection` (or each extracted section, as a 5e–5h pattern) in `@/shared/components`'s `FeatureErrorBoundary` so a single section's fetch/render failure degrades only that section. Cheap to add (one wrapper) if section-level isolation is judged worth it.

**Why we deferred:**
- Plan 24d Task 4 Step 5 explicitly marked it optional, and a page-level boundary already provides app-level containment at 0 live users (pre-launch gate posture: advisory over hard-fail).
- Better decided once as a consistent pattern across all five sections (5d–5h) than bolted onto market-entry alone.

**What we lose by staying as-is:**
- A market-entry render/parse crash takes down the whole intelligence tab (caught at the page boundary) rather than being isolated to the section.

**Pull-forward trigger:**
- The 5e–5h section extractions — decide section-level `FeatureErrorBoundary` as a uniform pattern there — or earlier if a market-entry crash is observed disrupting the rest of the intelligence tab.

**Owner:** TBD.

**Update (2026-06-02, Plan 24e / 5e):** Decision made for the uniform pattern — **no section-level boundary added.** The intelligence surface is already wrapped one level up (`IntelligenceTab.tsx` wraps `<MarketIntelligenceSections>` in `<FeatureErrorBoundary featureName="Market Intelligence">`, plus the `App.tsx` route-level "Market Research" boundary). Per-section boundaries would be redundant with that and inconsistent across siblings. `RegulatoryComplianceSection` (5e) follows the same no-section-boundary convention as `MarketEntrySection` (5d). This TD remains open only as the record of that decision; close it (or the remaining 5f–5h sections inherit the same choice) at 5i.

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

## TD-FE-32 — Feature phase-number disagreement: master Spec 14 §4 vs features/README naming map

**Resolved:** 2026-06-03 (Phase 6 pre-planning). Reconciled `frontend/src/features/README.md`'s naming map to the master Spec 14 §4 phase sequence — the authoritative, kept-current source per Spec 14 §7 R7 (§4 is internally consistent: Phase 8 = signals + strategist, Phase 9 = scout + profiler, Phase 10 = settings + tenant + auth). Changes: `signals` 6→8, `scout` 8→9, `settings` 11→10 (`strategist`=8, `customers`=7, `mission-control`=6, `auth`/`tenant`=10 already agreed). The by-name handoff convention (Spec 24 §7) stays the robust default. Original entry preserved below.

**Date logged:** 2026-06-03
**Origin:** Phase 5 close (24i). Surfaced (not caused) by Phase 5 — recorded at the Phase 5 close per Spec 24 §9 delta 4.

**Current state:**
Master Spec 14 §4 numbers the feature phases signals=8, scout=9, settings=10; `frontend/src/features/README.md`'s naming map numbers them signals=6, scout=8, settings=11. This is pre-existing drift between the two sources, surfaced (not caused) by Phase 5. To stay unambiguous, handoff tables (e.g. Spec 24 §7) reference target features **by name**, never by phase number.

**What it should be:**
One source of truth for feature→phase numbering, with the master plan and the `features/README.md` naming map reconciled to agree.

**Why we deferred:**
- Reconciling is a cross-cutting edit affecting Phases 6–13 planning; it is out of scope for 5i (finalize-only).
- Recorded at the Phase 5 close (Spec 24 §9 delta 4).

**Pull-forward trigger:**
- The next phase that plans against the numbering (Phase 6/7 pre-planning) reconciles it, or whichever phase first hits an ambiguity the by-name convention cannot resolve.

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

**Owner:** TBD.

## TD-FE-47 — Phase 12 features still import legacy `@/hooks/usePageTitle`

**Current state:**
`features/calendar`, `features/reports`, and `features/artifacts` import `usePageTitle` from the legacy `@/hooks/usePageTitle` rather than a `@/shared/hooks` home.

**Why we deferred:**
Spec 14 §4's staging rule — Phase 11 promotes shared hooks; feature phases must not pre-extract shared infra ahead of it.

**Pull-forward trigger:**
Phase 11 (shared-hooks promotion).

**Owner:** TBD.

## TD-FE-48 — Artefacts cross-component coupling via untyped `window` CustomEvents

**Current state:**
`features/artifacts/pages/ArtifactsPage.tsx` listens on `window` for `CustomEvent("artifactsSearch")` and `CustomEvent("addArtefact")` (dispatched by the header). The coupling is untyped, global, and hard to test; it should be a typed feature/shared mechanism. Same class of debt as TD-FE-44.

**Why we deferred:**
Out of scope for Phase 12's parity-only relocation (behavior was frozen).

**Pull-forward trigger:**
Artefacts gets real data, or a shared search/event bus lands.

**Owner:** TBD.

## TD-FE-49 — Small-page surfaces are mock/placeholder (no backend)

**Current state:**
`features/{calendar,insights,reports,artifacts}` render hardcoded mock data with no API. They should be wired to real endpoints once those exist.

**Why we deferred:**
These products are not built yet; the pages are placeholder surfaces.

**Pull-forward trigger:**
Each product's backend exists.

**Owner:** TBD.

_Phase 12 note: TD-FE-47–49 numbers are provisional — Phase 8 also claimed 47+ on a sibling branch; the integrator reconciles the actual integers at merge._
