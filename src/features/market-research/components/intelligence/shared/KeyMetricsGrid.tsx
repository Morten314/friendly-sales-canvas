import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface KeyMetricConfig {
  /** Stable id used for the input element and its label's htmlFor. */
  id: string;
  /** Visible field label, rendered in both edit and display modes. */
  label: string;
  /** Committed value shown in display mode. */
  value: string;
  /** Draft value bound to the edit-mode input. */
  draft: string;
  /** Edit-mode change handler. */
  onChange: (v: string) => void;
  /** Input placeholder shown in edit mode. */
  placeholder: string;
  /** Caption rendered beneath the value in display mode. */
  displayCaption: string;
  /**
   * Full Tailwind class string for the display-mode card wrapper.
   * Passed verbatim so Tailwind can statically detect every utility.
   */
  cardClassName: string;
  /** Full Tailwind class string for the display-mode value text. */
  valueClassName: string;
  /**
   * Optional className applied to the edit-mode input. Some consumers
   * style the input (colored), others leave it plain.
   */
  editInputClassName?: string;
}

export interface KeyMetricsGridProps {
  editing: boolean;
  deleted: boolean;
  metrics: KeyMetricConfig[];
  onCommit: () => void;
  onDelete: () => void;
  /**
   * Optional extra classes appended to the edit-mode delete button.
   * One consumer adds `pointer-events-auto z-50`; the other adds nothing.
   */
  deleteButtonClassName?: string;
}

export function KeyMetricsGrid({
  editing,
  deleted,
  metrics,
  onCommit,
  onDelete,
  deleteButtonClassName,
}: KeyMetricsGridProps) {
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
                className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50${
                  deleteButtonClassName ? ` ${deleteButtonClassName}` : ""
                }`}
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
            {metrics.map((metric) => (
              <div key={metric.id}>
                <Label htmlFor={metric.id} className="text-sm font-medium text-gray-700 mb-2 block">
                  {metric.label}
                </Label>
                <Input
                  id={metric.id}
                  value={metric.draft}
                  onChange={(e) => metric.onChange(e.target.value)}
                  className={metric.editInputClassName}
                  placeholder={metric.placeholder}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {metrics.map((metric) => (
        <div key={metric.id} className={metric.cardClassName}>
          <div className={metric.valueClassName}>{metric.value}</div>
          <div className="text-sm font-medium text-gray-900">{metric.label}</div>
          <div className="text-xs text-gray-600">{metric.displayCaption}</div>
        </div>
      ))}
    </div>
  );
}
