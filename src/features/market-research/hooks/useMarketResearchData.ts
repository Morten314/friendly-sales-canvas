// market-research DATA LAYER (Spec 24 §5 / §9 delta 8). Extracted from MarketResearchPage in 5c
// as a STRUCTURAL move — raw fetch + useState + cascade/timestamp + localStorage cache, UNCHANGED.
// NOT the 5b TanStack hook (`useMarketResearch`); 5d–5h convert THIS hook's internals to those.
// Owns the data layer only — NOT routing, the scout cross-tab pair, the analysis handlers, or signalsChatContext.
import { useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect, useRef } from "react";

import type { ResearchComponentResponse } from "../contracts";
import { logApiCallResult } from "../lib/apiUtils";
import { toUTCTimestamp, isTimestampNewer, logTimestampComparison } from "../lib/timestampUtils";
import {
  RESEARCH_COMPONENTS,
  syncResearchComponentToQueryCache,
  type ResearchComponentName,
} from "../services/marketResearch";

import { useToast } from "@/components/ui/use-toast";
import { BACKEND_BASE_URL, buildApiUrl } from "@/shared/api/transport";
import { useAuth } from "@/shared/auth";
import {
  getUserLocalStorage,
  setUserLocalStorage,
  removeUserLocalStorage,
} from "@/shared/lib/cacheUtils";
import type {
  UntypedReportState,
  UntypedUiComponent,
  UntypedBackendApiResponse,
  UntypedCascadeContext,
  UntypedVisualDataCardRaw,
} from "@/shared/types/escape-hatches";

// Module augmentation: window-attached refresh-coordination + debug helpers.
// These are written in this file and read elsewhere within it; declaring them
// on Window avoids per-site `(window as any)` casts. Debug-helper return shape
// is intentionally `unknown` — callers are console users, not typed consumers.
declare global {
  interface Window {
    refreshStartTime?: number;
    getAllScoutComponentResponses?: (refresh?: boolean) => Promise<unknown>;
    getScoutResponses?: (refresh?: boolean) => Promise<unknown>;
  }
}

// Define types for the API response

interface ResearchReport {
  marketName: string;

  completedAgo: string;

  status: string;

  summary: string;

  marketScore: string;
}

interface MarketRanking {
  marketName: string;

  score: string;

  tam: string;

  competition: string;

  barriers: string;
}

interface Market {
  name: string;

  score: string;

  size: string;

  competition: string;

  barriers: string;

  details: {
    summary: string;

    subMarkets: Array<{
      name: string;

      size: string;

      growth: string;
    }>;

    keyInsights: string[];

    recommendedActions: string[];
  };
}

interface MarketSegment {
  segment_id: string;

  segment: string;

  size: string;

  growth_potential: string;

  acquisition_cost: string;

  needs_match: string;
}

interface SwotAnalysis {
  swot_id: string;

  strengths: string[];

  weaknesses: string[];

  opportunities: string[];

  threats: string[];
}

interface EmergingTrend {
  trend_id: string;

  trend: string;

  growthRate: string;

  adoption: string;

  impact: string;

  description: string;
}

interface TechnologyDriver {
  id: string;

  technology: string;

  maturity: string;

  relevance: string;

  timeToAdopt: string;
}

interface MarketIntelligenceData {
  researchReports: ResearchReport[];

  rankings: MarketRanking[];

  markets: Market[];

  market_segments: MarketSegment[];

  swot_analysis: SwotAnalysis;

  emerging_trends: EmergingTrend[];

  technology_drivers: TechnologyDriver[];

  timestamp?: string; // Add timestamp to track which data is loaded

  // Market Size & Opportunity data from API

  executiveSummary?: string;

  tamValue?: string;

  samValue?: string;

  GrowthRate?: string;

  strategicRecommendations?: string[];

  marketEntry?: string;

  marketDrivers?: string[];

  marketSizeBySegment?: Record<string, string>;

  growthProjections?: Record<string, string>;
}

// Add EditRecord interface for edit history

interface EditRecord {
  id: string;

  timestamp: string;

  user: string;

  summary: string;

  field: string;

  oldValue: string;

  newValue: string;
}

// Add new interfaces for Industry Trends

interface TrendSnapshot {
  title: string;

  metric: string;

  type: "growth" | "performance" | "adoption";
}

// Cache for market data - ENABLED with 5-minute cache to reduce API calls
// User-specific cache map to prevent data leakage between users
const userCacheMap = new Map<
  string,
  { data: MarketIntelligenceData | null; timestamp: number | null }
>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache to reduce API calls

// Helper to get user-specific cache
const getUserCache = (userId: string | null | undefined) => {
  if (!userId) return { data: null, timestamp: null };
  return userCacheMap.get(userId) || { data: null, timestamp: null };
};

// Helper to set user-specific cache
const setUserCache = (
  userId: string | null | undefined,
  data: MarketIntelligenceData | null,
  timestamp: number | null,
) => {
  if (!userId) return;
  userCacheMap.set(userId, { data, timestamp });
};

// Helper to clear user-specific cache
const clearUserCache = (userId: string | null | undefined) => {
  if (!userId) return;
  userCacheMap.delete(userId);
};

// Helper function to validate API response belongs to current user
const validateApiResponseUserId = (
  apiResponse: UntypedBackendApiResponse,
  currentUserId: string | null | undefined,
  componentName: string,
): boolean => {
  if (!currentUserId) {
    return false;
  }

  // Check various possible locations for user_id in API response
  const responseUserId =
    apiResponse?.data?.user_id ||
    apiResponse?.user_id ||
    apiResponse?.data?.report?.user_id ||
    apiResponse?.report?.user_id;

  if (responseUserId && responseUserId !== currentUserId) {
    console.error(`❌ [MULTI-TENANCY] ${componentName} API response user_id mismatch!`);
    console.error(`❌ Response user_id: ${responseUserId}, Current user: ${currentUserId}`);
    console.error(`❌ Rejecting data to prevent data leakage`);
    return false;
  }

  // If no user_id in response, log warning but allow (backend should handle this)
  if (!responseUserId) {
    // intentional: backend defends; FE allows through
  }

  return true;
};

// Function to clear cache when company profile updates (user-specific)
const clearMarketDataCache = (userId?: string | null) => {
  // Clear in-memory cache
  clearUserCache(userId);

  if (userId) {
    // Clear user-specific localStorage cache
    removeUserLocalStorage("competitorData", userId);
    removeUserLocalStorage("marketIntelligenceData", userId);
    removeUserLocalStorage("regulatoryData", userId);
    removeUserLocalStorage("industryTrendsData", userId);
    removeUserLocalStorage("marketEntryData", userId);
  } else {
    // Fallback: clear old format (for backward compatibility)
    localStorage.removeItem("competitorData");
    localStorage.removeItem("marketIntelligenceData");
    localStorage.removeItem("regulatoryData");
    localStorage.removeItem("industryTrendsData");
    localStorage.removeItem("marketEntryData");
  }
};

// Helper function to check if cached data is still valid (user-specific)
const isCacheValid = (userId: string | null | undefined): boolean => {
  const cache = getUserCache(userId);
  if (!cache.data || !cache.timestamp) return false;
  return Date.now() - cache.timestamp < CACHE_DURATION;
};

// Helper function to get cached data even if expired (for fallback display)

const getCachedData = (userId: string | null | undefined): MarketIntelligenceData | null => {
  const cache = getUserCache(userId);
  // Also check localStorage as fallback
  if (!cache.data && userId) {
    const stored = getUserLocalStorage("marketIntelligenceData", userId);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.timestamp) {
          setUserCache(userId, parsed, parsed.timestamp);
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing cached market data:", e);
      }
    }
  }
  return cache.data;
};

