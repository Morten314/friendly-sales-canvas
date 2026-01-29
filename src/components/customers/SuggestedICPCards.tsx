import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { profilerCache } from "@/lib/profilerCache";

interface SuggestedICP {
  id: string;
  name: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
  // Suggestion-specific fields
  whySuggested?: string[];
  differenceFromCurrent?: string[];
  confidenceScore?: 'High' | 'Medium' | 'Low';
  // Report data
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
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  const [suggestedICPs, setSuggestedICPs] = useState<SuggestedICP[]>([]);
  const [cardStatuses, setCardStatuses] = useState<Record<string, ICPCardStatus>>({});
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(3);

  // Generate sample suggested ICPs (in production, fetch from API)
  useEffect(() => {
    const fetchSuggestedICPs = async () => {
      setLoading(true);
      
      // Simulate API call - in production, replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const sampleICPs: SuggestedICP[] = [
        {
          id: "suggested-1",
          name: "Enterprise SaaS Decision Makers",
          industry: "Software & Technology",
          segment: "Enterprise B2B SaaS",
          companySize: "500-2000 employees",
          decisionMakers: ["CTO", "VP of Engineering", "Chief Digital Officer"],
          regions: ["North America", "Western Europe"],
          keyAttributes: ["Cloud-first strategy", "API-driven architecture", "DevOps culture"],
          growthIndicator: "High",
          whySuggested: [
            "Matches your strategic goals for enterprise expansion",
            "High alignment with your product capabilities",
            "Strong market demand in this segment"
          ],
          differenceFromCurrent: [
            "Larger company size than current ICP (500-2000 vs 100-500)",
            "Focus on DevOps culture as key attribute",
            "Added Chief Digital Officer as decision maker"
          ],
          confidenceScore: "High",
          marketSize: "$45B",
          growth: "+18% YoY",
          topPainPoint: "Legacy system modernization",
          buyingTriggers: ["Digital transformation initiative", "Cloud migration project", "New CTO hire"],
          competitors: ["Salesforce", "HubSpot", "Microsoft Dynamics"]
        },
        {
          id: "suggested-2",
          name: "Healthcare Tech Innovators",
          industry: "Healthcare Technology",
          segment: "Digital Health Platforms",
          companySize: "100-500 employees",
          decisionMakers: ["Chief Medical Officer", "VP of Product", "Head of Compliance"],
          regions: ["US", "UK", "Germany"],
          keyAttributes: ["HIPAA Compliance", "Interoperability focus", "Patient-centric design"],
          growthIndicator: "High",
          whySuggested: [
            "Emerging vertical with strong growth potential",
            "Regulatory expertise creates competitive moat",
            "Aligned with industry trends in digital health"
          ],
          differenceFromCurrent: [
            "New vertical not in current ICP portfolio",
            "Compliance-heavy buying process",
            "Longer sales cycle but higher contract values"
          ],
          confidenceScore: "Medium",
          marketSize: "$32B",
          growth: "+22% YoY",
          topPainPoint: "Data interoperability challenges",
          buyingTriggers: ["EHR integration needs", "Telehealth expansion", "Value-based care transition"],
          competitors: ["Epic", "Cerner", "Veeva"]
        },
        {
          id: "suggested-3",
          name: "Fintech Scale-ups",
          industry: "Financial Services",
          segment: "Payment & Banking Tech",
          companySize: "50-200 employees",
          decisionMakers: ["CTO", "Head of Compliance", "VP of Product"],
          regions: ["US", "UK", "Singapore"],
          keyAttributes: ["API-first architecture", "Real-time processing", "Regulatory compliance"],
          growthIndicator: "High",
          whySuggested: [
            "Fast-growing segment with urgent needs",
            "Technical sophistication matches your offering",
            "High willingness to pay for quality solutions"
          ],
          differenceFromCurrent: [
            "Smaller company size with faster decision cycles",
            "More aggressive growth targets",
            "Singapore added as key region"
          ],
          confidenceScore: "High",
          marketSize: "$28B",
          growth: "+25% YoY",
          topPainPoint: "Scaling infrastructure",
          buyingTriggers: ["Series B+ funding", "New market expansion", "Regulatory changes"],
          competitors: ["Stripe", "Plaid", "Marqeta"]
        },
        {
          id: "suggested-4",
          name: "Manufacturing Innovators",
          industry: "Manufacturing",
          segment: "Smart Manufacturing",
          companySize: "1000-5000 employees",
          decisionMakers: ["COO", "VP of Operations", "Chief Supply Chain Officer"],
          regions: ["US", "Germany", "Japan"],
          keyAttributes: ["Industry 4.0 adoption", "IoT integration", "Supply chain visibility"],
          growthIndicator: "Medium",
          whySuggested: [
            "Underserved market with growing digital needs",
            "High-value, long-term contracts typical",
            "Government incentives driving adoption"
          ],
          differenceFromCurrent: [
            "Traditional industry with digital transformation focus",
            "Different buyer personas than current ICPs",
            "Longer implementation cycles"
          ],
          confidenceScore: "Medium",
          marketSize: "$52B",
          growth: "+12% YoY",
          topPainPoint: "Supply chain disruption",
          buyingTriggers: ["Factory automation initiative", "Sustainability goals", "Supply chain crisis"],
          competitors: ["Siemens", "Rockwell", "PTC"]
        },
        {
          id: "suggested-5",
          name: "EdTech Disruptors",
          industry: "Education Technology",
          segment: "Corporate Learning Platforms",
          companySize: "100-500 employees",
          decisionMakers: ["Chief Learning Officer", "VP of HR", "Head of L&D"],
          regions: ["North America", "Europe", "APAC"],
          keyAttributes: ["AI-powered learning", "Skills gap analysis", "Integration with HRIS"],
          growthIndicator: "Medium",
          whySuggested: [
            "Post-pandemic boom in corporate learning",
            "Recurring revenue model alignment",
            "Low market saturation in enterprise segment"
          ],
          differenceFromCurrent: [
            "HR buyer persona vs IT buyers",
            "Different success metrics (learning outcomes)",
            "Stronger emphasis on content partnerships"
          ],
          confidenceScore: "Low",
          marketSize: "$18B",
          growth: "+15% YoY",
          topPainPoint: "Measuring learning ROI",
          buyingTriggers: ["Remote workforce expansion", "Skills gap assessment", "New L&D budget cycle"],
          competitors: ["Coursera", "LinkedIn Learning", "Udemy Business"]
        }
      ];
      
      setSuggestedICPs(sampleICPs);
      
      // Initialize statuses
      const initialStatuses: Record<string, ICPCardStatus> = {};
      sampleICPs.forEach(icp => {
        initialStatuses[icp.id] = { status: 'suggested' };
      });
      setCardStatuses(initialStatuses);
      
      setLoading(false);
    };
    
    fetchSuggestedICPs();
  }, [refreshTrigger]);

  const handleAcceptICP = (icp: SuggestedICP) => {
    setCardStatuses(prev => ({
      ...prev,
      [icp.id]: { status: 'accepted', acceptedAt: new Date() }
    }));
    
    // Add to customer profile (emit event for parent to handle)
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

  const getConfidenceBadgeColor = (confidence?: 'High' | 'Medium' | 'Low') => {
    switch (confidence) {
      case 'High':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadge = (status: ICPCardStatus) => {
    switch (status.status) {
      case 'accepted':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <Check className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
            <X className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-3 w-3 mr-1" />
            Suggested
          </Badge>
        );
    }
  };

  const visibleICPs = suggestedICPs.slice(0, visibleCount);
  const hasMore = suggestedICPs.length > visibleCount;

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading suggested ICPs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Suggested ICP Cards
          </h3>
          <p className="text-sm text-muted-foreground">
            AI-generated ICP suggestions based on your company profile
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {suggestedICPs.filter(icp => cardStatuses[icp.id]?.status === 'suggested').length} pending
        </Badge>
      </div>

      {/* ICP Cards Grid */}
      <div className="space-y-4">
        {visibleICPs.map((icp) => {
          const status = cardStatuses[icp.id] || { status: 'suggested' };
          const isExpanded = expandedReportId === icp.id;
          const isRejected = status.status === 'rejected';
          
          return (
            <Card 
              key={icp.id} 
              className={`transition-all duration-300 ${
                isRejected ? 'opacity-50 bg-muted/30' : ''
              } ${status.status === 'accepted' ? 'border-green-200 bg-green-50/30' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(status)}
                      <Badge variant="outline" className={getConfidenceBadgeColor(icp.confidenceScore)}>
                        {icp.confidenceScore || 'Medium'} Match
                      </Badge>
                    </div>
                    <CardTitle className="text-lg truncate">{icp.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Building className="h-3 w-3" />
                      {icp.industry} • {icp.segment}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className={`h-4 w-4 ${
                      icp.growthIndicator === 'High' ? 'text-green-600' : 'text-yellow-600'
                    }`} />
                    <span className="text-sm font-medium">{icp.growth}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-3 space-y-4">
                {/* Why Suggested */}
                {icp.whySuggested && icp.whySuggested.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      Why This ICP is Suggested
                    </p>
                    <ul className="space-y-1">
                      {icp.whySuggested.map((reason, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* What's Different */}
                {icp.differenceFromCurrent && icp.differenceFromCurrent.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      What's Different from Current ICP
                    </p>
                    <ul className="space-y-1">
                      {icp.differenceFromCurrent.map((diff, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{diff}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Market Size</p>
                    <p className="text-sm font-semibold">{icp.marketSize || 'N/A'}</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Growth</p>
                    <p className="text-sm font-semibold text-green-600">{icp.growth || 'N/A'}</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Company Size</p>
                    <p className="text-sm font-semibold">{icp.companySize}</p>
                  </div>
                </div>

                {/* Status Message for Accepted */}
                {status.status === 'accepted' && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 rounded-md p-2">
                    <Check className="h-4 w-4" />
                    <span>Added to Customer Profile</span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-3 border-t flex flex-wrap gap-2">
                {status.status === 'suggested' && (
                  <>
                    <Button 
                      size="sm" 
                      onClick={() => handleAcceptICP(icp)}
                      className="flex-1 min-w-[100px]"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept ICP
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRejectICP(icp)}
                      className="flex-1 min-w-[100px]"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject ICP
                    </Button>
                  </>
                )}
                
                {(status.status === 'accepted' || status.status === 'rejected') && (
                  <Button 
                    size="sm" 
                    variant={status.status === 'accepted' ? 'default' : 'outline'}
                    onClick={() => handleViewDetails(icp.id)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View ICP Details
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 ml-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-1" />
                    )}
                  </Button>
                )}
              </CardFooter>

              {/* Expanded Report View */}
              {isExpanded && (
                <div className="border-t bg-muted/20">
                  <ICPReportPanel 
                    icp={icp} 
                    status={status}
                    onClose={() => setExpandedReportId(null)}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Load More / Show Less */}
      {suggestedICPs.length > 3 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount(hasMore ? suggestedICPs.length : 3)}
          >
            {hasMore ? (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show {suggestedICPs.length - visibleCount} More
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show Less
              </>
            )}
          </Button>
        </div>
      )}

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
  status: ICPCardStatus;
  onClose: () => void;
}

const ICPReportPanel = ({ icp, status, onClose }: ICPReportPanelProps) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const isAccepted = status.status === 'accepted';
  
  return (
    <div className="p-6 space-y-6">
      {/* Report Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold">
            {isAccepted ? 'Accepted ICP Report' : 'Existing ICP Report'}
          </h4>
          <p className="text-sm text-muted-foreground">
            {isAccepted 
              ? 'Full report generated using newly accepted ICP context'
              : 'Report based on last accepted ICP configuration'
            }
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
