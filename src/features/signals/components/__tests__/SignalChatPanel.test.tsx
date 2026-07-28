import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SignalCard as SignalCardType } from "../../types";
import { SignalChatPanel } from "../SignalChatPanel";

const signal: SignalCardType = {
  id: "sig-1",
  agent: "scout",
  timestamp: "1h ago",
  headline: "Competitor X launches SMB pricing tier.",
  snippet: "Likely to impact your ICP accounts.",
  description: "Detailed ICP context paragraph.",
  sourceUrl: "#",
  sourceLabel: "Press release link",
  source: [],
  nextBestMoves: [],
  NBAs: [],
  contextualSuggestions: [{ icon: "🔗", text: "Get Company X's Website" }],
};

// fireEvent (sync) is the suite-wide click driver here (no user-event dep).
function renderPanel(overrides: Partial<React.ComponentProps<typeof SignalChatPanel>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    selectedSignal: signal,
    chatMessage: "",
    onChatMessageChange: vi.fn(),
    getContextualGreeting: () => "Hi 👋, ready to delegate.",
    getContextualSuggestions: () => [],
    onDelegateSuggestion: vi.fn(),
    onSaveNotes: vi.fn(),
    ...overrides,
  };
  render(<SignalChatPanel {...props} />);
  return props;
}

describe("SignalChatPanel", () => {
  it("renders the selected signal headline, greeting, and the signal's own suggestions", () => {
    renderPanel();
    expect(screen.getByText("Agent Discussion")).toBeInTheDocument();
    expect(screen.getByText("Hi 👋, ready to delegate.")).toBeInTheDocument();
    expect(screen.getByText("Competitor X launches SMB pricing tier.")).toBeInTheDocument();
    expect(screen.getByText("Get Company X's Website")).toBeInTheDocument();
  });

  it("fires onDelegateSuggestion when a quick-action suggestion is clicked", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByText("Get Company X's Website"));
    expect(props.onDelegateSuggestion).toHaveBeenCalledWith({
      icon: "🔗",
      text: "Get Company X's Website",
    });
  });

  it("fires onChatMessageChange as the notes input is edited", () => {
    const props = renderPanel();
    fireEvent.change(
      screen.getByPlaceholderText(/Type your thoughts, questions, or specific instructions/i),
      { target: { value: "my note" } },
    );
    expect(props.onChatMessageChange).toHaveBeenCalledWith("my note");
  });

  it("fires onSaveNotes when the send button is clicked", () => {
    const props = renderPanel({ chatMessage: "my note" });
    // The send button is the last button (after the close X and the suggestion).
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(props.onSaveNotes).toHaveBeenCalledTimes(1);
  });
});
