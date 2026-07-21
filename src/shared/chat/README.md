# `shared/chat` — scout/profiler chat substrate

## Purpose

The cross-feature scout/profiler chat substrate (Spec 27 §5). It lives in `shared/`
(not in a feature) because both `market-research` (`ScoutChatWithHistory`) and
`customers` (`ProfilerChatWithHistory`) consume it, and `shared ↛ features`. It was
relocated here from the legacy `src/components/signals/` path with all importers
repointed (TD-FE-45); the shared-chat story is summarized below.

## Public surface

Imported via `@/shared/chat` (index-only). Internals are private.

| Export            | Kind      | Description                                                                                                                                                                         |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContextChat`     | component | The chat panel. Props: `context: ChatContext` (required), `onClearContext?`, `onClose?`, `initialMessages?: ChatMessage[]`, `onMessagesChange?: (messages: ChatMessage[]) => void`. |
| `ChatContext`     | type      | The chat context shape: `agent: "scout" \| "profiler"`, `signalId?`, `contentHash?`, `signalHeading?`, `recommendations?`, `recommendation?`, `prompt`, `answer?`.                  |
| `ChatMessage`     | type      | `{ role: "user" \| "assistant"; content: string }`.                                                                                                                                 |
| `useSignalAsk`    | hook      | TanStack mutation for the signal **Ask** (chat question) call. Also exports the `SignalAskBody` body type.                                                                          |
| `useSignalAction` | hook      | TanStack mutation for the signal **action** (accept/reject) call. Also exports the `SignalActionVars` vars type.                                                                    |

The `useSignalAsk` / `useSignalAction` hooks are the single mutation path shared by both
the substrate and the `signals` page.

## Shared-chat ownership

Two pieces sit on top of the relocation:

- **Wrapper dedup.** `ProfilerChatWithHistory` (in `customers`) and `ScoutChatWithHistory`
  (in `market-research`) are ~90% the same wrapper around this substrate. The parameterised
  `ChatWithHistory` component exists to unify them; collapsing both wrappers onto it is the
  remaining open item (the substrate relocation + importer repointing is TD-FE-45).
- **Rename.** `SignalsContextChat` was renamed to `ContextChat`, and the context type
  `SignalsChatContext` was renamed to `ChatContext` — TD-FE-61.
