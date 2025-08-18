
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Users, Filter, UserPlus, Download, MessageSquare, Send, Search, Database, Target } from "lucide-react";
import { ICPIntelligence } from "@/components/customers/ICPIntelligence";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

const Customers = () => {
  usePageTitle("👤 Profiler - Brewra");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", content: "I'm Profiler, your ICP research assistant. I can help you define ideal customer profiles, find prospects, and enrich your data. What would you like to work on today?" }
  ]);
  const [inputValue, setInputValue] = useState("");

  console.log("=== CUSTOMERS PAGE RENDERING ===");
  console.log("isChatOpen:", isChatOpen);
  console.log("messages:", messages.length);

  useEffect(() => {
    console.log("=== CUSTOMERS PAGE MOUNTED ===");
    
    return () => {
      console.log("=== CUSTOMERS PAGE UNMOUNTING ===");
    };
  }, []);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    setMessages([...messages, { role: "user", content: inputValue }]);
    
    // Simulate AI response
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
        {/* Header with action buttons */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Profiler</h1>
            <p className="text-gray-600">Define ideal customers, find prospects, and enrich your data</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              <MessageSquare className="h-4 w-4" />
              Chat with Profiler
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Data
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Create New ICP
            </Button>
          </div>
        </div>

        {/* Chat Window */}
        {isChatOpen && (
          <Card className="border-purple-200 bg-purple-50/40 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                Chat with Profiler
              </CardTitle>
              <CardDescription>
                Ask Profiler to help with ICP research, prospect finding, or data enrichment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white rounded-md border border-gray-200 p-4 flex flex-col gap-3">
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {messages.map((message, index) => (
                    <div 
                      key={index}
                      className={`${
                        message.role === "ai" 
                          ? "bg-purple-50 rounded-lg p-3 self-start max-w-[80%]" 
                          : "bg-gray-100 rounded-lg p-3 self-end max-w-[80%] ml-auto"
                      }`}
                    >
                      <p className="text-sm font-medium">
                        {message.role === "ai" ? "Profiler" : "You"}
                      </p>
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                  />
                  <Button 
                    className="bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
                    onClick={handleSendMessage}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs - Full Width */}
        <div className="h-full w-full">
          <Tabs defaultValue="icp-intelligence" className="h-full w-full">
            <TabsList className="mb-6 w-full">
              <TabsTrigger value="icp-intelligence" className="flex items-center gap-2 flex-1">
                <Users className="h-4 w-4" />
                ICP Intelligence
              </TabsTrigger>
              <TabsTrigger value="icp-battlemap" className="flex items-center gap-2 flex-1">
                <Target className="h-4 w-4" />
                ICP Battlemap
              </TabsTrigger>
              <TabsTrigger value="chat-profiler" className="flex items-center gap-2 flex-1">
                <MessageSquare className="h-4 w-4" />
                Chat with Profiler
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="icp-intelligence" className="h-full w-full m-0">
              <ErrorBoundary fallbackMessage="There was an error loading the ICP Intelligence section">
                <ICPIntelligence />
              </ErrorBoundary>
            </TabsContent>
            
            <TabsContent value="icp-battlemap" className="h-full w-full m-0">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    ICP Battlemap
                  </CardTitle>
                  <CardDescription>
                    Analyze competitive landscape and identify buying signals for your ideal customer profiles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-4">
                      <h3 className="font-semibold mb-2">Competitive Analysis</h3>
                      <p className="text-sm text-gray-600 mb-4">Map competitive overlaps and positioning strategies</p>
                      <Button className="w-full">
                        <Target className="h-4 w-4 mr-2" />
                        Analyze Competition
                      </Button>
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-semibold mb-2">Buying Signals</h3>
                      <p className="text-sm text-gray-600 mb-4">Identify key indicators of purchase intent</p>
                      <Button className="w-full" variant="outline">
                        <Search className="h-4 w-4 mr-2" />
                        Find Signals
                      </Button>
                    </Card>
                  </div>
                </CardContent>
              </Card>
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
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <MessageSquare className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                    <p className="text-gray-600 mb-4">Click "Chat with Profiler" above to begin your conversation</p>
                    <Button 
                      onClick={() => setIsChatOpen(true)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
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
