/**
 * StrategistLeadStream — mount test.
 *
 * Phase 8 stage 8d safety net (no Playwright journey for strategist).
 *
 * The component takes no props, derives its rows from the static `heatmapLeads`
 * fixture, and reads/writes `localStorage` (jsdom-backed) — no router needed.
 * Asserts the section heading and the active-lead summary render.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StrategistLeadStream from "../StrategistLeadStream";

describe("StrategistLeadStream", () => {
  it("renders the heading and the active-leads summary", () => {
    render(<StrategistLeadStream />);

    expect(screen.getByText("Your Lead Stream")).toBeInTheDocument();
    expect(screen.getByText(/active leads/i)).toBeInTheDocument();
  });
});
