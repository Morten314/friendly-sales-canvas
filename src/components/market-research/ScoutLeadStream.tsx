import React from "react";
import { Separator } from "@/components/ui/separator";
import OpportunityDashboard from "./lead-stream/OpportunityDashboard";
import LeadsTable from "./lead-stream/LeadsTable";

// ─── Props ───────────────────────────────────────────────────────────────────

interface ScoutLeadStreamProps {
  selectedIndustry?: string;
  selectedSize?: string;
  selectedRegion?: string;
  opportunityFilter?: string | null;
  onFiltersChange?: (filters: { selectedIndustry: string; selectedSize: string; selectedRegion: string }) => void;
  onClearOpportunityFilter?: () => void;
  onResearchWithScout?: (leads: any[], context?: string) => void;
  onChatWithScout?: (leads: any[], reportFilter?: string) => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

const ScoutLeadStream: React.FC<ScoutLeadStreamProps> = ({
  opportunityFilter,
  onClearOpportunityFilter,
  onResearchWithScout,
  onChatWithScout,
}) => {
  const handleResearchLead = (lead: any) => {
    onResearchWithScout?.([lead]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Zone 1: Opportunity Dashboard */}
      <OpportunityDashboard />

      <Separator />

      {/* Zone 2: Filtered Leads Table */}
      <LeadsTable
        opportunityFilter={opportunityFilter}
        onClearOpportunityFilter={onClearOpportunityFilter}
        onResearchWithScout={handleResearchLead}
        onChatWithScout={(leads) => onChatWithScout?.(leads)}
      />
    </div>
  );
};

export default ScoutLeadStream;
