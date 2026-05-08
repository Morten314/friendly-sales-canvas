import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Plus, MoreVertical, Megaphone, Mail, MessageSquare, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { heatmapLeads, type HeatmapLead } from "@/components/market-research/lead-stream/leadData";

const COLUMN_OPTIONS = [
  "LinkedIn URL",
  "Company Website",
  "Employee Size",
  "Funding Status",
  "Hiring Activity",
  "Industry",
  "ICP Fit",
];

// Strategist-specific recommended actions per tier
const TIER_RECOMMENDATIONS: Record<string, { action: string; detail: string; color: string }> = {
  "Tier 1": {
    action: "Direct Outreach",
    detail: "High-priority — personalised outreach with decision-maker engagement",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  },
  "Tier 2": {
    action: "Nurture Sequence",
    detail: "Build awareness with value-driven content and trigger-based follow-ups",
    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  },
  "Tier 3": {
    action: "Monitor & Educate",
    detail: "Low-touch awareness campaigns — revisit when signals strengthen",
    color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  },
};

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

const TierGroup = ({
  tier,
  leads,
  customColumns,
  setCustomColumns,
  removedLeads,
  onRemoveLead,
}: {
  tier: string;
  leads: HeatmapLead[];
  customColumns: string[];
  setCustomColumns: (cols: string[]) => void;
  removedLeads: Set<string>;
  onRemoveLead: (id: string) => void;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const rec = TIER_RECOMMENDATIONS[tier];
  const visibleLeads = leads.filter((l) => !removedLeads.has(l.id));

  if (visibleLeads.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Tier Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <PriorityBadge tier={tier} />
        <span className="text-xs text-muted-foreground">
          {visibleLeads.length} lead{visibleLeads.length !== 1 ? "s" : ""}
        </span>
        <span className="mx-2 text-muted-foreground/30">·</span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
          <Zap className="h-3 w-3" />
          {rec?.action}
        </span>
        <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">
          — {rec?.detail}
        </span>
      </button>

      {!collapsed && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Company</TableHead>
                <TableHead className="text-xs font-semibold text-center">Lead Score</TableHead>
                <TableHead className="text-xs font-semibold text-center">Recommended Action</TableHead>
                {customColumns.map((col, idx) => (
                  <TableHead key={`custom-${idx}`} className="text-xs text-center min-w-[120px]">
                    {col ? (
                      <span className="font-semibold text-foreground">{col}</span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center gap-1 text-muted-foreground/60 font-medium hover:text-muted-foreground transition-colors">
                            <Plus className="h-3 w-3" />
                            Add Column
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-44">
                          {COLUMN_OPTIONS.filter((opt) => !customColumns.includes(opt)).map((opt) => (
                            <DropdownMenuItem
                              key={opt}
                              className="text-xs cursor-pointer"
                              onClick={() => {
                                const updated = [...customColumns];
                                updated[idx] = opt;
                                setCustomColumns(updated);
                              }}
                            >
                              {opt}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableHead>
                ))}
                <TableHead className="text-xs font-semibold text-center">Actions</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLeads.map((lead) => (
                <TableRow key={lead.id} className="group">
                  <TableCell className="text-sm font-medium text-foreground">{lead.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{lead.company}</TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-bold text-foreground">{lead.totalScore}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`text-[10px] font-semibold ${rec?.color || ""}`}>
                      <Zap className="h-2.5 w-2.5 mr-1" />
                      {rec?.action}
                    </Badge>
                  </TableCell>
                  {customColumns.map((_, idx) => (
                    <TableCell key={`cell-${idx}`} className="text-center text-xs text-muted-foreground/40">—</TableCell>
                  ))}
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer">
                          <Megaphone className="h-3.5 w-3.5" /> Add to Campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer">
                          <Mail className="h-3.5 w-3.5" /> Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer">
                          <MessageSquare className="h-3.5 w-3.5" /> Ask Strategist
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveLead(lead.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

const StrategistLeadStream = () => {
  const [customColumns, setCustomColumns] = useState<string[]>(["", "", "", ""]);
  const [removedLeads, setRemovedLeads] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("strategistRemovedLeads");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleRemove = (id: string) => {
    const updated = new Set(removedLeads);
    updated.add(id);
    setRemovedLeads(updated);
    localStorage.setItem("strategistRemovedLeads", JSON.stringify([...updated]));
  };

  // Group leads by tier
  const tier1 = heatmapLeads.filter((l) => l.priority === "Tier 1");
  const tier2 = heatmapLeads.filter((l) => l.priority === "Tier 2");
  const tier3 = heatmapLeads.filter((l) => l.priority === "Tier 3");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Your Lead Stream
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Strategist mirrors Scout's leads with recommended actions per tier
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {heatmapLeads.length - removedLeads.size} active leads
        </span>
      </div>

      <TierGroup tier="Tier 1" leads={tier1} customColumns={customColumns} setCustomColumns={setCustomColumns} removedLeads={removedLeads} onRemoveLead={handleRemove} />
      <TierGroup tier="Tier 2" leads={tier2} customColumns={customColumns} setCustomColumns={setCustomColumns} removedLeads={removedLeads} onRemoveLead={handleRemove} />
      <TierGroup tier="Tier 3" leads={tier3} customColumns={customColumns} setCustomColumns={setCustomColumns} removedLeads={removedLeads} onRemoveLead={handleRemove} />
    </div>
  );
};

export default StrategistLeadStream;
