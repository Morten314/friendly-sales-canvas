import {
  MapPin,
  Bot,
  Edit,
  Target,
  Clock,
  AlertTriangle,
  X,
  FileText,
  Save,
  Share,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import React, { useEffect, useState, useRef } from "react";

import type { EditRecord } from "@/components/market-research/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiFetchJson } from "@/lib/api";
import { executeWithRateLimit } from "@/lib/rateLimitManager";
import type {
  UntypedReportState,
  UntypedReportSection,
  UntypedBackendProfile,
} from "@/lib/types/escape-hatches";
import { useAuth } from "@/shared/auth";
import { getUserLocalStorage } from "@/utils/cacheUtils";

interface MarketEntrySectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  entryBarriers: string[];
  recommendedChannel: string;
  timeToMarket: string;
  topBarrier: string;
  competitiveDifferentiation: string[];
  strategicRecommendations: string[];
  riskAssessment: string[];
  onToggleEdit: () => void;
  onScoutIconClick: (context?: "market-entry", hasEdits?: boolean, customMessage?: string) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onEntryBarriersChange: (barriers: string[]) => void;
  onRecommendedChannelChange: (value: string) => void;
  onTimeToMarketChange: (value: string) => void;
  onTopBarrierChange: (value: string) => void;
  onCompetitiveDifferentiationChange: (differentiation: string[]) => void;
  onStrategicRecommendationsChange: (recommendations: string[]) => void;
  onRiskAssessmentChange: (risks: string[]) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  // Add refresh props
  isRefreshing?: boolean;
  companyProfile?: UntypedBackendProfile;
}

