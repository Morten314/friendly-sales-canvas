import { MapPin, Bot, Edit, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MarketEntryHeaderProps {
  /** When false, no action button group is rendered (loading state). */
  showActions?: boolean;
  /** Render the Edit (modify) button — only in the populated view. */
  showEditButton?: boolean;
  /** Render the Edit-history (Clock) button — gated by hasEdits in the populated view. */
  showEditHistory?: boolean;
  /** Hides the Scout button when in split view (Scout is shown only when not split). */
  isSplitView: boolean;
  onToggleEdit: () => void;
  onEditHistoryOpen: () => void;
  onScoutIconClick: (context?: "market-entry", hasEdits?: boolean, customMessage?: string) => void;
}

/**
 * Section header for the Market Entry section: the title plus its action
 * buttons (Edit, Edit-history/Clock, Scout). The same header markup is reused
 * across the loading, empty, and populated views; button presence is driven by
 * the boolean flags so each view renders exactly what it did inline.
 */
export default function MarketEntryHeader({
  showActions = false,
  showEditButton = false,
  showEditHistory = false,
  isSplitView,
  onToggleEdit,
  onEditHistoryOpen,
  onScoutIconClick,
}: MarketEntryHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-purple-600" />
        Market Entry & Growth Strategy
      </h2>
      {showActions && (
        <div className="flex items-center gap-3">
          {showEditButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleEdit}
              className="text-purple-800 hover:text-purple-900"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {showEditHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditHistoryOpen}
              className="text-gray-600 hover:text-gray-700"
            >
              <Clock className="h-4 w-4" />
            </Button>
          )}
          {!isSplitView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onScoutIconClick("market-entry");
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
      )}
    </div>
  );
}
