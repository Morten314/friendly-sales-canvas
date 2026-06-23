# Recommendation Artefact — Design Spec

**NN:** 41
**Date:** 2026-06-23
**Status:** Draft (pre-review)
**Author:** Spec authored from the approved design doc `docs/temp/2026-06-22-recommendation-artefact-design.md`
**Stack:** Cross-stack (backend FastAPI + frontend React PWA) — ships as a coordinated change
**Relationship to prior work:**
- **Extends** Spec/Plan 38 (`38-signals-cta-design.md`, "Signals-CTA"), which shipped the **signal-level** "Save as Artefact" (a *Signal Briefing* assembled from cached data). This spec adds a distinct **recommendation-level** "Save as Artifact" that produces a richer, LLM-generated **GTM playbook**.
- The design-doc source supersedes an earlier, never-merged `docs/superpowers/specs/2026-06-18-recommendation-cta-design.md` (not present in the repo).

---

## 1. Implementation Status (investigation result)

**The recommendation-level feature is NOT implemented.** Verified against local `master` (worktree off `52ef6cb`):

| Prescribed artefact | Present? | Evidence |
|---|---|---|
| Backend endpoint `generate-recommendation-artefact[_claude]` | **No** | `grep` of `backend/` → no match |
| FE builder `buildRecommendationPlaybookArtefact` | **No** | only `buildSignalBriefingArtefact` exists (`signalBriefing.ts:30`) |
| FE handler `handleSaveRecommendationAsArtefact` / prop `onSaveRecommendationAsArtefact` | **No** | `grep` of `frontend/src` → no match |
| Per-recommendation "Save as Artefact" button | **No** | the only "Save as Artefact" today is signal-level (`SignalCard.tsx:184`) |

**What already exists and is reused (not rebuilt):**

- **Signal-level "Save as Artefact"** (Spec 38): button at `SignalCard.tsx:177-186`, inside the matched-leads section; handler `handleSaveAsArtefact(signal)` at `SignalsPage.tsx:531`; builder `buildSignalBriefingArtefact(signal, leads)`. Its behavior stays **unchanged**; this feature **relabels** its button + toast copy from "Artefact" to "Artifact" (spelling only, no behavior change — see §6.1 D-7).
- **Artefact delivery surface** (`@/features/artifacts`): `enqueueArtefact(item)` (in-memory queue drained by `/artifacts` on mount — `artefactQueue.ts:9`) and the `ArtefactItem` type are reused **as-is**. `generateAndDownloadPDF(item)` keeps its public signature but its **internals are rewritten** (see §8.5 — the current `artefactPdf.ts::createSimplePDF` is a hand-rolled, structurally non-compliant byte string with fabricated xref offsets and no wrapping/pagination; tracked as `TD-FE-78`).
- **`ArtefactItem.type` already includes `"playbook"`** (`artifacts/types.ts:15`) and the Artefacts library already has a presentation case for it (`artefactPresentation.tsx:25`). The library folders are driven by `ArtefactItem.folder`. **No type change is required.**
- **Recommendation answer flow:** when a recommendation is expanded, `SignalsPage` auto-fetches the answer via `useSignalAsk` → `POST /api/signal_ask_claude` and caches it in `recommendationAnswers[`${signalId}-${index}`]` (`SignalsPage.tsx:249-286`). The recommendation answer is therefore **Claude-backed**.

---

## 2. Problem & Goal

The recommendation answer a user reads inside a signal is ephemeral page state. There is no way to capture a specific recommendation — together with its matched leads and a concrete go-to-market plan — as a durable, shareable asset.

**Goal:** When a user has accepted a signal, expanded one of its recommendations, and read the answer, a prominent **"Save as Artifact"** button produces a complete, self-contained **GTM playbook** for that recommendation — immediately usable by another teammate with no app access. The playbook is delivered as a PDF download **and** enqueued into the in-app Artefacts library (identical delivery path to the signal briefing).

---

## 3. Non-Goals

- Per-lead individual communication templates (one template addresses all matched leads for now).
- Generating the communication template inside the recommendation *answer* flow (it is produced only on the Save action).
- A folder picker or custom filename (standard PDF output via the existing artefact system).
- Any change to the "Chat with Scout/Profiler" button.
- Any **behavior** change to the existing signal-level Save-as-Artifact button (Spec 38) — this feature only **changes** its label + toast copy from "Artefact" to "Artifact" (user-facing spelling, not behavior; see §6.1 D-7).
- Auth/authz/tenancy hardening (out of posture at MVP — backend trusts client-supplied `user_id`/`org_id`, consistent with every existing signals endpoint).

