import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface KeyMetricsProps {
  editing: boolean;
  deleted: boolean;
  tamValue: string;
  samValue: string;
  growthRate: string;
  tamDraft: string;
  samDraft: string;
  growthRateDraft: string;
  onTamChange: (v: string) => void;
  onSamChange: (v: string) => void;
  onGrowthRateChange: (v: string) => void;
  onCommit: () => void;
  onDelete: () => void;
}

export function KeyMetrics({
  editing,
  deleted,
  tamValue,
  samValue,
  growthRate,
  tamDraft,
  samDraft,
  growthRateDraft,
  onTamChange,
  onSamChange,
  onGrowthRateChange,
  onCommit,
  onDelete,
}: KeyMetricsProps) {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="tamValue" className="text-sm font-medium text-gray-700 mb-2 block">
                Total Addressable Market
              </Label>
              <Input
                id="tamValue"
                value={tamDraft}
                onChange={(e) => onTamChange(e.target.value)}
                placeholder="e.g., $4.2B"
              />
            </div>
            <div>
              <Label htmlFor="samValue" className="text-sm font-medium text-gray-700 mb-2 block">
                Serviceable Addressable Market
              </Label>
              <Input
                id="samValue"
                value={samDraft}
                onChange={(e) => onSamChange(e.target.value)}
                placeholder="e.g., $2.1B"
              />
            </div>
            <div>
              <Label htmlFor="GrowthRate" className="text-sm font-medium text-gray-700 mb-2 block">
                Growth Rate
              </Label>
              <Input
                id="GrowthRate"
                value={growthRateDraft}
                onChange={(e) => onGrowthRateChange(e.target.value)}
                placeholder="e.g., 25%"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="text-2xl font-bold text-blue-600">{tamValue}</div>
        <div className="text-sm font-medium text-gray-900">Total Addressable Market</div>
        <div className="text-xs text-gray-600">Growing 15% YoY</div>
      </div>
      <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
        <div className="text-2xl font-bold text-green-600">{samValue}</div>
        <div className="text-sm font-medium text-gray-900">Serviceable Addressable Market</div>
        <div className="text-xs text-gray-600">Mid-market focus</div>
      </div>
      <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
        <div className="text-2xl font-bold text-purple-600">{growthRate}</div>
        <div className="text-sm font-medium text-gray-900">Growth Rate</div>
        <div className="text-xs text-gray-600">Fastest growing region</div>
      </div>
    </div>
  );
}
