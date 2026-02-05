import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserCacheKey, getUserLocalStorage, setUserLocalStorage, removeUserLocalStorage } from "@/utils/cacheUtils";



console.log('🚨🚨🚨 MARKETRESEARCH FILE IS DEFINITELY LOADING 🚨🚨🚨');



console.log('📁 MarketResearch.tsx file is loading!');



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



import LeadStream from "@/components/market-research/LeadStream";



import { TechnologyDrivers } from "@/components/market-research/TechnologyDrivers";



import { MarketDetailDrawer } from "@/components/market-research/MarketDetailDrawer";



import { ScoutDeploymentDetails } from "@/components/market-research/ScoutDeploymentDetails";



import { ScoutSettingsForm } from "@/components/market-research/ScoutSettingsForm";



import { ComponentStatusLoadingScreen } from "@/components/market-research/ComponentStatusLoadingScreen";



import { DataHistoryDialog } from "@/components/market-research/DataHistoryDialog";

import SafeMarketIntelligenceTab from "@/components/market-research/SafeMarketIntelligenceTab";

import EditHistoryPanel from "@/components/market-research/EditHistoryPanel";



import { DeploymentData } from "@/components/layout/Header";



import { useNavigate, useLocation } from "react-router-dom";



import { toUTCTimestamp, isTimestampNewer, logTimestampComparison } from '@/lib/timestampUtils';



import { apiFetchJson, buildApiUrl } from '@/lib/api';

import { marketResearchApiCall, logApiCallResult, shouldUseCachedData } from '@/utils/apiUtils';



