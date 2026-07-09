import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
  const { orgId, orgStatus, orgResolved, retryOrgResolution } = useAuth();
  return (
    <div>
      <div>{`status:${orgStatus} org:${orgId ?? "none"} resolved:${String(orgResolved)}`}</div>
      <button onClick={() => retryOrgResolution()}>retry-org</button>
    </div>
  );
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
    // u1 (superseded) resolves LATER than u2, so this passes ONLY if the guard
    // actively discards u1's late-arriving result. Without the guard, u1 would
    // overwrite u2 and the final assertion would fail.
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const uid = new URL(url, "http://x").searchParams.get("user_id");
      const delay = uid === "u1" ? 60 : 0;
      return new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ status: "success", org_id: `org-${uid}`, org_name: uid }),
            }),
          delay,
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();
    authCb({ uid: "u1" });
    authCb({ uid: "u2" });
    await waitFor(() => expect(screen.getByText(/org:org-u2/)).toBeInTheDocument());
    // wait past u1's delayed (superseded) response to prove it is discarded, not applied
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.getByText(/org:org-u2/)).toBeInTheDocument();
    expect(screen.queryByText(/org:org-u1/)).not.toBeInTheDocument();
  });

  it("retryOrgResolution starts a fresh resolution after the auto-retry ceiling (reaches resolved)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "success", org_id: "recovered-org", org_name: "Recovered" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();
    authCb({ uid: "u1" });
    await waitFor(
      () =>
        expect(screen.getByText("status:transient org:none resolved:false")).toBeInTheDocument(),
      { timeout: 4000 },
    );
    fireEvent.click(screen.getByRole("button", { name: /retry-org/i }));
    await waitFor(() =>
      expect(
        screen.getByText("status:resolved org:recovered-org resolved:true"),
      ).toBeInTheDocument(),
    );
  });
});
