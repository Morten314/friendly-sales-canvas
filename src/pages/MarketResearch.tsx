import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Search, MessageSquare, Users, Settings, RefreshCw, AlertCircle, History, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Badge } from "@/components/ui/badge";
import { RecentMarketResearch } from "@/components/market-research/RecentMarketResearch";
import { ScoutCapabilities } from "@/components/market-research/ScoutCapabilities";
import { MarketRankings } from "@/components/market-research/MarketRankings";
import CompetitorAnalysisSection from "@/components/market-research/CompetitorAnalysis";
import { MarketSegments } from "@/components/market-research/MarketSegments";
import { SwotAnalysis } from "@/components/market-research/SwotAnalysis";
import { EmergingTrends } from "@/components/market-research/EmergingTrends";
import { ConsumerTrends } from "@/components/market-research/ConsumerTrends";
import { TechnologyDrivers } from "@/components/market-research/TechnologyDrivers";
import { MarketDetailDrawer } from "@/components/market-research/MarketDetailDrawer";
import { ScoutDeploymentDetails } from "@/components/market-research/ScoutDeploymentDetails";
import { ScoutSettingsForm } from "@/components/market-research/ScoutSettingsForm";
import { ScoutLoadingAnimation } from "@/components/market-research/ScoutLoadingAnimation";
import { DataHistoryDialog } from "@/components/market-research/DataHistoryDialog";
import MarketIntelligenceTab from "@/components/market-research/MarketIntelligenceTab";
import EditHistoryPanel from "@/components/market-research/EditHistoryPanel";
import { DeploymentData } from "@/components/layout/Header";
import { useNavigate, useLocation } from "react-router-dom";
import { toUTCTimestamp, isTimestampNewer, logTimestampComparison } from '@/lib/timestampUtils';
import ScoutChatPanel from "@/components/market-research/ScoutChatPanel";


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

// Cache for market data - DISABLED to ensure fresh data on every load
let cachedMarketData: MarketIntelligenceData | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 0; // Disabled - always fetch fresh data

// Helper function to check if cached data is still valid
const isCacheValid = (): boolean => {
  if (!cachedMarketData || !cacheTimestamp) return false;
  return Date.now() - cacheTimestamp < CACHE_DURATION;
};

// Helper function to get cached data even if expired (for fallback display)
const getCachedData = (): MarketIntelligenceData | null => {
  return cachedMarketData;
};

