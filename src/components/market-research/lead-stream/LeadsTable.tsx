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
import { Bot, ArrowRight, ArrowUpDown, Info } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Rating = "High" | "Medium" | "Low";

interface HeatmapLead {
  id: string;
  name: string;
  company: string;
  source: "HubSpot" | "Prospect List";
  ratings: Record<string, Rating>;
  totalScore: number;
  priority: "Tier 1" | "Tier 2" | "Tier 3";
}

// ─── Report Sections ─────────────────────────────────────────────────────────

const REPORT_COLUMNS = [
  { key: "market-size", label: "Market Size & Opportunity", shortLabel: "Market Size" },
  { key: "industry-trends", label: "Industry Trends", shortLabel: "Industry" },
  { key: "competitor-landscape", label: "Competitor Landscape", shortLabel: "Competitor" },
  { key: "regulatory-compliance", label: "Regulatory & Compliance", shortLabel: "Regulatory" },
  { key: "market-entry", label: "Market Entry & Growth Strategy", shortLabel: "Market Entry" },
];

// ─── Score calculation helpers ───────────────────────────────────────────────

const RATING_SCORE: Record<Rating, number> = { High: 20, Medium: 12, Low: 5 };

function computeScore(ratings: Record<string, Rating>): number {
  return REPORT_COLUMNS.reduce((sum, col) => sum + (RATING_SCORE[ratings[col.key]] || 0), 0);
}

function getPriority(score: number): "Tier 1" | "Tier 2" | "Tier 3" {
  if (score >= 75) return "Tier 1";
  if (score >= 50) return "Tier 2";
  return "Tier 3";
}

// ─── Deterministic rating assignment based on lead data ──────────────────────

function assignRatings(
  id: string,
  matchedReports: string[]
): Record<string, Rating> {
  const hash = parseInt(id, 10);
  const ratings: Record<string, Rating> = {};

  REPORT_COLUMNS.forEach((col) => {
    const isMatched = matchedReports.includes(col.key);
    if (isMatched) {
      // Matched reports: mostly High, some Medium
      ratings[col.key] = hash % 3 === 0 ? "Medium" : "High";
    } else {
      // Unmatched: distribute across Medium and Low
      ratings[col.key] = hash % 2 === 0 ? "Medium" : "Low";
    }
  });

  return ratings;
}

// ─── Raw lead data (matched reports from previous dataset) ───────────────────

