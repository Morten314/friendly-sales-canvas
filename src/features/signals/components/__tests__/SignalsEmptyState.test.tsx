import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignalsEmptyState, SignalsLoadingState } from "../SignalsEmptyState";

describe("SignalsLoadingState", () => {
  it("renders the loading copy", () => {
    render(<SignalsLoadingState />);
    expect(screen.getByText("Loading signals...")).toBeInTheDocument();
  });
});

describe("SignalsEmptyState", () => {
  it("renders the no-signals headline and refresh hint", () => {
    render(<SignalsEmptyState />);
    expect(screen.getByText("No signals available")).toBeInTheDocument();
    expect(
      screen.getByText("Click refresh in the header to generate new signals"),
    ).toBeInTheDocument();
  });
});
