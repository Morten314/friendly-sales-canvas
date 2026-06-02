import { Check, X } from "lucide-react";

import type { TrendSnapshot } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TrendSnapshotsProps {
  editing: boolean;
  deleted: boolean;
  snapshots: TrendSnapshot[];
  draft: TrendSnapshot[];
  onChange: (next: TrendSnapshot[]) => void;
  onCommit: () => void;
  onDelete: () => void;
}

export function TrendSnapshots({
  editing,
  deleted,
  snapshots,
  draft,
  onChange,
  onCommit,
  onDelete,
}: TrendSnapshotsProps) {
  if (editing && deleted) {
    return null;
  }

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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Trend Snapshots</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {draft?.map((trend, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <Label
                    htmlFor={`trendTitle-${index}`}
                    className="text-sm font-medium text-gray-700 mb-1 block"
                  >
                    Title
                  </Label>
                  <Input
                    id={`trendTitle-${index}`}
                    value={trend.title}
                    onChange={(e) => {
                      const updated = [...draft];
                      updated[index] = { ...trend, title: e.target.value };
                      onChange(updated);
                    }}
                    className="font-medium text-gray-900"
                    placeholder="Trend title"
                  />
                </div>
                <div>
                  <Label
                    htmlFor={`trendMetric-${index}`}
                    className="text-sm font-medium text-gray-700 mb-1 block"
                  >
                    Metric
                  </Label>
                  <Input
                    id={`trendMetric-${index}`}
                    value={trend.metric}
                    onChange={(e) => {
                      const updated = [...draft];
                      updated[index] = { ...trend, metric: e.target.value };
                      onChange(updated);
                    }}
                    className="text-sm text-gray-600"
                    placeholder="Trend metric"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Trend Snapshots</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {snapshots?.map((trend, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">{trend.title}</h4>
            <p className="text-sm text-gray-600 mb-3">{trend.metric}</p>
            <div className="h-8 bg-gradient-to-r from-purple-100 to-blue-100 rounded"></div>
          </div>
        )) || <p className="text-gray-500">No trend snapshots available</p>}
      </div>
    </div>
  );
}
