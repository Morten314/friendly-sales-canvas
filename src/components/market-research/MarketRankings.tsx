
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { MarketRankingDrawer } from "./MarketRankingDrawer";

interface MarketRanking {
  marketName: string;
  score: string;
  tam: string;
  competition: string;
  barriers: string;
  details?: {
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

interface MarketRankingsProps {
  onViewResults: (marketName: string) => void;
  rankings: MarketRanking[];
  isAIViewActive?: boolean;
}

export const MarketRankings = ({ onViewResults, rankings, isAIViewActive = false }: MarketRankingsProps) => {
  const [selectedRanking, setSelectedRanking] = useState<MarketRanking | null>(null);
  const [originalRanking, setOriginalRanking] = useState<MarketRanking | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [localRankings, setLocalRankings] = useState<MarketRanking[]>(rankings);

  const getCompetitionColor = (competition: string) => {
    switch (competition.toLowerCase()) {
      case 'low':
        return "text-green-600";
      case 'medium':
        return "text-yellow-600";
      case 'high':
        return "text-orange-600";
      case 'very high':
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getBarrierColor = (barrier: string) => {
    switch (barrier.toLowerCase()) {
      case 'low':
        return "text-green-600";
      case 'medium':
        return "text-yellow-600";
      case 'high':
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getScoreColor = (score: string) => {
    const numericScore = parseInt(score.split('/')[0]);
    if (numericScore >= 90) return "text-green-600 font-semibold";
    if (numericScore >= 80) return "text-blue-600 font-semibold";
    if (numericScore >= 70) return "text-yellow-600 font-semibold";
    return "text-gray-600 font-medium";
  };

  const handleRowClick = (ranking: MarketRanking) => {
    if (isAIViewActive) {
      setSelectedRanking(ranking);
      setOriginalRanking(JSON.parse(JSON.stringify(ranking))); // Deep copy for original
      setIsDrawerOpen(true);
    }
  };

  const handleViewResults = (marketName: string) => {
    if (!isAIViewActive) {
      onViewResults(marketName);
    }
  };

  const handleUpdateRanking = (updatedRanking: MarketRanking) => {
    setLocalRankings(prevRankings => 
      prevRankings.map(ranking => 
        ranking.marketName === selectedRanking?.marketName ? updatedRanking : ranking
      )
    );
    setSelectedRanking(updatedRanking);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Market Rankings</CardTitle>
          <CardDescription>Comparative analysis of potential markets</CardDescription>
        </CardHeader>
        <CardContent>
          {localRankings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No market rankings available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Market</th>
                    <th className="px-4 py-2 text-left">Score</th>
                    <th className="px-4 py-2 text-left">Size (TAM)</th>
                    <th className="px-4 py-2 text-left">Competition</th>
                    <th className="px-4 py-2 text-left">Barriers</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {localRankings.map((ranking, index) => (
                    <tr 
                      key={index} 
                      className={`transition-colors ${
                        isAIViewActive 
                          ? 'hover:bg-blue-50 cursor-pointer' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleRowClick(ranking)}
                    >
                      <td className="px-4 py-3 font-medium">{ranking.marketName}</td>
                      <td className="px-4 py-3">
                        <span className={getScoreColor(ranking.score)}>
                          {ranking.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{ranking.tam}</td>
                      <td className="px-4 py-3">
                        <span className={getCompetitionColor(ranking.competition)}>
                          {ranking.competition}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getBarrierColor(ranking.barriers)}>
                          {ranking.barriers}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-sales-blue hover:text-sales-blue/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewResults(ranking.marketName);
                          }}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <MarketRankingDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        selectedRanking={selectedRanking}
        originalRanking={originalRanking}
        isAIViewActive={isAIViewActive}
        onUpdateRanking={handleUpdateRanking}
      />
    </>
  );
};