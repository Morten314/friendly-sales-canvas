import React, { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { PanelRightClose } from "lucide-react";
import LeadStream from "./LeadStream";
import ScoutChatPanel from "./ScoutChatPanel";
import { LeadStreamFilterBar, LeadStreamFilters } from "./LeadStreamFilterBar";
import { LeadStreamScoutContext } from "./LeadStream";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LeadStreamScoutSplitViewProps {
  filters: LeadStreamFilters;
  onFiltersChange: (filters: LeadStreamFilters) => void;
  editHistory?: any[];
  onTabChange?: (tab: string) => void;
  onExitSplitView?: () => void;
}

export function LeadStreamScoutSplitView({
  filters,
  onFiltersChange,
  editHistory = [],
  onTabChange,
  onExitSplitView,
}: LeadStreamScoutSplitViewProps) {
  const [selectedLeadContext, setSelectedLeadContext] = useState<LeadStreamScoutContext | null>(null);

  const handleAskScout = (ctx: LeadStreamScoutContext) => {
    setSelectedLeadContext(ctx);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Shared filter bar + exit split view */}
      <div className="shrink-0 mb-3 flex items-center gap-2">
        <div className="flex-1">
          <LeadStreamFilterBar filters={filters} onFiltersChange={onFiltersChange} />
        </div>
        {onExitSplitView && (
          <Button variant="outline" size="sm" onClick={onExitSplitView} className="gap-1 shrink-0">
            <PanelRightClose className="h-4 w-4" />
            Exit split view
          </Button>
        )}
      </div>

      {/* Split view toggle hint - user can use Research/Deep dive to populate right panel */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={50} minSize={30}>
          <ScrollArea className="h-full pr-4">
            <LeadStream
              selectedIndustry={filters.selectedIndustry}
              selectedSize={filters.selectedSize}
              selectedRegion={filters.selectedRegion}
              onFiltersChange={onFiltersChange}
              onAskScout={handleAskScout}
            />
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col pl-4 border-l">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Chat with Scout</span>
              {onTabChange && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onTabChange("trends")}
                >
                  Open full chat
                </Button>
              )}
            </div>
            <div className="flex-1 min-h-[300px]">
              <ScoutChatPanel
                showScoutChat={true}
                isSplitView={true}
                hasEdits={false}
                showEditHistory={false}
                editHistory={editHistory}
                lastEditedField=""
                customMessage={selectedLeadContext?.customMessage}
                onClose={() => setSelectedLeadContext(null)}
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
