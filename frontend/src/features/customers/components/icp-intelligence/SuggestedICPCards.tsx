import {
  Check,
  X,
  Eye,
  Users,
  Target,
  Sparkles,
  RefreshCw,
  Plus,
  ArrowRight,
  AlertTriangle,
  ThumbsUp,
  Undo2,
  Shield,
  Gauge,
  Lightbulb,
  Zap,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

import type { ExistingICP, SuggestedICP, ICPCardStatus, SuggestedICPCardsProps } from "../../types";
import { getLeadCountForICP } from "../lead-stream/LeadStream";

import {
  analyzeICP,
  confidenceColor,
  mapCustomerProfileICPToExisting,
  normalizeIcpGetResponse,
  hasBackendFullReport,
  mapApiICPToSuggested,
} from "./icpMapping";
import {
  readPendingRecommendedRejects,
  upsertPendingRecommendedReject,
  removePendingRecommendedReject,
  recordDismissedRecommendedIcp,
  removeFromProfilerRecommendedCached,
  filterDismissedFromSuggested,
  isRecommendedDeleteNotFound,
} from "./suggestedIcpStorage";

import { EditDropdownMenu } from "@/components/market-research/EditDropdownMenu";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { buildIcpUrl, buildApiUrl, apiFetchJson, apiFetch } from "@/lib/api";
import type { UntypedProfilerIcpRecord } from "@/lib/types/escape-hatches";
import { useAuth } from "@/shared/auth";
import {
  ensureMissionProfilerScope,
  isProfilerCacheValid,
  getProfilerSnapshot,
  commitProfilerSnapshot,
  fetchIcpsRowsForOrg,
  saveProfilerAcceptedIcpDisplayMeta,
  copyProfilerDisplayMetaToProfileId,
  extractPersistedIcpIdFromSuggestedProfileResponse,
  extractIcpsArrayFromCustomerProfileResponse,
  mergeSuggestedIntoCustomerProfileApiRow,
  buildCustomerProfileSavePayload,
  mapCustomerProfileApiRowsToStoredIcps,
  resolveAcceptedPersistedIcpId,
  type SuggestedIcpCardFields,
  removeProfilerAcceptedIcpDisplayMeta,
} from "@/shared/profiler";
import { getUserLocalStorage, setUserLocalStorage } from "@/utils/cacheUtils";

/** Dev-only logs for verifying Refresh → GET /icp → mapped cards/reports. Strip or disable for production noise. */
function profilerIcpDebug(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log("[Profiler ICP]", ...args);
  }
}

/**
 * After POST /from_suggested_icp, persist firmographics the same way as Mission Control manual save:
 * GET full profile → merge suggested fields into the new row → POST /customer_profile (full icps[]).
 */
