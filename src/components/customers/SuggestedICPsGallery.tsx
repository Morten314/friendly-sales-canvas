
import { useState, useEffect } from "react";
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
  refreshTrigger?: number;
  onManualRefresh?: () => void;
  isRefreshing?: boolean;
}

export const SuggestedICPsGallery = ({ onICPSelect, onProfilerChatOpen, refreshTrigger, onManualRefresh, isRefreshing = false }: SuggestedICPsGalleryProps) => {
  const [selectedICP, setSelectedICP] = useState<string | null>(null);
  const [editingICP, setEditingICP] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<any>(null);
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({});
  const { toast } = useToast();

  const [suggestedICPs, setSuggestedICPs] = useState<SuggestedICP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch ICPs from backend
  const fetchICPs = async () => {
    try {
      console.log("=== FETCHING ICPs FROM BACKEND ===");
      console.log("Timestamp:", new Date().toISOString());
      setLoading(true);
      setError(null);
      
      const response = await fetch("https://backend-11kr.onrender.com/icp", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log("=== ICP API CALL DETAILS ===");
      console.log("URL:", "https://backend-11kr.onrender.com/icp");
      console.log("Response Status:", response.status);
      console.log("Response OK:", response.ok);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log("=== RAW BACKEND RESPONSE ===");
      console.log("Full response:", data);
      console.log("Response type:", typeof data);
      console.log("Is array:", Array.isArray(data));
      
      // Extract ICPs from various possible response formats
      let icpArray = [];
      if (Array.isArray(data)) {
        icpArray = data;
      } else if (data.icps && Array.isArray(data.icps)) {
        icpArray = data.icps;
      } else if (data.suggestedICPs && Array.isArray(data.suggestedICPs)) {
        icpArray = data.suggestedICPs;
      } else if (data.data && Array.isArray(data.data)) {
        icpArray = data.data;
      } else if (data.profiles && Array.isArray(data.profiles)) {
        icpArray = data.profiles;
      }
      
      console.log("=== EXTRACTED ICP ARRAY ===");
      console.log("ICP count:", icpArray.length);
      console.log("ICPs:", icpArray);
      
      if (icpArray.length === 0) {
        console.log("No ICPs found in backend response");
        setError("No ICPs available from backend");
        return;
      }
      
      // Transform backend data to match component interface
      const transformedData = icpArray.map((icp: any, index: number) => {
        console.log(`Processing ICP ${index + 1}:`, icp);
        return {
          id: icp.id || `backend-icp-${Date.now()}-${index}`,
          industry: icp.industry || icp.Industry || "",
          segment: icp.segment || icp.Segment || "",
          companySize: icp.companySize || icp.company_size || icp.CompanySize || "",
          decisionMakers: Array.isArray(icp.decisionMakers) ? icp.decisionMakers : 
                         Array.isArray(icp.decision_makers) ? icp.decision_makers :
                         Array.isArray(icp.DecisionMakers) ? icp.DecisionMakers :
                         typeof icp.decisionMakers === 'string' ? icp.decisionMakers.split(',').map((s: string) => s.trim()) :
                         typeof icp.decision_makers === 'string' ? icp.decision_makers.split(',').map((s: string) => s.trim()) : 
                         typeof icp.DecisionMakers === 'string' ? icp.DecisionMakers.split(',').map((s: string) => s.trim()) : [],
          regions: Array.isArray(icp.regions) ? icp.regions :
                   Array.isArray(icp.Regions) ? icp.Regions :
                   typeof icp.regions === 'string' ? icp.regions.split(',').map((s: string) => s.trim()) :
                   typeof icp.Regions === 'string' ? icp.Regions.split(',').map((s: string) => s.trim()) : [],
          keyAttributes: Array.isArray(icp.keyAttributes) ? icp.keyAttributes :
                        Array.isArray(icp.key_attributes) ? icp.key_attributes :
                        Array.isArray(icp.KeyAttributes) ? icp.KeyAttributes :
                        typeof icp.keyAttributes === 'string' ? icp.keyAttributes.split(',').map((s: string) => s.trim()) :
                        typeof icp.key_attributes === 'string' ? icp.key_attributes.split(',').map((s: string) => s.trim()) :
                        typeof icp.KeyAttributes === 'string' ? icp.KeyAttributes.split(',').map((s: string) => s.trim()) : [],
          growthIndicator: icp.growthIndicator || icp.growth_indicator || icp.GrowthIndicator || undefined
        };
      });
      
      console.log("=== FINAL TRANSFORMED DATA ===");
      console.log("Transformed ICP count:", transformedData.length);
      console.log("Transformed ICPs:", transformedData);
      
      setSuggestedICPs(transformedData);
      
      // Auto-select the first ICP
      if (transformedData.length > 0 && onICPSelect) {
        console.log("Auto-selecting first ICP:", transformedData[0]);
        setSelectedICP(transformedData[0].id);
        onICPSelect(transformedData[0]);
      }
      
    } catch (err) {
      console.error("=== ERROR FETCHING ICPs ===", err);
      setError(err instanceof Error ? err.message : "Failed to load ICPs from backend");
      setSuggestedICPs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("=== USEEFFECT TRIGGERED ===");
    console.log("refreshTrigger value:", refreshTrigger);
    fetchICPs();
  }, [refreshTrigger]); // Depend on refreshTrigger to refetch when company profile updates

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
        
        <div className="flex gap-2">
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onManualRefresh}
            disabled={isRefreshing || loading}
            className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            title="Refresh ICPs from latest company profile"
          >
            {isRefreshing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                Refreshing...
              </>
            ) : (
              "Refresh"
            )}
          </Button>
          
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
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading ICPs from backend...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600 mb-2">Failed to load ICPs from backend</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      )}

      {/* No ICPs State */}
      {!loading && !error && suggestedICPs.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <Bot className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No ICPs Found</h3>
          <p className="text-sm text-gray-600 mb-4">
            Update your company profile in Settings to generate personalized ideal customer profiles.
          </p>
        </div>
      )}

      {/* Carousel Container */}
      {!loading && !error && suggestedICPs.length > 0 && (
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
      )}

      {/* Profiler Chat Panel */}
      <ProfilerChatPanel 
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        context={chatContext}
      />
    </div>
  );
};
