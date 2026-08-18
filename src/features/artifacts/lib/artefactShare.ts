import { buildArtefactPdfBlob } from "./artefactPdf";
import { sheetToCsv } from "./artefactStore";

import type { ArtefactItem } from "../types";

export type MailProvider = "gmail" | "outlook";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Browsers cannot attach local files to a webmail compose window, so "Send"
 * downloads the sheet CSV + briefing PDF and opens a pre-filled draft naming them.
 */
export function shareArtefactByEmail(provider: MailProvider, artefact: ArtefactItem): void {
  const pdfName = `${artefact.fullReport.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  const files: string[] = [];

  if (artefact.sheet) {
    const csv = sheetToCsv(artefact.sheet.columns, artefact.sheet.rows);
    triggerDownload(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }), artefact.sheet.filename);
    files.push(artefact.sheet.filename);
  }
  triggerDownload(buildArtefactPdfBlob(artefact), pdfName);
  files.push(pdfName);

  const subject = artefact.fullReport.title;
  const body = [
    artefact.fullReport.title,
    "",
    artefact.contextRationale || artefact.fullReport.executiveSummary || "",
    "",
    "Attached files (just downloaded to your device — attach them to this email):",
    ...files.map((f) => `- ${f}`),
  ].join("\n");

  const url =
    provider === "gmail"
      ? `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}