---

## 4. What the Artefact Contains

Seven logical sections, in order. Sections 1–3 come from data already in page state; sections 4–7 are LLM-generated at save time.

1. **Signal Context** — headline, description, and source citations. What market event triggered the play.
2. **Matched Leads** — every matched lead for the signal: company, relevance (High/Medium/Low), and the pre-computed `why`.
3. **Explanation** — the full cached recommendation answer (the Scout/Profiler reasoning for why this recommendation fits this signal).
4. **What to Do with These Leads** — concrete, sequenced next steps for the matched leads given this signal + recommendation. *(LLM)*
5. **Complete Strategy** — the broader play: why the opportunity exists, the competitive/market angle, how to position, what success looks like. *(LLM)*
6. **How to Communicate** — recommended outreach channel(s) (email / LinkedIn / phone / combination), why that channel fits the GTM motion, and the tone/angle. **Channel is determined by the LLM, not hardcoded.** *(LLM)*
7. **Communication Template** — a ready-to-use message in the determined channel(s), with personalisation placeholders (`[First Name]`, `[Company]`, `[specific trigger]`). Multi-touch sequences label each step (Day 1, Day 3, …). *(LLM)*

---

## 5. Data Sources

| Section | Data | Source |
|---|---|---|
| 1. Signal context | headline, description, `source[]` citations | `SignalCard` (already in component) |
| 2. Matched leads | company, relevance, why | `leadsForSignal(signal.id)` from `useSignalLeadMap` → `SignalLeadMapLead[]` (`{lead_id, company, relevance, why}`) |
| 3. Explanation | recommendation answer text | `recommendationAnswers[`${signal.id}-${index}`]` (page state) |
| 4–7. To-do / strategy / channel / template | LLM-generated | **new backend endpoint**, called at save time |

---

## 6. UX / Interaction Design

### 6.1 Recommendation answer action row — current vs. target

> **Spec-vs-design reconciliation (D-1).** The design doc states the existing row "uses `justify-between`" and that the change "maintains the existing left/right separation." That is **inaccurate for the recommendation row**. The actual row at `SignalCard.tsx:448` is a left-aligned `flex items-center gap-2` containing `[👍] [👎] [Chat]`, with **no** `justify-between`. (The `justify-between` pattern lives in the *card header* at `:196`, a different row.) This spec therefore treats the row layout as a **deliberate small change**, not preservation.

**Current** (`SignalCard.tsx:448-500`):
```
[👍] [👎] [Chat with Scout/Profiler]      ← single left-aligned flex, gap-2
```

**Target:**
```
[👍] [👎] [Save as Artifact]                    [Chat with Scout/Profiler]
└──────────── left group ────────────┘          └────────── right ─────────┘
```
- Restructure the row to `flex items-center justify-between`.
- **Left group** (own flex, gap-2): ThumbsUp · ThumbsDown · **Save as Artifact**.
- **Right:** Chat with Scout/Profiler (unchanged, always active).

> **Note (D-7): label = "Save as Artifact" (resolved).** Per the operator: keep the label (not "Save Playbook") and use the **American spelling "Artifact"**. After this change a card carries the signal-level button (leads section, `SignalCard.tsx:184`) and this recommendation-level one (answer row); they produce different artefacts (briefing vs playbook) and are spatially separated, so the duplication is intentional.
>
> **Spelling convention (this feature):** **user-facing copy uses "Artifact"/"Artifacts"** — both button labels, the disabled hints, the error message, and the success toast; this feature also **changes** the existing signal-level button label + toast copy from "Artefact" to "Artifact" (copy only, no behavior change — see §3). **Code identifiers keep "Artefact"** to match the existing surface the builder interoperates with (`ArtefactItem`, `enqueueArtefact`, `buildSignalBriefingArtefact`, `buildRecommendationPlaybookArtefact`, `onSaveRecommendationAsArtefact`, `generateRecommendationArtefact`, the `generate-recommendation-artefact_claude` route, `artefactPdf.ts`, etc.). Renaming the whole "Artefact" code surface is a separate, out-of-scope refactor; the `features/artifacts/` dir + `/artifacts` route are already American.

### 6.2 "Save as Artifact" — gating

Two independent gates. The button is rendered in the answer block, which only appears once the answer has finished loading (`SignalCard.tsx:394` onward), so "loading the answer" and "generating the artefact" never overlap.

