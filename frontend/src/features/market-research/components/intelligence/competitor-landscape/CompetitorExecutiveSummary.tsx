import { Check, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CompetitorExecutiveSummaryProps {
  isEditing: boolean;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  displayValue: string;
}

export function CompetitorExecutiveSummary({
  isEditing,
  value,
  onChange,
  onCommit,
  displayValue,
}: CompetitorExecutiveSummaryProps) {
  return (
    <div className="mb-6 relative group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Executive Summary
        </h3>
        {isEditing && (
          <div className="flex items-center gap-1">
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
          </div>
        )}
      </div>
      {isEditing ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
          rows={4}
          placeholder="Enter executive summary..."
        />
      ) : (
        <p className="text-gray-700 leading-relaxed">{displayValue}</p>
      )}
    </div>
  );
}
