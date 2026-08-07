import { ChevronDown, ChevronUp, ListChecks, Target, Layers } from "lucide-react";
import { useMemo, useState } from "react";

import type { AnswerBlock, AnswerSection } from "../lib/parseRecommendationAnswer";
import { parseRecommendationAnswer } from "../lib/parseRecommendationAnswer";

import { Button } from "@/components/ui/button";
import { sanitizeAnswerText } from "@/shared/lib/sanitizeAnswerText";

const TIER_ACCENT: Record<number, string> = {
  1: "border-l-red-400 bg-red-50/40",
  2: "border-l-amber-400 bg-amber-50/40",
  3: "border-l-slate-300 bg-slate-50/60",
};

function BlockView({ block }: { block: AnswerBlock }) {
  if (block.kind === "paragraph") {
    return <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{block.text}</p>;
  }
  if (block.kind === "bullets") {
    return (
      <ul className="space-y-1">
        {block.items.map((item, i) => (
          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
            <span className="text-slate-400 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "fields") {
    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {block.fields.map((f, i) => (
          <div key={i} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
              {f.label}
            </dt>
            <dd className="text-sm text-slate-800 break-words">{f.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-100">
          <tr>
            {block.headers.map((h, i) => (
              <th key={i} className="text-left font-medium text-slate-600 px-2.5 py-1.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r} className={r % 2 ? "bg-slate-50/60" : "bg-white"}>
              {row.map((cell, c) => (
                <td key={c} className="px-2.5 py-1.5 align-top text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Human-readable summary of what a collapsed section contains. */
function contentSummary(section: AnswerSection): string {
  const counts: string[] = [];
  const bullets = section.blocks
    .filter((b) => b.kind === "bullets")
    .reduce((n, b) => n + (b.kind === "bullets" ? b.items.length : 0), 0);
  const fields = section.blocks
    .filter((b) => b.kind === "fields")
    .reduce((n, b) => n + (b.kind === "fields" ? b.fields.length : 0), 0);
  const tables = section.blocks.filter((b) => b.kind === "table").length;
  const paras = section.blocks.filter((b) => b.kind === "paragraph").length;
  if (paras) counts.push(`${paras} note${paras > 1 ? "s" : ""}`);
  if (bullets) counts.push(`${bullets} point${bullets > 1 ? "s" : ""}`);
  if (fields) counts.push(`${fields} field${fields > 1 ? "s" : ""}`);
  if (tables) counts.push(`${tables} table${tables > 1 ? "s" : ""}`);
  return counts.join(" · ");
}

function SectionCard({ section, defaultOpen }: { section: AnswerSection; defaultOpen: boolean }) {
  const hasContent = section.blocks.length > 0;
  const [open, setOpen] = useState(defaultOpen && hasContent);
  const accent = section.tier ? TIER_ACCENT[section.tier] : "border-l-blue-300 bg-white";
  const preview = useMemo(() => {
    const first = section.blocks.find((b) => b.kind !== "table");
    if (!first) return "";
    if (first.kind === "paragraph") return first.text;
    if (first.kind === "bullets") return first.items.join(" • ");
    if (first.kind === "fields") return first.fields.map((f) => f.label).join(" • ");
    return "";
  }, [section.blocks]);
  const summary = useMemo(() => contentSummary(section), [section]);

  // Sections with nothing to reveal render as static labels — no chevron, no
  // hover/pointer affordance — so only expandable rows look clickable.
  if (!hasContent) {
    return (
      <div
        className={`rounded-md border border-dashed border-slate-200 border-l-2 ${accent} px-2.5 py-1.5`}
      >
        <p className="text-xs font-medium text-slate-500">{section.title}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border border-slate-200 border-l-2 ${accent} transition-colors ${
        open ? "" : "hover:border-slate-300"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-full flex items-start gap-2 px-2.5 py-2 text-left cursor-pointer rounded-md hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{section.title}</p>
            {summary && (
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
                {summary}
              </span>
            )}
          </div>
          {!open && preview && (
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{preview}</p>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {section.blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  /** Raw (un-sanitized) answer text from the backend. */
  answer: string;
}

/**
 * Structured renderer for a recommendation answer. Replaces the truncated prose
 * blob with: a verdict callout, scan chips, and collapsible sections (tier
 * blocks accented by priority). Falls back to plain prose when the answer has
 * no detectable structure.
 */
export default function RecommendationAnswerView({ answer }: Props) {
  const parsed = useMemo(() => parseRecommendationAnswer(answer), [answer]);
  const [allOpen, setAllOpen] = useState(false);

  if (parsed.isPlain) {
    return (
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{sanitizeAnswerText(answer)}</p>
    );
  }

  const tierSections = parsed.sections.filter((s) => s.tier);
  const expandable = parsed.sections.filter((s) => s.blocks.length > 0).length;

  return (
    <div className="space-y-2.5">
      {parsed.verdict && (
        <div className="rounded-md border border-blue-200 bg-blue-50/60 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-blue-700 font-semibold mb-0.5">
            Verdict
          </p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{parsed.verdict}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
          <Layers className="h-3 w-3" />
          {expandable} expandable {expandable === 1 ? "section" : "sections"}
        </span>
        {tierSections.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
          >
            <Target className="h-3 w-3" />
            {s.title}
          </span>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-slate-600 hover:bg-slate-100 ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            setAllOpen((v) => !v);
          }}
        >
          <ListChecks className="h-3 w-3 mr-1" />
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>

      <div className="space-y-1.5">
        {parsed.sections.map((section, i) => (
          <SectionCard
            key={`${section.id}-${allOpen}`}
            section={section}
            defaultOpen={allOpen || i === 0 || section.tier === 1}
          />
        ))}
      </div>
    </div>
  );
}
