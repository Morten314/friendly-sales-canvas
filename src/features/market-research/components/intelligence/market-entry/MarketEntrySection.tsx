import {
  Bot,
  Target,
  AlertTriangle,
  FileText,
  Save,
  Share,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import React, { useState } from "react";

import type { EditRecord } from "../../types";

import MarketEntryBulletList from "./MarketEntryBulletList";
import MarketEntryEditForm from "./MarketEntryEditForm";
import MarketEntryHeader from "./MarketEntryHeader";
import MarketEntryKpiCards from "./MarketEntryKpiCards";
import MarketEntrySwotGrid from "./MarketEntrySwotGrid";
import MarketEntryTimeline from "./MarketEntryTimeline";
import { useMarketEntry } from "./useMarketEntry";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { buildApiUrl } from "@/shared/api/transport";
import { useAuth } from "@/shared/auth";

interface MarketEntrySectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  onToggleEdit: () => void;
  onScoutIconClick: (context?: "market-entry", hasEdits?: boolean, customMessage?: string) => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onEntryBarriersChange: (barriers: string[]) => void;
  onRecommendedChannelChange: (value: string) => void;
  onTimeToMarketChange: (value: string) => void;
  onTopBarrierChange: (value: string) => void;
  onCompetitiveDifferentiationChange: (differentiation: string[]) => void;
  onStrategicRecommendationsChange: (recommendations: string[]) => void;
  onRiskAssessmentChange: (risks: string[]) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}

