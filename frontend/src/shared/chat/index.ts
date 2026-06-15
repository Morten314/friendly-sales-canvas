// Cross-feature scout/profiler chat substrate. Consumed by market-research
// (ScoutChatWithHistory) + customers (ProfilerChatWithHistory) via the shared
// history shell. The substrate type is `ChatContext` (renamed from SignalsChatContext, TD-FE-61).
export {
  ContextChat,
  CHAT_CONTEXT_SESSION_KEY,
  readSessionChatContext,
  writeSessionChatContext,
} from "./ContextChat";
export type { ChatContext, ChatMessage } from "./ContextChat";

// Shared signal_Ask/signal_action TanStack hooks. Consumed by the
// signals page + the substrate; live in shared/ because `shared ↛ features`.
export { useSignalAsk, type SignalAskBody } from "./useSignalAsk";
export { useSignalAction, type SignalActionVars } from "./useSignalAction";

// Persona-agnostic history shell. Owns session/sidebar/persistence
// machinery; consumed by ScoutChatWithHistory + ProfilerChatWithHistory via
// render props. Briefly an unused export until those wrappers collapse onto it.
export { ChatWithHistory } from "./ChatWithHistory";
export type {
  ChatSession,
  ChatWithHistoryConfig,
  ChatWithHistoryProps,
  ChatWithHistoryRenderState,
} from "./ChatWithHistory";
