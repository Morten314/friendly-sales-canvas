import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare, Send, Loader2, Bot, Sparkles, Download, Upload, ArrowRight,
  Search, TrendingUp, Users, Newspaper, Zap, Target, FileText, CheckCircle2,
  User, Building2, Clock, Activity, ChevronDown, Plus,
} from "lucide-react";


// ─── Expandable Trait Item ──────────────────────────────────────────────────

const ExpandableTraitItem: React.FC<{ label: string; value: string; isLong: boolean }> = ({ label, value, isLong }) => {
  const [expanded, setExpanded] = useState(false);

  if (!isLong) {
    return (
      <div className="flex items-baseline gap-1 text-[11px] min-w-0">
        <span className="text-muted-foreground shrink-0 font-medium">{label}:</span>
        <span className="text-foreground">{value}</span>
      </div>
    );
  }

  return (
    <div className="text-[11px] min-w-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 w-full text-left group"
      >
        <span className="text-muted-foreground shrink-0 font-medium">{label}:</span>
        <span className={`text-foreground flex-1 ${expanded ? '' : 'line-clamp-1'}`}>
          {value}
        </span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  structuredActions?: { label: string; icon: React.ReactNode }[];
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
}

interface LeadContext {
  name: string;
  company: string;
  jobTitle: string;
  email?: string;
  tenure?: string;
  source?: string;
  signals?: string[];
}

interface ScoutResearchContext {
  leads: LeadContext[];
  opportunity?: string;
  icp?: string;
  reportTraits?: string[];
}

type ScoutMode = "selected-leads" | "full-list";

interface ChatWithScoutProps {
  fullPage?: boolean;
  researchContext?: ScoutResearchContext | null;
  mode?: ScoutMode;
}

// ─── Agent Step Indicators ───────────────────────────────────────────────────

const agentSteps = [
  "Scout is analyzing companies",
  "Scout is scanning hiring signals",
  "Scout is checking LinkedIn profiles",
  "Scout is evaluating ICP fit",
  "Scout is generating insights",
];

const AgentStepIndicator = ({ currentStep }: { currentStep: number }) => (
  <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
    {agentSteps.map((step, i) => (
      <div key={i} className="flex items-center gap-2.5 text-sm">
        {i < currentStep ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        ) : i === currentStep ? (
          <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
        ) : (
          <div className="h-4 w-4 rounded-full border border-border shrink-0" />
        )}
        <span className={i <= currentStep ? "text-foreground" : "text-muted-foreground"}>
          {step}
        </span>
      </div>
    ))}
  </div>
);

// ─── Suggested Action Buttons ────────────────────────────────────────────────

interface SuggestedAction {
  label: string;
  prompt: string;
  icon: React.ReactNode;
}

// ─── Lead-specific prompts (exact questions) ─────────────────────────────────

