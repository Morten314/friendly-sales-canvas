import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Download, Upload, Send, Mail, Phone, Linkedin, Globe,
  ExternalLink, Zap, TrendingUp, Building2, Users, Target,
  Filter, ChevronDown, Eye, Star, Briefcase, MapPin, Cpu, DollarSign,
  RefreshCw, MoreHorizontal,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ICPMatch = "High" | "Medium" | "Low";
type LeadStatus = "New" | "Qualified" | "Contacted" | "In Campaign" | "Sent to CRM";

interface ScoutLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  linkedIn: string;
  jobTitle: string;
  company: string;
  companyLogo: string;
  companyWebsite: string;
  industry: string;
  employeeSize: string;
  hqLocation: string;
  icpMatch: ICPMatch;
  leadScore: number;
  scoreFactors: string[];
  marketSignals: string[];
  intentSignals: string[];
  status: LeadStatus;
  source: "crm" | "uploaded";
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockLeads: ScoutLead[] = [
  {
    id: "1", name: "Sarah Chen", email: "s.chen@acmecorp.com", phone: "+1 415-555-0142",
    linkedIn: "https://linkedin.com/in/sarachen", jobTitle: "VP of Revenue Operations",
    company: "Acme Corp", companyLogo: "", companyWebsite: "https://acmecorp.com",
    industry: "SaaS", employeeSize: "201-500", hqLocation: "San Francisco, CA",
    icpMatch: "High", leadScore: 5, scoreFactors: ["ICP fit", "Role seniority", "Market signals", "Tech stack", "Industry alignment"],
    marketSignals: ["Hiring DevOps", "Raised Series B", "Tech stack match"],
    intentSignals: ["Visiting competitor sites", "Hiring relevant roles"],
    status: "New", source: "crm",
  },
  {
    id: "2", name: "James Okoro", email: "j.okoro@scaleup.io", phone: "+1 212-555-0198",
    linkedIn: "https://linkedin.com/in/jamesokoro", jobTitle: "Head of GTM Strategy",
    company: "ScaleUp Inc", companyLogo: "", companyWebsite: "https://scaleup.io",
    industry: "AI/ML", employeeSize: "51-200", hqLocation: "New York, NY",
    icpMatch: "High", leadScore: 4, scoreFactors: ["ICP fit", "Industry alignment", "Role seniority", "Market signals"],
    marketSignals: ["Expanding to US", "Hiring AI Engineers"],
    intentSignals: ["Technology change", "Funding"],
    status: "Qualified", source: "crm",
  },
  {
    id: "3", name: "Priya Sharma", email: "priya@novatech.com", phone: "+91 98765-43210",
    linkedIn: "https://linkedin.com/in/priyasharma", jobTitle: "Director of Sales Enablement",
    company: "NovaTech Solutions", companyLogo: "", companyWebsite: "https://novatech.com",
    industry: "Enterprise Software", employeeSize: "501-1000", hqLocation: "Bangalore, India",
    icpMatch: "High", leadScore: 4, scoreFactors: ["ICP fit", "Tech stack", "Industry alignment", "Role seniority"],
    marketSignals: ["Tech stack match", "Hiring DevOps"],
    intentSignals: ["Visiting competitor sites"],
    status: "New", source: "uploaded",
  },
  {
    id: "4", name: "Marcus Liu", email: "mliu@datadriven.ai", phone: "+1 650-555-0177",
    linkedIn: "https://linkedin.com/in/marcusliu", jobTitle: "CRO",
    company: "DataDriven AI", companyLogo: "", companyWebsite: "https://datadriven.ai",
    industry: "AI/ML", employeeSize: "201-500", hqLocation: "Palo Alto, CA",
    icpMatch: "Medium", leadScore: 3, scoreFactors: ["ICP fit", "Role seniority", "Industry alignment"],
    marketSignals: ["Raised Series B"],
    intentSignals: ["Funding"],
    status: "Contacted", source: "crm",
  },
  {
    id: "5", name: "Elena Vasquez", email: "elena@cloudfirst.com", phone: "+1 303-555-0134",
    linkedIn: "https://linkedin.com/in/elenavasquez", jobTitle: "VP Sales",
    company: "CloudFirst Systems", companyLogo: "", companyWebsite: "https://cloudfirst.com",
    industry: "Cloud Infrastructure", employeeSize: "1001-5000", hqLocation: "Denver, CO",
    icpMatch: "High", leadScore: 5, scoreFactors: ["ICP fit", "Role seniority", "Market signals", "Tech stack", "Industry alignment"],
    marketSignals: ["Hiring AI Engineers", "Expanding to US", "Tech stack match"],
    intentSignals: ["Visiting competitor sites", "Technology change", "Hiring relevant roles"],
    status: "In Campaign", source: "uploaded",
  },
  {
    id: "6", name: "David Park", email: "dpark@momentum.dev", phone: "+82 10-5555-0166",
    linkedIn: "https://linkedin.com/in/davidpark", jobTitle: "Head of Partnerships",
    company: "Momentum Labs", companyLogo: "", companyWebsite: "https://momentum.dev",
    industry: "DevTools", employeeSize: "51-200", hqLocation: "Seoul, South Korea",
    icpMatch: "Medium", leadScore: 3, scoreFactors: ["ICP fit", "Industry alignment", "Role seniority"],
    marketSignals: ["Hiring DevOps"],
    intentSignals: ["Technology change"],
    status: "New", source: "crm",
  },
  {
    id: "7", name: "Amara Johnson", email: "amara@revstack.ai", phone: "+1 512-555-0188",
    linkedIn: "https://linkedin.com/in/amarajohnson", jobTitle: "VP of RevOps",
    company: "RevStack AI", companyLogo: "", companyWebsite: "https://revstack.ai",
    industry: "SaaS", employeeSize: "201-500", hqLocation: "Austin, TX",
    icpMatch: "High", leadScore: 4, scoreFactors: ["ICP fit", "Role seniority", "Tech stack", "Market signals"],
    marketSignals: ["Tech stack match", "Hiring AI Engineers"],
    intentSignals: ["Visiting competitor sites", "Hiring relevant roles"],
    status: "Sent to CRM", source: "uploaded",
  },
  {
    id: "8", name: "Tobias Müller", email: "t.muller@finserv.digital", phone: "+49 30-555-0144",
    linkedIn: "https://linkedin.com/in/tobiasmuller", jobTitle: "Chief Digital Officer",
    company: "FinServ Digital", companyLogo: "", companyWebsite: "https://finserv.digital",
    industry: "FinTech", employeeSize: "1001-5000", hqLocation: "Berlin, Germany",
    icpMatch: "Low", leadScore: 2, scoreFactors: ["Industry alignment", "Role seniority"],
    marketSignals: ["Expanding to US"],
    intentSignals: ["Funding"],
    status: "New", source: "crm",
  },
  {
    id: "9", name: "Lily Tran", email: "lily@shopscale.com", phone: "+1 206-555-0199",
    linkedIn: "https://linkedin.com/in/lilytran", jobTitle: "Head of Growth",
    company: "ShopScale D2C", companyLogo: "", companyWebsite: "https://shopscale.com",
    industry: "E-commerce", employeeSize: "51-200", hqLocation: "Seattle, WA",
    icpMatch: "Medium", leadScore: 3, scoreFactors: ["ICP fit", "Market signals", "Industry alignment"],
    marketSignals: ["Raised Series B", "Hiring DevOps"],
    intentSignals: ["Technology change", "Hiring relevant roles"],
    status: "Qualified", source: "uploaded",
  },
  {
    id: "10", name: "Raj Patel", email: "raj@opsflow.io", phone: "+1 408-555-0155",
    linkedIn: "https://linkedin.com/in/rajpatel", jobTitle: "Head of Sales Operations",
    company: "OpsFlow SaaS", companyLogo: "", companyWebsite: "https://opsflow.io",
    industry: "SaaS", employeeSize: "201-500", hqLocation: "San Jose, CA",
    icpMatch: "Medium", leadScore: 3, scoreFactors: ["ICP fit", "Role seniority", "Industry alignment"],
    marketSignals: ["Tech stack match"],
    intentSignals: ["Visiting competitor sites"],
    status: "Contacted", source: "crm",
  },
];

