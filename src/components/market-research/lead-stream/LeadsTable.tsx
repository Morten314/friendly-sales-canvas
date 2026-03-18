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
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Bot, Plus, Loader2, Check, ArrowRight } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MatchedLead {
  id: string;
  name: string;
  email: string;
  company: string;
  jobTitle: string;
  tenure: string;
  source: "HubSpot" | "Prospect List";
  matchedReports: string[];
  signals: string[];
  // Agentic enrichment columns (populated on demand)
  [key: string]: unknown;
}

type AgenticColumnId =
  | "linkedinUrl"
  | "companyWebsite"
  | "employeeSize"
  | "industry"
  | "fundingStage"
  | "hiringActivity"
  | "techStack"
  | "icpScore"
  | "leadScore";

interface AgenticColumnDef {
  id: AgenticColumnId;
  label: string;
  mockValues: string[];
}

// ─── Available Agentic Columns ───────────────────────────────────────────────

const AGENTIC_COLUMNS: AgenticColumnDef[] = [
  { id: "linkedinUrl", label: "LinkedIn URL", mockValues: ["linkedin.com/in/schen", "linkedin.com/in/jokoro", "linkedin.com/in/psharma", "linkedin.com/in/mliu", "linkedin.com/in/evasquez", "linkedin.com/in/dpark", "linkedin.com/in/ajohnson", "linkedin.com/in/tmuller", "linkedin.com/in/ltran", "linkedin.com/in/rpatel"] },
  { id: "companyWebsite", label: "Company Website", mockValues: ["acme.com", "scaleup.io", "novatech.com", "datadriven.ai", "cloudfirst.io", "momentum.dev", "revstack.ai", "finserv.digital", "shopscale.com", "opsflow.io"] },
  { id: "employeeSize", label: "Employee Size", mockValues: ["500-1000", "50-200", "200-500", "1000-5000", "200-500", "50-200", "100-500", "5000+", "50-200", "200-500"] },
  { id: "industry", label: "Industry", mockValues: ["SaaS", "FinTech", "HealthTech", "AI/ML", "Cloud", "MarTech", "RevOps", "FinServ", "D2C", "SaaS"] },
  { id: "fundingStage", label: "Funding Stage", mockValues: ["Series C", "Series A", "Series B", "Series D", "Series B", "Seed", "Series A", "Public", "Series A", "Series B"] },
  { id: "hiringActivity", label: "Hiring Activity", mockValues: ["High", "Medium", "High", "High", "Low", "Medium", "High", "Low", "Medium", "Medium"] },
  { id: "techStack", label: "Tech Stack", mockValues: ["React, AWS", "Python, GCP", "Node, Azure", "PyTorch, AWS", "Go, GCP", "Next.js, Vercel", "Python, AWS", "Java, Azure", "Shopify, AWS", "Node, GCP"] },
  { id: "icpScore", label: "ICP Score", mockValues: ["92%", "78%", "85%", "88%", "91%", "65%", "87%", "45%", "72%", "70%"] },
  { id: "leadScore", label: "Lead Score", mockValues: ["5/5", "4/5", "4/5", "3/5", "5/5", "3/5", "4/5", "2/5", "3/5", "3/5"] },
];

// ─── Mock Data ───────────────────────────────────────────────────────────────

const REPORT_SECTIONS = [
  { value: "all", label: "Show All Reports" },
  { value: "market-size", label: "Market Size & Opportunity" },
  { value: "industry-trends", label: "Industry Trends" },
  { value: "competitor-landscape", label: "Competitor Landscape" },
  { value: "regulatory-compliance", label: "Regulatory Compliance" },
  { value: "market-entry", label: "Market Entry & Growth" },
];

