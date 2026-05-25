---
synthesizes_review: docs/reviews/12-backend-loc-and-docstring-audit-phase-l-design-spec-review-1.md
artifact: specs/12-backend-loc-and-docstring-audit-phase-l-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-25
round: 1
---

## Round Recommendation

yes

Reason: Two Critical findings (K4 site count + existing `_neo4j_helpers.py`; K2 fragile git-stash workflow) plus four High findings require substantive spec revision. Revisions touch design surfaces — snapshot baseline mechanism, fixture generation specifics, helper integration with an existing module — that warrant a follow-up review round.

## Agreed Findings

1. **F1 [Critical] — K4 site count + existing `_neo4j_helpers.py`.** Re-counted sites: `customer_profile/orchestrator.py` (3) + `market_scoring/persistence.py` (1) + `market_research/orchestrator.py` (1 nested def) + `icp/orchestrator.py` (1 nested def) + `signals/ask.py` (2) = **8, not 7**. Also confirmed `_neo4j_helpers.py` exists at 71 LOC. Revising §6 K4 row to say "8 call sites" and explicitly noting that `fetch_company_profile` is appended to the existing module.

2. **F2 [Critical] — K2 byte-equality strategy via snapshot-baseline, not git-stash.** Replacing the git-stash workflow with: in the K2 commit, write the 4 pre-refactor string constants to a baseline file (e.g., `backend/tests/_baselines/llm_config_prompt_strings.py` or `.json`), then add a test that imports the post-refactor module and asserts `assembled == baseline` byte-for-byte. The baseline file can be committed alongside the refactor or kept as a permanent regression test. Revising §6 K2 behavior-preservation detail.

3. **F3 [High] — TD-004 stub fixture limitation.** Adding a §7 note: for refactors that don't change the code's call path to the LLM (K1, K4, K5, K6, K7), pytest with stub fixtures confirms structural preservation, which is exactly what we want. For K2 and K3, the byte-equality assertions (against the pre-refactor strings) are the primary evidence; pytest is secondary. The TD-004 limitation does not weaken Phase L's verification framework because Phase L is explicitly a no-behavior-change refactor.

4. **F4 [High] — K4 and K5 LOC estimates.** Softening to ranges. K5: each `update_one` call in `scoring.py` is 5–8 lines including the multi-line `$set` dict, so 10 sites × ~5 saved each − ~5 (helper definition) ≈ 40–50 LOC. K4: estimate revised to a range, "~35–50 LOC" pending audit measurement. Adding language that LOC numbers in §6 are *initial* estimates verified against the actual code only during Stage 1, and Stage 3 may differ.

5. **F5 [High] — K3 fixture generation + signature clarification.** Rewriting K3's behavior-preservation detail to be explicit:
   - Fixtures live at `backend/tests/fixtures/market_research_prompts/<component_name>.txt`.
   - The fixture content is the output of `RESEARCH_MARKET_<N>_TEMPLATE.format(company_profile_json=<fixed_sample>)` — i.e., the *prompt string* that would be sent to the LLM — captured before the K3 refactor begins, on the pre-refactor code path, with a checked-in `<fixed_sample>` JSON.
   - The parametrized test calls the new `_run_research_component` (or a testable inner helper that exposes the formatted prompt) with each component name and the same `<fixed_sample>`, asserts byte-equality against the corresponding fixture.
   - The signature mismatch the reviewer flagged is resolved: the test is on the *prompt string*, not the full function output. The new helper exposes the prompt at the right seam for testing.

6. **F6 [Medium] — "frozen-intent" vs. updated twice.** Replacing "frozen-intent artifact" with "committed audit record" in §5. Each stage's commit is a frozen snapshot; the *file* itself is versioned across the two stage commits.

7. **F7 [Medium] — No measurable LOC criterion in success criteria.** Adding §10 criterion: "Known wins K1–K7 are executed, or each non-executed win has a documented promote-to-execute attempt with failure rationale, or a defer rationale, in the scorecard." This avoids a hard LOC floor (which TD-008 explicitly rejects) while closing the "0 LOC reduction could still 'succeed'" loophole.

8. **F8 [Medium] — Date anomaly.** Correcting the spec date from 2026-05-26 to 2026-05-25 (today). Updating the scorecard artifact filename in §3, §5, §9, §10 from `2026-05-26-backend-loc-docstring-audit-phase-l.md` to `2026-05-25-backend-loc-docstring-audit-phase-l.md`.

9. **F9 [Medium] — Phase K vs. Phase J in TD-008 trigger.** Adding a one-line clarification in §1: TD-008 line 110 references "Phase J" as the pull-forward trigger; Phase J was lazy-import cycle removal, and Phase K (flat-service decomposition, completed 2026-05-25) was the actual structural completion. The trigger semantics — "after structural decomposition is complete" — are satisfied by Phase K.

10. **F10 [Medium] — K6 call-site count.** Downgrading K6's "11 call sites" to "~10–11 two-line `db = mongo[...]; collection = db[...]` instances, exact count confirmed during Stage 1 audit." The grep output produced 22 line-hits across both files (each two-line pattern produces 2 hits), with 1 hit being a docstring reference — implying ~10–11 patterns.

11. **F11 [Medium] — K7 LOC estimate not derivable.** Softening to range "~60–100 LOC" and noting that 25 grep matches translate to per-match judgment (entire docstring removed vs. single-line edit) resolved during Stage 1.

12. **F12 [Low] — Wall-clock soft cap.** Replacing "~60 minutes of focused reading" with an agent-relevant bound: "if the investigation requires reading more than 5 files beyond the immediate call sites, or 3 full read-analyze cycles without converging, defer." Applied to §2 Stage 2 description and §4 investigation methodology.

13. **F17 [Nit, partial agreement on the meta-point only] — TD-009 cleanup is per-match judgment.** Adding language to §6 K7 that not every grep match is mechanically removed; each is evaluated as "stale origin claim" (e.g., "extracted from X in Phase Y" → remove) vs. "current-state structural reference" (e.g., "Phase H scope" if used to mean "the scope defined by Phase H" — keep or rephrase). Disagreeing on the reviewer's narrowness claim about the grep pattern itself (see below).

## Disagreed Findings

1. **F13 [Low] — Cats 11–12 taxonomy entries.** Disagree. The taxonomy serves two future audiences: (a) future spec authors when design-discussion items get picked up; (b) auditors during Stage 1 who need to know what category an opportunity falls into, even if the resolution is "defer". The reviewer themselves said "leaving as-is is fine." Not revising.

2. **F16 [Nit] — Colon-spacing typo in `COMPONENT_FUNCTIONS` dict.** Disagree on the action. The inconsistent spacing in `"regulatory & compliance highlights" : Research_Market_4` is pre-existing source code that K3 will replace entirely with a new `COMPONENT_TEMPLATES` dict. The issue dissolves with K3 — no spec change needed.

3. **F17 [Nit, on the narrowness claim].** Disagree that the grep pattern is too narrow. `Phase [A-Z]` matches "Phase H scope", "Phase I unification", "Phase H Sequence A" — confirmed by the 25-match grep output already capturing these variants. The pattern is broad enough; the meta-point about per-match judgment is what stands (handled above as agreed).

## Deferred Findings

None.

## Severity Disagreements

None.

## Open Questions

None remaining after this round.
