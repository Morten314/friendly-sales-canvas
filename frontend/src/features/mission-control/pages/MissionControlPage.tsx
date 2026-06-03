import {
  Building2,
  Database,
  CheckCircle,
  Upload as UploadIcon,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  Globe,
  Linkedin,
  Twitter,
  RefreshCw,
  XCircle,
  Plus,
  Slack,
} from "lucide-react";
import { useState, useEffect } from "react";

import DataSourcesManager from "../components/data-sources/DataSourcesManager";
import ICPManager from "../components/icp/ICPManager";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Layout } from "@/features/shell";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  ensureMissionProfilerScope,
  isMissionControlCacheValid,
  getMissionControlCompanyProfileJson,
  commitMissionControlCompanyProfile,
  invalidateMissionControlCache,
  invalidateProfilerCache,
} from "@/lib/missionProfilerSessionCache";
import type { UntypedBackendApiResponse } from "@/lib/types/escape-hatches";
import { extractIcpsDataFromFlexibleApiResponse } from "@/utils/profileIcpsExtract";

// Data Source Interface
interface DataSource {
  id: string;
  name: string;
  type: "crm" | "marketing" | "social" | "analytics" | "communication" | "file" | "custom";
  icon: typeof Database;
  platform: string;
  status:
    | "connected"
    | "disconnected"
    | "error"
    | "syncing"
    | "warning"
    | "uploaded"
    | "processing"
    | "empty";
  account?: string;
  connectedDate?: string;
  syncFrequency: "realtime" | "hourly" | "4hours" | "daily" | "weekly" | "manual";
  lastSyncTime?: string;
  lastSyncStatus?: "success" | "failed" | "partial";
  totalRecords: number;
  newRecordsThisWeek: number;
  updatedRecords: number;
  dataQualityScore: number;
  objectsSynced: string[];
  fieldsMapped: number;
  filters: string[];
  description?: string; // For file uploads
  error?: {
    message: string;
    code: string;
    occurredAt: string;
  };
}

// Available Connectors Catalog
interface Connector {
  id: string;
  name: string;
  type: DataSource["type"];
  icon: typeof Database;
  platform: string;
  description: string;
  category: string;
  isPopular?: boolean;
  isNew?: boolean;
}

