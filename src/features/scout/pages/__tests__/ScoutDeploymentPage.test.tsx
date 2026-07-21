/**
 * ScoutDeploymentPage — structural render smoke test.
 *
 * Phase 9 safety net: no Playwright journey exists for the scout deployment
 * surface, so this render test is the structural guard.
 *
 * Focus: the page mounts, renders the "Deploy Scout Agent" heading, and
 * renders the ScoutDeployment form component.
 *
 * Heavy infrastructure mocked:
 *  - @/features/shell Layout — renders children directly (the real Layout pulls
 *    in Sidebar/Header which need router + auth context not stood up here).
 *  - ScoutDeployment form — simple stub so no auth/network fires.
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ScoutDeploymentPage from "../ScoutDeploymentPage";

// ---------------------------------------------------------------------------
// Layout — render children directly; no router/sidebar/auth needed.
// ---------------------------------------------------------------------------
vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// ---------------------------------------------------------------------------
// ScoutDeployment form stub — relative path matching the page's own import.
// ---------------------------------------------------------------------------
vi.mock("../../components/ScoutDeployment", () => ({
  ScoutDeployment: () => <div data-testid="scout-deployment-form" />,
}));

describe("ScoutDeploymentPage", () => {
  it("renders the deploy heading and the form", () => {
    render(<ScoutDeploymentPage />);
    expect(screen.getByText("Deploy Scout Agent")).toBeInTheDocument();
    expect(screen.getByTestId("scout-deployment-form")).toBeInTheDocument();
  });
});