| Condition | Button state | On click |
|---|---|---|
| `!isAccepted` | visible, greyed, `aria-disabled` (functionally enabled so it can self-explain — mirrors "Find Matched Leads", `SignalCard.tsx:320-337`) | inline hint below row: *"Accept this signal to save as artifact"*, auto-dismiss after 3s |
| accepted **but** no cached answer (`!recommendationAnswers[key]`) | visible, greyed, `aria-disabled` | inline hint: *"Load the recommendation answer first."* auto-dismiss after 3s |
| accepted **and** answer cached | active (blue outline) | runs the generation flow (§6.3) |
| generating | spinner + "Generating…", non-interactive (prevents double-submit) | — |

> **Note (D-2).** The displayed answer text is `recommendationAnswers[key] ?? item.prompt` (`SignalCard.tsx:406-410`) — i.e. it falls back to the prompt when the answer fetch failed. The Save gate must check the **map entry** (`recommendationAnswers[key]` present and non-empty), **not** the rendered fallback, so a failed answer cannot be saved as a hollow playbook.

> **Note (D-6): zero matched leads is valid output.** The button is **not** gated on having leads. A signal with no matched leads still yields a useful playbook (the strategy / channel / template sections address the signal+recommendation motion, not just the leads). With empty `leads`: `matched_leads: []` to the LLM, `keyFindings: []`, `systemImpact: "0 matched lead(s) targeted"`. The prompt must handle the empty-leads case gracefully; the PDF's Key Findings section renders empty. This is accepted output, not an error.

### 6.3 Active flow (accepted + answer cached, clicked)

1. Button → loading state ("Generating…", spinner). A backend LLM call is in flight (~5–10s).
2. Backend generates sections 4–7.
3. On success: FE assembles the full `ArtefactItem` (§8) from existing data + LLM response, then calls `generateAndDownloadPDF(item)` and `enqueueArtefact(item)` (same order/semantics as the signal briefing, `SignalsPage.tsx:531-535`), and shows a "Saved to Artifacts" toast (reuse the title + "View →" action to `/artifacts`, but with a **playbook-specific description** — the Spec 38 toast reads "Your signal briefing was downloaded…" at `SignalsPage.tsx:536-544`, which is wrong for a playbook).
4. Button returns to active.
5. On error: inline message below row — *"Could not generate artifact — please try again."* Button returns to active.

---

## 7. Backend — New Endpoint

### 7.1 Route

**`POST /api/generate-recommendation-artefact_claude`** in `backend/app/routers/signals.py`.

> **Decision (D-3): use the `_claude` suffix.** Every Anthropic-backed signals endpoint uses it (`generate-signals-batch_claude`, `signal_ask_claude`, `signal-lead-map_claude`). The recommendation answer this playbook builds on is itself Claude-backed (`signal_ask_claude`). The design doc's bare `/api/generate-recommendation-artefact` is renamed for convention-consistency and to make the model lineage explicit. The endpoint guards on `CLAUDE_API_KEY` from `app.services._claude_budget` and **reuses that module's existing token/run limiter for parity with `signal_ask_claude`** (`signals.py:111`) — reuse of the established shared guard, **not** new abuse/auth hardening (consistent with §3), and it bounds the cost of a per-click full Claude generation. (The inline `if not CLAUDE_API_KEY` check is used by `generate-signals-batch_claude`/`signal-lead-map_claude` at `signals.py:49-61, 89-100`; `signal_ask_claude` relies on the limiter instead — the new endpoint adopts both.) Reusing the shared limiter has two accepted consequences: playbook generations draw on the **same 5-min token window** as `signal_ask_claude` (heavy use of one can 429 the other — accepted at MVP, 0 users + generous window), and a budget-exhaustion 429 carries the limiter's inherited `signal_ask_claude` label (cosmetic, never user-surfaced — see §10).

### 7.2 Request / Response (Pydantic models in `app/models/`)

**Request:**
```json
{
  "signal_headline": "string",
  "signal_description": "string",
  "signal_sources": ["string"],
  "matched_leads": [{ "company": "string", "relevance": "high|medium|low", "why": "string" }],
  "recommendation": "string",
  "recommendation_answer": "string",
  "user_id": "string",
  "org_id": "string"
}
```
> `user_id`/`org_id` are added to the design doc's body for parity with every other signals endpoint (used for logging/scoping; no auth is enforced — §3).
>
> **`signal_sources` flattening (resolves the shape mismatch):** `SignalCard.source` is `SourceCitation[] | undefined` (`frontend/src/features/signals/types.ts:18-21,33`), not `string[]`. Flatten with one rule used by the FE service, the builder (§8.2/§9), and the prompt alike: `signal.source?.map((s) => s.citation || s.url).filter(Boolean) ?? []` (citation text, falling back to URL; undefined → `[]`).

