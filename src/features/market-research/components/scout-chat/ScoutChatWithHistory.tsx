import { Users } from "lucide-react";
import { useState, useCallback } from "react";

import {
  LEAD_STREAM_CHAT_CONTEXT_KEY,
  type LeadStreamChatContext,
} from "../../lib/leadStreamChatContext";
import type { EditRecord } from "../types";

import { AddLeadModal } from "./AddLeadModal";
import ScoutChatPanel from "./ScoutChatPanel";
import { SuggestedCompaniesSection } from "./SuggestedCompaniesSection";

import { Button } from "@/components/ui/button";
import type {
  ChatContext,
  ChatSession,
  ChatWithHistoryConfig,
  ChatWithHistoryProps,
} from "@/shared/chat";
import { ChatWithHistory, ContextChat } from "@/shared/chat";

interface ScoutSessionMeta {
  /** Full LeadStreamChatContext; its sessionTitle (when set) overrides the session's stored title in the sidebar. */
  leadContext?: LeadStreamChatContext;
}

// Alias avoids `<ChatWithHistory<T>>` JSX generics — lovable-tagger injects
// data-lov-* attrs between the name and `<T>`, which produces invalid JSX.
const ScoutChatShell = ChatWithHistory as (
  props: ChatWithHistoryProps<ScoutSessionMeta>,
) => JSX.Element;

/** Strip per-session `meta` (Scout's leadContext) before persist — keeps the on-disk
 *  shape `{ id, title, context, messages, createdAt }` identical to pre-shell Scout. */
function stripSessionMeta(
  s: ChatSession<ScoutSessionMeta>,
): Omit<ChatSession<ScoutSessionMeta>, "meta"> {
  const { meta: _meta, ...rest } = s;
  return rest;
}

interface ScoutChatWithHistoryProps {
  /** Incoming context from Signals page (e.g. when user clicks "Chat with Scout" from a signal) */
  initialContext: ChatContext | null;
  onClearContext?: () => void;
  editHistory?: EditRecord[];
  onTabChange?: (tab: string) => void;
}

const SCOUT_CHAT_CONFIG: ChatWithHistoryConfig = {
  agent: "scout",
  storageKeyPrefix: "scout_chat_sessions",
  sessionIdPrefix: "scout_",
  sidebarOpenClassName: "w-64 sm:w-72 min-w-[14rem] max-w-[min(18rem,42vw)] shrink-0",
  outerMaxWidthNone: true,
  emptyState: {
    heading: "Chat with Scout",
    body: "Start a new conversation or select a signal from the Signals page to discuss it with Scout.",
    showNewChatButton: false,
  },
};

export function ScoutChatWithHistory({
  initialContext,
  onClearContext,
  editHistory = [],
  onTabChange,
}: ScoutChatWithHistoryProps) {
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

  // Lift Scout's load-time lead-stream injection: read the sessionStorage handoff
  // and, if present, build the synthetic "Research: …" session to prepend.
  const hydrateExtraSessions = useCallback((): ChatSession<ScoutSessionMeta>[] => {
    const leadStored = sessionStorage.getItem(LEAD_STREAM_CHAT_CONTEXT_KEY);
    if (!leadStored) return [];
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
      const newSession: ChatSession<ScoutSessionMeta> = {
        id: `scout_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        title,
        context: null,
        messages: [],
        createdAt: Date.now(),
        meta: { leadContext: ctx },
      };
      return [newSession];
    } catch {
      sessionStorage.removeItem(LEAD_STREAM_CHAT_CONTEXT_KEY);
      return [];
    }
  }, []);

  return (
    <ScoutChatShell
      config={SCOUT_CHAT_CONFIG}
      initialContext={initialContext}
      onClearContext={onClearContext}
      getSessionDisplayTitle={(s) => s.meta?.leadContext?.sessionTitle ?? s.title}
      hydrateExtraSessions={hydrateExtraSessions}
      serializeSession={stripSessionMeta}
      onNewChat={() => {
        setSuggestionPrefill(null);
        // Clear any pending lead-stream handoff so a new chat starts clean.
        sessionStorage.removeItem(LEAD_STREAM_CHAT_CONTEXT_KEY);
      }}
      renderChat={({ session, onMessagesChange, onClearContext: onClear, onCloseChat }) =>
        session.context ? (
          <ContextChat
            key={session.id}
            context={session.context}
            initialMessages={session.messages}
            onMessagesChange={onMessagesChange}
            onClose={onCloseChat}
            onClearContext={onClear}
          />
        ) : (
          <div className="flex flex-1 min-h-0 w-full min-w-0 flex-col overflow-hidden">
            <div className="flex flex-col gap-3 flex-1 min-h-0 min-w-0 overflow-hidden">
              {onTabChange && session.meta?.leadContext && (
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
                key={session.id}
                showScoutChat={true}
                isSplitView={false}
                hasEdits={false}
                showEditHistory={false}
                editHistory={editHistory}
                lastEditedField=""
                context={session.meta?.leadContext ? "lead-stream" : "general"}
                customMessage={session.meta?.leadContext?.customMessage}
                workspaceLine={session.meta?.leadContext?.workspaceLine}
                inputPlaceholder={
                  session.meta?.leadContext?.personName
                    ? `Ask Scout about ${session.meta.leadContext.personName}…`
                    : session.meta?.leadContext?.leadCount
                      ? `Ask Scout about these ${session.meta.leadContext.leadCount} leads…`
                      : undefined
                }
                prefillQuestion={suggestionPrefill}
                onPrefillConsumed={clearSuggestionPrefill}
                suggestedQuestions={session.meta?.leadContext?.suggestedQuestions}
                onPickSuggestedQuestion={setSuggestionPrefill}
                leadHeaderDetail={
                  session.meta?.leadContext?.personName
                    ? {
                        type: "single",
                        company: session.meta.leadContext.company,
                        source: session.meta.leadContext.source,
                      }
                    : session.meta?.leadContext?.leadSummaries &&
                        session.meta.leadContext.leadSummaries.length > 0
                      ? {
                          type: "multi",
                          leadCount:
                            session.meta.leadContext.leadCount ??
                            session.meta.leadContext.leadSummaries.length,
                          leadSummaries: session.meta.leadContext.leadSummaries,
                        }
                      : undefined
                }
                onClose={onCloseChat}
                hideCloseButton={!!session.meta?.leadContext}
              />
              {session.meta?.leadContext && (
                <SuggestedCompaniesSection onAddToLeadStream={handleAddToLeadStream} />
              )}
            </div>
          </div>
        )
      }
      renderExtras={() => (
        <AddLeadModal
          open={addLeadModalOpen}
          onOpenChange={setAddLeadModalOpen}
          initialData={addLeadInitialData}
          onSuccess={handleLeadAdded}
        />
      )}
    />
  );
}
