import { Check, X } from "lucide-react";
import React from "react";

import { generateTrendData } from "./competitorUiComponents";
import type { TrendChart } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MiniLineChart from "@/components/ui/MiniLineChart";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CompetitorMarketTrendsProps {
  isEditing: boolean;
  localCharts: TrendChart[];
  setLocalCharts: (charts: TrendChart[]) => void;
  handleSaveMarketTrends: () => void;
}

export const CompetitorMarketTrends: React.FC<CompetitorMarketTrendsProps> = ({
  isEditing,
  localCharts,
  setLocalCharts,
  handleSaveMarketTrends,
}) => {
  // Helper: clone charts, apply patch at index, propagate.
  const updateChart = (index: number, patch: Partial<TrendChart>) => {
    const updated = [...localCharts];
    updated[index] = { ...updated[index], ...patch };
    setLocalCharts(updated);
  };

  const charts = localCharts;

  if (!charts || charts.length === 0) return null;

  return (
    <div className="mb-8 relative group">
      {isEditing && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveMarketTrends}
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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Trends</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {charts.map((chart, index) => {
          const chartData = generateTrendData(chart.xAxis, index);
          return (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <Input
                    value={chart.name}
                    onChange={(e) => updateChart(index, { name: e.target.value })}
                    className="font-medium text-gray-900 bg-white mb-3"
                    placeholder="Chart name"
                  />
                  <Textarea
                    value={Array.isArray(chart.xAxis) ? chart.xAxis.join(", ") : chart.xAxis}
                    onChange={(e) => {
                      const xAxisArray = e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter((s) => s);
                      updateChart(index, {
                        xAxis: xAxisArray.length === 1 ? xAxisArray[0] : xAxisArray,
                      });
                    }}
                    className="text-sm text-gray-700 bg-white"
                    placeholder="X-axis labels (comma-separated)"
                    rows={2}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLocalCharts(localCharts.filter((_, i) => i !== index));
                    }}
                    className="text-red-600 hover:text-red-700 mt-2"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove Chart
                  </Button>
                </div>
              ) : (
                <MiniLineChart
                  data={chartData}
                  title={chart.name}
                  color={index === 0 ? "#3b82f6" : "#10b981"} // Blue for first, green for second
                />
              )}
            </div>
          );
        })}
      </div>
      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocalCharts([...localCharts, { name: "", xAxis: [] }])}
          className="mt-2"
        >
          Add Chart
        </Button>
      )}
    </div>
  );
};
