

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

interface ResearchReport {
  marketName: string;
  completedAgo: string;
  status: string;
  summary: string;
  marketScore: string;
}

interface SubMarket {
  name: string;
  size: string;
  growth: string;
}

interface MarketDetails {
  summary: string;
  subMarkets: SubMarket[];
  keyInsights: string[];
  recommendedActions: string[];
}

interface Market {
  name: string;
  score: string;
  size: string;
  competition: string;
  barriers: string;
  details: MarketDetails;
}

interface RecentMarketResearchProps {
  onViewResults: (marketData: Market | null) => void;
  researchReports: ResearchReport[];
  markets: Market[]; // Add markets data as prop
  onViewAllReports?: () => void; // Optional callback for view all
}

export const RecentMarketResearch = ({ 
  onViewResults, 
  researchReports, 
  markets,
  onViewAllReports 
}: RecentMarketResearchProps) => {
  const [showAllReports, setShowAllReports] = useState(false);
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return "bg-green-100 text-green-800";
      case 'in progress':
        return "bg-yellow-100 text-yellow-800";
      case 'pending':
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleViewResults = (marketName: string) => {
    // Find the corresponding market data
    const marketData = markets.find(market => 
      market.name === marketName || 
      market.name.toLowerCase().includes(marketName.toLowerCase().replace(' analysis', ''))
    );
    
    onViewResults(marketData || null);
  };

  const handleViewAllReports = () => {
    if (onViewAllReports) {
      onViewAllReports();
    } else {
      setShowAllReports(!showAllReports);
    }
  };

  const reportsToShow = showAllReports ? researchReports : researchReports.slice(0, 3);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Recent Market Research</CardTitle>
        <CardDescription>Access your previous market analyses</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {            researchReports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No recent market research available</p>
            </div>
          ) : (
            <>
              {reportsToShow.map((report, index) => (
                <div 
                  key={index} 
                  className="border rounded-md p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">{report.marketName}</h3>
                      <p className="text-sm text-gray-500">Completed {report.completedAgo}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full ${getStatusColor(report.status)}`}>
                      {report.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{report.summary}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Market Score: {report.marketScore}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      onClick={() => handleViewResults(report.marketName)}
                    >
                      View Results <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {researchReports.length > 3 && (
                <div className="text-center pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleViewAllReports}
                  >
                    {showAllReports ? 'Show Less' : `View All Reports (${researchReports.length})`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};