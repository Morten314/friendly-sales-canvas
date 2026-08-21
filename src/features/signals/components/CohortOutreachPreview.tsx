import { useEffect, useMemo, useState } from "react";

import type { SignalLeadMapLead } from "../contracts";
import type { OutreachPlanStep } from "../lib/aggregateOutreachPlan";
import {
  buildCohortCopy,
  loadCohortCopy,
  resolveTokens,
  saveCohortCopy,
  type TouchCopy,
} from "../lib/outreachCopy";
import { buildCohortOutreachArtefact } from "../lib/signalBriefing";
import type { SignalCard } from "../types";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getStoredArtefact, saveArtefact } from "@/features/artifacts";

interface Props {
  signalId: string;
  headline: string;
  snippet: string;
  step: OutreachPlanStep;
  agent?: SignalCard["agent"];
  timestamp?: string;
}

/** "Name <email>" recipient list; collapses past three entries. */
const RecipientsField = ({ leads }: { leads: SignalLeadMapLead[] }) => {
  const [expanded, setExpanded] = useState(false);
  if (!leads.length) return null;
  const shown = expanded ? leads : leads.slice(0, 3);
  const hidden = leads.length - shown.length;

  return (
    <div className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
      <span className="mt-0.5 shrink-0 text-[10px] uppercase tracking-wide text-gray-400">To</span>
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1">
        {shown.map((l) => (
          <span
            key={l.lead_id}
            className="max-w-full truncate rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-700"
            title={l.email || undefined}
          >
            {l.name || "Unknown"}
            {l.email ? ` <${l.email}>` : ""}
          </span>
        ))}
        {leads.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50"
          >
            {expanded ? "Show less" : `+${hidden} more`}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * The cohort's outreach plan with real, sendable copy. Templates render
 * immediately (offline, deterministic) and stay editable inline. AI
 * personalisation and agentic editing live in Artefacts, not here.
 */
const CohortOutreachPreview = ({
  signalId,
  headline,
  snippet,
  step,
  agent = "scout",
  timestamp,
}: Props) => {
  const { toast } = useToast();
  const templates = useMemo(
    () => buildCohortCopy(step, { headline, snippet }),
    [step, headline, snippet],
  );
  const [copy, setCopy] = useState<TouchCopy[]>(templates);
  const [leadId, setLeadId] = useState<string>("");
  const [openTouch, setOpenTouch] = useState<number | null>(0);

  useEffect(() => {
    const stored = loadCohortCopy(signalId, step.label);
    setCopy(stored?.length ? stored : templates);
  }, [signalId, step.label, templates]);

  const selectedLead: SignalLeadMapLead | null =
    step.leads.find((l) => l.lead_id === leadId) ?? null;

  const persist = (next: TouchCopy[]) => {
    setCopy(next);
    saveCohortCopy(signalId, step.label, next);
  };

  const handleEdit = (idx: number, patch: Partial<TouchCopy>) => {
    persist(copy.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const handleSaveCohortAsArtefact = () => {
    const touches = copy.map((t) => ({
      day: t.day,
      channel: t.channel,
      action: t.action,
      subject: resolveTokens(t.subject ?? "", selectedLead),
      body: resolveTokens(t.body, selectedLead),
    }));

    // (b) When the signal's lead table is already saved, the cohort's sequence
    // is appended to that same artefact — in line with the leads table.
    const leadSheet = getStoredArtefact(`lead-sheet-${signalId}`);
    if (leadSheet) {
      const prefix = `${step.label} · `;
      const kept = (leadSheet.sequence ?? []).filter((t) => !t.action.startsWith(prefix));
      const merged = {
        ...leadSheet,
        sequence: [...kept, ...touches.map((t) => ({ ...t, action: `${prefix}${t.action}` }))],
      };
      saveArtefact(merged);
      toast({
        title: "Saved as Artefact",
        description: `${step.label} sequence added to the leads table in Artefacts › ${leadSheet.folder}.`,
      });
      return;
    }

    // (c) No leads table saved yet — file the sequence with the signal + blurb only.
    const artefact = buildCohortOutreachArtefact(
        {
          id: signalId,
          agent,
          headline,
          snippet,
          timestamp: timestamp ?? new Date().toISOString(),
        },
        step.label,
        touches,
        [],
        { includeLeadSheet: false },
    );
    // Another cohort may already have filed the signal's case file — merge.
    const prior = getStoredArtefact(artefact.id);
    const prefix = `${step.label} · `;
    const kept = (prior?.sequence ?? []).filter((t) => !t.action.startsWith(prefix));
    saveArtefact({
      ...artefact,
      sheet: prior?.sheet ?? artefact.sheet,
      sequence: [
        ...kept,
        ...(artefact.sequence ?? []).map((t) => ({ ...t, action: `${prefix}${t.action}` })),
      ],
    });
    toast({
      title: "Saved as Artefact",
      description: `${step.label} sequence filed in Artefacts › ${artefact.folder}.`,
    });
  };

  return (
    <div className="mt-2 border-t border-gray-200 pt-2">
      {/* Scope controls */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="text-[10px] uppercase tracking-wide text-gray-400">Preview for</label>
        <select
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          className="h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] text-gray-700"
        >
          <option value="">Whole cohort</option>
          {step.leads.map((l) => (
            <option key={l.lead_id} value={l.lead_id}>
              {l.name || "Unknown"} · {l.company || "—"}
            </option>
          ))}
        </select>
      </div>

      {/* Touches with copy */}
      <ol className="space-y-1.5">
        {copy.map((t, idx) => {
          const subject = resolveTokens(t.subject, selectedLead);
          const body = resolveTokens(t.body, selectedLead);
          const isOpen = openTouch === idx;
          return (
            <li key={`${t.day}-${t.channel}-${idx}`} className="rounded border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenTouch(isOpen ? null : idx)}
                className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left text-[11px] text-gray-700 hover:bg-gray-50"
              >
                <span className="shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                  Day {t.day}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">
                  {t.channel}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.action}</span>
                <span className="shrink-0 text-[10px] text-blue-600">
                  {isOpen ? "Hide copy" : "View copy"}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-1.5 border-t border-gray-100 px-2 py-2">
                  {t.channel === "email" && (
                    <RecipientsField leads={selectedLead ? [selectedLead] : step.leads} />
                  )}
                  {t.channel === "email" && (
                    <input
                      value={subject}
                      onChange={(e) => handleEdit(idx, { subject: e.target.value })}
                      placeholder="Subject"
                      className="w-full rounded border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-900"
                    />
                  )}
                  <textarea
                    value={body}
                    onChange={(e) => handleEdit(idx, { body: e.target.value })}
                    rows={Math.min(12, Math.max(4, body.split("\n").length + 1))}
                    className="w-full resize-y whitespace-pre-wrap rounded border border-gray-200 px-2 py-1 text-[11px] leading-relaxed text-gray-700"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Stays in view while the user reads the copy, so saving never needs a scroll back up. */}
      <div className="sticky bottom-0 z-10 mt-2 flex justify-end border-t border-gray-100 bg-white/95 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={handleSaveCohortAsArtefact}
        >
          Save as Artefact
        </Button>
      </div>


    </div>
  );
};

export default CohortOutreachPreview;