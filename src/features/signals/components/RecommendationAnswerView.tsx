import { ChevronDown, ChevronUp, Layers, ListChecks, Route, Square, Target } from "lucide-react";
import { useMemo, useState } from "react";

import type { AnswerBlock, AnswerSection } from "../lib/parseRecommendationAnswer";
import { parseRecommendationAnswer } from "../lib/parseRecommendationAnswer";

import { Button } from "@/components/ui/button";
import { sanitizeAnswerText } from "@/shared/lib/sanitizeAnswerText";

/* -------------------------------------------------------------------------- */
/* Grouping                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Section titles that always start a new top-level group. Everything else that
 * follows a tier heading is treated as an attribute of that tier (e.g. "Why
 * High Priority", "Hiring Posture", "Budget Signal") and is nested inside it,
 * so the reader sees one card per decision instead of a flat list of labels.
 */
const MAJOR_RE =
  /^(strategic framework|recommended outreach sequence|outreach sequence|core message framework|message framework|execution checklist|next steps|summary|recommendation|details)\b/i;

type GroupKind = "framework" | "tier" | "sequence" | "message" | "checklist" | "other";

interface Group {
  id: string;
  title: string;
  kind: GroupKind;
  tier?: 1 | 2 | 3;
  head: AnswerSection;
  attributes: AnswerSection[];
}

function kindOf(section: AnswerSection): GroupKind {
  if (section.tier) return "tier";
  const t = section.title.toLowerCase();
  if (/sequence|cadence|touchpoint|next steps/.test(t)) return "sequence";
  if (/message|angle|insight/.test(t)) return "message";
  if (/checklist|execution/.test(t)) return "checklist";
  if (/framework|strategy|strategic/.test(t)) return "framework";
  return "other";
}

