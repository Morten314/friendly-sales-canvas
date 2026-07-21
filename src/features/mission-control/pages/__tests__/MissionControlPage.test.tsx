/**
 * MissionControlPage — tab-routing test.
 *
 * Focus: each tab mounts the right child component; tab-lock guards prevent
 * switching to customer-profile/sources when the company profile hasn't been
 * saved yet; URL `?tab=` param routes on mount when the target tab is unlocked.
 *
 * All four heavy child components are stubbed so this test exercises routing
 * logic only — not the internals of CompanyProfileForm, ConnectorApprovals,
 * ICPManager, or DataSourcesManager.
 *
 * Heavy infrastructure mocked:
 *  - @/shared/auth (useAuthToken) — provides a stable uid + orgId without Firebase
 *  - @/shared/company-profile — returns no data + not loading,
 *    so no network requests fire (server.listen({ onUnhandledRequest: "error" }))
 *  - @/shared/profiler — no-op cache helpers to skip localStorage/session writes
 *  - @/features/shell Layout — renders children directly (no router/sidebar needed)
 *  - @/shared/lib/cacheUtils (dynamic import inside page) — no-op setUserLocalStorage
 *  - All four child components — stable testid stubs
 *
 * Tab-switch implementation note:
 * Radix Tabs uses onPointerDown internally; fireEvent.click alone is not
 * sufficient in jsdom. Instead the tests use a pointer-event sequence
 * (pointerdown → mousedown → click) to drive the Radix trigger, which is the
 * same approach used by @testing-library/user-event internally.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MissionControlPage from "../MissionControlPage";

// ---------------------------------------------------------------------------
// Auth mock — stable uid + orgId, no Firebase calls.
// ---------------------------------------------------------------------------
vi.mock("@/shared/auth", () => ({
  useAuthToken: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));

// ---------------------------------------------------------------------------
// useCompanyProfile mock — returns no data, not loading.
// Prevents GET /api/profile/company firing (global MSW is onUnhandledRequest:"error").
// ---------------------------------------------------------------------------
vi.mock("@/shared/company-profile", () => ({
  useCompanyProfile: () => ({ data: null, isLoading: false }),
}));

// ---------------------------------------------------------------------------
// Profiler cache helpers — all no-ops so no localStorage/session side effects.
// ---------------------------------------------------------------------------
vi.mock("@/shared/profiler", () => ({
  ensureMissionProfilerScope: () => {},
  isMissionControlCacheValid: () => false,
  getMissionControlCompanyProfileJson: () => null,
  commitMissionControlCompanyProfile: () => {},
  invalidateMissionControlCache: () => {},
  invalidateProfilerCache: () => {},
  extractIcpsDataFromFlexibleApiResponse: () => [],
}));

// ---------------------------------------------------------------------------
// Layout — render children directly; no router/sidebar needed for routing tests.
// ---------------------------------------------------------------------------
vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// ---------------------------------------------------------------------------
// cacheUtils dynamic import inside the page's read-effect.
// ---------------------------------------------------------------------------
vi.mock("@/shared/lib/cacheUtils", () => ({
  setUserLocalStorage: () => {},
  getUserLocalStorage: () => null,
  getUserCacheKey: () => "",
  clearUserCache: () => {},
  removeUserLocalStorage: () => {},
}));

// ---------------------------------------------------------------------------
// Child component stubs — stable testid so assertions are unambiguous.
// vi.mock paths must resolve to the same module the page imports. Using the
// @/ alias ensures Vitest resolves to the same file regardless of test-file
// location.
// ---------------------------------------------------------------------------
vi.mock("@/features/mission-control/components/company-profile/CompanyProfileForm", () => ({
  default: ({ onSavedChange }: { onSavedChange?: (v: boolean) => void }) => (
    <div data-testid="stub-company-profile-form">
      CompanyProfileForm
      {/* Expose a button tests can click to simulate "profile saved" */}
      <button onClick={() => onSavedChange?.(true)}>simulate-save</button>
    </div>
  ),
}));

vi.mock("@/features/mission-control/components/company-profile/ConnectorApprovals", () => ({
  default: () => <div data-testid="stub-connector-approvals">ConnectorApprovals</div>,
}));

vi.mock("@/features/mission-control/components/icp/ICPManager", () => ({
  default: () => <div data-testid="stub-icp-manager">ICPManager</div>,
}));

vi.mock("@/features/mission-control/components/data-sources/DataSourcesManager", () => ({
  default: () => <div data-testid="stub-data-sources-manager">DataSourcesManager</div>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<MissionControlPage />, { wrapper: Wrapper });
}

/** Set window.location.search before rendering so the URL-param effect fires. */
function setSearchParam(param: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search: param, pathname: "/mission-control" },
  });
}

/**
 * Fire the full pointer → mouse → click sequence a browser would send.
 * Radix Tabs uses onPointerDown to detect tab activation; fireEvent.click
 * alone does NOT trigger onValueChange in jsdom.
 */
function clickTab(el: HTMLElement) {
  fireEvent.pointerDown(el);
  fireEvent.mouseDown(el);
  fireEvent.click(el);
}

/**
 * Return the tab panel (role="tabpanel") that is currently active
 * (data-state="active"). Radix keeps ALL panels in the DOM but marks
 * inactive ones with hidden + data-state="inactive".
 */
function getActivePanel() {
  return document.querySelector('[role="tabpanel"][data-state="active"]') as HTMLElement | null;
}

