import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AdminGuard } from "../AdminGuard";

const mockUseAuth = vi.fn();
vi.mock("@/shared/auth", () => ({ useAuth: () => mockUseAuth() }));

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <div>admin content</div>
            </AdminGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminGuard", () => {
  it("shows a spinner while auth is loading", () => {
    mockUseAuth.mockReturnValue({ currentUser: null, loading: true });
    renderAt("/admin");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("redirects to / when unauthenticated", () => {
    mockUseAuth.mockReturnValue({ currentUser: null, loading: false });
    renderAt("/admin");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("redirects to / when email is not in the allowlist", () => {
    mockUseAuth.mockReturnValue({ currentUser: { email: "stranger@example.com" }, loading: false });
    renderAt("/admin");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("renders children for an allowlisted email", () => {
    mockUseAuth.mockReturnValue({ currentUser: { email: "gaurav@brewra.com" }, loading: false });
    renderAt("/admin");
    expect(screen.getByText("admin content")).toBeInTheDocument();
  });
});
