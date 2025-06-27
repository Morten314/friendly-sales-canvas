
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Bot } from "lucide-react";
import { useState } from "react";
import { SwotAnalysisDrawer } from "./SwotAnalysisDrawer";

interface SwotData {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface SwotAnalysisProps {
  swotAnalysis: SwotData;
  isAIViewActive?: boolean;
}

export const SwotAnalysis = ({ swotAnalysis, isAIViewActive = false }: SwotAnalysisProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleCardClick = () => {
    console.log('SwotAnalysis: Card clicked', 'AI View Active:', isAIViewActive);
    if (isAIViewActive) {
      setIsDrawerOpen(true);
    }
  };

  return (
    <>
      <Card 
        className={`${isAIViewActive ? 'hover:bg-blue-50 cursor-pointer transition-colors' : ''}`}
        onClick={handleCardClick}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-blue-600" /> SWOT Analysis
            {isAIViewActive && (
              <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700 border-purple-200">
                <Bot className="h-3 w-3 mr-1" />
                AI Enhanced
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Strengths, Weaknesses, Opportunities, and Threats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-md p-4 border border-green-100">
              <h3 className="text-green-700 font-medium mb-2">Strengths</h3>
              <ul className="space-y-1">
                {swotAnalysis.strengths.map((strength, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-green-600 font-bold">+</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-red-50 rounded-md p-4 border border-red-100">
              <h3 className="text-red-700 font-medium mb-2">Weaknesses</h3>
              <ul className="space-y-1">
                {swotAnalysis.weaknesses.map((weakness, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-red-600 font-bold">-</span>
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-blue-50 rounded-md p-4 border border-blue-100">
              <h3 className="text-blue-700 font-medium mb-2">Opportunities</h3>
              <ul className="space-y-1">
                {swotAnalysis.opportunities.map((opportunity, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span>{opportunity}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-amber-50 rounded-md p-4 border border-amber-100">
              <h3 className="text-amber-700 font-medium mb-2">Threats</h3>
              <ul className="space-y-1">
                {swotAnalysis.threats.map((threat, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-amber-600 font-bold">!</span>
                    <span>{threat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <SwotAnalysisDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        swotData={swotAnalysis}
        isAIViewActive={isAIViewActive}
      />
    </>
  );
};
