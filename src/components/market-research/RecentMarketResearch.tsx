import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface RecentMarketResearchProps {
  onViewResults: (marketName: string) => void;
}

export const RecentMarketResearch = ({ onViewResults }: RecentMarketResearchProps) => {
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Recent Market Research</CardTitle>
        <CardDescription>Access your previous market analyses</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-medium">UK Fintech Market Analysis</h3>
                <p className="text-sm text-gray-500">Completed 2 days ago</p>
              </div>
              <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                Completed
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3">Analysis of 5 fintech submarkets with TAM calculation and competitor landscape.</p>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Market Score: 87/100</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-sales-blue flex items-center gap-1"
                onClick={() => onViewResults("UK Fintech")}
              >
                View Results <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-medium">Germany Healthtech Expansion</h3>
                <p className="text-sm text-gray-500">Completed 1 week ago</p>
              </div>
              <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                Completed
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3">Overview of German healthtech market opportunities and regulatory landscape.</p>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Market Score: 72/100</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-sales-blue flex items-center gap-1"
                onClick={() => onViewResults("Germany Healthtech")}
              >
                View Results <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};