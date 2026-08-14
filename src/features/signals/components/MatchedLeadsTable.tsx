// The inline matched-leads table on Signals.
//
// It is a working surface, not a readout: selecting a row turns its cells into
// inputs (relevance becomes a High/Medium/Low picker), and any row can be
// dismissed as "not a fit" with a reason. Edits are scoped to this signal and
// persisted by `lib/leadEdits.ts`; the cohort plan and exports read the same
// edited leads, so a correction here changes everything downstream.

import { Info, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";

import type { SignalLeadMapLead } from "../contracts";
import { DISMISS_REASONS, isLeadEdited } from "../lib/leadEdits";
import type { LeadEdit, SignalLeadEdits } from "../lib/leadEdits";
import { SIGNAL_PREVIEW_COLUMNS } from "../lib/matchedLeadsCsv";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const RELEVANCE_OPTIONS = ["high", "medium", "low"] as const;

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
  dismissedLeads = [],
  edits = {},
  onEditLead,
  onDismissLead,
  onRestoreLead,
  onRestoreAll,
}: MatchedLeadsTableProps) => {
  /** Rows in edit mode (checkbox ticked). */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Lead whose hover summary is showing. */
  const [hoveredLeadId, setHoveredLeadId] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editable = Boolean(onEditLead);

  const toggleSelected = (leadId: string) => {
    setSelected((prev) => {
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

  const allSelected = leads.length > 0 && selected.size === leads.length;

  return (
    <div className="space-y-2">
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500">
          <span>
            {selected.size > 0
              ? `${selected.size} row${selected.size === 1 ? "" : "s"} open for editing — change any field or the relevance.`
              : "Tick a row to correct its details or relevance."}
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

      <div className="overflow-hidden rounded-md border border-gray-200">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full table-fixed border-collapse text-[11px]">
            <colgroup>
              {editable && <col className="w-[34px]" />}
              <col className="w-[160px]" />
              <col className="w-[180px]" />
              <col className="w-[160px]" />
              <col className="w-[120px]" />
              <col className="w-[340px]" />
              {editable && <col className="w-[34px]" />}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-gray-100 text-gray-700">
              <tr>
                {editable && (
                  <th className="border-b border-gray-200 px-2 py-2 text-left">
                    <Checkbox
                      checked={allSelected}
                      aria-label="Select all leads for editing"
                      onCheckedChange={(checked) =>
                        setSelected(checked ? new Set(leads.map((l) => l.lead_id)) : new Set())
                      }
                    />
                  </th>
                )}
                {SIGNAL_PREVIEW_COLUMNS.map((col) => (
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
              {leads.map((lead, rowIndex) => {
                const isSelected = selected.has(lead.lead_id);
                const wasEdited = isLeadEdited(edits[lead.lead_id]);
                const why = lead.why ?? "";
                return (
                  <tr
                    key={lead.lead_id}
                    className={`border-t border-gray-100 align-top ${
                      isSelected ? "bg-blue-50/70" : rowIndex % 2 === 1 ? "bg-gray-50/60" : ""
                    }`}
                  >
                    {editable && (
                      <td className="px-2 py-2">
                        <Checkbox
                          checked={isSelected}
                          aria-label={`Edit ${lead.name || "lead"}`}
                          onCheckedChange={() => toggleSelected(lead.lead_id)}
                        />
                      </td>
                    )}

                    {/* Name — hover reveals a short lead summary that fades out. */}
                    <td className="px-3 py-2 text-gray-700">
                      {isSelected ? (
                        <input
                          className={cellInputClass}
                          aria-label="Lead name"
                          value={lead.name ?? ""}
                          onChange={(e) => onEditLead?.(lead.lead_id, { name: e.target.value })}
                        />
                      ) : (
                        <div
                          className="relative"
                          onMouseEnter={() => handleHoverEnter(lead.lead_id)}
                          onMouseLeave={handleHoverLeave}
                        >
                          <span className="block truncate font-medium text-gray-900">
                            {lead.name}
                          </span>
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
                    <td className="px-3 py-2 text-gray-700">
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
                    <td className="px-3 py-2 text-gray-700">
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

                    {/* Relevance — the correction that re-buckets the cohorts. */}
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2 text-gray-700">
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
                          {why ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Detailed reason this lead matches"
                                  className="mt-[1px] shrink-0 text-gray-400 hover:text-gray-700"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                side="left"
                                align="start"
                                className="w-80 text-xs leading-relaxed"
                              >
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                  Why this lead matches
                                </p>
                                <p className="mb-2 text-[11px] font-medium text-gray-900">
                                  {lead.name}
                                  {lead.title ? ` · ${lead.title}` : ""}
                                  {lead.company ? ` (${lead.company})` : ""}
                                  {lead.relevance ? ` — ${lead.relevance} relevance` : ""}
                                </p>
                                <p className="whitespace-pre-wrap break-words text-gray-700">
                                  {why}
                                </p>
                              </PopoverContent>
                            </Popover>
                          ) : null}
                        </div>
                      )}
                    </td>

                    {/* Dismiss — "not a fit", with the reason kept for future matching. */}
                    {editable && (
                      <td className="px-1 py-2 text-right">
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
                      </td>
                    )}
                  </tr>
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
