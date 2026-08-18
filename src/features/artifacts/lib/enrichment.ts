// Agentic enrichment for the Artefacts lead sheet.
//
// Enrichment is Artefacts-only by design: the inline Signals table stays a fast
// triage surface, while the slow, costly per-lead work happens here. Columns are
// not fixed — the user adds the attribute they need, and the agent fills it.

import { supabase } from "@/integrations/supabase/client";

export interface EnrichmentSuggestion {
  /** Column header written into the sheet. */
  attribute: string;
  /** Extra instruction handed to the agent. */
  instruction: string;
  /** Contact data that only a live data connector (Apollo) can verify. */
  needsConnector?: boolean;
}

/** Suggested attributes offered when adding an enrichment column. */
export const ENRICHMENT_SUGGESTIONS: EnrichmentSuggestion[] = [
  {
    attribute: "Email",
    instruction: "Work email address for this person.",
    needsConnector: true,
  },
  {
    attribute: "Phone number",
    instruction: "Direct or company phone number for this person.",
    needsConnector: true,
  },
  {
    attribute: "LinkedIn",
    instruction: "LinkedIn profile URL for this person.",
    needsConnector: true,
  },
  {
    attribute: "Seniority",
    instruction: "Seniority band implied by the person's title.",
  },
  {
    attribute: "Buying role",
    instruction: "Whether this person is an economic buyer, champion, or influencer, and why.",
  },
  {
    attribute: "Company context",
    instruction: "One line on the company: size, segment, and what it likely cares about.",
  },
  {
    attribute: "Talking point",
    instruction: "The single sharpest opener to use with this person for this signal.",
  },
  {
    attribute: "Objection to expect",
    instruction: "The most likely objection this person raises, in a few words.",
  },
];

export interface EnrichedValue {
  value: string;
  confidence: "high" | "medium" | "low";
}

export interface EnrichLeadsArgs {
  attribute: string;
  instruction?: string;
  /** One row of context per lead — "Name | Title | Company". */
  leads: { name?: string; title?: string; company?: string; extra?: string }[];
  context?: string;
  apolloConnected?: boolean;
}

/** Ask the agent for one value per lead. Throws with a user-facing message. */
export async function enrichLeads({
  attribute,
  instruction,
  leads,
  context,
  apolloConnected,
}: EnrichLeadsArgs): Promise<EnrichedValue[]> {
  const { data, error } = await supabase.functions.invoke("enrich-lead", {
    body: { attribute, instruction, leads, context, apolloConnected },
  });
  if (error) throw new Error(error.message || "Could not enrich these leads.");
  if (data?.error) throw new Error(String(data.error));
  const values = Array.isArray(data?.values) ? data.values : [];
  return leads.map((_, i) => ({
    value: String(values[i]?.value ?? ""),
    confidence: (values[i]?.confidence as EnrichedValue["confidence"]) ?? "low",
  }));
}