const MarketEntrySection: React.FC<MarketEntrySectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory: _editHistory,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onEntryBarriersChange,
  onRecommendedChannelChange,
  onTimeToMarketChange,
  onTopBarrierChange,
  onCompetitiveDifferentiationChange,
  onStrategicRecommendationsChange,
  onRiskAssessmentChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
}) => {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility
  const { toast } = useToast();

  // Section SERVER data now comes exclusively from the useMarketEntry hook
  // (TanStack-backed, memory-only cache). The parent MarketResearch cascade
  // populates the same component via the shared query, so this reads it directly.
  const me = useMarketEntry(currentUser?.uid ?? "", orgIdToUse);

  // Local edit state variables
  const [editExecutiveSummary, setEditExecutiveSummary] = useState("");
  const [editEntryBarriers, setEditEntryBarriers] = useState<string[]>([]);
  const [editRecommendedChannel, setEditRecommendedChannel] = useState("");
  const [editTimeToMarket, setEditTimeToMarket] = useState("");
  const [editTopBarrier, setEditTopBarrier] = useState("");
  const [editCompetitiveDifferentiation, setEditCompetitiveDifferentiation] = useState<string[]>(
    [],
  );
  const [editStrategicRecommendations, setEditStrategicRecommendations] = useState<string[]>([]);
  const [editRiskAssessment, setEditRiskAssessment] = useState<string[]>([]);
  const [editSwotAnalysis, setEditSwotAnalysis] = useState<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  }>({
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
  });

  // Handle modify button click - initialize edit fields with current data
  const handleModify = () => {
    // Initialize all edit fields with current data
    setEditExecutiveSummary(displayData.executiveSummary || "");
    setEditEntryBarriers(displayData.entryBarriers || []);
    setEditRecommendedChannel(
      typeof displayData.recommendedChannel === "object" && displayData.recommendedChannel !== null
        ? (displayData.recommendedChannel.channel as string) ||
            JSON.stringify(displayData.recommendedChannel)
        : displayData.recommendedChannel || "",
    );
    setEditTimeToMarket(displayData.timeToMarket || "");
    setEditTopBarrier(displayData.topBarrier || "");
    setEditCompetitiveDifferentiation(displayData.competitiveDifferentiation || []);
    setEditStrategicRecommendations(displayData.strategicRecommendations || []);
    setEditRiskAssessment(displayData.riskAssessment || []);

    // Initialize SWOT analysis - check if it exists in displayData, otherwise use defaults
    const swotData = displayData.swotAnalysis || {
      strengths: ["Strong tech platform"],
      weaknesses: ["Limited local presence"],
      opportunities: ["Growing market"],
      threats: ["Regulatory changes"],
    };
    setEditSwotAnalysis(swotData);

    onToggleEdit();
  };

  // Push the local edit-state values up to the parent and trigger the save.
  // Used in both the API-success and API-failure paths — we trust the user's
  // edits regardless of whether the /ask call succeeded.
  const persistEditsToParent = () => {
    onExecutiveSummaryChange(editExecutiveSummary);
    onEntryBarriersChange(editEntryBarriers);
    onRecommendedChannelChange(editRecommendedChannel);
    onTimeToMarketChange(editTimeToMarket);
    onTopBarrierChange(editTopBarrier);
    onCompetitiveDifferentiationChange(editCompetitiveDifferentiation);
    onStrategicRecommendationsChange(editStrategicRecommendations);
    onRiskAssessmentChange(editRiskAssessment);
    onSaveChanges();
  };

  // Handle save changes with API integration
  const handleMarketEntryFullSaveChanges = async () => {
    try {
      // Prepare original data
      const originalData = {
        section: "market-entry",
        executiveSummary: displayData.executiveSummary,
        entryBarriers: displayData.entryBarriers,
        recommendedChannel: displayData.recommendedChannel,
        timeToMarket: displayData.timeToMarket,
        topBarrier: displayData.topBarrier,
        competitiveDifferentiation: displayData.competitiveDifferentiation,
        strategicRecommendations: displayData.strategicRecommendations,
        riskAssessment: displayData.riskAssessment,
        swotAnalysis: displayData.swotAnalysis || {
          strengths: ["Strong tech platform"],
          weaknesses: ["Limited local presence"],
          opportunities: ["Growing market"],
          threats: ["Regulatory changes"],
        },
      };

      // Prepare modified data using local edit state
      const modifiedData = {
        section: "market-entry",
        executiveSummary: editExecutiveSummary,
        entryBarriers: editEntryBarriers,
        recommendedChannel: editRecommendedChannel,
        timeToMarket: editTimeToMarket,
        topBarrier: editTopBarrier,
        competitiveDifferentiation: editCompetitiveDifferentiation,
        strategicRecommendations: editStrategicRecommendations,
        riskAssessment: editRiskAssessment,
        swotAnalysis: editSwotAnalysis,
      };

      // Store data for /ask API
      localStorage.setItem("market-entry_original_json", JSON.stringify(originalData));
      localStorage.setItem("market-entry_modified_json", JSON.stringify(modifiedData));

      // Call GET API to save edits using /ask endpoint with query parameters
      const queryParams = new URLSearchParams({
        original_json: JSON.stringify(originalData),
        modified_json: JSON.stringify(modifiedData),
        edit_type: "modification",
        section: "market_entry",
      });

      const response = await fetch(buildApiUrl(`ask?${queryParams}`), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update parent state with local values (trust the user's edits)
      persistEditsToParent();
    } catch (error) {
      console.error("❌ Market Entry - Error saving changes:", error);

      // Even if the /ask call fails, still persist the user's edits.
      persistEditsToParent();
    }
  };

  // Check if we have any meaningful data to display.
  // SERVER data now comes from the useMarketEntry hook (me.data); props remain
  // the fallback (parent cascade + in-flight edit-form writes still flow via props).
  const serverData = me.data;

  // Map swot to swotAnalysis to match frontend structure.
  // Prioritize me.data's swot/swotAnalysis (server source).
  const rawSwot = serverData?.swot ?? serverData?.swotAnalysis;
  // CRITICAL: Don't normalize - use the data directly to preserve array items!
  // Only check that it's a valid object with arrays, but use original arrays.
  const finalSwotData:
    | { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }
    | undefined =
    rawSwot &&
    Array.isArray(rawSwot.strengths) &&
    Array.isArray(rawSwot.weaknesses) &&
    Array.isArray(rawSwot.opportunities) &&
    Array.isArray(rawSwot.threats)
      ? {
          strengths: rawSwot.strengths,
          weaknesses: rawSwot.weaknesses,
          opportunities: rawSwot.opportunities,
          threats: rawSwot.threats,
        }
      : undefined;

  // Resolve the section's display values from the useMarketEntry hook's server
  // data (me.data). The former prop fallbacks were removed — MarketEntry now owns
  // its read path via the hook — so each field defaults to a sensible empty value
  // ("" for strings, [] for arrays) to preserve the prior empty-state rendering.
  const displayData = {
    executiveSummary: serverData?.executiveSummary || "",
    entryBarriers: serverData?.entryBarriers ?? [],
    // recommendedChannel may be a string OR an object (JSX handles both shapes).
    recommendedChannel: serverData?.recommendedChannel || "",
    timeToMarket: serverData?.timeToMarket || "",
    topBarrier: serverData?.topBarrier || "",
    competitiveDifferentiation: serverData?.competitiveDifferentiation ?? [],
    strategicRecommendations: serverData?.strategicRecommendations ?? [],
    riskAssessment: serverData?.riskAssessment ?? [],
    // SWOT is NOT in props - only present when me.data carries it (edit mode falls
    // back to editSwotAnalysis at the MarketEntrySwotGrid call sites).
    swotAnalysis: finalSwotData,
  };

  const hasData =
    displayData.executiveSummary ||
    displayData.entryBarriers.length > 0 ||
    displayData.recommendedChannel ||
    displayData.timeToMarket ||
    displayData.topBarrier ||
    displayData.competitiveDifferentiation.length > 0 ||
    displayData.strategicRecommendations.length > 0 ||
    displayData.riskAssessment.length > 0;

  // Show loading state only when actively loading and have no data, not when showing fallback data
  if (me.isLoading && !hasData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <MarketEntryHeader
          isSplitView={isSplitView}
          onToggleEdit={handleModify}
          onEditHistoryOpen={onEditHistoryOpen}
          onScoutIconClick={onScoutIconClick}
        />
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading market entry data...</p>
        </div>
      </div>
    );
  }

  // Show empty state if we have no data and not loading
  if (!hasData && !me.isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <MarketEntryHeader
          showActions
          isSplitView={isSplitView}
          onToggleEdit={handleModify}
          onEditHistoryOpen={onEditHistoryOpen}
          onScoutIconClick={onScoutIconClick}
        />
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No market entry data available</p>
          <Button
            onClick={() => {
              me.regenerate();
              toast({
                title: "Generating",
                description: "Scout is regenerating the market entry report.",
              });
            }}
            disabled={me.isRegenerating}
            variant="outline"
            className="text-gray-400 border-gray-300 opacity-50"
          >
            <Bot className="h-4 w-4 mr-2" />
            Generate Report with Scout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <MarketEntryHeader
        showActions
        showEditButton
        showEditHistory={hasEdits}
        isSplitView={isSplitView}
        onToggleEdit={handleModify}
        onEditHistoryOpen={onEditHistoryOpen}
        onScoutIconClick={onScoutIconClick}
      />

      {/* Collapsed View */}
      {!isExpanded && !isEditing && (
        <div className="space-y-4">
          <div className="text-gray-700 leading-relaxed whitespace-pre-line">
            {displayData.executiveSummary}
          </div>

          <MarketEntryKpiCards
            recommendedChannel={displayData.recommendedChannel}
            timeToMarket={displayData.timeToMarket}
            topBarrier={displayData.topBarrier}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">SWOT Analysis</h4>
              <MarketEntrySwotGrid swot={displayData.swotAnalysis || editSwotAnalysis} />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Timeline Preview</h4>
              <MarketEntryTimeline />
            </div>
          </div>

          {/* Read More Button - Only show when not expanded and not in split view */}
          {!isExpanded && !isSplitView && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => onExpandToggle(true)}
                variant="outline"
                className="flex items-center space-x-2 text-sm hover:bg-gray-50"
              >
                <span>Read More</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && !isEditing && (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              Executive Summary
            </h3>
            <div className="text-gray-700 leading-relaxed space-y-3">
              {displayData.executiveSummary.split("\n").map((paragraph: string, index: number) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>

          <MarketEntryKpiCards
            recommendedChannel={displayData.recommendedChannel}
            timeToMarket={displayData.timeToMarket}
            topBarrier={displayData.topBarrier}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">SWOT Analysis</h4>
              <MarketEntrySwotGrid swot={displayData.swotAnalysis || editSwotAnalysis} />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Timeline Preview</h4>
              <MarketEntryTimeline />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MarketEntryBulletList
              title="Entry Barriers"
              icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
              variant="bullets"
              accentClassName="text-orange-500 mt-1"
              items={displayData.entryBarriers}
            />

            <MarketEntryBulletList
              title="Competitive Differentiation"
              icon={<Target className="h-4 w-4 text-green-600" />}
              variant="bullets"
              accentClassName="text-green-500 mt-1"
              items={displayData.competitiveDifferentiation}
            />
          </div>

          <MarketEntryBulletList
            title="Strategic Recommendations"
            icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
            variant="cards"
            cardsContainerClassName="grid grid-cols-1 md:grid-cols-2 gap-4"
            cardClassName="bg-blue-50 p-3 rounded-lg border border-blue-200"
            cardTextClassName="text-sm font-medium text-blue-900"
            items={displayData.strategicRecommendations}
          />

          <MarketEntryBulletList
            title="Risk Assessment"
            icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
            variant="cards"
            cardsContainerClassName="space-y-2"
            cardClassName="bg-red-50 p-3 rounded-lg border border-red-200"
            cardTextClassName="text-sm text-red-900"
            items={displayData.riskAssessment}
          />

          <div className="pt-4 border-t space-y-3 w-full flex flex-col items-start gap-3">
            <div className="flex flex-wrap gap-2 justify-start">
              <Button variant="outline" size="sm" onClick={onExportPDF}>
                <FileText className="h-4 w-4 mr-1" />
                Save as PDF
              </Button>
              <Button variant="outline" size="sm" onClick={onSaveToWorkspace}>
                <Save className="h-4 w-4 mr-1" />
                Save to Workspace
              </Button>
              <Button variant="outline" size="sm" onClick={onGenerateShareableLink}>
                <Share className="h-4 w-4 mr-1" />
                Shareable Link
              </Button>
            </div>
            <div className="flex justify-center w-full">
              <Button
                onClick={() => onExpandToggle(false)}
                variant="outline"
                className="flex items-center space-x-2 text-sm"
              >
                <span>Show Less</span>
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <MarketEntryEditForm
          deletedSections={deletedSections}
          editExecutiveSummary={editExecutiveSummary}
          setEditExecutiveSummary={setEditExecutiveSummary}
          editEntryBarriers={editEntryBarriers}
          setEditEntryBarriers={setEditEntryBarriers}
          editRecommendedChannel={editRecommendedChannel}
          setEditRecommendedChannel={setEditRecommendedChannel}
          editTimeToMarket={editTimeToMarket}
          setEditTimeToMarket={setEditTimeToMarket}
          editTopBarrier={editTopBarrier}
          setEditTopBarrier={setEditTopBarrier}
          editCompetitiveDifferentiation={editCompetitiveDifferentiation}
          setEditCompetitiveDifferentiation={setEditCompetitiveDifferentiation}
          editStrategicRecommendations={editStrategicRecommendations}
          setEditStrategicRecommendations={setEditStrategicRecommendations}
          editRiskAssessment={editRiskAssessment}
          setEditRiskAssessment={setEditRiskAssessment}
          editSwotAnalysis={editSwotAnalysis}
          setEditSwotAnalysis={setEditSwotAnalysis}
          onSave={handleMarketEntryFullSaveChanges}
          onCancelEdit={onCancelEdit}
          onEditHistoryOpen={onEditHistoryOpen}
          onScoutIconClick={onScoutIconClick}
          onDeleteSection={onDeleteSection}
          onExecutiveSummaryChange={onExecutiveSummaryChange}
          onEntryBarriersChange={onEntryBarriersChange}
          onRecommendedChannelChange={onRecommendedChannelChange}
          onTimeToMarketChange={onTimeToMarketChange}
          onTopBarrierChange={onTopBarrierChange}
          onCompetitiveDifferentiationChange={onCompetitiveDifferentiationChange}
          onStrategicRecommendationsChange={onStrategicRecommendationsChange}
          onRiskAssessmentChange={onRiskAssessmentChange}
          toast={toast}
        />
      )}
    </div>
  );
};

export default MarketEntrySection;
