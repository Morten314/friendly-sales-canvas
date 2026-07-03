import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "../../SidebarContext";
import { Header } from "../Header";

// AuthContext is heavy (Firebase). Mock it directly rather than the provider.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ orgName: null, orgId: "org-xyz" }),
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

function renderHeader() {
  return render(
    <SidebarProvider>
      <Header />
    </SidebarProvider>,
  );
}

describe("Header", () => {
  it("shows orgName, falling back to orgId when name is absent", () => {
    renderHeader();
    expect(screen.getByText("org-xyz")).toBeInTheDocument();
  });
});