const mockLeads: MatchedLead[] = [
  { id: "1", name: "Sarah Chen", email: "s.chen@acme.com", company: "Acme Corp", jobTitle: "VP Revenue Operations", tenure: "1 year 3 months", source: "HubSpot", matchedReports: ["market-size", "industry-trends"], signals: ["Recently hired", "Company expanding GTM team", "Active on LinkedIn discussing RevOps automation"] },
  { id: "2", name: "James Okoro", email: "j.okoro@scaleup.io", company: "ScaleUp Inc", jobTitle: "Head of Growth", tenure: "2 years 5 months", source: "HubSpot", matchedReports: ["market-size", "competitor-landscape"], signals: ["Recently promoted", "Company raised Series B", "Published article on scaling outbound"] },
  { id: "3", name: "Priya Sharma", email: "p.sharma@novatech.com", company: "NovaTech Solutions", jobTitle: "Director of Sales", tenure: "8 months", source: "Prospect List", matchedReports: ["industry-trends", "market-entry"], signals: ["Newly hired", "Company entering new market", "Hiring 5 SDRs"] },
  { id: "4", name: "Marcus Liu", email: "m.liu@datadriven.ai", company: "DataDriven AI", jobTitle: "CRO", tenure: "3 years 1 month", source: "HubSpot", matchedReports: ["competitor-landscape", "regulatory-compliance"], signals: ["Long tenure decision maker", "Company evaluating new tools", "Spoke at SaaStr Annual"] },
  { id: "5", name: "Elena Vasquez", email: "e.vasquez@cloudfirst.io", company: "CloudFirst Systems", jobTitle: "VP Sales", tenure: "1 year 8 months", source: "Prospect List", matchedReports: ["market-size", "market-entry"], signals: ["Company doubled ARR", "Hiring across go-to-market", "Active on LinkedIn"] },
  { id: "6", name: "David Park", email: "d.park@momentum.dev", company: "Momentum Labs", jobTitle: "Sales Operations Manager", tenure: "6 months", source: "HubSpot", matchedReports: ["regulatory-compliance"], signals: ["Newly hired", "Building sales ops function from scratch"] },
  { id: "7", name: "Amara Johnson", email: "a.johnson@revstack.ai", company: "RevStack AI", jobTitle: "Chief Revenue Officer", tenure: "2 years", source: "Prospect List", matchedReports: ["market-size", "industry-trends", "competitor-landscape"], signals: ["Key decision maker", "Company in hyper-growth", "Engaged with competitor content"] },
  { id: "8", name: "Tobias Müller", email: "t.muller@finserv.digital", company: "FinServ Digital", jobTitle: "Head of Business Development", tenure: "4 years 2 months", source: "HubSpot", matchedReports: ["regulatory-compliance"], signals: ["Long tenure", "Company navigating compliance changes"] },
  { id: "9", name: "Lily Tran", email: "l.tran@shopscale.com", company: "ShopScale D2C", jobTitle: "Director of Partnerships", tenure: "1 year", source: "Prospect List", matchedReports: ["market-entry"], signals: ["Company expanding partnerships", "Recently posted about channel strategy"] },
  { id: "10", name: "Raj Patel", email: "r.patel@opsflow.io", company: "OpsFlow SaaS", jobTitle: "VP Marketing", tenure: "9 months", source: "HubSpot", matchedReports: ["industry-trends", "market-entry"], signals: ["Recently hired", "Company rebranding", "Active thought leader on LinkedIn"] },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface LeadsTableProps {
  opportunityFilter?: string | null;
  onClearOpportunityFilter?: () => void;
  onResearchWithScout?: (lead: MatchedLead) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const LeadsTable: React.FC<LeadsTableProps> = ({
  opportunityFilter,
  onClearOpportunityFilter,
  onResearchWithScout,
}) => {
  const [reportFilter, setReportFilter] = useState<string>(opportunityFilter || "all");
  const [activeColumns, setActiveColumns] = useState<AgenticColumnId[]>([]);
  const [enrichedData, setEnrichedData] = useState<Record<string, Record<string, string>>>({});
  const [enrichingColumn, setEnrichingColumn] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [enrichDialog, setEnrichDialog] = useState<{ columnId: AgenticColumnId; label: string } | null>(null);

  // Sync external filter
  React.useEffect(() => {
    if (opportunityFilter) setReportFilter(opportunityFilter);
  }, [opportunityFilter]);

  const filteredLeads = reportFilter === "all"
    ? mockLeads
    : mockLeads.filter((l) => l.matchedReports.includes(reportFilter));

  const currentReportLabel = REPORT_SECTIONS.find((r) => r.value === reportFilter)?.label || "All Reports";

  const handleAddColumn = (colId: AgenticColumnId) => {
    setAddColumnOpen(false);
    const col = AGENTIC_COLUMNS.find((c) => c.id === colId);
    if (!col) return;
    setEnrichDialog({ columnId: colId, label: col.label });
  };

  const runEnrichment = (colId: AgenticColumnId, scope: "column" | "all") => {
    setEnrichDialog(null);
    if (!activeColumns.includes(colId)) {
      setActiveColumns((prev) => [...prev, colId]);
    }
    setEnrichingColumn(colId);

    // Mock enrichment delay
    setTimeout(() => {
      const col = AGENTIC_COLUMNS.find((c) => c.id === colId)!;
      const newData: Record<string, Record<string, string>> = { ...enrichedData };
      mockLeads.forEach((lead, i) => {
        if (!newData[lead.id]) newData[lead.id] = {};
        newData[lead.id][colId] = col.mockValues[i % col.mockValues.length];
      });
      setEnrichedData(newData);
      setEnrichingColumn(null);
    }, 1800);
  };

  const removeColumn = (colId: AgenticColumnId) => {
    setActiveColumns((prev) => prev.filter((c) => c !== colId));
  };

  const availableColumns = AGENTIC_COLUMNS.filter((c) => !activeColumns.includes(c.id));

  return (
    <div className="space-y-4">
      {/* Header + Report Filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">Matched Leads</h3>
          {reportFilter !== "all" && (
            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 gap-1">
              From: {currentReportLabel}
              <button
                className="ml-1 hover:text-primary/70"
                onClick={() => {
                  setReportFilter("all");
                  onClearOpportunityFilter?.();
                }}
              >
                ×
              </button>
            </Badge>
          )}
        </div>
        <Select value={reportFilter} onValueChange={setReportFilter}>
          <SelectTrigger className="h-8 text-xs w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_SECTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[160px] text-xs">Name</TableHead>
                <TableHead className="w-[200px] text-xs">Email</TableHead>
                <TableHead className="w-[150px] text-xs">Company</TableHead>
                <TableHead className="w-[120px] text-xs">Source</TableHead>

                {/* Agentic Columns */}
                {activeColumns.map((colId) => {
                  const col = AGENTIC_COLUMNS.find((c) => c.id === colId)!;
                  return (
                    <TableHead key={colId} className="text-xs min-w-[120px]">
                      <div className="flex items-center gap-1.5">
                        <span>{col.label}</span>
                        {enrichingColumn === colId && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                        {enrichingColumn !== colId && enrichedData[mockLeads[0]?.id]?.[colId] && (
                          <Check className="h-3 w-3 text-emerald-500" />
                        )}
                        <button
                          className="text-muted-foreground hover:text-destructive ml-auto text-[10px]"
                          onClick={() => removeColumn(colId)}
                        >
                          ×
                        </button>
                      </div>
                    </TableHead>
                  );
                })}

                {/* Add Column Button */}
                <TableHead className="w-[100px] text-xs">
                  <Popover open={addColumnOpen} onOpenChange={setAddColumnOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary hover:text-primary">
                        <Plus className="h-3 w-3" /> Add Column
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1.5" align="start">
                      <div className="space-y-0.5">
                        {availableColumns.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-2 text-center">All columns added</p>
                        ) : (
                          availableColumns.map((col) => (
                            <button
                              key={col.id}
                              className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-muted transition-colors text-foreground"
                              onClick={() => handleAddColumn(col.id)}
                            >
                              {col.label}
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableHead>

                {/* Research with Scout - persistent */}
                <TableHead className="w-[160px] text-xs text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5 + activeColumns.length + 1} className="text-center py-10 text-sm text-muted-foreground">
                    No matched leads for this report section.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="group">
                    <TableCell className="text-sm font-medium text-foreground">{lead.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{lead.email}</TableCell>
                    <TableCell className="text-sm text-foreground">{lead.company}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-medium ${lead.source === "HubSpot" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-violet-50 text-violet-700 border-violet-200"}`}>
                        {lead.source}
                      </Badge>
                    </TableCell>

                    {/* Agentic Column Values */}
                    {activeColumns.map((colId) => (
                      <TableCell key={colId} className="text-xs text-muted-foreground">
                        {enrichingColumn === colId ? (
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            <span className="text-[10px] text-muted-foreground">Enriching…</span>
                          </div>
                        ) : (
                          enrichedData[lead.id]?.[colId] || <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    ))}

                    {/* Add Column spacer */}
                    <TableCell />

                    {/* Research with Scout */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5 text-primary hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onResearchWithScout?.(lead)}
                      >
                        Research with Scout <ArrowRight className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Enrichment Dialog */}
      <Dialog open={!!enrichDialog} onOpenChange={() => setEnrichDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Run enrichment: {enrichDialog?.label}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Scout will enrich your leads with <span className="font-medium text-foreground">{enrichDialog?.label}</span> data.</p>
          <p className="text-xs text-muted-foreground mt-2">Run enrichment for:</p>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => enrichDialog && runEnrichment(enrichDialog.columnId, "column")}>
              <Bot className="h-3 w-3" /> This column only
            </Button>
            <Button size="sm" className="text-xs gap-1.5" onClick={() => enrichDialog && runEnrichment(enrichDialog.columnId, "all")}>
              <Bot className="h-3 w-3" /> All leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsTable;
