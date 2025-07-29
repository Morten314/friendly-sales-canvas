
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Bot, Users, Building, MapPin, Target, ChevronDown, ChevronUp } from "lucide-react";
import { ICPListView } from "./ICPListView";
import { ICPCardView } from "./ICPCardView";
import { ICPDetailsReport } from "./ICPDetailsReport";
import { ProfilerChatPanel } from "./ProfilerChatPanel";

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

export const ICPIntelligence = () => {
  const [selectedICPId, setSelectedICPId] = useState<string | null>(null);
  const [showICPDetails, setShowICPDetails] = useState(false);
  const [showProfilerChat, setShowProfilerChat] = useState(false);
  const [chatContext, setChatContext] = useState<any>(null);

  const suggestedICPs: SuggestedICP[] = [
    {
      id: "global-neobanks",
      name: "Global Neobanks",
      industry: "FinTech",
      segment: "Mid-market",
      companySize: "50–200 employees",
      geography: "North America, DACH",
      leadCount: 415,
      decisionMakers: ["CTO", "Head of Digital"],
      keyAttributes: ["High cloud adoption", "Regulatory compliance focus"],
      growthIndicator: "5.6% CAGR"
    },
    {
      id: "healthcare-saas",
      name: "Healthcare SaaS Platforms",
      industry: "Healthcare",
      segment: "Enterprise",
      companySize: "100–500 employees",
      geography: "North America, EU",
      leadCount: 287,
      decisionMakers: ["Chief Medical Officer", "IT Director"],
      keyAttributes: ["HIPAA compliance", "AI/ML integration"],
      growthIndicator: "8.2% CAGR"
    },
    {
      id: "logistics-tech",
      name: "Last-Mile Delivery Tech",
      industry: "Logistics",
      segment: "Growth-stage",
      companySize: "200–800 employees",
      geography: "SEA, North America",
      leadCount: 342,
      decisionMakers: ["VP Operations", "CTO"],
      keyAttributes: ["Real-time tracking", "API-first approach"],
      growthIndicator: "12.1% CAGR"
    },
    {
      id: "edtech-platforms",
      name: "Learning Management Systems",
      industry: "EdTech",
      segment: "Mid-market",
      companySize: "80–300 employees",
      geography: "Global, LATAM",
      leadCount: 198,
      decisionMakers: ["Chief Academic Officer", "IT Manager"],
      keyAttributes: ["Mobile-first", "Analytics-driven"],
      growthIndicator: "9.4% CAGR"
    },
    {
      id: "proptech-crm",
      name: "Real Estate CRM Solutions",
      industry: "PropTech",
      segment: "Enterprise",
      companySize: "150–600 employees",
      geography: "North America, ANZ",
      leadCount: 156,
      decisionMakers: ["VP Sales", "Technology Director"],
      keyAttributes: ["Integration capabilities", "Workflow automation"],
      growthIndicator: "6.8% CAGR"
    },
    {
      id: "cybersecurity-startups",
      name: "Zero Trust Security",
      industry: "Cybersecurity",
      segment: "Growth-stage",
      companySize: "75–400 employees",
      geography: "North America, EU",
      leadCount: 523,
      decisionMakers: ["CISO", "VP Engineering"],
      keyAttributes: ["SOC 2 compliance", "Cloud-native architecture"],
      growthIndicator: "15.3% CAGR"
    }
  ];

  const selectedICP = suggestedICPs.find(icp => icp.id === selectedICPId);

  const handleICPSelect = (icpId: string) => {
    setSelectedICPId(icpId);
    setShowICPDetails(false);
  };

  const handleViewDetails = () => {
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

  const handleEditComplete = () => {
    setChatContext({
      cardId: selectedICPId,
      cardName: selectedICP?.name,
      action: 'edit'
    });
    setShowProfilerChat(true);
  };

  const handleResetSelection = () => {
    setSelectedICPId(null);
    setShowICPDetails(false);
  };

  const handleProfilerChatOpen = (context?: any) => {
    setChatContext(context || { action: 'general' });
    setShowProfilerChat(true);
  };

  const handleDetailsProfilerChat = (context: any) => {
    setChatContext(context);
    setShowProfilerChat(true);
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Top Bar - Sticky */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Suggested ICPs</h2>
            <p className="text-gray-600">
              Agent-curated ideal customer profiles based on your product and market patterns
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              title="Agent Settings"
            >
              <Settings className="h-4 w-4" />
              Agent Settings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleProfilerChatOpen()}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-2"
              title="Explore with Profiler"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              Profiler
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - ICP List */}
        <div>
          <ICPListView 
            icps={suggestedICPs}
            selectedId={selectedICPId}
            onSelect={handleICPSelect}
          />
        </div>

        {/* Right Column - ICP Card or Placeholder */}
        <div className="min-h-[400px]">
          {selectedICP ? (
            <ICPCardView 
              icp={selectedICP}
              onViewDetails={handleViewDetails}
              onEditComplete={handleEditComplete}
              onReset={handleResetSelection}
            />
          ) : (
            <Card className="h-full border-2 border-dashed border-gray-200 bg-gray-50/50">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select an ICP from the list to explore
                  </h3>
                  <p className="text-gray-600">
                    Choose an ideal customer profile to view detailed insights and analysis
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ICP Details Report - Expands Below */}
      {showICPDetails && selectedICP && (
        <div id="icp-details-section">
          <ICPDetailsReport 
            icp={selectedICP}
            onClose={() => setShowICPDetails(false)}
            onProfilerChatOpen={handleDetailsProfilerChat}
          />
        </div>
      )}

      {/* Profiler Chat Panel */}
      <ProfilerChatPanel 
        isOpen={showProfilerChat}
        onClose={() => setShowProfilerChat(false)}
        context={chatContext}
      />
    </div>
  );
};
