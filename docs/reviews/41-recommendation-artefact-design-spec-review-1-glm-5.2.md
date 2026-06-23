---
artifact: specs/41-recommendation-artefact-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-23
round: 1
---

## Context

Review performed against the `worktree-recommendation-artefact` worktree (off `master` @ `52ef6cb`). Every code citation in the spec was checked against the actual source before being critiqued; verified-accurate citations are listed under Observations. This review flags only the citations/claims that do not hold up against the code, plus design gaps that affect plan-readiness.

## Findings

### [High] "Closes TD-FE-78" is contradicted by deferring the Unicode-font half of that debt

**Location:** §8.5 ("Unicode-font support (2.5.2+) addresses the mojibake half of TD-FE-78 **if a Unicode font is embedded; until then the existing ASCII-folding keeps WinAnsi safe**"); §13 ("mark **TD-FE-78 resolved**"); Acceptance Criterion #5 ("`TD-FE-78` is marked resolved").

TD-FE-78's "What it should be" explicitly requires two things: a real library with correct xref + multi-page flow **and** "Unicode-capable font embedding" (`docs/TECH_DEBT.md:1236-1237`). The spec delivers the first half (jsPDF → valid xref + pagination) but explicitly *does not* commit to embedding a Unicode font — it keeps the existing ASCII fold as the safety net. That leaves the mojibake half (the other half of TD-FE-78) open, yet the spec asserts the entry is "resolved" in three places, including the acceptance criteria and the TECH_DEBT edit in §13.

Marking a two-part debt entry "resolved" while only completing one part sets a false "done" signal. Either (a) embed a Unicode font in this work so TD-FE-78 is genuinely closed, or (b) downgrade the claim to "partially resolves TD-FE-78 (xref/pagination)" and either split the entry or leave the Unicode-font half open with an updated note. The current state — "closes TD-FE-78" + "ASCII-folding stays" — is internally contradictory.

### [Medium] Shared-surface no-regression scope omits the Artefacts library download path (`ArtifactsPage.tsx:130`)

**Location:** §8.5 "Shared-surface caution" (names only the Spec 38 briefing at `SignalsPage.tsx:534`); §12 no-regression check ("Add a no-regression check that the Spec 38 signal briefing still generates").

`generateAndDownloadPDF` is consumed in two live non-test sites, not one: `SignalsPage.tsx:534` (briefing) **and** `ArtifactsPage.tsx:130` (downloading a saved artefact from the `/artifacts` library). A playbook saved to the library and re-downloaded later goes through the same rewritten generator, so the rewrite's no-regression obligation extends there too — and the spec's §12 test plan doesn't cover it. Add `ArtifactsPage`'s download path to the no-regression scope (and, ideally, a test that a saved `playbook` artefact re-downloads multi-page). (The "Strategist shared path" named in TD-FE-78 is stale — see Observations.)

### [Medium] `signal.source` shape is unresolved: `SourceCitation[]` objects vs the request's `signal_sources: string[]`

**Location:** §7.2 request body (`"signal_sources": ["string"]`); §9 D-5 ("a `Sources: …` line built from `signal.source[]`"); §7.3 prompt ("the full signal context … signal_sources").

`SignalCard.source` is `SourceCitation[]` = `{ citation: string; url: string }[]` (`frontend/src/features/signals/types.ts:18-21`, and `source?` is optional at `:33`), not `string[]`. The spec never specifies how the objects flatten to the `string[]` the backend expects (citation text? URL? both?) nor how the builder handles `source` being undefined. The implementation will have to invent this (e.g. `source?.map(s => s.citation || s.url).filter(Boolean)`). State the flattening rule explicitly in §7.2/§9, including the undefined-guard, so the FE service, the builder, and the prompt agree.

### [Medium] Handler does not specify how `item` is resolved from `(signal, index)` — misses the `nextBestMoves` fallback

**Location:** §8.4 handler steps 4–5 (`recommendation: item.nba`, `recommendationAnswers[key]`); the handler signature `handleSaveRecommendationAsArtefact(signal, index)`.

`item`/`index` is never derived in the handler steps. Recommendations render from `signal.NBAs` **or** the legacy `signal.nextBestMoves` fallback (`SignalCard.tsx:342-348`), and the answer-fetch effect mirrors exactly that resolution (`SignalsPage.tsx:255-260`). A handler that reads `signal.NBAs[index]` directly would be `undefined` for any signal sourced from `nextBestMoves`. Specify the resolution and require it to match the card's (including the `{ nba: m, prompt: "" }` mapping), or the playbook's `actionDelegated`/`recommendation` will be wrong or throw.

### [Medium] `orgId` null-guard missing; the service signature assumes a non-null org, but the page's `orgId` is `string | null`

**Location:** §8.1 signature `generateRecommendationArtefact(userId, orgId: string, …)`; §8.4 handler step 4 (`generateRecommendationArtefact(currentUser.uid, orgId, …)`).

`SignalsPage`'s `orgId` is `authOrgId ?? selectedTenant?.id ?? null` — i.e. `string | null` (`SignalsPage.tsx:46`). The closest sibling effect guards `!orgId` and bails (`SignalsPage.tsx:251`), and `generateSignalsBatch` only forwards `org_id` when truthy (`services/signals.ts:55`). This handler passes `orgId` straight through with no guard and a non-null signature, so a null org would either type-error or send a request the backend scopes to nothing. Add the `!orgId` guard (no-op, matching the button-gate philosophy) and either mirror the conditional `org_id` forwarding or document that org is required for this artefact.

### [Medium] New generation endpoint has no rate/token limiter, unlike its closest sibling `signal_ask_claude`

