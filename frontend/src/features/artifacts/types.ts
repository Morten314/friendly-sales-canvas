// Feature-local types for `artifacts` (moved verbatim from the page).
import type { ComponentType } from "react";

// One matched-lead row for the CSV export (Spec 43). All-string so the CSV
// builder never has to coerce; the signals builders map SignalLeadMapLead into
// this via leadToRow (every field `?? ""`). Owned by the artifacts feature so
// there is no cross-feature type coupling.
export interface ArtefactLeadRow {
  name: string;
  title: string;
  seniority: string;
  company: string;
  email: string;
  emailStatus: string;
  linkedin: string;
  phone: string;
  relevance: string;
  why: string;
}

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
  // Structured matched-lead rows for CSV export (Spec 43). Optional: older/mock
  // artifacts and 0-lead playbooks won't have it; the library hides the CSV
  // control when it is empty.
  leadRows?: ArtefactLeadRow[];
}
