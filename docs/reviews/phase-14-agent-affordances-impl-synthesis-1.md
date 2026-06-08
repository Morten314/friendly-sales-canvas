---
synthesizes_review: docs/reviews/phase-14-agent-affordances-impl-review-1.md
artifact: phase-14-agent-affordances
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-08
round: 1
---

## Round Recommendation

no

Reason: No Critical/High findings. All three Mediums are fact-disproved (F1: `frontend/package.json` `engines` requires Node ≥21.2.0; F4: the W1 ledger is in commit `b5f372c`'s body) or reviewer-conceded non-issues (F2 "a stronger check … better than the plan's version"; F3 "Not a bug"). Every Low/Nit is self-resolved, verified-accurate, or one deferrable doc enrichment (F9). The branch needs no code changes and stays merge-ready.

## Agreed Findings

None. Each finding was checked against the code, `frontend/package.json`, the ADR files, and commit `b5f372c`'s body; none survived as an actionable correctness or accuracy fix. See Disagreed (fact-disproved or reviewer-self-resolved) and Deferred (one optional documentation enrichment).

## Disagreed Findings

- **[Medium] F1 — `import.meta.dirname` without a Node version guard.** Factually incorrect premise. `frontend/package.json` declares `"engines": { "node": ">=21.2.0" }`; `import.meta.dirname` (Node 20.11+) is satisfied by that floor, so the Node-18 import-time throw cannot occur. It is also the universal convention — all nine `frontend/scripts/*.ts` plus `eslint.config.js` use `resolve(import.meta.dirname, "..")`. `scaffold-feature.ts` deliberately mirrors `check-bundle-budget.ts` (the plan mandated this), including its two-pattern usage: `import.meta.dirname` for `FRONTEND_DIR` (`scaffold-feature.ts:10`) and `fileURLToPath(import.meta.url)` for the direct-invocation guard (`:166`) — the latter exists to compare against `process.argv[1]`, a different job. Switching line 10 to `fileURLToPath` would make it the lone outlier among nine scripts. Decline.

- **[Medium] F4 — W1 classification ledger not recorded in an accessible artifact.** Factually incorrect. The ledger is in commit `b5f372c`'s body: "Baseline grep … 146 matching lines / After … 62 / Net … 84"; bucket-a forward-promises-fixed = 33 (25 planned + 8 discovered, each enumerated before→after); bucket-b provenance-rephrased ≈ 30 (enumerated); bucket-c KEPT with per-item rationale; plus "Verification: typecheck PASS, lint PASS, format:check PASS." That is exactly the Spec 33 §3 W1 "Done when" ledger (baseline, per-bucket counts, residual kept-count with rationale). Independent corroboration: `git show b5f372c` = 85 phase-ref lines removed, 1 re-added, 18 TD-FE citations added — consistent with the body. The reviewer noted they reviewed "the aggregate diff (not commit-by-commit)," so the commit message was never read. Auditability criterion met. Decline.

- **[Medium] F2 — NAMING_MAP test uses `toHaveLength` + sorted-equality instead of per-item `toContain`.** The reviewer concedes this is "a *stronger* check," "better than the plan's version in most dimensions," and "Not blocking." The cited downside — a future feature addition forces a test update — is the intended behaviour of an exact-set drift guard, explicitly blessed in `…-plan-synthesis-1.md` ("the 14-name list must equal the actual `src/features/` folders … Task 3 Step 3 is the cross-check"). The suggested superset assertion would weaken the guard the reviewer praises. Decline; keep the stronger test (`scaffold-feature.test.ts:50-51`).

- **[Medium] F3 — `scaffoldFeature` "does not validate internally; relies on caller".** The title is contradicted by the finding's own body and by the code: `scaffold-feature.ts:94-97` calls `validateName` and throws on failure. The reviewer confirms "This is correct" and "Not a bug." The internal check is deliberate defense-in-depth so the exported, agent-facing `scaffoldFeature` validates its own input; the separate `main()` check (`:141`) produces a friendly CLI error (`console.error` + exit 1) rather than a thrown stack. Two regex tests on a dev-only script is not redundancy worth removing. Decline.

- **[Low] F6 — ADR index titles 0002–0005 not verified.** Verified now — all four index one-liners in `docs/adr/README.md` match their files' H1 exactly: 0002 "Cross-cutting client state and components live in `src/shared/`", 0003 "Keep market-research zod contracts feature-local", 0004 "Market-research TanStack cache is memory-only", 0005 "UI-layer-consumed utilities live in `components/ui/`". Accurate; no action.

- **[Low] F5 — features/README naming map not visible in the diff.** The reviewer then confirms consistency ("the 14 feature folders are confirmed present … `NAMING_MAP` lists the same 14 … Consistency confirmed"). Self-resolved; no action.

- **[Low] F7 — escape-hatches.ts header still says "Phase 2a".** The reviewer agrees it's intentional provenance ("correct per the plan … a judgment-call I agree with"). The line explains *why* the escape-hatch mechanism exists; it is a bucket-c KEEP in the W1 ledger. No action.

- **[Low] F8 — reports/README differs from the plan template (adds `pages/ReportsPage.tsx`).** The reviewer calls it "an improvement over the plan template … a positive deviation." No action (the deviation is better).

- **[Nit] F10 — `--dry-run` exit code is 0.** The reviewer states "the exit-code semantics are correct." No action.

- **[Nit] F11 — commit `d6f04fe`'s message omits the CLAUDE/AGENTS cross-link edit.** The edit itself is correct (reviewer confirms). `d6f04fe` is mid-stack (commit 6 of 8); rewriting its message would rebase every later commit and invalidate the SHAs cited across the review docs — disproportionate for a Nit about an accurate commit. No action.

- **[Nit] F12 — features/README 46-line change larger than expected.** The reviewer concludes "Consistent with the plan — Task 3 includes W1 cleanup of README provenance." Self-resolved; no action.

## Deferred Findings

- **[Low] F9 — settings/README "primary write surface" lacks an escape-hatch / TD-FE cross-reference.** Fair and accurate: the settings profile props are escape-hatch-typed (`UntypedBackendProfile`, used in `SettingsPage.tsx:24`, `AgentProfile.tsx:20`, `UserProfile.tsx:25`; catalogued under open **TD-FE-10**), and open **TD-FE-11** governs the orphaned company-profile fetch on this surface. But the README is "accurate for its scope" (the reviewer's own words) — it makes no type-tightness claim the cross-ref would correct — so this is an optional enrichment, not a correctness fix. Adding TD cross-refs to one README without a matching pass over the other 13 would be inconsistent, and the W3 "Done when" did not mandate exhaustive TD citations. **Trigger:** fold the cross-ref in when the settings/company-profile escape-hatch typing (TD-FE-9/10) or TD-FE-11 is next touched, or as part of any dedicated README TD-cross-reference pass. Recorded here (this synthesis is a committed artifact); not worth a new TD entry for a one-line doc nicety.

## Severity Disagreements

- **F1 (Medium → N/A):** Disagreed outright on the facts (engines floor ≥21.2.0); there is no defect to rate. Even if the premise held, a portability nit on a dev-only build script would be Low.
- **F2 (Medium → Nit):** The reviewer concedes the implementation is stronger than the plan's and "Not blocking." A praised, intentional drift guard is at most a Nit observation.
- **F3 (Medium → Nit):** The reviewer concedes "Not a bug." Two regex calls on a dev-only script with zero runtime impact is a Nit at most.

## Open Questions

- None blocking. The only open thread is the deferred F9 doc enrichment (trigger recorded above). The branch passed full serial `preflight` (typecheck / lint / format:check, 777 unit tests, build, advisory bundle-check, 14 e2e + visual-regression, `knip --strict`) and requires no changes from this round; it is merge-ready pending operator approval of the `--no-ff` merge to `master`.
