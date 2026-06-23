---
artifact: specs/41-recommendation-artefact-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-23
round: 2
---

## Context

Round-2 confirmation review. Round 1 (`…-spec-review-1-glm-5.2.md`) filed 11 findings; synthesis-1 (`…-spec-synthesis-1.md`, opus, `round: 1`) **agreed all 11** (downgrading F1→Medium, F4→Low; one open Q on the button label). The spec was then revised (file mtime 2026-06-23 07:51, untracked) to incorporate those decisions. This round confirms the fixes and reports only **newly-introduced / residual** issues.

**All 11 round-1 findings verified resolved against the current text:** F1 TD-FE-78 now "partially resolves" (§8.5 L232/234/239, §13 L338, AC#5 L348); F2 ArtifactsPage consumer added to §8.5 L248, §12 L311, AC#4 L347; F3 `signal.source` flatten rule stated in §7.2 L152, §9 D-5 L279, §8.4 L222; F4 `item`/`index` resolution with the `nextBestMoves` fallback in §8.4 step 1 (L218); F5 `orgId: string \| null` + `!orgId` guard + conditional `org_id` forwarding (§8.1 L186/197, §8.4 L219); F6 limiter reuse (§7.1 L133); F7 zero-leads valid (§6.2 D-6 L115); F8 playbook toast (§6.3 L121, §8.4 L224); F9 structured-JSON commitment (§7.3 L173, §12 L315); F10 D-5 reframed as new decision (§9 L279); F11 two-buttons disambiguation (§6.1 D-7 L98). Verified F6's "reuse the limiter" against `_claude_budget.py` — the reserve/finalize functions are genuinely reusable module-level helpers (consumed today only by `signal_ask_claude`, ask.py:260/297), so the resolution is sound.

The spec is now plan-ready. The three items below are polish-level (one Low consistency issue the revision introduced, two Nits).

## Findings

### [Low] The new "Artifact" spelling convention is applied inconsistently (AC#4) and under-enumerates a copy change to the shipped Spec 38 surface

**Location:** §6.1 D-7 (L98–100) and §1 L27 / §3 L48 vs §14 AC#4 (L347); and §13 Affected Files.

The revision introduces a deliberate split — user-facing copy "Artifact"/"Artifacts", code identifiers "Artefact" (D-7) — and asserts the **existing signal-level button + toast "align too"** (§1 L27 "its button label aligns to the 'Artifact' spelling"; §3 L48; D-7 L98). But:

1. **AC#4 contradicts the convention.** §14 AC#4 (L347) still reads "The signal-level **'Save as Artefact'** (Spec 38) …" — British spelling — while D-7/§1/§3 say the signal-level button aligns to "Artifact". One of them is wrong.
2. **The existing button is currently British.** The signal-level label is `Save as Artefact` today (`SignalCard.tsx:184`) and its toast says "Saved to **Artefacts**" / "**Artefacts** library" (`SignalsPage.tsx:536-538`). The §1/§3 present-tense "aligns" reads as "already aligned," when this is actually a *change* to a shipped Spec 38 surface.
3. **The relabel isn't enumerated.** §13 lists SignalCard.tsx (L331) and SignalsPage.tsx (L332) only for the *new* props/handler/row layout; the Artefact→Artifact relabel of the existing signal-level button + toast isn't called out as a distinct affected change.

Resolve by: fixing AC#4 to "Artifact" (or explicitly stating the signal-level button keeps "Artefact" and only the new button is Americanized — pick one and apply it everywhere), phrasing §1/§3 as a copy *change*, and enumerating the relabel in §13. (Low — a real internal contradiction + an under-enumerated scope item, but trivial to fix and not design-blocking.)

### [Nit] §13 still says "parser unit test", stale versus the §7.3/§12 structured-JSON commitment

**Location:** §13 Affected Files, `backend/tests/` row (L327: "parser unit test"); cf. §7.3 (L173, "Output **must be structured JSON**") and §12 (L315, "structured-field extraction … graceful degradation on malformed/partial JSON").

The revision committed the backend to structured-JSON output and reframed the §12 test accordingly, but the §13 table still says "parser unit test." Align §13 with §7.3/§12 (e.g. "structured-field extraction + malformed-JSON degradation test").

### [Nit] Reusing `_claude_budget` inherits a hardcoded `signal_ask_claude` error label and a 429 not named in §10

**Location:** §7.1 D-3 (L133, "reuses … the existing token/run limiter"); §10 Error Handling table (L287–292). Mechanism: `_claude_budget.py:54-60` raises `BudgetExhaustedError` with message `"Token budget exceeded for signal_ask_claude"`; that error → HTTP **429** (`exceptions.py:11`, handler `main.py:121`).

Two small consequences the spec doesn't acknowledge: (a) when the artefact endpoint trips the budget, the surfaced 429 carries a message mislabeled "for signal_ask_claude"; (b) §10's error table has no row for budget-exhaustion/429 (it lumps everything into "Backend returns error", which the FE handles fine, but the failure mode is unmentioned). Either generalize the reserve error message (or accept the inherited label explicitly) and add a §10 row noting budget-exhaustion surfaces as a 429 handled like other errors.

## Observations (no action)

- **F6 reuse is mechanically sound.** `_reserve_claude_signal_budget` / `_finalize_claude_signal_budget` are module-level helpers in `_claude_budget.py`; `signal_ask_claude` consumes them (ask.py:260/297). The artefact endpoint reusing them is correct, not a new mechanism. (The reserve/finalize pair is currently consumed only by `signal_ask_claude`; the module docstring's "shared across all `_claude` route variants" is aspirational — `generate_signals_batch_claude` and `build_signal_lead_map_claude` only inline-guard `CLAUDE_API_KEY`.)
- **The shared budget pool is by-design shared.** Joining it means playbook generations share 5-min token headroom with `signal_ask_claude` (recommendation answers) — heavy playbook use could surface 429s on the answer path and vice versa. This is the established shared-budget behavior, not a new interaction; acceptable at MVP (0 users, generous window). Noting it only for awareness.
- **`item` undefined in the handler is unreachable.** §8.4 step 1 resolves `list[index]` without guarding `item`, but the button lives in the card's `hasPrompt` block (`SignalCard.tsx:383`) and the answer-fetch effect bails on empty prompts (`SignalsPage.tsx:260`), so `index` is always valid when the button is clickable. The spec already says "resolve defensively"; no change needed.
