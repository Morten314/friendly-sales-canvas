import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import MarketEntrySection from "../MarketEntrySection";

import { TooltipProvider } from "@/components/ui/tooltip";

// Mock auth so the section resolves a userId + orgId and the hook's query is
// enabled (auto-fetch on mount). The MSW handler returns the market-entry shape.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const noop = () => {};
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );

  return render(
    <MarketEntrySection
      isEditing={false}
      isSplitView={false}
      isExpanded={false}
      hasEdits={false}
      deletedSections={new Set()}
      editHistory={[]}
      // Data props were dropped from MarketEntrySectionProps — the section now
      // reads its read path exclusively from the useMarketEntry hook (auto-hydrate).
      onToggleEdit={noop}
      onScoutIconClick={noop}
      onEditHistoryOpen={noop}
      onDeleteSection={noop}
      onSaveChanges={noop}
      onCancelEdit={noop}
      onExpandToggle={noop}
      onExecutiveSummaryChange={noop}
      onEntryBarriersChange={noop}
      onRecommendedChannelChange={noop}
      onTimeToMarketChange={noop}
      onTopBarrierChange={noop}
      onCompetitiveDifferentiationChange={noop}
      onStrategicRecommendationsChange={noop}
      onRiskAssessmentChange={noop}
      onExportPDF={noop}
      onSaveToWorkspace={noop}
      onGenerateShareableLink={noop}
    />,
    { wrapper: Wrapper },
  );
}

describe("MarketEntrySection auto-hydrate", () => {
  it("renders server data fetched via useMarketEntry after mount (no props)", async () => {
    renderSection();

    // The signature regression for this task: section no longer auto-hydrates.
    // Assert a field that only the MSW market-entry payload provides appears.
    await waitFor(
      () =>
        expect(screen.getByText("Test executive summary for market entry.")).toBeInTheDocument(),
      { timeout: 5000 },
    );
    // A second fetched field (collapsed-view KPI) confirms full hydration.
    expect(screen.getByText("Direct-to-consumer")).toBeInTheDocument();
  });
});
