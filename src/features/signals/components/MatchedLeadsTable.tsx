// The inline matched-leads table on Signals.
//
// It is a working surface, not a readout: selecting a row turns its cells into
// inputs (relevance becomes a High/Medium/Low picker), and any row can be
// dismissed as "not a fit" with a reason. Edits are scoped to this signal and
// persisted by `lib/leadEdits.ts`; the cohort plan and exports read the same
// edited leads, so a correction here changes everything downstream.

import { Check, ChevronDown, RotateCcw, X } from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";

import type { SignalLeadMapLead } from "../contracts";
import { DISMISS_REASONS, isLeadEdited } from "../lib/leadEdits";
import type { LeadEdit, SignalLeadEdits } from "../lib/leadEdits";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
/** Inline triage columns (Source is display-only, not part of the saved sheet). */
const TABLE_COLUMNS = ["Name", "Title", "Company", "Source", "Relevance", "Why"] as const;

const SOURCE_OPTIONS = ["CSV/XLSX", "Apollo"] as const;

const sourceClass = (source: string): string =>
  source.toLowerCase() === "apollo"
    ? "bg-violet-50 text-violet-700 border-violet-200"
    : "bg-sky-50 text-sky-700 border-sky-200";

const RELEVANCE_OPTIONS = ["high", "medium", "low"] as const;

const RELEVANCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Inline "Why" text: the first complete sentence, so the cell stays short but is
 * never cut mid-word. The full rationale opens from the adjacent "i".
 */
const shortWhy = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length <= 120) return trimmed;
  const match = trimmed.match(/^[\s\S]*?[.!?](\s|$)/);
  const first = match?.[0]?.trim();
  if (first && first.length <= 160) return first;
  return `${trimmed.slice(0, 117).trimEnd()}…`;
};

