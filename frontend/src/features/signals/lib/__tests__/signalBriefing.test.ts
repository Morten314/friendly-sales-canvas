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
