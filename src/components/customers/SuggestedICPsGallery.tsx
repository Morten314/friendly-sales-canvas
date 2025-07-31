
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Globe, TrendingUp, Users, Building, MapPin, Target, Bot, MessageSquare, Edit, Save, X, Check } from "lucide-react";
import { ProfilerChatPanel } from "./ProfilerChatPanel";
import { ICPEditHistory } from "./ICPEditHistory";
import { useToast } from "@/hooks/use-toast";

interface SuggestedICP {
  id: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
}

interface SuggestedICPsGalleryProps {
  onICPSelect?: (icp: SuggestedICP) => void;
  onProfilerChatOpen?: (context?: string) => void;
}

export const SuggestedICPsGallery = ({ onICPSelect, onProfilerChatOpen }: SuggestedICPsGalleryProps) => {
  const [selectedICP, setSelectedICP] = useState<string | null>(null);
  const [editingICP, setEditingICP] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<any>(null);
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({});
  const { toast } = useToast();

  const [suggestedICPs, setSuggestedICPs] = useState<SuggestedICP[]>([
    {
      id: "fintech-neobanks",
      industry: "Fintech",
      segment: "Neobanks",
      companySize: "50–200 employees",
      decisionMakers: ["CTO", "Head of Digital"],
      regions: ["North America", "DACH"],
      keyAttributes: ["High cloud adoption", "Regulatory compliance focus"],
      growthIndicator: "5.6% CAGR"
    },
    {
      id: "healthcare-saas",
      industry: "Healthcare SaaS", 
      segment: "Patient Data Analytics",
      companySize: "100–500 employees",
      decisionMakers: ["Chief Medical Officer", "IT Director"],
      regions: ["North America", "EU"],
      keyAttributes: ["HIPAA compliance", "AI/ML integration"],
      growthIndicator: "8.2% CAGR"
    },
    {
      id: "logistics-tech",
      industry: "Logistics Tech",
      segment: "Last-Mile Delivery",
      companySize: "200–800 employees",
      decisionMakers: ["VP Operations", "CTO"],
      regions: ["SEA", "North America"],
      keyAttributes: ["Real-time tracking", "API-first approach"],
      growthIndicator: "12.1% CAGR"
    },
    {
      id: "edtech-platforms",
      industry: "EdTech",
      segment: "Learning Management",
      companySize: "80–300 employees",
      decisionMakers: ["Chief Academic Officer", "IT Manager"],
      regions: ["Global", "LATAM"],
      keyAttributes: ["Mobile-first", "Analytics-driven"],
      growthIndicator: "9.4% CAGR"
    },
    {
      id: "proptech-crm",
      industry: "PropTech",
      segment: "Real Estate CRM",
      companySize: "150–600 employees",
      decisionMakers: ["VP Sales", "Technology Director"],
      regions: ["North America", "ANZ"],
      keyAttributes: ["Integration capabilities", "Workflow automation"],
      growthIndicator: "6.8% CAGR"
    },
    {
      id: "cybersecurity-startups",
      industry: "Cybersecurity",
      segment: "Zero Trust Solutions",
      companySize: "75–400 employees",
      decisionMakers: ["CISO", "VP Engineering"],
      regions: ["North America", "EU"],
      keyAttributes: ["SOC 2 compliance", "Cloud-native architecture"],
      growthIndicator: "15.3% CAGR"
    },
    {
      id: "insurtech-platforms",
      industry: "InsurTech",
      segment: "Digital Claims Processing",
      companySize: "100–350 employees",
      decisionMakers: ["Chief Claims Officer", "Head of Technology"],
      regions: ["North America", "UK"],
      keyAttributes: ["Automation focus", "Regulatory expertise"],
      growthIndicator: "11.7% CAGR"
    },
    {
      id: "renewable-energy",
      industry: "Clean Energy",
      segment: "Solar Management Platforms",
      companySize: "120–500 employees",
      decisionMakers: ["VP Operations", "Chief Technology Officer"],
      regions: ["North America", "EU", "ANZ"],
      keyAttributes: ["IoT integration", "Sustainability reporting"],
      growthIndicator: "18.2% CAGR"
    }
  ]);

  const industryOptions = ["Fintech", "Healthcare SaaS", "Logistics Tech", "EdTech", "PropTech", "Cybersecurity", "InsurTech", "Clean Energy"];
  const companySizeOptions = ["10–50 employees", "50–200 employees", "100–500 employees", "200–800 employees", "150–600 employees"];
  const regionOptions = ["North America", "EU", "DACH", "SEA", "LATAM", "Global", "ANZ", "UK"];

  const handleEdit = (icpId: string) => {
    const icp = suggestedICPs.find(i => i.id === icpId);
    if (icp) {
      setOriginalValues({ [icpId]: { ...icp } });
      setEditingICP(icpId);
    }
  };

  const handleSave = (icpId: string) => {
    const icp = suggestedICPs.find(i => i.id === icpId);
    if (icp) {
      setEditingICP(null);
      
      // Show toast with undo option
      toast({
        title: "Changes saved",
        description: "Undo?",
        action: (
          <Button variant="outline" size="sm" onClick={() => handleUndo(icpId)}>
            Undo
          </Button>
        ),
      });

      // Open Profiler chat automatically with context
      setChatContext({
        cardId: icpId,
        cardName: icp.segment,
        action: 'edit',
        editedFields: ['industry', 'segment'] // Could track actual edited fields
      });
      setChatOpen(true);
    }
  };

  const handleCancel = (icpId: string) => {
    if (originalValues[icpId]) {
      setSuggestedICPs(prev => 
        prev.map(icp => 
          icp.id === icpId ? originalValues[icpId] : icp
        )
      );
    }
    setEditingICP(null);
    setOriginalValues(prev => {
      const { [icpId]: removed, ...rest } = prev;
      return rest;
    });
  };

  const handleUndo = (icpId: string) => {
    if (originalValues[icpId]) {
      setSuggestedICPs(prev => 
        prev.map(icp => 
          icp.id === icpId ? originalValues[icpId] : icp
        )
      );
      setOriginalValues(prev => {
        const { [icpId]: removed, ...rest } = prev;
        return rest;
      });
      
      toast({
        title: "Changes undone",
        description: "ICP card restored to previous state",
      });
    }
  };

  const handleFieldChange = (icpId: string, field: keyof SuggestedICP, value: any) => {
    setSuggestedICPs(prev => 
      prev.map(icp => 
        icp.id === icpId ? { ...icp, [field]: value } : icp
      )
    );
  };

  const handleArrayFieldChange = (icpId: string, field: 'decisionMakers' | 'regions' | 'keyAttributes', value: string) => {
    const items = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    handleFieldChange(icpId, field, items);
  };

  const handleCardClick = (icp: SuggestedICP) => {
    if (editingICP === icp.id) return; // Don't select while editing
    
    setSelectedICP(icp.id);
    if (onICPSelect) {
      onICPSelect(icp);
    }
  };

  const openProfilerChat = () => {
    setChatContext({
      action: 'general'
    });
    setChatOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">Suggested ICPs</h2>
          <p className="text-sm text-gray-600">
            Agent-curated ideal customer profiles based on your product and market patterns
          </p>
        </div>
        
        {/* Persistent Profiler Chat Icon */}
        <Button
          variant="ghost"
          size="sm"
          onClick={openProfilerChat}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-2 relative"
          title="Chat with Profiler"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
            <Bot className="h-4 w-4 text-white" />
          </div>
          Chat with Profiler
        </Button>
      </div>

      {/* Carousel Container */}
      <div className="relative px-16">
        <Carousel
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {suggestedICPs.map((icp) => (
              <CarouselItem key={icp.id} className="pl-4 basis-[420px]">
                <Card 
                  className={`h-full transition-all duration-200 hover:shadow-lg border ${
                    selectedICP === icp.id 
                      ? 'border-blue-500 bg-blue-50/40 shadow-md' 
                      : editingICP === icp.id
                      ? 'border-green-500 bg-green-50/20 shadow-md'
                      : 'border-gray-200 hover:border-blue-300'
                  } ${editingICP !== icp.id ? 'hover:-translate-y-1 cursor-pointer' : ''}`}
                  onClick={() => handleCardClick(icp)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        {editingICP === icp.id ? (
                          <>
                            <Select value={icp.industry} onValueChange={(value) => handleFieldChange(icp.id, 'industry', value)}>
                              <SelectTrigger className="w-full h-8 text-lg font-semibold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {industryOptions.map(option => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input 
                              value={icp.segment}
                              onChange={(e) => handleFieldChange(icp.id, 'segment', e.target.value)}
                              className="font-medium text-blue-600 h-8"
                            />
                          </>
                        ) : (
                          <>
                            <CardTitle className="text-lg text-gray-900">{icp.industry}</CardTitle>
                            <CardDescription className="font-medium text-blue-600">
                              {icp.segment}
                            </CardDescription>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <ICPEditHistory icpId={icp.id} />
                        
                        {editingICP === icp.id ? (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleSave(icp.id)}>
                              <Save className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleCancel(icp.id)}>
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(icp.id);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {icp.growthIndicator && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs flex items-center gap-1 min-w-fit">
                            <TrendingUp className="h-3 w-3" />
                            <span className="whitespace-nowrap">{icp.growthIndicator}</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Company Size */}
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      {editingICP === icp.id ? (
                        <Select value={icp.companySize} onValueChange={(value) => handleFieldChange(icp.id, 'companySize', value)}>
                          <SelectTrigger className="w-full h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {companySizeOptions.map(option => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-gray-700">{icp.companySize}</span>
                      )}
                    </div>

                    {/* Decision Makers */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-600 font-medium">Key Decision Makers:</span>
                      </div>
                      {editingICP === icp.id ? (
                        <Textarea
                          value={icp.decisionMakers.join(', ')}
                          onChange={(e) => handleArrayFieldChange(icp.id, 'decisionMakers', e.target.value)}
                          className="ml-6 min-h-[60px] text-sm"
                          placeholder="Enter decision makers separated by commas"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1 ml-6">
                          {icp.decisionMakers.map((role, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Regions */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-600 font-medium">Regions:</span>
                      </div>
                      {editingICP === icp.id ? (
                        <Textarea
                          value={icp.regions.join(', ')}
                          onChange={(e) => handleArrayFieldChange(icp.id, 'regions', e.target.value)}
                          className="ml-6 min-h-[40px] text-sm"
                          placeholder="Enter regions separated by commas"
                        />
                      ) : (
                        <span className="text-gray-700 ml-6 text-sm">{icp.regions.join(", ")}</span>
                      )}
                    </div>

                    {/* Key Attributes */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Target className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-600 font-medium">Key Attributes:</span>
                      </div>
                      {editingICP === icp.id ? (
                        <Textarea
                          value={icp.keyAttributes.join(', ')}
                          onChange={(e) => handleArrayFieldChange(icp.id, 'keyAttributes', e.target.value)}
                          className="ml-6 min-h-[60px] text-sm"
                          placeholder="Enter key attributes separated by commas"
                        />
                      ) : (
                        <div className="space-y-1 ml-6">
                          {icp.keyAttributes.map((attribute, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0"></div>
                              <span className="text-gray-700">{attribute}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Growth Indicator (editable when in edit mode) */}
                    {editingICP === icp.id && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <TrendingUp className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <span className="text-gray-600 font-medium">Growth Indicator:</span>
                        </div>
                        <Input
                          value={icp.growthIndicator || ''}
                          onChange={(e) => handleFieldChange(icp.id, 'growthIndicator', e.target.value)}
                          className="ml-6 h-7 text-sm"
                          placeholder="e.g., 5.6% CAGR"
                        />
                      </div>
                    )}

                    {/* View Details Button */}
                    {editingICP !== icp.id && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-4 text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View ICP Details
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="-left-12 bg-white shadow-md border border-gray-200 hover:bg-gray-50 text-gray-700 h-10 w-10" />
          <CarouselNext className="-right-12 bg-white shadow-md border border-gray-200 hover:bg-gray-50 text-gray-700 h-10 w-10" />
        </Carousel>
      </div>

      {/* Profiler Chat Panel */}
      <ProfilerChatPanel 
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        context={chatContext}
      />
    </div>
  );
};
