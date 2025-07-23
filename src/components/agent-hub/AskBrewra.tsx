
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const suggestionPrompts = [
  "Show me deals that are stuck in negotiation",
  "Summarize yesterday's demo with Acme Corp",
  "Draft a follow-up email for lead in proposal stage"
];

export function AskBrewra() {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  
  const handleSubmit = (promptText?: string) => {
    const text = promptText || query;
    if (!text.trim()) return;
    
    setIsProcessing(true);
    
    // Simulate AI processing
    setTimeout(() => {
      setIsProcessing(false);
      toast({
        title: "Brewra AI Response",
        description: "Check your notifications for the response to your query.",
      });
      setQuery('');
    }, 1500);
  };

  return (
    <Card className="bg-slate-800 text-white">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-medium">Ask Brewra AI</h3>
            <p className="text-slate-400 text-sm">How can I help you today?</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {suggestionPrompts.map((prompt, index) => (
            <div 
              key={index}
              className="bg-slate-700 p-3 rounded-md text-sm cursor-pointer hover:bg-slate-600 transition-colors"
              onClick={() => handleSubmit(prompt)}
            >
              {prompt} →
            </div>
          ))}
        </div>
        
        <div className="flex gap-2">
          <Input
            placeholder="Type your message here..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-slate-700 border-slate-600 focus-visible:ring-slate-500"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <Button 
            onClick={() => handleSubmit()} 
            disabled={isProcessing} 
            size="icon" 
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
