import { Edit, Trash2 } from "lucide-react";
import React from "react";

import type { DataSource } from "../../types";

import { getStatusBadge, getTypeIcon } from "./dataSourceBadges";
import { getTypeLabel } from "./dataSourceHelpers";
import { mapProcessingStatusToSourceStatus } from "./leadStreamStatus";

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

interface ConnectorTableProps {
  dataSources: DataSource[];
  isAddingInline: boolean;
  onEdit: (source: DataSource) => void;
  onDelete: (id: string) => void;
}

const ConnectorTable: React.FC<ConnectorTableProps> = ({
  dataSources,
  isAddingInline,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[130px]">Type</TableHead>
            <TableHead className="w-[180px]">Name</TableHead>
            <TableHead className="hidden md:table-cell w-[200px]">URL / File</TableHead>
            <TableHead className="hidden lg:table-cell w-[150px]">Description</TableHead>
            <TableHead className="hidden lg:table-cell">Tags</TableHead>
            <TableHead className="w-[110px]">Status</TableHead>
            <TableHead className="w-[90px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Existing Sources */}
          {dataSources.map((source) => (
            <TableRow key={source.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getTypeIcon(source.type)}
                  <span className="text-sm">{getTypeLabel(source.type)}</span>
                </div>
              </TableCell>
              <TableCell className="font-medium">{source.name}</TableCell>
              <TableCell className="hidden md:table-cell">
                {source.type === "url" && source.url ? (
                  <span className="text-sm truncate max-w-[180px] block" title={source.url}>
                    {source.url}
                  </span>
                ) : source.type === "file" && source.fileName ? (
                  <span className="text-sm">{source.fileName}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className="text-sm text-muted-foreground">{source.description || "—"}</span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {source.tags.length > 0 ? (
                  <div
                    className="w-[180px] border rounded-md bg-muted/30 px-2 py-1.5 overflow-x-auto"
                    title={source.tags.length > 2 ? "Scroll to view all tags" : undefined}
                  >
                    <div className="flex gap-1 whitespace-nowrap">
                      {source.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs shrink-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {getStatusBadge(mapProcessingStatusToSourceStatus(source.status))}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(source)}
                    disabled={isAddingInline}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(source.id)}
                    disabled={isAddingInline}
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
  );
};

export default ConnectorTable;
