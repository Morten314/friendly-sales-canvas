import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Search, MessageSquare, Users } from "lucide-react";
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
import { marketData, marketAnalysisData, trendSpottingData } from "@/components/market-research/data/marketData";
import { DeploymentData } from "@/components/layout/Header";
import { useNavigate } from "react-router-dom";

const MarketResearch = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("intelligence");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAIViewActive, setIsAIViewActive] = useState(false);
  const [scoutDeploymentData, setScoutDeploymentData] = useState<DeploymentData | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<{
    name: string;
    score: string;
    size: string;
    competition: string;
    barriers: string;
    details: any;
  } | null>(null);
  
  const navigate = useNavigate();

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

  const handleViewResults = (marketName: string) => {
    const market = marketData[marketName as keyof typeof marketData];
    setSelectedMarket(market);
    setIsDrawerOpen(true);
  };

  const handleDeployScout = () => {
    navigate('/scout-deployment');
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Fixed header section */}
        <div className="sticky top-0 bg-white z-10 pb-2">
          <div className="animate-fade-in">
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
          {/* Important: We need to keep the TabsContent components inside the Tabs context */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-0">
            <TabsContent value="intelligence" className="mt-0">
              <div className="space-y-6">
                {/* Display deployment details if Scout has been deployed */}
                {scoutDeploymentData && (
                  <ScoutDeploymentDetails deploymentData={scoutDeploymentData} />
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <RecentMarketResearch onViewResults={handleViewResults} />
                  <ScoutCapabilities />
                </div>
                
                <MarketRankings onViewResults={handleViewResults} />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <CompetitorAnalysis competitorData={marketAnalysisData.competitorData} />
                  <MarketSegments marketSegments={marketAnalysisData.marketSegments} />
                </div>
                
                <SwotAnalysis swotAnalysis={marketAnalysisData.swotAnalysis} />
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <EmergingTrends emergingTrends={trendSpottingData.emergingTrends} />
                  <TechnologyDrivers technologyDrivers={trendSpottingData.technologyDrivers} />
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
    </Layout>
  );
};

export default MarketResearch;
