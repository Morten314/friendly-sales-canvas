import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the substrate so no real fetch/WebSocket fires.
vi.mock("@/components/signals/SignalsContextChat", () => ({
  SignalsContextChat: () => <div data-testid="signals-context-chat" />,
}));

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

import { ProfilerChatWithHistory } from "../ProfilerChatWithHistory";

describe("ProfilerChatWithHistory (relocated)", () => {
  it("renders without crashing", () => {
    // initialContext: null + empty localStorage → empty state renders "New chat" button.
    render(
      <ProfilerChatWithHistory
        initialContext={null}
        onClearContext={() => {}}
        onTabChange={() => {}}
      />,
    );
    // The empty state always renders a "New chat" button — a stable mount signal.
    expect(screen.getAllByText("New chat").length).toBeGreaterThan(0);
  });
});
