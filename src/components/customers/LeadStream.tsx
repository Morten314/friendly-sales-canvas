import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Zap, Download, RefreshCw, Save, Eye, ChevronDown, ChevronRight,
  Database, Users, Target, MapPin, Briefcase, ArrowUpRight, Info, Bookmark,
  Layers
} from "lucide-react";

// --- Types ---
interface Lead {
  id: string;
  name: string;
  company: string;
  title: string;
  matchedICP: string;
  fitScore: number; // 0-100
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
  { id: "1", name: "Sarah Chen", company: "Acme Corp", title: "VP of Revenue Operations", matchedICP: "Mid-Market SaaS – RevOps Teams", fitScore: 94, intentLevel: "High", reason: "Matches ICP + buyer role + region. Active hiring for RevOps roles." },
  { id: "2", name: "James Okoro", company: "ScaleUp Inc", title: "Head of GTM Strategy", matchedICP: "Growth-Stage E-commerce Leaders", fitScore: 88, intentLevel: "High", reason: "Strong intent: expanding GTM team + evaluating competitors in your space." },
  { id: "3", name: "Priya Sharma", company: "NovaTech Solutions", title: "Director of Sales Enablement", matchedICP: "Mid-Market SaaS – RevOps Teams", fitScore: 91, intentLevel: "High", reason: "Lookalike of accepted ICP + high fit. Competitor tool usage detected." },
  { id: "4", name: "Marcus Liu", company: "DataDriven AI", title: "CRO", matchedICP: "Enterprise FinTech Decision Makers", fitScore: 72, intentLevel: "Medium", reason: "Right buyer role + region match. Recent funding round signals growth phase." },
  { id: "5", name: "Elena Vasquez", company: "CloudFirst Systems", title: "VP Sales", matchedICP: "Mid-Market SaaS – RevOps Teams", fitScore: 96, intentLevel: "High", reason: "Matches ICP + active job postings for sales leadership + competitor tool churn." },
  { id: "6", name: "David Park", company: "Momentum Labs", title: "Head of Partnerships", matchedICP: "Enterprise FinTech Decision Makers", fitScore: 78, intentLevel: "Medium", reason: "Strong ICP alignment. Partnership-led growth model fits your offering." },
  { id: "7", name: "Amara Johnson", company: "RevStack AI", title: "VP of RevOps", matchedICP: "Mid-Market SaaS – RevOps Teams", fitScore: 92, intentLevel: "High", reason: "Matches refined ICP targeting RevOps teams. High engagement with your content." },
  { id: "8", name: "Tobias Müller", company: "FinServ Digital", title: "Chief Digital Officer", matchedICP: "Enterprise FinTech Decision Makers", fitScore: 68, intentLevel: "Medium", reason: "Matches new FinTech ICP segment. Digital transformation initiative underway." },
  { id: "9", name: "Lily Tran", company: "ShopScale D2C", title: "Head of Growth", matchedICP: "Growth-Stage E-commerce Leaders", fitScore: 85, intentLevel: "High", reason: "Growth-stage leader. Similar buying patterns to best customers." },
  { id: "10", name: "Raj Patel", company: "OpsFlow SaaS", title: "Head of Sales Operations", matchedICP: "Mid-Market SaaS – RevOps Teams", fitScore: 76, intentLevel: "Medium", reason: "RevOps focus + Series B funding. Tech stack consolidation signals." },
  { id: "11", name: "Nina Kowalski", company: "PayTech Global", title: "VP of Innovation", matchedICP: "Enterprise FinTech Decision Makers", fitScore: 82, intentLevel: "High", reason: "Digital transformation lead. Evaluating API-first partnerships." },
  { id: "12", name: "Chris Andersen", company: "BrandBurst D2C", title: "COO", matchedICP: "Growth-Stage E-commerce Leaders", fitScore: 64, intentLevel: "Medium", reason: "Scaling operations. Platform migration in progress." },
];

/** Count of leads in Lead Stream that match the given ICP name (same logic as filter). */
export function getLeadCountForICP(icpName: string): number {
  if (!icpName) return 0;
  const lower = icpName.toLowerCase();
  return mockLeads.filter(
    (lead) =>
      lead.matchedICP === icpName ||
      lead.matchedICP.toLowerCase().includes(lower) ||
      lower.includes(lead.matchedICP.toLowerCase())
  ).length;
}

const mockContextChips: ContextChip[] = [
  { label: "Active ICPs", value: "4", icon: <Target className="h-3 w-3" /> },
  { label: "Regions", value: "North America, EMEA", icon: <MapPin className="h-3 w-3" /> },
  { label: "Industries", value: "SaaS, AI/ML, FinTech", icon: <Briefcase className="h-3 w-3" /> },
  { label: "Buyer Roles", value: "VP Sales, CRO, RevOps", icon: <Users className="h-3 w-3" /> },
];

const howItWorks = [
  { icon: <Database className="h-4 w-4" />, text: "Prospect lists scanned from Data Sources" },
  { icon: <Users className="h-4 w-4" />, text: "ICPs pulled from Customer Profile" },
  { icon: <Target className="h-4 w-4" />, text: "Leads scored by ICP fit + intent signals" },
  { icon: <Zap className="h-4 w-4" />, text: "Segmented and ranked by matched ICP" },
];

// --- Fit Score Badge ---
const FitScoreBadge = ({ score }: { score: number }) => {
  const color = score >= 85
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : score >= 70
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`text-xs font-semibold tabular-nums ${color}`}>
      {score}%
    </Badge>
  );
};

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

