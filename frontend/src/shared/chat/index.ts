// Cross-feature scout/profiler chat substrate. Consumed by market-research
// (ScoutChatWithHistory) + customers (ProfilerChatWithHistory) via the shared
// history shell. The substrate keeps the `SignalsChatContext` TYPE name (TD-FE-61).
export { ContextChat } from "./ContextChat";
export type { SignalsChatContext, ChatMessage } from "./ContextChat";

// Shared signal_Ask/signal_action TanStack hooks (Phase 8). Consumed by the
// signals page + the substrate; live in shared/ because `shared ↛ features`.
export { useSignalAsk, type SignalAskBody } from "./useSignalAsk";
export { useSignalAction, type SignalActionVars } from "./useSignalAction";

// Persona-agnostic history shell (Phase 9). Owns session/sidebar/persistence
// machinery; consumed by ScoutChatWithHistory + ProfilerChatWithHistory via
// render props. Briefly an unused export until those wrappers collapse onto it.
export { ChatWithHistory } from "./ChatWithHistory";
export type {
  ChatSession,
  ChatWithHistoryConfig,
  ChatWithHistoryProps,
  ChatWithHistoryRenderState,
} from "./ChatWithHistory";
