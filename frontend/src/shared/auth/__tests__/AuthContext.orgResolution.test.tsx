import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let authCb: (u: unknown) => void = () => {};
const mockAuth = vi.hoisted(() => ({ currentUser: null as { uid: string } | null }));
vi.mock("../firebase", () => ({ auth: mockAuth }));
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

// Faithful to real Firebase: auth.currentUser is set on auth-state change, and
// retryOrgResolution reads auth.currentUser — so the mock MUST reflect the
// signed-in user or the manual retry is a silent no-op.
function signIn(user: { uid: string } | null) {
  mockAuth.currentUser = user;
  authCb(user);
}

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
    mockAuth.currentUser = null;
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
    signIn({ uid: "u1" });
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
    signIn({ uid: "u1" });
    await waitFor(() =>
      expect(screen.getByText("status:no-org org:none resolved:true")).toBeInTheDocument(),
    );
  });

  it("routes a persistent network failure (no cache) to the transient outcome", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();
    signIn({ uid: "u1" });
    await waitFor(
      () =>
        expect(screen.getByText("status:transient org:none resolved:false")).toBeInTheDocument(),
      { timeout: 4000 },
    );
    // Let the bounded auto-retry loop fully settle (3 attempts) so it can't leak
    // a dangling fetch call into a later test.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3), { timeout: 4000 });
  });

  it("keeps a warm cached org mounted through a transient failure (no teardown)", async () => {
    localStorage.setItem("org_id_u1", "cached-org");
    localStorage.setItem("org_name_u1", "Cached");
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "cold" });
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();
    signIn({ uid: "u1" });
    await waitFor(
      () =>
        expect(
          screen.getByText("status:resolved org:cached-org resolved:true"),
        ).toBeInTheDocument(),
      { timeout: 4000 },
    );
    // Let the bounded auto-retry loop fully settle (3 attempts) so it can't leak
    // a dangling fetch call into a later test.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3), { timeout: 4000 });
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
    signIn({ uid: "u1" });
    signIn({ uid: "u2" });
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
    signIn({ uid: "u1" });
    // Let the bounded auto-retry reach its ceiling (3 attempts) and RETURN, so the
    // manual retry below is the only live resolveOrg loop (no race, no pollution).
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3), { timeout: 4000 });
    await waitFor(() =>
      expect(screen.getByText("status:transient org:none resolved:false")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /retry-org/i }));
    // The manual retry fires a fresh attempt (the 4th fetch) → success → resolved.
    await waitFor(() =>
      expect(
        screen.getByText("status:resolved org:recovered-org resolved:true"),
      ).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
