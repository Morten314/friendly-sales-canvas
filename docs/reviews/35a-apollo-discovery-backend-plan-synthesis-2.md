---
synthesizes_review: docs/reviews/35a-apollo-discovery-backend-plan-review-2.md
artifact: plans/35a-apollo-discovery-backend.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-12
round: 2
---

## Round Recommendation

no

Reason: No Critical/High remains open — the two real Highs (F1, F3) are fixed and incidentally surfaced + fixed a latent `low_credit`-never-set bug; the third High (F2) is a verified non-issue (already imported); both Mediums (F5, F6) are fixed; the Lows are documented or declined with reasoning. The remaining surface is contained to one handler, one route param, and one warmup check, and the single open item (partial-`replace` AC4 semantics) is a discrete operator decision, not a re-review trigger.

## Agreed Findings

- **[High] Partial-run credit-exhaustion records stale pre-ingest counts (F1)** — Reordered the inner `except ApolloCreditsExhaustedError` in `_run_discover`: it now ingests revealed records **first** (so `counts.created/matched` reflect them), then calls `complete_discovery_run(..., status="partial")` with the post-ingest counts. Added a TDD guard test (`test_run_discover_partial_credit_wall_ingests_then_records_counts`) asserting `counts.created == 1` and `credits_consumed == 1` after a mid-reveal wall.
- **[High] Outer `ApolloCreditsExhaustedError` handler is unreachable dead code (F3)** — Removed the outer handler (replaced with a comment explaining why it's unreachable: only `match_person` in the reveal loop raises it, and the inner handler returns). Folded `credentials.set_low_credit(..., True)` into the inner handler — this fixed a **latent bug**: the inner handler (the only reachable credit-exhaustion path) never set `low_credit`, so UC10 would never have fired. The same test asserts `low_credit` is set.
- **[Nit] Unused captured `e` in the dead outer handler** — Self-resolved by removing that handler (F3).
- **[Medium] `format` parameter shadows the Python builtin (F5)** — Route param changed to `fmt: str = Query("json", alias="format")`: keeps the external `?format=` query key (FE contract unchanged), drops the shadow and the lint warning, and matches the service's `fmt` parameter.
- **[Medium] `_profiler_analyzed` false-positive on empty `suggestedICPs` (F6)** — The check now inspects the nested value (`isinstance(icps, dict) → bool(icps.get("suggestedICPs"))`, with a bare-list fallback), so `{"suggestedICPs": []}` no longer reports profiler-complete and prematurely unlocks warmup. Added a guard test (`test_warmup_profiler_analyzed_false_when_suggested_icps_empty`).
- **[Low] Constants used but not defined, assumed existing (F9)** — Verified against the live source that all exist: `runs.py` defines `_MAX_ERRORS`, `_MAX_ERROR_MESSAGE_LEN`, `_parse_iso`, `_now`; `orchestrator.py` defines `INGEST_CHUNK_SIZE`. Documented them (plus the F2/F4 imports) as pre-existing/reuse in the Task 12 import note, and the Kill criteria already cover "assumption false → stop."

## Disagreed Findings

- **[High] `ApolloCreditsExhaustedError` missing from the orchestrator import block (F2).** Verified against the live source: `orchestrator.py:12` **already imports** `ApolloCreditsExhaustedError` (the enrich flow at line 217 catches it). The plan's Task 12 import is explicitly **additive** ("add imports … some may already be imported — de-dupe"), not a wholesale replacement, so a literal application preserves the existing import — there is no path to a dropped symbol or runtime `NameError`. The finding's premise (the snippet is the complete contract that overwrites existing imports) doesn't hold. I still strengthened the Task 12 note to say "additive — preserve `ApolloCreditsExhaustedError`/`normalize_apollo_record`," but as a *bug* the finding is a non-issue.
- **[Medium] `normalize_apollo_record` called bare without shown import (F4).** Verified: `orchestrator.py:25` imports `from app.services.connectors.normalize import normalize_apollo_record` and `_run_import`/`_run_enrich` already call it as a bare name (lines 108, 247). `_run_discover`'s bare `normalize_apollo_record(person)` is consistent with the existing module, not a missing import. Non-issue; covered by the same additive-import note.
- **[Low] `apollo_mod._sleep` repurposed as a rate-limit delay (F8).** Verified `apollo.py:36`: `_sleep = time.sleep` — a stateless module-level alias, made module-level *precisely* so tests can patch it (per the module docstring). The reviewer's conditional concern ("if it tracks retry state / mutates connector state") is false. Switching to a direct `time.sleep` would defeat test-patchability and make the suite sleep for real; a dedicated `_throttle` helper would be redundant. Kept `apollo_mod._sleep`; added a confirming comment. No code change.
- **[Low] `low_credit` clearing condition diverges from spec wording (F7).** The reviewer flagged this "for awareness rather than action" and noted the conditions are equivalent. The clear sits in the success branch (so "without a credit error" already holds), and `credits > 0` is a sound "we transacted with Apollo's credit system" signal: charged-but-no-email (`created == 0, credits > 0`) correctly clears the flag, and a fully free run (`credits == 0`) conservatively leaves any prior flag untouched. No change.

## Deferred Findings

- None new this round. The agent-view `superseded` exclusion across Scout/Profiler/Signals reads remains deferred to 35b (recorded in the Task 5 note) — not re-raised this round.

## Severity Disagreements

- **F2 — High → Nit/non-issue.** The symbol is already imported and the import edit is additive; there is no realistic path to a dropped import. Worth a clarifying note, not a High.
- **F4 — Medium → non-issue.** Same basis: already imported and used bare by the existing flows. Not a real omission.
- F1, F3, F5, F6 severities accepted as assigned.

## Open Questions

- **Partial-`replace` data-loss vs spec AC4.** On a mid-reveal credit wall in `replace` mode, the inner handler commits the swap (`delete_superseded_discovery_leads`) and keeps only the partial new set — which can reduce the pool below its pre-run count, in tension with AC4 ("never reduces the pool below its pre-run lead count"). The other failure handlers (`ConnectorCredentialsInvalidError`/`BrewraError`/`Exception`) `clear` (restore) the superseded leads. This behavior pre-dates round 2 and the reviewer didn't flag it; I preserved it rather than silently flip `delete`→`clear` while resolving F1/F3. **Recommendation:** switch partial-`replace` to `clear` (restore the old leads — a partial run is closer to a failure than a success), to honor AC4 and the spec's no-loss replace philosophy. This is a discrete decision for the operator, surfaced here rather than treated as a re-review trigger.
  **Resolved (post-synthesis, operator directive 2026-06-12):** switched to restore — the partial-`replace` handler now calls `clear_superseded_discovery_leads` (unconditionally on `tagged`, even if the wall hit before any successful reveal), so the pool is never reduced below its pre-run count. Locked by `test_run_discover_replace_partial_restores_on_credit_wall` (asserts `tag`→`clear`, never `delete`). Only the full-success path still `delete`s (commits the swap).
- **Live Apollo `api_search` param names** (carried from round 1) — still the single external unknown, contained to `discovery.build_search_filters` and guarded by the Kill criteria (a rename is fine to apply; a structural mismatch is an escalate).
