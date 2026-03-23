import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot, CheckCircle2, Loader2, Mail, MessageSquare, Users,
  ArrowLeft, Sparkles, Clock, Target, Zap, ChevronRight,
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

// ─── Thinking Steps ──────────────────────────────────────────────────────────

const thinkingSteps = [
  "Analyzing lead signals across dataset",
  "Identifying common pain points",
  "Mapping messaging angles",
  "Designing outreach sequence",
  "Finalizing strategy recommendations",
];

// ─── Mock Strategy Generation ────────────────────────────────────────────────

function generateStrategy(leads: LeadContext[], icp?: string) {
  const signals = leads.flatMap(l => l.signals || []);
  const hasHiring = signals.some(s => s.toLowerCase().includes("hiring") || s.toLowerCase().includes("hired"));
  const hasFunding = signals.some(s => s.toLowerCase().includes("funding") || s.toLowerCase().includes("raised") || s.toLowerCase().includes("series"));
  const hasGrowth = signals.some(s => s.toLowerCase().includes("growth") || s.toLowerCase().includes("scaling") || s.toLowerCase().includes("expanding"));

  const jobTitles = [...new Set(leads.map(l => l.jobTitle))];
  const targetPersona = jobTitles.slice(0, 2).join(" / ") || "Revenue Leaders";

  let primaryAngle = "Scaling operations efficiently during growth phase";
  let supportingAngles = [
    "Reducing operational bottlenecks",
    "Improving team productivity",
    "Managing complexity at scale",
  ];

  if (hasHiring) {
    primaryAngle = "Scaling infrastructure efficiently during hiring surge";
    supportingAngles = [
      "Reducing onboarding friction for new hires",
      "Improving team velocity during rapid growth",
      "Managing process complexity with growing teams",
    ];
  }

  let whyItWorks = [
    "Signal patterns indicate active evaluation phase",
    "Role tenure suggests readiness for new initiatives",
    "Company growth trajectory aligns with solution value",
  ];

  if (hasHiring) whyItWorks[0] = "Hiring surge indicates scaling pressure and budget allocation";
  if (hasFunding) whyItWorks.push("Recent funding suggests budget availability for new tools");
  if (hasGrowth) whyItWorks.push("Growth trajectory creates urgency for operational efficiency");

  const confidence = hasFunding && hasHiring ? "High" : hasFunding || hasHiring ? "Medium-High" : "Medium";
  const basis = hasHiring ? "Hiring Surge + Growth Signals" : hasFunding ? "Funding Event + Expansion" : "Market Activity Signals";

  return {
    targetPersona,
    primaryAngle,
    supportingAngles,
    whyItWorks,
    confidence,
    basis,
    timing: {
      window: hasHiring || hasFunding ? "Within 30–60 days of signal event" : "Within 2–4 weeks of engagement signal",
      reason: hasHiring
        ? "Teams actively evaluate new tools during rapid onboarding"
        : "Decision makers are most receptive during active evaluation cycles",
    },
    sequence: [
      { day: "Day 1", action: "Insight-led email", description: "Reference specific signal (hiring, funding, etc.)" },
      { day: "Day 3", action: "LinkedIn connection", description: "Personalized note referencing shared context" },
      { day: "Day 5", action: "Follow-up email", description: "Share relevant case study or data point" },
      { day: "Day 8", action: "Value-based message", description: "Focus on specific pain point resolution" },
      { day: "Day 12", action: "Breakup email", description: "Graceful close with door open" },
    ],
    messageDirection: {
      hook: hasHiring
        ? `"Noticed your team is scaling ${jobTitles[0]?.toLowerCase().includes("engineering") ? "engineering" : "go-to-market"} hiring..."`
        : hasFunding
        ? `"Following your recent funding round..."`
        : `"Seeing some interesting growth signals from your team..."`,
      coreMessage: `Focus on ${primaryAngle.toLowerCase()} and reducing operational complexity`,
    },
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

const StrategistWorkspace: React.FC<StrategistWorkspaceProps> = ({
  leads,
  opportunity,
  icp,
  triggerPrompt,
  onBack,
}) => {
  const [phase, setPhase] = useState<"thinking" | "complete">("thinking");
  const [currentStep, setCurrentStep] = useState(0);
  const [strategy, setStrategy] = useState<ReturnType<typeof generateStrategy> | null>(null);

  // Simulate thinking steps
  useEffect(() => {
    if (phase !== "thinking") return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    thinkingSteps.forEach((_, i) => {
      if (i > 0) {
        timers.push(setTimeout(() => setCurrentStep(i), i * 1100));
      }
    });

    // Complete after all steps
    timers.push(
      setTimeout(() => {
        setStrategy(generateStrategy(leads, icp));
        setPhase("complete");
      }, thinkingSteps.length * 1100 + 400)
    );

    return () => timers.forEach(clearTimeout);
  }, [phase, leads, icp]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background border rounded-lg overflow-hidden">
      {/* Header — Strategist activated */}
      <div className="bg-muted/30 p-3 border-b flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="p-1.5 rounded-full bg-accent/20">
          <Sparkles className="h-4 w-4 text-accent-foreground" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-foreground">Strategist activated</h3>
          <p className="text-[11px] text-muted-foreground truncate">
            {phase === "thinking"
              ? "Building outreach strategy based on Scout insights..."
              : `Strategy built for ${leads.length} leads`}
          </p>
        </div>
        {phase === "thinking" && (
          <div className="ml-auto flex items-center gap-1 text-primary text-xs shrink-0">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {/* Context Banner */}
      <div className="px-4 pt-3 pb-1 shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 border border-border">
          <span className="font-medium text-foreground">{leads.length} leads</span>
          <span className="text-border">|</span>
          <span>Based on: <span className="font-medium text-foreground">{strategy?.basis || opportunity || "Scout Research"}</span></span>
          {strategy && (
            <>
              <span className="text-border">|</span>
              <span>Confidence: <Badge variant="outline" className={`text-[10px] ml-1 ${
                strategy.confidence === "High" 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" 
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
              }`}>{strategy.confidence}</Badge></span>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">
        {/* Thinking Phase */}
        {phase === "thinking" && (
          <Card className="p-4 bg-muted/20 border-border space-y-2.5">
            {thinkingSteps.map((step, i) => (
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
          </Card>
        )}

        {/* Strategy Output */}
        {phase === "complete" && strategy && (
          <div className="space-y-4">
            {/* 1. Recommended Outreach Strategy */}
            <Card className="p-4 border-border space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <Target className="h-3 w-3 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Recommended Outreach Strategy</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs font-medium">Target Persona</span>
                  <p className="text-foreground font-medium">{strategy.targetPersona}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-medium">Primary Angle</span>
                  <p className="text-foreground">{strategy.primaryAngle}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-medium">Supporting Angles</span>
                  <div className="space-y-1 mt-1">
                    {strategy.supportingAngles.map((angle, i) => (
                      <div key={i} className="flex items-start gap-2 text-foreground text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                        {angle}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* 2. Why This Angle Works */}
            <Card className="p-4 border-border space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Zap className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Why This Angle Works</h4>
              </div>
              <div className="space-y-1.5">
                {strategy.whyItWorks.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/60 mt-1.5 shrink-0" />
                    {reason}
                  </div>
                ))}
              </div>
            </Card>

            {/* 3. Timing Strategy */}
            <Card className="p-4 border-border space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Timing Strategy</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs font-medium">Best Time to Reach Out</span>
                  <p className="text-foreground font-medium">{strategy.timing.window}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-medium">Reason</span>
                  <p className="text-foreground">{strategy.timing.reason}</p>
                </div>
              </div>
            </Card>

            {/* 4. Outreach Sequence Plan */}
            <Card className="p-4 border-border space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-3 w-3 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Outreach Sequence Plan</h4>
                <Badge variant="outline" className="text-[10px] ml-auto">5-Step Sequence</Badge>
              </div>
              <div className="space-y-2">
                {strategy.sequence.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <Badge variant="secondary" className="text-[10px] shrink-0 min-w-[52px] justify-center font-mono">
                      {step.day}
                    </Badge>
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{step.action}</span>
                      <span className="text-muted-foreground ml-1.5">— {step.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 5. Message Direction */}
            <Card className="p-4 border-border space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-3 w-3 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Message Direction</h4>
                <Badge variant="outline" className="text-[10px] ml-auto text-muted-foreground">Strategic — not full copy</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs font-medium">Opening Hook</span>
                  <p className="text-foreground italic">{strategy.messageDirection.hook}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-medium">Core Message</span>
                  <p className="text-foreground">{strategy.messageDirection.coreMessage}</p>
                </div>
              </div>
            </Card>

            {/* 6. Next Actions */}
            <Card className="p-4 border-primary/20 bg-primary/5 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Next Actions</h4>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="text-xs gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Generate Emails
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Create LinkedIn Messages
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Customize for Top Leads
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategistWorkspace;
