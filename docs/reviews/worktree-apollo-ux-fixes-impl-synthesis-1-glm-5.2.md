---
synthesizes_review: worktree-apollo-ux-fixes-impl-review-1-glm-5.2.md
artifact: worktree-apollo-ux-fixes
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-23
round: 1
---

## Round Recommendation

no

Reason: No Critical/High findings; one Medium (data-layer bypass) plus Low/Nits, all agreed-and-fixable in place or deferred — apply the fixes; the change surface is too small to warrant another full review round. (If the F1 reuse refactor ends up touching the `customers` barrel, a one-file re-review of `LeadsTable.tsx` is cheap and optional.)

## Agreed Findings

- **F1 [Medium] — LeadsTable hand-rolls `fetch(/v2/leads)`, bypassing the data layer and duplicating the `/v2/leads` parser.** Correct on every point. Route the new real-leads loader through the shared data layer (`apiGet` + a validated zod schema) instead of a raw `fetch` + manual JWT header + untyped `Record<string, unknown>` parse, and drop the duplicated `pickCompanyName`/`pickLeadDisplayName` field-picking. Verified the reviewer's pagination claim against current code: `customers/hooks/useLeads.ts` is now an **offset-paged infinite query** (not first-page-only — my earlier TD-FE-70 recollection was stale), so the hand fetch's `limit:500` cap is a genuine correctness gap, not just a style issue — an org with >500 leads renders an incomplete Scout list while Customers paginates fully. Fix removes both the drift hazard and the cap.
- **F2 [Low] — Tier filter silently hides the new unscored Apollo leads.** Correct. `tierFiltered` (`LeadsTable.tsx`, `l.scored !== false && l.priority === tierFilter`) drops every unscored lead under any named tier, so the leads this branch exists to surface vanish the moment a user filters. Add a filtered-empty-state hint (e.g. "N unscored leads are hidden by this filter — show All") so it isn't a silent dead-end.
- **F4 [Nit] — New `/v2/leads` fetch fails completely silently.** Correct, and exactly the silent-failure class the RCA spent S5/S6 untangling. Add a one-line `console.warn` in the `catch` (matching `refresh()`'s pattern in `useSignalLeadMap.ts`) while keeping the fetch best-effort.

## Disagreed Findings

None. All four findings are technically accurate against the current branch code.

## Deferred Findings

- **F3 [Nit] — Numeric `retry: 2` retries deterministic failures (parse throws / 4xx).** Real but low-impact (endpoint is warm-200; the costly case is a parse throw on a malformed-200, which is rare). Deferred and **bundled with the RCA's P2-6 hardening** (`safeParse` + typed transport errors). Rationale: a retry *predicate* that skips non-transient failures today would have to sniff the status code out of `apiFetch`'s untyped `Error("HTTP error! status: …")` string (fragile); the clean version arrives once P2-6 introduces `safeParse`/typed errors and removes the throw path. **Trigger:** when the lead-map transport is hardened (P2-6) or typed API errors land.

## Severity Disagreements

None. F1 as Medium is fair — with Customers now paginating, the >500 cap is a correctness gap, and the duplicate-parser/data-layer-bypass is the exact "shapes drift silently" hazard AGENTS.md calls out, so it's more than cosmetic.

## Open Questions

- **F1 reuse path:** two clean options — (a) expose the paginated `useLeads`/`fetchLeads` through `customers/index.ts` and map `CustomerLead → HeatmapLead` at the call site (DRY, fixes >500 via the existing infinite query, but couples market-research → customers), or (b) a market-research-local `apiGet` + a minimal `/v2/leads` schema with its own pagination (no cross-feature coupling, slight schema duplication). Leaning (a) since it also resolves the pagination cap for free; operator may prefer (b) to avoid the cross-feature dependency. Note: the `LeadsTable.realLeads` test currently stubs global `fetch` — it will need re-pointing at whichever data-layer entry the fix uses.
- **F2 representation:** unscored leads carry a placeholder `priority: "Tier 3"`, so *un-hiding* them under the real "Tier 3" filter would itself mislead. The empty-state hint (or a dedicated "Unscored" filter option) is preferred over un-hiding — confirm that's the intended UX.
