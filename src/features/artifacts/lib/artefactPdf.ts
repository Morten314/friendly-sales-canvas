import { jsPDF } from "jspdf";

import type { ArtefactItem } from "../types";

import { sanitizeAnswerText } from "@/shared/lib/sanitizeAnswerText";

// jsPDF owns PDF string encoding, so structural ( ) \ escaping is no longer
// needed. We keep ASCII-folding as a WinAnsi safety net: jsPDF's default
// Helvetica still mojibakes em/en dashes, smart quotes and bullets. (Residual
// non-ASCII such as accented names remains an accepted limitation — the
// Unicode-font-embedding half of TD-FE-78 stays open; no font is embedded here.)
export const escapePdfText = (input: string): string =>
  (input ?? "")
    .replace(/[–—]/g, "-")
    .replace(/['']/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, "-");

const MARGIN = 50;
const RULE_COLOR: [number, number, number] = [190, 190, 190];

/** Build a structurally valid, wrapped + paginated PDF for an ArtefactItem. */
export const buildArtefactPdfDoc = (artefact: ArtefactItem): jsPDF => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  const lineHeight = () => doc.getLineHeight() / doc.internal.scaleFactor;
  const ensureSpace = () => {
    if (y + lineHeight() > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const writeBlock = (
    text: string,
    fontSize: number,
    bold: boolean,
    opts: { indent?: number; italic?: boolean; gray?: boolean } = {},
  ) => {
    const indent = opts.indent ?? 0;
    doc.setFont("helvetica", opts.italic ? "italic" : bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(opts.gray ? 110 : 20);
    const lines = doc.splitTextToSize(
      escapePdfText(text || ""),
      maxWidth - indent,
    ) as string[];
    for (const line of lines) {
      ensureSpace();
      doc.text(line, MARGIN + indent, y);
      y += lineHeight();
    }
    doc.setTextColor(20);
  };
  const gap = (pts: number) => {
    y += pts;
  };
  const rule = () => {
    ensureSpace();
    doc.setDrawColor(...RULE_COLOR);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 8;
  };
  /** Numbered section heading with an underline rule. */
  let sectionNo = 0;
  const section = (title: string) => {
    sectionNo += 1;
    gap(6);
    if (y + 40 > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    writeBlock(`${sectionNo}. ${title.toUpperCase()}`, 12, true);
    rule();
  };

  const { fullReport } = artefact;

  // --- Cover block -------------------------------------------------------
  writeBlock("SIGNAL BRIEFING", 9, true, { gray: true });
  gap(6);
  writeBlock(fullReport.title, 18, true);
  gap(6);
  writeBlock(
    `Prepared by ${artefact.agentName}  |  ${artefact.timestamp}  |  Task ID ${artefact.taskNumber}`,
    9,
    false,
    { gray: true },
  );
  gap(8);
  rule();
  gap(4);

  section("Executive summary");
  writeBlock(fullReport.executiveSummary, 10, false);
  gap(6);

  if (fullReport.keyFindings?.length) {
    section("Key findings");
    fullReport.keyFindings.forEach((f, i) => {
      writeBlock(`${i + 1}.`, 10, true);
      y -= lineHeight();
      writeBlock(f, 10, false, { indent: 18 });
      gap(4);
    });
    gap(4);
  }

  if (fullReport.analysis) {
    section("Analysis");
    writeBlock(fullReport.analysis, 10, false);
    gap(6);
  }

  if (fullReport.recommendations?.length) {
    section("Recommendations");
    fullReport.recommendations.forEach((r, i) => {
      writeBlock(`${i + 1}.`, 10, true);
      y -= lineHeight();
      writeBlock(r, 10, false, { indent: 18 });
      gap(4);
    });
    gap(4);
  }

  const answers = fullReport.recommendationAnswers ?? [];
  if (answers.length > 0) {
    section("Recommendation deep dives");
    answers.forEach((qa, i) => {
      if (y + 60 > pageHeight - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      writeBlock(`Deep dive ${i + 1}`, 8, true, { gray: true });
      writeBlock(qa.question, 11, true);
      gap(2);
      writeBlock(sanitizeAnswerText(qa.answer), 10, false, { indent: 12 });
      gap(10);
    });
  }

  const sequence = artefact.sequence ?? [];
  if (sequence.length > 0) {
    section("Detailed outreach plan");
    writeBlock("Timeline at a glance", 10, true);
    gap(2);
    sequence.forEach((touch, i) => {
      writeBlock(
        `Step ${i + 1}  -  Day ${touch.day}  -  ${touch.channel}  -  ${touch.action}`,
        9,
        false,
        { indent: 12 },
      );
    });
    gap(10);

    writeBlock("Message templates", 10, true);
    gap(4);
    sequence.forEach((touch, i) => {
      if (y + 70 > pageHeight - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      writeBlock(
        `Step ${i + 1} - Day ${touch.day} - ${touch.channel}`,
        8,
        true,
        { gray: true },
      );
      writeBlock(touch.action, 11, true);
      if (touch.subject) writeBlock(`Subject: ${touch.subject}`, 10, true, { indent: 12 });
      gap(2);
      writeBlock(touch.body, 10, false, { indent: 12 });
      gap(10);
    });
  }

  gap(4);
  rule();
  writeBlock(`Generated by Brewra AI - ${new Date().toLocaleDateString()}`, 8, false, {
    gray: true,
  });

  return doc;
};

export const buildArtefactPdfBlob = (artefact: ArtefactItem): Blob =>
  buildArtefactPdfDoc(artefact).output("blob");

export const generateAndDownloadPDF = (artefact: ArtefactItem): void => {
  const blob = buildArtefactPdfBlob(artefact);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const slug = artefact.fullReport.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  // Short uniquifier so re-saving the same artefact doesn't overwrite the prior file.
  link.download = `${slug}-${Date.now()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
