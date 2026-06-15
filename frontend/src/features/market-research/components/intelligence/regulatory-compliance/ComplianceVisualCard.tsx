import { BarChart3, Clock, TrendingUp, Users, X } from "lucide-react";

import MiniLineChart from "../../MiniLineChart";
import MiniPieChart from "../../MiniPieChart";

import type { UntypedBackendApiResponse, UntypedVisualDataCard } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ComplianceVisualCardProps {
  card: UntypedVisualDataCard;
  cardIndex: number;
  isEditing: boolean;
  isExpanded: boolean;
  localVisualDataCards: UntypedVisualDataCard[];
  onVisualDataCardsChange: (next: UntypedVisualDataCard[]) => void;
}

export function ComplianceVisualCard({
  card,
  cardIndex,
  isEditing,
  isExpanded,
  localVisualDataCards,
  onVisualDataCardsChange,
}: ComplianceVisualCardProps) {
  // Helper: clone the cards array, update the card at cardIndex with the given patch, and propagate.
  const updateCardTitle = (title: string) => {
    const updated = [...localVisualDataCards];
    updated[cardIndex] = { ...updated[cardIndex], title };
    onVisualDataCardsChange(updated);
  };

  // Helper: shallow-clone the outer array, in-place spread-patch the data item at itemIndex.
  const updateCardDataItem = (itemIndex: number, patch: Record<string, unknown>) => {
    const updated = [...localVisualDataCards];
    updated[cardIndex].data[itemIndex] = { ...updated[cardIndex].data[itemIndex], ...patch };
    onVisualDataCardsChange(updated);
  };

  // Backend emits `chartType`; older/local cards use `type`. Read one normalized
  // discriminator so both render (TD-FE-23).
  const chartType = card.type ?? card.chartType;

  if (isExpanded) {
    return (
      <div key={cardIndex} className="bg-white border border-gray-200 rounded-lg p-4">
        <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
          {chartType === "pie-chart" && <Users className="h-4 w-4 mr-2 text-blue-600" />}
          {chartType === "line-chart" && <TrendingUp className="h-4 w-4 mr-2 text-green-600" />}
          {chartType === "bar-chart" && <BarChart3 className="h-4 w-4 mr-2 text-purple-600" />}
          {!chartType && <Users className="h-4 w-4 mr-2 text-blue-600" />}
          {card.title}
        </h5>

        {/* Render based on chart type */}
        {chartType === "pie-chart" ? (
          <MiniPieChart
            data={card.data.map((item: UntypedBackendApiResponse) => ({
              name: item.label,
              value: item.value,
              color: `hsl(${cardIndex * 137 + item.value * 2}, 70%, 50%)`,
            }))}
            title={card.title}
          />
        ) : chartType === "line-chart" ? (
          <MiniLineChart
            data={card.data.map((item: UntypedBackendApiResponse) => ({
              name: item.label,
              value: item.value,
            }))}
            title={card.title}
            color={`hsl(${cardIndex * 120}, 70%, 50%)`}
          />
        ) : chartType === "bar-chart" ? (
          <div className="space-y-3">
            {(() => {
              // Find max value to normalize progress bars
              const maxValue = Math.max(
                ...card.data.map((item: UntypedBackendApiResponse) => Number(item.value) || 0),
              );
              const normalizeValue = (val: number) =>
                maxValue > 100 ? Math.min((val / maxValue) * 100, 100) : Math.min(val, 100);

              return card.data.map((item: UntypedBackendApiResponse, index: number) => {
                const numericValue = Number(item.value) || 0;
                const normalizedWidth = normalizeValue(numericValue);

                return (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.label || item.name}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${normalizedWidth}%`,
                            backgroundColor: item.color || `hsl(${index * 60}, 70%, 50%)`,
                            maxWidth: "100%",
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {item.value}
                        {card.title?.includes("Growth") ? "B" : ""}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        ) : chartType === "timeline" ? (
          <div className="space-y-3">
            {card.data.map((item: UntypedBackendApiResponse, index: number) => (
              <div key={index} className="flex items-start space-x-3">
                <div
                  className={`w-2 h-2 rounded-full mt-2 ${
                    item.status === "critical" ? "bg-red-500" : "bg-blue-500"
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.event || item.label}</p>
                  <p className="text-xs text-gray-500">{item.date || item.time}</p>
                </div>
              </div>
            ))}
          </div>
        ) : chartType === "percentage" ? (
          <div className="space-y-3">
            {card.data.map((item: UntypedBackendApiResponse, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.metric || item.label}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                  <TrendingUp
                    className={`h-3 w-3 ${
                      item.trend === "up" ? "text-green-600" : "text-red-600"
                    } ${item.trend === "down" ? "rotate-180" : ""}`}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Fallback for unknown types or old format */
          <div className="space-y-3">
            {card.data.map((item: UntypedBackendApiResponse, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {item.metric || item.name || item.label}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                  {item.trend && (
                    <TrendingUp
                      className={`h-3 w-3 ${
                        item.trend === "up" ? "text-green-600" : "text-red-600"
                      } ${item.trend === "down" ? "rotate-180" : ""}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Find card by type dynamically
  if (chartType === "bar-chart") {
    return (
      <div key={cardIndex} className="bg-white border border-gray-200 rounded-lg p-4">
        {isEditing ? (
          <Input
            value={card.title || "Compliance Adoption Rates"}
            onChange={(e) => updateCardTitle(e.target.value)}
            className="font-medium text-gray-900 mb-3"
          />
        ) : (
          <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <BarChart3 className="h-4 w-4 mr-2 text-blue-600" />
            {card.title || "Compliance Adoption Rates"}
          </h5>
        )}
        <div className="space-y-3">
          {card.data && card.data.length > 0 ? (
            (() => {
              // Find max value to normalize progress bars
              const maxValue = Math.max(
                ...card.data.map(
                  (item: UntypedBackendApiResponse) =>
                    Number(item.value) || Number(item.name?.value) || 0,
                ),
              );
              const normalizeValue = (val: number) =>
                maxValue > 100 ? Math.min((val / maxValue) * 100, 100) : Math.min(val, 100);

              return card.data.map((item: UntypedBackendApiResponse, index: number) => {
                const numericValue = Number(item.value) || 0;
                const normalizedWidth = normalizeValue(numericValue);
                const itemName = item.name || item.label || "";

                return (
                  <div key={index} className="flex items-center justify-between gap-2">
                    {isEditing ? (
                      <>
                        <Input
                          value={itemName}
                          onChange={(e) => {
                            updateCardDataItem(index, {
                              name: e.target.value,
                              label: e.target.value,
                            });
                          }}
                          className="flex-1 text-sm"
                          placeholder="Name"
                        />
                        <Input
                          type="number"
                          value={item.value || ""}
                          onChange={(e) => {
                            updateCardDataItem(index, { value: Number(e.target.value) || 0 });
                          }}
                          className="w-20 text-sm"
                          placeholder="Value"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const updated = [...localVisualDataCards];
                            updated[cardIndex].data = updated[cardIndex].data.filter(
                              (_: UntypedBackendApiResponse, i: number) => i !== index,
                            );
                            onVisualDataCardsChange(updated);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-gray-600">{itemName}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${normalizedWidth}%`,
                                backgroundColor: item.color || `hsl(${index * 60}, 70%, 50%)`,
                                maxWidth: "100%",
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {item.value}
                            {card.title?.includes("Growth") ? "B" : ""}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              });
            })()
          ) : (
            <p className="text-gray-500 text-sm">No data available</p>
          )}
          {isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const updated = [...localVisualDataCards];
                updated[cardIndex].data = [
                  ...(updated[cardIndex].data || []),
                  { name: "", value: 0, color: "#3b82f6" },
                ];
                onVisualDataCardsChange(updated);
              }}
            >
              Add Item
            </Button>
          )}
        </div>
      </div>
    );
  } else if (chartType === "timeline") {
    return (
      <div key={cardIndex} className="bg-white border border-gray-200 rounded-lg p-4">
        {isEditing ? (
          <Input
            value={card.title || "Regulatory Timeline"}
            onChange={(e) => updateCardTitle(e.target.value)}
            className="font-medium text-gray-900 mb-3"
          />
        ) : (
          <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <Clock className="h-4 w-4 mr-2 text-orange-600" />
            {card.title || "Regulatory Timeline"}
          </h5>
        )}
        <div className="space-y-3">
          {card.data && card.data.length > 0 ? (
            card.data.map((item: UntypedBackendApiResponse, index: number) => (
              <div key={index} className="flex items-start space-x-3">
                {!isEditing && (
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${
                      item.status === "critical" ? "bg-red-500" : "bg-blue-500"
                    }`}
                  />
                )}
                <div className="flex-1 space-y-2">
                  {isEditing ? (
                    <>
                      <Input
                        value={item.event || item.label || ""}
                        onChange={(e) => {
                          updateCardDataItem(index, {
                            event: e.target.value,
                            label: e.target.value,
                          });
                        }}
                        className="text-sm"
                        placeholder="Event"
                      />
                      <Input
                        value={item.date || item.time || ""}
                        onChange={(e) => {
                          updateCardDataItem(index, { date: e.target.value, time: e.target.value });
                        }}
                        className="text-xs"
                        placeholder="Date"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = [...localVisualDataCards];
                          updated[cardIndex].data = updated[cardIndex].data.filter(
                            (_: UntypedBackendApiResponse, i: number) => i !== index,
                          );
                          onVisualDataCardsChange(updated);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-900">
                        {item.event || item.label}
                      </p>
                      <p className="text-xs text-gray-500">{item.date || item.time}</p>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No timeline data available</p>
          )}
          {isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const updated = [...localVisualDataCards];
                updated[cardIndex].data = [
                  ...(updated[cardIndex].data || []),
                  { event: "", date: "", status: "upcoming" },
                ];
                onVisualDataCardsChange(updated);
              }}
            >
              Add Timeline Item
            </Button>
          )}
        </div>
      </div>
    );
  } else if (chartType === "percentage") {
    return (
      <div key={cardIndex} className="bg-white border border-gray-200 rounded-lg p-4">
        {isEditing ? (
          <Input
            value={card.title || "GTM Model Effectiveness"}
            onChange={(e) => updateCardTitle(e.target.value)}
            className="font-medium text-gray-900 mb-3"
          />
        ) : (
          <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
            {card.title || "GTM Model Effectiveness"}
          </h5>
        )}
        <div className="space-y-3">
          {card.data && card.data.length > 0 ? (
            card.data.map((item: UntypedBackendApiResponse, index: number) => (
              <div key={index} className="flex items-center justify-between gap-2">
                {isEditing ? (
                  <>
                    <Input
                      value={item.metric || item.label || ""}
                      onChange={(e) => {
                        updateCardDataItem(index, {
                          metric: e.target.value,
                          label: e.target.value,
                        });
                      }}
                      className="flex-1 text-sm"
                      placeholder="Metric"
                    />
                    <Input
                      type="number"
                      value={item.value || ""}
                      onChange={(e) => {
                        updateCardDataItem(index, { value: Number(e.target.value) || 0 });
                      }}
                      className="w-20 text-sm"
                      placeholder="Value"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const updated = [...localVisualDataCards];
                        updated[cardIndex].data = updated[cardIndex].data.filter(
                          (_: UntypedBackendApiResponse, i: number) => i !== index,
                        );
                        onVisualDataCardsChange(updated);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-600">{item.metric || item.label}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                      <TrendingUp
                        className={`h-3 w-3 ${
                          item.trend === "up" ? "text-green-600" : "text-red-600"
                        } ${item.trend === "down" ? "rotate-180" : ""}`}
                      />
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No percentage data available</p>
          )}
          {isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const updated = [...localVisualDataCards];
                updated[cardIndex].data = [
                  ...(updated[cardIndex].data || []),
                  { metric: "", value: 0, trend: "up" },
                ];
                onVisualDataCardsChange(updated);
              }}
            >
              Add Metric
            </Button>
          )}
        </div>
      </div>
    );
  }
  return null;
}
