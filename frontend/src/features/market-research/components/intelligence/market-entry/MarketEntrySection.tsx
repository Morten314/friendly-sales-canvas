import {
  MapPin,
  Bot,
  Edit,
  Target,
  Clock,
  AlertTriangle,
  X,
  FileText,
  Save,
  Share,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import React, { useState } from "react";

import MarketEntryBulletList from "./MarketEntryBulletList";
import MarketEntryKpiCards from "./MarketEntryKpiCards";
import MarketEntrySwotEditor from "./MarketEntrySwotEditor";
import MarketEntrySwotGrid from "./MarketEntrySwotGrid";
import MarketEntryTimeline from "./MarketEntryTimeline";
import { useMarketEntry } from "./useMarketEntry";

import type { EditRecord } from "@/components/market-research/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type {
  UntypedReportSection,
  UntypedBackendProfile,
} from "@/lib/types/escape-hatches";
import { useAuth } from "@/shared/auth";

interface MarketEntrySectionProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  entryBarriers: string[];
  recommendedChannel: string;
  timeToMarket: string;
  topBarrier: string;
  competitiveDifferentiation: string[];
  strategicRecommendations: string[];
  riskAssessment: string[];
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
  // Add refresh props
  isRefreshing?: boolean;
  companyProfile?: UntypedBackendProfile;
}

