import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Zap } from "lucide-react";

const tierCards = [
  {
    tier: "Tier 1",
    badge: "High Priority",
    badgeVariant: "default" as const,
    fitScore: 82,
    color: "hsl(var(--chart-1))",
    whyItFits:
      "Strong alignment with your ICP across firmographics, buying signals, and decision-maker engagement. These leads match 4+ report dimensions with high scores.",
    keyRisks:
      "Competitive pressure from incumbents; longer enterprise sales cycles may delay conversion.",
    recommendedAction:
      "Prioritise for immediate outreach. Assign dedicated AEs and personalise messaging using Scout intelligence.",
  },
  {
    tier: "Tier 2",
    badge: "Moderate Priority",
    badgeVariant: "secondary" as const,
    fitScore: 58,
    color: "hsl(var(--chart-2))",
    whyItFits:
      "Partial ICP match — strong in 2–3 report dimensions but gaps in market timing or budget signals. Good potential with nurturing.",
    keyRisks:
      "Budget constraints or unclear buying timelines; may require longer qualification cycles.",
    recommendedAction:
      "Add to nurture sequences. Monitor for trigger events and re-score monthly as new intelligence arrives.",
  },
  {
    tier: "Tier 3",
    badge: "Low Priority",
    badgeVariant: "outline" as const,
    fitScore: 28,
    color: "hsl(var(--chart-3))",
    whyItFits:
      "Limited overlap with current ICP criteria. May match on industry or region but lack key buying signals or decision-maker access.",
    keyRisks:
      "Low conversion probability; resource investment unlikely to yield near-term ROI.",
    recommendedAction:
      "Park for now. Revisit if ICP evolves or new market signals emerge. Use for market awareness campaigns only.",
  },
];

const TierOpportunityCards: React.FC = () => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground tracking-tight">
        Tier Validation
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tierCards.map((card) => (
          <Card key={card.tier} className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: card.color }}
                />
                <span className="text-sm font-bold text-foreground">
                  {card.tier}
                </span>
              </div>
              <Badge variant={card.badgeVariant} className="text-[10px] px-2 py-0.5">
                {card.badge}
              </Badge>
            </div>

            {/* Fit Score */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${card.fitScore}%`,
                    backgroundColor: card.color,
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-foreground">
                {card.fitScore}%
              </span>
            </div>

            {/* Details */}
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex items-center gap-1 text-primary font-medium mb-0.5">
                  <TrendingUp className="h-3 w-3" />
                  Why it fits
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {card.whyItFits}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1 text-destructive font-medium mb-0.5">
                  <AlertTriangle className="h-3 w-3" />
                  Key risks
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {card.keyRisks}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1 text-accent-foreground font-medium mb-0.5">
                  <Zap className="h-3 w-3" />
                  Recommended action
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {card.recommendedAction}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TierOpportunityCards;
