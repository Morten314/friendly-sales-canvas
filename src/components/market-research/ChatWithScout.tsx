import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";

interface Message {
  role: "ai" | "user";
  content: string;
}

export const ChatWithScout = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: "Hello! I'm Scout. How can I help with your market research today?" }
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
        content: "I can analyze this market for you. Would you like me to focus on market size, competitor landscape, or growth potential?"
      }]);
    }, 1000);
    
    setInputValue("");
  };

  return (
    <Card className="border-blue-200 bg-blue-50/40 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-sales-blue" />
          Scout Agent Chat
        </CardTitle>
        <CardDescription>
          Ask Scout about markets, competitor analysis or request new research
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
                  {message.role === "ai" ? "Scout" : "You"}
                </p>
                <p className="text-sm">{message.content}</p>
              </div>
            ))}
          </div>
          
          <div className="flex gap-2 mt-2">
            <Input
              type="text" 
              placeholder="Ask Scout about market opportunities..."
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
  );
};