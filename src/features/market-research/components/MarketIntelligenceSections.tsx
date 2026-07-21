import React from "react";

import CompetitorLandscapeSection from "./intelligence/competitor-landscape/CompetitorLandscapeSection";
import IndustryTrendsSection from "./intelligence/industry-trends/IndustryTrendsSection";
import MarketEntrySection from "./intelligence/market-entry/MarketEntrySection";
import MarketSizeSection from "./intelligence/market-size/MarketSizeSection";
import RegulatoryComplianceSection from "./intelligence/regulatory-compliance/RegulatoryComplianceSection";
import ScoutChatPanel from "./scout-chat/ScoutChatPanel";
import type { EditRecord, TrendSnapshot } from "./types";

import type { UntypedBackendProfile, UntypedReportState } from "@/shared/types/escape-hatches";

export interface MarketIntelligenceSectionsProps {
  // General refresh state for all components
  isRefreshing?: boolean;
  companyProfile?: UntypedBackendProfile;

  // Add centralized data props
  regulatoryData?: UntypedReportState;

  // Market Size Section
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  // NOTE: Market-size read-path data fields (executiveSummary, tamValue, samValue,
  // GrowthRate, strategicRecommendations, marketEntry, marketDrivers,
  // marketSizeBySegment, growthProjections) were removed here — that data is now
  // sourced via the useMarketSize hook inside MarketSizeSection. The
  // orchestration + per-field change callbacks below stay (same as the other sections).
  marketSizeDeletedSections: Set<string>;
  isMarketSizeLoading?: boolean;
  marketSizeError?: string | null;
  onMarketSizeRefresh?: () => void;

  // Industry Trends Section
  isIndustryTrendsEditing: boolean;
  industryTrendsExpanded: boolean;
  industryTrendsHasEdits: boolean;
  industryTrendsDeletedSections: Set<string>;
  industryTrendsEditHistory: EditRecord[];
  // NOTE: Industry-trends read-path data fields (executiveSummary, aiAdoption,
  // cloudMigration, regulatory, trendSnapshots, recommendations, risks,
  // regionalHotspots, visualCharts) were removed here — that data is now sourced
  // via the useIndustryTrends hook inside IndustryTrendsSection.
  // The orchestration + per-field change callbacks below stay (same as market-entry).
  industryTrendsLastEditedField: string;

