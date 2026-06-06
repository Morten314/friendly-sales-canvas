import {
  Check,
  X,
  Eye,
  Users,
  Target,
  RefreshCw,
  Plus,
  ArrowRight,
  Undo2,
  Shield,
  Lightbulb,
  Zap,
  MessageSquare,
} from "lucide-react";

import type { SuggestedICP, ICPCardStatus } from "../../types";

import { EditDropdownMenu } from "./EditDropdownMenu";
import { confidenceColor, hasBackendFullReport } from "./icpMapping";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

/** Renders backend GET /icp nested `report` payload (icp-research-style `data` object). */
const BackendProfilerReportView = ({ report }: { report: Record<string, unknown> }) => {
  const title = typeof report.title === "string" ? report.title : null;
  const isNew = report.is_new === true;
  const isAgentic = report.is_agentic === true;
  const whySuggested = Array.isArray(report.why_suggested)
    ? (report.why_suggested as string[])
    : Array.isArray(report.whySuggested)
      ? (report.whySuggested as string[])
      : [];
  const howItDiffers = Array.isArray(report.how_it_differs)
    ? (report.how_it_differs as string[])
    : Array.isArray(report.howItDiffers)
      ? (report.howItDiffers as string[])
      : [];
  const firmographics =
    report.firmographics && typeof report.firmographics === "object"
      ? (report.firmographics as Record<string, unknown>)
      : null;
  const keyDms = Array.isArray(report.key_decision_makers)
    ? (report.key_decision_makers as string[])
    : Array.isArray(report.keyDecisionMakers)
      ? (report.keyDecisionMakers as string[])
      : [];
  const painRaw = report.pain_points_and_triggers;
  const pain =
    painRaw && typeof painRaw === "object"
      ? (painRaw as { critical?: string; others?: string[] })
      : null;
  const competitors = Array.isArray(report.competitors) ? (report.competitors as string[]) : [];

  return (
    <div className="space-y-5">
      {(title || isNew || isAgentic) && (
        <div className="flex flex-wrap items-center gap-2">
          {title && <h4 className="text-sm font-semibold">{title}</h4>}
          {isNew && (
            <Badge variant="secondary" className="text-[10px]">
              New
            </Badge>
          )}
          {isAgentic && (
            <Badge variant="outline" className="text-[10px]">
              Agentic
            </Badge>
          )}
        </div>
      )}

      {whySuggested.length > 0 && (
        <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/10">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            Why This ICP Was Suggested
          </p>
          <ul className="space-y-1.5">
            {whySuggested.map((reason, idx) => (
              <li key={idx} className="text-xs flex items-start gap-2">
                <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {howItDiffers.length > 0 && (
        <div className="rounded-lg p-3 border border-amber-100 bg-amber-50/20">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
            How This Differs
          </p>
          <ul className="space-y-1.5">
            {howItDiffers.map((line, idx) => (
              <li key={idx} className="text-xs flex items-start gap-2">
                <RefreshCw className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {firmographics && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {typeof firmographics.industry === "string" && (
            <div>
              <p className="text-muted-foreground">Industry</p>
              <p className="font-medium">{firmographics.industry}</p>
            </div>
          )}
          {typeof firmographics.segment === "string" && (
            <div>
              <p className="text-muted-foreground">Segment</p>
              <p className="font-medium">{firmographics.segment}</p>
            </div>
          )}
          {(typeof firmographics.company_size === "string" ||
            typeof firmographics.companySize === "string") && (
            <div>
              <p className="text-muted-foreground">Company Size</p>
              <p className="font-medium">
                {(firmographics.company_size || firmographics.companySize) as string}
              </p>
            </div>
          )}
          {(typeof firmographics.market_size === "string" ||
            typeof firmographics.marketSize === "string") && (
            <div>
              <p className="text-muted-foreground">Market Size</p>
              <p className="font-medium">
                {(firmographics.market_size || firmographics.marketSize) as string}
              </p>
            </div>
          )}
        </div>
      )}

      {keyDms.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Users className="h-3 w-3" /> Key Decision Makers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {keyDms.map((dm, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {dm}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {pain && (pain.critical || (pain.others && pain.others.length > 0)) && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Target className="h-3 w-3" /> Pain Points & Triggers
          </p>
          {pain.critical && (
            <p className="text-xs font-medium bg-destructive/10 text-destructive p-2 rounded-md mb-2">
              {pain.critical}
            </p>
          )}
          {Array.isArray(pain.others) && pain.others.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pain.others.map((t, i) => (
                <Badge key={i} variant="outline" className="text-[11px]">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {competitors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Shield className="h-3 w-3" /> Competitors
          </p>
          <div className="flex flex-wrap gap-1.5">
            {competitors.map((c, i) => (
              <Badge key={i} variant="outline" className="text-[11px]">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Full report body: backend payload when present, else fields from the ICP card. */
const SuggestedICPFullReportBody = ({ icp }: { icp: SuggestedICP }) => {
  const fr = icp.fullReport;
  if (fr && typeof fr === "object" && Object.keys(fr).length > 0) {
    return <BackendProfilerReportView report={fr} />;
  }

  return (
    <>
      <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/10">
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" />
          Why This ICP Was Suggested
        </p>
        <ul className="space-y-1.5">
          {icp.whySuggested.map((reason, idx) => (
            <li key={idx} className="text-xs flex items-start gap-2">
              <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
        {icp.opportunityUnlocked && (
          <div className="mt-2 bg-primary/5 rounded p-2">
            <p className="text-[11px] font-medium text-primary">
              Opportunity: {icp.opportunityUnlocked}
            </p>
          </div>
        )}
      </div>

      <div
        className={`rounded-lg p-3 border ${icp.type === "refined" ? "border-amber-100 bg-amber-50/20" : "border-primary/10 bg-primary/[0.02]"}`}
      >
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
          {icp.type === "refined" ? "What Changed" : "How This Differs"}
        </p>
        {icp.type === "refined" && icp.whatChanged ? (
          <ul className="space-y-1.5">
            {icp.whatChanged.map((change, idx) => (
              <li key={idx} className="text-xs flex items-start gap-2">
                <RefreshCw className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                <span>{change}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs flex items-start gap-2">
              <Plus className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              <span>
                New segment: {icp.industry} — {icp.segment}
              </span>
            </p>
            <p className="text-xs flex items-start gap-2">
              <Users className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              <span>Buyers: {icp.decisionMakers.join(", ")}</span>
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Industry</p>
          <p className="font-medium">{icp.industry}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Segment</p>
          <p className="font-medium">{icp.segment}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Company Size</p>
          <p className="font-medium">{icp.companySize}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Market Size</p>
          <p className="font-medium">{icp.marketSize || "N/A"}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Users className="h-3 w-3" /> Key Decision Makers
        </p>
        <div className="flex flex-wrap gap-1.5">
          {icp.decisionMakers.map((dm, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {dm}
            </Badge>
          ))}
        </div>
      </div>

      {(icp.topPainPoint || (icp.buyingTriggers && icp.buyingTriggers.length > 0)) && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Target className="h-3 w-3" /> Pain Points & Triggers
          </p>
          {icp.topPainPoint && (
            <p className="text-xs font-medium bg-destructive/10 text-destructive p-2 rounded-md mb-2">
              {icp.topPainPoint}
            </p>
          )}
          {icp.buyingTriggers && (
            <div className="flex flex-wrap gap-1.5">
              {icp.buyingTriggers.map((t, i) => (
                <Badge key={i} variant="outline" className="text-[11px]">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {icp.competitors && icp.competitors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Shield className="h-3 w-3" /> Competitors
          </p>
          <div className="flex flex-wrap gap-1.5">
            {icp.competitors.map((c, i) => (
              <Badge key={i} variant="outline" className="text-[11px]">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

// ========== FULL REPORT CONTENT (used in Sheet at 80% width) ==========
interface RecommendedICPReportContentProps {
  icp: SuggestedICP;
  leadCount: number;
  status: ICPCardStatus;
  isSuggested: boolean;
  isAccepted: boolean;
  isRejected: boolean;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
  onViewProspects: () => void;
  onCloseReport?: () => void;
}

export const RecommendedICPReportContent = ({
  icp,
  leadCount,
  isSuggested,
  isAccepted,
  isRejected,
  onAccept,
  onReject,
  onUndo,
  onViewProspects,
}: RecommendedICPReportContentProps) => {
  const { toast } = useToast();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge
          variant="secondary"
          className={`text-xs ${icp.type === "refined" ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"}`}
        >
          {icp.type === "refined" ? "Refined" : "New"}
        </Badge>
        <div className="flex items-center gap-1">
          <EditDropdownMenu
            onModify={() =>
              toast({ title: "Edit mode", description: "You can now modify this report." })
            }
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80 gap-1 h-7 text-xs"
            onClick={() =>
              toast({ title: "Chat with Profiler", description: "Profiler agent chat opening..." })
            }
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Agentic
          </Button>
        </div>
      </div>

      <SuggestedICPFullReportBody icp={icp} />

      {isSuggested && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button size="sm" onClick={onAccept} className="flex-1">
            <Check className="h-3 w-3 mr-1" /> Accept
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
            <X className="h-3 w-3 mr-1" /> Reject
          </Button>
        </div>
      )}
      {(isAccepted || isRejected) && (
        <div className="pt-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            onClick={onUndo}
            className="w-full text-xs text-muted-foreground"
          >
            <Undo2 className="h-3 w-3 mr-1" /> Undo
          </Button>
        </div>
      )}

      <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs font-semibold text-foreground">View prospects</p>
            <p className="text-[11px] text-muted-foreground">
              See {leadCount} lead{leadCount !== 1 ? "s" : ""} for "{icp.name}" in Lead Stream
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onViewProspects}>
          Lead Stream <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

// ========== RECOMMENDED ICP CARD (View Full Report opens Sheet; cards stay fixed size) ==========
interface RecommendedICPCardProps {
  icp: SuggestedICP;
  leadCount: number;
  status: ICPCardStatus;
  isExpanded: boolean;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
  onToggleReport: () => void;
  onViewProspects: () => void;
}

export const RecommendedICPCard = ({
  icp,
  leadCount,
  status,
  isExpanded,
  onAccept,
  onReject,
  onUndo,
  onToggleReport,
}: RecommendedICPCardProps) => {
  const isAccepted = status.status === "accepted";
  const isRejected = status.status === "rejected";
  const isSuggested = status.status === "suggested";

  return (
    <div className="flex-shrink-0 min-w-[340px] max-w-[360px]">
      <Card
        className={`h-full transition-all duration-300 ${
          isAccepted
            ? "border-emerald-200 bg-emerald-50/30"
            : isRejected
              ? "opacity-50 border-muted"
              : ""
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <Badge
                variant="secondary"
                className={`text-xs mb-2 ${
                  icp.type === "refined"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {icp.type === "refined" ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refined ICP
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3 mr-1" />
                    New ICP
                  </>
                )}
              </Badge>
              <CardTitle className="text-base font-semibold truncate">{icp.name}</CardTitle>
              {icp.type === "refined" && icp.sourceICPName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Refined from: {icp.sourceICPName}
                </p>
              )}
              {icp.tag && icp.type === "new" && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {icp.tag}
                </Badge>
              )}
            </div>
            <Badge
              variant="outline"
              className={`text-xs shrink-0 ${confidenceColor(icp.confidenceScore)}`}
            >
              {icp.confidenceScore}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-3">
          {/* ICP Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Industry:</span>
              <p className="font-medium">{icp.industry}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Size:</span>
              <p className="font-medium">{icp.companySize}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Regions:</span>
              <p className="font-medium">{icp.regions.join(", ")}</p>
            </div>
            {icp.marketSize && (
              <div>
                <span className="text-muted-foreground">Market:</span>
                <p className="font-medium">
                  {icp.marketSize} {icp.growth && `(${icp.growth})`}
                </p>
              </div>
            )}
            <div className="col-span-2 flex items-center gap-1.5 text-primary">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span className="text-muted-foreground">Lead Stream:</span>
              <span className="font-semibold">
                {leadCount} lead{leadCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {hasBackendFullReport(icp) && (
            <p className="text-xs text-muted-foreground border border-dashed border-primary/25 rounded-md px-2 py-2 bg-muted/30">
              Detailed report from Profiler opens when you click{" "}
              <span className="font-medium text-foreground">View Full Report</span>.
            </p>
          )}

          {/* Why Suggested — hidden when backend sent a full report blob (shown only in expanded report) */}
          {!hasBackendFullReport(icp) && icp.whySuggested.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Why Suggested</p>
              <ul className="space-y-1">
                {icp.whySuggested.slice(0, 3).map((reason, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-1.5">
                    <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasBackendFullReport(icp) && icp.type === "refined" && icp.whatChanged && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">What Changed</p>
              <ul className="space-y-1">
                {icp.whatChanged.map((c, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-1.5">
                    <RefreshCw className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasBackendFullReport(icp) && icp.type === "new" && icp.opportunityUnlocked && (
            <div className="bg-primary/5 rounded-md p-2">
              <p className="text-xs font-medium text-primary mb-0.5">Opportunity Unlocked</p>
              <p className="text-xs">{icp.opportunityUnlocked}</p>
            </div>
          )}

          {/* Status badges */}
          {isAccepted && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100 rounded-md p-2">
              <Check className="h-3 w-3" />
              <span>Added to Customer Profile</span>
            </div>
          )}
          {isRejected && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-md p-2">
              <X className="h-3 w-3" />
              <span>Dismissed</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-3 border-t flex flex-col gap-2">
          {/* Accept / Reject */}
          {/* View Full Report — expand/collapse */}
          <Button
            size="sm"
            variant={isExpanded ? "secondary" : "outline"}
            onClick={onToggleReport}
            className="w-full"
          >
            {isExpanded ? (
              <>
                <X className="h-3 w-3 mr-1" />
                Close Report
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 mr-1" />
                View Full Report
              </>
            )}
          </Button>
          {isSuggested && (
            <div className="flex items-center gap-2 w-full">
              <Button size="sm" onClick={onAccept} className="flex-1">
                <Check className="h-3 w-3 mr-1" />
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          )}
          {(isAccepted || isRejected) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onUndo}
              className="w-full text-xs text-muted-foreground"
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Undo
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};
