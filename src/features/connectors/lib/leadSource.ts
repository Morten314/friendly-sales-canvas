export type LeadSource = "apollo" | "csv" | "manual" | "unknown";
export type LeadSourceFilter = "all" | LeadSource;

export const LEAD_SOURCE_OPTIONS: ReadonlyArray<{ value: LeadSourceFilter; label: string }> = [
  { value: "all", label: "All leads" },
  { value: "apollo", label: "Apollo" },
  { value: "csv", label: "CSV / Excel" },
  { value: "manual", label: "Manual" },
  { value: "unknown", label: "Unknown" },
];

const KNOWN_SOURCES: ReadonlySet<string> = new Set(["apollo", "csv", "manual"]);

/** Normalize a raw lead `source` to the canonical taxonomy. Unrecognized, empty,
 *  null, or legacy values (e.g. "HubSpot", "Prospect List") collapse to "unknown". */
export function normalizeLeadSource(raw: string | null | undefined): LeadSource {
  const v = (raw ?? "").trim().toLowerCase();
  return (KNOWN_SOURCES.has(v) ? v : "unknown") as LeadSource;
}

/** Exact-match filter on a lead's normalized `source`. */
export function filterLeadsBySource<T extends { source?: string | null }>(
  leads: T[],
  filter: LeadSourceFilter,
): T[] {
  if (filter === "all") return leads;
  return leads.filter((l) => normalizeLeadSource(l.source) === filter);
}