**Response:**
```json
{
  "what_to_do": "string",
  "strategy": "string",
  "how_to_communicate": "string",
  "communication_channel": "email|linkedin|email+linkedin|call",
  "communication_template": "string"
}
```

### 7.3 Service + prompt

- New service function `generate_recommendation_artefact_claude(...)` — co-located with the other ask/answer logic (`app/services/signals/ask.py`) or a new sibling module (`app/services/signals/artefact.py`), exported via `app/services/signals/__init__.py`.
- New Jinja2 prompt template under `backend/prompts/signals/` (e.g. `recommendation_artefact.md.j2`), rendered via `app.core.prompts.render(name, **inputs)` (the established prompt path — `services/signals/__init__.py:18-19`). The prompt receives the full signal context, all matched leads with their `why`, the recommendation, and the cached answer, and must:
  1. Reason about the GTM motion implied by the signal + recommendation.
  2. Determine the most effective outreach channel for that motion.
  3. Produce a specific, sequenced action plan for the matched leads.
  4. Produce a communication template using placeholders, in the determined channel(s).
- Model: **Claude (`claude-sonnet-4-6`)**, matching the recommendation-answer model. Output **must be structured JSON** carrying the five fields (not free text) — this avoids the free-text-parse fragility that has caused 500s elsewhere in signals; the service validates the JSON and **degrades gracefully to empty strings** on a malformed/partial response (never throws).

> **Verify the live response shape with `curl`/`/docs` before writing the FE consumer** (repo rule — no generated client; some routes lack `response_model`).

---

## 8. Frontend — Component Changes

### 8.1 New service call — `frontend/src/features/signals/services/signals.ts`

```ts
export async function generateRecommendationArtefact(
  userId: string,
  orgId: string | null,
  body: {
    signal_headline: string;
    signal_description: string;
    signal_sources: string[];
    matched_leads: { company: string; relevance: "high" | "medium" | "low"; why: string }[];
    recommendation: string;
    recommendation_answer: string;
  },
): Promise<RecommendationArtefactResponse>
```
- Implemented with `apiPost("generate-recommendation-artefact_claude", { user_id: userId, ...(orgId ? { org_id: orgId } : {}), ...body }, RecommendationArtefactResponseSchema)` — `org_id` forwarded only when present, mirroring `generateSignalsBatch` (`services/signals.ts:55`).
- Add `RecommendationArtefactResponseSchema` (zod) + `RecommendationArtefactResponse` to `frontend/src/features/signals/contracts.ts`, modeling the five response fields (degrade-never-throw: optional + `.default("")`, consistent with the existing lead-map schemas).

### 8.2 New builder — `frontend/src/features/signals/lib/signalBriefing.ts`

`buildRecommendationPlaybookArtefact(signal, recommendation, recommendationIndex, answer, leads, generated): ArtefactItem` — a pure function alongside `buildSignalBriefingArtefact`, reusing `resolveSignalAgentPresentation(signal.agent)` for `agentName`/`agentIcon`/`agentColor`. Mapping in §9.

### 8.3 `SignalCard` (`components/SignalCard.tsx`)

