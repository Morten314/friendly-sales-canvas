import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WarmupProgress } from "../WarmupProgress";

const warmup = {
  icp_configured: true,
  signals_generated: false,
  scout_completed: false,
  profiler_analyzed: true,
  ready_count: 2,
  unlocked: false,
  missing: [
    { step: "signals_generated", label: "Signals — first run", deep_link_hint: "signals" },
    { step: "scout_completed", label: "Scout — first market research", deep_link_hint: "scout" },
  ],
};

describe("WarmupProgress", () => {
  it("renders 'X of 4 agents ready'", () => {
    render(<WarmupProgress warmup={warmup} onDeepLink={vi.fn()} />);
    expect(screen.getByText(/2 of 4/i)).toBeInTheDocument();
  });

  it("lists missing steps with deep links", () => {
    render(<WarmupProgress warmup={warmup} onDeepLink={vi.fn()} />);
    expect(screen.getByText(/Signals — first run/)).toBeInTheDocument();
    expect(screen.getByText(/Scout — first market research/)).toBeInTheDocument();
  });

  it("fires onDeepLink with the hint on click", () => {
    const onDeepLink = vi.fn();
    render(<WarmupProgress warmup={warmup} onDeepLink={onDeepLink} />);
    fireEvent.click(screen.getByRole("button", { name: /Signals — first run/ }));
    expect(onDeepLink).toHaveBeenCalledWith("signals");
  });
});
