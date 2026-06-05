import { X, Bookmark, MessageCircle, Share2, Bot, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { SignalCard } from "../components/SignalCard";
import {
  applyRejectedFilterAndSort,
  buildSignalCardsFromFetchData,
  getFallbackSampleSignals,
  getSignalContentHash,
} from "../components/signalCards";
import { fetchSignals, generateSignalsBatch } from "../services/signals";
import type { Agent, NBAItem, SignalCard as SignalCardType } from "../types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/features/shell";
import { useToast } from "@/hooks/use-toast";
import type { UntypedBackendSignal } from "@/lib/types/escape-hatches";
import { useAuth } from "@/shared/auth";
import { useSignalAction } from "@/shared/chat/useSignalAction";
import { useSignalAsk } from "@/shared/chat/useSignalAsk";

type ActionType = "accept" | "dismiss" | "save" | "ask";

const SignalsPage = () => {
  const { currentUser, orgId } = useAuth();
  const navigate = useNavigate();
  const askMutation = useSignalAsk();
  const actionMutation = useSignalAction();
  const [currentTab] = useState("signals");
  const [signals, setSignals] = useState<SignalCardType[]>([]);
  const [savedInsights, setSavedInsights] = useState<SignalCardType[]>([]);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<SignalCardType | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  /** Which recommendation's prompt is expanded: { signalId, index } */
  const [expandedRecommendation, setExpandedRecommendation] = useState<{
    signalId: string;
    index: number;
  } | null>(null);
  /** Cached answers from signal_Ask for each recommendation: key = `${signalId}-${index}` */
  const [recommendationAnswers, setRecommendationAnswers] = useState<Record<string, string>>({});
  /** Key of recommendation currently loading answer */
  const [recommendationAnswerLoading, setRecommendationAnswerLoading] = useState<string | null>(
    null,
  );
  /** Keys of answers that are expanded (full view): `${signalId}-${index}` */
  const [answerExpandedKeys, setAnswerExpandedKeys] = useState<Set<string>>(new Set());

  // Reset answer expanded state when recommendation block is collapsed
  useEffect(() => {
    if (!expandedRecommendation) {
      setAnswerExpandedKeys(new Set());
    }
  }, [expandedRecommendation]);
  /** True when current signals (and recommendations) came from GET /api/fetch-signals; false when using sample fallback */
  const [, setSignalsFromApi] = useState(false);
  const [savedInsightsFilter] = useState("all");
  const [acceptedSignals, setAcceptedSignals] = useState<Set<string>>(new Set());
  const [rejectedSignalHashes, setRejectedSignalHashes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [, setIsRefreshing] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  // Track pending rejections for undo functionality
  const [pendingRejections, setPendingRejections] = useState<
    Map<
      string,
      {
        signal: SignalCardType;
        originalIndex: number;
        timer: NodeJS.Timeout;
      }
    >
  >(new Map());
  const { toast } = useToast();

  const loadSignals = async () => {
    if (!currentUser?.uid) {
      console.error("User not authenticated");
      return;
    }
    const uid = currentUser.uid;
    setIsLoading(true);
    try {
      const storageKey = `signals_${uid}`;
      let rejectedHashes = new Set<string>();
      try {
        const savedRejected = localStorage.getItem(storageKey);
        if (savedRejected) {
          const rejectedArray = JSON.parse(savedRejected);
          rejectedHashes = new Set(rejectedArray);
          setRejectedSignalHashes(rejectedHashes);
        }
      } catch (error) {
        console.error("Error loading rejected signals from localStorage:", error);
      }

      try {
        const data = await fetchSignals(uid);
        const rawSignals = (data as { signals?: UntypedBackendSignal[] }).signals || [];
        console.log(
          "Raw signals from API:",
          rawSignals.map((s: UntypedBackendSignal) => ({
            signal_id: s.signal_id,
            id: s.id,
            headline: s.headline,
          })),
        );
        console.log("Rejected signal hashes from localStorage:", Array.from(rejectedHashes));

        const preReject = buildSignalCardsFromFetchData(data);
        console.log(
          "Signals with unique IDs:",
          preReject.map((s) => ({ id: s.id, headline: s.headline })),
        );

        const sortedSignals = applyRejectedFilterAndSort(preReject, rejectedHashes);
        console.log("Filtered signals count:", sortedSignals.length, "out of", preReject.length);
        console.log(
          "Signals sorted by timestamp (newest first):",
          sortedSignals.map((s) => ({ timestamp: s.timestamp, headline: s.headline })),
        );
        setSignals(sortedSignals);
        setSignalsFromApi(true);
        if (rawSignals.length > 0) {
          const first = rawSignals[0];
          const hasNBAs = Array.isArray(first.NBAs) && first.NBAs.length > 0;
          console.log("Signals loaded:", {
            source: "API (fetch-signals)",
            firstSignalNBAsFromApi: hasNBAs,
            firstSignalRecommendationCount: first.NBAs?.length ?? first.nextBestMoves?.length ?? 0,
          });
        }
      } catch (error) {
        console.error("Error loading signals:", error);
        const sampleSignals = getFallbackSampleSignals();
        const sortedSampleSignals = applyRejectedFilterAndSort(sampleSignals, rejectedHashes);
        setSignals(sortedSampleSignals);
        setSignalsFromApi(false);
        console.log("Recommendations source: sample data (API failed or unavailable)");
        toast({
          title: "API Not Available",
          description: "Using sample data. Please ensure your backend API is running.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load accepted and rejected signals from localStorage on mount
  useEffect(() => {
    if (currentUser?.uid) {
      const storageKey = `signals_${currentUser.uid}`;
      try {
        const savedAccepted = localStorage.getItem(`${storageKey}_accepted`);
        const savedRejected = localStorage.getItem(`${storageKey}_rejected`);

        if (savedAccepted) {
          const acceptedArray = JSON.parse(savedAccepted);
          setAcceptedSignals(new Set(acceptedArray));
        }

        if (savedRejected) {
          const rejectedArray = JSON.parse(savedRejected);
          setRejectedSignalHashes(new Set(rejectedArray));
        }
      } catch (error) {
        console.error("Error loading signals from localStorage:", error);
      }
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    void loadSignals();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadSignals intentionally omitted to avoid refetch loops
  }, [currentUser?.uid, orgId]);

  // Listen for refresh event from header
  useEffect(() => {
    const handleSignalsRefresh = () => {
      void handleRefresh();
    };
    const handleSignalsStateChanged = () => {
      if (currentUser?.uid) {
        const storageKey = `signals_${currentUser.uid}`;
        try {
          const savedAccepted = localStorage.getItem(`${storageKey}_accepted`);
          const savedRejected = localStorage.getItem(`${storageKey}_rejected`);
          if (savedAccepted) setAcceptedSignals(new Set(JSON.parse(savedAccepted)));
          if (savedRejected) setRejectedSignalHashes(new Set(JSON.parse(savedRejected)));
          void loadSignals();
        } catch (e) {
          console.error("Error syncing signals state:", e);
        }
      }
    };

    window.addEventListener("signalsRefresh", handleSignalsRefresh);
    window.addEventListener("signalsStateChanged", handleSignalsStateChanged);
    return () => {
      window.removeEventListener("signalsRefresh", handleSignalsRefresh);
      window.removeEventListener("signalsStateChanged", handleSignalsStateChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, orgId]);

  // Fetch answer when recommendation is expanded (prompt sent to signal_Ask)
  useEffect(() => {
    if (!expandedRecommendation || !currentUser?.uid || !orgId) return;
    const { signalId, index } = expandedRecommendation;
    const signal = signals.find((s) => s.id === signalId);
    if (!signal) return;
    const list: NBAItem[] =
      signal.NBAs && signal.NBAs.length > 0
        ? signal.NBAs
        : (signal.nextBestMoves || []).map((m) => ({ nba: m, prompt: "" }));
    const item = list[index];
    if (!item || !(item.prompt ?? "").trim()) return;
    const key = `${signalId}-${index}`;
    if (recommendationAnswers[key]) return;
    setRecommendationAnswerLoading(key);
    askMutation
      .mutateAsync({
        org_id: orgId,
        user_id: currentUser.uid,
        question: item.prompt,
        history: [],
      })
      .then((res) => {
        const r = res as Record<string, unknown>;
        const answer = r?.answer ?? r?.response ?? (typeof res === "string" ? res : "");
        setRecommendationAnswers((prev) => ({ ...prev, [key]: String(answer) }));
      })
      .catch((err) => {
        console.error("signal_Ask for recommendation error:", err);
        toast({
          title: "Error",
          description: "Failed to load recommendation answer. Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => setRecommendationAnswerLoading(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- askMutation is a fresh object per render; including it would loop. mutateAsync is stable.
  }, [expandedRecommendation, signals, currentUser?.uid, orgId, recommendationAnswers, toast]);

  const handleRefresh = async () => {
    if (!currentUser?.uid) {
      console.error("User not authenticated");
      return;
    }
    setIsRefreshing(true);
    // Notify header that refresh started
    window.dispatchEvent(new CustomEvent("signalsRefreshStart"));

    try {
      await generateSignalsBatch(currentUser.uid);
      await loadSignals();
      toast({
        title: "Success",
        description: "New signals generated successfully!",
      });
    } catch (error) {
      console.error("Error refreshing signals:", error);
      toast({
        title: "API Error",
        description:
          "Failed to generate new signals. Please check if your backend API is running and accessible.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
      // Notify header that refresh ended
      window.dispatchEvent(new CustomEvent("signalsRefreshEnd"));
    }
  };

  const handleAction = (cardId: string, action: ActionType) => {
    const signal = signals.find((s) => s.id === cardId);
    if (!signal) return;
    if (action === "accept" || action === "save") {
      if (!savedInsights.find((s) => s.id === cardId)) {
        setSavedInsights((prev) => [signal, ...prev]);
      }
    } else if (action === "ask") {
      setSelectedSignal(signal);
      setChatDrawerOpen(true);
    }
    console.log(`Action ${action} on card ${cardId}`);
  };

  const getAgentBadge = (agent: Agent) => {
    if (agent === "scout") {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
          🔵 From Scout
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
        🟣 From Profiler
      </Badge>
    );
  };

  /** Navigate to Chat with Scout or Profiler, passing recommendation + prompt + answer as context */
  const handleNavigateToAgentChat = (
    signal: SignalCardType,
    recommendation: string,
    prompt: string,
    answer?: string,
  ) => {
    const contentHash = getSignalContentHash(signal);
    const context = {
      agent: signal.agent,
      signalId: signal.id,
      contentHash,
      signalHeading: signal.headline,
      recommendation,
      prompt,
      answer: answer ?? undefined,
    };
    sessionStorage.setItem("signalsChatContext", JSON.stringify(context));
    if (signal.agent === "scout") {
      navigate("/your-ai-team/scout/chatwithscout");
    } else {
      navigate("/customers", { state: { tab: "chat-profiler" } });
    }
  };

  /** Navigate to Chat from bot icon (signal-level context, uses first recommendation if available) */
  const handleBotIconClick = (signal: SignalCardType) => {
    const list: NBAItem[] =
      signal.NBAs && signal.NBAs.length > 0
        ? signal.NBAs
        : (signal.nextBestMoves || []).map((m) => ({ nba: m, prompt: "" }));
    const first = list[0];
    const recommendation = first?.nba ?? signal.headline;
    const prompt = first?.prompt ?? "";
    const answer = first ? recommendationAnswers[`${signal.id}-0`] : undefined;
    handleNavigateToAgentChat(signal, recommendation, prompt, answer);
  };
  const getContextualGreeting = (_signal: SignalCardType) => {
    const name = "Alex"; // This would come from user context in real app
    return `Hi ${name} 👋, I'm ready to delegate this insight for you. Please instruct.`;
  };

  const getContextualSuggestions = (signal: SignalCardType) => {
    if (
      signal.headline.toLowerCase().includes("competitor") &&
      signal.headline.toLowerCase().includes("pricing")
    ) {
      return [
        { icon: "🔗", text: "Get Company X's Website & Press Release" },
        { icon: "🧑‍💼", text: "Identify decision makers at Company X" },
        { icon: "📊", text: "Compare SMB pricing vs. our offering" },
        { icon: "🚀", text: "Monitor early adoption signals from Company X" },
        { icon: "📅", text: "Track mentions of SMB tier in LinkedIn updates" },
      ];
    }

    if (
      signal.headline.toLowerCase().includes("icp") &&
      signal.headline.toLowerCase().includes("segment")
    ) {
      return [
        { icon: "🎯", text: "Research FinTech segment decision makers" },
        { icon: "📈", text: "Analyze EU market penetration opportunities" },
        { icon: "🔍", text: "Find similar companies matching this profile" },
        { icon: "📋", text: "Create tailored value proposition" },
        { icon: "📧", text: "Draft outreach sequences for this segment" },
      ];
    }

    if (signal.sourceLabel.toLowerCase().includes("linkedin")) {
      return [
        { icon: "💬", text: "Draft contextual comment for this post" },
        { icon: "🤝", text: "Prepare connection request message" },
        { icon: "🔄", text: "Find similar prospects with same challenges" },
        { icon: "📊", text: "Analyze engagement patterns" },
        { icon: "📝", text: "Create follow-up sequence" },
      ];
    }

    if (signal.headline.toLowerCase().includes("funding")) {
      return [
        { icon: "💰", text: "Analyze funding impact on market positioning" },
        { icon: "🏢", text: "Identify potential acquisition targets" },
        { icon: "📈", text: "Map competitive landscape changes" },
        { icon: "🎯", text: "Find prospects considering this competitor" },
        { icon: "📋", text: "Draft competitive differentiation messaging" },
      ];
    }

    // Default suggestions
    return [
      { icon: "🔍", text: "Research deeper context and implications" },
      { icon: "📊", text: "Analyze impact on your ICP segments" },
      { icon: "💡", text: "Generate actionable next steps" },
      { icon: "📈", text: "Monitor for similar signals" },
      { icon: "📝", text: "Create summary for weekly digest" },
    ];
  };
  const handleAcceptSignal = async (signalId: string) => {
    if (!currentUser?.uid || !orgId) return;

    // Find the signal to get its content hash
    const signal = signals.find((s) => s.id === signalId);
    if (!signal) return;

    const contentHash = getSignalContentHash(signal);

    // Toggle accept state - if already accepted, unaccept it
    if (acceptedSignals.has(contentHash)) {
      // Unaccept the signal
      const newAccepted = new Set(acceptedSignals);
      newAccepted.delete(contentHash);
      setAcceptedSignals(newAccepted);

      // Save to localStorage
      const storageKey = `signals_${currentUser.uid}`;
      try {
        localStorage.setItem(`${storageKey}_accepted`, JSON.stringify(Array.from(newAccepted)));
      } catch (error) {
        console.error("Error saving accepted signals to localStorage:", error);
      }

      // Call API to unaccept (action: reject)
      try {
        await actionMutation.mutateAsync({ orgId, signalId, action: "reject" });
      } catch (error) {
        console.error("Error calling signal action API:", error);
        // Still update UI even if API fails
      }

      toast({
        title: "Signal unaccepted",
        description: "This signal has been unaccepted.",
      });
    } else {
      // Accept the signal
      const newAccepted = new Set([...acceptedSignals, contentHash]);
      setAcceptedSignals(newAccepted);

      // Save to localStorage
      const storageKey = `signals_${currentUser.uid}`;
      try {
        localStorage.setItem(`${storageKey}_accepted`, JSON.stringify(Array.from(newAccepted)));
      } catch (error) {
        console.error("Error saving accepted signals to localStorage:", error);
      }

      // Call API to accept
      try {
        await actionMutation.mutateAsync({ orgId, signalId, action: "accept" });
        toast({
          title: "Signal accepted",
          description: "This signal has been marked as accepted.",
        });
      } catch (error) {
        console.error("Error calling signal action API:", error);
        toast({
          title: "Error",
          description: "Failed to accept signal. Please try again.",
          variant: "destructive",
        });
        // Revert UI state on error
        const revertedAccepted = new Set(acceptedSignals);
        setAcceptedSignals(revertedAccepted);
        try {
          localStorage.setItem(
            `${storageKey}_accepted`,
            JSON.stringify(Array.from(revertedAccepted)),
          );
        } catch (e) {
          console.error("Error reverting accepted signals:", e);
        }
      }
    }
  };

  const handleRejectSignal = (signalId: string) => {
    if (!currentUser?.uid || !orgId) return;

    // Find the signal and its index to get its content hash
    const signalIndex = signals.findIndex((s) => s.id === signalId);
    const signal = signals[signalIndex];
    if (!signal) return;

    const contentHash = getSignalContentHash(signal);
    const storageKey = `signals_${currentUser.uid}`;

    // Store the signal and its original index for undo
    const signalToRestore = signal;
    const originalIndex = signalIndex;

    // Remove from signals list immediately (UI update)
    setSignals((prev) => prev.filter((s) => s.id !== signalId));

    // Remove from accepted if it was accepted (using content hash)
    setAcceptedSignals((prev) => {
      const newSet = new Set(prev);
      newSet.delete(contentHash);

      // Update localStorage
      try {
        localStorage.setItem(`${storageKey}_accepted`, JSON.stringify(Array.from(newSet)));
      } catch (error) {
        console.error("Error updating accepted signals in localStorage:", error);
      }

      return newSet;
    });

    // Add to rejected list (using content hash) - for UI filtering
    const newRejected = new Set([...rejectedSignalHashes, contentHash]);
    setRejectedSignalHashes(newRejected);

    // Save rejected signals to localStorage
    try {
      localStorage.setItem(`${storageKey}_rejected`, JSON.stringify(Array.from(newRejected)));
    } catch (error) {
      console.error("Error saving rejected signals to localStorage:", error);
    }

    // Set up 5-second timer to call API
    const timer = setTimeout(() => {
      void (async () => {
        // Remove from pending rejections
        setPendingRejections((prev) => {
          const updated = new Map(prev);
          updated.delete(signalId);
          return updated;
        });

        // Call API to reject
        try {
          await actionMutation.mutateAsync({ orgId, signalId, action: "reject" });
          console.log("Signal rejected via API:", signalId);
        } catch (error) {
          console.error("Error calling signal action API for reject:", error);
          // If API fails, restore the signal
          setSignals((prev) => {
            const exists = prev.find((s) => s.id === signalToRestore.id);
            if (exists) return prev;
            const insertIndex = Math.min(originalIndex, prev.length);
            const newSignals = [...prev];
            newSignals.splice(insertIndex, 0, signalToRestore);
            return newSignals;
          });
          setRejectedSignalHashes((prev) => {
            const updatedRejected = new Set(prev);
            updatedRejected.delete(contentHash);
            try {
              localStorage.setItem(
                `${storageKey}_rejected`,
                JSON.stringify(Array.from(updatedRejected)),
              );
            } catch (e) {
              console.error("Error updating rejected signals in localStorage:", e);
            }
            return updatedRejected;
          });
          toast({
            title: "Error",
            description: "Failed to reject signal. It has been restored.",
            variant: "destructive",
          });
        }
      })();
    }, 5000); // 5 seconds delay

    // Store pending rejection for undo
    setPendingRejections((prev) => {
      const updated = new Map(prev);
      updated.set(signalId, {
        signal: signalToRestore,
        originalIndex,
        timer,
      });
      return updated;
    });

    // Show toast with undo option
    toast({
      title: "Signal removed",
      description: "This signal has been removed from your list.",
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Clear the timer and remove from pending rejections
            setPendingRejections((prev) => {
              const updated = new Map(prev);
              const pendingRejection = updated.get(signalId);
              if (pendingRejection) {
                // Clear the timer
                clearTimeout(pendingRejection.timer);
                // Remove from map
                updated.delete(signalId);
              }
              return updated;
            });

            // Restore the signal to its original position
            setSignals((prev) => {
              // Check if signal already exists (shouldn't, but be safe)
              const exists = prev.find((s) => s.id === signalToRestore.id);
              if (exists) return prev;

              // Insert at original position, or at the end if original position is beyond current length
              const insertIndex = Math.min(originalIndex, prev.length);
              const newSignals = [...prev];
              newSignals.splice(insertIndex, 0, signalToRestore);
              return newSignals;
            });

            // Remove from rejected list
            setRejectedSignalHashes((prev) => {
              const updatedRejected = new Set(prev);
              updatedRejected.delete(contentHash);

              // Update localStorage
              try {
                localStorage.setItem(
                  `${storageKey}_rejected`,
                  JSON.stringify(Array.from(updatedRejected)),
                );
              } catch (error) {
                console.error("Error updating rejected signals in localStorage:", error);
              }

              return updatedRejected;
            });

            toast({
              title: "Signal restored",
              description: "The signal has been restored to your list.",
            });
          }}
        >
          Undo
        </Button>
      ),
    });
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      pendingRejections.forEach(({ timer }) => {
        clearTimeout(timer);
      });
    };
  }, [pendingRejections]);

  const filteredSavedInsights: SignalCardType[] =
    savedInsightsFilter === "all"
      ? savedInsights
      : savedInsights.filter((insight) => {
          if (savedInsightsFilter === "competitor")
            return insight.headline.toLowerCase().includes("competitor");
          if (savedInsightsFilter === "icp") return insight.headline.toLowerCase().includes("icp");
          if (savedInsightsFilter === "industry")
            return (
              insight.headline.toLowerCase().includes("industry") ||
              insight.headline.toLowerCase().includes("funding")
            );
          if (savedInsightsFilter === "linkedin")
            return insight.sourceLabel.toLowerCase().includes("linkedin");
          return true;
        });

  return (
    <Layout>
      <div className="p-6">
        {currentTab === "signals" && (
          <div className="w-full max-w-5xl mx-auto space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading signals...</p>
              </div>
            ) : signals.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No signals available</h3>
                <p className="text-gray-500 mb-4">
                  Click refresh in the header to generate new signals
                </p>
              </div>
            ) : (
              signals.map((signal) => {
                const contentHash = getSignalContentHash(signal);
                const isAccepted = acceptedSignals.has(contentHash);
                return (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    isAccepted={isAccepted}
                    getAgentBadge={getAgentBadge}
                    isDescriptionExpanded={expandedDescriptions.has(signal.id)}
                    expandedRecommendationIndex={
                      expandedRecommendation?.signalId === signal.id
                        ? expandedRecommendation.index
                        : null
                    }
                    recommendationAnswers={recommendationAnswers}
                    recommendationAnswerLoading={recommendationAnswerLoading}
                    answerExpandedKeys={answerExpandedKeys}
                    onAccept={(signalId) => {
                      void handleAcceptSignal(signalId);
                    }}
                    onReject={handleRejectSignal}
                    onBotIconClick={handleBotIconClick}
                    onNavigateToAgentChat={handleNavigateToAgentChat}
                    onExpandDescription={() => {
                      setExpandedDescriptions((prev) => new Set([...prev, signal.id]));
                    }}
                    onCollapseDescription={() => {
                      setExpandedDescriptions((prev) => {
                        const newSet = new Set(prev);
                        newSet.delete(signal.id);
                        return newSet;
                      });
                    }}
                    onToggleRecommendation={(index) => {
                      const isExpanded =
                        expandedRecommendation?.signalId === signal.id &&
                        expandedRecommendation?.index === index;
                      setExpandedRecommendation(isExpanded ? null : { signalId: signal.id, index });
                    }}
                    onExpandAnswer={(key) => {
                      setAnswerExpandedKeys((prev) => {
                        const next = new Set(prev);
                        next.add(key);
                        return next;
                      });
                    }}
                    onCollapseAnswer={(key) => {
                      setAnswerExpandedKeys((prev) => {
                        const next = new Set(prev);
                        next.delete(key);
                        return next;
                      });
                    }}
                  />
                );
              })
            )}
          </div>
        )}

        {currentTab === "saved" && (
          <div className="max-w-4xl mx-auto">
            {filteredSavedInsights.length === 0 ? (
              <div className="text-center py-12">
                <Bookmark className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No saved insights yet</h3>
                <p className="text-gray-500">Accept or save signals to build your reading list</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSavedInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${insight.agent === "scout" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}`}
                          >
                            <Bot className="h-3 w-3" />
                          </div>
                          {getAgentBadge(insight.agent)}
                          <span className="text-sm text-gray-500">•</span>
                          <span className="text-sm text-gray-500">{insight.timestamp}</span>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">{insight.headline}</h4>
                        <p className="text-sm text-gray-600">{insight.snippet}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(insight.id, "ask")}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Drawer */}
      <Drawer open={chatDrawerOpen} onOpenChange={setChatDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <DrawerTitle className="text-base font-semibold">Agent Discussion</DrawerTitle>
                  <p className="text-xs text-gray-600">
                    {selectedSignal
                      ? getContextualGreeting(selectedSignal)
                      : "Let's analyze this signal together"}
                  </p>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-4 flex-1 overflow-y-auto">
            {selectedSignal && (
              <div className="space-y-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-1">{selectedSignal.headline}</h3>
                  <p className="text-xs text-gray-600">{selectedSignal.snippet}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">Quick Actions:</h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(selectedSignal.contextualSuggestions &&
                    selectedSignal.contextualSuggestions.length > 0
                      ? selectedSignal.contextualSuggestions
                      : getContextualSuggestions(selectedSignal)
                    ).map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start text-left h-auto p-2 bg-white hover:bg-blue-50 border-gray-200 hover:border-blue-300"
                        onClick={() => {
                          toast({
                            title: "Task delegated to Agent",
                            description: suggestion.text,
                          });
                          setChatDrawerOpen(false);
                        }}
                      >
                        <span className="mr-2 text-sm">{suggestion.icon}</span>
                        <span className="text-xs">{suggestion.text}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700">
                    Add specific notes or comments for this insight:
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type your thoughts, questions, or specific instructions..."
                      className="flex-1 text-sm"
                    />
                    <Button
                      onClick={() => {
                        if (chatMessage.trim()) {
                          toast({
                            title: "Notes saved",
                            description: "Your comments have been attached to this insight",
                          });
                          setChatMessage("");
                          setChatDrawerOpen(false);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Toaster />
    </Layout>
  );
};

export default SignalsPage;
