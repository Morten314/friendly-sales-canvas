import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronDown, ChevronRight, Sparkles, Users, Target, TrendingUp,
} from "lucide-react";

import StrategistSyncBreadcrumbs from "./StrategistSyncBreadcrumbs";
import StrategistWhatsNewBanner from "./StrategistWhatsNewBanner";
import ImmediateActionDirectives from "./ImmediateActionDirectives";
import { strategyCohorts, type StrategyCohort, type Confidence } from "./cohortData";
import CohortExpandedRow from "./CohortExpandedRow";

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
      window.location.reload();
    } catch {
      // ignore
    }
  };

  return (
    <>
      <TableRow
        className={`group hover:bg-muted/30 cursor-pointer ${cohortAccent[cohort.id]}`}
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="py-3">
          <div className="flex items-start gap-2 text-left">
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
          </div>
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
        <TableCell className="py-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-bold text-foreground">{cohort.avgScore}</span>
          </div>
        </TableCell>
        <TableCell className="py-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <Target className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-bold text-foreground">{cohort.icpFitAvg}%</span>
          </div>
        </TableCell>
      </TableRow>
      {expanded && <CohortExpandedRow cohort={cohort} onLaunch={handleLaunch} />}
    </>
  );
};

const StrategistCohortTable = () => {
  return (
    <div className="space-y-4 px-4 py-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Strategy Cohorts
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cohort-level plays based on urgency and opportunity.
            </p>
          </div>
        </div>
        <StrategistSyncBreadcrumbs />
      </div>

      <StrategistWhatsNewBanner />

      <ImmediateActionDirectives />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-semibold w-[28%]">Cohort</TableHead>
              <TableHead className="text-[11px] font-semibold w-[14%]">Leads</TableHead>
              <TableHead className="text-[11px] font-semibold w-[32%]">Play & Signal</TableHead>
              <TableHead className="text-[11px] font-semibold text-center w-[12%]">Confidence</TableHead>
              <TableHead className="text-[11px] font-semibold text-center w-[7%]">Score</TableHead>
              <TableHead className="text-[11px] font-semibold text-center w-[7%]">ICP Fit</TableHead>
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