**New props:**
- `onSaveRecommendationAsArtefact: (index: number) => void` — invoked from the answer action row. *(Signature drops `signalId`; the page closes over `signal` per card, matching the existing `onFindMatchedLeads: () => void` / `onSaveAsArtefact: () => void` convention. Minor simplification of the design doc's `(signalId, index)`.)*
- `recommendationArtefactGeneratingKey: string | null` — the `${signalId}-${index}` currently generating (drives the spinner). *(See D-4.)*

**New local state:** `artefactHint: Record<number, boolean>` (per-recommendation disabled-hint visibility) + a per-card timer ref, mirroring the existing `showLockMessage`/`lockTimerRef` pattern (`SignalCard.tsx:97-134`). A single boolean is acceptable since only one recommendation is expanded at a time, but the index-keyed record matches the design and is robust.

**UI:** add the "Save as Artifact" button to the answer action row (§6.1), with the gating in §6.2 and an inline hint/error `<p>` below the row.

### 8.4 `SignalsPage` (`pages/SignalsPage.tsx`)

- **New state:** `recommendationArtefactGenerating: string | null` (key `${signalId}-${index}`), mirroring `recommendationAnswerLoading` (`:81`).
- **New handler `handleSaveRecommendationAsArtefact(signal, index)`:**
  1. **Resolve `item` exactly as the card/effect do** (`SignalCard.tsx:342-348`, `SignalsPage.tsx:255-260`): `const list = signal.NBAs?.length ? signal.NBAs : (signal.nextBestMoves ?? []).map((m) => ({ nba: m, prompt: "" })); const item = list[index]; const key = ` `${signal.id}-${index}` `. Mirroring the card guarantees `index` maps to the same list the card indexed (a naive `signal.NBAs[index]` would be `undefined` for `nextBestMoves`-sourced signals). In practice only prompt-bearing NBAs reach this button (it lives in the card's `hasPrompt` block, `SignalCard.tsx:383`), but resolve defensively.
  2. Guard (no-op bail) unless **all** hold: `isAccepted` (`acceptedSignals.has(getSignalContentHash(signal))`), `orgId` is truthy (`SignalsPage`'s `orgId` is `string | null`, `:46` — prevents a null-org request), and `recommendationAnswers[key]` is present and non-empty. The button's own gate already blocks the click; the handler re-checks.
  3. Set `recommendationArtefactGenerating = key`.
  4. `const leads = leadsForSignal(signal.id)`.
  5. `await generateRecommendationArtefact(currentUser.uid, orgId, { signal_headline: signal.headline, signal_description: signal.description, signal_sources: <flattened per §7.2>, matched_leads: leads.map(...), recommendation: item.nba, recommendation_answer: recommendationAnswers[key] })`.
  6. `const artefact = buildRecommendationPlaybookArtefact(signal, item, index, recommendationAnswers[key], leads, generated)`.
  7. `generateAndDownloadPDF(artefact)` → `enqueueArtefact(artefact)` → success toast with a **playbook-specific** description (not the Spec 38 "signal briefing" copy — §6.3).
  8. On error: error toast + inline error state (cleared key).
  9. `finally`: clear `recommendationArtefactGenerating`.
- **Wire the new props** in the `<SignalCard>` render (`:760-818`):
  `onSaveRecommendationAsArtefact={(index) => handleSaveRecommendationAsArtefact(signal, index)}` and `recommendationArtefactGeneratingKey={recommendationArtefactGenerating}`.

> **Decision (D-4): loading state is page-owned, not card-local.** The design doc proposes a card-local `artefactGenerating: Record<number, boolean>` driven by a `void` callback — but a `void` callback cannot signal completion, so the card could never clear that state. This spec instead mirrors the established `recommendationAnswerLoading` pattern (page owns the loading key, passes it down). The card keeps only the disabled-hint state local. This is consistent, avoids an awaitable-callback contract, and matches the codebase.

### 8.5 PDF generator upgrade — adopt jsPDF (partially resolves TD-FE-78)

The current `artefactPdf.ts::createSimplePDF` hand-builds a raw PDF byte string with a hardcoded `/Length 2000`, **fabricated xref offsets** (`0000002000`, `startxref 3000` — not real byte positions), a single-page `MediaBox`, **no text wrapping, and no pagination** (`artefactPdf.ts:19-142`). Short signal briefings survive this on lenient viewers; a playbook's long `strategy`/`template` prose will run off the page and clip. This is already logged as **`TD-FE-78`** ("Shared PDF generator emits structurally non-compliant output and mojibakes non-WinAnsi glyphs"), whose prescribed fix is *"a real PDF library (e.g. jsPDF/pdf-lib) with correct xref, multi-page flow, **and Unicode-capable font embedding**"* and whose pull-forward trigger is *"the PDF path is prioritized."* **This feature is that trigger** — so the upgrade is in scope here and **partially resolves TD-FE-78** (the xref + multi-page halves). The **Unicode-font-embedding half stays open** (see the escaping note below).

**Library choice: `jsPDF` (^4.0.0).** Rationale:
- Built-in `splitTextToSize(text, maxWidth, opts)` does **font-metric-aware word-wrapping** (returns an array of fitted lines); `addPage()` + a tracked Y-cursor gives **pagination**. These are exactly the two missing capabilities, with no hand-rolled layout math.
- Browser-native, synchronous, pure-JS (runs in the jsdom vitest env, so unit tests work). Emits a **structurally valid PDF with a correct xref** (fixes the fabricated-offset half of TD-FE-78).
- This work **does not embed a Unicode font** (that would bundle a large TTF) — the existing ASCII-folding stays as the WinAnsi safety net, so the **Unicode-glyph half of TD-FE-78 remains open** (accented names / non-Latin scripts still fold or mojibake, unchanged from today). jsPDF 2.5.2+ *supports* embedding a Unicode font if that half is later pulled forward.
- `pdf-lib` is the alternative the TD entry also names, but its text layout (line-breaking) is manual — more code for the same result. **Decision: jsPDF.**

**Approach (within `artefactPdf.ts`, public surface unchanged):**
- Add `jspdf` to `frontend/package.json` dependencies.
- Replace the `createSimplePDF` byte-string builder with a jsPDF document builder (e.g. `buildArtefactPdfBlob(artefact): Blob`): set US-Letter/A4 page; render the title, the `Generated by … | … | Task ID …` header line, then each `fullReport` section as **bold heading + wrapped body**, advancing the Y-cursor by `doc.getLineHeight() / doc.internal.scaleFactor` and calling `addPage()` (reset Y to top margin) when `y` nears `doc.internal.pageSize.getHeight() − bottomMargin`. `keyFindings` / `recommendations` render as wrapped numbered lines.
- `generateAndDownloadPDF(item)` keeps its signature; produce the Blob via jsPDF (`doc.output("blob")`) and reuse the existing anchor-download with the same `${slug}-${Date.now()}.pdf` filename (or `doc.save(name)`).
- `escapePdfText`: **drop the structural paren/backslash escaping** (jsPDF owns string encoding); **keep the ASCII-folding** (en/em-dash, smart quotes, bullet) as a cheap WinAnsi safety net unless a Unicode font is embedded.

**Shared-surface caution:** this generator has **two** live consumers — the Spec 38 signal briefing (`SignalsPage.tsx:534`) **and** the Artefacts-library re-download (`ArtifactsPage.tsx:130`, where any saved artefact, including a `playbook`, is re-downloaded later). The upgrade improves both, but **neither may regress** — re-verify both paths. (TD-FE-78's "Strategist download path" note is stale — no such callsite exists; `ArtifactsPage.tsx:130` is the real second consumer.)

**Bundle:** jsPDF adds to the FE bundle; `preflight`'s `bundle:check` is **advisory**, so a size bump is acceptable (and sanctioned by TD-FE-78). Import it from the artefacts lib only (keep it out of shared entry chunks).

---

## 9. `ArtefactItem` Mapping (complete)

The design doc's mapping table is **incomplete** — it omits required `ArtefactItem` fields. Full mapping (modeled on `buildSignalBriefingArtefact`):

| `ArtefactItem` field | Value |
|---|---|
| `id` | `` `recommendation-playbook-${signal.id}-${recommendationIndex}-${Date.now()}` `` |
| `agentName` | `resolveSignalAgentPresentation(signal.agent).agentName` (Scout / Profiler) |
| `agentIcon`, `agentColor` | from the same resolver *(required by the type; omitted by the design table)* |
| `taskNumber` | `"GTM Playbook"` |
| `timestamp` | `signal.timestamp` |
| `status` | `"new"` |
| `type` | `"playbook"` |
| `folder` | `"GTM Playbooks"` |
| `actionDelegated` | `recommendation.nba` |
| `contextRationale` | `signal.description.slice(0, 200)` |
| `systemImpact` | `` `${leads.length} matched lead(s) targeted` `` *(library-card field; sensible default)* |
| `actionPerformed` | `"Generated GTM playbook for recommendation"` *(default)* |
| `outputSummary` | `generated.strategy.slice(0, 150)` |
| `fullReport.title` | `signal.headline` |
| `fullReport.executiveSummary` | `signal.description` + recommendation text + a `Sources: …` line built from `signal.source[]` *(see D-5)* |
| `fullReport.keyFindings` | per lead: `` `${company} (Relevance: ${Titlecase}): ${why}` `` |
| `fullReport.analysis` | `` `${generated.strategy}\n\n${generated.whatToDo}` `` |
| `fullReport.recommendations` | `["Explanation: " + answer, `How to Communicate (${communication_channel}): ${how_to_communicate}`, "Communication Template:\n" + communication_template]` |

> **Decision (D-5): map `signal.source` into the executive summary.** The design's "Signal Context" names *sources* but its mapping table drops them. Flatten per §7.2 (`signal.source?.map((s) => s.citation || s.url).filter(Boolean) ?? []`) and append as a `Sources:` line in `executiveSummary`. This is a **new** decision for the playbook — `buildSignalBriefingArtefact` does **not** carry sources today (it sets `executiveSummary: signal.description`, `signalBriefing.ts:64`; `:43` is only the per-lead `why` comment), so the two builders intentionally diverge here.

> **PDF legibility:** the PDF surfaces five sections — `title / EXECUTIVE SUMMARY / KEY FINDINGS / ANALYSIS / RECOMMENDATIONS`; `keyFindings` and `recommendations` are numbered lists. The seven logical sections are compressed into these five with **label prefixes** (above) so the output stays readable. With the §8.5 jsPDF upgrade, each section now **wraps and paginates**, so the long `strategy`/`template`/`analysis` text renders in full across pages rather than clipping. This matches the design doc's "developer note" guidance.

---

## 10. Error Handling

| Scenario | Behaviour |
|---|---|
| Backend returns error / network timeout | inline below row: *"Could not generate artifact — please try again."* + error toast; button reverts to active |
| Answer not cached (edge) | button stays disabled with hint *"Load the recommendation answer first."* (gate §6.2 / D-2) |
| Not accepted | button disabled with hint *"Accept this signal to save as artifact"* (auto-dismiss 3s) |
| Empty/short LLM fields | zod defaults to `""`; builder still produces a valid `ArtefactItem` (degrade-never-throw) |
| Claude token budget exhausted (shared 5-min window) | backend returns **429** (`BudgetExhaustedError`, `exceptions.py:136`); FE handles it like any other backend error — inline *"Could not generate artifact — please try again."* + toast, button reverts. The reused limiter's 429 payload carries an inherited `"…for signal_ask_claude"` label (`_claude_budget.py:54-60`) — cosmetic, never user-surfaced (the user sees the generic inline copy), accepted as-is rather than generalised here. |

---

## 11. Risks & Open Decisions

- **R-1 (RESOLVED → in scope): PDF fidelity.** The flat, fixed-position generator would clip long playbook prose, undermining the design's core promise ("immediately usable by another person"). **Decision (user-confirmed): rewrite the generator with `jsPDF` (wrapping + pagination) as part of this feature — see §8.5.** This **partially resolves** the pre-existing `TD-FE-78` (xref + pagination; the Unicode-font-embedding half stays open) and improves the Spec 38 briefing + the Artefacts re-download path. The do-nothing/MVP-accept alternative was rejected because clipped playbooks defeat the feature's purpose.
- **R-2: LLM latency / output discipline.** 5–10s synchronous call with no queue/retry (backend async is in-process only). Acceptable for a user-initiated action with a visible spinner; prefer structured output to avoid free-text parse failures (a recurring signals issue).
- **D-1…D-5:** layout reconciliation, answer-gate source, endpoint naming, loading-state ownership, sources mapping — resolved inline above; listed here for the reviewer's convenience.

---

## 12. Testing Strategy

Frontend (vitest + RTL + MSW; no e2e required beyond existing):
- **Builder unit test** (`lib/__tests__/signalBriefing.test.ts`, alongside the briefing test): `buildRecommendationPlaybookArtefact` maps every field; label prefixes present; degrades on empty LLM fields.
- **`SignalCard` CTA test** (`components/__tests__/SignalCard.cta.test.tsx`): button hidden/greyed when `!isAccepted` (hint on click, 3s dismiss); greyed when answer not cached; active + calls `onSaveRecommendationAsArtefact(index)` when accepted + cached; spinner when `recommendationArtefactGeneratingKey` matches; row is `justify-between` with Chat on the right.
- **`SignalsPage` test** (`pages/__tests__/SignalsPage.cta.test.tsx`): MSW stub for `POST /api/generate-recommendation-artefact_claude`; handler assembles the item and calls `generateAndDownloadPDF` + `enqueueArtefact`; error path shows the inline message and reverts.
- **Contract test** (`__tests__/contracts.test.ts`): `RecommendationArtefactResponseSchema` parses the documented shape and tolerates extras/missing.
- **PDF generator test (migrated — `artifacts/lib/__tests__/artefactPdf.test.ts`):** the existing test asserts raw-byte output of the hand-rolled string; with jsPDF those byte assertions are replaced. New assertions: the builder returns a `%PDF`-headed Blob, does not throw on long/multi-section content, produces **>1 page** for long input (assert via jsPDF `getNumberOfPages()`), and includes every section's text. Re-point/keep `escapePdfText` tests per the §8.5 escaping change. Add **no-regression** checks for **both** generator consumers: the Spec 38 signal briefing (`SignalsPage.tsx:534`) and the Artefacts-library re-download (`ArtifactsPage.tsx:130`) — including a saved `playbook` re-downloading multi-page.
- Run `npm run verify` per task; full `npm run preflight` at the merge gate (serial; per the FE flake note). Watch the **advisory** `bundle:check` for the jsPDF size bump (expected, accepted).

Backend:
- `backend/tests/` unit coverage for **structured-field extraction** (valid JSON → five fields) and **graceful degradation on malformed/partial JSON** (empty-string fallback, never throws — matching §7.3), patch-where-used per `backend/TESTING.md`. Note: root-level `backend/test_*.py` are **live production probes**, not unit tests.

---

## 13. Affected Files

| File | Change |
|---|---|
| `backend/app/routers/signals.py` | new `POST /generate-recommendation-artefact_claude` route |
| `backend/app/services/signals/ask.py` *(or new `artefact.py`)* + `__init__.py` | new `generate_recommendation_artefact_claude` service |
| `backend/app/models/` | new request/response Pydantic models |
| `backend/prompts/signals/recommendation_artefact.md.j2` | new prompt template |
| `backend/tests/` | structured-field extraction + malformed-JSON degradation test (per §7.3 / §12) |
| `frontend/src/features/signals/services/signals.ts` | new `generateRecommendationArtefact` |
| `frontend/src/features/signals/contracts.ts` | new response schema/type |
| `frontend/src/features/signals/lib/signalBriefing.ts` | new `buildRecommendationPlaybookArtefact` |
| `frontend/src/features/signals/components/SignalCard.tsx` | new props/state + button + row layout; **relabel the existing signal-level button "Save as Artefact" → "Save as Artifact"** (`:184`, copy only) |
| `frontend/src/features/signals/pages/SignalsPage.tsx` | new state + handler + prop wiring; **relabel the existing signal-briefing toast copy "Artefacts" → "Artifacts"** (`:536-538`, copy only) |
| `frontend/src/features/signals/**/__tests__/` | builder/CTA/page/contract tests |
| `frontend/src/features/artifacts/types.ts` | **no change** — `"playbook"` already in the union |
| `frontend/src/features/artifacts/lib/artefactPdf.ts` | **rewrite** with jsPDF — wrapping + pagination (§8.5) |
| `frontend/package.json` | add `jspdf` (^4) dependency |
| `frontend/src/features/artifacts/lib/__tests__/artefactPdf.test.ts` | migrate raw-byte assertions to jsPDF (§12) |
| `docs/TECH_DEBT.md` | **TD-FE-78 → partially resolved** (xref + pagination done; Unicode-font-embedding half stays open); fix its stale "Strategist" shared-consumer note → `ArtifactsPage.tsx:130` |

---

## 14. Acceptance Criteria

1. With a signal **accepted** and a recommendation **answer loaded**, a "Save as Artifact" button in the recommendation answer row is active; clicking it shows "Generating…", then downloads a PDF **and** the artefact appears in `/artifacts` under a "GTM Playbooks" folder, typed `playbook`.
2. The PDF/artefact contains all seven sections sourced per §5 + §9 (signal context incl. sources, matched leads, explanation, what-to-do, strategy, how-to-communicate with an LLM-chosen channel, and a placeholder-bearing template).
3. When the signal is **not accepted**, the button is greyed and clicking shows the accept hint (auto-dismiss 3s); when accepted but the answer is **not cached**, it is greyed with the "load the answer first" hint.
4. The signal-level "Save as Artifact" (Spec 38; relabelled from "Artefact" — copy only) behaves identically, and the upgraded renderer regresses **neither** its PDF **nor** the Artefacts-library re-download (`ArtifactsPage.tsx:130`).
5. **PDF fidelity:** a playbook with long strategy/template content produces a **multi-page** PDF where all text **wraps within the page margins** and nothing is clipped; the file opens cleanly in a standard viewer (valid `%PDF` header + real xref via jsPDF). **TD-FE-78 is marked partially resolved** (xref + pagination; the Unicode-font-embedding half remains open).
6. Backend error/timeout yields the inline error and a re-enabled button; no hollow artefact is ever produced from a missing answer.
7. `npm run preflight` (frontend, incl. the migrated `artefactPdf` test) and the backend unit tests are green.
