import { Check, X } from "lucide-react";

import type { IndustryTrendsRecommendations } from "./types";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StrategicRecommendationsProps {
  editing: boolean;
  deleted: boolean;
  recommendations: IndustryTrendsRecommendations;
  draft: IndustryTrendsRecommendations;
  onChange: (next: IndustryTrendsRecommendations) => void;
  onCommit: () => void;
  onDelete: () => void;
}

export function StrategicRecommendations({
  editing,
  deleted,
  recommendations,
  draft,
  onChange,
  onCommit,
  onDelete,
}: StrategicRecommendationsProps) {
  if (editing && deleted) return null;

  if (editing) {
    return (
      <div className="relative group">
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCommit}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 pointer-events-auto z-50"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete this section</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <Label
                htmlFor="primaryFocus"
                className="text-sm font-medium text-green-900 mb-2 block"
              >
                Primary Focus
              </Label>
              <Textarea
                id="primaryFocus"
                value={draft.primaryFocus}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    primaryFocus: e.target.value,
                  })
                }
                className="text-green-700 text-sm border-green-200 focus:border-green-400"
                placeholder="Enter primary focus recommendation..."
                rows={4}
              />
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <Label htmlFor="marketEntry" className="text-sm font-medium text-blue-900 mb-2 block">
                Market Entry
              </Label>
              <Textarea
                id="marketEntry"
                value={draft.marketEntry}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    marketEntry: e.target.value,
                  })
                }
                className="text-blue-700 text-sm border-blue-200 focus:border-blue-400"
                placeholder="Enter market entry recommendation..."
                rows={4}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-medium text-green-900 mb-2">Primary Focus</h4>
          <p className="text-green-700 text-sm">
            {recommendations?.primaryFocus || "No recommendations available"}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Market Entry</h4>
          <p className="text-blue-700 text-sm">
            {recommendations?.marketEntry || "No recommendations available"}
          </p>
        </div>
      </div>
    </div>
  );
}
