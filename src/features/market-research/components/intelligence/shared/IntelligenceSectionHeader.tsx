import { Bot, Edit, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ScoutContext = "market-size" | "industry-trends" | "competitor-landscape";

export interface IntelligenceSectionHeaderProps {
  onModify: () => void;
  isSplitView: boolean;
  onScoutIconClick: (context?: ScoutContext) => void;
  /** Leading title icon (e.g. Zap, BarChart3). */
  icon: LucideIcon;
  /** Section title text. */
  title: string;
  /** Scout context string passed to onScoutIconClick. */
  scoutContext: ScoutContext;
  /** Full Tailwind class string for the title icon. */
  iconClassName: string;
  /** Full Tailwind class string for the Edit button. */
  editButtonClassName: string;
  /** Full Tailwind class string for the Scout button. */
  scoutButtonClassName: string;
  /** Full Tailwind class string for the Scout button's gradient overlay. */
  scoutGradientClassName: string;
}

export function IntelligenceSectionHeader({
  onModify,
  isSplitView,
  onScoutIconClick,
  icon: Icon,
  title,
  scoutContext,
  iconClassName,
  editButtonClassName,
  scoutButtonClassName,
  scoutGradientClassName,
}: IntelligenceSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        <Icon className={iconClassName} />
        {title}
      </h2>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onModify} className={editButtonClassName}>
          <Edit className="h-4 w-4" />
        </Button>
        {!isSplitView && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onScoutIconClick(scoutContext);
                }}
                className={scoutButtonClassName}
              >
                <div className={scoutGradientClassName}></div>
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
