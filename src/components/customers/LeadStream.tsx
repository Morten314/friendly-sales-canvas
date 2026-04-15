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
  Layers, Check, X, Shield, Sparkles, Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ProfilerDashboard from "@/components/customers/ProfilerDashboard";

// --- Types ---
type ICPCategory = "current" | "accepted" | "pending";

interface Lead {
  id: string;
  name: string;
  company: string;
  title: string;
  matchedICP: string;
  icpCategory: ICPCategory;
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
  // Current ICPs
  { id: "c1", name: "Tom Bradley", company: "Nextera Software", title: "CTO", matchedICP: "ICP 1", icpCategory: "current", fitScore: 90, intentLevel: "High", reason: "Matches ICP 1 buyer role (CTO) + North America region. Evaluating new platforms." },
  { id: "c2", name: "Jessica Wu", company: "CodeVault Inc", title: "VP Engineering", matchedICP: "ICP 1", icpCategory: "current", fitScore: 87, intentLevel: "High", reason: "Software & Technology, 200 employees. Active RFP for engineering tools." },
  { id: "c3", name: "Ryan Mitchell", company: "InfraOps Cloud", title: "CTO", matchedICP: "ICP 1", icpCategory: "current", fitScore: 79, intentLevel: "Medium", reason: "Tech company, 150 employees. Recently raised Series B, expanding platform." },
  { id: "c4", name: "Dr. Karen Wells", company: "MedStream Health", title: "CIO", matchedICP: "ICP 2", icpCategory: "current", fitScore: 93, intentLevel: "High", reason: "Healthcare, 400 employees. Digital transformation initiative launched Q1." },
  { id: "c5", name: "Oliver Grant", company: "HealthBridge UK", title: "Chief Digital Officer", matchedICP: "ICP 2", icpCategory: "current", fitScore: 84, intentLevel: "High", reason: "UK Healthcare, 350 employees. Modernizing patient management systems." },
  { id: "c6", name: "Fiona Reeves", company: "CareLogic Systems", title: "CIO", matchedICP: "ICP 2", icpCategory: "current", fitScore: 71, intentLevel: "Medium", reason: "Healthcare IT, 250 employees. Legacy system migration underway." },
  // Pending Recommended ICPs (not yet accepted)
  { id: "1", name: "Sarah Chen", company: "Acme Corp", title: "VP of Revenue Operations", matchedICP: "Mid-Market SaaS – RevOps Teams", icpCategory: "pending", fitScore: 94, intentLevel: "High", reason: "Matches ICP + buyer role + region. Active hiring for RevOps roles." },
  { id: "3", name: "Priya Sharma", company: "NovaTech Solutions", title: "Director of Sales Enablement", matchedICP: "Mid-Market SaaS – RevOps Teams", icpCategory: "pending", fitScore: 91, intentLevel: "High", reason: "Lookalike of accepted ICP + high fit. Competitor tool usage detected." },
  { id: "5", name: "Elena Vasquez", company: "CloudFirst Systems", title: "VP Sales", matchedICP: "Mid-Market SaaS – RevOps Teams", icpCategory: "pending", fitScore: 96, intentLevel: "High", reason: "Matches ICP + active job postings for sales leadership + competitor tool churn." },
  { id: "7", name: "Amara Johnson", company: "RevStack AI", title: "VP of RevOps", matchedICP: "Mid-Market SaaS – RevOps Teams", icpCategory: "pending", fitScore: 92, intentLevel: "High", reason: "Matches refined ICP targeting RevOps teams. High engagement with your content." },
  { id: "10", name: "Raj Patel", company: "OpsFlow SaaS", title: "Head of Sales Operations", matchedICP: "Mid-Market SaaS – RevOps Teams", icpCategory: "pending", fitScore: 76, intentLevel: "Medium", reason: "RevOps focus + Series B funding. Tech stack consolidation signals." },
  { id: "4", name: "Marcus Liu", company: "DataDriven AI", title: "CRO", matchedICP: "Enterprise FinTech Decision Makers", icpCategory: "pending", fitScore: 72, intentLevel: "Medium", reason: "Right buyer role + region match. Recent funding round signals growth phase." },
  { id: "6", name: "David Park", company: "Momentum Labs", title: "Head of Partnerships", matchedICP: "Enterprise FinTech Decision Makers", icpCategory: "pending", fitScore: 78, intentLevel: "Medium", reason: "Strong ICP alignment. Partnership-led growth model fits your offering." },
  { id: "8", name: "Tobias Müller", company: "FinServ Digital", title: "Chief Digital Officer", matchedICP: "Enterprise FinTech Decision Makers", icpCategory: "pending", fitScore: 68, intentLevel: "Medium", reason: "Matches new FinTech ICP segment. Digital transformation initiative underway." },
  { id: "11", name: "Nina Kowalski", company: "PayTech Global", title: "VP of Innovation", matchedICP: "Enterprise FinTech Decision Makers", icpCategory: "pending", fitScore: 82, intentLevel: "High", reason: "Digital transformation lead. Evaluating API-first partnerships." },
  { id: "2", name: "James Okoro", company: "ScaleUp Inc", title: "Head of GTM Strategy", matchedICP: "Growth-Stage E-commerce Leaders", icpCategory: "pending", fitScore: 88, intentLevel: "High", reason: "Strong intent: expanding GTM team + evaluating competitors in your space." },
  { id: "9", name: "Lily Tran", company: "ShopScale D2C", title: "Head of Growth", matchedICP: "Growth-Stage E-commerce Leaders", icpCategory: "pending", fitScore: 85, intentLevel: "High", reason: "Growth-stage leader. Similar buying patterns to best customers." },
  { id: "12", name: "Chris Andersen", company: "BrandBurst D2C", title: "COO", matchedICP: "Growth-Stage E-commerce Leaders", icpCategory: "pending", fitScore: 64, intentLevel: "Medium", reason: "Scaling operations. Platform migration in progress." },
];

