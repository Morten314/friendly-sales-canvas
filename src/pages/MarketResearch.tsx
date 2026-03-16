import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserCacheKey, getUserLocalStorage, setUserLocalStorage, removeUserLocalStorage } from "@/utils/cacheUtils";






import { Layout } from "@/components/layout/Layout";



import { usePageTitle } from "@/hooks/usePageTitle";



import { executeWithRateLimit } from "@/lib/rateLimitManager";



import { Button } from "@/components/ui/button";



import { Search, MessageSquare, Users, Settings, RefreshCw, AlertCircle, History, Calendar, Info, Loader2 } from "lucide-react";



import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";



import { ScrollArea } from "@/components/ui/scroll-area";



import { Alert, AlertDescription } from "@/components/ui/alert";



import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";



import { Badge } from "@/components/ui/badge";



import { RecentMarketResearch } from "@/components/market-research/RecentMarketResearch";



import { ScoutCapabilities } from "@/components/market-research/ScoutCapabilities";



import { MarketRankings } from "@/components/market-research/MarketRankings";



import { CompetitorAnalysis } from "@/components/market-research/CompetitorAnalysis";



import { MarketSegments } from "@/components/market-research/MarketSegments";



import { SwotAnalysis } from "@/components/market-research/SwotAnalysis";



import { EmergingTrends } from "@/components/market-research/EmergingTrends";



import ScoutLeadStream from "@/components/market-research/ScoutLeadStream";
import { ChatWithScout } from "@/components/market-research/ChatWithScout";



import { TechnologyDrivers } from "@/components/market-research/TechnologyDrivers";



import { MarketDetailDrawer } from "@/components/market-research/MarketDetailDrawer";



import { ScoutDeploymentDetails } from "@/components/market-research/ScoutDeploymentDetails";



import { ScoutSettingsForm } from "@/components/market-research/ScoutSettingsForm";



import { ComponentStatusLoadingScreen } from "@/components/market-research/ComponentStatusLoadingScreen";



import { DataHistoryDialog } from "@/components/market-research/DataHistoryDialog";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

import SafeMarketIntelligenceTab from "@/components/market-research/SafeMarketIntelligenceTab";

import EditHistoryPanel from "@/components/market-research/EditHistoryPanel";



import { DeploymentData } from "@/components/layout/Header";



import { useNavigate, useLocation } from "react-router-dom";



import { toUTCTimestamp, isTimestampNewer, logTimestampComparison } from '@/lib/timestampUtils';



import { apiFetchJson, buildApiUrl } from '@/lib/api';

import { marketResearchApiCall, logApiCallResult, shouldUseCachedData } from '@/utils/apiUtils';



import ScoutChatPanel from "@/components/market-research/ScoutChatPanel";
import { SignalsContextChat, SignalsChatContext } from "@/components/signals/SignalsContextChat";
import { ScoutChatWithHistory } from "@/components/signals/ScoutChatWithHistory";



import { useToast } from "@/hooks/use-toast";











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



  type: 'growth' | 'performance' | 'adoption';



}







interface IndustryTrendsRecommendations {



  primaryFocus: string;



  marketEntry: string;



}







// Cache for market data - ENABLED with 5-minute cache to reduce API calls
// User-specific cache map to prevent data leakage between users
const userCacheMap = new Map<string, { data: MarketIntelligenceData | null; timestamp: number | null }>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache to reduce API calls

// Helper to get user-specific cache
const getUserCache = (userId: string | null | undefined) => {
  if (!userId) return { data: null, timestamp: null };
  return userCacheMap.get(userId) || { data: null, timestamp: null };
};

// Helper to set user-specific cache
const setUserCache = (userId: string | null | undefined, data: MarketIntelligenceData | null, timestamp: number | null) => {
  if (!userId) return;
  userCacheMap.set(userId, { data, timestamp });
};

// Helper to clear user-specific cache
const clearUserCache = (userId: string | null | undefined) => {
  if (!userId) return;
  userCacheMap.delete(userId);
};

// Helper function to validate API response belongs to current user
const validateApiResponseUserId = (apiResponse: any, currentUserId: string | null | undefined, componentName: string): boolean => {
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
  }

  return true;
};



// Function to clear cache when company profile updates (user-specific)
const clearMarketDataCache = (userId?: string | null) => {
  // Clear in-memory cache
  clearUserCache(userId);
  
  if (userId) {
    // Clear user-specific localStorage cache
    removeUserLocalStorage('competitorData', userId);
    removeUserLocalStorage('marketIntelligenceData', userId);
    removeUserLocalStorage('regulatoryData', userId);
    removeUserLocalStorage('industryTrendsData', userId);
    removeUserLocalStorage('marketEntryData', userId);
  } else {
    // Fallback: clear old format (for backward compatibility)
    localStorage.removeItem('competitorData');
    localStorage.removeItem('marketIntelligenceData');
    localStorage.removeItem('regulatoryData');
    localStorage.removeItem('industryTrendsData');
    localStorage.removeItem('marketEntryData');
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
    const stored = getUserLocalStorage('marketIntelligenceData', userId);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.timestamp) {
          setUserCache(userId, parsed, parsed.timestamp);
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing cached market data:', e);
      }
    }
  }
  return cache.data;
};







