import { useQueryClient } from "@tanstack/react-query";
import { Building2, Database, Users } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

import CompanyProfileForm from "../components/company-profile/CompanyProfileForm";
import { mapApiDataToCompanyProfileFields } from "../components/company-profile/companyProfileMapping";
import ConnectorApprovals from "../components/company-profile/ConnectorApprovals";
import type { DataSource } from "../components/company-profile/connectorTypes";
import DataSourcesManager from "../components/data-sources/DataSourcesManager";
import ICPManager from "../components/icp/ICPManager";

import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layout } from "@/features/shell";
import { qk } from "@/shared/api/queryKeys";
import { useAuthToken } from "@/shared/auth";
import { useCompanyProfile } from "@/shared/company-profile";
import {
  ensureMissionProfilerScope,
  isMissionControlCacheValid,
  getMissionControlCompanyProfileJson,
  commitMissionControlCompanyProfile,
  invalidateMissionControlCache,
  invalidateProfilerCache,
  extractIcpsDataFromFlexibleApiResponse,
} from "@/shared/profiler";
import type { UntypedBackendApiResponse } from "@/shared/types/escape-hatches";

const MissionControlPage = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const [isCompanyProfileSaved, setIsCompanyProfileSaved] = useState(false);
  const [isCustomerProfileSaved, setIsCustomerProfileSaved] = useState(false);
  const [hasDataSources, setHasDataSources] = useState(false);
  const queryClient = useQueryClient();

  // Tab locking logic - check if data exists in backend, not just session state
  // Customer profile is unlocked if company profile exists in backend
  const isCustomerProfileLocked = !isCompanyProfileSaved;
  // Data sources is unlocked if company profile exists (not dependent on customer profile)
  const isDataSourcesLocked = !isCompanyProfileSaved;

  // The richer connector-shaped data sources. WRITTEN by four concerns:
  // (a) applyDataSourcesFromPayload (read-driven, page-local, below),
  // (b/c) the connector approve/deny + delete handlers (now in ConnectorApprovals,
  //   via the onDataSourcesChange prop), and
  // (d) the dataSourceAdded window-event listener (below).
  // READ by calculateOverallCompleteness + the hasDataSources sync effect.
  const [dataSources, setDataSources] = useState<DataSource[]>([]);

  const { currentUser, orgId } = useAuthToken();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  /** Fresh GET of ICP rows whenever the Customer Profile tab is opened or Profiler mutates ICPs.
   *  Loading UI is the inline three-dot overlay inside ICPManager (same as Data Sources). */
  const refreshCustomerProfileIcps = useCallback(async () => {
    if (!currentUser?.uid) return;
    invalidateMissionControlCache(currentUser.uid, orgIdToUse);
    await queryClient.refetchQueries({ queryKey: qk.icps(orgIdToUse) });
  }, [currentUser?.uid, orgIdToUse, queryClient]);

  /** Fresh GET of uploaded documents + lead-stream status when the Data Sources tab opens. */
  const refreshDataSources = useCallback(async () => {
    if (!currentUser?.uid) return;
    await Promise.all([
      queryClient.refetchQueries({ queryKey: qk.dataSources(orgIdToUse) }),
      queryClient.refetchQueries({
        queryKey: qk.leadStreamStatus(currentUser.uid, orgIdToUse),
      }),
    ]);
  }, [currentUser?.uid, orgIdToUse, queryClient]);

  // Company-profile READ — the page shares ONE TanStack cache entry with
  // CompanyProfileForm's own useCompanyProfile(orgIdToUse) call (a single GET
  // /api/profile/company). The form owns the editable form state + writes; the
  // page derives its read-driven side effects (data-sources, customer-profile
  // completeness, profiler-cache commit, localStorage backup) from this data,
  // and drives the loading Dialog from isLoadingProfile.
  const { data: companyProfileData, isLoading: isLoadingProfile } = useCompanyProfile(
    orgIdToUse,
    !!currentUser?.uid,
  );

  // Apply the data_sources branch of a company-profile payload to the page's
  // data-source state. This is a DIFFERENT tab's concern than the company form
  // (the company FIELDS are owned by CompanyProfileForm), so it stays in the
  // page. Extracted unchanged from the old applyCompanyProfileJsonToMissionControlUi.
  const applyDataSourcesFromPayload = (data: UntypedBackendApiResponse) => {
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

  // Check URL params for tab after profile loads
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    if (tabParam === "customer-profile" && !isCustomerProfileLocked) {
      setActiveTab("customer-profile");
      void refreshCustomerProfileIcps();
      // Clean up URL param after setting tab
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (tabParam === "sources" && !isDataSourcesLocked) {
      setActiveTab("sources");
      void refreshDataSources();
      // Clean up URL param after setting tab
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (tabParam === "profile") {
      setActiveTab("profile");
      // Clean up URL param after setting tab
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [
    isCustomerProfileLocked,
    isDataSourcesLocked,
    refreshCustomerProfileIcps,
    refreshDataSources,
  ]); // Run after locks are determined

  // Mount: ensure the profiler scope exists, and seed the page's read-driven
  // state from the profiler cache when valid (the data-sources branch +
  // customer-profile completeness). The company FORM fields are hydrated by
  // CompanyProfileForm off the same shared query/cache. Mirrors the old
  // loadProfileData cache pre-check branch (page-side concerns only).
  useEffect(() => {
    if (!currentUser?.uid) return;
    const userId = currentUser.uid;
    ensureMissionProfilerScope(userId, orgIdToUse);
    if (isMissionControlCacheValid(userId, orgIdToUse)) {
      const cached = getMissionControlCompanyProfileJson(userId, orgIdToUse);
      if (cached) {
        applyDataSourcesFromPayload(cached);
        applyCustomerProfileCompletenessFromPayload(cached);
      }
    }
  }, [currentUser?.uid, orgIdToUse]);

  // Read-driven page side effects: when the shared useCompanyProfile query
  // resolves with a payload, run the page's concerns off it — data-sources,
  // customer-profile completeness (backend), profiler-cache commit, and the
  // gated localStorage backup write. The hook resolves to null on any non-2xx /
  // network failure (the old 404/error path), in which case there is no page
  // side effect to run (CompanyProfileForm owns the localStorage failover).
  useEffect(() => {
    if (!currentUser?.uid) return;
    const data = companyProfileData;
    if (!data) return;
    const userId = currentUser.uid;
    const profileData = mapApiDataToCompanyProfileFields(data as UntypedBackendApiResponse, userId);
    if (!profileData) return;

    applyDataSourcesFromPayload(data as UntypedBackendApiResponse);
    void applyCustomerProfileCompletenessFromBackend(
      userId,
      orgIdToUse,
      data as Record<string, unknown>,
    );

    const companyName = (
      (data as UntypedBackendApiResponse).company_name ||
      (data as UntypedBackendApiResponse).companyName ||
      profileData.companyName ||
      ""
    ).trim();
    const hasCompanyName = companyName.length > 0;

    if (hasCompanyName || profileData.headquarters || profileData.industry || profileData.revenue) {
      void (async () => {
        try {
          const { setUserLocalStorage } = await import("@/shared/lib/cacheUtils");
          const dataToSave = {
            ...(data as Record<string, unknown>),
            ...profileData,
            user_id: userId,
            company_name:
              profileData.companyName || (data as UntypedBackendApiResponse).company_name || "",
            companyName:
              profileData.companyName || (data as UntypedBackendApiResponse).companyName || "",
          };
          setUserLocalStorage("companyProfile", JSON.stringify(dataToSave), userId);
        } catch (e) {
          console.warn("MissionControl: Failed to save to localStorage:", e);
        }
      })();
    }

    commitMissionControlCompanyProfile(userId, orgIdToUse, data as Record<string, unknown>);
  }, [companyProfileData, currentUser?.uid, orgIdToUse]);

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
        void queryClient.invalidateQueries({ queryKey: qk.icps(orgIdToUse) });
        if (activeTabRef.current === "customer-profile") {
          void refreshCustomerProfileIcps();
        }
      } else {
        invalidateProfilerCache(uid, orgIdToUse);
      }
    };

    window.addEventListener("customerProfileSaved", handleCustomerProfileSaved);

    return () => {
      window.removeEventListener("customerProfileSaved", handleCustomerProfileSaved);
    };
  }, [currentUser?.uid, orgIdToUse, queryClient, refreshCustomerProfileIcps]);

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
      <Dialog open={isLoadingProfile} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md border-0 bg-transparent shadow-none p-0">
          <DialogTitle className="sr-only">Loading company profile</DialogTitle>
          <DialogDescription className="sr-only">
            Please wait while we fetch your company profile data.
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
                Loading company profile
              </p>
              <p className="text-sm text-muted-foreground font-medium text-center px-2">
                Please wait while we fetch your data...
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
            if (value === "customer-profile") {
              void refreshCustomerProfileIcps();
            }
            if (value === "sources") {
              void refreshDataSources();
            }
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
            <CompanyProfileForm onSavedChange={setIsCompanyProfileSaved} />
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

        {/* Connector-approval cluster (catalog/auth/config/delete overlays).
            Rendered at page level — same outer-div position the overlays used to
            occupy — so the dialogs mount exactly as before. */}
        <ConnectorApprovals dataSources={dataSources} onDataSourcesChange={setDataSources} />
      </div>
    </Layout>
  );
};

export default MissionControlPage;
