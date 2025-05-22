
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Send, ArrowRight } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatWithScoutProps {
  fullPage?: boolean;
}

export function ChatWithScout({ fullPage = false }: ChatWithScoutProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi there! I'm Scout, your market research assistant. How can I help you find the right markets or leads today?",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState("");

  const handleSendMessage = () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulate Scout's response after a short delay
    setTimeout(() => {
      let response = "";
      
      if (input.toLowerCase().includes("market")) {
        response = "I can help you analyze markets! Would you like me to research specific industries or suggest growing markets based on your ICP?";
      } else if (input.toLowerCase().includes("competitor")) {
        response = "I can run a competitive analysis for you. Which company would you like me to research?";
      } else if (input.toLowerCase().includes("lead") || input.toLowerCase().includes("prospect")) {
        response = "I can find high-quality leads that match your ideal customer profile. Would you like me to set up a lead stream for you?";
      } else {
        response = "I can help you with market research, competitor analysis, and finding qualified leads. What specific information are you looking for today?";
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${fullPage ? 'h-[80vh]' : 'mb-6'}`}>
      <div className={`flex flex-col ${fullPage ? 'h-full' : ''}`}>
        <div className="bg-blue-50 p-3 border-b flex items-center gap-2">
          <div className="p-1 rounded-full bg-blue-100">
            <MessageSquare className="h-4 w-4 text-blue-700" />
          </div>
          <h3 className="font-medium">Chat with Scout</h3>
        </div>
        
        {/* Messages container */}
        <div className={`overflow-y-auto p-4 space-y-4 ${fullPage ? 'flex-1' : 'h-64'}`}>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-blue-100 text-blue-900"
                    : "bg-gray-100"
                }`}
              >
                <div className="text-sm">{message.content}</div>
                <div className="text-xs mt-1 text-gray-500">{message.timestamp}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="border-t p-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask Scout about markets, competitors, or leads..."
            className="resize-none text-sm"
            rows={2}
          />
          <Button
            onClick={handleSendMessage}
            className="self-end"
            disabled={!input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!fullPage && (
        <div className="border-t p-3 bg-gray-50 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            Scout can analyze markets, identify competitors, and find leads
          </div>
          <Button variant="link" size="sm" className="text-blue-600 flex items-center">
            Open Chat <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
