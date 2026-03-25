import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditDropdownMenu } from "@/components/market-research/EditDropdownMenu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import {
  Check,
  X,
  Eye,
  TrendingUp,
  Users,
  Target,
  ChevronDown,
  ChevronUp,
  Edit,
  Save,
  Download,
  Minimize2,
  Sparkles,
  RefreshCw,
  Plus,
  ArrowRight,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Undo2,
  Shield,
  Gauge,
  Lightbulb,
  Zap,
  MessageSquare,
  Pencil,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getLeadCountForICP } from "@/components/customers/LeadStream";
import { buildIcpUrl, buildApiUrl } from "@/lib/api";
import { getUserLocalStorage } from "@/utils/cacheUtils";

/** Dev-only logs for verifying Refresh → GET /icp → mapped cards/reports. Strip or disable for production noise. */
function profilerIcpDebug(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log("[Profiler ICP]", ...args);
  }
}

// --- Types ---
interface ExistingICP {
  id: string;
  name: string;
  geography?: string;
  industry?: string;
  companySize?: string;
  buyerRole?: string;
  fitConfidence?: string;
  status?: "active" | "inactive";
}

interface SuggestedICP {
  id: string;
  name: string;
  type: "refined" | "new";
  sourceICPId?: string;
  sourceICPName?: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
  whySuggested: string[];
  whatChanged?: string[];
  opportunityUnlocked?: string;
  confidenceScore: "High" | "Medium" | "Low";
  tag?: string;
  marketSize?: string;
  growth?: string;
  topPainPoint?: string;
  buyingTriggers?: string[];
  competitors?: string[];
  /** Full report payload from GET /icp (per card). Shown only after "View Full Report". */
  fullReport?: Record<string, unknown>;
}

interface ICPCardStatus {
  status: "suggested" | "accepted" | "rejected";
  acceptedAt?: Date;
  rejectedAt?: Date;
}

interface SuggestedICPCardsProps {
  onICPAccepted?: (icp: SuggestedICP) => void;
  onICPRejected?: (icp: SuggestedICP) => void;
  refreshTrigger?: number;
}

// --- ICP Chip Modal Content (Profiler's interpretation) ---
interface ICPAnalysis {
  interpretation: string;
  strengths: string[];
  weaknesses: string[];
  missing: string[];
  broadNarrow: string;
  confidence: "High" | "Medium" | "Low";
}

const analyzeICP = (icp: ExistingICP): ICPAnalysis => {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const missing: string[] = [];

  if (icp.industry) strengths.push(`Clear industry focus: ${icp.industry}`);
  else missing.push("No industry specified — targeting is too broad");

  if (icp.buyerRole) strengths.push(`Defined buyer role: ${icp.buyerRole}`);
  else missing.push("No buyer role — unclear who to engage");

  if (icp.companySize) strengths.push(`Company size defined: ${icp.companySize}`);
  else missing.push("No company size filter");

  if (icp.geography) strengths.push(`Geographic focus: ${icp.geography}`);
  else weaknesses.push("No geographic focus — could dilute outreach");

  if (icp.fitConfidence === "Low" || icp.fitConfidence === "Medium") {
    weaknesses.push(`Fit confidence is ${icp.fitConfidence} — may need tighter criteria`);
  }

  if (!icp.buyerRole?.includes(",") && !icp.buyerRole?.includes("/")) {
    weaknesses.push("Single buyer role — consider adding secondary decision-makers");
  }

  const broadNarrow =
    strengths.length >= 3 && weaknesses.length <= 1
      ? "Well-balanced targeting scope"
      : weaknesses.length > strengths.length
        ? "Too broad — consider adding more filters to tighten targeting"
        : "Slightly narrow — expanding regions or roles could increase pipeline";

  const confidence: "High" | "Medium" | "Low" =
    strengths.length >= 4 ? "High" : strengths.length >= 2 ? "Medium" : "Low";

  return {
    interpretation: `Profiler sees "${icp.name}" as targeting ${icp.industry || "unspecified industry"} companies (${icp.companySize || "any size"}) in ${icp.geography || "all regions"}, engaging ${icp.buyerRole || "unspecified roles"}.`,
    strengths,
    weaknesses,
    missing,
    broadNarrow,
    confidence,
  };
};

