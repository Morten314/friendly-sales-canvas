import { MessageSquarePlus, PanelLeftClose, PanelLeft, MessageCircle, Trash2 } from "lucide-react";
import { useState, useEffect, useRef, type ReactNode } from "react";

import type { ChatContext, ChatMessage } from "./ContextChat";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/shared/auth";

/** A single chat session. `meta` carries persona-only per-session data (scout: { leadContext }). */
export interface ChatSession<TMeta = unknown> {
  id: string;
  title: string;
  context: ChatContext | null;
  messages: ChatMessage[];
  createdAt: number;
  meta?: TMeta;
}

export interface ChatWithHistoryConfig {
  /** Persona. Forwarded into ingest gating; the substrate derives its blue/purple styling from context.agent internally. */
  agent: "scout" | "profiler";
  /** localStorage key prefix; runtime key = `${storageKeyPrefix}_${uid}`. */
  storageKeyPrefix: string;
  /** Session id prefix used by the shell's generateId. */
  sessionIdPrefix: string;
  /** Sidebar OPEN-state width classes (collapsed is always "w-0 overflow-hidden"). */
  sidebarOpenClassName: string;
  /** Scout's outer flex container adds `max-w-none`; profiler omits it. */
  outerMaxWidthNone?: boolean;
  /** When true (profiler), the incoming-context ingest effect ignores contexts whose agent !== config.agent. Scout: false/omit. */
  gateIncomingByAgent?: boolean;
  /** Empty-state (no active session) copy + whether to show the inline "New chat" button. Profiler: button shown; scout: not. */
  emptyState: { heading: string; body: string; showNewChatButton: boolean };
}

/** Passed by the shell into renderChat for the active session. */
export interface ChatWithHistoryRenderState<TMeta = unknown> {
  session: ChatSession<TMeta>;
  /** Patch the active session's messages (curried handler, pre-bound to session.id). */
  onMessagesChange: (messages: ChatMessage[]) => void;
  /** Shared closure: removeItem("signalsChatContext") → props.onClearContext?.() → new chat. */
  onClearContext: () => void;
  /** Delete the active session, select a neighbor (handleCloseChat). */
  onCloseChat: () => void;
}

export interface ChatWithHistoryProps<TMeta = unknown> {
  config: ChatWithHistoryConfig;
  /** Live parent handoff (e.g. signals → chat). Distinct from any per-session context. */
  initialContext: ChatContext | null;
  onClearContext?: () => void;
  /** Session-list title for null-context sessions. Default: () => session.title. Scout: meta.leadContext?.sessionTitle ?? session.title. */
  getSessionDisplayTitle?: (session: ChatSession<TMeta>) => string;
  /** Synthetic sessions to PREPEND on load (scout reads sessionStorage[LEAD_STREAM_CHAT_CONTEXT_KEY]). Default: () => []. */
  hydrateExtraSessions?: () => ChatSession<TMeta>[];
  /** Transform a session before JSON.stringify on persist. Default: identity. Scout strips meta.leadContext. */
  serializeSession?: (session: ChatSession<TMeta>) => unknown;
  /** Extra side-effects appended to the shared new-chat logic (scout: clear prefill + remove LEAD_STREAM key). */
  onNewChat?: () => void;
  /** MAIN chat surface (persona-supplied). */
  renderChat: (state: ChatWithHistoryRenderState<TMeta>) => ReactNode;
  /** Root-level overlays rendered as a sibling of the two-column layout (scout: <AddLeadModal/>). */
  renderExtras?: () => ReactNode;
}

function getSessionTitle(context: ChatContext | null): string {
  if (!context) return "New chat";
  const heading = context.signalHeading ?? context.recommendation ?? context.recommendations?.[0];
  if (heading && typeof heading === "string") {
    return heading;
  }
  return "Signal chat";
}

