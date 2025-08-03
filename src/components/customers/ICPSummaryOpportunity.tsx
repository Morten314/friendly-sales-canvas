
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, DollarSign, Target, ChevronRight } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";

export const ICPSummaryOpportunity = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* ICP Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            ICP Summary
          </CardTitle>
          <CardDescription>
            Overview of your ideal customer profile analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Primary Segment</span>
              <Badge variant="secondary">Enterprise SaaS</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Company Size</span>
              <span className="text-sm text-gray-600">500-2,000 employees</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Annual Revenue</span>
              <span className="text-sm text-gray-600">$50M-$500M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Growth Stage</span>
              <Badge className="bg-green-100 text-green-800">Scaling</Badge>
            </div>
            <div className="pt-2">
              <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center">
                <MiniPieChart />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Opportunity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            Market Opportunity
          </CardTitle>
          <CardDescription>
            Market size and growth potential for your ICP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">$2.4B</div>
                <div className="text-xs text-gray-600">Total Market</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">$450M</div>
                <div className="text-xs text-gray-600">Addressable</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Growth Rate</span>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-semibold">12.3% CAGR</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Competitive Density</span>
              <Badge variant="outline">Medium</Badge>
            </div>
            <div className="pt-2">
              <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center">
                <MiniLineChart />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