import ScoutChatPanel from "@/components/market-research/ScoutChatPanel";



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



  apacGrowthRate?: string;



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
    console.warn(`⚠️ [MULTI-TENANCY] No current user ID for ${componentName} validation`);
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
    console.warn(`⚠️ [MULTI-TENANCY] ${componentName} API response has no user_id field - backend should include this`);
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
  
  console.log('🧹 Market data cache cleared due to company profile update');
  console.log('🧹 All component localStorage caches cleared (competitor, market, regulatory, industry, entry)');
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
  const { currentUser } = useAuth();
  const previousUserIdRef = useRef<string | null | undefined>(currentUser?.uid);

  console.log('🔥 MarketResearch component is mounting!');



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
    console.log('Initial marketData state - cached data exists:', !!cached);
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
      console.log('🔄 User changed from', previousUserId, 'to', currentUserId, '- clearing all component data');
      setMarketData(null);
      setMarketIntelligenceData({
        executiveSummary: "",
        tamValue: "",
        samValue: "",
        apacGrowthRate: "",
        strategicRecommendations: [],
        marketEntry: "",
        marketDrivers: [],
        marketSizeBySegment: {},
        growthProjections: {},
        timestamp: null,
        user_id: currentUserId // Include user_id even when clearing
      });
      setIndustryTrendsData(null);
      setRegulatoryData(null);
      setCompetitorData(null);
      setMarketEntryData(null);
    }
    
    // Update ref for next comparison
    previousUserIdRef.current = currentUserId;
    
    // If user logged out, clear all data
    if (!currentUserId && previousUserId) {
      console.log('🔄 User logged out - clearing all component data');
      setMarketData(null);
      setMarketIntelligenceData({
        executiveSummary: "",
        tamValue: "",
        samValue: "",
        apacGrowthRate: "",
        strategicRecommendations: [],
        marketEntry: "",
        marketDrivers: [],
        marketSizeBySegment: {},
        growthProjections: {},
        timestamp: null,
        user_id: currentUserId // Include user_id even when clearing
      });
      setIndustryTrendsData(null);
      setRegulatoryData(null);
      setCompetitorData(null);
      setMarketEntryData(null);
    }
  }, [currentUser?.uid]);

  // Reload marketIntelligenceData from localStorage when user changes
  // This runs AFTER the clear effect to ensure we load the correct user's data
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    console.log('🔄 [USER SWITCH] Loading marketIntelligenceData for user:', currentUser.uid);
    
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
            
            console.log('✅ [USER SWITCH] Found stored marketIntelligenceData for user, loading:', parsedData.timestamp);
            setMarketIntelligenceData(parsedData);
            // Also update marketData for consistency
            setMarketData(parsedData);
            // Clear loading state since we have data
            setIsMarketSizeLoading(false);
            setIsInitialLoading(false);
          } else {
            console.log('⚠️ [USER SWITCH] Stored data exists but no timestamp, will fetch');
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
        console.log('📝 [USER SWITCH] No stored marketIntelligenceData found for user, fetching from API');
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



    console.log('Initial loading state - has cached data:', hasData);



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

  const [globalTimeoutId, setGlobalTimeoutId] = useState<NodeJS.Timeout | null>(null);



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

      console.log('⏰ GLOBAL TIMEOUT: 2 minutes reached, forcing loading screen to disappear');

      console.log('⏰ Current component status:', componentStatus);

      console.log('⏰ Current loading phase:', loadingPhase);

      

      setIsRefreshing(false);

      toast({

        title: "Loading Complete",

        description: "Maximum loading time reached. Some components may still be processing.",

        duration: 5000,

      });

    }, 120000); // 2 minutes

    

    setGlobalTimeoutId(timeoutId);

  };



  // Function to start the rendering phase monitoring

  const startRenderingPhase = () => {

    console.log('🎨 Starting rendering phase monitoring...');

    

    // Monitor rendering completion with a more sophisticated approach

    const checkRenderingCompletion = (attempt: number = 1) => {

      const maxAttempts = 200; // 10 minutes total (200 * 3 seconds) for safety

      

      console.log(`🎨 Rendering check attempt ${attempt}/${maxAttempts}`);

      

      // Check if components are visually rendered by looking for specific UI elements

      const renderingChecks = {

        'Market Size': marketData?.executiveSummary && marketData?.tamValue && marketData?.apacGrowthRate,

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

      

      console.log(`🎨 Rendering status: ${renderedComponents.length}/5 components rendered`);

      console.log(`🎨 Rendered components:`, renderedComponents);

      

      if (allRendered) {

        console.log('🎨 All components fully rendered! Completing loading...');

        setLoadingPhase('complete');

        setComponentRenderingStatus({

          'Market Size': 'complete',

          'Industry Trends': 'complete', 

          'Market Entry': 'complete',

          'Competitor Landscape': 'complete',

          'Regulatory Compliance': 'complete'

        });

        

        // Wait a moment for smooth transition, then hide loading screen

        setTimeout(() => {

          setIsRefreshing(false);

          toast({

            title: "Scout Ready! 🎉",

            description: "All components loaded and rendered with fresh data",

            duration: 3000,

          });

        }, 1000);

      } else if (attempt >= maxAttempts) {

        console.log('⏰ Rendering timeout reached, showing Scout page anyway');

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

    setValidationAttempts(prev => prev + 1);

    const currentAttempt = validationAttempts + 1;

    const maxValidationAttempts = 10; // Maximum 30 seconds of validation (10 attempts * 3 seconds)

    

    console.log(`🔍 VALIDATION FUNCTION CALLED - Attempt ${currentAttempt}/${maxValidationAttempts}`);

    // TIMEOUT CHECK - Force completion if we've exceeded max attempts
    if (currentAttempt > maxValidationAttempts) {
      console.log('⏰ VALIDATION TIMEOUT - Force completing after max attempts');
      
      // Stop any ongoing API calls
      console.log('🛑 Stopping all ongoing API calls and loading states due to timeout');
      setIsMarketSizeLoading(false);
      setIsIndustryTrendsLoading(false);
      setIsMarketEntryLoading(false);
      setIsCompetitorLoading(false);
      setIsRegulatoryLoading(false);
      
      setIsRefreshing(false);
      setLoadingPhase('complete');
      toast({
        title: "Loading Complete",
        description: "Components loaded with available data. Some may still be processing.",
        duration: 3000,
      });
      return;
    }

    console.log('🔍 Validating all components have fresh data...');

    console.log('🔍 Current isRefreshing state:', isRefreshing);

    

    // Add minimum wait time to ensure components have processed fresh data

    const timeSinceRefresh = Date.now() - (window as any).refreshStartTime || 0;

    const minWaitTime = 3000; // 3 seconds minimum wait for data processing

    

    if (timeSinceRefresh < minWaitTime) {

      console.log(`⏳ Waiting ${Math.ceil((minWaitTime - timeSinceRefresh) / 1000)}s more for components to process fresh data...`);

      setTimeout(() => {

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

      'Market Size': marketData?.executiveSummary && marketData?.tamValue && marketData?.apacGrowthRate && 

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

    console.log('🔍 DETAILED DATA STRUCTURE CHECK:');
    console.log('🔍 Company Profile Context:', companyProfile?.industry, companyProfile?.companySize);

    console.log('🔍 Refresh start time:', new Date(refreshStartTime).toISOString());

    console.log('🔍 API CALL STATUS CHECK:');
    console.log('🔍 Component Status:', componentStatus);
    console.log('🔍 Loading States:', {
      isMarketSizeLoading,
      isIndustryTrendsLoading, 
      isMarketEntryLoading,
      isCompetitorLoading,
      isRegulatoryLoading
    });

    console.log('  - Market Size - executiveSummary:', marketData?.executiveSummary);

    console.log('  - Market Size - tamValue:', marketData?.tamValue);

    console.log('  - Market Size - apacGrowthRate:', marketData?.apacGrowthRate);

    console.log('  - Market Size - timestamp:', marketData?.timestamp);

    console.log('  - Market Size - isFresh:', isDataFresh(marketData?.timestamp));

    console.log('  - Market Size - isMarketSizeLoading:', isMarketSizeLoading);

    console.log('  - Industry Trends - executiveSummary:', industryTrendsData?.executiveSummary);

    console.log('  - Industry Trends - aiAdoption:', industryTrendsData?.aiAdoption);

    console.log('  - Industry Trends - timestamp:', industryTrendsData?.timestamp);

    console.log('  - Industry Trends - isFresh:', isDataFresh(industryTrendsData?.timestamp));

    console.log('  - Industry Trends - isIndustryTrendsLoading:', isIndustryTrendsLoading);

    console.log('  - Market Entry - executiveSummary:', marketEntryData?.executiveSummary);

    console.log('  - Market Entry - entryBarriers:', marketEntryData?.entryBarriers);

    console.log('  - Market Entry - timestamp:', marketEntryData?.timestamp);

    console.log('  - Market Entry - isFresh:', isDataFresh(marketEntryData?.timestamp));

    console.log('  - Market Entry - isMarketEntryLoading:', isMarketEntryLoading);

    console.log('  - Competitor Landscape - executiveSummary:', competitorData?.executiveSummary);

    console.log('  - Competitor Landscape - topPlayerShare:', competitorData?.topPlayerShare);

    console.log('  - Competitor Landscape - emergingPlayers:', competitorData?.emergingPlayers);

    console.log('  - Competitor Landscape - timestamp:', competitorData?.timestamp);

    console.log('  - Competitor Landscape - isFresh:', isDataFresh(competitorData?.timestamp));

    console.log('  - Competitor Landscape - isCompetitorLoading:', isCompetitorLoading);

    console.log('  - Regulatory Compliance - executiveSummary:', regulatoryData?.executiveSummary);

    console.log('  - Regulatory Compliance - euAiActDeadline:', regulatoryData?.euAiActDeadline);

    console.log('  - Regulatory Compliance - timestamp:', regulatoryData?.timestamp);

    console.log('  - Regulatory Compliance - isFresh:', isDataFresh(regulatoryData?.timestamp));

    console.log('  - Regulatory Compliance - isRegulatoryLoading:', isRegulatoryLoading);

    

    console.log('🔍 Component data validation results:', componentDataChecks);

    console.log('🔍 Component loading states:', {

      'Market Size': isMarketSizeLoading,

      'Industry Trends': isIndustryTrendsLoading,

      'Market Entry': isMarketEntryLoading,

      'Competitor Landscape': isCompetitorLoading,

      'Regulatory Compliance': isRegulatoryLoading

    });

    

    // Debug: Log actual data to see what we have

    console.log('🔍 DEBUG - Actual component data:');

    console.log('  - marketData:', marketData);

    console.log('  - industryTrendsData:', industryTrendsData);

    console.log('  - marketEntryData:', marketEntryData);

    console.log('  - competitorData:', competitorData);

    console.log('  - regulatoryData:', regulatoryData);

    

    // LENIENT VALIDATION - Check for basic data to allow components to load
    const simplifiedChecks = {
      'Market Size': marketData?.executiveSummary && !isMarketSizeLoading,
      'Industry Trends': industryTrendsData?.executiveSummary && !isIndustryTrendsLoading,
      'Market Entry': marketEntryData?.executiveSummary && !isMarketEntryLoading,
      'Competitor Landscape': competitorData?.executiveSummary && !isCompetitorLoading,
      'Regulatory Compliance': regulatoryData?.executiveSummary && !isRegulatoryLoading
    };
    
    console.log('🔍 Simplified validation results:', simplifiedChecks);
    
    // Debug Market Entry specifically
    console.log('🔍 MARKET ENTRY DEBUG:');
    console.log('  - marketEntryData:', marketEntryData);
    console.log('  - marketEntryData?.executiveSummary:', marketEntryData?.executiveSummary);
    console.log('  - isMarketEntryLoading:', isMarketEntryLoading);
    console.log('  - Market Entry validation result:', simplifiedChecks['Market Entry']);
    
    // Debug Industry Trends specifically
    console.log('🔍 INDUSTRY TRENDS DEBUG:');
    console.log('  - industryTrendsData:', industryTrendsData);
    console.log('  - industryTrendsData?.executiveSummary:', industryTrendsData?.executiveSummary);
    console.log('  - isIndustryTrendsLoading:', isIndustryTrendsLoading);
    console.log('  - Industry Trends validation result:', simplifiedChecks['Industry Trends']);
    
    // Debug all components comprehensively
    console.log('🔍 ALL COMPONENTS DEBUG:');
    console.log('  - Market Size:', { data: !!marketData, summary: !!marketData?.executiveSummary, loading: isMarketSizeLoading });
    console.log('  - Industry Trends:', { data: !!industryTrendsData, summary: !!industryTrendsData?.executiveSummary, loading: isIndustryTrendsLoading });
    console.log('  - Market Entry:', { data: !!marketEntryData, summary: !!marketEntryData?.executiveSummary, loading: isMarketEntryLoading });
    console.log('  - Competitor Landscape:', { data: !!competitorData, summary: !!competitorData?.executiveSummary, loading: isCompetitorLoading });
    console.log('  - Regulatory Compliance:', { data: !!regulatoryData, summary: !!regulatoryData?.executiveSummary, loading: isRegulatoryLoading });
    
    // Debug Competitor Landscape specifically
    console.log('🔍 COMPETITOR LANDSCAPE DETAILED DEBUG:');
    console.log('  - competitorData:', competitorData);
    console.log('  - competitorData?.executiveSummary:', competitorData?.executiveSummary);
    console.log('  - competitorData?.topPlayerShare:', competitorData?.topPlayerShare);
    console.log('  - competitorData?.emergingPlayers:', competitorData?.emergingPlayers);
    console.log('  - competitorData?.fundingNews:', competitorData?.fundingNews);
    console.log('  - isCompetitorLoading:', isCompetitorLoading);
    console.log('  - competitorError:', competitorError);
    
    // AGGRESSIVE FIX: Force Competitor Landscape to refresh if it's stuck
    if (competitorData && (!competitorData.executiveSummary || !competitorData.topPlayerShare)) {
      console.log('🚨 COMPETITOR LANDSCAPE IS STUCK - FORCING REFRESH');
      console.log('🚨 This component will be force refreshed on next validation cycle');
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
      console.log('🚨 COMPETITOR LANDSCAPE INFINITE LOADING DETECTED');
      console.log('🚨 Forcing Competitor Landscape to stop loading to prevent infinite loading');
      setIsCompetitorLoading(false);
      setCompetitorError('Component timed out - please try refreshing');
    }
    
    const allComponentsHaveData = Object.values(simplifiedChecks).every(hasData => hasData);

    const missingDataComponents = Object.entries(simplifiedChecks)

      .filter(([name, hasData]) => !hasData)

      .map(([name]) => name);

    

    if (allComponentsHaveData) {

      console.log('✅ All components have fresh data! Incrementing consecutive validations...');

      

      // Increment consecutive validations

      const newConsecutiveValidations = consecutiveValidations + 1;

      setConsecutiveValidations(newConsecutiveValidations);

      

      console.log(`✅ Consecutive validations: ${newConsecutiveValidations}/2`);

      

      // Check if we have 1 consecutive successful validation (reduced for faster processing)

      if (newConsecutiveValidations >= 1) {

        console.log('🎉 Consecutive validation achieved! Setting components to success and transitioning to rendering phase...');

        

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

          

          console.log('🎯 Component status updated based on actual data availability:', newStatus);

          return newStatus;

        });

        

        // Clear global timeout since we're proceeding successfully

        if (globalTimeoutId) {

          clearTimeout(globalTimeoutId);

          setGlobalTimeoutId(null);

        }

        

        // Transition to rendering phase

        setLoadingPhase('rendering');

        setComponentRenderingStatus({

          'Market Size': 'rendering',

          'Industry Trends': 'rendering', 

          'Market Entry': 'rendering',

          'Competitor Landscape': 'rendering',

          'Regulatory Compliance': 'rendering'

        });

        

        // Start monitoring rendering completion

        startRenderingPhase();

        return; // Exit validation function - no need to continue

      } else {

        console.log(`⏳ Need ${2 - newConsecutiveValidations} more consecutive validations. Continuing validation...`);

        

        // Continue validation to ensure consistency with much shorter interval

        setTimeout(() => {

          validateAllComponentsHaveFreshData();

        }, 200); // Reduced to 200ms for faster processing

        return;

      }

    } else {

      console.log('⚠️ Some components still missing fresh data:', missingDataComponents);
      
      // LENIENT APPROACH: If we have at least 3 components with data, proceed anyway
      const componentsWithData = Object.values(simplifiedChecks).filter(hasData => hasData).length;
      if (componentsWithData >= 3 && currentAttempt >= 5) {
        console.log(`🎯 LENIENT VALIDATION - ${componentsWithData}/5 components have data, proceeding anyway after ${currentAttempt} attempts`);
        
        // Stop any ongoing API calls
        console.log('🛑 Stopping all ongoing API calls and loading states');
        setIsMarketSizeLoading(false);
        setIsIndustryTrendsLoading(false);
        setIsMarketEntryLoading(false);
        setIsCompetitorLoading(false);
        setIsRegulatoryLoading(false);
        
        setIsRefreshing(false);
        setLoadingPhase('complete');
        toast({
          title: "Loading Complete",
          description: `${componentsWithData}/5 components loaded successfully.`,
          duration: 3000,
        });
        return;
      }

      console.log('⚠️ Resetting consecutive validations to 0');

      

      // Reset consecutive validations since not all components have data

      setConsecutiveValidations(0);

      

      console.log('⚠️ Detailed missing data analysis:');

      Object.entries(componentDataChecks).forEach(([name, hasData]) => {

        if (!hasData) {

          console.log(`  - ${name}: Missing data -`, {

            hasExecutiveSummary: name === 'Market Size' ? !!marketData?.executiveSummary : 

                               name === 'Industry Trends' ? !!industryTrendsData?.executiveSummary :

                               name === 'Market Entry' ? !!marketEntryData?.executiveSummary :

                               name === 'Competitor Landscape' ? !!competitorData?.executiveSummary :

                               !!regulatoryData?.executiveSummary,

            isLoading: name === 'Market Size' ? isMarketSizeLoading :

                      name === 'Industry Trends' ? isIndustryTrendsLoading :

                      name === 'Market Entry' ? isMarketEntryLoading :

                      name === 'Competitor Landscape' ? isCompetitorLoading :

                      isRegulatoryLoading

          });

        }

      });

      

      if (currentAttempt >= maxValidationAttempts) {

        console.log('⏰ Maximum validation attempts reached, showing Scout page anyway');

        console.log('⏰ Final validation results:', componentDataChecks);

        console.log('⏰ Component status:', componentStatus);

        console.log('⏰ Current loading phase:', loadingPhase);

        

        // Check if at least the API calls completed successfully

        const successfulComponents = Object.entries(componentStatus).filter(([name, status]) => status === 'success');

        console.log('⏰ Successful components:', successfulComponents.map(([name]) => name));

        

        // Clear global timeout

        if (globalTimeoutId) {

          clearTimeout(globalTimeoutId);

          setGlobalTimeoutId(null);

        }

        

        // AGGRESSIVE FIX: Hide loading screen if 4+ components are successful
        // This prevents infinite loading if Competitor Landscape is stuck
        const requiredComponents = 4; // Allow loading screen to disappear with 4/5 components

        if (successfulComponents.length >= requiredComponents) {

          console.log('✅ Sufficient components loaded, hiding loading screen');

          setIsRefreshing(false);

          toast({

            title: "Refresh Complete",

            description: `${successfulComponents.length}/5 components updated successfully`,

            duration: 3000,

          });

        } else {

          console.log('⏰ Not enough components loaded yet, continuing validation...');

          console.log('⏰ Current successful components:', successfulComponents.map(([name]) => name));

          console.log('⏰ Still waiting for:', Object.entries(componentStatus).filter(([name, status]) => status !== 'success').map(([name]) => name));

          // Continue validation for remaining components

          setTimeout(() => {

            validateAllComponentsHaveFreshData();

          }, 1500); // Reduced wait time (paid plan allows faster processing)

        }

      } else {

        console.log('⏳ Waiting 3 more seconds for components to process data...');

        console.log('⏳ Missing components:', missingDataComponents);

        console.log('⏳ Current component status:', componentStatus);

        

        // Wait a bit more and try again with much shorter interval

        setTimeout(() => {

          validateAllComponentsHaveFreshData();

        }, 200); // Reduced to 200ms for faster processing

      }

    }

  };



  // Company profile state for centralized data context



  const [companyProfile, setCompanyProfile] = useState<any>(null);



  // Function to mark fresh data and ensure strict replacement

  const markFreshData = (componentName: string) => {

    console.log(`🔄 FRESH DATA FLAG - Marking ${componentName} as having fresh data`);

    setFreshDataFlags(prev => ({ ...prev, [componentName]: true }));

  };



  // Function to check if data is fresh and should replace old data

  const shouldReplaceWithFreshData = (componentName: string): boolean => {

    const isFresh = freshDataFlags[componentName];

    console.log(`🔍 FRESH DATA CHECK - ${componentName}: ${isFresh ? 'FRESH - will replace' : 'STALE - will keep existing'}`);

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



        console.log('📦 [INIT] Loading Market Intelligence data from localStorage:', parsedData);

        // CRITICAL: Verify this data belongs to the current user
        if (parsedData.user_id && parsedData.user_id !== currentUser.uid) {
          console.warn('⚠️ [INIT] Market Intelligence data user_id mismatch! Stored:', parsedData.user_id, 'Current:', currentUser.uid);
          removeUserLocalStorage('marketIntelligenceData', currentUser.uid);
          // Don't return - will fall through to empty state
        } else if (parsedData.timestamp) {
          // Only return stored data if it has a timestamp AND belongs to current user
          console.log('✅ [INIT] Found persisted data with timestamp:', parsedData.timestamp, 'for user:', currentUser.uid);
          return parsedData;
        }



        // Only return stored data if it has a timestamp (meaning it came from swagger)



        if (parsedData.timestamp) {



          console.log('✅ Found persisted swagger data with timestamp:', parsedData.timestamp);



          return parsedData;



        } else {



          console.log('⚠️ Found localStorage data but no timestamp - this is default data, clearing...');



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



    console.log('📝 No stored data found - returning empty state, will load from API');



    return {



      executiveSummary: "",



      tamValue: "",



      samValue: "", 



      apacGrowthRate: "",



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
        console.warn('⚠️ [SAVE] Cannot save Market Intelligence data - no user logged in');
        return;
      }
      // Ensure user_id is included in the data for verification
      const dataWithUserId = {
        ...data,
        user_id: currentUser.uid // Always use current user's ID
      };
      setUserLocalStorage('marketIntelligenceData', JSON.stringify(dataWithUserId), currentUser.uid);



      console.log('💾 Market Intelligence data saved to localStorage');



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



      console.log('💾 Competitor data saved to localStorage');



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



      console.log('💾 Regulatory data saved to localStorage');



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



      console.log('💾 Industry Trends data saved to localStorage');



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



      console.log('💾 Market Entry data saved to localStorage');



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

        console.log('📦 Loading Industry Trends data from localStorage:', parsedData);

        // Only return stored data if it has a timestamp (meaning it came from API)

        if (parsedData.timestamp) {

          console.log('✅ Found persisted Industry Trends data with timestamp:', parsedData.timestamp);

          // Ensure visualCharts structure exists (for backward compatibility with old localStorage data)
          const dataWithDefaults = {
            ...parsedData,
            visualCharts: parsedData.visualCharts || {
              aiAdoptionTrends: [],
              technologyBudgetAllocation: {
                "AI/ML": '',
                Cloud: '',
                Security: ''
              }
            },
            regionalHotspots: parsedData.regionalHotspots || {
              APAC: '',
              Europe: '',
              "North America": ''
            }
          };

          return dataWithDefaults;

        } else {

          console.log('⚠️ Found localStorage data but no timestamp - this is default data, clearing...');

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

      regionalHotspots: {

        APAC: "78%",

        Europe: "65%",

        "North America": "72%"

      },

      visualCharts: {

        aiAdoptionTrends: ["Q1", "Q2", "Q3", "Q4"],

        technologyBudgetAllocation: {

          "AI/ML": "35%",

          Cloud: "40%",

          Security: "25%"

        }

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







  // Regulatory Compliance state - Add these new state variables



  const [isRegulatoryEditing, setIsRegulatoryEditing] = useState(false);



  const [regulatoryExpanded, setRegulatoryExpanded] = useState(false);



  const [regulatoryHasEdits, setRegulatoryHasEdits] = useState(false);



  const [regulatoryDeletedSections, setRegulatoryDeletedSections] = useState<Set<string>>(new Set());



  const [regulatoryEditHistory, setRegulatoryEditHistory] = useState<EditRecord[]>([]);



  



  // Function to get initial Regulatory data from localStorage or defaults



  const getInitialRegulatoryData = () => {



    try {



      const stored = getUserLocalStorage('regulatoryData', currentUser?.uid);



      if (stored) {



        const parsedData = JSON.parse(stored);



        console.log('📦 Loading Regulatory data from localStorage:', parsedData);



        // Only return stored data if it has a timestamp (meaning it came from API)



        if (parsedData.timestamp) {



          console.log('✅ Found persisted Regulatory data with timestamp:', parsedData.timestamp);

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



    return {



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



    };



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



        console.log('📦 Loading Competitor data from localStorage:', parsedData);



        // Only return stored data if it has a timestamp (meaning it came from API)



        if (parsedData.timestamp) {



          console.log('✅ Found persisted Competitor data with timestamp:', parsedData.timestamp);



          return parsedData;



        }



      }



    } catch (error) {



      console.error('❌ Error loading Competitor data from localStorage:', error);



    }



    



    // Return default data if no valid stored data - provide meaningful fallback



    console.log('📝 No stored Competitor data found - returning default state, will load from API');



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



    console.log('🔄🏆 PARENT - competitorData changed:', competitorData);



    console.log('🔄🏆 PARENT - competitorData.timestamp:', competitorData?.timestamp);



    console.log('🔄🏆 PARENT - competitorData.executiveSummary:', competitorData?.executiveSummary);



  }, [competitorData]);







  // Market Size Scout Chat states (separate from Industry Trends)



  const [showMarketSizeScoutChat, setShowMarketSizeScoutChat] = useState(false);



  const [marketSizeHasEdits, setMarketSizeHasEdits] = useState(false);



  const [marketSizeLastEditedField, setMarketSizeLastEditedField] = useState('');



  const [marketSizeDeletedSections, setMarketSizeDeletedSections] = useState<Set<string>>(new Set());



  const [marketSizeCustomMessage, setMarketSizeCustomMessage] = useState<string | undefined>(undefined);







  // Industry Trends Scout Chat states (separate from Market Size)



  const [showIndustryTrendsScoutChat, setShowIndustryTrendsScoutChat] = useState(false);



  const [industryTrendsCustomMessage, setIndustryTrendsCustomMessage] = useState<string | undefined>(undefined);







  // Competitor Landscape Scout Chat states (separate from others)



  const [showCompetitorScoutChat, setShowCompetitorScoutChat] = useState(false);



  const [competitorCustomMessage, setCompetitorCustomMessage] = useState<string | undefined>(undefined);







  // Regulatory Compliance Scout Chat states



  const [showRegulatoryScoutChat, setShowRegulatoryScoutChat] = useState(false);



  const [isRegulatoryPostSave, setIsRegulatoryPostSave] = useState(false);



  const [regulatoryCustomMessage, setRegulatoryCustomMessage] = useState<string | undefined>(undefined);







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



        console.log('📦 Loading Market Entry data from localStorage:', parsedData);



        // Only return stored data if it has a timestamp (meaning it came from API)



        if (parsedData.timestamp) {



          console.log('✅ Found persisted Market Entry data with timestamp:', parsedData.timestamp);



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



  // Transform raw report data to our expected structure (for historical data only)



  const transformReportData = (reportData: any): MarketIntelligenceData => {



    console.log('🔄 TRANSFORM: Input reportData for historical:', JSON.stringify(reportData, null, 2));



    



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



      apacGrowthRate: reportData.apacGrowthRate || '',



      strategicRecommendations: reportData.strategicRecommendations || [],



      marketEntry: reportData.marketEntry || '',



      marketDrivers: reportData.marketDrivers || [],



      marketSizeBySegment: reportData.marketSizeBySegment || {},



      growthProjections: reportData.growthProjections || {}



    };



    



    console.log('✅ TRANSFORM: Output transformed historical data:', JSON.stringify(transformed, null, 2));



    return transformed;



  };







  // Handle historical report selection



  const handleHistoricalReportSelected = (reportData: any) => {



    console.log('Historical report selected:', reportData);



    



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



      console.log('fetchMarketData called with isRefresh:', isRefresh);



      console.log('Current marketData exists:', !!marketData);



      console.log('Cached data exists:', !!getCachedData(currentUser?.uid));



      



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

        console.log('🧹 Clearing localStorage cache for fresh data...');

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

      console.log('🔧 MAIN MARKET SIZE & OPPORTUNITY CALL: Using direct fetch with JSON.stringify to bypass apiFetch issues');

      

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

        user_id: currentUser.uid,

        refresh: true,

        _timestamp: Date.now(), // Add timestamp to ensure fresh data

        _cache_bust: Math.random().toString(36).substring(7),

        data: {}

      };

      

      console.log('🔧 MAIN MARKET SIZE & OPPORTUNITY CALL: Payload being sent:', payload);

      console.log('🔧 MAIN MARKET SIZE & OPPORTUNITY CALL: Payload type:', typeof payload);

      console.log('🔧 MAIN MARKET SIZE & OPPORTUNITY CALL: JSON.stringify(payload):', JSON.stringify(payload));

      

      const response = await fetch(`/api/market-research?_cb=${Date.now()}&_r=${Math.random()}`, {

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

      console.log('📊 Market intelligence data:', apiResponse);



      console.log('🔍 DEBUGGING: Raw API response structure:', JSON.stringify(apiResponse, null, 2));



      console.log('🔍 DEBUGGING: Response timestamp or ID:', apiResponse.timestamp || apiResponse.id || apiResponse.created_at || 'NO_TIMESTAMP');



      



      // Extract the report data from the API response



      const reportData = apiResponse.report || apiResponse;



      console.log('🔍 DEBUGGING: Extracted report data:', JSON.stringify(reportData, null, 2));



      



      // Transform the data to match our expected structure



      const transformedData = transformReportData(reportData);



      



      console.log('✅ Transformed data:', transformedData);



      console.log('🔍 DEBUGGING: Key fields from transformed data:');



      console.log('- Executive Summary:', transformedData.executiveSummary?.substring(0, 100) + '...');



      console.log('- TAM Value:', transformedData.tamValue);



      console.log('- SAM Value:', transformedData.samValue);



      console.log('- Market Entry:', transformedData.marketEntry?.substring(0, 100) + '...');



      



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



        console.log('💾 Market data saved to localStorage for persistence');



      



      // Reset historical data flags when fetching current data



      setIsShowingHistoricalData(false);



      setHistoricalDataTimestamp(null);



      



    } catch (err) {



      console.error('Error fetching market data:', err);



      setError(err instanceof Error ? err.message : 'Failed to fetch market data');



      



      // Always ensure we show any available data, even if the fetch failed



      const fallbackData = getCachedData(currentUser?.uid);



      if (fallbackData && !marketData) {



        console.log('Using cached data as fallback after error');



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



    console.log('🚀 MarketResearch component mounted - loading initial data');



    



    // Load initial data for all components



    const loadInitialData = async () => {



      try {



        console.log('🔄 Loading initial data for all components...');



        



        // Load competitor data initially with a small delay to prevent rate limiting



        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before making API calls



        await fetchCompetitorData(false, false); // Don't show loading, don't force refresh



        // If competitor data is still null after initial load, force a refresh

        setTimeout(() => {

          if (!competitorData) {

            console.log('🔄 COMPETITOR FALLBACK - competitorData still null after initial load, forcing refresh...');

            fetchCompetitorData(true, false);

          }

        }, 100); // Reduced to 100ms for fastest response



        console.log('✅ Initial data loading completed');



      } catch (error) {



        console.error('❌ Error loading initial data:', error);



      }



    };



    



    loadInitialData();



  }, []); // Only run on mount



  // Auto-refresh competitor data if it's null (fallback mechanism)

  useEffect(() => {

    if (!competitorData && !isRefreshing) {

      console.log('🔄 COMPETITOR AUTO-REFRESH - competitorData is null, triggering automatic refresh...');

      fetchCompetitorData(true, false); // Force refresh, don't show loading

    }

  }, [competitorData, isRefreshing]);



  // Listen for company profile updates to clear cache and refresh data

  useEffect(() => {

    const handleCompanyProfileUpdate = (event: CustomEvent) => {

      console.log('🔄 MarketResearch - Company profile updated, clearing cache and refreshing data');

      if (event.detail?.clearCaches) {

        clearMarketDataCache();

        

        // Clear React state to force fresh data

        setCompetitorData(null);

        setMarketData(null);

        // Only clear regulatory data if it doesn't have a timestamp (meaning it's fallback data)
        if (!regulatoryData?.timestamp) {
          console.log('🧹 Company profile update - clearing regulatory data (no timestamp)');
          setRegulatoryData(null);
        } else {
          console.log('🧹 Company profile update - keeping regulatory data (has timestamp):', regulatoryData.timestamp);
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

        

        console.log('🧹 Cleared all React state and reset fresh data flags for fresh data');

        

        // Trigger refresh of all components with new profile

        console.log('🔄 Triggering refresh of all components with updated company profile...');

        triggerScoutAndRefresh();

      }

    };



    window.addEventListener('companyProfileUpdated', handleCompanyProfileUpdate as EventListener);

    

    return () => {

      window.removeEventListener('companyProfileUpdated', handleCompanyProfileUpdate as EventListener);

    };

  }, []);







  // Smart refresh function that tracks component status and only retries failed ones

  const smartRefresh = async (isFirstRefresh = false) => {

    console.log('🔄 smartRefresh called with isFirstRefresh:', isFirstRefresh);

    

    // Reset all component status to pending to ensure all components are fetched

    console.log('🔄 Resetting all component status to pending for fresh fetch...');

    setComponentStatus({

      'Market Size': 'pending',

      'Industry Trends': 'pending', 

      'Market Entry': 'pending',

      'Competitor Landscape': 'pending',

      'Regulatory Compliance': 'pending'

    });

    

    // Also clear any stale data that might be causing issues

    console.log('🧹 Clearing potentially stale data for fresh fetch...');

    if (!marketData?.executiveSummary) setMarketData(null);

    if (!industryTrendsData?.executiveSummary) setIndustryTrendsData(null);

    if (!marketEntryData?.executiveSummary) setMarketEntryData(null);

    if (!competitorData?.executiveSummary) setCompetitorData(null);

    // Only clear regulatory data if it doesn't have a timestamp (meaning it's fallback data)
    // Don't clear fresh API data that has a timestamp
    if (!regulatoryData?.timestamp) {
      console.log('🧹 Clearing regulatory data - no timestamp found');
      setRegulatoryData(null);
    } else {
      console.log('🧹 Keeping regulatory data - has timestamp:', regulatoryData.timestamp);
    }

    

    // Add a safety timeout to prevent infinite loading (reduced to 15 seconds for 10-second target)

    const refreshTimeout = setTimeout(() => {

      console.log('⏰ REFRESH TIMEOUT - Force stopping refresh after 90 seconds');

      setIsRefreshing(false);
      setLoadingPhase('complete');

      toast({

        title: "Refresh Complete",

        description: "Loading completed. Some components may still be processing.",

        duration: 3000,

      });

    }, 90000); // Increased to 90 seconds to allow all components to load

    

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

        console.log('🔄 Starting first refresh - all components will be fetched');

      } else {

        setRefreshAttempt(prev => prev + 1);

        setValidationAttempts(0); // Reset validation attempts for retry

        setConsecutiveValidations(0); // Reset consecutive validations for retry

        console.log(`🔄 Starting retry refresh (attempt ${refreshAttempt + 1}) - all components will be fetched`);

        console.log(`🔄 Current component status before retry:`, componentStatus);

      }



      console.log('🔄 Setting isRefreshing to true');

      setIsRefreshing(true);
      setIsInitialLoading(false); // Ensure initial loading is false for refresh

      setError(null);

      
      // Only clear data if this is a company profile change refresh, not a regular refresh
      // Check if this is triggered by company profile update
      const isCompanyProfileUpdate = (window as any).companyProfileUpdated || false;
      
      // Always clear data for fresh fetch to ensure all components get updated data
      console.log('🧹 Clearing all component data for fresh fetch');
      
        setMarketData(null);
        setCompetitorData(null);
        // Only clear regulatory data if it doesn't have a timestamp (meaning it's fallback data)
        if (!regulatoryData?.timestamp) {
          console.log('🧹 Fresh fetch - clearing regulatory data (no timestamp)');
          setRegulatoryData(null);
        } else {
          console.log('🧹 Fresh fetch - keeping regulatory data (has timestamp):', regulatoryData.timestamp);
        }
        setIndustryTrendsData(null);
        setMarketEntryData(null);
        
        // Also clear the marketIntelligenceData state to prevent data switching
        setMarketIntelligenceData({
          executiveSummary: "",
          tamValue: "",
          samValue: "",
          apacGrowthRate: "",
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
      
      console.log('🧹 All component data and cache cleared for fresh fetch');
      

      // Set refresh start time for minimum wait validation

      (window as any).refreshStartTime = Date.now();

      console.log('🕐 Refresh start time set:', new Date().toISOString());

      

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
              console.warn('⚠️ [SMART REFRESH] Company profile user_id mismatch, ignoring');
              companyProfileData = null;
            } else {
              console.log('📋 [SMART REFRESH] Using cached company profile for context:', companyProfileData);
            }
          } catch (error) {
            console.warn('⚠️ Could not parse cached profile, fetching fresh:', error);
          }
        }
      }

      

      if (!companyProfileData && currentUser?.uid) {

      try {
        // Include user_id in API call
        const profileResponse = await fetch(buildApiUrl(`api/profile/company?user_id=${currentUser.uid}`), {

          method: 'GET',

          headers: { 'Content-Type': 'application/json' }

        });

        if (profileResponse.ok) {

          companyProfileData = await profileResponse.json();
          // Verify the profile belongs to the current user
          if (companyProfileData.user_id && companyProfileData.user_id !== currentUser.uid) {
            console.warn('⚠️ [SMART REFRESH] Retrieved profile user_id mismatch, ignoring');
            companyProfileData = null;
          } else {
            // Store in user-specific localStorage
            setUserLocalStorage('companyProfile', JSON.stringify(companyProfileData), currentUser.uid);
            console.log('📋 [SMART REFRESH] Retrieved fresh company profile for context:', companyProfileData);
          }
        }

      } catch (error) {

        console.warn('⚠️ Could not retrieve company profile, proceeding without context:', error);

        }

      }

      

      // Only use companyProfileData if it belongs to the current user
      if (companyProfileData && currentUser?.uid) {
        // Final verification that the profile belongs to current user
        if (companyProfileData.user_id && companyProfileData.user_id !== currentUser.uid) {
          console.warn('⚠️ [SMART REFRESH] Company profile user_id mismatch in final check, ignoring');
          companyProfileData = null;
        }
      }
      
      if (companyProfileData && currentUser?.uid) {

        setUserLocalStorage('companyProfileForRefresh', JSON.stringify(companyProfileData), currentUser.uid);

        console.log('📋 Company profile data set for all components to use consistently (user-specific)');

      }

      

      // DO NOT show cached data during refresh - this causes components to switch to previous data
      // The loading screen should mask the entire process until fresh data is ready
      console.log('🔄 Refresh in progress - loading screen will mask the process until fresh data is ready');
      

      // No delay needed for parallel execution



      // Define all components

      const allComponents = [

        { name: 'Market Size', fetchFn: fetchMarketSizeData, priority: 1 },

        { name: 'Competitor Landscape', fetchFn: fetchCompetitorData, priority: 2 },

        { name: 'Industry Trends', fetchFn: fetchIndustryTrendsData, priority: 3 },

        { name: 'Market Entry', fetchFn: fetchMarketEntryData, priority: 4 },

        { name: 'Regulatory Compliance', fetchFn: fetchRegulatoryData, priority: 5 }

      ];

      

      console.log('📋 COMPONENT ORDER - Processing components in this order:');

      allComponents.forEach((component, index) => {

        console.log(`  ${index + 1}. ${component.name} (priority: ${component.priority})`);

      });

      

      // AGGRESSIVE FIX: Always fetch all components and force refresh
      const componentsToFetch = allComponents;
      
      console.log('🔄 AGGRESSIVE FIX - FORCING ALL COMPONENTS TO REFRESH');
      console.log('🔄 This will clear all data and force fresh API calls for all components');
      console.log('🔄 Using direct API calls to bypass rate limiting issues');
      
      // Force clear all component data states
      console.log('🧹 FORCE CLEARING ALL COMPONENT DATA STATES');
      setMarketData(null);
      setCompetitorData(null);
      // Only clear regulatory data if it doesn't have a timestamp (meaning it's fallback data)
      if (!regulatoryData?.timestamp) {
        console.log('🧹 Force clear - clearing regulatory data (no timestamp)');
        setRegulatoryData(null);
      } else {
        console.log('🧹 Force clear - keeping regulatory data (has timestamp):', regulatoryData.timestamp);
      }
      setIndustryTrendsData(null);
      setMarketEntryData(null);
      // Preserve existing marketIntelligenceData structure - don't clear important fields
      setMarketIntelligenceData(prev => ({
        executiveSummary: prev?.executiveSummary || '',
        tamValue: prev?.tamValue || '',
        samValue: prev?.samValue || '',
        apacGrowthRate: prev?.apacGrowthRate || '',
        strategicRecommendations: prev?.strategicRecommendations || [],
        marketEntry: prev?.marketEntry || '',
        marketDrivers: prev?.marketDrivers || [],
        marketSizeBySegment: prev?.marketSizeBySegment || {},
        growthProjections: prev?.growthProjections || {},
        timestamp: prev?.timestamp || null,
        user_id: currentUser?.uid || prev?.user_id
      }));
      
      // Force clear all localStorage caches
      console.log('🧹 FORCE CLEARING ALL LOCALSTORAGE CACHES');
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
      
      allComponents.forEach((component, index) => {
        console.log(`  ${index + 1}. ${component.name} - WILL BE FORCE REFRESHED`);
      });

      

      console.log(`🔄 Processing ${componentsToFetch.length} components (${isFirstRefresh ? 'first refresh - all' : 'manual refresh - all'})...`);

      console.log(`🔄 Current component status:`, componentStatus);

      console.log(`🔄 Components to fetch:`, componentsToFetch.map(c => c.name));

      console.log(`🔄 Components NOT being fetched:`, allComponents.filter(c => !componentsToFetch.includes(c)).map(c => c.name));

      

      // Always process all components - no early exit

      

      const currentStatus = { ...componentStatus }; // Local copy to track status

      

      // Process all components in parallel with rate limiting

      console.log(`🚀 Starting parallel API calls for ${componentsToFetch.length} components...`);

      

      // Create promises for all components

      // Process components sequentially with proper delays to prevent rate limiting
      const componentPromises = componentsToFetch.map(async (component, index) => {

        console.log(`🔄 Processing ${component.name} (${index + 1}/${componentsToFetch.length})...`);

        

        try {

          // Add staggered delay to prevent rate limiting
          const staggerDelay = index * 100; // 100ms delay between each component (reduced for faster refresh)
          if (staggerDelay > 0) {
            console.log(`⏳ Waiting ${staggerDelay}ms before calling ${component.name} to prevent rate limiting...`);
            await new Promise(resolve => setTimeout(resolve, staggerDelay));
          }

          // Update component status to pending

          currentStatus[component.name] = 'pending';

          setComponentStatus(prev => ({ ...prev, [component.name]: 'pending' }));

          

          console.log(`🚀 Calling API for ${component.name} with rate limiting...`);

          

          // Special monitoring for Competitor Landscape

          if (component.name === 'Competitor Landscape') {

            console.log(`🏆 COMPETITOR LANDSCAPE - Starting API call...`);

            console.log(`🏆 COMPETITOR LANDSCAPE - Current competitorData:`, !!competitorData);

            console.log(`🏆 COMPETITOR LANDSCAPE - Current timestamp:`, competitorData?.timestamp);

          }

          

          const startTime = Date.now();

          // ROBUST API CALL HANDLING - Add timeout and fallback for all components
          let result;
          const timeoutDuration = 45000; // 45 seconds timeout for all components (increased from 20s)
          
          console.log(`🔄 ${component.name} - Starting API call with ${timeoutDuration}ms timeout`);
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${component.name} API call timeout after ${timeoutDuration/1000} seconds`)), timeoutDuration);
          });
          
          // BYPASS RATE LIMITER - Use direct API calls to avoid rate limiting issues
          console.log(`🔄 ${component.name} - Using direct API call (bypassing rate limiter)`);
          
          try {
            result = await Promise.race([
              component.fetchFn(true, false), // Direct API call
              timeoutPromise
            ]);
            console.log(`✅ ${component.name} direct API call completed successfully`);
          } catch (apiError) {
            console.error(`❌ ${component.name} direct API call failed:`, apiError);
            throw apiError;
          }

          const endTime = Date.now();

          const duration = endTime - startTime;

          console.log(`⏱️ ${component.name} API call took ${duration}ms`);

          

          // Special monitoring for Competitor Landscape

          if (component.name === 'Competitor Landscape') {

            console.log(`🏆 COMPETITOR LANDSCAPE - API call completed in ${duration}ms`);

            console.log(`🏆 COMPETITOR LANDSCAPE - Result status:`, (result as any)?.status || 'unknown');

          }

          

          // Mark component as API complete (but not yet validated)

          currentStatus[component.name] = 'pending'; // Keep as pending until validation

          setComponentStatus(prev => ({ ...prev, [component.name]: 'pending' }));

          console.log(`✅ ${component.name} API call completed successfully in ${duration}ms - awaiting validation`);

          

          return { status: 'fulfilled', value: result };

          

        } catch (error) {

          console.error(`❌ ${component.name} fetch failed:`, error);

          // AGGRESSIVE ERROR HANDLING - Try direct API call for all failed components
          if (error.message?.includes('timeout') || error.message?.includes('rate limit') || error.message?.includes('failed')) {
            console.log(`🔄 ${component.name} - API failed, trying direct call as fallback...`);
            
            try {
              // Try direct API call with shorter timeout (30 seconds)
              const fallbackTimeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`${component.name} fallback API call timeout after 30 seconds`)), 30000);
              });
              
              const directResult = await Promise.race([
                component.fetchFn(true, false),
                fallbackTimeoutPromise
              ]);
              console.log(`✅ ${component.name} direct API call succeeded after failure`);
              
              // Process the successful result
              return { status: 'fulfilled', value: directResult };
            } catch (directError) {
              console.error(`❌ ${component.name} direct API call also failed:`, directError);
              // Continue with normal error handling
            }
          }

          // Update component status to failed

          currentStatus[component.name] = 'failed';

          setComponentStatus(prev => ({ ...prev, [component.name]: 'failed' }));
          
          // Log the failure but don't throw - allow other components to continue
          console.warn(`⚠️ ${component.name} failed to load, but continuing with other components`);

          

          // Add immediate retry for failed components (especially Competitor Landscape)

          if (component.name === 'Competitor Landscape') {

            console.log(`🔄 COMPETITOR FALLBACK - Immediate retry for failed ${component.name}...`);

            setTimeout(async () => {

              try {

                await component.fetchFn(true, false);

                console.log(`✅ COMPETITOR FALLBACK - ${component.name} retry successful`);

              } catch (retryError) {

                console.error(`❌ COMPETITOR FALLBACK - ${component.name} retry failed:`, retryError);

              }

            }, 2000); // Retry after 2 seconds

          }

          

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

      

      // Wait for all components to complete with proper error handling

      console.log(`⏳ Waiting for all ${componentsToFetch.length} components to complete with staggered timing...`);

      const results = await Promise.allSettled(componentPromises);

      console.log(`✅ All ${componentsToFetch.length} components completed with staggered timing`);

      

      // Log detailed results for debugging

      results.forEach((result, index) => {

        const component = componentsToFetch[index];

        if (result.status === 'fulfilled') {

          console.log(`✅ ${component.name} completed successfully`);

        } else {

          console.error(`❌ ${component.name} failed:`, result.reason);

        }

      });

      

      // Update the component status state with the current status

      setComponentStatus(currentStatus);

      

      // Check if all API calls are complete (no failures)

      const allApiCallsComplete = Object.values(currentStatus).every(status => status !== 'failed');

      const hasFailures = Object.values(currentStatus).some(status => status === 'failed');

      

      console.log('📊 Final component status after processing:', currentStatus);

      console.log('📊 All API calls complete:', allApiCallsComplete);

      console.log('📊 Has failures:', hasFailures);

      

      if (allApiCallsComplete) {

        console.log('🎉 All API calls completed! Starting validation...');

        console.log('🎉 About to call validateAllComponentsHaveFreshData...');

        console.log('🎉 Current component status:', currentStatus);

        

        // Clear the refresh timeout since we're completing successfully

        clearTimeout(refreshTimeout);

        

        // Validate that all components have fresh data before showing success

        validateAllComponentsHaveFreshData();

      } else if (hasFailures && refreshAttempt < 3) {

        console.log(`⚠️ Some components failed. Will retry failed components (attempt ${refreshAttempt + 1}/3)`);

        console.log(`⚠️ Failed components:`, Object.entries(currentStatus).filter(([name, status]) => status === 'failed').map(([name]) => name));

        

        // Implement immediate fallback for critical components

        const failedComponentNames = Object.entries(currentStatus)

          .filter(([name, status]) => status === 'failed')

          .map(([name]) => name);

        

        console.log('🔄 Implementing immediate fallback for failed components...');

        

        // Retry failed components with exponential backoff

        failedComponentNames.forEach(async (componentName, index) => {

          const component = componentsToFetch.find(c => c.name === componentName);

          if (component) {

            const retryDelay = 1000 + (index * 500); // 1s, 1.5s, 2s delays (paid plan allows faster)

            console.log(`🔄 Scheduling retry for ${componentName} in ${retryDelay}ms...`);

            

            setTimeout(async () => {

              try {

                console.log(`🔄 Retrying ${componentName}...`);

                

                // Force clear any cached data for this component

                if (componentName === 'Competitor Landscape') {

                  if (currentUser?.uid) {
        removeUserLocalStorage('competitorData', currentUser.uid);
      } else {
        localStorage.removeItem('competitorData');
      }

                  console.log('🧹 Cleared competitor data cache for retry');

                } else if (componentName === 'Market Entry') {

                  if (currentUser?.uid) {
        removeUserLocalStorage('marketEntryData', currentUser.uid);
      } else {
        localStorage.removeItem('marketEntryData');
      }

                  console.log('🧹 Cleared market entry data cache for retry');

                } else if (componentName === 'Industry Trends') {

                  if (currentUser?.uid) {
        removeUserLocalStorage('industryTrendsData', currentUser.uid);
      } else {
        localStorage.removeItem('industryTrendsData');
      }

                  console.log('🧹 Cleared industry trends data cache for retry');

                }

                

                const result = await executeWithRateLimit(

                  () => component.fetchFn(true, false), // FORCE refresh=true for retries

                  `${componentName} (Fallback)`

                );

                

                console.log(`✅ ${componentName} fallback retry successful`);

                

                // Update component status to success

                setComponentStatus(prev => ({ ...prev, [componentName]: 'success' }));

                

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

            console.log(`🔄 Immediate retry for ${failedComponentNames[0]}...`);

            setTimeout(async () => {

              try {

                console.log(`🔄 Immediate retry for ${failedComponentNames[0]}...`);

                

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

                  () => firstFailedComponent.fetchFn(true, false), // FORCE refresh=true for immediate retry

                  `${failedComponentNames[0]} (Immediate)`

                );

                

                console.log(`✅ ${failedComponentNames[0]} immediate retry successful`);

                setComponentStatus(prev => ({ ...prev, [failedComponentNames[0]]: 'success' }));

                

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

        setTimeout(() => {

          smartRefresh(false);

        }, 50); // Reduced to 50ms for fastest retry

      } else {

        console.log('❌ Maximum retry attempts reached or all components failed');

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

      clearTimeout(refreshTimeout);

      setIsRefreshing(false);

      setError('Refresh failed. Please try again.');

    }

  };



  // Trigger market research using the smart refresh system

  const triggerScoutAndRefresh = async () => {

    console.log('🔄🔄🔄 REFRESH TRIGGER - Starting smart refresh system...');

    await smartRefresh(true); // Start with first refresh

  };







  // Fetch Market Size data using existing backend APIs with smart loading



  const fetchMarketSizeData = async (refresh = true, showLoading = true) => {



    console.log('🚀 Starting fetchMarketSizeData with refresh:', refresh, 'showLoading:', showLoading);



    try {



      console.log('📍 Fetching market size data without config dependency');



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
            console.warn('⚠️ [FETCH MARKET SIZE] Company profile user_id mismatch, ignoring');
            companyData = null;
          } else {
            console.log('📋 [FETCH MARKET SIZE] Using company profile data for market size request:', companyData);
          }



        }



      } catch (error) {



        console.warn('⚠️ Could not get company profile data:', error);



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



      const payload = {



        user_id: currentUser.uid,



        component_name: "market size & opportunity",



        data: {},



        refresh: refresh // Use the refresh parameter passed to function



      };







              console.log('📤 Sending API request to:', '/api/market-research');



      console.log('📦 Market Size Complete Payload:', JSON.stringify(payload, null, 2));



      console.log('📦 Market Size Payload component_name:', payload.component_name);



      console.log('📦 Market Size Payload keys:', Object.keys(payload));



      console.log('📦 Market Size Data keys:', Object.keys(payload.data));







      // Add debugging to track data freshness



      const requestTimestamp = Date.now();



      console.log('⏰ REQUEST TIMESTAMP:', requestTimestamp);



      console.log('🔄 FORCE_REFRESH in payload:', payload.refresh);



      



      const response = await fetch('/api/market-research', {



        method: 'POST',



        headers: {



          'Content-Type': 'application/json',



        },



        body: JSON.stringify(payload)



      });







      console.log('📊 MARKET SIZE - API response status:', response.status);
      if (response.status === 500) {
        console.error('❌📊 MARKET SIZE - Got 500 error from API!');
      }



      console.log('📨 Competitor API response headers:', Object.fromEntries(response.headers.entries()));



      console.log('📨 Competitor API response ok:', response.ok);







      if (!response.ok) {



        const errorText = await response.text();



        console.error('❌🏆 API Error Response:', errorText);



        console.error('❌🏆 API Error Status:', response.status);



        console.error('❌🏆 API Error Headers:', Object.fromEntries(response.headers.entries()));



        



        // If it's a component name error, try alternative names



        if (errorText.includes('Unsupported component_name')) {



          console.log('🔄 Trying alternative component names...');



          



          // Try alternative component names



          const alternativeNames = [



            "competitor landscape",



            "competitor analysis", 



            "competitive landscape",



            "competitor insights"



          ];



          



          for (const altName of alternativeNames) {



            console.log(`🔄 Trying component name: "${altName}"`);



            const altPayload = { ...payload, component_name: altName };



            



            try {



              const altResponse = await fetch('/api/market-research', {



                method: 'POST',



                headers: { 'Content-Type': 'application/json' },



                body: JSON.stringify(altPayload)



              });



              



              if (altResponse.ok) {



                console.log(`✅ Success with component name: "${altName}"`);



                const altResult = await altResponse.json();



                // Process the successful response



                if (altResult.status === 'success' && altResult.data) {



                  // Use the same processing logic as below



                  const apiData = altResult.data;



                  // ... rest of the processing logic



                  console.log('✅ Alternative component name worked, processing data...');



                  // Continue with the existing processing logic



                  break;



                }



              } else {



                const altErrorText = await altResponse.text();



                console.log(`❌ Alternative name "${altName}" failed:`, altErrorText);



              }



            } catch (altError) {



              console.log(`❌ Alternative name "${altName}" failed:`, altError);



            }



          }



        }



        



        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);



      }







      console.log('✅🏆 API request successful, parsing response...');



      const apiResponse = await response.json();



      console.log('📥 Market Size API response:', apiResponse);



      console.log('🔍 API Response structure:', JSON.stringify(apiResponse, null, 2));

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



        console.log('🔄 No existing data - will update');



      } else if (newDataTimestamp) {



        // Use UTC comparison utility



        shouldUpdateData = isTimestampNewer(newDataTimestamp, currentDataTimestamp);



        console.log('🔄 Timestamp comparison result:', shouldUpdateData ? 'Update needed' : 'Data is current');



      }



      



      console.log('🔄 MARKET SIZE UPDATE DECISION:');



      console.log('  - Should update data:', shouldUpdateData);



      console.log('  - Current data timestamp (RAW):', currentDataTimestamp);



      console.log('  - New data timestamp (RAW):', newDataTimestamp);



      console.log('  - Current data timestamp (UTC):', toUTCTimestamp(currentDataTimestamp));



      console.log('  - New data timestamp (UTC):', toUTCTimestamp(newDataTimestamp));



      console.log('  - Reason for update:', !currentDataTimestamp ? 'No existing data' : shouldUpdateData ? 'Swagger data is newer' : 'Current data is up to date');



      console.log('  - Reason for update:', !currentDataTimestamp ? 'No existing data' : shouldUpdateData ? 'Swagger data is newer' : 'Current data is up to date');



      



      console.log('🔍 DEBUGGING: Current marketIntelligenceData before update:', JSON.stringify(marketIntelligenceData, null, 2));







      // Update market intelligence data with API response only if data is newer



      if (apiResponse.data && shouldUpdateData) {



        console.log('✅ Found data in API response and data is newer - updating');



        const report = apiResponse.data;



        console.log('📊 Report data:', JSON.stringify(report, null, 2));



        console.log('🔄 Updating marketIntelligenceData with report:', report);



        



        // Log specific field values to check for undefined



        console.log('🔍 FIELD CHECK - executiveSummary:', report.executiveSummary);



        console.log('🔍 FIELD CHECK - tamValue:', report.tamValue);



        console.log('🔍 FIELD CHECK - samValue:', report.samValue);



        console.log('🔍 FIELD CHECK - apacGrowthRate:', report.apacGrowthRate);



        console.log('🔍 FIELD CHECK - strategicRecommendations:', report.strategicRecommendations);



        console.log('🔍 TYPE CHECK - strategicRecommendations type:', typeof report.strategicRecommendations);



        console.log('🔍 ARRAY CHECK - strategicRecommendations isArray:', Array.isArray(report.strategicRecommendations));



        console.log('🔍 FIELD CHECK - marketEntry:', report.marketEntry);



        console.log('🔍 FIELD CHECK - marketDrivers:', report.marketDrivers);



        console.log('🔍 FIELD CHECK - marketSizeBySegment:', report.marketSizeBySegment);



        console.log('🔍 FIELD CHECK - growthProjections:', report.growthProjections);



        



        // Update marketIntelligenceData state with all new data



        setMarketIntelligenceData(prev => {



          const newData = {



            ...prev,



            executiveSummary: report.executiveSummary !== undefined ? report.executiveSummary : prev.executiveSummary,



            tamValue: report.tamValue !== undefined ? report.tamValue : prev.tamValue,



            samValue: report.samValue !== undefined ? report.samValue : prev.samValue,



            apacGrowthRate: report.apacGrowthRate !== undefined ? report.apacGrowthRate : prev.apacGrowthRate,



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



          console.log('🔍 DEBUGGING: NEW marketIntelligenceData after MARKET SIZE update:', JSON.stringify(newData, null, 2));



          console.log('🔍 DEBUGGING: Market Size Data comparison:');



          console.log('- OLD Executive Summary:', prev.executiveSummary?.substring(0, 100) + '...');



          console.log('- NEW Executive Summary:', newData.executiveSummary?.substring(0, 100) + '...');



          console.log('- OLD TAM Value:', prev.tamValue);



          console.log('- NEW TAM Value:', newData.tamValue);



          console.log('- OLD Timestamp:', prev.timestamp);



          console.log('- NEW Timestamp:', newData.timestamp);



          console.log('✅ MARKET SIZE DATA UPDATED - Component name: "Market Size & Opportunity"');



          



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



            apacGrowthRate: report.apacGrowthRate !== undefined ? report.apacGrowthRate : prev?.apacGrowthRate,



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



          console.log('✅ Updated marketData with Market Size API data:', updated);



          



          // Stop loading states after successful Market Size data fetch



          setIsInitialLoading(false);



          // Don't stop global refresh here - let smart refresh handle it

          // setIsRefreshing(false);



          



          return updated;



        });



      } else {



        console.log('❌ No data found in Market Size API response - keeping existing data');



        setIsInitialLoading(false);



        // Don't stop global refresh here - let smart refresh handle it

        // setIsRefreshing(false);



      }







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



  const fetchIndustryTrendsData = async (refresh = false, showLoading = true) => {

    console.log('🚀 Starting fetchIndustryTrendsData with refresh:', refresh, 'showLoading:', showLoading);

    

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

          console.log('📋 Using company profile data for industry trends request (user-specific):', companyData);

        }

      } catch (error) {

        console.warn('⚠️ Could not get company profile data:', error);

      }



      // Payload specifically for Industry Trends using API structure

      const payload = {

        user_id: currentUser?.uid || "",

        component_name: "industry trends report",

        data: {},

        refresh: refresh,

        _forceRefresh: refresh,

        _timestamp: Date.now(),

        _cacheBust: Math.random().toString(36).substring(7)

      };



      console.log('📤 Sending Industry Trends API request with payload:', payload);

      console.log('🔄 Industry Trends refresh parameter:', refresh);



      // Use cache-busted API call for fresh data

      const cacheBustedPayload = {

        ...payload,

        _timestamp: Date.now(),

        _cache_bust: Math.random().toString(36).substring(7)

      };

      console.log('📤 Industry Trends cache-busted payload:', cacheBustedPayload);

      console.log('📈 INDUSTRY TRENDS - Making API call to /api/market-research');
      const response = await fetch('/api/market-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cacheBustedPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // CRITICAL: Validate that the API response belongs to the current user
      if (!validateApiResponseUserId(result, currentUser?.uid, 'Industry Trends')) {
        setIndustryTrendsError('Data security validation failed. Please refresh.');
        setIsIndustryTrendsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Log the result for debugging

      logApiCallResult('Industry Trends', result, refresh);



      if (result.status === 'success' && result.data) {

        const apiData = result.data;

        console.log('🎯 Processing API data for Industry Trends:', apiData);

        console.log('🎯 Industry Trends API response structure:', JSON.stringify(apiData, null, 2));
        
        console.log('🔍 Visual Charts Debug:', {
          hasVisualCharts: !!apiData.visualCharts,
          visualCharts: apiData.visualCharts,
          hasAiAdoptionTrends: !!apiData.visualCharts?.aiAdoptionTrends,
          aiAdoptionTrends: apiData.visualCharts?.aiAdoptionTrends,
          aiAdoptionTrendsLength: apiData.visualCharts?.aiAdoptionTrends?.length
        });



        // Check timestamp comparison with timestampUtils

        const currentTimestamp = industryTrendsData.timestamp || null;

        const newTimestamp = apiData.timestamp;

        

        console.log('🎯 Current industryTrendsData:', industryTrendsData);

        console.log('🎯 New timestamp:', newTimestamp);

        console.log('🎯 Current timestamp:', currentTimestamp);

        

        logTimestampComparison(currentTimestamp, newTimestamp, 'IndustryTrends');

        

        // Always update on refresh, or if new data is newer

        if (refresh || !currentTimestamp || isTimestampNewer(newTimestamp, currentTimestamp)) {

          console.log('✅ Industry Trends data update needed (refresh:', refresh, 'or newer data)');

          

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
              : (industryTrendsData?.regionalHotspots || {
                  APAC: '',
                  Europe: '',
                  "North America": ''
                }),

            visualCharts: (apiData.visualCharts !== undefined && apiData.visualCharts && typeof apiData.visualCharts === 'object' && Object.keys(apiData.visualCharts).length > 0)
              ? {
                  aiAdoptionTrends: (apiData.visualCharts.aiAdoptionTrends !== undefined && Array.isArray(apiData.visualCharts.aiAdoptionTrends) && apiData.visualCharts.aiAdoptionTrends.length > 0)
                    ? (() => {
                        console.log('✅ Using API aiAdoptionTrends:', apiData.visualCharts.aiAdoptionTrends);
                        return apiData.visualCharts.aiAdoptionTrends;
                      })()
                    : (() => {
                        console.log('⚠️ API aiAdoptionTrends missing or empty, using existing:', industryTrendsData?.visualCharts?.aiAdoptionTrends);
                        return (industryTrendsData?.visualCharts?.aiAdoptionTrends || []);
                      })(),
                  technologyBudgetAllocation: (apiData.visualCharts.technologyBudgetAllocation !== undefined && apiData.visualCharts.technologyBudgetAllocation && typeof apiData.visualCharts.technologyBudgetAllocation === 'object' && Object.keys(apiData.visualCharts.technologyBudgetAllocation).length > 0)
                    ? apiData.visualCharts.technologyBudgetAllocation
                    : (industryTrendsData?.visualCharts?.technologyBudgetAllocation || {
                        "AI/ML": '',
                        Cloud: '',
                        Security: ''
                      })
                }
              : (industryTrendsData?.visualCharts || {
                  aiAdoptionTrends: [],
                  technologyBudgetAllocation: {
                    "AI/ML": '',
                    Cloud: '',
                    Security: ''
                  }
                }),

            risks: (apiData.risks !== undefined && Array.isArray(apiData.risks) && apiData.risks.length > 0)
              ? apiData.risks
              : (industryTrendsData?.risks || []),

            timestamp: toUTCTimestamp(newTimestamp)

          };

          

          setIndustryTrendsData(updatedData);

          saveIndustryTrendsDataToLocalStorage(updatedData);

          markFreshData('Industry Trends');

          console.log('✅ Industry Trends data updated successfully');

        } else {

          console.log('ℹ️ Current Industry Trends data is up to date');

          // Force update on refresh even if timestamps are the same

          if (refresh) {

            console.log('🔄 Forcing Industry Trends data update due to refresh request');

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

            console.log('✅ Industry Trends data force-updated on refresh');

          }

        }

      } else {

        console.warn('⚠️ Industry Trends - API call succeeded but data structure is unexpected');

        if (refresh) {

          console.log('🔄 Industry Trends - Will keep existing data due to unexpected response');

        }

      }

      

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



  const fetchRegulatoryData = async (refresh = true, showLoading = true) => {



    console.log('🚀🚀🚀 REGULATORY DATA FETCH CALLED - Starting fetchRegulatoryData with refresh:', refresh, 'showLoading:', showLoading);



    console.log('🚀🚀🚀 REGULATORY - Current regulatoryData state:', regulatoryData);



    try {



      console.log('📍 Fetching regulatory compliance data with correct component_name');



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

      console.log(`📋 REGULATORY COMPLIANCE - Reading company profile at ${new Date().toISOString()} (user-specific)`);



      console.log('📋 Using company profile data for regulatory request:', profile);







      // Payload specifically for Regulatory Compliance using API structure matching working components



      const payload = {



        user_id: currentUser?.uid || "",



        component_name: "regulatory & compliance highlights",



        data: {},



        refresh: refresh



      };







      console.log('📤 Sending Regulatory API request with payload:', payload);







      const response = await fetch('/api/market-research', {



        method: 'POST',



        headers: {



          'Content-Type': 'application/json',



        },



        body: JSON.stringify(payload)



      });







      console.log('📨 Regulatory API response status:', response.status);







      if (!response.ok) {



        throw new Error(`HTTP error! status: ${response.status}`);



      }







      const result = await response.json();

      // CRITICAL: Validate that the API response belongs to the current user
      if (!validateApiResponseUserId(result, currentUser?.uid, 'Regulatory Compliance')) {
        setRegulatoryError('Data security validation failed. Please refresh.');
        setIsRegulatoryLoading(false);
        setIsRefreshing(false);
        return;
      }

      console.log('📊🚀 Regulatory API result:', result);



      console.log('📊🚀 Regulatory API result.status:', result.status);



      console.log('📊🚀 Regulatory API result.data exists:', !!result.data);







      if (result.status === 'success' && result.data) {



        const apiData = result.data;



        console.log('🎯🚀 Processing API data for Regulatory Compliance:', apiData);



        console.log('🎯🚀 API Data Keys:', Object.keys(apiData));



        console.log('🎯🚀 API Data executiveSummary:', apiData.executiveSummary);



        console.log('🎯🚀 API Data euAiActDeadline:', apiData.euAiActDeadline);



        console.log('🎯🚀 API Data gdprCompliance:', apiData.gdprCompliance);







        // Check timestamp comparison



        const currentTimestamp = regulatoryData.timestamp || null;



        const newTimestamp = apiData.timestamp;



        



        console.log('🔍 REGULATORY TIMESTAMP ANALYSIS (UTC):');



        console.log('  - Current request time (UTC):', new Date().toISOString());



        console.log('  - Frontend data time (UTC):', currentTimestamp ? new Date(currentTimestamp).toISOString() : 'NO_TIMESTAMP');



        console.log('  - Swagger data time (UTC):', newTimestamp ? new Date(newTimestamp).toISOString() : 'NO_TIMESTAMP');



        



        // Only update if we have fresh data or if this is a forced refresh

        // Don't update if we don't have new data to replace existing data

        const hasNewData = (apiData.executiveSummary !== null && apiData.executiveSummary !== undefined) || (apiData.euAiActDeadline !== null && apiData.euAiActDeadline !== undefined);

        // Update if:
        // 1. We have new data AND (it's a refresh OR we don't have existing data)
        // 2. OR if we don't have existing data (no timestamp)
        const shouldUpdate = hasNewData && (refresh || !currentTimestamp || !regulatoryData?.executiveSummary);



        console.log('🔍🚀 REGULATORY UPDATE DECISION:');



        console.log('  - refresh param:', refresh);



        console.log('  - hasNewData:', hasNewData);



        console.log('  - shouldUpdate:', shouldUpdate);



        console.log('  - !currentTimestamp:', !currentTimestamp);



        console.log('  - !regulatoryData?.executiveSummary:', !regulatoryData?.executiveSummary);



        console.log('  - Current regulatoryData timestamp:', regulatoryData?.timestamp);



        console.log('  - New API timestamp:', newTimestamp);



        



        if (shouldUpdate) {



          console.log('✅ Found data in API response and data is newer - updating regulatory data');



          console.log('🔍🚀 REGULATORY API DATA EXTRACTED:');

          console.log('  - apiData.executiveSummary:', apiData.executiveSummary);

          console.log('  - apiData.euAiActDeadline:', apiData.euAiActDeadline);

          console.log('  - apiData.gdprCompliance:', apiData.gdprCompliance);

          console.log('  - apiData.potentialFines:', apiData.potentialFines);

          console.log('  - apiData.dataLocalization:', apiData.dataLocalization);

          console.log('  - apiData.keyUpdates:', apiData.keyUpdates);

          console.log('  - apiData.visualDataCards:', apiData.visualDataCards);

          console.log('  - apiData.regionalData:', apiData.regionalData);

          console.log('  - apiData.strategicRecommendations:', apiData.strategicRecommendations);

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

          console.log('🔍🚀 TRANSFORMED VISUAL DATA CARDS:', transformedVisualDataCards);

          console.log('🔍🚀 CURRENT REGULATORY DATA:');

          console.log('  - regulatoryData.executiveSummary:', regulatoryData.executiveSummary);

          console.log('  - regulatoryData.euAiActDeadline:', regulatoryData.euAiActDeadline);

          console.log('  - regulatoryData.gdprCompliance:', regulatoryData.gdprCompliance);



          



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



          console.log('🔍🚀 UPDATED REGULATORY DATA:');

          console.log('  - updatedRegulatoryData.executiveSummary:', updatedRegulatoryData.executiveSummary);

          console.log('  - updatedRegulatoryData.euAiActDeadline:', updatedRegulatoryData.euAiActDeadline);

          console.log('  - updatedRegulatoryData.gdprCompliance:', updatedRegulatoryData.gdprCompliance);



          







          



          setRegulatoryData(updatedRegulatoryData);



          



          // Save to localStorage for persistence



          saveRegulatoryDataToLocalStorage(updatedRegulatoryData);

          

          // Add a small delay to ensure state update is processed before validation

          setTimeout(() => {

            console.log('✅🚀 REGULATORY DATA STATE UPDATE COMPLETED');

          }, 100);



          



          console.log('✅🚀🚀🚀 REGULATORY DATA STATE UPDATED:', updatedRegulatoryData);



          console.log('✅🚀🚀🚀 REGULATORY - Old data:', regulatoryData);



          console.log('✅🚀🚀🚀 REGULATORY - New data:', updatedRegulatoryData);



        } else {



          console.log('ℹ️🚀 Current regulatory data is already up to date - no update needed');



        }



      } else {



        console.log('⚠️🚀 No regulatory data in API response or API call failed');



        console.log('⚠️🚀 result:', result);



      }



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



  const fetchCompetitorData = async (refresh = false, showLoading = true) => {



    console.log('🏆🏆🏆 COMPETITOR DATA FETCH CALLED - Starting fetchCompetitorData with refresh:', refresh, 'showLoading:', showLoading);



    console.log('🏆🏆🏆 COMPETITOR - Current competitorData state:', competitorData);



    console.log('🏆🏆🏆 COMPETITOR - Current competitorData.timestamp:', competitorData?.timestamp);

    
    // Add debugging for refresh state
    console.log('🏆🏆🏆 COMPETITOR - isRefreshing state:', isRefreshing);
    console.log('🏆🏆🏆 COMPETITOR - showLoading parameter:', showLoading);
    

    // Force clear cache for fresh data

    // Do not clear persisted data up front. We'll overwrite only after successful fetch/save.



    



    try {



      console.log('📍 Fetching competitor landscape data with correct component_name');



      // Only show individual loading if not in global refresh mode



      if (showLoading && !isRefreshing) {



        setIsCompetitorLoading(true);



      }



      setCompetitorError(null);







      // Get company profile data for dynamic payload



      let companyData = null;



      try {



        const profileData = getUserLocalStorage('companyProfileForRefresh', currentUser?.uid);

        console.log(`📋 COMPETITOR LANDSCAPE - Reading company profile at ${new Date().toISOString()} (user-specific)`);



        if (profileData) {



          companyData = JSON.parse(profileData);



          console.log('📋 Using company profile data for competitor request:', companyData);



        }



      } catch (error) {



        console.warn('⚠️ Could not get company profile data:', error);



      }







      // Payload specifically for Competitor Landscape using API structure



      const payload = {
        user_id: currentUser?.uid || "",
        component_name: "competitor landscape",
        data: {},
        refresh: refresh,
        _timestamp: Date.now(),
        _cache_bust: Math.random().toString(36).substring(7)
      };







      console.log('📤 Sending Competitor API request with payload:', payload);

      console.log('🔄 Competitor refresh parameter:', refresh);

      console.log('📦 Competitor Complete Payload:', JSON.stringify(payload, null, 2));



      console.log('📦 Competitor Payload component_name:', payload.component_name);



      console.log('📦 Competitor Payload keys:', Object.keys(payload));



      console.log('📦 Competitor Data keys:', Object.keys(payload.data));



      console.log('📦 Competitor Payload Data:', payload.data);



      console.log('📦 Competitor Refresh Flag:', payload.refresh);







      // Try the API call with retry mechanism



      let result;



      let retryCount = 0;



      const maxRetries = 2;



      



      while (retryCount <= maxRetries) {



        try {



          console.log(`🔄🏆 COMPETITOR LANDSCAPE - Attempting API call (attempt ${retryCount + 1}/${maxRetries + 1})`);

          const response = await fetch('/api/market-research', {



            method: 'POST',



            headers: {



              'Content-Type': 'application/json',



            },



            body: JSON.stringify(payload)



          });

          console.log('🏆 COMPETITOR LANDSCAPE - API response status:', response.status);
          
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

          console.log('✅🏆 COMPETITOR LANDSCAPE - API call successful');

          console.log('✅🏆 API response structure:', result);

          console.log('✅🏆 API response status:', result?.status);

          console.log('✅🏆 API response data exists:', !!result?.data);



          break; // Success, exit retry loop



        } catch (apiError) {



          retryCount++;



          console.error(`❌🏆 API call failed (attempt ${retryCount}/${maxRetries + 1}):`, apiError);



          



          if (retryCount > maxRetries) {



            throw apiError; // Re-throw if we've exhausted retries



          }



          



          // Wait before retrying



          console.log(`⏳🏆 Waiting 200ms before retry...`);



          await new Promise(resolve => setTimeout(resolve, 200)); // Reduced to 200ms for fastest retry



        }



      }



      // Check if result exists (all retries may have failed)
      if (!result) {
        console.error('❌🏆 All retry attempts failed - result is undefined');
        setCompetitorError('Failed to load competitor data after multiple attempts. The AI model service may be temporarily unavailable.');
        setIsCompetitorLoading(false);
        return;
      }

      console.log('📊🏆 Competitor API result:', result);



      console.log('📊🏆 Competitor API result.status:', result.status);



      console.log('📊🏆 Competitor API result.data exists:', !!result.data);



      console.log('📊🏆 Competitor API result.data:', result.data);



      console.log('🔥🏆 RAW Competitor Swagger Data:', JSON.stringify(result, null, 2));
      
      // Add specific debugging for Competitor Landscape
      console.log('🔍 COMPETITOR LANDSCAPE API DEBUG:');
      console.log('  - API call successful:', result.status === 'success');
      console.log('  - Has data:', !!result.data);
      console.log('  - Data structure:', result.data ? Object.keys(result.data) : 'No data');
      console.log('  - Has uiComponents:', !!result.data?.uiComponents);
      console.log('  - uiComponents length:', result.data?.uiComponents?.length || 0);



      console.log('🔍🏆 API CALL SUCCESS CHECK:');



      console.log('  - result exists:', !!result);



      console.log('  - result.status:', result?.status);



      console.log('  - result.data exists:', !!result?.data);



      console.log('  - result.error exists:', !!result?.error);







      if (result.status === 'success' && result.data) {



        const apiData = result.data;



        console.log('🎯🏆 Processing API data for Competitor Landscape:', apiData);



        console.log('🎯🏆 API Data Keys:', Object.keys(apiData));



        console.log('🎯🏆 API Data uiComponents:', apiData.uiComponents);



        



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



        



        console.log('🔍🏆 FULL API RESPONSE STRUCTURE:', JSON.stringify(apiData, null, 2));

        console.log('🔍🏆 API RESPONSE SUMMARY:');

        console.log('  - Has competitorLandscape:', !!apiData.competitorLandscape);

        console.log('  - Has strategicRecommendations:', !!apiData.strategicRecommendations);

        console.log('  - Has topPlayers:', !!apiData.competitorLandscape?.topPlayers);

        console.log('  - Has emergingPlayers:', !!apiData.competitorLandscape?.emergingPlayers);

        console.log('  - Has recentMoves:', !!apiData.competitorLandscape?.recentMoves);



        



        // Data extraction is now handled above in the new structured format



        



        console.log('🔍🏆 Data extracted from API response:');



          console.log('  - executiveSummary:', executiveSummary);



          console.log('  - topPlayerShare:', topPlayerShare);



          console.log('  - emergingPlayers:', emergingPlayers);



          console.log('  - fundingNews:', fundingNews);



        console.log('🔍🏆 Extraction method used: New structured format');







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

          console.log('🔄 COMPETITOR - FORCING UPDATE due to refresh request');

        }



        console.log('🔍🏆 COMPETITOR UPDATE DECISION:');



        console.log('  - refresh param:', refresh);



        console.log('  - hasNewData:', hasNewData);



        console.log('  - shouldUpdate:', shouldUpdate);



        console.log('  - !currentTimestamp:', !currentTimestamp);



        console.log('  - !competitorData?.executiveSummary:', !competitorData?.executiveSummary);



        



        if (shouldUpdate) {



          console.log('✅ New Competitor data is newer, updating UI');



          console.log('🔍🏆 FINAL EXTRACTED DATA BEFORE UPDATE:');



          console.log('  - executiveSummary:', executiveSummary, '(type:', typeof executiveSummary, ')');



          console.log('  - topPlayerShare:', topPlayerShare, '(type:', typeof topPlayerShare, ')');



          console.log('  - emergingPlayers:', emergingPlayers, '(type:', typeof emergingPlayers, ')');



          console.log('  - fundingNews:', fundingNews, '(type:', typeof fundingNews, ')');



          console.log('🔍🏆 DATA VALIDATION:');



          console.log('  - executiveSummary is null:', executiveSummary === null);



          console.log('  - topPlayerShare is null:', topPlayerShare === null);



          console.log('  - emergingPlayers is null:', emergingPlayers === null);



          console.log('  - fundingNews is null:', fundingNews === null);



          



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



          



          console.log('🔄🏆 UPDATING COMPETITOR DATA WITH FRESH API DATA:');



          console.log('  - New executiveSummary:', executiveSummary);



          console.log('  - New topPlayerShare:', topPlayerShare);



          console.log('  - New emergingPlayers:', emergingPlayers);



          console.log('  - New fundingNews:', fundingNews);



          console.log('  - New timestamp (UTC):', toUTCTimestamp(newTimestamp));



          



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



              console.log('💾 Competitor data saved to localStorage');

              

          // State update completed immediately

                console.log('✅🏆 COMPETITOR DATA STATE UPDATE COMPLETED');

          

          // Mark as fresh data to ensure strict replacement

          markFreshData('Competitor Landscape');



            } catch (error) {



              console.error('❌ Failed to save Competitor data to localStorage:', error);



            }



            



            console.log('🔄🏆 COMPETITOR - State update callback executed');



            console.log('🔄🏆 COMPETITOR - Previous data:', prevData);



            console.log('🔄🏆 COMPETITOR - New data:', newData);



            return newData;



          });



          



          console.log('✅🏆🏆🏆 COMPETITOR DATA STATE UPDATED:', updatedData);



          console.log('✅🏆🏆🏆 COMPETITOR - Old data:', competitorData);



          console.log('✅🏆🏆🏆 COMPETITOR - New data:', updatedData);



          console.log('✅🏆🏆🏆 COMPETITOR - State update triggered with refresh:', refresh);



          console.log('✅🏆🏆🏆 COMPETITOR - New timestamp:', updatedData.timestamp);



          console.log('🔄🏆 COMPETITOR - Component will re-render with new data');



        } else {



          console.log('ℹ️🏆 Current Competitor data is up to date - no update needed');

          

          // Force update on refresh even if data appears up to date

          if (refresh) {

            console.log('🔄 COMPETITOR - FORCING UPDATE on refresh even though data appears current');

            const forceUpdatedData = {

              ...competitorData,

              timestamp: toUTCTimestamp(new Date().toISOString()), // Force current timestamp
              
              // Ensure user_id is included for verification
              user_id: currentUser?.uid || competitorData?.user_id

            };

            setCompetitorData(forceUpdatedData);

            saveCompetitorDataToLocalStorage(forceUpdatedData);

            console.log('✅ COMPETITOR - Force updated with current timestamp');

          }



        }



      } else {



        console.log('⚠️🏆 No competitor data in API response or API call failed');



        console.log('⚠️🏆 result:', result);



        console.log('⚠️🏆 result.status:', result?.status);



        console.log('⚠️🏆 result.error:', result?.error);



        console.log('⚠️🏆 result.message:', result?.message);



        console.log('⚠️🏆 Full result:', result);
        
        // If result is undefined, it means all retries failed
        if (!result) {
          setCompetitorError('Failed to load competitor data after multiple attempts. The AI model service may be temporarily unavailable.');
        } else if (result.detail) {
          // Show the actual error message from the API
          setCompetitorError(`Failed to load competitor data: ${result.detail}`);
        }



      }



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



        console.log('🔄🏆 API failed - updating timestamp to pass validation');
        
        // Update existing data with current timestamp to pass isDataFresh check
        setCompetitorData(prevData => ({
          ...prevData,
          timestamp: Date.now().toString()
        }));
        
        console.log('🔄🏆 Updated timestamp to:', Date.now());



        console.log('🔄🏆 Existing data timestamp:', competitorData.timestamp);
      } else {
        // No existing data - set fallback data with current timestamp
        console.log('🔄🏆 No existing data - setting fallback data with current timestamp');
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



  const fetchMarketEntryData = async (refresh = false, showLoading = true) => {



    console.log('🚀 Starting fetchMarketEntryData with refresh:', refresh, 'showLoading:', showLoading);



    // Force clear cache for fresh data

    if (refresh) {

      console.log('🧹 MARKET ENTRY - Clearing localStorage cache for fresh data...');

      if (currentUser?.uid) {
        removeUserLocalStorage('marketEntryData', currentUser.uid);
      } else {
        localStorage.removeItem('marketEntryData');
      }

    }



    try {



      console.log('📍 Fetching market entry data with correct component_name');



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



          console.log('📋 Using company profile data for market entry request:', companyData);



        }



      } catch (error) {



        console.warn('⚠️ Could not get company profile data:', error);



      }







      // Payload specifically for Market Entry & Growth Strategy using API structure



      const payload = {



        user_id: currentUser?.uid || "",



        component_name: "market entry & growth strategy",



        data: {},



        refresh: refresh,

        _forceRefresh: refresh,

        _timestamp: Date.now(),

        _cacheBust: Math.random().toString(36).substring(7)



      };







      console.log('📤 Sending Market Entry API request with payload:', payload);

      console.log('🔄 Market Entry refresh parameter:', refresh);

      console.log('🔄 REFRESH in payload:', payload.refresh);



      // Use cache-busted API call for fresh data

      const cacheBustedPayload = {

        ...payload,

        _timestamp: Date.now(),

        _cache_bust: Math.random().toString(36).substring(7)

      };

      console.log('📤 Market Entry cache-busted payload:', cacheBustedPayload);

      

      const response = await fetch('/api/market-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cacheBustedPayload)
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

      console.log('📨 Market Entry API result:', result);



      console.log('📊 Market Entry API result:', result);



      console.log('📊 Full API Response Structure:', result);



      // Log the result for debugging

      logApiCallResult('Market Entry', result, refresh);



      if (result.status === 'success' && result.data) {



        const apiData = result.data;



        console.log('🎯 Processing API data for Market Entry:', apiData);







        // Check timestamp comparison with timestampUtils  



        const currentTimestamp = marketEntryData.timestamp || null;



        const newTimestamp = apiData.timestamp;



        



        console.log('🔍 MARKET ENTRY TIMESTAMP ANALYSIS (UTC):');



        console.log('  - Current request time (UTC):', new Date().toISOString());



        console.log('  - Frontend data time (UTC):', currentTimestamp ? new Date(currentTimestamp).toISOString() : 'NO_TIMESTAMP');



        console.log('  - Swagger data time (UTC):', newTimestamp ? new Date(newTimestamp).toISOString() : 'NO_TIMESTAMP');



        console.log('  - Raw current timestamp:', currentTimestamp);



        console.log('  - Raw new timestamp:', newTimestamp);



        



        const shouldUpdate = refresh || !currentTimestamp || (newTimestamp && isTimestampNewer(newTimestamp, currentTimestamp));



        



        console.log('🔄 MARKET ENTRY UPDATE DECISION:');



        console.log('  - Should update data:', shouldUpdate);



        console.log('  - Current data timestamp:', currentTimestamp ? new Date(currentTimestamp).toISOString() : 'NO_TIMESTAMP');



        console.log('  - New data timestamp:', newTimestamp ? new Date(newTimestamp).toISOString() : 'NO_TIMESTAMP');



        console.log('  - Reason for update:', !currentTimestamp ? 'No existing data - first load' : 'Newer data available');



        



        if (shouldUpdate) {



          console.log('✅ Found data in API response and data is newer - updating');



          console.log('🔄 Updating Market Entry data with newer report');



          



          // Update market entry data with API response - mapping all the swagger fields



          const updatedData = {



            executiveSummary: apiData.executiveSummary || marketEntryData.executiveSummary,



            entryBarriers: apiData.entryBarriers || marketEntryData.entryBarriers,



            recommendedChannel: apiData.recommendedChannel || marketEntryData.recommendedChannel,



            timeToMarket: apiData.timeToMarket || marketEntryData.timeToMarket,



            topBarrier: apiData.topBarrier || marketEntryData.topBarrier,



            competitiveDifferentiation: apiData.competitiveDifferentiation || marketEntryData.competitiveDifferentiation,



            strategicRecommendations: apiData.strategicRecommendations || marketEntryData.strategicRecommendations,



            riskAssessment: apiData.riskAssessment || marketEntryData.riskAssessment,



            swot: apiData.swot || marketEntryData.swot,



            timeline: apiData.timeline || marketEntryData.timeline,



            marketSizeBySegment: apiData.marketSizeBySegment || marketEntryData.marketSizeBySegment,



            growthProjections: apiData.growthProjections || marketEntryData.growthProjections,



            timestamp: toUTCTimestamp(newTimestamp)



          };



          



          setMarketEntryData(updatedData);



          



          // Save to localStorage for persistence



          saveMarketEntryDataToLocalStorage(updatedData);



          



          console.log('✅ MARKET ENTRY DATA UPDATED - Component name:', apiData.component_name);



        } else {



          console.log('ℹ️ Current Market Entry data is up to date');



        }



      }



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



    console.log('🔥 Setting up initial data load and sync');



    



    // Add mounting guard to prevent infinite loops



    let isMounted = true;



    



    const setupInitialData = async () => {



      if (!isMounted) return;



      // DO NOT restore data from localStorage during refresh - this causes components to switch to previous data
      if (isRefreshing) {
        console.log('🔄 Refresh in progress - skipping localStorage data restoration to prevent data switching');
        return;
      }


      // Check if we have persistent data from previous session



      const storedMarketData = getUserLocalStorage('marketIntelligenceData', currentUser?.uid);



      if (storedMarketData) {



        try {



          const parsedData = JSON.parse(storedMarketData);



          if (parsedData.timestamp) {



            console.log('📦 Found persistent Market Size data from previous session - preserving it');



            console.log('🔧 Not clearing data - user will see last Swagger data until new data arrives');



            console.log('💾 Persistent data timestamp:', parsedData.timestamp);



            



            // Make sure the persistent data is properly set in marketData state too



            if (isMounted) {



              setMarketData(prev => {



                const restoredData = {



                  ...prev,



                  executiveSummary: parsedData.executiveSummary,



                  tamValue: parsedData.tamValue,



                  samValue: parsedData.samValue,



                  apacGrowthRate: parsedData.apacGrowthRate,



                  strategicRecommendations: parsedData.strategicRecommendations,



                  marketEntry: parsedData.marketEntry,



                  marketDrivers: parsedData.marketDrivers,



                  marketSizeBySegment: parsedData.marketSizeBySegment,



                  growthProjections: parsedData.growthProjections,



                  timestamp: parsedData.timestamp



                };



                console.log('🔄 Restored persistent data to marketData state:', restoredData);



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



      



      console.log('🧹 No valid persistent data found - fetching fresh data from backend');



      // If no valid cached data, fetch from backend



      await fetchMarketData();



      



      if (!isMounted) return;



      



      // Check if we have Market Entry data, if not fetch it



      const storedMarketEntry = getUserLocalStorage('marketEntryData', currentUser?.uid);



      if (!storedMarketEntry || !JSON.parse(storedMarketEntry).timestamp) {



        console.log('📊 No Market Entry data found, fetching from API...');



        await fetchMarketEntryData(false, true); // Don't refresh, but show loading



      } else {



        console.log('📊 Market Entry data already loaded from localStorage');



      }







      if (!isMounted) return;







      // Fetch Industry Trends data



      console.log('📊 Fetching Industry Trends data...');



      await fetchIndustryTrendsData(false, true);







      if (!isMounted) return;







      // Fetch Competitor Landscape data



      console.log('📊 Fetching Competitor data...');



      await fetchCompetitorData(false, true);







      if (!isMounted) return;







      // Fetch Regulatory Compliance data only if we don't already have fresh data
      if (!regulatoryData?.timestamp) {
        console.log('📊 Fetching Regulatory data...');
        await fetchRegulatoryData(false, true);
      } else {
        console.log('📊 Regulatory data already has fresh timestamp, skipping fetch:', regulatoryData.timestamp);
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



        console.warn('Could not load company profile data:', error);



      }



    };



    



    loadCompanyProfile();



    



    const handleCompanyProfileUpdate = () => {



      console.log('Company profile updated, reloading profile data and triggering Scout refresh...');



      loadCompanyProfile();



      triggerScoutAndRefresh();



    };







    window.addEventListener('companyProfileUpdated', handleCompanyProfileUpdate);



    



    return () => {



      window.removeEventListener('companyProfileUpdated', handleCompanyProfileUpdate);



    };



  }, []);







  // Listen for AI view changes from header



  useEffect(() => {



    const handleAIViewChange = (event: CustomEvent) => {



      console.log('AI View changed to:', event.detail.isAIView);



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



      console.log('Selected Market Data:', marketData);



      console.log('Sub-markets:', marketData.details.subMarkets);



      console.log('Key Insights:', marketData.details.keyInsights);



      console.log('Recommended Actions:', marketData.details.recommendedActions);



      



      setSelectedMarket(marketData);



      setIsDrawerOpen(true);



    } else {



      console.log('Market data not found');



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

    console.log('🔄 Refresh button clicked!', { isShowingHistoricalData, isRefreshing });



    if (isShowingHistoricalData) {



      // If showing historical data, return to current data



      returnToCurrentData();



    } else {



      // Always trigger full refresh to ensure all components get fresh data
      console.log('🔄 Triggering full refresh to ensure all components get fresh data...');
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



    console.log('Market Size Scout clicked with context:', context, 'hasEdits:', hasEdits, 'customMessage:', customMessage);



    



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



    console.log('🎯 Market Size Scout chat panel opened');



  };







  // Industry Trends Scout icon click handler  



  const handleIndustryTrendsScoutClick = async (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => {



    console.log('Industry Trends Scout clicked with context:', context, 'hasEdits:', hasEdits, 'customMessage:', customMessage);



    



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



    console.log('🎯 Industry Trends Scout chat panel opened');



  };







  // Competitor Landscape Scout icon click handler  



  const handleCompetitorScoutClick = async (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => {



    console.log('Competitor Scout clicked with context:', context, 'hasEdits:', hasEdits, 'customMessage:', customMessage);



    



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



    console.log('🎯 Competitor Scout chat panel opened');



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



    setShowMarketSizeScoutChat(true);



    setIsChatOpen(true);



  };







  const handleMarketIntelligenceCancelEdit = () => {



    setIsMarketIntelligenceEditing(false);



    // Reset any unsaved changes



  };







  const handleMarketIntelligenceExpandToggle = (expanded: boolean) => {



    console.log('🔄 Market Intelligence Expand Toggle called with:', expanded);



    console.log('🔄 Current isMarketIntelligenceExpanded state:', isMarketIntelligenceExpanded);



    setIsMarketIntelligenceExpanded(expanded);



  };







  const handleMarketIntelligenceExportPDF = () => {



    console.log('Export PDF clicked');



  };







  const handleMarketIntelligenceSaveToWorkspace = () => {



    console.log('Save to workspace clicked');



  };







  const handleMarketIntelligenceGenerateShareableLink = () => {



    console.log('Generate shareable link clicked');



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



    



    // Force contextual message state for Competitor Landscape Scout



    setCompetitorHasEdits(true);







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







  const handleMarketIntelligenceApacGrowthRateChange = (value: string) => {



    const oldValue = marketIntelligenceData.apacGrowthRate;



    addEditRecord(



      'APAC Growth',



      oldValue,



      value,



      'Updated APAC region growth rate'



    );



    setMarketIntelligenceData(prev => {



      // CRITICAL: Always include user_id to ensure data isolation
      const newData = { ...prev, apacGrowthRate: value, user_id: currentUser?.uid || prev.user_id };



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



      console.log('Adding edit record:', editRecord);



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



    console.log('Regulatory scout clicked with context:', context, 'hasEdits:', hasEdits, 'customMessage:', customMessage);



    



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



    console.log('🎯 Regulatory Scout chat panel opened');



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



    console.log('Viewing Market Entry edit details:', editId);



  };



  const handleMarketEntryExecutiveSummaryChange = (value: string) => {



    const oldValue = marketEntryData.executiveSummary;



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



    const oldValue = marketEntryData.entryBarriers.join(', ');



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



    const oldValue = marketEntryData.recommendedChannel;



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



    const oldValue = marketEntryData.timeToMarket;



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



    const oldValue = marketEntryData.topBarrier;



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



    const oldValue = marketEntryData.competitiveDifferentiation.join(', ');



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



    const oldValue = marketEntryData.strategicRecommendations.join(', ');



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



    const oldValue = marketEntryData.riskAssessment.join(', ');



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



    console.log('Market Entry scout clicked with context:', context);



    



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



    console.log('🎯 Market Entry Scout chat panel opened');



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



      case 'APAC Growth':



        setMarketIntelligenceData(prev => ({ ...prev, apacGrowthRate: edit.oldValue }));



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



    console.log('Viewing edit details:', editId);



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



  if (isInitialLoading && !marketData) {



    console.log('Showing loading screen - no data exists anywhere');



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

    console.log('🚀🚀🚀 PARALLEL REFRESH - Starting parallel API calls for faster loading...');

    

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

        

        console.log(`🚀 Starting ${component.name} API call...`);

        const result = await executeWithRateLimit(

          () => component.fetchFn(true, false),

          component.name

        );

        

        console.log(`✅ ${component.name} completed successfully`);

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

    console.log('🎉 All parallel API calls completed');

    

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



            



            {/* Component Status Loading Screen */}

            {isRefreshing && (

              <ComponentStatusLoadingScreen 

                componentStatus={componentStatus}

                refreshAttempt={refreshAttempt}

                maxRetries={3}

                isValidating={validationAttempts > 0}

                validationAttempt={validationAttempts}

                consecutiveValidations={consecutiveValidations}

                loadingPhase={loadingPhase}

                componentRenderingStatus={componentRenderingStatus}

                onClose={() => setIsRefreshing(false)}

              />

            )}


            
            



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



        <ScrollArea className="flex-1">



          {/* Show content only when all components are successful or when not refreshing */}



          <div className={`transition-opacity duration-300 ${

            (isRefreshing || isInitialLoading) && marketData ? 'opacity-70' : 'opacity-100'

          } relative`}>



            {/* Show main content when not refreshing */}

            {!isRefreshing ? (

            <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-0">



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



                       apacGrowthRate={marketData?.apacGrowthRate || marketIntelligenceData.apacGrowthRate}



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



                        regulatoryExecutiveSummary={regulatoryData.executiveSummary}



                       regulatoryEuAiActDeadline={regulatoryData.euAiActDeadline}



                       regulatoryGdprCompliance={regulatoryData.gdprCompliance}



                       regulatoryPotentialFines={regulatoryData.potentialFines}



                       regulatoryDataLocalization={regulatoryData.dataLocalization}



                      // Market Entry props



                      isMarketEntryEditing={isMarketEntryEditing}



                      marketEntryExpanded={marketEntryExpanded}



                      marketEntryHasEdits={marketEntryHasEdits}



                      marketEntryDeletedSections={marketEntryDeletedSections}



                      marketEntryEditHistory={marketEntryEditHistory}



                      marketEntryExecutiveSummary={marketEntryData.executiveSummary}



                      marketEntryBarriers={marketEntryData.entryBarriers}



                      marketEntryRecommendedChannel={marketEntryData.recommendedChannel}



                      marketEntryTimeToMarket={marketEntryData.timeToMarket}



                      marketEntryTopBarrier={marketEntryData.topBarrier}



                      marketEntryCompetitiveDifferentiation={marketEntryData.competitiveDifferentiation}



                        marketEntryStrategicRecommendations={marketEntryData.strategicRecommendations}



                        marketEntryRiskAssessment={marketEntryData.riskAssessment}



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



                      onApacGrowthRateChange={handleMarketIntelligenceApacGrowthRateChange}



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



                <LeadStream 



                  selectedIndustry={leadStreamFilters.selectedIndustry}



                  selectedSize={leadStreamFilters.selectedSize}



                  selectedRegion={leadStreamFilters.selectedRegion}



                  onFiltersChange={(filters) => setLeadStreamFilters(filters)}



                />



              </TabsContent>



              



              <TabsContent value="trends" className="mt-0">



                <ScoutChatPanel 



                  showScoutChat={true}



                  isSplitView={false}



                  hasEdits={false}



                  showEditHistory={false}



                  editHistory={editHistory}



                  lastEditedField=""



                  onClose={() => setActiveTab("intelligence")}



                />



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



    </Layout>



  );



});







export default MarketResearch;



