import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search, Linkedin, Target, Filter, RefreshCw, Zap, Sparkles, Bot,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ICPMatch = "High" | "Medium" | "Low";

interface ScoutLead {
  id: string;
  name: string;
  linkedIn: string;
  jobTitle: string;
  company: string;
  icpMatch: ICPMatch;
  leadScore: number;
  source: "CRM" | "Uploaded List";
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockLeads: ScoutLead[] = [
  { id: "1", name: "Sarah Chen", linkedIn: "https://linkedin.com/in/sarachen", jobTitle: "VP of Revenue Operations", company: "Acme Corp", icpMatch: "High", leadScore: 5, source: "CRM" },
  { id: "2", name: "James Okoro", linkedIn: "https://linkedin.com/in/jamesokoro", jobTitle: "Head of GTM Strategy", company: "ScaleUp Inc", icpMatch: "High", leadScore: 4, source: "CRM" },
  { id: "3", name: "Priya Sharma", linkedIn: "https://linkedin.com/in/priyasharma", jobTitle: "Director of Sales Enablement", company: "NovaTech Solutions", icpMatch: "High", leadScore: 4, source: "Uploaded List" },
  { id: "4", name: "Marcus Liu", linkedIn: "https://linkedin.com/in/marcusliu", jobTitle: "CRO", company: "DataDriven AI", icpMatch: "Medium", leadScore: 3, source: "CRM" },
  { id: "5", name: "Elena Vasquez", linkedIn: "https://linkedin.com/in/elenavasquez", jobTitle: "VP Sales", company: "CloudFirst Systems", icpMatch: "High", leadScore: 5, source: "Uploaded List" },
  { id: "6", name: "David Park", linkedIn: "https://linkedin.com/in/davidpark", jobTitle: "Head of Partnerships", company: "Momentum Labs", icpMatch: "Medium", leadScore: 3, source: "CRM" },
  { id: "7", name: "Amara Johnson", linkedIn: "https://linkedin.com/in/amarajohnson", jobTitle: "VP of RevOps", company: "RevStack AI", icpMatch: "High", leadScore: 4, source: "Uploaded List" },
  { id: "8", name: "Tobias Müller", linkedIn: "https://linkedin.com/in/tobiasmuller", jobTitle: "Chief Digital Officer", company: "FinServ Digital", icpMatch: "Low", leadScore: 2, source: "CRM" },
  { id: "9", name: "Lily Tran", linkedIn: "https://linkedin.com/in/lilytran", jobTitle: "Head of Growth", company: "ShopScale D2C", icpMatch: "Medium", leadScore: 3, source: "Uploaded List" },
  { id: "10", name: "Raj Patel", linkedIn: "https://linkedin.com/in/rajpatel", jobTitle: "Head of Sales Operations", company: "OpsFlow SaaS", icpMatch: "Medium", leadScore: 3, source: "CRM" },
];

// ─── Helper Components ───────────────────────────────────────────────────────

const ICPMatchBadge = ({ level }: { level: ICPMatch }) => {
  const styles: Record<ICPMatch, string> = {
    High: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Low: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${styles[level]}`}>
      {level === "High" && <Target className="h-3 w-3 mr-1" />}
      {level}
    </Badge>
  );
};

const LeadScoreDots = ({ score }: { score: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className={`h-2 w-2 rounded-full ${i <= score ? "bg-primary" : "bg-muted"}`}
      />
    ))}
    <span className="text-xs text-muted-foreground ml-1.5">{score}/5</span>
  </div>
);

const SourceBadge = ({ source }: { source: string }) => {
  const isCRM = source === "CRM";
  return (
    <Badge variant="outline" className={`text-xs font-medium ${isCRM ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-violet-50 text-violet-700 border-violet-200"}`}>
      {source}
    </Badge>
  );
};

// ─── Filter Options ──────────────────────────────────────────────────────────

const icpMatchOptions = ["All", "High", "Medium", "Low"];
const leadScoreOptions = ["All", "5", "4", "3", "2", "1"];
const sourceOptions = ["All", "CRM", "Uploaded List"];

// ─── Main Component ──────────────────────────────────────────────────────────

interface ScoutLeadStreamProps {
  selectedIndustry?: string;
  selectedSize?: string;
  selectedRegion?: string;
  opportunityFilter?: string | null;
  onFiltersChange?: (filters: { selectedIndustry: string; selectedSize: string; selectedRegion: string }) => void;
  onClearOpportunityFilter?: () => void;
  onResearchWithScout?: (leads: ScoutLead[], context?: string) => void;
}

const ScoutLeadStream = ({ opportunityFilter, onClearOpportunityFilter, onResearchWithScout }: ScoutLeadStreamProps) => {
  const [search, setSearch] = useState("");
  const [icpFilter, setIcpFilter] = useState("All");
  const [scoreFilter, setScoreFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const opportunityFilterLabels: Record<string, string> = {
    'market-size': 'Market Size & Opportunity',
    'industry-trends': 'Industry Trends',
    'competitor-landscape': 'Competitor Landscape',
    'regulatory-compliance': 'Regulatory Compliance',
    'market-entry': 'Market Entry & Growth',
  };

  const filtered = mockLeads.filter((l) => {
    if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.company.toLowerCase().includes(search.toLowerCase())) return false;
    if (icpFilter !== "All" && l.icpMatch !== icpFilter) return false;
    if (scoreFilter !== "All" && l.leadScore !== Number(scoreFilter)) return false;
    if (sourceFilter !== "All" && l.source !== sourceFilter) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedLeads.size === filtered.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filtered.map(l => l.id)));
    }
  };