function groupSections(sections: AnswerSection[]): Group[] {
  const groups: Group[] = [];
  for (const section of sections) {
    const last = groups[groups.length - 1];
    const isMajor = section.tier || MAJOR_RE.test(section.title);
    if (!isMajor && last && last.kind === "tier") {
      last.attributes.push(section);
      continue;
    }
    groups.push({
      id: section.id,
      title: section.title,
      kind: kindOf(section),
      tier: section.tier,
      head: section,
      attributes: [],
    });
  }
  return groups;
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                      */
/* -------------------------------------------------------------------------- */

/** Split a run-on paragraph into discrete steps for sequence/checklist views. */
function toSteps(blocks: AnswerBlock[]): string[] {
  const steps: string[] = [];
  for (const block of blocks) {
    if (block.kind === "bullets") steps.push(...block.items);
    else if (block.kind === "paragraph") {
      const parts = block.text
        .split(/(?<=[.;])\s+(?=(?:Day\s*\d|Week\s*\d|Step\s*\d|[A-Z]))/)
        .map((s) => s.trim())
        .filter(Boolean);
      steps.push(...parts);
    } else if (block.kind === "fields") {
      steps.push(...block.fields.map((f) => `${f.label}: ${f.value}`));
    }
  }
  return steps;
}

function TableView({ block }: { block: Extract<AnswerBlock, { kind: "table" }> }) {
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

function BlockView({ block }: { block: AnswerBlock }) {
  if (block.kind === "paragraph") {
    return (
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{block.text}</p>
    );
  }
  if (block.kind === "bullets") {
    return (
      <ul className="space-y-1">
        {block.items.map((item, i) => (
          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 rounded-full bg-slate-400 shrink-0" />
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
  return <TableView block={block} />;
}

/** Numbered timeline used for outreach sequences. */
function StepsView({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-slate-900 text-white text-[10px] font-semibold flex items-center justify-center">
            {i + 1}
          </span>
          <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** Checkbox list used for execution checklists. */
function ChecklistView({ steps }: { steps: string[] }) {
  return (
    <ul className="space-y-1.5">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-2">
          <Square className="mt-0.5 h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
        </li>
      ))}
    </ul>
  );
}

function GroupBody({ group }: { group: Group }) {
  const tables = group.head.blocks.filter((b) => b.kind === "table");
  if (group.kind === "sequence" || group.kind === "checklist") {
    const steps = toSteps(group.head.blocks);
    return (
      <div className="space-y-2">
        {group.kind === "sequence" ? (
          <StepsView steps={steps} />
        ) : (
          <ChecklistView steps={steps} />
        )}
        {tables.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {group.head.blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
      {group.attributes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
          {group.attributes.map((attr) => (
            <div key={attr.id} className="rounded-md border border-slate-200 bg-slate-50/70 p-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                {attr.title}
              </p>
              <div className="space-y-1.5">
                {attr.blocks.map((block, i) => (
                  <BlockView key={i} block={block} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TIER_STYLE: Record<number, { chip: string; accent: string; label: string }> = {
  1: { chip: "bg-red-100 text-red-700", accent: "border-l-red-400", label: "Act now" },
  2: { chip: "bg-amber-100 text-amber-700", accent: "border-l-amber-400", label: "Warm up" },
  3: { chip: "bg-slate-200 text-slate-600", accent: "border-l-slate-300", label: "Hold" },
};

const KIND_ICON: Record<GroupKind, typeof Target> = {
  framework: Layers,
  tier: Target,
  sequence: Route,
  message: ListChecks,
  checklist: ListChecks,
  other: Layers,
};

function GroupCard({ group, collapsedAll }: { group: Group; collapsedAll: boolean }) {
  const [open, setOpen] = useState(true);
  const isOpen = collapsedAll ? false : open;
  const tierStyle = group.tier ? TIER_STYLE[group.tier] : undefined;
  const Icon = KIND_ICON[group.kind];
  const meta = [
    group.attributes.length ? `${group.attributes.length} details` : "",
    group.head.blocks.some((b) => b.kind === "table") ? "table" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className={`rounded-lg border border-slate-200 border-l-[3px] bg-white ${
        tierStyle?.accent ?? "border-l-slate-300"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(() => !isOpen);
        }}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
      >
        <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="text-xs font-semibold text-slate-800 flex-1 min-w-0 truncate">
          {group.title}
        </span>
        {tierStyle && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${tierStyle.chip}`}
          >
            {tierStyle.label}
          </span>
        )}
        {meta && <span className="shrink-0 text-[10px] text-slate-400">{meta}</span>}
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-0.5">
          <GroupBody group={group} />
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Root                                                                        */
/* -------------------------------------------------------------------------- */

interface Props {
  /** Raw (un-sanitized) answer text from the backend. */
  answer: string;
}

/**
 * Structured renderer for a recommendation answer. Keeps every word the backend
 * returned, but arranges it: a verdict callout, then one card per decision —
 * tiers with their attributes nested inside, sequences as numbered steps and
 * checklists as tick lists. Everything is expanded by default; nothing hides.
 */
export default function RecommendationAnswerView({ answer }: Props) {
  const parsed = useMemo(() => parseRecommendationAnswer(answer), [answer]);
  const groups = useMemo(() => groupSections(parsed.sections), [parsed.sections]);
  const [collapsedAll, setCollapsedAll] = useState(false);

  if (parsed.isPlain) {
    return (
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{sanitizeAnswerText(answer)}</p>
    );
  }

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
        {groups.map((g) => (
          <span
            key={g.id}
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              g.tier ? TIER_STYLE[g.tier].chip : "bg-slate-100 text-slate-600"
            }`}
          >
            {g.title}
          </span>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-slate-600 hover:bg-slate-100 ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsedAll((v) => !v);
          }}
        >
          {collapsedAll ? "Expand all" : "Collapse all"}
        </Button>
      </div>

      <div className="space-y-2">
        {groups.map((group) => (
          <GroupCard key={`${group.id}-${collapsedAll}`} group={group} collapsedAll={collapsedAll} />
        ))}
      </div>
    </div>
  );
}