afterEach(() => {
  vi.restoreAllMocks();
  // Reset URL between tests.
  setSearchParam("");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("MissionControlPage — tab routing", () => {
  it("renders the Company Profile tab content on first load (default tab = profile)", () => {
    renderPage();
    // The active panel must contain the company profile form stub.
    const activePanel = getActivePanel();
    expect(activePanel).not.toBeNull();
    expect(within(activePanel!).getByTestId("stub-company-profile-form")).toBeInTheDocument();
  });

  it("customer-profile and sources tabs are disabled when company profile not saved", () => {
    renderPage();
    const customerTab = screen.getByRole("tab", { name: /customer profile|customer/i });
    const sourcesTab = screen.getByRole("tab", { name: /data sources|sources/i });
    expect(customerTab).toBeDisabled();
    expect(sourcesTab).toBeDisabled();
  });

  it("unlocks customer-profile and sources tabs after company profile is saved", () => {
    renderPage();
    // Initially locked.
    expect(screen.getByRole("tab", { name: /customer profile|customer/i })).toBeDisabled();

    // Simulate saving company profile via the stub button.
    fireEvent.click(screen.getByRole("button", { name: /simulate-save/i }));

    expect(screen.getByRole("tab", { name: /customer profile|customer/i })).not.toBeDisabled();
    expect(screen.getByRole("tab", { name: /data sources|sources/i })).not.toBeDisabled();
  });

  it("clicking customer-profile tab after unlock activates that panel with ICPManager", () => {
    renderPage();
    // Unlock first.
    fireEvent.click(screen.getByRole("button", { name: /simulate-save/i }));

    // Click the now-unlocked tab using the full pointer sequence.
    clickTab(screen.getByRole("tab", { name: /customer profile|customer/i }));

    const activePanel = getActivePanel();
    expect(activePanel).not.toBeNull();
    expect(within(activePanel!).getByTestId("stub-icp-manager")).toBeInTheDocument();
  });

  it("clicking sources tab after unlock activates that panel with DataSourcesManager", () => {
    renderPage();
    // Unlock first.
    fireEvent.click(screen.getByRole("button", { name: /simulate-save/i }));

    // Click the sources tab.
    clickTab(screen.getByRole("tab", { name: /data sources|sources/i }));

    const activePanel = getActivePanel();
    expect(activePanel).not.toBeNull();
    expect(within(activePanel!).getByTestId("stub-data-sources-manager")).toBeInTheDocument();
  });

  it("clicking a locked tab while locked does NOT change the active tab away from profile", () => {
    renderPage();
    // Profile tab should be active (default).
    expect(
      getActivePanel()?.querySelector('[data-testid="stub-company-profile-form"]'),
    ).not.toBeNull();

    // Try clicking the locked customer-profile tab (pointer-events disabled by CSS,
    // and onValueChange guard returns early even if event fires).
    const customerTab = screen.getByRole("tab", { name: /customer profile|customer/i });
    clickTab(customerTab);

    // Profile tab must still be active.
    expect(
      getActivePanel()?.querySelector('[data-testid="stub-company-profile-form"]'),
    ).not.toBeNull();
  });

  it("switching tabs to customer-profile then back to profile makes profile panel active again", () => {
    renderPage();
    // Unlock and switch to customer-profile.
    fireEvent.click(screen.getByRole("button", { name: /simulate-save/i }));
    clickTab(screen.getByRole("tab", { name: /customer profile|customer/i }));
    expect(getActivePanel()?.querySelector('[data-testid="stub-icp-manager"]')).not.toBeNull();

    // Switch back to profile. Use the Radix id attribute to disambiguate
    // (the regex /profile/i would also match "Customer Profile" tab).
    const profileTab = document.querySelector('[role="tab"][id*="trigger-profile"]') as HTMLElement;
    expect(profileTab).not.toBeNull();
    clickTab(profileTab!);
    const activePanel = getActivePanel();
    expect(within(activePanel!).getByTestId("stub-company-profile-form")).toBeInTheDocument();
  });

  it("?tab=customer-profile URL param is ignored while tab is locked (stays on profile)", () => {
    // Locks are still on (isCompanyProfileSaved starts false) so the effect
    // must NOT switch away from the default "profile" tab.
    setSearchParam("?tab=customer-profile");
    renderPage();

    // Customer-profile tab is locked — URL param must be ignored.
    const activePanel = getActivePanel();
    expect(activePanel).not.toBeNull();
    expect(within(activePanel!).getByTestId("stub-company-profile-form")).toBeInTheDocument();
  });

  it("?tab=profile URL param on mount keeps the profile tab active", () => {
    setSearchParam("?tab=profile");
    renderPage();
    const activePanel = getActivePanel();
    expect(activePanel).not.toBeNull();
    expect(within(activePanel!).getByTestId("stub-company-profile-form")).toBeInTheDocument();
  });

  it("ConnectorApprovals is always rendered at page level (outside all tab panels)", () => {
    renderPage();
    // ConnectorApprovals is mounted outside <Tabs>, so it is always present.
    expect(screen.getByTestId("stub-connector-approvals")).toBeInTheDocument();
    // And it must NOT be inside a tabpanel.
    const panels = document.querySelectorAll('[role="tabpanel"]');
    panels.forEach((panel) => {
      expect(panel.querySelector('[data-testid="stub-connector-approvals"]')).toBeNull();
    });
  });
});
