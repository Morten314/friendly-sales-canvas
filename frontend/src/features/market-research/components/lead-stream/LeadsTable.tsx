// Lead-stream table — part of the market-research lead-stream cluster.
// Relocated into features/market-research (TD-FE-63).

import {
  Bot,
  ArrowRight,
  ArrowUpDown,
  Info,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  AlertTriangle,
  Zap,
  ChevronUp,
  Loader2,
} from "lucide-react";
import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  readLeadStreamHeatmapFromSession,
  writeLeadStreamHeatmapToSession,
} from "../../lib/leadStreamHeatmapSession";
import {
  getDescriptionTextForColumn,
  type MarketScoreDescriptionsResponse,
} from "../../lib/marketScoreDescriptions";
import {
  extractMarketScoreRowsFromResponse,
  heatmapLeadFromUnknownRow,
} from "../../lib/marketScoresHeatmap";
import { fetchAllOrgLeads } from "../../services/orgLeads";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import {
  LEAD_SOURCE_OPTIONS,
  LeadSourceBadge,
  filterLeadsBySource,
  type LeadSourceFilter,
  UnverifiedBadge,
} from "@/features/connectors";
import { useSignalLeadMap } from "@/features/signals";
import { buildApiUrl } from "@/shared/api/transport";
import { useAuthToken } from "@/shared/auth";
import jwtManager from "@/shared/auth/jwt";
import {
  type Rating,
  type HeatmapLead,
  REPORT_COLUMNS,
  RATING_SCORE,
  TIER_INTELLIGENCE,
  heatmapLeads,
} from "@/shared/lib/leadData";
import { useTenant } from "@/shared/tenant";

// ─── Score Breakdown Popover ────────────────────────────────────────────────

const ScoreBreakdown = ({ lead }: { lead: HeatmapLead }) => {
  const [open, setOpen] = useState(false);

  const breakdown = REPORT_COLUMNS.map((col) => {
    const rating = lead.ratings[col.key];
    const score = RATING_SCORE[rating];
    return { label: col.shortLabel, rating, score };
  });

  const ratingColor: Record<Rating, string> = {
    High: "text-emerald-700 dark:text-emerald-400",
    Medium: "text-amber-700 dark:text-amber-400",
    Low: "text-red-700 dark:text-red-400",
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      <span className="text-sm font-bold text-foreground">{lead.totalScore}</span>
      <button
        onClick={() => setOpen(!open)}
        className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-30 w-[220px] bg-popover border border-border rounded-lg shadow-lg p-3 space-y-2">
          <p className="text-[11px] font-semibold text-foreground mb-1.5">Score Breakdown</p>
          {breakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{item.label}</span>
              <div className="flex items-center gap-1.5">
                <span className={`font-semibold ${ratingColor[item.rating]}`}>{item.rating}</span>
                <span className="font-bold text-foreground w-5 text-right">{item.score}</span>
              </div>
            </div>
          ))}
          <div className="border-t border-border pt-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-foreground">{lead.totalScore}</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug pt-1">
            High = {RATING_SCORE.High}pts · Medium = {RATING_SCORE.Medium}pts · Low ={" "}
            {RATING_SCORE.Low}pts
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Rating Cell Component ──────────────────────────────────────────────────

