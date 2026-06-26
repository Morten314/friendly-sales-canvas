# Matched-Leads CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user saves a Signal artifact (Signal Briefing or GTM Playbook), additionally produce a CSV of the matched-leads table — downloadable at save time and re-downloadable from the Artifacts library — using only already-stored data, at zero Apollo cost.

**Architecture:** Backend widens the existing pure-projection enrichment (`_enrich_matched_leads`) with four contact fields (no new call, no LLM, no credits). Frontend gains a `artefactCsv.ts` module (mirrors `artefactPdf.ts`: blob + anchor download, RFC-4180 + formula-guard + UTF-8 BOM), the artifact builders attach structured `leadRows`, the two Save handlers download the CSV alongside the PDF, and the library card re-downloads it.

**Tech Stack:** Python/FastAPI (`backend/`), React + TypeScript + Vite + Vitest (`frontend/`). No new dependencies on either side.

**Branch:** `artefact-csv-export` (already cut from `master` `8875278`; currently at `daf99f2` with the spec + review + synthesis commits). All task commits land here; merge `--no-ff` after a green `npm run preflight`.

**Spec:** `specs/43-artefact-csv-export-design.md` (review-clean, synthesis round recommendation: no).

## Global Constraints

Every task's requirements implicitly include this section.

- **Zero Apollo cost, no LLM.** The backend change is a pure in-memory dict projection over data already joined for the matched-leads map. It makes **no** call to `/connectors/apollo/enrich`, `people/match`, or `people/bulk_match`, and runs no LLM. (spec §Cost & safety, AC5/AC6.)
- **Backend first, then frontend** (CLAUDE.md polyglot rule). Land Task 1, then build the FE. There is no auto-generated client; confirm the live `/signal-lead-map_claude` response shape with a real call after the backend redeploys (the new contact columns show blank until then — same deploy caveat as Spec 42).
- **Column order is fixed (single source of truth):** `Name,Title,Seniority,Company,Email,Email status,LinkedIn,Phone,Relevance,Why`. (spec §2.)
- **CSV correctness:** RFC-4180 quoting (wrap on `,` `"` CR LF; double embedded `"`), a formula-injection guard (cell starting `=`/`+`/`-`/`@` gets a leading `'`, applied **before** RFC-4180 quoting), `\r\n` row endings, and a leading UTF-8 BOM in the downloaded file. (spec §F1, AC4.)
- **Accepted formula-guard tradeoff (plan review round 1).** On plain-CSV import, some apps render the guard's leading `'` as a literal character (it is *not* Excel's manual-entry text qualifier). The column that triggers this in real data is **Phone**: E.164 numbers (`+1-555-…`) export as `'+1-555-…`. We keep the guard **uniform** (OWASP-standard, matches the spec's settled §F1 decision; per-column exemption would need fuzzy phone-vs-formula detection) and accept the visible `'` as an MVP cosmetic artifact — the number is still readable, the data is self-/vendor-sourced, and there are 0 users. It is pinned by a Phone test in Task 3 so it is intentional, not incidental. Revisit (column-scoped policy or a TAB-prefix) only if a user reports it.
- **Contract style:** the four new lead fields are bare `.optional()` (output `string | undefined`) to match the Spec-42 sibling prospect fields; the `leadToRow` mapper coerces every column with `?? ""` so no `undefined` cell is emitted. (synthesis §Agreed.)
- **Cache stays narrow.** Enrichment is a post-cache projection; the cached mapping must never carry the wide shape. A backend test asserts the new keys are absent from the persisted doc.
- **D-7 spelling:** user-facing copy uses "Artifact"; code/file identifiers keep the existing `Artefact` spelling (`ArtefactItem`, `artefactPdf.ts`, etc.). The new code uses `ArtefactLeadRow` / `artefactCsv.ts` for consistency; the user-facing CSV control label avoids both spellings ("Download leads CSV").
- **Commits:** `type(scope):` subjects, no `[N/M]` suffixes, **no `Co-Authored-By` footer**. Stage only the named files **by path** — never `git add -A` (the working tree is shared). One commit per task.
- **Test commands:** backend `backend/.venv/bin/python -m pytest <path> -q`; frontend single file `npm run test -- <path>` (from `frontend/`); typecheck `npm run typecheck` (never bare `tsc` — the root tsconfig is a no-op stub).

---

### Task 1: Backend — project contact fields onto matched leads

**Files:**
- Modify: `backend/app/services/signals/lead_map.py` (alias tuples after line 100; `_enrich_matched_leads` dict + docstring, lines 136-157)
- Test: `backend/tests/unit/test_signal_lead_map.py` (add one test; extend one existing assertion)

**Interfaces:**
- Consumes: existing `_normalize_lead_keys(lead) -> dict` and `_first_alias(norm, aliases) -> str` (both already in `lead_map.py`); `leads_by_id` (the full stored lead dict, already in scope in `_enrich_matched_leads`).
- Produces: each matched lead object in the `/signal-lead-map_claude` response gains four string keys — `email`, `email_status`, `phone`, `linkedin_url` (blank string when absent). Canonical Apollo keys are `email` / `email_status` / `phone` / `linkedin_url` (confirmed in `app/services/connectors/normalize.py:111-118`).

- [ ] **Step 1: Write the failing test**

Add at the end of `backend/tests/unit/test_signal_lead_map.py`:

