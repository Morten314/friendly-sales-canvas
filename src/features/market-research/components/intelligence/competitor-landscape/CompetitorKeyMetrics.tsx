import { Check, X } from "lucide-react";
import React from "react";

import type { Metric } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CompetitorKeyMetricsProps {
  isEditing: boolean;
  localMetrics: Metric[];
  setLocalMetrics: (metrics: Metric[]) => void;
  localTopPlayerShare: string;
  setLocalTopPlayerShare: (value: string) => void;
  localEmergingPlayers: string;
  setLocalEmergingPlayers: (value: string) => void;
  displayTopPlayerShare: string;
  displayEmergingPlayers: string;
  handleSaveTopPlayerShare: () => void;
  handleSaveEmergingPlayers: () => void;
}

export const CompetitorKeyMetrics: React.FC<CompetitorKeyMetricsProps> = ({
  isEditing,
  localMetrics,
  setLocalMetrics,
  localTopPlayerShare,
  setLocalTopPlayerShare,
  localEmergingPlayers,
  setLocalEmergingPlayers,
  displayTopPlayerShare,
  displayEmergingPlayers,
  handleSaveTopPlayerShare,
  handleSaveEmergingPlayers,
}) => {
  // Helper: clone metrics, apply patch at index, propagate.
  const updateMetric = (index: number, patch: Partial<Metric>) => {
    const updated = [...localMetrics];
    updated[index] = { ...updated[index], ...patch };
    setLocalMetrics(updated);
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(() => {
          // Try to get metrics from API's section component first
          const apiMetrics = localMetrics;

          // If we have API metrics OR we're in edit mode (to allow adding), show metrics section
          if ((apiMetrics && Array.isArray(apiMetrics) && apiMetrics.length > 0) || isEditing) {
            // If no metrics but in edit mode, show empty state with ability to add
            if (!apiMetrics || apiMetrics.length === 0) {
              return (
                <div className="col-span-2 text-center py-4 text-gray-500">
                  No metrics yet. Click "Add Metric" below to add one.
                </div>
              );
            }

            return apiMetrics.map((metric, index) => (
              <div key={index} className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={metric.value || ""}
                          onChange={(e) => updateMetric(index, { value: e.target.value })}
                          className="text-2xl font-bold text-blue-600 bg-white"
                          placeholder="Value"
                        />
                        <Input
                          value={metric.label || ""}
                          onChange={(e) => updateMetric(index, { label: e.target.value })}
                          className="text-sm text-gray-700 bg-white"
                          placeholder="Label"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLocalMetrics(localMetrics.filter((_, i) => i !== index));
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-blue-600">
                          {metric.value || "N/A"}
                        </div>
                        <div className="text-sm text-gray-700">{metric.label || "Metric"}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ));
          }

          // Fallback to original props-based display
          return (
            <>
              {/* Top Player Market Share */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg relative group">
                {isEditing && (
                  <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveTopPlayerShare}
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
                <div className="flex items-center">
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={localTopPlayerShare}
                          onChange={(e) => setLocalTopPlayerShare(e.target.value)}
                          className="text-2xl font-bold text-blue-600 bg-white"
                          placeholder="Top Player Market Share"
                        />
                        <div className="text-sm text-gray-700">Top Player Market Share</div>
                      </div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-blue-600">
                          {displayTopPlayerShare}
                        </div>
                        <div className="text-sm text-gray-700">Top Player Market Share</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Emerging Players */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg relative group">
                {isEditing && (
                  <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveEmergingPlayers}
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
                <div className="flex items-center">
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={localEmergingPlayers}
                          onChange={(e) => setLocalEmergingPlayers(e.target.value)}
                          className="text-2xl font-bold text-blue-600 bg-white"
                          placeholder="Emerging Players Added"
                        />
                        <div className="text-sm text-gray-700">Emerging Players Added</div>
                      </div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-blue-600">
                          {displayEmergingPlayers}
                        </div>
                        <div className="text-sm text-gray-700">Emerging Players Added</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocalMetrics([...localMetrics, { label: "", value: "" }])}
          className="mt-2"
        >
          Add Metric
        </Button>
      )}
    </div>
  );
};
