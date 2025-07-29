
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronUp, 
  Target, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Shield, 
  Edit, 
  Bot, 
  Save, 
  FileDown, 
  Link,
  ChevronDown,
  Info,
  Building,
  MapPin,
  AlertCircle
} from "lucide-react";
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
  onProfilerChatOpen?: (context: any) => void;
}

export const ICPDetailsReport = ({ icp, onClose, onProfilerChatOpen }: ICPDetailsReportProps) => {
  const [editMode, setEditMode] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<string[]>([
    'summary-opportunity', 
    'buyer-map', 
    'competitive', 
    'regulatory'
  ]);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleEdit = (sectionId: string) => {
    setEditMode(sectionId);
  };

  const handleSaveEdit = (sectionId: string) => {
    setEditMode(null);
    // Trigger Profiler chat with edit context
    onProfilerChatOpen?.({
      action: 'edit',
      section: sectionId,
      icpName: icp.name,
      context: `User edited the ${sectionId} section of ${icp.name} ICP`
    });
  };

  const handleProfilerChat = (section?: string) => {
    onProfilerChatOpen?.({
      action: 'explore',
      icpName: icp.name,
      section: section || 'general',
      context: `Exploring ${icp.name} ICP${section ? ` - ${section} section` : ''}`
    });
  };

  return (
    <div className="animate-fade-in border-t border-gray-200 pt-6 bg-gray-50/30">
      {/* Report Header with Actions */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-lg p-4 border border-gray-200">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            ICP Intelligence: {icp.name}
          </h3>
          <p className="text-gray-600 text-sm">
            Comprehensive analysis and strategic recommendations
          </p>
        </div>
        
        {/* Action Icons */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => handleProfilerChat()}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
            title="Explore with Profiler"
          >
            <Bot className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-gray-600 hover:text-gray-700 flex items-center gap-1"
            title="Save to Workspace"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-gray-600 hover:text-gray-700 flex items-center gap-1"
            title="Export PDF"
          >
            <FileDown className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-gray-600 hover:text-gray-700 flex items-center gap-1"
            title="Generate Shareable Link"
          >
            <Link className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onClose}
            className="flex items-center gap-1 ml-2"
          >
            <ChevronUp className="h-4 w-4" />
            Show Less
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Section 1: ICP Summary & Market Opportunity */}
        <Collapsible 
          open={openSections.includes('summary-opportunity')}
          onOpenChange={() => toggleSection('summary-opportunity')}
        >
          <Card className="border border-gray-200 bg-white">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    ICP Summary & Market Opportunity
                    <Info className="h-4 w-4 text-gray-400" title="Market sizing and ICP overview" />
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleEdit('summary-opportunity'); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleProfilerChat('summary-opportunity'); }}
                    >
                      <Bot className="h-4 w-4 text-blue-600" />
                    </Button>
                    <ChevronDown className="h-4 w-4 text-gray-600 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </div>
                </div>
                <CardDescription className="text-sm">
                  Market sizing, revenue potential, and strategic overview for {icp.industry} segment
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ICPSummaryOpportunity selectedICP={icp} isEditMode={editMode === 'summary-opportunity'} />
                
                {/* Strategic Recommendations */}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Strategic Recommendations
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
                    <div>• Target {icp.geography} markets first for easier market entry</div>
                    <div>• Focus on {icp.segment} companies with {icp.companySize}</div>
                    <div>• Leverage {icp.keyAttributes[0]} as key differentiator</div>
                    <div>• Engage {icp.decisionMakers[0]} as primary decision maker</div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Section 2: Buyer Map & Pain Points */}
        <Collapsible 
          open={openSections.includes('buyer-map')}
          onOpenChange={() => toggleSection('buyer-map')}
        >
          <Card className="border border-gray-200 bg-white group">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    Buyer Map & Pain Points
                    <Info className="h-4 w-4 text-gray-400" title="Decision makers and buying triggers" />
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleEdit('buyer-map'); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleProfilerChat('buyer-map'); }}
                    >
                      <Bot className="h-4 w-4 text-blue-600" />
                    </Button>
                    <ChevronDown className="h-4 w-4 text-gray-600 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </div>
                </div>
                <CardDescription className="text-sm">
                  Key stakeholders, pain points, and buying triggers in {icp.segment} organizations
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      Decision Makers
                    </h4>
                    <div className="space-y-2">
                      {icp.decisionMakers.map((role, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                          <span>{role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      Pain Points
                    </h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                        Legacy system integration
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                        Regulatory compliance costs
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                        Scaling operational efficiency
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Buying Triggers
                    </h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        New regulations
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        Growth milestones
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        Tech modernization
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strategic Recommendations */}
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-purple-900 mb-2">Key Insights</h4>
                  <div className="text-sm text-purple-800">
                    <strong>Primary Approach:</strong> Target {icp.decisionMakers[0]} with ROI-focused messaging around {icp.keyAttributes[0]}.
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Section 3: Competitive Landscape */}
        <Collapsible 
          open={openSections.includes('competitive')}
          onOpenChange={() => toggleSection('competitive')}
        >
          <Card className="border border-gray-200 bg-white group">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Competitive Landscape
                    <Info className="h-4 w-4 text-gray-400" title="Market positioning and competitive analysis" />
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleEdit('competitive'); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleProfilerChat('competitive'); }}
                    >
                      <Bot className="h-4 w-4 text-blue-600" />
                    </Button>
                    <ChevronDown className="h-4 w-4 text-gray-600 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </div>
                </div>
                <CardDescription className="text-sm">
                  Market positioning, competitive overlap, and buying signals analysis
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Market Position</h4>
                      <p className="text-sm text-gray-600">
                        <strong>Opportunity Level:</strong> High in {icp.geography} markets with medium competition
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Competitive Overlap</h4>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-12 h-2 bg-yellow-400 rounded-full"></div>
                        <span>Medium (3-5 direct competitors)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Buying Signals to Monitor</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Building className="h-3 w-3" />
                        Job postings for technical roles
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3" />
                        Partnership announcements
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3 w-3" />
                        Funding or expansion news
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strategic Recommendations */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">Competitive Strategy</h4>
                  <div className="text-sm text-blue-800">
                    <strong>Differentiation Focus:</strong> Emphasize {icp.keyAttributes[0]} and regulatory expertise in {icp.geography} markets.
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Section 4: Regulatory & Compliance */}
        <Collapsible 
          open={openSections.includes('regulatory')}
          onOpenChange={() => toggleSection('regulatory')}
        >
          <Card className="border border-gray-200 bg-white group">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    Regulatory & Compliance
                    <Info className="h-4 w-4 text-gray-400" title="Compliance requirements and recommendations" />
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleEdit('regulatory'); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleProfilerChat('regulatory'); }}
                    >
                      <Bot className="h-4 w-4 text-blue-600" />
                    </Button>
                    <ChevronDown className="h-4 w-4 text-gray-600 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </div>
                </div>
                <CardDescription className="text-sm">
                  Industry-specific compliance requirements and strategic recommendations
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Key Requirements</h4>
                    <div className="space-y-2">
                      {icp.keyAttributes.map((attribute, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Shield className="h-3 w-3 text-green-600" />
                          <span>{attribute}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Market Entry Actions</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        Focus on {icp.geography} first
                      </div>
                      <div className="flex items-center gap-2">
                        <Building className="h-3 w-3" />
                        Build regulatory partnerships
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="h-3 w-3" />
                        Create compliance case studies
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strategic Recommendations */}
                <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-2">Compliance Strategy</h4>
                  <div className="text-sm text-green-800">
                    <strong>Priority:</strong> Develop {icp.keyAttributes[0]} expertise and create region-specific compliance messaging for {icp.geography}.
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-center pt-6 pb-2">
        <Button 
          variant="outline"
          onClick={onClose}
          className="flex items-center gap-2 px-8"
        >
          <ChevronUp className="h-4 w-4" />
          Show Less
        </Button>
      </div>
    </div>
  );
};
