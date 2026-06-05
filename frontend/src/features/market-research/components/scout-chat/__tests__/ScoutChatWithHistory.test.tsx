import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScoutChatWithHistory } from "../ScoutChatWithHistory";

// Mock the heavy children so the test stays a pure mount check
// (no real fetch/WebSocket, no nested chat substrate).
vi.mock("@/shared/chat", () => ({
  ContextChat: () => <div data-testid="substrate" />,
}));

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

vi.mock("@/components/market-research/ScoutChatPanel", () => ({
  default: () => <div />,
}));

vi.mock("../AddLeadModal", () => ({ AddLeadModal: () => <div /> }));

vi.mock("../SuggestedCompaniesSection", () => ({
  SuggestedCompaniesSection: () => <div />,
}));

describe("ScoutChatWithHistory (relocated)", () => {
  it("mounts with a null initial context", () => {
    // initialContext: null + empty localStorage → empty state renders the
    // "New chat" sidebar button, a stable mount signal.
    const { container } = render(<ScoutChatWithHistory initialContext={null} />);
    expect(container).toBeTruthy();
    expect(screen.getAllByText("New chat").length).toBeGreaterThan(0);
  });
});
