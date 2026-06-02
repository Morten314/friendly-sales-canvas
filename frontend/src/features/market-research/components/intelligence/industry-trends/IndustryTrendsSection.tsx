import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useState, useEffect } from "react";

import { EditToolbar } from "./EditToolbar";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { ExportFooter } from "./ExportFooter";
import { normalizeDeletedSections, buildEditSnapshot } from "./industryTrends";
import { KeyMetrics } from "./KeyMetrics";
import { RegionalHotspots } from "./RegionalHotspots";
import { RisksWatchouts } from "./RisksWatchouts";
import { SectionHeader } from "./SectionHeader";
import { ErrorState, LoadingState, NoDataState } from "./states";
import { StrategicRecommendations } from "./StrategicRecommendations";
import { TrendSnapshots } from "./TrendSnapshots";
import type {
  EditRecord,
  TrendSnapshot,
  IndustryTrendsRecommendations,
  VisualChartsData,
} from "./types";
import { useIndustryTrends } from "./useIndustryTrends";
import { VisualCharts } from "./VisualCharts";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/shared/auth";
import { FeatureErrorBoundary } from "@/shared/components";
import { setUserLocalStorage } from "@/utils/cacheUtils";

interface IndustryTrendsSectionProps {
  isIndustryTrendsEditing: boolean;
  isSplitView: boolean;
  industryTrendsExpanded: boolean;
  industryTrendsHasEdits: boolean;
  industryTrendsDeletedSections: Set<string>;
  industryTrendsEditHistory: EditRecord[];
  onIndustryTrendsToggleEdit: () => void;
  onIndustryTrendsSaveChanges: () => void;
  onIndustryTrendsCancelEdit: () => void;
  onIndustryTrendsDeleteSection: (sectionId: string) => void;
  onIndustryTrendsEditHistoryOpen: () => void;
  onIndustryTrendsExpandToggle: (expanded: boolean) => void;
  onScoutIconClick: (context?: "market-size" | "industry-trends" | "competitor-landscape") => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  // Add refresh props
  isRefreshing?: boolean;
  // NOTE: The industry-trends read-path data props (executiveSummary, aiAdoption,
  // cloudMigration, regulatory, trendSnapshots, recommendations, risks,
  // regionalHotspots, visualCharts) and the section's companyProfile prop were
  // removed here — the section now sources its server data exclusively from the
  // useIndustryTrends hook (Phase 5g task 8). Orchestration + per-field change
  // callbacks below are kept (the 5d upward-commit pattern).
  // Add individual field update functions
  onIndustryTrendsExecutiveSummaryChange?: (value: string) => void;
  onIndustryTrendsAiAdoptionChange?: (value: string) => void;
  onIndustryTrendsCloudMigrationChange?: (value: string) => void;
  onIndustryTrendsRegulatoryChange?: (value: string) => void;
  onIndustryTrendSnapshotsChange?: (snapshots: TrendSnapshot[]) => void;
}

