# ADR-0003 — Keep market-research zod contracts feature-local

**Status:** Accepted
**Date:** 2026-05-31

## Context

Phase 5b introduces zod contracts for the market-research API surface (the `{ status, data }` `MarketResponse` envelope). Phase 3 established two shapes for where contracts live: a cross-cutting `src/shared/api/contracts/` _directory_ for shapes consumed across features (e.g. `company-profile.ts`), and the option of a feature-local contracts file for shapes only one feature uses. Market-research's envelope is, today, consumed only by the market-research feature. We need a rule for where it lives that scales to Phases 6–12 without prematurely centralizing single-feature shapes.

## Decision

We will keep the market-research contract in a single feature-local file, `src/features/market-research/contracts.ts`, exporting `ResearchComponentSchema` / `ResearchComponentResponse`. A shape is promoted to `src/shared/api/contracts/` only when a **second** feature imports it. Phase 3's per-domain `contracts/` directory remains reserved for the cross-cutting shared surface; it is not the default home for a shape used by one feature.

## Consequences

- Single-feature shapes stay colocated with the feature that owns them — easier to find, change, and delete with the feature; no central file accreting unrelated domains.
- This sets the precedent for Phases 6–12: new feature contracts start feature-local.
- The promotion trigger is explicit and cheap: when a 2nd feature needs the shape, move the file to `shared/api/contracts/` and update imports. A future reader must not pre-emptively centralize market-research contracts without a real second consumer.
- The inner `data` report is intentionally kept opaque (`z.record(z.string(), z.unknown())`) here; per-section refinements are added as the sections are decomposed (5d–5h) and `.parse` the slice they render. Widening `data` to a concrete shape in this file is out of scope and should not be done — it varies per `component_name`.
