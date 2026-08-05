import type { SignalLeadMapLead } from "../contracts";

/**
 * Placeholder matched leads shown when the backend mapping is empty (e.g. the
 * org has no leads uploaded yet), so "Find Matched Leads" still demonstrates the
 * flow. Deterministic per signal id — remove once real leads are synced.
 */
const DEMO_POOL: Omit<SignalLeadMapLead, "lead_id">[] = [
  {
    company: "Northwind Analytics",
    relevance: "high",
    why: "Series B SaaS scaling GTM in EMEA — matches the signal's ICP profile.",
  },
  {
    company: "Kestrel Cloud",
    relevance: "high",
    why: "Recently posted 12 sales roles, indicating active pipeline expansion.",
  },
  {
    company: "Lumen Retail Group",
    relevance: "medium",
    why: "Mid-market buyer with adjacent use case; needs qualification.",
  },
  {
    company: "Brightpath Logistics",
    relevance: "medium",
    why: "Operates in a target vertical but revenue stage is unconfirmed.",
  },
  {
    company: "Vela Health",
    relevance: "low",
    why: "Peripheral fit — monitor for a stronger trigger before outreach.",
  },
];

export function getDemoMatchedLeads(signalId: string): SignalLeadMapLead[] {
  const seed = Array.from(signalId).reduce((n, c) => n + c.charCodeAt(0), 0);
  const count = 3 + (seed % 3); // 3–5 leads
  return Array.from({ length: count }, (_, i) => {
    const base = DEMO_POOL[(seed + i) % DEMO_POOL.length];
    return { ...base, lead_id: `demo-${signalId}-${i}` };
  });
}
