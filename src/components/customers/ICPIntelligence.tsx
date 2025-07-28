
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, TrendingUp, Clock, Target, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";
import { ICPSummaryOpportunity } from "./ICPSummaryOpportunity";
import { SuggestedICPsGallery } from "./SuggestedICPsGallery";

export const ICPIntelligence = () => {
  const [showICPDetails, setShowICPDetails] = useState(false);
  const [selectedICP, setSelectedICP] = useState<any>(null);
  const [showProfilerChat, setShowProfilerChat] = useState(false);
  const [profilerMessage, setProfilerMessage] = useState("");

  const handleICPDetailsClick = (icp: any) => {
    setSelectedICP(icp);
    setShowICPDetails(true);
    
    // Smooth scroll to details section
    setTimeout(() => {
      const detailsSection = document.getElementById('icp-details-section');
      if (detailsSection) {
        detailsSection.scrollIntoView({
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const handleProfilerChatOpen = (message?: string) => {
    setProfilerMessage(message || "I'm Profiler, your ICP research assistant. How can I help you today?");
    setShowProfilerChat(true);
  };

  return (
    <div className="space-y-6">
      {/* Suggested ICPs Gallery - now in vertical feed layout */}
      <SuggestedICPsGallery 
        onICPSelect={handleICPDetailsClick} 
        onProfilerChatOpen={handleProfilerChatOpen}
        layoutMode="vertical-feed"
      />

      {/* ICP Details Section - only shown when "View ICP Details" is clicked */}
      {showICPDetails && (
        <div id="icp-details-section" className="animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                ICP Details: {selectedICP?.segment || 'Selected Profile'}
              </h2>
              <p className="text-gray-600">
                Strategic analysis and recommendations for {selectedICP?.industry || 'this ICP'}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowICPDetails(false)}
              className="flex items-center gap-2"
            >
              <ChevronUp className="h-4 w-4" />
              Hide Details
            </Button>
          </div>

          {/* ICP Summary & Market Opportunity Section */}
          <ICPSummaryOpportunity selectedICP={selectedICP} />

          {/* Additional strategic report sections would go here */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Buyer Map, Roles, Pain Points, Triggers */}
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Buyer Map & Pain Points
                </CardTitle>
                <CardDescription>
                  Decision makers, roles, and trigger events for {selectedICP?.segment}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Key Decision Makers</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedICP?.decisionMakers?.map((role: string, index: number) => (
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

            {/* Competitive Overlap & Buying Signals */}
            <Card className="animate-fade-in">
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
                    <div className="text-sm text-gray-600">
                      <p>Medium competition with established players focusing on different segments</p>
                    </div>
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
                    <div className="text-sm text-gray-600">
                      <p>Strong opportunity in underserved {selectedICP?.regions?.join(', ')} markets</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Regulatory, Compliance & Recommended ICP */}
          <Card className="mt-6 animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
                Regulatory & Compliance Recommendations
              </CardTitle>
              <CardDescription>
                Compliance requirements and strategic ICP recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Regulatory Considerations</h4>
                  <div className="space-y-2">
                    {selectedICP?.keyAttributes?.map((attribute: string, index: number) => (
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
                    <p>• Focus on {selectedICP?.regions?.[0]} market entry first</p>
                    <p>• Develop compliance-focused messaging</p>
                    <p>• Build partnerships with regulatory consultants</p>
                    <p>• Create industry-specific case studies</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profiler Chat Panel */}
      {showProfilerChat && (
        <Card className="border-blue-200 bg-blue-50/40 fixed right-4 top-20 w-96 h-[500px] shadow-xl z-50 animate-slide-in-right">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">🤖</span>
                </div>
                Profiler
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowProfilerChat(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white rounded-lg p-3">
              <p className="text-sm text-gray-700">{profilerMessage}</p>
            </div>
            <div className="space-y-2">
              <Button variant="ghost" size="sm" className="justify-start text-xs w-full bg-white hover:bg-blue-50">
                🔍 Which 3 competitors are growing fastest in this segment?
              </Button>
              <Button variant="ghost" size="sm" className="justify-start text-xs w-full bg-white hover:bg-blue-50">
                🎯 Where's your TAM saturated vs underserved?
              </Button>
              <Button variant="ghost" size="sm" className="justify-start text-xs w-full bg-white hover:bg-blue-50">
                💬 What's your main monetization route in this ICP?
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
