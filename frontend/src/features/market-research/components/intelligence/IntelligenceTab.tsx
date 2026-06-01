import { RefreshCw } from "lucide-react";
import React from "react";

import { ScoutDeploymentDetails } from "@/components/market-research/ScoutDeploymentDetails";
import { Button } from "@/components/ui/button";
import EditHistoryPanel from "@/features/market-research/components/EditHistoryPanel";
import SafeMarketIntelligenceTab from "@/features/market-research/components/SafeMarketIntelligenceTab";
import type { useMarketResearchData } from "@/features/market-research/hooks/useMarketResearchData";
import type { DeploymentData } from "@/features/shell";
import type { UntypedReportState } from "@/lib/types/escape-hatches";

type MarketResearchData = ReturnType<typeof useMarketResearchData>;

/**
 * The slice of the market-research data hook that the intelligence subtree consumes,
 * threaded down from the page shell as props (the component owns no state and calls
 * no hook). Derived from the hook's return type so the prop shapes stay in lockstep
 * with the data layer.
 */
type IntelligenceHookSlice = Pick<
  MarketResearchData,
  | "companyProfile"
  | "competitorCustomMessage"
  | "competitorData"
  | "competitorDeletedSections"
  | "competitorEditHistory"
  | "competitorError"
  | "competitorExpanded"
  | "competitorHasEdits"
  | "currentUser"
  | "deletedSections"
  | "editHistory"
  | "editHistoryContext"
  | "fetchCompetitorData"
  | "fetchMarketData"
  | "fetchMarketEntryData"
  | "fetchMarketSizeData"
  | "handleCompetitorCancelEdit"
  | "handleCompetitorDeleteSection"
  | "handleCompetitorEditHistoryOpen"
  | "handleCompetitorEmergingPlayersChange"
  | "handleCompetitorExecutiveSummaryChange"
  | "handleCompetitorExpandToggle"
  | "handleCompetitorFundingNewsChange"
  | "handleCompetitorSaveChanges"
  | "handleCompetitorScoutClick"
  | "handleCompetitorToggleEdit"
  | "handleCompetitorTopPlayerShareChange"
  | "handleEditHistoryClose"
  | "handleEditHistoryOpen"
  | "handleIndustryTrendSnapshotsChange"
  | "handleIndustryTrendsAiAdoptionChange"
  | "handleIndustryTrendsCancelEdit"
  | "handleIndustryTrendsCloudMigrationChange"
  | "handleIndustryTrendsDeleteSection"
  | "handleIndustryTrendsEditHistoryOpen"
  | "handleIndustryTrendsExecutiveSummaryChange"
  | "handleIndustryTrendsExpandToggle"
  | "handleIndustryTrendsRegulatoryChange"
  | "handleIndustryTrendsSaveChanges"
  | "handleIndustryTrendsScoutClick"
  | "handleIndustryTrendsToggleEdit"
  | "handleMarketEntryBarriersChange"
  | "handleMarketEntryCancelEdit"
  | "handleMarketEntryCompetitiveDifferentiationChange"
  | "handleMarketEntryDeleteSection"
  | "handleMarketEntryEditHistoryClose"
  | "handleMarketEntryEditHistoryOpen"
  | "handleMarketEntryExecutiveSummaryChange"
  | "handleMarketEntryExpandToggle"
  | "handleMarketEntryRecommendedChannelChange"
  | "handleMarketEntryRevertEdit"
  | "handleMarketEntryRiskAssessmentChange"
  | "handleMarketEntrySaveChanges"
  | "handleMarketEntryScoutClick"
  | "handleMarketEntryStrategicRecommendationsChange"
  | "handleMarketEntryTimeToMarketChange"
  | "handleMarketEntryToggleEdit"
  | "handleMarketEntryTopBarrierChange"
  | "handleMarketEntryViewEditDetails"
  | "handleMarketIntelligenceCancelEdit"
  | "handleMarketIntelligenceDeleteSection"
  | "handleMarketIntelligenceExecutiveSummaryChange"
  | "handleMarketIntelligenceExpandToggle"
  | "handleMarketIntelligenceExportPDF"
  | "handleMarketIntelligenceGenerateShareableLink"
  | "handleMarketIntelligenceGrowthRateChange"
  | "handleMarketIntelligenceSamValueChange"
  | "handleMarketIntelligenceSaveChanges"
  | "handleMarketIntelligenceSaveToWorkspace"
  | "handleMarketIntelligenceTamValueChange"
  | "handleMarketIntelligenceToggleEdit"
  | "handleMarketSizeDeleteSection"
  | "handleMarketSizeScoutClick"
  | "handleRegulatoryCancelEdit"
  | "handleRegulatoryDataLocalizationChange"
  | "handleRegulatoryDeleteSection"
  | "handleRegulatoryEditHistoryOpen"
  | "handleRegulatoryEuAiActDeadlineChange"
  | "handleRegulatoryExecutiveSummaryChange"
  | "handleRegulatoryExpandToggle"
  | "handleRegulatoryGdprComplianceChange"
  | "handleRegulatoryPotentialFinesChange"
  | "handleRegulatorySaveChanges"
  | "handleRegulatoryScoutClick"
  | "handleRegulatoryToggleEdit"
  | "handleRevertEdit"
  | "handleViewEditDetails"
  | "hasEdits"
  | "industryTrendsCustomMessage"
  | "industryTrendsData"
  | "industryTrendsDeletedSections"
  | "industryTrendsEditHistory"
  | "industryTrendsExpanded"
  | "industryTrendsHasEdits"
  | "industryTrendsLastEditedField"
  | "isCompetitorEditing"
  | "isEditHistoryOpen"
  | "isIndustryTrendsEditing"
  | "isMarketEntryEditHistoryOpen"
  | "isMarketEntryEditing"
  | "isMarketEntryPostSave"
  | "isMarketIntelligenceEditing"
  | "isMarketIntelligenceExpanded"
  | "isMarketSizeLoading"
  | "isRefreshing"
  | "isRegulatoryEditing"
  | "isRegulatoryPostSave"
  | "marketData"
  | "marketEntryCustomMessage"
  | "marketEntryData"
  | "marketEntryDeletedSections"
  | "marketEntryEditHistory"
  | "marketEntryExpanded"
  | "marketEntryHasEdits"
  | "marketIntelligenceData"
  | "marketSizeCustomMessage"
  | "marketSizeDeletedSections"
  | "marketSizeError"
  | "marketSizeHasEdits"
  | "marketSizeLastEditedField"
  | "regulatoryCustomMessage"
  | "regulatoryData"
  | "regulatoryDeletedSections"
  | "regulatoryEditHistory"
  | "regulatoryExpanded"
  | "regulatoryHasEdits"
  | "saveMarketIntelligenceToLocalStorage"
  | "setCompetitorCustomMessage"
  | "setIndustryTrendsCustomMessage"
  | "setIsChatOpen"
  | "setIsMarketEntryPostSave"
  | "setIsRegulatoryPostSave"
  | "setMarketData"
  | "setMarketEntryCustomMessage"
  | "setMarketIntelligenceData"
  | "setMarketSizeCustomMessage"
  | "setRegulatoryCustomMessage"
  | "setShowCompetitorScoutChat"
  | "setShowIndustryTrendsScoutChat"
  | "setShowMarketEntryScoutChat"
  | "setShowMarketSizeScoutChat"
  | "setShowRegulatoryScoutChat"
  | "showCompetitorScoutChat"
  | "showIndustryTrendsScoutChat"
  | "showMarketEntryScoutChat"
  | "showMarketSizeScoutChat"
  | "showRegulatoryScoutChat"
