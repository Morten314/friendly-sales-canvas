---
synthesizes_review: docs/reviews/37-tech-debt-paydown-design-spec-review-1.md
artifact: specs/37-tech-debt-paydown-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-15
round: 1
---

## Round Recommendation

no

Reason: All findings (1 High, 5 Medium, 5 Low, 2 actionable Nit) agreed and revised inline; no Critical/High remains open, and the revisions are corrections/tightening, not new design surface. The two load-bearing code claims (TD-FE-42 shared transport, TD-012 handler count + invalid `:133`) were independently verified true.

## Agreed Findings

- **[High] TD-FE-42 stale path + overstated duplication** — Verified against code: `fetchIcpsRowsForOrg` (`shared/profiler/profileIcpsExtract.ts:52`, `Promise<unknown[]>`) is already shared by `useICPs` (`hooks/useICPs.ts:16`) and the customers service (`services/customers.ts:27`); both contracts are `.passthrough()` (`customers/contracts.ts:8`). Rewrote Wave 3 `Now` to say the **transport is already shared** and the path is `/api/v2/icp` (not `/api/icp`); narrowed the `Target` to "add one real zod schema at the shared `fetchIcpsRowsForOrg` site (replacing `unknown[]`/passthrough), consumed by both," not "unify two independent read paths." Broadened Wave 0 item 2 to capture the actual call chain (the `useICPs` test comment says it hits `/api/profile/company` + `/api/customer_profile`; the service comment says `/api/v2/icp`).
- **[Medium] Inconsistent headline counts (25/26/27)** — Set the §2.1 heading to "25 code entries + 2 doc-only (Wave 9)"; removed the stale bare "26" in §8. The reconciliation (25 code + 2 doc-only = 27 non-deferred) is now stated, not inferred.
- **[Medium] "2 stale" bucket never named** — §1 now maps the audit's "2 stale" explicitly to TD-FE-45 + TD-FE-48, closed doc-only in Wave 9.
- **[Medium] TD-012 under-scoped + invalid `:133`** — Verified: `connectors.py` is 130 lines (no `:133`); 7 `async def` handlers share the blocking-I/O pattern. Expanded the `Target` to flip **all 7** async handlers (noting `discover`/`discover_status`/`warmup`/`leads_export` were added by Spec 35 after TD-012 was logged — folding them in honours the "router-wide decision made once" rationale); fixed the citation to point at the service layer (`app/services/connectors/*`) rather than a nonexistent router line.
- **[Medium] Register-hygiene ledger muddled** — Replaced the "3 drift corrections + 2 doc/stale closes" framing (which double-counted TD-FE-45) with one explicit ledger in §6/§9: **narrow** TD-FE-40 + TD-FE-16 (code moved ahead of the register, resolved this phase); **close** TD-FE-45 (reconcile vs the Phase-9 `ChatWithHistory` shell) + TD-FE-48 (doc-only). §1's "drifted in three places" reworded to match.
- **[Medium] TD-FE-70/72 are additive, blurring the paydown framing** — §1.1 now flags TD-FE-70 (pager) and TD-FE-72 (refresh control) as the only two items that grow the product surface (slightly higher regression risk than the cleanup batch), and records TD-FE-72's keep as a deliberate decision (2026-06-15), not an open note.
- **[Low] TD-FE-56/66 leave an unresolved design fork** — Narrowed both `Target`s: TD-FE-56 → "a single parameterised form component (NOT a new shared-form framework — over-abstraction for 2 call sites at MVP)"; TD-FE-66 → "an in-flight ref guard" as the concrete concurrency mechanism, so the test shape is unambiguous.
- **[Low] Backend has no merge gate** — §3 and §9 now list "backend `pytest` (`backend/tests/`) green" as a merge criterion alongside `preflight`; the TD-005 grep guard is promoted to a hard gate.
- **[Low] TD-005 "FE migrated in Spec 34" uncited** — Cited the migrated callsite (`customers/services/customers.ts:80`, "GET /api/v2/icp (Spec 34 Task 4)" pattern) and made "grep finds zero FE/admin/probe callers" an explicit pre-condition before deletion, with passthrough as the defined fallback branch.
- **[Low] TD-FE-29 non-falsifiable acceptance** — Scoped the entry to the hardening with a concrete bar ("the VR spec passes 3/3 runs under a defined concurrent-preflight load reproduction") and moved the `preflight:par` flip to an explicit follow-up rather than part of this entry's done-state.
- **[Low] TD-FE-61 sessionStorage key string** — Wave 3 now states intent explicitly: rename the **type** only; keep the sessionStorage **key string** `"signalsChatContext"` unchanged (no needless ephemeral-storage migration).
- **[Low] No aggregate effort estimate** — Added a one-line feasibility roll-up to §3 (expected ~25–32 commits, wave-checkpointed, master merged-in if it advances) and recorded that single-branch is a deliberate user decision (Phase-6 precedent of 25 tasks/one branch), so the reviewer's split-into-2–3-branches alternative was considered and declined upstream.
- **[Nit] csvHelpers cited by basename** — Now `frontend/src/features/mission-control/components/data-sources/csvHelpers.ts:10-11`.

## Disagreed Findings

- **[Nit] TD-FE-73 could reconcile against in-repo source rather than be blocked** — Partially disagree. Agreed and added the clarifying note that excluding TD-FE-73 is a deliberate choice (live-confirmation preferred per the CLAUDE.md cross-stack rule). But the suggested alternative — reconcile the contract against the in-repo route (`signals.py:108`) — does not resolve TD-FE-73: the entry *is* "contract derived from code, not a live response," so re-deriving from the same code envelope is circular and adds nothing. A live deployed response is required, not merely preferred. The route existing in-repo doesn't change that.

## Severity Disagreements

None. The reviewer's severities are accepted as-is, including TD-FE-42 as High — a stale `Now` that implies redundant transport-dedup work would actively mislead the plan author, which justifies High over Medium.

## Open Questions

- **TD-012 scope vs the literal register entry.** Expanding to all 7 async handlers exceeds TD-012-as-logged (which names 3, pre-dating the Spec-35 discovery handlers). Folding them in is the consistent call and is now in the spec; if the team would rather keep TD-012 literal, the extra 4 split to a TD-012-follow. Flagged, non-blocking.
- **TD-FE-42 real call chain.** Whether `fetchIcpsRowsForOrg` calls `/api/v2/icp` directly or composes `/api/profile/company` + `/api/customer_profile` is unresolved from the review alone; Wave 0 item 2 now owns capturing it. The schema lands at the `fetchIcpsRowsForOrg` return either way, so this does not change the Target.
