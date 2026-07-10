---
synthesizes_review:
  - docs/reviews/48-org-null-safety-profiler-integrity-spec-review-1-glm-5.2.md
artifact: specs/48-org-null-safety-profiler-integrity-design.md
artifact_type: spec
reactor_model: opus-4-8-1m
date: 2026-07-09
round: 1
unresolved_high_or_critical: no
re_review_recommended: maybe
single_model_round: yes
---

## Round Recommendation

unresolved_high_or_critical: no
re_review_recommended: maybe
single_model_round: yes

Reason (unresolved): Both High findings are resolved — WS3's signature is reworked (agreed); High-#2's "mechanism is factually wrong" premise is refuted by a verified code trace, while its valid sub-point (put the lead-upload write path explicitly in scope) is applied.
Reason (re-review): Single-model round (glm-5.2 only) and the WS3 signature design was materially reworked; a second model has not looked, so a re-review is worth the operator's judgment though not mandatory (no unresolved High, no new workstream).

## Agreed Findings

Load-bearing empirical claims were re-verified against `master` (frontend `src/`, `backend/prompts/icp/icp_generator.md.j2`) before agreeing — several findings depended on code facts, and two of them flipped on verification (see Disagreed / Severity).

- **[High] WS3 content-signature stability (agreed, applied).** Verified the emitted ICP schema: `title` is top-level free-text and `industry`/`segment`/`company_size`/`market_size` are all nested under `firmographics` and LLM-authored — so my flat `industry + segment + company_size + title` sketch both mis-pathed `company_size` and over-relied on high-variance free text. Reworked WS3 §Signature to `canonicalized firmographics.industry + firmographics.segment` only (excluding `title`/`company_size`/`market_size`), added the canonicalization rule (lowercase → trim → collapse whitespace → strip punctuation), an explicit residual-drift acceptance bar ("same industry + same segment ⇒ suppressed," best-effort at 0 users, no fuzzy match), and three rejected alternatives with rationale (non-destructive refresh, stable-id-plus-content-match, prompt-exclusion — each shares the same drift limitation).
- **[High] Lead-upload write path in scope (the valid half of the finding — applied).** Made the transitive coalesce→upload chain explicit in RCA #2 (`DataSourcesManager.tsx:31 → useLeadStream(:242) → uploadCsvBatch (useLeadStream.ts:325,350) → POST /leads/batch-upload`) and added a WS1(d) requirement that `useLeadStream.uploadCsvBatch` must refuse to upload (and disable the CSV control) until `orgResolved && orgId`, since removing the literal at site #31 alone would only shift the write from `"brewra"` to `null`. (The finding's headline premise — that the mechanism is *wrong* — is in Disagreed.)
- **[Medium] Sibling placeholder-tenant fallback (agreed, applied).** Broadened WS1(b), Goal #2, and the Overview from "the 22 `brewra` coalesces" to "every org-fallback literal," listing the `?? "org-123"` family. My sweep found **3** such sites (`ScoutChatPanel.tsx:259`, `ContextChat.tsx:97,176`), not the reviewer's 1 — strengthening the case for a plan-time grep sweep over a hand-list. Noted `ProfileDialog.tsx:18` as cosmetic display-only.
- **[Medium] Hung `GET /org` → infinite spinner (agreed, applied).** WS1(a) now defines "settled" to include a bounded resolution timeout (~8–10s) that flips `orgResolved`, and WS1(f) routes the timeout case to the no-org terminal state with a retry affordance, so the UI always converges.
- **[Medium] Unbounded cold-cache login latency (agreed, applied; severity downgraded — see below).** WS1(a) now states a perceived-latency posture (sub-second warm-path target, timeout as ceiling) and a shell-level skeleton during `!orgResolved`, with non-org chrome allowed to paint optimistically.
- **[Medium] WS3 pre-deploy dismissal backfill gap (agreed, applied; severity downgraded — see below).** Added a WS3 note: the signature set starts empty, so pre-deploy id-only dismissals may resurface once; accepted with no backfill at 0 users (MVP no-migration posture).
- **[Medium] WS3 store-key ambiguity (agreed, applied).** Pinned the dismissed-set to per-user explicitly (matching existing suggestedICPs storage), with the spec-46 1:1 invariant stated as the assumption.
- **[Medium] Shell-gate vs per-surface-guard relationship (agreed, applied).** Clarified WS1(a)/(e): the authoritative gate is at the protected-route boundary, so (e)'s per-surface handling is defense-in-depth — with an explicit carve-out that any surface able to mount before the gate (lazy/code-split) makes its guard load-bearing.
- **[Observation] patch-where-used caution (folded into WS3 testing).** Added the reviewer's note that `_reserve_unique_icp_id` is imported by `customer_profile.orchestrator`, so persistence tests patch at the caller (`app.services.customer_profile.orchestrator._reserve_unique_icp_id`), not `app.services.icp.persistence`.

