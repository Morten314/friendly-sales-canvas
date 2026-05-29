---
synthesizes_review: docs/reviews/21-frontend-phase-4-scaffolding-shell-design-spec-review-4.md
artifact: specs/21-frontend-phase-4-scaffolding-shell-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 4
---

Reacts to `review-4` (glm-5.1), the round-3 re-review. **No Critical or High findings** — the spec has converged. Findings are 2 Medium / 4 Low / 3 Nit; one Medium (M2) is factually incorrect and disagreed (verified against code). Applying the rest is light polish.

## Round Recommendation

**no**

Reason: No Critical/High findings remain; the agreed items are minor polish (all fixed in this round-4 pass) and the one disagreed Medium is factually wrong. Four rounds show clear convergence (round-1: 4 Critical → round-3: 1 Critical + 1 High → round-4: 0/0). Ready for plan-writing.

## Agreed Findings

- **M1 (§3.7 knip.json row misleading).** Agree — 4b never edits `knip.json` (the ignore-removal is Phase 5's). Changing the row to "No change in 4b — ignore-removal deferred to Phase 5; listed for traceability."
- **L1 (FeatureErrorBoundary logging unspecified).** Agree — §2.5 now states it logs via `console.error` in `componentDidCatch`, with an optional `onError` callback prop for pluggable reporting left to the plan.
- **L2 (§3.5 "2%" lacks units).** Agree — now "(2% pixel-diff threshold, per Phase 2c VR config)."
- **L3 (§3.2 "auth/tenant types" not enumerated).** Agree — now "plus any types the context file already exports" (the barrels re-export whatever the moved files expose).
- **L4 (§2.4 scaffolder README template content unspecified).** Agree — §2.4 now states the template reproduces §2.2's section structure (purpose / public surface / key files / dependency notes) as stub placeholders with the feature name filled in.
- **(self-caught) §9 `TD-FE-14` leftover.** A round-3 fix updated §3.6/§3.7/§3.8 to "next free number" but missed the §9 companion-docs line. Fixed now.

## Disagreed Findings

- **M2 (§3.2 "bidirectional folder coupling" is imprecise — "shared/tenant does not import from shared/auth").** Disagree — factually incorrect, verified: `contexts/TenantContext.tsx:4` does `import { useAuth } from "./AuthContext"`. After 4b that is `shared/tenant → shared/auth`. Placing `useAuth` in `shared/auth` would add `shared/auth → shared/tenant`, making the coupling genuinely **bidirectional** (auth↔tenant). The spec states this dependency in §1.2 and §3.2 ("`TenantContext` imports `AuthContext`"), so "bidirectional" is the accurate term, not an overstatement. The reviewer's own conclusion (leave `useAuth` in `hooks/`) is unchanged; only their objection to the wording doesn't hold. Leaving §3.2 as written.

## Deferred Findings

(none.)

## Severity Disagreements

(none — the severities assigned (2 Medium, 4 Low, 3 Nit) are reasonable; M2 is disagreed on substance, not severity.)

## Open Questions

- **N3 confirms synthesis-3's open question is resolved:** `react-refresh/only-export-components` checks the importing file's path against the override zones, and `shell/index.ts` ∈ `src/features/**`, which 4a's override (§2.6 item 4) covers — so the barrel co-export is silenced. No spec change needed. No open questions remain.

## Nits (noted, no action)

- **N1 (§2.9 table ordering).** Cosmetic; the table is "accurate and complete" per the reviewer. Not reordering — churn without functional gain.
- **N2 (§1.4 plan/branch naming).** Positive note, no issue.
