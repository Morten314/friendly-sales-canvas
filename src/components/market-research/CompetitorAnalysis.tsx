import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Bot } from "lucide-react";
import { useState } from "react";
import { CompetitorAnalysisDrawer } from "./CompetitorAnalysisDrawer";

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

interface CompetitorAnalysisProps {
  competitorData: Market[];
  isAIViewActive?: boolean;
}

export const CompetitorAnalysis = ({ competitorData, isAIViewActive = false }: CompetitorAnalysisProps) => {
  const [selectedCompetitor, setSelectedCompetitor] = useState<Market | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [localCompetitorData, setLocalCompetitorData] = useState<Market[]>(competitorData);

  const handleRowClick = (competitor: Market) => {
    console.log('CompetitorAnalysis: Row clicked', competitor, 'AI View Active:', isAIViewActive);
    if (isAIViewActive) {
      setSelectedCompetitor(competitor);
      setIsDrawerOpen(true);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Only handle card clicks in AI mode and if we have data
    if (!isAIViewActive || localCompetitorData.length === 0) {
      return;
    }

    // Check if the click target is part of the table
    const target = e.target as HTMLElement;
    const isTableClick = target.closest('table') !== null;
    
    // If it's a table click, let the row handler manage it
    if (isTableClick) {
      return;
    }

    // For clicks outside the table (header, description, empty space)
    const competitorToSelect = selectedCompetitor || localCompetitorData[0];
    setSelectedCompetitor(competitorToSelect);
    setIsDrawerOpen(true);
  };

  const handleUpdateCompetitor = (updatedCompetitor: Market) => {
    setLocalCompetitorData(prevData => 
      prevData.map(competitor => 
        competitor.name === selectedCompetitor?.name ? updatedCompetitor : competitor
      )
    );
    setSelectedCompetitor(updatedCompetitor);
  };

  return (
    <>
      <Card 
        className={`transition-colors ${
          isAIViewActive 
            ? 'hover:bg-blue-50 cursor-pointer' 
            : 'hover:bg-gray-50'
        }`}
        onClick={handleCardClick}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" /> 
            Competitor Analysis
            {isAIViewActive && (
              <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700 border-purple-200">
                <Bot className="h-3 w-3 mr-1" />
                AI Enhanced
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Detailed analysis of key markets and opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Market Size</TableHead>
                <TableHead>Competition</TableHead>
                <TableHead>Barriers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localCompetitorData.map((market, index) => (
                <TableRow 
                  key={index}
                  className={`transition-colors ${
                    isAIViewActive 
                      ? 'hover:bg-blue-50 cursor-pointer' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleRowClick(market)}
                >
                  <TableCell className="font-medium">{market.name}</TableCell>
                  <TableCell>{market.score}</TableCell>
                  <TableCell>{market.size}</TableCell>
                  <TableCell className="text-blue-600">{market.competition}</TableCell>
                  <TableCell>{market.barriers}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CompetitorAnalysisDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        selectedCompetitor={selectedCompetitor}
        isAIViewActive={isAIViewActive}
        onUpdateCompetitor={handleUpdateCompetitor}
      />
    </>
  );
};
