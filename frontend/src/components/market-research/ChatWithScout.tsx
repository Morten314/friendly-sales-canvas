import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Send, ArrowRight, Loader2 } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to clean up response content
  const cleanResponseContent = (content: string): string => {
    return content
      // Remove markdown symbols
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/`{1,3}/g, '')
      // Remove special characters and symbols
      .replace(/[•◦▪▫■□●○]/g, '-')
      .replace(/[\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u2B24\u25CB]/g, '-')
      // Preserve line breaks by converting multiple spaces to single space but keeping newlines
      .replace(/ +/g, ' ')
      // Ensure proper line breaks for lists and structured content
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/\n-/g, '\n• ')
      .replace(/\n\d+\./g, '\n• ')
      // Remove leading/trailing whitespace but preserve internal structure
      .trim();
  };

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      // Make API call to your backend using GET with query parameter
      const response = await fetch(`https://backend-11kr.onrender.com/chat/?question=${encodeURIComponent(currentInput)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Get more detailed error information
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Could not read error response';
        }
        
        console.error(`API Error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Clean up the response content
      const rawContent = data.response || data.message || "I'm having trouble processing your request right now. Please try again.";
      const cleanedContent = cleanResponseContent(rawContent);
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: cleanedContent,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling API:', error);
      
      let errorContent = "I'm sorry, I'm having trouble connecting right now. Please check your internet connection and try again.";
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('405')) {
          errorContent = "The API endpoint doesn't accept POST requests. Please check if the endpoint expects a different HTTP method (GET, PUT, etc.).";
        } else if (error.message.includes('404')) {
          errorContent = "The API endpoint was not found. Please verify the URL is correct.";
        } else if (error.message.includes('500')) {
          errorContent = "There's an issue with the server. Please try again later.";
        }
      }
      
      // Add error message
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: errorContent,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
          {isLoading && (
            <div className="ml-auto flex items-center gap-1 text-blue-600 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking...
            </div>
          )}
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
                <div className="text-sm whitespace-pre-line leading-relaxed">{message.content}</div>
                <div className="text-xs mt-1 text-gray-500">{message.timestamp}</div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Scout is typing...</span>
                </div>
              </div>
            </div>
          )}
          {/* This div will be used for auto-scrolling */}
          <div ref={messagesEndRef} />
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
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            className="self-end"
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
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