# `shared/chat` — scout/profiler chat substrate

## Purpose

The cross-feature scout/profiler chat substrate (Spec 27 §5). It lives in `shared/`
(not in a feature) because both `market-research` (`ScoutChatWithHistory`) and
`customers` (`ProfilerChatWithHistory`) consume it, and `shared ↛ features`. Phase 8
relocated it here from the legacy `src/components/signals/` path and repointed all
importers; Phase 9 finalizes the shared-chat story (see below).

## Public surface (for Phase 9)

Imported via `@/shared/chat` (index-only). Internals are private.

| Export               | Kind      | Description                                                                                                                                                                                |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ContextChat`        | component | The chat panel. Props: `context: SignalsChatContext` (required), `onClearContext?`, `onClose?`, `initialMessages?: ChatMessage[]`, `onMessagesChange?: (messages: ChatMessage[]) => void`. |
| `SignalsChatContext` | type      | The chat context shape: `agent: "scout" \| "profiler"`, `signalId?`, `contentHash?`, `signalHeading?`, `recommendations?`, `recommendation?`, `prompt`, `answer?`.                         |
| `ChatMessage`        | type      | `{ role: "user" \| "assistant"; content: string }`.                                                                                                                                        |
| `useSignalAsk`       | hook      | TanStack mutation for the signal **Ask** (chat question) call. Also exports the `SignalAskBody` body type.                                                                                 |
| `useSignalAction`    | hook      | TanStack mutation for the signal **action** (accept/reject) call. Also exports the `SignalActionVars` vars type.                                                                           |

The `useSignalAsk` / `useSignalAction` hooks are the single mutation path shared by both
the substrate and the `signals` page.

## Phase 9 ownership

Two pieces were explicitly **Phase 9's** to finish, not Phase 8's:

- **Wrapper dedup.** `ProfilerChatWithHistory` (in `customers`) and `ScoutChatWithHistory`
  (in `market-research`) are ~90% the same wrapper around this substrate. Phase 9 owns
  unifying them into one parameterised component via `ChatWithHistory` (see `ChatWithHistory`);
  Phase 8 only relocated the substrate + repointed importers (TD-FE-45).
- **Rename.** Renamed `SignalsContextChat` → `ContextChat` in Phase 9; the `SignalsChatContext`
  type name is retained — TD-FE-61.
