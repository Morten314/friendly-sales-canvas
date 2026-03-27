import React from "react";
import { Separator } from "@/components/ui/separator";
import OpportunityDashboard from "./lead-stream/OpportunityDashboard";
import TierOpportunityCards, { type TierCardData } from "./lead-stream/TierOpportunityCards";
import OpportunityDashboard from "./lead-stream/OpportunityDashboard";
import TierOpportunityCards from "./lead-stream/TierOpportunityCards";
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
  onChatAboutCoverage?: () => void;
  onAskScoutTier?: (tierCard: TierCardData) => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

const ScoutLeadStream: React.FC<ScoutLeadStreamProps> = ({
  opportunityFilter,
  onClearOpportunityFilter,
  onResearchWithScout,
  onChatWithScout,
  onChatAboutCoverage,
  onAskScoutTier,
}) => {
  const handleResearchLead = (lead: any) => {
    onResearchWithScout?.([lead]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Zone 1: Opportunity Dashboard */}
      <OpportunityDashboard onChatAboutCoverage={onChatAboutCoverage} />

      <TierOpportunityCards onAskScout={onAskScoutTier} />

      <Separator />

      {/* Zone 2: Filtered Leads Table */}
      <LeadsTable
        opportunityFilter={opportunityFilter}
        onClearOpportunityFilter={onClearOpportunityFilter}
        onResearchWithScout={handleResearchLead}
        onChatWithScout={(leads, reportFilter) => onChatWithScout?.(leads, reportFilter)}
      />
    </div>
  );
};

export default ScoutLeadStream;
