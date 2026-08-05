interface CsvLead {
  company?: string;
  relevance?: string;
  why?: string;
}

const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "signal";

export function downloadMatchedLeadsCsv(headline: string, leads: CsvLead[]) {
  const rows = [
    ["Signal", "Company", "Relevance", "Why it matches"],
    ...leads.map((lead) => [headline, lead.company ?? "", lead.relevance ?? "", lead.why ?? ""]),
  ];
  const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(headline)}-matched-leads.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
