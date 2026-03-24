import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, CheckCircle2, Loader2, Mail, MessageSquare, Users,
  ArrowLeft, Sparkles, Clock, Target, Zap, Send, TrendingUp,
  BarChart3, FileText,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeadContext {
  name: string;
  company: string;
  jobTitle: string;
  email?: string;
  tenure?: string;
  source?: string;
  signals?: string[];
}

interface StrategistWorkspaceProps {
  leads: LeadContext[];
  opportunity?: string;
  icp?: string;
  triggerPrompt: string;
  onBack: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ─── Strategy Generation (for dashboard cards) ──────────────────────────────

function generateStrategy(leads: LeadContext[]) {
  const signals = leads.flatMap(l => l.signals || []);
  const hasHiring = signals.some(s => /hiring|hired/i.test(s));
  const hasFunding = signals.some(s => /funding|raised|series/i.test(s));

  const jobTitles = [...new Set(leads.map(l => l.jobTitle))];
  const persona = jobTitles.slice(0, 2).join(" / ") || "Revenue Leaders";

  const confidence = hasFunding && hasHiring ? "High" : hasFunding || hasHiring ? "Medium-High" : "Medium";
  const basis = hasHiring ? "Hiring Surge + Growth Signals" : hasFunding ? "Funding Event + Expansion" : "Market Activity Signals";
  const angle = hasHiring
    ? "Scaling infrastructure during hiring surge"
    : hasFunding
    ? "Capitalizing on post-funding growth momentum"
    : "Scaling operations during growth phase";
  const timing = hasHiring || hasFunding ? "30–60 days" : "2–4 weeks";

  return { persona, confidence, basis, angle, timing, leadCount: leads.length };
}

// ─── Strategist Agent Steps ─────────────────────────────────────────────────

const agentSteps = [
  "Strategist is analyzing lead signals",
  "Strategist is mapping messaging angles",
  "Strategist is evaluating timing windows",
  "Strategist is building recommendations",
];

// ─── Clean Response Helper ──────────────────────────────────────────────────

const cleanResponse = (content: string): string =>
  content
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/`{1,3}/g, "")
    .replace(/ +/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

// ─── Dashboard Panel ────────────────────────────────────────────────────────

const StrategistDashboard: React.FC<{
  strategy: ReturnType<typeof generateStrategy>;
  onAction: (prompt: string) => void;
}> = ({ strategy, onAction }) => (
  <div className="flex flex-col gap-3 overflow-y-auto p-3">
    {/* Context Banner */}
    <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 border border-border">
      <span className="font-medium text-foreground">{strategy.leadCount} leads</span>
      <span className="text-border">|</span>
      <span>
        Based on:{" "}
        <span className="font-medium text-foreground">{strategy.basis}</span>
      </span>
      <span className="text-border">|</span>
      <span>
        Confidence:{" "}
        <Badge
          variant="outline"
          className={`text-[10px] ml-1 ${
            strategy.confidence === "High"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
          }`}
        >
          {strategy.confidence}
        </Badge>
      </span>
    </div>

    {/* Metric Cards Row */}
    <div className="grid grid-cols-3 gap-2">
      <Card className="p-3 space-y-1 border-border">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Target Persona</span>
        </div>
        <p className="text-sm font-semibold text-foreground leading-tight">{strategy.persona}</p>
      </Card>
      <Card className="p-3 space-y-1 border-border">
        <div className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Primary Angle</span>
        </div>
        <p className="text-sm font-semibold text-foreground leading-tight">{strategy.angle}</p>
      </Card>
      <Card className="p-3 space-y-1 border-border">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Best Timing</span>
        </div>
        <p className="text-sm font-semibold text-foreground leading-tight">{strategy.timing}</p>
      </Card>
    </div>

    {/* Quick Actions */}
    <Card className="p-3 border-primary/20 bg-primary/5 space-y-2">
      <h4 className="text-xs font-semibold text-foreground">Quick Actions</h4>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => onAction("Generate email sequences for these leads based on the outreach strategy")}
        >
          <Mail className="h-3.5 w-3.5" />
          Generate Emails
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => onAction("Create LinkedIn connection messages for these leads")}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Create LinkedIn Messages
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => onAction("Customize outreach for the top-scoring leads with personalized angles")}
        >
          <Users className="h-3.5 w-3.5" />
          Customize for Top Leads
        </Button>
      </div>
    </Card>

  </div>
);

// ─── Chat Panel ─────────────────────────────────────────────────────────────

const StrategistChat: React.FC<{
  messages: ChatMessage[];
  isLoading: boolean;
  agentStep: number;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
}> = ({ messages, isLoading, agentStep, input, onInputChange, onSend }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentStep]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Chat header */}
      <div className="px-3 py-2 border-b bg-muted/20 flex items-center gap-2 shrink-0">
        <MessageSquare className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Chat with Strategist</span>
        {isLoading && (
          <div className="ml-auto flex items-center gap-1 text-primary text-[11px]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <MessageSquare className="h-7 w-7 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground">
                Ask Strategist to refine angles, generate copy, or customize outreach.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] rounded-lg p-2.5 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 border border-border"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Bot className="h-3 w-3 text-primary" />
                  <span className="text-[11px] font-semibold text-primary">Strategist</span>
                </div>
              )}
              <div className="text-sm whitespace-pre-line leading-relaxed">{msg.content}</div>
              <div className="text-[10px] mt-1 opacity-50">{msg.timestamp}</div>
            </div>
          </div>
        ))}

        {isLoading && agentStep >= 0 && (
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border">
            {agentSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {i < agentStep ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : i === agentStep ? (
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
                )}
                <span className={i <= agentStep ? "text-foreground" : "text-muted-foreground"}>{step}</span>
              </div>
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t p-2 flex gap-2 shrink-0 bg-muted/10">
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask Strategist..."
          className="resize-none text-sm min-h-[40px]"
          rows={2}
          disabled={isLoading}
        />
        <Button
          onClick={onSend}
          className="self-end"
          size="sm"
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const StrategistWorkspace: React.FC<StrategistWorkspaceProps> = ({
  leads,
  opportunity,
  icp,
  triggerPrompt,
  onBack,
}) => {
  const strategy = generateStrategy(leads);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentStep, setAgentStep] = useState(-1);

  // Simulate agent steps during loading
  useEffect(() => {
    if (!isLoading) {
      setAgentStep(-1);
      return;
    }
    setAgentStep(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    agentSteps.forEach((_, i) => {
      if (i > 0) timers.push(setTimeout(() => setAgentStep(i), i * 1100));
    });
    return () => timers.forEach(clearTimeout);
  }, [isLoading]);

  const handleSendChat = async (overrideText?: string) => {
    const text = overrideText || chatInput;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setChatInput("");
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://backend-11kr.onrender.com/chat/?question=${encodeURIComponent(text)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const raw = data.response || data.message || "I'm having trouble right now.";

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanResponse(raw), timestamp: new Date().toLocaleTimeString() },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again.", timestamp: new Date().toLocaleTimeString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted/30 p-3 border-b flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">
            Strategy workspace for {leads.length} leads · {opportunity || "Scout Research"}
          </p>
        </div>
      </div>

      {/* Two-panel layout: Dashboard + Chat */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Dashboard */}
        <div className="w-[55%] shrink-0 border-r border-border overflow-y-auto">
          <StrategistDashboard strategy={strategy} onAction={handleSendChat} />
        </div>

        {/* Right: Chat with Strategist */}
        <div className="flex-1 min-w-0">
          <StrategistChat
            messages={chatMessages}
            isLoading={isLoading}
            agentStep={agentStep}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={() => handleSendChat()}
          />
        </div>
      </div>
    </div>
  );
};

export default StrategistWorkspace;
