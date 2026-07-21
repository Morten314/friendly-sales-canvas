import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RisksWatchoutsProps {
  editing: boolean;
  deleted: boolean;
  risks: string[];
  draft: string[];
  onChange: (next: string[]) => void;
  onCommit: () => void;
  onDelete: () => void;
}

export function RisksWatchouts({
  editing,
  deleted,
  risks,
  draft,
  onChange,
  onCommit,
  onDelete,
}: RisksWatchoutsProps) {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risks &amp; Watchouts</h3>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="space-y-2">
              {draft.map((risk, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={risk}
                    onChange={(e) => {
                      const updated = [...draft];
                      updated[index] = e.target.value;
                      onChange(updated);
                    }}
                    className="flex-1 text-red-700 text-sm border-red-200 focus:border-red-400"
                    placeholder="Enter risk..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onChange(draft.filter((_, i) => i !== index));
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
                onClick={() => onChange([...draft, ""])}
                className="mt-2"
              >
                Add Risk
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Risks &amp; Watchouts</h3>
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <ul className="space-y-2">
          {risks?.length > 0 ? (
            risks.map((risk, index) => (
              <li key={index} className="flex items-start gap-2 text-red-700 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                {risk}
              </li>
            ))
          ) : (
            <li className="text-gray-500 text-sm">No risks identified</li>
          )}
        </ul>
      </div>
    </div>
  );
}
