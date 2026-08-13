import type { StrategistContext } from "@/features/strategist/types";

import type { SignalLeadMapLead } from "../contracts";
import type { SignalCard as SignalCardType } from "../types";

/**
 * Build a Strategist handoff payload from a signal and a subset of its matched
 * leads. Strategist reads this from sessionStorage ("strategistContext") on
 * mount, then owns the per-cohort sequence building + execution.
 *
 * Per-cohort sends pass `cohortLabel` so Strategist's trigger prompt names the
 * cohort; a collective send leaves it undefined.
 */
export function buildStrategistContextFromSignal(
  signal: SignalCardType,
  leads: SignalLeadMapLead[],
  cohortLabel?: string,
): StrategistContext {
  const trigger = cohortLabel
    ? `${cohortLabel} for "${signal.headline}". ${signal.snippet}`.trim()
    : `Matched leads for "${signal.headline}". ${signal.snippet}`.trim();

  return {
    leads: leads.map((l) => ({
      name: l.name || "Unknown",
      company: l.company || "Unknown company",
      jobTitle: l.title || "",
      email: l.email || undefined,
      source: l.linkedin || undefined,
      signals: [signal.headline],
    })),
    opportunity: signal.headline,
    triggerPrompt: trigger,
    autoSequence: true,
  };
}

/** Persist the handoff payload and let the caller navigate to Strategist. */
export function writeStrategistContext(context: StrategistContext): void {
  sessionStorage.setItem("strategistContext", JSON.stringify(context));
}
