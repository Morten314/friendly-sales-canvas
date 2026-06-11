import { BarChart3, Bot, PieChart, X, Clock, ChevronDown, ChevronUp, Check } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

import type { EditRecord } from "../../types";
import { IntelligenceSectionHeader } from "../shared/IntelligenceSectionHeader";
import type { KeyMetricConfig } from "../shared/KeyMetricsGrid";
import { KeyMetricsGrid } from "../shared/KeyMetricsGrid";

import { ExecutiveSummary } from "./ExecutiveSummary";
import { ExportOptions } from "./ExportOptions";
import { GrowthProjections } from "./GrowthProjections";
import { MarketDrivers } from "./MarketDrivers";
import { MarketEntry } from "./MarketEntry";
import { MarketSizeBySegment } from "./MarketSizeBySegment";
import { ErrorState, LoadingState, NoDataState } from "./states";
import { StrategicRecommendations } from "./StrategicRecommendations";
import { useMarketSize } from "./useMarketSize";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { buildApiUrl } from "@/shared/api/transport";
import { useAuth } from "@/shared/auth";
import { setUserLocalStorage } from "@/shared/lib/cacheUtils";
import type { UntypedBackendProfile } from "@/shared/types/escape-hatches";

interface MarketSizeSectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  onToggleEdit: () => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
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
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  // Scout chat panel props
  showScoutChat?: boolean;
  scoutChatPanel?: React.ReactNode;
  // API integration props
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  companyProfile?: UntypedBackendProfile;
}

