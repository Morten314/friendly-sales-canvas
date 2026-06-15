# Signal↔Lead Relevance Mapping + Lead Source Labeling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add (1) a read-time, LLM-ranked signal↔lead relevance mapping surfaced on the lead tables and signal cards, and (2) a real `Lead.source` taxonomy (enum + exact-match filter + per-row badge) stamped on every ingest path.

**Architecture:** Cross-stack. Feature #2 (source labeling) ships first and is independent on the market-research LeadsTable (which already renders real data). Feature #1 (mapping) ships second: a new `POST /signal-lead-map_claude` endpoint runs one Claude call over the org's newest-50 signals × ≤100 leads, returns a `mapping[]`, caches it in Mongo keyed by `(org,user)` with an input-set fingerprint, and the FE inverts it into "N relevant signals" / "Affects N leads". Feature #1 also rewires the mock customers/LeadStream to real leads via the existing `GET /api/v2/leads`.

**Tech Stack:** Backend — FastAPI, Pydantic, Neo4j, MongoDB, Anthropic Claude (`claude-sonnet-4-6`) via the raw `/v1/messages` helper, Jinja2 prompt registry, pytest. Frontend — React 18, Vite, TypeScript, TanStack Query, zod, shadcn-ui, vitest + MSW.

**Spec:** `specs/36-signal-lead-mapping-and-source-labeling-design.md` (passed two review rounds).

---

## Conventions for every task

- **Branch:** Do all work on a single branch cut off `master` (e.g. `phase-36-signal-lead-mapping`). One commit per task. Merge back via `--no-ff` after a green `frontend/ npm run preflight` + the touched backend pytest modules.
- **Commits:** `type(scope):` subject (`feat(be):`, `feat(fe):`, `test(be):`). No `[N/M]` suffix. **No `Co-Authored-By` footer.** Stage only the files the task names — `git add <explicit paths>`, never `git add -A`.
- **MVP posture:** no migration, no backfill, no feature flag, no auth/security changes. Legacy null sources normalize at read.
- **Backend tests:** run from `backend/` with the venv python, no `PYTHONPATH`:
  `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/<file>.py -q`
  (in a worktree, symlink `backend/.venv` first). The `tests/unit/conftest.py` autouse fixture initializes the prompt registry, so `prompts.render()` works in unit tests. Follow **patch-where-used** (`backend/TESTING.md`).
- **Frontend tests/checks:** run from `frontend/`:
  - typecheck: `npm run typecheck` (NOT bare `tsc` — the root tsconfig is a no-op stub)
  - one test file: `npx vitest run <path> --no-file-parallelism`
  - prettier on touched files: `npx prettier --check <paths>` (`npm run verify` omits format:check)
  - lint: `npx eslint <paths>`
- **Cross-stack contract rule:** backend first, confirm the live JSON via `/docs`/`curl`, then the FE consumer. No generated client.

---

## File Structure

**Feature #2 — source labeling (backend):**
- Modify `backend/app/services/leads/persistence.py` — `create_lead` stamps `source="manual"`.
- Modify `backend/app/services/leads/orchestrator.py` — `batch_upload_leads` stamps `source="csv"`.
- Modify `backend/app/models/market_scoring.py` — add `LeadMarketScoreRow.source`.
- Modify `backend/app/services/market_scoring/orchestrator.py` — persist `source` in `_persist_market_score_for_lead`.
- Modify `backend/app/services/market_scoring/normalization.py` — read `source` in `_lead_to_score_row`.

**Feature #2 — source labeling (frontend):**
- Rewrite `frontend/src/features/connectors/lib/leadSource.ts` — `LeadSource`, `normalizeLeadSource`, exact-match filter, options.
- Create `frontend/src/features/connectors/components/LeadSourceBadge.tsx`.
- Modify `frontend/src/features/connectors/index.ts` — barrel exports.
- Modify `frontend/src/shared/lib/leadData.ts` — retype `HeatmapLead.source` to `string | null`.
- Modify `frontend/src/features/market-research/lib/marketScoresHeatmap.ts` — add `source` to `MarketScoresApiRow`, preserve real source.
- Modify `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx` — render `LeadSourceBadge`.

**Feature #1 — mapping (backend):**
- Modify `backend/app/models/signals.py` — `SignalLeadMapRequest`.
- Create `backend/prompts/signals/signals_lead_map.md.j2`.
- Create `backend/app/services/signals/lead_map.py` — fingerprint/cache helpers + `build_signal_lead_map_claude`.
- Modify `backend/app/services/signals/__init__.py` — re-export.
- Modify `backend/app/routers/signals.py` — `POST /signal-lead-map_claude`.

**Feature #1 — mapping (frontend):**
- Modify `frontend/src/features/signals/contracts.ts` — `SignalLeadMapResponseSchema`.
- Modify `frontend/src/features/signals/services/signals.ts` — `fetchSignalLeadMap`.
- Modify `frontend/src/shared/api/queryKeys.ts` — `signalLeadMap`, `leads`.
- Create `frontend/src/features/signals/hooks/useSignalLeadMap.ts`.
- Modify `frontend/src/features/signals/index.ts` — export hook.
- Modify `frontend/src/features/signals/components/SignalCard.tsx` + `pages/SignalsPage.tsx` — "Affects N leads".
- Modify `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx` — "N relevant signals".
- Create `frontend/src/features/customers/contracts.ts`, `services/leads.ts`, `hooks/useLeads.ts`.
- Rewrite `frontend/src/features/customers/components/lead-stream/LeadStream.tsx` — real leads + source + signals.
- Modify `frontend/src/features/customers/pages/CustomersPage.tsx` — pass `orgId`.
- Modify `frontend/src/test/msw/handlers.ts` — default handlers for the two new endpoints.

---

# Phase A — Feature #2 backend: stamp `source` on every ingest path

### Task 1: Stamp `source="manual"` on manual lead creation

**Files:**
- Modify: `backend/app/services/leads/persistence.py` (`create_lead`, ~line 67)
- Test: `backend/tests/unit/test_leads.py`

- [ ] **Step 1: Write the failing tests** (append to `backend/tests/unit/test_leads.py`; reuse the existing module imports `create_lead`, `LeadCreateRequest`, and the `TEST_USER_ID` / `TEST_ORG_ID` constants + `mock_session` fixture already used in that file)

```python
def test_create_lead_stamps_source_manual_when_absent(mock_session):
    request = LeadCreateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, data={"company_name": "Acme Co"}
    )
    create_lead(mock_session._driver, request)
    # execute_write(upsert_node, "Lead", "lead_id", lead_id, lead_data) → args[4] is lead_data
    call_data = mock_session.execute_write.call_args.args[4]
    assert call_data["source"] == "manual"


def test_create_lead_respects_explicit_source(mock_session):
    request = LeadCreateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        data={"company_name": "Acme Co", "source": "apollo"},
    )
    create_lead(mock_session._driver, request)
    call_data = mock_session.execute_write.call_args.args[4]
    assert call_data["source"] == "apollo"
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_leads.py -q -k source`
Expected: `test_create_lead_stamps_source_manual_when_absent` FAILS with `KeyError: 'source'`.

- [ ] **Step 3: Implement** — in `create_lead`, immediately after `lead_data = request.data.copy()`:

```python
    lead_data = request.data.copy()
    if "source" not in lead_data:
        lead_data["source"] = "manual"
    lead_data["user_id"] = request.user_id
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_leads.py -q -k source`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/leads/persistence.py backend/tests/unit/test_leads.py
git commit -m "feat(be): stamp source=manual on manual lead creation"
```

---

### Task 2: Stamp `source="csv"` on batch upload

**Files:**
- Modify: `backend/app/services/leads/orchestrator.py` (`batch_upload_leads`, after `lead_data["file_id"] = file_id`)
- Test: `backend/tests/unit/test_leads.py`

- [ ] **Step 1: Write the failing test** (append; reuse `mock_session`, `mock_mongo_client`, `batch_upload_leads`, constants already in the file)

```python
def test_batch_upload_leads_stamps_source_csv(mock_session, mock_mongo_client):
    coll = MagicMock()
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    csv_bytes = b"company_name\nAcme\n"

    batch_upload_leads(
        mock_session._driver, mock_mongo_client, csv_bytes, "leads.csv",
        TEST_USER_ID, TEST_ORG_ID,
    )
    # one row → one execute_write; data dict is the 4th positional arg
    call_data = mock_session.execute_write.call_args_list[0].args[4]
    assert call_data["source"] == "csv"
```

(`MagicMock` is already imported in `test_leads.py`; if not, add `from unittest.mock import MagicMock`.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_leads.py::test_batch_upload_leads_stamps_source_csv -q`
Expected: FAIL with `KeyError: 'source'`.

- [ ] **Step 3: Implement** — in the per-row loop of `batch_upload_leads`, immediately after `lead_data["file_id"] = file_id` (before the stage default / string-coercion):

```python
        lead_data["file_id"] = file_id

        if "source" not in lead_data:
            lead_data["source"] = "csv"
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_leads.py::test_batch_upload_leads_stamps_source_csv -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/leads/orchestrator.py backend/tests/unit/test_leads.py
git commit -m "feat(be): stamp source=csv on batch lead upload"
```

---

### Task 3: Thread `source` onto `LeadMarketScoreRow`

The `POST /leads/market-scores` response is rebuilt from **persisted Mongo score docs**, so `source` must be (1) added to the model, (2) **persisted** by `_persist_market_score_for_lead`, and (3) read back by `_lead_to_score_row`. `get_leads_for_org` already returns `source` from the Neo4j node — no Cypher change.

> **Caveat to record:** existing score docs won't carry `source` until the next scoring run. At MVP (0 users) the first `POST /leads/market-scores` with `refresh=true` re-scores and populates it. No backfill (MVP posture).

**Files:**
- Modify: `backend/app/models/market_scoring.py` (`LeadMarketScoreRow`)
- Modify: `backend/app/services/market_scoring/orchestrator.py` (`_persist_market_score_for_lead`, the `$set` dict)
- Modify: `backend/app/services/market_scoring/normalization.py` (`_lead_to_score_row`)
- Test: `backend/tests/unit/test_market_scoring.py`

