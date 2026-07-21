import { BarChart3, Bot, Clock, Edit } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CompetitorLandscapeHeaderProps {
  isEditing: boolean;
  hasEdits: boolean;
  onToggleEdit: () => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
}

export function CompetitorLandscapeHeader({
  isEditing,
  hasEdits,
  onToggleEdit,
  onScoutIconClick,
}: CompetitorLandscapeHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <BarChart3 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Competitor Landscape</h2>
          <p className="text-sm text-gray-600">Comprehensive analysis of competitive environment</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {hasEdits && !isEditing && (
          <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
            <Clock className="h-3 w-3 mr-1" />
            Unsaved
          </Badge>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleEdit}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          <Edit className="h-4 w-4" />
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onScoutIconClick("competitor-landscape", hasEdits);
              }}
              className="text-orange-600 hover:text-orange-700 transition-all duration-200 relative"
            >
              <div className="absolute inset-0 rounded-md bg-gradient-to-r from-orange-400/20 to-red-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
              <Bot className="h-4 w-4 relative z-10" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Chat with Scout</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
