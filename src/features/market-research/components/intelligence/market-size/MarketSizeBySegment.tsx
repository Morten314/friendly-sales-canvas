import { X } from "lucide-react";

import { segmentsToPieData } from "./marketSize";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MiniPieChart from "@/components/ui/MiniPieChart";

interface MarketSizeBySegmentProps {
  editing: boolean;
  segments: Record<string, string>;
  draft: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

export function MarketSizeBySegment({
  editing,
  segments,
  draft,
  onChange,
}: MarketSizeBySegmentProps) {
  if (editing) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <Label className="text-sm font-medium text-gray-900 mb-3 block">
          Market Size by Segment
        </Label>
        <div className="space-y-3">
          {Object.entries(draft).map(([segment, value], index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={segment}
                onChange={(e) => {
                  const updated = { ...draft };
                  const oldKey = segment;
                  const newKey = e.target.value;
                  if (newKey !== oldKey) {
                    delete updated[oldKey];
                    updated[newKey] = value;
                  }
                  onChange(updated);
                }}
                className="flex-1 text-sm"
                placeholder="Segment name"
              />
              <Input
                type="text"
                value={value}
                onChange={(e) => {
                  const updated = { ...draft };
                  updated[segment] = e.target.value;
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
                  delete updated[segment];
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
                ["New Segment"]: "",
              });
            }}
            className="mt-2"
          >
            Add Segment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-3">Market Size by Segment</h4>
      <MiniPieChart data={segmentsToPieData(segments)} title="" />
    </div>
  );
}
