// Company profile settings — migrated to TanStack Query (spec 20 §3.6).

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CreatableCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyProfileResponse } from "@/shared/api/contracts";
import { useAuth } from "@/shared/auth";
import {
  INDUSTRY_OPTIONS,
  useCompanyProfile,
  useSaveCompanyProfile,
} from "@/shared/company-profile";
import { setUserLocalStorage } from "@/shared/lib/cacheUtils";

interface SocialMediaUrl {
  platform: string;
  url: string;
}

interface CompanyProfileProps {
  onProfileUpdate?: () => void;
  isEditMode?: boolean;
  // Retained so Settings' `commonProps` spread stays type-safe, but the form is
  // now driven by useCompanyProfile (the query supersedes the prop — spec 20 §3.6).
  // Re-typed off the `any` escape-hatch onto the zod contract (DoD item 6).
  profileData?: CompanyProfileResponse | null;
}

const EMPTY_FORM = {
  industry: "",
  companySize: "",
  companyUrl: "",
  strategicGoals: "",
  primaryGTMModel: "",
  revenueStage: "",
  keyBuyerPersona: "",
};

export function CompanyProfile(_props: CompanyProfileProps) {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [targetMarkets, setTargetMarkets] = useState<string[]>([""]);
  const [socialMediaUrls, setSocialMediaUrls] = useState<SocialMediaUrl[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");

  const { data: profile, isLoading } = useCompanyProfile(orgIdToUse, !!currentUser?.uid);
  const saveMutation = useSaveCompanyProfile(orgIdToUse);

  // Seed the form from the query result. Replaces the old "read localStorage,
  // then fetch on miss" cache on mount. When the query key changes (org switch)
  // or the user logs out, `profile` resets and the form clears — preserving the
  // old clear-on-user-change behavior.
  useEffect(() => {
    if (!currentUser?.uid || !profile) {
      setFormData(EMPTY_FORM);
      setTargetMarkets([""]);
      setSocialMediaUrls([]);
      return;
    }

    setFormData({
      industry: profile.industry || "",
      companySize: profile.companySize || "",
      companyUrl: profile.companyUrl || "",
      strategicGoals: profile.strategicGoals || "",
      primaryGTMModel: profile.primaryGTMModel || "",
      revenueStage: profile.revenueStage || "",
      keyBuyerPersona: profile.keyBuyerPersona || "",
    });
    setTargetMarkets(
      Array.isArray(profile.targetMarkets) && profile.targetMarkets.length > 0
        ? profile.targetMarkets
        : [""],
    );
    setSocialMediaUrls(Array.isArray(profile.socialMediaUrls) ? profile.socialMediaUrls : []);

    // Cross-component publish (preserved): MarketResearch + MissionControl still
    // read these localStorage keys (not migrated until Phases 5–7), so keep them
    // populated from the query result. Retire when those consumers migrate.
    const profileToSave = JSON.stringify({ ...profile, org_id: orgIdToUse });
    setUserLocalStorage("companyProfile", profileToSave, currentUser.uid);
    setUserLocalStorage("companyProfileForRefresh", profileToSave, currentUser.uid);
  }, [profile, currentUser?.uid, orgIdToUse]);

  const socialPlatforms = [
    { value: "linkedin", label: "LinkedIn" },
    { value: "instagram", label: "Instagram" },
    { value: "twitter", label: "Twitter" },
    { value: "facebook", label: "Facebook" },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
      setSocialMediaUrls([
        ...(Array.isArray(socialMediaUrls) ? socialMediaUrls : []),
        { platform: selectedPlatform, url: "" },
      ]);
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
    return socialPlatforms.find((p) => p.value === platform)?.label || platform;
  };

  const handleSave = async () => {
    if (!currentUser?.uid) {
      console.error("User not authenticated");
      alert("Please log in to save your company profile");
      return;
    }
    const payload = {
      org_id: orgIdToUse,
      industry: formData.industry,
      companySize: formData.companySize,
      companyUrl: formData.companyUrl,
      website: formData.companyUrl,
      strategicGoals: formData.strategicGoals,
      primaryGTMModel: formData.primaryGTMModel,
      gtmModel: formData.primaryGTMModel,
      revenueStage: formData.revenueStage,
      keyBuyerPersona: formData.keyBuyerPersona,
      targetMarkets: Array.isArray(targetMarkets)
        ? targetMarkets.filter((market) => market.trim() !== "")
        : [],
      socialMediaUrls: Array.isArray(socialMediaUrls)
        ? socialMediaUrls.map((url) => ({
            platform: getPlatformLabel(url.platform),
            url: url.url,
          }))
        : [],
    };

    try {
      // POST via the shared client (throws on non-2xx) + invalidate the query.
      await saveMutation.mutateAsync(payload);
      alert("Company profile saved successfully!");

      // Cross-component publish (preserved — see the note in the seed effect and
      // the listeners in DataSourcesManager / MarketResearch / Regulatory).
      setUserLocalStorage("companyProfile", JSON.stringify(payload), currentUser.uid);
      setUserLocalStorage("companyProfileForRefresh", JSON.stringify(payload), currentUser.uid);
      setUserLocalStorage("companyProfileUpdated", "1", currentUser.uid);

      // Clear the legacy in-memory market data cache.
      if (typeof window !== "undefined") {
        const w = window as unknown as Record<string, unknown>;
        if (w.cachedMarketData) {
          w.cachedMarketData = null;
          w.cacheTimestamp = null;
        }
      }

      // Notify other components.
      const event = new CustomEvent("companyProfileUpdated", {
        detail: {
          profileData: payload,
          timestamp: new Date().toISOString(),
          action: "PROFILE_SAVED",
          triggerICPRefresh: true,
          clearCaches: true,
        },
      });
      window.dispatchEvent(event);
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
          Configure your company information to help AI agents understand your business context and
          goals.
        </p>

        {isLoading && (
          <div className="mb-4 p-3 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-700">Loading your company profile...</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <CreatableCombobox
              id="industry"
              value={formData.industry}
              onChange={(value) => handleInputChange("industry", value)}
              options={INDUSTRY_OPTIONS}
              placeholder="Select your industry"
              searchPlaceholder="Search or add an industry…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companySize">Company Size</Label>
            <Select
              value={formData.companySize}
              onValueChange={(value) => handleInputChange("companySize", value)}
            >
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
            {Array.isArray(socialMediaUrls) &&
              socialMediaUrls.map((socialUrl, index) => (
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
                    .filter(
                      (platform) =>
                        !Array.isArray(socialMediaUrls) ||
                        !socialMediaUrls.some((url) => url.platform === platform.value),
                    )
                    .map((platform) => (
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
            {Array.isArray(targetMarkets) &&
              targetMarkets.map((market, index) => (
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
              Strategic Goals{" "}
              <span className="text-sm text-gray-500">
                (Use a SMART format: Specific, Measurable, Achievable, Relevant, Time-bound)
              </span>
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
            <Select
              value={formData.primaryGTMModel}
              onValueChange={(value) => handleInputChange("primaryGTMModel", value)}
            >
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
            <Select
              value={formData.revenueStage}
              onValueChange={(value) => handleInputChange("revenueStage", value)}
            >
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
