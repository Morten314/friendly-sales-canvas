import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  Check, 
  X, 
  Eye, 
  TrendingUp, 
  Building, 
  Users, 
  Target, 
  ChevronDown, 
  ChevronUp,
  Edit,
  Save,
  Download,
  Minimize2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Plus,
  Globe
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface ExistingICP {
  id: string;
  name: string;
  geography?: string;
  industry?: string;
  companySize?: string;
  buyerRole?: string;
  fitConfidence?: string;
  status?: 'active' | 'inactive';
}

interface SuggestedICP {
  id: string;
  name: string;
  type: 'refined' | 'new';
  sourceICPId?: string;
  sourceICPName?: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
  whySuggested: string[];
  whatChanged?: string[];
  opportunityUnlocked?: string;
  confidenceScore: 'High' | 'Medium' | 'Low';
  tag?: string;
  marketSize?: string;
  growth?: string;
  topPainPoint?: string;
  buyingTriggers?: string[];
  competitors?: string[];
}

interface ICPCardStatus {
  status: 'suggested' | 'accepted' | 'rejected';
  acceptedAt?: Date;
  rejectedAt?: Date;
}

interface SuggestedICPCardsProps {
  onICPAccepted?: (icp: SuggestedICP) => void;
  onICPRejected?: (icp: SuggestedICP) => void;
  refreshTrigger?: number;
}