  const handleResearchSelected = () => {
    const leads = filtered.filter(l => selectedLeads.has(l.id));
    onResearchWithScout?.(leads, opportunityFilter || undefined);
  };

  const handleResearchSingle = (lead: ScoutLead) => {
    onResearchWithScout?.([lead]);
  };

  const hasFilters = search || icpFilter !== "All" || scoreFilter !== "All" || sourceFilter !== "All";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header with indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Lead Stream</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Which leads should you pay attention to right now?
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Scout Insights Indicator */}
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">{filtered.length} Leads</span>
            <span className="text-xs text-primary">Scout Insights Available</span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Opportunity Filter Banner */}
      {opportunityFilter && opportunityFilterLabels[opportunityFilter] && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Showing leads matching: <span className="text-primary">{opportunityFilterLabels[opportunityFilter]}</span>
            </span>
          </div>
          {onClearOpportunityFilter && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearOpportunityFilter}>
              Clear filter
            </Button>
          )}
        </div>
      )}

      {/* Selected leads action bar */}
      {selectedLeads.size > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">
            {selectedLeads.size} lead{selectedLeads.size !== 1 ? "s" : ""} selected
          </span>
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleResearchSelected}>
            <Bot className="h-3.5 w-3.5" /> Research with Scout
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="relative max-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search..." className="h-8 pl-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={icpFilter} onValueChange={setIcpFilter}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="ICP Match" /></SelectTrigger>
          <SelectContent>{icpMatchOptions.map(o => <SelectItem key={o} value={o} className="text-xs">{o === "All" ? "ICP: All" : o}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="Lead Score" /></SelectTrigger>
          <SelectContent>{leadScoreOptions.map(o => <SelectItem key={o} value={o} className="text-xs">{o === "All" ? "Score: All" : `${o}/5`}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>{sourceOptions.map(o => <SelectItem key={o} value={o} className="text-xs">{o === "All" ? "Source: All" : o}</SelectItem>)}</SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearch(""); setIcpFilter("All"); setScoreFilter("All"); setSourceFilter("All"); }}>
            Clear all
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  checked={selectedLeads.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="rounded border-border"
                />
              </TableHead>
              <TableHead className="w-[180px]">Lead</TableHead>
              <TableHead className="w-[160px]">Company</TableHead>
              <TableHead className="w-[180px]">Role</TableHead>
              <TableHead className="w-[100px]">ICP Match</TableHead>
              <TableHead className="w-[110px]">Lead Score</TableHead>
              <TableHead className="w-[110px]">Source</TableHead>
              <TableHead className="w-[160px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-sm text-muted-foreground">
                  No leads match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lead) => (
                <TableRow key={lead.id} className="group">
                  {/* Checkbox */}
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedLeads.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="rounded border-border"
                    />
                  </TableCell>

                  {/* Lead Name + LinkedIn */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">{lead.name}</span>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a href={lead.linkedIn} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                              <Linkedin className="h-3.5 w-3.5" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">LinkedIn Profile</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>

                  {/* Company + Logo placeholder */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {lead.company.charAt(0)}
                      </div>
                      <span className="text-sm text-foreground truncate max-w-[120px]">{lead.company}</span>
                    </div>
                  </TableCell>

                  {/* Role */}
                  <TableCell className="text-sm text-muted-foreground">{lead.jobTitle}</TableCell>

                  {/* ICP Match */}
                  <TableCell><ICPMatchBadge level={lead.icpMatch} /></TableCell>

                  {/* Lead Score */}
                  <TableCell><LeadScoreDots score={lead.leadScore} /></TableCell>

                  {/* Source */}
                  <TableCell><SourceBadge source={lead.source} /></TableCell>

                  {/* Action */}
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleResearchSingle(lead)}
                    >
                      <Bot className="h-3 w-3" /> Research with Scout
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default ScoutLeadStream;
