


import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, TrendingUp, Clock, Target, DollarSign } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";
import { ICPSummaryOpportunity } from "./ICPSummaryOpportunity"; // Re-enabled with null handling
import { SuggestedICPsGallery } from "./SuggestedICPsGallery";
import { ICPBuilder } from "./ICPBuilder";
import { ICPInsights } from "./ICPInsights";
import { ICPProfilesList } from "./ICPProfilesList";

interface SuggestedICP {
  id: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
  // Extended properties for detailed analysis
  title?: string;
  blurb?: string;
  marketSize?: string;
  growth?: string;
  urgency?: string;
  timeToClose?: string;
  corePersonas?: number;
  topPainPoint?: string;
  buyingTriggers?: number;
  competitors?: number;
  winLossChange?: string;
  buyingSignals?: number;
  buyingTriggersArray?: Array<{
    trigger: string;
    description: string;
  }>;
  marketAnalysis?: {
    totalMarketSize: string;
    servicableMarket: string;
    targetableMarket: string;
    marketGrowth: string;
    segments: Array<{
      name: string;
      size: string;
      growth: string;
      share: string;
    }>;
    keyChallenges: string[];
    strategicRecommendations: string[];
    signalsToMonitor: string[];
  };
  competitiveData?: {
    mainCompetitors: string[];
    competitiveMap: Array<{
      competitor: string;
      segment: string;
      share: string;
      winsLosses: string;
      differentiators: string;
    }>;
    competitiveNews: Array<{
      headline: string;
      competitor: string;
      date: string;
      impact: string;
    }>;
    buyingSignalsData: Array<{
      signal: string;
      strength: string;
      description: string;
      source: string;
      recency: string;
      region: string;
      type: string;
    }>;
  };
  _metadata?: {
    dataSource: 'api' | 'fallback';
    fetchedAt?: string;
    generatedAt?: string;
    originalICPId?: string;
    fallbackReason?: string;
    transformationIndex?: number;
  };
}

export const ICPIntelligence = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [showProfilerChat, setShowProfilerChat] = useState(false);
  const [profilerMessage, setProfilerMessage] = useState("");
  const [selectedICP, setSelectedICP] = useState<SuggestedICP | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Listen for company profile updates
  useEffect(() => {
    const handleCompanyProfileUpdate = (event: CustomEvent) => {
      console.log("=== COMPANY PROFILE UPDATED - TRIGGERING ICP REFRESH ===");
      console.log("Profile update event:", event.detail);
      console.log("Current refreshTrigger:", refreshTrigger);
      console.log("Setting refreshTrigger to:", refreshTrigger + 1);
      setRefreshTrigger(prev => {
        console.log("RefreshTrigger updated from", prev, "to", prev + 1);
        return prev + 1;
      });
    };

    console.log("=== SETTING UP COMPANY PROFILE EVENT LISTENER ===");
    window.addEventListener('companyProfileUpdated', handleCompanyProfileUpdate as EventListener);
    
    return () => {
      console.log("=== REMOVING COMPANY PROFILE EVENT LISTENER ===");
      window.removeEventListener('companyProfileUpdated', handleCompanyProfileUpdate as EventListener);
    };
  }, []);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    // TODO: Trigger context-specific chat suggestions after saving
  };

  const handleICPSelect = (icp: SuggestedICP) => {
    try {
      console.log("=== ICP SELECTION ATTEMPT ===");
      console.log("ICP selected in ICPIntelligence:", icp);
      console.log("ICP type:", typeof icp);
      console.log("ICP properties:", Object.keys(icp || {}));
      
      if (!icp) {
        throw new Error("No ICP provided to handleICPSelect");
      }
      
      setSelectedICP(icp);
      setRenderError(null); // Clear any previous errors
      
      // Scroll to ICP details section
      const detailsSection = document.getElementById('icp-details-section');
      if (detailsSection) {
        detailsSection.scrollIntoView({
          behavior: 'smooth'
        });
      }
      
      console.log("ICP selection successful");
    } catch (error) {
      console.error("=== ERROR IN ICP SELECTION ===", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setRenderError(`Failed to select ICP: ${errorMessage}`);
      setSelectedICP(null);
    }
  };

  const handleProfilerChatOpen = (message?: string) => {
    setProfilerMessage(message || "I'm Profiler, your ICP research assistant. How can I help you today?");
    setShowProfilerChat(true);
  };

  const handleManualRefresh = () => {
    console.log("=== MANUAL REFRESH TRIGGERED ===");
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRefreshComplete = () => {
    console.log("=== REFRESH COMPLETED ===");
    setIsRefreshing(false);
  };

  // Error boundary pattern
  if (renderError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold">Component Error</h3>
        <p className="text-red-600 text-sm">{renderError}</p>
        <button 
          onClick={() => setRenderError(null)}
          className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug Info */}
      <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
        Debug: selectedICP = {selectedICP ? selectedICP.segment : 'null'} | refreshTrigger = {refreshTrigger} | isRefreshing = {isRefreshing.toString()}
      </div>

      {/* Page Header */}
      <div className="space-y-2">
        
        
      </div>

      {/* Suggested ICPs Gallery */}
      <SuggestedICPsGallery 
        onICPSelect={handleICPSelect} 
        onProfilerChatOpen={handleProfilerChatOpen}
        refreshTrigger={refreshTrigger}
        onManualRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        onRefreshComplete={handleRefreshComplete}
      />

      {/* ICP Details Section */}
      <div id="icp-details-section" className="space-y-6">
        {/* ICP Summary & Market Opportunity Section - Shows when ICP selected */}
        {selectedICP && (
          <div className="mt-4">
            <ICPSummaryOpportunity 
              selectedICP={selectedICP} 
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        
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
