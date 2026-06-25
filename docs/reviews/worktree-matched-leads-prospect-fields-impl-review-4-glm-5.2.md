---
artifact: worktree-matched-leads-prospect-fields
artifact_type: impl
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-25
round: 4
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Change-context source: `git log -p master..worktree-matched-leads-prospect-fields`. Round 4, invoked after `…-impl-synthesis-3.md` (round:3) recommended `yes`. Spec 42 / plan 42 loaded from the worktree paths. Config loaded from the branch: `frontend/package.json`, `frontend/tsconfig.json`; `backend/pyproject.toml` absent.

This round reviews the round-3 High fix: commit `1dcbcd5` (lossless `mergeScoredOverReal` merge), `4844e3d` (test-comment R2→R3), `50a5aa0` (prettier). **The code fix is correct** — the wholesale `byId` overwrite was replaced with a field-level merge that carries the real `/v2/leads` row's `title`/`seniority` (and non-empty `name`/`company`) when the scored row's are empty, while the scored row's scoring fields (`ratings`/`totalScore`/`priority`/`scored`) win via the `...scored` spread. The regression test was also reworked to the real `LeadMarketScoreRow` shape (no fabricated prospect keys) and drives the actual `fetch → heatmapLeadFromUnknownRow → merge` path via the `scoutLeadStreamHeatmapRefresh` event listener — both directly answering synthesis-2/-3. The round-3 High is resolved in code. The one residual issue is test robustness.

## Findings

### [Low] The R3 regression test is false-green for the prospect-survival claim — its survival assertions resolve from the pre-merge render

**Location:** `frontend/src/features/market-research/components/lead-stream/__tests__/LeadsTable.realLeads.test.tsx:190-209` (the `Fix R3 — lossless` `it(...)` block); merge under test at `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx:345-360`.

The test sequence is:

```ts
renderTable();
expect(await screen.findByText("Jane Founder")).toBeInTheDocument();
window.dispatchEvent(new Event("scoutLeadStreamHeatmapRefresh"));
expect(await screen.findByText("VP Engineering")).toBeInTheDocument(); // (A)
expect(screen.getByText("CXO")).toBeInTheDocument();                    // (B)
expect(await screen.findByText("Tier 1")).toBeInTheDocument();          // (C)
```

`findByText` resolves on the **first** matching render within the timeout and does not re-monitor afterwards. Assertions (A) and (B) target `VP Engineering` / `CXO`, which are already in the DOM from the **pre-merge** real row (`REAL_WITH_PROSPECT` carries `title: "VP Engineering"`, `seniority: "CXO"`, rendered in the `{lead.title || "—"}` / `{lead.seniority || "—"}` cells before any scored data arrives). So (A) resolves immediately against the pre-merge render; (B) is a synchronous `getByText` that runs before the async `fetch → setState` merge completes. Neither is re-evaluated after the merge.

Consequence: under a **wholesale-overwrite regression** (the exact bug rounds 1–3 chased), the merged L1 row would be the scored row with `title: null, seniority: null` — but (A)/(B) already passed pre-merge, and the scored row still carries `combined_score: 80 → Tier 1`, so (C) passes too. The test therefore **passes under the regression it claims to guard** — it is false-green for the prospect-survival claim, the precise failure mode synthesis-2/-3 explicitly required the test to eliminate. (C) only proves "the merge applied the score," not "the merge preserved prospects."

Fix: evaluate prospect survival strictly **after** the merge is known to have run — await the merge-completion signal first, then synchronously assert presence:

```ts
expect(await screen.findByText("Tier 1")).toBeInTheDocument();          // merge ran
expect(screen.getByText("VP Engineering")).toBeInTheDocument();         // synchronous, post-merge → throws if dropped
expect(screen.getByText("CXO")).toBeInTheDocument();
```

Reordered this way, a wholesale-overwrite regression removes `VP Engineering`/`CXO` from the post-merge DOM and the `getByText` calls throw, making the guard deterministic. Low: the production fix is correct and complete; this is a test-robustness gap (the guard does not guard), not a code defect.

## Observations (no action)

- **Round-3 High resolved in code.** `mergeScoredOverReal` (`LeadsTable.tsx:345-360`) is correct: `present()` treats `null`/`""`/`"—"` as absent, so the scored row's unresolved `"—"` placeholders don't clobber a resolved real value; `...scored` preserves all scoring fields; the merge loop only enriches when a real row exists (`existing ? mergeScoredOverReal(existing, lead) : lead`), so scored-only leads render with `null` prospects (correct — nothing to backfill from). The round-2 mapper migration (`0e91f5f`/`d84d58d`) remains the necessary precondition (the real-row path that `title`/`seniority` are pulled from); correctly not reverted.
- **The test fixture is now genuinely real-shaped.** `SCORED_RESPONSE` mirrors `LeadMarketScoreRow` (`lead_name` + `company_name` + scores + `scoring_status`, deliberately no `title`/`seniority`), and the refresh is driven through the actual `addEventListener("scoutLeadStreamHeatmapRefresh", …)` path (`LeadsTable.tsx:550`) rather than pre-mapped injection. This part of the synthesis-3 requirement is met; only the assertion ordering (above) falls short.
- **Scope still isolated / no collateral.** Backend, signals card/PDF, and customers surface are untouched by this fix and remain faithful to spec/plan 42. No new findings there this round.