// --- Segment Header ---
const SegmentHeader = ({ icpName, leads, isOpen, onToggle }: { icpName: string; leads: Lead[]; isOpen: boolean; onToggle: () => void }) => {
  const avgFit = Math.round(leads.reduce((sum, l) => sum + l.fitScore, 0) / leads.length);
  const highIntent = leads.filter(l => l.intentLevel === "High").length;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors rounded-t-lg border border-border border-b-0"
    >
      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      <Layers className="h-4 w-4 text-primary" />
      <span className="font-semibold text-sm text-foreground">{icpName}</span>
      <div className="flex items-center gap-2 ml-auto">
        <Badge variant="secondary" className="text-xs">{leads.length} leads</Badge>
        <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">Avg Fit: {avgFit}%</Badge>
        {highIntent > 0 && (
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
            <Zap className="h-3 w-3 mr-1" />
            {highIntent} high intent
          </Badge>
        )}
      </div>
    </button>
  );
};

// --- Lead Table Rows ---
const LeadRows = ({ leads, savedLeads, toggleSave, showSource }: { leads: Lead[]; savedLeads: Set<string>; toggleSave: (id: string) => void; showSource?: boolean }) => (
  <>
    {leads.sort((a, b) => b.fitScore - a.fitScore).map((lead) => (
      <TableRow key={lead.id} className="group">
        <TableCell className="font-medium text-foreground">{lead.name}</TableCell>
        <TableCell className="text-muted-foreground">{lead.company}</TableCell>
        <TableCell className="text-muted-foreground text-xs">{lead.title}</TableCell>
        <TableCell><FitScoreBadge score={lead.fitScore} /></TableCell>
        <TableCell><IntentBadge level={lead.intentLevel} /></TableCell>
        {showSource && (
          <TableCell>
            <Badge variant="outline" className="text-xs bg-muted/50 text-foreground border-border">
              {lead.matchedICP}
            </Badge>
          </TableCell>
        )}
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
  </>
);

// --- Main Component ---
interface LeadStreamPanelProps {
  filterByICP?: string | null;
  onClearFilter?: () => void;
}

export const LeadStreamPanel = ({ filterByICP, onClearFilter }: LeadStreamPanelProps) => {
  const [howOpen, setHowOpen] = useState(false);
  const [savedLeads, setSavedLeads] = useState<Set<string>>(new Set());
  const [collapsedSegments, setCollapsedSegments] = useState<Set<string>>(new Set());
  const hasProspectData = true;

  const isFiltered = !!filterByICP;

  const filteredLeads = useMemo(() => {
    if (!filterByICP) return mockLeads;
    const lower = filterByICP.toLowerCase();
    return mockLeads.filter(
      (lead) =>
        lead.matchedICP === filterByICP ||
        lead.matchedICP.toLowerCase().includes(lower) ||
        lower.includes(lead.matchedICP.toLowerCase())
    );
  }, [filterByICP]);

  // Group leads by matchedICP for segmented view
  const segments = useMemo(() => {
    const map = new Map<string, Lead[]>();
    filteredLeads.forEach((lead) => {
      const list = map.get(lead.matchedICP) || [];
      list.push(lead);
      map.set(lead.matchedICP, list);
    });
    // Sort segments by avg fit score descending
    return Array.from(map.entries()).sort((a, b) => {
      const avgA = a[1].reduce((s, l) => s + l.fitScore, 0) / a[1].length;
      const avgB = b[1].reduce((s, l) => s + l.fitScore, 0) / b[1].length;
      return avgB - avgA;
    });
  }, [filteredLeads]);

  const toggleSave = (id: string) => {
    setSavedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSegment = (icpName: string) => {
    setCollapsedSegments((prev) => {
      const next = new Set(prev);
      next.has(icpName) ? next.delete(icpName) : next.add(icpName);
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
            {isFiltered
              ? <>Showing leads matched to <Badge variant="secondary" className="text-xs mx-1">{filterByICP}</Badge>
                <Button variant="link" size="sm" className="text-xs h-auto p-0 ml-1" onClick={onClearFilter}>Show all</Button>
              </>
              : "Leads scored by ICP fit and segmented by matched profile."}
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
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          <Layers className="h-3 w-3" />
          <span className="font-medium text-foreground">Segments:</span>
          <span>{segments.length}</span>
        </div>
      </div>

      {/* Segmented or Filtered View */}
      {isFiltered ? (
        /* Filtered: flat table for a single ICP */
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[160px]">Lead Name</TableHead>
                  <TableHead className="w-[140px]">Company</TableHead>
                  <TableHead className="w-[160px]">Title</TableHead>
                  <TableHead className="w-[80px]">Fit</TableHead>
                  <TableHead className="w-[100px]">Intent</TableHead>
                  <TableHead className="min-w-[200px]">Reason</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <LeadRows leads={filteredLeads} savedLeads={savedLeads} toggleSave={toggleSave} />
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* Default: grouped by ICP segment */
        <div className="space-y-3">
          {segments.map(([icpName, leads]) => {
            const isOpen = !collapsedSegments.has(icpName);
            return (
              <div key={icpName}>
                <SegmentHeader
                  icpName={icpName}
                  leads={leads}
                  isOpen={isOpen}
                  onToggle={() => toggleSegment(icpName)}
                />
                {isOpen && (
                  <Card className="rounded-t-none border-t-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[160px]">Lead Name</TableHead>
                            <TableHead className="w-[140px]">Company</TableHead>
                            <TableHead className="w-[160px]">Title</TableHead>
                            <TableHead className="w-[80px]">Fit</TableHead>
                            <TableHead className="w-[100px]">Intent</TableHead>
                            <TableHead className="min-w-[200px]">Reason</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <LeadRows leads={leads} savedLeads={savedLeads} toggleSave={toggleSave} />
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      )}

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
