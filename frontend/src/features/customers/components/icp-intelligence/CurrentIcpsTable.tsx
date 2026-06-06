import {
  Check,
  X,
  Eye,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  ThumbsUp,
  Gauge,
  Zap,
  MessageSquare,
  Trash2,
} from "lucide-react";

import type { ExistingICP } from "../../types";

import { EditDropdownMenu } from "./EditDropdownMenu";
import { analyzeICP, confidenceColor } from "./icpMapping";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

interface CurrentIcpsTableProps {
  existingICPs: ExistingICP[];
  expandedCurrentICPId: string | null;
  onToggleExpand: (id: string | null) => void;
  onDelete: (icp: ExistingICP) => void;
  onViewProspects: (icpName: string) => void;
}

export const CurrentIcpsTable = ({
  existingICPs,
  expandedCurrentICPId,
  onToggleExpand,
  onDelete,
  onViewProspects,
}: CurrentIcpsTableProps) => {
  const { toast } = useToast();
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Current ICPs
      </h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Company Size</TableHead>
              <TableHead>Buyer Role</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Report</TableHead>
              <TableHead className="text-right">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {existingICPs.map((icp) => {
              const analysis = analyzeICP(icp);
              const isExpanded = expandedCurrentICPId === icp.id;
              return (
                <>
                  <TableRow key={icp.id}>
                    <TableCell className="font-medium">{icp.name}</TableCell>
                    <TableCell>{icp.industry || "—"}</TableCell>
                    <TableCell>{icp.geography || "—"}</TableCell>
                    <TableCell>{icp.companySize || "—"}</TableCell>
                    <TableCell>{icp.buyerRole || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${confidenceColor(icp.fitConfidence || "Medium")}`}
                      >
                        {icp.fitConfidence || "Medium"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewProspects(icp.name)}
                        className="text-primary hover:text-primary/80"
                      >
                        <Zap className="h-3.5 w-3.5 mr-1" />
                        View Leads
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleExpand(isExpanded ? null : icp.id)}
                        className="text-primary hover:text-primary/80"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        {isExpanded ? "Close" : "View Report"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(icp)}
                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${icp.id}-report`}>
                      <TableCell colSpan={9} className="p-0">
                        <div className="transition-all duration-500 ease-in-out border-t px-6 py-5 space-y-5 bg-background">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <h4 className="text-sm font-semibold">
                                Profiler's Analysis — {icp.name}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1">
                              <EditDropdownMenu
                                onModify={() =>
                                  toast({
                                    title: "Edit mode",
                                    description: "You can now modify this report.",
                                  })
                                }
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:text-primary/80 gap-1 h-7 text-xs"
                                onClick={() =>
                                  toast({
                                    title: "Chat with Profiler",
                                    description: "Profiler agent chat opening...",
                                  })
                                }
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Agentic
                              </Button>
                            </div>
                          </div>

                          <div className="bg-muted/50 rounded-lg p-4">
                            <p className="text-xs font-medium text-foreground mb-1">
                              Profiler's Interpretation
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {analysis.interpretation}
                            </p>
                          </div>

                          {analysis.strengths.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" /> What's Good
                              </p>
                              <ul className="space-y-1.5">
                                {analysis.strengths.map((s, i) => (
                                  <li key={i} className="text-xs flex items-start gap-2">
                                    <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {analysis.weaknesses.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Weak Points
                              </p>
                              <ul className="space-y-1.5">
                                {analysis.weaknesses.map((w, i) => (
                                  <li key={i} className="text-xs flex items-start gap-2">
                                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {analysis.missing.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-2 flex items-center gap-1">
                                <X className="h-3 w-3" /> Missing
                              </p>
                              <ul className="space-y-1.5">
                                {analysis.missing.map((m, i) => (
                                  <li key={i} className="text-xs flex items-start gap-2">
                                    <X className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                                    {m}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex items-center gap-2 text-xs">
                              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">{analysis.broadNarrow}</span>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs ${confidenceColor(analysis.confidence)}`}
                            >
                              Confidence: {analysis.confidence}
                            </Badge>
                          </div>

                          <div className="bg-primary/[0.03] rounded-lg p-3 border border-primary/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-primary" />
                              <div>
                                <p className="text-xs font-semibold text-foreground">
                                  View prospects
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  See leads for "{icp.name}"
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => onViewProspects(icp.name)}
                            >
                              Lead Stream <ArrowRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
