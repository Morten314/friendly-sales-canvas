import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus, PanelLeftClose, PanelLeft, MessageCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SignalsContextChat, SignalsChatContext, ChatMessage } from './SignalsContextChat';

const STORAGE_KEY_PREFIX = 'profiler_chat_sessions';

export interface ProfilerChatSession {
  id: string;
  title: string;
  context: SignalsChatContext | null;
  messages: ChatMessage[];
  createdAt: number;
}

interface ProfilerChatWithHistoryProps {
  /** Incoming context from Signals page (e.g. when user clicks "Chat with Profiler" from a signal) */
  initialContext: SignalsChatContext | null;
  onClearContext?: () => void;
  onTabChange?: (tab: string) => void;
}

function getSessionTitle(context: SignalsChatContext | null): string {
  if (!context) return 'New chat';
  const heading = context.signalHeading ?? context.recommendation ?? context.recommendations?.[0];
  if (heading && typeof heading === 'string') {
    return heading;
  }
  return 'Signal chat';
}

function generateId(): string {
  return `profiler_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Minimal context for general Profiler chat (no signal) */
const EMPTY_PROFILER_CONTEXT: SignalsChatContext = {
  agent: 'profiler',
  prompt: '',
};

export function ProfilerChatWithHistory({
  initialContext,
  onClearContext,
  onTabChange,
}: ProfilerChatWithHistoryProps) {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<ProfilerChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const storageKey = currentUser?.uid ? `${STORAGE_KEY_PREFIX}_${currentUser.uid}` : null;

  // Load sessions from localStorage (with migration: fix truncated titles from context)
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ProfilerChatSession[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = parsed.map((s) => {
            if (s.context && (s.title.endsWith('…') || s.title.length < 50)) {
              return { ...s, title: getSessionTitle(s.context) };
            }
            return s;
          });
          setSessions(migrated);
          if (!activeSessionId && migrated.length > 0) {
            setActiveSessionId(migrated[0].id);
          }
        }
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
        localStorage.setItem(storageKey, JSON.stringify(sessions));
      }
    } catch {
      // ignore
    }
  }, [storageKey, sessions]);

  const processedContextRef = useRef<string | null>(null);

  // When initialContext arrives (from Signals page), add as new session or switch to existing
  useEffect(() => {
    if (!initialContext || initialContext.agent !== 'profiler') return;

    const contextKey = [
      initialContext.contentHash,
      initialContext.signalHeading,
      initialContext.recommendation,
    ].filter(Boolean).join('|');

    if (processedContextRef.current === contextKey) return;
    processedContextRef.current = contextKey;

    const title = getSessionTitle(initialContext);
    const contentHash = initialContext.contentHash ?? initialContext.signalHeading ?? initialContext.recommendation ?? '';

    setSessions((prev) => {
      const existing = prev.find(
        (s) =>
          s.context &&
          (s.context.contentHash === contentHash ||
            (s.context.signalHeading === initialContext.signalHeading && s.context.recommendation === initialContext.recommendation))
      );
      if (existing) {
        setActiveSessionId(existing.id);
        return prev;
      }

      const newSession: ProfilerChatSession = {
        id: generateId(),
        title,
        context: initialContext,
        messages: [],
        createdAt: Date.now(),
      };
      setActiveSessionId(newSession.id);
      return [newSession, ...prev];
    });
  }, [initialContext?.contentHash, initialContext?.signalHeading, initialContext?.recommendation, initialContext?.agent]);

  const handleNewChat = useCallback(() => {
    const newSession: ProfilerChatSession = {
      id: generateId(),
      title: 'New chat',
      context: null,
      messages: [],
      createdAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    onClearContext?.();
    sessionStorage.removeItem('signalsChatContext');
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

  const handleDeleteSession = useCallback((e: React.MouseEvent, sessionId: string) => {
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
  }, [activeSessionId]);

  const handleMessagesChange = useCallback(
    (sessionId: string) => (messages: ChatMessage[]) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, messages } : s))
      );
    },
    []
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* Sidebar - Chat history */}
      <div
        className={`flex flex-col border-r border-border bg-muted/30 transition-all duration-200 ${
          sidebarOpen ? 'w-[28rem] min-w-[24rem] max-w-[90vw] shrink-0' : 'w-0 overflow-hidden'
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
                  const displayTitle = session.context ? getSessionTitle(session.context) : session.title;
                  return (
                    <div
                      key={session.id}
                      className={`group flex items-center gap-1 w-full rounded-lg pl-3 pr-2 py-2.5 text-left text-sm transition-colors ${
                        activeSessionId === session.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectSession(session.id)}
                        className="flex-1 flex gap-2 min-w-0 text-left"
                        title={displayTitle}
                      >
                        <MessageCircle className="h-4 w-4 mt-0.5 shrink-0 flex-shrink-0" />
                        <span className="flex-1 min-w-0 break-words text-left block [overflow-wrap:anywhere] whitespace-normal">{displayTitle}</span>
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
          <SignalsContextChat
            key={activeSession.id}
            context={activeSession.context ?? EMPTY_PROFILER_CONTEXT}
            initialMessages={activeSession.messages}
            onMessagesChange={handleMessagesChange(activeSession.id)}
            onClose={handleCloseChat}
            onClearContext={() => {
              sessionStorage.removeItem('signalsChatContext');
              onClearContext?.();
              handleNewChat();
            }}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Chat with Profiler</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Start a new conversation or select a signal from the Signals page to discuss it with Profiler.
              </p>
              <Button onClick={handleNewChat} className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4" />
                New chat
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
