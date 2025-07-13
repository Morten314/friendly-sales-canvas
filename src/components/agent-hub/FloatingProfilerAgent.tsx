
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, X, Plus, Search, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FloatingProfilerAgentProps {
  userName?: string;
  hasICPs?: boolean;
  currentContext?: string;
}

const FloatingProfilerAgent = ({ 
  userName = "Alex", 
  hasICPs = false,
  currentContext 
}: FloatingProfilerAgentProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const getGreeting = () => {
    if (!hasICPs) {
      return `Hi ${userName}! Ready to build your first ICP and start profiling leads?`;
    }
    return `Hi ${userName}! Need help enriching leads or finding lookalikes?`;
  };

  const getSuggestions = () => {
    if (!hasICPs) {
      return [
        { icon: Plus, text: "Create your first ICP", action: "create-icp" },
        { icon: Search, text: "Search for companies to enrich", action: "search-companies" },
        { icon: Users, text: "Find people to profile", action: "search-people" }
      ];
    }

    return [
      { icon: Plus, text: "Create new ICP", action: "create-icp" },
      { icon: Search, text: "Find companies like Stripe", action: "find-similar" },
      { icon: Sparkles, text: "Suggest emerging personas", action: "emerging-personas" },
      { icon: Users, text: "Enrich recent leads", action: "enrich-leads" }
    ];
  };

  const handleSuggestionClick = (action: string) => {
    console.log(`Profiler Agent action: ${action}`);
    // Handle different actions based on the suggestion clicked
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <Card className="w-80 shadow-2xl border-2 border-purple-200 bg-white">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-t-lg">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Profiler Scout</CardTitle>
                  <p className="text-sm text-purple-100">Your ICP Assistant</p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-gray-700">{getGreeting()}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Quick Actions:</p>
              {getSuggestions().map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 hover:bg-purple-50 hover:border-purple-200"
                  onClick={() => handleSuggestionClick(suggestion.action)}
                >
                  <suggestion.icon className="h-4 w-4 mr-3 text-purple-600" />
                  <span className="text-sm">{suggestion.text}</span>
                </Button>
              ))}
            </div>

            {currentContext && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">Context:</p>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {currentContext}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Button
          size="lg"
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg border-2 border-white relative group"
        >
          <Bot className="h-7 w-7 text-white" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
        </Button>
      )}
    </div>
  );
};

export default FloatingProfilerAgent;
