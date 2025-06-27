
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Bot, 
  TrendingUp, 
  Users, 
  Target, 
  BarChart3, 
  PieChart, 
  Layers,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles
} from "lucide-react";

import { MarketRankings } from "@/components/market-research/MarketRankings";
import { CompetitorAnalysis } from "@/components/market-research/CompetitorAnalysis";
import { MarketSegments } from "@/components/market-research/MarketSegments";
import { SwotAnalysis } from "@/components/market-research/SwotAnalysis";
import { TechnologyDrivers } from "@/components/market-research/TechnologyDrivers";
import { EmergingTrends } from "@/components/market-research/EmergingTrends";
import { ConsumerTrends } from "@/components/market-research/ConsumerTrends";
import { RecentMarketResearch } from "@/components/market-research/RecentMarketResearch";
import { ChatWithScout } from "@/components/market-research/ChatWithScout";
import { ScoutCapabilities } from "@/components/market-research/ScoutCapabilities";
import { ViewToggle } from "@/components/market-research/ViewToggle";

import { marketData } from "@/components/market-research/data/marketData";

export default function MarketResearch() {
  const [isAIViewActive, setIsAIViewActive] = useState(false);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Market Research</h1>
            <p className="text-gray-600 mt-1">
              AI-powered market intelligence and competitive analysis
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <ViewToggle 
              isAIViewActive={isAIViewActive} 
              onToggle={setIsAIViewActive} 
            />
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Search className="mr-2 h-4 w-4" />
              New Research
            </Button>
          </div>
        </div>

        {/* AI Mode Banner */}
        {isAIViewActive && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-blue-600" />
                  <Sparkles className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">AI Analysis Mode Active</h3>
                  <p className="text-sm text-blue-700">
                    Click on any data point to edit and analyze with AI assistance
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Tabs defaultValue="research" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="research">Market Research</TabsTrigger>
            <TabsTrigger value="chat">Chat with Scout</TabsTrigger>
            <TabsTrigger value="capabilities">Scout Capabilities</TabsTrigger>
          </TabsList>
          
          <TabsContent value="research" className="space-y-6">
            {/* Market Rankings */}
            <MarketRankings 
              markets={marketData.markets} 
              isAIViewActive={isAIViewActive}
            />
            
            {/* Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CompetitorAnalysis 
                markets={marketData.markets} 
                isAIViewActive={isAIViewActive}
              />
              <MarketSegments 
                marketSegments={marketData.marketSegments} 
                isAIViewActive={isAIViewActive}
              />
            </div>
            
            {/* SWOT Analysis */}
            <SwotAnalysis 
              swotAnalysis={marketData.swotAnalysis} 
              isAIViewActive={isAIViewActive}
            />
            
            {/* Technology and Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TechnologyDrivers 
                technologyDrivers={marketData.technologyDrivers} 
                isAIViewActive={isAIViewActive}
              />
              <EmergingTrends 
                emergingTrends={marketData.emergingTrends} 
                isAIViewActive={isAIViewActive}
              />
            </div>
            
            {/* Consumer Trends */}
            <ConsumerTrends 
              consumerTrends={marketData.consumerTrends} 
              isAIViewActive={isAIViewActive}
            />
            
            {/* Recent Research */}
            <RecentMarketResearch isAIViewActive={isAIViewActive} />
          </TabsContent>
          
          <TabsContent value="chat">
            <ChatWithScout />
          </TabsContent>
          
          <TabsContent value="capabilities">
            <ScoutCapabilities />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
