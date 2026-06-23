import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ApolloManageMenu } from "../ApolloManageMenu";

// Radix DropdownMenu uses pointer-capture / scrollIntoView, which jsdom lacks.
// Stub them so the menu opens under fireEvent (the repo has no user-event dep).
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function openMenu() {
  const trigger = screen.getByRole("button", { name: /apollo settings/i });
  fireEvent.keyDown(trigger, { key: " ", code: "Space" });
}

describe("ApolloManageMenu", () => {
  it("renders a gear trigger", () => {
    render(<ApolloManageMenu onUpdateKey={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /apollo settings/i })).toBeInTheDocument();
  });

  it("fires onUpdateKey when 'Update API key' is chosen", async () => {
    const onUpdateKey = vi.fn();
    render(<ApolloManageMenu onUpdateKey={onUpdateKey} onDisconnect={vi.fn()} />);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /update api key/i }));
    expect(onUpdateKey).toHaveBeenCalled();
  });

  it("fires onDisconnect when 'Disconnect Apollo' is chosen", async () => {
    const onDisconnect = vi.fn();
    render(<ApolloManageMenu onUpdateKey={vi.fn()} onDisconnect={onDisconnect} />);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /disconnect apollo/i }));
    expect(onDisconnect).toHaveBeenCalled();
  });
});
