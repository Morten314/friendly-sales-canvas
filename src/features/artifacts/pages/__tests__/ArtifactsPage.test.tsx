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

  it("drains multiple items: most-recently-enqueued (B) lands first in DOM and is expanded", () => {
    // A is enqueued first, B second — B is the most-recently-enqueued.
    const briefingA: ArtefactItem = {
      ...briefing,
      id: "signal-briefing-A",
      actionDelegated: 'Find matched leads for "Alpha signal"',
      systemImpact: "system-impact-A",
      contextRationale: "rationale-A",
    };
    const briefingB: ArtefactItem = {
      ...briefing,
      id: "signal-briefing-B",
      actionDelegated: 'Find matched leads for "Beta signal"',
      systemImpact: "system-impact-B",
      contextRationale: "rationale-B",
    };
    enqueueArtefact(briefingA);
    enqueueArtefact(briefingB);

    render(<ArtifactsPage />);

    // (a) Both briefings must be visible in the DOM (drain opened the shared folder).
    expect(screen.getByText('Find matched leads for "Alpha signal"')).toBeInTheDocument();
    expect(screen.getByText('Find matched leads for "Beta signal"')).toBeInTheDocument();

    // (b) DOM order: B (most-recently-enqueued) must appear BEFORE A.
    //     [...queued.slice().reverse(), ...prev] puts B first.
    const allActions = screen
      .getAllByText(/Find matched leads for/)
      .map((el) => el.textContent ?? "");
    expect(allActions[0]).toContain("Beta signal");
    expect(allActions[1]).toContain("Alpha signal");

    // (c) B is the expanded artefact (mostRecent = queued[queued.length - 1] = B).
    //     The expanded panel renders contextRationale under "Context & Rationale".
    //     Only B's rationale should be visible — A's panel is collapsed.
    expect(screen.getByText("rationale-B")).toBeInTheDocument();
    expect(screen.queryByText("rationale-A")).toBeNull();
  });
});
