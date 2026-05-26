---
artifact: 13-prompt-management (Task 1, Phase 0 audit)
artifact_type: impl
verdict: findings
reviewer_model: claude-opus-4-7[1m]
date: 2026-05-26
round: 1
base_ref: 2293307
spec_loaded: true
plan_loaded: true
---

## Context

Review covers the single-commit range `2293307..ee680b1` (one file added: `docs/prompt-inventory.md`, +112 LOC, no production code change). Spec and plan loaded explicitly per the task brief (no auto-discovery needed). Audit cross-checked against `backend/app/services/*/prompts.py`, `backend/app/services/_llm_helpers.py`, `backend/app/services/graph_chat/prospect_pipeline.py`, `backend/app/services/health.py`, `backend/app/services/market_scoring/orchestrator.py`, and `backend/app/core/llm_config.py`.

## Findings

### [High] "Counts" section arithmetic is internally inconsistent

**Location:** `docs/prompt-inventory.md:47-66` (Counts section)

The numbers don't add up against the row count, and the prose contradicts itself.

1. **`agent-chain = 3`** (line 52) but the parenthetical only names two concrete locations: `P-001` and `P-011`. The third item is "the Groq path of P-002..P-007 / P-013..P-017 collapsed under their custom-dispatch lines" — i.e. *not a separate location*. That makes the true count `agent-chain = 2`.
2. **By-pattern sum check:** with the doc's own stated numbers (3+3+13+4+3 partials) you get **26**, not the "Total locations: 25" the section's first line asserts. With `agent-chain = 2` (the actual count), the sum is `2 + 3 + 13 + 4 + 3 = 25` and matches "Total locations: 25". So the line `simple-invoke = 3` and `custom-dispatch = 13` and `langchain = 4` and `partial = 3` are right; **only `agent-chain` is wrong (should be 2).**
3. **Total-locations breakdown on line 49** says "25 = 22 baseline + 3 audit-surfaced (P-024 + P-025 + the explicit-partial split of signals)". This is muddled:
   - The §2.1 baseline does enumerate "the three `prompts.py` modules: market_research, icp, signals" — meaning **every prompt in signals/prompts.py is implicitly in the baseline**, including the three partials P-008/P-009/P-010. They are not audit-additions.
   - Audit-additions are really just `P-024` (graph_chat) and `P-025` (`_llm_helpers` suffix) — i.e. **2 additions, not 3**. The math then becomes `23 baseline (22 known + 1 from health that the spec already enumerated) + 2 audit = 25`. Or, equivalently, "23 baseline + 2 audit = 25." Either way, treating the signals partial split as a 3rd "addition" double-counts: those rows were already inside the baseline's `signals/prompts.py` bucket.
