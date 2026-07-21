import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { mapApiDataToCompanyProfileFields } from "./companyProfileMapping";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/components/ui/use-toast";
import { qk } from "@/shared/api/queryKeys";
import { useAuthToken } from "@/shared/auth";
import { INDUSTRY_OPTIONS, useCompanyProfile } from "@/shared/company-profile";
import {
  ensureMissionProfilerScope,
  isMissionControlCacheValid,
  getMissionControlCompanyProfileJson,
  invalidateProfilerCache,
} from "@/shared/profiler";
import type { UntypedBackendApiResponse } from "@/shared/types/escape-hatches";

interface CompanyProfileFormProps {
  /**
   * Reports the company-profile "saved" state to the page so it can derive the
   * customer-profile / data-sources tab locks. The form is the single source of
   * truth for saved-state because it must be computed across all four paths
   * (mount apply, localStorage failover, save success, 404/empty) — a pure
   * derivation from useCompanyProfile().data would break the localStorage
   * failover (when the API fails but a saved profile exists locally).
   */
  onSavedChange?: (saved: boolean) => void;
}

export default function CompanyProfileForm({ onSavedChange }: CompanyProfileFormProps) {
  const { toast } = useToast();
  const { currentUser, orgId } = useAuthToken();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  const queryClient = useQueryClient();

  const [isSaving, setIsSaving] = useState(false);

  // Form state for company profile
  const [companyProfile, setCompanyProfile] = useState({
    companyName: "",
    headquarters: "",
    employeeSize: "",
    industry: "",
    revenue: "",
    gtmModel: "",
    regionFocus: "",
    dealSize: "",
    companyUrl: "",
    keyBuyerPersona: "",
    goals: "",
    painPoints: "",
    targetSegments: "",
    excludeSegments: "",
    compliance: "",
    constraints: "",
  });

  // Read path — shares ONE TanStack cache entry with the page's own
  // useCompanyProfile(orgIdToUse) call (a single GET /api/profile/company). The
  // hook resolves to null on any non-ZodError failure (404/5xx/CORS), which we
  // treat as "no profile yet" and fall back to localStorage — matching the old
  // bare-fetch + retry behavior.
  const { data: companyData } = useCompanyProfile(orgIdToUse, !!currentUser?.uid);

  // Helper: load profile from localStorage — the form's failover. Returns the raw
  // payload when successful. Seeds form fields and reports saved-state. Wrapped in
  // useCallback keyed on onSavedChange (the only non-stable closed-over value;
  // setCompanyProfile is a stable setter) so it's a safe, accurate effect dep.
  const loadProfileFromLocalStorage = useCallback(
    async (userId: string): Promise<Record<string, unknown> | null> => {
      try {
        const { getUserLocalStorage } = await import("@/shared/lib/cacheUtils");
        const localData = getUserLocalStorage("companyProfile", userId);
        if (localData) {
          const localProfile = JSON.parse(localData) as Record<string, unknown>;
          if (localProfile.user_id === userId) {
            const profileData = {
              companyName: (localProfile.company_name || localProfile.companyName || "") as string,
              headquarters: (localProfile.headquarters || "") as string,
              employeeSize: (localProfile.employee_size ||
                localProfile.employeeSize ||
                "") as string,
              industry: (localProfile.industry || "") as string,
              revenue: (localProfile.revenue_band || localProfile.revenue || "") as string,
              gtmModel: (localProfile.gtm_model || localProfile.gtmModel || "") as string,
              regionFocus: (localProfile.region_focus || localProfile.regionFocus || "") as string,
              dealSize: (localProfile.typical_deal_size || localProfile.dealSize || "") as string,
              companyUrl: (localProfile.company_url || localProfile.companyUrl || "") as string,
              keyBuyerPersona: (localProfile.key_buyer_persona ||
                localProfile.keyBuyerPersona ||
                "") as string,
              goals: (localProfile.goals || "") as string,
              painPoints: (localProfile.pain_points || localProfile.painPoints || "") as string,
              targetSegments: (localProfile.target_segments ||
                localProfile.targetSegments ||
                "") as string,
              excludeSegments: (localProfile.exclude_segments ||
                localProfile.excludeSegments ||
                "") as string,
              compliance: (localProfile.compliance || "") as string,
              constraints: (localProfile.constraints || "") as string,
            };
            setCompanyProfile(profileData);
            if (localProfile.company_name || localProfile.companyName) {
              onSavedChange?.(true);
            }
            return localProfile;
          }
        }
      } catch (e) {
        console.error("MissionControl: Error loading from localStorage:", e);
      }
      return null;
    },
    [onSavedChange],
  );

  // Apply the company FIELDS from an API/cache payload to the form + report
  // saved-state. (The page owns the data_sources branch.) Wrapped in useCallback
  // keyed on onSavedChange (its only non-stable closed-over value) so it's a safe,
  // accurate effect dependency.
  const applyCompanyProfileFieldsToForm = useCallback(
    (data: UntypedBackendApiResponse, userId: string) => {
      if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
        return;
      }
      const profileData = mapApiDataToCompanyProfileFields(data, userId);
      if (profileData) {
        setCompanyProfile(profileData);
        const companyName = (
          data.company_name ||
          data.companyName ||
          profileData.companyName ||
          ""
        ).trim();
        onSavedChange?.(companyName.length > 0);
      }
    },
    [onSavedChange],
  );

  // Mount seed: hydrate the FORM FIELDS from the profiler cache pre-check so the
  // form shows cached values immediately (matches today's loadProfileData cache
  // branch). Runs once per user/org identity. applyCompanyProfileFieldsToForm is a
  // useCallback (re-created only when onSavedChange changes); the page passes the
  // stable setIsCompanyProfileSaved setter, so this effect does not re-fire in a loop.
  useEffect(() => {
    if (!currentUser?.uid) return;
    const userId = currentUser.uid;
    ensureMissionProfilerScope(userId, orgIdToUse);
    if (isMissionControlCacheValid(userId, orgIdToUse)) {
      const cached = getMissionControlCompanyProfileJson(userId, orgIdToUse);
      if (cached) {
        applyCompanyProfileFieldsToForm(cached, userId);
      }
    }
  }, [currentUser?.uid, orgIdToUse, applyCompanyProfileFieldsToForm]);

  // Read effect: when the shared query resolves, hydrate the form fields from the
  // backend payload. The `=== null` branch is deliberate: the hook resolves to null
  // ONLY when it swallowed a non-2xx / network failure (404/5xx/CORS) → run the
  // localStorage failover; while the query is still loading `companyData` is
  // `undefined` (not null), so loading is intentionally excluded and we do nothing.
  useEffect(() => {
    if (!currentUser?.uid) return;
    const userId = currentUser.uid;
    if (companyData) {
      applyCompanyProfileFieldsToForm(companyData as UntypedBackendApiResponse, userId);
    } else if (companyData === null) {
      void loadProfileFromLocalStorage(userId);
    }
  }, [
    companyData,
    currentUser?.uid,
    orgIdToUse,
    applyCompanyProfileFieldsToForm,
    loadProfileFromLocalStorage,
  ]);

  const handleSave = async () => {
    if (!currentUser?.uid) {
      toast({
        title: "Authentication required",
        description: "Please log in to save your profile.",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields before saving
    const trimmedCompanyName = companyProfile.companyName.trim();
    if (!trimmedCompanyName) {
      toast({
        title: "Validation failed",
        description: "Please complete all required fields to proceed.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Prepare payload with profile_type as required by the API
      const payload = {
        org_id: orgIdToUse,
        profile_type: "company",
        company_name: trimmedCompanyName,
        headquarters: (companyProfile.headquarters || "").trim(),
        employee_size: (companyProfile.employeeSize || "").trim(),
        industry: (companyProfile.industry || "").trim(),
        revenue_band: (companyProfile.revenue || "").trim(),
        gtm_model: (companyProfile.gtmModel || "").trim(),
        region_focus: (companyProfile.regionFocus || "").trim(),
        typical_deal_size: (companyProfile.dealSize || "").trim(),
        company_url: (companyProfile.companyUrl || "").trim(),
        key_buyer_persona: (companyProfile.keyBuyerPersona || "").trim(),
        goals: (companyProfile.goals || "").trim(),
        pain_points: (companyProfile.painPoints || "").trim(),
        target_segments: (companyProfile.targetSegments || "").trim(),
        exclude_segments: (companyProfile.excludeSegments || "").trim(),
        compliance: (companyProfile.compliance || "").trim(),
        constraints: (companyProfile.constraints || "").trim(),
      };

      const apiUrl = `/api/profile/company?org_id=${orgIdToUse}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save profile: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Use the payload company_name since we already validated it before sending
      // The API may not return the saved data in the response, so we trust what we sent
      const savedCompanyName = (
        data?.company_name ||
        data?.companyName ||
        payload.company_name ||
        ""
      ).trim();

      // Double-check: if somehow both response and payload are empty (shouldn't happen due to validation)
      if (!savedCompanyName) {
        toast({
          title: "Save failed",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      // Save to localStorage for offline access and refresh persistence
      try {
        const { setUserLocalStorage } = await import("@/shared/lib/cacheUtils");
        const dataToSave = {
          ...data,
          user_id: currentUser.uid,
          company_name: payload.company_name,
          headquarters: payload.headquarters,
          employee_size: payload.employee_size,
          industry: payload.industry,
          revenue_band: payload.revenue_band,
          gtm_model: payload.gtm_model,
          region_focus: payload.region_focus,
          typical_deal_size: payload.typical_deal_size,
          company_url: payload.company_url,
          key_buyer_persona: payload.key_buyer_persona,
          goals: payload.goals,
          pain_points: payload.pain_points,
          target_segments: payload.target_segments,
          exclude_segments: payload.exclude_segments,
          compliance: payload.compliance,
          constraints: payload.constraints,
        };
        setUserLocalStorage("companyProfile", JSON.stringify(dataToSave), currentUser.uid);
      } catch (e) {
        console.warn("MissionControl: Failed to save to localStorage:", e);
      }

      toast({
        title: "Profile saved",
      });

      invalidateProfilerCache(currentUser.uid, orgIdToUse);

      // Keep the shared TanStack cache hot so the page's read-driven side effects
      // (data_sources, completeness, commit-cache, localStorage backup) see the
      // freshly-saved profile on the next resolve.
      void queryClient.invalidateQueries({ queryKey: qk.companyProfile(orgIdToUse) });

      // Only mark company profile as saved if we have a valid company name
      if (savedCompanyName) {
        onSavedChange?.(true);
      }

      // Verify data was actually saved by immediately fetching it back
      setTimeout(() => {
        void (async () => {
          try {
            const verifyResponse = await fetch(`/api/profile/company?org_id=${orgIdToUse}`, {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            });
            if (verifyResponse.ok) {
              const verifyData = await verifyResponse.json();
              const verifiedCompanyName = verifyData?.company_name || verifyData?.companyName || "";
              if (verifiedCompanyName.trim() === payload.company_name.trim()) {
                console.log("✅ MissionControl: Data persistence verified - company name matches");
              } else {
                console.error(
                  "❌ MissionControl: Data persistence FAILED - company name mismatch!",
                );
              }
            } else {
              console.warn(
                "⚠️ MissionControl: Could not verify data persistence - GET request failed",
              );
            }
          } catch (verifyError) {
            console.error("MissionControl: Error verifying data persistence:", verifyError);
          }
        })();
      }, 2000); // Wait 2 seconds for database to commit
    } catch (error) {
      console.error("Error saving company profile:", error);
      toast({
        title: "Save failed",
        description:
          error instanceof Error ? error.message : "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name *</Label>
            <Input
              id="company-name"
              placeholder="Enter company name"
              value={companyProfile.companyName}
              onChange={(e) =>
                setCompanyProfile((prev) => ({ ...prev, companyName: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-url">Company URL</Label>
            <Input
              id="company-url"
              type="url"
              placeholder="https://example.com"
              value={companyProfile.companyUrl}
              onChange={(e) =>
                setCompanyProfile((prev) => ({ ...prev, companyUrl: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="headquarters">Headquarters</Label>
            <Input
              id="headquarters"
              placeholder="City, Country"
              value={companyProfile.headquarters}
              onChange={(e) =>
                setCompanyProfile((prev) => ({ ...prev, headquarters: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-size">Employee Size</Label>
            <Select
              value={companyProfile.employeeSize}
              onValueChange={(value) =>
                setCompanyProfile((prev) => ({ ...prev, employeeSize: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-10">1-10</SelectItem>
                <SelectItem value="11-50">11-50</SelectItem>
                <SelectItem value="51-200">51-200</SelectItem>
                <SelectItem value="201-500">201-500</SelectItem>
                <SelectItem value="501-1000">501-1000</SelectItem>
                <SelectItem value="1000+">1000+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <CreatableCombobox
              id="industry"
              value={companyProfile.industry}
              onChange={(value) => setCompanyProfile((prev) => ({ ...prev, industry: value }))}
              options={INDUSTRY_OPTIONS}
              placeholder="Select industry"
              searchPlaceholder="Search or add an industry…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="revenue">Revenue Band</Label>
            <Select
              value={companyProfile.revenue}
              onValueChange={(value) => setCompanyProfile((prev) => ({ ...prev, revenue: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select revenue range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-1m">$0 - $1M</SelectItem>
                <SelectItem value="1-5m">$1M - $5M</SelectItem>
                <SelectItem value="5-10m">$5M - $10M</SelectItem>
                <SelectItem value="10-50m">$10M - $50M</SelectItem>
                <SelectItem value="50m+">$50M+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gtm-model">GTM Model</Label>
            <Select
              value={companyProfile.gtmModel}
              onValueChange={(value) => setCompanyProfile((prev) => ({ ...prev, gtmModel: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select GTM model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product-led">Product-Led Growth</SelectItem>
                <SelectItem value="sales-led">Sales-Led Growth</SelectItem>
                <SelectItem value="marketing-led">Marketing-Led Growth</SelectItem>
                <SelectItem value="hybrid">Hybrid Model</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Accordion type="multiple" className="space-y-4 mt-6">
          <AccordionItem value="priorities">
            <AccordionTrigger className="text-lg font-medium">Goals</AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="business-goals">Primary Business Goals</Label>
                    <Textarea
                      id="business-goals"
                      placeholder="Be as specific as possible - clearer goals help Brewra generate more accurate insights."
                      value={companyProfile.goals}
                      onChange={(e) =>
                        setCompanyProfile((prev) => ({ ...prev, goals: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pain-points">Key Pain Points We Solve</Label>
                    <Textarea
                      id="pain-points"
                      placeholder="Describe the key problems you're trying to solve. More detail leads to more relevant insights."
                      value={companyProfile.painPoints}
                      onChange={(e) =>
                        setCompanyProfile((prev) => ({
                          ...prev,
                          painPoints: e.target.value,
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="positioning">
            <AccordionTrigger className="text-lg font-medium">Market Positioning</AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="target-segments">Target Segments (Include)</Label>
                      <Textarea
                        id="target-segments"
                        placeholder="e.g., Mid-market SaaS companies, Financial services..."
                        value={companyProfile.targetSegments}
                        onChange={(e) =>
                          setCompanyProfile((prev) => ({
                            ...prev,
                            targetSegments: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exclude-segments">Exclude Segments</Label>
                      <Textarea
                        id="exclude-segments"
                        placeholder="e.g., Startups under 50 employees, Government..."
                        value={companyProfile.excludeSegments}
                        onChange={(e) =>
                          setCompanyProfile((prev) => ({
                            ...prev,
                            excludeSegments: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="compliance">
            <AccordionTrigger className="text-lg font-medium">
              Compliance & Constraints
            </AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="compliance-reqs">Compliance Requirements</Label>
                    <Textarea
                      id="compliance-reqs"
                      placeholder="e.g., GDPR, HIPAA, SOC2..."
                      value={companyProfile.compliance}
                      onChange={(e) =>
                        setCompanyProfile((prev) => ({
                          ...prev,
                          compliance: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="messaging-constraints">General Instruction</Label>
                    <Textarea
                      id="messaging-constraints"
                      placeholder="e.g., Avoid certain terms, required disclaimers..."
                      value={companyProfile.constraints}
                      onChange={(e) =>
                        setCompanyProfile((prev) => ({
                          ...prev,
                          constraints: e.target.value,
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button onClick={handleSave} className="w-full md:w-auto" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
