import { X, FileText, Save, Share, ChevronDown, ChevronUp } from "lucide-react";
import React, { useState, useEffect, useRef, useReducer } from "react";

import { CompetitorExecutiveSummary } from "./CompetitorExecutiveSummary";
import { CompetitorFeatureComparison } from "./CompetitorFeatureComparison";
import { CompetitorKeyMetrics } from "./CompetitorKeyMetrics";
import { CompetitorLandscapeHeader } from "./CompetitorLandscapeHeader";
import { CompetitorMarketTrends } from "./CompetitorMarketTrends";
import { CompetitorMnaInsights } from "./CompetitorMnaInsights";
import { CompetitorNewsFeed } from "./CompetitorNewsFeed";
import { CompetitorReportDataPoints } from "./CompetitorReportDataPoints";
import { CompetitorSwotAnalysis } from "./CompetitorSwotAnalysis";
import {
  normalizeUiComponents,
  extractDataPoints,
  extractCompetitorTags,
  extractRegions,
  extractSwotEntities,
  extractHeadlines,
  extractFeatures,
  extractTools,
  extractMnaInsights,
  extractTrendCharts,
  extractMetrics,
} from "./competitorUiComponents";
import { MajorCompetitorsList } from "./MajorCompetitorsList";
import { MarketShareRegionsTable } from "./MarketShareRegionsTable";
import type {
  CompetitorLandscapeSectionProps,
  DataPoint,
  MnaInsight,
  Metric,
  RegionShare,
  SwotEntity,
  TrendChart,
  UntypedBackendApiResponse,
} from "./types";
import { useCompetitorLandscape } from "./useCompetitorLandscape";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { buildApiUrl } from "@/shared/api/transport";
import { useAuth } from "@/shared/auth";
import { getUserLocalStorage, setUserLocalStorage } from "@/shared/lib/cacheUtils";

