import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X, Bot, Check, XCircle } from "lucide-react";

interface SignalCard {
  id: string;
  agent: 'scout' | 'profiler';
  timestamp: string;
  headline: string;
  snippet: string;
  sourceUrl: string;
  sourceLabel: string;
}

interface ChatMessage {
  role: "agent" | "user";
  content: string;
  type?: "text" | "actions";
  category?: string;
}

interface ActionPrompt {
  text: string;
  category: string;
}

interface SignalAgentChatProps {
  signal: SignalCard;
  isAccepted: boolean;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

const getNextBestMoves = (signal: SignalCard): { category: string; label: string; actions: ActionPrompt[] }[] => {
  const isCompetitor = signal.headline.toLowerCase().includes("competitor") || signal.headline.toLowerCase().includes("pricing");
  const isFunding = signal.headline.toLowerCase().includes("funding");
  const isICP = signal.headline.toLowerCase().includes("icp") || signal.headline.toLowerCase().includes("segment");
  const isLinkedIn = signal.sourceLabel.toLowerCase().includes("linkedin");

  return [
    {
      category: "Strategic Moves",
      label: "🎯",
      actions: isCompetitor
        ? [
            { text: "Reposition messaging against new pricing tier", category: "Strategic Moves" },
            { text: "Adjust ICP targeting for mid-market segment", category: "Strategic Moves" },
            { text: "Explore SMB segment further", category: "Strategic Moves" },
            { text: "Set up ongoing competitor monitoring", category: "Strategic Moves" },
          ]
        : isICP
        ? [
            { text: "Explore this new segment further", category: "Strategic Moves" },
            { text: "Adjust ICP targeting for this profile", category: "Strategic Moves" },
            { text: "Reposition messaging for this audience", category: "Strategic Moves" },
            { text: "Monitor this segment's growth trajectory", category: "Strategic Moves" },
          ]
        : [
            { text: "Reposition messaging based on this signal", category: "Strategic Moves" },
            { text: "Adjust ICP targeting accordingly", category: "Strategic Moves" },
            { text: "Explore this segment further", category: "Strategic Moves" },
            { text: "Monitor for follow-up developments", category: "Strategic Moves" },
          ],
    },
    {
      category: "GTM Execution",
      label: "🚀",
      actions: isCompetitor
        ? [
            { text: "Analyze pricing gap vs your positioning", category: "GTM Execution" },
            { text: "Generate counter-positioning messaging", category: "GTM Execution" },
            { text: "Create competitor comparison sheet", category: "GTM Execution" },
            { text: "Adjust landing page messaging", category: "GTM Execution" },
          ]
        : isLinkedIn
        ? [
            { text: "Draft contextual LinkedIn post", category: "GTM Execution" },
            { text: "Create outreach angle from this signal", category: "GTM Execution" },
            { text: "Draft email to relevant ICP contacts", category: "GTM Execution" },
            { text: "Adjust landing page messaging", category: "GTM Execution" },
          ]
        : [
            { text: "Create LinkedIn post about this development", category: "GTM Execution" },
            { text: "Draft email to ICP contacts", category: "GTM Execution" },
            { text: "Create outreach angle", category: "GTM Execution" },
            { text: "Adjust landing page messaging", category: "GTM Execution" },
          ],
    },
    {
      category: "Content & Thought Leadership",
      label: "✍️",
      actions: isCompetitor
        ? [
            { text: "Draft LinkedIn post reacting to this move", category: "Content & Thought Leadership" },
            { text: "Create blog post on competitive landscape", category: "Content & Thought Leadership" },
            { text: "Generate founder POV post", category: "Content & Thought Leadership" },
            { text: "Create talking points for next webinar", category: "Content & Thought Leadership" },
          ]
        : isFunding
        ? [
            { text: "Draft blog post on market funding trends", category: "Content & Thought Leadership" },
            { text: "Create newsletter snippet", category: "Content & Thought Leadership" },
            { text: "Generate founder POV post", category: "Content & Thought Leadership" },
            { text: "Create talking points for industry analysis", category: "Content & Thought Leadership" },
          ]
        : [
            { text: "Draft blog post on this topic", category: "Content & Thought Leadership" },
            { text: "Create newsletter snippet", category: "Content & Thought Leadership" },
            { text: "Generate founder POV post", category: "Content & Thought Leadership" },
            { text: "Create talking points for webinar", category: "Content & Thought Leadership" },
          ],
    },
    {
      category: "Internal Action",
      label: "📋",
      actions: [
        { text: "Create internal sales briefing", category: "Internal Action" },
        { text: "Add to weekly digest", category: "Internal Action" },
        { text: "Add to watchlist", category: "Internal Action" },
        { text: "Assign to a teammate", category: "Internal Action" },
      ],
    },
  ];
};

const getAgentGreeting = (signal: SignalCard): string => {
  const isCompetitor = signal.headline.toLowerCase().includes("competitor") || signal.headline.toLowerCase().includes("pricing");
  const isFunding = signal.headline.toLowerCase().includes("funding");
  const isICP = signal.headline.toLowerCase().includes("icp") || signal.headline.toLowerCase().includes("segment");

  if (isCompetitor) {
    return `Hi Alex — this competitor has launched a new pricing tier.\n\nThis may impact your mid-market positioning. Would you like to act on it?`;
  }
  if (isFunding) {
    return `Hi Alex — this signal indicates a significant funding event in your space.\n\nThis could shift competitive dynamics. Would you like to act on it?`;
  }
  if (isICP) {
    return `Hi Alex — a new ICP segment has been identified with strong overlap to your existing profiles.\n\nThis could open new pipeline opportunities. Would you like to act on it?`;
  }
  return `Hi Alex — this signal indicates ${signal.headline.toLowerCase()}.\n\nWould you like to act on it?`;
};

export function SignalAgentChat({ signal, isAccepted, onAccept, onReject, onClose }: SignalAgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "agent", content: getAgentGreeting(signal), type: "text" },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const categories = getNextBestMoves(signal);

