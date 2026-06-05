import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProfilerChatWithHistory } from "../ProfilerChatWithHistory";

import type * as SharedChat from "@/shared/chat";

// Mock the substrate so no real fetch/WebSocket fires, but keep the real
// ChatWithHistory shell (the wrapper now renders it).
vi.mock("@/shared/chat", async () => {
  const actual = await vi.importActual<typeof SharedChat>("@/shared/chat");
  return {
    ...actual,
    ContextChat: () => <div data-testid="signals-context-chat" />,
  };
});

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

describe("ProfilerChatWithHistory (relocated)", () => {
  it("renders without crashing", () => {
    // initialContext: null + empty localStorage → empty state renders "New chat" button.
    render(<ProfilerChatWithHistory initialContext={null} onClearContext={() => {}} />);
    // The empty state always renders a "New chat" button — a stable mount signal.
    expect(screen.getAllByText("New chat").length).toBeGreaterThan(0);
  });
});