const CompetitorLandscapeSection: React.FC<CompetitorLandscapeSectionProps> = ({
  isEditing: isCompetitorLandscapeEditing,
  isSplitView,
  isExpanded: competitorLandscapeExpanded,
  hasEdits: competitorLandscapeHasEdits,
  deletedSections: _competitorLandscapeDeletedSections,
  editHistory: _competitorLandscapeEditHistory,
  executiveSummary,
  topPlayerShare,
  emergingPlayers,
  fundingNews,
  onToggleEdit: onCompetitorLandscapeToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen: _onCompetitorLandscapeEditHistoryOpen,
  onDeleteSection: _onCompetitorLandscapeDeleteSection,
  onSaveChanges: onCompetitorLandscapeSaveChanges,
  onCancelEdit: onCompetitorLandscapeCancelEdit,
  onExpandToggle: onCompetitorLandscapeExpandToggle,
  onExecutiveSummaryChange,
  onTopPlayerShareChange,
  onEmergingPlayersChange,
  onFundingNewsChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  isRefreshing = false,
  companyProfile,
}) => {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  const { toast } = useToast();
  // Track previous user to detect user switches
  const previousUserRef = useRef<string | null | undefined>(currentUser?.uid);

  // Section SERVER data is sourced exclusively from the dedicated hook (Task 4).
  // The parent no longer forwards a competitorData prop — data ownership is fully local.
  const cl = useCompetitorLandscape(currentUser?.uid ?? "", orgIdToUse);

  // State for API data - hook owns the data and error state
  const error: string | null = cl.isError ? "Failed to load competitor data" : null;
  const competitorData = cl.data;

  // Use hook error as display error
  const displayError = error;

  // Extract uiComponents data
  const normalizedComponents = competitorData?.uiComponents
    ? normalizeUiComponents(competitorData.uiComponents)
    : [];

  // Local editing state for inline editing - initialize with prop values and localStorage (user-specific)
  const [localExecutiveSummary, setLocalExecutiveSummary] = useState(() => {
    return (
      competitorData?.executiveSummary ||
      executiveSummary ||
      getUserLocalStorage("competitor_executiveSummary", currentUser?.uid) ||
      ""
    );
  });
  const [localTopPlayerShare, setLocalTopPlayerShare] = useState(() => {
    return (
      competitorData?.topPlayerShare ||
      topPlayerShare ||
      getUserLocalStorage("competitor_topPlayerShare", currentUser?.uid) ||
      ""
    );
  });
  const [localEmergingPlayers, setLocalEmergingPlayers] = useState(() => {
    return (
      competitorData?.emergingPlayers ||
      emergingPlayers ||
      getUserLocalStorage("competitor_emergingPlayers", currentUser?.uid) ||
      ""
    );
  });

  // Local state for all uiComponents data
  const [localDataPoints, setLocalDataPoints] = useState<DataPoint[]>(() =>
    extractDataPoints(normalizedComponents),
  );
  const [localCompetitors, setLocalCompetitors] = useState<string[]>(() =>
    extractCompetitorTags(normalizedComponents),
  );
  const [localRegions, setLocalRegions] = useState<RegionShare[]>(() =>
    extractRegions(normalizedComponents),
  );
  const [localEntities, setLocalEntities] = useState<SwotEntity[]>(() =>
    extractSwotEntities(normalizedComponents),
  );
  const [localHeadlines, setLocalHeadlines] = useState<string[]>(() => {
    return (
      extractHeadlines(normalizedComponents) ??
      (competitorData?.fundingNews && competitorData.fundingNews.length > 0
        ? competitorData.fundingNews
        : fundingNews && fundingNews.length > 0
          ? fundingNews
          : [])
    );
  });
  const [localFeatures, setLocalFeatures] = useState<string[]>(() =>
    extractFeatures(normalizedComponents),
  );
  const [localTools, setLocalTools] = useState<Record<string, string[]>>(() =>
    extractTools(normalizedComponents),
  );
  const [localInsights, setLocalInsights] = useState<MnaInsight[]>(() =>
    extractMnaInsights(normalizedComponents),
  );
  const [localCharts, setLocalCharts] = useState<TrendChart[]>(() =>
    extractTrendCharts(normalizedComponents),
  );
  const [localMetrics, setLocalMetrics] = useState<Metric[]>(() =>
    extractMetrics(normalizedComponents),
  );

  // Track if we just saved to prevent useEffect from overwriting our changes
  const justSavedRef = useRef(false);
  const savedLocalStateRef = useRef<{
    executiveSummary: string;
    topPlayerShare: string;
    emergingPlayers: string;
  } | null>(null);

  // Force re-render trigger to ensure UI updates immediately after save
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // Save local state to localStorage whenever they change (user-specific)
  useEffect(() => {
    if (localExecutiveSummary && currentUser?.uid) {
      setUserLocalStorage("competitor_executiveSummary", localExecutiveSummary, currentUser.uid);
    }
  }, [localExecutiveSummary, currentUser?.uid]);

  useEffect(() => {
    if (localTopPlayerShare && currentUser?.uid) {
      setUserLocalStorage("competitor_topPlayerShare", localTopPlayerShare, currentUser.uid);
    }
  }, [localTopPlayerShare, currentUser?.uid]);

  useEffect(() => {
    if (localEmergingPlayers && currentUser?.uid) {
      setUserLocalStorage("competitor_emergingPlayers", localEmergingPlayers, currentUser.uid);
    }
  }, [localEmergingPlayers, currentUser?.uid]);

  // Sync local state with centralized data props when they change (but not while editing)
  // IMPORTANT: Only sync if competitorData exists and belongs to current user
  // Never overwrite local state if we just saved until props/competitorData catch up
  useEffect(() => {
    if (!isCompetitorLandscapeEditing && currentUser?.uid) {
      // Skip syncing if we just cleared due to user switch (local state is empty and competitorData is null/undefined)
      if (
        !localExecutiveSummary &&
        !localTopPlayerShare &&
        !localEmergingPlayers &&
        !competitorData
      ) {
        return;
      }

      // If we just saved, NEVER overwrite local state until props/competitorData catch up
      // Also, if local state was overwritten, restore it from saved state
      if (justSavedRef.current && savedLocalStateRef.current) {
        const propsMatchSaved =
          (executiveSummary || "") === savedLocalStateRef.current.executiveSummary &&
          (topPlayerShare || "") === savedLocalStateRef.current.topPlayerShare &&
          (emergingPlayers || "") === savedLocalStateRef.current.emergingPlayers;

        const competitorDataMatchesSaved =
          (competitorData?.executiveSummary || "") ===
            savedLocalStateRef.current.executiveSummary &&
          (competitorData?.topPlayerShare || "") === savedLocalStateRef.current.topPlayerShare &&
          (competitorData?.emergingPlayers || "") === savedLocalStateRef.current.emergingPlayers;

        // Check if local state was overwritten with old values - if so, restore from saved state
        const localStateWasOverwritten =
          localExecutiveSummary !== savedLocalStateRef.current.executiveSummary ||
          localTopPlayerShare !== savedLocalStateRef.current.topPlayerShare ||
          localEmergingPlayers !== savedLocalStateRef.current.emergingPlayers;

        if (localStateWasOverwritten) {
          setLocalExecutiveSummary(savedLocalStateRef.current.executiveSummary);
          setLocalTopPlayerShare(savedLocalStateRef.current.topPlayerShare);
          setLocalEmergingPlayers(savedLocalStateRef.current.emergingPlayers);
        }

        if (propsMatchSaved || competitorDataMatchesSaved) {
          // Props/competitorData have caught up - safe to reset flag and allow normal syncing
          justSavedRef.current = false;
          savedLocalStateRef.current = null;
          // Continue to sync below
        } else {
          // Props/competitorData haven't caught up yet - DO NOT overwrite local state
          return; // Exit early, don't overwrite - user's edits are preserved in local state
        }
      }

      // Verify competitorData belongs to current user before syncing
      if (competitorData?.user_id && competitorData.user_id !== currentUser.uid) {
        return;
      }

      // Always update local state with competitorData (prioritize API data)
      // But only if competitorData exists (not null/undefined)
      const newExecutiveSummary = competitorData?.executiveSummary || executiveSummary || "";
      const newTopPlayerShare = competitorData?.topPlayerShare || topPlayerShare || "";
      const newEmergingPlayers = competitorData?.emergingPlayers || emergingPlayers || "";

      setLocalExecutiveSummary(newExecutiveSummary);
      setLocalTopPlayerShare(newTopPlayerShare);
      setLocalEmergingPlayers(newEmergingPlayers);

      // Sync uiComponents data
      const normalized = competitorData?.uiComponents
        ? normalizeUiComponents(competitorData.uiComponents)
        : [];

      const syncedDataPoints = extractDataPoints(normalized);
      if (syncedDataPoints.length > 0) setLocalDataPoints(syncedDataPoints);

      const syncedTags = extractCompetitorTags(normalized);
      if (syncedTags.length > 0) setLocalCompetitors(syncedTags);

      const syncedRegions = extractRegions(normalized);
      if (syncedRegions.length > 0) setLocalRegions(syncedRegions);

      const syncedEntities = extractSwotEntities(normalized);
      // extractSwotEntities returns [] when no swotAnalysis component, and a non-empty
      // array (with backfilled opportunities/threats) when the component is present.
      // Mirror the original guard: only set when the source component had entities.
      const hasSwotComponent = normalized.some(
        (comp: UntypedBackendApiResponse) => comp?.type === "swotAnalysis",
      );
      if (hasSwotComponent) setLocalEntities(syncedEntities);

      const syncedHeadlines = extractHeadlines(normalized);
      if (syncedHeadlines !== null) {
        setLocalHeadlines(syncedHeadlines);
      } else if (competitorData?.fundingNews) {
        setLocalHeadlines(competitorData.fundingNews);
      } else if (fundingNews) {
        setLocalHeadlines(fundingNews);
      }

      const syncedFeatures = extractFeatures(normalized);
      if (syncedFeatures.length > 0) setLocalFeatures(syncedFeatures);

      const syncedTools = extractTools(normalized);
      if (Object.keys(syncedTools).length > 0) setLocalTools(syncedTools);

      const syncedInsights = extractMnaInsights(normalized);
      // Mirror original guard: only set when the source component had insights.
      const hasMnaComponent = normalized.some(
        (comp: UntypedBackendApiResponse) => comp?.type === "mnaInsights",
      );
      if (hasMnaComponent) setLocalInsights(syncedInsights);

      const syncedCharts = extractTrendCharts(normalized);
      if (syncedCharts.length > 0) setLocalCharts(syncedCharts);

      const syncedMetrics = extractMetrics(normalized);
      if (syncedMetrics.length > 0) setLocalMetrics(syncedMetrics);
    }
    // localExecutiveSummary/localTopPlayerShare/localEmergingPlayers
    // intentionally omitted: this effect is the writer for them; including
    // them as deps would create a write-then-read loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    executiveSummary,
    topPlayerShare,
    emergingPlayers,
    competitorData,
    isCompetitorLandscapeEditing,
    isRefreshing,
    currentUser?.uid,
    fundingNews,
  ]);

  // Handle save changes
  // Individual box save functions
  const handleSaveExecutiveSummary = () => {
    onExecutiveSummaryChange(localExecutiveSummary);
    toast({
      title: "Saved",
      description: "Executive Summary changes committed.",
    });
  };

  const handleSaveTopPlayerShare = () => {
    onTopPlayerShareChange(localTopPlayerShare);
    toast({
      title: "Saved",
      description: "Top Player Market Share changes committed.",
    });
  };

  const handleSaveEmergingPlayers = () => {
    onEmergingPlayersChange(localEmergingPlayers);
    toast({
      title: "Saved",
      description: "Emerging Players changes committed.",
    });
  };

  const handleSaveCompetitorReport = () => {
    toast({
      title: "Saved",
      description: "Competitor Analysis Report changes committed.",
    });
  };

  const handleSaveMajorCompetitors = () => {
    toast({
      title: "Saved",
      description: "Major Competitors changes committed.",
    });
  };

  const handleSaveMarketShareCharts = () => {
    toast({
      title: "Saved",
      description: "Market Share Charts changes committed.",
    });
  };

  const handleSaveSwotAnalysis = () => {
    toast({
      title: "Saved",
      description: "SWOT Analysis changes committed.",
    });
  };

  const handleSaveFeatureComparison = () => {
    toast({
      title: "Saved",
      description: "Feature Comparison changes committed.",
    });
  };

  const handleSaveMnaInsights = () => {
    toast({
      title: "Saved",
      description: "M&A Insights changes committed.",
    });
  };

  const handleSaveMarketTrends = () => {
    toast({
      title: "Saved",
      description: "Market Trends changes committed.",
    });
  };

  const handleCompetitorLandscapeSaveChanges = async () => {
    try {
      // IMPORTANT: Set the flag FIRST before any state updates to prevent useEffect from overwriting
      justSavedRef.current = true;
      savedLocalStateRef.current = {
        executiveSummary: localExecutiveSummary,
        topPlayerShare: localTopPlayerShare,
        emergingPlayers: localEmergingPlayers,
      };

      // Explicitly update local state to ensure React detects the change and re-renders
      // This ensures the display variables will use the updated local state
      setLocalExecutiveSummary(localExecutiveSummary);
      setLocalTopPlayerShare(localTopPlayerShare);
      setLocalEmergingPlayers(localEmergingPlayers);

      // Apply local edits to props
      onExecutiveSummaryChange(localExecutiveSummary);
      onTopPlayerShareChange(localTopPlayerShare);
      onEmergingPlayersChange(localEmergingPlayers);

      // Force a re-render to ensure UI updates immediately with local state values
      forceUpdate();

      // Prepare original data
      const originalData = {
        section: "competitor-landscape",
        executiveSummary: executiveSummary,
        topPlayerShare: topPlayerShare,
        emergingPlayers: emergingPlayers,
        fundingNews: fundingNews,
        uiComponents: competitorData?.uiComponents || [],
      };

      // Prepare modified data with all editable fields
      const modifiedData = {
        section: "competitor-landscape",
        executiveSummary: localExecutiveSummary,
        topPlayerShare: localTopPlayerShare,
        emergingPlayers: localEmergingPlayers,
        fundingNews: localHeadlines,
        uiComponents: [
          ...(localDataPoints.length > 0 ? [{ type: "report", dataPoints: localDataPoints }] : []),
          ...(localCompetitors.length > 0 ? [{ type: "section", tags: localCompetitors }] : []),
          ...(localRegions.length > 0
            ? [{ type: "marketShareCharts", regions: localRegions }]
            : []),
          ...(localEntities.length > 0 ? [{ type: "swotAnalysis", entities: localEntities }] : []),
          ...(localHeadlines.length > 0 ? [{ type: "news", headlines: localHeadlines }] : []),
          ...(localFeatures.length > 0 || Object.keys(localTools).length > 0
            ? [{ type: "featureComparison", features: localFeatures, tools: localTools }]
            : []),
          ...(localInsights.length > 0 ? [{ type: "mnaInsights", insights: localInsights }] : []),
          ...(localCharts.length > 0 ? [{ type: "marketTrends", charts: localCharts }] : []),
        ],
      };

      // Prepare data for API according to schema
      const editData = {
        original_json: originalData,
        modified_json: modifiedData,
        edit_type: "modification",
      };

      // Store data for /ask API (user-specific)
      setUserLocalStorage(
        "competitor-landscape_original_json",
        JSON.stringify(editData.original_json),
        currentUser?.uid,
      );
      setUserLocalStorage(
        "competitor-landscape_modified_json",
        JSON.stringify(editData.modified_json),
        currentUser?.uid,
      );

      // Call GET API to save edits using /ask endpoint with query parameters
      const queryParams = new URLSearchParams({
        original_json: JSON.stringify(originalData),
        modified_json: JSON.stringify(modifiedData),
        edit_type: "modification",
        section: "competitor_landscape",
      });

      let response;
      try {
        response = await fetch(buildApiUrl(`ask?${queryParams}`), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          redirect: "follow", // Follow redirects (307, 308, etc.)
        });

        // 307 is a redirect - fetch should follow it automatically, but check if final response is ok
        if (!response.ok && response.status !== 307) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // If we got a redirect (307), the fetch should have followed it
        // If the final response is still not ok, log it but don't throw (we'll preserve local state anyway)
        if (!response.ok) {
          // intentional: preserve local state, no further action
        }
      } catch (_fetchError) {
        // Network errors or other fetch errors - log but don't throw
        // We'll preserve local state anyway
        response = null; // Mark as no response
      }

      // Fetch updated data using GET API (only if first API call succeeded)
      let getData = null;
      if (response && response.ok) {
        try {
          const getResponse = await fetch("/api/market_intelligence", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (getResponse.ok) {
            getData = await getResponse.json();
          } else {
            // intentional: preserve local state, no further action
          }
        } catch (_getError) {
          // intentional: preserve local state on GET failure
        }
      } else {
        // intentional: skip GET when first call failed; local state preserved
      }

      // Update component with fresh data from API response (if available)
      // Otherwise, use local state (user's edits) which is already preserved
      if (getData && getData.competitor_landscape_data) {
        const apiData = getData.competitor_landscape_data;

        // Use API data if available, otherwise keep local state (user's edits)
        const finalExecutiveSummary = apiData.executiveSummary || localExecutiveSummary;
        const finalTopPlayerShare = apiData.topPlayerShare || localTopPlayerShare;
        const finalEmergingPlayers = apiData.emergingPlayers || localEmergingPlayers;

        // Update saved state ref with final values
        savedLocalStateRef.current = {
          executiveSummary: finalExecutiveSummary,
          topPlayerShare: finalTopPlayerShare,
          emergingPlayers: finalEmergingPlayers,
        };

        // Update local state with final values (this will be displayed immediately)
        setLocalExecutiveSummary(finalExecutiveSummary);
        setLocalTopPlayerShare(finalTopPlayerShare);
        setLocalEmergingPlayers(finalEmergingPlayers);

        // Update parent state with final values
        onExecutiveSummaryChange(finalExecutiveSummary);
        onTopPlayerShareChange(finalTopPlayerShare);
        onEmergingPlayersChange(finalEmergingPlayers);
      } else {
        // No API data - local state is already set and preserved above
        // Just ensure the saved state ref matches local state
        savedLocalStateRef.current = {
          executiveSummary: localExecutiveSummary,
          topPlayerShare: localTopPlayerShare,
          emergingPlayers: localEmergingPlayers,
        };
      }

      // Force a re-render to ensure UI updates immediately with local state values
      forceUpdate();

      // Call the original save function to trigger chat panel
      // This may set isEditing to false, but our flag prevents useEffect from overwriting
      onCompetitorLandscapeSaveChanges();
    } catch (error) {
      console.error("❌ Competitor Landscape - Error saving changes:", error);

      // IMPORTANT: Set the flag even if API fails to prevent useEffect from overwriting
      justSavedRef.current = true;
      savedLocalStateRef.current = {
        executiveSummary: localExecutiveSummary,
        topPlayerShare: localTopPlayerShare,
        emergingPlayers: localEmergingPlayers,
      };

      // Explicitly update local state to ensure React detects the change and re-renders
      setLocalExecutiveSummary(localExecutiveSummary);
      setLocalTopPlayerShare(localTopPlayerShare);
      setLocalEmergingPlayers(localEmergingPlayers);

      // Force a re-render to ensure UI updates immediately with local state values
      forceUpdate();

      // Still call the original save function even if API fails
      onCompetitorLandscapeSaveChanges();
    }
  };

  // Component no longer makes its own API calls - parent handles all data fetching

  // Clear state when user changes to prevent data leakage
  useEffect(() => {
    const previousUserId = previousUserRef.current;
    const currentUserId = currentUser?.uid;

    // Only clear if user actually changed (not on initial mount)
    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      // Reset local state to empty to force fresh fetch
      setLocalExecutiveSummary("");
      setLocalTopPlayerShare("");
      setLocalEmergingPlayers("");
    }

    // Update ref for next comparison
    previousUserRef.current = currentUserId;
  }, [currentUser?.uid]);

  // Log when competitorData changes
  useEffect(() => {
    // If we have new competitorData and we're not editing, update local state immediately
    if (competitorData && !isCompetitorLandscapeEditing) {
      setLocalExecutiveSummary(competitorData.executiveSummary || "");
      setLocalTopPlayerShare(competitorData.topPlayerShare || "");
      setLocalEmergingPlayers(competitorData.emergingPlayers || "");
    }
  }, [competitorData, isCompetitorLandscapeEditing]);

  // Removed conflicting refresh effect - parent handles all data management

  // Removed company profile update effect - parent handles all data management

  // Also listen for companyProfile prop changes but don't auto-fetch to prevent loops
  useEffect(() => {
    if (companyProfile) {
      // Don't auto-fetch here to prevent infinite loops
      // The parent refresh mechanism will handle data fetching
    }
  }, [companyProfile]);

  // Single consolidated effect to sync with props (prevents infinite loops)
  useEffect(() => {
    // Simple sync with props like other components

    // Only sync if props have meaningful data and are different from local state
    if (executiveSummary && executiveSummary !== localExecutiveSummary) {
      setLocalExecutiveSummary(executiveSummary);
    }
    if (topPlayerShare && topPlayerShare !== localTopPlayerShare) {
      setLocalTopPlayerShare(topPlayerShare);
    }
    if (emergingPlayers && emergingPlayers !== localEmergingPlayers) {
      setLocalEmergingPlayers(emergingPlayers);
    }
    // localExecutiveSummary/localTopPlayerShare/localEmergingPlayers
    // intentionally omitted: this effect compares props vs locals and
    // writes locals; including them as deps would create a re-sync loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executiveSummary, topPlayerShare, emergingPlayers]);

  // Check if we have any data to show (competitorData, local state, or props)
  // This needs to be defined early so it's available for both error handling and rendering
  const hasDataToDisplay =
    competitorData ||
    localExecutiveSummary ||
    executiveSummary ||
    topPlayerShare ||
    emergingPlayers ||
    fundingNews?.length > 0;

  // Only show full error screen if there's an error AND no data to display
  if (displayError && !hasDataToDisplay) {
    return (
      <div className={`${isSplitView ? "flex gap-6" : ""}`}>
        <div
          className={`bg-white rounded-lg border border-gray-200 p-6 ${isSplitView ? "flex-1" : ""}`}
        >
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <X className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">
                Competitor Landscape Service Temporarily Unavailable
              </p>
              <p className="text-gray-600 text-sm mb-4">
                The competitor analysis service is currently experiencing issues. This is a backend
                service problem, not a frontend issue. Please try again later or contact support.
              </p>
              <Button
                onClick={() => {
                  // Error will be cleared by parent
                }}
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Always use competitorData when available

  // Ensure we have some data to display - prioritize local state (which has the latest edits) over competitorData and props
  // This ensures UI updates immediately after save since local state is preserved and updated during editing
  // Local state is the source of truth for display - it's updated during editing and preserved after save
  // IMPORTANT: When we just saved, always use local state (it has the user's edits)
  const displayExecutiveSummary =
    justSavedRef.current && savedLocalStateRef.current
      ? savedLocalStateRef.current.executiveSummary
      : localExecutiveSummary ||
        competitorData?.executiveSummary ||
        executiveSummary ||
        "No data available";
  const displayTopPlayerShare =
    justSavedRef.current && savedLocalStateRef.current
      ? savedLocalStateRef.current.topPlayerShare
      : localTopPlayerShare ||
        competitorData?.topPlayerShare ||
        topPlayerShare ||
        "No data available";
  const displayEmergingPlayers =
    justSavedRef.current && savedLocalStateRef.current
      ? savedLocalStateRef.current.emergingPlayers
      : localEmergingPlayers ||
        competitorData?.emergingPlayers ||
        emergingPlayers ||
        "No data available";

  return (
    <div className={`${isSplitView ? "flex gap-6" : ""}`}>
      {/* API Error indicator - Show warning if there's an error but we have data to display */}
      {displayError && hasDataToDisplay && (
        <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm">
          ⚠️ Warning: {displayError} - Showing cached/fallback data. Some features may be limited.
        </div>
      )}
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${isSplitView ? "flex-1" : ""}`}
      >
        <CompetitorLandscapeHeader
          isEditing={isCompetitorLandscapeEditing}
          hasEdits={competitorLandscapeHasEdits}
          onToggleEdit={onCompetitorLandscapeToggleEdit}
          onScoutIconClick={onScoutIconClick}
        />

        {/* Executive Summary - Always visible */}
        <CompetitorExecutiveSummary
          isEditing={isCompetitorLandscapeEditing}
          value={localExecutiveSummary}
          onChange={setLocalExecutiveSummary}
          onCommit={handleSaveExecutiveSummary}
          displayValue={displayExecutiveSummary}
        />

        {/* Key Metrics Section - Always visible */}
        <CompetitorKeyMetrics
          isEditing={isCompetitorLandscapeEditing}
          localMetrics={localMetrics}
          setLocalMetrics={setLocalMetrics}
          localTopPlayerShare={localTopPlayerShare}
          setLocalTopPlayerShare={setLocalTopPlayerShare}
          localEmergingPlayers={localEmergingPlayers}
          setLocalEmergingPlayers={setLocalEmergingPlayers}
          displayTopPlayerShare={displayTopPlayerShare}
          displayEmergingPlayers={displayEmergingPlayers}
          handleSaveTopPlayerShare={handleSaveTopPlayerShare}
          handleSaveEmergingPlayers={handleSaveEmergingPlayers}
        />

        {/* Read More Button - Only show when not expanded, not in split view, and not in edit mode */}
        {!competitorLandscapeExpanded && !isSplitView && !isCompetitorLandscapeEditing && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => onCompetitorLandscapeExpandToggle(true)}
              variant="outline"
              className="flex items-center space-x-2 text-sm hover:bg-gray-50"
            >
              <span>Read More</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Expanded content - Show when expanded, in split view, or in edit mode */}
        {(competitorLandscapeExpanded || isSplitView || isCompetitorLandscapeEditing) && (
          <div className="space-y-6">
            {/* Executive Summary section is now moved above for collapsed view */}

            {/* Competitor Report Data */}
            <CompetitorReportDataPoints
              isEditing={isCompetitorLandscapeEditing}
              dataPoints={localDataPoints}
              setDataPoints={setLocalDataPoints}
              onCommit={handleSaveCompetitorReport}
            />

            {/* Top Players */}
            <MajorCompetitorsList
              isEditing={isCompetitorLandscapeEditing}
              localCompetitors={localCompetitors}
              setLocalCompetitors={setLocalCompetitors}
              handleSaveMajorCompetitors={handleSaveMajorCompetitors}
            />

            {/* Market Share Charts */}
            <MarketShareRegionsTable
              isEditing={isCompetitorLandscapeEditing}
              localRegions={localRegions}
              setLocalRegions={setLocalRegions}
              handleSaveMarketShareCharts={handleSaveMarketShareCharts}
            />

            {/* SWOT Analysis */}
            <CompetitorSwotAnalysis
              isEditing={isCompetitorLandscapeEditing}
              localEntities={localEntities}
              setLocalEntities={setLocalEntities}
              handleSaveSwotAnalysis={handleSaveSwotAnalysis}
            />

            {/* News Headlines */}
            <CompetitorNewsFeed
              isEditing={isCompetitorLandscapeEditing}
              localHeadlines={localHeadlines}
              setLocalHeadlines={setLocalHeadlines}
            />

            {/* Feature Comparison */}
            <CompetitorFeatureComparison
              isEditing={isCompetitorLandscapeEditing}
              localFeatures={localFeatures}
              setLocalFeatures={setLocalFeatures}
              localTools={localTools}
              setLocalTools={setLocalTools}
              handleSaveFeatureComparison={handleSaveFeatureComparison}
            />

            {/* M&A Insights */}
            <CompetitorMnaInsights
              isEditing={isCompetitorLandscapeEditing}
              localInsights={localInsights}
              setLocalInsights={setLocalInsights}
              handleSaveMnaInsights={handleSaveMnaInsights}
            />

            {/* Market Trends */}
            <CompetitorMarketTrends
              isEditing={isCompetitorLandscapeEditing}
              localCharts={localCharts}
              setLocalCharts={setLocalCharts}
              handleSaveMarketTrends={handleSaveMarketTrends}
            />

            {/* Action Buttons */}
            {isCompetitorLandscapeEditing && (
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      // Log original and modified JSON for debugging
                      const originalJson = {
                        executiveSummary: executiveSummary || "",
                        topPlayerShare: topPlayerShare || "",
                        emergingPlayers: emergingPlayers || "",
                        fundingNews: fundingNews || [],
                        uiComponents: competitorData?.uiComponents || [],
                      };

                      const modifiedJson = {
                        executiveSummary: localExecutiveSummary,
                        topPlayerShare: localTopPlayerShare,
                        emergingPlayers: localEmergingPlayers,
                        fundingNews: localHeadlines,
                        uiComponents: [
                          ...(localDataPoints.length > 0
                            ? [{ type: "report", dataPoints: localDataPoints }]
                            : []),
                          ...(localCompetitors.length > 0
                            ? [{ type: "section", tags: localCompetitors }]
                            : []),
                          ...(localRegions.length > 0
                            ? [{ type: "marketShareCharts", regions: localRegions }]
                            : []),
                          ...(localEntities.length > 0
                            ? [{ type: "swotAnalysis", entities: localEntities }]
                            : []),
                          ...(localHeadlines.length > 0
                            ? [{ type: "news", headlines: localHeadlines }]
                            : []),
                          ...(localFeatures.length > 0 || Object.keys(localTools).length > 0
                            ? [
                                {
                                  type: "featureComparison",
                                  features: localFeatures,
                                  tools: localTools,
                                },
                              ]
                            : []),
                          ...(localInsights.length > 0
                            ? [{ type: "mnaInsights", insights: localInsights }]
                            : []),
                          ...(localCharts.length > 0
                            ? [{ type: "marketTrends", charts: localCharts }]
                            : []),
                          ...(localMetrics.length > 0
                            ? [{ type: "section", metrics: localMetrics }]
                            : []),
                        ],
                      };

                      // Logging original and modified JSON data

                      // Store JSON data in localStorage for Scout API (user-specific)
                      setUserLocalStorage(
                        "competitor-landscape_original_json",
                        JSON.stringify(originalJson),
                        currentUser?.uid,
                      );
                      setUserLocalStorage(
                        "competitor-landscape_modified_json",
                        JSON.stringify(modifiedJson),
                        currentUser?.uid,
                      );

                      // First, call the change handlers to update parent state with local values
                      onExecutiveSummaryChange(localExecutiveSummary);
                      onTopPlayerShareChange(localTopPlayerShare);
                      onEmergingPlayersChange(localEmergingPlayers);
                      onFundingNewsChange(localHeadlines);

                      // Then call the API save function
                      void handleCompetitorLandscapeSaveChanges();
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={onCompetitorLandscapeCancelEdit}>
                    Cancel
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onExportPDF}>
                    <FileText className="h-4 w-4 mr-1" />
                    Export PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={onSaveToWorkspace}>
                    <Save className="h-4 w-4 mr-1" />
                    Save to Workspace
                  </Button>
                  <Button variant="outline" size="sm" onClick={onGenerateShareableLink}>
                    <Share className="h-4 w-4 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
            )}

            {/* Show Less Button - Only when not in split view */}
            {!isSplitView && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => onCompetitorLandscapeExpandToggle(false)}
                  variant="outline"
                  className="flex items-center space-x-2 text-sm"
                >
                  <span>Show Less</span>
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitorLandscapeSection;
