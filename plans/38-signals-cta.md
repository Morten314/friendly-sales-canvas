# Signals CTA: Find Matched Leads → Save Briefing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gated `[Find Matched Leads]` control to expanded Signal cards that reveals matched leads and lets the user save a one-page briefing — downloaded as a PDF and reliably delivered into the Artefacts library — without leaving the Signals feed.

**Architecture:** Frontend-only. The signal→lead map is already fetched by `useSignalLeadMap` (live backend, no backend work). The card grows a four-state leads section; the page builds an `ArtefactItem`, downloads a PDF, and hands the item to the Artefacts library through a **module-level pending-artefact queue** (not the broken Strategist dispatch-then-navigate pattern). `ArtifactsPage` drains the queue on mount, mirroring its existing `addArtefact` listener (prepend + open folder + expand) so the foldered briefing is visible through the root folder filter.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, zod, Vitest + Testing Library, MSW. shadcn-ui primitives. lucide-react icons.

## Global Constraints

- **Feature boundaries via barrels only.** Cross-feature imports go through a feature's `index.ts` (enforced by `import-x` no-internal-modules). The signals feature imports `enqueueArtefact`, `resetArtefactQueue`, `generateAndDownloadPDF`, and the `ArtefactItem` type **only** from `@/features/artifacts` — never deep-imports `lib/artefactPdf` or `types.ts`.
- **No backend change.** `/signal-lead-map_claude` is already live in production.
- **Degrade-never-throw contract.** Keep `.default("")` on `company`/`why` and `.catch("low")` on `relevance` in `SignalLeadMapResponseSchema`. The feature depends on these guards. Do **not** apply `.strict()` to any shape where the backend sends FE-ignored extras.
- **Lowercase relevance from the API, title-cased only at render.** The map returns `high|medium|low`; never write the lowercase value into user-visible copy.
- **The per-lead `why` is never rendered on screen** — it rides only into the exported PDF (`fullReport.keyFindings`).
- **No forced navigation on save.** Confirm with a toast linking to `/artifacts`; the user stays on the feed.
- **Commit style:** `type(scope):` subjects (`feat(fe):`, `test(fe):`, `docs:`), small frequent commits (one per task). **No `Co-Authored-By` footer.**
- **Per-task verification:** `npm run typecheck` (the npm script — never bare `npx tsc`, the root tsconfig is a no-op stub), `npx vitest run <file>` for the task's tests, and `npx prettier --write <touched files>` (the per-task `npm run verify` omits `format:check`). The full `npm run preflight` is the serial merge gate.
- **All `npm`/`vitest`/`prettier` commands run from `frontend/`.**

---

### Task 1: Artefact delivery queue + barrel exports

A module-level FIFO queue that lets `SignalsPage` (mounted on `/signals`) hand an `ArtefactItem` to `ArtifactsPage` (mounted later on `/artifacts`). This replaces the broken `window`-event dispatch-then-navigate pattern, which fires into the void because no listener is mounted at dispatch time.

**Files:**
- Create: `frontend/src/features/artifacts/lib/artefactQueue.ts`
- Modify: `frontend/src/features/artifacts/index.ts`
- Test: `frontend/src/features/artifacts/lib/__tests__/artefactQueue.test.ts`

**Interfaces:**
- Consumes: `ArtefactItem` type from `../types`.
- Produces:
  - `enqueueArtefact(item: ArtefactItem): void`
  - `drainArtefactQueue(): ArtefactItem[]` — returns queued items in enqueue order and clears the queue (once-only).
  - `resetArtefactQueue(): void` — test-only reset.
  - Barrel (`@/features/artifacts`) now also re-exports: `enqueueArtefact`, `resetArtefactQueue`, `generateAndDownloadPDF`, and the `ArtefactItem` type.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/artifacts/lib/__tests__/artefactQueue.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import type { ArtefactItem } from "../../types";
import { drainArtefactQueue, enqueueArtefact, resetArtefactQueue } from "../artefactQueue";

const item = (id: string): ArtefactItem =>
  ({ id, fullReport: { title: id } }) as unknown as ArtefactItem;

