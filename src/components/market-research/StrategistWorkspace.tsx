import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, CheckCircle2, Loader2, Mail, MessageSquare, Users,
  ArrowLeft, Clock, Target, Send, Linkedin, Filter,
  Play, Eye, MousePointerClick, FileCheck, ChevronRight,
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

// ─── Sequence Types ─────────────────────────────────────────────────────────

interface SequenceStep {
  id: string;
  day: number;
  channel: "email" | "linkedin" | "call" | "wait";
  action: string;
  subject?: string;
  preview?: string;
  linkedinMessage?: string;
  savedToArtefacts?: boolean;
}

function generateSequence(strategy: ReturnType<typeof generateStrategy>): SequenceStep[] {
  return [
    { id: "s1", day: 1, channel: "email", action: "Opening Email", subject: `Quick question about ${strategy.angle}`, preview: `Hi {{first_name}}, noticed {{company}} is ${strategy.angle.toLowerCase()}. Wanted to share how we help similar ${strategy.persona} teams...` },
    { id: "s2", day: 1, channel: "linkedin", action: "LinkedIn Connection Request", preview: "Personalized connection request referencing their role and recent activity", linkedinMessage: `Hi {{first_name}}, I came across {{company}} and was impressed by your work as ${strategy.persona}. I noticed you're ${strategy.angle.toLowerCase()} — we help teams like yours scale faster. Would love to connect!` },
    { id: "s3", day: 3, channel: "wait", action: "Wait 2 Days", preview: "Allow time for open/reply before follow-up" },
    { id: "s4", day: 3, channel: "email", action: "Follow-up Email", subject: "Re: Quick question", preview: `Following up on my previous note. I put together a brief analysis on how ${strategy.persona} teams are approaching ${strategy.angle.toLowerCase()}...` },
    { id: "s5", day: 5, channel: "linkedin", action: "LinkedIn Message", preview: "Value-add message with industry insight", linkedinMessage: `Hey {{first_name}}, thought you'd find this interesting — we just published research on how ${strategy.persona} teams are navigating ${strategy.angle.toLowerCase()}. Happy to share the key takeaways if you're interested!` },
    { id: "s6", day: 7, channel: "email", action: "Case Study Email", subject: `How {{similar_company}} achieved 3x results`, preview: "Social proof email with relevant case study and specific metrics..." },
    { id: "s7", day: 10, channel: "linkedin", action: "LinkedIn Breakup Message", preview: "Final touchpoint with a soft close", linkedinMessage: `Hi {{first_name}}, I know you're busy scaling {{company}}. Just wanted to leave this here — if timing ever aligns for a quick chat about ${strategy.angle.toLowerCase()}, I'd love to help. Either way, wishing you all the best!` },
    { id: "s8", day: 12, channel: "email", action: "Breakup Email", subject: "Should I close the loop?", preview: "Final email with a clear CTA and easy opt-out..." },
  ];
}

// ─── Dashboard Panel ────────────────────────────────────────────────────────

const StrategistDashboard: React.FC<{
  strategy: ReturnType<typeof generateStrategy>;
  onAction: (prompt: string) => void;
  onCreateSequence: () => void;
}> = ({ strategy, onAction, onCreateSequence }) => (
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
          onClick={onCreateSequence}
        >
          <Play className="h-3.5 w-3.5" />
          Create an outreach sequence for these leads
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => onAction("Segment these leads into targeted campaign groups based on their signals, industry, and persona")}
        >
          <Filter className="h-3.5 w-3.5" />
          Segment these leads for campaigns
        </Button>
      </div>
    </Card>
  </div>
);

// ─── Sequence View ──────────────────────────────────────────────────────────

