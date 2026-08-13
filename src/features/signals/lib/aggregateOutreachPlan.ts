import type { SignalLeadMapLead } from "../contracts";

export interface OutreachPlanStep {
  /** Cohort label, e.g. "High relevance (4)". */
  label: string;
  /** When to move on this cohort. */
  timing: string;
  /** How to approach them. */
  move: string;
}

export interface AggregateOutreachPlan {
  /** One-line framing of the whole approach. */
  summary: string;
  steps: OutreachPlanStep[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Derives a single aggregated outreach plan for a signal from the relevance
 * spread of its matched leads. Display-only: no backend call, deterministic,
 * so the inline table can end with "what to do next" instead of a per-row
 * column. Execution of these steps happens in Strategist.
 */
export function buildAggregateOutreachPlan(
  leads: SignalLeadMapLead[],
  suggestedAction?: string,
): AggregateOutreachPlan | null {
  if (!leads.length) return null;

  const high = leads.filter((l) => l.relevance === "high");
  const medium = leads.filter((l) => l.relevance === "medium");
  const low = leads.filter((l) => l.relevance !== "high" && l.relevance !== "medium");

  const steps: OutreachPlanStep[] = [];
  if (high.length) {
    steps.push({
      label: `High relevance · ${plural(high.length, "lead")}`,
      timing: "Within 48 hours",
      move: "Personalised 1:1 outreach citing this signal directly, then a call ask.",
    });
  }
  if (medium.length) {
    steps.push({
      label: `Medium relevance · ${plural(medium.length, "lead")}`,
      timing: "This week",
      move: "Lightly tailored sequence framing the signal as market context, not a pitch.",
    });
  }
  if (low.length) {
    steps.push({
      label: `Low relevance · ${plural(low.length, "lead")}`,
      timing: "Nurture",
      move: "Add to the newsletter or a quarterly check-in; no direct ask yet.",
    });
  }

  const lead = high.length
    ? `Lead with the ${plural(high.length, "high-relevance lead")} — they carry the strongest fit to this signal.`
    : medium.length
      ? "No high-relevance leads here: run this as a measured, context-first play."
      : "Low-signal cohort: nurture rather than outreach.";

  return {
    summary: suggestedAction?.trim() ? `${lead} ${suggestedAction.trim()}` : lead,
    steps,
  };
}
