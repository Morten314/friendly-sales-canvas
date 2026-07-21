import { Satellite, Target } from "lucide-react";
import type { ComponentType } from "react";

import type { RecommendationArtefactResponse, SignalLeadMapLead } from "../contracts";
import type { NBAItem, SignalCard } from "../types";

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

/** One playbook ArtefactItem from a recommendation + its LLM-generated sections (Spec 41 §9). */
export function buildRecommendationPlaybookArtefact(
  signal: SignalCard,
  recommendation: NBAItem,
  recommendationIndex: number,
  answer: string,
  leads: SignalLeadMapLead[],
  generated: RecommendationArtefactResponse,
): ArtefactItem {
  const { agentName, agentIcon, agentColor } = resolveSignalAgentPresentation(signal.agent);

  // D-5: flatten SourceCitation[] (citation, falling back to url) into a Sources line.
  const sources = (signal.source ?? []).map((s) => s.citation || s.url).filter(Boolean);
  const sourcesLine = sources.length ? `\n\nSources: ${sources.join("; ")}` : "";

  const keyFindings = leads.map((lead) => {
    const company = lead.company || "Unknown company";
    const head = `${company} (Relevance: ${titleCase(lead.relevance)})`;
    return lead.why ? `${head}: ${lead.why}` : head;
  });

  return {
    id: `recommendation-playbook-${signal.id}-${recommendationIndex}-${Date.now()}`,
    agentName,
    agentIcon,
    agentColor,
    taskNumber: "GTM Playbook",
    timestamp: signal.timestamp,
    status: "new",
    type: "playbook",
    folder: "GTM Playbooks",
    actionDelegated: recommendation.nba,
    contextRationale: signal.description.slice(0, 200),
    systemImpact: `${leads.length} matched lead(s) targeted`,
    actionPerformed: "Generated GTM playbook for recommendation",
    outputSummary: generated.strategy.slice(0, 150),
    fullReport: {
      title: signal.headline,
      executiveSummary: `${signal.description}\n\nRecommendation: ${recommendation.nba}${sourcesLine}`,
      keyFindings,
      analysis: `${generated.strategy}\n\n${generated.what_to_do}`,
      recommendations: [
        `Explanation: ${answer}`,
        `How to Communicate (${generated.communication_channel}): ${generated.how_to_communicate}`,
        `Communication Template:\n${generated.communication_template}`,
      ],
    },
  };
}
