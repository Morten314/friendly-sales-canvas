import { Bot, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface EditToolbarProps {
  onSave: () => void;
  onCancel: () => void;
  onHistory: () => void;
  historyCount: number;
  onScout: () => void;
}

export function EditToolbar({
  onSave,
  onCancel,
  onHistory,
  historyCount,
  onScout,
}: EditToolbarProps) {
  return (
    <div className="flex items-center gap-3 pt-6 border-t">
      <Button onClick={onSave}>Save Changes</Button>
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <div className="flex-1"></div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onHistory}
            className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${historyCount === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={historyCount === 0}
          >
            <Clock className="h-4 w-4" />
            Edit History
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>View changes made to this report</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onScout}
            className="text-purple-600 hover:text-purple-700 transition-all duration-200 relative"
          >
            <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
            <Bot className="h-4 w-4 relative z-10" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Chat with Scout</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
