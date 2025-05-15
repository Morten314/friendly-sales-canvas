
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
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
    <Card className="bg-slate-800 text-white h-full">
      <CardHeader className="border-b border-slate-700 pb-4">
        <CardTitle className="text-lg">Ask Brewra AI</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 flex flex-col h-[calc(100%-60px)]">
        <div className="flex-1 flex flex-col items-center justify-center pb-4">
          <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-1">How can I help you today?</h3>
          <p className="text-slate-400 text-sm text-center mb-4">
            Ask me about your leads, deals, or for help with outreach
          </p>
        </div>

        <div className="space-y-3 mb-4">
          <p className="text-xs text-slate-400">Try these prompts:</p>
          <div className="space-y-2">
            {suggestionPrompts.map((prompt, index) => (
              <div 
                key={index}
                className="bg-slate-700 p-2 rounded-md text-xs cursor-pointer hover:bg-slate-600 transition-colors"
                onClick={() => handleSubmit(prompt)}
              >
                {prompt} →
              </div>
            ))}
          </div>
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
