import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Trash2, Plus, MoreVertical, Megaphone, Mail, MessageSquare } from "lucide-react";

interface StrategistLead {
  id: string;
  name: string;
  company: string;
  totalScore: number;
  priority: string;
  sentAt: string;
}

const PriorityBadge = ({ tier }: { tier: string }) => {
  const styles: Record<string, string> = {
    "Tier 1": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    "Tier 2": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    "Tier 3": "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  };

  return (
    <Badge variant="outline" className={`text-[11px] font-semibold ${styles[tier] || ""}`}>
      {tier}
    </Badge>
  );
};

const StrategistLeadStream = () => {
  const [leads, setLeads] = useState<StrategistLead[]>([]);
  const [customColumns, setCustomColumns] = useState<string[]>(["", "", "", ""]);

  useEffect(() => {
    const stored = localStorage.getItem("strategistLeadStream");
    if (stored) {
      try {
        setLeads(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, []);

  const removeLead = (id: string) => {
    const updated = leads.filter((l) => l.id !== id);
    setLeads(updated);
    localStorage.setItem("strategistLeadStream", JSON.stringify(updated));
  };

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Users className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">Your Lead Stream</p>
        <p className="text-xs mt-1 opacity-70">
          Send leads from Scout's heatmap to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Your Lead Stream
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {leads.length} lead{leads.length !== 1 ? "s" : ""}
          </span>
        </h3>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold">Name</TableHead>
              <TableHead className="text-xs font-semibold">Company</TableHead>
              <TableHead className="text-xs font-semibold text-center">Lead Score</TableHead>
              <TableHead className="text-xs font-semibold text-center">Priority</TableHead>
              {customColumns.map((_, idx) => (
                <TableHead key={`custom-${idx}`} className="text-xs text-center min-w-[120px]">
                  <span className="inline-flex items-center gap-1 text-muted-foreground/60 font-medium cursor-default">
                    <Plus className="h-3 w-3" />
                    Add Column
                  </span>
                </TableHead>
              ))}
              <TableHead className="text-xs font-semibold text-right w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id} className="group">
                <TableCell className="text-sm font-medium text-foreground">
                  {lead.name}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {lead.company}
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm font-bold text-foreground">{lead.totalScore}</span>
                </TableCell>
                <TableCell className="text-center">
                  <PriorityBadge tier={lead.priority} />
                </TableCell>
                {customColumns.map((_, idx) => (
                  <TableCell key={`custom-cell-${idx}`} className="text-center text-xs text-muted-foreground/40">
                    —
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => removeLead(lead.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default StrategistLeadStream;
