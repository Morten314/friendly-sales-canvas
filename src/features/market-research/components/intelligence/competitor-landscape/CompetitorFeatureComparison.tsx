import { X, Check } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CompetitorFeatureComparisonProps {
  isEditing: boolean;
  localFeatures: string[];
  setLocalFeatures: (features: string[]) => void;
  localTools: Record<string, string[]>;
  setLocalTools: (tools: Record<string, string[]>) => void;
  handleSaveFeatureComparison: () => void;
}

export const CompetitorFeatureComparison: React.FC<CompetitorFeatureComparisonProps> = ({
  isEditing,
  localFeatures,
  setLocalFeatures,
  localTools,
  setLocalTools,
  handleSaveFeatureComparison,
}) => {
  const features = localFeatures;
  const tools = localTools;

  if (!features || !tools || Object.keys(tools).length === 0) return null;

  return (
    <div className="mb-8 relative group">
      {isEditing && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveFeatureComparison}
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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Comparison</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feature</TableHead>
              {Object.keys(tools).map((tool, toolIndex) => (
                <TableHead key={tool}>
                  {isEditing ? (
                    <div className="flex gap-2 items-center">
                      <Input
                        value={tool}
                        onChange={(e) => {
                          const updated = { ...localTools };
                          const oldTool = Object.keys(tools)[toolIndex];
                          updated[e.target.value] = updated[oldTool];
                          delete updated[oldTool];
                          setLocalTools(updated);
                        }}
                        className="bg-white"
                        placeholder="Tool name"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = { ...localTools };
                          delete updated[tool];
                          setLocalTools(updated);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    tool
                  )}
                </TableHead>
              ))}
              {isEditing && (
                <TableHead>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLocalTools({
                        ...localTools,
                        "": Array(features.length).fill(""),
                      });
                    }}
                  >
                    Add Tool
                  </Button>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map((feature, featureIndex) => (
              <TableRow key={featureIndex}>
                <TableCell className="font-medium">
                  {isEditing ? (
                    <Input
                      value={feature}
                      onChange={(e) => {
                        const updated = [...localFeatures];
                        updated[featureIndex] = e.target.value;
                        setLocalFeatures(updated);
                      }}
                      className="bg-white"
                      placeholder="Feature name"
                    />
                  ) : (
                    feature
                  )}
                </TableCell>
                {Object.keys(tools).map((tool) => (
                  <TableCell key={tool}>
                    {isEditing ? (
                      <Input
                        value={tools[tool][featureIndex] || ""}
                        onChange={(e) => {
                          const updated = { ...localTools };
                          updated[tool] = [...updated[tool]];
                          updated[tool][featureIndex] = e.target.value;
                          setLocalTools(updated);
                        }}
                        className="bg-white"
                        placeholder="-"
                      />
                    ) : (
                      tools[tool][featureIndex] || "-"
                    )}
                  </TableCell>
                ))}
                {isEditing && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLocalFeatures(localFeatures.filter((_, i) => i !== featureIndex));
                        const updated = { ...localTools };
                        Object.keys(updated).forEach((tool) => {
                          updated[tool] = updated[tool].filter((_, i) => i !== featureIndex);
                        });
                        setLocalTools(updated);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLocalFeatures([...localFeatures, ""]);
            const updated = { ...localTools };
            Object.keys(updated).forEach((tool) => {
              updated[tool] = [...updated[tool], ""];
            });
            setLocalTools(updated);
          }}
          className="mt-2"
        >
          Add Feature
        </Button>
      )}
    </div>
  );
};
