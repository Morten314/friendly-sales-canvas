# `src/shared/` — cross-cutting code shared across features

Code lands here when it is genuinely shared infrastructure, not one feature's property.

## Promotion criteria

- **The ≥2-feature rule.** A hook, utility, or type graduates to `shared/` only once **two or more features demonstrably import it**. A single-consumer utility stays in its feature.
- **No speculative promotion.** A feature needing a not-yet-shared utility keeps a local copy until a second consumer appears; the later phase that introduces the second consumer does the promotion (Spec 14 §7 R5).
- **API infrastructure is shared by definition** — `shared/api/` needs no ≥2 demonstration.
- **Cross-cutting client-state primitives** (`shared/auth/`, `shared/tenant/`) and **cross-cutting components** (`shared/components/`) follow the same "consumed app-wide infrastructure" logic. Their placement is recorded in `docs/adr/0002-cross-cutting-client-state-and-components-live-in-shared.md`.

## Subfolders

- `api/` — fetch client (`transport.ts`), zod contracts, query client/keys, the single rate limiter.
- `auth/` — app-wide React context primitives + `jwt.ts` + `useAuthToken.ts`.
- `tenant/` — app-wide tenant context primitive.
- `components/` — cross-cutting components, e.g. `FeatureErrorBoundary`.
- `hooks/` — `usePageTitle.ts` (≥6 feature consumers).
- `lib/` — `cacheUtils.ts`, `sanitizeAnswerText.ts`, `leadData.ts` (each consumed by ≥2 features).
- `types/` — `escape-hatches.ts` (consumed by ≥2 features).
- `styles/` — `index.css`, `scrollbar-hide.css` (`App.css` deleted as dead).
- `ui-patterns/` — created only if repeated UI patterns surface (none have; the folder does not exist).

## Dependency rule

`shared/` must **not** import from `features/` (enforced by `import-x/no-restricted-paths`). Shared code is consumed by features, never the reverse.

## Architecture decisions

Architecture decisions affecting this layer are recorded as ADRs — see [docs/adr/](../../../docs/adr/README.md).
