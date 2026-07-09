import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let authCb: (u: unknown) => void = () => {};
vi.mock("../firebase", () => ({ auth: { currentUser: null } }));
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
  const { orgId, orgStatus, orgResolved } = useAuth();
  return <div>{`status:${orgStatus} org:${orgId ?? "none"} resolved:${String(orgResolved)}`}</div>;
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe("AuthContext org resolution state machine", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("resolves with org on a 2xx GET /org (no cache)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "success", org_id: "real-org", org_name: "Real" }),
      }),
    );
    renderProbe();
    authCb({ uid: "u1" });
    await waitFor(() =>
      expect(screen.getByText("status:resolved org:real-org resolved:true")).toBeInTheDocument(),
    );
  });

  it("routes an authoritative 404 (no cache) to the no-org outcome", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "not found" }),
    );
    renderProbe();
    authCb({ uid: "u1" });
    await waitFor(() =>
      expect(screen.getByText("status:no-org org:none resolved:true")).toBeInTheDocument(),
    );
  });

  it("routes a persistent network failure (no cache) to the transient outcome", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    renderProbe();
    authCb({ uid: "u1" });
    await waitFor(
      () =>
        expect(screen.getByText("status:transient org:none resolved:false")).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });

  it("keeps a warm cached org mounted through a transient failure (no teardown)", async () => {
    localStorage.setItem("org_id_u1", "cached-org");
    localStorage.setItem("org_name_u1", "Cached");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "cold" }),
    );
    renderProbe();
    authCb({ uid: "u1" });
    await waitFor(
      () =>
        expect(
          screen.getByText("status:resolved org:cached-org resolved:true"),
        ).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });

  it("discards a resolution for a superseded user (generation guard)", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const uid = new URL(url, "http://x").searchParams.get("user_id");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ status: "success", org_id: `org-${uid}`, org_name: uid }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();
    authCb({ uid: "u1" });
    authCb({ uid: "u2" });
    await waitFor(() => expect(screen.getByText(/org:org-u2/)).toBeInTheDocument());
    expect(screen.queryByText(/org:org-u1/)).not.toBeInTheDocument();
  });
});