4. **By-service `_llm_helpers = 1`** (line 64) — labeling `_llm_helpers` as a "service" is a stretch (it's a shared helper module, not a service directory). The Notes column even calls it "shared fragment." Consider either renaming the bucket (`shared = 1 (P-025)`) or footnoting that this is a non-service location.

**Fix:** correct `agent-chain` to 2, restate the total breakdown as "22 baseline + 2 audit-surfaced (P-024 + P-025) + 1 §2.1-but-not-§3.1 (P-023 health) = 25" or similar honest derivation, and reclassify `_llm_helpers` as `shared`. The implementer reading the doc *will* try to reconcile by-pattern == total and waste time when the math fails.

### [Medium] P-025 is double-classified, which conflicts with the stated counting rule

**Location:** `docs/prompt-inventory.md:45,52-55` (P-025 row + Counts pattern lines)

The Counts section explicitly says **"each location counted once by its dominant pattern"** (line 50). But P-025 appears in `custom-dispatch = 13` *and* in `partial`'s parenthetical "+1 fragment (P-025 also fragment-consumed)" (line 55). The row itself (line 45) classifies P-025 as `fragment (consumed by P-002..P-005, P-013..P-017, P-006/P-007 Claude paths)` — i.e. **its own row says it is not custom-dispatch**. So including it in the custom-dispatch=13 list (line 53) contradicts both the counting rule and the row's own classification. P-025 is a fragment template appended into other prompts before dispatch; it is never independently invoked.

**Fix:** remove P-025 from the custom-dispatch enumeration (custom-dispatch becomes 12: P-002..P-007 + P-012 + P-013..P-017). The "+1 fragment" line stays; the totals then become 2 + 3 + 12 + 4 + 3 + 1 = 25 ✓.

### [Medium] "Recommended migration order" introduces an `llm_config/` rename inconsistency

**Location:** `docs/prompt-inventory.md:105` ("**`llm_config/`** — LangChain interop")

The migration order writes step 4 as **`llm_config/`** (with trailing slash, implying a service directory). But `llm_config` is `app/core/llm_config.py` — a single file in `core/`, not a service directory. Spec §3.1's tree puts the prompt files under `backend/prompts/llm_config/`, so a `llm_config/` *prompt* subdirectory is fine, but the migration-order phrasing reads as if there's a service directory by that name. The implementer reading this *might* glance at `backend/app/services/` looking for `llm_config/` and find nothing.

**Fix:** rephrase as "**`app/core/llm_config.py`**" or "**`llm_config` (in `app/core/`)**" to disambiguate from a service directory.

### [Medium] P-025 inline-into-each-prompt recommendation has a coordination gap

**Location:** `docs/prompt-inventory.md:110` (P-025 recommendation under "Recommended migration order")

The recommendation says: "inline into per-prompt templates during Tasks 8/9/10 (the prompt-owning services), and delete `_DEFAULT_CLAUDE_PROMPT_SUFFIX` + the `claude_prompt_suffix_template` parameter from `_research_agent_output()` as part of Task 9 (signals — the last service to touch `_research_agent_output`)."

Two issues:

1. **Task 9 is signals, but the doc says signals is "the last service to touch `_research_agent_output`."** That's wrong: `_research_agent_output` is consumed by icp/llm.py, market_research/llm.py, AND signals/llm.py. Per the migration order in the same doc (lines 102-104), the sequence is icp (Task 8) → signals (Task 9) → market_research (Task 10). So **market_research (Task 10) is the last service to touch `_research_agent_output`**, not signals. Deleting the parameter at Task 9 would break market_research before Task 10 migrates it.
2. **The deletion should happen in Task 10**, not Task 9 — or as a follow-up cleanup at the end of Phase 2. This is a small but real ordering bug that an executor will hit.

**Fix:** change "as part of Task 9 (signals — the last…)" to "as part of Task 10 (market_research — the last service consuming `_research_agent_output`)". Or, more conservatively, "as a cleanup commit after Task 10."

### [Low] P-024 deferral to Task 13 is sound but the recommendation is buried

**Location:** `docs/prompt-inventory.md:68-83` (`call_with_prompt` scope confirmation) and line 108

The Option 1 / Option 2 framing is good, and the recommendation (Option 1: handle P-024 via manual recipe in Task 13) is defensible. But the recommendation is buried inside an 80-line scope-confirmation section, and the migration-order entry at line 108 just says "Migrate via manual recipe per `call_with_prompt` scope confirmation Option 1 above." A Phase 1/2 implementer scanning the migration order has to scroll back up to see what Option 1 actually is.

This isn't wrong, just less skimmable than it could be. Consider a one-line summary in the migration-order entry: "Manual recipe — `prompts.render()` + `llm.invoke([SystemMessage(content=rendered.body), HumanMessage(content=cypher_query_tail)])` + `_prompt_meta_from(rendered)`." Then anyone reading the migration order has the pattern in hand without scrolling.

Not a blocker; readability nit.

### [Low] "Cross-service prompt imports" subsection's claim about `_llm_helpers` is slightly understated

**Location:** `docs/prompt-inventory.md:94`

The line "*the prompt body never crosses service boundaries (only the helper passes the suffix template)*" is true for the *body*, but the `_DEFAULT_CLAUDE_PROMPT_SUFFIX` literal — which the doc itself classifies as a prompt fragment (P-025) — IS a prompt-fragment that crosses service boundaries. It's a default argument that three services (icp/, signals/, market_research/) implicitly inherit when they call `_research_agent_output()`.

The audit then correctly recommends inlining it into per-prompt templates (line 110), which would eliminate this cross-service coupling. But the §"Cross-service prompt imports" subsection minimizes this by phrasing it as "only the helper passes the suffix template" — a Phase 1 reader might miss that this *is* a cross-service prompt dependency that the migration is consciously breaking.

**Fix:** acknowledge in §"Cross-service prompt imports" that P-025 is the one cross-service prompt-fragment dependency, and link forward to the migration-order item that resolves it. One sentence.

### [Low] Boldface emphasis on §2.1-baseline-vs-audit conflates two distinct dimensions

**Location:** `docs/prompt-inventory.md:43-45, 49, 63-64`

The doc uses bold **"Audit-surfaced (not in §2.1 baseline)"** on P-024 and P-025, but P-023 (health.py) is just labeled **"Candidate 'intentionally deferred' per spec §2.1 / plan-13 Task 13 Step 3."** That's fine for P-023 since the spec calls it out. The issue is that the "audit-surfaced" framing implies these prompts were *missed* by the spec — but actually, §2.1's baseline says "Phase 0 may surface more" *and* lists `graph_chat/` as one of the suggested places to look. So P-024 is exactly the kind of thing the spec asked the audit to find — not a surprise. Calling it "audit-surfaced" is technically accurate but understates that the spec deliberately punted this discovery work to Phase 0.

Minor. The audit author could say "**Audit-surfaced** (in `graph_chat/`, which spec §2.1 flagged as a likely-additional service)" to honor the spec's anticipation.

### [Nit] Sweep commands at the top don't quite match what plan-13 Task 1 Step 1 prescribes

**Location:** `docs/prompt-inventory.md:9-13`

The plan's Step 1 says:
```bash
cd backend && rg -n --type py 'llm[0-9]?\.invoke|agent_chain\.invoke|_research_agent_output|_claude_messages_text' app/
```

The doc records the same command but introduces the first ripgrep on lines 10-11 with a multi-line split that the plan's source did not (cosmetic). This is fine. But the doc's sweep commands also imply this was the *full* discovery approach — the prose at line 15 ("Inline f-string call sites were then individually inspected") rescues this with "(no convention to grep)", which is correct. Slightly more explicit attribution of *which* call sites were grep-found vs which were inspection-found would help an auditor reproducing the work, but this is a nit.

### [Nit] Commit message body absent

**Location:** commit `ee680b1c401b6f40f4de8e819f2e42a244da0a7a`

Subject `docs(prompts): add Phase 0 prompt inventory audit` matches CLAUDE.md `type(scope):` convention. ✓ No Claude co-author footer. ✓ Single file changed, atomic. ✓ But the commit has no body — and per CLAUDE.md "Body is optional and author's judgment — include one when the *why* isn't obvious from the diff." For a documentation deliverable that is the audit input for a 12-task migration, a 2-3 line body noting "input for plan-13 Phase 1/2; 25 locations cataloged; surfaces P-024 (graph_chat) and P-025 (_llm_helpers suffix) beyond §2.1 baseline; recommends defer for P-023 (health)" would help future bisect/grep.

Not a blocker. Defensible as-is under "the *why* is obvious from the diff" since the diff is a single inventory file with a clear purpose statement at the top.

## Assessment

**Approved with Minor.**

The deliverable substantively meets all three required Phase 0 outputs (file inventory, call-site classification by §3.5 pattern, `call_with_prompt` scope confirmation). The judgment calls — treating P-008/P-009/P-010 as `partial`, deferring P-024 to Task 13, inlining P-025 into per-prompt templates, and the icp → signals → market_research → llm_config → market_scoring → audit-discovered migration order — are all sound and well-reasoned, not evasive. The cross-service prompt-import verification is correct and useful.

What needs fixing before Phase 1 begins:

1. **High:** the by-pattern counts don't sum to the stated total (Issue 1). Fix `agent-chain = 2`, fix the "22 + 3" breakdown, and either remove P-025 from custom-dispatch or accept the double-count by rewording the counting rule.
2. **Medium:** the Task 9 vs Task 10 ordering bug in the P-025 deletion recommendation (Issue 4). An executor following the doc literally would break market_research at Task 9.
3. **Medium:** P-025 double-classification (Issue 2) and `llm_config/` directory naming (Issue 3).

Lows and Nits are polish, not blockers.

The implementer (same subagent) should fix Issues 1-4 in a follow-up commit (or amend if not yet referenced) before Phase 1 Task 2 lands. Issues 5-8 can be addressed opportunistically.
