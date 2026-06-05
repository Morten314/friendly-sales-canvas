import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScoutChatWithHistory } from "../ScoutChatWithHistory";

import type * as SharedChat from "@/shared/chat";

// Mock the substrate so no real fetch/WebSocket fires, but keep the real
// ChatWithHistory shell (the wrapper now renders it).
vi.mock("@/shared/chat", async () => {
  const actual = await vi.importActual<typeof SharedChat>("@/shared/chat");
  return {
    ...actual,
    ContextChat: () => <div data-testid="substrate" />,
  };
});

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

vi.mock("../ScoutChatPanel", () => ({
  default: () => <div />,
}));

vi.mock("../AddLeadModal", () => ({ AddLeadModal: () => <div /> }));

vi.mock("../SuggestedCompaniesSection", () => ({
  SuggestedCompaniesSection: () => <div />,
}));

describe("ScoutChatWithHistory (relocated)", () => {
  it("mounts with a null initial context", () => {
    // initialContext: null + empty localStorage → the sidebar (open by default)
    // renders its "New chat" button, a stable mount signal. (Scout's empty
    // state itself has no "New chat" button — showNewChatButton: false.)
    const { container } = render(<ScoutChatWithHistory initialContext={null} />);
    expect(container).toBeTruthy();
    expect(screen.getAllByText("New chat").length).toBeGreaterThan(0);
  });
});
