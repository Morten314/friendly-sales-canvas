
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, PlusCircle, MessageSquare, Send, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";

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
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-green-50 text-green-600">
              <Zap className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Task & Campaign Automation (Activator)</h1>
              <p className="text-gray-500">Move fast. Book meetings. Fill your pipeline.</p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-200">
                  Execution & Automation
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  Campaign automation
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  Task management
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              <MessageSquare className="h-4 w-4" />
              Chat with Activator
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Create New Campaign
            </Button>
          </div>
        </div>

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
            <CardTitle>Upcoming Activities</CardTitle>
            <CardDescription>Your scheduled tasks and campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Your calendar view will appear here</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Calendar;
