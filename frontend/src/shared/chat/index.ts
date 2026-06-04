// Cross-feature scout/profiler chat substrate (Spec 27 §5). Consumed by
// market-research (ScoutChatWithHistory) + customers (ProfilerChatWithHistory).
// Phase 9 owns the ScoutChat↔ProfilerChat wrapper dedup; the substrate keeps
// its `SignalsContextChat` name through Phase 8 for move-traceability.
export { SignalsContextChat } from "./SignalsContextChat";
export type { SignalsChatContext, ChatMessage } from "./SignalsContextChat";
