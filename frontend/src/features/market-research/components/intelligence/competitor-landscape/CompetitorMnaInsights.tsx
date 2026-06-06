import { Check, X } from "lucide-react";

import type { MnaInsight, UntypedBackendApiResponse } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CompetitorMnaInsightsProps {
  isEditing: boolean;
  localInsights: MnaInsight[];
  setLocalInsights: (insights: MnaInsight[]) => void;
  handleSaveMnaInsights: () => void;
}

export function CompetitorMnaInsights({
  isEditing,
  localInsights,
  setLocalInsights,
  handleSaveMnaInsights,
}: CompetitorMnaInsightsProps) {
  // Helper: clone insights, apply patch at index, propagate.
  const updateInsight = (index: number, patch: Partial<MnaInsight>) => {
    const updated = [...localInsights];
    updated[index] = { ...updated[index], ...patch };
    setLocalInsights(updated);
  };

  const insights = localInsights;

  if (!insights || insights.length === 0) return null;

  return (
    <div className="mb-8 relative group">
      {isEditing && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveMnaInsights}
                className="text-gray-400 hover:text-green-600 hover:bg-green-50"
                title="Commit changes"
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Commit changes</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-4">M&A Insights</h3>
      <div className="grid grid-cols-1 gap-4">
        {insights.map((insight: UntypedBackendApiResponse, index: number) => {
          return (
            <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={insight?.label || ""}
                    onChange={(e) => updateInsight(index, { label: e.target.value })}
                    className="font-medium text-yellow-800 bg-white"
                    placeholder="Insight label"
                  />
                  <Textarea
                    value={insight?.description || ""}
                    onChange={(e) => updateInsight(index, { description: e.target.value })}
                    className="text-yellow-700 bg-white"
                    placeholder="Insight description"
                    rows={3}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLocalInsights(localInsights.filter((_, i) => i !== index));
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove Insight
                  </Button>
                </div>
              ) : (
                <>
                  <h4 className="font-medium text-yellow-800 mb-2">
                    {insight?.label || "No label available"}
                  </h4>
                  <p className="text-yellow-700">
                    {insight?.description || "No description available"}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocalInsights([...localInsights, { label: "", description: "" }])}
          className="mt-2"
        >
          Add M&A Insight
        </Button>
      )}
    </div>
  );
}