const MarketResearch = () => {
  usePageTitle("🔍 Scout - Brewra");
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
    const cached = getCachedData();
    return cached;
  });
  
  // Show loading when either initially loading OR refreshing
  const [isInitialLoading, setIsInitialLoading] = useState(() => {
    const hasData = !!getCachedData();
    return !hasData; // Only loading if no cached data exists
  });
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // MarketIntelligenceTab state
  const [isMarketIntelligenceEditing, setIsMarketIntelligenceEditing] = useState(false);
  const [isMarketIntelligenceExpanded, setIsMarketIntelligenceExpanded] = useState(false);
  // Get initial market intelligence data from localStorage or defaults
  const getInitialMarketIntelligenceData = () => {
    try {
      const stored = localStorage.getItem('marketIntelligenceData');
      if (stored) {
        const parsedData = JSON.parse(stored);
        // Only return stored data if it has a timestamp (meaning it came from swagger)
        if (parsedData.timestamp) {
          return parsedData;
        } else {
          localStorage.removeItem('marketIntelligenceData');
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
  
  // State for storing original data before edits
  const [marketIntelligenceOriginalData, setMarketIntelligenceOriginalData] = useState(getInitialMarketIntelligenceData());
  
  // State for storing JSON data for the /ask API
  const [marketSizeOriginalData, setMarketSizeOriginalData] = useState<any>(null);
  const [marketSizeModifiedData, setMarketSizeModifiedData] = useState<any>(null);
  
  // Industry Trends JSON data for /ask API
  const [industryTrendsOriginalData, setIndustryTrendsOriginalData] = useState<any>(null);
  const [industryTrendsModifiedData, setIndustryTrendsModifiedData] = useState<any>(null);
  
  // Competitor Analysis JSON data for /ask API
  const [competitorOriginalData, setCompetitorOriginalData] = useState<any>(null);
  const [competitorModifiedData, setCompetitorModifiedData] = useState<any>(null);
  
  // Regulatory Compliance JSON data for /ask API
  const [regulatoryOriginalData, setRegulatoryOriginalData] = useState<any>(null);
  const [regulatoryModifiedData, setRegulatoryModifiedData] = useState<any>(null);
  
  // Market Entry JSON data for /ask API
  const [marketEntryOriginalData, setMarketEntryOriginalData] = useState<any>(null);
  const [marketEntryModifiedData, setMarketEntryModifiedData] = useState<any>(null);

  // Helper function to save market intelligence data to localStorage
  const saveMarketIntelligenceToLocalStorage = (data: any) => {
    try {
      localStorage.setItem('marketIntelligenceData', JSON.stringify(data));
    } catch (error) {
      console.error('❌ Failed to save Market Intelligence data to localStorage:', error);
    }
  };

  // Market Size API state
  const [isMarketSizeLoading, setIsMarketSizeLoading] = useState(false);
  const [marketSizeError, setMarketSizeError] = useState<string | null>(null);
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
  const [industryTrendsData, setIndustryTrendsData] = useState({
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
      primaryFocus: "Prioritize AI-driven solutions and cloud-native architecture to capture the growing market demand for intelligent automation.",
      marketEntry: "Target mid-market enterprises in APAC and Europe where regulatory compliance and AI adoption create the strongest business case."
    },
    risks: [
      "Regulatory uncertainty in AI governance could slow enterprise adoption",
      "Cloud vendor lock-in risks may drive customers toward multi-cloud strategies",
      "Skills shortage in AI/ML talent could limit implementation speed"
    ],
    timestamp: null as string | null
  });
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
  const [regulatoryData, setRegulatoryData] = useState({
    executiveSummary: 'The regulatory landscape for SaaS companies continues to evolve rapidly, with new compliance requirements emerging across multiple jurisdictions. Organizations must navigate an increasingly complex web of data protection, AI governance, and industry-specific regulations.',
    euAiActDeadline: 'February 2, 2025',
    gdprCompliance: '68%',
    potentialFines: 'Up to 6% of annual revenue',
    dataLocalization: 'Mandatory for customer data',
    timestamp: null as string | null
  });
  const [regulatoryOriginalDataSnapshot, setRegulatoryOriginalDataSnapshot] = useState<any>(null);

  // Competitor Landscape state - Add these new state variables
  const [isCompetitorEditing, setIsCompetitorEditing] = useState(false);
  const [competitorExpanded, setCompetitorExpanded] = useState(false);
  const [competitorHasEdits, setCompetitorHasEdits] = useState(false);
  const [competitorDeletedSections, setCompetitorDeletedSections] = useState<Set<string>>(new Set());
  const [competitorEditHistory, setCompetitorEditHistory] = useState<EditRecord[]>([]);
  const [competitorData, setCompetitorData] = useState({
    executiveSummary: "The enterprise collaboration tools market is increasingly competitive, with several dominant players holding significant market share. However, emerging startups are introducing disruptive features, shifting the landscape rapidly.",
    topPlayerShare: "48%",
    emergingPlayers: "2",
    fundingNews: [
      "Notion raises $300M Series C - Valuation reaches $10B as workspace tools gain traction",
      "Microsoft Teams launches AI Copilot - New AI features for meeting summaries and task automation",
      "Slack introduces Workflow Builder 2.0 - Enhanced automation capabilities for enterprise customers"
    ],
    timestamp: null as string | null
  });

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
  // Function to get initial Market Entry data from localStorage or defaults
  const getInitialMarketEntryData = () => {
    try {
      const stored = localStorage.getItem('marketEntryData');
      if (stored) {
        const parsedData = JSON.parse(stored);
        // Only return stored data if it has a timestamp (meaning it came from API)
        if (parsedData.timestamp) {
          console.log('✅ Market Entry data loaded with timestamp:', parsedData.timestamp);
          return parsedData;
        }
      }
    } catch (error) {
      console.error('❌ Error loading Market Entry data from localStorage:', error);
    }
    
    // Return default data if no valid stored data
    return {
      executiveSummary: 'The Indian SaaS market offers significant growth potential for mid-size players, but entry barriers exist due to regulatory compliance and entrenched competitors. Strategic partnerships and phased market entry approaches can help mitigate risks while maximizing opportunities.',
      entryBarriers: ['Data residency regulations', 'Established local competitors', 'Complex compliance requirements', 'Cultural adaptation needs'],
      recommendedChannel: 'Local partnerships',
      timeToMarket: '12-18 months',
      topBarrier: 'Data residency laws',
      competitiveDifferentiation: ['Advanced AI capabilities', 'Robust security framework', 'Flexible deployment options', 'Strong API ecosystem'],
      strategicRecommendations: ['Partner with local system integrators', 'Establish regional data centers', 'Develop compliance automation tools', 'Create localized go-to-market strategy'],
      riskAssessment: ['Regulatory changes could impact timeline', 'Competition intensifying rapidly', 'Economic uncertainty affecting IT spending'],
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
  }, [location.pathname, activeTab, getActiveTabFromPath]);

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
      apacGrowthRate: reportData.apacGrowthRate || '',
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
              cache.delete('https://backend-11kr.onrender.com/market_intelligence')
            )
          )
        );
      }
      
      // Try to get existing market intelligence data first
      const response = await fetch(`https://backend-11kr.onrender.com/market_intelligence?t=${Date.now()}&cache_bust=${Math.random()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const apiResponse = await response.json();
      console.log('📊 Market intelligence API response received');
      
      // Extract the report data from the API response
      const reportData = apiResponse.report || apiResponse;
      
      // Transform the data to match our expected structure
      const transformedData = transformReportData(reportData);
      
        // Update both state and localStorage for persistence
        setMarketData(transformedData);
        // Save transformed data to localStorage for persistence
        saveMarketIntelligenceToLocalStorage(transformedData);
        
      
      // Reset historical data flags when fetching current data
      setIsShowingHistoricalData(false);
      setHistoricalDataTimestamp(null);
      
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
      
      // Always ensure we show any available data, even if the fetch failed
      const fallbackData = getCachedData();
      if (fallbackData && !marketData) {
        
        setMarketData(fallbackData);
      }
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  // Trigger market research using the existing backend API structure
  const triggerScoutAndRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      
      
      // Refresh all components using the new function
      await refreshAllComponentsData();
      
      
      
      // Reset historical data flags
      setIsShowingHistoricalData(false);
      setHistoricalDataTimestamp(null);
      
    } catch (err) {
      console.error('Error in market research refresh:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh market research data');
      
      // Keep showing existing data even if the operation failed
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch Market Size data using existing backend APIs with smart loading
  const fetchMarketSizeData = async (refresh = true, showLoading = true) => {
    try {
      if (showLoading) {
        setIsMarketSizeLoading(true);
      }
      setMarketSizeError(null);

      // Modified payload to fetch existing reports instead of generating new ones
      const currentTime = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const payload = {
        user_id: "brewra",
        component_name: "Market Size & Opportunity",
        refresh: false,  // Changed to false to fetch existing data
        force_refresh: false,  // Changed to false
        cache_bypass: false,  // Changed to false
        bypass_all_cache: false,  // Changed to false
        request_timestamp: currentTime,
        request_id: randomId,
        data: {
          company: "OrbiSelf",
          product: "Convoic.AI",
          target_market: "Indian college students (Tier 2 & 3)",
          region: "India",
          timestamp: currentTime,
          force_new_data: false  // Changed to false to fetch existing report
        }
      };

      console.log('📤 Market Size API request sent');

      // Add debugging to track data freshness
      const requestTimestamp = Date.now();
      
      const response = await fetch('https://backend-11kr.onrender.com/market-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const apiResponse = await response.json();
      console.log('📥 Market Size API response received');
      // Extract timestamps for comparison - convert to UTC
      const newDataTimestamp = apiResponse.data?.timestamp || apiResponse.timestamp;
      const currentDataTimestamp = marketIntelligenceData.timestamp;
      
      // Use UTC timestamp utilities for consistent comparison
      logTimestampComparison(currentDataTimestamp, newDataTimestamp, 'Market Size');
      
      // Only update data if Swagger timestamp is newer than current UI timestamp OR if force refresh
      let shouldUpdateData = false;
      if (!currentDataTimestamp) {
        shouldUpdateData = true;
      } else if (newDataTimestamp) {
        const isNewerData = isTimestampNewer(newDataTimestamp, currentDataTimestamp);
        shouldUpdateData = refresh || isNewerData;
      }

      // Update market intelligence data with API response only if data is newer
      if (apiResponse.data && shouldUpdateData) {
        const report = apiResponse.data;
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
            strategicRecommendations: report.strategicRecommendations !== undefined ? report.strategicRecommendations : prev.strategicRecommendations,
            marketEntry: report.marketEntry !== undefined ? report.marketEntry : prev.marketEntry,
            marketDrivers: report.marketDrivers !== undefined ? report.marketDrivers : prev.marketDrivers,
            marketSizeBySegment: report.marketSizeBySegment !== undefined ? report.marketSizeBySegment : prev.marketSizeBySegment,
            growthProjections: report.growthProjections !== undefined ? report.growthProjections : prev.growthProjections,
            timestamp: toUTCTimestamp(newDataTimestamp), // Store as UTC timestamp
            originalSwaggerTimestamp: toUTCTimestamp(newDataTimestamp) // Track the original timestamp in UTC
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
            executiveSummary: report.executiveSummary,
            tamValue: report.tamValue,
            samValue: report.samValue,
            apacGrowthRate: report.apacGrowthRate,
            strategicRecommendations: report.strategicRecommendations,
            marketEntry: report.marketEntry,
            marketDrivers: report.marketDrivers,
            marketSizeBySegment: report.marketSizeBySegment, // This was missing!
            growthProjections: report.growthProjections,      // This was missing!
            timestamp: newDataTimestamp // Store the Swagger generation timestamp
          };
          console.log('✅ Updated marketData with Market Size API data:', updated);
          
          // Stop loading states after successful Market Size data fetch
          setIsInitialLoading(false);
          setIsRefreshing(false);
          
          return updated;
        });
      } else {
        console.log('❌ No data found in Market Size API response - keeping existing data');
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }

    } catch (err) {
      console.error('Error fetching market size data:', err);
      setMarketSizeError(err instanceof Error ? err.message : 'Failed to fetch market size data');
      // Stop loading even on error
      setIsInitialLoading(false);
      setIsRefreshing(false);
    } finally {
      setIsMarketSizeLoading(false);
    }
  };

  // Fetch Industry Trends data using backend API with correct component_name
  const fetchIndustryTrendsData = async (refresh = true, showLoading = true) => {
    console.log('🚀 Starting fetchIndustryTrendsData with refresh:', refresh, 'showLoading:', showLoading);
    try {
      console.log('📍 Fetching industry trends data with correct component_name');
      if (showLoading) {
        setIsMarketSizeLoading(true); // Reuse same loading state for now
      }
      setMarketSizeError(null);

      const payload = {
        user_id: "brewra",
        component_name: "industry trends report",
        data: {
          company: "OrbiSelf",
          product: "Convoic.AI",
          target_market: "Indian college students (Tier 2 & 3)",
          region: "India"
        },
        refresh: refresh
      };
      
      console.log('📤 Industry Trends API request:', payload);

      const response = await fetch('https://backend-11kr.onrender.com/market-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📨 Industry Trends API response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Industry Trends API result:', result);
      console.log('🔍 Raw Swagger Data for Industry Trends:', JSON.stringify(result, null, 2));

      if (result.status === 'success' && result.data) {
        const apiData = result.data;

        // Check timestamp comparison with timestampUtils
        const currentTimestamp = industryTrendsData.timestamp || null;
        const newTimestamp = apiData.timestamp;
        
        logTimestampComparison(currentTimestamp, newTimestamp, 'IndustryTrends');
        
        if (!currentTimestamp || isTimestampNewer(newTimestamp, currentTimestamp) || refresh) {
          
          // Update industry trends data with API response - map to component state
          if (apiData.executiveSummary) {
            handleIndustryTrendsExecutiveSummaryChange(apiData.executiveSummary);
          }
          
          // Map other API data fields to appropriate component states
          if (apiData.marketDrivers && apiData.marketDrivers.length > 0) {
            handleIndustryTrendsAiAdoptionChange(apiData.marketDrivers[0] || '');
            handleIndustryTrendsCloudMigrationChange(apiData.marketDrivers[1] || '');
            handleIndustryTrendsRegulatoryChange(apiData.marketDrivers[2] || '');
          }
          
          const updatedData = {
            ...industryTrendsData,
            executiveSummary: apiData.executiveSummary,
            marketDrivers: apiData.marketDrivers,
            strategicRecommendations: apiData.strategicRecommendations,
            risks: apiData.risks,
            regionalHotspots: apiData.regionalHotspots,
            visualCharts: apiData.visualCharts,
            timestamp: toUTCTimestamp(newTimestamp)
          };
          
          setIndustryTrendsData(updatedData);
          console.log('✅ Industry Trends data updated successfully with mapped fields:', updatedData);
        } else {
          console.log('ℹ️ Current Industry Trends data is up to date');
        }
      }
    } catch (error) {
      console.error('❌ Error fetching Industry Trends data:', error);
      setMarketSizeError('Failed to load industry trends data');
    } finally {
      if (showLoading) {
        setIsMarketSizeLoading(false);
      }
    }
  };

  // Fetch Market Entry data using backend API with correct component_name
  const fetchMarketEntryData = async (refresh = true, showLoading = true) => {
    console.log('🚀 Starting fetchMarketEntryData with refresh:', refresh, 'showLoading:', showLoading);
    try {
      console.log('📍 Fetching market entry data with correct component_name');
      if (showLoading) {
        setIsMarketSizeLoading(true); // Reuse same loading state for now
      }
      setMarketSizeError(null);

      // Payload specifically for Market Entry & Growth Strategy (matching other components pattern)
      const payload = {
        user_id: "brewra",
        component_name: "Market Entry & Growth Strategy", // Exact match from your swagger
        refresh: false, // Always false initially to get existing data
        force_refresh: false,
        cache_bypass: false,
        bypass_all_cache: false,
        request_timestamp: Date.now(),
        request_id: Math.random().toString(36).substr(2, 6),
        data: {
          company: "OrbiSelf",
          product: "Convoic.AI", 
          target_market: "Indian college students (Tier 2 & 3)",
          region: "India",
          timestamp: Date.now(),
          force_new_data: false
        }
      };

      console.log('📤 Sending Market Entry API request with payload:', payload);
      console.log('⏰ MARKET ENTRY REQUEST TIMESTAMP:', payload.request_timestamp);
      console.log('🔄 FORCE_REFRESH in payload:', payload.force_refresh);

      const response = await fetch('https://backend-11kr.onrender.com/market-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📨 Market Entry API response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Market Entry API result:', result);
      console.log('📊 Full API Response Structure:', result);
      console.log('📊 Market Entry Data Keys:', Object.keys(result.data || {}));

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
        
        const shouldUpdate = !currentTimestamp || isTimestampNewer(newTimestamp, currentTimestamp) || refresh;
        
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
          try {
            localStorage.setItem('marketEntryData', JSON.stringify(updatedData));
            console.log('💾 Market Entry data saved to localStorage');
          } catch (error) {
            console.error('❌ Failed to save Market Entry data to localStorage:', error);
          }
          
          console.log('✅ MARKET ENTRY DATA UPDATED - Component name:', apiData.component_name);
        } else {
          console.log('ℹ️ Current Market Entry data is up to date');
        }
      }
    } catch (error) {
      console.error('❌ Error fetching Market Entry data:', error);
      setMarketSizeError('Failed to load market entry data');
    } finally {
      if (showLoading) {
        setIsMarketSizeLoading(false);
      }
    }
  };

  // Fetch Competitor Landscape data using backend API with correct component_name
  const fetchCompetitorData = async (refresh = false, showLoading = true) => {
    console.log('🚀 Starting fetchCompetitorData with refresh:', refresh, 'showLoading:', showLoading);
    try {
      console.log('📍 Fetching competitor landscape data with correct component_name');
      if (showLoading) {
        setIsMarketSizeLoading(true);
      }
      setMarketSizeError(null);

      const payload = {
        user_id: "brewra",
        component_name: "Competitor Landscape",
        refresh: refresh,
        force_refresh: false,
        cache_bypass: false,
        bypass_all_cache: false,
        request_timestamp: Date.now(),
        request_id: Math.random().toString(36).substr(2, 6),
        data: {
          company: "OrbiSelf",
          product: "Convoic.AI", 
          target_market: "Indian college students (Tier 2 & 3)",
          region: "India",
          timestamp: Date.now(),
          force_new_data: false
        }
      };

      console.log('📤 Sending Competitor API request with payload:', payload);

      const response = await fetch('https://backend-11kr.onrender.com/market-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📨 Competitor API response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Competitor API result:', result);

      if (result.status === 'success' && result.data) {
        const apiData = result.data;
        console.log('🎯 Processing API data for Competitor Landscape:', apiData);

        // Check timestamp comparison 
        const currentTimestamp = competitorData.timestamp || null;
        const newTimestamp = apiData.timestamp;
        
        if (!currentTimestamp || isTimestampNewer(newTimestamp, currentTimestamp) || refresh) {
          console.log('✅ New Competitor data is newer OR forced refresh, updating UI');
          console.log('🔄 Competitor - NEW timestamp:', newTimestamp);
          console.log('🔄 Competitor - CURRENT timestamp:', currentTimestamp);
          console.log('🔄 Force refresh:', refresh);
          
          // Update competitor data with API response
          const updatedData = {
            ...competitorData,
            executiveSummary: apiData.executiveSummary || competitorData.executiveSummary,
            topPlayerShare: apiData.topPlayerShare || competitorData.topPlayerShare,
            emergingPlayers: apiData.emergingPlayers || competitorData.emergingPlayers,
            fundingNews: apiData.fundingNews || competitorData.fundingNews,
            timestamp: toUTCTimestamp(newTimestamp)
          };
          
          setCompetitorData(updatedData);
          console.log('✅ Competitor Landscape data updated successfully');
        } else {
          console.log('ℹ️ Current Competitor data is up to date');
        }
      }
    } catch (error) {
      console.error('❌ Error fetching Competitor data:', error);
      setMarketSizeError('Failed to load competitor data');
    } finally {
      if (showLoading) {
        setIsMarketSizeLoading(false);
      }
    }
  };

  // Fetch Regulatory Compliance data using backend API with correct component_name
  const fetchRegulatoryComplianceData = async (refresh = false, showLoading = true) => {
    console.log('🚀 Starting fetchRegulatoryComplianceData with refresh:', refresh, 'showLoading:', showLoading);
    try {
      console.log('📍 Fetching regulatory compliance data with correct component_name');
      if (showLoading) {
        setIsMarketSizeLoading(true);
      }
      setMarketSizeError(null);

      const payload = {
        user_id: "brewra",
        component_name: "Regulatory & Compliance Highlights", 
        refresh: refresh,
        force_refresh: false,
        cache_bypass: false,
        bypass_all_cache: false,
        request_timestamp: Date.now(),
        request_id: Math.random().toString(36).substr(2, 6),
        data: {
          company: "OrbiSelf",
          product: "Convoic.AI", 
          target_market: "Indian college students (Tier 2 & 3)",
          region: "India",
          timestamp: Date.now(),
          force_new_data: false
        }
      };

      console.log('📤 Sending Regulatory API request with payload:', payload);

      const response = await fetch('https://backend-11kr.onrender.com/market-research', {
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
      console.log('📊 Regulatory API result:', result);

      if (result.status === 'success' && result.data) {
        const apiData = result.data;
        console.log('🎯 Processing API data for Regulatory Compliance:', apiData);

        // Check timestamp comparison 
        const currentTimestamp = regulatoryData.timestamp || null;
        const newTimestamp = apiData.timestamp;
        
        if (!currentTimestamp || isTimestampNewer(newTimestamp, currentTimestamp) || refresh) {
          console.log('✅ New Regulatory data is newer OR forced refresh, updating UI');
          console.log('🔄 Regulatory - NEW timestamp:', newTimestamp);
          console.log('🔄 Regulatory - CURRENT timestamp:', currentTimestamp);
          console.log('🔄 Force refresh:', refresh);
          
          // Update regulatory data with API response
          const updatedData = {
            ...regulatoryData,
            executiveSummary: apiData.executiveSummary || regulatoryData.executiveSummary,
            euAiActDeadline: apiData.euAiActDeadline || regulatoryData.euAiActDeadline,
            gdprCompliance: apiData.gdprCompliance || regulatoryData.gdprCompliance,
            potentialFines: apiData.potentialFines || regulatoryData.potentialFines,
            dataLocalization: apiData.dataLocalization || regulatoryData.dataLocalization,
            timestamp: toUTCTimestamp(newTimestamp)
          };
          
          setRegulatoryData(updatedData);
          console.log('✅ Regulatory Compliance data updated successfully');
        } else {
          console.log('ℹ️ Current Regulatory data is up to date');
        }
      }
    } catch (error) {
      console.error('❌ Error fetching Regulatory data:', error);
      setMarketSizeError('Failed to load regulatory compliance data');
    } finally {
      if (showLoading) {
        setIsMarketSizeLoading(false);
      }
    }
  };

  // Refresh all components data from backend API
  const refreshAllComponentsData = async () => {
    console.log('🔄 Refreshing ALL component data from backend...');
    
    try {
      // Fetch fresh data for all 5 components with refresh=true
      await Promise.all([
        fetchMarketSizeData(true, true),        // Market Size & Opportunity
        fetchIndustryTrendsData(true, true),    // Industry Trends  
        fetchMarketEntryData(true, true),       // Market Entry & Growth Strategy
        fetchCompetitorData(true, true),        // Competitor Landscape
        fetchRegulatoryComplianceData(true, true) // Regulatory Compliance
      ]);
      
      console.log('✅ All component data refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing component data:', error);
    }
  };

  // Initial data fetch and synchronization - Fetch ALL components on initial load
  useEffect(() => {
    console.log('🔥 Setting up initial data load and sync for ALL components');
    
    // Always fetch fresh data for all components on mount
    refreshAllComponentsData();
  }, []);

  // Listen for company profile updates and trigger background refresh
  useEffect(() => {
    const handleCompanyProfileUpdate = () => {
      console.log('Company profile updated, triggering Scout refresh...');
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
    if (isShowingHistoricalData) {
      // If showing historical data, return to current data
      returnToCurrentData();
    } else {
      // If showing current data, refresh it
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
    if (!isMarketIntelligenceEditing) {
      // Capture original data when starting to edit
      setMarketIntelligenceOriginalData({ ...marketIntelligenceData });
      console.log('💾 Captured original data for editing:', marketIntelligenceData);
    }
    setIsMarketIntelligenceEditing(!isMarketIntelligenceEditing);
  };

  // Market Size Scout icon click handler
  const handleMarketSizeScoutClick = (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => {
    console.log('Market Size Scout clicked with context:', context, 'hasEdits:', hasEdits, 'customMessage:', customMessage);
    
    // Close all other scout chats first
    setShowIndustryTrendsScoutChat(false);
    setShowCompetitorScoutChat(false);
    setShowRegulatoryScoutChat(false);
    setShowMarketEntryScoutChat(false);
    setIsChatOpen(false);
    
    // Set up state based on the context
    if (customMessage) {
      // For deletion scenarios, use custom message
      setMarketSizeCustomMessage(customMessage);
      setMarketSizeHasEdits(true);
    } else {
      // For normal bot icon clicks, reset states
      setMarketSizeCustomMessage(undefined);
      setMarketSizeHasEdits(false);
      setMarketSizeLastEditedField('');
    }
    
    setTimeout(() => {
      setShowMarketSizeScoutChat(true);
    }, 100);
  };

  // Industry Trends Scout icon click handler  
  const handleIndustryTrendsScoutClick = (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => {
    console.log('Industry Trends Scout clicked with context:', context, 'hasEdits:', hasEdits, 'customMessage:', customMessage);
    
    // Close all other scout chats first
    setShowMarketSizeScoutChat(false);
    setShowCompetitorScoutChat(false);
    setShowRegulatoryScoutChat(false);
    setShowMarketEntryScoutChat(false);
    setIsChatOpen(false);
    
    // Set up state based on the context
    if (customMessage) {
      // For deletion scenarios, use custom message
      setIndustryTrendsCustomMessage(customMessage);
      setIndustryTrendsHasEdits(true);
    } else {
      // For normal bot icon clicks, reset states
      setIndustryTrendsCustomMessage(undefined);
      setIndustryTrendsHasEdits(false);
      setIndustryTrendsLastEditedField('');
    }
    
    setTimeout(() => {
      setShowIndustryTrendsScoutChat(true);
    }, 100);
  };

  // Competitor Landscape Scout icon click handler  
  const handleCompetitorScoutClick = (context?: 'market-size' | 'industry-trends' | 'competitor-landscape', hasEdits?: boolean, customMessage?: string) => {
    console.log('Competitor Scout clicked with context:', context, 'hasEdits:', hasEdits, 'customMessage:', customMessage);
    
    // Close all other scout chats first
    setShowMarketSizeScoutChat(false);
    setShowIndustryTrendsScoutChat(false);
    setShowRegulatoryScoutChat(false);
    setShowMarketEntryScoutChat(false);
    setIsChatOpen(false);
    
    // Set up state based on the context
    if (customMessage) {
      // For deletion scenarios, use custom message
      setCompetitorCustomMessage(customMessage);
      setCompetitorHasEdits(true);
    } else {
      // For normal bot icon clicks, reset states
      setCompetitorCustomMessage(undefined);
      setCompetitorHasEdits(false);
    }
    
    setTimeout(() => {
      setShowCompetitorScoutChat(true);
    }, 100);
  };

  const handleMarketIntelligenceDeleteSection = (sectionId: string) => {
    const newDeletedSections = new Set(deletedSections);
    newDeletedSections.add(sectionId);
    setDeletedSections(newDeletedSections);
  };

  const handleMarketIntelligenceSaveChanges = () => {
    console.log('💾 Saving Market Intelligence changes...');
    console.log('📊 Current marketIntelligenceData:', marketIntelligenceData);
    
    // Update timestamp and exit editing mode - data is already updated via onChange handlers
    const updatedData = {
      ...marketIntelligenceData,
      timestamp: new Date().toISOString()
    };
    
    setMarketIntelligenceData(updatedData);
    setIsMarketIntelligenceEditing(false);
    setHasEdits(true);
    
    // Force contextual message state for Market Size Scout
    setMarketSizeHasEdits(true);
    setMarketSizeLastEditedField('Market Intelligence');

    // Capture original and modified data for the /ask API
    const originalJson = {
      marketName: "Market Intelligence Analysis",
      executiveSummary: marketIntelligenceOriginalData?.executiveSummary || "Original executive summary",
      tam: marketIntelligenceOriginalData?.tamValue || "$0B",
      sam: marketIntelligenceOriginalData?.samValue || "$0B", 
      apacGrowthRate: marketIntelligenceOriginalData?.apacGrowthRate || "0%",
      strategicRecommendations: marketIntelligenceOriginalData?.strategicRecommendations || [],
      marketEntry: marketIntelligenceOriginalData?.marketEntry || "Original market entry strategy",
      marketDrivers: marketIntelligenceOriginalData?.marketDrivers || [],
      timestamp: new Date().toISOString()
    };

    const modifiedJson = {
      marketName: "Market Intelligence Analysis",
      executiveSummary: updatedData.executiveSummary,
      tam: updatedData.tamValue,
      sam: updatedData.samValue,
      apacGrowthRate: updatedData.apacGrowthRate,
      strategicRecommendations: updatedData.strategicRecommendations,
      marketEntry: updatedData.marketEntry,
      marketDrivers: updatedData.marketDrivers,
      timestamp: updatedData.timestamp
    };

    // Log the JSON data to console
    console.log('📄 ORIGINAL JSON:', JSON.stringify(originalJson, null, 2));
    console.log('📄 MODIFIED JSON:', JSON.stringify(modifiedJson, null, 2));

    // Store the JSON data for the chat interface
    setMarketSizeOriginalData(originalJson);
    setMarketSizeModifiedData(modifiedJson);

    // Create a new edit record
    const newEdit: EditRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: 'John Doe',
      summary: 'Updated market analysis with JSON data captured',
      field: 'Market Intelligence',
      oldValue: JSON.stringify(originalJson),
      newValue: JSON.stringify(modifiedJson),
    };

    // Add the new edit record to the edit history
    setEditHistory(prevHistory => [...prevHistory, newEdit]);
    
    console.log('✅ Market Intelligence data saved successfully');
    console.log('🔄 Updated frontend state:', updatedData);
    
    // Automatically open Market Size Scout chat panel with contextual message
    setTimeout(() => {
      setShowMarketSizeScoutChat(true);
      setIsChatOpen(true);
      console.log('🤖 Scout chat panel opened');
    }, 100);
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
    if (!isIndustryTrendsEditing) {
      // Capture original state when starting to edit
      const originalJson = {
        executiveSummary: industryTrendsData.executiveSummary,
        aiAdoption: industryTrendsData.aiAdoption,
        cloudMigration: industryTrendsData.cloudMigration,
        regulatory: industryTrendsData.regulatory,
        trendSnapshots: industryTrendsData.trendSnapshots,
        recommendations: industryTrendsData.recommendations,
        risks: industryTrendsData.risks,
        timestamp: industryTrendsData.timestamp
      };
      setIndustryTrendsOriginalData(originalJson);
    }
    setIsIndustryTrendsEditing(!isIndustryTrendsEditing);
  };

  const handleIndustryTrendsSaveChanges = () => {
    console.log('💾 Saving Industry Trends changes...');
    console.log('📊 Current industryTrendsData:', industryTrendsData);
    
    // Exit editing mode
    setIsIndustryTrendsEditing(false);
    
    // Update timestamp - data is already updated via onChange handlers
    const updatedData = {
      ...industryTrendsData,
      timestamp: new Date().toISOString()
    };
    setIndustryTrendsData(updatedData);
    
    // Prepare modified JSON data (original was captured on edit start)
    const modifiedJson = {
      executiveSummary: updatedData.executiveSummary,
      aiAdoption: updatedData.aiAdoption,
      cloudMigration: updatedData.cloudMigration,
      regulatory: updatedData.regulatory,
      trendSnapshots: updatedData.trendSnapshots,
      recommendations: updatedData.recommendations,
      risks: updatedData.risks,
      timestamp: updatedData.timestamp
    };

    // Log the JSON data to console
    console.log('📄 ORIGINAL JSON:', JSON.stringify(industryTrendsOriginalData, null, 2));
    console.log('📄 MODIFIED JSON:', JSON.stringify(modifiedJson, null, 2));

    // Store the modified JSON data for the chat interface
    setIndustryTrendsModifiedData(modifiedJson);

    // Force contextual message state for Industry Trends Scout
    setIndustryTrendsHasEdits(true);
    setIndustryTrendsLastEditedField('Industry Trends');

    // Create a new edit record
    const newEdit: EditRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: 'John Doe',
      summary: 'Updated industry trends data with JSON data captured',
      field: 'Industry Trends',
      oldValue: JSON.stringify(industryTrendsOriginalData),
      newValue: JSON.stringify(modifiedJson)
    };

    // Add the new edit record to the industry trends edit history
    setIndustryTrendsEditHistory(prevHistory => [...prevHistory, newEdit]);
    
    console.log('✅ Industry Trends data saved successfully');
    console.log('🔄 Updated frontend state:', updatedData);
    
    // Automatically open Industry Trends Scout chat panel with contextual message
    setTimeout(() => {
      setShowIndustryTrendsScoutChat(true);
      setIsChatOpen(true);
      console.log('🤖 Industry Trends Scout chat panel opened');
    }, 100);
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
    setIndustryTrendsData(prev => ({ ...prev, executiveSummary: value }));
    setIndustryTrendsLastEditedField('executiveSummary');
  };

  // Competitor Landscape handlers - Add these new handlers
  const handleCompetitorToggleEdit = () => {
    console.log('🔄 Competitor Toggle Edit - Current editing state:', isCompetitorEditing);
    console.log('🔄 Current competitor data before toggle:', competitorData);
    
    if (!isCompetitorEditing) {
      // Capture original state when starting to edit
      const originalJson = {
        executiveSummary: competitorData.executiveSummary,
        topPlayerShare: competitorData.topPlayerShare,
        emergingPlayers: competitorData.emergingPlayers,
        fundingNews: competitorData.fundingNews,
        timestamp: competitorData.timestamp
      };
      console.log('📦 Capturing original data:', originalJson);
      setCompetitorOriginalData(originalJson);
    }
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
      // Update the corresponding trendSnapshot metric
      const updatedSnapshots = prev.trendSnapshots.map(snapshot => 
        snapshot.title === "AI Integration" 
          ? { ...snapshot, metric: `${value}% adoption rate` }
          : snapshot
      );
      return { 
        ...prev, 
        aiAdoption: value,
        trendSnapshots: updatedSnapshots
      };
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
      // Update the corresponding trendSnapshot metric
      const updatedSnapshots = prev.trendSnapshots.map(snapshot => 
        snapshot.title === "Cloud Migration" 
          ? { ...snapshot, metric: `${value}% increase YoY` }
          : snapshot
      );
      return { 
        ...prev, 
        cloudMigration: value,
        trendSnapshots: updatedSnapshots
      };
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
      // Update the corresponding trendSnapshot metric
      const updatedSnapshots = prev.trendSnapshots.map(snapshot => 
        snapshot.title === "Regulatory Impact" 
          ? { ...snapshot, metric: `${value} new policies` }
          : snapshot
      );
      return { 
        ...prev, 
        regulatory: value,
        trendSnapshots: updatedSnapshots
      };
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
    setIndustryTrendsData(prev => ({ ...prev, trendSnapshots: snapshots }));
    setIndustryTrendsLastEditedField('trendSnapshots');
  };

  const handleCompetitorSaveChanges = () => {
    console.log('💾 Saving Competitor Analysis changes...');
    console.log('📊 Current competitorData:', competitorData);
    
    // Exit editing mode
    setIsCompetitorEditing(false);
    
    // Update timestamp - data is already updated via onChange handlers
    const updatedData = {
      ...competitorData,
      timestamp: new Date().toISOString()
    };
    setCompetitorData(updatedData);
    
    // Prepare modified JSON data (original was captured on edit start)
    const modifiedJson = {
      executiveSummary: updatedData.executiveSummary,
      topPlayerShare: updatedData.topPlayerShare,
      emergingPlayers: updatedData.emergingPlayers,
      fundingNews: updatedData.fundingNews,
      timestamp: updatedData.timestamp
    };

    // Log the JSON data to console
    console.log('📊 Original data state variable:', competitorOriginalData);
    console.log('📊 Current competitor data:', competitorData);
    console.log('📄 ORIGINAL JSON:', JSON.stringify(competitorOriginalData, null, 2));
    console.log('📄 MODIFIED JSON:', JSON.stringify(modifiedJson, null, 2));

    // Store the modified JSON data for the chat interface
    setCompetitorModifiedData(modifiedJson);

    // Force contextual message state for Competitor Landscape Scout
    setCompetitorHasEdits(true);

    // Create a new edit record
    const newEdit: EditRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: 'John Doe',
      summary: 'Updated competitor landscape data with JSON data captured',
      field: 'Competitor Landscape',
      oldValue: JSON.stringify(competitorOriginalData),
      newValue: JSON.stringify(modifiedJson)
    };
    
    setCompetitorEditHistory(prev => [newEdit, ...prev]);
    setHasEdits(true);
    
    console.log('✅ Competitor Analysis data saved successfully');
    console.log('🔄 Updated frontend state:', updatedData);
    
    // Automatically open Competitor Landscape Scout chat panel with contextual message
    setTimeout(() => {
      setShowCompetitorScoutChat(true);
      setIsChatOpen(true);
      console.log('🤖 Competitor Scout chat panel opened');
    }, 100);
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

  const handleCompetitorRestoreSection = (sectionId: string) => {
    setCompetitorDeletedSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionId);
      return newSet;
    });
  };

  // Market Size restore handler
  const handleMarketSizeRestoreSection = (sectionId: string) => {
    setMarketSizeDeletedSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionId);
      return newSet;
    });
  };

  // Industry Trends restore handler
  const handleIndustryTrendsRestoreSection = (sectionId: string) => {
    setIndustryTrendsDeletedSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionId);
      return newSet;
    });
  };

  // Regulatory Compliance restore handler
  const handleRegulatoryRestoreSection = (sectionId: string) => {
    setRegulatoryDeletedSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionId);
      return newSet;
    });
  };

  // Market Entry restore handler
  const handleMarketEntryRestoreSection = (sectionId: string) => {
    setMarketEntryDeletedSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionId);
      return newSet;
    });
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
      const newData = { ...prev, executiveSummary: value };
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
      const newData = { ...prev, tamValue: value };
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
      const newData = { ...prev, samValue: value };
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
      const newData = { ...prev, apacGrowthRate: value };
      saveMarketIntelligenceToLocalStorage(newData);
      return newData;
    });
  };

  // Regulatory Compliance handlers - Add these new handlers
  const handleRegulatoryToggleEdit = () => {
    console.log('🎯 TOGGLE EDIT - Current isRegulatoryEditing:', isRegulatoryEditing);
    if (!isRegulatoryEditing) {
      // Capture original data when starting to edit - use the actual regulatory compliance data
      const currentRegulatoryData = marketIntelligenceData?.regulatory_compliance;
      console.log('📸 CAPTURING ORIGINAL DATA SNAPSHOT (regulatory_compliance):', currentRegulatoryData);
      setRegulatoryOriginalDataSnapshot(currentRegulatoryData ? {...currentRegulatoryData} : null);
    }
    setIsRegulatoryEditing(!isRegulatoryEditing);
  };

  const handleRegulatorySaveChanges = () => {
    console.log('🔥 SAVE FUNCTION CALLED - handleRegulatorySaveChanges');
    console.log('💾 Saving Regulatory Compliance changes...');
    console.log('📊 Current regulatoryData:', regulatoryData);
    console.log('📸 Captured original snapshot:', regulatoryOriginalDataSnapshot);
    
    // Exit editing mode FIRST (following competitor pattern)
    setIsRegulatoryEditing(false);
    
    // Update timestamp - data is already updated via onChange handlers
    const updatedData = {
      ...regulatoryData,
      timestamp: new Date().toISOString()
    };
    setRegulatoryData(updatedData);
    
    // Prepare modified JSON data (current state with new timestamp)
    const modifiedJson = updatedData;
    
    // Log the original and modified JSON for comparison
    console.log('📄 ORIGINAL JSON:', JSON.stringify(regulatoryOriginalDataSnapshot, null, 2));
    console.log('📄 MODIFIED JSON:', JSON.stringify(modifiedJson, null, 2));
    
    // Store the modified JSON data for the chat interface
    setRegulatoryModifiedData(modifiedJson);
    
    // Force contextual message state for Regulatory Scout
    setRegulatoryHasEdits(true);
    
    // Create a new edit record
    const newEdit: EditRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: 'John Doe',
      summary: 'Updated regulatory compliance data with JSON data captured',
      field: 'Regulatory Compliance',
      oldValue: JSON.stringify(regulatoryOriginalDataSnapshot),
      newValue: JSON.stringify(modifiedJson)
    };
    
    // Add the new edit record to the regulatory edit history
    setRegulatoryEditHistory(prevHistory => [...prevHistory, newEdit]);
    
    // Note: Regulatory data is stored in component state, similar to competitor data
    
    console.log('✅ Regulatory Compliance data saved successfully');
    console.log('🔄 Updated frontend state:', updatedData);
    
    // Automatically open Regulatory Scout chat panel with contextual message (following competitor pattern)
    setTimeout(() => {
      setIsRegulatoryPostSave(true);
      setShowRegulatoryScoutChat(true);
      setIsChatOpen(true);
      console.log('🤖 Regulatory Scout chat panel opened');
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

  const handleRegulatoryScoutClick = (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance', hasEdits?: boolean, customMessage?: string) => {
    console.log('Regulatory scout clicked with context:', context, 'hasEdits:', hasEdits, 'customMessage:', customMessage);
    
    // Close all other scout chats first to prevent state overlap
    setShowMarketSizeScoutChat(false);
    setShowIndustryTrendsScoutChat(false);
    setShowCompetitorScoutChat(false);
    setIsChatOpen(false);
    
    // Reset any previous chat states to ensure clean start
    setTimeout(() => {
      setIsRegulatoryPostSave(false); // Reset post-save state when manually clicking scout
      setRegulatoryCustomMessage(customMessage); // Set custom message for deletion scenarios
      setShowRegulatoryScoutChat(true);
    }, 100);
  };


  // Edit history handlers
  const handleEditHistoryOpen = () => {
    setEditHistoryContext('Market Size & Opportunity');
    setIsEditHistoryOpen(true);
  };

  // Market Entry handlers
  const handleMarketEntryToggleEdit = () => {
    if (!isMarketEntryEditing) {
      // Capture original data when starting to edit
      console.log('🎯 Starting Market Entry edit - capturing original data:', marketEntryData);
      console.log('🎯 Current timeToMarket before edit:', marketEntryData.timeToMarket);
      const originalData = {
        executiveSummary: marketEntryData.executiveSummary,
        entryBarriers: marketEntryData.entryBarriers,
        recommendedChannel: marketEntryData.recommendedChannel,
        timeToMarket: marketEntryData.timeToMarket,
        topBarrier: marketEntryData.topBarrier,
        competitiveDifferentiation: marketEntryData.competitiveDifferentiation,
        strategicRecommendations: marketEntryData.strategicRecommendations,
        riskAssessment: marketEntryData.riskAssessment,
        timestamp: marketEntryData.timestamp
      };
      console.log('🎯 Captured original data:', originalData);
      setMarketEntryOriginalData(originalData);
    }
    setIsMarketEntryEditing(!isMarketEntryEditing);
  };
  const handleMarketEntryExpandToggle = (expanded: boolean) => setMarketEntryExpanded(expanded);
  const handleMarketEntrySaveChanges = () => {
    console.log('💾 Saving Market Entry changes...');
    console.log('📊 Current marketEntryData:', marketEntryData);
    console.log('📊 Market Entry Original Data for logging:', marketEntryOriginalData);
    
    // Exit editing mode
    setIsMarketEntryEditing(false);
    setMarketEntryHasEdits(false);
    
    // Update timestamp - data is already updated via onChange handlers
    const updatedData = {
      ...marketEntryData,
      timestamp: new Date().toISOString()
    };
    setMarketEntryData(updatedData);
    
    // Prepare original and modified JSON data for console logging and /ask API
    const originalJson = marketEntryOriginalData || {
      executiveSummary: marketEntryData.executiveSummary,
      entryBarriers: marketEntryData.entryBarriers,
      recommendedChannel: marketEntryData.recommendedChannel,
      timeToMarket: marketEntryData.timeToMarket,
      topBarrier: marketEntryData.topBarrier,
      competitiveDifferentiation: marketEntryData.competitiveDifferentiation,
      strategicRecommendations: marketEntryData.strategicRecommendations,
      riskAssessment: marketEntryData.riskAssessment,
      timestamp: marketEntryData.timestamp
    };

    const modifiedJson = {
      executiveSummary: updatedData.executiveSummary,
      entryBarriers: updatedData.entryBarriers,
      recommendedChannel: updatedData.recommendedChannel,
      timeToMarket: updatedData.timeToMarket,
      topBarrier: updatedData.topBarrier,
      competitiveDifferentiation: updatedData.competitiveDifferentiation,
      strategicRecommendations: updatedData.strategicRecommendations,
      riskAssessment: updatedData.riskAssessment,
      timestamp: updatedData.timestamp
    };

    // Log the JSON data to console
    console.log('📄 ORIGINAL JSON:', JSON.stringify(originalJson, null, 2));
    console.log('📄 MODIFIED JSON:', JSON.stringify(modifiedJson, null, 2));

    // Store the JSON data for the chat interface
    setMarketEntryOriginalData(originalJson);
    setMarketEntryModifiedData(modifiedJson);
    
    console.log('✅ Market Entry data saved successfully');
    console.log('🔄 Updated frontend state:', updatedData);
    
    // Set post-save state and trigger Scout chat
    setIsMarketEntryPostSave(true);
    setTimeout(() => {
      setShowMarketEntryScoutChat(true);
      setIsChatOpen(true);
      console.log('🤖 Market Entry Scout chat panel opened');
    }, 100);
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
    setMarketEntryData(prev => ({ ...prev, executiveSummary: value }));
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
    setMarketEntryData(prev => ({ ...prev, entryBarriers: barriers }));
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
    setMarketEntryData(prev => ({ ...prev, recommendedChannel: value }));
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
    setMarketEntryData(prev => ({ ...prev, timeToMarket: value }));
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
    setMarketEntryData(prev => ({ ...prev, topBarrier: value }));
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
    setMarketEntryData(prev => ({ ...prev, competitiveDifferentiation: differentiation }));
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


  const handleMarketEntryScoutClick = (context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance' | 'market-entry', hasEdits?: boolean, customMessage?: string) => {
    console.log('Market Entry scout clicked with context:', context);
    
    // Close all other scout chats first
    setShowMarketSizeScoutChat(false);
    setShowIndustryTrendsScoutChat(false);
    setShowCompetitorScoutChat(false);
    setShowRegulatoryScoutChat(false);
    setIsChatOpen(false);
    
    // Reset post-save state when manually clicking scout (not triggered by save)
    setTimeout(() => {
      if (!hasEdits) {
        setIsMarketEntryPostSave(false); // Reset post-save state when manually clicking scout
      }
      
      // Set custom message if provided
      if (customMessage) {
        setMarketEntryCustomMessage(customMessage);
      } else {
        setMarketEntryCustomMessage(undefined); // Clear any previous custom messages
      }
      
      // Open Market Entry scout chat
      setShowMarketEntryScoutChat(true);
    }, 100);
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

  // Show ScoutLoadingAnimation when initially loading and no data exists
  if (isInitialLoading && !marketData) {
    console.log('Showing ScoutLoadingAnimation - no data exists anywhere');
    return (
      <Layout>
        <div className="flex flex-col h-full">
          <ScoutLoadingAnimation />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full relative">
        {/* Fixed header section */}
        <div className="sticky top-0 bg-white z-20 pb-2">
          <div className="animate-fade-in">
            {/* Scout Loading Animation - Show at top when refreshing with existing data */}
            {(isRefreshing || isInitialLoading) && (
              <div className="mb-4">
                <ScoutLoadingAnimation />
              </div>
            )}
            
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
            
            {/* Error alert for any operation failures - only show if we have data to fall back to */}
            {error && marketData && !isRefreshing && !isInitialLoading && !isShowingHistoricalData && (
              <Alert className="mb-4 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  Operation failed: {error}. Showing previous data.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Cache indicator when showing cached data and not loading */}
            {marketData && cachedMarketData === marketData && !isRefreshing && !isInitialLoading && !isShowingHistoricalData && cacheTimestamp && (
              <Alert className="mb-4 border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  {isCacheValid() 
                    ? `Showing cached data from ${new Date(cacheTimestamp).toLocaleTimeString()}`
                    : `Showing expired cached data from ${new Date(cacheTimestamp).toLocaleTimeString()}`
                  }
                </AlertDescription>
              </Alert>
            )}
            
            {/* Settings, History and Refresh buttons aligned to the right */}
            <div className="flex items-center justify-end gap-2 mb-4">
              <DataHistoryDialog onReportSelected={handleHistoricalReportSelected} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="flex items-center gap-2"
                disabled={isRefreshing || isInitialLoading}
              >
                <RefreshCw className={`h-4 w-4 ${(isRefreshing || isInitialLoading) ? 'animate-spin' : ''}`} />
                {isShowingHistoricalData 
                  ? 'Return to Current' 
                  : (isRefreshing || isInitialLoading) ? 'Updating...' : 'Refresh'
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
            </div>
            
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
          {/* Show content with subtle overlay when refreshing */}
          <div className={`transition-opacity duration-300 ${(isRefreshing || isInitialLoading) && marketData ? 'opacity-70' : 'opacity-100'} relative`}>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-0">
              <TabsContent value="intelligence" className="mt-0">
                {marketData ? (
                  <div className="space-y-6">
                    {/* Display deployment details if Scout has been deployed */}
                    {scoutDeploymentData && (
                      <ScoutDeploymentDetails deploymentData={scoutDeploymentData} />
                    )}
                    
                    {/* Market Intelligence Tab with embedded scout chats */}
                    <MarketIntelligenceTab
                      isEditing={isMarketIntelligenceEditing}
                      isSplitView={false}
                      isExpanded={isMarketIntelligenceExpanded}
                      hasEdits={hasEdits}
                      deletedSections={deletedSections}
                      editHistory={editHistory}
                       executiveSummary={marketIntelligenceData.executiveSummary}
                       tamValue={marketIntelligenceData.tamValue}
                       samValue={marketIntelligenceData.samValue}
                       apacGrowthRate={marketIntelligenceData.apacGrowthRate}
                       strategicRecommendations={marketIntelligenceData.strategicRecommendations}
                       marketEntry={marketIntelligenceData.marketEntry}
                       marketDrivers={marketIntelligenceData.marketDrivers}
                        marketSizeBySegment={(() => {
                         console.log('🔍 MarketResearch - passing marketSizeBySegment:', marketData?.marketSizeBySegment || marketIntelligenceData.marketSizeBySegment);
                         return marketData?.marketSizeBySegment || marketIntelligenceData.marketSizeBySegment;
                       })()}
                        growthProjections={(() => {
                         console.log('🔍 MarketResearch - passing growthProjections:', marketData?.growthProjections || marketIntelligenceData.growthProjections);
                         return marketData?.growthProjections || marketIntelligenceData.growthProjections;
                       })()}
                       // Market Size specific props
                       marketSizeDeletedSections={marketSizeDeletedSections}
                       isMarketSizeLoading={isMarketSizeLoading}
                       marketSizeError={marketSizeError}
                       onMarketSizeRefresh={() => fetchMarketSizeData(true)}
                      // Industry Trends props
                      isIndustryTrendsEditing={isIndustryTrendsEditing}
                      industryTrendsExpanded={industryTrendsExpanded}
                      industryTrendsHasEdits={industryTrendsHasEdits}
                      industryTrendsDeletedSections={industryTrendsDeletedSections}
                      industryTrendsEditHistory={industryTrendsEditHistory}
                      industryTrendsExecutiveSummary={industryTrendsData.executiveSummary}
                      industryTrendsAiAdoption={industryTrendsData.aiAdoption}
                      industryTrendsCloudMigration={industryTrendsData.cloudMigration}
                      industryTrendsRegulatory={industryTrendsData.regulatory}
                      industryTrendSnapshots={industryTrendsData.trendSnapshots}
                      industryTrendsRecommendations={industryTrendsData.recommendations}
                      industryTrendsRisks={industryTrendsData.risks}
                      industryTrendsLastEditedField={industryTrendsLastEditedField}
                      // Competitor Landscape props
                      isCompetitorEditing={isCompetitorEditing}
                      competitorExpanded={competitorExpanded}
                      competitorHasEdits={competitorHasEdits}
                      competitorDeletedSections={competitorDeletedSections}
                      competitorEditHistory={competitorEditHistory}
                      competitorExecutiveSummary={competitorData.executiveSummary}
                      competitorTopPlayerShare={competitorData.topPlayerShare}
                      competitorEmergingPlayers={competitorData.emergingPlayers}
                      competitorFundingNews={competitorData.fundingNews}
                      // Regulatory Compliance props
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
                        onMarketEntryRefresh={() => fetchMarketEntryData(true)}
                        // JSON data for /ask API integration
                        industryTrendsOriginalData={industryTrendsOriginalData}
                        industryTrendsModifiedData={industryTrendsModifiedData}
                        competitorOriginalData={competitorOriginalData}
                        competitorModifiedData={competitorModifiedData}
                        regulatoryOriginalData={regulatoryOriginalData}
                        regulatoryModifiedData={regulatoryModifiedData}
                        marketEntryOriginalData={marketEntryOriginalData}
                        marketEntryModifiedData={marketEntryModifiedData}
                        onToggleEdit={handleMarketIntelligenceToggleEdit}
                      onMarketSizeScoutIconClick={handleMarketSizeScoutClick}
                      onIndustryTrendsScoutIconClick={handleIndustryTrendsScoutClick}
                      onCompetitorScoutIconClick={handleCompetitorScoutClick}
                      onEditHistoryOpen={handleEditHistoryOpen}
                      onDeleteSection={handleMarketIntelligenceDeleteSection}
                       onMarketSizeDeleteSection={handleMarketSizeDeleteSection}
                       onMarketSizeRestoreSection={handleMarketSizeRestoreSection}
                       onSaveChanges={handleMarketIntelligenceSaveChanges}
                      onCancelEdit={handleMarketIntelligenceCancelEdit}
                      onExpandToggle={handleMarketIntelligenceExpandToggle}
                      onExecutiveSummaryChange={handleMarketIntelligenceExecutiveSummaryChange}
                      onTamValueChange={handleMarketIntelligenceTamValueChange}
                      onSamValueChange={handleMarketIntelligenceSamValueChange}
                      onApacGrowthRateChange={handleMarketIntelligenceApacGrowthRateChange}
                      onStrategicRecommendationsChange={(recommendations) => 
                        setMarketIntelligenceData(prev => {
                          const newData = { ...prev, strategicRecommendations: recommendations };
                          saveMarketIntelligenceToLocalStorage(newData);
                          return newData;
                        })
                      }
                      onMarketEntryChange={(value) => 
                        setMarketIntelligenceData(prev => {
                          const newData = { ...prev, marketEntry: value };
                          saveMarketIntelligenceToLocalStorage(newData);
                          return newData;
                        })
                      }
                      onMarketDriversChange={(drivers) => 
                        setMarketIntelligenceData(prev => {
                          const newData = { ...prev, marketDrivers: drivers };
                          saveMarketIntelligenceToLocalStorage(newData);
                          return newData;
                        })
                      }
                      // Industry Trends handlers
                      onIndustryTrendsToggleEdit={handleIndustryTrendsToggleEdit}
                      onIndustryTrendsSaveChanges={handleIndustryTrendsSaveChanges}
                      onIndustryTrendsCancelEdit={handleIndustryTrendsCancelEdit}
                       onIndustryTrendsDeleteSection={handleIndustryTrendsDeleteSection}
                       onIndustryTrendsRestoreSection={handleIndustryTrendsRestoreSection}
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
                      onCompetitorRestoreSection={handleCompetitorRestoreSection}
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
                       onRegulatoryRestoreSection={handleRegulatoryRestoreSection}
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
                      onMarketEntryCancelEdit={handleMarketEntryCancelEdit}
                       onMarketEntryDeleteSection={handleMarketEntryDeleteSection}
                       onMarketEntryRestoreSection={handleMarketEntryRestoreSection}
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
                       marketSizeOriginalData={marketSizeOriginalData}
                       marketSizeModifiedData={marketSizeModifiedData}
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
                <ConsumerTrends 
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
};

export default MarketResearch;
