# Matched-Leads Prospect Fields (name / title / seniority) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface each matched lead's contact **name, title, and seniority** in the Signals card, the Save-as-Artifact PDF, and both Lead Stream tables — without changing how matching works and with no extra LLM cost.

**Architecture:** Backend re-joins each matched `lead_id` to its full lead dict and attaches alias-resolved `name/title/seniority` as a **post-parse** step (the prompt and `_leads_for_prompt` are untouched; the cache keeps storing the narrow LLM shape, enrichment is applied at response-build time on both cache paths). Frontend widens the signals Zod contract and renders the fields in the card + PDF. Both Lead Stream surfaces (market-research/Scout `LeadsTable`, and the Customers `LeadStreamPanel`) resolve their fields through **one new shared FE resolver** (`resolveLeadFields`), which also fixes a pre-existing CSV-key blank-Name/Company gap.

**Tech Stack:** Python 3.12 + FastAPI + pytest (backend); React 18 + TypeScript + Vite + TanStack Query + zod + Vitest/Testing Library (frontend). No new dependencies.

## Global Constraints

- **Spec:** `specs/42-matched-leads-prospect-fields-design.md`. This plan implements it; the spec is authoritative on intent.
- **Display-only — matching is UNCHANGED.** Do **not** edit `prompts/signals/signals_lead_map.md.j2` or `_leads_for_prompt`. No extra LLM tokens. The existing `test_leads_for_prompt_resolves_*` tests must stay green.
- **Cache stays narrow.** The Mongo cache continues to store the LLM-derived `{lead_id, company, relevance, why}` shape; `_enrich_matched_leads` is **pure** (returns a new mapping) and is applied only at response-build time, on **both** the cache-hit and cache-miss return paths.
- **Degrade-never-throw FE contract.** New contract fields are `z.string().optional()` (output `string | undefined`); render code uses `||` / `.filter(Boolean)`, which already handles `undefined`. (This refines the spec's `.default("")` to avoid editing every existing `SignalLeadMapLead` test fixture — render behavior is identical.)
- **No backend change for the Lead Stream.** `/api/v2/leads` already returns the full raw records.
- **Feature boundaries via barrels.** Cross-feature imports go through a feature's `index.ts`; shared code is imported from `@/shared/...`. The new resolver lives in `@/shared/lib/leadData` and is imported by both the market-research and customers features.
- **FE↔BE "implement twice".** The FE `resolveLeadFields` re-implements the backend's alias concept in TypeScript; do **not** share code across the stack boundary.
- **Commit style:** `type(scope):` subjects (`feat(be):`, `feat(fe):`, `refactor(fe):`, `test(fe):`), one commit per task, small and frequent. **No `Co-Authored-By` footer.**
- **Frontend commands run from `frontend/`.** Per-task verify: `npm run typecheck` (the npm script — never bare `npx tsc`, the root tsconfig is a no-op stub), `npx vitest run <file>` for the task's tests, `npx prettier --write <touched files>` (the per-task `npm run verify` omits `format:check`).
- **Backend commands run from the repo root (worktree root).** Per-task verify: `backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py -q` (no `PYTHONPATH`).
- **Merge gate** is the serial `npm run preflight` (typecheck, lint, format:check, vitest, build, bundle, Playwright + visual regression, knip) plus the backend pytest run. Adding table columns changes the lead-stream VR snapshots — regenerate baselines in the gate and **confirm the diff is only the intended +Title/+Seniority columns** before accepting (do not blanket `--update-snapshots`).

## Prerequisites — worktree setup (one-time)

The worktree is fresh from `origin/master`; `backend/.venv` and `frontend/node_modules` are git-ignored and absent. Symlink them from the main checkout once before running any test:

```bash
# from the worktree root (.claude/worktrees/matched-leads-prospect-fields)
ln -s /projects/Brewra/brewra-gtm-intelligence/backend/.venv backend/.venv
ln -s /projects/Brewra/brewra-gtm-intelligence/frontend/node_modules frontend/node_modules
```

(If a symlink misbehaves, fall back to `python -m venv` + `pip install -r backend/requirements.txt` and `npm ci` in `frontend/`.)

---

### Task 1: Backend — enrich matched leads with name / title / seniority

Re-join each matched `lead_id` to its full lead dict and attach alias-resolved prospect fields, as a pure post-parse step applied on both cache paths. Prompt + `_leads_for_prompt` untouched.

**Files:**
- Modify: `backend/app/services/signals/lead_map.py`
- Test: `backend/tests/unit/test_signal_lead_map.py`

**Interfaces:**
- Consumes: existing `_normalize_lead_keys(lead) -> Dict[str, Any]`, `_first_alias(norm, aliases) -> str`, `_build_result(...)`.
- Produces:
  - `_resolve_contact_name(norm: Dict[str, Any]) -> str`
  - `_enrich_matched_leads(mapping: List[Dict], leads_by_id: Dict[str, Dict]) -> List[Dict]` (pure; per-lead output gains `name`, `title`, `seniority`)
  - The endpoint's per-lead response shape becomes `{lead_id, company, relevance, why, name, title, seniority}`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/unit/test_signal_lead_map.py`:

```python
def test_resolve_contact_name_single_and_composed():
    from app.services.signals.lead_map import _resolve_contact_name, _normalize_lead_keys
    assert _resolve_contact_name(_normalize_lead_keys({"name": "Sam Lee"})) == "Sam Lee"
    assert _resolve_contact_name(
        _normalize_lead_keys({"First_Name": "Jane", "Last_Name": "Doe"})
    ) == "Jane Doe"
    assert _resolve_contact_name(_normalize_lead_keys({"company_name": "Acme"})) == ""


def test_enrich_matched_leads_csv_and_apollo_and_missing():
    from app.services.signals.lead_map import _enrich_matched_leads
    leads_by_id = {
        "l1": {"lead_id": "l1", "First_Name": "Jane", "Last_Name": "Doe",
               "Job_Title": "VP Engineering", "Seniority_Level": "CXO"},
        "l2": {"lead_id": "l2", "name": "Sam Lee", "title": "Owner", "seniority": "Owner"},
        "l3": {"lead_id": "l3"},  # no prospect fields
    }
    mapping = [{"signal_id": "s1", "headline": "h", "leads": [
        {"lead_id": "l1", "company": "Acme", "relevance": "high", "why": "x"},
        {"lead_id": "l2", "company": "Globex", "relevance": "low", "why": "y"},
        {"lead_id": "l3", "company": "Z", "relevance": "low", "why": "z"},
    ]}]
    leads = _enrich_matched_leads(mapping, leads_by_id)[0]["leads"]
    assert (leads[0]["name"], leads[0]["title"], leads[0]["seniority"]) == ("Jane Doe", "VP Engineering", "CXO")
    assert (leads[1]["name"], leads[1]["title"], leads[1]["seniority"]) == ("Sam Lee", "Owner", "Owner")
    assert (leads[2]["name"], leads[2]["title"], leads[2]["seniority"]) == ("", "", "")
    # existing fields preserved
    assert leads[0]["company"] == "Acme" and leads[0]["relevance"] == "high" and leads[0]["why"] == "x"


def test_enrich_matched_leads_is_pure_does_not_mutate_input():
    from app.services.signals.lead_map import _enrich_matched_leads
    mapping = [{"signal_id": "s1", "headline": "h",
                "leads": [{"lead_id": "l1", "company": "Acme", "relevance": "high", "why": "x"}]}]
    _enrich_matched_leads(mapping, {"l1": {"lead_id": "l1", "Job_Title": "VP"}})
    assert "title" not in mapping[0]["leads"][0]  # input untouched → cache stays narrow


def test_build_map_enriches_on_cache_miss_but_caches_narrow():
    signals = [{"signal_id": "s1", "headline": "Hiring surge"}]
    leads = [{"lead_id": "l1", "company_name": "Acme", "First_Name": "Jane",
              "Last_Name": "Doe", "Job_Title": "VP Engineering", "Seniority_Level": "CXO"}]
    claude_json = ('{"mapping":[{"signal_id":"s1","leads":'
                   '[{"lead_id":"l1","company":"Acme","relevance":"high","why":"match"}]}]}')
    mongo, store = _fake_cache_mongo()
    result, _ = _run(signals, leads, claude_json, mongo=mongo)
    lead = result["data"]["mapping"][0]["leads"][0]
    assert (lead["name"], lead["title"], lead["seniority"]) == ("Jane Doe", "VP Engineering", "CXO")
    cached_lead = store["o1:u1"]["mapping"][0]["leads"][0]
    assert "name" not in cached_lead and "title" not in cached_lead  # cache narrow


def test_build_map_enriches_on_cache_hit():
    from app.services.signals import lead_map
    signals = [{"signal_id": "s1", "headline": "h"}]
    leads = [{"lead_id": "l1", "First_Name": "Jane", "Last_Name": "Doe",
              "Job_Title": "VP Engineering", "Seniority_Level": "CXO"}]
    fp = lead_map._compute_fingerprint(["s1"], ["l1"])
    mongo, _ = _fake_cache_mongo({
        "o1:u1": {"_id": "o1:u1", "fingerprint": fp, "generated_at": "t0",
                  "mapping": [{"signal_id": "s1", "headline": "cached", "leads": [
                      {"lead_id": "l1", "company": "Acme", "relevance": "high", "why": "x"}]}]}
    })
    result, claude = _run(signals, leads, "SHOULD-NOT-RUN", mongo=mongo)
    assert result["data"]["cached"] is True
    lead = result["data"]["mapping"][0]["leads"][0]
    assert (lead["name"], lead["title"], lead["seniority"]) == ("Jane Doe", "VP Engineering", "CXO")
    claude.assert_not_called()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py -q`
Expected: FAIL — `_resolve_contact_name` / `_enrich_matched_leads` not defined; orchestration leads lack `name/title/seniority`.

- [ ] **Step 3: Add the alias tuples**

In `backend/app/services/signals/lead_map.py`, immediately after `_REGION_ALIASES` (the block ending at the `)` after `"countryregion",`):

```python
_TITLE_ALIASES = ("jobtitle", "title", "designation", "position", "jobrole")
_SENIORITY_ALIASES = ("senioritylevel", "seniority", "joblevel")
_NAME_ALIASES = ("name", "fullname", "contactname", "leadname", "personname", "contactfullname")
_FIRST_NAME_ALIASES = ("firstname", "givenname", "fname")
_LAST_NAME_ALIASES = ("lastname", "surname", "familyname", "lname")
```

- [ ] **Step 4: Add the helpers**

Immediately after the `_first_alias` function (before `_leads_for_prompt`):

```python
def _resolve_contact_name(norm: Dict[str, Any]) -> str:
    """Single name field if present, else 'First Last' composed from aliases, else ''."""
    single = _first_alias(norm, _NAME_ALIASES)
    if single:
        return single
    first = _first_alias(norm, _FIRST_NAME_ALIASES)
    last = _first_alias(norm, _LAST_NAME_ALIASES)
    return f"{first} {last}".strip()


def _enrich_matched_leads(
    mapping: List[Dict[str, Any]], leads_by_id: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Attach display-only prospect fields (name/title/seniority) to each matched
    lead by re-joining lead_id -> the full lead dict (alias-resolved). PURE: returns
    a new mapping so the cached narrow shape is never mutated. Never raises; an
    unknown lead_id yields empty fields. Matching is unchanged — this only widens
    the response shape."""
    enriched: List[Dict[str, Any]] = []
    for entry in mapping:
        leads_out = []
        for lead in entry.get("leads", []) or []:
            full = leads_by_id.get(str(lead.get("lead_id", "")))
            norm = _normalize_lead_keys(full) if full else {}
            leads_out.append({
                **lead,
                "name": _resolve_contact_name(norm),
                "title": _first_alias(norm, _TITLE_ALIASES),
                "seniority": _first_alias(norm, _SENIORITY_ALIASES),
            })
        enriched.append({**entry, "leads": leads_out})
    return enriched
```

- [ ] **Step 5: Wire enrichment into the orchestration (both cache paths)**

In `build_signal_lead_map_claude`, immediately after `ld_ids = _lead_ids(leads)`:

```python
    leads_by_id = {str(l["lead_id"]): l for l in leads if l.get("lead_id")}
```

Replace the cache-hit return line:

```python
        if cached and cached.get("fingerprint") == fingerprint:
            return _build_result(cached.get("mapping", []), cached.get("generated_at", now), True)
```

with:

```python
        if cached and cached.get("fingerprint") == fingerprint:
            return _build_result(
                _enrich_matched_leads(cached.get("mapping", []), leads_by_id),
                cached.get("generated_at", now), True,
            )
```

Replace the final return line (`return _build_result(mapping, now, False)`, after the cache write) with:

```python
    return _build_result(_enrich_matched_leads(mapping, leads_by_id), now, False)
```

(The cache write above it still persists the narrow `mapping` — do **not** move enrichment before the write.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py -q`
Expected: PASS — all new tests + the existing suite (incl. `test_leads_for_prompt_resolves_*`, `test_build_map_cache_hit_skips_claude`).

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/signals/lead_map.py backend/tests/unit/test_signal_lead_map.py
git commit -m "feat(be): enrich matched leads with name/title/seniority (display-only re-join)"
```

---

### Task 2: FE — shared lead-field resolver + widen HeatmapLead

One normalized, alias-aware resolver used by both Lead Stream mappers (Tasks 6 & 8). Fixes the pre-existing CSV-key blank-Name/Company gap and adds title/seniority resolution.

**Files:**
- Modify: `frontend/src/shared/lib/leadData.ts`
- Test: `frontend/src/shared/lib/__tests__/resolveLeadFields.test.ts`

**Interfaces:**
- Produces:
  - `resolveLeadFields(raw: Record<string, unknown>): { name: string; company: string; title: string; seniority: string }`
  - `HeatmapLead` gains `title?: string | null; seniority?: string | null;`

- [ ] **Step 1: Write the failing test**

`frontend/src/shared/lib/__tests__/resolveLeadFields.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { resolveLeadFields } from "../leadData";

describe("resolveLeadFields", () => {
  it("resolves Apollo lowercase keys", () => {
    expect(
      resolveLeadFields({ name: "Sam Lee", company_name: "Globex", title: "Owner", seniority: "Owner" }),
    ).toEqual({ name: "Sam Lee", company: "Globex", title: "Owner", seniority: "Owner" });
  });

  it("resolves CSV TitleCase_underscore keys and composes First+Last", () => {
    expect(
      resolveLeadFields({
        First_Name: "Jane",
        Last_Name: "Doe",
        Company_Name: "Acme",
        Job_Title: "VP Engineering",
        Seniority_Level: "CXO",
      }),
    ).toEqual({ name: "Jane Doe", company: "Acme", title: "VP Engineering", seniority: "CXO" });
  });

  it("returns empty strings when fields are absent", () => {
    expect(resolveLeadFields({ lead_id: "l1" })).toEqual({ name: "", company: "", title: "", seniority: "" });
  });

  it("matches by normalized equality, not substring", () => {
    expect(resolveLeadFields({ Job_Title_X: "nope" }).title).toBe("");
  });

  it("reads a nested `lead` object, top-level winning", () => {
    expect(resolveLeadFields({ lead: { title: "Nested" }, Job_Title: "Top" }).title).toBe("Top");
    expect(resolveLeadFields({ lead: { title: "Nested" } }).title).toBe("Nested");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `frontend/`): `npx vitest run src/shared/lib/__tests__/resolveLeadFields.test.ts`
Expected: FAIL — `resolveLeadFields` is not exported.

- [ ] **Step 3: Add the resolver to `leadData.ts`**

Append to `frontend/src/shared/lib/leadData.ts`:

```ts
// ── Lead-field resolution (shared by both Lead Stream mappers) ────────────────
// /api/v2/leads returns raw stored keys: CSV uploads keep TitleCase_underscore
// headers (First_Name, Job_Title, Seniority_Level); Apollo uses lowercase
// canonical keys (name, title, seniority). FE mirror of the backend's
// _normalize_lead_keys/_first_alias (re-implemented in TS per the FE<->BE rule).
const NAME_ALIASES = ["name", "fullname", "contactname", "leadname", "personname", "contactfullname"];
const FIRST_NAME_ALIASES = ["firstname", "givenname", "fname"];
const LAST_NAME_ALIASES = ["lastname", "surname", "familyname", "lname"];
const COMPANY_ALIASES = [
  "companyname", "company", "organizationname", "organisationname",
  "organization", "organisation", "accountname", "account", "org",
];
const TITLE_ALIASES = ["jobtitle", "title", "designation", "position", "jobrole"];
const SENIORITY_ALIASES = ["senioritylevel", "seniority", "joblevel"];

const normKey = (k: string): string => k.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Index raw lead by normalized key (lowercased, non-alphanumerics stripped);
 *  first non-empty value wins. */
function normalizeLeadKeys(raw: Record<string, unknown>): Record<string, string> {
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = normKey(k);
    if (!nk) continue;
    const s = v == null ? "" : String(v).trim();
    if (!(nk in norm) || (norm[nk] === "" && s !== "")) norm[nk] = s;
  }
  return norm;
}

/** First non-empty value among the (already-normalized) alias keys, else "". */
function firstAlias(norm: Record<string, string>, aliases: string[]): string {
  for (const a of aliases) {
    if (norm[a]) return norm[a];
  }
  return "";
}

export interface ResolvedLeadFields {
  name: string;
  company: string;
  title: string;
  seniority: string;
}

/**
 * Resolve display fields from a raw /v2/leads node, alias- + case-insensitive.
 * Composes First_Name + Last_Name when there is no single name field. A nested
 * `lead` object is folded in with the top level winning (preserves the prior
 * mapper's nested-object fallback). Never throws; missing fields -> "".
 */
export function resolveLeadFields(raw: Record<string, unknown>): ResolvedLeadFields {
  const nested = raw.lead;
  const merged =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? { ...(nested as Record<string, unknown>), ...raw }
      : raw;
  const norm = normalizeLeadKeys(merged);
  const single = firstAlias(norm, NAME_ALIASES);
  const name = single || `${firstAlias(norm, FIRST_NAME_ALIASES)} ${firstAlias(norm, LAST_NAME_ALIASES)}`.trim();
  return {
    name,
    company: firstAlias(norm, COMPANY_ALIASES),
    title: firstAlias(norm, TITLE_ALIASES),
    seniority: firstAlias(norm, SENIORITY_ALIASES),
  };
}
```

Then add the two fields to the `HeatmapLead` interface (after `email_status?: string | null;`):

```ts
  title?: string | null;
  seniority?: string | null;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/shared/lib/__tests__/resolveLeadFields.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/shared/lib/leadData.ts src/shared/lib/__tests__/resolveLeadFields.test.ts
git add src/shared/lib/leadData.ts src/shared/lib/__tests__/resolveLeadFields.test.ts
git commit -m "feat(fe): add shared resolveLeadFields (alias-aware) + widen HeatmapLead"
```

---

### Task 3: FE — widen the signals lead-map contract

Add the three optional prospect fields to the Zod contract so the wider backend response parses, and lock the shape with a test.

**Files:**
- Modify: `frontend/src/features/signals/contracts.ts`
- Test: `frontend/src/features/signals/__tests__/contracts.prospect.test.ts` (new)

**Interfaces:**
- Produces: `SignalLeadMapLead` gains `name?: string; title?: string; seniority?: string;` (output `string | undefined`).

- [ ] **Step 1: Write the failing test**

`frontend/src/features/signals/__tests__/contracts.prospect.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { SignalLeadMapLeadSchema } from "../contracts";

describe("SignalLeadMapLeadSchema — prospect fields", () => {
  it("parses a populated lead with name/title/seniority", () => {
    const lead = SignalLeadMapLeadSchema.parse({
      lead_id: "l1",
      company: "Acme",
      relevance: "high",
      why: "fit",
      name: "Jane Doe",
      title: "VP Engineering",
      seniority: "CXO",
    });
    expect(lead.name).toBe("Jane Doe");
    expect(lead.title).toBe("VP Engineering");
    expect(lead.seniority).toBe("CXO");
  });

  it("leaves the new fields undefined when absent (narrow legacy response)", () => {
    const lead = SignalLeadMapLeadSchema.parse({ lead_id: "l1", relevance: "low" });
    expect(lead.name).toBeUndefined();
    expect(lead.title).toBeUndefined();
    expect(lead.seniority).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/signals/__tests__/contracts.prospect.test.ts`
Expected: FAIL — `lead.name` is `undefined` in the first case (schema strips the unknown key) → assertion fails.

- [ ] **Step 3: Add the fields to `SignalLeadMapLeadSchema`**

In `frontend/src/features/signals/contracts.ts`, add to the `SignalLeadMapLeadSchema` object (after `why`):

```ts
  // Display-only prospect fields (Spec/Plan 42). Optional → output `string | undefined`;
  // render code uses `||` / `.filter(Boolean)`, so existing fixtures stay valid.
  name: z.string().optional(),
  title: z.string().optional(),
  seniority: z.string().optional(),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/signals/__tests__/contracts.prospect.test.ts`
Expected: PASS (2 tests).

> **TD-FE-73:** if a committed golden fixture for the live `/signal-lead-map_claude` shape exists (e.g. `contracts.test.ts`), add `name`/`title`/`seniority` (anonymized values) to its lead objects so the golden reflects the now-wider live shape. Keep the existing `.default("")`/`.catch("low")` guards intact.

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/signals/contracts.ts src/features/signals/__tests__/contracts.prospect.test.ts
git add src/features/signals/contracts.ts src/features/signals/__tests__/contracts.prospect.test.ts
git commit -m "feat(fe): widen SignalLeadMapLeadSchema with optional name/title/seniority"
```

---

### Task 4: FE — render prospect fields on the Signal card

Each matched-lead row becomes two lines: name (or company fallback) + relevance badge, then `title · seniority · company`.

**Files:**
- Modify: `frontend/src/features/signals/components/SignalCard.tsx`
- Test: `frontend/src/features/signals/components/__tests__/SignalCard.prospect.test.tsx` (new)

**Interfaces:**
- Consumes: `SignalLeadMapLead` (now with optional `name/title/seniority`) — no new props.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/signals/components/__tests__/SignalCard.prospect.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SignalLeadMapLead } from "../../contracts";
import type { SignalCard as SignalCardType } from "../../types";
import { SignalCard } from "../SignalCard";

import { TooltipProvider } from "@/components/ui/tooltip";

const signal: SignalCardType = {
  id: "sig-1", agent: "scout", timestamp: "1h ago", headline: "Hiring surge",
  snippet: "…", description: "ctx", sourceUrl: "#", sourceLabel: "Press",
  source: [], nextBestMoves: [], NBAs: [], contextualSuggestions: [],
};

const leads: SignalLeadMapLead[] = [
  { lead_id: "l1", company: "Acme", relevance: "high", why: "x", name: "Jane Doe", title: "VP Engineering", seniority: "CXO" },
  { lead_id: "l2", company: "Globex", relevance: "low", why: "y" }, // no name → company primary
];

function renderCard() {
  render(
    <TooltipProvider>
      <SignalCard
        signal={signal}
        isAccepted
        getAgentBadge={() => <span>scout</span>}
        isDescriptionExpanded
        expandedRecommendationIndex={null}
        recommendationAnswers={{}}
        recommendationAnswerLoading={null}
        answerExpandedKeys={new Set<string>()}
        onAccept={vi.fn()} onReject={vi.fn()} onBotIconClick={vi.fn()}
        onNavigateToAgentChat={vi.fn()} onExpandDescription={vi.fn()}
        onCollapseDescription={vi.fn()} onToggleRecommendation={vi.fn()}
        onExpandAnswer={vi.fn()} onCollapseAnswer={vi.fn()}
        matchedLeads={leads} leadsLoading={false} leadsError={false}
        isLeadsExpanded onFindMatchedLeads={vi.fn()} onSaveAsArtefact={vi.fn()}
        onRecomputeLeadMap={vi.fn()}
      />
    </TooltipProvider>,
  );
}

describe("SignalCard — prospect fields", () => {
  it("shows name as the primary line and title · seniority · company as the secondary", () => {
    renderCard();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/VP Engineering · CXO · Acme/)).toBeInTheDocument();
  });

  it("falls back to company as the primary line when there is no name", () => {
    renderCard();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/signals/components/__tests__/SignalCard.prospect.test.tsx`
Expected: FAIL — only `lead.company` renders today; "Jane Doe" / the secondary line are absent.

- [ ] **Step 3: Update the matched-leads row markup**

In `frontend/src/features/signals/components/SignalCard.tsx`, find the matched-leads row (the `matchedLeads.map((lead) => ( … ))` block — currently a flex row rendering `{lead.company || "Unknown company"}` and the relevance `Badge`). Replace the row's inner content so the company `<span>` becomes a two-line block:

```tsx
            {matchedLeads.map((lead) => {
              const primary = lead.name || lead.company || "Unknown company";
              const secondary = [lead.title, lead.seniority, lead.company]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={lead.lead_id}
                  className="flex items-start justify-between gap-3 rounded-md bg-white px-3 py-2 border border-gray-100"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{primary}</p>
                    {secondary && <p className="truncate text-xs text-gray-500">{secondary}</p>}
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 text-xs ${relevanceBadgeClass(lead.relevance)}`}
                  >
                    {titleCase(lead.relevance)}
                  </Badge>
                </div>
              );
            })}
```

(`relevanceBadgeClass` and `titleCase` already exist in this file. The per-lead `why` is still never rendered.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/signals/components/__tests__/SignalCard.prospect.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the existing SignalCard tests (shared component — no regression)**

Run: `npx vitest run src/features/signals/components/__tests__/SignalCard.cta.test.tsx`
Expected: PASS — the new optional fields don't change the existing assertions (they assert `company`/relevance, still present).

- [ ] **Step 6: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/signals/components/SignalCard.tsx src/features/signals/components/__tests__/SignalCard.prospect.test.tsx
git add src/features/signals/components/SignalCard.tsx src/features/signals/components/__tests__/SignalCard.prospect.test.tsx
git commit -m "feat(fe): render name/title/seniority on matched-lead rows in SignalCard"
```

---

### Task 5: FE — include prospect fields in the briefing PDF

Each `keyFindings` line gains the contact identity, omitting empty segments.

**Files:**
- Modify: `frontend/src/features/signals/lib/signalBriefing.ts`
- Test: `frontend/src/features/signals/lib/__tests__/signalBriefing.test.ts` (extend)

**Interfaces:**
- Consumes: `SignalLeadMapLead` (with optional `name/title/seniority`). `buildSignalBriefingArtefact` signature unchanged.

- [ ] **Step 1: Write the failing test (append to the existing describe block)**

Add to `frontend/src/features/signals/lib/__tests__/signalBriefing.test.ts`:

```ts
  it("includes name/title/seniority in keyFindings when present, omitting empties", () => {
    const enriched: SignalLeadMapLead[] = [
      { lead_id: "l1", company: "Acme", relevance: "high", why: "fit", name: "Jane Doe", title: "VP Engineering", seniority: "CXO" },
    ];
    const item = buildSignalBriefingArtefact(signal, enriched);
    expect(item.fullReport.keyFindings[0]).toBe(
      "Jane Doe — VP Engineering, CXO (Acme) — Relevance: High: fit",
    );
  });

  it("omits the identity prefix when no prospect fields are present", () => {
    const bare: SignalLeadMapLead[] = [{ lead_id: "l2", company: "Globex", relevance: "low", why: "" }];
    const item = buildSignalBriefingArtefact(signal, bare);
    expect(item.fullReport.keyFindings[0]).toBe("Globex (Relevance: Low)");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/signals/lib/__tests__/signalBriefing.test.ts`
Expected: FAIL — the current line is `"Acme (Relevance: High): fit"`; no identity prefix.

- [ ] **Step 3: Update the `keyFindings` builder**

In `frontend/src/features/signals/lib/signalBriefing.ts`, replace the `keyFindings` map with:

```ts
  const keyFindings = leads.map((lead) => {
    const company = lead.company || "Unknown company";
    // Identity prefix: "Name — Title, Seniority" — omit empty parts.
    const role = [lead.title, lead.seniority].filter(Boolean).join(", ");
    const identity = [lead.name, role].filter(Boolean).join(" — ");
    const subject = identity ? `${identity} (${company})` : company;
    const head = `${subject} — Relevance: ${titleCase(lead.relevance)}`;
    // The per-lead `why` rides into the PDF here — it is intentionally never on screen.
    return lead.why ? `${head}: ${lead.why}` : head;
  });
```

> The escaping/ASCII-fold from Spec/Plan 38's `createSimplePDF` still applies to these strings automatically; accented names beyond that fold remain the deferred shared-generator TD (spec Out-of-scope).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/signals/lib/__tests__/signalBriefing.test.ts`
Expected: PASS — the new cases plus the existing ones (the bare-lead case now reads `"Globex (Relevance: Low)"`; **update any pre-existing assertion** that expected the old `"Company (Relevance: …)"` format to match this — the format for prospect-less leads is unchanged except it still has no identity prefix).

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/signals/lib/signalBriefing.ts src/features/signals/lib/__tests__/signalBriefing.test.ts
git add src/features/signals/lib/signalBriefing.ts src/features/signals/lib/__tests__/signalBriefing.test.ts
git commit -m "feat(fe): include contact name/title/seniority in the briefing PDF"
```

---

### Task 6: FE — market-research mapper uses the shared resolver

`heatmapLeadFromV2Lead` resolves name/company/title/seniority via `resolveLeadFields` — fixing the CSV blank-Name/Company gap and populating the new fields.

**Files:**
- Modify: `frontend/src/features/market-research/lib/marketScoresHeatmap.ts`
- Test: `frontend/src/features/market-research/lib/__tests__/marketScoresHeatmap.prospect.test.ts` (new)

**Interfaces:**
- Consumes: `resolveLeadFields` from `@/shared/lib/leadData`.
- Produces: `heatmapLeadFromV2Lead` now sets `title`/`seniority` and resolves name/company alias-aware.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/market-research/lib/__tests__/marketScoresHeatmap.prospect.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { heatmapLeadFromV2Lead } from "../marketScoresHeatmap";

describe("heatmapLeadFromV2Lead — prospect fields", () => {
  it("resolves CSV TitleCase leads (name, company, title, seniority)", () => {
    const lead = heatmapLeadFromV2Lead({
      lead_id: "l1", Company_Name: "Acme", First_Name: "Jane", Last_Name: "Doe",
      Job_Title: "VP Engineering", Seniority_Level: "CXO",
    });
    expect(lead).not.toBeNull();
    expect(lead!.name).toBe("Jane Doe");
    expect(lead!.company).toBe("Acme");
    expect(lead!.title).toBe("VP Engineering");
    expect(lead!.seniority).toBe("CXO");
  });

  it("resolves Apollo lowercase leads", () => {
    const lead = heatmapLeadFromV2Lead({
      lead_id: "l2", company_name: "Globex", name: "Sam Lee", title: "Owner", seniority: "Owner",
    });
    expect(lead!.title).toBe("Owner");
    expect(lead!.seniority).toBe("Owner");
    expect(lead!.name).toBe("Sam Lee");
  });

  it("leaves title/seniority null when absent", () => {
    const lead = heatmapLeadFromV2Lead({ lead_id: "l3", company_name: "Z" });
    expect(lead!.title).toBeNull();
    expect(lead!.seniority).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/market-research/lib/__tests__/marketScoresHeatmap.prospect.test.ts`
Expected: FAIL — CSV `Company_Name` doesn't resolve (blank), `title`/`seniority` don't exist on the result.

- [ ] **Step 3: Rewrite the field-resolution in `heatmapLeadFromV2Lead`**

In `frontend/src/features/market-research/lib/marketScoresHeatmap.ts`, add the import:

```ts
import { resolveLeadFields, type HeatmapLead } from "@/shared/lib/leadData";
```

(Merge with any existing `@/shared/lib/leadData` import; keep other imports.) Then, inside `heatmapLeadFromV2Lead`, replace the `pickCompanyName` / `pickLeadDisplayName` lines:

```ts
  const company = pickCompanyName(raw) || "—";
  const name = pickLeadDisplayName(raw, company);
```

with:

```ts
  const fields = resolveLeadFields(raw);
  const company = fields.company || "—";
  const name = fields.name || company;
```

and add `title` / `seniority` to the returned object (alongside `company`):

```ts
    title: fields.title || null,
    seniority: fields.seniority || null,
```

The `emailStatus`, `source`, `ratings`, `totalScore`, `priority`, `scored` fields are unchanged. `pickCompanyName` / `pickLeadDisplayName` become unused — delete them (and `pickFirstString` only if it has no other caller; `knip --strict` in the gate will flag any dead remainder).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/market-research/lib/__tests__/marketScoresHeatmap.prospect.test.ts`
Expected: PASS (3 tests). Also run any existing `marketScoresHeatmap` test file and fix references to deleted helpers if present.

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/market-research/lib/marketScoresHeatmap.ts src/features/market-research/lib/__tests__/marketScoresHeatmap.prospect.test.ts
git add src/features/market-research/lib/marketScoresHeatmap.ts src/features/market-research/lib/__tests__/marketScoresHeatmap.prospect.test.ts
git commit -m "refactor(fe): resolve lead name/company/title/seniority via shared resolver (market-research)"
```

---

### Task 7: FE — Title + Seniority columns in the market-research LeadsTable

Add the two columns (`Lead | Title | Seniority | Company | <scores>`) and fix the empty/loading-row `colSpan`.

**Files:**
- Modify: `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx`
- Test: `frontend/src/features/market-research/components/lead-stream/__tests__/LeadsTable.columns.test.tsx` (new)

**Interfaces:**
- Consumes: `HeatmapLead.title` / `.seniority` (Task 2). `LeadsTable` fetches its own data (`fetchAllOrgLeads`) — the test mocks that to render the empty state.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/market-research/components/lead-stream/__tests__/LeadsTable.columns.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LeadsTable from "../LeadsTable";

import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("../../../services/orgLeads", () => ({ fetchAllOrgLeads: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/signals", () => ({ useSignalLeadMap: () => ({ signalsForLead: () => [] }) }));
vi.mock("@/shared/auth", () => ({ useAuthToken: () => "tok" }));
vi.mock("@/shared/tenant", () => ({ useTenant: () => ({ selectedTenant: { id: "o1" } }) }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("LeadsTable — Title/Seniority columns", () => {
  it("renders Title and Seniority column headers", () => {
    render(
      <TooltipProvider>
        <LeadsTable />
      </TooltipProvider>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Seniority")).toBeInTheDocument();
  });
});
```

> If `LeadsTable` requires props or its hooks differ, mirror the existing lead-stream test in the same folder; the assertion (Title/Seniority headers present) is the contract.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/market-research/components/lead-stream/__tests__/LeadsTable.columns.test.tsx`
Expected: FAIL — no "Title"/"Seniority" headers.

- [ ] **Step 3: Add the two header cells**

In `LeadsTable.tsx`, in the `<TableHeader>`, immediately **after** the `Lead` `<TableHead>` (`…sticky left-0…>Lead</TableHead>`) and **before** the `Company` `<TableHead>`:

```tsx
                <TableHead className="w-[150px] text-xs font-semibold">Title</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold">Seniority</TableHead>
```

- [ ] **Step 4: Add the two body cells**

In the lead-row `<TableRow>`, immediately **after** the `Lead` name `<TableCell>` (the sticky one rendering `{lead.name}` + `<UnverifiedBadge …/>`) and **before** the `Company` `<TableCell>`:

```tsx
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.title || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.seniority || "—"}
                      </TableCell>
```

- [ ] **Step 5: Fix the empty/loading-row colSpan**

Two columns were added, so update **both** literals (around L786 and L802):

```tsx
colSpan={REPORT_COLUMNS.length + 5}   →   colSpan={REPORT_COLUMNS.length + 7}
const colSpan = REPORT_COLUMNS.length + 5;   →   const colSpan = REPORT_COLUMNS.length + 7;
```

(The `<TableCell colSpan={colSpan} …>` near L868 consumes the second literal — no separate edit.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/features/market-research/components/lead-stream/__tests__/LeadsTable.columns.test.tsx`
Expected: PASS.

- [ ] **Step 7: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/market-research/components/lead-stream/LeadsTable.tsx src/features/market-research/components/lead-stream/__tests__/LeadsTable.columns.test.tsx
git add src/features/market-research/components/lead-stream/LeadsTable.tsx src/features/market-research/components/lead-stream/__tests__/LeadsTable.columns.test.tsx
git commit -m "feat(fe): add Title/Seniority columns to market-research LeadsTable"
```

---

### Task 8: FE — customers lead mapper uses the shared resolver

`mapRawLead` resolves name/company/title/seniority via `resolveLeadFields`; `CustomerLead` gains the two fields.

**Files:**
- Modify: `frontend/src/features/customers/contracts.ts`
- Test: `frontend/src/features/customers/__tests__/contracts.prospect.test.ts` (new)

**Interfaces:**
- Consumes: `resolveLeadFields` from `@/shared/lib/leadData`.
- Produces: `CustomerLead` gains `title: string | null; seniority: string | null;`.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/customers/__tests__/contracts.prospect.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { mapRawLead } from "../contracts";

describe("mapRawLead — prospect fields + CSV alias fix", () => {
  it("resolves CSV TitleCase leads (name, company, title, seniority)", () => {
    const lead = mapRawLead({
      lead_id: "l1", Company_Name: "Acme", First_Name: "Jane", Last_Name: "Doe",
      Job_Title: "VP Engineering", Seniority_Level: "CXO",
    } as unknown as Parameters<typeof mapRawLead>[0]);
    expect(lead.name).toBe("Jane Doe");
    expect(lead.company).toBe("Acme");
    expect(lead.title).toBe("VP Engineering");
    expect(lead.seniority).toBe("CXO");
  });

  it("resolves Apollo lowercase leads", () => {
    const lead = mapRawLead({
      lead_id: "l2", company_name: "Globex", name: "Sam Lee", title: "Owner", seniority: "Owner",
    } as unknown as Parameters<typeof mapRawLead>[0]);
    expect(lead.title).toBe("Owner");
    expect(lead.seniority).toBe("Owner");
  });

  it("falls back to — for company and null for title/seniority when absent", () => {
    const lead = mapRawLead({ lead_id: "l3" } as unknown as Parameters<typeof mapRawLead>[0]);
    expect(lead.company).toBe("—");
    expect(lead.title).toBeNull();
    expect(lead.seniority).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/customers/__tests__/contracts.prospect.test.ts`
Expected: FAIL — `Company_Name` doesn't resolve (`mapRawLead` reads only `company_name`/`company`), and `title`/`seniority` don't exist on `CustomerLead`.

- [ ] **Step 3: Widen `CustomerLead` and rewrite `mapRawLead`**

In `frontend/src/features/customers/contracts.ts`, add the import:

```ts
import { resolveLeadFields } from "@/shared/lib/leadData";
```

Add the two fields to the `CustomerLead` interface (after `emailStatus`):

```ts
  title: string | null;
  seniority: string | null;
```

Replace `mapRawLead` with:

```ts
export function mapRawLead(raw: RawLead): CustomerLead {
  const fields = resolveLeadFields(raw as unknown as Record<string, unknown>);
  const company = fields.company || "—";
  return {
    id: raw.lead_id,
    name: fields.name || company,
    company,
    title: fields.title || null,
    seniority: fields.seniority || null,
    source: raw.source ?? null,
    emailStatus: raw.email_status ?? null,
  };
}
```

(`RawLeadSchema` already `.passthrough()`es, so the raw CSV/Apollo keys are present on `raw` at runtime — the cast exposes them to the resolver.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/customers/__tests__/contracts.prospect.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/customers/contracts.ts src/features/customers/__tests__/contracts.prospect.test.ts
git add src/features/customers/contracts.ts src/features/customers/__tests__/contracts.prospect.test.ts
git commit -m "feat(fe): resolve customers lead name/company/title/seniority via shared resolver"
```

---

### Task 9: FE — Title + Seniority columns in the customers LeadStream

Add the two columns (`Name | Title | Seniority | Company | Source | Signals`) and widen the expand-row `colSpan` from 4 to 6.

**Files:**
- Modify: `frontend/src/features/customers/components/lead-stream/LeadStream.tsx`
- Test: `frontend/src/features/customers/components/lead-stream/__tests__/LeadStream.columns.test.tsx` (new)

**Interfaces:**
- Consumes: `CustomerLead.title` / `.seniority` (Task 8).

- [ ] **Step 1: Write the failing test**

`frontend/src/features/customers/components/lead-stream/__tests__/LeadStream.columns.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LeadStreamPanel } from "../LeadStream";

const lead = {
  id: "l1", name: "Jane Doe", company: "Acme", title: "VP Engineering",
  seniority: "CXO", source: null, emailStatus: null,
};

vi.mock("../../../hooks/useLeads", () => ({
  useLeads: () => ({
    data: { pages: [{ items: [lead], total: 1 }] },
    isLoading: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(),
  }),
}));
vi.mock("@/features/signals", () => ({ useSignalLeadMap: () => ({ signalsForLead: () => [] }) }));
vi.mock("@/shared/auth/AuthContext", () => ({ useAuth: () => ({ orgId: "o1" }) }));
vi.mock("@/shared/tenant", () => ({ useTenant: () => ({ selectedTenant: { id: "o1" } }) }));
vi.mock("@/features/connectors", () => ({
  LEAD_SOURCE_OPTIONS: [{ value: "all", label: "All leads" }],
  LeadSourceBadge: () => null,
  filterLeadsBySource: (l: unknown[]) => l,
}));

describe("Customers LeadStream — Title/Seniority columns", () => {
  it("renders Title + Seniority headers and the lead's values", () => {
    render(<LeadStreamPanel orgId="o1" />);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Seniority")).toBeInTheDocument();
    expect(screen.getByText("VP Engineering")).toBeInTheDocument();
    expect(screen.getByText("CXO")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/customers/components/lead-stream/__tests__/LeadStream.columns.test.tsx`
Expected: FAIL — no "Title"/"Seniority" headers or values.

- [ ] **Step 3: Add the two header cells**

In `LeadStream.tsx`, in the `<TableHeader><TableRow>`, after `<TableHead className="text-xs">Name</TableHead>` and before the `Company` head:

```tsx
              <TableHead className="text-xs">Title</TableHead>
              <TableHead className="text-xs">Seniority</TableHead>
```

- [ ] **Step 4: Add the two body cells**

In the lead `<TableRow>`, after the Name `<TableCell>` (`…>{lead.name}</TableCell>`) and before the Company `<TableCell>`:

```tsx
                    <TableCell className="text-sm text-muted-foreground">{lead.title || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.seniority || "—"}</TableCell>
```

- [ ] **Step 5: Widen the expand-row colSpan**

Two columns were added → the expanded-signals row spans 6, not 4:

```tsx
<TableCell colSpan={4} className="bg-muted/30">   →   <TableCell colSpan={6} className="bg-muted/30">
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/features/customers/components/lead-stream/__tests__/LeadStream.columns.test.tsx`
Expected: PASS.

- [ ] **Step 7: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/customers/components/lead-stream/LeadStream.tsx src/features/customers/components/lead-stream/__tests__/LeadStream.columns.test.tsx
git add src/features/customers/components/lead-stream/LeadStream.tsx src/features/customers/components/lead-stream/__tests__/LeadStream.columns.test.tsx
git commit -m "feat(fe): add Title/Seniority columns to customers LeadStream"
```

---

## Final verification (merge gate)

- [ ] **Backend suite**

```bash
backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py -q
```
Expected: all pass.

- [ ] **Frontend serial preflight** (from `frontend/`)

```bash
npm run preflight
```
Expected: typecheck, lint, format:check, vitest, build, bundle, Playwright/VR, knip all green.

- [ ] **Visual regression baselines.** Adding columns to both lead-stream tables changes their rendered appearance, so the Playwright VR step will diff the lead-stream / Scout / Customers surfaces. Inspect the diffs: if they show **only** the new Title/Seniority columns (and the colSpan'd empty rows), regenerate the baselines (`npx playwright test --update-snapshots` for the affected specs) and commit them in a `test(fe): update lead-stream VR baselines for Title/Seniority columns` commit. If any diff shows unrelated drift, stop and investigate — do not blanket-update.

- [ ] **knip.** If `pickCompanyName`/`pickLeadDisplayName`/`pickFirstString` are now unused, `knip --strict` will flag them — delete the dead ones (done in Task 6) so the gate stays green.

## After merge

- **Deploy:** the backend enrichment requires a **Render redeploy from `master`** before the Signals card/PDF show prospects in production. The Lead Stream changes are FE-only and ship with the Vercel FE deploy.
- **Provenance:** commit (or remove before merge) the untracked `docs/reviews/matched-leads-prospect-fields-rca-2026-06-24.md`, the spec review, and the synthesis — untracked review files in the main checkout block a `--no-ff` merge there (cross-sandbox-merge note).
- **TD-FE-73:** if the golden fixture was updated (Task 3), record the progress in `docs/TECH_DEBT.md`; the contract now models the wider live shape.