const MarketEntrySection: React.FC<MarketEntrySectionProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory: _editHistory,
  executiveSummary,
  entryBarriers,
  recommendedChannel,
  timeToMarket,
  topBarrier,
  competitiveDifferentiation,
  strategicRecommendations,
  riskAssessment,
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

      console.log("📤 Market Entry - original_json:", originalData);
      console.log("📤 Market Entry - modified_json:", modifiedData);

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

      const response = await fetch(`/api/ask?${queryParams}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("📥 GET /ask status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update parent state with local values (trust the user's edits)
      onExecutiveSummaryChange(editExecutiveSummary);
      onEntryBarriersChange(editEntryBarriers);
      onRecommendedChannelChange(editRecommendedChannel);
      onTimeToMarketChange(editTimeToMarket);
      onTopBarrierChange(editTopBarrier);
      onCompetitiveDifferentiationChange(editCompetitiveDifferentiation);
      onStrategicRecommendationsChange(editStrategicRecommendations);
      onRiskAssessmentChange(editRiskAssessment);

      // Call the original save function
      onSaveChanges();
    } catch (error) {
      console.error("❌ Market Entry - Error saving changes:", error);

      // Even if API fails, update parent state with local values
      onExecutiveSummaryChange(editExecutiveSummary);
      onEntryBarriersChange(editEntryBarriers);
      onRecommendedChannelChange(editRecommendedChannel);
      onTimeToMarketChange(editTimeToMarket);
      onTopBarrierChange(editTopBarrier);
      onCompetitiveDifferentiationChange(editCompetitiveDifferentiation);
      onStrategicRecommendationsChange(editStrategicRecommendations);
      onRiskAssessmentChange(editRiskAssessment);

      // Still call the original save function even if API fails
      onSaveChanges();
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

  // Resolve the section's display values: me.data field wins, prop is the
  // fallback (parent cascade + in-flight edit-form writes still flow via props).
  const displayData = {
    executiveSummary: serverData?.executiveSummary || executiveSummary,
    entryBarriers:
      (serverData?.entryBarriers?.length ?? 0) > 0
        ? (serverData?.entryBarriers ?? [])
        : entryBarriers,
    // recommendedChannel may be a string OR an object (JSX handles both shapes).
    recommendedChannel: serverData?.recommendedChannel || recommendedChannel,
    timeToMarket: serverData?.timeToMarket || timeToMarket,
    topBarrier: serverData?.topBarrier || topBarrier,
    competitiveDifferentiation:
      (serverData?.competitiveDifferentiation?.length ?? 0) > 0
        ? (serverData?.competitiveDifferentiation ?? [])
        : competitiveDifferentiation,
    strategicRecommendations:
      (serverData?.strategicRecommendations?.length ?? 0) > 0
        ? (serverData?.strategicRecommendations ?? [])
        : strategicRecommendations,
    riskAssessment:
      (serverData?.riskAssessment?.length ?? 0) > 0
        ? (serverData?.riskAssessment ?? [])
        : riskAssessment,
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            Market Entry & Growth Strategy
          </h2>
        </div>
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            Market Entry & Growth Strategy
          </h2>
          <div className="flex items-center gap-3">
            {!isSplitView && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onScoutIconClick("market-entry");
                    }}
                    className="text-purple-600 hover:text-purple-700 transition-all duration-200 relative"
                  >
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <Bot className="h-5 w-5 relative z-10" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Chat with Scout</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-purple-600" />
          Market Entry & Growth Strategy
        </h2>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleModify}
            className="text-purple-800 hover:text-purple-900"
          >
            <Edit className="h-4 w-4" />
          </Button>
          {hasEdits && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditHistoryOpen}
              className="text-gray-600 hover:text-gray-700"
            >
              <Clock className="h-4 w-4" />
            </Button>
          )}
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onScoutIconClick("market-entry");
                  }}
                  className="text-purple-600 hover:text-purple-700 transition-all duration-200 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-5 w-5 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat with Scout</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

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
              {displayData.executiveSummary
                .split("\n")
                .map((paragraph: UntypedReportSection, index: number) => (
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
        <div className="space-y-6">
          <div className="relative group border border-gray-200 rounded-lg p-4">
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
              <button
                onClick={() => {
                  onExecutiveSummaryChange(editExecutiveSummary);
                  toast({
                    title: "Saved",
                    description: "Executive Summary changes committed.",
                  });
                }}
                className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                title="Commit changes"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  onDeleteSection("executive-summary");
                  onScoutIconClick(
                    "market-entry",
                    true,
                    "I noticed you removed the Executive Summary. Want me to help refine or replace it?",
                  );
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            </div>
            <div className="space-y-4">
              <Label
                htmlFor="market-entry-executive-summary"
                className="text-sm font-medium text-gray-700"
              >
                Executive Summary
              </Label>
              <Textarea
                id="market-entry-executive-summary"
                value={editExecutiveSummary}
                onChange={(e) => setEditExecutiveSummary(e.target.value)}
                rows={4}
                className="w-full"
                placeholder="Enter executive summary for market entry strategy..."
              />
            </div>
          </div>

          <div className="relative group border border-gray-200 rounded-lg p-4">
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
              <button
                onClick={() => {
                  onRecommendedChannelChange(editRecommendedChannel);
                  onTimeToMarketChange(editTimeToMarket);
                  onTopBarrierChange(editTopBarrier);
                  toast({
                    title: "Saved",
                    description: "Key Metrics changes committed.",
                  });
                }}
                className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                title="Commit changes"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  onDeleteSection("key-metrics");
                  onScoutIconClick(
                    "market-entry",
                    true,
                    "I noticed you removed the Key Metrics section. Want me to help refine or replace it?",
                  );
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recommended-channel" className="text-sm font-medium text-gray-700">
                  Recommended Entry Channel
                </Label>
                <Input
                  id="recommended-channel"
                  value={editRecommendedChannel}
                  onChange={(e) => setEditRecommendedChannel(e.target.value)}
                  placeholder="e.g., Local partnerships"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-to-market" className="text-sm font-medium text-gray-700">
                  Time to Market
                </Label>
                <Input
                  id="time-to-market"
                  value={editTimeToMarket}
                  onChange={(e) => setEditTimeToMarket(e.target.value)}
                  placeholder="e.g., 12-18 months"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="top-barrier" className="text-sm font-medium text-gray-700">
                  Top Barrier
                </Label>
                <Input
                  id="top-barrier"
                  value={editTopBarrier}
                  onChange={(e) => setEditTopBarrier(e.target.value)}
                  placeholder="e.g., Data residency laws"
                />
              </div>
            </div>
          </div>

          <div className="relative group border border-gray-200 rounded-lg p-4">
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
              <button
                onClick={() => {
                  onEntryBarriersChange(editEntryBarriers);
                  toast({
                    title: "Saved",
                    description: "Entry Barriers changes committed.",
                  });
                }}
                className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                title="Commit changes"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  onDeleteSection("entry-barriers");
                  onScoutIconClick(
                    "market-entry",
                    true,
                    "I noticed you removed the Entry Barriers section. Want me to help refine or replace it?",
                  );
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            </div>
            <div className="space-y-4">
              <Label className="text-sm font-medium text-gray-700">Entry Barriers</Label>
              {editEntryBarriers.map((barrier, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={barrier}
                    onChange={(e) => {
                      const updated = [...editEntryBarriers];
                      updated[index] = e.target.value;
                      setEditEntryBarriers(updated);
                    }}
                    placeholder={`Entry barrier ${index + 1}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const updated = editEntryBarriers.filter((_, i) => i !== index);
                      setEditEntryBarriers(updated);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditEntryBarriers([...editEntryBarriers, ""])}
              >
                Add Barrier
              </Button>
            </div>
          </div>

          {/* SWOT Analysis Edit */}
          {!deletedSections.has("swot-analysis") && (
            <div className="relative group border border-gray-200 rounded-lg p-4">
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                <button
                  onClick={() => {
                    toast({
                      title: "Saved",
                      description: "SWOT Analysis changes committed.",
                    });
                  }}
                  className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                  title="Commit changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    onDeleteSection("swot-analysis");
                    onScoutIconClick(
                      "market-entry",
                      true,
                      "I noticed you removed the SWOT Analysis section. Want me to help refine or replace it?",
                    );
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700">SWOT Analysis</Label>
                <MarketEntrySwotEditor value={editSwotAnalysis} onChange={setEditSwotAnalysis} />
              </div>
            </div>
          )}

          {/* Competitive Differentiation Edit */}
          {!deletedSections.has("competitive-differentiation") && (
            <div className="relative group border border-gray-200 rounded-lg p-4">
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                <button
                  onClick={() => {
                    onCompetitiveDifferentiationChange(editCompetitiveDifferentiation);
                    toast({
                      title: "Saved",
                      description: "Competitive Differentiation changes committed.",
                    });
                  }}
                  className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                  title="Commit changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    onDeleteSection("competitive-differentiation");
                    onScoutIconClick(
                      "market-entry",
                      true,
                      "I noticed you removed the Competitive Differentiation section. Want me to help refine or replace it?",
                    );
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700">
                  Competitive Differentiation
                </Label>
                {editCompetitiveDifferentiation.map((diff, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={diff}
                      onChange={(e) => {
                        const updated = [...editCompetitiveDifferentiation];
                        updated[index] = e.target.value;
                        setEditCompetitiveDifferentiation(updated);
                      }}
                      placeholder={`Differentiation point ${index + 1}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = editCompetitiveDifferentiation.filter(
                          (_, i) => i !== index,
                        );
                        setEditCompetitiveDifferentiation(updated);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditCompetitiveDifferentiation([...editCompetitiveDifferentiation, ""])
                  }
                >
                  Add Differentiation Point
                </Button>
              </div>
            </div>
          )}

          {/* Strategic Recommendations Edit */}
          {!deletedSections.has("strategic-recommendations") && (
            <div className="relative group border border-gray-200 rounded-lg p-4">
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                <button
                  onClick={() => {
                    onStrategicRecommendationsChange(editStrategicRecommendations);
                    toast({
                      title: "Saved",
                      description: "Strategic Recommendations changes committed.",
                    });
                  }}
                  className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                  title="Commit changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    onDeleteSection("strategic-recommendations");
                    onScoutIconClick(
                      "market-entry",
                      true,
                      "I noticed you removed the Strategic Recommendations section. Want me to help refine or replace it?",
                    );
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700">
                  Strategic Recommendations
                </Label>
                {editStrategicRecommendations.map((recommendation, index) => (
                  <div key={index} className="flex gap-2">
                    <Textarea
                      value={recommendation}
                      onChange={(e) => {
                        const updated = [...editStrategicRecommendations];
                        updated[index] = e.target.value;
                        setEditStrategicRecommendations(updated);
                      }}
                      className="flex-1"
                      rows={2}
                      placeholder={`Strategic recommendation ${index + 1}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = editStrategicRecommendations.filter((_, i) => i !== index);
                        setEditStrategicRecommendations(updated);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditStrategicRecommendations([...editStrategicRecommendations, ""])
                  }
                >
                  Add Recommendation
                </Button>
              </div>
            </div>
          )}

          {/* Risk Assessment Edit */}
          {!deletedSections.has("risk-assessment") && (
            <div className="relative group border border-gray-200 rounded-lg p-4">
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                <button
                  onClick={() => {
                    onRiskAssessmentChange(editRiskAssessment);
                    toast({
                      title: "Saved",
                      description: "Risk Assessment changes committed.",
                    });
                  }}
                  className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                  title="Commit changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    onDeleteSection("risk-assessment");
                    onScoutIconClick(
                      "market-entry",
                      true,
                      "I noticed you removed the Risk Assessment section. Want me to help refine or replace it?",
                    );
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700">Risk Assessment</Label>
                {editRiskAssessment.map((risk, index) => (
                  <div key={index} className="flex gap-2">
                    <Textarea
                      value={risk}
                      onChange={(e) => {
                        const updated = [...editRiskAssessment];
                        updated[index] = e.target.value;
                        setEditRiskAssessment(updated);
                      }}
                      className="flex-1"
                      rows={2}
                      placeholder={`Risk ${index + 1}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = editRiskAssessment.filter((_, i) => i !== index);
                        setEditRiskAssessment(updated);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditRiskAssessment([...editRiskAssessment, ""])}
                >
                  Add Risk
                </Button>
              </div>
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex items-center gap-3 pt-6 border-t">
            <Button onClick={handleMarketEntryFullSaveChanges}>Save Changes</Button>
            <Button variant="outline" onClick={onCancelEdit}>
              Cancel
            </Button>
            <div className="flex-1"></div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEditHistoryOpen}
                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200"
                >
                  <Clock className="h-4 w-4" />
                  Edit History
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View changes made to this report</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onScoutIconClick("market-entry");
                  }}
                  className="text-purple-600 hover:text-purple-700 transition-all duration-200 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-4 w-4 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat with Scout</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketEntrySection;
