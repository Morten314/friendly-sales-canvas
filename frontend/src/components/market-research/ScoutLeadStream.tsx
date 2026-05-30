// HANDOFF → scout (Spec 24 §7). This component is NOT part of market-research;
// it stays here until the scout feature phase relocates + decomposes it.

import React, { useState } from "react";

import type { HeatmapLead } from "./lead-stream/leadData";
import LeadsTable from "./lead-stream/LeadsTable";
import OpportunityDashboard from "./lead-stream/OpportunityDashboard";

import { Separator } from "@/components/ui/separator";

// ─── Props ───────────────────────────────────────────────────────────────────

interface ScoutLeadStreamProps {
  selectedIndustry?: string;
  selectedSize?: string;
  selectedRegion?: string;
  opportunityFilter?: string | null;
  onFiltersChange?: (filters: {
    selectedIndustry: string;
    selectedSize: string;
    selectedRegion: string;
  }) => void;
  onClearOpportunityFilter?: () => void;
  onChatWithScout?: (leads: HeatmapLead[], reportFilter?: string) => void;
  onChatAboutCoverage?: () => void;
  onSendToStrategist?: (lead: HeatmapLead) => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

const ScoutLeadStream: React.FC<ScoutLeadStreamProps> = ({
  opportunityFilter,
  onClearOpportunityFilter,
  onChatWithScout,
  onChatAboutCoverage,
  onSendToStrategist,
}) => {
  const [heatmapRowsForDashboard, setHeatmapRowsForDashboard] = useState<HeatmapLead[] | null>(
    null,
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Zone 1: Opportunity Dashboard */}
      <OpportunityDashboard
        onChatAboutCoverage={onChatAboutCoverage}
        heatmapRowsOverride={heatmapRowsForDashboard}
      />

      <Separator />

      {/* Zone 2: Filtered Leads Table */}
      <LeadsTable
        opportunityFilter={opportunityFilter}
        onClearOpportunityFilter={onClearOpportunityFilter}
        onSendToStrategist={onSendToStrategist}
        onChatWithScout={(leads, reportFilter) => onChatWithScout?.(leads, reportFilter)}
        onHeatmapRowsForDashboardChange={setHeatmapRowsForDashboard}
      />
    </div>
  );
};

export default ScoutLeadStream;