const MarketEntrySection: React.FC<MarketEntrySectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory: _editHistory,
  executiveSummary,
  entryBarriers,
  recommendedChannel,
  timeToMarket,
  topBarrier,
  competitiveDifferentiation,
  strategicRecommendations,
  riskAssessment,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onEntryBarriersChange,
  onRecommendedChannelChange,
  onTimeToMarketChange,
  onTopBarrierChange,
  onCompetitiveDifferentiationChange,
  onStrategicRecommendationsChange,
  onRiskAssessmentChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  isRefreshing = false,
}) => {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [marketEntryData, setMarketEntryData] = useState<UntypedReportState>(null);
  // Use ref to track if we have API data to prevent props from overwriting it
  const hasApiDataRef = useRef(false);
  const apiDataTimestampRef = useRef<number | null>(null);
  // Use ref to prevent multiple simultaneous fetches
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);
  // Track if we've already tried to fetch SWOT data to prevent infinite loops
  const hasTriedSwotFetchRef = useRef(false);

  // Local edit state variables
  const [editExecutiveSummary, setEditExecutiveSummary] = useState("");
  const [editEntryBarriers, setEditEntryBarriers] = useState<string[]>([]);
  const [editRecommendedChannel, setEditRecommendedChannel] = useState("");
  const [editTimeToMarket, setEditTimeToMarket] = useState("");
  const [editTopBarrier, setEditTopBarrier] = useState("");
  const [editCompetitiveDifferentiation, setEditCompetitiveDifferentiation] = useState<string[]>(
    [],
  );
  const [editStrategicRecommendations, setEditStrategicRecommendations] = useState<string[]>([]);
  const [editRiskAssessment, setEditRiskAssessment] = useState<string[]>([]);
  const [editSwotAnalysis, setEditSwotAnalysis] = useState<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  }>({
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
  });

  // Debug logging for state changes
  // Fetch Market Entry data from API
  const fetchMarketEntryData = async (refresh = false) => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current && !refresh) {
      return;
    }

    isFetchingRef.current = true;
    try {
      setIsLoading(true);
      setError(null);

      if (!currentUser?.uid) {
        console.error("User not authenticated");
        setError("User not authenticated");
        setIsLoading(false);
        return;
      }

      const payload = {
        org_id: orgIdToUse,
        user_id: currentUser.uid,
        component_name: "Market Entry & Growth Strategy", // Exact match from swagger
        refresh: refresh,
        force_refresh: refresh,
        cache_bypass: refresh,
        bypass_all_cache: refresh,
        request_timestamp: Date.now(),
        request_id: Math.random().toString(36).substr(2, 6),
        data: {},
      };

      const result = await executeWithRateLimit(
        () =>
          apiFetchJson("market-research", {
            method: "POST",
            body: payload,
          }),
        "Market Entry",
      );

      if (result.status === "success" && result.data) {
        const apiData = result.data;

        // Check if we have the expected Market Entry data structure
        if (apiData.executiveSummary || apiData.entryBarriers) {
          // Update component data with API response
          if (apiData.executiveSummary) onExecutiveSummaryChange(apiData.executiveSummary);
          if (apiData.entryBarriers) onEntryBarriersChange(apiData.entryBarriers);
          if (apiData.recommendedChannel) {
            const channelValue =
              typeof apiData.recommendedChannel === "object"
                ? apiData.recommendedChannel.channel || JSON.stringify(apiData.recommendedChannel)
                : apiData.recommendedChannel;
            onRecommendedChannelChange(channelValue);
          }
          if (apiData.timeToMarket) onTimeToMarketChange(apiData.timeToMarket);
          if (apiData.topBarrier) onTopBarrierChange(apiData.topBarrier);
          if (apiData.competitiveDifferentiation)
            onCompetitiveDifferentiationChange(apiData.competitiveDifferentiation);
          if (apiData.strategicRecommendations)
            onStrategicRecommendationsChange(apiData.strategicRecommendations);
          if (apiData.riskAssessment) onRiskAssessmentChange(apiData.riskAssessment);

          // Map swot to swotAnalysis to match frontend structure
          // Handle both swot and swotAnalysis from API, and ensure proper structure
          const swotData = apiData.swot || apiData.swotAnalysis;
          if (swotData) {
            // intentional: presence check only; validation happens below
          }

          // Validate SWOT data structure - check structure, not content length
          // Accept SWOT data as long as it has the correct structure (arrays exist, even if empty)
          let validSwotData = null;
          if (swotData && typeof swotData === "object") {
            // Check that it has the expected structure with arrays (even if empty)
            const hasValidStructure =
              Array.isArray(swotData.strengths) &&
              Array.isArray(swotData.weaknesses) &&
              Array.isArray(swotData.opportunities) &&
              Array.isArray(swotData.threats);

            if (hasValidStructure) {
              // CRITICAL: Preserve the actual array items, don't create new empty arrays
              // Use the arrays directly from swotData to preserve the actual content
              // CRITICAL: Use arrays directly - don't use || [] which could mask issues
              // If arrays exist, use them directly to preserve all items
              validSwotData = {
                strengths: swotData.strengths, // Use original array directly
                weaknesses: swotData.weaknesses,
                opportunities: swotData.opportunities,
                threats: swotData.threats,
              };
            } else {
              // Invalid SWOT structure – validSwotData stays null
            }
          } else {
            // intentional: no swotData present; validSwotData stays null
          }

          // Create mapped data with swotAnalysis - set if we have valid SWOT structure
          const mappedApiData = {
            ...apiData,
            timestamp: apiData.timestamp || Date.now(), // Ensure timestamp exists
          };

          // Set swotAnalysis if we have valid SWOT structure (even if arrays are empty)
          if (validSwotData) {
            mappedApiData.swotAnalysis = validSwotData;
          } else if (swotData) {
            // If swotData exists but structure is invalid, still try to use it (might be different format)
            mappedApiData.swotAnalysis = swotData;
          }

          // Remove the original swot key to avoid confusion (keep only swotAnalysis)
          if (mappedApiData.swot && mappedApiData.swotAnalysis) {
            delete mappedApiData.swot;
          }

          // Mark that we have API data
          hasApiDataRef.current = true;
          apiDataTimestampRef.current = mappedApiData.timestamp;

          // Merge with existing marketEntryData to preserve any props data, but prioritize API data
          setMarketEntryData((prev: UntypedReportState) => {
            const merged = {
              ...prev, // Keep existing data
              ...mappedApiData, // Overwrite with API data (which has swotAnalysis)
            };
            // Only set swotAnalysis from API if it's valid, otherwise preserve existing SWOT data
            if (mappedApiData.swotAnalysis) {
              merged.swotAnalysis = mappedApiData.swotAnalysis;
              // Reset the SWOT fetch attempt flag since we got SWOT data
              hasTriedSwotFetchRef.current = false;
              console.log("✅ MarketEntrySection: Set swotAnalysis from API:", {
                strengthsLength: merged.swotAnalysis.strengths?.length,
                strengthsContent: merged.swotAnalysis.strengths,
                weaknessesLength: merged.swotAnalysis.weaknesses?.length,
                opportunitiesLength: merged.swotAnalysis.opportunities?.length,
                threatsLength: merged.swotAnalysis.threats?.length,
              });
            } else if (!merged.swotAnalysis) {
              // Only fall back to prev SWOT data if we don't already have it
              merged.swotAnalysis = prev?.swotAnalysis || prev?.swot || null;
            }
            return merged;
          });
          hasFetchedRef.current = true;
        } else {
          // intentional: skip merge when no API data returned
        }
      }
    } catch (error) {
      console.error("❌ MarketEntrySection: Error fetching data:", error);
      setError("Failed to load market entry data");
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  // Load SWOT from localStorage if missing (runs on mount and when marketEntryData changes)
  useEffect(() => {
    // Check if we need to load SWOT from localStorage
    const hasSwot = marketEntryData?.swotAnalysis || marketEntryData?.swot;
    const needsSwot =
      !hasSwot ||
      (hasSwot &&
        typeof hasSwot === "object" &&
        !hasSwot.strengths?.length &&
        !hasSwot.weaknesses?.length &&
        !hasSwot.opportunities?.length &&
        !hasSwot.threats?.length);

    if (needsSwot) {
      try {
        const stored = getUserLocalStorage("marketEntryData", currentUser?.uid);
        if (stored) {
          const parsed = JSON.parse(stored);
          const swotFromStorage = parsed.swotAnalysis || parsed.swot;
          if (swotFromStorage && typeof swotFromStorage === "object") {
            const hasContent =
              (Array.isArray(swotFromStorage.strengths) && swotFromStorage.strengths.length > 0) ||
              (Array.isArray(swotFromStorage.weaknesses) &&
                swotFromStorage.weaknesses.length > 0) ||
              (Array.isArray(swotFromStorage.opportunities) &&
                swotFromStorage.opportunities.length > 0) ||
              (Array.isArray(swotFromStorage.threats) && swotFromStorage.threats.length > 0);

            if (hasContent) {
              // Update marketEntryData with SWOT from localStorage
              setMarketEntryData((prev: UntypedReportState) => ({
                ...prev,
                swotAnalysis: swotFromStorage,
                swot: swotFromStorage,
              }));
            }
          }
        }
      } catch (error) {
        console.error("Error loading SWOT from localStorage:", error);
      }
    }
  }, [marketEntryData, currentUser?.uid]); // Run when marketEntryData changes or user changes

  // Track if component has mounted to prevent running on refresh completion
  const hasMountedRef = useRef(false);

  // Fetch data when component mounts if no data is available
  // NOTE: This should ONLY run on initial mount, NOT when refresh completes
  useEffect(() => {
    // Mark as mounted on first run
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
    } else {
      // If already mounted, don't run auto-fetch logic
      // This prevents running when isRefreshing changes from true → false
      return;
    }

    // Prevent running if already fetched or currently fetching
    if (hasFetchedRef.current || isFetchingRef.current) {
      return;
    }

    // Don't auto-fetch if parent is currently refreshing
    if (isRefreshing) {
      return;
    }

    // Check if we have any meaningful data in our local state OR props
    const hasLocalData =
      marketEntryData &&
      (marketEntryData.executiveSummary || marketEntryData.entryBarriers?.length > 0);
    const hasLocalSwotData =
      marketEntryData && (marketEntryData.swot || marketEntryData.swotAnalysis);
    const hasPropsData =
      executiveSummary ||
      entryBarriers.length > 0 ||
      recommendedChannel ||
      timeToMarket ||
      topBarrier ||
      competitiveDifferentiation.length > 0 ||
      strategicRecommendations.length > 0 ||
      riskAssessment.length > 0;

    // Check if we're receiving fallback data from parent (the "being prepared" message)
    const isReceivingFallbackData =
      executiveSummary?.includes("being prepared") ||
      executiveSummary?.includes("Market entry analysis is being prepared");

    // Only fetch if we truly need data
    // Don't fetch for missing SWOT if we've already tried (prevents infinite loop)
    const needsSwotData = hasLocalData && !hasLocalSwotData && !hasTriedSwotFetchRef.current;
    const needsInitialData = !hasLocalData && (!hasPropsData || isReceivingFallbackData);

    if (needsInitialData || needsSwotData) {
      // Mark that we're trying to fetch SWOT if that's the reason
      if (needsSwotData) {
        hasTriedSwotFetchRef.current = true;
      }

      // Reduced delay for faster loading
      const timer = setTimeout(() => {
        // Double-check conditions haven't changed
        if (!isRefreshing && !hasFetchedRef.current && !isFetchingRef.current) {
          void fetchMarketEntryData(false);
        }
      }, 1500);

      return () => clearTimeout(timer);
    } else {
      // intentional: no-op when initial mount conditions are not met
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initial fetch guard; deps intentionally empty to prevent re-fetch loops
  }, []); // Empty dependency array - only run on mount

  // When parent runs cascade refresh, only show loading; parent will pass data via props (do NOT fetch here – avoids duplicate requests)
  useEffect(() => {
    if (isRefreshing) {
      hasApiDataRef.current = false;
      apiDataTimestampRef.current = null;
      setError(null);
      setIsLoading(true);
      // Do not call fetchMarketEntryData – parent MarketResearch cascade already calls the API for this component
    }
  }, [isRefreshing]);

  // Sync with props when they change (similar to other components)
  // Only sync when not editing to avoid overwriting user's current edits
  // IMPORTANT: Use ref to prevent overwriting API data - ref persists across renders
  useEffect(() => {
    // Skip if currently fetching to avoid conflicts
    if (isFetchingRef.current) {
      return;
    }

    if (!isEditing) {
      // If we have fresh props data
      const hasPropsData =
        executiveSummary ||
        entryBarriers.length > 0 ||
        recommendedChannel ||
        timeToMarket ||
        topBarrier ||
        competitiveDifferentiation.length > 0 ||
        strategicRecommendations.length > 0 ||
        riskAssessment.length > 0;

      // Check if we have API data using ref (more reliable than checking marketEntryData state)
      const hasApiData = hasApiDataRef.current && apiDataTimestampRef.current;

      // CRITICAL: If we have API data (from ref), NEVER overwrite it with props
      if (hasApiData) {
        return; // Exit early - don't sync props if API data exists
      }

      // Only sync from props if we don't have API data and props are different
      if (hasPropsData && !hasApiData) {
        // Check if props are actually different from current marketEntryData to avoid unnecessary updates
        const propsChanged =
          marketEntryData?.executiveSummary !== executiveSummary ||
          JSON.stringify(marketEntryData?.entryBarriers) !== JSON.stringify(entryBarriers) ||
          marketEntryData?.recommendedChannel !== recommendedChannel ||
          marketEntryData?.timeToMarket !== timeToMarket ||
          marketEntryData?.topBarrier !== topBarrier ||
          JSON.stringify(marketEntryData?.competitiveDifferentiation) !==
            JSON.stringify(competitiveDifferentiation) ||
          JSON.stringify(marketEntryData?.strategicRecommendations) !==
            JSON.stringify(strategicRecommendations) ||
          JSON.stringify(marketEntryData?.riskAssessment) !== JSON.stringify(riskAssessment);

        if (propsChanged) {
          // CRITICAL: Preserve existing swotAnalysis from marketEntryData - SWOT is NOT in props!
          let existingSwot = marketEntryData?.swotAnalysis || marketEntryData?.swot;

          // If SWOT is missing or empty, try to load from localStorage
          if (
            !existingSwot ||
            (existingSwot &&
              typeof existingSwot === "object" &&
              !existingSwot.strengths?.length &&
              !existingSwot.weaknesses?.length &&
              !existingSwot.opportunities?.length &&
              !existingSwot.threats?.length)
          ) {
            try {
              const stored = getUserLocalStorage("marketEntryData", currentUser?.uid);
              if (stored) {
                const parsed = JSON.parse(stored);
                const swotFromStorage = parsed.swotAnalysis || parsed.swot;
                if (swotFromStorage && typeof swotFromStorage === "object") {
                  const hasContent =
                    (Array.isArray(swotFromStorage.strengths) &&
                      swotFromStorage.strengths.length > 0) ||
                    (Array.isArray(swotFromStorage.weaknesses) &&
                      swotFromStorage.weaknesses.length > 0) ||
                    (Array.isArray(swotFromStorage.opportunities) &&
                      swotFromStorage.opportunities.length > 0) ||
                    (Array.isArray(swotFromStorage.threats) && swotFromStorage.threats.length > 0);

                  if (hasContent) {
                    existingSwot = swotFromStorage;
                  }
                }
              }
            } catch (error) {
              console.error("Error loading SWOT from localStorage during props sync:", error);
            }
          }

          // Only include swotAnalysis in update if it actually exists (don't set undefined)
          const updateData: Record<string, unknown> = {
            executiveSummary,
            entryBarriers,
            recommendedChannel,
            timeToMarket,
            topBarrier,
            competitiveDifferentiation,
            strategicRecommendations,
            riskAssessment,
            timestamp: marketEntryData?.timestamp || Date.now(),
          };

          // ALWAYS preserve SWOT data if it exists - even if arrays are empty, preserve the structure
          // SWOT is not passed as props, so we must preserve it from marketEntryData or localStorage
          if (existingSwot && typeof existingSwot === "object") {
            // Preserve the entire SWOT object, including all arrays (even if empty)
            updateData.swotAnalysis = existingSwot;
            updateData.swot = existingSwot; // Also set swot for backward compatibility
          } else {
            // intentional: nothing to preserve when existingSwot is missing/invalid
          }

          setMarketEntryData(updateData);
        } else {
          // intentional: skip when no update payload was produced
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prop-sync effect; intentionally watches only incoming props (not marketEntryData/currentUser) to avoid overwriting local state with stale snapshots
  }, [
    executiveSummary,
    entryBarriers,
    recommendedChannel,
    timeToMarket,
    topBarrier,
    competitiveDifferentiation,
    strategicRecommendations,
    riskAssessment,
    isEditing,
  ]);

  // Handle modify button click - initialize edit fields with current data
  const handleModify = () => {
    // Initialize all edit fields with current data
    setEditExecutiveSummary(displayData.executiveSummary || "");
    setEditEntryBarriers(displayData.entryBarriers || []);
    setEditRecommendedChannel(displayData.recommendedChannel || "");
    setEditTimeToMarket(displayData.timeToMarket || "");
    setEditTopBarrier(displayData.topBarrier || "");
    setEditCompetitiveDifferentiation(displayData.competitiveDifferentiation || []);
    setEditStrategicRecommendations(displayData.strategicRecommendations || []);
    setEditRiskAssessment(displayData.riskAssessment || []);

    // Initialize SWOT analysis - check if it exists in displayData, otherwise use defaults
    const swotData = displayData.swotAnalysis || {
      strengths: ["Strong tech platform"],
      weaknesses: ["Limited local presence"],
      opportunities: ["Growing market"],
      threats: ["Regulatory changes"],
    };
    setEditSwotAnalysis(swotData);

    onToggleEdit();
  };

  // Handle save changes with API integration
  const handleMarketEntryFullSaveChanges = async () => {
    try {
      // Prepare original data
      const originalData = {
        section: "market-entry",
        executiveSummary: displayData.executiveSummary,
        entryBarriers: displayData.entryBarriers,
        recommendedChannel: displayData.recommendedChannel,
        timeToMarket: displayData.timeToMarket,
        topBarrier: displayData.topBarrier,
        competitiveDifferentiation: displayData.competitiveDifferentiation,
        strategicRecommendations: displayData.strategicRecommendations,
        riskAssessment: displayData.riskAssessment,
        swotAnalysis: displayData.swotAnalysis || {
          strengths: ["Strong tech platform"],
          weaknesses: ["Limited local presence"],
          opportunities: ["Growing market"],
          threats: ["Regulatory changes"],
        },
      };

      // Prepare modified data using local edit state
      const modifiedData = {
        section: "market-entry",
        executiveSummary: editExecutiveSummary,
        entryBarriers: editEntryBarriers,
        recommendedChannel: editRecommendedChannel,
        timeToMarket: editTimeToMarket,
        topBarrier: editTopBarrier,
        competitiveDifferentiation: editCompetitiveDifferentiation,
        strategicRecommendations: editStrategicRecommendations,
        riskAssessment: editRiskAssessment,
        swotAnalysis: editSwotAnalysis,
      };

      console.log("📤 Market Entry - original_json:", originalData);
      console.log("📤 Market Entry - modified_json:", modifiedData);

      // Store data for /ask API
      localStorage.setItem("market-entry_original_json", JSON.stringify(originalData));
      localStorage.setItem("market-entry_modified_json", JSON.stringify(modifiedData));

      // Call GET API to save edits using /ask endpoint with query parameters
      const queryParams = new URLSearchParams({
        original_json: JSON.stringify(originalData),
        modified_json: JSON.stringify(modifiedData),
        edit_type: "modification",
        section: "market_entry",
      });

      const response = await fetch(`/api/ask?${queryParams}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("📥 GET /ask status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update parent state with local values (trust the user's edits)
      onExecutiveSummaryChange(editExecutiveSummary);
      onEntryBarriersChange(editEntryBarriers);
      onRecommendedChannelChange(editRecommendedChannel);
      onTimeToMarketChange(editTimeToMarket);
      onTopBarrierChange(editTopBarrier);
      onCompetitiveDifferentiationChange(editCompetitiveDifferentiation);
      onStrategicRecommendationsChange(editStrategicRecommendations);
      onRiskAssessmentChange(editRiskAssessment);

      // Update local display data immediately so UI reflects changes right away
      setMarketEntryData({
        executiveSummary: editExecutiveSummary,
        entryBarriers: editEntryBarriers,
        recommendedChannel: editRecommendedChannel,
        timeToMarket: editTimeToMarket,
        topBarrier: editTopBarrier,
        competitiveDifferentiation: editCompetitiveDifferentiation,
        strategicRecommendations: editStrategicRecommendations,
        riskAssessment: editRiskAssessment,
        swotAnalysis: editSwotAnalysis,
        timestamp: Date.now(),
      });

      // Call the original save function
      onSaveChanges();
    } catch (error) {
      console.error("❌ Market Entry - Error saving changes:", error);

      // Even if API fails, update parent state with local values
      onExecutiveSummaryChange(editExecutiveSummary);
      onEntryBarriersChange(editEntryBarriers);
      onRecommendedChannelChange(editRecommendedChannel);
      onTimeToMarketChange(editTimeToMarket);
      onTopBarrierChange(editTopBarrier);
      onCompetitiveDifferentiationChange(editCompetitiveDifferentiation);
      onStrategicRecommendationsChange(editStrategicRecommendations);
      onRiskAssessmentChange(editRiskAssessment);

      // Update local display data immediately so UI reflects changes even if API fails
      setMarketEntryData({
        executiveSummary: editExecutiveSummary,
        entryBarriers: editEntryBarriers,
        recommendedChannel: editRecommendedChannel,
        timeToMarket: editTimeToMarket,
        topBarrier: editTopBarrier,
        competitiveDifferentiation: editCompetitiveDifferentiation,
        strategicRecommendations: editStrategicRecommendations,
        riskAssessment: editRiskAssessment,
        swotAnalysis: editSwotAnalysis,
        timestamp: Date.now(),
      });

      // Still call the original save function even if API fails
      onSaveChanges();
    }
  };

  const SwotQuadrant = ({
    swotData,
  }: {
    swotData?: {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
    };
  }) => {
    if (swotData) {
      // intentional: presence check only; normalization happens below
    }

    // Use swotData if it exists and is an object, otherwise try editSwotAnalysis
    // Normalize the data to ensure proper structure
    let swotToUse: {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
    } | null = null;

    if (swotData && typeof swotData === "object") {
      // Normalize swotData to ensure all arrays exist
      swotToUse = {
        strengths: Array.isArray(swotData.strengths) ? swotData.strengths : [],
        weaknesses: Array.isArray(swotData.weaknesses) ? swotData.weaknesses : [],
        opportunities: Array.isArray(swotData.opportunities) ? swotData.opportunities : [],
        threats: Array.isArray(swotData.threats) ? swotData.threats : [],
      };
    } else if (editSwotAnalysis && typeof editSwotAnalysis === "object") {
      // Fallback to editSwotAnalysis if swotData is not available
      swotToUse = {
        strengths: Array.isArray(editSwotAnalysis.strengths) ? editSwotAnalysis.strengths : [],
        weaknesses: Array.isArray(editSwotAnalysis.weaknesses) ? editSwotAnalysis.weaknesses : [],
        opportunities: Array.isArray(editSwotAnalysis.opportunities)
          ? editSwotAnalysis.opportunities
          : [],
        threats: Array.isArray(editSwotAnalysis.threats) ? editSwotAnalysis.threats : [],
      };
    }

    if (swotToUse) {
      // intentional: presence check only; arrays extracted below
    }

    // Use normalized data or empty arrays
    const strengths = swotToUse?.strengths || [];
    const weaknesses = swotToUse?.weaknesses || [];
    const opportunities = swotToUse?.opportunities || [];
    const threats = swotToUse?.threats || [];

    return (
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-green-50 p-2 rounded border">
          <div className="font-semibold text-green-700">Strengths</div>
          {strengths.length > 0 ? (
            strengths.map((strength, index) => (
              <div key={index} className="text-green-600">
                • {strength}
              </div>
            ))
          ) : (
            <div className="text-gray-400 text-xs italic">No data available</div>
          )}
        </div>
        <div className="bg-blue-50 p-2 rounded border">
          <div className="font-semibold text-blue-700">Opportunities</div>
          {opportunities.length > 0 ? (
            opportunities.map((opportunity, index) => (
              <div key={index} className="text-blue-600">
                • {opportunity}
              </div>
            ))
          ) : (
            <div className="text-gray-400 text-xs italic">No data available</div>
          )}
        </div>
        <div className="bg-orange-50 p-2 rounded border">
          <div className="font-semibold text-orange-700">Weaknesses</div>
          {weaknesses.length > 0 ? (
            weaknesses.map((weakness, index) => (
              <div key={index} className="text-orange-600">
                • {weakness}
              </div>
            ))
          ) : (
            <div className="text-gray-400 text-xs italic">No data available</div>
          )}
        </div>
        <div className="bg-red-50 p-2 rounded border">
          <div className="font-semibold text-red-700">Threats</div>
          {threats.length > 0 ? (
            threats.map((threat, index) => (
              <div key={index} className="text-red-600">
                • {threat}
              </div>
            ))
          ) : (
            <div className="text-gray-400 text-xs italic">No data available</div>
          )}
        </div>
      </div>
    );
  };

  const TimelineChart = () => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
        <span className="text-xs">Q1 2025: Market Research</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
        <span className="text-xs">Q2 2025: Partnerships</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <span className="text-xs">Q3 2025: Launch</span>
      </div>
    </div>
  );

  // Check if we have any meaningful data to display (prioritize local data over props)
  // Always prioritize marketEntryData if it exists, as it contains API data
  const baseDisplayData = marketEntryData
    ? {
        ...marketEntryData,
        // Ensure we use props only if marketEntryData doesn't have that field
        executiveSummary: marketEntryData.executiveSummary || executiveSummary,
        entryBarriers:
          marketEntryData.entryBarriers?.length > 0 ? marketEntryData.entryBarriers : entryBarriers,
        recommendedChannel: marketEntryData.recommendedChannel || recommendedChannel,
        timeToMarket: marketEntryData.timeToMarket || timeToMarket,
        topBarrier: marketEntryData.topBarrier || topBarrier,
        competitiveDifferentiation:
          marketEntryData.competitiveDifferentiation?.length > 0
            ? marketEntryData.competitiveDifferentiation
            : competitiveDifferentiation,
        strategicRecommendations:
          marketEntryData.strategicRecommendations?.length > 0
            ? marketEntryData.strategicRecommendations
            : strategicRecommendations,
        riskAssessment:
          marketEntryData.riskAssessment?.length > 0
            ? marketEntryData.riskAssessment
            : riskAssessment,
        // CRITICAL: Explicitly preserve SWOT data from marketEntryData - it's NOT in props!
        // Use the spread operator to include it, but also explicitly set it to ensure it's not lost
        swotAnalysis: marketEntryData.swotAnalysis || marketEntryData.swot || undefined,
        swot: marketEntryData.swot || marketEntryData.swotAnalysis || undefined,
      }
    : {
        executiveSummary,
        entryBarriers,
        recommendedChannel,
        timeToMarket,
        topBarrier,
        competitiveDifferentiation,
        strategicRecommendations,
        riskAssessment,
        // Note: SWOT is not in props, so it won't be in baseDisplayData if marketEntryData is null
      };

  // Map swot to swotAnalysis to match frontend structure
  // Prioritize marketEntryData's swot/swotAnalysis since it comes from API
  // Always check marketEntryData first (most reliable source), then baseDisplayData
  const swotData =
    marketEntryData?.swotAnalysis ||
    marketEntryData?.swot ||
    baseDisplayData.swotAnalysis ||
    baseDisplayData.swot;

  // CRITICAL: Don't normalize - use the data directly to preserve array items!
  // Only check that it's a valid object with arrays, but use original arrays
  const finalSwotData =
    swotData &&
    typeof swotData === "object" &&
    Array.isArray(swotData.strengths) &&
    Array.isArray(swotData.weaknesses) &&
    Array.isArray(swotData.opportunities) &&
    Array.isArray(swotData.threats)
      ? swotData // Use original object directly - preserves all array items
      : null;

  const displayData = {
    ...baseDisplayData,
    // Set swotAnalysis from the most reliable source (marketEntryData > baseDisplayData)
    // Use original data directly to preserve all array items - DO NOT normalize!
    swotAnalysis: finalSwotData || undefined,
  };

  const hasData =
    displayData.executiveSummary ||
    displayData.entryBarriers?.length > 0 ||
    displayData.recommendedChannel ||
    displayData.timeToMarket ||
    displayData.topBarrier ||
    displayData.competitiveDifferentiation?.length > 0 ||
    displayData.strategicRecommendations?.length > 0 ||
    displayData.riskAssessment?.length > 0;

  // Show loading state only when actively loading and have no data, not when showing fallback data
  if (isLoading && !hasData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            Market Entry & Growth Strategy
          </h2>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading market entry data...</p>
        </div>
      </div>
    );
  }

  // Show empty state if we have no data and not loading
  if (!hasData && !isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            Market Entry & Growth Strategy
          </h2>
          <div className="flex items-center gap-3">
            {!isSplitView && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onScoutIconClick("market-entry");
                    }}
                    className="text-purple-600 hover:text-purple-700 transition-all duration-200 relative"
                  >
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <Bot className="h-5 w-5 relative z-10" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Chat with Scout</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No market entry data available</p>
          <Button
            onClick={() => {
              // onScoutIconClick('market-entry');
              toast({
                title: "Coming Soon",
                description: "Scout feature is coming soon!",
              });
            }}
            variant="outline"
            className="text-gray-400 border-gray-300 opacity-50"
          >
            <Bot className="h-4 w-4 mr-2" />
            Generate Report with Scout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-purple-600" />
          Market Entry & Growth Strategy
        </h2>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleModify}
            className="text-purple-800 hover:text-purple-900"
          >
            <Edit className="h-4 w-4" />
          </Button>
          {hasEdits && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditHistoryOpen}
              className="text-gray-600 hover:text-gray-700"
            >
              <Clock className="h-4 w-4" />
            </Button>
          )}
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onScoutIconClick("market-entry");
                  }}
                  className="text-purple-600 hover:text-purple-700 transition-all duration-200 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-5 w-5 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat with Scout</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Collapsed View */}
      {!isExpanded && !isEditing && (
        <div className="space-y-4">
          <div className="text-gray-700 leading-relaxed whitespace-pre-line">
            {displayData.executiveSummary}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <div className="text-xs font-medium text-purple-700 mb-1">Top Entry Channel</div>
              <div className="text-sm font-semibold text-purple-900">
                {typeof displayData.recommendedChannel === "object" &&
                displayData.recommendedChannel !== null
                  ? displayData.recommendedChannel.channel ||
                    JSON.stringify(displayData.recommendedChannel)
                  : displayData.recommendedChannel || "N/A"}
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-xs font-medium text-blue-700 mb-1">Time to Market</div>
              <div className="text-sm font-semibold text-blue-900">{displayData.timeToMarket}</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <div className="text-xs font-medium text-orange-700 mb-1">Top Barrier</div>
              <div className="text-sm font-semibold text-orange-900">{displayData.topBarrier}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">SWOT Analysis</h4>
              <SwotQuadrant swotData={displayData.swotAnalysis || editSwotAnalysis} />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Timeline Preview</h4>
              <TimelineChart />
            </div>
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
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && !isEditing && (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              Executive Summary
            </h3>
            <div className="text-gray-700 leading-relaxed space-y-3">
              {displayData.executiveSummary
                .split("\n")
                .map((paragraph: UntypedReportSection, index: number) => (
                  <p key={index}>{paragraph}</p>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <div className="text-xs font-medium text-purple-700 mb-1">Top Entry Channel</div>
              <div className="text-sm font-semibold text-purple-900">
                {typeof displayData.recommendedChannel === "object" &&
                displayData.recommendedChannel !== null
                  ? displayData.recommendedChannel.channel ||
                    JSON.stringify(displayData.recommendedChannel)
                  : displayData.recommendedChannel || "N/A"}
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-xs font-medium text-blue-700 mb-1">Time to Market</div>
              <div className="text-sm font-semibold text-blue-900">{displayData.timeToMarket}</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <div className="text-xs font-medium text-orange-700 mb-1">Top Barrier</div>
              <div className="text-sm font-semibold text-orange-900">{displayData.topBarrier}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">SWOT Analysis</h4>
              <SwotQuadrant swotData={displayData.swotAnalysis || editSwotAnalysis} />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Timeline Preview</h4>
              <TimelineChart />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Entry Barriers
              </h4>
              <ul className="space-y-2">
                {displayData.entryBarriers.map((barrier: UntypedReportSection, index: number) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-orange-500 mt-1">•</span>
                    {barrier}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Target className="h-4 w-4 text-green-600" />
                Competitive Differentiation
              </h4>
              <ul className="space-y-2">
                {displayData.competitiveDifferentiation.map(
                  (diff: UntypedReportSection, index: number) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      {diff}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Strategic Recommendations
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayData.strategicRecommendations.map(
                (recommendation: UntypedReportSection, index: number) => (
                  <div key={index} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="text-sm font-medium text-blue-900">{recommendation}</div>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Risk Assessment
            </h4>
            <div className="space-y-2">
              {displayData.riskAssessment.map((risk: UntypedReportSection, index: number) => (
                <div key={index} className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <div className="text-sm text-red-900">{risk}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t space-y-3 w-full flex flex-col items-start gap-3">
            <div className="flex flex-wrap gap-2 justify-start">
              <Button variant="outline" size="sm" onClick={onExportPDF}>
                <FileText className="h-4 w-4 mr-1" />
                Save as PDF
              </Button>
              <Button variant="outline" size="sm" onClick={onSaveToWorkspace}>
                <Save className="h-4 w-4 mr-1" />
                Save to Workspace
              </Button>
              <Button variant="outline" size="sm" onClick={onGenerateShareableLink}>
                <Share className="h-4 w-4 mr-1" />
                Shareable Link
              </Button>
            </div>
            <div className="flex justify-center w-full">
              <Button
                onClick={() => onExpandToggle(false)}
                variant="outline"
                className="flex items-center space-x-2 text-sm"
              >
                <span>Show Less</span>
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <div className="space-y-6">
          <div className="relative group border border-gray-200 rounded-lg p-4">
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
              <button
                onClick={() => {
                  onExecutiveSummaryChange(editExecutiveSummary);
                  toast({
                    title: "Saved",
                    description: "Executive Summary changes committed.",
                  });
                }}
                className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                title="Commit changes"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  onDeleteSection("executive-summary");
                  onScoutIconClick(
                    "market-entry",
                    true,
                    "I noticed you removed the Executive Summary. Want me to help refine or replace it?",
                  );
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            </div>
            <div className="space-y-4">
              <Label
                htmlFor="market-entry-executive-summary"
                className="text-sm font-medium text-gray-700"
              >
                Executive Summary
              </Label>
              <Textarea
                id="market-entry-executive-summary"
                value={editExecutiveSummary}
                onChange={(e) => setEditExecutiveSummary(e.target.value)}
                rows={4}
                className="w-full"
                placeholder="Enter executive summary for market entry strategy..."
              />
            </div>
          </div>

          <div className="relative group border border-gray-200 rounded-lg p-4">
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
              <button
                onClick={() => {
                  onRecommendedChannelChange(editRecommendedChannel);
                  onTimeToMarketChange(editTimeToMarket);
                  onTopBarrierChange(editTopBarrier);
                  toast({
                    title: "Saved",
                    description: "Key Metrics changes committed.",
                  });
                }}
                className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                title="Commit changes"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  onDeleteSection("key-metrics");
                  onScoutIconClick(
                    "market-entry",
                    true,
                    "I noticed you removed the Key Metrics section. Want me to help refine or replace it?",
                  );
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recommended-channel" className="text-sm font-medium text-gray-700">
                  Recommended Entry Channel
                </Label>
                <Input
                  id="recommended-channel"
                  value={editRecommendedChannel}
                  onChange={(e) => setEditRecommendedChannel(e.target.value)}
                  placeholder="e.g., Local partnerships"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-to-market" className="text-sm font-medium text-gray-700">
                  Time to Market
                </Label>
                <Input
                  id="time-to-market"
                  value={editTimeToMarket}
                  onChange={(e) => setEditTimeToMarket(e.target.value)}
                  placeholder="e.g., 12-18 months"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="top-barrier" className="text-sm font-medium text-gray-700">
                  Top Barrier
                </Label>
                <Input
                  id="top-barrier"
                  value={editTopBarrier}
                  onChange={(e) => setEditTopBarrier(e.target.value)}
                  placeholder="e.g., Data residency laws"
                />
              </div>
            </div>
          </div>

          <div className="relative group border border-gray-200 rounded-lg p-4">
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
              <button
                onClick={() => {
                  onEntryBarriersChange(editEntryBarriers);
                  toast({
                    title: "Saved",
                    description: "Entry Barriers changes committed.",
                  });
                }}
                className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                title="Commit changes"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  onDeleteSection("entry-barriers");
                  onScoutIconClick(
                    "market-entry",
                    true,
                    "I noticed you removed the Entry Barriers section. Want me to help refine or replace it?",
                  );
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            </div>
            <div className="space-y-4">
              <Label className="text-sm font-medium text-gray-700">Entry Barriers</Label>
              {editEntryBarriers.map((barrier, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={barrier}
                    onChange={(e) => {
                      const updated = [...editEntryBarriers];
                      updated[index] = e.target.value;
                      setEditEntryBarriers(updated);
                    }}
                    placeholder={`Entry barrier ${index + 1}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const updated = editEntryBarriers.filter((_, i) => i !== index);
                      setEditEntryBarriers(updated);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditEntryBarriers([...editEntryBarriers, ""])}
              >
                Add Barrier
              </Button>
            </div>
          </div>

          {/* SWOT Analysis Edit */}
          {!deletedSections.has("swot-analysis") && (
            <div className="relative group border border-gray-200 rounded-lg p-4">
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                <button
                  onClick={() => {
                    toast({
                      title: "Saved",
                      description: "SWOT Analysis changes committed.",
                    });
                  }}
                  className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                  title="Commit changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    onDeleteSection("swot-analysis");
                    onScoutIconClick(
                      "market-entry",
                      true,
                      "I noticed you removed the SWOT Analysis section. Want me to help refine or replace it?",
                    );
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700">SWOT Analysis</Label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Strengths */}
                  <div className="bg-green-50 p-3 rounded border border-green-200">
                    <Label className="text-sm font-semibold text-green-700 mb-2 block">
                      Strengths
                    </Label>
                    <div className="space-y-2">
                      {editSwotAnalysis.strengths.map((strength, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={strength}
                            onChange={(e) => {
                              const updated = [...editSwotAnalysis.strengths];
                              updated[index] = e.target.value;
                              setEditSwotAnalysis({ ...editSwotAnalysis, strengths: updated });
                            }}
                            className="flex-1 text-sm text-green-700"
                            placeholder="Strength"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = editSwotAnalysis.strengths.filter(
                                (_, i) => i !== index,
                              );
                              setEditSwotAnalysis({ ...editSwotAnalysis, strengths: updated });
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditSwotAnalysis({
                            ...editSwotAnalysis,
                            strengths: [...editSwotAnalysis.strengths, ""],
                          })
                        }
                      >
                        Add Strength
                      </Button>
                    </div>
                  </div>

                  {/* Opportunities */}
                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <Label className="text-sm font-semibold text-blue-700 mb-2 block">
                      Opportunities
                    </Label>
                    <div className="space-y-2">
                      {editSwotAnalysis.opportunities.map((opportunity, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={opportunity}
                            onChange={(e) => {
                              const updated = [...editSwotAnalysis.opportunities];
                              updated[index] = e.target.value;
                              setEditSwotAnalysis({ ...editSwotAnalysis, opportunities: updated });
                            }}
                            className="flex-1 text-sm text-blue-700"
                            placeholder="Opportunity"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = editSwotAnalysis.opportunities.filter(
                                (_, i) => i !== index,
                              );
                              setEditSwotAnalysis({ ...editSwotAnalysis, opportunities: updated });
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditSwotAnalysis({
                            ...editSwotAnalysis,
                            opportunities: [...editSwotAnalysis.opportunities, ""],
                          })
                        }
                      >
                        Add Opportunity
                      </Button>
                    </div>
                  </div>

                  {/* Weaknesses */}
                  <div className="bg-orange-50 p-3 rounded border border-orange-200">
                    <Label className="text-sm font-semibold text-orange-700 mb-2 block">
                      Weaknesses
                    </Label>
                    <div className="space-y-2">
                      {editSwotAnalysis.weaknesses.map((weakness, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={weakness}
                            onChange={(e) => {
                              const updated = [...editSwotAnalysis.weaknesses];
                              updated[index] = e.target.value;
                              setEditSwotAnalysis({ ...editSwotAnalysis, weaknesses: updated });
                            }}
                            className="flex-1 text-sm text-orange-700"
                            placeholder="Weakness"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = editSwotAnalysis.weaknesses.filter(
                                (_, i) => i !== index,
                              );
                              setEditSwotAnalysis({ ...editSwotAnalysis, weaknesses: updated });
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditSwotAnalysis({
                            ...editSwotAnalysis,
                            weaknesses: [...editSwotAnalysis.weaknesses, ""],
                          })
                        }
                      >
                        Add Weakness
                      </Button>
                    </div>
                  </div>

                  {/* Threats */}
                  <div className="bg-red-50 p-3 rounded border border-red-200">
                    <Label className="text-sm font-semibold text-red-700 mb-2 block">Threats</Label>
                    <div className="space-y-2">
                      {editSwotAnalysis.threats.map((threat, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={threat}
                            onChange={(e) => {
                              const updated = [...editSwotAnalysis.threats];
                              updated[index] = e.target.value;
                              setEditSwotAnalysis({ ...editSwotAnalysis, threats: updated });
                            }}
                            className="flex-1 text-sm text-red-700"
                            placeholder="Threat"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = editSwotAnalysis.threats.filter(
                                (_, i) => i !== index,
                              );
                              setEditSwotAnalysis({ ...editSwotAnalysis, threats: updated });
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditSwotAnalysis({
                            ...editSwotAnalysis,
                            threats: [...editSwotAnalysis.threats, ""],
                          })
                        }
                      >
                        Add Threat
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Competitive Differentiation Edit */}
          {!deletedSections.has("competitive-differentiation") && (
            <div className="relative group border border-gray-200 rounded-lg p-4">
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                <button
                  onClick={() => {
                    onCompetitiveDifferentiationChange(editCompetitiveDifferentiation);
                    toast({
                      title: "Saved",
                      description: "Competitive Differentiation changes committed.",
                    });
                  }}
                  className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                  title="Commit changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    onDeleteSection("competitive-differentiation");
                    onScoutIconClick(
                      "market-entry",
                      true,
                      "I noticed you removed the Competitive Differentiation section. Want me to help refine or replace it?",
                    );
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700">
                  Competitive Differentiation
                </Label>
                {editCompetitiveDifferentiation.map((diff, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={diff}
                      onChange={(e) => {
                        const updated = [...editCompetitiveDifferentiation];
                        updated[index] = e.target.value;
                        setEditCompetitiveDifferentiation(updated);
                      }}
                      placeholder={`Differentiation point ${index + 1}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = editCompetitiveDifferentiation.filter(
                          (_, i) => i !== index,
                        );
                        setEditCompetitiveDifferentiation(updated);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditCompetitiveDifferentiation([...editCompetitiveDifferentiation, ""])
                  }
                >
                  Add Differentiation Point
                </Button>
              </div>
            </div>
          )}

          {/* Strategic Recommendations Edit */}
          {!deletedSections.has("strategic-recommendations") && (
            <div className="relative group border border-gray-200 rounded-lg p-4">
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                <button
                  onClick={() => {
                    onStrategicRecommendationsChange(editStrategicRecommendations);
                    toast({
                      title: "Saved",
                      description: "Strategic Recommendations changes committed.",
                    });
                  }}
                  className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                  title="Commit changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    onDeleteSection("strategic-recommendations");
                    onScoutIconClick(
                      "market-entry",
                      true,
                      "I noticed you removed the Strategic Recommendations section. Want me to help refine or replace it?",
                    );
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700">
                  Strategic Recommendations
                </Label>
                {editStrategicRecommendations.map((recommendation, index) => (
                  <div key={index} className="flex gap-2">
                    <Textarea
                      value={recommendation}
                      onChange={(e) => {
                        const updated = [...editStrategicRecommendations];
                        updated[index] = e.target.value;
                        setEditStrategicRecommendations(updated);
                      }}
                      className="flex-1"
                      rows={2}
                      placeholder={`Strategic recommendation ${index + 1}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = editStrategicRecommendations.filter((_, i) => i !== index);
                        setEditStrategicRecommendations(updated);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditStrategicRecommendations([...editStrategicRecommendations, ""])
                  }
                >
                  Add Recommendation
                </Button>
              </div>
            </div>
          )}

          {/* Risk Assessment Edit */}
          {!deletedSections.has("risk-assessment") && (
            <div className="relative group border border-gray-200 rounded-lg p-4">
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                <button
                  onClick={() => {
                    onRiskAssessmentChange(editRiskAssessment);
                    toast({
                      title: "Saved",
                      description: "Risk Assessment changes committed.",
                    });
                  }}
                  className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                  title="Commit changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    onDeleteSection("risk-assessment");
                    onScoutIconClick(
                      "market-entry",
                      true,
                      "I noticed you removed the Risk Assessment section. Want me to help refine or replace it?",
                    );
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700">Risk Assessment</Label>
                {editRiskAssessment.map((risk, index) => (
                  <div key={index} className="flex gap-2">
                    <Textarea
                      value={risk}
                      onChange={(e) => {
                        const updated = [...editRiskAssessment];
                        updated[index] = e.target.value;
                        setEditRiskAssessment(updated);
                      }}
                      className="flex-1"
                      rows={2}
                      placeholder={`Risk ${index + 1}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = editRiskAssessment.filter((_, i) => i !== index);
                        setEditRiskAssessment(updated);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditRiskAssessment([...editRiskAssessment, ""])}
                >
                  Add Risk
                </Button>
              </div>
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex items-center gap-3 pt-6 border-t">
            <Button onClick={handleMarketEntryFullSaveChanges}>Save Changes</Button>
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
                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200"
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
                    onScoutIconClick("market-entry");
                  }}
                  className="text-purple-600 hover:text-purple-700 transition-all duration-200 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-4 w-4 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat with Scout</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketEntrySection;
