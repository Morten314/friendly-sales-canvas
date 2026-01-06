
// Legacy commented implementation - using the new implementation below



import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { profilerCache } from "@/lib/profilerCache";
import { useAuth } from "@/contexts/AuthContext";
import { getUserLocalStorage, setUserLocalStorage, removeUserLocalStorage } from "@/utils/cacheUtils";

interface SocialMediaUrl {
  platform: string;
  url: string;
}

interface CompanyProfileProps {
  onProfileUpdate?: () => void;
  isEditMode?: boolean;
  profileData?: any;
}

export function CompanyProfile({ onProfileUpdate, isEditMode = false, profileData }: CompanyProfileProps) {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    industry: "",
    companySize: "",
    companyUrl: "",
    strategicGoals: "",
    primaryGTMModel: "",
    revenueStage: "",
    keyBuyerPersona: "",
  });

  const [targetMarkets, setTargetMarkets] = useState<string[]>([""]);
  const [socialMediaUrls, setSocialMediaUrls] = useState<SocialMediaUrl[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch company profile from API (similar to Signals pattern)
  const fetchCompanyProfile = async (userId: string) => {
    try {
      const response = await fetch(`/api/profile/company?user_id=${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        console.log('No existing company profile found in API');
        return null;
      }
      
      const data = await response.json();
      // Verify the data belongs to the current user
      if (data.user_id && data.user_id !== userId) {
        console.warn('⚠️ [COMPANY PROFILE] API returned profile with different user_id, ignoring');
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching company profile:', error);
      return null;
    }
  };

  // Track previous user to detect user changes
  const previousUserIdRef = useRef<string | null | undefined>(currentUser?.uid);

  // Load user-specific company profile from localStorage and API on mount or when user changes
  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const currentUserId = currentUser?.uid;

    // CRITICAL: Clear form immediately when user changes (before loading new data)
    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      console.log('🔄 [COMPANY PROFILE] User changed from', previousUserId, 'to', currentUserId, '- clearing form immediately');
      setFormData({
        industry: "",
        companySize: "",
        companyUrl: "",
        strategicGoals: "",
        primaryGTMModel: "",
        revenueStage: "",
        keyBuyerPersona: "",
      });
      setTargetMarkets([""]);
      setSocialMediaUrls([]);
    }

    if (!currentUserId) {
      // User logged out - clear form
      console.log('🔄 [COMPANY PROFILE] User logged out, clearing form');
      setFormData({
        industry: "",
        companySize: "",
        companyUrl: "",
        strategicGoals: "",
        primaryGTMModel: "",
        revenueStage: "",
        keyBuyerPersona: "",
      });
      setTargetMarkets([""]);
      setSocialMediaUrls([]);
      previousUserIdRef.current = currentUserId;
      return;
    }
    
    const loadProfile = async () => {
      console.log('🔄 [COMPANY PROFILE] Loading profile for user:', currentUserId);
      
      // First, try to load from localStorage
      const storedProfile = getUserLocalStorage('companyProfile', currentUserId);
      if (storedProfile) {
        try {
          const parsedProfile = JSON.parse(storedProfile);
          // CRITICAL: Only load if user_id matches exactly - reject data without user_id
          if (parsedProfile.user_id === currentUserId) {
            console.log('✅ [COMPANY PROFILE] Found stored profile for user:', currentUserId);
            setFormData({
              industry: parsedProfile.industry || "",
              companySize: parsedProfile.companySize || "",
              companyUrl: parsedProfile.companyUrl || "",
              strategicGoals: parsedProfile.strategicGoals || "",
              primaryGTMModel: parsedProfile.primaryGTMModel || "",
              revenueStage: parsedProfile.revenueStage || "",
              keyBuyerPersona: parsedProfile.keyBuyerPersona || "",
            });
            setTargetMarkets(Array.isArray(parsedProfile.targetMarkets) && parsedProfile.targetMarkets.length > 0 
              ? parsedProfile.targetMarkets 
              : [""]);
            setSocialMediaUrls(Array.isArray(parsedProfile.socialMediaUrls) ? parsedProfile.socialMediaUrls : []);
            previousUserIdRef.current = currentUserId;
            return; // Don't fetch from API if we have valid localStorage data
          } else {
            // Data belongs to different user or has no user_id - clear it
            console.warn('⚠️ [COMPANY PROFILE] Stored profile user_id mismatch or missing! Stored:', parsedProfile.user_id, 'Current:', currentUserId);
            console.warn('⚠️ [COMPANY PROFILE] Clearing invalid data to prevent data leakage');
            removeUserLocalStorage('companyProfile', currentUserId);
            removeUserLocalStorage('companyProfileForRefresh', currentUserId);
            // Also clear old format if it exists
            localStorage.removeItem('companyProfile');
            localStorage.removeItem('companyProfileForRefresh');
          }
        } catch (error) {
          console.error('❌ [COMPANY PROFILE] Error parsing stored profile:', error);
          // Clear corrupted data
          removeUserLocalStorage('companyProfile', currentUserId);
          removeUserLocalStorage('companyProfileForRefresh', currentUserId);
        }
      }
      
      // If no localStorage data or it was invalid, fetch from API
      console.log('📝 [COMPANY PROFILE] No valid stored profile found, fetching from API for user:', currentUserId);
      setIsLoading(true);
      const apiData = await fetchCompanyProfile(currentUserId);
      
      if (apiData) {
        // CRITICAL: Validate API response belongs to current user
        if (apiData.user_id && apiData.user_id !== currentUserId) {
          console.error('❌ [COMPANY PROFILE] API returned profile for different user! API user_id:', apiData.user_id, 'Current:', currentUserId);
          console.error('❌ [COMPANY PROFILE] Rejecting data to prevent data leakage');
          setIsLoading(false);
          previousUserIdRef.current = currentUserId;
          return;
        }

        console.log('✅ [COMPANY PROFILE] Loaded profile from API for user:', currentUserId);
        // Store in localStorage for future use - ALWAYS include user_id
        const profileToSave = {
          ...apiData,
          user_id: currentUserId // Ensure user_id is always included
        };
        setUserLocalStorage('companyProfile', JSON.stringify(profileToSave), currentUserId);
        setUserLocalStorage('companyProfileForRefresh', JSON.stringify(profileToSave), currentUserId);
        
        // Update form with API data
        setFormData({
          industry: apiData.industry || "",
          companySize: apiData.companySize || "",
          companyUrl: apiData.companyUrl || "",
          strategicGoals: apiData.strategicGoals || "",
          primaryGTMModel: apiData.primaryGTMModel || "",
          revenueStage: apiData.revenueStage || "",
          keyBuyerPersona: apiData.keyBuyerPersona || "",
        });
        setTargetMarkets(Array.isArray(apiData.targetMarkets) && apiData.targetMarkets.length > 0 
          ? apiData.targetMarkets 
          : [""]);
        setSocialMediaUrls(Array.isArray(apiData.socialMediaUrls) ? apiData.socialMediaUrls : []);
      } else {
        console.log('📝 [COMPANY PROFILE] No profile data found in API for user:', currentUserId, '- using empty form');
      }
      
      setIsLoading(false);
      previousUserIdRef.current = currentUserId;
    };
    
    loadProfile();
  }, [currentUser?.uid]);

  // Update form data when profileData prop changes (from API)
  useEffect(() => {
    if (!currentUser?.uid) {
      return; // Don't update if no user logged in
    }

    if (profileData) {
      // CRITICAL: Verify profileData belongs to current user
      if (profileData.user_id && profileData.user_id !== currentUser.uid) {
        console.warn('⚠️ [COMPANY PROFILE] profileData user_id mismatch, ignoring. Stored:', profileData.user_id, 'Current:', currentUser.uid);
        return;
      }
      
      // Also save to localStorage if it came from API (has user_id)
      if (profileData.user_id === currentUser.uid) {
        console.log('🔄 [COMPANY PROFILE] Updating form from profileData prop and saving to localStorage');
        const profileToSave = {
          ...profileData,
          user_id: currentUser.uid
        };
        setUserLocalStorage('companyProfile', JSON.stringify(profileToSave), currentUser.uid);
        setUserLocalStorage('companyProfileForRefresh', JSON.stringify(profileToSave), currentUser.uid);
      } else {
        console.log('🔄 [COMPANY PROFILE] Updating form from profileData prop');
      }
      
      setFormData({
        industry: profileData.industry || "",
        companySize: profileData.companySize || "",
        companyUrl: profileData.companyUrl || "",
        strategicGoals: profileData.strategicGoals || "",
        primaryGTMModel: profileData.primaryGTMModel || "",
        revenueStage: profileData.revenueStage || "",
        keyBuyerPersona: profileData.keyBuyerPersona || "",
      });
      setTargetMarkets(Array.isArray(profileData.targetMarkets) && profileData.targetMarkets.length > 0 
        ? profileData.targetMarkets 
        : [""]);
      setSocialMediaUrls(Array.isArray(profileData.socialMediaUrls) ? profileData.socialMediaUrls : []);
    }
  }, [profileData, currentUser?.uid]);

  const socialPlatforms = [
    { value: "linkedin", label: "LinkedIn" },
    { value: "instagram", label: "Instagram" },
    { value: "twitter", label: "Twitter" },
    { value: "facebook", label: "Facebook" },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTargetMarketChange = (index: number, value: string) => {
    const newTargetMarkets = [...targetMarkets];
    newTargetMarkets[index] = value;
    setTargetMarkets(newTargetMarkets);
  };

  const addTargetMarket = () => {
    setTargetMarkets([...(Array.isArray(targetMarkets) ? targetMarkets : []), ""]);
  };

  const removeTargetMarket = (index: number) => {
    if (Array.isArray(targetMarkets) && targetMarkets.length > 1) {
      const newTargetMarkets = targetMarkets.filter((_, i) => i !== index);
      setTargetMarkets(newTargetMarkets);
    }
  };

  const addSocialMediaUrl = () => {
    if (selectedPlatform) {
      setSocialMediaUrls([...(Array.isArray(socialMediaUrls) ? socialMediaUrls : []), { platform: selectedPlatform, url: "" }]);
      setSelectedPlatform("");
    }
  };

  const removeSocialMediaUrl = (index: number) => {
    if (Array.isArray(socialMediaUrls)) {
      const newSocialMediaUrls = socialMediaUrls.filter((_, i) => i !== index);
      setSocialMediaUrls(newSocialMediaUrls);
    }
  };

  const handleSocialMediaUrlChange = (index: number, value: string) => {
    if (Array.isArray(socialMediaUrls)) {
      const newSocialMediaUrls = [...socialMediaUrls];
      newSocialMediaUrls[index].url = value;
      setSocialMediaUrls(newSocialMediaUrls);
    }
  };

  const getPlatformLabel = (platform: string) => {
    return socialPlatforms.find(p => p.value === platform)?.label || platform;
  };

  const handleSave = async () => {
    console.log("=== COMPANY PROFILE SAVE TRIGGERED ===");
    console.log("Form data:", formData);
    console.log("Target markets:", targetMarkets);
    console.log("Social media URLs:", socialMediaUrls);
    
    if (!currentUser?.uid) {
      console.error('User not authenticated');
      alert('Please log in to save your company profile');
      return;
    }
    const payload = {
      user_id: currentUser.uid,
      industry: formData.industry,
      companySize: formData.companySize,
      companyUrl: formData.companyUrl,
      website: formData.companyUrl,
      strategicGoals: formData.strategicGoals,
      primaryGTMModel: formData.primaryGTMModel,
      gtmModel: formData.primaryGTMModel,
      revenueStage: formData.revenueStage,
      keyBuyerPersona: formData.keyBuyerPersona,
      targetMarkets: Array.isArray(targetMarkets) ? targetMarkets.filter(market => market.trim() !== "") : [],
      socialMediaUrls: Array.isArray(socialMediaUrls) ? socialMediaUrls.map(url => ({
        platform: getPlatformLabel(url.platform),
        url: url.url,
      })) : [],
    };

    console.log("=== PAYLOAD TO SEND ===", payload);

    try {
      // Include user_id in URL query parameter like Signals does, AND in body
      const apiUrl = currentUser?.uid 
        ? `/api/profile/company?user_id=${currentUser.uid}`
        : "/api/profile/company";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("=== COMPANY PROFILE API RESPONSE ===");
      console.log("Status:", response.status);
      console.log("OK:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("=== API ERROR DETAILS ===");
        console.error("Status:", response.status);
        console.error("Status Text:", response.statusText);
        console.error("Error Response:", errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Company profile saved successfully:", data);
      alert("Company profile saved successfully!");
      
      // Store the updated profile data immediately in user-specific localStorage
      console.log("=== STORING UPDATED PROFILE DATA (USER-SPECIFIC) ===");
      console.log("User ID:", currentUser?.uid);
      const payloadWithUserId = {
        ...payload,
        user_id: currentUser.uid // Ensure user_id is included
      };
      setUserLocalStorage('companyProfile', JSON.stringify(payloadWithUserId), currentUser?.uid);
      setUserLocalStorage('companyProfileForRefresh', JSON.stringify(payloadWithUserId), currentUser?.uid);
      
      // Set flag to indicate new company profile data is available (user-specific)
      setUserLocalStorage('companyProfileUpdated', '1', currentUser?.uid);
      console.log("🏁 Company profile update flag set to 1 - new data will persist until next profile update");
      
      // Clear market data cache
      if (typeof window !== 'undefined' && (window as any).cachedMarketData) {
        (window as any).cachedMarketData = null;
        (window as any).cacheTimestamp = null;
      }
      
      // Clear profiler cache when company profile is updated
      console.log("🧹 Clearing profiler cache due to company profile update");
      profilerCache.clearCache(currentUser?.uid);
      
      // Dispatch a global event to notify other components
      console.log("=== DISPATCHING COMPANY PROFILE UPDATE EVENT ===");
      console.log("Profile data being dispatched:", payload);
      const event = new CustomEvent('companyProfileUpdated', {
        detail: {
          profileData: payload,
          timestamp: new Date().toISOString(),
          action: 'PROFILE_SAVED',
          triggerICPRefresh: true,
          clearCaches: true
        }
      });
      window.dispatchEvent(event);
      console.log("Company profile event dispatched");
      
    } catch (error) {
      console.error("Error saving company profile:", error);
      alert("Failed to save company profile. Please try again.");
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="p-6 bg-blue-50 rounded-lg border-l-4 border-blue-500">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Company Profile Settings</h3>
        <p className="text-sm text-blue-700 mb-4">
          Configure your company information to help AI agents understand your business context and goals.
        </p>
        
        {isLoading && (
          <div className="mb-4 p-3 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-700">Loading your company profile...</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Select value={formData.industry} onValueChange={(value) => handleInputChange("industry", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select your industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saas">SaaS</SelectItem>
                <SelectItem value="b2b-tech">B2B Tech</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="fintech">Fintech</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="e-commerce">E-commerce</SelectItem>
                <SelectItem value="consulting">Consulting</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companySize">Company Size</Label>
            <Select value={formData.companySize} onValueChange={(value) => handleInputChange("companySize", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select company size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-10">1–10</SelectItem>
                <SelectItem value="11-50">11–50</SelectItem>
                <SelectItem value="51-200">51–200</SelectItem>
                <SelectItem value="201-500">201–500</SelectItem>
                <SelectItem value="500+">500+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="companyUrl">Company URL</Label>
            <Input
              id="companyUrl"
              value={formData.companyUrl}
              onChange={(e) => handleInputChange("companyUrl", e.target.value)}
              placeholder="Enter your Company url"
            />
          </div>

          
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="socialMediaUrls">Social Media URLs</Label>
            {Array.isArray(socialMediaUrls) && socialMediaUrls.map((socialUrl, index) => (
              <div key={index} className="flex gap-2 items-center">
                <div className="w-24 text-sm font-medium text-gray-600">
                  {getPlatformLabel(socialUrl.platform)}:
                </div>
                <Input
                  value={socialUrl.url}
                  onChange={(e) => handleSocialMediaUrlChange(index, e.target.value)}
                  placeholder={`Enter your ${getPlatformLabel(socialUrl.platform)} URL`}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeSocialMediaUrl(index)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2 items-center">
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {socialPlatforms
                    .filter(platform => !Array.isArray(socialMediaUrls) || !socialMediaUrls.some(url => url.platform === platform.value))
                    .map(platform => (
                      <SelectItem key={platform.value} value={platform.value}>
                        {platform.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSocialMediaUrl}
                disabled={!selectedPlatform}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add URL
              </Button>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="targetMarkets">Target Markets</Label>
            {Array.isArray(targetMarkets) && targetMarkets.map((market, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  value={market}
                  onChange={(e) => handleTargetMarketChange(index, e.target.value)}
                  placeholder="e.g., North America – Mid-Market SaaS companies in cybersecurity and cloud infrastructure"
                  className="flex-1"
                />
                {targetMarkets.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeTargetMarket(index)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTargetMarket}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Target Market
            </Button>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="strategicGoals">
              Strategic Goals <span className="text-sm text-gray-500">(Use a SMART format: Specific, Measurable, Achievable, Relevant, Time-bound)</span>
            </Label>
            <Textarea
              id="strategicGoals"
              value={formData.strategicGoals}
              onChange={(e) => handleInputChange("strategicGoals", e.target.value)}
              placeholder="e.g., Expand to the APAC region within 12 months"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryGTMModel">Primary GTM Model</Label>
            <Select value={formData.primaryGTMModel} onValueChange={(value) => handleInputChange("primaryGTMModel", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select GTM model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plg">PLG (Product-Led Growth)</SelectItem>
                <SelectItem value="sales-led">Sales-led</SelectItem>
                <SelectItem value="channel-led">Channel-led</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revenueStage">Revenue Stage</Label>
            <Select value={formData.revenueStage} onValueChange={(value) => handleInputChange("revenueStage", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select revenue stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pre-revenue">Pre-revenue</SelectItem>
                <SelectItem value="under-1m">&lt;$1M</SelectItem>
                <SelectItem value="1m-10m">$1M–$10M</SelectItem>
                <SelectItem value="10m-plus">$10M+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="keyBuyerPersona">Key Buyer Persona</Label>
            <Input
              id="keyBuyerPersona"
              value={formData.keyBuyerPersona}
              onChange={(e) => handleInputChange("keyBuyerPersona", e.target.value)}
              placeholder="e.g., IT Director, VP of Marketing"
            />
          </div>
        </div>

          <div className="mt-6 pt-4 border-t border-blue-200">
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              Save Company Profile
            </Button>
          </div>
      </div>
    </div>
  );
}