```python
def test_enrich_matched_leads_projects_contact_fields():
    """email / email_status / phone / linkedin_url project from the joined full
    lead dict (Apollo canonical keys + CSV TitleCase_underscore aliases); missing
    -> ''; and email_status is blank for CSV-upload leads (no canonical key)."""
    from app.services.signals.lead_map import _enrich_matched_leads
    leads_by_id = {
        # Apollo canonical keys
        "l1": {"lead_id": "l1", "email": "a@x.com", "email_status": "verified",
               "phone": "+1-555", "linkedin_url": "https://li/a"},
        # CSV-upload TitleCase_underscore headers (no email_status equivalent)
        "l2": {"lead_id": "l2", "Email_Id": "b@y.com", "Contact_Number": "555-2",
               "LinkedIn_URL": "https://li/b"},
        # nothing on file
        "l3": {"lead_id": "l3"},
    }
    mapping = [{"signal_id": "s1", "headline": "h", "leads": [
        {"lead_id": "l1", "company": "Acme", "relevance": "high", "why": "x"},
        {"lead_id": "l2", "company": "Globex", "relevance": "low", "why": "y"},
        {"lead_id": "l3", "company": "Z", "relevance": "low", "why": "z"},
    ]}]
    out = _enrich_matched_leads(mapping, leads_by_id)[0]["leads"]
    assert (out[0]["email"], out[0]["email_status"], out[0]["phone"], out[0]["linkedin_url"]) == \
        ("a@x.com", "verified", "+1-555", "https://li/a")
    assert (out[1]["email"], out[1]["phone"], out[1]["linkedin_url"]) == \
        ("b@y.com", "555-2", "https://li/b")
    assert out[1]["email_status"] == ""        # CSV upload -> no canonical email_status
    assert (out[2]["email"], out[2]["email_status"], out[2]["phone"], out[2]["linkedin_url"]) == \
        ("", "", "", "")
    # existing prospect/identity fields still project unchanged
    assert out[0]["company"] == "Acme" and out[0]["relevance"] == "high"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py::test_enrich_matched_leads_projects_contact_fields -q`
Expected: FAIL with `KeyError: 'email'` (the projection does not yet emit the new keys).

- [ ] **Step 3: Add the alias tuples**

In `backend/app/services/signals/lead_map.py`, insert immediately after `_LAST_NAME_ALIASES` (currently line 100):

```python
# Contact fields (Spec 43 CSV export). Same normalized-alias pattern as above:
# keys are normalized (lowercased, non-alphanumerics stripped) before lookup, so
# "Email_Id" -> "emailid", "Contact_Number" -> "contactnumber", "LinkedIn_URL" ->
# "linkedinurl". Apollo leads use canonical keys (email/email_status/phone/
# linkedin_url). email_status has no common CSV equivalent -> canonical key only.
_EMAIL_ALIASES = ("email", "emailid", "emailaddress")
_EMAIL_STATUS_ALIASES = ("emailstatus",)
_PHONE_ALIASES = ("phone", "contactnumber", "phonenumber", "mobile")
_LINKEDIN_ALIASES = ("linkedinurl", "linkedin")
```

- [ ] **Step 4: Project the four fields in `_enrich_matched_leads`**

Replace the `leads_out.append({...})` block (currently lines 150-155):

```python
            leads_out.append({
                **lead,
                "name": _resolve_contact_name(norm),
                "title": _first_alias(norm, _TITLE_ALIASES),
                "seniority": _first_alias(norm, _SENIORITY_ALIASES),
            })
```

with:

```python
            leads_out.append({
                **lead,
                "name": _resolve_contact_name(norm),
                "title": _first_alias(norm, _TITLE_ALIASES),
                "seniority": _first_alias(norm, _SENIORITY_ALIASES),
                "email": _first_alias(norm, _EMAIL_ALIASES),
                "email_status": _first_alias(norm, _EMAIL_STATUS_ALIASES),
                "phone": _first_alias(norm, _PHONE_ALIASES),
                "linkedin_url": _first_alias(norm, _LINKEDIN_ALIASES),
            })
```

And update the `_enrich_matched_leads` docstring's first line (line 139) from
`"""Attach display-only prospect fields (name/title/seniority) to each matched`
to
`"""Attach display-only prospect + contact fields (name/title/seniority/email/`
`email_status/phone/linkedin_url) to each matched`.

- [ ] **Step 5: Run the new test to verify it passes**

Run: `backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py::test_enrich_matched_leads_projects_contact_fields -q`
Expected: PASS.

- [ ] **Step 6: Extend the cache-narrow assertion**

In the existing `test_build_map_enriches_on_cache_miss`, the cache must still store the **narrow** shape. After the three existing `assert "..." not in cached_lead` lines (currently lines 327-329), add:

```python
    assert "email" not in cached_lead
    assert "email_status" not in cached_lead
    assert "phone" not in cached_lead
    assert "linkedin_url" not in cached_lead
```

- [ ] **Step 7: Run the full `lead_map` suite to verify nothing regressed**

