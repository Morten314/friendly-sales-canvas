import { ChatWithHistory, ContextChat, type ChatWithHistoryConfig } from "@/shared/chat";
import type { ChatContext } from "@/shared/chat";

interface ProfilerChatWithHistoryProps {
  /** Incoming context from the Signals page (e.g. "Chat with Profiler" from a signal). */
  initialContext: ChatContext | null;
  onClearContext?: () => void;
}

/** Minimal context for general Profiler chat (no signal). */
const EMPTY_PROFILER_CONTEXT: ChatContext = { agent: "profiler", prompt: "" };

const PROFILER_CHAT_CONFIG: ChatWithHistoryConfig = {
  agent: "profiler",
  storageKeyPrefix: "profiler_chat_sessions",
  sessionIdPrefix: "profiler_",
  sidebarOpenClassName: "w-[28rem] min-w-[24rem] max-w-[90vw] shrink-0",
  gateIncomingByAgent: true,
  emptyState: {
    heading: "Chat with Profiler",
    body: "Start a new conversation or select a signal from the Signals page to discuss it with Profiler.",
    showNewChatButton: true,
  },
};

export function ProfilerChatWithHistory({
  initialContext,
  onClearContext,
}: ProfilerChatWithHistoryProps) {
  return (
    <ChatWithHistory
      config={PROFILER_CHAT_CONFIG}
      initialContext={initialContext}
      onClearContext={onClearContext}
      renderChat={({ session, onMessagesChange, onClearContext: onClear, onCloseChat }) => (
        <ContextChat
          key={session.id}
          context={session.context ?? EMPTY_PROFILER_CONTEXT}
          initialMessages={session.messages}
          onMessagesChange={onMessagesChange}
          onClose={onCloseChat}
          onClearContext={onClear}
        />
      )}
    />
  );
}