const relevanceClass = (relevance: string): string => {
  if (relevance === "high") return "bg-green-100 text-green-800 border-green-200";
  if (relevance === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
};

interface MatchedLeadsTableProps {
  leads: SignalLeadMapLead[];
  /** Pinned toolbar rendered inside the scroll area, above the header row. */
  toolbar?: React.ReactNode;
  /** Leads the user marked "not a fit" (restorable). */
  dismissedLeads?: SignalLeadMapLead[];
  edits?: SignalLeadEdits;
  onEditLead?: (leadId: string, patch: LeadEdit) => void;
  onDismissLead?: (leadId: string, reason: string) => void;
  onRestoreLead?: (leadId: string) => void;
  onRestoreAll?: () => void;
}

const cellInputClass =
  "w-full rounded border border-blue-300 bg-white px-1.5 py-1 text-[11px] text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200";

export const MatchedLeadsTable = ({
  leads,
  toolbar,
  dismissedLeads = [],
  edits = {},
  onEditLead,
  onDismissLead,
  onRestoreLead,
  onRestoreAll,
}: MatchedLeadsTableProps) => {
  /** Rows in edit mode (name clicked). */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Rows with the deep-dive box open (row clicked). */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** Lead whose hover summary is showing. */
  const [hoveredLeadId, setHoveredLeadId] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editable = Boolean(onEditLead);

  // Default order: high → medium → low, stable within each tier.
  const orderedLeads = useMemo(
    () =>
      [...leads].sort(
        (a, b) => (RELEVANCE_ORDER[a.relevance] ?? 3) - (RELEVANCE_ORDER[b.relevance] ?? 3),
      ),
    [leads],
  );

  const toggleSelected = (leadId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleExpanded = (leadId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  // Hover summary: appears on enter, fades itself out shortly after so it never
  // sits in the way of the row underneath.
  const handleHoverEnter = (leadId: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredLeadId(leadId);
    hoverTimerRef.current = setTimeout(() => setHoveredLeadId(null), 2600);
  };
  const handleHoverLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredLeadId(null);
  };

  return (
    <div className="space-y-2">
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500">
          <span>
            {selected.size > 0
              ? `${selected.size} row${selected.size === 1 ? "" : "s"} open for editing — change any field, then tick to save.`
              : "Click a lead name to correct its details or relevance; click a row for the deep dive."}
          </span>
          {dismissedLeads.length > 0 && (
            <button
              type="button"
              onClick={() => onRestoreAll?.()}
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              <RotateCcw className="h-3 w-3" />
              Restore {dismissedLeads.length} removed
            </button>
          )}
        </div>
      )}

      <div className="w-full min-w-0 overflow-hidden rounded-md border border-gray-200">
        <div className="max-h-[420px] w-full overflow-x-auto overflow-y-auto">
          {toolbar && (
            <div className="sticky top-0 z-30 flex min-w-[640px] items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-1.5">
              {toolbar}
            </div>
          )}
          <table className="w-full min-w-[640px] table-fixed border-collapse text-[11px]">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[28%]" />
              {editable && <col className="w-[7%]" />}
            </colgroup>
            <thead
              className={`sticky z-20 bg-gray-100 text-gray-700 ${toolbar ? "top-[33px]" : "top-0"}`}
            >
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide"
                  >
                    {col}
                  </th>
                ))}
                {editable && <th className="border-b border-gray-200 px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {orderedLeads.map((lead, rowIndex) => {
                const isSelected = selected.has(lead.lead_id);
                const isExpanded = expanded.has(lead.lead_id);
                const wasEdited = isLeadEdited(edits[lead.lead_id]);
                const why = lead.why ?? "";
                const source = lead.source ?? "";
                return (
                  <Fragment key={lead.lead_id}>
                  <tr
                    onClick={() => toggleExpanded(lead.lead_id)}
                    className={`cursor-pointer border-t border-gray-100 align-top ${
                      isSelected ? "bg-blue-50/70" : rowIndex % 2 === 1 ? "bg-gray-50/60" : ""
                    }`}
                  >
                    {/* Name — click opens edit mode; hover reveals a short summary. */}
                    <td className="px-3 py-2 text-gray-700" onClick={(e) => e.stopPropagation()}>
                      {isSelected ? (
                        <input
                          className={cellInputClass}
                          aria-label="Lead name"
                          autoFocus
                          value={lead.name ?? ""}
                          onChange={(e) => onEditLead?.(lead.lead_id, { name: e.target.value })}
                        />
                      ) : (
                        <div
                          className="relative"
                          onMouseEnter={() => handleHoverEnter(lead.lead_id)}
                          onMouseLeave={handleHoverLeave}
                        >
                          <button
                            type="button"
                            aria-label={`Edit ${lead.name || "lead"}`}
                            onClick={() => editable && toggleSelected(lead.lead_id)}
                            className={`block w-full truncate text-left font-medium text-gray-900 ${
                              editable ? "cursor-pointer hover:text-blue-600 hover:underline" : ""
                            }`}
                          >
                            {lead.name}
                          </button>
                          {wasEdited && (
                            <span className="mt-0.5 inline-block rounded bg-blue-100 px-1 text-[9px] font-medium text-blue-700">
                              edited
                            </span>
                          )}
                          <div
                            className={`pointer-events-none absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-gray-200 bg-white p-2 shadow-lg transition-opacity duration-300 ${
                              hoveredLeadId === lead.lead_id ? "opacity-100" : "opacity-0"
                            }`}
                            aria-hidden={hoveredLeadId !== lead.lead_id}
                          >
                            <p className="text-[11px] font-semibold text-gray-900">{lead.name}</p>
                            <p className="text-[10px] text-gray-600">
                              {[lead.title, lead.company].filter(Boolean).join(" · ")}
                            </p>
                            <div className="mt-1 space-y-0.5 text-[10px] text-gray-500">
                              {lead.seniority && <p>Seniority: {lead.seniority}</p>}
                              {lead.email && <p className="truncate">{lead.email}</p>}
                              <p>Relevance: {lead.relevance}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Title */}
                    <td className="px-3 py-2 text-gray-700" onClick={(e) => isSelected && e.stopPropagation()}>
                      {isSelected ? (
                        <input
                          className={cellInputClass}
                          aria-label="Lead title"
                          value={lead.title ?? ""}
                          onChange={(e) => onEditLead?.(lead.lead_id, { title: e.target.value })}
                        />
                      ) : (
                        <span className="block truncate" title={lead.title}>
                          {lead.title}
                        </span>
                      )}
                    </td>

                    {/* Company */}
                    <td className="px-3 py-2 text-gray-700" onClick={(e) => isSelected && e.stopPropagation()}>
                      {isSelected ? (
                        <input
                          className={cellInputClass}
                          aria-label="Lead company"
                          value={lead.company ?? ""}
                          onChange={(e) => onEditLead?.(lead.lead_id, { company: e.target.value })}
                        />
                      ) : (
                        <span className="block truncate" title={lead.company}>
                          {lead.company}
                        </span>
                      )}
                    </td>

                    {/* Source — where the lead came from (upload or Apollo). */}
                    <td className="px-3 py-2" onClick={(e) => isSelected && e.stopPropagation()}>
                      {isSelected ? (
                        <select
                          className={cellInputClass}
                          aria-label="Lead source"
                          value={source || "CSV/XLSX"}
                          onChange={(e) => onEditLead?.(lead.lead_id, { source: e.target.value })}
                        >
                          {SOURCE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${sourceClass(
                            source,
                          )}`}
                        >
                          {source || "CSV/XLSX"}
                        </span>
                      )}
                    </td>

                    {/* Relevance — the correction that re-buckets the cohorts. */}
                    <td className="px-3 py-2" onClick={(e) => isSelected && e.stopPropagation()}>
                      {isSelected ? (
                        <select
                          className={cellInputClass}
                          aria-label="Lead relevance"
                          value={lead.relevance}
                          onChange={(e) =>
                            onEditLead?.(lead.lead_id, {
                              relevance: e.target.value as SignalLeadMapLead["relevance"],
                            })
                          }
                        >
                          {RELEVANCE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt.charAt(0).toUpperCase() + opt.slice(1)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${relevanceClass(
                            lead.relevance,
                          )}`}
                        >
                          {lead.relevance}
                        </span>
                      )}
                    </td>

                    {/* Why */}
                    <td className="px-3 py-2 text-gray-700" onClick={(e) => isSelected && e.stopPropagation()}>
                      {isSelected ? (
                        <textarea
                          className={`${cellInputClass} min-h-[54px] resize-y leading-snug`}
                          aria-label="Why this lead matches"
                          value={why}
                          onChange={(e) => onEditLead?.(lead.lead_id, { why: e.target.value })}
                        />
                      ) : (
                        <div className="flex items-start gap-1.5">
                          <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                            {shortWhy(why)}
                          </span>
                          <ChevronDown
                            className={`mt-[1px] h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      )}
                    </td>

                    {/* Dismiss — "not a fit", with the reason kept for future matching. */}
                    {editable && (
                      <td className="px-1 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {isSelected ? (
                          <button
                            type="button"
                            aria-label={`Save changes to ${lead.name || "lead"}`}
                            title="Save changes"
                            onClick={() => toggleSelected(lead.lead_id)}
                            className="rounded p-1 text-green-600 hover:bg-green-50 hover:text-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Remove ${lead.name || "lead"} from this signal`}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-gray-500">
                              Remove because
                            </DropdownMenuLabel>
                            {DISMISS_REASONS.map((reason) => (
                              <DropdownMenuItem
                                key={reason}
                                className="text-xs"
                                onClick={() => onDismissLead?.(lead.lead_id, reason)}
                              >
                                {reason}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        )}
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-gray-100 bg-blue-50/40">
                      <td colSpan={editable ? 7 : 6} className="px-3 py-2.5">
                        <div className="rounded-md border border-blue-100 bg-white p-2.5">
                          <p className="text-[11px] font-semibold text-gray-900">
                            {lead.name}
                            {lead.title ? ` · ${lead.title}` : ""}
                            {lead.company ? ` (${lead.company})` : ""}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-gray-500">
                            {lead.seniority && <span>Seniority: {lead.seniority}</span>}
                            {lead.email && <span>{lead.email}</span>}
                            <span className="capitalize">Relevance: {lead.relevance}</span>
                          </div>
                          {why && (
                            <>
                              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Why this lead matches
                              </p>
                              <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-700">
                                {why}
                              </p>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {dismissedLeads.length > 0 && (
        <div className="rounded-md border border-dashed border-gray-200 bg-gray-50/60 px-2.5 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Removed from this signal
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dismissedLeads.map((lead) => (
              <span
                key={lead.lead_id}
                className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-600"
              >
                {lead.name || lead.company}
                {edits[lead.lead_id]?.dismissReason
                  ? ` · ${edits[lead.lead_id]?.dismissReason}`
                  : ""}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 px-1 text-[10px] text-blue-600 hover:text-blue-800"
                  onClick={() => onRestoreLead?.(lead.lead_id)}
                >
                  Undo
                </Button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchedLeadsTable;
