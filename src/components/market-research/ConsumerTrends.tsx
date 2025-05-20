import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartLine } from "lucide-react";

interface ConsumerTrend {
  trend: string;
  strength: string;
  persistence: string;
  demographics: string;
}

interface ConsumerTrendsProps {
  consumerTrends: ConsumerTrend[];
}

export const ConsumerTrends = ({ consumerTrends }: ConsumerTrendsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartLine className="h-5 w-5 text-blue-600" /> Consumer Behavior Shifts
        </CardTitle>
        <CardDescription>Evolving consumer preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trend</TableHead>
              <TableHead>Strength</TableHead>
              <TableHead>Persistence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consumerTrends.map((trend, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{trend.trend}</TableCell>
                <TableCell>{trend.strength}</TableCell>
                <TableCell>{trend.persistence}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};