const MarketResearch = React.memo(() => {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || 'brewra'; // Fallback to 'brewra' for backward compatibility
  const previousUserIdRef = useRef<string | null | undefined>(currentUser?.uid);




  usePageTitle("🔍 Scout - Brewra");



  const { toast } = useToast();



  const [isChatOpen, setIsChatOpen] = useState(false);



  const navigate = useNavigate();



  const location = useLocation();



  



  // Extract tab from URL path



  const getActiveTabFromPath = () => {



    const pathSegments = location.pathname.split('/');



    const lastSegment = pathSegments[pathSegments.length - 1];



    



    // Map URL segments to tab values



    const tabMap: { [key: string]: string } = {



      'marketintelligence': 'intelligence',



      'leadstream': 'analysis', 



      'chatwithscout': 'trends'



    };



    



    return tabMap[lastSegment] || 'intelligence';



  };



  



  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const [signalsChatContext, setSignalsChatContext] = useState<SignalsChatContext | null>(null);
  const [scoutResearchContext, setScoutResearchContext] = useState<{ leads: { name: string; company: string; jobTitle: string }[]; opportunity?: string; icp?: string } | null>(null);
  const [scoutMode, setScoutMode] = useState<"selected-leads" | "full-list">("selected-leads");

  const handleResearchWithScout = (leads: any[], context?: string) => {
    const opportunityLabels: Record<string, string> = {
      'market-size': 'Market Size & Opportunity',
      'industry-trends': 'Industry Trends',
      'competitor-landscape': 'Competitor Landscape',
      'regulatory-compliance': 'Regulatory Compliance',
      'market-entry': 'Market Entry & Growth',
    };
    setScoutMode("selected-leads");
    setScoutResearchContext({
      leads: leads.map(l => ({ name: l.name, company: l.company, jobTitle: l.jobTitle })),
      opportunity: context ? opportunityLabels[context] || context : undefined,
      icp: 'Mid-Market SaaS',
    });
    handleTabChange('trends');
  };

  const handleChatWithScout = (leads: any[]) => {
    setScoutMode("full-list");
    setScoutResearchContext({
      leads: leads.map(l => ({ name: l.name, company: l.company, jobTitle: l.jobTitle })),
      icp: 'Mid-Market SaaS',
    });
    handleTabChange('trends');
  };

  // When Chat with Scout tab is active, check for context from Signals page
  useEffect(() => {
    if (activeTab !== 'trends') return;
    try {
      const stored = sessionStorage.getItem('signalsChatContext');
      if (stored) {
        const parsed = JSON.parse(stored) as SignalsChatContext;
        if (parsed?.agent === 'scout') {
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



  const [isDrawerOpen, setIsDrawerOpen] = useState(false);



  const [isAIViewActive, setIsAIViewActive] = useState(false);



  const [isSettingsOpen, setIsSettingsOpen] = useState(false);



  const [scoutDeploymentData, setScoutDeploymentData] = useState<DeploymentData | null>(null);



  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);



  



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
        const stored = getUserLocalStorage('marketIntelligenceData', currentUser.uid);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed) {
              setUserCache(currentUser.uid, parsed, parsed.timestamp || Date.now());
              setMarketData(parsed);
            }
          } catch (e) {
            console.error('Error loading user cache:', e);
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
        user_id: currentUserId // Include user_id even when clearing
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
        user_id: currentUserId // Include user_id even when clearing
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
      img.src = '/logo.png';
    };
    preloadLogo();
  }, []);

  // Reload marketIntelligenceData from localStorage when user changes
  // This runs AFTER the clear effect to ensure we load the correct user's data
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    
    // Small delay to ensure clear effect has finished
    const timer = setTimeout(() => {
      const stored = getUserLocalStorage('marketIntelligenceData', currentUser.uid);
      
      if (stored) {
        try {
          const parsedData = JSON.parse(stored);
          if (parsedData && parsedData.timestamp) {
            // Verify this data belongs to the current user
            if (parsedData.user_id && parsedData.user_id !== currentUser.uid) {
              console.error('❌ Data user_id mismatch! Stored:', parsedData.user_id, 'Current:', currentUser.uid);
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
            fetchMarketSizeData(false, true).catch(err => {
              console.error('Error fetching market size data:', err);
              setIsMarketSizeLoading(false);
            });
          }
        } catch (error) {
          console.error('❌ [USER SWITCH] Error loading marketIntelligenceData:', error);
          // Trigger fetch on error
          setIsMarketSizeLoading(true);
          fetchMarketSizeData(false, true).catch(err => {
            console.error('Error fetching market size data:', err);
            setIsMarketSizeLoading(false);
          });
        }
      } else {
        // Trigger fetch if no stored data
        setIsMarketSizeLoading(true);
        fetchMarketSizeData(false, true).catch(err => {
          console.error('Error fetching market size data:', err);
          setIsMarketSizeLoading(false);
        });
      }
    }, 150); // Slightly longer delay to ensure clear completes
    
    return () => clearTimeout(timer);
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

  const [componentStatus, setComponentStatus] = useState<Record<string, 'pending' | 'success' | 'failed'>>({

    'Market Size': 'pending',

    'Industry Trends': 'pending', 

    'Market Entry': 'pending',

    'Competitor Landscape': 'pending',

    'Regulatory Compliance': 'pending'

  });



  // Fresh data flags to ensure strict replacement

  const [freshDataFlags, setFreshDataFlags] = useState<Record<string, boolean>>({

    'Market Size': false,

    'Industry Trends': false,

    'Market Entry': false,

    'Competitor Landscape': false,

    'Regulatory Compliance': false

  });



  // Enhanced loading phases tracking

  const [loadingPhase, setLoadingPhase] = useState<'api' | 'rendering' | 'complete'>('api');

  const [componentRenderingStatus, setComponentRenderingStatus] = useState<Record<string, 'pending' | 'rendering' | 'complete'>>({

    'Market Size': 'pending',

    'Industry Trends': 'pending', 

    'Market Entry': 'pending',

    'Competitor Landscape': 'pending',

    'Regulatory Compliance': 'pending'

  });

  const [refreshAttempt, setRefreshAttempt] = useState(0);

  const [validationAttempts, setValidationAttempts] = useState(0);

  const [consecutiveValidations, setConsecutiveValidations] = useState(0);
  
  // Track component failure counts to prevent infinite retry loops
  const [componentFailureCounts, setComponentFailureCounts] = useState<Record<string, number>>({});
  
  // Track validation timeout IDs to clear them when validation completes
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Flag to prevent multiple simultaneous validations
  const isValidatingRef = useRef<boolean>(false);
  
  // Track if retries are in progress to prevent premature loading screen dismissal
  const isRetryingRef = useRef<boolean>(false);
  
  const [globalTimeoutId, setGlobalTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);



  // Cleanup global timeout on unmount

  useEffect(() => {

    return () => {

      if (globalTimeoutId) {

        clearTimeout(globalTimeoutId);

      }

    };

  }, [globalTimeoutId]);



  // Global timeout to prevent infinite loading (2 minutes max)

  const setGlobalLoadingTimeout = () => {

    // Clear any existing timeout

    if (globalTimeoutId) {

      clearTimeout(globalTimeoutId);

    }

    

    const timeoutId = setTimeout(() => {




      

      setIsRefreshing(false);

      toast({

        title: "Loading Complete",

        description: "Maximum loading time reached. Some components may still be processing.",

        duration: 5000,

      });

    }, 180000); // 3 minutes (align with cascading refresh)

    

    setGlobalTimeoutId(timeoutId);

  };



  // Function to start the rendering phase monitoring

  const startRenderingPhase = () => {


    

    // Monitor rendering completion with a more sophisticated approach

    const checkRenderingCompletion = (attempt: number = 1) => {

      const maxAttempts = 200; // 10 minutes total (200 * 3 seconds) for safety

      


      

      // Check if components are visually rendered by looking for specific UI elements

      const renderingChecks = {

        'Market Size': marketData?.executiveSummary && marketData?.tamValue && marketData?.GrowthRate,

        'Industry Trends': industryTrendsData?.executiveSummary && industryTrendsData?.aiAdoption,

        'Market Entry': marketEntryData?.executiveSummary && marketEntryData?.entryBarriers,

        'Competitor Landscape': (competitorData?.executiveSummary && competitorData?.executiveSummary.trim() !== '') && 

                               (competitorData?.topPlayerShare && competitorData?.topPlayerShare.trim() !== ''),

        'Regulatory Compliance': (regulatoryData?.executiveSummary && regulatoryData?.executiveSummary.trim() !== '') && 

                                (regulatoryData?.euAiActDeadline && regulatoryData?.euAiActDeadline.trim() !== '')

      };

      

      const allRendered = Object.values(renderingChecks).every(rendered => rendered);

      const renderedComponents = Object.entries(renderingChecks)

        .filter(([name, rendered]) => rendered)

        .map(([name]) => name);

      



      

      if (allRendered) {


        setLoadingPhase('complete');

        setComponentRenderingStatus({

          'Market Size': 'complete',

          'Industry Trends': 'complete', 

          'Market Entry': 'complete',

          'Competitor Landscape': 'complete',

          'Regulatory Compliance': 'complete'

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

        setLoadingPhase('complete');

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

          if (rendered && updatedRenderingStatus[name] === 'rendering') {

            updatedRenderingStatus[name] = 'complete';

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

    setValidationAttempts(prev => prev + 1);

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
      setLoadingPhase('complete');
      toast({
        title: "Loading Complete",
        description: "Components loaded with available data. Some may still be processing.",
        duration: 3000,
      });
      return;
    }



    

    // Add minimum wait time to ensure components have processed fresh data

    const timeSinceRefresh = Date.now() - (window as any).refreshStartTime || 0;

    const minWaitTime = 3000; // 3 seconds minimum wait for data processing

    

    if (timeSinceRefresh < minWaitTime) {


      // Clear any existing timeout before setting a new one
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      
      validationTimeoutRef.current = setTimeout(() => {
        validationTimeoutRef.current = null;
        isValidatingRef.current = false;
        validateAllComponentsHaveFreshData();
      }, 500);

      return;

    }

    

    // Check each component's data freshness AND loading states AND timestamp freshness

    const refreshStartTime = (window as any).refreshStartTime || 0;

    const isDataFresh = (timestamp: string | undefined) => {

      if (!timestamp) return false;

      const dataTime = new Date(timestamp).getTime();

      return dataTime >= refreshStartTime - 5000; // Allow 5 second buffer for processing

    };

    

    const componentDataChecks = {

      'Market Size': marketData?.executiveSummary && marketData?.tamValue && marketData?.GrowthRate && 

                     !isMarketSizeLoading && isDataFresh(marketData?.timestamp),

      'Industry Trends': industryTrendsData?.executiveSummary && industryTrendsData?.aiAdoption && 

                        !isIndustryTrendsLoading && isDataFresh(industryTrendsData?.timestamp),

      'Market Entry': marketEntryData?.executiveSummary && marketEntryData?.entryBarriers && 

                     !isMarketEntryLoading && isDataFresh(marketEntryData?.timestamp),

      'Competitor Landscape': competitorData?.executiveSummary && !isCompetitorLoading,

      'Regulatory Compliance': (regulatoryData?.executiveSummary && regulatoryData?.executiveSummary.trim() !== '') && 

                              (regulatoryData?.euAiActDeadline && regulatoryData?.euAiActDeadline.trim() !== '') && 

                              !isRegulatoryLoading && isDataFresh(regulatoryData?.timestamp)

    };

    

    // Debug: Check each component's data structure in detail




























    


    // Debug: Log actual data to see what we have







    

    // LENIENT VALIDATION - Check for basic data to allow components to load
    const simplifiedChecks = {
      'Market Size': marketData?.executiveSummary && !isMarketSizeLoading,
      'Industry Trends': industryTrendsData?.executiveSummary && !isIndustryTrendsLoading,
      'Market Entry': marketEntryData?.executiveSummary && !isMarketEntryLoading,
      'Competitor Landscape': competitorData?.executiveSummary && !isCompetitorLoading,
      'Regulatory Compliance': regulatoryData?.executiveSummary && !isRegulatoryLoading
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
        removeUserLocalStorage('competitorData', currentUser.uid);
      } else {
        localStorage.removeItem('competitorData');
      }
    }
    
    // AGGRESSIVE FIX: Handle Competitor Landscape infinite loading
    if (isCompetitorLoading && competitorData === null) {
      setIsCompetitorLoading(false);
      setCompetitorError('Component timed out - please try refreshing');
    }
    
    const allComponentsHaveData = Object.values(simplifiedChecks).every(hasData => hasData);

    const missingDataComponents = Object.entries(simplifiedChecks)

      .filter(([name, hasData]) => !hasData)

      .map(([name]) => name);

    

    if (allComponentsHaveData) {


      

      // Increment consecutive validations

      const newConsecutiveValidations = consecutiveValidations + 1;

      setConsecutiveValidations(newConsecutiveValidations);

      


      

      // Check if we have 1 consecutive successful validation (reduced for faster processing)

      if (newConsecutiveValidations >= 1) {


        

        // Only mark components as success if they actually have data

        setComponentStatus(prev => {

          const newStatus = { ...prev };

          

          // Only mark as success if component has valid data

          if (simplifiedChecks['Market Size']) {

            newStatus['Market Size'] = 'success';

          }

          if (simplifiedChecks['Industry Trends']) {

            newStatus['Industry Trends'] = 'success';

          }

          if (simplifiedChecks['Market Entry']) {

            newStatus['Market Entry'] = 'success';

          }

          if (simplifiedChecks['Competitor Landscape']) {

            newStatus['Competitor Landscape'] = 'success';

          }

          if (simplifiedChecks['Regulatory Compliance']) {

            newStatus['Regulatory Compliance'] = 'success';

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

        setLoadingPhase('rendering');

        setComponentRenderingStatus({

          'Market Size': 'rendering',

          'Industry Trends': 'rendering', 

          'Market Entry': 'rendering',

          'Competitor Landscape': 'rendering',

          'Regulatory Compliance': 'rendering'

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
          validationTimeoutRef.current = null;
          isValidatingRef.current = false;
          validateAllComponentsHaveFreshData();
        }, 200); // Reduced to 200ms for faster processing

        return;

      }

    } else {

      
      // LENIENT APPROACH: If we have at least 3 components with data, proceed anyway
      // BUT: Only if retries are not in progress
      const componentsWithData = Object.values(simplifiedChecks).filter(hasData => hasData).length;
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
        setLoadingPhase('complete');
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
          validationTimeoutRef.current = null;
          isValidatingRef.current = false;
          validateAllComponentsHaveFreshData();
        }, 1000); // Check again in 1 second
        return;
      }


      

      // Reset consecutive validations since not all components have data

      setConsecutiveValidations(0);

      


      Object.entries(componentDataChecks).forEach(([name, hasData]) => {

        if (!hasData) {
          // Component missing data - validation will handle
        }

      });

      

      if (currentAttempt >= maxValidationAttempts) {





        

        // Check if at least the API calls completed successfully

        const successfulComponents = Object.entries(componentStatus).filter(([name, status]) => status === 'success');


        

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
            validationTimeoutRef.current = null;
            isValidatingRef.current = false;
            validateAllComponentsHaveFreshData();
          }, 1000); // Check again in 1 second
        } else {




          // Continue validation for remaining components
          // Clear any existing timeout before setting a new one
          if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current);
          }
          
          validationTimeoutRef.current = setTimeout(() => {
            validationTimeoutRef.current = null;
            isValidatingRef.current = false;
            validateAllComponentsHaveFreshData();
          }, 1500); // Reduced wait time (paid plan allows faster processing)

        }

      } else {




        

        // Wait a bit more and try again with much shorter interval
        // Clear any existing timeout before setting a new one
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
        }
        
        validationTimeoutRef.current = setTimeout(() => {
          validationTimeoutRef.current = null;
          isValidatingRef.current = false;
          validateAllComponentsHaveFreshData();
        }, 200); // Reduced to 200ms for faster processing

      }

    }

  };



  // Company profile state for centralized data context



  const [companyProfile, setCompanyProfile] = useState<any>(null);



  // Function to mark fresh data and ensure strict replacement

  const markFreshData = (componentName: string) => {


    setFreshDataFlags(prev => ({ ...prev, [componentName]: true }));

  };



  // Function to check if data is fresh and should replace old data

  const shouldReplaceWithFreshData = (componentName: string): boolean => {

    const isFresh = freshDataFlags[componentName];


    return isFresh;

  };



  



  // MarketIntelligenceTab state



  const [isMarketIntelligenceEditing, setIsMarketIntelligenceEditing] = useState(false);



  const [isMarketIntelligenceExpanded, setIsMarketIntelligenceExpanded] = useState(false);



  // Get initial market intelligence data from localStorage or defaults



  const getInitialMarketIntelligenceData = () => {



    try {



      const stored = getUserLocalStorage('marketIntelligenceData', currentUser?.uid);



      if (stored) {



        const parsedData = JSON.parse(stored);




        // CRITICAL: Verify this data belongs to the current user
        if (parsedData.user_id && parsedData.user_id !== currentUser.uid) {
          removeUserLocalStorage('marketIntelligenceData', currentUser.uid);
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
            removeUserLocalStorage('marketIntelligenceData', currentUser.uid);
          } else {
            localStorage.removeItem('marketIntelligenceData');
          }



        }



      }



    } catch (error) {



      console.error('Error loading Market Intelligence data from localStorage:', error);



      localStorage.removeItem('marketIntelligenceData');



    }



    



    // Return empty values if no stored data - let the API populate the data






    return {



      executiveSummary: "",



      tamValue: "",



      samValue: "", 



      GrowthRate: "",



      strategicRecommendations: [



      ],



      marketEntry: "",



      marketDrivers: [



      ],



      marketSizeBySegment: {},



      growthProjections: {},



      timestamp: null as string | null



    };



  };







  const [marketIntelligenceData, setMarketIntelligenceData] = useState(getInitialMarketIntelligenceData());







  // Helper function to save market intelligence data to localStorage (debounced)



  const saveMarketIntelligenceToLocalStorage = React.useCallback((data: any) => {



    try {



      // CRITICAL: Always use current user's ID - check first
      if (!currentUser?.uid) {
        return;
      }
      // Ensure user_id is included in the data for verification
      const dataWithUserId = {
        ...data,
        user_id: currentUser.uid // Always use current user's ID
      };
      setUserLocalStorage('marketIntelligenceData', JSON.stringify(dataWithUserId), currentUser.uid);






    } catch (error) {



      console.error('❌ Failed to save Market Intelligence data to localStorage:', error);



    }



  }, []);







  // Helper function to save competitor data to localStorage



  const saveCompetitorDataToLocalStorage = React.useCallback((data: any) => {



    try {



      const payloadToPersist = {

        ...data,

        // Guarantee a timestamp so loaders treat it as valid fresh data

        timestamp: data?.timestamp ?? Date.now(),

        // Ensure user_id is included for verification

        user_id: currentUser?.uid || data.user_id

      };

      setUserLocalStorage('competitorData', JSON.stringify(payloadToPersist), currentUser?.uid);






    } catch (error) {



      console.error('❌ Failed to save Competitor data to localStorage:', error);



    }



  }, []);







  // Helper function to save regulatory data to localStorage



  const saveRegulatoryDataToLocalStorage = React.useCallback((data: any) => {



    try {

      // CRITICAL: Always include user_id for multi-tenancy
      const dataWithUserId = {
        ...data,
        user_id: currentUser?.uid || data.user_id
      };

      setUserLocalStorage('regulatoryData', JSON.stringify(dataWithUserId), currentUser?.uid);






    } catch (error) {



      console.error('❌ Failed to save Regulatory data to localStorage:', error);



    }



  }, []);







  // Helper function to save industry trends data to localStorage



  const saveIndustryTrendsDataToLocalStorage = React.useCallback((data: any) => {



    try {



      const payloadToPersist = {

        ...data,

        // Ensure a timestamp so subsequent loads treat it as persisted API data

        timestamp: data?.timestamp ?? Date.now(),

        // CRITICAL: Always include user_id for multi-tenancy
        user_id: currentUser?.uid || data.user_id

      };

      setUserLocalStorage('industryTrendsData', JSON.stringify(payloadToPersist), currentUser?.uid);






    } catch (error) {



      console.error('❌ Failed to save Industry Trends data to localStorage:', error);



    }



  }, []);







  // Helper function to save market entry data to localStorage



  const saveMarketEntryDataToLocalStorage = React.useCallback((data: any) => {



    try {



      const payloadToPersist = {

        ...data,

        // Ensure a timestamp is always present so loader prefers persisted data

        timestamp: data?.timestamp ?? Date.now(),

        // CRITICAL: Always include user_id for multi-tenancy
        user_id: currentUser?.uid || data.user_id

      };

      setUserLocalStorage('marketEntryData', JSON.stringify(payloadToPersist), currentUser?.uid);






    } catch (error) {



      console.error('❌ Failed to save Market Entry data to localStorage:', error);



    }



  }, []);







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

  const [industryTrendsError, setIndustryTrendsError] = useState<string | null>(null);

  const [marketEntryError, setMarketEntryError] = useState<string | null>(null);

  const [regulatoryError, setRegulatoryError] = useState<string | null>(null);



  const [deletedSections, setDeletedSections] = useState<Set<string>>(new Set());



  



  



  // Edit history state



  const [editHistory, setEditHistory] = useState<EditRecord[]>([]);



  const [isEditHistoryOpen, setIsEditHistoryOpen] = useState(false);



  const [editHistoryContext, setEditHistoryContext] = useState<string>('');



  const [hasEdits, setHasEdits] = useState(false);







  // Industry Trends state - Add these new state variables



  const [isIndustryTrendsEditing, setIsIndustryTrendsEditing] = useState(false);



  const [industryTrendsExpanded, setIndustryTrendsExpanded] = useState(false);



  const [industryTrendsHasEdits, setIndustryTrendsHasEdits] = useState(false);



  const [industryTrendsDeletedSections, setIndustryTrendsDeletedSections] = useState<Set<string>>(new Set());



  const [industryTrendsEditHistory, setIndustryTrendsEditHistory] = useState<EditRecord[]>([]);



  // Function to get initial Industry Trends data from localStorage or defaults

  const getInitialIndustryTrendsData = () => {

    try {

      const stored = getUserLocalStorage('industryTrendsData', currentUser?.uid);

      if (stored) {

        const parsedData = JSON.parse(stored);


        // Only return stored data if it has a timestamp (meaning it came from API)

        if (parsedData.timestamp) {


          // Ensure visualCharts structure exists (for backward compatibility with old localStorage data)
          const dataWithDefaults = {
            ...parsedData,
            visualCharts: parsedData.visualCharts || {
              aiAdoptionTrends: [],
              technologyBudgetAllocation: {}
            },
            regionalHotspots: parsedData.regionalHotspots || {}
          };

          return dataWithDefaults;

        } else {


          if (currentUser?.uid) {
        removeUserLocalStorage('industryTrendsData', currentUser.uid);
      } else {
        localStorage.removeItem('industryTrendsData');
      }

        }

      }

    } catch (error) {

      console.error('❌ Error loading Industry Trends data from localStorage:', error);

      if (currentUser?.uid) {
        removeUserLocalStorage('industryTrendsData', currentUser.uid);
      } else {
        localStorage.removeItem('industryTrendsData');
      }

    }

    

    // Return default data if no valid stored data

    return {

      executiveSummary: "The enterprise software industry is experiencing rapid transformation driven by AI adoption, cloud migration, and regulatory changes. Key trends indicate accelerated digital transformation with 78% of companies prioritizing AI integration.",

      aiAdoption: "78%",

      cloudMigration: "45%",

      regulatory: "12",

      trendSnapshots: [

        { title: "AI Integration", metric: "78% adoption rate", type: 'adoption' as const },

        { title: "Cloud Migration", metric: "45% increase YoY", type: 'growth' as const },

        { title: "Regulatory Impact", metric: "12 new policies", type: 'performance' as const }

      ],

      recommendations: {

        primaryFocus: "Focus on digital transformation and AI adoption",

        marketEntry: "Strategic partnerships and gradual market penetration"

      },

      regionalHotspots: {},

      visualCharts: {

        aiAdoptionTrends: [],

        technologyBudgetAllocation: {}

      },

      risks: ["Regulatory changes could impact timeline", "Competition intensifying rapidly", "Economic uncertainty affecting IT spending"],

      timestamp: null as string | null

    };

  };



  const [industryTrendsData, setIndustryTrendsData] = useState(getInitialIndustryTrendsData());



  const [industryTrendsLastEditedField, setIndustryTrendsLastEditedField] = useState("");







  // ConsumerTrends (Your Lead Stream) filter state - persist across tab switches

  const [leadStreamFilters, setLeadStreamFilters] = useState({
    selectedIndustry: "all",
    selectedSize: "all", 
    selectedRegion: "all"
  });

  // Opportunity filter from intelligence sections
  const [opportunityFilter, setOpportunityFilter] = useState<string | null>(null);

  const handleViewOpportunityLeads = (sectionContext: string) => {
    setOpportunityFilter(sectionContext);
    handleTabChange('analysis');
  };







  // Regulatory Compliance state - Add these new state variables



  const [isRegulatoryEditing, setIsRegulatoryEditing] = useState(false);



  const [regulatoryExpanded, setRegulatoryExpanded] = useState(false);



  const [regulatoryHasEdits, setRegulatoryHasEdits] = useState(false);



  const [regulatoryDeletedSections, setRegulatoryDeletedSections] = useState<Set<string>>(new Set());



  const [regulatoryEditHistory, setRegulatoryEditHistory] = useState<EditRecord[]>([]);



  



  // Helper function to get default regulatory data (used when clearing/resetting)
  const getDefaultRegulatoryData = () => ({
    executiveSummary: 'The regulatory landscape for SaaS companies continues to evolve rapidly, with new compliance requirements emerging across multiple jurisdictions. Organizations must navigate an increasingly complex web of data protection, AI governance, and industry-specific regulations.',
    euAiActDeadline: 'February 2, 2025',
    gdprCompliance: '68%',
    potentialFines: 'Up to 6% of annual revenue',
    dataLocalization: 'Mandatory for customer data',
    keyUpdates: [],
    visualDataCards: [],
    regionalData: [],
    strategicRecommendations: {
      mitigateRegulatoryRisks: [],
      competitivePositioning: [],
      goToMarketStrategy: []
    },
    timestamp: null as string | null
  });

  // Function to get initial Regulatory data from localStorage or defaults
  const getInitialRegulatoryData = () => {



    try {



      const stored = getUserLocalStorage('regulatoryData', currentUser?.uid);



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
              goToMarketStrategy: []
            }
          };

          return dataWithDefaults;



        }



      }



    } catch (error) {



      console.error('❌ Error loading Regulatory data from localStorage:', error);



    }



    



    // Return default data if no valid stored data



    return getDefaultRegulatoryData();



  };







  const [regulatoryData, setRegulatoryData] = useState(getInitialRegulatoryData());







  // Competitor Landscape state - Add these new state variables



  const [isCompetitorEditing, setIsCompetitorEditing] = useState(false);



  const [competitorExpanded, setCompetitorExpanded] = useState(false);



  const [competitorHasEdits, setCompetitorHasEdits] = useState(false);



  const [competitorDeletedSections, setCompetitorDeletedSections] = useState<Set<string>>(new Set());



  const [competitorEditHistory, setCompetitorEditHistory] = useState<EditRecord[]>([]);



  



  // Function to get initial Competitor data from localStorage or defaults



  const getInitialCompetitorData = () => {



    try {



      const stored = getUserLocalStorage('competitorData', currentUser?.uid);



      if (stored) {



        const parsedData = JSON.parse(stored);






        // Only return stored data if it has a timestamp (meaning it came from API)



        if (parsedData.timestamp) {






          return parsedData;



        }



      }



    } catch (error) {



      console.error('❌ Error loading Competitor data from localStorage:', error);



    }



    



    // Return default data if no valid stored data - provide meaningful fallback






    return {



      executiveSummary: 'The competitive landscape analysis is being prepared. This will include insights on market leaders, emerging players, and recent funding activities in your industry.',



      topPlayerShare: 'Loading market share data...',



      emergingPlayers: 'Analyzing emerging competitors...',



      fundingNews: [],



      timestamp: null as string | null,



      uiComponents: []



    };



  };







  const [competitorData, setCompetitorData] = useState(getInitialCompetitorData());







  // Monitor competitorData changes for debugging



  useEffect(() => {












  }, [competitorData]);







  // Market Size Scout Chat states (separate from Industry Trends)



  const [showMarketSizeScoutChat, setShowMarketSizeScoutChat] = useState(false);



  const [marketSizeHasEdits, setMarketSizeHasEdits] = useState(false);



  const [marketSizeLastEditedField, setMarketSizeLastEditedField] = useState('');



  const [marketSizeDeletedSections, setMarketSizeDeletedSections] = useState<Set<string>>(new Set());



  const [marketSizeCustomMessage, setMarketSizeCustomMessage] = useState<string | undefined>(undefined);

  // Collapse Market Size section when chat opens
  useEffect(() => {
    if (showMarketSizeScoutChat) {
      setIsMarketIntelligenceExpanded(false);
    }
  }, [showMarketSizeScoutChat]);







  // Industry Trends Scout Chat states (separate from Market Size)



  const [showIndustryTrendsScoutChat, setShowIndustryTrendsScoutChat] = useState(false);



  const [industryTrendsCustomMessage, setIndustryTrendsCustomMessage] = useState<string | undefined>(undefined);







  // Competitor Landscape Scout Chat states (separate from others)



  const [showCompetitorScoutChat, setShowCompetitorScoutChat] = useState(false);



  const [competitorCustomMessage, setCompetitorCustomMessage] = useState<string | undefined>(undefined);

  // Collapse Competitor Landscape section when chat opens
  useEffect(() => {
    if (showCompetitorScoutChat) {
      setCompetitorExpanded(false);
    }
  }, [showCompetitorScoutChat]);







  // Regulatory Compliance Scout Chat states



  const [showRegulatoryScoutChat, setShowRegulatoryScoutChat] = useState(false);



  const [isRegulatoryPostSave, setIsRegulatoryPostSave] = useState(false);



  const [regulatoryCustomMessage, setRegulatoryCustomMessage] = useState<string | undefined>(undefined);

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



  const [marketEntryDeletedSections, setMarketEntryDeletedSections] = useState<Set<string>>(new Set());



  const [marketEntryEditHistory, setMarketEntryEditHistory] = useState<EditRecord[]>([]);



  // Function to get initial Market Entry data from localStorage (no fallback defaults)



  const getInitialMarketEntryData = () => {



    try {



      const stored = getUserLocalStorage('marketEntryData', currentUser?.uid);



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



      console.error('❌ Error loading Market Entry data from localStorage:', error);



    }



    // No fallback defaults: start with empty values until API data arrives

    return {

      executiveSummary: '',

      entryBarriers: [],

      recommendedChannel: '',

      timeToMarket: '',

      topBarrier: '',

      competitiveDifferentiation: [],

      strategicRecommendations: [],

      riskAssessment: [],

      swot: null as any,

      timeline: null as any,

      marketSizeBySegment: null as any,

      growthProjections: null as any,

      timestamp: null as string | null

    };



  };







  const [marketEntryData, setMarketEntryData] = useState(getInitialMarketEntryData());







  // Market Entry Scout Chat states



  const [showMarketEntryScoutChat, setShowMarketEntryScoutChat] = useState(false);



  const [isMarketEntryPostSave, setIsMarketEntryPostSave] = useState(false);



  const [marketEntryCustomMessage, setMarketEntryCustomMessage] = useState<string | undefined>(undefined);



  const [isMarketEntryEditHistoryOpen, setIsMarketEntryEditHistoryOpen] = useState(false);







  // Handle tab changes with URL navigation



  const handleTabChange = (tabValue: string) => {



    setActiveTab(tabValue);
    if (tabValue !== 'trends') setScoutResearchContext(null);



    



    // Map tab values to URL segments



    const urlMap: { [key: string]: string } = {



      'intelligence': 'marketintelligence',



      'analysis': 'leadstream',



      'trends': 'chatwithscout'



    };



    



    const urlSegment = urlMap[tabValue] || 'marketintelligence';



    navigate(`/your-ai-team/scout/${urlSegment}`);



  };



  



  // Update active tab when URL changes



  useEffect(() => {



    const newActiveTab = getActiveTabFromPath();



    if (newActiveTab !== activeTab) {



      setActiveTab(newActiveTab);



    }



  }, [location.pathname, activeTab]);



  // Listen for custom events from header buttons

  useEffect(() => {

    const handleScoutRefresh = () => {

      handleRefresh();

    };



    const handleScoutHistory = () => {

      // Trigger history dialog

      const historyButton = document.querySelector('[data-history-button]');

      if (historyButton) {

        (historyButton as HTMLElement).click();

      }

    };



    const handleScoutSettings = () => {

      setIsSettingsOpen(true);

    };



    window.addEventListener('scoutRefresh', handleScoutRefresh);

    window.addEventListener('scoutHistory', handleScoutHistory);

    window.addEventListener('scoutSettings', handleScoutSettings);



    return () => {

      window.removeEventListener('scoutRefresh', handleScoutRefresh);

      window.removeEventListener('scoutHistory', handleScoutHistory);

      window.removeEventListener('scoutSettings', handleScoutSettings);

    };

  }, []);

  // Expose getAllScoutComponentResponses to window for console access
  useEffect(() => {
    // Expose the function globally so it can be called from browser console
    (window as any).getAllScoutComponentResponses = async (refresh = false) => {
      const result = await getAllScoutComponentResponses(refresh);
      
      // Log summary to console
      
      // Log each component's response body
      result.results.forEach((componentResult, index) => {
        if (componentResult.success) {
        } else {
          console.error('❌ Error:', componentResult.error);
          console.error('Status:', componentResult.status);
        }
      });
      
      // Also log the full result object
      
      return result;
    };

    // Also create a simpler alias for quick access
    (window as any).getScoutResponses = (window as any).getAllScoutComponentResponses;

    return () => {
      delete (window as any).getAllScoutComponentResponses;
      delete (window as any).getScoutResponses;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, orgIdToUse]);



  // Transform raw report data to our expected structure (for historical data only)



  const transformReportData = (reportData: any): MarketIntelligenceData => {






    



    // Only transform if this is historical data or general market data



    // Don't use this for component-specific API responses



    const transformed = {



      researchReports: reportData.researchReports || [],



      rankings: reportData.rankings || [],



      markets: reportData.markets || [],



      market_segments: reportData.market_segments || [],



      swot_analysis: reportData.swot_analysis || {



        swot_id: '',



        strengths: [],



        weaknesses: [],



        opportunities: [],



        threats: []



      },



      emerging_trends: reportData.emerging_trends || [],



      technology_drivers: reportData.technology_drivers || [],



      timestamp: reportData.timestamp,



      // Market Size & Opportunity fields - NO fallback text, keep empty if not available



      executiveSummary: reportData.executiveSummary || '',



      tamValue: reportData.tamValue || '',



      samValue: reportData.samValue || '', 



      GrowthRate: reportData.GrowthRate || '',



      strategicRecommendations: reportData.strategicRecommendations || [],



      marketEntry: reportData.marketEntry || '',



      marketDrivers: reportData.marketDrivers || [],



      marketSizeBySegment: reportData.marketSizeBySegment || {},



      growthProjections: reportData.growthProjections || {}



    };



    






    return transformed;



  };







  // Handle historical report selection



  const handleHistoricalReportSelected = (reportData: any) => {






    



    const transformedData = transformReportData(reportData);



    



    // Set the market data to the historical data



    setMarketData(transformedData);



    setIsShowingHistoricalData(true);



    setHistoricalDataTimestamp(reportData.timestamp);



    



    // Clear any existing errors



    setError(null);



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



      if ('caches' in window) {



        const cacheNames = await caches.keys();



        await Promise.all(



          cacheNames.map(cacheName => 



            caches.open(cacheName).then(cache => 

              cache.delete('/api/market-research')

            )



          )



        );



      }



      // Clear localStorage cache for fresh data

      if (isRefresh) {


        // Clear user-specific cache
        if (currentUser?.uid) {
          removeUserLocalStorage('marketIntelligenceData', currentUser.uid);
          removeUserLocalStorage('competitorData', currentUser.uid);
          removeUserLocalStorage('regulatoryData', currentUser.uid);
          removeUserLocalStorage('industryTrendsData', currentUser.uid);
          removeUserLocalStorage('marketEntryData', currentUser.uid);
        } else {
          // Fallback: clear old format
          if (currentUser?.uid) {
            removeUserLocalStorage('marketIntelligenceData', currentUser.uid);
          } else {
            localStorage.removeItem('marketIntelligenceData');
          }
          if (currentUser?.uid) {
        removeUserLocalStorage('competitorData', currentUser.uid);
      } else {
        localStorage.removeItem('competitorData');
      }
          if (currentUser?.uid) {
        removeUserLocalStorage('regulatoryData', currentUser.uid);
      } else {
        localStorage.removeItem('regulatoryData');
      }
          if (currentUser?.uid) {
        removeUserLocalStorage('industryTrendsData', currentUser.uid);
      } else {
        localStorage.removeItem('industryTrendsData');
      }
          if (currentUser?.uid) {
        removeUserLocalStorage('marketEntryData', currentUser.uid);
      } else {
        localStorage.removeItem('marketEntryData');
      }
        }

      }



      



      // Try to get existing market intelligence data first with cache busting


      

      // Ensure user is authenticated before making API call
      if (!currentUser?.uid) {
        console.error('User not authenticated, cannot fetch market data');
        setError('Please log in to view market data');
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

        data: {}

      };

      




      

      const response = await fetch(`${buildApiUrl('market-research')}?_cb=${Date.now()}&_r=${Math.random()}`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          'Cache-Control': 'no-cache, no-store, must-revalidate',

          'Pragma': 'no-cache',

          'Expires': '0'

        },

        body: JSON.stringify(payload)

      });

      

      if (!response.ok) {

        const errorText = await response.text();

        console.error('❌ Direct fetch error:', errorText);

        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);

      }

      

      const apiResponse = await response.json();

      // CRITICAL: Validate that the API response belongs to the current user
      if (!validateApiResponseUserId(apiResponse, currentUser?.uid, 'Market Intelligence')) {
        setError('Data security validation failed. Please refresh.');
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
        setMarketData(prev => {
          const merged = {
            ...prev,
            ...transformedData,
            // Only update fields that exist in transformedData, preserve existing ones
            strategicRecommendations: transformedData.strategicRecommendations?.length > 0 
              ? transformedData.strategicRecommendations 
              : (prev?.strategicRecommendations || []),
            marketDrivers: transformedData.marketDrivers?.length > 0 
              ? transformedData.marketDrivers 
              : (prev?.marketDrivers || []),
            marketSizeBySegment: transformedData.marketSizeBySegment && Object.keys(transformedData.marketSizeBySegment).length > 0
              ? transformedData.marketSizeBySegment
              : (prev?.marketSizeBySegment || {}),
            growthProjections: transformedData.growthProjections && Object.keys(transformedData.growthProjections).length > 0
              ? transformedData.growthProjections
              : (prev?.growthProjections || {})
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



      console.error('Error fetching market data:', err);



      setError(err instanceof Error ? err.message : 'Failed to fetch market data');



      



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



        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before making API calls



        await fetchCompetitorData(false, false); // Don't show loading, don't force refresh



        // If competitor data is still null after initial load, force a refresh

        setTimeout(() => {

          if (!competitorData) {


            fetchCompetitorData(true, false);

          }

        }, 100); // Reduced to 100ms for fastest response






      } catch (error) {



        console.error('❌ Error loading initial data:', error);



      }



    };



    



    loadInitialData();



  }, []); // Only run on mount



  // NOTE: Auto-refresh removed to prevent automatic refreshes
  // Auto-refresh competitor data if it's null (fallback mechanism)
  // DISABLED: This was causing automatic refreshes after components loaded
  // useEffect(() => {
  //   if (!competitorData && !isRefreshing) {
  //     console.log('🔄 COMPETITOR AUTO-REFRESH - competitorData is null, triggering automatic refresh...');
  //     fetchCompetitorData(true, false); // Force refresh, don't show loading
  //   }
  // }, [competitorData, isRefreshing]);



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
        }

        setIndustryTrendsData(null);

        setMarketEntryData(null);

        

        // Reset fresh data flags to ensure all components get fresh data

        setFreshDataFlags({

          'Market Size': false,

          'Industry Trends': false,

          'Market Entry': false,

          'Competitor Landscape': false,

          'Regulatory Compliance': false

        });

        


        

        // NOTE: Automatic refresh removed - refresh only happens when user clicks refresh button
        // Trigger refresh of all components with new profile

        // console.log('🔄 Triggering refresh of all components with updated company profile...');

        // triggerScoutAndRefresh();

      }

    };



    window.addEventListener('companyProfileUpdated', handleCompanyProfileUpdate as EventListener);

    

    return () => {

      window.removeEventListener('companyProfileUpdated', handleCompanyProfileUpdate as EventListener);

    };

  }, []);







  // Smart refresh function that tracks component status and only retries failed ones

  const smartRefresh = async (isFirstRefresh = false) => {


    

    // Reset all component status to pending to ensure all components are fetched


    setComponentStatus({

      'Market Size': 'pending',

      'Industry Trends': 'pending', 

      'Market Entry': 'pending',

      'Competitor Landscape': 'pending',

      'Regulatory Compliance': 'pending'

    });

    

    // NOTE: Don't clear existing data during refresh to prevent "no data available" flash
    // Data will be replaced when fresh data arrives from API
    // Only clear data if explicitly needed (e.g., on explicit refresh button click)

    

    // Safety timeout; can be extended when scheduling a retry run so loading stays visible
    let refreshTimeout = setTimeout(() => {
      setIsRefreshing(false);
      setLoadingPhase('complete');
      toast({
        title: "Refresh Complete",
        description: "Maximum loading time reached.",
        duration: 3000,
      });
    }, 180000); // 3 minutes for first run; extended when we schedule smartRefresh(false) retry

    

    try {

      if (isFirstRefresh) {

        // Reset all component statuses on first refresh

        setComponentStatus({

          'Market Size': 'pending',

          'Industry Trends': 'pending', 

          'Market Entry': 'pending',

          'Competitor Landscape': 'pending',

          'Regulatory Compliance': 'pending'

        });

        

        // Reset loading phases

        setLoadingPhase('api');

        setComponentRenderingStatus({

          'Market Size': 'pending',

          'Industry Trends': 'pending', 

          'Market Entry': 'pending',

          'Competitor Landscape': 'pending',

          'Regulatory Compliance': 'pending'

        });

        setRefreshAttempt(1);

        setValidationAttempts(0); // Reset validation attempts for new refresh

        setConsecutiveValidations(0); // Reset consecutive validations for new refresh
        
        // Reset component failure counts for new refresh
        setComponentFailureCounts({});
        
        // Reset retry flag for new refresh
        isRetryingRef.current = false;


      } else {

        setRefreshAttempt(prev => prev + 1);

        setValidationAttempts(0); // Reset validation attempts for retry

        setConsecutiveValidations(0); // Reset consecutive validations for retry
        
        // Keep retry flag true since we're retrying
        isRetryingRef.current = true;



      }




      setIsRefreshing(true);
      setIsInitialLoading(false); // Ensure initial loading is false for refresh

      setError(null);

      
      // Only clear data if this is a company profile change refresh, not a regular refresh
      // Check if this is triggered by company profile update
      const isCompanyProfileUpdate = (window as any).companyProfileUpdated || false;
      
      // Always clear data for fresh fetch to ensure all components get updated data
      
        setMarketData(null);
        setCompetitorData(null);
        // Only clear regulatory data if it doesn't have a timestamp (meaning it's fallback data)
        if (!regulatoryData?.timestamp) {
          setRegulatoryData(getDefaultRegulatoryData());
        } else {
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
          user_id: currentUser?.uid // Include user_id even when clearing
        });
      
      // Clear localStorage cache for all components
      localStorage.removeItem('marketSizeData');
      if (currentUser?.uid) {
        removeUserLocalStorage('industryTrendsData', currentUser.uid);
      } else {
        localStorage.removeItem('industryTrendsData');
      }
      if (currentUser?.uid) {
        removeUserLocalStorage('marketEntryData', currentUser.uid);
      } else {
        localStorage.removeItem('marketEntryData');
      }
      if (currentUser?.uid) {
        removeUserLocalStorage('competitorData', currentUser.uid);
      } else {
        localStorage.removeItem('competitorData');
      }
      if (currentUser?.uid) {
        removeUserLocalStorage('regulatoryData', currentUser.uid);
      } else {
        localStorage.removeItem('regulatoryData');
      }
      if (currentUser?.uid) {
        removeUserLocalStorage('companyProfileForRefresh', currentUser.uid);
      } else {
        localStorage.removeItem('companyProfileForRefresh');
      }
      
      

      // Set refresh start time for minimum wait validation

      (window as any).refreshStartTime = Date.now();


      

      // Set global timeout to prevent infinite loading

      setGlobalLoadingTimeout();

      

      // Get company profile data for context (user-specific)

      let companyProfileData = null;

      if (currentUser?.uid) {
        const cachedProfile = getUserLocalStorage('companyProfile', currentUser.uid);

        if (cachedProfile) {
          try {
            companyProfileData = JSON.parse(cachedProfile);
            // Verify this profile belongs to the current user
            if (companyProfileData.user_id && companyProfileData.user_id !== currentUser.uid) {
              companyProfileData = null;
            } else {
            }
          } catch (error) {
          }
        }
      }

      

      if (!companyProfileData && currentUser?.uid) {

      try {
        // Include org_id in API call
        const profileResponse = await fetch(`${buildApiUrl('profile/company')}?org_id=${orgIdToUse}`, {

          method: 'GET',

          headers: { 'Content-Type': 'application/json' }

        });

        if (profileResponse.ok) {

          companyProfileData = await profileResponse.json();
          // Verify the profile belongs to the current user
          if (companyProfileData.user_id && companyProfileData.user_id !== currentUser.uid) {
            companyProfileData = null;
          } else {
            // Store in user-specific localStorage
            setUserLocalStorage('companyProfile', JSON.stringify(companyProfileData), currentUser.uid);
          }
        }

      } catch (error) {


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

        setUserLocalStorage('companyProfileForRefresh', JSON.stringify(companyProfileData), currentUser.uid);


      }

      

      // DO NOT show cached data during refresh - this causes components to switch to previous data
      // The loading screen should mask the entire process until fresh data is ready
      

      // No delay needed for parallel execution



      // Define all components in UI display order
      // UI Order: Market Size → Industry Trends → Competitor Landscape → Regulatory → Market Entry
      const allComponents = [

        { name: 'Market Size', fetchFn: fetchMarketSizeData, priority: 1 },

        { name: 'Industry Trends', fetchFn: fetchIndustryTrendsData, priority: 2 },

        { name: 'Competitor Landscape', fetchFn: fetchCompetitorData, priority: 3 },

        { name: 'Regulatory Compliance', fetchFn: fetchRegulatoryData, priority: 4 },

        { name: 'Market Entry', fetchFn: fetchMarketEntryData, priority: 5 },

      ];

      


      allComponents.forEach((component, index) => {


      });

      

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
        setMarketIntelligenceData(prev => ({
          executiveSummary: prev?.executiveSummary || '',
          tamValue: prev?.tamValue || '',
          samValue: prev?.samValue || '',
          GrowthRate: prev?.GrowthRate || '',
          strategicRecommendations: prev?.strategicRecommendations || [],
          marketEntry: prev?.marketEntry || '',
          marketDrivers: prev?.marketDrivers || [],
          marketSizeBySegment: prev?.marketSizeBySegment || {},
          growthProjections: prev?.growthProjections || {},
          timestamp: prev?.timestamp || null,
          user_id: currentUser?.uid || prev?.user_id
        }));
        localStorage.removeItem('marketSizeData');
        if (currentUser?.uid) {
          removeUserLocalStorage('industryTrendsData', currentUser.uid);
          removeUserLocalStorage('marketEntryData', currentUser.uid);
          removeUserLocalStorage('competitorData', currentUser.uid);
          removeUserLocalStorage('regulatoryData', currentUser.uid);
          removeUserLocalStorage('companyProfileForRefresh', currentUser.uid);
        } else {
          localStorage.removeItem('industryTrendsData');
          localStorage.removeItem('marketEntryData');
          localStorage.removeItem('competitorData');
          localStorage.removeItem('regulatoryData');
          localStorage.removeItem('companyProfileForRefresh');
        }
      }
      
      allComponents.forEach((component, index) => {
      });

      





      

      // Always process all components - no early exit

      

      const currentStatus = { ...componentStatus }; // Local copy to track status
      
      // Build context object to accumulate data from previous components for cascading refresh
      const accumulatedContext: any = {};

      // Process components sequentially (cascading) with context passing

      // Process components sequentially (cascading: each request body includes previous responses as context)
      const componentResults: any[] = [];
      console.log(`📋 [CASCADE] Refresh started – components in order: ${componentsToFetch.map(c => c.name).join(' → ')}`);

      for (let index = 0; index < componentsToFetch.length; index++) {
        const component = componentsToFetch[index];
        const contextKeys = Object.keys(accumulatedContext);
        console.log(`📋 [CASCADE] ${component.name} – request will include context from previous: ${contextKeys.length ? contextKeys.join(', ') : 'none (first component)'}`);

        try {
          // Update component status to pending
          currentStatus[component.name] = 'pending';
          setComponentStatus(prev => ({ ...prev, [component.name]: 'pending' }));

          const startTime = Date.now();
          const timeoutDuration = 60000; // 60 seconds per component (reduced partial failures for last components)
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${component.name} API call timeout after ${timeoutDuration/1000} seconds`)), timeoutDuration);
          });
          
          // Make API call with context
          // Request and response bodies will be logged inside fetch function
          let result;
          try {
            result = await Promise.race([
              component.fetchFn(true, false, accumulatedContext), // Pass context to fetch function
              timeoutPromise
            ]);
            
            // Extract data from result and add to accumulated context for next component
            if (result && typeof result === 'object') {
              const contextKeyMap: { [key: string]: string } = {
                'Market Size': 'marketSize',
                'Industry Trends': 'industryTrends',
                'Competitor Landscape': 'competitorLandscape',
                'Regulatory Compliance': 'regulatoryCompliance',
                'Market Entry': 'marketEntry'
              };
              
              const contextKey = contextKeyMap[component.name];
              if (contextKey) {
                accumulatedContext[contextKey] = result;
                // Log context cascaded so next request body will include these keys
                const nextIndex = index + 1;
                if (nextIndex < componentsToFetch.length) {
                  console.log(`📋 [CONTEXT CASCADE] After ${component.name} → next request (${componentsToFetch[nextIndex].name}) will include context:`, Object.keys(accumulatedContext));
                }
              }
            }
            
            currentStatus[component.name] = 'success';
            setComponentStatus(prev => ({ ...prev, [component.name]: 'success' }));
            componentResults.push({ status: 'fulfilled', value: result });
            
          } catch (apiError) {
            // Component failed - add error stub to context so next components still receive "this one failed" and backend can use fallback
            const reason = apiError instanceof Error ? apiError.message : String(apiError);
            console.error(`❌ ${component.name} failed:`, reason);
            const contextKeyMap: { [key: string]: string } = {
              'Market Size': 'marketSize',
              'Industry Trends': 'industryTrends',
              'Competitor Landscape': 'competitorLandscape',
              'Regulatory Compliance': 'regulatoryCompliance',
              'Market Entry': 'marketEntry'
            };
            const contextKey = contextKeyMap[component.name];
            if (contextKey) {
              accumulatedContext[contextKey] = { _error: true, _message: reason, _status: 'failed' };
              const nextIndex = index + 1;
              if (nextIndex < componentsToFetch.length) {
                console.log(`📋 [CONTEXT CASCADE] After ${component.name} (failed) → next request will include error stub. Context keys:`, Object.keys(accumulatedContext));
              }
            }
            currentStatus[component.name] = 'failed';
            setComponentStatus(prev => ({ ...prev, [component.name]: 'failed' }));
            componentResults.push({ status: 'rejected', value: null, reason });
          }

          

        } catch (error) {
          console.error(`❌ ${component.name} failed:`, error instanceof Error ? error.message : String(error));
          
          // Update component status to failed
          setComponentFailureCounts(prev => {
            const currentCount = (prev[component.name] || 0) + 1;
            return { ...prev, [component.name]: currentCount };
          });

          currentStatus[component.name] = 'failed';
          setComponentStatus(prev => ({ ...prev, [component.name]: 'failed' }));
          
          componentResults.push({ 
            status: 'rejected', 
            value: null,
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
          // Continue to next component even on outer catch
          continue;
        }
      }
      
      const results = componentResults;

      

      // Update the component status state with the current status

      setComponentStatus(currentStatus);

      

      // Check if all API calls are complete (no failures)

      const allApiCallsComplete = Object.values(currentStatus).every(status => status !== 'failed');

      const hasFailures = Object.values(currentStatus).some(status => status === 'failed');

      




      

      if (allApiCallsComplete) {
        console.log(`📋 [CASCADE] All 5 components completed; context was passed in order.`);
        isRetryingRef.current = false;
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
        // Clear global loading timeout so "Maximum time reached" does not show when all 5 components have already loaded
        if (globalTimeoutId) {
          clearTimeout(globalTimeoutId);
          setGlobalTimeoutId(null);
        }
        setIsRefreshing(false);
        setLoadingPhase('complete');
        toast({
          title: "Refresh Complete",
          description: "All components loaded successfully.",
          duration: 3000,
        });
        validateAllComponentsHaveFreshData();

      } else if (hasFailures && refreshAttempt < 3) {



        // Mark that retries are in progress
        isRetryingRef.current = true;

        // Implement immediate fallback for critical components
        // Filter out components that have failed too many times (prevent infinite loops)
        const failedComponentNames = Object.entries(currentStatus)
          .filter(([name, status]) => {
            if (status === 'failed') {
              const failureCount = componentFailureCounts[name] || 0;
              if (failureCount >= 2) {
                return false; // Skip components that have failed too many times
              }
              return true;
            }
            return false;
          })
          .map(([name]) => name);
        
        // If all failed components have exceeded retry limit, stop refreshing
        if (failedComponentNames.length === 0) {
          isRetryingRef.current = false; // Clear retry flag
          setIsRefreshing(false);
          setLoadingPhase('complete');
          toast({
            title: "Refresh Stopped",
            description: "Some components failed repeatedly. Please try refreshing again later.",
            duration: 5000,
          });
          return;
        }

        


        

        // Retry failed components with exponential backoff

        failedComponentNames.forEach(async (componentName, index) => {

          const component = componentsToFetch.find(c => c.name === componentName);

          if (component) {

            const retryDelay = 1000 + (index * 500); // 1s, 1.5s, 2s delays (paid plan allows faster)


            

            setTimeout(async () => {

              try {


                

                // Force clear any cached data for this component

                if (componentName === 'Competitor Landscape') {

                  if (currentUser?.uid) {
        removeUserLocalStorage('competitorData', currentUser.uid);
      } else {
        localStorage.removeItem('competitorData');
      }


                } else if (componentName === 'Market Entry') {

                  if (currentUser?.uid) {
        removeUserLocalStorage('marketEntryData', currentUser.uid);
      } else {
        localStorage.removeItem('marketEntryData');
      }


                } else if (componentName === 'Industry Trends') {

                  if (currentUser?.uid) {
        removeUserLocalStorage('industryTrendsData', currentUser.uid);
      } else {
        localStorage.removeItem('industryTrendsData');
      }


                }

                

                const result = await executeWithRateLimit(

                  () => component.fetchFn(true, false, accumulatedContext), // Pass context so backend can use previous components' data

                  `${componentName} (Fallback)`

                );

                


                

                // Update component status to success
                // Reset failure count on success
                setComponentFailureCounts(prev => {
                  const updated = { ...prev };
                  delete updated[componentName];
                  return updated;
                });

                setComponentStatus(prev => {
                  const newStatus: Record<string, 'success' | 'pending' | 'failed'> = { ...prev, [componentName]: 'success' };
                  
                  // Check if all components are now successful
                  const allSuccessful = Object.values(newStatus).every(status => status === 'success');
                  if (allSuccessful) {
                    isRetryingRef.current = false;
                  }
                  
                  return newStatus;
                });

                

                // Trigger a re-validation to check if we can hide the loading screen

                setTimeout(() => {

                  validateAllComponentsHaveFreshData();

                }, 1000);

                

              } catch (retryError) {

                console.error(`❌ ${componentName} fallback retry failed:`, retryError);

                

                // Mark as failed if retry also fails

                setComponentStatus(prev => ({ ...prev, [componentName]: 'failed' }));

              }

            }, retryDelay);

          }

        });

        

        // Also trigger an immediate retry for the first failed component

        if (failedComponentNames.length > 0) {

          const firstFailedComponent = componentsToFetch.find(c => c.name === failedComponentNames[0]);

          if (firstFailedComponent) {


            setTimeout(async () => {

              try {


                

                // Force clear cache

                if (failedComponentNames[0] === 'Competitor Landscape') {

                  if (currentUser?.uid) {
        removeUserLocalStorage('competitorData', currentUser.uid);
      } else {
        localStorage.removeItem('competitorData');
      }

                } else if (failedComponentNames[0] === 'Market Entry') {

                  if (currentUser?.uid) {
        removeUserLocalStorage('marketEntryData', currentUser.uid);
      } else {
        localStorage.removeItem('marketEntryData');
      }

                } else if (failedComponentNames[0] === 'Industry Trends') {

                  if (currentUser?.uid) {
        removeUserLocalStorage('industryTrendsData', currentUser.uid);
      } else {
        localStorage.removeItem('industryTrendsData');
      }

                }

                

                await executeWithRateLimit(

                  () => firstFailedComponent.fetchFn(true, false, accumulatedContext), // Pass context for retry

                  `${failedComponentNames[0]} (Immediate)`

                );

                


                // Reset failure count on success
                setComponentFailureCounts(prev => {
                  const updated = { ...prev };
                  delete updated[failedComponentNames[0]];
                  return updated;
                });
                
                setComponentStatus(prev => {
                  const newStatus: Record<string, 'success' | 'pending' | 'failed'> = { ...prev, [failedComponentNames[0]]: 'success' };
                  
                  // Check if all components are now successful
                  const allSuccessful = Object.values(newStatus).every(status => status === 'success');
                  if (allSuccessful) {
                    isRetryingRef.current = false;
                  }
                  
                  return newStatus;
                });

                

                setTimeout(() => {

                  validateAllComponentsHaveFreshData();

                }, 1000);

                

              } catch (immediateRetryError) {

                console.error(`❌ ${failedComponentNames[0]} immediate retry failed:`, immediateRetryError);

              }

            }, 500); // Faster immediate retry (paid plan allows this)

          }

        }

        

        toast({

          title: "Partial Update",

          description: `Some components failed. Retrying failed components... (attempt ${refreshAttempt + 1}/3)`,

          duration: 3000,

        });

        

        // Retry failed components immediately
        // Add guard to prevent infinite loops
        // Only retry if we haven't exceeded max attempts AND there are components that haven't exceeded their failure limit
        const retryableComponents = Object.entries(currentStatus)
          .filter(([name, status]) => {
            if (status === 'failed') {
              const failureCount = componentFailureCounts[name] || 0;
              return failureCount < 2; // Only retry components that haven't failed 2+ times
            }
            return false;
          });
        
        if (refreshAttempt < 3 && retryableComponents.length > 0) {
          // Extend loading window so the retry run has time to complete (another 3 min)
          clearTimeout(refreshTimeout);
          refreshTimeout = setTimeout(() => {
            setIsRefreshing(false);
            setLoadingPhase('complete');
            toast({ title: "Refresh Complete", description: "Refresh cycle finished.", duration: 3000 });
          }, 180000);
          setTimeout(() => {
            smartRefresh(false);
          }, 2000); // Give backend time to recover before full cascade retry
        } else {
          isRetryingRef.current = false; // Clear retry flag since we're stopping retries
          setIsRefreshing(false);
          setLoadingPhase('complete');
          toast({
            title: "Refresh Complete",
            description: retryableComponents.length === 0 
              ? "Some components failed repeatedly and were skipped."
              : "Maximum retry attempts reached. Please try refreshing again later.",
            duration: 5000,
          });
        }

      } else {


        // Clear retry flag since we're stopping
        isRetryingRef.current = false;
        clearTimeout(refreshTimeout);

        setIsRefreshing(false);

        toast({

          title: "Refresh Incomplete",

          description: "Some components could not be updated. You can try refreshing again.",

          duration: 5000,

        });

      }

      

    } catch (error) {

      console.error('❌ Smart refresh failed:', error);

      // Clear retry flag on error
      isRetryingRef.current = false;
      clearTimeout(refreshTimeout);

      setIsRefreshing(false);

      setError('Refresh failed. Please try again.');

    }

  };



  // Trigger market research using the smart refresh system

  const triggerScoutAndRefresh = async () => {


    await smartRefresh(true); // Start with first refresh

  };

  // Fetch all 5 Scout components and return their response bodies
  const getAllScoutComponentResponses = async (refresh = false) => {
    
    if (!currentUser?.uid) {
      console.error('User not authenticated, cannot fetch Scout components');
      throw new Error('Please log in to fetch Scout components');
    }

    const components = [
      {
        name: 'market size & opportunity',
        displayName: 'Market Size & Opportunity'
      },
      {
        name: 'industry trends report',
        displayName: 'Industry Trends Report'
      },
      {
        name: 'regulatory & compliance highlights',
        displayName: 'Regulatory & Compliance Highlights'
      },
      {
        name: 'competitor landscape',
        displayName: 'Competitor Landscape'
      },
      {
        name: 'market entry & growth strategy',
        displayName: 'Market Entry & Growth Strategy'
      }
    ];

    // Build and log all request bodies before making API calls
    const allRequestBodies: { [key: string]: any } = {};
    
    components.forEach((component, index) => {
      // Build clean payload with only fields the backend expects
      // Note: cache_bust fields are removed as backend doesn't accept them
      const payload: any = {
        org_id: orgIdToUse,
        user_id: currentUser.uid,
        component_name: component.name,
        data: {},
        refresh: refresh
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
          refresh: refresh
        };

        const response = await fetch(buildApiUrl('market-research'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
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
            responseBody: null
          };
        }

        const responseBody = await response.json();
        
        return {
          component: component.displayName,
          component_name: component.name,
          success: true,
          error: null,
          status: response.status,
          responseBody: responseBody
        };
      } catch (error) {
        console.error(`❌ Exception fetching ${component.displayName}:`, error);
        return {
          component: component.displayName,
          component_name: component.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          status: null,
          responseBody: null
        };
      }
    };

    // Fetch all components in parallel
    const results = await Promise.all(components.map(fetchComponent));

    // Log summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      results: results,
      summary: {
        total: results.length,
        successful: successful,
        failed: failed
      }
    };
  };







  // Fetch Market Size data using existing backend APIs with smart loading



  const fetchMarketSizeData = async (refresh = true, showLoading = true, previousContext: any = {}) => {






    try {






      // Only show individual loading if not in global refresh mode



      if (showLoading && !isRefreshing) {



        setIsMarketSizeLoading(true);



      }



      setMarketSizeError(null);







      // Get company profile data for dynamic payload



      let companyData = null;



      try {



        const profileData = getUserLocalStorage('companyProfileForRefresh', currentUser?.uid);



        if (profileData) {



          companyData = JSON.parse(profileData);



          // Verify this profile belongs to the current user
          if (companyData.user_id && companyData.user_id !== currentUser.uid) {
            companyData = null;
          } else {
          }



        }



      } catch (error) {






      }







      // Ensure user is authenticated before making API call
      if (!currentUser?.uid) {
        console.error('User not authenticated, cannot fetch market data');
        setError('Please log in to view market data');
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
        _cacheBust: Math.random().toString(36).substring(7)



      };







      if (refresh) {
        console.log(`📤 [REQUEST] Market Size & Opportunity:`);
        console.log(JSON.stringify(payload, null, 2));
      }

      const requestTimestamp = Date.now();





      const response = await fetch(buildApiUrl('market-research'), {



        method: 'POST',



        headers: {



          'Content-Type': 'application/json',



        },



        body: JSON.stringify(payload)



      });














      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [ERROR] Market Size & Opportunity:`, errorText);



        



        // If it's a component name error, try alternative names



        if (errorText.includes('Unsupported component_name')) {






          



          // Try alternative component names



          const alternativeNames = [



            "competitor landscape",



            "competitor analysis", 



            "competitive landscape",



            "competitor insights"



          ];



          



          for (const altName of alternativeNames) {






            const altPayload = { ...payload, component_name: altName };



            



            try {



              const altResponse = await fetch(buildApiUrl('market-research'), {



                method: 'POST',



                headers: { 'Content-Type': 'application/json' },



                body: JSON.stringify(altPayload)



              });



              



              if (altResponse.ok) {






                const altResult = await altResponse.json();



                // Process the successful response



                if (altResult.status === 'success' && altResult.data) {



                  // Use the same processing logic as below



                  const apiData = altResult.data;



                  // ... rest of the processing logic






                  // Continue with the existing processing logic



                  break;



                }



              } else {



                const altErrorText = await altResponse.text();






              }



            } catch (altError) {






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
      if (!validateApiResponseUserId(apiResponse, currentUser?.uid, 'Market Size')) {
        setMarketSizeError('Data security validation failed. Please refresh.');
        setIsMarketSizeLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Extract timestamps for comparison - convert to UTC



      const newDataTimestamp = apiResponse.data?.timestamp || apiResponse.timestamp;



      const currentDataTimestamp = marketIntelligenceData.timestamp;



      



      // Use UTC timestamp utilities for consistent comparison



      logTimestampComparison(currentDataTimestamp, newDataTimestamp, 'Market Size');



      



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



        setMarketIntelligenceData(prev => {



          const newData = {



            ...prev,



            executiveSummary: report.executiveSummary !== undefined ? report.executiveSummary : prev.executiveSummary,



            tamValue: report.tamValue !== undefined ? report.tamValue : prev.tamValue,



            samValue: report.samValue !== undefined ? report.samValue : prev.samValue,



            GrowthRate: report.GrowthRate !== undefined ? report.GrowthRate : prev.GrowthRate,



            strategicRecommendations: (report.strategicRecommendations !== undefined && Array.isArray(report.strategicRecommendations) && report.strategicRecommendations.length > 0)
              ? report.strategicRecommendations 
              : (prev.strategicRecommendations || []),



            marketEntry: report.marketEntry !== undefined ? report.marketEntry : prev.marketEntry,



            marketDrivers: (report.marketDrivers !== undefined && Array.isArray(report.marketDrivers) && report.marketDrivers.length > 0)
              ? report.marketDrivers 
              : (prev.marketDrivers || []),



            marketSizeBySegment: (report.marketSizeBySegment !== undefined && report.marketSizeBySegment && typeof report.marketSizeBySegment === 'object' && Object.keys(report.marketSizeBySegment).length > 0)
              ? report.marketSizeBySegment 
              : (prev.marketSizeBySegment || {}),



            growthProjections: report.growthProjections !== undefined ? report.growthProjections : prev.growthProjections,



            timestamp: toUTCTimestamp(newDataTimestamp), // Store as UTC timestamp



            originalSwaggerTimestamp: toUTCTimestamp(newDataTimestamp), // Track the original timestamp in UTC
            
            // CRITICAL: Always include user_id to ensure data isolation
            user_id: currentUser?.uid || prev.user_id



          };






























          



          // Save to localStorage for persistence



          saveMarketIntelligenceToLocalStorage(newData);



          



          return newData;



        });







        // ALSO update marketData state with the new fields including missing ones



        setMarketData(prev => {



          const updated = {



            ...prev,



            executiveSummary: report.executiveSummary !== undefined ? report.executiveSummary : prev?.executiveSummary,



            tamValue: report.tamValue !== undefined ? report.tamValue : prev?.tamValue,



            samValue: report.samValue !== undefined ? report.samValue : prev?.samValue,



            GrowthRate: report.GrowthRate !== undefined ? report.GrowthRate : prev?.GrowthRate,



            strategicRecommendations: (report.strategicRecommendations !== undefined && Array.isArray(report.strategicRecommendations) && report.strategicRecommendations.length > 0)
              ? report.strategicRecommendations 
              : (prev?.strategicRecommendations || []),



            marketEntry: report.marketEntry !== undefined ? report.marketEntry : prev?.marketEntry,



            marketDrivers: (report.marketDrivers !== undefined && Array.isArray(report.marketDrivers) && report.marketDrivers.length > 0)
              ? report.marketDrivers 
              : (prev?.marketDrivers || []),



            marketSizeBySegment: (report.marketSizeBySegment !== undefined && report.marketSizeBySegment && typeof report.marketSizeBySegment === 'object' && Object.keys(report.marketSizeBySegment).length > 0)
              ? report.marketSizeBySegment 
              : (prev?.marketSizeBySegment || {}), // This was missing!



            growthProjections: report.growthProjections !== undefined ? report.growthProjections : (prev?.growthProjections || {}),      // This was missing!



            timestamp: newDataTimestamp // Store the Swagger generation timestamp



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



      console.error('Error fetching market size data:', err);



      setMarketSizeError(err instanceof Error ? err.message : 'Failed to fetch market size data');



      // Stop loading even on error



      setIsInitialLoading(false);



      // Don't stop global refresh here - let smart refresh handle it

      // setIsRefreshing(false);



    } finally {



      setIsMarketSizeLoading(false);



    }



  };







  // Fetch Industry Trends data using backend API with correct component_name



  const fetchIndustryTrendsData = async (refresh = false, showLoading = true, previousContext: any = {}) => {

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

      let companyData = null;

      try {

        const profileData = getUserLocalStorage('companyProfileForRefresh', currentUser?.uid);

        if (profileData) {

          companyData = JSON.parse(profileData);


        }

      } catch (error) {


      }



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
        _cacheBust: Math.random().toString(36).substring(7)
      };



      if (refresh) {
        console.log(`📤 [REQUEST] Industry Trends Report:`);
        console.log(JSON.stringify(payload, null, 2));
      }

      // Note: Removed cache-busting fields (_timestamp, _cache_bust) as backend doesn't accept them
      // The backend expects only: org_id, user_id, component_name, data, refresh

      const response = await fetch(buildApiUrl('market-research'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
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
      if (!validateApiResponseUserId(result, currentUser?.uid, 'Industry Trends')) {
        setIndustryTrendsError('Data security validation failed. Please refresh.');
        setIsIndustryTrendsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (!refresh) logApiCallResult('Industry Trends', result, refresh);



      if (result.status === 'success' && result.data) {

        const apiData = result.data;


        



        // Check timestamp comparison with timestampUtils

        const currentTimestamp = industryTrendsData.timestamp || null;

        const newTimestamp = apiData.timestamp;

        




        

        logTimestampComparison(currentTimestamp, newTimestamp, 'IndustryTrends');

        

        // Always update on refresh, or if new data is newer

        if (refresh || !currentTimestamp || isTimestampNewer(newTimestamp, currentTimestamp)) {


          

          // Update industry trends data with API response
          // Preserve existing data if API response is missing fields
          const updatedData = {

            ...industryTrendsData,

            executiveSummary: apiData.executiveSummary !== undefined ? apiData.executiveSummary : (industryTrendsData?.executiveSummary || ''),

            aiAdoption: apiData.aiAdoption !== undefined ? apiData.aiAdoption : (industryTrendsData?.aiAdoption || ''),

            cloudMigration: apiData.cloudMigration !== undefined ? apiData.cloudMigration : (industryTrendsData?.cloudMigration || ''),

            regulatory: apiData.regulatory !== undefined ? apiData.regulatory : (industryTrendsData?.regulatory || ''),

            // Only update if API has actual data (non-empty arrays/objects)
            trendSnapshots: (apiData.trendSnapshots !== undefined && Array.isArray(apiData.trendSnapshots) && apiData.trendSnapshots.length > 0)
              ? apiData.trendSnapshots 
              : (industryTrendsData?.trendSnapshots || []),

            recommendations: (apiData.recommendations !== undefined && apiData.recommendations && typeof apiData.recommendations === 'object')
              ? apiData.recommendations
              : (industryTrendsData?.recommendations || {
                  primaryFocus: '',
                  marketEntry: ''
                }),

            regionalHotspots: (apiData.regionalHotspots !== undefined && apiData.regionalHotspots && typeof apiData.regionalHotspots === 'object' && Object.keys(apiData.regionalHotspots).length > 0)
              ? apiData.regionalHotspots
              : (industryTrendsData?.regionalHotspots || {}),

            visualCharts: (apiData.visualCharts !== undefined && apiData.visualCharts && typeof apiData.visualCharts === 'object' && Object.keys(apiData.visualCharts).length > 0)
              ? {
                  aiAdoptionTrends: (apiData.visualCharts.aiAdoptionTrends !== undefined && Array.isArray(apiData.visualCharts.aiAdoptionTrends) && apiData.visualCharts.aiAdoptionTrends.length > 0)
                    ? (() => {
                        return apiData.visualCharts.aiAdoptionTrends;
                      })()
                    : (() => {
                        return (industryTrendsData?.visualCharts?.aiAdoptionTrends || []);
                      })(),
                  technologyBudgetAllocation: (apiData.visualCharts.technologyBudgetAllocation !== undefined && apiData.visualCharts.technologyBudgetAllocation && typeof apiData.visualCharts.technologyBudgetAllocation === 'object' && Object.keys(apiData.visualCharts.technologyBudgetAllocation).length > 0)
                    ? apiData.visualCharts.technologyBudgetAllocation
                    : (industryTrendsData?.visualCharts?.technologyBudgetAllocation || {})
                }
              : (industryTrendsData?.visualCharts || {
                  aiAdoptionTrends: [],
                  technologyBudgetAllocation: {}
                }),

            risks: (apiData.risks !== undefined && Array.isArray(apiData.risks) && apiData.risks.length > 0)
              ? apiData.risks
              : (industryTrendsData?.risks || []),

            timestamp: toUTCTimestamp(newTimestamp)

          };

          

          setIndustryTrendsData(updatedData);

          saveIndustryTrendsDataToLocalStorage(updatedData);

          markFreshData('Industry Trends');


        } else {


          // Force update on refresh even if timestamps are the same

          if (refresh) {


            const updatedData = {

              ...industryTrendsData,

              executiveSummary: apiData.executiveSummary || industryTrendsData?.executiveSummary || '',

              aiAdoption: apiData.aiAdoption || industryTrendsData?.aiAdoption || '',

              cloudMigration: apiData.cloudMigration || industryTrendsData?.cloudMigration || '',

              regulatory: apiData.regulatory || industryTrendsData?.regulatory || '',

              risks: apiData.risks || industryTrendsData?.risks || [],

              timestamp: toUTCTimestamp(newTimestamp)

            };

            setIndustryTrendsData(updatedData);

            saveIndustryTrendsDataToLocalStorage(updatedData);

            markFreshData('Industry Trends');


          }

        }

      } else {


        if (refresh) {


        }

      }

      // Return full API response so parent cascade can add to context for next component
      return result;

    } catch (error) {

      console.error('❌ Industry Trends - Unexpected error:', error);

      setIndustryTrendsError('Failed to load industry trends data - using cached data');

    } finally {

      // Only hide individual loading if not in global refresh mode

      if (showLoading && !isRefreshing) {

        setIsIndustryTrendsLoading(false);

      }

    }

  };







  // Fetch Regulatory Compliance data using backend API with correct component_name



  const fetchRegulatoryData = async (refresh = true, showLoading = true, previousContext: any = {}) => {



    if (Object.keys(previousContext).length > 0) {
    }






    try {






      // Only show individual loading if not in global refresh mode



      if (showLoading && !isRefreshing) {



        setIsRegulatoryLoading(true);



      }



      setRegulatoryError(null);







      // Get company profile data for dynamic payload



      const currentTime = Date.now();



      const randomId = Math.random().toString(36).substring(7);



      



      // Get company profile data for dynamic reports



      const profile = JSON.parse(getUserLocalStorage('companyProfileForRefresh', currentUser?.uid) || '{}');











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
        _cacheBust: Math.random().toString(36).substring(7)
      };







      if (refresh) {
        console.log(`📤 [REQUEST] Regulatory & Compliance Highlights:`);
        console.log(JSON.stringify(payload, null, 2));
      }







      const response = await fetch(buildApiUrl('market-research'), {



        method: 'POST',



        headers: {



          'Content-Type': 'application/json',



        },



        body: JSON.stringify(payload)



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
      if (!validateApiResponseUserId(result, currentUser?.uid, 'Regulatory Compliance')) {
        setRegulatoryError('Data security validation failed. Please refresh.');
        setIsRegulatoryLoading(false);
        setIsRefreshing(false);
        return;
      }














      if (result.status === 'success' && result.data) {



        const apiData = result.data;






















        // Check timestamp comparison



        const currentTimestamp = regulatoryData.timestamp || null;



        const newTimestamp = apiData.timestamp;



        















        



        // Only update if we have fresh data or if this is a forced refresh

        // Don't update if we don't have new data to replace existing data

        const hasNewData = (apiData.executiveSummary !== null && apiData.executiveSummary !== undefined) || (apiData.euAiActDeadline !== null && apiData.euAiActDeadline !== undefined);

        // Update if:
        // 1. We have new data AND (it's a refresh OR we don't have existing data)
        // 2. OR if we don't have existing data (no timestamp)
        const shouldUpdate = hasNewData && (refresh || !currentTimestamp || !regulatoryData?.executiveSummary);



























        



        if (shouldUpdate) {
















          // Transform visualDataCards to match component expectations
          const transformVisualDataCards = (apiCards: any[]) => {
            if (!apiCards || !Array.isArray(apiCards) || apiCards.length === 0) return [];
            
            return apiCards.map((card, index) => {
              if (card.type === 'bar-chart' && card.data) {
                // Transform bar-chart data: {label, value} -> {name, value, color}
                const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];
                return {
                  ...card,
                  data: card.data.map((item: any, idx: number) => ({
                    name: item.label || item.name,
                    value: typeof item.value === 'number' ? item.value : parseInt(String(item.value).replace('%', '')) || 0,
                    color: colors[idx % colors.length]
                  }))
                };
              } else if (card.type === 'timeline' && card.data) {
                // Transform timeline data: {label, time} -> {date, event, status}
                return {
                  ...card,
                  data: card.data.map((item: any) => ({
                    date: item.time || item.date,
                    event: item.label || item.event,
                    status: item.time?.includes('2026') ? 'critical' : 'upcoming'
                  }))
                };
              } else if (card.type === 'percentage' && card.data) {
                // Transform percentage data: {label, value} -> {metric, value, trend}
                return {
                  ...card,
                  data: card.data.map((item: any) => ({
                    metric: item.label || item.metric,
                    value: typeof item.value === 'number' ? item.value : parseInt(String(item.value).replace('%', '')) || 0,
                    trend: 'up' // Default trend, could be enhanced with actual trend data
                  }))
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



            executiveSummary: apiData.executiveSummary !== undefined ? apiData.executiveSummary : (regulatoryData.executiveSummary || ''),



            euAiActDeadline: apiData.euAiActDeadline !== undefined ? apiData.euAiActDeadline : (regulatoryData.euAiActDeadline || ''),



            gdprCompliance: apiData.gdprCompliance !== undefined ? apiData.gdprCompliance : (regulatoryData.gdprCompliance || ''),



            potentialFines: apiData.potentialFines !== undefined ? apiData.potentialFines : (regulatoryData.potentialFines || ''),



            dataLocalization: apiData.dataLocalization !== undefined ? apiData.dataLocalization : (regulatoryData.dataLocalization || ''),



            timestamp: newTimestamp,



            // Only update if API has actual data (non-empty arrays/objects)
            keyUpdates: (apiData.keyUpdates !== undefined && Array.isArray(apiData.keyUpdates) && apiData.keyUpdates.length > 0)
              ? apiData.keyUpdates
              : (regulatoryData.keyUpdates || []),



            visualDataCards: transformedVisualDataCards && transformedVisualDataCards.length > 0
              ? transformedVisualDataCards
              : (regulatoryData.visualDataCards || []),



            regionalData: (apiData.regionalData !== undefined && Array.isArray(apiData.regionalData) && apiData.regionalData.length > 0)
              ? apiData.regionalData
              : (regulatoryData.regionalData || []),



            strategicRecommendations: (apiData.strategicRecommendations !== undefined && apiData.strategicRecommendations && typeof apiData.strategicRecommendations === 'object' && Object.keys(apiData.strategicRecommendations).length > 0)
              ? apiData.strategicRecommendations
              : (regulatoryData.strategicRecommendations || {
                  mitigateRegulatoryRisks: [],
                  competitivePositioning: [],
                  goToMarketStrategy: []
                }),



            uiComponents: (apiData.uiComponents !== undefined && Array.isArray(apiData.uiComponents) && apiData.uiComponents.length > 0)
              ? apiData.uiComponents
              : (regulatoryData.uiComponents || [])



          };






          
          
          
          



          







          



          setRegulatoryData(updatedRegulatoryData);



          



          // Save to localStorage for persistence



          saveRegulatoryDataToLocalStorage(updatedRegulatoryData);

          

          // Add a small delay to ensure state update is processed before validation

          setTimeout(() => {


          }, 100);



          












        } else {






        }



      } else {









      }

      // Return full API response so parent cascade can add to context for next component
      return result;

    } catch (error) {



      console.error('❌🚀 Error fetching Regulatory data:', error);



      console.error('❌🏆 API Error Status:', error.status);



      console.error('❌🏆 API Error Headers:', error.headers ? Object.fromEntries(error.headers.entries()) : 'No headers');



      console.error('❌🏆 API Error Message:', error.message);



      



      // Set error state - no fallback data generation



      setRegulatoryError('Failed to load regulatory data');



          } finally {



        // Only hide individual loading if not in global refresh mode



        if (showLoading && !isRefreshing) {



          setIsMarketSizeLoading(false);



        }



      }



    };







  // Fetch Competitor Landscape data using backend API with correct component_name



  const fetchCompetitorData = async (refresh = false, showLoading = true, previousContext: any = {}) => {



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



      let companyData = null;



      try {



        const profileData = getUserLocalStorage('companyProfileForRefresh', currentUser?.uid);




        if (profileData) {



          companyData = JSON.parse(profileData);






        }



      } catch (error) {






      }







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
        _cacheBust: Math.random().toString(36).substring(7)
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




          const response = await fetch(buildApiUrl('market-research'), {



            method: 'POST',



            headers: {



              'Content-Type': 'application/json',



            },



            body: JSON.stringify(payload)



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
            
            console.error('❌🏆 COMPETITOR LANDSCAPE - API error:', response.status, errorData);
            
            // Throw error to trigger retry or show error message
            const errorMessage = errorData.detail || errorText || `API error ${response.status}`;
            throw new Error(errorMessage);
          }

          result = await response.json();

          // CRITICAL: Validate that the API response belongs to the current user
          if (!validateApiResponseUserId(result, currentUser?.uid, 'Competitor Landscape')) {
            setCompetitorError('Data security validation failed. Please refresh.');
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






          await new Promise(resolve => setTimeout(resolve, 200)); // Reduced to 200ms for fastest retry



        }



      }



      // Check if result exists (all retries may have failed)
      if (!result) {
        console.error('❌ Competitor Landscape: All retry attempts failed');
        setCompetitorError('Failed to load competitor data after multiple attempts. The AI model service may be temporarily unavailable.');
        setIsCompetitorLoading(false);
        return;
      }

      if (refresh) {
        console.log(`📥 [RESPONSE] Competitor Landscape:`);
        console.log(JSON.stringify(result, null, 2));
      }







      if (result.status === 'success' && result.data) {



        const apiData = result.data;






        



        // Extract data from API response - try multiple possible structures
        // The API might return data in different formats, so we'll try all possibilities
        
        // Try nested structure first
        const competitorLandscapeData = apiData.competitorLandscape || {};
        
        // Try uiComponents array structure
        let uiComponentsData: any = {};
        if (apiData.uiComponents && Array.isArray(apiData.uiComponents)) {
          const reportComponent = apiData.uiComponents.find(comp => comp.type === 'report');
          if (reportComponent) {
            uiComponentsData = reportComponent;
          }
        }
        
        // Extract with fallback chain: nested -> uiComponents -> direct -> existing -> empty
        const executiveSummary = competitorLandscapeData.executiveSummary || 
                                uiComponentsData.executiveSummary || 
                                apiData.executiveSummary || 
                                competitorData?.executiveSummary || 
                                'Competitive landscape analysis completed.';
        
        const topPlayerShare = competitorLandscapeData.topPlayers || 
                              competitorLandscapeData.topPlayerShare ||
                              uiComponentsData.topPlayerShare ||
                              apiData.topPlayerShare || 
                              competitorData?.topPlayerShare || 
                              'Market share data available.';
        
        const emergingPlayers = competitorLandscapeData.emergingPlayers || 
                               uiComponentsData.emergingPlayers ||
                               apiData.emergingPlayers || 
                               competitorData?.emergingPlayers || 
                               'Emerging players identified.';
        
        const fundingNews = competitorLandscapeData.recentMoves || 
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



        logTimestampComparison(currentTimestamp, newTimestamp, 'Competitor Landscape');



        



        // Always update on refresh, or if we have new data - simplified like other components
        const hasNewData = (executiveSummary !== null && executiveSummary !== undefined) || 
                          (topPlayerShare !== null && topPlayerShare !== undefined) || 
                          (emergingPlayers !== null && emergingPlayers !== undefined) || 
                          (fundingNews !== null && fundingNews !== undefined);

        const shouldUpdate = refresh || hasNewData || !currentTimestamp || !competitorData?.executiveSummary;

        

        // Force update on refresh regardless of timestamp validation

        if (refresh) {


        }





















        



        if (shouldUpdate) {




































          



          // Update competitor data with API response - prioritize fresh API data, fallback to existing



          const updatedData = {



            ...competitorData,



            executiveSummary: executiveSummary || competitorData?.executiveSummary || '',
            topPlayerShare: topPlayerShare || competitorData?.topPlayerShare || '',
            emergingPlayers: emergingPlayers || competitorData?.emergingPlayers || '',
            fundingNews: fundingNews || competitorData?.fundingNews || [],



            timestamp: toUTCTimestamp(newTimestamp) ?? Date.now(), // Ensure timestamp exists



            uiComponents: apiData.uiComponents || []



          };



          





















          



          // Force immediate state update with callback to ensure we have latest state

          // Only update if we have fresh data - don't preserve stale data



          setCompetitorData(prevData => {



            const newData = {



              ...prevData,



              // Use simple approach like other working components
              executiveSummary: executiveSummary || prevData?.executiveSummary || '',
              topPlayerShare: topPlayerShare || prevData?.topPlayerShare || '',
              emergingPlayers: emergingPlayers || prevData?.emergingPlayers || '',
              fundingNews: fundingNews || prevData?.fundingNews || [],



              timestamp: toUTCTimestamp(newTimestamp) ?? Date.now(), // Ensure timestamp exists



              uiComponents: apiData.uiComponents || []



            };



            



            // Save to localStorage for persistence



            try {



              // Save using user-specific storage
              const dataWithUserId = {
                ...newData,
                user_id: currentUser?.uid || newData.user_id
              };
              saveCompetitorDataToLocalStorage(dataWithUserId);




              

          // State update completed immediately


          

          // Mark as fresh data to ensure strict replacement

          markFreshData('Competitor Landscape');



            } catch (error) {



              console.error('❌ Failed to save Competitor data to localStorage:', error);



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
              user_id: currentUser?.uid || competitorData?.user_id

            };

            setCompetitorData(forceUpdatedData);

            saveCompetitorDataToLocalStorage(forceUpdatedData);


          }



        }



      } else {


















        
        // If result is undefined, it means all retries failed
        if (!result) {
          setCompetitorError('Failed to load competitor data after multiple attempts. The AI model service may be temporarily unavailable.');
        } else if (result.detail) {
          // Show the actual error message from the API
          setCompetitorError(`Failed to load competitor data: ${result.detail}`);
        }



      }

      // Return full API response so parent cascade can add to context for next component
      return result;

    } catch (error) {



      console.error('❌🏆 Error fetching Competitor data:', error);



      console.error('❌🏆 Error details:', error.message);



      



      // Set error state but don't break the entire refresh process
      // Show the actual error message if available
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to load competitor data - API server error';
      
      setCompetitorError(errorMessage);



      



      // Log additional debugging info



      console.error('❌🏆 Competitor API failed - this might be a backend server issue');



      console.error('❌🏆 Check if the backend server at https://backend-11kr.onrender.com is running');



      



      // Keep existing data if available



      if (competitorData && Object.keys(competitorData).length > 0) {



        
        // Update existing data with current timestamp to pass isDataFresh check
        setCompetitorData(prevData => ({
          ...prevData,
          timestamp: Date.now().toString()
        }));
        



      } else {
        // No existing data - set fallback data with current timestamp
        setCompetitorData({
          executiveSummary: 'Competitive landscape analysis completed.',
          topPlayerShare: 'Market share data available.',
          emergingPlayers: 'Emerging players identified.',
          user_id: currentUser?.uid,
          fundingNews: [],
          timestamp: Date.now().toString(),
          uiComponents: []
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



  const fetchMarketEntryData = async (refresh = false, showLoading = true, previousContext: any = {}) => {



    if (Object.keys(previousContext).length > 0) {
    }



    // Force clear cache for fresh data

    if (refresh) {


      if (currentUser?.uid) {
        removeUserLocalStorage('marketEntryData', currentUser.uid);
      } else {
        localStorage.removeItem('marketEntryData');
      }

    }



    try {






      // Only show individual loading if not in global refresh mode



      if (showLoading && !isRefreshing) {



        setIsMarketEntryLoading(true);



      }



      setMarketEntryError(null);







      // Get company profile data for dynamic payload



      let companyData = null;



      try {



        const profileData = getUserLocalStorage('companyProfileForRefresh', currentUser?.uid);



        if (profileData) {



          companyData = JSON.parse(profileData);






        }



      } catch (error) {






      }







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
        _cacheBust: Math.random().toString(36).substring(7)
      };







      if (refresh) {
        console.log(`📤 [REQUEST] Market Entry & Growth Strategy:`);
        console.log(JSON.stringify(payload, null, 2));
      }



      // Note: Removed cache-busting fields (_timestamp, _cache_bust) as backend doesn't accept them
      // The backend expects only: org_id, user_id, component_name, data, refresh

      const response = await fetch(buildApiUrl('market-research'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // CRITICAL: Validate that the API response belongs to the current user
      if (!validateApiResponseUserId(result, currentUser?.uid, 'Market Entry')) {
        setMarketEntryError('Data security validation failed. Please refresh.');
        setIsMarketEntryLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refresh) {
        console.log(`📥 [RESPONSE] Market Entry & Growth Strategy:`);
        console.log(JSON.stringify(result, null, 2));
      }



      if (!refresh) logApiCallResult('Market Entry', result, refresh);



      if (result.status === 'success' && result.data) {



        const apiData = result.data;










        // Check timestamp comparison with timestampUtils  



        const currentTimestamp = marketEntryData?.timestamp || null;



        const newTimestamp = apiData.timestamp;



        





















        



        const shouldUpdate = refresh || !currentTimestamp || (newTimestamp && isTimestampNewer(newTimestamp, currentTimestamp));



        


















        



        if (shouldUpdate) {









          



          // Update market entry data with API response - mapping all the swagger fields
          // Helper function to validate SWOT data structure (check structure, not content length)
          const isValidSwotStructure = (swot: any): boolean => {
            if (!swot || typeof swot !== 'object') return false;
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
          const swotData = (apiData.swot && isValidSwotStructure(apiData.swot))
            ? apiData.swot 
            : (marketEntryData?.swot && isValidSwotStructure(marketEntryData.swot))
              ? marketEntryData.swot
              : apiData.swot || marketEntryData?.swot || null; // Fallback to simple check

          if (apiData.swot) {
          }
          if (swotData) {
          }

          const updatedData = {



            executiveSummary: apiData.executiveSummary || marketEntryData?.executiveSummary,



            entryBarriers: apiData.entryBarriers || marketEntryData?.entryBarriers,



            recommendedChannel: apiData.recommendedChannel || marketEntryData?.recommendedChannel,



            timeToMarket: apiData.timeToMarket || marketEntryData?.timeToMarket,



            topBarrier: apiData.topBarrier || marketEntryData?.topBarrier,



            competitiveDifferentiation: apiData.competitiveDifferentiation || marketEntryData?.competitiveDifferentiation,



            strategicRecommendations: apiData.strategicRecommendations || marketEntryData?.strategicRecommendations,



            riskAssessment: apiData.riskAssessment || marketEntryData?.riskAssessment,



            swot: swotData,
            // Also set swotAnalysis for consistency with component expectations
            swotAnalysis: swotData,



            timeline: apiData.timeline || marketEntryData?.timeline,



            marketSizeBySegment: apiData.marketSizeBySegment || marketEntryData?.marketSizeBySegment,



            growthProjections: apiData.growthProjections || marketEntryData?.growthProjections,



            timestamp: toUTCTimestamp(newTimestamp)



          };



          



          setMarketEntryData(updatedData);



          



          // Save to localStorage for persistence



          saveMarketEntryDataToLocalStorage(updatedData);



          






        } else {






        }



      }

      // Return full API response so parent cascade can add to context for next component
      return result;

    } catch (error) {



      console.error('❌ Error fetching Market Entry data:', error);



      setMarketEntryError('Failed to load market entry data');



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



      const storedMarketData = getUserLocalStorage('marketIntelligenceData', currentUser?.uid);



      if (storedMarketData) {



        try {



          const parsedData = JSON.parse(storedMarketData);



          if (parsedData.timestamp) {












            



            // Make sure the persistent data is properly set in marketData state too



            if (isMounted) {



              setMarketData(prev => {



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



                  timestamp: parsedData.timestamp



                };






                return restoredData;



              });



              setIsInitialLoading(false); // Turn off loading since we have data



            }



            return; // Exit early - don't clear data



          }



        } catch (error) {



          console.error('Error parsing stored market data:', error);



        }



      }



      



      if (!isMounted) return;



      






      // If no valid cached data, fetch from backend



      await fetchMarketData();



      



      if (!isMounted) return;



      



      // Check if we have Market Entry data, if not fetch it



      const storedMarketEntry = getUserLocalStorage('marketEntryData', currentUser?.uid);



      if (!storedMarketEntry || !JSON.parse(storedMarketEntry).timestamp) {






        await fetchMarketEntryData(false, true); // Don't refresh, but show loading



      } else {






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
      }

      // Log all 5 Scout component request bodies on page load
      if (!isMounted) return;
      try {
        await getAllScoutComponentResponses(false);
      } catch (error) {
        console.error('Error logging Scout component request bodies:', error);
      }

    };



    



    setupInitialData();



    



    return () => {



      isMounted = false;



    };



  }, []); // Only run once on initial mount - user switching is handled by separate useEffect







  // Load company profile data on mount and listen for updates



  useEffect(() => {



    const loadCompanyProfile = () => {



      try {



        const profileData = getUserLocalStorage('companyProfileForRefresh', currentUser?.uid);



        if (profileData) {



          setCompanyProfile(JSON.parse(profileData));



        }



      } catch (error) {






      }



    };



    



    loadCompanyProfile();



    



    const handleCompanyProfileUpdate = () => {






      loadCompanyProfile();



      // NOTE: Automatic refresh removed - refresh only happens when user clicks refresh button
      // triggerScoutAndRefresh();



    };







    window.addEventListener('companyProfileUpdated', handleCompanyProfileUpdate);



    



    return () => {



      window.removeEventListener('companyProfileUpdated', handleCompanyProfileUpdate);



    };



  }, []);







  // Listen for AI view changes from header



  useEffect(() => {



    const handleAIViewChange = (event: CustomEvent) => {






      setIsAIViewActive(event.detail.isAIView);



    };







    const handleScoutChatToggle = (event: CustomEvent) => {



      setIsChatOpen(event.detail.isOpen);



    };







    window.addEventListener('aiViewChanged', handleAIViewChange as EventListener);



    window.addEventListener('toggleScoutChat', handleScoutChatToggle as EventListener);



    



    return () => {



      window.removeEventListener('aiViewChanged', handleAIViewChange as EventListener);



      window.removeEventListener('toggleScoutChat', handleScoutChatToggle as EventListener);



    };



  }, []);







  // Updated handleViewResults to work with Market object instead of just market name



  const handleViewResults = (marketData: Market | null) => {



    if (marketData) {















      



      setSelectedMarket(marketData);



      setIsDrawerOpen(true);



    } else {






    }



  };







  // For MarketRankings component - keeping the old signature for compatibility



  const handleViewResultsFromRankings = (marketName: string) => {



    if (!marketData) return;



    



    const market = marketData.markets.find(m => 



      m.name === marketName || 



      m.name.toLowerCase().includes(marketName.toLowerCase().replace(' market', ''))



    );



    



    if (market) {



      handleViewResults(market);



    }



  };







  const handleDeployScout = () => {



    navigate('/scout-deployment');



  };







  const handleRefresh = () => {




    if (isShowingHistoricalData) {



      // If showing historical data, return to current data



      returnToCurrentData();



    } else {



      // Always trigger full refresh to ensure all components get fresh data
      triggerScoutAndRefresh();



    }



  };







  // Format timestamp for display



  const formatTimestamp = (timestamp: string) => {



    try {



      const date = new Date(timestamp);



      return date.toLocaleString('en-US', {



        year: 'numeric',



        month: 'short',



        day: 'numeric',



        hour: '2-digit',



        minute: '2-digit'



      });



    } catch (error) {



      return timestamp;



    }



  };







  // MarketIntelligenceTab handlers



  const handleMarketIntelligenceToggleEdit = () => {



    setIsMarketIntelligenceEditing(!isMarketIntelligenceEditing);



  };







  // Market Size Scout icon click handler



  const handleMarketSizeScoutClick = async (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => {






    



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



  const handleIndustryTrendsScoutClick = async (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => {






    



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



  const handleCompetitorScoutClick = async (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => {






    



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



    setMarketSizeLastEditedField('Market Intelligence');







    // Create a new edit record



    const newEdit: EditRecord = {



      id: Date.now().toString(),



      timestamp: new Date().toISOString(),



      user: 'John Doe',



      summary: 'Updated market analysis',



      field: 'Market Intelligence',



      oldValue: 'Previous values',



      newValue: 'Updated values',



    };







    // Add the new edit record to the edit history



    setEditHistory(prevHistory => [...prevHistory, newEdit]);



    



    // Set custom message and automatically open Market Size Scout chat panel



    const customMessage = "Great! I see you've made changes to the Market Size & Opportunity section. Do you need any assistance analyzing these changes or want me to provide additional insights?";



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







  const handleMarketIntelligenceExportPDF = () => {






  };







  const handleMarketIntelligenceSaveToWorkspace = () => {






  };







  const handleMarketIntelligenceGenerateShareableLink = () => {






  };







  // Industry Trends handlers - Add these new handlers



  const handleIndustryTrendsToggleEdit = () => {



    setIsIndustryTrendsEditing(!isIndustryTrendsEditing);



  };







  const handleIndustryTrendsSaveChanges = () => {



    setIsIndustryTrendsEditing(false);



    



    // Force contextual message state for Industry Trends Scout



    setIndustryTrendsHasEdits(true);



    setIndustryTrendsLastEditedField('Industry Trends');







    // Create a new edit record



    const newEdit: EditRecord = {



      id: Date.now().toString(),



      timestamp: new Date().toISOString(),



      user: 'John Doe',



      summary: 'Updated industry trends analysis',



      field: 'Industry Trends',



      oldValue: 'Previous values',



      newValue: 'Updated values',



    };







    // Add the new edit record to the industry trends edit history



    setIndustryTrendsEditHistory(prevHistory => [...prevHistory, newEdit]);



    



    // Set custom message and automatically open Industry Trends Scout chat panel



    const customMessage = "Excellent! I see you've updated the Industry Trends section. Do you need any assistance analyzing these changes or want me to provide additional market insights?";



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



      'executive-summary': 'Executive Summary',



      'key-metrics': 'Key Metrics',



      'trend-snapshots': 'Key Trend Snapshots'



    };



    



    const sectionName = sectionNames[sectionId] || sectionId;



    setIndustryTrendsDeletedSections(prev => new Set([...prev, sectionId]));



    



    // Create custom message and trigger Scout with deletion message



    const customMessage = `I noticed you removed the ${sectionName}. Want me to help refine or replace it?`;



    setIndustryTrendsCustomMessage(customMessage);



    setTimeout(() => {



      handleIndustryTrendsScoutClick('industry-trends', false, customMessage);



    }, 300);



  };







  const handleIndustryTrendsEditHistoryOpen = () => {



    setEditHistoryContext('Industry Trends');



    setIsEditHistoryOpen(true);



  };







  const handleIndustryTrendsExpandToggle = (expanded: boolean) => {



    setIndustryTrendsExpanded(expanded);



  };







  const handleIndustryTrendsExecutiveSummaryChange = (value: string) => {



    const oldValue = industryTrendsData.executiveSummary;



    addEditRecord(



      'Industry Trends Executive Summary',



      oldValue,



      value,



      'Updated executive summary for industry trends'



    );



    setIndustryTrendsData(prev => {

      const updated = { ...prev, executiveSummary: value };

      saveIndustryTrendsDataToLocalStorage(updated);

      return updated;

    });



    setIndustryTrendsLastEditedField('executiveSummary');



  };







  // Competitor Landscape handlers - Add these new handlers



  const handleCompetitorToggleEdit = () => {



    setIsCompetitorEditing(!isCompetitorEditing);



  };







  // Add more Industry Trends change handlers



  const handleIndustryTrendsAiAdoptionChange = (value: string) => {



    const oldValue = industryTrendsData.aiAdoption;



    addEditRecord(



      'AI Adoption Rate',



      oldValue,



      value,



      'Updated AI adoption rate percentage'



    );



    setIndustryTrendsData(prev => {

      const updated = { ...prev, aiAdoption: value };

      saveIndustryTrendsDataToLocalStorage(updated);

      return updated;

    });



  };







  const handleIndustryTrendsCloudMigrationChange = (value: string) => {



    const oldValue = industryTrendsData.cloudMigration;



    addEditRecord(



      'Cloud Migration',



      oldValue,



      value,



      'Updated cloud migration statistics'



    );



    setIndustryTrendsData(prev => {

      const updated = { ...prev, cloudMigration: value };

      saveIndustryTrendsDataToLocalStorage(updated);

      return updated;

    });



  };







  const handleIndustryTrendsRegulatoryChange = (value: string) => {



    const oldValue = industryTrendsData.regulatory;



    addEditRecord(



      'Regulatory Policies',



      oldValue,



      value,



      'Updated regulatory policies count'



    );



    setIndustryTrendsData(prev => {

      const updated = { ...prev, regulatory: value };

      saveIndustryTrendsDataToLocalStorage(updated);

      return updated;

    });



  };







  const handleIndustryTrendSnapshotsChange = (snapshots: TrendSnapshot[]) => {



    const oldValue = JSON.stringify(industryTrendsData.trendSnapshots);



    const newValue = JSON.stringify(snapshots);



    addEditRecord(



      'Industry Trends Snapshots',



      oldValue,



      newValue,



      'Updated trend snapshots'



    );



    setIndustryTrendsData(prev => {

      const updated = { ...prev, trendSnapshots: snapshots };

      saveIndustryTrendsDataToLocalStorage(updated);

      return updated;

    });



    setIndustryTrendsLastEditedField('trendSnapshots');



  };







  const handleCompetitorSaveChanges = () => {



    setIsCompetitorEditing(false);



    



    // Clear hasEdits flag since changes have been saved
    setCompetitorHasEdits(false);







    // Create a new edit record



    const newEdit: EditRecord = {



      id: Date.now().toString(),



      timestamp: new Date().toLocaleString(),



      user: 'Current User',



      summary: 'Updated competitor landscape content',



      field: 'Competitor Landscape',



      oldValue: 'Previous content',



      newValue: 'Updated content'



    };



    



    setCompetitorEditHistory(prev => [newEdit, ...prev]);



    setHasEdits(true);



    



    // Set custom message and automatically open Competitor Landscape Scout chat panel



    const customMessage = "Perfect! I see you've updated the Competitor Landscape section. Do you need any assistance analyzing these changes or want me to provide additional competitive intelligence?";



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



      'executive-summary': 'Executive Summary',



      'key-metrics': 'Key Metrics',



      'funding-news': 'Funding News & Headlines'



    };



    



    const sectionName = sectionNames[sectionId] || sectionId;



    setCompetitorDeletedSections(prev => new Set([...prev, sectionId]));



    



    // Create custom message and trigger Scout with deletion message  



    const customMessage = `I noticed you removed the ${sectionName}. Want me to help refine or replace it?`;



    setCompetitorCustomMessage(customMessage);



    setTimeout(() => {



      handleCompetitorScoutClick('competitor-landscape', false, customMessage);



    }, 300);



  };







  // Market Size handlers



  const handleMarketSizeDeleteSection = (sectionId: string) => {



    const sectionNames: Record<string, string> = {



      'executive-summary': 'Executive Summary',



      'key-metrics': 'Key Metrics',



      'strategic-recommendations': 'Strategic Recommendations',



      'market-entry': 'Market Entry Strategy',



      'market-drivers': 'Key Market Drivers'



    };



    



    const sectionName = sectionNames[sectionId] || sectionId;



    setMarketSizeDeletedSections(prev => new Set([...prev, sectionId]));



    



    // Create custom message and trigger Scout with deletion message



    const customMessage = `I noticed you removed the ${sectionName}. Want me to help refine or replace it?`;



    setMarketSizeCustomMessage(customMessage);



    setTimeout(() => {



      handleMarketSizeScoutClick('market-size', false, customMessage);



    }, 300);



  };







  const handleCompetitorEditHistoryOpen = () => {



    setEditHistoryContext('Competitor Landscape');



    setIsEditHistoryOpen(true);



  };







  const handleCompetitorExpandToggle = (expanded: boolean) => {



    setCompetitorExpanded(expanded);



  };







  const handleCompetitorExecutiveSummaryChange = (value: string) => {



    const oldValue = competitorData.executiveSummary;



    addEditRecord(



      'Competitor Executive Summary',



      oldValue,



      value,



      'Updated executive summary for competitor analysis'



    );



    setCompetitorData(prev => ({ ...prev, executiveSummary: value }));



  };







  const handleCompetitorTopPlayerShareChange = (value: string) => {



    const oldValue = competitorData.topPlayerShare;



    addEditRecord(



      'Top Player Market Share',



      oldValue,



      value,



      'Updated top player market share percentage'



    );



    setCompetitorData(prev => ({ ...prev, topPlayerShare: value }));



  };







  const handleCompetitorEmergingPlayersChange = (value: string) => {



    const oldValue = competitorData.emergingPlayers;



    addEditRecord(



      'Emerging Players',



      oldValue,



      value,



      'Updated emerging players count'



    );



    setCompetitorData(prev => ({ ...prev, emergingPlayers: value }));



  };







  const handleCompetitorFundingNewsChange = (news: string[]) => {



    const oldValue = JSON.stringify(competitorData.fundingNews);



    addEditRecord(



      'Funding News',



      oldValue,



      JSON.stringify(news),



      'Updated funding news items'



    );



    setCompetitorData(prev => ({ ...prev, fundingNews: news }));



  };







  // Market Intelligence handlers with edit tracking



  const handleMarketIntelligenceExecutiveSummaryChange = (value: string) => {



    const oldValue = marketIntelligenceData.executiveSummary;



    addEditRecord(



      'Market Executive Summary',



      oldValue,



      value,



      'Updated executive summary for market analysis'



    );



    setMarketIntelligenceData(prev => {



      // CRITICAL: Always include user_id to ensure data isolation
      const newData = { ...prev, executiveSummary: value, user_id: currentUser?.uid || prev.user_id };



      saveMarketIntelligenceToLocalStorage(newData);



      return newData;



    });



  };







  const handleMarketIntelligenceTamValueChange = (value: string) => {



    const oldValue = marketIntelligenceData.tamValue;



    addEditRecord(



      'Market TAM',



      oldValue,



      value,



      'Updated Total Addressable Market (TAM) value'



    );



    setMarketIntelligenceData(prev => {



      // CRITICAL: Always include user_id to ensure data isolation
      const newData = { ...prev, tamValue: value, user_id: currentUser?.uid || prev.user_id };



      saveMarketIntelligenceToLocalStorage(newData);



      return newData;



    });



  };







  const handleMarketIntelligenceSamValueChange = (value: string) => {



    const oldValue = marketIntelligenceData.samValue;



    addEditRecord(



      'Market SAM',



      oldValue,



      value,



      'Updated Serviceable Addressable Market (SAM) value'



    );



    setMarketIntelligenceData(prev => {



      // CRITICAL: Always include user_id to ensure data isolation
      const newData = { ...prev, samValue: value, user_id: currentUser?.uid || prev.user_id };



      saveMarketIntelligenceToLocalStorage(newData);



      return newData;



    });



  };







  const handleMarketIntelligenceGrowthRateChange = (value: string) => {



    const oldValue = marketIntelligenceData.GrowthRate;



    addEditRecord(



      'Growth Rate',



      oldValue,



      value,



      'Updated growth rate'



    );



    setMarketIntelligenceData(prev => {



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



    const customMessage = "Great work! I see you've updated the Regulatory Compliance section. Do you need any assistance analyzing these changes or want me to provide additional compliance insights?";



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



      'executive-summary': 'Executive Summary',



      'key-updates': 'Key Regulatory Updates',



      'compliance-analytics': 'Compliance Analytics',



      'regional-breakdown': 'Regional Compliance Overview',



      'strategic-recommendations': 'Strategic Recommendations'



    };



    



    const sectionName = sectionNames[sectionId] || sectionId;



    addEditRecord(



      sectionName,



      'Section visible',



      'Section deleted',



      `Removed ${sectionName} section`



    );



    



    setRegulatoryDeletedSections(prev => new Set([...prev, sectionId]));



  };







  const handleRegulatoryEditHistoryOpen = () => {



    setEditHistoryContext('Regulatory & Compliance Highlights');



    setIsEditHistoryOpen(true);



  };







  const handleRegulatoryExpandToggle = (expanded: boolean) => {



    setRegulatoryExpanded(expanded);



  };







  // Market Size delete section handler



  const handleDeleteSection = (sectionId: string) => {



    const sectionNames: Record<string, string> = {



      'executive-summary': 'Executive Summary',



      'key-metrics': 'Key Metrics',



      'strategic-recommendations': 'Strategic Recommendations', 



      'market-entry': 'Market Entry Strategy',



      'market-drivers': 'Key Market Drivers'



    };



    



    const sectionName = sectionNames[sectionId] || sectionId;



    setDeletedSections(prev => new Set([...prev, sectionId]));



    



    // Trigger Scout with deletion message



    setTimeout(() => {



      handleMarketSizeScoutClick('market-size', false, `I noticed you removed the ${sectionName}. Want me to help refine or replace it?`);



    }, 300);



  };







  // Helper function to add edit record



  const addEditRecord = (field: string, oldValue: string, newValue: string, summary: string) => {



    if (oldValue !== newValue) {



      const editRecord: EditRecord = {



        id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,



        timestamp: new Date().toISOString(),



        user: 'Alex',



        summary,



        field,



        oldValue,



        newValue



      };






      setEditHistory(prev => [editRecord, ...prev]);



      setHasEdits(true);



    }



  };







  const handleRegulatoryExecutiveSummaryChange = (value: string) => {



    const oldValue = regulatoryData.executiveSummary;



    addEditRecord(



      'Executive Summary',



      oldValue,



      value,



      'Updated executive summary for regulatory compliance'



    );



    setRegulatoryData(prev => ({ ...prev, executiveSummary: value }));



  };







  const handleRegulatoryEuAiActDeadlineChange = (value: string) => {



    const oldValue = regulatoryData.euAiActDeadline;



    addEditRecord(



      'EU AI Act Deadline',



      oldValue,



      value,



      'Updated EU AI Act enforcement timeline'



    );



    setRegulatoryData(prev => ({ ...prev, euAiActDeadline: value }));



  };







  const handleRegulatoryGdprComplianceChange = (value: string) => {



    const oldValue = regulatoryData.gdprCompliance;



    addEditRecord(



      'GDPR Compliance',



      oldValue,



      value,



      'Updated GDPR compliance statistics'



    );



    setRegulatoryData(prev => ({ ...prev, gdprCompliance: value }));



  };







  const handleRegulatoryPotentialFinesChange = (value: string) => {



    const oldValue = regulatoryData.potentialFines;



    addEditRecord(



      'Potential Fines',



      oldValue,



      value,



      'Updated potential fine information'



    );



    setRegulatoryData(prev => ({ ...prev, potentialFines: value }));



  };







  const handleRegulatoryDataLocalizationChange = (value: string) => {



    const oldValue = regulatoryData.dataLocalization;



    addEditRecord(



      'Data Localization',



      oldValue,



      value,



      'Updated data localization requirements'



    );



    setRegulatoryData(prev => ({ ...prev, dataLocalization: value }));



  };







  const handleRegulatoryScoutClick = async (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance', hasEdits?: boolean, customMessage?: string) => {






    



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



    setEditHistoryContext('Market Size & Opportunity');



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



    handleMarketEntryScoutClick('market-entry', true);



  };



  const handleMarketEntryCancelEdit = () => setIsMarketEntryEditing(false);



  const handleMarketEntryDeleteSection = (sectionId: string) => {



    setMarketEntryDeletedSections(prev => new Set([...prev, sectionId]));



    // Trigger Scout chat with deletion context



    setMarketEntryCustomMessage("I noticed you removed the Market Entry & Growth Strategy section. Want me to help refine or replace it?");



    handleMarketEntryScoutClick('market-entry');



  };



  const handleMarketEntryEditHistoryOpen = () => {



    setIsMarketEntryEditHistoryOpen(true);



  };



  const handleMarketEntryEditHistoryClose = () => {



    setIsMarketEntryEditHistoryOpen(false);



  };



  const handleMarketEntryRevertEdit = (editId: string) => {



    const edit = marketEntryEditHistory.find(e => e.id === editId);



    if (!edit) return;







    // Revert the change based on the field



    switch (edit.field) {



      case 'Executive Summary':



        setMarketEntryData(prev => ({ ...prev, executiveSummary: edit.oldValue }));



        break;



      case 'Entry Barriers':



        setMarketEntryData(prev => ({ ...prev, entryBarriers: edit.oldValue.split(', ') }));



        break;



      case 'Recommended Channel':



        setMarketEntryData(prev => ({ ...prev, recommendedChannel: edit.oldValue }));



        break;



      case 'Time to Market':



        setMarketEntryData(prev => ({ ...prev, timeToMarket: edit.oldValue }));



        break;



      case 'Top Barrier':



        setMarketEntryData(prev => ({ ...prev, topBarrier: edit.oldValue }));



        break;



      case 'Competitive Differentiation':



        setMarketEntryData(prev => ({ ...prev, competitiveDifferentiation: edit.oldValue.split(', ') }));



        break;



      case 'Strategic Recommendations':



        setMarketEntryData(prev => ({ ...prev, strategicRecommendations: edit.oldValue.split(', ') }));



        break;



      case 'Risk Assessment':



        setMarketEntryData(prev => ({ ...prev, riskAssessment: edit.oldValue.split(', ') }));



        break;



    }







    // Create a record of the revert action



    const revertRecord: EditRecord = {



      id: Date.now().toString(),



      timestamp: new Date().toISOString(),



      user: 'Alex',



      summary: `Reverted ${edit.field} change`,



      field: edit.field,



      oldValue: edit.newValue,



      newValue: edit.oldValue



    };



    setMarketEntryEditHistory(prev => [revertRecord, ...prev]);



  };



  const handleMarketEntryViewEditDetails = (editId: string) => {






  };



  const handleMarketEntryExecutiveSummaryChange = (value: string) => {



    const oldValue = marketEntryData?.executiveSummary;



    if (oldValue !== value) {



      setMarketEntryHasEdits(true);



      const record: EditRecord = {



        id: Date.now().toString(),



        timestamp: new Date().toISOString(),



        user: 'Alex',



        summary: 'Updated executive summary',



        field: 'Executive Summary',



        oldValue,



        newValue: value



      };



      setMarketEntryEditHistory(prev => [record, ...prev]);



    }



    setMarketEntryData(prev => {

      const updated = { ...prev, executiveSummary: value };

      saveMarketEntryDataToLocalStorage(updated);

      return updated;

    });



  };







  const handleMarketEntryBarriersChange = (barriers: string[]) => {



    const oldValue = marketEntryData?.entryBarriers?.join(', ');



    const newValue = barriers.join(', ');



    if (oldValue !== newValue) {



      setMarketEntryHasEdits(true);



      const record: EditRecord = {



        id: Date.now().toString(),



        timestamp: new Date().toISOString(),



        user: 'Alex',



        summary: 'Updated entry barriers',



        field: 'Entry Barriers',



        oldValue,



        newValue



      };



      setMarketEntryEditHistory(prev => [record, ...prev]);



    }



    setMarketEntryData(prev => {

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



        user: 'Alex',



        summary: 'Updated recommended channel',



        field: 'Recommended Channel',



        oldValue,



        newValue: value



      };



      setMarketEntryEditHistory(prev => [record, ...prev]);



    }



    setMarketEntryData(prev => {

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



        user: 'Alex',



        summary: 'Updated time to market',



        field: 'Time to Market',



        oldValue,



        newValue: value



      };



      setMarketEntryEditHistory(prev => [record, ...prev]);



    }



    setMarketEntryData(prev => {

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



        user: 'Alex',



        summary: 'Updated top barrier',



        field: 'Top Barrier',



        oldValue,



        newValue: value



      };



      setMarketEntryEditHistory(prev => [record, ...prev]);



    }



    setMarketEntryData(prev => {

      const updated = { ...prev, topBarrier: value };

      saveMarketEntryDataToLocalStorage(updated);

      return updated;

    });



  };







  const handleMarketEntryCompetitiveDifferentiationChange = (differentiation: string[]) => {



    const oldValue = marketEntryData?.competitiveDifferentiation?.join(', ');



    const newValue = differentiation.join(', ');



    if (oldValue !== newValue) {



      setMarketEntryHasEdits(true);



      const record: EditRecord = {



        id: Date.now().toString(),



        timestamp: new Date().toISOString(),



        user: 'Alex',



        summary: 'Updated competitive differentiation',



        field: 'Competitive Differentiation',



        oldValue,



        newValue



      };



      setMarketEntryEditHistory(prev => [record, ...prev]);



    }



    setMarketEntryData(prev => {

      const updated = { ...prev, competitiveDifferentiation: differentiation };

      saveMarketEntryDataToLocalStorage(updated);

      return updated;

    });



  };







  const handleMarketEntryStrategicRecommendationsChange = (recommendations: string[]) => {



    const oldValue = marketEntryData?.strategicRecommendations?.join(', ');



    const newValue = recommendations.join(', ');



    if (oldValue !== newValue) {



      setMarketEntryHasEdits(true);



      const record: EditRecord = {



        id: Date.now().toString(),



        timestamp: new Date().toISOString(),



        user: 'Alex',



        summary: 'Updated strategic recommendations',



        field: 'Strategic Recommendations',



        oldValue,



        newValue



      };



      setMarketEntryEditHistory(prev => [record, ...prev]);



    }



    setMarketEntryData(prev => ({ ...prev, strategicRecommendations: recommendations }));



  };







  const handleMarketEntryRiskAssessmentChange = (risks: string[]) => {



    const oldValue = marketEntryData?.riskAssessment?.join(', ');



    const newValue = risks.join(', ');



    if (oldValue !== newValue) {



      setMarketEntryHasEdits(true);



      const record: EditRecord = {



        id: Date.now().toString(),



        timestamp: new Date().toISOString(),



        user: 'Alex',



        summary: 'Updated risk assessment',



        field: 'Risk Assessment',



        oldValue,



        newValue



      };



      setMarketEntryEditHistory(prev => [record, ...prev]);



    }



    setMarketEntryData(prev => ({ ...prev, riskAssessment: risks }));



  };











  const handleMarketEntryScoutClick = async (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance' | 'market-entry', hasEdits?: boolean, customMessage?: string) => {






    



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



    setEditHistoryContext('');



  };







  const handleRevertEdit = (editId: string) => {



    const edit = editHistory.find(e => e.id === editId);



    if (!edit) return;







    // Revert the change based on the field



    switch (edit.field) {



      // Regulatory fields



      case 'Regulatory Executive Summary':



        setRegulatoryData(prev => ({ ...prev, executiveSummary: edit.oldValue }));



        break;



      case 'EU AI Act Deadline':



        setRegulatoryData(prev => ({ ...prev, euAiActDeadline: edit.oldValue }));



        break;



      case 'GDPR Compliance':



        setRegulatoryData(prev => ({ ...prev, gdprCompliance: edit.oldValue }));



        break;



      case 'Potential Fines':



        setRegulatoryData(prev => ({ ...prev, potentialFines: edit.oldValue }));



        break;



      case 'Data Localization':



        setRegulatoryData(prev => ({ ...prev, dataLocalization: edit.oldValue }));



        break;



      



      // Market Size fields - using the correct API data structure



      case 'Market Executive Summary':



        setMarketIntelligenceData(prev => ({ ...prev, executiveSummary: edit.oldValue }));



        break;



      case 'Market TAM':



        setMarketIntelligenceData(prev => ({ ...prev, tamValue: edit.oldValue }));



        break;



      case 'Market SAM':



        setMarketIntelligenceData(prev => ({ ...prev, samValue: edit.oldValue }));



        break;



      case 'Market SOM':



        setMarketIntelligenceData(prev => ({ ...prev, somValue: edit.oldValue }));



        break;



      case 'Growth Rate':



        setMarketIntelligenceData(prev => ({ ...prev, GrowthRate: edit.oldValue }));



        break;



      case 'North America Growth':



        setMarketIntelligenceData(prev => ({ ...prev, northAmericaGrowthRate: edit.oldValue }));



        break;



      case 'Europe Growth':



        setMarketIntelligenceData(prev => ({ ...prev, europeGrowthRate: edit.oldValue }));



        break;



      



      // Industry Trends fields  



      case 'Industry Trends Executive Summary':



        setIndustryTrendsData(prev => ({ ...prev, executiveSummary: edit.oldValue }));



        break;



      case 'AI Adoption Rate':



        setIndustryTrendsData(prev => ({ ...prev, aiAdoption: edit.oldValue }));



        break;



      case 'Cloud Migration':



        setIndustryTrendsData(prev => ({ ...prev, cloudMigration: edit.oldValue }));



        break;



      case 'Regulatory Changes':



        setIndustryTrendsData(prev => ({ ...prev, regulatory: edit.oldValue }));



        break;



      



      // Competitor fields



      case 'Competitor Executive Summary':



        setCompetitorData(prev => ({ ...prev, executiveSummary: edit.oldValue }));



        break;



      case 'Top Player Market Share':



        setCompetitorData(prev => ({ ...prev, topPlayerShare: edit.oldValue }));



        break;



      case 'Emerging Players':



        setCompetitorData(prev => ({ ...prev, emergingPlayers: edit.oldValue }));



        break;



      case 'Funding News':



        // Parse the old value back to array if it was stringified



        const fundingArray = typeof edit.oldValue === 'string' && edit.oldValue.startsWith('[') 



          ? JSON.parse(edit.oldValue) 



          : [edit.oldValue];



        setCompetitorData(prev => ({ ...prev, fundingNews: fundingArray }));



        break;



        



      // Section deletions - restore section



      default:



        if (edit.newValue === 'Section deleted') {



          // Restore deleted sections for regulatory



          if (edit.field.includes('Regulatory') && edit.field.includes('Section')) {



            setRegulatoryDeletedSections(prev => {



              const newSet = new Set(prev);



              const sectionMap: Record<string, string> = {



                'Executive Summary Section': 'executive-summary',



                'Key Regulatory Updates Section': 'key-updates',



                'Compliance Analytics Section': 'compliance-analytics',



                'Regional Compliance Overview Section': 'regional-breakdown',



                'Strategic Recommendations Section': 'strategic-recommendations'



              };



              const sectionId = sectionMap[edit.field];



              if (sectionId) newSet.delete(sectionId);



              return newSet;



            });



          }



          // Restore deleted sections for industry trends



          else if (edit.field.includes('Industry Trends') && edit.field.includes('Section')) {



            setIndustryTrendsDeletedSections(prev => {



              const newSet = new Set(prev);



              const sectionMap: Record<string, string> = {



                'Industry Trends Executive Summary Section': 'executive-summary'



              };



              const sectionId = sectionMap[edit.field];



              if (sectionId) newSet.delete(sectionId);



              return newSet;



            });



          }



          // Restore deleted sections for competitor landscape



          else if (edit.field.includes('Competitor') && edit.field.includes('Section')) {



            setCompetitorDeletedSections(prev => {



              const newSet = new Set(prev);



              const sectionMap: Record<string, string> = {



                'Competitor Executive Summary Section': 'executive-summary'



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



    const editIndex = editHistory.findIndex(e => e.id === editId);



    if (editIndex !== -1) {



      setEditHistory(prev => prev.slice(editIndex + 1));



      



      // Add a new edit record for the revert action



      const revertRecord: EditRecord = {



        id: `revert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,



        timestamp: new Date().toISOString(),



        user: 'Alex',



        summary: `Reverted ${edit.field} to previous value`,



        field: edit.field,



        oldValue: edit.newValue,



        newValue: edit.oldValue



      };



      setEditHistory(prev => [revertRecord, ...prev]);



    }



  };







  const handleViewEditDetails = (editId: string) => {



    // TODO: Implement view details functionality






  };







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



  // Check if any component has valid data (with timestamp)
  const hasAnyValidData = marketData || 
                     (industryTrendsData && industryTrendsData.timestamp) ||
                     (competitorData && competitorData.timestamp) ||
                     (marketEntryData && marketEntryData.timestamp) ||
                     (regulatoryData && regulatoryData.timestamp);

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







  // Simple delay function for rate limiting

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));



  // Parallel refresh function for faster loading

  const parallelRefresh = async () => {


    

    const components = [

      { name: 'Market Size', fetchFn: fetchMarketSizeData },

      { name: 'Competitor Landscape', fetchFn: fetchCompetitorData },

      { name: 'Industry Trends', fetchFn: fetchIndustryTrendsData },

      { name: 'Market Entry', fetchFn: fetchMarketEntryData },

      { name: 'Regulatory Compliance', fetchFn: fetchRegulatoryData }

    ];

    

    // Process all components in parallel with rate limiting

    const promises = components.map(async (component, index) => {

      try {

        // Add small staggered delay to prevent overwhelming the API

        const staggerDelay = index * 200; // 200ms between each component start

        if (staggerDelay > 0) {

          await new Promise(resolve => setTimeout(resolve, staggerDelay));

        }

        


        const result = await executeWithRateLimit(

          () => component.fetchFn(true, false),

          component.name

        );

        


        return { status: 'fulfilled', value: result };

        

      } catch (error) {

        console.error(`❌ ${component.name} fetch failed:`, error);

        return { 

          status: 'rejected', 

          reason: { 

            status: 'error', 

            component: component.name.toLowerCase().replace(' ', '-'), 

            error: error instanceof Error ? error.message : 'Unknown error' 

          } 

        };

      }

    });

    

    // Wait for all components to complete

    const results = await Promise.allSettled(promises);


    

    return results;

  };







  return (



    <Layout>



      <div className="flex flex-col h-full relative">



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



            {error && marketData && !isRefreshing && !isInitialLoading && !isShowingHistoricalData && !error.includes('rate limiting') && !error.includes('429') && !error.includes('rate_limit') && (



              <Alert className="mb-4 border-red-200 bg-red-50">



                <AlertCircle className="h-4 w-4 text-red-600" />



                <AlertDescription className="text-red-800">



                  Operation failed: {error}. Showing previous data.



                </AlertDescription>



              </Alert>



            )}



            



            {/* Cache indicator when showing cached data and not loading */}



            {marketData && (() => {
              const cache = getUserCache(currentUser?.uid);
              return cache.data === marketData && cache.timestamp;
            })() && !isRefreshing && !isInitialLoading && !isShowingHistoricalData && (() => {
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


            
            



            <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">



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



            </Tabs>



          </div>



        </div>



        



        {/* Scrollable content area - ALWAYS show content if data exists */}



        {activeTab === "trends" ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden -mx-3 md:-mx-4 lg:-mx-6 w-[calc(100%+1.5rem)] md:w-[calc(100%+2rem)] lg:w-[calc(100%+3rem)] max-w-none">
            {scoutResearchContext ? (
              <div className="px-3 md:px-4 lg:px-6 py-4 h-full">
                <ChatWithScout fullPage researchContext={scoutResearchContext} mode={scoutMode} />
              </div>
            ) : (
              <ScoutChatWithHistory
                initialContext={signalsChatContext}
                onClearContext={() => {
                  sessionStorage.removeItem('signalsChatContext');
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



          <div className={`transition-opacity duration-300 ${

            (isRefreshing || isInitialLoading) && marketData ? 'opacity-70' : 'opacity-100'

          } relative h-full min-h-0 flex flex-col`}>



            {/* Show main content when not refreshing */}

            {!isRefreshing ? (

            <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-0 h-full min-h-0 flex flex-col">



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

                      competitorExecutiveSummary={competitorData?.executiveSummary || ''}

                      competitorTopPlayerShare={competitorData?.topPlayerShare || ''}

                      competitorEmergingPlayers={competitorData?.emergingPlayers || ''}

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



                       strategicRecommendations={marketData?.strategicRecommendations || marketIntelligenceData.strategicRecommendations}



                       marketEntry={marketData?.marketEntry || marketIntelligenceData.marketEntry}



                       marketDrivers={marketData?.marketDrivers || marketIntelligenceData.marketDrivers}



                        marketSizeBySegment={marketData?.marketSizeBySegment || marketIntelligenceData.marketSizeBySegment}



                        growthProjections={marketData?.growthProjections || marketIntelligenceData.growthProjections}



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



                        regulatoryExecutiveSummary={regulatoryData?.executiveSummary || ''}



                       regulatoryEuAiActDeadline={regulatoryData?.euAiActDeadline || ''}



                       regulatoryGdprCompliance={regulatoryData?.gdprCompliance || ''}



                       regulatoryPotentialFines={regulatoryData?.potentialFines || ''}



                       regulatoryDataLocalization={regulatoryData?.dataLocalization || ''}



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



                        setMarketIntelligenceData(prev => {



                          // CRITICAL: Always include user_id to ensure data isolation
                          const newData = { ...prev, strategicRecommendations: recommendations, user_id: currentUser?.uid || prev.user_id };



                          saveMarketIntelligenceToLocalStorage(newData);



                          // Also update marketData to keep them in sync - initialize if null
                          setMarketData(prev => prev ? { ...prev, strategicRecommendations: recommendations } : {
                            ...newData,
                            strategicRecommendations: recommendations
                          });



                          return newData;



                        });



                      }}



                      onMarketEntryChange={(value) => {



                        setMarketIntelligenceData(prev => {



                          // CRITICAL: Always include user_id to ensure data isolation
                          const newData = { ...prev, marketEntry: value, user_id: currentUser?.uid || prev.user_id };



                          saveMarketIntelligenceToLocalStorage(newData);



                          // Also update marketData to keep them in sync - initialize if null
                          setMarketData(prev => prev ? { ...prev, marketEntry: value } : {
                            ...newData,
                            marketEntry: value
                          });



                          return newData;



                        });



                      }}



                      onMarketDriversChange={(drivers) => {



                        setMarketIntelligenceData(prev => {



                          // CRITICAL: Always include user_id to ensure data isolation
                          const newData = { ...prev, marketDrivers: drivers, user_id: currentUser?.uid || prev.user_id };



                          saveMarketIntelligenceToLocalStorage(newData);



                          // Also update marketData to keep them in sync - initialize if null
                          setMarketData(prev => prev ? { ...prev, marketDrivers: drivers } : {
                            ...newData,
                            marketDrivers: drivers
                          });



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



                      onMarketEntryCompetitiveDifferentiationChange={handleMarketEntryCompetitiveDifferentiationChange}



                      onMarketEntryStrategicRecommendationsChange={handleMarketEntryStrategicRecommendationsChange}



                      onMarketEntryRiskAssessmentChange={handleMarketEntryRiskAssessmentChange}



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



                      <Button onClick={() => fetchMarketData()} className="flex items-center gap-2">



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
                  onResearchWithScout={handleResearchWithScout}
                />



              </TabsContent>



              



              <TabsContent value="trends" className="mt-0 hidden">
                {/* Chat tab content rendered above when activeTab === 'trends' */}
                <div />
              </TabsContent>



            </Tabs>

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



      </div>







      {/* Market Detail Drawer */}



      <MarketDetailDrawer



        isOpen={isDrawerOpen}



        onOpenChange={setIsDrawerOpen}



        selectedMarket={selectedMarket}



        isAIViewActive={isAIViewActive}



      />







      {/* Scout Settings Form */}



      <ScoutSettingsForm



        isOpen={isSettingsOpen}



        onOpenChange={setIsSettingsOpen}



      />

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
                  animation: 'logo-reveal 2.5s ease-in-out infinite',
                  clipPath: 'inset(0% 0% 0% 0%)'
                }}
              />
            </div>
            {/* Loading Text */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg font-semibold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                Refreshing Scout data
              </p>
              <p className="text-sm text-muted-foreground font-medium">Please wait while we update your market intelligence...</p>
            </div>
            {/* Animated Progress Dots */}
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </Layout>



  );



});







export default MarketResearch;


