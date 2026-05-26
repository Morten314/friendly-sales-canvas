---
synthesizes_review: docs/reviews/14-frontend-refactoring-master-plan-design-spec-review-3.md
artifact: specs/14-frontend-refactoring-master-plan-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-26
round: 3
---

## Round Recommendation

no

Reason: 11 findings — 5 Medium, 4 Low, 2 Nit; no Critical or High. All 11 are agreed and applied in round 3. The Mediums are residual peer-section consistency issues (same class as rounds 1+2 caught) that fall out cleanly; no new architectural surface area opens.

## Agreed Findings

- **Medium #1 — Phase 2b overview row contradicts detailed description.** Overview table still lists `import/no-restricted-paths` for Phase 2b, but Phase 2b detail and round-1-agreed sequencing puts features-specific rules in Phase 4. Removing `import/no-restricted-paths (rules from §3.3)` from the Phase 2b overview row; replacing with just `import/order`, Prettier check. Phase 4 overview row already correctly captures the deferred rules.

- **Medium #2 — Phase 8 cannot place chat-history primitive in `src/features/scout/` (doesn't exist yet).** Same class as round-2's Phase-5-5c finding. Removing `src/features/scout/` as a placement option from Phase 8's description — the shared chat-history primitive lands in `src/shared/` (which exists from Phase 4). Phase 9 can later alias/own it from scout if it wants.

- **Medium #3 — Phase 8 lacks authority to dedupe ProfilerChatWithHistory (lives in Phases 6/7's scope).** §5.5 scope discipline rule forbids it. Phase 8 extracts `ScoutChatWithHistory` into `src/features/signals/` and records the dedup opportunity as a handoff annotation. Phase 9 (scout + profiler) owns the actual deduplication — it has authority over both scout and profiler surfaces and coordinates with mission-control/customers via their `index.ts` public surfaces. Updating Phase 8 and Phase 9 descriptions accordingly.

- **Medium #4 — `src/shared/ui-patterns/` not in §3.1 target layout.** Two-source-of-truth between §3.1 and Phase 13. Adding `ui-patterns/` to the §3.1 layout (under `src/shared/`) with a note that it's populated only if Phase 13 surfaces qualifying repeated UI patterns — otherwise omitted from the final tree. Keeps the architectural contract and Phase 13's option consistent.

- **Medium #5 — Circular cross-feature dependency risk unaddressed.** §3.3's `index.ts`-only rule prevents deep coupling but not cyclic. Adding to §3.3: "Circular imports between features are forbidden. If two features genuinely need each other's types, the shared types move to `src/shared/types/`." Adding `import/no-cycle` (from `eslint-plugin-import`) to Phase 4's lint deliverables alongside the other import rules.

- **Low #6 — Phase 3 places things in `src/shared/api/` before Phase 4 codifies promotion criteria.** The placement is unambiguously correct (API infrastructure is shared by every feature). Adding a one-line note to Phase 3: "API infrastructure is unambiguously shared; Phase 4's promotion criteria formalize the general rule that this placement already follows." Costs nothing and removes the tail-wagging-dog appearance.

- **Low #7 — §7 R1 calls 1,500 a "hard error-count gate," Phase 2a calls it a sub-decomposition trigger.** Terminology mismatch could mislead a Phase 2a spec author. Changing §7 R1 from "hard error-count gate (1,500)" to "error-count threshold (1,500) for sub-decomposition trigger." Reserves "gate" for CI gates that actually block.

- **Low #8 — Phase 4 pre-commits AuthContext while deferring the decision.** Heading says "into `src/features/shell/`" as commitment; body says it's a Phase 4 spec decision. Softening the heading to "Extract AuthContext into `src/features/shell/` or `src/features/auth/` (Phase 4 spec decides — see §8 Q1)."

- **Low #9 — Phase 10 auth/shell split risk not in key risks.** If AuthContext lives in shell, Phase 10's auth feature spans two folders (Login in auth, context in shell). Adding to Phase 10's "Key risks / coupling points": "AuthContext lives in `src/features/shell/` or `src/features/auth/` per Phase 4 decision. If shell, Phase 10's auth feature is split across two folders; Phase 10 spec confirms the auth feature's public surface includes enough for other features to consume without reaching into shell internals."

- **Nit #10 — §1.5 references "Approach 1/2/3 from brainstorming" without source link.** The rejection descriptions are already self-contained — the parentheticals are traceability noise. Dropping the "(Approach N from brainstorming)" parentheticals from §1.5. Brainstorming wasn't a written artifact this spec links to; the descriptions stand on their own.

- **Nit #11 — Phase 5c "wherever they currently live" is imprecise.** The Phase 5 spec enumerates exact paths regardless, so the hedge adds no value. Dropping "or wherever they currently live"; keeping "under `src/components/<area>/`".

## Disagreed Findings

(none — all 11 findings are agreed)

## Deferred Findings

(none — all are revised in round 3 of the spec)

## Severity Disagreements

(none — every severity matches the reviewer's assignment)

## Open Questions

(none — all questions raised by the reviewer have concrete answers committed above)
