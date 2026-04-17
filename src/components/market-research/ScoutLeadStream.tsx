import React, { useState } from "react";
import { Separator } from "@/components/ui/separator";
import OpportunityDashboard from "./lead-stream/OpportunityDashboard";
import LeadsTable from "./lead-stream/LeadsTable";
import type { HeatmapLead } from "./lead-stream/leadData";

// ─── Props ───────────────────────────────────────────────────────────────────

interface ScoutLeadStreamProps {
  selectedIndustry?: string;
  selectedSize?: string;
  selectedRegion?: string;
  opportunityFilter?: string | null;
  onFiltersChange?: (filters: { selectedIndustry: string; selectedSize: string; selectedRegion: string }) => void;
  onClearOpportunityFilter?: () => void;
  onChatWithScout?: (leads: any[], reportFilter?: string) => void;
  onChatAboutCoverage?: () => void;
  onSendToStrategist?: (lead: any) => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

const ScoutLeadStream: React.FC<ScoutLeadStreamProps> = ({
  opportunityFilter,
  onClearOpportunityFilter,
  onChatWithScout,
  onChatAboutCoverage,
  onSendToStrategist,
}) => {
  const [heatmapRowsForDashboard, setHeatmapRowsForDashboard] = useState<HeatmapLead[] | null>(null);

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
