import { Check, TrendingUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MarketEntryProps {
  editing: boolean;
  deleted: boolean;
  value: string;
  draft: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onDelete: () => void;
}

export function MarketEntry({
  editing,
  deleted,
  value,
  draft,
  onChange,
  onCommit,
  onDelete,
}: MarketEntryProps) {
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
          <Label htmlFor="marketEntry" className="text-sm font-medium text-gray-700 mb-2 block">
            Market Entry Strategy
          </Label>
          <Textarea
            id="marketEntry"
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-32 resize-none"
            placeholder="Enter market entry strategy..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        Market Entry
      </h3>
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <p className="text-gray-700 mb-4">{value}</p>
      </div>
    </div>
  );
}
