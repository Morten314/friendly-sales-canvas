import { sanitizeAnswerText } from "@/shared/lib/sanitizeAnswerText";

/**
 * Structured model of a recommendation answer.
 *
 * The backend returns one long markdown-ish prose blob (Strategic Framework,
 * Tier 1/2/3 blocks, persona fields, a deprioritise table, an outreach
 * sequence, a message framework). This parser turns that blob into scannable
 * sections/blocks so the UI can render a hierarchy instead of a wall of text.
 * It is display-only: no content is dropped — anything unrecognised falls
 * through as a paragraph block.
 */
export type AnswerBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "fields"; fields: { label: string; value: string }[] }
  | { kind: "table"; headers: string[]; rows: string[][] };

export interface AnswerSection {
  id: string;
  title: string;
  /** Tier number when the heading names a tier (drives the priority accent). */
  tier?: 1 | 2 | 3;
  blocks: AnswerBlock[];
}

export interface ParsedAnswer {
  /** Leading prose before the first heading — the verdict line(s). */
  verdict: string;
  sections: AnswerSection[];
  /** True when nothing structured was found (render as plain prose). */
  isPlain: boolean;
}

const HEADING_RE = /^#{1,6}\s+(.+?)\s*:?\s*$/;
const BOLD_HEADING_RE = /^\*\*(.+?)\*\*\s*:?\s*$/;
const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/;
const FIELD_RE = /^\s*(?:[-*•]\s*)?\*\*(.+?)\*\*\s*[:—-]\s*(.+)$/;

const strip = (s: string) => sanitizeAnswerText(s).trim();

/**
 * Backends often return the whole answer as one run-on blob (headings inline,
 * no newlines). Re-introduce line breaks before recognisable section labels so
 * the line-based parser below can see the structure.
 */
const INLINE_HEADINGS = [
  "Strategic Framework",
  "Recommended Outreach Sequence",
  "Outreach Sequence",
  "Core Message Framework",
  "Message Framework",
  "Message Angle",
  "Key Insight to Lead With",
  "Key Insight",
  "Why High Priority",
  "Why high priority",
  "Hiring Posture",
  "Budget Signal",
  "Reason to Deprioritise Now",
  "Reason to Deprioritize Now",
  "Deprioritise",
  "Execution Checklist",
  "Next Steps",
  "Timing",
  "Summary",
  "Recommendation",
];

function normalizeInlineHeadings(text: string): string {
  const alts = [...INLINE_HEADINGS].sort((a, b) => b.length - a.length).join("|");
  let out = text;
  // One pass: break the line before any known heading (or "Tier N") label.
  out = out.replace(new RegExp(`(?<!\\n)[ \\t]+((?:Tier\\s*[123]|${alts})\\b)`, "g"), "\n$1");
  // Split "Heading: content" onto two lines so the heading stands alone.
  out = out.replace(
    new RegExp(`^((?:Tier\\s*[123][^:\\n]{0,40}|${alts})\\s*[:—-])[ \\t]*(\\S.*)$`, "gm"),
    "$1\n$2",
  );
  // Generic "Some Label:" appearing mid-sentence after a full stop.
  out = out.replace(/([.!?])\s+([A-Z][A-Za-z ]{2,40}:)\s/g, "$1\n$2 ");
  return out;
}

function isTableLine(line: string) {
  return line.trim().startsWith("|") && line.includes("|", 1);
}

function isSeparatorRow(line: string) {
  return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-");
}

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => strip(c));
}

function detectTier(title: string): 1 | 2 | 3 | undefined {
  const m = /tier\s*([123])/i.exec(title);
  return m ? (Number(m[1]) as 1 | 2 | 3) : undefined;
}

