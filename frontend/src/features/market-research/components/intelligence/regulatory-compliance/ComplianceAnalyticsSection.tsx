import { Check, X } from "lucide-react";

import { ComplianceVisualCard } from "./ComplianceVisualCard";
import type { UntypedVisualDataCard } from "./types";

import { useToast } from "@/components/ui/use-toast";

export interface ComplianceAnalyticsSectionProps {
  isEditing: boolean;
  normalizedDeletedSections: Set<string>;
  visualDataCards: UntypedVisualDataCard[];
  localVisualDataCards: UntypedVisualDataCard[];
  setLocalVisualDataCards: (next: UntypedVisualDataCard[]) => void;
  onDeleteSection: (sectionId: string) => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape" | "regulatory-compliance",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
}

export function ComplianceAnalyticsSection({
  isEditing,
  normalizedDeletedSections,
  visualDataCards,
  localVisualDataCards,
  setLocalVisualDataCards,
  onDeleteSection,
  onScoutIconClick,
}: ComplianceAnalyticsSectionProps) {
  const { toast } = useToast();

  if (isEditing) {
    if (normalizedDeletedSections.has("compliance-analytics")) {
      return null;
    }
    return (
      <div className="relative group border border-gray-200 rounded-lg p-4">
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <button
            onClick={() => {
              toast({
                title: "Saved",
                description: "Compliance Analytics changes committed.",
              });
            }}
            className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
            title="Commit changes"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              onDeleteSection("compliance-analytics");
              onScoutIconClick(
                "regulatory-compliance",
                true,
                "I noticed you removed the Compliance Analytics. Want me to help refine or replace it?",
              );
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
          >
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Analytics</h3>
        {(isEditing ? localVisualDataCards : visualDataCards) &&
        (isEditing ? localVisualDataCards : visualDataCards).length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(isEditing ? localVisualDataCards : visualDataCards).map(
              (card: UntypedVisualDataCard, cardIndex: number) => (
                <ComplianceVisualCard
                  key={cardIndex}
                  card={card}
                  cardIndex={cardIndex}
                  isEditing={isEditing}
                  isExpanded={false}
                  localVisualDataCards={localVisualDataCards}
                  onVisualDataCardsChange={setLocalVisualDataCards}
                />
              ),
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No compliance analytics data available</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Analytics</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {visualDataCards.map((card: UntypedVisualDataCard, cardIndex: number) => (
          <ComplianceVisualCard
            key={cardIndex}
            card={card}
            cardIndex={cardIndex}
            isEditing={false}
            isExpanded={true}
            localVisualDataCards={localVisualDataCards}
            onVisualDataCardsChange={setLocalVisualDataCards}
          />
        ))}
      </div>
    </div>
  );
}
