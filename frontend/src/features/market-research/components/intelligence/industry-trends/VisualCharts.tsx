import { Check, X } from "lucide-react";

import { budgetToChartData } from "./industryTrends";
import type { VisualChartsData } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MiniLineChart from "@/components/ui/MiniLineChart";
import MiniPieChart from "@/components/ui/MiniPieChart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VisualChartsProps {
  editing: boolean;
  deleted: boolean;
  visualCharts: VisualChartsData;
  draft: VisualChartsData;
  onChange: (next: VisualChartsData) => void;
  onCommit: () => void;
  onDelete: () => void;
}

export function VisualCharts({
  editing,
  deleted,
  visualCharts,
  draft,
  onChange,
  onCommit,
  onDelete,
}: VisualChartsProps) {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Visual Charts</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <Label
                htmlFor="aiAdoptionTrends"
                className="text-sm font-medium text-gray-900 mb-3 block"
              >
                AI Adoption Trends
              </Label>
              <div className="space-y-2">
                {draft.aiAdoptionTrends.map((trend, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={trend}
                      onChange={(e) => {
                        const updated = [...draft.aiAdoptionTrends];
                        updated[index] = e.target.value;
                        onChange({
                          ...draft,
                          aiAdoptionTrends: updated,
                        });
                      }}
                      className="flex-1 text-sm"
                      placeholder="Enter trend (e.g., Q1 2024)"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const updated = draft.aiAdoptionTrends.filter((_, i) => i !== index);
                        onChange({
                          ...draft,
                          aiAdoptionTrends: updated,
                        });
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...draft,
                      aiAdoptionTrends: [...draft.aiAdoptionTrends, ""],
                    })
                  }
                  className="mt-2"
                >
                  Add Trend
                </Button>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <Label className="text-sm font-medium text-gray-900 mb-3 block">
                Technology Budget Allocation
              </Label>
              <div className="space-y-3">
                <div>
                  <Label
                    htmlFor="budgetAIML"
                    className="text-sm font-medium text-gray-700 mb-1 block"
                  >
                    AI/ML (%)
                  </Label>
                  <Input
                    id="budgetAIML"
                    value={draft.technologyBudgetAllocation["AI/ML"]}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        technologyBudgetAllocation: {
                          ...draft.technologyBudgetAllocation,
                          "AI/ML": e.target.value,
                        },
                      })
                    }
                    className="text-sm"
                    placeholder="e.g., 30"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="budgetCloud"
                    className="text-sm font-medium text-gray-700 mb-1 block"
                  >
                    Cloud (%)
                  </Label>
                  <Input
                    id="budgetCloud"
                    value={draft.technologyBudgetAllocation.Cloud}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        technologyBudgetAllocation: {
                          ...draft.technologyBudgetAllocation,
                          Cloud: e.target.value,
                        },
                      })
                    }
                    className="text-sm"
                    placeholder="e.g., 25"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="budgetSecurity"
                    className="text-sm font-medium text-gray-700 mb-1 block"
                  >
                    Security (%)
                  </Label>
                  <Input
                    id="budgetSecurity"
                    value={draft.technologyBudgetAllocation.Security}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        technologyBudgetAllocation: {
                          ...draft.technologyBudgetAllocation,
                          Security: e.target.value,
                        },
                      })
                    }
                    className="text-sm"
                    placeholder="e.g., 20"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Visual Charts</h3>
      {(() => {
        if (!visualCharts) {
          return <p className="text-gray-500">No visual charts data available</p>;
        }

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">AI Adoption Trends</h4>
              {(() => {
                const trendsData = visualCharts?.aiAdoptionTrends;

                if (trendsData && Array.isArray(trendsData) && trendsData.length > 0) {
                  return (
                    <MiniLineChart
                      data={trendsData.map((quarter, index) => ({
                        name: quarter || `Q${index + 1}`,
                        value: 45 + index * 11, // Dynamic values based on quarters
                      }))}
                      title=""
                      color="#8B5CF6"
                    />
                  );
                }
                return (
                  <p className="text-gray-500 text-sm">No AI adoption trends data available</p>
                );
              })()}
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Technology Budget Allocation</h4>
              {(() => {
                try {
                  const budgetData = visualCharts?.technologyBudgetAllocation;
                  if (!budgetData || Object.keys(budgetData).length === 0) {
                    return (
                      <p className="text-gray-500 text-sm">No budget allocation data available</p>
                    );
                  }

                  const chartData = budgetToChartData(budgetData);

                  if (chartData.length === 0) {
                    return (
                      <p className="text-gray-500 text-sm">
                        No valid budget allocation data available
                      </p>
                    );
                  }

                  return <MiniPieChart data={chartData} title="" />;
                } catch (error) {
                  console.error("Error rendering budget allocation chart:", error);
                  return (
                    <p className="text-gray-500 text-sm">Error loading budget allocation chart</p>
                  );
                }
              })()}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
