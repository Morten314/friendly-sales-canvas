---
artifact: specs/27-frontend-phase-8-signals-strategist-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-04
round: 1
---

## Context

Review performed from the spec text alone plus AGENTS.md project context. No live codebase walk was performed to independently verify the LOC counts, import graphs, or runtime-reachability claims; those are taken at face value.

## Findings

### High

#### Stage 8c is underspecified as a single stage

**Location:** §7, "8c — Signals feature (the big stage)"

8c bundles scaffolding, route registry, relocation of a 1,730-LOC page, building four TanStack Query hooks with zod contracts + MSW handlers, migrating both the page and the already-relocated substrate to the shared hooks, extracting `useSignalAcceptance`, and a full 5a-style decomposition into a shell + section components. Risk R3's mitigation ("one extraction per commit") effectively admits 8c is many sub-stages behind a single checkpoint label. The spec should either decompose 8c into ordered sub-stages (e.g., 8c-1 scaffold + relocate, 8c-2 data layer, 8c-3 decomposition) or explicitly state that the plan must sub-decompose 8c and that the "8c checkpoint" is the aggregate of its sub-commits.

#### Manual smoke sign-off is an undefined acceptance gate

**Location:** §8, "Parity discipline" — "Manual smoke sign-off on `/signals` and `/your-ai-team/strategist/{workspace,leadstream}` before merge."

This introduces a human-in-the-loop gate that is not reflected in the execution stages (§7) or the done-when criteria (§11). The spec does not define who performs the sign-off, what specific behaviors or visual states constitute a pass, or what happens if it fails (does it block merge? is there a remediation path?). Either integrate the smoke sign-off into the finalize stage with explicit pass criteria, or move it to a non-blocking recommendation.

#### Parity audit for the 1,730-LOC decomposition is unspecified

**Location:** §4, "TanStack parity" + §9 Risk R3

R3's mitigation says "loading/error-parity audit per §4" but §4 only states: "Each migrated site's loading/error render is audited against the raw-fetch equivalent during 8c." The audit method is undefined. Is it a side-by-side visual comparison? An automated test asserting loading/error states match? A console-log check? Given that `Signals.tsx` has 4 raw-fetch endpoints, heavy `localStorage` state, and is being decomposed into multiple section components, the audit scope and method need concrete definition in the plan or the spec.

### Medium

#### Permissive zod contracts add ceremony without runtime safety

**Location:** §4, "Permissive zod"

The spec acknowledges this follows Phase 7 posture (`.passthrough()`, optional fields, no effective throw path). The result is type definitions that serve as documentation only — they provide no runtime protection and will silently pass malformed backend responses. This is a deliberate tradeoff, but the spec should explicitly state when this posture is expected to tighten (is there a TD-FE entry for it? Phase 13? never?). As written, it reads as accepted indefinitely without a pull-forward trigger.

#### signal_Ask / signal_action hook abstraction may not cover both call patterns

**Location:** §4, shared-boundary rule; §3, `shared/chat/useSignalAsk.ts` and `useSignalAction.ts`

The spec says a "single shared implementation replaces both the substrate's and the page's duplicate raw fetches." But the substrate (`SignalsContextChat`) and the Signals page may invoke these endpoints with different call patterns — the substrate is a multi-turn chat with streaming-like UX, while the page may call them in batch or one-shot contexts. The spec does not describe the behavioral contract of these endpoints or confirm that a single `useMutation` hook abstraction can serve both patterns without specialization. The plan should verify this before committing to a single hook per endpoint.

#### ScoutChat/ProfilerChat near-duplication creates a substrate interface risk for Phase 9

**Location:** §5, "Dedup handoff for Phase 9"; AGENTS.md gotchas

AGENTS.md notes that `ScoutChatWithHistory` and `ProfilerChatWithHistory` are "90% the same component." Phase 8 moves both to consume the same `shared/chat` substrate, which is correct. However, Phase 9's wrapper dedup may require interface changes to the substrate (e.g., adding configuration props to handle the 10% divergence). If so, that retroactively affects the shared hooks and contracts Phase 8 establishes. The spec should note this forward-compatibility concern — not to design for it now, but so the plan ensures the shared substrate's public surface is documented well enough for Phase 9 to evaluate without re-reading the implementation.

