
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartLine } from "lucide-react";

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
}

export const MarketSegments = ({ marketSegments }: MarketSegmentsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartLine className="h-5 w-5 text-blue-600" /> Market Segments
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
            {marketSegments.map((segment) => (
              <TableRow key={segment.segment_id}>
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
  );
};