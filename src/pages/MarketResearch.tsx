
// import { useState } from "react";
// import { Layout } from "@/components/layout/Layout";
// import { Button } from "@/components/ui/button";
// import { Search, MessageSquare, ChartBar, Users } from "lucide-react";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { ChatWithScout } from "@/components/market-research/ChatWithScout";
// import { RecentMarketResearch } from "@/components/market-research/RecentMarketResearch";
// import { ScoutCapabilities } from "@/components/market-research/ScoutCapabilities";
// import { MarketRankings } from "@/components/market-research/MarketRankings";
// import { CompetitorAnalysis } from "@/components/market-research/CompetitorAnalysis";
// import { MarketSegments } from "@/components/market-research/MarketSegments";
// import { SwotAnalysis } from "@/components/market-research/SwotAnalysis";
// import { EmergingTrends } from "@/components/market-research/EmergingTrends";
// import { ConsumerTrends } from "@/components/market-research/ConsumerTrends";
// import { TechnologyDrivers } from "@/components/market-research/TechnologyDrivers";
// import { MarketDetailDrawer } from "@/components/market-research/MarketDetailDrawer";
// import { marketData, marketAnalysisData, trendSpottingData } from "@/components/market-research/data/marketData";

// const MarketResearch = () => {
//   const [isChatOpen, setIsChatOpen] = useState(false);
//   const [activeTab, setActiveTab] = useState("intelligence");
//   const [isDrawerOpen, setIsDrawerOpen] = useState(false);
//   const [selectedMarket, setSelectedMarket] = useState<{
//     name: string;
//     score: string;
//     size: string;
//     competition: string;
//     barriers: string;
//     details: any;
//   } | null>(null);

//   const handleViewResults = (marketName: string) => {
//     const market = marketData[marketName as keyof typeof marketData];
//     setSelectedMarket(market);
//     setIsDrawerOpen(true);
//   };

//   return (
//     <Layout>
//       <div className="animate-fade-in">
//         <div className="flex justify-between items-center mb-6">
//           <div className="flex items-start gap-4">
//             <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
//               <Search className="h-8 w-8" />
//             </div>
//             <div>
//               <h1 className="text-2xl font-bold">Market Research (Scout)</h1>
//               <p className="text-gray-500">Find the best markets before your competitors do</p>
//             </div>
//           </div>
//           <div className="flex gap-2">
//             <Button 
//               variant="outline" 
//               className="flex items-center gap-2"
//               onClick={() => setIsChatOpen(!isChatOpen)}
//             >
//               <MessageSquare className="h-4 w-4" />
//               Chat with Scout
//             </Button>
//             <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
//               <Search className="h-4 w-4" />
//               New Research
//             </Button>
//           </div>
//         </div>

//         {isChatOpen && <ChatWithScout />}
        
//         <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
//           <TabsList className="w-full bg-gray-100 p-1 mb-2">
//             <TabsTrigger value="intelligence" className="flex items-center gap-2 flex-1">
//               <Search className="h-4 w-4" />
//               Market Intelligence
//             </TabsTrigger>
//             <TabsTrigger value="analysis" className="flex items-center gap-2 flex-1">
//               <Users className="h-4 w-4" />
//               Your Lead Stream
//             </TabsTrigger>
//             <TabsTrigger value="trends" className="flex items-center gap-2 flex-1">
//               <MessageSquare className="h-4 w-4" />
//               Chat with Scout
//             </TabsTrigger>
//           </TabsList>
          
//           <TabsContent value="intelligence" className="mt-0">
//             <div className="space-y-6">
//               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
//                 <RecentMarketResearch onViewResults={handleViewResults} />
//                 <ScoutCapabilities />
//               </div>
              
//               <MarketRankings onViewResults={handleViewResults} />
              
//               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
//                 <CompetitorAnalysis competitorData={marketAnalysisData.competitorData} />
//                 <MarketSegments marketSegments={marketAnalysisData.marketSegments} />
//               </div>
              
//               <SwotAnalysis swotAnalysis={marketAnalysisData.swotAnalysis} />
              
//               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
//                 <EmergingTrends emergingTrends={trendSpottingData.emergingTrends} />
//                 <TechnologyDrivers technologyDrivers={trendSpottingData.technologyDrivers} />
//               </div>
//             </div>
//           </TabsContent>
          
//           <TabsContent value="analysis" className="mt-0">
//             <ConsumerTrends />
//           </TabsContent>
          
//           <TabsContent value="trends" className="mt-0">
//             <ChatWithScout fullPage={true} />
//           </TabsContent>
//         </Tabs>
//       </div>

//       <MarketDetailDrawer 
//         isOpen={isDrawerOpen} 
//         onOpenChange={setIsDrawerOpen} 
//         selectedMarket={selectedMarket} 
//       />
//     </Layout>
//   );
// };

// export default MarketResearch;

import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Search, MessageSquare, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ViewToggle } from "@/components/market-research/ViewToggle";
import { marketData, marketAnalysisData, trendSpottingData } from "@/components/market-research/data/marketData";

const MarketResearch = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("intelligence");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAIViewActive, setIsAIViewActive] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<{
    name: string;
    score: string;
    size: string;
    competition: string;
    barriers: string;
    details: any;
  } | null>(null);

  const handleViewResults = (marketName: string) => {
    const market = marketData[marketName as keyof typeof marketData];
    setSelectedMarket(market);
    setIsDrawerOpen(true);
  };

  const handleViewModeChange = (isAIView: boolean) => {
    setIsAIViewActive(isAIView);
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <Search className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Market Research (Scout)</h1>
              <p className="text-gray-500">Find the best markets before your competitors do</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              <MessageSquare className="h-4 w-4" />
              Chat with Scout
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
              <Search className="h-4 w-4" />
              New Research
            </Button>
          </div>
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
          
          <TabsContent value="intelligence" className="mt-0">
            <div className="space-y-6">
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
      </div>

      <MarketDetailDrawer 
        isOpen={isDrawerOpen} 
        onOpenChange={setIsDrawerOpen} 
        selectedMarket={selectedMarket} 
        isAIViewActive={isAIViewActive}
      />

      <ViewToggle onViewChange={handleViewModeChange} />
    </Layout>
  );
};

export default MarketResearch;
