import { Building, Check, Shield, Target, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import type { UntypedBackendApiResponse } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export interface StrategicRecommendationsSectionProps {
  isEditing: boolean;
  normalizedDeletedSections: Set<string>;
  localStrategicRecommendations: UntypedBackendApiResponse;
  setLocalStrategicRecommendations: Dispatch<SetStateAction<UntypedBackendApiResponse>>;
  regulatoryData?: UntypedBackendApiResponse;
  onDeleteSection: (sectionId: string) => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape" | "regulatory-compliance",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
}

export function StrategicRecommendationsSection({
  isEditing,
  normalizedDeletedSections,
  localStrategicRecommendations,
  setLocalStrategicRecommendations,
  regulatoryData,
  onDeleteSection,
  onScoutIconClick,
}: StrategicRecommendationsSectionProps) {
  const { toast } = useToast();

  // Read-only: prefer in-session edits, then API, then defaults — matching the
  // ExecutiveSummarySection `local || data || default` chain (TD-FE-25).
  const readField = (
    key: "mitigateRegulatoryRisks" | "competitivePositioning" | "goToMarketStrategy",
  ): string[] | undefined => {
    const local = localStrategicRecommendations?.[key];
    if (Array.isArray(local) && local.length > 0) return local;
    return regulatoryData?.strategicRecommendations?.[key];
  };

  if (isEditing) {
    if (normalizedDeletedSections.has("strategic-recommendations")) {
      return null;
    }
    return (
      <div className="relative group border border-gray-200 rounded-lg p-4">
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <button
            onClick={() => {
              toast({
                title: "Saved",
                description: "Strategic Recommendations changes committed.",
              });
            }}
            className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
            title="Commit changes"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              onDeleteSection("strategic-recommendations");
              onScoutIconClick(
                "regulatory-compliance",
                true,
                "I noticed you removed the Strategic Recommendations. Want me to help refine or replace it?",
              );
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
          >
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    value="Mitigate Regulatory Risks"
                    className="font-medium text-blue-900 mb-2"
                    readOnly
                  />
                ) : (
                  <h5 className="text-sm font-medium text-blue-900 mb-2">
                    Mitigate Regulatory Risks
                  </h5>
                )}
                <div className="space-y-2">
                  {(isEditing
                    ? localStrategicRecommendations.mitigateRegulatoryRisks
                    : [
                        "Implement privacy by design principles",
                        "Establish automated compliance monitoring",
                        "Regular risk assessments and audits",
                        "Cross-functional compliance team",
                      ]
                  ).map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            value={item}
                            onChange={(e) => {
                              const updated = [
                                ...localStrategicRecommendations.mitigateRegulatoryRisks,
                              ];
                              updated[idx] = e.target.value;
                              setLocalStrategicRecommendations({
                                ...localStrategicRecommendations,
                                mitigateRegulatoryRisks: updated,
                              });
                            }}
                            className="flex-1 text-sm text-blue-700"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated =
                                localStrategicRecommendations.mitigateRegulatoryRisks.filter(
                                  (_: string, i: number) => i !== idx,
                                );
                              setLocalStrategicRecommendations({
                                ...localStrategicRecommendations,
                                mitigateRegulatoryRisks: updated,
                              });
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <li className="text-sm text-blue-700">• {item}</li>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLocalStrategicRecommendations({
                          ...localStrategicRecommendations,
                          mitigateRegulatoryRisks: [
                            ...localStrategicRecommendations.mitigateRegulatoryRisks,
                            "",
                          ],
                        });
                      }}
                    >
                      Add Item
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Target className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    value="Competitive Positioning"
                    className="font-medium text-green-900 mb-2"
                    readOnly
                  />
                ) : (
                  <h5 className="text-sm font-medium text-green-900 mb-2">
                    Competitive Positioning
                  </h5>
                )}
                <div className="space-y-2">
                  {(isEditing
                    ? localStrategicRecommendations.competitivePositioning
                    : [
                        "Market compliance as differentiator",
                        "Showcase security certifications",
                        "Transparent data handling practices",
                        "Industry-leading privacy standards",
                      ]
                  ).map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            value={item}
                            onChange={(e) => {
                              const updated = [
                                ...localStrategicRecommendations.competitivePositioning,
                              ];
                              updated[idx] = e.target.value;
                              setLocalStrategicRecommendations({
                                ...localStrategicRecommendations,
                                competitivePositioning: updated,
                              });
                            }}
                            className="flex-1 text-sm text-green-700"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated =
                                localStrategicRecommendations.competitivePositioning.filter(
                                  (_: string, i: number) => i !== idx,
                                );
                              setLocalStrategicRecommendations({
                                ...localStrategicRecommendations,
                                competitivePositioning: updated,
                              });
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <li className="text-sm text-green-700">• {item}</li>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLocalStrategicRecommendations({
                          ...localStrategicRecommendations,
                          competitivePositioning: [
                            ...localStrategicRecommendations.competitivePositioning,
                            "",
                          ],
                        });
                      }}
                    >
                      Add Item
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Building className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    value="Go-to-Market Strategy"
                    className="font-medium text-purple-900 mb-2"
                    readOnly
                  />
                ) : (
                  <h5 className="text-sm font-medium text-purple-900 mb-2">
                    Go-to-Market Strategy
                  </h5>
                )}
                <div className="space-y-2">
                  {(isEditing
                    ? localStrategicRecommendations.goToMarketStrategy
                    : [
                        "Regional deployment capabilities",
                        "Compliance-ready product offerings",
                        "Legal-friendly contract templates",
                        "Enterprise-grade data residency",
                      ]
                  ).map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            value={item}
                            onChange={(e) => {
                              const updated = [...localStrategicRecommendations.goToMarketStrategy];
                              updated[idx] = e.target.value;
                              setLocalStrategicRecommendations({
                                ...localStrategicRecommendations,
                                goToMarketStrategy: updated,
                              });
                            }}
                            className="flex-1 text-sm text-purple-700"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated =
                                localStrategicRecommendations.goToMarketStrategy.filter(
                                  (_: string, i: number) => i !== idx,
                                );
                              setLocalStrategicRecommendations({
                                ...localStrategicRecommendations,
                                goToMarketStrategy: updated,
                              });
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <li className="text-sm text-purple-700">• {item}</li>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLocalStrategicRecommendations({
                          ...localStrategicRecommendations,
                          goToMarketStrategy: [
                            ...localStrategicRecommendations.goToMarketStrategy,
                            "",
                          ],
                        });
                      }}
                    >
                      Add Item
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-blue-900 mb-2">
                {regulatoryData?.strategicRecommendations
                  ? "Mitigate Regulatory Risks"
                  : "Mitigate Regulatory Risks"}
              </h5>
              <ul className="text-sm text-blue-700 space-y-1">
                {readField("mitigateRegulatoryRisks")?.length ? (
                  readField("mitigateRegulatoryRisks")!.map((item: string, index: number) => (
                    <li key={index}>• {item}</li>
                  ))
                ) : (
                  <>
                    <li>• Implement privacy by design principles</li>
                    <li>• Establish automated compliance monitoring</li>
                    <li>• Regular risk assessments and audits</li>
                    <li>• Cross-functional compliance team</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Target className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-green-900 mb-2">
                {regulatoryData?.strategicRecommendations
                  ? "Competitive Positioning"
                  : "Competitive Positioning"}
              </h5>
              <ul className="text-sm text-green-700 space-y-1">
                {readField("competitivePositioning")?.length ? (
                  readField("competitivePositioning")!.map((item: string, index: number) => (
                    <li key={index}>• {item}</li>
                  ))
                ) : (
                  <>
                    <li>• Market compliance as differentiator</li>
                    <li>• Showcase security certifications</li>
                    <li>• Transparent data handling practices</li>
                    <li>• Industry-leading privacy standards</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Building className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-purple-900 mb-2">
                {regulatoryData?.strategicRecommendations
                  ? "Go-to-Market Strategy"
                  : "Go-to-Market Strategy"}
              </h5>
              <ul className="text-sm text-purple-700 space-y-1">
                {readField("goToMarketStrategy")?.length ? (
                  readField("goToMarketStrategy")!.map((item: string, index: number) => (
                    <li key={index}>• {item}</li>
                  ))
                ) : (
                  <>
                    <li>• Regional deployment capabilities</li>
                    <li>• Compliance-ready product offerings</li>
                    <li>• Legal-friendly contract templates</li>
                    <li>• Enterprise-grade data residency</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