const SequenceView: React.FC<{
  steps: SequenceStep[];
  onLinkedInClick: (step: SequenceStep) => void;
  savingStepId: string | null;
}> = ({ steps, onLinkedInClick, savingStepId }) => {
  const channelConfig = {
    email: { icon: Mail, label: "Email", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800" },
    linkedin: { icon: Linkedin, label: "LinkedIn", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800" },
    call: { icon: MessageSquare, label: "Call", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" },
    wait: { icon: Clock, label: "Delay", color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border" },
  };

  return (
    <div className="flex flex-col gap-0 p-3 overflow-y-auto">
      <div className="flex items-center gap-2 mb-3">
        <Play className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Outreach Sequence</h3>
        <Badge variant="outline" className="text-[10px]">{steps.length} steps · 12 days</Badge>
      </div>

      {steps.map((step, i) => {
        const config = channelConfig[step.channel];
        const Icon = config.icon;
        const isLinkedIn = step.channel === "linkedin";
        const isSaving = savingStepId === step.id;
        const isSaved = step.savedToArtefacts;

        return (
          <div key={step.id} className="flex items-stretch gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center w-6 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${config.border} ${config.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 bg-border min-h-[8px]" />
              )}
            </div>

            {/* Step card */}
            <div
              className={`flex-1 mb-2 rounded-lg border p-2.5 transition-all ${
                isLinkedIn && !isSaved
                  ? "border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 cursor-pointer hover:shadow-sm"
                  : "border-border"
              } ${step.channel === "wait" ? "bg-muted/20" : "bg-background"}`}
              onClick={() => isLinkedIn && !isSaved && !isSaving && onLinkedInClick(step)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground">Day {step.day}</span>
                  <span className="text-xs font-semibold text-foreground">{step.action}</span>
                </div>
                {isLinkedIn && !isSaved && !isSaving && (
                  <Badge variant="outline" className="text-[9px] gap-1 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
                    <MousePointerClick className="h-2.5 w-2.5" />
                    Click to generate & save
                  </Badge>
                )}
                {isSaving && (
                  <Badge variant="outline" className="text-[9px] gap-1 text-primary">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Saving to Artefacts...
                  </Badge>
                )}
                {isSaved && (
                  <Badge variant="outline" className="text-[9px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                    <FileCheck className="h-2.5 w-2.5" />
                    Saved to Artefacts
                  </Badge>
                )}
              </div>
              {step.subject && (
                <p className="text-[11px] text-muted-foreground mb-0.5">
                  <span className="font-medium">Subject:</span> {step.subject}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground leading-relaxed">{step.preview}</p>
              {isLinkedIn && !isSaved && (
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-indigo-500 dark:text-indigo-400">
                  <Eye className="h-2.5 w-2.5" />
                  <span>Click to preview & save customized message to Artefacts</span>
                </div>
              )}
              {isSaved && (
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <ChevronRight className="h-2.5 w-2.5" />
                  <span>View in Artefacts under Signals</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

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
  const navigate = useNavigate();
  const strategy = generateStrategy(leads);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentStep, setAgentStep] = useState(-1);
  const [showSequence, setShowSequence] = useState(false);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [savingStepId, setSavingStepId] = useState<string | null>(null);

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

  const handleCreateSequence = () => {
    const steps = generateSequence(strategy);
    setSequenceSteps(steps);
    setShowSequence(true);
  };

  const handleLinkedInClick = (step: SequenceStep) => {
    if (!step.linkedinMessage || step.savedToArtefacts) return;
    setSavingStepId(step.id);

    // Simulate generating + saving
    setTimeout(() => {
      // Dispatch event to add artefact
      const artefactEvent = new CustomEvent("addArtefact", {
        detail: {
          id: `strat-li-${step.id}-${Date.now()}`,
          agentName: "Strategist",
          agentIcon: "🧭",
          agentColor: "bg-indigo-500",
          taskNumber: `STR-${new Date().getFullYear()}-${Math.floor(Math.random() * 900) + 100}`,
          timestamp: "Just now",
          status: "new",
          type: "playbook",
          actionDelegated: `Strategist, create customized LinkedIn message for outreach sequence — ${step.action}`,
          contextRationale: `Part of the outreach sequence targeting ${strategy.persona} leads based on ${strategy.basis}`,
          systemImpact: `Customized LinkedIn ${step.action.toLowerCase()} saved and ready for deployment`,
          actionPerformed: `Generated personalized LinkedIn message for ${leads.length} leads with ${strategy.angle.toLowerCase()} angle`,
          outputSummary: step.linkedinMessage || "",
          fullReport: {
            title: `LinkedIn ${step.action} — Outreach Sequence`,
            executiveSummary: `Customized LinkedIn message for ${step.action.toLowerCase()} targeting ${strategy.persona} leads. Message angle: ${strategy.angle}.`,
            keyFindings: [
              `Targeting ${leads.length} leads as ${strategy.persona}`,
              `Primary angle: ${strategy.angle}`,
              `Optimal timing window: ${strategy.timing}`,
              `Confidence level: ${strategy.confidence}`,
            ],
            analysis: step.linkedinMessage || "",
            recommendations: [
              "Personalize {{first_name}} and {{company}} placeholders before sending",
              "Send during business hours (9-11 AM recipient timezone)",
              "Follow up if no response within 48 hours",
            ],
          },
        },
      });
      window.dispatchEvent(artefactEvent);

      // Mark step as saved
      setSequenceSteps((prev) =>
        prev.map((s) => (s.id === step.id ? { ...s, savedToArtefacts: true } : s))
      );
      setSavingStepId(null);

      // Navigate to artefacts after a brief delay
      setTimeout(() => {
        navigate("/artifacts");
      }, 1200);
    }, 1500);
  };

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
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={showSequence ? () => setShowSequence(false) : onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">
            {showSequence
              ? `Outreach sequence · ${sequenceSteps.length} steps · ${leads.length} leads`
              : `Strategy workspace for ${leads.length} leads · ${opportunity || "Scout Research"}`}
          </p>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Dashboard or Sequence */}
        <div className="w-[55%] shrink-0 border-r border-border overflow-y-auto">
          {showSequence ? (
            <SequenceView
              steps={sequenceSteps}
              onLinkedInClick={handleLinkedInClick}
              savingStepId={savingStepId}
            />
          ) : (
            <StrategistDashboard
              strategy={strategy}
              onAction={handleSendChat}
              onCreateSequence={handleCreateSequence}
            />
          )}
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
