// Scout lead-stream view — part of the market-research lead-stream cluster.
// Relocated into features/market-research (TD-FE-63).

import React, { useState } from "react";

import LeadsTable from "./lead-stream/LeadsTable";
import OpportunityDashboard from "./lead-stream/OpportunityDashboard";

import { Separator } from "@/components/ui/separator";
import type { HeatmapLead } from "@/shared/lib/leadData";

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