/** Count of leads in Lead Stream that match the given ICP name. */
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

// --- Category Config ---
const categoryConfig: Record<ICPCategory, { label: string; icon: React.ReactNode; badgeClass: string; description: string }> = {
  current: {
    label: "Current ICP",
    icon: <Shield className="h-3.5 w-3.5" />,
    badgeClass: "bg-primary/10 text-primary border-primary/20",
    description: "Your existing customer profiles",
  },
  accepted: {
    label: "Accepted",
    icon: <Check className="h-3.5 w-3.5" />,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Recommended ICPs you've accepted",
  },
  pending: {
    label: "Pending Review",
    icon: <Clock className="h-3.5 w-3.5" />,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Recommended ICPs awaiting your decision",
  },
};

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

// --- ICP Metadata ---
interface ICPMeta {
  region: string;
  industries: string[];
  buyerRoles: string[];
}

const icpMetaMap: Record<string, ICPMeta> = {
  "ICP 1": {
    region: "North America",
    industries: ["Software & Technology", "AI/ML"],
    buyerRoles: ["CTO", "VP Engineering"],
  },
  "ICP 2": {
    region: "United Kingdom",
    industries: ["Healthcare", "Health IT"],
    buyerRoles: ["CIO", "Chief Digital Officer"],
  },
  "Mid-Market SaaS – RevOps Teams": {
    region: "North America",
    industries: ["SaaS", "AI/ML"],
    buyerRoles: ["VP of RevOps", "Director of Sales Enablement", "VP Sales"],
  },
  "Enterprise FinTech Decision Makers": {
    region: "EMEA",
    industries: ["FinTech", "Financial Services"],
    buyerRoles: ["CRO", "Chief Digital Officer", "VP of Innovation"],
  },
  "Growth-Stage E-commerce Leaders": {
    region: "North America",
    industries: ["E-commerce", "D2C"],
    buyerRoles: ["Head of GTM Strategy", "Head of Growth", "COO"],
  },
};

