---
synthesizes_review: docs/reviews/26-frontend-phase-7-customers-plan-review-1.md
artifact: plans/26-frontend-phase-7-customers.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-04
round: 1
---

## Round Recommendation

no

Reason: All three High findings were resolved by revision this round; everything remaining is Low/Nit or disagreed-with-reasoning, and no revision opened new design surface.

## Agreed Findings

- **[High] T20 repo-prefixed `git add` paths** — Verified: git root is `/projects/Brewra/brewra-gtm-intelligence`, with `specs/` and `frontend/` as siblings, so `brewra-gtm-intelligence/specs/25-…` does not exist from the root and `git add` would fail. Stripped the prefix from the T20 Files entry and the step-4 `git add`; added a "paths are repo-root-relative" note.
- **[High] T16 reject test is pseudocode** — Replaced the comment-only stub with a complete, runnable test: `vi.useFakeTimers()` + `userEvent.setup({ advanceTimers })`, MSW handlers, click the (single) Reject button, `vi.advanceTimersByTimeAsync(5000)` past the undo window, then assert `localStorage[PROFILER_DISMISSED_RECOMMENDED_IDS_KEY]` contains `rec-1`. The previously-unused import is now consumed by a real assertion. (Reject button label "Reject" and the 5s window confirmed against `SuggestedICPCards.tsx:2239`/`:1460`/`:1469`.)
- **[Medium] T16 accept-test selector fragile** — Dropped `card.closest("[data-slot], .card, div")` and the now-unused `within` import. The fixture returns one recommended ICP and `customer_profile: { icps: [] }` (no current-ICP rows), so there is exactly one Accept button — selected directly via `screen.getByRole("button", { name: /accept/i })`. Chose the no-new-DOM fix over `data-testid` because shipped components in this repo do not use `data-testid` (only test mocks do) and a new attribute is a (benign) parity DOM change.
- **[Medium] T11 disabled-hooks confusion** — Added a required mount-site code comment to T11 Step 1 documenting that the disabled hooks own the cache key + canonical `queryFn` while the imperative loader still drives fetching until TD-FE-43, so a Phase-9 reader won't mistake them for the data flow.
- **[Medium] T5 shared-MSW collision (partial)** — Added a `grep -n handlers.ts` before-insert guard plus an explicit rule: don't mutate a shared default shape another feature relies on — scope divergent shapes with `server.use()` in the customers tests; keep shared defaults additive and minimal. Documented the sibling-journey VR blind spot. (The "run full e2e after T5" half is deferred — see below.)
- **[Low] Parallelizable task pairs** — Added a conventions bullet flagging T3 ∥ T4, T6 ∥ T7, T14 ∥ T15 as independent fan-out for subagent-driven execution (serial remains valid).
- **[High → downgraded] No global abort criteria** — Agreed the addition is worthwhile (see severity disagreement). Added an "Abort / escalation (phase floor)" conventions bullet: 3-strike stage-gate failure on any task (esp. T11/R1) escalates to the human controller; unresolved-in-session suspends the phase and revisits Spec 26; the local/unshared branch makes suspension free.
- **[Medium] T2 partway recovery (partial)** — Added a "do not commit partway through T2; recover via `git checkout -- <moved>` or reset to the T1 checkpoint and re-run the move as one pass" note. (The recovery rationale is corrected — see disagreement on the premise.)

## Disagreed Findings

- **[Low] T5 sets `Content-Type` on the GET** — The original `/icp` GET sets exactly `{ "Content-Type": "application/json" }` (`src/components/customers/SuggestedICPCards.tsx:755`). The plan's "Parity is the contract" rule requires byte-for-behavior preservation; removing the header would *diverge* from the source, not converge on it. The header is server-ignored, so retaining it is both harmless and parity-faithful. Kept as written.
- **[Low] T1 scaffold is ceremonial overhead** — The standalone scaffold commit is a deliberate, discardable green checkpoint that mirrors the Phase 6 plan's pattern; the reviewer concedes the "one logical step = one commit" convention justifies it. Folding directory creation into T2 would couple it with the highest-risk 13-step atomic move. Left as is.
- **[Nit] T17 placement (tests Stage-1 artifacts in Stage 4)** — Tasks are grouped by *kind* (test authoring), not by dependency depth; T17 has no Stage-4 dependency and is harmless where it sits, which the reviewer agrees with. No change.
- **[Medium] T2 premise — "`git reset` loses the `git mv` history-preservation benefit"** — This rationale is unfounded: git does not record moves as a distinct operation; rename detection happens at diff time from content similarity, so re-doing `git mv` after a reset loses nothing material. (The actionable half — "don't commit partway" — was still worth stating and was added.)

## Severity Disagreements

- **[High] "No global abort criteria" → Low/Medium.** Agree with the finding; disagree it's High. The local/unshared branch + per-stage `git reset --hard` recovery + human-approved final merge (T22) already bound the blast radius. The genuine gap was an explicit escalation floor, now added. Not a merge blocker.
- **[High] "T20 path prefix" → Medium.** Agree it's a real defect; it fails loudly and immediately (`pathspec did not match`), is self-evident at the repo root, and is a one-token fix inside a docs-only task. Fixed regardless of severity.

## Deferred Findings

- **[Medium] T5 — run the full `test:e2e` suite after T5, not just the customers journey.** Deferred. The reviewer concedes the risk is "acceptable given the stage-5 serial preflight's full e2e coverage." The added grep-guard + additive-defaults rule removes the likely collision at its source, and running the full e2e mid-Stage-2 (before any customers wiring is consumed) costs wall-clock without proportional pre-launch value. **Trigger:** if a task ever genuinely requires changing a shared-default MSW shape for a path another feature renders, run the full `test:e2e` at that task instead of the customers-only journey.

## Open Questions

- None blocking. Non-blocking: the T16 accept flow's confirm-button (`/save to customer profile/i`) and success toast (`/Customer Profile updated/i`) selectors were not re-verified against the live `AlertDialog`/toast strings; they remain explicitly labeled scaffolds-to-align-with-markup, consistent with the plan's own note (line ~1674) and not flagged by the reviewer.
