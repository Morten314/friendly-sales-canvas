
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const quickPrompts = [
  "Show me deals that are stuck in negotiation",
  "Summarize yesterday's demo with Acme Corp",
  "Draft a follow-up email for lead in proposal stage",
  "What are my priority tasks for today?",
  "Which leads are most likely to convert this week?"
];

export function AskBrewra() {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  
  const handleSubmit = () => {
    if (!query.trim()) return;
    
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
  
  const handleQuickPrompt = (prompt: string) => {
    setQuery(prompt);
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-blue-600" />
          Ask Brewra Agentic AI
        </CardTitle>
        <CardDescription>Your AI assistant for sales tasks and insights</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="What would you like to know or do?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? (
              <div className="flex items-center">
                <div className="animate-spin h-4 w-4 border-2 border-b-transparent border-white rounded-full mr-2"></div>
                Thinking...
              </div>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </div>
        
        <div>
          <p className="text-sm text-gray-500 mb-2">Quick prompts:</p>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt, index) => (
              <Button 
                key={index}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleQuickPrompt(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t bg-gray-50 p-3 flex items-center justify-center">
        <p className="text-xs text-gray-500">Brewra AI is using historical data and patterns to assist you</p>
      </CardFooter>
    </Card>
  );
}
