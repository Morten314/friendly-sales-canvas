import { FileDown } from "lucide-react";

import type { ArtefactItem } from "../types";

import { Button } from "@/components/ui/button";
import { sanitizeAnswerText } from "@/shared/lib/sanitizeAnswerText";

/** Read-only briefing view rendered in-page before any PDF download. */
export const ArtefactReport = ({
  artefact,
  onDownload,
}: {
  artefact: ArtefactItem;
  onDownload?: (artefact: ArtefactItem) => void;
}) => {
  const { fullReport } = artefact;
  const answers = fullReport.recommendationAnswers ?? [];

  return (
    <article className="space-y-5 rounded-lg border bg-card p-5 text-sm leading-relaxed">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold">{fullReport.title}</h3>
          <p className="text-[11px] text-muted-foreground">
            {artefact.agentName} · {artefact.timestamp} · {artefact.taskNumber}
          </p>
        </div>
        {onDownload && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onDownload(artefact)}
          >
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            Download briefing
          </Button>
        )}
      </header>

      {fullReport.executiveSummary && (
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Executive summary
          </h4>
          <p className="whitespace-pre-wrap">{fullReport.executiveSummary}</p>
        </section>
      )}

      {fullReport.keyFindings?.length > 0 && (
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Key findings
          </h4>
          <ol className="space-y-1.5">
            {fullReport.keyFindings.map((finding, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span className="whitespace-pre-wrap">{finding}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {fullReport.analysis && (
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Analysis
          </h4>
          <p className="whitespace-pre-wrap">{fullReport.analysis}</p>
        </section>
      )}

      {fullReport.recommendations?.length > 0 && (
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recommendations
          </h4>
          <ol className="space-y-1.5">
            {fullReport.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span className="whitespace-pre-wrap">{rec}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {answers.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recommendation deep dives
          </h4>
          {answers.map((qa, i) => (
            <div key={i} className="space-y-1.5 rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-semibold">
                {i + 1}. {qa.question}
              </p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed">
                {sanitizeAnswerText(qa.answer)}
              </p>
            </div>
          ))}
        </section>
      )}

      <p className="border-t pt-3 text-[11px] text-muted-foreground">
        The downloadable briefing also includes the detailed outreach plan and message templates.
      </p>
    </article>
  );
};
