import { Users, MessageSquare, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

import { ProfilerChatWithHistory } from "../components/chat/ProfilerChatWithHistory";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ICPIntelligence } from "../components/icp-intelligence/ICPIntelligence";
import { LeadStreamPanel } from "../components/lead-stream/LeadStream";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layout } from "@/features/shell";
import { useAuth } from "@/shared/auth/AuthContext";
import { readSessionChatContext, type ChatContext } from "@/shared/chat";
import { usePageTitle } from "@/shared/hooks/usePageTitle";

const CustomersPage = () => {
  usePageTitle("👤 Profiler - Brewra");
  const { orgId } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("icp-intelligence");
  const [signalsChatContext, setSignalsChatContext] = useState<ChatContext | null>(null);
  const [filteredICP, setFilteredICP] = useState<string | null>(null);

  // When navigating from Signals with tab=chat-profiler, open that tab
  useEffect(() => {
    const state = location.state as { tab?: string } | null;
    if (state?.tab === "chat-profiler") {
      setActiveTab("chat-profiler");
    } else if (state?.tab === "lead-stream") {
      // Deep-link from the Mission Control Apollo tile after discovery completes.
      setActiveTab("lead-stream");
    }
  }, [location.state]);

  // When Chat with Profiler tab is active, check for context from Signals page
  useEffect(() => {
    if (activeTab !== "chat-profiler") return;
    const parsed = readSessionChatContext();
    if (parsed?.agent === "profiler") {
      setSignalsChatContext(parsed);
    } else {
      setSignalsChatContext(null);
    }
  }, [activeTab]);

  // Listen for custom events from header buttons
  useEffect(() => {
    const handleProfilerExportData = () => console.log("Export data triggered from header");
    const handleProfilerCreateICP = () => console.log("Create new ICP triggered from header");
    const handleNavigateToLeadStream = (e: Event) => {
      const customEvent = e as CustomEvent;
      const filterICP = customEvent.detail?.filterICP || null;
      setFilteredICP(filterICP);
      setActiveTab("lead-stream");
    };
    window.addEventListener("profilerExportData", handleProfilerExportData);
    window.addEventListener("profilerCreateICP", handleProfilerCreateICP);
    window.addEventListener("navigateToLeadStream", handleNavigateToLeadStream);
    return () => {
      window.removeEventListener("profilerExportData", handleProfilerExportData);
      window.removeEventListener("profilerCreateICP", handleProfilerCreateICP);
      window.removeEventListener("navigateToLeadStream", handleNavigateToLeadStream);
    };
  }, []);

  return (
    <Layout>
      <div className="animate-fade-in h-full w-full flex flex-col">
        {/* Main Tabs */}
        <div className="flex-1 min-h-0 flex flex-col w-full">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 min-h-0 flex flex-col"
          >
            <TabsList className="mb-4 md:mb-6 w-full grid grid-cols-3 h-auto">
              <TabsTrigger
                value="icp-intelligence"
                className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 py-2"
              >
                <Users className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">ICP Intelligence</span>
                <span className="sm:hidden">ICP</span>
              </TabsTrigger>
              <TabsTrigger
                value="lead-stream"
                className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 py-2"
              >
                <Zap className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Lead Stream</span>
                <span className="sm:hidden">Leads</span>
              </TabsTrigger>
              <TabsTrigger
                value="chat-profiler"
                className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 py-2"
              >
                <MessageSquare className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Chat with Profiler</span>
                <span className="sm:hidden">Chat</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lead-stream" className="h-full w-full m-0">
              <ErrorBoundary fallbackMessage="There was an error loading the Lead Stream">
                <LeadStreamPanel
                  orgId={orgId}
                  filterByICP={filteredICP}
                  onClearFilter={() => setFilteredICP(null)}
                />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="icp-intelligence" className="h-full w-full m-0">
              <ErrorBoundary fallbackMessage="There was an error loading the ICP Intelligence section">
                <ICPIntelligence />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent
              value="chat-profiler"
              className="h-full w-full m-0 min-h-0 flex-1 flex flex-col overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
            >
              <div className="flex-1 min-h-0 overflow-hidden">
                <ProfilerChatWithHistory
                  initialContext={signalsChatContext}
                  onClearContext={() => {
                    sessionStorage.removeItem("signalsChatContext");
                    setSignalsChatContext(null);
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default CustomersPage;
