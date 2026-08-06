import type { SignalLeadMapLead } from "../contracts";

/** Column order mirrors the exported prospect sheet. */
export const MATCHED_LEADS_COLUMNS = [
  "Name",
  "Title",
  "Seniority",
  "Company",
  "Email",
  "Email status",
  "LinkedIn",
  "Phone",
  "Relevance",
  "Why",
] as const;

const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const slugifySignal = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "signal";

/** One row per lead, in MATCHED_LEADS_COLUMNS order. */
export function toMatchedLeadRow(lead: SignalLeadMapLead): string[] {
  return [
    lead.name ?? "",
    lead.title ?? "",
    lead.seniority ?? "",
    lead.company ?? "",
    lead.email ?? "",
    lead.email_status ?? "",
    lead.linkedin ?? "",
    lead.phone ?? "",
    lead.relevance ?? "",
    lead.why ?? "",
  ];
}

export function buildMatchedLeadsCsv(leads: SignalLeadMapLead[]): string {
  const rows = [[...MATCHED_LEADS_COLUMNS], ...leads.map(toMatchedLeadRow)];
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function matchedLeadsCsvFilename(headline: string): string {
  return `${slugifySignal(headline)}-matched-leads.csv`;
}

export function downloadMatchedLeadsCsv(headline: string, leads: SignalLeadMapLead[]) {
  const blob = new Blob([`\uFEFF${buildMatchedLeadsCsv(leads)}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = matchedLeadsCsvFilename(headline);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}