const IndustryTrendsSection: React.FC<IndustryTrendsSectionProps> = ({
  isIndustryTrendsEditing,
  isSplitView,
  industryTrendsExpanded,
  industryTrendsHasEdits: _industryTrendsHasEdits,
  industryTrendsDeletedSections,
  industryTrendsEditHistory,
  onIndustryTrendsToggleEdit,
  onIndustryTrendsSaveChanges,
  onIndustryTrendsCancelEdit,
  onIndustryTrendsDeleteSection,
  onIndustryTrendsEditHistoryOpen,
  onIndustryTrendsExpandToggle,
  onScoutIconClick,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  isRefreshing = false,
  // Individual field update functions (KEPT — committed edits flow up to the parent)
  onIndustryTrendsExecutiveSummaryChange,
  onIndustryTrendsAiAdoptionChange,
  onIndustryTrendsCloudMigrationChange,
  onIndustryTrendsRegulatoryChange,
  onIndustryTrendSnapshotsChange,
}) => {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility

  // Section SERVER data now comes exclusively from the useIndustryTrends hook
  // (TanStack-backed). This replaces the former dormant raw fetch + mirror useState.
  const it = useIndustryTrends(currentUser?.uid ?? "", orgIdToUse);

  const { toast } = useToast();

  // Coerce the hook view-model (whose zod fields are .nullish()) into the strict
  // shapes the block components and edit-state setters require. This is the single
  // read-path source — call sites and draft seeders read from `displayData`.
  const displayData = React.useMemo(() => {
    const recs = it.data?.recommendations ?? it.data?.strategicRecommendations;
    return {
      executiveSummary: it.data?.executiveSummary || "",
      aiAdoption: it.data?.aiAdoption || "",
      cloudMigration: it.data?.cloudMigration || "",
      regulatory: it.data?.regulatory || "",
      trendSnapshots: (it.data?.trendSnapshots ?? []).map((s) => ({
        title: s.title ?? "",
        metric: s.metric ?? "",
        type: s.type ?? undefined,
      })) as TrendSnapshot[],
      regionalHotspots: (it.data?.regionalHotspots ?? {}) as { [key: string]: string },
      strategicRecommendations: {
        primaryFocus: recs?.primaryFocus ?? "",
        marketEntry: recs?.marketEntry ?? "",
      } as IndustryTrendsRecommendations,
      risks: it.data?.risks ?? [],
      visualCharts: {
        aiAdoptionTrends: it.data?.visualCharts?.aiAdoptionTrends ?? [],
        technologyBudgetAllocation: it.data?.visualCharts?.technologyBudgetAllocation ?? {},
      } as VisualChartsData,
    };
  }, [it.data]);

  // Normalize industryTrendsDeletedSections to ensure it's always a Set
  const normalizedDeletedSections = React.useMemo(
    () => normalizeDeletedSections(industryTrendsDeletedSections),
    [industryTrendsDeletedSections],
  );

  // Local editing state
  const [editExecutiveSummary, setEditExecutiveSummary] = useState("");
  const [editAiAdoption, setEditAiAdoption] = useState("");
  const [editCloudMigration, setEditCloudMigration] = useState("");
  const [editRegulatory, setEditRegulatory] = useState("");
  const [editTrendSnapshots, setEditTrendSnapshots] = useState<TrendSnapshot[]>([]);
  const [editRegionalHotspots, setEditRegionalHotspots] = useState<{
    APAC: string;
    Europe: string;
    "North America": string;
  }>({
    APAC: "",
    Europe: "",
    "North America": "",
  });
  const [editStrategicRecommendations, setEditStrategicRecommendations] =
    useState<IndustryTrendsRecommendations>({
      primaryFocus: "",
      marketEntry: "",
    });
  const [editRisks, setEditRisks] = useState<string[]>([]);
  const [editVisualCharts, setEditVisualCharts] = useState<VisualChartsData>({
    aiAdoptionTrends: [],
    technologyBudgetAllocation: {
      "AI/ML": "",
      Cloud: "",
      Security: "",
    },
  });

  // Save individual fields to localStorage whenever they change (user-specific)
  useEffect(() => {
    if (editExecutiveSummary && currentUser?.uid) {
      setUserLocalStorage(
        "industry-trends_executiveSummary",
        editExecutiveSummary,
        currentUser.uid,
      );
    }
  }, [editExecutiveSummary, currentUser?.uid]);

  useEffect(() => {
    if (editAiAdoption && currentUser?.uid) {
      setUserLocalStorage("industry-trends_aiAdoption", editAiAdoption, currentUser.uid);
    }
  }, [editAiAdoption, currentUser?.uid]);

  useEffect(() => {
    if (editCloudMigration && currentUser?.uid) {
      setUserLocalStorage("industry-trends_cloudMigration", editCloudMigration, currentUser.uid);
    }
  }, [editCloudMigration, currentUser?.uid]);

  useEffect(() => {
    if (editRegulatory && currentUser?.uid) {
      setUserLocalStorage("industry-trends_regulatory", editRegulatory, currentUser.uid);
    }
  }, [editRegulatory, currentUser?.uid]);

  useEffect(() => {
    if (editTrendSnapshots && editTrendSnapshots.length > 0 && currentUser?.uid) {
      setUserLocalStorage(
        "industry-trends_trendSnapshots",
        JSON.stringify(editTrendSnapshots),
        currentUser.uid,
      );
    }
  }, [editTrendSnapshots, currentUser?.uid]);

  const handleModify = () => {
    // Initialize edit fields with current server data (sourced from the hook).
    setEditExecutiveSummary(displayData.executiveSummary);
    setEditAiAdoption(displayData.aiAdoption);
    setEditCloudMigration(displayData.cloudMigration);
    setEditRegulatory(displayData.regulatory);
    setEditTrendSnapshots(displayData.trendSnapshots);

    // Initialize regional hotspots
    const regionalHotspotsToUse =
      Object.keys(displayData.regionalHotspots).length > 0
        ? displayData.regionalHotspots
        : { APAC: "", Europe: "", "North America": "" };
    setEditRegionalHotspots(
      regionalHotspotsToUse as { APAC: string; Europe: string; "North America": string },
    );

    // Initialize strategic recommendations
    setEditStrategicRecommendations(displayData.strategicRecommendations);

    // Initialize risks
    setEditRisks(displayData.risks);

    // Initialize visual charts
    setEditVisualCharts(displayData.visualCharts);

    onIndustryTrendsToggleEdit();
  };

  // Handle save changes
  const handleSaveChanges = async () => {
    try {
      // Shape the original/modified payloads via the extracted helper.
      const { originalData, modifiedData } = buildEditSnapshot(displayData, {
        editExecutiveSummary,
        editAiAdoption,
        editCloudMigration,
        editRegulatory,
        editTrendSnapshots,
        editRegionalHotspots,
        editStrategicRecommendations,
        editRisks,
        editVisualCharts,
      });

      // Store data for /ask API
      localStorage.setItem("industry-trends_original_json", JSON.stringify(originalData));
      localStorage.setItem("industry-trends_modified_json", JSON.stringify(modifiedData));

      // Update parent state with local values (trust the user's edits). The parent
      // cascade re-populates the shared query which the useIndustryTrends hook reads,
      // so there is no local mirror to optimistically update here anymore.
      if (onIndustryTrendsExecutiveSummaryChange) {
        onIndustryTrendsExecutiveSummaryChange(editExecutiveSummary);
      }
      if (onIndustryTrendsAiAdoptionChange) {
        onIndustryTrendsAiAdoptionChange(editAiAdoption);
      }
      if (onIndustryTrendsCloudMigrationChange) {
        onIndustryTrendsCloudMigrationChange(editCloudMigration);
      }
      if (onIndustryTrendsRegulatoryChange) {
        onIndustryTrendsRegulatoryChange(editRegulatory);
      }
      if (onIndustryTrendSnapshotsChange) {
        onIndustryTrendSnapshotsChange(editTrendSnapshots);
      }

      // Call the original save function to trigger chat panel
      onIndustryTrendsSaveChanges();
    } catch (error) {
      console.error("❌ Industry Trends - Error saving changes:", error);
      // Still call the original save function even if API fails
      onIndustryTrendsSaveChanges();
    }
  };

  // Individual box save functions
  const handleSaveExecutiveSummary = () => {
    if (onIndustryTrendsExecutiveSummaryChange) {
      onIndustryTrendsExecutiveSummaryChange(editExecutiveSummary);
      toast({
        title: "Saved",
        description: "Executive Summary changes committed.",
      });
    }
  };

  const handleSaveKeyMetrics = () => {
    if (onIndustryTrendsAiAdoptionChange) {
      onIndustryTrendsAiAdoptionChange(editAiAdoption);
    }
    if (onIndustryTrendsCloudMigrationChange) {
      onIndustryTrendsCloudMigrationChange(editCloudMigration);
    }
    if (onIndustryTrendsRegulatoryChange) {
      onIndustryTrendsRegulatoryChange(editRegulatory);
    }
    toast({
      title: "Saved",
      description: "Key Metrics changes committed.",
    });
  };

  const handleSaveTrendSnapshots = () => {
    if (onIndustryTrendSnapshotsChange) {
      onIndustryTrendSnapshotsChange(editTrendSnapshots);
    }
    toast({
      title: "Saved",
      description: "Trend Snapshots changes committed.",
    });
  };

  const handleSaveRegionalHotspots = () => {
    toast({
      title: "Saved",
      description: "Regional Hotspots changes committed.",
    });
  };

  const handleSaveStrategicRecommendations = () => {
    toast({
      title: "Saved",
      description: "Strategic Recommendations changes committed.",
    });
  };

  const handleSaveRisks = () => {
    toast({
      title: "Saved",
      description: "Risks changes committed.",
    });
  };

  const handleSaveVisualCharts = () => {
    toast({
      title: "Saved",
      description: "Visual Charts changes committed.",
    });
  };

  // Show loading state only when actively loading, not refreshing, and no data yet.
  if (it.isLoading && !isRefreshing && !displayData.executiveSummary) {
    return <LoadingState />;
  }

  // Show error state
  if (it.isError) {
    const message = it.error instanceof Error ? it.error.message : "Failed to load industry trends";
    return <ErrorState message={message} onRetry={() => it.regenerate()} />;
  }

  // Show no data state only if the hook has no data and we're not refreshing.
  if (!it.data && !isRefreshing) {
    return <NoDataState onGenerate={() => it.regenerate()} />;
  }
  return (
    <FeatureErrorBoundary>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <SectionHeader
          onModify={handleModify}
          isSplitView={isSplitView}
          onScoutIconClick={onScoutIconClick}
        />

        {isIndustryTrendsEditing ? (
          <div className="space-y-8">
            {/* Executive Summary Edit */}
            <ExecutiveSummary
              editing
              deleted={normalizedDeletedSections.has("executive-summary")}
              draft={editExecutiveSummary}
              summary={displayData.executiveSummary}
              onChange={setEditExecutiveSummary}
              onCommit={handleSaveExecutiveSummary}
              onDelete={() => onIndustryTrendsDeleteSection("executive-summary")}
            />

            {/* Key Metrics Edit */}
            <KeyMetrics
              editing
              deleted={normalizedDeletedSections.has("key-metrics")}
              aiAdoption={displayData.aiAdoption}
              cloudMigration={displayData.cloudMigration}
              regulatory={displayData.regulatory}
              aiAdoptionDraft={editAiAdoption}
              cloudMigrationDraft={editCloudMigration}
              regulatoryDraft={editRegulatory}
              onAiAdoptionChange={setEditAiAdoption}
              onCloudMigrationChange={setEditCloudMigration}
              onRegulatoryChange={setEditRegulatory}
              onCommit={handleSaveKeyMetrics}
              onDelete={() => onIndustryTrendsDeleteSection("key-metrics")}
            />

            {/* Trend Snapshots Edit */}
            <TrendSnapshots
              editing
              deleted={normalizedDeletedSections.has("trend-snapshots")}
              snapshots={displayData.trendSnapshots}
              draft={editTrendSnapshots}
              onChange={setEditTrendSnapshots}
              onCommit={handleSaveTrendSnapshots}
              onDelete={() => onIndustryTrendsDeleteSection("trend-snapshots")}
            />

            {/* Regional Hotspots Edit */}
            <RegionalHotspots
              editing
              deleted={normalizedDeletedSections.has("regional-hotspots")}
              regionalHotspots={displayData.regionalHotspots}
              draft={editRegionalHotspots}
              onChange={setEditRegionalHotspots}
              onCommit={handleSaveRegionalHotspots}
              onDelete={() => onIndustryTrendsDeleteSection("regional-hotspots")}
            />

            {/* Strategic Recommendations Edit */}
            <StrategicRecommendations
              editing
              deleted={normalizedDeletedSections.has("strategic-recommendations")}
              recommendations={displayData.strategicRecommendations}
              draft={editStrategicRecommendations}
              onChange={setEditStrategicRecommendations}
              onCommit={handleSaveStrategicRecommendations}
              onDelete={() => onIndustryTrendsDeleteSection("strategic-recommendations")}
            />

            {/* Risks & Watchouts Edit */}
            <RisksWatchouts
              editing
              deleted={normalizedDeletedSections.has("risks")}
              risks={displayData.risks}
              draft={editRisks}
              onChange={setEditRisks}
              onCommit={handleSaveRisks}
              onDelete={() => onIndustryTrendsDeleteSection("risks")}
            />

            {/* Visual Charts Edit */}
            <VisualCharts
              editing
              deleted={normalizedDeletedSections.has("visual-charts")}
              visualCharts={displayData.visualCharts}
              draft={editVisualCharts}
              onChange={setEditVisualCharts}
              onCommit={handleSaveVisualCharts}
              onDelete={() => onIndustryTrendsDeleteSection("visual-charts")}
            />

            {/* Save/Cancel Buttons */}
            <EditToolbar
              onSave={handleSaveChanges}
              onCancel={onIndustryTrendsCancelEdit}
              onHistory={onIndustryTrendsEditHistoryOpen}
              historyCount={industryTrendsEditHistory.length}
              onScout={() => onScoutIconClick("industry-trends")}
            />

            {/* Export Options in Edit Mode */}
            <div className="border-t pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
              <div className="flex flex-wrap gap-3">
                <ExportFooter
                  onExportPDF={onExportPDF}
                  onSaveToWorkspace={onSaveToWorkspace}
                  onGenerateShareableLink={onGenerateShareableLink}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Default View */}
            <div>
              <ExecutiveSummary
                editing={false}
                deleted={false}
                summary={displayData.executiveSummary}
                draft={editExecutiveSummary}
                onChange={setEditExecutiveSummary}
                onCommit={handleSaveExecutiveSummary}
                onDelete={() => onIndustryTrendsDeleteSection("executive-summary")}
              />

              {/* Key Metrics Cards */}
              <KeyMetrics
                editing={false}
                deleted={false}
                aiAdoption={displayData.aiAdoption}
                cloudMigration={displayData.cloudMigration}
                regulatory={displayData.regulatory}
                aiAdoptionDraft={editAiAdoption}
                cloudMigrationDraft={editCloudMigration}
                regulatoryDraft={editRegulatory}
                onAiAdoptionChange={setEditAiAdoption}
                onCloudMigrationChange={setEditCloudMigration}
                onRegulatoryChange={setEditRegulatory}
                onCommit={handleSaveKeyMetrics}
                onDelete={() => onIndustryTrendsDeleteSection("key-metrics")}
              />
            </div>

            {/* Read More Button */}
            {!industryTrendsExpanded && !isSplitView && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => onIndustryTrendsExpandToggle(true)}
                  variant="outline"
                  className="flex items-center space-x-2 text-sm hover:bg-gray-50"
                >
                  <span>Read More</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Expanded Content */}
            {(industryTrendsExpanded || isSplitView) && (
              <div className="animate-fade-in space-y-8">
                <div className="border-t pt-6">
                  {/* Key Trend Snapshots */}
                  <TrendSnapshots
                    editing={false}
                    deleted={false}
                    snapshots={displayData.trendSnapshots}
                    draft={editTrendSnapshots}
                    onChange={setEditTrendSnapshots}
                    onCommit={handleSaveTrendSnapshots}
                    onDelete={() => onIndustryTrendsDeleteSection("trend-snapshots")}
                  />

                  {/* Regional Hotspots */}
                  <RegionalHotspots
                    editing={false}
                    deleted={false}
                    regionalHotspots={displayData.regionalHotspots}
                    draft={{ APAC: "", Europe: "", "North America": "" }}
                    onChange={() => {}}
                    onCommit={() => {}}
                    onDelete={() => {}}
                  />

                  {/* Strategic Recommendations */}
                  <StrategicRecommendations
                    editing={false}
                    deleted={false}
                    recommendations={displayData.strategicRecommendations}
                    draft={{ primaryFocus: "", marketEntry: "" }}
                    onChange={() => {}}
                    onCommit={() => {}}
                    onDelete={() => {}}
                  />

                  {/* Risks & Watchouts */}
                  <RisksWatchouts
                    editing={false}
                    deleted={false}
                    risks={displayData.risks}
                    draft={[]}
                    onChange={() => {}}
                    onCommit={() => {}}
                    onDelete={() => {}}
                  />

                  {/* Visual Charts Section */}
                  <VisualCharts
                    editing={false}
                    deleted={false}
                    visualCharts={displayData.visualCharts}
                    draft={{ aiAdoptionTrends: [], technologyBudgetAllocation: {} }}
                    onChange={() => {}}
                    onCommit={() => {}}
                    onDelete={() => {}}
                  />

                  {/* Export Footer */}
                  <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-6 -mb-6 rounded-b-lg">
                    <div className="flex flex-wrap gap-3 justify-center">
                      <ExportFooter
                        onExportPDF={onExportPDF}
                        onSaveToWorkspace={onSaveToWorkspace}
                        onGenerateShareableLink={onGenerateShareableLink}
                      />
                    </div>
                  </div>

                  {/* Show Less Button - Only when not in split view */}
                  {!isSplitView && (
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={() => onIndustryTrendsExpandToggle(false)}
                        variant="outline"
                        className="flex items-center space-x-2 text-sm"
                      >
                        <span>Show Less</span>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FeatureErrorBoundary>
  );
};

export default IndustryTrendsSection;
