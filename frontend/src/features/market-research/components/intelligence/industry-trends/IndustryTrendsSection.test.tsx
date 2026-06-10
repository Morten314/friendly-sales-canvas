import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type React from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import IndustryTrendsSection from "./IndustryTrendsSection";

import { TooltipProvider } from "@/components/ui/tooltip";
import { server } from "@/test/msw/server";

// Mock auth so the section resolves a userId + orgId and the useIndustryTrends
// hook's query is enabled (auto-fetch on mount). The global MSW "industry trends
// report" handler then returns the section payload. `authValue` is mutable so a
// single test can drop orgId to disable the query and exercise the no-data gate.
let authValue: { currentUser: { uid: string } | null; orgId: string } = {
  currentUser: { uid: "u1" },
  orgId: "org1",
};
vi.mock("@/shared/auth", () => ({
  useAuth: () => authValue,
}));

afterEach(() => {
  authValue = { currentUser: { uid: "u1" }, orgId: "org1" };
});

// Minimal orchestration props — the section reads its DATA exclusively from the
// hook now, so no data props are passed. These are the behaviour/callback props.
function baseProps(overrides: Record<string, unknown> = {}) {
  const noop = () => {};
  return {
    isIndustryTrendsEditing: false,
    isSplitView: false,
    industryTrendsExpanded: false,
    industryTrendsHasEdits: false,
    industryTrendsDeletedSections: new Set<string>(),
    industryTrendsEditHistory: [],
    onIndustryTrendsToggleEdit: noop,
    onIndustryTrendsSaveChanges: noop,
    onIndustryTrendsCancelEdit: noop,
    onIndustryTrendsDeleteSection: noop,
    onIndustryTrendsEditHistoryOpen: noop,
    onIndustryTrendsExpandToggle: noop,
    onScoutIconClick: noop,
    onExportPDF: noop,
    onSaveToWorkspace: noop,
    onGenerateShareableLink: noop,
    onIndustryTrendsExecutiveSummaryChange: noop,
    onIndustryTrendsAiAdoptionChange: noop,
    onIndustryTrendsCloudMigrationChange: noop,
    onIndustryTrendsRegulatoryChange: noop,
    onIndustryTrendSnapshotsChange: noop,
    ...overrides,
  };
}

function renderSection(overrides: Record<string, unknown> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
  const props = baseProps(overrides) as React.ComponentProps<typeof IndustryTrendsSection>;
  return render(<IndustryTrendsSection {...props} />, {
    wrapper: Wrapper,
  });
}

describe("IndustryTrendsSection container (hook-sourced)", () => {
  it("hydrates from useIndustryTrends and renders the read summary + metrics", async () => {
    renderSection();

    // Field that ONLY the MSW industry-trends payload provides → proves the
    // section now sources its data from the hook (not props).
    await waitFor(
      () =>
        expect(
          screen.getByText("AI adoption accelerating across enterprise verticals."),
        ).toBeInTheDocument(),
      { timeout: 5000 },
    );
    // Collapsed-view KeyMetrics value confirms full hydration.
    expect(
      screen.getByText("68% of enterprises piloting AI solutions in 2025."),
    ).toBeInTheDocument();
  });

  it("requests expansion when Read More is clicked", async () => {
    const onExpand = vi.fn();
    renderSection({ onIndustryTrendsExpandToggle: onExpand });

    await waitFor(
      () =>
        expect(
          screen.getByText("AI adoption accelerating across enterprise verticals."),
        ).toBeInTheDocument(),
      { timeout: 5000 },
    );

    // Detail blocks (e.g. Regional Hotspots) are hidden in the collapsed view —
    // expansion is parent-orchestrated via the industryTrendsExpanded prop.
    expect(screen.queryByText("Regional Hotspots")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Read More/i }));
    expect(onExpand).toHaveBeenCalledWith(true);
  });

  it("renders the detail blocks (hook-sourced) when expanded", async () => {
    renderSection({ industryTrendsExpanded: true });

    // Detail blocks only render in the expanded view; their presence proves the
    // expanded subtree is fed by the hook view-model.
    await waitFor(() => expect(screen.getByText("Regional Hotspots")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(
      screen.getByText("AI adoption accelerating across enterprise verticals."),
    ).toBeInTheDocument();
  });

  it("renders the edit forms + toolbar when editing", async () => {
    renderSection({ isIndustryTrendsEditing: true });

    await waitFor(() => expect(screen.getByText("Key Metrics")).toBeInTheDocument(), {
      timeout: 5000,
    });
    // Edit toolbar present.
    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
    // An edit-form field label (only rendered in editing mode).
    expect(screen.getByText("AI Adoption Rate")).toBeInTheDocument();
  });

  it("shows NoDataState and Generate triggers the hook regenerate", async () => {
    // Disable the read query (no authenticated uid → useResearchComponent.enabled
    // is false) so the hook returns no data and the section renders NoDataState.
    authValue = { currentUser: null, orgId: "org1" };

    // Capture the regenerate POST (refresh:true) that Generate fires.
    let regenerateCalled = false;
    server.use(
      http.post("/api/market-research_claude", async ({ request }) => {
        const body = (await request.json()) as { refresh?: boolean };
        if (body.refresh) {
          regenerateCalled = true;
        }
        return HttpResponse.json({
          status: "success",
          data: { executiveSummary: "Regenerated industry trends summary." },
        });
      }),
    );

    renderSection();

    // No-data gate (query disabled, it.data undefined).
    const generate = await screen.findByRole(
      "button",
      { name: /Generate Report/i },
      { timeout: 5000 },
    );

    fireEvent.click(generate);

    // The hook's regenerate() runs the refresh:true mutation.
    await waitFor(() => expect(regenerateCalled).toBe(true), { timeout: 5000 });
  });
});