const singleLeadActions: SuggestedAction[] = [
  { label: "Is this prospect a decision maker?", prompt: "Is this prospect a decision maker in this company?", icon: <Users className="h-3.5 w-3.5" /> },
  { label: "Best person to contact, or reach someone else?", prompt: "Is this the best person to contact, or should we reach someone else?", icon: <Target className="h-3.5 w-3.5" /> },
  { label: "How long in their current role?", prompt: "How long has this person been in their current role?", icon: <Clock className="h-3.5 w-3.5" /> },
  { label: "Recently promoted or newly hired?", prompt: "Was this prospect recently promoted or newly hired?", icon: <Zap className="h-3.5 w-3.5" /> },
  { label: "What roles before this position?", prompt: "What roles did they hold before this position?", icon: <FileText className="h-3.5 w-3.5" /> },
  { label: "Summarize recent LinkedIn activity", prompt: "Summarize this prospect's recent LinkedIn activity.", icon: <Activity className="h-3.5 w-3.5" /> },
  { label: "Signals company needs our solution?", prompt: "What signals suggest this company might need our solution?", icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

interface PromptCategory {
  category: string;
  icon: React.ReactNode;
  actions: SuggestedAction[];
  strategistLinked?: boolean;
}

const categorizedPrompts: PromptCategory[] = [
  {
    category: "What is happening?",
    icon: <Search className="h-3.5 w-3.5" />,
    actions: [
      { label: "What patterns do you see across these leads?", prompt: "What patterns do you see across these leads?", icon: <Search className="h-3.5 w-3.5" /> },
      { label: "What signals are most common among these companies?", prompt: "What signals are most common among these companies?", icon: <Activity className="h-3.5 w-3.5" /> },
      { label: "What stage are these companies currently in?", prompt: "What stage are these companies currently in?", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    ],
  },
  {
    category: "Why does it matter?",
    icon: <Target className="h-3.5 w-3.5" />,
    actions: [
      { label: "Which of these signals indicate strong buying intent?", prompt: "Which of these signals indicate strong buying intent?", icon: <Zap className="h-3.5 w-3.5" /> },
      { label: "Which leads matter the most, and why?", prompt: "Which leads matter the most, and why?", icon: <Users className="h-3.5 w-3.5" /> },
    ],
  },
  {
    category: "What should I do?",
    icon: <FileText className="h-3.5 w-3.5" />,
    strategistLinked: true,
    actions: [
      { label: "Suggest outreach angles for the top accounts", prompt: "Suggest outreach angles for the top accounts", icon: <Target className="h-3.5 w-3.5" /> },
      { label: "How should we approach these companies?", prompt: "How should we approach these companies?", icon: <ArrowRight className="h-3.5 w-3.5" /> },
    ],
  },
];

// ─── Clean Response Helper ───────────────────────────────────────────────────

const cleanResponseContent = (content: string): string => {
  return content
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/[•◦▪▫■□●○]/g, '-')
    .replace(/ +/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
};

// ─── Prospect Summary Card (left panel for single lead) ─────────────────────

const ProspectSummaryCard = ({ lead, opportunity }: { lead: LeadContext; opportunity?: string }) => (
  <Card className="p-3 space-y-2 bg-muted/20 border-border overflow-y-auto max-h-[180px] shrink-0">
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <User className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <h3 className="text-xs font-semibold text-foreground leading-tight truncate">{lead.name}</h3>
        <p className="text-[11px] text-muted-foreground truncate">{lead.jobTitle}</p>
      </div>
    </div>

    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">Company</span>
        <span className="ml-auto text-foreground font-medium">{lead.company}</span>
      </div>
      {lead.tenure && (
        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Tenure</span>
          <span className="ml-auto text-foreground font-medium">{lead.tenure}</span>
        </div>
      )}
      {lead.source && (
        <div className="flex items-center gap-2 text-xs">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Source</span>
          <Badge variant="outline" className={`ml-auto text-[10px] font-medium ${lead.source === "HubSpot" ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800" : "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800"}`}>
            {lead.source}
          </Badge>
        </div>
      )}
      {opportunity && (
        <div className="flex items-center gap-2 text-xs">
          <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Report</span>
          <Badge variant="outline" className="ml-auto text-[10px] bg-primary/5 text-primary border-primary/20">
            {opportunity}
          </Badge>
        </div>
      )}
    </div>

    {lead.signals && lead.signals.length > 0 && (
      <div className="pt-3 border-t border-border space-y-2">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Signals</span>
        </div>
        <div className="space-y-1.5">
          {lead.signals.map((signal, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
              {signal}
            </div>
          ))}
        </div>
      </div>
    )}
  </Card>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export function ChatWithScout({ fullPage = false, researchContext, mode = "selected-leads" }: ChatWithScoutProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentStep, setAgentStep] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSingleLead = mode === "selected-leads" && researchContext?.leads.length === 1;
  const primaryActions = isSingleLead ? singleLeadActions : categorizedPrompts.flatMap(c => c.actions);
  const useCategorized = !isSingleLead;

  const hasConversations = conversations.length > 0;

  // Get messages for active conversation
  const activeMessages = activeConversationId
    ? conversations.find(c => c.id === activeConversationId)?.messages || []
    : messages;

  // Build initial message based on context
  useEffect(() => {
    if (researchContext && researchContext.leads.length === 1) {
      setMessages([{
        role: "assistant",
        content: `I've loaded full context on ${researchContext.leads[0].name}. What would you like to know?`,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } else if (researchContext?.opportunity === "Leads Coverage Analysis") {
      setMessages([{
        role: "assistant",
        content: `I've loaded your Leads Coverage data — 74 out of 120 leads are matched across all Scout report sections (62% coverage).\n\nHere are a few things we can explore together:\n\n• Do you think the 62% match rate reflects your actual pipeline potential, or should we adjust the criteria?\n• Are there specific industries or segments where you'd expect higher or lower coverage?\n• Would you like me to break down which report sections are contributing the most matched leads?\n\nFeel free to share any intel — I'll factor it into the analysis.`,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } else {
      setMessages([]);
    }
    // Reset conversations when context changes
    setConversations([]);
    setActiveConversationId(null);
  }, [researchContext, mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, agentStep]);

  // Simulate agent steps during loading
  useEffect(() => {
    if (!isLoading) { setAgentStep(-1); return; }
    setAgentStep(0);
    const intervals: ReturnType<typeof setTimeout>[] = [];
    agentSteps.forEach((_, i) => {
      if (i > 0) {
        intervals.push(setTimeout(() => setAgentStep(i), i * 1200));
      }
    });
    return () => intervals.forEach(clearTimeout);
  }, [isLoading]);

  const addMessageToConversation = (convId: string, message: ChatMessage) => {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, messages: [...c.messages, message] } : c
    ));
  };

  // Check if prompt should trigger Strategist handoff
  const isStrategistPrompt = (text: string) => {
    const strategistKeywords = [
      "outreach angles",
      "outreach angle",
      "create outreach angle",
      "approach these",
      "how should we approach",
      "outreach strategy",
    ];
    return strategistKeywords.some(kw => text.toLowerCase().includes(kw));
  };

  const handleSendMessage = async (
    messageText?: string,
    options?: { forceStrategist?: boolean }
  ) => {
    const text = messageText || input;
    if (!text.trim() || isLoading) return;

    // Strategist handoff for bulk leads — navigate to Strategist page
    if (!isSingleLead && (options?.forceStrategist || isStrategistPrompt(text))) {
      // Store context in sessionStorage for Strategist to pick up
      sessionStorage.setItem('strategistContext', JSON.stringify({
        leads: researchContext?.leads || [],
        opportunity: researchContext?.opportunity,
        icp: researchContext?.icp,
        triggerPrompt: text,
      }));
      navigate('/deals');
      if (!messageText) setInput("");
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };

    // If no active conversation, create one (for bulk mode)
    let targetConvId = activeConversationId;
    if (!isSingleLead && !targetConvId) {
      const newConv: Conversation = {
        id: `conv-${Date.now()}`,
        title: text.length > 50 ? text.substring(0, 50) + '...' : text,
        messages: [userMessage],
        createdAt: new Date(),
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      targetConvId = newConv.id;
    } else if (targetConvId) {
      addMessageToConversation(targetConvId, userMessage);
    } else {
      setMessages(prev => [...prev, userMessage]);
    }

    if (!messageText) setInput("");
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`https://backend-11kr.onrender.com/chat/?question=${encodeURIComponent(text)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const rawContent = data.response || data.message || "I'm having trouble processing your request right now.";
      const cleanedContent = cleanResponseContent(rawContent);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: cleanedContent,
        timestamp: new Date().toLocaleTimeString(),
        structuredActions: [
          { label: "Add to Campaign", icon: <Target className="h-3 w-3" /> },
          { label: "Export Leads", icon: <Download className="h-3 w-3" /> },
          { label: "Send to CRM", icon: <Upload className="h-3 w-3" /> },
        ],
      };

      if (targetConvId) {
        addMessageToConversation(targetConvId, assistantMessage);
      } else {
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error calling API:', error);
      const errMsg: ChatMessage = {
        role: "assistant",
        content: "I'm sorry, I'm having trouble connecting right now. Please try again.",
        timestamp: new Date().toLocaleTimeString(),
      };
      if (targetConvId) {
        addMessageToConversation(targetConvId, errMsg);
      } else {
        setMessages(prev => [...prev, errMsg]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const hasContext = researchContext && researchContext.leads.length > 0;

  // Strategist is now handled by parent via onActivateStrategist prop

  // ─── Single Lead: Two-panel layout ─────────────────────────────────────────
  if (isSingleLead && researchContext) {
    const lead = researchContext.leads[0];
    return (
      <div className={`flex gap-4 ${fullPage ? 'flex-1 h-full min-h-[28rem]' : 'h-[80vh]'}`}>
        {/* Left: Prospect Summary + Suggested Questions */}
        <div className="w-[300px] shrink-0 flex flex-col gap-3 overflow-hidden">
          <ProspectSummaryCard lead={lead} opportunity={researchContext.opportunity} />

          {/* Suggested Questions */}
          <Card className="p-3 space-y-1.5 flex-1 overflow-y-auto bg-muted/20 border-border">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider pb-1">Suggested Questions</p>
            <div className="space-y-0.5">
              {primaryActions.map((action) => (
                <button
                  key={action.label}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-foreground rounded-md hover:bg-primary/5 hover:text-primary transition-colors text-left group disabled:opacity-50"
                  onClick={() => handleSendMessage(action.prompt)}
                  disabled={isLoading}
                >
                  <span className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">{action.icon}</span>
                  <span className="flex-1">{action.label}</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Chat (full space) */}
        <div className="flex-1 bg-background border rounded-lg overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-muted/30 p-3 border-b flex items-center gap-2 shrink-0">
            <div className="p-1.5 rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">Scout Agent Workspace</h3>
              <p className="text-[11px] text-muted-foreground">Researching {lead.name} · {lead.company}</p>
            </div>
            {isLoading && (
              <div className="ml-auto flex items-center gap-1 text-primary text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Working...
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 border border-border"
                }`}>
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary">Scout</span>
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-line leading-relaxed">{message.content}</div>

                  {message.structuredActions && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                      {message.structuredActions.map((action, i) => (
                        <Button key={i} variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                          {action.icon}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] mt-1.5 opacity-60">{message.timestamp}</div>
                </div>
              </div>
            ))}

            {isLoading && agentStep >= 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%]">
                  <AgentStepIndicator currentStep={agentStep} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3 flex gap-2 shrink-0 bg-muted/10">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={`Ask Scout about ${lead.name}...`}
              className="resize-none text-sm min-h-[44px]"
              rows={2}
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSendMessage()}
              className="self-end"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Default layout (multi-lead or no context) ─────────────────────────────

  const hasBulkContext = hasContext && !isSingleLead;
  const reportTraits = researchContext?.reportTraits || [];
  const leadCount = researchContext?.leads.length || 0;

  return (
    <div className={`bg-background border rounded-lg overflow-hidden flex flex-col ${fullPage ? 'flex-1 h-full min-h-0' : 'h-[80vh]'}`}>
      {/* Header */}
      <div className="bg-muted/30 p-3 border-b flex items-center gap-2 shrink-0">
        <div className="p-1.5 rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-foreground">Scout Agent Workspace</h3>
          <p className="text-[11px] text-muted-foreground">AI-powered lead research & intelligence</p>
        </div>
        {isLoading && (
          <div className="ml-auto flex items-center gap-1 text-primary text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Working...
          </div>
        )}
      </div>

      {/* Zone 1: Report Context Card (bulk leads only) */}
      {hasBulkContext && (
        <div className="px-4 pt-3 pb-1 shrink-0">
          <Card className="p-3 bg-primary/5 border-primary/20 space-y-2 max-h-[140px] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-3 w-3 text-primary" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground leading-tight">
                    {researchContext?.opportunity || "Market Intelligence Context"}
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
                    {leadCount} matched leads · {researchContext?.icp || "ICP Profile"}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20 shrink-0">
                Report Context
              </Badge>
            </div>
            {reportTraits.length > 0 && (
              <div className="grid grid-cols-1 gap-y-1 pt-1">
                {reportTraits.filter(t => !t.startsWith("Matched Report:")).map((trait, i) => {
                  const [label, ...rest] = trait.split(": ");
                  const value = rest.join(": ");
                  const isLong = value.length > 60;
                  return (
                    <ExpandableTraitItem key={i} label={label} value={value} isLong={isLong} />
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Zone 2: Suggested Prompts */}
      <div className="px-4 py-2 border-b shrink-0 space-y-2 max-h-[160px] overflow-y-auto">
        {useCategorized ? (
          <div className="space-y-2">
            {categorizedPrompts.map((cat) => (
              <div key={cat.category} className="flex items-start gap-2">
                <div className="flex items-center gap-1 shrink-0 pt-1">
                  <span className="text-muted-foreground">{cat.icon}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-[120px]">
                    {cat.category}
                    {cat.strategistLinked && (
                      <span className="ml-1 text-primary normal-case tracking-normal font-medium text-[10px]">
                        → Strategist
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cat.actions.map((action) => (
                    <Button
                      key={action.label}
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 gap-1 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
                      onClick={() => handleSendMessage(action.prompt, { forceStrategist: !!cat.strategistLinked })}
                      disabled={isLoading}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Suggested Questions</p>
            <div className="flex flex-wrap gap-1.5">
              {primaryActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1.5 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
                  onClick={() => handleSendMessage(action.prompt)}
                  disabled={isLoading}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Zone 3: Chat area with history sidebar */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Conversation History Sidebar (ChatGPT-style) */}
        {hasConversations && (
          <div className="w-[200px] shrink-0 border-r border-border bg-muted/20 flex flex-col">
            <div className="p-2 border-b border-border flex items-center justify-between shrink-0">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">History</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={startNewConversation}
                title="New chat"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-1.5 space-y-0.5">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors truncate flex items-center gap-2 ${
                      activeConversationId === conv.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    <span className="truncate">{conv.title}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Right: Active conversation or empty state */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {activeMessages.length === 0 && !isLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <Bot className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    {hasBulkContext 
                      ? "Select a prompt above or type below to start chatting with Scout."
                      : "Ask Scout anything about your market."}
                  </p>
                </div>
              </div>
            )}

            {activeMessages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 border border-border"
                }`}>
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary">Scout</span>
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-line leading-relaxed">{message.content}</div>
                  
                  {message.structuredActions && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                      {message.structuredActions.map((action, i) => (
                        <Button key={i} variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                          {action.icon}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-[10px] mt-1.5 opacity-60">{message.timestamp}</div>
                </div>
              </div>
            ))}

            {isLoading && agentStep >= 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%]">
                  <AgentStepIndicator currentStep={agentStep} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t p-3 flex gap-2 shrink-0 bg-muted/10">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={hasBulkContext ? "Select a prompt or type here to start chatting with Scout..." : "Ask Scout anything about your market..."}
              className="resize-none text-sm min-h-[44px]"
              rows={2}
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSendMessage()}
              className="self-end"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