// The shell owns routing; it threads the activeTab ref in so the data layer's `scoutRefresh`
// listener can read the live tab without owning routing state (Spec 24 §9 delta 8).
export function useMarketResearchData(activeTabRef: React.MutableRefObject<string>) {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  const previousUserIdRef = useRef<string | null | undefined>(currentUser?.uid);
  const queryClient = useQueryClient();

  /** Push a validated legacy-fetch envelope into the TanStack cache the 5b section hooks read. */
  const pushResearchResponseToSectionCache = (
    response: unknown,
    componentName: ResearchComponentName,
  ) => {
    if (
      response &&
      typeof response === "object" &&
      (response as ResearchComponentResponse).status === "success" &&
      (response as ResearchComponentResponse).data
    ) {
      syncResearchComponentToQueryCache(
        queryClient,
        orgIdToUse,
        componentName,
        response as ResearchComponentResponse,
      );
    }
  };

  const { toast } = useToast();

  const [, setIsChatOpen] = useState(false);

  const [isAIViewActive, setIsAIViewActive] = useState(false);

  // Track whether we're showing current or historical data

  const [isShowingHistoricalData, setIsShowingHistoricalData] = useState(false);

  const [historicalDataTimestamp, setHistoricalDataTimestamp] = useState<string | null>(null);

  // API data state - Always initialize with any available cached data

  const [marketData, setMarketData] = useState<MarketIntelligenceData | null>(() => {
    const cached = getCachedData(currentUser?.uid);
    return cached;
  });

  // Clear cache when user changes
  useEffect(() => {
    if (currentUser?.uid) {
      // Clear cache for previous user if any
      // This ensures fresh data when switching users
      const cache = getUserCache(currentUser.uid);
      if (!cache.data) {
        // Load from localStorage if available
        const stored = getUserLocalStorage("marketIntelligenceData", currentUser.uid);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed) {
              setUserCache(currentUser.uid, parsed, parsed.timestamp || Date.now());
              setMarketData(parsed);
            }
          } catch (e) {
            console.error("Error loading user cache:", e);
          }
        }
      }
    } else {
      // User logged out, clear state
      setMarketData(null);
    }
  }, [currentUser?.uid]);

  // Clear all component data when user changes to prevent data leakage
  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const currentUserId = currentUser?.uid;

    // Only clear if user actually changed (not on initial mount)
    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      setMarketData(null);
      setMarketIntelligenceData({
        executiveSummary: "",
        tamValue: "",
        samValue: "",
        GrowthRate: "",
        strategicRecommendations: [],
        marketEntry: "",
        marketDrivers: [],
        marketSizeBySegment: {},
        growthProjections: {},
        timestamp: null,
        user_id: currentUserId, // Include user_id even when clearing
      });
      setIndustryTrendsData(null);
      setRegulatoryData(getDefaultRegulatoryData());
      setCompetitorData(null);
      setMarketEntryData(null);
    }

    // Update ref for next comparison
    previousUserIdRef.current = currentUserId;

    // If user logged out, clear all data
    if (!currentUserId && previousUserId) {
      setMarketData(null);
      setMarketIntelligenceData({
        executiveSummary: "",
        tamValue: "",
        samValue: "",
        GrowthRate: "",
        strategicRecommendations: [],
        marketEntry: "",
        marketDrivers: [],
        marketSizeBySegment: {},
        growthProjections: {},
        timestamp: null,
        user_id: currentUserId, // Include user_id even when clearing
      });
      setIndustryTrendsData(null);
      setRegulatoryData(getDefaultRegulatoryData());
      setCompetitorData(null);
      setMarketEntryData(null);
    }
  }, [currentUser?.uid]);

  // Preload logo image to prevent delay when loading modal appears
  useEffect(() => {
    const preloadLogo = () => {
      const img = new Image();
      img.src = "/logo.png";
    };
    preloadLogo();
  }, []);

  // Reload marketIntelligenceData from localStorage when user changes
  // This runs AFTER the clear effect to ensure we load the correct user's data
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Small delay to ensure clear effect has finished
    const timer = setTimeout(() => {
      const stored = getUserLocalStorage("marketIntelligenceData", currentUser.uid);

      if (stored) {
        try {
          const parsedData = JSON.parse(stored);
          if (parsedData && parsedData.timestamp) {
            // Verify this data belongs to the current user
            if (parsedData.user_id && parsedData.user_id !== currentUser.uid) {
              console.error(
                "❌ Data user_id mismatch! Stored:",
                parsedData.user_id,
                "Current:",
                currentUser.uid,
              );
              return;
            }

            setMarketIntelligenceData(parsedData);
            // Also update marketData for consistency
            setMarketData(parsedData);
            // Clear loading state since we have data
            setIsMarketSizeLoading(false);
            setIsInitialLoading(false);
          } else {
            // Trigger fetch if no valid data
            setIsMarketSizeLoading(true);
            fetchMarketSizeData(false, true).catch((err) => {
              console.error("Error fetching market size data:", err);
              setIsMarketSizeLoading(false);
            });
          }
        } catch (error) {
          console.error("❌ [USER SWITCH] Error loading marketIntelligenceData:", error);
          // Trigger fetch on error
          setIsMarketSizeLoading(true);
          fetchMarketSizeData(false, true).catch((err) => {
            console.error("Error fetching market size data:", err);
            setIsMarketSizeLoading(false);
          });
        }
      } else {
        // Trigger fetch if no stored data
        setIsMarketSizeLoading(true);
        fetchMarketSizeData(false, true).catch((err) => {
          console.error("Error fetching market size data:", err);
          setIsMarketSizeLoading(false);
        });
      }
    }, 150); // Slightly longer delay to ensure clear completes

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchMarketSizeData is a stable helper; intentionally watches only user identity edge to avoid re-fetch loops
  }, [currentUser?.uid]);

  // Show loading when either initially loading OR refreshing

  const [isInitialLoading, setIsInitialLoading] = useState(() => {
    // Note: This is called during initialization, before currentUser is available
    // We'll check cache in useEffect when currentUser is available
    const hasData = false;

    return !hasData; // Only loading if no cached data exists
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Smart refresh state tracking

  const [componentStatus, setComponentStatus] = useState<
    Record<string, "pending" | "success" | "failed">
  >({
    "Market Size": "pending",

    "Industry Trends": "pending",

    "Market Entry": "pending",

    "Competitor Landscape": "pending",

    "Regulatory Compliance": "pending",
  });

  // Fresh data flags to ensure strict replacement

  const [, setFreshDataFlags] = useState<Record<string, boolean>>({
    "Market Size": false,

    "Industry Trends": false,

    "Market Entry": false,

    "Competitor Landscape": false,

    "Regulatory Compliance": false,
  });

  // Enhanced loading phases tracking

  const [, setLoadingPhase] = useState<"api" | "rendering" | "complete">("api");

  const [componentRenderingStatus, setComponentRenderingStatus] = useState<
    Record<string, "pending" | "rendering" | "complete">
  >({
    "Market Size": "pending",

    "Industry Trends": "pending",

    "Market Entry": "pending",

    "Competitor Landscape": "pending",

    "Regulatory Compliance": "pending",
  });

  const [, setRefreshAttempt] = useState(0);

  const [validationAttempts, setValidationAttempts] = useState(0);

  const [consecutiveValidations, setConsecutiveValidations] = useState(0);

  // Track component failure counts to prevent infinite retry loops
  const [, setComponentFailureCounts] = useState<Record<string, number>>({});

  // Track validation timeout IDs to clear them when validation completes
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flag to prevent multiple simultaneous validations
  const isValidatingRef = useRef<boolean>(false);

  // Track if retries are in progress to prevent premature loading screen dismissal
  const isRetryingRef = useRef<boolean>(false);

  const [globalTimeoutId, setGlobalTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Cleanup global timeout on unmount

  useEffect(() => {
    return () => {
      if (globalTimeoutId) {
        clearTimeout(globalTimeoutId);
      }
    };
  }, [globalTimeoutId]);

  // Clear any previously scheduled global loading cap (we no longer arm a wall-clock timeout
  // on Scout refresh — the sequential cascade may take many minutes).

  const clearGlobalLoadingTimeout = () => {
    if (globalTimeoutId) {
      clearTimeout(globalTimeoutId);

      setGlobalTimeoutId(null);
    }
  };

  // Function to start the rendering phase monitoring

  const startRenderingPhase = () => {
    // Monitor rendering completion with a more sophisticated approach

    const checkRenderingCompletion = (attempt: number = 1) => {
      const maxAttempts = 200; // 10 minutes total (200 * 3 seconds) for safety

      // Check if components are visually rendered by looking for specific UI elements

      const renderingChecks = {
        "Market Size":
          marketData?.executiveSummary && marketData?.tamValue && marketData?.GrowthRate,

        "Industry Trends": industryTrendsData?.executiveSummary && industryTrendsData?.aiAdoption,

        "Market Entry": marketEntryData?.executiveSummary && marketEntryData?.entryBarriers,

        "Competitor Landscape":
          competitorData?.executiveSummary &&
          competitorData?.executiveSummary.trim() !== "" &&
          competitorData?.topPlayerShare &&
          competitorData?.topPlayerShare.trim() !== "",

        "Regulatory Compliance":
          regulatoryData?.executiveSummary &&
          regulatoryData?.executiveSummary.trim() !== "" &&
          regulatoryData?.euAiActDeadline &&
          regulatoryData?.euAiActDeadline.trim() !== "",
      };

      const allRendered = Object.values(renderingChecks).every((rendered) => rendered);

      if (allRendered) {
        setLoadingPhase("complete");

        setComponentRenderingStatus({
          "Market Size": "complete",

          "Industry Trends": "complete",

          "Market Entry": "complete",

          "Competitor Landscape": "complete",

          "Regulatory Compliance": "complete",
        });

        // Wait a moment for smooth transition, then hide loading screen
        // Clear retry flag since rendering is complete
        isRetryingRef.current = false;

        setTimeout(() => {
          setIsRefreshing(false);

          toast({
            title: "Scout Ready! 🎉",

            description: "All components loaded and rendered with fresh data",

            duration: 3000,
          });
        }, 1000);
      } else if (attempt >= maxAttempts) {
        // Clear retry flag since we're completing
        isRetryingRef.current = false;

        setLoadingPhase("complete");

        setIsRefreshing(false);

        toast({
          title: "Scout Ready",

          description: "Components loaded (some may still be rendering)",

          duration: 3000,
        });
      } else {
        // Update rendering status for partially rendered components

        const updatedRenderingStatus = { ...componentRenderingStatus };

        Object.entries(renderingChecks).forEach(([name, rendered]) => {
          if (rendered && updatedRenderingStatus[name] === "rendering") {
            updatedRenderingStatus[name] = "complete";
          }
        });

        setComponentRenderingStatus(updatedRenderingStatus);

        // Continue monitoring with much shorter interval for faster completion

        setTimeout(() => checkRenderingCompletion(attempt + 1), 200); // Reduced to 200ms for faster processing
      }
    };

    // Start monitoring

    checkRenderingCompletion();
  };

  // Function to validate that all components have fresh data

  const validateAllComponentsHaveFreshData = () => {
    const resetValidationAndRevalidate = () => {
      validationTimeoutRef.current = null;
      isValidatingRef.current = false;
      validateAllComponentsHaveFreshData();
    };

    // Guard: Don't validate if not refreshing
    if (!isRefreshing) {
      // Clear any pending validation timeout
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
        validationTimeoutRef.current = null;
      }
      isValidatingRef.current = false;
      return;
    }

    // CRITICAL: Don't hide loading screen if retries are in progress
    if (isRetryingRef.current) {
      // Continue validation but don't hide loading screen yet
    }

    // Prevent multiple simultaneous validations
    if (isValidatingRef.current) {
      return;
    }

    isValidatingRef.current = true;

    setValidationAttempts((prev) => prev + 1);

    const currentAttempt = validationAttempts + 1;

    const maxValidationAttempts = 10; // Maximum 30 seconds of validation (10 attempts * 3 seconds)

    // TIMEOUT CHECK - Force completion if we've exceeded max attempts
    if (currentAttempt > maxValidationAttempts) {
      // Stop any ongoing API calls
      setIsMarketSizeLoading(false);
      setIsIndustryTrendsLoading(false);
      setIsMarketEntryLoading(false);
      setIsCompetitorLoading(false);
      setIsRegulatoryLoading(false);

      // Clear any pending validation timeout
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
        validationTimeoutRef.current = null;
      }
      isValidatingRef.current = false;

      setIsRefreshing(false);
      setLoadingPhase("complete");
      toast({
        title: "Loading Complete",
        description: "Components loaded with available data. Some may still be processing.",
        duration: 3000,
      });
      return;
    }

    // Add minimum wait time to ensure components have processed fresh data

    const timeSinceRefresh = Date.now() - (window.refreshStartTime ?? 0) || 0;

    const minWaitTime = 3000; // 3 seconds minimum wait for data processing

    if (timeSinceRefresh < minWaitTime) {
      // Clear any existing timeout before setting a new one
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }

      validationTimeoutRef.current = setTimeout(() => {
        resetValidationAndRevalidate();
      }, 500);

      return;
    }

    // Check each component's data freshness AND loading states AND timestamp freshness

    const refreshStartTime = window.refreshStartTime ?? 0;

    const isDataFresh = (timestamp: string | undefined) => {
      if (!timestamp) return false;

      const dataTime = new Date(timestamp).getTime();

      return dataTime >= refreshStartTime - 5000; // Allow 5 second buffer for processing
    };

    const componentDataChecks = {
      "Market Size":
        marketData?.executiveSummary &&
        marketData?.tamValue &&
        marketData?.GrowthRate &&
        !isMarketSizeLoading &&
        isDataFresh(marketData?.timestamp),

      "Industry Trends":
        industryTrendsData?.executiveSummary &&
        industryTrendsData?.aiAdoption &&
        !isIndustryTrendsLoading &&
        isDataFresh(industryTrendsData?.timestamp),

      "Market Entry":
        marketEntryData?.executiveSummary &&
        marketEntryData?.entryBarriers &&
        !isMarketEntryLoading &&
        isDataFresh(marketEntryData?.timestamp),

      "Competitor Landscape": competitorData?.executiveSummary && !isCompetitorLoading,

      "Regulatory Compliance":
        regulatoryData?.executiveSummary &&
        regulatoryData?.executiveSummary.trim() !== "" &&
        regulatoryData?.euAiActDeadline &&
        regulatoryData?.euAiActDeadline.trim() !== "" &&
        !isRegulatoryLoading &&
        isDataFresh(regulatoryData?.timestamp),
    };

    // Debug: Check each component's data structure in detail

    // Debug: Log actual data to see what we have

    // LENIENT VALIDATION - Check for basic data to allow components to load
    const simplifiedChecks = {
      "Market Size": marketData?.executiveSummary && !isMarketSizeLoading,
      "Industry Trends": industryTrendsData?.executiveSummary && !isIndustryTrendsLoading,
      "Market Entry": marketEntryData?.executiveSummary && !isMarketEntryLoading,
      "Competitor Landscape": competitorData?.executiveSummary && !isCompetitorLoading,
      "Regulatory Compliance": regulatoryData?.executiveSummary && !isRegulatoryLoading,
    };

    // Debug Market Entry specifically

    // Debug Industry Trends specifically

    // Debug all components comprehensively

    // Debug Competitor Landscape specifically

    // AGGRESSIVE FIX: Force Competitor Landscape to refresh if it's stuck
    if (competitorData && (!competitorData.executiveSummary || !competitorData.topPlayerShare)) {
      // Mark for force refresh
      setCompetitorData(null);
      if (currentUser?.uid) {
        removeUserLocalStorage("competitorData", currentUser.uid);
      } else {
        localStorage.removeItem("competitorData");
      }
    }

    // AGGRESSIVE FIX: Handle Competitor Landscape infinite loading
    if (isCompetitorLoading && competitorData === null) {
      setIsCompetitorLoading(false);
      setCompetitorError("Component timed out - please try refreshing");
    }

    const allComponentsHaveData = Object.values(simplifiedChecks).every((hasData) => hasData);

    if (allComponentsHaveData) {
      // Increment consecutive validations

      const newConsecutiveValidations = consecutiveValidations + 1;

      setConsecutiveValidations(newConsecutiveValidations);

      // Check if we have 1 consecutive successful validation (reduced for faster processing)

      if (newConsecutiveValidations >= 1) {
        // Only mark components as success if they actually have data

        setComponentStatus((prev) => {
          const newStatus = { ...prev };

          // Only mark as success if component has valid data

          if (simplifiedChecks["Market Size"]) {
            newStatus["Market Size"] = "success";
          }

          if (simplifiedChecks["Industry Trends"]) {
            newStatus["Industry Trends"] = "success";
          }

          if (simplifiedChecks["Market Entry"]) {
            newStatus["Market Entry"] = "success";
          }

          if (simplifiedChecks["Competitor Landscape"]) {
            newStatus["Competitor Landscape"] = "success";
          }

          if (simplifiedChecks["Regulatory Compliance"]) {
            newStatus["Regulatory Compliance"] = "success";
          }

          return newStatus;
        });

        // Clear global timeout since we're proceeding successfully

        if (globalTimeoutId) {
          clearTimeout(globalTimeoutId);

          setGlobalTimeoutId(null);
        }

        // Transition to rendering phase
        // Clear retry flag since we're transitioning to rendering (all API calls succeeded)
        isRetryingRef.current = false;

        setLoadingPhase("rendering");

        setComponentRenderingStatus({
          "Market Size": "rendering",

          "Industry Trends": "rendering",

          "Market Entry": "rendering",

          "Competitor Landscape": "rendering",

          "Regulatory Compliance": "rendering",
        });

        // Clear any pending validation timeout
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
          validationTimeoutRef.current = null;
        }
        isValidatingRef.current = false;

        // Start monitoring rendering completion

        startRenderingPhase();

        return; // Exit validation function - no need to continue
      } else {
        // Continue validation to ensure consistency with much shorter interval
        // Clear any existing timeout before setting a new one
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
        }

        validationTimeoutRef.current = setTimeout(() => {
          resetValidationAndRevalidate();
        }, 200); // Reduced to 200ms for faster processing

        return;
      }
    } else {
      // LENIENT APPROACH: If we have at least 3 components with data, proceed anyway
      // BUT: Only if retries are not in progress
      const componentsWithData = Object.values(simplifiedChecks).filter(
        (hasData) => hasData,
      ).length;
      if (componentsWithData >= 3 && currentAttempt >= 5 && !isRetryingRef.current) {
        // Stop any ongoing API calls
        setIsMarketSizeLoading(false);
        setIsIndustryTrendsLoading(false);
        setIsMarketEntryLoading(false);
        setIsCompetitorLoading(false);
        setIsRegulatoryLoading(false);

        // Clear any pending validation timeout
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
          validationTimeoutRef.current = null;
        }
        isValidatingRef.current = false;

        setIsRefreshing(false);
        setLoadingPhase("complete");
        toast({
          title: "Loading Complete",
          description: `${componentsWithData}/5 components loaded successfully.`,
          duration: 3000,
        });
        return;
      }

      // If retries are in progress, don't hide loading screen yet
      if (isRetryingRef.current) {
        // Continue validation but don't hide loading screen
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
        }
        validationTimeoutRef.current = setTimeout(() => {
          resetValidationAndRevalidate();
        }, 1000); // Check again in 1 second
        return;
      }

      // Reset consecutive validations since not all components have data

      setConsecutiveValidations(0);

      Object.entries(componentDataChecks).forEach(([_name, hasData]) => {
        if (!hasData) {
          // Component missing data - validation will handle
        }
      });

      if (currentAttempt >= maxValidationAttempts) {
        // Check if at least the API calls completed successfully

        const successfulComponents = Object.entries(componentStatus).filter(
          ([_name, status]) => status === "success",
        );

        // Clear global timeout

        if (globalTimeoutId) {
          clearTimeout(globalTimeoutId);

          setGlobalTimeoutId(null);
        }

        // AGGRESSIVE FIX: Hide loading screen if 4+ components are successful
        // This prevents infinite loading if Competitor Landscape is stuck
        // BUT: Only if retries are not in progress
        const requiredComponents = 4; // Allow loading screen to disappear with 4/5 components

        if (successfulComponents.length >= requiredComponents && !isRetryingRef.current) {
          setIsRefreshing(false);

          toast({
            title: "Refresh Complete",

            description: `${successfulComponents.length}/5 components updated successfully`,

            duration: 3000,
          });
        } else if (isRetryingRef.current) {
          // Continue validation but don't hide loading screen
          if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current);
          }
          validationTimeoutRef.current = setTimeout(() => {
            resetValidationAndRevalidate();
          }, 1000); // Check again in 1 second
        } else {
          // Continue validation for remaining components
          // Clear any existing timeout before setting a new one
          if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current);
          }

          validationTimeoutRef.current = setTimeout(() => {
            resetValidationAndRevalidate();
          }, 1500); // Reduced wait time (paid plan allows faster processing)
        }
      } else {
        // Wait a bit more and try again with much shorter interval
        // Clear any existing timeout before setting a new one
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
        }

        validationTimeoutRef.current = setTimeout(() => {
          resetValidationAndRevalidate();
        }, 200); // Reduced to 200ms for faster processing
      }
    }
  };

  // Company profile state for centralized data context

  const [companyProfile, setCompanyProfile] = useState<UntypedBackendApiResponse>(null);

  // Function to mark fresh data and ensure strict replacement

  const markFreshData = (componentName: string) => {
    setFreshDataFlags((prev) => ({ ...prev, [componentName]: true }));
  };

  // MarketIntelligenceTab state

  const [isMarketIntelligenceEditing, setIsMarketIntelligenceEditing] = useState(false);

  const [isMarketIntelligenceExpanded, setIsMarketIntelligenceExpanded] = useState(false);

  // Get initial market intelligence data from localStorage or defaults

  const getInitialMarketIntelligenceData = () => {
    try {
      const stored = getUserLocalStorage("marketIntelligenceData", currentUser?.uid);

      if (stored) {
        const parsedData = JSON.parse(stored);

        // CRITICAL: Verify this data belongs to the current user
        if (parsedData.user_id && currentUser && parsedData.user_id !== currentUser.uid) {
          removeUserLocalStorage("marketIntelligenceData", currentUser?.uid ?? "");
          // Don't return - will fall through to empty state
        } else if (parsedData.timestamp) {
          // Only return stored data if it has a timestamp AND belongs to current user
          return parsedData;
        }

        // Only return stored data if it has a timestamp (meaning it came from swagger)

        if (parsedData.timestamp) {
          return parsedData;
        } else {
          if (currentUser?.uid) {
            removeUserLocalStorage("marketIntelligenceData", currentUser.uid);
          } else {
            localStorage.removeItem("marketIntelligenceData");
          }
        }
      }
    } catch (error) {
      console.error("Error loading Market Intelligence data from localStorage:", error);

      localStorage.removeItem("marketIntelligenceData");
    }

    // Return empty values if no stored data - let the API populate the data

    return {
      executiveSummary: "",

      tamValue: "",

      samValue: "",

      GrowthRate: "",

      strategicRecommendations: [],

      marketEntry: "",

      marketDrivers: [],

      marketSizeBySegment: {},

      growthProjections: {},

      timestamp: null as string | null,
    };
  };

  const [marketIntelligenceData, setMarketIntelligenceData] = useState(
    getInitialMarketIntelligenceData(),
  );

  // Helper function to save market intelligence data to localStorage (debounced)

  const saveMarketIntelligenceToLocalStorage = React.useCallback(
    (data: UntypedBackendApiResponse) => {
      try {
        // CRITICAL: Always use current user's ID - check first
        if (!currentUser?.uid) {
          return;
        }
        // Ensure user_id is included in the data for verification
        const dataWithUserId = {
          ...data,
          user_id: currentUser.uid, // Always use current user's ID
        };
        setUserLocalStorage(
          "marketIntelligenceData",
          JSON.stringify(dataWithUserId),
          currentUser.uid,
        );
      } catch (error) {
        console.error("❌ Failed to save Market Intelligence data to localStorage:", error);
      }
    },
    [currentUser?.uid],
  );

  // Helper function to save competitor data to localStorage

  const saveCompetitorDataToLocalStorage = React.useCallback(
    (data: UntypedBackendApiResponse) => {
      try {
        const payloadToPersist = {
          ...data,

          // Guarantee a timestamp so loaders treat it as valid fresh data

          timestamp: data?.timestamp ?? Date.now(),

          // Ensure user_id is included for verification

          user_id: currentUser?.uid || data.user_id,
        };

        setUserLocalStorage("competitorData", JSON.stringify(payloadToPersist), currentUser?.uid);
      } catch (error) {
        console.error("❌ Failed to save Competitor data to localStorage:", error);
      }
    },
    [currentUser?.uid],
  );

  // Helper function to save regulatory data to localStorage

  const saveRegulatoryDataToLocalStorage = React.useCallback(
    (data: UntypedBackendApiResponse) => {
      try {
        // CRITICAL: Always include user_id for multi-tenancy
        const dataWithUserId = {
          ...data,
          user_id: currentUser?.uid || data.user_id,
        };

        setUserLocalStorage("regulatoryData", JSON.stringify(dataWithUserId), currentUser?.uid);
      } catch (error) {
        console.error("❌ Failed to save Regulatory data to localStorage:", error);
      }
    },
    [currentUser?.uid],
  );

  // Helper function to save industry trends data to localStorage

  const saveIndustryTrendsDataToLocalStorage = React.useCallback(
    (data: UntypedBackendApiResponse) => {
      try {
        const payloadToPersist = {
          ...data,

          // Ensure a timestamp so subsequent loads treat it as persisted API data

          timestamp: data?.timestamp ?? Date.now(),

          // CRITICAL: Always include user_id for multi-tenancy
          user_id: currentUser?.uid || data.user_id,
        };

        setUserLocalStorage(
          "industryTrendsData",
          JSON.stringify(payloadToPersist),
          currentUser?.uid,
        );
      } catch (error) {
        console.error("❌ Failed to save Industry Trends data to localStorage:", error);
      }
    },
    [currentUser?.uid],
  );

  // Helper function to save market entry data to localStorage

  const saveMarketEntryDataToLocalStorage = React.useCallback(
    (data: UntypedBackendApiResponse) => {
      try {
        const payloadToPersist = {
          ...data,

          // Ensure a timestamp is always present so loader prefers persisted data

          timestamp: data?.timestamp ?? Date.now(),

          // CRITICAL: Always include user_id for multi-tenancy
          user_id: currentUser?.uid || data.user_id,
        };

        setUserLocalStorage("marketEntryData", JSON.stringify(payloadToPersist), currentUser?.uid);
      } catch (error) {
        console.error("❌ Failed to save Market Entry data to localStorage:", error);
      }
    },
    [currentUser?.uid],
  );

  // Market Size API state

  const [isMarketSizeLoading, setIsMarketSizeLoading] = useState(false);

  const [marketSizeError, setMarketSizeError] = useState<string | null>(null);

  // Competitor Landscape API state

  const [isCompetitorLoading, setIsCompetitorLoading] = useState(false);

  const [competitorError, setCompetitorError] = useState<string | null>(null);

  // Add missing loading states for other components

  const [isIndustryTrendsLoading, setIsIndustryTrendsLoading] = useState(false);

  const [isMarketEntryLoading, setIsMarketEntryLoading] = useState(false);

  const [isRegulatoryLoading, setIsRegulatoryLoading] = useState(false);

  // Add missing error states for other components

  const [, setIndustryTrendsError] = useState<string | null>(null);

  const [, setMarketEntryError] = useState<string | null>(null);

  const [, setRegulatoryError] = useState<string | null>(null);

  const [deletedSections, setDeletedSections] = useState<Set<string>>(new Set());

  // Edit history state

  const [editHistory, setEditHistory] = useState<EditRecord[]>([]);

  const [isEditHistoryOpen, setIsEditHistoryOpen] = useState(false);

  const [editHistoryContext, setEditHistoryContext] = useState<string>("");

  const [hasEdits, setHasEdits] = useState(false);

  // Industry Trends state - Add these new state variables

  const [isIndustryTrendsEditing, setIsIndustryTrendsEditing] = useState(false);

  const [industryTrendsExpanded, setIndustryTrendsExpanded] = useState(false);

  const [industryTrendsHasEdits, setIndustryTrendsHasEdits] = useState(false);

  const [industryTrendsDeletedSections, setIndustryTrendsDeletedSections] = useState<Set<string>>(
    new Set(),
  );

  const [industryTrendsEditHistory, setIndustryTrendsEditHistory] = useState<EditRecord[]>([]);

  // Function to get initial Industry Trends data from localStorage or defaults

  const getInitialIndustryTrendsData = () => {
    try {
      const stored = getUserLocalStorage("industryTrendsData", currentUser?.uid);

      if (stored) {
        const parsedData = JSON.parse(stored);

        // Only return stored data if it has a timestamp (meaning it came from API)

        if (parsedData.timestamp) {
          // Ensure visualCharts structure exists (for backward compatibility with old localStorage data)
          const dataWithDefaults = {
            ...parsedData,
            visualCharts: parsedData.visualCharts || {
              aiAdoptionTrends: [],
              technologyBudgetAllocation: {},
            },
            regionalHotspots: parsedData.regionalHotspots || {},
          };

          return dataWithDefaults;
        } else {
          if (currentUser?.uid) {
            removeUserLocalStorage("industryTrendsData", currentUser.uid);
          } else {
            localStorage.removeItem("industryTrendsData");
          }
        }
      }
    } catch (error) {
      console.error("❌ Error loading Industry Trends data from localStorage:", error);

      if (currentUser?.uid) {
        removeUserLocalStorage("industryTrendsData", currentUser.uid);
      } else {
        localStorage.removeItem("industryTrendsData");
      }
    }

    // Return default data if no valid stored data

    return {
      executiveSummary:
        "The enterprise software industry is experiencing rapid transformation driven by AI adoption, cloud migration, and regulatory changes. Key trends indicate accelerated digital transformation with 78% of companies prioritizing AI integration.",

      aiAdoption: "78%",

      cloudMigration: "45%",

      regulatory: "12",

      trendSnapshots: [
        { title: "AI Integration", metric: "78% adoption rate", type: "adoption" as const },

        { title: "Cloud Migration", metric: "45% increase YoY", type: "growth" as const },

        { title: "Regulatory Impact", metric: "12 new policies", type: "performance" as const },
      ],

      recommendations: {
        primaryFocus: "Focus on digital transformation and AI adoption",

        marketEntry: "Strategic partnerships and gradual market penetration",
      },

      regionalHotspots: {},

      visualCharts: {
        aiAdoptionTrends: [],

        technologyBudgetAllocation: {},
      },

      risks: [
        "Regulatory changes could impact timeline",
        "Competition intensifying rapidly",
        "Economic uncertainty affecting IT spending",
      ],

      timestamp: null as string | null,
    };
  };

  const [industryTrendsData, setIndustryTrendsData] = useState(getInitialIndustryTrendsData());

  const [industryTrendsLastEditedField, setIndustryTrendsLastEditedField] = useState("");

  // Opportunity filter from intelligence sections
  const [opportunityFilter, setOpportunityFilter] = useState<string | null>(null);

  // Regulatory Compliance state - Add these new state variables

  const [isRegulatoryEditing, setIsRegulatoryEditing] = useState(false);

  const [regulatoryExpanded, setRegulatoryExpanded] = useState(false);

  const [regulatoryHasEdits, setRegulatoryHasEdits] = useState(false);

  const [regulatoryDeletedSections, setRegulatoryDeletedSections] = useState<Set<string>>(
    new Set(),
  );

  const [regulatoryEditHistory] = useState<EditRecord[]>([]);

  // Helper function to get default regulatory data (used when clearing/resetting)
  const getDefaultRegulatoryData = () => ({
    executiveSummary:
      "The regulatory landscape for SaaS companies continues to evolve rapidly, with new compliance requirements emerging across multiple jurisdictions. Organizations must navigate an increasingly complex web of data protection, AI governance, and industry-specific regulations.",
    euAiActDeadline: "February 2, 2025",
    gdprCompliance: "68%",
    potentialFines: "Up to 6% of annual revenue",
    dataLocalization: "Mandatory for customer data",
    keyUpdates: [],
    visualDataCards: [],
    regionalData: [],
    strategicRecommendations: {
      mitigateRegulatoryRisks: [],
      competitivePositioning: [],
      goToMarketStrategy: [],
    },
    timestamp: null as string | null,
  });

  // Function to get initial Regulatory data from localStorage or defaults
  const getInitialRegulatoryData = () => {
    try {
      const stored = getUserLocalStorage("regulatoryData", currentUser?.uid);

      if (stored) {
        const parsedData = JSON.parse(stored);

        // Only return stored data if it has a timestamp (meaning it came from API)

        if (parsedData.timestamp) {
          // Ensure all required fields exist (for backward compatibility with old localStorage data)
          const dataWithDefaults = {
            ...parsedData,
            keyUpdates: parsedData.keyUpdates || [],
            visualDataCards: parsedData.visualDataCards || [],
            regionalData: parsedData.regionalData || [],
            strategicRecommendations: parsedData.strategicRecommendations || {
              mitigateRegulatoryRisks: [],
              competitivePositioning: [],
              goToMarketStrategy: [],
            },
          };

          return dataWithDefaults;
        }
      }
    } catch (error) {
      console.error("❌ Error loading Regulatory data from localStorage:", error);
    }

    // Return default data if no valid stored data

    return getDefaultRegulatoryData();
  };

  const [regulatoryData, setRegulatoryData] = useState(getInitialRegulatoryData());

  // Competitor Landscape state - Add these new state variables

  const [isCompetitorEditing, setIsCompetitorEditing] = useState(false);

  const [competitorExpanded, setCompetitorExpanded] = useState(false);

  const [competitorHasEdits, setCompetitorHasEdits] = useState(false);

  const [competitorDeletedSections, setCompetitorDeletedSections] = useState<Set<string>>(
    new Set(),
  );

  const [competitorEditHistory, setCompetitorEditHistory] = useState<EditRecord[]>([]);

  // Function to get initial Competitor data from localStorage or defaults

  const getInitialCompetitorData = () => {
    try {
      const stored = getUserLocalStorage("competitorData", currentUser?.uid);

      if (stored) {
        const parsedData = JSON.parse(stored);

        // Only return stored data if it has a timestamp (meaning it came from API)

        if (parsedData.timestamp) {
          return parsedData;
        }
      }
    } catch (error) {
      console.error("❌ Error loading Competitor data from localStorage:", error);
    }

    // Return default data if no valid stored data - provide meaningful fallback

    return {
      executiveSummary:
        "The competitive landscape analysis is being prepared. This will include insights on market leaders, emerging players, and recent funding activities in your industry.",

      topPlayerShare: "Loading market share data...",

      emergingPlayers: "Analyzing emerging competitors...",

      fundingNews: [],

      timestamp: null as string | null,

      uiComponents: [],
    };
  };

  const [competitorData, setCompetitorData] = useState(getInitialCompetitorData());

  // Market Size Scout Chat states (separate from Industry Trends)

  const [showMarketSizeScoutChat, setShowMarketSizeScoutChat] = useState(false);

  const [marketSizeHasEdits, setMarketSizeHasEdits] = useState(false);

  const [marketSizeLastEditedField, setMarketSizeLastEditedField] = useState("");

  const [marketSizeDeletedSections, setMarketSizeDeletedSections] = useState<Set<string>>(
    new Set(),
  );

  const [marketSizeCustomMessage, setMarketSizeCustomMessage] = useState<string | undefined>(
    undefined,
  );

  // Collapse Market Size section when chat opens
  useEffect(() => {
    if (showMarketSizeScoutChat) {
      setIsMarketIntelligenceExpanded(false);
    }
  }, [showMarketSizeScoutChat]);

  // Industry Trends Scout Chat states (separate from Market Size)

  const [showIndustryTrendsScoutChat, setShowIndustryTrendsScoutChat] = useState(false);

  const [industryTrendsCustomMessage, setIndustryTrendsCustomMessage] = useState<
    string | undefined
  >(undefined);

  // Competitor Landscape Scout Chat states (separate from others)

  const [showCompetitorScoutChat, setShowCompetitorScoutChat] = useState(false);

  const [competitorCustomMessage, setCompetitorCustomMessage] = useState<string | undefined>(
    undefined,
  );

  // Collapse Competitor Landscape section when chat opens
  useEffect(() => {
    if (showCompetitorScoutChat) {
      setCompetitorExpanded(false);
    }
  }, [showCompetitorScoutChat]);

  // Regulatory Compliance Scout Chat states

  const [showRegulatoryScoutChat, setShowRegulatoryScoutChat] = useState(false);

  const [isRegulatoryPostSave, setIsRegulatoryPostSave] = useState(false);

  const [regulatoryCustomMessage, setRegulatoryCustomMessage] = useState<string | undefined>(
    undefined,
  );

  // Collapse Regulatory Compliance section when chat opens
  useEffect(() => {
    if (showRegulatoryScoutChat) {
      setRegulatoryExpanded(false);
    }
  }, [showRegulatoryScoutChat]);

  // Market Entry & Growth Strategy state

  const [isMarketEntryEditing, setIsMarketEntryEditing] = useState(false);

  const [marketEntryExpanded, setMarketEntryExpanded] = useState(false);

  const [marketEntryHasEdits, setMarketEntryHasEdits] = useState(false);

  const [marketEntryDeletedSections, setMarketEntryDeletedSections] = useState<Set<string>>(
    new Set(),
  );

  const [marketEntryEditHistory, setMarketEntryEditHistory] = useState<EditRecord[]>([]);

  // Function to get initial Market Entry data from localStorage (no fallback defaults)

  const getInitialMarketEntryData = () => {
    try {
      const stored = getUserLocalStorage("marketEntryData", currentUser?.uid);

      if (stored) {
        const parsedData = JSON.parse(stored);

        // Only return stored data if it has a timestamp (meaning it came from API)

        if (parsedData.timestamp) {
          // Ensure SWOT data is preserved - check both swot and swotAnalysis fields
          const loadedSwot = parsedData.swotAnalysis || parsedData.swot;
          if (loadedSwot) {
            // Also set swotAnalysis if only swot exists, for consistency
            if (parsedData.swot && !parsedData.swotAnalysis) {
              parsedData.swotAnalysis = parsedData.swot;
            }
          }

          return parsedData;
        }
      }
    } catch (error) {
      console.error("❌ Error loading Market Entry data from localStorage:", error);
    }

    // No fallback defaults: start with empty values until API data arrives

    return {
      executiveSummary: "",

      entryBarriers: [],

      recommendedChannel: "",

      timeToMarket: "",

      topBarrier: "",

      competitiveDifferentiation: [],

      strategicRecommendations: [],

      riskAssessment: [],

      swot: null as UntypedBackendApiResponse,

      timeline: null as UntypedBackendApiResponse,

      marketSizeBySegment: null as UntypedBackendApiResponse,

      growthProjections: null as UntypedBackendApiResponse,

      timestamp: null as string | null,
    };
  };

  const [marketEntryData, setMarketEntryData] = useState(getInitialMarketEntryData());

  // Market Entry Scout Chat states

  const [showMarketEntryScoutChat, setShowMarketEntryScoutChat] = useState(false);

  const [isMarketEntryPostSave, setIsMarketEntryPostSave] = useState(false);

  const [marketEntryCustomMessage, setMarketEntryCustomMessage] = useState<string | undefined>(
    undefined,
  );

  const [isMarketEntryEditHistoryOpen, setIsMarketEntryEditHistoryOpen] = useState(false);

  // Expose getAllScoutComponentResponses to window for console access
  useEffect(() => {
    // Expose the function globally so it can be called from browser console
    window.getAllScoutComponentResponses = async (refresh = false) => {
      const result = await getAllScoutComponentResponses(refresh);

      // Log summary to console

      // Log each component's response body
      result.results.forEach((componentResult, _index) => {
        if (componentResult.success) {
          // intentional: no-op on success; only errors are logged
        } else {
          console.error("❌ Error:", componentResult.error);
          console.error("Status:", componentResult.status);
        }
      });

      // Also log the full result object

      return result;
    };

    // Also create a simpler alias for quick access
    window.getScoutResponses = window.getAllScoutComponentResponses;

    return () => {
      delete window.getAllScoutComponentResponses;
      delete window.getScoutResponses;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, orgIdToUse]);

  // Transform raw report data to our expected structure (for historical data only)

  const transformReportData = (reportData: UntypedBackendApiResponse): MarketIntelligenceData => {
    // Only transform if this is historical data or general market data

    // Don't use this for component-specific API responses

    const transformed = {
      researchReports: reportData.researchReports || [],

      rankings: reportData.rankings || [],

      markets: reportData.markets || [],

      market_segments: reportData.market_segments || [],

      swot_analysis: reportData.swot_analysis || {
        swot_id: "",

        strengths: [],

        weaknesses: [],

        opportunities: [],

        threats: [],
      },

      emerging_trends: reportData.emerging_trends || [],

      technology_drivers: reportData.technology_drivers || [],

      timestamp: reportData.timestamp,

      // Market Size & Opportunity fields - NO fallback text, keep empty if not available

      executiveSummary: reportData.executiveSummary || "",

      tamValue: reportData.tamValue || "",

      samValue: reportData.samValue || "",

      GrowthRate: reportData.GrowthRate || "",

      strategicRecommendations: reportData.strategicRecommendations || [],

      marketEntry: reportData.marketEntry || "",

      marketDrivers: reportData.marketDrivers || [],

      marketSizeBySegment: reportData.marketSizeBySegment || {},

      growthProjections: reportData.growthProjections || {},
    };

    return transformed;
  };

  // Function to return to current data

  const returnToCurrentData = async () => {
    setIsShowingHistoricalData(false);

    setHistoricalDataTimestamp(null);

    // Fetch fresh current data

    await fetchMarketData(true);
  };

  // Fetch market intelligence data with graceful fallback

  const fetchMarketData = async (isRefresh = false) => {
    try {
      // Set loading states appropriately

      if (!isRefresh) {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError(null);

      // Clear any browser cache for this endpoint

      if ("caches" in window) {
        const cacheNames = await caches.keys();

        await Promise.all(
          cacheNames.map((cacheName) =>
            caches.open(cacheName).then((cache) => cache.delete("/api/market-research_claude")),
          ),
        );
      }

      // Clear localStorage cache for fresh data

      if (isRefresh) {
        // Clear user-specific cache
        if (currentUser?.uid) {
          removeUserLocalStorage("marketIntelligenceData", currentUser.uid);
          removeUserLocalStorage("competitorData", currentUser.uid);
          removeUserLocalStorage("regulatoryData", currentUser.uid);
          removeUserLocalStorage("industryTrendsData", currentUser.uid);
          removeUserLocalStorage("marketEntryData", currentUser.uid);
        } else {
          // Fallback: clear old format
          if (currentUser?.uid) {
            removeUserLocalStorage("marketIntelligenceData", currentUser.uid);
          } else {
            localStorage.removeItem("marketIntelligenceData");
          }
          if (currentUser?.uid) {
            removeUserLocalStorage("competitorData", currentUser.uid);
          } else {
            localStorage.removeItem("competitorData");
          }
          if (currentUser?.uid) {
            removeUserLocalStorage("regulatoryData", currentUser.uid);
          } else {
            localStorage.removeItem("regulatoryData");
          }
          if (currentUser?.uid) {
            removeUserLocalStorage("industryTrendsData", currentUser.uid);
          } else {
            localStorage.removeItem("industryTrendsData");
          }
          if (currentUser?.uid) {
            removeUserLocalStorage("marketEntryData", currentUser.uid);
          } else {
            localStorage.removeItem("marketEntryData");
          }
        }
      }

      // Try to get existing market intelligence data first with cache busting

      // Ensure user is authenticated before making API call
      if (!currentUser?.uid) {
        console.error("User not authenticated, cannot fetch market data");
        setError("Please log in to view market data");
        setIsInitialLoading(false);
        setIsRefreshing(false);
        return;
      }

      const payload = {
        component_name: "market size & opportunity",

        org_id: orgIdToUse,
        user_id: currentUser?.uid || "",

        refresh: true,

        _timestamp: Date.now(), // Add timestamp to ensure fresh data

        _cache_bust: Math.random().toString(36).substring(7),

        data: {},
      };

      const response = await fetch(
        `${buildApiUrl("market-research_claude")}?_cb=${Date.now()}&_r=${Math.random()}`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",

            "Cache-Control": "no-cache, no-store, must-revalidate",

            Pragma: "no-cache",

            Expires: "0",
          },

          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();

        console.error("❌ Direct fetch error:", errorText);

        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const apiResponse = await response.json();

      // CRITICAL: Validate that the API response belongs to the current user
      if (!validateApiResponseUserId(apiResponse, currentUser?.uid, "Market Intelligence")) {
        setError("Data security validation failed. Please refresh.");
        setIsInitialLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Extract the report data from the API response

      const reportData = apiResponse.report || apiResponse;

      // Transform the data to match our expected structure

      const transformedData = transformReportData(reportData);

      // Update both state and localStorage for persistence
      // Preserve existing data if API response is missing fields
      setMarketData((prev) => {
        const merged = {
          ...prev,
          ...transformedData,
          // Only update fields that exist in transformedData, preserve existing ones
          strategicRecommendations:
            (transformedData.strategicRecommendations?.length ?? 0) > 0
              ? transformedData.strategicRecommendations
              : prev?.strategicRecommendations || [],
          marketDrivers:
            (transformedData.marketDrivers?.length ?? 0) > 0
              ? transformedData.marketDrivers
              : prev?.marketDrivers || [],
          marketSizeBySegment:
            transformedData.marketSizeBySegment &&
            Object.keys(transformedData.marketSizeBySegment).length > 0
              ? transformedData.marketSizeBySegment
              : prev?.marketSizeBySegment || {},
          growthProjections:
            transformedData.growthProjections &&
            Object.keys(transformedData.growthProjections).length > 0
              ? transformedData.growthProjections
              : prev?.growthProjections || {},
        };
        // Store in user-specific cache
        setUserCache(currentUser?.uid, merged, Date.now());
        // Save merged data to localStorage for persistence
        saveMarketIntelligenceToLocalStorage(merged);
        return merged;
      });

      // Reset historical data flags when fetching current data

      setIsShowingHistoricalData(false);

      setHistoricalDataTimestamp(null);
    } catch (err) {
      console.error("Error fetching market data:", err);

      setError(err instanceof Error ? err.message : "Failed to fetch market data");

      // Always ensure we show any available data, even if the fetch failed

      const fallbackData = getCachedData(currentUser?.uid);

      if (fallbackData && !marketData) {
        setMarketData(fallbackData);
        // Store in user-specific cache
        setUserCache(currentUser?.uid, fallbackData, Date.now());
      }
    } finally {
      setIsInitialLoading(false);

      setIsRefreshing(false);
    }
  };

  // Initial data loading effect

  useEffect(() => {
    // Load initial data for all components

    const loadInitialData = async () => {
      try {
        // Load competitor data initially with a small delay to prevent rate limiting

        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before making API calls

        await fetchCompetitorData(false, false); // Don't show loading, don't force refresh

        // If competitor data is still null after initial load, force a refresh

        setTimeout(() => {
          if (!competitorData) {
            void fetchCompetitorData(true, false);
          }
        }, 100); // Reduced to 100ms for fastest response
      } catch (error) {
        console.error("❌ Error loading initial data:", error);
      }
    };

    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initial-load effect; competitorData and fetchCompetitorData intentionally read at call-time to avoid re-fetch loops
  }, []); // Only run on mount

  // NOTE: Auto-refresh removed to prevent automatic refreshes
  // Auto-refresh competitor data if it's null (fallback mechanism)
  // DISABLED: This was causing automatic refreshes after components loaded

  // Listen for company profile updates to clear cache and refresh data

  useEffect(() => {
    const handleCompanyProfileUpdate = (event: CustomEvent) => {
      if (event.detail?.clearCaches) {
        clearMarketDataCache();

        // Clear React state to force fresh data

        setCompetitorData(null);

        setMarketData(null);

        // Only clear regulatory data if it doesn't have a timestamp (meaning it's fallback data)
        if (!regulatoryData?.timestamp) {
          setRegulatoryData(getDefaultRegulatoryData());
        } else {
          // intentional: preserve fresh regulatory data with timestamp
        }

        setIndustryTrendsData(null);

        setMarketEntryData(null);

        // Reset fresh data flags to ensure all components get fresh data

        setFreshDataFlags({
          "Market Size": false,

          "Industry Trends": false,

          "Market Entry": false,

          "Competitor Landscape": false,

          "Regulatory Compliance": false,
        });

        // NOTE: Automatic refresh removed - refresh only happens when user clicks refresh button
        // Trigger refresh of all components with new profile

        // console.log('🔄 Triggering refresh of all components with updated company profile...');

        // triggerScoutAndRefresh();
      }
    };

    window.addEventListener("companyProfileUpdated", handleCompanyProfileUpdate as EventListener);

    return () => {
      window.removeEventListener(
        "companyProfileUpdated",
        handleCompanyProfileUpdate as EventListener,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only event-listener subscription; handler reads regulatoryData?.timestamp at event-fire time intentionally
  }, []);

  // Smart refresh function that tracks component status and only retries failed ones

  const smartRefresh = async (isFirstRefresh = false) => {
    // Reset all component status to pending to ensure all components are fetched

    setComponentStatus({
      "Market Size": "pending",

      "Industry Trends": "pending",

      "Market Entry": "pending",

      "Competitor Landscape": "pending",

      "Regulatory Compliance": "pending",
    });

    // NOTE: Don't clear existing data during refresh to prevent "no data available" flash
    // Data will be replaced when fresh data arrives from API
    // Only clear data if explicitly needed (e.g., on explicit refresh button click)

    try {
      if (isFirstRefresh) {
        // Reset all component statuses on first refresh

        setComponentStatus({
          "Market Size": "pending",

          "Industry Trends": "pending",

          "Market Entry": "pending",

          "Competitor Landscape": "pending",

          "Regulatory Compliance": "pending",
        });

        // Reset loading phases

        setLoadingPhase("api");

        setComponentRenderingStatus({
          "Market Size": "pending",

          "Industry Trends": "pending",

          "Market Entry": "pending",

          "Competitor Landscape": "pending",

          "Regulatory Compliance": "pending",
        });

        setRefreshAttempt(1);

        setValidationAttempts(0); // Reset validation attempts for new refresh

        setConsecutiveValidations(0); // Reset consecutive validations for new refresh

        // Reset component failure counts for new refresh
        setComponentFailureCounts({});

        // Reset retry flag for new refresh
        isRetryingRef.current = false;
      } else {
        setRefreshAttempt((prev) => prev + 1);

        setValidationAttempts(0); // Reset validation attempts for retry

        setConsecutiveValidations(0); // Reset consecutive validations for retry

        // Keep retry flag true since we're retrying
        isRetryingRef.current = true;
      }

      setIsRefreshing(true);
      setIsInitialLoading(false); // Ensure initial loading is false for refresh

      setError(null);

      // Always clear data for fresh fetch to ensure all components get updated data

      setMarketData(null);
      setCompetitorData(null);
      // Only clear regulatory data if it doesn't have a timestamp (meaning it's fallback data)
      if (!regulatoryData?.timestamp) {
        setRegulatoryData(getDefaultRegulatoryData());
      } else {
        // intentional: preserve fresh regulatory data with timestamp
      }
      setIndustryTrendsData(null);
      setMarketEntryData(null);

      // Also clear the marketIntelligenceData state to prevent data switching
      setMarketIntelligenceData({
        executiveSummary: "",
        tamValue: "",
        samValue: "",
        GrowthRate: "",
        strategicRecommendations: [],
        marketEntry: "",
        marketDrivers: [],
        marketSizeBySegment: {},
        growthProjections: {},
        timestamp: null,
        user_id: currentUser?.uid, // Include user_id even when clearing
      });

      // Clear localStorage cache for all components
      localStorage.removeItem("marketSizeData");
      if (currentUser?.uid) {
        removeUserLocalStorage("industryTrendsData", currentUser.uid);
      } else {
        localStorage.removeItem("industryTrendsData");
      }
      if (currentUser?.uid) {
        removeUserLocalStorage("marketEntryData", currentUser.uid);
      } else {
        localStorage.removeItem("marketEntryData");
      }
      if (currentUser?.uid) {
        removeUserLocalStorage("competitorData", currentUser.uid);
      } else {
        localStorage.removeItem("competitorData");
      }
      if (currentUser?.uid) {
        removeUserLocalStorage("regulatoryData", currentUser.uid);
      } else {
        localStorage.removeItem("regulatoryData");
      }
      if (currentUser?.uid) {
        removeUserLocalStorage("companyProfileForRefresh", currentUser.uid);
      } else {
        localStorage.removeItem("companyProfileForRefresh");
      }

      // Set refresh start time for minimum wait validation

      window.refreshStartTime = Date.now();

      clearGlobalLoadingTimeout();

      // Get company profile data for context (user-specific)

      let companyProfileData = null;

      if (currentUser?.uid) {
        const cachedProfile = getUserLocalStorage("companyProfile", currentUser.uid);

        if (cachedProfile) {
          try {
            companyProfileData = JSON.parse(cachedProfile);
            // Verify this profile belongs to the current user
            if (companyProfileData.user_id && companyProfileData.user_id !== currentUser.uid) {
              companyProfileData = null;
            } else {
              // intentional: profile belongs to current user; keep it
            }
          } catch (_error) {
            // intentional: ignore corrupt cached profile
          }
        }
      }

      if (!companyProfileData && currentUser?.uid) {
        try {
          // Include org_id in API call
          const profileResponse = await fetch(
            `${buildApiUrl("profile/company")}?org_id=${orgIdToUse}`,
            {
              method: "GET",

              headers: { "Content-Type": "application/json" },
            },
          );

          if (profileResponse.ok) {
            companyProfileData = await profileResponse.json();
            // Verify the profile belongs to the current user
            if (companyProfileData.user_id && companyProfileData.user_id !== currentUser.uid) {
              companyProfileData = null;
            } else {
              // Store in user-specific localStorage
              setUserLocalStorage(
                "companyProfile",
                JSON.stringify(companyProfileData),
                currentUser.uid,
              );
            }
          }
        } catch (_error) {
          // intentional: best-effort cache write; ignore failures
        }
      }

      // Only use companyProfileData if it belongs to the current user
      if (companyProfileData && currentUser?.uid) {
        // Final verification that the profile belongs to current user
        if (companyProfileData.user_id && companyProfileData.user_id !== currentUser.uid) {
          companyProfileData = null;
        }
      }

      if (companyProfileData && currentUser?.uid) {
        setUserLocalStorage(
          "companyProfileForRefresh",
          JSON.stringify(companyProfileData),
          currentUser.uid,
        );
      }

      // DO NOT show cached data during refresh - this causes components to switch to previous data
      // The loading screen should mask the entire process until fresh data is ready

      // No delay needed for parallel execution

      // Define all components in UI display order
      // UI Order: Market Size → Industry Trends → Competitor Landscape → Regulatory → Market Entry
      const allComponents = [
        { name: "Market Size", fetchFn: fetchMarketSizeData, priority: 1 },

        { name: "Industry Trends", fetchFn: fetchIndustryTrendsData, priority: 2 },

        { name: "Competitor Landscape", fetchFn: fetchCompetitorData, priority: 3 },

        { name: "Regulatory Compliance", fetchFn: fetchRegulatoryData, priority: 4 },

        { name: "Market Entry", fetchFn: fetchMarketEntryData, priority: 5 },
      ];

      allComponents.forEach((_component, _index) => {});

      const componentsToFetch = allComponents;

      // Only clear component data and caches on first refresh; on retry runs keep existing data so UI doesn't flash and we only overwrite when a component succeeds
      if (isFirstRefresh) {
        setMarketData(null);
        setCompetitorData(null);
        if (!regulatoryData?.timestamp) {
          setRegulatoryData(getDefaultRegulatoryData());
        }
        setIndustryTrendsData(null);
        setMarketEntryData(null);
        setMarketIntelligenceData((prev: UntypedReportState) => ({
          executiveSummary: prev?.executiveSummary || "",
          tamValue: prev?.tamValue || "",
          samValue: prev?.samValue || "",
          GrowthRate: prev?.GrowthRate || "",
          strategicRecommendations: prev?.strategicRecommendations || [],
          marketEntry: prev?.marketEntry || "",
          marketDrivers: prev?.marketDrivers || [],
          marketSizeBySegment: prev?.marketSizeBySegment || {},
          growthProjections: prev?.growthProjections || {},
          timestamp: prev?.timestamp || null,
          user_id: currentUser?.uid || prev?.user_id,
        }));
        localStorage.removeItem("marketSizeData");
        if (currentUser?.uid) {
          removeUserLocalStorage("industryTrendsData", currentUser.uid);
          removeUserLocalStorage("marketEntryData", currentUser.uid);
          removeUserLocalStorage("competitorData", currentUser.uid);
          removeUserLocalStorage("regulatoryData", currentUser.uid);
          removeUserLocalStorage("companyProfileForRefresh", currentUser.uid);
        } else {
          localStorage.removeItem("industryTrendsData");
          localStorage.removeItem("marketEntryData");
          localStorage.removeItem("competitorData");
          localStorage.removeItem("regulatoryData");
          localStorage.removeItem("companyProfileForRefresh");
        }
      }

      allComponents.forEach((_component, _index) => {});

      // Always process all components - no early exit

      const currentStatus = { ...componentStatus }; // Local copy to track status

      // Build context object to accumulate data from previous components for cascading refresh
      const accumulatedContext: UntypedCascadeContext = {};

      // Process components sequentially (cascading) with context passing

      // Process components sequentially (cascading: each request body includes previous responses as context)
      console.log(
        `📋 [CASCADE] Refresh started – components in order: ${componentsToFetch.map((c) => c.name).join(" → ")}`,
      );

      for (let index = 0; index < componentsToFetch.length; index++) {
        const component = componentsToFetch[index];
        const contextKeys = Object.keys(accumulatedContext);
        console.log(
          `📋 [CASCADE] ${component.name} – request will include context from previous: ${contextKeys.length ? contextKeys.join(", ") : "none (first component)"}`,
        );

        try {
          // Update component status to pending
          currentStatus[component.name] = "pending";
          setComponentStatus((prev) => ({ ...prev, [component.name]: "pending" }));

          // Make API call with context (no per-component wall-clock timeout — reports may take a long time)
          // Request and response bodies will be logged inside fetch function
          let result;
          try {
            result = await component.fetchFn(true, false, accumulatedContext);

            // Extract data from result and add to accumulated context for next component
            if (result && typeof result === "object") {
              const contextKeyMap: { [key: string]: string } = {
                "Market Size": "marketSize",
                "Industry Trends": "industryTrends",
                "Competitor Landscape": "competitorLandscape",
                "Regulatory Compliance": "regulatoryCompliance",
                "Market Entry": "marketEntry",
              };

              const contextKey = contextKeyMap[component.name];
              if (contextKey) {
                accumulatedContext[contextKey] = result;
                // Log context cascaded so next request body will include these keys
                const nextIndex = index + 1;
                if (nextIndex < componentsToFetch.length) {
                  console.log(
                    `📋 [CONTEXT CASCADE] After ${component.name} → next request (${componentsToFetch[nextIndex].name}) will include context:`,
                    Object.keys(accumulatedContext),
                  );
                }
              }
            }

            currentStatus[component.name] = "success";
            setComponentStatus((prev) => ({ ...prev, [component.name]: "success" }));
          } catch (apiError) {
            // Component failed - add error stub to context so next components still receive "this one failed" and backend can use fallback
            const reason = apiError instanceof Error ? apiError.message : String(apiError);
            console.error(`❌ ${component.name} failed:`, reason);
            const contextKeyMap: { [key: string]: string } = {
              "Market Size": "marketSize",
              "Industry Trends": "industryTrends",
              "Competitor Landscape": "competitorLandscape",
              "Regulatory Compliance": "regulatoryCompliance",
              "Market Entry": "marketEntry",
            };
            const contextKey = contextKeyMap[component.name];
            if (contextKey) {
              accumulatedContext[contextKey] = {
                _error: true,
                _message: reason,
                _status: "failed",
              };
              const nextIndex = index + 1;
              if (nextIndex < componentsToFetch.length) {
                console.log(
                  `📋 [CONTEXT CASCADE] After ${component.name} (failed) → next request will include error stub. Context keys:`,
                  Object.keys(accumulatedContext),
                );
              }
            }
            currentStatus[component.name] = "failed";
            setComponentStatus((prev) => ({ ...prev, [component.name]: "failed" }));
          }
        } catch (error) {
          console.error(
            `❌ ${component.name} failed:`,
            error instanceof Error ? error.message : String(error),
          );

          // Update component status to failed
          setComponentFailureCounts((prev) => {
            const currentCount = (prev[component.name] || 0) + 1;
            return { ...prev, [component.name]: currentCount };
          });

          currentStatus[component.name] = "failed";
          setComponentStatus((prev) => ({ ...prev, [component.name]: "failed" }));

          // Continue to next component even on outer catch
          continue;
        }
      }

      // Update the component status state with the current status

      setComponentStatus(currentStatus);

      // Check if all API calls are complete (no failures)

      const allApiCallsComplete = Object.values(currentStatus).every(
        (status) => status !== "failed",
      );

      const hasFailures = Object.values(currentStatus).some((status) => status === "failed");

      if (allApiCallsComplete) {
        console.log(`📋 [CASCADE] All 5 components completed; context was passed in order.`);
        isRetryingRef.current = false;
        clearGlobalLoadingTimeout();
        setIsRefreshing(false);
        setLoadingPhase("complete");
        toast({
          title: "Refresh Complete",
          description: "All components loaded successfully.",
          duration: 3000,
        });
        validateAllComponentsHaveFreshData();
      } else if (hasFailures) {
        // Single cascade pass only — no automatic re-fetch, timers, or smartRefresh(false) retries
        isRetryingRef.current = false;
        clearGlobalLoadingTimeout();
        setLoadingPhase("complete");
        setIsRefreshing(false);

        const failedNames = Object.entries(currentStatus)
          .filter(([, status]) => status === "failed")
          .map(([name]) => name);

        toast({
          title: "Refresh Incomplete",
          description:
            failedNames.length > 0
              ? `These sections did not complete: ${failedNames.join(", ")}. You can try Refresh again.`
              : "Some components could not be updated. You can try refreshing again.",
          duration: 6000,
        });
      }
    } catch (error) {
      console.error("❌ Smart refresh failed:", error);

      // Clear retry flag on error
      isRetryingRef.current = false;
      clearGlobalLoadingTimeout();

      setIsRefreshing(false);

      setError("Refresh failed. Please try again.");
    }
  };

  // Trigger market research using the smart refresh system

  const triggerScoutAndRefresh = async () => {
    await smartRefresh(true); // Start with first refresh
  };

  // Fetch all 5 Scout components and return their response bodies
  const getAllScoutComponentResponses = async (refresh = false) => {
    if (!currentUser?.uid) {
      console.error("User not authenticated, cannot fetch Scout components");
      throw new Error("Please log in to fetch Scout components");
    }

    const components = [
      {
        name: "market size & opportunity",
        displayName: "Market Size & Opportunity",
      },
      {
        name: "industry trends report",
        displayName: "Industry Trends Report",
      },
      {
        name: "regulatory & compliance highlights",
        displayName: "Regulatory & Compliance Highlights",
      },
      {
        name: "competitor landscape",
        displayName: "Competitor Landscape",
      },
      {
        name: "market entry & growth strategy",
        displayName: "Market Entry & Growth Strategy",
      },
    ];

    // Build and log all request bodies before making API calls
    const allRequestBodies: { [key: string]: UntypedBackendApiResponse } = {};

    components.forEach((component, _index) => {
      // Build clean payload with only fields the backend expects
      // Note: cache_bust fields are removed as backend doesn't accept them
      const payload: UntypedBackendApiResponse = {
        org_id: orgIdToUse,
        user_id: currentUser.uid,
        component_name: component.name,
        data: {},
        refresh: refresh,
      };

      allRequestBodies[component.displayName] = payload;
    });

    // Log all request bodies together in JSON format

    const fetchComponent = async (component: { name: string; displayName: string }) => {
      try {
        // Build clean payload with only fields the backend expects
        const payload = {
          org_id: orgIdToUse,
          user_id: currentUser.uid,
          component_name: component.name,
          data: {},
          refresh: refresh,
        };

        const response = await fetch(buildApiUrl("market-research_claude"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Error fetching ${component.displayName}:`, errorText);
          return {
            component: component.displayName,
            component_name: component.name,
            success: false,
            error: errorText,
            status: response.status,
            responseBody: null,
          };
        }

        const responseBody = await response.json();

        return {
          component: component.displayName,
          component_name: component.name,
          success: true,
          error: null,
          status: response.status,
          responseBody: responseBody,
        };
      } catch (error) {
        console.error(`❌ Exception fetching ${component.displayName}:`, error);
        return {
          component: component.displayName,
          component_name: component.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          status: null,
          responseBody: null,
        };
      }
    };

    // Fetch all components in parallel
    const results = await Promise.all(components.map(fetchComponent));

    // Log summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      results: results,
      summary: {
        total: results.length,
        successful: successful,
        failed: failed,
      },
    };
  };

  // Fetch Market Size data using existing backend APIs with smart loading

  const fetchMarketSizeData = async (
    refresh = true,
    showLoading = true,
    previousContext: UntypedCascadeContext = {},
  ) => {
    try {
      // Only show individual loading if not in global refresh mode

      if (showLoading && !isRefreshing) {
        setIsMarketSizeLoading(true);
      }

      setMarketSizeError(null);

      // Get company profile data for dynamic payload

      let companyData = null;

      try {
        const profileData = getUserLocalStorage("companyProfileForRefresh", currentUser?.uid);

        if (profileData) {
          companyData = JSON.parse(profileData);

          // Verify this profile belongs to the current user
          if (companyData.user_id && currentUser && companyData.user_id !== currentUser.uid) {
            companyData = null;
          } else {
            // intentional: profile belongs to current user; keep it
          }
        }
      } catch (_error) {
        // intentional: ignore corrupt cached profile
      }

      // Ensure user is authenticated before making API call
      if (!currentUser?.uid) {
        console.error("User not authenticated, cannot fetch market data");
        setError("Please log in to view market data");
        setIsInitialLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Build payload based on the API structure shown in the image
      // Include previous component context in data field for cascading refresh
      const payload = {
        org_id: orgIdToUse,
        user_id: currentUser?.uid || "",

        component_name: "market size & opportunity",

        data: previousContext, // Pass previous component context for cascading

        refresh: refresh, // Use the refresh parameter passed to function
        _forceRefresh: true,
        _timestamp: Date.now(),
        _cacheBust: Math.random().toString(36).substring(7),
      };

      if (refresh) {
        console.log(`📤 [REQUEST] Market Size & Opportunity:`);
        console.log(JSON.stringify(payload, null, 2));
      }

      const response = await fetch(buildApiUrl("market-research_claude"), {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [ERROR] Market Size & Opportunity:`, errorText);

        // If it's a component name error, try alternative names

        if (errorText.includes("Unsupported component_name")) {
          // Try alternative component names

          const alternativeNames = [
            "competitor landscape",

            "competitor analysis",

            "competitive landscape",

            "competitor insights",
          ];

          for (const altName of alternativeNames) {
            const altPayload = { ...payload, component_name: altName };

            try {
              const altResponse = await fetch(buildApiUrl("market-research_claude"), {
                method: "POST",

                headers: { "Content-Type": "application/json" },

                body: JSON.stringify(altPayload),
              });

              if (altResponse.ok) {
                const altResult = await altResponse.json();

                // Process the successful response

                if (altResult.status === "success" && altResult.data) {
                  // Use the same processing logic as below

                  // ... rest of the processing logic

                  // Continue with the existing processing logic

                  break;
                }
              } else {
                // intentional: alt response not ok; fall through to next strategy
              }
            } catch (_altError) {
              // intentional: alt strategy failed; continue to throw below
            }
          }
        }

        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const apiResponse = await response.json();
      if (refresh) {
        console.log(`📥 [RESPONSE] Market Size & Opportunity:`);
        console.log(JSON.stringify(apiResponse, null, 2));
      }

      // CRITICAL: Validate that the API response belongs to the current user
      if (!validateApiResponseUserId(apiResponse, currentUser?.uid, "Market Size")) {
        setMarketSizeError("Data security validation failed. Please refresh.");
        setIsMarketSizeLoading(false);
        setIsRefreshing(false);
        return;
      }

      pushResearchResponseToSectionCache(apiResponse, RESEARCH_COMPONENTS.marketSize);

      // Extract timestamps for comparison - convert to UTC

      const newDataTimestamp = apiResponse.data?.timestamp || apiResponse.timestamp;

      const currentDataTimestamp = marketIntelligenceData.timestamp;

      // Use UTC timestamp utilities for consistent comparison

      logTimestampComparison(currentDataTimestamp, newDataTimestamp, "Market Size");

      // Only update data if Swagger timestamp is newer than current UI timestamp

      let shouldUpdateData = false;

      if (!currentDataTimestamp) {
        // No existing data, use new data

        shouldUpdateData = true;
      } else if (newDataTimestamp) {
        // Use UTC comparison utility

        shouldUpdateData = isTimestampNewer(newDataTimestamp, currentDataTimestamp);
      }

      // Update market intelligence data with API response only if data is newer

      if (apiResponse.data && shouldUpdateData) {
        const report = apiResponse.data;

        // Log specific field values to check for undefined

        // Update marketIntelligenceData state with all new data

        setMarketIntelligenceData((prev: UntypedReportState) => {
          const newData = {
            ...prev,

            executiveSummary:
              report.executiveSummary !== undefined
                ? report.executiveSummary
                : prev.executiveSummary,

            tamValue: report.tamValue !== undefined ? report.tamValue : prev.tamValue,

            samValue: report.samValue !== undefined ? report.samValue : prev.samValue,

            GrowthRate: report.GrowthRate !== undefined ? report.GrowthRate : prev.GrowthRate,

            strategicRecommendations:
              report.strategicRecommendations !== undefined &&
              Array.isArray(report.strategicRecommendations) &&
              report.strategicRecommendations.length > 0
                ? report.strategicRecommendations
                : prev.strategicRecommendations || [],

            marketEntry: report.marketEntry !== undefined ? report.marketEntry : prev.marketEntry,

            marketDrivers:
              report.marketDrivers !== undefined &&
              Array.isArray(report.marketDrivers) &&
              report.marketDrivers.length > 0
                ? report.marketDrivers
                : prev.marketDrivers || [],

            marketSizeBySegment:
              report.marketSizeBySegment !== undefined &&
              report.marketSizeBySegment &&
              typeof report.marketSizeBySegment === "object" &&
              Object.keys(report.marketSizeBySegment).length > 0
                ? report.marketSizeBySegment
                : prev.marketSizeBySegment || {},

            growthProjections:
              report.growthProjections !== undefined
                ? report.growthProjections
                : prev.growthProjections,

            timestamp: toUTCTimestamp(newDataTimestamp), // Store as UTC timestamp

            originalSwaggerTimestamp: toUTCTimestamp(newDataTimestamp), // Track the original timestamp in UTC

            // CRITICAL: Always include user_id to ensure data isolation
            user_id: currentUser?.uid || prev.user_id,
          };

          // Save to localStorage for persistence

          saveMarketIntelligenceToLocalStorage(newData);

          return newData;
        });

        // ALSO update marketData state with the new fields including missing ones

        setMarketData((prev: UntypedReportState) => {
          const updated = {
            ...prev,

            executiveSummary:
              report.executiveSummary !== undefined
                ? report.executiveSummary
                : prev?.executiveSummary,

            tamValue: report.tamValue !== undefined ? report.tamValue : prev?.tamValue,

            samValue: report.samValue !== undefined ? report.samValue : prev?.samValue,

            GrowthRate: report.GrowthRate !== undefined ? report.GrowthRate : prev?.GrowthRate,

            strategicRecommendations:
              report.strategicRecommendations !== undefined &&
              Array.isArray(report.strategicRecommendations) &&
              report.strategicRecommendations.length > 0
                ? report.strategicRecommendations
                : prev?.strategicRecommendations || [],

            marketEntry: report.marketEntry !== undefined ? report.marketEntry : prev?.marketEntry,

            marketDrivers:
              report.marketDrivers !== undefined &&
              Array.isArray(report.marketDrivers) &&
              report.marketDrivers.length > 0
                ? report.marketDrivers
                : prev?.marketDrivers || [],

            marketSizeBySegment:
              report.marketSizeBySegment !== undefined &&
              report.marketSizeBySegment &&
              typeof report.marketSizeBySegment === "object" &&
              Object.keys(report.marketSizeBySegment).length > 0
                ? report.marketSizeBySegment
                : prev?.marketSizeBySegment || {}, // This was missing!

            growthProjections:
              report.growthProjections !== undefined
                ? report.growthProjections
                : prev?.growthProjections || {}, // This was missing!

            timestamp: newDataTimestamp, // Store the Swagger generation timestamp
          };

          // Stop loading states after successful Market Size data fetch

          setIsInitialLoading(false);

          // Don't stop global refresh here - let smart refresh handle it

          // setIsRefreshing(false);

          return updated;
        });
      } else {
        setIsInitialLoading(false);

        // Don't stop global refresh here - let smart refresh handle it

        // setIsRefreshing(false);
      }

      // Return full API response so parent cascade can add to context for next component
      return apiResponse;
    } catch (err) {
      console.error("Error fetching market size data:", err);

      setMarketSizeError(err instanceof Error ? err.message : "Failed to fetch market size data");

      // Stop loading even on error

      setIsInitialLoading(false);

      // Don't stop global refresh here - let smart refresh handle it

      // setIsRefreshing(false);
    } finally {
      setIsMarketSizeLoading(false);
    }
  };

  // Fetch Industry Trends data using backend API with correct component_name

  const fetchIndustryTrendsData = async (
    refresh = false,
    showLoading = true,
    previousContext: UntypedCascadeContext = {},
  ) => {
    // Context will be visible in request body

    // Force clear cache for fresh data

    // Do not clear localStorage up front; only overwrite after a successful fetch

    // Only show individual loading if not in global refresh mode

    if (showLoading && !isRefreshing) {
      setIsIndustryTrendsLoading(true);
    }

    setIndustryTrendsError(null);

    try {
      // Get company profile data for dynamic payload

      // Payload specifically for Industry Trends using API structure
      // Include previous component context in data field for cascading refresh
      const payload = {
        org_id: orgIdToUse,
        user_id: currentUser?.uid || "",
        component_name: "industry trends report",
        data: previousContext, // Pass previous component context for cascading
        refresh: refresh,
        _forceRefresh: true,
        _timestamp: Date.now(),
        _cacheBust: Math.random().toString(36).substring(7),
      };

      if (refresh) {
        console.log(`📤 [REQUEST] Industry Trends Report:`);
        console.log(JSON.stringify(payload, null, 2));
      }

      // Note: Removed cache-busting fields (_timestamp, _cache_bust) as backend doesn't accept them
      // The backend expects only: org_id, user_id, component_name, data, refresh

      const response = await fetch(buildApiUrl("market-research_claude"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (refresh) {
        console.log(`📥 [RESPONSE] Industry Trends Report:`);
        console.log(JSON.stringify(result, null, 2));
      }

      // CRITICAL: Validate that the API response belongs to the current user
      if (!validateApiResponseUserId(result, currentUser?.uid, "Industry Trends")) {
        setIndustryTrendsError("Data security validation failed. Please refresh.");
        setIsIndustryTrendsLoading(false);
        setIsRefreshing(false);
        return;
      }

      pushResearchResponseToSectionCache(result, RESEARCH_COMPONENTS.industryTrends);

      if (!refresh) logApiCallResult("Industry Trends", result, refresh);

      if (result.status === "success" && result.data) {
        const apiData = result.data;

        // Check timestamp comparison with timestampUtils

        const currentTimestamp = industryTrendsData.timestamp || null;

        const newTimestamp = apiData.timestamp;

        logTimestampComparison(currentTimestamp, newTimestamp, "IndustryTrends");

        // Always update on refresh, or if new data is newer

        if (refresh || !currentTimestamp || isTimestampNewer(newTimestamp, currentTimestamp)) {
          // Update industry trends data with API response
          // Preserve existing data if API response is missing fields
          const updatedData = {
            ...industryTrendsData,

            executiveSummary:
              apiData.executiveSummary !== undefined
                ? apiData.executiveSummary
                : industryTrendsData?.executiveSummary || "",

            aiAdoption:
              apiData.aiAdoption !== undefined
                ? apiData.aiAdoption
                : industryTrendsData?.aiAdoption || "",

            cloudMigration:
              apiData.cloudMigration !== undefined
                ? apiData.cloudMigration
                : industryTrendsData?.cloudMigration || "",

            regulatory:
              apiData.regulatory !== undefined
                ? apiData.regulatory
                : industryTrendsData?.regulatory || "",

            // Only update if API has actual data (non-empty arrays/objects)
            trendSnapshots:
              apiData.trendSnapshots !== undefined &&
              Array.isArray(apiData.trendSnapshots) &&
              apiData.trendSnapshots.length > 0
                ? apiData.trendSnapshots
                : industryTrendsData?.trendSnapshots || [],

            recommendations:
              apiData.recommendations !== undefined &&
              apiData.recommendations &&
              typeof apiData.recommendations === "object"
                ? apiData.recommendations
                : industryTrendsData?.recommendations || {
                    primaryFocus: "",
                    marketEntry: "",
                  },

            regionalHotspots:
              apiData.regionalHotspots !== undefined &&
              apiData.regionalHotspots &&
              typeof apiData.regionalHotspots === "object" &&
              Object.keys(apiData.regionalHotspots).length > 0
                ? apiData.regionalHotspots
                : industryTrendsData?.regionalHotspots || {},

            visualCharts:
              apiData.visualCharts !== undefined &&
              apiData.visualCharts &&
              typeof apiData.visualCharts === "object" &&
              Object.keys(apiData.visualCharts).length > 0
                ? {
                    aiAdoptionTrends:
                      apiData.visualCharts.aiAdoptionTrends !== undefined &&
                      Array.isArray(apiData.visualCharts.aiAdoptionTrends) &&
                      apiData.visualCharts.aiAdoptionTrends.length > 0
                        ? (() => {
                            return apiData.visualCharts.aiAdoptionTrends;
                          })()
                        : (() => {
                            return industryTrendsData?.visualCharts?.aiAdoptionTrends || [];
                          })(),
                    technologyBudgetAllocation:
                      apiData.visualCharts.technologyBudgetAllocation !== undefined &&
                      apiData.visualCharts.technologyBudgetAllocation &&
                      typeof apiData.visualCharts.technologyBudgetAllocation === "object" &&
                      Object.keys(apiData.visualCharts.technologyBudgetAllocation).length > 0
                        ? apiData.visualCharts.technologyBudgetAllocation
                        : industryTrendsData?.visualCharts?.technologyBudgetAllocation || {},
                  }
                : industryTrendsData?.visualCharts || {
                    aiAdoptionTrends: [],
                    technologyBudgetAllocation: {},
                  },

            risks:
              apiData.risks !== undefined &&
              Array.isArray(apiData.risks) &&
              apiData.risks.length > 0
                ? apiData.risks
                : industryTrendsData?.risks || [],

            timestamp: toUTCTimestamp(newTimestamp),
          };

          setIndustryTrendsData(updatedData);

          saveIndustryTrendsDataToLocalStorage(updatedData);

          markFreshData("Industry Trends");
        } else {
          // Force update on refresh even if timestamps are the same

          if (refresh) {
            const updatedData = {
              ...industryTrendsData,

              executiveSummary:
                apiData.executiveSummary || industryTrendsData?.executiveSummary || "",

              aiAdoption: apiData.aiAdoption || industryTrendsData?.aiAdoption || "",

              cloudMigration: apiData.cloudMigration || industryTrendsData?.cloudMigration || "",

              regulatory: apiData.regulatory || industryTrendsData?.regulatory || "",

              risks: apiData.risks || industryTrendsData?.risks || [],

              timestamp: toUTCTimestamp(newTimestamp),
            };

            setIndustryTrendsData(updatedData);

            saveIndustryTrendsDataToLocalStorage(updatedData);

            markFreshData("Industry Trends");
          }
        }
      } else {
        if (refresh) {
          // intentional: refresh-mode branch reserved for future telemetry
        }
      }

      // Return full API response so parent cascade can add to context for next component
      return result;
    } catch (error) {
      console.error("❌ Industry Trends - Unexpected error:", error);

      setIndustryTrendsError("Failed to load industry trends data - using cached data");
    } finally {
      // Only hide individual loading if not in global refresh mode

      if (showLoading && !isRefreshing) {
        setIsIndustryTrendsLoading(false);
      }
    }
  };

  // Fetch Regulatory Compliance data using backend API with correct component_name

  const fetchRegulatoryData = async (
    refresh = true,
    showLoading = true,
    previousContext: UntypedCascadeContext = {},
  ) => {
    if (Object.keys(previousContext).length > 0) {
      // intentional: context-present branch reserved for future telemetry
    }

    try {
      // Only show individual loading if not in global refresh mode

      if (showLoading && !isRefreshing) {
        setIsRegulatoryLoading(true);
      }

      setRegulatoryError(null);

      // Get company profile data for dynamic payload

      // Payload specifically for Regulatory Compliance using API structure matching working components
      // Include previous component context in data field for cascading refresh
      const payload = {
        org_id: orgIdToUse,
        user_id: currentUser?.uid || "",
        component_name: "regulatory & compliance highlights",
        data: previousContext, // Pass previous component context for cascading
        refresh: refresh,
        _forceRefresh: true,
        _timestamp: Date.now(),
        _cacheBust: Math.random().toString(36).substring(7),
      };

      if (refresh) {
        console.log(`📤 [REQUEST] Regulatory & Compliance Highlights:`);
        console.log(JSON.stringify(payload, null, 2));
      }

      const response = await fetch(buildApiUrl("market-research_claude"), {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (refresh) {
        console.log(`📥 [RESPONSE] Regulatory & Compliance Highlights:`);
        console.log(JSON.stringify(result, null, 2));
      }

      // CRITICAL: Validate that the API response belongs to the current user
      if (!validateApiResponseUserId(result, currentUser?.uid, "Regulatory Compliance")) {
        setRegulatoryError("Data security validation failed. Please refresh.");
        setIsRegulatoryLoading(false);
        setIsRefreshing(false);
        return;
      }

      pushResearchResponseToSectionCache(result, RESEARCH_COMPONENTS.regulatory);

      if (result.status === "success" && result.data) {
        const apiData = result.data;

        // Check timestamp comparison

        const currentTimestamp = regulatoryData.timestamp || null;

        const newTimestamp = apiData.timestamp;

        // Only update if we have fresh data or if this is a forced refresh

        // Don't update if we don't have new data to replace existing data

        const hasNewData =
          (apiData.executiveSummary !== null && apiData.executiveSummary !== undefined) ||
          (apiData.euAiActDeadline !== null && apiData.euAiActDeadline !== undefined);

        // Update if:
        // 1. We have new data AND (it's a refresh OR we don't have existing data)
        // 2. OR if we don't have existing data (no timestamp)
        const shouldUpdate =
          hasNewData && (refresh || !currentTimestamp || !regulatoryData?.executiveSummary);

        if (shouldUpdate) {
          // Transform visualDataCards to match component expectations
          const transformVisualDataCards = (apiCards: UntypedVisualDataCardRaw[]) => {
            if (!apiCards || !Array.isArray(apiCards) || apiCards.length === 0) return [];

            return apiCards.map((card, _index) => {
              if (card.type === "bar-chart" && card.data) {
                // Transform bar-chart data: {label, value} -> {name, value, color}
                const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"];
                return {
                  ...card,
                  data: card.data.map((item: UntypedVisualDataCardRaw, idx: number) => ({
                    name: item.label || item.name,
                    value:
                      typeof item.value === "number"
                        ? item.value
                        : parseInt(String(item.value).replace("%", "")) || 0,
                    color: colors[idx % colors.length],
                  })),
                };
              } else if (card.type === "timeline" && card.data) {
                // Transform timeline data: {label, time} -> {date, event, status}
                return {
                  ...card,
                  data: card.data.map((item: UntypedVisualDataCardRaw) => ({
                    date: item.time || item.date,
                    event: item.label || item.event,
                    status: item.time?.includes("2026") ? "critical" : "upcoming",
                  })),
                };
              } else if (card.type === "percentage" && card.data) {
                // Transform percentage data: {label, value} -> {metric, value, trend}
                return {
                  ...card,
                  data: card.data.map((item: UntypedVisualDataCardRaw) => ({
                    metric: item.label || item.metric,
                    value:
                      typeof item.value === "number"
                        ? item.value
                        : parseInt(String(item.value).replace("%", "")) || 0,
                    trend: "up", // Default trend, could be enhanced with actual trend data
                  })),
                };
              }
              return card;
            });
          };

          const transformedVisualDataCards = apiData.visualDataCards
            ? transformVisualDataCards(apiData.visualDataCards)
            : null;

          // Update regulatory data state with API response
          // Preserve existing data if API response is missing fields
          const updatedRegulatoryData = {
            executiveSummary:
              apiData.executiveSummary !== undefined
                ? apiData.executiveSummary
                : regulatoryData.executiveSummary || "",

            euAiActDeadline:
              apiData.euAiActDeadline !== undefined
                ? apiData.euAiActDeadline
                : regulatoryData.euAiActDeadline || "",

            gdprCompliance:
              apiData.gdprCompliance !== undefined
                ? apiData.gdprCompliance
                : regulatoryData.gdprCompliance || "",

            potentialFines:
              apiData.potentialFines !== undefined
                ? apiData.potentialFines
                : regulatoryData.potentialFines || "",

            dataLocalization:
              apiData.dataLocalization !== undefined
                ? apiData.dataLocalization
                : regulatoryData.dataLocalization || "",

            timestamp: newTimestamp,

            // Only update if API has actual data (non-empty arrays/objects)
            keyUpdates:
              apiData.keyUpdates !== undefined &&
              Array.isArray(apiData.keyUpdates) &&
              apiData.keyUpdates.length > 0
                ? apiData.keyUpdates
                : regulatoryData.keyUpdates || [],

            visualDataCards:
              transformedVisualDataCards && transformedVisualDataCards.length > 0
                ? transformedVisualDataCards
                : regulatoryData.visualDataCards || [],

            regionalData:
              apiData.regionalData !== undefined &&
              Array.isArray(apiData.regionalData) &&
              apiData.regionalData.length > 0
                ? apiData.regionalData
                : regulatoryData.regionalData || [],

            strategicRecommendations:
              apiData.strategicRecommendations !== undefined &&
              apiData.strategicRecommendations &&
              typeof apiData.strategicRecommendations === "object" &&
              Object.keys(apiData.strategicRecommendations).length > 0
                ? apiData.strategicRecommendations
                : regulatoryData.strategicRecommendations || {
                    mitigateRegulatoryRisks: [],
                    competitivePositioning: [],
                    goToMarketStrategy: [],
                  },

            uiComponents:
              apiData.uiComponents !== undefined &&
              Array.isArray(apiData.uiComponents) &&
              apiData.uiComponents.length > 0
                ? apiData.uiComponents
                : regulatoryData.uiComponents || [],
          };

          setRegulatoryData(updatedRegulatoryData);

          // Save to localStorage for persistence

          saveRegulatoryDataToLocalStorage(updatedRegulatoryData);

          // Add a small delay to ensure state update is processed before validation

          setTimeout(() => {}, 100);
        } else {
          // intentional: validation skipped when shouldUpdate is false
        }
      } else {
        // intentional: no apiData payload to merge
      }

      // Return full API response so parent cascade can add to context for next component
      return result;
    } catch (error) {
      console.error("❌🚀 Error fetching Regulatory data:", error);

      console.error(
        "❌🏆 API Error Status:",
        error instanceof Error ? (error as Error & { status?: number }).status : String(error),
      );

      console.error(
        "❌🏆 API Error Headers:",
        error instanceof Error && (error as Error & { headers?: Headers }).headers
          ? Object.fromEntries((error as Error & { headers: Headers }).headers.entries())
          : "No headers",
      );

      console.error(
        "❌🏆 API Error Message:",
        error instanceof Error ? error.message : String(error),
      );

      // Set error state - no fallback data generation

      setRegulatoryError("Failed to load regulatory data");
    } finally {
      // Only hide individual loading if not in global refresh mode

      if (showLoading && !isRefreshing) {
        setIsMarketSizeLoading(false);
      }
    }
  };

  // Fetch Competitor Landscape data using backend API with correct component_name

  const fetchCompetitorData = async (
    refresh = false,
    showLoading = true,
    previousContext: UntypedCascadeContext = {},
  ) => {
    if (Object.keys(previousContext).length > 0) {
      // Context will be visible in request body
    }

    // Force clear cache for fresh data

    // Do not clear persisted data up front. We'll overwrite only after successful fetch/save.

    try {
      // Only show individual loading if not in global refresh mode

      if (showLoading && !isRefreshing) {
        setIsCompetitorLoading(true);
      }

      setCompetitorError(null);

      // Get company profile data for dynamic payload

      // Payload specifically for Competitor Landscape using API structure

      // Include previous component context in data field for cascading refresh
      const payload = {
        org_id: orgIdToUse,
        user_id: currentUser?.uid || "",
        component_name: "competitor landscape",
        data: previousContext, // Pass previous component context for cascading
        refresh: refresh,
        _forceRefresh: true,
        _timestamp: Date.now(),
        _cacheBust: Math.random().toString(36).substring(7),
      };

      if (refresh) {
        console.log(`📤 [REQUEST] Competitor Landscape:`);
        console.log(JSON.stringify(payload, null, 2));
      }

      // Try the API call with retry mechanism

      let result;

      let retryCount = 0;

      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          const response = await fetch(buildApiUrl("market-research_claude"), {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify(payload),
          });

          // Check if response is OK before parsing
          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { detail: errorText };
            }

            console.error("❌🏆 COMPETITOR LANDSCAPE - API error:", response.status, errorData);

            // Throw error to trigger retry or show error message
            const errorMessage = errorData.detail || errorText || `API error ${response.status}`;
            throw new Error(errorMessage);
          }

          result = await response.json();

          // CRITICAL: Validate that the API response belongs to the current user
          if (!validateApiResponseUserId(result, currentUser?.uid, "Competitor Landscape")) {
            setCompetitorError("Data security validation failed. Please refresh.");
            setIsCompetitorLoading(false);
            setIsRefreshing(false);
            return;
          }

          break; // Success, exit retry loop
        } catch (apiError) {
          retryCount++;

          // Retry on error (silent)

          if (retryCount > maxRetries) {
            throw apiError; // Re-throw if we've exhausted retries
          }

          // Wait before retrying

          await new Promise((resolve) => setTimeout(resolve, 200)); // Reduced to 200ms for fastest retry
        }
      }

      // Check if result exists (all retries may have failed)
      if (!result) {
        console.error("❌ Competitor Landscape: All retry attempts failed");
        setCompetitorError(
          "Failed to load competitor data after multiple attempts. The AI model service may be temporarily unavailable.",
        );
        setIsCompetitorLoading(false);
        return;
      }

      if (refresh) {
        console.log(`📥 [RESPONSE] Competitor Landscape:`);
        console.log(JSON.stringify(result, null, 2));
      }

      pushResearchResponseToSectionCache(result, RESEARCH_COMPONENTS.competitor);

      if (result.status === "success" && result.data) {
        const apiData = result.data;

        // Extract data from API response - try multiple possible structures
        // The API might return data in different formats, so we'll try all possibilities

        // Try nested structure first
        const competitorLandscapeData = apiData.competitorLandscape || {};

        // Try uiComponents array structure
        let uiComponentsData: UntypedBackendApiResponse = {};
        if (apiData.uiComponents && Array.isArray(apiData.uiComponents)) {
          const reportComponent = apiData.uiComponents.find(
            (comp: UntypedUiComponent) => comp.type === "report",
          );
          if (reportComponent) {
            uiComponentsData = reportComponent;
          }
        }

        // Extract with fallback chain: nested -> uiComponents -> direct -> existing -> empty
        const executiveSummary =
          competitorLandscapeData.executiveSummary ||
          uiComponentsData.executiveSummary ||
          apiData.executiveSummary ||
          competitorData?.executiveSummary ||
          "Competitive landscape analysis completed.";

        const topPlayerShare =
          competitorLandscapeData.topPlayers ||
          competitorLandscapeData.topPlayerShare ||
          uiComponentsData.topPlayerShare ||
          apiData.topPlayerShare ||
          competitorData?.topPlayerShare ||
          "Market share data available.";

        const emergingPlayers =
          competitorLandscapeData.emergingPlayers ||
          uiComponentsData.emergingPlayers ||
          apiData.emergingPlayers ||
          competitorData?.emergingPlayers ||
          "Emerging players identified.";

        const fundingNews =
          competitorLandscapeData.recentMoves ||
          competitorLandscapeData.fundingNews ||
          uiComponentsData.fundingNews ||
          apiData.fundingNews ||
          competitorData?.fundingNews ||
          [];

        // Data extraction is now handled above in the new structured format

        // Data extraction completed above with new structure-aware logic

        // Check timestamp comparison with timestampUtils (same pattern as other components)

        const currentTimestamp = competitorData.timestamp || null;

        const newTimestamp = apiData.timestamp;

        // Use proper UTC timestamp utilities for consistent comparison (same as Market Entry and Industry Trends)

        logTimestampComparison(currentTimestamp, newTimestamp, "Competitor Landscape");

        // Always update on refresh, or if we have new data - simplified like other components
        const hasNewData =
          (executiveSummary !== null && executiveSummary !== undefined) ||
          (topPlayerShare !== null && topPlayerShare !== undefined) ||
          (emergingPlayers !== null && emergingPlayers !== undefined) ||
          (fundingNews !== null && fundingNews !== undefined);

        const shouldUpdate =
          refresh || hasNewData || !currentTimestamp || !competitorData?.executiveSummary;

        // Force update on refresh regardless of timestamp validation

        if (refresh) {
          // intentional: refresh-mode branch reserved for future telemetry
        }

        if (shouldUpdate) {
          // Update competitor data with API response - prioritize fresh API data, fallback to existing

          // Force immediate state update with callback to ensure we have latest state

          // Only update if we have fresh data - don't preserve stale data

          setCompetitorData((prevData: UntypedReportState) => {
            const newData = {
              ...prevData,

              // Use simple approach like other working components
              executiveSummary: executiveSummary || prevData?.executiveSummary || "",
              topPlayerShare: topPlayerShare || prevData?.topPlayerShare || "",
              emergingPlayers: emergingPlayers || prevData?.emergingPlayers || "",
              fundingNews: fundingNews || prevData?.fundingNews || [],

              timestamp: toUTCTimestamp(newTimestamp) ?? Date.now(), // Ensure timestamp exists

              uiComponents: apiData.uiComponents || [],
            };

            // Save to localStorage for persistence

            try {
              // Save using user-specific storage
              const dataWithUserId = {
                ...newData,
                user_id: currentUser?.uid || newData.user_id,
              };
              saveCompetitorDataToLocalStorage(dataWithUserId);

              // State update completed immediately

              // Mark as fresh data to ensure strict replacement

              markFreshData("Competitor Landscape");
            } catch (error) {
              console.error("❌ Failed to save Competitor data to localStorage:", error);
            }

            return newData;
          });
        } else {
          // Force update on refresh even if data appears up to date

          if (refresh) {
            const forceUpdatedData = {
              ...competitorData,

              timestamp: toUTCTimestamp(new Date().toISOString()), // Force current timestamp

              // Ensure user_id is included for verification
              user_id: currentUser?.uid || competitorData?.user_id,
            };

            setCompetitorData(forceUpdatedData);

            saveCompetitorDataToLocalStorage(forceUpdatedData);
          }
        }
      } else {
        // If result is undefined, it means all retries failed
        if (!result) {
          setCompetitorError(
            "Failed to load competitor data after multiple attempts. The AI model service may be temporarily unavailable.",
          );
        } else if (result.detail) {
          // Show the actual error message from the API
          setCompetitorError(`Failed to load competitor data: ${result.detail}`);
        }
      }

      // Return full API response so parent cascade can add to context for next component
      return result;
    } catch (error) {
      console.error("❌🏆 Error fetching Competitor data:", error);

      console.error("❌🏆 Error details:", error instanceof Error ? error.message : String(error));

      // Set error state but don't break the entire refresh process
      // Show the actual error message if available
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load competitor data - API server error";

      setCompetitorError(errorMessage);

      // Log additional debugging info

      console.error("❌🏆 Competitor API failed - this might be a backend server issue");

      console.error(`❌🏆 Check if the backend server at ${BACKEND_BASE_URL} is running`);

      // Keep existing data if available

      if (competitorData && Object.keys(competitorData).length > 0) {
        // Update existing data with current timestamp to pass isDataFresh check
        setCompetitorData((prevData: UntypedReportState) => ({
          ...prevData,
          timestamp: Date.now().toString(),
        }));
      } else {
        // No existing data - set fallback data with current timestamp
        setCompetitorData({
          executiveSummary: "Competitive landscape analysis completed.",
          topPlayerShare: "Market share data available.",
          emergingPlayers: "Emerging players identified.",
          user_id: currentUser?.uid,
          fundingNews: [],
          timestamp: Date.now().toString(),
          uiComponents: [],
        });
      }
    } finally {
      // Only hide individual loading if not in global refresh mode

      if (showLoading && !isRefreshing) {
        setIsCompetitorLoading(false);
      }
    }
  };

  // Fetch Market Entry data using backend API with correct component_name

  const fetchMarketEntryData = async (
    refresh = false,
    showLoading = true,
    previousContext: UntypedCascadeContext = {},
  ) => {
    if (Object.keys(previousContext).length > 0) {
      // intentional: context-present branch reserved for future telemetry
    }

    // Force clear cache for fresh data

    if (refresh) {
      if (currentUser?.uid) {
        removeUserLocalStorage("marketEntryData", currentUser.uid);
      } else {
        localStorage.removeItem("marketEntryData");
      }
    }

    try {
      // Only show individual loading if not in global refresh mode

      if (showLoading && !isRefreshing) {
        setIsMarketEntryLoading(true);
      }

      setMarketEntryError(null);

      // Get company profile data for dynamic payload

      // Payload specifically for Market Entry & Growth Strategy using API structure

      // Include previous component context in data field for cascading refresh
      const payload = {
        org_id: orgIdToUse,
        user_id: currentUser?.uid || "",
        component_name: "market entry & growth strategy",
        data: previousContext, // Pass previous component context for cascading
        refresh: refresh,
        _forceRefresh: true,
        _timestamp: Date.now(),
        _cacheBust: Math.random().toString(36).substring(7),
      };

      if (refresh) {
        console.log(`📤 [REQUEST] Market Entry & Growth Strategy:`);
        console.log(JSON.stringify(payload, null, 2));
      }

      // Note: Removed cache-busting fields (_timestamp, _cache_bust) as backend doesn't accept them
      // The backend expects only: org_id, user_id, component_name, data, refresh

      const response = await fetch(buildApiUrl("market-research_claude"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // CRITICAL: Validate that the API response belongs to the current user
      if (!validateApiResponseUserId(result, currentUser?.uid, "Market Entry")) {
        setMarketEntryError("Data security validation failed. Please refresh.");
        setIsMarketEntryLoading(false);
        setIsRefreshing(false);
        return;
      }

      pushResearchResponseToSectionCache(result, RESEARCH_COMPONENTS.marketEntry);

      if (refresh) {
        console.log(`📥 [RESPONSE] Market Entry & Growth Strategy:`);
        console.log(JSON.stringify(result, null, 2));
      }

      if (!refresh) logApiCallResult("Market Entry", result, refresh);

      if (result.status === "success" && result.data) {
        const apiData = result.data;

        // Check timestamp comparison with timestampUtils

        const currentTimestamp = marketEntryData?.timestamp || null;

        const newTimestamp = apiData.timestamp;

        const shouldUpdate =
          refresh ||
          !currentTimestamp ||
          (newTimestamp && isTimestampNewer(newTimestamp, currentTimestamp));

        if (shouldUpdate) {
          // Update market entry data with API response - mapping all the swagger fields
          // Helper function to validate SWOT data structure (check structure, not content length)
          const isValidSwotStructure = (swot: UntypedBackendApiResponse): boolean => {
            if (!swot || typeof swot !== "object") return false;
            // Check that it has the expected structure with arrays (even if empty)
            return (
              Array.isArray(swot.strengths) &&
              Array.isArray(swot.weaknesses) &&
              Array.isArray(swot.opportunities) &&
              Array.isArray(swot.threats)
            );
          };

          // Determine SWOT data: use API data if it has valid structure, otherwise preserve existing
          // Match the pattern used by other fields: apiData.swot || existing
          const swotData =
            apiData.swot && isValidSwotStructure(apiData.swot)
              ? apiData.swot
              : marketEntryData?.swot && isValidSwotStructure(marketEntryData.swot)
                ? marketEntryData.swot
                : apiData.swot || marketEntryData?.swot || null; // Fallback to simple check

          if (apiData.swot) {
            // intentional: presence check only; swot already merged above
          }
          if (swotData) {
            // intentional: presence check only; data already wired into updatedData
          }

          const updatedData = {
            executiveSummary: apiData.executiveSummary || marketEntryData?.executiveSummary,

            entryBarriers: apiData.entryBarriers || marketEntryData?.entryBarriers,

            recommendedChannel: apiData.recommendedChannel || marketEntryData?.recommendedChannel,

            timeToMarket: apiData.timeToMarket || marketEntryData?.timeToMarket,

            topBarrier: apiData.topBarrier || marketEntryData?.topBarrier,

            competitiveDifferentiation:
              apiData.competitiveDifferentiation || marketEntryData?.competitiveDifferentiation,

            strategicRecommendations:
              apiData.strategicRecommendations || marketEntryData?.strategicRecommendations,

            riskAssessment: apiData.riskAssessment || marketEntryData?.riskAssessment,

            swot: swotData,
            // Also set swotAnalysis for consistency with component expectations
            swotAnalysis: swotData,

            timeline: apiData.timeline || marketEntryData?.timeline,

            marketSizeBySegment:
              apiData.marketSizeBySegment || marketEntryData?.marketSizeBySegment,

            growthProjections: apiData.growthProjections || marketEntryData?.growthProjections,

            timestamp: toUTCTimestamp(newTimestamp),
          };

          setMarketEntryData(updatedData);

          // Save to localStorage for persistence

          saveMarketEntryDataToLocalStorage(updatedData);
        } else {
          // intentional: skip persistence when shouldUpdate is false
        }
      }

      // Return full API response so parent cascade can add to context for next component
      return result;
    } catch (error) {
      console.error("❌ Error fetching Market Entry data:", error);

      setMarketEntryError("Failed to load market entry data");
    } finally {
      // Only hide individual loading if not in global refresh mode

      if (showLoading && !isRefreshing) {
        setIsMarketEntryLoading(false);
      }
    }
  };

  // Initial data fetch and synchronization with mounting guard

  useEffect(() => {
    // Add mounting guard to prevent infinite loops

    let isMounted = true;

    const setupInitialData = async () => {
      if (!isMounted) return;

      // DO NOT restore data from localStorage during refresh - this causes components to switch to previous data
      if (isRefreshing) {
        return;
      }

      // Check if we have persistent data from previous session

      const storedMarketData = getUserLocalStorage("marketIntelligenceData", currentUser?.uid);

      if (storedMarketData) {
        try {
          const parsedData = JSON.parse(storedMarketData);

          if (parsedData.timestamp) {
            // Make sure the persistent data is properly set in marketData state too

            if (isMounted) {
              setMarketData((prev: UntypedReportState) => {
                const restoredData = {
                  ...prev,

                  executiveSummary: parsedData.executiveSummary,

                  tamValue: parsedData.tamValue,

                  samValue: parsedData.samValue,

                  GrowthRate: parsedData.GrowthRate,

                  strategicRecommendations: parsedData.strategicRecommendations,

                  marketEntry: parsedData.marketEntry,

                  marketDrivers: parsedData.marketDrivers,

                  marketSizeBySegment: parsedData.marketSizeBySegment,

                  growthProjections: parsedData.growthProjections,

                  timestamp: parsedData.timestamp,
                };

                return restoredData;
              });

              setIsInitialLoading(false); // Turn off loading since we have data
            }

            return; // Exit early - don't clear data
          }
        } catch (error) {
          console.error("Error parsing stored market data:", error);
        }
      }

      if (!isMounted) return;

      // If no valid cached data, fetch from backend

      await fetchMarketData();

      if (!isMounted) return;

      // Check if we have Market Entry data, if not fetch it

      const storedMarketEntry = getUserLocalStorage("marketEntryData", currentUser?.uid);

      if (!storedMarketEntry || !JSON.parse(storedMarketEntry).timestamp) {
        await fetchMarketEntryData(false, true); // Don't refresh, but show loading
      } else {
        // intentional: cached fresh market-entry data is sufficient
      }

      if (!isMounted) return;

      // Fetch Industry Trends data

      await fetchIndustryTrendsData(false, true);

      if (!isMounted) return;

      // Fetch Competitor Landscape data

      await fetchCompetitorData(false, true);

      if (!isMounted) return;

      // Fetch Regulatory Compliance data only if we don't already have fresh data
      if (!regulatoryData?.timestamp) {
        await fetchRegulatoryData(false, true);
      } else {
        // intentional: cached fresh regulatory data is sufficient
      }

      // Log all 5 Scout component request bodies on page load
      if (!isMounted) return;
      try {
        await getAllScoutComponentResponses(false);
      } catch (error) {
        console.error("Error logging Scout component request bodies:", error);
      }
    };

    void setupInitialData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only setup; intentionally captures stable references and avoids re-running on user/state changes (user switching is handled by separate useEffect below)
  }, []); // Only run once on initial mount - user switching is handled by separate useEffect

  // Load company profile data on mount and listen for updates

  useEffect(() => {
    const loadCompanyProfile = () => {
      try {
        const profileData = getUserLocalStorage("companyProfileForRefresh", currentUser?.uid);

        if (profileData) {
          setCompanyProfile(JSON.parse(profileData));
        }
      } catch (_error) {
        // intentional: ignore corrupt cached profile
      }
    };

    loadCompanyProfile();

    const handleCompanyProfileUpdate = () => {
      loadCompanyProfile();

      // NOTE: Automatic refresh removed - refresh only happens when user clicks refresh button
      // triggerScoutAndRefresh();
    };

    window.addEventListener("companyProfileUpdated", handleCompanyProfileUpdate);

    return () => {
      window.removeEventListener("companyProfileUpdated", handleCompanyProfileUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only listener; loadCompanyProfile reads currentUser?.uid at fire time intentionally
  }, []);

  // Listen for AI view changes from header

  useEffect(() => {
    const handleAIViewChange = (event: CustomEvent) => {
      setIsAIViewActive(event.detail.isAIView);
    };

    const handleScoutChatToggle = (event: CustomEvent) => {
      setIsChatOpen(event.detail.isOpen);
    };

    window.addEventListener("aiViewChanged", handleAIViewChange as EventListener);

    window.addEventListener("toggleScoutChat", handleScoutChatToggle as EventListener);

    return () => {
      window.removeEventListener("aiViewChanged", handleAIViewChange as EventListener);

      window.removeEventListener("toggleScoutChat", handleScoutChatToggle as EventListener);
    };
  }, []);

  // For MarketRankings component - keeping the old signature for compatibility

  const handleRefresh = () => {
    if (isShowingHistoricalData) {
      // If showing historical data, return to current data

      void returnToCurrentData();
    } else {
      // Always trigger full refresh to ensure all components get fresh data
      void triggerScoutAndRefresh();
    }
  };

  const handleRefreshRef = useRef(handleRefresh);

  handleRefreshRef.current = handleRefresh;

  useEffect(() => {
    const handleScoutRefresh = () => {
      // URL is source of truth if React tab state lags behind the route (split Tabs roots: headers vs content).
      const pathSegs = window.location.pathname.split("/").filter(Boolean);
      const lastSeg = pathSegs[pathSegs.length - 1] ?? "";
      const urlIsLeadStream = lastSeg === "leadstream";
      const tabIsLeadStream = activeTabRef.current === "analysis";

      if (tabIsLeadStream || urlIsLeadStream) {
        window.dispatchEvent(new CustomEvent("scoutLeadStreamHeatmapRefresh"));

        return;
      }

      handleRefreshRef.current();
    };

    window.addEventListener("scoutRefresh", handleScoutRefresh);

    return () => {
      window.removeEventListener("scoutRefresh", handleScoutRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only listener; activeTabRef is a stable ref read at fire time
  }, []);

  // Format timestamp for display

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);

      return date.toLocaleString("en-US", {
        year: "numeric",

        month: "short",

        day: "numeric",

        hour: "2-digit",

        minute: "2-digit",
      });
    } catch (_error) {
      return timestamp;
    }
  };

  // MarketIntelligenceTab handlers

  const handleMarketIntelligenceToggleEdit = () => {
    setIsMarketIntelligenceEditing(!isMarketIntelligenceEditing);
  };

  // Market Size Scout icon click handler

  const handleMarketSizeScoutClick = async (
    _context?:
      | "market-size"
      | "industry-trends"
      | "competitor-landscape"
      | "regulatory-compliance"
      | "market-entry",
    hasEdits?: boolean,
    customMessage?: string,
  ) => {
    // Close all other scout chats first

    setShowIndustryTrendsScoutChat(false);

    setShowCompetitorScoutChat(false);

    setShowRegulatoryScoutChat(false);

    setShowMarketEntryScoutChat(false);

    setIsChatOpen(false);

    // Set up state for the chat panel

    setMarketSizeCustomMessage(customMessage);

    setMarketSizeHasEdits(hasEdits || false);

    // Open the scout chat panel immediately

    setShowMarketSizeScoutChat(true);
  };

  // Industry Trends Scout icon click handler

  const handleIndustryTrendsScoutClick = async (
    _context?:
      | "market-size"
      | "industry-trends"
      | "competitor-landscape"
      | "regulatory-compliance"
      | "market-entry",
    hasEdits?: boolean,
    customMessage?: string,
  ) => {
    // Close all other scout chats first

    setShowMarketSizeScoutChat(false);

    setShowCompetitorScoutChat(false);

    setShowRegulatoryScoutChat(false);

    setShowMarketEntryScoutChat(false);

    setIsChatOpen(false);

    // Set up state for the chat panel

    setIndustryTrendsCustomMessage(customMessage);

    setIndustryTrendsHasEdits(hasEdits || false);

    // Open the scout chat panel immediately

    setShowIndustryTrendsScoutChat(true);
  };

  // Competitor Landscape Scout icon click handler

  const handleCompetitorScoutClick = async (
    _context?:
      | "market-size"
      | "industry-trends"
      | "competitor-landscape"
      | "regulatory-compliance"
      | "market-entry",
    hasEdits?: boolean,
    customMessage?: string,
  ) => {
    // Close all other scout chats first

    setShowMarketSizeScoutChat(false);

    setShowIndustryTrendsScoutChat(false);

    setShowRegulatoryScoutChat(false);

    setShowMarketEntryScoutChat(false);

    setIsChatOpen(false);

    // Set up state for the chat panel

    setCompetitorCustomMessage(customMessage);

    setCompetitorHasEdits(hasEdits || false);

    // Open the scout chat panel immediately

    setShowCompetitorScoutChat(true);
  };

  const handleMarketIntelligenceDeleteSection = (sectionId: string) => {
    const newDeletedSections = new Set(deletedSections);

    newDeletedSections.add(sectionId);

    setDeletedSections(newDeletedSections);
  };

  const handleMarketIntelligenceSaveChanges = () => {
    setIsMarketIntelligenceEditing(false);

    setHasEdits(true);

    // Force contextual message state for Market Size Scout

    setMarketSizeHasEdits(true);

    setMarketSizeLastEditedField("Market Intelligence");

    // Create a new edit record

    const newEdit: EditRecord = {
      id: Date.now().toString(),

      timestamp: new Date().toISOString(),

      user: "John Doe",

      summary: "Updated market analysis",

      field: "Market Intelligence",

      oldValue: "Previous values",

      newValue: "Updated values",
    };

    // Add the new edit record to the edit history

    setEditHistory((prevHistory) => [...prevHistory, newEdit]);

    // Set custom message and automatically open Market Size Scout chat panel

    const customMessage =
      "Great! I see you've made changes to the Market Size & Opportunity section. Do you need any assistance analyzing these changes or want me to provide additional insights?";

    setMarketSizeCustomMessage(customMessage);

    // Collapse the report section when chat opens
    setIsMarketIntelligenceExpanded(false);

    setShowMarketSizeScoutChat(true);

    setIsChatOpen(true);
  };

  const handleMarketIntelligenceCancelEdit = () => {
    setIsMarketIntelligenceEditing(false);

    // Reset any unsaved changes
  };

  const handleMarketIntelligenceExpandToggle = (expanded: boolean) => {
    setIsMarketIntelligenceExpanded(expanded);
  };

  const handleMarketIntelligenceExportPDF = () => {};

  const handleMarketIntelligenceSaveToWorkspace = () => {};

  const handleMarketIntelligenceGenerateShareableLink = () => {};

  // Industry Trends handlers - Add these new handlers

  const handleIndustryTrendsToggleEdit = () => {
    setIsIndustryTrendsEditing(!isIndustryTrendsEditing);
  };

  const handleIndustryTrendsSaveChanges = () => {
    setIsIndustryTrendsEditing(false);

    // Force contextual message state for Industry Trends Scout

    setIndustryTrendsHasEdits(true);

    setIndustryTrendsLastEditedField("Industry Trends");

    // Create a new edit record

    const newEdit: EditRecord = {
      id: Date.now().toString(),

      timestamp: new Date().toISOString(),

      user: "John Doe",

      summary: "Updated industry trends analysis",

      field: "Industry Trends",

      oldValue: "Previous values",

      newValue: "Updated values",
    };

    // Add the new edit record to the industry trends edit history

    setIndustryTrendsEditHistory((prevHistory) => [...prevHistory, newEdit]);

    // Set custom message and automatically open Industry Trends Scout chat panel

    const customMessage =
      "Excellent! I see you've updated the Industry Trends section. Do you need any assistance analyzing these changes or want me to provide additional market insights?";

    setIndustryTrendsCustomMessage(customMessage);

    setShowIndustryTrendsScoutChat(true);

    setIsChatOpen(true);
  };

  const handleIndustryTrendsCancelEdit = () => {
    setIsIndustryTrendsEditing(false);

    // Reset any unsaved changes
  };

  const handleIndustryTrendsDeleteSection = (sectionId: string) => {
    const sectionNames: Record<string, string> = {
      "executive-summary": "Executive Summary",

      "key-metrics": "Key Metrics",

      "trend-snapshots": "Key Trend Snapshots",
    };

    const sectionName = sectionNames[sectionId] || sectionId;

    setIndustryTrendsDeletedSections((prev) => new Set([...prev, sectionId]));

    // Create custom message and trigger Scout with deletion message

    const customMessage = `I noticed you removed the ${sectionName}. Want me to help refine or replace it?`;

    setIndustryTrendsCustomMessage(customMessage);

    setTimeout(() => {
      void handleIndustryTrendsScoutClick("industry-trends", false, customMessage);
    }, 300);
  };

  const handleIndustryTrendsEditHistoryOpen = () => {
    setEditHistoryContext("Industry Trends");

    setIsEditHistoryOpen(true);
  };

  const handleIndustryTrendsExpandToggle = (expanded: boolean) => {
    setIndustryTrendsExpanded(expanded);
  };

  const handleIndustryTrendsExecutiveSummaryChange = (value: string) => {
    const oldValue = industryTrendsData.executiveSummary;

    addEditRecord(
      "Industry Trends Executive Summary",

      oldValue,

      value,

      "Updated executive summary for industry trends",
    );

    setIndustryTrendsData((prev: UntypedReportState) => {
      const updated = { ...prev, executiveSummary: value };

      saveIndustryTrendsDataToLocalStorage(updated);

      return updated;
    });

    setIndustryTrendsLastEditedField("executiveSummary");
  };

  // Competitor Landscape handlers - Add these new handlers

  const handleCompetitorToggleEdit = () => {
    setIsCompetitorEditing(!isCompetitorEditing);
  };

  // Add more Industry Trends change handlers

  const handleIndustryTrendsAiAdoptionChange = (value: string) => {
    const oldValue = industryTrendsData.aiAdoption;

    addEditRecord(
      "AI Adoption Rate",

      oldValue,

      value,

      "Updated AI adoption rate percentage",
    );

    setIndustryTrendsData((prev: UntypedReportState) => {
      const updated = { ...prev, aiAdoption: value };

      saveIndustryTrendsDataToLocalStorage(updated);

      return updated;
    });
  };

  const handleIndustryTrendsCloudMigrationChange = (value: string) => {
    const oldValue = industryTrendsData.cloudMigration;

    addEditRecord(
      "Cloud Migration",

      oldValue,

      value,

      "Updated cloud migration statistics",
    );

    setIndustryTrendsData((prev: UntypedReportState) => {
      const updated = { ...prev, cloudMigration: value };

      saveIndustryTrendsDataToLocalStorage(updated);

      return updated;
    });
  };

  const handleIndustryTrendsRegulatoryChange = (value: string) => {
    const oldValue = industryTrendsData.regulatory;

    addEditRecord(
      "Regulatory Policies",

      oldValue,

      value,

      "Updated regulatory policies count",
    );

    setIndustryTrendsData((prev: UntypedReportState) => {
      const updated = { ...prev, regulatory: value };

      saveIndustryTrendsDataToLocalStorage(updated);

      return updated;
    });
  };

  const handleIndustryTrendSnapshotsChange = (snapshots: TrendSnapshot[]) => {
    const oldValue = JSON.stringify(industryTrendsData.trendSnapshots);

    const newValue = JSON.stringify(snapshots);

    addEditRecord(
      "Industry Trends Snapshots",

      oldValue,

      newValue,

      "Updated trend snapshots",
    );

    setIndustryTrendsData((prev: UntypedReportState) => {
      const updated = { ...prev, trendSnapshots: snapshots };

      saveIndustryTrendsDataToLocalStorage(updated);

      return updated;
    });

    setIndustryTrendsLastEditedField("trendSnapshots");
  };

  const handleCompetitorSaveChanges = () => {
    setIsCompetitorEditing(false);

    // Clear hasEdits flag since changes have been saved
    setCompetitorHasEdits(false);

    // Create a new edit record

    const newEdit: EditRecord = {
      id: Date.now().toString(),

      timestamp: new Date().toLocaleString(),

      user: "Current User",

      summary: "Updated competitor landscape content",

      field: "Competitor Landscape",

      oldValue: "Previous content",

      newValue: "Updated content",
    };

    setCompetitorEditHistory((prev) => [newEdit, ...prev]);

    setHasEdits(true);

    // Set custom message and automatically open Competitor Landscape Scout chat panel

    const customMessage =
      "Perfect! I see you've updated the Competitor Landscape section. Do you need any assistance analyzing these changes or want me to provide additional competitive intelligence?";

    setCompetitorCustomMessage(customMessage);

    // Collapse the report section when chat opens
    setCompetitorExpanded(false);

    setShowCompetitorScoutChat(true);

    setIsChatOpen(true);
  };

  const handleCompetitorCancelEdit = () => {
    setIsCompetitorEditing(false);
  };

  const handleCompetitorDeleteSection = (sectionId: string) => {
    const sectionNames: Record<string, string> = {
      "executive-summary": "Executive Summary",

      "key-metrics": "Key Metrics",

      "funding-news": "Funding News & Headlines",
    };

    const sectionName = sectionNames[sectionId] || sectionId;

    setCompetitorDeletedSections((prev) => new Set([...prev, sectionId]));

    // Create custom message and trigger Scout with deletion message

    const customMessage = `I noticed you removed the ${sectionName}. Want me to help refine or replace it?`;

    setCompetitorCustomMessage(customMessage);

    setTimeout(() => {
      void handleCompetitorScoutClick("competitor-landscape", false, customMessage);
    }, 300);
  };

  // Market Size handlers

  const handleMarketSizeDeleteSection = (sectionId: string) => {
    const sectionNames: Record<string, string> = {
      "executive-summary": "Executive Summary",

      "key-metrics": "Key Metrics",

      "strategic-recommendations": "Strategic Recommendations",

      "market-entry": "Market Entry Strategy",

      "market-drivers": "Key Market Drivers",
    };

    const sectionName = sectionNames[sectionId] || sectionId;

    setMarketSizeDeletedSections((prev) => new Set([...prev, sectionId]));

    // Create custom message and trigger Scout with deletion message

    const customMessage = `I noticed you removed the ${sectionName}. Want me to help refine or replace it?`;

    setMarketSizeCustomMessage(customMessage);

    setTimeout(() => {
      void handleMarketSizeScoutClick("market-size", false, customMessage);
    }, 300);
  };

  const handleCompetitorEditHistoryOpen = () => {
    setEditHistoryContext("Competitor Landscape");

    setIsEditHistoryOpen(true);
  };

  const handleCompetitorExpandToggle = (expanded: boolean) => {
    setCompetitorExpanded(expanded);
  };

  const handleCompetitorExecutiveSummaryChange = (value: string) => {
    const oldValue = competitorData.executiveSummary;

    addEditRecord(
      "Competitor Executive Summary",

      oldValue,

      value,

      "Updated executive summary for competitor analysis",
    );

    setCompetitorData((prev: UntypedReportState) => ({ ...prev, executiveSummary: value }));
  };

  const handleCompetitorTopPlayerShareChange = (value: string) => {
    const oldValue = competitorData.topPlayerShare;

    addEditRecord(
      "Top Player Market Share",

      oldValue,

      value,

      "Updated top player market share percentage",
    );

    setCompetitorData((prev: UntypedReportState) => ({ ...prev, topPlayerShare: value }));
  };

  const handleCompetitorEmergingPlayersChange = (value: string) => {
    const oldValue = competitorData.emergingPlayers;

    addEditRecord(
      "Emerging Players",

      oldValue,

      value,

      "Updated emerging players count",
    );

    setCompetitorData((prev: UntypedReportState) => ({ ...prev, emergingPlayers: value }));
  };

  const handleCompetitorFundingNewsChange = (news: string[]) => {
    const oldValue = JSON.stringify(competitorData.fundingNews);

    addEditRecord(
      "Funding News",

      oldValue,

      JSON.stringify(news),

      "Updated funding news items",
    );

    setCompetitorData((prev: UntypedReportState) => ({ ...prev, fundingNews: news }));
  };

  // Market Intelligence handlers with edit tracking

  const handleMarketIntelligenceExecutiveSummaryChange = (value: string) => {
    const oldValue = marketIntelligenceData.executiveSummary;

    addEditRecord(
      "Market Executive Summary",

      oldValue,

      value,

      "Updated executive summary for market analysis",
    );

    setMarketIntelligenceData((prev: UntypedReportState) => {
      // CRITICAL: Always include user_id to ensure data isolation
      const newData = {
        ...prev,
        executiveSummary: value,
        user_id: currentUser?.uid || prev.user_id,
      };

      saveMarketIntelligenceToLocalStorage(newData);

      return newData;
    });
  };

  const handleMarketIntelligenceTamValueChange = (value: string) => {
    const oldValue = marketIntelligenceData.tamValue;

    addEditRecord(
      "Market TAM",

      oldValue,

      value,

      "Updated Total Addressable Market (TAM) value",
    );

    setMarketIntelligenceData((prev: UntypedReportState) => {
      // CRITICAL: Always include user_id to ensure data isolation
      const newData = { ...prev, tamValue: value, user_id: currentUser?.uid || prev.user_id };

      saveMarketIntelligenceToLocalStorage(newData);

      return newData;
    });
  };

  const handleMarketIntelligenceSamValueChange = (value: string) => {
    const oldValue = marketIntelligenceData.samValue;

    addEditRecord(
      "Market SAM",

      oldValue,

      value,

      "Updated Serviceable Addressable Market (SAM) value",
    );

    setMarketIntelligenceData((prev: UntypedReportState) => {
      // CRITICAL: Always include user_id to ensure data isolation
      const newData = { ...prev, samValue: value, user_id: currentUser?.uid || prev.user_id };

      saveMarketIntelligenceToLocalStorage(newData);

      return newData;
    });
  };

  const handleMarketIntelligenceGrowthRateChange = (value: string) => {
    const oldValue = marketIntelligenceData.GrowthRate;

    addEditRecord(
      "Growth Rate",

      oldValue,

      value,

      "Updated growth rate",
    );

    setMarketIntelligenceData((prev: UntypedReportState) => {
      // CRITICAL: Always include user_id to ensure data isolation
      const newData = { ...prev, GrowthRate: value, user_id: currentUser?.uid || prev.user_id };

      saveMarketIntelligenceToLocalStorage(newData);

      return newData;
    });
  };

  // Regulatory Compliance handlers - Add these new handlers

  const handleRegulatoryToggleEdit = () => {
    setIsRegulatoryEditing(!isRegulatoryEditing);
  };

  const handleRegulatorySaveChanges = () => {
    setIsRegulatoryEditing(false);

    setRegulatoryHasEdits(true); // Changed to true to indicate edits were made

    // Set custom message and open regulatory scout chat with post-save contextual messages

    const customMessage =
      "Great work! I see you've updated the Regulatory Compliance section. Do you need any assistance analyzing these changes or want me to provide additional compliance insights?";

    setRegulatoryCustomMessage(customMessage);

    setTimeout(() => {
      setIsRegulatoryPostSave(true);

      setShowRegulatoryScoutChat(true);

      setIsChatOpen(true);
    }, 100);
  };

  const handleRegulatoryCancelEdit = () => {
    setIsRegulatoryEditing(false);
  };

  const handleRegulatoryDeleteSection = (sectionId: string) => {
    // Add edit record for section deletion

    const sectionNames: Record<string, string> = {
      "executive-summary": "Executive Summary",

      "key-updates": "Key Regulatory Updates",

      "compliance-analytics": "Compliance Analytics",

      "regional-breakdown": "Regional Compliance Overview",

      "strategic-recommendations": "Strategic Recommendations",
    };

    const sectionName = sectionNames[sectionId] || sectionId;

    addEditRecord(
      sectionName,

      "Section visible",

      "Section deleted",

      `Removed ${sectionName} section`,
    );

    setRegulatoryDeletedSections((prev) => new Set([...prev, sectionId]));
  };

  const handleRegulatoryEditHistoryOpen = () => {
    setEditHistoryContext("Regulatory & Compliance Highlights");

    setIsEditHistoryOpen(true);
  };

  const handleRegulatoryExpandToggle = (expanded: boolean) => {
    setRegulatoryExpanded(expanded);
  };

  // Helper function to add edit record

  const addEditRecord = (field: string, oldValue: string, newValue: string, summary: string) => {
    if (oldValue !== newValue) {
      const editRecord: EditRecord = {
        id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

        timestamp: new Date().toISOString(),

        user: "Alex",

        summary,

        field,

        oldValue,

        newValue,
      };

      setEditHistory((prev) => [editRecord, ...prev]);

      setHasEdits(true);
    }
  };

  const handleRegulatoryExecutiveSummaryChange = (value: string) => {
    const oldValue = regulatoryData.executiveSummary;

    addEditRecord(
      "Executive Summary",

      oldValue,

      value,

      "Updated executive summary for regulatory compliance",
    );

    setRegulatoryData((prev: UntypedReportState) => ({ ...prev, executiveSummary: value }));
  };

  const handleRegulatoryEuAiActDeadlineChange = (value: string) => {
    const oldValue = regulatoryData.euAiActDeadline;

    addEditRecord(
      "EU AI Act Deadline",

      oldValue,

      value,

      "Updated EU AI Act enforcement timeline",
    );

    setRegulatoryData((prev: UntypedReportState) => ({ ...prev, euAiActDeadline: value }));
  };

  const handleRegulatoryGdprComplianceChange = (value: string) => {
    const oldValue = regulatoryData.gdprCompliance;

    addEditRecord(
      "GDPR Compliance",

      oldValue,

      value,

      "Updated GDPR compliance statistics",
    );

    setRegulatoryData((prev: UntypedReportState) => ({ ...prev, gdprCompliance: value }));
  };

  const handleRegulatoryPotentialFinesChange = (value: string) => {
    const oldValue = regulatoryData.potentialFines;

    addEditRecord(
      "Potential Fines",

      oldValue,

      value,

      "Updated potential fine information",
    );

    setRegulatoryData((prev: UntypedReportState) => ({ ...prev, potentialFines: value }));
  };

  const handleRegulatoryDataLocalizationChange = (value: string) => {
    const oldValue = regulatoryData.dataLocalization;

    addEditRecord(
      "Data Localization",

      oldValue,

      value,

      "Updated data localization requirements",
    );

    setRegulatoryData((prev: UntypedReportState) => ({ ...prev, dataLocalization: value }));
  };

  const handleRegulatoryScoutClick = async (
    _context?:
      | "market-size"
      | "industry-trends"
      | "competitor-landscape"
      | "regulatory-compliance"
      | "market-entry",
    _hasEdits?: boolean,
    customMessage?: string,
  ) => {
    // Close all other scout chats first

    setShowMarketSizeScoutChat(false);

    setShowIndustryTrendsScoutChat(false);

    setShowCompetitorScoutChat(false);

    setShowMarketEntryScoutChat(false);

    setIsChatOpen(false);

    // Set up state for the chat panel

    setRegulatoryCustomMessage(customMessage);

    setIsRegulatoryPostSave(false);

    // Open the scout chat panel immediately

    setShowRegulatoryScoutChat(true);
  };

  // Edit history handlers

  const handleEditHistoryOpen = () => {
    setEditHistoryContext("Market Size & Opportunity");

    setIsEditHistoryOpen(true);
  };

  // Market Entry handlers

  const handleMarketEntryToggleEdit = () => setIsMarketEntryEditing(!isMarketEntryEditing);

  const handleMarketEntryExpandToggle = (expanded: boolean) => setMarketEntryExpanded(expanded);

  const handleMarketEntrySaveChanges = () => {
    setIsMarketEntryEditing(false);

    setMarketEntryHasEdits(false);

    // Set post-save state and trigger Scout chat

    setIsMarketEntryPostSave(true);

    void handleMarketEntryScoutClick("market-entry", true);
  };

  const handleMarketEntryCancelEdit = () => setIsMarketEntryEditing(false);

  const handleMarketEntryDeleteSection = (sectionId: string) => {
    setMarketEntryDeletedSections((prev) => new Set([...prev, sectionId]));

    // Trigger Scout chat with deletion context

    setMarketEntryCustomMessage(
      "I noticed you removed the Market Entry & Growth Strategy section. Want me to help refine or replace it?",
    );

    void handleMarketEntryScoutClick("market-entry");
  };

  const handleMarketEntryEditHistoryOpen = () => {
    setIsMarketEntryEditHistoryOpen(true);
  };

  const handleMarketEntryEditHistoryClose = () => {
    setIsMarketEntryEditHistoryOpen(false);
  };

  const handleMarketEntryRevertEdit = (editId: string) => {
    const edit = marketEntryEditHistory.find((e) => e.id === editId);

    if (!edit) return;

    // Revert the change based on the field

    switch (edit.field) {
      case "Executive Summary":
        setMarketEntryData((prev: UntypedReportState) => ({
          ...prev,
          executiveSummary: edit.oldValue,
        }));

        break;

      case "Entry Barriers":
        setMarketEntryData((prev: UntypedReportState) => ({
          ...prev,
          entryBarriers: edit.oldValue.split(", "),
        }));

        break;

      case "Recommended Channel":
        setMarketEntryData((prev: UntypedReportState) => ({
          ...prev,
          recommendedChannel: edit.oldValue,
        }));

        break;

      case "Time to Market":
        setMarketEntryData((prev: UntypedReportState) => ({
          ...prev,
          timeToMarket: edit.oldValue,
        }));

        break;

      case "Top Barrier":
        setMarketEntryData((prev: UntypedReportState) => ({ ...prev, topBarrier: edit.oldValue }));

        break;

      case "Competitive Differentiation":
        setMarketEntryData((prev: UntypedReportState) => ({
          ...prev,
          competitiveDifferentiation: edit.oldValue.split(", "),
        }));

        break;

      case "Strategic Recommendations":
        setMarketEntryData((prev: UntypedReportState) => ({
          ...prev,
          strategicRecommendations: edit.oldValue.split(", "),
        }));

        break;

      case "Risk Assessment":
        setMarketEntryData((prev: UntypedReportState) => ({
          ...prev,
          riskAssessment: edit.oldValue.split(", "),
        }));

        break;
    }

    // Create a record of the revert action

    const revertRecord: EditRecord = {
      id: Date.now().toString(),

      timestamp: new Date().toISOString(),

      user: "Alex",

      summary: `Reverted ${edit.field} change`,

      field: edit.field,

      oldValue: edit.newValue,

      newValue: edit.oldValue,
    };

    setMarketEntryEditHistory((prev) => [revertRecord, ...prev]);
  };

  const handleMarketEntryViewEditDetails = (_editId: string) => {};

  const handleMarketEntryExecutiveSummaryChange = (value: string) => {
    const oldValue = marketEntryData?.executiveSummary;

    if (oldValue !== value) {
      setMarketEntryHasEdits(true);

      const record: EditRecord = {
        id: Date.now().toString(),

        timestamp: new Date().toISOString(),

        user: "Alex",

        summary: "Updated executive summary",

        field: "Executive Summary",

        oldValue,

        newValue: value,
      };

      setMarketEntryEditHistory((prev) => [record, ...prev]);
    }

    setMarketEntryData((prev: UntypedReportState) => {
      const updated = { ...prev, executiveSummary: value };

      saveMarketEntryDataToLocalStorage(updated);

      return updated;
    });
  };

  const handleMarketEntryBarriersChange = (barriers: string[]) => {
    const oldValue = marketEntryData?.entryBarriers?.join(", ");

    const newValue = barriers.join(", ");

    if (oldValue !== newValue) {
      setMarketEntryHasEdits(true);

      const record: EditRecord = {
        id: Date.now().toString(),

        timestamp: new Date().toISOString(),

        user: "Alex",

        summary: "Updated entry barriers",

        field: "Entry Barriers",

        oldValue,

        newValue,
      };

      setMarketEntryEditHistory((prev) => [record, ...prev]);
    }

    setMarketEntryData((prev: UntypedReportState) => {
      const updated = { ...prev, entryBarriers: barriers };

      saveMarketEntryDataToLocalStorage(updated);

      return updated;
    });
  };

  const handleMarketEntryRecommendedChannelChange = (value: string) => {
    const oldValue = marketEntryData?.recommendedChannel;

    if (oldValue !== value) {
      setMarketEntryHasEdits(true);

      const record: EditRecord = {
        id: Date.now().toString(),

        timestamp: new Date().toISOString(),

        user: "Alex",

        summary: "Updated recommended channel",

        field: "Recommended Channel",

        oldValue,

        newValue: value,
      };

      setMarketEntryEditHistory((prev) => [record, ...prev]);
    }

    setMarketEntryData((prev: UntypedReportState) => {
      const updated = { ...prev, recommendedChannel: value };

      saveMarketEntryDataToLocalStorage(updated);

      return updated;
    });
  };

  const handleMarketEntryTimeToMarketChange = (value: string) => {
    const oldValue = marketEntryData?.timeToMarket;

    if (oldValue !== value) {
      setMarketEntryHasEdits(true);

      const record: EditRecord = {
        id: Date.now().toString(),

        timestamp: new Date().toISOString(),

        user: "Alex",

        summary: "Updated time to market",

        field: "Time to Market",

        oldValue,

        newValue: value,
      };

      setMarketEntryEditHistory((prev) => [record, ...prev]);
    }

    setMarketEntryData((prev: UntypedReportState) => {
      const updated = { ...prev, timeToMarket: value };

      saveMarketEntryDataToLocalStorage(updated);

      return updated;
    });
  };

  const handleMarketEntryTopBarrierChange = (value: string) => {
    const oldValue = marketEntryData?.topBarrier;

    if (oldValue !== value) {
      setMarketEntryHasEdits(true);

      const record: EditRecord = {
        id: Date.now().toString(),

        timestamp: new Date().toISOString(),

        user: "Alex",

        summary: "Updated top barrier",

        field: "Top Barrier",

        oldValue,

        newValue: value,
      };

      setMarketEntryEditHistory((prev) => [record, ...prev]);
    }

    setMarketEntryData((prev: UntypedReportState) => {
      const updated = { ...prev, topBarrier: value };

      saveMarketEntryDataToLocalStorage(updated);

      return updated;
    });
  };

  const handleMarketEntryCompetitiveDifferentiationChange = (differentiation: string[]) => {
    const oldValue = marketEntryData?.competitiveDifferentiation?.join(", ");

    const newValue = differentiation.join(", ");

    if (oldValue !== newValue) {
      setMarketEntryHasEdits(true);

      const record: EditRecord = {
        id: Date.now().toString(),

        timestamp: new Date().toISOString(),

        user: "Alex",

        summary: "Updated competitive differentiation",

        field: "Competitive Differentiation",

        oldValue,

        newValue,
      };

      setMarketEntryEditHistory((prev) => [record, ...prev]);
    }

    setMarketEntryData((prev: UntypedReportState) => {
      const updated = { ...prev, competitiveDifferentiation: differentiation };

      saveMarketEntryDataToLocalStorage(updated);

      return updated;
    });
  };

  const handleMarketEntryStrategicRecommendationsChange = (recommendations: string[]) => {
    const oldValue = marketEntryData?.strategicRecommendations?.join(", ");

    const newValue = recommendations.join(", ");

    if (oldValue !== newValue) {
      setMarketEntryHasEdits(true);

      const record: EditRecord = {
        id: Date.now().toString(),

        timestamp: new Date().toISOString(),

        user: "Alex",

        summary: "Updated strategic recommendations",

        field: "Strategic Recommendations",

        oldValue,

        newValue,
      };

      setMarketEntryEditHistory((prev) => [record, ...prev]);
    }

    setMarketEntryData((prev: UntypedReportState) => ({
      ...prev,
      strategicRecommendations: recommendations,
    }));
  };

  const handleMarketEntryRiskAssessmentChange = (risks: string[]) => {
    const oldValue = marketEntryData?.riskAssessment?.join(", ");

    const newValue = risks.join(", ");

    if (oldValue !== newValue) {
      setMarketEntryHasEdits(true);

      const record: EditRecord = {
        id: Date.now().toString(),

        timestamp: new Date().toISOString(),

        user: "Alex",

        summary: "Updated risk assessment",

        field: "Risk Assessment",

        oldValue,

        newValue,
      };

      setMarketEntryEditHistory((prev) => [record, ...prev]);
    }

    setMarketEntryData((prev: UntypedReportState) => ({ ...prev, riskAssessment: risks }));
  };

  const handleMarketEntryScoutClick = async (
    _context?:
      | "market-size"
      | "industry-trends"
      | "competitor-landscape"
      | "regulatory-compliance"
      | "market-entry",
    hasEdits?: boolean,
    customMessage?: string,
  ) => {
    // Close all other scout chats first

    setShowMarketSizeScoutChat(false);

    setShowIndustryTrendsScoutChat(false);

    setShowCompetitorScoutChat(false);

    setShowRegulatoryScoutChat(false);

    setIsChatOpen(false);

    // Set up state for the chat panel

    if (!hasEdits) {
      setIsMarketEntryPostSave(false);
    }

    setMarketEntryCustomMessage(customMessage);

    // Open the scout chat panel immediately

    setShowMarketEntryScoutChat(true);
  };

  const handleEditHistoryClose = () => {
    setIsEditHistoryOpen(false);

    setEditHistoryContext("");
  };

  const handleRevertEdit = (editId: string) => {
    const edit = editHistory.find((e) => e.id === editId);

    if (!edit) return;

    // Revert the change based on the field

    switch (edit.field) {
      // Regulatory fields

      case "Regulatory Executive Summary":
        setRegulatoryData((prev: UntypedReportState) => ({
          ...prev,
          executiveSummary: edit.oldValue,
        }));

        break;

      case "EU AI Act Deadline":
        setRegulatoryData((prev: UntypedReportState) => ({
          ...prev,
          euAiActDeadline: edit.oldValue,
        }));

        break;

      case "GDPR Compliance":
        setRegulatoryData((prev: UntypedReportState) => ({
          ...prev,
          gdprCompliance: edit.oldValue,
        }));

        break;

      case "Potential Fines":
        setRegulatoryData((prev: UntypedReportState) => ({
          ...prev,
          potentialFines: edit.oldValue,
        }));

        break;

      case "Data Localization":
        setRegulatoryData((prev: UntypedReportState) => ({
          ...prev,
          dataLocalization: edit.oldValue,
        }));

        break;

      // Market Size fields - using the correct API data structure

      case "Market Executive Summary":
        setMarketIntelligenceData((prev: UntypedReportState) => ({
          ...prev,
          executiveSummary: edit.oldValue,
        }));

        break;

      case "Market TAM":
        setMarketIntelligenceData((prev: UntypedReportState) => ({
          ...prev,
          tamValue: edit.oldValue,
        }));

        break;

      case "Market SAM":
        setMarketIntelligenceData((prev: UntypedReportState) => ({
          ...prev,
          samValue: edit.oldValue,
        }));

        break;

      case "Market SOM":
        setMarketIntelligenceData((prev: UntypedReportState) => ({
          ...prev,
          somValue: edit.oldValue,
        }));

        break;

      case "Growth Rate":
        setMarketIntelligenceData((prev: UntypedReportState) => ({
          ...prev,
          GrowthRate: edit.oldValue,
        }));

        break;

      case "North America Growth":
        setMarketIntelligenceData((prev: UntypedReportState) => ({
          ...prev,
          northAmericaGrowthRate: edit.oldValue,
        }));

        break;

      case "Europe Growth":
        setMarketIntelligenceData((prev: UntypedReportState) => ({
          ...prev,
          europeGrowthRate: edit.oldValue,
        }));

        break;

      // Industry Trends fields

      case "Industry Trends Executive Summary":
        setIndustryTrendsData((prev: UntypedReportState) => ({
          ...prev,
          executiveSummary: edit.oldValue,
        }));

        break;

      case "AI Adoption Rate":
        setIndustryTrendsData((prev: UntypedReportState) => ({
          ...prev,
          aiAdoption: edit.oldValue,
        }));

        break;

      case "Cloud Migration":
        setIndustryTrendsData((prev: UntypedReportState) => ({
          ...prev,
          cloudMigration: edit.oldValue,
        }));

        break;

      case "Regulatory Changes":
        setIndustryTrendsData((prev: UntypedReportState) => ({
          ...prev,
          regulatory: edit.oldValue,
        }));

        break;

      // Competitor fields

      case "Competitor Executive Summary":
        setCompetitorData((prev: UntypedReportState) => ({
          ...prev,
          executiveSummary: edit.oldValue,
        }));

        break;

      case "Top Player Market Share":
        setCompetitorData((prev: UntypedReportState) => ({
          ...prev,
          topPlayerShare: edit.oldValue,
        }));

        break;

      case "Emerging Players":
        setCompetitorData((prev: UntypedReportState) => ({
          ...prev,
          emergingPlayers: edit.oldValue,
        }));

        break;

      case "Funding News": {
        // Parse the old value back to array if it was stringified

        const fundingArray =
          typeof edit.oldValue === "string" && edit.oldValue.startsWith("[")
            ? JSON.parse(edit.oldValue)
            : [edit.oldValue];

        setCompetitorData((prev: UntypedReportState) => ({ ...prev, fundingNews: fundingArray }));

        break;
      }

      // Section deletions - restore section

      default:
        if (edit.newValue === "Section deleted") {
          // Restore deleted sections for regulatory

          if (edit.field.includes("Regulatory") && edit.field.includes("Section")) {
            setRegulatoryDeletedSections((prev) => {
              const newSet = new Set(prev);

              const sectionMap: Record<string, string> = {
                "Executive Summary Section": "executive-summary",

                "Key Regulatory Updates Section": "key-updates",

                "Compliance Analytics Section": "compliance-analytics",

                "Regional Compliance Overview Section": "regional-breakdown",

                "Strategic Recommendations Section": "strategic-recommendations",
              };

              const sectionId = sectionMap[edit.field];

              if (sectionId) newSet.delete(sectionId);

              return newSet;
            });
          }

          // Restore deleted sections for industry trends
          else if (edit.field.includes("Industry Trends") && edit.field.includes("Section")) {
            setIndustryTrendsDeletedSections((prev) => {
              const newSet = new Set(prev);

              const sectionMap: Record<string, string> = {
                "Industry Trends Executive Summary Section": "executive-summary",
              };

              const sectionId = sectionMap[edit.field];

              if (sectionId) newSet.delete(sectionId);

              return newSet;
            });
          }

          // Restore deleted sections for competitor landscape
          else if (edit.field.includes("Competitor") && edit.field.includes("Section")) {
            setCompetitorDeletedSections((prev) => {
              const newSet = new Set(prev);

              const sectionMap: Record<string, string> = {
                "Competitor Executive Summary Section": "executive-summary",
              };

              const sectionId = sectionMap[edit.field];

              if (sectionId) newSet.delete(sectionId);

              return newSet;
            });
          }
        }

        break;
    }

    // Remove this edit and all subsequent edits from history

    const editIndex = editHistory.findIndex((e) => e.id === editId);

    if (editIndex !== -1) {
      setEditHistory((prev) => prev.slice(editIndex + 1));

      // Add a new edit record for the revert action

      const revertRecord: EditRecord = {
        id: `revert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

        timestamp: new Date().toISOString(),

        user: "Alex",

        summary: `Reverted ${edit.field} to previous value`,

        field: edit.field,

        oldValue: edit.newValue,

        newValue: edit.oldValue,
      };

      setEditHistory((prev) => [revertRecord, ...prev]);
    }
  };

  const handleViewEditDetails = (_editId: string) => {
    // TODO: Implement view details functionality
  };

  // Derived: does any component have valid (timestamped) data? Drives the shell's loading gate.
  const hasAnyValidData =
    marketData ||
    (industryTrendsData && industryTrendsData.timestamp) ||
    (competitorData && competitorData.timestamp) ||
    (marketEntryData && marketEntryData.timestamp) ||
    (regulatoryData && regulatoryData.timestamp);

  return {
    // Auth identity the shell chrome reads for cache keys
    currentUser,
    // Module-level cache readers the shell status banners call
    getUserCache,
    isCacheValid,
    // Lifecycle
    isInitialLoading,
    isRefreshing,
    error,
    isShowingHistoricalData,
    historicalDataTimestamp,
    hasAnyValidData,
    // Core editable data states + setters
    marketData,
    setMarketData,
    marketIntelligenceData,
    setMarketIntelligenceData,
    industryTrendsData,
    competitorData,
    regulatoryData,
    marketEntryData,
    companyProfile,
    // Edit history (cross-tab: trends + intelligence)
    editHistory,
    editHistoryContext,
    isEditHistoryOpen,
    marketEntryEditHistory,
    isMarketEntryEditHistoryOpen,
    // Refresh engine
    fetchMarketData,
    fetchMarketSizeData,
    fetchCompetitorData,
    fetchMarketEntryData,
    handleRefresh,
    returnToCurrentData,
    formatTimestamp,
    // Persistence helper used by inline JSX callbacks
    saveMarketIntelligenceToLocalStorage,
    setIsChatOpen,
    isAIViewActive,
    // Market Intelligence (Market Size) section state + handlers
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
    // Industry Trends section state + handlers
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
    // Competitor Landscape section state + handlers
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
    // Regulatory Compliance section state + handlers
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
    // Market Entry section state + handlers
    isMarketEntryEditing,
    marketEntryExpanded,
    marketEntryHasEdits,
    marketEntryDeletedSections,
    isMarketEntryLoading,
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
    // Opportunity filter (cross-tab; lead-stream-local filters now live in LeadStreamTab)
    opportunityFilter,
    setOpportunityFilter,
  };
}
