---
synthesizes_review: docs/reviews/30-frontend-phase-9-scout-profiler-design-spec-review-3.md
artifact: specs/30-frontend-phase-9-scout-profiler-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 3
---

## Round Recommendation

no

Reason: Every round-3 finding is Low or Nit. The reviewer's codebase verification confirms all LOC counts, importer lists, and structural claims in the spec are accurate, and the structural issues from rounds 1–2 (render-surface plumbing, ICP confirm-and-document, the 11-file partial drain, `types.ts` placement, ref-forwarding) are resolved. The remaining items are clarifications, applied inline below; the loop converges.

## Agreed Findings

- **[Low] `emptyContext` vs `initialContext` boundary implicit (§4).** Agree. Added a §4 note: `emptyContext` seeds a *new* session's context when `initialContext` is null; `initialContext` is the live parent handoff (e.g. signals→chat). Distinct roles, same type.
- **[Low] `ChatWithScout.tsx` destination uncommitted (§9, §17).** Agree. Added a non-binding recommendation — default to `components/` root (neutral for a file with two consumers across `trends/` and the page) — while preserving the plan's authority to choose `trends/`.
- **[Low] §12 doesn't justify that the render-swap test survives the dedup (§12).** Agree. Added a note: the existing `ScoutChatWithHistory.test.tsx` asserts on the wrapper's render *output* (which includes the `renderChat` result), not its internal structure, so the `ContextChat`↔`ScoutChatPanel` swap assertion path is unchanged by the move into `renderChat`.
- **[Nit] `onClearContext?` optionality unexplained (§4).** Agree. Added a §4 note: both personas expose a context-clear action, so it is effectively always provided; the `?` is forward-compat, not a per-persona divergence.
- **[Nit] TD-FE-50 trigger stale (§2/§15).** Verified accurate — `TECH_DEBT.md` TD-FE-50 ("`signalsChatContext` sessionStorage handoff is untyped") has pull-forward trigger "Phase 9 chat-surface dedup." Phase 9 is behavior-preserving and deliberately does not type the handoff (typing it is a contract addition). Added a §2 out-of-scope line and a §15 note that Phase 9 does not type the handoff and TD-FE-50's trigger moves to a later phase (the trigger edit in `TECH_DEBT.md` lands at the finalize stage).

## Disagreed Findings

None on substance. All round-3 findings are accepted as clarifications.

## Deferred Findings

- **[Nit] §14 surgical-commit guidance is procedural, not design intent.** Agree it sits in tension with the "frozen record" header. Deferred: §14 is retained as parallel-worktree *coordination* context because that framing shaped real design choices (the §13 staging order, the routing-edit concentration). The purely procedural lines (e.g. "never `git add -A`") migrate into the plan at writing-plans time. Trigger: plan-writing. Not worth re-churning the spec.

## Severity Disagreements

None.

## Open Questions

None remaining. The `ChatWithScout.tsx` subfolder now carries a recommended default with plan-override authority; no decision is blocked.
