import { Check, X } from "lucide-react";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { RegulatoryKeyDataPoint, UntypedRegulatoryUpdate } from "./types";

import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

export interface KeyRegulatoryUpdatesSectionProps {
  isEditing: boolean;
  normalizedDeletedSections: Set<string>;
  keyDataPoints: RegulatoryKeyDataPoint[];
  onDeleteSection: (sectionId: string) => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape" | "regulatory-compliance",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
  localEuAiActDeadline: string;
  setLocalEuAiActDeadline: (v: string) => void;
  onEuAiActDeadlineChange: (value: string) => void;
  localGdprCompliance: string;
  setLocalGdprCompliance: (v: string) => void;
  onGdprComplianceChange: (value: string) => void;
  localPotentialFines: string;
  setLocalPotentialFines: (v: string) => void;
  onPotentialFinesChange: (value: string) => void;
  localDataLocalization: string;
  setLocalDataLocalization: (v: string) => void;
  onDataLocalizationChange: (value: string) => void;
  localKeyDataValues: Record<string, string>;
  setLocalKeyDataValues: Dispatch<SetStateAction<Record<string, string>>>;
}

export function KeyRegulatoryUpdatesSection({
  isEditing,
  normalizedDeletedSections,
  keyDataPoints,
  onDeleteSection,
  onScoutIconClick,
  localEuAiActDeadline,
  setLocalEuAiActDeadline,
  onEuAiActDeadlineChange,
  localGdprCompliance,
  setLocalGdprCompliance,
  onGdprComplianceChange,
  localPotentialFines,
  setLocalPotentialFines,
  onPotentialFinesChange,
  localDataLocalization,
  setLocalDataLocalization,
  onDataLocalizationChange,
  localKeyDataValues,
  setLocalKeyDataValues,
}: KeyRegulatoryUpdatesSectionProps) {
  const { toast } = useToast();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  if (isEditing) {
    return normalizedDeletedSections.has("key-updates") ? null : (
      <div className="relative group border border-gray-200 rounded-lg p-4">
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <button
            onClick={() => {
              toast({
                title: "Saved",
                description: "Key Regulatory Updates changes committed.",
              });
            }}
            className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
            title="Commit changes"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              onDeleteSection("key-updates");
              onScoutIconClick(
                "regulatory-compliance",
                true,
                "I noticed you removed the Key Regulatory Updates. Want me to help refine or replace it?",
              );
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
          >
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Regulatory Updates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {keyDataPoints.map((point: UntypedRegulatoryUpdate) => {
            const IconComponent = point.icon;
            return (
              <div key={point.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <IconComponent className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="text-sm font-medium text-gray-900 leading-tight">
                        {point.title}
                      </h5>
                      <Badge className={`${point.badgeColor} text-xs`}>{point.badge}</Badge>
                    </div>
                    <input
                      type="text"
                      value={
                        point.id === "eu-ai-act"
                          ? localEuAiActDeadline
                          : point.id === "gdpr-compliance"
                            ? localGdprCompliance
                            : point.id === "potential-fines"
                              ? localPotentialFines
                              : point.id === "data-localization"
                                ? localDataLocalization
                                : localKeyDataValues[point.id] || point.value
                      }
                      onKeyDown={(_e) => {}}
                      onInput={(_e) => {}}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        if (point.id === "eu-ai-act") {
                          setLocalEuAiActDeadline(newValue);
                          onEuAiActDeadlineChange(newValue);
                        } else if (point.id === "gdpr-compliance") {
                          setLocalGdprCompliance(newValue);
                          onGdprComplianceChange(newValue);
                        } else if (point.id === "potential-fines") {
                          setLocalPotentialFines(newValue);
                          onPotentialFinesChange(newValue);
                        } else if (point.id === "data-localization") {
                          setLocalDataLocalization(newValue);
                          onDataLocalizationChange(newValue);
                        } else {
                          // Handle dynamic fields
                          setLocalKeyDataValues((prev) => ({
                            ...prev,
                            [point.id]: newValue,
                          }));
                        }
                      }}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Regulatory Updates</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {keyDataPoints.map((point: UntypedRegulatoryUpdate) => {
          const IconComponent = point.icon;
          return (
            <div
              key={point.id}
              className="relative p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
              onMouseEnter={() => setHoveredCard(point.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <IconComponent className="h-4 w-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="text-sm font-medium text-gray-900 leading-tight">
                      {point.title}
                    </h5>
                    <Badge className={`${point.badgeColor} text-xs`}>{point.badge}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{point.value}</p>
                </div>
              </div>

              {/* Tooltip */}
              {hoveredCard === point.id && (
                <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs">
                  <p>{point.tooltip}</p>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
