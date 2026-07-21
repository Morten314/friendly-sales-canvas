import { Check, Trash2, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import type { UntypedRegionData } from "./types";

import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/components/ui/use-toast";

export interface RegionalComplianceSectionProps {
  isEditing: boolean;
  normalizedDeletedSections: Set<string>;
  regionalData: UntypedRegionData[];
  localRegionalData: UntypedRegionData[];
  setLocalRegionalData: Dispatch<SetStateAction<UntypedRegionData[]>>;
  onDeleteSection: (sectionId: string) => void;
  onScoutIconClick: (
    context?: "market-size" | "industry-trends" | "competitor-landscape" | "regulatory-compliance",
    hasEdits?: boolean,
    customMessage?: string,
  ) => void;
}

export function RegionalComplianceSection({
  isEditing,
  normalizedDeletedSections,
  regionalData,
  localRegionalData,
  setLocalRegionalData,
  onDeleteSection,
  onScoutIconClick,
}: RegionalComplianceSectionProps) {
  const { toast } = useToast();

  if (isEditing) {
    if (normalizedDeletedSections.has("regional-breakdown")) {
      return null;
    }
    return (
      <div className="relative group border border-gray-200 rounded-lg p-4">
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <button
            onClick={() => {
              toast({
                title: "Saved",
                description: "Regional Breakdown changes committed.",
              });
            }}
            className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
            title="Commit changes"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              onDeleteSection("regional-breakdown");
              onScoutIconClick(
                "regulatory-compliance",
                true,
                "I noticed you removed the Regional Compliance Overview. Want me to help refine or replace it?",
              );
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 hover:bg-red-100 rounded"
          >
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Compliance Overview</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-medium">Region</TableHead>
                <TableHead className="font-medium">Framework</TableHead>
                <TableHead className="font-medium">Deadline</TableHead>
                <TableHead className="font-medium">Impact</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="font-medium">Key Requirements</TableHead>
                {isEditing && <TableHead className="font-medium">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isEditing ? localRegionalData : regionalData).map(
                (region: UntypedRegionData, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {isEditing ? (
                        <Input
                          value={region.region || ""}
                          onChange={(e) => {
                            const updated = [...localRegionalData];
                            updated[index] = { ...updated[index], region: e.target.value };
                            setLocalRegionalData(updated);
                          }}
                          className="w-full text-sm"
                        />
                      ) : (
                        region.region
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={region.framework || ""}
                          onChange={(e) => {
                            const updated = [...localRegionalData];
                            updated[index] = {
                              ...updated[index],
                              framework: e.target.value,
                            };
                            setLocalRegionalData(updated);
                          }}
                          className="w-full text-sm"
                        />
                      ) : (
                        region.framework
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={region.deadline || ""}
                          onChange={(e) => {
                            const updated = [...localRegionalData];
                            updated[index] = {
                              ...updated[index],
                              deadline: e.target.value,
                            };
                            setLocalRegionalData(updated);
                          }}
                          className="w-full text-sm"
                        />
                      ) : (
                        region.deadline
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={region.impact || ""}
                          onChange={(e) => {
                            const updated = [...localRegionalData];
                            updated[index] = { ...updated[index], impact: e.target.value };
                            setLocalRegionalData(updated);
                          }}
                          className="w-full text-sm"
                        />
                      ) : (
                        <Badge
                          className={`${
                            region.impact === "High"
                              ? "bg-red-100 text-red-800"
                              : region.impact === "Medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {region.impact}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={region.status || ""}
                          onChange={(e) => {
                            const updated = [...localRegionalData];
                            updated[index] = { ...updated[index], status: e.target.value };
                            setLocalRegionalData(updated);
                          }}
                          className="w-full text-sm"
                        />
                      ) : (
                        <Badge
                          className={`${
                            region.status === "Active" || region.status === "Mandatory"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {region.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {isEditing ? (
                        <Input
                          value={region.requirements || ""}
                          onChange={(e) => {
                            const updated = [...localRegionalData];
                            updated[index] = {
                              ...updated[index],
                              requirements: e.target.value,
                            };
                            setLocalRegionalData(updated);
                          }}
                          className="w-full text-sm"
                        />
                      ) : (
                        region.requirements
                      )}
                    </TableCell>
                    {isEditing && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLocalRegionalData(localRegionalData.filter((_, i) => i !== index));
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
          {isEditing && (
            <div className="p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLocalRegionalData([
                    ...localRegionalData,
                    {
                      region: "",
                      framework: "",
                      deadline: "",
                      impact: "Medium",
                      status: "Active",
                      requirements: "",
                    },
                  ]);
                }}
              >
                Add Region
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Compliance Overview</h3>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-medium">Region</TableHead>
              <TableHead className="font-medium">Framework</TableHead>
              <TableHead className="font-medium">Deadline</TableHead>
              <TableHead className="font-medium">Impact</TableHead>
              <TableHead className="font-medium">Status</TableHead>
              <TableHead className="font-medium">Key Requirements</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regionalData.map((region: UntypedRegionData, index: number) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{region.region}</TableCell>
                <TableCell>{region.framework}</TableCell>
                <TableCell>{region.deadline}</TableCell>
                <TableCell>
                  <Badge
                    className={`${
                      region.impact === "High"
                        ? "bg-red-100 text-red-800"
                        : region.impact === "Medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                    }`}
                  >
                    {region.impact}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={`${
                      region.status === "Active" || region.status === "Mandatory"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {region.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{region.requirements}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
