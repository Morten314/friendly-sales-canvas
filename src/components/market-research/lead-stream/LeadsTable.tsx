import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bot, ArrowRight, ArrowUpDown, Info, ChevronRight, ChevronDown, TrendingUp, AlertTriangle, Zap, Send } from "lucide-react";
import { type Rating, type HeatmapLead, REPORT_COLUMNS, RATING_SCORE, TIER_INTELLIGENCE, COMPONENT_EXPLANATIONS, heatmapLeads } from "./leadData";

// ─── Rating Cell Component ──────────────────────────────────────────────────

const RatingCell = ({ rating }: { rating: Rating }) => {
  const styles: Record<Rating, string> = {
    High: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    Low: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${styles[rating]}`}>
      {rating}
    </span>
  );
};

// ─── Priority Badge ─────────────────────────────────────────────────────────

const PriorityBadge = ({ tier }: { tier: string }) => {
  const styles: Record<string, string> = {
    "Tier 1": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    "Tier 2": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    "Tier 3": "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
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

const LeadIntelligencePanel = ({ lead }: { lead: HeatmapLead }) => {
  const intel = TIER_INTELLIGENCE[lead.priority];

  return (
    <div className="px-4 py-3 bg-muted/30 border-t border-border/50 space-y-3">
      {/* Tier summary */}
      {intel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <PriorityBadge tier={lead.priority} />
          <span>{intel.label} · Fit Score {intel.fitScore}%</span>
        </div>
      )}

      {/* Per-component explanations */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        {REPORT_COLUMNS.map((col) => {
          const rating = lead.ratings[col.key];
          const explanation = COMPONENT_EXPLANATIONS[col.key]?.[rating] || "";
          return (
            <div
              key={col.key}
              className={`rounded-md border ${ratingBorderColor[rating]} bg-background p-2.5 space-y-1`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground">{col.shortLabel}</span>
                <div className="flex items-center gap-1">
                  {ratingIcon[rating]}
                  <RatingCell rating={rating} />
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{explanation}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface LeadsTableProps {
  opportunityFilter?: string | null;
  onClearOpportunityFilter?: () => void;
  onResearchWithScout?: (lead: any) => void;
  onSendToStrategist?: (lead: any) => void;
  onChatWithScout?: (leads: any[], reportFilter?: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const LeadsTable: React.FC<LeadsTableProps> = ({
  opportunityFilter,
  onClearOpportunityFilter,
  onResearchWithScout,
  onSendToStrategist,
  onChatWithScout,
}) => {
  const [sortBy, setSortBy] = useState<"score" | "priority" | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter by tier
  const filteredLeads = tierFilter === "all"
    ? heatmapLeads
    : heatmapLeads.filter((l) => l.priority === tierFilter);

  // Sort
  const sortedLeads = sortBy
    ? [...filteredLeads].sort((a, b) => {
        const diff = sortBy === "score" ? a.totalScore - b.totalScore : a.priority.localeCompare(b.priority);
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
          <h3 className="text-sm font-semibold text-foreground">Lead Intelligence Heatmap</h3>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                Each lead is rated High, Medium, or Low across all Scout report sections. Click the arrow on any lead to view opportunity intelligence.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {opportunityFilter && opportunityFilter !== "all" && (
            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 gap-1">
              Filtered view
              <button className="ml-1 hover:text-primary/70" onClick={onClearOpportunityFilter}>×</button>
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Tiers</SelectItem>
              <SelectItem value="Tier 1" className="text-xs">Tier 1 (75+)</SelectItem>
              <SelectItem value="Tier 2" className="text-xs">Tier 2 (50–74)</SelectItem>
              <SelectItem value="Tier 3" className="text-xs">Tier 3 (&lt;50)</SelectItem>
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
                <TableHead className="w-[170px] text-xs font-semibold sticky left-0 bg-background z-10">Lead</TableHead>
                <TableHead className="w-[130px] text-xs font-semibold">Company</TableHead>
                {REPORT_COLUMNS.map((col) => (
                  <TableHead key={col.key} className="text-xs font-semibold text-center min-w-[100px]">
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
                    <ArrowUpDown className={`h-3 w-3 ${sortBy === "score" ? "text-primary" : "text-muted-foreground"}`} />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-center w-[80px]">
                  <button
                    className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors"
                    onClick={() => toggleSort("priority")}
                  >
                    Priority
                    <ArrowUpDown className={`h-3 w-3 ${sortBy === "priority" ? "text-primary" : "text-muted-foreground"}`} />
                  </button>
                </TableHead>
                <TableHead className="w-[160px] text-xs text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={REPORT_COLUMNS.length + 5} className="text-center py-10 text-sm text-muted-foreground">
                    No leads match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                sortedLeads.map((lead) => (
                  <React.Fragment key={lead.id}>
                    <TableRow className="group">
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
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{lead.company}</TableCell>
                      {REPORT_COLUMNS.map((col) => (
                        <TableCell key={col.key} className="text-center">
                          <RatingCell rating={lead.ratings[col.key]} />
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <span className="text-sm font-bold text-foreground">{lead.totalScore}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <PriorityBadge tier={lead.priority} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 text-primary hover:text-primary"
                            onClick={() => onResearchWithScout?.(lead)}
                          >
                            Ask Scout <ArrowRight className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 text-accent-foreground hover:text-accent-foreground"
                            onClick={() => onSendToStrategist?.(lead)}
                          >
                            <Send className="h-3 w-3" /> Send to Strategist
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedLeads.has(lead.id) && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={REPORT_COLUMNS.length + 5} className="p-0">
                          <LeadIntelligencePanel lead={lead} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default LeadsTable;