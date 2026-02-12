import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Bot, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { getUserLocalStorage } from '@/utils/cacheUtils';

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
  const { currentUser } = useAuth();
  const [userInput, setUserInput] = useState('');
  const [chatResponse, setChatResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Function to clean up response content - removes special characters and formats properly
  const cleanResponseContent = (content: string): string => {
    if (!content) return '';
    
    return content
      // FIRST: Remove any literal "response_message" text that might appear in the response
      .replace(/["']?response_message["']?\s*[:=]\s*/gi, '')
      .replace(/response_message/gi, '')
      // Remove any literal "response_json" text
      .replace(/["']?response_json["']?\s*[:=]\s*/gi, '')
      .replace(/response_json/gi, '')
      // Remove JSON-like structures that appear after the main message (e.g., "competitor_analysis": {...})
      // Match patterns like: ", "key": {...}" or ", "key": "value""
      .replace(/,\s*["']?\w+_analysis["']?\s*[:=]\s*\{[^}]*\}/gi, '')
      .replace(/,\s*["']?\w+["']?\s*[:=]\s*\{[^{}]*\{[^}]*\}[^}]*\}/gi, '')
      .replace(/,\s*["']?\w+["']?\s*[:=]\s*\{[^}]*\}/gi, '')
      // Remove standalone JSON objects at the end
      .replace(/\s*,\s*\{[^}]*\}/g, '')
      // Remove key-value pairs that appear after commas (JSON-like patterns)
      .replace(/,\s*["']?\w+["']?\s*[:=]\s*["']?[^"',}]+["']?\s*/gi, '')
      // Handle escaped newline patterns - convert literal "\n" (backslash-n) to actual newline first
      .replace(/\\n/g, '\n')
      // Handle n- patterns (convert to newlines with bullets) - only when clearly formatting
      // Match "n-" only when preceded by space, start of line, or punctuation
      .replace(/(^|[\.:!?\s])n-\s*/g, '$1\n• ')
      // Handle n n patterns (convert to paragraph breaks) - only when clearly two separate formatting n's
      .replace(/(^|[\.:!?\s])n\s+n(\s|$|[\.:!?])/g, '$1\n\n$2')
      // Handle n followed by actual newline character - only standalone formatting n
      .replace(/(^|[\.:!?\s])n\s*\n/g, '$1\n')
      // Handle n followed by whitespace and capital letter (new paragraph) - only when clearly formatting
      // Must be preceded by space/punctuation to avoid matching "in APAC" -> "i APAC"
      .replace(/(^|[\.:!?\s])n\s+([A-Z])/g, '$1\n\n$2')
      // Handle n followed by bullet character - only when clearly formatting
      .replace(/(^|[\.:!?\s])n\s*([•\-\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u2B24\u25CB])/g, '$1\n$2')
      // Handle standalone n at end of sentence - convert to newline
      .replace(/([\.:!?])\s+n(\s|$)/g, '$1\n$2')
      // Handle r character used as line break (convert to newline)
      .replace(/\s+r\s+/g, '\n')
      .replace(/\s+r$/gm, '\n')
      .replace(/r\s+([A-Z])/g, '\n$1')
      // Remove markdown-style separators (--, ---, etc.) - do this early to catch all patterns
      // Handle bullets (both • and -) followed by dashes
      .replace(/[•\-\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u2B24\u25CB]\s*[-]{2,}\s*/g, '') // Remove any bullet followed by dashes (e.g., "• --")
      // Remove multiple dashes (3 or more) anywhere - do this before handling double dashes
      .replace(/[-]{3,}/g, '')
      // Remove standalone dash separators on their own lines
      .replace(/\n\s*[-]{2,}\s*\n/g, '\n\n')
      // Remove dashes at end of lines
      .replace(/\s+[-]{2,}\s*\n/g, '\n')
      // Remove dashes at start of lines
      .replace(/\n\s*[-]{2,}\s*/g, '\n')
      // Replace " -- " (double dash with spaces) with double newline for section separation
      .replace(/\s+[-]{2}\s+/g, '\n\n')
      // Remove trailing double dashes
      .replace(/\s+[-]{2}$/gm, '')
      // Remove leading double dashes
      .replace(/^[-]{2}\s+/gm, '')
      // Remove markdown formatting symbols
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/`{1,3}/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove markdown links but keep text
      // Normalize bullet points to standard bullet
      // FIRST: Replace literal "u2022" text with actual bullet character
      .replace(/u2022/gi, '•')
      .replace(/[•◦▪▫■□●○]/g, '•')
      .replace(/[\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u2B24\u25CB]/g, '•')
      // Normalize arrows
      .replace(/[→←↑↓]/g, '→')
      // Normalize dashes (em dash, en dash to regular dash)
      .replace(/[—–]/g, '-')
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Clean up excessive whitespace but preserve intentional line breaks
      .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
      .replace(/\n{3,}/g, '\n\n') // More than 2 newlines to 2 newlines
      // Format lists properly - ensure consistent bullet formatting
      .replace(/\n\s*[-•]\s*/g, '\n• ')
      .replace(/\n\s*\d+\.\s*/g, '\n• ')
      // Remove empty lines with only whitespace or dashes
      .replace(/\n\s*[-•\s]*\n/g, '\n\n')
      // Ensure proper spacing around punctuation
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([.,!?;:])\s*([A-Z])/g, '$1 $2')
      // Remove problematic special characters but keep common punctuation and symbols
      .replace(/[^\w\s•\-\n\r.,!?;:()'"→$%&@#+=<>]/g, ' ')
      // Clean up any double spaces that might have been created
      .replace(/  +/g, ' ')
      // Remove leading/trailing whitespace from each line but preserve line breaks
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Remove leading/trailing whitespace but preserve internal structure
      .trim();
  };

  // Helper functions for API integration
  const handleQuestionClick = async (question: string) => {
    await callChatAPI(question);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    const question = userInput;
    setUserInput('');
    await callChatAPI(question);
  };

  const callChatAPI = async (question: string) => {
    setIsLoading(true);
    try {
      // Determine API endpoint based on context and edit state
      const isEditMode = hasEdits || isPostSave;
      const baseUrl = '/api';
      
      let url: string;
      let requestOptions: RequestInit;
      
      if (isEditMode) {
        // Use /ask endpoint with GET method for edit context
        url = `${baseUrl}/ask/?question=${encodeURIComponent(question)}`;
        
        // Get the stored JSON data from localStorage (user-specific)
        const storedOriginalJson = getUserLocalStorage(`${context}_original_json`, currentUser?.uid);
        const storedModifiedJson = getUserLocalStorage(`${context}_modified_json`, currentUser?.uid);
        
        if (storedOriginalJson && storedModifiedJson) {
          console.log('📤 Sending to /ask API with JSON context:', { 
            question, 
            original_json: JSON.parse(storedOriginalJson), 
            modified_json: JSON.parse(storedModifiedJson) 
          });
        }
        
        requestOptions = {
          method: 'GET',
          headers: {
            'accept': 'application/json'
          }
        };
      } else {
        // Use /chat endpoint with GET method for general questions
        url = `${baseUrl}/chat/?question=${encodeURIComponent(question)}`;
        requestOptions = {
          method: 'GET',
          headers: {
            'accept': 'application/json'
          }
        };
      }

      console.log(`🤖 Making Scout API call to ${isEditMode ? '/ask' : '/chat'} with question:`, question);
      
      const response = await fetch(url, requestOptions);

      if (response.ok) {
        const data = await response.json();
        console.log('Raw Scout API Response:', data);
        console.log('Response type:', typeof data);
        console.log('Is array:', Array.isArray(data));
        
        // Handle different response formats - STRICTLY only extract response_message
        let answer = '';
        if (Array.isArray(data) && data.length > 0) {
          console.log('Processing as array, first element:', data[0]);
          console.log('First element type:', typeof data[0]);
          
          if (typeof data[0] === 'string') {
            answer = data[0];
          } else if (typeof data[0] === 'object') {
            // STRICTLY only use response_message - do not fall back to other fields or JSON.stringify
            answer = data[0].response_message || '';
          } else {
            answer = String(data[0]);
          }
        } else if (typeof data === 'object' && data !== null) {
          console.log('Processing as object, keys:', Object.keys(data));
          // STRICTLY only use response_message - do not fall back to other fields or JSON.stringify
          answer = data.response_message || '';
        } else if (typeof data === 'string') {
          console.log('Processing as string');
          // Try to parse as JSON string in case it contains response_message
          try {
            const parsedData = JSON.parse(data);
            // STRICTLY only use response_message
            answer = parsedData.response_message || '';
          } catch (e) {
            // If it's not JSON, use the string as-is
            answer = data;
          }
        } else {
          console.log('Unknown data format, falling back');
          answer = 'I received your question but couldn\'t generate a proper response.';
        }
        
        // If answer is empty, provide a fallback message instead of showing JSON
        if (!answer || answer.trim() === '') {
          answer = 'I received your question but couldn\'t generate a proper response.';
        }
        
        // If answer contains JSON-like structures (e.g., starts with quote and has JSON), extract only the message part
        // Split on common JSON delimiters to separate message from JSON
        if (answer.includes('", "') || answer.includes('",\n"')) {
          // Extract only the part before the JSON starts (before ", "key":)
          const jsonStartIndex = answer.search(/",\s*["']?\w+["']?\s*[:=]/);
          if (jsonStartIndex > 0) {
            answer = answer.substring(0, jsonStartIndex).replace(/^["']|["']$/g, '').trim();
          }
        }
        
        console.log('Final answer:', answer);
        // Clean and format the response before setting it
        const cleanedAnswer = cleanResponseContent(answer);
        setChatResponse(cleanedAnswer);
      } else {
        setChatResponse('Sorry, I\'m having trouble connecting right now. Please try again later.');
        console.error('Failed to get response from Scout API');
      }
    } catch (error) {
      setChatResponse('Sorry, I encountered an error. Please try again later.');
      console.error('Error calling Scout API:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  // Auto-scroll to top when chat panel opens (only when showScoutChat becomes true)
  useEffect(() => {
    if (!showScoutChat) return;
    
    const container = chatContainerRef.current;
    if (!container) return;
    
    let isScrolling = true; // Flag to control persistent scrolling
    let scrollInterval: NodeJS.Timeout | null = null;
    let scrollListener: ((e: Event) => void) | null = null;
    
    const scrollToTop = () => {
      if (!container || !isScrolling) return;
      
      // Force scroll to top - simple and direct
      container.scrollTop = 0;
      
      // Also use scrollTo for browser compatibility
      try {
        container.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      } catch (e) {
        try {
          container.scrollTo(0, 0);
        } catch (e2) {
          // Fallback
        }
      }
      
      // Final force to ensure it's at 0
      container.scrollTop = 0;
    };
    
    // Add scroll event listener to prevent scrolling down
    scrollListener = (e: Event) => {
      if (!isScrolling) return;
      const target = e.target as HTMLElement;
      if (target && target.scrollTop > 0) {
        // If scrolling down, immediately scroll back to top
        target.scrollTop = 0;
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    // Use capture phase to catch scroll events early
    container.addEventListener('scroll', scrollListener, { passive: false, capture: true });
    
    // Immediate scroll - execute right away
    scrollToTop();
    
    // Use requestAnimationFrame for DOM-ready scroll
    const rafId1 = requestAnimationFrame(() => {
      scrollToTop();
      const rafId2 = requestAnimationFrame(() => {
        scrollToTop();
      });
      return () => cancelAnimationFrame(rafId2);
    });
    
    // Multiple timeouts with increasing delays to catch all render phases
    // Focus on earlier delays to prevent any bottom-scrolling from taking effect
    const timeouts: NodeJS.Timeout[] = [];
    [0, 10, 25, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 2000].forEach(delay => {
      const timeoutId = setTimeout(() => {
        scrollToTop();
      }, delay);
      timeouts.push(timeoutId);
    });
    
    // Persistent scroll check - keep forcing to top for the first 3 seconds
    // This prevents any other code from scrolling to bottom
    scrollInterval = setInterval(() => {
      if (container && container.scrollTop > 0 && isScrolling) {
        // If it's scrolled down at all, force it back to top
        container.scrollTop = 0;
        container.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    }, 20); // Check every 20ms for more aggressive monitoring
    
    // Stop persistent scrolling after 3 seconds
    setTimeout(() => {
      isScrolling = false;
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
      if (scrollListener) {
        container.removeEventListener('scroll', scrollListener, { capture: true });
      }
    }, 3000);
    
    // Cleanup function
    return () => {
      isScrolling = false;
      cancelAnimationFrame(rafId1);
      timeouts.forEach(timeout => clearTimeout(timeout));
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
      if (scrollListener) {
        container.removeEventListener('scroll', scrollListener, { capture: true });
      }
    };
  }, [showScoutChat]); // Only trigger when panel opens/closes, NOT on content changes

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

      <div ref={chatContainerRef} className="space-y-4 mb-4 flex-1 overflow-y-auto">
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
              onClick={() => handleQuestionClick(question)}
              disabled={isLoading}
            >
              {question}
            </Button>
          ))}
        </div>

        {/* Display chat response if available */}
        {chatResponse && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Bot className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
                {chatResponse}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-auto">
        <Input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ask Scout anything..."
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          disabled={isLoading}
        />
        <Button 
          size="sm" 
          onClick={handleSendMessage}
          disabled={isLoading || !userInput.trim()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ScoutChatPanel;