/**
 * Context passed when opening Chat with Scout from Your Lead Stream (sessionStorage).
 * Consumed by ScoutChatWithHistory on mount.
 */

export const LEAD_STREAM_CHAT_CONTEXT_KEY = "leadStreamChatContext";

export interface LeadStreamChatContext {
  /** Primary contact when single lead */
  personName?: string;
  company?: string;
  industry?: string;
  source?: string;
  /** Opening line in Scout’s greeting card */
  customMessage?: string;
  suggestedQuestions?: string[];
  /** e.g. "Researching Sarah Chen — Acme Corp" */
  workspaceLine?: string;
  /** Chat history list title */
  sessionTitle?: string;
  leadCount?: number;
  leadSummaries?: { name: string; company: string; source?: string }[];
}

const SUGGESTED_SINGLE_LEAD: string[] = [
  "Is this prospect a decision maker?",
  "Best person to contact, or reach someone else?",
  "How long in their current role?",
  "Recently promoted or newly hired?",
  "What roles before this position?",
  "Summarize recent LinkedIn activity",
  "Signals company needs our solution?",
];

const SUGGESTED_MULTI_LEAD: string[] = [
  "Which leads should we prioritize first?",
  "What patterns do you see across these accounts?",
  "Any risks or red flags in this set?",
  "Suggest an outreach sequence for the top fits",
  "How do these align with our ICP?",
];

/** Minimal shape consumed by buildLeadStreamChatContext — anything extra is ignored. */
interface LeadInput {
  name?: string;
  company?: string;
  industry?: unknown;
  source?: unknown;
}

export function buildLeadStreamChatContext(
  leads: LeadInput[],
  reportFilter?: string,
): LeadStreamChatContext {
  const segmentPrompt =
    reportFilter && reportFilter.startsWith("Find more accounts") ? reportFilter : undefined;

  if (!leads?.length) {
    return {
      sessionTitle: "Ask Scout about leads",
      customMessage: "I'm ready to discuss your lead stream. What would you like to know?",
      suggestedQuestions: SUGGESTED_MULTI_LEAD,
      workspaceLine: "Lead stream overview",
    };
  }

  if (leads.length === 1) {
    const l = leads[0];
    const personName = l.name ?? "Contact";
    const company = l.company ?? "Company";
    const source = typeof l.source === "string" ? l.source : undefined;
    let custom = `I've loaded full context on ${personName}. What would you like to know?`;
    if (segmentPrompt) {
      custom = `${custom} You also asked: ${segmentPrompt}`;
    }
    return {
      personName,
      company,
      source,
      industry: typeof l.industry === "string" ? l.industry : undefined,
      sessionTitle: `Research: ${personName}`,
      workspaceLine: `Researching ${personName} — ${company}`,
      customMessage: custom,
      suggestedQuestions: SUGGESTED_SINGLE_LEAD,
    };
  }

  const leadSummaries = leads.slice(0, 24).map((l) => ({
    name: l.name ?? "Contact",
    company: l.company ?? "—",
    source: typeof l.source === "string" ? l.source : undefined,
  }));

  let custom = `I've loaded context on ${leads.length} leads. What would you like to explore?`;
  if (segmentPrompt) {
    custom = `${custom} (${segmentPrompt})`;
  }

  return {
    leadCount: leads.length,
    leadSummaries,
    sessionTitle: `Chat: ${leads.length} leads`,
    workspaceLine: `Researching ${leads.length} leads from your stream`,
    customMessage: custom,
    suggestedQuestions: SUGGESTED_MULTI_LEAD,
  };
}
