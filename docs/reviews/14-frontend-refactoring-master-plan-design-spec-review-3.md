---
artifact: specs/14-frontend-refactoring-master-plan-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 3
---

## Context

Round 3 review. Rounds 1 and 2 produced 20 + 17 findings respectively; both syntheses were agreed and incorporated. This round focuses on residual contradictions that survived prior fixes, new issues introduced during round 2/3 revisions, and architectural concerns not previously surfaced. Cross-referenced against both prior reviews and syntheses to avoid re-litigating disagreed findings. No token pressure; full spec reviewed.

## Findings

### Medium — Overview table Phase 2b row contradicts detailed description on `import/no-restricted-paths`

**Location:** §4 Overview table row 2b ("`import/no-restricted-paths` (rules from §3.3)"), §4 Phase 2b detailed description ("Features-specific dependency rules (§3.3) are NOT enforced here"), §4 Overview table row 4 ("Wire features-specific lint rules (deferred from Phase 2b)")

Round 1 synthesis finding #2 agreed that Phase 2b should *not* enforce features-specific dependency rules, deferring them to Phase 4. The detailed Phase 2b description was correctly revised. But the overview table for Phase 2b still includes `import/no-restricted-paths` (rules from §3.3). Meanwhile, Phase 4's overview row correctly says "Wire features-specific lint rules (deferred from Phase 2b)." The overview is the first (and often only) thing readers scan; a spec author working from the table alone would add the rules in Phase 2b, directly against the agreed sequencing fix.

**Suggestion:** Remove `import/no-restricted-paths (rules from §3.3)` from the Phase 2b overview row. Replace with just "`import/order`, Prettier check." The Phase 4 overview row already correctly captures the deferred rules.

---

### Medium — Phase 8 proposes placing chat-history primitive in `src/features/scout/` before Phase 9 creates it

**Location:** §4 Phase 8 ("extract a shared chat-history primitive in `src/features/scout/` or `src/shared/` and reuse from both")

