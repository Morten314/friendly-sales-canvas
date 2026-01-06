
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, PlusCircle, MessageSquare, Send, Zap, Settings, Play, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Calendar = () => {
  usePageTitle("⚡ Activator - Brewra");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hello! I'm Activator. How can I help with your tasks and campaigns today?" }
  ]);
  const [inputValue, setInputValue] = useState("");

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    setMessages([...messages, { role: "user", content: inputValue }]);
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(current => [...current, { 
        role: "ai", 
        content: "I can help automate your campaigns. Would you like me to schedule follow-ups, create email templates, or analyze campaign performance?"
      }]);
    }, 1000);
    
    setInputValue("");
  };

  return (
    <Layout>
      <div className="animate-fade-in h-full w-full">
        <div className="h-full w-full">
          <Tabs defaultValue="execution-automation" className="h-full w-full">
            <TabsList className="mb-6 w-full">
              <TabsTrigger value="execution-automation" className="flex items-center gap-2 flex-1">
                <Settings className="h-4 w-4" />
                Execution & Automation
              </TabsTrigger>
              <TabsTrigger value="campaign-automation" className="flex items-center gap-2 flex-1">
                <Play className="h-4 w-4" />
                Campaign automation
              </TabsTrigger>
              <TabsTrigger value="task-management" className="flex items-center gap-2 flex-1">
                <CheckSquare className="h-4 w-4" />
                Task management
              </TabsTrigger>
            </TabsList>

            <TabsContent value="execution-automation" className="h-full w-full m-0">
              <div className="space-y-6">
                {isChatOpen && (
                  <Card className="border-blue-200 bg-blue-50/40 mb-6">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-sales-blue" />
                        Activator Agent Chat
                      </CardTitle>
                      <CardDescription>
                        Ask Activator about campaign automation, task scheduling, or lead nurturing
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
                                  ? "bg-blue-50 rounded-lg p-3 self-start max-w-[80%]" 
                                  : "bg-gray-100 rounded-lg p-3 self-end max-w-[80%] ml-auto"
                              }`}
                            >
                              <p className="text-sm font-medium">
                                {message.role === "ai" ? "Activator" : "You"}
                              </p>
                              <p className="text-sm">{message.content}</p>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex gap-2 mt-2">
                          <Input
                            type="text" 
                            placeholder="Ask Activator about task automation..."
                            className="flex-1"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSendMessage();
                            }}
                          />
                          <Button 
                            className="bg-sales-blue hover:bg-blue-700 flex items-center gap-2"
                            onClick={handleSendMessage}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Execution & Automation</CardTitle>
                    <CardDescription>Automate your workflow execution and processes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-500">Execution & Automation tools will appear here</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="campaign-automation" className="h-full w-full m-0">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Automation</CardTitle>
                    <CardDescription>Automate your marketing campaigns and sequences</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-500">Campaign automation tools will appear here</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="task-management" className="h-full w-full m-0">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Task Management</CardTitle>
                    <CardDescription>Manage and track your tasks and activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-500">Task management tools will appear here</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Calendar;
