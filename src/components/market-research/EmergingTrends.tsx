import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface EmergingTrend {
  trend: string;
  growthRate: string;
  adoption: string;
  impact: string;
  description: string;
}

interface EmergingTrendsProps {
  emergingTrends: EmergingTrend[];
}

export const EmergingTrends = ({ emergingTrends }: EmergingTrendsProps) => {
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" /> Emerging Market Trends
        </CardTitle>
        <CardDescription>Key trends shaping the future of the market</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {emergingTrends.map((trend, index) => (
            <div key={index} className="border rounded-md p-4 hover:bg-gray-50 transition-colors">
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
  );
};