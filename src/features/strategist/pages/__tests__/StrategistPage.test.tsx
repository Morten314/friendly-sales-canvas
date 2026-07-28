/**
 * StrategistPage — structural tab-surface test.
 *
 * Phase 8 stage 8d safety net: there is NO Playwright journey for the strategist
 * surface (Spec 27 §8 gap), so these render tests are the only behavioural guard.
 *
 * Focus: the page mounts both tab triggers ("Workspace" + "Your Lead Stream")
 * and renders the workspace tab content by default (activeTab = "workspace").
 * This exercises the tab/routing shell only — the three child components are
 * stubbed so their internals (network, static lead data, navigation) are out of
 * scope here and covered by their own component tests.
 *
 * Heavy infrastructure mocked:
 *  - @/features/shell Layout — renders children directly (the real Layout pulls
 *    in Sidebar/Header which need router + auth context we don't stand up here).
 *  - The three child components — simple text stubs so assertions are unambiguous
 *    and no fetch / static-data render fires.
 *
 * sessionStorage is left empty: with no `strategistContext`, `context?.leads`
 * is falsy, so the workspace tab renders <StrategistRecommendations /> (stubbed).
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import StrategistPage from "../StrategistPage";

// ---------------------------------------------------------------------------
// Layout — render children directly; no router/sidebar/auth needed for the
// tab-surface test.
// ---------------------------------------------------------------------------
vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// ---------------------------------------------------------------------------
// Child component stubs — relative paths matching the page's own imports.
// ---------------------------------------------------------------------------
vi.mock("../../components/StrategistWorkspace", () => ({
  default: () => <div data-testid="stub-strategist-workspace">StrategistWorkspace</div>,
}));

vi.mock("../../components/StrategistRecommendations", () => ({
  default: () => <div data-testid="stub-strategist-recommendations">StrategistRecommendations</div>,
}));

vi.mock("../../components/StrategistLeadStream", () => ({
  default: () => <div data-testid="stub-strategist-leadstream">StrategistLeadStream</div>,
}));

function renderPage(initialPath = "/your-ai-team/strategist/workspace") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/your-ai-team/strategist/:tab" element={<StrategistPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StrategistPage — tab surface", () => {
  it("renders both tab triggers", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: /workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /your lead stream/i })).toBeInTheDocument();
  });

  it("renders the workspace tab content by default (no strategistContext → recommendations stub)", () => {
    renderPage();
    // Default tab is "workspace"; with empty sessionStorage the workspace panel
    // falls back to the recommendations view, not the lead-context workspace.
    expect(screen.getByTestId("stub-strategist-recommendations")).toBeInTheDocument();
  });
});
