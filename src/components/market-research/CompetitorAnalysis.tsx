
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3 } from "lucide-react";
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

  const handleRowClick = (competitor: Market) => {
    if (isAIViewActive) {
      setSelectedCompetitor(competitor);
      setIsDrawerOpen(true);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" /> Competitor Analysis
          </CardTitle>
          <CardDescription>Detailed analysis of key markets and opportunities</CardDescription>
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
              {competitorData.map((market, index) => (
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
      />
    </>
  );
};