export function ChatWithHistory<TMeta = unknown>(props: ChatWithHistoryProps<TMeta>) {
  const {
    config,
    initialContext,
    onClearContext,
    getSessionDisplayTitle,
    hydrateExtraSessions,
    serializeSession,
    onNewChat,
    renderChat,
    renderExtras,
  } = props;

  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<ChatSession<TMeta>[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const storageKey = currentUser?.uid ? `${config.storageKeyPrefix}_${currentUser.uid}` : null;

  function generateId(): string {
    return `${config.sessionIdPrefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  // Load sessions from localStorage (with migration: fix truncated titles from context),
  // then prepend any persona-supplied synthetic sessions (scout: lead-stream entry).
  useEffect(() => {
    if (!storageKey) return;
    try {
      let loaded: ChatSession<TMeta>[] = [];
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatSession<TMeta>[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          loaded = parsed.map((s) => {
            if (s.context && (s.title.endsWith("…") || s.title.length < 50)) {
              return { ...s, title: getSessionTitle(s.context) };
            }
            return s;
          });
        }
      }
      const injected = hydrateExtraSessions?.() ?? [];
      const combined = [...injected, ...loaded];
      setSessions(combined);
      if (!activeSessionId && combined.length > 0) {
        setActiveSessionId(combined[0].id);
      }
    } catch {
      // ignore
    }
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist sessions to localStorage
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (sessions.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        const serialize = serializeSession ?? ((s: ChatSession<TMeta>) => s);
        localStorage.setItem(storageKey, JSON.stringify(sessions.map(serialize)));
      }
    } catch {
      // ignore
    }
  }, [storageKey, sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const processedContextRef = useRef<string | null>(null);

  // When initialContext arrives (from Signals page), add as new session or switch to existing
  useEffect(() => {
    if (!initialContext) return;
    if (config.gateIncomingByAgent && initialContext.agent !== config.agent) return;

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

      const newSession: ChatSession<TMeta> = {
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
    initialContext?.agent,
    initialContext?.answer,
    config.agent,
    config.gateIncomingByAgent,
  ]);

  const handleNewChat = () => {
    const newSession: ChatSession<TMeta> = {
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
    onNewChat?.();
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
  };

  const handleCloseChat = () => {
    if (!activeSessionId) return;
    const currentId = activeSessionId;
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== currentId);
      const currentIndex = prev.findIndex((s) => s.id === currentId);
      const nextSession = filtered[currentIndex] ?? filtered[currentIndex - 1] ?? filtered[0];
      setActiveSessionId(nextSession?.id ?? null);
      return filtered;
    });
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
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
  };

  const handleMessagesChange = (sessionId: string) => (messages: ChatMessage[]) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, messages } : s)));
  };

  const handleClearActiveContext = () => {
    sessionStorage.removeItem("signalsChatContext");
    onClearContext?.();
    handleNewChat();
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  return (
    <>
      <div
        className={`flex h-full min-h-0 w-full overflow-hidden${config.outerMaxWidthNone ? " max-w-none" : ""}`}
      >
        {/* Sidebar - Chat history */}
        <div
          className={`flex flex-col border-r border-border bg-muted/30 transition-all duration-200 ${
            sidebarOpen ? config.sidebarOpenClassName : "w-0 overflow-hidden"
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
                      : (getSessionDisplayTitle?.(session) ?? session.title);
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
          {/* renderChat/renderExtras come fresh from the wrapper each render; do NOT memoize this
              call or wrap ChatWithHistory in React.memo (stale-closure guard, see "Render-prop
              semantics" in the shell contract). */}
          {activeSession ? (
            renderChat({
              session: activeSession,
              onMessagesChange: handleMessagesChange(activeSession.id),
              onClearContext: handleClearActiveContext,
              onCloseChat: handleCloseChat,
            })
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">{config.emptyState.heading}</h3>
                <p
                  className={`text-sm text-muted-foreground${
                    config.emptyState.showNewChatButton ? " mb-4" : ""
                  } max-w-sm`}
                >
                  {config.emptyState.body}
                </p>
                {config.emptyState.showNewChatButton && (
                  <Button onClick={handleNewChat} className="flex items-center gap-2">
                    <MessageSquarePlus className="h-4 w-4" />
                    New chat
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {renderExtras?.()}
    </>
  );
}
