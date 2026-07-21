import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const toast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/shared/auth", () => ({ useAuth: () => ({ orgId: "o1", currentUser: { uid: "u1" } }) }));

const warmupData = {
  current: { connected: true, unlocked: false } as
    | { connected: boolean; unlocked: boolean }
    | undefined,
};
vi.mock("../useApolloStatus", () => ({
  useApolloStatus: () => ({ data: { connected: warmupData.current?.connected } }),
}));
vi.mock("../useApolloWarmup", () => ({
  useApolloWarmup: () => ({
    data: warmupData.current ? { unlocked: warmupData.current.unlocked } : undefined,
  }),
}));

import { useApolloUnlockToast } from "../useApolloUnlockToast";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  toast.mockClear();
  localStorage.clear();
  warmupData.current = { connected: true, unlocked: false };
});

describe("useApolloUnlockToast", () => {
  it("fires once on the locked→unlocked edge and dedupes via localStorage", async () => {
    const { rerender } = renderHook(() => useApolloUnlockToast(), { wrapper });
    expect(toast).not.toHaveBeenCalled();

    warmupData.current = { connected: true, unlocked: true };
    rerender();
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

    // A remount must NOT re-fire (persisted flag).
    rerender();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("apollo_unlock_notified:o1")).toBe("1");
  });

  it("does not fire if already unlocked-and-notified from a prior session", () => {
    localStorage.setItem("apollo_unlock_notified:o1", "1");
    warmupData.current = { connected: true, unlocked: true };
    renderHook(() => useApolloUnlockToast(), { wrapper });
    expect(toast).not.toHaveBeenCalled();
  });
});
