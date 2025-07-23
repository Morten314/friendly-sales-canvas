
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
  context?: 'market-size' | 'industry-trends' | 'competitor-landscape' | 'regulatory-compliance' | 'market-entry';
  isPostSave?: boolean;
  customMessage?: string;
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
  isPostSave = false,
  customMessage,
  onClose
}) => {

  // Fixed ScoutChatPanel getContextualScoutMessage function
const getContextualScoutMessage = () => {
  // Use custom message if provided (for deletion scenarios)
  if (customMessage) {
    return customMessage;
  }
  
  if (context === 'competitor-landscape') {
    if (showEditHistory && editHistory.length > 0) {
      return "Hi!! Reviewing your competitor changes? Let me know if you'd like me to pull latest funding news or analyze market positioning shifts.";
    }
    
    if (hasEdits) {
      if (lastEditedField.includes("market share") || lastEditedField.includes("share")) {
        return "I noticed you updated market share figures for competitors. Want me to pull the latest news or analysis?";
      }
      if (lastEditedField.includes("executive summary")) {
        return "You updated the executive summary for competitor analysis. Should I provide additional market intelligence or competitive insights?";
      }
      if (lastEditedField.includes("funding") || lastEditedField.includes("news")) {
        return "Would you like me to analyze new funding rounds for these competitors or check for recent M&A activity?";
      }
      if (lastEditedField.includes("emerging players")) {
        return "I see you updated emerging players data. Should I research these companies or identify additional rising competitors?";
      }
      if (lastEditedField.includes("deleted")) {
        return "You removed a section from the competitor analysis. Would you like me to suggest alternative content or analyze why that section might not be relevant?";
      }
      return "I noticed you updated the competitor analysis. Would you like me to provide additional insights on competitive positioning or recent market moves?";
    }
    
    // Default message for competitor-landscape context (even when hasEdits is false)
    return "Hi there! 👋 I'm Scout. Ready to dive deeper into competitor analysis? I can help with market share trends, funding rounds, and competitive positioning.";
  }

  if (context === 'industry-trends') {
    if (showEditHistory && editHistory.length > 0) {
      return "Hi!! Reviewing your changes? Let me know if you'd like to validate data or explore why market estimates shifted.";
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
    
    // Default message for industry-trends context (even when hasEdits is false)
    return "Hi there! 👋 I'm Scout. Want to dive deeper into industry trends and emerging technologies? Here are some questions I can help answer.";
  }

  if (context === 'regulatory-compliance') {
    // Post-save specific message
    if (isPostSave) {
      return "Great work saving your regulatory updates! 🎉 Now that your compliance analysis is saved, I can help you take it further. What would you like to explore next?";
    }
    
    if (showEditHistory && editHistory.length > 0) {
      return "Hi!! Reviewing your compliance changes? Let me know if you'd like me to analyze regulatory impacts or track upcoming deadlines.";
    }
    
    if (hasEdits) {
      if (lastEditedField.includes("EU AI Act") || lastEditedField.includes("ai act")) {
        return "I noticed you updated EU AI Act information. Would you like the latest timeline updates or implementation guidance?";
      }
      if (lastEditedField.includes("data protection") || lastEditedField.includes("GDPR")) {
        return "I see you modified data protection details. Should I provide regional compliance variations or recent enforcement updates?";
      }
      if (lastEditedField.includes("deleted")) {
        return "You removed a compliance section. Would you like me to suggest alternative regulatory content or analyze why that section might not be relevant?";
      }
      return "I noticed you updated the regulatory analysis. Would you like me to provide additional compliance insights or track regulatory changes?";
    }
    
    return "Hi there! 👋 I'm Scout. Ready to dive deeper into regulatory compliance? I can help you stay ahead of changing regulations and assess compliance risks.";
  }

  if (context === 'market-entry') {
    // Post-save specific message
    if (isPostSave) {
      return "Hi!! I noticed you adjusted the Market Pathways. Want help exploring alternatives?";
    }
    
    if (showEditHistory && editHistory.length > 0) {
      return "Hi!! Reviewing your market entry changes? Let me know if you'd like me to validate entry timelines or explore alternative go-to-market strategies.";
    }
    
    if (hasEdits) {
      if (lastEditedField.includes("entry barriers") || lastEditedField.includes("barriers")) {
        return "I noticed you updated entry barriers. Would you like me to research ways to overcome these challenges or analyze their impact on timelines?";
      }
      if (lastEditedField.includes("competitive differentiation") || lastEditedField.includes("differentiation")) {
        return "I see you modified competitive differentiation. Should I help identify additional competitive advantages or analyze market positioning strategies?";
      }
      if (lastEditedField.includes("time to market") || lastEditedField.includes("timeline")) {
        return "You updated the market entry timeline. Would you like me to validate these timelines or suggest ways to accelerate market entry?";
      }
      if (lastEditedField.includes("deleted")) {
        return "I noticed you removed the Market Entry & Growth Strategy section. Want me to help refine or replace it?";
      }
      return "I noticed you updated the market entry strategy. Would you like me to provide additional insights on go-to-market approaches or competitive positioning?";
    }
    
    return "Hi!! 👋 I'm Scout. Ready to help you navigate your market entry and growth plan. Want to dig deeper into barriers, timelines, or the best go-to-market path?";
  }

  // Default market-size context - only reached when context is not competitor-landscape, industry-trends, or regulatory-compliance
  if (showEditHistory && editHistory.length > 0) {
    return "Hi!! Reviewing your changes? Let me know if you'd like to validate data or explore why market estimates shifted.";
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

    if (context === 'regulatory-compliance') {
      // Post-save specific questions
      if (isPostSave) {
        return [
          "Would you like to analyze the business impact of new EU regulations?",
          "Need help drafting updated compliance messaging?",
          "Should I generate a comparison chart for regional laws?",
          "Want to track upcoming compliance deadlines?",
          "Analyze competitive compliance advantages?"
        ];
      }
      
      if (hasEdits) {
        return [
          "Analyze compliance impact",
          "Track regulatory deadlines",
          "Compare regional requirements", 
          "Validate compliance data",
          "Update enforcement news",
          "Assess implementation risks"
        ];
      }

      return [
        "Would you like updates on EU AI Act timelines?",
        "Need a regional compliance comparison?",
        "Want a summary of regulatory risks for SaaS deployment?",
        "Track GDPR enforcement updates",
        "Analyze data localization requirements"
      ];
    }

    if (context === 'market-entry') {
      // Post-save specific questions
      if (isPostSave) {
        return [
          "Analyze regulatory impact on partnerships",
          "Suggest fastest go-to-market path",
          "Research local partnership opportunities",
          "Compare direct entry vs. partnership models",
          "Validate regulatory compliance requirements"
        ];
      }
      
      if (hasEdits) {
        return [
          "Research entry barrier solutions",
          "Validate market entry timelines",
          "Analyze competitive positioning", 
          "Identify partnership opportunities",
          "Assess regulatory requirements",
          "Compare go-to-market strategies"
        ];
      }

      return [
        "How long would it take to enter the market?",
        "What GTM strategies work best for mid-sized companies here?",
        "Can you compare direct entry vs. partnership models?",
        "Which entry barriers should we prioritize addressing?",
        "What competitive advantages should we emphasize?"
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
      case 'regulatory-compliance':
        return 'Scout — Regulatory & Compliance Highlights';
      case 'market-entry':
        return 'Scout — Market Entry & Growth Strategy';
      default:
        return 'Scout — Market Size & Opportunity';
    }
  };

  if (!showScoutChat) return null;

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 p-6 transition-all duration-500 animate-slide-in-right h-[400px] flex flex-col">
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

      <div className="space-y-4 mb-4 flex-1 overflow-y-auto">
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

      <div className="flex gap-2 mt-auto">
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
