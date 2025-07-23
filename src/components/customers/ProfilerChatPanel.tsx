
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, RotateCcw, Bot } from "lucide-react";

interface ProfilerChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context?: {
    cardId?: string;
    cardName?: string;
    action?: 'edit' | 'general';
    editedFields?: string[];
  };
}

export const ProfilerChatPanel = ({ isOpen, onClose, context }: ProfilerChatPanelProps) => {
  const [messages, setMessages] = useState<Array<{ role: 'profiler' | 'user'; content: string }>>([]);
  const [inputValue, setInputValue] = useState("");

  // Initialize conversation based on context
  const getInitialMessage = () => {
    if (context?.action === 'edit' && context.cardName) {
      return `Hi! I noticed you updated your ${context.cardName} ICP card. Would you like me to:
- Refresh market data?
- Suggest buyer personas?
- Check for competitive overlap?
- Find lookalike segments?`;
    }
    
    return `Hi! Which ICP would you like to explore?
- Pick a Suggested ICP card to discuss.
- Or tell me about a new ICP you're researching.`;
  };

  // Set initial message when context changes or chat opens
  useEffect(() => {
    if (isOpen) {
      setMessages([{ role: 'profiler', content: getInitialMessage() }]);
    }
  }, [isOpen, context?.cardName, context?.action]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    const newMessages = [
      ...messages,
      { role: 'user' as const, content: inputValue },
    ];
    setMessages(newMessages);
    
    // Simulate Profiler response
    setTimeout(() => {
      setMessages([
        ...newMessages,
        { 
          role: 'profiler' as const, 
          content: "I can help you with that. Let me analyze the data and provide insights for your ICP."
        }
      ]);
    }, 1000);
    
    setInputValue("");
  };

  const resetConversation = () => {
    setMessages([{ role: 'profiler', content: getInitialMessage() }]);
  };

  if (!isOpen) return null;

  return (
    <Card className="fixed right-4 top-20 w-96 h-[600px] shadow-xl z-50 border-blue-200 bg-white">
      <CardHeader className="pb-3 border-b bg-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            Profiler
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetConversation}
              className="text-gray-400 hover:text-gray-600"
              title="Reset Conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {context?.cardName && (
          <p className="text-xs text-blue-600">Context: {context.cardName}</p>
        )}
      </CardHeader>
      
      <CardContent className="flex flex-col h-full p-0 bg-white">
        <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[400px] bg-white">
          {messages.map((message, index) => (
            <div 
              key={index}
              className={`${
                message.role === "profiler" 
                  ? "bg-blue-50 rounded-lg p-3 self-start" 
                  : "bg-gray-100 rounded-lg p-3 self-end ml-auto max-w-[80%]"
              }`}
            >
              <p className="text-sm font-medium">
                {message.role === "profiler" ? "Profiler" : "You"}
              </p>
              <p className="text-sm whitespace-pre-line">{message.content}</p>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <Input 
              type="text" 
              placeholder="Ask Profiler anything..."
              className="flex-1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
            />
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSendMessage}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