// --- Confidence badge color ---
const confidenceColor = (c: string) => {
  if (c === "High") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (c === "Medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
};

// Map customer profile ICP (Mission Control) to ExistingICP format
const mapCustomerProfileICPToExisting = (icp: any, index: number): ExistingICP => {
  const industryArr = Array.isArray(icp.industry) ? icp.industry : [icp.industry].filter(Boolean);
  const companySizeArr = Array.isArray(icp.company_size) ? icp.company_size : Array.isArray(icp.companySize) ? icp.companySize : [];
  const buyerRoleArr = Array.isArray(icp.buyer_role) ? icp.buyer_role : Array.isArray(icp.buyerRole) ? icp.buyerRole : [];
  const locationArr = Array.isArray(icp.location) ? icp.location : [];
  const primaryRegion = icp.primary_region || icp.primaryRegion || "";
  const name = icp.name || (industryArr[0] ? `${industryArr[0]} - ${primaryRegion || "Global"}` : `ICP ${index + 1}`);
  return {
    id: icp.id || `icp-${index + 1}`,
    name,
    geography: primaryRegion || (locationArr.length > 0 ? locationArr.join(", ") : undefined),
    industry: industryArr.join(", ") || undefined,
    companySize: companySizeArr.join(", ") || undefined,
    buyerRole: buyerRoleArr.join(", ") || undefined,
    fitConfidence: (icp.fit_confidence || icp.fitConfidence || "medium") as string,
    status: (icp.status || "active") as "active" | "inactive",
  };
};

/** First non-empty string among candidates (GET /icp may use firmographics vs root). */
const coalesceString = (...vals: unknown[]): string | undefined => {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
};

/** Keys that belong to the "full report" block when returned on the same object as card fields (GET /icp). */
const REPORT_FIELD_KEYS = [
  "title",
  "is_new",
  "is_agentic",
  "why_suggested",
  "how_it_differs",
  "firmographics",
  "key_decision_makers",
  "pain_points_and_triggers",
  "competitors",
] as const;

const buildFullReportFromRoot = (item: any): Record<string, unknown> | undefined => {
  if (item == null || typeof item !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const k of REPORT_FIELD_KEYS) {
    if (item[k] !== undefined && item[k] !== null) out[k] = item[k];
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

/** Nested report object from GET /icp (aliases + optional `data` wrapper), or report fields at root. */
const extractFullReportFromApiItem = (item: any): Record<string, unknown> | undefined => {
  const raw =
    item?.report ??
    item?.fullReport ??
    item?.full_report ??
    item?.icp_report ??
    item?.profiler_report ??
    item?.profilerReport;
  if (raw != null && typeof raw === "object") {
    const inner =
      "data" in raw && raw.data != null && typeof raw.data === "object" ? (raw as { data: unknown }).data : raw;
    if (inner != null && typeof inner === "object") {
      const rec = inner as Record<string, unknown>;
      if (Object.keys(rec).length > 0) return rec;
    }
  }
  return buildFullReportFromRoot(item);
};

/**
 * Normalizes GET /icp JSON to an array of ICP items. Backend may return:
 * - an array; suggestedICPs / icps / results / items; { data: [...] }; { data: { single ICP } }; or a single root object.
 */
const normalizeIcpGetResponse = (icpData: any): any[] => {
  if (icpData == null) return [];
  if (Array.isArray(icpData)) return icpData;

  const unwrapped =
    icpData.data !== undefined
      ? icpData.data
      : icpData.payload !== undefined
        ? icpData.payload
        : icpData.result !== undefined
          ? icpData.result
          : undefined;

  if (unwrapped !== undefined) {
    if (Array.isArray(unwrapped)) return unwrapped;
    if (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)) {
      const u = unwrapped as Record<string, unknown>;
      const nestedList = u.icps ?? u.suggestedICPs ?? u.results ?? u.items;
      if (Array.isArray(nestedList) && nestedList.length > 0) return nestedList as any[];
      const looksLikeIcp =
        u.id != null ||
        u.title != null ||
        u.firmographics != null ||
        typeof u.industry === "string" ||
        typeof u.segment === "string";
      if (looksLikeIcp) return [unwrapped];
    }
  }

  const candidates = [
    icpData.suggestedICPs,
    icpData.icps,
    icpData.results,
    icpData.items,
    icpData.recommendations,
    icpData.profiles,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }

  if (typeof icpData === "object") {
    const u = icpData as Record<string, unknown>;
    const looksLikeIcp =
      u.id != null ||
      u.title != null ||
      u.firmographics != null ||
      typeof u.industry === "string" ||
      typeof u.segment === "string";
    if (looksLikeIcp) return [icpData];
  }

  return [];
};

const hasBackendFullReport = (icp: SuggestedICP) =>
  Boolean(icp.fullReport && typeof icp.fullReport === "object" && Object.keys(icp.fullReport).length > 0);

// Map /icp API response item to SuggestedICP format
// API returns: id, industry, segment, companySize, decisionMakers, regions, keyAttributes,
// growthIndicator, whySuggested, confidenceScore, marketSize, growth, topPainPoint, buyingTriggers, competitors,
// and optionally nested report payload (fullReport) for View Full Report
const mapApiICPToSuggested = (item: any, index: number, type: "refined" | "new" = "new"): SuggestedICP => {
  const fullReport = extractFullReportFromApiItem(item);
  const firmo =
    item.firmographics && typeof item.firmographics === "object"
      ? (item.firmographics as Record<string, unknown>)
      : {};

  const industry =
    coalesceString(item.industry, item.Industry, firmo.industry, firmo.Industry) ?? "Unknown Industry";
  const segment =
    coalesceString(item.segment, item.Segment, item.market_segment, firmo.segment, firmo.Segment) ?? "Unknown Segment";
  const companySize =
    coalesceString(item.companySize, item.company_size, item.size, firmo.company_size, firmo.companySize) ??
    "Unknown Size";
  const marketSize = coalesceString(
    item.marketSize,
    item.market_size,
    firmo.market_size,
    firmo.marketSize,
  );

  const name =
    coalesceString(item.title, item.name, item.segment, item.Segment, firmo.segment as string) ||
    `Recommended ICP ${index + 1}`;

  const decisionMakersRaw = Array.isArray(item.decisionMakers)
    ? item.decisionMakers
    : Array.isArray(item.decision_makers)
      ? item.decision_makers
      : Array.isArray(item.key_decision_makers)
        ? item.key_decision_makers
        : typeof item.decisionMakers === "string"
          ? item.decisionMakers.split(",").map((s: string) => s.trim())
          : [];
  const decisionMakers =
    decisionMakersRaw.length > 0 ? decisionMakersRaw : ["CTO", "Head of Engineering"];

  let regions: string[] = [];
  if (Array.isArray(item.regions)) regions = item.regions.map(String);
  else if (Array.isArray(item.target_markets)) regions = item.target_markets.map(String);
  else if (typeof item.regions === "string")
    regions = item.regions.split(",").map((s: string) => s.trim()).filter(Boolean);
  if (
    regions.length === 0 &&
    !("regions" in item) &&
    !("target_markets" in item)
  ) {
    regions = ["Unknown Region"];
  }

  const whyFromApi = Array.isArray(item.whySuggested)
    ? item.whySuggested
    : Array.isArray(item.why_suggested)
      ? item.why_suggested
      : [];

  const whyFallback =
    fullReport != null
      ? []
      : whyFromApi.length > 0
        ? whyFromApi
        : item.opportunityUnlocked
          ? [item.opportunityUnlocked]
          : ["AI-recommended based on your profile"];

  return {
    id: String(item.id ?? item._id ?? `icp-${Date.now()}-${index}`),
    name,
    type: (item.type === "refined" || item.type === "new" ? item.type : type) as "refined" | "new",
    sourceICPId: item.sourceICPId || item.source_icp_id,
    sourceICPName: item.sourceICPName || item.source_icp_name,
    industry,
    segment,
    companySize,
    decisionMakers,
    regions,
    keyAttributes: Array.isArray(item.keyAttributes)
      ? item.keyAttributes
      : Array.isArray(item.key_attributes)
        ? item.key_attributes
        : typeof item.keyAttributes === "string"
          ? item.keyAttributes.split(",").map((s: string) => s.trim())
          : ["Scalability", "Performance"],
    growthIndicator: item.growthIndicator || item.growth_indicator,
    whySuggested: whyFallback,
    whatChanged: Array.isArray(item.whatChanged) ? item.whatChanged : Array.isArray(item.what_changed) ? item.what_changed : undefined,
    opportunityUnlocked: item.opportunityUnlocked || item.opportunity_unlocked,
    confidenceScore: (item.confidenceScore || item.confidence_score || "Medium") as "High" | "Medium" | "Low",
    marketSize,
    growth: item.growth,
    topPainPoint: item.topPainPoint || item.top_pain_point,
    buyingTriggers: item.buyingTriggers || item.buying_triggers,
    competitors: item.competitors,
    fullReport,
  };
};

export const SuggestedICPCards = ({
  onICPAccepted,
  onICPRejected,
  refreshTrigger = 0,
}: SuggestedICPCardsProps) => {
  const { toast } = useToast();
  const { currentUser, orgId } = useAuth();
  const navigate = useNavigate();

  const [existingICPs, setExistingICPs] = useState<ExistingICP[]>(() => {
    try {
      const saved = localStorage.getItem("profiler_existingICPs");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [acceptedICPs, setAcceptedICPs] = useState<SuggestedICP[]>(() => {
    try {
      const saved = localStorage.getItem("profiler_acceptedICPs");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [refinedICPs, setRefinedICPs] = useState<SuggestedICP[]>([]);
  const [newICPs, setNewICPs] = useState<SuggestedICP[]>([]);
  const [cardStatuses, setCardStatuses] = useState<Record<string, ICPCardStatus>>(() => {
    try {
      const saved = localStorage.getItem("profiler_cardStatuses");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [loading, setLoading] = useState(true);

  const [selectedExistingICP, setSelectedExistingICP] = useState<ExistingICP | null>(null);
  const [expandedCurrentICPId, setExpandedCurrentICPId] = useState<string | null>(null);
  const [confirmAcceptICP, setConfirmAcceptICP] = useState<SuggestedICP | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(() => {
    try {
      return localStorage.getItem("profiler_showRecommendations") === "true";
    } catch {}
    return false;
  });
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Persist state changes
  useEffect(() => {
    localStorage.setItem("profiler_cardStatuses", JSON.stringify(cardStatuses));
  }, [cardStatuses]);

  useEffect(() => {
    localStorage.setItem("profiler_existingICPs", JSON.stringify(existingICPs));
  }, [existingICPs]);

  useEffect(() => {
    localStorage.setItem("profiler_acceptedICPs", JSON.stringify(acceptedICPs));
  }, [acceptedICPs]);

  useEffect(() => {
    localStorage.setItem("profiler_showRecommendations", String(showRecommendations));
  }, [showRecommendations]);

  // Load data: Current ICPs from localStorage, Recommended ICPs from GET /icp (with refresh=true when Refresh clicked)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // 1. Load Current ICPs - same GET /api/customer_profile as Mission Control, then localStorage fallbacks
      let icps: ExistingICP[] = [];
      const orgIdToUse = orgId || currentUser?.uid || "brewra";
      try {
        const profileUrl = buildApiUrl(`customer_profile?org_id=${orgIdToUse}`);
        const profileRes = await fetch(profileUrl, { method: "GET", headers: { "Content-Type": "application/json" } });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const data = profileData.data || profileData;
          const icpsData =
            data.icps ??
            data.customer_profiles?.icps ??
            data.customer_profile?.icps ??
            [];
          if (Array.isArray(icpsData) && icpsData.length > 0) {
            icps = icpsData.map((icp: any, i: number) => mapCustomerProfileICPToExisting(icp, i));
          }
        }
      } catch {}
      if (icps.length === 0) {
        try {
          const customerProfileData = getUserLocalStorage("customerProfile", currentUser?.uid);
          if (customerProfileData) {
            const parsed = JSON.parse(customerProfileData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              icps = parsed.map((icp: any, i: number) => mapCustomerProfileICPToExisting(icp, i));
            }
          }
        } catch {}
      }
      if (icps.length === 0) {
        try {
          const persistedExisting = localStorage.getItem("profiler_existingICPs");
          if (persistedExisting) {
            const parsed = JSON.parse(persistedExisting);
            if (parsed.length > 0) icps = parsed;
          }
        } catch {}
      }
      if (icps.length === 0) {
        try {
          const stored = localStorage.getItem("customerICPs") || localStorage.getItem("missionControlICPs");
          if (stored) icps = JSON.parse(stored);
        } catch {}
      }
      if (icps.length === 0) {
        icps = [
          { id: "existing-1", name: "ICP 1", geography: "North America", industry: "Software & Technology", companySize: "100-500 employees", buyerRole: "CTO / VP Engineering", fitConfidence: "High", status: "active" },
          { id: "existing-2", name: "ICP 2", geography: "US, UK", industry: "Healthcare", companySize: "200-1000 employees", buyerRole: "CIO / Chief Digital Officer", fitConfidence: "Medium", status: "active" },
        ];
      }
      setExistingICPs(icps);

      // 2. Load Recommended ICPs - GET /icp when Refresh clicked, or from localStorage when returning to page
      let refined: SuggestedICP[] = [];
      let newSuggestions: SuggestedICP[] = [];
      // Persist last handled refreshTrigger in sessionStorage so remounts (tabs, Strict Mode, parent re-renders)
      // don't re-run GET /icp while refreshTrigger stays the same — useRef alone resets on unmount.
      const refreshStorageKey = currentUser?.uid
        ? `profiler_icp_refresh_${currentUser.uid}`
        : null;
      const prevRefreshStored = refreshStorageKey
        ? Number(sessionStorage.getItem(refreshStorageKey) || "0")
        : 0;
      const refreshJustIncremented =
        Boolean(refreshStorageKey) &&
        refreshTrigger > 0 &&
        refreshTrigger > prevRefreshStored;

      profilerIcpDebug("loadData: refresh state", {
        refreshTrigger,
        prevRefreshStored,
        refreshJustIncremented,
        sessionKey: refreshStorageKey,
        willCallBackend: refreshJustIncremented && Boolean(currentUser?.uid),
      });

      if (refreshJustIncremented && currentUser?.uid) {
        sessionStorage.setItem(refreshStorageKey!, String(refreshTrigger));
        try {
          const icpParams = new URLSearchParams({
            user_id: currentUser.uid,
            refresh: "true",
          });
          const icpUrl = buildIcpUrl(icpParams.toString());
          profilerIcpDebug("GET /icp (backend) — request", { url: icpUrl, user_id: currentUser.uid });
          const icpRes = await fetch(icpUrl, { method: "GET", headers: { "Content-Type": "application/json" } });
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
              const mapped = icpArray.map((item: any, i: number) => mapApiICPToSuggested(item, i, "new"));
              newSuggestions = mapped;
              refined = [];
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
              // Persist so recommended ICPs survive navigation
              try {
                localStorage.setItem("profiler_recommendedICPs", JSON.stringify(mapped));
              } catch {}
              toast({ title: "ICPs refreshed", description: `${mapped.length} recommended ICPs generated.` });
            } else {
              profilerIcpDebug("GET /icp — empty normalized array; UI will fall back to cache or mock");
            }
          } else {
            console.warn("ICP API returned", icpRes.status, icpRes.statusText);
            profilerIcpDebug("GET /icp — non-OK response", { status: icpRes.status, statusText: icpRes.statusText });
            toast({ title: "Refresh failed", description: `API returned ${icpRes.status}. Using cached data.`, variant: "destructive" });
          }
        } catch (e) {
          console.warn("Could not fetch recommended ICPs from API:", e);
          profilerIcpDebug("GET /icp — fetch error", e);
          toast({ title: "Refresh failed", description: "Using cached data. Please try again.", variant: "destructive" });
        }
      } else if (refreshTrigger > 0 && !refreshJustIncremented) {
        profilerIcpDebug(
          "Skipping GET /icp (already handled this refreshTrigger or missing uid); using cache/mock path",
          { refreshTrigger, prevRefreshStored },
        );
      }

      // Load from localStorage when not refreshing (e.g. returning to Profiler page)
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
                { count: parsed.length, ids: parsed.map((x: SuggestedICP) => x.id) },
              );
            }
          }
        } catch {}
      }

      // Use mock data only when no API data and no cached data
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
            whySuggested: ["RevOps roles show 3x higher engagement with your content", "Faster sales cycles when RevOps is involved early", "Higher average deal size in this segment"],
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
            keyAttributes: ["Digital transformation focus", "API-first strategy", "Regulatory compliance needs"],
            whySuggested: ["High overlap with your current product capabilities", "Growing market with 24% YoY expansion", "Lower competition in this segment"],
            opportunityUnlocked: "Access to $2.4B addressable market with strong product-market fit signals",
            confidenceScore: "Medium",
            marketSize: "$28B",
            growth: "+24% YoY",
            topPainPoint: "Legacy system modernization",
            buyingTriggers: ["Regulatory changes", "Digital transformation initiative", "Competitor pressure"],
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
            whySuggested: ["Similar buying patterns to your best customers", "Strong intent signals detected in this segment", "Complementary to existing ICP focus"],
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

      setRefinedICPs(refined);
      setNewICPs(newSuggestions);

      const persistedStatuses = localStorage.getItem("profiler_cardStatuses");
      if (!persistedStatuses || Object.keys(JSON.parse(persistedStatuses || "{}")).length === 0) {
        const initialStatuses: Record<string, ICPCardStatus> = {};
        [...refined, ...newSuggestions].forEach((icp) => {
          initialStatuses[icp.id] = { status: "suggested" };
        });
        setCardStatuses(initialStatuses);
      }
      setLoading(false);
    };
    loadData();
  }, [refreshTrigger, currentUser?.uid, orgId]);

  // --- Accept flow ---
  const handleAcceptClick = (icp: SuggestedICP) => {
    setConfirmAcceptICP(icp);
  };

  const handleConfirmAccept = () => {
    if (!confirmAcceptICP) return;
    const icp = confirmAcceptICP;
    setCardStatuses((prev) => ({
      ...prev,
      [icp.id]: { status: "accepted", acceptedAt: new Date() },
    }));

    // Save full suggestion data to Current ICPs table
    setAcceptedICPs((prev) => [...prev, icp]);

    onICPAccepted?.(icp);
    toast({
      title: "Customer Profile updated.",
      description: `"${icp.name}" has been saved to your Customer Profile and Current ICPs.`,
    });
    setConfirmAcceptICP(null);
  };

  const handleRejectICP = (icp: SuggestedICP) => {
    setCardStatuses((prev) => ({
      ...prev,
      [icp.id]: { status: "rejected", rejectedAt: new Date() },
    }));
    onICPRejected?.(icp);
    toast({
      title: "ICP Dismissed",
      description: `"${icp.name}" has been rejected.`,
      variant: "destructive",
    });
  };

  const handleUndoAction = (icpId: string) => {
    setCardStatuses((prev) => ({
      ...prev,
      [icpId]: { status: "suggested" },
    }));
    // Remove from Current ICPs table
    setAcceptedICPs((prev) => prev.filter((icp) => icp.id !== icpId));
    if (expandedReportId === icpId) setExpandedReportId(null);
    toast({ title: "Action undone", description: "ICP returned to suggestions and removed from Current ICPs." });
  };

  const handleViewProspects = (icpName: string) => {
    window.dispatchEvent(
      new CustomEvent("navigateToLeadStream", { detail: { filterICP: icpName } })
    );
  };

  // --- Render ---
  const allSuggestions = [...refinedICPs, ...newICPs];
  const pendingCount = allSuggestions.filter((s) => cardStatuses[s.id]?.status === "suggested").length;

  return (
    <div className="space-y-8 relative">
      {/* Loading Modal - same as Scout (Brewra logo) */}
      <Dialog open={loading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md border-0 bg-transparent shadow-none p-0">
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
              <p className="text-sm text-muted-foreground font-medium">Please wait while we fetch your recommended ICPs...</p>
            </div>
            {/* Animated Progress Dots */}
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1.4s" }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1.4s" }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1.4s" }} />
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
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${confidenceColor(icp.fitConfidence || "Medium")}`}>
                          {icp.fitConfidence || "Medium"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleViewProspects(icp.name)} className="text-primary hover:text-primary/80">
                          <Zap className="h-3.5 w-3.5 mr-1" />
                          View Leads
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setExpandedCurrentICPId(isExpanded ? null : icp.id)} className="text-primary hover:text-primary/80">
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          {isExpanded ? "Close" : "View Report"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setExistingICPs((prev) => prev.filter((e) => e.id !== icp.id));
                            if (isExpanded) setExpandedCurrentICPId(null);
                            toast({ title: "ICP deleted", description: `"${icp.name}" removed from Current ICPs.` });
                          }}
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
                                <h4 className="text-sm font-semibold">Profiler's Analysis — {icp.name}</h4>
                              </div>
                              <div className="flex items-center gap-1">
                                <EditDropdownMenu onModify={() => toast({ title: "Edit mode", description: "You can now modify this report." })} />
                                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1 h-7 text-xs" onClick={() => toast({ title: "Chat with Profiler", description: "Profiler agent chat opening..." })}>
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Agentic
                                </Button>
                              </div>
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4">
                              <p className="text-xs font-medium text-foreground mb-1">Profiler's Interpretation</p>
                              <p className="text-xs text-muted-foreground">{analysis.interpretation}</p>
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
                                <span className="text-muted-foreground">{analysis.broadNarrow}</span>
                              </div>
                              <Badge variant="outline" className={`text-xs ${confidenceColor(analysis.confidence)}`}>
                                Confidence: {analysis.confidence}
                              </Badge>
                            </div>

                            <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/20 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-primary" />
                                <div>
                                  <p className="text-xs font-semibold text-foreground">View prospects</p>
                                  <p className="text-[11px] text-muted-foreground">See leads for "{icp.name}"</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleViewProspects(icp.name)}>
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
              {/* Accepted recommended ICPs appear in the same table under Current ICPs */}
              {acceptedICPs.map((icp) => (
                <>
                  <TableRow key={icp.id} className="bg-emerald-50/20">
                    <TableCell className="font-medium">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0 mb-1 block w-fit ${
                          icp.type === "refined"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {icp.type === "refined" ? "Refined" : "New"}
                      </Badge>
                      {icp.name}
                    </TableCell>
                    <TableCell>{icp.industry || "—"}</TableCell>
                    <TableCell>{icp.regions?.join(", ") || "—"}</TableCell>
                    <TableCell>{icp.companySize || "—"}</TableCell>
                    <TableCell>{icp.decisionMakers?.join(", ") || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${confidenceColor(icp.confidenceScore || "Medium")}`}>
                        {icp.confidenceScore || "Medium"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleViewProspects(icp.name)} className="text-primary hover:text-primary/80">
                        <Zap className="h-3.5 w-3.5 mr-1" />
                        View Leads
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedReportId(expandedReportId === icp.id ? null : icp.id)}
                        className="text-primary hover:text-primary/80"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        {expandedReportId === icp.id ? "Close" : "View Report"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUndoAction(icp.id)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Undo — return to recommendations"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAcceptedICPs((prev) => prev.filter((a) => a.id !== icp.id));
                          setCardStatuses((prev) => {
                            const next = { ...prev };
                            delete next[icp.id];
                            return next;
                          });
                          toast({ title: "ICP deleted", description: `"${icp.name}" permanently removed.` });
                        }}
                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedReportId === icp.id && (
                    <TableRow key={`${icp.id}-report`}>
                      <TableCell colSpan={9} className="p-0">
                        <div className="transition-all duration-500 ease-in-out border-t px-6 py-5 space-y-5 bg-background">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <h4 className="text-sm font-semibold">Full Report — {icp.name}</h4>
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${icp.type === "refined" ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"}`}
                              >
                                {icp.type === "refined" ? "Refined" : "New"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <EditDropdownMenu onModify={() => toast({ title: "Edit mode", description: "You can now modify this report." })} />
                              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1 h-7 text-xs" onClick={() => toast({ title: "Chat with Profiler", description: "Profiler agent chat opening..." })}>
                                <MessageSquare className="h-3.5 w-3.5" />
                                Agentic
                              </Button>
                            </div>
                          </div>

                          <SuggestedICPFullReportBody icp={icp} />

                          <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-primary" />
                              <div>
                                <p className="text-xs font-semibold text-foreground">View prospects</p>
                                <p className="text-[11px] text-muted-foreground">See leads for "{icp.name}"</p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleViewProspects(icp.name)}>
                              Lead Stream <ArrowRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ═══ Section 3: Recommended ICPs — Cards row + Full Report below at 80% width ═══ */}
      <div className="space-y-4 animate-fade-in">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recommended ICPs
        </h3>
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {allSuggestions.filter((s) => cardStatuses[s.id]?.status !== "accepted").map((icp) => (
              <RecommendedICPCard
                key={icp.id}
                icp={icp}
                leadCount={getLeadCountForICP(icp.name)}
                status={cardStatuses[icp.id] || { status: "suggested" }}
                isExpanded={expandedReportId === icp.id}
                onAccept={() => handleAcceptClick(icp)}
                onReject={() => handleRejectICP(icp)}
                onUndo={() => handleUndoAction(icp.id)}
                onToggleReport={() => setExpandedReportId(expandedReportId === icp.id ? null : icp.id)}
                onViewProspects={() => handleViewProspects(icp.name)}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Full Report — appears below the cards, 80% width, no drawer */}
        {expandedReportId && (() => {
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
                  <Button variant="outline" size="sm" onClick={() => setExpandedReportId(null)} className="gap-1">
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
                  onUndo={() => handleUndoAction(icp.id)}
                  onViewProspects={() => handleViewProspects(icp.name)}
                />
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* ═══ Accept Confirmation Dialog ═══ */}
      <AlertDialog open={!!confirmAcceptICP} onOpenChange={(open) => !open && setConfirmAcceptICP(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save to Customer Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want me to save "{confirmAcceptICP?.name}" to your Customer Profile? This will make it available for Lead Stream scoring and agent routing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAccept}>Okay</AlertDialogAction>
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
          {(typeof firmographics.company_size === "string" || typeof firmographics.companySize === "string") && (
            <div>
              <p className="text-muted-foreground">Company Size</p>
              <p className="font-medium">{(firmographics.company_size || firmographics.companySize) as string}</p>
            </div>
          )}
          {(typeof firmographics.market_size === "string" || typeof firmographics.marketSize === "string") && (
            <div>
              <p className="text-muted-foreground">Market Size</p>
              <p className="font-medium">{(firmographics.market_size || firmographics.marketSize) as string}</p>
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
            <p className="text-xs font-medium bg-destructive/10 text-destructive p-2 rounded-md mb-2">{pain.critical}</p>
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
            <p className="text-[11px] font-medium text-primary">Opportunity: {icp.opportunityUnlocked}</p>
          </div>
        )}
      </div>

      <div className={`rounded-lg p-3 border ${icp.type === "refined" ? "border-amber-100 bg-amber-50/20" : "border-primary/10 bg-primary/[0.02]"}`}>
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
            <p className="text-xs font-medium bg-destructive/10 text-destructive p-2 rounded-md mb-2">{icp.topPainPoint}</p>
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
          <EditDropdownMenu onModify={() => toast({ title: "Edit mode", description: "You can now modify this report." })} />
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1 h-7 text-xs" onClick={() => toast({ title: "Chat with Profiler", description: "Profiler agent chat opening..." })}>
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
          <Button size="sm" variant="ghost" onClick={onUndo} className="w-full text-xs text-muted-foreground">
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
  onViewProspects,
}: RecommendedICPCardProps) => {
  const { toast } = useToast();
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
                  <><RefreshCw className="h-3 w-3 mr-1" />Refined ICP</>
                ) : (
                  <><Plus className="h-3 w-3 mr-1" />New ICP</>
                )}
              </Badge>
              <CardTitle className="text-base font-semibold truncate">{icp.name}</CardTitle>
              {icp.type === "refined" && icp.sourceICPName && (
                <p className="text-xs text-muted-foreground mt-1">Refined from: {icp.sourceICPName}</p>
              )}
              {icp.tag && icp.type === "new" && (
                <Badge variant="outline" className="mt-1 text-xs">{icp.tag}</Badge>
              )}
            </div>
            <Badge variant="outline" className={`text-xs shrink-0 ${confidenceColor(icp.confidenceScore)}`}>
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
                <p className="font-medium">{icp.marketSize} {icp.growth && `(${icp.growth})`}</p>
              </div>
            )}
            <div className="col-span-2 flex items-center gap-1.5 text-primary">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span className="text-muted-foreground">Lead Stream:</span>
              <span className="font-semibold">{leadCount} lead{leadCount !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {hasBackendFullReport(icp) && (
            <p className="text-xs text-muted-foreground border border-dashed border-primary/25 rounded-md px-2 py-2 bg-muted/30">
              Detailed report from Profiler opens when you click <span className="font-medium text-foreground">View Full Report</span>.
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
            <Button size="sm" variant="ghost" onClick={onUndo} className="w-full text-xs text-muted-foreground">
              <Undo2 className="h-3 w-3 mr-1" />
              Undo
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default SuggestedICPCards;
