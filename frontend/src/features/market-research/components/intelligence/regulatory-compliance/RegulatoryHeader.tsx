import { Bot, Edit, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface RegulatoryHeaderProps {
  hasEdits: boolean;
  onToggleEdit: () => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape" | "regulatory-compliance",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
}

export function RegulatoryHeader({
  hasEdits,
  onToggleEdit,
  onScoutIconClick,
}: RegulatoryHeaderProps) {
  return (
    <CardHeader className="pb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <FileText className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Regulatory & Compliance Highlights
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Current regulatory landscape and compliance requirements
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Edit Button - Always visible */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleEdit}
                className="h-8 w-8 text-blue-800 hover:text-blue-900 pointer-events-auto"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit</p>
            </TooltipContent>
          </Tooltip>

          {/* Scout Chat Icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative text-blue-600 hover:text-blue-700 transition-all duration-200"
                onClick={() => {
                  onScoutIconClick("regulatory-compliance", hasEdits);
                }}
              >
                <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                <Bot className="h-4 w-4 relative z-10" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chat with Scout</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </CardHeader>
  );
}