async function persistAcceptedSuggestedIcpToBackend(options: {
  orgId: string;
  suggested: SuggestedIcpCardFields;
  targetIcpId: string;
}): Promise<boolean> {
  const { orgId, suggested, targetIcpId } = options;
  const profileUrl = buildApiUrl(`customer_profile?org_id=${encodeURIComponent(orgId)}`);
  try {
    const profileRes = await fetch(profileUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!profileRes.ok) return false;
    const profileData = await profileRes.json();
    const icpsData = extractIcpsArrayFromCustomerProfileResponse(profileData);
    if (!icpsData.length) return false;

    const idx = icpsData.findIndex(
      (row: UntypedProfilerIcpRecord) => String(row.id) === String(targetIcpId),
    );
    if (idx < 0) return false;

    const merged = mergeSuggestedIntoCustomerProfileApiRow(icpsData[idx], suggested);
    const nextIcps = [...icpsData];
    nextIcps[idx] = merged;

    const payload = buildCustomerProfileSavePayload(nextIcps, orgId);
    const saveRes = await fetch(profileUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return saveRes.ok;
  } catch {
    return false;
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
      const rows = await fetchIcpsRowsForOrg(uid, orgIdToUse);
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
      const icpParams = new URLSearchParams({ user_id: uid });
      if (refreshJustIncremented) {
        icpParams.set("refresh", "true");
      }
      const icpUrl = buildIcpUrl(icpParams.toString());
      profilerIcpDebug("GET /icp (backend) — request", {
        url: icpUrl,
        user_id: uid,
        refresh: refreshJustIncremented,
      });
      const icpRes = await fetch(icpUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      profilerIcpDebug("GET /icp — response", { status: icpRes.status, ok: icpRes.ok });
      if (icpRes.ok) {
        const icpData = await icpRes.json();
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
              title: "ICPs refreshed",
              description: `${newSuggestions.length} recommended ICPs generated.`,
            });
          }
        } else {
          profilerIcpDebug("GET /icp — empty normalized array; UI will fall back to cache or mock");
        }
      } else {
        console.warn("ICP API returned", icpRes.status, icpRes.statusText);
        profilerIcpDebug("GET /icp — non-OK response", {
          status: icpRes.status,
          statusText: icpRes.statusText,
        });
        if (refreshJustIncremented) {
          toast?.({
            title: "Refresh failed",
            description: `API returned ${icpRes.status}. Using cached data.`,
            variant: "destructive",
          });
        }
      }
    } catch (e) {
      console.warn("Could not fetch recommended ICPs from API:", e);
      profilerIcpDebug("GET /icp — fetch error", e);
      if (refreshJustIncremented) {
        toast?.({
          title: "Refresh failed",
          description: "Using cached data. Please try again.",
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
  const { currentUser, orgId } = useAuth();

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
      const rows = await fetchIcpsRowsForOrg(uid, orgIdToUse);
      if (rows.length === 0) {
        setExistingICPs([]);
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
        const deleteRes = await apiFetch(
          `customer_profile/icp/${encodeURIComponent(icpId)}?org_id=${encodeURIComponent(orgIdToUse)}`,
          { method: "DELETE" },
        );
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
    [orgId, toast, refetchCustomerProfileIcps],
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
          if (snap) {
            setExistingICPs(snap.existingICPs as ExistingICP[]);
            setRefinedICPs(snap.refinedICPs as SuggestedICP[]);
            setNewICPs(snap.newICPs as SuggestedICP[]);
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

      const acceptResult = await apiFetchJson("customer_profile/from_suggested_icp", {
        method: "POST",
        body: {
          user_id: uid,
          org_id: orgIdToUse,
          icp_id: icp.id,
        },
      });

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

      setCardStatuses((prev) => ({
        ...prev,
        [icp.id]: { status: "accepted", acceptedAt: new Date() },
      }));
      onICPAccepted?.(icp);

      const idsAfter = await refetchCustomerProfileIcps();
      const targetIcpId = resolveAcceptedPersistedIcpId(
        persistedFromResponse,
        idsBeforeAccept,
        idsAfter,
        icp.id,
      );
      if (targetIcpId) {
        const synced = await persistAcceptedSuggestedIcpToBackend({
          orgId: orgIdToUse,
          suggested: icp,
          targetIcpId,
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
              setUserLocalStorage(
                "customerProfile",
                JSON.stringify(mapCustomerProfileApiRowsToStoredIcps(icpsData)),
                uid,
              );
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
        await apiFetch(
          `icp/recommended/${encodeURIComponent(icpId)}?user_id=${encodeURIComponent(userId)}`,
          { method: "DELETE" },
        );
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
    [refinedICPs, newICPs, toast, onICPRejected],
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
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Current ICPs
        </h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Company Size</TableHead>
                <TableHead>Buyer Role</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Report</TableHead>
                <TableHead className="text-right">Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingICPs.map((icp) => {
                const analysis = analyzeICP(icp);
                const isExpanded = expandedCurrentICPId === icp.id;
                return (
                  <>
                    <TableRow key={icp.id}>
                      <TableCell className="font-medium">{icp.name}</TableCell>
                      <TableCell>{icp.industry || "—"}</TableCell>
                      <TableCell>{icp.geography || "—"}</TableCell>
                      <TableCell>{icp.companySize || "—"}</TableCell>
                      <TableCell>{icp.buyerRole || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${confidenceColor(icp.fitConfidence || "Medium")}`}
                        >
                          {icp.fitConfidence || "Medium"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewProspects(icp.name)}
                          className="text-primary hover:text-primary/80"
                        >
                          <Zap className="h-3.5 w-3.5 mr-1" />
                          View Leads
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedCurrentICPId(isExpanded ? null : icp.id)}
                          className="text-primary hover:text-primary/80"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          {isExpanded ? "Close" : "View Report"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDeleteCurrentIcp(icp)}
                          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${icp.id}-report`}>
                        <TableCell colSpan={9} className="p-0">
                          <div className="transition-all duration-500 ease-in-out border-t px-6 py-5 space-y-5 bg-background">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <h4 className="text-sm font-semibold">
                                  Profiler's Analysis — {icp.name}
                                </h4>
                              </div>
                              <div className="flex items-center gap-1">
                                <EditDropdownMenu
                                  onModify={() =>
                                    toast({
                                      title: "Edit mode",
                                      description: "You can now modify this report.",
                                    })
                                  }
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary/80 gap-1 h-7 text-xs"
                                  onClick={() =>
                                    toast({
                                      title: "Chat with Profiler",
                                      description: "Profiler agent chat opening...",
                                    })
                                  }
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Agentic
                                </Button>
                              </div>
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4">
                              <p className="text-xs font-medium text-foreground mb-1">
                                Profiler's Interpretation
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {analysis.interpretation}
                              </p>
                            </div>

                            {analysis.strengths.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                                  <ThumbsUp className="h-3 w-3" /> What's Good
                                </p>
                                <ul className="space-y-1.5">
                                  {analysis.strengths.map((s, i) => (
                                    <li key={i} className="text-xs flex items-start gap-2">
                                      <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {analysis.weaknesses.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Weak Points
                                </p>
                                <ul className="space-y-1.5">
                                  {analysis.weaknesses.map((w, i) => (
                                    <li key={i} className="text-xs flex items-start gap-2">
                                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                                      {w}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {analysis.missing.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-2 flex items-center gap-1">
                                  <X className="h-3 w-3" /> Missing
                                </p>
                                <ul className="space-y-1.5">
                                  {analysis.missing.map((m, i) => (
                                    <li key={i} className="text-xs flex items-start gap-2">
                                      <X className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                                      {m}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t">
                              <div className="flex items-center gap-2 text-xs">
                                <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {analysis.broadNarrow}
                                </span>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-xs ${confidenceColor(analysis.confidence)}`}
                              >
                                Confidence: {analysis.confidence}
                              </Badge>
                            </div>

                            <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/20 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-primary" />
                                <div>
                                  <p className="text-xs font-semibold text-foreground">
                                    View prospects
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    See leads for "{icp.name}"
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs"
                                onClick={() => handleViewProspects(icp.name)}
                              >
                                Lead Stream <ArrowRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

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

/** Renders backend GET /icp nested `report` payload (icp-research-style `data` object). */
const BackendProfilerReportView = ({ report }: { report: Record<string, unknown> }) => {
  const title = typeof report.title === "string" ? report.title : null;
  const isNew = report.is_new === true;
  const isAgentic = report.is_agentic === true;
  const whySuggested = Array.isArray(report.why_suggested)
    ? (report.why_suggested as string[])
    : Array.isArray(report.whySuggested)
      ? (report.whySuggested as string[])
      : [];
  const howItDiffers = Array.isArray(report.how_it_differs)
    ? (report.how_it_differs as string[])
    : Array.isArray(report.howItDiffers)
      ? (report.howItDiffers as string[])
      : [];
  const firmographics =
    report.firmographics && typeof report.firmographics === "object"
      ? (report.firmographics as Record<string, unknown>)
      : null;
  const keyDms = Array.isArray(report.key_decision_makers)
    ? (report.key_decision_makers as string[])
    : Array.isArray(report.keyDecisionMakers)
      ? (report.keyDecisionMakers as string[])
      : [];
  const painRaw = report.pain_points_and_triggers;
  const pain =
    painRaw && typeof painRaw === "object"
      ? (painRaw as { critical?: string; others?: string[] })
      : null;
  const competitors = Array.isArray(report.competitors) ? (report.competitors as string[]) : [];

  return (
    <div className="space-y-5">
      {(title || isNew || isAgentic) && (
        <div className="flex flex-wrap items-center gap-2">
          {title && <h4 className="text-sm font-semibold">{title}</h4>}
          {isNew && (
            <Badge variant="secondary" className="text-[10px]">
              New
            </Badge>
          )}
          {isAgentic && (
            <Badge variant="outline" className="text-[10px]">
              Agentic
            </Badge>
          )}
        </div>
      )}

      {whySuggested.length > 0 && (
        <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/10">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            Why This ICP Was Suggested
          </p>
          <ul className="space-y-1.5">
            {whySuggested.map((reason, idx) => (
              <li key={idx} className="text-xs flex items-start gap-2">
                <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {howItDiffers.length > 0 && (
        <div className="rounded-lg p-3 border border-amber-100 bg-amber-50/20">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
            How This Differs
          </p>
          <ul className="space-y-1.5">
            {howItDiffers.map((line, idx) => (
              <li key={idx} className="text-xs flex items-start gap-2">
                <RefreshCw className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {firmographics && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {typeof firmographics.industry === "string" && (
            <div>
              <p className="text-muted-foreground">Industry</p>
              <p className="font-medium">{firmographics.industry}</p>
            </div>
          )}
          {typeof firmographics.segment === "string" && (
            <div>
              <p className="text-muted-foreground">Segment</p>
              <p className="font-medium">{firmographics.segment}</p>
            </div>
          )}
          {(typeof firmographics.company_size === "string" ||
            typeof firmographics.companySize === "string") && (
            <div>
              <p className="text-muted-foreground">Company Size</p>
              <p className="font-medium">
                {(firmographics.company_size || firmographics.companySize) as string}
              </p>
            </div>
          )}
          {(typeof firmographics.market_size === "string" ||
            typeof firmographics.marketSize === "string") && (
            <div>
              <p className="text-muted-foreground">Market Size</p>
              <p className="font-medium">
                {(firmographics.market_size || firmographics.marketSize) as string}
              </p>
            </div>
          )}
        </div>
      )}

      {keyDms.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Users className="h-3 w-3" /> Key Decision Makers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {keyDms.map((dm, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {dm}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {pain && (pain.critical || (pain.others && pain.others.length > 0)) && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Target className="h-3 w-3" /> Pain Points & Triggers
          </p>
          {pain.critical && (
            <p className="text-xs font-medium bg-destructive/10 text-destructive p-2 rounded-md mb-2">
              {pain.critical}
            </p>
          )}
          {Array.isArray(pain.others) && pain.others.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pain.others.map((t, i) => (
                <Badge key={i} variant="outline" className="text-[11px]">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {competitors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Shield className="h-3 w-3" /> Competitors
          </p>
          <div className="flex flex-wrap gap-1.5">
            {competitors.map((c, i) => (
              <Badge key={i} variant="outline" className="text-[11px]">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Full report body: backend payload when present, else fields from the ICP card. */
const SuggestedICPFullReportBody = ({ icp }: { icp: SuggestedICP }) => {
  const fr = icp.fullReport;
  if (fr && typeof fr === "object" && Object.keys(fr).length > 0) {
    return <BackendProfilerReportView report={fr} />;
  }

  return (
    <>
      <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/10">
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" />
          Why This ICP Was Suggested
        </p>
        <ul className="space-y-1.5">
          {icp.whySuggested.map((reason, idx) => (
            <li key={idx} className="text-xs flex items-start gap-2">
              <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
        {icp.opportunityUnlocked && (
          <div className="mt-2 bg-primary/5 rounded p-2">
            <p className="text-[11px] font-medium text-primary">
              Opportunity: {icp.opportunityUnlocked}
            </p>
          </div>
        )}
      </div>

      <div
        className={`rounded-lg p-3 border ${icp.type === "refined" ? "border-amber-100 bg-amber-50/20" : "border-primary/10 bg-primary/[0.02]"}`}
      >
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
          {icp.type === "refined" ? "What Changed" : "How This Differs"}
        </p>
        {icp.type === "refined" && icp.whatChanged ? (
          <ul className="space-y-1.5">
            {icp.whatChanged.map((change, idx) => (
              <li key={idx} className="text-xs flex items-start gap-2">
                <RefreshCw className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                <span>{change}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs flex items-start gap-2">
              <Plus className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              <span>
                New segment: {icp.industry} — {icp.segment}
              </span>
            </p>
            <p className="text-xs flex items-start gap-2">
              <Users className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              <span>Buyers: {icp.decisionMakers.join(", ")}</span>
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Industry</p>
          <p className="font-medium">{icp.industry}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Segment</p>
          <p className="font-medium">{icp.segment}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Company Size</p>
          <p className="font-medium">{icp.companySize}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Market Size</p>
          <p className="font-medium">{icp.marketSize || "N/A"}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Users className="h-3 w-3" /> Key Decision Makers
        </p>
        <div className="flex flex-wrap gap-1.5">
          {icp.decisionMakers.map((dm, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {dm}
            </Badge>
          ))}
        </div>
      </div>

      {(icp.topPainPoint || (icp.buyingTriggers && icp.buyingTriggers.length > 0)) && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Target className="h-3 w-3" /> Pain Points & Triggers
          </p>
          {icp.topPainPoint && (
            <p className="text-xs font-medium bg-destructive/10 text-destructive p-2 rounded-md mb-2">
              {icp.topPainPoint}
            </p>
          )}
          {icp.buyingTriggers && (
            <div className="flex flex-wrap gap-1.5">
              {icp.buyingTriggers.map((t, i) => (
                <Badge key={i} variant="outline" className="text-[11px]">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {icp.competitors && icp.competitors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Shield className="h-3 w-3" /> Competitors
          </p>
          <div className="flex flex-wrap gap-1.5">
            {icp.competitors.map((c, i) => (
              <Badge key={i} variant="outline" className="text-[11px]">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

// ========== FULL REPORT CONTENT (used in Sheet at 80% width) ==========
interface RecommendedICPReportContentProps {
  icp: SuggestedICP;
  leadCount: number;
  status: ICPCardStatus;
  isSuggested: boolean;
  isAccepted: boolean;
  isRejected: boolean;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
  onViewProspects: () => void;
  onCloseReport?: () => void;
}

const RecommendedICPReportContent = ({
  icp,
  leadCount,
  isSuggested,
  isAccepted,
  isRejected,
  onAccept,
  onReject,
  onUndo,
  onViewProspects,
}: RecommendedICPReportContentProps) => {
  const { toast } = useToast();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge
          variant="secondary"
          className={`text-xs ${icp.type === "refined" ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"}`}
        >
          {icp.type === "refined" ? "Refined" : "New"}
        </Badge>
        <div className="flex items-center gap-1">
          <EditDropdownMenu
            onModify={() =>
              toast({ title: "Edit mode", description: "You can now modify this report." })
            }
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80 gap-1 h-7 text-xs"
            onClick={() =>
              toast({ title: "Chat with Profiler", description: "Profiler agent chat opening..." })
            }
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Agentic
          </Button>
        </div>
      </div>

      <SuggestedICPFullReportBody icp={icp} />

      {isSuggested && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button size="sm" onClick={onAccept} className="flex-1">
            <Check className="h-3 w-3 mr-1" /> Accept
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
            <X className="h-3 w-3 mr-1" /> Reject
          </Button>
        </div>
      )}
      {(isAccepted || isRejected) && (
        <div className="pt-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            onClick={onUndo}
            className="w-full text-xs text-muted-foreground"
          >
            <Undo2 className="h-3 w-3 mr-1" /> Undo
          </Button>
        </div>
      )}

      <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs font-semibold text-foreground">View prospects</p>
            <p className="text-[11px] text-muted-foreground">
              See {leadCount} lead{leadCount !== 1 ? "s" : ""} for "{icp.name}" in Lead Stream
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onViewProspects}>
          Lead Stream <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

// ========== RECOMMENDED ICP CARD (View Full Report opens Sheet; cards stay fixed size) ==========
interface RecommendedICPCardProps {
  icp: SuggestedICP;
  leadCount: number;
  status: ICPCardStatus;
  isExpanded: boolean;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
  onToggleReport: () => void;
  onViewProspects: () => void;
}

const RecommendedICPCard = ({
  icp,
  leadCount,
  status,
  isExpanded,
  onAccept,
  onReject,
  onUndo,
  onToggleReport,
}: RecommendedICPCardProps) => {
  const isAccepted = status.status === "accepted";
  const isRejected = status.status === "rejected";
  const isSuggested = status.status === "suggested";

  return (
    <div className="flex-shrink-0 min-w-[340px] max-w-[360px]">
      <Card
        className={`h-full transition-all duration-300 ${
          isAccepted
            ? "border-emerald-200 bg-emerald-50/30"
            : isRejected
              ? "opacity-50 border-muted"
              : ""
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <Badge
                variant="secondary"
                className={`text-xs mb-2 ${
                  icp.type === "refined"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {icp.type === "refined" ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refined ICP
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3 mr-1" />
                    New ICP
                  </>
                )}
              </Badge>
              <CardTitle className="text-base font-semibold truncate">{icp.name}</CardTitle>
              {icp.type === "refined" && icp.sourceICPName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Refined from: {icp.sourceICPName}
                </p>
              )}
              {icp.tag && icp.type === "new" && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {icp.tag}
                </Badge>
              )}
            </div>
            <Badge
              variant="outline"
              className={`text-xs shrink-0 ${confidenceColor(icp.confidenceScore)}`}
            >
              {icp.confidenceScore}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-3">
          {/* ICP Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Industry:</span>
              <p className="font-medium">{icp.industry}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Size:</span>
              <p className="font-medium">{icp.companySize}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Regions:</span>
              <p className="font-medium">{icp.regions.join(", ")}</p>
            </div>
            {icp.marketSize && (
              <div>
                <span className="text-muted-foreground">Market:</span>
                <p className="font-medium">
                  {icp.marketSize} {icp.growth && `(${icp.growth})`}
                </p>
              </div>
            )}
            <div className="col-span-2 flex items-center gap-1.5 text-primary">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span className="text-muted-foreground">Lead Stream:</span>
              <span className="font-semibold">
                {leadCount} lead{leadCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {hasBackendFullReport(icp) && (
            <p className="text-xs text-muted-foreground border border-dashed border-primary/25 rounded-md px-2 py-2 bg-muted/30">
              Detailed report from Profiler opens when you click{" "}
              <span className="font-medium text-foreground">View Full Report</span>.
            </p>
          )}

          {/* Why Suggested — hidden when backend sent a full report blob (shown only in expanded report) */}
          {!hasBackendFullReport(icp) && icp.whySuggested.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Why Suggested</p>
              <ul className="space-y-1">
                {icp.whySuggested.slice(0, 3).map((reason, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-1.5">
                    <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasBackendFullReport(icp) && icp.type === "refined" && icp.whatChanged && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">What Changed</p>
              <ul className="space-y-1">
                {icp.whatChanged.map((c, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-1.5">
                    <RefreshCw className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasBackendFullReport(icp) && icp.type === "new" && icp.opportunityUnlocked && (
            <div className="bg-primary/5 rounded-md p-2">
              <p className="text-xs font-medium text-primary mb-0.5">Opportunity Unlocked</p>
              <p className="text-xs">{icp.opportunityUnlocked}</p>
            </div>
          )}

          {/* Status badges */}
          {isAccepted && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100 rounded-md p-2">
              <Check className="h-3 w-3" />
              <span>Added to Customer Profile</span>
            </div>
          )}
          {isRejected && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-md p-2">
              <X className="h-3 w-3" />
              <span>Dismissed</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-3 border-t flex flex-col gap-2">
          {/* Accept / Reject */}
          {/* View Full Report — expand/collapse */}
          <Button
            size="sm"
            variant={isExpanded ? "secondary" : "outline"}
            onClick={onToggleReport}
            className="w-full"
          >
            {isExpanded ? (
              <>
                <X className="h-3 w-3 mr-1" />
                Close Report
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 mr-1" />
                View Full Report
              </>
            )}
          </Button>
          {isSuggested && (
            <div className="flex items-center gap-2 w-full">
              <Button size="sm" onClick={onAccept} className="flex-1">
                <Check className="h-3 w-3 mr-1" />
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          )}
          {(isAccepted || isRejected) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onUndo}
              className="w-full text-xs text-muted-foreground"
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Undo
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};
