import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Send, Loader2, Bot, Sparkles, Download, Upload, ArrowRight,
  Search, TrendingUp, Users, Newspaper, Zap, Target, FileText, CheckCircle2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  structuredActions?: { label: string; icon: React.ReactNode }[];
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

// ─── Lead-specific prompts (shown when researching a single lead) ────────────

const singleLeadActions: SuggestedAction[] = [
  { label: "Is this a decision maker?", prompt: "Is this prospect a decision maker in this company? What's their buying authority?", icon: <Users className="h-3.5 w-3.5" /> },
  { label: "Best person to contact?", prompt: "Is this the best person to contact at this company, or should we reach someone else? Who else is in the buying committee?", icon: <Target className="h-3.5 w-3.5" /> },
  { label: "Role tenure & history", prompt: "How long has this person been in their current role? What roles did they hold before this position?", icon: <FileText className="h-3.5 w-3.5" /> },
  { label: "Recently promoted or hired?", prompt: "Was this prospect recently promoted or newly hired? What does that signal for our outreach timing?", icon: <Zap className="h-3.5 w-3.5" /> },
  { label: "LinkedIn activity summary", prompt: "Summarize this prospect's recent LinkedIn activity. What topics are they engaging with?", icon: <Newspaper className="h-3.5 w-3.5" /> },
  { label: "Company buying signals", prompt: "What signals suggest this company might need our solution right now?", icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

const singleLeadSecondaryActions: SuggestedAction[] = [
  { label: "Write personalized outreach", prompt: "Write a personalized outreach message for this prospect based on their role, company context, and recent signals.", icon: <FileText className="h-3.5 w-3.5" /> },
  { label: "Find mutual connections", prompt: "Find any mutual connections or shared interests that could warm up this outreach.", icon: <Users className="h-3.5 w-3.5" /> },
  { label: "Competitive tools they use", prompt: "What competitive tools or solutions is this company currently using that we could displace?", icon: <Search className="h-3.5 w-3.5" /> },
  { label: "Meeting prep brief", prompt: "Create a meeting preparation brief for a call with this prospect. Include talking points, potential objections, and value props.", icon: <Sparkles className="h-3.5 w-3.5" /> },
];

const leadPrimaryActions: SuggestedAction[] = [
  { label: "Research these companies", prompt: "Research these companies and give me a summary of what each one does, their recent news, and their market position.", icon: <Search className="h-3.5 w-3.5" /> },
  { label: "Find buying signals", prompt: "Find buying signals for these leads. Look for recent funding, hiring surges, technology changes, and expansion plans.", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { label: "Identify decision makers", prompt: "Identify the key decision makers at these companies. Who are the budget holders and influencers?", icon: <Users className="h-3.5 w-3.5" /> },
  { label: "Check recent company news", prompt: "Check recent company news for these leads. Any press releases, product launches, or market moves?", icon: <Newspaper className="h-3.5 w-3.5" /> },
  { label: "Score leads by urgency", prompt: "Score these leads by urgency. Which ones are most likely to buy in the next 30 days?", icon: <Zap className="h-3.5 w-3.5" /> },
  { label: "Write outreach strategy", prompt: "Write a personalized outreach strategy for these leads based on their company context and buying signals.", icon: <FileText className="h-3.5 w-3.5" /> },
];

const leadSecondaryActions: SuggestedAction[] = [
  { label: "Enrich LinkedIn profiles", prompt: "Enrich LinkedIn profiles for these leads. Pull their recent activity, shared content, and career history.", icon: <Users className="h-3.5 w-3.5" /> },
  { label: "Find company tech stack", prompt: "Find the technology stack used by these companies. What tools and platforms are they running?", icon: <Target className="h-3.5 w-3.5" /> },
  { label: "Analyze hiring trends", prompt: "Analyze hiring trends at these companies. What roles are they hiring for and what does it signal?", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { label: "Check funding activity", prompt: "Check funding activity for these companies. Any recent rounds, acquisitions, or financial events?", icon: <Sparkles className="h-3.5 w-3.5" /> },
];

const listPrimaryActions: SuggestedAction[] = [
  { label: "Analyze full prospect list", prompt: "Analyze my entire prospect list. Give me a summary of the industries, company sizes, and roles represented.", icon: <Search className="h-3.5 w-3.5" /> },
  { label: "Score & prioritize all leads", prompt: "Score and prioritize all leads in my list. Rank them by likelihood to convert in the next 30 days.", icon: <Zap className="h-3.5 w-3.5" /> },
  { label: "Find common patterns", prompt: "Find common patterns across my prospect list. What industries, roles, and company sizes appear most often?", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { label: "Build outreach sequences", prompt: "Build personalized outreach sequences for my entire prospect list, grouped by ICP match and lead score.", icon: <FileText className="h-3.5 w-3.5" /> },
  { label: "Identify top 10 accounts", prompt: "Identify the top 10 accounts from my full list that I should focus on this week and explain why.", icon: <Target className="h-3.5 w-3.5" /> },
  { label: "Map buying committees", prompt: "Map the buying committees across all companies in my prospect list. Who are the decision makers, champions, and influencers?", icon: <Users className="h-3.5 w-3.5" /> },
];

const listSecondaryActions: SuggestedAction[] = [
  { label: "Segment by ICP fit", prompt: "Segment my entire prospect list by ICP fit. Group them into High, Medium, and Low tiers with reasoning.", icon: <Target className="h-3.5 w-3.5" /> },
  { label: "Batch enrich all leads", prompt: "Batch enrich all leads in my list. Pull LinkedIn data, company info, and recent activity for everyone.", icon: <Users className="h-3.5 w-3.5" /> },
  { label: "Competitive displacement opps", prompt: "Find competitive displacement opportunities across my prospect list. Which companies are using competitor products that we can win?", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { label: "Weekly pipeline summary", prompt: "Generate a weekly pipeline summary for my full prospect list. What changed, who moved stages, and where should I focus?", icon: <Newspaper className="h-3.5 w-3.5" /> },
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

// ─── Main Component ──────────────────────────────────────────────────────────

export function ChatWithScout({ fullPage = false, researchContext, mode = "selected-leads" }: ChatWithScoutProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentStep, setAgentStep] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSingleLead = mode === "selected-leads" && researchContext?.leads.length === 1;
  const primaryActions = isSingleLead ? singleLeadActions : mode === "full-list" ? listPrimaryActions : leadPrimaryActions;
  const secondaryActions = isSingleLead ? singleLeadSecondaryActions : mode === "full-list" ? listSecondaryActions : leadSecondaryActions;

  // Build initial message based on context
  useEffect(() => {
    if (mode === "full-list" && researchContext && researchContext.leads.length > 0) {
      const leadCount = researchContext.leads.length;
      const icpText = researchContext.icp ? `\nICP: ${researchContext.icp}` : "";
      setMessages([{
        role: "assistant",
        content: `You have ${leadCount} leads in your prospect list.${icpText}\n\nI can analyze your full list, prioritize accounts, build outreach sequences, and more. Choose an action above or ask me anything.`,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } else if (researchContext && researchContext.leads.length === 1) {
      // Single lead: auto-generate prospect summary
      const lead = researchContext.leads[0];
      const signalsText = lead.signals && lead.signals.length > 0
        ? `\n\nSignals\n${lead.signals.map(s => `• ${s}`).join('\n')}`
        : "";
      const opportunityText = researchContext.opportunity ? `\nMatched Report: ${researchContext.opportunity}` : "";

      setMessages([{
        role: "assistant",
        content: `Prospect Summary\n\nName: ${lead.name}\nRole: ${lead.jobTitle}\nCompany: ${lead.company}${lead.tenure ? `\nTenure: ${lead.tenure}` : ""}${lead.source ? `\nSource: ${lead.source}` : ""}${opportunityText}${signalsText}\n\nI've loaded full context on this prospect. Choose an action below or ask me anything.`,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } else if (researchContext && researchContext.leads.length > 0) {
      const leadCount = researchContext.leads.length;
      const leadNames = researchContext.leads.slice(0, 3).map(l => `${l.name} (${l.company})`).join(", ");
      const moreText = leadCount > 3 ? ` and ${leadCount - 3} more` : "";
      const opportunityText = researchContext.opportunity ? `\nOpportunity: ${researchContext.opportunity}` : "";
      const icpText = researchContext.icp ? `\nICP: ${researchContext.icp}` : "";

      setMessages([{
        role: "assistant",
        content: `You are researching ${leadCount} lead${leadCount > 1 ? 's' : ''} from the Lead Stream:\n${leadNames}${moreText}${opportunityText}${icpText}\n\nI already have context on these leads and their companies. Choose a suggested action above or ask me anything.`,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } else {
      setMessages([{
        role: "assistant",
        content: "Hi! I'm Scout, your AI research assistant. Select leads from the Lead Stream and click \"Research with Scout\" to start, or ask me anything about your market.",
        timestamp: new Date().toLocaleTimeString(),
      }]);
    }
  }, [researchContext, mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentStep]);

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

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!messageText) setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`https://backend-11kr.onrender.com/chat/?question=${encodeURIComponent(text)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

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

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling API:', error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "I'm sorry, I'm having trouble connecting right now. Please try again.",
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const hasContext = researchContext && researchContext.leads.length > 0;

  return (
    <div className={`bg-background border rounded-lg overflow-hidden flex flex-col ${fullPage ? 'flex-1 h-full min-h-[28rem]' : 'h-[80vh]'}`}>
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

      {/* Context Banner */}
      {hasContext && (
        <div className="bg-primary/5 border-b border-primary/10 px-4 py-2 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-foreground font-medium">
              {researchContext!.leads.length} leads loaded
            </span>
            {researchContext!.opportunity && (
              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                {researchContext!.opportunity}
              </Badge>
            )}
            {researchContext!.icp && (
              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                {researchContext!.icp}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Suggested Actions */}
      {messages.length <= 1 && (
        <div className="p-4 border-b shrink-0 space-y-3 max-h-[220px] overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent Workflows</p>
          <div className="flex flex-wrap gap-2">
            {primaryActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
                onClick={() => handleSendMessage(action.prompt)}
                disabled={isLoading}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {secondaryActions.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-primary"
                onClick={() => handleSendMessage(action.prompt)}
                disabled={isLoading}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg p-3 ${
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : index === 0
                  ? "bg-primary/5 border border-primary/20"
                  : "bg-muted/50 border border-border"
            }`}>
              {message.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Bot className={`h-3.5 w-3.5 text-primary ${index === 0 ? '' : ''}`} />
                  <span className="text-xs font-semibold text-primary">Scout</span>
                </div>
              )}
              <div className={`text-sm whitespace-pre-line leading-relaxed ${index === 0 && message.role === "assistant" ? "text-foreground font-medium" : ""}`}>{message.content}</div>
              
              {/* Structured action buttons on assistant messages */}
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

        {/* Agent Step Indicator while loading */}
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
          placeholder={hasContext ? "Ask Scout about these leads..." : "Ask Scout anything about your market..."}
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
  );
}
