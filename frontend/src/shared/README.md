# `src/shared/` — cross-cutting code shared across features

Code lands here when it is genuinely shared infrastructure, not one feature's property.

## Promotion criteria

- **The ≥2-feature rule.** A hook, utility, or type graduates to `shared/` only once **two or more features demonstrably import it**. A single-consumer utility stays in its feature.
- **No speculative promotion.** A feature needing a not-yet-shared utility keeps a local copy until a second consumer appears; the later phase that introduces the second consumer does the promotion (Spec 14 §7 R5).
- **API infrastructure is shared by definition** — `shared/api/` needs no ≥2 demonstration.
- **Cross-cutting client-state primitives** (`shared/auth/`, `shared/tenant/`) and **cross-cutting components** (`shared/components/`) follow the same "consumed app-wide infrastructure" logic. Their placement is recorded in `docs/adr/0002-cross-cutting-client-state-and-components-live-in-shared.md`.

## Subfolders

- `api/` — fetch client, zod contracts, query client/keys, the single rate limiter (Phase 3).
- `auth/`, `tenant/` — app-wide React context primitives (Phase 4b).
- `components/` — cross-cutting components, e.g. `FeatureErrorBoundary` (Phase 4a).
- `hooks/`, `lib/`, `types/` — populated in Phase 11 as the ≥2-feature rule is met.
- `ui-patterns/` — created only if Phase 13 surfaces repeated patterns.

## Dependency rule

`shared/` must **not** import from `features/` (enforced by `import-x/no-restricted-paths`). Shared code is consumed by features, never the reverse.
