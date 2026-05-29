---
synthesizes_review: docs/reviews/2026-05-29-apollo-lead-integration-design-spec-review-1.md
artifact: specs/2026-05-29-apollo-lead-integration-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 1
---

## Round Recommendation

no

Reason: All three High findings are agreed and resolved by small in-place revisions (no new design surface); everything else is Low/Nit or a deliberate deferral consistent with the MVP security posture.

## Agreed Findings

- **F1 + F7 (High/Medium) — race + open implementation choice (§5.3).** Commit to atomic, per-property Cypher `SET l.<prop> = coalesce(l.<prop>, $val)` executed in a single write transaction; explicitly reject read-modify-write. One decision resolves both findings.
- **F3 + F5 (High/Medium) — no-email dedup gap + undefined `apollo_contact_id` match role (§5.3, §6.1).** Define one unified match-key hierarchy used by both import and enrichment: normalized `email` → `apollo_contact_id` (within `org_id`) → create-new. This makes email-less Apollo contacts idempotent on re-import (closing the success-criterion-4 hole) and gives enrichment a defined fallback for CSV-origin leads (no `apollo_contact_id` → email-only).
- **F2 (High) — import cap undefined (§8, §6.1).** Specify a hard per-import cap of 25,000 records; on reaching it the batch ends `completed` with `capped=true` and a message ("Reached the 25,000-record import cap; narrow by Apollo list to import the rest"), surfaced through the existing stream-status. (Severity disagreement noted below.)
- **F6 (Medium) — disconnect vs in-flight runs (§6).** State that `DELETE /connect` is non-blocking and does not cancel running tasks (BackgroundTasks aren't cancellable); an in-flight run detects missing/invalid creds at its next Apollo call and ends `partial`/`failed` with a recorded reason — same path as §8's bad-key handling.
- **F9 (Medium) — `reveal_*` config location (§6.1).** Make `reveal_personal_emails` (default `true`) and `reveal_phone_number` (default `false`) optional fields on the `POST /connectors/apollo/enrich` request body, so the credit-spending choice sits with the caller. No global config; no new settings surface in v1.
- **F8 (Medium) — connector seam premature (§4). Partial agree.** Drop the formal **ABC** for v1: `ApolloConnector` is a concrete class; `ingestion.py` stays provider-agnostic by operating on the normalized canonical dict (not on a connector interface); the expected method surface is documented (a `typing.Protocol` is the ceiling if a type is wanted — no registry, no dynamic loading). A formal interface is extracted when HubSpot is actually specced. (See also Disagreed.)
- **F4 (Medium) — credential threat model (§5.4). Partial agree (framing).** Sharpen §5.4 to acknowledge the *distinct* threat model — a user-supplied, API-readable, tenant-scoped key, unlike an operator env secret — and record it as an explicit, conscious risk acceptance with a concrete hardening trigger. (The remedy of adding encryption/authz now is rejected — see Disagreed/Deferred.)
- **F13 (Low) — blocking `requests` in async endpoints (§3, §4).** Specify that connector endpoints which make Apollo calls (`/connect` validation, `/lists`) are sync `def` handlers (FastAPI runs these in its threadpool, so `requests` doesn't block the event loop); import/enrich run as sync background-task functions.
- **F10 (Low) — 429 backoff params (§8).** Add a default: exponential backoff base 1s, factor 2, max 30s, jitter, ≤5 retries per request; then the run ends `partial`.
- **F11 (Low) — error-sample cap (§5.5).** State the cap explicitly = 10 (matching `batch_upload`'s `errors[:10]`).
- **F12 (Low) — `/lists` pagination (§6).** Note that `ApolloConnector` paginates the labels endpoint internally and returns the full set; acceptable for v1 (a customer's own lists are typically few).
- **F14 (Low) — tracking asymmetry rationale (§5.5).** Add a one-line rationale: import reuses `Lead_Stream_Files` to inherit the by-file CRUD + stream-status UI for free; enrichment has no file/lead-set artifact to list, so it mirrors the market-scoring run-doc. Unifying would mean re-implementing the by-file surface — net negative.
- **F15 (Nit) — §4 table lists `app.core.config` for `apollo.py`.** Correct the row: `apollo.py` receives the API key from `credentials.py` (via the service layer); the base URL is a module constant. It does not read the customer key from config.
- **F16 (Nit) — Decision 2 rationale circular (§10).** Reword: import supplies the initial lead pool; enrichment extends leads the customer already has — both are needed for the Apollo connector to be useful without a second design round.
- **F17 (Nit) — `/api` prefix confusion (§3).** Add one line: the FastAPI app mounts routers without an `/api` prefix; the frontend reaches them through the `vite.config.ts` `/api/*` proxy (so a FE call to `/api/connectors/...` maps to backend route `/connectors/...`).

## Disagreed Findings

- **F4 (Medium) — the *remedy* (encrypt-at-rest / restrict endpoints).** Disagree with adding encryption or endpoint-level authz in v1. It conflicts with a deliberate, documented posture: §2.2 lists security hardening as out-of-scope, and the project guidance is explicit that at MVP / 0 users we neither harden nor rip out security. The *framing gap* the finding identifies is real and is being fixed (see Agreed); the protective mechanism is deferred, not adopted now.
- **F8 (Medium) — the premise that "a formal ABC is the skeleton of a plugin system."** Partial disagree on the characterization: a `typing.Protocol` is a structural type, not a plugin system, and carries near-zero cost. The agreed action (drop the *formal ABC*, keep a concrete connector + documented surface) addresses the substance; the indirection itself was never going to be a registry/loader.

## Deferred Findings

- **F4 (Medium) — credential hardening.** Encryption-at-rest and/or endpoint authorization for `Connector_Credentials.api_key` are deferred. Reason: deliberate MVP security posture (0 users). Trigger: first external/paying users, the pre-launch security pass, or the HubSpot OAuth work — whichever lands first. §5.4 is updated to record this risk acceptance and trigger explicitly (rather than the current "consistent with plaintext env vars" framing, which understated the difference).

## Severity Disagreements

- **F2 — agree finding, severity Medium not High.** It's an unspecified parameter (cap value + its UX), not a design flaw. With list-scoped, idempotent imports at 0 users the blast radius is small. Still worth pinning down now, which is why it's in Agreed.
- **F1 — accept High.** It defines a correctness contract for the core write primitive; even at low concurrency probability, the primitive should be specified to be safe by construction.
- **F3 — accept High.** It directly breaks the stated idempotency success criterion (#4) for a real input class (email-less contacts).

## Open Questions

- **Import cap value.** Proposing 25,000/import as the hard cap; this is a product knob, trivially tunable. Confirm if a different ceiling is preferred.
- **Reveal-flags UX.** v1 sets the `reveal_*` defaults at the request layer; whether to expose them in the (deferred) frontend enrichment UI is a question for the FE plan, not this spec.
- **Apollo lists/labels endpoint shape.** The exact path/response for "lists" is encapsulated in `ApolloConnector` and confirmed against Apollo's docs at implementation time; not a spec-level blocker.
