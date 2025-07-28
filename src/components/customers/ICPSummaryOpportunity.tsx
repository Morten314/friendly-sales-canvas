
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Target, Users } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";

interface ICPSummaryOpportunityProps {
  selectedICP: any;
}

export const ICPSummaryOpportunity = ({ selectedICP }: ICPSummaryOpportunityProps) => {
  // Sample data for the charts
  const revenueData = [
    { name: 'Q1', value: 2.1 },
    { name: 'Q2', value: 2.3 },
    { name: 'Q3', value: 2.5 },
    { name: 'Q4', value: 2.8 }
  ];

  const penetrationData = [
    { name: 'Captured', value: 15, color: '#3b82f6' },
    { name: 'Addressable', value: 35, color: '#10b981' },
    { name: 'Untapped', value: 50, color: '#f59e0b' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* ICP Summary */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            ICP Summary
          </CardTitle>
          <CardDescription>
            Strategic overview of {selectedICP?.segment || 'this ICP'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Profile Overview</h4>
              <p className="text-sm text-gray-600">
                {selectedICP?.industry || 'Industry'} companies in the {selectedICP?.segment || 'segment'} space, 
                typically {selectedICP?.companySize || 'sized'} with strong focus on {selectedICP?.keyAttributes?.[0] || 'key attributes'}.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Key Characteristics</h4>
              <div className="flex flex-wrap gap-1">
                {selectedICP?.keyAttributes?.map((attr: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {attr}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Geographic Focus</h4>
              <p className="text-sm text-gray-600">
                Primary markets: {selectedICP?.regions?.join(', ') || 'Global'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Opportunity */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Market Opportunity
          </CardTitle>
          <CardDescription>
            Revenue potential and market sizing for {selectedICP?.segment}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-1">Market Size</h4>
                <p className="text-2xl font-bold text-green-600">$2.8B</p>
                <p className="text-xs text-gray-500">TAM in target regions</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Growth Rate</h4>
                <p className="text-2xl font-bold text-blue-600">{selectedICP?.growthIndicator || '8.4%'}</p>
                <p className="text-xs text-gray-500">Annual growth</p>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Revenue Opportunity</h4>
              <div className="h-16">
                <MiniLineChart 
                  data={revenueData}
                  title="Quarterly Revenue Growth"
                  color="#10b981"
                />
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Market Penetration</h4>
              <div className="h-16">
                <MiniPieChart 
                  data={penetrationData}
                  title="Market Penetration"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
