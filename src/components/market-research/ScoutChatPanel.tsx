import React from 'react';
import { Bot, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ScoutChatPanelProps {
  showScoutChat: boolean;
  isSplitView: boolean;
  hasEdits: boolean;
  showEditHistory: boolean;
  editHistory: any[];
  lastEditedField: string;
  context?: 'market-size' | 'industry-trends' | 'competitor-landscape';
  onClose: () => void;
}

const ScoutChatPanel: React.FC<ScoutChatPanelProps> = ({
  showScoutChat,
  isSplitView,
  hasEdits,
  showEditHistory,
  editHistory,
  lastEditedField,
  context = 'market-size',
  onClose
}) => {
  const getContextualScoutMessage = () => {
    if (context === 'competitor-landscape') {
      if (showEditHistory && editHistory.length > 0) {
        return "Hi Alex! Reviewing your competitor changes? Let me know if you'd like me to pull latest funding news or analyze market positioning shifts.";
      }
      
      if (hasEdits) {
        if (lastEditedField.includes("market share") || lastEditedField.includes("share")) {
          return "I noticed you updated market share figures for Slack. Want me to pull the latest news or analysis?";
        }
        if (lastEditedField.includes("Notion") && lastEditedField.includes("removed")) {
          return "You removed Notion from the list. Should I suggest alternatives or analyze why they might be losing ground?";
        }
        if (lastEditedField.includes("funding") || lastEditedField.includes("news")) {
          return "Would you like me to analyze new funding rounds for these competitors or check for recent M&A activity?";
        }
        return "I noticed you updated the competitor analysis. Would you like me to provide additional insights on competitive positioning or recent market moves?";
      }
      
      return "Hi there! 👋 I'm Scout. Ready to dive deeper into competitor analysis? I can help with market share trends, funding rounds, and competitive positioning.";
    }

    if (context === 'industry-trends') {
      if (showEditHistory && editHistory.length > 0) {
        return "Hi Alex! Reviewing your changes? Let me know if you'd like to validate data or explore why market estimates shifted.";
      }
      
      if (hasEdits) {
        if (lastEditedField.includes("AI") || lastEditedField.includes("ai")) {
          return "I noticed you updated AI adoption metrics. Would you like deeper insights on AI implementation trends or regulatory impacts?";
        }
        if (lastEditedField.includes("cloud") || lastEditedField.includes("migration")) {
          return "I see you modified cloud migration data. Should we explore the key drivers behind this trend or regional variations?";
        }
        return "I noticed you updated the industry trends analysis. Would you like me to provide additional insights based on your changes?";
      }
      
      return "Hi there! 👋 I'm Scout. Want to dive deeper into industry trends and emerging technologies? Here are some questions I can help answer.";
    }

    // Default market-size context
    if (showEditHistory && editHistory.length > 0) {
      return "Hi Alex! Reviewing your changes? Let me know if you'd like to validate data or explore why market estimates shifted.";
    }
    
    if (hasEdits) {
      if (lastEditedField.includes("APAC") || lastEditedField.includes("apac")) {
        return "I noticed you updated the APAC growth rate. Would you like deeper insights on regional trends or competitor presence in APAC?";
      }
      if (lastEditedField.includes("TAM") || lastEditedField.includes("tam")) {
        return "I see you modified the TAM estimate. Should we explore the key drivers behind this market size or break down by industry verticals?";
      }
      return "I noticed you updated the market analysis. Would you like me to provide additional insights based on your changes?";
    }
    
    return "Hi there! 👋 I'm Scout. Want to dive deeper into your market size and opportunities? Here are some questions I can help answer.";
  };

  const getContextualQuestions = () => {
    if (context === 'competitor-landscape') {
      if (hasEdits) {
        return [
          "Pull latest competitor news",
          "Analyze funding impact on market",
          "Compare competitive positioning", 
          "Identify emerging threats",
          "Track M&A activity",
          "Benchmark feature capabilities"
        ];
      }

      return [
        "Show latest funding rounds",
        "Analyze market share shifts",
        "Compare feature roadmaps",
        "Identify acquisition targets",
        "Track competitive pricing"
      ];
    }

    if (context === 'industry-trends') {
      if (hasEdits) {
        return [
          "Validate trend data sources",
          "Explore technology drivers",
          "Analyze regional differences", 
          "Track regulatory impacts",
          "Identify disruption signals",
          "Compare adoption timelines"
        ];
      }

      return [
        "Show AI adoption trends",
        "Analyze cloud migration drivers",
        "Track regulatory changes",
        "Identify emerging technologies",
        "Compare regional variations"
      ];
    }

    // Default market-size questions
    if (hasEdits) {
      return [
        "Show me drivers of TAM growth",
        "Break down mid-market vs enterprise TAM", 
        "Which segments are fastest growing?",
        "Analyze competitor presence in APAC",
        "Update regional market breakdown",
        "Identify emerging tech impacts on TAM"
      ];
    }

    return [
      "Show TAM breakdown by region",
      "What's driving mid-market growth?",
      "Any emerging competitors to watch?",
      "How fast is the market growing YoY?",
      "Break down opportunity by vertical"
    ];
  };

  const getScoutTitle = () => {
    switch (context) {
      case 'competitor-landscape':
        return 'Scout — Competitor Landscape';
      case 'industry-trends':
        return 'Scout — Industry Trends';
      default:
        return 'Scout — Market Size & Opportunity';
    }
  };

  if (!showScoutChat) return null;

  return (
    <div className={`${isSplitView ? 'w-2/5' : 'w-1/2'} bg-white rounded-lg border border-gray-200 p-6 transition-all duration-500 animate-slide-in-right`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center shadow-lg">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/30 to-green-400/30 animate-pulse"></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {getScoutTitle()}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
        <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-700">
            {getContextualScoutMessage()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {getContextualQuestions().map((question, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onClick={() => console.log(`Clicked: ${question}`)}
            >
              {question}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Ask me anything about market opportunity..."
          className="flex-1"
        />
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ScoutChatPanel;
