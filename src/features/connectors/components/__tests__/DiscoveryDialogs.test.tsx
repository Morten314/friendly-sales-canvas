import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReDiscoveryGuard, KeepReplaceDownloadPrompt } from "../DiscoveryDialogs";

describe("ReDiscoveryGuard (UC7)", () => {
  it("confirms to proceed", () => {
    const onConfirm = vi.fn();
    render(
      <ReDiscoveryGuard
        open
        lastDiscoveryAt="2026-06-10T00:00:00Z"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continue anyway|continue/i }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe("KeepReplaceDownloadPrompt (UC5)", () => {
  it("returns the chosen mode on continue (keep default)", () => {
    const onContinue = vi.fn();
    render(
      <KeepReplaceDownloadPrompt
        open
        onContinue={onContinue}
        onDownload={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledWith("keep");
  });

  it("selecting replace then continue returns replace", () => {
    const onContinue = vi.fn();
    render(
      <KeepReplaceDownloadPrompt
        open
        onContinue={onContinue}
        onDownload={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /replace/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledWith("replace");
  });

  it("download option fires onDownload", () => {
    const onDownload = vi.fn();
    render(
      <KeepReplaceDownloadPrompt
        open
        onContinue={vi.fn()}
        onDownload={onDownload}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /download/i }));
    expect(onDownload).toHaveBeenCalled();
  });
});
