import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

import { ChatWithHistory, type ChatWithHistoryConfig } from "@/shared/chat";

const config: ChatWithHistoryConfig = {
  agent: "profiler",
  storageKeyPrefix: "test_chat_sessions",
  sessionIdPrefix: "test_",
  sidebarOpenClassName: "w-64",
  emptyState: { heading: "Chat with Test", body: "Start a chat.", showNewChatButton: true },
};

describe("ChatWithHistory (shell)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders the empty state with a New chat button when configured", () => {
    render(
      <ChatWithHistory
        config={config}
        initialContext={null}
        renderChat={({ session }) => <div data-testid="chat">{session.id}</div>}
      />,
    );
    expect(screen.getByText("Chat with Test")).toBeInTheDocument();
    expect(screen.getAllByText("New chat").length).toBeGreaterThan(0);
  });

  it("creates a session via New chat, calls renderChat, and persists to the configured key", () => {
    render(
      <ChatWithHistory
        config={config}
        initialContext={null}
        renderChat={({ session }) => <div data-testid="chat">{session.id}</div>}
      />,
    );
    // the sidebar "New chat" button (empty-state + sidebar both render one; pick the first)
    fireEvent.click(screen.getAllByText("New chat")[0]);
    expect(screen.getByTestId("chat")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("test_chat_sessions_u1") ?? "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].id).toMatch(/^test_/);
  });

  it("prepends hydrateExtraSessions output and selects it active", () => {
    render(
      <ChatWithHistory
        config={config}
        initialContext={null}
        hydrateExtraSessions={() => [
          { id: "test_injected", title: "Injected", context: null, messages: [], createdAt: 1 },
        ]}
        getSessionDisplayTitle={(s) => s.title}
        renderChat={({ session }) => <div data-testid="chat">{session.id}</div>}
      />,
    );
    expect(screen.getByTestId("chat")).toHaveTextContent("test_injected");
  });

  it("ignores an incoming context whose agent mismatches a gated config", () => {
    render(
      <ChatWithHistory
        config={{ ...config, gateIncomingByAgent: true }}
        initialContext={{ agent: "scout", prompt: "" }}
        renderChat={({ session }) => <div data-testid="chat">{session.id}</div>}
      />,
    );
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
    expect(screen.getByText("Chat with Test")).toBeInTheDocument();
  });
});
