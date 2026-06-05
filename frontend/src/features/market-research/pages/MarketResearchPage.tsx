import {
  Search,
  MessageSquare,
  Users,
  RefreshCw,
  AlertCircle,
  History,
  Calendar,
  Loader2,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import IntelligenceTab from "../components/intelligence/IntelligenceTab";
import LeadStreamTab from "../components/lead-stream/LeadStreamTab";
import { MarketDetailDrawer } from "../components/MarketDetailDrawer";
import { ScoutSettingsForm } from "../components/ScoutSettingsForm";
import TrendsTab from "../components/trends/TrendsTab";
import { useMarketResearchData } from "../hooks/useMarketResearchData";
import {
  buildLeadStreamChatContext,
  LEAD_STREAM_CHAT_CONTEXT_KEY,
} from "../lib/leadStreamChatContext";
import type { ScoutResearchContext } from "../types";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layout } from "@/features/shell";
import type { DeploymentData } from "@/features/shell";
import { usePageTitle } from "@/shared/hooks/usePageTitle";
import type { UntypedLead } from "@/shared/types/escape-hatches";

// Minimal shape the detail drawer needs for its (currently always-null) selected market.
interface Market {
  name: string;
  score: string;
  size: string;
  competition: string;
  barriers: string;
  details: {
    summary: string;
    subMarkets: Array<{ name: string; size: string; growth: string }>;
    keyInsights: string[];
    recommendedActions: string[];
  };
}

/**
 * Thin shell for the Scout market-research page. The data layer (fetch + cache +
 * cascade + all per-section edit/scout-chat state) lives in `useMarketResearchData`;
 * the three tabs are extracted into IntelligenceTab / LeadStreamTab / TrendsTab.
 *
 * Residual shell state, classified per Spec 24 §5 (hoistability):
 * - activeTab / activeTabRef: ROUTING — derived from location.pathname via
 *   getActiveTabFromPath(); intentionally not normalized to useParams (out of scope).
 * - scoutResearchContext / scoutMode: CROSS-TAB pair — written by the analysis
 *   handlers below, read by <TrendsTab>. Hoisted as PROPS, not context: only 2
 *   shallow consumers, so the §5 default (props) applies. No MarketResearchContext.
 * - isDrawerOpen / isSettingsOpen / scoutDeploymentData / selectedMarket: SHELL UI —
 *   retained because each is still read in live JSX (MarketDetailDrawer,
 *   ScoutSettingsForm, IntelligenceTab prop). scoutDeploymentData / selectedMarket
 *   are always-null today but consumed, so kept (not dead).
 * - No data/server useState remains in the shell; it is all in the hook.
 */