// --- Segment Header ---
const SegmentHeader = ({
  icpName,
  leads,
  isOpen,
  onToggle,
  category,
  onAccept,
  onReject,
}: {
  icpName: string;
  leads: Lead[];
  isOpen: boolean;
  onToggle: () => void;
  category: ICPCategory;
  onAccept?: () => void;
  onReject?: () => void;
}) => {
  const config = categoryConfig[category];
  const meta = icpMetaMap[icpName];

  return (
    <div className="w-full px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors rounded-t-lg border border-border border-b-0">
      <div className="flex items-center gap-3">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 min-w-0">
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Layers className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm text-foreground truncate">{icpName}</span>
          <Badge variant="outline" className={`text-[10px] font-medium shrink-0 gap-1 ${config.badgeClass}`}>
            {config.icon}
            {config.label}
          </Badge>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">{leads.length} leads</Badge>
          
          {category === "pending" && (
            <div className="flex items-center gap-1 ml-2">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                      onClick={(e) => { e.stopPropagation(); onAccept?.(); }}
                    >
                      <Check className="h-3 w-3" />
                      Accept
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept this recommended ICP</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                      onClick={(e) => { e.stopPropagation(); onReject?.(); }}
                    >
                      <X className="h-3 w-3" />
                      Reject
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Dismiss this recommended ICP</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
      {meta && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 ml-11 text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="font-medium text-foreground">{meta.region}</span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Briefcase className="h-3 w-3" />
            {meta.industries.map((ind) => (
              <Badge key={ind} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{ind}</Badge>
            ))}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" />
            {meta.buyerRoles.map((role) => (
              <Badge key={role} variant="outline" className="text-[10px] px-1.5 py-0 font-normal border-border">{role}</Badge>
            ))}
          </span>
        </div>
      )}
    </div>
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

// --- Category Section Header ---
const CategorySectionHeader = ({ category }: { category: ICPCategory }) => {
  const config = categoryConfig[category];
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${config.badgeClass}`}>
        {config.icon}
        {category === "current" ? "Current ICPs" : category === "accepted" ? "Accepted Recommendations" : "Pending Recommendations"}
      </div>
      <span className="text-[10px] text-muted-foreground">{config.description}</span>
    </div>
  );
};

// --- Main Component ---
interface LeadStreamPanelProps {
  filterByICP?: string | null;
  onClearFilter?: () => void;
}

export const LeadStreamPanel = ({ filterByICP, onClearFilter }: LeadStreamPanelProps) => {
  const [howOpen, setHowOpen] = useState(false);
  const [savedLeads, setSavedLeads] = useState<Set<string>>(new Set());
  const [collapsedSegments, setCollapsedSegments] = useState<Set<string>>(new Set());
  const [localLeads, setLocalLeads] = useState<Lead[]>(mockLeads);
  const hasProspectData = true;
  const { toast } = useToast();

  const isFiltered = !!filterByICP;

  const filteredLeads = useMemo(() => {
    if (!filterByICP) return localLeads;
    const lower = filterByICP.toLowerCase();
    return localLeads.filter(
      (lead) =>
        lead.matchedICP === filterByICP ||
        lead.matchedICP.toLowerCase().includes(lower) ||
        lower.includes(lead.matchedICP.toLowerCase())
    );
  }, [filterByICP, localLeads]);

  // Group leads by matchedICP
  const segments = useMemo(() => {
    const map = new Map<string, { leads: Lead[]; category: ICPCategory }>();
    filteredLeads.forEach((lead) => {
      const existing = map.get(lead.matchedICP);
      if (existing) {
        existing.leads.push(lead);
      } else {
        map.set(lead.matchedICP, { leads: [lead], category: lead.icpCategory });
      }
    });
    return Array.from(map.entries()).sort((a, b) => {
      // Sort by category order: current > accepted > pending
      const order: Record<ICPCategory, number> = { current: 0, accepted: 1, pending: 2 };
      const catDiff = order[a[1].category] - order[b[1].category];
      if (catDiff !== 0) return catDiff;
      // Within same category, sort by avg fit
      const avgA = a[1].leads.reduce((s, l) => s + l.fitScore, 0) / a[1].leads.length;
      const avgB = b[1].leads.reduce((s, l) => s + l.fitScore, 0) / b[1].leads.length;
      return avgB - avgA;
    });
  }, [filteredLeads]);

  // Group segments by category for section headers
  const categorizedSegments = useMemo(() => {
    const groups: { category: ICPCategory; segments: [string, { leads: Lead[]; category: ICPCategory }][] }[] = [];
    let currentCat: ICPCategory | null = null;
    segments.forEach((seg) => {
      if (seg[1].category !== currentCat) {
        currentCat = seg[1].category;
        groups.push({ category: currentCat, segments: [seg] });
      } else {
        groups[groups.length - 1].segments.push(seg);
      }
    });
    return groups;
  }, [segments]);

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

  const handleAcceptICP = (icpName: string) => {
    setLocalLeads(prev => prev.map(lead =>
      lead.matchedICP === icpName ? { ...lead, icpCategory: "accepted" as ICPCategory } : lead
    ));
    toast({ title: "ICP Accepted", description: `"${icpName}" has been accepted as an ICP.` });
  };

  const handleRejectICP = (icpName: string) => {
    setLocalLeads(prev => prev.filter(lead => lead.matchedICP !== icpName));
    toast({ title: "ICP Rejected", description: `Leads for "${icpName}" removed from stream.` });
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
        <div className="space-y-4">
          {categorizedSegments.map((group) => (
            <div key={group.category} className="space-y-3">
              <CategorySectionHeader category={group.category} />
              {group.segments.map(([icpName, { leads, category }]) => {
                const isOpen = !collapsedSegments.has(icpName);
                return (
                  <div key={icpName}>
                    <SegmentHeader
                      icpName={icpName}
                      leads={leads}
                      isOpen={isOpen}
                      onToggle={() => toggleSegment(icpName)}
                      category={category}
                      onAccept={category === "pending" ? () => handleAcceptICP(icpName) : undefined}
                      onReject={category === "pending" ? () => handleRejectICP(icpName) : undefined}
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
          ))}
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