## Disagreed Findings

- **[High] "RCA #2's stated write mechanism contradicts the code" — the premise is refuted (the sub-recommendation is agreed above).** Verified the full write chain: `DataSourcesManager.tsx:31` `orgIdToUse = orgId || "brewra"` (coalesce site #31) → `useLeadStream({ orgIdToUse })` (`DataSourcesManager.tsx:242`, the hook's only non-test consumer) → `uploadCsvBatch` (`useLeadStream.ts:325` `leadOrgId = orgIdToUse`; `:350` `formData.append("org_id", leadOrgId)`) → `POST /leads/batch-upload`. So the coalesce **does** write leads under `"brewra"` when `orgId` is null — the spec's "written by the `|| "brewra"` coalesce at upload time" is correct. The reviewer traced only the manual-add (`AddLeadModal`) and read (`LeadsTable`) paths and concluded "none of the 22 is in the lead path," missing that `DataSourcesManager` (site #31) owns the CSV upload hook and threads its coalesced org into the write via a prop (which is why no lead-named file contains the literal). The reviewer's proposed *substitute* mechanism — "resolved org was `brewra` during the race," citing `LeadsTable.orgResolution.test.tsx` — is in fact *less* accurate: that test documents a **retired** pre-spec-46 tenant default (`clearStaleTenantKeys`, `main.tsx:11`) that it explicitly calls not-a-live-vector. I therefore did not adopt the reworded mechanism; I kept and corrected the original (now with the explicit chain) and applied only the finding's valid sub-point.

## Deferred Findings

(none)

## Severity Disagreements

- **[Medium → Low] Cold-cache login latency.** Agree with the finding and applied the mitigation, but at 0 users the impact is a marginally slower *correct* first paint replacing today's instant *wrong* paint — low-stakes, and the fix is a cheap shell skeleton + stated budget.
- **[Medium → Low] WS3 pre-deploy dismissal backfill gap.** Agree with the finding; the reviewer's own impact note ("low; 0 users; account reset out-of-band") supports Low. Resolved with a one-line acceptance note (no backfill), consistent with the MVP no-migration posture.

## Open Questions

- **Persisted `firmographics` accessor.** The WS3 signature assumes `firmographics.industry`/`.segment` are reachable on the stored `ICP_config` doc. If persistence flattens or renames those fields, the plan must pin the exact accessor (and re-confirm the two fields survive persistence unmodified). Not resolvable at spec level.
- **Route-gate topology.** Whether any org-scoped surface can mount *before* the protected-route gate (a late-resolving code-split shell / nested layout) determines whether WS1(e)'s per-surface guards are belt-and-suspenders or load-bearing. The plan should confirm the router topology.
- **Adjacent latent bug surfaced during the WS1(d) trace (flagged, NOT auto-added to scope).** `scout-chat/AddLeadModal.tsx:66` does `const orgId = userId;` then POSTs `org_id: orgId` (`:70`) — manual single-lead adds are tagged with the **Firebase uid, not the org**. This is a wrong-*value* bug, distinct from spec 48's null/placeholder-org scope, and the WS1(d) null-org guard would not fix it. Surfaced here for plan-time triage (WS1(d) already tells the plan to enumerate the manual-add lead write); deliberately not folded into this spec to avoid silent scope creep.
