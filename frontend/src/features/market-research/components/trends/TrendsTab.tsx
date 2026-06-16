import { useState, useEffect } from "react";

import type { ScoutResearchContext } from "../../types";
import { ChatWithScout } from "../ChatWithScout";
import { ScoutChatWithHistory } from "../scout-chat/ScoutChatWithHistory";
import type { EditRecord } from "../types";

import { readSessionChatContext, type ChatContext } from "@/shared/chat";

// trends = Scout chat (Spec 24 §9 delta 6), NOT an emerging-trends view. Feature-owned thin
// router over the LEAVING Scout-chat components (scout / signals). The components it renders are legacy.
interface TrendsTabProps {
  scoutResearchContext: ScoutResearchContext | null;
  scoutMode: "selected-leads" | "full-list";
  editHistory: EditRecord[]; // match ScoutChatWithHistory's editHistory prop type
  onTabChange: (tab: string) => void; // = the shell's setActiveTab
}

export default function TrendsTab({
  scoutResearchContext,
  scoutMode,
  editHistory,
  onTabChange,
}: TrendsTabProps) {
  const [signalsChatContext, setSignalsChatContext] = useState<ChatContext | null>(null);

  // When Chat with Scout tab is active, check for context from Signals page.
  // TrendsTab only mounts when activeTab === "trends" (ternary true branch in the shell),
  // so the legacy `if (activeTab !== "trends") return` guard is structurally implicit here;
  // the effect runs once on mount and reads sessionStorage a single time.
  useEffect(() => {
    const parsed = readSessionChatContext();
    if (parsed?.agent === "scout") {
      setSignalsChatContext(parsed);
    } else {
      setSignalsChatContext(null);
    }
  }, []);

  return (
    <div className="flex-1 h-full min-h-[30rem] flex flex-col overflow-hidden -mx-3 md:-mx-4 lg:-mx-6 w-[calc(100%+1.5rem)] md:w-[calc(100%+2rem)] lg:w-[calc(100%+3rem)] max-w-none">
      {scoutResearchContext ? (
        <div className="px-3 md:px-4 lg:px-6 py-4 h-full flex flex-col min-h-0 flex-1">
          <ChatWithScout fullPage researchContext={scoutResearchContext} mode={scoutMode} />
        </div>
      ) : (
        <ScoutChatWithHistory
          initialContext={signalsChatContext}
          onClearContext={() => {
            sessionStorage.removeItem("signalsChatContext");
            setSignalsChatContext(null);
          }}
          editHistory={editHistory}
          onTabChange={onTabChange}
        />
      )}
    </div>
  );
}
