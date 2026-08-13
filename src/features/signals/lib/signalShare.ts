import type { SignalLeadMapLead } from "../contracts";
import type { SignalCard } from "../types";

import {
  buildMatchedLeadsCsv,
  matchedLeadsCsvFilename,
  slugifySignal,
} from "./matchedLeadsCsv";
import { buildSignalBriefingArtefact } from "./signalBriefing";

import { buildArtefactPdfBlob } from "@/features/artifacts";

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

export function signalPdfFilename(headline: string): string {
  return `${slugifySignal(headline)}-signal-summary.pdf`;
}

/** Download both deliverables for a signal: the matched-leads CSV and the summary PDF. */
export function downloadSignalBundle(signal: SignalCard, leads: SignalLeadMapLead[]): void {
  const csvBlob = new Blob([`\uFEFF${buildMatchedLeadsCsv(leads)}`], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(csvBlob, matchedLeadsCsvFilename(signal.headline));
  const pdfBlob = buildArtefactPdfBlob(buildSignalBriefingArtefact(signal, leads));
  triggerDownload(pdfBlob, signalPdfFilename(signal.headline));
}

/**
 * Browsers cannot attach local files to a webmail compose window, so sharing
 * downloads both files and opens a pre-filled Gmail/Outlook draft naming them.
 */
export function shareSignalByEmail(
  provider: MailProvider,
  signal: SignalCard,
  leads: SignalLeadMapLead[],
): void {
  downloadSignalBundle(signal, leads);

  const subject = `Signal: ${signal.headline}`;
  const body = [
    signal.headline,
    "",
    signal.snippet || signal.description || "",
    "",
    `${leads.length} matched lead(s) attached.`,
    "",
    "Attached files (just downloaded to your device — attach them to this email):",
    `- ${matchedLeadsCsvFilename(signal.headline)}`,
    `- ${signalPdfFilename(signal.headline)}`,
  ].join("\n");

  const url =
    provider === "gmail"
      ? `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}