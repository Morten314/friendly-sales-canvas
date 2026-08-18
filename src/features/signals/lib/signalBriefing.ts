import { Satellite, Target } from "lucide-react";
import type { ComponentType } from "react";

import type { RecommendationArtefactResponse, SignalLeadMapLead } from "../contracts";
import type { NBAItem, SignalCard } from "../types";
import {
  MATCHED_LEADS_COLUMNS,
  matchedLeadsCsvFilename,
  toMatchedLeadRow,
} from "./matchedLeadsCsv";

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

/**
 * Folder name for everything derived from one signal. The folder is the
 * signal's case file: it is created at save time (accepting a signal is triage,
 * saving is intent), and lead sheets, cohort sequences and briefings for the
 * same signal all land in it.
 */
export function signalFolderName(headline: string): string {
  const clean = headline.replace(/\s+/g, " ").trim();
  return clean.length > 64 ? `${clean.slice(0, 61).trimEnd()}…` : clean || "Untitled signal";
}

/** "Name - Title (Company) (Relevance: X): why" — shared by briefing + lead-sheet PDFs. */
function leadFindings(leads: SignalLeadMapLead[]): string[] {
  return leads.map((lead) => {
    const company = lead.company || "Unknown company";
    const who = [lead.name, lead.title].filter(Boolean).join(" - ");
    const head = `${who ? `${who} (${company})` : company} (Relevance: ${titleCase(lead.relevance)})`;
    return lead.why ? `${head}: ${lead.why}` : head;
  });
}

/** Recommendations carried into PDFs: NBAs first, else the signal's next best moves. */
function signalRecommendations(signal: SignalCard): string[] {
  return signal.NBAs && signal.NBAs.length > 0
    ? signal.NBAs.map((n) => n.nba)
    : (signal.nextBestMoves ?? []);
}

/**
 * Artefact recorded when a user accepts a signal. Filed into a date-wise folder
 * ("Accepted Signals — YYYY-MM-DD") and persisted until the user deletes it.
 */
export function buildAcceptedSignalArtefact(signal: SignalCard): ArtefactItem {
  const { agentName, agentIcon, agentColor } = resolveSignalAgentPresentation(signal.agent);
  const day = new Date().toISOString().slice(0, 10);
  const recommendations =
    signal.NBAs && signal.NBAs.length > 0
      ? signal.NBAs.map((n) => n.nba)
      : (signal.nextBestMoves ?? []);

  return {
    id: `accepted-signal-${signal.id}`,
    agentName,
    agentIcon,
    agentColor,
    taskNumber: "Accepted Signal",
    timestamp: signal.timestamp,
    status: "new",
    type: "insight",
    folder: `Accepted Signals — ${day}`,
    actionDelegated: signal.headline,
    contextRationale: signal.snippet,
    systemImpact: "Signal accepted and filed for follow-up",
    actionPerformed: "Accepted signal",
    outputSummary: signal.snippet,
    fullReport: {
      title: signal.headline,
      executiveSummary: signal.description,
      keyFindings: (signal.source ?? []).map((s) => s.citation || s.url).filter(Boolean),
      analysis: signal.description,
      recommendations,
    },
  };
}

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

  // The per-lead `why` rides into the PDF here — it is intentionally never on screen.
  const keyFindings = leadFindings(leads);

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

/**
 * Editable lead-sheet artefact built from the matched-leads CSV view. Stored with
 * a `sheet` payload (not just a CSV blob) so the Artefacts library can render an
 * editable grid users can enrich in place. Filed date-wise, deterministic id so
 * re-saving the same signal updates rather than duplicates.
 */
export function buildLeadSheetArtefact(
  signal: SignalCard,
  leads: SignalLeadMapLead[],
): ArtefactItem {
  const { agentName, agentIcon, agentColor } = resolveSignalAgentPresentation(signal.agent);
  const day = new Date().toISOString().slice(0, 10);
  const rows = leads.map(toMatchedLeadRow);

  return {
    id: `lead-sheet-${signal.id}`,
    agentName,
    agentIcon,
    agentColor,
    taskNumber: "Lead Sheet",
    timestamp: signal.timestamp,
    status: "new",
    type: "enrichment",
    folder: `Lead Sheets — ${day}`,
    actionDelegated: `Matched leads for "${signal.headline}"`,
    contextRationale: signal.snippet,
    systemImpact: `${leads.length} matched lead(s) available for enrichment`,
    actionPerformed: "Saved matched-leads sheet for enrichment",
    outputSummary: `${leads.length} leads across ${MATCHED_LEADS_COLUMNS.length} columns — editable in Artefacts`,
    sheet: {
      filename: matchedLeadsCsvFilename(signal.headline),
      columns: [...MATCHED_LEADS_COLUMNS],
      rows,
    },
    fullReport: {
      title: `${signal.headline} — Matched leads`,
      executiveSummary: signal.description,
      keyFindings: leadFindings(leads),
      analysis: `These ${leads.length} leads were matched to the signal based on ICP fit and the signal's context.`,
      recommendations: signalRecommendations(signal),
    },
  };
}

