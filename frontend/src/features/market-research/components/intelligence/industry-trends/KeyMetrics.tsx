import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface KeyMetricsProps {
  editing: boolean;
  deleted: boolean;
  aiAdoption: string;
  cloudMigration: string;
  regulatory: string;
  aiAdoptionDraft: string;
  cloudMigrationDraft: string;
  regulatoryDraft: string;
  onAiAdoptionChange: (v: string) => void;
  onCloudMigrationChange: (v: string) => void;
  onRegulatoryChange: (v: string) => void;
  onCommit: () => void;
  onDelete: () => void;
}

export function KeyMetrics({
  editing,
  deleted,
  aiAdoption,
  cloudMigration,
  regulatory,
  aiAdoptionDraft,
  cloudMigrationDraft,
  regulatoryDraft,
  onAiAdoptionChange,
  onCloudMigrationChange,
  onRegulatoryChange,
  onCommit,
  onDelete,
}: KeyMetricsProps) {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label
                htmlFor="aiAdoption"
                className="text-sm font-medium text-gray-700 mb-2 block"
              >
                AI Adoption Rate
              </Label>
              <Input
                id="aiAdoption"
                value={aiAdoptionDraft}
                onChange={(e) => onAiAdoptionChange(e.target.value)}
                className="text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400"
                placeholder="e.g., 78%"
              />
            </div>
            <div>
              <Label
                htmlFor="cloudMigration"
                className="text-sm font-medium text-gray-700 mb-2 block"
              >
                Cloud Migration Increase
              </Label>
              <Input
                id="cloudMigration"
                value={cloudMigrationDraft}
                onChange={(e) => onCloudMigrationChange(e.target.value)}
                className="text-2xl font-bold text-green-600 border-green-200 focus:border-green-400"
                placeholder="e.g., +45%"
              />
            </div>
            <div>
              <Label
                htmlFor="regulatory"
                className="text-sm font-medium text-gray-700 mb-2 block"
              >
                Regulatory Changes
              </Label>
              <Input
                id="regulatory"
                value={regulatoryDraft}
                onChange={(e) => onRegulatoryChange(e.target.value)}
                className="text-2xl font-bold text-purple-600 border-purple-200 focus:border-purple-400"
                placeholder="e.g., 12 new"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="text-2xl font-bold text-blue-600">{aiAdoption}</div>
        <div className="text-sm font-medium text-gray-900">AI Adoption Rate</div>
        <div className="text-xs text-gray-600">Enterprise pilots</div>
      </div>
      <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
        <div className="text-2xl font-bold text-green-600">{cloudMigration}</div>
        <div className="text-sm font-medium text-gray-900">Cloud Migration Increase</div>
        <div className="text-xs text-gray-600">Year over year</div>
      </div>
      <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
        <div className="text-2xl font-bold text-purple-600">{regulatory}</div>
        <div className="text-sm font-medium text-gray-900">Regulatory Changes</div>
        <div className="text-xs text-gray-600">Impacting sector</div>
      </div>
    </div>
  );
}
