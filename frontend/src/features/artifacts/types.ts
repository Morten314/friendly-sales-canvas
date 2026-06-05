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
  fullReport: {
    title: string;
    executiveSummary: string;
    keyFindings: string[];
    analysis: string;
    recommendations: string[];
    charts?: string[];
  };
}
