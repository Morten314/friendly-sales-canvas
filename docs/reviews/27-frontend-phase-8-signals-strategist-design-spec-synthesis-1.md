---
synthesizes_review: docs/reviews/27-frontend-phase-8-signals-strategist-design-spec-review-1.md
artifact: specs/27-frontend-phase-8-signals-strategist-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-04
round: 1
---

## Round Recommendation

no

Reason: All findings are clarity/completeness items resolved by low-cost in-spec revisions (or explicit delegation to the plan); none disagreed-but-real, none open significant new design surface. No Critical/High remains after synthesis.

## Agreed Findings

- **H1 (8c underspecified)** — §7 8c: state explicitly that 8c is itself a sub-staged commit-series (8c-1 scaffold + relocate + route registry; 8c-2 data layer; 8c-3 5a-style decomposition) that the plan enumerates, each sub-commit green, with the "8c checkpoint" being the aggregate. Remedy chosen is the reviewer's *second* option (delegate sub-decomposition to the plan) rather than baking sub-stages into the spec — specs set intent, plans set ordered steps (CLAUDE.md spec-driven flow).
- **H2 (smoke sign-off undefined)** — Wire the manual smoke sign-off into §7 finalize + §11 done-when, attributing it to the already-established Spec 14 §5.6 / R2 merge ceremony: controller-run; pass = the frozen routes/behaviors/visuals (§2.3) render on `/signals` + `/your-ai-team/strategist/{workspace,leadstream}`; fail = no merge, no fix-forward (Spec 14 §5.3).
- **H3 (parity-audit method undefined)** — §4: make the "loading/error-parity audit" concrete — the loading/error/data render states are *asserted by* the new per-hook/per-component React Testing Library + MSW (Vitest) tests, backstopped by VR journey `03`; it is not a separate manual activity. Per-site assertions enumerated in the plan.
- **M1 (permissive zod has no tightening trigger)** — §4: add the pull-forward trigger — tightening is gated on backend stabilization (TD-FE-13 resolution lets us confirm real response shapes) and Phase 13's contract audit; the loose posture is the prevailing pre-launch stance, not indefinite-by-neglect.
- **M2 (single-hook abstraction may not cover both call patterns)** — §4: soften the "single shared implementation" claim — the plan confirms the page's and the substrate's `signal_Ask`/`signal_action` call shapes match before committing to one hook per endpoint; if they diverge, the shared hook is parameterized or specialized. (Also surfaced as an Open Question.)
- **M3 (Phase 9 forward-compat)** — §5: add that the shared substrate's public surface (props + `SignalsChatContext`/`ChatMessage` types + the `signal_*` hooks) is documented (in `shared/README` / a short module doc) well enough for Phase 9 to evaluate the wrapper dedup without re-reading internals. No design-for-Phase-9 now.
- **M4 (dead-code verification rigor)** — §1.2.3: qualify the claim — verified by textual grep of `strategistContext` across `src/` (only the two `Deals.tsx` reads exist); because the reader uses a *static literal* key, any writer must round-trip that same literal, so a dynamically-keyed writer is implausible though not formally excluded. (Context the text-only reviewer lacked: this was codebase-verified during brainstorming, including a second grep for navigate-to-strategist call sites.)
- **L1 (substrate test scope)** — §7 8a / §8: specify the substrate unit test covers render + the MSW-mocked `signal_Ask`/`signal_action` paths + chat-message state + the error fallback.
- **L2 (annotation churn)** — §6: **remove** the now-obsolete `// HANDOFF → strategist` annotation rather than rewrite it with new prose. This honors the reviewer's "minimize churn" concern (no new comment prose in a dead file) while not leaving an annotation that would be actively false post-relocation (it currently says the file "stays here until … relocates"). Net: the original spec's "update the annotation" instruction was wrong; revised to "remove."
- **L3 (LOC anchors fragile)** — §1.3: note the LOC are point-in-time anchors and the plan re-measures at execution. (Reviewer's own framing: "not a defect.")
- **L4 (TD-FE-52 has no fallback)** — §8 / TD-FE-52: add the fallback — 8d creates a strategist VR baseline if behavioral coverage is judged insufficient for the surface's visual complexity; behavioral-only remains the expected default under the pre-launch advisory-gate posture.
- **L5 ("alias" undefined)** — §3.1: replace "alias" with "`@/`-alias path import (e.g. `@/components/market-research/ScoutChatPanel`)."
- **N1 ("Phase 5 + foundation" ambiguous)** — §1.1: "(Phase 5 and the already-merged Phase 0–4 foundation)."
- **N2 (RTL unexpanded)** — §8: expand "React Testing Library (RTL)" on first use.
- **N3 (stage-dependency phrasing)** — §7: rephrase to "8b and 8c both depend on 8a (the substrate's new location); 8c and 8d are mutually independent."
- **N4 ("legacy deep import" undefined)** — §1.3: define on first use — a direct `import X from "@/pages/X"` in `App.tsx`, replaced by a route-registry entry.
- **N5 (§2.1 shared/chat imprecise)** — §2.1: tighten the bullet — `signal_Ask`/`signal_action` zod contracts → `shared/api`, hooks → `shared/chat` (matching §3/§4).

## Disagreed Findings

None of the findings is rejected outright. One action-level disagreement is folded into Agreed (L2): the reviewer implies leaving the dead-file annotation untouched; that would leave a now-false comment, so the resolution is removal, not no-op — but the underlying "don't add churn" point is accepted.

## Deferred Findings

None. The genuinely plan-level items (H3's per-site assertions, M2's call-shape verification, L3's re-measurement) are not deferred as findings — the spec is revised to *explicitly delegate* them to the plan, which is the correct altitude rather than a deferral.

## Severity Disagreements

- **H2 → Medium (not High).** The smoke sign-off is the established Spec 14 §5.6 / R2 ceremony, not a novel gate; the defect is only that this spec didn't restate it in §7/§11 — a low-risk consistency omission, not a design hole.
- **H3 → Medium (not High).** The verification mechanism (RTL + MSW + VR journey `03`) already exists in §8; §4 merely needed to name it. Defining a cross-reference is not High-severity.
- **M3 → Low (not Medium).** Phase 8's deliverable here is documentation only; the actual interface-change risk lives in Phase 9 and does not constrain Phase 8's design.
- **M4 → Low (not Medium).** Relocate-as-is is safe regardless of the claim's certainty (R5, which the reviewer agrees is sound), and the reader's static literal key strongly bounds any writer; the qualification matters only for Phase 13's downstream read, not Phase 8 behavior.
- **L3 / L5 → Nit.** The reviewer's own "not a defect" (L3) and pure-terminology nature (L5) read as Nit; recorded for completeness, not escalation.

## Open Questions

- **signal_Ask / signal_action hook shape (from M2).** Whether one hook per endpoint serves both the chat-substrate (multi-turn) and the Signals-page call sites is unverified until the plan/impl inspects the actual invocation shapes. The spec now delegates this to the plan with a parameterize-or-split fallback; it remains genuinely unresolved until then.
- **Minor:** `signal_Ask`/`signal_action` query-vs-mutation classification (both are POSTs; likely `useMutation`) is left to the plan.
