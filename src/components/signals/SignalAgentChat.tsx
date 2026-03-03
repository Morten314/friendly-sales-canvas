import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X, Bot, ThumbsUp, ThumbsDown, ExternalLink, Users, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  type?: "text" | "facts" | "validation";
}

interface SignalFact {
  source: string;
  icon: string;
  title: string;
  detail: string;
  url?: string;
}

interface SignalAgentChatProps {
  signal: SignalCard;
  isAccepted: boolean;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

const getSignalFacts = (signal: SignalCard): SignalFact[] => {
  const headline = signal.headline.toLowerCase();

  if (headline.includes("competitor") || headline.includes("pricing")) {
    return [
    { source: "LinkedIn", icon: "💼", title: "42 conversations trending", detail: "Mid-market SaaS leaders discussing competitor pricing shifts. Key personas: VP Sales, CROs at 200-500 employee companies.", url: "#" },
    { source: "Reddit r/SaaS", icon: "🟠", title: "Thread with 180+ upvotes", detail: "\"Has anyone switched to Competitor X's new SMB tier?\" — strong sentiment around value vs. feature gaps.", url: "#" },
    { source: "TechCrunch", icon: "📰", title: "Featured in weekly roundup", detail: "Competitor X's pricing move cited as \"most aggressive SaaS repositioning of Q1.\"", url: "#" },
    { source: "Forrester", icon: "📊", title: "Analyst brief published", detail: "Forrester notes this signals a broader mid-market compression trend across 14 SaaS categories.", url: "#" },
    { source: "Forbes", icon: "📈", title: "Market impact analysis", detail: "Forbes estimates 15-20% of mid-market accounts may re-evaluate vendors within 90 days.", url: "#" }];

  }

  if (headline.includes("funding")) {
    return [
    { source: "TechCrunch", icon: "📰", title: "Series B deep-dive", detail: "Funding round led by Tier-1 VC, signaling strong confidence in AI automation space.", url: "#" },
    { source: "LinkedIn", icon: "💼", title: "87 industry reactions", detail: "CTOs and VPs of Engineering sharing takes on what this means for the competitive landscape.", url: "#" },
    { source: "Reddit r/startups", icon: "🟠", title: "Active discussion thread", detail: "\"Will this change the competitive dynamics?\" — 60+ comments debating market impact.", url: "#" },
    { source: "Forbes", icon: "📈", title: "Sector analysis", detail: "Forbes highlights this as part of a $2.3B funding wave in automation this quarter.", url: "#" },
    { source: "Forrester", icon: "📊", title: "Wave report update", detail: "Company now positioned as a Strong Performer in latest Forrester Wave.", url: "#" }];

  }

  if (headline.includes("icp") || headline.includes("segment")) {
    return [
    { source: "LinkedIn", icon: "💼", title: "FinTech decision-makers active", detail: "34 CTOs/CPOs at 50-200 employee FinTech firms posted about cloud migration in the last 7 days.", url: "#" },
    { source: "Reddit r/fintech", icon: "🟠", title: "Emerging pain points", detail: "Recurring themes: compliance burden, integration complexity, vendor lock-in fears.", url: "#" },
    { source: "Forrester", icon: "📊", title: "Segment growth forecast", detail: "FinTech infrastructure spend projected to grow 28% YoY in EU markets.", url: "#" },
    { source: "TechCrunch", icon: "📰", title: "EU FinTech spotlight", detail: "3 FinTech startups in this segment raised seed rounds this month.", url: "#" },
    { source: "Forbes", icon: "📈", title: "Target group profile", detail: "Average deal size for this segment: $45K ARR. Decision cycle: 45-60 days.", url: "#" }];

  }

  // LinkedIn/default signals
  return [
  { source: "LinkedIn", icon: "💼", title: "Engagement spike detected", detail: "Post reached 3.2K impressions with 85% from target ICP personas.", url: "#" },
  { source: "Reddit", icon: "🟠", title: "Related discussions found", detail: "Similar topics trending across 3 relevant subreddits this week.", url: "#" },
  { source: "TechCrunch", icon: "📰", title: "Industry context", detail: "This trend mentioned in 2 recent articles on enterprise adoption.", url: "#" },
  { source: "Forrester", icon: "📊", title: "Analyst perspective", detail: "Aligns with Forrester's predicted shift in buyer behavior for 2025.", url: "#" },
  { source: "Forbes", icon: "📈", title: "Market validation", detail: "Forbes contributors have highlighted this trend 4 times this quarter.", url: "#" }];

};

const getTargetGroups = (signal: SignalCard): string[] => {
  const headline = signal.headline.toLowerCase();
  if (headline.includes("competitor") || headline.includes("pricing")) {
    return ["Mid-Market SaaS (200-500 emp)", "VP Sales & CROs", "Existing pipeline at risk"];
  }
  if (headline.includes("funding")) {
    return ["AI Automation buyers", "Enterprise CTOs", "Competitive deal cycles"];
  }
  if (headline.includes("icp") || headline.includes("segment")) {
    return ["FinTech startups (50-200 emp)", "EU-based CPOs/CTOs", "Cloud migration prospects"];
  }
  return ["ICP decision-makers", "Industry influencers", "Active pipeline contacts"];
};

const getAgentGreeting = (signal: SignalCard): string => {
  const headline = signal.headline.toLowerCase();
  if (headline.includes("competitor") || headline.includes("pricing")) {
    return `Here's what I found about this competitor move across the web:`;
  }
  if (headline.includes("funding")) {
    return `I've gathered intelligence on this funding event from multiple sources:`;
  }
  if (headline.includes("icp") || headline.includes("segment")) {
    return `Here's the deep-dive on this new segment opportunity:`;
  }
  return `Here's the intelligence I've gathered on this signal:`;
};

const getAgentResponse = (signal: SignalCard, userMessage: string): string => {
  const msg = userMessage.toLowerCase();
  if (msg.includes("pricing") || msg.includes("compare")) {
    return "Based on my analysis, Competitor X's new tier is priced 20-30% below your mid-market offering but lacks 3 key features: advanced analytics, SSO, and priority support. This creates a strong counter-positioning angle around enterprise-readiness.";
  }
  if (msg.includes("outreach") || msg.includes("email") || msg.includes("draft")) {
    return "I can draft a targeted outreach sequence highlighting your differentiation. The messaging should focus on total cost of ownership and feature completeness rather than matching on price point.";
  }
  if (msg.includes("linkedin") || msg.includes("post") || msg.includes("content")) {
    return "I see high engagement from your ICP on LinkedIn around this topic. A thought leadership post positioning your take on value-based selling vs. race-to-bottom pricing would likely generate strong traction with your target audience.";
  }
  if (msg.includes("monitor") || msg.includes("track") || msg.includes("watch")) {
    return "I'll set up continuous monitoring across LinkedIn, Reddit, and industry publications. You'll get alerts when key conversations or sentiment shifts are detected in real-time.";
  }
  return `Good question. Based on the signal "${signal.headline}", I've analyzed the broader context. The key takeaway is that this development affects your target accounts in the mid-market segment. I recommend prioritizing outreach to at-risk accounts and adjusting your positioning accordingly.`;
};

export function SignalAgentChat({ signal, isAccepted, onAccept, onReject, onClose }: SignalAgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
  { role: "agent", content: getAgentGreeting(signal), type: "text" }]
  );
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const facts = getSignalFacts(signal);
  const targetGroups = getTargetGroups(signal);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showValidation]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setMessages((prev) => [...prev, { role: "user", content: userMsg, type: "text" }]);
    setInputValue("");
    setIsTyping(true);
    setShowValidation(false);

    // Simulate agent response
    setTimeout(() => {
      const response = getAgentResponse(signal, userMsg);
      setMessages((prev) => [...prev, { role: "agent", content: response, type: "text" }]);
      setIsTyping(false);

      // After responding, show validation prompt
      setTimeout(() => {
        setShowValidation(true);
      }, 600);
    }, 1200);
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

      <ScrollArea className="max-h-[500px]">
        <div className="p-4 space-y-4">
          {/* Agent greeting */}
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-lg px-3 py-2 text-sm bg-white border border-gray-200 text-gray-700">
              <p className="leading-relaxed">{messages[0].content}</p>
            </div>
          </div>

          {/* Target Groups */}
          <div className="px-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Groups</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {targetGroups.map((group) =>
              <span key={group} className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                  {group}
                </span>
              )}
            </div>
          </div>

          {/* Wow Facts from sources */}
          <div className="px-1">
            <div className="flex items-center gap-1.5 mb-2">
              
              
            </div>
            <div className="space-y-2">
              {facts.map((fact, i) =>
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-100 p-3 hover:border-blue-200 hover:shadow-sm transition-all cursor-default">
                
                  <div className="flex items-start gap-2.5">
                    <span className="text-base leading-none mt-0.5">{fact.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-gray-800">{fact.title}</span>
                        <span className="text-[10px] text-gray-400 font-medium px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100">
                          {fact.source}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{fact.detail}</p>
                    </div>
                    {fact.url &&
                  <ExternalLink className="h-3 w-3 text-gray-300 hover:text-blue-500 flex-shrink-0 mt-1 cursor-pointer" />
                  }
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Subsequent messages (user + agent responses) */}
          {messages.slice(1).map((msg, i) =>
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === "user" ?
              "bg-blue-600 text-white" :
              "bg-white border border-gray-200 text-gray-700"}`
              }>
              
                <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {isTyping &&
          <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          }

          {/* Validation prompt after agent response */}
          {showValidation && !isAccepted &&
          <div className="flex justify-start animate-in fade-in duration-300">
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 space-y-2">
                <p className="text-gray-600">Do you want to accept or reject this signal?</p>
                <div className="flex items-center gap-2">
                  <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3 gap-1"
                  onClick={onAccept}>
                  
                    <ThumbsUp className="h-3 w-3" />
                    Accept
                  </Button>
                  <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7 px-3 gap-1"
                  onClick={onReject}>
                  
                    <ThumbsDown className="h-3 w-3" />
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          }

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Accept / Reject bar */}
      <div className="px-4 py-2.5 border-t border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-400 italic">
            Actions execute when you accept this signal.
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className={`text-xs h-7 px-3 gap-1 ${
              isAccepted ?
              "bg-green-100 text-green-700 border border-green-200 hover:bg-green-100 cursor-default" :
              "bg-green-600 hover:bg-green-700 text-white"}`
              }
              onClick={onAccept}
              disabled={isAccepted}>
              
              <ThumbsUp className="h-3 w-3" />
              {isAccepted ? "Accepted" : "Accept"}
            </Button>
            {!isAccepted &&
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7 px-3 gap-1"
              onClick={onReject}>
              
                <ThumbsDown className="h-3 w-3" />
                Reject
              </Button>
            }
          </div>
        </div>
      </div>

      {/* Free-form input */}
      <div className="px-4 pb-3 border-t border-blue-100 pt-3">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Ask the agent anything about this signal..."
            className="flex-1 text-sm h-9 bg-white" />
          
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-9" onClick={handleSendMessage} disabled={!inputValue.trim() || isTyping}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>);

}