import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Zap, Download, RefreshCw, Save, Eye, ChevronDown, ChevronRight,
  Database, Users, Target, MapPin, Briefcase, ArrowUpRight, Info, Bookmark, Filter
} from "lucide-react";

// --- Types ---
interface Lead {
  id: string;
  name: string;
  company: string;
  title: string;
  source: string;
  intentLevel: "High" | "Medium" | "Low";
  reason: string;
}

interface ContextChip {
  label: string;
  value: string;
  icon: React.ReactNode;
}

// --- Mock Data ---
const mockLeads: Lead[] = [
  { id: "1", name: "Sarah Chen", company: "Acme Corp", title: "VP of Revenue Operations", source: "ICP 1", intentLevel: "High", reason: "Matches ICP + buyer role + region. Active hiring for RevOps roles." },
  { id: "2", name: "James Okoro", company: "ScaleUp Inc", title: "Head of GTM Strategy", source: "ICP 2", intentLevel: "High", reason: "Strong intent: expanding GTM team + evaluating competitors in your space." },
  { id: "3", name: "Priya Sharma", company: "NovaTech Solutions", title: "Director of Sales Enablement", source: "ICP 1", intentLevel: "High", reason: "Lookalike of accepted ICP + high fit. Competitor tool usage detected." },
  { id: "4", name: "Marcus Liu", company: "DataDriven AI", title: "CRO", source: "ICP 2", intentLevel: "Medium", reason: "Right buyer role + region match. Recent funding round signals growth phase." },
  { id: "5", name: "Elena Vasquez", company: "CloudFirst Systems", title: "VP Sales", source: "ICP 1", intentLevel: "High", reason: "Matches ICP + active job postings for sales leadership + competitor tool churn." },
  { id: "6", name: "David Park", company: "Momentum Labs", title: "Head of Partnerships", source: "ICP 2", intentLevel: "Medium", reason: "Strong ICP alignment. Partnership-led growth model fits your offering." },
  { id: "7", name: "Amara Johnson", company: "RevStack AI", title: "VP of RevOps", source: "Mid-Market SaaS – RevOps Teams", intentLevel: "High", reason: "Matches refined ICP targeting RevOps teams. High engagement with your content." },
  { id: "8", name: "Tobias Müller", company: "FinServ Digital", title: "Chief Digital Officer", source: "Enterprise FinTech Decision Makers", intentLevel: "Medium", reason: "Matches new FinTech ICP segment. Digital transformation initiative underway." },
  { id: "9", name: "Lily Tran", company: "ShopScale D2C", title: "Head of Growth", source: "Growth-Stage E-commerce Leaders", intentLevel: "High", reason: "Growth-stage e-commerce leader. Similar buying patterns to best customers." },
  { id: "10", name: "Raj Patel", company: "OpsFlow SaaS", title: "Head of Sales Operations", source: "Mid-Market SaaS – RevOps Teams", intentLevel: "Medium", reason: "RevOps focus + Series B funding. Tech stack consolidation signals." },
  { id: "11", name: "Nina Kowalski", company: "PayTech Global", title: "VP of Innovation", source: "Enterprise FinTech Decision Makers", intentLevel: "High", reason: "FinTech digital transformation lead. Evaluating API-first partnerships." },
  { id: "12", name: "Chris Andersen", company: "BrandBurst D2C", title: "COO", source: "Growth-Stage E-commerce Leaders", intentLevel: "Medium", reason: "Scaling e-commerce operations. Shopify Plus migration in progress." },
];

/** Count of leads in Lead Stream that match the given ICP name (same logic as filter). */
export function getLeadCountForICP(icpName: string): number {
  if (!icpName) return 0;
  const lower = icpName.toLowerCase();
  return mockLeads.filter(
    (lead) =>
      lead.source === icpName ||
      lead.source.toLowerCase().includes(lower) ||
      lower.includes(lead.source.toLowerCase())
  ).length;
}

const mockContextChips: ContextChip[] = [
  { label: "Active ICPs", value: "3", icon: <Target className="h-3 w-3" /> },
  { label: "Regions", value: "North America, EMEA", icon: <MapPin className="h-3 w-3" /> },
  { label: "Industries", value: "SaaS, AI/ML, B2B", icon: <Briefcase className="h-3 w-3" /> },
  { label: "Buyer Roles", value: "VP Sales, CRO, RevOps", icon: <Users className="h-3 w-3" /> },
];

const howItWorks = [
  { icon: <Database className="h-4 w-4" />, text: "Prospect lists scanned from Data Sources" },
  { icon: <Users className="h-4 w-4" />, text: "ICPs pulled from Customer Profile" },
  { icon: <Target className="h-4 w-4" />, text: "Accepted ICP cards used as routing logic" },
  { icon: <Zap className="h-4 w-4" />, text: "Leads scored and ranked by fit + intent" },
];

