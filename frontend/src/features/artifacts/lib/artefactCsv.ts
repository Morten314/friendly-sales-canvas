import type { ArtefactItem, ArtefactLeadRow } from "../types";

// Single source of truth for the column order (must match the spec §2 schema).
const CSV_HEADERS = [
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

// Cell order MUST match CSV_HEADERS exactly.
const rowToCells = (r: ArtefactLeadRow): string[] => [
  r.name,
  r.title,
  r.seniority,
  r.company,
  r.email,
  r.emailStatus,
  r.linkedin,
  r.phone,
  r.relevance,
  r.why,
];

// CWE-1236: a cell beginning =, +, -, or @ is evaluated as a formula by Excel/
// Sheets/LibreOffice. Prefix a single quote so it renders as literal text. The
// `Why` text is LLM-generated and Name/Email/Company come from external sources,
// so RFC-4180 quoting alone (below) does NOT prevent this.
// Tradeoff: on plain-CSV import the leading ' is itself visible, so a +E.164
// phone exports as '+1-555... — an accepted MVP artifact (see plan Global
// Constraints), pinned by a Phone test. Kept uniform, not column-exempted.
const guardFormula = (value: string): string => (/^[=+\-@]/.test(value) ? `'${value}` : value);

// RFC-4180: wrap in double quotes when the (already formula-guarded) value
// contains a comma, double-quote, CR or LF; double any embedded double-quote.
const escapeCsvCell = (value: string): string => {
  const guarded = guardFormula(value);
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

/** Header + one CRLF-separated record per row. No BOM (added at download time). */
export const buildLeadsCsv = (rows: ArtefactLeadRow[]): string => {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(rowToCells(r).map(escapeCsvCell).join(","));
  }
  return lines.join("\r\n");
};

// UTF-8 BOM so Excel opens the file as UTF-8 (correct rendering of non-ASCII
// names). CSV is plain text, so it avoids the PDF's Unicode-font limitation
// (TD-FE-78).
const UTF8_BOM = String.fromCharCode(0xfeff); // UTF-8 BOM (U+FEFF)

/** Download the matched-leads CSV for an artefact. No-op when it has no rows. */
export const generateAndDownloadCsv = (artefact: ArtefactItem): void => {
  const rows = artefact.leadRows;
  if (!rows?.length) return;
  const content = UTF8_BOM + buildLeadsCsv(rows);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  // Slug derived from the title exactly like the PDF, plus a `-leads-` marker
  // and a uniquifier so re-saving doesn't overwrite the prior file.
  const slug = artefact.fullReport.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  link.download = `${slug}-leads-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