const MarketResearch = React.memo(() => {
  usePageTitle("🔍 Scout - Brewra");

  const navigate = useNavigate();

  const location = useLocation();

  // Extract tab from URL path

  const getActiveTabFromPath = () => {
    const pathSegments = location.pathname.split("/");

    const lastSegment = pathSegments[pathSegments.length - 1];

    // Map URL segments to tab values

    const tabMap: { [key: string]: string } = {
      marketintelligence: "intelligence",

      leadstream: "analysis",

      chatwithscout: "trends",
    };

    return tabMap[lastSegment] || "intelligence";
  };

  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const [scoutResearchContext, setScoutResearchContext] = useState<ScoutResearchContext | null>(
    null,
  );
  const [scoutMode, setScoutMode] = useState<"selected-leads" | "full-list">("selected-leads");

  // Data layer (raw fetch + cache + cascade) lives in the hook; the shell threads the
  // live tab ref in so the hook's scoutRefresh listener can route without owning routing.
  const {
    currentUser,
    getUserCache,
    isCacheValid,
    isInitialLoading,
    isRefreshing,
    error,
    isShowingHistoricalData,
    historicalDataTimestamp,
    hasAnyValidData,
    marketData,
    setMarketData,
    marketIntelligenceData,
    setMarketIntelligenceData,
    competitorData,
    regulatoryData,
    companyProfile,
    editHistory,
    editHistoryContext,
    isEditHistoryOpen,
    marketEntryEditHistory,
    isMarketEntryEditHistoryOpen,
    fetchMarketData,
    fetchMarketSizeData,
    fetchCompetitorData,
    returnToCurrentData,
    formatTimestamp,
    saveMarketIntelligenceToLocalStorage,
    setIsChatOpen,
    isAIViewActive,
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
    opportunityFilter,
    setOpportunityFilter,
  } = useMarketResearchData(activeTabRef);

  // Handle tab changes with URL navigation

  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
    if (tabValue !== "trends") setScoutResearchContext(null);

    // Map tab values to URL segments

    const urlMap: { [key: string]: string } = {
      intelligence: "marketintelligence",

      analysis: "leadstream",

      trends: "chatwithscout",
    };

    const urlSegment = urlMap[tabValue] || "marketintelligence";

    navigate(`/your-ai-team/scout/${urlSegment}`);
  };

  /** Lead Stream → Chat with Scout: use session history UI + lead sidebar (not legacy full-page chat). */
  const handleChatWithScout = (leads: UntypedLead[], reportFilter?: string) => {
    setScoutResearchContext(null);
    try {
      const ctx = buildLeadStreamChatContext(leads, reportFilter);
      sessionStorage.setItem(LEAD_STREAM_CHAT_CONTEXT_KEY, JSON.stringify(ctx));
    } catch {
      sessionStorage.removeItem(LEAD_STREAM_CHAT_CONTEXT_KEY);
    }
    handleTabChange("trends");
  };

  const handleViewOpportunityLeads = (sectionContext: string) => {
    setOpportunityFilter(sectionContext);
    handleTabChange("analysis");
  };

  const handleChatAboutCoverage = () => {
    setScoutMode("full-list");
    setScoutResearchContext({
      leads: [],
      opportunity: "Leads Coverage Analysis",
      icp: "All Segments",
      reportTraits: [
        "Total Leads: 120",
        "Matched Leads: 74 (62%)",
        "Unmatched Leads: 46 (38%)",
        "62% should comprise of your active pipeline",
      ],
    });
    handleTabChange("trends");
  };

  const handleSendToStrategist = (lead: UntypedLead) => {
    // Persist lead to strategist lead stream
    const existing = JSON.parse(
      localStorage.getItem("strategistLeadStream") || "[]",
    ) as UntypedLead[];
    const alreadyExists = existing.some((l: UntypedLead) => l.id === lead.id);
    if (!alreadyExists) {
      existing.push({ ...lead, sentAt: new Date().toISOString() });
      localStorage.setItem("strategistLeadStream", JSON.stringify(existing));
    }
    navigate("/your-ai-team/strategist/leadstream");
  };

  // Update active tab when URL changes

  useEffect(() => {
    const newActiveTab = getActiveTabFromPath();

    if (newActiveTab !== activeTab) {
      setActiveTab(newActiveTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getActiveTabFromPath is a stable in-component helper that reads location.pathname (already a dep)
  }, [location.pathname, activeTab]);

  // Shell UI chrome state (not data layer)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [scoutDeploymentData] = useState<DeploymentData | null>(null);

  const [selectedMarket] = useState<Market | null>(null);

  // Listen for custom events from header buttons (scout Refresh → Lead Stream vs full Scout: handled in the data hook)

  useEffect(() => {
    const handleScoutHistory = () => {
      // Trigger history dialog

      const historyButton = document.querySelector("[data-history-button]");

      if (historyButton) {
        (historyButton as HTMLElement).click();
      }
    };

    const handleScoutSettings = () => {
      setIsSettingsOpen(true);
    };

    window.addEventListener("scoutHistory", handleScoutHistory);

    window.addEventListener("scoutSettings", handleScoutSettings);

    return () => {
      window.removeEventListener("scoutHistory", handleScoutHistory);

      window.removeEventListener("scoutSettings", handleScoutSettings);
    };
  }, []);

  // Show error state only if we have an error and no existing data AND not initially loading

  if (error && !marketData && !isInitialLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading data: {error}</p>

            <Button onClick={() => fetchMarketData()} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Show loading screen when initially loading and no data exists
  // (hasAnyValidData is derived in the data hook)

  if (isInitialLoading && !hasAnyValidData) {
    return (
      <Layout>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />

              <p className="text-gray-600">Loading Scout data...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full relative">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex flex-col flex-1 min-h-0 w-full"
        >
          {/* Fixed header section */}

          <div className="sticky top-0 bg-white z-20 pb-2">
            <div className="animate-fade-in">
              {/* Historical data indicator */}

              {isShowingHistoricalData && historicalDataTimestamp && (
                <Alert className="mb-4 border-amber-200 bg-amber-50">
                  <History className="h-4 w-4 text-amber-600" />

                  <AlertDescription className="text-amber-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />

                      <span>
                        Viewing historical report from {formatTimestamp(historicalDataTimestamp)}
                      </span>

                      <Badge variant="outline" className="text-amber-700 border-amber-300">
                        Historical Data
                      </Badge>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={returnToCurrentData}
                      className="ml-4 text-amber-700 border-amber-300 hover:bg-amber-100"
                    >
                      Return to Current
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Error alert for any operation failures - only show if we have data to fall back to and it's not a rate limit error */}

              {error &&
                marketData &&
                !isRefreshing &&
                !isInitialLoading &&
                !isShowingHistoricalData &&
                !error.includes("rate limiting") &&
                !error.includes("429") &&
                !error.includes("rate_limit") && (
                  <Alert className="mb-4 border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />

                    <AlertDescription className="text-red-800">
                      Operation failed: {error}. Showing previous data.
                    </AlertDescription>
                  </Alert>
                )}

              {/* Cache indicator when showing cached data and not loading */}

              {marketData &&
                (() => {
                  const cache = getUserCache(currentUser?.uid);
                  return cache.data === marketData && cache.timestamp;
                })() &&
                !isRefreshing &&
                !isInitialLoading &&
                !isShowingHistoricalData &&
                (() => {
                  const cache = getUserCache(currentUser?.uid);
                  return cache.timestamp;
                })() && (
                  <Alert className="mb-4 border-blue-200 bg-blue-50">
                    <AlertCircle className="h-4 w-4 text-blue-600" />

                    <AlertDescription className="text-blue-800">
                      {(() => {
                        const cache = getUserCache(currentUser?.uid);
                        return isCacheValid(currentUser?.uid)
                          ? `Showing cached data from ${new Date(cache.timestamp || 0).toLocaleTimeString()}`
                          : `Showing expired cached data from ${new Date(cache.timestamp || 0).toLocaleTimeString()}`;
                      })()}
                    </AlertDescription>
                  </Alert>
                )}

              {/* Loading Modal - Replaced ComponentStatusLoadingScreen */}

              <TabsList className="w-full bg-gray-100 p-1 mb-2">
                <TabsTrigger value="intelligence" className="flex items-center gap-2 flex-1">
                  <Search className="h-4 w-4" />
                  Market Intelligence
                </TabsTrigger>

                <TabsTrigger value="analysis" className="flex items-center gap-2 flex-1">
                  <Users className="h-4 w-4" />
                  Your Lead Stream
                </TabsTrigger>

                <TabsTrigger value="trends" className="flex items-center gap-2 flex-1">
                  <MessageSquare className="h-4 w-4" />
                  Chat with Scout
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Scrollable content area - ALWAYS show content if data exists */}

          {activeTab === "trends" ? (
            <TrendsTab
              scoutResearchContext={scoutResearchContext}
              scoutMode={scoutMode}
              editHistory={editHistory}
              onTabChange={setActiveTab}
            />
          ) : (
            <ScrollArea className="flex-1">
              {/* Show content only when all components are successful or when not refreshing */}

              <div
                className={`transition-opacity duration-300 ${
                  (isRefreshing || isInitialLoading) && marketData ? "opacity-70" : "opacity-100"
                } relative h-full min-h-0 flex flex-col`}
              >
                {/* Show main content when not refreshing */}

                {!isRefreshing ? (
                  <>
                    <TabsContent value="intelligence" className="mt-0">
                      <IntelligenceTab
                        scoutDeploymentData={scoutDeploymentData}
                        onViewOpportunityLeads={handleViewOpportunityLeads}
                        isRefreshing={isRefreshing}
                        companyProfile={companyProfile}
                        competitorData={competitorData}
                        regulatoryData={regulatoryData}
                        marketData={marketData}
                        setMarketData={setMarketData}
                        marketIntelligenceData={marketIntelligenceData}
                        setMarketIntelligenceData={setMarketIntelligenceData}
                        currentUser={currentUser}
                        editHistory={editHistory}
                        editHistoryContext={editHistoryContext}
                        isEditHistoryOpen={isEditHistoryOpen}
                        marketEntryEditHistory={marketEntryEditHistory}
                        isMarketEntryEditHistoryOpen={isMarketEntryEditHistoryOpen}
                        fetchMarketData={fetchMarketData}
                        fetchMarketSizeData={fetchMarketSizeData}
                        fetchCompetitorData={fetchCompetitorData}
                        saveMarketIntelligenceToLocalStorage={saveMarketIntelligenceToLocalStorage}
                        setIsChatOpen={setIsChatOpen}
                        isMarketIntelligenceEditing={isMarketIntelligenceEditing}
                        isMarketIntelligenceExpanded={isMarketIntelligenceExpanded}
                        hasEdits={hasEdits}
                        deletedSections={deletedSections}
                        isMarketSizeLoading={isMarketSizeLoading}
                        marketSizeError={marketSizeError}
                        marketSizeDeletedSections={marketSizeDeletedSections}
                        marketSizeHasEdits={marketSizeHasEdits}
                        marketSizeLastEditedField={marketSizeLastEditedField}
                        showMarketSizeScoutChat={showMarketSizeScoutChat}
                        setShowMarketSizeScoutChat={setShowMarketSizeScoutChat}
                        marketSizeCustomMessage={marketSizeCustomMessage}
                        setMarketSizeCustomMessage={setMarketSizeCustomMessage}
                        handleMarketIntelligenceToggleEdit={handleMarketIntelligenceToggleEdit}
                        handleMarketIntelligenceDeleteSection={
                          handleMarketIntelligenceDeleteSection
                        }
                        handleMarketSizeDeleteSection={handleMarketSizeDeleteSection}
                        handleMarketIntelligenceSaveChanges={handleMarketIntelligenceSaveChanges}
                        handleMarketIntelligenceCancelEdit={handleMarketIntelligenceCancelEdit}
                        handleMarketIntelligenceExpandToggle={handleMarketIntelligenceExpandToggle}
                        handleMarketIntelligenceExecutiveSummaryChange={
                          handleMarketIntelligenceExecutiveSummaryChange
                        }
                        handleMarketIntelligenceTamValueChange={
                          handleMarketIntelligenceTamValueChange
                        }
                        handleMarketIntelligenceSamValueChange={
                          handleMarketIntelligenceSamValueChange
                        }
                        handleMarketIntelligenceGrowthRateChange={
                          handleMarketIntelligenceGrowthRateChange
                        }
                        handleMarketIntelligenceExportPDF={handleMarketIntelligenceExportPDF}
                        handleMarketIntelligenceSaveToWorkspace={
                          handleMarketIntelligenceSaveToWorkspace
                        }
                        handleMarketIntelligenceGenerateShareableLink={
                          handleMarketIntelligenceGenerateShareableLink
                        }
                        handleMarketSizeScoutClick={handleMarketSizeScoutClick}
                        handleEditHistoryOpen={handleEditHistoryOpen}
                        handleEditHistoryClose={handleEditHistoryClose}
                        handleRevertEdit={handleRevertEdit}
                        handleViewEditDetails={handleViewEditDetails}
                        isIndustryTrendsEditing={isIndustryTrendsEditing}
                        industryTrendsExpanded={industryTrendsExpanded}
                        industryTrendsHasEdits={industryTrendsHasEdits}
                        industryTrendsDeletedSections={industryTrendsDeletedSections}
                        industryTrendsEditHistory={industryTrendsEditHistory}
                        industryTrendsLastEditedField={industryTrendsLastEditedField}
                        showIndustryTrendsScoutChat={showIndustryTrendsScoutChat}
                        setShowIndustryTrendsScoutChat={setShowIndustryTrendsScoutChat}
                        industryTrendsCustomMessage={industryTrendsCustomMessage}
                        setIndustryTrendsCustomMessage={setIndustryTrendsCustomMessage}
                        handleIndustryTrendsToggleEdit={handleIndustryTrendsToggleEdit}
                        handleIndustryTrendsSaveChanges={handleIndustryTrendsSaveChanges}
                        handleIndustryTrendsCancelEdit={handleIndustryTrendsCancelEdit}
                        handleIndustryTrendsDeleteSection={handleIndustryTrendsDeleteSection}
                        handleIndustryTrendsEditHistoryOpen={handleIndustryTrendsEditHistoryOpen}
                        handleIndustryTrendsExpandToggle={handleIndustryTrendsExpandToggle}
                        handleIndustryTrendsExecutiveSummaryChange={
                          handleIndustryTrendsExecutiveSummaryChange
                        }
                        handleIndustryTrendsAiAdoptionChange={handleIndustryTrendsAiAdoptionChange}
                        handleIndustryTrendsCloudMigrationChange={
                          handleIndustryTrendsCloudMigrationChange
                        }
                        handleIndustryTrendsRegulatoryChange={handleIndustryTrendsRegulatoryChange}
                        handleIndustryTrendSnapshotsChange={handleIndustryTrendSnapshotsChange}
                        handleIndustryTrendsScoutClick={handleIndustryTrendsScoutClick}
                        isCompetitorEditing={isCompetitorEditing}
                        competitorExpanded={competitorExpanded}
                        competitorHasEdits={competitorHasEdits}
                        competitorDeletedSections={competitorDeletedSections}
                        competitorEditHistory={competitorEditHistory}
                        competitorError={competitorError}
                        showCompetitorScoutChat={showCompetitorScoutChat}
                        setShowCompetitorScoutChat={setShowCompetitorScoutChat}
                        competitorCustomMessage={competitorCustomMessage}
                        setCompetitorCustomMessage={setCompetitorCustomMessage}
                        handleCompetitorToggleEdit={handleCompetitorToggleEdit}
                        handleCompetitorSaveChanges={handleCompetitorSaveChanges}
                        handleCompetitorCancelEdit={handleCompetitorCancelEdit}
                        handleCompetitorDeleteSection={handleCompetitorDeleteSection}
                        handleCompetitorEditHistoryOpen={handleCompetitorEditHistoryOpen}
                        handleCompetitorExpandToggle={handleCompetitorExpandToggle}
                        handleCompetitorExecutiveSummaryChange={
                          handleCompetitorExecutiveSummaryChange
                        }
                        handleCompetitorTopPlayerShareChange={handleCompetitorTopPlayerShareChange}
                        handleCompetitorEmergingPlayersChange={
                          handleCompetitorEmergingPlayersChange
                        }
                        handleCompetitorFundingNewsChange={handleCompetitorFundingNewsChange}
                        handleCompetitorScoutClick={handleCompetitorScoutClick}
                        isRegulatoryEditing={isRegulatoryEditing}
                        regulatoryExpanded={regulatoryExpanded}
                        regulatoryHasEdits={regulatoryHasEdits}
                        regulatoryDeletedSections={regulatoryDeletedSections}
                        regulatoryEditHistory={regulatoryEditHistory}
                        isRegulatoryPostSave={isRegulatoryPostSave}
                        setIsRegulatoryPostSave={setIsRegulatoryPostSave}
                        showRegulatoryScoutChat={showRegulatoryScoutChat}
                        setShowRegulatoryScoutChat={setShowRegulatoryScoutChat}
                        regulatoryCustomMessage={regulatoryCustomMessage}
                        setRegulatoryCustomMessage={setRegulatoryCustomMessage}
                        handleRegulatoryToggleEdit={handleRegulatoryToggleEdit}
                        handleRegulatorySaveChanges={handleRegulatorySaveChanges}
                        handleRegulatoryCancelEdit={handleRegulatoryCancelEdit}
                        handleRegulatoryDeleteSection={handleRegulatoryDeleteSection}
                        handleRegulatoryEditHistoryOpen={handleRegulatoryEditHistoryOpen}
                        handleRegulatoryExpandToggle={handleRegulatoryExpandToggle}
                        handleRegulatoryExecutiveSummaryChange={
                          handleRegulatoryExecutiveSummaryChange
                        }
                        handleRegulatoryEuAiActDeadlineChange={
                          handleRegulatoryEuAiActDeadlineChange
                        }
                        handleRegulatoryGdprComplianceChange={handleRegulatoryGdprComplianceChange}
                        handleRegulatoryPotentialFinesChange={handleRegulatoryPotentialFinesChange}
                        handleRegulatoryDataLocalizationChange={
                          handleRegulatoryDataLocalizationChange
                        }
                        handleRegulatoryScoutClick={handleRegulatoryScoutClick}
                        isMarketEntryEditing={isMarketEntryEditing}
                        marketEntryExpanded={marketEntryExpanded}
                        marketEntryHasEdits={marketEntryHasEdits}
                        marketEntryDeletedSections={marketEntryDeletedSections}
                        isMarketEntryPostSave={isMarketEntryPostSave}
                        setIsMarketEntryPostSave={setIsMarketEntryPostSave}
                        showMarketEntryScoutChat={showMarketEntryScoutChat}
                        setShowMarketEntryScoutChat={setShowMarketEntryScoutChat}
                        marketEntryCustomMessage={marketEntryCustomMessage}
                        setMarketEntryCustomMessage={setMarketEntryCustomMessage}
                        handleMarketEntryToggleEdit={handleMarketEntryToggleEdit}
                        handleMarketEntrySaveChanges={handleMarketEntrySaveChanges}
                        handleMarketEntryCancelEdit={handleMarketEntryCancelEdit}
                        handleMarketEntryDeleteSection={handleMarketEntryDeleteSection}
                        handleMarketEntryEditHistoryOpen={handleMarketEntryEditHistoryOpen}
                        handleMarketEntryEditHistoryClose={handleMarketEntryEditHistoryClose}
                        handleMarketEntryExpandToggle={handleMarketEntryExpandToggle}
                        handleMarketEntryExecutiveSummaryChange={
                          handleMarketEntryExecutiveSummaryChange
                        }
                        handleMarketEntryBarriersChange={handleMarketEntryBarriersChange}
                        handleMarketEntryRecommendedChannelChange={
                          handleMarketEntryRecommendedChannelChange
                        }
                        handleMarketEntryTimeToMarketChange={handleMarketEntryTimeToMarketChange}
                        handleMarketEntryTopBarrierChange={handleMarketEntryTopBarrierChange}
                        handleMarketEntryCompetitiveDifferentiationChange={
                          handleMarketEntryCompetitiveDifferentiationChange
                        }
                        handleMarketEntryStrategicRecommendationsChange={
                          handleMarketEntryStrategicRecommendationsChange
                        }
                        handleMarketEntryRiskAssessmentChange={
                          handleMarketEntryRiskAssessmentChange
                        }
                        handleMarketEntryRevertEdit={handleMarketEntryRevertEdit}
                        handleMarketEntryViewEditDetails={handleMarketEntryViewEditDetails}
                        handleMarketEntryScoutClick={handleMarketEntryScoutClick}
                      />
                    </TabsContent>

                    <TabsContent value="analysis" className="mt-0">
                      <LeadStreamTab
                        opportunityFilter={opportunityFilter}
                        onClearOpportunityFilter={() => setOpportunityFilter(null)}
                        onChatWithScout={handleChatWithScout}
                        onChatAboutCoverage={handleChatAboutCoverage}
                        onSendToStrategist={handleSendToStrategist}
                      />
                    </TabsContent>
                  </>
                ) : (
                  /* Show loading message when refreshing and not all components are successful */

                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />

                      <p className="text-gray-600">Waiting for all components to load...</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </Tabs>
      </div>

      {/* Market Detail Drawer */}

      <MarketDetailDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        selectedMarket={selectedMarket}
        isAIViewActive={isAIViewActive}
      />

      {/* Scout Settings Form */}

      <ScoutSettingsForm isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

      {/* Loading Modal for Scout Refresh */}
      <Dialog open={isRefreshing} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md border-0 bg-transparent shadow-none p-0">
          <div className="flex flex-col items-center justify-center gap-6 p-8 bg-background rounded-lg border border-border shadow-2xl">
            {/* Animated Brewra Logo */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Brewra Logo"
                className="h-20 w-20 object-contain"
                loading="eager"
                style={{
                  animation: "logo-reveal 2.5s ease-in-out infinite",
                  clipPath: "inset(0% 0% 0% 0%)",
                }}
              />
            </div>
            {/* Loading Text */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg font-semibold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                Refreshing Scout data
              </p>
              <p className="text-sm text-muted-foreground font-medium">
                Please wait while we update your market intelligence...
              </p>
            </div>
            {/* Animated Progress Dots */}
            <div className="flex gap-2">
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
              ></div>
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
              ></div>
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
              ></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
});

export default MarketResearch;
