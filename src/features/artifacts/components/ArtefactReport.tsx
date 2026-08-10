import type { ArtefactItem } from "../types";

/** Read-only briefing view rendered in-page before any PDF download. */
export const ArtefactReport = ({ artefact }: { artefact: ArtefactItem }) => {
  const { fullReport } = artefact;
  return (
    <article className="space-y-5 rounded-lg border bg-card p-5 text-sm leading-relaxed">
      <header className="space-y-1 border-b pb-3">
        <h3 className="text-base font-semibold">{fullReport.title}</h3>
        <p className="text-[11px] text-muted-foreground">
          {artefact.agentName} · {artefact.timestamp} · {artefact.taskNumber}
        </p>
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
    </article>
  );
};