const RatingCell = ({ rating }: { rating: Rating }) => {
  const styles: Record<Rating, string> = {
    High: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    Low: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${styles[rating]}`}
    >
      {rating}
    </span>
  );
};

// ─── Priority Badge ─────────────────────────────────────────────────────────

const PriorityBadge = ({ tier }: { tier: string }) => {
  const styles: Record<string, string> = {
    "Tier 1":
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    "Tier 2":
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    "Tier 3":
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  };

  return (
    <Badge variant="outline" className={`text-[11px] font-semibold ${styles[tier] || ""}`}>
      {tier}
    </Badge>
  );
};

// ─── Expanded Intelligence Row ──────────────────────────────────────────────

const ratingIcon: Record<Rating, React.ReactNode> = {
  High: <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />,
  Medium: <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />,
  Low: <Zap className="h-3 w-3 text-red-600 dark:text-red-400" />,
};

const ratingBorderColor: Record<Rating, string> = {
  High: "border-emerald-200 dark:border-emerald-800",
  Medium: "border-amber-200 dark:border-amber-800",
  Low: "border-red-200 dark:border-red-800",
};

type LeadScoreDetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: MarketScoreDescriptionsResponse };

const LeadIntelligencePanel = ({
  lead,
  onChatWithScout: _onChatWithScout,
  detail,
  relevantSignals = [],
}: {
  lead: HeatmapLead;
  onChatWithScout?: (leads: HeatmapLead[], reportFilter?: string) => void;
  detail?: LeadScoreDetailState;
  relevantSignals?: { signal_id: string; headline: string; relevance: string; why: string }[];
}) => {
  const intel = TIER_INTELLIGENCE[lead.priority];

  const isLoadingDetail = !detail || detail.status === "loading";
  const detailError = detail?.status === "error" ? detail.message : null;
  const detailData = detail?.status === "ok" ? detail.data : undefined;
  const hasDescriptions = detail?.status === "ok";

  return (
    <div className="px-4 py-3 bg-muted/30 border-t border-border/50 space-y-3">
      {isLoadingDetail ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          Loading score details…
        </div>
      ) : (
        <>
          {/* Tier summary */}
          {intel && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <PriorityBadge tier={lead.priority} />
              <span>
                {intel.label} · Fit Score {intel.fitScore}%
              </span>
            </div>
          )}

          {detailError && <p className="text-[11px] text-destructive">{detailError}</p>}

          {/* Per-component explanations — narrative text only from GET …/market-score-descriptions (no mock fallback). */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {REPORT_COLUMNS.map((col) => {
              const rating = lead.ratings[col.key];
              const fromApi = hasDescriptions
                ? getDescriptionTextForColumn(detailData, col.key)
                : undefined;
              return (
                <div
                  key={col.key}
                  className={`rounded-md border ${ratingBorderColor[rating]} bg-background p-2.5 space-y-1`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">
                      {col.shortLabel}
                    </span>
                    <div className="flex items-center gap-1">
                      {ratingIcon[rating]}
                      <RatingCell rating={rating} />
                    </div>
                  </div>
                  {detail?.status === "error" ? (
                    <p className="text-[11px] leading-relaxed text-muted-foreground/80">—</p>
                  ) : (
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {(fromApi && fromApi.trim()) || "—"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {relevantSignals.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-[11px] font-semibold text-foreground mb-1">
            {relevantSignals.length} relevant {relevantSignals.length === 1 ? "signal" : "signals"}
          </p>
          <ul className="space-y-1">
            {relevantSignals.map((s) => (
              <li key={s.signal_id} className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{s.headline}</span>
                {s.why ? ` — ${s.why}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* View Segment Button — hidden per product request
      <div className="pt-1">
        <button
          onClick={() => setShowSegment(!showSegment)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          {showSegment ? "Hide Segment" : "View Segment"}
          {showSegment ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {showSegment && segment && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-primary" />
            <h4 className="text-[11px] font-semibold text-foreground">Segment Deep-Dive</h4>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <span className="text-muted-foreground"><Building2 className="h-3 w-3 inline mr-0.5" /><strong className="text-foreground">{segment.industry}</strong></span>
            <span className="text-muted-foreground"><MapPin className="h-3 w-3 inline mr-0.5" /><strong className="text-foreground">{segment.region}</strong></span>
            <span className="text-muted-foreground"><Users className="h-3 w-3 inline mr-0.5" /><strong className="text-foreground">{segment.employeeSize}</strong></span>
            <span className="text-muted-foreground flex items-center gap-1 flex-wrap">
              {segment.geographies.map((geo) => (
                <Badge key={geo} variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium bg-background">{geo}</Badge>
              ))}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {segment.trends.map((trend) => (
              <div key={trend.title} className="rounded border border-border bg-background px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-2.5 w-2.5 text-primary shrink-0" />
                  <span className="text-[10px] font-semibold text-foreground">{trend.title}</span>
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground mt-0.5">{trend.insight}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-primary/10 rounded px-2 py-1.5 border border-primary/20">
            <p className="text-[10px] leading-snug text-foreground">
              <span className="font-semibold">Why expand here?</span> {segment.expansionNote}
            </p>
            <button
              onClick={() => onChatWithScout?.([lead], `Find more accounts in the ${segment.industry} segment across ${segment.region}`)}
              className="shrink-0 ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-full px-2.5 py-1 transition-colors"
            >
              <Search className="h-3 w-3" />
              Scout Similar Accounts
            </button>
          </div>
        </div>
      )}
      */}
    </div>
  );
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface LeadsTableProps {
  opportunityFilter?: string | null;
  onClearOpportunityFilter?: () => void;
  onSendToStrategist?: (lead: HeatmapLead) => void;
  onChatWithScout?: (leads: HeatmapLead[], reportFilter?: string) => void;
  /** Fires when POST/session heatmap rows change; parent charts use null → demo data, array → live counts. */
  onHeatmapRowsForDashboardChange?: (rows: HeatmapLead[] | null) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const LeadsTable: React.FC<LeadsTableProps> = ({
  opportunityFilter,
  onClearOpportunityFilter,
  onSendToStrategist: _onSendToStrategist,
  onChatWithScout,
  onHeatmapRowsForDashboardChange,
}) => {
  const navigate = useNavigate();
  const { currentUser, orgId: authOrgId, fetchOrgId } = useAuthToken();
  const { selectedTenant } = useTenant();
  const leadMapOrgId = selectedTenant?.id ?? authOrgId ?? "";
  const { signalsForLead } = useSignalLeadMap(leadMapOrgId);
  const { toast } = useToast();
  const [apiHeatmapLeads, setApiHeatmapLeads] = useState<HeatmapLead[] | null>(null);
  // Real org leads from /api/v2/leads (the same source the Customers Lead Stream
  // uses). Surfaced so discovered/uploaded leads appear here regardless of whether
  // a market-scoring run has happened; scores overlay on top when available.
  const [realLeads, setRealLeads] = useState<HeatmapLead[] | null>(null);
  const [marketScoresLoading, setMarketScoresLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "priority" | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSourceFilter>("all");
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());
  const [scoreDetailByLeadId, setScoreDetailByLeadId] = useState<
    Record<string, LeadScoreDetailState>
  >({});

  const resolveUserIdOrgId = useCallback(async (): Promise<{
    userId: string;
    orgId: string;
  } | null> => {
    const userId = currentUser?.uid;
    let orgId = selectedTenant?.id ?? authOrgId ?? "";
    if (!orgId && userId) {
      const stored = localStorage.getItem(`org_id_${userId}`);
      if (stored) orgId = stored;
    }
    if (!orgId && userId && fetchOrgId) {
      const resolved = await fetchOrgId(userId);
      orgId = resolved?.orgId ?? "";
    }
    if (!userId || !orgId) return null;
    return { userId, orgId };
  }, [currentUser?.uid, selectedTenant?.id, authOrgId, fetchOrgId]);

  const fetchMarketScores = useCallback(async () => {
    const ctx = await resolveUserIdOrgId();
    if (!ctx) {
      toast({
        title: "Missing account context",
        description:
          "Sign in and select an organization (or ensure org is loaded) to refresh lead scores.",
        variant: "destructive",
      });
      return;
    }
    const { userId, orgId } = ctx;
    setMarketScoresLoading(true);
    try {
      const authHeader = await jwtManager.getAuthHeader();
      // Scout header Refresh on Lead Stream tab only: backend requires refresh: true to (re)generate scores.
      const body = {
        user_id: userId,
        org_id: orgId,
        refresh: true as const,
      };
      const res = await fetch(buildApiUrl("leads/market-scores"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader && { Authorization: authHeader }),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (import.meta.env.DEV) {
        console.info("[Lead Stream] market-scores response:", {
          topKeys: data && typeof data === "object" ? Object.keys(data as object) : [],
          processing_status: (data as { processing_status?: string })?.processing_status,
        });
      }
      const rawRows = extractMarketScoreRowsFromResponse(data);
      const mapped = rawRows
        .map((r) => heatmapLeadFromUnknownRow(r))
        .filter((x): x is HeatmapLead => x != null);
      setApiHeatmapLeads(mapped);
      writeLeadStreamHeatmapToSession(userId, orgId, mapped);
      if (import.meta.env.DEV) {
        console.info("[Lead Stream] mapped heatmap rows:", mapped.length);
      }
      if (
        mapped.length === 0 &&
        (data as { processing_status?: string })?.processing_status === "processing"
      ) {
        toast({
          title: "Scoring started",
          description: "Rows will appear when scoring completes. Try refresh again shortly.",
        });
      }
    } catch (e) {
      toast({
        title: "Could not refresh lead scores",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setMarketScoresLoading(false);
    }
  }, [resolveUserIdOrgId, toast]);

  /** Restore cached POST /leads/market-scores rows (non-empty only — empty cache would hide sample data). */
  useLayoutEffect(() => {
    let cancelled = false;
    void (async () => {
      const ctx = await resolveUserIdOrgId();
      if (cancelled || !ctx) return;
      const cached = readLeadStreamHeatmapFromSession(ctx.userId, ctx.orgId);
      if (cancelled || cached === null || cached.length === 0) return;
      setApiHeatmapLeads(cached);
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveUserIdOrgId]);

  const fetchMarketScoreDescriptions = useCallback(
    async (leadId: string) => {
      setScoreDetailByLeadId((prev) => ({ ...prev, [leadId]: { status: "loading" } }));
      const ctx = await resolveUserIdOrgId();
      if (!ctx) {
        setScoreDetailByLeadId((prev) => ({
          ...prev,
          [leadId]: { status: "error", message: "Missing account context" },
        }));
        return;
      }
      try {
        const authHeader = await jwtManager.getAuthHeader();
        const qs = new URLSearchParams({
          user_id: ctx.userId,
          org_id: ctx.orgId,
        });
        const url = buildApiUrl(
          `leads/${encodeURIComponent(leadId)}/market-score-descriptions?${qs.toString()}`,
        );
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader && { Authorization: authHeader }),
          },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as MarketScoreDescriptionsResponse;
        setScoreDetailByLeadId((prev) => ({
          ...prev,
          [leadId]: { status: "ok", data },
        }));
      } catch (e) {
        setScoreDetailByLeadId((prev) => ({
          ...prev,
          [leadId]: {
            status: "error",
            message: e instanceof Error ? e.message : "Failed to load score details",
          },
        }));
      }
    },
    [resolveUserIdOrgId],
  );

  useEffect(() => {
    const onLeadStreamHeaderRefresh = () => {
      void fetchMarketScores();
    };
    window.addEventListener("scoutLeadStreamHeatmapRefresh", onLeadStreamHeaderRefresh);
    return () =>
      window.removeEventListener("scoutLeadStreamHeatmapRefresh", onLeadStreamHeaderRefresh);
  }, [fetchMarketScores]);

  // Load the org's real leads (GET /api/v2/leads, via the shared data layer) on
  // mount / org change. Best-effort overlay: a failure leaves realLeads null and
  // the table falls back to scores/demo, but logs so it isn't a silent dead-end.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ctx = await resolveUserIdOrgId();
      if (cancelled || !ctx) return;
      try {
        const leads = await fetchAllOrgLeads(ctx.orgId);
        if (!cancelled) setRealLeads(leads);
      } catch (e) {
        console.warn("[Lead Stream] failed to load org leads from /v2/leads", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveUserIdOrgId]);

  useLayoutEffect(() => {
    onHeatmapRowsForDashboardChange?.(apiHeatmapLeads);
  }, [apiHeatmapLeads, onHeatmapRowsForDashboardChange]);

  // Merge real leads with market-scores by lead id (scored rows win), so every
  // real lead shows and scored ones are enriched. Demo data is used ONLY when there
  // is no org context (dev/storybook) and nothing real to show — never for a real org.
  const hasOrgContext = Boolean(selectedTenant?.id ?? authOrgId);
  const baseLeads = useMemo<HeatmapLead[]>(() => {
    const scored = apiHeatmapLeads ?? [];
    const real = realLeads ?? [];
    if (!hasOrgContext && scored.length === 0 && real.length === 0) return heatmapLeads;
    const byId = new Map<string, HeatmapLead>();
    for (const lead of real) byId.set(lead.id, lead);
    for (const lead of scored) byId.set(lead.id, lead);
    return Array.from(byId.values());
  }, [apiHeatmapLeads, realLeads, hasOrgContext]);
  const usingDemoData = baseLeads === heatmapLeads;
  // Unscored leads are excluded from named-tier filters (their "Tier 3" is a
  // placeholder, not a real score); surface a hint so they're not a silent
  // dead-end when a user filters to find them (impl-review-1 F2).
  const hiddenUnscoredCount =
    tierFilter !== "all" ? baseLeads.filter((l) => l.scored === false).length : 0;

  const toggleExpand = (id: string) => {
    const willOpen = !expandedLeads.has(id);
    setExpandedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (willOpen) {
      void fetchMarketScoreDescriptions(id);
    }
  };

  // Filter by tier then source
  const tierFiltered =
    tierFilter === "all"
      ? baseLeads
      : baseLeads.filter((l) => l.scored !== false && l.priority === tierFilter);
  const filteredLeads = filterLeadsBySource(tierFiltered, sourceFilter);

  // Sort
  const sortedLeads = sortBy
    ? [...filteredLeads].sort((a, b) => {
        const diff =
          sortBy === "score" ? a.totalScore - b.totalScore : a.priority.localeCompare(b.priority);
        return sortAsc ? diff : -diff;
      })
    : [...filteredLeads].sort((a, b) => b.totalScore - a.totalScore);

  const toggleSort = (col: "score" | "priority") => {
    if (sortBy === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(col);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {marketScoresLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" aria-hidden />
          )}
          <h3 className="text-sm font-semibold text-foreground">Lead Intelligence Heatmap</h3>
          {!usingDemoData ? (
            <Badge variant="secondary" className="text-[10px] font-medium shrink-0">
              Live API
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] text-muted-foreground font-normal shrink-0"
            >
              Sample data
            </Badge>
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                Each lead is rated High, Medium, or Low across all Scout report sections. Click the
                arrow on any lead to view opportunity intelligence.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {opportunityFilter && opportunityFilter !== "all" && (
            <Badge
              variant="outline"
              className="text-xs bg-primary/5 text-primary border-primary/20 gap-1"
            >
              Filtered view
              <button className="ml-1 hover:text-primary/70" onClick={onClearOpportunityFilter}>
                ×
              </button>
            </Badge>
          )}
        </div>
        <button
          onClick={() => navigate("/your-ai-team/strategist/workspace")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all duration-200 text-[11px] font-semibold text-primary"
        >
          <Zap className="h-3 w-3" />
          Next Actions by Strategist
          <ArrowRight className="h-3 w-3" />
        </button>
        <div className="flex items-center gap-2">
          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as LeadSourceFilter)}
          >
            <SelectTrigger className="h-8 text-xs w-[120px]" aria-label="Filter by lead source">
              <SelectValue placeholder="All leads" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Tiers
              </SelectItem>
              <SelectItem value="Tier 1" className="text-xs">
                Tier 1 (75+)
              </SelectItem>
              <SelectItem value="Tier 2" className="text-xs">
                Tier 2 (50–74)
              </SelectItem>
              <SelectItem value="Tier 3" className="text-xs">
                Tier 3 (&lt;50)
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => onChatWithScout?.(sortedLeads)}
            title="Chat with Scout about all leads"
          >
            <Bot className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/30" />
          Green = strong fit
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30" />
          Amber = moderate fit
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-red-100 dark:bg-red-900/30" />
          Red = weak fit
        </div>
      </div>

      {/* Heatmap Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[170px] text-xs font-semibold sticky left-0 bg-background z-10">
                  Lead
                </TableHead>
                <TableHead className="w-[130px] text-xs font-semibold">Company</TableHead>
                {REPORT_COLUMNS.map((col) => (
                  <TableHead
                    key={col.key}
                    className="text-xs font-semibold text-center min-w-[100px]"
                  >
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">{col.shortLabel}</span>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">{col.label}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                ))}
                <TableHead className="text-xs font-semibold text-center w-[90px]">
                  <button
                    className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors"
                    onClick={() => toggleSort("score")}
                  >
                    Total Score
                    <ArrowUpDown
                      className={`h-3 w-3 ${sortBy === "score" ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-center w-[80px]">
                  <button
                    className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors"
                    onClick={() => toggleSort("priority")}
                  >
                    Priority
                    <ArrowUpDown
                      className={`h-3 w-3 ${sortBy === "priority" ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </button>
                </TableHead>
                <TableHead className="w-[160px] text-xs text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLeads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={REPORT_COLUMNS.length + 5}
                    className="text-center py-10 text-sm text-muted-foreground"
                  >
                    {baseLeads.length === 0
                      ? "No leads yet — run Apollo discovery or upload a CSV to populate your Lead Stream."
                      : hiddenUnscoredCount > 0
                        ? `No leads match this filter — ${hiddenUnscoredCount} unscored lead${
                            hiddenUnscoredCount === 1 ? "" : "s"
                          } ${
                            hiddenUnscoredCount === 1 ? "is" : "are"
                          } hidden. Choose “All Tiers” to see them.`
                        : "No leads match this filter."}
                  </TableCell>
                </TableRow>
              ) : (
                sortedLeads.flatMap((lead) => {
                  const colSpan = REPORT_COLUMNS.length + 5;
                  const main = (
                    <TableRow key={`${lead.id}-main`} className="group">
                      <TableCell className="text-sm font-medium text-foreground sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleExpand(lead.id)}
                            className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            {expandedLeads.has(lead.id) ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                          {lead.name}
                          <LeadSourceBadge source={lead.source} />
                          <UnverifiedBadge emailStatus={lead.email_status} />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.company}
                      </TableCell>
                      {REPORT_COLUMNS.map((col) => (
                        <TableCell key={col.key} className="text-center">
                          {lead.scored === false ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <RatingCell rating={lead.ratings[col.key]} />
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        {lead.scored === false ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <ScoreBreakdown lead={lead} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {lead.scored === false ? (
                          <Badge variant="outline" className="text-[11px] text-muted-foreground">
                            Unscored
                          </Badge>
                        ) : (
                          <PriorityBadge tier={lead.priority} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 text-primary hover:text-primary"
                            onClick={() => onChatWithScout?.([lead])}
                          >
                            Ask Scout <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  if (!expandedLeads.has(lead.id)) return [main];
                  return [
                    main,
                    <TableRow key={`${lead.id}-expanded`} className="hover:bg-transparent">
                      <TableCell colSpan={colSpan} className="p-0">
                        <LeadIntelligencePanel
                          lead={lead}
                          onChatWithScout={onChatWithScout}
                          detail={scoreDetailByLeadId[lead.id]}
                          relevantSignals={signalsForLead(lead.id)}
                        />
                      </TableCell>
                    </TableRow>,
                  ];
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default LeadsTable;