**Location:** §7 (endpoint spec); §3 (defers auth/tenancy hardening); §11 R-2 (latency only).

`signal_ask_claude` — the endpoint whose model lineage this artefact deliberately reuses — advertises "a local token/run limiter" (`backend/app/routers/signals.py:111`). The new endpoint fires a full Claude generation per click with a large prompt (full signal + every matched lead + the cached answer), with no per-user/per-org throttle or dedupe specified anywhere in §7. Given the backend's trust-client-IDs posture (§3), that is an unbounded cost/abuse surface and an inconsistency with the ask sibling. Add at least parity with the ask limiter (token/run cap), or state explicitly why it's acceptable to omit here.

### [Low] Zero-matched-leads edge case is unaddressed

**Location:** §6.2 gating (gates on `isAccepted` + cached answer only); §9 (`keyFindings`, `systemImpact: "${leads.length} matched lead(s) targeted"`).

Nothing gates the button on having leads, so a playbook with zero leads is reachable: empty `matched_leads` to the LLM, `keyFindings: []`, `systemImpact: "0 matched lead(s) targeted"`. The design assumes leads exist but never states the behavior. Decide and document: gate the button until leads are present, render an empty-state, or explicitly accept that a zero-lead playbook is valid output.

### [Low] Reused toast copy says "signal briefing" for a playbook

**Location:** §6.3 step 3 / §8.4 step 6 ("reuse the existing … toast"); existing toast at `SignalsPage.tsx:536-544`.

The existing toast's description is "Your **signal briefing** was downloaded and added to the Artefacts library." Reused verbatim for a playbook, that copy is wrong. Either parameterize the description or specify a playbook-appropriate string (the title/action are fine to reuse).

### [Low] "Prefer structured output" (§7.3) vs "LLM text → five fields parser" (§12) tension

**Location:** §7.3 ("prefer structured/JSON-style output to avoid the kind of free-text parsing fragility tracked elsewhere in signals"); §12 backend test ("unit coverage for the **parser** (LLM text → five fields)").

These presuppose different designs. If structured/JSON output is chosen (the §7.3 preference), there is no fragile free-text "parser" to unit-test — the test should validate structured-field extraction and malformed-JSON handling. If free-text parsing is chosen, §7.3's preference isn't honored. Reconcile the two so the test plan matches the chosen output discipline.

### [Nit] D-5's cited precedent for mapping sources does not exist

**Location:** §9 D-5 ("the citations already ride into the briefing PDF the same way — `signalBriefing.ts:43`").

`signalBriefing.ts:43` is the per-lead `why` comment; `buildSignalBriefingArtefact` does **not** map `signal.source` anywhere (it sets `executiveSummary: signal.description` at `:64`, and `keyFindings` from leads). There is no existing precedent for carrying sources into the briefing PDF — the two builders will actually *diverge* on this. Adding a `Sources:` line to the playbook is a reasonable new decision; just don't justify it with a precedent that isn't there. Correct the citation.

### [Nit] Two identically-labelled "Save as Artefact" buttons with no disambiguation note

**Location:** §6.1 (new recommendation-row button); existing signal-level button at `SignalCard.tsx:184`.

After this change there are two "Save as Artefact" buttons in one card (signal-level in the leads section, recommendation-level in the answer row). The spatial separation likely makes this obvious, but a one-liner confirming the labelling/positioning is intentional (or a qualifier like "Save Playbook") would preempt confusion during implementation.

## Observations (no action)

- **jsPDF `^4.0.0` is valid and current**, not an error. jsPDF is at 4.x (4.2.1 latest; 4.0.0 was the semver-major that fixed CVE-2025-68428 path traversal). `^4.0.0` resolves to the secure 4.2.1, so the advisory `bundle:check` should be clean on the security axis. The spec's separate "2.5.2+" Unicode-font note is a lower bound and is consistent with 4.x.
- **Verified-accurate spec citations** (no change needed, recorded for traceability): D-1 (`SignalCard.tsx:448` is `flex items-center gap-2`, no `justify-between` — the design doc's layout claim was indeed wrong); D-2 (answer fallback at `SignalCard.tsx:406-410`, gate the map entry not the rendered text); D-4 (void-callback can't clear loading — page-owned key is correct); the artefactPdf byte-string characterization (fabricated `/Length 2000`, xref `0000002000`/`startxref 3000`, single `MediaBox`, no pagination — `artefactPdf.ts:19-142`); `"playbook"` in the `ArtefactItem.type` union (`types.ts:15`); playbook presentation case (`artefactPresentation.tsx:25`); `enqueueArtefact` (`artefactQueue.ts:9`); folder-driven library folders (`ArtifactsPage.tsx:73-83`); the `_claude` sibling routes (`signals.py:49-61, 89-113`); `ask.py` co-location target exists; `useSignalAsk` → `POST /api/signal_ask_claude` (so the recommendation answer is genuinely Claude-backed); and the SignalsPage citations (`handleSaveAsArtefact` `:531`, `recommendationAnswerLoading` `:81`, answer-fetch effect `:249-286`, single-expanded-recommendation state).
- **TD-FE-78's "Shared with the Strategist artefact download path" is stale** — no `generateAndDownloadPDF` callsite exists under `features/strategist/`. The real shared consumers are `SignalsPage.tsx:534` and `ArtifactsPage.tsx:130` (the latter is the gap flagged in the Medium finding above).
- **`signal_ask_claude` does not inline-guard `CLAUDE_API_KEY`** (unlike `generate-signals-batch_claude` and `signal-lead-map_claude`), so §7.1 D-3's "exactly like the sibling `_claude` routes" slightly overstates the consistency. The spec's *prescribed* inline guard is the better behavior regardless, so this needs no change — only the justification is loose.
