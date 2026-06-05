// Cross-feature scout/profiler chat substrate (Spec 27 §5). Consumed by
// market-research (ScoutChatWithHistory) + customers (ProfilerChatWithHistory).
// Phase 9 owns the ScoutChat↔ProfilerChat wrapper dedup; the substrate keeps
// its `SignalsContextChat` name through Phase 8 for move-traceability.
export { SignalsContextChat } from "./SignalsContextChat";
export type { SignalsChatContext, ChatMessage } from "./SignalsContextChat";

// Shared signal_Ask/signal_action TanStack hooks (Phase 8). Consumed by the
// signals page + the substrate; live in shared/ because `shared ↛ features`.
export { useSignalAsk, type SignalAskBody } from "./useSignalAsk";
export { useSignalAction, type SignalActionVars } from "./useSignalAction";
