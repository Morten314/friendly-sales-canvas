import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProtectedRoute from "../ProtectedRoute";

const authState = vi.hoisted(() => ({
  currentUser: null as { uid: string } | null,
  loading: false,
  orgStatus: "resolved" as "pending" | "resolved" | "no-org" | "transient",
  retryOrgResolution: vi.fn(),
}));

vi.mock("@/shared/auth", () => ({
  useAuth: () => authState,
}));

afterEach(() => {
  authState.currentUser = null;
  authState.loading = false;
  authState.orgStatus = "resolved";
  localStorage.clear();
});

// Rendered through a real <Routes> table (as every production usage does) so
// that a redirect actually unmounts ProtectedRoute once "/login" matches a
// different Route. Rendering <ProtectedRoute> as a bare MemoryRouter child
// (no <Routes>) leaves it mounted after <Navigate> fires, which re-invokes
// <Navigate> on every re-render and spins forever.
function renderProtected(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/mission-control"
          element={
            <ProtectedRoute>
              <div>ok</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("renders children for an authed user", () => {
    authState.currentUser = { uid: "u1" };

    renderProtected("/mission-control");

    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("redirects an unauthenticated user to /login", () => {
    authState.currentUser = null;

    renderProtected("/mission-control");

    expect(screen.queryByText("ok")).not.toBeInTheDocument();
    expect(screen.getByText("login page")).toBeInTheDocument();
  });
});

describe("ProtectedRoute requireOrg gate", () => {
  function renderOrgGated(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/mission-control"
            element={
              <ProtectedRoute requireOrg>
                <div>org content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("renders children on the has-org (resolved) outcome", () => {
    authState.currentUser = { uid: "u1" };
    authState.orgStatus = "resolved";
    renderOrgGated("/mission-control");
    expect(screen.getByText("org content")).toBeInTheDocument();
  });

  it("shows the no-org state (not org content) on the authoritative no-org outcome", () => {
    authState.currentUser = { uid: "u1" };
    authState.orgStatus = "no-org";
    renderOrgGated("/mission-control");
    expect(screen.queryByText("org content")).not.toBeInTheDocument();
    expect(screen.getByText(/isn't set up yet/i)).toBeInTheDocument();
  });

  it("shows the reconnecting state (not org content, not no-org) on a transient outcome", () => {
    authState.currentUser = { uid: "u1" };
    authState.orgStatus = "transient";
    renderOrgGated("/mission-control");
    expect(screen.queryByText("org content")).not.toBeInTheDocument();
    expect(screen.queryByText(/isn't set up yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("does NOT gate a plain ProtectedRoute (no requireOrg) on org status", () => {
    authState.currentUser = { uid: "u1" };
    authState.orgStatus = "no-org";
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <div>settings content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("settings content")).toBeInTheDocument();
  });
});
