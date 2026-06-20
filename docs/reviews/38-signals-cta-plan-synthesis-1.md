---
synthesizes_review: docs/reviews/38-signals-cta-plan-review-1-glm-5.2.md
artifact: plans/38-signals-cta.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-19
round: 1
---

## Round Recommendation

no

Reason: Three findings (2 Low + 1 Nit) — two fixed by contained test/a11y edits, one disagreed because its premise is factually false against the current spec; no Critical/High and no new design surface.

## Agreed Findings

- **[Low] Task 7 un-accept test drives a positional icon button (can false-green).** Verified against `SignalCard.tsx:90–128`: the header accept/reject/bot buttons are icon-only with no accessible name, so `getAllByRole("button")[0]` relies on the undocumented `[accept, reject, bot]` order — and if it shifts, the click lands on Reject (which *removes* the card), making `queryByText("Acme") === null` pass for the wrong reason. **Revision:** Task 5 now adds `aria-label`s to the header accept (`isAccepted ? "Unaccept signal" : "Accept signal"`) and reject (`"Reject signal"`) buttons — closing a pre-existing a11y gap — and Task 7's un-accept test selects the toggle by accessible name (`getByRole("button", { name: /Unaccept signal/i })`) instead of by position. The comment block was updated to match.

- **[Nit] Task 8 `contracts.test.ts` replacement dropped the entry-without-`leads` → `[]` regression assertion.** Verified: the original `contracts.test.ts:6–22` asserted an entry with no `leads` key defaults to `[]`; the replacement's three cases (golden shape, empty envelope, per-lead guards) did not re-assert the entry-level `leads: z.array(...).default([])`. The `.default([])` survives in the tightened schema, so behaviour is preserved — only the guard was missing. **Revision:** the degrade-never-throw test case now includes a second entry `{ signal_id: "s2" }` (no `leads` key) and asserts `parsed.data.mapping[1].leads` toEqual `[]`.

## Disagreed Findings

- **[Low] "Plan keeps TD-FE-73 open while the spec says 'mark resolved' — the two disagree."** The premise is false against the current spec. The reviewer cites `specs/38-signals-cta-design.md:214` as saying "mark TD-FE-73 `resolved` … once reconciled," but the round-3 revision already removed that text. The current spec line 220 reads **"Do not close TD-FE-73 in this branch … keep it `open` until a `(user_id, org_id)` with both signals *and* leads confirms the sub-shapes,"** and the Status line (line 6) reads "TD-FE-73 tightened in-branch but left `open` for a populated re-capture." A `grep` for `resolved|close TD-FE-73` returns only those open-state mentions plus an unrelated TD-FE-72 reference (line 28) and a query-state "loading → resolved" (line 193). So the spec and the plan **already agree** — both keep TD-FE-73 open and narrow the remaining action to a populated re-capture. There is no contradiction to reconcile, and no spec edit is warranted. (The reviewer correctly endorses the plan's open-state behaviour as the right one; only its claim that the spec disagrees is inaccurate.)

## Deferred Findings

None.

## Severity Disagreements

None. Both agreed findings are correctly Low/Nit (test robustness + a lost regression assertion, neither a functional defect). The disagreed finding's Low severity is moot since the finding doesn't hold.

## Open Questions

None.
