import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { login, signup, fetchOrgId } = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  fetchOrgId: vi.fn(),
}));

vi.mock("@/shared/auth", () => ({ useAuth: () => ({ login, signup, fetchOrgId }) }));
vi.mock("@/shared/auth/firebase", () => ({ auth: { currentUser: { uid: "u1" } } }));

import { useLogin, useSignup } from "../useLogin";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  login.mockResolvedValue(undefined);
  signup.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("useLogin", () => {
  it("calls login but does not call/await fetchOrgId (route gate is the single waiter)", async () => {
    const { result } = renderHook(() => useLogin(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ email: "a@b.co", password: "pw" });
    });
    expect(login).toHaveBeenCalledWith("a@b.co", "pw");
    // Org resolution is now driven by AuthContext's onAuthStateChanged + the
    // requireOrg route gate (spec 48 WS1 / Task 2) — login must not duplicate
    // or block on that resolution (this regresses the ~28s cold-backend hang).
    expect(fetchOrgId).not.toHaveBeenCalled();
  });

  it("propagates a login error and does not call fetchOrgId", async () => {
    login.mockRejectedValueOnce(new Error("bad creds"));
    const { result } = renderHook(() => useLogin(), { wrapper: wrapper() });
    await expect(
      act(async () => {
        await result.current.mutateAsync({ email: "a@b.co", password: "pw" });
      }),
    ).rejects.toThrow("bad creds");
    expect(fetchOrgId).not.toHaveBeenCalled();
  });
});

describe("useSignup", () => {
  it("calls signup and stores pendingFullName", async () => {
    const { result } = renderHook(() => useSignup(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ email: "a@b.co", password: "pw", fullName: "Ada" });
    });
    expect(signup).toHaveBeenCalledWith("a@b.co", "pw");
    expect(localStorage.getItem("pendingFullName")).toBe("Ada");
  });
});
