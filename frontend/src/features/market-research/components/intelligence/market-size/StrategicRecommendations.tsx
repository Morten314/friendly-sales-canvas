import { Check, Target, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StrategicRecommendationsProps {
  editing: boolean;
  deleted: boolean;
  recommendations: string[];
  draft: string[];
  onChange: (next: string[]) => void;
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
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
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
          <Label className="text-sm font-medium text-gray-700 mb-2 block">
            Strategic Recommendations
          </Label>
          {draft.map((rec, index) => (
            <Textarea
              key={index}
              value={rec}
              onChange={(e) => {
                const newRecs = [...draft];
                newRecs[index] = e.target.value;
                onChange(newRecs);
              }}
              className="w-full h-20 resize-none mb-3"
              placeholder={`Strategic recommendation ${index + 1}...`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-green-600" />
        Strategic Recommendations
      </h3>
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <ul className="space-y-2 text-gray-700">
          {Array.isArray(recommendations) && recommendations.length > 0 ? (
            recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                {rec}
              </li>
            ))
          ) : (
            <li className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
              No strategic recommendations available
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
