import { Bot, X, Clock, Check } from "lucide-react";

import MarketEntrySwotEditor, { type MarketEntrySwotEdit } from "./MarketEntrySwotEditor";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { useToast } from "@/components/ui/use-toast";

export interface MarketEntryEditFormProps {
  deletedSections: Set<string>;
  // Edit values + setters
  editExecutiveSummary: string;
  setEditExecutiveSummary: (value: string) => void;
  editEntryBarriers: string[];
  setEditEntryBarriers: (barriers: string[]) => void;
  editRecommendedChannel: string;
  setEditRecommendedChannel: (value: string) => void;
  editTimeToMarket: string;
  setEditTimeToMarket: (value: string) => void;
  editTopBarrier: string;
  setEditTopBarrier: (value: string) => void;
  editCompetitiveDifferentiation: string[];
  setEditCompetitiveDifferentiation: (differentiation: string[]) => void;
  editStrategicRecommendations: string[];
  setEditStrategicRecommendations: (recommendations: string[]) => void;
  editRiskAssessment: string[];
  setEditRiskAssessment: (risks: string[]) => void;
  // SWOT is SHARED state owned by the container (also read by the display
  // SwotGrid call sites), passed straight through to MarketEntrySwotEditor.
  editSwotAnalysis: MarketEntrySwotEdit;
  setEditSwotAnalysis: (next: MarketEntrySwotEdit) => void;
  // Container-resident handlers
  onSave: () => void;
  onCancelEdit: () => void;
  onEditHistoryOpen: () => void;
  onScoutIconClick: (context?: "market-entry", hasEdits?: boolean, customMessage?: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onEntryBarriersChange: (barriers: string[]) => void;
  onRecommendedChannelChange: (value: string) => void;
  onTimeToMarketChange: (value: string) => void;
  onTopBarrierChange: (value: string) => void;
  onCompetitiveDifferentiationChange: (differentiation: string[]) => void;
  onStrategicRecommendationsChange: (recommendations: string[]) => void;
  onRiskAssessmentChange: (risks: string[]) => void;
  toast: ReturnType<typeof useToast>["toast"];
}

/**
 * Market Entry edit form — the `isEditing` branch extracted verbatim from
 * MarketEntrySection.
 *
 * Controlled presentational component: all edit-state values, their setters,
 * the SHARED `editSwotAnalysis`, and the container-resident save/init handlers
 * (`onSave` is the container's `/ask`-backed full-save) are supplied via props.
 * No data fetching or `/ask` logic lives here.
 */
export default function MarketEntryEditForm({
  deletedSections,
  editExecutiveSummary,
  setEditExecutiveSummary,
  editEntryBarriers,
  setEditEntryBarriers,
  editRecommendedChannel,
  setEditRecommendedChannel,
  editTimeToMarket,
  setEditTimeToMarket,
  editTopBarrier,
  setEditTopBarrier,
  editCompetitiveDifferentiation,
  setEditCompetitiveDifferentiation,
  editStrategicRecommendations,
  setEditStrategicRecommendations,
  editRiskAssessment,
  setEditRiskAssessment,
  editSwotAnalysis,
  setEditSwotAnalysis,
  onSave,
  onCancelEdit,
  onEditHistoryOpen,
  onScoutIconClick,
  onDeleteSection,
  onExecutiveSummaryChange,
  onEntryBarriersChange,
  onRecommendedChannelChange,
  onTimeToMarketChange,
  onTopBarrierChange,
  onCompetitiveDifferentiationChange,
  onStrategicRecommendationsChange,
  onRiskAssessmentChange,
  toast,
}: MarketEntryEditFormProps) {
  return (
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
            <Label className="text-sm font-medium text-gray-700">Competitive Differentiation</Label>
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
                    const updated = editCompetitiveDifferentiation.filter((_, i) => i !== index);
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
            <Label className="text-sm font-medium text-gray-700">Strategic Recommendations</Label>
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
              onClick={() => setEditStrategicRecommendations([...editStrategicRecommendations, ""])}
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
        <Button onClick={onSave}>Save Changes</Button>
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
  );
}
