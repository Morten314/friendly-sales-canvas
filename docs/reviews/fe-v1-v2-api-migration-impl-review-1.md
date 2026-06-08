---
artifact: feature/fe-v1-v2-api-migration
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-08
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Findings

### [Low] `fetchSuggestedIcps` service-level return shape changed from `{ icps }` to `{ suggestedICPs }`

**Location:** `frontend/src/features/customers/services/customers.ts:48`, `frontend/src/features/customers/hooks/__tests__/useSuggestedIcps.test.tsx:19`

The old service was `SuggestedIcpsResponseSchema.parse(json)` where the backend returned `{ icps: [...] }`. The passthrough-union schema let the `icps` key through verbatim, so the hook's data was `{ icps: [...] }` (confirmed by the old test assertion: `expect(result.current.data).toMatchObject({ icps: [{ id: "r1" }] })`).

The new service does `SuggestedIcpsResponseSchema.parse({ suggestedICPs: env.items })`, so the hook now receives `{ suggestedICPs: [...] }`. The test assertion changed accordingly.

This is spec-compliant (R3 says `{ suggestedICPs }`) and **functionally harmless** — the downstream consumer `normalizeIcpGetResponse` (`icpMapping.ts:167`) handles both `icps` and `suggestedICPs` keys. But spec G5 says "preserve every consumer's existing behavior verbatim," and the service-level shape did change. The spec §3.1 table incorrectly claims the v1 code already returned `{ suggestedICPs }` — it returned `{ icps }` in practice. If any consumer bypasses the normalizer and reads `.icps` directly, it would silently get `undefined` now.

Severity kept at Low because the normalizer is the sole consumer and is resilient.

### [Low] `PaginatedResponse<T>` interface exported but never imported

**Location:** `frontend/src/shared/api/pagination.ts:9`

`PaginatedResponse<T>` is exported from the new module but never imported or referenced anywhere in the codebase. All three services use `paginatedSchema` and extract `.items` directly. The spec synthesis explicitly decided to keep this as "wire-shape documentation" for future TD-FE-67 work. However, `knip --strict` (part of the preflight gate) will flag this as an unused export. Either it should be unexported until TD-FE-67, or a `knip` ignore directive should be added.

### [Low] `FetchSignalsResponseSchema` runtime schema is dead code

**Location:** `frontend/src/features/signals/contracts.ts:3`

The `FetchSignalsResponseSchema` const was removed from the `signals.ts` import but not deleted from `contracts.ts`. The const is a `z.object({}).passthrough()` — it validates nothing at runtime. It's only needed because `FetchSignalsResponse = z.infer<typeof FetchSignalsResponseSchema>` on line 4, and that type is still used as the return type of `fetchSignals`. A future cleanup could replace the type with an inline `Record<string, unknown>` and delete the dead schema. Harmless for now but slightly messy.

### [Nit] `env.items ?? []` fallback in `fetchDataSources` is unreachable

**Location:** `frontend/src/features/mission-control/services/missionControl.ts:14`

The `paginatedSchema` definition uses `z.array(item).default([])`, so `env.items` can never be `null` or `undefined` — Zod either produces `[]` or throws. The `?? []` is dead code. Harmless but slightly misleading; a reader might infer that `items` can be nullish on the wire.

### [Nit] Visual regression baseline nearly doubled in size

**Location:** `frontend/e2e/journeys/06-customers-page-load.spec.ts-snapshots/01-customers-page-chromium-linux-linux.png` (47,926 → 89,220 bytes)

The regenerated customers-page baseline is 86% larger. The commit message ("regenerate customers-page VR baseline for /api/v2/icp") suggests the mock shape change produced more rendered content. Worth a sanity check that the visual output is intentional — the size jump is unusual for a mock-shape-only change.

### [Nit] Spec/plan review artifacts committed alongside implementation

**Location:** `docs/reviews/34-frontend-v1-v2-api-migration-{design-spec,plan}-{review,synthesis}-1.md`

Four review-process documents are included in the branch diff. These are the spec/plan review cycle artifacts, not implementation. Not harmful, but the branch mixes process authoring history with implementation commits.
