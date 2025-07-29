
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, Target, TrendingUp, DollarSign, Users, Shield } from "lucide-react";
import { ICPSummaryOpportunity } from "./ICPSummaryOpportunity";

interface SuggestedICP {
  id: string;
  name: string;
  industry: string;
  segment: string;
  companySize: string;
  geography: string;
  leadCount: number;
  decisionMakers: string[];
  keyAttributes: string[];
  growthIndicator?: string;
}

interface ICPDetailsReportProps {
  icp: SuggestedICP;
  onClose: () => void;
}

export const ICPDetailsReport = ({ icp, onClose }: ICPDetailsReportProps) => {
  return (
    <div className="animate-fade-in border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            ICP Details: {icp.name}
          </h3>
          <p className="text-gray-600">
            Strategic analysis and recommendations for {icp.industry}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={onClose}
          className="flex items-center gap-2"
        >
          <ChevronUp className="h-4 w-4" />
          Show Less
        </Button>
      </div>

      {/* ICP Summary & Market Opportunity */}
      <ICPSummaryOpportunity selectedICP={icp} />

      {/* Additional Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Buyer Map & Pain Points */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Buyer Map & Pain Points
            </CardTitle>
            <CardDescription>
              Decision makers, roles, and trigger events for {icp.segment}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Key Decision Makers</h4>
                <div className="flex flex-wrap gap-2">
                  {icp.decisionMakers.map((role, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Primary Pain Points</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Legacy system integration challenges</li>
                  <li>• Compliance and regulatory overhead</li>
                  <li>• Scaling operational efficiency</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Buying Triggers</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• New regulatory requirements</li>
                  <li>• Growth phase transitions</li>
                  <li>• Technology stack modernization</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Competitive Landscape */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Competitive Landscape
            </CardTitle>
            <CardDescription>
              Market positioning and buying signals analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Competitive Overlap</h4>
                <p className="text-sm text-gray-600">
                  Medium competition with established players focusing on different segments
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Buying Signals</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Job postings for technical roles</li>
                  <li>• Technology partnerships announcements</li>
                  <li>• Funding rounds or expansion news</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Market Position</h4>
                <p className="text-sm text-gray-600">
                  Strong opportunity in underserved {icp.geography} markets
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regulatory & Compliance */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            Regulatory & Compliance Recommendations
          </CardTitle>
          <CardDescription>
            Compliance requirements and strategic recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Regulatory Considerations</h4>
              <div className="space-y-2">
                {icp.keyAttributes.map((attribute, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                    <span>{attribute}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Recommended Actions</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Focus on {icp.geography} market entry first</p>
                <p>• Develop compliance-focused messaging</p>
                <p>• Build partnerships with regulatory consultants</p>
                <p>• Create industry-specific case studies</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
