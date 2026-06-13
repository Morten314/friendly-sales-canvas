export type LeadSourceFilter = "all" | "csv" | "apollo";

export const LEAD_SOURCE_OPTIONS: ReadonlyArray<{ value: LeadSourceFilter; label: string }> = [
  { value: "all", label: "All leads" },
  { value: "csv", label: "CSV only" },
  { value: "apollo", label: "Apollo only" },
];

/** Filter on a lead's `source`. Apollo leads carry source==="apollo"; everything
 *  else (csv uploads, legacy "HubSpot"/"Prospect List" mock sources) is the CSV bucket. */
export function filterLeadsBySource<T extends { source?: string | null }>(
  leads: T[],
  filter: LeadSourceFilter,
): T[] {
  if (filter === "all") return leads;
  if (filter === "apollo") return leads.filter((l) => (l.source ?? "").toLowerCase() === "apollo");
  return leads.filter((l) => (l.source ?? "").toLowerCase() !== "apollo");
}
