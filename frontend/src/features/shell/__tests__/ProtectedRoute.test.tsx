import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProtectedRoute from "../ProtectedRoute";

const authState = vi.hoisted(() => ({
  currentUser: null as { uid: string } | null,
  loading: false,
}));

vi.mock("@/shared/auth", () => ({
  useAuth: () => authState,
}));

afterEach(() => {
  authState.currentUser = null;
  authState.loading = false;
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
