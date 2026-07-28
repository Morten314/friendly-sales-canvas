import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadSourceBadge } from "../LeadSourceBadge";

describe("LeadSourceBadge", () => {
  it("renders the canonical label for a known source", () => {
    render(<LeadSourceBadge source="apollo" />);
    expect(screen.getByText("Apollo")).toBeTruthy();
  });
  it("renders 'Unknown' for legacy/null source", () => {
    render(<LeadSourceBadge source="HubSpot" />);
    expect(screen.getByText("Unknown")).toBeTruthy();
  });
});
