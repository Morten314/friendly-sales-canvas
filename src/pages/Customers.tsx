import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Target, MessageSquare, Send, Search, Zap } from "lucide-react";
import { LeadStreamPanel } from "@/components/customers/LeadStream";
import { ICPIntelligence } from "@/components/customers/ICPIntelligence";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

const Customers = () => {
  usePageTitle("👤 Profiler - Brewra");
  const [activeTab, setActiveTab] = useState("icp-intelligence");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", content: "I'm Profiler, your ICP research assistant. I can help you define ideal customer profiles, find prospects, and enrich your data. What would you like to work on today?" }
  ]);
  const [inputValue, setInputValue] = useState("");

  // Listen for custom events from header buttons
  useEffect(() => {
    const handleProfilerExportData = () => console.log('Export data triggered from header');
    const handleProfilerCreateICP = () => console.log('Create new ICP triggered from header');
    const handleNavigateToLeadStream = () => setActiveTab('lead-stream');
    window.addEventListener('profilerExportData', handleProfilerExportData);
    window.addEventListener('profilerCreateICP', handleProfilerCreateICP);
    window.addEventListener('navigateToLeadStream', handleNavigateToLeadStream);
    return () => {
      window.removeEventListener('profilerExportData', handleProfilerExportData);
      window.removeEventListener('profilerCreateICP', handleProfilerCreateICP);
      window.removeEventListener('navigateToLeadStream', handleNavigateToLeadStream);
    };
  }, []);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    setMessages([...messages, { role: "user", content: inputValue }]);
    setTimeout(() => {
      setMessages(current => [...current, {
        role: "ai",
        content: "I can help you with ICP analysis, prospect research, or data enrichment. Which area would you like to focus on?"
      }]);
    }, 1000);
    setInputValue("");
  };

  return (
    <Layout>
      <div className="animate-fade-in h-full w-full">
        {/* Chat Window */}
        {isChatOpen && (
          <Card className="border-primary/20 bg-primary/5 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Chat with Profiler
              </CardTitle>
              <CardDescription>
                Ask Profiler to help with ICP research, prospect finding, or data enrichment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-background rounded-md border border-border p-4 flex flex-col gap-3">
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`${
                        message.role === "ai"
                          ? "bg-muted rounded-lg p-3 self-start max-w-[80%]"
                          : "bg-secondary rounded-lg p-3 self-end max-w-[80%] ml-auto"
                      }`}
                    >
                      <p className="text-sm font-medium">{message.role === "ai" ? "Profiler" : "You"}</p>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Ask Profiler a question..."
                    className="flex-1"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                  />
                  <Button className="flex items-center gap-2" onClick={handleSendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <div className="h-full w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full w-full">
            <TabsList className="mb-4 md:mb-6 w-full grid grid-cols-3 h-auto">
              <TabsTrigger value="icp-intelligence" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 py-2">
                <Users className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">ICP Intelligence</span>
                <span className="sm:hidden">ICP</span>
              </TabsTrigger>
              <TabsTrigger value="lead-stream" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 py-2">
                <Zap className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Lead Stream</span>
                <span className="sm:hidden">Leads</span>
              </TabsTrigger>
              <TabsTrigger value="chat-profiler" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 py-2">
                <MessageSquare className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Chat with Profiler</span>
                <span className="sm:hidden">Chat</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lead-stream" className="h-full w-full m-0">
              <ErrorBoundary fallbackMessage="There was an error loading the Lead Stream">
                <LeadStreamPanel />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="icp-intelligence" className="h-full w-full m-0">
              <ErrorBoundary fallbackMessage="There was an error loading the ICP Intelligence section">
                <ICPIntelligence />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="chat-profiler" className="h-full w-full m-0">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Chat with Profiler
                  </CardTitle>
                  <CardDescription>
                    Have a conversation with Profiler about your ICP strategy and prospect research
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-6 text-center">
                    <MessageSquare className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                    <p className="text-muted-foreground mb-4">Click "Chat with Profiler" above to begin your conversation</p>
                    <Button onClick={() => setIsChatOpen(true)}>
                      Open Chat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Customers;
