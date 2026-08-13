import type { SignalLeadMapLead } from "../contracts";

/**
 * Links a recommendation to the matched leads it actually concerns.
 *
 * The backend does not tag recommendations with lead ids, so this is a
 * deterministic, display-only heuristic: score each lead by how much its
 * rationale/title/company overlaps with the recommendation text; when nothing
 * meaningfully overlaps, fall back to the relevance tier the recommendation's
 * position implies (first recommendation -> high, then medium, then low).
 * The basis is surfaced in the UI so the reader knows which one produced the set.
 */
export type RecommendationLeadBasis = "keyword" | "tier";

export interface RecommendationLeadLink {
  leads: SignalLeadMapLead[];
  basis: RecommendationLeadBasis;
  /** Human label for the fallback tier, e.g. "high relevance". */
  tierLabel?: string;
}

const STOP_WORDS = new Set([
  "the","and","for","with","that","this","from","into","your","their","them","they",
  "are","was","were","has","have","had","will","would","should","could","can","may",
  "about","over","under","than","then","them","these","those","onto","upon","out",
  "lead","leads","team","teams","use","using","new","now","more","most","also","its",
  "who","what","when","where","which","how","why","you","our","one","two","all","any",
]);

const tokenize = (text: string): Set<string> =>
  new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
  );

const TIERS: Array<{ key: "high" | "medium" | "low"; label: string }> = [
  { key: "high", label: "high relevance" },
  { key: "medium", label: "medium relevance" },
  { key: "low", label: "low relevance" },
];

export function leadsForRecommendation(
  recommendation: string,
  leads: SignalLeadMapLead[],
  index = 0,
): RecommendationLeadLink {
  if (leads.length === 0) return { leads: [], basis: "tier" };

  const recTokens = tokenize(recommendation);
  if (recTokens.size > 0) {
    const scored = leads
      .map((lead) => {
        const leadTokens = tokenize(`${lead.why} ${lead.title} ${lead.company} ${lead.seniority}`);
        let score = 0;
        recTokens.forEach((t) => {
          if (leadTokens.has(t)) score += 1;
        });
        return { lead, score };
      })
      .filter((s) => s.score >= 2)
      .sort((a, b) => b.score - a.score);
    if (scored.length > 0) {
      return { leads: scored.map((s) => s.lead), basis: "keyword" };
    }
  }

  // Fallback: the tier this recommendation's position maps to, skipping empty tiers.
  const populated = TIERS.filter((t) => leads.some((l) => l.relevance === t.key));
  const tier = populated[Math.min(index, Math.max(populated.length - 1, 0))] ?? TIERS[0];
  return {
    leads: leads.filter((l) => l.relevance === tier.key),
    basis: "tier",
    tierLabel: tier.label,
  };
}
