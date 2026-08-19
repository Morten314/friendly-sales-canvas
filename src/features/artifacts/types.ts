// Feature-local types for `artifacts` (moved verbatim from the page).
import type { ComponentType } from "react";

export interface ArtefactItem {
  id: string;
  agentName: string;
  // SVG icon component (lucide-react) so test snapshots are pixel-stable
  // across OSes — emoji glyphs vary by OS/font version. See agent → icon map
  // in mockArtefacts and StrategistWorkspace.tsx.
  agentIcon: ComponentType<{ className?: string }>;
  agentColor: string;
  taskNumber: string;
  timestamp: string;
  status: "new" | "viewed" | "updated";
  type: "report" | "analysis" | "insight" | "proposal" | "enrichment" | "playbook";
  folder?: string;
  actionDelegated: string;
  contextRationale: string;
  systemImpact: string;
  actionPerformed: string;
  outputSummary: string;
  /** Optional attached CSV export (e.g. the complete matched-leads sheet). */
  csv?: { filename: string; content: string };
  /**
   * Optional editable spreadsheet payload. When present the Artefacts library
   * renders an editable grid (not just a CSV download) so users can enrich rows
   * in place. `rows` is row-major and column-aligned with `columns`.
   */
  sheet?: {
    filename: string;
    columns: string[];
    rows: string[][];
    /**
     * Columns added by agentic enrichment (not part of the original matched-leads
     * export). Rendered with a re-run control and confidence marker.
     */
    enriched?: string[];
    /** "rowIndex:colIndex" → confidence of the enriched value in that cell. */
    confidence?: Record<string, "high" | "medium" | "low">;
  };
  /**
   * Optional editable outreach sequence (cohort touches). When present the
   * Artefacts library renders a sequence editor where touches can be edited,
   * reordered, added and removed.
   */
  sequence?: {
    day: number;
    channel: string;
    action: string;
    subject?: string;
    body: string;
  }[];
  fullReport: {
    title: string;
    executiveSummary: string;
    keyFindings: string[];
    analysis: string;
    recommendations: string[];
    charts?: string[];
    /**
     * Full recommendation Q&A carried into the briefing document (question =
     * the recommendation/NBA, answer = the generated deep-dive explanation).
     */
    recommendationAnswers?: { question: string; answer: string }[];
  };
}
