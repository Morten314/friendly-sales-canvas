import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, TrendingUp, Clock, Target, DollarSign } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";
import { ICPSummaryOpportunity } from "./ICPSummaryOpportunity";
import { SuggestedICPsGallery } from "./SuggestedICPsGallery";
export const ICPIntelligence = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [showProfilerChat, setShowProfilerChat] = useState(false);
  const [profilerMessage, setProfilerMessage] = useState("");
  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    // TODO: Trigger context-specific chat suggestions after saving
  };
  const handleICPSelect = (icp: any) => {
    // Scroll to ICP details section
    const detailsSection = document.getElementById('icp-details-section');
    if (detailsSection) {
      detailsSection.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };
  const handleProfilerChatOpen = (message?: string) => {
    setProfilerMessage(message || "I'm Profiler, your ICP research assistant. How can I help you today?");
    setShowProfilerChat(true);
  };
  return <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        
        <p className="text-gray-600">Define and refine your Ideal Customer Profile with agent-guided research.</p>
      </div>

      {/* Suggested ICPs Gallery */}
      <SuggestedICPsGallery onICPSelect={handleICPSelect} onProfilerChatOpen={handleProfilerChatOpen} />

      {/* ICP Details Section */}
      <div id="icp-details-section">
        {/* ICP Summary & Market Opportunity Section */}
        <ICPSummaryOpportunity />

        {/* Agent-Level Contextual Mini Report */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/40 to-blue-50/40 mt-6">
          <CardHeader className="relative pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg text-gray-900">Current ICP Focus</CardTitle>
                <CardDescription className="mt-1">
                  You're exploring: <span className="font-medium">B2B SaaS → Fintech → North America → 200-500 employees</span>
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-purple-600 hover:bg-purple-100" onClick={handleEditToggle}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            {/* Summary paragraph */}
            <p className="text-sm text-gray-700 mb-4">
              Your current ICP represents a high-value segment in the fintech space, with strong growth potential 
              and specific technology adoption patterns that align with your product offering.
            </p>

            {/* Data highlights grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* TAM Highlight */}
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">TAM</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-gray-900">$14.2B</p>
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    5.6% CAGR
                  </p>
                </div>
                <div className="mt-2">
                  <MiniLineChart data={[{
                  name: "2021",
                  value: 12.1
                }, {
                  name: "2022",
                  value: 12.8
                }, {
                  name: "2023",
                  value: 13.5
                }, {
                  name: "2024",
                  value: 14.2
                }]} title="" color="#059669" />
                </div>
              </div>

              {/* Key Pain Point */}
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-orange-600" />
                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">Key Pain</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">Integration challenges</p>
                  <p className="text-xs text-gray-600">with legacy systems</p>
                </div>
                <div className="mt-2">
                  <MiniPieChart data={[{
                  name: "Integration",
                  value: 45,
                  color: "#ea580c"
                }, {
                  name: "Other",
                  value: 55,
                  color: "#fed7aa"
                }]} title="" />
                </div>
              </div>

              {/* Top Tech */}
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Emerging Tech</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">AI-powered</p>
                  <p className="text-xs text-gray-600">fraud detection</p>
                </div>
                <div className="mt-2 flex gap-1">
                  <div className="h-1 bg-blue-600 rounded flex-1"></div>
                  <div className="h-1 bg-blue-200 rounded w-1/3"></div>
                  <div className="h-1 bg-blue-100 rounded w-1/4"></div>
                </div>
              </div>

              {/* Sales Cycle */}
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">Sales Cycle</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-gray-900">6–8 months</p>
                  <p className="text-xs text-gray-600">Avg duration</p>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <div className="h-2 w-2 bg-purple-600 rounded-full"></div>
                  <div className="h-1 bg-purple-300 rounded flex-1"></div>
                  <div className="h-2 w-2 bg-purple-600 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Edit mode placeholder */}
            {isEditing && <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-700 mb-2">Edit Mode Active</p>
                <p className="text-xs text-purple-600">
                  ICP editing interface would appear here. After saving changes, 
                  Profiler will provide context-specific chat suggestions.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                    Save Changes
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEditToggle}>
                    Cancel
                  </Button>
                </div>
              </div>}
          </CardContent>
        </Card>

        {/* Additional ICP content would go here */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>ICP Profiles</CardTitle>
              <CardDescription>Manage your defined customer profiles</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">ICP profile management interface coming soon...</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile Analytics</CardTitle>
              <CardDescription>Performance metrics for your ICPs</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Analytics dashboard coming soon...</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Profiler Chat Panel */}
      {showProfilerChat && <Card className="border-blue-200 bg-blue-50/40 fixed right-4 top-20 w-96 h-[500px] shadow-xl z-50">
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
        </Card>}
    </div>;
};