// --- Intent Badge ---
const IntentBadge = ({ level }: { level: Lead["intentLevel"] }) => {
  const styles = {
    High: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Low: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${styles[level]}`}>
      {level === "High" && <Zap className="h-3 w-3 mr-1" />}
      {level}
    </Badge>
  );
};

// --- Source Badge ---
const SourceBadge = ({ source }: { source: string }) => {
  const isRefined = source === "Refined ICP";
  const isNew = source === "New ICP";
  const colorClass = isRefined
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : isNew
      ? "bg-primary/5 text-primary border-primary/20"
      : "bg-muted/50 text-foreground border-border";
  return (
    <Badge variant="outline" className={`text-xs font-medium ${colorClass}`}>
      {source}
    </Badge>
  );
};

// --- Empty State ---
const EmptyState = () => (
  <Card className="border-dashed border-2 border-muted">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Database className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No prospect data yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Upload a prospect list in Data Sources to generate your Lead Stream.
      </p>
      <Button variant="outline" className="gap-2" onClick={() => window.dispatchEvent(new CustomEvent('navigateToDataSources'))}>
        <ArrowUpRight className="h-4 w-4" />
        Go to Data Sources
      </Button>
    </CardContent>
  </Card>
);

// --- Main Component ---
interface LeadStreamPanelProps {
  filterByICP?: string | null;
  onClearFilter?: () => void;
}

export const LeadStreamPanel = ({ filterByICP, onClearFilter }: LeadStreamPanelProps) => {
  const [howOpen, setHowOpen] = useState(false);
  const [savedLeads, setSavedLeads] = useState<Set<string>>(new Set());
  const [sortSourceAsc, setSortSourceAsc] = useState<boolean | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const hasProspectData = true; // TODO: derive from Data Sources

  const uniqueSources = Array.from(new Set(mockLeads.map((l) => l.source))).sort();

  const filteredLeads = (filterByICP
    ? mockLeads.filter((lead) => lead.source === filterByICP || lead.source.toLowerCase().includes(filterByICP.toLowerCase()) || filterByICP.toLowerCase().includes(lead.source.toLowerCase()))
    : mockLeads
  ).filter((lead) => sourceFilter === "all" || lead.source === sourceFilter);

  const displayedLeads = sortSourceAsc !== null
    ? [...filteredLeads].sort((a, b) => sortSourceAsc ? a.source.localeCompare(b.source) : b.source.localeCompare(a.source))
    : filteredLeads;

  const toggleSave = (id: string) => {
    setSavedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!hasProspectData) return <EmptyState />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Lead Stream</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filterByICP
              ? <>Showing leads matched to <Badge variant="secondary" className="text-xs mx-1">{filterByICP}</Badge>
                <Button variant="link" size="sm" className="text-xs h-auto p-0 ml-1" onClick={onClearFilter}>Show all</Button>
              </>
              : "High-intent leads based on your ICPs and uploaded prospect lists."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Save className="h-3.5 w-3.5" />
            Save to Workspace
          </Button>
        </div>
      </div>

      {/* Context Chips */}
      <div className="flex flex-wrap gap-2">
        {mockContextChips.map((chip) => (
          <div
            key={chip.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
          >
            {chip.icon}
            <span className="font-medium text-foreground">{chip.label}:</span>
            <span>{chip.value}</span>
          </div>
        ))}
      </div>

      {/* Lead Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[160px]">Lead Name</TableHead>
                <TableHead className="w-[140px]">Company</TableHead>
                <TableHead className="w-[160px]">Title</TableHead>
                <TableHead className="w-[100px]">Intent</TableHead>
                <TableHead className="w-[160px]">
                  <div className="flex items-center gap-1.5">
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                      <SelectTrigger className="h-7 w-[110px] text-xs border-none bg-transparent shadow-none px-1 font-medium text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Filter className="h-3 w-3" />
                          <SelectValue placeholder="Source" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        {uniqueSources.map((src) => (
                          <SelectItem key={src} value={src}>{src}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      className="p-0.5 rounded hover:bg-muted transition-colors"
                      onClick={() => setSortSourceAsc(prev => prev === null ? true : prev ? false : null)}
                    >
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${sortSourceAsc === true ? "rotate-180" : ""} ${sortSourceAsc === null ? "opacity-40" : ""}`} />
                    </button>
                  </div>
                </TableHead>
                <TableHead className="min-w-[200px]">Reason</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedLeads.map((lead) => (
                <TableRow key={lead.id} className="group">
                  <TableCell className="font-medium text-foreground">{lead.name}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.company}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{lead.title}</TableCell>
                  <TableCell><IntentBadge level={lead.intentLevel} /></TableCell>
                  <TableCell><SourceBadge source={lead.source} /></TableCell>
                  <TableCell>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground line-clamp-1 cursor-default">
                            {lead.reason}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          {lead.reason}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View profile</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${savedLeads.has(lead.id) ? "text-primary" : ""}`}
                              onClick={() => toggleSave(lead.id)}
                            >
                              <Bookmark className={`h-3.5 w-3.5 ${savedLeads.has(lead.id) ? "fill-primary" : ""}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{savedLeads.has(lead.id) ? "Saved" : "Save lead"}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Export</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* How this list was generated */}
      <Collapsible open={howOpen} onOpenChange={setHowOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group">
            {howOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Info className="h-3.5 w-3.5" />
            <span className="font-medium">How this list was generated</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2 border-dashed">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {howItWorks.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                      {step.icon}
                    </div>
                    <span>{step.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
