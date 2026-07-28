import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DisconnectApolloDialog } from "../DisconnectApolloDialog";

describe("DisconnectApolloDialog", () => {
  it("shows the leads-preserved warning verbatim when open", () => {
    render(<DisconnectApolloDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(
      screen.getByText(
        /Existing Apollo-sourced leads will remain in your pool, but discovery will be unavailable until you reconnect\./i,
      ),
    ).toBeInTheDocument();
  });

  it("calls onConfirm on Disconnect and onCancel on Cancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DisconnectApolloDialog open onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /^disconnect$/i }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows 'Disconnecting…' and disables the confirm button while isPending", () => {
    render(<DisconnectApolloDialog open isPending onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /disconnecting/i })).toBeDisabled();
  });
});
