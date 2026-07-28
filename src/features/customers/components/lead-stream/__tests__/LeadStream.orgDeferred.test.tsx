import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LeadStreamPanel } from "../LeadStream";

// Clean null-org mock, kept in its own file (rather than vi.doMock inside the
// sibling LeadStream.test.tsx, which fixes @/shared/auth to "org1" at module
// top) so the deferred-org case doesn't fight that module-level mock.
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ orgId: null, currentUser: { uid: "u1" } }),
}));
vi.mock("@/shared/auth", () => ({ useOrgId: () => null }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("LeadStreamPanel (org unresolved)", () => {
  it("does not show the empty card while org is unresolved (deferred query)", () => {
    render(<LeadStreamPanel />, { wrapper });
    // useLeads(null) is `enabled: false` — a disabled query has isLoading:false,
    // fetchStatus:"idle", data:undefined. It never settles, so it must never be
    // read as "zero leads".
    expect(screen.queryByText("No prospect data yet")).toBeNull();
  });
});
