// Lead-stream tab — part of the market-research lead-stream cluster (extracted from
// MarketResearchPage; relocated into features/market-research).
// Cross-tab/nav/Strategist coordination is injected by the feature shell as callback props.
import { useState } from "react";

import ScoutLeadStream from "../ScoutLeadStream";

import type { UntypedLead } from "@/shared/types/escape-hatches";

interface LeadStreamTabProps {
  /** Cross-tab filter set by the shell's "view opportunity leads" flow (intelligence → analysis). */
  opportunityFilter: string | null;
  onClearOpportunityFilter: () => void;
  onChatWithScout: (leads: UntypedLead[], reportFilter?: string) => void;
  onChatAboutCoverage: () => void;
  onSendToStrategist: (lead: UntypedLead) => void;
}

/**
 * Legacy lead-stream ("Your Lead Stream" / analysis) tab. Owns its analysis-local filter
 * state internally; everything else (cross-tab opportunity filter + nav/Strategist
 * coordination) is injected by the feature shell as callback props. No fetching here.
 */
export default function LeadStreamTab({
  opportunityFilter,
  onClearOpportunityFilter,
  onChatWithScout,
  onChatAboutCoverage,
  onSendToStrategist,
}: LeadStreamTabProps) {
  // Analysis-local filter state (persists across tab switches within this tab's lifetime).
  const [leadStreamFilters, setLeadStreamFilters] = useState({
    selectedIndustry: "all",
    selectedSize: "all",
    selectedRegion: "all",
  });

  return (
    <ScoutLeadStream
      selectedIndustry={leadStreamFilters.selectedIndustry}
      selectedSize={leadStreamFilters.selectedSize}
      selectedRegion={leadStreamFilters.selectedRegion}
      opportunityFilter={opportunityFilter}
      onFiltersChange={(filters) => setLeadStreamFilters(filters)}
      onClearOpportunityFilter={onClearOpportunityFilter}
      onChatWithScout={onChatWithScout}
      onChatAboutCoverage={onChatAboutCoverage}
      onSendToStrategist={onSendToStrategist}
    />
  );
}