function headingOf(rawLine: string): string | null {
  const line = rawLine.trim();
  if (!line) return null;
  // "Tier 1 — Contact immediately" style lines are headings with or without a colon.
  if (/^tier\s*[123]\b/i.test(line) && line.length <= 90) return strip(line.replace(/:$/, ""));
  if (
    line.length <= 90 &&
    INLINE_HEADINGS.some((h) => new RegExp(`^${h}\\s*[:—-]?\\s*$`, "i").test(strip(line)))
  ) {
    return strip(line.replace(/[:—-]\s*$/, ""));
  }
  const h = HEADING_RE.exec(line);
  if (h) return strip(h[1]);
  const b = BOLD_HEADING_RE.exec(line);
  if (b && !/\*\*.*\*\*.*\*\*/.test(line)) return strip(b[1]);
  // Short colon-terminated label lines act as headings too (e.g. "Tier 1 — Contact immediately:")
  if (line.length <= 70 && /:$/.test(line) && !BULLET_RE.test(line) && !line.includes("|")) {
    return strip(line.replace(/:$/, ""));
  }
  return null;
}

/** Parse a raw (un-sanitized) recommendation answer into sections and blocks. */
export function parseRecommendationAnswer(raw: string): ParsedAnswer {
  const text = normalizeInlineHeadings((raw ?? "").replace(/\r\n/g, "\n"));
  if (!text.trim()) return { verdict: "", sections: [], isPlain: true };

  const lines = text.split("\n");
  const sections: AnswerSection[] = [];
  const verdictLines: string[] = [];
  let current: AnswerSection | null = null;

  let paragraph: string[] = [];
  let bullets: string[] = [];
  let fields: { label: string; value: string }[] = [];
  let tableLines: string[] = [];

  const target = () => current?.blocks;

  const flushParagraph = () => {
    const t = strip(paragraph.join(" "));
    paragraph = [];
    if (!t) return;
    if (current) target()!.push({ kind: "paragraph", text: t });
    else verdictLines.push(t);
  };
  const flushBullets = () => {
    const items = bullets.map(strip).filter(Boolean);
    bullets = [];
    if (!items.length) return;
    if (current) target()!.push({ kind: "bullets", items });
    else verdictLines.push(items.join(" • "));
  };
  const flushFields = () => {
    const f = fields;
    fields = [];
    if (!f.length) return;
    if (current) target()!.push({ kind: "fields", fields: f });
    else verdictLines.push(f.map((x) => `${x.label}: ${x.value}`).join(" • "));
  };
  const flushTable = () => {
    const rows = tableLines.filter((l) => !isSeparatorRow(l)).map(splitRow);
    tableLines = [];
    if (!rows.length) return;
    const [headers, ...body] = rows;
    if (!current) {
      current = { id: "table", title: "Details", blocks: [] };
      sections.push(current);
    }
    target()!.push({ kind: "table", headers, rows: body });
  };
  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushFields();
    flushTable();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (isTableLine(line)) {
      flushParagraph();
      flushBullets();
      flushFields();
      tableLines.push(line);
      continue;
    }
    if (tableLines.length) flushTable();

    if (!line.trim()) {
      flushParagraph();
      flushBullets();
      flushFields();
      continue;
    }

    const heading = headingOf(line);
    if (heading) {
      flushAll();
      current = {
        id: `${sections.length}-${heading.slice(0, 32)}`,
        title: heading,
        tier: detectTier(heading),
        blocks: [],
      };
      sections.push(current);
      continue;
    }

    const field = FIELD_RE.exec(line);
    if (field) {
      flushParagraph();
      flushBullets();
      fields.push({ label: strip(field[1]), value: strip(field[2]) });
      continue;
    }
    flushFields();

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();

    paragraph.push(line.trim());
  }
  flushAll();

  const verdict = verdictLines.join("\n\n").trim();
  const nonEmpty = sections.filter((s) => s.blocks.length > 0 || s.title);
  return {
    verdict,
    sections: nonEmpty,
    isPlain: nonEmpty.length === 0,
  };
}