/**
 * One outreach touch (email / LinkedIn / call copy) saved as its own artefact so
 * the drafted copy survives outside the Signals card. Deterministic id per
 * signal + cohort + touch so re-saving updates rather than duplicates.
 */
export function buildCohortOutreachArtefact(
  signal: Pick<SignalCard, "id" | "agent" | "headline" | "snippet" | "timestamp">,
  cohortLabel: string,
  touches: { day: number; channel: string; action: string; subject?: string; body: string }[],
  recipients: SignalLeadMapLead[] = [],
): ArtefactItem {
  const { agentName, agentIcon, agentColor } = resolveSignalAgentPresentation(signal.agent);
  const day = new Date().toISOString().slice(0, 10);
  const slug = cohortLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const to = recipients
    .map((l) => (l.email ? `${l.name || "Unknown"} <${l.email}>` : l.name || "Unknown"))
    .filter(Boolean);

  return {
    id: `outreach-cohort-${signal.id}-${slug}`,
    agentName,
    agentIcon,
    agentColor,
    taskNumber: "Outreach Copy",
    timestamp: signal.timestamp,
    status: "new",
    type: "playbook",
    folder: `Outreach Copy — ${day}`,
    actionDelegated: `${cohortLabel} · full sequence`,
    contextRationale: signal.snippet,
    systemImpact: `${recipients.length} recipient(s) in ${cohortLabel}`,
    actionPerformed: "Saved the cohort's outreach sequence from the signal's next steps",
    outputSummary: `${touches.length} touch(es) for ${cohortLabel}`,
    // Chronological record: signal + blurb (above), this cohort's leads (sheet),
    // then this cohort's sequence (editable). Other cohorts are never included.
    sheet: {
      filename: matchedLeadsCsvFilename(`${signal.headline}-${cohortLabel}`),
      columns: [...MATCHED_LEADS_COLUMNS],
      rows: recipients.map(toMatchedLeadRow),
    },
    sequence: touches.map((t) => ({ ...t })),
    fullReport: {
      title: `${signal.headline} — ${cohortLabel} outreach sequence`,
      executiveSummary: signal.snippet,
      keyFindings: [
        ...(to.length ? [`To: ${to.join("; ")}`] : []),
        ...leadFindings(recipients),
      ],
      analysis: touches
        .map((t) =>
          [
            `Day ${t.day} · ${t.channel} — ${t.action}`,
            t.subject ? `Subject: ${t.subject}` : "",
            t.body,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n———\n\n"),
      recommendations: [],
    },
  };
}

export function buildOutreachCopyArtefact(
  signal: Pick<SignalCard, "id" | "agent" | "headline" | "snippet" | "timestamp">,
  cohortLabel: string,
  touch: { day: number; channel: string; action: string; subject?: string; body: string },
  recipients: SignalLeadMapLead[] = [],
): ArtefactItem {
  const { agentName, agentIcon, agentColor } = resolveSignalAgentPresentation(signal.agent);
  const day = new Date().toISOString().slice(0, 10);
  const slug = `${cohortLabel}-${touch.day}-${touch.channel}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const to = recipients
    .map((l) => (l.email ? `${l.name || "Unknown"} <${l.email}>` : l.name || "Unknown"))
    .filter(Boolean);

  return {
    id: `outreach-copy-${signal.id}-${slug}`,
    agentName,
    agentIcon,
    agentColor,
    taskNumber: "Outreach Copy",
    timestamp: signal.timestamp,
    status: "new",
    type: "playbook",
    folder: `Outreach Copy — ${day}`,
    actionDelegated: `${cohortLabel} · Day ${touch.day} ${touch.channel}`,
    contextRationale: signal.snippet,
    systemImpact: `${recipients.length} recipient(s) in ${cohortLabel}`,
    actionPerformed: "Saved outreach copy from the signal's next steps",
    outputSummary: touch.subject || touch.action,
    fullReport: {
      title: `${signal.headline} — ${cohortLabel} · Day ${touch.day} ${touch.channel}`,
      executiveSummary: touch.subject ? `Subject: ${touch.subject}` : touch.action,
      keyFindings: to.length ? [`To: ${to.join("; ")}`] : [],
      analysis: touch.body,
      recommendations: [],
    },
  };
}
