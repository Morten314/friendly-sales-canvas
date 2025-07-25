import { useState, useEffect } from "react";
console.log('🚨🚨🚨 MARKETRESEARCH FILE IS DEFINITELY LOADING 🚨🚨🚨');
console.log('📁 MarketResearch.tsx file is loading!');
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
import { CompetitorAnalysis } from "@/components/market-research/CompetitorAnalysis";
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
  console.log('🔥 MarketResearch component is mounting!');
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
    console.log('Initial marketData state - cached data exists:', !!cached);
    return cached;
  });
  
  // Show loading when either initially loading OR refreshing
  const [isInitialLoading, setIsInitialLoading] = useState(() => {
    const hasData = !!getCachedData();
    console.log('Initial loading state - has cached data:', hasData);
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
        console.log('📦 Loading Market Intelligence data from localStorage:', parsedData);
        // Only return stored data if it has a timestamp (meaning it came from swagger)
        if (parsedData.timestamp) {
          console.log('✅ Found persisted swagger data with timestamp:', parsedData.timestamp);
          return parsedData;
        } else {
          console.log('⚠️ Found localStorage data but no timestamp - this is default data, clearing...');
          localStorage.removeItem('marketIntelligenceData');
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

  // Helper function to save market intelligence data to localStorage
  const saveMarketIntelligenceToLocalStorage = (data: any) => {
    try {
      localStorage.setItem('marketIntelligenceData', JSON.stringify(data));
      console.log('💾 Market Intelligence data saved to localStorage');
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
    dataLocalization: 'Mandatory for customer data'
  });

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
    ]
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
      console.log('Cached data exists:', !!getCachedData());
      
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
      console.log('📊 Market intelligence data:', apiResponse);
      console.log('🔍 DEBUGGING: Raw API response structure:', JSON.stringify(apiResponse, null, 2));
      console.log('🔍 DEBUGGING: Response timestamp or ID:', apiResponse.timestamp || apiResponse.id || apiResponse.created_at || 'NO_TIMESTAMP');
      console.log('🔍 DEBUGGING: Response headers:', [...response.headers.entries()]);
      
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
        setMarketData(transformedData);
        // Save transformed data to localStorage for persistence
        saveMarketIntelligenceToLocalStorage(transformedData);
        console.log('💾 Market data saved to localStorage for persistence');
      
      // Reset historical data flags when fetching current data
      setIsShowingHistoricalData(false);
      setHistoricalDataTimestamp(null);
      
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
      
      // Always ensure we show any available data, even if the fetch failed
      const fallbackData = getCachedData();
      if (fallbackData && !marketData) {
        console.log('Using cached data as fallback after error');
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
      
      console.log('🔄 Refresh button clicked - fetching fresh data from Swagger...');
      
      // Get current UI data timestamp for comparison
      const currentUIData = getInitialMarketIntelligenceData();
      let currentUITimestamp = 0;
      if (currentUIData?.timestamp) {
        // Handle both ISO string and timestamp number formats
        currentUITimestamp = typeof currentUIData.timestamp === 'string' ? 
          new Date(currentUIData.timestamp).getTime() : 
          parseInt(currentUIData.timestamp);
      }
      console.log('📊 Current UI data timestamp:', currentUIData?.timestamp);
      console.log('📊 Current UI data time:', currentUITimestamp ? new Date(currentUITimestamp).toISOString() : 'No timestamp');
      
      // Always fetch fresh data from Swagger API when refresh is clicked  
      console.log('🔄 Fetching fresh data from Swagger API...');
      
      // Force refresh all market intelligence data - they will automatically
      // update the UI if their timestamps are newer than current data
      const [marketSizeResponse, industryTrendsResponse, marketEntryResponse] = await Promise.allSettled([
        fetchMarketSizeData(true, false), // This calls the correct market-research API
        fetchIndustryTrendsData(true, false), // Industry Trends data
        fetchMarketEntryData(true, false), // Market Entry data
      ]);
      
      // Also trigger industry trends refresh to get latest data
      // The IndustryTrendsSection component will handle its own refresh and data updates
      
      console.log('🔄 All API calls completed - checking if any updates were applied');
      
      // Check if we have any fresh data in localStorage after the API calls
      const updatedData = getInitialMarketIntelligenceData();
      if (updatedData && updatedData.timestamp) {
        let updatedTimestamp = 0;
        if (updatedData.timestamp) {
          updatedTimestamp = typeof updatedData.timestamp === 'string' ? 
            new Date(updatedData.timestamp).getTime() : 
            parseInt(updatedData.timestamp);
        }
        
        console.log('🔄 POST-REFRESH TIMESTAMP COMPARISON:');
        console.log('  - Original UI timestamp:', currentUITimestamp, new Date(currentUITimestamp).toISOString());
        console.log('  - Updated data timestamp:', updatedTimestamp, new Date(updatedTimestamp).toISOString());
        
        // If we have newer data, force update the UI states
        if (updatedTimestamp > currentUITimestamp) {
          console.log('✅ Fresh data found after refresh - updating UI states');
          setMarketData(updatedData);
          setMarketIntelligenceData(updatedData);
          cachedMarketData = updatedData;
          cacheTimestamp = updatedTimestamp;
        }
      }
      
      // Market size data is handled by fetchMarketSizeData call above
      console.log('✅ All backend data sources refreshed successfully');
      
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
    console.log('🚀 Starting fetchMarketSizeData with refresh:', refresh, 'showLoading:', showLoading);
    try {
      console.log('📍 Fetching market size data without config dependency');
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

      console.log('📤 Sending API request to:', 'https://backend-11kr.onrender.com/market-research');
      console.log('📦 Market Size Complete Payload:', JSON.stringify(payload, null, 2));
      console.log('📦 Market Size Payload component_name:', payload.component_name);
      console.log('📦 Market Size Payload keys:', Object.keys(payload));
      console.log('📦 Market Size Data keys:', Object.keys(payload.data));

      // Add debugging to track data freshness
      const requestTimestamp = Date.now();
      console.log('⏰ REQUEST TIMESTAMP:', requestTimestamp);
      console.log('🔄 FORCE_REFRESH in payload:', payload.refresh);
      
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
      console.log('📥 Market Size API response:', apiResponse);
      console.log('🔍 API Response structure:', JSON.stringify(apiResponse, null, 2));
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

      // Payload specifically for Industry Trends
      const payload = {
        component_name: "Industry Trends",
        refresh: refresh,
        user_id: "brewra"
      };

      console.log('📤 Sending Industry Trends API request with payload:', payload);

      const response = await fetch('https://swaggerapi.clodura.ai/backend/v1/market-research/generate', {
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

      if (result.status === 'success' && result.data) {
        const apiData = result.data;
        console.log('🎯 Processing API data for Industry Trends:', apiData);

        // Check timestamp comparison with timestampUtils
        const currentTimestamp = industryTrendsData.timestamp || null;
        const newTimestamp = apiData.timestamp;
        
        logTimestampComparison(currentTimestamp, newTimestamp, 'IndustryTrends');
        
        if (!currentTimestamp || isTimestampNewer(newTimestamp, currentTimestamp)) {
          console.log('✅ New Industry Trends data is newer, updating UI');
          
          // Update industry trends data with API response
          const updatedData = {
            ...industryTrendsData,
            executiveSummary: apiData.executiveSummary || industryTrendsData.executiveSummary,
            aiAdoption: apiData.aiAdoption || industryTrendsData.aiAdoption,
            cloudMigration: apiData.cloudMigration || industryTrendsData.cloudMigration,
            regulatory: apiData.regulatory || industryTrendsData.regulatory,
            risks: apiData.risks || industryTrendsData.risks,
            timestamp: toUTCTimestamp(newTimestamp)
          };
          
          setIndustryTrendsData(updatedData);
          console.log('✅ Industry Trends data updated successfully');
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
        
        const shouldUpdate = !currentTimestamp || isTimestampNewer(newTimestamp, currentTimestamp);
        
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

  // Initial data fetch and synchronization
  useEffect(() => {
    console.log('🔥 Setting up initial data load and sync');
    
    // Check if we have persistent data from previous session
    const storedMarketData = localStorage.getItem('marketIntelligenceData');
    if (storedMarketData) {
      try {
        const parsedData = JSON.parse(storedMarketData);
        if (parsedData.timestamp) {
          console.log('📦 Found persistent Market Size data from previous session - preserving it');
          console.log('🔧 Not clearing data - user will see last Swagger data until new data arrives');
          console.log('💾 Persistent data timestamp:', parsedData.timestamp);
          
          // Make sure the persistent data is properly set in marketData state too
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
          return; // Exit early - don't clear data
        }
      } catch (error) {
        console.error('Error parsing stored market data:', error);
      }
    }
    
    console.log('🧹 No valid persistent data found - fetching fresh data from backend');
    // If no valid cached data, fetch from backend
    fetchMarketSizeData(false, true); // Call the correct API function for Market Size & Opportunity
    
    // Check if we have Market Entry data, if not fetch it
    const storedMarketEntry = localStorage.getItem('marketEntryData');
    if (!storedMarketEntry || !JSON.parse(storedMarketEntry).timestamp) {
      console.log('📊 No Market Entry data found, fetching from API...');
      fetchMarketEntryData(false, true); // Don't refresh, but show loading
    } else {
      console.log('📊 Market Entry data already loaded from localStorage');
    }
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
    
    // Automatically open Market Size Scout chat panel with contextual message
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
    
    // Automatically open Industry Trends Scout chat panel with contextual message
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
    setIndustryTrendsData(prev => ({ ...prev, executiveSummary: value }));
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
    setIndustryTrendsData(prev => ({ ...prev, aiAdoption: value }));
  };

  const handleIndustryTrendsCloudMigrationChange = (value: string) => {
    const oldValue = industryTrendsData.cloudMigration;
    addEditRecord(
      'Cloud Migration',
      oldValue,
      value,
      'Updated cloud migration statistics'
    );
    setIndustryTrendsData(prev => ({ ...prev, cloudMigration: value }));
  };

  const handleIndustryTrendsRegulatoryChange = (value: string) => {
    const oldValue = industryTrendsData.regulatory;
    addEditRecord(
      'Regulatory Policies',
      oldValue,
      value,
      'Updated regulatory policies count'
    );
    setIndustryTrendsData(prev => ({ ...prev, regulatory: value }));
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
    
    // Automatically open Competitor Landscape Scout chat panel with contextual message
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
    setIsRegulatoryEditing(!isRegulatoryEditing);
  };

  const handleRegulatorySaveChanges = () => {
    setIsRegulatoryEditing(false);
    setRegulatoryHasEdits(false);
    
    // Close all other scout chats and open regulatory scout with specific contextual messages
    setShowMarketSizeScoutChat(false);
    setShowIndustryTrendsScoutChat(false);
    setShowCompetitorScoutChat(false);
    setIsChatOpen(false);
    
    // Open regulatory scout chat with post-save contextual messages
    setTimeout(() => {
      setIsRegulatoryPostSave(true);
      setShowRegulatoryScoutChat(true);
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
                       executiveSummary={marketData?.executiveSummary || marketIntelligenceData.executiveSummary}
                       tamValue={marketData?.tamValue || marketIntelligenceData.tamValue}
                       samValue={marketData?.samValue || marketIntelligenceData.samValue}
                       apacGrowthRate={marketData?.apacGrowthRate || marketIntelligenceData.apacGrowthRate}
                       strategicRecommendations={(() => {
                         console.log('🔍 MarketResearch - passing strategicRecommendations:', marketData?.strategicRecommendations || marketIntelligenceData.strategicRecommendations);
                         return marketData?.strategicRecommendations || marketIntelligenceData.strategicRecommendations;
                       })()}
                       marketEntry={marketData?.marketEntry || marketIntelligenceData.marketEntry}
                       marketDrivers={marketData?.marketDrivers || marketIntelligenceData.marketDrivers}
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
