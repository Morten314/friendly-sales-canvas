
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Bot } from "lucide-react";
import { useState, useEffect } from "react";
import { EmergingTrendsDrawer } from "./EmergingTrendsDrawer";

interface EmergingTrend {
  trend: string;
  growthRate: string;
  adoption: string;
  impact: string;
  description: string;
}

interface EmergingTrendsProps {
  emergingTrends: EmergingTrend[];
  isAIViewActive?: boolean;
}

export const EmergingTrends = ({ emergingTrends, isAIViewActive = false }: EmergingTrendsProps) => {
  const [selectedTrend, setSelectedTrend] = useState<EmergingTrend | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [localTrends, setLocalTrends] = useState<EmergingTrend[]>(emergingTrends);

  // Update local state when props change
  useEffect(() => {
    setLocalTrends(emergingTrends);
  }, [emergingTrends]);

  const handleTrendClick = (trend: EmergingTrend) => {
    console.log('EmergingTrends: Trend clicked', trend, 'AI View Active:', isAIViewActive);
    if (isAIViewActive) {
      setSelectedTrend(trend);
      setIsDrawerOpen(true);
    }
  };

  const handleUpdateTrend = (updatedTrend: EmergingTrend) => {
    setLocalTrends(prevTrends => 
      prevTrends.map(trend => 
        trend.trend === selectedTrend?.trend ? updatedTrend : trend
      )
    );
    // Also update the selected trend to reflect changes immediately
    setSelectedTrend(updatedTrend);
  };

  return (
    <>
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" /> Emerging Market Trends
            {isAIViewActive && (
              <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700 border-purple-200">
                <Bot className="h-3 w-3 mr-1" />
                AI Enhanced
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Key trends shaping the future of the market</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {localTrends.map((trend, index) => (
              <div 
                key={index} 
                className={`border rounded-md p-4 transition-colors ${
                  isAIViewActive 
                    ? 'hover:bg-blue-50 cursor-pointer' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleTrendClick(trend)}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-medium text-blue-700">{trend.trend}</h3>
                  <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                    {trend.growthRate}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{trend.description}</p>
                <div className="flex gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Adoption:</span>
                    <span className="ml-1 font-medium">{trend.adoption}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Impact:</span>
                    <span className="ml-1 font-medium">{trend.impact}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <EmergingTrendsDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        selectedTrend={selectedTrend}
        isAIViewActive={isAIViewActive}
        onUpdateTrend={handleUpdateTrend}
      />
    </>
  );
};