describe("artefactQueue", () => {
  beforeEach(() => resetArtefactQueue());

  it("drains queued items in enqueue order, then is empty (once-only)", () => {
    enqueueArtefact(item("a"));
    enqueueArtefact(item("b"));
    expect(drainArtefactQueue().map((i) => i.id)).toEqual(["a", "b"]);
    expect(drainArtefactQueue()).toEqual([]);
  });

  it("resetArtefactQueue clears pending items", () => {
    enqueueArtefact(item("a"));
    resetArtefactQueue();
    expect(drainArtefactQueue()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/artifacts/lib/__tests__/artefactQueue.test.ts`
Expected: FAIL — cannot resolve `../artefactQueue`.

- [ ] **Step 3: Create the queue module**

`frontend/src/features/artifacts/lib/artefactQueue.ts`:

```ts
import type { ArtefactItem } from "../types";

// Module-level hand-off so a dispatcher mounted on one page (e.g. SignalsPage on
// /signals) can deliver an ArtefactItem to ArtifactsPage, which mounts later on
// /artifacts and drains this queue once on mount. Unlike a window CustomEvent,
// this survives the dispatcher and listener not being co-mounted.
let pending: ArtefactItem[] = [];

export function enqueueArtefact(item: ArtefactItem): void {
  pending.push(item);
}

/** Returns queued items in enqueue order and clears the queue (once-only). */
export function drainArtefactQueue(): ArtefactItem[] {
  const items = pending;
  pending = [];
  return items;
}

/** Test-only: clear the module-singleton between tests. */
export function resetArtefactQueue(): void {
  pending = [];
}
```

- [ ] **Step 4: Re-export the public symbols through the barrel**

`frontend/src/features/artifacts/index.ts` (replace the whole file):

```ts
// Public surface for the `artifacts` feature. Composed by src/app/routes.tsx.
export { artifactsRoutes } from "./routes";

// Delivery + export surface consumed by the signals feature (Spec/Plan 38).
export { enqueueArtefact, resetArtefactQueue } from "./lib/artefactQueue";
export { generateAndDownloadPDF } from "./lib/artefactPdf";
export type { ArtefactItem } from "./types";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/features/artifacts/lib/__tests__/artefactQueue.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/artifacts/lib/artefactQueue.ts src/features/artifacts/index.ts src/features/artifacts/lib/__tests__/artefactQueue.test.ts
git add src/features/artifacts/lib/artefactQueue.ts src/features/artifacts/index.ts src/features/artifacts/lib/__tests__/artefactQueue.test.ts
git commit -m "feat(fe): add module-level artefact delivery queue + barrel exports"
```

---

### Task 2: ArtifactsPage drains the queue on mount

`ArtifactsPage` already prepends + opens the folder + expands the item in its live `addArtefact` listener. Add a mount-time drain that does the same for queued items. The folder step is **load-bearing**: `filteredArtefacts` hides foldered items (`folder: "Signal Briefings"`) at the root view, so a bare prepend would land the briefing in state but filter it out of the rendered list.

**Files:**
- Modify: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx`
- Test: `frontend/src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx`

**Interfaces:**
- Consumes: `drainArtefactQueue()` from `../lib/artefactQueue`; `enqueueArtefact`/`resetArtefactQueue` (in tests).
- Produces: no new exported symbols; behavioral change only (queued items become visible on mount).

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import { Satellite } from "lucide-react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetArtefactQueue } from "../../lib/artefactQueue";
import type { ArtefactItem } from "../../types";
import ArtifactsPage from "../ArtifactsPage";

import { enqueueArtefact } from "@/features/artifacts";

vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const briefing: ArtefactItem = {
  id: "signal-briefing-s1-123",
  agentName: "Scout",
  agentIcon: Satellite,
  agentColor: "bg-blue-500",
  taskNumber: "Signal Briefing",
  timestamp: "1h ago",
  status: "new",
  type: "report",
  folder: "Signal Briefings",
  actionDelegated: 'Find matched leads for "Hiring surge"',
  contextRationale: "snippet",
  systemImpact: "2 matched lead(s) identified",
  actionPerformed: "Mapped accepted signal to matched leads",
  outputSummary: "2 matched leads with relevance and rationale",
  fullReport: {
    title: "Hiring surge",
    executiveSummary: "summary",
    keyFindings: [],
    analysis: "analysis",
    recommendations: [],
  },
};

describe("ArtifactsPage queue delivery", () => {
  beforeEach(() => resetArtefactQueue());
  afterEach(() => resetArtefactQueue());

  it("mounts and sets the Artefacts page title", () => {
    const { container } = render(<ArtifactsPage />);
    expect(container).not.toBeEmptyDOMElement();
    expect(document.title).toBe("Artefacts - Brewra");
  });

  it("makes a queued foldered briefing visible through the root folder filter", () => {
    enqueueArtefact(briefing);
    render(<ArtifactsPage />);
    // Visible in the rendered DOM (not merely in the artefacts array): the drain
    // must open "Signal Briefings" so the foldered item passes filteredArtefacts.
    expect(screen.getByText('Find matched leads for "Hiring surge"')).toBeInTheDocument();
  });

  it("drains once-only — a remount does not re-deliver/duplicate the briefing", () => {
    enqueueArtefact(briefing);
    const first = render(<ArtifactsPage />);
    expect(first.getAllByText('Find matched leads for "Hiring surge"')).toHaveLength(1);
    first.unmount();

    const second = render(<ArtifactsPage />);
    // Queue already drained on the first mount → the briefing is gone, not duplicated.
    expect(second.queryByText('Find matched leads for "Hiring surge"')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx`
Expected: FAIL — the briefing is not visible (no drain yet); the once-only test also fails.

- [ ] **Step 3: Add the drain-on-mount effect**

In `frontend/src/features/artifacts/pages/ArtifactsPage.tsx`, add the import near the other `../lib` import:

```tsx
import { drainArtefactQueue } from "../lib/artefactQueue";
```

Then add this effect immediately **after** the existing `addArtefact` listener effect (after its closing `}, []);` near line 52):

```tsx
  // Drain any artefacts enqueued before this page mounted (e.g. a Signal
  // Briefing saved from /signals). Mirrors the live addArtefact listener:
  // prepend, open the item's folder, and expand it — the folder step is
  // load-bearing because filteredArtefacts hides foldered items at the root.
  // Once-only: drainArtefactQueue() clears the queue, so a remount sees nothing.
  useEffect(() => {
    const queued = drainArtefactQueue();
    if (queued.length === 0) return;
    // Reverse so the most-recently-enqueued item ends up first, matching the
    // per-event prepend semantics of the live listener.
    setArtefacts((prev) => [...queued.slice().reverse(), ...prev]);
    const mostRecent = queued[queued.length - 1];
    if (mostRecent.folder) {
      setActiveFolder(mostRecent.folder);
    }
    setExpandedArtefact(mostRecent.id);
  }, []);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/artifacts/pages/ArtifactsPage.tsx src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx
git add src/features/artifacts/pages/ArtifactsPage.tsx src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx
git commit -m "feat(fe): drain pending-artefact queue on ArtifactsPage mount"
```

---

### Task 3: Harden the PDF generator against LLM free-text

`createSimplePDF` interpolates content raw into `( … ) Tj` string literals (no escaping) and writes into Helvetica/WinAnsi (no encoding handling). The briefing's `title`, `executiveSummary`, per-lead `keyFindings`, `analysis`, and `recommendations` are LLM free-text. Escape PDF structural breakers and fold common typographic offenders to ASCII. Also add a uniquifying suffix to the download filename so re-saving the same signal doesn't silently overwrite the prior file.

> Deeper generator issues (hardcoded `/Length`, placeholder xref, single-page `MediaBox`, residual non-ASCII like accented names) are **out of scope** — recorded as a new TD in Task 9.

**Files:**
- Modify: `frontend/src/features/artifacts/lib/artefactPdf.ts`
- Test: `frontend/src/features/artifacts/lib/__tests__/artefactPdf.test.ts`

**Interfaces:**
- Consumes: `ArtefactItem` from `../types`.
- Produces: `escapePdfText(input: string): string` (exported for tests); `createSimplePDF` and `generateAndDownloadPDF` signatures unchanged.

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/features/artifacts/lib/__tests__/artefactPdf.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { mockArtefacts } from "../../data/mockArtefacts";
import { createSimplePDF, escapePdfText } from "../artefactPdf";

describe("escapePdfText", () => {
  it("escapes PDF structural breakers", () => {
    expect(escapePdfText("a (b) c")).toBe("a \\(b\\) c");
    expect(escapePdfText("back\\slash")).toBe("back\\\\slash");
    expect(escapePdfText("smile :)")).toBe("smile :\\)");
  });

  it("folds common typographic offenders to ASCII", () => {
    expect(escapePdfText("A—B")).toBe("A-B"); // em dash
    expect(escapePdfText("A–B")).toBe("A-B"); // en dash
    expect(escapePdfText("“quoted”")).toBe('"quoted"'); // smart double quotes
    expect(escapePdfText("it’s")).toBe("it's"); // smart apostrophe
    expect(escapePdfText("• item")).toBe("- item"); // bullet
  });
});

describe("createSimplePDF", () => {
  it("returns a non-trivial PDF document string", () => {
    const pdf = createSimplePDF(mockArtefacts[0]);
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect(pdf.length).toBeGreaterThan(100);
  });

  it("keeps parentheses balanced/escaped for free-text inputs", () => {
    const artefact = {
      ...mockArtefacts[0],
      fullReport: {
        ...mockArtefacts[0].fullReport,
        title: "Acme (Pilot) \\ rollout :)",
        keyFindings: ["Lead (A) — strong fit"],
      },
    };
    const pdf = createSimplePDF(artefact);
    // No raw unescaped backslash or smart dash survives into the content stream.
    expect(pdf).toContain("Acme \\(Pilot\\) \\\\ rollout :\\)");
    expect(pdf).toContain("Lead \\(A\\) - strong fit");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/artifacts/lib/__tests__/artefactPdf.test.ts`
Expected: FAIL — `escapePdfText` is not exported; the escaping assertions fail.

- [ ] **Step 3: Add `escapePdfText` and apply it**

In `frontend/src/features/artifacts/lib/artefactPdf.ts`, add at the top (after the import):

```ts
// LLM free-text rides into the PDF content stream. Two classes of breakage:
//   structural — an unbalanced ( ) or a \ corrupts the PDF;
//   encoding   — em/en-dashes, smart quotes, and bullets mojibake under
//                Helvetica/WinAnsi even after structural escaping.
// Fold the common offenders to ASCII, then escape the structural characters.
// (Residual non-ASCII such as accented names is an accepted limitation — see TD.)
export const escapePdfText = (input: string): string =>
  (input ?? "")
    .replace(/[–—]/g, "-") // en/em dash → hyphen
    .replace(/[‘’]/g, "'") // smart single quotes → '
    .replace(/[“”]/g, '"') // smart double quotes → "
    .replace(/•/g, "-") // bullet → hyphen
    .replace(/\\/g, "\\\\") // escape backslash FIRST
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
```

Then update `createSimplePDF` to route every interpolated field through `escapePdfText`. Replace the field-capture block (lines ~4–12) with:

```ts
  const title = escapePdfText(artefact.fullReport.title);
  const agentName = escapePdfText(artefact.agentName);
  const timestamp = escapePdfText(artefact.timestamp);
  const taskId = escapePdfText(artefact.taskNumber);
  const executiveSummary = escapePdfText(artefact.fullReport.executiveSummary);
  const keyFindings = artefact.fullReport.keyFindings.map(escapePdfText);
  const analysis = escapePdfText(artefact.fullReport.analysis);
  const recommendations = artefact.fullReport.recommendations.map(escapePdfText);
  const date = new Date().toLocaleDateString();
```

(The `keyFindings.map(...)` / `recommendations.map(...)` lines in the stream now iterate over already-escaped strings — no further change needed there.)

- [ ] **Step 4: Add a uniquifying suffix to the download filename**

In `generateAndDownloadPDF`, replace the `link.download = ...` line with:

```ts
  const slug = artefact.fullReport.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  // Short uniquifier so re-saving the same signal doesn't overwrite the prior file.
  link.download = `${slug}-${Date.now()}.pdf`;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/artifacts/lib/__tests__/artefactPdf.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/artifacts/lib/artefactPdf.ts src/features/artifacts/lib/__tests__/artefactPdf.test.ts
git add src/features/artifacts/lib/artefactPdf.ts src/features/artifacts/lib/__tests__/artefactPdf.test.ts
git commit -m "feat(fe): escape + ASCII-fold free-text in PDF generator; uniquify filename"
```

---

### Task 4: Signal briefing builder + agent presentation resolver

A pure module in the signals feature that maps a signal + matched leads to one `ArtefactItem`. This carries the bulk of the §5 "ArtefactItem mapping" table and is fully unit-testable without rendering. The agent→icon/color values mirror `mockArtefacts.ts` via a small **feature-local** resolver (we do not cross-import artefacts internals; the barrel boundary stands).

**Files:**
- Create: `frontend/src/features/signals/lib/signalBriefing.ts`
- Test: `frontend/src/features/signals/lib/__tests__/signalBriefing.test.ts`

**Interfaces:**
- Consumes: `SignalCard` type from `../types`; `SignalLeadMapLead` from `../contracts`; `ArtefactItem` type from `@/features/artifacts`.
- Produces:
  - `resolveSignalAgentPresentation(agent: "scout" | "profiler"): { agentName: string; agentIcon: ComponentType<{ className?: string }>; agentColor: string }`
  - `buildSignalBriefingArtefact(signal: SignalCard, leads: SignalLeadMapLead[]): ArtefactItem`

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/signals/lib/__tests__/signalBriefing.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { SignalLeadMapLead } from "../../contracts";
import type { SignalCard } from "../../types";
import { buildSignalBriefingArtefact, resolveSignalAgentPresentation } from "../signalBriefing";

const signal: SignalCard = {
  id: "s1",
  agent: "scout",
  timestamp: "1h ago",
  headline: "Hiring surge",
  snippet: "Likely to impact your ICP accounts.",
  description: "Detailed ICP context paragraph.",
  sourceUrl: "#",
  sourceLabel: "Press",
  nextBestMoves: ["Reach out now"],
  contextualSuggestions: [],
};

const leads: SignalLeadMapLead[] = [
  { lead_id: "l1", company: "Acme", relevance: "high", why: "ICP match" },
  { lead_id: "l2", company: "", relevance: "low", why: "" },
];

describe("resolveSignalAgentPresentation", () => {
  it("maps scout to Scout/blue and profiler to Profiler/purple", () => {
    expect(resolveSignalAgentPresentation("scout")).toMatchObject({
      agentName: "Scout",
      agentColor: "bg-blue-500",
    });
    expect(resolveSignalAgentPresentation("profiler")).toMatchObject({
      agentName: "Profiler",
      agentColor: "bg-purple-500",
    });
  });
});

describe("buildSignalBriefingArtefact", () => {
  it("maps the signal + leads onto the ArtefactItem fields", () => {
    const item = buildSignalBriefingArtefact(signal, leads);
    expect(item.id).toMatch(/^signal-briefing-s1-\d+$/);
    expect(item.agentName).toBe("Scout");
    expect(item.taskNumber).toBe("Signal Briefing");
    expect(item.folder).toBe("Signal Briefings");
    expect(item.status).toBe("new");
    expect(item.type).toBe("report");
    expect(item.timestamp).toBe("1h ago");
    expect(item.systemImpact).toBe("2 matched lead(s) identified");
    expect(item.fullReport.title).toBe("Hiring surge");
    expect(item.fullReport.executiveSummary).toBe("Detailed ICP context paragraph.");
    expect(item.fullReport.recommendations).toEqual(["Reach out now"]);
  });

  it("title-cases relevance and includes each lead's why in keyFindings", () => {
    const item = buildSignalBriefingArtefact(signal, leads);
    expect(item.fullReport.keyFindings[0]).toBe("Acme (Relevance: High): ICP match");
  });

  it("falls back to 'Unknown company' and omits the ': why' suffix when why is empty", () => {
    const item = buildSignalBriefingArtefact(signal, leads);
    expect(item.fullReport.keyFindings[1]).toBe("Unknown company (Relevance: Low)");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/signals/lib/__tests__/signalBriefing.test.ts`
Expected: FAIL — cannot resolve `../signalBriefing`.

- [ ] **Step 3: Create the builder module**

`frontend/src/features/signals/lib/signalBriefing.ts`:

```ts
import { Satellite, Target } from "lucide-react";
import type { ComponentType } from "react";

import type { SignalLeadMapLead } from "../contracts";
import type { SignalCard } from "../types";

import type { ArtefactItem } from "@/features/artifacts";

interface AgentPresentation {
  agentName: string;
  agentIcon: ComponentType<{ className?: string }>;
  agentColor: string;
}

/**
 * Feature-local mirror of the agent → icon/color values in artefacts'
 * mockArtefacts.ts. Kept local so the signals feature does not deep-import
 * artefacts internals (the index.ts-only boundary stands). StrategistWorkspace's
 * own Compass/indigo mapping is NOT a source for this.
 */
export function resolveSignalAgentPresentation(agent: "scout" | "profiler"): AgentPresentation {
  return agent === "scout"
    ? { agentName: "Scout", agentIcon: Satellite, agentColor: "bg-blue-500" }
    : { agentName: "Profiler", agentIcon: Target, agentColor: "bg-purple-500" };
}

const titleCase = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** One ArtefactItem from a signal + its matched leads (Spec 38 §5 mapping). */
export function buildSignalBriefingArtefact(
  signal: SignalCard,
  leads: SignalLeadMapLead[],
): ArtefactItem {
  const { agentName, agentIcon, agentColor } = resolveSignalAgentPresentation(signal.agent);
  const recommendations =
    signal.NBAs && signal.NBAs.length > 0
      ? signal.NBAs.map((n) => n.nba)
      : (signal.nextBestMoves ?? []);

  const keyFindings = leads.map((lead) => {
    const company = lead.company || "Unknown company";
    const head = `${company} (Relevance: ${titleCase(lead.relevance)})`;
    // The per-lead `why` rides into the PDF here — it is intentionally never on screen.
    return lead.why ? `${head}: ${lead.why}` : head;
  });

  return {
    id: `signal-briefing-${signal.id}-${Date.now()}`,
    agentName,
    agentIcon,
    agentColor,
    taskNumber: "Signal Briefing",
    timestamp: signal.timestamp,
    status: "new",
    type: "report",
    folder: "Signal Briefings",
    actionDelegated: `Find matched leads for "${signal.headline}"`,
    contextRationale: signal.snippet,
    systemImpact: `${leads.length} matched lead(s) identified`,
    actionPerformed: "Mapped accepted signal to matched leads",
    outputSummary: `${leads.length} matched leads with relevance and rationale`,
    fullReport: {
      title: signal.headline,
      executiveSummary: signal.description,
      keyFindings,
      analysis: `These ${leads.length} leads were matched to the signal based on ICP fit and the signal's context.`,
      recommendations,
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/signals/lib/__tests__/signalBriefing.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/signals/lib/signalBriefing.ts src/features/signals/lib/__tests__/signalBriefing.test.ts
git add src/features/signals/lib/signalBriefing.ts src/features/signals/lib/__tests__/signalBriefing.test.ts
git commit -m "feat(fe): add signal briefing builder + agent presentation resolver"
```

---

### Task 5: SignalCard — Find Matched Leads CTA + four-state leads section

Add the gated CTA, the lock message with timer lifecycle, the four-state leads section, and the Save button to `SignalCard`. All new state is page-held except the transient lock message (card-local).

**Files:**
- Modify: `frontend/src/features/signals/components/SignalCard.tsx`
- Test: `frontend/src/features/signals/components/__tests__/SignalCard.cta.test.tsx` (new)

**Interfaces:**
- Consumes: `SignalLeadMapLead` from `../contracts`.
- Produces (new `SignalCardProps`, added alongside the existing props):
  - `matchedLeads: SignalLeadMapLead[]`
  - `leadsLoading: boolean`
  - `leadsError: boolean`
  - `isLeadsExpanded: boolean`
  - `onFindMatchedLeads: () => void`
  - `onSaveAsArtefact: () => void`
  - `onRecomputeLeadMap?: () => void`

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/signals/components/__tests__/SignalCard.cta.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SignalLeadMapLead } from "../../contracts";
import type { SignalCard as SignalCardType } from "../../types";
import { SignalCard } from "../SignalCard";

import { TooltipProvider } from "@/components/ui/tooltip";

const signal: SignalCardType = {
  id: "sig-1",
  agent: "scout",
  timestamp: "1h ago",
  headline: "Hiring surge",
  snippet: "…",
  description: "Detailed ICP context paragraph.",
  sourceUrl: "#",
  sourceLabel: "Press",
  source: [],
  nextBestMoves: [],
  NBAs: [],
  contextualSuggestions: [],
};

const leads: SignalLeadMapLead[] = [
  { lead_id: "l1", company: "Acme", relevance: "high", why: "secret rationale" },
  { lead_id: "l2", company: "", relevance: "low", why: "" },
];

function renderCard(overrides: Partial<React.ComponentProps<typeof SignalCard>> = {}) {
  const props: React.ComponentProps<typeof SignalCard> = {
    signal,
    isAccepted: false,
    getAgentBadge: () => <span>From scout</span>,
    isDescriptionExpanded: true, // CTA lives inside the expanded block
    expandedRecommendationIndex: null,
    recommendationAnswers: {},
    recommendationAnswerLoading: null,
    answerExpandedKeys: new Set<string>(),
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onBotIconClick: vi.fn(),
    onNavigateToAgentChat: vi.fn(),
    onExpandDescription: vi.fn(),
    onCollapseDescription: vi.fn(),
    onToggleRecommendation: vi.fn(),
    onExpandAnswer: vi.fn(),
    onCollapseAnswer: vi.fn(),
    matchedLeads: [],
    leadsLoading: false,
    leadsError: false,
    isLeadsExpanded: false,
    onFindMatchedLeads: vi.fn(),
    onSaveAsArtefact: vi.fn(),
    onRecomputeLeadMap: vi.fn(),
    ...overrides,
  };
  render(
    <TooltipProvider>
      <SignalCard {...props} />
    </TooltipProvider>,
  );
  return props;
}

afterEach(() => vi.useRealTimers());

describe("SignalCard — Find Matched Leads CTA", () => {
  it("is styled-disabled yet clickable when not accepted, and shows the lock message", () => {
    const props = renderCard({ isAccepted: false });
    const btn = screen.getByRole("button", { name: /Find Matched Leads/i });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    expect(screen.getByText(/Accept this signal to unlock matched leads/i)).toBeInTheDocument();
    expect(props.onFindMatchedLeads).not.toHaveBeenCalled();
  });

  it("auto-dismisses the lock message after ~3s", () => {
    vi.useFakeTimers();
    renderCard({ isAccepted: false });
    fireEvent.click(screen.getByRole("button", { name: /Find Matched Leads/i }));
    expect(screen.getByText(/Accept this signal to unlock matched leads/i)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText(/Accept this signal to unlock matched leads/i)).toBeNull();
  });

  it("calls onFindMatchedLeads when accepted", () => {
    const props = renderCard({ isAccepted: true });
    fireEvent.click(screen.getByRole("button", { name: /Find Matched Leads/i }));
    expect(props.onFindMatchedLeads).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/Accept this signal to unlock matched leads/i),
    ).toBeNull();
  });
});

describe("SignalCard — leads section states", () => {
  it("renders a loading affordance, not 'no leads'", () => {
    renderCard({ isAccepted: true, isLeadsExpanded: true, leadsLoading: true });
    expect(screen.getByText(/Finding matched leads/i)).toBeInTheDocument();
    expect(screen.queryByText(/No matched leads/i)).toBeNull();
  });

  it("renders an error line with a recompute action", () => {
    const props = renderCard({ isAccepted: true, isLeadsExpanded: true, leadsError: true });
    fireEvent.click(screen.getByRole("button", { name: /Recompute lead mapping/i }));
    expect(props.onRecomputeLeadMap).toHaveBeenCalledTimes(1);
  });

  it("renders the zero-leads message and hides Save", () => {
    renderCard({ isAccepted: true, isLeadsExpanded: true, matchedLeads: [] });
    expect(screen.getByText(/No matched leads found for this signal yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save as Artefact/i })).toBeNull();
  });

  it("renders rows with title-cased relevance + company fallback, hides why, shows Save", () => {
    const props = renderCard({ isAccepted: true, isLeadsExpanded: true, matchedLeads: leads });
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Unknown company")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    // The per-lead `why` is reserved for the export — never on screen.
    expect(screen.queryByText(/secret rationale/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Save as Artefact/i }));
    expect(props.onSaveAsArtefact).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/signals/components/__tests__/SignalCard.cta.test.tsx`
Expected: FAIL — new props/UI don't exist; `Find Matched Leads` button not found.

- [ ] **Step 3: Add imports and the new props to `SignalCard.tsx`**

Add `useEffect`, `useRef`, `useState` and the lead type to the imports:

```tsx
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { SignalLeadMapLead } from "../contracts";
```

(Keep the existing `import type { Agent, NBAItem, SignalCard as SignalCardType } from "../types";`.)

Add the new fields to `SignalCardProps` (after `affectedLeadCount?: number;`):

```tsx
  /** Matched leads for this signal (from leadsForSignal(signal.id)). */
  matchedLeads: SignalLeadMapLead[];
  /** Org-level map fetch state (drives the four-state leads section). */
  leadsLoading: boolean;
  leadsError: boolean;
  /** Page-held: whether this card's leads section is open. */
  isLeadsExpanded: boolean;
  /** Toggle the leads section, or show the lock message when not accepted. */
  onFindMatchedLeads: () => void;
  /** Build + download + deliver the briefing. */
  onSaveAsArtefact: () => void;
  /** Offered in the error state; wraps the page's refreshLeadMap. */
  onRecomputeLeadMap?: () => void;
```

Destructure them in the component signature (add alongside the existing destructured props):

```tsx
  matchedLeads,
  leadsLoading,
  leadsError,
  isLeadsExpanded,
  onFindMatchedLeads,
  onSaveAsArtefact,
  onRecomputeLeadMap,
```

Also add accessible labels to the icon-only header **accept**/**reject** buttons — closes a pre-existing a11y gap and lets Task 7 select them by name instead of by fragile position (a positional `getAllByRole("button")[0]` can false-green: if the order shifts, a click lands on Reject, which removes the card, and the "Acme gone" assertion passes for the wrong reason).

On the header accept button (`ThumbsUp`, lines ~91–105) add the attribute:

```tsx
              aria-label={isAccepted ? "Unaccept signal" : "Accept signal"}
```

On the header reject button (`ThumbsDown`, lines ~106–116) add:

```tsx
              aria-label="Reject signal"
```

(The bot button already exposes an accessible name via its existing `title`. The recommendation-block accept button — only rendered when a recommendation is expanded — keeps its existing `title`, so there is no name collision in the Task 7 tests, where no recommendation is expanded.)

- [ ] **Step 4: Add the card-local lock-message state + helpers**

Immediately inside the component body (before the `return`), add:

```tsx
  const [showLockMessage, setShowLockMessage] = useState(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLockTimer = () => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  };

  // Clear the lock timer on card collapse and on unmount (Spec §2).
  useEffect(() => {
    if (!isDescriptionExpanded) {
      clearLockTimer();
      setShowLockMessage(false);
    }
  }, [isDescriptionExpanded]);
  useEffect(() => () => clearLockTimer(), []);

  const handleFindClick = () => {
    if (!isAccepted) {
      // Functionally enabled (not native disabled) so it can explain itself.
      clearLockTimer();
      setShowLockMessage(true);
      lockTimerRef.current = setTimeout(() => setShowLockMessage(false), 3000);
      return;
    }
    setShowLockMessage(false);
    clearLockTimer();
    onFindMatchedLeads();
  };

  const relevanceBadgeClass = (relevance: SignalLeadMapLead["relevance"]): string => {
    if (relevance === "high") return "bg-green-100 text-green-800 border-green-200";
    if (relevance === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };
  const titleCase = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const leadsSection: ReactNode = isLeadsExpanded ? (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      {leadsLoading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Finding matched leads…</span>
        </div>
      ) : leadsError ? (
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-sm text-red-600">Could not load matched leads.</span>
          <Button variant="outline" size="sm" onClick={() => onRecomputeLeadMap?.()}>
            Recompute lead mapping
          </Button>
        </div>
      ) : matchedLeads.length === 0 ? (
        <p className="py-1 text-sm text-gray-500">No matched leads found for this signal yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {matchedLeads.map((lead) => (
              <div
                key={lead.lead_id}
                className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 border border-gray-100"
              >
                <span className="text-sm text-gray-800">{lead.company || "Unknown company"}</span>
                <Badge variant="secondary" className={`text-xs ${relevanceBadgeClass(lead.relevance)}`}>
                  {titleCase(lead.relevance)}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="text-blue-700 border-blue-300 hover:bg-blue-50"
              onClick={onSaveAsArtefact}
            >
              Save as Artefact
            </Button>
          </div>
        </>
      )}
    </div>
  ) : null;
```

- [ ] **Step 5: Render the CTA + leads section between citations and recommendations**

In the expanded block, **after** the citations `{Array.isArray(signal.source) && signal.source.length > 0 && ( … )}` and **before** the recommendations IIFE `{(() => { const recommendationsList … })()}`, insert:

```tsx
                      {/* Spec 38 CTA: Find Matched Leads → leads section */}
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          size="default"
                          role="button"
                          aria-disabled={!isAccepted}
                          className={
                            isAccepted
                              ? "text-sm border-green-600 text-green-700 hover:bg-green-50"
                              : "text-sm border-gray-300 text-gray-400 cursor-not-allowed"
                          }
                          onClick={handleFindClick}
                        >
                          Find Matched Leads
                        </Button>
                        {showLockMessage && (
                          <p className="mt-2 text-xs text-amber-700">
                            Accept this signal to unlock matched leads
                          </p>
                        )}
                        {leadsSection}
                      </div>
```

> Note: the existing `affectedLeadCount` badge and accept/reject/bot controls are unchanged.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/features/signals/components/__tests__/SignalCard.cta.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 7: Run the pre-existing SignalCard tests (shared component — no regression)**

Run: `npx vitest run src/features/signals/components/__tests__/SignalCard.test.tsx src/features/signals/components/__tests__/SignalCard.affects.test.tsx`
Expected: PASS — but these render `SignalCard` **without** the new required props, so they will now type-error / fail. Fix them: add the new required props with safe defaults to the `props`/`renderCard` objects in both files:

```tsx
    matchedLeads: [],
    leadsLoading: false,
    leadsError: false,
    isLeadsExpanded: false,
    onFindMatchedLeads: vi.fn(),
    onSaveAsArtefact: vi.fn(),
    onRecomputeLeadMap: vi.fn(),
```

Re-run both files; expected PASS.

- [ ] **Step 8: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/signals/components/SignalCard.tsx src/features/signals/components/__tests__/SignalCard.cta.test.tsx src/features/signals/components/__tests__/SignalCard.test.tsx src/features/signals/components/__tests__/SignalCard.affects.test.tsx
git add src/features/signals/components/SignalCard.tsx src/features/signals/components/__tests__/SignalCard.cta.test.tsx src/features/signals/components/__tests__/SignalCard.test.tsx src/features/signals/components/__tests__/SignalCard.affects.test.tsx
git commit -m "feat(fe): add Find Matched Leads CTA + four-state leads section to SignalCard"
```

---

### Task 6: useSignalLeadMap recompute → real refetch (exits error state)

Today `refresh()` calls `setQueryData` on success and swallows failures to `console.warn`, so a leads section stuck in the error state stays stuck. Route recompute through `queryClient.fetchQuery` (still sending `refresh: true`) so the shared query's state updates — loading → resolved on success, error preserved on failure. Reword the stale "endpoint not deployed / 404s" comment (the endpoint is live and the control is visible).

**Files:**
- Modify: `frontend/src/features/signals/hooks/useSignalLeadMap.ts`
- Test: `frontend/src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx`

**Interfaces:**
- Consumes: `fetchSignalLeadMap`, `qk.signalLeadMap`, `useQueryClient`.
- Produces: `refresh` keeps the same `() => Promise<void>` signature (still sends `refresh: true`); recompute now drives the query lifecycle.

- [ ] **Step 1: Write the failing test (append to the existing file)**

Add this case to the `describe("useSignalLeadMap", …)` block in `useSignalLeadMap.test.tsx`:

```tsx
  it("recompute exits the error state on a successful refetch", async () => {
    let calls = 0;
    server.use(
      http.post("/api/signal-lead-map_claude", () => {
        calls += 1;
        if (calls === 1) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json(RESPONSE);
      }),
    );
    const { result } = renderHook(() => useSignalLeadMap("org1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.isError).toBe(false), { timeout: 5000 });
    expect(result.current.leadsForSignal("s1")).toHaveLength(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx`
Expected: FAIL — `isError` stays `true` (the current `setQueryData`-only path never re-runs the query lifecycle to clear the error).

- [ ] **Step 3: Rewrite `refresh()` to drive the query**

Replace the `refresh` callback (lines ~52–65) in `useSignalLeadMap.ts` with:

```ts
  /**
   * Force-recompute the signal↔lead mapping past the server cache. Routed
   * through fetchQuery (staleTime:0) so the shared query's own state updates:
   * isFetching → success on a good response (which clears a prior error state),
   * or error on failure. A bare setQueryData left a stuck error UI silently.
   * The /signal-lead-map_claude endpoint is deployed; SignalsPage renders a
   * visible "Recompute lead mapping" control wired here.
   */
  const refresh = useCallback(async () => {
    if (!orgId || !userId) return;
    try {
      await queryClient.fetchQuery({
        queryKey: qk.signalLeadMap(orgId, userId),
        queryFn: () => fetchSignalLeadMap(userId, orgId, { refresh: true }),
        staleTime: 0,
      });
    } catch (err) {
      console.warn("signal-lead-map recompute failed", err);
    }
  }, [orgId, userId, queryClient]);
```

- [ ] **Step 4: Run the full file to verify all cases pass**

Run: `npx vitest run src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx`
Expected: PASS — including the pre-existing "sends refresh:true when refresh() is invoked" case (fetchQuery still posts `refresh: true`).

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/signals/hooks/useSignalLeadMap.ts src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx
git add src/features/signals/hooks/useSignalLeadMap.ts src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx
git commit -m "fix(fe): recompute lead map via fetchQuery so the error state recovers"
```

---

### Task 7: SignalsPage wiring — pass leads, build/download/deliver, collapse on un-accept

Wire the page: one open leads section at a time, pass map data + state to each card, implement `handleSaveAsArtefact` (build → download → enqueue → toast, no forced nav), and collapse the open leads section when its signal is un-accepted.

**Files:**
- Modify: `frontend/src/features/signals/pages/SignalsPage.tsx`
- Test: `frontend/src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx` (new)

**Interfaces:**
- Consumes: `buildSignalBriefingArtefact` (Task 4); `enqueueArtefact`, `generateAndDownloadPDF` from `@/features/artifacts` (Tasks 1/3); the new `SignalCard` props (Task 5); `useSignalLeadMap`'s `leadsForSignal`, `isLoading`, `isError`, `refresh` (Task 6).
- Produces: no new exports; new page state `expandedLeadsSignalId`.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignalsPage from "../SignalsPage";

import { enqueueArtefact, generateAndDownloadPDF } from "@/features/artifacts";

const SIGNAL = {
  id: "sig-1",
  agent: "scout",
  timestamp: "1h ago",
  headline: "Hiring surge",
  snippet: "snippet text",
  description: "Detailed ICP context paragraph.",
  sourceUrl: "#",
  sourceLabel: "Press",
  source: [],
  nextBestMoves: ["Reach out"],
  NBAs: [],
  contextualSuggestions: [],
};
const SIGNAL_2 = { ...SIGNAL, id: "sig-2", headline: "Funding round" };

const LEADS = [{ lead_id: "l1", company: "Acme", relevance: "high", why: "ICP match" }];

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));
vi.mock("../hooks/useSignalLeadMap", () => ({
  useSignalLeadMap: () => ({
    leadsForSignal: (id: string) => (id === "sig-1" ? LEADS : []),
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  }),
}));
vi.mock("../services/signals", () => ({
  fetchSignals: vi.fn().mockResolvedValue({}),
  generateSignalsBatch: vi.fn().mockResolvedValue({}),
}));
vi.mock("../components/signalCards", () => ({
  buildSignalCardsFromFetchData: () => [SIGNAL, SIGNAL_2],
  applyRejectedFilterAndSort: (s: unknown[]) => s,
  getFallbackSampleSignals: () => [SIGNAL, SIGNAL_2],
  getSignalContentHash: (s: { id: string }) => `hash-${s.id}`,
  sanitizeSourceUrl: (u: string) => u,
}));
vi.mock("@/shared/chat", () => ({
  writeSessionChatContext: vi.fn(),
}));
vi.mock("@/shared/chat/useSignalAction", () => ({
  useSignalAction: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));
vi.mock("@/shared/chat/useSignalAsk", () => ({
  useSignalAsk: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));
vi.mock("@/features/artifacts", () => ({
  enqueueArtefact: vi.fn(),
  generateAndDownloadPDF: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{(<SignalsPage />) as ReactNode}</MemoryRouter>
    </QueryClientProvider>,
  );
}

// Card order is stable: [sig-1, sig-2]. Header accept/reject buttons carry
// aria-labels (added in Task 5), so they are selected by accessible name — never
// by position. Acceptance is seeded via localStorage so the CTA is active on mount.
function cardFor(headline: string): HTMLElement {
  return screen.getByText(headline).closest(".bg-white") as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => localStorage.clear());

describe("SignalsPage — Find Matched Leads → Save", () => {
  it("builds, downloads, and enqueues the briefing on Save (no forced nav)", async () => {
    // Seed acceptance so the CTA is active on mount (hash matches the mock above).
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());

    const card = cardFor("Hiring surge");
    fireEvent.click(within(card).getByRole("button", { name: /Find Matched Leads/i }));
    fireEvent.click(within(card).getByRole("button", { name: /Save as Artefact/i }));

    expect(generateAndDownloadPDF).toHaveBeenCalledTimes(1);
    expect(enqueueArtefact).toHaveBeenCalledTimes(1);
    const item = vi.mocked(enqueueArtefact).mock.calls[0][0];
    expect(item.id).toMatch(/^signal-briefing-sig-1-\d+$/);
    expect(item.fullReport.keyFindings[0]).toContain("ICP match");
    // Still on the signals feed.
    expect(screen.getByText("Hiring surge")).toBeInTheDocument();
  });

  it("opens only one leads section at a time", async () => {
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1", "hash-sig-2"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());

    fireEvent.click(
      within(cardFor("Hiring surge")).getByRole("button", { name: /Find Matched Leads/i }),
    );
    expect(within(cardFor("Hiring surge")).getByText("Acme")).toBeInTheDocument();

    fireEvent.click(
      within(cardFor("Funding round")).getByRole("button", { name: /Find Matched Leads/i }),
    );
    // sig-1's section closed; sig-2 has zero leads → its zero-state shows, sig-1's rows gone.
    expect(within(cardFor("Funding round")).getByText(/No matched leads found/i)).toBeInTheDocument();
    expect(within(cardFor("Hiring surge")).queryByText("Acme")).toBeNull();
  });

  it("collapses an open leads section when its signal is un-accepted", async () => {
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());

    const card = cardFor("Hiring surge");
    fireEvent.click(within(card).getByRole("button", { name: /Find Matched Leads/i }));
    expect(within(card).getByText("Acme")).toBeInTheDocument();

    // Seeded accepted → the accept toggle's accessible name is "Unaccept signal".
    fireEvent.click(within(card).getByRole("button", { name: /Unaccept signal/i }));
    await waitFor(() => expect(within(card).queryByText("Acme")).toBeNull());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx`
Expected: FAIL — the page does not yet pass the new props / has no `expandedLeadsSignalId`, so `Find Matched Leads` either is absent or does nothing.

- [ ] **Step 3: Add imports + state to `SignalsPage.tsx`**

Add to the imports:

```tsx
import { buildSignalBriefingArtefact } from "../lib/signalBriefing";

import { enqueueArtefact, generateAndDownloadPDF } from "@/features/artifacts";
```

Pull the extra fields off the hook (replace the existing `const { leadsForSignal, refresh: refreshLeadMap } = useSignalLeadMap(orgId);`):

```tsx
  const {
    leadsForSignal,
    isLoading: leadsLoading,
    isError: leadsError,
    refresh: refreshLeadMap,
  } = useSignalLeadMap(orgId);
```

Add the page state near the other `useState` hooks:

```tsx
  /** Only one signal's leads section is open at a time. */
  const [expandedLeadsSignalId, setExpandedLeadsSignalId] = useState<string | null>(null);
```

- [ ] **Step 4: Add the handlers**

Add near the other handlers (e.g. after `handleAcceptSignal`):

```tsx
  const handleFindMatchedLeads = (signalId: string) => {
    setExpandedLeadsSignalId((prev) => (prev === signalId ? null : signalId));
  };

  const handleSaveAsArtefact = (signal: SignalCardType) => {
    const leads = leadsForSignal(signal.id);
    const item = buildSignalBriefingArtefact(signal, leads);
    generateAndDownloadPDF(item);
    enqueueArtefact(item);
    toast({
      title: "Saved to Artefacts",
      description: "Your signal briefing was downloaded and added to the Artefacts library.",
      action: (
        <Button variant="outline" size="sm" onClick={() => navigate("/artifacts")}>
          View →
        </Button>
      ),
    });
  };
```

- [ ] **Step 5: Collapse the leads section on un-accept**

In `handleAcceptSignal`, inside the branch that **un-accepts** (the `if (acceptedSignals.has(contentHash)) { … }` block), after `setAcceptedSignals(newAccepted);`, add:

```tsx
      // If this signal's leads section is open, collapse it — the CTA re-locks.
      setExpandedLeadsSignalId((prev) => (prev === signalId ? null : prev));
```

- [ ] **Step 6: Pass the new props to `SignalCard`**

In the `signals.map(...)` render, add these props to `<SignalCard … />` (alongside `affectedLeadCount`):

```tsx
                    matchedLeads={leadsForSignal(signal.id)}
                    leadsLoading={leadsLoading}
                    leadsError={leadsError}
                    isLeadsExpanded={expandedLeadsSignalId === signal.id}
                    onFindMatchedLeads={() => handleFindMatchedLeads(signal.id)}
                    onSaveAsArtefact={() => handleSaveAsArtefact(signal)}
                    onRecomputeLeadMap={() => void refreshLeadMap()}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 8: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/signals/pages/SignalsPage.tsx src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx
git add src/features/signals/pages/SignalsPage.tsx src/features/signals/pages/__tests__/SignalsPage.cta.test.tsx
git commit -m "feat(fe): wire Find Matched Leads + Save as Artefact into SignalsPage"
```

---

### Task 8: Tighten `SignalLeadMapResponseSchema` (TD-FE-73) + golden fixture

Reconcile the FE contract to the live shape: model the always-present top-level `status` and `data.generated_at`/`data.cached`, drop `.passthrough()` where the shape is stable. **Keep** the `.default("")`/`.catch("low")` resilience the feature depends on, and do **not** apply `.strict()`. Ground the per-entry/per-lead sub-shapes on the backend's server-normalized `_parse_mapping` construction; add an anonymized golden fixture.

> TD-FE-73 stays **open** — its narrowing/progress note is recorded in Task 9. This task is the code + test.

**Files:**
- Modify: `frontend/src/features/signals/contracts.ts`
- Modify: `frontend/src/features/signals/__tests__/contracts.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SignalLeadMapResponseSchema` with modeled `status`/`generated_at`/`cached`; types `SignalLeadMapEntry`/`SignalLeadMapLead`/`SignalLeadMapResponse` unchanged in shape consumers rely on (`company`/`why` still `string`, `relevance` still the union).

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/features/signals/__tests__/contracts.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { SignalLeadMapResponseSchema } from "../contracts";

// Anonymized golden fixture — the SHAPE captured from the live
// /signal-lead-map_claude envelope (2026-06-19), values scrubbed. The live
// account returned an empty mapping[] (0 leads); the per-entry/per-lead
// sub-shape is grounded on lead_map.py::_parse_mapping (server-normalized).
const GOLDEN = {
  status: "success",
  data: {
    mapping: [
      {
        signal_id: "sig-anon-1",
        headline: "Anonymized headline",
        leads: [
          { lead_id: "lead-anon-1", company: "Example Co", relevance: "high", why: "ICP fit" },
          { lead_id: "lead-anon-2", company: "Another Co", relevance: "medium", why: "" },
        ],
      },
    ],
    generated_at: "2026-06-19T00:00:00Z",
    cached: false,
  },
};

describe("SignalLeadMapResponseSchema (tightened, TD-FE-73)", () => {
  it("parses the golden live-shape fixture and exposes status/generated_at/cached", () => {
    const parsed = SignalLeadMapResponseSchema.parse(GOLDEN);
    expect(parsed.status).toBe("success");
    expect(parsed.data.generated_at).toBe("2026-06-19T00:00:00Z");
    expect(parsed.data.cached).toBe(false);
    expect(parsed.data.mapping[0].leads[0].company).toBe("Example Co");
  });

  it("parses the empty-mapping envelope (the dominant prod case today)", () => {
    const parsed = SignalLeadMapResponseSchema.parse({
      status: "success",
      data: { mapping: [], generated_at: "t", cached: false },
    });
    expect(parsed.data.mapping).toEqual([]);
  });

  it("keeps degrade-never-throw guards: defaults company/why, catches relevance", () => {
    const parsed = SignalLeadMapResponseSchema.parse({
      status: "success",
      data: {
        mapping: [
          { signal_id: "s1", leads: [{ lead_id: "l1", relevance: "weird" }] },
          { signal_id: "s2" }, // entry with no `leads` key
        ],
      },
    });
    expect(parsed.data.mapping[0].leads[0].company).toBe("");
    expect(parsed.data.mapping[0].leads[0].why).toBe("");
    expect(parsed.data.mapping[0].leads[0].relevance).toBe("low");
    expect(parsed.data.mapping[0].headline).toBe("");
    expect(parsed.data.mapping[1].leads).toEqual([]); // entry-level .default([])
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/signals/__tests__/contracts.test.ts`
Expected: FAIL — `parsed.status` is `undefined` (not modeled; only tolerated via outer `.passthrough()`).

- [ ] **Step 3: Tighten the schema**

In `frontend/src/features/signals/contracts.ts`, replace the lead/entry/response schemas (lines 9–36) with:

```ts
// Sub-shapes grounded on the backend's server-normalized _parse_mapping
// (lead_map.py): each lead is rebuilt as {lead_id, company, relevance, why} and
// each entry as {signal_id, headline, leads[]}. KEEP the degrade-never-throw
// guards — the feature depends on them (company || "Unknown company", omit-empty
// why, and avoiding one odd lead throwing an org-wide parse error). No .strict():
// a plain z.object strips FE-ignored extras; .strict() would throw on them.
export const SignalLeadMapLeadSchema = z.object({
  lead_id: z.string(),
  company: z.string().optional().default(""),
  relevance: z.enum(["high", "medium", "low"]).catch("low"),
  why: z.string().optional().default(""),
});

export const SignalLeadMapEntrySchema = z.object({
  signal_id: z.string(),
  headline: z.string().optional().default(""),
  leads: z.array(SignalLeadMapLeadSchema).default([]),
});

export const SignalLeadMapResponseSchema = z.object({
  // _build_result always returns status:"success" — modeled, not passthrough-tolerated.
  status: z.string().optional(),
  data: z.object({
    mapping: z.array(SignalLeadMapEntrySchema).default([]),
    generated_at: z.string().optional(),
    cached: z.boolean().optional(),
  }),
});
```

- [ ] **Step 4: Run the contract tests + downstream consumers**

Run: `npx vitest run src/features/signals/__tests__/contracts.test.ts src/features/signals/hooks/__tests__/useSignalLeadMap.test.tsx src/features/signals/services/__tests__/signals.test.ts`
Expected: PASS — the hook/service tests still parse their payloads (the modeled fields are all optional except `status` which is optional; `mapping` still defaults).

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/features/signals/contracts.ts src/features/signals/__tests__/contracts.test.ts
git add src/features/signals/contracts.ts src/features/signals/__tests__/contracts.test.ts
git commit -m "refactor(fe): reconcile SignalLeadMapResponseSchema to live shape (TD-FE-73)"
```

---

### Task 9: Tech-debt register — narrow TD-FE-73, add two new TDs

Consolidate all `docs/TECH_DEBT.md` edits into one commit: record TD-FE-73 progress and narrow its remaining action (keep it **open**); add a TD for the non-persistent Artefacts library and a TD for the structurally non-compliant PDF generator.

> `docs/TECH_DEBT.md` is **not** under the prettier gate and uses unfenced `*`/`_` markdown — edit surgically, do **not** run prettier on it.

**Files:**
- Modify: `docs/TECH_DEBT.md`

- [ ] **Step 1: Narrow TD-FE-73 (keep it open)**

In `docs/TECH_DEBT.md`, under `## TD-FE-73 …`, append after the existing "Note (Phase 37 …)" line (before the `---`):

```markdown
**Note (Plan 38, 2026-06-19):** endpoint confirmed **live** — a real account returns
`200 {status, data:{mapping, generated_at, cached}}`, matching the envelope. The FE
contract was tightened in-branch (`contracts.ts`: modeled `status`/`generated_at`/
`cached`, dropped `.passthrough()` on stable shapes, kept `.default("")`/`.catch("low")`),
grounded on the backend's server-normalized `_parse_mapping` plus the live envelope. A
golden fixture was added to `__tests__/contracts.test.ts`. **TD stays open:** the only
account checked has 3 signals / **0 leads**, so a *populated* `mapping[]` could not be
captured. **Remaining required action narrowed to:** re-capture a populated response
once an org has both signals and leads (leads arrive via Apollo discovery / upload) to
confirm the per-entry/per-lead sub-shapes empirically.
```

- [ ] **Step 2: Add the new TD entries**

Append two new entries at the end of `docs/TECH_DEBT.md` (after the last entry), using the next free TD-FE numbers (confirm the current ceiling first with `grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -t- -k3 -n | tail -1`; the ceiling is **76**, so use **77** and **78**):

```markdown
## TD-FE-77 — Signal briefings delivered to the Artefacts library do not survive navigation

**Date logged:** 2026-06-19
**Origin:** Plan 38 (Signals CTA). The Save-as-Artefact flow delivers a briefing via a
module-level queue drained on `ArtifactsPage` mount, but the library list is
`useState(mockArtefacts)` with no data layer.

**Current state:** a delivered briefing is visible only until the user **navigates away
from `/artifacts`** (unmount discards the list; the queue has already drained). Same class
as the existing Strategist artefacts. Delivery is reliable; retention is not durable.

**What it should be:** the Artefacts library backed by a real store (server or persistent
client state) so saved briefings survive navigation/reload.

**Why deferred:** lifting the library to a real store is a separate effort; at 0 users the
in-session delivery is sufficient to demo the flow. Same TD class as Strategist's artefacts.

**Pull-forward trigger:** the Artefacts library gets a data layer, or users report that
saved briefings vanish.

**Owner:** TBD.

**Follow-up:** if this shared `enqueueArtefact` queue proves out, Strategist's two broken
dispatch-then-navigate sites (`StrategistWorkspace.tsx`) should adopt it (their saves
currently fire `addArtefact` into the void).

---

## TD-FE-78 — Shared PDF generator emits structurally non-compliant output and mojibakes non-WinAnsi glyphs

**Date logged:** 2026-06-19
**Origin:** Plan 38 (Signals CTA). Hardened the briefing path's free-text (structural
escaping + common-punctuation ASCII fold) but left the generator's deeper issues.

**Current state:** `artefactPdf.ts::createSimplePDF` has a hardcoded `/Length 2000`,
placeholder xref offsets, and a single-page `MediaBox` with no pagination — lead-heavy
briefings clip past one page. Residual non-ASCII (accented company names, non-Latin
scripts beyond the common fold) still mojibakes under Helvetica/WinAnsi. Shared with the
Strategist artefact download path.

**What it should be:** a real PDF library (e.g. jsPDF/pdf-lib) with correct xref, multi-page
flow, and Unicode-capable font embedding.

**Why deferred:** the in-scope escaping/fold makes typical LLM briefings render correctly;
a correct generator is a larger, shared effort beyond this branch.

**Pull-forward trigger:** the PDF path is prioritized, or garbled/clipped briefings are
reported in practice.

**Owner:** TBD.
```

- [ ] **Step 3: Update the TD index table**

At the top index table of `docs/TECH_DEBT.md` (where `TD-FE-73 | open | …` lives), add two rows mirroring the existing format, linking to the new anchors:

```markdown
| TD-FE-77 | open | [below](#td-fe-77--signal-briefings-delivered-to-the-artefacts-library-do-not-survive-navigation) |
| TD-FE-78 | open | [below](#td-fe-78--shared-pdf-generator-emits-structurally-non-compliant-output-and-mojibakes-non-winansi-glyphs) |
```

- [ ] **Step 4: Commit (no prettier on this file)**

```bash
git add docs/TECH_DEBT.md
git commit -m "docs: narrow TD-FE-73, add TD-FE-77 (library persistence) + TD-FE-78 (PDF generator)"
```

---

## Merge gate

After all tasks, run the full serial preflight from `frontend/` (the merge gate — typecheck, lint, format:check, the **full** Vitest suite, build, bundle, Playwright/VR, knip):

```bash
npm run preflight
```

Green → controller merges `38-signals-cta` into `master` with `--no-ff` and pushes. Red → report which check failed; the user decides fix vs. abort.

> Note on Vitest flake: the full suite can flake under sandbox CPU contention. If a failure looks like an async `waitFor` timeout rather than a real assertion, re-run with `--no-file-parallelism` before treating it as a defect (see TECH_DEBT / memory).

---

## Self-Review

**Spec coverage** (each spec section → task):
- §2 gated CTA (aria-disabled + onClick guard, lock message + timer lifecycle) → Task 5.
- §3 accept side effects (green/active on accept; collapse on un-accept) → Task 5 (visual) + Task 7 (collapse).
- §4 four-state leads section (loading / error+recompute / zero / rows; title-cased relevance; company fallback; `why` not on screen) → Task 5; recompute exits error → Task 6.
- §5 Save as Artefact (one ArtefactItem; PDF download; queue delivery; toast, no forced nav) → builder Task 4, PDF Task 3, queue Tasks 1–2, wiring Task 7.
- §5 ArtefactItem mapping table → Task 4 (verified field-by-field in tests).
- §5 PDF escaping (structural + ASCII fold) → Task 3.
- Component Changes (SignalCard props, SignalsPage handlers, artifacts queue+barrel) → Tasks 5/7/1.
- Testing list (card states, save flow, delivery regression guard, once-only drain, recompute, PDF escaping, contract reconciliation) → Tasks 2/3/5/6/7/8.
- Dependencies/TD-FE-73 (tighten in-branch, keep open, narrow remaining) → Tasks 8/9; new TDs (library persistence, PDF generator) → Task 9; hygiene comment reword → Task 6.
- Out of Scope items are not implemented (no per-lead AI, no FS Access API, no library persistence, no correct PDF generator, no backend change).

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `enqueueArtefact`/`drainArtefactQueue`/`resetArtefactQueue` (Task 1) used identically in Tasks 2/7. `buildSignalBriefingArtefact(signal, leads)` (Task 4) called with the same args in Task 7. `escapePdfText` (Task 3) name matches its test. The new `SignalCard` prop names (Task 5) match exactly what Task 7 passes. `refresh` keeps its `() => Promise<void>` signature (Task 6) as Task 7's `onRecomputeLeadMap` wrapper expects.