Run: `backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py -q`
Expected: all tests PASS (the new test + the extended narrow-shape assertion + all pre-existing tests).

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/signals/lead_map.py backend/tests/unit/test_signal_lead_map.py
git commit -m "feat(be): project contact fields (email/phone/linkedin) onto matched leads"
```

- [ ] **Step 9 (post-deploy, non-gating): live response-shape check (AC6)**

After the backend redeploys to Render, confirm the new keys ride along on a real call (the matched-leads object should now contain `email`/`email_status`/`phone`/`linkedin_url`, blank where unrevealed). Use the deployed `/signal-lead-map_claude` route per the live-probe recipe; this requires a redeploy and does not gate the FE work.

---

### Task 2: Frontend — `ArtefactLeadRow` type + `ArtefactItem.leadRows`

**Files:**
- Modify: `frontend/src/features/artifacts/types.ts`
- Modify: `frontend/src/features/artifacts/index.ts` (barrel — export the new type)

**Interfaces:**
- Produces: `ArtefactLeadRow` (an all-`string` row shape, owned by the `artifacts` feature) and an optional `leadRows?: ArtefactLeadRow[]` on `ArtefactItem`. Consumed by Tasks 3 (CSV builder), 4 (signals builders), and 6 (library card). Exported from `@/features/artifacts`.

This task is type-only; its gate is `npm run typecheck` (no runtime test).

- [ ] **Step 1: Add the row type and the `leadRows` field**

In `frontend/src/features/artifacts/types.ts`, add the interface above `ArtefactItem` and the field at the end of `ArtefactItem` (after the `fullReport` block, before the closing brace):

```ts
// One matched-lead row for the CSV export (Spec 43). All-string so the CSV
// builder never has to coerce; the signals builders map SignalLeadMapLead into
// this via leadToRow (every field `?? ""`). Owned by the artifacts feature so
// there is no cross-feature type coupling.
export interface ArtefactLeadRow {
  name: string;
  title: string;
  seniority: string;
  company: string;
  email: string;
  emailStatus: string;
  linkedin: string;
  phone: string;
  relevance: string;
  why: string;
}
```

Then add inside `ArtefactItem`, immediately after the `fullReport: { ... }` block's closing `};` (currently line 29) and before the interface's closing `}`:

```ts
  // Structured matched-lead rows for CSV export (Spec 43). Optional: older/mock
  // artifacts and 0-lead playbooks won't have it; the library hides the CSV
  // control when it is empty.
  leadRows?: ArtefactLeadRow[];
```

- [ ] **Step 2: Export the type from the barrel**

In `frontend/src/features/artifacts/index.ts`, change:

```ts
export type { ArtefactItem } from "./types";
```

to:

```ts
export type { ArtefactItem, ArtefactLeadRow } from "./types";
```

- [ ] **Step 3: Typecheck**

Run (from `frontend/`): `npm run typecheck`
Expected: PASS (no errors). The additions are purely additive.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/artifacts/types.ts frontend/src/features/artifacts/index.ts
git commit -m "feat(fe): add ArtefactLeadRow type + ArtefactItem.leadRows"
```

---

### Task 3: Frontend — CSV builder + download module (`artefactCsv.ts`)

**Files:**
- Create: `frontend/src/features/artifacts/lib/artefactCsv.ts`
- Modify: `frontend/src/features/artifacts/index.ts` (barrel — export `generateAndDownloadCsv`)
- Test: `frontend/src/features/artifacts/lib/__tests__/artefactCsv.test.ts` (new)

**Interfaces:**
- Consumes: `ArtefactItem`, `ArtefactLeadRow` (Task 2).
- Produces:
  - `buildLeadsCsv(rows: ArtefactLeadRow[]): string` — header + RFC-4180/formula-guarded rows, `\r\n`-separated, **no** BOM.
  - `generateAndDownloadCsv(artefact: ArtefactItem): void` — no-op when `!artefact.leadRows?.length`; otherwise downloads `BOM + buildLeadsCsv(rows)` as `text/csv;charset=utf-8`, filename `${slug}-leads-${Date.now()}.csv`. Consumed by Tasks 5 and 6.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/artifacts/lib/__tests__/artefactCsv.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArtefactItem, ArtefactLeadRow } from "../../types";
import { buildLeadsCsv, generateAndDownloadCsv } from "../artefactCsv";

const HEADER = "Name,Title,Seniority,Company,Email,Email status,LinkedIn,Phone,Relevance,Why";

const row = (over: Partial<ArtefactLeadRow> = {}): ArtefactLeadRow => ({
  name: "Jane Doe",
  title: "VP Engineering",
  seniority: "CXO",
  company: "Acme",
  email: "jane@acme.com",
  emailStatus: "verified",
  linkedin: "https://linkedin.com/in/jane",
  phone: "555-0100", // no leading +/-/=/@ so the happy-path row is unguarded
  relevance: "high",
  why: "ICP match",
  ...over,
});

describe("buildLeadsCsv", () => {
  it("emits the fixed header row in column order", () => {
    expect(buildLeadsCsv([])).toBe(HEADER);
  });

  it("emits one CRLF-separated data row per lead, cells in column order", () => {
    const lines = buildLeadsCsv([row()]).split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe(
      "Jane Doe,VP Engineering,CXO,Acme,jane@acme.com,verified,https://linkedin.com/in/jane,555-0100,high,ICP match",
    );
  });

  it("RFC-4180 quotes cells with comma/quote/newline and doubles embedded quotes", () => {
    const lines = buildLeadsCsv([row({ why: 'He said "go", then left\nnext line' })]).split("\r\n");
    // The embedded LF stays inside the quoted field, so splitting on CRLF still
    // yields exactly header + 1 record.
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('"He said ""go"", then left\nnext line"')).toBe(true);
  });

  it("neutralizes formula-injection cells (leading = + - @) with a leading apostrophe", () => {
    const cells = buildLeadsCsv([
      row({ name: "=1+1", title: "+phone", seniority: "-lead", company: "@handle", why: "safe" }),
    ])
      .split("\r\n")[1]
      .split(",");
    expect(cells[0]).toBe("'=1+1"); // Name
    expect(cells[1]).toBe("'+phone"); // Title
    expect(cells[2]).toBe("'-lead"); // Seniority
    expect(cells[3]).toBe("'@handle"); // Company
    expect(cells[9]).toBe("safe"); // Why — untouched
  });

  it("guards a +E.164 phone too — documented data-fidelity tradeoff (plan review r1)", () => {
    // International phones start with '+', so the formula guard prefixes a '.
    // On plain-CSV import some apps show that apostrophe literally — an accepted
    // MVP artifact (see plan Global Constraints). Pinned here so it's intentional.
    const cells = buildLeadsCsv([row({ phone: "+1-555-0100" })]).split("\r\n")[1].split(",");
    expect(cells[7]).toBe("'+1-555-0100"); // Phone column
  });

  it("renders blank cells for empty fields without writing the literal 'undefined'", () => {
    const dataRow = buildLeadsCsv([
      row({
        name: "",
        title: "",
        seniority: "",
        email: "",
        emailStatus: "",
        linkedin: "",
        phone: "",
        why: "",
      }),
    ]).split("\r\n")[1];
    expect(dataRow).toBe(",,,Acme,,,,,high,");
    expect(dataRow).not.toContain("undefined");
  });
});

