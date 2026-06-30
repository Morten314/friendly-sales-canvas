---
synthesizes_review: docs/reviews/44-admin-ops-console-design-spec-review-1-glm-5.2.md
artifact: specs/44-admin-ops-console-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-30
round: 1
---

## Round Recommendation

no

Reason: All 7 findings agreed and resolved in-place with contained additive clarifications; no Critical/High remains, and the revisions (v1→v2 endpoint swap, dependency/timeout/shape notes) open no significant new design surface.

## Agreed Findings

- **[High] Registration endpoint cites deprecated/capped v1.** Verified against code: v1 `GET /registration` (`org_auth.py:40`) carries `Deprecation: true`, calls `list_registrations(mongo)` with no `limit`/`offset` (default cap 500), discards `total`; the skip/limit/`total` pagination is the v2 `GET /api/v2/registration` returning `PaginatedResponse[RegistrationResponse]`. Revised the capability table and §5 "C — Registrations" to target v2, describe the envelope, forbid v1, and pin the zod contract to the exact 4 fields (no `OrgResponse`-style passthrough).
- **[Medium] `probe_llm` dependency wiring unspecified.** Verified: `probe_llm(llm2)` requires a model arg; `pipeline.py`'s `test_llm` injects `llm2=Depends(get_llm2)`. Revised §5 D2 and §6 item 2 to specify `Depends(get_llm2)` and that the probe should reflect the product LLM (Qwen 235B), not an arbitrary one.
- **[Medium] Guarding errors ≠ guarding hangs.** Agreed: try/except does not bound latency, and up-but-slow is the likely health failure mode. Revised §5 D2 and §6 item 2 to require a per-probe `asyncio.wait_for` timeout; updated the §6 error-handling NFR to "failed *or* timed-out probe renders red."
- **[Medium] `/admin/orgs` response shape under-specified.** Agreed the spec should state policy even though the exact map value shape is confirmed live. Revised §6 item 1 to: confirm fields live before fixing the contract, use a tolerant `response_model` (known fields + `extra="allow"`, mirroring `OrgResponse`), and make the unbounded single-doc fetch an explicit, stated assumption.
- **[Low] `/leads` multi-user fan-out unaddressed.** Agreed and made a decision rather than leaving it open: §5 A+B now specifies per-user fan-out + client-side concatenation, with many-user orgs as an accepted MVP limitation and a revisit trigger.
- **[Low] Export scope ambiguous.** Agreed and resolved explicitly: §5 C now states export = current-view; whole-dataset export is out of scope, with a §9 row + trigger.
- **[Nit] Hardcoded `ADMIN_EMAILS` operational smell.** Agreed the flag (roster change = commit + redeploy) and added a §3 note — see Severity/correction note below re: the suggested Vite-env-var resolution.

## Disagreed Findings

None on substance. (Partial pushback on the Nit's *suggested resolution* is recorded under Severity Disagreements, not here, since the finding itself is valid.)

## Deferred Findings

- **Exact `{_id:"orgs"}` map value field enumeration** (sub-point of the Medium #4). Not enumerated in the spec by design — the spec already mandates "build endpoint → verify shape live → write contract." The tolerant-`response_model` policy is now stated; the concrete field list is confirmed during implementation. Trigger: the live `curl`/`/docs` step in the plan's first backend task.

## Severity Disagreements

- **[Nit] `ADMIN_EMAILS`:** Agree the finding; the reviewer's *suggested fix* (a `VITE_*` env var to "avoid redeploy") is incorrect — Vite inlines env vars at build time, so an env var still requires a rebuild/redeploy. Recorded the flag honestly in §3 and noted that the only true no-redeploy path is the already-deferred backend-served allowlist. Net effect: finding accepted, resolution adjusted.
- **[High] Registration endpoint:** Agree the finding and that fixing it now is correct. The "High" rating is defensible for spec correctness (it pointed the implementer at a deprecated endpoint), though the runtime truncation consequence is latent at current 0-user / sub-500-registration scale. Did not downgrade — fixed regardless, so the point is moot.

## Open Questions

None. The single deferred item (orgs map field list) has a clear, already-specified resolution path (live shape verification in the plan's first backend task).
