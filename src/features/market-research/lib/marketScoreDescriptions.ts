/** Response from GET /leads/{lead_id}/market-score-descriptions */
export interface MarketScoreDescriptionsResponse {
  lead_id: string;
  org_id: string;
  combined_score: number;
  scored_at?: string;
  descriptions: Record<string, string>;
}

/** Maps REPORT_COLUMNS `key` → keys returned in API `descriptions` */
export const REPORT_KEY_TO_DESCRIPTION_LABEL: Record<string, string> = {
  "market-size": "market size & opportunity",
  "industry-trends": "industry trends report",
  "competitor-landscape": "competitor landscape",
  "regulatory-compliance": "regulatory & compliance highlights",
  "market-entry": "market entry & growth strategy",
};

/**
 * Resolve narrative text for a report column from GET .../market-score-descriptions.
 */
export function getDescriptionTextForColumn(
  response: MarketScoreDescriptionsResponse | undefined,
  reportColumnKey: string,
): string | undefined {
  if (!response?.descriptions) return undefined;
  const canonical = REPORT_KEY_TO_DESCRIPTION_LABEL[reportColumnKey];
  if (!canonical) return undefined;
  const d = response.descriptions;
  if (d[canonical]) return d[canonical];
  const lower = canonical.toLowerCase();
  const hit = Object.entries(d).find(([k]) => k.toLowerCase().trim() === lower);
  return hit?.[1];
}