// ─── Filter Options ──────────────────────────────────────────────────────────

const icpMatchOptions = ["All", "High", "Medium", "Low"];
const leadScoreOptions = ["All", "5", "4", "3", "2", "1"];
const industryOptions = ["All", "SaaS", "AI/ML", "Enterprise Software", "Cloud Infrastructure", "DevTools", "FinTech", "E-commerce"];
const companySizeOptions = ["All", "1-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];
const geographyOptions = ["All", "North America", "Europe", "Asia Pacific", "Latin America"];
const intentOptions = ["All", "Visiting competitor sites", "Hiring relevant roles", "Technology change", "Funding"];
const statusOptions = ["All", "New", "Qualified", "Contacted", "In Campaign", "Sent to CRM"];

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

const StatusBadge = ({ status }: { status: LeadStatus }) => {
  const styles: Record<LeadStatus, string> = {
    New: "bg-blue-50 text-blue-700 border-blue-200",
    Qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Contacted: "bg-violet-50 text-violet-700 border-violet-200",
    "In Campaign": "bg-amber-50 text-amber-700 border-amber-200",
    "Sent to CRM": "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium whitespace-nowrap ${styles[status]}`}>
      {status}
    </Badge>
  );
};

const SignalBadge = ({ label }: { label: string }) => {
  const iconMap: Record<string, React.ReactNode> = {
    "Hiring DevOps": <Users className="h-3 w-3" />,
    "Expanding to US": <MapPin className="h-3 w-3" />,
    "Raised Series B": <DollarSign className="h-3 w-3" />,
    "Hiring AI Engineers": <Cpu className="h-3 w-3" />,
    "Tech stack match": <Zap className="h-3 w-3" />,
  };
  return (
    <Badge variant="outline" className="text-[10px] font-medium bg-muted/50 border-border gap-1 whitespace-nowrap">
      {iconMap[label] || <TrendingUp className="h-3 w-3" />}
      {label}
    </Badge>
  );
};

const ContactIcons = ({ lead, onOpenDrawer }: { lead: ScoutLead; onOpenDrawer: () => void }) => (
  <div className="flex items-center gap-1">
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={`mailto:${lead.email}`} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Mail className="h-3.5 w-3.5" />
          </a>
        </TooltipTrigger>
        <TooltipContent className="text-xs">{lead.email}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={`tel:${lead.phone}`} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Phone className="h-3.5 w-3.5" />
          </a>
        </TooltipTrigger>
        <TooltipContent className="text-xs">{lead.phone}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={lead.linkedIn} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Linkedin className="h-3.5 w-3.5" />
          </a>
        </TooltipTrigger>
        <TooltipContent className="text-xs">LinkedIn Profile</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);

// ─── Lead Intelligence Drawer ────────────────────────────────────────────────

const LeadDrawer = ({ lead, open, onClose }: { lead: ScoutLead | null; open: boolean; onClose: () => void }) => {
  if (!lead) return null;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{lead.name}</SheetTitle>
          <p className="text-sm text-muted-foreground">{lead.jobTitle} at {lead.company}</p>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span>{lead.email}</span></div>
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span>{lead.phone}</span></div>
              <div className="flex items-center gap-2">
                <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={lead.linkedIn} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                  LinkedIn <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Company</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /><span>{lead.company}</span></div>
              <div className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" /><span>{lead.industry}</span></div>
              <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" /><span>{lead.employeeSize} employees</span></div>
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><span>{lead.hqLocation}</span></div>
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={lead.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                  {lead.companyWebsite.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Scoring */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Scout AI Score</h4>
            <div className="mb-2"><LeadScoreDots score={lead.leadScore} /></div>
            <div className="flex flex-wrap gap-1.5">
              {lead.scoreFactors.map((f) => (
                <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
              ))}
            </div>
          </div>

          {/* ICP Match */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">ICP Match</h4>
            <ICPMatchBadge level={lead.icpMatch} />
          </div>

          {/* Market Signals */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Market Signals</h4>
            <div className="flex flex-wrap gap-1.5">
              {lead.marketSignals.map((s) => <SignalBadge key={s} label={s} />)}
            </div>
          </div>

          {/* Intent Signals */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Intent Signals</h4>
            <div className="flex flex-wrap gap-1.5">
              {lead.intentSignals.map((s) => (
                <Badge key={s} variant="outline" className="text-[10px] font-medium bg-orange-50 text-orange-700 border-orange-200 gap-1">
                  <Zap className="h-3 w-3" />{s}
                </Badge>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Status</h4>
            <StatusBadge status={lead.status} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ─── Filter Bar ──────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  icpMatch: string;
  leadScore: string;
  industry: string;
  companySize: string;
  geography: string;
  intent: string;
  status: string;
}

const defaultFilters: Filters = {
  search: "", icpMatch: "All", leadScore: "All", industry: "All",
  companySize: "All", geography: "All", intent: "All", status: "All",
};

const FilterSelect = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-8 text-xs w-[130px]">
      <SelectValue placeholder={label} />
    </SelectTrigger>
    <SelectContent>
      {options.map((o) => (
        <SelectItem key={o} value={o} className="text-xs">{o === "All" ? `${label}: All` : o}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

// ─── Lead Table ──────────────────────────────────────────────────────────────

const LeadTable = ({ leads, source }: { leads: ScoutLead[]; source: "crm" | "uploaded" }) => {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [drawerLead, setDrawerLead] = useState<ScoutLead | null>(null);

  const sourceLeads = leads.filter((l) => l.source === source);

  const filtered = sourceLeads.filter((l) => {
    if (filters.search && !l.name.toLowerCase().includes(filters.search.toLowerCase()) && !l.company.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.icpMatch !== "All" && l.icpMatch !== filters.icpMatch) return false;
    if (filters.leadScore !== "All" && l.leadScore !== Number(filters.leadScore)) return false;
    if (filters.industry !== "All" && l.industry !== filters.industry) return false;
    if (filters.companySize !== "All" && l.employeeSize !== filters.companySize) return false;
    if (filters.intent !== "All" && !l.intentSignals.includes(filters.intent)) return false;
    if (filters.status !== "All" && l.status !== filters.status) return false;
    return true;
  });

  const updateFilter = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              className="h-8 pl-8 text-xs"
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Send className="h-3.5 w-3.5" /> Push to CRM
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Target className="h-3.5 w-3.5" /> Add to Campaign
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <FilterSelect label="ICP Match" value={filters.icpMatch} options={icpMatchOptions} onChange={(v) => updateFilter("icpMatch", v)} />
        <FilterSelect label="Lead Score" value={filters.leadScore} options={leadScoreOptions} onChange={(v) => updateFilter("leadScore", v)} />
        <FilterSelect label="Industry" value={filters.industry} options={industryOptions} onChange={(v) => updateFilter("industry", v)} />
        <FilterSelect label="Company Size" value={filters.companySize} options={companySizeOptions} onChange={(v) => updateFilter("companySize", v)} />
        <FilterSelect label="Geography" value={filters.geography} options={geographyOptions} onChange={(v) => updateFilter("geography", v)} />
        <FilterSelect label="Intent Signal" value={filters.intent} options={intentOptions} onChange={(v) => updateFilter("intent", v)} />
        <FilterSelect label="Status" value={filters.status} options={statusOptions} onChange={(v) => updateFilter("status", v)} />
        {Object.values(filters).some((v) => v !== "" && v !== "All") && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilters(defaultFilters)}>
            Clear all
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <ScrollArea className="w-full">
          <div className="min-w-[1200px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[160px]">Lead Name</TableHead>
                  <TableHead className="w-[90px]">Contact</TableHead>
                  <TableHead className="w-[150px]">Job Title</TableHead>
                  <TableHead className="w-[160px]">Company</TableHead>
                  <TableHead className="w-[90px]">ICP Match</TableHead>
                  <TableHead className="w-[100px]">Lead Score</TableHead>
                  <TableHead className="w-[200px]">Market Signals</TableHead>
                  <TableHead className="w-[36px]">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  </TableHead>
                  <TableHead className="w-[180px]">Intent Signals</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-sm text-muted-foreground">
                      No leads match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((lead) => (
                    <TableRow key={lead.id} className="group">
                      {/* Lead Name */}
                      <TableCell>
                        <button
                          className="font-medium text-foreground hover:text-primary hover:underline text-left transition-colors"
                          onClick={() => setDrawerLead(lead)}
                        >
                          {lead.name}
                        </button>
                      </TableCell>

                      {/* Contact Icons */}
                      <TableCell>
                        <ContactIcons lead={lead} onOpenDrawer={() => setDrawerLead(lead)} />
                      </TableCell>

                      {/* Job Title */}
                      <TableCell className="text-xs text-muted-foreground">{lead.jobTitle}</TableCell>

                      {/* Company */}
                      <TableCell>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 cursor-default">
                                <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                  {lead.company.charAt(0)}
                                </div>
                                <span className="text-sm text-foreground truncate max-w-[120px]">{lead.company}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs space-y-1">
                              <div className="flex items-center gap-1.5"><Briefcase className="h-3 w-3" /> {lead.industry}</div>
                              <div className="flex items-center gap-1.5"><Users className="h-3 w-3" /> {lead.employeeSize} employees</div>
                              <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {lead.hqLocation}</div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>

                      {/* ICP Match */}
                      <TableCell><ICPMatchBadge level={lead.icpMatch} /></TableCell>

                      {/* Lead Score */}
                      <TableCell>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-default"><LeadScoreDots score={lead.leadScore} /></div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              <p className="font-medium mb-1">Score Factors:</p>
                              {lead.scoreFactors.map((f) => <p key={f}>• {f}</p>)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>

                      {/* Market Signals */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {lead.marketSignals.slice(0, 2).map((s) => <SignalBadge key={s} label={s} />)}
                          {lead.marketSignals.length > 2 && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              +{lead.marketSignals.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* LinkedIn */}
                      <TableCell>
                        <a href={lead.linkedIn} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                          <Linkedin className="h-4 w-4" />
                        </a>
                      </TableCell>

                      {/* Website */}
                      <TableCell>
                        <a href={lead.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                          <Globe className="h-4 w-4" />
                        </a>
                      </TableCell>

                      {/* Intent Signals */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {lead.intentSignals.slice(0, 2).map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] font-medium bg-orange-50 text-orange-700 border-orange-200 gap-0.5 whitespace-nowrap">
                              <Zap className="h-2.5 w-2.5" />{s}
                            </Badge>
                          ))}
                          {lead.intentSignals.length > 2 && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              +{lead.intentSignals.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell><StatusBadge status={lead.status} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </Card>

      <LeadDrawer lead={drawerLead} open={!!drawerLead} onClose={() => setDrawerLead(null)} />
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

interface ScoutLeadStreamProps {
  selectedIndustry?: string;
  selectedSize?: string;
  selectedRegion?: string;
  onFiltersChange?: (filters: { selectedIndustry: string; selectedSize: string; selectedRegion: string }) => void;
}

const ScoutLeadStream = ({ selectedIndustry, selectedSize, selectedRegion, onFiltersChange }: ScoutLeadStreamProps) => {
  const [activeTab, setActiveTab] = useState<"crm" | "uploaded">("crm");

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Lead Stream</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scout-enriched leads scored against ICP models and market intelligence.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "crm" | "uploaded")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="crm" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            CRM Leads
          </TabsTrigger>
          <TabsTrigger value="uploaded" className="gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" />
            Uploaded Prospects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crm" className="mt-4">
          <div className="mb-3">
            <p className="text-xs text-muted-foreground">
              Leads pulled from HubSpot / Salesforce / CRM — re-evaluated by Scout using market intelligence and ICP signals.
            </p>
          </div>
          <LeadTable leads={mockLeads} source="crm" />
        </TabsContent>

        <TabsContent value="uploaded" className="mt-4">
          <div className="mb-3">
            <p className="text-xs text-muted-foreground">
              Uploaded prospect lists scored and enriched by Scout's AI against your ICP models.
            </p>
          </div>
          <LeadTable leads={mockLeads} source="uploaded" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScoutLeadStream;
