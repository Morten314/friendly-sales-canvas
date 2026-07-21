import { useQueryClient } from "@tanstack/react-query";
import { X, Sparkles } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

import { useAcceptSuggestedIcp } from "../../hooks/useAcceptSuggestedIcp";
import { useCustomerProfile } from "../../hooks/useCustomerProfile";
import { useRejectSuggestedIcp, useDeleteCurrentIcp } from "../../hooks/useRejectSuggestedIcp";
import { useSaveCustomerProfile } from "../../hooks/useSaveCustomerProfile";
import { useSuggestedIcps } from "../../hooks/useSuggestedIcps";
import {
  fetchCustomerProfileIcps,
  fetchSuggestedIcpsWithRefreshFallback,
} from "../../services/customers";
import type { ExistingICP, SuggestedICP, ICPCardStatus, SuggestedICPCardsProps } from "../../types";
import { getLeadCountForICP } from "../lead-stream/LeadStream";

import { CurrentIcpsTable } from "./CurrentIcpsTable";
import {
  mapCustomerProfileICPToExisting,
  mapAcceptedSuggestedToExisting,
  normalizeIcpGetResponse,
  mapApiICPToSuggested,
} from "./icpMapping";
import { RecommendedICPCard, RecommendedICPReportContent } from "./SuggestedICPCard";
import {
  readPendingRecommendedRejects,
  upsertPendingRecommendedReject,
  removePendingRecommendedReject,
  recordDismissedRecommendedIcp,
  removeFromProfilerRecommendedCached,
  filterDismissedFromSuggested,
  isRecommendedDeleteNotFound,
} from "./suggestedIcpStorage";

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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";
import { buildApiUrl } from "@/shared/api/transport";
import { qk } from "@/shared/api/queryKeys";
import { useAuth } from "@/shared/auth";
import { getUserLocalStorage, setUserLocalStorage } from "@/shared/lib/cacheUtils";
import {
  ensureMissionProfilerScope,
  isProfilerCacheValid,
  getProfilerSnapshot,
  commitProfilerSnapshot,
  invalidateMissionControlCache,
  invalidateProfilerCache,
  saveProfilerAcceptedIcpDisplayMeta,
  copyProfilerDisplayMetaToProfileId,
  extractPersistedIcpIdFromSuggestedProfileResponse,
  extractIcpsArrayFromCustomerProfileResponse,
  mapCustomerProfileApiRowsToStoredIcps,
  resolveAcceptedPersistedIcpId,
  removeProfilerAcceptedIcpDisplayMeta,
} from "@/shared/profiler";
import type { UntypedProfilerIcpRecord } from "@/shared/types/escape-hatches";

/** Dev-only logs for verifying Refresh → GET /icp → mapped cards/reports. Strip or disable for production noise. */
function profilerIcpDebug(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log("[Profiler ICP]", ...args);
  }
}

type ProfilerPageToast = (opts: {
  title: string;
  description?: string;
  variant?: "destructive";
}) => void;