const MissionControlPage = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [isCompanyProfileSaved, setIsCompanyProfileSaved] = useState(false);
  const [isCustomerProfileSaved, setIsCustomerProfileSaved] = useState(false);
  const [hasDataSources, setHasDataSources] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Tab locking logic - check if data exists in backend, not just session state
  // Customer profile is unlocked if company profile exists in backend
  const isCustomerProfileLocked = !isCompanyProfileSaved;
  // Data sources is unlocked if company profile exists (not dependent on customer profile)
  const isDataSourcesLocked = !isCompanyProfileSaved;
  const [isConnectorDialogOpen, setIsConnectorDialogOpen] = useState(false);

  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<DataSource | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [sourceToConfigure, setSourceToConfigure] = useState<DataSource | null>(null);
  const [configSyncFrequency, setConfigSyncFrequency] = useState<
    "realtime" | "hourly" | "4hours" | "daily" | "weekly" | "manual"
  >("daily");
  const [configObjects, setConfigObjects] = useState<string[]>([]);
  const [configFilters, setConfigFilters] = useState<string[]>([]);

  // Salesforce Auth Modal state
  const [isSalesforceAuthModalOpen, setIsSalesforceAuthModalOpen] = useState(false);
  const [salesforceSourceToConnect, setSalesforceSourceToConnect] = useState<DataSource | null>(
    null,
  );
  const [salesforceEmail, setSalesforceEmail] = useState("");
  const [salesforcePassword, setSalesforcePassword] = useState("");
  const [isSalesforceLoggingIn, setIsSalesforceLoggingIn] = useState(false);
  const [salesforceAuthStep, setSalesforceAuthStep] = useState<"login" | "permissions">("login");

  // HubSpot Auth Modal state
  const [isHubSpotAuthModalOpen, setIsHubSpotAuthModalOpen] = useState(false);
  const [hubSpotSourceToConnect, setHubSpotSourceToConnect] = useState<DataSource | null>(null);
  const [hubSpotEmail, setHubSpotEmail] = useState("");
  const [hubSpotPassword, setHubSpotPassword] = useState("");
  const [isHubSpotLoggingIn, setIsHubSpotLoggingIn] = useState(false);
  const [hubSpotAuthStep, setHubSpotAuthStep] = useState<"login" | "permissions">("login");

  // Pipedrive Auth Modal state
  const [isPipedriveAuthModalOpen, setIsPipedriveAuthModalOpen] = useState(false);
  const [pipedriveSourceToConnect, setPipedriveSourceToConnect] = useState<DataSource | null>(null);
  const [pipedriveEmail, setPipedriveEmail] = useState("");
  const [pipedrivePassword, setPipedrivePassword] = useState("");
  const [isPipedriveLoggingIn, setIsPipedriveLoggingIn] = useState(false);
  const [pipedriveAuthStep, setPipedriveAuthStep] = useState<"login" | "permissions">("login");

  // Zoho Auth Modal state
  const [isZohoAuthModalOpen, setIsZohoAuthModalOpen] = useState(false);
  const [zohoSourceToConnect, setZohoSourceToConnect] = useState<DataSource | null>(null);
  const [zohoEmail, setZohoEmail] = useState("");
  const [zohoPassword, setZohoPassword] = useState("");
  const [isZohoLoggingIn, setIsZohoLoggingIn] = useState(false);
  const [zohoAuthStep, setZohoAuthStep] = useState<"login" | "permissions">("login");

  // LinkedIn Auth Modal state
  const [isLinkedInAuthModalOpen, setIsLinkedInAuthModalOpen] = useState(false);
  const [linkedInSourceToConnect, setLinkedInSourceToConnect] = useState<DataSource | null>(null);
  const [linkedInEmail, setLinkedInEmail] = useState("");
  const [linkedInPassword, setLinkedInPassword] = useState("");
  const [isLinkedInLoggingIn, setIsLinkedInLoggingIn] = useState(false);
  const [linkedInAuthStep, setLinkedInAuthStep] = useState<"login" | "permissions">("login");

  // X (Twitter) Auth Modal state
  const [isXAuthModalOpen, setIsXAuthModalOpen] = useState(false);
  const [xSourceToConnect, setXSourceToConnect] = useState<DataSource | null>(null);
  const [xEmail, setXEmail] = useState("");
  const [xPassword, setXPassword] = useState("");
  const [isXLoggingIn, setIsXLoggingIn] = useState(false);
  const [xAuthStep, setXAuthStep] = useState<"login" | "permissions">("login");

  // Google Analytics Auth Modal state
  const [isGoogleAnalyticsAuthModalOpen, setIsGoogleAnalyticsAuthModalOpen] = useState(false);
  const [googleAnalyticsSourceToConnect, setGoogleAnalyticsSourceToConnect] =
    useState<DataSource | null>(null);
  const [googleAnalyticsEmail, setGoogleAnalyticsEmail] = useState("");
  const [isGoogleAnalyticsSigningIn, setIsGoogleAnalyticsSigningIn] = useState(false);
  const [googleAnalyticsAuthStep, setGoogleAnalyticsAuthStep] = useState<
    "signin" | "permissions" | "success"
  >("signin");

  // Mixpanel Auth Modal state
  const [isMixpanelAuthModalOpen, setIsMixpanelAuthModalOpen] = useState(false);
  const [mixpanelSourceToConnect, setMixpanelSourceToConnect] = useState<DataSource | null>(null);
  const [mixpanelEmail, setMixpanelEmail] = useState("");
  const [mixpanelPassword, setMixpanelPassword] = useState("");
  const [isMixpanelLoggingIn, setIsMixpanelLoggingIn] = useState(false);
  const [mixpanelAuthStep, setMixpanelAuthStep] = useState<"login" | "permissions">("login");

  // Form states for connector inputs
  const [selectedCrm, setSelectedCrm] = useState<string>("");
  const [linkedInUrls, setLinkedInUrls] = useState<string[]>([""]);
  const [selectedAnalytics, setSelectedAnalytics] = useState<string>("");
  const [competitors, setCompetitors] = useState<Array<{ name: string; url: string }>>([
    { name: "", url: "" },
  ]);
  const [slackConfigs, setSlackConfigs] = useState<Array<{ workspace: string; channel: string }>>([
    { workspace: "", channel: "" },
  ]);

  // File Sources state
  const [fileSources, setFileSources] = useState<
    Record<string, { file: File | null; destinationUrl: string }>
  >({
    "Call Transcripts": { file: null, destinationUrl: "" },
    "Meeting Notes": { file: null, destinationUrl: "" },
    "Case Studies": { file: null, destinationUrl: "" },
    "Support Tickets": { file: null, destinationUrl: "" },
    "Sales Presentations": { file: null, destinationUrl: "" },
  });

  // Product Documentation supports multiple files/destinations
  const [productDocFiles, setProductDocFiles] = useState<
    Array<{ file: File | null; destinationUrl: string }>
  >([{ file: null, destinationUrl: "" }]);

  const { toast } = useToast();
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  /** Profiler accept/delete set missionControlIcpsNeedRefetch — show loading until ICPManager GET finishes. */
  const [syncingProfilerCustomerProfile, setSyncingProfilerCustomerProfile] = useState(false);

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

      console.log("=== MISSION CONTROL: Saving company profile ===");
      console.log("Payload:", payload);

      const apiUrl = `/api/profile/company?org_id=${orgIdToUse}`;
      console.log("MissionControl: POST request URL:", apiUrl);
      console.log("MissionControl: POST request payload:", payload);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("MissionControl: POST response status:", response.status);
      console.log(
        "MissionControl: POST response headers:",
        Object.fromEntries(response.headers.entries()),
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("MissionControl: API Error:", response.status, errorText);
        console.error(
          "MissionControl: This could indicate database connection issues or backend problems",
        );
        throw new Error(`Failed to save profile: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("MissionControl: Company profile saved successfully:", data);
      console.log("MissionControl: Saved data verification:", {
        saved_user_id: data?.user_id,
        expected_user_id: currentUser.uid,
        user_id_match: data?.user_id === currentUser.uid,
        saved_company_name: data?.company_name,
        payload_company_name: payload.company_name,
        has_data: data && Object.keys(data).length > 0,
      });

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
        console.error(
          "MissionControl: Unexpected - company_name is empty in both response and payload!",
        );
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
        const { setUserLocalStorage } = await import("@/utils/cacheUtils");
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
        console.log("MissionControl: Saved company profile to localStorage");
      } catch (e) {
        console.warn("MissionControl: Failed to save to localStorage:", e);
      }

      toast({
        title: "Profile saved",
        // description: "profile saved",
      });

      invalidateProfilerCache(currentUser.uid, orgIdToUse);

      // Only mark company profile as saved if we have a valid company name
      if (savedCompanyName) {
        setIsCompanyProfileSaved(true);
        console.log("MissionControl: Company profile saved and customer profile unlocked");
      } else {
        console.warn(
          "MissionControl: Company profile saved but company name is empty - not unlocking customer profile",
        );
      }

      // Verify data was actually saved by immediately fetching it back
      console.log("MissionControl: Verifying data persistence by fetching saved profile...");
      setTimeout(() => {
        void (async () => {
          try {
            const verifyResponse = await fetch(`/api/profile/company?org_id=${orgIdToUse}`, {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            });
            if (verifyResponse.ok) {
              const verifyData = await verifyResponse.json();
              const savedCompanyName = verifyData?.company_name || verifyData?.companyName || "";
              if (savedCompanyName.trim() === payload.company_name.trim()) {
                console.log("✅ MissionControl: Data persistence verified - company name matches");
              } else {
                console.error(
                  "❌ MissionControl: Data persistence FAILED - company name mismatch!",
                );
                console.error("   Expected:", payload.company_name);
                console.error("   Got:", savedCompanyName);
                console.error("   This indicates a database write/read issue!");
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

  // Helper function to load profile from localStorage — returns raw payload when successful
  const loadProfileFromLocalStorage = async (
    userId: string,
  ): Promise<Record<string, unknown> | null> => {
    try {
      const { getUserLocalStorage } = await import("@/utils/cacheUtils");
      const localData = getUserLocalStorage("companyProfile", userId);
      if (localData) {
        const localProfile = JSON.parse(localData) as Record<string, unknown>;
        if (localProfile.user_id === userId) {
          console.log("MissionControl: Loading from localStorage fallback");
          const profileData = {
            companyName: (localProfile.company_name || localProfile.companyName || "") as string,
            headquarters: (localProfile.headquarters || "") as string,
            employeeSize: (localProfile.employee_size || localProfile.employeeSize || "") as string,
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
            setIsCompanyProfileSaved(true);
          }
          return localProfile;
        }
      }
    } catch (e) {
      console.error("MissionControl: Error loading from localStorage:", e);
    }
    return null;
  };

  // Helper function to map API data to form state
  const mapApiDataToFormState = (data: UntypedBackendApiResponse, userId: string) => {
    console.log("MissionControl: mapApiDataToFormState called with:", {
      data,
      dataType: typeof data,
      isNull: data === null,
      isUndefined: data === undefined,
      keys: data ? Object.keys(data) : [],
      userId,
    });

    // Check if data is empty or null
    if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
      console.log("MissionControl: API returned empty data");
      return null;
    }

    // Verify user_id matches (multi-tenancy safety)
    if (data.user_id && data.user_id !== userId) {
      console.warn("MissionControl: API returned profile for different user! Ignoring data.", {
        apiUserId: data.user_id,
        currentUserId: userId,
      });
      return null;
    }

    // Map API response to form state (handle both snake_case and camelCase)
    // Trim whitespace and handle empty strings properly
    const profileData = {
      companyName: (data.company_name || data.companyName || "").trim(),
      headquarters: (data.headquarters || "").trim(),
      employeeSize: (data.employee_size || data.employeeSize || "").trim(),
      industry: (data.industry || "").trim(),
      revenue: (data.revenue_band || data.revenue || "").trim(),
      gtmModel: (data.gtm_model || data.gtmModel || "").trim(),
      regionFocus: (data.region_focus || data.regionFocus || "").trim(),
      dealSize: (data.typical_deal_size || data.dealSize || "").trim(),
      companyUrl: (data.company_url || data.companyUrl || "").trim(),
      keyBuyerPersona: (data.key_buyer_persona || data.keyBuyerPersona || "").trim(),
      goals: (data.goals || "").trim(),
      painPoints: (data.pain_points || data.painPoints || "").trim(),
      targetSegments: (data.target_segments || data.targetSegments || "").trim(),
      excludeSegments: (data.exclude_segments || data.excludeSegments || "").trim(),
      compliance: (data.compliance || "").trim(),
      constraints: (data.constraints || "").trim(),
    };

    console.log("MissionControl: Mapped profile data result:", profileData);
    console.log("MissionControl: Profile data values (showing empty strings):", {
      companyName: `"${profileData.companyName}"`,
      headquarters: `"${profileData.headquarters}"`,
      employeeSize: `"${profileData.employeeSize}"`,
      industry: `"${profileData.industry}"`,
      revenue: `"${profileData.revenue}"`,
      gtmModel: `"${profileData.gtmModel}"`,
      regionFocus: `"${profileData.regionFocus}"`,
      dealSize: `"${profileData.dealSize}"`,
      companyUrl: `"${profileData.companyUrl}"`,
      keyBuyerPersona: `"${profileData.keyBuyerPersona}"`,
      goals: `"${profileData.goals}"`,
      painPoints: `"${profileData.painPoints}"`,
      targetSegments: `"${profileData.targetSegments}"`,
      excludeSegments: `"${profileData.excludeSegments}"`,
      compliance: `"${profileData.compliance}"`,
      constraints: `"${profileData.constraints}"`,
    });
    return profileData;
  };

  const applyCompanyProfileJsonToMissionControlUi = (
    data: UntypedBackendApiResponse,
    userId: string,
  ) => {
    if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
      return;
    }
    const profileData = mapApiDataToFormState(data, userId);
    if (profileData) {
      setCompanyProfile(profileData);
      const companyName = (
        data.company_name ||
        data.companyName ||
        profileData.companyName ||
        ""
      ).trim();
      const hasCompanyName = companyName.length > 0;
      if (hasCompanyName) {
        setIsCompanyProfileSaved(true);
      } else {
        setIsCompanyProfileSaved(false);
      }
    }
    if (
      data.data_sources &&
      data.data_sources.sources &&
      Array.isArray(data.data_sources.sources)
    ) {
      const loadedSources: DataSource[] = data.data_sources.sources.map(
        (source: UntypedBackendApiResponse) => ({
          id: source.id || `source-${Date.now()}-${Math.random()}`,
          name: source.name || "",
          type: (source.type || "custom") as DataSource["type"],
          icon: Database,
          platform: source.platform || "Custom",
          status: (source.status || "disconnected") as DataSource["status"],
          syncFrequency: (source.sync_frequency || "daily") as DataSource["syncFrequency"],
          totalRecords: source.total_records || 0,
          newRecordsThisWeek: source.new_records_this_week || 0,
          updatedRecords: source.updated_records || 0,
          dataQualityScore: source.data_quality_score || 0,
          objectsSynced: [],
          fieldsMapped: 0,
          filters: [],
          description: source.description || "",
          account: source.account,
        }),
      );
      setDataSources(loadedSources);
      if (loadedSources.length > 0) {
        setHasDataSources(true);
      }
    }
  };

  const applyCustomerProfileCompletenessFromPayload = (data: Record<string, unknown>) => {
    const icpsData = extractIcpsDataFromFlexibleApiResponse(data);
    setIsCustomerProfileSaved(Array.isArray(icpsData) && icpsData.length > 0);
  };

  const applyCustomerProfileCompletenessFromBackend = async (
    _userId: string,
    orgId: string,
    data: Record<string, unknown>,
  ) => {
    let icpsData = extractIcpsDataFromFlexibleApiResponse(data);
    if (icpsData.length === 0) {
      try {
        const legacyRes = await fetch(`/api/customer_profile?org_id=${encodeURIComponent(orgId)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (legacyRes.ok) {
          const legacy = (await legacyRes.json()) as Record<string, unknown>;
          icpsData = extractIcpsDataFromFlexibleApiResponse(legacy);
        }
      } catch {
        /* ignore */
      }
    }
    setIsCustomerProfileSaved(Array.isArray(icpsData) && icpsData.length > 0);
  };

  useEffect(() => {
    const onIcpLoadFinished = () => setSyncingProfilerCustomerProfile(false);
    window.addEventListener("icpManagerCustomerProfileLoadFinished", onIcpLoadFinished);
    return () =>
      window.removeEventListener("icpManagerCustomerProfileLoadFinished", onIcpLoadFinished);
  }, []);

  // Check URL params for tab after profile loads
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    if (tabParam === "customer-profile" && !isCustomerProfileLocked) {
      setActiveTab("customer-profile");
      // Clean up URL param after setting tab
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (tabParam === "sources" && !isDataSourcesLocked) {
      setActiveTab("sources");
      // Clean up URL param after setting tab
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (tabParam === "profile") {
      setActiveTab("profile");
      // Clean up URL param after setting tab
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [isCustomerProfileLocked, isDataSourcesLocked]); // Run after locks are determined

  // Load existing profile data on mount
  useEffect(() => {
    const loadProfileData = async () => {
      if (!currentUser?.uid) {
        console.log("MissionControl: No user ID, skipping profile load");
        return;
      }

      const userId = currentUser.uid;
      ensureMissionProfilerScope(userId, orgIdToUse);
      if (isMissionControlCacheValid(userId, orgIdToUse)) {
        const cached = getMissionControlCompanyProfileJson(userId, orgIdToUse);
        if (cached) {
          applyCompanyProfileJsonToMissionControlUi(cached, userId);
          applyCustomerProfileCompletenessFromPayload(cached);
        }
        setIsLoadingProfile(false);
        return;
      }

      setIsLoadingProfile(true);
      try {
        let retryCount = 0;
        const maxRetries = 2;
        const retryDelay = 1000; // 1 second

        while (retryCount <= maxRetries) {
          try {
            console.log(
              `MissionControl: Loading company profile for user: ${userId} (attempt ${retryCount + 1})`,
            );

            const response = await fetch(`/api/profile/company?org_id=${orgIdToUse}`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            });

            if (response.ok) {
              const data = await response.json();
              console.log("MissionControl: Loaded company profile data:", data);
              console.log("MissionControl: Data keys:", Object.keys(data || {}));
              console.log("MissionControl: company_name:", data?.company_name);
              console.log("MissionControl: companyName:", data?.companyName);
              console.log("MissionControl: Full data structure:", JSON.stringify(data, null, 2));

              // Database health check - verify if COMPANY PROFILE fields exist but are empty
              // Check specifically for company profile fields, not customer_profiles or other nested data
              const companyProfileFields = [
                "company_name",
                "companyName",
                "headquarters",
                "employee_size",
                "employeeSize",
                "industry",
                "revenue_band",
                "revenue",
                "gtm_model",
                "gtmModel",
                "region_focus",
                "regionFocus",
                "typical_deal_size",
                "dealSize",
                "company_url",
                "companyUrl",
                "key_buyer_persona",
                "keyBuyerPersona",
              ];

              const hasAnyData = data && Object.keys(data).length > 0;
              const hasCompanyProfileData =
                data &&
                companyProfileFields.some((field) => {
                  const value = data[field];
                  return (
                    value !== null &&
                    value !== undefined &&
                    value !== "" &&
                    (typeof value !== "object" || (Array.isArray(value) && value.length > 0))
                  );
                });

              console.log("MissionControl: Database health check:", {
                hasAnyData: hasAnyData,
                hasCompanyProfileData: hasCompanyProfileData,
                company_name: `"${data?.company_name || ""}"`,
                companyName: `"${data?.companyName || ""}"`,
                dataKeysCount: data ? Object.keys(data).length : 0,
                user_id_in_response: data?.user_id,
                expected_user_id: userId,
                user_id_match: data?.user_id === userId,
                response_status: response.status,
              });

              // Check if company profile fields are empty (even if customer_profiles exists)
              if (hasAnyData && !hasCompanyProfileData) {
                console.warn(
                  "⚠️ MissionControl: API returned profile structure but COMPANY PROFILE fields are empty!",
                );
                console.warn("⚠️ This could indicate:");
                console.warn("   1. Database was reset/cleared");
                console.warn("   2. Data was deleted");
                console.warn("   3. Backend service restarted and lost data");
                console.warn("   4. Database connection issue");
                console.warn("   5. Transaction rollback occurred");

                // Try to load from localStorage as backup BEFORE processing empty API data
                console.log("MissionControl: Attempting to load from localStorage as backup...");
                const localRaw = await loadProfileFromLocalStorage(userId);
                if (localRaw) {
                  console.log("✅ MissionControl: Successfully loaded from localStorage backup");
                  setIsLoadingProfile(false);
                  return; // Exit retry loop - don't process empty API data
                } else {
                  console.warn(
                    "⚠️ MissionControl: No localStorage backup available, will proceed with empty data",
                  );
                }
              }

              const profileData = mapApiDataToFormState(data, userId);
              console.log("MissionControl: Mapped profile data:", profileData);

              if (profileData) {
                applyCompanyProfileJsonToMissionControlUi(data, userId);
                void applyCustomerProfileCompletenessFromBackend(
                  userId,
                  orgIdToUse,
                  data as Record<string, unknown>,
                );

                const companyName = (
                  data.company_name ||
                  data.companyName ||
                  profileData.companyName ||
                  ""
                ).trim();
                const hasCompanyName = companyName.length > 0;

                if (
                  hasCompanyName ||
                  profileData.headquarters ||
                  profileData.industry ||
                  profileData.revenue
                ) {
                  try {
                    const { setUserLocalStorage } = await import("@/utils/cacheUtils");
                    const dataToSave = {
                      ...data,
                      ...profileData,
                      user_id: userId,
                      company_name: profileData.companyName || data.company_name || "",
                      companyName: profileData.companyName || data.companyName || "",
                    };
                    setUserLocalStorage("companyProfile", JSON.stringify(dataToSave), userId);
                    console.log("MissionControl: Saved company profile to localStorage");
                  } catch (e) {
                    console.warn("MissionControl: Failed to save to localStorage:", e);
                  }
                } else {
                  console.log(
                    "MissionControl: Skipping localStorage save - no meaningful company profile data",
                  );
                }

                commitMissionControlCompanyProfile(
                  userId,
                  orgIdToUse,
                  data as Record<string, unknown>,
                );
                setIsLoadingProfile(false);
                return; // Success, exit retry loop
              } else {
                // Data validation failed, try localStorage
                console.log("MissionControl: Data validation failed, trying localStorage fallback");
                const localRaw = await loadProfileFromLocalStorage(userId);
                if (localRaw) {
                  setIsLoadingProfile(false);
                  return;
                }
              }
            } else {
              // Try to get error message from response
              let errorMessage = `HTTP ${response.status}`;
              try {
                const errorData = await response.text();
                if (errorData) {
                  try {
                    const parsedError = JSON.parse(errorData);
                    errorMessage = parsedError.message || parsedError.error || errorMessage;
                  } catch {
                    errorMessage = errorData.substring(0, 200); // First 200 chars if not JSON
                  }
                }
              } catch (_e) {
                // Ignore errors reading response body
              }

              console.error(
                `MissionControl: Profile load response not OK: ${response.status} - ${errorMessage}`,
              );

              if (response.status === 404) {
                console.log(
                  "MissionControl: No company profile found (404) - trying localStorage fallback",
                );
                const localRaw = await loadProfileFromLocalStorage(userId);
                if (localRaw) {
                  setIsLoadingProfile(false);
                  return;
                }
                // 404 is expected for new users - no profile exists yet
                // Don't retry, just stop loading and let user create a new profile
                console.log(
                  "MissionControl: No company profile found (new user) - stopping load, user can create profile",
                );
                setIsLoadingProfile(false);
                setIsCompanyProfileSaved(false); // Ensure customer profile tab is locked
                return; // Exit retry loop - 404 is not an error, it's expected for new users
              } else if (response.status >= 500 && retryCount < maxRetries) {
                // Server error, retry
                console.log(`MissionControl: Server error ${response.status}, will retry...`);
                retryCount++;
                await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount));
                continue;
              } else {
                // Other error status, try localStorage
                console.log(
                  `MissionControl: API error (${response.status}), trying localStorage fallback`,
                );
                const localRaw = await loadProfileFromLocalStorage(userId);
                if (localRaw) {
                  setIsLoadingProfile(false);
                  return;
                }
              }
            }
          } catch (error: unknown) {
            const err = error as {
              name?: string;
              message?: string;
              stack?: string;
              constructor?: { name?: string };
            } | null;
            const errorDetails = {
              name: err?.name,
              message: err?.message,
              stack: err?.stack?.substring(0, 500), // First 500 chars of stack
              type: err?.constructor?.name,
            };
            console.error("MissionControl: Error loading company profile:", errorDetails);
            console.error("MissionControl: Full error object:", error);

            // Network error or other error, try localStorage if we haven't already
            if (retryCount === 0) {
              console.log("MissionControl: Network/connection error, trying localStorage fallback");
              const localRaw = await loadProfileFromLocalStorage(userId);
              if (localRaw) {
                console.log("MissionControl: Successfully loaded from localStorage fallback");
                setIsLoadingProfile(false);
                return;
              }
            }

            // If we've exhausted retries, try localStorage one more time
            if (retryCount >= maxRetries) {
              console.log(
                "MissionControl: All retries exhausted, trying localStorage as last resort",
              );
              const localRaw = await loadProfileFromLocalStorage(userId);
              if (localRaw) {
                console.log("MissionControl: Successfully loaded from localStorage as last resort");
              } else {
                console.warn("MissionControl: Failed to load from both API and localStorage");
              }
              setIsLoadingProfile(false);
              return;
            }

            retryCount++;
            if (retryCount <= maxRetries) {
              console.log(`MissionControl: Retrying... (attempt ${retryCount + 1})`);
              await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount));
            }
          }
        }
      } finally {
        setIsLoadingProfile(false);
      }

      // If we get here, all attempts failed
      console.warn("MissionControl: Failed to load company profile after all retries");
    };

    if (!currentUser?.uid) {
      return;
    }

    // Add a small delay to ensure user is fully initialized
    const timeoutId = setTimeout(() => {
      void loadProfileData();
    }, 100);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyCompanyProfileJsonToMissionControlUi is a stable helper closure; intentionally omitted to keep effect scoped to user/org identity changes
  }, [currentUser?.uid, orgIdToUse]);

  const handleSaveConfiguration = () => {
    if (!sourceToConfigure) return;

    setDataSources((prev) =>
      prev.map((s) => {
        if (s.id === sourceToConfigure.id) {
          return {
            ...s,
            syncFrequency: configSyncFrequency,
            objectsSynced: configObjects,
            filters: configFilters,
          };
        }
        return s;
      }),
    );

    toast({
      title: "Configuration saved",
      description: `${sourceToConfigure.name} configuration has been updated successfully.`,
    });

    setConfigDialogOpen(false);
    setSourceToConfigure(null);
  };

  const handleSalesforceLogin = async () => {
    if (!salesforceSourceToConnect) return;

    if (!salesforceEmail || !salesforcePassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsSalesforceLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsSalesforceLoggingIn(false);
      setSalesforceAuthStep("permissions");
    }, 1500);
  };

  const handleSalesforceApprove = () => {
    if (!salesforceSourceToConnect) return;

    // Update data source to connected
    setDataSources((prev) =>
      prev.map((s) => {
        if (s.id === salesforceSourceToConnect.id) {
          const mockData = {
            status: "connected" as const,
            account: salesforceEmail,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: Math.floor(Math.random() * 5000) + 100,
            newRecordsThisWeek: Math.floor(Math.random() * 100),
            updatedRecords: Math.floor(Math.random() * 50),
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: ["Contacts", "Accounts", "Opportunities"],
            fieldsMapped: Math.floor(Math.random() * 50) + 20,
            filters: ["Active records only"],
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );

    // Close modal and reset form
    setIsSalesforceAuthModalOpen(false);
    setSalesforceEmail("");
    setSalesforcePassword("");
    setSalesforceSourceToConnect(null);
    setSalesforceAuthStep("login");

    toast({
      title: "Salesforce connected successfully",
      description: "Your Salesforce account is now connected and syncing.",
    });
  };

  const handleSalesforceDeny = () => {
    // Close modal and reset form
    setIsSalesforceAuthModalOpen(false);
    setSalesforceEmail("");
    setSalesforcePassword("");
    setSalesforceSourceToConnect(null);
    setSalesforceAuthStep("login");

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Salesforce account.",
      variant: "default",
    });
  };

  const handleHubSpotLogin = async () => {
    if (!hubSpotSourceToConnect) return;

    if (!hubSpotEmail || !hubSpotPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsHubSpotLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsHubSpotLoggingIn(false);
      setHubSpotAuthStep("permissions");
    }, 1500);
  };

  const handleHubSpotApprove = () => {
    if (!hubSpotSourceToConnect) return;

    // Update data source to connected
    setDataSources((prev) =>
      prev.map((s) => {
        if (s.id === hubSpotSourceToConnect.id) {
          const mockData = {
            status: "connected" as const,
            account: hubSpotEmail,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: Math.floor(Math.random() * 5000) + 100,
            newRecordsThisWeek: Math.floor(Math.random() * 100),
            updatedRecords: Math.floor(Math.random() * 50),
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: ["Contacts", "Companies", "Deals", "Tickets"],
            fieldsMapped: Math.floor(Math.random() * 50) + 20,
            filters: ["Active records only"],
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );

    // Close modal and reset form
    setIsHubSpotAuthModalOpen(false);
    setHubSpotEmail("");
    setHubSpotPassword("");
    setHubSpotSourceToConnect(null);
    setHubSpotAuthStep("login");

    toast({
      title: "HubSpot connected successfully",
      description:
        "Your HubSpot account is now connected and syncing. Records and sync options are now available.",
    });
  };

  const handleHubSpotDeny = () => {
    // Close modal and reset form
    setIsHubSpotAuthModalOpen(false);
    setHubSpotEmail("");
    setHubSpotPassword("");
    setHubSpotSourceToConnect(null);
    setHubSpotAuthStep("login");

    toast({
      title: "Connection not authorized",
      description: "You denied access to your HubSpot account.",
      variant: "default",
    });
  };

  const handlePipedriveLogin = async () => {
    if (!pipedriveSourceToConnect) return;

    if (!pipedriveEmail || !pipedrivePassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsPipedriveLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsPipedriveLoggingIn(false);
      setPipedriveAuthStep("permissions");
    }, 1500);
  };

  const handlePipedriveApprove = () => {
    if (!pipedriveSourceToConnect) return;

    // Update data source to connected
    setDataSources((prev) =>
      prev.map((s) => {
        if (s.id === pipedriveSourceToConnect.id) {
          const mockData = {
            status: "connected" as const,
            account: pipedriveEmail,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: Math.floor(Math.random() * 5000) + 100,
            newRecordsThisWeek: Math.floor(Math.random() * 100),
            updatedRecords: Math.floor(Math.random() * 50),
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: ["Deals", "Persons", "Organizations", "Activities"],
            fieldsMapped: Math.floor(Math.random() * 50) + 20,
            filters: ["Active records only"],
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );

    // Close modal and reset form
    setIsPipedriveAuthModalOpen(false);
    setPipedriveEmail("");
    setPipedrivePassword("");
    setPipedriveSourceToConnect(null);
    setPipedriveAuthStep("login");

    toast({
      title: "Pipedrive connected successfully",
      description:
        "Your Pipedrive account is now connected and syncing. Records and sync options are now available.",
    });
  };

  const handlePipedriveDeny = () => {
    // Close modal and reset form
    setIsPipedriveAuthModalOpen(false);
    setPipedriveEmail("");
    setPipedrivePassword("");
    setPipedriveSourceToConnect(null);
    setPipedriveAuthStep("login");

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Pipedrive account.",
      variant: "default",
    });
  };

  const handleZohoLogin = async () => {
    if (!zohoSourceToConnect) return;

    if (!zohoEmail || !zohoPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsZohoLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsZohoLoggingIn(false);
      setZohoAuthStep("permissions");
    }, 1500);
  };

  const handleZohoApprove = () => {
    if (!zohoSourceToConnect) return;

    // Update data source to connected
    setDataSources((prev) =>
      prev.map((s) => {
        if (s.id === zohoSourceToConnect.id) {
          const mockData = {
            status: "connected" as const,
            account: zohoEmail,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: Math.floor(Math.random() * 5000) + 100,
            newRecordsThisWeek: Math.floor(Math.random() * 100),
            updatedRecords: Math.floor(Math.random() * 50),
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: ["Contacts", "Accounts", "Deals", "Leads"],
            fieldsMapped: Math.floor(Math.random() * 50) + 20,
            filters: ["Active records only"],
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );

    // Close modal and reset form
    setIsZohoAuthModalOpen(false);
    setZohoEmail("");
    setZohoPassword("");
    setZohoSourceToConnect(null);
    setZohoAuthStep("login");

    toast({
      title: "Zoho CRM connected successfully",
      description:
        "Your Zoho CRM account is now connected and syncing. Records and sync options are now available.",
    });
  };

  const handleZohoDeny = () => {
    // Close modal and reset form
    setIsZohoAuthModalOpen(false);
    setZohoEmail("");
    setZohoPassword("");
    setZohoSourceToConnect(null);
    setZohoAuthStep("login");

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Zoho CRM account.",
      variant: "default",
    });
  };

  const handleLinkedInLogin = async () => {
    if (!linkedInSourceToConnect) return;

    if (!linkedInEmail || !linkedInPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLinkedInLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsLinkedInLoggingIn(false);
      setLinkedInAuthStep("permissions");
    }, 1500);
  };

  const handleLinkedInApprove = () => {
    if (!linkedInSourceToConnect) return;

    // Update data source to connected
    setDataSources((prev) =>
      prev.map((s) => {
        if (s.id === linkedInSourceToConnect.id) {
          const mockData = {
            status: "connected" as const,
            account: linkedInEmail,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: Math.floor(Math.random() * 5000) + 100,
            newRecordsThisWeek: Math.floor(Math.random() * 100),
            updatedRecords: Math.floor(Math.random() * 50),
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced:
              linkedInSourceToConnect.name === "LinkedIn Company"
                ? ["Company Page", "Posts", "Followers"]
                : ["Company Pages", "Profiles", "Messages"],
            fieldsMapped: Math.floor(Math.random() * 50) + 20,
            filters: ["Active profiles only"],
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );

    // Close modal and reset form
    setIsLinkedInAuthModalOpen(false);
    setLinkedInEmail("");
    setLinkedInPassword("");
    setLinkedInSourceToConnect(null);
    setLinkedInAuthStep("login");

    toast({
      title: `${linkedInSourceToConnect.name} connected successfully`,
      description:
        "Your LinkedIn account is now connected and syncing. Records and sync options are now available.",
    });
  };

  const handleLinkedInDeny = () => {
    // Close modal and reset form
    setIsLinkedInAuthModalOpen(false);
    setLinkedInEmail("");
    setLinkedInPassword("");
    setLinkedInSourceToConnect(null);
    setLinkedInAuthStep("login");

    toast({
      title: "Connection not authorized",
      description: "You denied access to your LinkedIn account.",
      variant: "default",
    });
  };

  const handleXLogin = async () => {
    if (!xSourceToConnect) return;

    if (!xEmail || !xPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsXLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsXLoggingIn(false);
      setXAuthStep("permissions");
    }, 1500);
  };

  const handleXApprove = () => {
    if (!xSourceToConnect) return;

    // Update data source to connected
    setDataSources((prev) =>
      prev.map((s) => {
        if (s.id === xSourceToConnect.id) {
          const mockData = {
            status: "connected" as const,
            account: xEmail,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: Math.floor(Math.random() * 5000) + 100,
            newRecordsThisWeek: Math.floor(Math.random() * 100),
            updatedRecords: Math.floor(Math.random() * 50),
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: ["Profiles", "Tweets", "Engagements"],
            fieldsMapped: Math.floor(Math.random() * 50) + 20,
            filters: ["Active profiles only"],
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );

    // Close modal and reset form
    setIsXAuthModalOpen(false);
    setXEmail("");
    setXPassword("");
    setXSourceToConnect(null);
    setXAuthStep("login");

    toast({
      title: "X connected successfully",
      description:
        "Your X account is now connected and syncing. Records and sync options are now available.",
    });
  };

  const handleXDeny = () => {
    // Close modal and reset form
    setIsXAuthModalOpen(false);
    setXEmail("");
    setXPassword("");
    setXSourceToConnect(null);
    setXAuthStep("login");

    toast({
      title: "Connection not authorized",
      description: "You denied access to your X account.",
      variant: "default",
    });
  };

  const handleGoogleAnalyticsSignIn = async () => {
    if (!googleAnalyticsSourceToConnect) return;

    setIsGoogleAnalyticsSigningIn(true);

    // Simulate Google OAuth sign-in process, then show consent screen
    setTimeout(() => {
      setIsGoogleAnalyticsSigningIn(false);
      setGoogleAnalyticsAuthStep("permissions");
      // Set a mock email from Google account
      setGoogleAnalyticsEmail("user@gmail.com");
    }, 1500);
  };

  const handleGoogleAnalyticsApprove = () => {
    if (!googleAnalyticsSourceToConnect) return;

    // Update data source to connected
    setDataSources((prev) =>
      prev.map((s) => {
        if (s.id === googleAnalyticsSourceToConnect.id) {
          const mockData = {
            status: "connected" as const,
            account: googleAnalyticsEmail,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: Math.floor(Math.random() * 10000) + 500,
            newRecordsThisWeek: Math.floor(Math.random() * 500),
            updatedRecords: Math.floor(Math.random() * 200),
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: ["Page Views", "Events", "User Sessions", "Conversions"],
            fieldsMapped: Math.floor(Math.random() * 50) + 30,
            filters: ["Active properties only"],
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );

    // Show success state, then close modal after a brief delay
    setGoogleAnalyticsAuthStep("success");

    toast({
      title: "Google Analytics connected successfully",
      description:
        "Your Google Analytics account is now connected and syncing. Records and sync options are now available.",
    });

    // Close modal after showing success message
    setTimeout(() => {
      setIsGoogleAnalyticsAuthModalOpen(false);
      setGoogleAnalyticsEmail("");
      setGoogleAnalyticsSourceToConnect(null);
      setGoogleAnalyticsAuthStep("signin");
    }, 1500);
  };

  const handleGoogleAnalyticsDeny = () => {
    // Close modal and reset form
    setIsGoogleAnalyticsAuthModalOpen(false);
    setGoogleAnalyticsEmail("");
    setGoogleAnalyticsSourceToConnect(null);
    setGoogleAnalyticsAuthStep("signin");

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Google Analytics account.",
      variant: "default",
    });
  };

  const handleMixpanelLogin = async () => {
    if (!mixpanelSourceToConnect) return;

    if (!mixpanelEmail || !mixpanelPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsMixpanelLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsMixpanelLoggingIn(false);
      setMixpanelAuthStep("permissions");
    }, 1500);
  };

  const handleMixpanelApprove = () => {
    if (!mixpanelSourceToConnect) return;

    // Generate fake events count (124 as per requirement)
    const fakeEventsCount = 124;

    // Update data source to connected
    setDataSources((prev) =>
      prev.map((s) => {
        if (s.id === mixpanelSourceToConnect.id) {
          const mockData = {
            status: "connected" as const,
            account: mixpanelEmail,
            connectedDate: new Date().toISOString().split("T")[0],
            lastSyncTime: "Just now",
            lastSyncStatus: "success" as const,
            totalRecords: fakeEventsCount,
            newRecordsThisWeek: Math.floor(Math.random() * 500) + 100,
            updatedRecords: Math.floor(Math.random() * 200) + 50,
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: ["Page Viewed", "Sign Up", "Button Clicked", "Form Submitted"],
            fieldsMapped: Math.floor(Math.random() * 50) + 30,
            filters: ["Active projects only"],
          };
          return { ...s, ...mockData };
        }
        return s;
      }),
    );

    // Close modal and reset form
    setIsMixpanelAuthModalOpen(false);
    setMixpanelEmail("");
    setMixpanelPassword("");
    setMixpanelSourceToConnect(null);
    setMixpanelAuthStep("login");

    toast({
      title: "Mixpanel connected successfully",
      description:
        "Your Mixpanel account is now connected and syncing. Events and analytics are now available.",
    });
  };

  const handleMixpanelDeny = () => {
    // Close modal and reset form
    setIsMixpanelAuthModalOpen(false);
    setMixpanelEmail("");
    setMixpanelPassword("");
    setMixpanelSourceToConnect(null);
    setMixpanelAuthStep("login");

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Mixpanel account.",
      variant: "default",
    });
  };

  // Handle Slack OAuth callback (check for code/state in URL params)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    if (error) {
      // User denied access
      toast({
        title: "Slack connection cancelled",
        description: "You cancelled the Slack authorization.",
        variant: "default",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      sessionStorage.removeItem("slackSourceToConnect");
      return;
    }

    if (code && state) {
      // OAuth callback received from Slack
      try {
        const storedSource = sessionStorage.getItem("slackSourceToConnect");

        if (storedSource) {
          const sourceData = JSON.parse(storedSource);

          // Update data source to connected
          setDataSources((prev) =>
            prev.map((s) => {
              if (
                s.id === sourceData.id ||
                s.name === sourceData.name ||
                s.name.startsWith("Slack")
              ) {
                const mockData = {
                  status: "connected" as const,
                  account: "slack@company.com",
                  connectedDate: new Date().toISOString().split("T")[0],
                  lastSyncTime: "Just now",
                  lastSyncStatus: "success" as const,
                  totalRecords: Math.floor(Math.random() * 5000) + 100,
                  newRecordsThisWeek: Math.floor(Math.random() * 500) + 50,
                  updatedRecords: Math.floor(Math.random() * 200) + 20,
                  dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
                  objectsSynced: ["Messages", "Channels", "Conversations"],
                  fieldsMapped: Math.floor(Math.random() * 50) + 20,
                  filters: ["Active channels only"],
                };
                return { ...s, ...mockData };
              }
              return s;
            }),
          );

          // Clean up
          sessionStorage.removeItem("slackSourceToConnect");

          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);

          toast({
            title: "Slack connected successfully",
            description:
              "Your Slack workspace is now connected and syncing. Messages and channels are now available.",
          });
        }
      } catch (err) {
        console.error("Error processing Slack callback:", err);
        toast({
          title: "Error processing Slack callback",
          description: "There was an error processing the Slack authorization. Please try again.",
          variant: "destructive",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only OAuth callback handler; toast is stable
  }, []);

  // Helper function to upload file to backend
  // Helper function to check document status
  // Helper function to load data sources from backend
  // New handlers for Add Source
  const handleConnectSource = (connector: Connector) => {
    // Check if source already exists (regardless of status)
    const existingSource = dataSources.find((s) => s.name === connector.name);
    if (existingSource) {
      if (existingSource.status === "connected" || existingSource.status === "uploaded") {
        toast({
          title: "Already connected",
          description: `${connector.name} is already connected.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Already added",
          description: `${connector.name} is already in your sources. Click "Connect" to set it up.`,
          variant: "default",
        });
      }
      setIsConnectorDialogOpen(false);
      return;
    }

    // Create new data source
    const newSource: DataSource = {
      id: connector.id,
      name: connector.name,
      type: connector.type,
      icon: connector.icon,
      platform: connector.platform,
      status: "disconnected",
      syncFrequency: "daily",
      totalRecords: 0,
      newRecordsThisWeek: 0,
      updatedRecords: 0,
      dataQualityScore: 0,
      objectsSynced: [],
      fieldsMapped: 0,
      filters: [],
      description: connector.description,
    };

    // Add to data sources
    setDataSources((prev) => {
      // Double-check to prevent duplicates
      const alreadyExists = prev.find((s) => s.id === newSource.id || s.name === newSource.name);
      if (alreadyExists) {
        return prev;
      }
      return [...prev, newSource];
    });

    // Close dialog
    setIsConnectorDialogOpen(false);

    toast({
      title: `${connector.name} added`,
      description: `Click "Connect" to set up the integration.`,
    });
  };

  // Calculate overall completeness based on completed sections
  const calculateOverallCompleteness = () => {
    // Check both local dataSources state and the hasDataSources flag
    const hasLocalDataSources = dataSources.length > 0;
    const hasAnyDataSources = hasLocalDataSources || hasDataSources;

    if (hasAnyDataSources && isCustomerProfileSaved && isCompanyProfileSaved) {
      return 100;
    } else if (isCustomerProfileSaved && isCompanyProfileSaved) {
      return 55;
    } else if (isCompanyProfileSaved) {
      return 30;
    }
    return 0;
  };

  const overallCompleteness = calculateOverallCompleteness();

  // Listen for customer profile save events from ICPManager and Profiler
  useEffect(() => {
    const handleCustomerProfileSaved = (e: Event) => {
      setIsCustomerProfileSaved(true);
      const uid = currentUser?.uid;
      if (!uid) return;
      const fromProfiler =
        (e as CustomEvent<{ fromProfiler?: boolean }>).detail?.fromProfiler === true;
      if (fromProfiler) {
        invalidateMissionControlCache(uid, orgIdToUse);
        invalidateProfilerCache(uid, orgIdToUse);
      } else {
        invalidateProfilerCache(uid, orgIdToUse);
      }
    };

    window.addEventListener("customerProfileSaved", handleCustomerProfileSaved);

    return () => {
      window.removeEventListener("customerProfileSaved", handleCustomerProfileSaved);
    };
  }, [currentUser?.uid, orgIdToUse]);

  // Listen for data source added events from DataSourcesManager
  useEffect(() => {
    const handleDataSourceAdded = () => {
      // Data source was added in DataSourcesManager
      setHasDataSources(true);
    };

    window.addEventListener("dataSourceAdded", handleDataSourceAdded);

    return () => {
      window.removeEventListener("dataSourceAdded", handleDataSourceAdded);
    };
  }, [currentUser?.uid, orgIdToUse]);

  // Also update hasDataSources when local dataSources state changes
  useEffect(() => {
    if (dataSources.length > 0) {
      setHasDataSources(true);
    }
  }, [dataSources.length]);

  // Preload logo image to prevent delay when loading modal appears
  useEffect(() => {
    const preloadLogo = () => {
      const img = new Image();
      img.src = "/logo.png";
    };
    preloadLogo();
  }, []);

  return (
    <Layout>
      {/* Loading Modal */}
      <Dialog open={isLoadingProfile || syncingProfilerCustomerProfile} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md border-0 bg-transparent shadow-none p-0">
          <DialogTitle className="sr-only">
            {syncingProfilerCustomerProfile && !isLoadingProfile
              ? "Syncing customer profile"
              : "Loading company profile"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {syncingProfilerCustomerProfile && !isLoadingProfile
              ? "Fetching ICPs from the server after Profiler updates."
              : "Please wait while we fetch your company profile data."}
          </DialogDescription>
          <div className="flex flex-col items-center justify-center gap-6 p-8 bg-background rounded-lg border border-border shadow-2xl">
            {/* Animated Brewra Logo */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Brewra Logo"
                className="h-20 w-20 object-contain"
                loading="eager"
                style={{
                  animation: "logo-reveal 2.5s ease-in-out infinite",
                  clipPath: "inset(0% 0% 0% 0%)",
                }}
              />
            </div>
            {/* Loading Text */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg font-semibold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                {syncingProfilerCustomerProfile && !isLoadingProfile
                  ? "Syncing customer profile"
                  : "Loading company profile"}
              </p>
              <p className="text-sm text-muted-foreground font-medium text-center px-2">
                {syncingProfilerCustomerProfile && !isLoadingProfile
                  ? "Applying your Profiler changes — fetching ICPs from the server…"
                  : "Please wait while we fetch your data..."}
              </p>
            </div>
            {/* Animated Progress Dots */}
            <div className="flex gap-2">
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
              ></div>
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
              ></div>
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
              ></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Profile Completeness - Common to all tabs */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">Completeness:</span>
          <Progress value={overallCompleteness} className="w-32 h-1.5" />
          <span className="text-xs font-medium min-w-[2rem] text-right">
            {overallCompleteness}%
          </span>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            // Prevent switching to locked tabs
            if (value === "customer-profile" && isCustomerProfileLocked) {
              return;
            }
            if (value === "sources" && isDataSourcesLocked) {
              return;
            }
            setActiveTab(value);
          }}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 gap-1 md:gap-0">
            <TabsTrigger
              value="profile"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4"
            >
              <Building2 className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Company Profile</span>
              <span className="sm:hidden">Profile</span>
            </TabsTrigger>
            <TabsTrigger
              value="customer-profile"
              disabled={isCustomerProfileLocked}
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 disabled:opacity-50 disabled:cursor-not-allowed relative"
            >
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Customer Profile</span>
              <span className="sm:hidden">Customer</span>
              {isCustomerProfileLocked && <span className="ml-1 text-[10px]">🔒</span>}
            </TabsTrigger>
            <TabsTrigger
              value="sources"
              disabled={isDataSourcesLocked}
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 disabled:opacity-50 disabled:cursor-not-allowed relative"
            >
              <Database className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Data Sources</span>
              <span className="sm:hidden">Sources</span>
              {isDataSourcesLocked && <span className="ml-1 text-[10px]">🔒</span>}
            </TabsTrigger>
          </TabsList>

          {/* Company Profile Tab */}
          <TabsContent value="profile">
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
                    <Select
                      value={companyProfile.industry}
                      onValueChange={(value) =>
                        setCompanyProfile((prev) => ({ ...prev, industry: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="saas">SaaS</SelectItem>
                        <SelectItem value="fintech">FinTech</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                        <SelectItem value="enterprise">Enterprise Software</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenue">Revenue Band</Label>
                    <Select
                      value={companyProfile.revenue}
                      onValueChange={(value) =>
                        setCompanyProfile((prev) => ({ ...prev, revenue: value }))
                      }
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
                      onValueChange={(value) =>
                        setCompanyProfile((prev) => ({ ...prev, gtmModel: value }))
                      }
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
                    <AccordionTrigger className="text-lg font-medium">
                      Market Positioning
                    </AccordionTrigger>
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
          </TabsContent>

          {/* Customer Profile Tab — ICPManager mounts when this tab is selected; avoids showing ICP UI while other tabs are active */}
          <TabsContent value="customer-profile">
            <Card>
              <CardContent className="pt-6">
                <ICPManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Sources Tab */}
          <TabsContent value="sources">
            <DataSourcesManager />
          </TabsContent>
        </Tabs>

        {/* Connector Catalog Dialog */}
        <Dialog open={isConnectorDialogOpen} onOpenChange={setIsConnectorDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Data Source</DialogTitle>
              <DialogDescription>Configure and connect your data sources</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                {/* CRM Section */}
                <AccordionItem value="crm">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      CRM
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Select CRM Platform</Label>
                        <Select value={selectedCrm} onValueChange={setSelectedCrm}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a CRM platform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="salesforce">Salesforce</SelectItem>
                            <SelectItem value="hubspot">HubSpot</SelectItem>
                            <SelectItem value="pipedrive">Pipedrive</SelectItem>
                            <SelectItem value="zoho">Zoho CRM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedCrm && (
                        <Button
                          onClick={() => {
                            const crmNames: Record<string, string> = {
                              salesforce: "Salesforce",
                              hubspot: "HubSpot",
                              pipedrive: "Pipedrive",
                              zoho: "Zoho CRM",
                            };
                            const connector: Connector = {
                              id: `conn-${selectedCrm}`,
                              name: crmNames[selectedCrm],
                              type: "crm",
                              icon: Database,
                              platform: crmNames[selectedCrm],
                              description: `Connect your ${crmNames[selectedCrm]} CRM`,
                              category: "CRM",
                            };
                            handleConnectSource(connector);
                            toast({
                              title: `${crmNames[selectedCrm]} added`,
                              description:
                                "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                            setSelectedCrm("");
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Social Section */}
                <AccordionItem value="social">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4" />
                      Social
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {/* LinkedIn */}
                      <div className="space-y-3">
                        <Label>LinkedIn</Label>
                        {linkedInUrls.map((url, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              placeholder="Enter LinkedIn URL"
                              value={url}
                              onChange={(e) => {
                                const newUrls = [...linkedInUrls];
                                newUrls[index] = e.target.value;
                                setLinkedInUrls(newUrls);
                              }}
                            />
                            {index === linkedInUrls.length - 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setLinkedInUrls([...linkedInUrls, ""])}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            {linkedInUrls.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  const newUrls = linkedInUrls.filter((_, i) => i !== index);
                                  setLinkedInUrls(newUrls);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {linkedInUrls.some((url) => url.trim() !== "") && (
                          <Button
                            onClick={() => {
                              const connector: Connector = {
                                id: "conn-linkedin",
                                name: "LinkedIn Sales Navigator",
                                type: "social",
                                icon: Linkedin,
                                platform: "LinkedIn",
                                description: `LinkedIn URLs: ${linkedInUrls.filter((u) => u.trim()).join(", ")}`,
                                category: "Social",
                              };
                              handleConnectSource(connector);
                              toast({
                                title: "LinkedIn Sales Navigator added",
                                description:
                                  "Click 'Connect' in the table to set up the integration.",
                              });
                              setIsConnectorDialogOpen(false);
                              setLinkedInUrls([""]);
                            }}
                            className="w-full"
                          >
                            Add Source
                          </Button>
                        )}
                      </div>

                      {/* Twitter */}
                      <div className="space-y-3 pt-4 border-t">
                        <Label>X</Label>
                        <Button
                          onClick={() => {
                            const connector: Connector = {
                              id: "conn-twitter",
                              name: "X",
                              type: "social",
                              icon: Twitter,
                              platform: "Twitter",
                              description: "Connect X account",
                              category: "Social",
                            };
                            handleConnectSource(connector);
                            toast({
                              title: "X added",
                              description:
                                "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Analytics Section */}
                <AccordionItem value="analytics">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Select Analytics Platform</Label>
                        <Select value={selectedAnalytics} onValueChange={setSelectedAnalytics}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an analytics platform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="google-analytics">Google Analytics</SelectItem>
                            <SelectItem value="mixpanel">Mixpanel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedAnalytics && (
                        <Button
                          onClick={() => {
                            const analyticsNames: Record<string, string> = {
                              "google-analytics": "Google Analytics",
                              mixpanel: "Mixpanel",
                            };
                            const connector: Connector = {
                              id: `conn-${selectedAnalytics}`,
                              name: analyticsNames[selectedAnalytics],
                              type: "analytics",
                              icon: selectedAnalytics === "google-analytics" ? Globe : BarChart3,
                              platform: analyticsNames[selectedAnalytics],
                              description: `Connect ${analyticsNames[selectedAnalytics]}`,
                              category: "Analytics",
                            };
                            handleConnectSource(connector);
                            toast({
                              title: `${analyticsNames[selectedAnalytics]} added`,
                              description:
                                "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                            setSelectedAnalytics("");
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Competitors Section */}
                <AccordionItem value="competitors">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Competitors
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {competitors.map((competitor, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="Company Name"
                            value={competitor.name}
                            onChange={(e) => {
                              const newCompetitors = [...competitors];
                              newCompetitors[index].name = e.target.value;
                              setCompetitors(newCompetitors);
                            }}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Company URL"
                            value={competitor.url}
                            onChange={(e) => {
                              const newCompetitors = [...competitors];
                              newCompetitors[index].url = e.target.value;
                              setCompetitors(newCompetitors);
                            }}
                            className="flex-1"
                          />
                          {index === competitors.length - 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                setCompetitors([...competitors, { name: "", url: "" }])
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                          {competitors.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                const newCompetitors = competitors.filter((_, i) => i !== index);
                                setCompetitors(newCompetitors);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {competitors.some((c) => c.name.trim() !== "" || c.url.trim() !== "") && (
                        <Button
                          onClick={() => {
                            const validCompetitors = competitors.filter(
                              (c) => c.name.trim() !== "" && c.url.trim() !== "",
                            );
                            validCompetitors.forEach((competitor, index) => {
                              const connector: Connector = {
                                id: `conn-competitor-${index}`,
                                name: `Competitor: ${competitor.name}`,
                                type: "custom",
                                icon: Users,
                                platform: "Competitor",
                                description: `Competitor: ${competitor.name} - ${competitor.url}`,
                                category: "Competitors",
                              };
                              handleConnectSource(connector);
                            });
                            toast({
                              title: `${validCompetitors.length} competitor(s) added`,
                              description:
                                "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                            setCompetitors([{ name: "", url: "" }]);
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Slack Section */}
                <AccordionItem value="slack">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Slack className="h-4 w-4" />
                      Slack
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {slackConfigs.map((config, index) => (
                        <div key={index} className="space-y-3 p-4 border rounded-lg">
                          <div className="space-y-2">
                            <Label>Workspace</Label>
                            <Input
                              placeholder="Enter workspace name"
                              value={config.workspace}
                              onChange={(e) => {
                                const newConfigs = [...slackConfigs];
                                newConfigs[index].workspace = e.target.value;
                                setSlackConfigs(newConfigs);
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Channel</Label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter channel name"
                                value={config.channel}
                                onChange={(e) => {
                                  const newConfigs = [...slackConfigs];
                                  newConfigs[index].channel = e.target.value;
                                  setSlackConfigs(newConfigs);
                                }}
                                className="flex-1"
                              />
                              {index === slackConfigs.length - 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() =>
                                    setSlackConfigs([
                                      ...slackConfigs,
                                      { workspace: "", channel: "" },
                                    ])
                                  }
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                              {slackConfigs.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    const newConfigs = slackConfigs.filter((_, i) => i !== index);
                                    setSlackConfigs(newConfigs);
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {slackConfigs.some((c) => c.workspace.trim() !== "") && (
                        <Button
                          onClick={() => {
                            const validConfigs = slackConfigs.filter(
                              (c) => c.workspace.trim() !== "",
                            );
                            validConfigs.forEach((config, index) => {
                              const connector: Connector = {
                                id: `conn-slack-${index}`,
                                name: `Slack: ${config.workspace}`,
                                type: "communication",
                                icon: Slack,
                                platform: "Slack",
                                description: `Slack: ${config.workspace} - ${config.channel || "All channels"}`,
                                category: "Communication",
                              };
                              handleConnectSource(connector);
                            });
                            toast({
                              title: `${validConfigs.length} Slack workspace(s) added`,
                              description:
                                "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                            setSlackConfigs([{ workspace: "", channel: "" }]);
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* File Sources Section */}
                <AccordionItem value="file-sources">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <UploadIcon className="h-4 w-4" />
                      File Sources
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-2">
                      {/* Product Documentation - Special handling with multiple files */}
                      <div className="space-y-3 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">Product Documentation</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Docs, API guides, release notes, and specs
                        </p>

                        {productDocFiles.map((fileData, index) => (
                          <div key={index} className="space-y-3 p-3 border rounded-md bg-muted/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Upload File</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="file"
                                    className="flex-1"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const newFiles = [...productDocFiles];
                                        newFiles[index].file = file;
                                        setProductDocFiles(newFiles);
                                      }
                                    }}
                                  />
                                  {index === productDocFiles.length - 1 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() =>
                                        setProductDocFiles([
                                          ...productDocFiles,
                                          { file: null, destinationUrl: "" },
                                        ])
                                      }
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {productDocFiles.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        const newFiles = productDocFiles.filter(
                                          (_, i) => i !== index,
                                        );
                                        setProductDocFiles(newFiles);
                                      }}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                {fileData.file && (
                                  <p className="text-xs text-muted-foreground">
                                    Selected: {fileData.file.name}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Destination URL</Label>
                                <Input
                                  type="url"
                                  placeholder="https://example.com/destination"
                                  value={fileData.destinationUrl}
                                  onChange={(e) => {
                                    const newFiles = [...productDocFiles];
                                    newFiles[index].destinationUrl = e.target.value;
                                    setProductDocFiles(newFiles);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}

                        {productDocFiles.some((f) => f.file || f.destinationUrl.trim() !== "") && (
                          <Button
                            onClick={() => {
                              const validFiles = productDocFiles.filter(
                                (f) => f.file || f.destinationUrl.trim() !== "",
                              );
                              validFiles.forEach((fileData, index) => {
                                const connector: Connector = {
                                  id: `file-product-doc-${index}`,
                                  name: `Product Documentation${validFiles.length > 1 ? ` (${index + 1})` : ""}`,
                                  type: "file",
                                  icon: FileText,
                                  platform: "File Upload",
                                  description: `Docs, API guides, release notes, and specs${fileData.file ? ` - ${fileData.file.name}` : ""}`,
                                  category: "File Sources",
                                };
                                handleConnectSource(connector);
                              });
                              toast({
                                title: `${validFiles.length} Product Documentation file(s) added`,
                                description:
                                  "Click 'Connect' in the table to upload files and configure.",
                              });
                              setIsConnectorDialogOpen(false);
                              setProductDocFiles([{ file: null, destinationUrl: "" }]);
                            }}
                            className="w-full"
                          >
                            Connect
                          </Button>
                        )}
                      </div>

                      {/* Other File Sources */}
                      {[
                        {
                          name: "Call Transcripts",
                          icon: MessageSquare,
                          description: "Conversation transcripts from discovery and sales calls",
                        },
                        {
                          name: "Meeting Notes",
                          icon: FileText,
                          description: "Structured or freeform notes from meetings",
                        },
                        {
                          name: "Case Studies",
                          icon: Users,
                          description: "Customer stories, wins, and proof points",
                        },
                        {
                          name: "Support Tickets",
                          icon: MessageSquare,
                          description: "Support conversations and resolutions",
                        },
                        {
                          name: "Sales Presentations",
                          icon: BarChart3,
                          description: "Decks and one-pagers used in the sales cycle",
                        },
                      ].map((fileSource) => {
                        const FileIcon = fileSource.icon;
                        const fileData = fileSources[fileSource.name];

                        return (
                          <div key={fileSource.name} className="space-y-3 p-4 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <FileIcon className="h-4 w-4 text-muted-foreground" />
                              <h4 className="font-medium">{fileSource.name}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {fileSource.description}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Upload File</Label>
                                <Input
                                  type="file"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setFileSources((prev) => ({
                                        ...prev,
                                        [fileSource.name]: { ...prev[fileSource.name], file },
                                      }));
                                    }
                                  }}
                                />
                                {fileData.file && (
                                  <p className="text-xs text-muted-foreground">
                                    Selected: {fileData.file.name}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Destination URL</Label>
                                <Input
                                  type="url"
                                  placeholder="https://example.com/destination"
                                  value={fileData.destinationUrl}
                                  onChange={(e) => {
                                    setFileSources((prev) => ({
                                      ...prev,
                                      [fileSource.name]: {
                                        ...prev[fileSource.name],
                                        destinationUrl: e.target.value,
                                      },
                                    }));
                                  }}
                                />
                              </div>
                            </div>

                            {(fileData.file || fileData.destinationUrl.trim() !== "") && (
                              <Button
                                onClick={() => {
                                  const connector: Connector = {
                                    id: `file-${fileSource.name.toLowerCase().replace(/\s+/g, "-")}`,
                                    name: fileSource.name,
                                    type: "file",
                                    icon: fileSource.icon,
                                    platform: "File Upload",
                                    description: fileSource.description,
                                    category: "File Sources",
                                  };
                                  handleConnectSource(connector);
                                  toast({
                                    title: `${fileSource.name} added`,
                                    description:
                                      "Click 'Connect' in the table to upload files and configure.",
                                  });
                                  setIsConnectorDialogOpen(false);
                                }}
                                className="w-full"
                              >
                                Connect
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Data Source</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{sourceToDelete?.name}</strong>? This action
                cannot be undone and all associated data will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setSourceToDelete(null);
                }}
              >
                No, Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (sourceToDelete) {
                    setDataSources((prev) => prev.filter((s) => s.id !== sourceToDelete.id));
                    toast({
                      title: "Data source deleted",
                      description: `${sourceToDelete.name} has been removed.`,
                    });
                    setDeleteDialogOpen(false);
                    setSourceToDelete(null);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Yes, Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Configuration Dialog */}
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure {sourceToConfigure?.name}</DialogTitle>
              <DialogDescription>
                Manage sync settings, objects, and filters for this data source
              </DialogDescription>
            </DialogHeader>

            {sourceToConfigure && (
              <div className="space-y-6 pt-4">
                {/* Sync Frequency */}
                <div className="space-y-2">
                  <Label>Sync Frequency</Label>
                  <Select
                    value={configSyncFrequency}
                    onValueChange={(value: string) =>
                      setConfigSyncFrequency(value as DataSource["syncFrequency"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="4hours">Every 4 Hours</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="manual">Manual Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How often data should be synchronized from {sourceToConfigure.name}
                  </p>
                </div>

                {/* Objects to Sync */}
                {sourceToConfigure.type === "crm" && (
                  <div className="space-y-2">
                    <Label>Objects to Sync</Label>
                    <div className="space-y-2 border rounded-md p-4">
                      {[
                        "Contacts",
                        "Accounts",
                        "Opportunities",
                        "Leads",
                        "Deals",
                        "Activities",
                      ].map((obj) => {
                        const isChecked = configObjects.includes(obj);
                        return (
                          <div key={obj} className="flex items-center space-x-2">
                            <Checkbox
                              id={`obj-${obj}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setConfigObjects([...configObjects, obj]);
                                } else {
                                  setConfigObjects(configObjects.filter((o) => o !== obj));
                                }
                              }}
                            />
                            <label
                              htmlFor={`obj-${obj}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {obj}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select which CRM objects to synchronize
                    </p>
                  </div>
                )}

                {sourceToConfigure.type === "social" && (
                  <div className="space-y-2">
                    <Label>Data Types to Sync</Label>
                    <div className="space-y-2 border rounded-md p-4">
                      {["Company Pages", "Profiles", "Posts", "Engagements"].map((obj) => {
                        const isChecked = configObjects.includes(obj);
                        return (
                          <div key={obj} className="flex items-center space-x-2">
                            <Checkbox
                              id={`obj-${obj}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setConfigObjects([...configObjects, obj]);
                                } else {
                                  setConfigObjects(configObjects.filter((o) => o !== obj));
                                }
                              }}
                            />
                            <label
                              htmlFor={`obj-${obj}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {obj}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {sourceToConfigure.type === "analytics" && (
                  <div className="space-y-2">
                    <Label>Events to Sync</Label>
                    <div className="space-y-2 border rounded-md p-4">
                      {["Page Views", "Events", "User Actions", "Conversions"].map((obj) => {
                        const isChecked = configObjects.includes(obj);
                        return (
                          <div key={obj} className="flex items-center space-x-2">
                            <Checkbox
                              id={`obj-${obj}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setConfigObjects([...configObjects, obj]);
                                } else {
                                  setConfigObjects(configObjects.filter((o) => o !== obj));
                                }
                              }}
                            />
                            <label
                              htmlFor={`obj-${obj}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {obj}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Filters */}
                {sourceToConfigure.type === "crm" && (
                  <div className="space-y-2">
                    <Label>Filters</Label>
                    <div className="space-y-2 border rounded-md p-4">
                      {[
                        "Active records only",
                        "Last 90 days",
                        "Exclude archived",
                        "High-value accounts only",
                      ].map((filter) => {
                        const isChecked = configFilters.includes(filter);
                        return (
                          <div key={filter} className="flex items-center space-x-2">
                            <Checkbox
                              id={`filter-${filter}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setConfigFilters([...configFilters, filter]);
                                } else {
                                  setConfigFilters(configFilters.filter((f) => f !== filter));
                                }
                              }}
                            />
                            <label
                              htmlFor={`filter-${filter}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {filter}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Apply filters to limit which records are synchronized
                    </p>
                  </div>
                )}

                {/* Current Configuration Summary */}
                <div className="space-y-2 pt-4 border-t">
                  <Label>Current Configuration</Label>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      Objects Synced: {configObjects.length > 0 ? configObjects.join(", ") : "None"}
                    </p>
                    <p>Filters: {configFilters.length > 0 ? configFilters.join(", ") : "None"}</p>
                    <p>Fields Mapped: {sourceToConfigure.fieldsMapped}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveConfiguration}>Save Configuration</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Salesforce Auth Modal */}
        <Dialog
          open={isSalesforceAuthModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsSalesforceAuthModalOpen(false);
              setSalesforceEmail("");
              setSalesforcePassword("");
              setSalesforceSourceToConnect(null);
              setSalesforceAuthStep("login");
            }
          }}
        >
          <DialogContent className="max-w-md">
            {salesforceAuthStep === "login" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to Salesforce</DialogTitle>
                  <DialogDescription>
                    Enter your Salesforce credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="salesforce-email">Email</Label>
                    <Input
                      id="salesforce-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={salesforceEmail}
                      onChange={(e) => setSalesforceEmail(e.target.value)}
                      disabled={isSalesforceLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salesforce-password">Password</Label>
                    <Input
                      id="salesforce-password"
                      type="password"
                      placeholder="Enter your password"
                      value={salesforcePassword}
                      onChange={(e) => setSalesforcePassword(e.target.value)}
                      disabled={isSalesforceLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isSalesforceLoggingIn) {
                          void handleSalesforceLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsSalesforceAuthModalOpen(false);
                      setSalesforceEmail("");
                      setSalesforcePassword("");
                      setSalesforceSourceToConnect(null);
                      setSalesforceAuthStep("login");
                    }}
                    disabled={isSalesforceLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSalesforceLogin}
                    disabled={isSalesforceLoggingIn || !salesforceEmail || !salesforcePassword}
                  >
                    {isSalesforceLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Access</DialogTitle>
                  <DialogDescription>
                    This application would like to access the following data from your Salesforce
                    account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Contacts</strong> - Read contact information and details
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Accounts</strong> - Read account information and company data
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Opportunities</strong> - Read sales opportunities and pipeline
                          data
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{salesforceEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleSalesforceDeny}>
                    Deny
                  </Button>
                  <Button
                    onClick={handleSalesforceApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* HubSpot Auth Modal */}
        <Dialog
          open={isHubSpotAuthModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsHubSpotAuthModalOpen(false);
              setHubSpotEmail("");
              setHubSpotPassword("");
              setHubSpotSourceToConnect(null);
              setHubSpotAuthStep("login");
            }
          }}
        >
          <DialogContent className="max-w-md">
            {hubSpotAuthStep === "login" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to HubSpot</DialogTitle>
                  <DialogDescription>Enter your HubSpot credentials to continue.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="hubspot-email">Email</Label>
                    <Input
                      id="hubspot-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={hubSpotEmail}
                      onChange={(e) => setHubSpotEmail(e.target.value)}
                      disabled={isHubSpotLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hubspot-password">Password</Label>
                    <Input
                      id="hubspot-password"
                      type="password"
                      placeholder="Enter your password"
                      value={hubSpotPassword}
                      onChange={(e) => setHubSpotPassword(e.target.value)}
                      disabled={isHubSpotLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isHubSpotLoggingIn) {
                          void handleHubSpotLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart3 className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsHubSpotAuthModalOpen(false);
                      setHubSpotEmail("");
                      setHubSpotPassword("");
                      setHubSpotSourceToConnect(null);
                      setHubSpotAuthStep("login");
                    }}
                    disabled={isHubSpotLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleHubSpotLogin}
                    disabled={isHubSpotLoggingIn || !hubSpotEmail || !hubSpotPassword}
                  >
                    {isHubSpotLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Access</DialogTitle>
                  <DialogDescription>
                    This application would like to access the following data from your HubSpot
                    account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Contacts</strong> - Read contact information and details
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Companies</strong> - Read company information and organization
                          data
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Deals</strong> - Read deal information and pipeline data
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Tickets</strong> - Read support ticket information
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{hubSpotEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleHubSpotDeny}>
                    Deny
                  </Button>
                  <Button
                    onClick={handleHubSpotApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Pipedrive Auth Modal */}
        <Dialog
          open={isPipedriveAuthModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsPipedriveAuthModalOpen(false);
              setPipedriveEmail("");
              setPipedrivePassword("");
              setPipedriveSourceToConnect(null);
              setPipedriveAuthStep("login");
            }
          }}
        >
          <DialogContent className="max-w-md">
            {pipedriveAuthStep === "login" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to Pipedrive</DialogTitle>
                  <DialogDescription>
                    Enter your Pipedrive credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="pipedrive-email">Email</Label>
                    <Input
                      id="pipedrive-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={pipedriveEmail}
                      onChange={(e) => setPipedriveEmail(e.target.value)}
                      disabled={isPipedriveLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pipedrive-password">Password</Label>
                    <Input
                      id="pipedrive-password"
                      type="password"
                      placeholder="Enter your password"
                      value={pipedrivePassword}
                      onChange={(e) => setPipedrivePassword(e.target.value)}
                      disabled={isPipedriveLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isPipedriveLoggingIn) {
                          void handlePipedriveLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsPipedriveAuthModalOpen(false);
                      setPipedriveEmail("");
                      setPipedrivePassword("");
                      setPipedriveSourceToConnect(null);
                      setPipedriveAuthStep("login");
                    }}
                    disabled={isPipedriveLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePipedriveLogin}
                    disabled={isPipedriveLoggingIn || !pipedriveEmail || !pipedrivePassword}
                  >
                    {isPipedriveLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Access</DialogTitle>
                  <DialogDescription>
                    This application would like to access the following data from your Pipedrive
                    account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Deals</strong> - Read deal information and pipeline data
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Persons</strong> - Read contact information and details
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Organizations</strong> - Read company information and organization
                          data
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Activities</strong> - Read activity information and timeline data
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{pipedriveEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handlePipedriveDeny}>
                    Deny
                  </Button>
                  <Button
                    onClick={handlePipedriveApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Zoho Auth Modal */}
        <Dialog
          open={isZohoAuthModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsZohoAuthModalOpen(false);
              setZohoEmail("");
              setZohoPassword("");
              setZohoSourceToConnect(null);
              setZohoAuthStep("login");
            }
          }}
        >
          <DialogContent className="max-w-md">
            {zohoAuthStep === "login" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to Zoho CRM</DialogTitle>
                  <DialogDescription>
                    Enter your Zoho CRM credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="zoho-email">Email</Label>
                    <Input
                      id="zoho-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={zohoEmail}
                      onChange={(e) => setZohoEmail(e.target.value)}
                      disabled={isZohoLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zoho-password">Password</Label>
                    <Input
                      id="zoho-password"
                      type="password"
                      placeholder="Enter your password"
                      value={zohoPassword}
                      onChange={(e) => setZohoPassword(e.target.value)}
                      disabled={isZohoLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isZohoLoggingIn) {
                          void handleZohoLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsZohoAuthModalOpen(false);
                      setZohoEmail("");
                      setZohoPassword("");
                      setZohoSourceToConnect(null);
                      setZohoAuthStep("login");
                    }}
                    disabled={isZohoLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleZohoLogin}
                    disabled={isZohoLoggingIn || !zohoEmail || !zohoPassword}
                  >
                    {isZohoLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Access</DialogTitle>
                  <DialogDescription>
                    This application would like to access the following data from your Zoho CRM
                    account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Contacts</strong> - Read contact information and details
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Accounts</strong> - Read account information and company data
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Deals</strong> - Read deal information and pipeline data
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Leads</strong> - Read lead information and conversion data
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{zohoEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleZohoDeny}>
                    Deny
                  </Button>
                  <Button onClick={handleZohoApprove} className="bg-green-600 hover:bg-green-700">
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* LinkedIn Auth Modal */}
        <Dialog
          open={isLinkedInAuthModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsLinkedInAuthModalOpen(false);
              setLinkedInEmail("");
              setLinkedInPassword("");
              setLinkedInSourceToConnect(null);
              setLinkedInAuthStep("login");
            }
          }}
        >
          <DialogContent className="max-w-md">
            {linkedInAuthStep === "login" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to LinkedIn</DialogTitle>
                  <DialogDescription>
                    Enter your LinkedIn credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="linkedin-email">Email</Label>
                    <Input
                      id="linkedin-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={linkedInEmail}
                      onChange={(e) => setLinkedInEmail(e.target.value)}
                      disabled={isLinkedInLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin-password">Password</Label>
                    <Input
                      id="linkedin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={linkedInPassword}
                      onChange={(e) => setLinkedInPassword(e.target.value)}
                      disabled={isLinkedInLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isLinkedInLoggingIn) {
                          void handleLinkedInLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Linkedin className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsLinkedInAuthModalOpen(false);
                      setLinkedInEmail("");
                      setLinkedInPassword("");
                      setLinkedInSourceToConnect(null);
                      setLinkedInAuthStep("login");
                    }}
                    disabled={isLinkedInLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLinkedInLogin}
                    disabled={isLinkedInLoggingIn || !linkedInEmail || !linkedInPassword}
                  >
                    {isLinkedInLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Access</DialogTitle>
                  <DialogDescription>
                    This application would like to access the following data from your LinkedIn
                    account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      {linkedInSourceToConnect?.name === "LinkedIn Company" ? (
                        <>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>Company Page</strong> - Read company page information and
                              details
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>Posts</strong> - Read company posts and engagement data
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>Followers</strong> - Read follower information and analytics
                            </span>
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>Company Pages</strong> - Read company page information and
                              details
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>Profiles</strong> - Read profile information and contact
                              details
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>Messages</strong> - Read messages and conversation data
                            </span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{linkedInEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleLinkedInDeny}>
                    Deny
                  </Button>
                  <Button
                    onClick={handleLinkedInApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* X (Twitter) Auth Modal */}
        <Dialog
          open={isXAuthModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsXAuthModalOpen(false);
              setXEmail("");
              setXPassword("");
              setXSourceToConnect(null);
              setXAuthStep("login");
            }
          }}
        >
          <DialogContent className="max-w-md">
            {xAuthStep === "login" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to X</DialogTitle>
                  <DialogDescription>Enter your X credentials to continue.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="x-email">Email</Label>
                    <Input
                      id="x-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={xEmail}
                      onChange={(e) => setXEmail(e.target.value)}
                      disabled={isXLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="x-password">Password</Label>
                    <Input
                      id="x-password"
                      type="password"
                      placeholder="Enter your password"
                      value={xPassword}
                      onChange={(e) => setXPassword(e.target.value)}
                      disabled={isXLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isXLoggingIn) {
                          void handleXLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Twitter className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsXAuthModalOpen(false);
                      setXEmail("");
                      setXPassword("");
                      setXSourceToConnect(null);
                      setXAuthStep("login");
                    }}
                    disabled={isXLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleXLogin} disabled={isXLoggingIn || !xEmail || !xPassword}>
                    {isXLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Access</DialogTitle>
                  <DialogDescription>
                    This application would like to access the following data from your X account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Profiles</strong> - Read profile information and user data
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Tweets</strong> - Read tweets and post information
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Engagements</strong> - Read likes, retweets, and engagement
                          metrics
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{xEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleXDeny}>
                    Deny
                  </Button>
                  <Button onClick={handleXApprove} className="bg-green-600 hover:bg-green-700">
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Google Analytics Auth Modal */}
        <Dialog
          open={isGoogleAnalyticsAuthModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsGoogleAnalyticsAuthModalOpen(false);
              setGoogleAnalyticsEmail("");
              setGoogleAnalyticsSourceToConnect(null);
              setGoogleAnalyticsAuthStep("signin");
            }
          }}
        >
          <DialogContent className="max-w-md">
            {googleAnalyticsAuthStep === "signin" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    Connect Google Analytics
                  </DialogTitle>
                  <DialogDescription>
                    Sign in with your Google account to connect Google Analytics
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-6">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg w-full">
                      <p className="text-sm text-center text-muted-foreground mb-4">
                        This will open Google's sign-in page in a new window
                      </p>
                      <Button
                        onClick={handleGoogleAnalyticsSignIn}
                        disabled={isGoogleAnalyticsSigningIn}
                        className="w-full h-12 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm font-medium flex items-center justify-center gap-3"
                      >
                        {isGoogleAnalyticsSigningIn ? (
                          <>
                            <RefreshCw className="h-5 w-5 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              />
                            </svg>
                            Sign in with Google
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span>This is a demo. Clicking will simulate Google sign-in.</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsGoogleAnalyticsAuthModalOpen(false);
                      setGoogleAnalyticsEmail("");
                      setGoogleAnalyticsSourceToConnect(null);
                      setGoogleAnalyticsAuthStep("signin");
                    }}
                    disabled={isGoogleAnalyticsSigningIn}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : googleAnalyticsAuthStep === "permissions" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    Google Account
                  </DialogTitle>
                  <DialogDescription>
                    This app wants to access your Google Analytics data
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3 bg-white">
                    <div className="flex items-center gap-3 pb-3 border-b">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {googleAnalyticsEmail.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{googleAnalyticsEmail}</p>
                        <p className="text-xs text-muted-foreground">Google Account</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-3">This will allow:</p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>View your Google Analytics data</strong> - Read analytics
                            reports and metrics
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>View your Analytics properties</strong> - Access property
                            information and settings
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>View your Analytics reports</strong> - Read page views, events,
                            and user data
                          </span>
                        </li>
                      </ul>
                    </div>
                    <div className="pt-3 border-t text-xs text-muted-foreground">
                      <p>
                        By continuing, you allow this app to access your Google Analytics data. You
                        can revoke access at any time in your Google Account settings.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleGoogleAnalyticsDeny}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGoogleAnalyticsApprove}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Allow
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Connected Successfully
                  </DialogTitle>
                  <DialogDescription>Google Analytics has been connected</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-6">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-lg">Google Analytics Connected</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Your Google Analytics account is now connected and syncing.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => {
                      setIsGoogleAnalyticsAuthModalOpen(false);
                      setGoogleAnalyticsEmail("");
                      setGoogleAnalyticsSourceToConnect(null);
                      setGoogleAnalyticsAuthStep("signin");
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Done
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Mixpanel Auth Modal */}
        <Dialog
          open={isMixpanelAuthModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsMixpanelAuthModalOpen(false);
              setMixpanelEmail("");
              setMixpanelPassword("");
              setMixpanelSourceToConnect(null);
              setMixpanelAuthStep("login");
            }
          }}
        >
          <DialogContent className="max-w-md">
            {mixpanelAuthStep === "login" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to Mixpanel</DialogTitle>
                  <DialogDescription>
                    Enter your Mixpanel credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="mixpanel-email">Email</Label>
                    <Input
                      id="mixpanel-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={mixpanelEmail}
                      onChange={(e) => setMixpanelEmail(e.target.value)}
                      disabled={isMixpanelLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mixpanel-password">Password</Label>
                    <Input
                      id="mixpanel-password"
                      type="password"
                      placeholder="Enter your password"
                      value={mixpanelPassword}
                      onChange={(e) => setMixpanelPassword(e.target.value)}
                      disabled={isMixpanelLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isMixpanelLoggingIn) {
                          void handleMixpanelLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart3 className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsMixpanelAuthModalOpen(false);
                      setMixpanelEmail("");
                      setMixpanelPassword("");
                      setMixpanelSourceToConnect(null);
                      setMixpanelAuthStep("login");
                    }}
                    disabled={isMixpanelLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleMixpanelLogin}
                    disabled={isMixpanelLoggingIn || !mixpanelEmail || !mixpanelPassword}
                  >
                    {isMixpanelLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Mixpanel Access</DialogTitle>
                  <DialogDescription>This app will be able to:</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Track user events</strong> - Record and track user interactions
                          and events
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Analyze funnels & retention</strong> - Access funnel analysis and
                          user retention metrics
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>View engagement metrics</strong> - Read engagement data and
                          analytics reports
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{mixpanelEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleMixpanelDeny}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleMixpanelApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Allow Access
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default MissionControlPage;
