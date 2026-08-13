import {
  Bot,
  MessageCircle,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { SignalLeadMapLead } from "../contracts";
import { buildAggregateOutreachPlan } from "../lib/aggregateOutreachPlan";
import { SIGNAL_PREVIEW_COLUMNS, toSignalPreviewRow } from "../lib/matchedLeadsCsv";
import type { Agent, NBAItem, SignalCard as SignalCardType } from "../types";

import { sanitizeSourceUrl } from "./signalCards";
import RecommendationAnswerView from "./RecommendationAnswerView";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Inline "Why" text: the first complete sentence, so the cell stays short but is
 * never cut mid-word. The full rationale opens from the adjacent "i".
 */
const shortWhy = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length <= 120) return trimmed;
  const match = trimmed.match(/^[\s\S]*?[.!?](\s|$)/);
  const first = match?.[0]?.trim();
  if (first && first.length <= 160) return first;
  return `${trimmed.slice(0, 117).trimEnd()}…`;
};
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
  /** Download the matched-leads CSV for this signal. */
  onDownloadCsv: () => void;
  /** Download the signal summary PDF. */
  /** Save the matched-leads sheet to Artefacts as an editable file. */
  onSaveCsvAsArtefact: () => void;
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
  onSaveCsvAsArtefact,
  onRecomputeLeadMap,
  onRetryLeadMap,
  onSaveRecommendationAsArtefact,
  recommendationArtefactGeneratingKey,
  recommendationArtefactErrorKey,
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
  const artefactHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearArtefactHintTimer = () => {
    if (artefactHintTimerRef.current) {
      clearTimeout(artefactHintTimerRef.current);
      artefactHintTimerRef.current = null;
    }
  };

  // Collapsing "Why this matters" only tears down the artefact hint. The lock
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
  // "Why this matters" — it is deliberately not duplicated here.
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

  // One block, three labelled layers — Who (the table) → Why (the explanation)
  // → What now (the outreach plan). Opens together when matched leads are shown.
  const leadsSection: ReactNode = isLeadsExpanded ? (
    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* === Who — Matched leads === */}
      <div className="px-3 pt-3">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Matched leads
        </h4>
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
          <div className="overflow-hidden rounded-md border border-gray-200">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full table-fixed border-collapse text-[11px]">
                <colgroup>
                  <col className="w-[160px]" />
                  <col className="w-[190px]" />
                  <col className="w-[170px]" />
                  <col className="w-[100px]" />
                  <col className="w-[360px]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-gray-100 text-gray-700">
                  <tr>
                    {SIGNAL_PREVIEW_COLUMNS.map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matchedLeads.map((lead, rowIndex) => (
                    <tr
                      key={lead.lead_id}
                      className={`border-t border-gray-100 align-top ${rowIndex % 2 === 1 ? "bg-gray-50/60" : ""}`}
                    >
                      {toSignalPreviewRow(lead).map((cell, i) => {
                        const isWhy = i === SIGNAL_PREVIEW_COLUMNS.length - 1;
                        if (!isWhy) {
                          return (
                            <td key={i} title={cell} className="truncate px-3 py-2 text-gray-700">
                              {cell}
                            </td>
                          );
                        }
                        // "Why" shows a short but complete sentence inline; clicking
                        // the "i" opens the fuller rationale for that lead.
                        return (
                          <td key={i} className="px-3 py-2 text-gray-700">
                            <div className="flex items-start gap-1.5">
                              <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                                {shortWhy(cell)}
                              </span>
                              {cell ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="Detailed reason this lead matches"
                                      className="mt-[1px] shrink-0 text-gray-400 hover:text-gray-700"
                                    >
                                      <Info className="h-3.5 w-3.5" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    side="left"
                                    align="start"
                                    className="w-80 text-xs leading-relaxed"
                                  >
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                      Why this lead matches
                                    </p>
                                    <p className="mb-2 text-[11px] font-medium text-gray-900">
                                      {lead.name}
                                      {lead.title ? ` · ${lead.title}` : ""}
                                      {lead.company ? ` (${lead.company})` : ""}
                                      {lead.relevance ? ` — ${lead.relevance} relevance` : ""}
                                    </p>
                                    <p className="whitespace-pre-wrap break-words text-gray-700">
                                      {cell}
                                    </p>
                                  </PopoverContent>
                                </Popover>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* === Why — Why this matters === */}
      {signal.description && (
        <div className="mt-3 border-t border-gray-100 px-3 pt-3">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Why this matters
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
      )}

      {/* === What now — Aggregated outreach plan === */}
      {outreachPlan && matchedLeads.length > 0 && (
        <div className="mt-3 border-t border-gray-100 px-3 pt-3 pb-3">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Aggregated outreach plan
          </h4>
          <p className="text-sm text-gray-800">{outreachPlan.summary}</p>
          <ul className="mt-2 space-y-1.5">
            {outreachPlan.steps.map((step) => (
              <li key={step.label} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="font-medium text-gray-900">{step.label}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                  {step.timing}
                </span>
                <span className="text-gray-600">{step.move}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">Strategist executes these steps.</p>
        </div>
      )}
    </div>
  ) : null;

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
              {hasRecommendations && (
                <div className="mt-2">
                  {isDescriptionExpanded ? (
                    <>
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
                          <div className="mt-4 space-y-2">
                            <h4 className="text-sm font-medium text-gray-900">Recommendations</h4>
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
                                      <p className="text-sm text-gray-700 flex-1">{item.nba}</p>
                                    </button>
                                    {isExpanded && (
                                      <div className="px-3 pb-3 pt-1 border-t border-gray-100">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 h-8 px-2 -ml-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        onClick={() => {
                          onCollapseDescription();
                        }}
                      >
                        Show less
                        <ChevronUp className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 -ml-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      onClick={() => {
                        onExpandDescription();
                      }}
                    >
                      Why this matters
                      <ChevronDown className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
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
