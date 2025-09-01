
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Globe, TrendingUp, Users, Building, MapPin, Target, Bot, MessageSquare, Edit, Save, X, Check, RefreshCw, Loader2 } from "lucide-react";
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
  onRefreshComplete?: () => void; // Callback to notify when refresh is complete
}

export const SuggestedICPsGallery = ({ onICPSelect, onProfilerChatOpen, refreshTrigger, onManualRefresh, isRefreshing = false, onRefreshComplete }: SuggestedICPsGalleryProps) => {
  const [selectedICP, setSelectedICP] = useState<string | null>(null);
  const [editingICP, setEditingICP] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<any>(null);
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({});
  const { toast } = useToast();

  const [suggestedICPs, setSuggestedICPs] = useState<SuggestedICP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0); // Force re-render key

  console.log("=== SUGGESTED ICPS GALLERY RENDER ===");
  console.log("Current suggestedICPs count:", suggestedICPs.length);
  console.log("Loading:", loading);
  console.log("Error:", error);
  console.log("RefreshTrigger:", refreshTrigger);
  console.log("RenderKey:", renderKey);

  // Generate fallback ICPs when backend fails
  const generateFallbackICPs = (): SuggestedICP[] => {
    return [
      {
        id: "fallback-1",
        industry: "Healthcare Technology",
        segment: "Digital Health Platforms", 
        companySize: "100-500 employees",
        decisionMakers: ["CTO", "Chief Medical Officer", "VP of Engineering"],
        regions: ["North America", "Europe"],
        keyAttributes: ["HIPAA Compliance", "Scalability", "Real-time Processing"],
        growthIndicator: "High"
      },
      {
        id: "fallback-2", 
        industry: "Financial Services",
        segment: "Fintech Startups",
        companySize: "50-200 employees", 
        decisionMakers: ["CTO", "Head of Compliance", "VP of Product"],
        regions: ["US", "Canada", "UK"],
        keyAttributes: ["Regulatory Compliance", "Security", "API Integration"],
        growthIndicator: "High"
      }
    ];
  };

  // Track when suggestedICPs state changes
  useEffect(() => {
    console.log("=== SUGGESTED ICPS STATE CHANGED ===");
    console.log("New suggestedICPs count:", suggestedICPs.length);
    console.log("New suggestedICPs data:", suggestedICPs);
    setRenderKey(prev => prev + 1); // Force re-render
  }, [suggestedICPs]);

  // Fetch ICPs from backend
  const fetchICPs = async () => {
    try {
      console.log("=== FETCHING ICPs FROM BACKEND ===");
      console.log("Timestamp:", new Date().toISOString());
      console.log("RefreshTrigger:", refreshTrigger);
      console.log("Is Refresh Mode:", refreshTrigger > 0);
      setLoading(true);
      setError(null);
      
      // Clear existing data while loading new data
      setSuggestedICPs([]);
      
      // Add timestamp to force fresh data and avoid caching
      const timestamp = new Date().getTime();
      
      // For refresh mode, fetch company profile and include it in the request
      let apiUrl = `/api/icp?t=${timestamp}&fresh=true`;
      
      if (refreshTrigger > 0) {
        console.log("🔄 REFRESH MODE - Fetching company profile for ICP generation");
        
        try {
          // Fetch the latest company profile from backend
          const profileResponse = await fetch('/api/profile/company', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          console.log("Profile fetch status:", profileResponse.status);
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            console.log("✅ Retrieved company profile:", profileData);
            console.log("Profile keys:", Object.keys(profileData || {}));
            console.log("Profile structure check:");
            console.log("- Industry:", profileData?.industry);
            console.log("- Company Size:", profileData?.companySize);
            console.log("- Strategic Goals:", profileData?.strategicGoals);
            console.log("- Target Markets:", profileData?.targetMarkets);
            
            // Add profile context to the GET request URL parameters
            const profileParams = new URLSearchParams({
              refresh: 'true',
              regenerate: 'true',
              profileUpdated: 'true',
              includeProfile: 'true'
            });
            
            // Add key profile data as URL parameters (backend can use these for generation)
            // URLSearchParams automatically handles encoding, so no need for double encoding
            if (profileData.industry) {
              profileParams.set('industry', profileData.industry);
            }
            if (profileData.companySize) {
              profileParams.set('companySize', profileData.companySize);
            }
            if (profileData.strategicGoals) {
              // Truncate very long strategic goals to prevent URL length issues
              const goals = profileData.strategicGoals.length > 200 
                ? profileData.strategicGoals.substring(0, 200) + '...'
                : profileData.strategicGoals;
              profileParams.set('strategicGoals', goals);
            }
            if (profileData.targetMarkets && Array.isArray(profileData.targetMarkets)) {
              profileParams.set('targetMarkets', profileData.targetMarkets.join(','));
            }
            
            apiUrl += `&${profileParams.toString()}`;
            console.log("📤 Enhanced URL with profile data:", apiUrl);
            console.log("📏 URL length:", apiUrl.length);
            console.log("🏷️ Profile parameters:", Object.fromEntries(profileParams));
          } else {
            console.warn("❌ Could not fetch company profile, status:", profileResponse.status);
            // Add basic refresh parameters even without profile
            apiUrl += '&refresh=true&regenerate=true';
            console.log("Using basic refresh URL:", apiUrl);
          }
        } catch (profileError) {
          console.error("❌ Error fetching company profile:", profileError);
          // Add basic refresh parameters as fallback
          apiUrl += '&refresh=true&regenerate=true';
          console.log("Fallback refresh URL:", apiUrl);
        }
      }
      
      console.log("=== ICP API CALL DETAILS ===");
      console.log("Method: GET");
      console.log("URL:", apiUrl);
      console.log("Profile Context Included:", refreshTrigger > 0);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log("Response Status:", response.status);
      console.log("Response OK:", response.ok);
      
      if (!response.ok) {
        // Try to get error details from response
        let errorDetails = response.statusText;
        let isRateLimit = false;
        try {
          const errorBody = await response.text();
          if (errorBody) {
            console.log("Error response body:", errorBody);
            errorDetails = errorBody;
            
            // Check if this is a rate limit error
            if (errorBody.includes('rate limit') || errorBody.includes('429')) {
              isRateLimit = true;
              console.log("🚫 Detected rate limit error from AI model");
            }
          }
        } catch (e) {
          console.log("Could not read error response body");
        }
        
        // If this was a profile-enhanced request that failed with 500, try a basic request
        if (response.status === 500 && apiUrl.includes('profileUpdated=true')) {
          console.log("🔄 Profile-enhanced request failed with 500, trying basic request...");
          
          // Only try basic request if it's not a rate limit (rate limits affect all requests)
          if (!isRateLimit) {
            const basicUrl = `/api/icp?t=${Date.now()}&refresh=true`;
            console.log("Basic fallback URL:", basicUrl);
            
            try {
              const basicResponse = await fetch(basicUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                },
              });
              
              console.log("Basic request status:", basicResponse.status);
              
              if (basicResponse.ok) {
                console.log("✅ Basic request succeeded, using basic data");
                const basicData = await basicResponse.json();
                
                // Process basic data and continue with normal flow
                console.log("=== RAW BACKEND RESPONSE (BASIC) ===");
                console.log("Full response:", basicData);
                
                const transformedICPs = Array.isArray(basicData) 
                  ? basicData 
                  : basicData?.suggestedICPs || basicData?.icps || [];
                
                if (transformedICPs.length > 0) {
                  setSuggestedICPs(transformedICPs);
                  setError(null);
                  console.log(`✅ Loaded ${transformedICPs.length} ICPs from basic request`);
                  
                  // Show warning notification that profile data wasn't used
                  const notification = document.createElement('div');
                  notification.className = 'fixed top-4 right-4 text-white px-4 py-2 rounded-lg shadow-lg z-50';
                  notification.style.backgroundColor = '#f59e0b';
                  notification.textContent = "⚠️ Profile data couldn't be processed, showing general ICPs instead";
                  
                  document.body.appendChild(notification);
                  setTimeout(() => {
                    if (document.body.contains(notification)) {
                      document.body.removeChild(notification);
                    }
                  }, 5000);
                  
                  return; // Exit successfully with basic data
                }
              }
            } catch (basicError) {
              console.log("Basic fallback request also failed:", basicError);
            }
          } else {
            console.log("⏭️ Skipping basic request fallback due to rate limit - will use mock data");
          }
        }
        
        throw new Error(`API returned ${response.status}: ${errorDetails}`);
      }
      
      const data = await response.json();
      
      console.log("=== RAW BACKEND RESPONSE ===");
      console.log("Full response:", data);
      console.log("Response type:", typeof data);
      console.log("Is array:", Array.isArray(data));
      
      // Log whether this appears to be profile-based data
      if (refreshTrigger > 0 && apiUrl.includes('profileUpdated=true')) {
        console.log("🔍 ANALYZING PROFILE-BASED RESPONSE:");
        console.log("- Request included profile data:", !!apiUrl.includes('includeProfile=true'));
        console.log("- Profile industry was:", apiUrl.includes('industry=') ? apiUrl.split('&')[1].split('=')[1] : 'N/A');
        console.log("- Profile company size was:", apiUrl.includes('companySize=') ? apiUrl.split('&')[1].split('=')[1] : 'N/A');
        
        // Check if response ICPs seem to match profile
        if (data && (data.suggestedICPs || Array.isArray(data))) {
          const icps = data.suggestedICPs || data;
          console.log("- Response ICPs count:", icps.length);
          if (icps.length > 0) {
            console.log("- First ICP industry:", icps[0]?.industry);
            console.log("- First ICP segment:", icps[0]?.segment);
          }
        }
      }
      
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
      const transformedICPs = icpArray.map((item: any, index: number) => {
        console.log(`=== TRANSFORMING ICP ${index + 1} ===`);
        console.log("Raw item:", item);
        
        try {
          const transformed: SuggestedICP = {
            id: item.id || item._id || `icp-${index + 1}`,
            industry: item.industry || item.Industry || "Unknown Industry",
            segment: item.segment || item.Segment || item.market_segment || "Unknown Segment", 
            companySize: item.companySize || item.company_size || item.size || "Unknown Size",
            decisionMakers: Array.isArray(item.decisionMakers) 
              ? item.decisionMakers 
              : Array.isArray(item.decision_makers)
                ? item.decision_makers
                : typeof item.decisionMakers === 'string'
                  ? item.decisionMakers.split(',').map((s: string) => s.trim())
                  : ["CTO", "Head of Engineering"],
            regions: Array.isArray(item.regions)
              ? item.regions
              : Array.isArray(item.target_markets)
                ? item.target_markets
                : typeof item.regions === 'string'
                  ? item.regions.split(',').map((s: string) => s.trim())
                  : ["Unknown Region"],
            keyAttributes: Array.isArray(item.keyAttributes)
              ? item.keyAttributes
              : Array.isArray(item.key_attributes) 
                ? item.key_attributes
                : typeof item.keyAttributes === 'string'
                  ? item.keyAttributes.split(',').map((s: string) => s.trim())
                  : ["Scalability", "Performance"],
            growthIndicator: item.growthIndicator || item.growth_indicator || "Medium"
          };
          
          console.log("Transformed:", transformed);
          return transformed;
        } catch (transformError) {
          console.error("Error transforming ICP:", transformError);
          console.error("Failed item:", item);
          
          // Return a fallback ICP to prevent crashes
          return {
            id: `fallback-${index + 1}`,
            industry: "Technology",
            segment: "B2B SaaS",
            companySize: "50-200 employees",
            decisionMakers: ["CTO", "Head of Engineering"],
            regions: ["North America"],
            keyAttributes: ["Scalability", "Performance"],
            growthIndicator: "Medium"
          };
        }
      });
      
      console.log("=== FINAL TRANSFORMED ICPs ===");
      console.log("Count:", transformedICPs.length);
      transformedICPs.forEach((icp, idx) => {
        console.log(`ICP ${idx + 1}:`, icp);
      });
      
      console.log("🔄 REPLACING OLD CARDS WITH NEW ICPs");
      console.log("Previous count:", suggestedICPs.length);
      console.log("New count:", transformedICPs.length);
      
      setSuggestedICPs(transformedICPs);
      setError(null);
      
      // Auto-select the first ICP if available
      if (transformedICPs.length > 0) {
        console.log("✅ AUTO-SELECTING FIRST NEW ICP");
        console.log("Auto-selecting ICP:", transformedICPs[0]);
        const enrichedFirstICP = enrichICPWithAnalysis(transformedICPs[0]);
        if (onICPSelect) {
          onICPSelect(enrichedFirstICP);
        }
      }
      
      // Notify parent that refresh is complete
      if (onRefreshComplete) {
        onRefreshComplete();
      }
      
      console.log("✅ ICP REFRESH COMPLETED - NEW CARDS DISPLAYED");
      
      // Show success notification for refreshes (not initial load)
      if (refreshTrigger > 0) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        
        const profileUsed = apiUrl.includes('profileUpdated=true');
        notification.textContent = profileUsed 
          ? `✅ ${transformedICPs.length} new ICP${transformedICPs.length !== 1 ? 's' : ''} generated from your company profile!`
          : `✅ ${transformedICPs.length} ICP${transformedICPs.length !== 1 ? 's' : ''} refreshed (profile data not available)`;
        
        document.body.appendChild(notification);
        
        // Remove notification after 4 seconds
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 4000);
      }
      
    } catch (error) {
      console.error("=== FETCH ERROR ===", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      // Check if this is a rate limit error for better user messaging
      const isRateLimit = errorMessage.includes('rate limit') || errorMessage.includes('429');
      
      if (isRateLimit) {
        console.log("🕐 Rate limit detected - showing user-friendly message");
        setError("AI service is temporarily busy. Showing sample data instead.");
        
        // Show informative notification for rate limits
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        notification.style.backgroundColor = '#f59e0b';
        notification.textContent = "🕐 AI service is at capacity. Sample ICPs shown - try again in a few minutes.";
        
        document.body.appendChild(notification);
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 7000); // Longer timeout for rate limit messages
      } else {
        setError(`Failed to fetch ICPs: ${errorMessage}`);
      }
      
      // Set fallback ICPs instead of leaving empty
      console.log("Setting fallback ICPs due to error");
      setSuggestedICPs(generateFallbackICPs());
      
    } finally {
      setLoading(false);
      console.log("=== FETCH COMPLETE ===");
    }
  };

  // Initial data load when component mounts
  useEffect(() => {
    console.log("=== INITIAL USEEFFECT TRIGGERED ===");
    fetchICPs();
  }, []); // Load data once when component mounts

  // Refetch when refresh is triggered
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log("=== REFRESH TRIGGERED USEEFFECT ===");
      console.log("refreshTrigger value:", refreshTrigger);
      console.log("Previous ICPs count:", suggestedICPs.length);
      console.log("Previous ICPs:", suggestedICPs.map(icp => ({ id: icp.id, industry: icp.industry, segment: icp.segment })));
      console.log("🔄 STARTING ICP REFRESH - FETCHING NEW DATA FROM BACKEND");
      fetchICPs();
    }
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

  const handleICPSelect = (icp: SuggestedICP) => {
    console.log("=== ICP CARD SELECTED ===");
    console.log("Raw selected ICP:", icp);
    
    // Enrich the ICP with detailed analysis data
    const enrichedICP = enrichICPWithAnalysis(icp);
    console.log("Enriched ICP:", enrichedICP);
    
    onICPSelect(enrichedICP);
  };

  // Function to enrich ICP with detailed analysis properties
  const enrichICPWithAnalysis = (icp: SuggestedICP) => {
    console.log("=== ENRICHING ICP WITH ANALYSIS ===");
    
    const industry = icp.industry || "Technology";
    const segment = icp.segment || "Software Solutions";
    const regions = icp.regions || ["Global"];
    const keyAttributes = icp.keyAttributes || ["Security"];
    const decisionMakers = icp.decisionMakers || ["CTO"];

    // Generate dynamic market sizes based on industry
    const industryMultipliers = {
      'Healthcare': { base: 45, growth: 28 },
      'Financial': { base: 32, growth: 35 },
      'Technology': { base: 28, growth: 42 },
      'Manufacturing': { base: 38, growth: 18 },
      'Retail': { base: 25, growth: 22 },
      'default': { base: 30, growth: 25 }
    };

    const industryKey = Object.keys(industryMultipliers).find(key =>
      industry?.toLowerCase().includes(key.toLowerCase())
    ) || 'default';

    const multiplier = industryMultipliers[industryKey as keyof typeof industryMultipliers];
    const marketSize = multiplier.base + Math.floor(Math.random() * 20);
    const growthRate = multiplier.growth + Math.floor(Math.random() * 15);

    // Generate company size-based metrics
    const sizeMetrics = {
      urgency: icp.companySize?.includes('100-500') || icp.companySize?.includes('200+') ? "High" :
               icp.companySize?.includes('50-200') ? "Medium" : "High",
      timeToClose: icp.companySize?.includes('500+') || icp.companySize?.includes('200+') ? "6-9 months" : "4-6 months",
      corePersonas: decisionMakers?.length || 3,
      buyingTriggers: Math.floor(Math.random() * 5) + 5
    };

    return {
      ...icp,
      // Extended properties for detailed analysis
      title: `${industry} - ${segment} (${icp.companySize})`,
      blurb: `${segment} companies in ${industry} seeking innovative solutions to scale their operations across ${regions?.join(', ') || 'target'} markets. Key focus areas include ${keyAttributes?.slice(0, 2).join(' and ') || 'operational efficiency'}.`,
      marketSize: `€${marketSize}.${Math.floor(Math.random() * 9)}B`,
      growth: `+${growthRate}%`,
      urgency: sizeMetrics.urgency,
      timeToClose: sizeMetrics.timeToClose,
      corePersonas: sizeMetrics.corePersonas,
      topPainPoint: keyAttributes?.[0] || "Operational Efficiency",
      buyingTriggers: sizeMetrics.buyingTriggers,
      competitors: Math.floor(Math.random() * 5) + 3,
      winLossChange: `+${Math.floor(Math.random() * 30) + 10}%`,
      buyingSignals: Math.floor(Math.random() * 15) + 8,
      buyingTriggersArray: [
        { trigger: `${industry} Modernization`, description: `${industry} companies upgrading ${segment.toLowerCase()} to address ${keyAttributes[0]?.toLowerCase() || 'scalability'}.` },
        { trigger: keyAttributes[0] || "Technology Gap", description: `New ${industry.toLowerCase()} regulations requiring ${keyAttributes[0]?.toLowerCase() || 'security'} improvements in ${regions[0] || 'target markets'}.` }
      ],
      marketAnalysis: {
        totalMarketSize: `€${marketSize}.${Math.floor(Math.random() * 9)}B`,
        servicableMarket: `€${Math.floor(marketSize * 0.35)}.${Math.floor(Math.random() * 9)}B`,
        targetableMarket: `€${Math.floor(marketSize * 0.08)}.${Math.floor(Math.random() * 9)}B`,
        marketGrowth: `+${growthRate}%`,
        segments: [
          { name: `Advanced ${segment}`, size: `€${Math.floor(marketSize * 0.45)}.0B`, growth: `+${growthRate + 10}%`, share: "45%" },
          { name: `Traditional ${segment}`, size: `€${Math.floor(marketSize * 0.35)}.0B`, growth: `+${growthRate - 8}%`, share: "35%" }
        ],
        keyChallenges: [
          `${industry} sector complexity requiring specialized ${keyAttributes[0]?.toLowerCase() || 'solutions'}`,
          `${segment} integration challenges for ${icp.companySize} organizations`
        ],
        strategicRecommendations: [
          `Target ${industry} companies specifically needing ${keyAttributes[0]?.toLowerCase() || 'solutions'}`,
          `Focus ${segment.toLowerCase()} messaging on ${keyAttributes.slice(0, 2).join(' and ').toLowerCase()} benefits`
        ],
        signalsToMonitor: [
          `${industry} sector funding and ${segment.toLowerCase()} investment announcements`,
          `${regions[0] || 'Regional'} regulatory changes affecting ${industry.toLowerCase()} ${keyAttributes[0]?.toLowerCase() || 'operations'}`
        ]
      },
      competitiveData: {
        mainCompetitors: [`${industry} Leader A`, `${industry} Leader B`, `${segment} Provider`],
        competitiveMap: [
          {
            competitor: `${industry} Incumbent A`,
            segment: segment,
            share: "24%",
            winsLosses: `Strong in ${regions[0] || 'market'}, ${keyAttributes[0]?.toLowerCase() || 'security'} focus`,
            differentiators: `Legacy ${industry.toLowerCase()} presence, ${keyAttributes[0]?.toLowerCase() || 'security'} approach`
          }
        ],
        competitiveNews: [
          {
            headline: `${industry} Leader announces ${segment.toLowerCase()} expansion`,
            competitor: `${industry} Leader A`,
            date: "2024-12-15",
            impact: "Medium - expanding market presence"
          }
        ],
        buyingSignalsData: [
          {
            signal: `${keyAttributes[0] || 'Technology'} Investment`,
            strength: "High",
            description: `Increased ${keyAttributes[0]?.toLowerCase() || 'technology'} spending in ${industry.toLowerCase()}`,
            source: "Industry Reports",
            recency: "2 weeks ago",
            region: regions[0] || "Global",
            type: "Investment"
          }
        ]
      },
      _metadata: {
        dataSource: 'api',
        fetchedAt: new Date().toISOString(),
        originalICPId: icp.id,
        transformationIndex: 0
      }
    };
  };

  const handleCardClick = (icp: SuggestedICP) => {
    if (editingICP === icp.id) return; // Don't select while editing
    
    setSelectedICP(icp.id);
    if (onICPSelect) {
      handleICPSelect(icp);
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
      {/* Header with refresh status */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Suggested ICPs</h3>
          <p className="text-sm text-gray-600">
            {loading ? "Generating ICPs..." : 
             error ? "Error loading ICPs" : 
             `${suggestedICPs.length} ICP${suggestedICPs.length !== 1 ? 's' : ''} available`}
          </p>
        </div>
        
        {/* Refresh Status & Button */}
        <div className="flex items-center gap-3">
          {/* Refresh Status Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              refreshTrigger === 0 ? 'bg-blue-500' : 'bg-green-500'
            }`}></div>
            <span className="text-gray-600">
              {refreshTrigger === 0 ? 'Initial Load' : 'Refreshed'}
            </span>
          </div>
          
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onManualRefresh}
            disabled={isRefreshing || loading}
            className="flex items-center gap-2"
            title="Refresh ICPs from latest company profile"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">
              {refreshTrigger > 0 
                ? "Generating new ICPs based on your company profile..." 
                : "Loading your suggested ICPs..."
              }
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {refreshTrigger > 0 
                ? "This may take a few moments as we analyze your updated profile" 
                : "Analyzing your business context and market patterns"
              }
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && suggestedICPs.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-yellow-700 mb-2">Backend unavailable - showing sample data</p>
          <p className="text-sm text-gray-600">Save a company profile to generate personalized ICPs</p>
        </div>
      )}

      {/* Error State with no fallback data */}
      {error && !loading && suggestedICPs.length === 0 && (
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

      {/* Debug Info */}
      {!loading && (
        <div className="text-xs text-gray-500 mb-2 p-2 bg-gray-50 rounded">
          Debug: Found {suggestedICPs.length} ICPs | Loading: {loading.toString()} | Error: {error ? 'Yes' : 'No'}
          {suggestedICPs.length > 0 && (
            <div>First ICP: {suggestedICPs[0].segment}</div>
          )}
        </div>
      )}

      {/* Carousel Container */}
      {!loading && !error && suggestedICPs.length > 0 && (
        <div className="relative px-16">
          <Carousel
            key={`carousel-${renderKey}-${suggestedICPs.length}`} // Force re-render when data changes
            opts={{
              align: "start",
              loop: false,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {suggestedICPs.map((icp, index) => (
              <CarouselItem key={`${icp.id}-${renderKey}-${index}`} className="pl-4 basis-[420px]">
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
