---
synthesizes_review: docs/reviews/31-frontend-phase-11-shared-utility-extraction-design-spec-review-2.md
artifact: specs/31-frontend-phase-11-shared-utility-extraction-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 2
---

## Round Recommendation

no

Reason: All 12 findings agreed and revised against live greps; the single substantive one (H1 — `rateLimitManager` is a shim → delete, not move) is resolved cleanly, and everything else is count/trace accuracy that §1.3 already delegates to the plan's full-trace step. No Critical/High and no new design surface remain — the spec's dispositions are converged.

## Agreed Findings

All findings verified true against live import greps on `master` @ `182cb8e`.

- **H1 (`rateLimitManager` disposition wrong).** Verified: it is an 11-line back-compat **shim** that re-exports *from* `@/shared/api/rateLimiter` (dependency runs shim → rateLimiter, the reverse of the round-1 claim), with **0 runtime importers** (the shim's "4 market-research consumers" already migrated) and only 2 test importers. Revised §1.3 / §2.1.4 / §3 tree / §4-E / §5.3: **delete** the shim; delete its identity test (`lib/__tests__/rateLimitManager.test.ts`); repoint `shared/api/__tests__/client.test.ts:16` to `@/shared/api/rateLimiter`.
- **M1 (`leadData` false "customers" consumer).** Verified: consumers are strategist (2) + score libs + residue — **no `customers` file**. §6 row corrected; the TD-FE-63 attribution dropped (disposition `→ shared/` still holds via strategist + market-research).
- **M2 (`use-toast` consumer list incomplete).** Verified: `shared/chat/ContextChat` + residue `LeadsTable` also import it (26 total sites). Added both to §1.3 row + §5.1 repoint list.
- **M3 (`cn` count 30 not 31).** Verified: exactly 30 `ui/` files import `@/lib/utils`. Corrected in §1.3 + §5.1.
- **M4 (`utils.test.ts` dual-subject split).** Verified: it imports both `cn` and `sanitizeAnswerText`. §5.1 + §2.1.7 now state it is **split** — `cn` cases → `components/ui/__tests__/`, `sanitizeAnswerText` cases → `shared/lib/__tests__/`.
- **L1 (main.tsx relative→alias).** §7 now notes the two CSS imports switch relative→alias (both resolve identically) and the plan follows the repo convention.
- **L2 (leadData bidirectional dep).** §6 now documents that the score libs import *from* `leadData`, so the cluster relocates leaf-first in 11d.
- **L3 (rateLimitManager test deletion).** Covered by the H1 revision (§5.3) + the §2.1.7 exception.
- **L4 (§3 tree omits use-toast/use-mobile).** §3 tree now lists all three co-located `ui/` utilities.
- **N1 (§1.3 use-toast row categories).** Folded into the M2 row fix (now lists feature + shared + residue + ui consumers).
- **N2 (stale TD-FE-63 parenthetical).** Folded into M1 — the false attribution is removed.
- **N3 (§5.3 "becomes a relative import" ambiguous).** Moot after H1 — §5.3 now says the shim is deleted, not moved.

Self-consistency fix surfaced during verification (beyond the review): §5.3 and §11-risk-2 still said "7 feature import sites" for `lib/api` — round 1 corrected the §1.3 table to 4 features/19 sites but not these two spots. Both updated to "19 sites / 4 features."

## Disagreed Findings

None. Every claim held up under live-grep verification.

## Deferred Findings

None. All findings were in-scope, low-cost, and applied this round.

## Severity Disagreements

- **M1 / M2 / M3 — agree finding, lean Low (reviewer: Medium).** These are consumer-count/trace accuracy fixes; the dispositions are unchanged and §1.3 already states counts are provisional estimates the plan re-validates via full trace. They matter for the plan's repointing checklist (so worth fixing — done) but do not alter a design decision.
- **H1 — agree finding and severity (High).** It was a genuinely wrong disposition (a no-op same-directory re-export) that the delete corrects.
- **M4 — agree finding and severity (Medium).** A real handling gap (the dual-subject test had no stated resolution), now specified.

## Open Questions

- **Residual count-precision risk is owned by the plan.** Two review rounds each surfaced count/trace inaccuracies (round 1: missed `ui/` consumers + `lib/api` 7→4; round 2: `cn` 30, `leadData` customers, `use-toast` omissions, `rateLimitManager` direction). The **dispositions** are now all verified correct; the residual risk is purely numeric precision, which §1.3 explicitly delegates to the plan's pre-move full trace. The plan should treat §1.3/§5/§6 counts as a starting checklist to re-grep, not as authoritative totals.
