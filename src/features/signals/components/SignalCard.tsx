import {
  Bot,
  MessageCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Download,
  Share2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { SignalLeadMapLead } from "../contracts";
import { buildAggregateOutreachPlan } from "../lib/aggregateOutreachPlan";
import type { LeadEdit, SignalLeadEdits } from "../lib/leadEdits";
import type { Agent, NBAItem, SignalCard as SignalCardType } from "../types";

import { sanitizeSourceUrl } from "./signalCards";
import CohortOutreachPreview from "./CohortOutreachPreview";
import MatchedLeadsTable from "./MatchedLeadsTable";
import RecommendationAnswerView from "./RecommendationAnswerView";
import { leadsForRecommendation } from "../lib/recommendationLeads";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { sanitizeAnswerText } from "@/shared/lib/sanitizeAnswerText";

interface SignalCardProps {
  signal: SignalCardType;
  /** Whether this signal is currently accepted (page computes via acceptedSignals.has(contentHash)). */
  isAccepted: boolean;
  /** Renders the Scout/Profiler badge for the signal's agent. */
  getAgentBadge: (agent: Agent) => ReactNode;
  /** Whether this signal's description is expanded (page-held expandedDescriptions set). */
  isDescriptionExpanded: boolean;
  /** Which recommendation (by index) of this signal is expanded, or null. */
  expandedRecommendationIndex: number | null;
  /** Cached answers for each recommendation, keyed `${signalId}-${index}`. */
  recommendationAnswers: Record<string, string>;
  /** Key of the recommendation currently loading an answer, or null. */
  recommendationAnswerLoading: string | null;
  /** Keys of answers currently expanded to full view (`${signalId}-${index}`). */
  answerExpandedKeys: Set<string>;
  onAccept: (signalId: string) => void;
  onReject: (signalId: string) => void;
  onBotIconClick: (signal: SignalCardType) => void;
  onNavigateToAgentChat: (
    signal: SignalCardType,
    recommendation: string,
    prompt: string,
    answer?: string,
  ) => void;
  onExpandDescription: () => void;
  onCollapseDescription: () => void;
  onToggleRecommendation: (index: number) => void;
  onExpandAnswer: (key: string) => void;
  onCollapseAnswer: (key: string) => void;
  affectedLeadCount?: number;
  /** Matched leads for this signal (from leadsForSignal(signal.id)). */
  matchedLeads: SignalLeadMapLead[];
  /** Org-level map fetch state (drives the four-state leads section). */
  leadsLoading: boolean;
  /** Org-level map refetch in flight (recompute/retry) — shows the in-flight spinner. */
  leadsFetching?: boolean;
  leadsError: boolean;
  /** Page-held: whether this card's leads section is open. */
  isLeadsExpanded: boolean;
  /** Toggle the leads section, or show the lock message when not accepted. */
  onFindMatchedLeads: () => void;
  /** Build + download + deliver the briefing. */
  onSaveAsArtefact: () => void;
  /** Download the matched-leads CSV + summary PDF for this signal. */
  onDownloadCsv: () => void;
  /** Share the CSV + PDF via the chosen mail service. */
  onShare: (provider: "gmail" | "outlook") => void;
  /** Offered in the error state; wraps the page's refreshLeadMap (forces a server recompute). */
  onRecomputeLeadMap?: () => void;
  /** Offered in the error state; plain re-fetch of the mapping (the "Try again" escape). */
  onRetryLeadMap?: () => void;
  /** Build + generate + deliver the recommendation playbook for `index`. */
  onSaveRecommendationAsArtefact: (index: number) => void;
  /** Page-held `${signalId}-${index}` currently generating a playbook, or null. */
  recommendationArtefactGeneratingKey: string | null;
  /** Page-held `${signalId}-${index}` whose last generation failed (drives the inline error). */
  recommendationArtefactErrorKey: string | null;
  /** Leads the user marked "not a fit" for this signal (restorable chips). */
  dismissedLeads?: SignalLeadMapLead[];
  /** Per-lead overrides for this signal (drives the "edited" mark + dismiss reasons). */
  leadEdits?: SignalLeadEdits;
  /** Persist a field correction (name/title/company/relevance/why) for one lead. */
  onEditLead?: (leadId: string, patch: LeadEdit) => void;
  onDismissLead?: (leadId: string, reason: string) => void;
  onRestoreLead?: (leadId: string) => void;
  onRestoreAllLeads?: () => void;
}

export const SignalCard = ({
  signal,
  isAccepted,
  getAgentBadge,
  isDescriptionExpanded,
  expandedRecommendationIndex,
  recommendationAnswers,
  recommendationAnswerLoading,
  answerExpandedKeys,
  onAccept,
  onReject,
  onBotIconClick,
  onNavigateToAgentChat,
  onExpandDescription,
  onCollapseDescription,
  onToggleRecommendation,
  onExpandAnswer,
  onCollapseAnswer,
  affectedLeadCount,
  matchedLeads,
  leadsLoading,
  leadsFetching,
  leadsError,
  isLeadsExpanded,
  onFindMatchedLeads,
  onSaveAsArtefact,
  onDownloadCsv,
  onShare,
  onRecomputeLeadMap,
  onRetryLeadMap,
  onSaveRecommendationAsArtefact,
  recommendationArtefactGeneratingKey,
  recommendationArtefactErrorKey,
  dismissedLeads,
  leadEdits,
  onEditLead,
  onDismissLead,
  onRestoreLead,
  onRestoreAllLeads,
}: SignalCardProps) => {
  const [showLockMessage, setShowLockMessage] = useState(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLockTimer = () => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  };

  const [artefactHint, setArtefactHint] = useState<string | null>(null);
  /** Cohort label whose outreach-plan preview is expanded, or null. */
  const [expandedCohort, setExpandedCohort] = useState<string | null>(null);
  const artefactHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearArtefactHintTimer = () => {
    if (artefactHintTimerRef.current) {
      clearTimeout(artefactHintTimerRef.current);
      artefactHintTimerRef.current = null;
    }
  };

  // Collapsing "What this means" only tears down the artefact hint. The lock
  // message now belongs to the resting card (leads live outside this branch).
  useEffect(() => {
    if (!isDescriptionExpanded) {
      clearArtefactHintTimer();
      setArtefactHint(null);
    }
  }, [isDescriptionExpanded]);
  // Clear the lock message immediately when the signal is accepted (Spec §3).
  useEffect(() => {
    if (isAccepted) {
      clearLockTimer();
      setShowLockMessage(false);
    }
  }, [isAccepted]);
  useEffect(
    () => () => {
      clearLockTimer();
      clearArtefactHintTimer();
    },
    [],
  );

  const handleFindClick = () => {
    if (!isAccepted) {
      // Functionally enabled (not native disabled) so it can explain itself.
      clearLockTimer();
      setShowLockMessage(true);
      lockTimerRef.current = setTimeout(() => setShowLockMessage(false), 3000);
      return;
    }
    setShowLockMessage(false);
    clearLockTimer();
    onFindMatchedLeads();
  };

  // "Go deeper" is the superset view: it carries the signal blurb, the
  // reasoning, and the same matched-leads + next-steps block, so a deep user
  // never has to open the fast path separately.
  const handleGoDeeperClick = () => {
    if (isDescriptionExpanded) {
      onCollapseDescription();
      return;
    }
    onExpandDescription();
    if (isAccepted && !isLeadsExpanded) {
      onFindMatchedLeads();
    }
  };

  const showArtefactHint = (msg: string) => {
    clearArtefactHintTimer();
    setArtefactHint(msg);
    artefactHintTimerRef.current = setTimeout(() => setArtefactHint(null), 3000);
  };

  // Gated click: explain when locked, otherwise delegate to the page (D-2/D-6).
  const handleSaveArtefactClick = (index: number) => {
    const key = `${signal.id}-${index}`;
    if (!isAccepted) {
      showArtefactHint("Accept this signal to save as artifact");
      return;
    }
    if ((recommendationAnswers[key] ?? "").trim() === "") {
      showArtefactHint("Load the recommendation answer first.");
      return;
    }
    clearArtefactHintTimer();
    setArtefactHint(null);
    onSaveRecommendationAsArtefact(index);
  };

  // Importance cue for the resting card: how many leads, how many are high relevance.
  const highRelevanceCount = matchedLeads.filter((l) => l.relevance === "high").length;

  // One-line "what to do with these leads". The reasoned version lives behind
  // "What this means" — it is deliberately not duplicated here.
  const suggestedAction =
    signal.NBAs && signal.NBAs.length > 0
      ? signal.NBAs[0].nba
      : (signal.nextBestMoves?.[0] ?? "");

  // Recommendations list (deep-dive, on hold). The description now lives inside
  // the matched-leads block; this toggle carries recommendations only.
  const recommendationsList: NBAItem[] =
    signal.NBAs && signal.NBAs.length > 0
      ? signal.NBAs
      : (signal.nextBestMoves || []).map((m) => ({ nba: m, prompt: "" }));
  const hasRecommendations = recommendationsList.length > 0;

  // Aggregated plan shown under the table (replaces a per-row "what" column).
  const outreachPlan = buildAggregateOutreachPlan(matchedLeads, suggestedAction);

  // The signal blurb + its citations. Lives in "Go deeper" only.
  const whatThisMeansBlock: ReactNode = signal.description ? (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        What this means
      </h4>
      <p className="text-sm leading-relaxed text-gray-700">{signal.description}</p>
      {Array.isArray(signal.source) && signal.source.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {signal.source.map((src, idx) => {
            const label = src.citation || src.url || "Source";
            const safeUrl = sanitizeSourceUrl(src.url);
            return safeUrl ? (
              <a
                key={idx}
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-fit"
              >
                <Badge
                  variant="secondary"
                  className="text-xs font-normal hover:bg-gray-300 cursor-pointer max-w-full text-left"
                >
                  {label}
                </Badge>
              </a>
            ) : (
              <Badge key={idx} variant="secondary" className="text-xs font-normal w-fit">
                {label}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  ) : null;

  // Who (the table) → What now (the outreach plan). Shared by the fast path
  // and by "Go deeper".
  const leadsBody: ReactNode = (
    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* === Who — Matched leads === */}
      <div className="px-3 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Matched leads
          </h4>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-gray-600 hover:text-gray-900"
            onClick={onFindMatchedLeads}
          >
            <ChevronUp className="mr-1 h-3 w-3" />
            Hide table
          </Button>
        </div>
        {leadsLoading || leadsFetching ? (
          <div className="flex items-center gap-2 py-3 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Finding matched leads…</span>
          </div>
        ) : leadsError ? (
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm text-red-600">Could not load matched leads.</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onRetryLeadMap?.()}>
                Try again
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onRecomputeLeadMap?.()}>
                Recompute lead mapping
              </Button>
            </div>
          </div>
        ) : matchedLeads.length === 0 ? (
          <p className="py-2 text-sm text-gray-500">
            No matched leads found for this signal yet.
          </p>
        ) : (
          <MatchedLeadsTable
            leads={matchedLeads}
            dismissedLeads={dismissedLeads}
            edits={leadEdits}
            onEditLead={onEditLead}
            onDismissLead={onDismissLead}
            onRestoreLead={onRestoreLead}
            onRestoreAll={onRestoreAllLeads}
          />
        )}
      </div>

      {/* === What now — Next steps === */}
      {outreachPlan && matchedLeads.length > 0 && (
        <div className="mt-3 border-t border-gray-100 px-3 pt-3">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Next steps
          </h4>
          <div className="space-y-2">
            {outreachPlan.steps.map((step) => (
              <div
                key={step.label}
                className="rounded-md border border-gray-200 bg-gray-50/50 p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs font-medium text-gray-900">{step.label}</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                        {step.timing}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-gray-600">{step.move}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7 px-2 text-[11px] border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"
                    onClick={() =>
                      setExpandedCohort((cur) => (cur === step.label ? null : step.label))
                    }
                  >
                    {expandedCohort === step.label ? (
                      <ChevronUp className="h-3 w-3 mr-1" />
                    ) : (
                      <ChevronDown className="h-3 w-3 mr-1" />
                    )}
                    Preview outreach plan
                  </Button>
                </div>
                {expandedCohort === step.label && (
                  <CohortOutreachPreview
                    signalId={signal.id}
                    headline={signal.headline}
                    snippet={signal.snippet}
                    step={step}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === Block actions — collective dispatch + persist + download === */}
      {matchedLeads.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 px-3 py-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Share2 className="h-3.5 w-3.5 mr-1.5" />
                Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => onShare("outlook")}>Outlook</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShare("gmail")}>Gmail</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onDownloadCsv}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onSaveAsArtefact}>
            Save as Artefact
          </Button>
        </div>
      )}
    </div>
  );

  // Fast path shows the leads block on its own; when "Go deeper" is open it is
  // rendered inside that superset block instead (no duplication).
  const leadsSection: ReactNode = isLeadsExpanded && !isDescriptionExpanded ? leadsBody : null;

  return (
    <div className="space-y-0">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-lg transition-all duration-200">
        {/* Card Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {getAgentBadge(signal.agent)}
            <span className="text-sm text-gray-500">•</span>
            <span className="text-sm text-gray-500">{signal.timestamp}</span>
            {isAccepted && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                Accepted
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 ${
                isAccepted
                  ? "text-green-600 bg-green-50"
                  : "text-gray-500 hover:text-green-600 hover:bg-green-50"
              }`}
              aria-label={isAccepted ? "Unaccept signal" : "Accept signal"}
              onClick={(e) => {
                e.stopPropagation();
                void onAccept(signal.id);
              }}
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
              aria-label="Reject signal"
              onClick={(e) => {
                e.stopPropagation();
                onReject(signal.id);
              }}
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
              onClick={(e) => {
                e.stopPropagation();
                onBotIconClick(signal);
              }}
              title={signal.agent === "scout" ? "Chat with Scout" : "Chat with Profiler"}
            >
              <Bot className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Card Body */}
        <div className="mb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold text-gray-900">{signal.headline}</h3>
                {/* <div className="flex items-center gap-3">
                           <button
                             className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                             onClick={() => toast({
                               title: "Added",
                               description: "This insight will be included in your weekly digest and sent to your registered email.",
                               duration: 3000,
                             })}
                           >
                             ➕ Add to my Weekly Digest
                           </button>
                           <button
                             className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md text-gray-700 flex items-center gap-1"
                             onClick={() => handleAction(signal.id, 'ask')}
                           >
                             💬 Discuss with Agent
                           </button>
                         </div> */}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed mb-2">{signal.snippet}</p>
              {/* Layer 1: importance cue + the primary action, available on the
                  resting card so acting never requires opening the explanation. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-disabled={!isAccepted}
                  className={
                    isAccepted
                      ? "text-sm border-green-600 text-green-700 hover:bg-green-50"
                      : "text-sm border-gray-300 text-gray-400 cursor-not-allowed"
                  }
                  onClick={handleFindClick}
                >
                  {isLeadsExpanded ? "Hide matched leads" : "Find matched leads"}
                </Button>
                {!isAccepted && (affectedLeadCount || matchedLeads.length) > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-700 border-gray-200 text-xs font-normal"
                  >
                    Affects{" "}
                    <span className="font-semibold">{affectedLeadCount || matchedLeads.length}</span>{" "}
                    {(affectedLeadCount || matchedLeads.length) === 1 ? "lead" : "leads"}
                  </Badge>
                )}
                {isAccepted && matchedLeads.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-700 border-gray-200 text-xs font-normal"
                  >
                    {matchedLeads.length} {matchedLeads.length === 1 ? "lead" : "leads"}
                    {highRelevanceCount > 0 ? ` · ${highRelevanceCount} high` : ""}
                  </Badge>
                )}
                {hasRecommendations && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    onClick={handleGoDeeperClick}
                  >
                    {isDescriptionExpanded ? (
                      <>
                        Hide the reasoning
                        <ChevronUp className="ml-1 h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        Go deeper
                        <ChevronDown className="ml-1 h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                )}
              </div>
              {showLockMessage && (
                <p role="status" className="mt-2 text-xs text-amber-700">
                  Accept this signal to unlock matched leads
                </p>
              )}
              {leadsSection}
              {/* Recommendations deep-dive (on hold). The description + citations now
                  live inside the matched-leads block; this toggle carries the
                  recommendation list + answer view only. */}
              {hasRecommendations && isDescriptionExpanded && (
                <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                  {whatThisMeansBlock}
                  {
                    <>
                      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        The reasoning
                      </h4>
                      <p className="mb-3 text-xs text-gray-500">
                        Each recommendation below is tied to the matched leads it applies to.
                      </p>
                      {/* Recommendations - click to show corresponding prompt */}
                      {(() => {
                        const recommendationsList: NBAItem[] =
                          signal.NBAs && signal.NBAs.length > 0
                            ? signal.NBAs
                            : (signal.nextBestMoves || []).map((m) => ({
                                nba: m,
                                prompt: "",
                              }));
                        if (recommendationsList.length === 0) return null;
                        return (
                          <div className="space-y-2">
                            <div className="space-y-2">
                              {recommendationsList.map((item, index) => {
                                const isExpanded = expandedRecommendationIndex === index;
                                const hasPrompt = (item.prompt ?? "").trim() !== "";
                                const artefactKey = `${signal.id}-${index}`;
                                const answerCached =
                                  (recommendationAnswers[artefactKey] ?? "").trim() !== "";
                                const isGeneratingArtefact =
                                  recommendationArtefactGeneratingKey === artefactKey;
                                const showArtefactError =
                                  recommendationArtefactErrorKey === artefactKey;
                                const canSaveArtefact = isAccepted && answerCached;
                                const link = leadsForRecommendation(item.nba, matchedLeads, index);
                                return (
                                  <div
                                    key={index}
                                    className="rounded-lg border border-gray-100 overflow-hidden"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onToggleRecommendation(index);
                                      }}
                                      className={`w-full flex items-start gap-2 p-2.5 text-left cursor-pointer transition-colors ${
                                        isExpanded
                                          ? "bg-blue-50/50 border-blue-200"
                                          : "bg-gray-50 hover:border-blue-200 hover:bg-blue-50/30"
                                      }`}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm text-gray-700">{item.nba}</p>
                                        {link.leads.length > 0 && (
                                          <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-600 border border-gray-200">
                                            Applies to {link.leads.length}{" "}
                                            {link.leads.length === 1 ? "lead" : "leads"}
                                            {link.basis === "tier" && link.tierLabel
                                              ? ` · ${link.tierLabel}`
                                              : ""}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                    {isExpanded && (
                                      <div className="px-3 pb-3 pt-1 border-t border-gray-100">
                                        {link.leads.length > 0 && (
                                          <div className="mb-2 rounded-md border border-gray-200 bg-white p-2">
                                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                              Leads this applies to
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                              {link.leads.map((lead) => (
                                                <span
                                                  key={lead.lead_id}
                                                  title={lead.why}
                                                  className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700"
                                                >
                                                  {lead.name || lead.company || lead.lead_id}
                                                  {lead.company && lead.name
                                                    ? ` · ${lead.company}`
                                                    : ""}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        <div className="p-3 rounded-lg bg-gradient-to-br from-slate-50 to-blue-50/50 border border-slate-200 space-y-3">
                                          <p className="text-sm text-slate-700 leading-relaxed font-semibold">
                                            {hasPrompt
                                              ? "Review the answer below. If this signal and its recommendations are relevant to you, accept it. Need more clarity? Chat with the agent to explore further."
                                              : "If this signal and its recommendations are relevant to you, accept it. Need more clarity? Chat with the agent to explore further."}
                                          </p>
                                          {hasPrompt && (
                                            <div className="rounded-md bg-white/80 border border-slate-200 p-2.5">
                                              <p className="text-xs font-medium text-slate-600 mb-1.5">
                                                Answer
                                              </p>
                                              {recommendationAnswerLoading ===
                                              `${signal.id}-${index}` ? (
                                                <div className="flex items-center gap-2 py-4 text-slate-500">
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                  <span className="text-sm">Loading answer...</span>
                                                </div>
                                              ) : (
                                                <>
                                                  <div className="relative">
                                                    <div
                                                      className={`pr-1 ${
                                                        answerExpandedKeys.has(
                                                          `${signal.id}-${index}`,
                                                        )
                                                          ? ""
                                                          : "max-h-72 overflow-hidden"
                                                      }`}
                                                    >
                                                      <RecommendationAnswerView
                                                        answer={
                                                          recommendationAnswers[
                                                            `${signal.id}-${index}`
                                                          ] ?? item.prompt
                                                        }
                                                      />
                                                    </div>
                                                    {!answerExpandedKeys.has(
                                                      `${signal.id}-${index}`,
                                                    ) && (
                                                      <>
                                                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          className="mt-1.5 h-7 px-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 -ml-2"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            onExpandAnswer(`${signal.id}-${index}`);
                                                          }}
                                                        >
                                                          Show more
                                                          <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                                                        </Button>
                                                      </>
                                                    )}
                                                  </div>
                                                  {answerExpandedKeys.has(
                                                    `${signal.id}-${index}`,
                                                  ) && (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="mt-1 h-7 px-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 -ml-2"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCollapseAnswer(`${signal.id}-${index}`);
                                                      }}
                                                    >
                                                      Show less
                                                      <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                                                    </Button>
                                                  )}
                                                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200">
                                                    <div className="flex items-center gap-2">
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={`h-8 w-8 p-0 ${
                                                          isAccepted
                                                            ? "text-green-600 bg-green-50"
                                                            : "text-slate-500 hover:text-green-600 hover:bg-green-50"
                                                        }`}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          void onAccept(signal.id);
                                                        }}
                                                        title={
                                                          isAccepted ? "Accepted" : "Accept signal"
                                                        }
                                                      >
                                                        <ThumbsUp className="h-4 w-4" />
                                                      </Button>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          onReject(signal.id);
                                                        }}
                                                        title="Reject signal"
                                                      >
                                                        <ThumbsDown className="h-4 w-4" />
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        role="button"
                                                        aria-disabled={
                                                          !canSaveArtefact || isGeneratingArtefact
                                                        }
                                                        className={
                                                          canSaveArtefact
                                                            ? "text-xs font-medium h-8 border-gray-300 text-gray-700 hover:bg-gray-50"
                                                            : "text-xs font-medium h-8 border-gray-300 text-gray-400 cursor-not-allowed"
                                                        }
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (isGeneratingArtefact) return;
                                                          handleSaveArtefactClick(index);
                                                        }}
                                                      >
                                                        {isGeneratingArtefact ? (
                                                          <>
                                                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                                            Generating…
                                                          </>
                                                        ) : (
                                                          "Save as Artifact"
                                                        )}
                                                      </Button>
                                                    </div>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="text-xs font-medium h-8 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        onNavigateToAgentChat(
                                                          signal,
                                                          item.nba,
                                                          item.prompt ?? "",
                                                          recommendationAnswers[
                                                            `${signal.id}-${index}`
                                                          ],
                                                        );
                                                      }}
                                                    >
                                                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                                                      {signal.agent === "scout"
                                                        ? "Chat with Scout"
                                                        : "Chat with Profiler"}
                                                    </Button>
                                                  </div>
                                                  {artefactHint && (
                                                    <p
                                                      role="status"
                                                      className="mt-2 text-xs text-amber-700"
                                                    >
                                                      {artefactHint}
                                                    </p>
                                                  )}
                                                  {showArtefactError && (
                                                    <p
                                                      role="alert"
                                                      className="mt-2 text-xs text-red-600"
                                                    >
                                                      Could not generate artifact — please try
                                                      again.
                                                    </p>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                  </>
                  }
                  {/* Deep users get the same leads + next steps in-place. */}
                  {isLeadsExpanded && leadsBody}
                </div>
              )}
              </div>
          </div>
        </div>

        {/* Card Actions */}
        {/* <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300" onClick={() => handleAction(signal.id, 'save')}>
                    <Bookmark className="h-4 w-4 mr-1" />
                    Save for Later
                  </Button>
                </div> */}
      </div>
    </div>
  );
};