  const handleActionClick = (action: ActionPrompt) => {
    setSelectedActions((prev) =>
      prev.includes(action.text) ? prev.filter((a) => a !== action.text) : [...prev, action.text]
    );

    // Add as user message + agent response
    setMessages((prev) => [
      ...prev,
      { role: "user", content: action.text, type: "text" },
      {
        role: "agent",
        content: `Got it! I'll "${action.text.toLowerCase()}" right away. This will be executed once you accept this signal.`,
        type: "text",
      },
    ]);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: inputValue, type: "text" },
      {
        role: "agent",
        content: "Understood — I'll factor that into the action plan. Anything else you'd like me to do with this signal?",
        type: "text",
      },
    ]);
    setInputValue("");
  };

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/30 mt-3 overflow-hidden animate-in slide-in-from-top-2 duration-300">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-800">
            {signal.agent === "scout" ? "Scout" : "Profiler"} Agent
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="max-h-[350px] overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700"
              }`}
            >
              <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Next Best Moves — 4 categories */}
      <div className="px-4 pb-3 space-y-3">
        {categories.map((cat) => (
          <div key={cat.category}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              {cat.label} {cat.category}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cat.actions.map((action) => {
                const isSelected = selectedActions.includes(action.text);
                return (
                  <button
                    key={action.text}
                    onClick={() => handleActionClick(action)}
                    className={`text-xs px-2.5 py-1.5 rounded-md border transition-all ${
                      isSelected
                        ? "bg-blue-100 border-blue-300 text-blue-700 font-medium"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                    }`}
                  >
                    {action.text}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Accept / Reject — faded hint */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-gray-400 mb-2 italic">
          These actions will be performed when you accept this signal.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-4"
            onClick={onAccept}
            disabled={isAccepted}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            {isAccepted ? "Accepted" : "Accept Signal"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-8 px-4"
            onClick={onReject}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Reject
          </Button>
        </div>
      </div>

      {/* Free-form input */}
      <div className="px-4 pb-3 border-t border-blue-100 pt-3">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type your own instructions to the agent..."
            className="flex-1 text-sm h-9 bg-white"
          />
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-9" onClick={handleSendMessage} disabled={!inputValue.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
