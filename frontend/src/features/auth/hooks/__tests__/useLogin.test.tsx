import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { login, signup, fetchOrgId, selectTenant } = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  fetchOrgId: vi.fn(),
  selectTenant: vi.fn(),
}));

vi.mock("@/shared/auth", () => ({ useAuth: () => ({ login, signup, fetchOrgId }) }));
vi.mock("@/shared/tenant", () => ({ useTenant: () => ({ selectTenant }) }));
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
  fetchOrgId.mockResolvedValue({ orgId: "brewra", orgName: "Brewra" });
});
afterEach(() => vi.clearAllMocks());

describe("useLogin", () => {
  it("delegates login -> fetchOrgId -> selectTenant in order", async () => {
    const { result } = renderHook(() => useLogin(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ email: "a@b.co", password: "pw" });
    });
    expect(login).toHaveBeenCalledWith("a@b.co", "pw");
    expect(fetchOrgId).toHaveBeenCalledWith("u1");
    expect(selectTenant).toHaveBeenCalledWith({
      id: "brewra",
      name: "Brewra",
      domain: "brewra.com",
    });
    expect(login.mock.invocationCallOrder[0]).toBeLessThan(fetchOrgId.mock.invocationCallOrder[0]);
    expect(fetchOrgId.mock.invocationCallOrder[0]).toBeLessThan(
      selectTenant.mock.invocationCallOrder[0],
    );
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
