import { Plus, Trash2, Edit, Target } from "lucide-react";
import React from "react";

import type { ICP, FitConfidence } from "../../types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Pure helper: maps a fit-confidence value to its badge. Reads only its arg.
const getFitConfidenceBadge = (confidence: FitConfidence) => {
  switch (confidence) {
    case "high":
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
        >
          High
        </Badge>
      );
    case "medium":
      return (
        <Badge
          variant="outline"
          className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800"
        >
          Medium
        </Badge>
      );
    case "low":
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
        >
          Low
        </Badge>
      );
    default:
      return null;
  }
};

export interface IcpListProps {
  icps: ICP[];
  onEdit: (icp: ICP) => void;
  onDelete: (id: string) => void;
  isAddingInline: boolean;
  onStartAdd: () => void;
}

/**
 * Presentational saved-ICP list. Controlled: props in, callbacks out — no
 * writes, no hooks. Renders the empty-state when there are no ICPs (and the
 * wizard is closed) and the saved-ICP table when there are. Row actions call
 * back to the container's edit/delete handlers.
 */
const IcpList: React.FC<IcpListProps> = ({
  icps,
  onEdit,
  onDelete,
  isAddingInline,
  onStartAdd,
}) => {
  return (
    <>
      {/* Empty State */}
      {icps.length === 0 && !isAddingInline && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h4 className="text-lg font-medium mb-2">No ICPs defined yet</h4>
          <p className="text-muted-foreground text-sm mb-4">
            Define your Ideal Customer Profiles to help agents target the right accounts.
          </p>
          <Button onClick={onStartAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add ICP
          </Button>
        </div>
      )}

      {/* ICPs Table */}
      {icps.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Geography</TableHead>
                <TableHead className="font-semibold">Location</TableHead>
                <TableHead className="font-semibold">Industry</TableHead>
                <TableHead className="font-semibold">Company Size</TableHead>
                <TableHead className="font-semibold">Job Title</TableHead>
                <TableHead className="font-semibold">Fit Confidence</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {icps.map((icp) => (
                <TableRow key={icp.id}>
                  <TableCell>
                    <span className="font-medium">{icp.primaryRegion}</span>
                  </TableCell>
                  <TableCell>
                    {icp.location && icp.location.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {icp.location.map((loc, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {loc}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {icp.industry.slice(0, 2).map((ind) => (
                        <Badge key={ind} variant="outline" className="text-xs">
                          {ind}
                        </Badge>
                      ))}
                      {icp.industry.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{icp.industry.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {icp.companySize.map((size) => (
                        <Badge key={size} variant="secondary" className="text-xs">
                          {size}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {icp.buyerRole.slice(0, 2).map((role) => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                      {icp.buyerRole.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{icp.buyerRole.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getFitConfidenceBadge(icp.fitConfidence)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                    >
                      Saved
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(icp)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(icp.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
};

export default IcpList;
