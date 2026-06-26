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
