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
`src/lib/types/escape-hatches.ts` grew from 6 entries (TD-FE-9 baseline) to 13 entries during
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

**Pattern:** Same as TD-FE-9 — backend response/payload shapes consumed by FE before contract types
are written. Phase 2b's per-file pass routed remaining inline `any` through named aliases instead
of suppressing the eslint rule.

**Why deferred:**
Spec 18 §4 escape-hatches policy carry-forward from Spec 17 §2.4 posture rule 3. Backend contracts
are still out of scope.

**Pull-forward trigger:** Phase 13's audit re-evaluates per master spec line 298. Backend contract
typing (Phase ~10+) would unlock replacing these with proper types.

**Owner:** TBD.
