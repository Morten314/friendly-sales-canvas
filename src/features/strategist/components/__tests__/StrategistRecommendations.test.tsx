/**
 * StrategistRecommendations — mount test.
 *
 * Phase 8 stage 8d safety net (no Playwright journey for strategist).
 *
 * The component takes no props; it derives tier counts from the static
 * `heatmapLeads` fixture and uses `useNavigate`, so it only needs a router
 * wrapper. Asserts the section heading and the three tier labels render.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import StrategistRecommendations from "../StrategistRecommendations";

function renderRecommendations() {
  return render(
    <MemoryRouter>
      <StrategistRecommendations />
    </MemoryRouter>,
  );
}

describe("StrategistRecommendations", () => {
  it("renders the heading and all three tier sections", () => {
    renderRecommendations();

    expect(screen.getByText("Strategist Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Tier 1 — Prioritise Now")).toBeInTheDocument();
    expect(screen.getByText("Tier 2 — Evaluate & Engage")).toBeInTheDocument();
    expect(screen.getByText("Tier 3 — Nurture & Monitor")).toBeInTheDocument();
  });
});
