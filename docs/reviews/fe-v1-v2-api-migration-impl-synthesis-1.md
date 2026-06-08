---
synthesizes_review: docs/reviews/fe-v1-v2-api-migration-impl-review-1.md
artifact: feature/fe-v1-v2-api-migration
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-08
round: 1
---

## Round Recommendation

no

Reason: All six findings are Low/Nit and none survives as actionable — F2/F4/F5 rest on premises that are false in this repo (knip config, typecheck requirement, intended render), F1 is spec-mandated and verified safe, F3/F6 are sanctioned-as-is; nothing Critical/High remains. The only code change attempted (F4) broke typecheck and was reverted; one doc correction (spec §3.1) was applied.

## Agreed Findings

N/A — F4 was provisionally agreed, then **withdrawn on verification** (it breaks typecheck). See Disagreed Findings.

## Disagreed Findings

- **F1 [Low] service return shape `{ icps }` → `{ suggestedICPs }`** — The observation is factually correct, but no change is warranted. The new shape is the *explicit* spec requirement (R3: return `{ suggestedICPs }`), not incidental drift, so G5's "preserve verbatim" is subsumed by R3 for this read. The flagged risk ("a consumer reads `.icps` directly off the service → silently `undefined`") does **not** exist in the tree: the only raw consumer, `SuggestedICPCards.tsx:190`, immediately passes the result to `normalizeIcpGetResponse` (`icpMapping.ts:186`: `u.icps ?? u.suggestedICPs ?? u.results ?? u.items`), which tolerates both keys; the `useSuggestedIcps` hook path normalizes identically; and the `result.icps` reads at `SuggestedICPCards.tsx:600/607` are off `loadProfilerPagePayload`'s own contract, which never calls `fetchSuggestedIcps`. Vitest (782 pass) and the e2e customers render (the "Suggested" card now displays) confirm the chain works on the new shape. (The spec §3.1 table inaccuracy is real but documentation-only — see Open Questions.)
- **F2 [Low] `PaginatedResponse<T>` unused export "will be flagged by knip --strict"** — The knip premise is empirically false here. `knip.json` sets `entry: ["src/**/*.{ts,tsx}!", ...]`; the `!` suffix makes every `src` file a production entry, so all per-file exports are treated as used and unused-export detection does not fire on them (the deliberate config from the knip-production-traversal lesson). `npm run knip` (`knip --strict --no-progress`) exited 0 in the gate this session — `PaginatedResponse` is not flagged and the gate is not at risk. Keeping the type as wire-shape documentation for TD-FE-67 was an explicit spec-synthesis decision; no unexport or ignore directive is needed.
- **F5 [Nit] VR baseline nearly doubled in size (47,926 → 89,220 bytes)** — Verified intentional, sanity check already performed. The old baseline was a stuck "Generating ICPs" loading modal over a near-empty page (the old `buildIcpUrl` direct-host read was never intercepted by the exact-pathname e2e mock harness, so the query hung at capture). The new baseline is the fully-rendered settled page (populated CURRENT ICPS table + a RECOMMENDED ICPS card) now that the read resolves via `/api/v2/icp`. More rendered content → larger PNG; the size jump is the expected signature of the fix, confirmed by comparing the expected/actual/diff images.
- **F6 [Nit] spec/plan review artifacts committed alongside implementation** — Not a defect. The four `specs/`/`plans/` + `docs/reviews/` commits are the feature's authoring history under this repo's spec→plan→impl flow (CLAUDE.md), committed before implementation began and intended to travel with the feature; a `--no-ff` merge preserves them as the feature's record. Splitting them onto a separate branch would fragment that record for no benefit.
- **F4 [Nit] `env.items ?? []` is unreachable** (`missionControl.ts:19`) — **Correct at runtime, wrong as a fix.** `paginatedSchema`'s `z.array(item).default([])` does guarantee an array at runtime (Zod yields `[]` or throws), so the `?? []` never fires when executed. But it is **load-bearing for typecheck**: `apiGet<T>(endpoint, schema: ZodType<T>)` infers `T` from the schema, and the `.default([])` field under `.passthrough()` + the `ZodType<T>` (Input≡Output) unification resolves `env.items` to `unknown[] | undefined`. Dropping `?? []` produces `TS2322: Type 'unknown[] | undefined' is not assignable to type 'unknown[]'` against the `Promise<unknown[]>` signature (verified — the edit was made, broke `tsc`, and reverted). The plan's literal `return env.items;` (Task 2 Step 3) would not have compiled; the implementing agent's `?? []` is a justified deviation. No change — the fallback stays.

## Deferred Findings

- **F3 [Low] `FetchSignalsResponseSchema` no-op schema retained in `contracts.ts`** — Not dead (see Severity Disagreements): it is the source of `FetchSignalsResponse = z.infer<typeof FetchSignalsResponseSchema>` (`contracts.ts:4`), which is still `fetchSignals`'s return type, and knip does not flag it (in-file use + entry config). Plan Task 3 Step 3 explicitly sanctioned leaving it ("if still referenced, leave it"). Deferring the optional cleanup (inline the type as e.g. `Record<string, unknown>` and delete the schema). Trigger to revisit: a broader `signals/contracts.ts` tidy, or the TD-FE-67 follow-up that touches these contracts.

## Severity Disagreements

- **F3 — labeled "dead code"; it is load-bearing for a used type.** The const is a runtime no-op, but it is referenced on the next line by `z.infer` to produce `FetchSignalsResponse`, which `fetchSignals` returns. "Dead code" overstates it; the accurate framing is "an optional stylistic redundancy (schema-derived type where an inline type would do)," consistent with the `z.infer` pattern used throughout this repo's contracts files. Substance agreed; severity is at most Nit, not Low.

## Open Questions

- **Spec §3.1 table inaccuracy — RESOLVED (applied).** The §3.1 row-3 "Today (v1)" cell claimed v1 `fetchSuggestedIcps` returned `{ suggestedICPs }`; verified against `master` it returned the passthrough envelope (backend `{ icps }`). Corrected the cell to "passthrough envelope (backend `{icps}`)" and annotated the v2 cell with the `→ {suggestedICPs}` re-wrap (R3). Doc-only; the spec is unmerged so this is a pre-merge correction.
- **F4 fallback — RESOLVED (no change).** Investigated; the `?? []` is required by typecheck (see Disagreed F4). Reverted the trial edit. No further action.
- **Latent subtlety (optional, no action taken):** `env.items ?? []` reads as if `items` can be nullish on the wire, when in fact it's only nullish in the *inferred type* (`apiGet`'s `ZodType<T>` + `.default()` interaction), never at runtime. A one-line code comment could prevent a future reader from "cleaning it up" and re-breaking `tsc` — left to operator judgement since it touches a committed file.
