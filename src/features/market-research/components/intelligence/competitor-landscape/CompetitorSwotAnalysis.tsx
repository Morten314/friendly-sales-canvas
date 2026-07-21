import { X, Check } from "lucide-react";
import React from "react";

import type { SwotEntity } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CompetitorSwotAnalysisProps {
  isEditing: boolean;
  localEntities: SwotEntity[];
  setLocalEntities: (entities: SwotEntity[]) => void;
  handleSaveSwotAnalysis: () => void;
}

export const CompetitorSwotAnalysis: React.FC<CompetitorSwotAnalysisProps> = ({
  isEditing,
  localEntities,
  setLocalEntities,
  handleSaveSwotAnalysis,
}) => {
  const entities = localEntities;

  if (!entities || entities.length === 0) return null;

  return (
    <div className="mb-8 relative group">
      {isEditing && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveSwotAnalysis}
                className="text-gray-400 hover:text-green-600 hover:bg-green-50"
                title="Commit changes"
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Commit changes</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-4">SWOT Analysis</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {entities.map((entity, entityIndex) => (
          <div key={entityIndex} className="bg-white border border-gray-200 rounded-lg p-4">
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={entity.name}
                  onChange={(e) => {
                    const updated = [...localEntities];
                    updated[entityIndex] = {
                      ...updated[entityIndex],
                      name: e.target.value,
                    };
                    setLocalEntities(updated);
                  }}
                  className="font-medium text-gray-900 bg-white"
                  placeholder="Entity name"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <h5 className="text-sm font-medium text-green-600 mb-2">Strengths</h5>
                    <div className="space-y-2">
                      {entity.strengths.map((strength, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={strength}
                            onChange={(e) => {
                              const updated = [...localEntities];
                              updated[entityIndex].strengths[idx] = e.target.value;
                              setLocalEntities(updated);
                            }}
                            className="flex-1 text-sm text-gray-700 bg-white"
                            placeholder="Strength"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = [...localEntities];
                              updated[entityIndex].strengths = updated[
                                entityIndex
                              ].strengths.filter((_, i) => i !== idx);
                              setLocalEntities(updated);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = [...localEntities];
                          updated[entityIndex].strengths = [...updated[entityIndex].strengths, ""];
                          setLocalEntities(updated);
                        }}
                      >
                        Add Strength
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-blue-600 mb-2">Opportunities</h5>
                    <div className="space-y-2">
                      {(entity.opportunities || []).map((opportunity, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={opportunity}
                            onChange={(e) => {
                              const updated = [...localEntities];
                              if (!updated[entityIndex].opportunities)
                                updated[entityIndex].opportunities = [];
                              updated[entityIndex].opportunities[idx] = e.target.value;
                              setLocalEntities(updated);
                            }}
                            className="flex-1 text-sm text-gray-700 bg-white"
                            placeholder="Opportunity"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = [...localEntities];
                              if (updated[entityIndex].opportunities) {
                                updated[entityIndex].opportunities = updated[
                                  entityIndex
                                ].opportunities.filter((_, i) => i !== idx);
                                setLocalEntities(updated);
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = [...localEntities];
                          if (!updated[entityIndex].opportunities)
                            updated[entityIndex].opportunities = [];
                          updated[entityIndex].opportunities = [
                            ...updated[entityIndex].opportunities,
                            "",
                          ];
                          setLocalEntities(updated);
                        }}
                      >
                        Add Opportunity
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-red-600 mb-2">Weaknesses</h5>
                    <div className="space-y-2">
                      {entity.weaknesses.map((weakness, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={weakness}
                            onChange={(e) => {
                              const updated = [...localEntities];
                              updated[entityIndex].weaknesses[idx] = e.target.value;
                              setLocalEntities(updated);
                            }}
                            className="flex-1 text-sm text-gray-700 bg-white"
                            placeholder="Weakness"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = [...localEntities];
                              updated[entityIndex].weaknesses = updated[
                                entityIndex
                              ].weaknesses.filter((_, i) => i !== idx);
                              setLocalEntities(updated);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = [...localEntities];
                          updated[entityIndex].weaknesses = [
                            ...updated[entityIndex].weaknesses,
                            "",
                          ];
                          setLocalEntities(updated);
                        }}
                      >
                        Add Weakness
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-orange-600 mb-2">Threats</h5>
                    <div className="space-y-2">
                      {(entity.threats || []).map((threat, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={threat}
                            onChange={(e) => {
                              const updated = [...localEntities];
                              if (!updated[entityIndex].threats) updated[entityIndex].threats = [];
                              updated[entityIndex].threats[idx] = e.target.value;
                              setLocalEntities(updated);
                            }}
                            className="flex-1 text-sm text-gray-700 bg-white"
                            placeholder="Threat"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = [...localEntities];
                              if (updated[entityIndex].threats) {
                                updated[entityIndex].threats = updated[entityIndex].threats.filter(
                                  (_, i) => i !== idx,
                                );
                                setLocalEntities(updated);
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = [...localEntities];
                          if (!updated[entityIndex].threats) updated[entityIndex].threats = [];
                          updated[entityIndex].threats = [...updated[entityIndex].threats, ""];
                          setLocalEntities(updated);
                        }}
                      >
                        Add Threat
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLocalEntities(localEntities.filter((_, i) => i !== entityIndex));
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove Entity
                </Button>
              </div>
            ) : (
              <>
                <h4 className="font-medium text-gray-900 mb-3">{entity.name}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 p-3 rounded border border-green-100">
                    <h5 className="text-sm font-medium text-green-700 mb-2">Strengths</h5>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {entity.strengths.length > 0 ? (
                        entity.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-green-600 mt-1">•</span>
                            {strength}
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-400 text-xs italic">No data available</li>
                      )}
                    </ul>
                  </div>
                  <div className="bg-blue-50 p-3 rounded border border-blue-100">
                    <h5 className="text-sm font-medium text-blue-700 mb-2">Opportunities</h5>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {(entity.opportunities || []).length > 0 ? (
                        (entity.opportunities || []).map((opportunity, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-600 mt-1">•</span>
                            {opportunity}
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-400 text-xs italic">No data available</li>
                      )}
                    </ul>
                  </div>
                  <div className="bg-orange-50 p-3 rounded border border-orange-100">
                    <h5 className="text-sm font-medium text-orange-700 mb-2">Weaknesses</h5>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {entity.weaknesses.length > 0 ? (
                        entity.weaknesses.map((weakness, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-orange-600 mt-1">•</span>
                            {weakness}
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-400 text-xs italic">No data available</li>
                      )}
                    </ul>
                  </div>
                  <div className="bg-red-50 p-3 rounded border border-red-100">
                    <h5 className="text-sm font-medium text-red-700 mb-2">Threats</h5>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {(entity.threats || []).length > 0 ? (
                        (entity.threats || []).map((threat, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red-600 mt-1">•</span>
                            {threat}
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-400 text-xs italic">No data available</li>
                      )}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setLocalEntities([
              ...localEntities,
              {
                name: "",
                strengths: [],
                weaknesses: [],
                opportunities: [],
                threats: [],
              },
            ])
          }
          className="mt-2"
        >
          Add Entity
        </Button>
      )}
    </div>
  );
};