const RAW_LEADS = [
  { id: "1", name: "Sarah Chen", company: "Acme Corp", source: "HubSpot" as const, matchedReports: ["market-size", "industry-trends"] },
  { id: "2", name: "James Okoro", company: "ScaleUp Inc", source: "HubSpot" as const, matchedReports: ["market-size", "competitor-landscape"] },
  { id: "3", name: "Priya Sharma", company: "NovaTech Solutions", source: "Prospect List" as const, matchedReports: ["industry-trends", "market-entry"] },
  { id: "4", name: "Marcus Liu", company: "DataDriven AI", source: "HubSpot" as const, matchedReports: ["competitor-landscape", "regulatory-compliance"] },
  { id: "5", name: "Elena Vasquez", company: "CloudFirst Systems", source: "Prospect List" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "6", name: "David Park", company: "Momentum Labs", source: "HubSpot" as const, matchedReports: ["regulatory-compliance"] },
  { id: "7", name: "Amara Johnson", company: "RevStack AI", source: "Prospect List" as const, matchedReports: ["market-size", "industry-trends", "competitor-landscape"] },
  { id: "8", name: "Tobias Müller", company: "FinServ Digital", source: "HubSpot" as const, matchedReports: ["regulatory-compliance"] },
  { id: "9", name: "Lily Tran", company: "ShopScale D2C", source: "Prospect List" as const, matchedReports: ["market-entry"] },
  { id: "10", name: "Raj Patel", company: "OpsFlow SaaS", source: "HubSpot" as const, matchedReports: ["industry-trends", "market-entry"] },
  { id: "11", name: "Nina Kozlov", company: "BrightPath Analytics", source: "HubSpot" as const, matchedReports: ["market-size", "competitor-landscape"] },
  { id: "12", name: "Carlos Mendez", company: "GrowthLoop", source: "Prospect List" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "13", name: "Aisha Okafor", company: "NexGen AI", source: "HubSpot" as const, matchedReports: ["market-size", "industry-trends"] },
  { id: "14", name: "Henrik Larsen", company: "NordicSoft AB", source: "Prospect List" as const, matchedReports: ["market-size", "regulatory-compliance"] },
  { id: "15", name: "Maya Tanaka", company: "CloudBridge Japan", source: "HubSpot" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "16", name: "Zach Williams", company: "Pipeline AI", source: "Prospect List" as const, matchedReports: ["market-size", "competitor-landscape"] },
  { id: "17", name: "Fatima Al-Rashid", company: "VentureX MENA", source: "HubSpot" as const, matchedReports: ["market-size", "industry-trends"] },
  { id: "18", name: "Tom Bradley", company: "SaasPro Inc", source: "Prospect List" as const, matchedReports: ["market-size", "competitor-landscape"] },
  { id: "19", name: "Suki Patel", company: "ScaleForce", source: "HubSpot" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "20", name: "Lena Fischer", company: "DataVault EU", source: "Prospect List" as const, matchedReports: ["market-size", "regulatory-compliance"] },
  { id: "21", name: "Ben Adeyemi", company: "TractionHQ", source: "HubSpot" as const, matchedReports: ["market-size", "competitor-landscape"] },
  { id: "22", name: "Clara Rossi", company: "FinCloud Italia", source: "Prospect List" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "23", name: "Derek Ng", company: "QuantumSales SG", source: "HubSpot" as const, matchedReports: ["market-size", "industry-trends"] },
  { id: "24", name: "Rachel Kim", company: "OrbitSaaS", source: "Prospect List" as const, matchedReports: ["market-size"] },
  { id: "25", name: "Oscar Hernandez", company: "RevGrowth LATAM", source: "HubSpot" as const, matchedReports: ["industry-trends", "competitor-landscape"] },
  { id: "26", name: "Ingrid Johansson", company: "TechScale Nordic", source: "Prospect List" as const, matchedReports: ["industry-trends", "market-entry"] },
  { id: "27", name: "Wei Zhang", company: "AI Venture", source: "HubSpot" as const, matchedReports: ["industry-trends", "competitor-landscape"] },
  { id: "28", name: "Sophie Martin", company: "GrowthEngine FR", source: "Prospect List" as const, matchedReports: ["industry-trends", "market-entry"] },
  { id: "29", name: "Alex Petrov", company: "DataOps Sofia", source: "HubSpot" as const, matchedReports: ["industry-trends", "competitor-landscape"] },
  { id: "30", name: "Lisa Chang", company: "RevOps Taiwan", source: "Prospect List" as const, matchedReports: ["industry-trends"] },
  { id: "31", name: "Patrick O'Brien", company: "SaaSBridge", source: "HubSpot" as const, matchedReports: ["competitor-landscape"] },
  { id: "32", name: "Mia Santos", company: "CloudScale Brasil", source: "Prospect List" as const, matchedReports: ["competitor-landscape"] },
  { id: "33", name: "Yuki Yamamoto", company: "NextSaaS Japan", source: "HubSpot" as const, matchedReports: ["competitor-landscape", "regulatory-compliance"] },
  { id: "34", name: "Ahmed Hassan", company: "ScaleUp Cairo", source: "Prospect List" as const, matchedReports: ["competitor-landscape"] },
  { id: "35", name: "Eva Novak", company: "FintechPro CZ", source: "HubSpot" as const, matchedReports: ["competitor-landscape"] },
  { id: "36", name: "Ryan Murphy", company: "GrowthStack AU", source: "Prospect List" as const, matchedReports: ["competitor-landscape"] },
  { id: "37", name: "Anita Desai", company: "RevSync India", source: "HubSpot" as const, matchedReports: ["competitor-landscape"] },
  { id: "38", name: "Lucas Weber", company: "ComplianceIO", source: "Prospect List" as const, matchedReports: ["competitor-landscape"] },
  { id: "39", name: "Grace Lee", company: "MarketPulse SG", source: "HubSpot" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "40", name: "Daniel Costa", company: "RevHub Portugal", source: "Prospect List" as const, matchedReports: ["market-entry", "industry-trends"] },
  { id: "41", name: "Nadia Volkov", company: "SaaSLaunch", source: "HubSpot" as const, matchedReports: ["market-entry"] },
  { id: "42", name: "Chris Taylor", company: "ScalePath Canada", source: "Prospect List" as const, matchedReports: ["market-entry", "market-size"] },
  { id: "43", name: "Priscilla Osei", company: "GrowthWave Africa", source: "HubSpot" as const, matchedReports: ["market-entry"] },
  { id: "44", name: "Kevin Lim", company: "RevScale MY", source: "Prospect List" as const, matchedReports: ["regulatory-compliance"] },
];

