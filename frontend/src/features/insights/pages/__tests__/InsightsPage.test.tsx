import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import InsightsPage from "../InsightsPage";

vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("InsightsPage", () => {
  it("mounts and renders its top heading", () => {
    render(<InsightsPage />);
    // Pre-existing copy: the Insights page's <h1> text is literally "Reports".
    expect(screen.getByRole("heading", { level: 1, name: "Reports" })).toBeInTheDocument();
  });
});
