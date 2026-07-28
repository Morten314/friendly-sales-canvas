import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { RecommendationArtefactResponse } from "../contracts";

import { Button } from "@/components/ui/button";

interface OutreachPlanPanelProps {
  /** The generated plan, or null while it is being generated / on error. */
  plan: RecommendationArtefactResponse | null;
  isGenerating: boolean;
  isError: boolean;
  /** Whether the signal has ≥ 1 matched lead (controls the Download CSV button). */
  hasLeads: boolean;
  onRetry: () => void;
  onSaveToLibrary: () => void;
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
}

/**
 * Inline panel that displays a recommendation's generated GTM outreach plan
 * (Spec 45). Presentational only — the page owns generation, caching, and the
 * artefact delivery the footer buttons trigger.
 */
export const OutreachPlanPanel = ({
  plan,
  isGenerating,
  isError,
  hasLeads,
  onRetry,
  onSaveToLibrary,
  onDownloadPdf,
  onDownloadCsv,
}: OutreachPlanPanelProps) => {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const handleCopy = async (template: string) => {
    if (!template || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context) — silently no-op.
    }
  };

  if (isGenerating) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-white/70 p-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating outreach plan…</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
        <p role="alert" className="text-sm text-red-600">
          Could not generate outreach plan — please try again.
        </p>
        <div className="mt-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const sections = [
    { label: "What to do", value: plan.what_to_do },
    { label: "Strategy", value: plan.strategy },
    { label: "How to communicate", value: plan.how_to_communicate },
    { label: "Channel", value: plan.communication_channel },
  ].filter((s) => (s.value ?? "").trim() !== "");
  const template = (plan.communication_template ?? "").trim();
  const isEmpty = sections.length === 0 && template === "";

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white/70 p-3">
      <h5 className="text-sm font-semibold text-slate-900">Outreach Plan</h5>

      {isEmpty ? (
        <p className="text-sm text-slate-500">No plan content returned.</p>
      ) : (
        <>
          {sections.map((s) => (
            <div key={s.label} className="space-y-0.5">
              <p className="text-xs font-medium text-slate-600">{s.label}</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{s.value}</p>
            </div>
          ))}

          {template && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600">Message template</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-2 h-7 px-2 text-xs text-slate-600 hover:text-slate-800"
                  onClick={() => void handleCopy(template)}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800">
                {template}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onSaveToLibrary}>
              Save to Library
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onDownloadPdf}>
              Download PDF
            </Button>
            {hasLeads && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onDownloadCsv}>
                Download CSV
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
