# Phase 37 — Wave 0 Confirmations

Date: 2026-06-15. Backend live at `https://brewra-gtm-intelligence.onrender.com` (`/docs` → 200).
Resolution method: authoritative backend source (prompts + Pydantic models) cross-checked with a
cheap live GET. The two slow/data-writing live calls were deliberately not run where source is
authoritative and the task fix is robust to the confirmed shape (see each probe).

## Probe 1 — TD-FE-23 chart-type discriminator → resolved (no escalation)

- **Finding:** `chartType` / `chart_type` appears **nowhere** in `backend/app` or `backend/prompts`
  (grep empty). The card-generating prompt `prompts/market_research/research_market_4.md.j2`
  (the regulatory/compliance "research_market_4" component, the only prompt emitting
  `bar-chart|timeline|percentage`) instructs the LLM to emit the discriminator as **`"type"`**.
  The FE component `ComplianceVisualCard.tsx` already reads `card.type` (9 reads, lines 46–384).
- **Interpretation:** TD-FE-23 is **LLM key-drift**, not a prompt/component mismatch. The prompt
  instructs `type`, but the model (per the register's 2026-06-02 live observation) can emit
  `chartType` instead, in which case `card.type` is undefined and the card silently fails to render.
- **Impact on Task 2:** none — proceed as written. `const chartType = card.type ?? card.chartType`
  renders correctly whether the wire field is `type` (instructed; `card.type` wins), `chartType`
  (drift; falls back), or both. The grep proves there is **no third field name**, so the abort
  trigger ("field is neither chartType nor card.type") is not met. Keep the `??` order
  `card.type ?? card.chartType` so the instructed field wins. The added test documents the
  `chartType`-keyed contract; the change is a harmless hardening even if the LLM currently emits
  `type` (cards already render in that case).
- **Live re-confirm:** available but not blocking (a `POST /market-research_claude` is Claude+Tavily
  backed, slow, and writes a Market-Intelligence Mongo doc needing cleanup; its only new signal —
  which of `type`/`chartType` the LLM emits today — does not change Task 2).

## Probe 2 — TD-FE-42 ICP row keys → resolved (no escalation)

- **Live GET:** `/profile/company?user_id=probe_phase37&org_id=probe_phase37` → 404
  "No company profile found"; `/customer_profile?org_id=probe_phase37` → 404 (expected: fresh
  throwaway org has no data). Endpoints healthy; no rows to read from an empty org. No writes made.
- **Authoritative shape (source):** `app/models/customer_profile.py` + `app/services/customer_profile/orchestrator.py`
  build/store ICP rows in **snake_case**: `company_size: List[str]`, `buyer_role: List[str]`,
  `fit_confidence: Literal["high","medium","low"]`, plus `icp_name`/`name`, `id`, `industry`, etc.
  (the LLM target input uses camel `companySize`, but the **stored** row is snake_case).
- **Impact on Task 13:** none — proceed. `IcpRowSchema` carries snake **and** camel alias pairs
  (`company_size`/`companySize`, `buyer_role`/`buyerRole`, `fit_confidence`/`fitConfidence`,
  `icp_name`/`icpName`/`name`, …) with `.passthrough()`, which matches the confirmed snake_case
  emission and tolerates report-block extras. No divergence beyond what the schema already aliases.

## Already-settled (code, per plan)

- **TD-FE-56** ScoutDeployment home → `frontend/src/shared/agent-config/` (Task 14).
- **TD-FE-25** `localStrategicRecommendations` is purely ephemeral → read-only fallback alignment only (Task 20).
- **TD-FE-73** `/signal-lead-map_claude` confirmed **not deployed** (2026-06-15) → excluded; TD-FE-72 ships dormant.

## Verdict

Both verify-first unknowns resolved without escalation. Tasks 2 and 13 proceed unchanged.
