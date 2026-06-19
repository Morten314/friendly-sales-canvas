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
  ProtectedRoute: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