// ─── Build heatmap leads with varied ratings ─────────────────────────────────

// Use a seeded approach for more variety than just id-based hash
function buildHeatmapLeads(): HeatmapLead[] {
  // Predefined rating patterns for more realistic variety
  const ratingOverrides: Record<string, Record<string, Rating>> = {
    "1": { "market-size": "High", "industry-trends": "High", "competitor-landscape": "Medium", "regulatory-compliance": "High", "market-entry": "High" },
    "2": { "market-size": "High", "industry-trends": "High", "competitor-landscape": "High", "regulatory-compliance": "Medium", "market-entry": "Medium" },
    "3": { "market-size": "High", "industry-trends": "High", "competitor-landscape": "Medium", "regulatory-compliance": "Medium", "market-entry": "High" },
    "4": { "market-size": "Low", "industry-trends": "Medium", "competitor-landscape": "High", "regulatory-compliance": "High", "market-entry": "Low" },
    "5": { "market-size": "High", "industry-trends": "Medium", "competitor-landscape": "Low", "regulatory-compliance": "Medium", "market-entry": "High" },
    "6": { "market-size": "Medium", "industry-trends": "Low", "competitor-landscape": "Medium", "regulatory-compliance": "High", "market-entry": "Low" },
    "7": { "market-size": "High", "industry-trends": "High", "competitor-landscape": "High", "regulatory-compliance": "Low", "market-entry": "High" },
    "8": { "market-size": "Low", "industry-trends": "Medium", "competitor-landscape": "Low", "regulatory-compliance": "High", "market-entry": "Low" },
    "9": { "market-size": "Medium", "industry-trends": "Low", "competitor-landscape": "Low", "regulatory-compliance": "Low", "market-entry": "High" },
    "10": { "market-size": "Medium", "industry-trends": "High", "competitor-landscape": "Low", "regulatory-compliance": "Medium", "market-entry": "High" },
  };

  return RAW_LEADS.map((lead) => {
    const ratings = ratingOverrides[lead.id] || assignRatings(lead.id, lead.matchedReports);
    const totalScore = computeScore(ratings);
    return {
      id: lead.id,
      name: lead.name,
      company: lead.company,
      source: lead.source,
      ratings,
      totalScore,
      priority: getPriority(totalScore),
    };
  });
}

const heatmapLeads = buildHeatmapLeads();

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

// ─── Props ───────────────────────────────────────────────────────────────────

interface LeadsTableProps {
  opportunityFilter?: string | null;
  onClearOpportunityFilter?: () => void;
  onResearchWithScout?: (lead: any) => void;
  onChatWithScout?: (leads: any[], reportFilter?: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const LeadsTable: React.FC<LeadsTableProps> = ({
  opportunityFilter,
  onClearOpportunityFilter,
  onResearchWithScout,
  onChatWithScout,
}) => {
  const [sortBy, setSortBy] = useState<"score" | "priority" | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [tierFilter, setTierFilter] = useState<string>("all");

  // Sync external filter (not used for heatmap but kept for compatibility)
  React.useEffect(() => {
    // External opportunity filter can be handled if needed
  }, [opportunityFilter]);

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
    : [...filteredLeads].sort((a, b) => b.totalScore - a.totalScore); // Default: highest score first

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
                Each lead is rated High, Medium, or Low across all Scout report sections. Scores are calculated from these ratings to determine priority tiers.
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
                <TableHead className="w-[150px] text-xs font-semibold sticky left-0 bg-background z-10">Lead</TableHead>
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
                <TableHead className="w-[80px] text-xs text-right">Action</TableHead>
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
                  <TableRow key={lead.id} className="group">
                    <TableCell className="text-sm font-medium text-foreground sticky left-0 bg-background z-10">{lead.name}</TableCell>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-primary hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onResearchWithScout?.(lead)}
                      >
                        Ask Scout <ArrowRight className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
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
