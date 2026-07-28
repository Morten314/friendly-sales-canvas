import { Check, X } from "lucide-react";

import type { DataPoint } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CompetitorReportDataPointsProps {
  isEditing: boolean;
  dataPoints: DataPoint[];
  setDataPoints: (dataPoints: DataPoint[]) => void;
  onCommit: () => void;
}

export function CompetitorReportDataPoints({
  isEditing,
  dataPoints,
  setDataPoints,
  onCommit,
}: CompetitorReportDataPointsProps) {
  if (!dataPoints || dataPoints.length === 0) return null;

  return (
    <div className="mb-8 relative group">
      {isEditing && (
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
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitor Analysis Report</h3>
      <div className="grid grid-cols-1 gap-4">
        {dataPoints.map((dataPoint, index) => (
          <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={dataPoint.label}
                  onChange={(e) => {
                    const updated = [...dataPoints];
                    updated[index] = { ...updated[index], label: e.target.value };
                    setDataPoints(updated);
                  }}
                  className="font-medium text-blue-800 bg-white"
                  placeholder="Label"
                />
                <Textarea
                  value={dataPoint.value}
                  onChange={(e) => {
                    const updated = [...dataPoints];
                    updated[index] = { ...updated[index], value: e.target.value };
                    setDataPoints(updated);
                  }}
                  className="text-blue-700 bg-white"
                  placeholder="Value"
                  rows={2}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDataPoints(dataPoints.filter((_, i) => i !== index));
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <h4 className="font-medium text-blue-800 mb-2">{dataPoint.label}</h4>
                <p className="text-blue-700">{dataPoint.value}</p>
              </>
            )}
          </div>
        ))}
      </div>
      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDataPoints([...dataPoints, { label: "", value: "" }])}
          className="mt-2"
        >
          Add Data Point
        </Button>
      )}
    </div>
  );
}
