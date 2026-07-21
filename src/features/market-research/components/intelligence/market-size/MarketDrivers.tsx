import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MarketDriversProps {
  editing: boolean;
  deleted: boolean;
  drivers: string[];
  draft: string[];
  onChange: (next: string[]) => void;
  onCommit: () => void;
  onDelete: () => void;
}

export function MarketDrivers({
  editing,
  deleted,
  drivers,
  draft,
  onChange,
  onCommit,
  onDelete,
}: MarketDriversProps) {
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
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
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
          <Label className="text-sm font-medium text-gray-700 mb-2 block">Key Market Drivers</Label>
          {draft.map((driver, index) => (
            <Textarea
              key={index}
              value={driver}
              onChange={(e) => {
                const newDrivers = [...draft];
                newDrivers[index] = e.target.value;
                onChange(newDrivers);
              }}
              className="w-full h-16 resize-none mb-3"
              placeholder={`Market driver ${index + 1}...`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h4 className="font-medium text-gray-900 mb-3">Key Market Drivers</h4>
      <ul className="space-y-2 text-gray-700">
        {(Array.isArray(drivers) && drivers.length > 0 ? drivers : []).map((driver, index) => (
          <li key={index} className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
            {driver}
          </li>
        ))}
        {(!drivers || drivers.length === 0) && (
          <li className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
            No market drivers available
          </li>
        )}
      </ul>
    </div>
  );
}