Phase 8 suggests the deduplication product could live in `src/features/scout/`. But `src/features/scout/` doesn't exist until Phase 9. If Phase 8 runs first and places a shared primitive into a feature folder that hasn't been scaffolded yet, it would either need to create the scout skeleton early (violating Phase 4's scaffold-first convention) or create a phantom directory. This is the same class of issue as round 2's Phase 5 5c finding (#4), where components were routed to features that didn't exist yet.

**Suggestion:** Remove `src/features/scout/` as a placement option from Phase 8's description. The shared chat-history primitive should go to `src/shared/` (which exists from Phase 4 onward). Phase 9 can then move or alias it into `src/features/scout/` if the scout feature wants to own it.

---

### Medium — Phase 8 tasked with deduplicating ProfilerChatWithHistory which Phases 6/7 own

**Location:** §4 Phase 8 ("`ScoutChatWithHistory` (signals) and `ProfilerChatWithHistory` (~90% the same component) — Phase 8 spec coordinates the deduplication")

Phase 8's sources are `src/components/signals/*` and `src/components/strategist/*`. `ScoutChatWithHistory` is indeed in signals. But `ProfilerChatWithHistory` — per root `AGENTS.md` and this spec's §4 Phase 6/7 descriptions — lives split between mission-control and customers. By Phase 8, ProfilerChatWithHistory would have been extracted into either `src/features/mission-control/` or `src/features/customers/` (or split across both). Phase 8 has no authority to modify another feature's code — the §5.5 scope discipline rule says "each phase has authority to write/edit/refactor inside its scope only." Assigning cross-feature dedup to Phase 8 violates the spec's own scoping rule.

**Suggestion:** Phase 8 extracts `ScoutChatWithHistory` into `src/features/signals/` (or `src/shared/`) and records the dedup opportunity in its spec as a handoff annotation (same pattern as Phase 5's 5c). Phase 9 (scout + profiler) owns the actual deduplication — it has authority over both scout and profiler surfaces and can coordinate with mission-control/customers via their `index.ts` public surfaces.

---

### Medium — Phase 13 introduces `src/shared/ui-patterns/` not present in §3.1 target layout

**Location:** §4 Phase 13 ("Repeated UI patterns (form-row, dialog-shell, table-wrapper) — extract to `src/shared/ui-patterns/`"), §3.1 target layout (shows `src/shared/` with only `api/`, `hooks/`, `lib/`, `types/`, `README.md`)

Phase 13 proposes extracting repeated UI patterns into `src/shared/ui-patterns/`. But the canonical target layout in §3.1 doesn't include this directory. The §3.1 layout is the architectural contract that every phase spec author references. Adding directories to it outside §3.1 creates a two-source-of-truth problem: the diagram says one thing, the Phase 13 description says another.

**Suggestion:** Either (a) add `ui-patterns/` to the §3.1 target layout (under `src/shared/`), or (b) redirect Phase 13's UI-pattern extractions to `src/shared/lib/` or `src/shared/hooks/` (which are in the layout). If `ui-patterns/` is a legitimate shared concern, the canonical layout should reflect it.

---

### Medium — Circular cross-feature dependency risk between features is unaddressed

**Location:** §3.3 dependency rules, §4 Phase 6 ("ICPManager owns ICP CRUD that `customers/` features will consume"), §4 Phase 7 ("`ICPSummaryOpportunity` couples to mission-control's ICP CRUD")

§3.3 allows `features/<X>/` to import from `features/<Y>/index.ts` and vice versa, with no restriction on circular imports. Phase 6 (mission-control) defines ICP CRUD that Phase 7 (customers) consumes via `mission-control/index.ts`. But customers also surfaces ICP-related components that mission-control may need back. If both features import from each other's `index.ts`, a circular dependency forms. The `index.ts`-only rule prevents *deep* coupling but not *circular* coupling. ESLint's `import/no-cycle` rule exists for exactly this scenario, but it's not mentioned in §3.3 or Phase 2b's lint rules.

**Suggestion:** Add to §3.3: "Circular imports between features are forbidden. If two features genuinely need each other's types, the shared types move to `src/shared/types/`." Consider adding `import/no-cycle` (from `eslint-plugin-import`) to Phase 4's lint deliverables alongside the other import rules.

---

### Low — Phase 3 creates `src/shared/api/` before Phase 4 defines shared placement conventions

**Location:** §4 Phase 3 ("Define API contract types in `src/shared/api/contracts.ts`"), §4 Phase 4 ("Create `src/shared/README.md` documenting promotion criteria")

Phase 3 places contract types and the rate-limited fetcher into `src/shared/api/`. Phase 4 then creates `src/shared/README.md` documenting the promotion criteria for what belongs in shared. Phase 3 makes shared-placement decisions before the criteria exist. This is a minor sequencing issue — Phase 3's placement is obviously correct (API infrastructure is genuinely shared) — but a pedantic reader could note the tail wagging the dog.

**Suggestion:** Accept as-is (the placement is unambiguous), or add a one-line note to Phase 3: "API infrastructure is unambiguously shared; Phase 4's promotion criteria formalize the general rule that this placement already follows."

---

### Low — §7 R1 calls 1,500 a "hard error-count gate" but §4 describes it as a sub-decomposition trigger

**Location:** §7 R1 ("Phase 2a has a **hard** error-count gate (1,500)"), §4 Phase 2a ("If the error count exceeds 1,500, the plan author must **propose** a sub-decomposition")

§7 R1 uses "hard gate" language implying the threshold blocks progress. §4 Phase 2a describes it as a trigger for additional planning work (sub-decomposition proposal), not a blocker. A "gate" in CI/CD terminology means "pass or fail." Here, exceeding 1,500 doesn't fail — it requires more planning. The terminology mismatch could mislead a Phase 2a spec author into thinking the phase can't proceed past 1,500 errors.

**Suggestion:** Change §7 R1 from "hard error-count gate" to "error-count threshold" or "sub-decomposition trigger." Reserve "gate" for CI gates that actually block.

---

### Low — Phase 4 pre-commits AuthContext to `src/features/shell/` while simultaneously deferring the decision

**Location:** §4 Phase 4 shell extraction deliverables ("Extract `src/contexts/AuthContext.tsx`... **into `src/features/shell/`**"), §4 Phase 4 text ("AuthContext's final home (shell vs auth) is a **Phase 4 spec decision** (see §8 Q1)")

The shell extraction deliverables heading says "into `src/features/shell/`" as a commitment. The body text says the Phase 4 spec decides between `shell/` and `auth/`. If the Phase 4 spec author decides on `auth/`, the heading is wrong. If they decide on `shell/`, the deferral text is misleading. These should be consistent.

**Suggestion:** Soften the heading to "Extract AuthContext into `src/features/shell/` or `src/features/auth/` (Phase 4 spec decides — see §8 Q1)."

---

### Low — Phase 10 auth/shell relationship underspecified

**Location:** §4 Phase 10 ("Phase 10's `auth/` feature reuses whichever location was chosen; it does not re-extract"), §4 Phase 10 sources ("`src/pages/Login.tsx` + Firebase integration → `src/features/auth/`")

If Phase 4 places AuthContext in `src/features/shell/` (per the default), Phase 10's `auth/` feature would contain Login + Firebase integration but not the auth context itself. The auth context and the login page are tightly coupled (Login calls AuthContext methods). Splitting them across two feature folders creates a cross-feature coupling that isn't surfaced as a risk. Phase 10's "Key risks / coupling points" section doesn't mention this.

**Suggestion:** Add to Phase 10's key risks: "AuthContext lives in `src/features/shell/` (or `auth/`) per Phase 4 decision. Phase 10's auth feature may be split across two folders if context is in shell. Phase 10 spec confirms the auth feature's public surface includes enough for other features to consume without reaching into shell internals."

---

### Nit — §1.5 references "Approach 1/2/3 from brainstorming" without linking to brainstorming output

**Location:** §1.5 ("Linear backend-mirror A–L (Approach 1 from brainstorming)", "Foundation-first big-bang (Approach 2 from brainstorming)", "Risk-tiered parallel-friendly (Approach 3 from brainstorming)")

The alternatives section references brainstorming approaches by number but doesn't link to the brainstorming session output. A reader who wasn't in the brainstorming session can't evaluate these claims independently. The §9 companion documents section doesn't list the brainstorming artifact either.

**Suggestion:** Either add a link to the brainstorming output in §1.5 or §9, or make each rejection self-contained (describe what the approach entails in one sentence before rejecting it, which the current text partially does).

---

### Nit — Phase 5c handoff annotation "wherever they currently live" is imprecise

**Location:** §4 Phase 5, sub-split 5c ("stay in their current pre-extraction location (under `src/components/<area>/` or wherever they currently live)")

The parenthetical is deliberately imprecise to avoid over-constraining. But "wherever they currently live" could mean "in `src/components/market-research/`" (the most likely location) or scattered across multiple directories. The Phase 5 spec will need to enumerate each component's exact current path to make the handoff actionable. This is truly nit-level since the Phase 5 spec carries that burden regardless.

**Suggestion:** Consider replacing with "under `src/components/<area>/`" only, dropping the "wherever they currently live" hedge. The Phase 5 spec enumerates exact paths regardless.
