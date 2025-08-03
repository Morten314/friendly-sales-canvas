
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, TrendingUp, Clock, Target, DollarSign, ChevronDown, ChevronUp, Save, Download, Bot, MessageSquare } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";
import { ICPSummaryOpportunity } from "./ICPSummaryOpportunity";
import { SuggestedICPsGallery } from "./SuggestedICPsGallery";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ICPSection {
  id: string;
  title: string;
  content: string;
  expandedContent: string;
}

export const ICPIntelligence = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [showProfilerChat, setShowProfilerChat] = useState(false);
  const [profilerMessage, setProfilerMessage] = useState("");
  const [selectedICP, setSelectedICP] = useState<any>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    // TODO: Trigger context-specific chat suggestions after saving
  };

  const handleICPSelect = (icp: any) => {
    setSelectedICP(icp);
    setShowFullReport(true);
    
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

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const icpSections: ICPSection[] = [
    {
      id: "market-opportunity",
      title: "Market Opportunity Analysis",
      content: `Total Addressable Market (TAM): $2.4B
Serviceable Addressable Market (SAM): $450M
Growth Rate: 12.3% CAGR`,
      expandedContent: `Detailed market opportunity breakdown:
• Total Addressable Market (TAM): $2.4B globally
• Serviceable Addressable Market (SAM): $450M in target regions
• Serviceable Obtainable Market (SOM): $45M realistic capture
• Growth Rate: 12.3% CAGR over next 5 years
• Key growth drivers: Digital transformation, regulatory changes, increasing demand for automation
• Market maturity: Early growth phase with significant expansion potential
• Competitive density: Medium (15-20 major players)
• Barriers to entry: Moderate (regulatory compliance, technical expertise)`
    },
    {
      id: "customer-profiles",
      title: "Customer Profile & Personas",
      content: `Primary Decision Makers: CTO, VP Engineering
Budget Range: $50K-$200K annually
Implementation Timeline: 3-6 months`,
      expandedContent: `Comprehensive customer analysis:
• Primary Decision Makers: CTO (60%), VP Engineering (25%), Head of Digital (15%)
• Budget Authority: $50K-$200K annually for initial implementation
• Budget Cycle: Q1 and Q3 primary procurement windows
• Implementation Timeline: 3-6 months average deployment
• Key Pain Points: Legacy system integration, scalability concerns, compliance requirements
• Success Metrics: 40% reduction in manual processes, 25% improvement in response time
• Preferred Vendors: Tend to work with 3-5 technology partners
• Communication Channels: Industry conferences, peer recommendations, technical blogs
• Decision Process: Technical evaluation → pilot program → executive approval → procurement`
    },
    {
      id: "competitive-landscape",
      title: "Competitive Landscape",
      content: `Direct Competitors: 3 major players
Market Share: 45% held by top 3
Differentiation Opportunities: 5 key areas identified`,
      expandedContent: `Complete competitive analysis:
• Direct Competitors: CompanyA (20% market share), CompanyB (15%), CompanyC (10%)
• Indirect Competitors: 8 companies with overlapping solutions
• Competitive Strengths: Established brand recognition, extensive partner networks
• Competitive Weaknesses: Legacy architecture, limited customization, high switching costs
• Differentiation Opportunities:
  1. API-first architecture vs. monolithic systems
  2. Industry-specific compliance features
  3. Advanced analytics and reporting
  4. White-glove onboarding experience
  5. Transparent, usage-based pricing
• Pricing Comparison: 15-30% premium over basic solutions, 20% below enterprise alternatives
• Win/Loss Analysis: Win rate improves 40% when competing on technical flexibility`
    },
    {
      id: "go-to-market",
      title: "Go-to-Market Strategy",
      content: `Primary Channels: Direct sales, Partner network
Sales Cycle: 4-6 months average
Key Success Factors: Technical credibility, proof of concept`,
      expandedContent: `Detailed go-to-market approach:
• Primary Channels: Direct sales (70%), Partner network (20%), Inbound marketing (10%)
• Sales Cycle: 4-6 months average, varies by deal size and complexity
• Sales Process: Discovery → Technical demo → Pilot program → Commercial negotiation → Implementation
• Key Success Factors:
  1. Technical credibility through thought leadership
  2. Successful proof of concept implementations
  3. Strong reference customers and case studies
  4. Industry conference presence and speaking opportunities
• Marketing Strategy: Content marketing, webinar series, partner co-marketing
• Sales Enablement: Technical sales training, competitive battle cards, ROI calculators
• Customer Acquisition Cost (CAC): $8,500 average
• Lifetime Value (LTV): $145,000 average
• Payback Period: 14 months average`
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header with Persistent Actions */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">ICP Intelligence</h1>
          <p className="text-gray-600">AI-powered ideal customer profile analysis and insights</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Persistent Profiler Chat Icon */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleProfilerChatOpen()}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-2"
            title="Chat with Profiler"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <MessageSquare className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleEditToggle}>
            <Edit className="h-4 w-4 mr-2" />
            {isEditing ? 'Save' : 'Edit'}
          </Button>
        </div>
      </div>

      {/* Suggested ICPs Gallery - Limited to 5 cards */}
      <SuggestedICPsGallery onICPSelect={handleICPSelect} onProfilerChatOpen={handleProfilerChatOpen} />

      {/* ICP Details Section */}
      <div id="icp-details-section">
        {/* ICP Summary & Market Opportunity Section - Remove placeholder cards */}
        <ICPSummaryOpportunity />

        {/* Full ICP Strategic Report - 4 Section Layout */}
        {showFullReport && selectedICP && (
          <div className="space-y-6 mt-8">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h2 className="text-xl font-semibold">Strategic ICP Report: {selectedICP.segment}</h2>
                <p className="text-gray-600">Comprehensive analysis and strategic recommendations</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save Report
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>

            {/* 4-Section Expandable Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {icpSections.map((section) => (
                <Card key={section.id} className="h-fit">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Collapsible
                      open={expandedSections[section.id]}
                      onOpenChange={() => toggleSection(section.id)}
                    >
                      <div className="space-y-3">
                        <p className="text-sm text-gray-700 whitespace-pre-line">
                          {section.content}
                        </p>
                        
                        <CollapsibleContent className="space-y-3">
                          <div className="border-t pt-3">
                            <p className="text-sm text-gray-700 whitespace-pre-line">
                              {section.expandedContent}
                            </p>
                          </div>
                        </CollapsibleContent>
                        
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full mt-3">
                            {expandedSections[section.id] ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-2" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-2" />
                                Read More
                              </>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </Collapsible>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ICP Battlemap Section */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  ICP Battlemap
                </CardTitle>
                <CardDescription>
                  Analyze competitive landscape and identify buying signals for your ideal customer profiles
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-4">
                <h3 className="font-semibold mb-2">ICP Battlemap</h3>
                <p className="text-sm text-gray-600 mb-4">Map competitive overlaps and positioning strategies</p>
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                  <Target className="h-4 w-4 mr-2" />
                  Analyze Competition
                </Button>
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold mb-2">Buying Signals</h3>
                <p className="text-sm text-gray-600 mb-4">Identify key indicators of purchase intent</p>
                <Button className="w-full" variant="outline">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Find Signals
                </Button>
              </Card>
            </div>
          </CardContent>
        </Card>
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
