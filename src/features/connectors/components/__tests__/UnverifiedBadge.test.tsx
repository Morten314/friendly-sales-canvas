import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UnverifiedBadge } from "../UnverifiedBadge";

describe("UnverifiedBadge", () => {
  it("renders for unverified", () => {
    render(<UnverifiedBadge emailStatus="unverified" />);
    expect(screen.getByText(/unverified/i)).toBeInTheDocument();
  });
  it("renders nothing for verified or null", () => {
    const { container: c1 } = render(<UnverifiedBadge emailStatus="verified" />);
    expect(c1).toBeEmptyDOMElement();
    const { container: c2 } = render(<UnverifiedBadge emailStatus={null} />);
    expect(c2).toBeEmptyDOMElement();
  });
});