describe("generateAndDownloadCsv", () => {
  class FakeBlob {
    static lastParts: unknown[] = [];
    static lastOptions: unknown = undefined;
    constructor(parts: unknown[], options?: unknown) {
      FakeBlob.lastParts = parts;
      FakeBlob.lastOptions = options;
    }
  }
  const createObjectURL = vi.fn(() => "blob:fake-url");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    FakeBlob.lastParts = [];
    FakeBlob.lastOptions = undefined;
    vi.stubGlobal("Blob", FakeBlob);
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    // jsdom's anchor.click() would attempt navigation; suppress it.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const artefact = (leadRows?: ArtefactLeadRow[]): ArtefactItem =>
    ({
      fullReport: {
        title: "Hiring Surge!",
        executiveSummary: "",
        keyFindings: [],
        analysis: "",
        recommendations: [],
      },
      leadRows,
    }) as ArtefactItem;

  it("is a no-op when there are no lead rows", () => {
    generateAndDownloadCsv(artefact(undefined));
    generateAndDownloadCsv(artefact([]));
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("prepends a UTF-8 BOM and uses the text/csv mime type", () => {
    generateAndDownloadCsv(artefact([row()]));
    const content = FakeBlob.lastParts[0] as string;
    expect(content.charCodeAt(0)).toBe(0xfeff); // leading UTF-8 BOM
    expect(content.slice(1)).toContain(HEADER);
    expect(FakeBlob.lastOptions).toEqual({ type: "text/csv;charset=utf-8" });
  });

  it("downloads a slugified *-leads-*.csv file and revokes the object URL", () => {
    const appended: HTMLAnchorElement[] = [];
    vi.spyOn(document.body, "appendChild").mockImplementation(((node: Node) => {
      appended.push(node as HTMLAnchorElement);
      return node;
    }) as typeof document.body.appendChild);
    vi.spyOn(document.body, "removeChild").mockImplementation(
      ((node: Node) => node) as typeof document.body.removeChild,
    );

    generateAndDownloadCsv(artefact([row()]));

    expect(appended).toHaveLength(1);
    expect(appended[0].download).toMatch(/^hiring_surge_-leads-\d+\.csv$/);
    expect(appended[0].href).toContain("blob:fake-url");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npm run test -- src/features/artifacts/lib/__tests__/artefactCsv.test.ts`
Expected: FAIL — the module `../artefactCsv` does not exist yet.

- [ ] **Step 3: Implement the module**

Create `frontend/src/features/artifacts/lib/artefactCsv.ts`:

```ts
import type { ArtefactItem, ArtefactLeadRow } from "../types";

// Single source of truth for the column order (must match the spec §2 schema).
const CSV_HEADERS = [
  "Name",
  "Title",
  "Seniority",
  "Company",
  "Email",
  "Email status",
  "LinkedIn",
  "Phone",
  "Relevance",
  "Why",
] as const;

// Cell order MUST match CSV_HEADERS exactly.
const rowToCells = (r: ArtefactLeadRow): string[] => [
  r.name,
  r.title,
  r.seniority,
  r.company,
  r.email,
  r.emailStatus,
  r.linkedin,
  r.phone,
  r.relevance,
  r.why,
];

// CWE-1236: a cell beginning =, +, -, or @ is evaluated as a formula by Excel/
// Sheets/LibreOffice. Prefix a single quote so it renders as literal text. The
// `Why` text is LLM-generated and Name/Email/Company come from external sources,
// so RFC-4180 quoting alone (below) does NOT prevent this.
// Tradeoff: on plain-CSV import the leading ' is itself visible, so a +E.164
// phone exports as '+1-555... — an accepted MVP artifact (see plan Global
// Constraints), pinned by a Phone test. Kept uniform, not column-exempted.
const guardFormula = (value: string): string => (/^[=+\-@]/.test(value) ? `'${value}` : value);

// RFC-4180: wrap in double quotes when the (already formula-guarded) value
// contains a comma, double-quote, CR or LF; double any embedded double-quote.
const escapeCsvCell = (value: string): string => {
  const guarded = guardFormula(value);
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

/** Header + one CRLF-separated record per row. No BOM (added at download time). */
export const buildLeadsCsv = (rows: ArtefactLeadRow[]): string => {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(rowToCells(r).map(escapeCsvCell).join(","));
  }
  return lines.join("\r\n");
};

// UTF-8 BOM so Excel opens the file as UTF-8 (correct rendering of non-ASCII
// names). CSV is plain text, so it avoids the PDF's Unicode-font limitation
// (TD-FE-78).
const UTF8_BOM = String.fromCharCode(0xfeff); // UTF-8 BOM (U+FEFF)

/** Download the matched-leads CSV for an artefact. No-op when it has no rows. */
export const generateAndDownloadCsv = (artefact: ArtefactItem): void => {
  const rows = artefact.leadRows;
  if (!rows?.length) return;
  const content = UTF8_BOM + buildLeadsCsv(rows);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  // Slug derived from the title exactly like the PDF, plus a `-leads-` marker
  // and a uniquifier so re-saving doesn't overwrite the prior file.
  const slug = artefact.fullReport.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  link.download = `${slug}-leads-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 4: Export `generateAndDownloadCsv` from the barrel**

In `frontend/src/features/artifacts/index.ts`, add below the existing `generateAndDownloadPDF` export line:

```ts
export { generateAndDownloadCsv } from "./lib/artefactCsv";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `frontend/`): `npm run test -- src/features/artifacts/lib/__tests__/artefactCsv.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/artifacts/lib/artefactCsv.ts frontend/src/features/artifacts/lib/__tests__/artefactCsv.test.ts frontend/src/features/artifacts/index.ts
git commit -m "feat(fe): add matched-leads CSV builder + download (artefactCsv)"
```

---

### Task 4: Frontend — builders attach `leadRows` (+ widen lead contract)

**Files:**
- Modify: `frontend/src/features/signals/contracts.ts` (widen `SignalLeadMapLeadSchema`)
- Modify: `frontend/src/features/signals/lib/signalBriefing.ts` (`leadToRow` helper + attach in both builders + import)
- Test: `frontend/src/features/signals/lib/__tests__/signalBriefing.test.ts` (extend)

**Interfaces:**
- Consumes: `ArtefactLeadRow` from `@/features/artifacts` (Task 2); `SignalLeadMapLead` (this feature's contract).
- Produces: `buildSignalBriefingArtefact` and `buildRecommendationPlaybookArtefact` now set `leadRows: ArtefactLeadRow[]` on the returned `ArtefactItem` (one row per lead, every column coerced `?? ""`).

- [ ] **Step 1: Write the failing tests**

In `frontend/src/features/signals/lib/__tests__/signalBriefing.test.ts`, add a new describe block at the end of the file:

```ts
describe("leadRows attachment (Spec 43 CSV export)", () => {
  it("buildSignalBriefingArtefact attaches one leadRow per lead with contact fields mapped", () => {
    const enriched: SignalLeadMapLead[] = [
      {
        lead_id: "l1",
        company: "Acme",
        relevance: "high",
        why: "fit",
        name: "Jane Doe",
        title: "VP Eng",
        seniority: "CXO",
        email: "jane@acme.com",
        email_status: "verified",
        phone: "555-0100",
        linkedin_url: "https://li/jane",
      },
    ];
    const item = buildSignalBriefingArtefact(signal, enriched);
    expect(item.leadRows).toEqual([
      {
        name: "Jane Doe",
        title: "VP Eng",
        seniority: "CXO",
        company: "Acme",
        email: "jane@acme.com",
        emailStatus: "verified",
        linkedin: "https://li/jane",
        phone: "555-0100",
        relevance: "high",
        why: "fit",
      },
    ]);
  });

  it("coerces undefined prospect/contact fields to empty strings (no undefined cells)", () => {
    const bare: SignalLeadMapLead[] = [{ lead_id: "l2", company: "Globex", relevance: "low", why: "" }];
    const item = buildSignalBriefingArtefact(signal, bare);
    expect(item.leadRows).toEqual([
      {
        name: "",
        title: "",
        seniority: "",
        company: "Globex",
        email: "",
        emailStatus: "",
        linkedin: "",
        phone: "",
        relevance: "low",
        why: "",
      },
    ]);
  });

  it("buildRecommendationPlaybookArtefact also attaches leadRows (one per lead)", () => {
    const item = buildRecommendationPlaybookArtefact(
      signal,
      { nba: "X", prompt: "" },
      0,
      "ans",
      leads,
      generated,
    );
    expect(item.leadRows).toHaveLength(leads.length);
    expect(item.leadRows?.[0]).toEqual({
      name: "",
      title: "",
      seniority: "",
      company: "Acme",
      email: "",
      emailStatus: "",
      linkedin: "",
      phone: "",
      relevance: "high",
      why: "ICP match",
    });
  });
});
```

(`signal`, `leads`, and `generated` are the fixtures already defined at the top of this test file.)

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npm run test -- src/features/signals/lib/__tests__/signalBriefing.test.ts`
Expected: FAIL — `item.leadRows` is `undefined` (and, before Step 3, TypeScript would also reject the `email`/`email_status`/`phone`/`linkedin_url` fields on the fixtures).

- [ ] **Step 3: Widen the lead contract**

In `frontend/src/features/signals/contracts.ts`, inside `SignalLeadMapLeadSchema`, add after the `seniority: z.string().optional(),` line (currently line 24):

```ts
  // Contact fields (Spec 43 CSV export). Bare .optional() to match the Spec-42
  // siblings above (output `string | undefined`); leadToRow coerces to "".
  email: z.string().optional(),
  email_status: z.string().optional(),
  phone: z.string().optional(),
  linkedin_url: z.string().optional(),
```

- [ ] **Step 4: Add `leadToRow` and attach `leadRows` in both builders**

In `frontend/src/features/signals/lib/signalBriefing.ts`:

First, extend the artifacts import (currently `import type { ArtefactItem } from "@/features/artifacts";`):

```ts
import type { ArtefactItem, ArtefactLeadRow } from "@/features/artifacts";
```

Then add this helper just below `formatLeadFinding` (after its closing brace, ~line 43):

```ts
/**
 * Map a matched lead into the all-string CSV row. Every column is coerced with
 * `?? ""` so the optional prospect/contact fields (`string | undefined`) never
 * become an `undefined` cell. Used by both artefact builders (Spec 43).
 */
function leadToRow(lead: SignalLeadMapLead): ArtefactLeadRow {
  return {
    name: lead.name ?? "",
    title: lead.title ?? "",
    seniority: lead.seniority ?? "",
    company: lead.company ?? "",
    email: lead.email ?? "",
    emailStatus: lead.email_status ?? "",
    linkedin: lead.linkedin_url ?? "",
    phone: lead.phone ?? "",
    relevance: lead.relevance ?? "",
    why: lead.why ?? "",
  };
}
```

Then, in `buildSignalBriefingArtefact`, add `leadRows` to the returned object. Change the return-object tail (currently lines 73-80):

```ts
    fullReport: {
      title: signal.headline,
      executiveSummary: signal.description,
      keyFindings,
      analysis: `These ${leads.length} leads were matched to the signal based on ICP fit and the signal's context.`,
      recommendations,
    },
  };
```

to add `leadRows` after the `fullReport` block:

```ts
    fullReport: {
      title: signal.headline,
      executiveSummary: signal.description,
      keyFindings,
      analysis: `These ${leads.length} leads were matched to the signal based on ICP fit and the signal's context.`,
      recommendations,
    },
    leadRows: leads.map(leadToRow),
  };
```

Then, in `buildRecommendationPlaybookArtefact`, similarly add `leadRows` after its `fullReport` block (currently ends line 125 with `},`):

```ts
      recommendations: [
        `Explanation: ${answer}`,
        `How to Communicate (${generated.communication_channel}): ${generated.how_to_communicate}`,
        `Communication Template:\n${generated.communication_template}`,
      ],
    },
    leadRows: leads.map(leadToRow),
  };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `frontend/`): `npm run test -- src/features/signals/lib/__tests__/signalBriefing.test.ts`
Expected: PASS — including the pre-existing `formatLeadFinding`/builder tests (the PDF `keyFindings` lines are unchanged).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/signals/contracts.ts frontend/src/features/signals/lib/signalBriefing.ts frontend/src/features/signals/lib/__tests__/signalBriefing.test.ts
git commit -m "feat(fe): attach leadRows to signal/playbook artefacts + widen lead contract"
```

---

### Task 5: Frontend — download CSV alongside PDF on Save

**Files:**
- Modify: `frontend/src/features/signals/pages/SignalsPage.tsx` (import + both save handlers)
- Test: `frontend/src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx` (mock + assert briefing path)
- Test: `frontend/src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx` (mock + assert playbook path)
- Test: `frontend/src/features/signals/pages/__tests__/SignalsPage.orgScope.test.tsx` (mock only — defensive, no assert)

**Interfaces:**
- Consumes: `generateAndDownloadCsv` from `@/features/artifacts` (Task 3 barrel export); `item` / `artefact` (the `ArtefactItem` built in each handler, now carrying `leadRows` from Task 4).
- Produces: each Save handler downloads the CSV in addition to the PDF and enqueue.

> All three SignalsPage test files mock `@/features/artifacts` with exactly:
> ```ts
> vi.mock("@/features/artifacts", () => ({
>   enqueueArtefact: vi.fn(),
>   generateAndDownloadPDF: vi.fn(),
> }));
> ```
> Once SignalsPage calls `generateAndDownloadCsv`, the un-mocked named import resolves to `undefined` and the save path throws. **Every file that mocks this barrel and can reach a save handler must add `generateAndDownloadCsv: vi.fn(),`** — write the test changes (Steps 1-2) before the source change (Step 4) so the failure is observed first.

- [ ] **Step 1: Update the briefing-path test (cta) — mock + assertion**

In `frontend/src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx`:

Change the import (line 10):

```ts
import { enqueueArtefact, generateAndDownloadPDF } from "@/features/artifacts";
```

to:

```ts
import { enqueueArtefact, generateAndDownloadCsv, generateAndDownloadPDF } from "@/features/artifacts";
```

Change the mock factory (lines 72-75):

```ts
vi.mock("@/features/artifacts", () => ({
  enqueueArtefact: vi.fn(),
  generateAndDownloadPDF: vi.fn(),
}));
```

to:

```ts
vi.mock("@/features/artifacts", () => ({
  enqueueArtefact: vi.fn(),
  generateAndDownloadPDF: vi.fn(),
  generateAndDownloadCsv: vi.fn(),
}));
```

In the test `"builds, downloads, and enqueues the briefing on Save (no forced nav)"`, after the existing `expect(enqueueArtefact).toHaveBeenCalledTimes(1);` (line 122), add:

```ts
    expect(generateAndDownloadCsv).toHaveBeenCalledTimes(1);
    // The CSV is built from the same item as the PDF.
    expect(vi.mocked(generateAndDownloadCsv).mock.calls[0][0].id).toBe(item.id);
```

- [ ] **Step 2: Update the playbook-path test (recommendation) — mock + assertion**

In `frontend/src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx`:

Change the import (line 10) to add `generateAndDownloadCsv` (same form as Step 1), and add `generateAndDownloadCsv: vi.fn(),` to the `vi.mock("@/features/artifacts", ...)` factory (lines 75-78, same form as Step 1).

In the test `"builds, downloads, and enqueues a playbook on Save"`, after the existing `expect(enqueueArtefact).toHaveBeenCalledTimes(1);` (line 115), add:

```ts
    expect(generateAndDownloadCsv).toHaveBeenCalledTimes(1);
```

- [ ] **Step 3: Update the orgScope test — mock only (defensive)**

In `frontend/src/features/signals/pages/__tests__/SignalsPage.orgScope.test.tsx`, add `generateAndDownloadCsv: vi.fn(),` to the `vi.mock("@/features/artifacts", ...)` factory (same line as the existing `generateAndDownloadPDF: vi.fn(),`). No import or assertion change — this only prevents a latent `undefined` import if the suite ever reaches a save handler.

- [ ] **Step 4: Run the three SignalsPage suites to verify the new assertions fail**

Run (from `frontend/`):
`npm run test -- src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx`
Expected: the two new `generateAndDownloadCsv` assertions FAIL (`expected "spy" to be called 1 times, but got 0 times`) — SignalsPage does not call it yet.

- [ ] **Step 5: Call `generateAndDownloadCsv` in both handlers**

In `frontend/src/features/signals/pages/SignalsPage.tsx`:

Change the import (line 30):

```ts
import { enqueueArtefact, generateAndDownloadPDF } from "@/features/artifacts";
```

to:

```ts
import { enqueueArtefact, generateAndDownloadCsv, generateAndDownloadPDF } from "@/features/artifacts";
```

In `handleSaveAsArtefact`, after `generateAndDownloadPDF(item);` (line 568), add:

```ts
    generateAndDownloadCsv(item);
```

In `handleSaveRecommendationAsArtefact`, after `generateAndDownloadPDF(artefact);` (line 624), add:

```ts
      generateAndDownloadCsv(artefact);
```

- [ ] **Step 6: Run the three SignalsPage suites to verify they pass**

Run (from `frontend/`):
`npm run test -- src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx src/features/signals/pages/__tests__/SignalsPage.orgScope.test.tsx`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/signals/pages/SignalsPage.tsx frontend/src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx frontend/src/features/signals/pages/__tests__/SignalsPage.recommendation.test.tsx frontend/src/features/signals/pages/__tests__/SignalsPage.orgScope.test.tsx
git commit -m "feat(fe): download CSV alongside PDF on Save as Artifact"
```

---

### Task 6: Frontend — re-download CSV from the Artifacts library

**Files:**
- Modify: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx` (import + `handleDownloadCsv` + prop wiring)
- Modify: `frontend/src/features/artifacts/components/LibraryCard.tsx` (prop + CSV control + icon import)
- Test: `frontend/src/features/artifacts/components/__tests__/LibraryCard.test.tsx` (new)

**Interfaces:**
- Consumes: `generateAndDownloadCsv` from `../lib/artefactCsv` (Task 3); `ArtefactItem` / `ArtefactLeadRow` (Task 2).
- Produces: `LibraryCard` gains a required `onDownloadCsv: (artefact: ArtefactItem) => void` prop and renders a "Download leads CSV (N)" control in its expanded view **only when** `artefact.leadRows?.length`. `ArtifactsPage` supplies `handleDownloadCsv`, which marks `new → viewed` (like the PDF path) and calls `generateAndDownloadCsv`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/artifacts/components/__tests__/LibraryCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { Satellite } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArtefactItem, ArtefactLeadRow } from "../../types";
import { LibraryCard } from "../LibraryCard";

const leadRow: ArtefactLeadRow = {
  name: "Jane Doe",
  title: "VP",
  seniority: "CXO",
  company: "Acme",
  email: "jane@acme.com",
  emailStatus: "verified",
  linkedin: "https://li/jane",
  phone: "555-0100",
  relevance: "high",
  why: "fit",
};

const baseArtefact = (over: Partial<ArtefactItem> = {}): ArtefactItem => ({
  id: "a1",
  agentName: "Scout",
  agentIcon: Satellite,
  agentColor: "bg-blue-500",
  taskNumber: "Signal Briefing",
  timestamp: "1h ago",
  status: "new",
  type: "report",
  folder: "Signal Briefings",
  actionDelegated: "Find matched leads",
  contextRationale: "ctx",
  systemImpact: "impact",
  actionPerformed: "performed",
  outputSummary: "summary",
  fullReport: {
    title: "Hiring surge",
    executiveSummary: "summary",
    keyFindings: [],
    analysis: "analysis",
    recommendations: [],
  },
  ...over,
});

// expandedArtefact === id so the expanded panel (which holds the CSV control) renders.
function renderCard(artefact: ArtefactItem, onDownloadCsv = vi.fn()) {
  render(
    <LibraryCard
      artefact={artefact}
      expandedArtefact={artefact.id}
      editingArtefact={null}
      editName=""
      onArtefactClick={vi.fn()}
      onEditClick={vi.fn()}
      onDeleteClick={vi.fn()}
      onSaveEdit={vi.fn()}
      onCancelEdit={vi.fn()}
      onDownloadClick={vi.fn()}
      onDownloadCsv={onDownloadCsv}
      onEditNameChange={vi.fn()}
    />,
  );
  return onDownloadCsv;
}

afterEach(() => vi.clearAllMocks());

describe("LibraryCard CSV control", () => {
  it("renders the CSV download control when the artefact has lead rows", () => {
    renderCard(baseArtefact({ leadRows: [leadRow] }));
    expect(screen.getByRole("button", { name: /Download leads CSV/i })).toBeInTheDocument();
  });

  it("hides the CSV control when leadRows is an empty array", () => {
    renderCard(baseArtefact({ leadRows: [] }));
    expect(screen.queryByRole("button", { name: /Download leads CSV/i })).toBeNull();
  });

  it("hides the CSV control when leadRows is undefined", () => {
    renderCard(baseArtefact({ leadRows: undefined }));
    expect(screen.queryByRole("button", { name: /Download leads CSV/i })).toBeNull();
  });

  it("calls onDownloadCsv with the artefact when clicked", () => {
    const artefact = baseArtefact({ leadRows: [leadRow] });
    const onDownloadCsv = renderCard(artefact);
    fireEvent.click(screen.getByRole("button", { name: /Download leads CSV/i }));
    expect(onDownloadCsv).toHaveBeenCalledTimes(1);
    expect(onDownloadCsv).toHaveBeenCalledWith(artefact);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npm run test -- src/features/artifacts/components/__tests__/LibraryCard.test.tsx`
Expected: FAIL — TypeScript/render error (`onDownloadCsv` is not a prop of `LibraryCard`) and no "Download leads CSV" control.

- [ ] **Step 3: Add the prop + CSV control to `LibraryCard`**

In `frontend/src/features/artifacts/components/LibraryCard.tsx`:

Add `Download` to the lucide import (line 1), keeping it alphabetical:

```ts
import { CheckCircle, Clock, Download, Edit, FileText, Lightbulb, Trash2 } from "lucide-react";
```

Add the prop to `LibraryCardProps` (after `onDownloadClick`, line 22):

```ts
  onDownloadCsv: (artefact: ArtefactItem) => void;
```

Destructure it in the component signature (after `onDownloadClick,`, line 37):

```ts
  onDownloadCsv,
```

In the expanded "Action Performed" file preview, add the CSV control inside the `<div className="flex-1 min-w-0">`, immediately after the `<div className="flex items-center gap-2 text-xs text-muted-foreground">...</div>` meta block that ends on line 173 (i.e. after its closing `</div>`, still inside `flex-1 min-w-0`):

```tsx
                    {artefact.leadRows && artefact.leadRows.length > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadCsv(artefact);
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        Download leads CSV ({artefact.leadRows.length})
                      </button>
                    ) : null}
```

- [ ] **Step 4: Wire `handleDownloadCsv` in `ArtifactsPage`**

In `frontend/src/features/artifacts/pages/ArtifactsPage.tsx`:

Add the import below the existing `artefactPdf` import (line 8):

```ts
import { generateAndDownloadCsv } from "../lib/artefactCsv";
```

Add the handler right after `handleDownloadClick` (after its closing brace, line 131):

```tsx
  const handleDownloadCsv = (artefact: ArtefactItem) => {
    // Mark as viewed if it was new (mirrors the PDF download).
    if (artefact.status === "new") {
      setArtefacts((prev) =>
        prev.map((a) => (a.id === artefact.id ? { ...a, status: "viewed" as const } : a)),
      );
    }
    generateAndDownloadCsv(artefact);
  };
```

Pass it to `LibraryCard` — add after `onDownloadClick={handleDownloadClick}` (line 180):

```tsx
                onDownloadCsv={handleDownloadCsv}
```

- [ ] **Step 5: Run the LibraryCard tests to verify they pass**

Run (from `frontend/`): `npm run test -- src/features/artifacts/components/__tests__/LibraryCard.test.tsx`
Expected: PASS (all four cases).

- [ ] **Step 6: Run the existing ArtifactsPage suite to confirm no regression**

Run (from `frontend/`): `npm run test -- src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx`
Expected: PASS — its briefing fixture has no `leadRows`, so the CSV control is hidden and no existing assertion changes; `ArtifactsPage` now supplies the required `onDownloadCsv` prop.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/artifacts/pages/ArtifactsPage.tsx frontend/src/features/artifacts/components/LibraryCard.tsx frontend/src/features/artifacts/components/__tests__/LibraryCard.test.tsx
git commit -m "feat(fe): re-download matched-leads CSV from the Artifacts library"
```

---

## Final verification & merge (controller-run, not a TDD task)

- [ ] **Backend regression:** `backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py -q` → all PASS.
- [ ] **Frontend gate:** from `frontend/`, run `npm run preflight` (serial — typecheck, lint, format:check, full vitest, build, bundle:check, e2e + visual regression, knip). Expected: green. If `format:check` flags the new files, run `npx prettier --write` on them and amend the relevant commit.
- [ ] **Live shape (AC6, post-deploy):** after the backend redeploys, confirm a real `/signal-lead-map_claude` response carries `email`/`email_status`/`phone`/`linkedin_url` on the matched leads (blank where unrevealed). Until then the Signals-path CSV shows blank contact columns — expected (spec §Risks).
- [ ] **Merge:** `git checkout master && git merge --no-ff artefact-csv-export && git push origin master`; delete the branch. (Per CLAUDE.md; only after a green preflight.)

## Spec coverage (self-review)

| Spec acceptance criterion | Task(s) |
|---|---|
| AC1 — Save downloads a `.csv` with the fixed header + one row per lead | 3 (builder/header), 4 (rows), 5 (download on save) |
| AC2 — contact fields populated where present, blank where not; rows kept | 1 (projection), 4 (`leadToRow` coercion) |
| AC3 — library exposes a CSV re-download; hidden when no leads | 6 |
| AC4 — RFC-4180 quoting + formula-injection guard + UTF-8 BOM + non-ASCII | 3 |
| AC5 — no Apollo credits / no LLM / enrich never called | 1 (pure projection; no new call) |
| AC6 — backend carries the 4 fields via pure projection; unit + live check | 1 |

**Placeholder scan:** none — every code/test step contains complete content.
**Type consistency:** `ArtefactLeadRow` (camelCase `emailStatus`/`linkedin`) is defined once in Task 2 and used identically in Tasks 3/4/6; `leadToRow` maps the snake_case contract fields (`email_status`→`emailStatus`, `linkedin_url`→`linkedin`) consistently; `generateAndDownloadCsv` / `buildLeadsCsv` signatures match across producer (Task 3) and consumers (Tasks 5/6).
