import { Check, X } from "lucide-react";
import React from "react";

import type { RegionShare } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface MarketShareRegionsTableProps {
  isEditing: boolean;
  localRegions: RegionShare[];
  setLocalRegions: (regions: RegionShare[]) => void;
  handleSaveMarketShareCharts: () => void;
}

export const MarketShareRegionsTable: React.FC<MarketShareRegionsTableProps> = ({
  isEditing,
  localRegions,
  setLocalRegions,
  handleSaveMarketShareCharts,
}) => {
  const regions = localRegions;

  if (!regions || regions.length === 0) return null;

  return (
    <div className="mb-8 relative group">
      {isEditing && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveMarketShareCharts}
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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Share Analysis</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {regions.map((region, regionIndex) => (
          <div key={regionIndex} className="bg-white border border-gray-200 rounded-lg p-4">
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={region.name}
                  onChange={(e) => {
                    const updated = [...localRegions];
                    updated[regionIndex] = {
                      ...updated[regionIndex],
                      name: e.target.value,
                    };
                    setLocalRegions(updated);
                  }}
                  className="font-medium text-gray-900 bg-white"
                  placeholder="Region name"
                />
                <div className="space-y-2">
                  {Object.entries(region.data).map(([company, share], _companyIndex) => (
                    <div key={company} className="flex gap-2 items-center">
                      <Input
                        value={company}
                        onChange={(e) => {
                          const updated = [...localRegions];
                          const newData = { ...updated[regionIndex].data };
                          delete newData[company];
                          newData[e.target.value] = share;
                          updated[regionIndex] = {
                            ...updated[regionIndex],
                            data: newData,
                          };
                          setLocalRegions(updated);
                        }}
                        className="flex-1 text-sm text-gray-700 bg-white"
                        placeholder="Company"
                      />
                      <Input
                        value={String(share)}
                        onChange={(e) => {
                          const updated = [...localRegions];
                          const newData = { ...updated[regionIndex].data };
                          newData[company] = e.target.value;
                          updated[regionIndex] = {
                            ...updated[regionIndex],
                            data: newData,
                          };
                          setLocalRegions(updated);
                        }}
                        className="w-24 text-sm font-medium text-blue-600 bg-white"
                        placeholder="Share"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = [...localRegions];
                          const newData = { ...updated[regionIndex].data };
                          delete newData[company];
                          updated[regionIndex] = {
                            ...updated[regionIndex],
                            data: newData,
                          };
                          setLocalRegions(updated);
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
                    onClick={() => {
                      const updated = [...localRegions];
                      const newData = { ...updated[regionIndex].data };
                      newData[""] = "";
                      updated[regionIndex] = { ...updated[regionIndex], data: newData };
                      setLocalRegions(updated);
                    }}
                  >
                    Add Company
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLocalRegions(localRegions.filter((_, i) => i !== regionIndex));
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove Region
                </Button>
              </div>
            ) : (
              <>
                <h4 className="font-medium text-gray-900 mb-3">{region.name}</h4>
                <div className="space-y-2">
                  {Object.entries(region.data).map(([company, share]) => (
                    <div key={company} className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">{company}</span>
                      <span className="text-sm font-medium text-blue-600">{String(share)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocalRegions([...localRegions, { name: "", data: {} }])}
          className="mt-2"
        >
          Add Region
        </Button>
      )}
    </div>
  );
};
