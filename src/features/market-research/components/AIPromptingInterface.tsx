import { Send, Bot, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildApiUrl } from "@/shared/api/transport";

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
  responseData?: unknown;
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
  onDataUpdate,
}: AIPromptingInterfaceProps) => {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Function to clean up response content - removes special characters and formats properly
  const cleanResponseContent = (content: string): string => {
    if (!content) return "";

    return (
      content
        // FIRST: Remove any literal "response_message" text that might appear in the response
        .replace(/["']?response_message["']?\s*[:=]\s*/gi, "")
        .replace(/response_message/gi, "")
        // Remove any literal "response_json" text
        .replace(/["']?response_json["']?\s*[:=]\s*/gi, "")
        .replace(/response_json/gi, "")
        // Remove JSON-like structures that appear after the main message (e.g., "competitor_analysis": {...})
        // Match patterns like: ", "key": {...}" or ", "key": "value""
        .replace(/,\s*["']?\w+_analysis["']?\s*[:=]\s*\{[^}]*\}/gi, "")
        .replace(/,\s*["']?\w+["']?\s*[:=]\s*\{[^{}]*\{[^}]*\}[^}]*\}/gi, "")
        .replace(/,\s*["']?\w+["']?\s*[:=]\s*\{[^}]*\}/gi, "")
        // Remove standalone JSON objects at the end
        .replace(/\s*,\s*\{[^}]*\}/g, "")
        // Remove key-value pairs that appear after commas (JSON-like patterns)
        .replace(/,\s*["']?\w+["']?\s*[:=]\s*["']?[^"',}]+["']?\s*/gi, "")
        // Handle escaped newline patterns - convert literal "\n" (backslash-n) to actual newline first
        .replace(/\\n/g, "\n")
        // Handle n- patterns (convert to newlines with bullets) - only when clearly formatting
        // Match "n-" only when preceded by space, start of line, or punctuation
        .replace(/(^|[.:!?\s])n-\s*/g, "$1\n• ")
        // Handle n n patterns (convert to paragraph breaks) - only when clearly two separate formatting n's
        .replace(/(^|[.:!?\s])n\s+n(\s|$|[.:!?])/g, "$1\n\n$2")
        // Handle n followed by actual newline character - only standalone formatting n
        .replace(/(^|[.:!?\s])n\s*\n/g, "$1\n")
        // Handle n followed by whitespace and capital letter (new paragraph) - only when clearly formatting
        // Must be preceded by space/punctuation to avoid matching "in APAC" -> "i APAC"
        .replace(/(^|[.:!?\s])n\s+([A-Z])/g, "$1\n\n$2")
        // Handle n followed by bullet character - only when clearly formatting
        .replace(
          /(^|[.:!?\s])n\s*([•\-\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u2B24\u25CB])/g,
          "$1\n$2",
        )
        // Handle standalone n at end of sentence - convert to newline
        .replace(/([.:!?])\s+n(\s|$)/g, "$1\n$2")
        // Handle r character used as line break (convert to newline)
        .replace(/\s+r\s+/g, "\n")
        .replace(/\s+r$/gm, "\n")
        .replace(/r\s+([A-Z])/g, "\n$1")
        // Remove markdown-style separators (--, ---, etc.) - do this early to catch all patterns
        // Handle bullets (both • and -) followed by dashes
        .replace(/[•\-\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u2B24\u25CB]\s*[-]{2,}\s*/g, "") // Remove any bullet followed by dashes (e.g., "• --")
        // Remove multiple dashes (3 or more) anywhere - do this before handling double dashes
        .replace(/[-]{3,}/g, "")
        // Remove standalone dash separators on their own lines
        .replace(/\n\s*[-]{2,}\s*\n/g, "\n\n")
        // Remove dashes at end of lines
        .replace(/\s+[-]{2,}\s*\n/g, "\n")
        // Remove dashes at start of lines
        .replace(/\n\s*[-]{2,}\s*/g, "\n")
        // Replace " -- " (double dash with spaces) with double newline for section separation
        .replace(/\s+[-]{2}\s+/g, "\n\n")
        // Remove trailing double dashes
        .replace(/\s+[-]{2}$/gm, "")
        // Remove leading double dashes
        .replace(/^[-]{2}\s+/gm, "")
        // Remove markdown formatting symbols
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/#{1,6}\s/g, "")
        .replace(/`{1,3}/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove markdown links but keep text
        // Normalize bullet points to standard bullet
        // FIRST: Replace literal "u2022" text with actual bullet character
        .replace(/u2022/gi, "•")
        .replace(/[•◦▪▫■□●○]/g, "•")
        .replace(/[\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u2B24\u25CB]/g, "•")
        // Normalize arrows
        .replace(/[→←↑↓]/g, "→")
        // Normalize dashes (em dash, en dash to regular dash)
        .replace(/[—–]/g, "-")
        // Normalize quotes
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        // Clean up excessive whitespace but preserve intentional line breaks
        .replace(/[ \t]+/g, " ") // Multiple spaces/tabs to single space
        .replace(/\n{3,}/g, "\n\n") // More than 2 newlines to 2 newlines
        // Format lists properly - ensure consistent bullet formatting
        .replace(/\n\s*[-•]\s*/g, "\n• ")
        .replace(/\n\s*\d+\.\s*/g, "\n• ")
        // Remove empty lines with only whitespace or dashes
        .replace(/\n\s*[-•\s]*\n/g, "\n\n")
        // Ensure proper spacing around punctuation
        .replace(/\s+([.,!?;:])/g, "$1")
        .replace(/([.,!?;:])\s*([A-Z])/g, "$1 $2")
        // Remove problematic special characters but keep common punctuation and symbols
        .replace(/[^\w\s•\-\n\r.,!?;:()'"→$%&@#+=<>]/g, " ")
        // Clean up any double spaces that might have been created
        .replace(/  +/g, " ")
        // Remove leading/trailing whitespace from each line but preserve line breaks
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        // Remove leading/trailing whitespace but preserve internal structure
        .trim()
    );
  };

  // Initialize with welcome message when component mounts or data changes
  useEffect(() => {
    const welcomeMessage: AIMessage = {
      id: `welcome-${Date.now()}`,
      role: "ai",
      content:
        originalData && modifiedData
          ? `I can help you analyze the ${marketName} market. I can see you've made some changes to the market data. What would you like to know about the original vs modified data?`
          : `I can help you analyze the ${marketName} market. What would you like to know?`,
      timestamp: new Date(),
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
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentPrompt = prompt.trim();
    setPrompt("");
    setIsLoading(true);

    try {
      // Prepare URL parameters
      const params = new URLSearchParams();
      params.append("question", currentPrompt);

      // Add original_json if available
      if (originalData) {
        const originalJson = {
          marketName: originalData.marketName,
          score: originalData.score,
          size: originalData.tam, // Note: mapping tam to size
          competition: originalData.competition,
          barriers: originalData.barriers,
          details: originalData.details,
        };
        params.append("original_json", JSON.stringify(originalJson));
      }

      // Add modified_json if available
      if (modifiedData) {
        const modifiedJson = {
          marketName: modifiedData.marketName,
          score: modifiedData.score,
          size: modifiedData.tam, // Note: mapping tam to size
          competition: modifiedData.competition,
          barriers: modifiedData.barriers,
          details: modifiedData.details,
        };
        params.append("modified_json", JSON.stringify(modifiedJson));
      }

      const url = buildApiUrl(`ask?${params.toString()}`);
      console.log("Making GET request to:", url);

      // Make the API call using GET method with URL parameters
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", [...response.headers.entries()]);

      if (!response.ok) {
        let errorDetails = "";
        try {
          const errorResponse = await response.text();
          console.log("Error response body:", errorResponse);
          errorDetails = errorResponse;
        } catch (_e) {
          console.log("Could not read error response body");
        }

        let errorMessage = `HTTP error! status: ${response.status}`;

        switch (response.status) {
          case 422:
            errorMessage = `Validation error (422). The API rejected your request. ${errorDetails ? `Details: ${errorDetails}` : ""}`;
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
      console.log("Success! Response data:", data);

      // Debug: Log the actual structure of the response
      console.log("Response data structure:", JSON.stringify(data, null, 2));

      // Parse the response - STRICTLY only extract response_message
      let responseMessage = "";
      let responseJson = null;

      if (typeof data === "string") {
        // If response is a JSON string, parse it
        try {
          const parsedData = JSON.parse(data);
          // STRICTLY only use response_message - do not fall back to other fields
          responseMessage = parsedData.response_message || "";
          responseJson = parsedData.response_json || parsedData.json || parsedData.data || null;
        } catch (_e) {
          // If it's not JSON, use the string as-is
          responseMessage = data;
        }
      } else {
        // If response is already an object
        // STRICTLY only use response_message - do not fall back to other fields or JSON.stringify
        responseMessage = data.response_message || "";

        // Try multiple possible field names for JSON data (for internal processing only)
        responseJson = data.response_json || data.json || data.data || data.market_data || null;
      }

      // If responseMessage is empty, provide a fallback message instead of showing JSON
      if (!responseMessage || responseMessage.trim() === "") {
        responseMessage = "I received your question but couldn't generate a proper response.";
      }

      // If responseMessage contains JSON-like structures (e.g., starts with quote and has JSON), extract only the message part
      // Split on common JSON delimiters to separate message from JSON
      if (responseMessage.includes('", "') || responseMessage.includes('",\n"')) {
        // Extract only the part before the JSON starts (before ", "key":)
        const jsonStartIndex = responseMessage.search(/",\s*["']?\w+["']?\s*[:=]/);
        if (jsonStartIndex > 0) {
          responseMessage = responseMessage
            .substring(0, jsonStartIndex)
            .replace(/^["']|["']$/g, "")
            .trim();
        }
      }

      // Clean and format the response message before setting it
      const cleanedResponseMessage = cleanResponseContent(responseMessage);

      // Create AI response message (without storing response_json to keep it hidden)
      const aiMessage: AIMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        content: cleanedResponseMessage,
        timestamp: new Date(),
        // Don't store responseData to keep response_json completely hidden
      };

      setMessages((prev) => [...prev, aiMessage]);

      // If the response contains updated market data, notify parent component
      // Note: responseJson is processed but not displayed to keep it hidden from UI
      if (responseJson && onDataUpdate) {
        // Convert the response JSON back to MarketRanking format
        const updatedMarketData: MarketRanking = {
          marketName:
            responseJson.marketName || modifiedData?.marketName || originalData?.marketName || "",
          score: responseJson.score || modifiedData?.score || originalData?.score || "",
          tam: responseJson.size || modifiedData?.tam || originalData?.tam || "", // Note: mapping size back to tam
          competition:
            responseJson.competition ||
            modifiedData?.competition ||
            originalData?.competition ||
            "",
          barriers: responseJson.barriers || modifiedData?.barriers || originalData?.barriers || "",
          details: responseJson.details || modifiedData?.details || originalData?.details,
        };

        onDataUpdate(updatedMarketData);
      }
    } catch (error) {
      console.error("Detailed error:", error);

      let errorContent = "Sorry, I encountered an error while processing your request.";

      if (error instanceof Error) {
        errorContent = error.message;
      }

      // Add error message
      const errorMessage: AIMessage = {
        id: `error-${Date.now()}`,
        role: "ai",
        content: errorContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendPrompt();
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
              message.role === "ai" ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-100"
            } border p-3 rounded-lg max-w-[90%] ${message.role === "ai" ? "" : "ml-auto"}`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span
                className={`text-xs font-medium ${
                  message.role === "ai" ? "text-blue-600" : "text-gray-600"
                }`}
              >
                {message.role === "ai" ? "AI Assistant" : "You"}
              </span>
              <span className="text-xs text-gray-500">{formatTimestamp(message.timestamp)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
              Original: {originalData.marketName} (Score: {originalData.score}) vs Modified:{" "}
              {modifiedData.marketName} (Score: {modifiedData.score})
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
              onClick={() =>
                setPrompt("What are the key differences between the original and modified data?")
              }
              className="text-xs"
            >
              Compare Changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPrompt("What insights can you provide about the market modifications?")
              }
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
