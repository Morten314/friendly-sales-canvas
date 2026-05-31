---
synthesizes_review: docs/reviews/24b-frontend-phase-5b-data-layer-plan-review-2.md
artifact: plans/24b-frontend-phase-5b-data-layer.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-05-30
round: 2
---

## Round Recommendation

yes

Reason: Finding 5 is correct but under-scoped — verifying against the repo shows the load-bearing parity gate (`journeys/04`) uses its own inline wrong-envelope mock and `apiRequest.parse` throws post-rewire, so the gate is a false-green that defeats abort-criterion-4; the mock-correction + render-assertion fix reopens Tasks 6/7, and Finding 2 is a real behavioral correction — another round is warranted.

## Agreed Findings

- **[Finding 1, Medium] Per-component verification in Task 6 Step 1** — Add to Step 1: where a component's hook/fetch-fn/cache-read/`useState` are independent, run `tsc --noEmit -p tsconfig.app.json` after wiring each before moving to the next, turning the monolithic diff into incremental checkpoints. Caveat encoded in the step: the page also has a shared cascade/smart-refresh orchestration (`result.results.forEach`, `componentStatus` tracking at `MarketResearchPage.tsx:1929`/`:2316`) that couples components; where that orchestration references multiple setters, those land together and `tsc` is run after the batch. (Severity disagreement below.)
- **[Finding 2, Medium] `useRegenerateResearch` double-POST** — Confirmed: `apiPost`→`apiRequest` issues the POST and `onSuccess` `invalidateQueries` marks the active `useResearchComponent` stale → background refetch → a second `POST /market-research` (`refresh:false`). Revising Task 5 Step 4 to populate the cache directly via `queryClient.setQueryData(qk.marketResearchComponent(orgId, componentName), data)` instead of `invalidateQueries` — avoids the second rate-limited POST and the risk that a `refresh:false` refetch returns server-stale data overwriting the just-regenerated report. ADR-0004 gains a one-line note: "invalidate-on-success double-fetches POST-backed queries; we use `setQueryData`; revisit if a future query genuinely needs server reconciliation."
- **[Finding 3, Medium] §9 delta omits §4.1 correction** — Broadening the Task 7 Step 6 §9 delta to record that spec §4.1's endpoint inventory is superseded: market-research is POST-only (no GET / no `?_cb&_r` load), the envelope is `{ status, data }`, and there is no load-all/array response. (Currently the §9 delta records only the §4.2 analysis-tab exclusion; the §4.1 corrections live only in the plan's "Endpoint reality" + Self-review notes, not in the durable spec-back-annotation channel.)
- **[Finding 4, Low] Task 7 Step 4 spot-check is non-agent-executable** — Agree the "open dev server, visually verify five sections" step cannot be performed by an executing agent. Relabeling it explicitly as a human-controller check at merge, and — tied to Finding 5 — adding a `toBeVisible` assertion on at least one rendered section's content to `journeys/04` so the integrated render path has an automated floor. (Remedy disagreement below: not throwaway Vitest section-smoke tests.)
- **[Finding 5, Low → High] Wrong-envelope E2E mock is uncorrected** — Confirmed and broader than the review states. The parity gate `journeys/04` does **not** use `e2e/fixtures/api-mocks.ts`; it defines its **own inline** `page.route("**/api/market-research")` returning `{ component_name, status:"completed", result, cached }` (no `data`). `apiRequest` does `schema.parse(json)` and throws on mismatch; `ResearchComponentSchema` **requires** `data`, so post-rewire the page hooks throw on every journey response while the journey still passes (it asserts only `marketResearchRequestCount > 0`). Adding a task step (Task 6 dead-code/rewire or a new Task 7 sub-step) to correct **both** the `journeys/04` inline mock and `api-mocks.ts` to `{ status:"success", data:{…} }`. This is safe: the section components already read `result.status === "success" && result.data` (`IndustryTrendsSection.tsx:348`, `MarketSizeSection.tsx:495`, `RegulatoryComplianceSection.tsx:616`, `MarketEntrySection.tsx:2159`), so a `{status,data}` mock aligns both the old section path and the new hook path. (Severity disagreement below.)
- **[Finding 6, Low] Task 4 Step 5 omits the green-confirm command** — Confirmed: Step 5's commands are only `git add`/`git commit`. Adding `npx vitest run src/features/market-research/services/__tests__/marketResearch.test.ts` before the commit, matching Task 2 Step 4's convention.
- **[Finding 7, Nit] ADR `git add` hardcodes 0003/0004** — Revising Task 7 Step 3 to reference the chosen numbers via a glob (`git add docs/adr/000*-market-research-*.md`) or to capture the picked numbers into a variable, consistent with the Step preamble's "pick the next two available after `ls docs/adr/`."

## Disagreed Findings

- **[Finding 4, remedy] Throwaway Vitest section-smoke tests** — Disagree with the specific remedy of rendering each section component in isolation under `QueryClientProvider` + MSW now. The five section components are pre-migration raw-`fetch` monoliths (e.g., `MarketEntrySection.tsx` is ~2,100+ lines) slated for decomposition in 5d–5h; smoke tests written against them in 5b test the soon-dead path, carry heavy setup (auth/tenant/routing context), and are superseded within weeks. The better automated floor is strengthening `journeys/04` (already in preflight, exercises the integrated path) to assert rendered content — which is why Finding 4's *problem* is agreed and routed through the Finding 5 mock fix. Per-section assertions remain correctly deferred to 5d–5h.

## Deferred Findings

(none)

## Severity Disagreements

- **[Finding 1] Medium → Low.** Agree with the finding, disagree with severity. The core rewire risk (a broken checkpoint with no recovery) is already covered by the pre-Task-6 rollback anchor and the Step 2 bisection checkpoint. Per-component `tsc` improves *which-of-5* attribution but is an incremental-verification nicety, not a correctness gap — Low.
- **[Finding 5] Low → High.** Agree with the finding, disagree with severity — upward. Post-rewire the uncorrected envelope makes the page hooks' `.parse` throw on every `journeys/04` response, yet the journey passes (it counts requests, not renders). That renders the plan's primary automated parity gate a false-green and means abort-criterion-4 ("`journeys/04` can't be made green after rewire") can never fire — the safety net is silently disarmed. A defeated load-bearing gate is High, not Low.

## Open Questions

- The real backend `status` string: the corrected mock and MSW handlers use `status: "success"`, and the sections gate on `=== "success"`, but `journeys/04`'s legacy mock used `"completed"`. Task 1's live capture should pin the exact `status` value so the corrected mock matches what the sections render against (else a `{status:"completed", data:{…}}` mock still yields blank sections).
- Whether the shared cascade/smart-refresh orchestration (`MarketResearchPage.tsx:1929`/`:2316`) couples enough setters that Finding 1's per-component `tsc` checkpoints collapse back into one or two batches — resolvable only against the actual page during Task 6 Step 1, not from the plan.
