import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RegionalHotspotsProps {
  editing: boolean;
  deleted: boolean;
  regionalHotspots: Record<string, string>;
  draft: { APAC: string; Europe: string; "North America": string };
  onChange: (next: { APAC: string; Europe: string; "North America": string }) => void;
  onCommit: () => void;
  onDelete: () => void;
}

export function RegionalHotspots({
  editing,
  deleted,
  regionalHotspots,
  draft,
  onChange,
  onCommit,
  onDelete,
}: RegionalHotspotsProps) {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Hotspots</h3>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <Label
                  htmlFor="regionalHotspotAPAC"
                  className="text-sm font-medium text-gray-700 mb-2 block"
                >
                  APAC
                </Label>
                <Input
                  id="regionalHotspotAPAC"
                  value={draft.APAC}
                  onChange={(e) => onChange({ ...draft, APAC: e.target.value })}
                  className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400 text-center"
                  placeholder="e.g., 60%"
                />
              </div>
              <div className="text-center">
                <Label
                  htmlFor="regionalHotspotEurope"
                  className="text-sm font-medium text-gray-700 mb-2 block"
                >
                  Europe
                </Label>
                <Input
                  id="regionalHotspotEurope"
                  value={draft.Europe}
                  onChange={(e) => onChange({ ...draft, Europe: e.target.value })}
                  className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400 text-center"
                  placeholder="e.g., 45%"
                />
              </div>
              <div className="text-center">
                <Label
                  htmlFor="regionalHotspotNorthAmerica"
                  className="text-sm font-medium text-gray-700 mb-2 block"
                >
                  North America
                </Label>
                <Input
                  id="regionalHotspotNorthAmerica"
                  value={draft["North America"]}
                  onChange={(e) => onChange({ ...draft, "North America": e.target.value })}
                  className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400 text-center"
                  placeholder="e.g., 55%"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Hotspots</h3>
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        {regionalHotspots && Object.keys(regionalHotspots).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(regionalHotspots).map(([region, value]) => (
              <div key={region} className="text-center">
                <div className="text-2xl font-bold text-blue-600">{value}</div>
                <div className="text-sm text-gray-700">{region}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No regional hotspots data available</p>
        )}
      </div>
    </div>
  );
}