/** Shared loader for Profiler UI (customer_profile + GET /icp when needed). */
async function loadProfilerPagePayload(options: {
  orgIdToUse: string;
  uid: string | undefined;
  refreshJustIncremented: boolean;
  refreshTrigger: number;
  refreshStorageKey: string | null;
  /** When true, skip GET /icp unless refresh was explicitly triggered. */
  warmProfilerCache: boolean;
  toast?: ProfilerPageToast;
}): Promise<{
  icps: ExistingICP[];
  refined: SuggestedICP[];
  newSuggestions: SuggestedICP[];
  mergedCardStatuses: Record<string, ICPCardStatus>;
}> {
  const {
    orgIdToUse,
    uid,
    refreshJustIncremented,
    refreshTrigger,
    refreshStorageKey,
    warmProfilerCache,
    toast,
  } = options;

  let icps: ExistingICP[] = [];
  try {
    if (uid) {
      const rows = await fetchCustomerProfileIcps(uid, orgIdToUse);
      if (rows.length > 0) {
        icps = rows.map((icp: UntypedProfilerIcpRecord, i: number) =>
          mapCustomerProfileICPToExisting(icp, i),
        );
      }
    }
  } catch {
    /* fall through to fallbacks */
  }
  if (icps.length === 0) {
    try {
      const customerProfileData = getUserLocalStorage("customerProfile", uid);
      if (customerProfileData) {
        const parsed = JSON.parse(customerProfileData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          icps = parsed.map((icp: UntypedProfilerIcpRecord, i: number) =>
            mapCustomerProfileICPToExisting(icp, i),
          );
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (icps.length === 0) {
    try {
      const persistedExisting = localStorage.getItem("profiler_existingICPs");
      if (persistedExisting) {
        const parsed = JSON.parse(persistedExisting);
        if (parsed.length > 0) icps = parsed;
      }
    } catch {
      /* ignore */
    }
  }
  if (icps.length === 0) {
    try {
      const stored =
        localStorage.getItem("customerICPs") || localStorage.getItem("missionControlICPs");
      if (stored) icps = JSON.parse(stored);
    } catch {
      /* ignore */
    }
  }
  if (icps.length === 0) {
    icps = [
      {
        id: "existing-1",
        name: "ICP 1",
        geography: "North America",
        industry: "Software & Technology",
        companySize: "100-500 employees",
        buyerRole: "CTO / VP Engineering",
        fitConfidence: "High",
        status: "active",
      },
      {
        id: "existing-2",
        name: "ICP 2",
        geography: "US, UK",
        industry: "Healthcare",
        companySize: "200-1000 employees",
        buyerRole: "CIO / Chief Digital Officer",
        fitConfidence: "Medium",
        status: "active",
      },
    ];
  }

  let refined: SuggestedICP[] = [];
  let newSuggestions: SuggestedICP[] = [];

  const shouldCallGetIcpApi = Boolean(uid) && (refreshJustIncremented || !warmProfilerCache);

  if (shouldCallGetIcpApi && uid) {
    if (refreshJustIncremented && refreshStorageKey) {
      sessionStorage.setItem(refreshStorageKey, String(refreshTrigger));
    }
    try {
      profilerIcpDebug("GET /icp (backend) — request", {
        user_id: uid,
        org_id: orgIdToUse,
        refresh: refreshJustIncremented,
      });
      const { data: icpData, usedCachedFallback } = await fetchSuggestedIcpsWithRefreshFallback(
        uid,
        orgIdToUse,
        refreshJustIncremented,
      );
      profilerIcpDebug("GET /icp — raw JSON (summary)", {
        topLevelKeys:
          icpData && typeof icpData === "object" && !Array.isArray(icpData)
            ? Object.keys(icpData as object)
            : Array.isArray(icpData)
              ? [`<array length ${icpData.length}>`]
              : typeof icpData,
      });
      const icpArray = normalizeIcpGetResponse(icpData);
      profilerIcpDebug("GET /icp — normalized array length", icpArray.length);
      if (icpArray.length > 0) {
        const mapped = icpArray.map((item: UntypedProfilerIcpRecord, i: number) =>
          mapApiICPToSuggested(item, i, "new"),
        );
        const filteredGet = filterDismissedFromSuggested(uid, [], mapped);
        newSuggestions = filteredGet.newSuggestions;
        refined = filteredGet.refined;
        profilerIcpDebug(
          "GET /icp — mapped recommended ICPs (source: backend)",
          mapped.map((icp) => ({
            id: icp.id,
            name: icp.name,
            industry: icp.industry,
            segment: icp.segment,
            hasFullReport: Boolean(icp.fullReport && Object.keys(icp.fullReport).length > 0),
            fullReportKeys: icp.fullReport ? Object.keys(icp.fullReport) : [],
          })),
        );
        if (refreshJustIncremented) {
          toast?.({
            title: usedCachedFallback ? "Showing cached ICPs" : "ICPs refreshed",
            description: usedCachedFallback
              ? "Regeneration failed; loaded your last saved recommendations."
              : `${newSuggestions.length} recommended ICPs generated.`,
            ...(usedCachedFallback ? { variant: "destructive" as const } : {}),
          });
        }
      } else {
        profilerIcpDebug("GET /icp — empty normalized array; UI will fall back to cache or mock");
      }
    } catch (e) {
      console.warn("Could not fetch recommended ICPs from API:", e);
      profilerIcpDebug("GET /icp — fetch error", e);
      if (refreshJustIncremented) {
        toast?.({
          title: "Refresh failed",
          description: "Could not reach the ICP service. Showing cached or sample data.",
          variant: "destructive",
        });
      }
    }
  } else if (refreshTrigger > 0 && !refreshJustIncremented) {
    profilerIcpDebug(
      "Skipping GET /icp (already handled this refreshTrigger or missing uid); using cache/mock path",
      {
        refreshTrigger,
        prevRefreshStored: refreshStorageKey
          ? Number(sessionStorage.getItem(refreshStorageKey) || "0")
          : 0,
      },
    );
  }

  if (newSuggestions.length === 0 && refined.length === 0) {
    try {
      const cached = localStorage.getItem("profiler_recommendedICPs");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          newSuggestions = parsed;
          refined = [];
          profilerIcpDebug(
            "Recommended ICPs source: localStorage cache (profiler_recommendedICPs)",
            {
              count: parsed.length,
              ids: parsed.map((x: SuggestedICP) => x.id),
            },
          );
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (newSuggestions.length === 0 && refined.length === 0) {
    refined = [
      {
        id: "refined-1",
        name: "Mid-Market SaaS – RevOps Teams",
        type: "refined",
        sourceICPId: icps[0]?.id,
        sourceICPName: icps[0]?.name || "ICP 1",
        industry: "Software & Technology",
        segment: "RevOps Focus",
        companySize: "100-500 employees",
        regions: ["North America", "UK"],
        decisionMakers: ["VP of RevOps", "Head of Sales Operations", "CRO"],
        keyAttributes: ["High growth stage", "Using Salesforce or HubSpot", "Series B+"],
        whySuggested: [
          "RevOps roles show 3x higher engagement with your content",
          "Faster sales cycles when RevOps is involved early",
          "Higher average deal size in this segment",
        ],
        confidenceScore: "High",
        marketSize: "$45B",
        growth: "+18% YoY",
        topPainPoint: "Sales & marketing alignment",
        buyingTriggers: ["New CRO hire", "Revenue target increase", "Tech stack consolidation"],
        competitors: ["Clari", "Gong", "Outreach"],
      },
    ];
    newSuggestions = [
      {
        id: "new-1",
        name: "Enterprise FinTech Decision Makers",
        type: "new",
        tag: "New ICP",
        industry: "Financial Services",
        segment: "FinTech",
        companySize: "500-2000 employees",
        regions: ["US", "EU"],
        decisionMakers: ["Chief Digital Officer", "VP of Innovation", "Head of Partnerships"],
        keyAttributes: [
          "Digital transformation focus",
          "API-first strategy",
          "Regulatory compliance needs",
        ],
        whySuggested: [
          "High overlap with your current product capabilities",
          "Growing market with 24% YoY expansion",
          "Lower competition in this segment",
        ],
        opportunityUnlocked:
          "Access to $2.4B addressable market with strong product-market fit signals",
        confidenceScore: "Medium",
        marketSize: "$28B",
        growth: "+24% YoY",
        topPainPoint: "Legacy system modernization",
        buyingTriggers: [
          "Regulatory changes",
          "Digital transformation initiative",
          "Competitor pressure",
        ],
        competitors: ["Stripe", "Plaid", "Marqeta"],
      },
      {
        id: "new-2",
        name: "Growth-Stage E-commerce Leaders",
        type: "new",
        sourceICPName: icps[0]?.name || "ICP 1",
        tag: `Lookalike of ${icps[0]?.name || "ICP 1"}`,
        industry: "E-commerce & Retail",
        segment: "D2C Brands",
        companySize: "50-200 employees",
        regions: ["North America"],
        decisionMakers: ["Head of Growth", "VP of Marketing", "COO"],
        keyAttributes: ["Shopify Plus users", "High ad spend", "Scaling operations"],
        whySuggested: [
          "Similar buying patterns to your best customers",
          "Strong intent signals detected in this segment",
          "Complementary to existing ICP focus",
        ],
        opportunityUnlocked: "Expand into adjacent market with proven playbook from ICP 1",
        confidenceScore: "High",
        marketSize: "$18B",
        growth: "+22% YoY",
        topPainPoint: "Scaling customer acquisition",
        buyingTriggers: ["Series A+ funding", "New market expansion", "Holiday season prep"],
        competitors: ["Shopify", "Klaviyo", "Attentive"],
      },
    ];
    profilerIcpDebug(
      "Recommended ICPs source: built-in mock data (no backend response and no profiler_recommendedICPs cache)",
    );
  }

  {
    const filtered = filterDismissedFromSuggested(uid, refined, newSuggestions);
    refined = filtered.refined;
    newSuggestions = filtered.newSuggestions;
  }

  try {
    if (newSuggestions.length > 0 || refined.length > 0) {
      localStorage.setItem(
        "profiler_recommendedICPs",
        JSON.stringify([...refined, ...newSuggestions]),
      );
    }
  } catch {
    /* ignore */
  }

  let mergedCardStatuses: Record<string, ICPCardStatus>;
  try {
    const persistedStatuses = localStorage.getItem("profiler_cardStatuses");
    if (persistedStatuses && Object.keys(JSON.parse(persistedStatuses || "{}")).length > 0) {
      mergedCardStatuses = JSON.parse(persistedStatuses) as Record<string, ICPCardStatus>;
    } else {
      mergedCardStatuses = {};
      [...refined, ...newSuggestions].forEach((icp) => {
        mergedCardStatuses[icp.id] = { status: "suggested" };
      });
    }
  } catch {
    mergedCardStatuses = {};
    [...refined, ...newSuggestions].forEach((icp) => {
      mergedCardStatuses[icp.id] = { status: "suggested" };
    });
  }

  return { icps, refined, newSuggestions, mergedCardStatuses };
}

export const SuggestedICPCards = ({
  onICPAccepted,
  onICPRejected,
  refreshTrigger = 0,
}: SuggestedICPCardsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser, orgId } = useAuth();

  // Registered for cache-key ownership + the canonical queryFn; fetching is still
  // driven by the imperative loader below until TD-FE-43 collapses it cache-native.
  const profileQuery = useCustomerProfile(currentUser?.uid ?? "", orgId || "brewra", false);
  const suggestedQuery = useSuggestedIcps(currentUser?.uid ?? "", { enabled: false });
  void profileQuery;
  void suggestedQuery;

  // Stage-4 write transports. Each mutationFn calls the matching service fn and
  // invalidates a customers query on success; the optimism (timers, localStorage
  // markers, display-meta, the customerProfileSaved event, toasts) stays in the
  // container below, byte-for-behavior with the pre-hook inline writes.
  const acceptIcpMutation = useAcceptSuggestedIcp(currentUser?.uid ?? "", orgId || "brewra");
  const saveProfileMutation = useSaveCustomerProfile(currentUser?.uid ?? "", orgId || "brewra");
  const rejectIcpMutation = useRejectSuggestedIcp(currentUser?.uid ?? "");
  const deleteCurrentIcpMutation = useDeleteCurrentIcp(currentUser?.uid ?? "", orgId || "brewra");

  /** Always filled from GET /profile/company (or legacy); avoid hydrating stale localStorage before fetch. */
  const [existingICPs, setExistingICPs] = useState<ExistingICP[]>([]);
  const [refinedICPs, setRefinedICPs] = useState<SuggestedICP[]>([]);
  const [newICPs, setNewICPs] = useState<SuggestedICP[]>([]);
  const [cardStatuses, setCardStatuses] = useState<Record<string, ICPCardStatus>>(() => {
    try {
      const saved = localStorage.getItem("profiler_cardStatuses");
      if (saved) return JSON.parse(saved);
    } catch {
      // intentional: ignore corrupt localStorage payload
    }
    return {};
  });

  const [loading, setLoading] = useState(true);

  const [expandedCurrentICPId, setExpandedCurrentICPId] = useState<string | null>(null);
  const [confirmAcceptICP, setConfirmAcceptICP] = useState<SuggestedICP | null>(null);
  const [showRecommendations, _setShowRecommendations] = useState(() => {
    try {
      return localStorage.getItem("profiler_showRecommendations") === "true";
    } catch {
      // intentional: ignore corrupt localStorage payload
    }
    return false;
  });
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [isSavingAccept, setIsSavingAccept] = useState(false);

  const rejectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /** Reload Current ICPs from GET /profile/company (same source as Mission Control / Swagger). */
  const refetchCustomerProfileIcps = useCallback(async (): Promise<string[]> => {
    const orgIdToUse = orgId || "brewra";
    const uid = currentUser?.uid;
    if (!uid) return [];
    try {
      const rows = await fetchCustomerProfileIcps(uid, orgIdToUse);
      if (rows.length === 0) {
        // Keep optimistic rows when the read lags behind a just-finished accept.
        return [];
      }
      setExistingICPs(
        rows.map((icp: UntypedProfilerIcpRecord, i: number) =>
          mapCustomerProfileICPToExisting(icp, i),
        ),
      );
      try {
        setUserLocalStorage(
          "customerProfile",
          JSON.stringify(mapCustomerProfileApiRowsToStoredIcps(rows as UntypedProfilerIcpRecord[])),
          uid,
        );
      } catch {
        /* ignore */
      }
      return rows
        .map((row: UntypedProfilerIcpRecord) => String(row.id ?? row.icp_id ?? "").trim())
        .filter(Boolean);
    } catch {
      /* keep existing rows */
    }
    return [];
  }, [orgId, currentUser?.uid]);

  const handleDeleteCurrentIcp = useCallback(
    async (icp: ExistingICP) => {
      const orgIdToUse = orgId || "brewra";
      const icpId = icp.id;
      console.log("[Profiler Current ICPs] DELETE customer_profile/icp: request", {
        icp_id: icpId,
        org_id: orgIdToUse,
      });
      setExistingICPs((prev) => prev.filter((e) => e.id !== icpId));
      setExpandedCurrentICPId((cur) => (cur === icpId ? null : cur));
      removeProfilerAcceptedIcpDisplayMeta(icpId);
      try {
        const deleteRes = await deleteCurrentIcpMutation.mutateAsync(icpId);
        const deleteBody = await deleteRes.json();
        console.log(
          "[Profiler Current ICPs] DELETE customer_profile/icp: response body",
          deleteBody,
        );
        if (deleteBody?.success && deleteBody?.data) {
          console.log(
            "[Profiler Current ICPs] DELETE: deleted_icp_id=",
            deleteBody.data.deleted_icp_id,
            "remaining_count=",
            deleteBody.data.remaining_count,
          );
        }
        await refetchCustomerProfileIcps();
        window.dispatchEvent(
          new CustomEvent("customerProfileSaved", { detail: { fromProfiler: true } }),
        );
        toast({ title: "ICP deleted", description: `"${icp.name}" removed from Current ICPs.` });
      } catch (e) {
        console.warn("[Profiler Current ICPs] DELETE customer_profile/icp: failed", e);
        await refetchCustomerProfileIcps();
        toast({
          title: "Could not delete ICP",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      }
    },
    [orgId, toast, refetchCustomerProfileIcps, deleteCurrentIcpMutation],
  );

  // Persist state changes
  useEffect(() => {
    localStorage.setItem("profiler_cardStatuses", JSON.stringify(cardStatuses));
  }, [cardStatuses]);

  useEffect(() => {
    localStorage.setItem("profiler_existingICPs", JSON.stringify(existingICPs));
  }, [existingICPs]);

  useEffect(() => {
    localStorage.setItem("profiler_showRecommendations", String(showRecommendations));
  }, [showRecommendations]);

  useEffect(() => {
    const orgIdToUse = orgId || "brewra";
    const uid = currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    const refreshStorageKey = uid ? `profiler_icp_refresh_${uid}` : null;
    const prevRefreshStored = refreshStorageKey
      ? Number(sessionStorage.getItem(refreshStorageKey) || "0")
      : 0;
    const refreshJustIncremented =
      Boolean(refreshStorageKey) && refreshTrigger > 0 && refreshTrigger > prevRefreshStored;

    const loadData = async () => {
      if (uid) {
        ensureMissionProfilerScope(uid, orgIdToUse);
        if (!refreshJustIncremented && isProfilerCacheValid(uid, orgIdToUse)) {
          const snap = getProfilerSnapshot(uid, orgIdToUse);
          const snapNew = (snap?.newICPs as SuggestedICP[]) ?? [];
          const snapRefined = (snap?.refinedICPs as SuggestedICP[]) ?? [];
          // Skip snapshot short-circuit when recommendations are empty so API/mock can repopulate.
          if (snap && (snapNew.length > 0 || snapRefined.length > 0)) {
            setExistingICPs(snap.existingICPs as ExistingICP[]);
            setRefinedICPs(snapRefined);
            setNewICPs(snapNew);
            setCardStatuses(snap.cardStatuses as Record<string, ICPCardStatus>);
            setLoading(false);
            return;
          }
        }
      }

      setLoading(true);

      profilerIcpDebug("loadData: refresh state", {
        refreshTrigger,
        prevRefreshStored,
        refreshJustIncremented,
        sessionKey: refreshStorageKey,
        willCallBackend: Boolean(uid),
      });

      const result = await loadProfilerPagePayload({
        orgIdToUse,
        uid,
        refreshJustIncremented,
        refreshTrigger,
        refreshStorageKey,
        warmProfilerCache: false,
        toast,
      });

      setExistingICPs(result.icps);
      setRefinedICPs(result.refined);
      setNewICPs(result.newSuggestions);
      setCardStatuses(result.mergedCardStatuses);

      if (uid) {
        commitProfilerSnapshot(uid, orgIdToUse, {
          existingICPs: result.icps,
          refinedICPs: result.refined,
          newICPs: result.newSuggestions,
          cardStatuses: result.mergedCardStatuses,
        });
      }

      setLoading(false);
    };
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast is stable; listing avoids noisy reloads
  }, [refreshTrigger, currentUser?.uid, orgId]);

  // --- Accept flow ---
  const handleAcceptClick = (icp: SuggestedICP) => {
    setConfirmAcceptICP(icp);
  };

  const handleConfirmAccept = async () => {
    if (!confirmAcceptICP || isSavingAccept) return;
    const icp = confirmAcceptICP;
    const uid = currentUser?.uid;
    const orgIdToUse = orgId || "brewra";
    if (!uid) {
      toast({
        title: "Cannot save ICP",
        description: "Sign in and ensure an organization context is available.",
        variant: "destructive",
      });
      setConfirmAcceptICP(null);
      return;
    }

    setIsSavingAccept(true);
    try {
      const idsBeforeAccept = new Set(existingICPs.map((e) => e.id));

      const acceptResult = await acceptIcpMutation.mutateAsync(icp.id);

      const displayMeta = {
        regions: Array.isArray(icp.regions) ? icp.regions : [],
        industry: icp.industry,
        companySize: icp.companySize,
        decisionMakers: Array.isArray(icp.decisionMakers) ? icp.decisionMakers : [],
        displayName: icp.name,
      };
      saveProfilerAcceptedIcpDisplayMeta(icp.id, displayMeta);
      const persistedFromResponse = extractPersistedIcpIdFromSuggestedProfileResponse(acceptResult);
      if (persistedFromResponse && persistedFromResponse !== icp.id) {
        saveProfilerAcceptedIcpDisplayMeta(persistedFromResponse, displayMeta);
      }

      const targetIcpId =
        resolveAcceptedPersistedIcpId(persistedFromResponse, idsBeforeAccept, [], icp.id) ??
        persistedFromResponse ??
        icp.id;

      const nextCardStatuses: Record<string, ICPCardStatus> = {
        ...cardStatuses,
        [icp.id]: { status: "accepted", acceptedAt: new Date() },
      };
      const nextRefined = refinedICPs.filter((x) => x.id !== icp.id);
      const nextNew = newICPs.filter((x) => x.id !== icp.id);
      const optimisticExisting = mapAcceptedSuggestedToExisting(icp, targetIcpId);
      const nextExisting = existingICPs.some((e) => e.id === targetIcpId)
        ? existingICPs.map((e) => (e.id === targetIcpId ? optimisticExisting : e))
        : [...existingICPs, optimisticExisting];

      setCardStatuses(nextCardStatuses);
      setRefinedICPs(nextRefined);
      setNewICPs(nextNew);
      setExistingICPs(nextExisting);
      setExpandedReportId((cur) => (cur === icp.id ? null : cur));
      removeFromProfilerRecommendedCached(icp.id);
      onICPAccepted?.(icp);

      commitProfilerSnapshot(uid, orgIdToUse, {
        existingICPs: nextExisting,
        refinedICPs: nextRefined,
        newICPs: nextNew,
        cardStatuses: nextCardStatuses,
      });

      const idsAfter = await refetchCustomerProfileIcps();
      const resolvedTargetIcpId = resolveAcceptedPersistedIcpId(
        persistedFromResponse,
        idsBeforeAccept,
        idsAfter,
        icp.id,
      );
      if (resolvedTargetIcpId) {
        const synced = await saveProfileMutation.mutateAsync({
          suggested: icp,
          targetIcpId: resolvedTargetIcpId,
        });
        if (synced) {
          try {
            const profileUrl = buildApiUrl(
              `customer_profile?org_id=${encodeURIComponent(orgIdToUse)}`,
            );
            const verifyRes = await fetch(profileUrl, {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            });
            if (verifyRes.ok) {
              const vd = await verifyRes.json();
              const icpsData = extractIcpsArrayFromCustomerProfileResponse(vd);
              if (icpsData.length > 0) {
                setUserLocalStorage(
                  "customerProfile",
                  JSON.stringify(mapCustomerProfileApiRowsToStoredIcps(icpsData)),
                  uid,
                );
              }
            }
          } catch {
            /* ignore */
          }
        }
      }

      const newProfileIds = idsAfter.filter((id) => !idsBeforeAccept.has(id));
      if (newProfileIds.length === 1 && newProfileIds[0] !== icp.id) {
        copyProfilerDisplayMetaToProfileId(icp.id, newProfileIds[0]);
      }
      await refetchCustomerProfileIcps();
      invalidateMissionControlCache(uid, orgIdToUse);
      invalidateProfilerCache(uid, orgIdToUse);
      void queryClient.invalidateQueries({ queryKey: qk.icps(orgIdToUse) });
      window.dispatchEvent(
        new CustomEvent("customerProfileSaved", { detail: { fromProfiler: true } }),
      );

      toast({
        title: "Customer Profile updated.",
        description: `"${icp.name}" has been saved to your Customer Profile and Current ICPs.`,
      });
    } catch (err) {
      toast({
        title: "Could not save ICP",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAccept(false);
      setConfirmAcceptICP(null);
    }
  };

  const handleUndoReject = useCallback(
    (icpId: string) => {
      const pending = readPendingRecommendedRejects().find((x) => x.icp_id === icpId);
      const rawSnap = pending?.icpSnapshot;
      const snap =
        rawSnap && typeof rawSnap === "object" && rawSnap !== null
          ? (rawSnap as SuggestedICP)
          : undefined;

      const existing = rejectTimersRef.current.get(icpId);
      if (existing) {
        clearTimeout(existing);
        rejectTimersRef.current.delete(icpId);
      }
      removePendingRecommendedReject(icpId);

      if (snap) {
        setRefinedICPs((prev) => {
          const without = prev.filter((x) => x.id !== icpId);
          return snap.type === "refined" ? [...without, snap] : without;
        });
        setNewICPs((prev) => {
          const without = prev.filter((x) => x.id !== icpId);
          return snap.type !== "refined" ? [...without, snap] : without;
        });
      }

      setCardStatuses((prev) => ({
        ...prev,
        [icpId]: { status: "suggested" },
      }));
      setExpandedReportId((cur) => (cur === icpId ? null : cur));
      toast({
        title: "Undo",
        description: "This recommendation has been restored to your list.",
      });
    },
    [toast],
  );

  const finalizeRecommendedReject = useCallback(
    async (icpId: string, userId: string) => {
      removePendingRecommendedReject(icpId);
      const existingTimer = rejectTimersRef.current.get(icpId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        rejectTimersRef.current.delete(icpId);
      }
      const icpForParent =
        refinedICPs.find((i) => i.id === icpId) ?? newICPs.find((i) => i.id === icpId);

      const applyDeleteSuccess = () => {
        removeFromProfilerRecommendedCached(icpId);
        recordDismissedRecommendedIcp(userId, icpId);
        setRefinedICPs((prev) => prev.filter((x) => x.id !== icpId));
        setNewICPs((prev) => prev.filter((x) => x.id !== icpId));
        setCardStatuses((prev) => {
          const next = { ...prev };
          delete next[icpId];
          return next;
        });
        setExpandedReportId((cur) => (cur === icpId ? null : cur));
        if (icpForParent) onICPRejected?.(icpForParent);
        toast({
          title: "Recommendation removed",
          description: "This recommendation has been removed from your list.",
        });
      };

      try {
        await rejectIcpMutation.mutateAsync(icpId);
        applyDeleteSuccess();
      } catch (e) {
        if (isRecommendedDeleteNotFound(e)) {
          applyDeleteSuccess();
          return;
        }
        toast({
          title: "Could not remove recommendation",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
        setCardStatuses((prev) => ({
          ...prev,
          [icpId]: { status: "suggested" },
        }));
      }
    },
    [refinedICPs, newICPs, toast, onICPRejected, rejectIcpMutation],
  );

  const finalizeRecommendedRejectRef = useRef(finalizeRecommendedReject);
  finalizeRecommendedRejectRef.current = finalizeRecommendedReject;

  useEffect(() => {
    if (loading || !currentUser?.uid) return;
    const uid = currentUser.uid;
    const items = readPendingRecommendedRejects().filter((x) => x.user_id === uid);
    const now = Date.now();
    for (const item of items) {
      if (rejectTimersRef.current.has(item.icp_id)) continue;
      const remaining = item.expiresAt - now;
      if (remaining <= 0) {
        removePendingRecommendedReject(item.icp_id);
        void finalizeRecommendedRejectRef.current(item.icp_id, uid);
      } else {
        setCardStatuses((prev) => ({
          ...prev,
          [item.icp_id]: {
            status: "rejected",
            rejectedAt: prev[item.icp_id]?.rejectedAt ?? new Date(),
          },
        }));
        const t = setTimeout(() => {
          rejectTimersRef.current.delete(item.icp_id);
          void finalizeRecommendedRejectRef.current(item.icp_id, uid);
        }, remaining);
        rejectTimersRef.current.set(item.icp_id, t);
      }
    }
  }, [loading, currentUser?.uid]);

  const handleUndoAccept = useCallback(
    (icpId: string) => {
      setCardStatuses((prev) => ({
        ...prev,
        [icpId]: { status: "suggested" },
      }));
      setExpandedReportId((cur) => (cur === icpId ? null : cur));
      toast({
        title: "Action undone",
        description: "ICP returned to suggestions and removed from Current ICPs.",
      });
    },
    [toast],
  );

  const handleRejectICP = useCallback(
    (icp: SuggestedICP) => {
      const userId = currentUser?.uid;
      if (!userId) {
        toast({
          title: "Sign in required",
          description: "You must be signed in to dismiss recommendations.",
          variant: "destructive",
        });
        return;
      }
      const prevTimer = rejectTimersRef.current.get(icp.id);
      if (prevTimer) {
        clearTimeout(prevTimer);
        rejectTimersRef.current.delete(icp.id);
      }
      const expiresAt = Date.now() + 5000;
      upsertPendingRecommendedReject(icp.id, userId, expiresAt, icp);
      setCardStatuses((prev) => ({
        ...prev,
        [icp.id]: { status: "rejected", rejectedAt: new Date() },
      }));
      const t = setTimeout(() => {
        rejectTimersRef.current.delete(icp.id);
        void finalizeRecommendedReject(icp.id, userId);
      }, 5000);
      rejectTimersRef.current.set(icp.id, t);
      toast({
        title: "Recommendation dismissed",
        description: "Use Undo if you want to keep this recommendation.",
        action: (
          <ToastAction altText="Undo dismiss" onClick={() => handleUndoReject(icp.id)}>
            Undo
          </ToastAction>
        ),
      });
    },
    [currentUser?.uid, toast, handleUndoReject, finalizeRecommendedReject],
  );

  const handleViewProspects = (icpName: string) => {
    window.dispatchEvent(
      new CustomEvent("navigateToLeadStream", { detail: { filterICP: icpName } }),
    );
  };

  // --- Render ---
  const allSuggestions = [...refinedICPs, ...newICPs];
  const visibleRecommendedIcps = allSuggestions.filter(
    (s) => cardStatuses[s.id]?.status !== "accepted",
  );

  return (
    <div className="space-y-8 relative">
      {/* Loading Modal - same as Scout (Brewra logo) */}
      <Dialog open={loading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md border-0 bg-transparent shadow-none p-0">
          <DialogTitle className="sr-only">Generating ICPs</DialogTitle>
          <DialogDescription className="sr-only">
            Please wait while we fetch your recommended ICPs.
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
                Generating ICPs
              </p>
              <p className="text-sm text-muted-foreground font-medium">
                Please wait while we fetch your recommended ICPs...
              </p>
            </div>
            {/* Animated Progress Dots */}
            <div className="flex gap-2">
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
              />
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
              />
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ═══ Section 1: Current ICPs (table) ═══ */}
      <CurrentIcpsTable
        existingICPs={existingICPs}
        expandedCurrentICPId={expandedCurrentICPId}
        onToggleExpand={setExpandedCurrentICPId}
        onDelete={(icp) => void handleDeleteCurrentIcp(icp)}
        onViewProspects={handleViewProspects}
      />

      {/* ═══ Section 3: Recommended ICPs — Cards row + Full Report below at 80% width ═══ */}
      <div className="space-y-4 animate-fade-in">
        {visibleRecommendedIcps.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Recommended ICPs
            </h3>
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4">
                {visibleRecommendedIcps.map((icp) => (
                  <RecommendedICPCard
                    key={icp.id}
                    icp={icp}
                    leadCount={getLeadCountForICP(icp.name)}
                    status={cardStatuses[icp.id] || { status: "suggested" }}
                    isExpanded={expandedReportId === icp.id}
                    onAccept={() => handleAcceptClick(icp)}
                    onReject={() => handleRejectICP(icp)}
                    onUndo={() => handleUndoReject(icp.id)}
                    onToggleReport={() =>
                      setExpandedReportId(expandedReportId === icp.id ? null : icp.id)
                    }
                    onViewProspects={() => handleViewProspects(icp.name)}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </>
        )}

        {/* Full Report — appears below the cards, 80% width, no drawer */}
        {expandedReportId &&
          (() => {
            const icp = allSuggestions.find((s) => s.id === expandedReportId);
            if (!icp) return null;
            const status = cardStatuses[icp.id] || { status: "suggested" as const };
            const isSuggested = status.status === "suggested";
            const isAccepted = status.status === "accepted";
            const isRejected = status.status === "rejected";
            const leadCount = getLeadCountForICP(icp.name);
            return (
              <Card className="w-full max-w-[55vw] mx-auto border-t-2 border-primary/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Full Report — {icp.name}
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedReportId(null)}
                      className="gap-1"
                    >
                      <X className="h-4 w-4" />
                      Close Report
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <RecommendedICPReportContent
                    icp={icp}
                    leadCount={leadCount}
                    status={status}
                    isSuggested={isSuggested}
                    isAccepted={isAccepted}
                    isRejected={isRejected}
                    onAccept={() => handleAcceptClick(icp)}
                    onReject={() => handleRejectICP(icp)}
                    onUndo={() =>
                      isAccepted ? handleUndoAccept(icp.id) : handleUndoReject(icp.id)
                    }
                    onViewProspects={() => handleViewProspects(icp.name)}
                  />
                </CardContent>
              </Card>
            );
          })()}
      </div>

      {/* ═══ Accept Confirmation Dialog ═══ */}
      <AlertDialog
        open={!!confirmAcceptICP}
        onOpenChange={(open) => !open && setConfirmAcceptICP(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save to Customer Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want me to save "{confirmAcceptICP?.name}" to your Customer Profile? This will
              make it available for Lead Stream scoring and agent routing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isSavingAccept} onClick={() => void handleConfirmAccept()}>
              {isSavingAccept ? "Saving…" : "Okay"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
