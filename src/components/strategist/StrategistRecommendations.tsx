import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Target, Mail, Users, TrendingUp, Eye, Megaphone,
  ArrowRight, Shield, MessageSquare, Handshake, BarChart3,
} from "lucide-react";
import { heatmapLeads } from "@/components/market-research/lead-stream/leadData";

interface Recommendation {
  title: string;
  detail: string;
  icon: React.ReactNode;
}

const TIER_CONFIG: Record<string, {
  label: string;
  tagline: string;
  color: string;
  cardBorder: string;
  iconBg: string;
  recommendations: Recommendation[];
}> = {
  "Tier 1": {
    label: "Tier 1 — Prioritise Now",
    tagline: "High-intent leads showing strong buying signals across multiple dimensions",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    cardBorder: "border-emerald-200/60 dark:border-emerald-800/40",
    iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    recommendations: [
      {
        title: "Personalised Direct Outreach",
        detail: "Initiate 1:1 outreach to decision-makers referencing their specific growth signals — hiring surges, funding rounds, or product launches. Use a pain-point-led opening tied to their industry context.",
        icon: <Mail className="h-4 w-4" />,
      },
      {
        title: "Multi-Thread Key Accounts",
        detail: "Identify 2–3 stakeholders per account (e.g., VP Sales, Head of Ops, CTO) and run parallel engagement tracks. Tier 1 accounts convert 3× faster when multi-threaded within the first 14 days.",
        icon: <Users className="h-4 w-4" />,
      },
      {
        title: "Custom Value Proposition Mapping",
        detail: "Build account-specific value maps connecting their observed pain points (from market signals) to your solution's differentiated capabilities. Include ROI estimates based on comparable wins.",
        icon: <Target className="h-4 w-4" />,
      },
      {
        title: "Executive Briefing Request",
        detail: "For accounts with 80+ lead scores, propose a 20-minute executive briefing focused on their segment's emerging trends. Position as a strategic conversation, not a sales pitch.",
        icon: <Handshake className="h-4 w-4" />,
      },
    ],
  },
  "Tier 2": {
    label: "Tier 2 — Evaluate & Engage",
    tagline: "Moderate-intent leads that need nurturing through value-driven touchpoints",
    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    cardBorder: "border-amber-200/60 dark:border-amber-800/40",
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    recommendations: [
      {
        title: "Trigger-Based Nurture Sequence",
        detail: "Set up automated sequences that activate on signal changes — e.g., when a Tier 2 lead posts a job opening, raises funding, or engages with competitor content. Each trigger should map to a specific email template.",
        icon: <Zap className="h-4 w-4" />,
      },
      {
        title: "Thought Leadership Distribution",
        detail: "Share curated industry insights, benchmark reports, or case studies relevant to their segment. Focus on educating rather than selling — build authority and stay top-of-mind for when buying intent increases.",
        icon: <TrendingUp className="h-4 w-4" />,
      },
      {
        title: "Warm Introduction Campaigns",
        detail: "Leverage mutual connections, shared event attendance, or community memberships to create warm entry points. Tier 2 leads convert 2× better through introductions vs. cold outreach.",
        icon: <Megaphone className="h-4 w-4" />,
      },
    ],
  },
  "Tier 3": {
    label: "Tier 3 — Nurture & Monitor",
    tagline: "Early-stage leads requiring awareness building and signal monitoring",
    color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    cardBorder: "border-red-200/60 dark:border-red-800/40",
    iconBg: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
    recommendations: [
      {
        title: "Low-Touch Awareness Campaigns",
        detail: "Enrol in broad awareness campaigns — retargeting ads, newsletter subscriptions, webinar invites. The goal is brand recognition so when buying signals emerge, your solution is already on their radar.",
        icon: <Eye className="h-4 w-4" />,
      },
      {
        title: "Signal Monitoring & Re-Scoring",
        detail: "Set up automated monitoring for signal changes: new funding announcements, leadership hires, tech stack changes, or competitor displacement events. Re-evaluate tier assignment monthly.",
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        title: "Competitive Displacement Watch",
        detail: "Track which competitors these accounts currently use and monitor for contract renewals, dissatisfaction signals (negative reviews, support complaints), or switching indicators. Be ready with a displacement playbook.",
        icon: <Shield className="h-4 w-4" />,
      },
    ],
  },
};

const StrategistRecommendations = () => {
  const navigate = useNavigate();

  const tierCounts: Record<string, number> = {
    "Tier 1": heatmapLeads.filter((l) => l.priority === "Tier 1").length,
    "Tier 2": heatmapLeads.filter((l) => l.priority === "Tier 2").length,
    "Tier 3": heatmapLeads.filter((l) => l.priority === "Tier 3").length,
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Strategist Recommendations
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Real-time action recommendations based on Scout's lead intelligence — review and decide
        </p>
      </div>

      {/* Tier Sections */}
      {(["Tier 1", "Tier 2", "Tier 3"] as const).map((tier) => {
        const config = TIER_CONFIG[tier];
        const count = tierCounts[tier];

        return (
          <div key={tier} className="space-y-3">
            {/* Tier Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[11px] font-semibold ${config.color}`}>
                  {config.label}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {count} lead{count !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={() => navigate("/your-ai-team/strategist/leadstream")}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <Users className="h-3 w-3" />
                View Leads
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground/80 -mt-1">{config.tagline}</p>

            {/* Recommendation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {config.recommendations.map((rec, idx) => (
                <Card key={idx} className={`p-3 ${config.cardBorder} hover:shadow-sm transition-shadow`}>
                  <div className="flex gap-2.5">
                    <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${config.iconBg}`}>
                      {rec.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">{rec.title}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
                        {rec.detail}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StrategistRecommendations;