  // Competitor Landscape Section
  isCompetitorEditing: boolean;
  competitorExpanded: boolean;
  competitorHasEdits: boolean;
  competitorDeletedSections: Set<string>;
  competitorEditHistory: EditRecord[];
  // Regulatory Compliance props
  isRegulatoryEditing?: boolean;
  regulatoryExpanded?: boolean;
  regulatoryHasEdits?: boolean;
  regulatoryDeletedSections?: Set<string>;
  regulatoryEditHistory?: EditRecord[];
  regulatoryExecutiveSummary?: string;
  regulatoryEuAiActDeadline?: string;
  regulatoryGdprCompliance?: string;
  regulatoryPotentialFines?: string;
  regulatoryDataLocalization?: string;
  // Market Entry props
  // NOTE: MarketEntry's read-path data fields (executiveSummary, entryBarriers,
  // recommendedChannel, timeToMarket, topBarrier, competitiveDifferentiation,
  // strategicRecommendations, riskAssessment) and its loading/error/refresh wiring
  // were removed here — that data is now owned by the useMarketEntry hook inside
  // MarketEntrySection. The cross-section coordination + scout fields below stay.
  isMarketEntryEditing?: boolean;
  marketEntryExpanded?: boolean;
  marketEntryHasEdits?: boolean;
  marketEntryDeletedSections?: Set<string>;
  marketEntryEditHistory?: EditRecord[];
  onCompetitorRefresh?: () => void;
  onToggleEdit: () => void;
  onMarketSizeScoutIconClick: (
    context?:
      | "market-size"
      | "industry-trends"
      | "competitor-landscape"
      | "regulatory-compliance"
      | "market-entry",
    hasEdits?: boolean,
    lastEditedField?: string,
  ) => void | Promise<void>;
  onIndustryTrendsScoutIconClick: (
    context?:
      | "market-size"
      | "industry-trends"
      | "competitor-landscape"
      | "regulatory-compliance"
      | "market-entry",
    hasEdits?: boolean,
    lastEditedField?: string,
  ) => void | Promise<void>;
  onCompetitorScoutIconClick: (
    context?:
      | "market-size"
      | "industry-trends"
      | "competitor-landscape"
      | "regulatory-compliance"
      | "market-entry",
    hasEdits?: boolean,
    lastEditedField?: string,
  ) => void | Promise<void>;
  onRegulatoryScoutIconClick?: (
    context?:
      | "market-size"
      | "industry-trends"
      | "competitor-landscape"
      | "regulatory-compliance"
      | "market-entry",
    hasEdits?: boolean,
    lastEditedField?: string,
  ) => void | Promise<void>;
  onMarketEntryScoutIconClick?: (
    context?:
      | "market-size"
      | "industry-trends"
      | "competitor-landscape"
      | "regulatory-compliance"
      | "market-entry",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void | Promise<void>;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onMarketSizeDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onTamValueChange: (value: string) => void;
  onSamValueChange: (value: string) => void;
  onGrowthRateChange: (value: string) => void;
  onStrategicRecommendationsChange: (recommendations: string[]) => void;
  onMarketEntryChange: (value: string) => void;
  onMarketDriversChange: (drivers: string[]) => void;
  // Industry Trends handlers
  onIndustryTrendsToggleEdit: () => void;
  onIndustryTrendsSaveChanges: () => void;
  onIndustryTrendsCancelEdit: () => void;
  onIndustryTrendsDeleteSection: (sectionId: string) => void;
  onIndustryTrendsEditHistoryOpen: () => void;
  onIndustryTrendsExpandToggle: (expanded: boolean) => void;
  onIndustryTrendsExecutiveSummaryChange: (value: string) => void;
  onIndustryTrendsAiAdoptionChange: (value: string) => void;
  onIndustryTrendsCloudMigrationChange: (value: string) => void;
  onIndustryTrendsRegulatoryChange: (value: string) => void;
  onIndustryTrendSnapshotsChange: (snapshots: TrendSnapshot[]) => void;
  // Competitor Landscape handlers (optional to maintain backward compatibility)
  onCompetitorToggleEdit?: () => void;
  onCompetitorSaveChanges?: () => void;
  onCompetitorCancelEdit?: () => void;
  onCompetitorDeleteSection?: (sectionId: string) => void;
  onCompetitorEditHistoryOpen?: () => void;
  onCompetitorExpandToggle?: (expanded: boolean) => void;
  onCompetitorExecutiveSummaryChange?: (value: string) => void;
  onCompetitorTopPlayerShareChange?: (value: string) => void;
  onCompetitorEmergingPlayersChange?: (value: string) => void;
  onCompetitorFundingNewsChange?: (news: string[]) => void;
  // Regulatory Compliance handlers
  onRegulatoryToggleEdit?: () => void;
  onRegulatorySaveChanges?: () => void;
  onRegulatoryCancelEdit?: () => void;
  onRegulatoryDeleteSection?: (sectionId: string) => void;
  onRegulatoryEditHistoryOpen?: () => void;
  onRegulatoryExpandToggle?: (expanded: boolean) => void;
  onRegulatoryExecutiveSummaryChange?: (value: string) => void;
  onRegulatoryEuAiActDeadlineChange?: (value: string) => void;
  onRegulatoryGdprComplianceChange?: (value: string) => void;
  onRegulatoryPotentialFinesChange?: (value: string) => void;
  onRegulatoryDataLocalizationChange?: (value: string) => void;
  // Market Entry handlers
  onMarketEntryToggleEdit?: () => void;
  onMarketEntrySaveChanges?: () => void;
  onMarketEntryCancelEdit?: () => void;
  onMarketEntryDeleteSection?: (sectionId: string) => void;
  onMarketEntryEditHistoryOpen?: () => void;
  onMarketEntryExpandToggle?: (expanded: boolean) => void;
  onMarketEntryExecutiveSummaryChange?: (value: string) => void;
  onMarketEntryBarriersChange?: (barriers: string[]) => void;
  onMarketEntryRecommendedChannelChange?: (value: string) => void;
  onMarketEntryTimeToMarketChange?: (value: string) => void;
  onMarketEntryTopBarrierChange?: (value: string) => void;
  onMarketEntryCompetitiveDifferentiationChange?: (differentiation: string[]) => void;
  onMarketEntryStrategicRecommendationsChange?: (recommendations: string[]) => void;
  onMarketEntryRiskAssessmentChange?: (risks: string[]) => void;

  // Scout panel visibility states
  showMarketSizeScoutChat?: boolean;
  showIndustryTrendsScoutChat?: boolean;
  showCompetitorScoutChat?: boolean;
  showRegulatoryScoutChat?: boolean;
  showMarketEntryScoutChat?: boolean;

  // Scout panel props
  marketSizeHasEdits?: boolean;
  marketSizeLastEditedField?: string;
  marketSizeCustomMessage?: string;
  // industryTrendsLastEditedField already defined above
  industryTrendsCustomMessage?: string;
  competitorLastEditedField?: string;
  competitorCustomMessage?: string;
  regulatoryLastEditedField?: string;
  regulatoryCustomMessage?: string;
  regulatoryIsPostSave?: boolean;
  marketEntryLastEditedField?: string;
  marketEntryCustomMessage?: string;
  marketEntryIsPostSave?: boolean;

  // Scout panel close handlers
  onMarketSizeScoutClose?: () => void;
  onIndustryTrendsScoutClose?: () => void;
  onCompetitorScoutClose?: () => void;
  onRegulatoryScoutClose?: () => void;
  onMarketEntryScoutClose?: () => void;

  onViewOpportunityLeads?: (sectionContext: string) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}

const MarketIntelligenceSections: React.FC<MarketIntelligenceSectionsProps> = (props) => {
  // Scout Market Intelligence refresh is driven only by MarketResearch.smartRefresh (single
  // sequential cascade). Do not fire parallel component refetches here when isRefreshing —
  // that duplicated API work, broke context passing, and interacted badly with timeouts/retries.
  // Create scout chat panels
  const marketSizeScoutChatPanel = props.showMarketSizeScoutChat ? (
    <ScoutChatPanel
      showScoutChat={props.showMarketSizeScoutChat}
      isSplitView={true}
      hasEdits={props.marketSizeHasEdits || false}
      showEditHistory={false}
      editHistory={props.editHistory}
      lastEditedField={props.marketSizeLastEditedField || ""}
      context="market-size"
      customMessage={props.marketSizeCustomMessage}
      onClose={props.onMarketSizeScoutClose || (() => {})}
    />
  ) : undefined;

  const industryTrendsScoutChatPanel = props.showIndustryTrendsScoutChat ? (
    <ScoutChatPanel
      showScoutChat={props.showIndustryTrendsScoutChat}
      isSplitView={true}
      hasEdits={props.industryTrendsHasEdits || false}
      showEditHistory={false}
      editHistory={props.industryTrendsEditHistory || []}
      lastEditedField={props.industryTrendsLastEditedField || ""}
      context="industry-trends"
      customMessage={props.industryTrendsCustomMessage}
      onClose={props.onIndustryTrendsScoutClose || (() => {})}
    />
  ) : undefined;

  const competitorScoutChatPanel = props.showCompetitorScoutChat ? (
    <ScoutChatPanel
      showScoutChat={props.showCompetitorScoutChat}
      isSplitView={true}
      hasEdits={props.competitorHasEdits || false}
      showEditHistory={false}
      editHistory={props.competitorEditHistory || []}
      lastEditedField=""
      context="competitor-landscape"
      customMessage={props.competitorCustomMessage}
      onClose={props.onCompetitorScoutClose || (() => {})}
    />
  ) : undefined;

  const regulatoryScoutChatPanel = props.showRegulatoryScoutChat ? (
    <ScoutChatPanel
      showScoutChat={props.showRegulatoryScoutChat}
      isSplitView={true}
      hasEdits={false}
      showEditHistory={false}
      editHistory={[]}
      lastEditedField=""
      context="regulatory-compliance"
      isPostSave={props.regulatoryIsPostSave}
      customMessage={props.regulatoryCustomMessage}
      onClose={props.onRegulatoryScoutClose || (() => {})}
    />
  ) : undefined;

  const marketEntryScoutChatPanel = props.showMarketEntryScoutChat ? (
    <ScoutChatPanel
      showScoutChat={props.showMarketEntryScoutChat}
      isSplitView={true}
      hasEdits={props.marketEntryHasEdits || false}
      showEditHistory={false}
      editHistory={props.marketEntryEditHistory || []}
      lastEditedField=""
      context="market-entry"
      isPostSave={props.marketEntryIsPostSave}
      customMessage={props.marketEntryCustomMessage}
      onClose={props.onMarketEntryScoutClose || (() => {})}
    />
  ) : undefined;

  return (
    <>
      {/* Market Size & Opportunity Section */}
      <MarketSizeSection
        isEditing={props.isEditing}
        isSplitView={props.isSplitView}
        isExpanded={props.isExpanded}
        hasEdits={props.hasEdits}
        deletedSections={props.marketSizeDeletedSections}
        editHistory={props.editHistory}
        onToggleEdit={props.onToggleEdit}
        onScoutIconClick={props.onMarketSizeScoutIconClick}
        onEditHistoryOpen={props.onEditHistoryOpen}
        onDeleteSection={props.onMarketSizeDeleteSection}
        onSaveChanges={props.onSaveChanges}
        onCancelEdit={props.onCancelEdit}
        onExpandToggle={props.onExpandToggle}
        onExecutiveSummaryChange={props.onExecutiveSummaryChange}
        onTamValueChange={props.onTamValueChange}
        onSamValueChange={props.onSamValueChange}
        onGrowthRateChange={props.onGrowthRateChange}
        onStrategicRecommendationsChange={props.onStrategicRecommendationsChange}
        onMarketEntryChange={props.onMarketEntryChange}
        onMarketDriversChange={props.onMarketDriversChange}
        onExportPDF={props.onExportPDF}
        onSaveToWorkspace={props.onSaveToWorkspace}
        onGenerateShareableLink={props.onGenerateShareableLink}
        showScoutChat={props.showMarketSizeScoutChat}
        scoutChatPanel={marketSizeScoutChatPanel}
        isLoading={props.isMarketSizeLoading}
        error={props.marketSizeError}
        onRefresh={props.onMarketSizeRefresh}
        isRefreshing={props.isRefreshing}
        companyProfile={props.companyProfile}
      />

      {/* Industry Trends Section */}
      <div className={`${props.showIndustryTrendsScoutChat ? "flex gap-6" : ""}`}>
        <div className={`${props.showIndustryTrendsScoutChat ? "w-1/2" : ""}`}>
          <IndustryTrendsSection
            isIndustryTrendsEditing={props.isIndustryTrendsEditing}
            isSplitView={props.isSplitView}
            industryTrendsExpanded={props.industryTrendsExpanded}
            industryTrendsHasEdits={props.industryTrendsHasEdits}
            industryTrendsDeletedSections={props.industryTrendsDeletedSections}
            industryTrendsEditHistory={props.industryTrendsEditHistory}
            onIndustryTrendsToggleEdit={props.onIndustryTrendsToggleEdit}
            onIndustryTrendsSaveChanges={props.onIndustryTrendsSaveChanges}
            onIndustryTrendsCancelEdit={props.onIndustryTrendsCancelEdit}
            onIndustryTrendsDeleteSection={props.onIndustryTrendsDeleteSection}
            onIndustryTrendsEditHistoryOpen={props.onIndustryTrendsEditHistoryOpen}
            onIndustryTrendsExpandToggle={props.onIndustryTrendsExpandToggle}
            onScoutIconClick={props.onIndustryTrendsScoutIconClick}
            onExportPDF={props.onExportPDF}
            onSaveToWorkspace={props.onSaveToWorkspace}
            onGenerateShareableLink={props.onGenerateShareableLink}
            isRefreshing={props.isRefreshing}
            // Industry-trends data props removed — the section now sources its data
            // via useIndustryTrends. Pass individual field update functions

            onIndustryTrendsExecutiveSummaryChange={props.onIndustryTrendsExecutiveSummaryChange}
            onIndustryTrendsAiAdoptionChange={props.onIndustryTrendsAiAdoptionChange}
            onIndustryTrendsCloudMigrationChange={props.onIndustryTrendsCloudMigrationChange}
            onIndustryTrendsRegulatoryChange={props.onIndustryTrendsRegulatoryChange}
            onIndustryTrendSnapshotsChange={props.onIndustryTrendSnapshotsChange}
          />
        </div>
        {props.showIndustryTrendsScoutChat && industryTrendsScoutChatPanel && (
          <div className="w-1/2">{industryTrendsScoutChatPanel}</div>
        )}
      </div>

      {/* Competitor Landscape Section */}
      <div className={`${props.showCompetitorScoutChat ? "flex gap-6" : ""}`}>
        <div className={`${props.showCompetitorScoutChat ? "w-1/2" : ""}`}>
          <CompetitorLandscapeSection
            key={`competitor-${props.isRefreshing ? "refreshing" : "stable"}`}
            isEditing={props.isCompetitorEditing || false}
            isSplitView={props.isSplitView}
            isExpanded={props.competitorExpanded || false}
            hasEdits={props.competitorHasEdits || false}
            deletedSections={props.competitorDeletedSections || new Set()}
            editHistory={props.competitorEditHistory || []}
            executiveSummary=""
            topPlayerShare=""
            emergingPlayers=""
            fundingNews={[]}
            onToggleEdit={props.onCompetitorToggleEdit || (() => {})}
            onScoutIconClick={props.onCompetitorScoutIconClick}
            onEditHistoryOpen={props.onCompetitorEditHistoryOpen || (() => {})}
            onDeleteSection={props.onCompetitorDeleteSection || (() => {})}
            onSaveChanges={props.onCompetitorSaveChanges || (() => {})}
            onCancelEdit={props.onCompetitorCancelEdit || (() => {})}
            onExpandToggle={props.onCompetitorExpandToggle || (() => {})}
            onExecutiveSummaryChange={props.onCompetitorExecutiveSummaryChange || (() => {})}
            onTopPlayerShareChange={props.onCompetitorTopPlayerShareChange || (() => {})}
            onEmergingPlayersChange={props.onCompetitorEmergingPlayersChange || (() => {})}
            onFundingNewsChange={props.onCompetitorFundingNewsChange || (() => {})}
            onExportPDF={props.onExportPDF}
            onSaveToWorkspace={props.onSaveToWorkspace}
            onGenerateShareableLink={props.onGenerateShareableLink}
            isRefreshing={props.isRefreshing}
            companyProfile={props.companyProfile}
          />
        </div>
        {props.showCompetitorScoutChat && competitorScoutChatPanel && (
          <div className="w-1/2">{competitorScoutChatPanel}</div>
        )}
      </div>

      {/* Regulatory & Compliance Highlights Section */}
      <div className={`${props.showRegulatoryScoutChat ? "flex gap-6" : ""}`}>
        <div className={`${props.showRegulatoryScoutChat ? "w-1/2" : ""}`}>
          <RegulatoryComplianceSection
            isEditing={props.isRegulatoryEditing || false}
            isSplitView={props.isSplitView}
            isExpanded={props.regulatoryExpanded || false}
            hasEdits={props.regulatoryHasEdits || false}
            deletedSections={props.regulatoryDeletedSections || new Set()}
            editHistory={props.regulatoryEditHistory || []}
            executiveSummary={
              props.regulatoryData?.executiveSummary ||
              props.regulatoryExecutiveSummary ||
              "The regulatory landscape for SaaS companies continues to evolve rapidly, with new compliance requirements emerging across multiple jurisdictions. Organizations must navigate an increasingly complex web of data protection, AI governance, and industry-specific regulations."
            }
            euAiActDeadline={
              props.regulatoryData?.euAiActDeadline ||
              props.regulatoryEuAiActDeadline ||
              "February 2, 2025"
            }
            gdprCompliance={
              props.regulatoryData?.gdprCompliance || props.regulatoryGdprCompliance || "68%"
            }
            potentialFines={
              props.regulatoryData?.potentialFines ||
              props.regulatoryPotentialFines ||
              "Up to 6% of annual revenue"
            }
            dataLocalization={
              props.regulatoryData?.dataLocalization ||
              props.regulatoryDataLocalization ||
              "Mandatory for customer data"
            }
            onToggleEdit={props.onRegulatoryToggleEdit || (() => {})}
            onScoutIconClick={props.onRegulatoryScoutIconClick || props.onMarketSizeScoutIconClick}
            onEditHistoryOpen={props.onRegulatoryEditHistoryOpen || (() => {})}
            onDeleteSection={props.onRegulatoryDeleteSection || (() => {})}
            onSaveChanges={props.onRegulatorySaveChanges || (() => {})}
            onCancelEdit={props.onRegulatoryCancelEdit || (() => {})}
            onExpandToggle={props.onRegulatoryExpandToggle || (() => {})}
            onExecutiveSummaryChange={props.onRegulatoryExecutiveSummaryChange || (() => {})}
            onEuAiActDeadlineChange={props.onRegulatoryEuAiActDeadlineChange || (() => {})}
            onGdprComplianceChange={props.onRegulatoryGdprComplianceChange || (() => {})}
            onPotentialFinesChange={props.onRegulatoryPotentialFinesChange || (() => {})}
            onDataLocalizationChange={props.onRegulatoryDataLocalizationChange || (() => {})}
            onExportPDF={props.onExportPDF}
            onSaveToWorkspace={props.onSaveToWorkspace}
            onGenerateShareableLink={props.onGenerateShareableLink}
            companyProfile={props.companyProfile}
          />
        </div>
        {props.showRegulatoryScoutChat && regulatoryScoutChatPanel && (
          <div className="w-1/2">{regulatoryScoutChatPanel}</div>
        )}
      </div>

      {/* Market Entry & Growth Strategy Section */}
      <div className={`${props.showMarketEntryScoutChat ? "flex gap-6" : ""}`}>
        <div className={`${props.showMarketEntryScoutChat ? "w-1/2" : ""}`}>
          <MarketEntrySection
            isEditing={props.isMarketEntryEditing || false}
            isSplitView={props.isSplitView}
            isExpanded={props.marketEntryExpanded || false}
            hasEdits={props.marketEntryHasEdits || false}
            deletedSections={props.marketEntryDeletedSections || new Set()}
            editHistory={props.marketEntryEditHistory || []}
            onToggleEdit={props.onMarketEntryToggleEdit || (() => {})}
            onScoutIconClick={props.onMarketEntryScoutIconClick || props.onMarketSizeScoutIconClick}
            onEditHistoryOpen={props.onMarketEntryEditHistoryOpen || (() => {})}
            onDeleteSection={props.onMarketEntryDeleteSection || (() => {})}
            onSaveChanges={props.onMarketEntrySaveChanges || (() => {})}
            onCancelEdit={props.onMarketEntryCancelEdit || (() => {})}
            onExpandToggle={props.onMarketEntryExpandToggle || (() => {})}
            onExecutiveSummaryChange={props.onMarketEntryExecutiveSummaryChange || (() => {})}
            onEntryBarriersChange={props.onMarketEntryBarriersChange || (() => {})}
            onRecommendedChannelChange={props.onMarketEntryRecommendedChannelChange || (() => {})}
            onTimeToMarketChange={props.onMarketEntryTimeToMarketChange || (() => {})}
            onTopBarrierChange={props.onMarketEntryTopBarrierChange || (() => {})}
            onCompetitiveDifferentiationChange={
              props.onMarketEntryCompetitiveDifferentiationChange || (() => {})
            }
            onStrategicRecommendationsChange={
              props.onMarketEntryStrategicRecommendationsChange || (() => {})
            }
            onRiskAssessmentChange={props.onMarketEntryRiskAssessmentChange || (() => {})}
            onExportPDF={props.onExportPDF}
            onSaveToWorkspace={props.onSaveToWorkspace}
            onGenerateShareableLink={props.onGenerateShareableLink}
          />
        </div>
        {props.showMarketEntryScoutChat && marketEntryScoutChatPanel && (
          <div className="w-1/2">{marketEntryScoutChatPanel}</div>
        )}
      </div>
    </>
  );
};

export default MarketIntelligenceSections;
