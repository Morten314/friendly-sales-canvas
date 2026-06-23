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
import type { Agent, NBAItem, SignalCard as SignalCardType } from "../types";

import { sanitizeSourceUrl } from "./signalCards";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

  // Clear the lock timer on card collapse and on unmount (Spec §2).
  useEffect(() => {
    if (!isDescriptionExpanded) {
      clearLockTimer();
      setShowLockMessage(false);
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

  const relevanceBadgeClass = (relevance: SignalLeadMapLead["relevance"]): string => {
    if (relevance === "high") return "bg-green-100 text-green-800 border-green-200";
    if (relevance === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };
  const titleCase = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const leadsSection: ReactNode = isLeadsExpanded ? (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      {leadsLoading || leadsFetching ? (
        <div className="flex items-center gap-2 py-1 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Finding matched leads…</span>
        </div>
      ) : leadsError ? (
        <div className="flex items-center justify-between gap-3 py-1">
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
        <p className="py-1 text-sm text-gray-500">No matched leads found for this signal yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {matchedLeads.map((lead) => (
              <div
                key={lead.lead_id}
                className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 border border-gray-100"
              >
                <span className="text-sm text-gray-800">{lead.company || "Unknown company"}</span>
                <Badge
                  variant="secondary"
                  className={`text-xs ${relevanceBadgeClass(lead.relevance)}`}
                >
                  {titleCase(lead.relevance)}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="text-blue-700 border-blue-300 hover:bg-blue-50"
              onClick={onSaveAsArtefact}
            >
              Save as Artifact
            </Button>
          </div>
        </>
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
              {/* Description field - detailed ICP/customer context with Read more/Show less */}
              {signal.description && (
                <div className="mt-2">
                  {isDescriptionExpanded ? (
                    <>
                      <p className="text-gray-700 text-sm leading-relaxed mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        {signal.description}
                      </p>
                      {/* Citations from API - bottom left of expanded description; click opens url */}
                      {Array.isArray(signal.source) && signal.source.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1.5 justify-start">
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
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs font-normal w-fit"
                              >
                                {label}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      {/* Spec 38 CTA: Find Matched Leads → leads section */}
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          size="default"
                          aria-disabled={!isAccepted}
                          className={
                            isAccepted
                              ? "text-sm border-green-600 text-green-700 hover:bg-green-50"
                              : "text-sm border-gray-300 text-gray-400 cursor-not-allowed"
                          }
                          onClick={handleFindClick}
                        >
                          Find Matched Leads
                        </Button>
                        {showLockMessage && (
                          <p role="status" className="mt-2 text-xs text-amber-700">
                            Accept this signal to unlock matched leads
                          </p>
                        )}
                        {leadsSection}
                      </div>
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
                                                    <p
                                                      className={`text-sm text-slate-800 whitespace-pre-wrap pr-1 ${
                                                        answerExpandedKeys.has(
                                                          `${signal.id}-${index}`,
                                                        )
                                                          ? ""
                                                          : "max-h-24 overflow-hidden"
                                                      }`}
                                                    >
                                                      {sanitizeAnswerText(
                                                        recommendationAnswers[
                                                          `${signal.id}-${index}`
                                                        ] ?? item.prompt,
                                                      )}
                                                    </p>
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
                      <div className="flex justify-center mt-3">
                        <Button
                          variant="outline"
                          size="default"
                          className="text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm"
                          onClick={() => {
                            onCollapseDescription();
                          }}
                        >
                          Show less
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="default"
                        className="text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm"
                        onClick={() => {
                          onExpandDescription();
                        }}
                      >
                        Read more
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Source: {signal.sourceLabel}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {affectedLeadCount ? (
          <div className="mt-3 text-xs text-muted-foreground">
            Affects <span className="font-semibold text-foreground">{affectedLeadCount}</span>{" "}
            {affectedLeadCount === 1 ? "lead" : "leads"}
          </div>
        ) : null}

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