const MarketSizeSection: React.FC<MarketSizeSectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits: _hasEdits,
  deletedSections,
  editHistory,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onTamValueChange,
  onSamValueChange,
  onGrowthRateChange,
  onStrategicRecommendationsChange,
  onMarketEntryChange,
  onMarketDriversChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  showScoutChat,
  scoutChatPanel,
  // isLoading / error / onRefresh / isRefreshing props are no longer destructured:
  // section loading/error/refresh is driven by the useMarketSize hook now.
  // (The props remain on the interface until a later task removes them.)
}) => {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  const userId = currentUser?.uid ?? "";
  // 5b section-data hook (memory-only TanStack cache) replaces the raw fetch.
  const marketSize = useMarketSize(userId, orgIdToUse);
  // Track previous user to detect user switches
  const previousUserRef = useRef<string | null | undefined>(currentUser?.uid);
  // Track if we just cleared due to user switch (to prevent immediate sync with stale props)
  const justClearedRef = useRef<boolean>(false);

  // Derived display view: all data sourced from the useMarketSize hook. Nullish
  // arrays/records are coerced to []/{} to match the existing JSX defaults.
  const view = {
    executiveSummary: marketSize.data?.executiveSummary ?? "",
    tamValue: marketSize.data?.tamValue ?? "",
    samValue: marketSize.data?.samValue ?? "",
    GrowthRate: marketSize.data?.GrowthRate ?? "",
    strategicRecommendations: marketSize.data?.strategicRecommendations ?? [],
    marketEntry: marketSize.data?.marketEntry ?? "",
    marketDrivers: marketSize.data?.marketDrivers ?? [],
    marketSizeBySegment: marketSize.data?.marketSizeBySegment ?? {},
    growthProjections: marketSize.data?.growthProjections ?? {},
  };

  // Local editing state for inline editing - seeded from the hook view (data is
  // sourced from useMarketSize; the prop-sync effect below keeps these current).
  const [localExecutiveSummary, setLocalExecutiveSummary] = useState(view.executiveSummary || "");
  const [localTamValue, setLocalTamValue] = useState(view.tamValue || "");
  const [localSamValue, setLocalSamValue] = useState(view.samValue || "");
  const [localGrowthRate, setLocalGrowthRate] = useState(view.GrowthRate || "");
  const [localMarketEntry, setLocalMarketEntry] = useState(view.marketEntry || "");
  const [localStrategicRecommendations, setLocalStrategicRecommendations] = useState<string[]>(
    view.strategicRecommendations || [],
  );
  const [localMarketDrivers, setLocalMarketDrivers] = useState<string[]>(view.marketDrivers || []);
  const [localMarketSizeBySegment, setLocalMarketSizeBySegment] = useState<Record<string, string>>(
    view.marketSizeBySegment || {},
  );
  const [localGrowthProjections, setLocalGrowthProjections] = useState<Record<string, string>>(
    view.growthProjections || {},
  );

  // Track if we just saved to prevent useEffect from overwriting our changes
  const justSavedRef = useRef(false);
  const savedLocalStateRef = useRef<{
    executiveSummary: string;
    tamValue: string;
    samValue: string;
    GrowthRate: string;
    marketEntry: string;
    strategicRecommendations: string[];
    marketDrivers: string[];
  } | null>(null);

  // Debug logging for state changes removed

  const { toast } = useToast();

  const handleModify = () => {
    onToggleEdit();
  };

  // Reset local values when editing starts - seed from the displayed (hook) view
  useEffect(() => {
    if (isEditing) {
      setLocalExecutiveSummary(view.executiveSummary || "");
      setLocalTamValue(view.tamValue || "");
      setLocalSamValue(view.samValue || "");
      setLocalGrowthRate(view.GrowthRate || "");
      setLocalMarketEntry(view.marketEntry || "");
      setLocalStrategicRecommendations(view.strategicRecommendations || []);
      setLocalMarketDrivers(view.marketDrivers || []);
      setLocalMarketSizeBySegment(view.marketSizeBySegment || {});
      setLocalGrowthProjections(view.growthProjections || {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot effect: re-initializes local edit buffer only when entering edit mode; intentionally ignores prop/view changes
  }, [isEditing]);

  // Sync local state with props when they change (but only when not editing and not just saved)
  // IMPORTANT: Never overwrite local state if we just saved until props catch up
  useEffect(() => {
    if (!isEditing && currentUser?.uid) {
      // Skip syncing if we just cleared due to user switch (prevent syncing with stale props)
      if (justClearedRef.current) {
        return;
      }

      // If we just saved, check if the displayed view has caught up with our saved state
      if (justSavedRef.current && savedLocalStateRef.current) {
        const propsMatchSaved =
          (view.executiveSummary || "") === savedLocalStateRef.current.executiveSummary &&
          (view.tamValue || "") === savedLocalStateRef.current.tamValue &&
          (view.samValue || "") === savedLocalStateRef.current.samValue &&
          (view.GrowthRate || "") === savedLocalStateRef.current.GrowthRate &&
          (view.marketEntry || "") === savedLocalStateRef.current.marketEntry;

        if (propsMatchSaved) {
          // Props have caught up - safe to reset flag and allow normal syncing
          justSavedRef.current = false;
          savedLocalStateRef.current = null;
        } else {
          // Props haven't caught up yet - DO NOT overwrite local state
          return; // Exit early, don't overwrite
        }
      }

      // Syncing with props

      // Only sync with the displayed view when it changes (if not editing and not just saved)
      // This ensures we get fresh data from the hook, but preserves our edits
      if (view.executiveSummary && view.executiveSummary !== localExecutiveSummary) {
        setLocalExecutiveSummary(view.executiveSummary);
      }
      if (view.tamValue && view.tamValue !== localTamValue) {
        setLocalTamValue(view.tamValue);
      }
      if (view.samValue && view.samValue !== localSamValue) {
        setLocalSamValue(view.samValue);
      }
      if (view.GrowthRate && view.GrowthRate !== localGrowthRate) {
        setLocalGrowthRate(view.GrowthRate);
      }
      if (view.marketEntry && view.marketEntry !== localMarketEntry) {
        setLocalMarketEntry(view.marketEntry);
      }
      // Always sync arrays - update if the view has data, clear if empty
      if (Array.isArray(view.strategicRecommendations)) {
        const currentStr = JSON.stringify(localStrategicRecommendations);
        const newStr = JSON.stringify(view.strategicRecommendations);
        if (currentStr !== newStr) {
          setLocalStrategicRecommendations(
            view.strategicRecommendations.length > 0 ? [...view.strategicRecommendations] : [],
          );
        }
      } else if (localStrategicRecommendations.length > 0) {
        // Clear if the view is not an array but local has data
        setLocalStrategicRecommendations([]);
      }

      if (Array.isArray(view.marketDrivers)) {
        const currentStr = JSON.stringify(localMarketDrivers);
        const newStr = JSON.stringify(view.marketDrivers);
        if (currentStr !== newStr) {
          setLocalMarketDrivers(view.marketDrivers.length > 0 ? [...view.marketDrivers] : []);
        }
      } else if (localMarketDrivers.length > 0) {
        // Clear if the view is not an array but local has data
        setLocalMarketDrivers([]);
      }

      const segmentStr = JSON.stringify(view.marketSizeBySegment || {});
      if (segmentStr !== JSON.stringify(localMarketSizeBySegment)) {
        setLocalMarketSizeBySegment(view.marketSizeBySegment || {});
      }

      const projectionStr = JSON.stringify(view.growthProjections || {});
      if (projectionStr !== JSON.stringify(localGrowthProjections)) {
        setLocalGrowthProjections(view.growthProjections || {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prop-sync effect: reads local* state for comparison only; including locals would cause infinite re-sync loops
  }, [
    view.executiveSummary,
    view.tamValue,
    view.samValue,
    view.GrowthRate,
    view.marketEntry,
    view.strategicRecommendations,
    view.marketDrivers,
    view.marketSizeBySegment,
    view.growthProjections,
    isEditing,
    currentUser?.uid,
  ]);

  // REMOVED: Duplicate sync effect - the above effect handles all syncing

  // Individual box save functions
  const handleSaveExecutiveSummary = () => {
    onExecutiveSummaryChange(localExecutiveSummary);
    toast({
      title: "Saved",
      description: "Executive Summary changes committed.",
    });
  };

  const handleSaveKeyMetrics = () => {
    onTamValueChange(localTamValue);
    onSamValueChange(localSamValue);
    onGrowthRateChange(localGrowthRate);
    toast({
      title: "Saved",
      description: "Key Metrics changes committed.",
    });
  };

  // Depends on component state/setters — must stay in the render body (do not hoist to module scope).
  const keyMetricsConfig: KeyMetricConfig[] = [
    {
      id: "tamValue",
      label: "Total Addressable Market",
      value: localTamValue || view.tamValue,
      draft: localTamValue,
      onChange: setLocalTamValue,
      placeholder: "e.g., $4.2B",
      displayCaption: "Growing 15% YoY",
      cardClassName: "bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg",
      valueClassName: "text-2xl font-bold text-blue-600",
    },
    {
      id: "samValue",
      label: "Serviceable Addressable Market",
      value: localSamValue || view.samValue,
      draft: localSamValue,
      onChange: setLocalSamValue,
      placeholder: "e.g., $2.1B",
      displayCaption: "Mid-market focus",
      cardClassName: "bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg",
      valueClassName: "text-2xl font-bold text-green-600",
    },
    {
      id: "GrowthRate",
      label: "Growth Rate",
      value: localGrowthRate || view.GrowthRate,
      draft: localGrowthRate,
      onChange: setLocalGrowthRate,
      placeholder: "e.g., 25%",
      displayCaption: "Fastest growing region",
      cardClassName: "bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg",
      valueClassName: "text-2xl font-bold text-purple-600",
    },
  ];

  const handleSaveStrategicRecommendations = () => {
    onStrategicRecommendationsChange(localStrategicRecommendations);
    toast({
      title: "Saved",
      description: "Strategic Recommendations changes committed.",
    });
  };

  const handleSaveMarketEntry = () => {
    onMarketEntryChange(localMarketEntry);
    toast({
      title: "Saved",
      description: "Market Entry Strategy changes committed.",
    });
  };

  const handleSaveMarketDrivers = () => {
    onMarketDriversChange(localMarketDrivers);
    toast({
      title: "Saved",
      description: "Market Drivers changes committed.",
    });
  };

  const handleSaveMarketOpportunity = () => {
    // Note: marketSizeBySegment and growthProjections don't have individual change handlers
    // They would need to be added to props if we want to save them individually
    toast({
      title: "Saved",
      description: "Market Opportunity Breakdown changes committed.",
    });
  };

  const handleSave = async () => {
    try {
      // Prepare original and modified data (original = current hook view)
      const originalData = {
        executiveSummary: view.executiveSummary,
        tamValue: view.tamValue,
        samValue: view.samValue,
        GrowthRate: view.GrowthRate,
        marketEntry: view.marketEntry,
        strategicRecommendations: view.strategicRecommendations,
        marketDrivers: view.marketDrivers,
        marketSizeBySegment: view.marketSizeBySegment || {},
        growthProjections: view.growthProjections || {},
      };

      const modifiedData = {
        executiveSummary: localExecutiveSummary,
        tamValue: localTamValue,
        samValue: localSamValue,
        GrowthRate: localGrowthRate,
        marketEntry: localMarketEntry,
        strategicRecommendations: localStrategicRecommendations,
        marketDrivers: localMarketDrivers,
        marketSizeBySegment: localMarketSizeBySegment,
        growthProjections: localGrowthProjections,
      };

      console.log("📤 Market Size - original_json:", originalData);
      console.log("📤 Market Size - modified_json:", modifiedData);

      // Store data for /ask API (user-specific)
      setUserLocalStorage(
        "market-size_original_json",
        JSON.stringify(originalData),
        currentUser?.uid,
      );
      setUserLocalStorage(
        "market-size_modified_json",
        JSON.stringify(modifiedData),
        currentUser?.uid,
      );

      // Call GET API to save edits using /ask endpoint with query parameters
      const queryParams = new URLSearchParams({
        original_json: JSON.stringify(originalData),
        modified_json: JSON.stringify(modifiedData),
        edit_type: "modification",
        section: "market_size",
      });

      const response = await fetch(buildApiUrl(`ask?${queryParams}`), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("📥 GET /ask status:", response.status);

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
      }

      // IMPORTANT: Set the flag FIRST before any state updates to prevent useEffect from overwriting
      justSavedRef.current = true;
      savedLocalStateRef.current = {
        executiveSummary: localExecutiveSummary,
        tamValue: localTamValue,
        samValue: localSamValue,
        GrowthRate: localGrowthRate,
        marketEntry: localMarketEntry,
        strategicRecommendations: [...localStrategicRecommendations],
        marketDrivers: [...localMarketDrivers],
      };

      // Update parent state with local values (trust the user's edits)
      onExecutiveSummaryChange(localExecutiveSummary);
      onTamValueChange(localTamValue);
      onSamValueChange(localSamValue);
      onGrowthRateChange(localGrowthRate);
      onMarketEntryChange(localMarketEntry);
      onStrategicRecommendationsChange(localStrategicRecommendations);
      onMarketDriversChange(localMarketDrivers);

      console.log("✅ Market Size - Local state preserved for immediate UI refresh:", {
        exec: localExecutiveSummary.substring(0, 30),
        tam: localTamValue,
        sam: localSamValue,
        apac: localGrowthRate,
      });

      // Call the original save function to trigger chat panel
      onSaveChanges();
    } catch (error) {
      console.error("❌ Market Size - Error saving changes:", error);

      // IMPORTANT: Set the flag even if API fails to prevent useEffect from overwriting
      justSavedRef.current = true;
      savedLocalStateRef.current = {
        executiveSummary: localExecutiveSummary,
        tamValue: localTamValue,
        samValue: localSamValue,
        GrowthRate: localGrowthRate,
        marketEntry: localMarketEntry,
        strategicRecommendations: [...localStrategicRecommendations],
        marketDrivers: [...localMarketDrivers],
      };

      // Even if API fails, update parent state with local values
      onExecutiveSummaryChange(localExecutiveSummary);
      onTamValueChange(localTamValue);
      onSamValueChange(localSamValue);
      onGrowthRateChange(localGrowthRate);
      onMarketEntryChange(localMarketEntry);
      onStrategicRecommendationsChange(localStrategicRecommendations);
      onMarketDriversChange(localMarketDrivers);

      // Still call the original save function even if API fails
      onSaveChanges();
    }
  };

  // Clear state when user changes to prevent data leakage
  useEffect(() => {
    const previousUserId = previousUserRef.current;
    const currentUserId = currentUser?.uid;

    // Only clear if user actually changed (not on initial mount)
    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      // Reset local state to empty so the hook's fresh data seeds in
      setLocalExecutiveSummary("");
      setLocalTamValue("");
      setLocalSamValue("");
      setLocalGrowthRate("");
      setLocalMarketEntry("");
      setLocalStrategicRecommendations([]);
      setLocalMarketDrivers([]);
      // Mark that we just cleared to prevent immediate sync with stale props
      justClearedRef.current = true;
      // Force a small delay to ensure state is cleared before any sync happens
      const clearTimer = setTimeout(() => {
        // Reset the flag after a delay to allow new data to come in
        setTimeout(() => {
          justClearedRef.current = false;
        }, 200);
      }, 50);
      return () => clearTimeout(clearTimer);
    }

    // Update ref for next comparison - do this AFTER clearing to prevent race conditions
    const updateTimer = setTimeout(() => {
      previousUserRef.current = currentUserId;
    }, 100);

    return () => clearTimeout(updateTimer);
  }, [currentUser?.uid]);

  // Data presence is driven by the 5b hook (memory-only cache).
  const hasData = !!marketSize.data;

  // Loading state
  if (marketSize.isLoading && !hasData) {
    return <LoadingState />;
  }

  // Empty state
  if (!hasData && !marketSize.isLoading) {
    return (
      <NoDataState
        onGenerate={() => {
          // onScoutIconClick('market-size');
          toast({
            title: "Coming Soon",
            description: "Scout feature is coming soon!",
          });
        }}
      />
    );
  }

  return (
    <div className={`${showScoutChat ? "flex gap-6" : ""}`}>
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${showScoutChat ? "flex-1" : ""}`}
      >
        <IntelligenceSectionHeader
          onModify={handleModify}
          isSplitView={isSplitView}
          onScoutIconClick={onScoutIconClick}
          icon={BarChart3}
          title="Market Size & Opportunity"
          scoutContext="market-size"
          iconClassName="h-5 w-5 text-blue-600"
          editButtonClassName="text-blue-800 hover:text-blue-900"
          scoutButtonClassName="text-blue-600 hover:text-blue-700 transition-all duration-200 relative"
          scoutGradientClassName="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"
        />

        {/* Loading and Error States — driven by the 5b hook */}
        {(marketSize.isRegenerating || marketSize.isLoading) && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading market data...</span>
          </div>
        )}

        {marketSize.isError && (
          <ErrorState
            message={marketSize.error instanceof Error ? marketSize.error.message : undefined}
            onRetry={() => marketSize.regenerate()}
          />
        )}

        {!marketSize.isLoading &&
          !marketSize.isError &&
          (isEditing ? (
            <div className="space-y-8">
              {/* Executive Summary Edit */}
              <ExecutiveSummary
                editing={isEditing}
                deleted={deletedSections.has("executive-summary")}
                summary={localExecutiveSummary || view.executiveSummary}
                draft={localExecutiveSummary}
                onChange={setLocalExecutiveSummary}
                onCommit={handleSaveExecutiveSummary}
                onDelete={() => onDeleteSection("executive-summary")}
              />

              {/* Key Metrics Edit */}
              <KeyMetricsGrid
                editing={isEditing}
                deleted={deletedSections.has("key-metrics")}
                metrics={keyMetricsConfig}
                onCommit={handleSaveKeyMetrics}
                onDelete={() => onDeleteSection("key-metrics")}
              />

              {/* Strategic Recommendations Edit */}
              <StrategicRecommendations
                editing={isEditing}
                deleted={deletedSections.has("strategic-recommendations")}
                recommendations={
                  localStrategicRecommendations.length > 0
                    ? localStrategicRecommendations
                    : view.strategicRecommendations
                }
                draft={localStrategicRecommendations}
                onChange={setLocalStrategicRecommendations}
                onCommit={handleSaveStrategicRecommendations}
                onDelete={() => onDeleteSection("strategic-recommendations")}
              />

              {/* Market Entry Edit */}
              <MarketEntry
                editing={isEditing}
                deleted={deletedSections.has("market-entry")}
                value={localMarketEntry || view.marketEntry}
                draft={localMarketEntry}
                onChange={setLocalMarketEntry}
                onCommit={handleSaveMarketEntry}
                onDelete={() => onDeleteSection("market-entry")}
              />

              {/* Market Drivers Edit */}
              <MarketDrivers
                editing={isEditing}
                deleted={deletedSections.has("market-drivers")}
                drivers={
                  localMarketDrivers.length > 0 ? localMarketDrivers : view.marketDrivers || []
                }
                draft={localMarketDrivers}
                onChange={setLocalMarketDrivers}
                onCommit={handleSaveMarketDrivers}
                onDelete={() => onDeleteSection("market-drivers")}
              />

              {/* Market Opportunity Breakdown Edit */}
              {!deletedSections.has("market-opportunity-breakdown") && (
                <div className="relative group">
                  <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveMarketOpportunity}
                          className="text-gray-400 hover:text-green-600 hover:bg-green-50"
                          title="Commit changes"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Commit changes</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteSection("market-opportunity-breakdown")}
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete this section</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-purple-600" />
                      Market Opportunity Breakdown
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      {/* Market Size by Segment */}
                      <MarketSizeBySegment
                        editing={isEditing}
                        segments={
                          Object.keys(localMarketSizeBySegment).length > 0
                            ? localMarketSizeBySegment
                            : view.marketSizeBySegment
                        }
                        draft={localMarketSizeBySegment}
                        onChange={setLocalMarketSizeBySegment}
                      />

                      {/* Growth Projections */}
                      <GrowthProjections
                        editing={isEditing}
                        projections={
                          Object.keys(localGrowthProjections).length > 0
                            ? localGrowthProjections
                            : view.growthProjections
                        }
                        draft={localGrowthProjections}
                        onChange={setLocalGrowthProjections}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Save/Cancel Buttons */}
              <div className="flex items-center gap-3 pt-6 border-t">
                <Button onClick={handleSave}>Save Changes</Button>
                <Button variant="outline" onClick={onCancelEdit}>
                  Cancel
                </Button>
                <div className="flex-1"></div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onEditHistoryOpen}
                      className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${editHistory.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={editHistory.length === 0}
                    >
                      <Clock className="h-4 w-4" />
                      Edit History
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View changes made to this report</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onScoutIconClick("market-size");
                      }}
                      className="text-blue-600 hover:text-blue-700 transition-all duration-200 relative"
                    >
                      <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                      <Bot className="h-4 w-4 relative z-10" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Chat with Scout</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Export Options in Edit Mode */}
              <ExportOptions
                onExportPDF={onExportPDF}
                onSaveToWorkspace={onSaveToWorkspace}
                onGenerateShareableLink={onGenerateShareableLink}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Executive Summary - Always Visible */}
              <div>
                <ExecutiveSummary
                  editing={isEditing}
                  deleted={deletedSections.has("executive-summary")}
                  summary={localExecutiveSummary || view.executiveSummary}
                  draft={localExecutiveSummary}
                  onChange={setLocalExecutiveSummary}
                  onCommit={handleSaveExecutiveSummary}
                  onDelete={() => onDeleteSection("executive-summary")}
                />

                {/* Key Metrics Cards - Always Visible */}
                <KeyMetricsGrid
                  editing={isEditing}
                  deleted={deletedSections.has("key-metrics")}
                  metrics={keyMetricsConfig}
                  onCommit={handleSaveKeyMetrics}
                  onDelete={() => onDeleteSection("key-metrics")}
                />
              </div>

              {/* Read More Button - Only show when not expanded and not in split view */}
              {!isExpanded && !isSplitView && (
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => onExpandToggle(true)}
                    variant="outline"
                    className="flex items-center space-x-2 text-sm hover:bg-gray-50"
                  >
                    <span>Read More</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Expanded Content */}
              {(isExpanded || isSplitView) && (
                <div className="animate-fade-in space-y-8">
                  <div className="border-t pt-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8">
                      Market Size & Opportunity Report
                    </h2>

                    {/* Strategic Recommendations */}
                    <StrategicRecommendations
                      editing={isEditing}
                      deleted={deletedSections.has("strategic-recommendations")}
                      recommendations={
                        localStrategicRecommendations.length > 0
                          ? localStrategicRecommendations
                          : view.strategicRecommendations
                      }
                      draft={localStrategicRecommendations}
                      onChange={setLocalStrategicRecommendations}
                      onCommit={handleSaveStrategicRecommendations}
                      onDelete={() => onDeleteSection("strategic-recommendations")}
                    />

                    {/* Market Entry */}
                    <MarketEntry
                      editing={isEditing}
                      deleted={deletedSections.has("market-entry")}
                      value={localMarketEntry || view.marketEntry}
                      draft={localMarketEntry}
                      onChange={setLocalMarketEntry}
                      onCommit={handleSaveMarketEntry}
                      onDelete={() => onDeleteSection("market-entry")}
                    />

                    {/* Market Opportunity Breakdown */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-purple-600" />
                        Market Opportunity Breakdown
                      </h3>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <MarketSizeBySegment
                          editing={isEditing}
                          segments={
                            Object.keys(localMarketSizeBySegment).length > 0
                              ? localMarketSizeBySegment
                              : view.marketSizeBySegment
                          }
                          draft={localMarketSizeBySegment}
                          onChange={setLocalMarketSizeBySegment}
                        />
                        <GrowthProjections
                          editing={isEditing}
                          projections={
                            Object.keys(localGrowthProjections).length > 0
                              ? localGrowthProjections
                              : view.growthProjections
                          }
                          draft={localGrowthProjections}
                          onChange={setLocalGrowthProjections}
                        />
                      </div>

                      <MarketDrivers
                        editing={isEditing}
                        deleted={deletedSections.has("market-drivers")}
                        drivers={
                          localMarketDrivers.length > 0
                            ? localMarketDrivers
                            : view.marketDrivers || []
                        }
                        draft={localMarketDrivers}
                        onChange={setLocalMarketDrivers}
                        onCommit={handleSaveMarketDrivers}
                        onDelete={() => onDeleteSection("market-drivers")}
                      />
                    </div>

                    {/* Export Options */}
                    <ExportOptions
                      onExportPDF={onExportPDF}
                      onSaveToWorkspace={onSaveToWorkspace}
                      onGenerateShareableLink={onGenerateShareableLink}
                    />

                    {/* Show Less Button - Only when not in split view */}
                    {!isSplitView && (
                      <div className="flex justify-center pt-4">
                        <Button
                          onClick={() => onExpandToggle(false)}
                          variant="outline"
                          className="flex items-center space-x-2 text-sm"
                        >
                          <span>Show Less</span>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
      {showScoutChat && scoutChatPanel && (
        <div className="w-1/2 flex-shrink-0">{scoutChatPanel}</div>
      )}
    </div>
  );
};

export default MarketSizeSection;
