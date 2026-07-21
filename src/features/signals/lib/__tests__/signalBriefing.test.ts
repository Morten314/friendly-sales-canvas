import { describe, expect, it } from "vitest";

import type { RecommendationArtefactResponse, SignalLeadMapLead } from "../../contracts";
import type { SignalCard } from "../../types";
import {
  buildRecommendationPlaybookArtefact,
  buildSignalBriefingArtefact,
  resolveSignalAgentPresentation,
} from "../signalBriefing";

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

const generated: RecommendationArtefactResponse = {
  what_to_do: "Sequence the outreach.",
  strategy: "Win the DACH wedge.",
  how_to_communicate: "Warm, concise.",
  communication_channel: "email+linkedin",
  communication_template: "Hi [First Name], ...",
};

describe("buildRecommendationPlaybookArtefact", () => {
  const signalWithSource = {
    ...signal,
    source: [{ citation: "ACME Q3", url: "https://example.com/q3" }],
  };

  it("maps the playbook onto ArtefactItem fields (§9)", () => {
    const item = buildRecommendationPlaybookArtefact(
      signalWithSource,
      { nba: "Reach out now", prompt: "p" },
      2,
      "the cached answer",
      leads,
      generated,
    );
    expect(item.id).toMatch(/^recommendation-playbook-s1-2-\d+$/);
    expect(item.type).toBe("playbook");
    expect(item.folder).toBe("GTM Playbooks");
    expect(item.taskNumber).toBe("GTM Playbook");
    expect(item.actionDelegated).toBe("Reach out now");
    expect(item.systemImpact).toBe("2 matched lead(s) targeted");
    expect(item.fullReport.title).toBe(signalWithSource.headline);
    // executive summary carries description + recommendation + a Sources line (D-5)
    expect(item.fullReport.executiveSummary).toContain("Reach out now");
    expect(item.fullReport.executiveSummary).toContain("ACME Q3");
    expect(item.fullReport.analysis).toContain("Win the DACH wedge.");
    expect(item.fullReport.analysis).toContain("Sequence the outreach.");
    expect(item.fullReport.recommendations[0]).toBe("Explanation: the cached answer");
    expect(item.fullReport.recommendations[1]).toContain("How to Communicate (email+linkedin)");
    expect(item.fullReport.recommendations[2]).toContain("Communication Template:");
    expect(item.fullReport.recommendations[2]).toContain("Hi [First Name]");
  });

  it("omits the Sources line when the signal has no source, and degrades on empty LLM fields", () => {
    const item = buildRecommendationPlaybookArtefact(signal, { nba: "X", prompt: "" }, 0, "", [], {
      what_to_do: "",
      strategy: "",
      how_to_communicate: "",
      communication_channel: "",
      communication_template: "",
    });
    expect(item.fullReport.executiveSummary).not.toContain("Sources:");
    expect(item.systemImpact).toBe("0 matched lead(s) targeted");
    expect(item.fullReport.keyFindings).toEqual([]);
    expect(item.type).toBe("playbook"); // still a valid item
  });
});
