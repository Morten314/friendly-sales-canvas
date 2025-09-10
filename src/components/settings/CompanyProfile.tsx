
// Legacy commented implementation - using the new implementation below



import { useState, useEffect } from "react";
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

  // Update form data when profileData changes
  useEffect(() => {
    if (profileData) {
      setFormData({
        industry: profileData.industry || "",
        companySize: profileData.companySize || "",
        companyUrl: profileData.companyUrl || "",
        strategicGoals: profileData.strategicGoals || "",
        primaryGTMModel: profileData.primaryGTMModel || "",
        revenueStage: profileData.revenueStage || "",
        keyBuyerPersona: profileData.keyBuyerPersona || "",
      });
      setTargetMarkets(profileData.targetMarkets || [""]);
      setSocialMediaUrls(profileData.socialMediaUrls || []);
    }
  }, [profileData]);

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
    setTargetMarkets([...targetMarkets, ""]);
  };

  const removeTargetMarket = (index: number) => {
    if (targetMarkets.length > 1) {
      const newTargetMarkets = targetMarkets.filter((_, i) => i !== index);
      setTargetMarkets(newTargetMarkets);
    }
  };

  const addSocialMediaUrl = () => {
    if (selectedPlatform) {
      setSocialMediaUrls([...socialMediaUrls, { platform: selectedPlatform, url: "" }]);
      setSelectedPlatform("");
    }
  };

  const removeSocialMediaUrl = (index: number) => {
    const newSocialMediaUrls = socialMediaUrls.filter((_, i) => i !== index);
    setSocialMediaUrls(newSocialMediaUrls);
  };

  const handleSocialMediaUrlChange = (index: number, value: string) => {
    const newSocialMediaUrls = [...socialMediaUrls];
    newSocialMediaUrls[index].url = value;
    setSocialMediaUrls(newSocialMediaUrls);
  };

  const getPlatformLabel = (platform: string) => {
    return socialPlatforms.find(p => p.value === platform)?.label || platform;
  };

  const handleSave = async () => {
    console.log("=== COMPANY PROFILE SAVE TRIGGERED ===");
    console.log("Form data:", formData);
    console.log("Target markets:", targetMarkets);
    console.log("Social media URLs:", socialMediaUrls);
    
    const payload = {
      industry: formData.industry,
      companySize: formData.companySize,
      companyUrl: formData.companyUrl,
      strategicGoals: formData.strategicGoals,
      primaryGTMModel: formData.primaryGTMModel,
      revenueStage: formData.revenueStage,
      keyBuyerPersona: formData.keyBuyerPersona,
      targetMarkets: targetMarkets.filter(market => market.trim() !== ""),
      socialMediaUrls: socialMediaUrls.map(url => ({
        platform: getPlatformLabel(url.platform),
        url: url.url,
      })),
    };

    console.log("=== PAYLOAD TO SEND ===", payload);

    try {
      const response = await fetch("https://backend-11kr.onrender.com/profile/company", {
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
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Company profile saved successfully:", data);
      alert("Company profile saved successfully!");
      
      // Store the updated profile data immediately in localStorage
      console.log("=== STORING UPDATED PROFILE DATA ===");
      localStorage.setItem('companyProfile', JSON.stringify(profileData));
      localStorage.setItem('companyProfileForRefresh', JSON.stringify(profileData));
      
      // Set flag to indicate new company profile data is available
      localStorage.setItem('companyProfileUpdated', '1');
      console.log("🏁 Company profile update flag set to 1 - new data will persist until next profile update");
      
      // Clear market data cache
      if (typeof window !== 'undefined' && (window as any).cachedMarketData) {
        (window as any).cachedMarketData = null;
        (window as any).cacheTimestamp = null;
      }
      
      // Dispatch a global event to notify other components
      console.log("=== DISPATCHING COMPANY PROFILE UPDATE EVENT ===");
      console.log("Profile data being dispatched:", profileData);
      const event = new CustomEvent('companyProfileUpdated', {
        detail: {
          profileData,
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
            {socialMediaUrls.map((socialUrl, index) => (
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
                    .filter(platform => !socialMediaUrls.some(url => url.platform === platform.value))
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
            {targetMarkets.map((market, index) => (
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
