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
              {/* Category label inside the card */}
              <Badge 
                variant={icp.type === 'refined' ? 'secondary' : 'default'} 
                className={`text-xs mb-2 ${icp.type === 'refined' ? 'bg-amber-100 text-amber-800' : 'bg-primary/10 text-primary'}`}
              >
                {icp.type === 'refined' ? (
                  <><RefreshCw className="h-3 w-3 mr-1" />Refined ICP</>
                ) : (
                  <><Plus className="h-3 w-3 mr-1" />New ICP</>
                )}
              </Badge>
              <CardTitle className="text-base font-semibold truncate">{icp.name}</CardTitle>
              {icp.type === 'refined' && icp.sourceICPName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Refined from: {icp.sourceICPName}
                </p>
              )}
              {icp.tag && icp.type === 'new' && (
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

        {/* All ICP Suggestions in Single Row */}
        {refinedICPs.length === 0 && newICPs.length === 0 ? (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="py-8 text-center">
              <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Your current ICPs are well-aligned. No suggestions at this time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {refinedICPs.map(renderSuggestionCard)}
              {newICPs.map(renderSuggestionCard)}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>

      {/* Full-Width ICP Report Panel */}
      {expandedReportId && (() => {
        const allICPs = [...refinedICPs, ...newICPs];
        const expandedICP = allICPs.find(icp => icp.id === expandedReportId);
        const isAccepted = cardStatuses[expandedReportId]?.status === 'accepted';
        
        if (!expandedICP || !isAccepted) return null;
        
        return (
          <Card className="w-full border-primary/20 shadow-lg">
            <ICPReportPanel 
              icp={expandedICP} 
              onClose={() => setExpandedReportId(null)}
            />
          </Card>
        );
      })()}

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

// Editable section with commit/delete controls
interface EditableSectionProps {
  title: string;
  icon?: React.ReactNode;
  isEditing: boolean;
  onCommit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

const EditableSection = ({ title, icon, isEditing, onCommit, onDelete, children }: EditableSectionProps) => {
  const { toast } = useToast();
  
  const handleCommit = () => {
    onCommit();
    toast({
      title: "Changes Saved",
      description: `"${title}" section has been updated.`,
    });
  };
  
  const handleDelete = () => {
    onDelete();
    toast({
      title: "Section Removed",
      description: `"${title}" section has been deleted.`,
      variant: "destructive",
    });
  };
  
  return (
    <Card className={`transition-all ${isEditing ? 'ring-2 ring-primary/20' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {isEditing && (
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={handleCommit}
                title="Commit changes"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                title="Delete section"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className={isEditing ? 'bg-muted/20' : ''}>
        {children}
      </CardContent>
    </Card>
  );
};

const ICPReportPanel = ({ icp, onClose }: ICPReportPanelProps) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  
  // Track visible sections (for delete functionality)
  const [visibleSections, setVisibleSections] = useState({
    profileOverview: true,
    decisionMakers: true,
    painPoints: true,
    competitive: true,
    recommendations: true,
  });
  
  // Editable content state
  const [editableContent, setEditableContent] = useState({
    industry: icp.industry,
    segment: icp.segment,
    companySize: icp.companySize,
    marketSize: icp.marketSize || 'N/A',
    keyAttributes: [...icp.keyAttributes],
    regions: [...icp.regions],
    decisionMakers: [...icp.decisionMakers],
    topPainPoint: icp.topPainPoint || 'Not specified',
    buyingTriggers: [...(icp.buyingTriggers || [])],
    competitors: [...(icp.competitors || [])],
  });
  
  const handleSectionCommit = (sectionName: string) => {
    // In a real app, this would persist changes
    console.log(`Committing changes for section: ${sectionName}`, editableContent);
  };
  
  const handleSectionDelete = (sectionKey: keyof typeof visibleSections) => {
    setVisibleSections(prev => ({ ...prev, [sectionKey]: false }));
  };
  
  const handleToggleEdit = () => {
    if (isEditing) {
      // Exiting edit mode - could auto-save here
      toast({
        title: "Edit Mode Disabled",
        description: "Click Edit to make changes to sections.",
      });
    }
    setIsEditing(!isEditing);
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Report Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold">ICP Report: {icp.name}</h4>
          <p className="text-sm text-muted-foreground">
            {isEditing 
              ? "Click ✔️ to commit changes or ✖️ to delete a section"
              : "Full report generated using accepted ICP context"
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={isEditing ? "default" : "ghost"} 
            size="sm" 
            onClick={handleToggleEdit}
            className={isEditing ? "bg-primary" : ""}
          >
            <Edit className="h-4 w-4 mr-1" />
            {isEditing ? "Done Editing" : "Edit"}
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

      {/* Editing indicator */}
      {isEditing && (
        <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <Edit className="h-4 w-4 text-primary" />
          <span className="text-sm text-primary font-medium">
            Edit Mode: Use ✔️ to save section changes or ✖️ to remove sections
          </span>
        </div>
      )}

      {/* Report Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Overview */}
        {visibleSections.profileOverview && (
          <EditableSection
            title="Profile Overview"
            isEditing={isEditing}
            onCommit={() => handleSectionCommit('profileOverview')}
            onDelete={() => handleSectionDelete('profileOverview')}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Industry</p>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={editableContent.industry}
                      onChange={(e) => setEditableContent(prev => ({ ...prev, industry: e.target.value }))}
                      className="w-full font-medium bg-background border rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <p className="font-medium">{editableContent.industry}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Segment</p>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={editableContent.segment}
                      onChange={(e) => setEditableContent(prev => ({ ...prev, segment: e.target.value }))}
                      className="w-full font-medium bg-background border rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <p className="font-medium">{editableContent.segment}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Company Size</p>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={editableContent.companySize}
                      onChange={(e) => setEditableContent(prev => ({ ...prev, companySize: e.target.value }))}
                      className="w-full font-medium bg-background border rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <p className="font-medium">{editableContent.companySize}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Market Size</p>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={editableContent.marketSize}
                      onChange={(e) => setEditableContent(prev => ({ ...prev, marketSize: e.target.value }))}
                      className="w-full font-medium bg-background border rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <p className="font-medium">{editableContent.marketSize}</p>
                  )}
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Key Attributes</p>
                <div className="flex flex-wrap gap-1">
                  {editableContent.keyAttributes.map((attr, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {attr}
                      {isEditing && (
                        <button
                          onClick={() => setEditableContent(prev => ({
                            ...prev,
                            keyAttributes: prev.keyAttributes.filter((_, i) => i !== idx)
                          }))}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Regions</p>
                <div className="flex flex-wrap gap-1">
                  {editableContent.regions.map((region, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {region}
                      {isEditing && (
                        <button
                          onClick={() => setEditableContent(prev => ({
                            ...prev,
                            regions: prev.regions.filter((_, i) => i !== idx)
                          }))}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </EditableSection>
        )}

        {/* Decision Makers */}
        {visibleSections.decisionMakers && (
          <EditableSection
            title="Key Decision Makers"
            icon={<Users className="h-4 w-4" />}
            isEditing={isEditing}
            onCommit={() => handleSectionCommit('decisionMakers')}
            onDelete={() => handleSectionDelete('decisionMakers')}
          >
            <div className="space-y-2">
              {editableContent.decisionMakers.map((dm, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={dm}
                      onChange={(e) => setEditableContent(prev => ({
                        ...prev,
                        decisionMakers: prev.decisionMakers.map((d, i) => i === idx ? e.target.value : d)
                      }))}
                      className="flex-1 font-medium bg-background border rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <span className="text-sm font-medium">{dm}</span>
                  )}
                  {isEditing && (
                    <button
                      onClick={() => setEditableContent(prev => ({
                        ...prev,
                        decisionMakers: prev.decisionMakers.filter((_, i) => i !== idx)
                      }))}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </EditableSection>
        )}

        {/* Pain Points & Triggers */}
        {visibleSections.painPoints && (
          <EditableSection
            title="Pain Points & Buying Triggers"
            icon={<Target className="h-4 w-4" />}
            isEditing={isEditing}
            onCommit={() => handleSectionCommit('painPoints')}
            onDelete={() => handleSectionDelete('painPoints')}
          >
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Top Pain Point</p>
                {isEditing ? (
                  <input 
                    type="text"
                    value={editableContent.topPainPoint}
                    onChange={(e) => setEditableContent(prev => ({ ...prev, topPainPoint: e.target.value }))}
                    className="w-full font-medium bg-red-50 text-red-700 border border-red-200 rounded px-2 py-2 text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium bg-red-50 text-red-700 p-2 rounded-md">
                    {editableContent.topPainPoint}
                  </p>
                )}
              </div>
              
              {editableContent.buyingTriggers.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Buying Triggers</p>
                  <ul className="space-y-1">
                    {editableContent.buyingTriggers.map((trigger, idx) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        {isEditing ? (
                          <>
                            <input 
                              type="text"
                              value={trigger}
                              onChange={(e) => setEditableContent(prev => ({
                                ...prev,
                                buyingTriggers: prev.buyingTriggers.map((t, i) => i === idx ? e.target.value : t)
                              }))}
                              className="flex-1 bg-background border rounded px-2 py-1 text-sm"
                            />
                            <button
                              onClick={() => setEditableContent(prev => ({
                                ...prev,
                                buyingTriggers: prev.buyingTriggers.filter((_, i) => i !== idx)
                              }))}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          trigger
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </EditableSection>
        )}

        {/* Competitive Landscape */}
        {visibleSections.competitive && (
          <EditableSection
            title="Competitive Landscape"
            isEditing={isEditing}
            onCommit={() => handleSectionCommit('competitive')}
            onDelete={() => handleSectionDelete('competitive')}
          >
            {editableContent.competitors.length > 0 ? (
              <div className="space-y-2">
                {editableContent.competitors.map((competitor, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={competitor}
                        onChange={(e) => setEditableContent(prev => ({
                          ...prev,
                          competitors: prev.competitors.map((c, i) => i === idx ? e.target.value : c)
                        }))}
                        className="flex-1 font-medium bg-background border rounded px-2 py-1 text-sm mr-2"
                      />
                    ) : (
                      <span className="text-sm font-medium">{competitor}</span>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Competitor</Badge>
                      {isEditing && (
                        <button
                          onClick={() => setEditableContent(prev => ({
                            ...prev,
                            competitors: prev.competitors.filter((_, i) => i !== idx)
                          }))}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No competitor data available</p>
            )}
          </EditableSection>
        )}
      </div>

      {/* Recommended Actions */}
      {visibleSections.recommendations && (
        <EditableSection
          title="Recommended Actions"
          isEditing={isEditing}
          onCommit={() => handleSectionCommit('recommendations')}
          onDelete={() => handleSectionDelete('recommendations')}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm font-medium text-blue-800">Prioritize Outreach</p>
              <p className="text-xs text-blue-600 mt-1">
                Focus on {editableContent.decisionMakers[0] || 'key decision makers'} in target companies
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-sm font-medium text-green-800">Content Strategy</p>
              <p className="text-xs text-green-600 mt-1">
                Create content addressing "{editableContent.topPainPoint}"
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-sm font-medium text-purple-800">Monitor Signals</p>
              <p className="text-xs text-purple-600 mt-1">
                Track buying triggers in {editableContent.regions[0] || 'target regions'}
              </p>
            </div>
          </div>
        </EditableSection>
      )}
    </div>
  );
};

export default SuggestedICPCards;
