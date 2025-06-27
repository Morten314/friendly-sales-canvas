
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartLine, Bot } from "lucide-react";
import { useState, useEffect } from "react";
import { MarketSegmentsDrawer } from "./MarketSegmentsDrawer";

interface MarketSegment {
  segment_id: string;
  segment: string;
  size: string;
  growth_potential: string;
  acquisition_cost: string;
  needs_match: string;
}

interface MarketSegmentsProps {
  marketSegments: MarketSegment[];
  isAIViewActive?: boolean;
}

export const MarketSegments = ({ marketSegments, isAIViewActive = false }: MarketSegmentsProps) => {
  const [selectedSegment, setSelectedSegment] = useState<MarketSegment | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [localSegments, setLocalSegments] = useState<MarketSegment[]>(marketSegments);

  // Update local state when props change
  useEffect(() => {
    setLocalSegments(marketSegments);
  }, [marketSegments]);

  const handleRowClick = (segment: MarketSegment) => {
    console.log('MarketSegments: Row clicked', segment, 'AI View Active:', isAIViewActive);
    if (isAIViewActive) {
      setSelectedSegment(segment);
      setIsDrawerOpen(true);
    }
  };

  const handleUpdateSegment = (updatedSegment: MarketSegment) => {
    setLocalSegments(prevSegments => 
      prevSegments.map(segment => 
        segment.segment_id === selectedSegment?.segment_id ? updatedSegment : segment
      )
    );
    // Also update the selected segment to reflect changes immediately
    setSelectedSegment(updatedSegment);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartLine className="h-5 w-5 text-blue-600" /> Market Segments
            {isAIViewActive && (
              <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700 border-purple-200">
                <Bot className="h-3 w-3 mr-1" />
                AI Enhanced
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Analysis of key market segments and their potential</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Growth Potential</TableHead>
                <TableHead>Acquisition Cost</TableHead>
                <TableHead>Needs Match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localSegments.map((segment) => (
                <TableRow 
                  key={segment.segment_id}
                  className={`transition-colors ${
                    isAIViewActive 
                      ? 'hover:bg-blue-50 cursor-pointer' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleRowClick(segment)}
                >
                  <TableCell className="font-medium">{segment.segment}</TableCell>
                  <TableCell>{segment.size}</TableCell>
                  <TableCell>{segment.growth_potential}</TableCell>
                  <TableCell>{segment.acquisition_cost}</TableCell>
                  <TableCell>{segment.needs_match}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MarketSegmentsDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        selectedSegment={selectedSegment}
        isAIViewActive={isAIViewActive}
        onUpdateSegment={handleUpdateSegment}
      />
    </>
  );
};
