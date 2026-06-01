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

import { ChatWithScout } from "@/components/market-research/ChatWithScout";
import { ScoutDeploymentDetails } from "@/components/market-research/ScoutDeploymentDetails";
import ScoutLeadStream from "@/components/market-research/ScoutLeadStream";
import { ScoutSettingsForm } from "@/components/market-research/ScoutSettingsForm";
import { ScoutChatWithHistory } from "@/components/signals/ScoutChatWithHistory";
import type { SignalsChatContext } from "@/components/signals/SignalsContextChat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EditHistoryPanel from "@/features/market-research/components/EditHistoryPanel";
import { MarketDetailDrawer } from "@/features/market-research/components/MarketDetailDrawer";
import SafeMarketIntelligenceTab from "@/features/market-research/components/SafeMarketIntelligenceTab";
import { useMarketResearchData } from "@/features/market-research/hooks/useMarketResearchData";
import { Layout } from "@/features/shell";
import type { DeploymentData } from "@/features/shell";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { UntypedReportState, UntypedLead } from "@/lib/types/escape-hatches";
import { buildLeadStreamChatContext, LEAD_STREAM_CHAT_CONTEXT_KEY } from "@/utils/leadStreamChatContext";

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
  const [signalsChatContext, setSignalsChatContext] = useState<SignalsChatContext | null>(null);
  const [scoutResearchContext, setScoutResearchContext] = useState<{
    leads: { name: string; company: string; jobTitle: string }[];
    opportunity?: string;
    icp?: string;
    reportTraits?: string[];
  } | null>(null);
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
    industryTrendsData,
    competitorData,
    regulatoryData,
    marketEntryData,
    companyProfile,
    editHistory,
    editHistoryContext,
    isEditHistoryOpen,
    marketEntryEditHistory,
    isMarketEntryEditHistoryOpen,
    fetchMarketData,
    fetchMarketSizeData,
    fetchCompetitorData,
    fetchMarketEntryData,
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
    leadStreamFilters,
    setLeadStreamFilters,
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

  // When Chat with Scout tab is active, check for context from Signals page
  useEffect(() => {
    if (activeTab !== "trends") return;
    try {
      const stored = sessionStorage.getItem("signalsChatContext");
      if (stored) {
        const parsed = JSON.parse(stored) as SignalsChatContext;
        if (parsed?.agent === "scout") {
          setSignalsChatContext(parsed);
        } else {
          setSignalsChatContext(null);
        }
      } else {
        setSignalsChatContext(null);
      }
    } catch {
      setSignalsChatContext(null);
    }
  }, [activeTab]);

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
              {/* Scout Header moved to main header - commented out for future use */}

              {/* <div className="mb-6">



              <div className="flex items-center gap-2 mb-2">



                <h1 className="text-3xl font-bold text-gray-900">Scout</h1>



                <Popover>



                  <PopoverTrigger asChild>



                    <button className="text-gray-500 hover:text-gray-700 transition-colors">



                      <Info className="h-5 w-5" />



                    </button>



                  </PopoverTrigger>



                  <PopoverContent className="w-80 p-4 z-50">



                    <div className="space-y-3">



                      <h3 className="font-semibold text-gray-900">What can this agent do for you?</h3>



                      <ul className="space-y-2 text-sm text-gray-700">



                        <li className="flex items-start gap-2">



                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>



                          Market size estimation & TAM analysis



                        </li>



                        <li className="flex items-start gap-2">



                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>



                          Competitor research & positioning



                        </li>



                        <li className="flex items-start gap-2">



                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>



                          Industry trends & growth forecasts



                        </li>



                        <li className="flex items-start gap-2">



                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>



                          Regulatory & compliance landscape



                        </li>



                        <li className="flex items-start gap-2">



                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>



                          Market entry barriers analysis



                        </li>



                      </ul>



                    </div>



                  </PopoverContent>



                </Popover>



              </div>



              <p className="text-lg text-gray-600 italic">Find the best markets before your competitors do</p>



            </div> */}

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

              {/* Settings, History and Refresh buttons moved to header - commented out for future use */}

              {/* <div className="flex items-center justify-end gap-2 mb-4">



              <div data-history-button>

                <DataHistoryDialog onReportSelected={handleHistoricalReportSelected} />

              </div>



              <Button



                variant="outline"



                size="sm"



                onClick={handleRefresh}



                className="flex items-center gap-2"



                disabled={isRefreshing}



              >



                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />



                {isShowingHistoricalData 



                  ? 'Return to Current' 



                  : isRefreshing ? 'Updating...' : 'Refresh'



                }



              </Button>



              <Button



                variant="outline"



                size="sm"



                onClick={() => setIsSettingsOpen(true)}



                className="flex items-center gap-2"



              >



                <Settings className="h-4 w-4" />



                Settings



              </Button>



            </div> */}

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
            <div className="flex-1 h-full min-h-[30rem] flex flex-col overflow-hidden -mx-3 md:-mx-4 lg:-mx-6 w-[calc(100%+1.5rem)] md:w-[calc(100%+2rem)] lg:w-[calc(100%+3rem)] max-w-none">
              {scoutResearchContext ? (
                <div className="px-3 md:px-4 lg:px-6 py-4 h-full flex flex-col min-h-0 flex-1">
                  <ChatWithScout fullPage researchContext={scoutResearchContext} mode={scoutMode} />
                </div>
              ) : (
                <ScoutChatWithHistory
                  initialContext={signalsChatContext}
                  onClearContext={() => {
                    sessionStorage.removeItem("signalsChatContext");
                    setSignalsChatContext(null);
                  }}
                  editHistory={editHistory}
                  onTabChange={setActiveTab}
                />
              )}
            </div>
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
                      {marketData ? (
                        <div className="space-y-6">
                          {/* Display deployment details if Scout has been deployed */}

                          {scoutDeploymentData && (
                            <ScoutDeploymentDetails deploymentData={scoutDeploymentData} />
                          )}

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
                            executiveSummary={
                              marketData?.executiveSummary ||
                              marketIntelligenceData.executiveSummary
                            }
                            tamValue={marketData?.tamValue || marketIntelligenceData.tamValue}
                            samValue={marketData?.samValue || marketIntelligenceData.samValue}
                            GrowthRate={marketData?.GrowthRate || marketIntelligenceData.GrowthRate}
                            strategicRecommendations={
                              marketData?.strategicRecommendations ||
                              marketIntelligenceData.strategicRecommendations
                            }
                            marketEntry={
                              marketData?.marketEntry || marketIntelligenceData.marketEntry
                            }
                            marketDrivers={
                              marketData?.marketDrivers || marketIntelligenceData.marketDrivers
                            }
                            marketSizeBySegment={
                              marketData?.marketSizeBySegment ||
                              marketIntelligenceData.marketSizeBySegment
                            }
                            growthProjections={
                              marketData?.growthProjections ||
                              marketIntelligenceData.growthProjections
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
                            marketEntryCompetitiveDifferentiation={
                              marketEntryData?.competitiveDifferentiation
                            }
                            marketEntryStrategicRecommendations={
                              marketEntryData?.strategicRecommendations
                            }
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
                            onExecutiveSummaryChange={
                              handleMarketIntelligenceExecutiveSummaryChange
                            }
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
                            onIndustryTrendsExecutiveSummaryChange={
                              handleIndustryTrendsExecutiveSummaryChange
                            }
                            onIndustryTrendsAiAdoptionChange={handleIndustryTrendsAiAdoptionChange}
                            onIndustryTrendsCloudMigrationChange={
                              handleIndustryTrendsCloudMigrationChange
                            }
                            onIndustryTrendsRegulatoryChange={handleIndustryTrendsRegulatoryChange}
                            onIndustryTrendSnapshotsChange={handleIndustryTrendSnapshotsChange}
                            // Competitor Landscape handlers

                            onCompetitorToggleEdit={handleCompetitorToggleEdit}
                            onCompetitorSaveChanges={handleCompetitorSaveChanges}
                            onCompetitorCancelEdit={handleCompetitorCancelEdit}
                            onCompetitorDeleteSection={handleCompetitorDeleteSection}
                            onCompetitorEditHistoryOpen={handleCompetitorEditHistoryOpen}
                            onCompetitorExpandToggle={handleCompetitorExpandToggle}
                            onCompetitorExecutiveSummaryChange={
                              handleCompetitorExecutiveSummaryChange
                            }
                            onCompetitorTopPlayerShareChange={handleCompetitorTopPlayerShareChange}
                            onCompetitorEmergingPlayersChange={
                              handleCompetitorEmergingPlayersChange
                            }
                            onCompetitorFundingNewsChange={handleCompetitorFundingNewsChange}
                            // Regulatory Compliance handlers

                            onRegulatoryToggleEdit={handleRegulatoryToggleEdit}
                            onRegulatorySaveChanges={handleRegulatorySaveChanges}
                            onRegulatoryCancelEdit={handleRegulatoryCancelEdit}
                            onRegulatoryDeleteSection={handleRegulatoryDeleteSection}
                            onRegulatoryEditHistoryOpen={handleRegulatoryEditHistoryOpen}
                            onRegulatoryExpandToggle={handleRegulatoryExpandToggle}
                            onRegulatoryExecutiveSummaryChange={
                              handleRegulatoryExecutiveSummaryChange
                            }
                            onRegulatoryEuAiActDeadlineChange={
                              handleRegulatoryEuAiActDeadlineChange
                            }
                            onRegulatoryGdprComplianceChange={handleRegulatoryGdprComplianceChange}
                            onRegulatoryPotentialFinesChange={handleRegulatoryPotentialFinesChange}
                            onRegulatoryDataLocalizationChange={
                              handleRegulatoryDataLocalizationChange
                            }
                            onRegulatoryScoutIconClick={handleRegulatoryScoutClick}
                            // Market Entry handlers

                            onMarketEntryToggleEdit={handleMarketEntryToggleEdit}
                            onMarketEntrySaveChanges={handleMarketEntrySaveChanges}
                            onMarketEntryRefresh={() => fetchMarketEntryData(true)}
                            onMarketEntryCancelEdit={handleMarketEntryCancelEdit}
                            onMarketEntryDeleteSection={handleMarketEntryDeleteSection}
                            onMarketEntryEditHistoryOpen={handleMarketEntryEditHistoryOpen}
                            onMarketEntryExpandToggle={handleMarketEntryExpandToggle}
                            onMarketEntryExecutiveSummaryChange={
                              handleMarketEntryExecutiveSummaryChange
                            }
                            onMarketEntryBarriersChange={handleMarketEntryBarriersChange}
                            onMarketEntryRecommendedChannelChange={
                              handleMarketEntryRecommendedChannelChange
                            }
                            onMarketEntryTimeToMarketChange={handleMarketEntryTimeToMarketChange}
                            onMarketEntryTopBarrierChange={handleMarketEntryTopBarrierChange}
                            onMarketEntryCompetitiveDifferentiationChange={
                              handleMarketEntryCompetitiveDifferentiationChange
                            }
                            onMarketEntryStrategicRecommendationsChange={
                              handleMarketEntryStrategicRecommendationsChange
                            }
                            onMarketEntryRiskAssessmentChange={
                              handleMarketEntryRiskAssessmentChange
                            }
                            onMarketEntryScoutIconClick={handleMarketEntryScoutClick}
                            onExportPDF={handleMarketIntelligenceExportPDF}
                            onSaveToWorkspace={handleMarketIntelligenceSaveToWorkspace}
                            onGenerateShareableLink={handleMarketIntelligenceGenerateShareableLink}
                            onViewOpportunityLeads={handleViewOpportunityLeads}
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

                            <Button
                              onClick={() => fetchMarketData()}
                              className="flex items-center gap-2"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Load Data
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="analysis" className="mt-0">
                      <ScoutLeadStream
                        selectedIndustry={leadStreamFilters.selectedIndustry}
                        selectedSize={leadStreamFilters.selectedSize}
                        selectedRegion={leadStreamFilters.selectedRegion}
                        opportunityFilter={opportunityFilter}
                        onFiltersChange={(filters) => setLeadStreamFilters(filters)}
                        onClearOpportunityFilter={() => setOpportunityFilter(null)}
                        onChatWithScout={handleChatWithScout}
                        onChatAboutCoverage={handleChatAboutCoverage}
                        onSendToStrategist={handleSendToStrategist}
                      />
                    </TabsContent>

                    <TabsContent value="trends" className="mt-0 hidden">
                      {/* Chat tab content rendered above when activeTab === 'trends' */}
                      <div />
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
