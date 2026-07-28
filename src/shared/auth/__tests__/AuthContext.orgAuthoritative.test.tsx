import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Drive onAuthStateChanged with a fake logged-in user.
let authCb: (u: unknown) => void = () => {};
vi.mock("../firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    authCb = cb;
    return () => {};
  },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
}));

import { AuthProvider, useAuth } from "../AuthContext";

function Probe() {
  const { orgId } = useAuth();
  return <div>org:{orgId ?? "none"}</div>;
}

describe("AuthContext GET /org authoritative", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("overwrites a stale cached org with the fresh GET /org value", async () => {
    localStorage.setItem("org_id_u1", "stale-org");
    localStorage.setItem("org_name_u1", "Stale");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", org_id: "fresh-uuid", org_name: "Fresh" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    authCb({ uid: "u1" });

    // optimistic cache first, then fresh wins
    await waitFor(() => expect(screen.getByText("org:fresh-uuid")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("org_id_u1")).toBe("fresh-uuid");
  });

  it("keeps the cached org when GET /org fails", async () => {
    localStorage.setItem("org_id_u1", "cached-org");
    localStorage.setItem("org_name_u1", "Cached");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "down" }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    authCb({ uid: "u1" });

    await waitFor(() => expect(screen.getByText("org:cached-org")).toBeInTheDocument());
  });
});
