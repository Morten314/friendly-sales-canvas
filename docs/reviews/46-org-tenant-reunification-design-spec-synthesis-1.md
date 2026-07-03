---
synthesizes_review: docs/reviews/46-org-tenant-reunification-design-spec-review-1-glm-5.2.md
artifact: specs/46-org-tenant-reunification-design.md
artifact_type: spec
reactor_model: claude-opus-4-8[1m]
date: 2026-07-03
round: 1
---

## Round Recommendation

no

Reason: All High/Medium findings are agreed and revised into the spec (tightening existing decisions, no new design surface); the remaining disagreements are framing/severity on #2 and a lone Low (#8), so no High stands unaddressed.

## Agreed Findings

- **#1 (SC#2 self-defeating):** Reworded success criterion #2 to scope precisely — no `useTenant`/`selectedTenant?.id` resolution or usage sites outside the one-time init-sweep module and test fixtures — and made the sweep iterate `selectedTenant_`-prefixed `localStorage` keys so the literal appears only there.
- **#2 (invalidation cascade — partial, see Disagreed):** Documented the mechanism in WS2 — org-scoped query keys already include the resolved org (verified), so a stale→fresh flip re-keys and React Query refetches under the new key; added the matching test. (The "masked forever" framing and High severity are disputed below.)
- **#3 (no WS2 propagation test):** Added a Testing bullet asserting `AuthContext` always calls `GET /org` on auth resolution and the fresh org overwrites a planted stale cache (SC#3), plus a query re-key assertion on the flip.
- **#4 (Pinecone hand-wavy/non-idempotent):** Specified the mechanism — copy vectors by id (fetch source namespace → upsert target namespace, idempotent-by-id) then delete the source namespace; re-embed-from-S3 only as fallback when source vectors are unfetchable; `--report` quantifies vector counts per namespace so the cost is concrete.
- **#5 (two stranded datasets conflated):** Enumerated the known non-canonical org-ids for the seed case (`"brewra"` slug, `A5Bfx…` uid, `…string` corrupt) and clarified that `--report` discovers *all* data whose `org_id` ≠ the user's canonical org (so it inherently covers the slug org, not just the 197 uid leads); clarified 396-canonical vs 197-stranded.
- **#6 (`migrate` plumbing unspecified):** Clarified `migrate` is a service-function parameter used only by the WS3 reconciliation script in-process; `POST /connect_org` does **not** expose it (always strict-reject re-key); WS3 mapping changes go through the hardened service fn, never a raw `user_mappings` write.
- **#7 (permissive response model — partial, see Deferred):** Noted `OrgResponse.org_name` is `Optional`/`extra="allow"`; the FE displays `orgName ?? orgId` and never assumes `org_name` is present.
- **#8 (WS4 is deliberate — partial, see Disagreed):** Added a line marking the three checks as a deliberate implementation of the user's explicit bijective 1:1 requirement, not speculative hardening.
- **#9 (serial request on auth path):** Added the explicit guarantee — first paint renders off the optimistic cached org; the authoritative `GET /org` reconciles in the background and never blocks initial render.

## Disagreed Findings

- **#2 (framing):** The "user can still see the wrong org's data until they reload / masked forever" claim does not hold. Verified query keys are org-scoped (`qk.leads(orgId)`, `qk.marketResearchComponent(orgId, componentName)`, `qk.signalLeadMap(orgId, userId)`, `qk.icps(orgId)`, …), so when `useOrgId()` flips stale→fresh the `queryKey` changes and React Query refetches under the new key; the stale-key entry is unsubscribed, not rendered. The reviewer's suggested remedy (an identity token org-scoped keys depend on) already exists as `orgId`-in-key. The spec still gains explicit documentation of this + a test, but there is no live "until reload" data-staleness bug to fix.
- **#8 (defer-two suggestion):** Disagree with shipping only shape-validation and deferring reverse-uniqueness + no-silent-rekey. Bijective 1:1 ("a user has one org, an org has one user") is an **explicit user requirement**, not defense-in-depth the reviewer can trade away: reverse-uniqueness *is* "an org has one user," and no-silent-rekey is precisely what prevents the stranding this spec exists to fix. Shape-validation alone satisfies neither. All three are kept; the reviewer's secondary suggestion (state it's deliberate) is adopted.

## Deferred Findings

- **#7 (tighten the `OrgResponse` Pydantic model):** The FE-side fix (`orgName ?? orgId` fallback) is applied now. Tightening the permissive model itself is deferred — `OrgResponse` is shared across `list_orgs`/`create_org`/`connect_user_to_org` with intentionally varying shapes, and hardening it is outside this spec's scope. Trigger: the response-model-tightening pass tracked against the AGENTS.md loose-`response_model` debt.

## Severity Disagreements

- **#1:** Agree finding; **Medium**, not High. A success-criterion wording imprecision with unambiguous intent and a one-line fix — it could confuse a merge gate if read literally (so not Low), but does not affect design correctness or feasibility.
- **#2:** Agree there's a documentation/test gap; **Medium**, not High. Verified org-scoped query keys make the stale→fresh correction automatic, so the headline "masked forever" risk that would justify High does not materialize.
- **#3:** Agree finding; **Medium**, not High. A one-bullet Testing-enumeration gap already implied by success criterion #3, not a missing design element.

## Open Questions

- **Users whose mapping itself points to a non-canonical org:** WS3 routes these to manual per-case decision via `--report`. Whether any exist beyond the seed case is unknown until `--report` runs against prod (the sandbox has no DB egress). Not blocking — it is the first action in the sequence.
- **Coverage of `org_names`:** how reliably `org_names` is populated for live orgs determines how often the FE falls back to `orgId` for display (finding #7). Answered by the same `--report` / a quick prod check.
