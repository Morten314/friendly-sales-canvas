import { X } from "lucide-react";

import { projectionsToLineData } from "./marketSize";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MiniLineChart from "@/components/ui/MiniLineChart";

interface GrowthProjectionsProps {
  editing: boolean;
  projections: Record<string, string>;
  draft: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

export function GrowthProjections({
  editing,
  projections,
  draft,
  onChange,
}: GrowthProjectionsProps) {
  if (editing) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <Label className="text-sm font-medium text-gray-900 mb-3 block">Growth Projections</Label>
        <div className="space-y-3">
          {Object.entries(draft).map(([year, value], index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={year}
                onChange={(e) => {
                  const updated = { ...draft };
                  const oldKey = year;
                  const newKey = e.target.value;
                  if (newKey !== oldKey) {
                    delete updated[oldKey];
                    updated[newKey] = value;
                  }
                  onChange(updated);
                }}
                className="flex-1 text-sm"
                placeholder="Year"
              />
              <Input
                type="text"
                value={value}
                onChange={(e) => {
                  const updated = { ...draft };
                  updated[year] = e.target.value;
                  onChange(updated);
                }}
                className="w-24 text-sm"
                placeholder="Value"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const updated = { ...draft };
                  delete updated[year];
                  onChange(updated);
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
              onChange({
                ...draft,
                ["2024"]: "",
              });
            }}
            className="mt-2"
          >
            Add Year
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-3">Growth Projections</h4>
      <MiniLineChart data={projectionsToLineData(projections)} title="" color="#3B82F6" />
    </div>
  );
}