- [ ] **Step 1: Write the failing tests** (append to `backend/tests/unit/test_market_scoring.py`; `MagicMock` and the `mock_session` fixture are available there)

```python
def test_lead_to_score_row_maps_source():
    from app.services.market_scoring.normalization import _lead_to_score_row
    doc = {"lead_id": "l1", "org_id": "o1", "source": "apollo",
           "component_scores": {}, "market_total_score": 0}
    assert _lead_to_score_row(doc).source == "apollo"


def test_lead_to_score_row_source_defaults_none():
    from app.services.market_scoring.normalization import _lead_to_score_row
    doc = {"lead_id": "l1", "org_id": "o1", "component_scores": {}, "market_total_score": 0}
    assert _lead_to_score_row(doc).source is None


def test_persist_market_score_writes_source(mock_session):
    from unittest.mock import MagicMock
    from app.services.market_scoring import orchestrator
    score_coll = MagicMock()
    orchestrator._persist_market_score_for_lead(
        mock_session._driver, MagicMock(),
        user_id="u1", org_id="o1",
        lead={"lead_id": "l1", "source": "csv"},
        scoring_payload={"component_scores": {}, "market_total_score": 1.0},
        run_id="r1", scoring_status="completed", score_coll=score_coll,
    )
    set_doc = score_coll.update_one.call_args.args[1]["$set"]
    assert set_doc["source"] == "csv"
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_market_scoring.py -q -k source`
Expected: FAIL (`source` is not a field on `LeadMarketScoreRow` / not in the `$set` dict).

- [ ] **Step 3a: Implement model** — in `backend/app/models/market_scoring.py`, add to `LeadMarketScoreRow` after `file_id`:

```python
    file_id: Optional[str] = None
    source: Optional[str] = None
```

- [ ] **Step 3b: Implement persist** — in `_persist_market_score_for_lead` (`backend/app/services/market_scoring/orchestrator.py`), add `source` to the `$set` dict (it already receives the raw `lead` dict):

```python
                "lead_id": lead_id,
                "file_id": file_id,
                "source": lead.get("source"),
                "company_name": company_name,
```

- [ ] **Step 3c: Implement read** — in `_lead_to_score_row` (`backend/app/services/market_scoring/normalization.py`), add after `file_id`:

```python
        file_id=lead_doc.get("file_id"),
        source=lead_doc.get("source"),
        company_name=lead_doc.get("company_name"),
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_market_scoring.py -q -k source`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/market_scoring.py backend/app/services/market_scoring/orchestrator.py backend/app/services/market_scoring/normalization.py backend/tests/unit/test_market_scoring.py
git commit -m "feat(be): expose lead source on market-score rows"
```

---

# Phase B — Feature #2 frontend: taxonomy, badge, filter

### Task 4: Rewrite `leadSource.ts` (enum + normalize + exact-match)

**Files:**
- Rewrite: `frontend/src/features/connectors/lib/leadSource.ts`
- Rewrite: `frontend/src/features/connectors/lib/__tests__/leadSource.test.ts` (existing test asserts the old catch-all behavior)

- [ ] **Step 1: Replace the test file** with the new contract:

```typescript
import { describe, expect, it } from "vitest";

import { filterLeadsBySource, LEAD_SOURCE_OPTIONS, normalizeLeadSource } from "../leadSource";

describe("normalizeLeadSource", () => {
  it("passes through known tokens (case-insensitive, trimmed)", () => {
    expect(normalizeLeadSource("apollo")).toBe("apollo");
    expect(normalizeLeadSource("CSV")).toBe("csv");
    expect(normalizeLeadSource(" Manual ")).toBe("manual");
  });
  it("maps null/empty/legacy/unrecognized to 'unknown'", () => {
    expect(normalizeLeadSource(null)).toBe("unknown");
    expect(normalizeLeadSource(undefined)).toBe("unknown");
    expect(normalizeLeadSource("")).toBe("unknown");
    expect(normalizeLeadSource("HubSpot")).toBe("unknown");
    expect(normalizeLeadSource("Prospect List")).toBe("unknown");
  });
});

