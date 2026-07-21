import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import CompetitorLandscapeSection from "../CompetitorLandscapeSection";

import { TooltipProvider } from "@/components/ui/tooltip";

// Mock auth so the section resolves a userId + orgId and the hook's query is
// enabled (auto-fetch on mount). The MSW handler returns the competitor shape.
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
    <CompetitorLandscapeSection
      isEditing={false}
      isSplitView={false}
      isExpanded={false}
      hasEdits={false}
      deletedSections={new Set()}
      editHistory={[]}
      // Data props intentionally omitted — the section now sources its read path
      // from the useCompetitorLandscape hook (auto-hydrate). The prop fallbacks
      // remain on the type but are left empty here to prove hook-first hydration.
      executiveSummary=""
      topPlayerShare=""
      emergingPlayers=""
      fundingNews={[]}
      onToggleEdit={noop}
      onScoutIconClick={noop}
      onEditHistoryOpen={noop}
      onDeleteSection={noop}
      onSaveChanges={noop}
      onCancelEdit={noop}
      onExpandToggle={noop}
      onExecutiveSummaryChange={noop}
      onTopPlayerShareChange={noop}
      onEmergingPlayersChange={noop}
      onFundingNewsChange={noop}
      onExportPDF={noop}
      onSaveToWorkspace={noop}
      onGenerateShareableLink={noop}
    />,
    { wrapper: Wrapper },
  );
}

describe("CompetitorLandscapeSection auto-hydrate", () => {
  it("renders server data fetched via useCompetitorLandscape after mount (no data props)", async () => {
    renderSection();

    // The exec summary only comes from the MSW competitor payload — its
    // appearance proves the section auto-hydrates from the hook (not props).
    await waitFor(
      () =>
        expect(
          screen.getByText("Test executive summary for competitor landscape."),
        ).toBeInTheDocument(),
      { timeout: 5000 },
    );
    // A second fetched field (the always-visible Top Player Market Share KPI)
    // confirms full scalar hydration from the hook. Use getAllByText so the
    // check stays robust if "42%" later appears in more than one rendered slot.
    expect(screen.getAllByText("42%").length).toBeGreaterThan(0);
  });
});
