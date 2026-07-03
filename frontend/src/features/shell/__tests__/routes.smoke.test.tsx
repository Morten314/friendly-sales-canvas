import { render } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { featureRoutes } from "@/app/routes";
import { SidebarProvider } from "@/features/shell";

// AuthContext is heavy (Firebase). Mock it directly, matching the pattern used
// in Header.test.tsx / ProfileDialog.test.tsx — Header/Sidebar (rendered via
// the real Layout, since this test does NOT stub @/features/shell) also read
// useAuth, so the mock must satisfy both ProtectedRoute and the shell chrome.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({
    currentUser: { uid: "u1" },
    orgId: "org-xyz",
    orgName: "Org Xyz",
    loading: false,
    logout: vi.fn(),
  }),
}));

// jsdom has no matchMedia implementation; Header renders via useIsMobile, which needs it.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function renderRoute(path: string) {
  return render(
    <SidebarProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>{featureRoutes}</Routes>
      </MemoryRouter>
    </SidebarProvider>,
  );
}

describe("protected routes mount without a TenantProvider", () => {
  it.each(["/calendar", "/insights"])("route %s mounts without throwing", (path) => {
    expect(() => renderRoute(path)).not.toThrow();
  });
});
