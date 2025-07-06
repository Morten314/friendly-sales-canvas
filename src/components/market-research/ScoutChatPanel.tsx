
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
        return "Hi Alex! Reviewing competitor changes? Let me know if you'd like to validate data or explore why competitive dynamics shifted.";
      }
      
      if (!hasEdits) {
        return "Hi Alex! 👋 Ready to dive deeper into your competitor landscape? Here are some questions I can help answer.";
      }
      
      if (lastEditedField.includes("market share") || lastEditedField.includes("share")) {
        return "I noticed you updated market share figures for Slack. Want me to pull the latest news or analysis?";
      }
      if (lastEditedField.includes("Teams") || lastEditedField.includes("teams")) {
        return "I see you modified Microsoft Teams data. Should we explore their latest feature updates or competitive positioning?";
      }
      if (lastEditedField.includes("funding") || lastEditedField.includes("investment")) {
        return "I noticed funding information was updated. Would you like me to find the latest investment rounds or M&A activity?";
      }
      if (hasEdits) {
        return "I noticed you updated the competitor analysis. Would you like me to provide additional insights based on your changes?";
      }
      return "Hi Alex! Ready to dive deeper into your competitor landscape insights. What would you like to explore?";
    }

    if (showEditHistory && editHistory.length > 0) {
      return "Hi Alex! Reviewing your changes? Let me know if you'd like to validate data or explore why market estimates shifted.";
    }
    
    if (!hasEdits) {
      return "Hi there! 👋 I'm Scout. Want to dive deeper into your market size and opportunities? Here are some questions I can help answer.";
    }
    
    if (lastEditedField.includes("APAC") || lastEditedField.includes("apac")) {
      return "I noticed you updated the APAC growth rate. Would you like deeper insights on regional trends or competitor presence in APAC?";
    }
    if (lastEditedField.includes("TAM") || lastEditedField.includes("tam")) {
      return "I see you modified the TAM estimate. Should we explore the key drivers behind this market size or break down by industry verticals?";
    }
    if (hasEdits) {
      return "I noticed you updated the market analysis. Would you like me to provide additional insights based on your changes?";
    }
    return "Hi there! I'm here to help you dive deeper into Market Size & Opportunity insights. What would you like to explore?";
  };

  const getContextualQuestions = () => {
    if (context === 'competitor-landscape') {
      if (!hasEdits) {
        return [
          "Want to see feature-by-feature comparison?",
          "Interested in emerging players or funding news?",
          "Would you like market share split by region?",
          "Show me recent M&A activity",
          "Analyze competitor pricing strategies"
        ];
      }

      return [
        "Pull latest competitive intelligence",
        "Compare feature roadmaps", 
        "Analyze recent funding rounds",
        "Show regional market share shifts",
        "Identify partnership opportunities",
        "Track competitor hiring trends"
      ];
    }

    if (!hasEdits) {
      return [
        "Show TAM breakdown by region",
        "What's driving mid-market growth?",
        "Any emerging competitors to watch?",
        "How fast is the market growing YoY?",
        "Break down opportunity by vertical"
      ];
    }

    return [
      "Show me drivers of TAM growth",
      "Break down mid-market vs enterprise TAM", 
      "Which segments are fastest growing?",
      "Analyze competitor presence in APAC",
      "Update regional market breakdown",
      "Identify emerging tech impacts on TAM"
    ];
  };

  const getContextTitle = () => {
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
            <div className={`w-10 h-10 ${context === 'competitor-landscape' ? 'bg-gradient-to-br from-purple-500 to-blue-500' : 'bg-gradient-to-br from-blue-500 to-green-500'} rounded-full flex items-center justify-center shadow-lg`}>
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div className={`absolute inset-0 rounded-full ${context === 'competitor-landscape' ? 'bg-gradient-to-r from-purple-400/30 to-blue-400/30' : 'bg-gradient-to-r from-blue-400/30 to-green-400/30'} animate-pulse`}></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {getContextTitle()}
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
        <div className={`${context === 'competitor-landscape' ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200' : 'bg-gradient-to-r from-blue-50 to-green-50 border-blue-200'} p-4 rounded-lg border`}>
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
              className={`text-xs transition-colors ${
                context === 'competitor-landscape' 
                  ? 'hover:bg-purple-50 hover:border-purple-300' 
                  : 'hover:bg-blue-50 hover:border-blue-300'
              }`}
              onClick={() => console.log(`Clicked: ${question}`)}
            >
              {question}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={`Ask me anything about ${context === 'competitor-landscape' ? 'competitors' : 'market opportunity'}...`}
          className="flex-1"
        />
        <Button size="sm" className={`${context === 'competitor-landscape' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ScoutChatPanel;