export const SuggestedICPCards = ({ 
  onICPAccepted, 
  onICPRejected, 
  refreshTrigger = 0 
}: SuggestedICPCardsProps) => {
  const { toast } = useToast();
  
  const [existingICPs, setExistingICPs] = useState<ExistingICP[]>([]);
  const [refinedICPs, setRefinedICPs] = useState<SuggestedICP[]>([]);
  const [newICPs, setNewICPs] = useState<SuggestedICP[]>([]);
  const [cardStatuses, setCardStatuses] = useState<Record<string, ICPCardStatus>>({});
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load existing ICPs and generate suggestions
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Load existing ICPs from localStorage (Customer Profile)
      let icps: ExistingICP[] = [];
      try {
        const stored = localStorage.getItem('customerICPs') || localStorage.getItem('missionControlICPs');
        if (stored) {
          icps = JSON.parse(stored);
        }
      } catch (error) {
        console.error('Error loading existing ICPs:', error);
      }
      
      // Default ICPs if none exist
      if (icps.length === 0) {
        icps = [
          {
            id: "existing-1",
            name: "ICP 1",
            geography: "North America",
            industry: "Software & Technology",
            companySize: "100-500 employees",
            buyerRole: "CTO / VP Engineering",
            fitConfidence: "High",
            status: 'active'
          },
          {
            id: "existing-2",
            name: "ICP 2",
            geography: "US, UK",
            industry: "Healthcare",
            companySize: "200-1000 employees",
            buyerRole: "CIO / Chief Digital Officer",
            fitConfidence: "Medium",
            status: 'active'
          }
        ];
      }
      
      setExistingICPs(icps);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate Refined ICPs (improvements to existing)
      const refined: SuggestedICP[] = [
        {
          id: "refined-1",
          name: "Mid-Market SaaS – RevOps Teams",
          type: 'refined',
          sourceICPId: icps[0]?.id,
          sourceICPName: icps[0]?.name || "ICP 1",
          industry: "Software & Technology",
          segment: "RevOps Focus",
          companySize: "100-500 employees",
          regions: ["North America", "UK"],
          decisionMakers: ["VP of RevOps", "Head of Sales Operations", "CRO"],
          keyAttributes: ["High growth stage", "Using Salesforce or HubSpot", "Series B+"],
          whySuggested: [
            "RevOps roles show 3x higher engagement with your content",
            "Faster sales cycles when RevOps is involved early",
            "Higher average deal size in this segment"
          ],
          whatChanged: [
            "Added RevOps focus to buyer roles",
            "Included UK in target regions",
            "Added tech stack qualification criteria"
          ],
          confidenceScore: 'High',
          marketSize: "$45B",
          growth: "+18% YoY",
          topPainPoint: "Sales & marketing alignment",
          buyingTriggers: ["New CRO hire", "Revenue target increase", "Tech stack consolidation"],
          competitors: ["Clari", "Gong", "Outreach"]
        }
      ];
      
      // Generate New ICPs (brand new suggestions)
      const newSuggestions: SuggestedICP[] = [
        {
          id: "new-1",
          name: "Enterprise FinTech Decision Makers",
          type: 'new',
          tag: "New ICP",
          industry: "Financial Services",
          segment: "FinTech",
          companySize: "500-2000 employees",
          regions: ["US", "EU"],
          decisionMakers: ["Chief Digital Officer", "VP of Innovation", "Head of Partnerships"],
          keyAttributes: ["Digital transformation focus", "API-first strategy", "Regulatory compliance needs"],
          whySuggested: [
            "High overlap with your current product capabilities",
            "Growing market with 24% YoY expansion",
            "Lower competition in this segment"
          ],
          opportunityUnlocked: "Access to $2.4B addressable market with strong product-market fit signals",
          confidenceScore: 'Medium',
          marketSize: "$28B",
          growth: "+24% YoY",
          topPainPoint: "Legacy system modernization",
          buyingTriggers: ["Regulatory changes", "Digital transformation initiative", "Competitor pressure"],
          competitors: ["Stripe", "Plaid", "Marqeta"]
        },
        {
          id: "new-2",
          name: "Growth-Stage E-commerce Leaders",
          type: 'new',
          sourceICPName: icps[0]?.name || "ICP 1",
          tag: `Lookalike of ${icps[0]?.name || "ICP 1"}`,
          industry: "E-commerce & Retail",
          segment: "D2C Brands",
          companySize: "50-200 employees",
          regions: ["North America"],
          decisionMakers: ["Head of Growth", "VP of Marketing", "COO"],
          keyAttributes: ["Shopify Plus users", "High ad spend", "Scaling operations"],
          whySuggested: [
            "Similar buying patterns to your best customers",
            "Strong intent signals detected in this segment",
            "Complementary to existing ICP focus"
          ],
          opportunityUnlocked: "Expand into adjacent market with proven playbook from ICP 1",
          confidenceScore: 'High',
          marketSize: "$18B",
          growth: "+22% YoY",
          topPainPoint: "Scaling customer acquisition",
          buyingTriggers: ["Series A+ funding", "New market expansion", "Holiday season prep"],
          competitors: ["Shopify", "Klaviyo", "Attentive"]
        }
      ];
      
      setRefinedICPs(refined);
      setNewICPs(newSuggestions);
      
      // Initialize card statuses
      const initialStatuses: Record<string, ICPCardStatus> = {};
      [...refined, ...newSuggestions].forEach(icp => {
        initialStatuses[icp.id] = { status: 'suggested' };
      });
      setCardStatuses(initialStatuses);
      
      setLoading(false);
    };
    
    loadData();
  }, [refreshTrigger]);

  const handleAcceptICP = (icp: SuggestedICP) => {
    setCardStatuses(prev => ({
      ...prev,
      [icp.id]: { status: 'accepted', acceptedAt: new Date() }
    }));
    
    onICPAccepted?.(icp);
    
    toast({
      title: "ICP Accepted",
      description: `"${icp.name}" has been added to your Customer Profile.`,
    });
  };

  const handleRejectICP = (icp: SuggestedICP) => {
    setCardStatuses(prev => ({
      ...prev,
      [icp.id]: { status: 'rejected', rejectedAt: new Date() }
    }));
    
    onICPRejected?.(icp);
    
    toast({
      title: "ICP Rejected",
      description: `"${icp.name}" has been dismissed.`,
      variant: "destructive",
    });
  };

  const handleViewDetails = (icpId: string) => {
    setExpandedReportId(expandedReportId === icpId ? null : icpId);
  };

  const getConfidenceBadgeVariant = (confidence: string): "default" | "secondary" | "outline" => {
    switch (confidence) {
      case 'High': return 'default';
      case 'Medium': return 'secondary';
      case 'Low': return 'outline';
      default: return 'outline';
    }
  };

  const pendingRefinedCount = refinedICPs.filter(icp => cardStatuses[icp.id]?.status === 'suggested').length;
  const pendingNewCount = newICPs.filter(icp => cardStatuses[icp.id]?.status === 'suggested').length;

  // Render a suggestion card (used for both refined and new ICPs)
  const renderSuggestionCard = (icp: SuggestedICP) => {
    const status = cardStatuses[icp.id] || { status: 'suggested' };
    const isExpanded = expandedReportId === icp.id;
    const isRejected = status.status === 'rejected';
    const isAccepted = status.status === 'accepted';
    
    return (
      <Card 
        key={icp.id} 
        className={`min-w-[340px] max-w-[360px] flex-shrink-0 transition-all duration-300 ${
          isAccepted ? 'border-green-200 bg-green-50/30' :
          isRejected ? 'opacity-50 border-muted' : ''
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold truncate">{icp.name}</CardTitle>
              {icp.type === 'refined' && icp.sourceICPName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Refined from: {icp.sourceICPName}
                </p>
              )}
              {icp.tag && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {icp.tag}
                </Badge>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={getConfidenceBadgeVariant(icp.confidenceScore)} className="text-xs">
                {icp.confidenceScore}
              </Badge>
              {isAccepted && (
                <Badge className="bg-green-600 text-xs">Accepted</Badge>
              )}
              {isRejected && (
                <Badge variant="secondary" className="text-xs">Rejected</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3 pb-3">
          {/* Why Suggested */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Why Suggested</p>
            <ul className="space-y-1">
              {icp.whySuggested.slice(0, 3).map((reason, idx) => (
                <li key={idx} className="text-xs flex items-start gap-1.5">
                  <Check className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* What Changed (for refined) or Opportunity (for new) */}
          {icp.type === 'refined' && icp.whatChanged && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">What Changed</p>
              <ul className="space-y-1">
                {icp.whatChanged.slice(0, 2).map((change, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-1.5">
                    <RefreshCw className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {icp.type === 'new' && icp.opportunityUnlocked && (
            <div className="bg-primary/5 rounded-md p-2">
              <p className="text-xs font-medium text-primary mb-0.5">Opportunity Unlocked</p>
              <p className="text-xs">{icp.opportunityUnlocked}</p>
            </div>
          )}

          {/* Status Message for Accepted */}
          {isAccepted && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-100 rounded-md p-2">
              <Check className="h-3 w-3" />
              <span>Added to Customer Profile</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-3 border-t flex flex-col gap-2">
          {/* Actions for Suggested */}
          {status.status === 'suggested' && (
            <div className="flex items-center gap-2 w-full">
              <Button
                size="sm"
                onClick={() => handleAcceptICP(icp)}
                className="flex-1"
              >
                <Check className="h-3 w-3 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRejectICP(icp)}
                className="flex-1"
              >
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          )}
          
          {/* Post-Accept: View ICP Details (only shown after acceptance) */}
          {isAccepted && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleViewDetails(icp.id)}
              className="w-full"
            >
              <Eye className="h-3 w-3 mr-1" />
              View ICP Details
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-auto" />
              )}
            </Button>
          )}
        </CardFooter>
        
        {/* Expanded Report */}
        {isAccepted && isExpanded && (
          <div className="border-t bg-muted/20">
            <ICPReportPanel 
              icp={icp} 
              onClose={() => setExpandedReportId(null)}
            />
          </div>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-muted rounded-lg" />
        <div className="h-48 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Current ICPs from Customer Profile */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Current ICPs
        </h3>
        <div className="flex flex-wrap gap-3">
          {existingICPs.map((icp) => (
            <Card key={icp.id} className="inline-flex items-center gap-3 px-4 py-3 bg-card">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-medium">{icp.name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{icp.industry}</span>
                <span>·</span>
                <span>{icp.companySize}</span>
                <span>·</span>
                <span>{icp.geography}</span>
              </div>
              <Badge variant="default" className="bg-green-600 text-xs">
                Active
              </Badge>
            </Card>
          ))}
        </div>
      </div>

      {/* Section 2: Profiler Suggestions */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Profiler Suggestions
          </h2>
          <p className="text-sm text-muted-foreground">
            Based on your existing ICPs and available signals
          </p>
        </div>

        {/* 2A: Refined ICPs */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-500" />
            <h4 className="text-sm font-medium">Refined ICPs</h4>
            {pendingRefinedCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {pendingRefinedCount} pending
              </Badge>
            )}
          </div>
          
          {refinedICPs.length === 0 ? (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-8 text-center">
                <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Your current ICPs are well-aligned. No refinements suggested.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4">
                {refinedICPs.map(renderSuggestionCard)}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </div>

        {/* 2B: New ICPs */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">New ICPs</h4>
            {pendingNewCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {pendingNewCount} pending
              </Badge>
            )}
          </div>
          
          {newICPs.length === 0 ? (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-8 text-center">
                <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No new ICP suggestions at this time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4">
                {newICPs.map(renderSuggestionCard)}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Design Note */}
      <div className="text-xs text-muted-foreground text-center p-3 bg-muted/30 rounded-lg border border-dashed">
        <span className="font-medium">UX Principle:</span> Reports only update when an ICP is accepted. 
        Suggestions never alter system context by themselves.
      </div>
    </div>
  );
};

// ICP Report Panel Component
interface ICPReportPanelProps {
  icp: SuggestedICP;
  onClose: () => void;
}

const ICPReportPanel = ({ icp, onClose }: ICPReportPanelProps) => {
  const [isEditing, setIsEditing] = useState(false);
  
  return (
    <div className="p-6 space-y-6">
      {/* Report Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold">ICP Report: {icp.name}</h4>
          <p className="text-sm text-muted-foreground">
            Full report generated using accepted ICP context
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="ghost" size="sm">
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button variant="ghost" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profile Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Industry</p>
                <p className="font-medium">{icp.industry}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Segment</p>
                <p className="font-medium">{icp.segment}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Company Size</p>
                <p className="font-medium">{icp.companySize}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Market Size</p>
                <p className="font-medium">{icp.marketSize || 'N/A'}</p>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Key Attributes</p>
              <div className="flex flex-wrap gap-1">
                {icp.keyAttributes.map((attr, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {attr}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Regions</p>
              <div className="flex flex-wrap gap-1">
                {icp.regions.map((region, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {region}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Decision Makers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Key Decision Makers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {icp.decisionMakers.map((dm, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{dm}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pain Points & Triggers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Pain Points & Buying Triggers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Top Pain Point</p>
              <p className="text-sm font-medium bg-red-50 text-red-700 p-2 rounded-md">
                {icp.topPainPoint || 'Not specified'}
              </p>
            </div>
            
            {icp.buyingTriggers && icp.buyingTriggers.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Buying Triggers</p>
                <ul className="space-y-1">
                  {icp.buyingTriggers.map((trigger, idx) => (
                    <li key={idx} className="text-sm flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      {trigger}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competitive Landscape */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Competitive Landscape</CardTitle>
          </CardHeader>
          <CardContent>
            {icp.competitors && icp.competitors.length > 0 ? (
              <div className="space-y-2">
                {icp.competitors.map((competitor, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                    <span className="text-sm font-medium">{competitor}</span>
                    <Badge variant="outline" className="text-xs">Competitor</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No competitor data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommended Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recommended Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm font-medium text-blue-800">Prioritize Outreach</p>
              <p className="text-xs text-blue-600 mt-1">
                Focus on {icp.decisionMakers[0] || 'key decision makers'} in target companies
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-sm font-medium text-green-800">Content Strategy</p>
              <p className="text-xs text-green-600 mt-1">
                Create content addressing "{icp.topPainPoint || 'key pain points'}"
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-sm font-medium text-purple-800">Monitor Signals</p>
              <p className="text-xs text-purple-600 mt-1">
                Track buying triggers in {icp.regions[0] || 'target regions'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuggestedICPCards;
