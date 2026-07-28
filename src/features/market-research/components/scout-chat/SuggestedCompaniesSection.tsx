// Suggested-companies section — part of the market-research scout-chat UI.

import { Plus, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Mock suggested companies - backend will replace with Scout API structured output */
const MOCK_SUGGESTED = [
  { companyName: "Acme SaaS", industry: "SaaS", website: "https://acmesaas.com" },
  { companyName: "FinServe Pro", industry: "FinTech", website: "https://finservepro.io" },
  { companyName: "HealthTech Plus", industry: "Healthcare", website: "https://healthtechplus.com" },
];

interface SuggestedCompaniesSectionProps {
  onAddToLeadStream: (company: { companyName: string; website?: string }) => void;
}

export function SuggestedCompaniesSection({ onAddToLeadStream }: SuggestedCompaniesSectionProps) {
  return (
    <Card className="border-dashed border-blue-200 bg-blue-50/20">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">Suggested companies</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Based on your market research. Add any to your Lead Stream.
        </p>
        <div className="space-y-2">
          {MOCK_SUGGESTED.map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 rounded-md bg-background border text-sm"
            >
              <div>
                <span className="font-medium">{c.companyName}</span>
                <span className="text-muted-foreground ml-2">({c.industry})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1"
                onClick={() => onAddToLeadStream(c)}
              >
                <Plus className="h-3 w-3" />
                Add to Lead Stream
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
