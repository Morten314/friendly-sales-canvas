
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, Loader2 } from "lucide-react";

interface MarketRanking {
  marketName: string;
  score: string;
  tam: string;
  competition: string;
  barriers: string;
  details?: {
    summary: string;
    subMarkets: Array<{
      name: string;
      size: string;
      growth: string;
    }>;
    keyInsights: string[];
    recommendedActions: string[];
  };
}

interface AIMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
  responseData?: any;
}

interface AIPromptingInterfaceProps {
  marketName: string;
  originalData?: MarketRanking | null;
  modifiedData?: MarketRanking | null;
  onDataUpdate?: (updatedData: MarketRanking) => void;
}

export const AIPromptingInterface = ({ 
  marketName, 
  originalData = null, 
  modifiedData = null,
  onDataUpdate 
}: AIPromptingInterfaceProps) => {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize with welcome message when component mounts or data changes
  useEffect(() => {
    const welcomeMessage: AIMessage = {
      id: `welcome-${Date.now()}`,
      role: "ai",
      content: originalData && modifiedData 
        ? `I can help you analyze the ${marketName} market. I can see you've made some changes to the market data. What would you like to know about the original vs modified data?`
        : `I can help you analyze the ${marketName} market. What would you like to know?`,
      timestamp: new Date()
    };
    
    setMessages([welcomeMessage]);
  }, [marketName, originalData, modifiedData]);

  const handleSendPrompt = async () => {
    if (!prompt.trim()) return;

    // Add user message
    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentPrompt = prompt.trim();
    setPrompt("");
    setIsLoading(true);

    try {
      // Prepare URL parameters
      const params = new URLSearchParams();
      params.append('question', currentPrompt);

      // Add original_json if available
      if (originalData) {
        const originalJson = {
          marketName: originalData.marketName,
          score: originalData.score,
          size: originalData.tam, // Note: mapping tam to size
          competition: originalData.competition,
          barriers: originalData.barriers,
          details: originalData.details
        };
        params.append('original_json', JSON.stringify(originalJson));
      }

      // Add modified_json if available
      if (modifiedData) {
        const modifiedJson = {
          marketName: modifiedData.marketName,
          score: modifiedData.score,
          size: modifiedData.tam, // Note: mapping tam to size
          competition: modifiedData.competition,
          barriers: modifiedData.barriers,
          details: modifiedData.details
        };
        params.append('modified_json', JSON.stringify(modifiedJson));
      }

      const url = `https://backend-11kr.onrender.com/ask?${params.toString()}`;
      console.log('Making GET request to:', url);

      // Make the API call using GET method with URL parameters
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorResponse = await response.text();
          console.log('Error response body:', errorResponse);
          errorDetails = errorResponse;
        } catch (e) {
          console.log('Could not read error response body');
        }

        let errorMessage = `HTTP error! status: ${response.status}`;
        
        switch (response.status) {
          case 422:
            errorMessage = `Validation error (422). The API rejected your request. ${errorDetails ? `Details: ${errorDetails}` : ''}`;
            break;
          case 400:
            errorMessage = "Bad request. Please check your input parameters.";
            break;
          case 404:
            errorMessage = "API endpoint not found. Please check the URL.";
            break;
          case 500:
            errorMessage = "Internal server error. Please try again later.";
            break;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Success! Response data:', data);
      
      // Debug: Log the actual structure of the response
      console.log('Response data structure:', JSON.stringify(data, null, 2));
      
      // Parse the response - handle both direct JSON and string responses
      let responseMessage = '';
      let responseJson = null;

      if (typeof data === 'string') {
        // If response is a JSON string, parse it
        try {
          const parsedData = JSON.parse(data);
          responseMessage = parsedData.response_message || parsedData.message || parsedData.text || parsedData.answer || JSON.stringify(parsedData);
          responseJson = parsedData.response_json || parsedData.json || parsedData.data || null;
        } catch (e) {
          responseMessage = data;
        }
      } else {
        // If response is already an object
        // Try multiple possible field names for the message
        responseMessage = data.response_message || 
                         data.message || 
                         data.response || 
                         data.text || 
                         data.answer || 
                         data.content ||
                         // If none of the expected fields exist, stringify the whole response
                         JSON.stringify(data, null, 2);
        
        // Try multiple possible field names for JSON data
        responseJson = data.response_json || 
                      data.json || 
                      data.data || 
                      data.market_data ||
                      null;
      }
      
      // Create AI response message
      const aiMessage: AIMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        content: responseMessage,
        timestamp: new Date(),
        responseData: {
          ...data,
          responseJson: responseJson
        }
      };

      setMessages(prev => [...prev, aiMessage]);

      // If the response contains updated market data, notify parent component
      if (responseJson && onDataUpdate) {
        // Convert the response JSON back to MarketRanking format
        const updatedMarketData: MarketRanking = {
          marketName: responseJson.marketName || modifiedData?.marketName || originalData?.marketName || '',
          score: responseJson.score || modifiedData?.score || originalData?.score || '',
          tam: responseJson.size || modifiedData?.tam || originalData?.tam || '', // Note: mapping size back to tam
          competition: responseJson.competition || modifiedData?.competition || originalData?.competition || '',
          barriers: responseJson.barriers || modifiedData?.barriers || originalData?.barriers || '',
          details: responseJson.details || modifiedData?.details || originalData?.details
        };
        
        onDataUpdate(updatedMarketData);
      }

    } catch (error) {
      console.error('Detailed error:', error);
      
      let errorContent = "Sorry, I encountered an error while processing your request.";
      
      if (error instanceof Error) {
        errorContent = error.message;
      }
      
      // Add error message
      const errorMessage: AIMessage = {
        id: `error-${Date.now()}`,
        role: "ai",
        content: errorContent,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 bg-gray-50 border-b flex items-center gap-2">
        <Bot className="h-5 w-5 text-purple-600" />
        <h3 className="font-medium">AI Assistant</h3>
        {originalData && modifiedData && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full ml-auto">
            Comparing Data
          </span>
        )}
      </div>
      
      <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <div 
            key={message.id}
            className={`${
              message.role === "ai" 
                ? "bg-blue-50 border-blue-100" 
                : "bg-gray-50 border-gray-100"
            } border p-3 rounded-lg max-w-[90%] ${
              message.role === "ai" ? "" : "ml-auto"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className={`text-xs font-medium ${
                message.role === "ai" ? "text-blue-600" : "text-gray-600"
              }`}>
                {message.role === "ai" ? "AI Assistant" : "You"}
              </span>
              <span className="text-xs text-gray-500">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            
            {/* Display response JSON if available */}
            {message.responseData && message.responseData.responseJson && (
              <div className="mt-3 p-3 bg-white rounded border">
                <p className="text-xs font-medium text-gray-600 mb-2">Updated Market Data:</p>
                <div className="space-y-1 text-xs">
                  <div><span className="font-medium">Market:</span> {message.responseData.responseJson.marketName}</div>
                  <div><span className="font-medium">Score:</span> {message.responseData.responseJson.score}</div>
                  <div><span className="font-medium">Size:</span> {message.responseData.responseJson.size}</div>
                  <div><span className="font-medium">Competition:</span> {message.responseData.responseJson.competition}</div>
                  <div><span className="font-medium">Barriers:</span> {message.responseData.responseJson.barriers}</div>
                  
                  {message.responseData.responseJson.details && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="font-medium mb-1">Sub Markets:</div>
                      {message.responseData.responseJson.details.subMarkets?.map((subMarket: any, idx: number) => (
                        <div key={idx} className="ml-2">
                          • {subMarket.name}: {subMarket.size} ({subMarket.growth} growth)
                        </div>
                      ))}
                      
                      {message.responseData.responseJson.details.keyInsights && (
                        <div className="mt-2">
                          <div className="font-medium">Key Insights:</div>
                          {message.responseData.responseJson.details.keyInsights.map((insight: string, idx: number) => (
                            <div key={idx} className="ml-2">• {insight}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="bg-blue-50 border-blue-100 border p-3 rounded-lg max-w-[90%] flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-600">AI is analyzing your request...</span>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t">
        {/* Data comparison indicator */}
        {originalData && modifiedData && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <p className="font-medium text-yellow-800">Data Comparison Active</p>
            <p className="text-yellow-700">
              Original: {originalData.marketName} (Score: {originalData.score}) vs 
              Modified: {modifiedData.marketName} (Score: {modifiedData.score})
            </p>
          </div>
        )}
        
        <div className="flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              originalData && modifiedData 
                ? "Ask about data changes, insights, or analysis..." 
                : "Ask anything about this market..."
            }
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={isLoading}
          />
          <Button 
            onClick={handleSendPrompt}
            className="bg-purple-600 hover:bg-purple-700"
            disabled={!prompt.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Quick action buttons */}
        {originalData && modifiedData && !isLoading && (
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrompt("What are the key differences between the original and modified data?")}
              className="text-xs"
            >
              Compare Changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrompt("What insights can you provide about the market modifications?")}
              className="text-xs"
            >
              Get Insights
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrompt("What are the implications of these changes?")}
              className="text-xs"
            >
              Analyze Impact
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrompt("Can you tell me about the sub markets?")}
              className="text-xs"
            >
              Sub Markets
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};