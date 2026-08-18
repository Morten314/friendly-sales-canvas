import { Bot, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { SignalLeadMapLead } from "../contracts";
import type { OutreachPlanStep } from "../lib/aggregateOutreachPlan";
import {
  buildCohortCopy,
  clearCohortCopy,
  loadCohortCopy,
  resolveTokens,
  saveCohortCopy,
  type TouchCopy,
} from "../lib/outreachCopy";
import { buildCohortOutreachArtefact } from "../lib/signalBriefing";
import type { SignalCard } from "../types";

import OutreachCopyChat from "./OutreachCopyChat";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { saveArtefact } from "@/features/artifacts";
import { supabase } from "@/integrations/supabase/client";

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
 * immediately (offline, deterministic); "Personalise with AI" rewrites the same
 * touches and caches the result per signal+cohort. Copy is cohort-level by
 * default — the lead picker only resolves merge tokens for preview/sending.
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
  const [personalised, setPersonalised] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string>("");
  const [openTouch, setOpenTouch] = useState<number | null>(0);
  const [chatIdx, setChatIdx] = useState<number | null>(null);

  useEffect(() => {
    const stored = loadCohortCopy(signalId, step.label);
    if (stored?.length) {
      setCopy(stored);
      setPersonalised(true);
    } else {
      setCopy(templates);
      setPersonalised(false);
    }
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

  const handlePersonalise = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-outreach-copy", {
        body: {
          headline,
          snippet,
          cohortLabel: step.label,
          relevance: step.relevance,
          touches: step.touches,
          leads: step.leads.slice(0, 8).map((l) => ({
            name: l.name,
            title: l.title,
            company: l.company,
            why: l.why,
          })),
        },
      });
      if (fnError) throw fnError;
      const returned = (data?.touches ?? []) as { subject?: string; body?: string }[];
      if (!returned.length) throw new Error("empty");
      const next = templates.map((t, i) => ({
        ...t,
        subject: returned[i]?.subject ?? t.subject,
        body: returned[i]?.body?.trim() || t.body,
      }));
      persist(next);
      setPersonalised(true);
    } catch {
      setError("Could not personalise right now — the template copy is still usable.");
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    clearCohortCopy(signalId, step.label);
    setCopy(templates);
    setPersonalised(false);
  };

  const handleSaveCohortAsArtefact = () => {
    saveArtefact(
      buildCohortOutreachArtefact(
        {
          id: signalId,
          agent,
          headline,
          snippet,
          timestamp: timestamp ?? new Date().toISOString(),
        },
        step.label,
        copy.map((t) => ({
          day: t.day,
          channel: t.channel,
          action: t.action,
          subject: resolveTokens(t.subject ?? "", selectedLead),
          body: resolveTokens(t.body, selectedLead),
        })),
        selectedLead ? [selectedLead] : step.leads,
      ),
    );
    toast({
      title: "Saved as Artefact",
      description: `${step.label} outreach sequence is now in Artefacts.`,
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
          <option value="">Whole cohort (merge tokens)</option>
          {step.leads.map((l) => (
            <option key={l.lead_id} value={l.lead_id}>
              {l.name || "Unknown"} · {l.company || "—"}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={handlePersonalise}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-3 w-3" />
          )}
          {personalised ? "Regenerate with AI" : "Personalise with AI"}
        </Button>
        {personalised && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-gray-500"
            onClick={handleReset}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset to template
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={handleSaveCohortAsArtefact}
        >
          Save as Artefact
        </Button>
      </div>
      {error && <p className="mb-2 text-[11px] text-red-600">{error}</p>}

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
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => setChatIdx(idx)}
                    >
                      <Bot className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    {!selectedLead && (
                      <span className="text-[10px] text-gray-400">
                        Pick a lead above to fill the merge tokens.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {chatIdx !== null && copy[chatIdx] && (
        <OutreachCopyChat
          open
          onOpenChange={(o) => !o && setChatIdx(null)}
          headline={headline}
          snippet={snippet}
          step={step}
          touch={copy[chatIdx]}
          onCommit={(patch) => handleEdit(chatIdx, patch)}
        />
      )}
    </div>
  );
};

export default CohortOutreachPreview;