
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        
        
      </div>

      {/* Suggested ICPs Gallery */}
      <SuggestedICPsGallery onICPSelect={handleICPSelect} onProfilerChatOpen={handleProfilerChatOpen} />

      {/* ICP Details Section */}
      <div id="icp-details-section">
        {/* ICP Summary & Market Opportunity Section */}
        <ICPSummaryOpportunity />

        {/* Agent-Level Contextual Mini Report */}
        

        {/* ICP Profiles and Profile Analytics section removed */}
      </div>

      {/* Profiler Chat Panel */}
      {showProfilerChat && (
        <Card className="border-blue-200 bg-blue-50/40 fixed right-4 top-20 w-96 h-[500px] shadow-xl z-50">
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
