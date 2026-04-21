import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown, ChevronRight, MoreVertical, Zap, Sparkles, FileText,
  MessageSquare, RefreshCw, Send, Users,
} from "lucide-react";
import StrategistSyncBreadcrumbs from "./StrategistSyncBreadcrumbs";
import StrategistWhatsNewBanner from "./StrategistWhatsNewBanner";
import { strategyCohorts, type StrategyCohort, type Confidence } from "./cohortData";

const confidenceStyles: Record<Confidence, string> = {
  High: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  Medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  Low: "bg-muted text-muted-foreground border-border",
};

const cohortAccent: Record<string, string> = {
  "strike-now": "border-l-2 border-l-emerald-500",
  "nurture": "border-l-2 border-l-amber-500",
  "educate": "border-l-2 border-l-muted-foreground/30",
};

const CohortRow = ({ cohort }: { cohort: StrategyCohort }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const handleLaunch = () => {
    try {
      sessionStorage.setItem(
        "strategistContext",
        JSON.stringify({
          leads: cohort.leads.map((l) => ({
            name: l.name,
            company: l.company,
            jobTitle: "",
            source: l.origin,
          })),
          opportunity: cohort.play,
          icp: cohort.signalSource,
          triggerPrompt: `Generate ${cohort.play} strategy for the ${cohort.label} cohort (${cohort.leads.length} leads).`,
        })
      );
      navigate("/your-ai-team/strategist/workspace?from=cohort");
      // Force remount with context
      window.location.reload();
    } catch {
      // ignore
    }
  };

  return (
    <>
      <TableRow className={`group hover:bg-muted/30 ${cohortAccent[cohort.id]}`}>
        <TableCell className="py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-start gap-2 text-left"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{cohort.emoji}</span>
                <span className="text-sm font-semibold text-foreground">{cohort.label}</span>
                {cohort.isNew && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 bg-primary/10 text-primary border-primary/30">
                    NEW
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                {cohort.description}
              </p>
            </div>
          </button>
        </TableCell>
        <TableCell className="py-3">
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">{cohort.leads.length}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {cohort.sources.map((s) => (
              <span
                key={s}
                className="text-[9px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        </TableCell>
        <TableCell className="py-3">
          <span className="text-xs font-medium text-foreground">{cohort.play}</span>
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
            {cohort.signalSource}
          </p>
        </TableCell>
        <TableCell className="py-3 text-center">
          <Badge variant="outline" className={`text-[10px] font-semibold ${confidenceStyles[cohort.confidence]}`}>
            {cohort.confidence}
          </Badge>
        </TableCell>
        <TableCell className="py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={handleLaunch}
            >
              <Zap className="h-3 w-3" />
              {cohort.primaryAction}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-xs gap-2 cursor-pointer">
                  <RefreshCw className="h-3.5 w-3.5" /> Refine Strategy
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2 cursor-pointer" onClick={() => setExpanded(true)}>
                  <Users className="h-3.5 w-3.5" /> View Leads
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2 cursor-pointer">
                  <Send className="h-3.5 w-3.5" /> Send to Artefacts
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2 cursor-pointer">
                  <MessageSquare className="h-3.5 w-3.5" /> Ask Strategist
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={5} className="py-3">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-foreground">Strategy reasoning</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{cohort.playRationale}</p>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  Leads in this cohort ({cohort.leads.length})
                </p>
                <div className="border rounded-md overflow-hidden bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] h-7">Name</TableHead>
                        <TableHead className="text-[10px] h-7">Company</TableHead>
                        <TableHead className="text-[10px] h-7 text-center">Score</TableHead>
                        <TableHead className="text-[10px] h-7 text-center">ICP Fit</TableHead>
                        <TableHead className="text-[10px] h-7 text-center">Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cohort.leads.slice(0, 8).map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="text-[11px] py-1.5 font-medium">{lead.name}</TableCell>
                          <TableCell className="text-[11px] py-1.5 text-muted-foreground">{lead.company}</TableCell>
                          <TableCell className="text-[11px] py-1.5 text-center font-semibold">{lead.totalScore}</TableCell>
                          <TableCell className="text-[11px] py-1.5 text-center">
                            <span className="font-medium">{lead.icpFit}%</span>
                          </TableCell>
                          <TableCell className="text-[11px] py-1.5 text-center">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {lead.origin}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {cohort.leads.length > 8 && (
                    <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t bg-muted/20">
                      + {cohort.leads.length - 8} more leads
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

const StrategistCohortTable = () => {
  return (
    <div className="space-y-4 px-4 py-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Strategy Cohorts
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pre-built plays grouped by urgency × opportunity. Drawn from Scout, Profiler, and Mission Control.
            </p>
          </div>
        </div>
        <StrategistSyncBreadcrumbs />
      </div>

      <StrategistWhatsNewBanner />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-semibold w-[28%]">Cohort</TableHead>
              <TableHead className="text-[11px] font-semibold w-[14%]">Leads</TableHead>
              <TableHead className="text-[11px] font-semibold w-[28%]">Play & Signal</TableHead>
              <TableHead className="text-[11px] font-semibold text-center w-[12%]">Confidence</TableHead>
              <TableHead className="text-[11px] font-semibold text-right w-[18%]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {strategyCohorts.map((cohort) => (
              <CohortRow key={cohort.id} cohort={cohort} />
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default StrategistCohortTable;
