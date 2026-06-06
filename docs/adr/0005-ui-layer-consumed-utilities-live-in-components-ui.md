# ADR-0005 — UI-layer-consumed utilities live in `components/ui/`

**Status:** Accepted
**Date:** 2026-06-05

## Context

The dependency zones (Spec 14 §3.3, enforced by `import-x/no-restricted-paths`) say `components/ui/` (the locked shadcn primitives) may import only npm and itself — never `shared/` or `features/`. Phase 11 drains the legacy `src/hooks/` and `src/lib/` directories by promoting shared utilities to `src/shared/`. But three legacy utilities are imported by locked `ui/` primitives: `cn` (`@/lib/utils`, 30 `ui/` files), `useToast` (`@/hooks/use-toast`, `ui/toaster.tsx` + the prior re-export shim), and `useIsMobile` (`@/hooks/use-mobile`, `ui/sidebar.tsx`). Promoting any of them to `shared/` would force locked primitives to import upward, violating `ui ↛ shared`. Grepping every `ui/` import confirms these three are the complete set.

## Decision

We will co-locate ui-layer-consumed utilities **inside `components/ui/`**, not in `shared/`: `cn` → `components/ui/utils.ts`, `useToast` → `components/ui/use-toast.ts`, `useIsMobile` → `components/ui/use-mobile.tsx`. `ui/` files import them relatively (`./utils`, `./use-toast`, `./use-mobile`); non-ui consumers import `@/components/ui/*` (`features → ui` is allowed). This mirrors shadcn's own convention of shipping `cn` and the toast hook alongside its components.

## Consequences

The `components/ui/` zone rule ("npm + itself only") becomes true and is locked by the Phase 11e lint tightening. Future work that adds a shadcn component shipping its own hook/util follows this precedent: the hook lives in `components/ui/`, not `shared/`. A utility that is genuinely cross-feature **and not** consumed by a `ui/` primitive still goes to `shared/` under the ≥2-feature rule — this ADR is the narrow exception for the ui-primitive layer, not a general escape hatch. Reversing it (e.g. relaxing `ui → shared`) requires a superseding ADR.
