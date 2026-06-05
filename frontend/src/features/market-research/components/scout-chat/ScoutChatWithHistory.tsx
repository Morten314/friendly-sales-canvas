import {
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeft,
  MessageCircle,
  Trash2,
  Users,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

import { AddLeadModal } from "./AddLeadModal";
import { SuggestedCompaniesSection } from "./SuggestedCompaniesSection";

import ScoutChatPanel from "@/components/market-research/ScoutChatPanel";
import type { EditRecord } from "@/components/market-research/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/shared/auth";
import type { SignalsChatContext, ChatMessage } from "@/shared/chat";
import { ContextChat } from "@/shared/chat";
import {
  LEAD_STREAM_CHAT_CONTEXT_KEY,
  type LeadStreamChatContext,
} from "@/utils/leadStreamChatContext";

const STORAGE_KEY_PREFIX = "scout_chat_sessions";

interface ChatSession {
  id: string;
  title: string;
  context: SignalsChatContext | null;
  /** Context from Lead Stream when user clicks "Research with Scout" on a lead */
  leadContext?: LeadStreamChatContext;
  messages: ChatMessage[];
  createdAt: number;
}

interface ScoutChatWithHistoryProps {
  /** Incoming context from Signals page (e.g. when user clicks "Chat with Scout" from a signal) */
  initialContext: SignalsChatContext | null;
  onClearContext?: () => void;
  editHistory?: EditRecord[];
  onTabChange?: (tab: string) => void;
}

function getSessionTitle(context: SignalsChatContext | null): string {
  if (!context) return "New chat";
  const heading = context.signalHeading ?? context.recommendation ?? context.recommendations?.[0];
  if (heading && typeof heading === "string") {
    return heading;
  }
  return "Signal chat";
}

function generateId(): string {
  return `scout_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ScoutChatWithHistory({
  initialContext,
  onClearContext,
  editHistory = [],
  onTabChange,
}: ScoutChatWithHistoryProps) {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const storageKey = currentUser?.uid ? `${STORAGE_KEY_PREFIX}_${currentUser.uid}` : null;

  // Load sessions from localStorage and process leadStreamChatContext in one pass
  // so "Ask Scout" from Lead Stream correctly activates that session (not a Signals session)
  useEffect(() => {
    if (!storageKey) return;
    try {
      let loadedSessions: ChatSession[] = [];
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatSession[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedSessions = parsed.map((s) => {
            const { leadContext: _leadContext, ...rest } = s;
            const session = { ...rest };
            if (session.context && (session.title.endsWith("…") || session.title.length < 50)) {
              session.title = getSessionTitle(session.context);
            }
            return session as ChatSession;
          });
        }
      }

      const leadStored = sessionStorage.getItem(LEAD_STREAM_CHAT_CONTEXT_KEY);
      if (leadStored) {
        try {
          const ctx = JSON.parse(leadStored) as LeadStreamChatContext;
          sessionStorage.removeItem(LEAD_STREAM_CHAT_CONTEXT_KEY);
          const title =
            ctx.sessionTitle ??
            (ctx.company && ctx.personName
              ? `Research: ${ctx.personName}`
              : ctx.company
                ? `Research: ${ctx.company}`
                : "Ask Scout about leads");
          const newSession: ChatSession = {
            id: generateId(),
            title,
            context: null,
            leadContext: ctx,
            messages: [],
            createdAt: Date.now(),
          };
          setSessions([newSession, ...loadedSessions]);
          setActiveSessionId(newSession.id);
          return;
        } catch {
          sessionStorage.removeItem(LEAD_STREAM_CHAT_CONTEXT_KEY);
        }
      }

      if (loadedSessions.length > 0) {
        setSessions(loadedSessions);
        setActiveSessionId(loadedSessions[0].id);
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Persist sessions to localStorage (strip leadContext so Suggested companies only show when coming from Lead Stream)
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (sessions.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        const toSave = sessions.map(({ leadContext: _leadContext, ...rest }) => rest);
        localStorage.setItem(storageKey, JSON.stringify(toSave));
      }
    } catch {
      // ignore
    }
  }, [storageKey, sessions]);

  const processedContextRef = useRef<string | null>(null);

  // When initialContext arrives (from Signals page), add as new session or switch to existing
  useEffect(() => {
    if (!initialContext) return;

    const contextKey = [
      initialContext.contentHash,
      initialContext.signalHeading,
      initialContext.recommendation,
      initialContext.answer ? "a" : "",
    ]
      .filter(Boolean)
      .join("|");

    if (processedContextRef.current === contextKey) return;
    processedContextRef.current = contextKey;

    const title = getSessionTitle(initialContext);
    const contentHash =
      initialContext.contentHash ??
      initialContext.signalHeading ??
      initialContext.recommendation ??
      "";

    setSessions((prev) => {
      const existing = prev.find(
        (s) =>
          s.context &&
          (s.context.contentHash === contentHash ||
            (s.context.signalHeading === initialContext.signalHeading &&
              s.context.recommendation === initialContext.recommendation)),
      );
      if (existing) {
        setActiveSessionId(existing.id);
        // Update context with answer from Signals page so we don't re-fetch on Chat page
        const mergedContext = initialContext.answer
          ? { ...existing.context!, ...initialContext }
          : existing.context!;
        return prev.map((s) => (s.id === existing.id ? { ...s, context: mergedContext } : s));
      }

      const newSession: ChatSession = {
        id: generateId(),
        title,
        context: initialContext,
        messages: [],
        createdAt: Date.now(),
      };
      setActiveSessionId(newSession.id);
      return [newSession, ...prev];
    });
    // initialContext object itself intentionally omitted: the effect keys
    // on specific stable fields above; tracking the object identity would
    // re-run on every parent re-render even when content is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialContext?.contentHash,
    initialContext?.signalHeading,
    initialContext?.recommendation,
    initialContext?.answer,
  ]);

  const handleNewChat = useCallback(() => {
    setSuggestionPrefill(null);
    const newSession: ChatSession = {
      id: generateId(),
      title: "New chat",
      context: null,
      messages: [],
      createdAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    onClearContext?.();
    sessionStorage.removeItem("signalsChatContext");
    sessionStorage.removeItem(LEAD_STREAM_CHAT_CONTEXT_KEY);
  }, [onClearContext]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const handleCloseChat = useCallback(() => {
    if (!activeSessionId) return;
    const currentId = activeSessionId;
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== currentId);
      const currentIndex = prev.findIndex((s) => s.id === currentId);
      const nextSession = filtered[currentIndex] ?? filtered[currentIndex - 1] ?? filtered[0];
      setActiveSessionId(nextSession?.id ?? null);
      return filtered;
    });
  }, [activeSessionId]);

  const handleDeleteSession = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      const isActive = activeSessionId === sessionId;
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionId);
        if (isActive) {
          const currentIndex = prev.findIndex((s) => s.id === sessionId);
          const nextSession = filtered[currentIndex] ?? filtered[currentIndex - 1] ?? filtered[0];
          setActiveSessionId(nextSession?.id ?? null);
        }
        return filtered;
      });
    },
    [activeSessionId],
  );

  const handleMessagesChange = useCallback(
    (sessionId: string) => (messages: ChatMessage[]) => {
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, messages } : s)));
    },
    [],
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const [suggestionPrefill, setSuggestionPrefill] = useState<string | null>(null);
  const [addLeadModalOpen, setAddLeadModalOpen] = useState(false);
  const [addLeadInitialData, setAddLeadInitialData] = useState<
    { companyName?: string; companyWebsite?: string } | undefined
  >();

  const handleAddToLeadStream = useCallback(
    (company: { companyName?: string; companyWebsite?: string }) => {
      setAddLeadInitialData(company);
      setAddLeadModalOpen(true);
    },
    [],
  );

  const handleLeadAdded = useCallback(() => {
    window.dispatchEvent(new CustomEvent("leadStreamRefresh"));
  }, []);

  const clearSuggestionPrefill = useCallback(() => setSuggestionPrefill(null), []);

  return (
    <div className="flex h-full min-h-0 w-full max-w-none overflow-hidden">
      {/* Sidebar - Chat history */}
      <div
        className={`flex flex-col border-r border-border bg-muted/30 transition-all duration-200 ${
          sidebarOpen
            ? "w-64 sm:w-72 min-w-[14rem] max-w-[min(18rem,42vw)] shrink-0"
            : "w-0 overflow-hidden"
        }`}
      >
        {sidebarOpen && (
          <>
            <div className="relative flex items-center justify-center p-3 border-b border-border">
              <h3 className="text-sm font-medium text-foreground">Chat history</h3>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 h-8 w-8 p-0"
                onClick={() => setSidebarOpen(false)}
                title="Close sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="default"
              size="sm"
              className="m-2 mx-3 flex items-center gap-2"
              onClick={handleNewChat}
            >
              <MessageSquarePlus className="h-4 w-4" />
              New chat
            </Button>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pr-4">
              <div className="space-y-3 py-2 min-w-0 w-full">
                {sessions.map((session) => {
                  const displayTitle = session.context
                    ? getSessionTitle(session.context)
                    : (session.leadContext?.sessionTitle ?? session.title);
                  return (
                    <div
                      key={session.id}
                      className={`group flex items-center gap-1 w-full rounded-lg pl-3 pr-2 py-2.5 text-left text-sm transition-colors ${
                        activeSessionId === session.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectSession(session.id)}
                        className="flex-1 flex gap-2 min-w-0 text-left"
                        title={displayTitle}
                      >
                        <MessageCircle className="h-4 w-4 mt-0.5 shrink-0 flex-shrink-0" />
                        <span className="flex-1 min-w-0 break-words text-left block [overflow-wrap:anywhere] whitespace-normal">
                          {displayTitle}
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        title="Remove from history"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col relative overflow-hidden">
        {/* Toggle sidebar when collapsed */}
        {!sidebarOpen && (
          <Button
            variant="outline"
            size="sm"
            className="absolute left-3 top-3 z-10 h-8 w-8 p-0 border-muted-foreground/20"
            onClick={() => setSidebarOpen(true)}
            title="Open chat history"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
        {activeSession ? (
          activeSession.context ? (
            <ContextChat
              key={activeSession.id}
              context={activeSession.context}
              initialMessages={activeSession.messages}
              onMessagesChange={handleMessagesChange(activeSession.id)}
              onClose={handleCloseChat}
              onClearContext={() => {
                sessionStorage.removeItem("signalsChatContext");
                onClearContext?.();
                handleNewChat();
              }}
            />
          ) : (
            <div className="flex flex-1 min-h-0 w-full min-w-0 flex-col overflow-hidden">
              <div className="flex flex-col gap-3 flex-1 min-h-0 min-w-0 overflow-hidden">
                {onTabChange && activeSession.leadContext && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-fit -ml-1 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => onTabChange("analysis")}
                  >
                    <Users className="h-4 w-4 mr-1.5" />
                    Back to Lead Stream
                  </Button>
                )}
                <ScoutChatPanel
                  key={activeSession.id}
                  showScoutChat={true}
                  isSplitView={false}
                  hasEdits={false}
                  showEditHistory={false}
                  editHistory={editHistory}
                  lastEditedField=""
                  context={activeSession.leadContext ? "lead-stream" : "general"}
                  customMessage={activeSession.leadContext?.customMessage}
                  workspaceLine={activeSession.leadContext?.workspaceLine}
                  inputPlaceholder={
                    activeSession.leadContext?.personName
                      ? `Ask Scout about ${activeSession.leadContext.personName}…`
                      : activeSession.leadContext?.leadCount
                        ? `Ask Scout about these ${activeSession.leadContext.leadCount} leads…`
                        : undefined
                  }
                  prefillQuestion={suggestionPrefill}
                  onPrefillConsumed={clearSuggestionPrefill}
                  suggestedQuestions={activeSession.leadContext?.suggestedQuestions}
                  onPickSuggestedQuestion={setSuggestionPrefill}
                  leadHeaderDetail={
                    activeSession.leadContext?.personName
                      ? {
                          type: "single",
                          company: activeSession.leadContext.company,
                          source: activeSession.leadContext.source,
                        }
                      : activeSession.leadContext?.leadSummaries &&
                          activeSession.leadContext.leadSummaries.length > 0
                        ? {
                            type: "multi",
                            leadCount:
                              activeSession.leadContext.leadCount ??
                              activeSession.leadContext.leadSummaries.length,
                            leadSummaries: activeSession.leadContext.leadSummaries,
                          }
                        : undefined
                  }
                  onClose={handleCloseChat}
                  hideCloseButton={!!activeSession.leadContext}
                />
                {activeSession.leadContext && (
                  <SuggestedCompaniesSection onAddToLeadStream={handleAddToLeadStream} />
                )}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Chat with Scout</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Start a new conversation or select a signal from the Signals page to discuss it with
                Scout.
              </p>
            </div>
          </div>
        )}
      </div>
      <AddLeadModal
        open={addLeadModalOpen}
        onOpenChange={setAddLeadModalOpen}
        initialData={addLeadInitialData}
        onSuccess={handleLeadAdded}
      />
    </div>
  );
}
