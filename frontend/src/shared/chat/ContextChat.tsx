import {
  Send,
  Loader2,
  RotateCcw,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  X,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/shared/auth";
import { useSignalAction } from "@/shared/chat/useSignalAction";
import { useSignalAsk } from "@/shared/chat/useSignalAsk";
import { sanitizeAnswerText } from "@/shared/lib/sanitizeAnswerText";

export interface ChatContext {
  agent: "scout" | "profiler";
  signalId?: string; // for accept/reject API
  contentHash?: string; // for localStorage sync with Signals page
  signalHeading?: string; // signal headline in bold
  recommendations?: string[]; // legacy: all recommendations
  recommendation?: string; // selected recommendation only
  prompt: string;
  answer?: string; // answer from signal_Ask when prompt was sent (displayed instead of prompt)
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** sessionStorage key for the cross-tab chat handoff. Kept stable — renaming it
 *  would orphan in-flight entries (TD-FE-50). */
export const CHAT_CONTEXT_SESSION_KEY = "signalsChatContext";

/** Read the chat-context handoff (typed; replaces inline `as` casts). */
export function readSessionChatContext(): ChatContext | null {
  try {
    const stored = sessionStorage.getItem(CHAT_CONTEXT_SESSION_KEY);
    return stored ? (JSON.parse(stored) as ChatContext) : null;
  } catch {
    return null;
  }
}

/** Write the chat-context handoff. */
export function writeSessionChatContext(context: ChatContext): void {
  sessionStorage.setItem(CHAT_CONTEXT_SESSION_KEY, JSON.stringify(context));
}

interface ContextChatProps {
  context: ChatContext;
  onClearContext?: () => void;
  onClose?: () => void;
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

export const ContextChat = ({
  context,
  onClearContext,
  onClose,
  initialMessages,
  onMessagesChange,
}: ContextChatProps) => {
  const { currentUser, orgId } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const askMutation = useSignalAsk();
  const actionMutation = useSignalAction();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [fetchedAnswer, setFetchedAnswer] = useState<string | null>(null);
  const [isFetchingAnswer, setIsFetchingAnswer] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentName = context.agent === "scout" ? "Scout" : "Profiler";
  const canAcceptReject = Boolean(context.signalId && context.contentHash && currentUser?.uid);
  const displayAnswer = context.answer ?? fetchedAnswer ?? "";

  // Fetch answer when we have prompt but no answer (e.g. navigated before answer loaded on Signals)
  useEffect(() => {
    if (!context.prompt?.trim() || context.answer || fetchedAnswer || !currentUser?.uid || !orgId)
      return;
    setIsFetchingAnswer(true);
    askMutation
      .mutateAsync({
        org_id: orgId ?? "org-123",
        user_id: currentUser.uid,
        question: context.prompt,
        history: [],
      })
      .then((res) => {
        const r = res as Record<string, unknown>;
        const ans = r?.answer ?? r?.response ?? (typeof res === "string" ? res : "");
        setFetchedAnswer(String(ans));
      })
      .catch(() => setFetchedAnswer(""))
      .finally(() => setIsFetchingAnswer(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- askMutation is a fresh object per render; including it would loop. mutateAsync is stable.
  }, [context.prompt, context.answer, fetchedAnswer, currentUser?.uid, orgId]);

  // Sync accepted state from localStorage on mount
  useEffect(() => {
    if (!currentUser?.uid || !context.contentHash) return;
    const storageKey = `signals_${currentUser.uid}`;
    try {
      const saved = localStorage.getItem(`${storageKey}_accepted`);
      if (saved) {
        const accepted = JSON.parse(saved) as string[];
        setIsAccepted(accepted.includes(context.contentHash));
      }
    } catch {
      // ignore
    }
  }, [currentUser?.uid, context.contentHash]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildContextPrefix = () => {
    const parts: string[] = [];
    if (context.signalHeading) {
      parts.push(`Signal: ${context.signalHeading}`);
    }
    const rec =
      context.recommendation ??
      (context.recommendations?.length ? context.recommendations.join("\n") : "");
    if (rec) {
      parts.push(`Selected recommendation:\n${rec}`);
    }
    const answerToUse = context.answer ?? fetchedAnswer ?? "";
    if (answerToUse) {
      parts.push(`Answer:\n${answerToUse}`);
    } else if (context.prompt) {
      parts.push(`Corresponding prompt:\n${context.prompt}`);
    }
    return parts.length > 0 ? `[Context from Signals]\n${parts.join("\n\n")}\n\n` : "";
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !currentUser?.uid) return;
    const userMessage = inputValue.trim();
    setInputValue("");
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    onMessagesChange?.(newMessages);
    setIsLoading(true);

    try {
      const historyForApi: { user: string; assistant: string }[] = [];
      for (let i = 0; i < messages.length - 1; i += 2) {
        const userMsg = messages[i];
        const assistantMsg = messages[i + 1];
        if (userMsg?.role === "user" && assistantMsg?.role === "assistant") {
          historyForApi.push({ user: userMsg.content, assistant: assistantMsg.content });
        }
      }

      const isFirstMessage = messages.length === 0;
      const question = isFirstMessage
        ? `${buildContextPrefix()}User question: ${userMessage}`
        : userMessage;

      const res = await askMutation.mutateAsync({
        org_id: orgId ?? "org-123",
        user_id: currentUser.uid,
        question,
        history: historyForApi,
      });

      const r = res as Record<string, unknown>;
      const assistantText =
        r?.answer ?? r?.response ?? r?.data ?? (typeof res === "string" ? res : "");
      const cleaned =
        typeof assistantText === "string"
          ? sanitizeAnswerText(assistantText)
          : sanitizeAnswerText(String(assistantText || ""));
      const updatedMessages = [...newMessages, { role: "assistant" as const, content: cleaned }];
      setMessages(updatedMessages);
      onMessagesChange?.(updatedMessages);
    } catch (err) {
      console.error("signal_Ask error:", err);
      const errorMessages = [
        ...newMessages,
        { role: "assistant" as const, content: "Sorry, I encountered an error. Please try again." },
      ];
      setMessages(errorMessages);
      onMessagesChange?.(errorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInputValue("");
    onMessagesChange?.([]);
    onClearContext?.();
  };

  const returnToSignalsPage = () => {
    sessionStorage.removeItem("signalsChatContext");
    onClearContext?.();
    setMessages([]);
    setInputValue("");
    onMessagesChange?.([]);
    window.dispatchEvent(new CustomEvent("signalsStateChanged"));
    navigate("/signals");
  };

  const handleAccept = async () => {
    if (!context.signalId || !context.contentHash || !currentUser?.uid || !orgId) return;
    setIsActionLoading(true);
    try {
      await actionMutation.mutateAsync({ orgId, signalId: context.signalId, action: "accept" });
      const storageKey = `signals_${currentUser.uid}`;
      const saved = localStorage.getItem(`${storageKey}_accepted`);
      const accepted = saved ? (JSON.parse(saved) as string[]) : [];
      if (!accepted.includes(context.contentHash)) {
        const updated = [...accepted, context.contentHash];
        localStorage.setItem(`${storageKey}_accepted`, JSON.stringify(updated));
      }
      setIsAccepted(true);
      toast({ title: "Signal accepted", description: "This signal has been marked as accepted." });
      returnToSignalsPage();
    } catch (err) {
      console.error("Accept error:", err);
      toast({
        title: "Error",
        description: "Failed to accept signal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!context.signalId || !context.contentHash || !currentUser?.uid || !orgId) return;
    setIsActionLoading(true);
    try {
      await actionMutation.mutateAsync({ orgId, signalId: context.signalId, action: "reject" });
      const storageKey = `signals_${currentUser.uid}`;
      const saved = localStorage.getItem(`${storageKey}_rejected`);
      const rejected = saved ? (JSON.parse(saved) as string[]) : [];
      if (!rejected.includes(context.contentHash)) {
        const updated = [...rejected, context.contentHash];
        localStorage.setItem(`${storageKey}_rejected`, JSON.stringify(updated));
      }
      toast({
        title: "Signal removed",
        description: "This signal has been removed from your list.",
      });
      returnToSignalsPage();
    } catch (err) {
      console.error("Reject error:", err);
      toast({
        title: "Error",
        description: "Failed to reject signal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const isScout = context.agent === "scout";

  return (
    <Card className="flex-1 min-h-0 flex flex-col shadow-sm border-0 overflow-hidden">
      <CardHeader
        className={`py-1.5 px-3 border-b bg-gradient-to-r ${isScout ? "from-blue-50/80 to-transparent" : "from-purple-50/80 to-transparent"}`}
      >
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground"
            title="Reset conversation"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              title="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 pt-2 gap-2 overflow-hidden">
        {/* Context summary - collapsible to save space */}
        {(context.signalHeading ?? context.recommendation ?? context.recommendations?.[0]) ||
        context.prompt ||
        displayAnswer ? (
          <div
            className={`rounded-lg border overflow-hidden shrink-0 flex flex-col ${isContextExpanded ? "min-h-[320px] max-h-[55vh]" : ""} ${isScout ? "border-blue-100" : "border-purple-100"}`}
          >
            <button
              type="button"
              onClick={() => setIsContextExpanded((v) => !v)}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 pr-2 text-left hover:bg-muted/30 transition-colors shrink-0 ${isScout ? "bg-blue-50/50" : "bg-purple-50/50"}`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Lightbulb
                  className={`h-3.5 w-3.5 shrink-0 ${isScout ? "text-blue-600" : "text-purple-600"}`}
                />
                <span className="text-xs font-medium text-muted-foreground break-words text-left [overflow-wrap:anywhere] flex-1 min-w-0">
                  {isContextExpanded
                    ? "Hide context"
                    : (context.signalHeading ??
                      context.recommendation ??
                      context.recommendations?.[0] ??
                      "Context")}
                </span>
              </div>
              {isContextExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              )}
            </button>
            {isContextExpanded && (
              <div className="flex flex-col min-h-0 overflow-hidden px-2 pb-2 pt-0.5 flex-1">
                {context.signalHeading && (
                  <div className="py-1.5 px-2 rounded bg-white/80 shrink-0">
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Signal</p>
                    <p className="text-xs font-bold text-foreground leading-snug break-words [overflow-wrap:anywhere]">
                      {context.signalHeading}
                    </p>
                  </div>
                )}
                {(context.recommendation ??
                  (context.recommendations?.length ? context.recommendations[0] : "")) && (
                  <div className="py-1.5 px-2 rounded bg-white/80 shrink-0">
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                      Recommendation
                    </p>
                    <p className="text-xs text-foreground leading-snug break-words [overflow-wrap:anywhere]">
                      {context.recommendation ?? context.recommendations?.[0]}
                    </p>
                  </div>
                )}
                {(context.prompt || displayAnswer) && (
                  <div className="flex-1 min-h-0 flex flex-col rounded bg-white/80 overflow-hidden mt-1">
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5 px-2 pt-1 shrink-0">
                      Answer
                    </p>
                    {isFetchingAnswer ? (
                      <div className="flex items-center gap-2 py-3 text-muted-foreground shrink-0">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading answer...</span>
                      </div>
                    ) : (
                      <div className="flex-1 min-h-[200px] overflow-y-auto px-2 pb-2 pr-1">
                        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {sanitizeAnswerText(displayAnswer || context.prompt)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-[100px] pr-2">
          {messages.length === 0 && (
            <div className="flex items-center justify-center py-4 text-center">
              <p className="text-sm text-muted-foreground max-w-xs">
                Ask a question about the recommendation or answers above to get started.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <p className="text-xs font-medium mb-1 text-muted-foreground">
                {m.role === "user" ? "You" : agentName}
              </p>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : `bg-muted/80 ${isScout ? "border border-blue-100" : "border border-purple-100"}`
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">
                  {m.role === "assistant" ? sanitizeAnswerText(m.content) : m.content}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex flex-col items-start">
              <p className="text-xs font-medium mb-1 text-muted-foreground">{agentName}</p>
              <div
                className={`rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm ${isScout ? "bg-blue-50 border border-blue-100" : "bg-purple-50 border border-purple-100"}`}
              >
                <Loader2
                  className={`h-4 w-4 animate-spin ${isScout ? "text-blue-600" : "text-purple-600"}`}
                />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Accept / Reject decision bar - visible only after first interaction, then persistent until decision */}
        {canAcceptReject && messages.length >= 2 && (
          <div
            className={`shrink-0 rounded-lg border px-2 py-1.5 flex items-center justify-between gap-2 ${isScout ? "bg-blue-50/60 border-blue-100" : "bg-purple-50/60 border-purple-100"}`}
          >
            <p className="text-xs font-medium text-muted-foreground">
              {isAccepted ? "Signal accepted" : "Satisfied with this signal?"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${
                  isAccepted
                    ? "text-green-600 bg-green-100 hover:bg-green-100"
                    : "text-muted-foreground hover:text-green-600 hover:bg-green-50"
                }`}
                onClick={handleAccept}
                disabled={isAccepted || isActionLoading}
                title={isAccepted ? "Accepted" : "Accept signal"}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                onClick={handleReject}
                disabled={isActionLoading}
                title="Reject signal"
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Input - always visible at bottom */}
        <div className="flex gap-2 pt-1.5 shrink-0">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={`Ask ${agentName} a question...`}
            disabled={isLoading}
            className="flex-1 rounded-xl border-2 focus-visible:ring-2 focus-visible:ring-offset-0"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className={`rounded-xl h-10 w-10 shrink-0 ${isScout ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"}`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