>;

export interface IntelligenceTabProps extends IntelligenceHookSlice {
  /** Shell-owned UI state: deployment summary card (currently always null). */
  scoutDeploymentData: DeploymentData | null;
  /** Shell handler: jump to the lead-stream tab filtered by a section. */
  onViewOpportunityLeads: (sectionContext: string) => void;
}

/**
 * Market Intelligence tab content. Pure presentational container: every value and
 * handler arrives via props from the page shell's useMarketResearchData() destructure.
 * Renders through the existing SafeMarketIntelligenceTab wrapper (the Safe ->
 * FeatureErrorBoundary swap is a later task).
 */
const IntelligenceTab: React.FC<IntelligenceTabProps> = ({
  scoutDeploymentData,
  onViewOpportunityLeads,
  isRefreshing,
  companyProfile,
  competitorData,
  regulatoryData,
  marketData,
  setMarketData,
  marketIntelligenceData,
  setMarketIntelligenceData,
  industryTrendsData,
  marketEntryData,
  currentUser,
  editHistory,
  editHistoryContext,
  isEditHistoryOpen,
  marketEntryEditHistory,
  isMarketEntryEditHistoryOpen,
  fetchMarketData,
  fetchMarketSizeData,
  fetchCompetitorData,
  fetchMarketEntryData,
  saveMarketIntelligenceToLocalStorage,
  setIsChatOpen,
  isMarketIntelligenceEditing,
  isMarketIntelligenceExpanded,
  hasEdits,
  deletedSections,
  isMarketSizeLoading,
  marketSizeError,
  marketSizeDeletedSections,
  marketSizeHasEdits,
  marketSizeLastEditedField,
  showMarketSizeScoutChat,
  setShowMarketSizeScoutChat,
  marketSizeCustomMessage,
  setMarketSizeCustomMessage,
  handleMarketIntelligenceToggleEdit,
  handleMarketIntelligenceDeleteSection,
  handleMarketSizeDeleteSection,
  handleMarketIntelligenceSaveChanges,
  handleMarketIntelligenceCancelEdit,
  handleMarketIntelligenceExpandToggle,
  handleMarketIntelligenceExecutiveSummaryChange,
  handleMarketIntelligenceTamValueChange,
  handleMarketIntelligenceSamValueChange,
  handleMarketIntelligenceGrowthRateChange,
  handleMarketIntelligenceExportPDF,
  handleMarketIntelligenceSaveToWorkspace,
  handleMarketIntelligenceGenerateShareableLink,
  handleMarketSizeScoutClick,
  handleEditHistoryOpen,
  handleEditHistoryClose,
  handleRevertEdit,
  handleViewEditDetails,
  isIndustryTrendsEditing,
  industryTrendsExpanded,
  industryTrendsHasEdits,
  industryTrendsDeletedSections,
  industryTrendsEditHistory,
  industryTrendsLastEditedField,
  showIndustryTrendsScoutChat,
  setShowIndustryTrendsScoutChat,
  industryTrendsCustomMessage,
  setIndustryTrendsCustomMessage,
  handleIndustryTrendsToggleEdit,
  handleIndustryTrendsSaveChanges,
  handleIndustryTrendsCancelEdit,
  handleIndustryTrendsDeleteSection,
  handleIndustryTrendsEditHistoryOpen,
  handleIndustryTrendsExpandToggle,
  handleIndustryTrendsExecutiveSummaryChange,
  handleIndustryTrendsAiAdoptionChange,
  handleIndustryTrendsCloudMigrationChange,
  handleIndustryTrendsRegulatoryChange,
  handleIndustryTrendSnapshotsChange,
  handleIndustryTrendsScoutClick,
  isCompetitorEditing,
  competitorExpanded,
  competitorHasEdits,
  competitorDeletedSections,
  competitorEditHistory,
  competitorError,
  showCompetitorScoutChat,
  setShowCompetitorScoutChat,
  competitorCustomMessage,
  setCompetitorCustomMessage,
  handleCompetitorToggleEdit,
  handleCompetitorSaveChanges,
  handleCompetitorCancelEdit,
  handleCompetitorDeleteSection,
  handleCompetitorEditHistoryOpen,
  handleCompetitorExpandToggle,
  handleCompetitorExecutiveSummaryChange,
  handleCompetitorTopPlayerShareChange,
  handleCompetitorEmergingPlayersChange,
  handleCompetitorFundingNewsChange,
  handleCompetitorScoutClick,
  isRegulatoryEditing,
  regulatoryExpanded,
  regulatoryHasEdits,
  regulatoryDeletedSections,
  regulatoryEditHistory,
  isRegulatoryPostSave,
  setIsRegulatoryPostSave,
  showRegulatoryScoutChat,
  setShowRegulatoryScoutChat,
  regulatoryCustomMessage,
  setRegulatoryCustomMessage,
  handleRegulatoryToggleEdit,
  handleRegulatorySaveChanges,
  handleRegulatoryCancelEdit,
  handleRegulatoryDeleteSection,
  handleRegulatoryEditHistoryOpen,
  handleRegulatoryExpandToggle,
  handleRegulatoryExecutiveSummaryChange,
  handleRegulatoryEuAiActDeadlineChange,
  handleRegulatoryGdprComplianceChange,
  handleRegulatoryPotentialFinesChange,
  handleRegulatoryDataLocalizationChange,
  handleRegulatoryScoutClick,
  isMarketEntryEditing,
  marketEntryExpanded,
  marketEntryHasEdits,
  marketEntryDeletedSections,
  isMarketEntryPostSave,
  setIsMarketEntryPostSave,
  showMarketEntryScoutChat,
  setShowMarketEntryScoutChat,
  marketEntryCustomMessage,
  setMarketEntryCustomMessage,
  handleMarketEntryToggleEdit,
  handleMarketEntrySaveChanges,
  handleMarketEntryCancelEdit,
  handleMarketEntryDeleteSection,
  handleMarketEntryEditHistoryOpen,
  handleMarketEntryEditHistoryClose,
  handleMarketEntryExpandToggle,
  handleMarketEntryExecutiveSummaryChange,
  handleMarketEntryBarriersChange,
  handleMarketEntryRecommendedChannelChange,
  handleMarketEntryTimeToMarketChange,
  handleMarketEntryTopBarrierChange,
  handleMarketEntryCompetitiveDifferentiationChange,
  handleMarketEntryStrategicRecommendationsChange,
  handleMarketEntryRiskAssessmentChange,
  handleMarketEntryRevertEdit,
  handleMarketEntryViewEditDetails,
  handleMarketEntryScoutClick,
}) => {
  return marketData ? (
    <div className="space-y-6">
      {/* Display deployment details if Scout has been deployed */}

      {scoutDeploymentData && <ScoutDeploymentDetails deploymentData={scoutDeploymentData} />}

      {/* Market Intelligence Tab with embedded scout chats */}

      <SafeMarketIntelligenceTab
        isRefreshing={isRefreshing}
        companyProfile={companyProfile}
        competitorData={competitorData}
        // Individual competitor props for fallback

        competitorExecutiveSummary={competitorData?.executiveSummary || ""}
        competitorTopPlayerShare={competitorData?.topPlayerShare || ""}
        competitorEmergingPlayers={competitorData?.emergingPlayers || ""}
        competitorFundingNews={competitorData?.fundingNews || []}
        regulatoryData={regulatoryData}
        isEditing={isMarketIntelligenceEditing}
        isSplitView={false}
        isExpanded={isMarketIntelligenceExpanded}
        hasEdits={hasEdits}
        deletedSections={deletedSections}
        editHistory={editHistory}
        executiveSummary={marketData?.executiveSummary || marketIntelligenceData.executiveSummary}
        tamValue={marketData?.tamValue || marketIntelligenceData.tamValue}
        samValue={marketData?.samValue || marketIntelligenceData.samValue}
        GrowthRate={marketData?.GrowthRate || marketIntelligenceData.GrowthRate}
        strategicRecommendations={
          marketData?.strategicRecommendations || marketIntelligenceData.strategicRecommendations
        }
        marketEntry={marketData?.marketEntry || marketIntelligenceData.marketEntry}
        marketDrivers={marketData?.marketDrivers || marketIntelligenceData.marketDrivers}
        marketSizeBySegment={
          marketData?.marketSizeBySegment || marketIntelligenceData.marketSizeBySegment
        }
        growthProjections={
          marketData?.growthProjections || marketIntelligenceData.growthProjections
        }
        // Market Size specific props

        marketSizeDeletedSections={marketSizeDeletedSections}
        isMarketSizeLoading={isRefreshing ? false : isMarketSizeLoading}
        marketSizeError={marketSizeError}
        onMarketSizeRefresh={() => fetchMarketSizeData(true)}
        // Industry Trends props

        isIndustryTrendsEditing={isIndustryTrendsEditing}
        industryTrendsExpanded={industryTrendsExpanded}
        industryTrendsHasEdits={industryTrendsHasEdits}
        industryTrendsDeletedSections={industryTrendsDeletedSections}
        industryTrendsEditHistory={industryTrendsEditHistory}
        industryTrendsExecutiveSummary={industryTrendsData?.executiveSummary}
        industryTrendsAiAdoption={industryTrendsData?.aiAdoption}
        industryTrendsCloudMigration={industryTrendsData?.cloudMigration}
        industryTrendsRegulatory={industryTrendsData?.regulatory}
        industryTrendSnapshots={industryTrendsData?.trendSnapshots}
        industryTrendsRecommendations={industryTrendsData?.recommendations}
        industryTrendsRisks={industryTrendsData?.risks}
        industryTrendsRegionalHotspots={industryTrendsData?.regionalHotspots}
        industryTrendsVisualCharts={industryTrendsData?.visualCharts}
        industryTrendsLastEditedField={industryTrendsLastEditedField}
        // Competitor Landscape props - pass structured data

        isCompetitorEditing={isCompetitorEditing}
        competitorExpanded={competitorExpanded}
        competitorHasEdits={competitorHasEdits}
        competitorDeletedSections={competitorDeletedSections}
        competitorEditHistory={competitorEditHistory}
        competitorError={competitorError}
        // Add refresh handler for competitor data

        onCompetitorRefresh={() => fetchCompetitorData(true)}
        // Regulatory Compliance props - pass structured data

        isRegulatoryEditing={isRegulatoryEditing}
        regulatoryExpanded={regulatoryExpanded}
        regulatoryHasEdits={regulatoryHasEdits}
        regulatoryDeletedSections={regulatoryDeletedSections}
        regulatoryEditHistory={regulatoryEditHistory}
        regulatoryExecutiveSummary={regulatoryData?.executiveSummary || ""}
        regulatoryEuAiActDeadline={regulatoryData?.euAiActDeadline || ""}
        regulatoryGdprCompliance={regulatoryData?.gdprCompliance || ""}
        regulatoryPotentialFines={regulatoryData?.potentialFines || ""}
        regulatoryDataLocalization={regulatoryData?.dataLocalization || ""}
        // Market Entry props

        isMarketEntryEditing={isMarketEntryEditing}
        marketEntryExpanded={marketEntryExpanded}
        marketEntryHasEdits={marketEntryHasEdits}
        marketEntryDeletedSections={marketEntryDeletedSections}
        marketEntryEditHistory={marketEntryEditHistory}
        marketEntryExecutiveSummary={marketEntryData?.executiveSummary}
        marketEntryBarriers={marketEntryData?.entryBarriers}
        marketEntryRecommendedChannel={marketEntryData?.recommendedChannel}
        marketEntryTimeToMarket={marketEntryData?.timeToMarket}
        marketEntryTopBarrier={marketEntryData?.topBarrier}
        marketEntryCompetitiveDifferentiation={marketEntryData?.competitiveDifferentiation}
        marketEntryStrategicRecommendations={marketEntryData?.strategicRecommendations}
        marketEntryRiskAssessment={marketEntryData?.riskAssessment}
        // Market Entry loading states and handlers

        isMarketEntryLoading={isMarketSizeLoading}
        marketEntryError={marketSizeError}
        onToggleEdit={handleMarketIntelligenceToggleEdit}
        onMarketSizeScoutIconClick={handleMarketSizeScoutClick}
        onIndustryTrendsScoutIconClick={handleIndustryTrendsScoutClick}
        onCompetitorScoutIconClick={handleCompetitorScoutClick}
        onEditHistoryOpen={handleEditHistoryOpen}
        onDeleteSection={handleMarketIntelligenceDeleteSection}
        onMarketSizeDeleteSection={handleMarketSizeDeleteSection}
        onSaveChanges={handleMarketIntelligenceSaveChanges}
        onCancelEdit={handleMarketIntelligenceCancelEdit}
        onExpandToggle={handleMarketIntelligenceExpandToggle}
        onExecutiveSummaryChange={handleMarketIntelligenceExecutiveSummaryChange}
        onTamValueChange={handleMarketIntelligenceTamValueChange}
        onSamValueChange={handleMarketIntelligenceSamValueChange}
        onGrowthRateChange={handleMarketIntelligenceGrowthRateChange}
        onStrategicRecommendationsChange={(recommendations) => {
          setMarketIntelligenceData((prev: UntypedReportState) => {
            // CRITICAL: Always include user_id to ensure data isolation
            const newData = {
              ...prev,
              strategicRecommendations: recommendations,
              user_id: currentUser?.uid || prev.user_id,
            };

            saveMarketIntelligenceToLocalStorage(newData);

            // Also update marketData to keep them in sync - initialize if null
            setMarketData((prev) =>
              prev
                ? { ...prev, strategicRecommendations: recommendations }
                : {
                    ...newData,
                    strategicRecommendations: recommendations,
                  },
            );

            return newData;
          });
        }}
        onMarketEntryChange={(value) => {
          setMarketIntelligenceData((prev: UntypedReportState) => {
            // CRITICAL: Always include user_id to ensure data isolation
            const newData = {
              ...prev,
              marketEntry: value,
              user_id: currentUser?.uid || prev.user_id,
            };

            saveMarketIntelligenceToLocalStorage(newData);

            // Also update marketData to keep them in sync - initialize if null
            setMarketData((prev) =>
              prev
                ? { ...prev, marketEntry: value }
                : {
                    ...newData,
                    marketEntry: value,
                  },
            );

            return newData;
          });
        }}
        onMarketDriversChange={(drivers) => {
          setMarketIntelligenceData((prev: UntypedReportState) => {
            // CRITICAL: Always include user_id to ensure data isolation
            const newData = {
              ...prev,
              marketDrivers: drivers,
              user_id: currentUser?.uid || prev.user_id,
            };

            saveMarketIntelligenceToLocalStorage(newData);

            // Also update marketData to keep them in sync - initialize if null
            setMarketData((prev) =>
              prev
                ? { ...prev, marketDrivers: drivers }
                : {
                    ...newData,
                    marketDrivers: drivers,
                  },
            );

            return newData;
          });
        }}
        // Industry Trends handlers

        onIndustryTrendsToggleEdit={handleIndustryTrendsToggleEdit}
        onIndustryTrendsSaveChanges={handleIndustryTrendsSaveChanges}
        onIndustryTrendsCancelEdit={handleIndustryTrendsCancelEdit}
        onIndustryTrendsDeleteSection={handleIndustryTrendsDeleteSection}
        onIndustryTrendsEditHistoryOpen={handleIndustryTrendsEditHistoryOpen}
        onIndustryTrendsExpandToggle={handleIndustryTrendsExpandToggle}
        onIndustryTrendsExecutiveSummaryChange={handleIndustryTrendsExecutiveSummaryChange}
        onIndustryTrendsAiAdoptionChange={handleIndustryTrendsAiAdoptionChange}
        onIndustryTrendsCloudMigrationChange={handleIndustryTrendsCloudMigrationChange}
        onIndustryTrendsRegulatoryChange={handleIndustryTrendsRegulatoryChange}
        onIndustryTrendSnapshotsChange={handleIndustryTrendSnapshotsChange}
        // Competitor Landscape handlers

        onCompetitorToggleEdit={handleCompetitorToggleEdit}
        onCompetitorSaveChanges={handleCompetitorSaveChanges}
        onCompetitorCancelEdit={handleCompetitorCancelEdit}
        onCompetitorDeleteSection={handleCompetitorDeleteSection}
        onCompetitorEditHistoryOpen={handleCompetitorEditHistoryOpen}
        onCompetitorExpandToggle={handleCompetitorExpandToggle}
        onCompetitorExecutiveSummaryChange={handleCompetitorExecutiveSummaryChange}
        onCompetitorTopPlayerShareChange={handleCompetitorTopPlayerShareChange}
        onCompetitorEmergingPlayersChange={handleCompetitorEmergingPlayersChange}
        onCompetitorFundingNewsChange={handleCompetitorFundingNewsChange}
        // Regulatory Compliance handlers

        onRegulatoryToggleEdit={handleRegulatoryToggleEdit}
        onRegulatorySaveChanges={handleRegulatorySaveChanges}
        onRegulatoryCancelEdit={handleRegulatoryCancelEdit}
        onRegulatoryDeleteSection={handleRegulatoryDeleteSection}
        onRegulatoryEditHistoryOpen={handleRegulatoryEditHistoryOpen}
        onRegulatoryExpandToggle={handleRegulatoryExpandToggle}
        onRegulatoryExecutiveSummaryChange={handleRegulatoryExecutiveSummaryChange}
        onRegulatoryEuAiActDeadlineChange={handleRegulatoryEuAiActDeadlineChange}
        onRegulatoryGdprComplianceChange={handleRegulatoryGdprComplianceChange}
        onRegulatoryPotentialFinesChange={handleRegulatoryPotentialFinesChange}
        onRegulatoryDataLocalizationChange={handleRegulatoryDataLocalizationChange}
        onRegulatoryScoutIconClick={handleRegulatoryScoutClick}
        // Market Entry handlers

        onMarketEntryToggleEdit={handleMarketEntryToggleEdit}
        onMarketEntrySaveChanges={handleMarketEntrySaveChanges}
        onMarketEntryRefresh={() => fetchMarketEntryData(true)}
        onMarketEntryCancelEdit={handleMarketEntryCancelEdit}
        onMarketEntryDeleteSection={handleMarketEntryDeleteSection}
        onMarketEntryEditHistoryOpen={handleMarketEntryEditHistoryOpen}
        onMarketEntryExpandToggle={handleMarketEntryExpandToggle}
        onMarketEntryExecutiveSummaryChange={handleMarketEntryExecutiveSummaryChange}
        onMarketEntryBarriersChange={handleMarketEntryBarriersChange}
        onMarketEntryRecommendedChannelChange={handleMarketEntryRecommendedChannelChange}
        onMarketEntryTimeToMarketChange={handleMarketEntryTimeToMarketChange}
        onMarketEntryTopBarrierChange={handleMarketEntryTopBarrierChange}
        onMarketEntryCompetitiveDifferentiationChange={
          handleMarketEntryCompetitiveDifferentiationChange
        }
        onMarketEntryStrategicRecommendationsChange={handleMarketEntryStrategicRecommendationsChange}
        onMarketEntryRiskAssessmentChange={handleMarketEntryRiskAssessmentChange}
        onMarketEntryScoutIconClick={handleMarketEntryScoutClick}
        onExportPDF={handleMarketIntelligenceExportPDF}
        onSaveToWorkspace={handleMarketIntelligenceSaveToWorkspace}
        onGenerateShareableLink={handleMarketIntelligenceGenerateShareableLink}
        onViewOpportunityLeads={onViewOpportunityLeads}
        // Scout chat panel visibility

        showMarketSizeScoutChat={showMarketSizeScoutChat}
        showIndustryTrendsScoutChat={showIndustryTrendsScoutChat}
        showCompetitorScoutChat={showCompetitorScoutChat}
        showRegulatoryScoutChat={showRegulatoryScoutChat}
        showMarketEntryScoutChat={showMarketEntryScoutChat}
        // Scout chat panel close handlers

        onMarketSizeScoutClose={() => {
          setShowMarketSizeScoutChat(false);

          setMarketSizeCustomMessage(undefined);

          setIsChatOpen(false);
        }}
        onIndustryTrendsScoutClose={() => {
          setShowIndustryTrendsScoutChat(false);

          setIndustryTrendsCustomMessage(undefined);

          setIsChatOpen(false);
        }}
        onCompetitorScoutClose={() => {
          setShowCompetitorScoutChat(false);

          setCompetitorCustomMessage(undefined);

          setIsChatOpen(false);
        }}
        onRegulatoryScoutClose={() => {
          setShowRegulatoryScoutChat(false);

          setIsRegulatoryPostSave(false);

          setRegulatoryCustomMessage(undefined);
        }}
        onMarketEntryScoutClose={() => {
          setShowMarketEntryScoutChat(false);

          setIsMarketEntryPostSave(false);

          setMarketEntryCustomMessage(undefined);

          setIsChatOpen(false);
        }}
        // Scout panel state props

        marketSizeHasEdits={marketSizeHasEdits}
        marketSizeLastEditedField={marketSizeLastEditedField}
        marketSizeCustomMessage={marketSizeCustomMessage}
        industryTrendsCustomMessage={industryTrendsCustomMessage}
        competitorCustomMessage={competitorCustomMessage}
        regulatoryCustomMessage={regulatoryCustomMessage}
        regulatoryIsPostSave={isRegulatoryPostSave}
        marketEntryCustomMessage={marketEntryCustomMessage}
        marketEntryIsPostSave={isMarketEntryPostSave}
      />

      <EditHistoryPanel
        isOpen={isEditHistoryOpen}
        onClose={handleEditHistoryClose}
        editHistory={editHistory}
        onRevert={handleRevertEdit}
        onViewDetails={handleViewEditDetails}
        context={editHistoryContext}
      />

      {/* Market Entry Edit History Panel */}

      <EditHistoryPanel
        isOpen={isMarketEntryEditHistoryOpen}
        onClose={handleMarketEntryEditHistoryClose}
        editHistory={marketEntryEditHistory}
        onRevert={handleMarketEntryRevertEdit}
        onViewDetails={handleMarketEntryViewEditDetails}
        context="Market Entry & Growth Strategy"
      />
    </div>
  ) : (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <p className="mb-4">No market data available</p>

        <Button onClick={() => fetchMarketData()} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Load Data
        </Button>
      </div>
    </div>
  );
};

export default IntelligenceTab;