describe("filterLeadsBySource", () => {
  const leads = [
    { id: "1", source: "apollo" },
    { id: "2", source: "csv" },
    { id: "3", source: "manual" },
    { id: "4", source: "HubSpot" },
    { id: "5", source: null },
  ];
  it("returns all for 'all'", () => {
    expect(filterLeadsBySource(leads, "all")).toHaveLength(5);
  });
  it("matches exactly on each live value", () => {
    expect(filterLeadsBySource(leads, "apollo").map((l) => l.id)).toEqual(["1"]);
    expect(filterLeadsBySource(leads, "csv").map((l) => l.id)).toEqual(["2"]);
    expect(filterLeadsBySource(leads, "manual").map((l) => l.id)).toEqual(["3"]);
  });
  it("groups legacy/null sources under 'unknown'", () => {
    expect(filterLeadsBySource(leads, "unknown").map((l) => l.id)).toEqual(["4", "5"]);
  });
  it("exposes the five live options in order", () => {
    expect(LEAD_SOURCE_OPTIONS.map((o) => o.value)).toEqual([
      "all", "apollo", "csv", "manual", "unknown",
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/connectors/lib/__tests__/leadSource.test.ts --no-file-parallelism`
Expected: FAIL (`normalizeLeadSource` does not exist; old options are `["all","csv","apollo"]`).

- [ ] **Step 3: Replace `leadSource.ts` entirely** with:

```typescript
export type LeadSource = "apollo" | "csv" | "manual" | "unknown";
export type LeadSourceFilter = "all" | LeadSource;

export const LEAD_SOURCE_OPTIONS: ReadonlyArray<{ value: LeadSourceFilter; label: string }> = [
  { value: "all", label: "All leads" },
  { value: "apollo", label: "Apollo" },
  { value: "csv", label: "CSV / Excel" },
  { value: "manual", label: "Manual" },
  { value: "unknown", label: "Unknown" },
];

const KNOWN_SOURCES: ReadonlySet<string> = new Set(["apollo", "csv", "manual"]);

/** Normalize a raw lead `source` to the canonical taxonomy. Unrecognized, empty,
 *  null, or legacy values (e.g. "HubSpot", "Prospect List") collapse to "unknown". */
export function normalizeLeadSource(raw: string | null | undefined): LeadSource {
  const v = (raw ?? "").trim().toLowerCase();
  return (KNOWN_SOURCES.has(v) ? v : "unknown") as LeadSource;
}

/** Exact-match filter on a lead's normalized `source`. */
export function filterLeadsBySource<T extends { source?: string | null }>(
  leads: T[],
  filter: LeadSourceFilter,
): T[] {
  if (filter === "all") return leads;
  return leads.filter((l) => normalizeLeadSource(l.source) === filter);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/connectors/lib/__tests__/leadSource.test.ts --no-file-parallelism`
Expected: PASS.

- [ ] **Step 5: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/connectors/lib/leadSource.ts src/features/connectors/lib/__tests__/leadSource.test.ts
git add frontend/src/features/connectors/lib/leadSource.ts frontend/src/features/connectors/lib/__tests__/leadSource.test.ts
git commit -m "feat(fe): promote lead source to a real taxonomy with exact-match filter"
```

---

### Task 5: `LeadSourceBadge` component + barrel exports

**Files:**
- Create: `frontend/src/features/connectors/components/LeadSourceBadge.tsx`
- Create: `frontend/src/features/connectors/components/__tests__/LeadSourceBadge.test.tsx`
- Modify: `frontend/src/features/connectors/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadSourceBadge } from "../LeadSourceBadge";

describe("LeadSourceBadge", () => {
  it("renders the canonical label for a known source", () => {
    render(<LeadSourceBadge source="apollo" />);
    expect(screen.getByText("Apollo")).toBeTruthy();
  });
  it("renders 'Unknown' for legacy/null source", () => {
    render(<LeadSourceBadge source="HubSpot" />);
    expect(screen.getByText("Unknown")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/connectors/components/__tests__/LeadSourceBadge.test.tsx --no-file-parallelism`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `LeadSourceBadge.tsx`** (models the existing `UnverifiedBadge` pattern; intra-feature relative import of `normalizeLeadSource`):

```typescript
import { Badge } from "@/components/ui/badge";

import { normalizeLeadSource } from "../lib/leadSource";

const LABELS: Record<string, string> = {
  apollo: "Apollo",
  csv: "CSV",
  manual: "Manual",
  unknown: "Unknown",
};

const CLASSES: Record<string, string> = {
  apollo: "text-violet-600 border-violet-300",
  csv: "text-sky-600 border-sky-300",
  manual: "text-emerald-600 border-emerald-300",
  unknown: "text-muted-foreground border-muted",
};

/** Per-row badge driven by the real (normalized) lead `source`. */
export function LeadSourceBadge({ source }: { source?: string | null }) {
  const s = normalizeLeadSource(source);
  return (
    <Badge variant="outline" className={`text-[10px] ${CLASSES[s]}`}>
      {LABELS[s]}
    </Badge>
  );
}
```

- [ ] **Step 4: Update the barrel** `frontend/src/features/connectors/index.ts` — replace the `leadSource` re-export line and add the badge:

```typescript
export { ApolloTile } from "./components/ApolloTile";
export { useApolloUnlockToast } from "./hooks/useApolloUnlockToast";
export {
  LEAD_SOURCE_OPTIONS,
  filterLeadsBySource,
  normalizeLeadSource,
  type LeadSource,
  type LeadSourceFilter,
} from "./lib/leadSource";
export { UnverifiedBadge } from "./components/UnverifiedBadge";
export { LeadSourceBadge } from "./components/LeadSourceBadge";
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/connectors/components/__tests__/LeadSourceBadge.test.tsx --no-file-parallelism`
Expected: PASS.

- [ ] **Step 6: Typecheck, format, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx prettier --check src/features/connectors/components/LeadSourceBadge.tsx src/features/connectors/components/__tests__/LeadSourceBadge.test.tsx src/features/connectors/index.ts
git add frontend/src/features/connectors/components/LeadSourceBadge.tsx frontend/src/features/connectors/components/__tests__/LeadSourceBadge.test.tsx frontend/src/features/connectors/index.ts
git commit -m "feat(fe): add LeadSourceBadge and export source helpers from connectors"
```

---

### Task 6: Retype `HeatmapLead.source` + preserve real source in the mapper

**Files:**
- Modify: `frontend/src/shared/lib/leadData.ts` (`HeatmapLead.source`)
- Modify: `frontend/src/features/market-research/lib/marketScoresHeatmap.ts` (`MarketScoresApiRow`, `mapMarketScoresRowToHeatmapLead`)
- Modify: `frontend/src/features/market-research/lib/__tests__/marketScoresHeatmap.test.ts` (existing test asserts the hardcoded `"Prospect List"`)

- [ ] **Step 1: Update the failing test** — in `marketScoresHeatmap.test.ts`, replace the test asserting `source` is `"Prospect List"` with:

```typescript
  it("preserves the real source from the API row", () => {
    expect(mapMarketScoresRowToHeatmapLead({ ...baseRow, source: "apollo" }).source).toBe("apollo");
  });
  it("passes through null when the row carries no source", () => {
    expect(mapMarketScoresRowToHeatmapLead(baseRow).source).toBeNull();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/market-research/lib/__tests__/marketScoresHeatmap.test.ts --no-file-parallelism`
Expected: FAIL (mapper still returns `"Prospect List"`; `MarketScoresApiRow` has no `source`).

- [ ] **Step 3a: Retype `HeatmapLead.source`** in `frontend/src/shared/lib/leadData.ts`:

```typescript
  company: string;
  source: string | null;
  ratings: Record<string, Rating>;
```

(The 40 sample rows' `"HubSpot" as const` / `"Prospect List" as const` literals remain valid as `string`.)

- [ ] **Step 3b: Add `source` to `MarketScoresApiRow`** in `marketScoresHeatmap.ts`:

```typescript
  file_id?: string;
  source?: string | null;
  company_name: string;
```

- [ ] **Step 3c: Preserve real source** — in `mapMarketScoresRowToHeatmapLead`, replace the hardcoded line:

```typescript
    source: row.source ?? null,
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/market-research/lib/__tests__/marketScoresHeatmap.test.ts --no-file-parallelism`
Expected: PASS.

- [ ] **Step 5: Typecheck (widening `source` may surface a consumer that switched on the old union — fix any), format, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx prettier --check src/shared/lib/leadData.ts src/features/market-research/lib/marketScoresHeatmap.ts src/features/market-research/lib/__tests__/marketScoresHeatmap.test.ts
git add frontend/src/shared/lib/leadData.ts frontend/src/features/market-research/lib/marketScoresHeatmap.ts frontend/src/features/market-research/lib/__tests__/marketScoresHeatmap.test.ts
git commit -m "feat(fe): carry real lead source through the market-scores heatmap mapper"
```

---

### Task 7: Render `LeadSourceBadge` on LeadsTable rows

The source filter dropdown already maps `LEAD_SOURCE_OPTIONS` and calls `filterLeadsBySource` — both updated in Task 4, so the dropdown now shows the five live values automatically. This task only adds the per-row badge. It is a presentational wiring change verified by typecheck/build (the unit — `LeadSourceBadge` — is tested in Task 5; the filter in Task 4). No new LeadsTable render test (the component's market-scores fetch + async org resolution make a full render harness disproportionate; the repo's gate posture is advisory).

**Files:**
- Modify: `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx`

- [ ] **Step 1: Add the import** — extend the existing `@/features/connectors` import to include `LeadSourceBadge`:

```typescript
import { LEAD_SOURCE_OPTIONS, LeadSourceBadge, filterLeadsBySource, type LeadSourceFilter } from "@/features/connectors";
```

- [ ] **Step 2: Render the badge** — in the lead-name cell, next to `<UnverifiedBadge emailStatus={lead.email_status} />` (~line 743):

```tsx
          {lead.name}
          <LeadSourceBadge source={lead.source} />
          <UnverifiedBadge emailStatus={lead.email_status} />
```

- [ ] **Step 3: Typecheck + lint + build**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx eslint src/features/market-research/components/lead-stream/LeadsTable.tsx && npm run build`
Expected: PASS (no type/lint errors; build succeeds).

- [ ] **Step 4: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/market-research/components/lead-stream/LeadsTable.tsx
git add frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx
git commit -m "feat(fe): show lead source badge on market-research LeadsTable rows"
```

**Phase B complete:** Feature #2 is fully live on the market-research LeadsTable (real badge + exact-match filter). On customers/LeadStream the badge/filter stay inert (everything reads `unknown`) until Task 17 rewires it — an accepted ordering artifact per the spec.

---

# Phase C — Feature #1 backend: the mapping endpoint

### Task 8: `SignalLeadMapRequest` model + `signals_lead_map` prompt

**Files:**
- Modify: `backend/app/models/signals.py` (add `SignalLeadMapRequest`)
- Create: `backend/prompts/signals/signals_lead_map.md.j2`
- Test: `backend/tests/unit/test_signal_lead_map.py` (new file)

- [ ] **Step 1: Write the failing tests** (new file `backend/tests/unit/test_signal_lead_map.py`)

```python
def test_signal_lead_map_request_defaults_refresh_false():
    from app.models.signals import SignalLeadMapRequest
    req = SignalLeadMapRequest(user_id="u1", org_id="o1")
    assert req.refresh is False


def test_signals_lead_map_prompt_renders():
    # unit conftest autouse fixture has already called init_registry()
    from app.core import prompts
    rendered = prompts.render(
        "signals_lead_map",
        signals_json="[]",
        leads_json="[]",
        context_json="{}",
    )
    assert rendered.body
    assert "relevance" in rendered.body.lower()
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_signal_lead_map.py -q`
Expected: FAIL (`SignalLeadMapRequest` undefined; prompt `signals_lead_map` not in registry).

- [ ] **Step 3a: Add the model** to `backend/app/models/signals.py` (sibling of `SignalActionRequest`):

```python
class SignalLeadMapRequest(BaseModel):
    user_id: str
    org_id: str
    refresh: bool = False
```

- [ ] **Step 3b: Create the prompt** `backend/prompts/signals/signals_lead_map.md.j2`. The frontmatter `name` must equal the filename stem; `inputs` must list exactly the three render inputs. The `model` mirrors the sibling signals prompts (metadata only — the call goes through the Claude primitive regardless):

```jinja
---
name: signals_lead_map
version: 1.0.0
description: Read-time relevance mapping between an org's signals and its leads (Claude). Output is strict JSON, no prose.
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: json
inputs:
  - signals_json
  - leads_json
  - context_json
---
Task: You are given an organization's recent market SIGNALS and its active LEADS. For each signal, decide which leads it is genuinely relevant to and how strongly.

Company / ICP context (for grounding):
{{ context_json }}

SIGNALS (JSON array; each has signal_id + headline):
{{ signals_json }}

LEADS (JSON array; each has lead_id + company + industry + region):
{{ leads_json }}

MATCHING RULES:
- A signal is relevant to a lead when it plausibly affects that lead's company — match on company name, industry, region, technology, or an explicit company mention in the signal.
- Assign each matched lead a relevance of "high", "medium", or "low".
- Give a one-line `why` (max ~20 words) grounded in the signal and the lead.
- Only use signal_id values from the SIGNALS array and lead_id values from the LEADS array. Never invent ids.
- A signal with no relevant leads MUST still appear with an empty "leads" array.

OUTPUT — return ONLY this JSON object, no commentary:
{
  "mapping": [
    {
      "signal_id": "<from SIGNALS>",
      "leads": [
        { "lead_id": "<from LEADS>", "company": "<company>", "relevance": "high|medium|low", "why": "<one line>" }
      ]
    }
  ]
}
{% include '_shared/final_answer_json_directive.md.j2' %}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_signal_lead_map.py -q`
Expected: PASS. (If the registry raises `front-matter name != filename stem`, the `name:` value must be exactly `signals_lead_map`.)

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/signals.py backend/prompts/signals/signals_lead_map.md.j2 backend/tests/unit/test_signal_lead_map.py
git commit -m "feat(be): add SignalLeadMapRequest model and signals_lead_map prompt"
```

---

### Task 9: Fingerprint + cache helpers in `lead_map.py`

**Files:**
- Create: `backend/app/services/signals/lead_map.py` (helpers only this task)
- Test: `backend/tests/unit/test_signal_lead_map.py`

- [ ] **Step 1: Write the failing tests** (append)

```python
def test_compute_fingerprint_is_order_independent():
    from app.services.signals.lead_map import _compute_fingerprint
    assert _compute_fingerprint(["s1", "s2"], ["l1", "l2"]) == _compute_fingerprint(
        ["s2", "s1"], ["l2", "l1"]
    )


def test_compute_fingerprint_changes_with_set():
    from app.services.signals.lead_map import _compute_fingerprint
    assert _compute_fingerprint(["s1"], ["l1"]) != _compute_fingerprint(["s1", "s2"], ["l1"])


def test_signal_and_lead_id_extraction():
    from app.services.signals.lead_map import _signal_ids, _lead_ids
    assert _signal_ids([{"signal_id": "s1"}, {"id": "s2"}, {"headline": "x"}]) == ["s1", "s2"]
    assert _lead_ids([{"lead_id": "l1"}, {"company": "x"}]) == ["l1"]


def test_save_and_get_cached_lead_map_roundtrip():
    from unittest.mock import MagicMock
    from app.services.signals import lead_map
    store = {}
    coll = MagicMock()
    coll.find_one.side_effect = lambda flt: store.get(flt["_id"])
    coll.update_one.side_effect = lambda flt, upd, upsert=False: store.update(
        {flt["_id"]: {"_id": flt["_id"], **upd["$set"]}}
    )
    mongo = MagicMock()
    mongo.__getitem__.return_value.__getitem__.return_value = coll

    lead_map._save_lead_map(mongo, "o1", "u1", [{"signal_id": "s1", "leads": []}], "fp", "t0")
    doc = lead_map._get_cached_lead_map(mongo, "o1", "u1")
    assert doc["fingerprint"] == "fp"
    assert doc["mapping"] == [{"signal_id": "s1", "leads": []}]
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_signal_lead_map.py -q -k "fingerprint or extraction or roundtrip"`
Expected: FAIL (module `lead_map` does not exist yet).

- [ ] **Step 3: Create `backend/app/services/signals/lead_map.py`** with the helpers:

```python
"""Read-time signal↔lead relevance mapping (Claude). See specs/36.

Disposable derived cache in Signals.signal_lead_map, keyed per (org, user).
No signal-schema change; no persisted hard link.
"""

import hashlib
from typing import Any, Dict, List, Optional

_CACHE_DB = "Signals"
_CACHE_COLL = "signal_lead_map"


def _signal_ids(signals: List[Dict[str, Any]]) -> List[str]:
    out: List[str] = []
    for s in signals:
        sid = s.get("signal_id") or s.get("id")
        if sid:
            out.append(str(sid))
    return out


def _lead_ids(leads: List[Dict[str, Any]]) -> List[str]:
    return [str(l.get("lead_id")) for l in leads if l.get("lead_id")]


def _compute_fingerprint(signal_ids: List[str], lead_ids: List[str]) -> str:
    payload = ",".join(sorted(signal_ids)) + "|" + ",".join(sorted(lead_ids))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _cache_key(org_id: str, user_id: str) -> str:
    return f"{org_id}:{user_id}"


def _get_cached_lead_map(mongo, org_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    return mongo[_CACHE_DB][_CACHE_COLL].find_one({"_id": _cache_key(org_id, user_id)})


def _save_lead_map(
    mongo, org_id: str, user_id: str,
    mapping: List[Dict[str, Any]], fingerprint: str, generated_at: str,
) -> None:
    mongo[_CACHE_DB][_CACHE_COLL].update_one(
        {"_id": _cache_key(org_id, user_id)},
        {"$set": {"mapping": mapping, "fingerprint": fingerprint, "generated_at": generated_at}},
        upsert=True,
    )
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_signal_lead_map.py -q -k "fingerprint or extraction or roundtrip"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/signals/lead_map.py backend/tests/unit/test_signal_lead_map.py
git commit -m "feat(be): add fingerprint and derived-cache helpers for signal-lead map"
```

---

### Task 10: `build_signal_lead_map_claude` orchestration + JSON parse

**Files:**
- Modify: `backend/app/services/signals/lead_map.py` (add parse helpers + the async service)
- Test: `backend/tests/unit/test_signal_lead_map.py`

- [ ] **Step 1: Write the failing tests** (append; these use `asyncio.run` so no `pytest-asyncio` config is needed)

```python
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.signals import SignalLeadMapRequest


def _fake_cache_mongo(initial=None):
    store = dict(initial or {})
    coll = MagicMock()
    coll.find_one.side_effect = lambda flt: store.get(flt["_id"])
    coll.update_one.side_effect = lambda flt, upd, upsert=False: store.update(
        {flt["_id"]: {"_id": flt["_id"], **upd["$set"]}}
    )
    mongo = MagicMock()
    mongo.__getitem__.return_value.__getitem__.return_value = coll
    return mongo, store


def _run(signals, leads, claude_return, *, mongo=None, refresh=False):
    from app.services.signals import lead_map
    mongo = mongo or _fake_cache_mongo()[0]
    driver = MagicMock()
    req = SignalLeadMapRequest(user_id="u1", org_id="o1", refresh=refresh)
    with patch("app.services.signals.persistence.fetch_signals",
               new=AsyncMock(return_value=(signals, len(signals)))), \
         patch("app.services.leads.persistence.get_leads_for_org",
               return_value=(leads, len(leads))), \
         patch("app.services.signals.persistence._get_signal_ask_customer_profile",
               return_value={"icps": []}), \
         patch("app.services._llm_helpers._claude_messages_text") as claude:
        if isinstance(claude_return, Exception):
            claude.side_effect = claude_return
        else:
            claude.return_value = claude_return
        result = asyncio.run(lead_map.build_signal_lead_map_claude(driver, mongo, req))
        return result, claude


def test_build_map_empty_signals_short_circuits():
    result, claude = _run([], [{"lead_id": "l1"}], "")
    assert result["data"]["mapping"] == []
    claude.assert_not_called()


def test_build_map_empty_leads_short_circuits():
    result, claude = _run([{"signal_id": "s1"}], [], "")
    assert result["data"]["mapping"] == []
    claude.assert_not_called()


def test_build_map_cache_miss_computes_and_writes():
    signals = [{"signal_id": "s1", "headline": "Hiring surge"}]
    leads = [{"lead_id": "l1", "company_name": "Acme"}]
    claude_json = (
        '{"mapping":[{"signal_id":"s1","leads":'
        '[{"lead_id":"l1","company":"Acme","relevance":"high","why":"match"}]}]}'
    )
    mongo, store = _fake_cache_mongo()
    result, claude = _run(signals, leads, claude_json, mongo=mongo)
    entry = result["data"]["mapping"][0]
    assert result["data"]["cached"] is False
    assert entry["signal_id"] == "s1"
    assert entry["headline"] == "Hiring surge"          # echoed from fetched signals
    assert entry["leads"][0]["lead_id"] == "l1"
    assert entry["leads"][0]["relevance"] == "high"
    assert "o1:u1" in store                              # cache written
    claude.assert_called_once()


def test_build_map_cache_hit_skips_claude():
    from app.services.signals import lead_map
    signals = [{"signal_id": "s1", "headline": "h"}]
    leads = [{"lead_id": "l1"}]
    fp = lead_map._compute_fingerprint(["s1"], ["l1"])
    mongo, _ = _fake_cache_mongo({
        "o1:u1": {"_id": "o1:u1", "fingerprint": fp, "generated_at": "t0",
                  "mapping": [{"signal_id": "s1", "headline": "cached", "leads": []}]}
    })
    result, claude = _run(signals, leads, "SHOULD-NOT-RUN", mongo=mongo)
    assert result["data"]["cached"] is True
    assert result["data"]["mapping"][0]["headline"] == "cached"
    claude.assert_not_called()


def test_build_map_refresh_forces_recompute():
    from app.services.signals import lead_map
    signals = [{"signal_id": "s1", "headline": "h"}]
    leads = [{"lead_id": "l1"}]
    fp = lead_map._compute_fingerprint(["s1"], ["l1"])
    mongo, _ = _fake_cache_mongo({
        "o1:u1": {"_id": "o1:u1", "fingerprint": fp, "generated_at": "t0",
                  "mapping": [{"signal_id": "s1", "headline": "cached", "leads": []}]}
    })
    fresh = '{"mapping":[{"signal_id":"s1","leads":[]}]}'
    result, claude = _run(signals, leads, fresh, mongo=mongo, refresh=True)
    assert result["data"]["cached"] is False
    claude.assert_called_once()


def test_build_map_drops_invented_ids():
    signals = [{"signal_id": "s1"}]
    leads = [{"lead_id": "l1"}]
    claude_json = (
        '{"mapping":[{"signal_id":"sX","leads":[]},'
        '{"signal_id":"s1","leads":[{"lead_id":"lX","relevance":"high","why":"x"},'
        '{"lead_id":"l1","relevance":"low","why":"y"}]}]}'
    )
    result, _ = _run(signals, leads, claude_json)
    mapping = result["data"]["mapping"]
    assert [e["signal_id"] for e in mapping] == ["s1"]          # sX dropped
    assert [l["lead_id"] for l in mapping[0]["leads"]] == ["l1"]  # lX dropped


def test_build_map_tolerates_truncated_json():
    signals = [{"signal_id": "s1"}, {"signal_id": "s2"}]
    leads = [{"lead_id": "l1"}, {"lead_id": "l2"}]
    truncated = (
        '{"mapping":[{"signal_id":"s1","leads":'
        '[{"lead_id":"l1","company":"A","relevance":"high","why":"x"}]},'
        '{"signal_id":"s2","leads":[{"lead_id":"l2","compa'  # cut off mid-token
    )
    result, _ = _run(signals, leads, truncated)
    assert [e["signal_id"] for e in result["data"]["mapping"]] == ["s1"]  # valid prefix kept


def test_build_map_degrades_to_empty_on_claude_failure():
    result, _ = _run([{"signal_id": "s1"}], [{"lead_id": "l1"}], RuntimeError("boom"))
    assert result["status"] == "success"
    assert result["data"]["mapping"] == []
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_signal_lead_map.py -q -k build_map`
Expected: FAIL (`build_signal_lead_map_claude` not defined).

- [ ] **Step 3: Append the parse helpers + service** to `backend/app/services/signals/lead_map.py`:

```python
import asyncio
import json
import re
from datetime import datetime, timezone

from app.core import prompts
from app.core.logging import logger
from app.services import _llm_helpers
from app.services.signals import persistence
from app.services.leads import persistence as leads_persistence

_MAX_SIGNALS = 50
_MAX_LEADS = 100
_MAX_RETRIES = 2
_RELEVANCE = {"high", "medium", "low"}


def _build_result(mapping: List[Dict[str, Any]], generated_at: str, cached: bool) -> Dict[str, Any]:
    return {"status": "success", "data": {"mapping": mapping, "generated_at": generated_at, "cached": cached}}


def _signals_for_prompt(signals: List[Dict[str, Any]]) -> str:
    rows = [{"signal_id": str(s.get("signal_id") or s.get("id")), "headline": s.get("headline", "")}
            for s in signals if (s.get("signal_id") or s.get("id"))]
    return json.dumps(rows, default=str)


def _leads_for_prompt(leads: List[Dict[str, Any]]) -> str:
    rows = []
    for l in leads:
        if not l.get("lead_id"):
            continue
        rows.append({
            "lead_id": str(l.get("lead_id")),
            "company": l.get("company_name") or l.get("company") or "",
            "industry": l.get("industry", ""),
            "region": l.get("region", ""),
        })
    return json.dumps(rows, default=str)


def _recover_mapping_entries(raw: str) -> List[Dict[str, Any]]:
    """Best-effort recovery of a structurally-truncated mapping[] — decode whole
    objects from the array prefix and stop at the first incomplete one."""
    m = re.search(r'"mapping"\s*:\s*\[', raw)
    if not m:
        return []
    decoder = json.JSONDecoder()
    idx = m.end()
    entries: List[Dict[str, Any]] = []
    while idx < len(raw):
        while idx < len(raw) and raw[idx] in " \t\r\n,":
            idx += 1
        if idx >= len(raw) or raw[idx] == "]":
            break
        try:
            obj, end = decoder.raw_decode(raw, idx)
        except ValueError:
            break  # truncated tail
        if isinstance(obj, dict):
            entries.append(obj)
        idx = end
    return entries


def _parse_mapping(
    raw: str, signals: List[Dict[str, Any]],
    valid_signal_ids: List[str], valid_lead_ids: List[str],
) -> List[Dict[str, Any]]:
    sig_set = set(valid_signal_ids)
    lead_set = set(valid_lead_ids)
    headline_by_id = {str(s.get("signal_id") or s.get("id")): s.get("headline", "") for s in signals}
    try:
        parsed = _llm_helpers._extract_research_json(
            raw, escape_keys=("why",), trim_braces=True, strip_final_answer=True
        )
        raw_mapping = parsed.get("mapping", []) if isinstance(parsed, dict) else []
    except Exception:
        raw_mapping = _recover_mapping_entries(raw)  # truncated-prefix tolerance

    out: List[Dict[str, Any]] = []
    for entry in raw_mapping:
        if not isinstance(entry, dict):
            continue
        sid = str(entry.get("signal_id", ""))
        if sid not in sig_set:
            continue  # drop invented signal ids
        leads_out = []
        for lead in entry.get("leads", []) or []:
            if not isinstance(lead, dict):
                continue
            lid = str(lead.get("lead_id", ""))
            if lid not in lead_set:
                continue  # drop invented lead ids
            rel = str(lead.get("relevance", "")).lower()
            if rel not in _RELEVANCE:
                rel = "low"
            leads_out.append({
                "lead_id": lid,
                "company": str(lead.get("company", "")),
                "relevance": rel,
                "why": str(lead.get("why", "")),
            })
        out.append({"signal_id": sid, "headline": headline_by_id.get(sid, ""), "leads": leads_out})
    return out


async def build_signal_lead_map_claude(driver, mongo, request) -> Dict[str, Any]:
    """One Claude call over (newest-50 signals × ≤100 leads) → mapping[]; cached
    per (org, user) by an input-set fingerprint. Never raises to a 500: a Claude
    failure degrades to an empty mapping (the router handles the missing-key 500)."""
    now = datetime.now(timezone.utc).isoformat()

    # 1. signals (user-scoped feed read; async)
    signals, _ = await persistence.fetch_signals(mongo, request.user_id, limit=_MAX_SIGNALS, offset=0)
    if not signals:
        return _build_result([], now, False)

    # 2. leads (org-scoped; sync → thread)
    leads, _ = await asyncio.to_thread(
        leads_persistence.get_leads_for_org, driver, request.org_id, _MAX_LEADS, 0
    )
    if not leads:
        return _build_result([], now, False)

    # 3. fingerprint + cache check (a hit still pays the two fetches above)
    sig_ids = _signal_ids(signals)
    ld_ids = _lead_ids(leads)
    fingerprint = _compute_fingerprint(sig_ids, ld_ids)
    if not request.refresh:
        cached = await asyncio.to_thread(_get_cached_lead_map, mongo, request.org_id, request.user_id)
        if cached and cached.get("fingerprint") == fingerprint:
            return _build_result(cached.get("mapping", []), cached.get("generated_at", now), True)

    # 4. context (ICP/company profile grounding)
    context = await asyncio.to_thread(
        persistence._get_signal_ask_customer_profile, mongo, request.org_id
    ) or {}

    # 5. render + 6. one Claude call (retries=2) + parse
    rendered = prompts.render(
        "signals_lead_map",
        signals_json=_signals_for_prompt(signals),
        leads_json=_leads_for_prompt(leads),
        context_json=json.dumps(context, default=str),
    )
    mapping: List[Dict[str, Any]] = []
    last_err: Optional[Exception] = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            raw = await asyncio.to_thread(
                _llm_helpers._claude_messages_text, rendered.body, _llm_helpers.CLAUDE_RESEARCH_MAX_TOKENS
            )
            mapping = _parse_mapping(raw, signals, sig_ids, ld_ids)
            last_err = None
            break
        except Exception as e:  # degrade, never surface a 500
            last_err = e
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(1)
    if last_err is not None:
        logger.warning("signal_lead_map: claude failed after retries, empty mapping: %s", last_err)
        return _build_result([], now, False)

    # 7. cache write (log + swallow on failure)
    try:
        await asyncio.to_thread(
            _save_lead_map, mongo, request.org_id, request.user_id, mapping, fingerprint, now
        )
    except Exception as e:
        logger.warning("signal_lead_map: cache write failed: %s", e)

    return _build_result(mapping, now, False)
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/unit/test_signal_lead_map.py -q`
Expected: PASS (the failure test takes ~1s for its single retry sleep).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/signals/lead_map.py backend/tests/unit/test_signal_lead_map.py
git commit -m "feat(be): build_signal_lead_map_claude — one-call signal-lead mapping with cache"
```

---

### Task 11: Router endpoint + service re-export

**Files:**
- Modify: `backend/app/services/signals/__init__.py` (re-export)
- Modify: `backend/app/routers/signals.py` (`POST /signal-lead-map_claude`)
- Test: `backend/tests/test_signals.py` (the TestClient integration suite with the `client` fixture)

- [ ] **Step 1: Write the failing tests** (append to `backend/tests/test_signals.py`)

```python
def test_signal_lead_map_endpoint_returns_mapping(client):
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.main import app
    from app.core.dependencies import get_mongo, get_neo4j_driver

    fake = {"status": "success", "data": {
        "mapping": [{"signal_id": "s1", "headline": "h", "leads": []}],
        "generated_at": "t", "cached": False}}
    app.dependency_overrides[get_mongo] = lambda: MagicMock()
    app.dependency_overrides[get_neo4j_driver] = lambda: MagicMock()
    try:
        with patch("app.services._claude_budget.CLAUDE_API_KEY", "test-key"), \
             patch("app.services.signals.build_signal_lead_map_claude",
                   new_callable=AsyncMock, return_value=fake) as m:
            resp = client.post("/signal-lead-map_claude", json={"user_id": "u1", "org_id": "o1"})
    finally:
        app.dependency_overrides.pop(get_mongo, None)
        app.dependency_overrides.pop(get_neo4j_driver, None)
    assert resp.status_code == 200
    assert resp.json()["data"]["mapping"][0]["signal_id"] == "s1"
    m.assert_awaited_once()


def test_signal_lead_map_endpoint_missing_key_500(client):
    from unittest.mock import MagicMock, patch
    from app.main import app
    from app.core.dependencies import get_mongo, get_neo4j_driver

    app.dependency_overrides[get_mongo] = lambda: MagicMock()
    app.dependency_overrides[get_neo4j_driver] = lambda: MagicMock()
    try:
        with patch("app.services._claude_budget.CLAUDE_API_KEY", ""):
            resp = client.post("/signal-lead-map_claude", json={"user_id": "u1", "org_id": "o1"})
    finally:
        app.dependency_overrides.pop(get_mongo, None)
        app.dependency_overrides.pop(get_neo4j_driver, None)
    assert resp.status_code == 500
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/test_signals.py -q -k signal_lead_map`
Expected: FAIL (404 — route not registered).

- [ ] **Step 3a: Re-export the service** — in `backend/app/services/signals/__init__.py`, add to the imports and `__all__`:

```python
from app.services.signals.lead_map import build_signal_lead_map_claude
```

```python
    "build_signal_lead_map_claude",
```

- [ ] **Step 3b: Add the model import** — in `backend/app/routers/signals.py`, add `SignalLeadMapRequest` to the existing `from app.models.signals import (...)` block.

- [ ] **Step 3c: Add the endpoint** to `backend/app/routers/signals.py` (mirrors `generate_signals_batch_claude`'s router-level key check; uses only driver + mongo):

```python
@router.post("/signal-lead-map_claude")
async def signal_lead_map_claude(
    request: SignalLeadMapRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    """Read-time signal↔lead relevance mapping (Claude). One call over the org's
    newest-50 signals × leads, cached per (org, user)."""
    from app.services._claude_budget import CLAUDE_API_KEY
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return await signals_service.build_signal_lead_map_claude(driver, mongo, request)
```

(`get_neo4j_driver` / `get_mongo` are already imported in this router; `HTTPException` too.)

- [ ] **Step 4: Run to verify they pass**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && .venv/bin/python -m pytest tests/test_signals.py -q -k signal_lead_map`
Expected: PASS.

- [ ] **Step 5: Confirm the live shape** (cross-stack rule, before any FE work) — start/locate a backend with `ANTHROPIC_API_KEY` set and `curl` it, or inspect `/docs`, to confirm the envelope is `{"status","data":{"mapping":[…],"generated_at","cached"}}`. Record the captured JSON for the FE zod contract (Task 12).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/signals/__init__.py backend/app/routers/signals.py backend/tests/test_signals.py
git commit -m "feat(be): add POST /signal-lead-map_claude endpoint"
```

---

# Phase D — Feature #1 frontend: contract, hook, signal + LeadsTable surfaces

### Task 12: Contract + service + queryKeys + MSW default handler

**Files:**
- Modify: `frontend/src/features/signals/contracts.ts`
- Modify: `frontend/src/features/signals/services/signals.ts`
- Modify: `frontend/src/shared/api/queryKeys.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/features/signals/__tests__/contracts.test.ts` (new)

- [ ] **Step 1: Write the failing contract test** (new file `frontend/src/features/signals/__tests__/contracts.test.ts`)

```typescript
import { describe, expect, it } from "vitest";

import { SignalLeadMapResponseSchema } from "../contracts";

describe("SignalLeadMapResponseSchema", () => {
  it("parses a representative payload and defaults missing fields", () => {
    const parsed = SignalLeadMapResponseSchema.parse({
      status: "success",
      data: {
        mapping: [
          { signal_id: "s1", headline: "h", leads: [{ lead_id: "l1", relevance: "high", why: "x" }] },
          { signal_id: "s2" },
        ],
      },
    });
    expect(parsed.data.mapping[0].leads[0].company).toBe(""); // default
    expect(parsed.data.mapping[1].leads).toEqual([]); // default
  });

  it("coerces an unexpected relevance to 'low'", () => {
    const parsed = SignalLeadMapResponseSchema.parse({
      data: { mapping: [{ signal_id: "s1", leads: [{ lead_id: "l1", relevance: "weird", why: "" }] }] },
    });
    expect(parsed.data.mapping[0].leads[0].relevance).toBe("low");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/signals/__tests__/contracts.test.ts --no-file-parallelism`
Expected: FAIL (schema not exported).

- [ ] **Step 3a: Add the contract** to `frontend/src/features/signals/contracts.ts` (strict on the fields we read, `.passthrough()` on extras):

```typescript
export const SignalLeadMapLeadSchema = z
  .object({
    lead_id: z.string(),
    company: z.string().optional().default(""),
    relevance: z.enum(["high", "medium", "low"]).catch("low"),
    why: z.string().optional().default(""),
  })
  .passthrough();

export const SignalLeadMapEntrySchema = z
  .object({
    signal_id: z.string(),
    headline: z.string().optional().default(""),
    leads: z.array(SignalLeadMapLeadSchema).default([]),
  })
  .passthrough();

export const SignalLeadMapResponseSchema = z
  .object({
    data: z
      .object({
        mapping: z.array(SignalLeadMapEntrySchema).default([]),
        generated_at: z.string().optional(),
        cached: z.boolean().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type SignalLeadMapEntry = z.infer<typeof SignalLeadMapEntrySchema>;
export type SignalLeadMapLead = z.infer<typeof SignalLeadMapLeadSchema>;
export type SignalLeadMapResponse = z.infer<typeof SignalLeadMapResponseSchema>;
```

(`z` is already imported at the top of `contracts.ts`.)

- [ ] **Step 3b: Add the service** to `frontend/src/features/signals/services/signals.ts` (extend the contract import, add the function):

```typescript
import {
  GenerateSignalsBatchResponseSchema,
  SignalLeadMapResponseSchema,
  type FetchSignalsResponse,
  type GenerateSignalsBatchResponse,
  type SignalLeadMapResponse,
} from "../contracts";

import { apiGet, apiPost } from "@/shared/api/client";
```

```typescript
/**
 * POST /api/signal-lead-map_claude — one read-time mapping over the org's
 * newest-50 signals × leads. `refresh` forces a recompute past the cache.
 */
export async function fetchSignalLeadMap(
  userId: string,
  orgId: string,
  opts: { refresh?: boolean } = {},
): Promise<SignalLeadMapResponse> {
  return apiPost(
    "signal-lead-map_claude",
    { user_id: userId, org_id: orgId, refresh: opts.refresh ?? false },
    SignalLeadMapResponseSchema,
  );
}
```

- [ ] **Step 3c: Add the query keys** to `frontend/src/shared/api/queryKeys.ts` (inside the `qk` object):

```typescript
  signalLeadMap: (orgId: string, userId: string) =>
    ["signals", "lead-map", orgId, userId] as const,
  leads: (orgId: string) => ["leads", orgId] as const,
```

- [ ] **Step 3d: Add a default MSW handler** to `frontend/src/test/msw/handlers.ts` (in the signals section, so any test rendering the hook gets a benign default):

```typescript
http.post("/api/signal-lead-map_claude", () =>
  HttpResponse.json({ status: "success", data: { mapping: [], generated_at: "t", cached: false } }),
),
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/signals/__tests__/contracts.test.ts --no-file-parallelism`
Expected: PASS.

- [ ] **Step 5: Typecheck, format, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx prettier --check src/features/signals/contracts.ts src/features/signals/services/signals.ts src/shared/api/queryKeys.ts src/test/msw/handlers.ts src/features/signals/__tests__/contracts.test.ts
git add frontend/src/features/signals/contracts.ts frontend/src/features/signals/services/signals.ts frontend/src/shared/api/queryKeys.ts frontend/src/test/msw/handlers.ts frontend/src/features/signals/__tests__/contracts.test.ts
git commit -m "feat(fe): add signal-lead-map contract, service, and query keys"
```

---

### Task 13: `useSignalLeadMap` hook + barrel export

**Files:**
- Create: `frontend/src/features/signals/hooks/useSignalLeadMap.ts`
- Create: `frontend/src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx`
- Modify: `frontend/src/features/signals/index.ts`

- [ ] **Step 1: Write the failing test** (mock `@/shared/auth/AuthContext` directly — a plain mock, never the barrel, per the repo's Firebase-teardown gotcha)

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useSignalLeadMap } from "../useSignalLeadMap";

import { server } from "@/test/msw/server";

vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" } }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const RESPONSE = {
  status: "success",
  data: {
    mapping: [
      { signal_id: "s1", headline: "Hiring surge", leads: [{ lead_id: "l1", company: "Acme", relevance: "high", why: "match" }] },
      { signal_id: "s2", headline: "Funding", leads: [{ lead_id: "l1", company: "Acme", relevance: "low", why: "weak" }] },
    ],
  },
};

describe("useSignalLeadMap", () => {
  it("inverts the mapping for both directions", async () => {
    server.use(http.post("/api/signal-lead-map_claude", () => HttpResponse.json(RESPONSE)));
    const { result } = renderHook(() => useSignalLeadMap("org1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.leadsForSignal("s1")).toHaveLength(1);
    expect(result.current.signalsForLead("l1").map((s) => s.signal_id)).toEqual(["s1", "s2"]);
    expect(result.current.signalsForLead("l1")[0].relevance).toBe("high");
  });

  it("returns empty selectors when disabled (no orgId)", () => {
    const { result } = renderHook(() => useSignalLeadMap(""), { wrapper });
    expect(result.current.leadsForSignal("s1")).toEqual([]);
    expect(result.current.signalsForLead("l1")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx --no-file-parallelism`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `frontend/src/features/signals/hooks/useSignalLeadMap.ts`**:

```typescript
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import type { SignalLeadMapEntry } from "../contracts";
import { fetchSignalLeadMap } from "../services/signals";

import { qk } from "@/shared/api/queryKeys";
import { useAuth } from "@/shared/auth/AuthContext";

/**
 * Read-time signal↔lead mapping. Fetches once per (org, user) and exposes two
 * inverse selectors. Quiet (empty) while loading, disabled, or on error.
 */
export function useSignalLeadMap(orgId?: string | null) {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid ?? "";

  const query = useQuery({
    queryKey: qk.signalLeadMap(orgId ?? "", userId),
    enabled: !!orgId && !!userId,
    queryFn: () => fetchSignalLeadMap(userId, orgId as string),
    retry: false,
  });

  const mapping: SignalLeadMapEntry[] = useMemo(
    () => query.data?.data.mapping ?? [],
    [query.data],
  );

  /** Affected leads for a signal (for "Affects N leads"). */
  const leadsForSignal = useCallback(
    (signalId: string) => mapping.find((m) => m.signal_id === signalId)?.leads ?? [],
    [mapping],
  );

  /** Relevant signals for a lead, flattened with this lead's relevance/why. */
  const signalsForLead = useCallback(
    (leadId: string) =>
      mapping
        .filter((m) => m.leads.some((l) => l.lead_id === leadId))
        .map((m) => {
          const ref = m.leads.find((l) => l.lead_id === leadId);
          return {
            signal_id: m.signal_id,
            headline: m.headline,
            relevance: ref?.relevance ?? "low",
            why: ref?.why ?? "",
          };
        }),
    [mapping],
  );

  return { signalsForLead, leadsForSignal, isLoading: query.isLoading, isError: query.isError };
}
```

- [ ] **Step 4: Export from the barrel** `frontend/src/features/signals/index.ts`:

```typescript
export { signalsRoutes } from "./routes";
export { useSignalLeadMap } from "./hooks/useSignalLeadMap";
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx --no-file-parallelism`
Expected: PASS.

- [ ] **Step 6: Typecheck, format, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx prettier --check src/features/signals/hooks/useSignalLeadMap.ts src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx src/features/signals/index.ts
git add frontend/src/features/signals/hooks/useSignalLeadMap.ts frontend/src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx frontend/src/features/signals/index.ts
git commit -m "feat(fe): add useSignalLeadMap hook with inverse selectors"
```

---

### Task 14: "Affects N leads" on SignalCard + SignalsPage wiring

**Files:**
- Modify: `frontend/src/features/signals/components/SignalCard.tsx` (props + render)
- Modify: `frontend/src/features/signals/pages/SignalsPage.tsx` (call hook, pass prop)
- Test: `frontend/src/features/signals/components/__tests__/SignalCard.affects.test.tsx` (new, focused)

- [ ] **Step 1: Write the failing test** (renders just the new affordance; provides the minimum props SignalCard needs — copy the full prop set from an existing SignalCard test if one exists, otherwise stub the callbacks)

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SignalCard } from "../SignalCard";

const baseSignal = {
  id: "s1", agent: "scout", timestamp: "2026-06-15T00:00:00Z",
  headline: "Hiring surge", snippet: "…", description: "…",
  sourceUrl: "https://x", sourceLabel: "X", nextBestMoves: [], contextualSuggestions: [],
} as never;

const noop = vi.fn();
const props = {
  signal: baseSignal, isAccepted: false, getAgentBadge: () => null,
  isDescriptionExpanded: false, expandedRecommendationIndex: null,
  recommendationAnswers: {}, recommendationAnswerLoading: null, answerExpandedKeys: new Set<string>(),
  onAccept: noop, onReject: noop, onBotIconClick: noop, onNavigateToAgentChat: noop,
  onExpandDescription: noop, onCollapseDescription: noop, onToggleRecommendation: noop,
  onExpandAnswer: noop, onCollapseAnswer: noop,
} as never;

describe("SignalCard — Affects N leads", () => {
  it("shows the count when affectedLeadCount > 0", () => {
    render(<SignalCard {...props} affectedLeadCount={3} />);
    expect(screen.getByText(/Affects/)).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
  it("renders nothing when count is 0/undefined", () => {
    render(<SignalCard {...props} />);
    expect(screen.queryByText(/Affects/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/signals/components/__tests__/SignalCard.affects.test.tsx --no-file-parallelism`
Expected: FAIL (`affectedLeadCount` not a prop; nothing rendered).

- [ ] **Step 3a: Add the prop** to `SignalCardProps` in `SignalCard.tsx`:

```typescript
  onExpandAnswer: (key: string) => void;
  onCollapseAnswer: (key: string) => void;
  affectedLeadCount?: number;
```

Destructure it in the component signature alongside the other props (add `affectedLeadCount,`).

- [ ] **Step 3b: Render the affordance** — insert immediately before the `{/* Card Actions */}` comment (~line 413):

```tsx
        {affectedLeadCount ? (
          <div className="mt-3 text-xs text-muted-foreground">
            Affects <span className="font-semibold text-foreground">{affectedLeadCount}</span>{" "}
            {affectedLeadCount === 1 ? "lead" : "leads"}
          </div>
        ) : null}

        {/* Card Actions */}
```

- [ ] **Step 3c: Wire SignalsPage** — in `frontend/src/features/signals/pages/SignalsPage.tsx`:
  - Add the import: `import { useSignalLeadMap } from "../hooks/useSignalLeadMap";`
  - Near the top (after `const { currentUser, orgId } = useAuth();`): `const { leadsForSignal } = useSignalLeadMap(orgId);`
  - In the `signals.map((signal) => …)` render, add the prop to `<SignalCard … />`:

```tsx
      key={signal.id}
      signal={signal}
      affectedLeadCount={leadsForSignal(signal.id).length}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/signals/components/__tests__/SignalCard.affects.test.tsx --no-file-parallelism`
Expected: PASS.

- [ ] **Step 5: Typecheck, format, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx prettier --check src/features/signals/components/SignalCard.tsx src/features/signals/pages/SignalsPage.tsx src/features/signals/components/__tests__/SignalCard.affects.test.tsx
git add frontend/src/features/signals/components/SignalCard.tsx frontend/src/features/signals/pages/SignalsPage.tsx frontend/src/features/signals/components/__tests__/SignalCard.affects.test.tsx
git commit -m "feat(fe): show Affects N leads on signal cards"
```

---

### Task 15: "N relevant signals" in the LeadsTable expanded panel

`LeadIntelligencePanel` is a module-scope component, so it receives the relevant signals as a prop computed at the row call site (where `signalsForLead` is in scope).

**Files:**
- Modify: `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx`

- [ ] **Step 1: Add the import + hook + orgId** — at the top of `LeadsTable.tsx` add `import { useSignalLeadMap } from "@/features/signals";`. Inside the component, after the existing `useAuthToken()` / `useTenant()` calls:

```typescript
  const leadMapOrgId = selectedTenant?.id ?? authOrgId ?? "";
  const { signalsForLead } = useSignalLeadMap(leadMapOrgId);
```

- [ ] **Step 2: Extend `LeadIntelligencePanel`** — add a prop and render block. Update its prop type:

```typescript
const LeadIntelligencePanel = ({
  lead,
  onChatWithScout: _onChatWithScout,
  detail,
  relevantSignals = [],
}: {
  lead: HeatmapLead;
  onChatWithScout?: (leads: HeatmapLead[], reportFilter?: string) => void;
  detail?: LeadScoreDetailState;
  relevantSignals?: { signal_id: string; headline: string; relevance: string; why: string }[];
}) => {
```

Then, immediately after the score-descriptions block closes (after the `)}` that ends the `isLoadingDetail` ternary, before the commented "View Segment Button"), add:

```tsx
      {relevantSignals.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-[11px] font-semibold text-foreground mb-1">
            {relevantSignals.length} relevant{" "}
            {relevantSignals.length === 1 ? "signal" : "signals"}
          </p>
          <ul className="space-y-1">
            {relevantSignals.map((s) => (
              <li key={s.signal_id} className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{s.headline}</span>
                {s.why ? ` — ${s.why}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
```

- [ ] **Step 3: Pass the prop at the call site** — where `<LeadIntelligencePanel … />` is rendered in the expanded row (~line 779):

```tsx
      <LeadIntelligencePanel
        lead={lead}
        onChatWithScout={onChatWithScout}
        detail={scoreDetailByLeadId[lead.id]}
        relevantSignals={signalsForLead(lead.id)}
      />
```

- [ ] **Step 4: Typecheck + lint + build** (presentational wiring; the inversion logic is unit-tested in Task 13)

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx eslint src/features/market-research/components/lead-stream/LeadsTable.tsx && npm run build`
Expected: PASS.

- [ ] **Step 5: Format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx prettier --check src/features/market-research/components/lead-stream/LeadsTable.tsx
git add frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx
git commit -m "feat(fe): show N relevant signals in the LeadsTable expanded panel"
```

---

# Phase E — Feature #1 frontend: rewire customers/LeadStream to real leads

### Task 16: Leads contract + service + hook (`GET /api/v2/leads`)

No FE consumer of `/api/v2/leads` exists; create the contract, service, and hook. The backend endpoint already returns the paginated envelope with the full lead node (incl. `source`).

**Files:**
- Create: `frontend/src/features/customers/contracts.ts`
- Create: `frontend/src/features/customers/services/leads.ts`
- Create: `frontend/src/features/customers/hooks/useLeads.ts`
- Create: `frontend/src/features/customers/services/__tests__/leads.test.ts`
- Modify: `frontend/src/test/msw/handlers.ts` (default `/api/v2/leads` handler)

- [ ] **Step 1: Write the failing service test**

```typescript
import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { fetchLeads } from "../leads";

import { server } from "@/test/msw/server";

void QueryClient;

describe("fetchLeads", () => {
  it("maps the v2 paginated leads envelope to display rows", async () => {
    server.use(
      http.get("/api/v2/leads", () =>
        HttpResponse.json({
          items: [
            { lead_id: "l1", lead_name: "Tom", company_name: "Acme", source: "apollo" },
            { lead_id: "l2", company: "Beta", source: null },
          ],
          total: 2, limit: 50, offset: 0,
        }),
      ),
    );
    const rows = await fetchLeads("org1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "l1", name: "Tom", company: "Acme", source: "apollo" });
    expect(rows[1]).toMatchObject({ id: "l2", company: "Beta", source: null });
    expect(rows[1].name).toBe("Beta"); // falls back to company when no name
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/customers/services/__tests__/leads.test.ts --no-file-parallelism`
Expected: FAIL (module not found).

- [ ] **Step 3a: Create the contract** `frontend/src/features/customers/contracts.ts`:

```typescript
import { z } from "zod";

/** Raw v2 lead node (flexible). Only the fields we read are declared; the rest pass through. */
export const RawLeadSchema = z
  .object({
    lead_id: z.string(),
    source: z.string().nullish(),
    company_name: z.string().nullish(),
    company: z.string().nullish(),
    lead_name: z.string().nullish(),
    name: z.string().nullish(),
    email_status: z.string().nullish(),
  })
  .passthrough();

export type RawLead = z.infer<typeof RawLeadSchema>;

/** Display shape for the customers Lead Stream. */
export interface CustomerLead {
  id: string;
  name: string;
  company: string;
  source: string | null;
  emailStatus: string | null;
}

export function mapRawLead(raw: RawLead): CustomerLead {
  const company = (raw.company_name ?? raw.company ?? "").trim() || "—";
  const name = (raw.lead_name ?? raw.name ?? "").trim() || company;
  return {
    id: raw.lead_id,
    name,
    company,
    source: raw.source ?? null,
    emailStatus: raw.email_status ?? null,
  };
}
```

- [ ] **Step 3b: Create the service** `frontend/src/features/customers/services/leads.ts`:

```typescript
import { RawLeadSchema, mapRawLead, type CustomerLead } from "../contracts";

import { apiGet } from "@/shared/api/client";
import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";

/** GET /api/v2/leads?org_id=&limit=50&offset=0 — first page of an org's leads. */
export async function fetchLeads(orgId: string): Promise<CustomerLead[]> {
  const env = await apiGet(
    `v2/leads?org_id=${encodeURIComponent(orgId)}&${firstPageParams(50)}`,
    paginatedSchema(RawLeadSchema),
  );
  return env.items.map(mapRawLead);
}
```

- [ ] **Step 3c: Create the hook** `frontend/src/features/customers/hooks/useLeads.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";

import { fetchLeads } from "../services/leads";

import { qk } from "@/shared/api/queryKeys";

/** Real org leads from GET /api/v2/leads. Disabled until orgId is known. */
export function useLeads(orgId?: string | null) {
  return useQuery({
    queryKey: qk.leads(orgId ?? ""),
    enabled: !!orgId,
    queryFn: () => fetchLeads(orgId as string),
    retry: false,
  });
}
```

- [ ] **Step 3d: Add a default MSW handler** to `frontend/src/test/msw/handlers.ts`:

```typescript
http.get("/api/v2/leads", () =>
  HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
),
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/customers/services/__tests__/leads.test.ts --no-file-parallelism`
Expected: PASS.

- [ ] **Step 5: Typecheck, format, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx prettier --check src/features/customers/contracts.ts src/features/customers/services/leads.ts src/features/customers/hooks/useLeads.ts src/features/customers/services/__tests__/leads.test.ts src/test/msw/handlers.ts
git add frontend/src/features/customers/contracts.ts frontend/src/features/customers/services/leads.ts frontend/src/features/customers/hooks/useLeads.ts frontend/src/features/customers/services/__tests__/leads.test.ts frontend/src/test/msw/handlers.ts
git commit -m "feat(fe): add customers leads contract, service, and useLeads hook"
```

---

### Task 17: Rewrite `LeadStream.tsx` to real leads (+ source badge/filter) + pass `orgId`

The mock-only ICP segmentation and `filterByICP` behavior are dropped (real v2 leads carry no `matchedICP`). The component becomes a lean, source-filterable real-lead table with the real empty state restored. `filterByICP`/`onClearFilter` props are kept in the signature (so `CustomersPage` keeps compiling) but no longer drive filtering.

**Files:**
- Rewrite: `frontend/src/features/customers/components/lead-stream/LeadStream.tsx`
- Modify: `frontend/src/features/customers/pages/CustomersPage.tsx` (pass `orgId`)
- Create: `frontend/src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LeadStreamPanel } from "../LeadStream";

import { server } from "@/test/msw/server";

vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ orgId: "org1", currentUser: { uid: "u1" } }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("LeadStreamPanel (real leads)", () => {
  it("renders fetched leads with source badges", async () => {
    server.use(
      http.get("/api/v2/leads", () =>
        HttpResponse.json({
          items: [{ lead_id: "l1", lead_name: "Tom", company_name: "Acme", source: "apollo" }],
          total: 1, limit: 50, offset: 0,
        }),
      ),
    );
    render(<LeadStreamPanel />, { wrapper });
    expect(await screen.findByText("Tom")).toBeTruthy();
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByText("Apollo")).toBeTruthy();
  });

  it("shows the empty state when the org has no leads", async () => {
    server.use(
      http.get("/api/v2/leads", () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
    );
    render(<LeadStreamPanel />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText("No prospect data yet")).toBeTruthy(),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx --no-file-parallelism`
Expected: FAIL (still renders mock data; no `Apollo` badge).

- [ ] **Step 3: Replace `LeadStream.tsx` entirely** with the real-data panel:

```tsx
import { ArrowUpRight, Database } from "lucide-react";
import { useMemo, useState } from "react";

import { useLeads } from "../../hooks/useLeads";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LEAD_SOURCE_OPTIONS,
  LeadSourceBadge,
  filterLeadsBySource,
  type LeadSourceFilter,
} from "@/features/connectors";
import { useAuth } from "@/shared/auth/AuthContext";

interface LeadStreamPanelProps {
  orgId?: string | null;
  // Retained for call-site compatibility; ICP segmentation is no longer applied
  // to real leads (they carry no matchedICP). See specs/36 §5.7-A2.
  filterByICP?: string | null;
  onClearFilter?: () => void;
}

export function LeadStreamPanel({ orgId: orgIdProp }: LeadStreamPanelProps) {
  const { orgId: authOrgId } = useAuth();
  const orgId = orgIdProp ?? authOrgId ?? null;
  const leadsQuery = useLeads(orgId);
  const leads = leadsQuery.data ?? [];
  const [sourceFilter, setSourceFilter] = useState<LeadSourceFilter>("all");

  const visibleLeads = useMemo(
    () => filterLeadsBySource(leads, sourceFilter),
    [leads, sourceFilter],
  );

  if (!leadsQuery.isLoading && leads.length === 0) {
    return (
      <Card className="border-dashed border-2 border-muted">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Database className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No prospect data yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Upload a prospect list in Data Sources to generate your Lead Stream.
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.dispatchEvent(new CustomEvent("navigateToDataSources"))}
          >
            <ArrowUpRight className="h-4 w-4" />
            Go to Data Sources
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Lead Stream</h3>
            <Badge variant="secondary" className="text-[10px]">
              {leads.length} leads
            </Badge>
          </div>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as LeadSourceFilter)}>
            <SelectTrigger className="h-8 text-xs w-[140px]" aria-label="Filter by lead source">
              <SelectValue placeholder="All leads" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Company</TableHead>
              <TableHead className="text-xs">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLeads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="text-sm font-medium">{lead.name}</TableCell>
                <TableCell className="text-sm">{lead.company}</TableCell>
                <TableCell>
                  <LeadSourceBadge source={lead.source} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Pass `orgId` from CustomersPage** — in `frontend/src/features/customers/pages/CustomersPage.tsx`:
  - Add the import: `import { useAuth } from "@/shared/auth/AuthContext";`
  - In the component body: `const { orgId } = useAuth();`
  - Update the render: `<LeadStreamPanel orgId={orgId} filterByICP={filteredICP} onClearFilter={() => setFilteredICP(null)} />`

- [ ] **Step 5: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx --no-file-parallelism`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint + format + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx eslint src/features/customers/components/lead-stream/LeadStream.tsx src/features/customers/pages/CustomersPage.tsx && npx prettier --check src/features/customers/components/lead-stream/LeadStream.tsx src/features/customers/pages/CustomersPage.tsx src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx
git add frontend/src/features/customers/components/lead-stream/LeadStream.tsx frontend/src/features/customers/pages/CustomersPage.tsx frontend/src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx
git commit -m "feat(fe): wire customers Lead Stream to real leads with source badge/filter"
```

> After this task, knip may flag the now-unused mock helpers/segment types that were removed with the rewrite. If `npm run preflight`'s `knip --strict` reports unused exports introduced by the rewrite, delete them in this commit's follow-up or fold into Task 18.

---

### Task 18: "N relevant signals" on the customers Lead Stream rows

LeadStream now has real `lead.id`s, so it can join the mapping. Add a count column and an expandable detail.

**Files:**
- Modify: `frontend/src/features/customers/components/lead-stream/LeadStream.tsx`
- Modify: `frontend/src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx` (add a case)

- [ ] **Step 1: Add the failing test case** (append inside the existing `describe`)

```typescript
  it("shows the relevant-signals count per lead", async () => {
    server.use(
      http.get("/api/v2/leads", () =>
        HttpResponse.json({
          items: [{ lead_id: "l1", lead_name: "Tom", company_name: "Acme", source: "csv" }],
          total: 1, limit: 50, offset: 0,
        }),
      ),
      http.post("/api/signal-lead-map_claude", () =>
        HttpResponse.json({
          status: "success",
          data: {
            mapping: [
              { signal_id: "s1", headline: "Hiring surge", leads: [{ lead_id: "l1", company: "Acme", relevance: "high", why: "match" }] },
            ],
          },
        }),
      ),
    );
    render(<LeadStreamPanel />, { wrapper });
    expect(await screen.findByText("Tom")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/1 signal/)).toBeTruthy());
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx --no-file-parallelism`
Expected: FAIL (no signals column yet).

- [ ] **Step 3: Wire the mapping into LeadStream** — in `LeadStream.tsx`:
  - Add the import: `import { useSignalLeadMap } from "@/features/signals";`
  - In the component, after `const orgId = …`: `const { signalsForLead } = useSignalLeadMap(orgId);`
  - Add a header cell after "Source":

```tsx
              <TableHead className="text-xs">Source</TableHead>
              <TableHead className="text-xs">Signals</TableHead>
```

  - Add the matching body cell in each row, after the source cell:

```tsx
                <TableCell>
                  <LeadSourceBadge source={lead.source} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(() => {
                    const n = signalsForLead(lead.id).length;
                    return n > 0 ? `${n} ${n === 1 ? "signal" : "signals"}` : "—";
                  })()}
                </TableCell>
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/frontend && npx vitest run src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx --no-file-parallelism`
Expected: PASS.

- [ ] **Step 5: Typecheck, format, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend && npm run typecheck && npx prettier --check src/features/customers/components/lead-stream/LeadStream.tsx src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx
git add frontend/src/features/customers/components/lead-stream/LeadStream.tsx frontend/src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx
git commit -m "feat(fe): show relevant-signals count on customers Lead Stream rows"
```

---

## Final verification (before merge)

- [ ] **Backend:** `cd backend && .venv/bin/python -m pytest tests/unit/test_leads.py tests/unit/test_market_scoring.py tests/unit/test_signal_lead_map.py tests/test_signals.py -q` — all green.
- [ ] **Frontend full gate:** `cd frontend && npm run preflight` (serial; the merge gate). If `knip --strict` flags exports removed/added by the LeadStream rewrite, resolve them. If a flaky async vitest failure appears under load, re-run with `--no-file-parallelism` per the known sandbox flake.
- [ ] **Merge:** `git checkout master && git merge --no-ff phase-36-signal-lead-mapping && git push origin master`. Delete the branch.

---

## Self-Review (run against the spec)

**Spec coverage:**
- §5.1 endpoint + router-level missing-key 500 → Task 11. ✓
- §5.2 service (fetch→fetch→fingerprint+cache→context→call→parse→write, ordering, retries, degrade) → Tasks 9, 10. ✓
- §5.3 response shape (signal_id, headline echo, leads[]{lead_id,company,relevance,why}, cached) → Task 10 + 12 contract. ✓
- §5.4 derived cache, per-(org,user) key, new fingerprint → Tasks 9, 10. ✓
- §5.5 prompt → Task 8. ✓
- §5.6 truncated-prefix tolerance, graceful empty, windowing(50) → Task 10. ✓
- §5.7 A1 LeadsTable / A2 LeadStream rewire (drop filterByICP, pagination first-page) / B Signals page; degrade silent → Tasks 14, 15, 16, 17, 18. ✓
- §6.1 taxonomy → Task 4. ✓
- §6.2 stamp manual/csv + LeadMarketScoreRow.source (persist + read) → Tasks 1, 2, 3. ✓
- §6.3 LeadSource/LeadSourceFilter split, normalizeLeadSource, HeatmapLead.source retype, LeadSourceBadge, mapper preserves source, both tables → Tasks 4, 5, 6, 7, 17. ✓
- §6.4 catch-all→exact-match behavior change → Task 4 tests. ✓
- §7 contract summary (new endpoint; market-scores +source; v2/leads reused) → Tasks 11, 3, 16. ✓
- §8 testing (backend a–i; FE normalize/filter/selectors/mapper/LeadStream/badge/MSW) → covered across tasks. ✓
- §9 phasing (Feature #2 first, Feature #1 second) → Phase A/B before C/D/E. ✓
- AC #1–#9 → Tasks 11/10 (#1,#2,#3,#4,#9), 1/2/3 (#5), 7/17 (#6), 14/15/18 (#7), 17 (#8). ✓

**Deferred (per spec, not implemented here):** cache-miss concurrency guard (§5.6, §10); HubSpot/Salesforce connectors (reserved only); Strategist wiring; numeric relevance; mapping precompute.

**Type consistency:** `LeadSource`/`LeadSourceFilter`/`normalizeLeadSource` (Task 4) consumed identically in Tasks 5, 6, 7, 17. `SignalLeadMapResponse`/`SignalLeadMapEntry` (Task 12) consumed in Task 13; `signalsForLead`/`leadsForSignal` selector shapes match their consumers (Tasks 14, 15, 18). `CustomerLead` (Task 16) is what `useLeads`→LeadStream render against (Tasks 17, 18). Backend `build_signal_lead_map_claude(driver, mongo, request)` signature matches the router call (Task 11) and the re-export (Task 11). `_compute_fingerprint`/`_get_cached_lead_map`/`_save_lead_map` (Task 9) used by Task 10.
