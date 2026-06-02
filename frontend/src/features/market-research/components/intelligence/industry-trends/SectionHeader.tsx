import { Bot, Edit, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface SectionHeaderProps {
  onModify: () => void;
  isSplitView: boolean;
  onScoutIconClick: (context?: "market-size" | "industry-trends" | "competitor-landscape") => void;
}

export function SectionHeader({ onModify, isSplitView, onScoutIconClick }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        <Zap className="h-5 w-5 text-purple-600" />
        Industry Trends
      </h2>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onModify}
          className="text-purple-800 hover:text-purple-900"
        >
          <Edit className="h-4 w-4" />
        </Button>
        {!isSplitView && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onScoutIconClick("industry-trends");
                }}
                className="text-purple-600 hover:text-purple-700 transition-all duration-200 relative"
              >
                <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                <Bot className="h-5 w-5 relative z-10" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chat with Scout</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
