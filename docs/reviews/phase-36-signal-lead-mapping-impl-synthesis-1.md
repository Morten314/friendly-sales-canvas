---
synthesizes_review: phase-36-signal-lead-mapping-impl-review-1.md
artifact: phase-36-signal-lead-mapping
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-15
round: 1
---

## Round Recommendation

no

Reason: No Critical/High findings — all five are Low/Nit. Verifying each against the branch (HEAD `2fe6077`) reclassified the one initially-agreed nit (`staleTime`) to disagreed: `useSignalLeadMap` already inherits the global QueryClient defaults (`staleTime: 5min`, `refetchOnWindowFocus: false`), so finding 5's premise does not hold. Nothing is actionable in code; the rest are by-design or already-tracked deferrals. No further review round is warranted.

## Agreed Findings

None. (Finding 5, the `staleTime` nit, was initially agreed but reclassified to Disagreed after verifying the global QueryClient config during application — see below.)

## Disagreed Findings

- **Nit (finding 5) — "no `staleTime`, re-POSTs on every mount/focus" — does not hold.** `useSignalLeadMap`'s `useQuery` sets only `enabled`/`queryFn`/`retry:false` and does **not** override `staleTime`, so it inherits the global QueryClient defaults in `frontend/src/shared/api/queryClient.ts`: `staleTime: 5 * 60_000` (5 min) and `refetchOnWindowFocus: false`. Refocus therefore never refetches, and a remount within 5 min is served from cache; the three consumer surfaces share one `qk.signalLeadMap(orgId, userId)` key, so at most one refetch per 5 min occurs across all of them. The finding assumed React Query's library default (`staleTime: 0`); this app overrides it. The suggested fix (`staleTime: 60_000`) would *shorten* the window to 1 min and slightly **increase** refetches — not applied.
- **Low (the "truncated mapping is cached and served" half of finding 2) — does not hold as a defect.** Caching the recovered partial is intentional degrade-gracefully behavior, not a bug. Verified in `lead_map.py`: the *full-failure* path already skips the cache (line 219 returns an empty mapping with no write); only a structurally-truncated-but-recoverable response reaches the cache write. Forcing a recompute on truncation would be strictly worse — `_parse_mapping` doesn't surface a "was recovered" flag, and a genuinely oversized input set that keeps truncating would re-pay an expensive Claude call on every mount forever. Serving a stable partial and letting the input-set fingerprint bust it is the correct trade. (The *separate* "refresh is unreachable from the UI" half of this finding is real — see Deferred.)
- **Low (the "no test asserts the stub returns 0" sub-point of finding 3) — correctly omitted.** A test pinning `getLeadCountForICP() === 0` would lock in a placeholder that TD-FE-69 explicitly slates for removal once a real per-ICP count endpoint exists; it would be deleted with the stub. Negative-value churn — leaving it untested is right.

## Deferred Findings

- **Low — only the signal `headline` reaches the LLM, yet the prompt matches on "company mention in the signal."** Accurate: `_signals_for_prompt` serializes `{signal_id, headline}` only, while the prompt's MATCHING RULES reference company mentions that live in `description`/`snippet`/`sourceLabel`. Deferred. Reason: a recall-quality gap, not a correctness defect (id hygiene intact, no error path); CLAUDE.md's Business State explicitly waives quality SLAs at 0 users; and the rule is not vacuous — signal headlines routinely carry the company name, so headline matching partially satisfies it. Trigger: the first relevance-quality tuning pass against real signals + leads. Cheap mitigation when touched — either narrow the MATCHING RULES to headline-only (1-line prompt edit, makes prompt + payload agree) or add a trimmed `snippet`/`description` slice to `_signals_for_prompt`. Recommend a TD entry.
- **Low — the `refresh` escape hatch (spec §5.4) is inert end-to-end.** Confirmed: the hook calls `fetchSignalLeadMap(userId, orgId)` with no opts, so `refresh` defaults to `false`, and no UI surfaces a recompute action. Deferred. Reason: a recompute/refresh control is a deferred FE feature outside plan-36's scope; at 0 users a map that's stale until the org's signal/lead id-set changes is low-impact. Trigger: the first real org reports a stale or low-quality map. Recommend a TD entry.
- **Low — `getLeadCountForICP` stub shows "0 leads" on every Suggested ICP card.** Already tracked as **TD-FE-69** with a documented pull-forward trigger (a real per-ICP count endpoint); the reviewer flagged it for visibility, not action. No new action — the prior counts were mock-derived, so this is an intentional, recorded regression, not a defect.
- **Nit — type-unsafe zod cast in `fetchSignalLeadMap` (`SignalLeadMapResponseSchema as ZodType<SignalLeadMapResponse>`).** Accurate but accepted. Reason: `.default()`/`.catch()` legitimately diverge zod's input/output types from the `ZodType<T>` contract `apiPost<T>` expects; the cast is a localized, idiomatic workaround for a known zod papercut and is runtime-correct (the schema, not the cast, defines the parsed shape). Structural alternatives (3-arg `ZodType`, schema restructuring) add complexity for zero runtime benefit. Trigger: if `SignalLeadMapResponse` and the schema's inferred output drift apart, replace the cast with a structural fix or a shared inferred type.

## Severity Disagreements

None material. (Finding 3 reads more as informational/already-tracked than a fresh Low, but that's not worth contesting.)

## Open Questions

None outstanding. Resolution (2026-06-15, user-approved):

- The `staleTime` nit was **not applied** — verification showed `useSignalLeadMap` already inherits a 5-min `staleTime` + `refetchOnWindowFocus: false` from the global QueryClient, so the change would be counterproductive (see Disagreed).
- The two deferrals were recorded as **TD-FE-71** (prompt/payload coherence) and **TD-FE-72** (`refresh` UI control) in `docs/TECH_DEBT.md` on branch `phase-36-signal-lead-mapping`. (Numbers allocated against this branch's register; if a parallel branch claimed those integers, reconcile at merge — per the renumbering precedent already in TECH_DEBT.md.)
