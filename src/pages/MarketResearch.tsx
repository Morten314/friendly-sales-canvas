
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Search, MessageSquare, Users, Settings, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatWithScout } from "@/components/market-research/ChatWithScout";
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
import { DeploymentData } from "@/components/layout/Header";
import { useNavigate } from "react-router-dom";

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
}

const MarketResearch = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("intelligence");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAIViewActive, setIsAIViewActive] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scoutDeploymentData, setScoutDeploymentData] = useState<DeploymentData | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  
  // API data state
  const [marketData, setMarketData] = useState<MarketIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  // Fetch market intelligence data
  const fetchMarketData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('https://backend-11kr.onrender.com/market_intelligence');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: MarketIntelligenceData = await response.json();
      setMarketData(data);
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchMarketData();
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
      console.log('Selected Market Data:', marketData);
      console.log('Sub-markets:', marketData.details.subMarkets);
      console.log('Key Insights:', marketData.details.keyInsights);
      console.log('Recommended Actions:', marketData.details.recommendedActions);
      
      setSelectedMarket(marketData);
      setIsDrawerOpen(true);
    } else {
      console.log('Market data not found');
      // You might want to show an error message to the user here
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
    fetchMarketData();
  };

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading market intelligence data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading data: {error}</p>
            <Button onClick={handleRefresh} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // No data state
  if (!marketData) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="mb-4">No market data available</p>
            <Button onClick={handleRefresh} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Fixed header section */}
        <div className="sticky top-0 bg-white z-10 pb-2">
          <div className="animate-fade-in">
            {/* Settings and Refresh buttons aligned to the right */}
            <div className="flex items-center justify-end gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="flex items-center gap-2"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
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

            {isChatOpen && <ChatWithScout />}
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
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
        
        {/* Scrollable content area */}
        <ScrollArea className="flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-0">
            <TabsContent value="intelligence" className="mt-0">
              <div className="space-y-6">
                {/* Display deployment details if Scout has been deployed */}
                {scoutDeploymentData && (
                  <ScoutDeploymentDetails deploymentData={scoutDeploymentData} />
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <RecentMarketResearch 
                    onViewResults={handleViewResults}
                    researchReports={marketData.researchReports}
                    markets={marketData.markets}
                  />
                  <ScoutCapabilities />
                </div>
                
                <MarketRankings 
                  onViewResults={handleViewResultsFromRankings}
                  rankings={marketData.rankings}
                />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <CompetitorAnalysis competitorData={marketData.markets} />
                  <MarketSegments marketSegments={marketData.market_segments} />
                </div>
                
                <SwotAnalysis swotAnalysis={marketData.swot_analysis} />
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <EmergingTrends emergingTrends={marketData.emerging_trends} />
                  <TechnologyDrivers technologyDrivers={marketData.technology_drivers} />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="analysis" className="mt-0">
              <ConsumerTrends />
            </TabsContent>
            
            <TabsContent value="trends" className="mt-0">
              <ChatWithScout fullPage={true} />
            </TabsContent>
          </Tabs>
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