#### Strategist "runtime-unreachable" verification is a single-method grep

**Location:** §1.2.3, "verified: only two reads in `Deals.tsx`, zero writers anywhere"; §9 Risk R5

The "dead" verdict rests on a textual grep for `sessionStorage.setItem("strategistContext")`. Dynamic key access patterns (computed property access, template literals, indirect writes via helper functions) could evade a literal grep. R5's mitigation ("relocate as-is, don't delete") is sound for Phase 8 but the certainty of the "dead" label propagates to Phase 13's dead-code removal. The spec should qualify the claim (e.g., "verified by textual grep; dynamic patterns not excluded") so Phase 13 can assess verification rigor independently.

### Low

#### Substrate test scope is undefined

**Location:** §7, stage 8a — "Add a substrate unit test (`shared/chat/__tests__`)" + §3 directory listing with no named test file.

What does the substrate test cover? Render? Fetch mocking? Chat-message state? Error handling? Without specifying the test's scope, the checkpoint criterion is subjective.

#### Dead-code annotation update is unnecessary churn

**Location:** §6, "Its `// HANDOFF → strategist` file-header annotation is updated to note the relocation landed."

Updating a comment inside a dead, runtime-unreachable component that is explicitly being relocated as-is and flagged for Phase 13 removal. The annotation update adds a code change to a file whose charter is "touch minimally."

#### LOC figures are fragile anchors

**Location:** §1.2, "LOC drift"; §1.3 tables.

The spec carefully notes these are "measured" and "used as measured," but any changes between spec authoring and plan execution (e.g., a Phase 7 merge that touches shared imports) will silently invalidate them. Not a defect, but the plan should re-measure rather than trust spec figures.

#### TD-FE-52 conditional has no fallback

**Location:** §10, "TD-FE-52 (conditional) — Strategist VR baseline absent; behavioral coverage added in lieu, full VR baseline deferred (only if §8 confirms the gap)."

If the gap is confirmed AND the behavioral coverage also proves insufficient (e.g., the strategist surface has significant visual complexity that render tests miss), there's no escalation path. The spec could add a fallback: if behavioral coverage is inadequate, create the VR baseline rather than deferring.

#### `alias` import mechanism is undefined

**Location:** §3.1 dependency table — "ScoutChatWithHistory → ScoutChatPanel (legacy `components/market-research/`) | alias"

The term "alias" is not defined. Presumably a path alias (`@/components/market-research/ScoutChatPanel`), but it could be a webpack/vite resolve alias or a TypeScript `paths` entry. The plan should specify.

### Nit

#### "Phase 5 + foundation" is ambiguous

**Location:** §1.1 — "Phase 8 depends only on Phase 5 + foundation"

The "+" could be read as conjunction ("Phase 5 AND foundation") or disjunction. Context makes it conjunction, but a parenthetical like "(Phase 5 and the Phase 1–3 foundation)" would be unambiguous.

#### RTL acronym introduced without expansion

**Location:** §8 — "New per-component Vitest + RTL + MSW"

RTL is presumably React Testing Library. First use should expand it.

#### Stage dependency phrasing is imprecise

**Location:** §7 — "8a→8b and 8a→8c are ordered (8b/8c depend on the substrate's new location)"

Should read "8b and 8c depend on 8a" — the arrow notation `8a→8b` usually means "8a precedes 8b," which is what's meant, but the parenthetical restatement uses "depend on" which is the reverse dependency direction. Consistent phrasing would be clearer.

#### "Legacy deep import" term used without definition

**Location:** §1.3 — "legacy deep import in `App.tsx`"

Used twice in §1.3 without explanation. A reader unfamiliar with the Phase 4–6 work wouldn't know this means an `import SomePage from '@/pages/SomePage'` in `App.tsx` that should be replaced by a lazy route registry entry.

#### §2.1 "shared/chat" bullet is imprecise about hook vs contract destination

**Location:** §2.1 — "signal_Ask + signal_action endpoints (shared with the substrate) land in `src/shared/`"

Says "land in `src/shared/`" but the §4 table and §3 structure place hooks in `shared/chat/` and contracts in `shared/api/`. The §2.1 bullet should match the more precise §4/§3 language.
