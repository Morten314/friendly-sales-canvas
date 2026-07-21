import { Check, X } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";

export interface ExecutiveSummarySectionProps {
  isEditing: boolean;
  normalizedDeletedSections: Set<string>;
  localExecutiveSummary: string;
  setLocalExecutiveSummary: (v: string) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape" | "regulatory-compliance",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
  currentExecutiveSummary: string;
}

export function ExecutiveSummarySection({
  isEditing,
  normalizedDeletedSections,
  localExecutiveSummary,
  setLocalExecutiveSummary,
  onExecutiveSummaryChange,
  onDeleteSection,
  onScoutIconClick,
  currentExecutiveSummary,
}: ExecutiveSummarySectionProps) {
  const { toast } = useToast();

  if (isEditing) {
    return normalizedDeletedSections.has("executive-summary") ? null : (
      <div className="relative group border border-gray-200 rounded-lg p-4">
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <button
            onClick={() => {
              onExecutiveSummaryChange(localExecutiveSummary);
              toast({
                title: "Saved",
                description: "Executive Summary changes committed.",
              });
            }}
            className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
            title="Commit changes"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              onDeleteSection("executive-summary");
              onScoutIconClick(
                "regulatory-compliance",
                true,
                "I noticed you removed the Executive Summary. Want me to help refine or replace it?",
              );
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
          >
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Executive Summary</h3>
        <textarea
          value={localExecutiveSummary}
          onChange={(e) => {
            setLocalExecutiveSummary(e.target.value);
            onExecutiveSummaryChange(e.target.value);
          }}
          className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none"
          rows={4}
          placeholder="Enter executive summary..."
        />
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Executive Summary</h3>
      <p className="text-gray-600 leading-relaxed">
        {currentExecutiveSummary ||
          "The regulatory landscape for SaaS companies continues to evolve rapidly, with new compliance requirements emerging across multiple jurisdictions."}
      </p>
    </div>
  );
}
