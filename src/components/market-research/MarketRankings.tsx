

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MarketRanking {
  marketName: string;
  score: string;
  tam: string;
  competition: string;
  barriers: string;
}

interface MarketRankingsProps {
  onViewResults: (marketName: string) => void;
  rankings: MarketRanking[];
}

export const MarketRankings = ({ onViewResults, rankings }: MarketRankingsProps) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Rankings</CardTitle>
        <CardDescription>Comparative analysis of potential markets</CardDescription>
      </CardHeader>
      <CardContent>
        {rankings.length === 0 ? (
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
                {rankings.map((ranking, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
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
                        onClick={() => onViewResults(ranking.marketName)}
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
  );
};